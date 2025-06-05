import { execSync } from 'node:child_process';

console.log('Running all Vitest tests...');
try {
  execSync('npx vitest run', { stdio: 'inherit' });
  process.exit(0);
} catch (err) {
  console.error('Test suite failed:', err);
  process.exit(1);
}
