from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from typing import Optional, Dict, Any

from .auth import users_db

router = APIRouter()

# In-memory user profile for demonstration
user_profile = {"id": "1", "name": "Test User", "email": "test@example.com"}


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = users_db.get(username)
    if user is None:
        raise credentials_exception
    return user


@router.get("/", response_model=dict)
async def get_profile(current_user: dict = Depends(get_current_user)):
    return user_profile


@router.put("/", response_model=dict)
async def update_profile(
    profile: UserProfileUpdate, current_user: dict = Depends(get_current_user)
):
    if profile.name:
        user_profile["name"] = profile.name
    if profile.email:
        user_profile["email"] = profile.email
    return user_profile


class UserProfile(BaseModel):
    name: str
    email: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


@router.get("/profile-by-token")
async def get_profile_by_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, "your-secret-key", algorithms=["HS256"])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = users_db.get(username)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")

        return {"name": user["name"], "email": user["email"], "id": user["id"]}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
