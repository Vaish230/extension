// ===============================
// SecureSurf Background Script
// Central controller for ML API calls and data management
// ===============================

const ML_API_URL = "http://localhost:5000";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Cache storage
const predictionCache = new Map();

// ===============================
// Extension Installation
// ===============================
chrome.runtime.onInstalled.addListener(() => {
  console.log("🛡️ SecureSurf Extension Installed");
});

// ===============================
// ML API Communication
// ===============================

/**
 * Call URL prediction API
 */
async function callUrlMLApi(url, pageText, linksCount) {
  try {
    const response = await fetch(`${ML_API_URL}/predict/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url,
        page_text: pageText.substring(0, 1000),
        links_count: linksCount,
        return_features: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("❌ ML API call failed:", error);
    return null;
  }
}

/**
 * Call email prediction API
 */
async function callEmailMLApi(subject, body, links) {
  try {
    const response = await fetch(`${ML_API_URL}/predict/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: subject,
        body: body.substring(0, 2000),
        links: links,
        return_features: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("❌ ML API call failed:", error);
    return null;
  }
}

// ===============================
// Heuristic Scoring - UPDATED (Only check page text for emails)
// ===============================

function calculateHeuristicScore(url, pageText, linksCount) {
  let score = 0;

  // URL-based heuristics
  if (url.includes("@")) score += 20;
  if (url.includes("login") || url.includes("verify")) score += 15;
  if (url.length > 75) score += 10;

  // Check for IP address
  const ipPattern = /(\d{1,3}\.){3}\d{1,3}/;
  if (ipPattern.test(url)) score += 25;

  // Only check page text if it's actually provided (for emails)
  // For regular websites, pageText will be empty string
  if (pageText && pageText.length > 0) {
    const suspiciousWords = [
      "urgent",
      "verify",
      "suspend",
      "limited time",
      "click now",
    ];
    suspiciousWords.forEach((word) => {
      if (pageText.toLowerCase().includes(word)) score += 10;
    });
  }

  // Too many links
  if (linksCount > 50) score += 15;

  // Count subdomains
  try {
    const hostname = new URL(url).hostname;
    const subdomainCount = hostname.split(".").length - 2;
    if (subdomainCount > 2) score += 10;
  } catch (e) {}

  return Math.min(score, 100);
}

// ===============================
// Score Combination Logic
// ===============================

function combineScores(heuristicScore, mlResult) {
  if (!mlResult) {
    return {
      final_score: heuristicScore,
      level: getRiskLevel(heuristicScore),
      source: "heuristic-only",
    };
  }

  // Weighted combination (40% heuristic, 60% ML)
  const finalScore = heuristicScore * 0.4 + mlResult.risk_score * 0.6;

  // Use ML level if scores disagree significantly
  let finalLevel;
  const heuristicLevel = getRiskLevel(heuristicScore);

  if (Math.abs(heuristicScore - mlResult.risk_score) > 30) {
    finalLevel = mlResult.risk_level;
  } else {
    finalLevel = getRiskLevel(finalScore);
  }

  return {
    final_score: Math.round(finalScore),
    level: finalLevel,
    heuristic_score: heuristicScore,
    ml_score: mlResult.risk_score,
    ml_probability: mlResult.probability,
    source: "combined",
  };
}

function getRiskLevel(score) {
  if (score <= 30) return "Safe";
  if (score <= 60) return "Suspicious";
  return "Dangerous";
}

// ===============================
// Cache Management
// ===============================

function getCachedResult(key) {
  if (predictionCache.has(key)) {
    const cached = predictionCache.get(key);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log("📦 Using cached result for:", key.substring(0, 50));
      return cached.data;
    } else {
      predictionCache.delete(key);
    }
  }
  return null;
}

function cacheResult(key, data) {
  predictionCache.set(key, {
    timestamp: Date.now(),
    data: data,
  });
}

// ===============================
// Main Analysis Function
// ===============================

