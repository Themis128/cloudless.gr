import 'dotenv/config';
import sql from './server/db.js';

(async () => {
  const result = await sql`SELECT current_database()`;
  console.log('Current database:', result[0].current_database);
  process.exit(0);
})();
