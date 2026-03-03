"""
Configuration file for PhishGuard backend
Single source of truth for all settings
"""

import os
from pathlib import Path

class Config:
    """Base configuration - Single source of truth"""
    
    # ===============================
    # Base Paths
    # ===============================
    BASE_DIR = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    MODEL_DIR = BASE_DIR / 'models'
    DATASET_DIR = BASE_DIR / 'dataset'
    LOG_DIR = BASE_DIR / 'logs'
    
    # Create directories if they don't exist
    for dir_path in [MODEL_DIR, DATASET_DIR, LOG_DIR]:
        dir_path.mkdir(parents=True, exist_ok=True)
    
    # ===============================
    # API Settings
    # ===============================
    API_VERSION = '2.0.0'
    API_HOST = os.getenv('API_HOST', 'localhost')
    API_PORT = int(os.getenv('API_PORT', 5000))
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    # CORS settings
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',')
    CORS_METHODS = ['GET', 'POST', 'OPTIONS']
    
    # ===============================
    # Model Paths (with versioning)
    # ===============================
    URL_MODEL_PATH = MODEL_DIR / 'url_model.pkl'
    URL_MODEL_PATTERN = 'url_model_v{version}.pkl'
    URL_SCALER_PATH = MODEL_DIR / 'url_scaler.pkl'
    URL_METADATA_PATH = MODEL_DIR / 'url_model_metadata.json'
    
    EMAIL_MODEL_PATH = MODEL_DIR / 'email_model.pkl'
    EMAIL_MODEL_PATTERN = 'email_model_v{version}.pkl'
    EMAIL_SCALER_PATH = MODEL_DIR / 'email_scaler.pkl'
    EMAIL_METADATA_PATH = MODEL_DIR / 'email_model_metadata.json'
    
    # ===============================
    # Risk Thresholds (matching contentScript.js)
    # ===============================
    RISK_THRESHOLDS = {
        'safe': 30,
        'suspicious': 60,
        'dangerous': 100
    }
    
    # Scoring weights
    SCORING_WEIGHTS = {
        'url': {
            'heuristic': 0.3,
            'ml': 0.7
        },
        'email': {
            'heuristic': 0.2,
            'ml': 0.8
        }
    }
    
    # ===============================
    # Feature Configuration
    # ===============================
    
    # URL Features (matching urlFeatures.js)
    URL_FEATURES = {
        'count': 10,
        'names': [
            'url_length',
            'has_ip',
            'has_at_symbol',
            'subdomain_count',
            'is_https',
            'special_char_count',
            'has_suspicious_keyword',
            'has_login_verify',
            'has_too_many_links',
            'has_urgent_words'
        ],
        'suspicious_keywords': [
            'login', 'verify', 'update', 'bank', 'secure', 
            'account', 'signin', 'password', 'credential'
        ],
        'urgent_words': [
            'urgent', 'verify', 'suspend', 'limited', 'click', 
            'now', 'immediately', 'action required'
        ],
        'max_subdomains': 2,
        'max_url_length': 75,
        'max_special_chars': 5,
        'max_links': 50
    }
    
    # Email Features (matching email_features.py)
    EMAIL_FEATURES = {
        'count': 12,
        'names': [
            'email_length',
            'link_count',
            'urgent_word_count',
            'suspicious_keyword_count',
            'capital_ratio',
            'exclamation_count',
            'attachment_keyword_count',
            'has_reply_chain',
            'has_forward',
            'suspicious_link_count',
            'has_ip_link',
            'has_shortened_link'
        ],
        'urgent_words': [
            'urgent', 'immediately', 'asap', 'action required',
            'verify', 'now', 'click', 'limited', 'expires'
        ],
        'suspicious_words': [
            'bank', 'password', 'account', 'login', 'update',
            'security', 'verify', 'confirm', 'ssn', 'credit card',
            'paypal', 'apple', 'microsoft', 'amazon'
        ],
        'attachment_words': [
            'invoice', 'attachment', 'pdf', 'document', 'file',
            'download', 'receipt', 'statement', 'report', 'resume'
        ],
        'max_links': 10,
        'max_exclamations': 3,
        'max_capital_ratio': 0.5,
        'min_text_length': 20
    }
    
    # ===============================
    # Cache Settings
    # ===============================
    CACHE = {
        'enabled': True,
        'duration_seconds': 300,  # 5 minutes
        'max_size': 1000,
        'redis_url': os.getenv('REDIS_URL', None)
    }
    
    # ===============================
    # Rate Limiting
    # ===============================
    RATE_LIMIT = {
        'enabled': True,
        'requests_per_minute': 60,
        'burst_size': 10
    }
    
    # ===============================
    # Logging
    # ===============================
    LOGGING = {
        'level': 'INFO',
        'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        'file': LOG_DIR / 'api.log',
        'max_size_mb': 10,
        'backup_count': 5
    }
    
    # ===============================
    # Dataset Paths
    # ===============================
    DATASETS = {
        'url': DATASET_DIR / 'url_dataset.csv',
        'email': DATASET_DIR / 'email_dataset.csv',
        'phishtank': DATASET_DIR / 'phishtank_raw.csv',
        'spam_assassin': DATASET_DIR / 'spam_assassin.csv'
    }
    
    # ===============================
    # Performance Settings
    # ===============================
    PERFORMANCE = {
        'model_timeout_seconds': 5,
        'max_batch_size': 100,
        'enable_profiling': False,
        'async_predictions': True
    }
    
    # ===============================
    # Security
    # ===============================
    SECURITY = {
        'require_api_key': False,
        'api_key_header': 'X-API-Key',
        'api_keys': os.getenv('API_KEYS', '').split(','),
        'ssl_verify': True,
        'allowed_ips': os.getenv('ALLOWED_IPS', '').split(',')
    }


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    CACHE = {**Config.CACHE, 'enabled': False}
    RATE_LIMIT = {**Config.RATE_LIMIT, 'enabled': False}


class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    DEBUG = True
    CACHE = {**Config.CACHE, 'enabled': False}
    RATE_LIMIT = {**Config.RATE_LIMIT, 'enabled': False}
    MODEL_DIR = Config.BASE_DIR / 'test_models'


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    API_HOST = '0.0.0.0'
    API_PORT = 8080
    SECRET_KEY = os.getenv('SECRET_KEY', None)
    
    # Enable security in production
    SECURITY = {**Config.SECURITY, 'require_api_key': True}
    
    # Enable caching in production
    CACHE = {**Config.CACHE, 'enabled': True}
    
    # Enable rate limiting in production
    RATE_LIMIT = {**Config.RATE_LIMIT, 'enabled': True}
    
    # More conservative performance
    PERFORMANCE = {**Config.PERFORMANCE, 'async_predictions': False}


def get_config():
    """Get configuration based on environment"""
    env = os.getenv('FLASK_ENV', 'development').lower()
    
    config_map = {
        'development': DevelopmentConfig,
        'testing': TestingConfig,
        'production': ProductionConfig
    }
    
    config_class = config_map.get(env, DevelopmentConfig)
    
    # Log which config is being used
    print(f"📋 Loading {env.upper()} configuration")
    print(f"   Model directory: {config_class.MODEL_DIR}")
    print(f"   API Version: {config_class.API_VERSION}")
    print(f"   Host: {config_class.API_HOST}:{config_class.API_PORT}")
    
    return config_class


# Singleton instance
_config = None

def get_config_singleton():
    """Get singleton config instance"""
    global _config
    if _config is None:
        _config = get_config()
    return _config