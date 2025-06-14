-- Create the admins table
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(), -- auto-generate UUID
  email text not null unique,
  password text not null, -- assuming you're storing hashed passwords
  created_at timestamptz default now()
);

-- RLS and security policies removed for open access
