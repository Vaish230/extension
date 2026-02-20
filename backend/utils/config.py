"""
Configuration file for PhishGuard backend
"""

import os

class Config:
    """Base configuration"""
    
    # Base paths
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    MODEL_DIR = os.path.join(BASE_DIR, 'models')
    
    # Model paths
    URL_MODEL_PATH = os.path.join(MODEL_DIR, 'url_model.pkl')
    EMAIL_MODEL_PATH = os.path.join(MODEL_DIR, 'email_model.pkl')
    
    # Risk thresholds (matching your contentScript.js)
    RISK_THRESHOLDS = {
        'safe': 30,
        'suspicious': 60,
        'dangerous': 100
    }
    
    # API settings
    API_HOST = 'localhost'
    API_PORT = 5000
    DEBUG = True
    
    # Feature counts
    URL_FEATURE_COUNT = 10  # We have 10 URL features
    EMAIL_FEATURE_COUNT = 7  # We have 7 email features

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
    API_HOST = '0.0.0.0'
    API_PORT = 8080

def get_config():
    env = os.getenv('FLASK_ENV', 'development')
    if env == 'production':
        return ProductionConfig
    return DevelopmentConfig