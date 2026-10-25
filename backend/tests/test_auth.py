def test_register_success(client):
    res = client.post("/api/v1/auth/register", json={
        "name": "Famiglia Bianchi",
        "email": "bianchi@example.com",
        "password": "SecurePassword123!"
    })
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["household"]["name"] == "Famiglia Bianchi"
    assert data["household"]["email"] == "bianchi@example.com"


def test_register_duplicate_email(client):
    payload = {
        "name": "Famiglia Bianchi",
        "email": "duplicate@example.com",
        "password": "SecurePassword123!"
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409
    assert "already registered" in res2.json()["detail"]


def test_register_weak_password(client):
    res = client.post("/api/v1/auth/register", json={
        "name": "Famiglia Bianchi",
        "email": "weak@example.com",
        "password": "short"
    })
    assert res.status_code == 422


def test_login_success(client):
    client.post("/api/v1/auth/register", json={
        "name": "Famiglia Test",
        "email": "login@example.com",
        "password": "MySecretPassword123!"
    })

    res = client.post("/api/v1/auth/login", json={
        "email": "login@example.com",
        "password": "MySecretPassword123!"
    })
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_login_invalid_password(client):
    client.post("/api/v1/auth/register", json={
        "name": "Famiglia Test",
        "email": "badpass@example.com",
        "password": "MySecretPassword123!"
    })

    res = client.post("/api/v1/auth/login", json={
        "email": "badpass@example.com",
        "password": "WrongPassword!"
    })
    assert res.status_code == 401


def test_get_me(client, auth_headers):
    res = client.get("/api/v1/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Famiglia Rossi"
    assert res.json()["email"] == "rossi@example.com"


def test_get_me_unauthorized(client):
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401
