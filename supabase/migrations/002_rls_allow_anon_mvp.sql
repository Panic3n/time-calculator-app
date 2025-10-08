-- MVP RLS relaxation: allow anon (no-auth) to read/write these tables
-- NOTE: For production, tighten to authenticated users with proper auth flows.

-- Ensure RLS enabled (safe if already set)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.month_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing anon policies if present
DROP POLICY IF EXISTS employees_all_anon ON public.employees;
DROP POLICY IF EXISTS fiscal_years_all_anon ON public.fiscal_years;
DROP POLICY IF EXISTS month_entries_all_anon ON public.month_entries;

-- Allow anon to do ALL operations during MVP
CREATE POLICY employees_all_anon ON public.employees
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY fiscal_years_all_anon ON public.fiscal_years
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY month_entries_all_anon ON public.month_entries
  FOR ALL TO anon USING (true) WITH CHECK (true);
