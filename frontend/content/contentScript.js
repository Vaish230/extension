// ===============================
// SecureSurf Content Script
// Runs on every page to analyze and apply visual warnings
// ===============================

console.log("🛡️ SecureSurf Content Script Loaded");

// ===============================
// Educational Overlay Class (defined directly in this file)
// ===============================

class EducationalOverlay {
  constructor() {
    this.overlay = null;
    this.isVisible = false;
  }

  /**
   * Show the educational overlay with explanations
   */
  show(riskData, detectedFeatures) {
    if (this.isVisible) return;

    this.overlay = document.createElement("div");
    this.overlay.id = "securesurf-educational-overlay";
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 1000002;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: securesurfFadeIn 0.3s ease;
    `;

    // Add animation styles
    this.addAnimationStyles();

    // Create overlay content
    const content = this.createContent(riskData, detectedFeatures);
    this.overlay.appendChild(content);

    document.body.appendChild(this.overlay);
    this.isVisible = true;

    // Add click outside to close
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });
  }

  /**
   * Create the main overlay content
   */
  createContent(riskData, features) {
    const container = document.createElement("div");
    container.style.cssText = `
      width: 450px;
      max-width: 90%;
      background: linear-gradient(135deg, #1a1f2f 0%, #0a0f1e 100%);
      border: 2px solid #ff0000;
      border-radius: 16px;
      padding: 24px;
      color: white;
      box-shadow: 0 20px 60px rgba(255, 0, 0, 0.3);
      animation: securesurfSlideUp 0.4s ease;
    `;

    // Header
    const header = this.createHeader();
    container.appendChild(header);

    // Explanation cards for each detected issue
    const explanations = this.generateExplanations(features);
    explanations.forEach((exp) => {
      container.appendChild(this.createExplanationCard(exp));
    });

    // Footer with "Got it" button
    const footer = this.createFooter();
    container.appendChild(footer);

    return container;
  }

  /**
   * Create overlay header
   */
  createHeader() {
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;

    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 24px; filter: drop-shadow(0 0 8px #ff0000);">⚠️</span>
        <h2 style="color: #ff0000; font-size: 20px; margin: 0;">Why is this risky?</h2>
      </div>
      <span style="font-size: 24px;">🛡️</span>
    `;

    return header;
  }

  /**
   * Create explanation card for a single issue
   */
  createExplanationCard(explanation) {
    const card = document.createElement("div");
    card.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border-left: 4px solid #ff0000;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 15px;
      transition: transform 0.3s;
    `;

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <span style="color: #ff6666; font-size: 18px;">🚩</span>
        <h3 style="color: #ff6666; font-size: 16px; margin: 0; font-weight: 600;">
          ${explanation.title}
        </h3>
      </div>
      <p style="color: #cccccc; font-size: 14px; line-height: 1.6; margin: 0 0 0 28px;">
        ${explanation.description}
      </p>
    `;

    return card;
  }

  /**
   * Create footer with "Got it" button
   */
  createFooter() {
    const footer = document.createElement("div");
    footer.style.cssText = `
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    `;

    const button = document.createElement("button");
    button.textContent = "Got it, thanks!";
    button.style.cssText = `
      background: linear-gradient(135deg, #ff0000, #cc0000);
      color: white;
      border: none;
      padding: 12px 30px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      box-shadow: 0 4px 15px rgba(255, 0, 0, 0.3);
    `;

    button.addEventListener("mouseenter", () => {
      button.style.transform = "translateY(-2px)";
      button.style.boxShadow = "0 6px 20px rgba(255, 0, 0, 0.4)";
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "translateY(0)";
      button.style.boxShadow = "0 4px 15px rgba(255, 0, 0, 0.3)";
    });

    button.addEventListener("click", () => this.hide());

    footer.appendChild(button);
    return footer;
  }

  /**
   * Generate explanations based on detected features
   */
  generateExplanations(features) {
    const explanations = [];

    // URL-based explanations
    if (features?.hasIP === 1) {
      explanations.push({
        title: "IP-Based URLs",
        description:
          'This URL uses an IP address (like 192.168.1.1) instead of a domain name. Legitimate companies always use branded domains like "amazon.com" or "google.com". Phishers use IP addresses to hide their identity.',
      });
    }

    if (features?.hasSuspiciousKeyword === 1) {
      explanations.push({
        title: "Suspicious Keywords",
        description:
          'Words like "login", "verify", "update", and "bank" are commonly used in phishing links. Attackers use these words to create urgency and trick you into clicking without thinking.',
      });
    }

    if (features?.subdomainCount > 2) {
      explanations.push({
        title: "Excessive Subdomains",
        description: `This URL has ${features.subdomainCount} subdomains (like a.b.c.example.com). Legitimate sites rarely use more than 1-2 subdomains. Phishers use many subdomains to mimic trusted websites.`,
      });
    }

    if (features?.urlLength > 75) {
      explanations.push({
        title: "Unusually Long URL",
        description:
          "This URL is longer than normal (over 75 characters). Phishers often hide malicious parameters in long, complex URLs to avoid detection.",
      });
    }

    if (features?.hasAtSymbol === 1) {
      explanations.push({
        title: "@ Symbol in URL",
        description:
          "The @ symbol in a URL can be used to hide the actual destination. Everything before the @ is ignored, and you might be sent to a different site than expected.",
      });
    }

    // Email-based explanations
    if (features?.urgentWordCount > 0) {
      explanations.push({
        title: "Urgent Language Detected",
        description:
          'Words like "urgent", "immediately", and "action required" are psychological triggers. Phishers create false urgency to make you act without thinking carefully.',
      });
    }

    if (features?.suspiciousKeywordCount > 0) {
      explanations.push({
        title: "Phishing Keywords",
        description:
          'Terms like "password", "account", and "security" are used to make you concerned about your account security. Always verify through official channels.',
      });
    }

    if (features?.capitalRatio > 0.5) {
      explanations.push({
        title: "Excessive Capitalization",
        description:
          "More than 50% of the text is in CAPITALS. In professional communication, excessive caps are considered SHOUTING and are a common sign of phishing.",
      });
    }

    if (features?.exclamationCount > 3) {
      explanations.push({
        title: "Multiple Exclamation Marks",
        description: `${features.exclamationCount} exclamation marks found!!! This is a common tactic to create excitement or urgency in scam messages.`,
      });
    }

    if (features?.linkCount > 10) {
      explanations.push({
        title: "Too Many Links",
        description: `This content contains ${features.linkCount} links. Phishing emails often include multiple links to increase the chance you'll click one.`,
      });
    }

    // Default explanation if nothing specific
    if (explanations.length === 0) {
      explanations.push({
        title: "Risk Assessment Complete",
        description:
          "While no specific red flags were detected, always stay vigilant. Never enter personal information on unfamiliar websites, and always verify the URL before clicking.",
      });
    }

    return explanations;
  }

  /**
   * Add animation styles to document
   */
  addAnimationStyles() {
    const styleId = "securesurf-overlay-animations";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes securesurfFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes securesurfSlideUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Hide the overlay
   */
  hide() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.isVisible = false;
    }
  }
}

