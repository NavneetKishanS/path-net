# supabase/ (owner: P4)

SQL migrations, numbered. `python scripts/platform.py migrate` applies each once using a checksum ledger; Docker runs this before seeding. Add a new migration when changing an applied schema. On Supabase cloud use the same operator command with the intended DATABASE_URL.

- `0001_graph.sql`: graph tables and read access for the REST API.
- `0002_roles_rls.sql`: `user_roles`, row-level security by role, contributions and guarded review RPCs, restricted contacts and response caches.
- Roles are enforced by RLS, not by hiding buttons in the UI.
- Role brief: `context/roles/P4-platform-story.md`.
