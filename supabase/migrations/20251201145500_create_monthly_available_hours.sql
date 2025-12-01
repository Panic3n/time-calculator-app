create table if not exists monthly_available_hours (
  id uuid default gen_random_uuid() primary key,
  fiscal_year_id uuid references fiscal_years(id) on delete cascade not null,
  month_index integer not null, -- 0=Sep, 1=Oct, ... 11=Aug
  available_hours numeric not null default 0,
  created_at timestamptz default now(),
  unique(fiscal_year_id, month_index)
);

alter table monthly_available_hours enable row level security;

create policy "Allow all access" on monthly_available_hours
for all using (true) with check (true);
