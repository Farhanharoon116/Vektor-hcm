# Vektor HCM — Implementation Plan (v2)

> **Stack**: TypeScript + Express + Supabase (PostgreSQL) + React + Vite
> **Folder**: `/Users/ahmed/Desktop/Trakr/vektor-hcm/`
> **Source**: Adapted from `trakr-main` — HCM brief rules override Trakr logic everywhere.
>
> Items marked **🆕** were added in v2. Items marked **✏️** were corrected.

---

## 🎯 Score map (where the 110 points are)

| Criteria | Pts | What this means for the plan |
|---|---|---|
| Core HR flows | 25 | Login per role → employee → check-in → leave approval → payroll, end to end. **Build and test this first.** |
| Data & analytics | 20 | Dashboards must match records judges create. Filters (date range + department) must work. |
| AI features | 15 | Live questions in the brief (see §2.9). Role scoping and graceful failure matter. |
| Code quality | 15 | routes → services → data. Rules live in services. Validation (Zod). **Tests** 🆕 |
| UI / UX | 10 | Loading / empty / error states, 375px responsive |
| Security & RBAC | 10 | Server-side scope on every request, bcrypt, AI key on server, audit log |
| Demo & docs | 5 | Hosted link starting at first-run setup + README judges can run in 10 min |
| Bonus | +10 | Camera attendance (face + location) is the easiest +points. Then late penalty rule. |

### 🆕 Cut line (if time runs short)
Do in this order and stop when time is up. Never skip a higher item to start a lower one.
1. Auth + first-run setup + org setup + employees
2. Check-in/out + leave + approval
3. Payroll draft → finalize → payslip PDF
4. Dashboards (with filters)
5. AI chat + smart leave + summary
6. Audit log, announcements, notifications
7. Camera attendance (bonus)
8. CSV import, corrections polish, dark mode, other bonuses

---

## 🔴 HCM logic overrides (don't use Trakr's)

| Topic | Trakr logic | HCM brief requires |
|---|---|---|
| **Salary structure** | Flat `pay_rate` | `basic` + HRA (40% of basic) + medical (10% of basic) = gross = 1.5 × basic |
| **Late status** | Not implemented | After 09:15 (09:00 start + 15 min grace), read from settings |
| **Half day** | Under 4h | Under **5h** |
| **Absent** | Manual | No record AND no approved leave (on a working day) |
| **Payroll gross** | pay_rate directly | `gross = basic × 1.5` |
| **Tax slabs** | EOBI/SESSI | 0→600k=0%; 5% to 1.2M; 30k+15% to 2.4M; 210k+25% to 3.6M; 510k+35% above (on gross × 12) |
| **Payroll deduction** | Attendance-based | absent days + unpaid leave days + 0.5 × half days |
| **Leave quotas** | Custom types only | Annual=14, Sick=8, Casual=10, Unpaid=unlimited (Admin-configurable) |
| **Leave validation** | Basic | Working days only; overlap → 422; over-balance → 422 |
| **AI tools** | Sales/inventory | 7 HR tools (see §2.9) |
| **Roles** | owner/manager/cashier | admin/hr/employee |
| **Auth** | Clerk | Custom JWT + bcrypt, `must_change_password` on first login |

### 🆕 Cross-cutting rules (decide once, apply everywhere)
- **Timezone**: Railway/Supabase run in UTC. Add `companies.timezone` (default `Asia/Karachi`) and compute "today", late cutoff, working days and month boundaries **in that timezone** using one helper (`date-fns-tz` or `Intl`). A check-in at 09:20 PKT is 04:20 UTC; getting this wrong breaks late/absent logic.
- **Single company**: the brief is one company per install. Keep `company_id` columns (from Trakr) but `POST /setup` must refuse if a company already exists (409).
- **No seeded data**: leave types, departments, holidays all start empty. Instead of seeding, offer a **"Add default leave types"** button in the setup wizard (Annual 14, Sick 8, Casual 10, Unpaid unlimited) that the Admin clicks. That respects "no pre-loaded data".
- **Computed on read, not by cron**: judges test a fresh install during judging, so a nightly job will never run. `absent` and `missing_checkout` must be derived when reading reports/dashboards/payroll (for any date **before today**). Today's absent is only shown after the office day is over or as "not checked in yet". Optionally materialise with a `POST /attendance/close-day` endpoint.
- **Services layer**: routes only parse/validate and call `services/*.service.ts`. All business rules (status, leave days, payroll, tax) are pure functions where possible so they can be unit-tested.

