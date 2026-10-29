# Blur — Help Me Focus

A tiny local Chrome extension. No dependencies, build step, or data collection.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Pin **Blur — Help Me Focus** from Chrome's extensions menu.

## Use

- Press **Alt+Shift+B** (Windows) / **Option+Shift+B** (macOS), then drag a rectangle immediately. This browser-registered shortcut works in browser fullscreen without any prior icon click, including after page reloads. You can also left-click the extension icon.
- Both keyboard controls use the physical **B key position**, independent of the active language. The extension loads automatically on permitted webpages for this to work without prior activation. Chrome's separately registered toolbar shortcut can be customized at `chrome://extensions/shortcuts`; the physical page shortcuts remain fixed. OS-reserved shortcuts can still take precedence.
- Release the mouse: everything outside the rectangle is blurred, desaturated (35% saturation), and brightened (120% brightness) for a paler appearance. The selected area stays unchanged.
- Keep using the website normally—even blurred areas remain clickable and scrollable. The overlay does not take keyboard focus.
- Press **Shift+B** to open settings and edit the clear rectangle: drag inside it (outside the settings panel) to move it, or drag its eight handles to resize it. This mode stays active until **Esc**, **Close**, or a click on the blur. The shortcut ignores text fields; no prior icon click is needed. Without a selection, settings appear in the center of the screen.
- Right-click the extension icon → **Blur settings** to adjust **Blur strength** (0–40 px) in a small settings window; changes apply live to the original tab and the setting is remembered.
- Click the extension icon again to replace the selection. **Esc** on the page cancels selection and keeps the previous blur.
- Right-click the icon → **Remove blur**, or use **Remove blur** in the settings window. Reloading the page also clears it.

The rectangle stays in the same place on your screen while you scroll. Selections are not saved between page loads. A click or tiny drag leaves the existing selection unchanged.

## MVP limitations

Chrome blocks extensions on internal pages (such as `chrome://extensions`) and the Chrome Web Store. Browser controls are not affected. Fullscreen content and top-layer elements (such as native modal dialogs) may appear above the blur.

This adds a visual overlay to the document; it does not rewrite website content or disable its controls. During selection and Shift+B editing, the overlay captures pointer interactions. Afterward, all overlays ignore pointer events.
