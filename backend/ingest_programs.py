import json
import chromadb
from chromadb.utils import embedding_functions
from pathlib import Path

# 1. Setup paths (Adjust these if your folder structure is different)
BASE_DIR = Path(__file__).resolve().parent
JSON_PATH = BASE_DIR / "data" / "program_info.json"
CHROMA_PATH = BASE_DIR / "app" / "chroma_db"

def main():
    # 2. Check if the JSON file exists
    if not JSON_PATH.exists():
        print(f"❌ Could not find the JSON file at: {JSON_PATH}")
        return

    # 3. Initialize ChromaDB and the Embedding Model (Must match the one in main.py)
    print("Starting ChromaDB client...")
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    embedding_func = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )
    
    collection = client.get_or_create_collection(
        name="kean_knowledge",
        embedding_function=embedding_func
    )

    # 4. Load the JSON data
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    programs = data.get("programs", {})
    
    docs_to_insert = []
    metas_to_insert = []
    ids_to_insert = []

    print(f"Processing data for {len(programs)} programs...")

    # 5. Extract and format into natural language chunks
    for program_key, program_data in programs.items():
        meta_info = program_data.get("metadata", {})
        details = program_data.get("details", {})
        curriculum = program_data.get("curriculum", {})
        
        full_name = meta_info.get("full_name", program_key)
        description = details.get("description", "")
        core_courses = curriculum.get("core_courses", {})
        
        # --- Chunk Type A: Program Overview ---
        overview_text = f"The {full_name} program. {description}"
        if core_courses:
            course_list = ", ".join(core_courses.keys())
            overview_text += f" Core courses include: {course_list}."
            
        docs_to_insert.append(overview_text)
        metas_to_insert.append({
            "source": "program_info.json",
            "type": "program_overview",
            "program_name": full_name
        })
        ids_to_insert.append(f"overview_{program_key}")

        # --- Chunk Type B: Individual Course Descriptions ---
        for course_code, course_info in core_courses.items():
            course_desc = course_info.get("description", "")
            if not course_desc:
                continue
                
            course_text = f"Course {course_code} is a core course in the {full_name} program. {course_desc}"
            
            docs_to_insert.append(course_text)
            metas_to_insert.append({
                "source": "program_info.json",
                "type": "course_description",
                "program_name": full_name,
                "course_code": course_code
            })
            ids_to_insert.append(f"course_{program_key}_{course_code.replace(' ', '_')}")

    # 6. Batch insert into ChromaDB
    if docs_to_insert:
        print(f"Preparing to insert {len(docs_to_insert)} text chunks into the database...")
        # We insert in batches of 100 to prevent memory overload
        batch_size = 100
        for i in range(0, len(docs_to_insert), batch_size):
            collection.upsert(
                documents=docs_to_insert[i : i + batch_size],
                metadatas=metas_to_insert[i : i + batch_size],
                ids=ids_to_insert[i : i + batch_size]
            )
            print(f"✅ Successfully inserted items {i+1} to {min(i+batch_size, len(docs_to_insert))}")
            
    print("🎉 All program and course data has been successfully imported into ChromaDB!")

if __name__ == "__main__":
    main()