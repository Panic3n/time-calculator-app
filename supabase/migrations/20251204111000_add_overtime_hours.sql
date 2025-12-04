-- Add overtime_hours column to month_entries table
-- Overtime = logged hours exceeding the daily work hours (8h or special day hours)
ALTER TABLE public.month_entries 
ADD COLUMN IF NOT EXISTS overtime_hours numeric(10,2) DEFAULT 0;

-- Add comment
COMMENT ON COLUMN public.month_entries.overtime_hours IS 'Hours logged beyond the standard work day (8h or special day hours)';
