import { createClient } from '@supabase/supabase-js'

// GANTI DENGAN URL DARI SUPABASE ANDA (Tahap C)
const supabaseUrl = 'https://tidickkdktgvrmgbymax.supabase.co'

// GANTI DENGAN ANON KEY DARI SUPABASE ANDA (Tahap C)
const supabaseKey = 'sb_publishable_nWLzUy3NmvfqcMINOUUTIA_JeVMmX8G'

export const supabase = createClient(supabaseUrl, supabaseKey)