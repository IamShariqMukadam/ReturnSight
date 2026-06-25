# ============================================================
# RETURNSIGHT — DAY 1: EDA, LEAKAGE-FREE PROXY LABELS, VISUALIZATIONS
# ============================================================
# WHY THIS VERSION:
#   - Original label: likely_return = f(avg_rating, one_star_pct).
#     Day 3 then used those same fields as features -> label leakage
#     (fake AUC 1.0000). Fixed by building the label from EXPLICIT
#     RETURN LANGUAGE found in review text instead.
#   - The regex is applied to chunk['text'] — i.e. EVERY verified
#     review row in every 500K chunk — NOT the 8-review
#     'sample_reviews' field (that field is only kept for Day 2's
#     mismatch-score text, display purposes). Full-text scan, not
#     a sample-based shortcut.
#   - avg_rating / one_star_pct / five_star_pct / rating_std are kept
#     as real, leakage-free Day 3 features since the label no longer
#     depends on them. rating_std is computed via a sum-of-squared-
#     ratings aggregate tracked alongside sum_rating at every level
#     (chunk -> merge -> final), so per-product rating variance is a
#     real signal rather than a placeholder.
#   - Image bug fixed inline: HF 'images' field is a DICT of arrays
#     (hi_res/large/thumb/variant), not a list of dicts.
#   - Every expensive step (review chunk download+aggregate, meta
#     chunk download, incremental merge) checks for existing output
#     first and skips it — this is the checkpoint/resume mechanism.
#     Nothing was deleted from the original pipeline; skip-if-exists
#     guards were added around it instead.
#   - Merge loop frees running_agg/new_chunk before the groupby (not
#     after) and runs gc.collect() every iteration — avoids holding
#     multiple multi-million-row copies in memory simultaneously.
#   - Merged chunk files are deleted right after their checkpoint is
#     safely written — only ever deletes data already durably
#     persisted in MERGE_CKPT, so resume-safety is unaffected. Keeps
#     scratch-disk usage from growing unbounded across a long run.
#   - LABEL FIX (this version): likely_return now uses
#     return_mention_RATE (>= 2%) instead of a raw return_mention_COUNT
#     (>= 1). The raw-count version meant a single return-mention review
#     out of a product's *entire* review history (could be thousands)
#     flipped the whole product to label=1 — i.e. the label was
#     mechanically biased toward high-review-count products regardless
#     of their true return rate. Rate-based thresholding fixes that.
#     Tune REVIEW_RATE_THRESHOLD below if the resulting class balance
#     looks off after running.
#   - SAMPLE SIZE FIX (this version): sample_reviews now stores the
#     first 30 verified reviews per product (was 3, then 8). Raised
#     further because Day 2 now MEAN-POOLS each review's embedding
#     individually instead of concatenating all reviews into one string
#     and encoding once — concatenation hit a hard ceiling at the
#     sentence-transformer's 256-token limit, so going past ~8 reviews
#     was previously pointless (silently truncated away). Pooling has
#     no such ceiling, so 30 now gives meaningfully more coverage for
#     high-volume products, not just low-volume ones.
# RUN ON EC2 (CPU/disk-bound) — scratch dir lives on the EBS root
# volume (~/ReturnSight/scratch/), not /tmp (often a small tmpfs
# mount with far less room than the real disk).
# ============================================================

import os, gc, re, warnings
import matplotlib
matplotlib.use('Agg')
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datasets import load_dataset
from sklearn.feature_extraction.text import CountVectorizer

warnings.filterwarnings('ignore')

# ── CONFIG ──────────────────────────────────────────────────
os.environ.setdefault('HF_DATASETS_CACHE', os.path.expanduser('~/ReturnSight/scratch/hf_cache'))

CATEGORY       = "Clothing_Shoes_and_Jewelry"
MIN_REVIEWS    = 5
CHUNK_SIZE     = 500_000
CHUNK_DIR      = os.path.expanduser("~/ReturnSight/scratch/chunks")
META_CHUNK_DIR = os.path.expanduser("~/ReturnSight/scratch/meta_chunks")
PROC           = "data/processed"
PLOTS          = "outputs/plots"
MERGE_CKPT     = os.path.expanduser("~/ReturnSight/scratch/merge_checkpoint.parquet")
MERGE_CKPT_IDX = os.path.expanduser("~/ReturnSight/scratch/merge_checkpoint_idx.txt")
CKPT_EVERY     = 15
SAMPLE_REVIEWS_N        = 30    # was 3, then 8 — see Fix A note above
REVIEW_RATE_THRESHOLD   = 0.02  # label fix: rate-based, not raw count >= 1

