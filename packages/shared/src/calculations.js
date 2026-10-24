/**
 * Vektor HCM Business Rules & Calculations
 * Strict implementation of Saylani Hackathon HCM Lite requirements
 */
/**
 * M3/M6: Gross = 1.5 * Basic (Basic 100%, HRA 40%, Medical 10%)
 */
export function calculateSalaryStructure(basicSalary) {
    const basic = Math.max(0, Number(basicSalary) || 0);
    const hra = Math.round(basic * 0.4);
    const medical = Math.round(basic * 0.1);
    const gross = Math.round(basic * 1.5);
    return { basic, hra, medical, gross };
}
/**
 * M6: Annualized Tax Slabs on Gross * 12 (Illustrative tax slabs from brief)
 * - 0 to 600,000: 0%
 * - 600,001 to 1,200,000: 5% of amount > 600k
 * - 1,200,001 to 2,400,000: 30k + 15% of amount > 1.2M
 * - 2,400,001 to 3,600,000: 210k + 25% of amount > 2.4M
 * - Above 3,600,000: 510k + 35% of amount > 3.6M
 */
export function calculateAnnualTax(annualGross) {
    const annual = Math.max(0, Number(annualGross) || 0);
    if (annual <= 600_000)
        return 0;
    if (annual <= 1_200_000) {
        return Math.round((annual - 600_000) * 0.05);
    }
    if (annual <= 2_400_000) {
        return Math.round(30_000 + (annual - 1_200_000) * 0.15);
    }
    if (annual <= 3_600_000) {
        return Math.round(210_000 + (annual - 2_400_000) * 0.25);
    }
    return Math.round(510_000 + (annual - 3_600_000) * 0.35);
}
export function calculateMonthlyTax(monthlyGross) {
    const annualized = monthlyGross * 12;
    const annualTax = calculateAnnualTax(annualized);
    return Math.round(annualTax / 12);
}
/**
 * M6: Monthly Payroll Item Calculation
 * per_day = gross / working_days
 * deduct absent + unpaid + 0.5 * half_days
 */
export function calculatePayrollItem(input) {
    const { basic, hra, medical, gross } = calculateSalaryStructure(input.basicSalary);
    const workingDays = Math.max(1, input.workingDaysInMonth);
    const perDayRate = +(gross / workingDays).toFixed(2);
    // Deduction days formula from brief: absent + unpaid + 0.5 * half_days
    const deductionDays = +(input.absentDays +
        input.unpaidLeaveDays +
        0.5 * input.halfDays).toFixed(1);
    const salaryDeduction = Math.min(gross, Math.round(deductionDays * perDayRate));
    const annualTaxableSalary = gross * 12;
    const monthlyTax = calculateMonthlyTax(gross);
    const netSalary = Math.max(0, gross - salaryDeduction - monthlyTax);
    return {
        basicSalary: basic,
        hra,
        medical,
        grossSalary: gross,
        workingDays,
        perDayRate,
        deductionDays,
        salaryDeduction,
        annualTaxableSalary,
        monthlyTax,
        netSalary,
    };
}
/**
 * M4: Attendance status calculation
 * Office start default: "09:00", grace 15 min -> late after 09:15
 * Half day: total hours worked under 5h (HCM brief §M4)
 */
export function deriveAttendanceStatus(params) {
    const officeStart = params.officeStartTime || '09:00';
    const graceMinutes = params.graceMinutes ?? 15;
    const halfDayThreshold = params.halfDayHoursThreshold ?? 5;
    const clockInDate = new Date(params.clockInTime);
    const [startHour, startMin] = officeStart.split(':').map(Number);
    // Late threshold timestamp for the clockIn date
    const lateThreshold = new Date(clockInDate);
    lateThreshold.setHours(startHour, startMin + graceMinutes, 0, 0);
    const isLate = clockInDate.getTime() > lateThreshold.getTime();
    if (!params.clockOutTime) {
        return {
            status: isLate ? 'late' : 'present',
            isLate,
            hoursWorked: 0,
        };
    }
    const clockOutDate = new Date(params.clockOutTime);
    const diffMs = clockOutDate.getTime() - clockInDate.getTime();
    const hoursWorked = +(Math.max(0, diffMs / (1000 * 60 * 60))).toFixed(2);
    if (hoursWorked < halfDayThreshold) {
        return {
            status: 'half_day',
            isLate,
            hoursWorked,
        };
    }
    return {
        status: isLate ? 'late' : 'present',
        isLate,
        hoursWorked,
    };
}
/**
 * M5: Calculate working days between two dates excluding weekends and public holidays
 */
export function calculateWorkingDays(startDateStr, // YYYY-MM-DD
endDateStr, // YYYY-MM-DD
weekendDays = [0, 6], // default Sun=0, Sat=6
holidayDates = [] // ['YYYY-MM-DD']
) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const holidaysSet = new Set(holidayDates);
    if (start > end)
        return 0;
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
        const dayOfWeek = current.getDay();
        const dateIso = current.toISOString().split('T')[0];
        if (!weekendDays.includes(dayOfWeek) && !holidaysSet.has(dateIso)) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}
/**
 * M5: Total working days in a month (given year, month 1-12)
 */
export function getWorkingDaysInMonth(year, month, // 1-12
weekendDays = [0, 6], holidayDates = []) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    return calculateWorkingDays(startStr, endStr, weekendDays, holidayDates);
}
/**
 * M4 / Bonus: Haversine distance calculation in meters
 */
