import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { supabase } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { recordAuditLog } from '../middleware/audit';
import {
  CreatePayrollDraftSchema,
  calculatePayrollItem,
  getWorkingDaysInMonth,
} from '@vektor/shared';

const router = Router();

// POST /payroll/draft (HR / Admin creates payroll draft)
router.post('/draft', authMiddleware, requireRole(['admin', 'hr']), async (req: Request, res: Response) => {
  try {
    const parseResult = CreatePayrollDraftSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { month, year } = parseResult.data;
    const companyId = req.user!.company_id;

    // Check if a payroll run already exists for this month/year
    const { data: existingRun } = await supabase
      .from('payroll_runs')
      .select('id, status')
      .eq('company_id', companyId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();

    if (existingRun) {
      if (existingRun.status === 'finalized') {
        return res.status(400).json({
          error: `Payroll for ${month}/${year} is already finalized and cannot be modified.`,
        });
      }
      // If it's draft or submitted, delete old draft items and re-create fresh
      await supabase.from('payroll_runs').delete().eq('id', existingRun.id);
    }

    // 1. Calculate working days in month
    const { data: settings } = await supabase
      .from('company_settings')
      .select('weekend_days')
      .eq('company_id', companyId)
      .single();

    const weekendDays = (settings?.weekend_days as number[]) || [0, 6];

    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const { data: holidays } = await supabase
      .from('public_holidays')
      .select('date')
      .eq('company_id', companyId)
      .gte('date', startDate)
      .lte('date', endDate);

    const holidayDates = (holidays || []).map((h) => h.date);
    const workingDays = getWorkingDaysInMonth(year, month, weekendDays, holidayDates);

    // 2. Fetch all active employees
    const { data: employees, error: empErr } = await supabase
      .from('employees')
      .select('id, basic_salary, first_name, last_name, employee_code, joining_date')
      .eq('company_id', companyId)
      .in('status', ['active', 'probation']);

    if (empErr || !employees || employees.length === 0) {
      return res.status(400).json({ error: 'No active employees found to generate payroll.' });
    }

    // 3. Fetch all attendance for this month
    const { data: attendanceRecords } = await supabase
      .from('attendance')
      .select('employee_id, date, status, hours_worked')
      .eq('company_id', companyId)
      .gte('date', startDate)
      .lte('date', endDate);

    // 4. Fetch all approved leaves for this month
    const { data: leaveRecords } = await supabase
      .from('leave_requests')
      .select('employee_id, days_count, leave_type:leave_types(is_paid)')
      .eq('company_id', companyId)
      .eq('status', 'approved')
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    let totalGross = 0;
    let totalDeductions = 0;
    let totalTax = 0;
    let totalNet = 0;

    const payrollItemsData: any[] = [];

    for (const emp of employees) {
      const empAttendance = (attendanceRecords || []).filter((a) => a.employee_id === emp.id);
      const empLeaves = (leaveRecords || []).filter((l) => l.employee_id === emp.id);

      let presentDays = 0;
      let lateDays = 0;
      let halfDays = 0;
      let absentDays = 0;

      empAttendance.forEach((a) => {
        if (a.status === 'present') presentDays++;
        else if (a.status === 'late') lateDays++;
        else if (a.status === 'half_day') halfDays++;
        else if (a.status === 'absent') absentDays++;
      });

      let paidLeaveDays = 0;
      let unpaidLeaveDays = 0;

      empLeaves.forEach((l: any) => {
        if (l.leave_type?.is_paid) {
          paidLeaveDays += Number(l.days_count || 0);
        } else {
          unpaidLeaveDays += Number(l.days_count || 0);
        }
      });

      // Calculate synthetic absent days if attendance is fewer than working days
      const recordedDays = presentDays + lateDays + halfDays + absentDays + paidLeaveDays + unpaidLeaveDays;
      if (recordedDays < workingDays) {
        absentDays += workingDays - recordedDays;
      }

      const itemCalc = calculatePayrollItem({
        basicSalary: Number(emp.basic_salary),
        workingDaysInMonth: workingDays,
        presentDays,
        lateDays,
        halfDays,
        absentDays,
        unpaidLeaveDays,
        paidLeaveDays,
      });

      totalGross += itemCalc.grossSalary;
      totalDeductions += itemCalc.salaryDeduction;
      totalTax += itemCalc.monthlyTax;
      totalNet += itemCalc.netSalary;

      payrollItemsData.push({
        employee_id: emp.id,
        basic_salary: itemCalc.basicSalary,
        hra: itemCalc.hra,
        medical: itemCalc.medical,
        gross_salary: itemCalc.grossSalary,
        working_days: itemCalc.workingDays,
        per_day_rate: itemCalc.perDayRate,
        present_days: presentDays,
        late_days: lateDays,
        half_days: halfDays,
        absent_days: absentDays,
        paid_leave_days: paidLeaveDays,
        unpaid_leave_days: unpaidLeaveDays,
        deduction_days: itemCalc.deductionDays,
        salary_deduction: itemCalc.salaryDeduction,
        annual_taxable_salary: itemCalc.annualTaxableSalary,
        monthly_tax: itemCalc.monthlyTax,
        net_salary: itemCalc.netSalary,
      });
    }

    // Insert payroll run
    const { data: run, error: runErr } = await supabase
      .from('payroll_runs')
      .insert({
        company_id: companyId,
        month,
        year,
        status: 'draft',
        working_days: workingDays,
        total_gross: totalGross,
        total_deductions: totalDeductions,
        total_tax: totalTax,
        total_net: totalNet,
        employee_count: employees.length,
        created_by: req.user!.id,
      })
      .select()
      .single();

    if (runErr || !run) {
      return res.status(500).json({ error: runErr?.message || 'Failed to create payroll run' });
    }

    // Insert payroll items
    const itemsToInsert = payrollItemsData.map((item) => ({
      ...item,
      payroll_run_id: run.id,
    }));

    const { error: itemsErr } = await supabase.from('payroll_items').insert(itemsToInsert);
    if (itemsErr) {
      return res.status(500).json({ error: itemsErr.message });
    }

    recordAuditLog({
      req,
      action: 'create',
      entity: 'payroll_run',
      entityId: run.id,
      details: {
        month,
        year,
        total_net: totalNet,
        employee_count: employees.length,
      },
    });

    return res.status(201).json({
      success: true,
      payroll_run: run,
      items_count: itemsToInsert.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /payroll/runs
router.get('/runs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let query = supabase
      .from('payroll_runs')
      .select('*')
      .eq('company_id', user.company_id)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    // If Employee, only sees runs that have payslips for them (or they can use /payslips)
    if (user.role === 'employee') {
      return res.status(403).json({ error: 'Use /payroll/payslips for personal payslips' });
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ runs: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /payroll/runs/:id
router.get('/runs/:id', authMiddleware, requireRole(['admin', 'hr']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data: run, error: runErr } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.user!.company_id)
      .single();

    if (runErr || !run) return res.status(404).json({ error: 'Payroll run not found' });

    const { data: items, error: itemsErr } = await supabase
      .from('payroll_items')
      .select('*, employee:employees(first_name, last_name, employee_code, department:departments(name), designation:designations(title))')
      .eq('payroll_run_id', id)
      .order('created_at', { ascending: true });

    if (itemsErr) return res.status(500).json({ error: itemsErr.message });

    return res.json({ run, items: items || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /payroll/runs/:id/submit (HR submits draft for Admin finalization)
router.post('/runs/:id/submit', authMiddleware, requireRole(['hr', 'admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: run } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.user!.company_id)
      .single();

    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    if (run.status === 'finalized') {
      return res.status(400).json({ error: 'Cannot modify a finalized payroll run' });
    }

    const { data: updated, error } = await supabase
      .from('payroll_runs')
      .update({
        status: 'submitted',
        submitted_by: req.user!.id,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    recordAuditLog({
      req,
      action: 'update',
      entity: 'payroll_run_submit',
      entityId: id,
      details: { status: 'submitted' },
    });

    return res.json({ success: true, run: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /payroll/runs/:id/finalize (ADMIN ONLY - Locks the payroll permanently)
router.post('/runs/:id/finalize', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: run } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.user!.company_id)
      .single();

    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    if (run.status === 'finalized') {
      return res.status(400).json({ error: 'Payroll run is already finalized' });
    }

    const { data: updated, error } = await supabase
      .from('payroll_runs')
      .update({
        status: 'finalized',
        finalized_by: req.user!.id,
        finalized_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    recordAuditLog({
      req,
      action: 'finalize',
      entity: 'payroll_run',
      entityId: id,
      details: {
        month: run.month,
        year: run.year,
        total_net: run.total_net,
      },
    });

    return res.json({
      success: true,
      message: 'Payroll run finalized and locked successfully.',
      run: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /payroll/payslips/:employee_id - List payslips
router.get('/payslips/:employee_id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const empId = req.params.employee_id;

    if (user.role === 'employee' && user.employee_id !== empId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { data: payslips, error } = await supabase
      .from('payroll_items')
      .select('*, payroll_run:payroll_runs(id, month, year, status)')
      .eq('employee_id', empId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ payslips: payslips || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /payroll/payslips/:item_id/pdf - Generate PDF payslip
router.get('/payslips/item/:item_id/pdf', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const itemId = req.params.item_id;

    const { data: item, error } = await supabase
      .from('payroll_items')
      .select('*, payroll_run:payroll_runs(month, year, company_id), employee:employees(*, department:departments(name), designation:designations(title))')
      .eq('id', itemId)
      .single();

    if (error || !item) return res.status(404).json({ error: 'Payslip not found' });

    // Scope check: employee can only download their own payslip
    if (user.role === 'employee' && user.employee_id !== item.employee_id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { data: company } = await supabase
      .from('companies')
      .select('name, city')
      .eq('id', user.company_id)
      .single();

    // Stream PDF using PDFKit
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payslip_${item.employee?.employee_code}_${item.payroll_run?.month}_${item.payroll_run?.year}.pdf"`
    );

    doc.pipe(res);

    // Header
    doc.fontSize(22).fillColor('#4F46E5').text(company?.name || 'Vektor HCM', { align: 'center' });
    doc.fontSize(12).fillColor('#6B7280').text('Confidential Salary Payslip', { align: 'center' });
    doc.moveDown(1.5);

    // Employee & Period Info Box
    doc.fontSize(10).fillColor('#111827');
    doc.text(`Employee: ${item.employee?.first_name} ${item.employee?.last_name} (${item.employee?.employee_code})`);
    doc.text(`Designation: ${item.employee?.designation?.title || 'Staff'}`);
    doc.text(`Department: ${item.employee?.department?.name || 'General'}`);
    doc.text(`Pay Period: ${item.payroll_run?.month} / ${item.payroll_run?.year}`);
    doc.text(`Working Days: ${item.working_days}`);
    doc.moveDown(1);

    // Divider
    doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(1);

    // Earnings Section
    doc.fontSize(12).fillColor('#4F46E5').text('EARNINGS');
    doc.fontSize(10).fillColor('#374151');
    doc.text(`Basic Salary: PKR ${Number(item.basic_salary).toLocaleString()}`);
    doc.text(`House Rent Allowance (HRA 40%): PKR ${Number(item.hra).toLocaleString()}`);
    doc.text(`Medical Allowance (10%): PKR ${Number(item.medical).toLocaleString()}`);
    doc.fontSize(11).fillColor('#111827').text(`Gross Salary: PKR ${Number(item.gross_salary).toLocaleString()}`);
    doc.moveDown(1);

    // Deductions Section
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#DC2626').text('DEDUCTIONS & TAX');
    doc.font('Helvetica').fontSize(10).fillColor('#374151');
    doc.text(`Per-Day Rate: PKR ${Number(item.per_day_rate).toLocaleString()}`);
    doc.text(`Deduction Days (Absent + Unpaid + Half-days): ${item.deduction_days} days`);
    doc.text(`Attendance Deduction: PKR ${Number(item.salary_deduction).toLocaleString()}`);
    doc.text(`Monthly Income Tax: PKR ${Number(item.monthly_tax).toLocaleString()}`);
    doc.moveDown(1.5);

    // Net Pay Box - positioned properly below deductions without text overlap
    const boxY = doc.y;
    doc.roundedRect(40, boxY, 515, 48, 6).fillAndStroke('#ECFDF5', '#6EE7B7');
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#065F46').text(
      `NET TAKE-HOME PAY: PKR ${Number(item.net_salary).toLocaleString()}`,
      55,
      boxY + 17
    );
    doc.y = boxY + 65;
    doc.moveDown(2);

    // Footer
    doc.font('Helvetica').fontSize(8).fillColor('#9CA3AF').text(
      'This is a system-generated document from Vektor HCM. No physical signature required.',
      { align: 'center' }
    );

    doc.end();
  } catch (err: any) {
    console.error('PDF error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