async function analyzeUrl(url, pageText = "", linksCount = 0) {
  console.log("🔍 Analyzing URL:", url.substring(0, 50));

  // Create cache key
  const cacheKey = `url:${url}`;

  // Check cache first
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  // Calculate heuristic score
  const heuristicScore = calculateHeuristicScore(url, pageText, linksCount);

  // Get ML prediction
  const mlResult = await callUrlMLApi(url, pageText, linksCount);

  // Combine scores
  const result = combineScores(heuristicScore, mlResult);

  // Cache the result
  cacheResult(cacheKey, result);

  console.log("📊 Analysis complete:", {
    heuristic: heuristicScore,
    ml: mlResult?.risk_score,
    final: result.final_score,
    level: result.level,
  });

  return result;
}

async function analyzeEmail(subject, body, links = []) {
  console.log("🔍 Analyzing Email");

  // Create cache key (simplified - just use subject + first 100 chars)
  const cacheKey = `email:${subject}:${body.substring(0, 100)}`;

  // Check cache
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  // For emails, we'll use ML only (or you can add email heuristics later)
  const mlResult = await callEmailMLApi(subject, body, links);

  const result = {
    final_score: mlResult?.risk_score || 0,
    level: mlResult?.risk_level || "Safe",
    ml_score: mlResult?.risk_score,
    ml_probability: mlResult?.probability,
    source: mlResult ? "ml-only" : "none",
  };

  cacheResult(cacheKey, result);
  return result;
}

// ===============================
// Message Handler
// ===============================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 Message received:", request.action);

  if (request.action === "analyzeUrl") {
    analyzeUrl(request.url, request.pageText, request.linksCount)
      .then((result) => {
        // Store in chrome.storage for popup to access
        chrome.storage.local.set({
          riskData: {
            url: request.url,
            score: result.final_score,
            level: result.level,
            explanation: getExplanation(result),
            detailedReasons: {
              heuristic_score: result.heuristic_score,
              ml_score: result.ml_score,
              ml_probability: result.ml_probability,
              source: result.source,
            },
          },
        });
        sendResponse({ success: true, data: result });
      })
      .catch((error) => {
        console.error("Analysis error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async response
  }

  if (request.action === "analyzeEmail") {
    analyzeEmail(request.subject, request.body, request.links)
      .then((result) => {
        // Store in chrome.storage for popup to access
        chrome.storage.local.set({
          riskData: {
            url: "Gmail - Email Analysis", // Static text instead of window
            score: result.final_score,
            level: result.level,
            explanation: getExplanation(result),
            detailedReasons: {
              ml_score: result.ml_score,
              ml_probability: result.ml_probability,
              source: result.source,
            },
          },
        });
        sendResponse({ success: true, data: result });
      })
      .catch((error) => {
        console.error("Analysis error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async response
  }

  if (request.action === "checkAPI") {
    fetch(`${ML_API_URL}/health`)
      .then((res) => res.json())
      .then((data) => sendResponse({ status: "ok", data }))
      .catch((err) => sendResponse({ status: "error", error: err.message }));
    return true;
  }

  if (request.action === "clearCache") {
    predictionCache.clear();
    sendResponse({ success: true });
  }
});

// ===============================
// Tab Update Listener
// ===============================

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    !tab.url.startsWith("chrome://")
  ) {
    console.log("📍 New page loaded:", tab.url);

    // We'll let the content script trigger the analysis
    // This avoids duplicate calls
  }
});

// ===============================
// Helper Functions
// ===============================

function getExplanation(result) {
  const sourceText =
    result.source === "combined"
      ? "AI + Heuristic"
      : result.source === "ml-only"
        ? "AI Analysis"
        : "Heuristic only";

  if (result.level === "Safe") {
    return `✅ No major phishing indicators detected. (${sourceText})`;
  } else if (result.level === "Suspicious") {
    return `⚠️ Some phishing indicators detected. Proceed with caution. (${sourceText})`;
  } else {
    return `🔴 DANGEROUS: Multiple strong phishing indicators detected! (${sourceText})`;
  }
}
