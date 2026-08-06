import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { randomInt } from 'k6/utils';

export const options = {
  stages: [
    { duration: '10s', target: 20 },  // ramp-up
    { duration: '60s', target: 20 },  // steady state
    { duration: '10s', target: 0 },   // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    'http_req_status_is_200': ['rate>=0.99'],
    'http_req_status_is_4xx': ['rate<0.01'],
    'http_req_status_is_5xx': ['rate==0'],
  },
  maxRedirects: 5,
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
  'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36',
];

export default function () {
  const userAgent = USER_AGENTS[randomInt(0, USER_AGENTS.length - 1)];
  const headers = { 'User-Agent': userAgent };

  group('Home Page', () => {
    const res = http.get('https://cloudless.gr', { headers });
    check(res, {
      'Home page status was 200': (r) => r.status == 200,
      'Home page content type is HTML': (r) => r.headers['content-type'].includes('text/html'),
    });
  });

  group('API Endpoints', () => {
    const apiRes = http.get('https://cloudless.gr/api/health', { headers });
    check(apiRes, {
      'API status was 200': (r) => r.status == 200,
      'API response is JSON': (r) => r.headers['content-type'].includes('application/json'),
      'API response contains expected data': (r) => r.json().status === 'ok',
    });

    const authRes = http.post('https://cloudless.gr/api/auth/login', {
      headers,
      json: {
        email: 'test@example.com',
        password: 'password123'
      }
    });
    check(authRes, {
      'Auth endpoint status was 400': (r) => r.status == 400,
    });
  });

  group('Static Assets', () => {
    const assetRes = http.get('https://cloudless.gr/static/main.js', { headers });
    check(assetRes, {
      'Static asset status was 200': (r) => r.status == 200,
      'Static asset content type is JS': (r) => r.headers['content-type'].includes('application/javascript'),
    });
  });

  sleep(randomInt(1, 3));
}