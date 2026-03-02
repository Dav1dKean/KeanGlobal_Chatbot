from pathlib import Path
import chromadb
from chromadb.utils import embedding_functions
import re
import json

# ==============================
# PATH CONFIG
# ==============================

BASE_DIR = Path(__file__).resolve().parent.parent
PERSIST_DIR = BASE_DIR / "app" / "chroma_db"

COLLECTION_NAME = "kean_knowledge"
EXCLUDED_DIR_NAMES = {"venv", ".venv", "chroma_db", "__pycache__"}
EXCLUDED_FILE_NAMES = {"requirements.txt", "_RAG_TEMPLATE.txt", "faq_intent_keywords.json", "program_info_rag.txt"}


# ==============================
# CALENDAR SPLITTER
# ==============================

def split_by_term(text: str):
    pattern = r"(Fall \d{4} Semester|Spring \d{4} Semester|Winter \d{4} Term|Summer \d{4} Term)"
    matches = list(re.finditer(pattern, text))

    sections = []

    for i in range(len(matches)):
        start = matches[i].start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections.append(text[start:end].strip())

    return sections


# ==============================
# POLICY CHUNKING
# ==============================

def chunk_text(text: str, chunk_size: int = 800):
    chunks = []
    for i in range(0, len(text), chunk_size):
        chunks.append(text[i:i + chunk_size])
    return chunks


def classify_doc_type(path: Path) -> str:
    lowered_parts = [part.lower() for part in path.parts]
    name = path.name.lower()
    if "policies" in lowered_parts or "policy" in name:
        return "policy"
    if "calendar" in name:
        return "calendar"
    if "program" in name:
        return "program"
    return "knowledge"


def iter_knowledge_files(base_dir: Path):
    for file in base_dir.rglob("*"):
        if not file.is_file():
            continue
        if any(part in EXCLUDED_DIR_NAMES for part in file.parts):
            continue
        if file.name in EXCLUDED_FILE_NAMES:
            continue
        if file.suffix.lower() not in {".txt", ".json"}:
            continue
        yield file


def extract_json_chunks(text: str, chunk_size: int = 800):
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return chunk_text(text, chunk_size=chunk_size)

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

    walk(data)
    flat_text = "\n".join(extracted_lines).strip()
    if not flat_text:
        flat_text = text
    return chunk_text(flat_text, chunk_size=chunk_size)


# ==============================
# INGEST FUNCTION
# ==============================

def ingest():
    client = chromadb.PersistentClient(path=str(PERSIST_DIR))

    embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    # Delete old collection safely
    try:
        client.delete_collection(COLLECTION_NAME)
    except:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_function
    )

    documents = []
    ids = []
    metadatas = []

    # ==============================
    # INGEST ALL KNOWLEDGE TEXT FILES
    # ==============================

    for file in iter_knowledge_files(BASE_DIR):
        try:
            text = file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = file.read_text(encoding="latin-1")

        if not text.strip():
            continue

        doc_type = classify_doc_type(file)
        if file.suffix.lower() == ".json":
            chunks = extract_json_chunks(text)
        elif doc_type == "calendar":
            chunks = split_by_term(text)
            if not chunks:
                chunks = chunk_text(text)
        else:
            chunks = chunk_text(text)

        relative_source = file.relative_to(BASE_DIR).as_posix()
        for i, chunk in enumerate(chunks):
            if not chunk.strip():
                continue
            documents.append(chunk)
            ids.append(f"{relative_source.replace('/', '_')}_{i}")
            metadatas.append({
                "type": doc_type,
                "source": relative_source
            })

        print(f"📚 Processed {doc_type}: {relative_source}")

    # ==============================
    # UPSERT EVERYTHING
    # ==============================

    collection.upsert(
        documents=documents,
        ids=ids,
        metadatas=metadatas
    )

    print("All text/JSON knowledge sources ingested successfully!")


if __name__ == "__main__":
    ingest()
