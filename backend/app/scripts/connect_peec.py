"""One-time bootstrap: OAuth-connect this Felix instance to a Peec account.

Usage:
    uv run python -m app.scripts.connect_peec

Spins up a localhost server on the redirect port, opens the system browser
to Peec's authorize endpoint, captures the authorization code, exchanges it
for tokens, and stores them in the local SQLite DB.
"""

import http.server
import secrets
import socketserver
import sys
import threading
import urllib.parse
import webbrowser
from datetime import timezone

from app.config import settings
from app.db import Base, SessionLocal, engine
from app.services import peec_oauth

# Make sure all tables exist before we try to write to oauth_credentials
import app.models  # noqa: F401

Base.metadata.create_all(bind=engine)


_received: dict[str, str] = {}
_received_event = threading.Event()


class _CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 — http.server convention
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/oauth/callback":
            self.send_response(404)
            self.end_headers()
            return

        params = dict(urllib.parse.parse_qsl(parsed.query))
        if "error" in params:
            _received["error"] = params.get("error", "")
            _received["error_description"] = params.get("error_description", "")
        else:
            _received["code"] = params.get("code", "")
            _received["state"] = params.get("state", "")

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        body = (
            "<html><body style='font-family:system-ui;padding:2rem;'>"
            "<h2>Felix is connected to Peec.</h2>"
            "<p>You can close this tab and return to your terminal.</p>"
            "</body></html>"
        )
        self.wfile.write(body.encode("utf-8"))
        _received_event.set()

    def log_message(self, format, *args):  # silence default stderr logs
        return


def main() -> int:
    print("→ Fetching Peec OAuth metadata…")
    metadata = peec_oauth.fetch_metadata()
    print(f"  authorization_endpoint = {metadata.authorization_endpoint}")
    print(f"  token_endpoint         = {metadata.token_endpoint}")

    print("→ Registering Felix as an OAuth client (DCR)…")
    client_id = peec_oauth.register_client(metadata, client_name="Felix (local)")
    print(f"  client_id = {client_id}")

    code_verifier, code_challenge = peec_oauth.make_pkce()
    state = secrets.token_urlsafe(24)

    parsed_redirect = urllib.parse.urlparse(settings.peec_oauth_redirect_uri)
    host = parsed_redirect.hostname or "localhost"
    port = parsed_redirect.port or 8765

    server = socketserver.TCPServer((host, port), _CallbackHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    print(f"→ Listening on http://{host}:{port} for the callback…")

    try:
        url = peec_oauth.build_authorize_url(
            metadata, client_id, code_challenge, state
        )
        print("→ Opening browser for consent…")
        print(f"   (if it doesn't open, paste this URL into your browser)\n   {url}\n")
        webbrowser.open(url)

        if not _received_event.wait(timeout=300):
            print("✗ Timed out waiting for OAuth callback (5 min).", file=sys.stderr)
            return 2

        if "error" in _received:
            print(
                f"✗ OAuth error: {_received['error']} — {_received.get('error_description', '')}",
                file=sys.stderr,
            )
            return 3

        if _received.get("state") != state:
            print("✗ OAuth state mismatch — refusing to continue.", file=sys.stderr)
            return 4

        code = _received["code"]
        print("→ Exchanging code for tokens…")
        tokens = peec_oauth.exchange_code(metadata, client_id, code, code_verifier)

        db = SessionLocal()
        try:
            cred = peec_oauth.store_credentials(
                db,
                provider="peec",
                client_id=client_id,
                token_response=tokens,
                token_endpoint=metadata.token_endpoint,
            )
        finally:
            db.close()

        expiry = cred.expires_at
        if expiry is not None and expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        print("✓ Stored Peec credentials.")
        print(f"  expires_at    = {expiry}")
        print(f"  refresh_token = {'yes' if cred.refresh_token else 'no'}")
        print(f"  scope         = {cred.scope or '(none)'}")
        print()
        print("Now set PEEC_USE_REAL_MCP=true and restart the backend.")
        return 0
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    raise SystemExit(main())
