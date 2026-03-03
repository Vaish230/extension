// ===============================
// SecureSurf Background Script
// Central controller for ML API calls and data management
// ===============================

// ===============================
// Configuration (Single Source of Truth)
// ===============================
const CONFIG = {
  API: {
    BASE_URL: "http://localhost:5000",
    TIMEOUT_MS: 5000,
    RETRY_ATTEMPTS: 2,
  },
  SCORING: {
    HEURISTIC_WEIGHT: 0.4,
    ML_WEIGHT: 0.6,
    THRESHOLDS: {
      SAFE: 30,
      SUSPICIOUS: 60,
      DANGEROUS: 100,
    },
  },
  CACHE: {
    DURATION_MS: 5 * 60 * 1000, // 5 minutes
    MAX_SIZE: 100,
  },
};

// Cache storage with size limit
class PredictionCache {
  constructor(maxSize = CONFIG.CACHE.MAX_SIZE) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (this.cache.has(key)) {
      const cached = this.cache.get(key);
      if (Date.now() - cached.timestamp < CONFIG.CACHE.DURATION_MS) {
        console.log("📦 Cache hit for:", key.substring(0, 50));
        return cached.data;
      } else {
        this.cache.delete(key);
      }
    }
    return null;
  }

  set(key, data) {
    // Enforce size limit
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      timestamp: Date.now(),
      data: data,
    });
  }

  clear() {
    this.cache.clear();
  }
}

const predictionCache = new PredictionCache();

// ===============================
// Extension Installation
// ===============================
chrome.runtime.onInstalled.addListener(() => {
  console.log("🛡️ SecureSurf Extension Installed");
  initializeStorage();
});

function initializeStorage() {
  chrome.storage.local.set({
    settings: {
      highlightEnabled: true,
      blockEnabled: true,
      shimmerEnabled: true,
    },
    stats: {
      totalScans: 0,
      phishingDetected: 0,
      lastScan: null,
    },
  });
}

