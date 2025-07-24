import os
import json
from typing import List

MODEL_ROOT = "models"

# Helper to get the path to a user's model index
def _user_index_path(owner: str):
    return os.path.join(MODEL_ROOT, owner, "models.json")

def register_model(owner: str, model_path: str):
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    index_path = _user_index_path(owner)
    if os.path.exists(index_path):
        with open(index_path, "r") as f:
            models = json.load(f)
    else:
        models = []
    model_name = os.path.basename(model_path)
    # Avoid duplicates
    if not any(m["name"] == model_name for m in models):
        models.append({"name": model_name, "path": model_path, "owner": owner})
        with open(index_path, "w") as f:
            json.dump(models, f)

def list_models(owner: str) -> List[dict]:
    index_path = _user_index_path(owner)
    if not os.path.exists(index_path):
        return []
    with open(index_path, "r") as f:
        return json.load(f)

def load_model_path(owner: str, model_name: str) -> str:
    models = list_models(owner)
    for m in models:
        if m["name"] == model_name:
            return m["path"]
    raise FileNotFoundError(f"Model {model_name} not found for user {owner}") 