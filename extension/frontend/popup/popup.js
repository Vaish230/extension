// ===============================
// SecureSurf Popup Script
// Screen 1: Risk Scorecard Dashboard with Feature Display
// ===============================

// Configuration
const CONFIG = {
  UI: {
    WIDTH: 380, // Standard popup width
    ANIMATION_DURATION: 300,
  },
  SCORING: {
    THRESHOLDS: {
      SAFE: 30,
      SUSPICIOUS: 60,
      DANGEROUS: 100,
    },
  },
  COLORS: {
    SAFE: "#00ff00",
    SUSPICIOUS: "#ffaa00",
    DANGEROUS: "#ff0000",
  },
};

// DOM Elements
const elements = {
  // Header
  closeBtn: document.getElementById("closePopup"),

  // URL Card
  currentUrl: document.getElementById("currentUrl"),
  ipAddress: document.getElementById("ipAddress"),
  urlCard: document.querySelector(".url-card"),

  // Risk Score
  riskScore: document.getElementById("riskScore"),
  progressBar: document.getElementById("progressBar"),
  statusBadge: document.getElementById("statusBadge"),
  statusText: document.getElementById("statusText"),

  // Flags Section
  flagsSection: document.getElementById("flagsSection"),
  flagsList: document.getElementById("flagsList"),

  // Action Buttons
  highlightBtn: document.getElementById("highlightBtn"),
  whyRiskyBtn: document.getElementById("whyRiskyBtn"),

  // API Status
  apiStatus: document.getElementById("apiStatus"),
  apiStatusText: document.getElementById("apiStatusText"),

  // Loading States
  loadingOverlay: null,

  // Stats (optional - can add later)
  statsSection: null,
};

// ===============================
// Initialize Popup
// ===============================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("📊 Popup opened");

  // Set body width
  document.body.style.width = `${CONFIG.UI.WIDTH}px`;

  // Show loading state
  showLoading();

  // Load all data
  await Promise.all([
    loadRiskData(),
    checkAPIStatus(),
    loadSettings(),
    loadStats(),
  ]);

  // Hide loading state
  hideLoading();

  // Initialize event listeners
  initializeEventListeners();

  // Listen for storage changes
  chrome.storage.onChanged.addListener(handleStorageChange);
});

// ===============================
// Loading States
// ===============================

function showLoading() {
  // Create loading overlay if it doesn't exist
  if (!elements.loadingOverlay) {
    const overlay = document.createElement("div");
    overlay.className = "loading-overlay";
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(10, 15, 30, 0.95);
      backdrop-filter: blur(5px);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      transition: opacity ${CONFIG.UI.ANIMATION_DURATION}ms ease;
    `;

    overlay.innerHTML = `
      <div class="loading-spinner" style="
        width: 40px;
        height: 40px;
        border: 4px solid rgba(255, 255, 255, 0.1);
        border-top-color: #ff0000;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 15px;
      "></div>
      <p style="color: #8f9bb3; font-size: 14px;">Loading security data...</p>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;

    document.querySelector(".container").appendChild(overlay);
    elements.loadingOverlay = overlay;
  }
}

function hideLoading() {
  if (elements.loadingOverlay) {
    elements.loadingOverlay.style.opacity = "0";
    setTimeout(() => {
      elements.loadingOverlay?.remove();
      elements.loadingOverlay = null;
    }, CONFIG.UI.ANIMATION_DURATION);
  }
}

// ===============================
// Load Risk Data
// ===============================

async function loadRiskData() {
  return new Promise((resolve) => {
    chrome.storage.local.get("riskData", ({ riskData }) => {
      if (riskData) {
        console.log("📊 Risk Data loaded:", riskData);
        updateUI(riskData);
      } else {
        showNoData();
      }
      resolve();
    });
  });
}

// ===============================
// Update UI with Risk Data
// ===============================

