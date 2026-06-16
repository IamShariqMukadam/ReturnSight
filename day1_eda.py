# day1_resume.py — Resumes Day 1 AFTER all data is downloaded
# Reads directly from /tmp/chunks/ (133 files) and /tmp/meta_chunks/ (15 files)
# Does NOT touch HuggingFace / re-download anything

import os, gc, warnings
import matplotlib
matplotlib.use('Agg')
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.feature_extraction.text import CountVectorizer

warnings.filterwarnings('ignore')

MIN_REVIEWS    = 5
CHUNK_DIR      = "/tmp/chunks"
META_CHUNK_DIR = "/tmp/meta_chunks"
PROC           = "data/processed"
PLOTS          = "outputs/plots"
MERGE_CKPT     = "/tmp/merge_checkpoint.parquet"
MERGE_CKPT_IDX = "/tmp/merge_checkpoint_idx.txt"
CKPT_EVERY     = 15

for d in [PROC, PLOTS]:
    os.makedirs(d, exist_ok=True)

# ── STEP 1: Review merge — resume from checkpoint or load completed state ─────
chunk_files = sorted(
    [f"{CHUNK_DIR}/chunk_{i}.parquet" for i in range(1, 134)
     if os.path.exists(f"{CHUNK_DIR}/chunk_{i}.parquet")]
)
print(f"Review chunks on disk: {len(chunk_files)}/133")

assert os.path.exists(MERGE_CKPT), "ERROR: No merge checkpoint found. Cannot resume."

with open(MERGE_CKPT_IDX) as f:
    ckpt_idx = int(f.read().strip())

running_agg = pd.read_parquet(MERGE_CKPT)
print(f"Merge checkpoint: {ckpt_idx}/{len(chunk_files)} done | Products: {len(running_agg):,}")

if ckpt_idx < len(chunk_files):
    print("Resuming incomplete merge...")
    for idx in range(ckpt_idx, len(chunk_files)):
        new_chunk = pd.read_parquet(chunk_files[idx])
        combined  = pd.concat([running_agg, new_chunk], ignore_index=True)
        running_agg = combined.groupby('parent_asin').agg(
            sum_rating      = ('sum_rating',      'sum'),
            review_count    = ('review_count',    'sum'),
            one_star_count  = ('one_star_count',  'sum'),
            five_star_count = ('five_star_count', 'sum'),
            sample_reviews  = ('sample_reviews',  'first')
        ).reset_index()
        del combined, new_chunk
        if (idx + 1) % CKPT_EVERY == 0 or (idx + 1) == len(chunk_files):
            running_agg.to_parquet(MERGE_CKPT, index=False)
            with open(MERGE_CKPT_IDX, 'w') as f:
                f.write(str(idx + 1))
            print(f"  Merged {idx+1}/{len(chunk_files)} | Unique: {len(running_agg):,}")
else:
    print("Merge already complete.")

product_stats = running_agg.copy()
del running_agg
gc.collect()

product_stats['avg_rating']    = product_stats['sum_rating'] / product_stats['review_count']
product_stats['one_star_pct']  = product_stats['one_star_count'] / product_stats['review_count']
product_stats['five_star_pct'] = product_stats['five_star_count'] / product_stats['review_count']
product_stats['rating_std']    = 0.0
product_stats = product_stats[
    product_stats['review_count'] >= MIN_REVIEWS
].reset_index(drop=True)
print(f"Products (>={MIN_REVIEWS} verified reviews): {len(product_stats):,}")

# ── STEP 2: Load metadata incrementally + join image data ────
meta_files = sorted(
    [f"{META_CHUNK_DIR}/meta_chunk_{i}.parquet" for i in range(1, 20)
     if os.path.exists(f"{META_CHUNK_DIR}/meta_chunk_{i}.parquet")]
)
print(f"\nMeta chunks on disk: {len(meta_files)}")

image_meta = pd.read_parquet("/tmp/image_meta.parquet")
print(f"Image meta loaded: {len(image_meta):,} records")

META_KEEP = ['parent_asin', 'title', 'description', 'price', 'main_category']

merged_parts = []
for idx, fp in enumerate(meta_files):
    chunk     = pd.read_parquet(fp)
    available = [c for c in META_KEEP if c in chunk.columns]
    chunk     = chunk[available].merge(image_meta, on='parent_asin', how='left')
    matched   = product_stats.merge(chunk, on='parent_asin', how='inner')
    if len(matched) > 0:
        merged_parts.append(matched)
    del chunk, matched
    gc.collect()
    print(f"  Processed meta chunk {idx+1}/{len(meta_files)}")

df = pd.concat(merged_parts, ignore_index=True).drop_duplicates('parent_asin')
del merged_parts, product_stats, image_meta
gc.collect()
print(f"After merge: {len(df):,}")

# ── STEP 3: Clean description ─────────────────────────────────────────────────
def clean_desc(x):
    if isinstance(x, (list, np.ndarray)):
        text = ' '.join([str(i) for i in x if str(i).strip()])
        return text if text.strip() else None
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    val = str(x).strip()
    return val if val and val.lower() not in ('none', 'nan', '') else None

df['description'] = df['description'].apply(clean_desc)
df = df[df['description'].notna()].reset_index(drop=True)
print(f"After description filter: {len(df):,}")

