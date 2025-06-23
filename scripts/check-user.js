
import dotenv from 'dotenv';
import path from 'path';
import postgres from 'postgres';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('❌ SUPABASE_DB_URL not set in .env.local');
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: 'require' });

async function checkUserStatus(email) {
  try {
    const [authUser] = await sql`
      SELECT email, banned_until
      FROM auth.users
      WHERE email = ${email}
    `;

    const [profile] = await sql`
      SELECT email, is_active
      FROM public.profiles
      WHERE email = ${email}
    `;

    console.log(`\n🔍 Status check for: ${email}`);

    if (!authUser) {
      console.log('❌ No user found in auth.users.');
    } else if (authUser.banned_until) {
      console.log(`🔒 User is banned until: ${authUser.banned_until}`);
    } else {
      console.log('✅ User is not banned.');
    }

    if (!profile) {
      console.log('⚠️ No profile found in public.profiles.');
    } else if (profile.is_active === false) {
      console.log('🔕 Profile is inactive (`is_active = false`).');
    } else {
      console.log('✅ Profile is active.');
    }

  } catch (err) {
    console.error('❌ Query error:', err);
  } finally {
    await sql.end();
  }
}

// Run the check
checkUserStatus('baltzakis.themis@gmail.com');
