import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from api.schemas import PredictRequest, PredictResponse, SignalBreakdown
from api import model_loader as ml
from api.inference import predict


@asynccontextmanager
async def lifespan(app: FastAPI):
    ml.load_all()   # load all models once at startup
    yield           # app runs
                    # (shutdown cleanup goes here if needed)

app = FastAPI(
    title="ReturnSight API",
    description="E-Commerce Return Probability Predictor",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": ml.lgbm is not None,
    }


@app.post("/predict", response_model=PredictResponse)
def predict_return(req: PredictRequest):
    if not req.title or not req.description:
        raise HTTPException(status_code=422, detail="title and description are required")
    if len(req.reviews) == 0:
        raise HTTPException(status_code=422, detail="at least one review is required")

    t0 = time.perf_counter()
    try:
        result = predict(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    return PredictResponse(
        return_probability = result["return_probability"],
        risk_level         = result["risk_level"],
        signal_breakdown   = SignalBreakdown(**result["signal_breakdown"]),
        top_reason         = result["top_reason"],
        latency_ms         = latency_ms,
    )
