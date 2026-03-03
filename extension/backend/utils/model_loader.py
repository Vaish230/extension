"""
Model Loader Utility
Loads trained models and manages versions with comprehensive error handling
"""

import joblib
import os
import json
import numpy as np
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging

from .config import get_config

config = get_config()
logger = logging.getLogger(__name__)

class ModelManager:
    """Manage multiple model versions and metadata"""
    
    def __init__(self, models_dir: str = None):
        self.models_dir = models_dir or config.MODEL_DIR
        self.models_cache = {}
        self.metadata_cache = {}
        
    def get_available_versions(self, model_type: str) -> List[str]:
        """Get all available versions for a model type"""
        pattern = f"{model_type}_model_v*.pkl"
        import glob
        model_files = glob.glob(os.path.join(self.models_dir, pattern))
        
        versions = []
        for file in model_files:
            # Extract version from filename
            basename = os.path.basename(file)
            version = basename.replace(f"{model_type}_model_v", "").replace(".pkl", "")
            versions.append(version)
        
        return sorted(versions, reverse=True)
    
    def get_model_info(self, model_type: str, version: str = None) -> Optional[Dict]:
        """Get model metadata"""
        if version is None:
            # Get latest version
            versions = self.get_available_versions(model_type)
            if not versions:
                return None
            version = versions[0]
        
        cache_key = f"{model_type}_{version}"
        if cache_key in self.metadata_cache:
            return self.metadata_cache[cache_key]
        
        # Load metadata
        metadata_path = os.path.join(
            self.models_dir, 
            f"{model_type}_model_metadata_v{version}.json"
        )
        
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
                self.metadata_cache[cache_key] = metadata
                return metadata
        
        return None
    
    def list_available_models(self) -> Dict[str, List[str]]:
        """List all available models and versions"""
        return {
            'url': self.get_available_versions('url'),
            'email': self.get_available_versions('email')
        }

