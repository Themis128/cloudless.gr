from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
from typing import List, Optional
import uuid
import os
import json
from app.llm_manager import register_model, list_models
from app.tasks import train_model_task, infer_task

app = FastAPI()

JOBS_FILE = "models/jobs.json"
os.makedirs("models", exist_ok=True)
if not os.path.exists(JOBS_FILE):
    with open(JOBS_FILE, "w") as f:
        json.dump({}, f)

MAX_JOBS_PER_USER = 2
MAX_DISK_MB = 2048

# --- Utility functions for quotas ---
def user_job_count(owner):
    with open(JOBS_FILE, "r") as f:
        jobs = json.load(f)
    return sum(1 for j in jobs.values() if j.get("owner") == owner and j.get("status") in ("queued", "running"))

def user_disk_usage_mb(owner):
    user_dir = os.path.join("models", owner)
    total = 0
    for root, _, files in os.walk(user_dir):
        for f in files:
            fp = os.path.join(root, f)
            total += os.path.getsize(fp)
    return total // (1024 * 1024)

def save_job(job_id, job_data):
    with open(JOBS_FILE, "r") as f:
        jobs = json.load(f)
    jobs[job_id] = job_data
    with open(JOBS_FILE, "w") as f:
        json.dump(jobs, f)

def get_job(job_id):
    with open(JOBS_FILE, "r") as f:
        jobs = json.load(f)
    return jobs.get(job_id, {"status": "not_found"})

class ModelInfo(BaseModel):
    name: str
    path: str
    owner: str

class TrainRequest(BaseModel):
    model_name: str
    train_data_path: str
    config: dict
    owner: str

class InferRequest(BaseModel):
    model_name: str
    prompt: str
    owner: str

@app.post("/llms/upload")
async def upload_model(owner: str = Form(...), file: UploadFile = File(...)):
    # Quota check: disk
    usage = user_disk_usage_mb(owner)
    if usage > MAX_DISK_MB:
        raise HTTPException(status_code=400, detail=f"Disk quota exceeded: {usage}MB used, limit {MAX_DISK_MB}MB")
    # Save uploaded model file
    model_dir = f"models/{owner}"
    os.makedirs(model_dir, exist_ok=True)
    file_path = os.path.join(model_dir, file.filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())
    # Register model
    register_model(owner, file_path)
    return {"status": "success", "model_path": file_path}

@app.get("/llms/list")
def list_models_endpoint(owner: str):
    # List models for the user
    return list_models(owner)

@app.post("/llms/train")
def train_model(req: TrainRequest):
    # Quota check: jobs
    if user_job_count(req.owner) >= MAX_JOBS_PER_USER:
        raise HTTPException(status_code=400, detail=f"Job quota exceeded: max {MAX_JOBS_PER_USER} concurrent jobs.")
    # Quota check: disk
    usage = user_disk_usage_mb(req.owner)
    if usage > MAX_DISK_MB:
        raise HTTPException(status_code=400, detail=f"Disk quota exceeded: {usage}MB used, limit {MAX_DISK_MB}MB")
    # Start training job (enqueue Celery task)
    job_id = str(uuid.uuid4())
    celery_result = train_model_task.apply_async(args=[req.model_name, req.train_data_path, req.config, req.owner])
    job_data = {"status": "queued", "type": "train", "model": req.model_name, "celery_id": celery_result.id, "owner": req.owner}
    save_job(job_id, job_data)
    return {"job_id": job_id, "status": "queued"}

@app.post("/llms/infer")
def infer(req: InferRequest):
    # Quota check: jobs
    if user_job_count(req.owner) >= MAX_JOBS_PER_USER:
        raise HTTPException(status_code=400, detail=f"Job quota exceeded: max {MAX_JOBS_PER_USER} concurrent jobs.")
    # Start inference job (enqueue Celery task)
    job_id = str(uuid.uuid4())
    celery_result = infer_task.apply_async(args=[req.model_name, req.prompt, req.owner])
    job_data = {"status": "queued", "type": "infer", "model": req.model_name, "celery_id": celery_result.id, "owner": req.owner}
    save_job(job_id, job_data)
    return {"job_id": job_id, "status": "queued"}

@app.get("/llms/job-status/{job_id}")
def job_status(job_id: str):
    # Return job status/result
    job = get_job(job_id)
    if job.get("status") == "queued" and "celery_id" in job:
        from celery.result import AsyncResult
        res = AsyncResult(job["celery_id"])
        if res.ready():
            result = res.result
            job["status"] = result.get("status", "done")
            job["result"] = result
            save_job(job_id, job)
    return job

@app.get("/llms/quota")
def get_quota(owner: str):
    return {
        "jobs_running": user_job_count(owner),
        "max_jobs": MAX_JOBS_PER_USER,
        "disk_mb": user_disk_usage_mb(owner),
        "max_disk_mb": MAX_DISK_MB
    }

@app.get("/metrics", response_class=PlainTextResponse)
def metrics():
    # Prometheus format
    with open(JOBS_FILE, "r") as f:
        jobs = json.load(f)
    job_status_counts = {"queued": 0, "running": 0, "completed": 0, "failed": 0}
    user_job_counts = {}
    for job in jobs.values():
        st = job.get("status", "unknown")
        job_status_counts[st] = job_status_counts.get(st, 0) + 1
        owner = job.get("owner", "unknown")
        user_job_counts[owner] = user_job_counts.get(owner, 0) + 1
    lines = []
    for st, count in job_status_counts.items():
        lines.append(f"llm_jobs_status{{status=\"{st}\"}} {count}")
    for owner, count in user_job_counts.items():
        lines.append(f"llm_jobs_user_total{{owner=\"{owner}\"}} {count}")
    # Disk usage per user
    for owner in user_job_counts:
        usage = user_disk_usage_mb(owner)
        lines.append(f"llm_user_disk_mb{{owner=\"{owner}\"}} {usage}")
<<<<<<< HEAD
    return "\n".join(lines) 
=======
    return "\n".join(lines)
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
