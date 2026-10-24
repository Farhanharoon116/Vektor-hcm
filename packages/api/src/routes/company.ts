import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../db';
import { config } from '../config';
import { authMiddleware, requireRole } from '../middleware/auth';
import { recordAuditLog } from '../middleware/audit';
import { CompanySetupSchema, UpdateCompanySettingsSchema } from '@vektor/shared';

const router = Router();

// GET /company/status - public endpoint to check if system is already initialized
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const { count, error } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const isInitialized = (count || 0) > 0;
    return res.json({ initialized: isInitialized });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Status check failed' });
  }
});

// POST /company/setup - Multi-organization & first-run setup wizard
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const rawBody = {
      ...req.body,
      name: req.body.name || req.body.company_name,
    };

    const parseResult = CompanySetupSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid setup data' });
    }

    const {
      name,
      admin_email,
      admin_password,
      city,
      office_start,
      grace_minutes,
      half_day_hours,
      weekend_days,
      office_latitude,
      office_longitude,
      office_radius_meters,
    } = parseResult.data;

    const normalizedEmail = admin_email.toLowerCase().trim();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      // Validate password for existing admin
      const isMatch = await bcrypt.compare(admin_password, existingUser.password_hash);
      if (!isMatch) {
        return res.status(400).json({
          error: 'An account with this email address already exists. Please enter your existing password to update company setup, or sign in.',
        });
      }

      // Update existing company
      const { data: company, error: compErr } = await supabase
        .from('companies')
        .update({
          name,
          city: city || 'Karachi',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.company_id)
        .select()
        .single();

      if (compErr || !company) {
        return res.status(500).json({ error: compErr?.message || 'Failed to update company' });
      }

      // Upsert company settings
      await supabase.from('company_settings').upsert({
        company_id: company.id,
        office_start: office_start || '09:00',
        grace_minutes: grace_minutes ?? 15,
        half_day_hours: half_day_hours ?? 5.0,
        weekend_days: weekend_days || [0, 6],
        office_latitude: office_latitude || null,
        office_longitude: office_longitude || null,
        office_radius_meters: office_radius_meters || 150,
        updated_at: new Date().toISOString(),
      });

      // Sign JWT token
      const token = jwt.sign(
        {
          id: existingUser.id,
          company_id: company.id,
          email: existingUser.email,
          role: existingUser.role,
        },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      return res.status(200).json({
        success: true,
        message: 'Company settings updated successfully',
        token,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          role: existingUser.role,
          company_id: company.id,
        },
        company,
      });
    }

    // 1. Create brand new company
    const { data: company, error: compErr } = await supabase
      .from('companies')
      .insert({
        name,
        city: city || 'Karachi',
        email: normalizedEmail,
      })
      .select()
      .single();

    if (compErr || !company) {
      return res.status(500).json({ error: compErr?.message || 'Failed to create company' });
    }

    // 2. Create company settings
    await supabase.from('company_settings').insert({
      company_id: company.id,
      office_start: office_start || '09:00',
      grace_minutes: grace_minutes ?? 15,
      half_day_hours: half_day_hours ?? 5.0,
      weekend_days: weekend_days || [0, 6],
      office_latitude: office_latitude || null,
      office_longitude: office_longitude || null,
      office_radius_meters: office_radius_meters || 150,
    });

    // 3. Create Admin user
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(admin_password, salt);

    const { data: adminUser, error: userErr } = await supabase
      .from('users')
      .insert({
        company_id: company.id,
        email: normalizedEmail,
        password_hash,
        role: 'admin',
        is_active: true,
        must_change_password: false,
      })
      .select()
      .single();

    if (userErr || !adminUser) {
      return res.status(500).json({ error: userErr?.message || 'Failed to create admin user' });
    }

    // 4. Create standard default leave types from brief (Annual 14, Sick 8, Casual 10, Unpaid unlimited)
    await supabase.from('leave_types').insert([
      { company_id: company.id, name: 'Annual', is_paid: true, days_per_year: 14 },
      { company_id: company.id, name: 'Sick', is_paid: true, days_per_year: 8 },
      { company_id: company.id, name: 'Casual', is_paid: true, days_per_year: 10 },
      { company_id: company.id, name: 'Unpaid', is_paid: false, days_per_year: 0 },
    ]);

    // 5. Create default departments
    await supabase.from('departments').insert([
      { company_id: company.id, name: 'Engineering' },
      { company_id: company.id, name: 'Human Resources' },
      { company_id: company.id, name: 'Operations' },
      { company_id: company.id, name: 'Finance' },
    ]);

    // 6. Create default designations
    await supabase.from('designations').insert([
      { company_id: company.id, title: 'Software Engineer' },
      { company_id: company.id, title: 'Senior Software Engineer' },
      { company_id: company.id, title: 'HR Manager' },
      { company_id: company.id, title: 'HR Officer' },
      { company_id: company.id, title: 'Accountant' },
      { company_id: company.id, title: 'Operations Associate' },
    ]);

    // Sign JWT for instant login
    const token = jwt.sign(
      {
        id: adminUser.id,
        company_id: company.id,
        email: adminUser.email,
        role: 'admin',
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Company and Admin account initialized successfully',
      token,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        company_id: company.id,
      },
      company,
    });
  } catch (error: any) {
    console.error('Setup error:', error);
    return res.status(500).json({ error: error.message || 'Setup failed' });
  }
});

