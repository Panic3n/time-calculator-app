create table if not exists badges (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text not null,
  image_url text not null,
  category text not null,
  subcategory text,
  created_at timestamptz default now()
);

create table if not exists employee_badges (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references employees(id) on delete cascade,
  badge_id uuid not null references badges(id) on delete cascade,
  assigned_at timestamptz default now(),
  unique(employee_id, badge_id)
);

-- Add RLS policies
alter table badges enable row level security;
alter table employee_badges enable row level security;

-- Policies for badges
create policy "Badges are viewable by everyone" on badges for select using (true);
create policy "Badges are insertable by admins" on badges for insert with check (
  exists (select 1 from app_profiles where user_id = auth.uid() and is_admin = true)
);
create policy "Badges are updateable by admins" on badges for update using (
  exists (select 1 from app_profiles where user_id = auth.uid() and is_admin = true)
);
create policy "Badges are deletable by admins" on badges for delete using (
  exists (select 1 from app_profiles where user_id = auth.uid() and is_admin = true)
);

-- Policies for employee_badges
create policy "Employee badges are viewable by everyone" on employee_badges for select using (true);
create policy "Employee badges are insertable by admins" on employee_badges for insert with check (
  exists (select 1 from app_profiles where user_id = auth.uid() and is_admin = true)
);
create policy "Employee badges are deletable by admins" on employee_badges for delete using (
  exists (select 1 from app_profiles where user_id = auth.uid() and is_admin = true)
);
