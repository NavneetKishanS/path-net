PYTHON ?= python

.PHONY: data verify platform-test migrate seed
data:
	$(PYTHON) pipeline/build_graph.py
	$(PYTHON) pipeline/validate_graph.py --check-raw

verify:
	$(PYTHON) pipeline/validate_graph.py --check-raw
	$(PYTHON) pipeline/restore_pubmed.py --check
	$(PYTHON) -m unittest discover -s pipeline/tests -p 'test_*.py'

platform-test:
	node scripts/tests/check_rls.mjs
	node scripts/tests/check_platform.mjs
	node --experimental-strip-types --test supabase/functions/tests/*.test.ts
	$(PYTHON) -m unittest discover -s scripts/tests -p 'test_*.py'

migrate:
	$(PYTHON) scripts/platform.py migrate

seed:
	$(PYTHON) scripts/platform.py seed
