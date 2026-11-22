"""S30 / TG-3: characterization of dish import/export edge cases (tests only).

Tests named `*_currently_*` pin behavior that looks questionable; each one is referenced from the S30
findings in docs/TEST_PLAN.md and must not be "fixed" here.
"""
import csv
import io
import json

import openpyxl
import pytest

from app.services.dishes_import_export import MAX_FILE_SIZE

IMPORT = "/api/v1/dishes/import"
HEADER = "title,description,notes,status,source_type,courses,tags,source_reference,source_url\n"


def _import(client, headers, content, filename="dishes.csv", mode="skip", content_type="text/csv"):
    if isinstance(content, str):
        content = content.encode("utf-8")
    return client.post(IMPORT, headers=headers, files={"file": (filename, content, content_type)}, data={"mode": mode})


def _dishes(client, headers):
    return client.get("/api/v1/dishes", headers=headers).json()


def _xlsx_bytes(rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def _register_second_household(client):
    res = client.post("/api/v1/auth/register", json={"name": "Altri", "email": "altri@example.com", "password": "Password123!"})
    assert res.status_code == 201
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


# --- request level -------------------------------------------------------------------------------

def test_import_requires_authentication(client):
    res = client.post(IMPORT, files={"file": ("a.csv", b"x", "text/csv")})
    assert res.status_code == 401


def test_import_without_file_is_422(client, auth_headers):
    assert client.post(IMPORT, headers=auth_headers, data={"mode": "skip"}).status_code == 422


def test_import_with_invalid_mode_is_400(client, auth_headers):
    res = _import(client, auth_headers, HEADER, mode="overwrite")
    assert res.status_code == 400


def test_import_without_mode_defaults_to_skip(client, auth_headers):
    row = '"Pasta","","","OK","","Primo","","",""\n'
    _import(client, auth_headers, HEADER + row)
    res = client.post(IMPORT, headers=auth_headers, files={"file": ("d.csv", (HEADER + row).encode(), "text/csv")})
    assert res.status_code == 200
    assert res.json()["skipped"] == 1 and res.json()["created"] == 0


# --- empty / malformed files -------------------------------------------------------------------------

@pytest.mark.parametrize("filename,expected", [
    ("empty.csv", "vuoto"),
    ("empty.xlsx", "Impossibile leggere il file Excel"),
    ("empty.json", "Impossibile leggere il file JSON"),
])
def test_empty_file_reports_a_parse_error_without_creating_anything(client, auth_headers, filename, expected):
    res = _import(client, auth_headers, b"", filename=filename)
    assert res.status_code == 200
    body = res.json()
    assert body["total_rows"] == 0 and body["created"] == 0
    assert body["errors"][0]["row"] == 0
    assert expected in body["errors"][0]["error"]
    assert _dishes(client, auth_headers) == []


def test_header_only_csv_imports_nothing_without_errors(client, auth_headers):
    body = _import(client, auth_headers, HEADER).json()
    assert body == {"total_rows": 0, "created": 0, "updated": 0, "skipped": 0, "errors": []}


def test_malformed_xlsx_reports_error(client, auth_headers):
    body = _import(client, auth_headers, b"this is not a zip archive", filename="broken.xlsx").json()
    assert body["created"] == 0
    assert "Impossibile leggere il file Excel" in body["errors"][0]["error"]


def test_malformed_json_reports_error(client, auth_headers):
    body = _import(client, auth_headers, '[{"title": "x",', filename="broken.json").json()
    assert body["created"] == 0
    assert "Impossibile leggere il file JSON" in body["errors"][0]["error"]


@pytest.mark.parametrize("payload,message", [
    ('"just a string"', "array di piatti"),
    ("42", "array di piatti"),
    ('{"foo": []}', "array di piatti o una chiave 'dishes'"),
    ('{"dishes": "nope"}', "array di piatti o una chiave 'dishes'"),
])
def test_json_with_unsupported_top_level_shape_reports_error(client, auth_headers, payload, message):
    body = _import(client, auth_headers, payload, filename="x.json").json()
    assert body["created"] == 0
    assert message in body["errors"][0]["error"]


def test_json_accepts_dishes_and_items_wrapper_keys_and_skips_non_object_items(client, auth_headers):
    dish = {"title": "Zuppa", "status": "OK", "courses": ["Primo"]}
    wrapped = json.dumps({"dishes": [dish, "junk", 7, None]})
    body = _import(client, auth_headers, wrapped, filename="w.json").json()
    assert body["created"] == 1 and body["errors"] == []

    other = json.dumps({"items": [{"title": "Frittata", "status": "OK", "courses": "Secondo"}]})
    assert _import(client, auth_headers, other, filename="i.json").json()["created"] == 1


def test_json_row_numbers_are_item_indexes_unlike_csv_which_count_the_header(client, auth_headers):
    """Characterization: JSON errors are numbered from 1 (item index); CSV/XLSX from 2 (spreadsheet row)."""
    items = json.dumps([{"title": "", "status": "OK", "courses": ["Primo"]}])
    assert _import(client, auth_headers, items, filename="r.json").json()["errors"][0]["row"] == 1
    csv_body = HEADER + '"","","","OK","","Primo","","",""\n'
    assert _import(client, auth_headers, csv_body).json()["errors"][0]["row"] == 2


# --- extension / content-type handling ---------------------------------------------------------------

@pytest.mark.parametrize("filename,content_type", [("dishes.txt", "text/plain"), ("dishes.pdf", "application/pdf"), ("noext", "")])
def test_unknown_extension_is_currently_parsed_as_csv_regardless_of_content_type(client, auth_headers, filename, content_type):
    body = _import(client, auth_headers, HEADER + '"Minestrone","","","OK","","Primo","","",""\n',
                   filename=filename, content_type=content_type or "application/octet-stream").json()
    assert body["created"] == 1


def test_extension_is_matched_case_insensitively(client, auth_headers):
    xlsx = _xlsx_bytes([["title", "status", "courses"], ["Gnocchi", "OK", "Primo"]])
    assert _import(client, auth_headers, xlsx, filename="DISHES.XLSX").json()["created"] == 1


def test_binary_content_named_csv_creates_nothing(client, auth_headers):
    body = _import(client, auth_headers, _xlsx_bytes([["title"], ["x"]]), filename="fake.csv").json()
    assert body["created"] == 0


# --- size limit ---------------------------------------------------------------------------------------

def test_file_over_max_size_is_rejected_with_row_zero_error(client, auth_headers):
    big = b"a" * (MAX_FILE_SIZE + 1)
    body = _import(client, auth_headers, big).json()
    assert body["total_rows"] == 0 and body["created"] == 0
    assert len(body["errors"]) == 1
    assert body["errors"][0]["row"] == 0 and "5 MB" in body["errors"][0]["error"]


def test_file_of_exactly_max_size_is_still_parsed(client, auth_headers):
    row = '"Pasta","","","OK","","Primo","","",""\n'
    padding = MAX_FILE_SIZE - len((HEADER + row).encode())
    content = HEADER + row + "\n" * padding  # trailing blank lines are ignored by the parser
    assert len(content.encode()) == MAX_FILE_SIZE
    body = _import(client, auth_headers, content).json()
    assert body["created"] == 1


# --- encodings, delimiters, headers ------------------------------------------------------------------

def test_utf8_bom_csv_is_supported(client, auth_headers):
    content = ("﻿" + HEADER + '"Crème brûlée","","","OK","","Dolce","","",""\n').encode("utf-8")
    assert _import(client, auth_headers, content).json()["created"] == 1
    assert _dishes(client, auth_headers)[0]["title"] == "Crème brûlée"


def test_semicolon_delimited_csv_is_currently_not_supported(client, auth_headers):
    """Characterization: Italian Excel exports use ';' but the parser only splits on ','. The whole header
    collapses into a single unknown column, so every row fails the mandatory 'title' check."""
    content = "title;description;notes;status;source_type;courses\nPasta;;;OK;;Primo\n"
    body = _import(client, auth_headers, content).json()
    assert body["created"] == 0
    assert body["total_rows"] == 1
    assert "obbligatorio" in body["errors"][0]["error"]


def test_italian_headers_are_currently_not_recognized(client, auth_headers):
    content = "titolo,descrizione,stato,portate\nPasta,Buona,OK,Primo\n"
    body = _import(client, auth_headers, content).json()
    assert body["created"] == 0
    assert "obbligatorio" in body["errors"][0]["error"]


def test_header_aliases_case_spaces_and_dashes_are_normalized(client, auth_headers):
    content = "Name,Desc,Note,Status,Source,Course,Reference,URL\nPasta,Buona,Al dente,OK,Famiglia,Primo,Nonna,example.org/p\n"
    assert _import(client, auth_headers, content).json()["created"] == 1
    dish = _dishes(client, auth_headers)[0]
    assert dish["title"] == "Pasta" and dish["description"] == "Buona" and dish["notes"] == "Al dente"
    assert dish["source"]["source_reference"] == "Nonna"
    assert dish["source"]["source_url"] == "https://example.org/p"  # scheme added when missing


def test_unknown_columns_are_ignored(client, auth_headers):
    content = "title,status,courses,calories\nPasta,OK,Primo,500\n"
    assert _import(client, auth_headers, content).json()["created"] == 1


def test_rows_shorter_than_header_and_blank_rows_are_tolerated(client, auth_headers):
    content = "title,status,courses,notes\nPasta,OK,Primo\n,,,\n\nRiso,OK,Primo,x\n"
    body = _import(client, auth_headers, content).json()
    assert body["created"] == 2 and body["errors"] == []
    assert body["total_rows"] == 2  # blank rows are not counted


def test_xlsx_import_with_numeric_cells_and_header_aliases(client, auth_headers):
    xlsx = _xlsx_bytes([["Title", "Status", "Courses", "Notes"], [2024, "OK", "Primo", 3.5]])
    assert _import(client, auth_headers, xlsx, filename="n.xlsx").json()["created"] == 1
    dish = _dishes(client, auth_headers)[0]
    assert dish["title"] == "2024" and dish["notes"] == "3.5"


def test_courses_accepted_in_json_array_brackets_parentheses_and_plain_forms(client, auth_headers):
    rows = [
        ("A", '"[""Primo"", ""Secondo""]"'),
        ("B", '"Primo, Secondo"'),
        ("C", '"(Primo, Dolce)"'),
        ("D", '"[\'Primo\']"'),
    ]
    content = "title,status,courses\n" + "\n".join(f"{t},OK,{c}" for t, c in rows) + "\n"
    body = _import(client, auth_headers, content).json()
    assert body["created"] == 4 and body["errors"] == []
    by_title = {d["title"]: sorted(c["name"] for c in d["courses"]) for d in _dishes(client, auth_headers)}
    assert by_title == {"A": ["Primo", "Secondo"], "B": ["Primo", "Secondo"], "C": ["Dolce", "Primo"], "D": ["Primo"]}


def test_empty_courses_brackets_is_a_row_error(client, auth_headers):
    content = 'title,status,courses\nPasta,OK,[]\n'
    body = _import(client, auth_headers, content).json()
    assert body["created"] == 0 and "portata" in body["errors"][0]["error"]


# --- unknown lookup values -----------------------------------------------------------------------------

def test_status_can_be_matched_by_code_by_name_and_by_custom_label(client, auth_headers):
    statuses = client.get("/api/v1/taxonomies/statuses", headers=auth_headers).json()
    to_try = next(s for s in statuses if s["code"] == "to_try")
    client.put(f"/api/v1/taxonomies/statuses/{to_try['id']}", headers=auth_headers, json={"custom_label": "Sperimentale"})
    content = "title,status,courses\nA,to_try,Primo\nB,DA PROVARE,Primo\nC,sperimentale,Primo\nD,favorite,Primo\n"
    body = _import(client, auth_headers, content).json()
    assert body["created"] == 4, body["errors"]


def test_unknown_course_is_currently_auto_created_as_a_household_course(client, auth_headers):
    """Characterization: a typo in 'courses' silently creates a new custom course type."""
    body = _import(client, auth_headers, "title,status,courses\nPasta,OK,Piattino\n").json()
    assert body["created"] == 1 and body["errors"] == []
    courses = client.get("/api/v1/taxonomies/courses", headers=auth_headers).json()
    created = next(c for c in courses if c["name"] == "Piattino")
    assert created["is_custom"] is True


def test_unknown_source_type_is_currently_auto_created_as_a_household_source(client, auth_headers):
    _import(client, auth_headers, "title,status,courses,source_type\nPasta,OK,Primo,Rivista di cucina\n")
    sources = client.get("/api/v1/taxonomies/sources", headers=auth_headers).json()
    created = next(s for s in sources if s["name"] == "Rivista di cucina")
    assert created["is_custom"] is True and created["icon"] == "book"


def test_course_and_source_matching_is_case_insensitive_and_reuses_existing_records(client, auth_headers):
    before = len(client.get("/api/v1/taxonomies/courses", headers=auth_headers).json())
    _import(client, auth_headers, "title,status,courses,source_type\nPasta,OK,PRIMO,famiglia\n")
    assert len(client.get("/api/v1/taxonomies/courses", headers=auth_headers).json()) == before


def test_row_without_status_is_an_error(client, auth_headers):
    body = _import(client, auth_headers, "title,status,courses\nPasta,,Primo\n").json()
    assert body["created"] == 0 and "'status' è obbligatorio" in body["errors"][0]["error"]


# --- long values -----------------------------------------------------------------------------------------

def test_title_over_200_chars_is_currently_accepted_on_sqlite(client, auth_headers):
    """Characterization / FINDING: the import path does not enforce the 200-char title limit that
    POST /dishes enforces (and `dishes.title` is VARCHAR(200)). SQLite ignores the length; PostgreSQL would
    raise at commit and the whole import would 500. Logged as a separate issue, not fixed here."""
    long_title = "T" * 300
    body = _import(client, auth_headers, f"title,status,courses\n{long_title},OK,Primo\n").json()
    assert body["created"] == 1
    assert _dishes(client, auth_headers)[0]["title"] == long_title


def test_create_dish_api_does_enforce_title_limit(client, auth_headers):
    status_id = client.get("/api/v1/taxonomies/statuses", headers=auth_headers).json()[0]["id"]
    course_id = client.get("/api/v1/taxonomies/courses", headers=auth_headers).json()[0]["id"]
    res = client.post("/api/v1/dishes", headers=auth_headers,
                      json={"title": "T" * 201, "status_id": status_id, "course_ids": [course_id]})
    assert res.status_code == 422


def test_long_description_and_notes_are_stored_in_full(client, auth_headers):
    text = "lorem " * 5000
    content = f'title,status,courses,description,notes\nPasta,OK,Primo,"{text}","{text}"\n'
    assert _import(client, auth_headers, content).json()["created"] == 1
    dish = _dishes(client, auth_headers)[0]
    assert dish["description"] == text.strip() and dish["notes"] == text.strip()


def test_imported_tag_longer_than_50_chars_is_truncated(client, auth_headers):
    content = f"title,status,courses,tags\nPasta,OK,Primo,{'x' * 80}\n"
    assert _import(client, auth_headers, content).json()["created"] == 1
    assert [t["name"] for t in _dishes(client, auth_headers)[0]["tags"]] == ["x" * 50]


# --- tags ----------------------------------------------------------------------------------------------------

def test_import_creates_missing_tags_with_default_color_and_reuses_existing_ones_case_insensitively(client, auth_headers):
    client.post("/api/v1/taxonomies/tags", headers=auth_headers, json={"name": "Veloce", "color": "#112233"})
    content = 'title,status,courses,tags\nPasta,OK,Primo,"veloce, Estivo, ESTIVO, , Nuovo"\n'
    assert _import(client, auth_headers, content).json()["created"] == 1

    tags = {t["name"]: t["color"] for t in client.get("/api/v1/taxonomies/tags", headers=auth_headers).json()}
    assert tags == {"Veloce": "#112233", "Estivo": "#16a34a", "Nuovo": "#16a34a"}
    assert sorted(t["name"] for t in _dishes(client, auth_headers)[0]["tags"]) == ["Estivo", "Nuovo", "Veloce"]


def test_json_import_accepts_tags_as_a_list(client, auth_headers):
    items = json.dumps([{"title": "Pasta", "status": "OK", "courses": ["Primo"], "tags": ["Veloce", "Light"]}])
    assert _import(client, auth_headers, items, filename="t.json").json()["created"] == 1
    # Characterization / FINDING: JSON values are stringified, so a list under 'tags' becomes its Python repr and is
    # then split on commas; the brackets/quotes end up inside the stored tag names.
    names = sorted(t["name"] for t in _dishes(client, auth_headers)[0]["tags"])
    assert names == ["'Light']", "['Veloce'"]


def test_update_mode_replaces_tags_and_courses(client, auth_headers):
    _import(client, auth_headers, "title,status,courses,tags\nPasta,OK,Primo,Veloce\n")
    body = _import(client, auth_headers, "title,status,courses,tags\npasta,OK,Secondo,Light\n", mode="update").json()
    assert body["updated"] == 1 and body["created"] == 0
    dish = _dishes(client, auth_headers)[0]
    assert dish["title"] == "pasta"  # title takes the casing of the imported row
    assert [t["name"] for t in dish["tags"]] == ["Light"]
    assert [c["name"] for c in dish["courses"]] == ["Secondo"]


# --- partial failure / duplicates ----------------------------------------------------------------------------

def test_valid_rows_are_committed_even_when_other_rows_fail(client, auth_headers):
    content = "title,status,courses\nA,OK,Primo\nB,NOPE,Primo\nC,OK,\nD,OK,Primo\n"
    body = _import(client, auth_headers, content).json()
    assert body["total_rows"] == 4 and body["created"] == 2
    assert [e["row"] for e in body["errors"]] == [3, 4]
    assert {e["dish_title"] for e in body["errors"]} == {"B", "C"}
    assert sorted(d["title"] for d in _dishes(client, auth_headers)) == ["A", "D"]


def test_duplicates_inside_the_same_file_are_skipped_in_skip_mode(client, auth_headers):
    content = "title,status,courses\nPasta,OK,Primo\n pasta ,OK,Primo\nPASTA,OK,Secondo\n"
    body = _import(client, auth_headers, content).json()
    assert (body["created"], body["skipped"], body["updated"]) == (1, 2, 0)


def test_duplicates_inside_the_same_file_in_update_mode_currently_accumulate_courses(client, auth_headers):
    """Characterization / FINDING: the row that creates a dish queues its DishCourse rows without flushing,
    so the bulk DELETE issued by the next 'update' row for the same title does not see them. Both rows'
    courses end up on the dish instead of the last row winning. Logged as a separate issue, not fixed here."""
    content = "title,status,courses\nPasta,OK,Primo\npasta,OK,Secondo\n"
    body = _import(client, auth_headers, content, mode="update").json()
    assert (body["created"], body["updated"]) == (1, 1)
    assert sorted(c["name"] for c in _dishes(client, auth_headers)[0]["courses"]) == ["Primo", "Secondo"]


def test_skip_mode_leaves_existing_dish_untouched(client, auth_headers):
    _import(client, auth_headers, "title,status,courses,notes\nPasta,OK,Primo,originale\n")
    body = _import(client, auth_headers, "title,status,courses,notes\nPasta,OK,Primo,nuova\n").json()
    assert body["skipped"] == 1
    assert _dishes(client, auth_headers)[0]["notes"] == "originale"


def test_update_mode_clears_optional_fields_missing_from_the_file(client, auth_headers):
    _import(client, auth_headers, "title,status,courses,notes,description\nPasta,OK,Primo,n,d\n")
    _import(client, auth_headers, "title,status,courses\nPasta,OK,Primo\n", mode="update")
    dish = _dishes(client, auth_headers)[0]
    assert dish["notes"] is None and dish["description"] is None


# --- formula injection ---------------------------------------------------------------------------------------

@pytest.mark.parametrize("payload", ["=1+2", "+1", "-1", "@SUM(A1)"])
def test_export_neutralizes_formula_prefixes_in_all_formats(client, auth_headers, payload):
    status_id = client.get("/api/v1/taxonomies/statuses", headers=auth_headers).json()[0]["id"]
    course_id = client.get("/api/v1/taxonomies/courses", headers=auth_headers).json()[0]["id"]
    res = client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": payload, "description": payload, "notes": payload, "source_reference": payload,
        "status_id": status_id, "course_ids": [course_id],
    })
    assert res.status_code == 201, res.text
    expected = f"'{payload}"

    csv_rows = list(csv.DictReader(io.StringIO(client.get("/api/v1/dishes/export?format=csv", headers=auth_headers).content.decode("utf-8-sig"))))
    assert [csv_rows[0][k] for k in ("title", "description", "notes", "source_reference")] == [expected] * 4

    ws = openpyxl.load_workbook(io.BytesIO(client.get("/api/v1/dishes/export?format=xlsx", headers=auth_headers).content)).active
    header = [c.value for c in ws[1]]
    row = {h: c.value for h, c in zip(header, ws[2])}
    assert [row[k] for k in ("title", "description", "notes", "source_reference")] == [expected] * 4
    assert all(ws.cell(row=2, column=i).data_type != "f" for i in range(1, len(header) + 1))

    data = client.get("/api/v1/dishes/export?format=json", headers=auth_headers).json()
    assert [data[0][k] for k in ("title", "description", "notes", "source_reference")] == [expected] * 4


