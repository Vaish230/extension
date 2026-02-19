// ===============================
// Extract features from email text
// ===============================

export function extractEmailFeatures(emailText, links = []) {
  let features = {};

  const lowerText = emailText.toLowerCase();

  // 1️⃣ Email Length
  features.emailLength = emailText.length;

  // 2️⃣ Number of Links
  features.linkCount = links.length;

  // 3️⃣ Urgent Words Count
  const urgentWords = [
    "urgent",
    "immediately",
    "asap",
    "action required",
    "verify",
    "now",
  ];
  let urgentCount = 0;

  urgentWords.forEach((word) => {
    if (lowerText.includes(word)) {
      urgentCount++;
    }
  });

  features.urgentWordCount = urgentCount;

  // 4️⃣ Suspicious Keywords
  const suspiciousWords = [
    "bank",
    "password",
    "account",
    "login",
    "update",
    "security",
  ];
  let suspiciousCount = 0;

  suspiciousWords.forEach((word) => {
    if (lowerText.includes(word)) {
      suspiciousCount++;
    }
  });

  features.suspiciousKeywordCount = suspiciousCount;

  // 5️⃣ ALL CAPS Ratio
  const totalLetters = emailText.replace(/[^a-zA-Z]/g, "").length;
  const capitalLetters = emailText.replace(/[^A-Z]/g, "").length;

  features.capitalRatio = totalLetters > 0 ? capitalLetters / totalLetters : 0;

  // 6️⃣ Exclamation Marks
  const exclamations = emailText.match(/!/g);
  features.exclamationCount = exclamations ? exclamations.length : 0;

  // 7️⃣ Attachment Keywords
  const attachmentWords = ["invoice", "attachment", "pdf", "document", "file"];
  let attachmentCount = 0;

  attachmentWords.forEach((word) => {
    if (lowerText.includes(word)) {
      attachmentCount++;
    }
  });

  features.attachmentKeywordCount = attachmentCount;

  return features;
}
