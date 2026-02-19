import { extractURLFeatures } from "../features/urlFeatures.js";
import { extractEmailFeatures } from "../features/emailFeatures.js";

document.addEventListener("DOMContentLoaded", function () {
  const scanBtn = document.getElementById("scan-btn");
  const currentUrlText = document.getElementById("current-url");
  const riskLevelText = document.getElementById("risk-level");
  const scoreText = document.getElementById("score");
  const explanationText = document.getElementById("explanation");

  let currentUrl = "";

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    currentUrl = tabs[0].url;
    currentUrlText.textContent = currentUrl;
  });

  scanBtn.addEventListener("click", function () {
    console.log("Scan button clicked");

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tabId = tabs[0].id;

      chrome.tabs.sendMessage(
        tabId,
        { action: "getPageData" },
        function (response) {
          if (!response) {
            explanationText.textContent = "Could not access page data.";
            return;
          }

          const pageText = response.text;
          const links = response.links;

          const urlFeatures = extractURLFeatures(currentUrl);
          const emailFeatures = extractEmailFeatures(pageText, links);

          console.log("URL Features:", urlFeatures);
          console.log("Email Features:", emailFeatures);

          explanationText.textContent = "Features extracted. Check console.";
        },
      );
    });
  });
});
