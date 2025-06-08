// Test JWT validity
const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIyOTM4NDEsImV4cCI6MjA0Nzg2OTg0MX0.FdQRANj8qwlJq25LxCiuIjt_-SjXoOhOGLGFfaH3X2w';

try {
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
  console.log('JWT Payload:', JSON.stringify(payload, null, 2));
  console.log('Expiry date:', new Date(payload.exp * 1000));
  console.log('Issued date:', new Date(payload.iat * 1000));
  console.log('Current date:', new Date());
  console.log('Is expired?', payload.exp * 1000 < Date.now());
} catch (e) {
  console.log('Error decoding JWT:', e.message);
}
