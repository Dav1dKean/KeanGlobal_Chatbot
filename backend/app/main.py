from typing import Optional
import os
import re
import csv
import json
import asyncio
from math import radians, sin, cos, asin, sqrt
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
import chromadb
from chromadb.utils import embedding_functions

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# CONFIG

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")
OLLAMA_HEALTH_URL = os.getenv("OLLAMA_HEALTH_URL", "http://127.0.0.1:11434/api/tags")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "mistral")
OLLAMA_CONNECT_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_CONNECT_TIMEOUT_SECONDS", "5"))
OLLAMA_READ_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_READ_TIMEOUT_SECONDS", "30"))
OLLAMA_TOTAL_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TOTAL_TIMEOUT_SECONDS", "35"))
OLLAMA_HEALTH_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_HEALTH_TIMEOUT_SECONDS", "5"))
OLLAMA_MAX_RETRIES = int(os.getenv("OLLAMA_MAX_RETRIES", "1"))
OLLAMA_NUM_PREDICT = int(os.getenv("OLLAMA_NUM_PREDICT", "160"))
OLLAMA_TEMPERATURE = float(os.getenv("OLLAMA_TEMPERATURE", "0.2"))
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "2048"))
RAG_MAX_RESULTS = int(os.getenv("RAG_MAX_RESULTS", "2"))
RAG_FALLBACK_MAX_RESULTS = int(os.getenv("RAG_FALLBACK_MAX_RESULTS", "3"))
RAG_MAX_CHARS_PER_BLOCK = int(os.getenv("RAG_MAX_CHARS_PER_BLOCK", "650"))
RAG_MAX_PROMPT_CONTEXT_CHARS = int(os.getenv("RAG_MAX_PROMPT_CONTEXT_CHARS", "2200"))
FAQ_FAST_PATH_ENABLED = os.getenv("FAQ_FAST_PATH_ENABLED", "1").strip().lower() in {"1", "true", "yes", "on"}
FAQ_FAST_PATH_MAX_LINES = int(os.getenv("FAQ_FAST_PATH_MAX_LINES", "3"))
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8000,http://localhost:8000",
)

# APP SETUP

