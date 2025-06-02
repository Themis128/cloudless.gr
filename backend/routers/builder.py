from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from backend.db import get_session
from backend.models import BuilderConfig, BuilderConfigCreate

router = APIRouter()


@router.get("/{id}", response_model=BuilderConfig)
def get_builder_config(id: int, session: Session = Depends(get_session)):
    config = session.get(BuilderConfig, id)
    if not config:
        raise HTTPException(status_code=404, detail="Builder config not found")
    return config


@router.post("/", response_model=BuilderConfig)
def create_builder_config(
    config: BuilderConfigCreate, session: Session = Depends(get_session)
):
    db_config = BuilderConfig.from_orm(config)
    session.add(db_config)
    session.commit()
    session.refresh(db_config)
    return db_config


@router.put("/{id}", response_model=BuilderConfig)
def update_builder_config(
    id: int, config: BuilderConfigCreate, session: Session = Depends(get_session)
):
    db_config = session.get(BuilderConfig, id)
    if not db_config:
        raise HTTPException(status_code=404, detail="Builder config not found")
    for key, value in config.dict(exclude_unset=True).items():
        setattr(db_config, key, value)
    session.add(db_config)
    session.commit()
    session.refresh(db_config)
    return db_config
