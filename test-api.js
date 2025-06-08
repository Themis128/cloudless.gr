// Test script for the user login API
const testLoginAPI = async () => {
  try {
    console.log('🧪 Testing /api/auth/user-login endpoint...');
    
    const response = await fetch('http://localhost:3000/api/auth/user-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@cloudless.gr',
        password: 'TestPassword123!',
        rememberMe: false
      })
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Login successful!');
      console.log('📝 Response data:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Login failed!');
      console.log('📝 Error response:', errorText);
    }
  } catch (error) {
    console.error('🚨 Network error:', error.message);
  }
};

// Test with invalid credentials
const testInvalidLogin = async () => {
  try {
    console.log('\n🧪 Testing invalid credentials...');
    
    const response = await fetch('http://localhost:3000/api/auth/user-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'invalid@example.com',
        password: 'wrongpassword',
        rememberMe: false
      })
    });

    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('✅ Correctly rejected invalid credentials');
      console.log('📝 Error response:', errorText);
    } else {
      console.log('❌ Should have rejected invalid credentials!');
    }
  } catch (error) {
    console.error('🚨 Network error:', error.message);
  }
};

// Run tests
testLoginAPI().then(() => testInvalidLogin());
