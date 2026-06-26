import pandas as pd, numpy as np, requests
from sklearn.model_selection import train_test_split

df = pd.read_parquet("data/processed/products_with_features.parquet")
labels = df['likely_return'].values.astype(np.float32)
idx = np.arange(len(df))
idx_trainval, idx_test = train_test_split(idx, test_size=0.15, stratify=labels, random_state=42)
y_test = np.load("models/y_test.npy")
y_pred = np.load("models/y_pred_prob_test.npy")
assert np.allclose(y_test, labels[idx_test]), "index mismatch"

test_df = df.iloc[idx_test].reset_index(drop=True)
test_df['offline_pred'] = y_pred
test_df['actual'] = y_test

samples = pd.concat([
    test_df[test_df.actual==1].sort_values('offline_pred', ascending=False).head(2),
    test_df[test_df.actual==0].sort_values('offline_pred').head(2),
    test_df.iloc[(test_df['offline_pred']-0.5).abs().argsort()[:1]],
])

def fake_ratings(row, n):
    # Approximate the REAL rating distribution instead of uniform round(avg_rating)
    one_n  = round(row['one_star_pct'] * n)
    five_n = round(row['five_star_pct'] * n)
    mid_n  = max(n - one_n - five_n, 0)
    mid_val = int(round(row['avg_rating']))
    mid_val = min(max(mid_val, 2), 4)
    ratings = [1]*one_n + [5]*five_n + [mid_val]*mid_n
    return ratings[:n] if ratings else [int(round(row['avg_rating']))]*n

for _, row in samples.iterrows():
    reviews = [r.strip() for r in str(row['sample_reviews']).split(' | ') if r.strip()][:5]
    rts = fake_ratings(row, len(reviews)) if reviews else []
    payload = {
        "title": str(row['title'])[:150],
        "description": str(row['description'])[:400],
        "price": float(row['price']),
        "reviews": [{"text": t, "rating": r} for t, r in zip(reviews, rts)],
        "image_url": None,
        "category": str(row['main_category']) if pd.notna(row['main_category']) else "Clothing_Shoes_and_Jewelry"
    }
    r = requests.post("http://localhost:8000/predict", json=payload, timeout=30)
    live = r.json()
    print(f"\nASIN {row['parent_asin']} | actual={'Return' if row['actual']==1 else 'No Return'} | offline={row['offline_pred']:.4f}")
    print(f"  real: avg_rating={row['avg_rating']:.2f} one_star%={row['one_star_pct']:.0%} five_star%={row['five_star_pct']:.0%} rating_std={row['rating_std']:.2f}")
    print(f"  fake ratings sent: {rts}")
    print(f"  live pred: {live.get('return_probability','ERR:'+str(live))} | risk: {live.get('risk_level')}")