app = FastAPI(title="KeanGlobal Backend", version="5.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# LOAD CALENDARS

DATA_FOLDER = Path("data")
calendar_data = {}

def normalize(text: str) -> str:
    return re.sub(r"[^\w\s]", "", text.lower()).strip()

def tokenize(text: str) -> set[str]:
    return set(normalize(text).split())

def keyword_in_text(normalized_text: str, text_tokens: set[str], keyword: str) -> bool:
    normalized_keyword = normalize(keyword)
    if not normalized_keyword:
        return False

    # Keep CJK/Arabic-script keywords as substring checks because tokenization is limited.
    if re.search(r"[\u4e00-\u9fff\u0600-\u06ff\uac00-\ud7af]", normalized_keyword):
        return normalized_keyword in normalized_text

    # Multi-word keyword: phrase match.
    if " " in normalized_keyword:
        return normalized_keyword in normalized_text

    # Single-word keyword: token match avoids false positives like "eat" in "repeat".
    return normalized_keyword in text_tokens

def is_term_header(line: str) -> bool:
    return bool(re.match(r"^(Fall|Spring|Winter|Summer)\s\d{4}\s(Semester|Term)$", line.strip()))

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

# CHROMA RAG

BASE_DIR = Path(__file__).resolve().parent.parent
CHROMA_PATH = BASE_DIR / "app" / "chroma_db"
LOCATION_CSV_PATH = BASE_DIR.parent / "src" / "data" / "campus_locations_main_east_full.csv"
POLICY_FOLDER = BASE_DIR / "Policies"
RAG_DATA_FOLDER = BASE_DIR / "data"
FAQ_INTENT_PATH = RAG_DATA_FOLDER / "faq_intent_keywords.json"
EXCLUDED_RAG_DIR_NAMES = {"venv", ".venv", "chroma_db", "__pycache__"}
EXCLUDED_RAG_FILE_NAMES = {"requirements.txt", "_RAG_TEMPLATE.txt", "faq_intent_keywords.json", "program_info_rag.txt"}

client = chromadb.PersistentClient(path=str(CHROMA_PATH))
embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

policy_collection = client.get_or_create_collection(
    name="kean_knowledge",
    embedding_function=embedding_function
)

# MODELS

class ChatRequest(BaseModel):
    message: str

# CALENDAR LOGIC

SEASON_ALIASES = {
    "fall": ("fall", "autumn", "guz", "güz", "sonbahar", "otono", "otoño", "秋", "秋季", "خزاں", "가을"),
    "spring": ("spring", "bahar", "ilkbahar", "primavera", "春", "春季", "بہار", "봄"),
    "summer": ("summer", "yaz", "verano", "夏", "夏季", "گرما", "여름"),
    "winter": ("winter", "kis", "kış", "invierno", "冬", "冬季", "سردی", "겨울"),
}

def detect_event_category(question: str) -> Optional[str]:
    q = normalize(question)
    if any(p in q for p in ["registration", "register", "kayıt", "inscripcion", "inscripción", "注册", "اندراج", "등록"]):
        return "registration"
    if any(p in q for p in ["immunization", "aşı", "vacuna", "疫苗", "ویکسین", "예방접종"]):
        return "immunization"
    if any(p in q for p in ["withdraw", "withdrawal", "çekil", "retiro", "退课", "واپسی", "수강철회"]):
        return "withdrawal"
    if any(p in q for p in ["exam", "final", "vize", "finaller", "examen", "考试", "امتحان", "시험"]):
        return "exam"
    if any(p in q for p in ["recess", "break", "tatil", "receso", "假期", "تعطیل", "방학"]):
        return "recess"
    if any(p in q for p in ["end", "finish", "bit", "termina", "结束", "ختم", "끝"]):
        return "end"
    if any(p in q for p in ["begin", "start", "first day", "opening", "başla", "empieza", "开始", "شروع", "시작"]):
        return "start"
    return None

def event_matches_category(event_name: str, category: str) -> bool:
    event_text = normalize(event_name)
    if category == "start":
        return any(token in event_text for token in ("term begins", "semester begins", "classes begin", "class begins", "instruction begins", "begins"))
    if category == "end":
        return any(token in event_text for token in ("term ends", "semester ends", "classes end", "class ends", "ends"))
    if category == "recess":
        return any(token in event_text for token in ("recess", "break"))
    if category == "immunization":
        return "immunization" in event_text
    if category == "registration":
        return "registration" in event_text
    if category == "withdrawal":
        return "withdraw" in event_text
    if category == "exam":
        return any(token in event_text for token in ("exam", "final"))
    return False

def extract_term_from_text(text: str) -> Optional[str]:
    q = normalize(text)
    year_match = re.search(r"(20\d{2})", q)
    if not year_match:
        return None
    year = year_match.group(1)

    for season_en, aliases in SEASON_ALIASES.items():
        if any(alias in q for alias in aliases):
            return f"{season_en} {year}"
    return None

def find_best_calendar_event(events: dict[str, str], category: str) -> Optional[tuple[str, str]]:
    best_event = None
    best_date = None
    best_score = -10**9

    for event, date in events.items():
        if not event_matches_category(event, category):
            continue
        e = normalize(event)
        score = 0

        if category == "start":
            if "term begins" in e or "semester begins" in e:
                score += 120
            if "classes begin" in e or "class begins" in e or "instruction begins" in e:
                score += 90
            if "registration" in e:
                score -= 120
            if "immunization" in e or "deadline" in e or "withdraw" in e:
                score -= 90
            if "begins" in e:
                score += 20
        elif category == "end":
            if "term ends" in e or "semester ends" in e:
                score += 120
            if "classes end" in e or "class ends" in e:
                score += 90
            if "final deadline" in e or "registration" in e:
                score -= 80
            if "ends" in e:
                score += 20
        elif category == "registration":
            if "registration begins" in e:
                score += 120
            elif "registration" in e:
                score += 80
        elif category == "exam":
            if "exam week" in e or "final exam" in e:
                score += 120
            elif "final" in e or "exam" in e:
                score += 70
        else:
            score += 50

        if score > best_score:
            best_score = score
            best_event = event
            best_date = date

    if best_event is None:
        return None
    return best_event, best_date

def is_calendar_question(text: str) -> bool:
    q = normalize(text)
    has_year = bool(re.search(r"(20\d{2})", q))
    has_season = any(alias in q for aliases in SEASON_ALIASES.values() for alias in aliases)
    return has_year and has_season

# TIME / LOCATION

NYC_TIMEZONE = ZoneInfo("America/New_York")
LOCATION_KEYWORDS = (
    "where is",
    "where's",
    "wheres",
    "directions",
    "direction",
    "how do i get",
    "how to get",
    "route",
    "navigate",
    "map",
    "locate",
    "find",
    "way to",
    "get to",
    "nerede",
    "nerde",
    "nasıl giderim",
    "nasil giderim",
    "cómo llegar",
    "como llegar",
    "dónde está",
    "donde esta",
    "donde esta el",
    "donde queda",
    "donde puedo",
    "donde consigo",
    "where can i",
    "where do i",
    "在哪里",
    "怎么去",
    "کہاں",
    "راستہ",
    "어디",
    "어떻게 가",
    "cafe",
    "coffee",
    "starbucks",
    "cafeteria",
)
DIRECTION_KEYWORDS = (
    "directions",
    "direction",
    "how do i get",
    "how to get",
    "route",
    "navigate",
    "way to",
    "get to",
    "nasıl giderim",
    "nasil giderim",
    "cómo llegar",
    "como llegar",
    "怎么去",
    "راستہ",
    "어떻게 가",
)

LOCATION_ONLY_KEYWORDS = (
    "where is",
    "where's",
    "wheres",
    "nerede",
    "nerde",
    "dónde está",
    "donde esta",
    "donde esta el",
    "donde queda",
    "在哪里",
    "在哪",
    "어디",
    "کہاں",
)
ENTRANCE_REQUEST_KEYWORDS = (
    "entrance",
    "front entrance",
    "rear entrance",
    "side entrance",
    "main entrance",
    "gate",
    "entrada",
    "giris",
    "giriş",
    "入口",
    "입구",
    "دروازہ",
)

CLOSEST_PARKING_KEYWORDS = (
    "closest parking",
    "nearest parking",
    "closest parking lot",
    "nearest parking lot",
    "parking near",
    "parking lot near",
    "parking lot to",
    "closest lot",
    "nearest lot",
    "estacionamiento mas cercano",
    "aparcamiento mas cercano",
    "parking mas cercano",
    "parqueo mas cercano",
    "parqueo cercano",
    "parqueo mas proximo",
    "parqueadero mas proximo",
    "parqueadero mas cercano",
    "parqueo cerca de",
    "en yakin otopark",
    "最 近 停车",
    "最近停车",
    "가장 가까운 주차",
    "قریب ترین پارکنگ",
)

FOOD_INTENT_KEYWORDS = (
    "food",
    "eat",
    "meal",
    "hungry",
    "snack",
    "cafeteria",
    "restaurant",
    "comida",
    "comer",
    "almuerzo",
    "desayuno",
    "cena",
    "cafeteria",
    "restaurante",
    "yemek",
    "yiyecek",
    "kafeterya",
    "kantin",
    "吃",
    "吃饭",
    "食物",
    "餐厅",
    "食堂",
    "음식",
    "식당",
    "밥",
    "کھانا",
    "خوراک",
)

FOOD_DESTINATION_HINTS = (
    ("starbucks_at_library", ("coffee", "cafe", "café", "starbucks", "cafeteria", "café", "cafe", "café", "café", "comprar cafe", "comprar café", "cafe", "kahve", "咖啡", "커피")),
    ("smash_burgar_at_miron", ("burger", "smash", "hamburger", "sandwich", "hamburguesa", "hamburger", "burger", "برگر")),
    ("Cougar Pantry", ("pantry", "food pantry", "despensa", "banco de comida", "erzak", "gida bankasi", "食物银行", "푸드팬트리", "فوڈ پینٹری")),
    ("cougars_den", ("cougars den", "cougar den", "dining", "eat", "food", "comida", "comer", "yemek", "吃饭", "食堂", "식당", "کھانا")),
)
LOCATION_ALIAS_OVERRIDES = {
    "miron_center": (
        "student center",
        "miron",
        "msc",
        "miron student center",
        "campus center"
    ),
    "library": (
        "library",
        "nancy thompson library",
        "thompson library"
    ),
    "starbucks_at_library": (
        "starbucks",
        "coffee",
        "cafe",
        "cafeteria",
        "coffee shop",
        "buy coffee",
        "comprar cafe",
        "comprar café",
        "donde comprar cafe",
        "donde comprar café",
    ),
    "barnes_nobles_glab": (
        "bookstore",
        "barnes and noble",
        "barnes noble",
        "campus bookstore"
    ),
    "campus_police": (
        "campus police",
        "public safety",
        "police",
        "safety office",
        "security office"
    ),
    "administration": (
        "administration",
        "administration building",
        "financial aid",
        "registrar",
        "student accounts",
        "admissions office"
    ),
    "cas": (
        "cas",
        "center for academic success",
        "academic success center",
        "tutoring center"
    ),
    "glab": (
        "glab",
        "green lane academic building",
        "green lane building"
    ),
    "hri": (
        "hri",
        "human rights institute"
    ),
    "technology_center": (
        "technology center",
        "tech center",
        "tec"
    ),
    "naab": (
        "naab",
        "north avenue academic building",
        "north avenue building"
    ),
    "stem": (
        "stem",
        "stem building",
        "science technology engineering mathematics building",
        "nj stem center"
    ),
    "harwood_arena": (
        "harwood",
        "harwood arena",
        "arena"
    ),
    "wilkins_theatre": (
        "wilkins",
        "wilkins theatre",
        "theater",
        "theatre"
    ),
    "lhac": (
        "lhac",
        "liberty hall academic center"
    ),
    "nathan_weiss_building": (
        "nathan weiss",
        "east campus building",
        "ecb"
    ),
    "union_train_station": (
        "train station",
        "rail station",
        "union train station",
        "nj transit station",
        "transit station",
        "station"
    ),
    "hutchinson_hall Main": (
        "hutchinson",
        "hutchinson hall",
    ),
}
GENERIC_LOCATION_WORDS = {
    "hall",
    "building",
    "center",
    "main",
    "entrance",
    "campus",
    "lot",
    "parking",
    "station",
}
DEFAULT_FAQ_INTENT_KEYWORDS = {
    "admissions": ("admission", "apply", "application", "accepted", "enroll"),
    "tuition_fees": ("tuition", "cost", "fees", "payment", "bill", "bursar"),
    "financial_aid": ("financial aid", "fafsa", "scholarship", "grant", "loan"),
    "registration": ("register", "registration", "add/drop", "drop", "schedule"),
    "calendar_deadline": ("deadline", "due date", "when is", "date", "semester starts", "semester ends"),
    "housing": ("housing", "dorm", "residence hall", "roommate", "move in"),
    "parking_transport": ("parking", "permit", "lot", "shuttle", "bus", "train"),
    "library": ("library", "books", "study room", "citation"),
    "it_support": ("wifi", "email", "password", "it", "tech support", "portal"),
    "programs": ("major", "minor", "program", "degree", "curriculum"),
    "policies": ("policy", "policies", "rule", "conduct", "procedure"),
}
FAQ_INTENT_KEYWORDS = {}

campus_locations = []
campus_location_by_id = {}
fallback_rag_docs = []

SUPPORTED_LANGS = {"en", "tr", "es", "zh", "ur", "ko"}
LANGUAGE_NAMES = {
    "en": "English",
    "tr": "Turkish",
    "es": "Spanish",
    "zh": "Mandarin Chinese",
    "ur": "Urdu",
    "ko": "Korean",
}
TRANSLATIONS = {
    "location_opening_specific": {
        "en": "{name} is on {campus}. Opening map.",
        "tr": "{name}, {campus} kampüsünde. Harita açılıyor.",
        "es": "{name} está en {campus}. Abriendo mapa.",
        "zh": "{name} 位于 {campus}。正在打开地图。",
        "ur": "{name} {campus} میں ہے۔ نقشہ کھولا جا رہا ہے۔",
        "ko": "{name}은(는) {campus}에 있습니다. 지도를 여는 중입니다.",
    },
    "location_opening_generic": {
        "en": "Opening campus map. Please pick a destination or search the directory.",
        "tr": "Kampüs haritası açılıyor. Lütfen bir hedef seç veya dizinde ara.",
        "es": "Abriendo el mapa del campus. Elige un destino o busca en el directorio.",
        "zh": "正在打开校园地图。请选择目的地或在目录中搜索。",
        "ur": "کیمپس کا نقشہ کھولا جا رہا ہے۔ براہِ کرم منزل منتخب کریں یا ڈائریکٹری میں تلاش کریں۔",
        "ko": "캠퍼스 지도를 여는 중입니다. 목적지를 선택하거나 디렉터리에서 검색하세요.",
    },
    "closest_parking_found": {
        "en": "The closest parking lot to {target} is {lot}. Opening map.",
        "tr": "{target} için en yakın otopark {lot}. Harita açılıyor.",
        "es": "El estacionamiento más cercano a {target} es {lot}. Abriendo mapa.",
        "zh": "离 {target} 最近的停车场是 {lot}。正在打开地图。",
        "ur": "{target} کے قریب ترین پارکنگ لاٹ {lot} ہے۔ نقشہ کھولا جا رہا ہے۔",
        "ko": "{target}에 가장 가까운 주차장은 {lot}입니다. 지도를 여는 중입니다.",
    },
    "closest_parking_unknown_target": {
        "en": "Please include a campus building name so I can find the closest parking lot.",
        "tr": "En yakın otoparkı bulmam için lütfen kampüsteki bina adını yaz.",
        "es": "Incluye el nombre de un edificio del campus para encontrar el estacionamiento más cercano.",
        "zh": "请提供校园建筑名称，我才能找到最近的停车场。",
        "ur": "قریب ترین پارکنگ تلاش کرنے کے لیے براہِ کرم کیمپس عمارت کا نام دیں۔",
        "ko": "가장 가까운 주차장을 찾으려면 캠퍼스 건물 이름을 입력해 주세요.",
    },
    "closest_parking_not_found": {
        "en": "I found {target}, but I could not find a nearby parking lot in the current map data.",
        "tr": "{target} bulundu, ancak mevcut harita verisinde yakın bir otopark bulunamadı.",
        "es": "Encontré {target}, pero no pude encontrar un estacionamiento cercano en los datos del mapa.",
        "zh": "我找到了 {target}，但在当前地图数据中未找到附近停车场。",
        "ur": "میں نے {target} تلاش کر لیا، مگر موجودہ نقشہ ڈیٹا میں قریب پارکنگ نہیں ملی۔",
        "ko": "{target}은(는) 찾았지만 현재 지도 데이터에서 가까운 주차장을 찾지 못했습니다.",
    },
    "food_suggestions_intro": {
        "en": "Here are food options on campus:",
        "tr": "Kampüsteki yemek seçenekleri:",
        "es": "Estas son opciones de comida en el campus:",
        "zh": "以下是校园内的餐饮选项：",
        "ur": "کیمپس میں کھانے کے یہ آپشنز ہیں:",
        "ko": "캠퍼스 내 식사 옵션입니다:",
    },
    "fallback_no_context": {
        "en": "I couldn't reach Ollama and I don't have matching campus context yet.",
        "tr": "Ollama'ya ulaşamadım ve eşleşen kampüs bağlamı henüz yok.",
        "es": "No pude conectar con Ollama y todavía no tengo contexto del campus que coincida.",
        "zh": "我无法连接到 Ollama，且目前没有匹配的校园上下文。",
        "ur": "میں Ollama تک نہیں پہنچ سکا اور ابھی متعلقہ کیمپس معلومات دستیاب نہیں ہیں۔",
        "ko": "Ollama에 연결할 수 없고, 일치하는 캠퍼스 컨텍스트도 아직 없습니다.",
    },
    "fallback_best_match": {
        "en": "Ollama is unavailable right now. Best match from campus records: {line}",
        "tr": "Ollama şu anda kullanılamıyor. Kampüs kayıtlarından en iyi eşleşme: {line}",
        "es": "Ollama no está disponible ahora. Mejor coincidencia en registros del campus: {line}",
        "zh": "Ollama 当前不可用。校园记录中的最佳匹配：{line}",
        "ur": "فی الحال Ollama دستیاب نہیں۔ کیمپس ریکارڈ سے بہترین مطابقت: {line}",
        "ko": "현재 Ollama를 사용할 수 없습니다. 캠퍼스 기록에서 가장 일치하는 내용: {line}",
    },
    "fallback_top_context": {
        "en": "Ollama is unavailable right now. Top context match: {line}",
        "tr": "Ollama şu anda kullanılamıyor. En iyi bağlam eşleşmesi: {line}",
        "es": "Ollama no está disponible ahora. Mejor contexto encontrado: {line}",
        "zh": "Ollama 当前不可用。最佳上下文匹配：{line}",
        "ur": "فی الحال Ollama دستیاب نہیں۔ بہترین سیاقی مطابقت: {line}",
        "ko": "현재 Ollama를 사용할 수 없습니다. 가장 높은 컨텍스트 일치: {line}",
    },
    "fast_path_prefix": {
        "en": "From campus records, here are the most relevant details:",
        "tr": "Kampüs kayıtlarına göre en ilgili bilgiler:",
        "es": "Según los registros del campus, estos son los detalles más relevantes:",
        "zh": "根据校园记录，以下是最相关的信息：",
        "ur": "کیمپس ریکارڈ کے مطابق، یہ سب سے متعلقہ معلومات ہیں:",
        "ko": "캠퍼스 기록 기준으로 가장 관련 있는 정보입니다:",
    },
}

DATE_TRANSLATIONS = {
    "tr": {
        "Monday": "Pazartesi", "Tuesday": "Salı", "Wednesday": "Çarşamba", "Thursday": "Perşembe",
        "Friday": "Cuma", "Saturday": "Cumartesi", "Sunday": "Pazar",
        "January": "Ocak", "February": "Şubat", "March": "Mart", "April": "Nisan",
        "May": "Mayıs", "June": "Haziran", "July": "Temmuz", "August": "Ağustos",
        "September": "Eylül", "October": "Ekim", "November": "Kasım", "December": "Aralık",
    },
    "es": {
        "Monday": "lunes", "Tuesday": "martes", "Wednesday": "miércoles", "Thursday": "jueves",
        "Friday": "viernes", "Saturday": "sábado", "Sunday": "domingo",
        "January": "enero", "February": "febrero", "March": "marzo", "April": "abril",
        "May": "mayo", "June": "junio", "July": "julio", "August": "agosto",
        "September": "septiembre", "October": "octubre", "November": "noviembre", "December": "diciembre",
    },
    "zh": {
        "Monday": "星期一", "Tuesday": "星期二", "Wednesday": "星期三", "Thursday": "星期四",
        "Friday": "星期五", "Saturday": "星期六", "Sunday": "星期日",
        "January": "1月", "February": "2月", "March": "3月", "April": "4月",
        "May": "5月", "June": "6月", "July": "7月", "August": "8月",
        "September": "9月", "October": "10月", "November": "11月", "December": "12月",
    },
    "ur": {
        "Monday": "پیر", "Tuesday": "منگل", "Wednesday": "بدھ", "Thursday": "جمعرات",
        "Friday": "جمعہ", "Saturday": "ہفتہ", "Sunday": "اتوار",
        "January": "جنوری", "February": "فروری", "March": "مارچ", "April": "اپریل",
        "May": "مئی", "June": "جون", "July": "جولائی", "August": "اگست",
        "September": "ستمبر", "October": "اکتوبر", "November": "نومبر", "December": "دسمبر",
    },
    "ko": {
        "Monday": "월요일", "Tuesday": "화요일", "Wednesday": "수요일", "Thursday": "목요일",
        "Friday": "금요일", "Saturday": "토요일", "Sunday": "일요일",
        "January": "1월", "February": "2월", "March": "3월", "April": "4월",
        "May": "5월", "June": "6월", "July": "7월", "August": "8월",
        "September": "9월", "October": "10월", "November": "11월", "December": "12월",
    },
}

def detect_language(text: str) -> str:
    t = text.strip().lower()
    if re.search(r"[\u4e00-\u9fff]", t):
        return "zh"
    if re.search(r"[\uac00-\ud7af]", t):
        return "ko"
    if re.search(r"[\u0600-\u06ff]", t):
        return "ur"
    tr_chars = set("çğıöşü")
    if any(ch in tr_chars for ch in t) or any(x in t for x in (" nasıl ", " nerede", " ne zaman", "güz", "bahar")):
        return "tr"
    if any(x in t for x in ("¿", "¡", " dónde", " cuándo", " qué", "becas", "semestre")):
        return "es"
    return "en"

def trn(key: str, lang: str, **kwargs) -> str:
    lang = lang if lang in SUPPORTED_LANGS else "en"
    template = TRANSLATIONS.get(key, {}).get(lang) or TRANSLATIONS.get(key, {}).get("en", "")
    return template.format(**kwargs)

def localize_date_text(text: str, lang: str) -> str:
    mapping = DATE_TRANSLATIONS.get(lang)
    if not mapping:
        return text
    for en_word, local_word in mapping.items():
        text = re.sub(rf"\b{re.escape(en_word)}\b", local_word, text)
    return text

def parse_position(value: str) -> Optional[tuple[float, float]]:
    raw = str(value or "").strip()
    if not raw:
        return None
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) != 2:
        return None
    try:
        lat = float(parts[0])
        lon = float(parts[1])
    except ValueError:
        return None
    return lat, lon

