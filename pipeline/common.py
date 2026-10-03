"""Shared paths and helpers for the pipeline scripts."""
import json
import os
from pathlib import Path

# In docker the data folder is mounted at /data; locally it sits next to this folder.
DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
SEED_FILE = DATA_DIR / "seed" / "graph.json"
RAW_DIR = DATA_DIR / "raw"
EXTRACTED_DIR = DATA_DIR / "extracted"

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:54322/pathnet"
)


def load_seed(path: Path = SEED_FILE) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
