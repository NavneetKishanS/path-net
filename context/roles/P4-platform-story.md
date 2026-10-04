# P4: Platform and story lead

Owner: ______________ · Sleeps 05:00 to 09:00 · Read `context/00-PROJECT.md` first.

Local integration status (2026-10-04): the 58-node P1 M1 snapshot is loaded into the persistent shared Docker database and read by the app. The exact seed command, README reproduction and browser checks are recorded in [P1-INTEGRATION.md](../P1-INTEGRATION.md); full platform/cloud/media gates remain tracked in [P4-TASK-STATUS.md](../P4-TASK-STATUS.md).

## Mission
Own the foundation (schema, roles, deploy) and the story (README, demo script, videos, submission). You are also the integrator: keep `main` working and gate-tag known-good builds.

## You own
`supabase/`, `contract/`, `docker-compose.yml`, `scripts/`, `run.sh`, `README.md`, `.env.example`, deploy, demo script, videos, submission.

## Start in 5 minutes
```bash
bash run.sh up        # db, api, seed, web at http://localhost:5173
bash run.sh smoke     # prints row counts and checks the web server
```

## Checklist
**M0 (Sat 20:30)**
- [ ] Create the Supabase cloud project. Run `supabase/migrations/0001_graph.sql` there. Keep the project URL and keys in `.env`, never in git.
- [ ] Confirm `contract/contract.json` with P2. Announce it to the team.
- [ ] Create the GitHub repo access for all four, branch rules, and a task board.
- [ ] Add 5 demo users (one per role) and a `user_roles` table.

**M1 (to 01:00)**
- [ ] Load the seed into Supabase cloud (adapt `pipeline/load_seed.py` with the Supabase connection string).
- [ ] Read-only RLS on graph tables.
- [ ] First deploy to a preview URL. Tag `gate-m1`.
- [ ] Stub `explain-path` edge function returning canned text.
- [ ] Draft the demo script from the 1-minute walkthrough in `context/00-PROJECT.md`.

**M2 (01:00 to 05:00, you are awake with P2)**
- [ ] `supabase/migrations/0002_roles_rls.sql`: `user_roles`, policies by role, role-aware edge visibility, a separate view for named contacts.
- [ ] `contributions` table and the approve flow (tier D, status `unverified`, admin approves).
- [ ] `extract-abstract` edge function: paste an abstract, get pending edges back.
- [ ] No-route response: what was searched, what is missing, what to test next.
- [ ] Write the handoff note before you sleep at 05:00.

**M3 (09:00 to 10:00)**
- [ ] Admin review queue, contribution form, production deploy.
- [ ] End-to-end smoke test of the demo path with all five logins.

**M4 (10:00 to 13:00)**
- [x] README: architecture diagram and exact reproduce-the-dataset commands, updated and verified for the current 58-node M1 snapshot.
- [ ] Record the 1-minute walkthrough with ElevenLabs voiceover, and the team video.
- [ ] Record a backup screen capture in case the live demo fails.

**M5 (13:00 to 15:00)**
- [ ] Submit the prototype link, repo and videos at least one hour early. Confirm judge access to the repo.

## Rules
- Keys live in `.env` and Supabase secrets only. Edge functions call OpenAI and ElevenLabs so keys never reach the browser.
- Roles are enforced by RLS, not just hidden buttons.
- Named contacts: public, professional information only, in a separate view that only permitted roles can read.

## Done means
Five logins each see the right home view and are blocked from what they should not see. The deployed URL passes the MVP bar from a clean browser. Submission confirmed.

## Prompt to paste into Claude Code
"I am P4 (platform) on PathNet. Read context/00-PROJECT.md and context/roles/P4-platform-story.md. Write supabase/migrations/0002_roles_rls.sql adding user_roles and row-level security policies for family, group_leader, scout, researcher and admin, plus a contributions table with an admin approval flow. Keep it minimal and explain how to test each policy."
