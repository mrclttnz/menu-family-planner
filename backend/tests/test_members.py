def test_create_and_list_members(client, auth_headers):
    # Add member
    res = client.post("/api/v1/members", headers=auth_headers, json={
        "name": "Marco",
        "avatar_color": "#10B981",
        "is_child": False
    })
    assert res.status_code == 201
    member = res.json()
    assert member["name"] == "Marco"
    assert member["avatar_color"] == "#10B981"
    assert member["is_child"] is False

    # Add second member (child)
    res2 = client.post("/api/v1/members", headers=auth_headers, json={
        "name": "Leo",
        "avatar_color": "#F59E0B",
        "is_child": True
    })
    assert res2.status_code == 201

    # List members
    res_list = client.get("/api/v1/members", headers=auth_headers)
    assert res_list.status_code == 200
    names = [m["name"] for m in res_list.json()]
    assert "Leo" in names
    assert "Marco" in names


def test_create_duplicate_member_name_fails(client, auth_headers):
    client.post("/api/v1/members", headers=auth_headers, json={"name": "Giulia"})
    # Attempt duplicate
    res = client.post("/api/v1/members", headers=auth_headers, json={"name": "Giulia"})
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"]


def test_update_member(client, auth_headers):
    res_create = client.post("/api/v1/members", headers=auth_headers, json={"name": "Sofia"})
    member_id = res_create.json()["id"]

    res_update = client.put(f"/api/v1/members/{member_id}", headers=auth_headers, json={
        "name": "Sofia Maria",
        "is_child": True
    })
    assert res_update.status_code == 200
    assert res_update.json()["name"] == "Sofia Maria"
    assert res_update.json()["is_child"] is True


def test_delete_member(client, auth_headers):
    res_create = client.post("/api/v1/members", headers=auth_headers, json={"name": "Temp"})
    member_id = res_create.json()["id"]

    res_del = client.delete(f"/api/v1/members/{member_id}", headers=auth_headers)
    assert res_del.status_code == 204

    # Verify not found
    res_get = client.get(f"/api/v1/members/{member_id}", headers=auth_headers)
    assert res_get.status_code == 404


def test_tenant_isolation_members(client, auth_headers):
    """Ensure Household B cannot access Household A's members (Anti-IDOR)."""
    # Create member in Household A
    res_a = client.post("/api/v1/members", headers=auth_headers, json={"name": "Member A"})
    member_id = res_a.json()["id"]

    # Register Household B
    res_b = client.post("/api/v1/auth/register", json={
        "name": "Famiglia B",
        "email": "household_b@example.com",
        "password": "PasswordForHouseholdB123!"
    })
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Household B attempts to read Household A's member
    res_idor_get = client.get(f"/api/v1/members/{member_id}", headers=headers_b)
    assert res_idor_get.status_code == 404

    # Household B attempts to delete Household A's member
    res_idor_del = client.delete(f"/api/v1/members/{member_id}", headers=headers_b)
    assert res_idor_del.status_code == 404
