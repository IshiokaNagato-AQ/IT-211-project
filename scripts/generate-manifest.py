#!/usr/bin/env python3
"""
Regenerates data/manifest.json from whatever text files are actually
sitting in data/. Run this before pushing to GitHub Pages (or any static
host that doesn't expose a directory listing), since the app's live
auto-detect only works against a dev server that serves one.

Usage:
    python3 scripts/generate-manifest.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
MANIFEST = DATA_DIR / "manifest.json"
TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".log"}

def main():
    if not DATA_DIR.exists():
        print(f"No data/ folder found at {DATA_DIR}")
        return

    files = sorted(
        p.name for p in DATA_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in TEXT_EXTENSIONS
    )

    MANIFEST.write_text(json.dumps(files, indent=2) + "\n")
    print(f"Wrote {len(files)} file(s) to {MANIFEST.relative_to(ROOT)}:")
    for f in files:
        print(f"  - {f}")

if __name__ == "__main__":
    main()
