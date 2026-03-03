// ===============================
// SecureSurf Content Script
// Runs on every page to analyze and apply visual warnings
// ===============================

// Import educational overlay module (single source of truth)
import { educationalOverlay } from "../modules/EducationalOverlay.js";

console.log("🛡️ SecureSurf Content Script Loaded");

// ===============================
// Configuration
// ===============================
const CONFIG = {
  ANALYSIS: {
    DELAY_MS: 1000,
    DEBOUNCE_MS: 500,
  },
  SCORING: {
    THRESHOLDS: {
      SHIMMER: 30, // Show shimmer border
      HIGHLIGHT: 50, // Start highlighting elements
      BLOCK: 90, // Block the page
    },
  },
  HIGHLIGHT: {
    MAX_ELEMENTS: 50, // Don't highlight more than this
    MIN_WORD_LENGTH: 4, // Only highlight words longer than this
    IGNORE_TAGS: ["SCRIPT", "STYLE", "META", "LINK", "NOSCRIPT"],
    IGNORE_CLASSES: ["menu", "nav", "header", "footer", "sidebar"],
  },
  EMAIL: {
    SELECTORS: {
      GMAIL: {
        CONTAINER: [
          '[role="main"] .ii',
          ".a3s",
          ".message-container",
          ".email-message",
        ],
        SUBJECT: ["h2[data-thread-id]", ".ha", ".hP", ".subject"],
        SENDER: [".gD", ".email"],
        BODY: [".a3s", ".ii", ".message-body"],
      },
      OUTLOOK: {
        CONTAINER: [".ReadingPaneContent", ".message-body"],
        SUBJECT: [".subject", ".headerSubject"],
        SENDER: [".from", ".sender"],
      },
    },
  },
};

// ===============================
// State Management
// ===============================
let currentRiskData = null;
let highlightsActive = false;
let blockerActive = false;
let shimmerActive = false;
let analysisInProgress = false;
let lastAnalysisTime = 0;
let originalDOM = new Map(); // Store original DOM nodes for cleanup

// ===============================
// Improved Email Detection
// ===============================

function detectEmailPlatform() {
  const hostname = window.location.hostname;

  if (hostname.includes("mail.google.com")) return "gmail";
  if (hostname.includes("outlook") || hostname.includes("live.com"))
    return "outlook";
  if (hostname.includes("mail.yahoo.com")) return "yahoo";
  if (hostname.includes("mail.aol.com")) return "aol";

  return null;
}

function extractGmailEmail() {
  // Try multiple selectors for robustness
  const containerSelectors = CONFIG.EMAIL.SELECTORS.GMAIL.CONTAINER;

  let container = null;
  for (const selector of containerSelectors) {
    container = document.querySelector(selector);
    if (container) break;
  }

  if (!container || container.dataset.securesurfChecked) return null;

  // Extract subject with fallbacks
  const subjectSelectors = CONFIG.EMAIL.SELECTORS.GMAIL.SUBJECT;

  let subject = "No Subject";
  for (const selector of subjectSelectors) {
    const el = document.querySelector(selector);
    if (el && el.innerText) {
      subject = el.innerText;
      break;
    }
  }

  // Extract body
  const body = container.innerText || "";

  // Extract links
  const links = Array.from(container.querySelectorAll("a[href]"))
    .map((a) => a.href)
    .filter((href) => href && !href.startsWith("#"));

  // Mark as checked
  container.dataset.securesurfChecked = "true";

  return {
    container,
    subject: subject.substring(0, 200),
    body: body.substring(0, 5000),
    links,
  };
}

function extractOutlookEmail() {
  const containerSelectors = CONFIG.EMAIL.SELECTORS.OUTLOOK.CONTAINER;

  let container = null;
  for (const selector of containerSelectors) {
    container = document.querySelector(selector);
    if (container) break;
  }

  if (!container || container.dataset.securesurfChecked) return null;

  const subjectSelectors = CONFIG.EMAIL.SELECTORS.OUTLOOK.SUBJECT;
  let subject = "No Subject";
  for (const selector of subjectSelectors) {
    const el = document.querySelector(selector);
    if (el && el.innerText) {
      subject = el.innerText;
      break;
    }
  }

  const body = container.innerText || "";

  const links = Array.from(container.querySelectorAll("a[href]"))
    .map((a) => a.href)
    .filter((href) => href && !href.startsWith("#"));

  container.dataset.securesurfChecked = "true";

  return {
    container,
    subject: subject.substring(0, 200),
    body: body.substring(0, 5000),
    links,
  };
}

