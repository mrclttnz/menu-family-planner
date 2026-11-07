# Product Requirements Document (`docs/PRD.md`)
## Project: Menu Design

> **Bottega Profile**: `forge` (MVP / Standard Application / Moderate-Risk)  
> **Status**: Updated Draft for User Sign-Off (Gate 1)  
> **Author**: Bottega Product Strategist (`product-strategist`)

---

## 1. Executive Summary & Vision

### 1.1 Problem Statement
Planning daily meals for a family is a recurring source of friction and mental exhaustion:
- **Repetitive Menus**: Families default to the same 4–5 dishes due to lack of immediate inspiration or forgetting successful meals cooked in the past.
- **Lost Inspiration & Wishlist**: Dishes discovered on social media reels, books, magazines, or newsletters stay trapped as ephemeral thoughts and get forgotten when planning.
- **Scattered Recipe Sources**: When a dish is remembered, finding the actual recipe (which cookbook, what page, which saved bookmark or Instagram reel) wastes time.
- **Individual Likes vs. Attendance Friction**: Cooks struggle to remember individual family member tastes (e.g. who loves it, who hates it) and who is eating at home at each meal. Dishes disliked by a child or partner are either prepared causing complaints, or avoided entirely even when that person is not home!
- **Course Composition**: Meals often require composing multiple dish types (e.g. *Primo + Contorno* or *Piatto Unico* or *Secondo + Dolce*).

### 1.2 Vision & Value Proposition
**Menu Design** is a family-first meal planning web application designed to eliminate mealtime friction. It provides:
1. A permanent repository of family dishes with flexible statuses (`Da provare`, `OK`, `Scartato`, `Da riprovare con variazioni`, `Preferito`).
2. Multi-course classification (`Antipasto`, `Primo`, `Secondo`, `Contorno`, `Piatto unico`, `Dolce`, `Bevanda`) with multi-category tagging per dish.
3. Configurable classifications (course types, dish statuses, recipe source types) built into the data architecture.
4. Granular per-member dish preference tracking (`favorite`, `neutral` [default], `dislike`) paired with real-time meal attendance to alert planners when someone present dislikes a dish.
5. Direct references to where recipes live (cookbooks, page numbers, web URLs, social bookmarks, notes).
6. A clear, mobile-friendly multi-day meal schedule accessible by the entire household.

### 1.3 Target Personas
- **The Primary Meal Planner / Cook**: Manages the weekly meal calendar, tracks recipe locations, and optimizes cooking around family presence and individual tastes.
- **The Co-Planner / Partner**: Reviews the plan, consults what's scheduled, sets preferences, and coordinates attendance.
- **The Diners / Family Members (Children & Others)**: Simple visibility into "what are we eating today/tomorrow" and toggling their presence (home vs out).

### 1.4 Success Metrics
- Reduction of weekly meal planning time from >30 minutes to <10 minutes.
- Increased dish variety: at least 2 new or rotated wishlist dishes cooked per month.
- Zero complaints from cooking a disliked dish for an attendee; seamless scheduling of adult or specific dishes when picky diners are away.

---

## 2. Scope & Boundaries (MoSCoW)

### 2.1 In Scope (Must-Have for MVP / v1.0)
- **`FR-01` Household & Member Profiles**:
  - Unified Household workspace with named member profiles (e.g., Mom, Dad, Leo, Giulia).
  - Quick profile switching without requiring separate email credentials for children.
- **`FR-02` Dish Catalog & Multi-Course Categorization**:
  - Dish title, description, notes.
  - **Course Types (`Tipi di piatto`)**: Each dish can be associated with **one or more** categories (e.g. `Primo`, `Secondo`, `Contorno`, `Piatto unico`, `Antipasto`, `Dolce`, `Bevanda`).
  - **Dish Status**: Configurable values, seeded with `Da provare`, `OK`, `Scartato`, `Da riprovare con variazioni`, `Preferito`.
- **`FR-03` Recipe Source Tracking**:
  - Structured source reference: Type (defaults: `Libro / Rivista`, `Sito Web`, `Social / Reel`, `Newsletter`, `Note personali`), Reference field (`Book title + page`, `URL`, or preparation note).
