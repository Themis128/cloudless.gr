import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Required to resolve relative paths when using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Log all loaded env variables
console.log('🔐 Contents of .env file:\n');
for (const key of Object.keys(process.env)) {
  if (
    key.startsWith('SUPABASE') || // filter for relevant keys
    key.includes('DATABASE') ||
    key.includes('API') ||
    key.includes('SECRET')
  ) {
    console.log(`${key} = ${process.env[key]}`);
  }
}
