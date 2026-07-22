import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://nluyrpickspjudxlokqv.supabase.co';
const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sdXlycGlja3NwanVkeGxva3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMTg0MjYsImV4cCI6MjA5ODY5NDQyNn0.PXGzj3AjUftOYd42k8chvHNeVGDU_FqRVlKClXH6QL0';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || defaultUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || defaultKey;

// Проверяем, настроены ли реальные ключи
const isConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'your-supabase-project-url' && 
  supabaseAnonKey !== 'your-supabase-anon-key';

export const isSupabaseConfigured = !!isConfigured;

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

