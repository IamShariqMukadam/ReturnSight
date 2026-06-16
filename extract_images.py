# extract_images.py — extracts image_count + image_url from cached HF metadata
# No re-download. Reads from /tmp/hf_cache in small batches to avoid OOM.

import os, gc
import pandas as pd
from datasets import load_dataset

os.environ['HF_DATASETS_CACHE'] = "/tmp/hf_cache"

CATEGORY   = "Clothing_Shoes_and_Jewelry"
CHUNK_SIZE = 100_000
OUTPUT     = "/tmp/image_meta.parquet"

if os.path.exists(OUTPUT):
    print(f"Already exists: {OUTPUT}")
    exit(0)

print("Loading metadata from cache...")
meta_ds = load_dataset(
    "McAuley-Lab/Amazon-Reviews-2023",
    f"raw_meta_{CATEGORY}",
    split="full",
    trust_remote_code=True
)
print(f"Loaded: {len(meta_ds):,} records")

results = []
total   = len(meta_ds)

for i in range(0, total, CHUNK_SIZE):
    chunk    = meta_ds.select(range(i, min(i + CHUNK_SIZE, total)))
    chunk_df = chunk.select_columns(['parent_asin', 'images']).to_pandas()

    asins, counts, urls = [], [], []
    for _, row in chunk_df.iterrows():
        asins.append(row['parent_asin'])
        imgs = row['images']
        if isinstance(imgs, list) and imgs:
            counts.append(len(imgs))
            img = imgs[0]
            if isinstance(img, dict):
                urls.append(img.get('large') or img.get('hi_res') or img.get('thumb'))
            else:
                urls.append(str(img) if img else None)
        else:
            counts.append(0)
            urls.append(None)

    results.append(pd.DataFrame({
        'parent_asin': asins,
        'image_count': counts,
        'image_url':   urls
    }))
    del chunk, chunk_df, asins, counts, urls
    gc.collect()

    done = min(i + CHUNK_SIZE, total)
    if done % 1_000_000 < CHUNK_SIZE or done == total:
        print(f"  {done:,}/{total:,}")

image_meta = pd.concat(results, ignore_index=True).drop_duplicates('parent_asin')
del results
gc.collect()

image_meta.to_parquet(OUTPUT, index=False)
print(f"Done. Saved {len(image_meta):,} records → {OUTPUT}")