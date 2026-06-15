# ============================================================
# RETURNSIGHT — DAY 1: EDA, PROXY LABELS, VISUALIZATIONS
# ============================================================

import os, warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datasets import load_dataset
from sklearn.feature_extraction.text import CountVectorizer

warnings.filterwarnings('ignore')

# ── CONFIG ──────────────────────────────────────────────────
CATEGORY    = "Clothing_Shoes_and_Jewelry"   # or "Electronics"
MIN_REVIEWS = 5
MAX_ROWS    = 200_000    # None = full dataset; keep low while testing
PROC        = "data/processed"
PLOTS       = "outputs/plots"
for d in [PROC, PLOTS, "data/raw"]:
    os.makedirs(d, exist_ok=True)

# ── 1. LOAD DATA ─────────────────────────────────────────────
print("Loading reviews...")
rev_ds = load_dataset(
    "McAuley-Lab/Amazon-Reviews-2023",
    f"raw_review_{CATEGORY}",
    split="full",
    trust_remote_code=True
)
reviews_df = rev_ds.to_pandas()
if MAX_ROWS:
    reviews_df = reviews_df.sample(min(MAX_ROWS, len(reviews_df)), random_state=42)

print("Loading metadata...")
meta_ds = load_dataset(
    "McAuley-Lab/Amazon-Reviews-2023",
    f"raw_meta_{CATEGORY}",
    split="full",
    trust_remote_code=True
)
meta_df = meta_ds.to_pandas()
print(f"Reviews: {len(reviews_df):,} | Meta: {len(meta_df):,}")

# ── 2. CLEAN REVIEWS ─────────────────────────────────────────
reviews_df = reviews_df[['parent_asin', 'rating', 'text', 'verified_purchase']].dropna()
reviews_df = reviews_df[reviews_df['text'].str.len() > 10]

# Only verified purchases — removes fake/unverified review noise
reviews_df = reviews_df[reviews_df['verified_purchase'] == True]
print(f"Reviews after verified filter: {len(reviews_df):,}")

# ── 3. AGGREGATE PER PRODUCT ─────────────────────────────────
product_stats = reviews_df.groupby('parent_asin').agg(
    avg_rating    = ('rating', 'mean'),
    review_count  = ('rating', 'count'),
    one_star_pct  = ('rating', lambda x: (x == 1).mean()),
    five_star_pct = ('rating', lambda x: (x == 5).mean()),
    rating_std    = ('rating', 'std'),
    sample_reviews= ('text',   lambda x: ' | '.join(x.head(5)))
).reset_index()

product_stats = product_stats[product_stats['review_count'] >= MIN_REVIEWS]
print(f"Products (>={MIN_REVIEWS} verified reviews): {len(product_stats):,}")

# ── 4. CLEAN METADATA ────────────────────────────────────────
def clean_desc(x):
    if isinstance(x, list):
        text = ' '.join([str(i) for i in x if str(i).strip()])
        return text if text.strip() else None
    val = str(x).strip() if x else None
    return val if val else None

def get_image_count(x):
    return len(x) if isinstance(x, list) else 0

meta_df = meta_df[['parent_asin', 'title', 'description', 'price', 'images', 'main_category']].copy()
meta_df['description'] = meta_df['description'].apply(clean_desc)
meta_df['image_count'] = meta_df['images'].apply(get_image_count)

# Drop products with no usable description
meta_df = meta_df[meta_df['description'].notna()]
print(f"Meta after empty description drop: {len(meta_df):,}")

# ── 5. MERGE ─────────────────────────────────────────────────
df = product_stats.merge(meta_df, on='parent_asin', how='inner')
df = df[df['image_count'] > 0]
print(f"After merge + image filter: {len(df):,}")

# ── 6. PRICE CLEANING + ANOMALY ──────────────────────────────
df['price'] = df['price'].astype(str).str.replace(r'[^\d.]', '', regex=True)
df['price'] = pd.to_numeric(df['price'], errors='coerce')

