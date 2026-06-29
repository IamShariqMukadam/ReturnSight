<div align="center">

<img src="public/og-image.png" alt="ReturnSight" width="100%"/>

# ⟁ ReturnSight

**Multi-modal ML system that predicts e-commerce return risk from product listings + reviews.**  
**Built end-to-end on 66M Amazon reviews. No sampling. No shortcuts.**

[![AUC-ROC](https://img.shields.io/badge/AUC--ROC-0.8302-FF5C1A?style=for-the-badge)](/)
[![Avg Precision](https://img.shields.io/badge/Avg_Precision-0.7022-FF5C1A?style=for-the-badge)](/)
[![Products](https://img.shields.io/badge/Products-611K-7C3AED?style=for-the-badge)](/)
[![Reviews](https://img.shields.io/badge/Reviews-66M-7C3AED?style=for-the-badge)](/)
[![Return Rate](https://img.shields.io/badge/Return_Rate-27%25-EC4899?style=for-the-badge)](/)
[![Latency](https://img.shields.io/badge/Inference-<500ms_CPU-22C55E?style=for-the-badge)](/)

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

## 📊 Results

| Metric | Value |
|---|---|
| Test AUC-ROC | **0.8302** |
| Average Precision | **0.7022** |
| Training data | 66M Amazon reviews (Clothing, Shoes & Jewelry) |
| Unique products | ~611K |
| Return rate in training | 27% |
| CLIP image coverage | ~96% |
| Inference latency | <500ms (CPU) |

---

## 🏗️ Architecture

```
Product Listing Input
│
├── Title + Description ──► sentence-transformer (all-MiniLM-L6-v2) ──► 384-dim desc_emb
├── Customer Reviews    ──► sentence-transformer (mean-pool) ──────────► 384-dim review_emb
│                                                                         │
│    review_desc_mismatch = 1 - cosine_sim(desc_emb, review_emb) ◄───────┘
│
├── Product Image URL   ──► CLIP ViT-B/32 ──► 512-dim image_emb
│
└── Tabular Features    ──► [avg_rating, one_star_pct, five_star_pct,
                             rating_std, log_review_count, price_anomaly,
                             review_desc_mismatch, has_clip]

         ↓ PCA (→64-dim each)          ↓ StandardScaler
  [clip_64] [text_64] [tab_8]
         ↓
  PyTorch Attention Fusion Layer
  (learned weights per modality)
         ↓
  128-dim fused representation
         ↓
  concat with raw tab_8  →  136-dim feature vector
         ↓
  LightGBM Classifier (Optuna-tuned, 50 trials)
         ↓
  Return Probability (0–100%)
         ↓
  SHAP TreeExplainer → signal attribution
         ↓
  FastAPI /predict response
```

---

## 🧠 Key Engineering Decisions

### Label Engineering — Rate, Not Count

```python
# ❌ Naive — biased toward high-review-volume products
likely_return = return_mention_count > N
# 15/1000 reviews (1.5%) looks riskier than 10/50 (20%) — wrong

# ✅ Ours — scale-invariant
likely_return = (return_mention_count / total_reviews) >= 0.02
# 15/1000 = 1.5% → safe     10/50 = 20% → flagged  ✓
```

Regex matched against **full review text** — every mention captured regardless of position.

### Review Encoding — Per-Review Pool, Not Truncate

```
❌ Concat → truncate at 256 tokens:  reviews 4–30 silently gone

✅ Ours:
   encode(rev1) → 384-dim ┐
   encode(rev2) → 384-dim ├── mean pool → renormalize → 1×384-dim
   encode(revN) → 384-dim ┘   all reviews contribute equally (up to 30)
```

### Learned Attention — Not Hardcoded Weights

```
📷 Image    ████░░░░░░░░░░░░░░░░  13.2%   (CLIP weak for clothing — photos don't show fit issues)
📝 Text     ██████████████████░░  49.8%   (buyer language dominates)
📈 Tabular  ██████████████░░░░░░  37.0%   (star ratings + price anomaly carry real weight)
```

The model confirmed this post-hoc — weights were never hand-tuned.

### Streaming — Full Dataset, Zero RAM Overflow

```
133 review chunks (500K rows each) + 15 metadata chunks
→ streamed, merged, checkpointed — nothing held fully in memory
→ per-product accumulators handle reviews split across multiple chunks
```

### Inference Parity — Training ≡ Serving

| Component | Training | Serving |
|---|---|---|
| Review encoding | Per-review pool → renormalize | ✅ Identical |
| `price_anomaly` | 32-category median lookup | ✅ Same table |
| CLIP extraction | `vision_model → visual_projection` | ✅ Same path |
| PCA transforms | Fit on training data | ✅ Serialized + loaded |

Validated on 15 held-out products → several predictions **exact to 4 decimal places** · **zero risk-category flips**

---

## 🔌 API

```
GET  /health   →  { status, models_loaded }
POST /predict  →  { return_probability, risk_level, signal_breakdown, top_reason, latency_ms }
```

**Request**
```json
{
  "title": "Women's Floral Midi Dress",
  "description": "Lightweight chiffon, true to size...",
  "reviews": [{ "text": "Runs 2 sizes small, returned it.", "rating": 1 }],
  "price": 34.99,
  "image_url": "https://example.com/image.jpg",
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

`Low < 0.35` · `Medium < 0.65` · `High ≥ 0.65`

---

## 🛠️ Tech Stack

### ML / Backend

| Component | Technology |
|---|---|
| Embeddings | ![CLIP](https://img.shields.io/badge/CLIP-ViT--B%2F32-FF5C1A?style=flat-square) ![MiniLM](https://img.shields.io/badge/MiniLM-L6--v2-7C3AED?style=flat-square) |
| Dimensionality Reduction | ![PCA](https://img.shields.io/badge/PCA-scikit--learn-F7931E?style=flat-square&logo=scikitlearn&logoColor=white) |
| Fusion Model | ![PyTorch](https://img.shields.io/badge/PyTorch-Attention_Layer-EE4C2C?style=flat-square&logo=pytorch&logoColor=white) |
| Classifier | ![LightGBM](https://img.shields.io/badge/LightGBM-Classifier-2980b9?style=flat-square) |
| Explainability | ![SHAP](https://img.shields.io/badge/SHAP-TreeExplainer-FF6B6B?style=flat-square) |
| Hyperparameter Tuning | ![Optuna](https://img.shields.io/badge/Optuna-TPE_50_trials-7E57C2?style=flat-square) |
| API | ![FastAPI](https://img.shields.io/badge/FastAPI-Uvicorn-009688?style=flat-square&logo=fastapi&logoColor=white) |
| Data Processing | ![HuggingFace](https://img.shields.io/badge/HuggingFace-Datasets-FFD21E?style=flat-square&logo=huggingface&logoColor=black) ![pandas](https://img.shields.io/badge/pandas-pyarrow-150458?style=flat-square&logo=pandas&logoColor=white) |
| Compute | ![AWS](https://img.shields.io/badge/AWS-EC2_m6i+g4dn-FF9900?style=flat-square&logo=amazonaws&logoColor=white) ![Kaggle](https://img.shields.io/badge/Kaggle-GPU_T4-20BEFF?style=flat-square&logo=kaggle&logoColor=white) |

### Frontend

| Component | Technology |
|---|---|
| Framework | ![React](https://img.shields.io/badge/React-18_+_Vite-61DAFB?style=flat-square&logo=react&logoColor=black) |
| Styling | ![Tailwind](https://img.shields.io/badge/Tailwind-CSS_Variables-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) |
| Animation | ![Framer](https://img.shields.io/badge/Framer-Motion-0055FF?style=flat-square&logo=framer&logoColor=white) |
| State | ![Zustand](https://img.shields.io/badge/Zustand-State_Management-433E38?style=flat-square) |
| Data Fetching | ![TanStack](https://img.shields.io/badge/TanStack-Query_+_axios-FF4154?style=flat-square) |
| Charts | ![Recharts](https://img.shields.io/badge/Recharts-Dashboard-22C55E?style=flat-square) |
| Export | ![html2canvas](https://img.shields.io/badge/html2canvas-PNG_Export-F59E0B?style=flat-square) |
| CSV | ![PapaParse](https://img.shields.io/badge/PapaParse-Batch_CSV-8B5CF6?style=flat-square) |

### Infrastructure

| Component | Technology |
|---|---|
| Frontend | ![Vercel](https://img.shields.io/badge/Vercel-CDN-000000?style=flat-square&logo=vercel&logoColor=white) |
| Backend | ![DigitalOcean](https://img.shields.io/badge/DigitalOcean-4GB_Droplet-0080FF?style=flat-square&logo=digitalocean&logoColor=white) |
| Process Management | ![systemd](https://img.shields.io/badge/systemd-Process_Manager-000000?style=flat-square) |
| Reverse Proxy | ![nginx](https://img.shields.io/badge/nginx-Reverse_Proxy-009639?style=flat-square&logo=nginx&logoColor=white) |
| SSL | ![Certbot](https://img.shields.io/badge/Let's_Encrypt-certbot-003A70?style=flat-square) |
| Domain | ![Namecheap](https://img.shields.io/badge/Namecheap-.me-DE3723?style=flat-square) |

---

## 🚧 Honest Limitations

| | |
|---|---|
| **Proxy label** | Return-language in reviews ≠ actual logistics data. Silent returners are invisible. |
| **Image signal** | 13.2% attention weight. CLIP doesn't capture fit, texture, or smell. |
| **Static price lookup** | Category medians from training data — needs refresh as market prices shift. |
| **AUC ceiling** | Hard ceiling without real return/fit data. Amazon doesn't expose this publicly. |
| **SHAP split credit** | Tabular features appear twice in 136-dim input. Breakdown is directional, not causally clean. |

---

## 🗂️ Project Structure

```
ReturnSight/
├── api/
│   ├── main.py              FastAPI app, endpoints, CORS
│   ├── inference.py         Full inference pipeline (mirrors training exactly)
│   ├── model_loader.py      Loads all artifacts on startup
│   └── schemas.py           Pydantic request/response models
├── eda_labeling.py          Chunked streaming, per-product accumulation, labeling
├── embeddings.py            CLIP + MiniLM, per-review pooling, mismatch score
├── fusion_lgbm.py           PyTorch attention model, LightGBM, Optuna
├── explainability.py        SHAP TreeExplainer, plots, threshold sweep
├── returnsight-frontend/    React 18 + Vite
│   ├── src/api/             Axios client, env-based URL
│   ├── src/components/      15+ components
│   ├── src/hooks/           useAnalysis, useHistory, useApiHealth, useKeyboard
│   ├── src/store/           Zustand app store
│   └── src/utils/           shareUrl, csvParser, sentimentDetector, exportImage
└── models/                  Git LFS
    ├── lgbm_classifier.pkl
    ├── fusion_attention.pt
    ├── pca_clip.pkl · pca_text.pkl · scaler.pkl
    └── category_price_median.pkl
```

---

## 🚀 Quick Start

```bash
# Backend
cd api
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend
cd returnsight-frontend
cp .env.example .env.local        # set VITE_API_URL=http://localhost:8000
npm install && npm run dev        # → http://localhost:5173
```

---

<div align="center">

Built by **Shariq Mukadam** · BCA, Bharati Vidyapeeth University, Pune · CGPA 8.61

[GitHub](https://github.com/IamShariqMukadam) · [LinkedIn](https://linkedin.com/in/shariqmukadam) · [Live Demo](https://returnsight.vercel.app)

*66M reviews · 611K products · 0 sampling*

</div>