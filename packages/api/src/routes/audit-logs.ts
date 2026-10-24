import { Router, Request, Response } from 'express';
import { supabase } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// GET /audit-logs (Admin only)
router.get('/', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { action, entity, limit } = req.query;
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('company_id', req.user!.company_id)
      .order('created_at', { ascending: false });

    if (action) query = query.eq('action', action);
    if (entity) query = query.eq('entity', entity);

    const maxRows = Math.min(Number(limit) || 50, 100);
    const { data, error } = await query.limit(maxRows);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ audit_logs: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
