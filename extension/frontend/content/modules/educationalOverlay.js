// ===============================
// modules/EducationalOverlay.js
// SecureSurf Educational Overlay Module
// Single source of truth for educational overlays
// ===============================

export class EducationalOverlay {
  constructor() {
    this.overlay = null;
    this.isVisible = false;
  }

  /**
   * Show the educational overlay with explanations
   * @param {Object} riskData - The risk assessment data
   * @param {Object} features - Detected features (optional, will use riskData.features if not provided)
   */
  show(riskData, features = null) {
    if (this.isVisible) return;

    const displayFeatures = features || riskData.features || {};

    this.overlay = document.createElement("div");
    this.overlay.id = "securesurf-educational-overlay";
    this.overlay.style.cssText = this.getOverlayStyles();

    this.addAnimationStyles();

    const content = this.createContent(riskData, displayFeatures);
    this.overlay.appendChild(content);

    document.body.appendChild(this.overlay);
    this.isVisible = true;

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }

  getOverlayStyles() {
    return `
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
  }

  /**
   * Create the main overlay content
   */
  createContent(riskData, features) {
    const container = document.createElement("div");
    container.style.cssText = this.getContainerStyles(riskData.level);

    container.appendChild(this.createHeader(riskData.level));

    const explanations = this.generateExplanations(features);
    if (explanations.length > 0) {
      explanations.forEach((exp) =>
        container.appendChild(this.createExplanationCard(exp)),
      );
    } else {
      container.appendChild(this.createDefaultMessage(riskData.level));
    }

    container.appendChild(this.createFooter());

    return container;
  }

  getContainerStyles(level) {
    const borderColor = this.getBorderColor(level);
    return `
      width: 450px;
      max-width: 90%;
      background: linear-gradient(135deg, #1a1f2f 0%, #0a0f1e 100%);
      border: 2px solid ${borderColor};
      border-radius: 16px;
      padding: 24px;
      color: white;
      box-shadow: 0 20px 60px rgba(255, 0, 0, 0.3);
      animation: securesurfSlideUp 0.4s ease;
    `;
  }

  getBorderColor(level) {
    switch (level) {
      case "Safe":
        return "#00ff00";
      case "Suspicious":
        return "#ffaa00";
      default:
        return "#ff0000";
    }
  }

  /**
   * Create overlay header
   */
  createHeader(level) {
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;

    const { icon, color, title } = this.getHeaderContent(level);

    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 24px; filter: drop-shadow(0 0 8px ${color});">${icon}</span>
        <h2 style="color: ${color}; font-size: 20px; margin: 0;">${title}</h2>
      </div>
      <span style="font-size: 24px;">🛡️</span>
    `;

    return header;
  }

  getHeaderContent(level) {
    switch (level) {
      case "Safe":
        return {
          icon: "✅",
          color: "#00ff00",
          title: "This looks safe!",
        };
      case "Suspicious":
        return {
          icon: "⚠️",
          color: "#ffaa00",
          title: "Proceed with caution",
        };
      default:
        return {
          icon: "🔴",
          color: "#ff0000",
          title: "DANGER!",
        };
    }
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
      transition: transform 0.2s;
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

    // Add hover effect
    card.addEventListener("mouseenter", () => {
      card.style.transform = "translateX(5px)";
      card.style.background = "rgba(255, 255, 255, 0.08)";
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "translateX(0)";
      card.style.background = "rgba(255, 255, 255, 0.05)";
    });

    return card;
  }

  /**
   * Create default message when no specific issues detected
   */
  createDefaultMessage(level) {
    const div = document.createElement("div");
    const color = level === "Safe" ? "#00ff00" : "#ffaa00";

    div.style.cssText = `
      background: rgba(0, 255, 0, 0.1);
      border-left: 4px solid ${color};
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 15px;
    `;

    div.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <span style="color: ${color}; font-size: 18px;">${level === "Safe" ? "✅" : "ℹ️"}</span>
        <h3 style="color: ${color}; font-size: 16px; margin: 0;">
          ${level === "Safe" ? "No threats detected" : "Low risk indicators"}
        </h3>
      </div>
      <p style="color: #cccccc; font-size: 14px; line-height: 1.6; margin: 0 0 0 28px;">
        ${this.getDefaultMessage(level)}
      </p>
    `;

    return div;
  }

  getDefaultMessage(level) {
    if (level === "Safe") {
      return "While this page appears safe, always stay vigilant. Never enter personal information on unfamiliar websites, and always verify the URL before clicking.";
    }
    return "While no specific red flags were detected, always exercise caution with unfamiliar websites. Check for HTTPS, verify the domain, and think before clicking.";
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
    if (!features) return [];

    const explanations = [];

    // URL-based explanations
    if (features.hasIP === 1) {
      explanations.push({
        title: "IP-Based URLs",
        description:
          "This URL uses an IP address instead of a domain name. Legitimate companies always use branded domains like 'amazon.com' or 'google.com'. Phishers use IP addresses to hide their identity.",
      });
    }

    if (features.hasAtSymbol === 1) {
      explanations.push({
        title: "@ Symbol in URL",
        description:
          "The @ symbol in a URL can be used to hide the actual destination. Everything before the @ is ignored, and you might be sent to a different site than expected.",
      });
    }

    if (features.subdomainCount > 2) {
      explanations.push({
        title: "Excessive Subdomains",
        description: `This URL has ${features.subdomainCount} subdomains (like a.b.c.example.com). Legitimate sites rarely use more than 1-2 subdomains. Phishers use many subdomains to mimic trusted websites.`,
      });
    }

    if (features.urlLength > 75) {
      explanations.push({
        title: "Unusually Long URL",
        description:
          "This URL is longer than normal (over 75 characters). Phishers often hide malicious parameters in long, complex URLs to avoid detection.",
      });
    }

    if (features.hasSuspiciousKeyword === 1) {
      explanations.push({
        title: "Suspicious Keywords in URL",
        description:
          'Words like "login", "verify", "update", and "bank" in URLs are commonly used in phishing links. Attackers use these words to trick you into clicking without thinking.',
      });
    }

    if (!features.isHTTPS && window.location?.protocol !== "http:") {
      explanations.push({
        title: "No HTTPS Encryption",
        description:
          "This website doesn't use HTTPS encryption. Any information you enter (passwords, credit cards) could be intercepted by attackers. Always look for the padlock icon in your address bar.",
      });
    }

    if (features.specialCharCount > 5) {
      explanations.push({
        title: "Multiple Special Characters",
        description: `This URL contains ${features.specialCharCount} special characters. Legitimate URLs typically use fewer special characters. Excessive special characters can hide malicious intent.`,
      });
    }

    // Content-based explanations
    if (features.urgentWordCount > 2) {
      explanations.push({
        title: "Urgent Language Detected",
        description: `Found ${features.urgentWordCount} urgent words like "urgent", "immediately", or "action required". Phishers create false urgency to make you act without thinking carefully.`,
      });
    }

    if (features.suspiciousKeywordCount > 3) {
      explanations.push({
        title: "Suspicious Keywords in Content",
        description: `Found ${features.suspiciousKeywordCount} security-related terms like "password", "account", or "verify". Legitimate companies rarely ask for sensitive information this way.`,
      });
    }

    if (features.capitalRatio > 0.5) {
      explanations.push({
        title: "Excessive Capitalization",
        description:
          "More than 50% of the text is in CAPITALS. In professional communication, excessive caps are considered SHOUTING and are a common sign of phishing or scams.",
      });
    }

    if (features.exclamationCount > 3) {
      explanations.push({
        title: "Multiple Exclamation Marks",
        description: `${features.exclamationCount} exclamation marks found!!! This is a common tactic to create excitement or urgency in scam messages. Professional communication rarely uses multiple exclamation marks.`,
      });
    }

    if (features.linkCount > 10) {
      explanations.push({
        title: "Too Many Links",
        description: `This content contains ${features.linkCount} links. Phishing emails often include multiple links to increase the chance you'll click one. Hover over links before clicking to see the real destination.`,
      });
    }

    if (features.attachmentKeywordCount > 2) {
      explanations.push({
        title: "Attachment Keywords Detected",
        description: `Found ${features.attachmentKeywordCount} words related to attachments like "invoice" or "document". Be very careful with unexpected attachments - they can contain malware.`,
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

// Export singleton instance
export const educationalOverlay = new EducationalOverlay();
