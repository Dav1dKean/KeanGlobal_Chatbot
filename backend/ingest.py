import os
import chromadb
from chromadb.utils import embedding_functions
from pathlib import Path

# 1. Setup paths 
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"  
CHROMA_PATH = BASE_DIR / "app" / "chroma_db"

def main():
    # 2. Check if the DATA_DIR exists
    if not DATA_DIR.exists():
        print(f"❌ Could not find the data directory at: {DATA_DIR}")
        return

    # Find all .txt files in the directory
    txt_files = list(DATA_DIR.glob("*.txt"))
    if not txt_files:
        print(f"❌ No .txt files found in {DATA_DIR}")
        return

    # 3. Initialize ChromaDB and the Embedding Model
    print("Starting ChromaDB client...")
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    embedding_func = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )
    
    collection = client.get_or_create_collection(
        name="kean_knowledge",
        embedding_function=embedding_func
    )

    docs_to_insert = []
    metas_to_insert = []
    ids_to_insert = []

    print(f"Found {len(txt_files)} text files. Processing...")

    # 4. Read all text files and chunk them into paragraphs
    for file_path in txt_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Simple chunking: Split the text into paragraphs by double newlines
            paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
            
            for index, paragraph in enumerate(paragraphs):
                # Skip very short paragraphs (e.g., less than 20 characters) that might just be titles or noise
                if len(paragraph) < 20:
                    continue
                    
                docs_to_insert.append(paragraph)
                metas_to_insert.append({
                    "source": file_path.name,   
                    "type": "text_document"
                })
                # Create a unique ID combining the filename and the paragraph index
                ids_to_insert.append(f"{file_path.stem}_chunk_{index}")
                
        except Exception as e:
            print(f"⚠️ Error reading {file_path.name}: {e}")

    # 5. Batch insert into ChromaDB
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
            
    print("🎉 All text files have been successfully imported into ChromaDB!")

if __name__ == "__main__":
    main()