function updateUI(riskData) {
  // Update URL
  updateUrlDisplay(riskData.url);

  // Update Risk Score
  const score = riskData.score || 0;
  updateScoreDisplay(score, riskData.level);

  // Update Flags List with actual features
  if (riskData.features) {
    updateFlagsList(riskData.features, riskData.level);
  } else {
    // If no features, try to generate from score
    generateFlagsFromScore(score, riskData.level);
  }

  // Update timestamp
  updateTimestamp(riskData.timestamp);
}

function updateUrlDisplay(url) {
  if (!url || url === "Email Analysis") {
    elements.currentUrl.textContent = url || "No URL";
    elements.ipAddress.textContent = "";
    return;
  }

  // Truncate long URLs
  const maxLength = 50;
  elements.currentUrl.textContent =
    url.length > maxLength ? url.substring(0, maxLength) + "..." : url;

  // Extract and display IP if present
  const ipMatch = url.match(/(\d{1,3}\.){3}\d{1,3}/);
  elements.ipAddress.textContent = ipMatch ? `🌐 IP: ${ipMatch[0]}` : "";

  // Add tooltip with full URL
  elements.currentUrl.title = url;
}

function updateScoreDisplay(score, level) {
  // Update score text
  elements.riskScore.textContent = `${Math.round(score)}/100`;

  // Update progress bar
  elements.progressBar.style.width = `${score}%`;
  elements.progressBar.className = "progress-bar";

  // Set colors based on level
  const levelLower = (level || "").toLowerCase();
  if (score < CONFIG.SCORING.THRESHOLDS.SAFE || levelLower === "safe") {
    elements.progressBar.classList.add("safe");
    elements.statusBadge.className = "status-badge safe";
    elements.statusText.innerHTML =
      '✅ <span style="color: #00ff00;">Safe</span>';
  } else if (
    score < CONFIG.SCORING.THRESHOLDS.SUSPICIOUS ||
    levelLower === "suspicious"
  ) {
    elements.progressBar.classList.add("suspicious");
    elements.statusBadge.className = "status-badge suspicious";
    elements.statusText.innerHTML =
      '⚠️ <span style="color: #ffaa00;">Suspicious</span>';
  } else {
    elements.progressBar.classList.add("dangerous");
    elements.statusBadge.className = "status-badge dangerous";
    elements.statusText.innerHTML =
      '🔴 <span style="color: #ff4444;">Dangerous</span>';
  }
}

// ===============================
// Flags List with Real Features
// ===============================

function updateFlagsList(features, level) {
  if (!features) {
    elements.flagsSection.style.display = "none";
    return;
  }

  const flags = generateFlagsFromFeatures(features);

  if (flags.length === 0) {
    // Show "no issues" message for safe sites
    if (level === "Safe") {
      elements.flagsSection.style.display = "block";
      elements.flagsList.innerHTML = `
        <div class="flag-item" style="border-left-color: #00ff00; background: rgba(0, 255, 0, 0.1);">
          <span class="flag-icon">✅</span>
          <span class="flag-text">No security issues detected</span>
        </div>
      `;
    } else {
      elements.flagsSection.style.display = "none";
    }
    return;
  }

  elements.flagsSection.style.display = "block";
  elements.flagsList.innerHTML = flags
    .map(
      (flag) => `
      <div class="flag-item" data-tooltip="${flag.tooltip || ""}">
        <span class="flag-icon">${flag.icon || "🚩"}</span>
        <span class="flag-text">${flag.text}</span>
        ${flag.value ? `<span class="flag-value" style="margin-left: auto; font-size: 11px; color: #8f9bb3;">${flag.value}</span>` : ""}
      </div>
    `,
    )
    .join("");
}

