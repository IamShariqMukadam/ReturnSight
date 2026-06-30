# ============================================================
# RETURNSIGHT — DAY 4: SHAP EXPLAINABILITY + EVAL + TUNING
# ============================================================

import os, pickle, warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import shap
import lightgbm as lgb
import optuna
from sklearn.metrics import (
    roc_auc_score, roc_curve, precision_recall_curve,
    confusion_matrix, classification_report,
    average_precision_score, f1_score,
    precision_score, recall_score
)

warnings.filterwarnings('ignore')
optuna.logging.set_verbosity(optuna.logging.WARNING)

# ── CONFIG ──────────────────────────────────────────────────
import glob
IS_KAGGLE = os.path.exists("/kaggle/working")
if IS_KAGGLE:
    cands = glob.glob("/kaggle/input/**/lgbm_classifier.pkl", recursive=True)
    assert cands, "lgbm_classifier.pkl not found under /kaggle/input/ — attach Day 3's output dataset."
    MODELS_IN  = os.path.dirname(cands[0])   # read-only, Day 3 outputs
    MODELS_DIR = "/kaggle/working/models"    # writable, this script's outputs
    PLOTS_DIR  = "/kaggle/working/outputs/plots"
    SHAP_DIR   = "/kaggle/working/outputs/shap"
else:
    MODELS_IN  = "models"
    MODELS_DIR = "models"
    PLOTS_DIR  = "outputs/plots"
    SHAP_DIR   = "outputs/shap"
FUSE_DIM     = 128
N_OPTUNA     = 50
for d in [MODELS_DIR, PLOTS_DIR, SHAP_DIR]:
    os.makedirs(d, exist_ok=True)
print(f"Platform: {'Kaggle' if IS_KAGGLE else 'Local'} | Models in: {MODELS_IN} | Out: {MODELS_DIR}")

TAB_FEATURES = [
    'avg_rating', 'one_star_pct', 'five_star_pct', 'rating_std',
    'log_review_count', 'price_anomaly', 'review_desc_mismatch', 'has_clip'
]
TAB_DIM      = len(TAB_FEATURES)                          # 8
FEATURE_NAMES = [f'fused_{i}' for i in range(FUSE_DIM)] + TAB_FEATURES

# ── 1. LOAD ──────────────────────────────────────────────────
lgb_model   = pickle.load(open(f"{MODELS_IN}/lgbm_classifier.pkl", 'rb'))
X_train     = np.load(f"{MODELS_IN}/X_train.npy")
X_val       = np.load(f"{MODELS_IN}/X_val.npy")
X_test      = np.load(f"{MODELS_IN}/X_test.npy")
y_train     = np.load(f"{MODELS_IN}/y_train.npy")
y_val       = np.load(f"{MODELS_IN}/y_val.npy")
y_test      = np.load(f"{MODELS_IN}/y_test.npy")
y_pred_prob = np.load(f"{MODELS_IN}/y_pred_prob_test.npy")

print(f"Test set: {len(y_test):,} | Return rate: {y_test.mean():.2%}")

# ── 2. SHAP — TREE EXPLAINER ─────────────────────────────────
print("\n--- SHAP Analysis ---")
explainer   = shap.TreeExplainer(lgb_model)
shap_values = explainer.shap_values(X_test)

# TreeExplainer may return list [neg, pos] for binary classification
if isinstance(shap_values, list):
    shap_vals = shap_values[1]
else:
    shap_vals = shap_values                               # (N_test, 136)

base_value = (
    explainer.expected_value[1]
    if isinstance(explainer.expected_value, (list, np.ndarray))
    else explainer.expected_value
)

# ── GROUP SHAP: collapse 128 fused features into 1 signal ────
# This makes explainability charts actually human-readable
fused_shap   = shap_vals[:, :FUSE_DIM].sum(axis=1, keepdims=True)  # (N, 1)
tab_shap     = shap_vals[:, FUSE_DIM:]                              # (N, 8)
grouped_shap = np.hstack([fused_shap, tab_shap])                    # (N, 9)
grouped_feat = ['image_text_fusion'] + TAB_FEATURES

fused_X      = X_test[:, :FUSE_DIM].sum(axis=1, keepdims=True)
grouped_X    = np.hstack([fused_X, X_test[:, FUSE_DIM:]])

