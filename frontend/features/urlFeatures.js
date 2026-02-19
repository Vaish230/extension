// ===============================
// Extract features from URL
// ===============================

export function extractURLFeatures(url) {
  let features = {};

  // 1️⃣ URL Length
  features.urlLength = url.length;

  // 2️⃣ Check if URL contains IP address
  const ipPattern = /(\d{1,3}\.){3}\d{1,3}/;
  features.hasIP = ipPattern.test(url) ? 1 : 0;

  // 3️⃣ Check for @ symbol
  features.hasAtSymbol = url.includes("@") ? 1 : 0;

  // 4️⃣ Count subdomains
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split(".");
    features.subdomainCount = parts.length - 2; // exclude domain + TLD
  } catch {
    features.subdomainCount = 0;
  }

  // 5️⃣ HTTPS check
  features.isHTTPS = url.startsWith("https") ? 1 : 0;

  // 6️⃣ Count special characters
  const specialChars = url.match(/[-_?=&]/g);
  features.specialCharCount = specialChars ? specialChars.length : 0;

  // 7️⃣ Suspicious keywords
  const suspiciousWords = [
    "login",
    "verify",
    "update",
    "bank",
    "secure",
    "account",
  ];
  features.hasSuspiciousKeyword = suspiciousWords.some((word) =>
    url.toLowerCase().includes(word),
  )
    ? 1
    : 0;

  return features;
}