# # ── STEP 4: Merge reviews + metadata ─────────────────────────────────────────
# df = product_stats.merge(meta_df, on='parent_asin', how='inner')
# del product_stats, meta_df
# gc.collect()

# # image_count already in meta chunks from extract_image_fields run earlier
# if 'image_count' in df.columns:
#     df = df[df['image_count'] > 0].reset_index(drop=True)
#     print(f"After merge + image filter: {len(df):,}")
# else:
#     print(f"After merge (no image_count column): {len(df):,}")

# ── STEP 5: Price cleaning + anomaly score ────────────────────────────────────
df['price'] = df['price'].astype(str).str.replace(r'[^\d.]', '', regex=True)
df['price'] = pd.to_numeric(df['price'], errors='coerce')
global_median = df['price'].median()
df['price'] = df.groupby('main_category')['price'].transform(
    lambda x: x.fillna(x.median())
)
df['price'] = df['price'].fillna(global_median)
cat_median = df.groupby('main_category')['price'].transform('median')
df['price_anomaly'] = df['price'] / (cat_median + 1e-6)

# ── STEP 6: Proxy return label ────────────────────────────────────────────────
df['likely_return'] = (
    (df['avg_rating'] < 2.5) & (df['one_star_pct'] > 0.50)
).astype(int)

return_rate = df['likely_return'].mean()
print(f"\nReturn rate (strict): {return_rate:.2%}")
if return_rate < 0.05:
    print("WARNING: <5% return rate — relaxing thresholds...")
    df['likely_return'] = (
        (df['avg_rating'] < 3.0) & (df['one_star_pct'] > 0.30)
    ).astype(int)
    print(f"Relaxed return rate: {df['likely_return'].mean():.2%}")

print(f"Label distribution:\n{df['likely_return'].value_counts()}")

# ── STEP 7: Save ─────────────────────────────────────────────────────────────
save_cols = [
    'parent_asin', 'avg_rating', 'review_count', 'one_star_pct',
    'five_star_pct', 'rating_std', 'price', 'price_anomaly',
    'main_category', 'title', 'description',
    'sample_reviews', 'likely_return'
]
# image_url optional — include if present
if 'image_url' in df.columns:
    save_cols.insert(save_cols.index('sample_reviews'), 'image_url')

df[save_cols].to_parquet(f"{PROC}/products_labeled.parquet", index=False)
print(f"\nSaved → {PROC}/products_labeled.parquet")

# ── STEP 8: Visualizations ───────────────────────────────────────────────────
print("Generating plots...")
fig, axes = plt.subplots(1, 3, figsize=(20, 5))
fig.suptitle("ReturnSight — EDA", fontsize=14, fontweight='bold')

cat_ret = (df.groupby('main_category')['likely_return']
             .mean().sort_values(ascending=False).head(12))
cat_ret.plot(kind='bar', ax=axes[0], color='#e74c3c', edgecolor='black')
axes[0].set_title("Return Rate by Category")
axes[0].set_ylabel("Return Rate")
axes[0].tick_params(axis='x', rotation=45)
for bar, val in zip(axes[0].patches, cat_ret):
    axes[0].text(bar.get_x() + bar.get_width() / 2,
                 bar.get_height() + 0.003,
                 f'{val:.1%}', ha='center', va='bottom', fontsize=7)

for label, color, name in [(0, '#2ecc71', 'No Return'), (1, '#e74c3c', 'Likely Return')]:
    df[df['likely_return'] == label]['avg_rating'].hist(
        ax=axes[1], alpha=0.6, color=color, label=name, bins=25)
axes[1].set_title("Avg Rating Distribution")
axes[1].set_xlabel("Avg Rating")
axes[1].legend()

df['desc_clean'] = df['description'].fillna('')
cv = CountVectorizer(max_features=20, stop_words='english')
cv.fit(df['desc_clean'])
vocab = cv.get_feature_names_out()

overlap_data = {}
for label in [0, 1]:
    sub = df[df['likely_return'] == label]
    all_reviews = ' '.join(sub['sample_reviews'].fillna('').tolist()).lower()
    total = len(sub) + 1
    overlap_data[f'Return={label}'] = [all_reviews.count(w) / total for w in vocab]

overlap_df = pd.DataFrame(overlap_data, index=vocab)
sns.heatmap(overlap_df, ax=axes[2], cmap='YlOrRd',
            cbar_kws={'label': 'Avg frequency per product'})
axes[2].set_title("Description Keywords in Reviews\n(by Return Label)")

plt.tight_layout()
plt.savefig(f"{PLOTS}/day1_eda.png", dpi=150, bbox_inches='tight')
plt.close()
print(f"Plot saved → {PLOTS}/day1_eda.png")

# ── STEP 9: Summary ───────────────────────────────────────────────────────────
print("\n=== DAY 1 SUMMARY ===")
print(df[['avg_rating', 'one_star_pct', 'review_count',
          'price_anomaly', 'likely_return']].describe().round(3))
print(f"\nFinal dataset       : {len(df):,} products")
print(f"Return class balance: {df['likely_return'].value_counts(normalize=True).round(3).to_dict()}")
print(f"Null prices remaining: {df['price'].isna().sum()}")
print("\nDay 1 complete. Run day2_embeddings.py next.")