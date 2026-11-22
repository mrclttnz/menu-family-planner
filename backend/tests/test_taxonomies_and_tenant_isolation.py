"""S30 / TG-3 (taxonomies, tags) and tenant isolation on tags, notes and ratings endpoints (tests only)."""
from datetime import date

import pytest

TAX = "/api/v1/taxonomies"


@pytest.fixture
def other_headers(client, auth_headers):
    res = client.post("/api/v1/auth/register", json={"name": "Altri", "email": "altri@example.com", "password": "Password123!"})
    assert res.status_code == 201
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _status_id(client, headers, code="ok"):
    return next(s["id"] for s in client.get(f"{TAX}/statuses", headers=headers).json() if s["code"] == code)


def _course_id(client, headers, name="Primo"):
    return next(c["id"] for c in client.get(f"{TAX}/courses", headers=headers).json() if c["name"] == name)


def _create_dish(client, headers, title="Pasta", **extra):
    res = client.post("/api/v1/dishes", headers=headers, json={
        "title": title, "status_id": _status_id(client, headers), "course_ids": [_course_id(client, headers)], **extra})
    assert res.status_code == 201, res.text
    return res.json()


# --- course types / source types ------------------------------------------------------------------------

def test_meal_types_are_global_and_ordered(client):
    res = client.get(f"{TAX}/meal-types")  # no auth required
    assert res.status_code == 200
    orders = [m["default_sort_order"] for m in res.json()]
    assert orders == sorted(orders) and {"lunch", "dinner"} <= {m["code"] for m in res.json()}


@pytest.mark.parametrize("name", ["Primo", "primo", "PRIMO"])
def test_course_cannot_duplicate_a_global_default_case_insensitively(client, auth_headers, name):
    assert client.post(f"{TAX}/courses", headers=auth_headers, json={"name": name}).status_code == 409


def test_custom_course_is_created_listed_and_flagged_custom(client, auth_headers):
    res = client.post(f"{TAX}/courses", headers=auth_headers, json={"name": "  Finger food  ", "sort_order": 9})
    assert res.status_code == 201
    assert res.json()["name"] == "Finger food" and res.json()["is_custom"] is True
    listed = client.get(f"{TAX}/courses", headers=auth_headers).json()
    assert next(c for c in listed if c["name"] == "Finger food")["is_custom"] is True
    assert next(c for c in listed if c["name"] == "Primo")["is_custom"] is False
    assert client.post(f"{TAX}/courses", headers=auth_headers, json={"name": "finger FOOD"}).status_code == 409


def test_course_and_source_create_validate_payload(client, auth_headers):
    assert client.post(f"{TAX}/courses", headers=auth_headers, json={"name": ""}).status_code == 422
    assert client.post(f"{TAX}/courses", headers=auth_headers, json={"name": "x" * 51}).status_code == 422
    assert client.post(f"{TAX}/courses", headers=auth_headers, json={"name": "ok", "bogus": 1}).status_code == 422
    assert client.post(f"{TAX}/sources", headers=auth_headers, json={"name": ""}).status_code == 422
    assert client.post(f"{TAX}/sources", headers=auth_headers, json={"name": "x", "bogus": 1}).status_code == 422


def test_whitespace_only_course_name_is_currently_accepted_as_empty_name(client, auth_headers):
    """Characterization / FINDING: min_length=1 passes for '   ' and the router strips it afterwards, so a
    course with an empty name is created. Logged as a separate issue, not fixed here."""
    res = client.post(f"{TAX}/courses", headers=auth_headers, json={"name": "   "})
    assert res.status_code == 201
    assert res.json()["name"] == ""


def test_source_type_create_defaults_icon_and_rejects_duplicates(client, auth_headers):
    res = client.post(f"{TAX}/sources", headers=auth_headers, json={"name": "Podcast"})
    assert res.status_code == 201 and res.json()["icon"] == "book" and res.json()["is_custom"] is True
    assert client.post(f"{TAX}/sources", headers=auth_headers, json={"name": "podcast"}).status_code == 409
    assert client.post(f"{TAX}/sources", headers=auth_headers, json={"name": "Sito Web"}).status_code == 409


