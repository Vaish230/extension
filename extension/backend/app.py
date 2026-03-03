"""
PhishGuard Flask API
Main backend server for ML predictions with enhanced features and model versioning
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import logging
import os
import sys
from typing import Dict, Any, Optional
from datetime import datetime
import traceback

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import our modules
from utils.model_loader import ModelLoader, ModelManager
from utils.config import get_config
from feature_extraction.url_features import URLFeatureExtractor
from feature_extraction.email_features import EmailFeatureExtractor, create_email_extractor
from schemas.request_schemas import (
    URLPredictRequest, EmailPredictRequest,
    HealthResponse, ErrorResponse, ModelInfoResponse
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for extension

# Load config
config = get_config()

# Initialize model manager
model_manager = ModelManager()

# Initialize feature extractors
url_extractor = URLFeatureExtractor()
email_extractor = create_email_extractor()

# ===============================
# Model Loading with Version Support
# ===============================

def load_models():
    """Load both ML models at startup with version fallback"""
    global url_model, email_model
    
    logger.info("="*60)
    logger.info("🚀 PHISHGUARD API STARTING")
    logger.info("="*60)
    
    # Load URL model
    try:
        logger.info("\n📦 Loading URL model...")
        url_loader = ModelLoader('url', model_manager=model_manager)
        url_model = url_loader.load_model()
        logger.info("✅ URL model loaded successfully")
        
        # Log model info
        model_info = model_manager.get_model_info('url')
        if model_info:
            logger.info(f"   Version: {model_info.get('version', 'unknown')}")
            logger.info(f"   Features: {len(model_info.get('feature_names', []))}")
            logger.info(f"   Accuracy: {model_info.get('metrics', {}).get('accuracy', 'N/A'):.3f}")
            
    except Exception as e:
        logger.error(f"❌ Failed to load URL model: {e}")
        logger.warning("   Will use heuristic-only mode for URLs")
        url_model = None
    
    # Load Email model
    try:
        logger.info("\n📦 Loading Email model...")
        email_loader = ModelLoader('email', model_manager=model_manager)
        email_model = email_loader.load_model()
        logger.info("✅ Email model loaded successfully")
        
        # Log model info
        model_info = model_manager.get_model_info('email')
        if model_info:
            logger.info(f"   Version: {model_info.get('version', 'unknown')}")
            logger.info(f"   Features: {len(model_info.get('feature_names', []))}")
            logger.info(f"   Accuracy: {model_info.get('metrics', {}).get('accuracy', 'N/A'):.3f}")
            
    except Exception as e:
        logger.error(f"❌ Failed to load Email model: {e}")
        logger.warning("   Will use heuristic-only mode for emails")
        email_model = None
    
    logger.info("\n" + "="*60)
    logger.info(f"✅ API Ready - URL Model: {'✓' if url_model else '✗'}, Email Model: {'✓' if email_model else '✗'}")
    logger.info("="*60)

# ===============================
# Health Check Endpoint
# ===============================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint with detailed status"""
    start_time = time.time()
    
    response = {
        'status': 'healthy',
        'version': config.API_VERSION,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'models_loaded': {
            'url': url_model is not None,
            'email': email_model is not None
        },
        'model_info': {
            'url': model_manager.get_model_info('url'),
            'email': model_manager.get_model_info('email')
        },
        'features': {
            'url': {
                'count': len(url_extractor.get_feature_names()),
                'names': url_extractor.get_feature_names()
            },
            'email': {
                'count': len(email_extractor.get_feature_names()),
                'names': email_extractor.get_feature_names()
            }
        },
        'thresholds': config.RISK_THRESHOLDS,
        'response_time_ms': (time.time() - start_time) * 1000
    }
    
    return jsonify(response), 200

# ===============================
# URL Prediction Endpoint
# ===============================