- **`FR-04` Configurable Option Architecture**:
  - Data architecture and API designed to support configurable lists (course types, statuses, source types) so custom options can be extended without code changes.
- **`FR-05` Per-Member Dish Preferences**:
  - For any `(Member, Dish)` pair, an optional preference can be set:
    - `favorite` (Piace molto / Loved)
    - `neutral` (Default: va bene / acceptable if unstated)
    - `dislike` (Non piace / Disliked)
  - Default rule: if no preference is explicitly set for a member, it is treated as `neutral` (can be scheduled freely when they are present).
- **`FR-06` Exception-Based Meal Attendance & Headcount Planner**:
  - **Default Present Principle**: Every household member is assumed **Present** by default for all scheduled meals of the day without requiring manual confirmation.
  - Users only register **exceptions (Absences)** (e.g., "Leo: Fuori a pranzo").
  - Automatic headcount calculation (Total Members - Explicit Absences).
  - Toggling an absence off immediately restores the member to Present.
- **`FR-07` Smart Meal Schedule Calendar & Compatibility Alerts**:
  - Multi-day horizon view (rolling 3 to 7 days, or weekly).
  - Assign one or more dishes (or quick notes) to each meal slot.
  - **Smart Dislike & Preference Warning**:
    - If a dish is scheduled for a meal and any **currently attending** member has marked `dislike`, the planner receives a prominent visual alert (e.g., *"Attenzione: a Leo non piace questo piatto"*).
    - If a member with `dislike` is **away**, the dish is approved without warning, signaling a great opportunity to enjoy it!
    - If all attendees have `favorite`, display a "Family Hit" badge.
- **`FR-08` Responsive & Mobile-First UI**:
  - Polished responsive design optimized for mobile phone consultation at the kitchen counter or on the go, with compact typography and efficient layout minimizing unnecessary scrolling.
- **`FR-09` Alternative Dishes & Diner Targeting (`P002`)**:
  - Ability to assign alternative dishes within the same meal slot targeted to specific members (e.g. Pasta al burro for Leo while parents eat Risotto).
  - Compatibility engine evaluates dislike warnings specifically against the designated diners rather than all attendees.
- **`FR-10` Multi-View Planner & Customizable Start of Week (`P003`, `P004`, `P005`, `P006`)**:
  - Switch between three distinct planning views: **Detailed** (full card view), **Compact Horizontal** (7-day row with meal columns), and **Compact Vertical** (days in rows, meals in columns).
  - Configurable start day of week (Monday, Saturday, Sunday, ..., Today) persisted in user preference.
- **`FR-11` Meal Slot Notes & Decoupled Post-Meal Ratings (`P010`, `J001`, `J002`, `J003`)**:
  - Support for high-level meal notes (e.g. *"Pranzo dalla nonna"*) displayed prominently at the top of the meal slot before dishes, with inline edit and delete.
  - Per-meal diner ratings (`thumbs_up`, `neutral`, `thumbs_down`) and timestamped consumption feedback notes, intentionally separated from permanent dish preferences (`J002`).
- **`FR-12` Rich Dish Search & Inline Quick-Create (`P007`, `P008`, `P009`, `D001`, `D002`, `D004`)**:
  - Dish selection modal with course filter chips and fast substring text search across titles and notes.
  - Inline creation of new dishes directly within the meal assignment modal with default status `'OK'` (`D001`) and optional source type (`D002`).
  - Removal of unused meal types from the current calendar view (`P009`).
