import { createClient } from '@supabase/supabase-js';
import { config } from './config';

if (!config.supabaseUrl || !config.supabaseKey) {
  console.warn('⚠️ SUPABASE_URL or SUPABASE_KEY missing in environment variables. Database operations may fail until provided.');
}

export const supabase = createClient(
  config.supabaseUrl || 'https://placeholder.supabase.co',
  config.supabaseKey || 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
