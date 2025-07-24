# llm-backend

This service provides local LLM (Large Language Model) management for the platform, including:
- Model upload and registration
- Training and fine-tuning jobs (with queueing)
- Inference API
- Job status tracking
- Resource limits and quotas
- Monitoring endpoints

## Stack
- FastAPI (REST API)
- Celery (background jobs)
- Redis (Celery broker)
- HuggingFace Transformers (default LLM backend, extensible)

## Directory Structure
- `app/main.py` — FastAPI app and API endpoints
- `app/models.py` — Pydantic models and schemas
- `app/tasks.py` — Celery tasks for training, inference, etc.
- `app/llm_manager.py` — Model management logic
- `app/utils.py` — Utility functions
- `celery_worker.py` — Celery worker entrypoint
- `requirements.txt` — Python dependencies

## Features
- **Resource Limits**: Per-user job limits (max 2 concurrent) and disk quotas (2GB)
- **Error Handling**: Comprehensive error handling with clear messages
- **Monitoring**: Prometheus-compatible metrics endpoint at `/metrics`
- **Job Queueing**: Background processing with status tracking

## Usage
- Start FastAPI server for API
- Start Celery worker for background jobs
- Configure Redis as broker

## Docker/DevOps Usage

### Build and Run with Docker Compose

1. Build and start all services (API, worker, Redis):

```sh
docker-compose up --build
```

- The FastAPI server will be available at http://localhost:8000
- The Celery worker will process training/inference jobs in the background.
- Redis is used as the broker and backend for Celery.

### Manual Docker Commands

- Build the image:
  ```sh
  docker build -t llm-backend .
  ```
- Run the API server:
  ```sh
  docker run --rm -p 8000:8000 -v $(pwd)/models:/app/models llm-backend
  ```
- Run the Celery worker:
  ```sh
  docker run --rm -v $(pwd)/models:/app/models llm-backend celery -A app.tasks.celery_app worker --loglevel=info
  ```

### Notes
- All models and job data are persisted in the `models/` directory (mounted as a volume).
- Adjust `API_BASE` in your frontend if running on a different host/port.

## API Endpoints

- `POST /llms/upload` — Upload a model file
- `GET /llms/list` — List user's models
- `POST /llms/train` — Start training/fine-tuning job
- `POST /llms/infer` — Run inference job
- `GET /llms/job-status/{job_id}` — Check job status
- `GET /llms/quota` — Get user quota usage
- `GET /metrics` — Prometheus metrics

## TODO
- Implement user authentication and per-user model isolation
- Add more advanced resource limits and quotas
- Extend model backend support (e.g., llama.cpp)
- Add job progress tracking and real-time updates 