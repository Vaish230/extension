document.addEventListener("DOMContentLoaded", () => {
  const currentUrlText = document.getElementById("current-url");
  const riskLevelText = document.getElementById("risk-level");
  const scoreText = document.getElementById("score");
  const explanationText = document.getElementById("explanation");
  const detailsLink = document.getElementById("details-link");
  const mlBadge = document.getElementById("ml-badge");

  chrome.storage.local.get("riskData", ({ riskData }) => {
    if (!riskData) {
      currentUrlText.textContent = "No data available.";
      return;
    }

    // Populate popup fields
    currentUrlText.textContent = riskData.url;
    riskLevelText.textContent = `${riskData.level} (${riskData.score}%)`;
    scoreText.textContent = `Risk Score: ${riskData.score}%`;
    explanationText.textContent = riskData.explanation;

    // Set risk color
    riskLevelText.className = riskData.level.toLowerCase();

    // Add ML badge if available
    if (riskData.detailedReasons?.source) {
      const source = riskData.detailedReasons.source;
      const badge = document.createElement("span");
      badge.style.fontSize = "10px";
      badge.style.padding = "2px 6px";
      badge.style.borderRadius = "10px";
      badge.style.background = source === "combined" ? "#4CAF50" : "#999";
      badge.style.color = "white";
      badge.style.marginLeft = "8px";
      badge.textContent =
        source === "combined" ? "🤖 ML + Rules" : "⚙️ Rules Only";
      riskLevelText.appendChild(badge);
    }

    // Show detailed reasons on click
    detailsLink.href = "#";
    detailsLink.addEventListener("click", (e) => {
      e.preventDefault();

      const reasons = riskData.detailedReasons;
      let message = "🔍 DETAILED ANALYSIS:\n";
      message += "═".repeat(30) + "\n\n";

      // Show source info
      message += `📊 Analysis Type: ${reasons.source || "heuristic"}\n`;
      if (reasons.ml_score !== undefined) {
        message += `🤖 ML Score: ${reasons.ml_score}%\n`;
        message += `🎯 ML Confidence: ${Math.round(reasons.ml_probability * 100)}%\n`;
      }
      message += `📏 Heuristic Score: ${reasons.heuristic_score}%\n\n`;

      // Show features
      message += "📋 DETECTED FEATURES:\n";
      message += "─".repeat(25) + "\n";

      if (reasons.suspiciousWords) {
        message += `Suspicious Words: ${reasons.suspiciousWords.join(", ") || "None"}\n`;
      }
      if (reasons.longUrl !== undefined) {
        message += `Long URL: ${reasons.longUrl ? "Yes" : "No"}\n`;
      }
      if (reasons.externalLinks !== undefined) {
        message += `Too many links: ${reasons.externalLinks ? "Yes" : "No"}\n`;
      }
      if (reasons.urgentWordCount !== undefined) {
        message += `Urgent Words: ${reasons.urgentWordCount}\n`;
      }
      if (reasons.suspiciousKeywordCount !== undefined) {
        message += `Suspicious Keywords: ${reasons.suspiciousKeywordCount}\n`;
      }
      if (reasons.capitalRatio !== undefined) {
        message += `All Caps Ratio: ${(reasons.capitalRatio * 100).toFixed(1)}%\n`;
      }
      if (reasons.exclamationCount !== undefined) {
        message += `Exclamation Marks: ${reasons.exclamationCount}\n`;
      }
      if (reasons.attachmentKeywordCount !== undefined) {
        message += `Attachment Keywords: ${reasons.attachmentKeywordCount}\n`;
      }
      if (reasons.emailLength !== undefined) {
        message += `Email Length: ${reasons.emailLength}\n`;
      }

      alert(message);
    });
  });
});

// Optional: Check API status on popup open
chrome.runtime.sendMessage({ action: "checkAPI" }, (response) => {
  const statusEl = document.getElementById("api-status");
  if (statusEl) {
    if (response?.status === "ok") {
      statusEl.textContent = "🟢 ML API Connected";
      statusEl.style.color = "green";
    } else {
      statusEl.textContent = "🔴 ML API Offline (Using Rules Only)";
      statusEl.style.color = "red";
    }
  }
});
