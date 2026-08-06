const { getAuthDbFromEnv } = require('./src/lib/auth-d1');
const db = getAuthDbFromEnv();
console.log('DB object:', db ? 'exists' : 'null');
if (db) {
  db.prepare('SELECT 1 as ok').all().then(result => {
    console.log('Query result:', result);
    console.log('DB connected:', !!result && result.results.length > 0 && result.results[0].ok === 1);
  }).catch(err => {
    console.error('Query error:', err.message);
  });
} else {
  console.log('No DB available');
}
