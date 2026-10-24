import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSalaryStructure, calculateAnnualTax, calculatePayrollItem, deriveAttendanceStatus, calculateWorkingDays, calculateHaversineDistanceMeters, FACE_MATCH_MAX_DISTANCE, verifyFaceMatch, computeMultiFrameDistance, calculateEyeAspectRatio, } from './calculations';
describe('HCM Salary Structure (Gross = 1.5 * Basic)', () => {
    test('correctly splits Basic, 40% HRA, 10% Medical into 150% Gross', () => {
        const res = calculateSalaryStructure(100000);
        assert.equal(res.basic, 100000);
        assert.equal(res.hra, 40000); // 40%
        assert.equal(res.medical, 10000); // 10%
        assert.equal(res.gross, 150000); // 1.5 * basic
    });
    test('handles zero or negative basic salary gracefully', () => {
        const res = calculateSalaryStructure(0);
        assert.equal(res.gross, 0);
    });
});
describe('Tax Slabs on Annualized Gross (Gross * 12)', () => {
    test('0 to 600k -> 0% tax', () => {
        assert.equal(calculateAnnualTax(600000), 0);
        assert.equal(calculateAnnualTax(500000), 0);
    });
    test('600k to 1.2M -> 5% on amount over 600k', () => {
        // 800,000 -> (800,000 - 600,000) * 0.05 = 200,000 * 0.05 = 10,000
        assert.equal(calculateAnnualTax(800000), 10000);
        // 1,200,000 -> 600,000 * 0.05 = 30,000
        assert.equal(calculateAnnualTax(1200000), 30000);
    });
    test('1.2M to 2.4M -> 30k + 15% on amount over 1.2M', () => {
        // 2,000,000 -> 30,000 + (800,000 * 0.15) = 30,000 + 120,000 = 150,000
        assert.equal(calculateAnnualTax(2000000), 150000);
    });
    test('2.4M to 3.6M -> 210k + 25% on amount over 2.4M', () => {
        // 3,000,000 -> 210,000 + (600,000 * 0.25) = 210,000 + 150,000 = 360,000
        assert.equal(calculateAnnualTax(3000000), 360000);
    });
    test('Above 3.6M -> 510k + 35% on amount over 3.6M', () => {
        // 4,000,000 -> 510,000 + (400,000 * 0.35) = 510,000 + 140,000 = 650,000
        assert.equal(calculateAnnualTax(4000000), 650000);
    });
});
describe('Attendance Rules (09:15 late cutoff, 5h half day)', () => {
    test('09:15 is present (within 15m grace)', () => {
        const clockIn = new Date('2026-10-24T09:15:00');
        const res = deriveAttendanceStatus({
            clockInTime: clockIn,
            officeStartTime: '09:00',
            graceMinutes: 15,
        });
        assert.equal(res.isLate, false);
        assert.equal(res.status, 'present');
    });
    test('09:16 is late (exceeds 15m grace)', () => {
        const clockIn = new Date('2026-10-24T09:16:00');
        const res = deriveAttendanceStatus({
            clockInTime: clockIn,
            officeStartTime: '09:00',
            graceMinutes: 15,
        });
        assert.equal(res.isLate, true);
        assert.equal(res.status, 'late');
    });
    test('Hours worked under 5.0h becomes half_day', () => {
        const clockIn = new Date('2026-10-24T09:00:00');
        const clockOut = new Date('2026-10-24T13:30:00'); // 4.5 hours
        const res = deriveAttendanceStatus({
            clockInTime: clockIn,
            clockOutTime: clockOut,
            officeStartTime: '09:00',
            graceMinutes: 15,
            halfDayHoursThreshold: 5.0,
        });
        assert.equal(res.hoursWorked, 4.5);
        assert.equal(res.status, 'half_day');
    });
    test('Hours worked 5.0h or more remains present/late', () => {
        const clockIn = new Date('2026-10-24T09:00:00');
        const clockOut = new Date('2026-10-24T14:30:00'); // 5.5 hours
        const res = deriveAttendanceStatus({
            clockInTime: clockIn,
            clockOutTime: clockOut,
            officeStartTime: '09:00',
            graceMinutes: 15,
            halfDayHoursThreshold: 5.0,
        });
        assert.equal(res.hoursWorked, 5.5);
        assert.equal(res.status, 'present');
    });
});
describe('Working Days Calculation (Excluding weekends & holidays)', () => {
    test('skips Saturday (6) and Sunday (0)', () => {
        // 2026-10-19 (Mon) to 2026-10-25 (Sun) = 5 working days
        const count = calculateWorkingDays('2026-10-19', '2026-10-25', [0, 6], []);
        assert.equal(count, 5);
    });
    test('skips public holidays falling on working days', () => {
        // 2026-10-19 (Mon) to 2026-10-23 (Fri) with Wednesday 2026-10-21 as holiday
        const count = calculateWorkingDays('2026-10-19', '2026-10-23', [0, 6], ['2026-10-21']);
        assert.equal(count, 4);
    });
});
describe('Payroll Calculation (Deductions = absent + unpaid + 0.5 * half_days)', () => {
    test('calculates correct per-day rate, deductions and net pay', () => {
        const res = calculatePayrollItem({
            basicSalary: 100000, // Gross = 150,000
            workingDaysInMonth: 22,
            presentDays: 19,
            lateDays: 0,
            halfDays: 2, // 2 half days = 1 deduction day
            absentDays: 1, // 1 absent day
            unpaidLeaveDays: 1, // 1 unpaid day
            paidLeaveDays: 0,
        });
        // total deduction days = 1 + 1 + (0.5 * 2) = 3 days
        assert.equal(res.deductionDays, 3);
        assert.equal(res.workingDays, 22);
        // Gross = 150,000
        assert.equal(res.grossSalary, 150000);
        // Per day = 150,000 / 22 = 6818.18
        const expectedDeduction = Math.round(3 * (150000 / 22));
        assert.equal(res.salaryDeduction, expectedDeduction);
        // Net pay = gross - salaryDeduction - monthlyTax
        assert.equal(res.netSalary, res.grossSalary - res.salaryDeduction - res.monthlyTax);
    });
});
describe('Geofence Distance (Haversine)', () => {
    test('calculates 0 distance for same coordinates', () => {
        const d = calculateHaversineDistanceMeters(24.8607, 67.0011, 24.8607, 67.0011);
        assert.equal(d, 0);
    });
    test('calculates accurate distance within office area', () => {
        // ~50m apart in Karachi
        const d = calculateHaversineDistanceMeters(24.8607, 67.0011, 24.8611, 67.0011);
        assert.ok(d > 30 && d < 60);
    });
});
describe('Face Biometric Verification & Euclidean Distance Matching', () => {
    // Helper to create 128-dimensional descriptor with specific first value
    const makeDesc = (val) => {
        const arr = new Array(128).fill(0);
        arr[0] = val;
        return arr;
    };
    const refDesc = makeDesc(0); // [0, 0, ..., 0]
    test('same-person distance: 0.3 -> accept', () => {
        const liveDesc = makeDesc(0.3); // distance = 0.3
        const res = verifyFaceMatch({
            liveDescriptors: [liveDesc],
            storedDescriptors: [refDesc],
        });
        assert.equal(res.matched, true);
        assert.equal(res.distance, 0.3);
        // UI confidence: (0.8 - 0.3) / 0.8 * 100 = 62.5%
        assert.equal(res.confidence, 62.5);
        assert.equal(res.code, undefined);
    });
    test('borderline accept: 0.54 -> accept', () => {
        const liveDesc = makeDesc(0.54);
        const res = verifyFaceMatch({
            liveDescriptors: [liveDesc],
            storedDescriptors: [refDesc],
        });
        assert.equal(res.matched, true);
        assert.equal(res.distance, 0.54);
        assert.ok(res.distance < FACE_MATCH_MAX_DISTANCE);
    });
    test('borderline reject: 0.56 -> reject', () => {
        const liveDesc = makeDesc(0.56);
        const res = verifyFaceMatch({
            liveDescriptors: [liveDesc],
            storedDescriptors: [refDesc],
        });
        assert.equal(res.matched, false);
        assert.equal(res.distance, 0.56);
        assert.equal(res.code, 'FACE_MISMATCH');
        assert.ok(res.distance >= FACE_MATCH_MAX_DISTANCE);
    });
    test('different person: 0.8 -> reject', () => {
        const liveDesc = makeDesc(0.8);
        const res = verifyFaceMatch({
            liveDescriptors: [liveDesc],
            storedDescriptors: [refDesc],
        });
        assert.equal(res.matched, false);
        assert.equal(res.distance, 0.8);
        assert.equal(res.confidence, 0); // clamp((0.8 - 0.8)/0.8, 0, 1) = 0
        assert.equal(res.code, 'FACE_MISMATCH');
    });
    test('not enrolled -> returns NOT_ENROLLED code', () => {
        const liveDesc = makeDesc(0.2);
        const res = verifyFaceMatch({
            liveDescriptors: [liveDesc],
            storedDescriptors: [],
        });
        assert.equal(res.matched, false);
        assert.equal(res.code, 'NOT_ENROLLED');
    });
    test('multiple descriptors (uses minimum distance per frame)', () => {
        const stored1 = makeDesc(0.85); // distance 0.85
        const stored2 = makeDesc(0.32); // distance 0.32 (best match)
        const stored3 = makeDesc(0.65); // distance 0.65
        const liveDesc = makeDesc(0.0);
        const res = verifyFaceMatch({
            liveDescriptors: [liveDesc],
            storedDescriptors: [stored1, stored2, stored3],
        });
        assert.equal(res.matched, true);
        assert.equal(res.distance, 0.32); // picks minimum
    });
    test('multi-frame check-in: median of 5 sampled frames removes outliers', () => {
        const stored = [makeDesc(0.0)];
        // 5 frames: 4 good (0.28, 0.29, 0.31, 0.33) and 1 noisy/blink/motion-blurred frame (0.75)
        const frames = [
            makeDesc(0.28),
            makeDesc(0.75), // noisy outlier
            makeDesc(0.31),
            makeDesc(0.29),
            makeDesc(0.33),
        ];
        const dist = computeMultiFrameDistance(frames, stored);
        // sorted: 0.28, 0.29, 0.31, 0.33, 0.75 -> median is 0.31
        assert.equal(dist, 0.31);
        const res = verifyFaceMatch({
            liveDescriptors: frames,
            storedDescriptors: stored,
        });
        assert.equal(res.matched, true);
        assert.equal(res.distance, 0.31);
    });
    test('eye aspect ratio (EAR) detects open vs blinking eyes', () => {
        // Open eye points: 6 points with vertical height ~10 and width ~30 -> EAR ~ 0.33
        const openEye = [
            { x: 10, y: 50 }, // p1 (outer corner)
            { x: 20, y: 40 }, // p2 (top-left)
            { x: 30, y: 40 }, // p3 (top-right)
            { x: 40, y: 50 }, // p4 (inner corner)
            { x: 30, y: 60 }, // p5 (bottom-right)
            { x: 20, y: 60 }, // p6 (bottom-left)
        ];
        const openEar = calculateEyeAspectRatio(openEye);
        assert.ok(openEar > 0.28, `Expected open EAR > 0.28, got ${openEar}`);
        // Closed eye points (blink): vertical height collapsed to ~2
        const closedEye = [
            { x: 10, y: 50 },
            { x: 20, y: 49 },
            { x: 30, y: 49 },
            { x: 40, y: 50 },
            { x: 30, y: 51 },
            { x: 20, y: 51 },
        ];
        const closedEar = calculateEyeAspectRatio(closedEye);
        assert.ok(closedEar < 0.20, `Expected closed EAR < 0.20, got ${closedEar}`);
    });
});
