"""
Email Feature Extraction Module
Matches EXACTLY with urlFeatures.js and contentScript.js
Single source of truth for email feature extraction
"""

import re
import numpy as np
from typing import List, Dict, Any, Optional

class EmailFeatureExtractor:
    """Extract features from emails for phishing detection"""
    
    def __init__(self):
        # Shared configuration (must match urlFeatures.js EXACTLY)
        self.config = {
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
        
        # Compiled regex patterns for performance
        self.url_pattern = re.compile(
            r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
        )
        self.email_pattern = re.compile(r'[\w\.-]+@[\w\.-]+\.\w+')
        self.phone_pattern = re.compile(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}')
        
    def extract_features(self, subject: str, body: str, links: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Extract all features from email
        Matches contentScript.js extractEmailFeatures() EXACTLY
        
        Args:
            subject: Email subject line
            body: Email body content
            links: List of URLs in the email
            
        Returns:
            Dictionary of features
        """
        # Handle None values and convert to strings
        subject = str(subject or '').strip()
        body = str(body or '').strip()
        links = links or []
        
        # Combine subject and body for text analysis
        full_text = f"{subject} {body}".strip()
        full_text_lower = full_text.lower()
        
        # Extract all URLs from text if links not provided
        if not links:
            links = self._extract_urls(full_text)
        
        features = {
            # Basic features
            'email_length': len(full_text),
            'subject_length': len(subject),
            'body_length': len(body),
            'link_count': len(links),
            
            # Word-based features
            'urgent_word_count': self._count_urgent_words(full_text_lower),
            'suspicious_keyword_count': self._count_suspicious_words(full_text_lower),
            'attachment_keyword_count': self._count_attachment_words(full_text_lower),
            
            # Style features
            'capital_ratio': self._calculate_capital_ratio(full_text),
            'exclamation_count': full_text.count('!'),
            'question_count': full_text.count('?'),
            
            # Advanced features
            'has_reply_chain': self._has_reply_chain(subject),
            'has_forward': self._has_forward_indicator(subject),
            'email_count': self._extract_emails(full_text),
            'phone_count': self._extract_phones(full_text),
            'html_ratio': self._calculate_html_ratio(body),
            
            # Link analysis
            'suspicious_link_count': self._count_suspicious_links(links),
            'has_ip_link': self._has_ip_links(links),
            'has_shortened_link': self._has_shortened_links(links),
            'unique_domains': self._count_unique_domains(links)
        }
        
        # Add composite features
        features['risk_score'] = self._calculate_heuristic_score(features)
        
        return features
    
    def extract_features_array(self, subject: str, body: str, links: Optional[List[str]] = None) -> np.ndarray:
        """
        Extract features as array for model input
        Order must match training data EXACTLY
        """
        features = self.extract_features(subject, body, links)
        
        # Order must match train_email_model.py feature order
        return np.array([
            features['email_length'],
            features['link_count'],
            features['urgent_word_count'],
            features['suspicious_keyword_count'],
            features['capital_ratio'],
            features['exclamation_count'],
            features['attachment_keyword_count'],
            features['has_reply_chain'],
            features['has_forward'],
            features['suspicious_link_count'],
            features['has_ip_link'],
            features['has_shortened_link']
        ])
    
    # ===============================
    # Private Feature Extractors
    # ===============================
    
    def _count_urgent_words(self, text_lower: str) -> int:
        """Count urgent words in text"""
        if not isinstance(text_lower, str):
            return 0
        
        count = 0
        for word in self.config['urgent_words']:
            # Word boundary check to avoid partial matches
            pattern = r'\b' + re.escape(word) + r'\b'
            matches = re.findall(pattern, text_lower)
            count += len(matches)
        return count

    def _count_suspicious_words(self, text_lower: str) -> int:
        """Count suspicious words in text"""
        if not isinstance(text_lower, str):
            return 0
        
        count = 0
        for word in self.config['suspicious_words']:
            pattern = r'\b' + re.escape(word) + r'\b'
            matches = re.findall(pattern, text_lower)
            count += len(matches)
        return count

    def _count_attachment_words(self, text_lower: str) -> int:
        """Count attachment-related words"""
        if not isinstance(text_lower, str):
            return 0
        
        count = 0
        for word in self.config['attachment_words']:
            pattern = r'\b' + re.escape(word) + r'\b'
            matches = re.findall(pattern, text_lower)
            count += len(matches)
        return count

    def _calculate_capital_ratio(self, text: str) -> float:
        """Calculate ratio of capital letters to total letters"""
        if not isinstance(text, str) or not text:
            return 0.0
        
        letters = re.findall(r'[a-zA-Z]', text)
        if not letters:
            return 0.0
        
        capitals = re.findall(r'[A-Z]', text)
        return len(capitals) / len(letters)
    
    def _has_reply_chain(self, subject: str) -> int:
        """Check if email is part of reply chain"""
        indicators = ['re:', 'fwd:', 'fw:', '回复', '答复']
        subject_lower = subject.lower()
        return 1 if any(ind in subject_lower for ind in indicators) else 0
    
    def _has_forward_indicator(self, subject: str) -> int:
        """Check if email was forwarded"""
        indicators = ['fwd:', 'fw:', '转发', '转寄']
        subject_lower = subject.lower()
        return 1 if any(ind in subject_lower for ind in indicators) else 0
    
    def _extract_urls(self, text: str) -> List[str]:
        """Extract all URLs from text"""
        return self.url_pattern.findall(text)
    
    def _extract_emails(self, text: str) -> int:
        """Count email addresses in text"""
        return len(self.email_pattern.findall(text))
    
    def _extract_phones(self, text: str) -> int:
        """Count phone numbers in text"""
        return len(self.phone_pattern.findall(text))
    
    def _calculate_html_ratio(self, body: str) -> float:
        """Calculate ratio of HTML tags to text"""
        if not body:
            return 0.0
        
        html_tags = re.findall(r'<[^>]+>', body)
        if not html_tags:
            return 0.0
        
        html_length = sum(len(tag) for tag in html_tags)
        return html_length / len(body) if len(body) > 0 else 0.0
    
    def _count_suspicious_links(self, links: List[str]) -> int:
        """Count suspicious links based on patterns"""
        suspicious = 0
        for link in links:
            link_lower = link.lower()
            
            # Check for suspicious patterns
            if any(word in link_lower for word in ['login', 'verify', 'update', 'secure']):
                suspicious += 1
            elif re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', link_lower):  # IP address
                suspicious += 1
            elif 'bit.ly' in link_lower or 'tinyurl' in link_lower:  # Shortened
                suspicious += 1
            elif link.count('.') > 3:  # Too many subdomains
                suspicious += 1
        
        return suspicious
    
    def _has_ip_links(self, links: List[str]) -> int:
        """Check if any links use IP addresses instead of domains"""
        ip_pattern = re.compile(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}')
        return 1 if any(ip_pattern.search(link) for link in links) else 0
    
    def _has_shortened_links(self, links: List[str]) -> int:
        """Check if any links are URL shorteners"""
        shorteners = [
            'bit.ly', 'tinyurl', 'goo.gl', 'ow.ly', 'is.gd', 
            'buff.ly', 'tiny.cc', 'tr.im', 'cli.gs', 'v.gd'
        ]
        
        for link in links:
            link_lower = link.lower()
            if any(shortener in link_lower for shortener in shorteners):
                return 1
        return 0
    
    def _count_unique_domains(self, links: List[str]) -> int:
        """Count unique domains in links"""
        domains = set()
        for link in links:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(link)
                domain = parsed.netloc
                if domain:
                    domains.add(domain)
            except:
                continue
        return len(domains)
    
    def _calculate_heuristic_score(self, features: Dict[str, Any]) -> float:
        """
        Calculate heuristic risk score based on features
        Used as fallback when ML model is unavailable
        """
        score = 0.0
        
        # Urgent words (max 25)
        if features['urgent_word_count'] > 3:
            score += 25
        elif features['urgent_word_count'] > 1:
            score += 15
            
        # Suspicious keywords (max 20)
        if features['suspicious_keyword_count'] > 5:
            score += 20
        elif features['suspicious_keyword_count'] > 2:
            score += 10
            
        # Links (max 20)
        if features['link_count'] > self.config['max_links']:
            score += 20
        elif features['link_count'] > 5:
            score += 10
            
        # Suspicious links (max 15)
        if features['suspicious_link_count'] > 3:
            score += 15
        elif features['suspicious_link_count'] > 1:
            score += 8
            
        # Capital ratio (max 15)
        if features['capital_ratio'] > self.config['max_capital_ratio']:
            score += 15
            
        # Exclamation marks (max 10)
        if features['exclamation_count'] > self.config['max_exclamations']:
            score += 10
            
        # IP links (max 15)
        if features['has_ip_link']:
            score += 15
            
        # Shortened links (max 10)
        if features['has_shortened_link']:
            score += 10
            
        # Attachment keywords (max 10)
        if features['attachment_keyword_count'] > 2:
            score += 10
            
        # Forward/Reply (reduce score for legitimate patterns)
        if features['has_reply_chain']:
            score -= 5
        if features['has_forward']:
            score -= 5
            
        return min(max(score, 0), 100)
    
    # ===============================
    # Utility Methods
    # ===============================
    
    def get_feature_names(self) -> List[str]:
        """Get list of feature names in order"""
        return [
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
        ]
    
    def get_feature_descriptions(self) -> Dict[str, str]:
        """Get descriptions of each feature for UI"""
        return {
            'email_length': 'Total length of email text',
            'link_count': 'Number of links in email',
            'urgent_word_count': 'Count of urgency-related words',
            'suspicious_keyword_count': 'Count of phishing-related keywords',
            'capital_ratio': 'Ratio of capital letters to total letters',
            'exclamation_count': 'Number of exclamation marks',
            'attachment_keyword_count': 'Count of attachment-related words',
            'has_reply_chain': 'Email is part of a reply chain',
            'has_forward': 'Email was forwarded',
            'suspicious_link_count': 'Number of suspicious links',
            'has_ip_link': 'Contains links with IP addresses',
            'has_shortened_link': 'Contains shortened URLs'
        }
    
    def get_risk_explanations(self, features: Dict[str, Any]) -> List[Dict[str, str]]:
        """Generate user-friendly explanations for detected risks"""
        explanations = []
        
        if features['urgent_word_count'] > self.config['urgent_words']:
            explanations.append({
                'title': 'Urgent Language Detected',
                'description': f"Found {features['urgent_word_count']} urgent words like 'urgent' or 'immediately'. Phishers create false urgency to make you act without thinking.",
                'severity': 'high'
            })
        
        if features['suspicious_keyword_count'] > 3:
            explanations.append({
                'title': 'Suspicious Keywords',
                'description': f"Found {features['suspicious_keyword_count']} security-related terms. Legitimate companies rarely ask for passwords or account details via email.",
                'severity': 'high'
            })
        
        if features['capital_ratio'] > self.config['max_capital_ratio']:
            explanations.append({
                'title': 'Excessive Capitalization',
                'description': f"{features['capital_ratio']*100:.0f}% of text is in CAPITALS. Professional communication rarely uses excessive caps.",
                'severity': 'medium'
            })
        
        if features['exclamation_count'] > self.config['max_exclamations']:
            explanations.append({
                'title': 'Multiple Exclamation Marks',
                'description': f"{features['exclamation_count']} exclamation marks found! This is a common tactic to create excitement or urgency in scam messages.",
                'severity': 'medium'
            })
        
        if features['link_count'] > self.config['max_links']:
            explanations.append({
                'title': 'Too Many Links',
                'description': f"Email contains {features['link_count']} links. Phishing emails often include multiple links to increase click-through rates.",
                'severity': 'medium'
            })
        
        if features['suspicious_link_count'] > 0:
            explanations.append({
                'title': 'Suspicious Links',
                'description': f"Found {features['suspicious_link_count']} suspicious links containing phishing indicators or IP addresses.",
                'severity': 'high'
            })
        
        if features['has_ip_link']:
            explanations.append({
                'title': 'IP-based Links',
                'description': 'Email contains links using IP addresses instead of domain names. Legitimate companies use branded domains.',
                'severity': 'high'
            })
        
        if features['has_shortened_link']:
            explanations.append({
                'title': 'Shortened URLs',
                'description': 'Email uses URL shorteners which can hide the true destination. Hover over links to see real addresses.',
                'severity': 'medium'
            })
        
        if features['attachment_keyword_count'] > 2:
            explanations.append({
                'title': 'Attachment Keywords',
                'description': f"Found {features['attachment_keyword_count']} words related to attachments. Be very careful with unexpected attachments.",
                'severity': 'high'
            })
        
        return explanations
    
    def validate_features(self, features: Dict[str, Any]) -> bool:
        """Validate that all required features are present"""
        required = self.get_feature_names()
        missing = [f for f in required if f not in features]
        
        if missing:
            print(f"⚠️ Missing features: {missing}")
            return False
        return True
    
    def normalize_features(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize features to consistent ranges for ML"""
        normalized = features.copy()
        
        # Normalize length-based features
        normalized['email_length'] = min(features['email_length'] / 5000, 1.0)
        normalized['link_count'] = min(features['link_count'] / 20, 1.0)
        normalized['urgent_word_count'] = min(features['urgent_word_count'] / 10, 1.0)
        normalized['suspicious_keyword_count'] = min(features['suspicious_keyword_count'] / 15, 1.0)
        normalized['exclamation_count'] = min(features['exclamation_count'] / 10, 1.0)
        normalized['attachment_keyword_count'] = min(features['attachment_keyword_count'] / 8, 1.0)
        normalized['suspicious_link_count'] = min(features['suspicious_link_count'] / 5, 1.0)
        
        return normalized


# ===============================
# Factory function for easy import
# ===============================

def create_email_extractor() -> EmailFeatureExtractor:
    """Create and return an EmailFeatureExtractor instance"""
    return EmailFeatureExtractor()


# ===============================
# Standalone test function
# ===============================

def test_extractor():
    """Test the feature extractor with sample data"""
    extractor = create_email_extractor()
    
    # Test with legitimate email
    legit_email = {
        'subject': 'Meeting tomorrow',
        'body': 'Hi team, just a reminder about our meeting tomorrow at 10am. Best, John',
        'links': ['https://company.com/calendar']
    }
    
    # Test with phishing email
    phishing_email = {
        'subject': 'URGENT: Your account will be suspended!!!',
        'body': 'Dear customer, your account has been compromised. Click here to verify immediately: http://192.168.1.1/login',
        'links': ['http://192.168.1.1/login', 'http://bit.ly/fake-link']
    }
    
    print("="*60)
    print("📧 EMAIL FEATURE EXTRACTOR TEST")
    print("="*60)
    
    print("\n✅ Legitimate Email Features:")
    legit_features = extractor.extract_features(**legit_email)
    for name, value in legit_features.items():
        print(f"   {name:25s}: {value}")
    
    print(f"\n🔴 Heuristic Score: {legit_features['risk_score']:.1f}/100")
    
    print("\n" + "-"*60)
    
    print("\n⚠️ Phishing Email Features:")
    phishing_features = extractor.extract_features(**phishing_email)
    for name, value in phishing_features.items():
        print(f"   {name:25s}: {value}")
    
    print(f"\n🔴 Heuristic Score: {phishing_features['risk_score']:.1f}/100")
    
    print("\n📊 Feature Names:")
    for i, name in enumerate(extractor.get_feature_names()):
        print(f"   {i:2d}. {name}")
    
    print("\n" + "="*60)


if __name__ == "__main__":
    test_extractor()