def test_custom_taxonomies_are_isolated_between_households(client, auth_headers, other_headers):
    client.post(f"{TAX}/courses", headers=auth_headers, json={"name": "Privato"})
    client.post(f"{TAX}/sources", headers=auth_headers, json={"name": "Privata"})
    assert "Privato" not in [c["name"] for c in client.get(f"{TAX}/courses", headers=other_headers).json()]
    assert "Privata" not in [s["name"] for s in client.get(f"{TAX}/sources", headers=other_headers).json()]
    # the same name is free in the other household
    assert client.post(f"{TAX}/courses", headers=other_headers, json={"name": "Privato"}).status_code == 201


def test_household_cannot_use_another_households_custom_course_or_source_on_a_dish(client, auth_headers, other_headers):
    course = client.post(f"{TAX}/courses", headers=auth_headers, json={"name": "Privato"}).json()
    source = client.post(f"{TAX}/sources", headers=auth_headers, json={"name": "Privata"}).json()
    base = {"title": "Pasta", "status_id": _status_id(client, other_headers)}
    res = client.post("/api/v1/dishes", headers=other_headers, json={**base, "course_ids": [course["id"]]})
    assert res.status_code == 400
    res = client.post("/api/v1/dishes", headers=other_headers,
                      json={**base, "course_ids": [_course_id(client, other_headers)], "source_type_id": source["id"]})
    assert res.status_code == 400


def test_taxonomy_endpoints_require_authentication(client):
    for path in ("statuses", "courses", "sources", "tags"):
        assert client.get(f"{TAX}/{path}").status_code == 401


# --- dish statuses -----------------------------------------------------------------------------------------------

def test_each_household_gets_the_five_default_statuses_with_one_default(client, auth_headers, other_headers):
    for headers in (auth_headers, other_headers):
        statuses = client.get(f"{TAX}/statuses", headers=headers).json()
        assert [s["code"] for s in statuses] == ["to_try", "ok", "discarded", "retry_with_changes", "favorite"]
        assert [s["code"] for s in statuses if s["is_default"]] == ["ok"]
    ids = {s["id"] for s in client.get(f"{TAX}/statuses", headers=auth_headers).json()}
    assert ids.isdisjoint(s["id"] for s in client.get(f"{TAX}/statuses", headers=other_headers).json())


def test_status_customization_and_reset(client, auth_headers):
    sid = _status_id(client, auth_headers, "to_try")
    res = client.put(f"{TAX}/statuses/{sid}", headers=auth_headers, json={"custom_label": "  Test  ", "color": " #123456 ", "is_active": False})
    assert res.status_code == 200
    assert (res.json()["name"], res.json()["custom_label"], res.json()["color"], res.json()["is_active"]) == ("Test", "Test", "#123456", False)
    res = client.put(f"{TAX}/statuses/{sid}", headers=auth_headers, json={"custom_label": ""})
    assert res.json()["custom_label"] is None and res.json()["name"] == "Da provare"
    assert client.put(f"{TAX}/statuses/{sid}", headers=auth_headers, json={"bogus": 1}).status_code == 422


def test_cannot_update_another_households_status(client, auth_headers, other_headers):
    sid = _status_id(client, auth_headers)
    assert client.put(f"{TAX}/statuses/{sid}", headers=other_headers, json={"custom_label": "hack"}).status_code == 404
    assert client.put(f"{TAX}/statuses/99999", headers=auth_headers, json={"custom_label": "x"}).status_code == 404
    assert next(s for s in client.get(f"{TAX}/statuses", headers=auth_headers).json() if s["id"] == sid)["custom_label"] is None


def test_dish_cannot_use_another_households_status(client, auth_headers, other_headers):
    res = client.post("/api/v1/dishes", headers=other_headers, json={
        "title": "Pasta", "status_id": _status_id(client, auth_headers), "course_ids": [_course_id(client, other_headers)]})
    assert res.status_code == 400


