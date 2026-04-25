import base64
import hashlib
import logging
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models import OAuthCredentials

logger = logging.getLogger(__name__)


@dataclass
class OAuthMetadata:
    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    registration_endpoint: str
    revocation_endpoint: str | None


def fetch_metadata(timeout: float = 10.0) -> OAuthMetadata:
    with httpx.Client(timeout=timeout) as client:
        resp = client.get(settings.peec_oauth_metadata_url)
        resp.raise_for_status()
        d = resp.json()
    return OAuthMetadata(
        issuer=d["issuer"],
        authorization_endpoint=d["authorization_endpoint"],
        token_endpoint=d["token_endpoint"],
        registration_endpoint=d["registration_endpoint"],
        revocation_endpoint=d.get("revocation_endpoint"),
    )


def register_client(
    metadata: OAuthMetadata,
    client_name: str = "Felix",
    redirect_uri: str | None = None,
) -> str:
    """OAuth 2.0 Dynamic Client Registration. Returns the new client_id."""
    redirect_uri = redirect_uri or settings.peec_oauth_redirect_uri
    body = {
        "client_name": client_name,
        "redirect_uris": [redirect_uri],
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "none",
    }
    with httpx.Client(timeout=10.0) as client:
        resp = client.post(
            metadata.registration_endpoint,
            json=body,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
    return resp.json()["client_id"]


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def make_pkce() -> tuple[str, str]:
    """Returns (code_verifier, code_challenge) per RFC 7636 (S256)."""
    verifier = _b64url(secrets.token_bytes(32))
    challenge = _b64url(hashlib.sha256(verifier.encode("ascii")).digest())
    return verifier, challenge


def build_authorize_url(
    metadata: OAuthMetadata,
    client_id: str,
    code_challenge: str,
    state: str,
    redirect_uri: str | None = None,
) -> str:
    redirect_uri = redirect_uri or settings.peec_oauth_redirect_uri
    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return f"{metadata.authorization_endpoint}?{urlencode(params)}"


def exchange_code(
    metadata: OAuthMetadata,
    client_id: str,
    code: str,
    code_verifier: str,
    redirect_uri: str | None = None,
) -> dict:
    """Exchange authorization code for access + refresh tokens."""
    redirect_uri = redirect_uri or settings.peec_oauth_redirect_uri
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "code_verifier": code_verifier,
    }
    with httpx.Client(timeout=10.0) as client:
        resp = client.post(
            metadata.token_endpoint,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
    return resp.json()


def refresh_access_token(
    token_endpoint: str, client_id: str, refresh_token: str
) -> dict:
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
    }
    with httpx.Client(timeout=10.0) as client:
        resp = client.post(
            token_endpoint,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
    return resp.json()


def store_credentials(
    db: Session,
    *,
    provider: str,
    client_id: str,
    token_response: dict,
    token_endpoint: str,
) -> OAuthCredentials:
    expires_in = token_response.get("expires_in")
    expires_at = (
        datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))
        if expires_in
        else None
    )

    cred = db.query(OAuthCredentials).filter(OAuthCredentials.provider == provider).first()
    if cred is None:
        cred = OAuthCredentials(
            id=f"oc_{uuid.uuid4()}",
            provider=provider,
            client_id=client_id,
            access_token=token_response["access_token"],
            refresh_token=token_response.get("refresh_token"),
            expires_at=expires_at,
            scope=token_response.get("scope"),
            token_endpoint=token_endpoint,
        )
        db.add(cred)
    else:
        cred.client_id = client_id
        cred.access_token = token_response["access_token"]
        # Some servers omit refresh_token on refresh; keep the old one if so
        if token_response.get("refresh_token"):
            cred.refresh_token = token_response["refresh_token"]
        cred.expires_at = expires_at
        cred.scope = token_response.get("scope") or cred.scope
        cred.token_endpoint = token_endpoint

    db.commit()
    db.refresh(cred)
    return cred


def get_valid_access_token(db: Session, provider: str = "peec") -> str:
    """Return a valid access token for `provider`, refreshing if needed.

    Raises LookupError if no credentials are stored.
    Raises RuntimeError if refresh fails and no usable token exists.
    """
    cred = db.query(OAuthCredentials).filter(OAuthCredentials.provider == provider).first()
    if cred is None:
        raise LookupError(
            f"No OAuth credentials for {provider!r}. "
            f"Run: uv run python -m app.scripts.connect_peec"
        )

    expires_at = cred.expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    refresh_threshold = datetime.now(timezone.utc) + timedelta(minutes=5)
    needs_refresh = expires_at is not None and expires_at <= refresh_threshold

    if needs_refresh:
        if not cred.refresh_token:
            raise RuntimeError(
                "Peec access token expired and no refresh token available. "
                "Re-run: uv run python -m app.scripts.connect_peec"
            )
        try:
            new_tokens = refresh_access_token(
                cred.token_endpoint, cred.client_id, cred.refresh_token
            )
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Peec token refresh failed: {e.response.status_code} {e.response.text[:200]}"
            ) from e
        cred = store_credentials(
            db,
            provider=provider,
            client_id=cred.client_id,
            token_response=new_tokens,
            token_endpoint=cred.token_endpoint,
        )
        logger.info("refreshed peec access token; new expiry=%s", cred.expires_at)

    return cred.access_token