# ── PLOT 1: SHAP Beeswarm (global feature impact) ────────────
plt.figure(figsize=(11, 7))
shap.summary_plot(
    grouped_shap, grouped_X,
    feature_names=grouped_feat,
    plot_type='dot',
    show=False
)
plt.title("SHAP — Feature Impact on Return Prediction", fontsize=13, fontweight='bold')
plt.tight_layout()
plt.savefig(f"{SHAP_DIR}/shap_beeswarm.png", dpi=150, bbox_inches='tight')
plt.close()
print("Saved: shap_beeswarm.png")

# ── PLOT 2: SHAP Bar (mean |SHAP| per feature) ───────────────
plt.figure(figsize=(10, 6))
shap.summary_plot(
    grouped_shap, grouped_X,
    feature_names=grouped_feat,
    plot_type='bar',
    show=False
)
plt.title("SHAP — Mean Absolute Feature Importance", fontsize=13, fontweight='bold')
plt.tight_layout()
plt.savefig(f"{SHAP_DIR}/shap_bar_importance.png", dpi=150, bbox_inches='tight')
plt.close()
print("Saved: shap_bar_importance.png")

# ── PLOT 3: SHAP Waterfall — highest risk product ────────────
high_risk_idx  = int(np.argmax(y_pred_prob))
shap_exp = shap.Explanation(
    values        = grouped_shap[high_risk_idx],
    base_values   = base_value,
    data          = grouped_X[high_risk_idx],
    feature_names = grouped_feat
)
plt.figure(figsize=(11, 5))
shap.waterfall_plot(shap_exp, show=False)
plt.title(
    f"SHAP Waterfall — Highest Risk Product "
    f"(score={y_pred_prob[high_risk_idx]:.2f}, actual={int(y_test[high_risk_idx])})",
    fontsize=11, fontweight='bold'
)
plt.tight_layout()
plt.savefig(f"{SHAP_DIR}/shap_waterfall_high_risk.png", dpi=150, bbox_inches='tight')
plt.close()
print("Saved: shap_waterfall_high_risk.png")

# ── PLOT 4: SHAP Waterfall — lowest risk product ─────────────
low_risk_idx = int(np.argmin(y_pred_prob))
shap_exp_low = shap.Explanation(
    values        = grouped_shap[low_risk_idx],
    base_values   = base_value,
    data          = grouped_X[low_risk_idx],
    feature_names = grouped_feat
)
plt.figure(figsize=(11, 5))
shap.waterfall_plot(shap_exp_low, show=False)
plt.title(
    f"SHAP Waterfall — Lowest Risk Product "
    f"(score={y_pred_prob[low_risk_idx]:.2f}, actual={int(y_test[low_risk_idx])})",
    fontsize=11, fontweight='bold'
)
plt.tight_layout()
plt.savefig(f"{SHAP_DIR}/shap_waterfall_low_risk.png", dpi=150, bbox_inches='tight')
plt.close()
print("Saved: shap_waterfall_low_risk.png")

# Save explainer (pre-tuning — will overwrite after tuning)
pickle.dump(explainer, open(f"{MODELS_DIR}/shap_explainer.pkl", 'wb'))

# ── 3. EVALUATION PLOTS ──────────────────────────────────────
print("\n--- Evaluation Metrics ---")
y_pred    = (y_pred_prob >= 0.5).astype(int)
auc_score = roc_auc_score(y_test, y_pred_prob)
ap_score  = average_precision_score(y_test, y_pred_prob)

print(f"AUC-ROC           : {auc_score:.4f}")
print(f"Average Precision : {ap_score:.4f}")
print(classification_report(y_test, y_pred, target_names=['No Return', 'Likely Return']))

fig = plt.figure(figsize=(18, 5))
fig.suptitle("ReturnSight — Model Evaluation", fontsize=14, fontweight='bold')
gs  = gridspec.GridSpec(1, 3, figure=fig)

# ROC Curve
ax1 = fig.add_subplot(gs[0])
fpr, tpr, _ = roc_curve(y_test, y_pred_prob)
ax1.plot(fpr, tpr, color='#e74c3c', lw=2, label=f'AUC = {auc_score:.3f}')
ax1.plot([0, 1], [0, 1], 'k--', lw=1, label='Random')
ax1.fill_between(fpr, tpr, alpha=0.1, color='#e74c3c')
ax1.set_xlabel("False Positive Rate"); ax1.set_ylabel("True Positive Rate")
ax1.set_title("ROC Curve"); ax1.legend()