export function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radius of Earth in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}
/**
 * Biometric Face Matching Constants & Functions
 * Uses raw 128-dimensional Euclidean distance from face-api
 */
export const FACE_MATCH_MAX_DISTANCE = 0.55;
/**
 * Computes raw Euclidean distance between two 128-dimensional face descriptors
 */
export function calculateEuclideanDistance(descA, descB) {
    if (!descA || !descB || descA.length === 0 || descB.length === 0) {
        return 1.0;
    }
    const len = Math.min(descA.length, descB.length);
    let sum = 0;
    for (let i = 0; i < len; i++) {
        const diff = (descA[i] || 0) - (descB[i] || 0);
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}
/**
 * UI-only Friendly Confidence Score:
 * confidence = clamp((0.8 - distance) / 0.8, 0, 1) * 100
 */
export function calculateConfidenceFromDistance(distance) {
    const clamped = Math.max(0, Math.min(1, (0.8 - distance) / 0.8));
    return +(clamped * 100).toFixed(1);
}
/**
 * Multi-frame distance calculation:
 * For each sampled live frame, compute minimum distance to all stored descriptors.
 * Then take the MEDIAN of those per-frame minimum distances.
 * Removes blur, blink, and single-frame noise.
 */
export function computeMultiFrameDistance(liveFrames, storedDescriptors) {
    if (!liveFrames || liveFrames.length === 0 || !storedDescriptors || storedDescriptors.length === 0) {
        return 1.0;
    }
    // Minimum distance per live frame against all stored descriptors
    const minPerFrame = [];
    for (const live of liveFrames) {
        if (!live || live.length === 0)
            continue;
        let frameMin = Infinity;
        for (const stored of storedDescriptors) {
            if (!stored || stored.length === 0)
                continue;
            const d = calculateEuclideanDistance(live, stored);
            if (d < frameMin) {
                frameMin = d;
            }
        }
        if (frameMin !== Infinity) {
            minPerFrame.push(frameMin);
        }
    }
    if (minPerFrame.length === 0)
        return 1.0;
    // Compute median
    minPerFrame.sort((a, b) => a - b);
    const mid = Math.floor(minPerFrame.length / 2);
    if (minPerFrame.length % 2 === 1) {
        return +minPerFrame[mid].toFixed(4);
    }
    return +((minPerFrame[mid - 1] + minPerFrame[mid]) / 2).toFixed(4);
}
/**
 * Server-side face matching verification:
 * Decides match/mismatch on distance < maxDistance (default 0.55).
 * Never relies on percentages.
 */
export function verifyFaceMatch(params) {
    const maxDistance = params.maxDistance ?? FACE_MATCH_MAX_DISTANCE;
    // Normalize stored descriptors
    const storedList = [];
    if (params.storedDescriptors) {
        if (Array.isArray(params.storedDescriptors) && params.storedDescriptors.length > 0) {
            // Check if it's 2D array or 1D array
            if (typeof params.storedDescriptors[0] === 'number') {
                storedList.push(params.storedDescriptors);
            }
            else {
                for (const item of params.storedDescriptors) {
                    if (item && item.length > 0)
                        storedList.push(item);
                }
            }
        }
    }
    if (storedList.length === 0) {
        return {
            matched: false,
            distance: 1.0,
            confidence: 0,
            code: 'NOT_ENROLLED',
            error: 'Employee has no enrolled biometric face descriptors. Please register face first.',
        };
    }
    // Normalize live descriptors
    const liveList = [];
    if (params.liveDescriptors) {
        if (Array.isArray(params.liveDescriptors) && params.liveDescriptors.length > 0) {
            if (typeof params.liveDescriptors[0] === 'number') {
                liveList.push(params.liveDescriptors);
            }
            else {
                for (const item of params.liveDescriptors) {
                    if (item && item.length > 0)
                        liveList.push(item);
                }
            }
        }
    }
    if (liveList.length === 0) {
        return {
            matched: false,
            distance: 1.0,
            confidence: 0,
            code: 'FACE_MISMATCH',
            error: 'No live face descriptors provided for biometric verification.',
        };
    }
    const distance = computeMultiFrameDistance(liveList, storedList);
    const matched = distance < maxDistance;
    const confidence = calculateConfidenceFromDistance(distance);
    return {
        matched,
        distance,
        confidence,
        code: matched ? undefined : 'FACE_MISMATCH',
        error: matched
            ? undefined
            : `Face does not match enrolled biometric identity (distance: ${distance.toFixed(4)}, threshold: < ${maxDistance}).`,
    };
}
/**
 * Computes Eye Aspect Ratio (EAR) for 6 eye landmark points:
 * EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
 */
export function calculateEyeAspectRatio(eye) {
    if (!eye || eye.length < 6)
        return 0;
    const dist = (pA, pB) => {
        const dx = pA.x - pB.x;
        const dy = pA.y - pB.y;
        return Math.sqrt(dx * dx + dy * dy);
    };
    const a = dist(eye[1], eye[5]);
    const b = dist(eye[2], eye[4]);
    const c = dist(eye[0], eye[3]);
    if (c === 0)
        return 0;
    return +((a + b) / (2.0 * c)).toFixed(3);
}
