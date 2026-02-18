from pathlib import Path
import chromadb
from chromadb.utils import embedding_functions
import re

DATA_FOLDER = Path("../data")
PERSIST_DIR = "../app/chroma_db"


def split_by_term(text: str):
    pattern = r"(Fall \d{4} Semester|Spring \d{4} Semester|Winter \d{4} Term|Summer \d{4} Term)"
    matches = list(re.finditer(pattern, text))

    sections = []

    for i in range(len(matches)):
        start = matches[i].start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections.append(text[start:end].strip())

    return sections


def ingest():
    client = chromadb.PersistentClient(path=PERSIST_DIR)

    embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    # delete old collection safely
    try:
        client.delete_collection("academic_calendar")
    except:
        pass

    collection = client.create_collection(
        name="academic_calendar",
        embedding_function=embedding_function
    )

    documents = []
    ids = []
    metadatas = []

    for file in DATA_FOLDER.glob("*.txt"):
        with open(file, "r", encoding="utf-8") as f:
            text = f.read()

        terms = split_by_term(text)

        for i, term in enumerate(terms):
            documents.append(term)
            ids.append(f"{file.stem}_{i}")
            metadatas.append({"source": file.name})

        print(f"Processed {file.name}")

    collection.upsert(
        documents=documents,
        ids=ids,
        metadatas=metadatas
    )

    print("✅ Calendars ingested by proper semester boundaries.")


if __name__ == "__main__":
    ingest()