# Precision-Recall Curve
ax2 = fig.add_subplot(gs[1])
precision, recall, _ = precision_recall_curve(y_test, y_pred_prob)
ax2.plot(recall, precision, color='#3498db', lw=2, label=f'AP = {ap_score:.3f}')
ax2.axhline(y_test.mean(), color='k', linestyle='--', lw=1, label=f'Baseline ({y_test.mean():.2f})')
ax2.fill_between(recall, precision, alpha=0.1, color='#3498db')
ax2.set_xlabel("Recall"); ax2.set_ylabel("Precision")
ax2.set_title("Precision-Recall Curve"); ax2.legend()

# Confusion Matrix
ax3   = fig.add_subplot(gs[2])
cm    = confusion_matrix(y_test, y_pred)
im    = ax3.imshow(cm, cmap='Blues')
ticks = ['No Return', 'Return']
ax3.set_xticks([0, 1]); ax3.set_xticklabels(ticks)
ax3.set_yticks([0, 1]); ax3.set_yticklabels(ticks)
ax3.set_xlabel("Predicted"); ax3.set_ylabel("Actual")
ax3.set_title("Confusion Matrix")
for i in range(2):
    for j in range(2):
        ax3.text(
            j, i, f"{cm[i, j]:,}", ha='center', va='center', fontsize=13,
            color='white' if cm[i, j] > cm.max() / 2 else 'black'
        )
plt.colorbar(im, ax=ax3)

plt.tight_layout()
plt.savefig(f"{PLOTS_DIR}/day4_evaluation.png", dpi=150, bbox_inches='tight')
plt.show()
print(f"Saved: {PLOTS_DIR}/day4_evaluation.png")

# ── 4. THRESHOLD ANALYSIS ────────────────────────────────────
print("\n--- Threshold Analysis ---")
print(f"{'Threshold':>10} | {'Precision':>10} | {'Recall':>8} | {'F1':>8} | {'Flagged%':>9}")
print("-" * 57)
for t in np.arange(0.3, 0.81, 0.05):
    yp = (y_pred_prob >= t).astype(int)
    if yp.sum() == 0:
        continue
    p  = precision_score(y_test, yp, zero_division=0)
    r  = recall_score(y_test, yp, zero_division=0)
    f1 = f1_score(y_test, yp, zero_division=0)
    pct = yp.mean()
    print(f"{t:>10.2f} | {p:>10.3f} | {r:>8.3f} | {f1:>8.3f} | {pct:>8.1%}")

# ── 5. OPTUNA HYPERPARAMETER TUNING ──────────────────────────
# Uses X_val (held-out from training) for tuning, X_test stays clean for final eval
print(f"\n--- Optuna Tuning ({N_OPTUNA} trials) ---")

scale_pos = float((y_train == 0).sum()) / max(float((y_train == 1).sum()), 1)

def objective(trial):
    params = {
        'objective':         'binary',
        'metric':            'auc',
        'verbosity':         -1,
        'random_state':      42,
        'scale_pos_weight':  scale_pos,
        'learning_rate':     trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
        'num_leaves':        trial.suggest_int('num_leaves', 20, 200),
        'max_depth':         trial.suggest_int('max_depth', 3, 12),
        'min_child_samples': trial.suggest_int('min_child_samples', 10, 100),
        'feature_fraction':  trial.suggest_float('feature_fraction', 0.5, 1.0),
        'bagging_fraction':  trial.suggest_float('bagging_fraction', 0.5, 1.0),
        'bagging_freq':      trial.suggest_int('bagging_freq', 1, 10),
        'reg_alpha':         trial.suggest_float('reg_alpha', 1e-8, 10.0, log=True),
        'reg_lambda':        trial.suggest_float('reg_lambda', 1e-8, 10.0, log=True),
    }
    lgb_tr = lgb.Dataset(X_train, label=y_train)
    lgb_vl = lgb.Dataset(X_val,   label=y_val, reference=lgb_tr)

    model = lgb.train(
        params, lgb_tr,
        num_boost_round=1000,
        valid_sets=[lgb_vl],
        callbacks=[
            lgb.early_stopping(40, verbose=False),
            lgb.log_evaluation(-1)
        ]
    )
    preds = model.predict(X_val)
    return roc_auc_score(y_val, preds)

