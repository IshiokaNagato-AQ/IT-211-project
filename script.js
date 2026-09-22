"use strict";

/* =========================================================================
   1. HASH TABLE
   A separate-chaining hash table mapping word -> { fileName -> [lineNumbers] }
   Implemented from scratch (rather than a plain JS object) so resizing,
   collisions, and load factor are explicit.
   ========================================================================= */

class HashTable {
  constructor(initialCapacity = 64) {
    this.capacity = initialCapacity;
    this.buckets = new Array(this.capacity).fill(null).map(() => []);
    this.size = 0; // number of distinct keys stored
  }

  // djb2 string hash
  _hash(key) {
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) + hash) + key.charCodeAt(i);
      hash = hash >>> 0; // keep unsigned
    }
    return hash % this.capacity;
  }

  _resize() {
    const oldBuckets = this.buckets;
    this.capacity *= 2;
    this.buckets = new Array(this.capacity).fill(null).map(() => []);
    this.size = 0;
    for (const bucket of oldBuckets) {
      for (const [key, value] of bucket) {
        this._insertRaw(key, value);
      }
    }
  }

  _insertRaw(key, value) {
    const idx = this._hash(key);
    this.buckets[idx].push([key, value]);
    this.size++;
  }

  // Returns the postings object for `key`, creating it if absent.
  getOrCreate(key) {
    if (this.size / this.capacity > 0.75) this._resize();
    const idx = this._hash(key);
    for (const pair of this.buckets[idx]) {
      if (pair[0] === key) return pair[1];
    }
    const value = {};
    this.buckets[idx].push([key, value]);
    this.size++;
    return value;
  }

  get(key) {
    const idx = this._hash(key);
    for (const pair of this.buckets[idx]) {
      if (pair[0] === key) return pair[1];
    }
    return undefined;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  keys() {
    const result = [];
    for (const bucket of this.buckets) {
      for (const [key] of bucket) result.push(key);
    }
    return result;
  }

  clear() {
    this.capacity = 64;
    this.buckets = new Array(this.capacity).fill(null).map(() => []);
    this.size = 0;
  }
}

/* =========================================================================
   2. TRIE
   Used for prefix search ("starts with") and live autocomplete suggestions.
   ========================================================================= */

class TrieNode {
  constructor() {
    this.children = new Map();
    this.isWord = false;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
    this.nodeCount = 1;
  }

  insert(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) {
        node.children.set(ch, new TrieNode());
        this.nodeCount++;
      }
      node = node.children.get(ch);
    }
    node.isWord = true;
  }

  _nodeAtPrefix(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children.has(ch)) return null;
      node = node.children.get(ch);
    }
    return node;
  }

  has(word) {
    const node = this._nodeAtPrefix(word);
    return !!node && node.isWord;
  }

  // Collects up to `limit` words stored under `prefix`, via DFS.
  wordsWithPrefix(prefix, limit = Infinity) {
    const startNode = this._nodeAtPrefix(prefix);
    const results = [];
    if (!startNode) return results;

    const stack = [[startNode, prefix]];
    while (stack.length && results.length < limit) {
      const [node, path] = stack.pop();
      if (node.isWord) results.push(path);
      // push children in reverse so DFS visits them in insertion-ish order
      const entries = [...node.children.entries()];
      for (let i = entries.length - 1; i >= 0; i--) {
        stack.push([entries[i][1], path + entries[i][0]]);
      }
    }
    return results;
  }

  clear() {
    this.root = new TrieNode();
    this.nodeCount = 1;
  }
}

/* =========================================================================
   3. SEARCH ALGORITHMS
   ========================================================================= */

// Naive substring search (sliding window) — used for "contains" mode instead
// of relying on String.includes, so the matching step is explicit.
function containsSubstring(text, pattern) {
  if (pattern.length === 0) return true;
  const n = text.length, m = pattern.length;
  for (let i = 0; i <= n - m; i++) {
    let j = 0;
    while (j < m && text[i + j] === pattern[j]) j++;
    if (j === m) return true;
  }
  return false;
}

// Levenshtein edit distance — used for "fuzzy" mode.
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[a.length][b.length];
}

