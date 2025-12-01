# Setup Monthly Available Hours Table

The application requires a new table `monthly_available_hours` to store the manual work hours per month.

## SQL Command

Run the following SQL in your Supabase Project > SQL Editor:

```sql
create table if not exists monthly_available_hours (
  id uuid default gen_random_uuid() primary key,
  fiscal_year_id uuid references fiscal_years(id) on delete cascade not null,
  month_index integer not null, -- 0=Sep, 1=Oct, ... 11=Aug
  available_hours numeric not null default 0,
  created_at timestamptz default now(),
  unique(fiscal_year_id, month_index)
);

-- Enable Row Level Security
alter table monthly_available_hours enable row level security;

-- Policy to allow all operations (since this is an internal tool)
create policy "Allow all access" on monthly_available_hours
for all using (true) with check (true);
```

## Troubleshooting

If you see "Could not find the table 'public.monthly_available_hours' in the schema cache", it means this table has not been created yet.
