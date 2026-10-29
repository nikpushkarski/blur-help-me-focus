(() => {
  // Content scripts run in an isolated world; this does not modify website globals.
  const key = "__blurHelpMeFocus";
  if (globalThis[key]) return;

  const host = document.createElement("div");
  host.style.cssText = "all: initial !important; position: fixed !important; inset: 0 !important; z-index: 2147483647 !important; pointer-events: none !important;";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host { color-scheme: light; }
      * { box-sizing: border-box; }
      .blur {
        position: absolute;
        inset: 0;
        pointer-events: none;
        backdrop-filter: blur(8px) saturate(35%) brightness(120%);
        -webkit-backdrop-filter: blur(8px) saturate(35%) brightness(120%);
      }
      .editor {
        position: absolute;
        border: 2px solid #4285f4;
        pointer-events: auto;
        cursor: move;
        touch-action: none;
        user-select: none;
      }
      .handle {
        position: absolute;
        width: 12px;
        height: 12px;
        background: white;
        border: 2px solid #4285f4;
        transform: translate(-50%, -50%);
      }
      .settings {
        position: absolute;
        pointer-events: auto;
        overflow: auto;
        padding: 12px;
        border: 1px solid #dadce0;
        border-radius: 8px;
        background: white;
        color: #202124;
        box-shadow: 0 2px 12px #0003;
        font: 13px/1.5 system-ui, sans-serif;
      }
      .settings label { display: block; }
      .settings input { width: 100%; accent-color: #1a73e8; }
      .settings button {
        margin: 6px 4px 0 0;
        padding: 5px 8px;
        border: 1px solid #dadce0;
        border-radius: 4px;
        background: white;
        color: #202124;
        cursor: pointer;
        font: inherit;
      }
      .selector {
        position: absolute;
        inset: 0;
        pointer-events: auto;
        cursor: crosshair;
        touch-action: none;
        user-select: none;
      }
      .rectangle {
        position: absolute;
        border: 2px solid #4285f4;
        background: rgb(66 133 244 / 10%);
        pointer-events: none;
      }
      .hint {
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 12px;
        border-radius: 6px;
        background: #202124;
        color: white;
        font: 13px/1.4 system-ui, sans-serif;
        white-space: nowrap;
        pointer-events: none;
      }
    </style>
  `;
  document.documentElement.append(host);

  // One filtered surface avoids seams between independently blurred tiles.
  const blur = document.createElement("div");
  blur.className = "blur";
  shadow.append(blur);

  let area = null;
  let cancelSelection = null;
  let settings = null;
  let editor = null;
  let previousFocus = null;
  let strength = 8;

  function closeSettings() {
    if (!settings) return;
    editor?.remove();
    editor = null;
    blur.style.pointerEvents = "none";
    settings.remove();
    settings = null;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }

  function positionSettings() {
    if (!settings) return;
    const left = Math.min(area?.left ?? 0, window.innerWidth);
    const top = Math.min(area?.top ?? 0, window.innerHeight);
    const right = Math.min(area?.right ?? window.innerWidth, window.innerWidth);
    const bottom = Math.min(area?.bottom ?? window.innerHeight, window.innerHeight);
    const width = Math.min(240, right - left);
    const height = Math.min(150, bottom - top);
    position(settings, left + (right - left - width) / 2,
      top + (bottom - top - height) / 2, width, height);
  }

  function openEditor() {
    if (!area) return;
    // Normalize to the current viewport before manipulating the rectangle.
    area = {
      left: Math.max(0, Math.min(area.left, window.innerWidth - 4)),
      top: Math.max(0, Math.min(area.top, window.innerHeight - 4)),
      right: Math.min(area.right, window.innerWidth),
      bottom: Math.min(area.bottom, window.innerHeight),
    };
    editor = document.createElement("div");
    editor.className = "editor";
    editor.title = "Drag to move · Drag handles to resize · Esc to finish";
    for (const [direction, x, y, cursor] of [
      ["nw", 0, 0, "nwse"], ["n", 50, 0, "ns"], ["ne", 100, 0, "nesw"],
      ["w", 0, 50, "ew"], ["e", 100, 50, "ew"],
      ["sw", 0, 100, "nesw"], ["s", 50, 100, "ns"], ["se", 100, 100, "nwse"],
    ]) {
      const handle = document.createElement("div");
      handle.className = "handle";
      handle.dataset.direction = direction;
      handle.style.cssText = `left:${x}%;top:${y}%;cursor:${cursor}-resize`;
      editor.append(handle);
    }
    shadow.append(editor);
    blur.style.pointerEvents = "auto";
    let drag = null;
    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
    editor.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.button !== 0 || drag) return;
      drag = { x: event.clientX, y: event.clientY, box: { ...area },
        direction: event.target.dataset.direction, id: event.pointerId };
      editor.setPointerCapture(event.pointerId);
    });
    editor.addEventListener("pointermove", (event) => {
      event.stopPropagation();
      if (!drag || event.pointerId !== drag.id) return;
      const { box, direction } = drag;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      area = { ...box };
      if (!direction) {
        const x = clamp(dx, -box.left, window.innerWidth - box.right);
        const y = clamp(dy, -box.top, window.innerHeight - box.bottom);
        area = { left: box.left + x, right: box.right + x,
          top: box.top + y, bottom: box.bottom + y };
      } else {
        if (direction.includes("w")) area.left = clamp(box.left + dx, 0, box.right - 4);
        if (direction.includes("e")) area.right = clamp(box.right + dx, box.left + 4, window.innerWidth);
        if (direction.includes("n")) area.top = clamp(box.top + dy, 0, box.bottom - 4);
        if (direction.includes("s")) area.bottom = clamp(box.bottom + dy, box.top + 4, window.innerHeight);
      }
      render();
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      editor.addEventListener(type, (event) => {
        event.stopPropagation();
        if (drag?.id !== event.pointerId) return;
        drag = null;
        if (editor.hasPointerCapture(event.pointerId)) editor.releasePointerCapture(event.pointerId);
      });
    }
    editor.addEventListener("click", (event) => event.stopPropagation());
    render();
  }

  // Consume the click so finishing an edit cannot activate the page underneath.
  blur.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  blur.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeSettings();
  });

  function toggleSettings() {
    if (settings) return;
    cancelSelection?.();
    previousFocus = document.activeElement;
    openEditor();
    settings = document.createElement("div");
    settings.className = "settings";
    settings.setAttribute("role", "dialog");
    settings.setAttribute("aria-label", "Blur settings");
    settings.innerHTML = `
      <label>Blur strength: <output>${strength} px</output>
        <input aria-label="Blur strength" type="range" min="0" max="40" value="${strength}">
      </label>
      <button type="button" data-remove>Remove blur</button>
      <button type="button" data-close>Close</button>`;
    shadow.append(settings);
    positionSettings();
    const input = settings.querySelector("input");
    input.addEventListener("input", () => {
      globalThis[key].setStrength(input.value);
      chrome.storage.local.set({ blurStrength: strength }).catch(console.warn);
    });
    settings.querySelector("[data-remove]").onclick = () => globalThis[key].remove();
    settings.querySelector("[data-close]").onclick = closeSettings;
    // Settings interactions must not bubble into website controls.
    for (const type of ["pointerdown", "pointerup", "click", "input", "keydown", "keyup"]) {
      settings.addEventListener(type, (event) => event.stopPropagation());
    }
    input.focus({ preventScroll: true });
  }

  window.addEventListener("keydown", (event) => {
    const typing = event.composedPath().some((element) =>
      element instanceof HTMLElement &&
      (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName))
    );
    // code identifies the physical key, unlike key (which changes with language).
    const physicalB = event.code === "KeyB";
    const activate = physicalB && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey;
    if (activate) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) select();
      return;
    }
    const shortcut = physicalB && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
    if ((shortcut && (!typing || settings)) || (event.key === "Escape" && settings)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (event.key === "Escape") closeSettings();
      else toggleSettings();
    }
  }, true);

  function position(element, x, y, width, height) {
    Object.assign(element.style, {
      left: `${x}px`, top: `${y}px`,
      width: `${width}px`, height: `${height}px`,
    });
  }

  function render() {
    positionSettings();
    if (editor && area) {
      position(editor, area.left, area.top, area.right - area.left, area.bottom - area.top);
    }
    if (!area) {
      blur.style.display = "none";
      return;
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    const left = Math.min(area.left, width);
    const right = Math.min(area.right, width);
    const top = Math.min(area.top, height);
    const bottom = Math.min(area.bottom, height);
    blur.style.display = "block";
    // Even-odd filling cuts a hole out of a single full-viewport blur.
    blur.style.clipPath = `polygon(evenodd,
      0px 0px, ${width}px 0px, ${width}px ${height}px, 0px ${height}px, 0px 0px,
      ${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px,
      ${left}px ${bottom}px, ${left}px ${top}px, 0px 0px)`;
  }

  function select() {
    closeSettings();
    cancelSelection?.();
    // Reattach if a website replaced the document's children.
    if (!host.isConnected) document.documentElement.append(host);
    const selector = document.createElement("div");
    selector.className = "selector";
    selector.innerHTML = '<div class="hint">Drag to focus · Esc to cancel</div><div class="rectangle" hidden></div>';
    const rectangle = selector.querySelector(".rectangle");
    shadow.append(selector);
    let start = null;
    let pointerId = null;

    function cleanup() {
      selector.remove();
      window.removeEventListener("keydown", onKey, true);
      if (cancelSelection === cleanup) cancelSelection = null;
    }

    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        cleanup();
      }
    }

    function bounds(event) {
      const x = Math.max(0, Math.min(event.clientX, window.innerWidth));
      const y = Math.max(0, Math.min(event.clientY, window.innerHeight));
      return {
        left: Math.min(start.x, x), right: Math.max(start.x, x),
        top: Math.min(start.y, y), bottom: Math.max(start.y, y),
      };
    }

    selector.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.button !== 0 || start) return;
      pointerId = event.pointerId;
      start = { x: event.clientX, y: event.clientY };
      selector.setPointerCapture(pointerId);
      position(rectangle, start.x, start.y, 0, 0);
      rectangle.hidden = false;
    });
    selector.addEventListener("pointermove", (event) => {
      event.stopPropagation();
      if (!start || event.pointerId !== pointerId) return;
      const box = bounds(event);
      position(rectangle, box.left, box.top, box.right - box.left, box.bottom - box.top);
    });
    selector.addEventListener("pointerup", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!start || event.pointerId !== pointerId) return;
      const box = bounds(event);
      if (box.right - box.left >= 4 && box.bottom - box.top >= 4) {
        area = box;
        render();
      }
      // Keep the selector through the resulting click, so it cannot activate a link.
      setTimeout(cleanup, 0);
    });
    selector.addEventListener("pointercancel", cleanup);
    for (const type of ["click", "dblclick", "contextmenu"]) {
      selector.addEventListener(type, (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    }
    window.addEventListener("keydown", onKey, true);
    cancelSelection = cleanup;
  }

  window.addEventListener("dblclick", (event) => {
    if (event.button !== 0 || !event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    select();
  }, true);

  window.addEventListener("resize", render);
  globalThis[key] = {
    select,
    setStrength(value) {
      strength = Math.max(0, Math.min(40, Number(value) || 0));
      if (settings) {
        settings.querySelector("input").value = strength;
        settings.querySelector("output").textContent = `${strength} px`;
      }
      const effect = `blur(${strength}px) saturate(35%) brightness(120%)`;
      blur.style.backdropFilter = effect;
      blur.style.webkitBackdropFilter = effect;
    },
    remove() {
      closeSettings();
      cancelSelection?.();
      area = null;
      render();
    },
  };
  // Automatic injection also needs the saved strength before the first selection.
  chrome.storage.local.get({ blurStrength: 8 }).then(({ blurStrength }) => {
    globalThis[key].setStrength(blurStrength);
  }).catch(console.warn);
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.blurStrength) {
      globalThis[key].setStrength(changes.blurStrength.newValue ?? 8);
    }
  });
  render();
})();