# --- tags --------------------------------------------------------------------------------------------------------

def test_tag_crud_roundtrip(client, auth_headers):
    created = client.post(f"{TAX}/tags", headers=auth_headers, json={"name": "  Veloce  "})
    assert created.status_code == 201
    assert created.json()["name"] == "Veloce" and created.json()["color"] == "#16a34a"
    tag_id = created.json()["id"]

    updated = client.put(f"{TAX}/tags/{tag_id}", headers=auth_headers, json={"name": "Rapido", "color": "#000000"})
    assert (updated.json()["name"], updated.json()["color"]) == ("Rapido", "#000000")
    assert [t["name"] for t in client.get(f"{TAX}/tags", headers=auth_headers).json()] == ["Rapido"]
    assert client.delete(f"{TAX}/tags/{tag_id}", headers=auth_headers).status_code == 204
    assert client.get(f"{TAX}/tags", headers=auth_headers).json() == []


def test_tags_are_listed_alphabetically(client, auth_headers):
    for name in ("Zeta", "alfa", "Beta"):
        client.post(f"{TAX}/tags", headers=auth_headers, json={"name": name})
    names = [t["name"] for t in client.get(f"{TAX}/tags", headers=auth_headers).json()]
    assert names == sorted(names)


@pytest.mark.parametrize("payload", [
    {"name": "a,b"}, {"name": ""}, {"name": "   "}, {"name": "x" * 51}, {"name": "ok", "bogus": 1},
])
def test_tag_create_rejects_invalid_names(client, auth_headers, payload):
    assert client.post(f"{TAX}/tags", headers=auth_headers, json=payload).status_code == 422


def test_tag_names_are_unique_per_household_case_insensitively(client, auth_headers, other_headers):
    client.post(f"{TAX}/tags", headers=auth_headers, json={"name": "Veloce"})
    assert client.post(f"{TAX}/tags", headers=auth_headers, json={"name": "VELOCE"}).status_code == 409
    assert client.post(f"{TAX}/tags", headers=other_headers, json={"name": "Veloce"}).status_code == 201


def test_tag_rename_conflicts_and_self_rename(client, auth_headers):
    a = client.post(f"{TAX}/tags", headers=auth_headers, json={"name": "Alfa"}).json()
    client.post(f"{TAX}/tags", headers=auth_headers, json={"name": "Beta"})
    assert client.put(f"{TAX}/tags/{a['id']}", headers=auth_headers, json={"name": "beta"}).status_code == 409
    # changing only the casing of its own name is allowed
    res = client.put(f"{TAX}/tags/{a['id']}", headers=auth_headers, json={"name": "ALFA"})
    assert res.status_code == 200 and res.json()["name"] == "ALFA"
    # an empty update body changes nothing
    assert client.put(f"{TAX}/tags/{a['id']}", headers=auth_headers, json={}).json()["name"] == "ALFA"


def test_deleting_an_in_use_tag_detaches_it_but_keeps_the_dish(client, auth_headers):
    dish = _create_dish(client, auth_headers, tags=[{"name": "Veloce"}, {"name": "Light"}])
    tag_id = next(t["id"] for t in dish["tags"] if t["name"] == "Veloce")

    assert client.delete(f"{TAX}/tags/{tag_id}", headers=auth_headers).status_code == 204

    fetched = client.get(f"/api/v1/dishes/{dish['id']}", headers=auth_headers).json()
    assert [t["name"] for t in fetched["tags"]] == ["Light"]
    assert client.get(f"{TAX}/tags", headers=auth_headers).json()[0]["name"] == "Light"


def test_deleting_an_unknown_tag_is_404(client, auth_headers):
    assert client.delete(f"{TAX}/tags/424242", headers=auth_headers).status_code == 404


