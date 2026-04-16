import time
import sys
import os
import traceback
import certifi
import pandas as pd
import joblib
import threading

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, Request
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
def rollback_model(version: str):
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
async def train_route():
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
def list_versions():
    versions = get_available_versions()

    return {
        "available_versions": versions,
        "current_version": current_version,
        "count": len(versions)
    }


@app.get("/dashboard")
def dashboard(request: Request):
    versions = get_available_versions()

    if not isinstance(versions, list):
        versions = []

    safe_version = current_version if isinstance(current_version, str) else "None"

    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={
            "versions": versions,
            "current_version": safe_version
        }
    )
@app.post("/predict")
async def predict_route(request: Request, file: UploadFile = File(...)):
    try:
        # Read model reference under lock
        with _model_lock:
            current_model = model
            current_preprocessor = preprocessor

        # If no model in memory yet, try loading from HF
        if current_model is None or current_preprocessor is None:
            try:
                load_model_from_hf()
                with _model_lock:
                    current_model = model
                    current_preprocessor = preprocessor
            except Exception as load_err:
                return Response(
                    content=(
                        "⚠️ No trained model found on Hugging Face.\n"
                        "Please call GET /train first to train and upload the model.\n\n"
                        f"Details: {str(load_err)}"
                    ),
                    media_type="text/plain",
                    status_code=503
                )

        df = pd.read_csv(file.file)

        network_model = NetworkModel(
            preprocessor=current_preprocessor,
            model=current_model
        )

        y_pred = network_model.predict(df)
        df['predicted_column'] = y_pred

        os.makedirs('prediction_output', exist_ok=True)
        df.to_csv('prediction_output/output.csv', index=False)

        table_html = df.to_html(classes='table table-striped')

        return templates.TemplateResponse(
            request=request,
            name="table.html",
            context={"table": table_html}
        )

    except Exception as e:
        import traceback
        return Response(
            content=f"Prediction failed: {str(e)}\n\n{traceback.format_exc()}",
            media_type="text/plain",
            status_code=500
        )
@app.on_event("startup")
def start_watcher():
    thread = threading.Thread(target=model_watcher, daemon=True)
    thread.start()
    print("👀 Model watcher started")


@app.get("/rollback/{version}")
def rollback_endpoint(version: str):
    result = rollback_model(version)

    if "error" in result:
        return Response(content=result["error"], status_code=400)

    return RedirectResponse(url="/dashboard", status_code=303)

if __name__ == "__main__":
    app_run(app, host="0.0.0.0", port=8000)