class ModelLoader:
    """
    Load trained models with version support and comprehensive error handling
    """
    
    def __init__(self, model_type: str = 'url', version: str = None, model_manager: ModelManager = None):
        """
        Initialize model loader
        
        Args:
            model_type: 'url' or 'email'
            version: Specific version to load (None for latest)
            model_manager: Optional ModelManager instance
        """
        self.model_type = model_type
        self.version = version
        self.model = None
        self.scaler = None
        self.metadata = None
        self.manager = model_manager or ModelManager()
        
        # Get model paths
        if version:
            self.model_path = os.path.join(
                config.MODEL_DIR, 
                f"{model_type}_model_v{version}.pkl"
            )
            self.scaler_path = os.path.join(
                config.MODEL_DIR,
                f"{model_type}_scaler_v{version}.pkl"
            )
        else:
            # Try latest version first, then fallback to base
            versions = self.manager.get_available_versions(model_type)
            if versions:
                self.version = versions[0]
                self.model_path = os.path.join(
                    config.MODEL_DIR,
                    f"{model_type}_model_v{self.version}.pkl"
                )
                self.scaler_path = os.path.join(
                    config.MODEL_DIR,
                    f"{model_type}_scaler_v{self.version}.pkl"
                )
            else:
                # Fallback to base filenames
                self.model_path = config.URL_MODEL_PATH if model_type == 'url' else config.EMAIL_MODEL_PATH
                self.scaler_path = os.path.join(
                    config.MODEL_DIR,
                    f"{model_type}_scaler.pkl"
                )
    
    def load_model(self):
        """
        Load the trained model with comprehensive error handling
        
        Returns:
            Loaded model object
        
        Raises:
            FileNotFoundError: If model file doesn't exist
            Exception: For other loading errors
        """
        if self.model is not None:
            return self.model
        
        # Check if model exists
        if not os.path.exists(self.model_path):
            error_msg = f"Model not found at {self.model_path}"
            if self.version:
                error_msg += f" (version {self.version})"
            logger.error(f"❌ {error_msg}")
            
            # Try to find any available version
            versions = self.manager.get_available_versions(self.model_type)
            if versions:
                logger.info(f"📦 Available versions: {', '.join(versions)}")
                logger.info(f"💡 Try loading with version={versions[0]}")
            
            raise FileNotFoundError(error_msg)
        
        try:
            # Load model
            logger.info(f"📦 Loading {self.model_type.upper()} model from {self.model_path}")
            self.model = joblib.load(self.model_path)
            
            # Load scaler if exists
            if os.path.exists(self.scaler_path):
                logger.info(f"📦 Loading scaler from {self.scaler_path}")
                self.scaler = joblib.load(self.scaler_path)
            else:
                logger.warning(f"⚠️ No scaler found at {self.scaler_path}")
                self.scaler = None
            
            # Load metadata
            self.metadata = self.manager.get_model_info(self.model_type, self.version)
            
            # Log model info
            logger.info(f"✅ {self.model_type.upper()} model loaded successfully")
            if self.metadata:
                logger.info(f"   Version: {self.metadata.get('version', 'unknown')}")
                logger.info(f"   Type: {self.metadata.get('model_type', 'unknown')}")
                logger.info(f"   Features: {self.metadata.get('num_features', 0)}")
                if 'metrics' in self.metadata:
                    metrics = self.metadata['metrics']
                    logger.info(f"   Accuracy: {metrics.get('accuracy', 'N/A'):.3f}")
                    logger.info(f"   F1 Score: {metrics.get('f1', 'N/A'):.3f}")
            
            return self.model
            
        except Exception as e:
            logger.error(f"❌ Failed to load model: {str(e)}")
            raise
    
    def predict(self, features, return_proba: bool = True):
        """
        Make prediction with comprehensive error handling
        
        Args:
            features: numpy array or list of features
            return_proba: Whether to return probability scores
            
        Returns:
            Dictionary with prediction results
        """
        if self.model is None:
            self.load_model()
        
        try:
            # Convert to numpy array if needed
            if isinstance(features, list):
                features = np.array(features)
            
            # Ensure 2D shape
            if len(features.shape) == 1:
                features = features.reshape(1, -1)
            
            # Validate feature count
            expected_features = self.metadata.get('num_features', features.shape[1]) if self.metadata else features.shape[1]
            if features.shape[1] != expected_features:
                logger.warning(f"⚠️ Feature count mismatch: expected {expected_features}, got {features.shape[1]}")
            
            # Apply scaler if available
            if self.scaler is not None:
                features = self.scaler.transform(features)
            
            # Get prediction
            if return_proba and hasattr(self.model, 'predict_proba'):
                probabilities = self.model.predict_proba(features)[0]
                probability = probabilities[1]  # Probability of positive class
                prediction = 1 if probability >= 0.5 else 0
            else:
                prediction = self.model.predict(features)[0]
                probability = None
            
            # Calculate risk score (0-100)
            if probability is not None:
                risk_score = probability * 100
            else:
                # For models without probability, use decision function or default
                if hasattr(self.model, 'decision_function'):
                    decision = self.model.decision_function(features)[0]
                    # Normalize decision to 0-100 range (approximate)
                    risk_score = (decision + 1) * 50 if hasattr(self.model, 'classes_') else 50
                else:
                    risk_score = 100 if prediction == 1 else 0
            
            # Determine risk level
            risk_level = self._get_risk_level(risk_score)
            
            result = {
                'prediction': int(prediction),
                'is_phishing': bool(prediction == 1),
                'risk_score': float(risk_score),
                'risk_level': risk_level,
                'model_type': self.model_type,
                'model_version': self.version or 'latest'
            }
            
            if probability is not None:
                result['probability'] = float(probability)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Prediction failed: {str(e)}")
            raise
    
    def _get_risk_level(self, score: float) -> str:
        """Determine risk level from score"""
        if score <= config.RISK_THRESHOLDS['safe']:
            return 'Safe'
        elif score <= config.RISK_THRESHOLDS['suspicious']:
            return 'Suspicious'
        else:
            return 'Dangerous'
    
    def get_feature_importance(self) -> Optional[Dict[str, float]]:
        """Get feature importance if available"""
        if self.metadata and 'coefficients' in self.metadata:
            feature_names = self.metadata.get('feature_names', [])
            coefficients = self.metadata['coefficients']
            return dict(zip(feature_names, coefficients))
        elif self.metadata and 'feature_importances' in self.metadata:
            feature_names = self.metadata.get('feature_names', [])
            importances = self.metadata['feature_importances']
            return dict(zip(feature_names, importances))
        return None
    
    def is_model_loaded(self) -> bool:
        """Check if model is loaded"""
        return self.model is not None
    
    def get_model_info(self) -> Dict:
        """Get model information"""
        info = {
            'type': self.model_type,
            'version': self.version or 'latest',
            'loaded': self.is_model_loaded(),
            'path': self.model_path,
            'scaler_path': self.scaler_path if os.path.exists(self.scaler_path) else None
        }
        
        if self.metadata:
            info['metadata'] = self.metadata
        
        if self.is_model_loaded():
            info['model_class'] = self.model.__class__.__name__
        
        return info


