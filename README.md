# ReturnSight — AI Return Risk Predictor

> **Know the return risk before the return.** A production-grade, multimodal AI pipeline that predicts e-commerce product return probability from listing data and customer reviews — trained on 66M Amazon reviews.

🔗 **Live Demo:** [returnsight.vercel.app](https://returnsight.vercel.app)  
📡 **API:** [api.returnsight.me/docs](https://api.returnsight.me/docs)  
📂 **Repo:** [github.com/IamShariqMukadam/ReturnSight](https://github.com/IamShariqMukadam/ReturnSight)

---

## What it does

E-commerce sellers typically discover return problems *after* scaling ad spend. ReturnSight moves that discovery to *before* publishing — analyzing a product listing and its reviews to output a 0–100% return probability score with signal-level attribution powered by SHAP values.

Paste a product title, description, price, and customer reviews. Get a verdict in under 500ms.

---

## Results

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

## How it works — technical pipeline

### 1. Label Engineering (leakage-free)

The original naive approach — labeling returns from `avg_rating` and `one_star_pct` — caused fake AUC of **1.0000** because those features were then used in the model. Fixed by building labels from **explicit return-mention language** in raw review text using a regex pattern covering 14 distinct return/refund expressions (`"returned it"`, `"sending it back"`, `"requested a refund"`, etc.).

Labels use a **rate-based threshold** (≥2% of reviews mention returns) rather than raw count, preventing bias toward high-volume products. This makes `avg_rating`, `one_star_pct`, `five_star_pct`, and `rating_std` leakage-free tabular features.

### 2. Data Processing

- **Source:** McAuley-Lab Amazon Reviews 2023 dataset (Clothing, Shoes & Jewelry), ~66M reviews, ~7.2M products
- **Processing:** Chunked streaming (500K rows/chunk) on EC2 with incremental merge checkpointing — avoids OOM on large datasets
- **Feature engineering:** `log_review_count`, `price_anomaly` (price ÷ category median), `rating_std` (computed via sum-of-squared-ratings aggregate across chunks), `review_desc_mismatch`

### 3. Multimodal Embeddings

**CLIP (image signal — 512-dim)**
- `openai/clip-vit-base-patch32` encodes product images
- Uses `vision_model` + `visual_projection` directly (not `get_image_features()`) to match the training path exactly and avoid version-specific API inconsistencies
- L2-normalized for cosine similarity
- ~96% image coverage; zero-vector fallback for missing images — attention layer learns to downweight

**Sentence-Transformers (text signal — 384-dim)**
- `all-MiniLM-L6-v2` encodes product descriptions and customer reviews
- Key fix: reviews encoded **individually then mean-pooled** (not concatenated) — concatenation hit a hard 256-token ceiling that silently truncated most review content
- `review_desc_mismatch = 1 − cosine_similarity(desc_emb, review_emb)` — measures gap between seller claims and buyer experience — strongest return predictor

### 4. Attention Fusion (PyTorch)

A custom 3-modality attention fusion layer projects CLIP (64-dim via PCA), text (64-dim via PCA), and tabular (8-dim) into a shared 128-dim space and learns per-sample attention weights:

```
CLIP → Linear(64→128) + LayerNorm + ReLU  ┐
Text → Linear(64→128) + LayerNorm + ReLU  ├─→ Softmax attention → Weighted sum → 128-dim fused
Tab  → Linear( 8→128) + LayerNorm + ReLU  ┘
                                            └→ Linear(128→64) → ReLU → Dropout(0.3) → Linear(64→1)
```

Trained with BCEWithLogitsLoss + `scale_pos_weight` for class imbalance. Validated AUC: **0.81+**

Average learned attention weights confirm expected signal strength:
- **Text: 0.397** (dominant)
- **Tabular: 0.389**
- **Image: 0.214** (weakest — AI-generated product photos contain little distinguishing information)

### 5. LightGBM Classifier

Final feature matrix: fused representation (128-dim) + raw tabular (8-dim) = **136 features**

- Hyperparameter tuning via **Optuna** (50 trials, TPE sampler) on held-out validation set
- Test set kept completely clean — never touched during tuning
- Baseline AUC: 0.8292 → Tuned AUC: **0.8302**
- `scale_pos_weight` handles 73/27 class imbalance

### 6. SHAP Explainability

`shap.TreeExplainer` on the LightGBM model. The 128 fused dimensions are collapsed to a single `image_text_fusion` SHAP value for human-readable attribution. Per-prediction explanations identify the dominant signal and generate seller-facing recommendations.

### 7. FastAPI Serving

- Lifespan context manager loads all models once at startup (~8s cold start)
- Inference: encode text → CLIP image fetch → PCA reduce → attention fusion → LightGBM → SHAP → response
- Latency: **~200–500ms** on CPU (DigitalOcean 4GB Droplet)
- Full CORS, Pydantic schemas, 503 retry logic

---

## Architecture

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
  LightGBM Classifier (Optuna-tuned)
         ↓
  Return Probability (0–100%)
         ↓
  SHAP TreeExplainer → signal attribution
         ↓
  FastAPI /predict response
```

---

## Tech Stack

### ML / Backend
| Component | Technology |
|---|---|
| Embeddings | CLIP ViT-B/32, all-MiniLM-L6-v2 |
| Dimensionality reduction | PCA (scikit-learn) |
| Fusion model | PyTorch (custom attention layer) |
| Classifier | LightGBM |
| Explainability | SHAP TreeExplainer |
| Hyperparameter tuning | Optuna (TPE, 50 trials) |
| API | FastAPI + Uvicorn |
| Data processing | HuggingFace Datasets (pinned v3.x), pandas, pyarrow |
| Compute | AWS EC2 (m6i.2xlarge + g4dn.xlarge), Kaggle GPU T4 |

### Frontend
| Component | Technology |
|---|---|
| Framework | React 18 + Vite |
| Styling | Tailwind CSS + CSS variables |
| Animation | Framer Motion |
| State | Zustand |
| Data fetching | TanStack Query + axios |
| Charts | Recharts |
| Export | html2canvas |
| CSV | PapaParse |

### Infrastructure
| Component | Technology |
|---|---|
| Frontend hosting | Vercel |
| Backend hosting | DigitalOcean Droplet (4GB RAM) |
| Process management | systemd |
| Reverse proxy | nginx |
| SSL | Let's Encrypt (certbot) |
| Domain | Namecheap (.me via GitHub Student Pack) |

---

## Features

- **Single analysis** — paste any product listing, get risk verdict in <500ms
- **Batch CSV upload** — analyze up to 10 products simultaneously, export results
- **Compare mode** — side-by-side analysis of two products
- **SHAP signal breakdown** — 5 AI signals with plain-English tooltip explanations
- **Seller recommendations** — rule-based actionable advice from signal values
- **History drawer** — localStorage persistence, search, group by day, CSV export
- **Shareable results** — base64 URL hash encoding, paste link to share verdict
- **Export PNG** — 1200×630 branded result card via html2canvas
- **Portfolio dashboard** — `/dashboard` with recharts history visualization
- **Smart review parser** — paste bulk reviews, auto-detects sentiment → star rating
- **Keyboard shortcuts** — ⌘K palette, ⌘+Enter submit, ⌘+H history
- **API health polling** — 30s interval, offline banner, graceful degraded mode
- **Mobile responsive** — bottom sheet result, FAB, touch-optimized inputs

---

## Setup

### Frontend

```bash
git clone https://github.com/IamShariqMukadam/ReturnSight
cd ReturnSight/returnsight-frontend
npm install
cp .env.example .env.local
# Set VITE_API_URL=https://api.returnsight.me (or http://localhost:8000)
npm run dev
```

### Backend

```bash
cd ReturnSight
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Models must be in models/ directory (not committed — too large for GitHub)
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### API Contract

**POST /predict**
```json
{
  "title": "string",
  "description": "string",
  "reviews": [{ "text": "string", "rating": 1 }],
  "price": 29.99,
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
    "image_text_fusion": 0.12,
    "avg_rating": -0.08,
    "one_star_pct": 0.21,
    "price_anomaly": 0.04,
    "review_mismatch": 0.18
  },
  "top_reason": "Reviews contradict product description (mismatch: 0.72)",
  "latency_ms": 184.5
}
```

---

## Key Engineering Decisions

**Why mean-pool reviews instead of concatenate?**  
Concatenation hits `all-MiniLM-L6-v2`'s 256-token ceiling — for products with 10+ reviews, all content beyond ~3 reviews was silently truncated. Mean-pooling individual encodings has no ceiling and better represents the full review distribution.

**Why rate-based labels instead of count-based?**  
A single return mention out of 3,933 reviews (0.025%) should not equal one mention out of 5 reviews (20%). Rate-based thresholding (≥2%) removes this statistical bias toward high-volume products.

**Why LightGBM over neural end-to-end?**  
The 136-dim feature vector is small enough that gradient-boosted trees outperform neural classifiers. LightGBM also gives SHAP compatibility out of the box, which is core to the product's value proposition.

**Why attention fusion instead of simple concatenation?**  
Concatenation treats all modalities equally. Attention lets the model learn that image embeddings from AI-generated product photos carry less signal than review-description mismatch — which matches domain knowledge.

---

## Repository Structure

```
ReturnSight/
├── api/
│   ├── main.py              # FastAPI app, lifespan model loading
│   ├── inference.py         # Full inference pipeline
│   ├── model_loader.py      # Global model state, AttentionFusion definition
│   └── schemas.py           # Pydantic request/response models
├── returnsight-frontend/
│   ├── src/
│   │   ├── components/      # React UI components
│   │   ├── hooks/           # useAnalysis, useHistory, useApiHealth, etc.
│   │   ├── store/           # Zustand global state
│   │   └── utils/           # shareUrl, exportImage, csvParser, sentimentDetector
│   └── package.json
├── build_price_lookup.py    # Generates category_price_median.pkl
├── extract_images.py        # Extracts image URLs from HF metadata
├── patch_image_url.py       # Patches image URLs into labeled parquet
├── requirements.txt
└── README.md
```

---

## License

MIT — built for e-commerce sellers and as a portfolio project demonstrating production ML engineering.