for d in [CHUNK_DIR, META_CHUNK_DIR, PROC, PLOTS, "data/raw"]:
    os.makedirs(d, exist_ok=True)

# ── RETURN-MENTION REGEX (applied to FULL review text, every row) ──
RETURN_PATTERN = re.compile(
    r"\b("
    r"returned (it|this|the item|the product|them)|"
    r"had to return|ended up returning|"
    r"return(ed|ing)? for a refund|"
    r"sending (it|this|them) back|sent (it|this|them) back|send (it|this|them) back|"
    r"returning (it|this|the item|the product|them)|"
    r"ask(ed|ing) for a refund|request(ed|ing) a refund|"
    r"got (my|a) (money back|refund)|refund(ed)? (my|the) money|"
    r"exchang(ed|ing) (it|this|them) for|"
    r"return label|request(ed|ing) a return|fil(ed|ing) a return"
    r")\b",
    re.IGNORECASE
)

# ── 1. CHUNKED LOAD + AGGREGATE REVIEWS (resumable — skips done chunks) ──
print("Loading and aggregating reviews in chunks...")
rev_ds = load_dataset(
    "McAuley-Lab/Amazon-Reviews-2023",
    f"raw_review_{CATEGORY}",
    split="full",
    trust_remote_code=True
)

total_chunks = (len(rev_ds) + CHUNK_SIZE - 1) // CHUNK_SIZE
print(f"Total chunks to process: {total_chunks}")

for i in range(0, len(rev_ds), CHUNK_SIZE):
    chunk_num  = i // CHUNK_SIZE + 1
    chunk_path = f"{CHUNK_DIR}/chunk_{chunk_num}.parquet"

    if os.path.exists(chunk_path):
        print(f"  Chunk {chunk_num}/{total_chunks} already exists, skipping")
        continue

    chunk = rev_ds.select(
        range(i, min(i + CHUNK_SIZE, len(rev_ds)))
    ).to_pandas()

    chunk = chunk[['parent_asin', 'rating', 'text', 'verified_purchase']].dropna()
    chunk = chunk[chunk['text'].str.len() > 10]
    chunk = chunk[chunk['verified_purchase'] == True]

    if len(chunk) == 0:
        del chunk
        continue

    # Full-text scan, every review row — NOT the sample field
    chunk['mentions_return'] = chunk['text'].str.contains(
        RETURN_PATTERN, na=False
    ).astype(int)

    stats = chunk.groupby('parent_asin').agg(
        sum_rating           = ('rating', 'sum'),
        sum_sq_rating         = ('rating', lambda x: (x**2).sum()),
        review_count         = ('rating', 'count'),
        one_star_count       = ('rating', lambda x: (x == 1).sum()),
        five_star_count      = ('rating', lambda x: (x == 5).sum()),
        return_mention_count = ('mentions_return', 'sum'),
        sample_reviews       = ('text',   lambda x: ' | '.join(x.head(SAMPLE_REVIEWS_N).tolist()))
    ).reset_index()

    stats.to_parquet(chunk_path, index=False)
    del chunk, stats
    print(f"  Chunk {chunk_num}/{total_chunks} saved")

# ── 2. INCREMENTAL MERGE — checkpointed every 15 chunks, resume safe ──
print("\nMerging chunks incrementally...")
chunk_files = sorted([
    f"{CHUNK_DIR}/chunk_{i}.parquet"
    for i in range(1, total_chunks + 1)
    if os.path.exists(f"{CHUNK_DIR}/chunk_{i}.parquet")
])

