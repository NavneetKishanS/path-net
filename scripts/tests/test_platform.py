"""Operator safety checks: identity ownership, secrets, configuration and idempotence boundaries."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from contextlib import redirect_stdout
from io import StringIO

SPEC = importlib.util.spec_from_file_location("pathnet_platform", Path(__file__).resolve().parents[1] / "platform.py")
platform = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(platform)


class PlatformOperatorTests(unittest.TestCase):
    def test_environment_wins_and_dotenv_is_never_evaluated(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(platform, "ROOT", Path(directory)), patch.dict(os.environ, {"DATABASE_URL": "from-process"}, clear=True):
            Path(directory, ".env").write_text("DATABASE_URL=from-file\nOPENAI_API_KEY='$(not-a-command)'\n# comment\n", encoding="utf-8")
            platform.load_env()
            self.assertEqual(os.environ["DATABASE_URL"], "from-process")
            self.assertEqual(os.environ["OPENAI_API_KEY"], "$(not-a-command)")

    def test_rejects_unsafe_operator_endpoints(self):
        for value in ("https:", "http://remote.test", "https://user:secret@remote.test", "https://remote.test?key=secret", "https://remote.test/path", "file:///tmp"):
            with self.subTest(value=value), patch.dict(os.environ, {"SUPABASE_URL": value}, clear=True):
                with self.assertRaises(ValueError):
                    platform.safe_base_url()
        for value in ("https://example.supabase.co", "http://127.0.0.1:54321", "http://localhost:54321"):
            with self.subTest(value=value), patch.dict(os.environ, {"SUPABASE_URL": value}, clear=True):
                self.assertEqual(platform.safe_base_url(), value)

    def accounts(self):
        values = {}
        for role in platform.ROLES:
            values[f"DEMO_{role.upper()}_EMAIL"] = f"{role}@example.test"
            values[f"DEMO_{role.upper()}_PASSWORD"] = "long-test-password"
        return values

    def test_refuses_existing_non_demo_identity_before_any_writes(self):
        with patch.dict(os.environ, self.accounts(), clear=True), patch.object(platform, "request_api", return_value={"users": [{"id": "real-id", "email": "admin@example.test", "app_metadata": {}}]}) as request, patch.object(platform, "connect") as connect:
            with self.assertRaisesRegex(ValueError, "not a matching"):
                platform.demo_users()
            connect.assert_not_called()
            self.assertTrue(all(c.args[0] == "GET" for c in request.call_args_list))

    def test_refuses_duplicate_role_identities_before_any_requests(self):
        values = self.accounts()
        values["DEMO_ADMIN_EMAIL"] = values["DEMO_FAMILY_EMAIL"].upper()
        with patch.dict(os.environ, values, clear=True), patch.object(platform, "request_api") as request:
            with self.assertRaisesRegex(ValueError, "different demo email"):
                platform.demo_users()
            request.assert_not_called()

    def test_reuses_owned_demo_users_without_resetting_passwords(self):
        users = [{"id": f"id-{r}", "email": f"{r}@example.test", "app_metadata": {"pathnet_demo_role": r}} for r in platform.ROLES]
        with patch.dict(os.environ, self.accounts(), clear=True), patch.object(platform, "request_api", return_value={"users": users}) as request, patch.object(platform, "connect") as connect:
            with redirect_stdout(StringIO()):
                platform.demo_users()
            self.assertEqual(request.call_count, 1)
            self.assertEqual(connect.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value.execute.call_count, 5)


if __name__ == "__main__":
    unittest.main()
