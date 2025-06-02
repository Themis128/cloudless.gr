from datetime import datetime, timedelta
from typing import List, Optional, cast
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from sqlalchemy import desc
from sqlalchemy.sql import ColumnElement

from backend.db import get_session
from backend.models import Agent, AgentCreate

SECRET_KEY = "your-secret-key"  # Change this in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)):
    from .auth import users_db  # Avoid circular import

    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = users_db.get(username)
    if user is None:
        raise credentials_exception
    return user


router = APIRouter()


@router.get("/", response_model=List[Agent])
async def list_agents(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Agent).where(Agent.owner == current_user["username"])
    )
    return result.scalars().all()


@router.post("/", response_model=Agent)
async def create_agent(
    agent: AgentCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    db_agent = Agent(**agent.dict(), owner=current_user["username"])
    session.add(db_agent)
    await session.commit()
    await session.refresh(db_agent)
    return db_agent


@router.get("/{agent_id}", response_model=Agent)
async def get_agent(
    agent_id: int,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Agent).where(
            Agent.id == agent_id, Agent.owner == current_user["username"]
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.put("/{agent_id}", response_model=Agent)
async def update_agent(
    agent_id: int,
    agent: AgentCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Agent).where(
            Agent.id == agent_id, Agent.owner == current_user["username"]
        )
    )
    db_agent = result.scalar_one_or_none()
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    for key, value in agent.dict().items():
        setattr(db_agent, key, value)
    session.add(db_agent)
    await session.commit()
    await session.refresh(db_agent)
    return db_agent


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: int,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Agent).where(
            Agent.id == agent_id, Agent.owner == current_user["username"]
        )
    )
    db_agent = result.scalar_one_or_none()
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await session.delete(db_agent)
    await session.commit()
    return {"success": True}


@router.post("/{agent_id}/run")
async def run_agent(
    agent_id: int,
    input: dict,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # Simulate agent execution
    return {"output": f"Agent {agent_id} ran with input {input}", "logs": []}


@router.get("/recent", response_model=List[Agent])
async def recent_agents(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Agent)
        .where(Agent.owner == current_user["username"])
        .order_by(desc(cast(ColumnElement, Agent.id)))
        .limit(5)
    )
    return result.scalars().all()
