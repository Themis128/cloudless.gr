-- Essential Keys Retrieval Script
-- Run this in Supabase SQL Editor for quick key extraction

-- 1. GET JWT SECRET (Most Important)
SELECT 
    'JWT_SECRET: ' || jwt_secret as "Copy this to .env file"
FROM auth.config 
WHERE id = 1;

-- 2. GET YOUR USER ID (for admin setup)
SELECT 
    'USER_ID: ' || id as "Your User ID",
    'EMAIL: ' || email as "Your Email",
    'CREATED: ' || created_at as "Account Created"
FROM auth.users 
WHERE email = 'baltzakis.themis@gmail.com';

-- 3. CHECK IF YOU'RE ALREADY ADMIN
SELECT 
    CASE 
        WHEN role = 'admin' THEN 'You are already an admin!'
        WHEN role IS NULL THEN 'No profile found - need to create one'
        ELSE 'You have role: ' || role || ' - need to upgrade to admin'
    END as "Admin Status"
FROM public.profiles 
WHERE email = 'baltzakis.themis@gmail.com';

-- 4. GET SERVICE ROLE KEY (if stored in database)
SELECT 
    'SERVICE_ROLE_KEY: Check your Supabase dashboard' as "Service Role Key Location";

-- 5. GET ANON KEY (if stored in database)  
SELECT 
    'ANON_KEY: Check your Supabase dashboard' as "Anon Key Location";

-- 6. QUICK ADMIN SETUP (Run this if you need to make yourself admin)
-- Uncomment the lines below and replace USER_ID with your actual user ID

/*
INSERT INTO public.profiles (id, email, first_name, last_name, full_name, role, created_at, updated_at)
VALUES (
    'YOUR_USER_ID_HERE',  -- Replace with your user ID from query above
    'baltzakis.themis@gmail.com',
    'Themistoklis',
    'Baltzakis',
    'Themistoklis Baltzakis',
    'admin',
    NOW(),
    NOW()
)
ON CONFLICT (id) 
DO UPDATE SET 
    role = 'admin',
    first_name = 'Themistoklis',
    last_name = 'Baltzakis',
    full_name = 'Themistoklis Baltzakis',
    updated_at = NOW();
*/
