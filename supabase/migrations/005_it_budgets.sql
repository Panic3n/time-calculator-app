-- IT Budgets table to store teckningsbidrag per fiscal year
BEGIN;

CREATE TABLE IF NOT EXISTS public.it_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id UUID NOT NULL REFERENCES public.fiscal_years(id) ON DELETE CASCADE,
  department TEXT NOT NULL DEFAULT 'IT',
  teckningsbidrag NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(fiscal_year_id, department)
);

-- trigger to keep updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'it_budgets_updated_at'
  ) THEN
    CREATE TRIGGER it_budgets_updated_at BEFORE UPDATE ON public.it_budgets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE public.it_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS it_budgets_all_authenticated ON public.it_budgets;
CREATE POLICY it_budgets_all_authenticated ON public.it_budgets FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
