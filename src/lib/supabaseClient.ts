import { createClient } from '@supabase/supabase-js'

// Browser/client-side Supabase client using anon key
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabaseBrowser = createClient(url, key)
