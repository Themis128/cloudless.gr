from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import (agents, auth, builder, dashboard, settings, users,
                     workflows)

app = FastAPI(title="AI Agent Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(agents.router, prefix="/agents", tags=["agents"])
app.include_router(workflows.router, prefix="/workflows", tags=["workflows"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])
app.include_router(users.router, prefix="/profile", tags=["profile"])
app.include_router(builder.router, prefix="/builder", tags=["builder"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])

#
# This backend file should provide:
# - API endpoints for dashboard stats (agent count, workflows, users, model usage)
# - API endpoint for recent activity (agent runs, deployments, errors)
# - User info endpoint for authentication/authorization
# - Security: All endpoints should check user permissions
#


@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    # Replace with real DB queries
    return {
        "agents": 5,
        "workflows": 2,
        "users": 10,
        "modelUsage": "OpenAI: 100k tokens",
    }


@app.get("/api/dashboard/activity")
def get_recent_activity():
    # Replace with real DB queries
    return [
        {"id": 1, "title": "Agent run completed", "timestamp": "2025-06-01 10:00"},
        {"id": 2, "title": "Workflow deployed", "timestamp": "2025-06-01 09:30"},
    ]


@app.get("/api/user/info")
def get_user_info():
    # Replace with real auth/user logic
    return {
        "name": "Demo User",
        "role": "admin",
        "permissions": ["dashboard:view", "agent:create"],
    }
