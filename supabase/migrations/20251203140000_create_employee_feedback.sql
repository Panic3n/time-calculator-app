-- Create employee_feedback table to store feedback scores synced from HaloPSA
-- Stores all-time average feedback score per employee

CREATE TABLE IF NOT EXISTS public.employee_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  average_score numeric(4,2) NOT NULL DEFAULT 0,
  feedback_count integer NOT NULL DEFAULT 0,
  last_synced_at timestamptz DEFAULT now(),
  UNIQUE(employee_id)
);

-- Enable RLS
ALTER TABLE public.employee_feedback ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON public.employee_feedback
  FOR SELECT TO authenticated USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role all" ON public.employee_feedback
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_employee_feedback_employee_id ON public.employee_feedback(employee_id);
