import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zxptpnavemclwwhazmei.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4cHRwbmF2ZW1jbHd3aGF6bWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTcxMDIsImV4cCI6MjA5NDYzMzEwMn0.1UWcV-QXvGEOqcZFmHFc_sgIu3kySt-LBBIv8D5uTtY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
})