def test_export_neutralizes_formula_in_tags_and_custom_status_label(client, auth_headers):
    statuses = client.get("/api/v1/taxonomies/statuses", headers=auth_headers).json()
    ok = next(s for s in statuses if s["code"] == "ok")
    client.put(f"/api/v1/taxonomies/statuses/{ok['id']}", headers=auth_headers, json={"custom_label": "=EVIL()"})
    course_id = client.get("/api/v1/taxonomies/courses", headers=auth_headers).json()[0]["id"]
    client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Pasta", "status_id": ok["id"], "course_ids": [course_id], "tags": [{"name": "=1+1"}]})

    rows = list(csv.DictReader(io.StringIO(client.get("/api/v1/dishes/export?format=csv", headers=auth_headers).content.decode("utf-8-sig"))))
    assert rows[0]["status"] == "'=EVIL()"
    assert rows[0]["tags"] == "'=1+1"
    # JSON is not a spreadsheet format: the tag list is exported verbatim (pinned).
    assert client.get("/api/v1/dishes/export?format=json", headers=auth_headers).json()[0]["tags"] == ["=1+1"]


def test_leading_tab_and_carriage_return_are_stripped_before_the_prefix_check(client, auth_headers):
    body = _import(client, auth_headers, 'title,status,courses\n"\t=cmd",OK,Primo\n').json()
    assert body["created"] == 1
    assert _dishes(client, auth_headers)[0]["title"] == "'=cmd"


