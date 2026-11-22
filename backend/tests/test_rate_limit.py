import pytest

from app.core.config import settings
from app.core.rate_limit import auth_limiter, resolve_client_ip

LOGIN = "/api/v1/auth/login"
REGISTER = "/api/v1/auth/register"
BAD_LOGIN = {"email": "nobody@example.com", "password": "WrongPassword1!"}


@pytest.fixture(autouse=True)
def _limits(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_MINUTE", 3)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", "")
    auth_limiter.reset()
    yield
    auth_limiter.reset()


def test_login_blocked_after_threshold_with_retry_after(client):
    for _ in range(3):
        assert client.post(LOGIN, json=BAD_LOGIN).status_code == 401
    res = client.post(LOGIN, json=BAD_LOGIN)
    assert res.status_code == 429
    assert 1 <= int(res.headers["Retry-After"]) <= 60
    assert "Too many requests" in res.json()["detail"]


def test_register_blocked_after_threshold(client):
    for i in range(3):
        res = client.post(REGISTER, json={
            "name": f"Famiglia {i}", "email": f"f{i}@example.com", "password": "Password123!"})
        assert res.status_code == 201
    res = client.post(REGISTER, json={
        "name": "Famiglia X", "email": "fx@example.com", "password": "Password123!"})
    assert res.status_code == 429
    assert "Retry-After" in res.headers


def test_generic_401_message_unchanged(client):
    res = client.post(LOGIN, json=BAD_LOGIN)
    assert res.status_code == 401
    assert res.json()["detail"] == "Incorrect email or password."


def test_window_reset_allows_requests_again(client, monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(auth_limiter, "_now", lambda: now[0])
    for _ in range(3):
        client.post(LOGIN, json=BAD_LOGIN)
    assert client.post(LOGIN, json=BAD_LOGIN).status_code == 429
    now[0] += 61
    assert client.post(LOGIN, json=BAD_LOGIN).status_code == 401


def test_forwarded_header_ignored_when_proxy_untrusted(client):
    # Attacker rotates a spoofed header: must NOT get a fresh bucket each time.
    for i in range(3):
        client.post(LOGIN, json=BAD_LOGIN, headers={"CF-Connecting-IP": f"1.1.1.{i}"})
    res = client.post(LOGIN, json=BAD_LOGIN, headers={"CF-Connecting-IP": "9.9.9.9"})
    assert res.status_code == 429


def test_different_clients_are_independent_behind_trusted_proxy(client, monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", "172.18.0.0/16")
    # `client` fixture already installed the DB override on the app.
    with TestClient(app, client=("172.18.0.3", 50000)) as proxied:
        for _ in range(3):
            proxied.post(LOGIN, json=BAD_LOGIN, headers={"CF-Connecting-IP": "1.1.1.1"})
        assert proxied.post(LOGIN, json=BAD_LOGIN, headers={"CF-Connecting-IP": "1.1.1.1"}).status_code == 429
        assert proxied.post(LOGIN, json=BAD_LOGIN, headers={"CF-Connecting-IP": "2.2.2.2"}).status_code == 401


def test_login_and_register_have_separate_buckets(client):
    for _ in range(3):
        client.post(LOGIN, json=BAD_LOGIN)
    res = client.post(REGISTER, json={
        "name": "Famiglia Y", "email": "fy@example.com", "password": "Password123!"})
    assert res.status_code == 201


def test_disabled_flag_turns_limiter_off(client, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_ENABLED", False)
    for _ in range(10):
        assert client.post(LOGIN, json=BAD_LOGIN).status_code == 401


@pytest.mark.parametrize("peer,trusted,headers,expected", [
    ("10.0.0.5", "", {"CF-Connecting-IP": "1.2.3.4"}, "10.0.0.5"),
    ("172.18.0.3", "172.18.0.0/16", {"CF-Connecting-IP": "1.2.3.4"}, "1.2.3.4"),
    ("172.18.0.3", "172.18.0.0/16", {"X-Forwarded-For": "6.6.6.6, 1.2.3.4"}, "1.2.3.4"),
    ("172.18.0.3", "172.18.0.0/16", {"CF-Connecting-IP": "not-an-ip"}, "172.18.0.3"),
    ("172.18.0.3", "172.18.0.0/16", {}, "172.18.0.3"),
    ("192.168.1.9", "172.18.0.0/16", {"CF-Connecting-IP": "1.2.3.4"}, "192.168.1.9"),
])
def test_resolve_client_ip(peer, trusted, headers, expected):
    assert resolve_client_ip(peer, headers, trusted) == expected


def test_ipv4_mapped_peer_matches_ipv4_trusted_cidr():
    assert resolve_client_ip("::ffff:172.18.0.3", {"CF-Connecting-IP": "1.2.3.4"}, "172.18.0.0/16") == "1.2.3.4"
    assert resolve_client_ip("::ffff:1.2.3.4", {}, "") == "1.2.3.4"


def test_gateway_peer_not_trusted_when_only_proxy_32_is_trusted():
    # LAN client NATed to the bridge gateway must not be able to choose its bucket.
    assert resolve_client_ip("172.18.0.1", {"CF-Connecting-IP": "9.9.9.9"}, "172.18.0.2/32") == "172.18.0.1"
    assert resolve_client_ip("172.18.0.2", {"CF-Connecting-IP": "9.9.9.9"}, "172.18.0.2/32") == "9.9.9.9"


def test_ipv6_clients_share_bucket_per_64():
    from app.core.rate_limit import limiter_key
    assert limiter_key("2001:db8:1:2::1") == limiter_key("2001:db8:1:2:ffff::9")
    assert limiter_key("2001:db8:1:3::1") != limiter_key("2001:db8:1:2::1")
    assert limiter_key("1.2.3.4") == "1.2.3.4"


def test_tracked_keys_are_hard_capped(monkeypatch):
    import app.core.rate_limit as rl
    monkeypatch.setattr(rl, "_MAX_TRACKED_KEYS", 50)
    for i in range(500):
        auth_limiter.hit(f"k{i}", 5)
    assert len(auth_limiter._hits) <= 50


def test_non_positive_limit_is_rejected_by_settings():
    from app.core.config import Settings
    with pytest.raises(ValueError):
        Settings(AUTH_RATE_LIMIT_PER_MINUTE=0)
