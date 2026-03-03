"""
Request Schemas for API Validation
"""

from pydantic import BaseModel
from typing import Optional, List

class URLPredictRequest(BaseModel):
    """Request schema for URL prediction"""
    url: str
    page_text: Optional[str] = ""
    links_count: Optional[int] = 0
    return_features: Optional[bool] = False

class EmailPredictRequest(BaseModel):
    """Request schema for Email prediction"""
    subject: str = ""
    body: str = ""
    links: Optional[List[str]] = []
    return_features: Optional[bool] = False

class HealthResponse(BaseModel):
    status: str
    version: str
    models_loaded: dict
    timestamp: str

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    status_code: int