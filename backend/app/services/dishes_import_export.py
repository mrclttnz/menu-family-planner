import io
import json
import csv
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import or_

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

from app.models.dish import Dish, DishCourse, Tag, DishTag
from app.models.taxonomy import DishStatus, CourseType, SourceType
from app.schemas.dish import DishImportResult, DishImportRowError

# Security: formula injection triggers
DANGEROUS_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

# Canonical English headers for consistency across Excel, CSV and JSON
HEADER_COLUMNS = [
    "title",
    "description",
    "notes",
    "status",
    "source_type",
    "courses",
    "tags",
    "source_reference",
    "source_url",
]


def format_tags_field(tags: List[Any]) -> str:
    """Formats tags as a clean comma-separated list of names."""
    names = [dt.tag.name for dt in tags if dt.tag and dt.tag.name]
    return ", ".join(names)


def sanitize_for_export(val: Optional[str]) -> str:
    """Neutralizes spreadsheet formula injection by prepending a single quote."""
    if not val:
        return ""
    s = str(val).strip()
    if s.startswith(DANGEROUS_FORMULA_PREFIXES):
        return f"'{s}"
    return s


def sanitize_from_import(val: Optional[str]) -> Optional[str]:
    """Sanitizes text extracted from import file."""
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    # Strip leading quote if it was added solely to escape formula injection
    if s.startswith("'") and len(s) > 1 and s[1] in DANGEROUS_FORMULA_PREFIXES:
        s = s[1:]
    # Neutralize dangerous formula execution attempts if present
    elif s.startswith(DANGEROUS_FORMULA_PREFIXES):
        s = f"'{s}"
    return s


def parse_courses_field(raw_val: Any) -> List[str]:
    """Parses native list, single course, comma-separated list, or JSON array of courses."""
    if not raw_val:
        return []
    if isinstance(raw_val, list):
        return [str(x).strip().strip("'\"") for x in raw_val if str(x).strip()]

    s = str(raw_val).strip()
    if not s:
        return []

    # Check if enclosed in brackets: e.g. ["Secondo", "Piatto unico"]
    if (s.startswith("[") and s.endswith("]")) or (s.startswith("(") and s.endswith(")")):
        inner = s[1:-1].strip()
        if not inner:
            return []
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                res = [str(item).strip() for item in parsed if str(item).strip()]
                return [r.strip("'\"") for r in res if r]
        except Exception:
            pass
        parts = [p.strip().strip("'\"").strip() for p in inner.split(",")]
        return [p for p in parts if p]

    # Simple comma-separated or single string
    parts = [p.strip().strip("'\"").strip() for p in s.split(",")]
    return [p for p in parts if p]


def format_courses_field(courses: List[CourseType]) -> str:
    """Formats courses as JSON array string for clean Excel/CSV export."""
    names = [c.name for c in courses if c.name]
    if not names:
        return "[]"
    return json.dumps(names, ensure_ascii=False)


