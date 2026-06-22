#!pip install sentence-transformers -q
# ============================================================
# RETURNSIGHT — DAY 2: CLIP + SENTENCE-TRANSFORMER EMBEDDINGS
# ============================================================
# Generates three embedding types for 610K products:
#   1. CLIP image embeddings (512-dim) — visual signal
#   2. Sentence-transformer description embeddings (384-dim)
#   3. Sentence-transformer review embeddings (384-dim)
#   4. Combined text embeddings (384-dim) — fusion model input
#   5. Review-description mismatch score — key return signal
#
# NOTE: Image signal is weak (AI-generated product images are
# now standard on e-commerce). CLIP is retained in the
# architecture — the PyTorch attention layer will learn to
# downweight it. Primary signals = review mismatch + price.
#
# Resume-safe: each embedding saved immediately after encoding.
# Skips any step whose output file already exists on disk.
# CLIP checkpointed every 100K products — safe to resume after crash.
#
# Compatible with:
#   - GitHub Codespace (CPU, slow ~4-5hrs, capped at 20K for CLIP)
#   - Kaggle Notebook  (GPU P100/T4, full 610K) ← recommended
#
# Kaggle paths are auto-detected. Upload products_labeled.parquet
# as a Kaggle dataset input before running.
# ============================================================

import os
import gc
import glob
import numpy as np
import pandas as pd
import torch
import requests
from io import BytesIO
from PIL import Image
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
from transformers import CLIPProcessor, CLIPModel
from sentence_transformers import SentenceTransformer

# ── CONFIG ───────────────────────────────────────────────────
BATCH_SIZE_CLIP  = 64      # per GPU batch for CLIP
BATCH_SIZE_ST    = 256     # per GPU batch for sentence-transformer (64 on CPU)
CKPT_EVERY       = 100_000 # save CLIP checkpoint every N products
CPU_CLIP_CAP     = 20_000  # max products for CLIP on CPU to keep runtime < 2hrs

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# ── PATH DETECTION: Kaggle vs Codespace ──────────────────────
IS_KAGGLE = os.path.exists("/kaggle/working")

if IS_KAGGLE:
    # Kaggle: find uploaded parquet in /kaggle/input/
    parquet_candidates = glob.glob(
        "/kaggle/input/**/products_labeled.parquet", recursive=True
    )
    assert parquet_candidates, (
        "products_labeled.parquet not found in /kaggle/input/. "
        "Upload it as a Kaggle dataset first."
    )
    PARQUET_PATH  = parquet_candidates[0]
    EMB_DIR       = "/kaggle/working/embeddings"
    PROC_OUT      = "/kaggle/working"
    BATCH_SIZE_ST = 256
else:
    PARQUET_PATH  = "data/processed/products_labeled.parquet"
    EMB_DIR       = "embeddings"
    PROC_OUT      = "data/processed"
    BATCH_SIZE_ST = 256 if DEVICE == "cuda" else 64

CLIP_CKPT_DIR = f"{EMB_DIR}/clip_checkpoints"
os.makedirs(EMB_DIR, exist_ok=True)
os.makedirs(CLIP_CKPT_DIR, exist_ok=True)

print(f"Platform : {'Kaggle' if IS_KAGGLE else 'Codespace'}")
print(f"Device   : {DEVICE}")
print(f"Parquet  : {PARQUET_PATH}")
print(f"Emb dir  : {EMB_DIR}")

# ── LOAD DAY 1 OUTPUT ────────────────────────────────────────
df = pd.read_parquet(PARQUET_PATH)
print(f"\nLoaded {len(df):,} products")
print(f"Columns : {df.columns.tolist()}")
print(f"Return rate: {df['likely_return'].mean():.2%}")

# ────────────────────────────────────────────────────────────
# PART 1 — CLIP IMAGE EMBEDDINGS (512-dim)
# ────────────────────────────────────────────────────────────
# Extracts visual features from product images using OpenAI CLIP.
# L2-normalized so cosine similarity = dot product downstream.
# Checkpointed every 100K products — resume-safe across crashes.
# Amazon CDN requires browser-like headers to avoid 403 blocks.
# On CPU: capped at 20K products to keep runtime under 2hrs.
# On GPU: runs all products with checkpoints every 100K.
# ────────────────────────────────────────────────────────────

