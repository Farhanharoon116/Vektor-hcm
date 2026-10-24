import { Router, Request, Response } from 'express';
import { supabase } from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /notifications (User sees their own notifications)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ notifications: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /notifications/read-all
router.patch('/read-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user!.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