def haversine_meters(point_a: tuple[float, float], point_b: tuple[float, float]) -> float:
    lat1, lon1 = point_a
    lat2, lon2 = point_b
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return 2 * 6371000 * asin(sqrt(a))

def load_campus_locations():
    rows = []
    if not LOCATION_CSV_PATH.exists():
        return rows

    with open(LOCATION_CSV_PATH, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row_id = (row.get("id") or "").strip()
            name = (row.get("name") or "").strip()
            if not row_id or not name:
                continue
            row_type = (row.get("type") or "").strip().lower() or "location"
            rows.append(
                {
                    "id": row_id,
                    "name": name,
                    "campus": (row.get("campus") or "").strip() or "Main",
                    "type": row_type,
                    "parent": (row.get("parent") or "").strip(),
                    "position": parse_position(row.get("") or ""),
                }
            )
    return rows

def load_fallback_rag_docs():
    docs = []
    for file in BASE_DIR.rglob("*"):
        if not file.is_file():
            continue
        if any(part in EXCLUDED_RAG_DIR_NAMES for part in file.parts):
            continue
        if file.name in EXCLUDED_RAG_FILE_NAMES:
            continue
        if file.suffix.lower() not in {".txt", ".json"}:
            continue
        try:
            text = file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = file.read_text(encoding="latin-1")
        except Exception:
            continue

        if not text.strip():
            continue

        path_lower = file.relative_to(BASE_DIR).as_posix().lower()
        if "policies/" in path_lower or "policy" in file.name.lower():
            doc_type = "policy"
        elif "calendar" in file.name.lower():
            doc_type = "calendar"
        elif "program" in file.name.lower():
            doc_type = "program"
        else:
            doc_type = "knowledge"

        if file.suffix.lower() == ".json":
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                data = None

            extracted_lines = []

            def walk(node):
                if isinstance(node, dict):
                    title = node.get("name") or node.get("title") or node.get("program_name")
                    description = node.get("description")
                    if title or description:
                        extracted_lines.append(f"Title: {title or 'Unknown'}")
                        if description:
                            extracted_lines.append(f"Description: {description}")
                        extracted_lines.append("")
                    for value in node.values():
                        walk(value)
                elif isinstance(node, list):
                    for item in node:
                        walk(item)
                elif isinstance(node, (str, int, float, bool)):
                    extracted_lines.append(str(node))

            if data is not None:
                walk(data)
                flat_text = "\n".join(extracted_lines).strip()
                if flat_text:
                    text = flat_text

        chunks = []
        step = 1200
        for i in range(0, len(text), step):
            chunk = text[i : i + step].strip()
            if chunk:
                chunks.append(chunk)

        for idx, chunk in enumerate(chunks):
            docs.append(
                {
                    "source": file.relative_to(BASE_DIR).as_posix(),
                    "type": doc_type,
                    "chunk_id": f"{file.stem}_{idx}",
                    "text": chunk,
                    "tokens": tokenize(chunk),
                }
            )
    return docs

def load_faq_intent_keywords():
    if FAQ_INTENT_PATH.exists():
        try:
            with open(FAQ_INTENT_PATH, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, dict):
                cleaned = {}
                for topic, keywords in raw.items():
                    if not isinstance(topic, str) or not isinstance(keywords, list):
                        continue
                    cleaned_list = [str(k).strip().lower() for k in keywords if str(k).strip()]
                    if cleaned_list:
                        cleaned[topic.strip()] = tuple(cleaned_list)
                if cleaned:
                    return cleaned
        except Exception:
            pass
    return DEFAULT_FAQ_INTENT_KEYWORDS

def build_location_aliases(place: dict) -> list[str]:
    aliases = {
        place["id"],
        place["id"].replace("_", " "),
        place["name"],
    }

    acronym_match = re.findall(r"\(([A-Za-z0-9&/ ]+)\)", place["name"])
    for value in acronym_match:
        aliases.add(value)

    for extra_alias in LOCATION_ALIAS_OVERRIDES.get(place["id"], ()):
        aliases.add(extra_alias)

    return [normalize(alias) for alias in aliases if normalize(alias)]

def is_location_question(text: str) -> bool:
    q = normalize(text)
    q_tokens = tokenize(text)
    return any(keyword_in_text(q, q_tokens, keyword) for keyword in LOCATION_KEYWORDS)

def should_use_current_location(text: str) -> bool:
    q = normalize(text)
    q_tokens = tokenize(text)
    if any(keyword_in_text(q, q_tokens, keyword) for keyword in LOCATION_ONLY_KEYWORDS):
        return False
    return any(keyword_in_text(q, q_tokens, keyword) for keyword in DIRECTION_KEYWORDS)

def is_closest_parking_question(text: str) -> bool:
    q = normalize(text)
    q_tokens = tokenize(text)
    return any(keyword_in_text(q, q_tokens, keyword) for keyword in CLOSEST_PARKING_KEYWORDS)

def is_food_question(text: str) -> bool:
    q = normalize(text)
    q_tokens = tokenize(text)
    return any(keyword_in_text(q, q_tokens, keyword) for keyword in FOOD_INTENT_KEYWORDS)

def find_food_destination_id(text: str) -> Optional[str]:
    q = normalize(text)
    q_tokens = tokenize(text)
    for location_id, keywords in FOOD_DESTINATION_HINTS:
        if location_id not in campus_location_by_id:
            continue
        if any(keyword_in_text(q, q_tokens, keyword) for keyword in keywords):
            return location_id

    if "cougars_den" in campus_location_by_id:
        return "cougars_den"
    return None

def find_food_suggestions(text: str, max_results: int = 3) -> list[dict]:
    q = normalize(text)
    q_tokens = tokenize(text)
    scored: list[tuple[int, dict]] = []

    for location_id, keywords in FOOD_DESTINATION_HINTS:
        place = campus_location_by_id.get(location_id)
        if not place:
            continue
        score = 0
        for keyword in keywords:
            normalized_keyword = normalize(keyword)
            if normalized_keyword and keyword_in_text(q, q_tokens, keyword):
                score += max(1, len(normalized_keyword))
        if score > 0:
            scored.append((score, place))

    if not scored:
        fallback_ids = ["cougars_den", "starbucks_at_library", "smash_burgar_at_miron", "Cougar Pantry"]
        seen = set()
        results = []
        for location_id in fallback_ids:
            place = campus_location_by_id.get(location_id)
            if place and location_id not in seen:
                results.append(place)
                seen.add(location_id)
            if len(results) >= max_results:
                break
        return results

    scored.sort(key=lambda item: item[0], reverse=True)
    suggestions = []
    seen_ids = set()
    for _, place in scored:
        if place["id"] in seen_ids:
            continue
        suggestions.append(place)
        seen_ids.add(place["id"])
        if len(suggestions) >= max_results:
            break

    for fallback_id in ("cougars_den", "starbucks_at_library", "smash_burgar_at_miron", "Cougar Pantry"):
        if len(suggestions) >= max_results:
            break
        if fallback_id in seen_ids:
            continue
        fallback_place = campus_location_by_id.get(fallback_id)
        if fallback_place:
            suggestions.append(fallback_place)
            seen_ids.add(fallback_id)

    return suggestions

def should_keep_entrance_destination(text: str) -> bool:
    q = normalize(text)
    q_tokens = tokenize(text)
    return any(keyword_in_text(q, q_tokens, keyword) for keyword in ENTRANCE_REQUEST_KEYWORDS)

def should_route_destination_without_location_keyword(text: str) -> bool:
    q = normalize(text)
    q_tokens = tokenize(text)
    if not q:
        return False

    # Allow direct lookup style messages ("naab", "miron center", etc.)
    if len(q_tokens) <= 4 and not any(
        keyword_in_text(q, q_tokens, keyword)
        for keyword in ("major", "program", "degree", "repeat", "class", "policy", "tuition", "how many")
    ):
        return True

    return False

def find_location_destination_id(text: str, allowed_types: Optional[set[str]] = None) -> Optional[str]:
    q = normalize(text)
    padded_query = f" {q} "
    query_tokens = set(q.split())
    best_place = None
    best_score = 0

    for place in campus_locations:
        if allowed_types and place.get("type") not in allowed_types:
            continue
        aliases = build_location_aliases(place)
        score = 0

        for alias in aliases:
            if not alias:
                continue
            padded_alias = f" {alias} "
            alias_tokens = set(alias.split())
            informative_alias_tokens = {t for t in alias_tokens if len(t) >= 3 and t not in GENERIC_LOCATION_WORDS}
            overlap = len(informative_alias_tokens & query_tokens)

            if q == alias:
                score = max(score, 100 + len(alias))
            elif padded_alias in padded_query and len(alias) >= 3:
                score = max(score, 85 + len(alias))
            elif alias in q and len(alias) >= 5:
                score = max(score, 70 + len(alias))
            elif overlap > 0:
                score = max(score, 48 + overlap * 20 + len(alias))

        if place["type"] == "building":
            score += 10
        elif place["type"] == "entrance":
            score += 2

        if score > best_score:
            best_place = place
            best_score = score

    if best_place and best_score >= 75:
        return best_place["id"]
    return None

def get_effective_reference_location(location_id: str) -> Optional[dict]:
    place = campus_location_by_id.get(location_id)
    if not place:
        return None
    if place.get("type") == "entrance":
        parent_id = place.get("parent")
        if parent_id and parent_id in campus_location_by_id:
            return campus_location_by_id[parent_id]
    return place

def normalize_location_destination_for_response(destination_id: str, user_text: str) -> str:
    destination = campus_location_by_id.get(destination_id)
    if not destination:
        return destination_id
    if destination.get("type") != "entrance":
        return destination_id
    if should_keep_entrance_destination(user_text):
        return destination_id

    parent_id = destination.get("parent")
    if parent_id and parent_id in campus_location_by_id:
        return parent_id
    return destination_id

def find_closest_parking_lot(reference_location_id: str) -> Optional[dict]:
    reference = get_effective_reference_location(reference_location_id)
    if not reference:
        return None
    reference_position = reference.get("position")
    if not reference_position:
        return None

    best_lot = None
    best_distance = float("inf")
    for place in campus_locations:
        if place.get("type") != "parking":
            continue
        lot_position = place.get("position")
        if not lot_position:
            continue
        distance = haversine_meters(reference_position, lot_position)
        if distance < best_distance:
            best_distance = distance
            best_lot = place

    return best_lot

def detect_faq_intent(text: str) -> Optional[str]:
    q = normalize(text)
    best_topic = None
    best_score = 0

    for topic, keywords in FAQ_INTENT_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            normalized_keyword = normalize(keyword)
            if not normalized_keyword:
                continue
            if normalized_keyword in q:
                score += len(normalized_keyword)
        if score > best_score:
            best_score = score
            best_topic = topic

    return best_topic if best_score > 0 else None

def get_time_response(prompt: str):
    if "time" not in prompt.lower():
        return None
    now = datetime.now(NYC_TIMEZONE)
    return f"The current time in New York is {now.strftime('%I:%M %p')}."

campus_locations = load_campus_locations()
campus_location_by_id = {place["id"]: place for place in campus_locations}
fallback_rag_docs = load_fallback_rag_docs()
FAQ_INTENT_KEYWORDS = load_faq_intent_keywords()

# OLLAMA

def build_ollama_timeout():
    return httpx.Timeout(
        connect=OLLAMA_CONNECT_TIMEOUT_SECONDS,
        read=OLLAMA_READ_TIMEOUT_SECONDS,
        write=OLLAMA_CONNECT_TIMEOUT_SECONDS,
        pool=OLLAMA_CONNECT_TIMEOUT_SECONDS,
    )

async def query_ollama(prompt: str, lang: str):
    lang_name = LANGUAGE_NAMES.get(lang, "English")
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are KeanGlobal assistant. "
                    f"Respond only in {lang_name}. "
                    "Be concise, factual, and do not invent policy/calendar facts. "
                    "Keep the response short (max 6 sentences)."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "options": {
            "num_predict": OLLAMA_NUM_PREDICT,
            "temperature": OLLAMA_TEMPERATURE,
            "num_ctx": OLLAMA_NUM_CTX,
        },
        "keep_alive": "30m",
    }

    async with httpx.AsyncClient(timeout=build_ollama_timeout()) as client:
        # Fast health probe: fail quickly if Ollama endpoint is unreachable.
        health = await client.get(OLLAMA_HEALTH_URL, timeout=OLLAMA_HEALTH_TIMEOUT_SECONDS)
        health.raise_for_status()

        last_error = None
        for _ in range(max(1, OLLAMA_MAX_RETRIES + 1)):
            try:
                response = await asyncio.wait_for(
                    client.post(OLLAMA_URL, json=payload),
                    timeout=OLLAMA_TOTAL_TIMEOUT_SECONDS,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("message", {}).get("content", "No response.")
            except (httpx.HTTPError, asyncio.TimeoutError) as exc:
                last_error = exc

        if last_error:
            raise last_error
        raise RuntimeError("Unknown Ollama error")

def retrieve_rag_context(question: str, max_results: int = RAG_MAX_RESULTS) -> list[str]:
    try:
        if policy_collection.count() == 0:
            return []
        results = policy_collection.query(
            query_texts=[question],
            n_results=max_results,
            include=["documents", "metadatas", "distances"],
        )
    except Exception:
        return []

    documents = results.get("documents") or [[]]
    metadatas = results.get("metadatas") or [[]]
    distances = results.get("distances") or [[]]

    context_blocks = []
    for index, doc in enumerate(documents[0]):
        if not doc:
            continue
        metadata = metadatas[0][index] if index < len(metadatas[0]) else {}
        distance = distances[0][index] if index < len(distances[0]) else None
        source = metadata.get("source", "unknown")
        content_type = metadata.get("type", "knowledge")
        score = f"{distance:.3f}" if isinstance(distance, (int, float)) else "na"
        context_blocks.append(
            f"[{index + 1}] source={source} type={content_type} score={score}\n{doc}"
        )
    return context_blocks

def retrieve_fallback_context(question: str, max_results: int = RAG_FALLBACK_MAX_RESULTS) -> list[str]:
    if not fallback_rag_docs:
        return []

    query_tokens = tokenize(question)
    if not query_tokens:
        return []

    scored = []
    for doc in fallback_rag_docs:
        overlap = len(query_tokens & doc["tokens"])
        if overlap == 0:
            continue
        score = overlap / max(1, len(query_tokens))
        scored.append((score, doc))

    scored.sort(key=lambda item: item[0], reverse=True)
    top = scored[:max_results]
    context_blocks = []
    for index, (score, doc) in enumerate(top):
        context_blocks.append(
            f"[{index + 1}] source={doc['source']} type={doc['type']} score={score:.3f}\n{doc['text']}"
        )
    return context_blocks

def _trim_context_block(block: str, max_chars: int) -> str:
    lines = block.splitlines()
    if not lines:
        return block

    header = lines[0]
    body = " ".join(line.strip() for line in lines[1:] if line.strip())
    if len(body) > max_chars:
        body = body[:max_chars].rsplit(" ", 1)[0].strip() + " ..."
    return f"{header}\n{body}" if body else header

def build_rag_prompt(user_text: str, context_blocks: list[str], faq_topic: Optional[str] = None) -> str:
    if not context_blocks:
        return user_text

    trimmed_blocks = [_trim_context_block(block, RAG_MAX_CHARS_PER_BLOCK) for block in context_blocks]
    joined_context = ""
    for block in trimmed_blocks:
        candidate = f"{joined_context}\n\n{block}".strip() if joined_context else block
        if len(candidate) > RAG_MAX_PROMPT_CONTEXT_CHARS:
            break
        joined_context = candidate

    intent_line = f"Detected FAQ topic: {faq_topic}.\n" if faq_topic else ""
    return (
        "You are KeanGlobal assistant. Use campus context first.\n"
        "If context is missing, say that clearly before a brief best-effort answer.\n"
        "Keep answers concise and practical.\n\n"
        f"{intent_line}"
        f"Context:\n{joined_context}\n\n"
        f"User question: {user_text}"
    )

def build_fallback_answer(question: str, context_blocks: list[str], lang: str) -> str:
    if not context_blocks:
        return trn("fallback_no_context", lang)

    question_tokens = tokenize(question)
    best_line = None
    best_score = 0

    for block in context_blocks:
        for raw_line in block.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("[") or line.startswith("source="):
                continue
            line_tokens = tokenize(line)
            overlap = len(question_tokens & line_tokens)
            if overlap > best_score:
                best_score = overlap
                best_line = line

    if best_line:
        return trn("fallback_best_match", lang, line=best_line)

    first_block_lines = context_blocks[0].splitlines()
    first_content_line = ""
    for raw in first_block_lines[1:]:
        line = raw.strip()
        if line:
            first_content_line = line
            break
    if not first_content_line:
        first_content_line = context_blocks[0][:280]
    return trn("fallback_top_context", lang, line=first_content_line[:280])

def _clean_fast_path_line(line: str) -> str:
    cleaned = line.strip()
    cleaned = re.sub(r"^Title:\s*Unknown\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^Description:\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned

def _truncate_snippet(text: str, max_chars: int = 180) -> str:
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars]
    for marker in (". ", "; ", ", "):
        idx = cut.rfind(marker)
        if idx >= int(max_chars * 0.6):
            return cut[: idx + 1].strip()
    return cut.rsplit(" ", 1)[0].strip() + " ..."

def build_fast_path_answer(question: str, context_blocks: list[str], lang: str, max_lines: int = FAQ_FAST_PATH_MAX_LINES) -> Optional[str]:
    if not context_blocks:
        return None

    query_tokens = tokenize(question)
    candidates = []

    for block in context_blocks:
        lines = block.splitlines()
        source = "unknown"
        if lines:
            match = re.search(r"source=([^\s]+)", lines[0])
            if match:
                source = match.group(1)
        for raw_line in lines[1:]:
            line = _clean_fast_path_line(raw_line)
            if not line:
                continue
            if len(line) < 24:
                continue
            if line.lower().startswith("source="):
                continue
            line_tokens = tokenize(line)
            overlap = len(query_tokens & line_tokens)
            if overlap == 0:
                continue
            candidates.append((overlap, len(line), line, source))

    if not candidates:
        # If lexical overlap is weak (e.g., multilingual query vs English docs),
        # still return top informative lines from highest-ranked context blocks.
        for block in context_blocks:
            lines = block.splitlines()
            source = "unknown"
            if lines:
                match = re.search(r"source=([^\s]+)", lines[0])
                if match:
                    source = match.group(1)
            for raw_line in lines[1:]:
                line = _clean_fast_path_line(raw_line)
                if not line or len(line) < 24:
                    continue
                if line.lower().startswith("source="):
                    continue
                candidates.append((0, len(line), line, source))

    if not candidates:
        return None

    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    selected = []
    seen_lines = set()

    def too_similar(existing: str, candidate: str) -> bool:
        a = tokenize(existing)
        b = tokenize(candidate)
        if not a or not b:
            return False
        overlap = len(a & b)
        ratio = overlap / max(1, min(len(a), len(b)))
        return ratio >= 0.8

    for overlap, _, line, source in candidates:
        key = normalize(line)
        if key in seen_lines:
            continue
        if any(too_similar(prev_line, line) for prev_line, _ in selected):
            continue
        seen_lines.add(key)
        selected.append((line, source))
        if len(selected) >= max_lines:
            break

    if not selected:
        return None

    body_lines = [trn("fast_path_prefix", lang)]
    for idx, (line, source) in enumerate(selected, start=1):
        snippet = _truncate_snippet(line, max_chars=180)
        source_name = Path(source).name or source
        body_lines.append(f"{idx}. {snippet}")
        body_lines.append(f"   Source: {source_name}")

    return "\n".join(body_lines)

# ROUTES

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chat")
async def chat(req: ChatRequest):
    user_text = req.message.strip()
    lang = detect_language(user_text)
    faq_topic = detect_faq_intent(user_text)
    destination_id = find_location_destination_id(user_text)
    has_location_intent = is_location_question(user_text)

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

    if has_location_intent or (destination_id and should_route_destination_without_location_keyword(user_text)):
        use_current_location = should_use_current_location(user_text)
        location_mode = "directions" if use_current_location else "highlight"
        if destination_id:
            destination_id = normalize_location_destination_for_response(destination_id, user_text)
            destination = campus_location_by_id.get(destination_id, {})
            return {
                "answer": trn(
                    "location_opening_specific",
                    lang,
                    name=destination.get("name", "That location"),
                    campus=destination.get("campus", "campus"),
                ),
                "intent": "location",
                "destination_id": destination_id,
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

    if is_calendar_question(user_text):
        term = extract_term_from_text(user_text)
        if term:
            matched = next((t for t in calendar_data if term in t), None)
            category = detect_event_category(user_text)
            if matched and category:
                best_event = find_best_calendar_event(calendar_data[matched], category)
                if best_event:
                    event, date = best_event
                    return {
                        "answer": f"{localize_date_text(event.title(), lang)}: {localize_date_text(date, lang)}",
                        "intent": "calendar",
                    }

    context_blocks = retrieve_rag_context(user_text)
    if not context_blocks:
        fallback_query = f"{user_text} {faq_topic.replace('_', ' ') if faq_topic else ''}".strip()
        context_blocks = retrieve_fallback_context(fallback_query)

    if FAQ_FAST_PATH_ENABLED and faq_topic and context_blocks:
        fast_answer = build_fast_path_answer(user_text, context_blocks, lang)
        if fast_answer:
            return {
                "answer": fast_answer,
                "intent": "faq",
                "faq_topic": faq_topic,
                "sources_used": len(context_blocks),
                "response_mode": "fast_path",
            }

    prompt = build_rag_prompt(user_text, context_blocks, faq_topic)

    try:
        reply = await query_ollama(prompt, lang)
    except (httpx.HTTPError, asyncio.TimeoutError):
        fast_answer = build_fast_path_answer(user_text, context_blocks, lang, max_lines=2)
        if fast_answer:
            return {
                "answer": fast_answer,
                "intent": "faq" if faq_topic else "general",
                "faq_topic": faq_topic,
                "sources_used": len(context_blocks),
                "response_mode": "fast_path_timeout",
            }
        fallback_answer = build_fallback_answer(user_text, context_blocks, lang)
        return {"answer": fallback_answer, "intent": "faq" if faq_topic else "general", "faq_topic": faq_topic, "sources_used": len(context_blocks)}
    except Exception:
        fast_answer = build_fast_path_answer(user_text, context_blocks, lang, max_lines=2)
        if fast_answer:
            return {
                "answer": fast_answer,
                "intent": "faq" if faq_topic else "general",
                "faq_topic": faq_topic,
                "sources_used": len(context_blocks),
                "response_mode": "fast_path_timeout",
            }
        fallback_answer = build_fallback_answer(user_text, context_blocks, lang)
        return {"answer": fallback_answer, "intent": "faq" if faq_topic else "general", "faq_topic": faq_topic, "sources_used": len(context_blocks)}

    return {"answer": reply, "intent": "faq" if faq_topic else "general", "faq_topic": faq_topic, "sources_used": len(context_blocks)}
