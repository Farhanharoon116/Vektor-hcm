import { Request } from 'express';
import { supabase } from '../db';
import { UserRole } from '@vektor/shared';

export interface AuditParams {
  req: Request;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'finalize' | 'login';
  entity: string;
  entityId?: string;
  details?: Record<string, any>;
}

export async function recordAuditLog(params: AuditParams): Promise<void> {
  try {
    const { req, action, entity, entityId, details } = params;
    const user = req.user;
    if (!user) return;

    await supabase.from('audit_logs').insert({
      company_id: user.company_id,
      actor_id: user.id,
      actor_email: user.email,
      actor_role: user.role,
      action,
      entity,
      entity_id: entityId || null,
      details: details || null,
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
