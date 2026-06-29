<div align="center">

<img src="public/og-image.png" alt="ReturnSight" width="100%"/>

# ⟁ ReturnSight

**610,879 products. No sampling. One model that reads listings like a buyer does.**

[![AUC-ROC](https://img.shields.io/badge/AUC--ROC-0.7966-FF5C1A?style=for-the-badge)](/)
[![Dataset](https://img.shields.io/badge/Products-610K-7C3AED?style=for-the-badge)](/)
[![Return Rate](https://img.shields.io/badge/Return_Rate-22.32%25-EC4899?style=for-the-badge)](/)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](/)
[![React](https://img.shields.io/badge/UI-React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](/)

> *Paste a product listing. Get the return probability before you scale ad spend.*

[**Live Demo →**](https://returnsight.vercel.app) &nbsp;·&nbsp; [**API Docs →**](https://api.returnsight.com/docs)

</div>

---

## ⚡ What It Does

```
Seller pastes title + description + reviews + price
                        ↓
        ReturnSight reads it like a buyer would
                        ↓
         return_probability: 0.73  →  🔴 HIGH RISK
         top_reason: "1-star rate above 25% threshold"
         signal_breakdown: { avg_rating, one_star_pct, price_anomaly, ... }
```

---

## 🏗️ Pipeline — 5 Days, End to End

| Day | Stage | What Actually Happened |
|-----|-------|----------------------|
| **1** | EDA & Labeling | Streamed 133 review chunks + 15 metadata chunks — no dataset ever held in RAM |
| **2** | Embeddings | CLIP for images (512-dim) + MiniLM for text (384-dim) — with a non-obvious pooling fix |
| **3** | Fusion + Model | PyTorch attention fusion → LightGBM on 136 features, tuned with Optuna (50 trials) |
| **4** | Explainability | SHAP TreeExplainer — per-prediction signal breakdown, threshold sweep 0.30→0.80 |
| **5** | API | FastAPI — validated to 4 decimal places against offline predictions |

---

## 📊 Dataset

```
McAuley-Lab/Amazon-Reviews-2023  →  Clothing_Shoes_and_Jewelry
```

| Filter Applied | Reason |
|---|---|
| Verified purchases only | Remove noise |
| Review text > 10 chars | Remove junk |
| ≥ 5 reviews per product | Statistical floor |
| Valid description + image metadata | Multimodal pipeline requirement |

```
Before filters: ~29M reviews
After filters:  610,879 products

Label distribution:
  🔴 Likely Return   136,329  (22.32%)
  🟢 No Return       474,550  (77.68%)

CLIP image coverage: 586,524 / 610,879  →  96.0%
```

---

## 🏷️ Label Engineering — Rate, Not Count

The naive approach counts return-language mentions per product.  
**The problem:** 15 mentions in 1,000 reviews (1.5%) looks riskier than 10 in 50 (20%).

```python
# Wrong
likely_return = return_mention_count > threshold       # biased toward high-volume products

# Right  
likely_return = (return_mention_count / total_reviews) >= 0.02  # scale-invariant rate
```

Regex matched against **full review text**, not sampled — every mention captured regardless of position.

---

## 🔤 Embedding Design — The Pooling Fix

`all-MiniLM-L6-v2` has a **256-token hard limit**.

```
❌ Naive:  [review1 + review2 + review3 + ...]  →  truncate at 256 tokens
           → Reviews 4–30 silently discarded

✅ Ours:   encode(review1) → 384-dim
           encode(review2) → 384-dim
           ...
           encode(review30) → 384-dim
           mean_pool + renormalize → 1 × 384-dim
           → All 30 reviews contribute equally
```

Also computed: `review_desc_mismatch = 1 − cosine_similarity(desc_emb, review_emb)`  
→ Quantifies how much buyer experience diverges from seller claims.  
→ Mean: `0.4957` | Range: `0.1550 – 1.1036`

---

## 🧠 Attention Fusion — Learned Weights, Not Guessed

Three modalities. Instead of hardcoding how much each matters — the model learns it.

```
image_emb  (512→64 PCA→128 proj) ─┐
text_emb   (384→64 PCA→128 proj) ─┼──► softmax attention ──► 128-dim fused vector
tabular    (8 features → 128 proj)─┘

Final input to LightGBM:  fused(128) + raw_tabular(8)  =  136 features
```

**What the model decided:**

```
📷 Image      ████░░░░░░░░░░░░░░░░  13.2%
📝 Text       ██████████████████░░  49.8%   ← buyer language dominates
📈 Tabular    ██████████████░░░░░░  37.0%   ← ratings + price signal
```

> Images are the weakest signal for clothing. A product photo doesn't tell you it runs 2 sizes small.

---

## 📈 Results

| Metric | Score |
|--------|-------|
| **AUC-ROC** | **0.7966** |
| **Average Precision** | **0.5625** |
| No-Return Precision | 0.90 |
| No-Return Recall | 0.73 |
| Likely-Return Precision | 0.43 |
| Likely-Return Recall | 0.70 |

Pre-tuning (Optuna 50 trials): `0.7947 AUC / 0.5597 AP`  
Post-tuning: `0.7966 AUC / 0.5625 AP`

---

## 🔌 API

```
GET  /health
POST /predict
```

**Request**
```json
{
  "title": "Women's Floral Midi Dress",
  "description": "Lightweight chiffon, true to size...",
  "reviews": [{ "text": "Runs 2 sizes small, returned it.", "rating": 1 }],
  "price": 34.99,
  "image_url": "https://...",
  "category": "Clothing_Shoes_and_Jewelry"
}
```

**Response**
```json
{
  "return_probability": 0.73,
  "risk_level": "High",
  "signal_breakdown": {
    "image_text_fusion": 0.18,
    "avg_rating": 0.31,
    "one_star_pct": 0.67,
    "price_anomaly": 0.12,
    "review_mismatch": 0.44
  },
  "top_reason": "1-star rate above 25% threshold",
  "latency_ms": 214
}
```

Risk thresholds: `Low < 0.35` · `Medium < 0.65` · `High ≥ 0.65`

---

## ✅ Serving Validation

> The hardest part isn't training. It's making sure serving produces the same number.

- ✅ Same mean-pool + renormalize as training (not a shortcut path)
- ✅ `price_anomaly` from 32-category lookup table, not a global median  
- ✅ CLIP extracted via `vision_model → visual_projection` (the high-level path crashes on this transformers version)
- ✅ Validated on **15 real held-out products** across full probability range
- ✅ Several predictions **exact to 4 decimal places**
- ✅ **Zero risk-category flips**

---

## 🏛️ Infrastructure

| Day | Instance | Why |
|-----|----------|-----|
| Day 1 | AWS EC2 `m6i.2xlarge` (CPU) | Streaming EDA — no GPU needed |
| Days 2–5 | AWS EC2 `g4dn.xlarge` (T4 GPU) | CLIP embeddings + model training |

Jobs ran unattended via `tmux`. Checkpointed at every major step.

---

## 🚧 Honest Limitations

| Limitation | Details |
|---|---|
| Proxy label | Return-language in reviews ≠ actual logistics return data |
| Image ceiling | CLIP at 13.2% weight — don't oversell it for this category |
| Static price lookup | Needs periodic refresh as category prices shift |
| AUC ceiling | ~0.80 is the honest limit without real return/fit data from Amazon |

---

## 🗂️ Structure

```
ReturnSight/
├── api/
│   ├── main.py              FastAPI app
│   ├── inference.py         Full inference pipeline
│   ├── model_loader.py      Loads artifacts on startup
│   └── schemas.py           Pydantic models
├── day1_eda_labeling.py     Chunked streaming + label engineering
├── day2_embeddings.py       CLIP + MiniLM embeddings
├── day3_fusion_lgbm.py      Attention fusion + LightGBM + Optuna
├── day4_explainability.py   SHAP + threshold sweep
├── returnsight-frontend/    React 18 + Vite frontend
└── models/                  Trained artifacts (Git LFS)
```

---

## 🚀 Quick Start

```bash
# Backend
cd api && pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend
cd returnsight-frontend
cp .env.example .env.local   # set VITE_API_URL
npm install && npm run dev
```

---

<div align="center">

Built by **Shariq Mukadam** · BCA, Bharati Vidyapeeth University, Pune

[GitHub](https://github.com/IamShariqMukadam) · [LinkedIn](https://linkedin.com/in/shariqmukadam) · [Live Demo](https://returnsight.vercel.app)

</div>
