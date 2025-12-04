-- Table for special work days (red days, days before red days, etc.)
-- These days have custom work hours instead of the default 8 hours
-- lunch_minutes: Duration of lunch break in minutes (default 60, special days often 30)
CREATE TABLE IF NOT EXISTS public.special_work_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  work_hours numeric(4,2) NOT NULL DEFAULT 0,
  lunch_minutes integer NOT NULL DEFAULT 30,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.special_work_days ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated read" ON public.special_work_days
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow service role all" ON public.special_work_days
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index for date lookups
CREATE INDEX IF NOT EXISTS idx_special_work_days_date ON public.special_work_days(date);

-- Add comment
COMMENT ON TABLE public.special_work_days IS 'Special work days with custom hours (red days, days before holidays, etc.). Days not in this table default to 8 hours.';
