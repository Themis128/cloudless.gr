const { Database } = require('node:sqlite3');
const path = require('node:path');

const dbPath = '/home/tbaltzakis/cloudless.gr/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/1b0e5fded56675590df898e1fc219a3c08bc3c32ed637e1dca6581b4cb908239.sqlite';

console.log('Checking database at:', dbPath);

const db = new Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    return;
  }
  console.log('Connected to database successfully');
  
  // Check what tables exist
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
      console.error('Error querying tables:', err.message);
      db.close();
      return;
    }
    
    console.log('Tables in database:');
    tables.forEach(table => {
      console.log(`  - ${table.name}`);
    });
    
    // Check if user table exists and has data
    db.all("SELECT COUNT(*) as count FROM user", [], (err, result) => {
      if (err) {
        console.error('Error querying user table:', err.message);
      } else {
        console.log('User count:', result[0].count);
        
        // If there are users, show some info
        if (result[0].count > 0) {
          db.all("SELECT id, email, name, created_at FROM user LIMIT 5", [], (err, users) => {
            if (err) {
              console.error('Error querying users:', err.message);
            } else {
              console.log('Sample users:');
              users.forEach(user => {
                console.log(`  - ${user.email} (${user.name || 'no name'}) created: ${new Date(user.created_at * 1000).toISOString()}`);
              });
            }
            db.close();
          });
        } else {
          console.log('No users found in database');
          db.close();
        }
      }
    });
    
    // Check session table
    db.all("SELECT COUNT(*) as count FROM session", [], (err, result) => {
      if (!err) {
        console.log('Session count:', result[0].count);
      }
    });
    
    // Check user_role table
    db.all("SELECT COUNT(*) as count FROM user_role", [], (err, result) => {
      if (!err) {
        console.log('User role count:', result[0].count);
      }
    });
  });
});
