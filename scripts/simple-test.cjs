const fs = require('fs');
const path = require('path');

console.log('🔍 Checking environment setup...');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
console.log('Looking for .env file at:', envPath);

if (fs.existsSync(envPath)) {
  console.log('✅ .env file found');
  
  // Read and parse .env file manually
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  
  let supabaseUrl = '';
  let supabaseAnonKey = '';
  let supabaseServiceKey = '';
  
  envLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('SUPABASE_URL=')) {
      supabaseUrl = trimmed.split('=')[1];
    } else if (trimmed.startsWith('SUPABASE_ANON_KEY=')) {
      supabaseAnonKey = trimmed.split('=')[1];
    } else if (trimmed.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      supabaseServiceKey = trimmed.split('=')[1];
    }
  });
  
  console.log('\n📋 Environment Variables Found:');
  console.log('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set (length: ' + supabaseAnonKey.length + ')' : 'Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set (length: ' + supabaseServiceKey.length + ')' : 'Missing');
  
  // Try to require supabase
  try {
    const { createClient } = require('@supabase/supabase-js');
    console.log('✅ Supabase library loaded successfully');
    
    if (supabaseUrl && supabaseAnonKey) {
      console.log('\n🧪 Testing basic connection...');
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      console.log('✅ Supabase client created successfully');
      
      // Test a simple operation
      supabase.from('test').select('*').limit(1).then(({ data, error }) => {
        if (error) {
          if (error.code === 'PGRST116') {
            console.log('✅ Connection successful (table not found is expected)');
          } else {
            console.log('⚠️  Connection issue:', error.message);
          }
        } else {
          console.log('✅ Connection and query successful');
        }
      }).catch(err => {
        console.log('❌ Connection error:', err.message);
      });
    }
    
  } catch (err) {
    console.log('❌ Failed to load Supabase library:', err.message);
  }
  
} else {
  console.log('❌ .env file not found');
}
