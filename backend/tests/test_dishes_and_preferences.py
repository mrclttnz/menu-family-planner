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
