import { z } from 'zod';
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const ChangePasswordSchema: z.ZodObject<{
    old_password: z.ZodString;
    new_password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    old_password: string;
    new_password: string;
}, {
    old_password: string;
    new_password: string;
}>;
export declare const CompanySetupSchema: z.ZodObject<{
    name: z.ZodString;
    admin_email: z.ZodString;
    admin_password: z.ZodString;
    city: z.ZodOptional<z.ZodString>;
    office_start: z.ZodDefault<z.ZodString>;
    grace_minutes: z.ZodDefault<z.ZodNumber>;
    half_day_hours: z.ZodDefault<z.ZodNumber>;
    weekend_days: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
    office_latitude: z.ZodOptional<z.ZodNumber>;
    office_longitude: z.ZodOptional<z.ZodNumber>;
    office_radius_meters: z.ZodDefault<z.ZodNumber>;
    require_face_match: z.ZodDefault<z.ZodBoolean>;
    face_match_max_distance: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    admin_email: string;
    admin_password: string;
    office_start: string;
    grace_minutes: number;
    half_day_hours: number;
    weekend_days: number[];
    office_radius_meters: number;
    require_face_match: boolean;
    face_match_max_distance: number;
    city?: string | undefined;
    office_latitude?: number | undefined;
    office_longitude?: number | undefined;
}, {
    name: string;
    admin_email: string;
    admin_password: string;
    city?: string | undefined;
    office_start?: string | undefined;
    grace_minutes?: number | undefined;
    half_day_hours?: number | undefined;
    weekend_days?: number[] | undefined;
    office_latitude?: number | undefined;
    office_longitude?: number | undefined;
    office_radius_meters?: number | undefined;
    require_face_match?: boolean | undefined;
    face_match_max_distance?: number | undefined;
}>;
export declare const UpdateCompanySettingsSchema: z.ZodObject<{
    office_start: z.ZodOptional<z.ZodString>;
    grace_minutes: z.ZodOptional<z.ZodNumber>;
    half_day_hours: z.ZodOptional<z.ZodNumber>;
    weekend_days: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    office_latitude: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    office_longitude: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    office_radius_meters: z.ZodOptional<z.ZodNumber>;
    require_face_match: z.ZodOptional<z.ZodBoolean>;
    face_match_max_distance: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    office_start?: string | undefined;
    grace_minutes?: number | undefined;
    half_day_hours?: number | undefined;
    weekend_days?: number[] | undefined;
    office_latitude?: number | null | undefined;
    office_longitude?: number | null | undefined;
    office_radius_meters?: number | undefined;
    require_face_match?: boolean | undefined;
    face_match_max_distance?: number | undefined;
}, {
    office_start?: string | undefined;
    grace_minutes?: number | undefined;
    half_day_hours?: number | undefined;
    weekend_days?: number[] | undefined;
    office_latitude?: number | null | undefined;
    office_longitude?: number | null | undefined;
    office_radius_meters?: number | undefined;
    require_face_match?: boolean | undefined;
    face_match_max_distance?: number | undefined;
}>;
export declare const CreateUserSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodEnum<["admin", "hr", "employee"]>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    role: "admin" | "hr" | "employee";
}, {
    email: string;
    password: string;
    role: "admin" | "hr" | "employee";
}>;
export declare const RegisterEmployeeSchema: z.ZodObject<{
    employee_code: z.ZodString;
    first_name: z.ZodString;
    last_name: z.ZodString;
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodEnum<["male", "female", "other"]>>;
    joining_date: z.ZodString;
    department_id: z.ZodOptional<z.ZodString>;
    designation_id: z.ZodOptional<z.ZodString>;
    basic_salary: z.ZodNumber;
    status: z.ZodDefault<z.ZodEnum<["active", "probation", "terminated", "resigned"]>>;
    face_descriptor: z.ZodOptional<z.ZodAny>;
    face_descriptors: z.ZodOptional<z.ZodAny>;
    face_enrolled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email: string;
    status: "active" | "probation" | "terminated" | "resigned";
    employee_code: string;
    first_name: string;
    last_name: string;
    joining_date: string;
    basic_salary: number;
    phone?: string | undefined;
    address?: string | undefined;
    gender?: "male" | "female" | "other" | undefined;
    department_id?: string | undefined;
    designation_id?: string | undefined;
    face_descriptor?: any;
    face_descriptors?: any;
    face_enrolled?: boolean | undefined;
}, {
    email: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    joining_date: string;
    basic_salary: number;
    status?: "active" | "probation" | "terminated" | "resigned" | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    gender?: "male" | "female" | "other" | undefined;
    department_id?: string | undefined;
    designation_id?: string | undefined;
    face_descriptor?: any;
    face_descriptors?: any;
    face_enrolled?: boolean | undefined;
}>;
export declare const UpdateEmployeeSchema: z.ZodObject<{
    first_name: z.ZodOptional<z.ZodString>;
    last_name: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodEnum<["male", "female", "other"]>>;
    department_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    designation_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    basic_salary: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["active", "probation", "terminated", "resigned"]>>;
    face_descriptor: z.ZodOptional<z.ZodAny>;
    face_descriptors: z.ZodOptional<z.ZodAny>;
    face_enrolled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "probation" | "terminated" | "resigned" | undefined;
    first_name?: string | undefined;
    last_name?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    gender?: "male" | "female" | "other" | undefined;
    department_id?: string | null | undefined;
    designation_id?: string | null | undefined;
    basic_salary?: number | undefined;
    face_descriptor?: any;
    face_descriptors?: any;
    face_enrolled?: boolean | undefined;
}, {
    status?: "active" | "probation" | "terminated" | "resigned" | undefined;
    first_name?: string | undefined;
    last_name?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    gender?: "male" | "female" | "other" | undefined;
    department_id?: string | null | undefined;
    designation_id?: string | null | undefined;
    basic_salary?: number | undefined;
    face_descriptor?: any;
    face_descriptors?: any;
    face_enrolled?: boolean | undefined;
}>;
export declare const UpdateEmployeeSelfSchema: z.ZodObject<{
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    face_descriptor: z.ZodOptional<z.ZodAny>;
    face_descriptors: z.ZodOptional<z.ZodAny>;
    face_enrolled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    phone?: string | undefined;
    address?: string | undefined;
    face_descriptor?: any;
    face_descriptors?: any;
    face_enrolled?: boolean | undefined;
}, {
    phone?: string | undefined;
    address?: string | undefined;
    face_descriptor?: any;
    face_descriptors?: any;
    face_enrolled?: boolean | undefined;
}>;
export declare const CheckInSchema: z.ZodObject<{
    source: z.ZodDefault<z.ZodEnum<["web", "camera"]>>;
    latitude: z.ZodOptional<z.ZodNumber>;
    longitude: z.ZodOptional<z.ZodNumber>;
    accuracy: z.ZodOptional<z.ZodNumber>;
    face_detected: z.ZodOptional<z.ZodBoolean>;
    face_count: z.ZodOptional<z.ZodNumber>;
    face_descriptor: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    face_descriptors: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodNumber, "many">, "many">>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source: "web" | "camera";
    face_descriptor?: number[] | undefined;
    face_descriptors?: number[][] | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
    accuracy?: number | undefined;
    face_detected?: boolean | undefined;
    face_count?: number | undefined;
    notes?: string | undefined;
}, {
    face_descriptor?: number[] | undefined;
    face_descriptors?: number[][] | undefined;
    source?: "web" | "camera" | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
    accuracy?: number | undefined;
    face_detected?: boolean | undefined;
    face_count?: number | undefined;
    notes?: string | undefined;
}>;
export declare const AttendanceCorrectionSchema: z.ZodObject<{
    date: z.ZodString;
    requested_status: z.ZodEnum<["present", "late", "half_day"]>;
    clock_in: z.ZodOptional<z.ZodString>;
    clock_out: z.ZodOptional<z.ZodString>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    date: string;
    requested_status: "present" | "late" | "half_day";
    reason: string;
    clock_in?: string | undefined;
    clock_out?: string | undefined;
}, {
    date: string;
    requested_status: "present" | "late" | "half_day";
    reason: string;
    clock_in?: string | undefined;
    clock_out?: string | undefined;
}>;
export declare const ReviewCorrectionSchema: z.ZodObject<{
    status: z.ZodEnum<["approved", "rejected"]>;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "approved" | "rejected";
    comment?: string | undefined;
}, {
    status: "approved" | "rejected";
    comment?: string | undefined;
}>;
export declare const LeaveRequestSchema: z.ZodObject<{
    leave_type_id: z.ZodString;
    start_date: z.ZodString;
    end_date: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
}, {
    reason: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
}>;
export declare const ReviewLeaveSchema: z.ZodObject<{
    status: z.ZodEnum<["approved", "rejected"]>;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "approved" | "rejected";
    comment?: string | undefined;
}, {
    status: "approved" | "rejected";
    comment?: string | undefined;
}>;
export declare const CreatePayrollDraftSchema: z.ZodObject<{
    month: z.ZodNumber;
    year: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    month: number;
    year: number;
}, {
    month: number;
    year: number;
}>;
export declare const SmartLeaveParseSchema: z.ZodObject<{
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
}, {
    message: string;
}>;
export declare const AIChatSchema: z.ZodObject<{
    prompt: z.ZodString;
    conversation_history: z.ZodOptional<z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant", "system"]>;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "user" | "assistant" | "system";
        content: string;
    }, {
        role: "user" | "assistant" | "system";
        content: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    conversation_history?: {
        role: "user" | "assistant" | "system";
        content: string;
    }[] | undefined;
}, {
    prompt: string;
    conversation_history?: {
        role: "user" | "assistant" | "system";
        content: string;
    }[] | undefined;
}>;
export declare const AnnouncementSchema: z.ZodObject<{
    title: z.ZodString;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
    title: string;
}, {
    content: string;
    title: string;
}>;
