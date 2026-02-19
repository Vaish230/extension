"""
Email Phishing Detection Model Training
Using Logistic Regression
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
import json
from datetime import datetime

from feature_extraction.email_features import EmailFeatureExtractor

class EmailModelTrainer:
    def __init__(self):
        self.extractor = EmailFeatureExtractor()
        self.model = None
        self.feature_names = self.extractor.get_feature_names()
        
    def load_and_prepare_data(self, dataset_path):
        """
        Load dataset and prepare features
        Expected CSV columns: 'subject', 'body', 'links', 'label'
        """
        print("="*60)
        print("🔰 EMAIL PHISHING MODEL TRAINING")
        print("="*60)
        
        # Load dataset
        df = pd.read_csv(dataset_path)
        
        # 🔥 FIX: Convert all columns to string and handle NaN/float values
        df['subject'] = df['subject'].fillna('').astype(str)
        df['body'] = df['body'].fillna('').astype(str)
        
        if 'links' in df.columns:
            df['links'] = df['links'].fillna('').astype(str)
        else:
            df['links'] = ''
        
        print(f"📊 Loaded {len(df)} samples")
        
        # Check class distribution
        phishing_count = len(df[df['label'] == 1])
        legit_count = len(df[df['label'] == 0])
        print(f"   Phishing: {phishing_count}")
        print(f"   Legitimate: {legit_count}")
        
        # Extract features for each email
        print("🛠️ Extracting features...")
        X_list = []
        
        for idx, row in df.iterrows():
            if idx % 500 == 0 and idx > 0:
                print(f"   Processed {idx} emails...")
            
            # 🔥 FIX: Convert to string explicitly
            subject = str(row['subject']) if pd.notna(row['subject']) else ''
            body = str(row['body']) if pd.notna(row['body']) else ''
            links_str = str(row['links']) if pd.notna(row['links']) else ''
            
            # Parse links (assuming pipe-separated)
            links = links_str.split('|') if links_str and links_str != 'nan' else []
            
            features = self.extractor.extract_features_array(subject, body, links)
            X_list.append(features)
        
        X = np.array(X_list)
        y = df['label'].values
        
        print(f"✅ Feature matrix shape: {X.shape}")
        return X, y
    
    def train_model(self, X, y):
        """Train Logistic Regression model"""
        print("\n🚀 Training Logistic Regression...")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Create and train model
        self.model = LogisticRegression(
            max_iter=1000,
            random_state=42,
            class_weight='balanced',
            solver='lbfgs'
        )
        
        self.model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = self.model.predict(X_test)
        y_prob = self.model.predict_proba(X_test)[:, 1]
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred)
        recall = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        
        print(f"\n📊 Test Set Performance:")
        print(f"   Accuracy:  {accuracy:.4f}")
        print(f"   Precision: {precision:.4f}")
        print(f"   Recall:    {recall:.4f}")
        print(f"   F1-Score:  {f1:.4f}")
        
        # Confusion Matrix
        cm = confusion_matrix(y_test, y_pred)
        print(f"\n📉 Confusion Matrix:")
        print(f"   TN: {cm[0,0]:4d}  FP: {cm[0,1]:4d}")
        print(f"   FN: {cm[1,0]:4d}  TP: {cm[1,1]:4d}")
        
        # Feature coefficients
        coefficients = self.model.coef_[0]
        print("\n📊 Feature Coefficients:")
        for name, coef in zip(self.feature_names, coefficients):
            print(f"   {name:25s}: {coef:.4f}")
        
        metrics = {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1': f1,
            'test_size': len(y_test)
        }
        
        return metrics
    
    def save_model(self, metrics):
        """Save the trained model"""
        print("\n💾 Saving model...")
        
        # Create models directory if it doesn't exist
        os.makedirs('../models', exist_ok=True)
        
        # Save model
        model_path = '../models/email_model.pkl'
        joblib.dump(self.model, model_path)
        print(f"✅ Model saved to: {model_path}")
        
        # Save metadata
        metadata = {
            'training_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'model_type': 'LogisticRegression',
            'feature_names': self.feature_names,
            'num_features': len(self.feature_names),
            'metrics': metrics,
            'coefficients': self.model.coef_[0].tolist(),
            'intercept': self.model.intercept_[0]
        }
        
        metadata_path = '../models/email_model_metadata.json'
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=4)
        print(f"✅ Metadata saved to: {metadata_path}")
        
        return model_path

def main():
    trainer = EmailModelTrainer()
    
    # Path to your dataset
    dataset_path = '../dataset/email_dataset.csv'
    
    if not os.path.exists(dataset_path):
        print(f"\n❌ Dataset not found at: {dataset_path}")
        print("\nPlease add your Email dataset CSV file with columns:")
        print("   - subject: email subject")
        print("   - body: email body")
        print("   - links: pipe-separated|links|if|any")
        print("   - label: 1 for phishing, 0 for legitimate")
        return
    
    try:
        # Prepare data
        X, y = trainer.load_and_prepare_data(dataset_path)
        
        # Train model
        metrics = trainer.train_model(X, y)
        
        # Save model
        trainer.save_model(metrics)
        
        print("\n" + "="*60)
        print("✅ EMAIL MODEL TRAINING COMPLETED SUCCESSFULLY!")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ Error during training: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()