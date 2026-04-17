import datetime
import os
import sys
import time
import json
from dotenv import load_dotenv

from networksecurity.exception.exception import NetworkSecurityException
from networksecurity.logging.logger import logging

from networksecurity.components.data_ingestion import DataIngestion
from networksecurity.components.data_validation import DataValidation
from networksecurity.components.data_transformation import DataTransformation
from networksecurity.components.model_trainer import ModelTrainer

from networksecurity.entity.config_entity import(
    TrainingPipelineConfig,
    DataIngestionConfig,
    DataValidationConfig,
    DataTransformationConfig,
    ModelTrainerConfig,
)

from networksecurity.entity.artifact_entity import (
    DataIngestionArtifact,
    DataValidationArtifact,
    DataTransformationArtifact,
    ModelTrainerArtifact,
)
from networksecurity.cloud.huggingface_sync import HuggingFaceSync

load_dotenv()
TOKEN_HF = os.getenv("TOKEN_HF")

class TrainingPipeline:
    def __init__(self):
        self.training_pipeline_config = TrainingPipelineConfig()

    def sync_model_to_hf(self, metrics: dict):
        try:
            hf_sync = HuggingFaceSync(
                repo_id="Fyiras/network-security-model",
                token=TOKEN_HF
            )
            hf_sync.create_repo_if_not_exists()

            # Generate version tag
            version = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

            model_file        = "final_model/model.pkl"
            preprocessor_file = "final_model/preprocessor.pkl"
            model_name        = f"model_{version}.pkl"
            preprocessor_name = f"preprocessor_{version}.pkl"

            # ── Upload versioned files ──────────────────────────────────
            for local, remote in [(model_file, model_name), (preprocessor_file, preprocessor_name)]:
                hf_sync.api.upload_file(
                    path_or_fileobj=local,
                    path_in_repo=remote,
                    repo_id=hf_sync.repo_id,
                    token=TOKEN_HF
                )

            # ── Create and upload latest.json ───────────────────────────
            latest_data = {"model": model_name, "preprocessor": preprocessor_name}
            with open("latest.json", "w") as f:
                json.dump(latest_data, f)
            
            hf_sync.api.upload_file(
                path_or_fileobj="latest.json",
                path_in_repo="latest.json",
                repo_id=hf_sync.repo_id,
                token=TOKEN_HF
            )

            # ── Upload metadata JSON ────────────────────────────────────
            metadata = {
                "version":           version,
                "model_file":        model_name,
                "preprocessor_file": preprocessor_name,
                "f1_score":          metrics.get("f1_score"),
                "precision":         metrics.get("precision"),
                "recall":            metrics.get("recall"),
                "train_f1_score":    metrics.get("train_f1_score"),
                "train_precision":   metrics.get("train_precision"),
                "train_recall":      metrics.get("train_recall"),
                "date":              datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            metadata_file = f"metadata_{version}.json"
            with open(metadata_file, "w") as f:
                json.dump(metadata, f)

            hf_sync.api.upload_file(
                path_or_fileobj=metadata_file,
                path_in_repo=metadata_file,
                repo_id=hf_sync.repo_id,
                token=TOKEN_HF
            )

            # ── Clean up local temp files ───────────────────────────────
            for path in [model_file, preprocessor_file, "latest.json", metadata_file]:
                if os.path.exists(path):
                    os.remove(path)

            if os.path.exists("final_model") and not os.listdir("final_model"):
                os.rmdir("final_model")
                logging.info("Deleted empty final_model folder")

            logging.info(f"Model version {version} pushed to HuggingFace successfully")

        except Exception as e:
            raise NetworkSecurityException(e, sys)

    def start_data_ingestion(self):
        try:
            self.data_ingestion_config = DataIngestionConfig(training_pipeline_config=self.training_pipeline_config)
            logging.info("Starting Data Ingestion")
            data_ingestion = DataIngestion(data_ingestion_config=self.data_ingestion_config)
            return data_ingestion.initiate_data_ingestion()
        except Exception as e:
            raise NetworkSecurityException(e, sys)

    def start_data_validation(self, data_ingestion_artifact: DataIngestionArtifact):
        try:
            data_validation_config = DataValidationConfig(training_pipeline_config=self.training_pipeline_config)
            data_validation = DataValidation(data_ingestion_artifact=data_ingestion_artifact, data_validation_config=data_validation_config)
            return data_validation.initiate_data_validation()
        except Exception as e:
            raise NetworkSecurityException(e, sys)

    def start_data_transformation(self, data_validation_artifact: DataValidationArtifact):
        try:
            data_transformation_config = DataTransformationConfig(training_pipeline_config=self.training_pipeline_config)
            data_transformation = DataTransformation(data_validation_artifact=data_validation_artifact, data_transformation_config=data_transformation_config)
            return data_transformation.initiate_data_transformation()
        except Exception as e:
            raise NetworkSecurityException(e, sys)

    def start_model_trainer(self, data_transformation_artifact: DataTransformationArtifact) -> ModelTrainerArtifact:
        try:
            model_trainer_config = ModelTrainerConfig(training_pipeline_config=self.training_pipeline_config)
            model_trainer = ModelTrainer(data_transformation_artifact=data_transformation_artifact, model_trainer_config=model_trainer_config)
            return model_trainer.initiate_model_trainer()
        except Exception as e:
            raise NetworkSecurityException(e, sys)

    def run_pipeline(self):
        try:
            pipeline_start = time.time()
            
            # Stages 1-4
            ingestion_artifact    = self.start_data_ingestion()
            validation_artifact   = self.start_data_validation(ingestion_artifact)
            transformation_artifact= self.start_data_transformation(validation_artifact)
            trainer_artifact       = self.start_model_trainer(transformation_artifact)

            # Build Metrics
            test_metrics  = trainer_artifact.test_metric_artifact
            train_metrics = trainer_artifact.train_metric_artifact
            
            metrics = {
                "f1_score":        test_metrics.f1_score,
                "precision":       test_metrics.precision_score,
                "recall":          test_metrics.recall_score,
                "train_f1_score":  train_metrics.f1_score,
                "train_precision": train_metrics.precision_score,
                "train_recall":    train_metrics.recall_score,
            }

            duration = round(time.time() - pipeline_start, 1)
            logging.info(f"Pipeline completed in {duration}s. Syncing to HuggingFace...")

            # Sync to HF
            self.sync_model_to_hf(metrics=metrics)

            return trainer_artifact

        except Exception as e:
            raise NetworkSecurityException(e, sys)