def test_cannot_read_update_or_delete_another_households_tag(client, auth_headers, other_headers):
    tag = client.post(f"{TAX}/tags", headers=auth_headers, json={"name": "Privato"}).json()
    assert client.get(f"{TAX}/tags", headers=other_headers).json() == []
    assert client.put(f"{TAX}/tags/{tag['id']}", headers=other_headers, json={"name": "Hack"}).status_code == 404
    assert client.delete(f"{TAX}/tags/{tag['id']}", headers=other_headers).status_code == 404
    assert client.get(f"{TAX}/tags", headers=auth_headers).json()[0]["name"] == "Privato"


def test_dish_tags_by_name_never_attach_another_households_tag(client, auth_headers, other_headers):
    mine = client.post(f"{TAX}/tags", headers=auth_headers, json={"name": "Veloce", "color": "#111111"}).json()
    dish = _create_dish(client, other_headers, tags=[{"name": "veloce"}])
    theirs = dish["tags"][0]
    assert theirs["id"] != mine["id"]
    assert client.get(f"{TAX}/tags", headers=auth_headers).json()[0]["color"] == "#111111"


# --- tenant isolation: meal slot notes and ratings ---------------------------------------------------------------------

@pytest.fixture
def planned_meal(client, auth_headers):
    member = client.post("/api/v1/members", headers=auth_headers, json={"name": "Anna"}).json()
    dish = _create_dish(client, auth_headers)
    day = date.today().isoformat()
    slots = client.get(f"/api/v1/calendar?start_date={day}&end_date={day}", headers=auth_headers).json()
    slot_id = slots[0]["id"]
    res = client.post(f"/api/v1/calendar/slots/{slot_id}/dishes", headers=auth_headers, json={"dish_id": dish["id"]})
    assert res.status_code == 200
    note = client.post(f"/api/v1/calendar/slots/{slot_id}/dishes/{dish['id']}/notes", headers=auth_headers, json={"note": "Ottimo"})
    assert note.status_code == 200
    rating = client.post(f"/api/v1/calendar/slots/{slot_id}/dishes/{dish['id']}/ratings", headers=auth_headers,
                         json={"member_id": member["id"], "rating": "thumbs_up"})
    assert rating.status_code == 200
    note_id = rating.json()["dishes"][0]["notes_list"][0]["id"]
    return {"slot": slot_id, "dish": dish["id"], "member": member["id"], "note": note_id, "day": day}


def _slot_dish(client, headers, planned):
    slots = client.get(f"/api/v1/calendar?start_date={planned['day']}&end_date={planned['day']}", headers=headers).json()
    return next(s for s in slots if s["id"] == planned["slot"])["dishes"][0]


def test_other_household_cannot_touch_notes_or_ratings_of_my_slot(client, auth_headers, other_headers, planned_meal):
    p = planned_meal
    base = f"/api/v1/calendar/slots/{p['slot']}/dishes/{p['dish']}"
    assert client.post(f"{base}/notes", headers=other_headers, json={"note": "intruso"}).status_code == 404
    assert client.delete(f"{base}/notes/{p['note']}", headers=other_headers).status_code == 404
    assert client.post(f"{base}/ratings", headers=other_headers, json={"member_id": p["member"], "rating": "thumbs_down"}).status_code == 404
    assert client.delete(f"{base}/ratings/{p['member']}", headers=other_headers).status_code == 404
    assert client.patch(f"/api/v1/calendar/slots/{p['slot']}/notes", headers=other_headers, json={"notes": "x"}).status_code == 404
    assert client.delete(f"/api/v1/calendar/slots/{p['slot']}", headers=other_headers).status_code == 404

    entry = _slot_dish(client, auth_headers, p)
    assert [n["note"] for n in entry["notes_list"]] == ["Ottimo"]
    assert [r["rating"] for r in entry["ratings"]] == ["thumbs_up"]


def test_rating_with_a_member_of_another_household_is_404(client, auth_headers, other_headers, planned_meal):
    p = planned_meal
    foreign_member = client.post("/api/v1/members", headers=other_headers, json={"name": "Estraneo"}).json()
    res = client.post(f"/api/v1/calendar/slots/{p['slot']}/dishes/{p['dish']}/ratings", headers=auth_headers,
                      json={"member_id": foreign_member["id"], "rating": "thumbs_up"})
    assert res.status_code == 404