function generateFlagsFromFeatures(features) {
  const flags = [];

  // URL-based flags
  if (features.hasIP === 1) {
    flags.push({
      icon: "🌐",
      text: "IP-based URL detected",
      tooltip: "Legitimate sites use domain names, not IP addresses",
      severity: "high",
    });
  }

  if (features.hasAtSymbol === 1) {
    flags.push({
      icon: "@",
      text: "URL contains @ symbol",
      tooltip: "Can hide the actual destination website",
      severity: "high",
    });
  }

  if (features.subdomainCount > 2) {
    flags.push({
      icon: "🔗",
      text: `Excessive subdomains (${features.subdomainCount})`,
      tooltip: "Too many subdomains can indicate deception",
      value: features.subdomainCount,
      severity: "medium",
    });
  }

  if (features.urlLength > 75) {
    flags.push({
      icon: "📏",
      text: "Unusually long URL",
      tooltip: "Long URLs can hide malicious parameters",
      value: `${features.urlLength} chars`,
      severity: "medium",
    });
  }

  if (features.hasSuspiciousKeyword === 1) {
    flags.push({
      icon: "🔑",
      text: "Contains suspicious keywords",
      tooltip: 'Words like "login" or "verify" are common in phishing',
      severity: "medium",
    });
  }

  if (features.specialCharCount > 5) {
    flags.push({
      icon: "🔣",
      text: `Multiple special characters (${features.specialCharCount})`,
      tooltip: "Excessive special characters can be suspicious",
      value: features.specialCharCount,
      severity: "low",
    });
  }

  if (features.isHTTPS === 0 && window.location?.protocol !== "http:") {
    flags.push({
      icon: "🔓",
      text: "No HTTPS encryption",
      tooltip: "Information sent to this site is not secure",
      severity: "high",
    });
  }

  // Content-based flags
  if (features.urgentWordCount > 2) {
    flags.push({
      icon: "⏰",
      text: `Urgent language detected (${features.urgentWordCount} words)`,
      tooltip: "Creates false urgency to make you act quickly",
      value: features.urgentWordCount,
      severity: "high",
    });
  }

  if (features.suspiciousKeywordCount > 3) {
    flags.push({
      icon: "⚠️",
      text: `Multiple suspicious keywords (${features.suspiciousKeywordCount})`,
      tooltip: "Security-related terms are common in phishing",
      value: features.suspiciousKeywordCount,
      severity: "high",
    });
  }

  if (features.capitalRatio > 0.5) {
    flags.push({
      icon: "📢",
      text: "Excessive capitalization",
      tooltip: "SHOUTING is common in scam messages",
      value: `${Math.round(features.capitalRatio * 100)}%`,
      severity: "medium",
    });
  }

  if (features.exclamationCount > 3) {
    flags.push({
      icon: "❗",
      text: `Multiple exclamation marks (${features.exclamationCount})`,
      tooltip: "Creates artificial excitement or urgency",
      value: features.exclamationCount,
      severity: "low",
    });
  }

  if (features.linkCount > 10) {
    flags.push({
      icon: "🔗",
      text: `Too many links (${features.linkCount})`,
      tooltip: "Multiple links increase chance of clicking a malicious one",
      value: features.linkCount,
      severity: "medium",
    });
  }

  if (features.attachmentKeywordCount > 2) {
    flags.push({
      icon: "📎",
      text: `Attachment keywords detected (${features.attachmentKeywordCount})`,
      tooltip: "Mentions of attachments can indicate malicious files",
      value: features.attachmentKeywordCount,
      severity: "medium",
    });
  }

  // Sort by severity (high first)
  const severityOrder = { high: 0, medium: 1, low: 2 };
  return flags.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );
}

function generateFlagsFromScore(score, level) {
  if (level === "Safe" || score < CONFIG.SCORING.THRESHOLDS.SAFE) {
    elements.flagsSection.style.display = "none";
    return;
  }

  // Generic flags based on score
  const flags = [];

  if (score >= CONFIG.SCORING.THRESHOLDS.DANGEROUS) {
    flags.push({
      icon: "🔴",
      text: "High risk score detected",
      tooltip: "This page shows multiple phishing indicators",
    });
  } else if (score >= CONFIG.SCORING.THRESHOLDS.SUSPICIOUS) {
    flags.push({
      icon: "🟡",
      text: "Medium risk score",
      tooltip: "Some phishing indicators present",
    });
  }

  elements.flagsSection.style.display = "block";
  elements.flagsList.innerHTML = flags
    .map(
      (flag) => `
      <div class="flag-item">
        <span class="flag-icon">${flag.icon}</span>
        <span class="flag-text">${flag.text}</span>
      </div>
    `,
    )
    .join("");
}

