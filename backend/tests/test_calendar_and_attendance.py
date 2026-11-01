from datetime import date, timedelta


def test_default_calendar_and_exception_based_attendance(client, auth_headers):
    # 1. Add 3 family members
    client.post("/api/v1/members", headers=auth_headers, json={"name": "Papà"})
    client.post("/api/v1/members", headers=auth_headers, json={"name": "Mamma"})
    client.post("/api/v1/members", headers=auth_headers, json={"name": "Leo", "is_child": True})

    today = date.today()
    start_str = today.isoformat()
    end_str = (today + timedelta(days=2)).isoformat()

    # 2. Get calendar slots
    res_cal = client.get(f"/api/v1/calendar?start_date={start_str}&end_date={end_str}", headers=auth_headers)
    assert res_cal.status_code == 200
    slots = res_cal.json()
    # 3 days * 2 default slots (Pranzo and Cena) = 6 slots
    assert len(slots) == 6

    # Verify all members are PRESENT by default (attendee_count == 3, absent_member_ids == [])
    for slot in slots:
        assert slot["attendee_count"] == 3
        assert slot["absent_member_ids"] == []

    # 3. Get attendance matrix
    res_att = client.get(f"/api/v1/attendance?start_date={start_str}&end_date={end_str}", headers=auth_headers)
    assert res_att.status_code == 200
    att_matrix = res_att.json()
    assert len(att_matrix) == 6
    for meal in att_matrix:
        assert meal["attendee_count"] == 3
        # All members marked is_attending: True by default
        assert all(m["is_attending"] is True for m in meal["members"])


def test_custom_slot_brunch_and_delete_lunch(client, auth_headers):
    client.post("/api/v1/members", headers=auth_headers, json={"name": "Marco"})

    today_str = date.today().isoformat()

    # Initial view of the calendar creates default Pranzo and Cena
    client.get(f"/api/v1/calendar?start_date={today_str}&end_date={today_str}", headers=auth_headers)

    # Get meal types to find brunch ID
    res_mt = client.get("/api/v1/taxonomies/meal-types", headers=auth_headers)
    brunch = next(m for m in res_mt.json() if m["code"] == "brunch")

    # Add Brunch slot for today
    res_add = client.post("/api/v1/calendar/slots", headers=auth_headers, json={
        "date": today_str,
        "meal_type_id": brunch["id"],
        "notes": "Brunch speciale della domenica"
    })
    assert res_add.status_code == 201
    assert res_add.json()["meal_type"]["code"] == "brunch"

    # Get slots for today
    res_slots = client.get(f"/api/v1/calendar?start_date={today_str}&end_date={today_str}", headers=auth_headers)
    slots = res_slots.json()
    # Now we have Brunch, Pranzo, Cena
    codes = [s["meal_type"]["code"] for s in slots]
    assert "brunch" in codes
    assert "lunch" in codes
    assert "dinner" in codes

    # Delete Lunch slot
    lunch_slot = next(s for s in slots if s["meal_type"]["code"] == "lunch")
    res_del = client.delete(f"/api/v1/calendar/slots/{lunch_slot['id']}", headers=auth_headers)
    assert res_del.status_code == 204

    # Verify today only has Brunch and Dinner
    res_after = client.get(f"/api/v1/calendar?start_date={today_str}&end_date={today_str}", headers=auth_headers)
    codes_after = [s["meal_type"]["code"] for s in res_after.json()]
    assert "brunch" in codes_after
    assert "dinner" in codes_after
    assert "lunch" not in codes_after


