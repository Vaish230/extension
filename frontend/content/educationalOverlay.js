// ===============================
// SecureSurf Educational Overlay
// Screen 2: Detailed explanations of detected risks
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

    // Add click outside to close (optional)
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

// Create a singleton instance
const educationalOverlay = new EducationalOverlay();

// Export for use in content script
if (typeof module !== "undefined" && module.exports) {
  module.exports = educationalOverlay;
}
