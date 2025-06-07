// Quick debug script to check environment variables
require('dotenv').config();

console.log('=== Environment Variable Debug ===');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY length:', process.env.SUPABASE_ANON_KEY?.length);
console.log('SUPABASE_ANON_KEY preview:', process.env.SUPABASE_ANON_KEY?.substring(0, 50) + '...');
console.log('SUPABASE_SERVICE_ROLE_KEY length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length);

// Test if the keys look like JWT tokens
const anonKey = process.env.SUPABASE_ANON_KEY;
if (anonKey) {
  const parts = anonKey.split('.');
  console.log('ANON_KEY parts (should be 3 for JWT):', parts.length);
  
  if (parts.length === 3) {
    try {
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      console.log('JWT Header:', header);
      console.log('JWT Payload role:', payload.role);
      console.log('JWT Payload iss:', payload.iss);
    } catch (e) {
      console.log('JWT parsing failed:', e.message);
    }
  }
}
