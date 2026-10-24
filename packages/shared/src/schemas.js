import { z } from 'zod';
export const LoginSchema = z.object({
    email: z.string().email('Please enter a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});
export const ChangePasswordSchema = z.object({
    old_password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(8, 'New password must be at least 8 characters'),
});
export const CompanySetupSchema = z.object({
    name: z.string().min(2, 'Company name is required'),
    admin_email: z.string().email(),
    admin_password: z.string().min(8),
    city: z.string().optional(),
    office_start: z.string().default('09:00'),
    grace_minutes: z.number().int().min(0).max(60).default(15),
    half_day_hours: z.number().min(1).max(12).default(5),
    weekend_days: z.array(z.number().int().min(0).max(6)).default([0, 6]),
    office_latitude: z.number().optional(),
    office_longitude: z.number().optional(),
    office_radius_meters: z.number().min(10).default(150),
    require_face_match: z.boolean().default(true),
    face_match_max_distance: z.number().default(0.55),
});
export const UpdateCompanySettingsSchema = z.object({
    office_start: z.string().optional(),
    grace_minutes: z.number().int().min(0).max(60).optional(),
    half_day_hours: z.number().min(1).max(12).optional(),
    weekend_days: z.array(z.number().int().min(0).max(6)).optional(),
    office_latitude: z.number().nullable().optional(),
    office_longitude: z.number().nullable().optional(),
    office_radius_meters: z.number().min(10).optional(),
    require_face_match: z.boolean().optional(),
    face_match_max_distance: z.number().min(0.1).max(1.5).optional(),
});
export const CreateUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['admin', 'hr', 'employee']),
});
export const RegisterEmployeeSchema = z.object({
    employee_code: z.string().min(1, 'Employee code is required'),
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    email: z.string().email('Valid email is required'),
    phone: z.string().optional(),
    address: z.string().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    joining_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
    department_id: z.string().uuid().optional(),
    designation_id: z.string().uuid().optional(),
    basic_salary: z.number().positive('Basic salary must be greater than 0'),
    status: z.enum(['active', 'probation', 'terminated', 'resigned']).default('active'),
    face_descriptor: z.any().optional(),
    face_descriptors: z.any().optional(),
    face_enrolled: z.boolean().optional(),
});
export const UpdateEmployeeSchema = z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    department_id: z.string().uuid().nullable().optional(),
    designation_id: z.string().uuid().nullable().optional(),
    basic_salary: z.number().positive().optional(),
    status: z.enum(['active', 'probation', 'terminated', 'resigned']).optional(),
    face_descriptor: z.any().optional(),
    face_descriptors: z.any().optional(),
    face_enrolled: z.boolean().optional(),
});
export const UpdateEmployeeSelfSchema = z.object({
    phone: z.string().optional(),
    address: z.string().optional(),
    face_descriptor: z.any().optional(),
    face_descriptors: z.any().optional(),
    face_enrolled: z.boolean().optional(),
});
export const CheckInSchema = z.object({
    source: z.enum(['web', 'camera']).default('web'),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    accuracy: z.number().optional(),
    face_detected: z.boolean().optional(),
    face_count: z.number().optional(),
    face_descriptor: z.array(z.number()).optional(),
    face_descriptors: z.array(z.array(z.number())).optional(),
    notes: z.string().optional(),
});
export const AttendanceCorrectionSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    requested_status: z.enum(['present', 'late', 'half_day']),
    clock_in: z.string().optional(),
    clock_out: z.string().optional(),
    reason: z.string().min(5, 'Reason must be at least 5 characters'),
});
export const ReviewCorrectionSchema = z.object({
    status: z.enum(['approved', 'rejected']),
    comment: z.string().optional(),
});
export const LeaveRequestSchema = z.object({
    leave_type_id: z.string().uuid(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().min(3, 'Reason is required'),
});
export const ReviewLeaveSchema = z.object({
    status: z.enum(['approved', 'rejected']),
    comment: z.string().optional(),
});
export const CreatePayrollDraftSchema = z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2100),
});
export const SmartLeaveParseSchema = z.object({
    message: z.string().min(3, 'Please provide leave details'),
});
export const AIChatSchema = z.object({
    prompt: z.string().min(1, 'Prompt is required'),
    conversation_history: z
        .array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
    }))
        .optional(),
});
export const AnnouncementSchema = z.object({
    title: z.string().min(2, 'Title is required'),
    content: z.string().min(5, 'Content is required'),
});
