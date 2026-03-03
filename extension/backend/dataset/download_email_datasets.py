"""
Script to download and prepare email datasets
"""

import os
import pandas as pd
import requests
import tarfile
import email
from email import policy
from email.parser import BytesParser

def download_spamassassin():
    """Download SpamAssassin corpus"""
    print("📥 Downloading SpamAssassin corpus...")
    
    urls = [
        "https://spamassassin.apache.org/old/publiccorpus/20021010_easy_ham.tar.bz2",
        "https://spamassassin.apache.org/old/publiccorpus/20021010_hard_ham.tar.bz2",
        "https://spamassassin.apache.org/old/publiccorpus/20021010_spam.tar.bz2"
    ]
    
    for url in urls:
        try:
            filename = url.split('/')[-1]
            print(f"   Downloading {filename}...")
            response = requests.get(url, stream=True)
            if response.status_code == 200:
                with open(filename, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                print(f"   ✅ Downloaded {filename}")
        except Exception as e:
            print(f"   ❌ Failed to download {url}: {e}")

def extract_spamassassin():
    """Extract emails from SpamAssassin corpus"""
    print("\n🛠️ Extracting SpamAssassin emails...")
    
    data = []
    
    # Process each tar file
    tar_files = ['20021010_easy_ham.tar.bz2', '20021010_hard_ham.tar.bz2', '20021010_spam.tar.bz2']
    
    for tar_file in tar_files:
        if not os.path.exists(tar_file):
            print(f"⚠️  {tar_file} not found, skipping...")
            continue
        
        # Determine label
        if 'spam' in tar_file:
            label = 1
            folder = 'spam'
        else:
            label = 0
            folder = 'ham'
        
        print(f"   Processing {folder} emails...")
        
        # Extract tar
        try:
            import bz2
            import tarfile
            
            with bz2.open(tar_file) as bz_file:
                with tarfile.open(fileobj=bz_file) as tar:
                    tar.extractall(path='temp_emails')
                    
                    # Read each email
                    email_files = os.listdir('temp_emails')
                    count = 0
                    
                    for email_file in email_files[:1000]:  # Limit to 1000 per category
                        try:
                            filepath = os.path.join('temp_emails', email_file)
                            with open(filepath, 'rb') as f:
                                msg = BytesParser(policy=policy.default).parse(f)
                                
                                # Extract subject and body
                                subject = msg.get('subject', '')
                                
                                # Get body
                                body = ""
                                if msg.is_multipart():
                                    for part in msg.walk():
                                        if part.get_content_type() == 'text/plain':
                                            body = part.get_content()
                                            break
                                else:
                                    body = msg.get_content()
                                
                                # Extract links (simple extraction)
                                import re
                                links = re.findall(r'https?://[^\s<>"]+|www\.[^\s<>"]+', body)
                                links_str = '|'.join(links[:5])  # Limit to 5 links
                                
                                data.append({
                                    'subject': subject,
                                    'body': body[:1000],  # Limit body length
                                    'links': links_str,
                                    'label': label
                                })
                                count += 1
                        except Exception as e:
                            continue
                    
                    print(f"      Extracted {count} emails")
                    
                    # Cleanup
                    import shutil
                    shutil.rmtree('temp_emails')
                    
        except Exception as e:
            print(f"      ❌ Error processing {tar_file}: {e}")
    
    return pd.DataFrame(data)

def create_email_dataset_from_spamassassin():
    """Create email dataset from SpamAssassin"""
    print("\n🤝 Creating email dataset...")
    
    # Download if not exists
    if not any(os.path.exists(f) for f in ['20021010_easy_ham.tar.bz2', '20021010_spam.tar.bz2']):
        download_spamassassin()
    
    # Extract and create dataset
    df = extract_spamassassin()
    
    if len(df) > 0:
        # Save to CSV
        output_path = 'email_dataset.csv'
        df.to_csv(output_path, index=False)
        print(f"\n✅ Email dataset saved to {output_path}")
        print(f"   Total samples: {len(df)}")
        print(f"   Phishing: {len(df[df['label']==1])}")
        print(f"   Legitimate: {len(df[df['label']==0])}")
        
        # Show sample
        print("\n📊 Sample data:")
        print(df.head())
        
        return df
    else:
        print("❌ Failed to create email dataset")
        return None

def create_fallback_email_dataset():
    """Create a small fallback email dataset"""
    print("\n⚠️  Creating fallback email dataset...")
    
    data = [
        # Phishing emails
        {'subject': 'URGENT: Your account will be suspended', 
         'body': 'Dear customer, your account will be suspended in 24 hours. Click here to verify: http://phishing.com', 
         'links': 'http://phishing.com', 
         'label': 1},
        
        {'subject': 'Verify Your PayPal Account Immediately', 
         'body': 'We noticed unusual activity. Verify now: http://paypal-verify.com', 
         'links': 'http://paypal-verify.com', 
         'label': 1},
        
        {'subject': 'You have won $1,000,000!!!', 
         'body': 'Congratulations! You are the lucky winner. Claim your prize now! http://bit.ly/prize', 
         'links': 'http://bit.ly/prize', 
         'label': 1},
        
        {'subject': 'Security Alert: New Login', 
         'body': 'A new device logged into your account. If this wasn\'t you, click here: http://secure-alert.com', 
         'links': 'http://secure-alert.com', 
         'label': 1},
        
        {'subject': 'Your Netflix Account Is On Hold', 
         'body': 'We couldn\'t charge your card. Update payment: http://netflix-billing.com', 
         'links': 'http://netflix-billing.com', 
         'label': 1},
        
        # Legitimate emails
        {'subject': 'Your Amazon Order Confirmation', 
         'body': 'Thank you for your order. Your package will arrive tomorrow.', 
         'links': '', 
         'label': 0},
        
        {'subject': 'Weekly Team Meeting', 
         'body': 'Please join us for the weekly sync at 2pm.', 
         'links': '', 
         'label': 0},
        
        {'subject': 'Newsletter: This Week in Tech', 
         'body': 'Here are the top stories from this week.', 
         'links': 'https://technews.com/story1|https://technews.com/story2', 
         'label': 0},
        
        {'subject': 'Project Update', 
         'body': 'The project is on schedule for Friday\'s deadline.', 
         'links': '', 
         'label': 0},
        
        {'subject': 'Lunch Menu', 
         'body': 'Check out this week\'s cafeteria menu.', 
         'links': '', 
         'label': 0},
    ]
    
    df = pd.DataFrame(data)
    output_path = 'email_dataset.csv'
    df.to_csv(output_path, index=False)
    
    print(f"✅ Fallback email dataset created with {len(df)} samples")
    return df

if __name__ == "__main__":
    print("="*60)
    print("📊 EMAIL DATASET PREPARATION")
    print("="*60)
    
    # Try to create dataset from SpamAssassin
    df = create_email_dataset_from_spamassassin()
    
    # If failed, create fallback
    if df is None or len(df) < 10:
        print("\n⚠️  SpamAssassin download failed, creating fallback dataset")
        df = create_fallback_email_dataset()
    
    print("\n✅ Dataset preparation complete!")