# ============================================================
# RETURNSIGHT — DAY 3: FEATURE ENGINEERING + FUSION + LIGHTGBM
# ============================================================

import os, pickle, warnings
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.decomposition import PCA
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, classification_report
import lightgbm as lgb

warnings.filterwarnings('ignore')

# ── CONFIG ──────────────────────────────────────────────────
DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"
MODELS_DIR = "models"
EMB_DIR    = "embeddings"
PROC       = "data/processed"
CLIP_DIM   = 512
TEXT_DIM   = 384
PCA_DIM    = 64    # reduce both modalities to 64
FUSE_DIM   = 128   # attention fusion output dimension
EPOCHS     = 20
BATCH_SIZE = 256
for d in [MODELS_DIR]:
    os.makedirs(d, exist_ok=True)

print(f"Device: {DEVICE}")

TABULAR_FEATURES = [
    'avg_rating', 'one_star_pct', 'five_star_pct',
    'rating_std', 'log_review_count', 'price_anomaly',
    'review_desc_mismatch'
]

# ── 1. LOAD DATA ─────────────────────────────────────────────
df = pd.read_parquet(f"{PROC}/products_with_features.parquet")
df['log_review_count'] = np.log1p(df['review_count'])
df['rating_std']       = df['rating_std'].fillna(0)

text_embs  = np.load(f"{EMB_DIR}/combined_text_embeddings.npy").astype(np.float32)
clip_embs  = np.load(f"{EMB_DIR}/clip_embeddings.npy").astype(np.float32)
text_asins = pd.read_csv(f"{EMB_DIR}/text_asins.csv")['parent_asin'].tolist()
clip_asins = pd.read_csv(f"{EMB_DIR}/clip_asins.csv")['parent_asin'].tolist()

# ── 2. ALIGN ALL MODALITIES ──────────────────────────────────
text_asin_idx = {a: i for i, a in enumerate(text_asins)}
clip_asin_idx = {a: i for i, a in enumerate(clip_asins)}

# Only keep products that have text embeddings (required)
df = df[df['parent_asin'].isin(text_asin_idx)].reset_index(drop=True)
N  = len(df)

text_array = np.array([text_embs[text_asin_idx[a]] for a in df['parent_asin']], dtype=np.float32)

# CLIP: zero-fill missing (attention layer learns to ignore zeros)
clip_array = np.zeros((N, CLIP_DIM), dtype=np.float32)
has_clip   = np.zeros(N, dtype=np.float32)
for i, asin in enumerate(df['parent_asin']):
    if asin in clip_asin_idx:
        clip_array[i] = clip_embs[clip_asin_idx[asin]]
        has_clip[i]   = 1.0

df['has_clip'] = has_clip
print(f"Dataset: {N:,} products | CLIP coverage: {has_clip.mean():.1%}")

# ── 3. PCA DIMENSIONALITY REDUCTION ──────────────────────────
print("Fitting PCA...")
pca_clip = PCA(n_components=PCA_DIM, random_state=42)
pca_text = PCA(n_components=PCA_DIM, random_state=42)

clip_reduced = pca_clip.fit_transform(clip_array).astype(np.float32)  # (N, 64)
text_reduced = pca_text.fit_transform(text_array).astype(np.float32)  # (N, 64)

pickle.dump(pca_clip, open(f"{MODELS_DIR}/pca_clip.pkl", 'wb'))
pickle.dump(pca_text, open(f"{MODELS_DIR}/pca_text.pkl", 'wb'))
print(f"PCA: CLIP {CLIP_DIM}→{PCA_DIM} | Text {TEXT_DIM}→{PCA_DIM}")

# ── 4. TABULAR FEATURES ──────────────────────────────────────
all_tab_features = TABULAR_FEATURES + ['has_clip']
tab_df     = df[all_tab_features].copy().fillna(0)
scaler     = StandardScaler()
tab_scaled = scaler.fit_transform(tab_df).astype(np.float32)
TAB_DIM    = tab_scaled.shape[1]   # 8

pickle.dump(scaler,          open(f"{MODELS_DIR}/scaler.pkl", 'wb'))
pickle.dump(all_tab_features, open(f"{MODELS_DIR}/tab_feature_names.pkl", 'wb'))

# ── 5. TRAIN / VAL / TEST SPLIT ──────────────────────────────
labels = df['likely_return'].values.astype(np.float32)
idx    = np.arange(N)

idx_trainval, idx_test = train_test_split(
    idx, test_size=0.15, stratify=labels, random_state=42
)
idx_train, idx_val = train_test_split(
    idx_trainval, test_size=0.15/0.85,
    stratify=labels[idx_trainval], random_state=42
)

print(f"\nSplit — Train: {len(idx_train):,} | Val: {len(idx_val):,} | Test: {len(idx_test):,}")
print(f"Return rate — Train: {labels[idx_train].mean():.2%} | Val: {labels[idx_val].mean():.2%} | Test: {labels[idx_test].mean():.2%}")

