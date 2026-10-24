import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth';
import companyRoutes from './routes/company';
import usersRoutes from './routes/users';
import employeesRoutes from './routes/employees';
import attendanceRoutes from './routes/attendance';
import attendanceCorrectionRoutes from './routes/attendance-corrections';
import leavesRoutes from './routes/leaves';
import payrollRoutes from './routes/payroll';
import dashboardRoutes from './routes/dashboard';
import aiRoutes from './routes/ai';
import announcementsRoutes from './routes/announcements';
import notificationsRoutes from './routes/notifications';
import auditLogsRoutes from './routes/audit-logs';

export const createApp = () => {
  const app = express();

  // Global Middlewares
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Vektor HCM API',
      timestamp: new Date().toISOString(),
    });
  });

  // API v1 Routes
  const prefix = '/api/v1';

  // Public setup endpoints (Section 2.1b of HCM Plan)
  app.get(['/setup/status', `${prefix}/setup/status`], async (_req, res) => {
    try {
      const { supabase } = await import('./db');
      const { count } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true });
      return res.json({ initialized: (count || 0) > 0, count: count || 0 });
    } catch {
      return res.json({ initialized: false });
    }
  });

  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/company`, companyRoutes);
  app.use(`${prefix}/users`, usersRoutes);
  app.use(`${prefix}/employees`, employeesRoutes);
  app.use(`${prefix}/attendance`, attendanceRoutes);
  app.use(`${prefix}/attendance/corrections`, attendanceCorrectionRoutes);
  app.use(`${prefix}/leaves`, leavesRoutes);
  app.use(`${prefix}/payroll`, payrollRoutes);
  app.use(`${prefix}/dashboard`, dashboardRoutes);
  app.use(`${prefix}/ai`, aiRoutes);
  app.use(`${prefix}/announcements`, announcementsRoutes);
  app.use(`${prefix}/notifications`, notificationsRoutes);
  app.use(`${prefix}/audit-logs`, auditLogsRoutes);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  return app;
};
