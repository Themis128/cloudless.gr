from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from routers.auth import users_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.db import get_session
from backend.models import Workflow, WorkflowCreate

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


@router.get("/", response_model=List[Workflow])
async def list_workflows(
    current_user: Dict[str, Any] = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> List[Dict[str, Any]]:
    username = current_user.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid user")

    result = await session.execute(select(Workflow).where(Workflow.owner == username))
    workflows = result.scalars().all()

    return [
        {
            "id": str(w.id),
            "name": w.name,
            "nodes": w.nodes,
            "edges": w.edges,
        }
        for w in workflows
    ]


@router.post("/", response_model=Workflow)
async def create_workflow(
    workflow: WorkflowCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    db_workflow = Workflow(**workflow.model_dump(), owner=current_user["username"])
    session.add(db_workflow)
    await session.commit()
    await session.refresh(db_workflow)
    return db_workflow


@router.get("/{workflow_id}", response_model=Workflow)
async def get_workflow(
    workflow_id: int,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Workflow).where(
            Workflow.id == workflow_id, Workflow.owner == current_user["username"]
        )
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.put("/{workflow_id}", response_model=Workflow)
async def update_workflow(
    workflow_id: int,
    workflow: WorkflowCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Workflow).where(
            Workflow.id == workflow_id, Workflow.owner == current_user["username"]
        )
    )
    db_workflow = result.scalar_one_or_none()
    if not db_workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    for key, value in workflow.model_dump().items():
        setattr(db_workflow, key, value)
    session.add(db_workflow)
    await session.commit()
    await session.refresh(db_workflow)
    return db_workflow


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: int,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Workflow).where(
            Workflow.id == workflow_id, Workflow.owner == current_user["username"]
        )
    )
    db_workflow = result.scalar_one_or_none()
    if not db_workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await session.delete(db_workflow)
    await session.commit()
    return {"success": True}


@router.post("/{workflow_id}/run")
async def run_workflow(
    workflow_id: int,
    input_data: dict,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # Simulate workflow execution
    return {"output": f"Workflow {workflow_id} ran with input {input_data}", "logs": []}
