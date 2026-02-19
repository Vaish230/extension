//this is background.js
// Runs when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log("PhishGuard Extension Installed");
});

// Listen for tab updates (when user switches or loads new page)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    console.log("Page loaded:", tab.url);

    // Future scope:
    // We can auto-scan the page here
    // and show badge warning if suspicious
  }
});