function extractEmailData() {
  const platform = detectEmailPlatform();

  switch (platform) {
    case "gmail":
      return extractGmailEmail();
    case "outlook":
      return extractOutlookEmail();
    default:
      return null;
  }
}

// ===============================
// Page Data Extraction
// ===============================

function extractPageData() {
  // Check if this is an email platform
  const emailData = extractEmailData();
  if (emailData) {
    return {
      type: "email",
      ...emailData,
    };
  }

  // Regular webpage
  const url = window.location.href;

  // Get page text (excluding navigation, headers, footers)
  const pageText = extractMainContent();

  // Get links (but exclude navigation, social media links, etc.)
  const links = extractRelevantLinks();

  return {
    type: "url",
    url,
    pageText: pageText.substring(0, 5000),
    linksCount: links.length,
    links,
  };
}

function extractMainContent() {
  // Try to find main content area first
  const mainSelectors = [
    "main",
    "article",
    "#content",
    ".content",
    ".post-content",
    ".entry-content",
  ];

  for (const selector of mainSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.innerText || "";
    }
  }

  // Fallback to body but filter out common UI elements
  const bodyClone = document.body.cloneNode(true);

  // Remove common UI elements
  const uiSelectors = [
    "header",
    "footer",
    "nav",
    ".menu",
    ".sidebar",
    ".navigation",
    ".pagination",
    ".comments",
    ".widget",
  ];

  uiSelectors.forEach((selector) => {
    const elements = bodyClone.querySelectorAll(selector);
    elements.forEach((el) => el.remove());
  });

  return bodyClone.innerText || "";
}

function extractRelevantLinks() {
  const allLinks = Array.from(document.querySelectorAll("a[href]"));

  // Filter out common UI links
  return allLinks
    .filter((link) => {
      const href = link.href;
      const text = link.innerText.toLowerCase();
      const parentClasses = link.parentElement?.className.toLowerCase() || "";

      // Skip if it's likely UI
      if (
        parentClasses.includes("nav") ||
        parentClasses.includes("menu") ||
        parentClasses.includes("header") ||
        parentClasses.includes("footer")
      ) {
        return false;
      }

      // Skip common navigation text
      if (["home", "about", "contact", "privacy", "terms"].includes(text)) {
        return false;
      }

      return href && !href.startsWith("#");
    })
    .map((a) => a.href);
}

// ===============================
// Analysis Trigger (Debounced)
// ===============================

let analysisTimeout = null;
let lastAnalysisUrl = "";

async function analyzeCurrentPage() {
  // Debounce
  const now = Date.now();
  if (now - lastAnalysisTime < CONFIG.ANALYSIS.DEBOUNCE_MS) {
    if (analysisTimeout) clearTimeout(analysisTimeout);
    analysisTimeout = setTimeout(
      analyzeCurrentPage,
      CONFIG.ANALYSIS.DEBOUNCE_MS,
    );
    return;
  }

  // Prevent concurrent analysis
  if (analysisInProgress) return;

  analysisInProgress = true;
  lastAnalysisTime = now;

  try {
    const pageData = extractPageData();

    // Don't re-analyze same URL
    if (pageData.type === "url" && pageData.url === lastAnalysisUrl) {
      analysisInProgress = false;
      return;
    }

    if (pageData.type === "url") {
      lastAnalysisUrl = pageData.url;
    }

    console.log(`📊 Analyzing ${pageData.type}...`);

    const message =
      pageData.type === "email"
        ? {
            action: "analyzeEmail",
            subject: pageData.subject,
            body: pageData.body,
            links: pageData.links,
          }
        : {
            action: "analyzeUrl",
            url: pageData.url,
            pageText: pageData.pageText,
            linksCount: pageData.linksCount,
          };

    chrome.runtime.sendMessage(message, (response) => {
      if (response?.success) {
        console.log(`✅ ${pageData.type} analysis complete:`, response.data);
        currentRiskData = response.data;

        // Apply visual effects based on score
        applyVisualEffects(
          response.data,
          pageData.type === "email" ? pageData.container : null,
        );
      } else {
        console.error(`❌ Analysis failed:`, response?.error);
      }
      analysisInProgress = false;
    });
  } catch (error) {
    console.error("Analysis error:", error);
    analysisInProgress = false;
  }
}

