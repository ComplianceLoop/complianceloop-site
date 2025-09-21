#!/usr/bin/env bash
# Add an entry to config/allowlist.json (or allowlist.json) and open a PR.

set -euo pipefail

# ---- Inputs ---------------------------------------------------------------
BASE_BRANCH="${BASE_BRANCH:-main}"
ALLOWLIST_ENTRY="${ALLOWLIST_ENTRY:-}"
PREVIEW_URL="${PREVIEW_URL:-}"

# Derive from PREVIEW_URL if only a full link is provided
if [[ -z "${ALLOWLIST_ENTRY}" && -n "${PREVIEW_URL}" ]]; then
  ALLOWLIST_ENTRY="$(python3 - <<'PY'
import os
from urllib.parse import urlparse
u = os.environ['PREVIEW_URL']
p = urlparse(u if '://' in u else 'https://' + u)
print((p.scheme + '://' + p.netloc) if p.scheme and p.netloc else p.netloc)
PY
)"
fi

if [[ -z "${ALLOWLIST_ENTRY}" ]]; then
  echo "No ALLOWLIST_ENTRY or PREVIEW_URL provided. Exiting without error."
  exit 0
fi

# ---- Locate allowlist file -----------------------------------------------
FILE_PATH=""
for candidate in "config/allowlist.json" "allowlist.json"; do
  [[ -f "$candidate" ]] && { FILE_PATH="$candidate"; break; }
done
[[ -z "$FILE_PATH" ]] && FILE_PATH="$(git ls-files | grep -E '(^|/)allowlist\.json$' | head -n1 || true)"

if [[ -z "$FILE_PATH" ]]; then
  echo "No allowlist.json present. Exiting without error (nothing to update)."
  exit 0
fi
echo "Using allowlist file: ${FILE_PATH}"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repository."; exit 1; }

# ---- Identify author so commits succeed in Actions -----------------------
GIT_USER="${GITHUB_ACTOR:-github-actions}"
GIT_EMAIL="${GIT_USER}@users.noreply.github.com"
git config user.name "${GIT_USER}"
git config user.email "${GIT_EMAIL}"

# ---- Create working branch -----------------------------------------------
TS="$(date +%Y%m%d%H%M%S)"
BRANCH="chore/allowlist-${TS}"
git fetch origin "${BASE_BRANCH}" >/dev/null 2>&1 || true
git checkout -B "${BRANCH}" "origin/${BASE_BRANCH}" 2>/dev/null || git checkout -B "${BRANCH}" "${BASE_BRANCH}"

# ---- Update JSON (jq if available, else Python) --------------------------
if command -v jq >/dev/null 2>&1; then
  TMP="$(mktemp)"
  jq --arg v "${ALLOWLIST_ENTRY}" '
    def adduniq(arr; v):
      if (arr // []) | type == "array" then (arr + [v]) | unique else [arr, v] | unique end;
    if has("allowlist") and (.allowlist | type) == "array" then
      .allowlist = adduniq(.allowlist; $v)
    elif has("origins") and (.origins | type) == "array" then
      .origins = adduniq(.origins; $v)
    elif has("domains") and (.domains | type) == "array" then
      .domains = adduniq(.domains; $v)
    elif has("hosts") and (.hosts | type) == "array" then
      .hosts = adduniq(.hosts; $v)
    else
      .allowlist = adduniq((.allowlist // []); $v)
    end
  ' "${FILE_PATH}" > "${TMP}" && mv "${TMP}" "${FILE_PATH}"
else
  FILE_PATH_ENV="${FILE_PATH}" ALLOWLIST_ENTRY_ENV="${ALLOWLIST_ENTRY}" python3 - <<'PY'
import json, os
path = os.environ['FILE_PATH_ENV']; v = os.environ['ALLOWLIST_ENTRY_ENV']
with open(path, 'r', encoding='utf-8') as f: data = json.load(f)
def add(key):
    if key in data:
        if isinstance(data[key], list):
            data[key] = list(dict.fromkeys(data[key] + [v])
