# Instructions for Adding Admin User

## Step 1: Create .env file
You need to create a `.env` file in the root directory with your Supabase credentials:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Step 2: Get your Supabase credentials
1. Go to your Supabase dashboard (https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy the following:
   - Project URL → SUPABASE_URL
   - Project API keys → anon public → SUPABASE_ANON_KEY
   - Project API keys → service_role (secret) → SUPABASE_SERVICE_ROLE_KEY

## Step 3: Run the admin setup
Once you have the .env file set up, run:

```bash
node scripts/add-admin.js
```

## Alternative: Manual Database Setup
If you have direct database access, you can also run this SQL:

```sql
-- First, create the user in Supabase Auth dashboard, then run:
INSERT INTO profiles (id, email, first_name, last_name, full_name, role, created_at, updated_at)
VALUES (
  'user_id_from_auth', 
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
```

## User Details
- Email: baltzakis.themis@gmail.com
- Password: TH!123789th!
- First Name: Themistoklis
- Last Name: Baltzakis
- Role: admin
