# PathNet: context for Claude Code

Hackathon project (Hack-Nation Challenge 05, rare-disease atlas). Prototype v0, tight deadline, four people. Keep changes small and working.

First, read `context/00-PROJECT.md`. Then ask which person you are working for (P1 data, P2 AI and graph, P3 frontend, P4 platform and story) and read `context/roles/<that file>`. Folder-level `CLAUDE.md` files in `web/`, `pipeline/` and `supabase/` add local rules.

Rules that apply everywhere:
- Do not overengineer. This is a prototype; prefer the simplest thing that keeps the demo path working.
- Evidence integrity is scored. Never invent a source URL, quote, PMID or ontology id. If you do not have the real one, leave it empty or mark the row `placeholder`.
- Stay in your owner's folder. If you need a change in someone else's folder or in `contract/contract.json`, say so instead of editing it.
- Never commit `.env` or any key.
- Do not push or commit unless the user asks.
- The demo path must keep working: search, graph, click an edge, read its evidence, action view, no-route state.
