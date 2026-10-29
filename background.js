chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "settings", title: "Blur settings", contexts: ["action"] });
    chrome.contextMenus.create({ id: "remove", title: "Remove blur", contexts: ["action"] });
  });
});

async function run(tabId, action) {
  if (!tabId) return;
  try {
    const { blurStrength } = await chrome.storage.local.get({ blurStrength: 8 });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (action, strength) => {
        const controller = globalThis.__blurHelpMeFocus;
        controller.setStrength(strength);
        controller[action]();
      },
      args: [action, blurStrength],
    });
  } catch (error) {
    console.warn("Cannot access this page:", error.message);
  }
}

chrome.action.onClicked.addListener((tab) => run(tab.id, "select"));

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === "remove") {
    run(tab.id, "remove");
  } else if (info.menuItemId === "settings") {
    chrome.windows.create({
      url: chrome.runtime.getURL(`popup.html?tabId=${tab.id}`),
      type: "popup",
      width: 310,
      height: 280,
    });
  }
});
