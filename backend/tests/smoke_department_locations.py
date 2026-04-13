import asyncio
import json
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import ChatRequest, chat  # noqa: E402


CASES = [
    {
        "prompt": "where is the math department",
        "expected_mode": "department_location_direct",
        "expected_intent": "location",
        "expected_destination_id": "science_building",
        "contains": ("Applied Mathematics", "Science Building"),
    },
    {
        "prompt": "where is the english department",
        "expected_mode": "department_location_direct",
        "expected_intent": "location",
        "expected_destination_id": "cas",
        "contains": ("Department of English", "Center for Academic Success"),
    },
    {
        "prompt": "where is computer science department",
        "expected_mode": "department_location_direct",
        "expected_intent": "location",
        "expected_destination_id": "glab",
        "contains": ("Computer Science and Technology", "Green Lane Academic Building"),
    },
    {
        "prompt": "where is the education department",
        "expected_mode": "department_location_clarify",
        "expected_intent": "general",
        "expected_destination_id": None,
        "contains": ("multiple department locations", "Department of Early Childhood Education"),
    },
]


async def run_cases() -> int:
    failures = []

    for case in CASES:
        response = await chat(ChatRequest(message=case["prompt"]))
        actual_mode = response.get("response_mode")
        actual_intent = response.get("intent")
        actual_destination_id = response.get("destination_id")
        answer = response.get("answer", "")

        ok = (
            actual_mode == case["expected_mode"]
            and actual_intent == case["expected_intent"]
            and actual_destination_id == case["expected_destination_id"]
            and isinstance(answer, str)
            and all(fragment in answer for fragment in case["contains"])
        )

        result = {
            "prompt": case["prompt"],
            "expected_mode": case["expected_mode"],
            "actual_mode": actual_mode,
            "expected_intent": case["expected_intent"],
            "actual_intent": actual_intent,
            "expected_destination_id": case["expected_destination_id"],
            "actual_destination_id": actual_destination_id,
            "ok": ok,
            "answer": answer,
        }
        print(json.dumps(result, ensure_ascii=False))
        if not ok:
            failures.append(result)

    if failures:
        print(json.dumps({"passed": False, "failures": failures}, ensure_ascii=False, indent=2))
        return 1

    print(json.dumps({"passed": True, "count": len(CASES)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run_cases()))