function fuzzyThreshold(len) {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return 2;
}

/* =========================================================================
   4. INDEX STATE + BUILDING
   ========================================================================= */

const index = {
  hashTable: new HashTable(),
  trie: new Trie(),
  files: new Map(), // fileName -> array of raw lines (for snippet rendering)
};

const WORD_RE = /[a-z0-9']+/g;

function tokenize(line) {
  return line.toLowerCase().match(WORD_RE) || [];
}

function addFileToIndex(fileName, text) {
  const lines = text.split(/\r\n|\r|\n/);
  index.files.set(fileName, lines);

  lines.forEach((line, lineIdx) => {
    const words = tokenize(line);
    for (const word of words) {
      const postings = index.hashTable.getOrCreate(word);
      if (!postings[fileName]) postings[fileName] = [];
      // avoid duplicate consecutive line numbers for repeated words on one line
      if (postings[fileName][postings[fileName].length - 1] !== lineIdx) {
        postings[fileName].push(lineIdx);
      }
      index.trie.insert(word);
    }
  });
}

function removeFileFromIndex(fileName) {
  index.files.delete(fileName);
  // Rebuild is simplest & correct given hash table / trie don't support deletion here.
  rebuildFromFiles();
}

function rebuildFromFiles() {
  const snapshot = new Map(index.files);
  index.hashTable.clear();
  index.trie.clear();
  index.files.clear();
  for (const [name, lines] of snapshot) {
    addFileToIndex(name, lines.join("\n"));
  }
}

/* =========================================================================
   5. UI WIRING
   ========================================================================= */

const el = {
  folderBtn: document.getElementById("folderBtn"),
  filesBtn: document.getElementById("filesBtn"),
  folderInput: document.getElementById("folderInput"),
  filesInput: document.getElementById("filesInput"),
  loaderHint: document.getElementById("loaderHint"),
  fileChips: document.getElementById("fileChips"),
  searchSection: document.getElementById("searchSection"),
  searchInput: document.getElementById("searchInput"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  suggestions: document.getElementById("suggestions"),
  results: document.getElementById("results"),
  statFiles: document.getElementById("statFiles"),
  statTerms: document.getElementById("statTerms"),
  statNodes: document.getElementById("statNodes"),
  statTime: document.getElementById("statTime"),
};

let mode = "exact";
let lastBuildMs = 0;

// Feature-detect webkitdirectory support; hide the folder button if unusable.
if (!("webkitdirectory" in document.createElement("input"))) {
  el.folderBtn.hidden = true;
}

el.folderBtn.addEventListener("click", () => el.folderInput.click());
el.filesBtn.addEventListener("click", () => el.filesInput.click());
el.folderInput.addEventListener("change", (e) => handleFileList(e.target.files));
el.filesInput.addEventListener("change", (e) => handleFileList(e.target.files));

function isTextLike(file) {
  const name = file.name.toLowerCase();
  return /\.(txt|md|csv|log|json|js|css|html|py|java|c|cpp|ts)$/.test(name) ||
         file.type.startsWith("text/");
}

async function handleFileList(fileList) {
  const files = [...fileList].filter(isTextLike);
  if (files.length === 0) return;

  const start = performance.now();
  el.loaderHint.textContent = "Indexing…";

  for (const file of files) {
    const text = await file.text();
    // Use webkitRelativePath when a folder was selected, else plain name.
    const label = file.webkitRelativePath || file.name;
    addFileToIndex(label, text);
  }

  lastBuildMs = Math.round(performance.now() - start);
  renderChips();
  renderStats();
  el.searchSection.hidden = false;
  el.loaderHint.textContent = `${index.files.size} file${index.files.size === 1 ? "" : "s"} indexed`;
  el.searchInput.focus();
  runSearch();
}

function renderChips() {
  el.fileChips.innerHTML = "";
  el.fileChips.hidden = index.files.size === 0;
  for (const name of index.files.keys()) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `<span>${escapeHtml(name)}</span>`;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.title = `Remove ${name}`;
    removeBtn.addEventListener("click", () => {
      removeFileFromIndex(name);
      renderChips();
      renderStats();
      el.loaderHint.textContent = index.files.size
        ? `${index.files.size} file${index.files.size === 1 ? "" : "s"} indexed`
        : "No files indexed yet";
      el.searchSection.hidden = index.files.size === 0;
      runSearch();
    });
    chip.appendChild(removeBtn);
    el.fileChips.appendChild(chip);
  }
}

function renderStats() {
  el.statFiles.textContent = index.files.size;
  el.statTerms.textContent = index.hashTable.size.toLocaleString();
  el.statNodes.textContent = index.trie.nodeCount.toLocaleString();
  el.statTime.textContent = `${lastBuildMs}ms`;
}

el.clearAllBtn.addEventListener("click", () => {
  index.hashTable.clear();
  index.trie.clear();
  index.files.clear();
  el.folderInput.value = "";
  el.filesInput.value = "";
  renderChips();
  renderStats();
  el.searchSection.hidden = true;
  el.results.innerHTML = "";
  el.loaderHint.textContent = "No files indexed yet";
});

document.querySelectorAll(".mode").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    mode = btn.dataset.mode;
    runSearch();
  });
});

