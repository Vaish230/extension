"""
Email Phishing Detection Model Training
Using Logistic Regression with Advanced Features
"""

import sys
import os
import pandas as pd
import numpy as np
import joblib
import json
import argparse
from datetime import datetime
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, 
    confusion_matrix, roc_auc_score, classification_report
)
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt
import seaborn as sns

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from feature_extraction.email_features import EmailFeatureExtractor, create_email_extractor

class EmailModelTrainer:
    """Train and evaluate email phishing detection models"""
    
    def __init__(self, model_type='logistic'):
        """
        Initialize trainer
        
        Args:
            model_type: 'logistic' or 'random_forest'
        """
        self.extractor = create_email_extractor()
        self.model_type = model_type
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = self.extractor.get_feature_names()
        self.training_metrics = {}
        
        # Create directories
        os.makedirs('../models', exist_ok=True)
        os.makedirs('../models/plots', exist_ok=True)
        
    def load_and_prepare_data(self, dataset_path: str):
        """
        Load dataset and prepare features
        
        Expected CSV columns:
        - subject: email subject
        - body: email body
        - links: pipe-separated|links|if|any (optional)
        - label: 1 for phishing, 0 for legitimate
        
        Args:
            dataset_path: Path to CSV file
            
        Returns:
            X: Feature matrix
            y: Labels
            df: Original dataframe
        """
        print("="*70)
        print("🔰 EMAIL PHISHING MODEL TRAINING")
        print("="*70)
        
        # Load dataset
        print(f"\n📂 Loading dataset from: {dataset_path}")
        df = pd.read_csv(dataset_path)
        
        # Data cleaning and preparation
        print(f"\n📊 Initial dataset shape: {df.shape}")
        
        # Handle missing values
        df['subject'] = df['subject'].fillna('').astype(str)
        df['body'] = df['body'].fillna('').astype(str)
        
        if 'links' in df.columns:
            df['links'] = df['links'].fillna('').astype(str)
        else:
            df['links'] = ''
            
        # Validate labels
        if 'label' not in df.columns:
            raise ValueError("Dataset must contain 'label' column")
        
        df['label'] = pd.to_numeric(df['label'], errors='coerce').fillna(0).astype(int)
        
        # Remove invalid rows
        initial_count = len(df)
        df = df[df['label'].isin([0, 1])]
        print(f"   Removed {initial_count - len(df)} rows with invalid labels")
        
        # Check class distribution
        phishing_count = len(df[df['label'] == 1])
        legit_count = len(df[df['label'] == 0])
        
        print(f"\n📈 Class Distribution:")
        print(f"   Phishing:    {phishing_count:6d} ({phishing_count/len(df)*100:.1f}%)")
        print(f"   Legitimate:  {legit_count:6d} ({legit_count/len(df)*100:.1f}%)")
        
        # Extract features
        print(f"\n🛠️ Extracting {len(self.feature_names)} features from {len(df)} emails...")
        
        X_list = []
        y_list = []
        error_count = 0
        
        for idx, row in df.iterrows():
            if idx % 500 == 0 and idx > 0:
                print(f"   Processed {idx}/{len(df)} emails...")
            
            try:
                # Parse links (assuming pipe-separated)
                links_str = str(row['links']) if pd.notna(row['links']) else ''
                links = links_str.split('|') if links_str and links_str != 'nan' else []
                
                features = self.extractor.extract_features_array(
                    subject=row['subject'],
                    body=row['body'],
                    links=links
                )
                X_list.append(features)
                y_list.append(row['label'])
                
            except Exception as e:
                error_count += 1
                if error_count < 10:  # Show first few errors
                    print(f"   ⚠️ Error at row {idx}: {str(e)[:50]}...")
                continue
        
        X = np.array(X_list)
        y = np.array(y_list)
        
        print(f"\n✅ Feature matrix shape: {X.shape}")
        print(f"   Errors encountered: {error_count}")
        
        # Feature statistics
        print(f"\n📊 Feature Statistics:")
        feature_means = np.mean(X, axis=0)
        feature_stds = np.std(X, axis=0)
        
        for i, name in enumerate(self.feature_names):
            print(f"   {name:25s}: mean={feature_means[i]:8.3f}, std={feature_stds[i]:8.3f}")
        
        return X, y, df
    
    def train_model(self, X: np.ndarray, y: np.ndarray, test_size: float = 0.2):
        """
        Train machine learning model
        
        Args:
            X: Feature matrix
            y: Labels
            test_size: Proportion for test set
            
        Returns:
            Dictionary of metrics
        """
        print(f"\n🚀 Training {self.model_type.replace('_', ' ').title()} Model...")
        
        # Split data with stratification
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        print(f"\n📊 Data Split:")
        print(f"   Training set:   {len(X_train)} samples")
        print(f"   Test set:       {len(X_test)} samples")
        
        # Select and train model
        if self.model_type == 'logistic':
            self.model = LogisticRegression(
                max_iter=2000,
                random_state=42,
                class_weight='balanced',
                solver='lbfgs',
                C=1.0
            )
        elif self.model_type == 'random_forest':
            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                class_weight='balanced',
                n_jobs=-1
            )
        else:
            raise ValueError(f"Unknown model type: {self.model_type}")
        
        # Train model
        self.model.fit(X_train_scaled, y_train)
        
        # Cross-validation
        cv_scores = cross_val_score(self.model, X_train_scaled, y_train, cv=5, scoring='f1')
        print(f"\n📊 Cross-validation F1 scores: {cv_scores}")
        print(f"   Mean CV F1: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
        
        # Make predictions
        y_pred = self.model.predict(X_test_scaled)
        y_prob = self.model.predict_proba(X_test_scaled)[:, 1]
        
        # Calculate metrics
        metrics = self._calculate_metrics(y_test, y_pred, y_prob)
        
        # Feature importance (for Random Forest)
        if self.model_type == 'random_forest':
            self._plot_feature_importance()
        
        return metrics
    
    def _calculate_metrics(self, y_test, y_pred, y_prob):
        """Calculate comprehensive metrics"""
        
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred)
        recall = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        auc = roc_auc_score(y_test, y_prob)
        
        print(f"\n📊 Test Set Performance:")
        print(f"   Accuracy:  {accuracy:.4f}")
        print(f"   Precision: {precision:.4f}")
        print(f"   Recall:    {recall:.4f}")
        print(f"   F1-Score:  {f1:.4f}")
        print(f"   AUC-ROC:   {auc:.4f}")
        
        # Confusion Matrix
        cm = confusion_matrix(y_test, y_pred)
        print(f"\n📉 Confusion Matrix:")
        print(f"   TN: {cm[0,0]:6d}  FP: {cm[0,1]:6d}")
        print(f"   FN: {cm[1,0]:6d}  TP: {cm[1,1]:6d}")
        
        # Classification Report
        print(f"\n📋 Classification Report:")
        print(classification_report(y_test, y_pred, target_names=['Legitimate', 'Phishing']))
        
        # Feature coefficients (for Logistic Regression)
        if self.model_type == 'logistic' and hasattr(self.model, 'coef_'):
            coefficients = self.model.coef_[0]
            print(f"\n📊 Feature Coefficients:")
            coef_df = pd.DataFrame({
                'Feature': self.feature_names,
                'Coefficient': coefficients,
                'Abs_Coefficient': np.abs(coefficients)
            }).sort_values('Abs_Coefficient', ascending=False)
            
            for _, row in coef_df.iterrows():
                sign = '+' if row['Coefficient'] > 0 else '-'
                print(f"   {row['Feature']:25s}: {sign} {abs(row['Coefficient']):.4f}")
        
        metrics = {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1': f1,
            'auc': auc,
            'test_size': len(y_test),
            'confusion_matrix': cm.tolist()
        }
        
        self.training_metrics = metrics
        return metrics
    
    def _plot_feature_importance(self):
        """Plot feature importance for Random Forest"""
        if not hasattr(self.model, 'feature_importances_'):
            return
        
        importances = self.model.feature_importances_
        indices = np.argsort(importances)[::-1]
        
        plt.figure(figsize=(10, 6))
        plt.title("Feature Importances")
        plt.bar(range(len(importances)), importances[indices])
        plt.xticks(range(len(importances)), [self.feature_names[i] for i in indices], rotation=45, ha='right')
        plt.tight_layout()
        plt.savefig('../models/plots/email_feature_importance.png', dpi=100, bbox_inches='tight')
        plt.close()
        print(f"\n📈 Feature importance plot saved to ../models/plots/email_feature_importance.png")
    
    def hyperparameter_tuning(self, X: np.ndarray, y: np.ndarray):
        """Perform hyperparameter tuning"""
        print(f"\n🔧 Performing hyperparameter tuning...")
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        X_train_scaled = self.scaler.fit_transform(X_train)
        
        if self.model_type == 'logistic':
            param_grid = {
                'C': [0.01, 0.1, 1, 10, 100],
                'solver': ['lbfgs', 'liblinear'],
                'max_iter': [1000, 2000, 3000]
            }
            base_model = LogisticRegression(random_state=42, class_weight='balanced')
        else:
            param_grid = {
                'n_estimators': [50, 100, 200],
                'max_depth': [5, 10, 15, None],
                'min_samples_split': [2, 5, 10]
            }
            base_model = RandomForestClassifier(random_state=42, class_weight='balanced', n_jobs=-1)
        
        grid_search = GridSearchCV(
            base_model, param_grid, cv=5, scoring='f1', n_jobs=-1, verbose=1
        )
        
        grid_search.fit(X_train_scaled, y_train)
        
        print(f"\n✅ Best parameters: {grid_search.best_params_}")
        print(f"   Best F1 score: {grid_search.best_score_:.4f}")
        
        self.model = grid_search.best_estimator_
        
        # Evaluate on test set
        X_test_scaled = self.scaler.transform(X_test)
        y_pred = self.model.predict(X_test_scaled)
        y_prob = self.model.predict_proba(X_test_scaled)[:, 1]
        
        metrics = self._calculate_metrics(y_test, y_pred, y_prob)
        return metrics
    
    def save_model(self, metrics: dict, version: str = "1.0.0"):
        """
        Save the trained model and metadata
        
        Args:
            metrics: Training metrics
            version: Model version
        """
        print(f"\n💾 Saving model (version {version})...")
        
        # Save model
        model_path = f'../models/email_model_v{version}.pkl'
        joblib.dump(self.model, model_path)
        print(f"✅ Model saved to: {model_path}")
        
        # Save scaler
        scaler_path = f'../models/email_scaler_v{version}.pkl'
        joblib.dump(self.scaler, scaler_path)
        print(f"✅ Scaler saved to: {scaler_path}")
        
        # Save metadata
        metadata = {
            'version': version,
            'training_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'model_type': self.model_type,
            'feature_names': self.feature_names,
            'num_features': len(self.feature_names),
            'metrics': metrics,
            'config': self.extractor.config
        }
        
        # Add model-specific parameters
        if self.model_type == 'logistic' and hasattr(self.model, 'coef_'):
            metadata['coefficients'] = self.model.coef_[0].tolist()
            metadata['intercept'] = self.model.intercept_[0]
        elif self.model_type == 'random_forest' and hasattr(self.model, 'feature_importances_'):
            metadata['feature_importances'] = self.model.feature_importances_.tolist()
        
        metadata_path = f'../models/email_model_metadata_v{version}.json'
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=4)
        print(f"✅ Metadata saved to: {metadata_path}")
        
        # Create symlink to latest version
        latest_model = '../models/email_model.pkl'
        latest_scaler = '../models/email_scaler.pkl'
        latest_metadata = '../models/email_model_metadata.json'
        
        if os.path.exists(latest_model):
            os.remove(latest_model)
        if os.path.exists(latest_scaler):
            os.remove(latest_scaler)
        if os.path.exists(latest_metadata):
            os.remove(latest_metadata)
        
        os.symlink(f'email_model_v{version}.pkl', latest_model)
        os.symlink(f'email_scaler_v{version}.pkl', latest_scaler)
        os.symlink(f'email_model_metadata_v{version}.json', latest_metadata)
        
        print(f"✅ Latest version symlinks created")
        
        return model_path
    
    def analyze_predictions(self, X: np.ndarray, y: np.ndarray, df: pd.DataFrame):
        """Analyze model predictions in detail"""
        print(f"\n🔍 Analyzing model predictions...")
        
        X_scaled = self.scaler.transform(X)
        y_pred = self.model.predict(X_scaled)
        y_prob = self.model.predict_proba(X_scaled)[:, 1]
        
        # Find misclassifications
        misclassified = np.where(y != y_pred)[0]
        
        if len(misclassified) > 0:
            print(f"\n⚠️ Found {len(misclassified)} misclassified samples:")
            
            # Analyze false positives (predicted phishing, actually legitimate)
            fp_indices = np.where((y == 0) & (y_pred == 1))[0]
            if len(fp_indices) > 0:
                print(f"\n   False Positives ({len(fp_indices)}):")
                for idx in fp_indices[:5]:  # Show first 5
                    print(f"   - Subject: {df.iloc[idx]['subject'][:50]}...")
                    print(f"     Probability: {y_prob[idx]:.3f}")
            
            # Analyze false negatives (predicted legitimate, actually phishing)
            fn_indices = np.where((y == 1) & (y_pred == 0))[0]
            if len(fn_indices) > 0:
                print(f"\n   False Negatives ({len(fn_indices)}):")
                for idx in fn_indices[:5]:  # Show first 5
                    print(f"   - Subject: {df.iloc[idx]['subject'][:50]}...")
                    print(f"     Probability: {y_prob[idx]:.3f}")
    
    def plot_roc_curve(self, X: np.ndarray, y: np.ndarray):
        """Plot ROC curve"""
        from sklearn.metrics import roc_curve, auc
        
        X_scaled = self.scaler.transform(X)
        y_prob = self.model.predict_proba(X_scaled)[:, 1]
        
        fpr, tpr, _ = roc_curve(y, y_prob)
        roc_auc = auc(fpr, tpr)
        
        plt.figure(figsize=(8, 6))
        plt.plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC curve (AUC = {roc_auc:.2f})')
        plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
        plt.xlim([0.0, 1.0])
        plt.ylim([0.0, 1.05])
        plt.xlabel('False Positive Rate')
        plt.ylabel('True Positive Rate')
        plt.title('Receiver Operating Characteristic (ROC) Curve')
        plt.legend(loc="lower right")
        plt.grid(True, alpha=0.3)
        plt.savefig('../models/plots/email_roc_curve.png', dpi=100, bbox_inches='tight')
        plt.close()
        print(f"\n📈 ROC curve saved to ../models/plots/email_roc_curve.png")


