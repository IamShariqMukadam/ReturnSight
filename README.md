## How it works — technical pipeline

### 1. Label Engineering (leakage-free)

The original naive approach — labeling returns from avg_rating and one_star_pct — caused fake AUC of *1.0000* because those features were then used in the model. Fixed by building labels from *explicit return-mention language* in raw review text using a regex pattern covering 14 distinct return/refund expressions ("returned it", "sending it back", "requested a refund", etc.).

Labels use a *rate-based threshold* (≥2% of reviews mention returns) rather than raw count, preventing bias toward high-volume products. This makes avg_rating, one_star_pct, five_star_pct, and rating_std leakage-free tabular features.

### 2. Data Processing

- *Source:* McAuley-Lab Amazon Reviews 2023 dataset (Clothing, Shoes & Jewelry), ~66M reviews, ~7.2M products
- *Processing:* Chunked streaming (500K rows/chunk) on EC2 with incremental merge checkpointing — avoids OOM on large datasets
- *Feature engineering:* log_review_count, price_anomaly (price ÷ category median), rating_std (computed via sum-of-squared-ratings aggregate across chunks), review_desc_mismatch

### 3. Multimodal Embeddings

*CLIP (image signal — 512-dim)*
- openai/clip-vit-base-patch32 encodes product images
- Uses vision_model + visual_projection directly (not get_image_features()) to match the training path exactly and avoid version-specific API inconsistencies
- L2-normalized for cosine similarity
- ~96% image coverage; zero-vector fallback for missing images — attention layer learns to downweight

*Sentence-Transformers (text signal — 384-dim)*
- all-MiniLM-L6-v2 encodes product descriptions and customer reviews
- Key fix: reviews encoded *individually then mean-pooled* (not concatenated) — concatenation hit a hard 256-token ceiling that silently truncated most review content
- review_desc_mismatch = 1 − cosine_similarity(desc_emb, review_emb) — measures gap between seller claims and buyer experience — strongest return predictor

### 4. Attention Fusion (PyTorch)

A custom 3-modality attention fusion layer projects CLIP (64-dim via PCA), text (64-dim via PCA), and tabular (8-dim) into a shared 128-dim space and learns per-sample attention weights:


CLIP → Linear(64→128) + LayerNorm + ReLU  ┐
Text → Linear(64→128) + LayerNorm + ReLU  ├─→ Softmax attention → Weighted sum → 128-dim fused
Tab  → Linear( 8→128) + LayerNorm + ReLU  ┘
                                            └→ Linear(128→64) → ReLU → Dropout(0.3) → Linear(64→1)


Trained with BCEWithLogitsLoss + scale_pos_weight for class imbalance. Validated AUC: *0.81+*

Average learned attention weights confirm expected signal strength:
- *Text: 0.397* (dominant)
- *Tabular: 0.389*
- *Image: 0.214* (weakest — AI-generated product photos contain little distinguishing information)

### 5. LightGBM Classifier

Final feature matrix: fused representation (128-dim) + raw tabular (8-dim) = *136 features*

- Hyperparameter tuning via *Optuna* (50 trials, TPE sampler) on held-out validation set
- Test set kept completely clean — never touched during tuning
- Baseline AUC: 0.8292 → Tuned AUC: *0.8302*
- scale_pos_weight handles 73/27 class imbalance

### 6. SHAP Explainability

shap.TreeExplainer on the LightGBM model. The 128 fused dimensions are collapsed to a single image_text_fusion SHAP value for human-readable attribution. Per-prediction explanations identify the dominant signal and generate seller-facing recommendations.

### 7. FastAPI Serving

- Lifespan context manager loads all models once at startup (~8s cold start)
- Inference: encode text → CLIP image fetch → PCA reduce → attention fusion → LightGBM → SHAP → response
- Latency: *~200–500ms* on CPU (DigitalOcean 4GB Droplet)
- Full CORS, Pydantic schemas, 503 retry logic