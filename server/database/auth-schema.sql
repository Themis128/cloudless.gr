-- Create auth schema
create schema if not exists auth;

-- Enable RLS
alter table auth.users enable row level security;

-- Users table
create table if not exists auth.users (
    id uuid primary key default uuid_generate_v4(),
    email text unique not null,
    password_hash text not null,
    full_name text,
    role text not null default 'user',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Add RLS policies
create policy "Users can view their own data" on auth.users
    for select using (auth.uid() = id);

-- Admin users table (separate for security)
create table if not exists auth.admin_users (
    id uuid primary key default uuid_generate_v4(),
    email text unique not null,
    password_hash text not null,
    full_name text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    last_login timestamptz
);

-- Sessions table
create table if not exists auth.sessions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    token text unique not null,
    expires_at timestamptz not null,
    created_at timestamptz default now()
);

-- Function to check password (using Supabase's built-in crypto extension)
create or replace function auth.check_password(
    input_password text,
    stored_hash text
) returns boolean as $$
begin
    return crypt(input_password, stored_hash) = stored_hash;
end;
$$ language plpgsql security definer;

-- Function to create a new user
create or replace function auth.create_user(
    email text,
    password text,
    full_name text default null
) returns auth.users as $$
declare
    new_user auth.users;
begin
    insert into auth.users (email, password_hash, full_name)
    values (
        email,
        crypt(password, gen_salt('bf')),
        full_name
    )
    returning * into new_user;

    return new_user;
end;
$$ language plpgsql security definer;
