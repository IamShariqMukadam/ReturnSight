import pandas as pd

df       = pd.read_parquet("data/processed/products_labeled.parquet")
img_meta = pd.read_parquet("/tmp/image_meta.parquet")

df = df.drop(columns=['image_url'], errors='ignore')
df = df.merge(img_meta[['parent_asin','image_url','image_count']], 
              on='parent_asin', how='left')

df.to_parquet("data/processed/products_labeled.parquet", index=False)
print(f"Done. image_url populated: {df['image_url'].notna().sum():,}")