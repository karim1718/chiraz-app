import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseUrl = rawSupabaseUrl?.trim().replace(/^["']|["']$/g, '');
const supabaseAnonKey = rawSupabaseAnonKey?.trim().replace(/^["']|["']$/g, '');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase environment variables are missing. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in local .env and in Vercel Project Settings > Environment Variables.'
  );
}

if (!/^https?:\/\/.+/i.test(supabaseUrl)) {
  throw new Error(
    `Invalid VITE_SUPABASE_URL value: "${supabaseUrl}". It must look like https://your-project-ref.supabase.co`
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
