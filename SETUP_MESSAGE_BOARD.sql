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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read" ON public.message_board;
DROP POLICY IF EXISTS "Allow admin write" ON public.message_board;
DROP POLICY IF EXISTS "Allow admin update" ON public.message_board;
DROP POLICY IF EXISTS "Allow admin delete" ON public.message_board;

-- Create simple policies
-- Allow anyone to read
CREATE POLICY "Allow public read" ON public.message_board
  FOR SELECT USING (true);

-- Allow anyone authenticated to write (service role will bypass RLS anyway)
CREATE POLICY "Allow authenticated write" ON public.message_board
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow anyone authenticated to update
CREATE POLICY "Allow authenticated update" ON public.message_board
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Allow anyone authenticated to delete
CREATE POLICY "Allow authenticated delete" ON public.message_board
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Insert default message
INSERT INTO public.message_board (id, title, content)
VALUES ('main', 'Welcome', 'Welcome to the Time Calculator App!')
ON CONFLICT (id) DO NOTHING;