---

## Phase 0 — Project scaffold ⏱ 30 min ✅ (done)

- [x] Folder structure, root `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`
- [x] `packages/shared` — types + Zod schemas
- [x] `packages/api` — Express skeleton (custom JWT)
- [x] `apps/web` — Vite + React skeleton
- [x] `.env.example`, `README.md`
- [ ] 🆕 Add to API: `helmet`, `cors` (allow only the Vercel origin + localhost), `express-rate-limit` (login: 10/15 min), central error handler returning `{ error, code, fields? }`
- [ ] 🆕 Add `vitest` to `packages/api` and `packages/shared`

**Decisions**
- No Clerk. `jsonwebtoken` + `bcrypt` (cost 12).
- Supabase is **database only**. API uses the **service role key** (server env only). Never expose it to the browser.

---

## Phase 1 — Database schema ⏱ 2 hours

### Migrations (in order)

```
001_companies.sql            → companies (name, timezone default 'Asia/Karachi')
002_users.sql                → users: role enum admin/hr/employee, is_active, must_change_password
003_departments.sql
004_designations.sql
005_leave_types.sql          → name, is_paid, days_per_year (NULL = unlimited)
006_public_holidays.sql
007_employees.sql            → see ✏️ below
008_attendance.sql           → see ✏️ below
009_attendance_corrections.sql
010_leave_requests.sql
011_payroll_runs.sql
012_payroll_items.sql        → ✏️ snapshot columns
013_announcements.sql
014_notifications.sql
015_audit_logs.sql
016_ai_logs.sql
017_company_settings.sql     → office_start, grace_minutes, half_day_hours (5), weekend_days,
                               office_lat, office_lng, radius_m (150), require_face_match (bool)
```

### ✏️ `employees` — missing fields the brief needs
Required for dashboards, attrition, proration and Employee 360:
`user_id` (FK users), `employee_code` (unique), `full_name`, `email` (unique), `phone`, `address`, `gender`, `date_of_birth`, `join_date`, `exit_date` (nullable), `status` (`probation | active | exited`), `department_id`, `designation_id`, `basic_salary`, plus 🆕 `face_descriptor float8[]` (nullable, for bonus face matching).
`hra`, `medical`, `gross` as generated columns (`basic * 0.4`, `basic * 0.1`, `basic * 1.5`).
Constraint: `basic_salary > 0`.

### ✏️ `attendance`
- `UNIQUE (employee_id, date)` → second check-in gives a DB-level 409 even under a race.
- Columns: `check_in timestamptz`, `check_out timestamptz`, `hours_worked numeric`, `status` enum, 🆕 `source` (`web | camera | correction`), 🆕 `lat`, `lng`, `gps_accuracy_m`, `distance_m`, `face_count`, 🆕 `face_match_score`.
- Status enum: `present | late | half_day | absent | missing_checkout | leave`.

### ✏️ `leave_requests`
- `start_date`, `end_date`, `working_days` (computed by the service and stored), `status` (`pending | approved | rejected | cancelled`), `reviewed_by`, `review_comment`.
- Overlap protection: check in the service against **pending + approved** (not only approved), plus a DB `EXCLUDE USING gist` on `daterange(start_date, end_date, '[]')` filtered to pending/approved as a safety net.

### 🆕 `payroll_items` — store a snapshot
Store, per employee per run: `basic`, `hra`, `medical`, `gross`, `working_days`, `payable_days`, `absent_days`, `unpaid_leave_days`, `half_days`, `deduction_amount`, `annual_tax`, `monthly_tax`, `net_pay`. Payslips are rendered from this row, never recomputed. That keeps finalized payslips correct even if the salary or attendance is edited later.

### 🆕 Immutability (DB level)
- Trigger: block `UPDATE/DELETE` on `payroll_runs` / `payroll_items` when the run is `finalized`.
- Trigger: block `UPDATE/DELETE` on `audit_logs` (insert-only). The brief says Admin cannot change audit entries.

