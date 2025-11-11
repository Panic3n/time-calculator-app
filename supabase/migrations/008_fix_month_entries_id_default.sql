-- Ensure UUID default on month_entries.id
BEGIN;

-- Enable pgcrypto for gen_random_uuid() if not present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set default UUID generation on id
ALTER TABLE public.month_entries
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

COMMIT;
