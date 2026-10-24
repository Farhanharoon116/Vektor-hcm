import { Router, Request, Response } from 'express';
import { supabase } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { recordAuditLog } from '../middleware/audit';
import {
  LeaveRequestSchema,
  ReviewLeaveSchema,
  calculateWorkingDays,
} from '@vektor/shared';

const router = Router();

// GET /leaves/balances/:employee_id
router.get('/balances/:employee_id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const empId = req.params.employee_id;

    if (user.role === 'employee' && user.employee_id !== empId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Fetch leave types
    const { data: leaveTypes, error: ltErr } = await supabase
      .from('leave_types')
      .select('*')
      .eq('company_id', user.company_id);

    if (ltErr) return res.status(500).json({ error: ltErr.message });

    // Fetch approved leaves for this employee
    const { data: approvedLeaves, error: alErr } = await supabase
      .from('leave_requests')
      .select('leave_type_id, days_count')
      .eq('employee_id', empId)
      .eq('status', 'approved');

    if (alErr) return res.status(500).json({ error: alErr.message });

    const balances = (leaveTypes || []).map((lt) => {
      const used = (approvedLeaves || [])
        .filter((l) => l.leave_type_id === lt.id)
        .reduce((sum, l) => sum + Number(l.days_count), 0);

      const isUnlimited = !lt.is_paid || lt.days_per_year === 0;
      const remaining = isUnlimited ? 999 : Math.max(0, lt.days_per_year - used);

      return {
        leave_type_id: lt.id,
        leave_type_name: lt.name,
        is_paid: lt.is_paid,
        quota: lt.days_per_year,
        used,
        balance: remaining,
        is_unlimited: isUnlimited,
      };
    });

    return res.json({ balances });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /leaves - Apply for leave
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const employeeId = user.role === 'employee' ? user.employee_id! : req.body.employee_id;
    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID required' });
    }

    const parseResult = LeaveRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { leave_type_id, start_date, end_date, reason } = parseResult.data;
    const companyId = user.company_id;

    if (new Date(end_date) < new Date(start_date)) {
      return res.status(422).json({ error: 'End date cannot be earlier than start date' });
    }

    // 1. Fetch company settings for weekend days and holidays
    const { data: settings } = await supabase
      .from('company_settings')
      .select('weekend_days')
      .eq('company_id', companyId)
      .single();

    const weekendDays = (settings?.weekend_days as number[]) || [0, 6];

    const { data: holidays } = await supabase
      .from('public_holidays')
      .select('date')
      .eq('company_id', companyId)
      .gte('date', start_date)
      .lte('date', end_date);

    const holidayDates = (holidays || []).map((h) => h.date);

    // Calculate working days only (Rule M5)
    const workingDaysCount = calculateWorkingDays(start_date, end_date, weekendDays, holidayDates);

    if (workingDaysCount <= 0) {
      return res.status(422).json({
        error: 'The requested period falls entirely on weekends or public holidays (0 working days).',
      });
    }

    // 2. Rule M5: Overlap check -> 422
    const { data: overlapping } = await supabase
      .from('leave_requests')
      .select('id, start_date, end_date, status')
      .eq('employee_id', employeeId)
      .in('status', ['approved', 'pending'])
      .lte('start_date', end_date)
      .gte('end_date', start_date);

    if (overlapping && overlapping.length > 0) {
      return res.status(422).json({
        error: `Leave request overlaps with an existing ${overlapping[0].status} leave from ${overlapping[0].start_date} to ${overlapping[0].end_date}.`,
      });
    }

    // 3. Rule M5: Over-balance check -> 422 (except unpaid leave)
    const { data: leaveType, error: ltErr } = await supabase
      .from('leave_types')
      .select('*')
      .eq('id', leave_type_id)
      .single();

    if (ltErr || !leaveType) {
      return res.status(404).json({ error: 'Leave type not found' });
    }

    if (leaveType.is_paid && leaveType.days_per_year > 0) {
      const { data: usedRecords } = await supabase
        .from('leave_requests')
        .select('days_count')
        .eq('employee_id', employeeId)
        .eq('leave_type_id', leave_type_id)
        .eq('status', 'approved');

      const totalUsed = (usedRecords || []).reduce((acc, r) => acc + Number(r.days_count), 0);
      const remainingBalance = leaveType.days_per_year - totalUsed;

      if (workingDaysCount > remainingBalance) {
        return res.status(422).json({
          error: `Insufficient leave balance. You have ${remainingBalance} ${leaveType.name} day(s) remaining, but requested ${workingDaysCount} working day(s).`,
          balance: remainingBalance,
          requested: workingDaysCount,
        });
      }
    }

    // Insert leave request
    const { data: newLeave, error: insertErr } = await supabase
      .from('leave_requests')
      .insert({
        company_id: companyId,
        employee_id: employeeId,
        leave_type_id,
        start_date,
        end_date,
        days_count: workingDaysCount,
        reason,
        status: 'pending',
      })
      .select('*, leave_type:leave_types(name), employee:employees(first_name, last_name, employee_code)')
      .single();

    if (insertErr) return res.status(500).json({ error: insertErr.message });

    // Notify HR and Admin users in the company
    try {
      const { data: hrUsers } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', companyId)
        .in('role', ['hr', 'admin'])
        .eq('is_active', true);

      if (hrUsers && hrUsers.length > 0) {
        const empName = newLeave.employee
          ? `${newLeave.employee.first_name} ${newLeave.employee.last_name}`
          : 'An employee';
        const empCode = newLeave.employee?.employee_code ? ` (${newLeave.employee.employee_code})` : '';

        const notifications = hrUsers.map((u) => ({
          company_id: companyId,
          user_id: u.id,
          title: `New Leave Request: ${empName}`,
          message: `${empName}${empCode} requested ${workingDaysCount} day(s) of ${leaveType.name} from ${start_date} to ${end_date}. Reason: ${reason}`,
          type: 'leave_request',
          link: '/hr/leaves',
          is_read: false,
        }));

        await supabase.from('notifications').insert(notifications);
      }
    } catch (notifErr) {
      console.warn('Failed to insert HR leave notification:', notifErr);
    }

    recordAuditLog({
      req,
      action: 'create',
      entity: 'leave_request',
      entityId: newLeave.id,
      details: {
        start_date,
        end_date,
        days_count: workingDaysCount,
        type: leaveType.name,
      },
    });

    return res.status(201).json({
      success: true,
      leave_request: newLeave,
      working_days: workingDaysCount,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /leaves
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let query = supabase
      .from('leave_requests')
      .select('*, leave_type:leave_types(name, is_paid), employee:employees(first_name, last_name, employee_code, department:departments(name))')
      .eq('company_id', user.company_id)
      .order('created_at', { ascending: false });

    if (user.role === 'employee') {
      query = query.eq('employee_id', user.employee_id);
    } else {
      const { status, employee_id } = req.query;
      if (status) query = query.eq('status', status);
      if (employee_id) query = query.eq('employee_id', employee_id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ leave_requests: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /leaves/:id/cancel (Employee cancels pending leave)
router.patch('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const leaveId = req.params.id;

    const { data: leave, error: fetchErr } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', leaveId)
      .eq('company_id', user.company_id)
      .single();

    if (fetchErr || !leave) return res.status(404).json({ error: 'Leave request not found' });

    if (user.role === 'employee' && leave.employee_id !== user.employee_id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending leave requests can be cancelled.' });
    }

    const { data: updated, error } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('id', leaveId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    recordAuditLog({
      req,
      action: 'update',
      entity: 'leave_request',
      entityId: leaveId,
      details: { status: 'cancelled' },
    });

    return res.json({ success: true, leave_request: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /leaves/:id/review (HR / Admin only)
router.post('/:id/review', authMiddleware, requireRole(['admin', 'hr']), async (req: Request, res: Response) => {
  try {
    const leaveId = req.params.id;
    const parseResult = ReviewLeaveSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { status, comment } = parseResult.data;

    const { data: leave, error: fetchErr } = await supabase
      .from('leave_requests')
      .select('*, employee:employees(user_id, first_name)')
      .eq('id', leaveId)
      .eq('company_id', req.user!.company_id)
      .single();

    if (fetchErr || !leave) return res.status(404).json({ error: 'Leave request not found' });
    if (leave.status !== 'pending') {
      return res.status(400).json({ error: `Leave request has already been ${leave.status}` });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('leave_requests')
      .update({
        status,
        review_comment: comment || null,
        reviewed_by: req.user!.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', leaveId)
      .select('*, leave_type:leave_types(name)')
      .single();

    if (updateErr) return res.status(500).json({ error: updateErr.message });

    // Send in-app notification to employee
    if (leave.employee?.user_id) {
      await supabase.from('notifications').insert({
        company_id: req.user!.company_id,
        user_id: leave.employee.user_id,
        title: `Leave Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your leave request for ${leave.start_date} to ${leave.end_date} has been ${status}. ${comment ? `Note: "${comment}"` : ''}`,
        type: 'leave',
        link: '/leaves',
      });
    }

    recordAuditLog({
      req,
      action: status === 'approved' ? 'approve' : 'reject',
      entity: 'leave_request',
      entityId: leaveId,
      details: { status, comment },
    });

    return res.json({ success: true, leave_request: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
