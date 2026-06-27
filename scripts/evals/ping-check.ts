const https = require('https');

https.get('https://cloudless.gr', (res) => {
  console.log(`OK ${res.statusCode}`);
}).on('error', (err) => {
  console.log(`FAIL ${err.message}`);
});