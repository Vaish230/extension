console.log("🔰 PhishGuard ML-Enhanced Content Script Loaded");

// Configuration
const ML_API_URL = "http://localhost:5000"; // Change this when deploying
const USE_ML = true; // Set to false if API is down
const HEURISTIC_WEIGHT = 0.4; // Your existing scoring weight
const ML_WEIGHT = 0.6; // ML model weight

// ===========================
// ML API Functions
// ===========================

async function callMLUrlAPI(url, pageText, linksCount) {
  try {
    const response = await fetch(`${ML_API_URL}/predict/url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url,
        page_text: pageText.substring(0, 1000), // Limit text size
        links_count: linksCount,
        return_features: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      ml_score: data.risk_score,
      ml_level: data.risk_level,
      probability: data.probability,
    };
  } catch (error) {
    console.error("❌ ML API call failed:", error);
    return null;
  }
}

async function callMLEmailAPI(subject, body, links) {
  try {
    const response = await fetch(`${ML_API_URL}/predict/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: subject,
        body: body.substring(0, 2000), // Limit body size
        links: links,
        return_features: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      ml_score: data.risk_score,
      ml_level: data.risk_level,
      probability: data.probability,
    };
  } catch (error) {
    console.error("❌ ML API call failed:", error);
    return null;
  }
}

// ===========================
// URL Risk Functions
// ===========================
function extractLinks(node) {
  return Array.from(node.querySelectorAll("a"))
    .map((a) => a.href)
    .filter((href) => href);
}

function extractText(node) {
  return node ? node.innerText : "";
}

function calculateURLHeuristicScore(url, text, links) {
  let score = 0;

  // From your existing rules
  if (url.includes("@")) score += 20;
  if (url.includes("login") || url.includes("verify")) score += 15;
  if (url.length > 75) score += 10;

  const suspiciousWords = [
    "urgent",
    "verify",
    "suspend",
    "limited time",
    "click now",
  ];
  suspiciousWords.forEach((word) => {
    if (text.toLowerCase().includes(word)) score += 10;
  });

  if (links.length > 50) score += 15;

  return Math.min(score, 100); // Cap at 100
}

function combineScores(heuristicScore, mlResult) {
  if (!mlResult || !USE_ML) {
    return {
      final_score: heuristicScore,
      level: getRiskLevel(heuristicScore),
      source: "heuristic-only",
    };
  }

  // Weighted combination
  const finalScore =
    heuristicScore * HEURISTIC_WEIGHT + mlResult.ml_score * ML_WEIGHT;

  // Use ML level if scores disagree significantly
  let finalLevel;
  const heuristicLevel = getRiskLevel(heuristicScore);

  if (Math.abs(heuristicScore - mlResult.ml_score) > 30) {
    // Major disagreement - trust ML more
    finalLevel = mlResult.ml_level;
  } else {
    // Close agreement - use combined score level
    finalLevel = getRiskLevel(finalScore);
  }

  return {
    final_score: Math.round(finalScore),
    level: finalLevel,
    heuristic_score: heuristicScore,
    ml_score: mlResult.ml_score,
    ml_probability: mlResult.probability,
    source: "combined",
  };
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

  const urgentWords = [
    "urgent",
    "immediately",
    "asap",
    "action required",
    "verify",
    "now",
  ];
  features.urgentWordCount = urgentWords.reduce(
    (count, word) => (lowerText.includes(word) ? count + 1 : count),
    0,
  );

  const suspiciousWords = [
    "bank",
    "password",
    "account",
    "login",
    "update",
    "security",
  ];
  features.suspiciousKeywordCount = suspiciousWords.reduce(
    (count, word) => (lowerText.includes(word) ? count + 1 : count),
    0,
  );

  const totalLetters = emailText.replace(/[^a-zA-Z]/g, "").length;
  const capitalLetters = emailText.replace(/[^A-Z]/g, "").length;
  features.capitalRatio = totalLetters > 0 ? capitalLetters / totalLetters : 0;

  const exclamations = emailText.match(/!/g);
  features.exclamationCount = exclamations ? exclamations.length : 0;

  const attachmentWords = ["invoice", "attachment", "pdf", "document", "file"];
  features.attachmentKeywordCount = attachmentWords.reduce(
    (count, word) => (lowerText.includes(word) ? count + 1 : count),
    0,
  );

  return features;
}