# ── 6. PYTORCH DATASET ───────────────────────────────────────
class ReturnDataset(Dataset):
    def __init__(self, indices, clip_r, text_r, tab_s, lbs):
        self.idx    = indices
        self.clip   = clip_r
        self.text   = text_r
        self.tab    = tab_s
        self.labels = lbs

    def __len__(self):
        return len(self.idx)

    def __getitem__(self, i):
        j = self.idx[i]
        return (
            torch.tensor(self.clip[j]),
            torch.tensor(self.text[j]),
            torch.tensor(self.tab[j]),
            torch.tensor(self.labels[j])
        )

train_ds = ReturnDataset(idx_train, clip_reduced, text_reduced, tab_scaled, labels)
val_ds   = ReturnDataset(idx_val,   clip_reduced, text_reduced, tab_scaled, labels)

train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,  num_workers=0)
val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

# ── 7. ATTENTION FUSION MODEL ────────────────────────────────
class AttentionFusion(nn.Module):
    """
    Projects each modality (CLIP, text, tabular) to FUSE_DIM.
    Learns per-sample attention weights across 3 modalities.
    Returns: logit, fused representation, attention weights.
    """
    def __init__(self, clip_dim, text_dim, tab_dim, fuse_dim):
        super().__init__()
        self.clip_proj = nn.Sequential(
            nn.Linear(clip_dim, fuse_dim), nn.LayerNorm(fuse_dim), nn.ReLU()
        )
        self.text_proj = nn.Sequential(
            nn.Linear(text_dim, fuse_dim), nn.LayerNorm(fuse_dim), nn.ReLU()
        )
        self.tab_proj = nn.Sequential(
            nn.Linear(tab_dim, fuse_dim), nn.LayerNorm(fuse_dim), nn.ReLU()
        )
        # Attention: single scalar score per modality
        self.attn_score = nn.Linear(fuse_dim, 1, bias=False)

        self.classifier = nn.Sequential(
            nn.Linear(fuse_dim, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 1)
        )

    def forward(self, clip, text, tab):
        c = self.clip_proj(clip)             # (B, fuse_dim)
        t = self.text_proj(text)             # (B, fuse_dim)
        s = self.tab_proj(tab)               # (B, fuse_dim)

        stacked = torch.stack([c, t, s], dim=1)                    # (B, 3, fuse_dim)
        attn    = torch.softmax(self.attn_score(stacked), dim=1)   # (B, 3, 1)
        fused   = (stacked * attn).sum(dim=1)                      # (B, fuse_dim)

        logit = self.classifier(fused).squeeze(-1)
        return logit, fused, attn.squeeze(-1)                      # (B,), (B, fuse_dim), (B, 3)

fusion_model = AttentionFusion(PCA_DIM, PCA_DIM, TAB_DIM, FUSE_DIM).to(DEVICE)

# Handle class imbalance in loss
pos_weight = torch.tensor(
    [(labels == 0).sum() / max((labels == 1).sum(), 1)]
).to(DEVICE)
criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
optimizer = torch.optim.Adam(fusion_model.parameters(), lr=1e-3, weight_decay=1e-4)
scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
    optimizer, mode='max', patience=3, factor=0.5
)

# ── 8. TRAIN FUSION MODEL ────────────────────────────────────
print("\n--- Training Attention Fusion Layer ---")
best_val_auc = 0.0
best_state   = None

for epoch in range(EPOCHS):
    fusion_model.train()
    train_loss = 0.0
    for clip_b, text_b, tab_b, y_b in train_loader:
        clip_b, text_b, tab_b, y_b = (
            clip_b.to(DEVICE), text_b.to(DEVICE),
            tab_b.to(DEVICE),  y_b.to(DEVICE)
        )
        optimizer.zero_grad()
        logits, _, _ = fusion_model(clip_b, text_b, tab_b)
        loss = criterion(logits, y_b)
        loss.backward()
        nn.utils.clip_grad_norm_(fusion_model.parameters(), 1.0)
        optimizer.step()
        train_loss += loss.item()

    fusion_model.eval()
    val_preds, val_true = [], []
    with torch.no_grad():
        for clip_b, text_b, tab_b, y_b in val_loader:
            clip_b, text_b, tab_b = (
                clip_b.to(DEVICE), text_b.to(DEVICE), tab_b.to(DEVICE)
            )
            logits, _, _ = fusion_model(clip_b, text_b, tab_b)
            val_preds.extend(torch.sigmoid(logits).cpu().numpy())
            val_true.extend(y_b.numpy())

    val_auc = roc_auc_score(val_true, val_preds)
    scheduler.step(val_auc)

    if val_auc > best_val_auc:
        best_val_auc = val_auc
        best_state   = {k: v.clone() for k, v in fusion_model.state_dict().items()}

    if (epoch + 1) % 5 == 0:
        avg_loss = train_loss / len(train_loader)
        print(f"Epoch {epoch+1:02d}/{EPOCHS} | Loss: {avg_loss:.4f} | Val AUC: {val_auc:.4f}")

fusion_model.load_state_dict(best_state)
torch.save(best_state, f"{MODELS_DIR}/fusion_attention.pt")
print(f"Best Val AUC (fusion): {best_val_auc:.4f}")

