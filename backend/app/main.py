
from typing import Literal, Optional
import os
import re
import json
from pathlib import Path

from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# -----------------------
# CONFIG
# -----------------------

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "mistral")
OLLAMA_CONNECT_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_CONNECT_TIMEOUT_SECONDS", "5"))
OLLAMA_READ_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_READ_TIMEOUT_SECONDS", "30"))
OLLAMA_HEALTH_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_HEALTH_TIMEOUT_SECONDS", "5"))
OLLAMA_MAX_RETRIES = int(os.getenv("OLLAMA_MAX_RETRIES", "1"))
<<<<<<< Updated upstream
=======
OLLAMA_NUM_PREDICT = int(os.getenv("OLLAMA_NUM_PREDICT", "160"))
OLLAMA_TEMPERATURE = float(os.getenv("OLLAMA_TEMPERATURE", "0.2"))
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "2048"))
RAG_MAX_RESULTS = int(os.getenv("RAG_MAX_RESULTS", "5"))
RAG_FALLBACK_MAX_RESULTS = int(os.getenv("RAG_FALLBACK_MAX_RESULTS", "3"))
RAG_MAX_CHARS_PER_BLOCK = int(os.getenv("RAG_MAX_CHARS_PER_BLOCK", "650"))
RAG_MAX_PROMPT_CONTEXT_CHARS = int(os.getenv("RAG_MAX_PROMPT_CONTEXT_CHARS", "2200"))
FAQ_FAST_PATH_ENABLED = os.getenv("FAQ_FAST_PATH_ENABLED", "1").strip().lower() in {"1", "true", "yes", "on"}
FAQ_FAST_PATH_MAX_LINES = int(os.getenv("FAQ_FAST_PATH_MAX_LINES", "3"))
>>>>>>> Stashed changes
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8000,http://localhost:8000",
)

# -----------------------
# APP SETUP
# -----------------------

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PROGRAMS_FILE = DATA_DIR / "program_info.json"

class ChatRequest(BaseModel):
    message: str

# -----------------------
# OLLAMA FUNCTION
# -----------------------

NYC_TIMEZONE = ZoneInfo("America/New_York")
LOCAL_TIME_PATTERNS = [
    re.compile(r"\btime\b.*\b(nyc|new york|new york city|newark|new jersey|nj|est|eastern)\b", re.IGNORECASE),
    re.compile(r"\b(nyc|new york|new york city|newark|new jersey|nj|est|eastern)\b.*\btime\b", re.IGNORECASE),
]
LIBRARY_HOURS_PATTERNS = [
    re.compile(r"\b(library|nancy thompson)\b.*\b(hour|hours|open|opened|close|closing)\b", re.IGNORECASE),
    re.compile(r"\b(hour|hours|open|opened|close|closing)\b.*\b(library|nancy thompson)\b", re.IGNORECASE),
]
LOCATION_INTENT_KEYWORDS = (
    "where",
    "map",
    "location",
    "directions",
    "route",
    "how do i get",
    "how to get",
    "take me to",
    "find",
)
BUILDING_ALIASES = {
    "kean hall": "kean_hall",
    "green lane academic building": "glassman_hall",
    "glassman hall": "glassman_hall",
    "glassman": "glassman_hall",
    "glab": "glassman_hall",
    "nancy thompson library": "library",
    "library": "library",
    "stem building": "stem",
    "stem": "stem",
    "downs hall": "downs_hall",
    "downs": "downs_hall",
    "harwood arena": "harwood",
    "harwood": "harwood",
    "university center": "uc",
    "student center": "uc",
    "miron student center": "uc",
    "msc": "uc",
    "human rights institute": "library",
    "hri": "library",
    "uc": "uc",
}


def get_time_response(prompt: str):
    lowered = prompt.lower()
    if not any(token in lowered for token in ["time", "date", "day", "today"]):
        return None

