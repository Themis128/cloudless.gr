import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(".env.local")

client = OpenAI(
    base_url=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8001/v1"),
    api_key=os.getenv("OPENAI_API_KEY", "EMPTY"),
)

model = os.getenv(
    "LOCAL_VLLM_MODEL", os.getenv("LOCAL_MODEL_NAME", "Qwen/Qwen2.5-Coder-3B-Instruct-AWQ")
)

response = client.chat.completions.create(
    model=model,
    messages=[
        {
            "role": "system",
            "content": "You are a concise coding assistant.",
        },
        {
            "role": "user",
            "content": "Say hello and confirm you are running through local vLLM.",
        },
    ],
    temperature=0.1,
    max_tokens=256,
)

print(response.choices[0].message.content)