class EnsembleModelLoader:
    """Load multiple models and combine predictions"""
    
    def __init__(self, model_type: str, versions: List[str] = None):
        self.model_type = model_type
        self.versions = versions or []
        self.models = []
        self.weights = []
        
    def load_models(self):
        """Load all specified model versions"""
        if not self.versions:
            # Load all available versions
            manager = ModelManager()
            self.versions = manager.get_available_versions(self.model_type)
        
        for version in self.versions:
            try:
                loader = ModelLoader(self.model_type, version=version)
                model = loader.load_model()
                self.models.append({
                    'loader': loader,
                    'model': model,
                    'version': version
                })
                # Weight by accuracy if available
                metadata = loader.metadata
                if metadata and 'metrics' in metadata:
                    weight = metadata['metrics'].get('accuracy', 0.5)
                else:
                    weight = 1.0
                self.weights.append(weight)
                
                logger.info(f"✅ Loaded {self.model_type} v{version} (weight: {weight:.2f})")
                
            except Exception as e:
                logger.error(f"❌ Failed to load {self.model_type} v{version}: {e}")
        
        # Normalize weights
        if self.weights:
            total = sum(self.weights)
            self.weights = [w / total for w in self.weights]
    
    def predict(self, features):
        """Make ensemble prediction"""
        if not self.models:
            raise ValueError("No models loaded")
        
        predictions = []
        probabilities = []
        
        for model_info in self.models:
            try:
                result = model_info['loader'].predict(features)
                predictions.append(result['prediction'])
                if 'probability' in result:
                    probabilities.append(result['probability'])
            except:
                continue
        
        if not predictions:
            raise ValueError("All models failed to predict")
        
        # Weighted voting
        if probabilities:
            # Average probabilities
            avg_probability = np.average(probabilities, weights=self.weights[:len(probabilities)])
            prediction = 1 if avg_probability >= 0.5 else 0
            risk_score = avg_probability * 100
        else:
            # Majority voting
            prediction = int(sum(predictions) > len(predictions) / 2)
            risk_score = 100 if prediction == 1 else 0
        
        return {
            'prediction': prediction,
            'is_phishing': bool(prediction == 1),
            'risk_score': float(risk_score),
            'risk_level': self._get_risk_level(risk_score),
            'model_type': self.model_type,
            'ensemble_size': len(self.models),
            'versions': [m['version'] for m in self.models]
        }
    
    def _get_risk_level(self, score: float) -> str:
        """Determine risk level from score"""
        if score <= config.RISK_THRESHOLDS['safe']:
            return 'Safe'
        elif score <= config.RISK_THRESHOLDS['suspicious']:
            return 'Suspicious'
        else:
            return 'Dangerous'