import { Router, Request, Response } from 'express';
import { supabase } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { recordAuditLog } from '../middleware/audit';
import { AnnouncementSchema } from '@vektor/shared';

const router = Router();

// GET /announcements (All roles can read)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, poster:users(email, role)')
      .eq('company_id', req.user!.company_id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ announcements: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /announcements (Admin and HR only)
router.post('/', authMiddleware, requireRole(['admin', 'hr']), async (req: Request, res: Response) => {
  try {
    const parseResult = AnnouncementSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { title, content } = parseResult.data;

    const { data: announcement, error } = await supabase
      .from('announcements')
      .insert({
        company_id: req.user!.company_id,
        title,
        content,
        posted_by: req.user!.id,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    recordAuditLog({
      req,
      action: 'create',
      entity: 'announcement',
      entityId: announcement.id,
      details: { title },
    });

    return res.status(201).json({ announcement });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
