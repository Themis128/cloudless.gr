from typing import List, Optional

from pydantic import BaseModel, Field


class AgentBase(BaseModel):
    name: str
    model: str
    prompt: str
    tools: Optional[List[str]] = []
    tags: Optional[List[str]] = []


class AgentCreate(AgentBase):
    pass


class Agent(AgentBase):
    id: str


class WorkflowBase(BaseModel):
    name: str
    nodes: list
    edges: list


class WorkflowCreate(WorkflowBase):
    pass


class Workflow(WorkflowBase):
    id: str


class Settings(BaseModel):
    apiKeys: dict
    modelPreferences: list
    # Add more fields as needed


class User(BaseModel):
    id: str
    name: str
    email: str