def export_dishes_to_xlsx(dishes: List[Dish]) -> bytes:
    """Generates an Excel workbook (.xlsx) containing dishes with English headers."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Dishes"

    # Style Header
    header_font = Font(name="Calibri", size=11, bold=True, color="1F2937")
    header_fill = PatternFill(start_color="F3F4F6", end_color="F3F4F6", fill_type="solid")
    header_alignment = Alignment(horizontal="left", vertical="center")

    ws.append(HEADER_COLUMNS)
    for col_idx in range(1, len(HEADER_COLUMNS) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment

    # Data Rows
    for dish in dishes:
        status_name = dish.status.custom_label if dish.status.custom_label else dish.status.lookup.name
        source_type_name = dish.source_type.name if dish.source_type else ""
        courses_str = format_courses_field([dc.course_type for dc in dish.courses if dc.course_type])
        tags_str = format_tags_field(dish.tags)

        row_data = [
            sanitize_for_export(dish.title),
            sanitize_for_export(dish.description or ""),
            sanitize_for_export(dish.notes or ""),
            sanitize_for_export(status_name),
            sanitize_for_export(source_type_name),
            courses_str,
            sanitize_for_export(tags_str),
            sanitize_for_export(dish.source_reference or ""),
            sanitize_for_export(dish.source_url or ""),
        ]
        ws.append(row_data)

    # Auto-fit column widths
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, 14), 50)

    # Freeze header row
    ws.freeze_panes = "A2"

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def export_dishes_to_csv(dishes: List[Dish]) -> bytes:
    """Generates a CSV file with RFC-4180 quoting, UTF-8 BOM encoding and English headers."""
    output = io.StringIO()
    writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL)

    writer.writerow(HEADER_COLUMNS)
    for dish in dishes:
        status_name = dish.status.custom_label if dish.status.custom_label else dish.status.lookup.name
        source_type_name = dish.source_type.name if dish.source_type else ""
        courses_str = format_courses_field([dc.course_type for dc in dish.courses if dc.course_type])
        tags_str = format_tags_field(dish.tags)

        writer.writerow([
            sanitize_for_export(dish.title),
            sanitize_for_export(dish.description or ""),
            sanitize_for_export(dish.notes or ""),
            sanitize_for_export(status_name),
            sanitize_for_export(source_type_name),
            courses_str,
            sanitize_for_export(tags_str),
            sanitize_for_export(dish.source_reference or ""),
            sanitize_for_export(dish.source_url or ""),
        ])

    return output.getvalue().encode("utf-8-sig")


def export_dishes_to_json(dishes: List[Dish]) -> bytes:
    """Generates a formatted JSON array with English keys."""
    data = []
    for dish in dishes:
        status_name = dish.status.custom_label if dish.status.custom_label else dish.status.lookup.name
        source_type_name = dish.source_type.name if dish.source_type else ""
        courses_list = [dc.course_type.name for dc in dish.courses if dc.course_type and dc.course_type.name]
        tags_list = [dt.tag.name for dt in dish.tags if dt.tag and dt.tag.name]

        data.append({
            "title": sanitize_for_export(dish.title),
            "description": sanitize_for_export(dish.description or ""),
            "notes": sanitize_for_export(dish.notes or ""),
            "status": sanitize_for_export(status_name),
            "source_type": sanitize_for_export(source_type_name),
            "courses": courses_list,
            "tags": tags_list,
            "source_reference": sanitize_for_export(dish.source_reference or ""),
            "source_url": sanitize_for_export(dish.source_url or ""),
        })

    return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")


def generate_import_template(fmt: str) -> Tuple[bytes, str, str]:
    """Generates an example template in xlsx, csv, or json format with English keys."""
    example_dishes = [
        {
            "title": "Pasta al Pomodoro Fresco",
            "description": "Primo piatto tradizionale della cucina italiana con pomodoro e basilico fresco.",
            "notes": "Spolverare con Parmigiano Reggiano grattugiato a piacere.",
            "status": "OK",
            "source_type": "Famiglia",
            "courses_str": '["Primo"]',
            "courses_list": ["Primo"],
            "tags_str": "Veloce, Vegetariano",
            "tags_list": ["Veloce", "Vegetariano"],
            "source_reference": "Ricetta della nonna",
            "source_url": "",
        },
        {
            "title": "Arrosto di Vitello con Patate Novelle",
            "description": "Secondo piatto di carne con patate novelle al rosmarino.",
            "notes": "Cottura a fuoco lento 180°C per 90 minuti coperto con alluminio.",
            "status": "OK",
            "source_type": "Libro / Rivista",
            "courses_str": '["Secondo", "Piatto unico"]',
            "courses_list": ["Secondo", "Piatto unico"],
            "tags_str": "Carne, Invernale",
            "tags_list": ["Carne", "Invernale"],
            "source_reference": "Il Cucchiaio d'Argento p. 112",
            "source_url": "https://www.cucchiaio.it/ricetta/arrosto-di-vitello/",
        },
    ]

    f = fmt.lower()
    if f == "xlsx":
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Dishes Template"

        header_font = Font(name="Calibri", size=11, bold=True, color="1F2937")
        header_fill = PatternFill(start_color="F3F4F6", end_color="F3F4F6", fill_type="solid")
        header_alignment = Alignment(horizontal="left", vertical="center")

        ws.append(HEADER_COLUMNS)
        for col_idx in range(1, len(HEADER_COLUMNS) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment

        for d in example_dishes:
            ws.append([
                d["title"],
                d["description"],
                d["notes"],
                d["status"],
                d["source_type"],
                d["courses_str"],
                d["tags_str"],
                d["source_reference"],
                d["source_url"],
            ])

        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 14), 50)

        ws.freeze_panes = "A2"
        out = io.BytesIO()
        wb.save(out)
        return (
            out.getvalue(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "template_import_piatti.xlsx",
        )

    elif f == "json":
        json_data = [
            {
                "title": d["title"],
                "description": d["description"],
                "notes": d["notes"],
                "status": d["status"],
                "source_type": d["source_type"],
                "courses": d["courses_list"],
                "tags": d["tags_list"],
                "source_reference": d["source_reference"],
                "source_url": d["source_url"],
            }
            for d in example_dishes
        ]
        return (
            json.dumps(json_data, ensure_ascii=False, indent=2).encode("utf-8"),
            "application/json; charset=utf-8",
            "template_import_piatti.json",
        )

    else:
        output = io.StringIO()
        writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL)
        writer.writerow(HEADER_COLUMNS)
        for d in example_dishes:
            writer.writerow([
                d["title"],
                d["description"],
                d["notes"],
                d["status"],
                d["source_type"],
                d["courses_str"],
                d["tags_str"],
                d["source_reference"],
                d["source_url"],
            ])
        return (
            output.getvalue().encode("utf-8-sig"),
            "text/csv; charset=utf-8",
            "template_import_piatti.csv",
        )


def _normalize_header(h: str) -> str:
    """Normalizes header field names strictly in English."""
    clean = h.strip().lower().replace(" ", "_").replace("-", "_")
    mapping = {
        "title": "title",
        "name": "title",
        "description": "description",
        "desc": "description",
        "notes": "notes",
        "note": "notes",
        "status": "status",
        "source_type": "source_type",
        "source": "source_type",
        "courses": "courses",
        "course": "courses",
        "source_reference": "source_reference",
        "reference": "source_reference",
        "source_url": "source_url",
        "url": "source_url",
    }
    return mapping.get(clean, clean)


def _parse_rows_from_bytes(file_bytes: bytes, filename: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Extracts rows as dictionaries with normalized English field names from xlsx, csv, or json."""
    rows: List[Dict[str, Any]] = []
    errors: List[str] = []
    fname = filename.lower()

    if fname.endswith(".json"):
        try:
            text = file_bytes.decode("utf-8-sig", errors="replace")
            payload = json.loads(text)
            if isinstance(payload, dict):
                if "dishes" in payload and isinstance(payload["dishes"], list):
                    raw_items = payload["dishes"]
                elif "items" in payload and isinstance(payload["items"], list):
                    raw_items = payload["items"]
                else:
                    return [], ["Il JSON deve contenere un array di piatti o una chiave 'dishes'."]
            elif isinstance(payload, list):
                raw_items = payload
            else:
                return [], ["Il formato JSON deve essere un array di piatti."]

            for item_idx, item in enumerate(raw_items, start=1):
                if not isinstance(item, dict):
                    continue
                row_dict: Dict[str, Any] = {}
                for k, v in item.items():
                    norm_k = _normalize_header(str(k))
                    if norm_k == "courses" and isinstance(v, list):
                        row_dict["courses"] = json.dumps([str(x) for x in v], ensure_ascii=False)
                    elif v is not None:
                        row_dict[norm_k] = str(v).strip()
                    else:
                        row_dict[norm_k] = ""
                row_dict["_row_number"] = str(item_idx)
                rows.append(row_dict)
        except Exception as e:
            return [], [f"Impossibile leggere il file JSON: {str(e)}"]

    elif fname.endswith(".xlsx"):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
            ws = wb.active
            all_rows = list(ws.iter_rows(values_only=True))
            if not all_rows:
                return [], ["Il file Excel è vuoto."]
            header_raw = [str(c or "").strip() for c in all_rows[0]]
            col_map = {idx: _normalize_header(h) for idx, h in enumerate(header_raw) if h}

            for row_idx, row_values in enumerate(all_rows[1:], start=2):
                if not any(v is not None and str(v).strip() for v in row_values):
                    continue
                row_dict: Dict[str, Any] = {}
                for idx, val in enumerate(row_values):
                    if idx in col_map:
                        val_str = str(val).strip() if val is not None else ""
                        row_dict[col_map[idx]] = val_str
                row_dict["_row_number"] = str(row_idx)
                rows.append(row_dict)
        except Exception as e:
            return [], [f"Impossibile leggere il file Excel: {str(e)}"]

    else:
        # Default CSV parsing with utf-8-sig
        try:
            text = file_bytes.decode("utf-8-sig", errors="replace")
            reader = csv.reader(io.StringIO(text))
            all_rows = list(reader)
            if not all_rows:
                return [], ["Il file CSV è vuoto."]
            header_raw = [str(c or "").strip() for c in all_rows[0]]
            col_map = {idx: _normalize_header(h) for idx, h in enumerate(header_raw) if h}

            for row_idx, row_values in enumerate(all_rows[1:], start=2):
                if not any(v and v.strip() for v in row_values):
                    continue
                row_dict: Dict[str, Any] = {}
                for idx, val in enumerate(row_values):
                    if idx in col_map:
                        row_dict[col_map[idx]] = val.strip() if val else ""
                row_dict["_row_number"] = str(row_idx)
                rows.append(row_dict)
        except Exception as e:
            return [], [f"Impossibile leggere il file CSV: {str(e)}"]

    return rows, errors