// GET /company/settings
router.get('/settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { data: settings, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', req.user!.company_id)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ settings });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /company/settings (Admin only)
router.patch('/settings', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const parseResult = UpdateCompanySettingsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { data: updated, error } = await supabase
      .from('company_settings')
      .update({
        ...parseResult.data,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', req.user!.company_id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    recordAuditLog({
      req,
      action: 'update',
      entity: 'company_settings',
      details: parseResult.data,
    });

    return res.json({ settings: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Departments
router.get('/departments', authMiddleware, async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('company_id', req.user!.company_id)
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ departments: data || [] });
});

router.post('/departments', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const { data, error } = await supabase
    .from('departments')
    .insert({ company_id: req.user!.company_id, name })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ department: data });
});

router.delete('/departments/:id', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', req.params.id)
    .eq('company_id', req.user!.company_id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// Designations
router.get('/designations', authMiddleware, async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('designations')
    .select('*')
    .eq('company_id', req.user!.company_id)
    .order('title');
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ designations: data || [] });
});

router.post('/designations', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const { data, error } = await supabase
    .from('designations')
    .insert({ company_id: req.user!.company_id, title })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ designation: data });
});

router.delete('/designations/:id', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  const { error } = await supabase
    .from('designations')
    .delete()
    .eq('id', req.params.id)
    .eq('company_id', req.user!.company_id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// Leave Types
router.get('/leave-types', authMiddleware, async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('leave_types')
    .select('*')
    .eq('company_id', req.user!.company_id)
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ leave_types: data || [] });
});

router.post('/leave-types', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  const { name, is_paid, days_per_year } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const { data, error } = await supabase
    .from('leave_types')
    .insert({
      company_id: req.user!.company_id,
      name,
      is_paid: is_paid ?? true,
      days_per_year: days_per_year ?? 10,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ leave_type: data });
});

// POST /company/leave-types/defaults - Seed standard leave quotas (Annual 14, Sick 8, Casual 10, Unpaid unlimited)
router.post('/leave-types/defaults', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.company_id;
    const defaultTypes = [
      { company_id: companyId, name: 'Annual', is_paid: true, days_per_year: 14 },
      { company_id: companyId, name: 'Sick', is_paid: true, days_per_year: 8 },
      { company_id: companyId, name: 'Casual', is_paid: true, days_per_year: 10 },
      { company_id: companyId, name: 'Unpaid', is_paid: false, days_per_year: 0 },
    ];

    for (const dt of defaultTypes) {
      const { data: existing } = await supabase
        .from('leave_types')
        .select('id')
        .eq('company_id', companyId)
        .eq('name', dt.name)
        .maybeSingle();

      if (!existing) {
        await supabase.from('leave_types').insert(dt);
      }
    }

    const { data: allTypes } = await supabase
      .from('leave_types')
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    return res.json({ success: true, message: 'Default leave types configured', leave_types: allTypes || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to populate default leave types' });
  }
});

// Public Holidays
router.get('/holidays', authMiddleware, async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('public_holidays')
    .select('*')
    .eq('company_id', req.user!.company_id)
    .order('date', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ holidays: data || [] });
});

router.post('/holidays', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  const { name, date } = req.body;
  if (!name || !date) return res.status(400).json({ error: 'Name and date are required' });

  const { data, error } = await supabase
    .from('public_holidays')
    .insert({
      company_id: req.user!.company_id,
      name,
      date,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ holiday: data });
});

router.delete('/holidays/:id', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  const { error } = await supabase
    .from('public_holidays')
    .delete()
    .eq('id', req.params.id)
    .eq('company_id', req.user!.company_id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

export default router;