@app.route('/predict/url', methods=['POST'])
def predict_url():
    """
    Predict if a URL is phishing
    Enhanced with feature extraction matching JS exactly
    """
    request_id = f"url_{int(time.time()*1000)}"
    start_time = time.time()
    
    logger.info(f"\n[{request_id}] 🔍 URL Prediction Request")
    
    try:
        # Parse request
        data = request.get_json()
        if not data:
            return jsonify(ErrorResponse(
                error="Invalid request",
                detail="No JSON data provided",
                status_code=400
            ).dict()), 400
        
        req = URLPredictRequest(**data)
        logger.info(f"[{request_id}] URL: {req.url[:100]}...")
        
        # Extract features (matching JS exactly)
        logger.info(f"[{request_id}] Extracting URL features...")
        features_array = url_extractor.extract_features_array(
            req.url, 
            req.page_text, 
            req.links_count
        )
        features_dict = url_extractor.extract_features(
            req.url, 
            req.page_text, 
            req.links_count
        )
        
        logger.info(f"[{request_id}] Features extracted: {len(features_array)}")
        
        # Calculate heuristic score (fallback)
        heuristic_score = calculate_url_heuristic_score(features_dict)
        logger.info(f"[{request_id}] Heuristic score: {heuristic_score:.2f}")
        
        response = {
            'url': req.url,
            'heuristic_score': float(heuristic_score),
            'processing_time_ms': (time.time() - start_time) * 1000,
            'features': features_dict if req.return_features else None,
            'feature_names': url_extractor.get_feature_names() if req.return_features else None,
            'source': 'heuristic'
        }
        
        # Make ML prediction if model is available
        if url_model is not None:
            try:
                logger.info(f"[{request_id}] Making ML prediction...")
                
                # Ensure features are in correct shape
                if len(features_array.shape) == 1:
                    features_2d = features_array.reshape(1, -1)
                else:
                    features_2d = features_array
                
                # Get prediction
                probability = url_model.predict_proba(features_2d)[0][1]
                prediction = url_model.predict(features_2d)[0]
                
                # Calculate risk score (combine with heuristic)
                risk_score = (heuristic_score * 0.3) + (probability * 100 * 0.7)
                
                # Determine risk level
                risk_level = get_risk_level(risk_score)
                
                logger.info(f"[{request_id}] ML Probability: {probability:.3f}")
                logger.info(f"[{request_id}] Combined Risk: {risk_score:.2f} - {risk_level}")
                
                response.update({
                    'probability': float(probability),
                    'risk_score': float(risk_score),
                    'risk_level': risk_level,
                    'prediction': int(prediction),
                    'is_phishing': bool(prediction == 1),
                    'source': 'combined',
                    'model_version': model_manager.get_model_info('url', 'version')
                })
                
            except Exception as e:
                logger.error(f"[{request_id}] ML prediction failed: {e}")
                logger.warning(f"[{request_id}] Falling back to heuristic only")
                
                risk_level = get_risk_level(heuristic_score)
                response.update({
                    'risk_score': float(heuristic_score),
                    'risk_level': risk_level,
                    'source': 'heuristic_only',
                    'ml_error': str(e)
                })
        else:
            # Heuristic only
            risk_level = get_risk_level(heuristic_score)
            response.update({
                'risk_score': float(heuristic_score),
                'risk_level': risk_level,
                'source': 'heuristic_only'
            })
        
        # Add explanations
        response['explanations'] = generate_url_explanations(features_dict, response['risk_level'])
        
        logger.info(f"[{request_id}] ✅ Prediction complete in {response['processing_time_ms']:.1f}ms")
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"[{request_id}] ❌ Error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify(ErrorResponse(
            error="Prediction failed",
            detail=str(e),
            status_code=400
        ).dict()), 400

# ===============================
# Email Prediction Endpoint
# ===============================

