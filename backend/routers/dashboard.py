from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db import get_session
from backend.models import Agent, Workflow

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(session: AsyncSession = Depends(get_session)) -> Any:
    try:
        # Use func.count() for proper counts
        agent_count = await session.execute(select(func.count()).select_from(Agent))
        workflow_count = await session.execute(select(func.count()).select_from(Workflow))

        return {
            "agents": agent_count.scalar() or 0,
            "workflows": workflow_count.scalar() or 0,
            "active": True,  # Add more status checks as needed
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching dashboard stats: {str(e)}"
        )
