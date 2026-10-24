# Vektor HCM — AI-Assisted Human Capital Management
### Saylani Hackathon 2026 · Challenge: HCM Lite (Zaitoon Ashraf IT Park)

> **Live Demo & README ready for judges to run in under 5 minutes.**  
> Built with zero pre-loaded dummy data: Admin initializes company, HR registers employees, and all metrics, calculations & AI answers derive dynamically from live system records.

---

## ⚡ Tech Stack & Architecture

- **Frontend**: React 18, Vite, TypeScript, TailwindCSS (Light aesthetic with crisp white cards & modern typography), Recharts, Lucide Icons, Zustand.
- **Backend**: Node.js, Express, TypeScript, Custom JWT authentication with bcrypt password hashing.
- **Database**: PostgreSQL (Supabase).
- **AI Intelligence**: Hosted LLM API with 7 role-scoped HR tools, smart leave parser (supports English & Roman Urdu), dashboard KPI summarizer, and policy Q&A.
- **Camera Biometrics & Geofence**: Browser MediaDevices video stream with facial alignment oval + GPS Geolocation Haversine distance verification against company office boundaries.

---

## 🚀 Quick Start (Under 3 Minutes)

### 1. Install Dependencies
```bash
cd /Users/ahmed/Desktop/Trakr/vektor-hcm
pnpm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `packages/api/.env`:
```bash
cp .env.example packages/api/.env
```
*(Ensure `DATABASE_URL`, `SUPABASE_URL`, and `AI_API_KEY` are configured)*

### 3. Apply PostgreSQL Migration
Run the SQL migration in `supabase/migrations/001_initial_schema.sql` via Supabase SQL Editor.

### 4. Start Development Servers
```bash
pnpm dev
```
- **Web App**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001/api/v1`

---

## 🎯 5-Minute Live Demo Flow for Judges

1. **First-Run Setup Wizard (`/setup`)**:
   - Opens on fresh install when no company exists.
   - Enter Company Name (`Saylani Tech Solutions`), Admin Email (`admin@vektor.local`), Password (`AdminPassword123!`), Office Start (`09:00`), Grace (`15m`), and Geofence radius (`150m`).
   - Automatically initializes default departments, designations, and standard leave types.

2. **Admin Creates HR Login (`/admin/users`)**:
   - Create HR user (`hr@vektor.local`). Issue temporary password.

3. **HR Registers Employees (`/hr/employees`)**:
   - Register employee `Bilal Tariq` (`EMP-001`, Basic Salary `PKR 80,000`).
   - Notice live salary calculator: `Gross = Basic × 1.5` (PKR 80,000 Basic + PKR 32,000 HRA + PKR 8,000 Medical = PKR 120,000 Gross).
   - Generates employee login credentials with temporary password.

4. **Employee Check-In & AI Smart Leave**:
   - Sign in as employee. Required to update temporary password.
   - Perform Web Check-In or Camera Biometric Check-In (`/employee/camera-attendance`).
   - Open Leave Application: Type natural sentence:
     > *"Need next Monday and Tuesday off for my sister's wedding"*
   - Click **Smart Fill**: AI automatically detects dates, picks Casual leave, and fills reason!
   - Submit request (validates working days, skips weekends/holidays, overlap check, quota check).

5. **HR Approvals & Payroll Run**:
   - HR approves the leave request with a comment.
   - Navigate to `/hr/payroll` and click **Generate Payroll Run** for the month.
   - Computes working days, deducts absent/unpaid days, applies annual tax slabs, and calculates net pay.
   - HR clicks **Submit to Admin**.
   - Admin logs in, clicks **Finalize & Lock Month** (permanently locked and immutable).

6. **Employee Payslip & Confidentiality Test**:
   - Employee views payslip and downloads official PDF with salary breakdown.
   - Open AI Assistant and ask: *"What is colleague's salary?"*
   - AI assistant **politely refuses** under company privacy guardrails!
   - Admin opens `/admin/audit` to view the complete audit trail.

---

## 📊 Business Rules Implemented

| Rule | Implementation |
|---|---|
| **Salary Structure** | `Basic` + `HRA (40%)` + `Medical (10%)` = `Gross (150%)` |
| **Late Clock-in** | Server derives `late` if check-in > 09:15 (09:00 start + 15m grace) |
| **Half-Day Rule** | Server derives `half_day` if total working hours < 5.0h |
| **Payroll Deduction** | `Deduction Days = Absent + Unpaid Leave + (0.5 × Half Days)`. Daily rate = `Gross / Working Days` |
| **Tax Slabs** | 0 to 600k (0%), 600k to 1.2M (5%), 1.2M to 2.4M (30k + 15%), 2.4M to 3.6M (210k + 25%), >3.6M (510k + 35%) |
| **Leave Validation** | Working days only (skips weekends + holidays); overlap check (422); over-balance check (422) |
| **Role-based AI** | 7 tools scoped by role; Employee cannot query other salaries or company totals |
| **Camera & Geofence** | Face alignment check + Haversine distance ≤ 150m from office coordinates |

---

*Saylani Hackathon · 24 October 2026 · Zaitoon Ashraf IT Park*
