import { Router, Request, Response } from 'express';
import { supabase } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// GET /dashboard/admin - Company Analytics
router.get('/admin', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.company_id;

    // Parallel fetch: Headcount & Employees + Recent Audit Logs
    const [empRes, auditRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, basic_salary, gross_salary, gender, status, joining_date, department_id, department:departments(name)')
        .eq('company_id', companyId),
      supabase
        .from('audit_logs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const employees = empRes.data || [];
    const recentAudit = auditRes.data || [];

    const activeEmployees = employees.filter((e) => e.status === 'active' || e.status === 'probation');
    const headcount = activeEmployees.length;
    const totalPayroll = activeEmployees.reduce((sum, e) => sum + Number(e.gross_salary || 0), 0);
    const avgSalary = headcount > 0 ? Math.round(totalPayroll / headcount) : 0;

    // Headcount & Payroll cost by Department
    const deptStats: Record<string, { count: number; totalSalary: number }> = {};
    activeEmployees.forEach((e: any) => {
      const deptName = e.department?.name || 'Unassigned';
      if (!deptStats[deptName]) {
        deptStats[deptName] = { count: 0, totalSalary: 0 };
      }
      deptStats[deptName].count++;
      deptStats[deptName].totalSalary += Number(e.gross_salary || 0);
    });

    const departmentBreakdown = Object.entries(deptStats).map(([name, stat]) => ({
      name,
      headcount: stat.count,
      total_payroll: stat.totalSalary,
      avg_salary: Math.round(stat.totalSalary / stat.count),
    }));

    // Gender breakdown
    const genderCount: Record<string, number> = { male: 0, female: 0, other: 0 };
    activeEmployees.forEach((e) => {
      if (e.gender && genderCount[e.gender] !== undefined) {
        genderCount[e.gender]++;
      }
    });

    return res.json({
      kpis: {
        headcount,
        total_monthly_payroll: totalPayroll,
        avg_monthly_salary: avgSalary,
      },
      department_breakdown: departmentBreakdown,
      gender_breakdown: genderCount,
      recent_audit_logs: recentAudit || [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /dashboard/hr - HR Daily Operations Analytics
router.get('/hr', authMiddleware, requireRole(['admin', 'hr']), async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.company_id;
    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

    // Concurrently execute all HR dashboard queries in 1 parallel batch
    const [
      empRes,
      attRes,
      leaveRes,
      pendingLeavesRes,
      pendingCorrectionsRes,
      lateRes,
    ] = await Promise.all([
      supabase
        .from('employees')
        .select('id, employee_code, first_name, last_name, department:departments(name)')
        .eq('company_id', companyId)
        .eq('status', 'active'),
      supabase
        .from('attendance')
        .select('employee_id, status, clock_in')
        .eq('company_id', companyId)
        .eq('date', today),
      supabase
        .from('leave_requests')
        .select('employee_id, leave_type:leave_types(name)')
        .eq('company_id', companyId)
        .eq('status', 'approved')
        .lte('start_date', today)
        .gte('end_date', today),
      supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'pending'),
      supabase
        .from('attendance_corrections')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'pending'),
      supabase
        .from('attendance')
        .select('employee_id, employee:employees(first_name, last_name, employee_code, department:departments(name))')
        .eq('company_id', companyId)
        .eq('status', 'late')
        .gte('date', startOfMonth),
    ]);

    const employees = empRes.data || [];
    const attendance = attRes.data || [];
    const leaves = leaveRes.data || [];
    const totalHeadcount = employees.length;

    let present = 0;
    let late = 0;
    let halfDay = 0;
    let onLeave = leaves.length;

    attendance.forEach((a) => {
      if (a.status === 'present') present++;
      else if (a.status === 'late') late++;
      else if (a.status === 'half_day') halfDay++;
    });

    const checkedInCount = present + late + halfDay;
    const absent = Math.max(0, totalHeadcount - checkedInCount - onLeave);

    const lateCountMap: Record<string, { employee: any; count: number }> = {};
    (lateRes.data || []).forEach((r: any) => {
      const eid = r.employee_id;
      if (!lateCountMap[eid]) {
        lateCountMap[eid] = { employee: r.employee, count: 0 };
      }
      lateCountMap[eid].count++;
    });

    const topLateComers = Object.values(lateCountMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((item) => ({
        employee_code: item.employee?.employee_code,
        name: `${item.employee?.first_name} ${item.employee?.last_name}`,
        department: item.employee?.department?.name || 'General',
        late_days: item.count,
      }));

    return res.json({
      kpis: {
        total_headcount: totalHeadcount,
        present,
        late,
        half_day: halfDay,
        absent,
        on_leave: onLeave,
      },
      pending_approvals: {
        leave_requests: pendingLeavesRes.count || 0,
        attendance_corrections: pendingCorrectionsRes.count || 0,
        total: (pendingLeavesRes.count || 0) + (pendingCorrectionsRes.count || 0),
      },
      top_late_comers: topLateComers,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /dashboard/employee - Employee Personal Hub
router.get('/employee', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const empId = user.employee_id;
    if (!empId) {
      return res.status(400).json({ error: 'No employee record linked' });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // Concurrently execute all 6 employee metrics queries in 1 parallel batch
    const [
      todayRes,
      weekRes,
      lateRes,
      leaveTypesRes,
      approvedLeavesRes,
      lastPayslipRes,
      announcementsRes,
    ] = await Promise.all([
      supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', empId)
        .eq('date', today)
        .maybeSingle(),
      supabase
        .from('attendance')
        .select('hours_worked')
        .eq('employee_id', empId)
        .gte('date', startOfWeekStr),
      supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', empId)
        .eq('status', 'late')
        .gte('date', startOfMonth),
      supabase
        .from('leave_types')
        .select('*')
        .eq('company_id', user.company_id),
      supabase
        .from('leave_requests')
        .select('leave_type_id, days_count')
        .eq('employee_id', empId)
        .eq('status', 'approved'),
      supabase
        .from('payroll_items')
        .select('*, payroll_run:payroll_runs(month, year, status)')
        .eq('employee_id', empId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('announcements')
        .select('*')
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false })
        .limit(3),
    ]);

    const weeklyHours = (weekRes.data || []).reduce(
      (sum, r) => sum + Number(r.hours_worked || 0),
      0
    );

    const leaveBalances = (leaveTypesRes.data || []).map((lt) => {
      const used = (approvedLeavesRes.data || [])
        .filter((l) => l.leave_type_id === lt.id)
        .reduce((sum, l) => sum + Number(l.days_count), 0);
      return {
        name: lt.name,
        quota: lt.days_per_year,
        used,
        balance: lt.days_per_year > 0 ? Math.max(0, lt.days_per_year - used) : 999,
      };
    });

    return res.json({
      today_attendance: todayRes.data || null,
      weekly_hours: +weeklyHours.toFixed(1),
      late_count_this_month: lateRes.count || 0,
      leave_balances: leaveBalances,
      last_payslip: lastPayslipRes.data || null,
      announcements: announcementsRes.data || [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
