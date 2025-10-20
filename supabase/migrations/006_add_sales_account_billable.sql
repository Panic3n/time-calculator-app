-- Add 'Sales account' to billable charge types
BEGIN;

-- Ensure the table exists before attempting insert (no-op if it doesn't)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'halo_billable_charge_types'
  ) THEN
    INSERT INTO public.halo_billable_charge_types(name)
    VALUES ('Sales account')
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;

COMMIT;