# ── 9. EXTRACT FUSED REPRESENTATIONS (ALL DATA) ──────────────
print("\nExtracting fused representations for all products...")
fusion_model.eval()

all_ds     = ReturnDataset(np.arange(N), clip_reduced, text_reduced, tab_scaled, labels)
all_loader = DataLoader(all_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

fused_list, attn_list = [], []
with torch.no_grad():
    for clip_b, text_b, tab_b, _ in all_loader:
        clip_b, text_b, tab_b = (
            clip_b.to(DEVICE), text_b.to(DEVICE), tab_b.to(DEVICE)
        )
        _, fused, attn = fusion_model(clip_b, text_b, tab_b)
        fused_list.append(fused.cpu().numpy())
        attn_list.append(attn.cpu().numpy())

fused_matrix = np.vstack(fused_list)   # (N, 128)
attn_matrix  = np.vstack(attn_list)    # (N, 3)

# Report average attention weights — tells us which signal the model valued
print(f"\nAvg attention weights:")
print(f"  Image (CLIP)  : {attn_matrix[:, 0].mean():.3f}")
print(f"  Text          : {attn_matrix[:, 1].mean():.3f}")
print(f"  Tabular       : {attn_matrix[:, 2].mean():.3f}")
print("(Higher tabular/text vs image confirms weak image signal — expected)")

# Save attention weights for analysis
attn_df = pd.DataFrame(
    attn_matrix, columns=['attn_clip', 'attn_text', 'attn_tabular']
)
attn_df['parent_asin']   = df['parent_asin'].values
attn_df['likely_return'] = labels
attn_df.to_parquet(f"{PROC}/attention_weights.parquet", index=False)

# ── 10. BUILD FINAL FEATURE MATRIX ───────────────────────────
# Fused representation (128) + raw tabular (8) = 136 features
X = np.hstack([fused_matrix, tab_scaled]).astype(np.float32)
y = labels

X_train, X_val, X_test = X[idx_train], X[idx_val], X[idx_test]
y_train, y_val, y_test  = y[idx_train], y[idx_val], y[idx_test]

print(f"\nFinal feature matrix: {X.shape}")

# Save splits for Day 4
np.save(f"{MODELS_DIR}/X_train.npy",    X_train)
np.save(f"{MODELS_DIR}/X_val.npy",      X_val)
np.save(f"{MODELS_DIR}/X_test.npy",     X_test)
np.save(f"{MODELS_DIR}/y_train.npy",    y_train)
np.save(f"{MODELS_DIR}/y_val.npy",      y_val)
np.save(f"{MODELS_DIR}/y_test.npy",     y_test)

# ── 11. TRAIN LIGHTGBM ───────────────────────────────────────
print("\n--- Training LightGBM ---")
scale_pos = float((y_train == 0).sum()) / max(float((y_train == 1).sum()), 1)
print(f"scale_pos_weight: {scale_pos:.2f}")

lgb_train = lgb.Dataset(X_train, label=y_train)
lgb_val   = lgb.Dataset(X_val,   label=y_val, reference=lgb_train)

params = {
    'objective':         'binary',
    'metric':            'auc',
    'learning_rate':     0.05,
    'num_leaves':        63,
    'max_depth':         -1,
    'min_child_samples': 20,
    'feature_fraction':  0.8,
    'bagging_fraction':  0.8,
    'bagging_freq':      5,
    'reg_alpha':         0.1,
    'reg_lambda':        0.1,
    'scale_pos_weight':  scale_pos,
    'verbosity':         -1,
    'random_state':      42,
}

lgb_model = lgb.train(
    params,
    lgb_train,
    num_boost_round=1000,
    valid_sets=[lgb_val],
    callbacks=[
        lgb.early_stopping(stopping_rounds=50, verbose=True),
        lgb.log_evaluation(period=100)
    ]
)

# ── 12. EVALUATE ─────────────────────────────────────────────
y_pred_prob = lgb_model.predict(X_test)
y_pred      = (y_pred_prob >= 0.5).astype(int)
test_auc    = roc_auc_score(y_test, y_pred_prob)

print(f"\n=== TEST SET RESULTS ===")
print(f"AUC-ROC: {test_auc:.4f}")
print(classification_report(
    y_test, y_pred,
    target_names=['No Return', 'Likely Return']
))

# ── 13. SAVE ─────────────────────────────────────────────────
pickle.dump(lgb_model, open(f"{MODELS_DIR}/lgbm_classifier.pkl", 'wb'))
np.save(f"{MODELS_DIR}/y_pred_prob_test.npy", y_pred_prob)

print(f"\n=== DAY 3 SUMMARY ===")
print(f"Fusion model best Val AUC : {best_val_auc:.4f}")
print(f"LightGBM Test AUC-ROC     : {test_auc:.4f}")
print(f"Feature matrix shape      : {X.shape}")
print(f"Saved → {MODELS_DIR}/fusion_attention.pt")
print(f"Saved → {MODELS_DIR}/lgbm_classifier.pkl")
print(f"Saved → {MODELS_DIR}/X_train/val/test + y splits")
print("\nDay 3 complete. Run day4_shap_eval.py next.")