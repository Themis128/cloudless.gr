import { getAuthDbFromEnv } from './src/lib/auth-d1.js';

async function test() {
  const db = getAuthDbFromEnv();
  if (!db) {
    console.log('No database found');
    return;
  }
  console.log('Database found');

  // Check if we can query the user table
  try {
    const result = await db.prepare('SELECT COUNT(*) as count FROM user').first();
    console.log('User count:', result.count);
  } catch (e) {
    console.error('Error querying user table:', e.message);
  }

  // Check if we can query the session table
  try {
    const result = await db.prepare('SELECT COUNT(*) as count FROM session').first();
    console.log('Session count:', result.count);
  } catch (e) {
    console.error('Error querying session table:', e.message);
  }

  // Check if we can query the user_role table
  try {
    const result = await db.prepare('SELECT COUNT(*) as count FROM user_role').first();
    console.log('User role count:', result.count);
  } catch (e) {
    console.error('Error querying user_role table:', e.message);
  }

  // Check if we can query the session_log table
  try {
    const result = await db.prepare('SELECT COUNT(*) as count FROM session_log').first();
    console.log('Session log count:', result.count);
  } catch (e) {
    console.error('Error querying session_log table:', e.message);
  }
}

test().catch(console.error);