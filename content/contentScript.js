console.log("Content Script Loaded");

// ===========================
// URL Risk Functions
// ===========================
function extractLinks(node) {
  return Array.from(node.querySelectorAll("a"))
    .map(a => a.href)
    .filter(href => href);
}

function extractText(node) {
  return node ? node.innerText : "";
}

function calculateURLRiskScore(url, text, links) {
  let score = 0;
  if (url.includes("@")) score += 20;
  if (url.includes("login") || url.includes("verify")) score += 15;
  if (url.length > 75) score += 10;

  const suspiciousWords = ["urgent", "verify", "suspend", "limited time", "click now"];
  suspiciousWords.forEach(word => {
    if (text.toLowerCase().includes(word)) score += 10;
  });

  if (links.length > 50) score += 15;
  return score;
}

function getRiskLevel(score) {
  if (score <= 30) return "Safe";
  if (score <= 60) return "Suspicious";
  return "Dangerous";
}

function applyRedBorder(node) {
  node.style.border = "5px solid #ff4d4d";
  node.style.boxShadow = "0 0 15px 5px rgba(255, 0, 0, 0.5)";
  node.style.borderRadius = "8px";
  node.style.boxSizing = "border-box";
  node.style.animation = "pulseBorder 1.5s infinite";

  if (!document.getElementById("pulseBorderStyle")) {
    const style = document.createElement("style");
    style.id = "pulseBorderStyle";
    style.innerHTML = `
      @keyframes pulseBorder {
        0% { box-shadow: 0 0 10px 2px rgba(255,0,0,0.6); }
        50% { box-shadow: 0 0 15px 5px rgba(255,0,0,0.8); }
        100% { box-shadow: 0 0 10px 2px rgba(255,0,0,0.6); }
      }
    `;
    document.head.appendChild(style);
  }
}

// ===========================
// Email Risk Functions
// ===========================
function extractEmailFeatures(emailText, links = []) {
  const features = {};
  const lowerText = emailText.toLowerCase();

  features.emailLength = emailText.length;
  features.linkCount = links.length;

  const urgentWords = ["urgent", "immediately", "asap", "action required", "verify", "now"];
  features.urgentWordCount = urgentWords.reduce((count, word) => lowerText.includes(word) ? count + 1 : count, 0);

  const suspiciousWords = ["bank", "password", "account", "login", "update", "security"];
  features.suspiciousKeywordCount = suspiciousWords.reduce((count, word) => lowerText.includes(word) ? count + 1 : count, 0);

  const totalLetters = emailText.replace(/[^a-zA-Z]/g, "").length;
  const capitalLetters = emailText.replace(/[^A-Z]/g, "").length;
  features.capitalRatio = totalLetters > 0 ? capitalLetters / totalLetters : 0;

  const exclamations = emailText.match(/!/g);
  features.exclamationCount = exclamations ? exclamations.length : 0;

  const attachmentWords = ["invoice", "attachment", "pdf", "document", "file"];
  features.attachmentKeywordCount = attachmentWords.reduce((count, word) => lowerText.includes(word) ? count + 1 : count, 0);

  return features;
}

function calculateEmailRiskScore(features) {
  let score = 0;
  if (features.urgentWordCount > 0) score += features.urgentWordCount * 10;
  if (features.suspiciousKeywordCount > 0) score += features.suspiciousKeywordCount * 10;
  if (features.capitalRatio > 0.5) score += 15;
  if (features.exclamationCount > 3) score += 10;
  if (features.linkCount > 10) score += 10;
  if (features.attachmentKeywordCount > 0) score += 10;
  if (features.emailLength > 500) score += 10;
  return score;
}

function runEmailScan(emailNode) {
  if (!emailNode) return;

  const emailText = emailNode.innerText || "";
  const links = extractLinks(emailNode);
  const features = extractEmailFeatures(emailText, links);
  const score = calculateEmailRiskScore(features);
  const level = getRiskLevel(score);

  if (level === "Dangerous") {
    applyRedBorder(emailNode);

    // Gmail-style warning
    if (!emailNode.querySelector(".ss-warning")) {
      const warning = document.createElement("div");
      warning.classList.add("ss-warning"); // ✅ safer than className assignment
      warning.style.background = "#ffe5e5";
      warning.style.color = "#b30000";
      warning.style.padding = "8px";
      warning.style.marginBottom = "8px";
      warning.style.border = "1px solid #ff4d4d";
      warning.style.borderRadius = "4px";
      warning.style.fontWeight = "bold";
      warning.innerText = "⚠ This email may be suspicious!";
      emailNode.prepend(warning);
    }
  }

  try {
    chrome.storage.local.set(
      {
        riskData: {
          url: window.location.href,
          score,
          level,
          explanation:
            level === "Safe"
              ? "No major phishing indicators detected."
              : level === "Suspicious"
              ? "Some phishing indicators detected. Proceed with caution."
              : "Multiple phishing indicators detected. High risk content.",
          detailedReasons: features
        }
      },
      () => {
        if (chrome.runtime.lastError) console.error("Storage set error:", chrome.runtime.lastError);
      }
    );
  } catch (err) {
    console.error("Storage set failed:", err);
  }
}

// ===========================
// Scan Functions
// ===========================
function scanEmails() {
  const emailNodes = document.querySelectorAll("div[role='main'] .ii");
  emailNodes.forEach(emailNode => {
    if (!emailNode.dataset.ssfChecked) {
      runEmailScan(emailNode);
      emailNode.dataset.ssfChecked = "true";
    }
  });
  return emailNodes.length > 0;
}

function runURLScan(node) {
  const url = window.location.href;
  const text = extractText(node);
  const links = extractLinks(node);
  const score = calculateURLRiskScore(url, text, links);
  const level = getRiskLevel(score);

  if (level === "Dangerous") applyRedBorder(node);

  try {
    chrome.storage.local.set(
      {
        riskData: {
          url,
          score,
          level,
          explanation:
            level === "Safe"
              ? "No major phishing indicators detected."
              : level === "Suspicious"
              ? "Some phishing indicators detected. Proceed with caution."
              : "Multiple phishing indicators detected. High risk content.",
          detailedReasons: {
            suspiciousWords: ["urgent", "verify", "suspend", "limited time", "click now"].filter(word =>
              text.toLowerCase().includes(word)
            ),
            longUrl: url.length > 75,
            externalLinks: links.length > 50
          }
        }
      },
      () => {
        if (chrome.runtime.lastError) console.error("Storage set error:", chrome.runtime.lastError);
      }
    );
  } catch (err) {
    console.error("Storage set failed:", err);
  }
}

// ===========================
// Initial Scan & Observers
// ===========================
function initialScan() {
  if (!scanEmails()) runURLScan(document.body);
}

function initObserver() {
  const observer = new MutationObserver(() => {
    clearTimeout(window.scanTimeout);
    window.scanTimeout = setTimeout(() => {
      if (!scanEmails()) runURLScan(document.body);
    }, 500);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
}

// ===========================
// Start Everything
// ===========================
window.addEventListener("load", () => {
  initialScan();
  initObserver();
});