@app.route('/predict/email', methods=['POST'])
def predict_email():
    """
    Predict if an email is phishing
    Enhanced with comprehensive feature extraction
    """
    request_id = f"email_{int(time.time()*1000)}"
    start_time = time.time()
    
    logger.info(f"\n[{request_id}] 📧 Email Prediction Request")
    
    try:
        # Parse request
        data = request.get_json()
        if not data:
            return jsonify(ErrorResponse(
                error="Invalid request",
                detail="No JSON data provided",
                status_code=400
            ).dict()), 400
        
        req = EmailPredictRequest(**data)
        logger.info(f"[{request_id}] Subject: {req.subject[:100]}...")
        
        # Extract features
        logger.info(f"[{request_id}] Extracting email features...")
        features_array = email_extractor.extract_features_array(
            req.subject, req.body, req.links
        )
        features_dict = email_extractor.extract_features(
            req.subject, req.body, req.links
        )
        
        logger.info(f"[{request_id}] Features extracted: {len(features_array)}")
        
        # Calculate heuristic score (always available)
        heuristic_score = features_dict.get('risk_score', 0)
        logger.info(f"[{request_id}] Heuristic score: {heuristic_score:.2f}")
        
        response = {
            'subject': req.subject[:100] + '...' if len(req.subject) > 100 else req.subject,
            'heuristic_score': float(heuristic_score),
            'processing_time_ms': (time.time() - start_time) * 1000,
            'features': features_dict if req.return_features else None,
            'feature_names': email_extractor.get_feature_names() if req.return_features else None,
            'source': 'heuristic'
        }
        
        # Make ML prediction if model is available
        if email_model is not None:
            try:
                logger.info(f"[{request_id}] Making ML prediction...")
                
                # Ensure features are in correct shape
                if len(features_array.shape) == 1:
                    features_2d = features_array.reshape(1, -1)
                else:
                    features_2d = features_array
                
                # Get prediction
                probability = email_model.predict_proba(features_2d)[0][1]
                prediction = email_model.predict(features_2d)[0]
                
                # Calculate risk score (combine with heuristic)
                risk_score = (heuristic_score * 0.2) + (probability * 100 * 0.8)
                
                # Determine risk level
                risk_level = get_risk_level(risk_score)
                
                logger.info(f"[{request_id}] ML Probability: {probability:.3f}")
                logger.info(f"[{request_id}] Combined Risk: {risk_score:.2f} - {risk_level}")
                
                response.update({
                    'probability': float(probability),
                    'risk_score': float(risk_score),
                    'risk_level': risk_level,
                    'prediction': int(prediction),
                    'is_phishing': bool(prediction == 1),
                    'source': 'combined',
                    'model_version': model_manager.get_model_info('email', 'version')
                })
                
            except Exception as e:
                logger.error(f"[{request_id}] ML prediction failed: {e}")
                logger.warning(f"[{request_id}] Falling back to heuristic only")
                
                risk_level = get_risk_level(heuristic_score)
                response.update({
                    'risk_score': float(heuristic_score),
                    'risk_level': risk_level,
                    'source': 'heuristic_only',
                    'ml_error': str(e)
                })
        else:
            # Heuristic only
            risk_level = get_risk_level(heuristic_score)
            response.update({
                'risk_score': float(heuristic_score),
                'risk_level': risk_level,
                'source': 'heuristic_only'
            })
        
        # Add explanations
        response['explanations'] = email_extractor.get_risk_explanations(features_dict)
        
        logger.info(f"[{request_id}] ✅ Prediction complete in {response['processing_time_ms']:.1f}ms")
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"[{request_id}] ❌ Error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify(ErrorResponse(
            error="Prediction failed",
            detail=str(e),
            status_code=400
        ).dict()), 400

# ===============================
# Feature Extraction Only Endpoints
# ===============================

