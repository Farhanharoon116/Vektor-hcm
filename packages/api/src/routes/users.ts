import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { recordAuditLog } from '../middleware/audit';
import { CreateUserSchema } from '@vektor/shared';
import { emailService } from '../services/email.service';

const router = Router();

// GET /users
router.get('/', authMiddleware, requireRole(['admin', 'hr']), async (req: Request, res: Response) => {
  try {
    let query = supabase
      .from('users')
      .select('id, email, role, is_active, must_change_password, created_at')
      .eq('company_id', req.user!.company_id)
      .order('created_at', { ascending: false });

    // If HR, only show employee users
    if (req.user!.role === 'hr') {
      query = query.eq('role', 'employee');
    }

    const { data: users, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ users: users || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /users (Admin only creates HR/Employee accounts)
router.post('/', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const parseResult = CreateUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { email, password, role } = parseResult.data;

    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        company_id: req.user!.company_id,
        email: email.toLowerCase().trim(),
        password_hash,
        role,
        is_active: true,
        must_change_password: true, // Temporary password requiring change on first sign-in
      })
      .select('id, email, role, is_active, must_change_password, created_at')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    recordAuditLog({
      req,
      action: 'create',
      entity: 'user',
      entityId: newUser.id,
      details: { email, role },
    });

    return res.status(201).json({ user: newUser });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /users/:id/deactivate (Admin only)
router.patch('/:id/deactivate', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.id;
    if (targetUserId === req.user!.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', targetUserId)
      .eq('company_id', req.user!.company_id)
      .single();

    if (fetchErr || !user) return res.status(404).json({ error: 'User not found' });

    const newStatus = !user.is_active;

    const { data: updated, error } = await supabase
      .from('users')
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq('id', targetUserId)
      .select('id, email, role, is_active')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    recordAuditLog({
      req,
      action: 'update',
      entity: 'user',
      entityId: targetUserId,
      details: { is_active: newStatus },
    });

    return res.json({ user: updated, message: `User ${newStatus ? 'activated' : 'deactivated'} successfully` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /users/:id/reset-password (Admin only)
router.post('/:id/reset-password', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const tempPassword = req.body.password || 'Welcome' + Math.floor(1000 + Math.random() * 9000) + '!';

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(tempPassword, salt);

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        password_hash,
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId)
      .eq('company_id', req.user!.company_id)
      .select('email')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    recordAuditLog({
      req,
      action: 'update',
      entity: 'user_password_reset',
      entityId: targetUserId,
      details: { reset_by: req.user!.email },
    });

    // Send reset email via Resend
    if (updatedUser?.email) {
      emailService.sendPasswordReset({
        to: updatedUser.email,
        temporaryPassword: tempPassword,
      }).catch((err) => console.error('Failed to send reset email:', err));
    }

    return res.json({
      success: true,
      message: 'Temporary password generated and emailed successfully',
      temporary_password: tempPassword,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