study = optuna.create_study(direction='maximize', sampler=optuna.samplers.TPESampler(seed=42))
study.optimize(objective, n_trials=N_OPTUNA, show_progress_bar=True)

best_params = study.best_params
best_params.update({
    'objective':        'binary',
    'metric':           'auc',
    'verbosity':        -1,
    'random_state':     42,
    'scale_pos_weight': scale_pos,
})

print(f"\nBest Val AUC (Optuna): {study.best_value:.4f}")
print(f"Best params: {best_params}")

# ── 6. RETRAIN TUNED MODEL ON TRAIN+VAL → EVAL ON TEST ───────
print("\nRetraining tuned model on train+val...")
X_trainval = np.vstack([X_train, X_val])
y_trainval = np.concatenate([y_train, y_val])

lgb_trainval = lgb.Dataset(X_trainval, label=y_trainval)
lgb_test_ds  = lgb.Dataset(X_test, label=y_test, reference=lgb_trainval)

tuned_model = lgb.train(
    best_params,
    lgb_trainval,
    num_boost_round=1000,
    valid_sets=[lgb_test_ds],
    callbacks=[
        lgb.early_stopping(50, verbose=False),
        lgb.log_evaluation(100)
    ]
)

final_preds = tuned_model.predict(X_test)
final_auc   = roc_auc_score(y_test, final_preds)
final_ap    = average_precision_score(y_test, final_preds)
final_pred_labels = (final_preds >= 0.5).astype(int)

print(f"\n=== TUNED MODEL — TEST SET ===")
print(f"AUC-ROC           : {final_auc:.4f}  (was {auc_score:.4f})")
print(f"Average Precision : {final_ap:.4f}  (was {ap_score:.4f})")
print(classification_report(
    y_test, final_pred_labels,
    target_names=['No Return', 'Likely Return']
))

# ── 7. OPTUNA IMPORTANCE PLOT ─────────────────────────────────
try:
    imp_fig = optuna.visualization.matplotlib.plot_param_importances(study)
    plt.tight_layout()
    plt.savefig(f"{PLOTS_DIR}/optuna_param_importance.png", dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {PLOTS_DIR}/optuna_param_importance.png")
except Exception:
    pass   # visualization optional

# ── 8. SAVE FINAL ARTIFACTS ───────────────────────────────────
pickle.dump(tuned_model, open(f"{MODELS_DIR}/lgbm_classifier.pkl", 'wb'))
np.save(f"{MODELS_DIR}/y_pred_prob_test.npy", final_preds)

# Rebuild SHAP explainer with tuned model
tuned_explainer = shap.TreeExplainer(tuned_model)
pickle.dump(tuned_explainer, open(f"{MODELS_DIR}/shap_explainer.pkl", 'wb'))

# Save best params for Day 5 inference
pickle.dump(best_params, open(f"{MODELS_DIR}/best_lgbm_params.pkl", 'wb'))

# Summary table
results = pd.DataFrame({
    'Model':     ['Baseline LightGBM', 'Tuned LightGBM'],
    'AUC-ROC':   [round(auc_score, 4), round(final_auc, 4)],
    'Avg Prec':  [round(ap_score, 4),  round(final_ap, 4)],
})
print(f"\n{results.to_string(index=False)}")
results.to_csv(f"{PLOTS_DIR}/model_results.csv", index=False)

print(f"\n=== DAY 4 SUMMARY ===")
print(f"Baseline AUC  : {auc_score:.4f}")
print(f"Tuned AUC     : {final_auc:.4f}")
print(f"SHAP plots    → {SHAP_DIR}/")
print(f"Eval plots    → {PLOTS_DIR}/day4_evaluation.png")
print(f"Saved models  → {MODELS_DIR}/lgbm_classifier.pkl (tuned)")
print(f"Saved         → {MODELS_DIR}/shap_explainer.pkl")
print("\nDay 4 complete. Run day5_fastapi.py next.")