<<<<<<< Updated upstream
    is_local_time_question = any(pattern.search(prompt) for pattern in LOCAL_TIME_PATTERNS)
    is_generic_time_question = lowered.strip() in {"what time is it", "what time is it?"}
    if not is_local_time_question and not is_generic_time_question:
        return None
=======
campus_locations = load_campus_locations()
campus_location_by_id = {place["id"]: place for place in campus_locations}
fallback_rag_docs = []
program_catalog = load_program_catalog()
FAQ_INTENT_KEYWORDS = load_faq_intent_keywords()
>>>>>>> Stashed changes

    location_label = "New York City"
    if any(token in lowered for token in ["newark", "new jersey", " nj"]):
        location_label = "Newark, New Jersey"

    now_nyc = datetime.now(NYC_TIMEZONE)
    timezone_name = now_nyc.tzname() or "ET"
    return (
        f"The current time in {location_label} is {now_nyc.strftime('%I:%M %p')} "
        f"on {now_nyc.strftime('%A, %B %d, %Y')} ({timezone_name})."
    )


def get_library_hours_response(prompt: str):
    if not any(pattern.search(prompt) for pattern in LIBRARY_HOURS_PATTERNS):
        return None

    return (
        "I do not have live library opening hours in this build. "
        "Please check the Nancy Thompson Library website or front desk for today's exact times."
    )


def get_location_response(prompt: str):
    lowered = prompt.lower().strip()
    destination_id = None

    for alias, candidate_id in BUILDING_ALIASES.items():
        if alias in lowered:
            destination_id = candidate_id
            break

    is_location_intent = destination_id is not None or any(
        keyword in lowered for keyword in LOCATION_INTENT_KEYWORDS
    )
    if not is_location_intent:
        return None

    if destination_id:
        return {
            "answer": "Map opened. I set directions from your current location to your requested building.",
            "reply": "Map opened. I set directions from your current location to your requested building.",
            "intent": "location",
            "destination_id": destination_id,
            "use_current_location": True,
        }

    return {
        "answer": "Map opened. Choose a destination and I can guide you there from your current location.",
        "reply": "Map opened. Choose a destination and I can guide you there from your current location.",
        "intent": "location",
        "destination_id": None,
        "use_current_location": True,
    }


def build_ollama_timeout() -> httpx.Timeout:
    return httpx.Timeout(
        connect=OLLAMA_CONNECT_TIMEOUT_SECONDS,
        read=OLLAMA_READ_TIMEOUT_SECONDS,
        write=OLLAMA_CONNECT_TIMEOUT_SECONDS,
        pool=OLLAMA_CONNECT_TIMEOUT_SECONDS,
    )

<<<<<<< Updated upstream

async def query_ollama(prompt: str):
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": "You are a helpful university policy assistant."},
            {"role": "user", "content": prompt}
=======
async def query_ollama(prompt: str, lang: str):
    lang_name = LANGUAGE_NAMES.get(lang, "English")
    return await call_ollama(
        [
            {
                "role": "system",
                "content": (
                    "You are the Kean Global concierge assistant for the Kean University website. "
                    f"Respond only in {lang_name}. "
                    "Use simple, easy-to-understand language. "
                    "Be concise, factual, polite, and friendly. "
                    "Default to English unless the user asks in another language. "
                    "Do not invent policy or calendar facts. "
                    "Do not cite sources or filenames. "
                    "If the user asks about a specific program, major, or degree, act as an academic advisor. "
                    "Clearly list the required credits and core courses using a numbered list (1., 2., 3.) with line breaks if that information is in the context."
                    "Keep the response short and easy to read (max 9 sentences)."
                ),
            },
            {"role": "user", "content": prompt},
>>>>>>> Stashed changes
        ],
        "stream": False,
        "options": {
            "num_predict": 512,
            "temperature": 0.3
        }
    }

    timeout = build_ollama_timeout()
    for attempt in range(1, OLLAMA_MAX_RETRIES + 2):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(OLLAMA_URL, json=payload)

            print("STATUS:", response.status_code)
            print("RAW:", response.text[:300])

            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "No response from model.")
        except httpx.TimeoutException:
            if attempt <= OLLAMA_MAX_RETRIES:
                continue
        except httpx.HTTPStatusError as exc:
            return f"ERROR: Ollama returned HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        except httpx.RequestError as exc:
            return f"ERROR contacting Ollama: {str(exc)}"
        except ValueError:
            return "ERROR: Ollama returned invalid JSON"

    return (
        "ERROR: Ollama timed out. "
        f"Configured read timeout is {OLLAMA_READ_TIMEOUT_SECONDS:.0f}s at {OLLAMA_URL}. "
        "Increase OLLAMA_READ_TIMEOUT_SECONDS or verify Ollama/model is running."
    )


