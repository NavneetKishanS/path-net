# supabase/ (owner: P4)

SQL migrations, numbered. Docker runs them on a fresh database volume only (`bash run.sh reset` after editing). On Supabase cloud, run them in the SQL editor in order.

- `0001_graph.sql`: graph tables and read access for the REST API.
- Next: `0002_roles_rls.sql` with `user_roles`, row-level security by role, a contributions table, and a separate view for named contacts.
- Roles are enforced by RLS, not by hiding buttons in the UI.
- Role brief: `context/roles/P4-platform-story.md`.
