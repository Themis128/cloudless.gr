-- 1. Create user_profiles table linked to auth.users
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text check (role in ('admin', 'user')) not null default 'user',
  created_at timestamp with time zone default now()
);

-- 2. Enable Row-Level Security (RLS)
alter table public.user_profiles enable row level security;

-- Drop policies if they exist to make migration idempotent
DROP POLICY IF EXISTS "Users can select their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can select any profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.user_profiles;

-- 3. RLS Policy: Users can access and update their own profile
create policy "Users can select their own profile"
on public.user_profiles
for select
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.user_profiles
for update
using (auth.uid() = id);

-- 4. RLS Policy: Admins can read all profiles
create policy "Admins can select any profile"
on public.user_profiles
for select
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role = 'admin'
  )
);

-- 5. RLS Policy: Admins can update any profile
create policy "Admins can update any profile"
on public.user_profiles
for update
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role = 'admin'
  )
);

-- 6. Trigger Function: Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- 7. Create trigger on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

-- 8. Seed: Create a simple user and an admin user with unique, consistent UUIDs
-- Ensure pgcrypto is enabled for gen_random_uuid()
create extension if not exists pgcrypto;

-- Insert a simple user into auth.users and user_profiles with a unique UUID
with simple_user_uuid as (
  select gen_random_uuid() as uuid
), new_user as (
  insert into auth.users (id, email, encrypted_password, instance_id, aud, role)
  select uuid, 'simple@example.com', crypt('password123', gen_salt('bf')),
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
  from simple_user_uuid
  on conflict (email) do nothing
  returning id
)
insert into public.user_profiles (id, full_name, role)
select id, 'Simple User', 'user' from new_user
on conflict do nothing;

-- Insert an admin user into auth.users and user_profiles with a unique UUID
with admin_user_uuid as (
  select gen_random_uuid() as uuid
), new_admin as (
  insert into auth.users (id, email, encrypted_password, instance_id, aud, role)
  select uuid, 'admin@example.com', crypt('adminpassword', gen_salt('bf')),
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
  from admin_user_uuid
  on conflict (email) do nothing
  returning id
)
insert into public.user_profiles (id, full_name, role)
select id, 'Admin User', 'admin' from new_admin
on conflict do nothing;
