from pydantic import BaseModel
from typing import Optional, Dict

class ModelInfo(BaseModel):
    name: str
    path: str
    owner: str

class TrainRequest(BaseModel):
    model_name: str
    train_data_path: str
    config: Dict
    owner: str

class InferRequest(BaseModel):
    model_name: str
    prompt: str
    owner: str

class JobStatus(BaseModel):
    job_id: str
    status: str
<<<<<<< HEAD
    result: Optional[Dict] = None 
=======
    result: Optional[Dict] = None
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
