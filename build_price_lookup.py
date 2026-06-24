# build_price_lookup.py — run ONCE on EC2 after Day 3 finishes, takes seconds.
# No retraining, no re-scan, no download. Just reads the parquet already on disk.
import pandas as pd, pickle

df = pd.read_parquet("data/processed/products_with_features.parquet")
lookup = {
    "by_category": df.groupby('main_category')['price'].median().to_dict(),
    "global":      float(df['price'].median()),
}
pickle.dump(lookup, open("models/category_price_median.pkl", "wb"))
print(f"Saved models/category_price_median.pkl — {len(lookup['by_category'])} categories")