function updateTimestamp(timestamp) {
  if (!timestamp) return;

  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Add timestamp to UI if we have a place for it
  const existingTime = document.querySelector(".scan-time");
  if (existingTime) {
    existingTime.textContent = `Last scan: ${timeStr}`;
  }
}

// ===============================
// No Data State
// ===============================

function showNoData() {
  elements.currentUrl.textContent = "No active scan";
  elements.riskScore.textContent = "--/100";
  elements.progressBar.style.width = "0%";
  elements.statusBadge.className = "status-badge";
  elements.statusText.innerHTML = "⚡ <span>No Data</span>";
  elements.flagsSection.style.display = "none";
  elements.ipAddress.textContent = "";

  // Add refresh button
  addRefreshButton();
}

function addRefreshButton() {
  const actions = document.querySelector(".actions");
  const existingRefresh = document.getElementById("refreshScan");

  if (!existingRefresh) {
    const refreshBtn = document.createElement("button");
    refreshBtn.id = "refreshScan";
    refreshBtn.className = "btn btn-secondary";
    refreshBtn.innerHTML = "<span>🔄</span> Scan Current Page";
    refreshBtn.addEventListener("click", () => {
      refreshBtn.innerHTML = "<span>⏳</span> Scanning...";
      refreshBtn.disabled = true;
      triggerReanalysis();
    });
    actions.appendChild(refreshBtn);
  }
}

// ===============================
// API Status
// ===============================

async function checkAPIStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "checkAPI" }, (response) => {
      if (response?.status === "online") {
        elements.apiStatus.className = "api-status online";
        elements.apiStatusText.innerHTML = "🟢 <span>ML API Connected</span>";
        elements.apiStatus.style.borderLeftColor = "#00ff00";
      } else {
        elements.apiStatus.className = "api-status offline";
        elements.apiStatusText.innerHTML =
          "🔴 <span>ML API Offline (Using Rules Only)</span>";
        elements.apiStatus.style.borderLeftColor = "#ff0000";
      }
      resolve();
    });
  });
}

// ===============================
// Settings and Stats
// ===============================

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get("settings", ({ settings }) => {
      if (settings) {
        // Update any settings-dependent UI
        updateSettingsUI(settings);
      }
      resolve();
    });
  });
}

function updateSettingsUI(settings) {
  // Could add settings indicators in future
  console.log("Settings loaded:", settings);
}

async function loadStats() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getStats" }, (response) => {
      if (response?.success && response.data) {
        addStatsSection(response.data);
      }
      resolve();
    });
  });
}

function addStatsSection(stats) {
  // Remove existing stats if any
  const existingStats = document.querySelector(".stats-section");
  if (existingStats) existingStats.remove();

  // Create stats section
  const statsSection = document.createElement("div");
  statsSection.className = "stats-section";
  statsSection.style.cssText = `
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    padding: 12px;
    margin-top: 15px;
    font-size: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  `;

  statsSection.innerHTML = `
    <div style="display: flex; justify-content: space-between; color: #8f9bb3; margin-bottom: 5px;">
      <span>Total scans</span>
      <span style="color: white; font-weight: 600;">${stats.totalScans || 0}</span>
    </div>
    <div style="display: flex; justify-content: space-between; color: #8f9bb3;">
      <span>Phishing detected</span>
      <span style="color: #ff4444; font-weight: 600;">${stats.phishingDetected || 0}</span>
    </div>
  `;

  document.querySelector(".container").appendChild(statsSection);
  elements.statsSection = statsSection;
}

