"""S30 / TG-1: characterization of settings validators and JWT edge cases (tests only)."""
import base64
import json
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from pydantic import ValidationError

from app.core.config import Settings, settings
from app.core.security import create_access_token, decode_access_token

ME_URL = "/api/v1/auth/me"


def _make_settings(monkeypatch, **env):
    for key in ("SECRET_KEY", "ENVIRONMENT", "AUTH_RATE_LIMIT_PER_MINUTE", "CORS_ORIGINS"):
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    return Settings(_env_file=None)


# --- Settings validators (SEC-F01 regression) -------------------------------------------------

def test_secret_key_shorter_than_32_chars_is_rejected(monkeypatch):
    with pytest.raises(ValidationError, match="at least 32 characters"):
        _make_settings(monkeypatch, SECRET_KEY="x" * 31)


def test_secret_key_of_exactly_32_chars_is_accepted(monkeypatch):
    assert _make_settings(monkeypatch, SECRET_KEY="x" * 32).SECRET_KEY == "x" * 32


def test_short_secret_key_is_rejected_in_every_environment(monkeypatch):
    with pytest.raises(ValidationError):
        _make_settings(monkeypatch, SECRET_KEY="short", ENVIRONMENT="production")


def test_default_secret_key_is_accepted_outside_production(monkeypatch):
    cfg = _make_settings(monkeypatch)
    assert "change-in-production" in cfg.SECRET_KEY
    assert cfg.ENVIRONMENT == "development"


def test_default_secret_key_is_rejected_in_production(monkeypatch):
    with pytest.raises(ValidationError, match="not allowed in production"):
        _make_settings(monkeypatch, ENVIRONMENT="production")


@pytest.mark.parametrize("env_value", ["PRODUCTION", " production ", "Production"])
def test_production_check_ignores_case_and_surrounding_whitespace(monkeypatch, env_value):
    with pytest.raises(ValidationError, match="not allowed in production"):
        _make_settings(monkeypatch, ENVIRONMENT=env_value)


def test_custom_secret_key_is_accepted_in_production(monkeypatch):
    cfg = _make_settings(monkeypatch, ENVIRONMENT="production", SECRET_KEY="a-real-random-secret-" + "z" * 20)
    assert cfg.ENVIRONMENT == "production"


def test_secret_key_containing_marker_is_rejected_in_production_even_if_custom(monkeypatch):
    # The production guard is a substring check on "change-in-production".
    with pytest.raises(ValidationError, match="not allowed in production"):
        _make_settings(monkeypatch, ENVIRONMENT="production", SECRET_KEY="my-own-but-change-in-production-" + "k" * 10)


@pytest.mark.parametrize("value", ["0", "-5"])
def test_rate_limit_per_minute_below_one_is_rejected(monkeypatch, value):
    with pytest.raises(ValidationError, match="must be >= 1"):
        _make_settings(monkeypatch, AUTH_RATE_LIMIT_PER_MINUTE=value)


def test_cors_origin_list_strips_whitespace_and_drops_empty_entries(monkeypatch):
    cfg = _make_settings(monkeypatch, CORS_ORIGINS=" https://a.example , ,https://b.example,")
    assert cfg.cors_origin_list == ["https://a.example", "https://b.example"]


def test_cors_origin_list_empty_string_gives_no_origins(monkeypatch):
    assert _make_settings(monkeypatch, CORS_ORIGINS="").cors_origin_list == []


# --- JWT helpers -------------------------------------------------------------------------------

def _b64(data: dict) -> str:
    data = {k: int(v.timestamp()) if isinstance(v, datetime) else v for k, v in data.items()}
    return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _encode(payload: dict, key=None, algorithm=None) -> str:
    return jwt.encode(payload, key or settings.SECRET_KEY, algorithm=algorithm or settings.ALGORITHM)


def _payload(sub="1", **extra) -> dict:
    now = datetime.now(timezone.utc)
    payload = {"sub": sub, "iat": now, "exp": now + timedelta(minutes=5)}
    payload.update(extra)
    return payload


def test_create_and_decode_roundtrip():
    payload = decode_access_token(create_access_token(subject=42))
    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["exp"] > payload["iat"]