// ===============================
// Create instance
// ===============================
const educationalOverlay = new EducationalOverlay();

// ===============================
// Configuration
// ===============================
let currentRiskData = null;
let highlightsActive = false;
let blockerActive = false;

// ===============================
// Extract Data from Page
// ===============================

function extractPageData() {
  const url = window.location.href;
  const pageText = document.body.innerText || "";
  const links = document.querySelectorAll("a");
  const linksCount = links.length;

  // Extract all links for email detection (if on Gmail)
  const linkUrls = Array.from(links)
    .map((a) => a.href)
    .filter((href) => href);

  return {
    url,
    pageText: pageText.substring(0, 5000), // Limit size
    linksCount,
    links: linkUrls,
  };
}

function extractEmailData() {
  // Check if we're on Gmail
  const isGmail = window.location.hostname.includes("mail.google.com");

  if (!isGmail) return null;

  // Find email containers (Gmail specific selectors)
  const emailContainers = document.querySelectorAll('[role="main"] .ii, .a3s');
  const emails = [];

  emailContainers.forEach((container) => {
    if (container.dataset.securesurfChecked) return;

    const subject =
      document.querySelector("h2[data-thread-id], .ha")?.innerText ||
      "No Subject";
    const body = container.innerText || "";
    const links = Array.from(container.querySelectorAll("a")).map(
      (a) => a.href,
    );

    emails.push({
      container,
      subject,
      body,
      links,
    });

    container.dataset.securesurfChecked = "true";
  });

  return emails.length > 0 ? emails[0] : null; // For MVP, just analyze first email
}

