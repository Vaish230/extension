// ===============================
// config/config.js
// Shared configuration for all components
// ===============================

export const CONFIG = {
  APP: {
    NAME: "SecureSurf",
    VERSION: "1.0.0",
  },

  API: {
    BASE_URL: "http://localhost:5000",
    TIMEOUT_MS: 5000,
    RETRY_ATTEMPTS: 2,
    ENDPOINTS: {
      HEALTH: "/health",
      PREDICT_URL: "/predict/url",
      PREDICT_EMAIL: "/predict/email",
      FEATURES_URL: "/features/url",
      FEATURES_EMAIL: "/features/email",
      INFO: "/info",
    },
  },

  SCORING: {
    WEIGHTS: {
      HEURISTIC: 0.4,
      ML: 0.6,
    },
    THRESHOLDS: {
      SAFE: 30,
      SUSPICIOUS: 60,
      DANGEROUS: 100,
    },
  },

  UI: {
    POPUP_WIDTH: 380,
    ANIMATION_DURATION: 300,
    MAX_HIGHLIGHTS: 50,
    MIN_WORD_LENGTH: 4,
  },

  CACHE: {
    DURATION_MS: 5 * 60 * 1000, // 5 minutes
    MAX_SIZE: 100,
  },

  ANALYSIS: {
    DELAY_MS: 1000,
    DEBOUNCE_MS: 500,
  },

  FEATURES: {
    URL: {
      SUSPICIOUS_KEYWORDS: [
        "login",
        "verify",
        "update",
        "bank",
        "secure",
        "account",
      ],
      URGENT_WORDS: [
        "urgent",
        "verify",
        "suspend",
        "limited time",
        "click now",
      ],
      MAX_SUBDOMAINS: 2,
      MAX_URL_LENGTH: 75,
      MAX_SPECIAL_CHARS: 5,
    },
    EMAIL: {
      URGENT_WORDS: [
        "urgent",
        "immediately",
        "asap",
        "action required",
        "verify",
        "now",
      ],
      SUSPICIOUS_WORDS: [
        "bank",
        "password",
        "account",
        "login",
        "update",
        "security",
      ],
      ATTACHMENT_WORDS: ["invoice", "attachment", "pdf", "document", "file"],
      MAX_LINKS: 10,
      MAX_EXCLAMATIONS: 3,
      MAX_CAPITAL_RATIO: 0.5,
    },
  },

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
    CONTENT: [
      "main",
      "article",
      "#content",
      ".content",
      ".post-content",
      ".entry-content",
    ],
    IGNORE: [
      "header",
      "footer",
      "nav",
      ".menu",
      ".sidebar",
      ".navigation",
      ".pagination",
      ".comments",
      ".widget",
    ],
  },
};
