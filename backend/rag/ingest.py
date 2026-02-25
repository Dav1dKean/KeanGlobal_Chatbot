from pathlib import Path
import chromadb
from chromadb.utils import embedding_functions
import re

# ==============================
# PATH CONFIG
# ==============================

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FOLDER = BASE_DIR / "data"
POLICY_FOLDER = BASE_DIR / "Policies"
PERSIST_DIR = BASE_DIR / "app" / "chroma_db"

COLLECTION_NAME = "kean_knowledge"


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
    # INGEST ACADEMIC CALENDARS
    # ==============================

    for file in DATA_FOLDER.glob("*.txt"):
        with open(file, "r", encoding="utf-8") as f:
            text = f.read()

        terms = split_by_term(text)

        for i, term in enumerate(terms):
            documents.append(term)
            ids.append(f"{file.stem}_calendar_{i}")
            metadatas.append({
                "type": "calendar",
                "source": file.name
            })

        print(f"📅 Processed calendar: {file.name}")

    # ==============================
    # INGEST POLICIES
    # ==============================

    for file in POLICY_FOLDER.glob("*.txt"):
        with open(file, "r", encoding="utf-8") as f:
            text = f.read()

        chunks = chunk_text(text)

        for i, chunk in enumerate(chunks):
            documents.append(chunk)
            ids.append(f"{file.stem}_policy_{i}")
            metadatas.append({
                "type": "policy",
                "source": file.name
            })

        print(f"📘 Processed policy: {file.name}")

    # ==============================
    # UPSERT EVERYTHING
    # ==============================

    collection.upsert(
        documents=documents,
        ids=ids,
        metadatas=metadatas
    )

    print("Calendars and Policies ingested successfully!")


if __name__ == "__main__":
    ingest()