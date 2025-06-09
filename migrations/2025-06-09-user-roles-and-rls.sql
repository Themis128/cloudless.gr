-- 1. Create user_profiles table with role and metadata
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text check (role in ('admin', 'user')) not null default 'user',
  created_at timestamp with time zone default now()
);

-- 2. Enable Row Level Security (RLS)
alter table public.user_profiles enable row level security;

-- 3. Policy: allow users to access their own profile
create policy "Users can access their own profile"
  on public.user_profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.user_profiles
  for update using (auth.uid() = id);

-- 4. Policy: allow only admins to see all profiles
create policy "Admins can access any profile"
  on public.user_profiles
  for select using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  );

-- 5. Optional: Trigger to auto-create user_profiles on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 6. Example: Seed an admin user (replace <user-id> and name)
-- insert into public.user_profiles (id, full_name, role) values ('<user-id>', 'Alice Doe', 'admin');