if os.path.exists(MERGE_CKPT):
    running_agg = pd.read_parquet(MERGE_CKPT)
    print(f"  Resuming merge from checkpoint | Products so far: {len(running_agg):,} | Remaining chunk files on disk: {len(chunk_files)}")
    # FIX: was resuming from a stored loop-position (MERGE_CKPT_IDX). That goes
    # stale because merged chunk files get DELETED after each checkpoint -- on
    # restart chunk_files rebuilds shorter, so the old position no longer lines
    # up and can silently skip remaining chunks. Whatever's left on disk IS
    # "not yet merged" by construction, so just start at 0, no position needed.
else:
    running_agg = None

for idx in range(len(chunk_files)):
    new_chunk = pd.read_parquet(chunk_files[idx])

    if running_agg is None:
        running_agg = new_chunk
    else:
        combined = pd.concat([running_agg, new_chunk], ignore_index=True)
        # Free old references BEFORE the groupby, not after — avoids holding
        # running_agg + new_chunk + combined in memory simultaneously.
        del running_agg, new_chunk
        running_agg = combined.groupby('parent_asin').agg(
            sum_rating           = ('sum_rating', 'sum'),
            sum_sq_rating         = ('sum_sq_rating', 'sum'),
            review_count         = ('review_count', 'sum'),
            one_star_count       = ('one_star_count', 'sum'),
            five_star_count      = ('five_star_count', 'sum'),
            return_mention_count = ('return_mention_count', 'sum'),
            # FIX: was ('sample_reviews', 'first') — discarded every chunk's
            # partial sample except whichever showed up first in the concat, since
            # one product's reviews are scattered across many chunks. Now flattens
            # both sides' partial samples and re-caps at SAMPLE_REVIEWS_N, so the
            # running total genuinely accumulates across all chunks.
            sample_reviews       = ('sample_reviews', lambda s: ' | '.join(
                [r for txt in s for r in str(txt).split(' | ') if r.strip()][:SAMPLE_REVIEWS_N]
            ))
        ).reset_index()
        del combined

    gc.collect()

    if (idx + 1) % CKPT_EVERY == 0 or (idx + 1) == len(chunk_files):
        running_agg.to_parquet(MERGE_CKPT, index=False)
        print(f"  Merged {idx+1}/{len(chunk_files)} | Unique products: {len(running_agg):,} | checkpoint saved")

        # Delete chunk files now that they're safely folded into MERGE_CKPT —
        # only deletes data already durably persisted elsewhere, so resume
        # safety is unaffected. Fixes unbounded scratch-disk growth.
        deleted = 0
        for cf in chunk_files[:idx + 1]:
            if os.path.exists(cf):
                os.remove(cf)
                deleted += 1
        if deleted:
            print(f"    Cleaned up {deleted} merged chunk file(s) from disk")

product_stats = running_agg.copy()
del running_agg
gc.collect()

# Rating fields — descriptive only now, NOT used to build the label.
# Safe to use as real Day 3 features.
product_stats['avg_rating']          = product_stats['sum_rating'] / product_stats['review_count']
product_stats['one_star_pct']        = product_stats['one_star_count'] / product_stats['review_count']
product_stats['five_star_pct']       = product_stats['five_star_count'] / product_stats['review_count']
product_stats['return_mention_rate'] = product_stats['return_mention_count'] / product_stats['review_count']

# True per-product rating variance — needs sum_sq_rating tracked at every
# aggregation level above. variance = E[x^2] - (E[x])^2, clipped to guard
# against tiny negative values from floating-point error.
variance = (product_stats['sum_sq_rating'] / product_stats['review_count']) - product_stats['avg_rating']**2
product_stats['rating_std'] = np.sqrt(variance.clip(lower=0))

product_stats = product_stats[
    product_stats['review_count'] >= MIN_REVIEWS
].reset_index(drop=True)
print(f"\nUnique products (>={MIN_REVIEWS} verified reviews): {len(product_stats):,}")

# ── LABEL — built from explicit return-mention text, NOT ratings ──
# RATE-based (>= REVIEW_RATE_THRESHOLD), not raw count >= 1. A raw-count
# threshold meant one return-mention out of e.g. 3,933 reviews (0.025%)
# weighed exactly the same as one out of 5 (20%) — mechanically biasing
# the label toward high-review-count products regardless of true return
# rate. Rate-based thresholding removes that bias.
product_stats['likely_return'] = (
    product_stats['return_mention_rate'] >= REVIEW_RATE_THRESHOLD
).astype(int)
return_rate = product_stats['likely_return'].mean()
print(f"\nReturn rate (rate-based label, threshold={REVIEW_RATE_THRESHOLD:.1%}): {return_rate:.2%}")
print(f"Products flagged likely_return=1: {product_stats['likely_return'].sum():,}")

