import io
import csv
import openpyxl
import pytest


def test_export_dishes_csv_and_xlsx(client, auth_headers):
    # Setup test dishes
    res_statuses = client.get("/api/v1/taxonomies/statuses", headers=auth_headers)
    ok_status = next(s for s in res_statuses.json() if s["code"] == "ok")

    res_courses = client.get("/api/v1/taxonomies/courses", headers=auth_headers)
    primo = next(c for c in res_courses.json() if c["name"] == "Primo")
    secondo = next(c for c in res_courses.json() if c["name"] == "Secondo")
    piatto_unico = next(c for c in res_courses.json() if c["name"] == "Piatto unico")

    # Dish 1 with comma in title and notes
    client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Pasta, fagioli e cozze",
        "description": "Primo ricco, profumato e tradizionale",
        "notes": "Servire caldo, con un filo d'olio a crudo",
        "status_id": ok_status["id"],
        "course_ids": [primo["id"]],
        "source_reference": "Nonna Maria, Napoli",
    })

    # Dish 2 with multiple courses
    client.post("/api/v1/dishes", headers=auth_headers, json={
        "title": "Arrosto con patate",
        "description": "Secondo piatto festivo",
        "notes": "Cottura 180°C",
        "status_id": ok_status["id"],
        "course_ids": [secondo["id"], piatto_unico["id"]],
    })

    # 1. Test CSV Export
    res_csv = client.get("/api/v1/dishes/export?format=csv", headers=auth_headers)
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "attachment; filename=\"piatti_" in res_csv.headers["content-disposition"]

    # Decode CSV content
    csv_text = res_csv.content.decode("utf-8-sig")
    reader = list(csv.reader(io.StringIO(csv_text)))
    assert len(reader) == 3  # Header + 2 dishes
    headers = reader[0]
    assert headers[0] == "Titolo"
    assert headers[3] == "Stato"
    assert headers[5] == "Portate"

    # Find the dish with comma
    dish1_row = next(r for r in reader[1:] if "Pasta, fagioli e cozze" in r[0])
    assert dish1_row[0] == "Pasta, fagioli e cozze"
    assert dish1_row[3] == "OK"  # Lookup description, not ID
    assert dish1_row[5] == '["Primo"]'

    # Multi-course dish
    dish2_row = next(r for r in reader[1:] if "Arrosto con patate" in r[0])
    assert '["Secondo", "Piatto unico"]' in dish2_row[5] or '["Piatto unico", "Secondo"]' in dish2_row[5]

    # 2. Test XLSX Export
    res_xlsx = client.get("/api/v1/dishes/export?format=xlsx", headers=auth_headers)
    assert res_xlsx.status_code == 200
    assert "application/vnd.openxmlformats" in res_xlsx.headers["content-type"]

    wb = openpyxl.load_workbook(io.BytesIO(res_xlsx.content))
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    assert len(rows) == 3
    assert rows[0][0] == "Titolo"

    # 3. Test Filtered Export
    res_filtered = client.get("/api/v1/dishes/export?format=csv&search=cozze", headers=auth_headers)
    assert res_filtered.status_code == 200
    filtered_reader = list(csv.reader(io.StringIO(res_filtered.content.decode("utf-8-sig"))))
    assert len(filtered_reader) == 2  # Header + 1 match
    assert filtered_reader[1][0] == "Pasta, fagioli e cozze"


def test_download_template(client, auth_headers):
    # CSV template
    res_csv = client.get("/api/v1/dishes/import-template?format=csv", headers=auth_headers)
    assert res_csv.status_code == 200
    assert "template_import_piatti.csv" in res_csv.headers["content-disposition"]
    csv_rows = list(csv.reader(io.StringIO(res_csv.content.decode("utf-8-sig"))))
    assert len(csv_rows) >= 3  # Header + sample rows

    # XLSX template
    res_xlsx = client.get("/api/v1/dishes/import-template?format=xlsx", headers=auth_headers)
    assert res_xlsx.status_code == 200
    assert "template_import_piatti.xlsx" in res_xlsx.headers["content-disposition"]
    wb = openpyxl.load_workbook(io.BytesIO(res_xlsx.content))
    assert "Template Piatti" in wb.sheetnames


def test_import_dishes_csv(client, auth_headers):
    # CSV with various portate formats: bracketed list, single value, comma separated
    csv_content = """Titolo,Descrizione,Note,Stato,Tipo Fonte,Portate,Riferimento Fonte,URL Fonte
"Risotto allo Zafferano","Giallo milanese cremoso","Usare burro freddo","OK","Famiglia","[""Primo""]","Ricetta nonna",https://example.com/risotto
"Cotoletta alla Milanese","Fritta nel burro chiarificato","Spicchio di limone","OK","Libro / Rivista","Secondo","Il Cucchiaio d'Argento",
"Polenta e Spezzatino","Piatto invernale ricco","Cuocere 2 ore","OK","Famiglia","[""Secondo"", ""Piatto unico""]","Baita",
"Spaghetti alla Carbonara","Autentica romana","Niente panna!","OK","Note personali","Primo, Piatto unico","Roma",
"""
    files = {
        "file": ("import_test.csv", csv_content.encode("utf-8"), "text/csv")
    }
    data = {"mode": "skip"}

    res = client.post("/api/v1/dishes/import", headers=auth_headers, files=files, data=data)
    assert res.status_code == 200
    result = res.json()
    assert result["total_rows"] == 4
    assert result["created"] == 4
    assert result["skipped"] == 0
    assert result["errors"] == []

    # Verify created in DB
    res_dishes = client.get("/api/v1/dishes", headers=auth_headers)
    dishes = res_dishes.json()
    titles = [d["title"] for d in dishes]
    assert "Risotto allo Zafferano" in titles
    assert "Cotoletta alla Milanese" in titles
    assert "Polenta e Spezzatino" in titles
    assert "Spaghetti alla Carbonara" in titles

    # Multi-course check for Polenta e Spezzatino
    polenta = next(d for d in dishes if d["title"] == "Polenta e Spezzatino")
    polenta_courses = [c["name"] for c in polenta["courses"]]
    assert "Secondo" in polenta_courses
    assert "Piatto unico" in polenta_courses


