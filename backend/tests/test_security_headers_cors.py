import pytest

from app.core.config import settings


@pytest.fixture
def origin():
    # CORSMiddleware was built at import time from settings.cors_origin_list;
    # use whatever origin it was configured with.
    assert settings.cors_origin_list, "no CORS origin configured"
    return settings.cors_origin_list[0]


def _preflight(client, origin, method, headers):
    return client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": headers,
        },
    )


@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "PATCH", "DELETE"])
def test_preflight_allows_api_methods(client, origin, method):
    res = _preflight(client, origin, method, "Authorization, Content-Type")
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == origin


def test_preflight_rejects_unlisted_method(client, origin):
    res = _preflight(client, origin, "TRACE", "Content-Type")
    assert res.status_code == 400


def test_preflight_rejects_unlisted_header(client, origin):
    res = _preflight(client, origin, "POST", "X-Custom-Evil")
    assert res.status_code == 400


def test_hsts_absent_in_development(client, monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    assert "strict-transport-security" not in client.get("/health").headers


def test_hsts_present_in_production(client, monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    res = client.get("/health")
    assert res.headers["strict-transport-security"] == "max-age=31536000; includeSubDomains"


def test_default_secret_key_rejected_in_production_any_case(monkeypatch):
    from app.core.config import Settings

    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "Production")
    with pytest.raises(ValueError, match="not allowed in production"):
        Settings(_env_file=None)