def test_smart_compatibility_alert_and_absence_clearance(client, auth_headers):
    """
    Core business scenario:
    1. Dish disliked by Leo.
    2. When Leo is present (default) -> WARNING displayed!
    3. When Leo is marked AWAY (exception recorded) -> WARNING disappears (via libera for parents)!
    4. When all present love the dish -> HIT badge displayed!
    """
    # 1. Add members: Papà, Mamma, Leo
    m_papa = client.post("/api/v1/members", headers=auth_headers, json={"name": "Papà"}).json()
    m_mamma = client.post("/api/v1/members", headers=auth_headers, json={"name": "Mamma"}).json()
    m_leo = client.post("/api/v1/members", headers=auth_headers, json={"name": "Leo", "is_child": True}).json()

    # 2. Add dish: "Pasta piccante con olive"
    res_statuses = client.get("/api/v1/taxonomies/statuses", headers=auth_headers)
    status_id = res_statuses.json()[0]["id"]
    res_courses = client.get("/api/v1/taxonomies/courses", headers=auth_headers)
    course_id = res_courses.json()[0]["id"]

    dish = client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Pasta piccante con olive",
        "status_id": status_id,
        "course_ids": [course_id]
    }).json()
    dish_id = dish["id"]

    # 3. Set preferences: Leo dislikes it, Papà & Mamma love it
    client.put(f"/api/v1/dishes/{dish_id}/preferences/{m_leo['id']}", headers=auth_headers, json={"rating": "dislike"})
    client.put(f"/api/v1/dishes/{dish_id}/preferences/{m_mamma['id']}", headers=auth_headers, json={"rating": "favorite"})
    client.put(f"/api/v1/dishes/{dish_id}/preferences/{m_papa['id']}", headers=auth_headers, json={"rating": "favorite"})

    # 4. Get today's dinner slot
    today_str = date.today().isoformat()
    res_slots = client.get(f"/api/v1/calendar?start_date={today_str}&end_date={today_str}", headers=auth_headers)
    dinner_slot = next(s for s in res_slots.json() if s["meal_type"]["code"] == "dinner")

    # 5. Assign dish to dinner slot
    res_assign = client.post(f"/api/v1/calendar/slots/{dinner_slot['id']}/dishes", headers=auth_headers, json={
        "dish_id": dish_id,
        "sort_order": 1
    })
    assert res_assign.status_code == 200
    slot_data = res_assign.json()
    dish_assign = slot_data["dishes"][0]

    # Verify conflict warning: Leo is present and dislikes it!
    comp = dish_assign["compatibility"]
    assert comp["status"] == "warning"
    assert comp["is_conflict"] is True
    assert "Leo" in comp["message"]
    assert comp["attendee_count"] == 3

    # 6. Now record Leo as ABSENT for dinner (exception-based toggle)
    res_toggle = client.put(
        f"/api/v1/attendance/{dinner_slot['id']}/members/{m_leo['id']}",
        headers=auth_headers,
        json={"is_attending": False}
    )
    assert res_toggle.status_code == 200
    assert res_toggle.json()["attendee_count"] == 2

    # 7. Re-query calendar: now Leo is away, and both Papà & Mamma LOVE the dish!
    res_slots_after = client.get(f"/api/v1/calendar?start_date={today_str}&end_date={today_str}", headers=auth_headers)
    dinner_after = next(s for s in res_slots_after.json() if s["meal_type"]["code"] == "dinner")
    comp_after = dinner_after["dishes"][0]["compatibility"]

    # The warning MUST BE GONE! It is now a HIT (loved by all 2 attending members)!
    assert comp_after["status"] == "hit"
    assert comp_after["is_conflict"] is False
    assert comp_after["attendee_count"] == 2
    assert "amato da tutti" in comp_after["message"]

    # 8. Restore Leo to Present (clear absence)
    client.put(
        f"/api/v1/attendance/{dinner_slot['id']}/members/{m_leo['id']}",
        headers=auth_headers,
        json={"is_attending": True}
    )
    res_slots_restored = client.get(f"/api/v1/calendar?start_date={today_str}&end_date={today_str}", headers=auth_headers)
    dinner_restored = next(s for s in res_slots_restored.json() if s["meal_type"]["code"] == "dinner")
    assert dinner_restored["dishes"][0]["compatibility"]["status"] == "warning"


def test_attendance_date_range_validation(client, auth_headers):
    today = date.today()
    start_str = today.isoformat()
    # 35 days in future -> exceeds 31-day ceiling
    too_far = (today + timedelta(days=35)).isoformat()

    res = client.get(f"/api/v1/attendance?start_date={start_str}&end_date={too_far}", headers=auth_headers)
    assert res.status_code == 400
    assert "31 days" in res.json()["detail"]


