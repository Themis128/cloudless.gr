# config.py - Python version of agent config
from typing import Any, Dict, List, Optional, TypedDict


class ProviderConfig(TypedDict):
    models: List[str]
    api_key: Optional[str]


class ModelRouter(TypedDict):
    default_provider: str
    providers: Dict[str, ProviderConfig]


class MemoryConfig(TypedDict):
    vector_store: str
    object_store: str
    message_history: bool


class AgentConfig(TypedDict):
    max_tokens: int
    temperature: float
    model_router: ModelRouter
    memory: MemoryConfig


default_agent_config: AgentConfig = {
    "max_tokens": 2048,
    "temperature": 0.7,
    "model_router": {
        "default_provider": "openai",
        "providers": {
            "openai": {
                "models": ["gpt-4-turbo-preview", "gpt-4", "gpt-3.5-turbo"],
                "api_key": None,  # Set from environment
            },
            "anthropic": {
                "models": ["claude-3-opus", "claude-3-sonnet"],
                "api_key": None,
            },
            "mistral": {
                "models": ["mistral-large", "mistral-medium"],
                "api_key": None,
            },
        },
    },
    "memory": {
        "vector_store": "chroma",
        "object_store": "minio",
        "message_history": True,
    },
}
