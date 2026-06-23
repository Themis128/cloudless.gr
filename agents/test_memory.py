from dotenv import load_dotenv

from agents.cloudless_research_agent import agent

load_dotenv(".env.local")

print("Step 1: Ask agent to remember preference")

result1 = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "Remember this preference for future runs: "
                    "When explaining cloudless.gr architecture, use concise bullet points."
                ),
            }
        ]
    }
)

print(result1["messages"][-1].content)

print("\nStep 2: Ask what is remembered")

result2 = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "What response style preferences do you remember for cloudless.gr?",
            }
        ]
    }
)

print(result2["messages"][-1].content)
