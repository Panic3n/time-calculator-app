import { createClient } from '@supabase/supabase-js'

// Browser/client-side Supabase client using anon key
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
)