def test_alternative_dishes_targeted_compatibility(client, auth_headers):
    """
    P002: A meal has alternative dishes for different diners.
    Dish A is disliked by Leo, but assigned ONLY to Papà and Mamma.
    Leo is present, but NO warning is shown for Dish A because Leo is not assigned to it!
    """
    # 1. Members
    m_papa = client.post("/api/v1/members", headers=auth_headers, json={"name": "Papà"}).json()
    m_mamma = client.post("/api/v1/members", headers=auth_headers, json={"name": "Mamma"}).json()
    m_leo = client.post("/api/v1/members", headers=auth_headers, json={"name": "Leo"}).json()

    # 2. Dishes
    res_statuses = client.get("/api/v1/taxonomies/statuses", headers=auth_headers)
    status_id = res_statuses.json()[0]["id"]
    res_courses = client.get("/api/v1/taxonomies/courses", headers=auth_headers)
    course_id = res_courses.json()[0]["id"]

    dish_risotto = client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Risotto ai funghi",
        "status_id": status_id,
        "course_ids": [course_id]
    }).json()

    dish_pasta = client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Pasta al pomodoro",
        "status_id": status_id,
        "course_ids": [course_id]
    }).json()

    # Preferences: Leo dislikes Risotto, likes Pasta; Parents love Risotto
    client.put(f"/api/v1/dishes/{dish_risotto['id']}/preferences/{m_leo['id']}", headers=auth_headers, json={"rating": "dislike"})
    client.put(f"/api/v1/dishes/{dish_risotto['id']}/preferences/{m_mamma['id']}", headers=auth_headers, json={"rating": "favorite"})
    client.put(f"/api/v1/dishes/{dish_risotto['id']}/preferences/{m_papa['id']}", headers=auth_headers, json={"rating": "favorite"})

    # Today's lunch slot
    today_str = date.today().isoformat()
    res_slots = client.get(f"/api/v1/calendar?start_date={today_str}&end_date={today_str}", headers=auth_headers)
    lunch_slot = next(s for s in res_slots.json() if s["meal_type"]["code"] == "lunch")

    # Assign Risotto targeted only to Papà and Mamma (alternative dish)
    res_assign_1 = client.post(f"/api/v1/calendar/slots/{lunch_slot['id']}/dishes", headers=auth_headers, json={
        "dish_id": dish_risotto["id"],
        "assigned_member_ids": [m_papa["id"], m_mamma["id"]]
    })
    assert res_assign_1.status_code == 200
    slot_data = res_assign_1.json()
    risotto_assign = next(d for d in slot_data["dishes"] if d["dish_id"] == dish_risotto["id"])

    # Risotto should NOT show warning, even though Leo is present, because Leo is not assigned to it!
    assert risotto_assign["compatibility"]["status"] == "hit"
    assert risotto_assign["compatibility"]["is_conflict"] is False
    assert risotto_assign["assigned_member_ids"] == [m_papa["id"], m_mamma["id"]]

    # Assign Pasta targeted to Leo
    res_assign_2 = client.post(f"/api/v1/calendar/slots/{lunch_slot['id']}/dishes", headers=auth_headers, json={
        "dish_id": dish_pasta["id"],
        "assigned_member_ids": [m_leo["id"]]
    })
    assert res_assign_2.status_code == 200
    slot_data_2 = res_assign_2.json()
    pasta_assign = next(d for d in slot_data_2["dishes"] if d["dish_id"] == dish_pasta["id"])
    assert pasta_assign["compatibility"]["is_conflict"] is False
    assert pasta_assign["assigned_member_ids"] == [m_leo["id"]]


def test_slot_dish_ratings_and_independence_from_dish_preferences(client, auth_headers):
    # J002: Distinct ratings per meal consumption without altering dish catalog preferences
    # J003: Ratings are optional and start unrated (empty)
    m_leo = client.post("/api/v1/members", headers=auth_headers, json={"name": "Leo"}).json()
    res_statuses = client.get("/api/v1/taxonomies/statuses", headers=auth_headers)
    status_id = res_statuses.json()[0]["id"]
    res_courses = client.get("/api/v1/taxonomies/courses", headers=auth_headers)
    course_id = res_courses.json()[0]["id"]

    dish = client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Pasta al pomodoro",
        "status_id": status_id,
        "course_ids": [course_id]
    }).json()

    # Leo's catalog preference is favorite
    client.put(f"/api/v1/dishes/{dish['id']}/preferences/{m_leo['id']}", headers=auth_headers, json={"rating": "favorite"})

    # Schedule dish in today's lunch slot
    today_str = date.today().isoformat()
    res_slots = client.get(f"/api/v1/calendar?start_date={today_str}&end_date={today_str}", headers=auth_headers)
    lunch_slot = next(s for s in res_slots.json() if s["meal_type"]["code"] == "lunch")

    res_assign = client.post(f"/api/v1/calendar/slots/{lunch_slot['id']}/dishes", headers=auth_headers, json={
        "dish_id": dish["id"]
    })
    assert res_assign.status_code == 200
    slot_dish = res_assign.json()["dishes"][0]
    # J003: Initially no meal ratings have been cast
    assert slot_dish["ratings"] == []

    # Leo disliked this specific meal (e.g. overcooked pasta) -> post thumbs_down rating
    res_rate = client.post(
        f"/api/v1/calendar/slots/{lunch_slot['id']}/dishes/{dish['id']}/ratings",
        headers=auth_headers,
        json={"member_id": m_leo["id"], "rating": "thumbs_down"}
    )
    assert res_rate.status_code == 200
    updated_dish = res_rate.json()["dishes"][0]
    assert len(updated_dish["ratings"]) == 1
    assert updated_dish["ratings"][0]["member_id"] == m_leo["id"]
    assert updated_dish["ratings"][0]["rating"] == "thumbs_down"

    # J002: Catalog preference for Leo is STILL favorite!
    res_dish = client.get(f"/api/v1/dishes/{dish['id']}", headers=auth_headers)
    leo_pref = next(p for p in res_dish.json()["preferences"] if p["member_id"] == m_leo["id"])
    assert leo_pref["rating"] == "favorite"

    # J003: Toggle off rating -> delete rating
    res_del_rate = client.delete(
        f"/api/v1/calendar/slots/{lunch_slot['id']}/dishes/{dish['id']}/ratings/{m_leo['id']}",
        headers=auth_headers
    )
    assert res_del_rate.status_code == 200
    assert res_del_rate.json()["dishes"][0]["ratings"] == []


