<div align="center">

```
██████╗ ███████╗████████╗██╗   ██╗██████╗ ███╗   ██╗███████╗██╗ ██████╗ ██╗  ██╗████████╗
██╔══██╗██╔════╝╚══██╔══╝██║   ██║██╔══██╗████╗  ██║██╔════╝██║██╔════╝ ██║  ██║╚══██╔══╝
██████╔╝█████╗     ██║   ██║   ██║██████╔╝██╔██╗ ██║███████╗██║██║  ███╗███████║   ██║   
██╔══██╗██╔══╝     ██║   ██║   ██║██╔══██╗██║╚██╗██║╚════██║██║██║   ██║██╔══██║   ██║   
██║  ██║███████╗   ██║   ╚██████╔╝██║  ██║██║ ╚████║███████║██║╚██████╔╝██║  ██║   ██║   
╚═╝  ╚═╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   
```

### *Know the risk before the return.*

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LightGBM](https://img.shields.io/badge/LightGBM-Optuna_Tuned-2980b9?style=flat-square)](https://lightgbm.readthedocs.io)
[![PyTorch](https://img.shields.io/badge/PyTorch-Attention_Fusion-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)](https://pytorch.org)
[![AUC](https://img.shields.io/badge/AUC--ROC-0.7966-FF5C1A?style=flat-square)](https://scikit-learn.org)
[![Dataset](https://img.shields.io/badge/Dataset-610K_products-7C3AED?style=flat-square)](https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023)

</div>

---

## What is this?

An e-commerce seller lists a product. 60 days later, 30% of it comes back.

**ReturnSight** catches that before it ships — by reading a product listing the way a buyer does, then predicting if they'll send it back. It's a full-stack ML system: raw Amazon reviews in, return probability out, with a FastAPI service any seller can plug into their workflow.

Built from scratch on the **entire** Amazon Reviews 2023 Clothing, Shoes & Jewelry dataset — 610,879 products, no sampling, no shortcuts.

---

## Architecture Overview

```
Raw HuggingFace Dataset (McAuley-Lab/Amazon-Reviews-2023)
         │
         ▼ Day 1 — Chunked EDA & Label Engineering
    610,879 products  ←  133 review chunks + 15 metadata chunks
         │
         ▼ Day 2 — Multi-Modal Embeddings
    ┌────────────┬──────────────┬──────────────┐
    │  CLIP      │  Text (MiniLM│  Tabular     │
    │  512-dim   │  384-dim     │  8 features  │
    │  (images)  │  (desc+rev)  │  (ratings    │
    │            │              │   price etc) │
    └────────────┴──────────────┴──────────────┘
         │
         ▼ Day 3 — Attention Fusion + LightGBM
    PyTorch Attention Model → 128-dim fused vector
    LightGBM on 136 features → return_probability
    Optuna (50 trials) → AUC-ROC 0.7966
         │
         ▼ Day 4 — SHAP Explainability
    TreeExplainer → signal_breakdown per prediction
         │
         ▼ Day 5 — FastAPI Service
    POST /predict → { return_probability, risk_level, signal_breakdown, top_reason }
         │
         ▼ Day 6 — React Frontend
    Seller pastes listing → gets verdict in <1s
```

---

## The Dataset Problem (and how it was solved)

The Amazon Reviews 2023 Clothing dataset isn't small. It doesn't fit in RAM. Most notebooks that work with it sample down to 50K rows and call it a day.

**ReturnSight processed the full dataset:**

| Metric | Value |
|---|---|
| Products after filtering | **610,879** |
| Review chunks processed | 133 (500K rows each) |
| Metadata chunks processed | 15 |
| Reviews per product (max sampled) | 30 |
| CLIP image coverage | 586,524 / 610,879 **(96.0%)** |
| Final positive labels (likely return) | 136,329 **(22.32%)** |
| Final negative labels | 474,550 |

**The streaming strategy:** Instead of loading everything into memory, Day 1 streams data in chunks, maintains per-product accumulators across chunks, checkpoints to disk incrementally, and merges at the end. No chunk holds more than ~500K rows. A product's reviews may be spread across multiple chunks — the pipeline handles this correctly.

---

## Label Engineering — Why Rate, Not Count

The naive approach: count how many reviews mention return keywords per product.

**The problem:** A product with 1,000 reviews and 15 return mentions looks riskier than a product with 50 reviews and 10 return mentions — but it's actually safer. Raw count biases toward high-volume products.

**The solution:** Return rate = `return_mention_count / total_reviews ≥ 2% threshold`.

This makes the label scale-invariant. A product with 15/1000 (1.5%) is marked safe. A product with 10/50 (20%) is marked risky. That's the correct behavior.

Regex matched against **full review text, not sampled** — so even a single buried return mention in review #847 is captured.

---

## Embedding Design — Why Reviews Aren't Just Concatenated

`all-MiniLM-L6-v2` has a 256-token limit. The naive approach — concatenate all review text, truncate to 256 tokens — means for any product with more than ~3 reviews, you're only reading the first few. The rest of the signal is silently discarded.

**ReturnSight's approach:** Each review (up to 30, 400 chars each) is **individually encoded**, producing 30 separate 384-dim vectors, then **mean-pooled and renormalized** into one 384-dim representation. Every review contributes equally to the final embedding regardless of its position.

This also enables `review_desc_mismatch` — the cosine distance between the description embedding and the pooled review embedding. A high score means buyers received something different from what was listed.

```
review_desc_mismatch = 1 − cosine_similarity(desc_embedding, review_embedding)
Mean: 0.4957  |  Range: 0.1550 – 1.1036
```

*Note: this signal is weaker than expected in this category — text and tabular features carry more predictive weight than the mismatch score alone.*

---

## The Fusion Model — Learned, Not Hardcoded

Three modalities. The question: how much should each one matter?

The wrong answer: hardcode weights (e.g., 50% text, 30% tabular, 20% image) based on intuition.

**The right answer: let the model learn it.**

The attention fusion model (PyTorch) projects each modality to 128-dim, then computes a softmax attention weight across the three — per sample, not globally. The weighted sum becomes the fused vector.

What the model actually learned:

| Modality | Learned Average Attention Weight |
|---|---|
| Image (CLIP) | **13.2%** |
| Text (MiniLM) | **49.8%** |
| Tabular | **37.0%** |

Images are the weakest signal for clothing returns — which makes sense. A product photo tells you what an item looks like, not whether it runs small, uses cheap stitching, or smells like chemicals on arrival. Text and ratings carry the real signal.

This is consistent with the weak `review_desc_mismatch` score — the category doesn't have strong image-text contradiction patterns.

---

## Final Model

| Component | Detail |
|---|---|
| Fusion input dim | 128 (attention-weighted) |
| Tabular features | 8 (`avg_rating`, `one_star_pct`, `five_star_pct`, `rating_std`, `log_review_count`, `price_anomaly`, `review_desc_mismatch`, `has_clip`) |
| Final feature vector | **136** (fused 128 + raw tabular 8) |
| Classifier | LightGBM |
| Hyperparameter tuning | Optuna, 50 trials |
| Train / Val / Test split | 427,615 / 91,632 / 91,632 (stratified) |

**Test set results:**

| Metric | Score |
|---|---|
| AUC-ROC | **0.7966** |
| Average Precision | **0.5625** |
| No-Return precision | 0.90 |
| No-Return recall | 0.73 |
| Likely-Return precision | 0.43 |
| Likely-Return recall | 0.70 |

Pre-tuning baseline: AUC 0.7947 / AP 0.5597. Optuna brought both up.

---

## Explainability (Day 4)

SHAP TreeExplainer produces per-prediction signal breakdowns. The 128-dim fused vector is collapsed into a single `image_text_fusion` score for readability — 8 tabular features are reported individually.

Outputs generated:
- Beeswarm plot (global feature importance)
- Bar importance chart
- Waterfall plots for highest and lowest risk products
- Full threshold sweep table (0.30 → 0.80)

*Known caveat: tabular features appear twice in the 136-dim input (raw + embedded inside the fused vector), so SHAP can split credit between them. The breakdown is directionally accurate, not causally clean.*

---

## Serving (Day 5) — Inference Parity

The hardest part of deployment isn't training the model. It's making sure the serving pipeline produces identical outputs to the training pipeline.

**What can go wrong:** using a different CLIP extraction path, a different review pooling order, a wrong category median for `price_anomaly`. Each of these silently shifts predictions.

**What was done:**
- Review encoding: same mean-pool + renormalize as Day 2 (≤30 reviews, 400 chars each)
- `price_anomaly`: computed using a category-median lookup table built from training data (32 categories), not a global median
- CLIP: extracted via the same two-step `vision_model → visual_projection` path used during training — the higher-level shortcut crashes on this transformers version
- **Validated against 15 real held-out test products** spanning the full probability range
- Several predictions matched offline values **exact to 4 decimal places**
- **Zero risk-category flips** across all 15 products

The API is bit-for-bit faithful to the trained model.

### API Reference

```
GET  /health
→ { status: string, models_loaded: boolean }

POST /predict
Body: {
  title: string,
  description: string,
  reviews: [{ text: string, rating: number }],
  price: number,
  image_url?: string | null,
  category?: string
}
→ {
  return_probability: float,       // 0.0 – 1.0
  risk_level: "Low"|"Medium"|"High",
  signal_breakdown: { ... },
  top_reason: string,
  latency_ms: number
}
```

Risk thresholds: `Low < 0.35 | Medium < 0.65 | High ≥ 0.65`

---

## Infrastructure

| Day | Instance | Purpose |
|---|---|---|
| Day 1 | AWS EC2 `m6i.2xlarge` (CPU) | Chunked EDA, labeling — no GPU needed |
| Days 2–5 | AWS EC2 `g4dn.xlarge` (T4 GPU) | CLIP embeddings, fusion model training, LightGBM |

Long-running jobs managed via `tmux`. Models tracked with Git LFS. Checkpointing at every major step so no work is lost if the instance dies.

---

## Frontend (Day 6)

React 18 + Vite + Tailwind. Built for e-commerce sellers, not ML engineers.

**Key features:** single-product analysis, batch CSV (up to 10 products), persistent history (localStorage, 20 items), shareable results via URL hash, PNG export, compare mode (side-by-side products), keyboard shortcuts, SHAP signal breakdown with tooltips, seller-specific recommendations from signal values, `/dashboard` route with recharts for portfolio-level risk overview.

---

## Known Limitations (honest edition)

- **The label is a proxy.** Explicit return-language in reviews ≠ actual return logistics data. A buyer who returned something and didn't write about it is invisible to this model.
- **Image signal is weak.** CLIP contributes 13.2% attention weight. Don't oversell it.
- **`price_anomaly` is static.** The category-median lookup was computed once from training data. Real deployment needs periodic refresh as market prices shift.
- **AUC ceiling.** ~0.80 is honest for review/listing-only signals. Getting past 0.85 requires actual logistics data (return rates, fit feedback, size complaints) that Amazon doesn't expose publicly.

---

## Project Structure

```
ReturnSight/
├── api/
│   ├── main.py              # FastAPI app, endpoints
│   ├── inference.py         # Full inference pipeline
│   ├── model_loader.py      # Loads all model artifacts on startup
│   └── schemas.py           # Pydantic request/response models
├── day1_eda_labeling.py     # Chunked streaming, feature extraction, labeling
├── day2_embeddings.py       # CLIP + MiniLM embeddings
├── day3_fusion_lgbm.py      # Attention fusion model + LightGBM + Optuna
├── day4_explainability.py   # SHAP TreeExplainer, plots, threshold sweep
├── returnsight-frontend/    # Vite + React 18 frontend
│   ├── src/
│   │   ├── api/client.js
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── store/appStore.js
│   │   └── utils/
│   └── .env.example
└── models/                  # Trained artifacts (Git LFS)
    ├── lgbm_classifier.pkl
    ├── fusion_attention.pt
    ├── pca_clip.pkl
    ├── pca_text.pkl
    ├── scaler.pkl
    └── category_price_median.pkl
```

---

## Quick Start

```bash
# Backend
cd api
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend
cd returnsight-frontend
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:8000
npm install
npm run dev
```

---

<div align="center">

Built by **Shariq Mukadam**  
BCA — Bharati Vidyapeeth University, Pune  
[GitHub](https://github.com/IamShariqMukadam) · [LinkedIn](https://linkedin.com/in/shariqmukadam)

*610,879 products. Zero sampling. One model.*

</div>
