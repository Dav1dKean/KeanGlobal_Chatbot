from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CHUNKS_PATH = Path("/Users/mymac1/Downloads/chunks.jsonl")
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "backend" / "data" / "kean_official_secondary_crawler_rag.txt"

ALLOWED_URLS = {
    # Advising and academic support
    "https://www.kean.edu/center-advising-persistence-and-success/academic-advising": 4,
    "https://www.kean.edu/offices/registrars-office/registration-information/academic-advising-requirements": 4,
    "https://www.kean.edu/offices/center-academic-success": 3,
    "https://www.kean.edu/offices/center-academic-success/cas-mission": 2,
    "https://www.kean.edu/academic-coaching": 2,
    "https://www.kean.edu/offices/student-success-and-retention/kean-university-campus-resources": 8,
    "https://www.kean.edu/department-3-0-4": 3,
    # Student ID, commuter, dining, and campus-life support
    "https://www.kean.edu/cougarcards": 5,
    "https://www.kean.edu/kean-id": 2,
    "https://www.kean.edu/offices/student-accounting/meal-plans": 5,
    "https://www.kean.edu/division-student-affairs/policies/commuter-lockers": 2,
    "https://www.kean.edu/offices/office-student-government/commuter-resource-center/bicycle-parking": 1,
    # Student support and care resources
    "https://www.kean.edu/cougar-connections": 3,
    "https://www.kean.edu/cougar-connections/campus-resources-0": 5,
    "https://www.kean.edu/cougar-connections/cccsw-services": 4,
    "https://www.kean.edu/cougar-connections/helplines": 3,
    "https://www.kean.edu/cares": 2,
    "https://www.kean.edu/kubit-cares": 3,
    "https://www.kean.edu/kubit-cares/all-about-making-kubit-referral": 3,
    "https://www.kean.edu/kubit-cares/student-resources": 3,
    # Official processes and policies not fully represented in curated RAG
    "https://www.kean.edu/SASE": 4,
    "https://www.kean.edu/division-student-affairs/policies/emergency-closures": 4,
    "https://www.kean.edu/accepted/steps-enrollment": 6,
    # Financial aid/admissions supplement, capped to avoid replacing curated primary files
    "https://www.kean.edu/offices/admissions/contact-admissions": 4,
    "https://www.kean.edu/offices/financial-aid/disbursements-and-adjustments": 4,
    "https://www.kean.edu/offices/financial-aid/unemployment-tuition-waiver": 4,
}

NOISY_TERMS = {
    "board of trustees",
    "presidential announcement",
    "kean in the news",
    "research days",
    "journal of school connections",
    "public notice",
    "media designation",
}

TOKEN_RE = re.compile(r"[a-z0-9]+")


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def tokens(text: str) -> set[str]:
    return {token for token in TOKEN_RE.findall(text.lower()) if len(token) >= 3}


def load_existing_token_sets() -> list[set[str]]:
    token_sets: list[set[str]] = []
    roots = [PROJECT_ROOT / "backend" / "data", PROJECT_ROOT / "backend" / "Policies"]
    for root in roots:
      for path in root.rglob("*"):
          if not path.is_file() or path.suffix.lower() not in {".txt", ".json"}:
              continue
          if path.name in {"faq_intent_keywords.json", "kean_locations.json", "_RAG_TEMPLATE.txt"}:
              continue
          try:
              text = path.read_text(encoding="utf-8")
          except UnicodeDecodeError:
              text = path.read_text(encoding="latin-1")
          for index in range(0, len(text), 1400):
              chunk_tokens = tokens(text[index:index + 1400])
              if len(chunk_tokens) >= 20:
                  token_sets.append(chunk_tokens)
    return token_sets


