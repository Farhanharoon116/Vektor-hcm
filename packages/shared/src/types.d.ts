export type UserRole = 'admin' | 'hr' | 'employee';
export interface Company {
    id: string;
    name: string;
    logo_url?: string;
    city?: string;
    email?: string;
    created_at: string;
    updated_at: string;
}
export interface CompanySettings {
    id: string;
    company_id: string;
    office_start: string;
    grace_minutes: number;
    half_day_hours: number;
    weekend_days: number[];
    office_latitude?: number;
    office_longitude?: number;
    office_radius_meters: number;
    created_at: string;
    updated_at: string;
}
export interface User {
    id: string;
    company_id: string;
    email: string;
    role: UserRole;
    is_active: boolean;
    must_change_password: boolean;
    created_at: string;
    updated_at: string;
}
export interface Department {
    id: string;
    company_id: string;
    name: string;
    created_at: string;
}
export interface Designation {
    id: string;
    company_id: string;
    title: string;
    created_at: string;
}
export interface LeaveType {
    id: string;
    company_id: string;
    name: string;
    is_paid: boolean;
    days_per_year: number;
    created_at: string;
}
export interface PublicHoliday {
    id: string;
    company_id: string;
    name: string;
    date: string;
    created_at: string;
}
export type EmploymentStatus = 'active' | 'probation' | 'terminated' | 'resigned';
export interface Employee {
    id: string;
    company_id: string;
    user_id?: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    address?: string;
    gender?: 'male' | 'female' | 'other';
    joining_date: string;
    department_id?: string;
    designation_id?: string;
    status: EmploymentStatus;
    basic_salary: number;
    hra: number;
    medical: number;
    gross_salary: number;
    face_enrolled?: boolean;
    face_descriptor?: number[];
    department?: Department;
    designation?: Designation;
    created_at: string;
    updated_at: string;
}
export type AttendanceStatus = 'present' | 'late' | 'half_day' | 'absent' | 'missing_checkout' | 'leave';
export interface AttendanceRecord {
    id: string;
    company_id: string;
    employee_id: string;
    date: string;
    clock_in?: string;
    clock_out?: string;
    hours_worked?: number;
    status: AttendanceStatus;
    check_in_source?: 'web' | 'camera';
    check_in_latitude?: number;
    check_in_longitude?: number;
    distance_meters?: number;
    face_verified?: boolean;
    notes?: string;
    employee?: {
        first_name: string;
        last_name: string;
        employee_code: string;
        department?: {
            name: string;
        };
    };
    created_at: string;
    updated_at: string;
}
export type CorrectionStatus = 'pending' | 'approved' | 'rejected';
export interface AttendanceCorrection {
    id: string;
    company_id: string;
    employee_id: string;
    attendance_id?: string;
    date: string;
    requested_status: AttendanceStatus;
    clock_in?: string;
    clock_out?: string;
    reason: string;
    status: CorrectionStatus;
    reviewed_by?: string;
    reviewed_at?: string;
    review_comment?: string;
    employee?: {
        first_name: string;
        last_name: string;
        employee_code: string;
    };
    created_at: string;
}
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export interface LeaveRequest {
    id: string;
    company_id: string;
    employee_id: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    days_count: number;
    reason: string;
    status: LeaveRequestStatus;
    reviewed_by?: string;
    reviewed_at?: string;
    review_comment?: string;
    employee?: {
        first_name: string;
        last_name: string;
        employee_code: string;
        department?: {
            name: string;
        };
    };
    leave_type?: LeaveType;
    created_at: string;
}
export interface LeaveBalance {
    leave_type_id: string;
    leave_type_name: string;
    is_paid: boolean;
    quota: number;
    used: number;
    balance: number;
}
export type PayrollRunStatus = 'draft' | 'submitted' | 'finalized';
export interface PayrollRun {
    id: string;
    company_id: string;
    month: number;
    year: number;
    status: PayrollRunStatus;
    working_days: number;
    total_gross: number;
    total_deductions: number;
    total_tax: number;
    total_net: number;
    employee_count: number;
    created_by: string;
    submitted_by?: string;
    submitted_at?: string;
    finalized_by?: string;
    finalized_at?: string;
    created_at: string;
}
export interface PayrollItem {
    id: string;
    payroll_run_id: string;
    employee_id: string;
    basic_salary: number;
    hra: number;
    medical: number;
    gross_salary: number;
    working_days: number;
    per_day_rate: number;
    present_days: number;
    late_days: number;
    half_days: number;
    absent_days: number;
    paid_leave_days: number;
    unpaid_leave_days: number;
    deduction_days: number;
    salary_deduction: number;
    annual_taxable_salary: number;
    monthly_tax: number;
    net_salary: number;
    employee?: {
        first_name: string;
        last_name: string;
        employee_code: string;
        department?: {
            name: string;
        };
        designation?: {
            title: string;
        };
    };
    created_at: string;
}
export interface Announcement {
    id: string;
    company_id: string;
    title: string;
    content: string;
    posted_by: string;
    poster_name?: string;
    created_at: string;
}
export interface Notification {
    id: string;
    company_id: string;
    user_id: string;
    title: string;
    message: string;
    type: 'leave' | 'attendance' | 'payroll' | 'general';
    is_read: boolean;
    link?: string;
    created_at: string;
}
export interface AuditLog {
    id: string;
    company_id: string;
    actor_id: string;
    actor_email: string;
    actor_role: UserRole;
    action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'finalize' | 'login';
    entity: string;
    entity_id?: string;
    details?: Record<string, any>;
    created_at: string;
}
export interface AILog {
    id: string;
    company_id: string;
    user_id: string;
    role: UserRole;
    prompt: string;
    tool_called?: string;
    response: string;
    duration_ms: number;
    created_at: string;
}
export interface DashboardSummary {
    bullets: string[];
    summary: string;
    generated_at: string;
}
