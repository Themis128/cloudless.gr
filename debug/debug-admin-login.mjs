// Debug admin login API
import fetch from 'node-fetch';

async function testAdminLogin() {
    const url = 'http://localhost:3000/api/auth/admin-login';
    const data = {
        email: 'admin@cloudless.gr',
        password: 'cloudless2025'
    };

    try {
        console.log('Testing admin login...');
        console.log('URL:', url);
        console.log('Data:', data);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        console.log('Status:', response.status);
        console.log('Headers:', Object.fromEntries(response.headers));
        
        const result = await response.text();
        console.log('Raw response:', result);
        
        try {
            const json = JSON.parse(result);
            console.log('Parsed JSON:', json);
        } catch (e) {
            console.log('Failed to parse JSON:', e.message);
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testAdminLogin();