def is_duplicate(candidate_tokens: set[str], existing_sets: list[set[str]]) -> bool:
    if len(candidate_tokens) < 20:
        return True
    for existing in existing_sets:
        overlap = len(candidate_tokens & existing)
        if overlap < 20:
            continue
        containment = overlap / max(1, len(candidate_tokens))
        jaccard = overlap / max(1, len(candidate_tokens | existing))
        if containment >= 0.78 or jaccard >= 0.55:
            return True
    return False


def clean_document_text(text: str) -> str:
    text = str(text or "")
    text = re.sub(r"^\[Title\]\s*", "Title: ", text)
    text = text.replace("\n---\n", "\n")
    lines = [normalize_space(line) for line in text.splitlines()]
    lines = [line for line in lines if line]
    return "\n".join(lines).strip()


def should_keep_chunk(obj: dict, existing_sets: list[set[str]]) -> bool:
    metadata = obj.get("metadata") or {}
    url = metadata.get("url") or ""
    title = metadata.get("title") or ""
    document = obj.get("document") or obj.get("raw_text") or ""
    haystack = f"{url} {title} {document[:500]}".lower()

    if metadata.get("subdomain") != "www":
        return False
    if metadata.get("source_type") != "html":
        return False
    if url not in ALLOWED_URLS:
        return False
    if any(term in haystack for term in NOISY_TERMS):
        return False
    return not is_duplicate(tokens(document), existing_sets)


def build_secondary_file(chunks_path: Path, output_path: Path) -> dict:
    existing_sets = load_existing_token_sets()
    kept_by_url: dict[str, list[dict]] = defaultdict(list)
    examined_allowed = 0
    skipped_duplicate_or_noise = 0

    with chunks_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            obj = json.loads(line)
            metadata = obj.get("metadata") or {}
            url = metadata.get("url") or ""
            if url not in ALLOWED_URLS:
                continue

            examined_allowed += 1
            if len(kept_by_url[url]) >= ALLOWED_URLS[url]:
                continue
            if should_keep_chunk(obj, existing_sets):
                kept_by_url[url].append(obj)
            else:
                skipped_duplicate_or_noise += 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "Kean University Official Website Secondary RAG Data",
        "Source: filtered crawler chunks from official www.kean.edu pages",
        "Priority: secondary. If this conflicts with curated primary RAG files, use the curated primary source.",
        "Filtering: excludes non-www subdomains, PDFs, old news, board-resolution style pages, noisy archives, and chunks similar to existing curated data.",
        "",
    ]

    total_chunks = 0
    for url in sorted(kept_by_url):
        chunks = kept_by_url[url]
        if not chunks:
            continue
        metadata = chunks[0].get("metadata") or {}
        lines.extend([
            "=" * 78,
            f"Title: {metadata.get('title') or 'Untitled'}",
            f"Source URL: {url}",
            f"Last Modified: {metadata.get('last_modified') or 'Unknown'}",
            f"Crawl Date: {metadata.get('crawl_date') or 'Unknown'}",
            "=" * 78,
            "",
        ])
        for chunk in chunks:
            total_chunks += 1
            chunk_metadata = chunk.get("metadata") or {}
            section = chunk_metadata.get("section")
            chunk_index = chunk_metadata.get("chunk_index")
            if section:
                lines.append(f"Section: {section}")
            if chunk_index is not None:
                lines.append(f"Chunk: {chunk_index}")
            lines.append(clean_document_text(chunk.get("document") or chunk.get("raw_text") or ""))
            lines.append("")

    output_path.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
    return {
        "output": str(output_path),
        "allowed_chunks_examined": examined_allowed,
        "kept_chunks": total_chunks,
        "kept_urls": sum(1 for chunks in kept_by_url.values() if chunks),
        "skipped_duplicate_or_noise": skipped_duplicate_or_noise,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a filtered secondary RAG text file from crawler chunks.")
    parser.add_argument("--chunks", type=Path, default=DEFAULT_CHUNKS_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    args = parser.parse_args()

    summary = build_secondary_file(args.chunks, args.output)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