def test_imported_formula_is_stored_with_a_quote_prefix(client, auth_headers):
    _import(client, auth_headers, 'title,status,courses,description\n=1+2,OK,Primo,@x\n')
    dish = _dishes(client, auth_headers)[0]
    assert dish["title"] == "'=1+2" and dish["description"] == "'@x"


def test_export_then_import_roundtrip_of_a_formula_title_currently_creates_a_second_dish(client, auth_headers):
    """Characterization / FINDING: import stores '=1+2' as "'=1+2"; export keeps "'=1+2"; re-importing that
    file strips the leading quote, so the title no longer matches the stored one and a new dish '=1+2' is
    created instead of being skipped/updated. Logged as a separate issue, not fixed here."""
    _import(client, auth_headers, "title,status,courses\n=1+2,OK,Primo\n")
    exported = client.get("/api/v1/dishes/export?format=csv", headers=auth_headers).content
    body = _import(client, auth_headers, exported).json()
    assert body["created"] == 1 and body["skipped"] == 0
    assert sorted(d["title"] for d in _dishes(client, auth_headers)) == ["'=1+2", "=1+2"]


def test_export_import_roundtrip_of_regular_dishes_is_lossless(client, auth_headers):
    content = ('title,description,notes,status,source_type,courses,tags,source_reference,source_url\n'
               '"Pasta, fagioli","Con virgola","Riga1","OK","Famiglia","[""Primo"", ""Secondo""]","Veloce, Light","Nonna","https://x.example/a"\n')
    _import(client, auth_headers, content)
    before = _dishes(client, auth_headers)
    for fmt, name in (("csv", "r.csv"), ("xlsx", "r.xlsx"), ("json", "r.json")):
        exported = client.get(f"/api/v1/dishes/export?format={fmt}", headers=auth_headers).content
        body = _import(client, auth_headers, exported, filename=name).json()
        assert body["skipped"] == 1 and body["errors"] == [], (fmt, body)
    assert _dishes(client, auth_headers) == before