// ===============================
// Event Listeners
// ===============================

function initializeEventListeners() {
  // Close button
  elements.closeBtn.addEventListener("click", () => {
    window.close();
  });

  // Highlight button
  elements.highlightBtn.addEventListener("click", () => {
    toggleHighlights();
  });

  // Why Risky button
  elements.whyRiskyBtn.addEventListener("click", () => {
    showEducational();
  });

  // Add keyboard shortcuts
  document.addEventListener("keydown", handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(e) {
  // ESC to close
  if (e.key === "Escape") {
    window.close();
  }

  // 'H' for highlight
  if (e.key === "h" || e.key === "H") {
    toggleHighlights();
  }

  // 'W' for why risky
  if (e.key === "w" || e.key === "W") {
    showEducational();
  }

  // 'R' for refresh
  if (e.key === "r" || e.key === "R") {
    triggerReanalysis();
  }
}

function toggleHighlights() {
  // Visual feedback
  elements.highlightBtn.style.transform = "scale(0.95)";
  setTimeout(() => {
    elements.highlightBtn.style.transform = "";
  }, 200);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "toggleHighlights" },
      (response) => {
        if (chrome.runtime.lastError) {
          showNotification("⚠️ Please refresh the page", "error");
        } else {
          const wasActive = elements.highlightBtn.innerHTML.includes("Hide");
          elements.highlightBtn.innerHTML = wasActive
            ? "<span>🔍</span> Highlight Suspicious Elements"
            : "<span>👁️</span> Hide Highlights";

          showNotification(
            wasActive ? "Highlights hidden" : "Suspicious elements highlighted",
            "success",
          );
        }
      },
    );
  });
}

function showEducational() {
  elements.whyRiskyBtn.style.transform = "scale(0.95)";
  setTimeout(() => {
    elements.whyRiskyBtn.style.transform = "";
  }, 200);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "showEducational" },
      (response) => {
        if (chrome.runtime.lastError) {
          showNotification("⚠️ Please open a webpage first", "error");
        } else {
          // Popup will close, user will see overlay in page
          setTimeout(() => window.close(), 100);
        }
      },
    );
  });
}

function triggerReanalysis() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "reanalyze" }, (response) => {
      if (chrome.runtime.lastError) {
        showNotification("⚠️ Please refresh the page", "error");
      } else {
        showNotification("🔄 Re-analyzing page...", "info");
        setTimeout(() => window.close(), 500);
      }
    });
  });
}

// ===============================
// Notifications
// ===============================

function showNotification(message, type = "info") {
  // Remove existing notification
  const existingNote = document.querySelector(".notification");
  if (existingNote) existingNote.remove();

  // Create notification
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;

  const colors = {
    success: "#00ff00",
    error: "#ff4444",
    info: "#0088ff",
  };

  notification.style.cssText = `
    position: fixed;
    bottom: 70px;
    left: 20px;
    right: 20px;
    background: rgba(20, 25, 40, 0.95);
    border-left: 4px solid ${colors[type]};
    border-radius: 6px;
    padding: 12px;
    color: white;
    font-size: 13px;
    backdrop-filter: blur(5px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    z-index: 1001;
    animation: slideUp 0.3s ease;
  `;

  notification.textContent = message;
  document.querySelector(".container").appendChild(notification);

  // Add animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ===============================
// Storage Change Handler
// ===============================

function handleStorageChange(changes) {
  if (changes.riskData) {
    console.log("📊 Risk data updated:", changes.riskData.newValue);
    updateUI(changes.riskData.newValue);
  }

  if (changes.settings) {
    updateSettingsUI(changes.settings.newValue);
  }
}

// ===============================
// Error Handling
// ===============================

window.addEventListener("error", (e) => {
  console.error("Popup error:", e.error);
  showNotification("An error occurred", "error");
});
