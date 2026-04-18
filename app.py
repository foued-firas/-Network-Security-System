import time
import sys
import os
import traceback
import certifi
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import pandas as pd
import joblib
import threading

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from uvicorn import run as app_run

from huggingface_hub import HfApi, hf_hub_download, list_repo_files

from networksecurity.exception.exception import NetworkSecurityException
from networksecurity.pipeline.training_pipeline import TrainingPipeline
from networksecurity.utils.ml_utils.model.estimator import NetworkModel
from networksecurity.cloud.huggingface_sync import HuggingFaceSync



load_dotenv()
TOKEN_HF = os.getenv("TOKEN_HF")
mongo_db_url = os.getenv("MONGODB_URL_KEY")

ca = certifi.where()
import pymongo

client = pymongo.MongoClient(mongo_db_url, tlsCAFile=ca)

from networksecurity.constants.training_pipeline import (
    DATA_INGESTION_COLLECTION_NAME,
    DATA_INGESTION_DATABASE_NAME
)

database = client[DATA_INGESTION_DATABASE_NAME]
collection = database[DATA_INGESTION_COLLECTION_NAME]

current_version = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# ==============================
# 🔹 GLOBALS
# ==============================

REPO_ID = "Fyiras/network-security-model"

model = None
preprocessor = None
_model_lock = threading.Lock()

# ==============================
# 🔹 HF HELPERS
# ==============================



import json

def load_model_from_hf():
    """
    Download latest model & preprocessor from HF using latest.json,
    load into memory, then delete local cache.
    """
    global model, preprocessor ,current_version

    # Step 1: download latest.json
    latest_path = hf_hub_download(
        repo_id=REPO_ID,
        filename="latest.json",
        token=TOKEN_HF
    )

    #  Step 2: read JSON
    with open(latest_path, "r") as f:
        latest = json.load(f)

    version = latest["model"]

    if current_version == version:
        return
    print(f"🔄 New model detected: {version}")
    

  

    # 🔥 Step 3: download actual files
    MODEL_PATH = hf_hub_download(
        repo_id=REPO_ID,
        filename=latest["model"],
        token=TOKEN_HF
    )

    PREPROCESSOR_PATH = hf_hub_download(
        repo_id=REPO_ID,
        filename=latest["preprocessor"],
        token=TOKEN_HF
    )

    # 🔥 Step 4: load into memory
    new_model = joblib.load(MODEL_PATH)
    new_preprocessor = joblib.load(PREPROCESSOR_PATH)

    # 🔥 Step 5: delete cache (you chose to keep it 👍)
    if os.path.exists(MODEL_PATH):
        os.remove(MODEL_PATH)
        print(f"🗑️ Deleted cached model: {MODEL_PATH}")

    if os.path.exists(PREPROCESSOR_PATH):
        os.remove(PREPROCESSOR_PATH)
        print(f"🗑️ Deleted cached preprocessor: {PREPROCESSOR_PATH}")

    # 🔥 Step 6: atomic swap
    with _model_lock:
        model = new_model
        preprocessor = new_preprocessor
        current_version = version

    print("✅ Model swapped into memory from latest.json")


def model_watcher():
    while True:
        try:
            load_model_from_hf()
        except Exception as e:
            print("⚠️ Watcher error:", str(e))

        time.sleep(30) 

def version_exists(version: str):
    files = list_repo_files(REPO_ID, token=TOKEN_HF)
    return f"model_{version}.pkl" in files
def get_available_versions():
    try:
        files = list_repo_files(REPO_ID, token=TOKEN_HF)

        # Filter only model files
        model_files = [f for f in files if f.startswith("model_") and f.endswith(".pkl")]

        # Extract version
        versions = [f.replace("model_", "").replace(".pkl", "") for f in model_files]

        return sorted(versions, reverse=True)

    except Exception as e:
        print("⚠️ Error fetching versions:", str(e))
        return []  # ✅ ALWAYS return list
    
security = HTTPBearer()

def verify_technician(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    if token != os.getenv("TECHNICIAN_PIN"):
        raise HTTPException(status_code=403, detail="Technician access required")
    

def get_version_metadata(version: str) -> dict:
    """Download and return metadata for a specific version. Returns {} on failure."""
    try:
        path = hf_hub_download(
            repo_id=REPO_ID,
            filename=f"metadata_{version}.json",
            token=TOKEN_HF
        )
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def get_all_metadata() -> list[dict]:
    """Return a list of metadata dicts for all available versions, newest first."""
    versions = get_available_versions()
    results = []
    for v in versions:
        meta = get_version_metadata(v)
        if not meta:                          # fallback if no metadata file exists
            meta = {"version": v}
        results.append(meta)
    return results


def rollback_model(version: str,):
    try:
        if not version_exists(version):
            return {"error": f"Version {version} not found"}
        model_file = f"model_{version}.pkl"
        preprocessor_file = f"preprocessor_{version}.pkl"

        # 🔥 Create new latest.json
        data = {
            "model": model_file,
            "preprocessor": preprocessor_file
        }

        with open("latest.json", "w") as f:
            json.dump(data, f)

        #  Upload to Hugging Face
        api = HfApi(token=TOKEN_HF)

        api.upload_file(
            path_or_fileobj="latest.json",
            path_in_repo="latest.json",
            repo_id=REPO_ID,
        )

        print(f"🔄 Rolled back to version: {version}")

        return {"message": f"Rollback to {version} successful"}

    except Exception as e:
        return {"error": str(e)}

@app.get("/", tags=["authentication"])
async def index():
    return RedirectResponse(url="/docs")


@app.get("/train")
async def train_route(_=Depends(verify_technician)):
    try:
        train_pipeline = TrainingPipeline()
        train_pipeline.run_pipeline()

        # Reload latest model into memory right after training
        load_model_from_hf()

        return Response("Training + Upload to HF successful 🚀 Model is live!")

    except Exception as e:
   
        return Response(
            content=f"TRAIN ERROR:\n{str(e)}\n\n{traceback.format_exc()}",
            media_type="text/plain",
            status_code=500
    )

@app.get("/versions")
def list_versions(_=Depends(verify_technician)):
    versions = get_available_versions()

    return {
        "available_versions": versions,
        "current_version": current_version,
        "count": len(versions)
    }
@app.get("/dashboard")
def dashboard(request: Request,_=Depends(verify_technician)):
    all_metadata = get_all_metadata()         # list of dicts, newest first

    safe_version = current_version if isinstance(current_version, str) else "None"

    # Find metrics for the currently loaded version
    current_meta = next(
        (m for m in all_metadata if m.get("version") == safe_version), {}
    )

    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={
            "versions": all_metadata,         # now carries metrics, not just names
            "current_version": safe_version,
            "current_meta": current_meta,     # metrics for the live model
        }
    )