def import_dishes_from_bytes(
    db: Session,
    household_id: int,
    file_bytes: bytes,
    filename: str,
    mode: str = "skip",  # "skip" or "update"
) -> DishImportResult:
    """Parses, validates, and imports dishes into the current household catalog."""
    if len(file_bytes) > MAX_FILE_SIZE:
        return DishImportResult(
            total_rows=0,
            created=0,
            updated=0,
            skipped=0,
            errors=[DishImportRowError(row=0, error="Il file supera la dimensione massima consentita di 5 MB.")],
        )

    rows, parse_errors = _parse_rows_from_bytes(file_bytes, filename)
    if parse_errors:
        return DishImportResult(
            total_rows=0,
            created=0,
            updated=0,
            skipped=0,
            errors=[DishImportRowError(row=0, error=err) for err in parse_errors],
        )

    # 1. Preload lookup tables for household
    household_statuses = db.query(DishStatus).filter(DishStatus.household_id == household_id).all()
    status_map: Dict[str, DishStatus] = {}
    default_status: Optional[DishStatus] = None
    for st in household_statuses:
        if st.is_default:
            default_status = st
        if st.custom_label:
            status_map[st.custom_label.strip().lower()] = st
        if st.lookup and st.lookup.name:
            status_map[st.lookup.name.strip().lower()] = st
        if st.lookup and st.lookup.code:
            status_map[st.lookup.code.strip().lower()] = st

    if not default_status and household_statuses:
        default_status = household_statuses[0]

    # Preload CourseTypes (household-specific or global)
    course_objs = db.query(CourseType).filter(
        or_(CourseType.household_id.is_(None), CourseType.household_id == household_id)
    ).all()
    course_map: Dict[str, CourseType] = {c.name.strip().lower(): c for c in course_objs if c.name}

    # Preload SourceTypes (household-specific or global)
    source_objs = db.query(SourceType).filter(
        or_(SourceType.household_id.is_(None), SourceType.household_id == household_id)
    ).all()
    source_map: Dict[str, SourceType] = {s.name.strip().lower(): s for s in source_objs if s.name}

    # Preload existing tags for household
    tag_objs = db.query(Tag).filter(Tag.household_id == household_id).all()
    tag_map: Dict[str, Tag] = {t.name.strip().lower(): t for t in tag_objs if t.name}

    # Preload existing dishes for household (case-insensitive title map)
    existing_dishes = db.query(Dish).filter(Dish.household_id == household_id).all()
    dish_map: Dict[str, Dish] = {d.title.strip().lower(): d for d in existing_dishes}

    created_count = 0
    updated_count = 0
    skipped_count = 0
    errors: List[DishImportRowError] = []

    for r in rows:
        row_num = int(r.get("_row_number", 0))
        raw_title = r.get("title", "")
        if isinstance(raw_title, str):
            raw_title = raw_title.strip()
        else:
            raw_title = str(raw_title).strip() if raw_title is not None else ""

        # Mandatory validation 1: Title
        if not raw_title:
            errors.append(DishImportRowError(row=row_num, dish_title="", error="Il campo 'title' è obbligatorio."))
            continue

        clean_title = sanitize_from_import(raw_title)
        if not clean_title:
            errors.append(DishImportRowError(row=row_num, dish_title="", error="Il campo 'title' non può essere vuoto."))
            continue

        # Mandatory validation 2: Status
        raw_status = str(r.get("status", "")).strip()
        matched_status: Optional[DishStatus] = None
        if raw_status:
            matched_status = status_map.get(raw_status.lower())
            if not matched_status:
                errors.append(
                    DishImportRowError(
                        row=row_num,
                        dish_title=clean_title,
                        error=f"Stato '{raw_status}' non valido o non riconosciuto per la famiglia.",
                    )
                )
                continue
        else:
            errors.append(
                DishImportRowError(
                    row=row_num,
                    dish_title=clean_title,
                    error="Il campo 'status' è obbligatorio (es. 'OK', 'Da provare').",
                )
            )
            continue

        # Mandatory validation 3: Courses
        raw_courses = r.get("courses", "")
        parsed_courses = parse_courses_field(raw_courses)
        if not parsed_courses:
            errors.append(
                DishImportRowError(
                    row=row_num,
                    dish_title=clean_title,
                    error="È necessario specificare almeno una portata valida in 'courses' (es. 'Primo' o '[\"Secondo\", \"Piatto unico\"]').",
                )
            )
            continue

        matched_courses: List[CourseType] = []
        for c_name in parsed_courses:
            key = c_name.strip().lower()
            if key in course_map:
                matched_courses.append(course_map[key])
            else:
                new_c = CourseType(
                    household_id=household_id,
                    name=c_name.strip(),
                    sort_order=len(course_map) + 1,
                    is_active=True,
                )
                db.add(new_c)
                db.flush()
                course_map[key] = new_c
                matched_courses.append(new_c)

        # Optional Source Type
        raw_source_type = str(r.get("source_type", "")).strip()
        matched_source: Optional[SourceType] = None
        if raw_source_type:
            s_key = raw_source_type.lower()
            if s_key in source_map:
                matched_source = source_map[s_key]
            else:
                new_s = SourceType(
                    household_id=household_id,
                    name=raw_source_type,
                    icon="book",
                    is_active=True,
                )
                db.add(new_s)
                db.flush()
                source_map[s_key] = new_s
                matched_source = new_s

        # Optional Tags
        raw_tags = r.get("tags", "")
        matched_tags: List[Tag] = []
        raw_tag_names: List[str] = []
        if isinstance(raw_tags, list):
            for item in raw_tags:
                clean_item = sanitize_from_import(str(item))
                if clean_item:
                    raw_tag_names.append(clean_item)
        elif isinstance(raw_tags, str) and raw_tags.strip():
            for part in raw_tags.split(","):
                clean_part = sanitize_from_import(part)
                if clean_part:
                    raw_tag_names.append(clean_part)

        seen_tkeys = set()
        for t_name in raw_tag_names:
            clean_t = t_name.replace(",", "").strip()
            if not clean_t:
                continue
            t_key = clean_t.lower()
            if t_key in seen_tkeys:
                continue
            seen_tkeys.add(t_key)

            if t_key in tag_map:
                matched_tags.append(tag_map[t_key])
            else:
                new_tag = Tag(
                    household_id=household_id,
                    name=clean_t[:50],
                    color="#16a34a"
                )
                db.add(new_tag)
                db.flush()
                tag_map[t_key] = new_tag
                matched_tags.append(new_tag)

        clean_desc = sanitize_from_import(r.get("description", ""))
        clean_notes = sanitize_from_import(r.get("notes", ""))
        clean_source_ref = sanitize_from_import(r.get("source_reference", ""))
        clean_source_url = sanitize_from_import(r.get("source_url", ""))
        if clean_source_url and not (clean_source_url.startswith("http://") or clean_source_url.startswith("https://")):
            clean_source_url = f"https://{clean_source_url}"

        title_key = clean_title.lower()
        existing_dish = dish_map.get(title_key)

        if existing_dish:
            if mode == "skip":
                skipped_count += 1
                continue
            elif mode == "update":
                existing_dish.title = clean_title
                existing_dish.status_id = matched_status.id
                existing_dish.source_type_id = matched_source.id if matched_source else None
                existing_dish.description = clean_desc
                existing_dish.notes = clean_notes
                existing_dish.source_reference = clean_source_ref
                existing_dish.source_url = clean_source_url
                existing_dish.updated_at = datetime.now(timezone.utc)

                db.query(DishCourse).filter(DishCourse.dish_id == existing_dish.id).delete()
                for c in matched_courses:
                    db.add(DishCourse(dish_id=existing_dish.id, course_type_id=c.id))

                db.query(DishTag).filter(DishTag.dish_id == existing_dish.id).delete()
                for t in matched_tags:
                    db.add(DishTag(dish_id=existing_dish.id, tag_id=t.id))

                updated_count += 1
        else:
            new_dish = Dish(
                household_id=household_id,
                status_id=matched_status.id,
                source_type_id=matched_source.id if matched_source else None,
                title=clean_title,
                description=clean_desc,
                notes=clean_notes,
                source_reference=clean_source_ref,
                source_url=clean_source_url,
            )
            db.add(new_dish)
            db.flush()

            for c in matched_courses:
                db.add(DishCourse(dish_id=new_dish.id, course_type_id=c.id))

            for t in matched_tags:
                db.add(DishTag(dish_id=new_dish.id, tag_id=t.id))

            dish_map[title_key] = new_dish
            created_count += 1

    db.commit()

    return DishImportResult(
        total_rows=len(rows),
        created=created_count,
        updated=updated_count,
        skipped=skipped_count,
        errors=errors,
    )
