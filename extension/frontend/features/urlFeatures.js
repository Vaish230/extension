// ===============================
// features/urlFeatures.js
// URL Feature Extraction Module
// Matches Python backend exactly
// ===============================

// Import config (if using modules)
// For now, we'll define config here, but ideally import from config.js
const URL_CONFIG = {
  SUSPICIOUS_KEYWORDS: [
    "login",
    "verify",
    "update",
    "bank",
    "secure",
    "account",
    "signin",
    "password",
  ],
  URGENT_WORDS: [
    "urgent",
    "verify",
    "suspend",
    "limited",
    "click",
    "now",
    "immediately",
  ],
  MAX_SUBDOMAINS: 2,
  MAX_URL_LENGTH: 75,
  MAX_SPECIAL_CHARS: 5,
  IP_PATTERN: /(\d{1,3}\.){3}\d{1,3}/,
  SPECIAL_CHARS: /[-_?=&%+]/g,
};

/**
 * Extract all features from a URL and page context
 * Matches Python's URLFeatureExtractor.extract_features() exactly
 *
 * @param {string} url - The URL to analyze
 * @param {string} pageText - Optional page text content
 * @param {number} linksCount - Number of links on the page
 * @returns {Object} Features object
 */
export function extractURLFeatures(url, pageText = "", linksCount = 0) {
  // Ensure inputs are strings
  url = String(url || "")
    .toLowerCase()
    .trim();
  pageText = String(pageText || "");

  // Add protocol if missing for parsing
  const urlWithProtocol = url.startsWith("http") ? url : "http://" + url;

  const features = {
    // URL-based features (matching Python)
    urlLength: getUrlLength(url),
    hasIP: hasIPAddress(url),
    hasAtSymbol: hasAtSymbol(url),
    subdomainCount: countSubdomains(urlWithProtocol),
    isHTTPS: isHTTPS(url),
    specialCharCount: countSpecialChars(url),
    hasSuspiciousKeyword: hasSuspiciousKeyword(url),

    // Content-based features (matching Python)
    hasLoginVerify: hasLoginVerify(url),
    hasTooManyLinks: linksCount > 50 ? 1 : 0,
    hasUrgentWords: hasUrgentWords(pageText),

    // Additional detailed features for better analysis
    urgentWordCount: countUrgentWords(pageText),
    suspiciousKeywordCount: countSuspiciousKeywords(url, pageText),
    domainAge: 0, // Placeholder - would need WHOIS API
    hasHyphen: url.includes("-") ? 1 : 0,
    digitCount: countDigits(url),
    pathLength: getPathLength(urlWithProtocol),
  };

  return features;
}

/**
 * Extract features as array for ML model input
 * Order must match Python's URLFeatureExtractor.extract_features_array()
 */
export function extractURLFeaturesArray(url, pageText = "", linksCount = 0) {
  const features = extractURLFeatures(url, pageText, linksCount);

  // Order must match Python exactly:
  // [url_length, has_ip, has_at_symbol, subdomain_count, is_https,
  //  special_char_count, has_suspicious_keyword, has_login_verify,
  //  has_too_many_links, has_urgent_words]

  return [
    features.urlLength,
    features.hasIP,
    features.hasAtSymbol,
    features.subdomainCount,
    features.isHTTPS,
    features.specialCharCount,
    features.hasSuspiciousKeyword,
    features.hasLoginVerify,
    features.hasTooManyLinks,
    features.hasUrgentWords,
  ];
}

// ===============================
// Individual Feature Extractors
// ===============================

function getUrlLength(url) {
  return url.length;
}

function hasIPAddress(url) {
  return URL_CONFIG.IP_PATTERN.test(url) ? 1 : 0;
}

function hasAtSymbol(url) {
  return url.includes("@") ? 1 : 0;
}

function countSubdomains(url) {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split(".");
    // subdomain count = total parts - 2 (domain + TLD)
    return Math.max(0, parts.length - 2);
  } catch (e) {
    return 0;
  }
}

function isHTTPS(url) {
  return url.startsWith("https") ? 1 : 0;
}

function countSpecialChars(url) {
  const matches = url.match(URL_CONFIG.SPECIAL_CHARS);
  return matches ? matches.length : 0;
}

function hasSuspiciousKeyword(url) {
  return URL_CONFIG.SUSPICIOUS_KEYWORDS.some((keyword) =>
    url.toLowerCase().includes(keyword),
  )
    ? 1
    : 0;
}

function hasLoginVerify(url) {
  const urlLower = url.toLowerCase();
  return urlLower.includes("login") || urlLower.includes("verify") ? 1 : 0;
}

function hasUrgentWords(text) {
  if (!text) return 0;
  const textLower = text.toLowerCase();
  return URL_CONFIG.URGENT_WORDS.some((word) => textLower.includes(word))
    ? 1
    : 0;
}

function countUrgentWords(text) {
  if (!text) return 0;
  const textLower = text.toLowerCase();
  return URL_CONFIG.URGENT_WORDS.filter((word) => textLower.includes(word))
    .length;
}

function countSuspiciousKeywords(url, pageText) {
  let count = 0;
  const textToCheck = (url + " " + pageText).toLowerCase();

  URL_CONFIG.SUSPICIOUS_KEYWORDS.forEach((keyword) => {
    const regex = new RegExp(keyword, "gi");
    const matches = textToCheck.match(regex);
    if (matches) count += matches.length;
  });

  return count;
}

function countDigits(url) {
  const digits = url.match(/\d/g);
  return digits ? digits.length : 0;
}

function getPathLength(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.length;
  } catch (e) {
    return 0;
  }
}

