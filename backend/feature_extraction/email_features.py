"""
Email Feature Extraction Module
Matches EXACTLY with your contentScript.js extractEmailFeatures()
"""

import re
import numpy as np

class EmailFeatureExtractor:
    def __init__(self):
        # From contentScript.js
        self.urgent_words = ['urgent', 'immediately', 'asap', 'action required', 'verify', 'now']
        self.suspicious_words = ['bank', 'password', 'account', 'login', 'update', 'security']
        self.attachment_words = ['invoice', 'attachment', 'pdf', 'document', 'file']
        
    def extract_features(self, subject, body, links=None):
        """
        Extract all features from email
        Matches contentScript.js extractEmailFeatures() EXACTLY
        """
        subject = str(subject or '')
        body = str(body or '')
        links = links or []
        
        email_text = subject + ' ' + body
        email_text_lower = email_text.lower()
        
        features = {
            'email_length': len(email_text),
            'link_count': len(links),
            'urgent_word_count': self._count_urgent_words(email_text_lower),
            'suspicious_keyword_count': self._count_suspicious_words(email_text_lower),
            'capital_ratio': self._calculate_capital_ratio(email_text),
            'exclamation_count': email_text.count('!'),
            'attachment_keyword_count': self._count_attachment_words(email_text_lower)
        }
        
        return features
    
    def extract_features_array(self, subject, body, links=None):
        """Extract features as array for model input"""
        features = self.extract_features(subject, body, links)
        return np.array([
            features['email_length'],
            features['link_count'],
            features['urgent_word_count'],
            features['suspicious_keyword_count'],
            features['capital_ratio'],
            features['exclamation_count'],
            features['attachment_keyword_count']
        ])
    
    def _count_urgent_words(self, text_lower):
        """Count urgent words in text"""
        # Ensure it's a string
        if not isinstance(text_lower, str):
            text_lower = str(text_lower) if text_lower is not None else ''
        
        count = 0
        for word in self.urgent_words:
            if word in text_lower:
                count += 1
        return count

    def _count_suspicious_words(self, text_lower):
        """Count suspicious words in text"""
        # Ensure it's a string
        if not isinstance(text_lower, str):
            text_lower = str(text_lower) if text_lower is not None else ''
        
        count = 0
        for word in self.suspicious_words:
            if word in text_lower:
                count += 1
        return count

    def _count_attachment_words(self, text_lower):
        """Count attachment-related words"""
        # Ensure it's a string
        if not isinstance(text_lower, str):
            text_lower = str(text_lower) if text_lower is not None else ''
        
        count = 0
        for word in self.attachment_words:
            if word in text_lower:
                count += 1
        return count

    def _calculate_capital_ratio(self, text):
        """Calculate ratio of capital letters to total letters"""
        # Ensure it's a string
        if not isinstance(text, str):
            text = str(text) if text is not None else ''
        
        letters = re.findall(r'[a-zA-Z]', text)
        if not letters:
            return 0
        
        capitals = re.findall(r'[A-Z]', text)
        return len(capitals) / len(letters) if len(letters) > 0 else 0
    
    def get_feature_names(self):
        return [
            'email_length',
            'link_count',
            'urgent_word_count',
            'suspicious_keyword_count',
            'capital_ratio',
            'exclamation_count',
            'attachment_keyword_count'
        ]