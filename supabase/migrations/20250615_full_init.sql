-- Full initial migration for your app

-- 1. PROFILES TABLE (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  created_at timestamptz default now()
);

-- 2. USER-INFO TABLE (combined name and avatar)
create table if not exists public."user-info" (
  id uuid primary key references public.profiles(id) on delete cascade,
  full_name text not null,
  avatar_url text default 'https://example.com/default-avatar.png', -- Default avatar URL
  created_at timestamptz default now()
);

-- 3. PROJECTS TABLE
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- 4. CONTACT MESSAGES TABLE
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  message text not null,
  created_at timestamptz default now()
);

-- 5. Populate user-info with existing users
insert into public."user-info" (id, full_name, avatar_url)
select id, 
       coalesce(first_name, '') || ' ' || coalesce(last_name, ''), 
       'https://example.com/default-avatar.png' -- Default avatar URL for existing users
from public.profiles;

-- 6. Trigger to keep user-info.full_name in sync with profiles
create or replace function update_user_info_full_name() returns trigger as $$
begin
  update public."user-info"
  set full_name = coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '')
  where id = new.id;
  return new;
end;
$$ language plpgsql;

create trigger trg_update_user_info_full_name
  after update of first_name, last_name on public.profiles
  for each row
  execute procedure update_user_info_full_name();

-- 7. RLS: Enable and allow users to access only their own rows
alter table public.profiles enable row level security;
create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

alter table public."user-info" enable row level security;
create policy "Users can view their own user-info" on public."user-info"
  for select using (auth.uid() = id);
create policy "Users can update their own user-info" on public."user-info"
  for update using (auth.uid() = id);

alter table public.projects enable row level security;
create policy "Users can view all projects" on public.projects
  for select using (true);

alter table public.contact_messages enable row level security;
create policy "Users can view their own messages" on public.contact_messages
  for select using (auth.uid() = user_id);
create policy "Users can insert their own messages" on public.contact_messages
  for insert with check (auth.uid() = user_id);

-- 8. Grant access to anon and authenticated roles
grant select, update on public.profiles to anon, authenticated;
grant select, update on public."user-info" to anon, authenticated;
grant select on public.projects to anon, authenticated;
grant select, insert on public.contact_messages to anon, authenticated;
