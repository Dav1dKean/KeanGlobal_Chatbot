import asyncio
import json
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import ChatRequest, chat  # noqa: E402


CASES = [
    ("hello", "greeting", "general"),
    ("hola", "greeting", "general"),
    ("merhaba", "greeting", "general"),
    ("你好", "greeting", "general"),
    ("안녕하세요", "greeting", "general"),
    ("سلام", "greeting", "general"),
    ("como te llamas?", "identity", "general"),
    ("what can you do?", "capabilities", "general"),
    ("que puedes hacer?", "capabilities", "general"),
    ("gracias", "thanks", "general"),
    ("谢谢", "thanks", "general"),
    ("teşekkürler", "thanks", "general"),
    ("kayit ofisi", "registration_location_direct", "faq"),
    ("ben nasıl 2026 icin kayıt yapabilirim ve nerde kayıt yapılır", "registration_help_direct", "faq"),
    ("2026 yaz donemi kayıtlari ne zaman basliyor", "calendar_event_unavailable", "calendar"),
]

SEQUENTIAL_CASES = [
    (
        "bookstore_follow_up_map",
        [
            ("where is the bookstore and how do I buy textbooks?", "bookstore_direct", "faq"),
            ("show it on map", "contextual_location_follow_up", "location"),
        ],
    ),
    (
        "registrar_follow_up_map",
        [
            ("how do I contact the registrar?", "registrar_direct", "faq"),
            ("where is it?", "contextual_location_follow_up", "location"),
            ("where do I do that?", "contextual_location_follow_up", "location"),
        ],
    ),
    (
        "prefer_service_destination",
        [
            ("where is the bookstore and how do I buy textbooks?", "bookstore_direct", "faq"),
            ("how do I contact the registrar?", "registrar_direct", "faq"),
            ("where do I go for that?", "contextual_location_follow_up", "location"),
        ],
    ),
    (
        "directions_follow_up",
        [
            ("where is the bookstore and how do I buy textbooks?", "bookstore_direct", "faq"),
            ("how do I get there?", "contextual_location_follow_up", "location"),
        ],
    ),
    (
        "last_answer_follow_up",
        [
            ("what is the smoking policy?", "smoking_policy_direct", "faq"),
            ("explain that more simply", "last_answer_follow_up", "general"),
        ],
    ),
]


async def run_cases() -> int:
    failures = []
    for prompt, expected_mode, expected_intent in CASES:
        response = await chat(ChatRequest(message=prompt))
        actual_mode = response.get("response_mode")
        actual_intent = response.get("intent")
        ok = actual_mode == expected_mode and actual_intent == expected_intent
        result = {
            "prompt": prompt,
            "expected_mode": expected_mode,
            "actual_mode": actual_mode,
            "expected_intent": expected_intent,
            "actual_intent": actual_intent,
            "ok": ok,
            "answer": response.get("answer"),
        }
        print(json.dumps(result, ensure_ascii=False))
        if not ok:
            failures.append(result)

    for label, sequence in SEQUENTIAL_CASES:
        for prompt, expected_mode, expected_intent in sequence:
            response = await chat(ChatRequest(message=prompt))
            actual_mode = response.get("response_mode")
            actual_intent = response.get("intent")
            answer = response.get("answer", "")
            ok = (
                actual_mode == expected_mode
                and actual_intent == expected_intent
                and isinstance(answer, str)
                and bool(answer.strip())
            )
            result = {
                "sequence": label,
                "prompt": prompt,
                "expected_mode": expected_mode,
                "actual_mode": actual_mode,
                "expected_intent": expected_intent,
                "actual_intent": actual_intent,
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
