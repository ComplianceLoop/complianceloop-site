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
            data[key] = list(dict.fromkeys(data[key] + [v]))
        else:
            data[key] = list(dict.fromkeys([data[key], v]))
        return True
    return False
if not any(add(k) for k in ('allowlist','origins','domains','hosts')):
    data['allowlist'] = [v]
with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False); f.write('\n')
PY
fi

git add "${FILE_PATH}"
git commit -m "chore: add ${ALLOWLIST_ENTRY} to allowlist"

# ---- Ensure pushes are authenticated in Actions --------------------------
REPO_SLUG="${GITHUB_REPOSITORY:-}"
if [[ -n "${REPO_SLUG}" && -n "${GITHUB_TOKEN:-}" ]]; then
  git remote set-url origin "https://${GIT_USER}:${GITHUB_TOKEN}@github.com/${REPO_SLUG}.git"
fi

git push -u origin "${BRANCH}"

# ---- Create PR via REST with strong error handling -----------------------
PR_TITLE="chore: add ${ALLOWLIST_ENTRY} to allowlist"
PR_BODY="Automated change: adds ${ALLOWLIST_ENTRY} to ${FILE_PATH}."
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

if [[ -z "${TOKEN}" ]]; then
  echo "Branch pushed; GH token missing, open PR manually."
  exit 0
fi

OWNER="${REPO_SLUG%%/*}"; REPO="${REPO_SLUG##*/}"
API="https://api.github.com/repos/${OWNER}/${REPO}/pulls"
REQ="/tmp/pr_request.json"
RESP="/tmp/pr_response.json"

printf '{"title":"%s","head":"%s","base":"%s","body":"%s"}' \
  "${PR_TITLE}" "${BRANCH}" "${BASE_BRANCH}" "${PR_BODY}" > "$REQ"

HTTP_CODE="$(curl -sS -o "$RESP" -w "%{http_code}" \
  -H "Authorization: token ${TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -d @"$REQ" "${API}")"

echo "PR API HTTP ${HTTP_CODE}"
if [[ "${HTTP_CODE}" != 2* && "${HTTP_CODE}" != 3* ]]; then
  echo "PR API error body:"
  sed -n '1,200p' "$RESP" || true
  exit 1
fi

python3 - <<'PY'
import json, sys
print(json.load(open("/tmp/pr_response.json")).get("html_url", "PR created"))
PY
