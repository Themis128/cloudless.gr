from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from routers.auth import users_db
from schemas import Settings

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


router = APIRouter()

# In-memory settings for demonstration
from typing import Dict, Any

settings_db: Dict[str, Any] = {
    "apiKeys": {},
    "modelPreferences": [],
}


@router.get("/", response_model=Settings)
async def get_settings(current_user: dict = Depends(get_current_user)):
    return settings_db


@router.put("/", response_model=Settings)
async def update_settings(
    settings: Settings, current_user: dict = Depends(get_current_user)
):
    settings_db.update(settings.dict())
    return settings_db
