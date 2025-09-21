#!/usr/bin/env bash
# Tiny helper: add a string to config/allowlist.json (or allowlist.json) and open a PR.
# Inputs:
#   ALLOWLIST_ENTRY  - value to add (e.g., https://complianceloop-site-xyz.vercel.app)
#   PREVIEW_URL      - optional; if set and ALLOWLIST_ENTRY is empty, derive origin from this URL
#   BASE_BRANCH      - base branch for the PR (default: main)
#   GH_TOKEN/GITHUB_TOKEN - token fallback when gh CLI is unavailable

set -euo pipefail

BASE_BRANCH="${BASE_BRANCH:-main}"
ALLOWLIST_ENTRY="${ALLOWLIST_ENTRY:-}"
PREVIEW_URL="${PREVIEW_URL:-}"

# Derive ALLOWLIST_ENTRY from PREVIEW_URL if needed
if [[ -z "${ALLOWLIST_ENTRY}" && -n "${PREVIEW_URL}" ]]; then
  ALLOWLIST_ENTRY="$(python3 - <<'PY'
import os
from urllib.parse import urlparse
u = os.environ['PREVIEW_URL']
p = urlparse(u if '://' in u else 'https://' + u)
origin = (p.scheme + '://' + p.netloc) if p.scheme and p.netloc else p.netloc
print(origin)
PY
)"
fi

if [[ -z "${ALLOWLIST_ENTRY}" ]]; then
  echo "No ALLOWLIST_ENTRY (or PREVIEW_URL) provided. Nothing to do."
  exit 0
fi

# Find the allowlist JSON file
FILE_PATH=""
for candidate in "config/allowlist.json" "allowlist.json"; do
  if [[ -f "$candidate" ]]; then FILE_PATH="$candidate"; break; fi
done
if [[ -z "$FILE_PATH" ]]; then
  FILE_PATH="$(git ls-files | grep -E '(^|/)allowlist\.json$' | head -n1 || true)"
fi
if [[ -z "$FILE_PATH" ]]; then
  echo "No allowlist.json found. Skipping without error."
  exit 0
fi

echo "Using allowlist file: ${FILE_PATH}"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repository."; exit 1; }

# Create a feature branch
TS="$(date +%Y%m%d%H%M%S)"
BRANCH="chore/allowlist-${TS}"
git fetch origin "${BASE_BRANCH}" >/dev/null 2>&1 || true
git checkout -B "${BRANCH}" "origin/${BASE_BRANCH}" 2>/dev/null || git checkout -B "${BRANCH}" "${BASE_BRANCH}"

# Edit JSON: prefer jq; fall back to Python
if command -v jq >/dev/null 2>&1; then
  TMP="$(mktemp)"
  jq --arg v "${ALLOWLIST_ENTRY}" '
    def adduniq(arr; v):
      if (arr // []) | type == "array" then
        (arr + [v]) | unique
      else
        [arr, v] | unique
      end;

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
import json, os, sys
path = os.environ['FILE_PATH_ENV']
v = os.environ['ALLOWLIST_ENTRY_ENV']
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
def add(key):
    if key in data:
        if isinstance(data[key], list):
            if v not in data[key]:
                data[key].append(v)
        elif isinstance(data[key], str):
            if data[key] != v:
                data[key] = list({data[key], v})
        else:
            data[key] = [v]
        return True
    return False
changed = any(add(k) for k in ('allowlist','origins','domains','hosts'))
if not changed:
    data['allowlist'] = [v]
with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')
PY
fi

# Commit and push
git add "${FILE_PATH}"
git commit -m "chore: add ${ALLOWLIST_ENTRY} to allowlist"
git push -u origin "${BRANCH}"

PR_TITLE="chore: add ${ALLOWLIST_ENTRY} to allowlist"
PR_BODY="Automated change: adds ${ALLOWLIST_ENTRY} to ${FILE_PATH}."

# Open pull request via gh CLI if available; otherwise via REST API with token
if command -v gh >/dev/null 2>&1; then
  gh pr create --title "${PR_TITLE}" --body "${PR_BODY}" --base "${BASE_BRANCH}" --head "${BRANCH}" || {
    echo "gh pr create failed. Falling back to REST API."
    FALLBACK=1
  }
else
  FALLBACK=1
fi

if [[ "${FALLBACK:-0}" == "1" ]]; then
  TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
  if [[ -z "${TOKEN}" ]]; then
    echo "No gh CLI and no GH_TOKEN/GITHUB_TOKEN available. Branch pushed; please open a PR manually."
    exit 0
  }
  ORIGIN_URL="$(git remote get-url origin)"
  if [[ "${ORIGIN_URL}" =~ github\.com[:/]{1}([^/]+)/([^/.]+)(\.git)?$ ]]; then
    OWNER="${BASH_REMATCH[1]}"; REPO="${BASH_REMATCH[2]}"
  else
    echo "Could not parse GitHub owner/repo from 'origin' remote."
    exit 1
  fi
  API="https://api.github.com/repos/${OWNER}/${REPO}/pulls"
  JSON_PAYLOAD="$(printf '{"title":"%s","head":"%s","base":"%s","body":"%s"}' \
    "${PR_TITLE}" "${BRANCH}" "${BASE_BRANCH}" "${PR_BODY}")"
  RESP="$(curl -sS -H "Authorization: token ${TOKEN}" -H "Accept: application/vnd.github+json" \
    -d "${JSON_PAYLOAD}" "${API}")"
  echo "${RESP}" | python3 - <<'PY'
import sys, json
data = json.load(sys.stdin)
print(data.get("html_url", "PR created (URL unavailable)"))
PY
fi