# Fill null prices: category median first, then global median
global_median = df['price'].median()
df['price'] = df.groupby('main_category')['price'].transform(
    lambda x: x.fillna(x.median())
)
df['price'] = df['price'].fillna(global_median)

cat_median       = df.groupby('main_category')['price'].transform('median')
df['price_anomaly'] = df['price'] / (cat_median + 1e-6)

# ── 7. PROXY RETURN LABEL ────────────────────────────────────
df['likely_return'] = ((df['avg_rating'] < 2.5) & (df['one_star_pct'] > 0.50)).astype(int)

label_counts = df['likely_return'].value_counts()
return_rate  = df['likely_return'].mean()
print(f"\nLabel distribution:\n{label_counts}")
print(f"Return rate: {return_rate:.2%}")

# Auto-relax threshold if return rate is too low to be useful
if return_rate < 0.05:
    print("\nWARNING: Return rate <5%. Relaxing proxy label thresholds...")
    df['likely_return'] = ((df['avg_rating'] < 3.0) & (df['one_star_pct'] > 0.30)).astype(int)
    print(f"Relaxed return rate: {df['likely_return'].mean():.2%}")

# ── 8. SAVE ──────────────────────────────────────────────────
save_cols = [
    'parent_asin', 'avg_rating', 'review_count', 'one_star_pct',
    'five_star_pct', 'rating_std', 'price', 'price_anomaly',
    'main_category', 'title', 'description', 'images',
    'sample_reviews', 'likely_return'
]
df[save_cols].to_parquet(f"{PROC}/products_labeled.parquet", index=False)
print(f"\nSaved → {PROC}/products_labeled.parquet ({len(df):,} products)")

# ── 9. VISUALIZATIONS ────────────────────────────────────────
fig, axes = plt.subplots(1, 3, figsize=(20, 5))
fig.suptitle("ReturnSight — EDA", fontsize=14, fontweight='bold')

# Plot 1: Return rate by category
cat_ret = (df.groupby('main_category')['likely_return']
             .mean()
             .sort_values(ascending=False)
             .head(12))
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

# Plot 2: Rating distribution by return label
for label, color, name in [(0, '#2ecc71', 'No Return'), (1, '#e74c3c', 'Likely Return')]:
    df[df['likely_return'] == label]['avg_rating'].hist(
        ax=axes[1], alpha=0.6, color=color, label=name, bins=25
    )
axes[1].set_title("Avg Rating Distribution")
axes[1].set_xlabel("Avg Rating")
axes[1].legend()

# Plot 3: Description keyword frequency in reviews by return label
df['desc_clean'] = df['description'].fillna('')
cv = CountVectorizer(max_features=20, stop_words='english')
cv.fit(df['desc_clean'])
vocab = cv.get_feature_names_out()

overlap_data = {}
for label in [0, 1]:
    sub          = df[df['likely_return'] == label]
    all_reviews  = ' '.join(sub['sample_reviews'].fillna('').tolist()).lower()
    total        = len(sub) + 1
    overlap_data[f'Return={label}'] = [all_reviews.count(w) / total for w in vocab]

overlap_df = pd.DataFrame(overlap_data, index=vocab)
sns.heatmap(overlap_df, ax=axes[2], cmap='YlOrRd',
            cbar_kws={'label': 'Avg frequency per product'})
axes[2].set_title("Description Keywords in Reviews\n(by Return Label)")
axes[2].set_xlabel("Return Group")

plt.tight_layout()
plt.savefig(f"{PLOTS}/day1_eda.png", dpi=150, bbox_inches='tight')
plt.show()
print(f"Plot saved → {PLOTS}/day1_eda.png")

# ── 10. SUMMARY ──────────────────────────────────────────────
print("\n=== DAY 1 SUMMARY ===")
print(df[['avg_rating', 'one_star_pct', 'review_count', 'price_anomaly', 'likely_return']].describe().round(3))
print(f"\nFinal dataset: {len(df):,} products")
print(f"Return class balance: {df['likely_return'].value_counts(normalize=True).round(3).to_dict()}")
print(f"Null prices remaining: {df['price'].isna().sum()}")
print("\nDay 1 complete. Run day2_embeddings.py next.")