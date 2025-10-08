-- Add available working hours per fiscal year
ALTER TABLE public.fiscal_years
  ADD COLUMN IF NOT EXISTS available_hours NUMERIC(10,2) NOT NULL DEFAULT 0;
