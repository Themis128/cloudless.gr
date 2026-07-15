from agents.cloudless_fast_answers import (
    answer_registered_langsmith_endpoints,
    try_fast_answer,
)
from agents.skill_loader import select_skill_files


def test_fast_endpoint_answer_classifies_auth_required():
    answer = answer_registered_langsmith_endpoints()

    assert "langsmith.health" in answer
    assert "Safe without" in answer
    assert "Requires `LANGSMITH_API_KEY`" in answer
    assert "fleet.connections.list" in answer


def test_try_fast_answer_endpoint_question():
    answer = try_fast_answer("List registered LangSmith endpoints.")

    assert answer is not None
    assert "Registered LangSmith-related endpoints" in answer


def test_dynamic_skill_routing_k3s():
    skills = select_skill_files("How should we handle k3s PVC storage?")

    assert "skills/cloudless-k3s-storage/SKILL.md" in skills
    assert "skills/cluster-bash/SKILL.md" in skills


def test_dynamic_skill_routing_terraform():
    skills = select_skill_files("Fix Terraform issue")

    assert "skills/terraform-doctor/SKILL.md" in skills