// ===============================
// ML API Communication with Timeout & Retry
// ===============================

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = CONFIG.API.TIMEOUT_MS } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function callUrlMLApi(url, pageText, linksCount, retryCount = 0) {
  try {
    const response = await fetchWithTimeout(
      `${CONFIG.API.BASE_URL}/predict/url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url,
          page_text: pageText.substring(0, 1000),
          links_count: linksCount,
          return_features: true, // Always get features!
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("❌ ML API call failed:", error);

    // Retry logic
    if (retryCount < CONFIG.API.RETRY_ATTEMPTS) {
      console.log(`🔄 Retrying... Attempt ${retryCount + 1}`);
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * (retryCount + 1)),
      );
      return callUrlMLApi(url, pageText, linksCount, retryCount + 1);
    }

    return null;
  }
}

async function callEmailMLApi(subject, body, links, retryCount = 0) {
  try {
    const response = await fetchWithTimeout(
      `${CONFIG.API.BASE_URL}/predict/email`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject,
          body: body.substring(0, 2000),
          links: links,
          return_features: true, // Always get features!
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("❌ ML API call failed:", error);

    if (retryCount < CONFIG.API.RETRY_ATTEMPTS) {
      console.log(`🔄 Retrying... Attempt ${retryCount + 1}`);
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * (retryCount + 1)),
      );
      return callEmailMLApi(subject, body, links, retryCount + 1);
    }

    return null;
  }
}

// ===============================
// Unified Feature Extraction (Matches Python)
// ===============================

function extractUrlFeatures(url, pageText = "", linksCount = 0) {
  const features = {
    // URL-based features
    urlLength: url.length,
    hasIP: /(\d{1,3}\.){3}\d{1,3}/.test(url) ? 1 : 0,
    hasAtSymbol: url.includes("@") ? 1 : 0,
    hasSuspiciousKeyword: 0,
    subdomainCount: 0,
    isHTTPS: url.startsWith("https") ? 1 : 0,
    specialCharCount: (url.match(/[-_?=&]/g) || []).length,

    // Content-based features
    hasLoginVerify: /login|verify/i.test(url) ? 1 : 0,
    hasTooManyLinks: linksCount > 50 ? 1 : 0,
    hasUrgentWords: 0,

    // Page text features
    urgentWordCount: 0,
    suspiciousKeywordCount: 0,
  };

  // Count subdomains
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split(".");
    features.subdomainCount = Math.max(0, parts.length - 2);
  } catch (e) {
    features.subdomainCount = 0;
  }

  // Suspicious keywords in URL
  const suspiciousKeywords = [
    "login",
    "verify",
    "update",
    "bank",
    "secure",
    "account",
  ];
  features.hasSuspiciousKeyword = suspiciousKeywords.some((word) =>
    url.toLowerCase().includes(word),
  )
    ? 1
    : 0;

  // Urgent words in page text
  const urgentWords = [
    "urgent",
    "verify",
    "suspend",
    "limited time",
    "click now",
  ];
  if (pageText) {
    const textLower = pageText.toLowerCase();
    features.hasUrgentWords = urgentWords.some((word) =>
      textLower.includes(word),
    )
      ? 1
      : 0;
    features.urgentWordCount = urgentWords.filter((word) =>
      textLower.includes(word),
    ).length;

    // Count suspicious keywords in text
    features.suspiciousKeywordCount = suspiciousKeywords.filter((word) =>
      textLower.includes(word),
    ).length;
  }

  return features;
}

function extractEmailFeatures(subject, body, links = []) {
  const text = `${subject} ${body}`.toLowerCase();

  const features = {
    emailLength: text.length,
    linkCount: links.length,
    urgentWordCount: 0,
    suspiciousKeywordCount: 0,
    capitalRatio: 0,
    exclamationCount: (text.match(/!/g) || []).length,
    attachmentKeywordCount: 0,
  };

  // Count urgent words
  const urgentWords = [
    "urgent",
    "immediately",
    "asap",
    "action required",
    "verify",
    "now",
  ];
  features.urgentWordCount = urgentWords.filter((word) =>
    text.includes(word),
  ).length;

  // Count suspicious words
  const suspiciousWords = [
    "bank",
    "password",
    "account",
    "login",
    "update",
    "security",
  ];
  features.suspiciousKeywordCount = suspiciousWords.filter((word) =>
    text.includes(word),
  ).length;

  // Count attachment words
  const attachmentWords = ["invoice", "attachment", "pdf", "document", "file"];
  features.attachmentKeywordCount = attachmentWords.filter((word) =>
    text.includes(word),
  ).length;

  // Calculate capital ratio
  const letters = text.match(/[a-z]/gi) || [];
  const capitals = text.match(/[A-Z]/g) || [];
  features.capitalRatio =
    letters.length > 0 ? capitals.length / letters.length : 0;

  return features;
}

// ===============================
// Unified Heuristic Scoring (Uses Features)
// ===============================

function calculateHeuristicScoreFromFeatures(features, type = "url") {
  let score = 0;

  if (type === "url") {
    // URL-based heuristics
    if (features.hasIP) score += 25;
    if (features.hasAtSymbol) score += 20;
    if (features.hasSuspiciousKeyword) score += 15;
    if (features.subdomainCount > 2) score += 10 * features.subdomainCount;
    if (features.urlLength > 75) score += 10;
    if (!features.isHTTPS) score += 15;
    if (features.specialCharCount > 5) score += 5;
    if (features.hasLoginVerify) score += 15;
    if (features.hasTooManyLinks) score += 15;

    // Page text heuristics
    if (features.urgentWordCount > 0) score += 10 * features.urgentWordCount;
    if (features.suspiciousKeywordCount > 0)
      score += 5 * features.suspiciousKeywordCount;
  } else {
    // Email heuristics
    if (features.urgentWordCount > 2) score += 15;
    if (features.suspiciousKeywordCount > 3) score += 20;
    if (features.capitalRatio > 0.5) score += 15;
    if (features.exclamationCount > 3) score += 10;
    if (features.attachmentKeywordCount > 2) score += 15;
    if (features.linkCount > 10) score += 20;
    if (features.linkCount === 0) score -= 10; // No links is less suspicious
  }

  return Math.min(Math.max(score, 0), 100);
}

// ===============================
// Score Combination with Feature Storage
// ===============================

function combineScoresWithFeatures(
  heuristicScore,
  mlResult,
  features,
  type = "url",
) {
  const result = {
    final_score: heuristicScore,
    level: getRiskLevel(heuristicScore),
    source: "heuristic-only",
    features: features,
    heuristic_score: heuristicScore,
  };

  if (mlResult) {
    // Weighted combination
    const finalScore =
      heuristicScore * CONFIG.SCORING.HEURISTIC_WEIGHT +
      mlResult.risk_score * CONFIG.SCORING.ML_WEIGHT;

    // Use ML features if available (they might be more detailed)
    if (mlResult.features) {
      result.features = { ...features, ...mlResult.features };
    }

    result.final_score = Math.round(finalScore);
    result.level = getRiskLevel(finalScore);
    result.ml_score = mlResult.risk_score;
    result.ml_probability = mlResult.probability;
    result.source = "combined";
  }

  return result;
}

function getRiskLevel(score) {
  if (score <= CONFIG.SCORING.THRESHOLDS.SAFE) return "Safe";
  if (score <= CONFIG.SCORING.THRESHOLDS.SUSPICIOUS) return "Suspicious";
  return "Dangerous";
}

// ===============================
// Main Analysis Functions
// ===============================

async function analyzeUrl(url, pageText = "", linksCount = 0) {
  console.log("🔍 Analyzing URL:", url.substring(0, 50));

  // Extract features first (always!)
  const features = extractUrlFeatures(url, pageText, linksCount);

  // Create cache key including features hash for consistency
  const cacheKey = `url:${url}:${linksCount}:${features.urlLength}`;

  // Check cache
  const cached = predictionCache.get(cacheKey);
  if (cached) return cached;

  // Calculate heuristic score from features
  const heuristicScore = calculateHeuristicScoreFromFeatures(features, "url");

  // Get ML prediction
  const mlResult = await callUrlMLApi(url, pageText, linksCount);

  // Combine scores with features
  const result = combineScoresWithFeatures(
    heuristicScore,
    mlResult,
    features,
    "url",
  );

  // Add explanation
  result.explanation = generateExplanation(result);

  // Store in chrome.storage with FULL features
  await chrome.storage.local.set({
    riskData: {
      url: url,
      score: result.final_score,
      level: result.level,
      explanation: result.explanation,
      features: result.features, // CRITICAL: Store full features
      source: result.source,
      timestamp: Date.now(),
    },
  });

  // Update stats
  updateStats(result.level);

  // Cache the result
  predictionCache.set(cacheKey, result);

  console.log("📊 Analysis complete:", {
    score: result.final_score,
    level: result.level,
    features: Object.keys(result.features).filter(
      (k) => result.features[k] > 0,
    ),
  });

  return result;
}

async function analyzeEmail(subject, body, links = []) {
  console.log("🔍 Analyzing Email");

  // Extract email features
  const features = extractEmailFeatures(subject, body, links);

  const cacheKey = `email:${subject.substring(0, 30)}:${features.emailLength}:${features.linkCount}`;

  // Check cache
  const cached = predictionCache.get(cacheKey);
  if (cached) return cached;

  // Calculate heuristic score (fallback even if ML works)
  const heuristicScore = calculateHeuristicScoreFromFeatures(features, "email");

  // Get ML prediction
  const mlResult = await callEmailMLApi(subject, body, links);

  // Combine scores with features
  const result = combineScoresWithFeatures(
    heuristicScore,
    mlResult,
    features,
    "email",
  );

  // If ML failed, use heuristic-only
  if (!mlResult) {
    result.final_score = heuristicScore;
    result.level = getRiskLevel(heuristicScore);
    result.source = "heuristic-only";
  }

  result.explanation = generateExplanation(result);

  // Store in chrome.storage
  await chrome.storage.local.set({
    riskData: {
      url: "Email Analysis",
      score: result.final_score,
      level: result.level,
      explanation: result.explanation,
      features: result.features,
      source: result.source,
      timestamp: Date.now(),
    },
  });

  updateStats(result.level);
  predictionCache.set(cacheKey, result);

  return result;
}

function updateStats(level) {
  chrome.storage.local.get("stats", (data) => {
    const stats = data.stats || {
      totalScans: 0,
      phishingDetected: 0,
      lastScan: null,
    };
    stats.totalScans++;
    if (level === "Dangerous") stats.phishingDetected++;
    stats.lastScan = Date.now();
    chrome.storage.local.set({ stats });
  });
}

function generateExplanation(result) {
  const sourceMap = {
    combined: "🤖 AI + Heuristic",
    "heuristic-only": "📏 Rule-based",
    "ml-only": "🧠 AI Analysis",
  };

  const source = sourceMap[result.source] || sourceMap["heuristic-only"];

  if (result.level === "Safe") {
    return `✅ No major phishing indicators detected. (${source})`;
  } else if (result.level === "Suspicious") {
    return `⚠️ Some phishing indicators detected. Proceed with caution. (${source})`;
  } else {
    return `🔴 DANGEROUS: Multiple strong phishing indicators detected! (${source})`;
  }
}

// ===============================
// Message Handler
// ===============================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 Message received:", request.action);

  const handlers = {
    analyzeUrl: () =>
      analyzeUrl(request.url, request.pageText, request.linksCount),
    analyzeEmail: () =>
      analyzeEmail(request.subject, request.body, request.links),
    checkAPI: () => checkAPIStatus(),
    clearCache: () => {
      predictionCache.clear();
      return Promise.resolve({ success: true });
    },
    getStats: () => getStats(),
    getSettings: () => getSettings(),
    updateSettings: () => updateSettings(request.settings),
  };

  const handler = handlers[request.action];

  if (handler) {
    handler()
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => {
        console.error("Handler error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});

async function checkAPIStatus() {
  try {
    const response = await fetchWithTimeout(`${CONFIG.API.BASE_URL}/health`, {
      timeout: 3000,
    });
    const data = await response.json();
    return { status: "online", data };
  } catch (err) {
    return { status: "offline", error: err.message };
  }
}

async function getStats() {
  const data = await chrome.storage.local.get("stats");
  return data.stats || { totalScans: 0, phishingDetected: 0, lastScan: null };
}

async function getSettings() {
  const data = await chrome.storage.local.get("settings");
  return (
    data.settings || {
      highlightEnabled: true,
      blockEnabled: true,
      shimmerEnabled: true,
    }
  );
}

async function updateSettings(settings) {
  await chrome.storage.local.set({ settings });
  return { success: true };
}

// ===============================
// Tab Update Listener (Debounced)
// ===============================

let analysisTimeout = null;
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    !tab.url.startsWith("chrome://")
  ) {
    // Debounce analysis
    if (analysisTimeout) clearTimeout(analysisTimeout);
    analysisTimeout = setTimeout(() => {
      console.log("📍 New page loaded, sending analysis trigger:", tab.url);
      chrome.tabs.sendMessage(tabId, { action: "pageLoaded" }).catch(() => {
        // Content script might not be loaded yet, that's ok
      });
    }, 500);
  }
});