- **`FR-13` Dish Catalog Import & Export in Excel, CSV & JSON (`D003` / Issue #2)**:
  - Dynamic export of all or currently filtered dishes in `.xlsx`, `.csv` (RFC 4180 with UTF-8 BOM), or `.json` formats.
  - Standardized canonical English headers/keys across all formats (`title`, `description`, `notes`, `status`, `source_type`, `courses`, `source_reference`, `source_url`).
  - Flexible multi-course parsing supporting bracketed lists (e.g. `["Secondo", "Piatto unico"]`), simple strings, or comma-separated values.
  - Pre-validation of mandatory fields (`title`, `status`, `courses`) with row-by-row error reporting and duplicate conflict options (`skip` vs `update`).
  - Active defense against spreadsheet formula injection (`=`, `+`, `-`, `@`) and payload size limits (5 MB).

### 2.2 Should-Have / Backlog (Tracked in `docs/archive/suggerimenti.md` & GitHub Issues)
- `G003`: Multi-language UI support (Italian / English localization) — *[Issue #1]*.
- `A001`: Guest diner support (temporary non-family diners for a meal) — *[Issue #3]*.
- `P001`: Automated weekly menu suggestions engine based on attendance, seasonal ingredients, and past rotation frequency — *[Issue #4]*.
- Automated grocery list generator aggregated from planned dishes.

### 2.3 Could-Have (Future Horizon v2.0+)
- Nutritional balance checker (alternation of proteins, vegetables, carbs, legumes over the week).
- Automatic weekly plan generator based on past frequency, seasonal ingredients, and diner attendance.

### 2.4 Explicit Non-Goals (Out of Scope for v1)
- Complex medical/caloric tracking or clinical dietetics calculations.
- Public social network feeds or global user discovery.
- Integration with smart kitchen appliances (IoT).

---

## 3. Actors, Roles & Access Control Matrix (Security Shift-Left)

| Actor / Role | Authentication Method | Permitted Actions | Restricted / Forbidden Actions |
| :--- | :--- | :--- | :--- |
| **Anonymous** | None | View landing/login screen only | Cannot view or modify any household data or meal plans |
| **Household Cook / Admin** | Household Account Login (Email/Password or Passphrase) | Full CRUD on dishes, recipes, family members, meal calendars, attendance, and member preferences | Cannot access or mutate data belonging to other households (Tenant Isolation / IDOR Protection) |
| **Household Member** | Household Member Profile session | View weekly menu, toggle own attendance, update own dish preferences (`Piace molto`, `Va bene`, `Non piace`) | Cannot delete household account or alter admin configurations |

---

## 4. Functional Requirements & User Stories

### `US-01`: Household Profiles Management
- **Story**: As a meal planner, I want to configure our household name and list our family members (e.g., Marco, Elena, Leo, Giulia), so that attendance, preferences, and meal plans reflect our real family structure.
- **Acceptance Criteria**:
  1. **Happy Path**: *Given* an authenticated household admin, *When* creating a new member with a name and avatar color/icon, *Then* the member is saved and immediately available across the meal attendance grid and preference matrix.
  2. **Validation**: *Given* an empty member name or duplicate name within the household, *When* submitting, *Then* validation returns a clear error without creating an empty record.
  3. **Security (Tenant Boundary)**: *Given* an authenticated user from Household A, *When* attempting to view or add members to Household B by manipulating IDs, *Then* the system rejects with `403 Forbidden` or `404 Not Found`.

### `US-02`: Dish Catalog with Multi-Course Categorization & Recipe Bookmarking
- **Story**: As a home cook, I want to catalog dishes with their course types (e.g. `Primo`, `Piatto unico`), status (`Da provare`, `OK`, etc.), and recipe location (book/page or link), so that recipes are easily found and categorized.
- **Acceptance Criteria**:
  1. **Happy Path**: *Given* an authenticated user, *When* creating a dish, *Then* they can select one or more course types (`Antipasto`, `Primo`, `Secondo`, `Contorno`, `Piatto unico`, `Dolce`, `Bevanda`), assign a status, and attach a source (e.g. `Libro: Il Cucchiaio d'Argento p. 88` or `URL: https://...`).
  2. **Multi-course Support**: *Given* a dish like "Insalatona di pollo", *When* assigning courses, *Then* it can be tagged as both `Secondo` and `Piatto unico`.
  3. **Validation**: *Given* an invalid URL format when Source Type is `Sito Web` or `Social / Reel`, *Then* the app highlights the invalid URL field with helpful formatting guidance.
  4. **Security**: *Given* any user input in title, notes, or source, *When* rendered in the UI, *Then* HTML and script tags are strictly sanitized/escaped (Anti-XSS).

### `US-03`: Per-Member Dish Preferences (`favorite`, `neutral`, `dislike`)
- **Story**: As a family member or cook, I want to record whether a dish is loved, fine, or disliked by specific family members, so that preferences are clearly tracked.
- **Acceptance Criteria**:
  1. **Default State (Unspecified = neutral)**: *Given* a new dish or a member who has not set a preference, *When* queried, *Then* the system evaluates the preference as `neutral` (acceptable) without requiring mandatory votes.
  2. **Explicit Preference**: *Given* a dish and a family member, *When* setting the preference to `favorite` or `dislike`, *Then* the preference is recorded for that specific person.
  3. **Update / Clear**: *Given* an existing preference, *When* resetting it, *Then* it reverts to the default `neutral`.

### `US-04`: Exception-Based Meal Attendance & Headcount Planner
- **Story**: As a family member or cook, I want everyone to be considered present by default and only indicate when someone is away, so that managing attendance requires minimal daily effort.
- **Acceptance Criteria**:
  1. **Default State (Unspecified = Present)**: *Given* any scheduled meal slot, *When* no absence is recorded for a member, *Then* that member is automatically considered Present in headcounts and compatibility checks.
  2. **Recording Absence (Exception)**: *Given* an upcoming meal slot, *When* a member is toggled off (e.g., "Leo: Fuori"), *Then* an absence exception is stored, the headcount decrements, and Leo is excluded from compatibility warnings for that meal.
  3. **Clearing Absence**: *Given* an existing absence exception, *When* toggling back to Present, *Then* the exception is cleared and the member is considered attending again.
  4. **Edge Case**: *Given* all members marked away for a meal, *Then* the slot indicates "Nessun commensale previsto" (0 commensali).
  5. **Planner Matrix Attendance Indicator (Issue #8 / Slice S11)**: *Given* horizontal (`compact_h`) or vertical (`compact_v`) matrix views, *When* viewing meal cells, *Then* a concise attendance indicator is displayed in the bottom-left corner with a static `Users` icon. If all members are present, only the icon is displayed; if present < absent, text displays `"solo {names}"`; if absent $\le$ present, text displays `"no {names}"`. In detailed view, the indicator replaces the static `"X a tavola"` badge in the slot header.
  6. **Planner Attendance Modal Dialog**: *Given* any planner view, *When* clicking the attendance indicator icon or text, *Then* a modal dialog opens displaying all household members as interactive pills matching `TodayView` styling. Users can toggle attendance in a local draft, observe live summary preview text, and choose to "Salva" (persisting changes via API and refreshing calendar compatibility alerts) or "Annulla" (discarding draft edits without network requests).

### `US-05`: Smart Meal Schedule Calendar & Preference-Attendance Compatibility
- **Story**: As a meal planner, I want to assign dishes to meal slots and be alerted if someone present dislikes the dish, while freely cooking it when they are away, so that mealtime avoids complaints.
- **Acceptance Criteria**:
  1. **Conflict Alert (Present Member Dislikes Dish)**: *Given* a dinner slot where "Leo" is attending, *When* the planner schedules a dish that Leo has marked as `dislike`, *Then* the UI displays a clear, non-blocking warning badge: *"⚠️ A Leo non piace questo piatto"*.
  2. **Clearance (Disliking Member is Away)**: *Given* the same disliked dish, *When* "Leo" is marked away for dinner and only parents are present, *Then* no warning is shown, confirming it is an ideal opportunity to cook this dish.
  3. **Positive Highlight (All Present Love Dish)**: *Given* a meal where all attending members have marked the dish as `favorite`, *Then* a celebratory badge (e.g. *"⭐ Piatto amato da tutti i presenti"*) is displayed.
  4. **Security (IDOR)**: *Given* an attempt to modify another household's meal slot via API, *Then* the request is rejected with `403 Forbidden`.

### `US-06`: Configurable Classifications Architecture
- **Story**: As the system, I want course types, dish statuses, and recipe source types to be stored in configurable tables/lookups rather than hardcoded enums, so that future versions or custom household settings can add or modify options without schema migrations.
- **Acceptance Criteria**:
  1. **Extensibility**: *Given* the database schema and API contracts, *When* a new course type (e.g., "Spuntino / Merenda") or new status (e.g., "Da riprovare in estate") is added to the configuration table, *Then* dishes can immediately reference it without code refactoring.

### `US-07`: Responsive Mobile Dashboard
- **Story**: As any family member, I want to open the web app on my phone and immediately see today's and this week's menu with zero cognitive clutter.
- **Acceptance Criteria**:
  1. **Happy Path**: *Given* a smartphone viewport (e.g. 375px width), *When* opening the dashboard, *Then* "I pasti di oggi" (Pranzo e Cena) are prominently displayed with quick attendance badges and one-tap access to recipe sources.

### `US-17`: Dish Catalog Import & Export (Excel, CSV, JSON)
- **Story**: As a meal planner or cook, I want to export our dishes to Excel, CSV, or JSON and import recipes from external files, so that I can easily migrate, back up, or mass-populate our family catalog.
- **Acceptance Criteria**:
  1. **Filtered Export**: *Given* active search query, category, or status filters, *When* clicking Export, *Then* the downloaded file (`.xlsx`, `.csv`, or `.json`) contains all and only the matching dishes.
  2. **English Field Standardization**: *Given* any export format or template, *Then* column headers and keys are consistently in English (`title`, `description`, `notes`, `status`, `source_type`, `courses`, `source_reference`, `source_url`).
  3. **Multi-Course Representation**: *Given* dishes with multiple courses, *When* exported, *Then* courses are formatted as a JSON array string (`["Secondo", "Piatto unico"]`) or native JSON array, and flexibly parsed on import.
  4. **Validation & Duplicate Modes**: *Given* an import file, *When* processing, *Then* missing mandatory fields (`title`, `status`, `courses`) are reported per row without terminating execution, and duplicate dishes are handled according to user strategy (`skip` or `update`).
  5. **Security (Shift-Left)**: *Given* text fields starting with spreadsheet formula triggers (`=, +, -, @`), *When* exporting or importing, *Then* formulas are neutralized to prevent CSV injection vulnerabilities.

### `US-18`: Meal Planner Attendance Indicator & Modal (`S11` / Issue #8)
- **Story**: As a meal planner, I want to view attendee summary information directly within each meal slot in all calendar views and quickly toggle attendance exceptions in a modal, so that I can manage who is eating at each meal with zero friction.
- **Acceptance Criteria**:
  1. **Visual Attendance Summary**: *Given* any calendar view (`compact_h`, `compact_v`, `detailed`), *When* viewing a meal slot, *Then* a concise indicator shows presence summary (e.g. icon + "solo Leo", "no Papà", or "Tutti presenti").
  2. **Interactive Attendance Modal**: *Given* a click on the attendance indicator, *When* the modal opens, *Then* family members can be toggled present/absent with immediate live summary preview and batch saving.

### `US-19`: Meal Planner Edit Assigned Dish & Diners (`S12` / Issue #9)
- **Story**: As a meal planner or family member, I want to click on any planned dish in the calendar to modify which specific diners it is intended for (or reset it to all attendees), so that alternative dishes and dietary assignments can be adapted dynamically.
- **Acceptance Criteria**:
  1. **Interactive Dish Titles in All Views**: *Given* the meal planner in any view mode (`compact_h`, `compact_v`, `detailed`), *When* clicking on a scheduled dish title or diner label, *Then* an edit assignment modal opens.
  2. **Diner Selection Experience**: *Given* the edit assignment modal, *When* switching between "Assegna a tutti i presenti" and "Assegna solo a specifici commensali", *Then* family member chips allow toggling individual diner assignments.
  3. **Atomic API Update**: *Given* modified diner assignments, *When* saving, *Then* `PATCH /calendar/slots/{slot_id}/dishes/{dish_id}` updates the assignments atomically and refreshes compatibility alerts and calendar badges immediately.

### `US-20`: Dish Tags & Cross-View Filtered Selection (`S14` / Issue #7)
- **Story**: As a meal planner, I want to assign custom tags to dishes and use them to search and filter dishes across the recipe catalog and meal planning calendar, so that I can quickly select meals matching criteria like speed, seasonality, or occasion.
- **Acceptance Criteria**:
  1. **Tag Input & Sanitization**: *Given* creating or editing a dish, *When* entering tags, *Then* tags can be added via Enter or comma, inner commas are stripped or rejected, and existing household tags are suggested with autocomplete.
  2. **Color Customization**: *Given* a tag, *When* customizing its color, *Then* the user can choose the default UI brand color, select from preset swatches, enter a hex RGB code, or use the interactive color matrix and sliders picker.
  3. **Multi-Tag AND Filtering**: *Given* multiple tags selected in the filter chips of the recipe catalog or meal planner dish picker, *When* filtering, *Then* only dishes containing **all** selected tags (AND logic) are displayed.
  4. **Full-Text Tag Search**: *Given* a search term matching a tag name, *When* searching in the dish catalog or calendar dish picker, *Then* dishes containing that tag are matched and returned.
  5. **Import & Export Roundtrip**: *Given* dish export or import in XLSX, CSV, or JSON, *When* processed, *Then* tags are exported as a clean comma-separated list and correctly imported and linked.
  6. **Inline Quick Create Support**: *Given* adding a new dish directly from the meal planner modal, *When* creating the dish on the fly, *Then* the user can assign tags using `DishTagSelector` (with any active tag filters prefilled), saving and scheduling the dish in a single seamless flow.

---

## 5. Non-Functional & Security Requirements

### `NFR-01`: Performance & Usability
- Time-to-Interactive (TTI) < 1.0s on standard mobile 4G connections.
- Instant calendar slot updates and filtering (<150ms UI response).

### `NFR-02`: Reliability & Extensibility
- Clean optimistic UI updates with automatic recovery if network drops.
- Normalized relational design for configurable lookups (`course_types`, `dish_statuses`, `source_types`, `dish_course_types`, `dish_member_preferences`).

### `SEC-01`: Zero-Trust Tenant Isolation & Auth
- All database queries must enforce the active `household_id` predicate (Defense-in-depth against IDOR).
- Passwords must be hashed using `bcrypt` / `argon2` (work factor >= 12).
- Zero secrets committed to Git repository; managed via `.env` and environment variables.

### `SEC-02`: Input Validation & Sanitization
- All payload schemas validated at API boundary using strict typed schemas (e.g., Zod / Pydantic).
- Parameterized queries / ORM mapping strictly enforced. No raw SQL string interpolation.
- Safe output encoding preventing Cross-Site Scripting (XSS).

---

## 6. Open Questions & Decisions Log

| ID | Topic | Decision | Rationale |
| :--- | :--- | :--- | :--- |
| `D-01` | Bottega Complexity Profile | **`forge`** | Multi-user family web application requiring relational integrity, clean architecture, and automated tests without over-engineering. |
| `D-02` | User Authentication Model | **Household Account + Member Profiles** | One household credential protects the home space; individual profiles allow seamless switching for children and parents on shared home tablets or personal phones. |
| `D-03` | Recipe Source Strategy | **Structured Bookmark (Source Type + Reference/URL + Notes)** | Prevents the fragility and legal headaches of full recipe scraping while giving cooks the exact reference (e.g. "Cookbook name p. 42" or bookmark URL). |
| `D-04` | Preference Model | **Granular Per-Member Rating with Default = 'neutral'** | Replaces rigid binary tags with flexible `(Member, Dish)` preference (`favorite`, `neutral`, `dislike`). Defaults to `neutral` so no overhead of voting on every single dish is needed. |
| `D-05` | Multi-Course Association | **Many-to-Many (`Dish` <-> `CourseType`)** | Dishes like *Insalatona* or *Parmigiana* can naturally serve as both a `Secondo` and a `Piatto unico`. |
| `D-06` | Configurable Classifications | **Lookup Tables with Defaults** | Built into schema architecture from day 1, allowing future UI customization without altering the database schema. |
