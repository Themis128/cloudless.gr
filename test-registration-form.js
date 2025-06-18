/**
 * Test registration form end-to-end functionality
 * This script tests the registration form by creating a unique test user
 */

const puppeteer = require('puppeteer');

async function testRegistrationForm() {
  console.log('🚀 Starting Registration Form End-to-End Test');
  console.log('===============================================');

  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Enable console logs from the page
    page.on('console', msg => {
      console.log(`🌐 [PAGE]: ${msg.text()}`);
    });

    // Navigate to registration form
    console.log('📍 Navigating to registration form...');
    await page.goto('http://localhost:3001/auth/register', {
      waitUntil: 'networkidle2',
      timeout: 10000
    });

    // Wait for form to load
    console.log('⏳ Waiting for form to load...');
    await page.waitForSelector('input[placeholder="you@example.com"]', { timeout: 5000 });

    // Generate unique test data
    const timestamp = Date.now();
    const testData = {
      fullName: `Test User ${timestamp}`,
      email: `test${timestamp}@example.com`,
      password: 'TestPassword123!'
    };

    console.log('📝 Filling form with test data:', {
      fullName: testData.fullName,
      email: testData.email,
      password: '***hidden***'
    });

    // Fill the form
    await page.type('input[label="Full Name"]', testData.fullName);
    await page.type('input[placeholder="you@example.com"]', testData.email);
    await page.type('input[label="Password"]', testData.password);
    await page.type('input[label="Confirm Password"]', testData.password);

    // Check the terms agreement checkbox
    console.log('✅ Agreeing to terms...');
    await page.click('input[type="checkbox"]');

    // Wait a moment for form validation
    await page.waitForTimeout(1000);

    // Submit the form
    console.log('🚀 Submitting registration form...');
    await page.click('button[type="submit"]');

    // Wait for result
    console.log('⏳ Waiting for registration result...');
    await page.waitForTimeout(3000);

    // Check for success or error messages
    const successAlert = await page.$('.v-alert--type-success');
    const errorAlert = await page.$('.v-alert--type-error');

    if (successAlert) {
      const successText = await page.evaluate(el => el.textContent, successAlert);
      console.log('✅ Registration successful!');
      console.log('📧 Success message:', successText);
      return { success: true, message: successText };
    } else if (errorAlert) {
      const errorText = await page.evaluate(el => el.textContent, errorAlert);
      console.log('❌ Registration failed!');
      console.log('🚨 Error message:', errorText);
      return { success: false, message: errorText };
    } else {
      console.log('⚠️  No success or error message found');
      return { success: false, message: 'No result message found' };
    }

  } catch (error) {
    console.error('🚨 Test error:', error);
    return { success: false, message: error.message };
  } finally {
    await browser.close();
  }
}

// Check if puppeteer is available
const checkPuppeteer = async () => {
  try {
    require('puppeteer');
    return true;
  } catch (error) {
    console.log('⚠️  Puppeteer not installed. Installing...');
    const { execSync } = require('child_process');
    try {
      execSync('npm install puppeteer --save-dev', { stdio: 'inherit' });
      return true;
    } catch (installError) {
      console.error('❌ Failed to install Puppeteer:', installError.message);
      return false;
    }
  }
};

// Run the test
async function main() {
  const hasPuppeteer = await checkPuppeteer();
  if (!hasPuppeteer) {
    console.log('❌ Cannot run automated test without Puppeteer');
    return;
  }

  const result = await testRegistrationForm();

  console.log('\n===============================================');
  if (result.success) {
    console.log('✅ Registration Form Test: PASSED');
  } else {
    console.log('❌ Registration Form Test: FAILED');
    console.log('Error:', result.message);
  }
  console.log('===============================================');
}

main().catch(console.error);
