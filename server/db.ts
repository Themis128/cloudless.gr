import postgres from 'postgres'

// Get connection string from environment with fallback
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'

// Validate connection string
if (!connectionString) {
  throw new Error('Database connection string not found. Please set DATABASE_URL or SUPABASE_DB_URL environment variable.')
}

// Create postgres connection with proper error handling
const sql = postgres(connectionString, {
  // Connection pool settings
  max: 20,
  idle_timeout: 30,
  connect_timeout: 60,

  // Error handling
  onnotice: (notice) => {
    console.log('PostgreSQL notice:', notice)
  },

  // Transform settings
  transform: {
    undefined: null
  }
})

// Test connection on startup
sql`SELECT 1 as test`.then(() => {
  console.log('✅ Database connection established')
}).catch((err) => {
  console.error('❌ Database connection failed:', err.message)
})

export default sql