// ===============================
// Visual Effects (Fixed)
// ===============================

function applyVisualEffects(riskData, targetContainer = null) {
  const score = riskData.final_score || riskData.score || 0;

  // Remove existing effects
  removeAllEffects();

  if (score < CONFIG.SCORING.THRESHOLDS.SHIMMER) {
    console.log("✅ Safe page - no effects");
    return;
  }

  // Always show shimmer for non-safe pages
  applyShimmerBorder(riskData.level);

  if (score >= CONFIG.SCORING.THRESHOLDS.HIGHLIGHT) {
    console.log("🔍 Highlighting suspicious elements");
    highlightSuspiciousElements(targetContainer, riskData.features);
    addDismissButton();
  }

  if (score >= CONFIG.SCORING.THRESHOLDS.BLOCK) {
    console.log("🚫 Blocking dangerous page");
    blockPage(riskData);
  }
}

function removeAllEffects() {
  // Remove shimmer border
  const existingBorder = document.getElementById("securesurf-border");
  if (existingBorder) existingBorder.remove();

  // Remove highlights and restore original DOM
  restoreOriginalDOM();

  // Remove dismiss button
  const dismissBtn = document.getElementById("securesurf-dismiss");
  if (dismissBtn) dismissBtn.remove();

  // Remove blocker
  const blocker = document.getElementById("securesurf-blocker");
  if (blocker) blocker.remove();

  // Remove animation styles
  const style = document.getElementById("securesurf-style");
  if (style) style.remove();

  highlightsActive = false;
  blockerActive = false;
  shimmerActive = false;
}