function calculateEmailHeuristicScore(features) {
  let score = 0;
  if (features.urgentWordCount > 0) score += features.urgentWordCount * 10;
  if (features.suspiciousKeywordCount > 0)
    score += features.suspiciousKeywordCount * 10;
  if (features.capitalRatio > 0.5) score += 15;
  if (features.exclamationCount > 3) score += 10;
  if (features.linkCount > 10) score += 10;
  if (features.attachmentKeywordCount > 0) score += 10;
  if (features.emailLength > 500) score += 10;
  return Math.min(score, 100);
}

async function runEmailScan(emailNode) {
  if (!emailNode) return;

  const emailText = emailNode.innerText || "";
  const links = extractLinks(emailNode);
  const features = extractEmailFeatures(emailText, links);

  // Calculate heuristic score
  const heuristicScore = calculateEmailHeuristicScore(features);

  // Get ML prediction
  let mlResult = null;
  if (USE_ML) {
    mlResult = await callMLEmailAPI(
      emailNode.querySelector("h2")?.innerText || "No Subject",
      emailText,
      links,
    );
  }

  // Combine scores
  const result = combineScores(heuristicScore, mlResult);

  console.log("📧 Email Analysis:", {
    heuristic: heuristicScore,
    ml: mlResult?.ml_score,
    final: result.final_score,
    level: result.level,
  });

  // Visual warning for dangerous emails
  if (result.level === "Dangerous") {
    applyRedBorder(emailNode);

    // Add warning banner
    if (!emailNode.querySelector(".ss-warning")) {
      const warning = document.createElement("div");
      warning.classList.add("ss-warning");
      warning.style.background = "#ffe5e5";
      warning.style.color = "#b30000";
      warning.style.padding = "8px";
      warning.style.marginBottom = "8px";
      warning.style.border = "1px solid #ff4d4d";
      warning.style.borderRadius = "4px";
      warning.style.fontWeight = "bold";
      warning.style.display = "flex";
      warning.style.justifyContent = "space-between";
      warning.style.alignItems = "center";

      warning.innerHTML = `
                <span>⚠️ This email appears to be suspicious! (Risk: ${result.final_score}%)</span>
                <small style="font-size: 11px; opacity: 0.8;">
                    ${mlResult ? "ML + Heuristic" : "Heuristic only"}
                </small>
            `;
      emailNode.prepend(warning);
    }
  }

  // Store results
  try {
    chrome.storage.local.set({
      riskData: {
        url: window.location.href,
        score: result.final_score,
        level: result.level,
        explanation: getExplanation(result.level, result.source),
        detailedReasons: {
          ...features,
          heuristic_score: heuristicScore,
          ml_score: mlResult?.ml_score,
          ml_probability: mlResult?.ml_probability,
          source: result.source,
        },
      },
    });
  } catch (err) {
    console.error("Storage set failed:", err);
  }
}

