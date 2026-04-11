from networksecurity.components.data_ingestion import DataIngestion
from networksecurity.exception.exception import NetworkSecurityException
from networksecurity.logging.logger import logging

from networksecurity.entity.config_entity import DataIngestionConfig
from networksecurity.entity.config_entity import TrainingPipelineConfig

import sys

if __name__ == '__main__':
    try:
        training_pipelineconfig = TrainingPipelineConfig()
        dataingestionconfig = DataIngestionConfig(training_pipelineconfig)

        data_ingestion = DataIngestion(dataingestionconfig)

        logging.info("Initiate the data ingestion")

        data_ingestionartifact = data_ingestion.initiate_data_ingestion()
        print(data_ingestionartifact)

    except Exception as e:
        raise NetworkSecurityException(e, sys)