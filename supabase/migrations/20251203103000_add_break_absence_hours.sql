-- Add break_hours and absence_hours columns to month_entries
-- These track break time and holiday/vacation hours per month

ALTER TABLE public.month_entries 
ADD COLUMN IF NOT EXISTS break_hours NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.month_entries 
ADD COLUMN IF NOT EXISTS absence_hours NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN public.month_entries.break_hours IS 'Total break hours logged this month (lunch, coffee breaks, etc.)';
COMMENT ON COLUMN public.month_entries.absence_hours IS 'Total absence hours this month (holiday, vacation, sick leave)';
