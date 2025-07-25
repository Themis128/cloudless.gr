-- Seed Data: Admin user and initial roles for cloudless.gr

-- Insert initial roles (if using a roles table, otherwise skip)
-- CREATE TABLE IF NOT EXISTS public.roles (
--   id serial PRIMARY KEY,
--   name text UNIQUE NOT NULL
-- );
-- INSERT INTO public.roles (name) VALUES ('admin'), ('user') ON CONFLICT DO NOTHING;

-- Insert admin profile (replace values as needed)
INSERT INTO public.profiles (
  id, email, first_name, last_name, full_name, username, avatar_url, website, bio, role, is_active, email_verified, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@cloudless.gr',
  'Admin',
  'User',
  'Admin User',
  'admin',
  NULL,
  NULL,
  'Initial admin user',
  'admin',
  true,
  true,
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- Optionally, insert a user_profile for admin
INSERT INTO public.user_profiles (
  id, username, full_name, avatar_url, bio, role, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  'Admin User',
  NULL,
  'Initial admin user',
  'admin',
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;