// ===============================
// Send Data to Background for Analysis
// ===============================

async function analyzeCurrentPage() {
  const pageData = extractPageData();
  const emailData = extractEmailData();

  if (emailData) {
    // We're on Gmail with an email open
    console.log("📧 Analyzing email...");

    chrome.runtime.sendMessage(
      {
        action: "analyzeEmail",
        subject: emailData.subject,
        body: emailData.body,
        links: emailData.links,
      },
      (response) => {
        if (response?.success) {
          console.log("✅ Email analysis complete:", response.data);
          currentRiskData = response.data;
          applyVisualEffects(response.data, emailData.container);
        } else {
          console.error("❌ Email analysis failed:", response?.error);
        }
      },
    );
  } else {
    // Regular webpage
    console.log("🌐 Analyzing webpage...");

    chrome.runtime.sendMessage(
      {
        action: "analyzeUrl",
        url: pageData.url,
        pageText: pageData.pageText,
        linksCount: pageData.linksCount,
      },
      (response) => {
        if (response?.success) {
          console.log("✅ URL analysis complete:", response.data);
          currentRiskData = response.data;
          applyVisualEffects(response.data);
        } else {
          console.error("❌ URL analysis failed:", response?.error);
        }
      },
    );
  }
}

// ===============================
// Visual Effects Based on Risk Score
// ===============================

function applyVisualEffects(riskData, targetElement = null) {
  const score = riskData.final_score;

  // Remove any existing effects first
  removeAllEffects();

  if (score < 30) {
    // Safe - no effects
    console.log("✅ Safe page (score < 30)");
    return;
  }

  if (score >= 30 && score < 50) {
    // Not Safe - Shimmering red border
    console.log("⚠️ Not safe - applying shimmer border");
    applyShimmerBorder();
  }

  if (score >= 50 && score < 90) {
    // Dangerous - Highlight suspicious elements
    console.log("🔴 Dangerous - highlighting elements");
    applyShimmerBorder(); // Still show border
    highlightSuspiciousElements(targetElement);

    // Add dismiss button for highlights
    addDismissButton();
  }

  if (score >= 90) {
    // Extreme Danger - Block page
    console.log("💀 Extreme danger - blocking page");
    applyShimmerBorder();
    blockPage();
  }
}

function removeAllEffects() {
  // Remove shimmer border
  const existingBorder = document.getElementById("securesurf-border");
  if (existingBorder) existingBorder.remove();

  // Remove highlights
  document.querySelectorAll(".securesurf-highlight").forEach((el) => {
    el.classList.remove("securesurf-highlight");
  });

  // Remove dismiss button
  const dismissBtn = document.getElementById("securesurf-dismiss");
  if (dismissBtn) dismissBtn.remove();

  // Remove blocker
  const blocker = document.getElementById("securesurf-blocker");
  if (blocker) blocker.remove();

  highlightsActive = false;
  blockerActive = false;
}