def test_export_rejects_unknown_format(client, auth_headers):
    assert client.get("/api/v1/dishes/export?format=pdf", headers=auth_headers).status_code == 422
    assert client.get("/api/v1/dishes/import-template?format=pdf", headers=auth_headers).status_code == 422


def test_export_and_template_require_authentication(client):
    assert client.get("/api/v1/dishes/export").status_code == 401
    assert client.get("/api/v1/dishes/import-template").status_code == 401


# --- tenant isolation ----------------------------------------------------------------------------------------------

def test_import_and_export_are_scoped_to_the_household(client, auth_headers):
    other = _register_second_household(client)
    _import(client, auth_headers, "title,status,courses,tags\nPasta,OK,Primo,Veloce\n")

    # Same title in the other household is not a duplicate and does not touch the first one.
    assert _import(client, other, "title,status,courses,notes\nPasta,OK,Primo,altro\n", mode="update").json()["created"] == 1
    assert [d["notes"] for d in _dishes(client, auth_headers)] == [None]
    assert [d["notes"] for d in _dishes(client, other)] == ["altro"]

    exported = client.get("/api/v1/dishes/export?format=json", headers=other).json()
    assert [d["title"] for d in exported] == ["Pasta"] and exported[0]["tags"] == []


def test_courses_sources_and_tags_created_by_import_are_not_visible_to_other_households(client, auth_headers):
    other = _register_second_household(client)
    _import(client, auth_headers, "title,status,courses,source_type,tags\nPasta,OK,Piattino,Rivista X,Privato\n")
    assert "Piattino" not in [c["name"] for c in client.get("/api/v1/taxonomies/courses", headers=other).json()]
    assert "Rivista X" not in [s["name"] for s in client.get("/api/v1/taxonomies/sources", headers=other).json()]
    assert client.get("/api/v1/taxonomies/tags", headers=other).json() == []
