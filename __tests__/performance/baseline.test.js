import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },  // ramp-up
    { duration: '30s', target: 10 },  // steady state
    { duration: '10s', target: 0 },   // ramp-down
  ],
thresholds: {
  http_req_duration: ['p(95)<800'],   // Increased threshold to 800ms to accommodate variability
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
        return data.status === 'ok';
      } catch (e) {
        // If JSON parsing fails, return false
        return false;
      }
    },
  });

  sleep(1);
}