function applyShimmerBorder() {
  // Check if border already exists
  if (document.getElementById("securesurf-border")) return;

  // Create border element
  const border = document.createElement("div");
  border.id = "securesurf-border";
  border.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    border: 4px solid #ff0000;
    box-sizing: border-box;
    z-index: 999999;
    animation: securesurfShimmer 1.5s infinite;
  `;

  // Add animation style
  const style = document.createElement("style");
  style.id = "securesurf-style";
  style.textContent = `
    @keyframes securesurfShimmer {
      0% { border-color: #ff0000; box-shadow: 0 0 5px #ff0000; }
      50% { border-color: #ff6666; box-shadow: 0 0 20px #ff0000; }
      100% { border-color: #ff0000; box-shadow: 0 0 5px #ff0000; }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(border);
}

function highlightSuspiciousElements(targetContainer = null) {
  if (highlightsActive) return;

  const container = targetContainer || document.body;
  const text = container.innerText || "";

  // Suspicious patterns to highlight
  const suspiciousPatterns = [
    "urgent",
    "verify",
    "login",
    "password",
    "bank",
    "account",
    "suspended",
    "limited",
    "click here",
    "update now",
    "secure",
  ];

  // This is simplified - in production, use TreeWalker for better performance
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      // Skip script and style tags
      if (
        node.parentElement.tagName === "SCRIPT" ||
        node.parentElement.tagName === "STYLE"
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach((node) => {
    const text = node.textContent;
    let newHtml = text;
    let highlighted = false;

    suspiciousPatterns.forEach((pattern) => {
      const regex = new RegExp(`(${pattern})`, "gi");
      if (regex.test(text)) {
        newHtml = newHtml.replace(
          regex,
          '<span class="securesurf-highlight">$1</span>',
        );
        highlighted = true;
      }
    });

    if (highlighted) {
      const span = document.createElement("span");
      span.innerHTML = newHtml;
      node.parentNode.replaceChild(span, node);
    }
  });

  // Add highlight styles
  const style = document.createElement("style");
  style.id = "securesurf-highlight-style";
  style.textContent = `
    .securesurf-highlight {
      background-color: #ff0000;
      color: #ffffff !important;
      font-weight: bold;
      padding: 2px 0;
      border-radius: 3px;
      animation: securesurfPulse 1s infinite;
    }
    @keyframes securesurfPulse {
      0% { background-color: #ff0000; }
      50% { background-color: #ff4444; }
      100% { background-color: #ff0000; }
    }
  `;

  document.head.appendChild(style);
  highlightsActive = true;
}

function addDismissButton() {
  if (document.getElementById("securesurf-dismiss")) return;

  const dismissBtn = document.createElement("button");
  dismissBtn.id = "securesurf-dismiss";
  dismissBtn.textContent = "✕ Dismiss Highlights";
  dismissBtn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #ff0000;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    font-weight: bold;
    cursor: pointer;
    z-index: 1000000;
    box-shadow: 0 2px 10px rgba(255,0,0,0.5);
    transition: all 0.3s;
  `;

  dismissBtn.addEventListener("mouseenter", () => {
    dismissBtn.style.background = "#cc0000";
  });

  dismissBtn.addEventListener("mouseleave", () => {
    dismissBtn.style.background = "#ff0000";
  });

  dismissBtn.addEventListener("click", () => {
    document.querySelectorAll(".securesurf-highlight").forEach((el) => {
      el.classList.remove("securesurf-highlight");
    });
    dismissBtn.remove();
    highlightsActive = false;
  });

  document.body.appendChild(dismissBtn);
}

function blockPage() {
  if (blockerActive) return;

  const blocker = document.createElement("div");
  blocker.id = "securesurf-blocker";
  blocker.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.95);
    z-index: 1000001;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: white;
    font-family: Arial, sans-serif;
  `;

  blocker.innerHTML = `
    <div style="text-align: center; max-width: 500px; padding: 30px; background: #1a1a1a; border-radius: 10px; border: 2px solid #ff0000;">
      <h1 style="color: #ff0000; font-size: 48px; margin-bottom: 20px;">⚠️ DANGER</h1>
      <h2 style="margin-bottom: 20px;">This page has been blocked</h2>
      <p style="margin-bottom: 30px; line-height: 1.6;">
        SecureSurf has detected extreme phishing indicators (Risk Score: ${currentRiskData?.final_score || "90+"}).
        This page appears to be designed to steal your personal information.
      </p>
      <button id="securesurf-acknowledge" style="
        background: #ff0000;
        color: white;
        border: none;
        padding: 12px 30px;
        border-radius: 5px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        margin-right: 10px;
      ">I Understand, Let Me Proceed</button>
      <button id="securesurf-go-back" style="
        background: #333;
        color: white;
        border: none;
        padding: 12px 30px;
        border-radius: 5px;
        font-size: 16px;
        cursor: pointer;
      ">Go Back</button>
    </div>
  `;

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
// Educational Overlay
// ===============================

function showEducationalOverlay(riskData) {
  // Check if overlay already exists
  if (document.getElementById("securesurf-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "securesurf-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 400px;
    background: #1a1a1a;
    border: 2px solid #ff0000;
    border-radius: 10px;
    padding: 20px;
    z-index: 1000002;
    color: white;
    font-family: Arial, sans-serif;
    box-shadow: 0 0 30px rgba(255,0,0,0.5);
  `;

  // This would be populated with actual detected issues
  overlay.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="color: #ff0000;">⚠️ Why is this risky?</h2>
      <span style="font-size: 24px;">🛡️</span>
    </div>
    
    <div style="margin-bottom: 15px; padding: 10px; background: #333; border-radius: 5px;">
      <div style="color: #ff6666; margin-bottom: 5px;">🚩 IP-Based URLs</div>
      <p style="font-size: 12px; color: #ccc;">This URL uses an IP address instead of a domain name. Legitimate companies use branded domains like amazon.com.</p>
    </div>
    
    <div style="margin-bottom: 15px; padding: 10px; background: #333; border-radius: 5px;">
      <div style="color: #ff6666; margin-bottom: 5px;">🚩 Suspicious Keyword "login"</div>
      <p style="font-size: 12px; color: #ccc;">The word "login" is commonly used in phishing links to trick users into entering their credentials.</p>
    </div>
    
    <div style="margin-bottom: 20px; padding: 10px; background: #333; border-radius: 5px;">
      <div style="color: #ff6666; margin-bottom: 5px;">🚩 Excessive Subdomains</div>
      <p style="font-size: 12px; color: #ccc;">Too many subdomains can indicate an attempt to mimic legitimate websites.</p>
    </div>
    
    <button id="securesurf-gotit" style="
      width: 100%;
      background: #ff0000;
      color: white;
      border: none;
      padding: 12px;
      border-radius: 5px;
      font-weight: bold;
      cursor: pointer;
    ">Got it, thanks!</button>
  `;

  document.body.appendChild(overlay);

  document.getElementById("securesurf-gotit").addEventListener("click", () => {
    overlay.remove();
  });
}

// ===============================
// Listen for Messages from Popup
// ===============================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getRiskData") {
    sendResponse({ riskData: currentRiskData });
  }

  if (request.action === "showEducational") {
    // Show educational overlay with current risk data
    if (currentRiskData) {
      educationalOverlay.show(currentRiskData, currentRiskData.detailedReasons);
    } else {
      // If no data, create a default educational message
      educationalOverlay.show({ level: "Unknown" }, {});
    }
    sendResponse({ success: true });
  }

  if (request.action === "toggleHighlights") {
    // Toggle highlights (if already active, remove them)
    if (highlightsActive) {
      removeAllEffects();
      if (currentRiskData?.final_score >= 50) {
        applyVisualEffects(currentRiskData); // Re-apply without highlights?
      }
    } else {
      highlightSuspiciousElements();
    }
    sendResponse({ success: true });
  }

  if (request.action === "reanalyze") {
    analyzeCurrentPage();
    sendResponse({ success: true });
  }
});

// ===============================
// Initialize on Page Load
// ===============================

// Run analysis when page loads
window.addEventListener("load", () => {
  console.log("📄 Page loaded, starting analysis...");
  setTimeout(analyzeCurrentPage, 1000); // Delay to ensure page is fully loaded
});

// Also run on URL changes (for SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log("📍 URL changed, re-analyzing...");
    setTimeout(analyzeCurrentPage, 1000);
  }
}).observe(document, { subtree: true, childList: true });

console.log("✅ SecureSurf content script initialized");
