from huggingface_hub import HfApi ,list_repo_files
import os
import datetime


class HuggingFaceSync:
    def __init__(self, repo_id, token=None):
        self.repo_id = repo_id
        self.token = token
        self.api = HfApi(token=token)

    def create_repo_if_not_exists(self):
        self.api.create_repo(
            repo_id=self.repo_id,
            repo_type="model",
            exist_ok=True
        )

    def get_latest_file(repo_id, prefix):
        files = list_repo_files(repo_id)

    # filter files
        filtered = [f for f in files if f.startswith(prefix)]

    # sort → latest last
        latest = sorted(filtered)[-1]

        return latest

    
    def upload_file(self, file_path, versioning=True):
        file_name = os.path.basename(file_path)

        if versioning:
            version = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            name, ext = os.path.splitext(file_name)
            file_name = f"{name}_{version}{ext}"

        self.api.upload_file(
            path_or_fileobj=file_path,
            path_in_repo=file_name,
            repo_id=self.repo_id,
            repo_type="model",
        )
        print(f"✅ Uploaded: {file_name}")

    # ✅ Remove local file after upload
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"🗑️ Deleted local file: {file_path}")

    
    def upload_folder(self, folder_path, versioning=True):
        version = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

        for root, _, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)

                if versioning:
                    name, ext = os.path.splitext(file)
                    file = f"{name}_{version}{ext}"

                self.api.upload_file(
                    path_or_fileobj=file_path,
                    path_in_repo=file,
                    repo_id=self.repo_id,
                    repo_type="model",
                )

        print(f"✅ Folder uploaded with version: {version}")