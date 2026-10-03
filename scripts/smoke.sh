#!/usr/bin/env bash
# Quick check that the docker stack is serving data. Run after `bash run.sh up` has settled.
set -uo pipefail
API="${API_URL:-http://localhost:3001}"
WEB="${WEB_URL:-http://localhost:5173}"
FAIL=0

count() { # table -> row count from PostgREST's Content-Range header
  curl -s -I -H 'Prefer: count=exact' "$API/$1?limit=1" | tr -d '\r' | awk -F/ 'tolower($0) ~ /^content-range/ {print $2}'
}

for t in nodes edges evidence clusters; do
  n="$(count "$t")"
  if [ -n "${n:-}" ] && [ "$n" -gt 0 ] 2>/dev/null; then
    printf '  ok   %-10s %s rows\n' "$t" "$n"
  else
    printf '  FAIL %-10s no rows (is the seed finished? try: bash run.sh seed)\n' "$t"; FAIL=1
  fi
done

code="$(curl -s -o /dev/null -w '%{http_code}' "$WEB")"
if [ "$code" = "200" ]; then printf '  ok   web        %s\n' "$WEB"; else printf '  FAIL web        HTTP %s\n' "$code"; FAIL=1; fi

exit $FAIL
