#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables!')
  console.error('Please make sure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in your .env file')
  process.exit(1)
}

// Create Supabase client with service key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  try {
    console.log('🚀 Setting up Supabase database...')

    // Since direct SQL execution via API is restricted, let's test what we can do
    console.log('📝 Testing database connection and checking table existence...')

    // Try to check if the table exists by attempting a simple query
    const { data: existingData, error: existingError } = await supabase
      .from('instruments')
      .select('count', { count: 'exact', head: true })

    if (existingError) {
      if (existingError.code === '42P01') {
        console.log('❌ Table "instruments" does not exist.')
        console.log('📋 You need to manually create the table in Supabase dashboard.')
      } else {
        console.log('❌ Database connection issue:', existingError.message)
      }
    } else {
      console.log('✅ Table "instruments" exists!')
      console.log(`📊 Table has ${existingData?.[0]?.count || 'unknown number of'} records`)

      // Try to add sample data if table is empty
      if (existingData?.[0]?.count === 0) {
        console.log('📝 Adding sample instruments...')
        const { error: insertError } = await supabase
          .from('instruments')
          .insert([
            { name: 'violin' },
            { name: 'viola' },
            { name: 'cello' },
            { name: 'piano' },
            { name: 'guitar' },
            { name: 'flute' }
          ])

        if (insertError) {
          console.log('⚠️  Could not insert sample data:', insertError.message)
        } else {
          console.log('✅ Sample instruments added successfully!')
        }
      }
    }    // Test the setup by checking if we can read from the instruments table
    console.log('🔍 Final test - reading from instruments table...')
    const { data, error } = await supabase
      .from('instruments')
      .select('*')
      .limit(5)

    if (error) {
      console.error('❌ Database test failed:', error.message)
      console.log('\n📋 Manual Setup Instructions:')
      console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard')
      console.log('2. Navigate to your project:', supabaseUrl)
      console.log('3. Go to the SQL Editor')
      console.log('4. Copy and paste the contents of supabase-instruments-setup.sql')
      console.log('5. Click "Run" to execute the SQL')
      console.log('\n🔗 Quick access: https://supabase.com/dashboard/project/' + supabaseUrl.split('.')[0].split('//')[1])
    } else {
      console.log('✅ Database setup successful!')
      console.log(`📊 Found ${data?.length || 0} instruments in the table`)
      if (data && data.length > 0) {
        console.log('   Sample instruments:', data.map(d => d.name).join(', '))
      }
      console.log('\n🌐 You can now test the demo at: http://localhost:3000/supabase-demo')
    }
  } catch (error) {
    console.error('❌ Setup failed:', error.message)
    console.log('\n📋 Manual Setup Instructions:')
    console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard')
    console.log('2. Navigate to your project:', supabaseUrl)
    console.log('3. Go to the SQL Editor')
    console.log('4. Copy and paste the contents of supabase-instruments-setup.sql')
    console.log('5. Click "Run" to execute the SQL')
    console.log('\n🔗 Quick access: https://supabase.com/dashboard/project/' + supabaseUrl.split('.')[0].split('//')[1])
  }
}

// Run the setup
setupDatabase()
