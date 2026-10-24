/**
 * Vektor HCM Business Rules & Calculations
 * Strict implementation of Saylani Hackathon HCM Lite requirements
 */
export interface SalaryBreakdown {
    basic: number;
    hra: number;
    medical: number;
    gross: number;
}
/**
 * M3/M6: Gross = 1.5 * Basic (Basic 100%, HRA 40%, Medical 10%)
 */
export declare function calculateSalaryStructure(basicSalary: number): SalaryBreakdown;
/**
 * M6: Annualized Tax Slabs on Gross * 12 (Illustrative tax slabs from brief)
 * - 0 to 600,000: 0%
 * - 600,001 to 1,200,000: 5% of amount > 600k
 * - 1,200,001 to 2,400,000: 30k + 15% of amount > 1.2M
 * - 2,400,001 to 3,600,000: 210k + 25% of amount > 2.4M
 * - Above 3,600,000: 510k + 35% of amount > 3.6M
 */
export declare function calculateAnnualTax(annualGross: number): number;
export declare function calculateMonthlyTax(monthlyGross: number): number;
export interface PayrollItemCalculationInput {
    basicSalary: number;
    workingDaysInMonth: number;
    presentDays: number;
    lateDays: number;
    halfDays: number;
    absentDays: number;
    unpaidLeaveDays: number;
    paidLeaveDays: number;
}
export interface PayrollItemCalculationResult {
    basicSalary: number;
    hra: number;
    medical: number;
    grossSalary: number;
    workingDays: number;
    perDayRate: number;
    deductionDays: number;
    salaryDeduction: number;
    annualTaxableSalary: number;
    monthlyTax: number;
    netSalary: number;
}
/**
 * M6: Monthly Payroll Item Calculation
 * per_day = gross / working_days
 * deduct absent + unpaid + 0.5 * half_days
 */
export declare function calculatePayrollItem(input: PayrollItemCalculationInput): PayrollItemCalculationResult;
/**
 * M4: Attendance status calculation
 * Office start default: "09:00", grace 15 min -> late after 09:15
 * Half day: total hours worked under 5h (HCM brief §M4)
 */
export declare function deriveAttendanceStatus(params: {
    clockInTime: string | Date;
    clockOutTime?: string | Date | null;
    officeStartTime?: string;
    graceMinutes?: number;
    halfDayHoursThreshold?: number;
}): {
    status: 'present' | 'late' | 'half_day' | 'missing_checkout';
    isLate: boolean;
    hoursWorked: number;
};
/**
 * M5: Calculate working days between two dates excluding weekends and public holidays
 */
export declare function calculateWorkingDays(startDateStr: string, // YYYY-MM-DD
endDateStr: string, // YYYY-MM-DD
weekendDays?: number[], // default Sun=0, Sat=6
holidayDates?: string[]): number;
/**
 * M5: Total working days in a month (given year, month 1-12)
 */
export declare function getWorkingDaysInMonth(year: number, month: number, // 1-12
weekendDays?: number[], holidayDates?: string[]): number;
/**
 * M4 / Bonus: Haversine distance calculation in meters
 */
export declare function calculateHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number;
/**
 * Biometric Face Matching Constants & Functions
 * Uses raw 128-dimensional Euclidean distance from face-api
 */
export declare const FACE_MATCH_MAX_DISTANCE = 0.55;
/**
 * Computes raw Euclidean distance between two 128-dimensional face descriptors
 */
export declare function calculateEuclideanDistance(descA: ArrayLike<number>, descB: ArrayLike<number>): number;
/**
 * UI-only Friendly Confidence Score:
 * confidence = clamp((0.8 - distance) / 0.8, 0, 1) * 100
 */
export declare function calculateConfidenceFromDistance(distance: number): number;
/**
 * Multi-frame distance calculation:
 * For each sampled live frame, compute minimum distance to all stored descriptors.
 * Then take the MEDIAN of those per-frame minimum distances.
 * Removes blur, blink, and single-frame noise.
 */
export declare function computeMultiFrameDistance(liveFrames: ArrayLike<number>[], storedDescriptors: ArrayLike<number>[]): number;
export interface VerifyFaceMatchParams {
    liveDescriptors: ArrayLike<number>[] | ArrayLike<number>;
    storedDescriptors?: ArrayLike<number>[] | ArrayLike<number> | null;
    maxDistance?: number;
}
export interface VerifyFaceMatchResult {
    matched: boolean;
    distance: number;
    confidence: number;
    error?: string;
    code?: 'NOT_ENROLLED' | 'FACE_MISMATCH';
}
/**
 * Server-side face matching verification:
 * Decides match/mismatch on distance < maxDistance (default 0.55).
 * Never relies on percentages.
 */
export declare function verifyFaceMatch(params: VerifyFaceMatchParams): VerifyFaceMatchResult;
/**
 * Computes Eye Aspect Ratio (EAR) for 6 eye landmark points:
 * EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
 */
export declare function calculateEyeAspectRatio(eye: {
    x: number;
    y: number;
}[]): number;
