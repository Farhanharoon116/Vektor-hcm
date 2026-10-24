import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { supabase } from '../db';
import { UserRole } from '@vektor/shared';

export interface AuthUser {
  id: string;
  company_id: string;
  email: string;
  role: UserRole;
  employee_id?: string;
  must_change_password?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication token required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Lookup user in DB to verify active status and grab linked employee_id
    const { data: user, error } = await supabase
      .from('users')
      .select('id, company_id, email, role, is_active, must_change_password')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'User not found or session invalid' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Your account has been deactivated' });
    }

    // If employee role, look up linked employee record
    let employeeId: string | undefined;
    if (user.role === 'employee') {
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      employeeId = emp?.id;
    }

    req.user = {
      id: user.id,
      company_id: user.company_id,
      email: user.email,
      role: user.role as UserRole,
      employee_id: employeeId,
      must_change_password: user.must_change_password,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server authentication error' });
  }
};

/**
 * Role-based access control middleware
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of [${allowedRoles.join(', ')}] role.`,
      });
    }

    next();
  };
};