CLIP_EMB_PATH   = f"{EMB_DIR}/clip_embeddings.npy"
CLIP_ASINS_PATH = f"{EMB_DIR}/clip_asins.csv"

if os.path.exists(CLIP_EMB_PATH) and os.path.exists(CLIP_ASINS_PATH):
    print("\n--- CLIP Image Embeddings (already done, loading) ---")
    clip_embeddings = np.load(CLIP_EMB_PATH)
    clip_asins      = pd.read_csv(CLIP_ASINS_PATH)['parent_asin'].tolist()
    print(f"CLIP shape: {clip_embeddings.shape} | ASINs: {len(clip_asins):,}")
else:
    print("\n--- CLIP Image Embeddings ---")
    print("Loading CLIP model (openai/clip-vit-base-patch32, ~600MB)...")
    clip_model     = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(DEVICE)
    clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    clip_model.eval()

    def fetch_image(url):
        """Download product image with browser-like headers to bypass Amazon CDN blocks."""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.amazon.com/',
            'Connection': 'keep-alive',
        }
        try:
            r = requests.get(url, timeout=6, headers=headers)
            if r.status_code == 200:
                return Image.open(BytesIO(r.content)).convert('RGB')
        except Exception:
            pass
        return None

    df_img = df[df['image_url'].notna()].reset_index(drop=True)
    print(f"Products with image URLs: {len(df_img):,}")

    # CPU cap — CLIP on CPU takes ~3s/batch. 20K products ≈ 30 mins.
    # On GPU (Kaggle) — runs all products with checkpoints every 100K.
    if DEVICE == "cpu" and len(df_img) > CPU_CLIP_CAP:
        print(
            f"No GPU detected. Capping CLIP at {CPU_CLIP_CAP:,} products "
            f"to keep runtime under 2hrs. Run on Kaggle GPU for full coverage."
        )
        df_img = df_img.head(CPU_CLIP_CAP).reset_index(drop=True)

    # ── Load existing checkpoints to resume ──────────────────
    existing_ckpts = sorted(glob.glob(f"{CLIP_CKPT_DIR}/clip_ckpt_*.npy"))
    existing_ckpts = [f for f in existing_ckpts if '_asins' not in f]

    clip_embs_all  = []
    clip_asins_all = []
    start_product  = 0

    if existing_ckpts:
        print(f"Found {len(existing_ckpts)} existing checkpoint(s) — resuming...")
        for ckpt_path in existing_ckpts:
            ckpt_asins_path = ckpt_path.replace('.npy', '_asins.csv')
            clip_embs_all.append(np.load(ckpt_path))
            clip_asins_all.extend(
                pd.read_csv(ckpt_asins_path)['parent_asin'].tolist()
            )
        start_product = len(clip_asins_all)
        print(f"Resuming from product {start_product:,}/{len(df_img):,}")

    clip_embs_batch = []
    clip_asins      = list(clip_asins_all)
    products_done   = start_product
    max_workers     = 16 if DEVICE == "cuda" else 8

    for i in tqdm(
        range(start_product, len(df_img), BATCH_SIZE_CLIP),
        desc="CLIP batches",
        initial=start_product // BATCH_SIZE_CLIP,
        total=len(df_img) // BATCH_SIZE_CLIP
    ):
        batch = df_img.iloc[i:i + BATCH_SIZE_CLIP]

        # Parallel image downloads
        images, asins = [], []
        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            futures = {
                ex.submit(fetch_image, row['image_url']): row['parent_asin']
                for _, row in batch.iterrows()
            }
            for future in as_completed(futures):
                img  = future.result()
                asin = futures[future]
                if img is not None:
                    images.append(img)
                    asins.append(asin)

        if not images:
            products_done += len(batch)
            continue

        with torch.no_grad():
            inp    = clip_processor(
                images=images, return_tensors="pt", padding=True
            ).to(DEVICE)
            vision = clip_model.vision_model(pixel_values=inp['pixel_values'])
            embs   = clip_model.visual_projection(vision.pooler_output)
            embs   = embs / embs.norm(dim=-1, keepdim=True)  # L2 normalize → unit sphere
            clip_embs_batch.append(embs.cpu().numpy())
            clip_asins.extend(asins)

        products_done += len(batch)

        # ── Save checkpoint every CKPT_EVERY products ────────
        if products_done % CKPT_EVERY < BATCH_SIZE_CLIP and clip_embs_batch:
            ckpt_num       = products_done // CKPT_EVERY
            ckpt_path      = f"{CLIP_CKPT_DIR}/clip_ckpt_{ckpt_num}.npy"
            ckpt_asins_path = f"{CLIP_CKPT_DIR}/clip_ckpt_{ckpt_num}_asins.csv"

            # Merge all checkpoints so far + current batch
            all_so_far = clip_embs_all + clip_embs_batch
            np.save(ckpt_path, np.vstack(all_so_far))
            pd.DataFrame({'parent_asin': clip_asins}).to_csv(
                ckpt_asins_path, index=False
            )
            print(f"\n  Checkpoint {ckpt_num} saved — {products_done:,}/{len(df_img):,} products done")

    # ── Merge all batches into final embeddings ───────────────
    all_embs = clip_embs_all + clip_embs_batch
    if all_embs:
        clip_embeddings = np.vstack(all_embs)
        clip_coverage   = len(clip_asins) / len(df_img)
        print(f"\nCLIP coverage: {len(clip_asins):,}/{len(df_img):,} ({clip_coverage:.1%})")
        if clip_coverage < 0.50:
            print(
                "WARNING: <50% image coverage. CDN URLs may be expired. "
                "Attention layer will learn to downweight image signal — expected and fine."
            )
    else:
        print(
            "WARNING: 0% image coverage — Amazon CDN is blocking requests. "
            "Saving zero embeddings. Fusion model will learn to ignore image modality."
        )
        clip_embeddings = np.zeros((len(df_img), 512), dtype=np.float32)
        clip_asins      = df_img['parent_asin'].tolist()

    # Save final merged embeddings
    np.save(CLIP_EMB_PATH, clip_embeddings)
    pd.Series(clip_asins, name='parent_asin').to_csv(CLIP_ASINS_PATH, index=False)
    print(f"Saved clip_embeddings.npy  shape: {clip_embeddings.shape}")

    del clip_model
    gc.collect()
    if DEVICE == "cuda":
        torch.cuda.empty_cache()