---

## Phase 2 — Backend API ⏱ 5 hours

### 2.1 Auth
`packages/api/src/routes/auth.ts`
- `POST /auth/login` → bcrypt verify → JWT `{ userId, companyId, role, employeeId }`
- `POST /auth/change-password` (clears `must_change_password`)
- `GET /auth/me`
- `authMiddleware` → verify JWT **and** check `users.is_active` on each request 🆕 (so a deactivated user is locked out immediately, not when the token expires)
- 🆕 While `must_change_password = true`, every endpoint except `change-password`, `me`, `logout` returns 403 `PASSWORD_CHANGE_REQUIRED`
- `requireRole(...)` middleware
- 🆕 **Data-scope helper**: `scopeEmployeeId(req)` → returns `req.user.employeeId` for employees and the requested id for HR/Admin. Use it in every handler instead of trusting `:employee_id` from the URL.

### 🆕 2.1b First-run setup
`packages/api/src/routes/setup.ts`
- `GET /setup/status` → `{ initialized: boolean }` (public; web app uses it to decide login vs wizard)
- `POST /setup` → creates company + admin user + returns JWT. **Refuse with 409 if a company exists.**
- On boot: if no company and `ADMIN_EMAIL` / `ADMIN_PASSWORD` are set, create the admin automatically (brief allows this).

### 2.2 Company setup (admin only; HR read-only ✏️)
- `GET/PATCH /company`
- `GET/PATCH /company/settings` (HR may GET, only Admin may PATCH)
- `GET/POST/DELETE /company/departments`, `designations`, `leave-types`, `holidays` (HR GET only)
- 🆕 `POST /company/leave-types/defaults` → creates Annual 14, Sick 8, Casual 10, Unpaid (unlimited) when clicked
- Block deleting a department/designation that still has employees (409)
- Settings apply to **new records only**; never recompute old attendance rows.