def get_ollama_tags_url() -> str:
    # Convert configured chat endpoint to Ollama tags endpoint for lightweight health checks.
    if OLLAMA_URL.endswith("/api/chat"):
        return OLLAMA_URL[: -len("/api/chat")] + "/api/tags"
    return "http://127.0.0.1:11434/api/tags"

# -----------------------
# ROUTES
# -----------------------

@app.get("/api/programs")
def get_programs():
    """
    Returns the parsed JSON data for all Kean programs.
    """
    if not PROGRAMS_FILE.exists():
        raise HTTPException(status_code=404, detail="Program data file not found on the server.")
        
    try:
        with open(PROGRAMS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load program data: {str(e)}")
    
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

    is_local_time_question = any(pattern.search(prompt) for pattern in LOCAL_TIME_PATTERNS)
    is_generic_time_question = lowered.strip() in {"what time is it", "what time is it?"}
    if not is_local_time_question and not is_generic_time_question:
        return None

    location_label = "New York City"
    if any(token in lowered for token in ["newark", "new jersey", " nj"]):
        location_label = "Newark, New Jersey"

    now_nyc = datetime.now(NYC_TIMEZONE)
    timezone_name = now_nyc.tzname() or "ET"
    return (
        f"The current time in {location_label} is {now_nyc.strftime('%I:%M %p')} "
        f"on {now_nyc.strftime('%A, %B %d, %Y')} ({timezone_name})."
    )


def get_library_hours_response(prompt: str):
    if not any(pattern.search(prompt) for pattern in LIBRARY_HOURS_PATTERNS):
        return None

    return (
        "I do not have live library opening hours in this build. "
        "Please check the Nancy Thompson Library website or front desk for today's exact times."
    )


def get_location_response(prompt: str):
    lowered = prompt.lower().strip()
    destination_id = None

    for alias, candidate_id in BUILDING_ALIASES.items():
        if alias in lowered:
            destination_id = candidate_id
            break

    is_location_intent = destination_id is not None or any(
        keyword in lowered for keyword in LOCATION_INTENT_KEYWORDS
    )
    if not is_location_intent:
        return None

    if destination_id:
        return {
            "answer": "Map opened. I set directions from your current location to your requested building.",
            "reply": "Map opened. I set directions from your current location to your requested building.",
            "intent": "location",
            "destination_id": destination_id,
            "use_current_location": True,
        }

    return {
        "answer": "Map opened. Choose a destination and I can guide you there from your current location.",
        "reply": "Map opened. Choose a destination and I can guide you there from your current location.",
        "intent": "location",
        "destination_id": None,
        "use_current_location": True,
    }


def build_ollama_timeout() -> httpx.Timeout:
    return httpx.Timeout(
        connect=OLLAMA_CONNECT_TIMEOUT_SECONDS,
        read=OLLAMA_READ_TIMEOUT_SECONDS,
        write=OLLAMA_CONNECT_TIMEOUT_SECONDS,
        pool=OLLAMA_CONNECT_TIMEOUT_SECONDS,
    )


async def query_ollama(prompt: str):
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": "You are a helpful university policy assistant."},
            {"role": "user", "content": prompt}
        ],
        "stream": False,
        "options": {
            "num_predict": 512,
            "temperature": 0.3
        }
    }

    timeout = build_ollama_timeout()
    for attempt in range(1, OLLAMA_MAX_RETRIES + 2):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(OLLAMA_URL, json=payload)

            print("STATUS:", response.status_code)
            print("RAW:", response.text[:300])

            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "No response from model.")
        except httpx.TimeoutException:
            if attempt <= OLLAMA_MAX_RETRIES:
                continue
        except httpx.HTTPStatusError as exc:
            return f"ERROR: Ollama returned HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        except httpx.RequestError as exc:
            return f"ERROR contacting Ollama: {str(exc)}"
        except ValueError:
            return "ERROR: Ollama returned invalid JSON"

    return (
        "ERROR: Ollama timed out. "
        f"Configured read timeout is {OLLAMA_READ_TIMEOUT_SECONDS:.0f}s at {OLLAMA_URL}. "
        "Increase OLLAMA_READ_TIMEOUT_SECONDS or verify Ollama/model is running."
    )


