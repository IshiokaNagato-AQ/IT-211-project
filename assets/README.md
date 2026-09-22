# Lexigrep

A local keyword search engine for text files, built with plain HTML, CSS, and JavaScript — no frameworks, no build step, no server. Everything runs in the browser.

## How it works

- **Hash table** — a custom separate-chaining hash table (`HashTable` in `script.js`) maps every indexed word to the files and line numbers it appears in. It resizes itself once its load factor passes 0.75.
- **Trie** — a prefix tree (`Trie`) stores the same vocabulary for fast "starts with" lookups and the live autocomplete dropdown.
- **Search algorithms** — four selectable modes:
  - **Exact** — O(1) hash table lookup.
  - **Starts with** — trie traversal from the prefix node.
  - **Contains** — substring search over every indexed term (sliding-window matcher, not `String.includes`).
  - **Fuzzy** — Levenshtein edit-distance ranking, with a tolerance that scales with word length.
- Results are grouped by file, ranked by match count, and rendered with the matched word highlighted in context.

## Running it locally

No install required — it's a static site, but it needs to be served over `http://`, not opened as a `file://` path, because loading the built-in data (below) uses `fetch()`, which browsers block on `file://`.

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000
```

Folder selection needs `webkitdirectory` support, which Chrome/Edge/Brave have; other browsers fall back to picking individual files.

## The built-in database (`data/`)

Drop `.txt` (or `.md`/`.csv`/`.log`) files into `data/` and reload the page — they're detected and indexed automatically, no editing required. This works by reading the folder's directory listing, which local dev servers like `python3 -m http.server` provide out of the box.

Static hosts like **GitHub Pages don't expose a directory listing**, so auto-detect won't work once deployed there. For that case, there's a fallback: `data/manifest.json`, a plain list of filenames the app reads if the live listing isn't available. Regenerate it from whatever's actually in `data/` before you push:

```bash
python3 scripts/generate-manifest.py
```

Run that any time you add or remove files from `data/`, then commit the updated `manifest.json` alongside your files.

You can still use the **Add files** / **Select a folder** buttons on top of this to index anything else at runtime; everything lands in the same search index.

## Adding your background image

Drop an image at `assets/background.jpg` (any name works, just update the path in `style.css` under `.bg-image`). The page already applies a dark gradient overlay so text stays readable over any photo.

## Project structure

```
lexigrep/
├── index.html                # markup — hero, search bar, results container
├── style.css                  # theme, layout, animation
├── script.js                    # hash table, trie, search algorithms, UI logic
├── data/                          # built-in "database" — auto-detected on load
│   ├── manifest.json                # fallback list, used when no directory listing
│   ├── sample-notes.txt
│   └── sample-recipe.txt
├── scripts/
│   └── generate-manifest.py         # regenerates manifest.json before deploying
├── assets/                        # put background.jpg here
└── README.md
```

## Pushing to GitHub

```bash
cd lexigrep
git init
git add .
git commit -m "Initial commit: Lexigrep keyword search"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

To host it live for free, enable **GitHub Pages** in the repo's Settings → Pages, pointing at the `main` branch root — the site is static so it'll work as-is.

## Notes & possible extensions

- Deletion from the hash table/trie isn't implemented directly; removing a file triggers a full rebuild from the remaining files, which is simplest and fast enough at this scale.
- Everything stays in memory — nothing is uploaded anywhere, which is why file selection uses the browser's File API rather than a backend.
- Ideas for extending it: TF-IDF ranking instead of raw match count, regex search mode, a Boyer–Moore or KMP implementation swapped in for the "contains" matcher, persisting the index with IndexedDB so it survives a page reload.
