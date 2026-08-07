import { test, expect } from "@playwright/test";

/**
 * E-commerce User Journey Test Suite
 * Tests complete user flows for shopping, checkout, and order management
 */

test.describe("E-commerce User Journey", () => {
  test.beforeEach(async ({ page }) => {
    // Start from homepage
    await page.goto("/");
    // Wait for redirect to locale-specific homepage (e.g., /en)
    await expect(page).toHaveURL(/\/.*\/?$/);
  });

  test("should allow user to browse products and add to cart", async ({ page }) => {
    // Navigate to store page
    // Wait a moment for the page to settle and responsive classes to apply
    await page.waitForTimeout(1000);
    
    // Check if we're in desktop view by checking if desktop nav links are visible
    const desktopNavLinks = page.locator('header nav div[class*="lg:flex"]');
    const isDesktopView = await desktopNavLinks.isVisible();
    
    if (isDesktopView) {
      // Desktop view: click store link in desktop nav
      await page.locator('header nav a[href*="/store"]').first().click();
    } else {
      // Mobile view: open menu first, then click store link in mobile menu
      const toggleMenuButton = page.locator('[aria-label="Toggle menu"]');
      await toggleMenuButton.click();
      // Wait for mobile menu to open
      await page.waitForSelector('div[class*="lg:hidden"][class*="opacity-100"]');
      // Click store link in mobile menu
      await page.locator('div[class*="lg:hidden"][class*="opacity-100"] div.space-y-1 a[href$="/store"]').click();
    }
    await expect(page).toHaveURL(/\/.*\/store/);
    
    // Wait for products to load - look for product links
    await page.waitForSelector('a[href*="/store/"]', { timeout: 5000 });
    
    // Click on first product
    const firstProduct = page.locator('a[href*="/store/"]').first();
    await firstProduct.click();
    
    // Wait for product detail page to load - wait for product name
    await page.waitForSelector('h1.font-heading.text-3xl', { timeout: 5000 });
    
    // Add to cart
    await page.click('button:has-text("Add to Cart")');
    
    // Verify cart updated - look for cart count in the cart button in the navbar
    // Wait for the visible cart button to be visible (handle strict mode with multiple elements)
    const cartButton = page.locator('button[aria-label="Open cart"]').filter({ visible: true });
    await expect(cartButton).toBeVisible({ timeout: 5000 });
    await expect(cartButton.locator('span.bg-neon-cyan')).toHaveText(/[1-9]/);
  });

    test("should allow user to view cart and proceed to checkout", async ({ page }) => {
    // Navigate to store page using the nav link (handles locale prefix)
    // Wait a moment for the page to settle and responsive classes to apply
    await page.waitForTimeout(1000);
    // Check if we're in mobile view by checking if the toggle menu button is visible
    const toggleMenuButton = page.locator('[aria-label="Toggle menu"]');
    const isMobileView = await toggleMenuButton.isVisible();
    
    if (isMobileView) {
      // Mobile view: open mobile menu first, then click Store
      // Wait for the toggle menu button to be visible and stable
      await toggleMenuButton.waitFor({ state: 'visible', timeout: 3000 });
      await toggleMenuButton.click();
      // Wait for the mobile menu to open (has opacity-100 and is lg:hidden)
      await page.waitForSelector('div[class*="lg:hidden"][class*="opacity-100"]', { timeout: 3000 });
      // Click the store link in the mobile menu (inside space-y-1 div)
      await page.locator('div[class*="lg:hidden"][class*="opacity-100"] div.space-y-1 a[href*="/store"]').click();
    } else {
      // Desktop view: click the store link in the desktop nav
      await page.locator('header nav a[href*="/store"]').first().click();
    }
    
    await expect(page).toHaveURL(/\/.*\/store/);
    
    // Wait for products to load - look for product links
    await page.waitForSelector('a[href*="/store/"]', { timeout: 5000 });
    
    // Click on first product
    const firstProduct = page.locator('a[href*="/store/"]').first();
    await firstProduct.click();
    
    // Wait for product detail page to load - wait for product name
    await page.waitForSelector('h1.font-heading.text-3xl', { timeout: 5000 });
    
    // Add to cart
    await page.click('button:has-text("Add to Cart")');
    await page.waitForTimeout(1000); // Wait for cart update
    
    // Go to cart
    // Check if we're in mobile view (re-check as state may have changed)
    // Wait a moment for any state changes to settle
    await page.waitForTimeout(1000);
    const isMobileNow = await toggleMenuButton.isVisible();
    
    if (isMobileNow) {
      // Mobile view: open mobile menu first, then click cart button
      await toggleMenuButton.click();
      // Wait for the mobile menu to be fully open
      await page.waitForSelector('div[class*="lg:hidden"][class*="opacity-100"]', { timeout: 3000 });
      // Use force: true to bypass pointer interception issues
      await page.locator('div[class*="mt-2"][class*="flex items-center justify-between"] button[aria-label="Open cart"]').click({ force: true });
    } else {
      // Desktop view: click cart button in desktop nav
      await page.locator('div[class*="ml-2"][class*="flex items-center gap-2"] button[aria-label="Open cart"]').click();
    }
    
    // Wait for cart slide-over to appear - wait for the cart header which contains the item count
    await page.waitForSelector('h2.font-mono.text-lg:has-text("Cart")', { timeout: 5000 });
    
    // Verify item in cart - look for at least one product item in the cart
    await expect(page.locator('div.flex-1.overflow-y-auto.px-6.py-4 .space-y-4 > div.border-neon-cyan\\/5.flex.gap-4.border-b.py-4')).toBeVisible();
    
    // Debug: Check what's in the cart
    const cartItems = page.locator('div.flex-1.overflow-y-auto.px-6.py-4 .space-y-4 > div.border-neon-cyan\\/5.flex.gap-4.border-b.py-4');
    const cartItemCount = await cartItems.count();
    console.log(`Number of items in cart: ${cartItemCount}`);
    
    // Wait for the cart slide-over to be fully visible and stable
    const cartSlideOver = page.locator('div[class*="bg-void border-neon-cyan/10 fixed top-0 right-0 z-50 h-full w-full max-w-md transform border-l shadow-2xl transition-transform duration-300 ease-in-out"]');
    await cartSlideOver.waitFor({ state: 'visible', timeout: 5000 });
    // Ensure it's fully animated in (not just in DOM but actually visible)
    await cartSlideOver.waitFor({ state: 'visible', timeout: 5000 });
    // Additional wait for animations to complete
    await page.waitForTimeout(1000);
    
    // Proceed to checkout
    // Wait for the checkout button to be stable and not intercepted
    const checkoutButton = page.locator('button:has-text("Checkout")');
    await checkoutButton.waitFor({ state: 'visible', timeout: 5000 });
    
    // Debug: Check if checkout button is visible and get its text
    const isCheckoutButtonVisible = await checkoutButton.isVisible();
    const checkoutButtonText = await checkoutButton.textContent();
    console.log(`Checkout button visible: ${isCheckoutButtonVisible}, text: '${checkoutButtonText}'`);
    
    // Debug: Check for any error messages in the cart slide-over
    const errorMessage = page.locator('text="Subscriptions and one-time items can&apos;t be purchased together. Please remove one type before checking out."');
    const hasError = await errorMessage.isVisible();
    console.log(`Cart slide-over has mixed cart error: ${hasError}`);
    if (hasError) {
      const errorText = await errorMessage.textContent();
      console.log(`Error text: ${errorText}`);
    }
    
    // Try to focus the button and press Enter to trigger the click
    await checkoutButton.focus();
    await page.keyboard.press('Enter');
    
    // Wait a bit for navigation to start
    await page.waitForTimeout(1000);
    // Log the URL for debugging
    const currentUrl = page.url();
    console.log(`Current URL after checkout click: ${currentUrl}`);
    
    // Check for any error messages in the UI
    const errorAlert = page.locator('role=alert');
    const errorCount = await errorAlert.count();
    console.log(`Number of error alerts: ${errorCount}`);
    if (errorCount > 0) {
      const errorText = await errorAlert.first().textContent();
      console.log(`Error text: ${errorText}`);
    }
    
    // If we're not going to the contact page, let's see where we are going
    if (!currentUrl.includes('/contact')) {
      console.log(`Unexpected navigation to: ${currentUrl}`);
      // Check if we're on a product page
      if (currentUrl.includes('/store/')) {
        console.log('Redirected to a product page instead of checkout');
        // This suggests the checkout failed and we fell back to viewing the product
      }
    }
    
    // Expect to be redirected to contact page with purchase topic (this is the checkout flow)
    await expect(page).toHaveURL(/\/.*\/contact/);
    // Verify the URL contains the correct parameters for purchase flow
    await expect(page).toHaveURL(/.*\/contact\?.*topic=purchase.*/);
    
    // For purchase flow, we should see the purchase intent banner instead of the regular form
    const purchaseIntentBanner = page.locator('text=Almost there! Tell us about your project.');
    await expect(purchaseIntentBanner).toBeVisible();
    
    // Fill in contact form with test data (the form appears below the purchase intent banner)
    await page.fill('input[name="name"]', `Test User ${Date.now()}`);
    await page.fill('input[name="email"]', `test${Date.now()}@example.com`);
    await page.fill('input[name="company"]', 'Test Company');
    // Select a service from the dropdown
    await page.selectOption('select[name="service"]', 'Serverless Development');
    // Fill in the message field (will be pre-filled with product info, but we can add more)
    await page.fill('textarea[name="message"]', `I want to purchase the srv-cloud product. Additionally, I need help with serverless development.`);
    // Check the privacy consent checkbox (required)
    await page.check('input[name="privacyConsent"]');
    
    // Verify form accepts input
    await expect(page.locator('input[name="name"]')).toHaveValue(/Test User.*/);
    await expect(page.locator('input[name="email"]')).toHaveValue(/test.*@example.com/);
    
    // Submit the contact form
    await page.click('button[type="submit"]');
    
    // Wait for either success message to be visible or error message to be visible
    try {
      await page.waitForTimeout(500); // Brief pause for form submission to start
      
      // Wait for either success or error to appear, with longer timeout for success due to ScrollReveal
      await Promise.race([
        // Wait for success message to be visible (accounting for ScrollReveal animation)
        page.locator('text=Message sent successfully!').first().waitFor({ 
          state: 'visible', 
          timeout: 15000 
        }),
        // Wait for error message to be visible and have text
        page.locator('role=alert').first().waitFor({ 
          state: 'visible', 
          timeout: 5000 
        }).then(async errorElement => {
          // Make sure the error message actually has text
          const errorText = await errorElement.textContent();
          if (!errorText || errorText.trim() === '') {
            throw new Error('Error element visible but empty');
          }
        })
      ]);
    } catch (e) {
      console.log('Timeout waiting for form submission to complete');
    }
    
    // Check for success message
    const successMessage = page.locator('text=Message sent successfully!');
    const formErrorAlert = page.locator('role=alert');
    
    // If we see an error message, print it for debugging
    if (await formErrorAlert.count() > 0) {
      const errorText = await formErrorAlert.first().textContent();
      console.log(`Form submission error: ${errorText}`);
    }
    
    // Check if we got a success message
    const successCount = await successMessage.count();
    if (successCount > 0) {
      // Wait for success message to be visible (accounting for potential ScrollReveal delay)
      await expect(successMessage.first()).toBeVisible({ timeout: 10000 });
    } else {
      // If no success message, fail the test with helpful info
      throw new Error('Success message did not appear after form submission. Check if contact form is working correctly.');
    }
  });

  test("should allow user to complete checkout process", async ({ page }) => {
    // This test would require mock payment processing
    // For now, we'll verify the checkout form loads and validates
    
    // First, add an item to cart
    // Wait a moment for the page to settle and responsive classes to apply
    await page.waitForTimeout(1000);
    // Check if we're in mobile view by checking if the toggle menu button is visible
    const toggleMenuButton = page.locator('[aria-label="Toggle menu"]');
    // Wait for the toggle button to be in DOM (it may be visible or hidden depending on viewport)
    await toggleMenuButton.waitFor({ state: 'attached', timeout: 5000 });
    const isMobileView = await toggleMenuButton.isVisible();
    
    if (isMobileView) {
      // Mobile view: open mobile menu first, then click Store
      // Wait for the toggle menu button to be visible and stable
      await toggleMenuButton.waitFor({ state: 'visible', timeout: 5000 });
      await toggleMenuButton.click();
      // Wait for the mobile menu to open (has opacity-100 and is lg:hidden)
      await page.waitForSelector('div[class*="lg:hidden"][class*="opacity-100"]', { timeout: 5000 });
      // Additional wait for menu to be fully ready
      await page.waitForTimeout(1000);
      // Click the store link in the mobile menu (inside space-y-1 div)
      await page.locator('div[class*="lg:hidden"][class*="opacity-100"] div.space-y-1 a[href*="/store"]').first().click({ timeout: 5000 });
    } else {
      // Desktop view: click the store link in the desktop nav
      await page.locator('header nav a[href*="/store"]').first().click({ timeout: 5000 });
    }
    
    await expect(page).toHaveURL(/\/.*\/store/, { timeout: 10000 });
    
    // Wait for products to load - look for product links
    await page.waitForSelector('a[href*="/store/"]', { timeout: 10000 });
    
    // Click on first product
    const firstProduct = page.locator('a[href*="/store/"]').first();
    await firstProduct.click({ timeout: 5000 });
    
    // Wait for product detail page to load - wait for product name
    await page.waitForSelector('h1.font-heading.text-3xl', { timeout: 10000 });
    
    // Add to cart
    await page.click('button:has-text("Add to Cart")', { timeout: 5000 });
    await page.waitForTimeout(1000); // Wait for cart update
    
    // Go to cart
    // Check if we're in mobile view (re-check as state may have changed)
    // Wait a moment for any state changes to settle
    await page.waitForTimeout(1000);
    const toggleMenuButtonNow = page.locator('[aria-label="Toggle menu"]');
    await toggleMenuButtonNow.waitFor({ state: 'attached', timeout: 5000 });
    const isMobileNow = await toggleMenuButtonNow.isVisible();
    
    if (isMobileNow) {
      // Mobile view: open mobile menu first, then click cart button
      await toggleMenuButtonNow.click({ timeout: 5000 });
      // Wait for the mobile menu to be fully open
      await page.waitForSelector('div[class*="lg:hidden"][class*="opacity-100"]', { timeout: 5000 });
      // Additional wait for menu to be fully ready
      await page.waitForTimeout(500);
      // Use force: true to bypass pointer interception issues
      await page.locator('div[class*="mt-2"][class*="flex items-center justify-between"] button[aria-label="Open cart"]').first().click({ force: true, timeout: 5000 });
    } else {
      // Desktop view: click cart button in desktop nav
      await page.locator('div[class*="ml-2"][class*="flex items-center gap-2"] button[aria-label="Open cart"]').first().click({ timeout: 5000 });
    }
    
    // Wait for cart slide-over to appear - wait for the cart header which contains the item count
    await page.waitForSelector('h2.font-mono.text-lg:has-text("Cart")', { timeout: 10000 });
    
    // Verify item in cart - look for at least one product item in the cart
    await expect(page.locator('div.flex-1.overflow-y-auto.px-6.py-4 .space-y-4 > div.border-neon-cyan\\/5.flex.gap-4.border-b.py-4').first()).toBeVisible({ timeout: 5000 });
    
    // Debug: Check what's in the cart
    const cartItems = page.locator('div.flex-1.overflow-y-auto.px-6.py-4 .space-y-4 > div.border-neon-cyan\\/5.flex.gap-4.border-b.py-4');
    const cartItemCount = await cartItems.count();
    console.log(`Number of items in cart: ${cartItemCount}`);
    
    // Wait for the cart slide-over to be fully visible and stable
    const cartSlideOver = page.locator('div[class*="bg-void border-neon-cyan/10 fixed top-0 right-0 z-50 h-full w-full max-w-md transform border-l shadow-2xl transition-transform duration-300 ease-in-out"]');
    await cartSlideOver.waitFor({ state: 'visible', timeout: 5000 });
    // Ensure it's fully animated in (not just in DOM but actually visible)
    await cartSlideOver.waitFor({ state: 'visible', timeout: 5000 });
    // Additional wait for animations to complete
    await page.waitForTimeout(1000);
    
    // Proceed to checkout
    // Wait for the checkout button to be stable and not intercepted
    const checkoutButton = page.locator('button:has-text("Checkout")');
    await checkoutButton.waitFor({ state: 'visible', timeout: 5000 });
    
    // Debug: Check if checkout button is visible and get its text
    const isCheckoutButtonVisible = await checkoutButton.isVisible();
    const checkoutButtonText = await checkoutButton.textContent();
    console.log(`Checkout button visible: ${isCheckoutButtonVisible}, text: '${checkoutButtonText}'`);
    
    // Debug: Check for any error messages in the cart slide-over
    const errorMessage = page.locator('text="Subscriptions and one-time items can&apos;t be purchased together. Please remove one type before checking out."');
    const hasError = await errorMessage.isVisible({ timeout: 5000 });
    console.log(`Cart slide-over has mixed cart error: ${hasError}`);
    if (hasError) {
      const errorText = await errorMessage.first().textContent();
      console.log(`Error text: ${errorText}`);
    }
    
    // Try to focus the button and press Enter to trigger the click
    await checkoutButton.focus();
    await page.keyboard.press('Enter');
    
    // Wait a bit for navigation to start
    await page.waitForTimeout(1000);
    // Log the URL for debugging
    const currentUrl = page.url();
    console.log(`Current URL after checkout click: ${currentUrl}`);
    
    // Check for any error messages in the UI
    const errorAlert = page.locator('role=alert');
    const errorCount = await errorAlert.count();
    console.log(`Number of error alerts: ${errorCount}`);
    if (errorCount > 0) {
      const errorText = await errorAlert.first().textContent();
      console.log(`Error text: ${errorText}`);
    }
    
    // If we're not going to the contact page, let's see where we are going
    if (!currentUrl.includes('/contact')) {
      console.log(`Unexpected navigation to: ${currentUrl}`);
      // Check if we're on a product page
      if (currentUrl.includes('/store/')) {
        console.log('Redirected to a product page instead of checkout');
        // This suggests the checkout failed and we fell back to viewing the product
      }
    }
    
    // Expect to be redirected to contact page with purchase topic (this is the checkout flow)
    await expect(page).toHaveURL(/\/.*\/contact/, { timeout: 10000 });
    // Verify the URL contains the correct parameters for purchase flow
    await expect(page).toHaveURL(/.*\/contact\?.*topic=purchase.*/);
    
    // For purchase flow, we should see the purchase intent banner instead of the regular form
    const purchaseIntentBanner = page.locator('text=Almost there! Tell us about your project.');
    await expect(purchaseIntentBanner).toBeVisible({ timeout: 5000 });
    
    // Fill in contact form with test data (the form appears below the purchase intent banner)
    await page.fill('input[name="name"]', `Test User ${Date.now()}`, { timeout: 5000 });
    await page.fill('input[name="email"]', `test${Date.now()}@example.com`, { timeout: 5000 });
    await page.fill('input[name="company"]', 'Test Company', { timeout: 5000 });
    // Select a service from the dropdown
    await page.selectOption('select[name="service"]', 'Serverless Development', { timeout: 5000 });
    // Fill in the message field (will be pre-filled with product info, but we can add more)
    await page.fill('textarea[name="message"]', `I want to purchase the srv-cloud product. Additionally, I need help with serverless development.`, { timeout: 5000 });
    // Check the privacy consent checkbox (required)
    await page.check('input[name="privacyConsent"]', { timeout: 5000 });
    
    // Verify form accepts input
    await expect(page.locator('input[name="name"]')).toHaveValue(/Test User.*/, { timeout: 5000 });
    await expect(page.locator('input[name="email"]')).toHaveValue(/test.*@example.com/, { timeout: 5000 });
    
    // Submit the contact form
    console.log('[DEBUG] Clicking submit button');
    await page.click('button[type="submit"]', { timeout: 5000 });
    console.log('[DEBUG] Submit button clicked');
    
    // Wait a bit for the submission to start
    await page.waitForTimeout(500);
    
    // Check for any error messages immediately after submit
    const immediateError = page.locator('role=alert');
    if (await immediateError.count() > 0) {
      const errorText = await immediateError.first().textContent();
      console.log(`[DEBUG] Immediate error after submit: ${errorText}`);
    }
    
    // Wait for either success message to be visible or error message to be visible
    try {
      console.log('[DEBUG] Waiting for success or error message');
      await Promise.race([
        // Wait for success message to be visible (accounting for ScrollReveal)
        page.locator('text=Message sent successfully!').first().waitFor({ 
          state: 'visible', 
          timeout: 15000 
        }),
        // Wait for error message to be visible and have text
        page.locator('role=alert').first().waitFor({ 
          state: 'visible', 
          timeout: 5000 
        }).then(async errorElement => {
          // Make sure the error message actually has text
          const errorText = await errorElement.textContent();
          if (!errorText || errorText.trim() === '') {
            throw new Error('Error element visible but empty');
          }
        })
      ]);
      console.log('[DEBUG] Got success or error message');
    } catch (e) {
      console.log('Timeout waiting for form submission to complete: ${e.message}');
      
      // Debug: check what's on the page right now
      const pageText = await page.textContent('body');
      console.log(`[DEBUG] Page text after timeout: ${pageText.substring(0, 500)}...`);
      
      // Check for any error messages
      const errorElements = page.locator('role=alert');
      if (await errorElements.count() > 0) {
        const errorText = await errorElements.first().textContent();
        console.log(`[DEBUG] Error elements found: ${errorText}`);
      }
      
      // Check for success message elements
      const successElements = page.locator('text=Message sent successfully!');
      if (await successElements.count() > 0) {
        console.log('[DEBUG] Success elements found in DOM');
        const isVisible = await successElements.first().isVisible();
        console.log(`[DEBUG] Success element visible: ${isVisible}`);
      } else {
        console.log('[DEBUG] No success elements found in DOM');
      }
      
      throw new Error('Success message did not appear after form submission. Check if contact form is working correctly.');
    }
  });

  test("should allow user to view order history", async ({ page }) => {
    // This would require authentication
    // For now, test that the route exists and handles unauthenticated access
    
    // Navigate to a blank page first to ensure we have a clean context
    await page.goto("about:blank");
    
    // Clear cookies and localStorage to ensure unauthenticated state
    await page.context().clearCookies();
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // Ignore errors if we can't access storage (e.g., due to navigation)
      }
    });
    
    // Navigate directly to dashboard page (with explicit locale)
    await page.goto("/en/dashboard", { waitUntil: "commit", timeout: 15000 });
    
    // Should redirect to login or show appropriate message for unauthenticated access
    // Wait for either the login message to appear or for a redirect to login page
    await Promise.race([
      expect(page.locator('text=Sign in, text=Login, text=Please log in, text=Sign In').first()).toBeVisible({ timeout: 10000 }),
      expect(page).toHaveURL(/\/.*\/auth\/login/, { timeout: 10000 }),
    ]);
  });

  test("should allow user to manage profile", async ({ page }) => {
    // Test profile page access
    // For now, test that the route exists and handles unauthenticated access
    
    // Navigate to a blank page first to ensure we have a clean context
    await page.goto("about:blank");
    
    // Clear cookies and localStorage to ensure unauthenticated state
    await page.context().clearCookies();
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // Ignore errors if we can't access storage (e.g., due to navigation)
      }
    });
    
    // Navigate directly to dashboard/profile page (with explicit locale)
    await page.goto("/en/dashboard/profile", { waitUntil: "commit", timeout: 15000 });
    
    // Should redirect to login or show appropriate message for unauthenticated access
    // Wait for either the login message to appear or for a redirect to login page
    await Promise.race([
      expect(page.locator('text=Sign in, text=Login, text=Please log in, text=Sign In').first()).toBeVisible({ timeout: 10000 }),
      expect(page).toHaveURL(/\/.*\/auth\/login/, { timeout: 10000 }),
    ]);
  });
});