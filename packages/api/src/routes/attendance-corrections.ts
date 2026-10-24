import { Router, Request, Response } from 'express';
import { supabase } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { recordAuditLog } from '../middleware/audit';
import { AttendanceCorrectionSchema, ReviewCorrectionSchema } from '@vektor/shared';

const router = Router();

// POST /attendance/corrections - Employee requests correction
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role === 'employee' && !user.employee_id) {
      return res.status(400).json({ error: 'No employee linked to this user' });
    }

    const employeeId = user.role === 'employee' ? user.employee_id! : req.body.employee_id;
    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID required' });
    }

    const parseResult = AttendanceCorrectionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const payload = parseResult.data;

    // Find if an attendance record exists for that date
    const { data: att } = await supabase
      .from('attendance')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('date', payload.date)
      .maybeSingle();

    const { data: correction, error } = await supabase
      .from('attendance_corrections')
      .insert({
        company_id: user.company_id,
        employee_id: employeeId,
        attendance_id: att?.id || null,
        date: payload.date,
        requested_status: payload.requested_status,
        clock_in: payload.clock_in || null,
        clock_out: payload.clock_out || null,
        reason: payload.reason,
        status: 'pending',
      })
      .select('*, employee:employees(first_name, last_name, employee_code)')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Notify HR and Admin users in the company
    try {
      const { data: hrUsers } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', user.company_id)
        .in('role', ['hr', 'admin'])
        .eq('is_active', true);

      if (hrUsers && hrUsers.length > 0) {
        const empName = correction.employee
          ? `${correction.employee.first_name} ${correction.employee.last_name}`
          : 'An employee';
        const empCode = correction.employee?.employee_code ? ` (${correction.employee.employee_code})` : '';

        const notifications = hrUsers.map((u) => ({
          company_id: user.company_id,
          user_id: u.id,
          title: `Attendance Correction: ${empName}`,
          message: `${empName}${empCode} requested status '${payload.requested_status}' for ${payload.date}. Reason: ${payload.reason}`,
          type: 'attendance_correction',
          link: '/hr/attendance',
          is_read: false,
        }));

        await supabase.from('notifications').insert(notifications);
      }
    } catch (notifErr) {
      console.warn('Failed to insert HR attendance correction notification:', notifErr);
    }

    recordAuditLog({
      req,
      action: 'create',
      entity: 'attendance_correction',
      entityId: correction.id,
      details: {
        date: payload.date,
        requested_status: payload.requested_status,
        reason: payload.reason,
      },
    });

    return res.status(201).json({ correction });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /attendance/corrections
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let query = supabase
      .from('attendance_corrections')
      .select('*, employee:employees(first_name, last_name, employee_code, department:departments(name))')
      .eq('company_id', user.company_id)
      .order('created_at', { ascending: false });

    if (user.role === 'employee') {
      query = query.eq('employee_id', user.employee_id);
    } else {
      const { status } = req.query;
      if (status) query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ corrections: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /attendance/corrections/:id/review (HR / Admin only)
router.post('/:id/review', authMiddleware, requireRole(['admin', 'hr']), async (req: Request, res: Response) => {
  try {
    const correctionId = req.params.id;
    const parseResult = ReviewCorrectionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { status, comment } = parseResult.data;

    // Fetch correction
    const { data: corr, error: fetchErr } = await supabase
      .from('attendance_corrections')
      .select('*')
      .eq('id', correctionId)
      .eq('company_id', req.user!.company_id)
      .single();

    if (fetchErr || !corr) return res.status(404).json({ error: 'Correction request not found' });
    if (corr.status !== 'pending') {
      return res.status(400).json({ error: `Correction has already been ${corr.status}` });
    }

    // Update correction request
    const { data: updatedCorr, error: updateErr } = await supabase
      .from('attendance_corrections')
      .update({
        status,
        review_comment: comment || null,
        reviewed_by: req.user!.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', correctionId)
      .select()
      .single();

    if (updateErr) return res.status(500).json({ error: updateErr.message });

    // If approved, update or insert into attendance table!
    if (status === 'approved') {
      const clockIn = corr.clock_in || `${corr.date}T09:00:00Z`;
      const clockOut = corr.clock_out || `${corr.date}T17:00:00Z`;

      const diffMs = new Date(clockOut).getTime() - new Date(clockIn).getTime();
      const hoursWorked = +(Math.max(0, diffMs / (1000 * 60 * 60))).toFixed(2);

      const attendanceRow = {
        company_id: req.user!.company_id,
        employee_id: corr.employee_id,
        date: corr.date,
        clock_in: clockIn,
        clock_out: clockOut,
        hours_worked: hoursWorked,
        status: corr.requested_status,
        notes: `Correction approved: ${comment || 'No comment'}`,
      };

      if (corr.attendance_id) {
        await supabase
          .from('attendance')
          .update(attendanceRow)
          .eq('id', corr.attendance_id);
      } else {
        await supabase
          .from('attendance')
          .upsert(attendanceRow, { onConflict: 'employee_id, date' });
      }
    }

    recordAuditLog({
      req,
      action: status === 'approved' ? 'approve' : 'reject',
      entity: 'attendance_correction',
      entityId: correctionId,
      details: { status, comment },
    });

    return res.json({ success: true, correction: updatedCorr });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