# ────────────────────────────────────────────────────────────
# PART 2 — SENTENCE-TRANSFORMER EMBEDDINGS (384-dim each)
# ────────────────────────────────────────────────────────────
# Model: all-MiniLM-L6-v2 — fast, 384-dim, strong on short text
#
# Three passes:
#   desc_embs    — what the SELLER says about the product
#   review_embs  — what BUYERS actually experienced
#   combined     — concat of both for the fusion input layer
#
# Mismatch score = 1 - cosine_similarity(desc, review)
#   → measures gap between seller claims and buyer experience
#   → high mismatch = product doesn't match its description = return risk
# ────────────────────────────────────────────────────────────

print("\n--- Sentence-Transformer Embeddings (all-MiniLM-L6-v2) ---")
st_model = SentenceTransformer('all-MiniLM-L6-v2')

def build_desc_text(row):
    """Seller-side text: title + description (truncated to avoid token overflow)."""
    title = str(row.get('title', '') or '').strip()
    desc  = str(row.get('description', '') or '').strip()
    return f"{title[:150]} {desc[:400]}".strip()

def build_review_text(row):
    """Buyer-side text: sample reviews aggregated in Day 1."""
    return str(row.get('sample_reviews', '') or '').strip()[:600]

print("Building text inputs...")
desc_texts   = df.apply(build_desc_text,   axis=1).tolist()
review_texts = df.apply(build_review_text, axis=1).tolist()
print(f"Text inputs ready: {len(desc_texts):,} products")

# ── 2a. Description embeddings ───────────────────────────────
DESC_EMB_PATH = f"{EMB_DIR}/desc_embeddings.npy"
if os.path.exists(DESC_EMB_PATH):
    print("\ndesc_embeddings.npy already exists — loading.")
    desc_embs = np.load(DESC_EMB_PATH)
else:
    print("\nEncoding product descriptions...")
    desc_embs = st_model.encode(
        desc_texts,
        batch_size=BATCH_SIZE_ST,
        show_progress_bar=True,
        normalize_embeddings=True,   # L2 normalize for cosine similarity
        convert_to_numpy=True
    )
    np.save(DESC_EMB_PATH, desc_embs)
    print(f"Saved desc_embeddings.npy  shape: {desc_embs.shape}")

