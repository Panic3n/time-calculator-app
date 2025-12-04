-- Add lunch_minutes column to special_work_days table
ALTER TABLE special_work_days
ADD COLUMN IF NOT EXISTS lunch_minutes INTEGER DEFAULT 30;
