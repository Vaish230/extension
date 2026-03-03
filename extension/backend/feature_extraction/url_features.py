"""
URL Feature Extraction Module
Matches EXACTLY with your urlFeatures.js + contentScript.js URL rules
"""

import re
import math
from urllib.parse import urlparse
import numpy as np

class URLFeatureExtractor:
    def __init__(self):
        # From urlFeatures.js
        self.suspicious_keywords = [
            'login', 'verify', 'update', 'bank', 'secure', 'account'
        ]
        
        # From contentScript.js URL rules
        self.urgent_words = ['urgent', 'verify', 'suspend', 'limited time', 'click now']
        
    def extract_features(self, url, page_text="", links_count=0):
        """
        Extract all features from URL and page context
        Matches both urlFeatures.js and contentScript.js URL detection
        """
        url = str(url).lower().strip()
        
        # Add protocol if missing for parsing
        url_with_protocol = url
        if not url.startswith(('http://', 'https://')):
            url_with_protocol = 'http://' + url
        
        features = {
            # From urlFeatures.js
            'url_length': self._get_url_length(url),
            'has_ip': self._has_ip_address(url),
            'has_at_symbol': self._has_at_symbol(url),
            'subdomain_count': self._count_subdomains(url_with_protocol),
            'is_https': self._is_https(url),
            'special_char_count': self._count_special_chars(url),
            'has_suspicious_keyword': self._has_suspicious_keyword(url),
            
            # From contentScript.js URL rules
            'has_login_verify': self._has_login_verify(url),
            'has_too_many_links': 1 if links_count > 50 else 0,
            'has_urgent_words': self._has_urgent_words(page_text)
        }
        
        return features
    
    def extract_features_array(self, url, page_text="", links_count=0):
        """Extract features as array for model input"""
        features = self.extract_features(url, page_text, links_count)
        return np.array([
            features['url_length'],
            features['has_ip'],
            features['has_at_symbol'],
            features['subdomain_count'],
            features['is_https'],
            features['special_char_count'],
            features['has_suspicious_keyword'],
            features['has_login_verify'],
            features['has_too_many_links'],
            features['has_urgent_words']
        ])
    
    def _get_url_length(self, url):
        return len(url)
    
    def _has_ip_address(self, url):
        # Check for IPv4 pattern
        ip_pattern = r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}'
        return 1 if re.search(ip_pattern, url) else 0
    
    def _has_at_symbol(self, url):
        return 1 if '@' in url else 0
    
    def _count_subdomains(self, url):
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname or ''
            parts = hostname.split('.')
            # subdomain count = total parts - 2 (domain + TLD)
            return max(0, len(parts) - 2)
        except:
            return 0
    
    def _is_https(self, url):
        return 1 if url.startswith('https') else 0
    
    def _count_special_chars(self, url):
        special_chars = re.findall(r'[-_?=&]', url)
        return len(special_chars)
    
    def _has_suspicious_keyword(self, url):
        url_lower = url.lower()
        for keyword in self.suspicious_keywords:
            if keyword in url_lower:
                return 1
        return 0
    
    def _has_login_verify(self, url):
        url_lower = url.lower()
        return 1 if ('login' in url_lower or 'verify' in url_lower) else 0
    
    def _has_urgent_words(self, text):
        text_lower = text.lower()
        for word in self.urgent_words:
            if word in text_lower:
                return 1
        return 0
    
    def get_feature_names(self):
        return [
            'url_length',
            'has_ip',
            'has_at_symbol',
            'subdomain_count',
            'is_https',
            'special_char_count',
            'has_suspicious_keyword',
            'has_login_verify',
            'has_too_many_links',
            'has_urgent_words'
        ]