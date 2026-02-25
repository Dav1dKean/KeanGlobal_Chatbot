from typing import Literal, Optional
import re
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- RAG IMPORTS ---
import chromadb
from chromadb.utils import embedding_functions
import ollama

# ==============================
# FASTAPI SETUP
# ==============================

app = FastAPI(title="KeanGlobal Backend", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# LOAD CALENDARS INTO MEMORY
# ==============================

DATA_FOLDER = Path("data")
calendar_data = {}


def normalize(text: str) -> str:
    return re.sub(r"[^\w\s]", "", text.lower()).strip()


def tokenize(text: str) -> set[str]:
    return set(normalize(text).split())


def is_term_header(line: str) -> bool:
    return bool(
        re.match(
            r"^(Fall|Spring|Winter|Summer)\s\d{4}\s(Semester|Term)$",
            line.strip()
        )
    )


def load_calendars():
    for file in DATA_FOLDER.glob("*.txt"):
        with open(file, "r", encoding="utf-8") as f:
            lines = f.readlines()

        current_term = None

        for raw_line in lines:
            line = raw_line.strip()

            if is_term_header(line):
                current_term = normalize(line)
                calendar_data[current_term] = {}

            elif line.startswith("-") and ":" in line and current_term:
                event, date = line[1:].split(":", 1)
                calendar_data[current_term][normalize(event)] = date.strip()


load_calendars()

# ==============================
# CHROMA + OLLAMA (POLICIES)
# ==============================

BASE_DIR = Path(__file__).resolve().parent.parent
CHROMA_PATH = BASE_DIR / "app" / "chroma_db"

client = chromadb.PersistentClient(path=str(CHROMA_PATH))

embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

policy_collection = client.get_collection(
    name="kean_knowledge",
    embedding_function=embedding_function
)

OLLAMA_MODEL = "llama3"

# ==============================
# REQUEST / RESPONSE MODELS
# ==============================

class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    answer: str
    intent: Literal["calendar", "policy"]
    destination_id: Optional[str] = None
    use_current_location: bool = False


# ==============================
# CALENDAR INTENT DETECTION
# ==============================

def detect_event_category(question: str) -> Optional[str]:
    q = normalize(question)

    if any(p in q for p in ["begin", "start", "first day", "opening"]):
        return "start"

    if any(p in q for p in ["end", "finish", "last day"]):
        return "end"

    if "recess" in q or "break" in q:
        return "recess"

    if "immunization" in q:
        return "immunization"

    if "registration" in q:
        return "registration"

    if "withdraw" in q:
        return "withdrawal"

    if "exam" in q:
        return "exam"

    return None


def is_calendar_question(text: str) -> bool:
    return bool(re.search(r"(fall|spring|winter|summer)\s\d{4}", normalize(text)))


# ==============================
# CHAT ENDPOINT
# ==============================

@app.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:

    user_text = payload.message.strip()

    # ==================================================
    # 1️⃣ CALENDAR LOGIC (STRICT + UNTOUCHED)
    # ==================================================
    if is_calendar_question(user_text):

        lowered = normalize(user_text)
        term_match = re.search(r"(fall|spring|winter|summer)\s(\d{4})", lowered)

        if not term_match:
            return ChatResponse(
                answer="Please specify a term and year (e.g., Fall 2026).",
                intent="calendar"
            )

        term_name = term_match.group(1)
        year = term_match.group(2)
        search_term = f"{term_name} {year}"

        matched_term = None
        for term in calendar_data:
            if search_term in term:
                matched_term = term
                break

        if not matched_term:
            return ChatResponse(
                answer="Term not found in academic calendar.",
                intent="calendar"
            )

        category = detect_event_category(user_text)

        if not category:
            return ChatResponse(
                answer="Event type not recognized.",
                intent="calendar"
            )

        best_match = None

        for event in calendar_data[matched_term]:
            words = tokenize(event)

            if category == "start" and ("begin" in words or "begins" in words):
                best_match = event
                break

            if category == "end" and ("end" in words or "ends" in words):
                best_match = event
                break

            if category == "recess" and "recess" in words:
                best_match = event
                break

            if category == "immunization" and "immunization" in words:
                best_match = event
                break

            if category == "registration" and "registration" in words:
                best_match = event
                break

            if category == "withdrawal" and "withdrawal" in words:
                best_match = event
                break

            if category == "exam" and "exam" in words:
                best_match = event
                break

        if best_match:
            date = calendar_data[matched_term][best_match]
            return ChatResponse(
                answer=f"{best_match.title()}: {date}",
                intent="calendar"
            )

        return ChatResponse(
            answer="Date not found in academic calendar.",
            intent="calendar"
        )

    # ==================================================
    # 2️⃣ POLICY RAG (OLLAMA + CHROMA)
    # ==================================================

    results = policy_collection.query(
        query_texts=[user_text],
        n_results=3
    )

    documents = results.get("documents", [[]])[0]

    if not documents:
        return ChatResponse(
            answer="I couldn't find relevant policy information.",
            intent="policy"
        )

    context = "\n\n".join(documents)

    prompt = f"""
You are a Kean University policy assistant.
Answer ONLY using the context below.
If the answer is not in the context, say you do not have enough information.

Context:
{context}

Question:
{user_text}
"""

    response = ollama.chat(
        model=OLLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}]
    )

    answer = response["message"]["content"]

    return ChatResponse(
        answer=answer,
        intent="policy"
    )