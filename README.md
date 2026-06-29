<div align="center">

# 🛍️ ReturnSight
### Know the return risk *before* the return.

A production-grade multimodal AI pipeline that predicts e-commerce return probability from listing data and customer reviews — trained on 66M Amazon reviews.

[![Live Demo](https://img.shields.io/badge/Live_Demo-returnsight.vercel.app-00C853?style=for-the-badge&logo=vercel&logoColor=white)](https://returnsight.vercel.app)
[![API Docs](https://img.shields.io/badge/API_Docs-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://api.returnsight.me/docs)
[![Repo](https://img.shields.io/badge/Repo-GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/IamShariqMukadam/ReturnSight)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](#license)

</div>

---

## 📸 Preview

<!-- Drop your screenshots into an /assets folder and point these at the real files -->
<div align="center">
<img src="./assets/hero.png" width="800" alt="ReturnSight dashboard" />
</div>

<details>
<summary><b>More screenshots</b></summary>
<br>
<img src="./assets/single-analysis.png" width="400" alt="Single analysis" />
<img src="./assets/batch-upload.png" width="400" alt="Batch CSV upload" />
<img src="./assets/compare-mode.png" width="400" alt="Compare mode" />
<img src="./assets/shap-breakdown.png" width="400" alt="SHAP breakdown" />
</details>

---

## What it does

Sellers usually find out a listing returns badly *after* scaling ad spend on it. ReturnSight flips that — paste a title, description, price, and reviews, get a 0–100% return-risk score with SHAP-backed signal attribution, in under 500ms.

## 📊 Results

| Metric | Value |
|---|---|
| Test AUC-ROC | **0.8302** |
| Average Precision | **0.7022** |
| Training data | 66M reviews · ~611K products |
| Return rate | 27% |
| CLIP image coverage | ~96% |
| Inference latency | <500ms (CPU) |

---

## 🧰 Tech Stack

**ML / Backend**

| Layer | Technology |
|---|---|
| Embeddings | ![CLIP](https://img.shields.io/badge/CLIP_ViT--B/32-FF6F00?logo=openai&logoColor=white) ![MiniLM](https://img.shields.io/badge/all--MiniLM--L6--v2-FFCA28?logo=huggingface&logoColor=black) |
| Fusion Model | ![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?logo=pytorch&logoColor=white) |
| Classifier | ![LightGBM](https://img.shields.io/badge/LightGBM-02569B?logoColor=white) |
| Explainability | ![SHAP](https://img.shields.io/badge/SHAP-8E44AD?logoColor=white) |
| Tuning | ![Optuna](https://img.shields.io/badge/Optuna-0078D4?logoColor=white) |
| API | ![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white) ![Uvicorn](https://img.shields.io/badge/Uvicorn-2E8B57?logoColor=white) |
| Data | ![Pandas](https://img.shields.io/badge/Pandas-150458?logo=pandas&logoColor=white) ![HF Datasets](https://img.shields.io/badge/HF_Datasets-FFD21E?logo=huggingface&logoColor=black) |
| Compute | ![AWS](https://img.shields.io/badge/AWS_EC2-FF9900?logo=amazonaws&logoColor=white) ![Kaggle](https://img.shields.io/badge/Kaggle_T4-20BEFF?logo=kaggle&logoColor=white) |

**Frontend**

| Layer | Technology |
|---|---|
| Framework | ![React](https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black) ![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white) |
| Styling | ![Tailwind](https://img.shields.io/badge/TailwindCSS-06B6D4?logo=tailwindcss&logoColor=white) ![Framer](https://img.shields.io/badge/Framer_Motion-EF008F?logo=framer&logoColor=white) |
| State / Data | ![Zustand](https://img.shields.io/badge/Zustand-433E38?logoColor=white) ![TanStack](https://img.shields.io/badge/TanStack_Query-FF4154?logoColor=white) ![Axios](https://img.shields.io/badge/Axios-5A29E4?logo=axios&logoColor=white) |
| Charts | ![Recharts](https://img.shields.io/badge/Recharts-22B5BF?logoColor=white) |
| Utils | ![html2canvas](https://img.shields.io/badge/html2canvas-FF7043?logoColor=white) ![PapaParse](https://img.shields.io/badge/PapaParse-2C3E50?logoColor=white) |

**Infrastructure**

| Layer | Technology |
|---|---|
| Hosting | ![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white) ![DigitalOcean](https://img.shields.io/badge/DigitalOcean-0080FF?logo=digitalocean&logoColor=white) |
| Server | ![nginx](https://img.shields.io/badge/nginx-009639?logo=nginx&logoColor=white) ![systemd](https://img.shields.io/badge/systemd-555555?logoColor=white) |
| SSL / Domain | ![Let's Encrypt](https://img.shields.io/badge/Let's_Encrypt-003A70?logo=letsencrypt&logoColor=white) ![Namecheap](https://img.shields.io/badge/Namecheap-DE3723?logoColor=white) |

---

## ⚙️ How it works

<details>
<summary><b>1. Label Engineering (leakage-free)</b></summary><br>

Naive labeling from <code>avg_rating</code>/<code>one_star_pct</code> leaked into features → fake AUC of 1.0000. Fixed by regex-matching 14 explicit return-mention phrases (<code>"sending it back"</code>, <code>"requested a refund"</code>, etc.) in raw review text, then thresholding at <b>≥2% mention rate</b> — not raw count — to avoid bias toward high-volume products.
</details>

<details>
<summary><b>2. Data Processing</b></summary><br>

McAuley-Lab Amazon Reviews 2023 (Clothing/Shoes/Jewelry) — 66M reviews, 7.2M products. Streamed in 500K-row chunks on EC2 with incremental merge checkpointing to avoid OOM. Engineered <code>log_review_count</code>, <code>price_anomaly</code>, <code>rating_std</code> (sum-of-squares aggregate across chunks), <code>review_desc_mismatch</code>.
</details>

<details>
<summary><b>3. Multimodal Embeddings</b></summary><br>

- **CLIP ViT-B/32** → 512-dim image embeddings (~96% coverage, zero-vector fallback for missing images)
- **all-MiniLM-L6-v2** → 384-dim text embeddings. Reviews are mean-pooled individually, not concatenated — dodges the 256-token truncation ceiling.
- <code>review_desc_mismatch = 1 − cosine_sim(desc_emb, review_emb)</code> — the single strongest predictor.
</details>

<details>
<summary><b>4. Attention Fusion (PyTorch)</b></summary><br>

```
CLIP(64) → Linear+LN+ReLU ┐
Text(64) → Linear+LN+ReLU ├→ Softmax attention → 128-dim fused → MLP → logit
Tab(8)   → Linear+LN+ReLU ┘
```

Learned attention weights: **Text 39.7% · Tabular 38.9% · Image 21.4%** — image carries the least signal, matching the AI-generated product photos in the dataset. Validated AUC: 0.81+.
</details>

<details>
<summary><b>5. LightGBM + Optuna</b></summary><br>

136 features (128 fused + 8 raw tabular). 50-trial TPE tuning on a held-out validation set; test set never touched. Baseline AUC 0.8292 → tuned **0.8302**. <code>scale_pos_weight</code> handles the 73/27 imbalance.
</details>

<details>
<summary><b>6. SHAP + FastAPI Serving</b></summary><br>

<code>TreeExplainer</code> collapses the 128 fused dims into one <code>image_text_fusion</code> SHAP value for human-readable attribution. FastAPI loads all models once at startup (~8s cold start); full pipeline runs in 200–500ms on a 4GB CPU droplet.
</details>

---

## 🏗️ Architecture

```
Title + Description ──► MiniLM ──► desc_emb (384)
Customer Reviews     ──► MiniLM (mean-pooled) ──► review_emb (384)
                              │
            review_desc_mismatch = 1 - cosine_sim ◄┘
Product Image ──► CLIP ViT-B/32 ──► image_emb (512)
Tabular features ──► [rating stats, price_anomaly, mismatch, has_clip]
        │
        ▼  PCA → 64-dim each · tabular → 8-dim (scaled)
  PyTorch Attention Fusion (learned weights)
        ▼
  128-dim fused + 8-dim raw tab = 136 features
        ▼
  LightGBM (Optuna-tuned) ──► Return Probability
        ▼
  SHAP TreeExplainer ──► signal attribution ──► /predict response
```

---

## ✨ Features

- **Single analysis** — risk verdict in <500ms
- **Batch CSV** — up to 10 products, exportable
- **Compare mode** — side-by-side verdicts
- **SHAP breakdown** — 5 signals, plain-English tooltips
- **Seller recommendations** — rule-based, signal-driven
- **History drawer** — localStorage, search, group-by-day, CSV export
- **Shareable results** — base64 hash links
- **PNG export** — branded 1200×630 result card
- **Dashboard** — `/dashboard` with Recharts history view
- **Smart review parser** — bulk paste → auto sentiment → star rating
- **Keyboard shortcuts** — ⌘K palette, ⌘+Enter, ⌘+H
- **API health polling** — 30s interval, offline banner, degraded mode
- **Mobile responsive** — bottom sheet, FAB, touch-optimized

---

## 🚀 Setup

**Frontend**
```bash
git clone https://github.com/IamShariqMukadam/ReturnSight
cd ReturnSight/returnsight-frontend
npm install
cp .env.example .env.local   # set VITE_API_URL
npm run dev
```

**Backend**
```bash
cd ReturnSight
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# place trained models in models/ (not committed — too large for GitHub)
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

---

## 🔌 API

**POST** `/predict`
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

## 🤔 Key Decisions

<details>
<summary><b>Mean-pool reviews instead of concatenate?</b></summary><br>
Concatenation hits MiniLM's 256-token ceiling — for products with 10+ reviews, most content past ~3 reviews got silently truncated. Mean-pooling has no ceiling.
</details>

<details>
<summary><b>Rate-based labels instead of count-based?</b></summary><br>
1 return mention out of 3,933 reviews (0.025%) ≠ 1 out of 5 (20%). Rate-based thresholding (≥2%) removes the bias toward high-volume products.
</details>

<details>
<summary><b>LightGBM over an end-to-end neural net?</b></summary><br>
136 features is small enough that GBTs beat neural classifiers here, and LightGBM gives SHAP compatibility for free — core to the product's value prop.
</details>

<details>
<summary><b>Attention fusion over concatenation?</b></summary><br>
Concatenation weighs every modality equally. Attention lets the model learn that AI-generated product photos carry less signal than review-description mismatch — matching domain knowledge.
</details>

---

## 📁 Structure

```
ReturnSight/
├── api/
│   ├── main.py             # FastAPI app, lifespan model loading
│   ├── inference.py        # Full inference pipeline
│   ├── model_loader.py     # Global model state, AttentionFusion definition
│   └── schemas.py          # Pydantic request/response models
├── returnsight-frontend/
│   ├── src/
│   │   ├── components/     # React UI
│   │   ├── hooks/          # useAnalysis, useHistory, useApiHealth
│   │   ├── store/          # Zustand state
│   │   └── utils/          # shareUrl, exportImage, csvParser, sentimentDetector
│   └── package.json
├── build_price_lookup.py
├── extract_images.py
├── patch_image_url.py
├── requirements.txt
└── README.md
```

---

<div align="center">

MIT License — built for e-commerce sellers, and as a portfolio piece in production ML engineering.

</div>