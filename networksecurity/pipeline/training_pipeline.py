import datetime
import os
import sys

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
import datetime
import json

import sys
from networksecurity.cloud.huggingface_sync import HuggingFaceSync
load_dotenv()
TOKEN_HF = os.getenv("TOKEN_HF")


class TrainingPipeline:
    def __init__(self):
        self.training_pipeline_config=TrainingPipelineConfig()

    



    def sync_model_to_hf(self):
        try:
            hf_sync = HuggingFaceSync(
                repo_id="Fyiras/network-security-model",
                token=TOKEN_HF
            )

            hf_sync.create_repo_if_not_exists()

        # 🔥 Generate version
            version = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

            model_file = "final_model/model.pkl"
            preprocessor_file = "final_model/preprocessor.pkl"

            model_name = f"model_{version}.pkl"
            preprocessor_name = f"preprocessor_{version}.pkl"

        # ✅ Upload versioned model
            hf_sync.api.upload_file(
                path_or_fileobj=model_file,
                path_in_repo=model_name,
                repo_id=hf_sync.repo_id,
                token=TOKEN_HF
        )

        # ✅ Upload versioned preprocessor
            hf_sync.api.upload_file(
                path_or_fileobj=preprocessor_file,
                path_in_repo=preprocessor_name,
                repo_id=hf_sync.repo_id,
                token=TOKEN_HF
        )

        # 🔥 Create latest.json
            latest_data = {
                "model": model_name,
                "preprocessor": preprocessor_name
            }

            with open("latest.json", "w") as f:
                json.dump(latest_data, f)

        # ✅ Upload latest.json
            hf_sync.api.upload_file(
                path_or_fileobj="latest.json",
                path_in_repo="latest.json",
                repo_id=hf_sync.repo_id,
                token=TOKEN_HF
            )
            

        # ✅ Clean local files (optional but OK)
            if os.path.exists(model_file):
                os.remove(model_file)

            if os.path.exists(preprocessor_file):
                os.remove(preprocessor_file)

            if os.path.exists("latest.json"):
                os.remove("latest.json")

            if os.path.exists("final_model") and not os.listdir("final_model"):
                os.rmdir("final_model")
                print("🗑️ Deleted empty final_model folder")

            print(f"✅ Model uploaded (version: {version}) + latest.json updated")

        except Exception as e:
            raise NetworkSecurityException(e, sys)
        
        

    def start_data_ingestion(self):
        try:
            self.data_ingestion_config=DataIngestionConfig(training_pipeline_config=self.training_pipeline_config)
            logging.info("Start data Ingestion")
            data_ingestion=DataIngestion(data_ingestion_config=self.data_ingestion_config)
            data_ingestion_artifact=data_ingestion.initiate_data_ingestion()
            logging.info(f"Data Ingestion completed and artifact: {data_ingestion_artifact}")
            return data_ingestion_artifact
        
        except Exception as e:
            raise NetworkSecurityException(e,sys)
        
    def start_data_validation(self,data_ingestion_artifact:DataIngestionArtifact):
        try:
            data_validation_config=DataValidationConfig(training_pipeline_config=self.training_pipeline_config)
            data_validation=DataValidation(data_ingestion_artifact=data_ingestion_artifact,data_validation_config=data_validation_config)
            logging.info("Initiate the data Validation")
            data_validation_artifact=data_validation.initiate_data_validation()
            return data_validation_artifact
        except Exception as e:
            raise NetworkSecurityException(e,sys)
        
    def start_data_transformation(self,data_validation_artifact:DataValidationArtifact):
        try:
            data_transformation_config = DataTransformationConfig(training_pipeline_config=self.training_pipeline_config)
            data_transformation = DataTransformation(data_validation_artifact=data_validation_artifact,
            data_transformation_config=data_transformation_config)
            
            data_transformation_artifact = data_transformation.initiate_data_transformation()
            return data_transformation_artifact
        except Exception as e:
            raise NetworkSecurityException(e,sys)
        
    def start_model_trainer(self,data_transformation_artifact:DataTransformationArtifact)->ModelTrainerArtifact:
        try:
            self.model_trainer_config: ModelTrainerConfig = ModelTrainerConfig(
                training_pipeline_config=self.training_pipeline_config
            )

            model_trainer = ModelTrainer(
                data_transformation_artifact=data_transformation_artifact,
                model_trainer_config=self.model_trainer_config,
            )

            model_trainer_artifact = model_trainer.initiate_model_trainer()

            return model_trainer_artifact

        except Exception as e:
            raise NetworkSecurityException(e, sys)

 
        
    
    
    
    def run_pipeline(self):
        try:
            data_ingestion_artifact=self.start_data_ingestion()
            data_validation_artifact=self.start_data_validation(data_ingestion_artifact=data_ingestion_artifact)
            data_transformation_artifact=self.start_data_transformation(data_validation_artifact=data_validation_artifact)
            model_trainer_artifact=self.start_model_trainer(data_transformation_artifact=data_transformation_artifact)
            self.sync_model_to_hf()
            
        
            
            return model_trainer_artifact
        except Exception as e:
            raise NetworkSecurityException(e,sys)
        
    
