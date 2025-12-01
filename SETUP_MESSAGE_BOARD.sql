-- Create message_board table for home page announcements
CREATE TABLE IF NOT EXISTS public.message_board (
  id TEXT PRIMARY KEY DEFAULT 'main',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.message_board ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read" ON public.message_board
  FOR SELECT USING (true);

CREATE POLICY "Allow admin write" ON public.message_board
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Allow admin update" ON public.message_board
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.app_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Insert default message
INSERT INTO public.message_board (id, title, content)
VALUES ('main', 'Welcome', 'Welcome to the Time Calculator App!')
ON CONFLICT (id) DO NOTHING;