@app.route('/features/url', methods=['POST'])
def extract_url_features_only():
    """Just extract URL features without prediction"""
    try:
        data = request.get_json()
        url = data.get('url', '')
        page_text = data.get('page_text', '')
        links_count = data.get('links_count', 0)
        
        if not url:
            return jsonify({"error": "URL is required"}), 400
        
        features = url_extractor.extract_features(url, page_text, links_count)
        heuristic_score = calculate_url_heuristic_score(features)
        
        return jsonify({
            'url': url,
            'features': features,
            'heuristic_score': heuristic_score,
            'feature_names': url_extractor.get_feature_names(),
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/features/email', methods=['POST'])
def extract_email_features_only():
    """Just extract email features without prediction"""
    try:
        data = request.get_json()
        subject = data.get('subject', '')
        body = data.get('body', '')
        links = data.get('links', [])
        
        features = email_extractor.extract_features(subject, body, links)
        
        return jsonify({
            'features': features,
            'feature_names': email_extractor.get_feature_names(),
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ===============================
# Model Management Endpoints
# ===============================

@app.route('/models', methods=['GET'])
def list_models():
    """List all available models"""
    return jsonify({
        'models': model_manager.list_available_models(),
        'current': {
            'url': model_manager.get_model_info('url'),
            'email': model_manager.get_model_info('email')
        }
    }), 200

@app.route('/models/<model_type>/<version>', methods=['POST'])
def switch_model(model_type, version):
    """Switch to a specific model version"""
    if model_type not in ['url', 'email']:
        return jsonify({"error": "Invalid model type"}), 400
    
    try:
        loader = ModelLoader(model_type, version=version, model_manager=model_manager)
        model = loader.load_model()
        
        # Update global model
        global url_model, email_model
        if model_type == 'url':
            url_model = model
        else:
            email_model = model
        
        return jsonify({
            'success': True,
            'message': f"Switched to {model_type} model version {version}",
            'model_info': model_manager.get_model_info(model_type, version)
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ===============================
# Info Endpoint
# ===============================

@app.route('/info', methods=['GET'])
def get_info():
    """Get comprehensive API information"""
    return jsonify({
        'name': 'PhishGuard API',
        'version': config.API_VERSION,
        'description': 'AI-powered phishing detection API',
        'endpoints': {
            'health': '/health - Health check',
            'predict_url': '/predict/url - URL phishing prediction',
            'predict_email': '/predict/email - Email phishing prediction',
            'features_url': '/features/url - Extract URL features only',
            'features_email': '/features/email - Extract email features only',
            'models': '/models - List available models',
            'info': '/info - This information'
        },
        'url_features': {
            'count': len(url_extractor.get_feature_names()),
            'names': url_extractor.get_feature_names()
        },
        'email_features': {
            'count': len(email_extractor.get_feature_names()),
            'names': email_extractor.get_feature_names()
        },
        'risk_thresholds': config.RISK_THRESHOLDS,
        'models_loaded': {
            'url': url_model is not None,
            'email': email_model is not None
        },
        'timestamp': datetime.now().isoformat()
    }), 200

# ===============================
# Helper Functions
# ===============================

def calculate_url_heuristic_score(features: Dict[str, Any]) -> float:
    """Calculate heuristic risk score for URL"""
    score = 0.0
    
    # URL-based heuristics (matching background.js)
    if features.get('hasIP', 0) == 1:
        score += 25
    if features.get('hasAtSymbol', 0) == 1:
        score += 20
    if features.get('hasSuspiciousKeyword', 0) == 1:
        score += 15
    if features.get('subdomainCount', 0) > 2:
        score += 10 * features['subdomainCount']
    if features.get('urlLength', 0) > 75:
        score += 10
    if features.get('isHTTPS', 1) == 0:
        score += 15
    if features.get('specialCharCount', 0) > 5:
        score += 5
    if features.get('hasLoginVerify', 0) == 1:
        score += 15
    if features.get('hasTooManyLinks', 0) == 1:
        score += 15
    
    # Page text heuristics
    if features.get('urgentWordCount', 0) > 0:
        score += 10 * features['urgentWordCount']
    if features.get('suspiciousKeywordCount', 0) > 0:
        score += 5 * features['suspiciousKeywordCount']
    
    return min(max(score, 0), 100)

def get_risk_level(score: float) -> str:
    """Determine risk level from score"""
    if score <= config.RISK_THRESHOLDS['safe']:
        return 'Safe'
    elif score <= config.RISK_THRESHOLDS['suspicious']:
        return 'Suspicious'
    else:
        return 'Dangerous'

def generate_url_explanations(features: Dict[str, Any], level: str) -> list:
    """Generate user-friendly explanations for URL risks"""
    explanations = []
    
    if features.get('hasIP', 0) == 1:
        explanations.append({
            'title': 'IP-based URL',
            'description': 'This URL uses an IP address instead of a domain name. Legitimate companies use branded domains.',
            'severity': 'high'
        })
    
    if features.get('hasAtSymbol', 0) == 1:
        explanations.append({
            'title': '@ Symbol in URL',
            'description': 'The @ symbol can hide the actual destination website.',
            'severity': 'high'
        })
    
    if features.get('subdomainCount', 0) > 2:
        explanations.append({
            'title': 'Excessive Subdomains',
            'description': f"Found {features['subdomainCount']} subdomains. Legitimate sites rarely use more than 2.",
            'severity': 'medium'
        })
    
    if features.get('urlLength', 0) > 75:
        explanations.append({
            'title': 'Unusually Long URL',
            'description': 'Long URLs can hide malicious parameters.',
            'severity': 'medium'
        })
    
    if features.get('isHTTPS', 1) == 0:
        explanations.append({
            'title': 'No HTTPS Encryption',
            'description': 'This site doesn\'t use secure encryption. Your data could be intercepted.',
            'severity': 'high'
        })
    
    return explanations

# ===============================
# Error Handlers
# ===============================

@app.errorhandler(404)
def not_found(error):
    return jsonify(ErrorResponse(
        error="Not Found",
        detail="The requested endpoint does not exist",
        status_code=404
    ).dict()), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify(ErrorResponse(
        error="Internal Server Error",
        detail="An unexpected error occurred",
        status_code=500
    ).dict()), 500

# ===============================
# Startup
# ===============================

# Load models when starting the app
load_models()

if __name__ == '__main__':
    app.run(
        host=config.API_HOST,
        port=config.API_PORT,
        debug=config.DEBUG,
        threaded=True
    )