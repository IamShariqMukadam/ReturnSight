# ReturnSight — AI Return Risk Predictor

> Know the return risk before the return. Predict e-commerce product return probability using a multi-modal AI pipeline trained on 66M Amazon reviews.

## Setup

```bash
git clone https://github.com/IamShariqMukadam/ReturnSight
cd returnsight-frontend
npm install
cp .env.example .env.local
# Edit .env.local and set VITE_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:5173

## Features

| Feature | Description |
|---|---|
| AI Prediction | Multi-modal pipeline: CLIP + sentence-transformers + LightGBM |
| Signal Explainability | 5 SHAP-backed signals with inline tooltips |
| Smart Review Parser | Paste raw reviews, auto-detects sentiment/star rating |
| Persistent History | Last 20 analyses in localStorage, grouped by day |
| Shareable Results | Base64 URL-encoded results, paste to share instantly |
| Export PNG | html2canvas branded result card (1200×630) |
| Batch Analysis | CSV upload, up to 10 products, sortable results table |
| Keyboard Shortcuts | ⌘+Enter, ⌘+H, ⌘+K palette, and more |
| Compare Mode | Side-by-side analysis of two products |
| Risk Dashboard | /dashboard — line chart, donut, bar chart from history |
| API Health | 30s polling with offline banner |
| Mobile UX | Bottom sheet result, FAB trigger, touch drag snapping |

## API Contract

**POST /predict**
```json
{
  "title": "string",
  "description": "string",
  "reviews": [{ "text": "string", "rating": 1 }],
  "price": 29.99,
  "image_url": "https://...",
  "category": "Clothing_Shoes_and_Jewelry"
}
```

**Response:**
```json
{
  "return_probability": 0.73,
  "risk_level": "High",
  "signal_breakdown": {
    "image_text_fusion": 0.12,
    "avg_rating": -0.08,
    "one_star_pct": 0.21,
    "price_anomaly": 0.04,
    "review_mismatch": 0.18
  },
  "top_reason": "Reviews contradict product description (mismatch: 0.72)",
  "latency_ms": 184.5
}
```

## Stack

- Vite + React 18 + React Router v6
- Zustand (state), TanStack Query, Framer Motion
- Tailwind CSS + CSS variables design system
- Fonts: Space Grotesk / DM Mono / Inter

## Screenshot

_[Add screenshot here after first run]_
