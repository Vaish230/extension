"""
Script to download and prepare URL datasets
Run this script to automatically download and format datasets
"""

import os
import pandas as pd
import requests
import zipfile
import io
import csv
from urllib.parse import urlparse

def download_phishtank():
    """Download phishing URLs from PhishTank"""
    print("📥 Downloading PhishTank dataset...")
    
    url = "https://data.phishtank.com/data/online-valid.csv"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            with open('phishtank_raw.csv', 'wb') as f:
                f.write(response.content)
            print("✅ PhishTank downloaded successfully")
            return True
    except Exception as e:
        print(f"❌ Failed to download PhishTank: {e}")
        return False

def download_kaggle_dataset(dataset_name):
    """
    Instructions for Kaggle datasets:
    You need to manually download from Kaggle website
    """
    print("\n" + "="*60)
    print("📌 MANUAL DOWNLOAD REQUIRED FOR KAGGLE")
    print("="*60)
    print(f"Please download from: https://www.kaggle.com/datasets/{dataset_name}")
    print("Place the downloaded file in the current directory")
    return input("Press Enter when downloaded...")

def create_url_dataset_from_phishtank():
    """Convert PhishTank data to our format"""
    print("\n🛠️ Creating URL dataset from PhishTank...")
    
    try:
        # Read PhishTank CSV
        df = pd.read_csv('phishtank_raw.csv')
        
        # Extract URLs and label as phishing (1)
        phishing_urls = df['url'].tolist()
        
        # Create dataframe
        data = []
        for url in phishing_urls[:10000]:  # Limit to 10,000 for balance
            data.append({
                'url': url,
                'page_text': '',
                'links_count': 0,
                'label': 1
            })
        
        df_phishing = pd.DataFrame(data)
        print(f"✅ Extracted {len(df_phishing)} phishing URLs")
        return df_phishing
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def create_legitimate_url_dataset():
    """Create legitimate URLs from Alexa top sites or Common Crawl"""
    print("\n🛠️ Creating legitimate URL dataset...")
    
    # List of common legitimate domains
    legitimate_domains = [
        'google.com', 'facebook.com', 'amazon.com', 'apple.com',
        'microsoft.com', 'github.com', 'stackoverflow.com', 'wikipedia.org',
        'youtube.com', 'twitter.com', 'linkedin.com', 'netflix.com',
        'paypal.com', 'bankofamerica.com', 'wellsfargo.com', 'chase.com',
        'dropbox.com', 'adobe.com', 'wordpress.com', 'medium.com'
    ]
    
    # Generate common paths
    paths = ['', '/', '/login', '/signin', '/help', '/about', '/contact',
             '/products', '/services', '/support', '/blog', '/news']
    
    data = []
    for domain in legitimate_domains:
        for path in paths[:3]:  # Limit to 3 paths per domain
            url = f"https://www.{domain}{path}"
            data.append({
                'url': url,
                'page_text': '',
                'links_count': 50,  # Average legitimate site has many links
                'label': 0
            })
    
    # Add some HTTP versions
    for domain in legitimate_domains[:10]:
        url = f"http://www.{domain}"
        data.append({
            'url': url,
            'page_text': '',
            'links_count': 40,
            'label': 0
        })
    
    df_legit = pd.DataFrame(data)
    print(f"✅ Created {len(df_legit)} legitimate URLs")
    return df_legit

def combine_url_datasets():
    """Combine phishing and legitimate URLs"""
    print("\n🤝 Combining URL datasets...")
    
    # Get phishing URLs
    df_phish = create_url_dataset_from_phishtank()
    
    # Get legitimate URLs
    df_legit = create_legitimate_url_dataset()
    
    if df_phish is not None and df_legit is not None:
        # Balance the datasets
        min_count = min(len(df_phish), len(df_legit))
        df_phish = df_phish.sample(n=min_count, random_state=42)
        df_legit = df_legit.sample(n=min_count, random_state=42)
        
        # Combine
        df_final = pd.concat([df_phish, df_legit], ignore_index=True)
        
        # Shuffle
        df_final = df_final.sample(frac=1, random_state=42).reset_index(drop=True)
        
        # Save
        output_path = 'url_dataset.csv'
        df_final.to_csv(output_path, index=False)
        print(f"✅ Final dataset saved to {output_path}")
        print(f"   Total samples: {len(df_final)}")
        print(f"   Phishing: {len(df_final[df_final['label']==1])}")
        print(f"   Legitimate: {len(df_final[df_final['label']==0])}")
        
        return df_final
    else:
        print("❌ Failed to create dataset")
        return None

if __name__ == "__main__":
    print("="*60)
    print("📊 URL DATASET PREPARATION")
    print("="*60)
    
    # Download PhishTank data
    if download_phishtank():
        # Create combined dataset
        combine_url_datasets()
    else:
        print("\n⚠️  Using fallback: Creating dataset from built-in lists")
        df_legit = create_legitimate_url_dataset()
        # Create some fake phishing URLs for fallback
        fake_phish = [
            {'url': 'http://paypal-verify-login.com', 'page_text': '', 'links_count': 2, 'label': 1},
            {'url': 'http://secure-update-bank.com', 'page_text': '', 'links_count': 3, 'label': 1},
            {'url': 'http://amazon-account-suspended.com', 'page_text': '', 'links_count': 4, 'label': 1},
            {'url': 'http://apple-id-verify.com', 'page_text': '', 'links_count': 1, 'label': 1},
            {'url': 'http://netflix-billing-update.com', 'page_text': '', 'links_count': 2, 'label': 1},
        ]
        df_phish = pd.DataFrame(fake_phish)
        
        df_final = pd.concat([df_phish, df_legit], ignore_index=True)
        df_final.to_csv('url_dataset.csv', index=False)
        print(f"✅ Fallback dataset created with {len(df_final)} samples")