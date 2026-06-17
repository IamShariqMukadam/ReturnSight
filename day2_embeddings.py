# ============================================================
# RETURNSIGHT — DAY 2: CLIP + SENTENCE-TRANSFORMER EMBEDDINGS
# ============================================================
# NOTE: Image signal is weak (AI-generated product images are
# now standard on e-commerce). CLIP is retained in the
# architecture — the PyTorch attention layer will learn to
# downweight it. Primary signals = review mismatch + seller.

import os
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

# ── CONFIG ──────────────────────────────────────────────────
BATCH_SIZE = 32
EMB_DIR    = "embeddings"
PROC       = "data/processed"
DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"
os.makedirs(EMB_DIR, exist_ok=True)
print(f"Device: {DEVICE}")

# ── LOAD DAY 1 OUTPUT ────────────────────────────────────────
df = pd.read_parquet(f"{PROC}/products_labeled.parquet")
print(f"Loaded {len(df):,} products")

# ────────────────────────────────────────────────────────────
# PART 1 — CLIP IMAGE EMBEDDINGS (512-dim)
# ────────────────────────────────────────────────────────────
print("\n--- CLIP Image Embeddings ---")
print("Downloading CLIP model (~600MB, one-time)...")

clip_model     = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(DEVICE)
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
clip_model.eval()

def fetch_image(url):
    try:
        r = requests.get(url, timeout=6)
        if r.status_code == 200:
            return Image.open(BytesIO(r.content)).convert('RGB')
    except:
        pass
    return None

# df['image_url'] = df['images'].apply(extract_url)
df_img = df[df['image_url'].notna()].reset_index(drop=True)
print(f"Products with image URLs: {len(df_img):,}")

# Cap rows if no GPU to keep runtime under 2 hours
if DEVICE == "cpu":
    cap = 20_000
    if len(df_img) > cap:
        print(f"No GPU detected. Capping CLIP products at {cap:,} to keep runtime manageable.")
        df_img = df_img.head(cap).reset_index(drop=True)

clip_embs, clip_asins = [], []

for i in tqdm(range(0, len(df_img), BATCH_SIZE), desc="CLIP"):
    batch = df_img.iloc[i:i + BATCH_SIZE]

    # Parallel image downloads
    images, asins = [], []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {
            ex.submit(fetch_image, row['image_url']): row['parent_asin']
            for _, row in batch.iterrows()
        }
        for future in as_completed(futures):
            img  = future.result()
            asin = futures[future]
            if img:
                images.append(img)
                asins.append(asin)

    if not images:
        continue

    with torch.no_grad():
        inp  = clip_processor(images=images, return_tensors="pt", padding=True).to(DEVICE)
        embs = clip_model.get_image_features(**inp)
        embs = embs / embs.norm(dim=-1, keepdim=True)   # L2 normalize → 512-dim
        clip_embs.append(embs.cpu().numpy())
        clip_asins.extend(asins)

clip_embeddings = np.vstack(clip_embs)
np.save(f"{EMB_DIR}/clip_embeddings.npy", clip_embeddings)
pd.Series(clip_asins, name='parent_asin').to_csv(f"{EMB_DIR}/clip_asins.csv", index=False)

# Coverage report
clip_coverage = len(clip_asins) / len(df_img)
print(f"CLIP embeddings shape: {clip_embeddings.shape}")
print(f"CLIP coverage: {len(clip_asins):,}/{len(df_img):,} ({clip_coverage:.1%})")
if clip_coverage < 0.5:
    print("WARNING: <50% image coverage (expired CDN URLs). "
          "Attention layer will downweight image signal — this is expected and fine.")

del clip_model   # free VRAM/RAM before loading sentence-transformer

# ────────────────────────────────────────────────────────────
# PART 2 — SENTENCE-TRANSFORMER EMBEDDINGS (384-dim)
# ────────────────────────────────────────────────────────────
print("\n--- Sentence-Transformer Embeddings ---")
st_model = SentenceTransformer('all-MiniLM-L6-v2')

def build_desc_text(row):
    title = str(row.get('title', '') or '')
    desc  = str(row.get('description', '') or '')
    return f"{title[:150]} {desc[:400]}".strip()

def build_review_text(row):
    return str(row.get('sample_reviews', '') or '')[:600]

desc_texts   = df.apply(build_desc_text,   axis=1).tolist()
review_texts = df.apply(build_review_text, axis=1).tolist()

print("Encoding descriptions...")
desc_embs = st_model.encode(
    desc_texts,
    batch_size=64,
    show_progress_bar=True,
    normalize_embeddings=True
)   # (N, 384)

print("Encoding reviews...")
review_embs = st_model.encode(
    review_texts,
    batch_size=64,
    show_progress_bar=True,
    normalize_embeddings=True
)   # (N, 384)

# ── MISMATCH SCORE ───────────────────────────────────────────
# 1 - cosine_similarity(desc, reviews)
# Higher score = seller claims don't match buyer experience = return signal
mismatch = 1 - np.sum(desc_embs * review_embs, axis=1)
df['review_desc_mismatch'] = mismatch

# Validate mismatch is a meaningful signal
m0 = df[df['likely_return'] == 0]['review_desc_mismatch'].mean()
m1 = df[df['likely_return'] == 1]['review_desc_mismatch'].mean()
print(f"\nMismatch score — Return=0: {m0:.4f} | Return=1: {m1:.4f}")
if m1 > m0:
    print("Signal valid: return products have higher review-description mismatch ✓")
else:
    print("NOTE: Mismatch signal is weak on this subset. May improve with more data.")

# ── COMBINED TEXT EMBEDDING (for Day 3 fusion input) ─────────
combined_texts = [f"{d} | {r}" for d, r in zip(desc_texts, review_texts)]
print("\nEncoding combined text (for fusion layer)...")
combined_embs = st_model.encode(
    combined_texts,
    batch_size=64,
    show_progress_bar=True,
    normalize_embeddings=True
)   # (N, 384)

# ── SAVE ALL EMBEDDINGS ──────────────────────────────────────
np.save(f"{EMB_DIR}/desc_embeddings.npy",            desc_embs)
np.save(f"{EMB_DIR}/review_embeddings.npy",          review_embs)
np.save(f"{EMB_DIR}/combined_text_embeddings.npy",   combined_embs)
df['parent_asin'].to_csv(f"{EMB_DIR}/text_asins.csv", index=False)

# Save updated parquet with mismatch score for Day 3
df.to_parquet(f"{PROC}/products_with_features.parquet", index=False)

# ── SUMMARY ──────────────────────────────────────────────────
print("\n=== DAY 2 SUMMARY ===")
print(f"CLIP embeddings  : {clip_embeddings.shape}")
print(f"Desc embeddings  : {desc_embs.shape}")
print(f"Review embeddings: {review_embs.shape}")
print(f"Combined text    : {combined_embs.shape}")
print(f"\nFiles saved to → {EMB_DIR}/")
print(f"Updated parquet  → {PROC}/products_with_features.parquet")
print("\nDay 2 complete. Run day3_fusion_model.py next.")