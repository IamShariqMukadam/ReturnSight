<div align="center">

<img src="public/og-image.png" alt="ReturnSight" width="100%"/>

# ⟁ ReturnSight

**Multi-modal ML system that predicts e-commerce return risk from product listings + reviews.**  
**Built end-to-end on 610,879 products. No sampling. No shortcuts.**

[![AUC-ROC](https://img.shields.io/badge/AUC--ROC-0.7966-FF5C1A?style=for-the-badge)](/)
[![Avg Precision](https://img.shields.io/badge/Avg_Precision-0.5625-FF5C1A?style=for-the-badge)](/)
[![Products](https://img.shields.io/badge/Products-610K-7C3AED?style=for-the-badge)](/)
[![Return Rate](https://img.shields.io/badge/Return_Rate-22.32%25-EC4899?style=for-the-badge)](/)
[![CLIP](https://img.shields.io/badge/CLIP-96%25_Coverage-7C3AED?style=for-the-badge)](/)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](/)
[![React](https://img.shields.io/badge/UI-React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](/)
[![Optuna](https://img.shields.io/badge/Tuned-Optuna_50_trials-2980b9?style=for-the-badge)](/)

[**Live Demo →**](https://returnsight.vercel.app) &nbsp;·&nbsp; [**API Docs →**](https://api.returnsight.com/docs)

</div>

---

## ⚡ In One Shot

```
Input:  product title + description + reviews + price + image_url
           ↓  CLIP image embedding (512-dim)
           ↓  MiniLM text embedding (384-dim, per-review pooled)
           ↓  8 tabular features (ratings, price anomaly, mismatch score)
           ↓  PyTorch Attention Fusion → 128-dim weighted vector
           ↓  LightGBM on 136 features (Optuna-tuned, 50 trials)
Output: { return_probability: 0.73, risk_level: "High", signal_breakdown, top_reason }
```

---

## 🏗️ What Was Built & How

### 1 · Dataset — Full Scale, Zero Sampling

```
Source: McAuley-Lab/Amazon-Reviews-2023  →  Clothing_Shoes_and_Jewelry (HuggingFace)

Common approach: sample 50K rows, fit model, call it done
Our approach:    stream the entire dataset in chunks — nothing held in RAM
```

| Chunk Type | Count | Size |
|---|---|---|
| Review chunks streamed | 133 | ~500K rows each |
| Metadata chunks streamed | 15 | — |
| Checkpoints written | Every major step | Crash-safe |

```
Filters applied:  verified purchases only  ·  review text > 10 chars
                  ≥ 5 reviews/product  ·  valid description + image metadata

Result: 610,879 products
        136,329  🔴 Likely Return  (22.32%)
        474,550  🟢 No Return      (77.68%)
        586,524 / 610,879 products have CLIP-fetchable images  →  96.0% coverage
```

---

### 2 · Label Engineering — Rate vs Count

Most implementations count raw return mentions per product. That's wrong.

```python
# ❌ Naive — biased toward high-review-volume products
likely_return = return_mention_count > N
# A product with 15/1000 reviews (1.5%) looks riskier than 10/50 (20%)

# ✅ Ours — scale-invariant
likely_return = (return_mention_count / total_reviews) >= 0.02
# 15/1000 = 1.5%  → safe     10/50 = 20%  → flagged  ✓
```

Regex matched against **full review text**, not sampled — every mention captured regardless of review position in the dataset.

---

### 3 · Embeddings — The Pooling Fix That Matters

**Models used:**
- `openai/clip-vit-base-patch32` → 512-dim image embeddings
- `all-MiniLM-L6-v2` → 384-dim text embeddings

**The problem with review encoding:**  
`all-MiniLM-L6-v2` has a 256-token hard limit. Concatenating all reviews then truncating silently discards reviews 4–30 for any product with decent coverage.

```
❌ Concat → truncate:
   [rev1 + rev2 + rev3 + rev4...]  →  cut at 256 tokens  →  reviews 4-30 gone

✅ Per-review encode → mean pool:
   encode(rev1)  →  384-dim  ┐
   encode(rev2)  →  384-dim  ├── mean pool → renormalize → 1 × 384-dim
   ...                        │   (up to 30 reviews, 400 chars each)
   encode(rev30) →  384-dim  ┘   all reviews contribute equally
```

**Mismatch score** — quantifies seller claim vs buyer reality:
```
review_desc_mismatch = 1 − cosine_similarity(description_emb, review_emb)
Mean: 0.4957  |  Range: 0.1550 – 1.1036
Note: weaker signal than expected — text + tabular features dominate this category
```

---

### 4 · Attention Fusion — Learned, Not Hardcoded

Three modalities. Hardcoding weights (e.g., 50/30/20) is a guess. The model learns it instead.

```
Architecture:
  image_emb   (512 → PCA 64 → linear 128) ─┐
  text_emb    (384 → PCA 64 → linear 128) ─┼─► softmax attention weights ─► weighted sum ─► 128-dim
  tabular_emb (8 features → linear 128)   ─┘                                per sample, not global

Final LightGBM input:  fused_128  +  raw_tabular_8  =  136 features
```

**What the model learned — average attention across test set:**

```
📷 Image    ████░░░░░░░░░░░░░░░░  13.2%   (CLIP weak for clothing — photos don't show fit issues)
📝 Text     ██████████████████░░  49.8%   (buyer language is the dominant signal)
📈 Tabular  ██████████████░░░░░░  37.0%   (star ratings + price anomaly carry real weight)
```

> The attention model *confirmed* the intuition post-hoc — it wasn't hand-tuned to these values.

---

### 5 · LightGBM + Optuna Tuning

```
Train:   427,615  |  Val: 91,632  |  Test: 91,632
Split:   stratified  →  22.32% return rate preserved in all three splits
Tuning:  Optuna, 50 trials, maximize AUC-ROC on validation set
```

| Metric | Pre-Tuning | Post-Tuning |
|---|---|---|
| **AUC-ROC** | 0.7947 | **0.7966** |
| **Average Precision** | 0.5597 | **0.5625** |
| No-Return Precision | — | 0.90 |
| No-Return Recall | — | 0.73 |
| Likely-Return Precision | — | 0.43 |
| Likely-Return Recall | — | 0.70 |

**SHAP explainability:** TreeExplainer on all 136 features. The 128 fused dims are collapsed into one `image_text_fusion` score for readability. Individual tabular features reported separately.  
Outputs: beeswarm plot · bar importance · waterfall examples (highest + lowest risk) · threshold sweep 0.30 → 0.80.

---

### 6 · FastAPI — Inference Parity

Most ML serving bugs come from silent pipeline mismatches between training and inference.

```
Validation method: 15 real held-out test products across full probability range
                   compared offline predictions vs live API response

Result:  Several predictions exact to 4 decimal places
         Zero risk-category flips across all 15 products
```

**What was locked to match training exactly:**

| Component | Training Path | Serving Path |
|---|---|---|
| Review encoding | Per-review encode → mean pool → renormalize | ✅ Identical |
| `price_anomaly` | Category-median lookup (32 categories) | ✅ Same lookup table |
| CLIP extraction | `vision_model → visual_projection` | ✅ Same two-step path (high-level shortcut crashes on this transformers version) |
| PCA transforms | Fit on training data | ✅ Serialized + loaded |

---

## 🔌 API Reference

```
GET  /health   →  { status, models_loaded }
POST /predict  →  { return_probability, risk_level, signal_breakdown, top_reason, latency_ms }
```

**Request**
```json
{
  "title": "Women's Floral Midi Dress",
  "description": "Lightweight chiffon, true to size...",
  "reviews": [{ "text": "Runs 2 sizes small, returned immediately.", "rating": 1 }],
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

## 🖥️ Frontend

React 18 + Vite + Tailwind — built for sellers, not ML engineers.

| Feature | Details |
|---|---|
| Single analysis | Paste listing → verdict in <1s |
| Batch CSV | Up to 10 products, sequential with progress |
| History | localStorage, 20 items, grouped by day, searchable |
| Share | Result encoded in URL hash, zero backend |
| Export | PNG card (html2canvas) + JSON copy |
| Compare | Side-by-side dual analysis with diff summary |
| Dashboard | `/dashboard` — portfolio risk charts via recharts |
| Keyboard | `⌘K` palette, `⌘↵` analyze, `⌘H` history, `⌘B` batch |
| Mobile | Bottom sheet result panel, FAB trigger, touch drag snap |
| Offline | Shows last 5 cached results if API unreachable |

---

## 🏛️ Infrastructure

| Stage | Instance | Reason |
|---|---|---|
| EDA + Labeling | AWS EC2 `m6i.2xlarge` (CPU) | Streaming I/O, no compute needed |
| Embeddings + Training | AWS EC2 `g4dn.xlarge` (T4 GPU) | CLIP + PyTorch on GPU |
| Serving | DigitalOcean 4GB Droplet | Models in memory, CPU inference |
| Frontend | Vercel | CDN, zero config |

Long-running jobs via `tmux`. Git LFS for model artifacts. Checkpointed at every major step.

---

## 🚧 Honest Limitations

| | |
|---|---|
| **Proxy label** | Return-language in reviews ≠ actual logistics data. Silent returners are invisible. |
| **Image signal** | 13.2% attention weight. CLIP doesn't capture fit, texture, or smell. |
| **Static price lookup** | Category medians computed once from training data — needs periodic refresh. |
| **AUC ceiling ~0.80** | Hard ceiling without real return/fit data. Amazon doesn't expose this publicly. |
| **SHAP split credit** | Tabular features appear twice in 136-dim input (raw + inside fusion). Breakdown is directional, not causally clean. |

---

## 🗂️ Project Structure

```
ReturnSight/
├── api/
│   ├── main.py              FastAPI app, endpoints, CORS
│   ├── inference.py         Full inference pipeline (mirrors training)
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
└── models/                  Git LFS — all serialized artifacts
    ├── lgbm_classifier.pkl
    ├── fusion_attention.pt
    ├── pca_clip.pkl  ·  pca_text.pkl  ·  scaler.pkl
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

*610,879 products · 0 samples · 1 model*

</div>