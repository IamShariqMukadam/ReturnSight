```
██████╗ ███████╗████████╗██╗   ██╗██████╗ ███╗   ██╗███████╗██╗ ██████╗ ██╗  ██╗████████╗
██╔══██╗██╔════╝╚══██╔══╝██║   ██║██╔══██╗████╗  ██║██╔════╝██║██╔════╝ ██║  ██║╚══██╔══╝
██████╔╝█████╗     ██║   ██║   ██║██████╔╝██╔██╗ ██║███████╗██║██║  ███╗███████║   ██║   
██╔══██╗██╔══╝     ██║   ██║   ██║██╔══██╗██║╚██╗██║╚════██║██║██║   ██║██╔══██║   ██║   
██║  ██║███████╗   ██║   ╚██████╔╝██║  ██║██║ ╚████║███████║██║╚██████╔╝██║  ██║   ██║   
╚═╝  ╚═╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   
```
<div align="center">
**Multi-modal ML system that predicts e-commerce return risk from product listings + reviews.**  
**Built end-to-end on 66M Amazon reviews. No sampling. No shortcuts.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-returnsight.vercel.app-FF5C1A?style=for-the-badge&logo=vercel&logoColor=white)](https://returnsight.vercel.app)
[![API Docs](https://img.shields.io/badge/API_Docs-api.returnsight.me%2Fdocs-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://api.returnsight.me/docs)

</div>

---

## 📸 Screenshots

![Landing Page](/assets/returnsight.vercel.app_.png)

![Dashboard](/assets/returnsight.vercel.app_%20(1).png)


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

## 🔬 How It Works — Technical Pipeline

### 1. Label Engineering (Leakage-Free)

The original naive approach — labeling returns from `avg_rating` and `one_star_pct` — caused **fake AUC of 1.0000** because those features were then used in the model. Fixed by building labels from **explicit return-mention language** in raw review text using a regex pattern covering 14 distinct return/refund expressions ("returned it", "sending it back", "requested a refund", etc.).

Labels use a **rate-based threshold** (≥2% of reviews mention returns) rather than raw count, preventing bias toward high-volume products. This makes `avg_rating`, `one_star_pct`, `five_star_pct`, and `rating_std` leakage-free tabular features.

### 2. Data Processing

```
Source:     McAuley-Lab Amazon Reviews 2023 (Clothing, Shoes & Jewelry)
            ~66M reviews · ~7.2M products
Processing: Chunked streaming (500K rows/chunk) with incremental merge
            checkpointing — avoids OOM on large datasets
Features:   log_review_count, price_anomaly (price ÷ category median),
            rating_std (sum-of-squared-ratings aggregate across chunks),
            review_desc_mismatch
```

### 3. Multimodal Embeddings

**CLIP — image signal (512-dim)**
- `openai/clip-vit-base-patch32` encodes product images
- Uses `vision_model + visual_projection` directly (not `get_image_features()`) to match training path exactly and avoid version-specific API inconsistencies
- L2-normalized for cosine similarity
- ~96% image coverage; zero-vector fallback for missing images — attention layer learns to downweight

**Sentence-Transformers — text signal (384-dim)**
- `all-MiniLM-L6-v2` encodes product descriptions and customer reviews
- **Key fix:** reviews encoded *individually then mean-pooled* (not concatenated) — concatenation hit a hard 256-token ceiling that silently truncated most review content
- `review_desc_mismatch = 1 − cosine_similarity(desc_emb, review_emb)` — measures gap between seller claims and buyer experience

### 4. Attention Fusion (PyTorch)

```
CLIP → Linear(64→128) + LayerNorm + ReLU ─┐
Text → Linear(64→128) + LayerNorm + ReLU ─┼─► Softmax attention → Weighted sum → 128-dim fused
Tab  → Linear( 8→128) + LayerNorm + ReLU ─┘
                                            └─► Linear(128→64) → ReLU → Dropout(0.3) → Linear(64→1)
```

Trained with `BCEWithLogitsLoss` + `scale_pos_weight` for class imbalance.

**Average learned attention weights:**

```
📷 Image    ████░░░░░░░░░░░░░░░░  21.4%   (AI product photos contain little distinguishing info)
📝 Text     ███████████████░░░░░  39.7%   (buyer language — dominant signal)
📈 Tabular  ███████████████░░░░░  38.9%   (star ratings + price carry real weight)
```

### 5. LightGBM Classifier

```
Final feature matrix:  fused (128-dim) + raw tabular (8-dim)  =  136 features
Tuning:                Optuna, 50 trials, TPE sampler on validation set
Class imbalance:       scale_pos_weight (73/27 split)
Test set:              kept completely clean — never touched during tuning

Baseline AUC: 0.8292  →  Tuned AUC: 0.8302
```

### 6. SHAP Explainability

`shap.TreeExplainer` on the LightGBM model. The 128 fused dimensions are collapsed to a single `image_text_fusion` SHAP value for human-readable attribution. Per-prediction explanations identify the dominant signal and generate seller-facing recommendations.

### 7. FastAPI Serving

```
Inference path:  encode text → CLIP image fetch → PCA reduce
                 → attention fusion → LightGBM → SHAP → response
Latency:         ~200–500ms on CPU
```

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

### Review Encoding — Per-Review Pool, Not Truncate

```
❌ Concat → truncate at 256 tokens:  reviews 4–30 silently gone

✅ Ours:
   encode(rev1) → 384-dim ┐
   encode(rev2) → 384-dim ├── mean pool → renormalize → 1×384-dim
   encode(revN) → 384-dim ┘   all reviews contribute equally (up to 30)
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

```json
// Request
{
  "title": "Women's Floral Midi Dress",
  "description": "Lightweight chiffon, true to size...",
  "reviews": [{ "text": "Runs 2 sizes small, returned it.", "rating": 1 }],
  "price": 34.99,
  "image_url": "https://example.com/image.jpg",
  "category": "Clothing_Shoes_and_Jewelry"
}

// Response
{
  "return_probability": 0.73,
  "risk_level": "High",
  "signal_breakdown": { "image_text_fusion": 0.18, "avg_rating": 0.31,
                         "one_star_pct": 0.67, "price_anomaly": 0.12, "review_mismatch": 0.44 },
  "top_reason": "1-star rate above 25% threshold",
  "latency_ms": 214
}
```

`Low < 0.35` · `Medium < 0.65` · `High ≥ 0.65`

---

## 🛠️ Tech Stack

### ML / Backend

| Layer | Technology |
|---|---|
| Embeddings | ![CLIP](https://img.shields.io/badge/CLIP_ViT--B%2F32-FF5C1A?style=flat-square&logo=openai&logoColor=white) ![MiniLM](https://img.shields.io/badge/all--MiniLM--L6--v2-7C3AED?style=flat-square&logo=huggingface&logoColor=white) |
| Dimensionality Reduction | ![PCA](https://img.shields.io/badge/PCA_scikit--learn-F7931E?style=flat-square&logo=scikitlearn&logoColor=white) |
| Fusion Model | ![PyTorch](https://img.shields.io/badge/PyTorch_Attention_Fusion-EE4C2C?style=flat-square&logo=pytorch&logoColor=white) |
| Classifier | ![LightGBM](https://img.shields.io/badge/LightGBM_Classifier-2980b9?style=flat-square) |
| Explainability | ![SHAP](https://img.shields.io/badge/SHAP_TreeExplainer-FF6B6B?style=flat-square) |
| Hyperparameter Tuning | ![Optuna](https://img.shields.io/badge/Optuna_TPE_50_trials-7E57C2?style=flat-square) |
| API | ![FastAPI](https://img.shields.io/badge/FastAPI_+_Uvicorn-009688?style=flat-square&logo=fastapi&logoColor=white) |
| Data Processing | ![HuggingFace](https://img.shields.io/badge/HuggingFace_Datasets-FFD21E?style=flat-square&logo=huggingface&logoColor=black) ![pandas](https://img.shields.io/badge/pandas_+_pyarrow-150458?style=flat-square&logo=pandas&logoColor=white) |

### Frontend

| Layer | Technology |
|---|---|
| Framework | ![React](https://img.shields.io/badge/React_18_+_Vite-61DAFB?style=flat-square&logo=react&logoColor=black) |
| Styling | ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) |
| Animation | ![Framer](https://img.shields.io/badge/Framer_Motion-0055FF?style=flat-square&logo=framer&logoColor=white) |
| State | ![Zustand](https://img.shields.io/badge/Zustand-433E38?style=flat-square) |
| Data Fetching | ![TanStack](https://img.shields.io/badge/TanStack_Query_+_Axios-FF4154?style=flat-square) |
| Charts | ![Recharts](https://img.shields.io/badge/Recharts-22C55E?style=flat-square) |
| Export | ![html2canvas](https://img.shields.io/badge/html2canvas_PNG_Export-F59E0B?style=flat-square) |
| CSV | ![PapaParse](https://img.shields.io/badge/PapaParse_Batch_CSV-8B5CF6?style=flat-square) |

### Infrastructure

| Layer | Technology |
|---|---|
| Frontend | ![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white) |
| Reverse Proxy | ![nginx](https://img.shields.io/badge/nginx-009639?style=flat-square&logo=nginx&logoColor=white) |
| SSL | ![Certbot](https://img.shields.io/badge/Let's_Encrypt_certbot-003A70?style=flat-square) |
| Domain | ![Namecheap](https://img.shields.io/badge/Namecheap_.me-DE3723?style=flat-square) |

---

## 🚧 Honest Limitations

| | |
|---|---|
| **Proxy label** | Return-language in reviews ≠ actual logistics data. Silent returners are invisible. |
| **Image signal** | 21.4% attention weight. CLIP doesn't capture fit, texture, or smell. |
| **Static price lookup** | Category medians computed once — needs refresh as market prices shift. |
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
│   ├── src/components/      15+ components
│   ├── src/hooks/           useAnalysis, useHistory, useApiHealth, useKeyboard
│   ├── src/store/           Zustand app store
│   └── src/utils/           shareUrl, csvParser, sentimentDetector, exportImage
└── models/                  Trained artifacts
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

Built by **Shariq Mukadam** · *66M reviews · 611K products · 0 sampling*

</div>