def test_default_token_lifetime_follows_settings():
    payload = decode_access_token(create_access_token(subject=1))
    lifetime = payload["exp"] - payload["iat"]
    assert abs(lifetime - settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60) <= 2


def test_decode_returns_none_for_garbage():
    assert decode_access_token("not-a-jwt") is None
    assert decode_access_token("") is None


def test_expired_token_is_rejected(client, auth_headers):
    token = create_access_token(subject=1, expires_delta=timedelta(seconds=-10))
    assert decode_access_token(token) is None
    assert client.get(ME_URL, headers=_bearer(token)).status_code == 401


def test_token_signed_with_other_secret_is_rejected(client, auth_headers):
    token = _encode(_payload(), key="another-secret-key-with-more-than-32-characters")
    assert client.get(ME_URL, headers=_bearer(token)).status_code == 401


def test_tampered_payload_is_rejected(client, auth_headers):
    valid = auth_headers["Authorization"].split(" ", 1)[1]
    header, _payload_part, signature = valid.split(".")
    forged = f"{header}.{_b64(_payload(sub='999'))}.{signature}"
    assert client.get(ME_URL, headers=_bearer(forged)).status_code == 401


def test_tampered_signature_is_rejected(client, auth_headers):
    valid = auth_headers["Authorization"].split(" ", 1)[1]
    header, payload_part, signature = valid.split(".")
    flipped = ("A" if signature[0] != "A" else "B") + signature[1:]
    assert client.get(ME_URL, headers=_bearer(f"{header}.{payload_part}.{flipped}")).status_code == 401


def test_alg_none_token_is_rejected(client, auth_headers):
    token = f"{_b64({'alg': 'none', 'typ': 'JWT'})}.{_b64(_payload(sub='1'))}."
    assert decode_access_token(token) is None
    assert client.get(ME_URL, headers=_bearer(token)).status_code == 401


def test_token_with_different_hmac_algorithm_is_rejected(client, auth_headers):
    token = _encode(_payload(), algorithm="HS512")
    assert decode_access_token(token) is None
    assert client.get(ME_URL, headers=_bearer(token)).status_code == 401


def test_token_without_sub_is_rejected(client, auth_headers):
    payload = _payload()
    del payload["sub"]
    assert client.get(ME_URL, headers=_bearer(_encode(payload))).status_code == 401


@pytest.mark.parametrize("sub", ["abc", "1.5", ""])
def test_token_with_non_integer_sub_is_rejected(client, auth_headers, sub):
    assert client.get(ME_URL, headers=_bearer(_encode(_payload(sub=sub)))).status_code == 401


def test_token_for_unknown_household_is_rejected(client, auth_headers):
    assert client.get(ME_URL, headers=_bearer(create_access_token(subject=987654))).status_code == 401


# pins #56
def test_token_without_exp_is_currently_accepted(client, auth_headers):
    """Characterization: PyJWT does not require `exp` unless asked, so a validly signed token
    with no expiry is accepted. Pinned as current behavior (not an endorsement)."""
    household_id = client.get(ME_URL, headers=auth_headers).json()["id"]
    token = _encode({"sub": str(household_id)})
    assert client.get(ME_URL, headers=_bearer(token)).status_code == 200


def test_missing_and_malformed_authorization_headers(client, auth_headers):
    token = auth_headers["Authorization"].split(" ", 1)[1]
    assert client.get(ME_URL).status_code == 401
    assert client.get(ME_URL, headers={"Authorization": "Bearer "}).status_code == 401
    assert client.get(ME_URL, headers={"Authorization": f"Basic {token}"}).status_code == 401
    assert client.get(ME_URL, headers={"Authorization": token}).status_code == 401


def test_unauthorized_responses_carry_www_authenticate_header(client):
    res = client.get(ME_URL, headers=_bearer("garbage"))
    assert res.status_code == 401
    assert res.headers["www-authenticate"] == "Bearer"


def test_token_of_deleted_household_stops_working(client, auth_headers, db_session):
    from app.models.household import Household

    household_id = client.get(ME_URL, headers=auth_headers).json()["id"]
    db_session.query(Household).filter(Household.id == household_id).delete()
    db_session.commit()
    assert client.get(ME_URL, headers=auth_headers).status_code == 401
