from typing import List, Optional

from sqlmodel import Field, SQLModel


class Agent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    model: str
    prompt: str
    tools: Optional[List[str]] = Field(
        default_factory=list, sa_column_kwargs={"nullable": True}
    )
    tags: Optional[List[str]] = Field(
        default_factory=list, sa_column_kwargs={"nullable": True}
    )
    owner: str  # user id or username


class AgentCreate(SQLModel):
    name: str
    model: str
    prompt: str
    tools: Optional[List[str]] = Field(default_factory=list)
    tags: Optional[List[str]] = Field(default_factory=list)


class Workflow(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    nodes: str  # JSON string
    edges: str  # JSON string
    owner: str


class WorkflowCreate(SQLModel):
    name: str
    nodes: str
    edges: str


class BuilderConfig(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    project_id: Optional[int] = Field(default=None, foreign_key="project.id")
    data: str  # JSON string for builder state/config
    owner: str


class BuilderConfigCreate(SQLModel):
    name: str
    project_id: Optional[int] = None
    data: str
    owner: str