function applyShimmerBorder(level) {
  if (document.getElementById("securesurf-border") || shimmerActive) return;

  shimmerActive = true;

  const colors = {
    Suspicious: "#ffaa00",
    Dangerous: "#ff0000",
  };

  const borderColor = colors[level] || "#ff0000";

  const border = document.createElement("div");
  border.id = "securesurf-border";
  border.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    border: 4px solid ${borderColor};
    box-sizing: border-box;
    z-index: 999999;
    animation: securesurfShimmer 2s infinite;
  `;

  // Add animation style if not exists
  if (!document.getElementById("securesurf-style")) {
    const style = document.createElement("style");
    style.id = "securesurf-style";
    style.textContent = `
      @keyframes securesurfShimmer {
        0% { border-color: ${borderColor}; box-shadow: 0 0 5px ${borderColor}; }
        50% { border-color: ${borderColor === "#ff0000" ? "#ff6666" : "#ffcc66"}; box-shadow: 0 0 20px ${borderColor}; }
        100% { border-color: ${borderColor}; box-shadow: 0 0 5px ${borderColor}; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(border);
}

function highlightSuspiciousElements(targetContainer = null, features = null) {
  if (highlightsActive) return;

  const container = targetContainer || document.body;

  // Get suspicious terms from features or use defaults
  let suspiciousTerms = [];

  if (features) {
    if (features.urgentWordCount > 0) {
      suspiciousTerms.push("urgent", "immediately", "asap", "action required");
    }
    if (features.suspiciousKeywordCount > 0) {
      suspiciousTerms.push(
        "password",
        "account",
        "login",
        "verify",
        "bank",
        "security",
      );
    }
    if (features.hasLoginVerify === 1) {
      suspiciousTerms.push("login", "verify", "update");
    }
  }

  // If no specific features, use minimal default set
  if (suspiciousTerms.length === 0) {
    suspiciousTerms = ["verify", "login"]; // Only most critical terms
  }

  // Create a safe copy of the container
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      // Skip script and style tags
      if (CONFIG.HIGHLIGHT.IGNORE_TAGS.includes(node.parentElement?.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }

      // Skip if parent has ignored classes
      const parentClasses = node.parentElement?.className.toLowerCase() || "";
      if (
        CONFIG.HIGHLIGHT.IGNORE_CLASSES.some((cls) =>
          parentClasses.includes(cls),
        )
      ) {
        return NodeFilter.FILTER_REJECT;
      }

      // Skip short text nodes
      if (node.textContent.trim().length < CONFIG.HIGHLIGHT.MIN_WORD_LENGTH) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes = [];
  let count = 0;
  let node;

  // Limit number of highlights
  while ((node = walker.nextNode())) {
    if (count++ > CONFIG.HIGHLIGHT.MAX_ELEMENTS) break;
    textNodes.push(node);
  }

  let highlightedCount = 0;

  textNodes.forEach((node) => {
    const text = node.textContent;
    let modified = false;
    let newHtml = text;

    suspiciousTerms.forEach((term) => {
      if (term.length < CONFIG.HIGHLIGHT.MIN_WORD_LENGTH) return;

      const regex = new RegExp(`\\b${term}\\b`, "gi");
      if (regex.test(text)) {
        newHtml = newHtml.replace(
          regex,
          '<span class="securesurf-highlight">$&</span>',
        );
        modified = true;
        highlightedCount++;
      }
    });

    if (modified) {
      // Store original for cleanup
      if (!originalDOM.has(node)) {
        originalDOM.set(node, node.textContent);
      }

      const span = document.createElement("span");
      span.innerHTML = newHtml;
      node.parentNode.replaceChild(span, node);
    }
  });

  // Add highlight styles
  if (
    !document.getElementById("securesurf-highlight-style") &&
    highlightedCount > 0
  ) {
    const style = document.createElement("style");
    style.id = "securesurf-highlight-style";
    style.textContent = `
      .securesurf-highlight {
        background-color: rgba(255, 0, 0, 0.3);
        color: inherit !important;
        font-weight: bold;
        padding: 2px 0;
        border-radius: 3px;
        border-bottom: 2px solid #ff0000;
        cursor: help;
        transition: background-color 0.3s;
      }
      .securesurf-highlight:hover {
        background-color: rgba(255, 0, 0, 0.5);
      }
    `;
    document.head.appendChild(style);
  }

  highlightsActive = true;
  console.log(`✨ Highlighted ${highlightedCount} suspicious terms`);
}

function restoreOriginalDOM() {
  originalDOM.forEach((originalText, node) => {
    if (node.parentNode) {
      node.parentNode.replaceChild(document.createTextNode(originalText), node);
    }
  });
  originalDOM.clear();

  // Remove highlight styles
  const style = document.getElementById("securesurf-highlight-style");
  if (style) style.remove();
}

function addDismissButton() {
  if (document.getElementById("securesurf-dismiss")) return;

  const dismissBtn = document.createElement("button");
  dismissBtn.id = "securesurf-dismiss";
  dismissBtn.textContent = "✕ Hide Highlights";
  dismissBtn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border: 2px solid #ff0000;
    padding: 10px 20px;
    border-radius: 5px;
    font-weight: bold;
    cursor: pointer;
    z-index: 1000000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.5);
    transition: all 0.3s;
    backdrop-filter: blur(5px);
  `;

  dismissBtn.addEventListener("mouseenter", () => {
    dismissBtn.style.background = "#ff0000";
  });

  dismissBtn.addEventListener("mouseleave", () => {
    dismissBtn.style.background = "rgba(0, 0, 0, 0.8)";
  });

  dismissBtn.addEventListener("click", () => {
    restoreOriginalDOM();
    dismissBtn.remove();
    highlightsActive = false;
  });

  document.body.appendChild(dismissBtn);
}

function blockPage(riskData) {
  if (blockerActive) return;

  const blocker = document.createElement("div");
  blocker.id = "securesurf-blocker";
  blocker.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.98);
    z-index: 1000001;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    backdrop-filter: blur(10px);
  `;

  const score = riskData?.final_score || riskData?.score || 95;
  const features = riskData?.features || {};

  blocker.innerHTML = `
    <div style="text-align: center; max-width: 500px; padding: 40px; background: linear-gradient(135deg, #1a0000 0%, #300000 100%); border-radius: 16px; border: 3px solid #ff0000; box-shadow: 0 0 50px rgba(255,0,0,0.3);">
      <div style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
      <h1 style="color: #ff0000; font-size: 36px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px;">DANGER</h1>
      <h2 style="margin-bottom: 20px; color: #ff6666;">Extreme Phishing Risk Detected</h2>
      <p style="margin-bottom: 30px; line-height: 1.6; color: #ccc;">
        SecureSurf has blocked this page (Risk Score: ${Math.round(score)}/100). 
        This site shows multiple strong indicators of being a phishing attempt.
      </p>
      
      <div style="margin-bottom: 30px; padding: 20px; background: rgba(255,0,0,0.1); border-radius: 8px; text-align: left;">
        <p style="color: #ff6666; margin-bottom: 10px; font-weight: bold;">⚠️ Detected Threats:</p>
        <ul style="list-style: none; padding: 0; color: #ccc;">
          ${generateThreatList(features)}
        </ul>
      </div>
      
      <div style="display: flex; gap: 15px; justify-content: center;">
        <button id="securesurf-acknowledge" style="
          background: #ff0000;
          color: white;
          border: none;
          padding: 14px 30px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
          flex: 1;
        ">I Understand, Proceed</button>
        <button id="securesurf-go-back" style="
          background: #333;
          color: white;
          border: none;
          padding: 14px 30px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s;
          flex: 1;
        ">Go Back</button>
      </div>
    </div>
  `;

  function generateThreatList(features) {
    const threats = [];
    if (features.hasIP) threats.push("IP-based URL (hides real domain)");
    if (features.subdomainCount > 2)
      threats.push(`Excessive subdomains (${features.subdomainCount})`);
    if (features.hasSuspiciousKeyword)
      threats.push("Contains phishing keywords");
    if (!features.isHTTPS) threats.push("No HTTPS encryption");
    if (features.urgentWordCount > 2) threats.push("Urgent language detected");
    if (features.suspiciousKeywordCount > 3)
      threats.push("Multiple suspicious keywords");
    if (features.linkCount > 10)
      threats.push(`Too many links (${features.linkCount})`);

    if (threats.length === 0) {
      threats.push("Multiple phishing indicators detected");
    }

    return threats
      .map((t) => `<li style="margin-bottom: 8px;">🔴 ${t}</li>`)
      .join("");
  }

  document.body.appendChild(blocker);
  blockerActive = true;

  document
    .getElementById("securesurf-acknowledge")
    .addEventListener("click", () => {
      blocker.remove();
      blockerActive = false;
    });

  document
    .getElementById("securesurf-go-back")
    .addEventListener("click", () => {
      window.history.back();
    });
}

// ===============================
// Message Listener
// ===============================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 Message received in content script:", request.action);

  switch (request.action) {
    case "pageLoaded":
      analyzeCurrentPage();
      sendResponse({ success: true });
      break;

    case "getRiskData":
      sendResponse({ riskData: currentRiskData });
      break;

    case "showEducational":
      if (currentRiskData) {
        // Use the imported educational overlay module
        educationalOverlay.show(currentRiskData, currentRiskData.features);
      } else {
        // If no data, create a default educational message
        educationalOverlay.show({ level: "Unknown" }, {});
      }
      sendResponse({ success: true });
      break;

    case "toggleHighlights":
      if (highlightsActive) {
        restoreOriginalDOM();
        const dismissBtn = document.getElementById("securesurf-dismiss");
        if (dismissBtn) dismissBtn.remove();
        highlightsActive = false;
        sendResponse({ success: true, highlightsActive: false });
      } else if (
        currentRiskData?.final_score >= CONFIG.SCORING.THRESHOLDS.HIGHLIGHT ||
        currentRiskData?.score >= CONFIG.SCORING.THRESHOLDS.HIGHLIGHT
      ) {
        highlightSuspiciousElements(null, currentRiskData.features);
        addDismissButton();
        sendResponse({ success: true, highlightsActive: true });
      } else {
        sendResponse({
          success: false,
          message: "No suspicious elements to highlight",
        });
      }
      break;

    case "reanalyze":
      // Clear cache for this page
      lastAnalysisUrl = "";
      originalDOM.clear();
      analyzeCurrentPage();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: "Unknown action" });
  }

  return true; // Keep message channel open for async response
});

// ===============================
// Initialize
// ===============================

function initialize() {
  console.log("🚀 Initializing SecureSurf...");

  // Run initial analysis after page load
  if (document.readyState === "complete") {
    setTimeout(analyzeCurrentPage, CONFIG.ANALYSIS.DELAY_MS);
  } else {
    window.addEventListener("load", () => {
      setTimeout(analyzeCurrentPage, CONFIG.ANALYSIS.DELAY_MS);
    });
  }

  // Watch for URL changes (SPA support)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log("📍 URL changed, re-analyzing...");

      // Clear checked flags for email containers
      document.querySelectorAll("[data-securesurf-checked]").forEach((el) => {
        delete el.dataset.securesurfChecked;
      });

      // Clear cache for this page
      originalDOM.clear();

      setTimeout(analyzeCurrentPage, CONFIG.ANALYSIS.DELAY_MS);
    }
  }).observe(document, { subtree: true, childList: true });
}

// Start
initialize();

console.log("✅ SecureSurf content script initialized");
