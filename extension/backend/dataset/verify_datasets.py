"""
Script to verify datasets are ready for training
"""

import pandas as pd
import os

def verify_url_dataset():
    """Check URL dataset"""
    print("\n" + "="*60)
    print("🔍 VERIFYING URL DATASET")
    print("="*60)
    
    if not os.path.exists('url_dataset.csv'):
        print("❌ url_dataset.csv not found!")
        print("   Run: python download_url_datasets.py")
        return False
    
    try:
        df = pd.read_csv('url_dataset.csv')
        print(f"✅ File found: url_dataset.csv")
        print(f"   Shape: {df.shape}")
        print(f"   Columns: {df.columns.tolist()}")
        
        # Check required columns
        required = ['url', 'label']
        missing = [col for col in required if col not in df.columns]
        if missing:
            print(f"❌ Missing columns: {missing}")
            return False
        
        # Check class distribution
        phishing = len(df[df['label'] == 1])
        legit = len(df[df['label'] == 0])
        print(f"   Phishing samples: {phishing}")
        print(f"   Legitimate samples: {legit}")
        
        if phishing == 0 or legit == 0:
            print("❌ Dataset must contain both phishing and legitimate samples!")
            return False
        
        # Show sample
        print("\n📊 Sample URLs:")
        print(df[['url', 'label']].head())
        
        return True
        
    except Exception as e:
        print(f"❌ Error reading dataset: {e}")
        return False

def verify_email_dataset():
    """Check email dataset"""
    print("\n" + "="*60)
    print("🔍 VERIFYING EMAIL DATASET")
    print("="*60)
    
    if not os.path.exists('email_dataset.csv'):
        print("❌ email_dataset.csv not found!")
        print("   Run: python download_email_datasets.py")
        return False
    
    try:
        df = pd.read_csv('email_dataset.csv')
        print(f"✅ File found: email_dataset.csv")
        print(f"   Shape: {df.shape}")
        print(f"   Columns: {df.columns.tolist()}")
        
        # Check required columns
        required = ['subject', 'body', 'links', 'label']
        missing = [col for col in required if col not in df.columns]
        if missing:
            print(f"❌ Missing columns: {missing}")
            return False
        
        # Check class distribution
        phishing = len(df[df['label'] == 1])
        legit = len(df[df['label'] == 0])
        print(f"   Phishing samples: {phishing}")
        print(f"   Legitimate samples: {legit}")
        
        if phishing == 0 or legit == 0:
            print("❌ Dataset must contain both phishing and legitimate samples!")
            return False
        
        # Show sample
        print("\n📊 Sample emails:")
        print(df[['subject', 'label']].head())
        
        return True
        
    except Exception as e:
        print(f"❌ Error reading dataset: {e}")
        return False

def main():
    """Main verification"""
    print("📊 DATASET VERIFICATION")
    print("="*60)
    
    url_ok = verify_url_dataset()
    email_ok = verify_email_dataset()
    
    print("\n" + "="*60)
    print("📋 SUMMARY")
    print("="*60)
    print(f"URL Dataset:   {'✅ READY' if url_ok else '❌ NOT READY'}")
    print(f"Email Dataset: {'✅ READY' if email_ok else '❌ NOT READY'}")
    
    if not url_ok or not email_ok:
        print("\n📌 Next steps:")
        if not url_ok:
            print("   1. Run: python download_url_datasets.py")
        if not email_ok:
            print("   2. Run: python download_email_datasets.py")
        print("   3. Then run verify_datasets.py again")
    else:
        print("\n✅ Both datasets are ready for training!")
        print("\n📌 Next step:")
        print("   Run training scripts:")
        print("   cd ../training")
        print("   python train_url_model.py")
        print("   python train_email_model.py")

if __name__ == "__main__":
    main()