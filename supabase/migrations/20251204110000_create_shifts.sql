-- Table for shift definitions (work schedules)
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  start_time time NOT NULL,
  end_time time NOT NULL,
  work_hours numeric(4,2) NOT NULL DEFAULT 8,
  lunch_minutes integer NOT NULL DEFAULT 60,
  created_at timestamptz DEFAULT now()
);

-- Table for assigning shifts to employees
CREATE TABLE IF NOT EXISTS public.employee_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id)
);

-- Enable RLS
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;

-- Policies for shifts
CREATE POLICY "Allow authenticated read shifts" ON public.shifts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow service role all shifts" ON public.shifts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Policies for employee_shifts
CREATE POLICY "Allow authenticated read employee_shifts" ON public.employee_shifts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow service role all employee_shifts" ON public.employee_shifts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Insert default shifts
INSERT INTO public.shifts (name, start_time, end_time, work_hours, lunch_minutes) VALUES
  ('Early (07:00-16:00)', '07:00', '16:00', 8, 60),
  ('Standard (07:30-16:30)', '07:30', '16:30', 8, 60),
  ('Late (08:00-17:00)', '08:00', '17:00', 8, 60)
ON CONFLICT (name) DO NOTHING;

-- Comments
COMMENT ON TABLE public.shifts IS 'Shift definitions with work hours and schedule';
COMMENT ON TABLE public.employee_shifts IS 'Assigns a shift to each employee';