def test_delete_slots_by_meal_type_p009(client, auth_headers):
    """P009: Test bulk deletion of empty slots for a meal type in a week range."""
    # 1. Get meal types
    res_mt = client.get("/api/v1/taxonomies/meal-types", headers=auth_headers)
    brunch = next(mt for mt in res_mt.json() if mt["code"] == "brunch")

    # 2. Add brunch slots to today and tomorrow
    today = date.today()
    tomorrow = today + timedelta(days=1)
    client.post("/api/v1/calendar/slots", headers=auth_headers, json={
        "date": today.isoformat(),
        "meal_type_id": brunch["id"]
    })
    client.post("/api/v1/calendar/slots", headers=auth_headers, json={
        "date": tomorrow.isoformat(),
        "meal_type_id": brunch["id"]
    })

    # Verify brunch is present
    res = client.get(f"/api/v1/calendar?start_date={today.isoformat()}&end_date={tomorrow.isoformat()}", headers=auth_headers)
    brunch_slots = [s for s in res.json() if s["meal_type"]["id"] == brunch["id"]]
    assert len(brunch_slots) == 2

    # 3. Delete brunch meal type for this date range
    del_res = client.delete(
        f"/api/v1/calendar/slots/by-meal-type?meal_type_id={brunch['id']}&start_date={today.isoformat()}&end_date={tomorrow.isoformat()}",
        headers=auth_headers
    )
    assert del_res.status_code == 204

    # Verify brunch slots are gone
    res_after = client.get(f"/api/v1/calendar?start_date={today.isoformat()}&end_date={tomorrow.isoformat()}", headers=auth_headers)
    brunch_slots_after = [s for s in res_after.json() if s["meal_type"]["id"] == brunch["id"]]
    assert len(brunch_slots_after) == 0


def test_meal_slot_notes_p010(client, auth_headers):
    """P010: Test creating, updating, and clearing a note for a meal slot."""
    today = date.today().isoformat()
    # 1. Get calendar slot (creates default slots)
    res_cal = client.get(f"/api/v1/calendar?start_date={today}&end_date={today}", headers=auth_headers)
    assert res_cal.status_code == 200
    slots = res_cal.json()
    assert len(slots) >= 1
    slot_id = slots[0]["id"]
    assert slots[0]["notes"] is None

    # 2. Set note: "Pranzo dalla nonna"
    res_patch = client.patch(
        f"/api/v1/calendar/slots/{slot_id}/notes",
        headers=auth_headers,
        json={"notes": "Pranzo dalla nonna"}
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["notes"] == "Pranzo dalla nonna"

    # 3. Update note
    res_update = client.patch(
        f"/api/v1/calendar/slots/{slot_id}/notes",
        headers=auth_headers,
        json={"notes": "Pranzo fuori al ristorante"}
    )
    assert res_update.status_code == 200
    assert res_update.json()["notes"] == "Pranzo fuori al ristorante"

    # 4. Clear note by passing empty string or null
    res_clear = client.patch(
        f"/api/v1/calendar/slots/{slot_id}/notes",
        headers=auth_headers,
        json={"notes": "   "}
    )
    assert res_clear.status_code == 200
    assert res_clear.json()["notes"] is None

    # 5. Clear note by passing null
    client.patch(
        f"/api/v1/calendar/slots/{slot_id}/notes",
        headers=auth_headers,
        json={"notes": "Altra nota"}
    )
    res_null = client.patch(
        f"/api/v1/calendar/slots/{slot_id}/notes",
        headers=auth_headers,
        json={"notes": None}
    )
    assert res_null.status_code == 200
    assert res_null.json()["notes"] is None


