from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# Dummy user for demonstration
users_db = {
    "testuser": {
        "username": "testuser",
        "password": "testpass",
        "id": "1",
        "name": "Test User",
        "email": "test@example.com",
    }
}


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(data: LoginRequest):
    user = users_db.get(data.username)
    if user and user["password"] == data.password:
        return {"token": "dummy-jwt-token", "user": user}
    raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/logout")
async def logout():
    return {"success": True}