# ── 3. LOAD METADATA + EXTRACT IMAGES (dict-of-arrays fix, resumable) ──
print("\nLoading metadata...")
meta_ds = load_dataset(
    "McAuley-Lab/Amazon-Reviews-2023",
    f"raw_meta_{CATEGORY}",
    split="full",
    trust_remote_code=True
)

def extract_image_fields(row_images):
    """HF 'images' is a DICT of arrays {'hi_res','large','thumb','variant'} —
    NOT a list of dicts. This was the bug causing null image_url originally."""
    if not isinstance(row_images, dict):
        return 0, None
    url = None
    for key in ('hi_res', 'large', 'thumb'):
        lst = row_images.get(key)
        if lst is not None and len(lst) > 0:
            url = str(lst[0])
            break
    hi = row_images.get('hi_res')
    lg = row_images.get('large')
    if hi is not None and len(hi) > 0:
        count = len(hi)
    elif lg is not None and len(lg) > 0:
        count = len(lg)
    else:
        count = 0
    return count, url

META_COLS  = ['parent_asin', 'title', 'description', 'price', 'main_category']
total_meta = (len(meta_ds) + CHUNK_SIZE - 1) // CHUNK_SIZE

for i in range(0, len(meta_ds), CHUNK_SIZE):
    chunk_num  = i // CHUNK_SIZE + 1
    chunk_path = f"{META_CHUNK_DIR}/meta_chunk_{chunk_num}.parquet"

    if os.path.exists(chunk_path):
        print(f"  Meta chunk {chunk_num}/{total_meta} already exists, skipping")
        continue

    chunk = meta_ds.select(
        range(i, min(i + CHUNK_SIZE, len(meta_ds)))
    ).to_pandas()

    counts, urls = [], []
    for imgs in chunk['images']:
        c, u = extract_image_fields(imgs)
        counts.append(c)
        urls.append(u)
    chunk['image_count'] = counts
    chunk['image_url']   = urls

    chunk = chunk[[c for c in META_COLS if c in chunk.columns] + ['image_count', 'image_url']].copy()
    chunk.to_parquet(chunk_path, index=False)
    del chunk, counts, urls
    print(f"  Meta chunk {chunk_num}/{total_meta} saved")

# ── 4. INCREMENTAL META MERGE — memory safe (avoids the chunk-7 OOM) ──
print("\nMerging metadata chunks (incremental, memory-safe)...")

def clean_desc(x):
    if isinstance(x, (list, np.ndarray)):
        text = ' '.join([str(i) for i in x if str(i).strip()])
        return text if text.strip() else None
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    val = str(x).strip()
    return val if val and val.lower() not in ('none', 'nan', '') else None

meta_files = sorted(
    [f"{META_CHUNK_DIR}/meta_chunk_{i}.parquet" for i in range(1, total_meta + 1)
     if os.path.exists(f"{META_CHUNK_DIR}/meta_chunk_{i}.parquet")]
)

merged_parts = []
for idx, fp in enumerate(meta_files):
    mchunk = pd.read_parquet(fp)
    mchunk['description'] = mchunk['description'].apply(clean_desc)
    mchunk = mchunk[mchunk['description'].notna()]

    matched = product_stats.merge(mchunk, on='parent_asin', how='inner')
    if len(matched) > 0:
        merged_parts.append(matched)
    del mchunk, matched
    gc.collect()
    print(f"  Processed meta chunk {idx+1}/{len(meta_files)}")

df = pd.concat(merged_parts, ignore_index=True).drop_duplicates('parent_asin')
del merged_parts, product_stats
gc.collect()
print(f"After merge + description filter: {len(df):,}")

df = df[df['image_count'] > 0].reset_index(drop=True)
print(f"After image filter: {len(df):,}")

# ── 5. PRICE CLEANING + ANOMALY ──────────────────────────────
df['price'] = df['price'].astype(str).str.replace(r'[^\d.]', '', regex=True)
df['price'] = pd.to_numeric(df['price'], errors='coerce')