@app.on_event("startup")
def start_watcher():
    thread = threading.Thread(target=model_watcher, daemon=True)
    thread.start()
    print("👀 Model watcher started")


@app.get("/rollback/{version}")
def rollback_endpoint(version: str,_=Depends(verify_technician)):
    result = rollback_model(version)

    if "error" in result:
        return Response(content=result["error"], status_code=400)

    return RedirectResponse(url="/dashboard", status_code=303)

# ── ADD THESE IMPORTS at the top ──────────────────────────────
from fastapi.responses import JSONResponse
from io import StringIO
import datetime
import collections

# ── GLOBALS: prediction audit log (in-memory ring buffer) ─────
_audit_log = collections.deque(maxlen=500)   # keeps last 500 predictions


# ══════════════════════════════════════════════════════════════
# /predict  — POST CSV, returns predictions + logs each call
# ══════════════════════════════════════════════════════════════
@app.post("/predict")
async def predict_route(file: UploadFile = File(...)):
    try:
        if model is None or preprocessor is None:
            return JSONResponse({"error": "No model loaded"}, status_code=503)

        content = await file.read()
        df = pd.read_csv(StringIO(content.decode("utf-8")))

        with _model_lock:
            X = preprocessor.transform(df)
            preds = model.predict(X)
            probas = model.predict_proba(X).max(axis=1).tolist() if hasattr(model, "predict_proba") else [None] * len(preds)

        results = []
        for pred, conf in zip(preds.tolist(), probas):
            label = "THREAT" if pred == 1 else "BENIGN"
            entry = {
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "model_version": current_version,
                "result": label,
                "confidence": round(conf, 4) if conf is not None else None,
            }
            _audit_log.appendleft(entry)   # newest first
            results.append(entry)

        return JSONResponse({"predictions": results, "count": len(results)})

    except Exception as e:
        return JSONResponse(
            {"error": str(e), "trace": traceback.format_exc()},
            status_code=500
        )


# ══════════════════════════════════════════════════════════════
# /audit  — last N prediction log entries  (dashboard table)
# ══════════════════════════════════════════════════════════════
@app.get("/audit")
def audit_log(limit: int = 50):
    return JSONResponse({"entries": list(_audit_log)[:limit], "total": len(_audit_log)})


# ══════════════════════════════════════════════════════════════
# /metrics/history  — f1/precision/recall over all versions
# ══════════════════════════════════════════════════════════════
@app.get("/metrics/history")
def metrics_history(_=Depends(verify_technician)):
    all_meta = get_all_metadata()
    history = []
    for m in reversed(all_meta):          # oldest → newest for charts
        if m.get("f1_score") is not None:
            history.append({
                "version":   m.get("version"),
                "date":      m.get("date"),
                "f1":        round(m["f1_score"]  * 100, 2),
                "precision": round((m.get("precision") or 0) * 100, 2),
                "recall":    round((m.get("recall")    or 0) * 100, 2),
                "train_f1":  round((m.get("train_f1_score") or 0) * 100, 2),
            })
    return JSONResponse({"history": history})


# ══════════════════════════════════════════════════════════════
# /compare  — side-by-side diff of two versions
# ══════════════════════════════════════════════════════════════
@app.get("/compare")
def compare_versions(v1: str, v2: str, _=Depends(verify_technician)):
    m1 = get_version_metadata(v1)
    m2 = get_version_metadata(v2)
    if not m1:
        return JSONResponse({"error": f"Version {v1} not found"}, status_code=404)
    if not m2:
        return JSONResponse({"error": f"Version {v2} not found"}, status_code=404)

    metrics = ["f1_score", "precision", "recall", "train_f1_score", "train_precision", "train_recall"]
    diff = {}
    for key in metrics:
        a = m1.get(key) or 0
        b = m2.get(key) or 0
        diff[key] = {
            "v1": round(a * 100, 2),
            "v2": round(b * 100, 2),
            "delta": round((a - b) * 100, 2),
        }
    return JSONResponse({"v1": v1, "v2": v2, "diff": diff})


# ══════════════════════════════════════════════════════════════
# /dashboard/predict  — serve the predict page (new template)
# ══════════════════════════════════════════════════════════════
@app.get("/dashboard/predict")
def predict_page(request: Request,_=Depends(verify_technician)):
    return templates.TemplateResponse(
        request=request,
        name="predict.html",
        context={"current_version": current_version or "None"}
    )



@app.get("/dashboard/audit")
def audit_page(request: Request,_=Depends(verify_technician)):
    return templates.TemplateResponse(
        request=request,
        name="audit.html",
        context={"current_version": current_version or "None"}
    )



if __name__ == "__main__":
    app_run(app, host="0.0.0.0", port=8000)