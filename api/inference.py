import numpy as np
import torch
import requests
from io import BytesIO
from PIL import Image
from api import model_loader as ml

FUSE_DIM = 128
MAX_REVIEWS = 30   # must match Day 1's SAMPLE_REVIEWS_N
TAB_FEATURES = [
    'avg_rating', 'one_star_pct', 'five_star_pct', 'rating_std',
    'log_review_count', 'price_anomaly', 'review_desc_mismatch', 'has_clip'
]

def _fetch_image(url: str):
    try:
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            return Image.open(BytesIO(r.content)).convert('RGB')
    except:
        pass
    return None

def predict(req) -> dict:
    """Full inference pipeline. req is a PredictRequest."""
    device = ml.DEVICE

    # ── 1. COMPUTE TABULAR FEATURES ─────────────────────────
    ratings = [r.rating for r in req.reviews]
    texts   = [r.text   for r in req.reviews]

    avg_rating    = float(np.mean(ratings))         if ratings else 3.0
    one_star_pct  = float(np.mean([r == 1 for r in ratings])) if ratings else 0.0
    five_star_pct = float(np.mean([r == 5 for r in ratings])) if ratings else 0.0
    rating_std    = float(np.std(ratings))          if len(ratings) > 1 else 0.0
    log_review_count = float(np.log1p(len(ratings)))

    # price_anomaly — real category-median lookup (built by build_price_lookup.py
    # from Day 1/3's training data), not a hardcoded stub. Falls back to the
    # global median for any category not seen during training.
    cat_median = ml.price_lookup["by_category"].get(
        req.category, ml.price_lookup["global"]
    )
    price_anomaly = float(req.price / (cat_median + 1e-6))

    # ── 2. TEXT EMBEDDINGS + MISMATCH SCORE ─────────────────
    # Must mirror Day 2's Fix A exactly: encode each review individually
    # and mean-pool, NOT concatenate-then-truncate — that's what removed
    # the 256-token ceiling on the training side, so serving has to match.
    title_part = req.title.strip()[:150]
    desc_part  = req.description.strip()[:400]
    desc_text  = f"{title_part} {desc_part}".strip()

    review_texts_individual = [t.strip()[:400] for t in texts if t.strip()][:MAX_REVIEWS]
    has_review_text = bool(review_texts_individual)

    all_embs = ml.st_model.encode(
        [desc_text] + (review_texts_individual if has_review_text else []),
        normalize_embeddings=True,
        show_progress_bar=False
    )
    desc_emb = all_embs[0]

    if has_review_text:
        review_emb = np.mean(all_embs[1:], axis=0)
        r_norm = np.linalg.norm(review_emb)
        if r_norm > 0:
            review_emb = review_emb / r_norm
    else:
        # No usable review text -> true zero vector, matching Day 2's
        # pre-allocated np.zeros that's never written to in this case.
        review_emb = np.zeros(384, dtype=np.float32)

    combined_emb = (desc_emb + review_emb) / 2.0
    c_norm = np.linalg.norm(combined_emb)
    if c_norm > 0:
        combined_emb = combined_emb / c_norm

    review_desc_mismatch = float(1 - np.dot(desc_emb, review_emb))

    # ── 3. CLIP IMAGE EMBEDDING ─────────────────────────────
    has_clip   = 0.0
    clip_input = np.zeros((1, 512), dtype=np.float32)

    if req.image_url:
        img = _fetch_image(req.image_url)
        if img:
            with torch.no_grad():
                inp    = ml.clip_proc(images=[img], return_tensors="pt").to(device)
                # FIX: get_image_features(**inp) was returning the raw vision-model
                # output (BaseModelOutputWithPooling) instead of the final projected
                # tensor in this transformers version, crashing on .norm(). Day 2's
                # CLIP step never hits this because it already does the same two
                # manual steps below instead of calling get_image_features(). Match
                # that proven path exactly so training and serving stay consistent.
                vision = ml.clip_model.vision_model(pixel_values=inp['pixel_values'])
                emb    = ml.clip_model.visual_projection(vision.pooler_output)
                emb    = emb / emb.norm(dim=-1, keepdim=True)
                clip_input = emb.cpu().numpy()
                has_clip   = 1.0

    # ── 4. PCA REDUCE ────────────────────────────────────────
    clip_reduced = ml.pca_clip.transform(clip_input).astype(np.float32)         # (1, 64)
    text_reduced = ml.pca_text.transform(combined_emb.reshape(1, -1)).astype(np.float32)  # (1, 64)

    # ── 5. SCALE TABULAR ─────────────────────────────────────
    tab_values = np.array([[
        avg_rating, one_star_pct, five_star_pct, rating_std,
        log_review_count, price_anomaly, review_desc_mismatch, has_clip
    ]], dtype=np.float32)
    tab_scaled = ml.scaler.transform(tab_values).astype(np.float32)

    # ── 6. ATTENTION FUSION ──────────────────────────────────
    with torch.no_grad():
        clip_t = torch.tensor(clip_reduced).to(device)
        text_t = torch.tensor(text_reduced).to(device)
        tab_t  = torch.tensor(tab_scaled).to(device)
        _, fused, attn_weights = ml.fusion(clip_t, text_t, tab_t)
        fused_np = fused.cpu().numpy()              # (1, 128)
        attn_np  = attn_weights.cpu().numpy()[0]    # (3,) — [clip, text, tabular]

    # ── 7. LIGHTGBM PREDICT ──────────────────────────────────
    X = np.hstack([fused_np, tab_scaled])           # (1, 136)
    prob = float(ml.lgbm.predict(X)[0])

    # ── 8. SHAP EXPLANATION ──────────────────────────────────
    shap_vals = ml.shap_exp.shap_values(X)
    if isinstance(shap_vals, list):
        shap_vals = shap_vals[1]

    # Group: fused (128) → one value, then 8 tabular individually
    fused_shap   = float(shap_vals[0, :FUSE_DIM].sum())
    tab_shap     = shap_vals[0, FUSE_DIM:]

    shap_named = {TAB_FEATURES[i]: float(tab_shap[i]) for i in range(len(TAB_FEATURES))}

    # ── 9. BUILD RESPONSE ────────────────────────────────────
    risk_level = "Low" if prob < 0.35 else "Medium" if prob < 0.65 else "High"

    # Find dominant signal for top_reason
    signal_scores = {
        'review_mismatch': abs(shap_named['review_desc_mismatch']),
        'avg_rating':      abs(shap_named['avg_rating']),
        'one_star_pct':    abs(shap_named['one_star_pct']),
        'price_anomaly':   abs(shap_named['price_anomaly']),
        'image_text_fusion': abs(fused_shap),
    }
    top_signal = max(signal_scores, key=signal_scores.get)

    reasons = {
        'review_mismatch':   f"Reviews contradict the product description (mismatch score: {review_desc_mismatch:.2f})",
        'avg_rating':        f"Low average rating ({avg_rating:.1f}/5) from {len(ratings)} reviews",
        'one_star_pct':      f"High 1-star review rate ({one_star_pct:.0%})",
        'price_anomaly':     f"Suspicious pricing relative to category average (price/median ratio: {price_anomaly:.2f})",
        'image_text_fusion': f"Combined image and text signals indicate listing quality issues",
    }

    return {
        "return_probability": round(prob, 4),
        "risk_level":         risk_level,
        "signal_breakdown": {
            "image_text_fusion": round(fused_shap, 4),
            "avg_rating":        round(shap_named['avg_rating'], 4),
            "one_star_pct":      round(shap_named['one_star_pct'], 4),
            "price_anomaly":     round(shap_named['price_anomaly'], 4),
            "review_mismatch":   round(shap_named['review_desc_mismatch'], 4),
        },
        "top_reason": reasons[top_signal],
    }