global_median = df['price'].median()
df['price']   = df.groupby('main_category')['price'].transform(
    lambda x: x.fillna(x.median())
)
df['price']         = df['price'].fillna(global_median)
cat_median           = df.groupby('main_category')['price'].transform('median')
df['price_anomaly'] = df['price'] / (cat_median + 1e-6)

print(f"\nFinal label distribution:\n{df['likely_return'].value_counts()}")

# ── 6. SAVE ──────────────────────────────────────────────────
save_cols = [
    'parent_asin', 'avg_rating', 'review_count', 'one_star_pct',
    'five_star_pct', 'price', 'price_anomaly', 'main_category',
    'title', 'description', 'image_url', 'image_count',
    'sample_reviews', 'return_mention_count', 'return_mention_rate',
    'rating_std', 'likely_return'
]
df[save_cols].to_parquet(f"{PROC}/products_labeled.parquet", index=False)
print(f"\nSaved → {PROC}/products_labeled.parquet")

# ── 7. VISUALIZATIONS ────────────────────────────────────────
print("Generating plots...")
fig, axes = plt.subplots(1, 3, figsize=(20, 5))
fig.suptitle("ReturnSight — EDA (leakage-free label)", fontsize=14, fontweight='bold')

cat_ret = (df.groupby('main_category')['likely_return']
             .mean().sort_values(ascending=False).head(12))
cat_ret.plot(kind='bar', ax=axes[0], color='#e74c3c', edgecolor='black')
axes[0].set_title("Return Rate by Category")
axes[0].set_ylabel("Return Rate")
axes[0].tick_params(axis='x', rotation=45)
for bar, val in zip(axes[0].patches, cat_ret):
    axes[0].text(
        bar.get_x() + bar.get_width() / 2,
        bar.get_height() + 0.003,
        f'{val:.1%}', ha='center', va='bottom', fontsize=7
    )

for label, color, name in [(0, '#2ecc71', 'No Return'), (1, '#e74c3c', 'Likely Return')]:
    df[df['likely_return'] == label]['avg_rating'].hist(
        ax=axes[1], alpha=0.6, color=color, label=name, bins=25
    )
axes[1].set_title("Avg Rating Distribution by Return Label\n(label NOT built from rating — sanity check)")
axes[1].set_xlabel("Avg Rating")
axes[1].legend()

df['desc_clean'] = df['description'].fillna('')
cv = CountVectorizer(max_features=20, stop_words='english')
cv.fit(df['desc_clean'])
vocab = cv.get_feature_names_out()

overlap_data = {}
for label in [0, 1]:
    sub         = df[df['likely_return'] == label]
    all_reviews = ' '.join(sub['sample_reviews'].fillna('').tolist()).lower()
    total       = len(sub) + 1
    overlap_data[f'Return={label}'] = [all_reviews.count(w) / total for w in vocab]

overlap_df = pd.DataFrame(overlap_data, index=vocab)
sns.heatmap(overlap_df, ax=axes[2], cmap='YlOrRd',
            cbar_kws={'label': 'Avg frequency per product'})
axes[2].set_title("Description Keywords in Reviews\n(by Return Label)")

plt.tight_layout()
plt.savefig(f"{PLOTS}/day1_eda.png", dpi=150, bbox_inches='tight')
plt.close()
print(f"Plot saved → {PLOTS}/day1_eda.png")

# ── 8. SUMMARY ──────────────────────────────────────────────
print("\n=== DAY 1 SUMMARY ===")
print(df[['avg_rating', 'one_star_pct', 'review_count',
          'price_anomaly', 'return_mention_rate', 'likely_return']].describe().round(3))
print(f"\nFinal dataset       : {len(df):,} products")
print(f"Return class balance: {df['likely_return'].value_counts(normalize=True).round(3).to_dict()}")
print(f"Null prices remaining: {df['price'].isna().sum()}")
print("\nLabel built from explicit return-mention RATE (full reviews, all rows) —")
print("independent of avg_rating/one_star_pct/five_star_pct, now safe Day 3 features.")
print("\nDay 1 complete. Run day2_embeddings.py next.")
