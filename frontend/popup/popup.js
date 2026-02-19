document.addEventListener("DOMContentLoaded", () => {
  const currentUrlText = document.getElementById("current-url");
  const riskLevelText = document.getElementById("risk-level");
  const scoreText = document.getElementById("score");
  const explanationText = document.getElementById("explanation");
  const detailsLink = document.getElementById("details-link");

  chrome.storage.local.get("riskData", ({ riskData }) => {
    if (!riskData) {
      currentUrlText.textContent = "No data available.";
      return;
    }

    // Populate popup fields
    currentUrlText.textContent = riskData.url;
    riskLevelText.textContent = riskData.level;
    scoreText.textContent = `Risk Score: ${riskData.score}`;
    explanationText.textContent = riskData.explanation;

    // Set risk color
    riskLevelText.className = riskData.level.toLowerCase(); // safe / suspicious / dangerous

    // Show detailed reasons on click
    detailsLink.href = "#";
    detailsLink.addEventListener("click", (e) => {
      e.preventDefault();

      const reasons = riskData.detailedReasons;
      let message = "Detailed Analysis:\n";

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
