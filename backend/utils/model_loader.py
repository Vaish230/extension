"""
Model Loader Utility
Loads trained models and makes predictions
"""

import joblib
import os
import numpy as np
from .config import get_config

config = get_config()

class ModelLoader:
    def __init__(self, model_type='url'):
        """
        Initialize model loader
        model_type: 'url' or 'email'
        """
        self.model_type = model_type
        self.model = None
        
        # Model paths
        if model_type == 'url':
            self.model_path = config.URL_MODEL_PATH
        else:
            self.model_path = config.EMAIL_MODEL_PATH
    
    def load_model(self):
        """Load the trained model"""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model not found at {self.model_path}. Please train the model first.")
        
        self.model = joblib.load(self.model_path)
        print(f"✅ {self.model_type.upper()} model loaded from {self.model_path}")
        return self.model
    
    def predict(self, features):
        """
        Make prediction
        features: numpy array or list of features
        Returns: probability and class
        """
        if self.model is None:
            self.load_model()
        
        # Convert to numpy array if needed
        if isinstance(features, list):
            features = np.array(features).reshape(1, -1)
        elif len(features.shape) == 1:
            features = features.reshape(1, -1)
        
        # Get probability
        probability = self.model.predict_proba(features)[0][1]
        
        # Get class
        prediction = self.model.predict(features)[0]
        
        # Calculate risk score (0-100)
        risk_score = probability * 100
        
        # Determine risk level (matching your contentScript.js)
        if risk_score <= config.RISK_THRESHOLDS['safe']:
            risk_level = 'Safe'
        elif risk_score <= config.RISK_THRESHOLDS['suspicious']:
            risk_level = 'Suspicious'
        else:
            risk_level = 'Dangerous'
        
        return {
            'probability': float(probability),
            'risk_score': float(risk_score),
            'risk_level': risk_level,
            'prediction': int(prediction),
            'is_phishing': bool(prediction == 1)
        }
    
    def is_model_loaded(self):
        """Check if model is loaded"""
        return self.model is not None