def get_ollama_tags_url() -> str:
    # Convert configured chat endpoint to Ollama tags endpoint for lightweight health checks.
    if OLLAMA_URL.endswith("/api/chat"):
        return OLLAMA_URL[: -len("/api/chat")] + "/api/tags"
    return "http://127.0.0.1:11434/api/tags"

# -----------------------
# ROUTES
# -----------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/ollama")
def health_ollama():
    tags_url = get_ollama_tags_url()
    try:
        response = httpx.get(tags_url, timeout=OLLAMA_HEALTH_TIMEOUT_SECONDS)
        response.raise_for_status()
        data = response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=503, detail="Ollama health check timed out.") from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"Ollama is unreachable: {exc}") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=503, detail=f"Ollama returned HTTP {exc.response.status_code}.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Ollama returned invalid JSON.") from exc

    models = data.get("models", []) if isinstance(data, dict) else []
    model_names = [m.get("name") for m in models if isinstance(m, dict) and m.get("name")]
    configured_model_found = MODEL_NAME in model_names or any(
        name.startswith(f"{MODEL_NAME}:") for name in model_names
    )
    return {
        "status": "ok",
        "ollama_reachable": True,
        "configured_chat_url": OLLAMA_URL,
        "tags_url": tags_url,
        "configured_model": MODEL_NAME,
        "configured_model_found": configured_model_found,
        "available_models": model_names,
    }


@app.post("/chat")
async def chat(req: ChatRequest):
    time_response = get_time_response(req.message)
    if time_response:
        return {"answer": time_response, "reply": time_response, "intent": "general"}

    library_hours_response = get_library_hours_response(req.message)
    if library_hours_response:
        return {"answer": library_hours_response, "reply": library_hours_response, "intent": "general"}

    location_response = get_location_response(req.message)
    if location_response:
        return location_response

<<<<<<< Updated upstream
    reply = await query_ollama(req.message)
    return {"answer": reply, "reply": reply, "intent": "general"}
