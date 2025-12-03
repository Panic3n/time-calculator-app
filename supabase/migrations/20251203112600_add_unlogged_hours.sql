-- Add unlogged_hours column to month_entries
-- This tracks hours worked but not logged to tickets

ALTER TABLE public.month_entries 
ADD COLUMN IF NOT EXISTS unlogged_hours NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.month_entries.unlogged_hours IS 'Total unlogged hours this month (worked time not logged to tickets)';

-- Add personal_unlogged_pct_goal to team_goals
-- Default 10% - agents should log at least 90% of their worked time
ALTER TABLE public.team_goals 
ADD COLUMN IF NOT EXISTS personal_unlogged_pct_goal NUMERIC(5,2) DEFAULT 10;

COMMENT ON COLUMN public.team_goals.personal_unlogged_pct_goal IS 'Maximum acceptable unlogged percentage (default 10%)';
