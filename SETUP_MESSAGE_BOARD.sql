-- Create message_board table for home page announcements
CREATE TABLE IF NOT EXISTS public.message_board (
  id TEXT PRIMARY KEY DEFAULT 'main',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DISABLE RLS - Allow all operations (service role will handle auth in API)
ALTER TABLE public.message_board DISABLE ROW LEVEL SECURITY;

-- Insert default message
INSERT INTO public.message_board (id, title, content)
VALUES ('main', 'Welcome', 'Welcome to the Time Calculator App!')
ON CONFLICT (id) DO NOTHING;
