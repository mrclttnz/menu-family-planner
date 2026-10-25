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