def test_cannot_assign_another_households_dish_to_my_slot(client, auth_headers, other_headers, planned_meal):
    foreign_dish = _create_dish(client, other_headers, title="Estranea")
    res = client.post(f"/api/v1/calendar/slots/{planned_meal['slot']}/dishes", headers=auth_headers, json={"dish_id": foreign_dish["id"]})
    assert res.status_code == 404


def test_dish_note_history_is_scoped_to_the_household(client, auth_headers, other_headers, planned_meal):
    p = planned_meal
    assert [n["note"] for n in client.get(f"/api/v1/dishes/{p['dish']}/notes", headers=auth_headers).json()] == ["Ottimo"]
    assert client.get(f"/api/v1/dishes/{p['dish']}/notes", headers=other_headers).status_code == 404


def test_other_household_cannot_read_modify_or_delete_my_dish_member_or_calendar(client, auth_headers, other_headers, planned_meal):
    p = planned_meal
    assert client.get(f"/api/v1/dishes/{p['dish']}", headers=other_headers).status_code == 404
    assert client.put(f"/api/v1/dishes/{p['dish']}", headers=other_headers, json={"title": "Hack"}).status_code == 404
    assert client.delete(f"/api/v1/dishes/{p['dish']}", headers=other_headers).status_code == 404
    assert client.put(f"/api/v1/dishes/{p['dish']}/preferences/{p['member']}", headers=other_headers, json={"rating": "dislike"}).status_code == 404
    assert client.get(f"/api/v1/members/{p['member']}", headers=other_headers).status_code == 404
    assert client.delete(f"/api/v1/members/{p['member']}", headers=other_headers).status_code == 404
    assert client.put(f"/api/v1/attendance/{p['slot']}/members/{p['member']}", headers=other_headers, json={"is_attending": False}).status_code == 404
    assert client.get(f"/api/v1/calendar?start_date={p['day']}&end_date={p['day']}", headers=other_headers).json()[0]["id"] != p["slot"]
    assert client.get(f"/api/v1/dishes/{p['dish']}", headers=auth_headers).status_code == 200


def test_missing_slot_dish_pairs_are_404_for_the_owner(client, auth_headers, planned_meal):
    p = planned_meal
    other_dish = _create_dish(client, auth_headers, title="Non pianificato")
    base = f"/api/v1/calendar/slots/{p['slot']}/dishes/{other_dish['id']}"
    assert client.post(f"{base}/notes", headers=auth_headers, json={"note": "x"}).status_code == 404
    assert client.post(f"{base}/ratings", headers=auth_headers, json={"member_id": p["member"], "rating": "neutral"}).status_code == 404
    assert client.post("/api/v1/calendar/slots/999999/dishes", headers=auth_headers, json={"dish_id": other_dish["id"]}).status_code == 404


def test_rating_values_are_validated_and_upserted(client, auth_headers, planned_meal):
    p = planned_meal
    url = f"/api/v1/calendar/slots/{p['slot']}/dishes/{p['dish']}/ratings"
    assert client.post(url, headers=auth_headers, json={"member_id": p["member"], "rating": "amazing"}).status_code == 422
    client.post(url, headers=auth_headers, json={"member_id": p["member"], "rating": "thumbs_down"})
    assert [r["rating"] for r in _slot_dish(client, auth_headers, p)["ratings"]] == ["thumbs_down"]  # replaced, not duplicated
    assert client.delete(f"{url}/{p['member']}", headers=auth_headers).status_code == 200
    assert _slot_dish(client, auth_headers, p)["ratings"] == []


def test_deleting_a_missing_note_is_a_silent_noop(client, auth_headers, planned_meal):
    p = planned_meal
    res = client.delete(f"/api/v1/calendar/slots/{p['slot']}/dishes/{p['dish']}/notes/999999", headers=auth_headers)
    assert res.status_code == 200
    assert len(_slot_dish(client, auth_headers, p)["notes_list"]) == 1
