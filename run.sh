#!/usr/bin/env bash
# One entry point for the team:  bash run.sh <command>
set -euo pipefail
if [[ "${BASH_SOURCE[0]}" == */* ]]; then
  cd -- "${BASH_SOURCE[0]%/*}"
fi

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
    "${PYTHON:-python}" pipeline/build_graph.py
    "${PYTHON:-python}" pipeline/validate_graph.py --check-raw
    ;;
  migrate) "${PYTHON:-python}" scripts/platform.py migrate ;;
  platform-seed) "${PYTHON:-python}" scripts/platform.py seed ;;
  platform-test)
    node scripts/tests/check_rls.mjs
    node scripts/tests/check_platform.mjs
    node --experimental-strip-types --test supabase/functions/tests/*.test.ts
    "${PYTHON:-python}" -m unittest discover -s scripts/tests -p 'test_*.py'
    ;;
  *)
    echo "bash run.sh setup   check tools, create .env"
    echo "bash run.sh up      build caches + web, load database, start API and app"
    echo "bash run.sh down    stop everything (keeps data)"
    echo "bash run.sh reset   wipe the database and start clean"
    echo "bash run.sh logs    follow logs"
    echo "bash run.sh seed    refresh reviewed graph, explanations and coverage"
    echo "bash run.sh web     run the web app alone, no backend (static data)"
    echo "bash run.sh data    rebuild and audit the reviewed P1 baseline offline"
    echo "bash run.sh migrate apply pending migrations using DATABASE_URL"
    echo "bash run.sh platform-seed upsert reviewed graph and coverage without deleting contributions"
    echo "bash run.sh platform-test isolated database/role and endpoint checks"
    echo "bash run.sh smoke   check that the stack answers"
    ;;
esac
