import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '5s',
};

export default function () {
  const res = http.get('https://cloudless.gr');
  console.log('URL:', res.url);
  console.log('Status:', res.status);
  console.log('Headers:', JSON.stringify(res.headers));
  console.log('Content-Type:', res.headers['content-type'] || 'NULL');
  check(res, {
    'status was 200': (r) => r.status == 200,
    'content type is HTML': (r) => {
      const ct = r.headers['content-type'] || '';
      console.log('Checking CT:', ct);
      return ct.includes('text/html');
    },
  });
}
