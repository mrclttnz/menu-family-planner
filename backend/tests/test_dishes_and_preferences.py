def test_taxonomies(client, auth_headers):
    # Meal types
    res_meals = client.get("/api/v1/taxonomies/meal-types", headers=auth_headers)
    assert res_meals.status_code == 200
    meal_codes = [m["code"] for m in res_meals.json()]
    assert "lunch" in meal_codes
    assert "dinner" in meal_codes
    assert "brunch" in meal_codes

    # Statuses
    res_statuses = client.get("/api/v1/taxonomies/statuses", headers=auth_headers)
    assert res_statuses.status_code == 200
    status_codes = [s["code"] for s in res_statuses.json()]
    assert "to_try" in status_codes
    assert "favorite" in status_codes

    # Courses
    res_courses = client.get("/api/v1/taxonomies/courses", headers=auth_headers)
    assert res_courses.status_code == 200
    course_names = [c["name"] for c in res_courses.json()]
    assert "Primo" in course_names
    assert "Secondo" in course_names
    assert "Piatto unico" in course_names

    # Add custom course
    res_add_course = client.post("/api/v1/taxonomies/courses", headers=auth_headers, json={"name": "Aperitivo Sfizioso"})
    assert res_add_course.status_code == 201
    assert res_add_course.json()["is_custom"] is True


def test_create_dish_with_multi_courses_and_preferences(client, auth_headers):
    # 1. Add 2 members
    res_m1 = client.post("/api/v1/members", headers=auth_headers, json={"name": "Papà", "is_child": False})
    m1_id = res_m1.json()["id"]

    res_m2 = client.post("/api/v1/members", headers=auth_headers, json={"name": "Leo", "is_child": True})
    m2_id = res_m2.json()["id"]

    # 2. Get status id for 'to_try' and course ids for 'Primo' and 'Piatto unico'
    res_statuses = client.get("/api/v1/taxonomies/statuses", headers=auth_headers)
    to_try_status = next(s for s in res_statuses.json() if s["code"] == "to_try")

    res_courses = client.get("/api/v1/taxonomies/courses", headers=auth_headers)
    primo = next(c for c in res_courses.json() if c["name"] == "Primo")
    piatto_unico = next(c for c in res_courses.json() if c["name"] == "Piatto unico")

    # 3. Create dish
    res_dish = client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Pasta al forno con verdure",
        "description": "Piatto ricco e gustoso",
        "status_id": to_try_status["id"],
        "course_ids": [primo["id"], piatto_unico["id"]],
        "source_reference": "La Cucina di Casa p. 45",
        "source_url": "https://example.com/pasta-al-forno"
    })
    assert res_dish.status_code == 201
    dish = res_dish.json()
    assert dish["title"] == "Pasta al forno con verdure"
    assert len(dish["courses"]) == 2
    assert dish["source"]["source_reference"] == "La Cucina di Casa p. 45"
    assert dish["source"]["source_url"] == "https://example.com/pasta-al-forno"

    # Verify unstated preferences default to 'neutral'
    pref_dict = {p["member_id"]: p["rating"] for p in dish["preferences"]}
    assert pref_dict[m1_id] == "neutral"
    assert pref_dict[m2_id] == "neutral"

    # 4. Set Member Preferences
    dish_id = dish["id"]
    # Papa loves it
    res_p1 = client.put(f"/api/v1/dishes/{dish_id}/preferences/{m1_id}", headers=auth_headers, json={"rating": "favorite"})
    assert res_p1.status_code == 200

    # Leo dislikes it
    res_p2 = client.put(f"/api/v1/dishes/{dish_id}/preferences/{m2_id}", headers=auth_headers, json={"rating": "dislike"})
    assert res_p2.status_code == 200

    # 5. Fetch dish and verify preferences updated
    res_dish_after = client.get(f"/api/v1/dishes/{dish_id}", headers=auth_headers)
    pref_dict_after = {p["member_id"]: p["rating"] for p in res_dish_after.json()["preferences"]}
    assert pref_dict_after[m1_id] == "favorite"
    assert pref_dict_after[m2_id] == "dislike"


def test_dish_tenant_isolation(client, auth_headers):
    # Create dish in Household A
    res_statuses = client.get("/api/v1/taxonomies/statuses", headers=auth_headers)
    status_id = res_statuses.json()[0]["id"]
    res_courses = client.get("/api/v1/taxonomies/courses", headers=auth_headers)
    course_id = res_courses.json()[0]["id"]

    res_dish = client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Risotto ai funghi",
        "status_id": status_id,
        "course_ids": [course_id]
    })
    dish_id = res_dish.json()["id"]

    # Register Household B
    res_b = client.post("/api/v1/auth/register", json={
        "name": "Famiglia B",
        "email": "household_b_dish@example.com",
        "password": "PasswordForHouseholdB123!"
    })
    headers_b = {"Authorization": f"Bearer {res_b.json()['access_token']}"}

    # Household B should NOT see Household A's dish
    res_get = client.get(f"/api/v1/dishes/{dish_id}", headers=headers_b)
    assert res_get.status_code == 404

    # Household B should NOT be able to delete Household A's dish
    res_del = client.delete(f"/api/v1/dishes/{dish_id}", headers=headers_b)
    assert res_del.status_code == 404


