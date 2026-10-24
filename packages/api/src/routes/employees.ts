import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { recordAuditLog } from '../middleware/audit';
import {
  RegisterEmployeeSchema,
  UpdateEmployeeSchema,
  UpdateEmployeeSelfSchema,
  calculateSalaryStructure,
} from '@vektor/shared';
import { emailService } from '../services/email.service';

const router = Router();

// GET /employees
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let query = supabase
      .from('employees')
      .select('*, department:departments(*), designation:designations(*)')
      .eq('company_id', user.company_id);

    // If employee role, data scope guard: only own profile!
    if (user.role === 'employee') {
      if (!user.employee_id) {
        return res.json({ employees: [] });
      }
      query = query.eq('id', user.employee_id);
    } else {
      // Filters for Admin / HR
      const { search, department_id, status } = req.query;
      if (department_id) {
        query = query.eq('department_id', department_id);
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (search && typeof search === 'string') {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_code.ilike.%${search}%,email.ilike.%${search}%`
        );
      }
    }

    const { data: employees, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ employees: employees || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /employees (HR / Admin only)
router.post('/', authMiddleware, requireRole(['admin', 'hr']), async (req: Request, res: Response) => {
  try {
    const parseResult = RegisterEmployeeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const payload = parseResult.data;
    const companyId = req.user!.company_id;

    // Check unique employee code and email in this company
    const { data: existingEmp } = await supabase
      .from('employees')
      .select('id, employee_code, email')
      .eq('company_id', companyId)
      .or(`employee_code.eq.${payload.employee_code},email.eq.${payload.email.toLowerCase().trim()}`)
      .maybeSingle();

    if (existingEmp) {
      if (existingEmp.employee_code === payload.employee_code) {
        return res.status(400).json({ error: 'Employee code already exists' });
      }
      return res.status(400).json({ error: 'Employee email already exists' });
    }

    // Calculate HCM salary structure: gross = basic * 1.5 (40% HRA, 10% Medical)
    const { basic, hra, medical, gross } = calculateSalaryStructure(payload.basic_salary);

    // Create user login with temporary password
    const tempPassword = 'Vektor' + Math.floor(1000 + Math.random() * 9000) + '!';
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(tempPassword, salt);

    const { data: newUser, error: userErr } = await supabase
      .from('users')
      .insert({
        company_id: companyId,
        email: payload.email.toLowerCase().trim(),
        password_hash,
        role: 'employee',
        is_active: true,
        must_change_password: true, // change on first login
      })
      .select('id')
      .single();

    if (userErr || !newUser) {
      return res.status(500).json({ error: userErr?.message || 'Failed to create user login' });
    }

    // Insert employee
    const { data: employee, error: empErr } = await supabase
      .from('employees')
      .insert({
        company_id: companyId,
        user_id: newUser.id,
        employee_code: payload.employee_code,
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email.toLowerCase().trim(),
        phone: payload.phone || null,
        address: payload.address || null,
        gender: payload.gender || null,
        joining_date: payload.joining_date,
        department_id: payload.department_id || null,
        designation_id: payload.designation_id || null,
        status: payload.status,
        basic_salary: basic,
        hra,
        medical,
        gross_salary: gross,
      })
      .select('*, department:departments(*), designation:designations(*)')
      .single();

    if (empErr || !employee) {
      return res.status(500).json({ error: empErr?.message || 'Failed to register employee' });
    }

    recordAuditLog({
      req,
      action: 'create',
      entity: 'employee',
      entityId: employee.id,
      details: {
        code: employee.employee_code,
        name: `${employee.first_name} ${employee.last_name}`,
        gross_salary: gross,
      },
    });

    // Send credentials via Resend email
    emailService.sendWelcomeCredentials({
      to: employee.email,
      employeeName: `${employee.first_name} ${employee.last_name}`,
      temporaryPassword: tempPassword,
      role: 'employee',
    }).catch((err) => console.error('Failed to send welcome credentials email:', err));

    return res.status(201).json({
      employee,
      temporary_password: tempPassword,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /employees/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const empId = req.params.id;

    if (user.role === 'employee' && user.employee_id !== empId) {
      return res.status(403).json({ error: 'Access denied. You can only view your own profile.' });
    }

    const { data: employee, error } = await supabase
      .from('employees')
      .select('*, department:departments(*), designation:designations(*)')
      .eq('id', empId)
      .eq('company_id', user.company_id)
      .single();

    if (error || !employee) return res.status(404).json({ error: 'Employee not found' });
    return res.json({ employee });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /employees/:id
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const empId = req.params.id;

    // Scope check: employee can ONLY update their own phone and address
    if (user.role === 'employee') {
      if (user.employee_id !== empId) {
        return res.status(403).json({ error: 'Access denied.' });
      }
      const selfResult = UpdateEmployeeSelfSchema.safeParse(req.body);
      if (!selfResult.success) {
        return res.status(400).json({ error: selfResult.error.errors[0].message });
      }

      const { data: updated, error } = await supabase
        .from('employees')
        .update({
          ...selfResult.data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', empId)
        .eq('company_id', user.company_id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ employee: updated });
    }

    // HR or Admin update
    const parseResult = UpdateEmployeeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const updateData: any = {
      ...parseResult.data,
      updated_at: new Date().toISOString(),
    };

    // If basic salary changed, recompute salary structure!
    if (parseResult.data.basic_salary) {
      const { basic, hra, medical, gross } = calculateSalaryStructure(parseResult.data.basic_salary);
      updateData.basic_salary = basic;
      updateData.hra = hra;
      updateData.medical = medical;
      updateData.gross_salary = gross;
    }

    const { data: updated, error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', empId)
      .eq('company_id', user.company_id)
      .select('*, department:departments(*), designation:designations(*)')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    recordAuditLog({
      req,
      action: 'update',
      entity: 'employee',
      entityId: empId,
      details: updateData,
    });

    return res.json({ employee: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

let hasFaceDescriptorsColumnCache: boolean | null = null;
async function hasFaceDescriptorsColumn(): Promise<boolean> {
  if (hasFaceDescriptorsColumnCache !== null) return hasFaceDescriptorsColumnCache;
  try {
    const { error } = await supabase.from('employees').select('face_descriptors').limit(0);
    hasFaceDescriptorsColumnCache = !error;
  } catch {
    hasFaceDescriptorsColumnCache = false;
  }
  return hasFaceDescriptorsColumnCache;
}

// POST /employees/:id/face-photo & /employees/:id/enroll-face
// Enrolls or re-enrolls biometric face reference (5 descriptors + optional photo)
const handleFaceEnrollment = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const empId = req.params.id;

    // HR and Admin can re-enroll any employee; Employee can re-enroll themselves
    if (user.role === 'employee' && user.employee_id !== empId) {
      return res.status(403).json({ error: 'Access denied. You can only enroll your own biometric profile.' });
    }

    const { image_data, face_descriptors, face_descriptor } = req.body;

    let photoUrl = typeof image_data === 'string' ? image_data : null;
    let fileName: string | null = null;

    if (image_data && typeof image_data === 'string' && image_data.startsWith('data:image')) {
      try {
        const base64Data = image_data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fileName = `emp-${empId}-${Date.now()}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from('employee-faces')
          .upload(fileName, buffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from('employee-faces')
            .getPublicUrl(fileName);
          if (urlData?.publicUrl) {
            photoUrl = urlData.publicUrl;
          }
        }
      } catch (storageErr) {
        console.warn('Storage bucket upload fallback:', storageErr);
      }
    }

    // Clean and normalize descriptors
    const descriptors: number[][] = [];
    if (Array.isArray(face_descriptors)) {
      for (const d of face_descriptors) {
        if (Array.isArray(d) && d.length > 0) descriptors.push(d);
      }
    }
    const primaryDescriptor = Array.isArray(face_descriptor)
      ? face_descriptor
      : descriptors.length > 0
      ? descriptors[0]
      : null;

    const hasDescCol = await hasFaceDescriptorsColumn();

    const updateData: any = {
      face_enrolled: true,
      face_descriptor: {
        photo_url: photoUrl,
        storage_file: fileName,
        descriptors: descriptors.length > 0 ? descriptors : undefined,
        descriptor: primaryDescriptor,
        enrolled_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    };

    if (hasDescCol && descriptors.length > 0) {
      updateData.face_descriptors = descriptors;
    }

    const { data: updated, error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', empId)
      .eq('company_id', user.company_id)
      .select('*, department:departments(*), designation:designations(*)')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    recordAuditLog({
      req,
      action: 'update',
      entity: 'employee_face_enrollment',
      entityId: empId,
      details: {
        descriptors_count: descriptors.length,
        has_photo: !!photoUrl,
        enrolled_by_role: user.role,
      },
    });

    return res.json({
      success: true,
      message: 'Biometric face enrolled successfully with live descriptors',
      photo_url: photoUrl,
      descriptors_count: descriptors.length,
      employee: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

router.post('/:id/face-photo', authMiddleware, handleFaceEnrollment);
router.post('/:id/enroll-face', authMiddleware, handleFaceEnrollment);


// GET /employees/:id/360 - Employee 360 Profile
router.get('/:id/360', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const empId = req.params.id;

    if (user.role === 'employee' && user.employee_id !== empId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // 1. Employee Info
    const { data: employee, error: empErr } = await supabase
      .from('employees')
      .select('*, department:departments(*), designation:designations(*)')
      .eq('id', empId)
      .eq('company_id', user.company_id)
      .single();

    if (empErr || !employee) return res.status(404).json({ error: 'Employee not found' });

    // 2. Attendance Summary (current month)
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const { data: attendanceRecords } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', empId)
      .gte('date', startOfMonth);

    const attendanceStats = {
      present: 0,
      late: 0,
      half_day: 0,
      absent: 0,
      total_hours: 0,
    };

    (attendanceRecords || []).forEach((att) => {
      if (att.status === 'present') attendanceStats.present++;
      else if (att.status === 'late') attendanceStats.late++;
      else if (att.status === 'half_day') attendanceStats.half_day++;
      else if (att.status === 'absent') attendanceStats.absent++;
      attendanceStats.total_hours += Number(att.hours_worked || 0);
    });

    // 3. Leave Balances
    const { data: leaveTypes } = await supabase
      .from('leave_types')
      .select('*')
      .eq('company_id', user.company_id);

    const { data: approvedLeaves } = await supabase
      .from('leave_requests')
      .select('leave_type_id, days_count')
      .eq('employee_id', empId)
      .eq('status', 'approved');

    const leaveBalances = (leaveTypes || []).map((lt) => {
      const used = (approvedLeaves || [])
        .filter((l) => l.leave_type_id === lt.id)
        .reduce((sum, l) => sum + Number(l.days_count), 0);
      return {
        leave_type_id: lt.id,
        leave_type_name: lt.name,
        is_paid: lt.is_paid,
        quota: lt.days_per_year,
        used,
        balance: lt.days_per_year > 0 ? Math.max(0, lt.days_per_year - used) : 999,
      };
    });

    // 4. Recent Payslips
    const { data: payslips } = await supabase
      .from('payroll_items')
      .select('*, payroll_run:payroll_runs(month, year, status)')
      .eq('employee_id', empId)
      .order('created_at', { ascending: false })
      .limit(6);

    return res.json({
      employee,
      attendanceStats,
      leaveBalances,
      recentPayslips: payslips || [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /employees/export/csv
router.get('/export/csv', authMiddleware, requireRole(['admin', 'hr']), async (req: Request, res: Response) => {
  try {
    const { data: employees } = await supabase
      .from('employees')
      .select('employee_code, first_name, last_name, email, phone, gender, joining_date, basic_salary, gross_salary, status, department:departments(name), designation:designations(title)')
      .eq('company_id', req.user!.company_id)
      .order('employee_code');

    const headers = [
      'Employee Code',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Gender',
      'Joining Date',
      'Department',
      'Designation',
      'Basic Salary',
      'Gross Salary',
      'Status',
    ];

    const rows = (employees || []).map((e: any) => [
      `"${e.employee_code}"`,
      `"${e.first_name}"`,
      `"${e.last_name}"`,
      `"${e.email}"`,
      `"${e.phone || ''}"`,
      `"${e.gender || ''}"`,
      `"${e.joining_date}"`,
      `"${e.department?.name || ''}"`,
      `"${e.designation?.title || ''}"`,
      e.basic_salary,
      e.gross_salary,
      `"${e.status}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
    return res.send(csvContent);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /employees/import/csv with dry-run support
router.post('/import/csv', authMiddleware, requireRole(['admin', 'hr']), async (req: Request, res: Response) => {
  try {
    const isDryRun = req.query.dry_run === 'true';
    const { rows } = req.body; // Expecting parsed rows array from client
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Please provide CSV rows array' });
    }

    const companyId = req.user!.company_id;

    // Fetch existing depts and designations
    const { data: depts } = await supabase.from('departments').select('id, name').eq('company_id', companyId);
    const { data: desigs } = await supabase.from('designations').select('id, title').eq('company_id', companyId);
    const deptMap = new Map((depts || []).map((d) => [d.name.toLowerCase().trim(), d.id]));
    const desigMap = new Map((desigs || []).map((d) => [d.title.toLowerCase().trim(), d.id]));

    // Fetch existing employee codes and emails
    const { data: existingEmps } = await supabase.from('employees').select('employee_code, email').eq('company_id', companyId);
    const existingCodes = new Set((existingEmps || []).map((e) => e.employee_code));
    const existingEmails = new Set((existingEmps || []).map((e) => e.email.toLowerCase()));

    const errors: { row: number; field: string; reason: string }[] = [];
    const validEmployeesToInsert: any[] = [];

    rows.forEach((row: any, index: number) => {
      const rowNum = index + 1;
      const code = String(row.employee_code || '').trim();
      const email = String(row.email || '').toLowerCase().trim();
      const firstName = String(row.first_name || '').trim();
      const lastName = String(row.last_name || '').trim();
      const basicSalary = Number(row.basic_salary);
      const joiningDate = String(row.joining_date || '').trim();
      const deptName = String(row.department || '').toLowerCase().trim();
      const desigTitle = String(row.designation || '').toLowerCase().trim();

      if (!code) errors.push({ row: rowNum, field: 'employee_code', reason: 'Employee code is required' });
      else if (existingCodes.has(code)) errors.push({ row: rowNum, field: 'employee_code', reason: 'Employee code already exists' });

      if (!email || !email.includes('@')) errors.push({ row: rowNum, field: 'email', reason: 'Valid email is required' });
      else if (existingEmails.has(email)) errors.push({ row: rowNum, field: 'email', reason: 'Email already exists' });

      if (!firstName) errors.push({ row: rowNum, field: 'first_name', reason: 'First name is required' });
      if (!lastName) errors.push({ row: rowNum, field: 'last_name', reason: 'Last name is required' });

      if (isNaN(basicSalary) || basicSalary <= 0) {
        errors.push({ row: rowNum, field: 'basic_salary', reason: 'Basic salary must be greater than 0' });
      }

      if (!joiningDate || !/^\d{4}-\d{2}-\d{2}$/.test(joiningDate)) {
        errors.push({ row: rowNum, field: 'joining_date', reason: 'Joining date must be in YYYY-MM-DD format' });
      }

      const department_id = deptMap.get(deptName) || null;
      const designation_id = desigMap.get(desigTitle) || null;

      if (errors.filter((e) => e.row === rowNum).length === 0) {
        const { basic, hra, medical, gross } = calculateSalaryStructure(basicSalary);
        validEmployeesToInsert.push({
          company_id: companyId,
          employee_code: code,
          first_name: firstName,
          last_name: lastName,
          email,
          phone: row.phone || null,
          joining_date: joiningDate,
          department_id,
          designation_id,
          basic_salary: basic,
          hra,
          medical,
          gross_salary: gross,
          status: 'active',
        });
        existingCodes.add(code);
        existingEmails.add(email);
      }
    });

    if (isDryRun || errors.length > 0) {
      return res.json({
        dry_run: true,
        valid_count: validEmployeesToInsert.length,
        error_count: errors.length,
        errors,
        can_proceed: errors.length === 0,
      });
    }

    // Insert valid employees and create logins
    for (const emp of validEmployeesToInsert) {
      const tempPassword = 'Vektor' + Math.floor(1000 + Math.random() * 9000) + '!';
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(tempPassword, salt);

      const { data: newUser } = await supabase
        .from('users')
        .insert({
          company_id: companyId,
          email: emp.email,
          password_hash,
          role: 'employee',
          is_active: true,
          must_change_password: true,
        })
        .select('id')
        .single();

      if (newUser) {
        emp.user_id = newUser.id;
        await supabase.from('employees').insert(emp);
      }
    }

    recordAuditLog({
      req,
      action: 'create',
      entity: 'employees_csv_import',
      details: { count: validEmployeesToInsert.length },
    });

    return res.status(201).json({
      success: true,
      imported_count: validEmployeesToInsert.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
