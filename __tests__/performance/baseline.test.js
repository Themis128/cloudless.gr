import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },  // ramp-up
    { duration: '30s', target: 10 },  // steady state
    { duration: '10s', target: 0 },   // ramp-down
  ],
thresholds: {
  http_req_duration: ['p(95)<500'],  // 95% of requests should be below 500ms
  'http_req_status_is_2xx': ['rate>=0.99'],  // at least 99% of responses should be 2xx
},
};

export default function () {
  // Test home page
  const res = http.get('https://cloudless.gr');
  check(res, {
    'status was 200': (r) => r.status == 200,
  });

  // Test API endpoint
  const apiRes = http.get('https://cloudless.gr/api/health');
  check(apiRes, {
    'API status was 200': (r) => r.status == 200,
    'API response contains expected data': (r) => r.json().status === 'ok',
  });

  sleep(1);
}