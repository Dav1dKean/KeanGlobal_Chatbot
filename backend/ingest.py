import json
import chromadb
from chromadb.utils import embedding_functions
from pathlib import Path

# ==============================
# CONFIGURATION & PATHS
# ==============================
BASE_DIR = Path(__file__).resolve().parent
CHROMA_PATH = BASE_DIR / "app" / "chroma_db"
COLLECTION_NAME = "kean_knowledge"

# Directories to scan for knowledge files
TARGET_DIRS = [BASE_DIR / "data"]

# Files to exclude from processing
EXCLUDED_FILES = {"_RAG_TEMPLATE.txt", "faq_intent_keywords.json"}

# ==============================
# TEXT PROCESSING UTILS
# ==============================
def chunk_text(text, max_chars=800):
    """Splits long text documents into smaller chunks suitable for AI ingestion."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    current_chunk = ""
    
    for p in paragraphs:
        if len(current_chunk) + len(p) > max_chars and current_chunk:
            chunks.append(current_chunk.strip())
            current_chunk = p
        else:
            current_chunk += "\n\n" + p if current_chunk else p
            
    if current_chunk:
        chunks.append(current_chunk.strip())
    return chunks

# ==============================
# MAIN INGESTION LOGIC
# ==============================
def main():
    print("🚀 Starting ChromaDB client...")
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    embedding_func = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )
    
    # Safely delete the old collection to prevent ghost data
    try:
        client.delete_collection(COLLECTION_NAME)
        print("🧹 Cleared old database memory!")
    except Exception:
        print("🆕 This is a brand new database!")

    # Create a fresh collection
    collection = client.create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_func
    )

    docs_to_insert = []
    metas_to_insert = []
    ids_to_insert = []

    print("\n🔍 Starting file scan...")

    # Iterate through target directories
    for directory in TARGET_DIRS:
        if not directory.exists():
            print(f"⚠️ Directory not found: {directory.name}, skipping.")
            continue

        for file_path in directory.glob("*.txt"):
            if file_path.name in EXCLUDED_FILES:
                continue
                
            try:
                # Handle potential encoding issues
                try:
                    text = file_path.read_text(encoding="utf-8")
                except UnicodeDecodeError:
                    text = file_path.read_text(encoding="cp1252")
                    
                if not text.strip():
                    continue
                    
                # Chunk the text
                chunks = chunk_text(text)
                doc_type = "policy" if "policy" in directory.name.lower() else "general_knowledge"
                
                for idx, chunk in enumerate(chunks):
                    docs_to_insert.append(chunk)
                    metas_to_insert.append({"source": file_path.name, "type": doc_type})
                    safe_name = file_path.stem.replace(" ", "_")
                    ids_to_insert.append(f"txt_{safe_name}_{idx}")
                    
                print(f"  📄 [TXT] Processed: {file_path.name} ({len(chunks)} chunks)")
            except Exception as e:
                print(f"  ❌ [TXT] Failed to read {file_path.name}: {e}")

        # Handle program_info.json specifically
        json_path = directory / "program_info.json"
        if json_path.exists() and json_path.name not in EXCLUDED_FILES:
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                programs = data.get("programs", {})
                count = 0
                for program_key, program_data in programs.items():
                    meta_info = program_data.get("metadata", {})
                    details = program_data.get("details", {})
                    curriculum = program_data.get("curriculum", {})
                    
                    full_name = meta_info.get("full_name", program_key)
                    description = details.get("description", "")
                    core_courses = curriculum.get("core_courses", {})
                    
                    # Combination A: Program Overview
                    overview_text = f"The {full_name} program. {description}"
                    if core_courses:
                        overview_text += f" Core courses include: {', '.join(core_courses.keys())}."
                    
                    docs_to_insert.append(overview_text)
                    metas_to_insert.append({"source": "program_info.json", "type": "program_overview", "program_name": full_name})
                    ids_to_insert.append(f"overview_{program_key}")
                    count += 1

                    # Combination B: Individual Course Descriptions
                    for course_code, course_info in core_courses.items():
                        course_desc = course_info.get("description", "")
                        if course_desc:
                            docs_to_insert.append(f"Course {course_code} is a core course in the {full_name} program. {course_desc}")
                            metas_to_insert.append({"source": "program_info.json", "type": "course_description", "program_name": full_name, "course_code": course_code})
                            ids_to_insert.append(f"course_{program_key}_{course_code.replace(' ', '_')}")
                            count += 1

                print(f"  🎓 [JSON] Processed: program_info.json ({len(programs)} programs, {count} chunks)")
            except Exception as e:
                print(f"  ❌ [JSON] Failed to read program_info.json: {e}")

    # ==============================
    # BATCH INSERT TO DATABASE
    # ==============================
    if docs_to_insert:
        print(f"\n💾 Preparing to insert {len(docs_to_insert)} records into ChromaDB...")
        batch_size = 100
        for i in range(0, len(docs_to_insert), batch_size):
            collection.upsert(
                documents=docs_to_insert[i : i + batch_size],
                metadatas=metas_to_insert[i : i + batch_size],
                ids=ids_to_insert[i : i + batch_size]
            )
            print(f"  ✅ Successfully inserted records {i+1} to {min(i+batch_size, len(docs_to_insert))}")
        print("\n🎉 All done! All JSON and TXT data successfully ingested into the vector database!")
    else:
        print("\n⚠️ No valid data found to ingest.")

if __name__ == "__main__":
    main()