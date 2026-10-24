# Vektor HCM — AI-Assisted Human Capital Management
### Saylani Hackathon 2026 · Challenge: HCM Lite (Zaitoon Ashraf IT Park)

> **Live Demo & README ready for judges to run in under 3 minutes.**  
> Built with zero pre-loaded dummy data: Admin initializes company, HR registers employees, and all metrics, calculations & AI answers derive dynamically from live system records.

---

## 📋 Prerequisites

Before running Vektor HCM locally, ensure you have:

1. **Node.js**: `v18.0.0` or higher (`v20.x` LTS recommended). Verify with `node -v`.
2. **npm**: `v9.0.0` or higher (`npm -v`).
3. **PostgreSQL Database (Supabase)**:
   - A free Supabase project with database credentials.
   - A Supabase Storage bucket named `biometrics` (or public storage) for live face enrollment reference images.
4. **Modern Web Browser**: Google Chrome, Edge, or Brave with **Camera** and **Location** permissions allowed for live webcam biometric matching and geofenced attendance.
5. **AI Assistant API Key** *(Optional / Recommended for AI features)*:
   - A [Groq Cloud](https://console.groq.com/) API Key (`AI_API_KEY`) for instant LLM inference using `openai/gpt-oss-20b` or `llama-3.3-70b`.
6. **Resend API Key** *(Optional for Email verification & OTP)*:
   - A [Resend](https://resend.com/) API key (`RESEND_API_KEY`) to send real OTP verification codes and employee credential emails.

---

## ⚡ Tech Stack & Architecture

- **Frontend**: React 18, Vite, TypeScript, TailwindCSS (light aesthetic with crisp white cards & modern typography), Recharts, Lucide Icons, Zustand, Face-API.js.
- **Backend**: Node.js, Express, TypeScript, Custom JWT authentication with bcrypt password hashing, PDFKit.
- **Database**: PostgreSQL (Supabase) with real-time foreign keys, indexed constraints, and audit logging.
- **AI Intelligence**: Hosted LLM API (`openai/gpt-oss-20b`) with 7 role-scoped HR tools, smart leave parser (supports English & Roman Urdu), dashboard KPI summarizer, multi-turn conversation memory, and anti-hallucination live database injection.
- **Webcam Biometrics & Geofencing**: Browser `MediaDevices` video stream with multi-frame live capture (5 frames across directional poses), Euclidean distance verification (`distance < 0.55`), anti-spoofing Eye Aspect Ratio (EAR) blink detection, and GPS Haversine distance validation against office coordinates.
- **Bulk Data & Reporting**: Full CSV export, CSV import with drag-and-drop file upload & dry-run validation, and official PDF payslip generation.

---

## 🚀 Quick Start (Using `npm`)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Farhanharoon116/Vektor-hcm
cd vektor-hcm

# Install all monorepo workspace dependencies
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `packages/api/.env`:
```bash
cp .env.example packages/api/.env
```
Edit `packages/api/.env` with your credentials:
```env
# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[supabase-service-role-key]
SUPABASE_ANON_KEY=[supabase-anon-key]

# Authentication
JWT_SECRET=super-secret-vektor-jwt-key-minimum-32-chars-long
JWT_EXPIRES_IN=7d

# Server
PORT=3001
CORS_ORIGIN=http://localhost:5173

# AI Assistant (Groq Cloud)
AI_API_KEY=gsk_your_groq_api_key_here
AI_MODEL=openai/gpt-oss-20b
AI_BASE_URL=https://api.groq.com/openai/v1

# Email Service (Resend - Optional)
RESEND_API_KEY=re_your_resend_api_key_here
RESEND_FROM_EMAIL=Vektor HCM <support@gettrakr.tech>

# First-Run Fallback
ADMIN_EMAIL=admin@vektor.local
ADMIN_PASSWORD=AdminPassword123!
```

### 3. Apply PostgreSQL Migrations
Execute the migrations in the Supabase SQL Editor in order:
1. `supabase/migrations/001_initial_schema.sql` (Creates companies, users, employees, attendance, leaves, payroll, audit logs, AI logs)
2. `supabase/migrations/002_face_descriptors_and_match_distance.sql` (Adds multi-frame face descriptor storage and configurable Euclidean distance matching)

### 4. Start Development Servers
```bash
npm run dev
```
Both services will launch concurrently:
- **Web Application**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001/api/v1`

---

## 🧪 Testing & Verification

Run the automated test suite across calculations, tax brackets, attendance logic, geofencing, and biometric Euclidean distance matching:

```bash
# Run all 24 unit & calculation tests
npm test

# Build all monorepo packages for production verification
npm run build
```

---

## 🎯 5-Minute Live Demo Flow for Judges

### 1. First-Run Setup Wizard (`/setup`)
- If the database has no registered company, you are automatically redirected to the Setup Wizard.
- Enter Company Name (`Saylani Tech Solutions`), Admin Email (`admin@vektor.local`), Password (`AdminPassword123!`), Office Start Time (`09:00`), Grace Window (`15m`), and Geofence Radius (`150m`).
- Setup seeds the default company structure, standard departments, designations, and statutory leave quotas.

### 2. Admin Creates HR Login (`/admin/users`)
- Log in as Admin (`admin@vektor.local`).
- Navigate to **User Management** and create an HR user (`hr@vektor.local`). A temporary password is generated or emailed.

### 3. HR Registers Employees & CSV Import (`/hr/employees`)
- Log in as HR (`hr@vektor.local`).
- Click **+ Register Employee**:
  - Register `Bilal Tariq` (`EMP-001`, Basic Salary `PKR 80,000`).
  - Notice live salary auto-breakdown: `Gross = Basic × 1.5` (PKR 80,000 Basic + PKR 32,000 HRA + PKR 8,000 Medical = PKR 120,000 Gross).
- **Bulk CSV Upload**:
  - Click **Import CSV**, drag and drop `sample_employees.csv`, review the dry-run column mapper, and import with 1 click.
- **Instant 360° Employee Drawer**:
  - Click **360 View** on any employee row.
  - Notice the instant drawer slide-in with custom loading skeletons for Compensation, Monthly Attendance, Leave Balances, and Biometric Profile.

### 4. Live Multi-Frame Face Enrollment (`/hr/employees`)
- On the employee's 360 profile, click **Enroll Face**:
  - Live webcam opens with directional head guidance.
  - Captures 5 high-quality face descriptor frames (straight, slight left, slight right).
  - Anti-spoofing EAR blink validation ensures enrollment from a real human, not a static photo.

### 5. Employee Check-In & AI Smart Leave
- Sign in as an employee (`emp@vektor.local`).
- **Camera Biometric Check-In (`/employee/camera-attendance`)**:
  - Camera detects live face, measures Euclidean distance (`distance < 0.55`), and verifies GPS geofence distance (`< 150m`).
  - Checks in instantly with sub-second feedback.
- **Smart Leave Application**:
  - Open **Leave Requests** and type in plain English or Roman Urdu:
    > *"Need next Monday and Tuesday off for my sister's wedding"*
  - Click **Smart Fill**: AI automatically determines the date range, selects Casual Leave, calculates working days (skipping weekends & holidays), and populates the form!

### 6. HR Approvals & Automated Payroll Run (`/hr/payroll`)
- HR reviews and approves pending leave requests.
- Navigate to `/hr/payroll` and click **Generate Monthly Payroll**:
  - Computes working days in the month.
  - Deducts absences, unpaid leaves, and half-days: `Deduction = (Absent + Unpaid + 0.5 × Half Days) × Per Day Rate`.
  - Calculates annual tax slabs dynamically on annualized gross salary.
  - Net Pay is calculated with zero rounding errors.
- HR clicks **Submit to Admin for Review**.
- Admin reviews the payroll summary and clicks **Finalize & Lock Month** (permanently locks the month from changes).

### 7. Official PDF Payslips & AI Guardrails
- Employee downloads their official PDF payslip from `/employee/payslips` (rendered cleanly with corporate header, earnings, tax deductions, and highlighted Net Take-Home Pay).
- Open the **Vektor HCM AI Assistant**:
  - Ask: *"What is Bilal's salary?"*
  - AI **politely refuses** under company privacy guardrails.
  - Ask: *"How many active employees are in the company?"* or in Roman Urdu: *"kitne log aj nahi aye"*
  - AI responds with **exact, verified live database figures** without hallucination!

---

## 📊 Business Rules Implemented

| Rule | Implementation & Formula |
|---|---|
| **Salary Structure** | `Basic (100%)` + `House Rent (40%)` + `Medical (10%)` = `Gross Salary (150%)` |
| **Late Cutoff** | Check-in after `09:15` (`09:00` start + `15m` grace) is automatically flagged `late` |
| **Half-Day Rule** | Total working hours under `5.0h` is automatically classified as `half_day` |
| **Daily Rate** | `Daily Rate = Gross Salary / Working Days in Month` |
| **Payroll Deductions** | `Deduction Days = Absent Days + Unpaid Leave Days + (0.5 × Half Days)`<br>`Attendance Deduction = Deduction Days × Daily Rate` |
| **Tax Slabs (Annualized)** | • `0 - 600k`: 0%<br>• `600k - 1.2M`: 5% on excess over 600k<br>• `1.2M - 2.4M`: 30,000 + 15% on excess over 1.2M<br>• `2.4M - 3.6M`: 210,000 + 25% on excess over 2.4M<br>• `> 3.6M`: 510,000 + 35% on excess over 3.6M |
| **Leave Validation** | Deducts working days only (skips weekends and public holidays); rejects overlapping requests (422) and overdrafts (422) |
| **Face Biometrics** | Multi-frame 128-d Euclidean distance matching (`distance < 0.55`); EAR blink detection; live webcam verification |
| **Geofence Validation** | Haversine formula distance verification between device GPS and office coordinates (`≤ 150m`) |
| **AI Confidentiality** | Strict role-scoping; employees cannot access colleague salaries or company-wide payroll totals; live ground-truth DB injection |

---

*Saylani Hackathon · 24 October 2026 · Zaitoon Ashraf IT Park*
