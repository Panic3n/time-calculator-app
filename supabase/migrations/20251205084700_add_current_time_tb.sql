-- Add current_time_tb column to it_budgets table for real-time TB tracking
ALTER TABLE it_budgets
ADD COLUMN IF NOT EXISTS current_time_tb NUMERIC DEFAULT 0;
