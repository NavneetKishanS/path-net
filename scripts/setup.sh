#!/usr/bin/env bash
# Checks that the tools are installed and creates .env on first run. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

ok() { printf '  ok   %s\n' "$1"; }
bad() { printf '  MISSING  %s\n' "$1"; MISSING=1; }
MISSING=0

echo "Checking tools"
command -v docker >/dev/null 2>&1 && ok "docker" || bad "docker (install Docker Desktop)"
docker compose version >/dev/null 2>&1 && ok "docker compose" || bad "docker compose v2"
command -v node >/dev/null 2>&1 && ok "node $(node -v) (only needed to run web/ without Docker)" || echo "  note  node not found; fine if you only use Docker"
command -v python3 >/dev/null 2>&1 && ok "python3 (only needed to run pipeline/ outside Docker)" || echo "  note  python3 not found; fine if you only use Docker"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Add your own keys there. Never commit .env."
fi

if [ "$MISSING" = "1" ]; then
  echo "Install the missing tools above, then re-run."
  exit 1
fi
echo "Ready. Run: bash run.sh up"