def test_import_duplicates_skip_and_update(client, auth_headers):
    # Pre-insert a dish
    csv_init = """Titolo,Descrizione,Note,Stato,Tipo Fonte,Portate,Riferimento Fonte,URL Fonte
"Tiramisù","Originale veneto","Uova fresche","OK","Famiglia","Dolce","Zia Lucia",
"""
    client.post(
        "/api/v1/dishes/import",
        headers=auth_headers,
        files={"file": ("init.csv", csv_init.encode("utf-8"), "text/csv")},
        data={"mode": "skip"}
    )

    # 1. Re-import with mode 'skip'
    csv_update = """Titolo,Descrizione,Note,Stato,Tipo Fonte,Portate,Riferimento Fonte,URL Fonte
"Tiramisù","Descrizione AGGIORNATA","Nuove note","OK","Famiglia","Dolce","Zia Lucia",
"Panna Cotta","Al caramello","Facile","OK","Famiglia","Dolce","",
"""
    res_skip = client.post(
        "/api/v1/dishes/import",
        headers=auth_headers,
        files={"file": ("update.csv", csv_update.encode("utf-8"), "text/csv")},
        data={"mode": "skip"}
    )
    assert res_skip.status_code == 200
    skip_json = res_skip.json()
    assert skip_json["created"] == 1  # Panna Cotta
    assert skip_json["skipped"] == 1  # Tiramisù skipped
    assert skip_json["updated"] == 0

    # Verify Tiramisù was NOT updated
    dishes = client.get("/api/v1/dishes", headers=auth_headers).json()
    tiramisu = next(d for d in dishes if d["title"] == "Tiramisù")
    assert tiramisu["description"] == "Originale veneto"

    # 2. Re-import with mode 'update'
    res_update = client.post(
        "/api/v1/dishes/import",
        headers=auth_headers,
        files={"file": ("update.csv", csv_update.encode("utf-8"), "text/csv")},
        data={"mode": "update"}
    )
    assert res_update.status_code == 200
    upd_json = res_update.json()
    assert upd_json["updated"] == 2  # Both Tiramisù and Panna Cotta updated
    assert upd_json["created"] == 0

    dishes_upd = client.get("/api/v1/dishes", headers=auth_headers).json()
    tiramisu_upd = next(d for d in dishes_upd if d["title"] == "Tiramisù")
    assert tiramisu_upd["description"] == "Descrizione AGGIORNATA"


def test_import_validation_and_row_errors(client, auth_headers):
    # Missing title in row 2, invalid status in row 3, missing courses in row 4
    csv_invalid = """Titolo,Descrizione,Note,Stato,Tipo Fonte,Portate,Riferimento Fonte,URL Fonte
"","Manca il titolo","","OK","","Primo","",
"Bruschetta","","","STATO_INESISTENTE","","Antipasto","",
"Insalata mista","","","OK","","","",
"Gnocchi al Pesto","Buoni","","OK","Famiglia","Primo","",
"""
    res = client.post(
        "/api/v1/dishes/import",
        headers=auth_headers,
        files={"file": ("invalid.csv", csv_invalid.encode("utf-8"), "text/csv")},
        data={"mode": "skip"}
    )
    assert res.status_code == 200
    result = res.json()
    assert result["total_rows"] == 4
    assert result["created"] == 1  # Only Gnocchi al Pesto
    assert len(result["errors"]) == 3
    assert result["errors"][0]["row"] == 2
    assert "obbligatorio" in result["errors"][0]["error"].lower()
    assert result["errors"][1]["row"] == 3
    assert "non valido" in result["errors"][1]["error"].lower()
    assert result["errors"][2]["row"] == 4
    assert "portata" in result["errors"][2]["error"].lower()


def test_formula_injection_defense(client, auth_headers):
    # CSV containing malicious spreadsheet formulas
    csv_malicious = """Titolo,Descrizione,Note,Stato,Tipo Fonte,Portate,Riferimento Fonte,URL Fonte
"=1+2","=@cmd|' /C calc'!A0","+3-5","OK","Famiglia","Primo","",
"""
    res = client.post(
        "/api/v1/dishes/import",
        headers=auth_headers,
        files={"file": ("malicious.csv", csv_malicious.encode("utf-8"), "text/csv")},
        data={"mode": "skip"}
    )
    assert res.status_code == 200
    assert res.json()["created"] == 1

    # Check that export sanitizes formula prefix
    res_export = client.get("/api/v1/dishes/export?format=csv", headers=auth_headers)
    assert res_export.status_code == 200
    csv_text = res_export.content.decode("utf-8-sig")
    assert "'=1+2" in csv_text
