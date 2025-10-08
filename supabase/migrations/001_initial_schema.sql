-- Initial schema for Time Calculator App
-- Entities: employees, fiscal_years, month_entries

-- Enable UUID extension if needed (on hosted Supabase it's available)
-- Use pgcrypto's gen_random_uuid() for UUIDs (works on Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Employees
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fiscal Years (Sept 1 to Aug 31)
CREATE TABLE IF NOT EXISTS public.fiscal_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE, -- e.g. 2024/2025
  start_date DATE NOT NULL,   -- Sept 1 YYYY
  end_date DATE NOT NULL,     -- Aug 31 YYYY+1
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Month Entries per employee per fiscal year and month index (0..11; 0=Sept, 11=Aug)
CREATE TABLE IF NOT EXISTS public.month_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  fiscal_year_id UUID NOT NULL REFERENCES public.fiscal_years(id) ON DELETE CASCADE,
  month_index INT NOT NULL CHECK (month_index BETWEEN 0 AND 11),
  worked NUMERIC(10,2) NOT NULL DEFAULT 0,
  logged NUMERIC(10,2) NOT NULL DEFAULT 0,
  billed NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, fiscal_year_id, month_index)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_month_entries_emp_year ON public.month_entries(employee_id, fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_employees_name ON public.employees((lower(name)));

-- Triggers to maintain updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'employees_updated_at'
  ) THEN
    CREATE TRIGGER employees_updated_at BEFORE UPDATE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'fiscal_years_updated_at'
  ) THEN
    CREATE TRIGGER fiscal_years_updated_at BEFORE UPDATE ON public.fiscal_years
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'month_entries_updated_at'
  ) THEN
    CREATE TRIGGER month_entries_updated_at BEFORE UPDATE ON public.month_entries
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- Enable Row Level Security and permissive MVP policies (can be tightened later)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.month_entries ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to fully manage data (MVP)
DROP POLICY IF EXISTS employees_all_authenticated ON public.employees;
CREATE POLICY employees_all_authenticated ON public.employees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS fiscal_years_all_authenticated ON public.fiscal_years;
CREATE POLICY fiscal_years_all_authenticated ON public.fiscal_years
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS month_entries_all_authenticated ON public.month_entries;
CREATE POLICY month_entries_all_authenticated ON public.month_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default fiscal year if not present (e.g., 2024/2025)
DO $$
DECLARE fy_label TEXT := to_char((now() AT TIME ZONE 'UTC') - INTERVAL '8 months', 'YYYY') || '/' || to_char((now() AT TIME ZONE 'UTC') + INTERVAL '4 months', 'YYYY');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.fiscal_years WHERE label = fy_label) THEN
    INSERT INTO public.fiscal_years(label, start_date, end_date)
    VALUES (
      fy_label,
      make_date(date_part('year', (now() AT TIME ZONE 'UTC') - INTERVAL '8 months')::int, 9, 1),
      make_date(date_part('year', (now() AT TIME ZONE 'UTC') + INTERVAL '4 months')::int, 8, 31)
    );
  END IF;
END $$;
