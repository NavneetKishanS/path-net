#!/usr/bin/env bash
# One entry point for the team:  bash run.sh <command>
set -euo pipefail
cd "$(dirname "$0")"

case "${1:-help}" in
  setup) bash scripts/setup.sh ;;
  up)    bash scripts/setup.sh && docker compose up --build ;;
  down)  docker compose down ;;
  reset) docker compose down -v && docker compose up --build ;;
  logs)  docker compose logs -f ;;
  seed)  docker compose run --rm seed ;;
  web)   cd web && npm install && npm run dev ;;
  smoke) bash scripts/smoke.sh ;;
  data)
    echo "Run these from pipeline/ (pip install -r requirements.txt first):"
    echo "  python fetch_pubmed.py \"YOUR QUERY\" --max 50"
    echo "  python extract.py"
    echo "  python cluster.py"
    ;;
  *)
    echo "bash run.sh setup   check tools, create .env"
    echo "bash run.sh up      start db, api, seed, web (http://localhost:5173)"
    echo "bash run.sh down    stop everything (keeps data)"
    echo "bash run.sh reset   wipe the database and start clean"
    echo "bash run.sh logs    follow logs"
    echo "bash run.sh seed    reload data/seed/graph.json into Postgres"
    echo "bash run.sh web     run the web app alone, no backend (static data)"
    echo "bash run.sh data    pipeline steps (see context/roles/P2-ai-graph.md)"
    echo "bash run.sh smoke   check that the stack answers"
    ;;
esac