# ── 2b. Review embeddings ─────────────────────────────────────
REV_EMB_PATH = f"{EMB_DIR}/review_embeddings.npy"
if os.path.exists(REV_EMB_PATH):
    print("review_embeddings.npy already exists — loading.")
    review_embs = np.load(REV_EMB_PATH)
else:
    print("\nEncoding customer reviews...")
    review_embs = st_model.encode(
        review_texts,
        batch_size=BATCH_SIZE_ST,
        show_progress_bar=True,
        normalize_embeddings=True,
        convert_to_numpy=True
    )
    np.save(REV_EMB_PATH, review_embs)
    print(f"Saved review_embeddings.npy  shape: {review_embs.shape}")

# ── MISMATCH SCORE ───────────────────────────────────────────
# Both embeddings are L2-normalized, so dot product = cosine similarity.
# mismatch = 1 - cosine_sim: 0=identical, 1=completely different
# High mismatch → seller description doesn't match buyer experience → return risk
mismatch = 1 - np.sum(desc_embs * review_embs, axis=1)
df['review_desc_mismatch'] = mismatch

m0 = df[df['likely_return'] == 0]['review_desc_mismatch'].mean()
m1 = df[df['likely_return'] == 1]['review_desc_mismatch'].mean()
print(f"\nMismatch score validation:")
print(f"  Return=0 (no return)    : {m0:.4f}")
print(f"  Return=1 (likely return): {m1:.4f}")
if m1 > m0:
    print("  Signal valid ✓ — return products have higher description-review mismatch")
else:
    print("  NOTE: Mismatch signal is weak on this category. Price/rating signals will compensate.")

# ── 2c. Combined text embeddings (for Day 3 fusion layer) ────
COMB_EMB_PATH = f"{EMB_DIR}/combined_text_embeddings.npy"
if os.path.exists(COMB_EMB_PATH):
    print("\ncombined_text_embeddings.npy already exists — loading.")
    combined_embs = np.load(COMB_EMB_PATH)
else:
    print("\nEncoding combined text (description + reviews)...")
    combined_texts = [
        f"{d} | {r}"
        for d, r in zip(desc_texts, review_texts)
    ]
    combined_embs = st_model.encode(
        combined_texts,
        batch_size=BATCH_SIZE_ST,
        show_progress_bar=True,
        normalize_embeddings=True,
        convert_to_numpy=True
    )
    np.save(COMB_EMB_PATH, combined_embs)
    print(f"Saved combined_text_embeddings.npy  shape: {combined_embs.shape}")

# ── SAVE ASIN INDEX + UPDATED PARQUET ────────────────────────
# text_asins.csv maps row index → parent_asin for all text embeddings
df['parent_asin'].to_csv(f"{EMB_DIR}/text_asins.csv", index=False)

# products_with_features.parquet = Day 1 parquet + mismatch score
# This is the primary input for Day 3 model training
df.to_parquet(f"{PROC_OUT}/products_with_features.parquet", index=False)
print(f"\nSaved text_asins.csv")
print(f"Saved products_with_features.parquet → {PROC_OUT}/")

# ── SUMMARY ──────────────────────────────────────────────────
print("\n" + "="*60)
print("DAY 2 COMPLETE — EMBEDDING SUMMARY")
print("="*60)
print(f"CLIP embeddings        : {clip_embeddings.shape}  (image signal)")
print(f"Description embeddings : {desc_embs.shape}  (seller claims)")
print(f"Review embeddings      : {review_embs.shape}  (buyer experience)")
print(f"Combined embeddings    : {combined_embs.shape}  (fusion input)")
print(f"\nMismatch score range   : {mismatch.min():.4f} – {mismatch.max():.4f}")
print(f"Mismatch mean (all)    : {mismatch.mean():.4f}")
print(f"\nFiles saved to → {EMB_DIR}/")
for fname in sorted(os.listdir(EMB_DIR)):
    fpath = f"{EMB_DIR}/{fname}"
    if os.path.isfile(fpath):
        size = os.path.getsize(fpath) / 1e6
        print(f"  {fname:<45} {size:>8.1f} MB")
print(f"\nUpdated parquet → {PROC_OUT}/products_with_features.parquet")
print("\nNext step: Run day3_fusion_model.py")