import pickle
import torch
import torch.nn as nn
from sentence_transformers import SentenceTransformer
from transformers import CLIPProcessor, CLIPModel

DEVICE    = "cuda" if torch.cuda.is_available() else "cpu"
MODELS_DIR = "models"
PCA_DIM   = 64
FUSE_DIM  = 128
TAB_DIM   = 8   # must match Day 3: 7 features + has_clip

# ── Attention Fusion — must exactly match Day 3 architecture ──
class AttentionFusion(nn.Module):
    def __init__(self, clip_dim, text_dim, tab_dim, fuse_dim):
        super().__init__()
        self.clip_proj = nn.Sequential(nn.Linear(clip_dim, fuse_dim), nn.LayerNorm(fuse_dim), nn.ReLU())
        self.text_proj = nn.Sequential(nn.Linear(text_dim, fuse_dim), nn.LayerNorm(fuse_dim), nn.ReLU())
        self.tab_proj  = nn.Sequential(nn.Linear(tab_dim, fuse_dim),  nn.LayerNorm(fuse_dim), nn.ReLU())
        self.attn_score = nn.Linear(fuse_dim, 1, bias=False)
        self.classifier = nn.Sequential(
            nn.Linear(fuse_dim, 64), nn.ReLU(), nn.Dropout(0.3), nn.Linear(64, 1)
        )

    def forward(self, clip, text, tab):
        c = self.clip_proj(clip)
        t = self.text_proj(text)
        s = self.tab_proj(tab)
        stacked = torch.stack([c, t, s], dim=1)
        attn    = torch.softmax(self.attn_score(stacked), dim=1)
        fused   = (stacked * attn).sum(dim=1)
        logit   = self.classifier(fused).squeeze(-1)
        return logit, fused, attn.squeeze(-1)


# ── Global model objects (loaded once at startup) ─────────────
pca_clip     = None
pca_text     = None
scaler       = None
tab_names    = None
fusion       = None
lgbm         = None
shap_exp     = None
st_model     = None
clip_model   = None
clip_proc    = None
price_lookup = None   # {"by_category": {...}, "global": float} — see build_price_lookup.py

def load_all():
    global pca_clip, pca_text, scaler, tab_names
    global fusion, lgbm, shap_exp, st_model, clip_model, clip_proc, price_lookup

    print("Loading PCA + scaler...")
    pca_clip  = pickle.load(open(f"{MODELS_DIR}/pca_clip.pkl",          "rb"))
    pca_text  = pickle.load(open(f"{MODELS_DIR}/pca_text.pkl",          "rb"))
    scaler    = pickle.load(open(f"{MODELS_DIR}/scaler.pkl",            "rb"))
    tab_names = pickle.load(open(f"{MODELS_DIR}/tab_feature_names.pkl", "rb"))

    print("Loading price lookup...")
    price_lookup = pickle.load(open(f"{MODELS_DIR}/category_price_median.pkl", "rb"))

    print("Loading fusion model...")
    fusion = AttentionFusion(PCA_DIM, PCA_DIM, TAB_DIM, FUSE_DIM).to(DEVICE)
    fusion.load_state_dict(torch.load(f"{MODELS_DIR}/fusion_attention.pt", map_location=DEVICE))
    fusion.eval()

    print("Loading LightGBM + SHAP...")
    lgbm     = pickle.load(open(f"{MODELS_DIR}/lgbm_classifier.pkl", "rb"))
    shap_exp = pickle.load(open(f"{MODELS_DIR}/shap_explainer.pkl",  "rb"))

    print("Loading sentence-transformer...")
    st_model = SentenceTransformer("all-MiniLM-L6-v2")

    print("Loading CLIP...")
    clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(DEVICE)
    clip_proc  = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    clip_model.eval()

    print("All models loaded.")
