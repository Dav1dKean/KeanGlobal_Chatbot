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

CONTENT_CHECKS = [
    (
        "graduation_summary_no_fake_map",
        [
            {
                "prompt": "where is graduation?",
                "expected_mode": "graduation_ceremony_direct",
                "expected_intent": "faq",
                "must_contain": ["Prudential Center", "May 20, 2026"],
                "must_not_contain": ["opened the campus map", "I also opened the campus map"],
            },
            {
                "prompt": "summarize that",
                "expected_mode": "last_answer_follow_up",
                "expected_intent": "general",
                "must_contain": ["May 20, 2026", "Prudential Center"],
                "must_not_contain": [],
            },
        ],
    ),
    (
        "coffee_food_suggestions_not_ocean_fallback",
        [
            {
                "prompt": "where can I get coffee on campus?",
                "expected_mode": None,
                "expected_intent": "location",
                "must_contain": ["You can get coffee at these locations on campus:"],
                "must_not_contain": ["Kean Ocean", "currently in development", "Uwill", "MAINTENANCE WORK REQUESTS"],
            },
        ],
    ),
    (
        "route_to_from_wording",
        [
            {
                "prompt": "how to get to Hynes from glab?",
                "expected_mode": "route_between_locations",
                "expected_intent": "location",
                "expected_start_id": "glab",
                "expected_destination_id": "Hynes_hall",
                "must_contain": ["Opening directions from Green Lane Academic Building (GLAB) to Hynes Hall."],
                "must_not_contain": [],
            },
        ],
    ),
    (
        "calendar_short_year_and_summer_sessions",
        [
            {
                "prompt": "when does fall 26 start?",
                "expected_mode": None,
                "expected_intent": "calendar",
                "must_contain": ["Fall 2026", "Term Begins", "September 1, 2026"],
                "must_not_contain": ["Which semester are you asking about?"],
            },
            {
                "prompt": "when does summer II start?",
                "expected_mode": "calendar_term_follow_up",
                "expected_intent": "calendar",
                "must_contain": ["Summer Session II Begins", "July 7, 2026"],
                "must_not_contain": ["Which semester are you asking about?"],
            },
            {
                "prompt": "when does summer I start?",
                "expected_mode": "calendar_term_follow_up",
                "expected_intent": "calendar",
                "must_contain": ["Summer Session I Begins", "May 18, 2026"],
                "must_not_contain": ["Which semester are you asking about?"],
            },
        ],
    ),
    (
        "mixed_location_and_faq_targets",
        [
            {
                "prompt": "where is naab and what time does the library opens?",
                "expected_mode": "hours_library",
                "expected_intent": "faq",
                "expected_destination_id": "naab",
                "must_contain": ["Nancy Thompson Library hours:", "North Avenue Academic Building (NAAB)"],
                "must_not_contain": ["I also highlighted Nancy Thompson Library on the map."],
            },
        ],
    ),
    (
        "mixed_location_and_calendar_targets",
        [
            {
                "prompt": "where is lhac and when does fall 26 start?",
                "expected_mode": None,
                "expected_intent": "calendar",
                "expected_destination_id": "lhac",
                "must_contain": ["Fall 2026", "Term Begins", "September 1, 2026", "Liberty Hall Academic Center (LHAC)"],
                "must_not_contain": ["multiple department locations"],
            },
            {
                "prompt": "where is liberty hall and when does fall 26 start?",
                "expected_mode": None,
                "expected_intent": "calendar",
                "expected_destination_id": "lhac",
                "must_contain": ["Fall 2026", "Term Begins", "September 1, 2026", "Liberty Hall Academic Center (LHAC)"],
                "must_not_contain": ["multiple department locations", "Liberty Hall Mansion"],
            },
            {
                "prompt": "where is naab and when fall 26 start?",
                "expected_mode": None,
                "expected_intent": "calendar",
                "expected_destination_id": "naab",
                "must_contain": ["Fall 2026", "Term Begins", "September 1, 2026", "North Avenue Academic Building (NAAB)"],
                "must_not_contain": ["Opening map."],
            },
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

    for label, sequence in CONTENT_CHECKS:
        for step in sequence:
            response = await chat(ChatRequest(message=step["prompt"]))
            actual_mode = response.get("response_mode")
            actual_intent = response.get("intent")
            answer = str(response.get("answer", ""))
            actual_start_id = response.get("start_id")
            actual_destination_id = response.get("destination_id")
            contains_required = all(fragment in answer for fragment in step.get("must_contain", []))
            excludes_forbidden = all(fragment not in answer for fragment in step.get("must_not_contain", []))
            ok = (
                actual_mode == step["expected_mode"]
                and actual_intent == step["expected_intent"]
                and actual_start_id == step.get("expected_start_id", actual_start_id)
                and actual_destination_id == step.get("expected_destination_id", actual_destination_id)
                and contains_required
                and excludes_forbidden
            )
            result = {
                "sequence": label,
                "prompt": step["prompt"],
                "expected_mode": step["expected_mode"],
                "actual_mode": actual_mode,
                "expected_intent": step["expected_intent"],
                "actual_intent": actual_intent,
                "expected_start_id": step.get("expected_start_id"),
                "actual_start_id": actual_start_id,
                "expected_destination_id": step.get("expected_destination_id"),
                "actual_destination_id": actual_destination_id,
                "must_contain": step.get("must_contain", []),
                "must_not_contain": step.get("must_not_contain", []),
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
