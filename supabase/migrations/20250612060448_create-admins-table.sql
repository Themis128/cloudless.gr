-- Create the admins table
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(), -- auto-generate UUID
  email text not null unique,
  password text not null, -- assuming you're storing hashed passwords
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.admins enable row level security;

-- Allow logged-in users to read their own record
create policy "Admins can read their own record"
on public.admins
for select
to authenticated
using (
  auth.uid() = id
);
