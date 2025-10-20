-- Create config tables for excluding non-working time from Logged
-- Tables: halo_excluded_break_types, halo_excluded_holiday_types, halo_excluded_logged_types (fallback)

BEGIN;

CREATE TABLE IF NOT EXISTS public.halo_excluded_break_types (
  name text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.halo_excluded_holiday_types (
  name text PRIMARY KEY
);

-- Fallback generic exclusion list (by charge_type_name)
CREATE TABLE IF NOT EXISTS public.halo_excluded_logged_types (
  name text PRIMARY KEY
);

-- Enable RLS
ALTER TABLE public.halo_excluded_break_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halo_excluded_holiday_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halo_excluded_logged_types ENABLE ROW LEVEL SECURITY;

-- Permissive MVP policies (tighten later)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'halo_excluded_break_types'
  ) THEN
    CREATE POLICY halo_excluded_break_types_all ON public.halo_excluded_break_types
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'halo_excluded_holiday_types'
  ) THEN
    CREATE POLICY halo_excluded_holiday_types_all ON public.halo_excluded_holiday_types
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'halo_excluded_logged_types'
  ) THEN
    CREATE POLICY halo_excluded_logged_types_all ON public.halo_excluded_logged_types
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed defaults (case-insensitive matching is done in app)
INSERT INTO public.halo_excluded_break_types(name) VALUES
  ('Taking a breather'),
  ('Lunch break'),
  ('Non-working hours')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.halo_excluded_holiday_types(name) VALUES
  ('Vacation'),
  ('Dentist appointment'),
  ('Doctors appointment'),
  ('VAB'),
  ('Permission'),
  ('Parental leave'),
  ('Leave of absence'),
  ('Withdraw time (Stored Compensation)')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.halo_excluded_logged_types(name) VALUES
  ('Holiday'),
  ('Vacation'),
  ('Break')
ON CONFLICT (name) DO NOTHING;

COMMIT;