def main():
    """Main training function"""
    parser = argparse.ArgumentParser(description='Train email phishing detection model')
    parser.add_argument('--dataset', type=str, default='../dataset/email_dataset.csv',
                       help='Path to dataset CSV file')
    parser.add_argument('--model-type', type=str, default='logistic',
                       choices=['logistic', 'random_forest'],
                       help='Type of model to train')
    parser.add_argument('--tune', action='store_true',
                       help='Perform hyperparameter tuning')
    parser.add_argument('--version', type=str, default='1.0.0',
                       help='Model version')
    parser.add_argument('--test-size', type=float, default=0.2,
                       help='Test set proportion')
    
    args = parser.parse_args()
    
    # Check if dataset exists
    if not os.path.exists(args.dataset):
        print(f"\n❌ Dataset not found at: {args.dataset}")
        print("\nPlease add your Email dataset CSV file with columns:")
        print("   - subject: email subject")
        print("   - body: email body")
        print("   - links: pipe-separated|links|if|any (optional)")
        print("   - label: 1 for phishing, 0 for legitimate")
        return
    
    try:
        # Initialize trainer
        trainer = EmailModelTrainer(model_type=args.model_type)
        
        # Load and prepare data
        X, y, df = trainer.load_and_prepare_data(args.dataset)
        
        if args.tune:
            # Hyperparameter tuning
            metrics = trainer.hyperparameter_tuning(X, y)
        else:
            # Regular training
            metrics = trainer.train_model(X, y, test_size=args.test_size)
        
        # Analyze predictions
        trainer.analyze_predictions(X, y, df)
        
        # Plot ROC curve
        trainer.plot_roc_curve(X, y)
        
        # Save model
        trainer.save_model(metrics, version=args.version)
        
        print("\n" + "="*70)
        print("✅ EMAIL MODEL TRAINING COMPLETED SUCCESSFULLY!")
        print("="*70)
        
        # Summary
        print(f"\n📋 Training Summary:")
        print(f"   Model Type:     {args.model_type}")
        print(f"   Version:        {args.version}")
        print(f"   Features:       {len(trainer.feature_names)}")
        print(f"   Samples:        {len(X)}")
        print(f"   Accuracy:       {metrics['accuracy']:.4f}")
        print(f"   F1 Score:       {metrics['f1']:.4f}")
        print(f"   AUC-ROC:        {metrics['auc']:.4f}")
        
    except Exception as e:
        print(f"\n❌ Error during training: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()