### 2.3 Users
- `POST /users` → Admin only, role must be `hr` ✏️ (HR can't create admins; reject `role=admin` from the body)
- `PATCH /users/:id/deactivate`, `POST /users/:id/reset-password` (temp password + `must_change_password`)
- Admin: all users. HR: only employee-role users (and only deactivate/reset for employees).

### 2.4 Employees
- `GET /employees` → server-side search, filters (department, designation, status), paging 🆕
- `POST /employees` → HR registers employee **and creates login** (generate temp password; show it once)
- `PATCH /employees/:id` → HR full; employee only `phone`, `address` (whitelist fields, ignore the rest)
- `GET /employees/:id/360` → profile + attendance summary + leave balance + last payslip (employee: own only)
- `GET /employees/export-csv`
- `POST /employees/import-csv?dry_run=true` → returns `[{ row, field, reason }]`. Checks: required fields, unique code/email, valid email, known department, ISO date, salary > 0. Real import runs only if dry-run has zero errors.
- Salary: API calculates `hra`, `medical`, `gross` from `basic` (never trust client values).
- Salary and payroll fields are **never** returned to an employee for anyone but themselves, and are not returned in directory/search for the `employee` role.

### 2.5 Attendance
- `POST /attendance/check-in` (rename of clock-in is fine, keep one name everywhere) → body: `{ source, lat?, lng?, accuracy?, faceCount?, faceDescriptor? }`
  - Server stamps time in company timezone. Client time is ignored.
  - Duplicate → 409.
  - `late` if time > `office_start + grace_minutes`.
  - If `source = camera` → run the camera checks in §2.5b before saving.
- `POST /attendance/check-out` → `hours_worked`; `half_day` if `< half_day_hours` (5); otherwise keep present/late.
- `GET /attendance/today` → HR/Admin board (includes employees who haven't checked in as "not yet" 🆕)
- `GET /attendance/report?start&end&employee_id&dept` → synthetic `absent` rows for working days with no record and no approved leave; `on_leave` for approved leave; skip weekends/holidays; `missing_checkout` for past days with check-in but no check-out.
- `GET /attendance/me?month=` → employee calendar (own only)

#### 🆕 2.5b Camera attendance (bonus) — server rules
The phone/browser only **sends data**; the server decides. Put this in `attendance.service.ts`:

```ts
import { isPointWithinRadius, getDistance } from 'geolib';

function verifyCamera(body, settings) {
  if (body.faceCount !== 1)        throw new HttpError(422, 'FACE_COUNT', 'Exactly one face required');
  if (body.accuracy > 100)         throw new HttpError(422, 'GPS_ACCURACY', 'GPS accuracy worse than 100 m');
  if (settings.office_lat == null) throw new HttpError(422, 'NO_OFFICE_LOCATION', 'Admin has not set the office location');
  const point  = { latitude: body.lat, longitude: body.lng };
  const office = { latitude: settings.office_lat, longitude: settings.office_lng };
  const distance = getDistance(point, office);           // metres (Haversine)
  if (!isPointWithinRadius(point, office, settings.radius_m))
    throw new HttpError(422, 'OUTSIDE_RADIUS', `Outside office area (${distance} m away)`);
  return distance;
}
```

- Store the **result** (counts, distance, source), not a photo.
- A rejected camera check-in writes an audit-log entry (`attendance.camera_rejected`) with the reason.
- Fallback: a plain `source = web` check-in stays available, and the employee can file a correction. Judges want a graceful failure, not a dead end.
- **Face matching (extra bonus)**: employee enrolls once (`POST /employees/:id/face` stores a 128-d descriptor). At check-in the client sends the live descriptor; server computes Euclidean distance and accepts if `< 0.5`. Blink liveness (eye aspect ratio) is checked in the browser before the button enables.

#### Corrections
`attendance-corrections.ts`
- `POST /attendance/corrections` (employee: date, requested_status, reason)
- `GET /attendance/corrections` (HR: pending; employee: own)
- `POST .../:id/approve` and `/reject` (**HR only**; Admin is view-only ✏️). Approval updates the attendance row with `source = correction` and writes audit before/after JSON.

### 2.6 Leaves
- `GET /leaves/balance/:employee_id` → quota − **approved** days (use `scopeEmployeeId`)
- `POST /leaves` →
  - ✏️ working days only (skip company weekend days + holidays); store `working_days`
  - ✏️ reject if the range has **zero** working days (422)
  - ✏️ overlap with **pending or approved** → 422
  - over-balance: `working_days > quota − approved − pending` → 422 (unpaid exempt)
  - start must be ≤ end; reject past dates beyond a sane window
- `PATCH /leaves/:id/cancel` → employee, own, pending only (approved-cancel optional)
- `GET /leaves` → HR/Admin all; Employee own
- `POST /leaves/:id/approve|reject` → **HR only** with comment (Admin view-only ✏️). Creates notification + audit entry.
- Approved leave creates `leave` status for those days in attendance reports (derive on read; no row copying needed).

### 2.7 Payroll
```ts
// all pure functions in payroll.service.ts → unit tested
gross        = basic * 1.5
workingDays  = countWorkingDays(monthStart, monthEnd, weekendDays, holidays)
perDay       = gross / workingDays
deductDays   = absentDays + unpaidLeaveDays + 0.5 * halfDays
deduction    = deductDays * perDay
annualTax    = slab(gross * 12);  monthlyTax = annualTax / 12
net          = gross - deduction - monthlyTax
```
- 🆕 **Proration (brief requires it)**: if `join_date` or `exit_date` falls inside the month, `payableDays` = working days inside the employment window; `earnedGross = perDay × payableDays`; absences are counted only inside that window. Document the tax choice in README (tax computed on the structure's gross × 12, as the brief states).
- 🆕 Exited employees (before the month) are excluded from the run.
- Endpoints:
  - `POST /payroll/draft` (HR) → one item per active employee; one run per month (409 if exists)
  - `GET /payroll/runs`, `GET /payroll/runs/:id`
  - `POST /payroll/runs/:id/submit` (HR) — optional ✏️: let Admin finalize from `draft` **or** `submitted`, so the demo script ("HR runs payroll, Admin finalizes") doesn't need an extra step
  - `POST /payroll/runs/:id/finalize` → **Admin only**; sets locked state; creates a notification "payslip ready" for each employee 🆕
  - `GET /payroll/payslips` (employee: own, **finalized runs only** 🆕 so drafts never leak)
  - `GET /payroll/payslips/:id/pdf` → PDF built from the snapshot (`pdfkit` or `@react-pdf/renderer`)
- Salary edits after finalization don't change old payslips (snapshot) and finalized runs are rejected for edit (API + DB trigger).

### 2.8 Dashboards ✏️ (filters + formulas)
All numbers aggregated **in the database** (Postgres views / `supabase.rpc` functions or SQL via `pg`), never in the browser. Every endpoint accepts `?from=&to=&department_id=`.

| Metric | Formula |
|---|---|
| Headcount | active + probation on end date |
| Attrition | exits in period ÷ average headcount × 100 |
| Attendance rate | (present + late + missing_checkout + 0.5 × half_day) ÷ (working-day records − on_leave) |
| Late % | late ÷ (present + late) |
| Absenteeism | absent days ÷ expected working days, per department |
| Leave utilization | approved days ÷ quota, per type and department |
| Payroll cost / avg salary | sum gross & net by month and dept / mean gross by dept and designation |

- `GET /dashboard/admin` → headcount, attrition YTD, payroll cost, avg salary, headcount by dept, payroll cost by dept, gender and tenure, audit feed, announcements
- `GET /dashboard/hr` → present / on leave / late today, pending approvals, attendance trend, absenteeism by dept, leave by type, top 5 late-comers
- `GET /dashboard/employee` → hours this week vs 40, late count, leave balance, last payslip, announcements
- 🆕 **Single source of truth**: dashboard endpoints and AI tools call the **same service functions**. Then AI answers match the dashboards automatically (judges compare them).

### 2.9 AI assistant
`routes/ai.ts`, `services/ai.service.ts`, `services/ai.tools.ts`

Provider: any hosted LLM with tool calling. 🆕 A fast free tier (e.g. Groq with a Llama 3.3 70B-class model, or Gemini) is enough. Keep the key in `AI_API_KEY`.

**Endpoints** 🆕
- `POST /ai/chat` → tool loop (max 3 tool calls per message)
- `POST /ai/summarize` (admin/hr) → body = current KPI JSON + filters → 3–5 bullets using **only** those numbers
- `POST /ai/smart-leave` (employee/hr) → returns `{ type, start_date, end_date, reason }`
- Policy Q&A is `POST /ai/chat` with the §3 rules in the system prompt ("answer only from these rules or say you don't know")

**Tools**
```
get_headcount(department?, status?)
get_attendance_summary(date_from, date_to, department?)
get_late_comers(date_from, date_to, department?)
get_leave_summary(date_from, date_to, leave_type?, department?)
get_my_leave_balance()                 ← all roles, own data
get_payroll_summary(month, year)       ← admin/hr only
search_employees(query, department?)   ← admin/hr only; never returns salary
```

**🆕 Role scoping (the part judges will test)**
- Send the model **only the tools its role may use**. Employee gets `get_my_leave_balance` only (+ policy Q&A).
- The tool executor **re-checks the role and injects `employeeId` from the JWT** — never from model arguments.
- Employee asks "What is {colleague}'s salary?" → no tool exists for it, and the system prompt tells the model to politely refuse requests for other people's data.

**🆕 Smart leave details**
- Put **today's date (company timezone), weekday, weekend days and holiday list** in the prompt. "Next Monday and Tuesday" can't be resolved without it.
- Response must be JSON validated with Zod (`type` must match an existing leave type). On failure retry once, then return `{ fallback: true }` and the UI opens the normal form.
- The AI **never saves** a leave request. It only pre-fills the form; the user confirms.

**Guardrails**
- 15 s timeout with friendly fallback, 20 requests/user/hour (count from `ai_logs`), every call logged in `ai_logs` (user, role, prompt, tools used, latency, error).
- "AI-generated" label on all AI output.
- 🆕 Bonus: add one line to the system prompt so it understands Roman Urdu ("kal ki chutti chahiye" → leave request).

### 2.10 Comms & audit
- `announcements` (post: admin/hr; read: all), `notifications` (leave decision, payslip ready, correction decision; mark read), `audit-logs` (**Admin only**; HR gets 403 ✏️)
- 🆕 A single `auditService.log({ actor, action, entity, entityId, before, after })` called from services (not routes) for: create/update employee, approve/reject leave, approve/reject correction, payroll create/finalize, settings change, user create/deactivate/reset, camera rejection.

### 🆕 2.11 Tests (Code quality = 15 pts)
Keep them small, pure and fast. Minimum set:
- `calculateTaxSlab` at each boundary (600k, 1.2M, 2.4M, 3.6M and just above)
- `countWorkingDays` with weekends + holidays
- Payroll: normal month, half days, unpaid leave, mid-month joiner
- Attendance status: 09:15 exactly (present) vs 09:16 (late); 4h59 vs 5h00 hours
- Leave: overlap, over-balance, zero-working-days
- `verifyCamera`: 0 faces, 2 faces, bad accuracy, outside radius, inside radius
- RBAC: employee requesting another employee's attendance/leave/payslip gets 403/404 (supertest)
- Add `pnpm test` to the README.

---

## Phase 3 — Frontend ⏱ 6 hours

### 3.1 Auth
- `LoginPage.tsx`; on app load call `GET /setup/status` → if not initialized, route to the wizard 🆕
- `ChangePasswordPage.tsx` (forced when `must_change_password`)
- Route guards by role; menu per role; token in memory + `localStorage`; 401 → logout

### 3.2 Admin
`AdminDashboard`, `CompanySetupPage`, `DepartmentsPage` (+ designations), `LeaveTypesPage`, `HolidaysPage`, `UserManagementPage`, `AuditLogPage`
- 🆕 Company setup: **"Use my current location"** button (Geolocation API) + radius field. During the demo, set it to where you are sitting.

### 3.3 HR
`HRDashboard`, `EmployeesPage` (directory, 360 drawer, CSV import with dry-run error table, export), `AttendancePage` (board, range report, corrections tab), `LeaveRequestsPage`, `PayrollPage`

### 3.4 Employee
`EmployeeDashboard` (check-in widget), `MyAttendancePage` (calendar + correction modal), `MyLeavesPage` (balance bars, apply, **smart-leave box**, history), `MyPayslipsPage`, `MyProfilePage`

### 3.5 Shared UI
Button, Input, Select, Textarea, Modal, Badge, PageHeader, StatCard, EmptyState, Spinner, Tabs, Card, Sidebar/Topbar
- 🆕 Every data page has loading skeleton, empty state, error state with retry
- 🆕 Dashboard filter bar component (date range + department) reused by Admin and HR
- 🆕 Tables collapse to cards below 640px; sidebar becomes bottom nav

### 3.6 AI chat drawer
Slide-in panel, role-aware quick chips (HR: "Who is on leave today?", "Who came late most often this month?"; Employee: "How many sick leaves do I have left?"), smart-leave confirmation card, "AI-generated" label, friendly fallback message on timeout.

### 3.7 Camera attendance (bonus) 🆕 detailed flow
`CameraAttendancePage.tsx` / modal inside the Employee dashboard check-in widget

1. `getUserMedia({ video: { facingMode: 'user' } })` → live `<video>`
2. Load models from `apps/web/public/models` (tiny face detector; add landmark + recognition nets only for matching)
3. Detect every ~200 ms:
   - 0 faces → "No face found"; 2+ → "Only one person please"; 1 → face OK
4. `navigator.geolocation.getCurrentPosition(..., { enableHighAccuracy: true })` → show "Inside office area" / "Outside" as a **hint** (server still decides)
5. Button enabled only when 1 face + GPS accuracy ≤ 100 m
6. POST `/attendance/check-in` with `{ source: 'camera', lat, lng, accuracy, faceCount }`
7. Show server's result and error codes (`OUTSIDE_RADIUS`, `FACE_COUNT`, …)
8. "Check in without camera" link as fallback; camera/geolocation denied → friendly message
9. Tell the user what is captured (face count, location; no photo stored)

Library: `@vladmandic/face-api` (also gives descriptors for the extra bonus) or MediaPipe Face Detector for faster setup.
Remember: camera + location **require HTTPS** (Vercel is fine; localhost is fine).

---

## Phase 4 — First-run wizard ⏱ 1 hour

Shown when `GET /setup/status` says not initialized.
1. Company name + timezone + Admin email/password (`POST /setup`, which returns a JWT so the next steps are authenticated)
2. Office hours, grace minutes, weekend days
3. Office location (lat/lng/radius, "use my location", skippable)
4. First department + designations; 🆕 button **"Add default leave types"**
5. Done → Admin Dashboard
Empty dashboards must look intentional (empty states with "Add your first employee" actions).

---

## Phase 5 — Polish & security ⏱ 1 hour

- [ ] Walk every endpoint with an Employee token: other employees' attendance/leave/payslip/profile/salary → 403/404
- [ ] HR token: settings PATCH, create admin, finalize payroll, audit log → 403
- [ ] Admin token: approve leave/correction → 403 (view-only per brief)
- [ ] Finalized payroll immutable (API + DB trigger); audit log insert-only
- [ ] `AI_API_KEY`, `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` only in backend env; `.env.example` has keys with no values; real `.env` in `.gitignore` (check git history before pushing)
- [ ] Zod validation on every body/query; never return `password_hash`
- [ ] bcrypt cost 12; login rate limit; generic "invalid credentials" message
- [ ] Mobile pass at 375px
- [ ] 🆕 Optional bonus: late penalty rule (3 lates = 0.5 day deduction) as a setting that feeds payroll

---

## Phase 6 — Deployment ⏱ 30 min

| Service | What |
|---|---|
| **Vercel** | `apps/web` (add SPA rewrite so `/login` etc. don't 404 on refresh) |
| **Railway** (or Render) | `packages/api` |
| **Supabase** | Database (free tier) |

- 🆕 Set `VITE_API_URL` in Vercel and CORS origin in Railway. Both must be HTTPS.
- 🆕 Run all migrations on the **hosted** DB and confirm the live site opens at the first-run wizard on an empty database. Do not leave test data in it: judges create their own.
- 🆕 Deploy a **working skeleton early** (after Phase 2.1), not at the end. Fix CORS/env problems while there's time.
- README must cover: stack, run locally, first Admin (wizard or `ADMIN_EMAIL`/`ADMIN_PASSWORD`), how to set the AI key, how to run tests, **what is done and not done**, camera attendance notes, tax/proration assumptions.
- Repo public (or shared with judges). Submit repo link + hosted link on `lms.saylaniit.com` (each team member from their own portal).

---

## 🆕 Demo rehearsal (5 minutes, matches the brief's script)

1. Fresh install → wizard (company, hours, location, department, default leave types) → create HR login
2. HR registers 2–3 employees → one employee signs in, changes password, checks in (try camera)
3. Employee types "Need next Monday and Tuesday off for a wedding" → confirms pre-filled form → HR approves
4. HR dashboard → **Summarize** → ask "Who is on leave today?" → run payroll → Admin finalizes
5. Employee downloads payslip → asks colleague's salary (refused) → Admin opens audit log

Run this exact script twice on the **hosted** URL before presenting. Also have ready: a seeded-by-hand set of one late check-in and one half day so the dashboards and payroll show non-zero deductions (create them through the app, not SQL).

---

## Build order (updated)

```
Phase 0 scaffold (done) + helpers (helmet, errors, vitest, timezone util)
   ↓
Phase 1: migrations (incl. employee fields, attendance camera columns, payroll snapshots, triggers)
   ↓
2.1 Auth + 2.1b Setup  → deploy skeleton to Vercel/Railway/Supabase NOW
   ↓
2.2 Company setup → 2.4 Employees → 2.5 Attendance (+ corrections)
   ↓
2.6 Leaves → 2.7 Payroll (+ PDF) → 2.8 Dashboards (+ filters)
   ↓
Frontend pages in the same order as the backend (don't build UI for modules whose API isn't done)
   ↓
2.9 AI (tools share services with dashboards) → 2.10 audit/notifications/announcements
   ↓
2.11 Tests (write the pure-function ones as you build each service, not at the end)
   ↓
3.7 Camera attendance (bonus) → Phase 5 polish → final deploy check → demo rehearsal
```
