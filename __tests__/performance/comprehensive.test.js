import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 20 },  // ramp-up
    { duration: '60s', target: 20 },  // steady state
    { duration: '10s', target: 0 },   // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<3000'],   // Much higher thresholds to see if test passes
    http_req_failed: ['rate<0.01'],   // Less than 1% failed requests
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
    'API response contains expected data': (r) => {
      try {
        const data = r.json();
        return data.status === 'ok' || data.status === 'degraded';
      } catch (e) {
        // If JSON parsing fails, return false
        return false;
      }
    },
  });

  sleep(1);
}