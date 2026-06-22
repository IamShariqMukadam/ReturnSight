from pydantic import BaseModel
from typing import List, Optional

class ReviewInput(BaseModel):
    text: str
    rating: int   # 1–5

class PredictRequest(BaseModel):
    title:       str
    description: str
    reviews:     List[ReviewInput]
    price:       float
    image_url:   Optional[str] = None
    category:    Optional[str] = "Clothing_Shoes_and_Jewelry"

class SignalBreakdown(BaseModel):
    image_text_fusion: float
    avg_rating:        float
    one_star_pct:      float
    price_anomaly:     float
    review_mismatch:   float

class PredictResponse(BaseModel):
    return_probability: float
    risk_level:         str          # Low / Medium / High
    signal_breakdown:   SignalBreakdown
    top_reason:         str
    latency_ms:         float
