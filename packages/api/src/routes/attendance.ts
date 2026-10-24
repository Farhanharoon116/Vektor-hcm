import { Router, Request, Response } from 'express';
import { supabase } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { recordAuditLog } from '../middleware/audit';
import {
  CheckInSchema,
  deriveAttendanceStatus,
  calculateHaversineDistanceMeters,
  verifyFaceMatch,
  FACE_MATCH_MAX_DISTANCE,
} from '@vektor/shared';

const router = Router();

let hasFaceMatchDistanceColumnCache: boolean | null = null;
async function hasFaceMatchDistanceColumn(): Promise<boolean> {
  if (hasFaceMatchDistanceColumnCache !== null) return hasFaceMatchDistanceColumnCache;
  try {
    const { error } = await supabase.from('attendance').select('face_match_distance').limit(0);
    hasFaceMatchDistanceColumnCache = !error;
  } catch {
    hasFaceMatchDistanceColumnCache = false;
  }
  return hasFaceMatchDistanceColumnCache;
}

// POST /attendance/check-in
router.post('/check-in', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role === 'employee' && !user.employee_id) {
      return res.status(400).json({ error: 'No employee profile linked to this account' });
    }

    const employeeId = user.role === 'employee' ? user.employee_id! : req.body.employee_id;
    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    const parseResult = CheckInSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const payload = parseResult.data;
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Check if attendance record already exists for today
    const { data: existing } = await supabase
      .from('attendance')
      .select('id, clock_in')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle();

    if (existing && existing.clock_in) {
      // Rule M4: Second check-in returns 409
      return res.status(409).json({ error: 'You have already checked in for today' });
    }

    // Fetch company settings for office hours, geofence, and face match threshold
    const { data: settings } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', user.company_id)
      .single();

    const officeStart = settings?.office_start || '09:00';
    const graceMinutes = settings?.grace_minutes ?? 15;
    const requireFaceMatch = settings?.require_face_match ?? true;
    const maxMatchDistance = Number(settings?.face_match_max_distance) || FACE_MATCH_MAX_DISTANCE;

    // Camera + Location validation
    let distanceMeters: number | undefined;
    let faceVerified = false;
    let faceMatchDistance: number | undefined;

    if (payload.source === 'camera') {
      // 1. FACE_COUNT check
      if (!payload.face_detected || (payload.face_count !== undefined && payload.face_count !== 1)) {
        const errorMsg =
          payload.face_count && payload.face_count > 1
            ? 'Multiple faces detected in frame. Only 1 person is allowed.'
            : 'No face detected in front of camera. Please position your face clearly in the frame.';

        recordAuditLog({
          req,
          action: 'reject',
          entity: 'attendance_checkin',
          details: {
            code: 'FACE_COUNT',
            face_detected: payload.face_detected,
            face_count: payload.face_count,
            employee_id: employeeId,
          },
        });

        return res.status(422).json({
          error: errorMsg,
          code: 'FACE_COUNT',
        });
      }

      // 2. GPS_ACCURACY check (if accuracy is excessively noisy > 100m)
      if (payload.accuracy !== undefined && payload.accuracy > 100) {
        recordAuditLog({
          req,
          action: 'reject',
          entity: 'attendance_checkin',
          details: {
            code: 'GPS_ACCURACY',
            accuracy: payload.accuracy,
            employee_id: employeeId,
          },
        });

        return res.status(422).json({
          error: `GPS accuracy too low (±${Math.round(payload.accuracy)}m). Max allowed is ±100m. Please wait for better signal.`,
          code: 'GPS_ACCURACY',
          accuracy: payload.accuracy,
        });
      }

      // 3. OUTSIDE_RADIUS geofence check
      if (
        settings?.office_latitude &&
        settings?.office_longitude &&
        payload.latitude &&
        payload.longitude
      ) {
        distanceMeters = calculateHaversineDistanceMeters(
          payload.latitude,
          payload.longitude,
          Number(settings.office_latitude),
          Number(settings.office_longitude)
        );

        const allowedRadius = settings.office_radius_meters || 150;
        if (distanceMeters > allowedRadius) {
          recordAuditLog({
            req,
            action: 'reject',
            entity: 'attendance_checkin',
            details: {
              code: 'OUTSIDE_RADIUS',
              distance_meters: distanceMeters,
              allowed_radius: allowedRadius,
              employee_id: employeeId,
            },
          });

          return res.status(422).json({
            error: `You are outside the office boundary (${distanceMeters}m away, max allowed is ${allowedRadius}m).`,
            code: 'OUTSIDE_RADIUS',
            distance_meters: distanceMeters,
            allowed_radius: allowedRadius,
          });
        }
      }

      // 4. Biometric Face Verification (Server-Side Decision)
      // Retrieve employee record with enrolled descriptors
      const { data: employee } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .eq('company_id', user.company_id)
        .single();

      // Extract stored descriptors
      const storedDescriptors: number[][] = [];
      if (employee?.face_descriptors && Array.isArray(employee.face_descriptors)) {
        if (Array.isArray(employee.face_descriptors[0])) {
          storedDescriptors.push(...employee.face_descriptors);
        } else {
          storedDescriptors.push(employee.face_descriptors as any);
        }
      } else if (employee?.face_descriptor) {
        if (Array.isArray(employee.face_descriptor)) {
          storedDescriptors.push(employee.face_descriptor);
        } else if (
          employee.face_descriptor.descriptors &&
          Array.isArray(employee.face_descriptor.descriptors)
        ) {
          storedDescriptors.push(...employee.face_descriptor.descriptors);
        } else if (
          employee.face_descriptor.descriptor &&
          Array.isArray(employee.face_descriptor.descriptor)
        ) {
          storedDescriptors.push(employee.face_descriptor.descriptor);
        }
      }

      // Check if employee is enrolled
      if (storedDescriptors.length === 0) {
        if (!requireFaceMatch) {
          // Company setting allows camera check-in without matching if unenrolled
          faceVerified = false;
        } else {
          recordAuditLog({
            req,
            action: 'reject',
            entity: 'attendance_checkin',
            details: {
              code: 'NOT_ENROLLED',
              employee_id: employeeId,
            },
          });

          return res.status(422).json({
            error: 'Biometric face is not enrolled. Please contact HR to register your face.',
            code: 'NOT_ENROLLED',
          });
        }
      } else {
        // Employee is enrolled: compare live descriptor(s) against stored descriptors
        const liveDescriptors: number[][] = [];
        if (payload.face_descriptors && Array.isArray(payload.face_descriptors)) {
          for (const d of payload.face_descriptors) {
            if (Array.isArray(d) && d.length > 0) liveDescriptors.push(d);
          }
        }
        if (liveDescriptors.length === 0 && payload.face_descriptor && Array.isArray(payload.face_descriptor)) {
          liveDescriptors.push(payload.face_descriptor);
        }

        if (liveDescriptors.length === 0) {
          recordAuditLog({
            req,
            action: 'reject',
            entity: 'attendance_checkin',
            details: {
              code: 'FACE_MISMATCH',
              reason: 'No live face descriptors received from browser',
              employee_id: employeeId,
            },
          });

          return res.status(422).json({
            error: 'No biometric face descriptors received from camera.',
            code: 'FACE_MISMATCH',
          });
        }

        const matchResult = verifyFaceMatch({
          liveDescriptors,
          storedDescriptors,
          maxDistance: maxMatchDistance,
        });

        faceMatchDistance = matchResult.distance;

        if (!matchResult.matched) {
          recordAuditLog({
            req,
            action: 'reject',
            entity: 'attendance_checkin',
            details: {
              code: 'FACE_MISMATCH',
              distance: matchResult.distance,
              max_distance: maxMatchDistance,
              employee_id: employeeId,
            },
          });

          return res.status(422).json({
            error: `Biometric face mismatch (distance: ${matchResult.distance.toFixed(4)}, required < ${maxMatchDistance}).`,
            code: 'FACE_MISMATCH',
            distance: matchResult.distance,
            max_distance: maxMatchDistance,
          });
        }

        // Verified!
        faceVerified = true;
      }
    }

    // Derive status (late if after officeStart + graceMinutes)
    const { status, isLate } = deriveAttendanceStatus({
      clockInTime: now,
      officeStartTime: officeStart,
      graceMinutes,
    });

    const hasDistCol = await hasFaceMatchDistanceColumn();

    const attendanceData: any = {
      company_id: user.company_id,
      employee_id: employeeId,
      date: today,
      clock_in: now.toISOString(),
      status,
      check_in_source: payload.source,
      check_in_latitude: payload.latitude || null,
      check_in_longitude: payload.longitude || null,
      distance_meters: distanceMeters || null,
      face_verified: faceVerified,
      notes:
        payload.notes ||
        (faceMatchDistance !== undefined
          ? `Biometric match distance: ${faceMatchDistance.toFixed(4)}`
          : null),
    };

    if (hasDistCol && faceMatchDistance !== undefined) {
      attendanceData.face_match_distance = faceMatchDistance;
    }

    let result;
    if (existing) {
      // Update existing placeholder (e.g. if absent row was pre-created)
      const { data, error } = await supabase
        .from('attendance')
        .update(attendanceData)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      result = data;
    } else {
      const { data, error } = await supabase
        .from('attendance')
        .insert(attendanceData)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      result = data;
    }

    recordAuditLog({
      req,
      action: 'create',
      entity: 'attendance_checkin',
      entityId: result.id,
      details: {
        date: today,
        status,
        is_late: isLate,
        source: payload.source,
        distance_meters: distanceMeters,
        face_verified: faceVerified,
        face_match_distance: faceMatchDistance,
      },
    });

    return res.status(201).json({
      success: true,
      attendance: result,
      status,
      is_late: isLate,
      distance_meters: distanceMeters,
      face_match_distance: faceMatchDistance,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// POST /attendance/check-out
router.post('/check-out', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const employeeId = user.role === 'employee' ? user.employee_id! : req.body.employee_id;
    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    const today = new Date().toISOString().split('T')[0];

    // Find today's attendance record
    const { data: record, error: findErr } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .single();

    if (findErr || !record || !record.clock_in) {
      return res.status(400).json({ error: 'No check-in found for today. Please check in first.' });
    }

    if (record.clock_out) {
      return res.status(409).json({ error: 'You have already checked out for today' });
    }

    // Fetch company settings for half-day threshold
    const { data: settings } = await supabase
      .from('company_settings')
      .select('half_day_hours, office_start, grace_minutes')
      .eq('company_id', user.company_id)
      .single();

    const now = new Date();
    const halfDayThreshold = settings?.half_day_hours ? Number(settings.half_day_hours) : 5.0;

    const { status: finalStatus, hoursWorked } = deriveAttendanceStatus({
      clockInTime: record.clock_in,
      clockOutTime: now,
      officeStartTime: settings?.office_start || '09:00',
      graceMinutes: settings?.grace_minutes ?? 15,
      halfDayHoursThreshold: halfDayThreshold,
    });

    const { data: updated, error: updateErr } = await supabase
      .from('attendance')
      .update({
        clock_out: now.toISOString(),
        hours_worked: hoursWorked,
        status: finalStatus,
        updated_at: now.toISOString(),
      })
      .eq('id', record.id)
      .select()
      .single();

    if (updateErr) return res.status(500).json({ error: updateErr.message });

    recordAuditLog({
      req,
      action: 'update',
      entity: 'attendance_checkout',
      entityId: record.id,
      details: {
        clock_out: now.toISOString(),
        hours_worked: hoursWorked,
        status: finalStatus,
      },
    });

    return res.json({
      success: true,
      attendance: updated,
      hours_worked: hoursWorked,
      status: finalStatus,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /attendance/today - HR / Admin daily board
router.get('/today', authMiddleware, requireRole(['admin', 'hr']), async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const companyId = req.user!.company_id;

    // Fetch active employees
    const { data: employees } = await supabase
      .from('employees')
      .select('id, employee_code, first_name, last_name, department:departments(name), designation:designations(title)')
      .eq('company_id', companyId)
      .eq('status', 'active');

    // Fetch today's attendance
    const { data: records } = await supabase
      .from('attendance')
      .select('*')
      .eq('company_id', companyId)
      .eq('date', today);

    // Fetch today's approved leaves
    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('employee_id, leave_type:leave_types(name)')
      .eq('company_id', companyId)
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);

    const recordMap = new Map((records || []).map((r) => [r.employee_id, r]));
    const leaveMap = new Map((leaves || []).map((l: any) => [l.employee_id, l.leave_type?.name || 'Leave']));

    let presentCount = 0;
    let lateCount = 0;
    let onLeaveCount = 0;
    let absentCount = 0;

    const board = (employees || []).map((emp) => {
      const att = recordMap.get(emp.id);
      const onLeave = leaveMap.get(emp.id);

      let status = 'absent';
      if (att) {
        status = att.status;
        if (att.status === 'present') presentCount++;
        else if (att.status === 'late') lateCount++;
        else if (att.status === 'half_day') presentCount++;
        else if (att.status === 'absent') absentCount++;
      } else if (onLeave) {
        status = 'leave';
        onLeaveCount++;
      } else {
        absentCount++;
      }

      return {
        employee: emp,
        attendance: att || null,
        status,
        leave_name: onLeave || null,
      };
    });

    return res.json({
      date: today,
      kpis: {
        total_employees: employees?.length || 0,
        present: presentCount,
        late: lateCount,
        on_leave: onLeaveCount,
        absent: absentCount,
      },
      board,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /attendance/my - Employee's own records
router.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (!user.employee_id) {
      return res.json({ attendance: [] });
    }

    const { start_date, end_date } = req.query;
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', user.employee_id)
      .order('date', { ascending: false });

    if (start_date) query = query.gte('date', start_date);
    if (end_date) query = query.lte('date', end_date);

    const { data: records, error } = await query.limit(100);
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ attendance: records || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /attendance/report - Filterable attendance report
router.get('/report', authMiddleware, requireRole(['admin', 'hr']), async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.company_id;
    const { start_date, end_date, department_id, employee_id } = req.query;

    let query = supabase
      .from('attendance')
      .select('*, employee:employees(id, employee_code, first_name, last_name, department:departments(name))')
      .eq('company_id', companyId)
      .order('date', { ascending: false });

    if (start_date) query = query.gte('date', start_date);
    if (end_date) query = query.lte('date', end_date);
    if (employee_id) query = query.eq('employee_id', employee_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    let filtered = data || [];
    if (department_id) {
      filtered = filtered.filter((row: any) => row.employee?.department?.id === department_id);
    }

    return res.json({ records: filtered });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