=======
    if is_help_capabilities_question(user_text):
        return {
            "answer": trn("capabilities_reply", lang),
            "intent": "general",
            "response_mode": "capabilities",
        }

    if is_identity_question(user_text):
        return {
            "answer": trn("bot_identity_intro", lang),
            "intent": "general",
            "response_mode": "identity",
        }

    if is_greeting(user_text):
        return {
            "answer": trn("greeting_intro", lang),
            "intent": "general",
            "response_mode": "greeting",
        }

    if is_thanks(user_text):
        return {
            "answer": trn("thanks_reply", lang),
            "intent": "general",
            "response_mode": "thanks",
        }

    if is_farewell(user_text):
        return {
            "answer": trn("farewell_reply", lang),
            "intent": "general",
            "response_mode": "farewell",
        }

    if is_clarification_request(user_text):
        return {
            "answer": trn("clarify_reply", lang),
            "intent": "general",
            "response_mode": "clarify",
        }

    if is_acknowledgment(user_text):
        return {
            "answer": trn("acknowledgment_reply", lang),
            "intent": "general",
            "response_mode": "acknowledgment",
        }

    if is_frustration(user_text):
        return {
            "answer": trn("frustration_reply", lang),
            "intent": "general",
            "response_mode": "frustration",
        }

    if is_shuttle_question(user_text):
        return with_location({
            "answer": await localized(build_shuttle_answer(lang)),
            "intent": "faq",
            "faq_topic": "parking_transport",
            "response_mode": "shuttle_direct",
        })

    if is_hours_question(user_text):
        hours_target = detect_hours_target(user_text)
        if hours_target:
            return with_location({
                "answer": await localized(build_target_hours_answer(hours_target, lang)),
                "intent": "faq",
                "faq_topic": "hours",
                "response_mode": f"hours_{hours_target}",
            })
        return with_location({
            "answer": trn("hours_target_prompt", lang),
            "intent": "faq",
            "faq_topic": "hours",
            "response_mode": "hours_target_prompt",
        })

    if is_course_repeat_question(user_text):
        return with_location({
            "answer": await localized(build_course_repeat_answer(lang)),
            "intent": "faq",
            "faq_topic": "policies",
            "response_mode": "course_repeat_policy",
        })

    if is_admissions_question(user_text):
        return with_location({
            "answer": await localized(build_admissions_answer(lang)),
            "intent": "faq",
            "faq_topic": "admissions",
            "response_mode": "admissions_direct",
        })

    if is_graduation_question(user_text):
        return with_location({
            "answer": await localized(build_graduation_answer(lang)),
            "intent": "faq",
            "faq_topic": "policies",
            "response_mode": "graduation_direct",
        })

    if is_financial_aid_question(user_text):
        return with_location({
            "answer": await localized(build_financial_aid_answer(lang)),
            "intent": "faq",
            "faq_topic": "financial_aid",
            "response_mode": "financial_aid_direct",
        })

    if is_student_accounts_question(user_text):
        return with_location({
            "answer": await localized(build_student_accounts_answer(lang)),
            "intent": "faq",
            "faq_topic": "student_accounts",
            "response_mode": "student_accounts_direct",
        })

    if is_housing_question(user_text):
        return with_location({
            "answer": await localized(build_housing_answer(lang)),
            "intent": "faq",
            "faq_topic": "housing",
            "response_mode": "housing_direct",
        })

    if is_health_services_question(user_text):
        return with_location({
            "answer": await localized(build_health_services_answer(lang)),
            "intent": "faq",
            "faq_topic": "health_services",
            "response_mode": "health_services_direct",
        })

    if is_accessibility_question(user_text):
        return with_location({
            "answer": await localized(build_accessibility_answer(lang)),
            "intent": "faq",
            "faq_topic": "accessibility",
            "response_mode": "accessibility_direct",
        })

    if is_bookstore_question(user_text):
        return with_location({
            "answer": await localized(build_bookstore_answer(lang)),
            "intent": "faq",
            "faq_topic": "bookstore",
            "response_mode": "bookstore_direct",
        })

    if is_registrar_question(user_text):
        return with_location({
            "answer": await localized(build_registrar_answer(lang)),
            "intent": "faq",
            "faq_topic": "registration",
            "response_mode": "registrar_direct",
        })

    if is_one_stop_question(user_text):
        return with_location({
            "answer": await localized(build_one_stop_answer(lang)),
            "intent": "faq",
            "faq_topic": "registration",
            "response_mode": "one_stop_direct",
        })

    if is_dining_question(user_text):
        return with_location({
            "answer": await localized(build_dining_answer(lang)),
            "intent": "faq",
            "faq_topic": "hours",
            "response_mode": "dining_direct",
        })

    if is_smoking_policy_question(user_text):
        return with_location({
            "answer": await localized(build_smoking_policy_answer(lang)),
            "intent": "faq",
            "faq_topic": "smoking_policy",
            "response_mode": "smoking_policy_direct",
        })

    if faq_topic == "policies":
        return with_location({
            "answer": await localized(build_general_policy_overview_answer(lang)),
            "intent": "faq",
            "faq_topic": "policies",
            "response_mode": "policy_overview_direct",
        })

    if is_program_follow_up_question(user_text):
        current_subject = extract_degree_subject_phrase(user_text) or extract_follow_up_subject_phrase(user_text)
        current_level = detect_degree_level(user_text)
        follow_up_subject = (current_subject or conversation_state.get("last_degree_subject") or "").strip()
        follow_up_level = current_level if current_subject else (conversation_state.get("last_degree_level") or current_level)

        if follow_up_subject:
            follow_up_query = f"{follow_up_subject} {follow_up_level or ''} degree program details".strip()
            context_blocks = retrieve_fallback_context(follow_up_query, faq_topic="programs")
            follow_up_answer = build_fast_path_answer(
                follow_up_query,
                context_blocks,
                lang,
                max_lines=3,
                faq_topic="programs",
            )
            if follow_up_answer:
                conversation_state["last_degree_subject"] = follow_up_subject
                conversation_state["last_degree_level"] = follow_up_level
                return with_location({
                    "answer": await localized(follow_up_answer),
                    "intent": "faq",
                    "faq_topic": "programs",
                    "sources_used": len(context_blocks),
                    "response_mode": "program_follow_up",
                })
        return with_location({
            "answer": trn("program_follow_up_prompt", lang),
            "intent": "faq",
            "faq_topic": "programs",
            "response_mode": "program_follow_up_prompt",
        })

    if is_food_question(user_text):
        food_suggestions = find_food_suggestions(user_text, max_results=3)
        if food_suggestions:
            primary = food_suggestions[0]
            suggestion_lines = [trn("food_suggestions_intro", lang)]
            for index, place in enumerate(food_suggestions, start=1):
                suggestion_lines.append(f"{index}. {place.get('name', 'Food location')} ({place.get('campus', 'Main')})")
            return {
                "answer": "\n".join(suggestion_lines),
                "intent": "location",
                "destination_id": primary.get("id"),
                "food_suggestions": [
                    {
                        "id": place.get("id"),
                        "name": place.get("name"),
                        "campus": place.get("campus", "Main"),
                    }
                    for place in food_suggestions
                ],
                "use_current_location": False,
                "location_mode": "highlight",
            }

    if is_closest_parking_question(user_text):
        reference_id = find_location_destination_id(
            user_text,
            allowed_types={"building", "entrance"},
        )
        if not reference_id:
            return {"answer": trn("closest_parking_unknown_target", lang), "intent": "general"}

        reference = get_effective_reference_location(reference_id)
        closest_lot = find_closest_parking_lot(reference_id)
        if not reference or not closest_lot:
            return {
                "answer": trn("closest_parking_not_found", lang, target=(reference or {}).get("name", "that location")),
                "intent": "general",
            }

        return {
            "answer": trn("closest_parking_found", lang, target=reference["name"], lot=closest_lot["name"]),
            "intent": "location",
            "destination_id": closest_lot["id"],
            "use_current_location": False,
            "location_mode": "highlight",
        }

    if is_parking_ticket_fee_question(user_text):
        return with_location({
            "answer": await localized(build_parking_ticket_fee_answer(lang)),
            "intent": "faq",
            "faq_topic": "parking_transport",
            "response_mode": "policy_fee_summary",
        })

    if is_parking_location_question(user_text):
        audience = parking_audience(user_text)
        key = {
            "student": "parking_guidance_student",
            "faculty": "parking_guidance_faculty",
            "overnight": "parking_guidance_overnight",
        }.get(audience, "parking_guidance_general")
        return {
            "answer": trn(key, lang),
            "intent": "location",
            "destination_id": None,
            "use_current_location": False,
            "location_mode": "highlight",
        }

    if non_mapped_campus_name:
        return {
            "answer": trn("campus_map_in_development", lang, campus=non_mapped_campus_name),
            "intent": "general",
            "response_mode": "campus_map_in_development",
        }

    if location_context_requested and not faq_topic:
        if normalized_destination_id:
            destination = campus_location_by_id.get(normalized_destination_id, {})
            return {
                "answer": trn(
                    "location_opening_specific",
                    lang,
                    name=destination.get("name", "That location"),
                    campus=destination.get("campus", "campus"),
                ),
                "intent": "location",
                "destination_id": normalized_destination_id,
                "use_current_location": use_current_location,
                "location_mode": location_mode,
            }
        return {
            "answer": trn("location_opening_generic", lang),
            "intent": "location",
            "destination_id": None,
            "use_current_location": use_current_location,
            "location_mode": location_mode,
        }

    if is_calendar_question(user_text) or is_calendar_timing_question(user_text):
        term = extract_term_from_text(user_text)
        session = extract_session_from_text(user_text)
        category = detect_event_category(user_text) or pending_calendar_category
        if term:
            matched = next((t for t in calendar_data if term in t), None)
            if matched and category:
                best_event = find_best_calendar_event(calendar_data[matched], category, session=session)
                if best_event:
                    conversation_state["pending_calendar_category"] = None
                    event, date = best_event
                    return with_location({
                        "answer": f"{localize_calendar_event_text(event, lang)}: {localize_date_text(date, lang)}",
                        "intent": "calendar",
                    })
        elif category:
            conversation_state["pending_calendar_category"] = category
            return with_location({
                "answer": build_calendar_clarification_prompt(category, lang),
                "intent": "calendar",
                "response_mode": "calendar_term_clarify",
            })

    if pending_calendar_category:
        term = extract_term_from_text(user_text)
        if term:
            matched = next((t for t in calendar_data if term in t), None)
            session = extract_session_from_text(user_text)
            if matched:
                best_event = find_best_calendar_event(
                    calendar_data[matched],
                    pending_calendar_category,
                    session=session,
                )
                if best_event:
                    conversation_state["pending_calendar_category"] = None
                    event, date = best_event
                    return with_location({
                        "answer": f"{localize_calendar_event_text(event, lang)}: {localize_date_text(date, lang)}",
                        "intent": "calendar",
                        "response_mode": "calendar_term_follow_up",
                    })

    if is_degree_availability_question(user_text):
        subject_phrase = extract_degree_subject_phrase(user_text)
        subject_tokens = program_subject_tokens_from_query(subject_phrase or user_text)
        level = detect_degree_level(user_text)
        localized_level = localize_degree_level(level, lang)
        subject_label = (subject_phrase or "that subject").strip()
        matched_program = find_program_match(subject_phrase or user_text)
        exists = bool(matched_program) or degree_exists_in_records(subject_tokens, level)
        conversation_state["last_degree_subject"] = subject_label
        conversation_state["last_degree_level"] = level
        return with_location({
            "answer": await localized(
                build_degree_availability_answer(
                    exists,
                    matched_program["name"] if matched_program else subject_label,
                    localized_level,
                    lang,
                    matched_program,
                )
            ),
            "intent": "faq",
            "faq_topic": "programs",
            "response_mode": "degree_availability",
        })

    # program_match = find_program_match(user_text)
    # if program_match and (
    #     faq_topic == "programs"
    #     or any(token in normalize(user_text) for token in ("major", "program", "degree", "curriculum"))
    #     or len(tokenize(user_text)) <= 5
    # ):
    #     conversation_state["last_degree_subject"] = program_match["name"]
    #     return with_location({
    #         "answer": await localized(build_program_answer(program_match, lang)),
    #         "intent": "faq",
    #         "faq_topic": "programs",
    #         "response_mode": "program_catalog_direct",
    #     })

    if faq_topic == "programs" or is_program_interest_question(user_text):
        return with_location({
            "answer": await localized(build_program_discovery_reply(user_text, lang)),
            "intent": "faq",
            "faq_topic": "programs",
            "response_mode": "program_discovery",
        })

    retrieval_query = build_retrieval_query(user_text, lang, faq_topic)
    context_blocks = retrieve_rag_context(retrieval_query)
    if not context_blocks:
        fallback_query = build_retrieval_query(
            f"{user_text} {faq_topic.replace('_', ' ') if faq_topic else ''}".strip(),
            lang,
            faq_topic=faq_topic,
        )
        context_blocks = retrieve_fallback_context(fallback_query, faq_topic=faq_topic)

    if should_ask_for_clarification(user_text, context_blocks, faq_topic):
        return with_location({
            "answer": trn("faq_clarify_reply", lang),
            "intent": "faq" if faq_topic else "general",
            "faq_topic": faq_topic,
            "sources_used": len(context_blocks),
            "response_mode": "clarify_no_match",
        })

    if FAQ_FAST_PATH_ENABLED and faq_topic and context_blocks:
        fast_answer = build_fast_path_answer(user_text, context_blocks, lang, faq_topic=faq_topic)
        if fast_answer:
            return with_location({
                "answer": await localized(fast_answer),
                "intent": "faq",
                "faq_topic": faq_topic,
                "sources_used": len(context_blocks),
                "response_mode": "fast_path",
            })
        return with_location({
            "answer": await localized(build_program_discovery_reply(user_text, lang) if faq_topic == "programs" else trn("faq_no_exact_match", lang)),
            "intent": "faq",
            "faq_topic": faq_topic,
            "sources_used": len(context_blocks),
            "response_mode": "fast_path_no_match",
        })

    prompt = build_rag_prompt(user_text, context_blocks, faq_topic)

    try:
        reply = await query_ollama(prompt, lang)
    except (httpx.HTTPError, asyncio.TimeoutError):
        fast_answer = build_fast_path_answer(user_text, context_blocks, lang, max_lines=2, faq_topic=faq_topic)
        if fast_answer:
            return with_location({
                "answer": await localized(fast_answer),
                "intent": "faq" if faq_topic else "general",
                "faq_topic": faq_topic,
                "sources_used": len(context_blocks),
                "response_mode": "fast_path_timeout",
            })
        fallback_answer = build_program_discovery_reply(user_text, lang) if faq_topic == "programs" else build_fallback_answer(user_text, context_blocks, lang)
        return with_location({"answer": await localized(fallback_answer), "intent": "faq" if faq_topic else "general", "faq_topic": faq_topic, "sources_used": len(context_blocks)})
    except Exception:
        fast_answer = build_fast_path_answer(user_text, context_blocks, lang, max_lines=2, faq_topic=faq_topic)
        if fast_answer:
            return with_location({
                "answer": await localized(fast_answer),
                "intent": "faq" if faq_topic else "general",
                "faq_topic": faq_topic,
                "sources_used": len(context_blocks),
                "response_mode": "fast_path_timeout",
            })
        fallback_answer = build_program_discovery_reply(user_text, lang) if faq_topic == "programs" else build_fallback_answer(user_text, context_blocks, lang)
        return with_location({"answer": await localized(fallback_answer), "intent": "faq" if faq_topic else "general", "faq_topic": faq_topic, "sources_used": len(context_blocks)})

    return with_location({"answer": await localized(reply), "intent": "faq" if faq_topic else "general", "faq_topic": faq_topic, "sources_used": len(context_blocks)})
>>>>>>> Stashed changes
