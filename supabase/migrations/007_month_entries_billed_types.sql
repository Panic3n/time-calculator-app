-- Store billed hours per charge type per employee, FY and month
BEGIN;

CREATE TABLE IF NOT EXISTS public.month_entries_billed_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  fiscal_year_id UUID NOT NULL REFERENCES public.fiscal_years(id) ON DELETE CASCADE,
  month_index INT NOT NULL CHECK (month_index BETWEEN 0 AND 11),
  charge_type_name TEXT NOT NULL,
  hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, fiscal_year_id, month_index, charge_type_name)
);

-- trigger to keep updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'month_entries_billed_types_updated_at'
  ) THEN
    CREATE TRIGGER month_entries_billed_types_updated_at BEFORE UPDATE ON public.month_entries_billed_types
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- RLS and permissive policies for authenticated users
ALTER TABLE public.month_entries_billed_types ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='month_entries_billed_types' AND policyname='mebt_select'
  ) THEN
    CREATE POLICY mebt_select ON public.month_entries_billed_types FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='month_entries_billed_types' AND policyname='mebt_insert'
  ) THEN
    CREATE POLICY mebt_insert ON public.month_entries_billed_types FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='month_entries_billed_types' AND policyname='mebt_update'
  ) THEN
    CREATE POLICY mebt_update ON public.month_entries_billed_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='month_entries_billed_types' AND policyname='mebt_delete'
  ) THEN
    CREATE POLICY mebt_delete ON public.month_entries_billed_types FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

COMMIT;
