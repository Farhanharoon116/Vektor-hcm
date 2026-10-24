import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'vektor-hcm-development-jwt-secret-min-32-chars-long!',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'openai/gpt-oss-20b',
  aiBaseUrl: process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  adminEmailFallback: process.env.ADMIN_EMAIL || 'admin@vektor.local',
  adminPasswordFallback: process.env.ADMIN_PASSWORD || 'AdminPassword123!',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'Vektor HCM <support@gettrakr.tech>',
};