el.searchInput.addEventListener("input", () => {
  updateSuggestions();
  runSearch();
});

el.searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    el.suggestions.hidden = true;
  }
});

document.addEventListener("click", (e) => {
  if (!el.suggestions.contains(e.target) && e.target !== el.searchInput) {
    el.suggestions.hidden = true;
  }
});

function updateSuggestions() {
  const q = el.searchInput.value.trim().toLowerCase();
  el.suggestions.innerHTML = "";
  if (!q || index.files.size === 0) {
    el.suggestions.hidden = true;
    return;
  }
  const words = index.trie.wordsWithPrefix(q, 6);
  if (words.length === 0) {
    el.suggestions.hidden = true;
    return;
  }
  for (const word of words) {
    const postings = index.hashTable.get(word) || {};
    const total = Object.values(postings).reduce((sum, arr) => sum + arr.length, 0);
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(word)}</span><span class="count">${total}</span>`;
    li.addEventListener("click", () => {
      el.searchInput.value = word;
      el.suggestions.hidden = true;
      runSearch();
    });
    el.suggestions.appendChild(li);
  }
  el.suggestions.hidden = false;
}

/* =========================================================================
   6. SEARCH EXECUTION + RENDERING
   ========================================================================= */

function runSearch() {
  const query = el.searchInput.value.trim().toLowerCase();
  el.results.innerHTML = "";

  if (index.files.size === 0) return;

  if (!query) {
    renderEmpty(`Type a term above to search across <strong>${index.files.size}</strong> file${index.files.size === 1 ? "" : "s"}.`);
    return;
  }

  const matchedWords = findMatchingWords(query, mode);

  if (matchedWords.length === 0) {
    renderEmpty(`No matches for <strong>"${escapeHtml(query)}"</strong>. Try Contains or Fuzzy mode.`);
    return;
  }

  // Merge postings across matched words, grouped by file.
  const byFile = new Map(); // fileName -> Set(lineIdx) -> we also track matched words per line for highlighting
  const matchWordsByFile = new Map(); // fileName -> lineIdx -> Set(words)

  for (const word of matchedWords) {
    const postings = index.hashTable.get(word);
    if (!postings) continue;
    for (const [fileName, lineIdxs] of Object.entries(postings)) {
      if (!byFile.has(fileName)) byFile.set(fileName, new Set());
      if (!matchWordsByFile.has(fileName)) matchWordsByFile.set(fileName, new Map());
      const lineMap = matchWordsByFile.get(fileName);
      for (const lineIdx of lineIdxs) {
        byFile.get(fileName).add(lineIdx);
        if (!lineMap.has(lineIdx)) lineMap.set(lineIdx, new Set());
        lineMap.get(lineIdx).add(word);
      }
    }
  }

  // Rank files by total match count, descending.
  const ranked = [...byFile.entries()].sort((a, b) => b[1].size - a[1].size);

  for (const [fileName, lineSet] of ranked) {
    el.results.appendChild(renderResultGroup(fileName, lineSet, matchWordsByFile.get(fileName)));
  }
}

function findMatchingWords(query, mode) {
  const allTerms = index.hashTable.keys();

  switch (mode) {
    case "exact":
      return index.hashTable.has(query) ? [query] : [];

    case "prefix":
      return index.trie.wordsWithPrefix(query, 50);

    case "contains":
      return allTerms.filter((term) => containsSubstring(term, query)).slice(0, 50);

    case "fuzzy": {
      const threshold = fuzzyThreshold(query.length);
      return allTerms
        .map((term) => ({ term, dist: editDistance(query, term) }))
        .filter((r) => r.dist <= threshold)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 30)
        .map((r) => r.term);
    }

    default:
      return [];
  }
}

function renderResultGroup(fileName, lineSet, wordsByLine) {
  const group = document.createElement("div");
  group.className = "result-group";

  const head = document.createElement("div");
  head.className = "result-head";
  head.innerHTML = `
    <span class="result-file">${escapeHtml(fileName)}</span>
    <span class="result-count">${lineSet.size} match${lineSet.size === 1 ? "" : "es"}</span>
  `;
  group.appendChild(head);

  const lines = index.files.get(fileName);
  const sortedLineIdxs = [...lineSet].sort((a, b) => a - b).slice(0, 30);

  for (const lineIdx of sortedLineIdxs) {
    const row = document.createElement("div");
    row.className = "result-line";
    const words = wordsByLine.get(lineIdx);
    row.innerHTML = `
      <span class="line-no">${lineIdx + 1}</span>
      <span class="line-text">${highlightLine(lines[lineIdx], words)}</span>
    `;
    group.appendChild(row);
  }

  return group;
}

function highlightLine(line, words) {
  const escaped = escapeHtml(line);
  // Rebuild the line token-by-token so only whole matched words are marked.
  return escaped.replace(/[a-zA-Z0-9']+/g, (token) => {
    return words.has(token.toLowerCase()) ? `<mark>${token}</mark>` : token;
  });
}

function renderEmpty(html) {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.innerHTML = html;
  el.results.appendChild(div);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* =========================================================================
   7. BUILT-IN DATA
   On load, the app tries to auto-detect every text file sitting in data/
   by reading the folder's directory listing (this is what local dev
   servers like `python3 -m http.server` serve automatically at data/).
   If no listing is available — which is the case on static hosts like
   GitHub Pages, since they don't expose directory listings — it falls
   back to data/manifest.json. Run scripts/generate-manifest.py before
   deploying to keep that fallback file in sync with what's in data/.
   Requires the page to be served over http(s): open it via a local
   server, not a file:// URL, or these fetches will be silently blocked.
   ========================================================================= */

const TEXT_FILE_RE = /\.(txt|md|csv|log)$/i;

async function autoDetectDataFiles() {
  try {
    const res = await fetch("data/");
    if (!res.ok) return null;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const names = [...doc.querySelectorAll("a")]
      .map((a) => decodeURIComponent(a.getAttribute("href") || ""))
      .filter((href) => TEXT_FILE_RE.test(href) && !href.includes("/"));
    return names.length ? names : null;
  } catch (err) {
    return null;
  }
}

async function manifestDataFiles() {
  try {
    const res = await fetch("data/manifest.json");
    if (!res.ok) return null;
    const names = await res.json();
    return Array.isArray(names) && names.length ? names : null;
  } catch (err) {
    return null;
  }
}

async function loadBuiltInData() {
  const fileNames = (await autoDetectDataFiles()) || (await manifestDataFiles());
  if (!fileNames) return;

  const start = performance.now();
  for (const name of fileNames) {
    try {
      const fileRes = await fetch(`data/${name}`);
      if (!fileRes.ok) continue;
      const text = await fileRes.text();
      addFileToIndex(name, text);
    } catch (err) {
      // skip files that fail to load, keep indexing the rest
    }
  }
  lastBuildMs = Math.round(performance.now() - start);

  renderChips();
  renderStats();
  if (index.files.size > 0) {
    el.searchSection.hidden = false;
    el.loaderHint.textContent = `${index.files.size} file${index.files.size === 1 ? "" : "s"} indexed`;
    runSearch();
  }
}

loadBuiltInData();