// ===========================
// URL Scan Functions
// ===========================
async function runURLScan(node) {
  const url = window.location.href;
  const text = extractText(node);
  const links = extractLinks(node);

  // Calculate heuristic score
  const heuristicScore = calculateURLHeuristicScore(url, text, links);

  // Get ML prediction
  let mlResult = null;
  if (USE_ML) {
    mlResult = await callMLUrlAPI(url, text, links.length);
  }

  // Combine scores
  const result = combineScores(heuristicScore, mlResult);

  console.log("🌐 URL Analysis:", {
    url: url.substring(0, 50) + "...",
    heuristic: heuristicScore,
    ml: mlResult?.ml_score,
    final: result.final_score,
    level: result.level,
  });

  // Visual warning for dangerous pages
  if (result.level === "Dangerous") {
    applyRedBorder(node);

    // Add warning banner at top of page
    if (!document.querySelector(".ss-page-warning")) {
      const warning = document.createElement("div");
      warning.classList.add("ss-page-warning");
      warning.style.position = "fixed";
      warning.style.top = "0";
      warning.style.left = "0";
      warning.style.right = "0";
      warning.style.background = "#ff4d4d";
      warning.style.color = "white";
      warning.style.padding = "12px";
      warning.style.textAlign = "center";
      warning.style.fontWeight = "bold";
      warning.style.zIndex = "10000";
      warning.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
      warning.style.display = "flex";
      warning.style.justifyContent = "center";
      warning.style.alignItems = "center";
      warning.style.gap = "10px";

      warning.innerHTML = `
                ⚠️ DANGEROUS WEBSITE DETECTED - Risk Score: ${result.final_score}%
                <button onclick="this.parentElement.remove()" 
                    style="background: white; color: #ff4d4d; border: none; 
                           padding: 4px 12px; border-radius: 4px; cursor: pointer;">
                    Dismiss
                </button>
            `;
      document.body.prepend(warning);
    }
  }

  // Store results
  try {
    chrome.storage.local.set({
      riskData: {
        url: url,
        score: result.final_score,
        level: result.level,
        explanation: getExplanation(result.level, result.source),
        detailedReasons: {
          urlLength: url.length,
          hasAtSymbol: url.includes("@"),
          hasLoginVerify: url.includes("login") || url.includes("verify"),
          linkCount: links.length,
          heuristic_score: heuristicScore,
          ml_score: mlResult?.ml_score,
          ml_probability: mlResult?.ml_probability,
          source: result.source,
        },
      },
    });
  } catch (err) {
    console.error("Storage set failed:", err);
  }
}

function getExplanation(level, source) {
  const sourceText =
    source === "combined"
      ? "AI + Heuristic analysis"
      : "Heuristic analysis only";

  if (level === "Safe") {
    return `✅ No major phishing indicators detected. (${sourceText})`;
  } else if (level === "Suspicious") {
    return `⚠️ Some phishing indicators detected. Proceed with caution. (${sourceText})`;
  } else {
    return `🔴 DANGEROUS: Multiple strong phishing indicators detected! (${sourceText})`;
  }
}

// ===========================
// Scan Functions
// ===========================
function scanEmails() {
  const emailNodes = document.querySelectorAll("div[role='main'] .ii");
  emailNodes.forEach((emailNode) => {
    if (!emailNode.dataset.ssfChecked) {
      runEmailScan(emailNode);
      emailNode.dataset.ssfChecked = "true";
    }
  });
  return emailNodes.length > 0;
}

// ===========================
// Initial Scan & Observers
// ===========================
async function initialScan() {
  // Check if API is reachable (optional)
  if (USE_ML) {
    try {
      const response = await fetch(`${ML_API_URL}/health`);
      if (response.ok) {
        console.log("✅ ML API is reachable");
      } else {
        console.warn("⚠️ ML API returned error, using heuristic only");
      }
    } catch (error) {
      console.warn("⚠️ ML API not reachable, using heuristic only");
    }
  }

  // Perform scan
  if (!scanEmails()) {
    await runURLScan(document.body);
  }
}

function initObserver() {
  const observer = new MutationObserver(() => {
    clearTimeout(window.scanTimeout);
    window.scanTimeout = setTimeout(() => {
      if (!scanEmails()) {
        runURLScan(document.body);
      }
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

// Add API health check on popup open (optional)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkAPI") {
    fetch(`${ML_API_URL}/health`)
      .then((res) => res.json())
      .then((data) => sendResponse({ status: "ok", data }))
      .catch((err) => sendResponse({ status: "error", error: err.message }));
    return true; // Required for async response
  }
});