// ===============================
// Advanced Analysis Functions
// ===============================

/**
 * Check if URL is using URL shortener
 */
export function isShortenedURL(url) {
  const shorteners = [
    "bit.ly",
    "tinyurl",
    "goo.gl",
    "ow.ly",
    "is.gd",
    "buff.ly",
    "tiny.cc",
    "tr.im",
    "cli.gs",
    "v.gd",
    "short.link",
  ];

  try {
    const hostname = new URL(url).hostname;
    return shorteners.some((shortener) => hostname.includes(shortener)) ? 1 : 0;
  } catch {
    return 0;
  }
}

/**
 * Check for homograph attack (lookalike characters)
 */
export function hasHomographAttack(url) {
  const homographs = {
    0: "o",
    1: "l",
    2: "z",
    3: "e",
    4: "a",
    5: "s",
    6: "g",
    7: "t",
    8: "b",
    9: "q",
    rn: "m",
    cl: "d",
    vv: "w",
  };

  const urlLower = url.toLowerCase();

  // Check for common replacements in domain names
  try {
    const hostname = new URL(url).hostname;
    const domainParts = hostname.split(".");
    const mainDomain = domainParts[domainParts.length - 2] || "";

    // Check for digit substitutions in common brand names
    const brands = [
      "paypal",
      "apple",
      "amazon",
      "google",
      "microsoft",
      "facebook",
    ];

    for (const brand of brands) {
      let found = false;
      for (const [num, letter] of Object.entries(homographs)) {
        if (mainDomain.includes(num) && brand.includes(letter)) {
          const substituted = mainDomain.replace(new RegExp(num, "g"), letter);
          if (substituted === brand) return 1;
        }
      }
    }
  } catch {
    return 0;
  }

  return 0;
}

/**
 * Check for excessive URL encoding
 */
export function hasExcessiveEncoding(url) {
  const encodedChars = url.match(/%[0-9A-Fa-f]{2}/g);
  return encodedChars && encodedChars.length > 3 ? 1 : 0;
}

/**
 * Check for multiple redirects
 */
export function hasMultipleRedirects(url) {
  const redirectIndicators = ["//", "redirect", "url=", "link=", "out"];
  const urlLower = url.toLowerCase();

  let count = 0;
  redirectIndicators.forEach((indicator) => {
    if (urlLower.includes(indicator)) count++;
  });

  return count > 2 ? 1 : 0;
}

// ===============================
// Feature Names (for ML model)
// ===============================

export function getURLFeatureNames() {
  return [
    "url_length",
    "has_ip",
    "has_at_symbol",
    "subdomain_count",
    "is_https",
    "special_char_count",
    "has_suspicious_keyword",
    "has_login_verify",
    "has_too_many_links",
    "has_urgent_words",
  ];
}

// ===============================
// Feature Validation
// ===============================

export function validateURLFeatures(features) {
  const required = getURLFeatureNames();
  const missing = required.filter((name) => !(name in features));

  if (missing.length > 0) {
    console.warn("Missing features:", missing);
    return false;
  }

  return true;
}

// ===============================
// Feature Explanation Generator
// ===============================

export function explainURLFeatures(features) {
  const explanations = [];

  if (features.hasIP === 1) {
    explanations.push({
      feature: "has_ip",
      title: "IP-based URL",
      description: "URL uses IP address instead of domain name",
      severity: "high",
      recommendation: "Avoid entering personal information on IP-based sites",
    });
  }

  if (features.hasAtSymbol === 1) {
    explanations.push({
      feature: "has_at_symbol",
      title: "@ Symbol in URL",
      description: "URL contains @ symbol which can hide true destination",
      severity: "high",
      recommendation: "Check the actual domain after the @ symbol",
    });
  }

  if (features.subdomainCount > 2) {
    explanations.push({
      feature: "subdomain_count",
      title: "Excessive Subdomains",
      description: `${features.subdomainCount} subdomains detected`,
      severity: features.subdomainCount > 3 ? "high" : "medium",
      recommendation: "Legitimate sites rarely use more than 2 subdomains",
    });
  }

  if (features.urlLength > 75) {
    explanations.push({
      feature: "url_length",
      title: "Unusually Long URL",
      description: `URL length: ${features.urlLength} characters`,
      severity: "medium",
      recommendation: "Long URLs can hide malicious parameters",
    });
  }

  if (features.isHTTPS === 0) {
    explanations.push({
      feature: "is_https",
      title: "No HTTPS Encryption",
      description: "Website does not use secure connection",
      severity: "high",
      recommendation: "Never enter sensitive information on non-HTTPS sites",
    });
  }

  if (features.specialCharCount > 5) {
    explanations.push({
      feature: "special_char_count",
      title: "Multiple Special Characters",
      description: `${features.specialCharCount} special characters in URL`,
      severity: "low",
      recommendation: "Excessive special chars can indicate manipulation",
    });
  }

  if (features.hasSuspiciousKeyword === 1) {
    explanations.push({
      feature: "has_suspicious_keyword",
      title: "Suspicious Keywords",
      description: "URL contains common phishing keywords",
      severity: "medium",
      recommendation: 'Be cautious of URLs with "login", "verify", etc.',
    });
  }

  return explanations;
}

// ===============================
// Export all functions
// ===============================

export default {
  extractURLFeatures,
  extractURLFeaturesArray,
  getURLFeatureNames,
  validateURLFeatures,
  explainURLFeatures,
  isShortenedURL,
  hasHomographAttack,
  hasExcessiveEncoding,
  hasMultipleRedirects,
};