def test_update_dish_validates_courses(client, auth_headers):
    res_statuses = client.get("/api/v1/taxonomies/statuses", headers=auth_headers)
    status_id = res_statuses.json()[0]["id"]
    res_courses = client.get("/api/v1/taxonomies/courses", headers=auth_headers)
    course_id = res_courses.json()[0]["id"]

    res_dish = client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Zuppa di legumi",
        "status_id": status_id,
        "course_ids": [course_id]
    })
    dish_id = res_dish.json()["id"]

    # Attempt to update with non-existent course ID (99999)
    res_bad = client.put(f"/api/v1/dishes/{dish_id}", headers=auth_headers, json={
        "course_ids": [99999]
    })
    assert res_bad.status_code == 400
    assert "invalid" in res_bad.json()["detail"].lower()


def test_default_status_ok_flag(client, auth_headers):
    """D001: verify status 'ok' has is_default = True"""
    res = client.get("/api/v1/taxonomies/statuses", headers=auth_headers)
    assert res.status_code == 200
    statuses = res.json()
    ok_status = next(s for s in statuses if s["code"] == "ok")
    assert ok_status["is_default"] is True
    # The others should be False
    other_statuses = [s for s in statuses if s["code"] != "ok"]
    assert all(s["is_default"] is False for s in other_statuses)


def test_optional_source_type_dish_creation(client, auth_headers):
    """D002: verify dish can be created without source_type_id"""
    res_statuses = client.get("/api/v1/taxonomies/statuses", headers=auth_headers)
    status_id = res_statuses.json()[0]["id"]
    res_courses = client.get("/api/v1/taxonomies/courses", headers=auth_headers)
    course_id = res_courses.json()[0]["id"]

    res = client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Frittata semplice",
        "status_id": status_id,
        "course_ids": [course_id],
        "source_type_id": None
    })
    assert res.status_code == 201
    data = res.json()
    assert data["source"]["source_type_id"] is None


def test_slot_dish_multiple_notes_and_history(client, auth_headers):
    """J001: verify multiple optional notes for dish consumption and history by date"""
    # Create dish
    res_statuses = client.get("/api/v1/taxonomies/statuses", headers=auth_headers)
    status_id = res_statuses.json()[0]["id"]
    res_courses = client.get("/api/v1/taxonomies/courses", headers=auth_headers)
    course_id = res_courses.json()[0]["id"]

    res_dish = client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Risotto ai carciofi",
        "status_id": status_id,
        "course_ids": [course_id]
    })
    dish_id = res_dish.json()["id"]

    # Get calendar slot
    res_cal = client.get("/api/v1/calendar?start_date=2026-11-01&end_date=2026-11-02", headers=auth_headers)
    slot_id = res_cal.json()[0]["id"]

    # Assign dish
    client.post(f"/api/v1/calendar/slots/{slot_id}/dishes", headers=auth_headers, json={"dish_id": dish_id})

    # Add Note 1
    res_n1 = client.post(
        f"/api/v1/calendar/slots/{slot_id}/dishes/{dish_id}/notes",
        headers=auth_headers,
        json={"note": "Cottura perfetta al dente"}
    )
    assert res_n1.status_code == 200
    slot_data = res_n1.json()
    dish_slot = next(d for d in slot_data["dishes"] if d["dish_id"] == dish_id)
    assert len(dish_slot["notes_list"]) == 1
    assert dish_slot["notes_list"][0]["note"] == "Cottura perfetta al dente"
    assert dish_slot["notes_list"][0]["meal_date"] == "2026-11-01"

    # Add Note 2
    res_n2 = client.post(
        f"/api/v1/calendar/slots/{slot_id}/dishes/{dish_id}/notes",
        headers=auth_headers,
        json={"note": "Piaciuto tantissimo a tutti"}
    )
    dish_slot = next(d for d in res_n2.json()["dishes"] if d["dish_id"] == dish_id)
    assert len(dish_slot["notes_list"]) == 2

    # Query dish history
    res_history = client.get(f"/api/v1/dishes/{dish_id}/notes", headers=auth_headers)
    assert res_history.status_code == 200
    history = res_history.json()
    assert len(history) == 2
    assert history[0]["meal_date"] == "2026-11-01"


