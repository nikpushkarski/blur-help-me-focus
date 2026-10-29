const strength = document.querySelector("#strength");
const value = document.querySelector("#value");
const remove = document.querySelector("#remove");
const error = document.querySelector("#error");
let tabId;
// Serialize live updates so the final slider value always wins.
let updates = Promise.resolve();

function showError() {
  error.textContent = "Cannot access this page. Try a regular website and reopen this menu.";
  error.hidden = false;
}

async function command(action, amount) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (action, amount) => {
      const controller = globalThis.__blurHelpMeFocus;
      if (!controller) throw new Error("Page changed");
      controller[action](amount);
    },
    args: [action, amount ?? null],
  });
}

strength.addEventListener("input", () => {
  const amount = Number(strength.value);
  value.textContent = `${amount} px`;
  updates = updates.then(async () => {
    await chrome.storage.local.set({ blurStrength: amount });
    await command("setStrength", amount);
  }).catch(showError);
});

remove.addEventListener("click", async () => {
  try {
    await command("remove");
    window.close();
  } catch { showError(); }
});

(async () => {
  try {
    tabId = Number(new URLSearchParams(location.search).get("tabId"));
    if (!Number.isInteger(tabId) || tabId <= 0) throw new Error("Missing target tab");
    const saved = await chrome.storage.local.get({ blurStrength: 8 });
    strength.value = saved.blurStrength;
    value.textContent = `${strength.value} px`;
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await command("setStrength", Number(strength.value));
    for (const control of [strength, remove]) control.disabled = false;
  } catch { showError(); }
})();
