import fetch from 'node-fetch';

const urls = [
  'https://cloudless.gr',
  'https://appflowy.cloudless.gr/api/health',
  'https://espocrm.cloudless.gr',
  'https://agent.cloudless.gr/ok',
  'https://vibe.cloudless.gr',
  'https://n8n.cloudless.gr'
];

async function checkHealth() {
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.status === 200) {
        if (url === 'https://agent.cloudless.gr/ok') {
          const data = await response.json();
          if (data.ok !== true) {
            console.log(`FAIL: ${url} - Expected JSON {ok: true}, got ${JSON.stringify(data)}`);
            process.exit(1);
          } else {
            console.log(`PASS: ${url}`);
          }
        } else {
          console.log(`PASS: ${url}`);
        }
      } else {
        console.log(`FAIL: ${url} - Expected 200, got ${response.status}`);
        process.exit(1);
      }
    } catch (error) {
      console.log(`FAIL: ${url} - Error: ${error.message}`);
      process.exit(1);
    }
  }
}

checkHealth();