def test_tags_taxonomy_crud_and_validation(client, auth_headers):
    # 1. Create a tag with default color
    res_create = client.post("/api/v1/taxonomies/tags", headers=auth_headers, json={"name": "Veloce"})
    assert res_create.status_code == 201
    tag1 = res_create.json()
    assert tag1["name"] == "Veloce"
    assert tag1["color"] == "#16a34a"

    # 2. Create another tag with custom hex color
    res_create2 = client.post("/api/v1/taxonomies/tags", headers=auth_headers, json={"name": "Vegetariano", "color": "#0284c7"})
    assert res_create2.status_code == 201
    tag2 = res_create2.json()
    assert tag2["name"] == "Vegetariano"
    assert tag2["color"] == "#0284c7"

    # 3. Duplicate tag name should return 409 Conflict
    res_dup = client.post("/api/v1/taxonomies/tags", headers=auth_headers, json={"name": "veloce"})
    assert res_dup.status_code == 409

    # 4. Reject tag name containing comma
    res_comma = client.post("/api/v1/taxonomies/tags", headers=auth_headers, json={"name": "salva,cena"})
    assert res_comma.status_code == 422

    # 5. List tags
    res_list = client.get("/api/v1/taxonomies/tags", headers=auth_headers)
    assert res_list.status_code == 200
    names = [t["name"] for t in res_list.json()]
    assert "Vegetariano" in names
    assert "Veloce" in names

    # 6. Update tag color
    res_update = client.put(f"/api/v1/taxonomies/tags/{tag1['id']}", headers=auth_headers, json={"color": "#db2777"})
    assert res_update.status_code == 200
    assert res_update.json()["color"] == "#db2777"

    # 7. Delete tag
    res_del = client.delete(f"/api/v1/taxonomies/tags/{tag2['id']}", headers=auth_headers)
    assert res_del.status_code == 204


def test_dishes_with_tags_and_filtering_and_search(client, auth_headers):
    res_statuses = client.get("/api/v1/taxonomies/statuses", headers=auth_headers)
    status_id = res_statuses.json()[0]["id"]
    res_courses = client.get("/api/v1/taxonomies/courses", headers=auth_headers)
    course_id = res_courses.json()[0]["id"]

    # Reject tag with comma in dish creation
    res_bad = client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Invalid Tag Dish",
        "status_id": status_id,
        "course_ids": [course_id],
        "tags": [{"name": "veloce, sano"}]
    })
    assert res_bad.status_code == 422

    # Dish 1: Tag A (Veloce) and Tag B (Invernale)
    res_d1 = client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Minestrone caldo",
        "status_id": status_id,
        "course_ids": [course_id],
        "tags": [
            {"name": "Veloce", "color": "#16a34a"},
            {"name": "Invernale", "color": "#2563eb"}
        ]
    })
    assert res_d1.status_code == 201
    d1 = res_d1.json()
    assert len(d1["tags"]) == 2
    tag_veloce = next(t for t in d1["tags"] if t["name"] == "Veloce")
    tag_invernale = next(t for t in d1["tags"] if t["name"] == "Invernale")

    # Dish 2: Tag A only (Veloce)
    res_d2 = client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Insalata di riso",
        "status_id": status_id,
        "course_ids": [course_id],
        "tags": [{"name": "Veloce"}]
    })
    assert res_d2.status_code == 201

    # Dish 3: Tag B only (Invernale)
    res_d3 = client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Polenta e funghi",
        "status_id": status_id,
        "course_ids": [course_id],
        "tags": [{"name": "Invernale"}]
    })
    assert res_d3.status_code == 201

    # 1. Filter by Tag A (Veloce) -> Dish 1 and Dish 2
    res_f1 = client.get(f"/api/v1/dishes?tag_id={tag_veloce['id']}", headers=auth_headers)
    titles_f1 = [d["title"] for d in res_f1.json()]
    assert "Minestrone caldo" in titles_f1
    assert "Insalata di riso" in titles_f1
    assert "Polenta e funghi" not in titles_f1

    # 2. Filter by Tag A AND Tag B -> ONLY Dish 1
    res_fand = client.get(
        f"/api/v1/dishes?tag_id={tag_veloce['id']}&tag_id={tag_invernale['id']}",
        headers=auth_headers
    )
    titles_fand = [d["title"] for d in res_fand.json()]
    assert "Minestrone caldo" in titles_fand
    assert "Insalata di riso" not in titles_fand
    assert "Polenta e funghi" not in titles_fand

    # 3. Search matching tag name
    res_search = client.get("/api/v1/dishes?search=Invernale", headers=auth_headers)
    titles_search = [d["title"] for d in res_search.json()]
    assert "Minestrone caldo" in titles_search
    assert "Polenta e funghi" in titles_search
    assert "Insalata di riso" not in titles_search

    # 4. Update Dish 2 to also have Tag B
    res_upd = client.put(f"/api/v1/dishes/{res_d2.json()['id']}", headers=auth_headers, json={
        "tags": [{"name": "Veloce"}, {"name": "Invernale"}]
    })
    assert res_upd.status_code == 200
    assert len(res_upd.json()["tags"]) == 2

