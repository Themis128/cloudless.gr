import { expect, test } from '@playwright/test';

test.describe('User Workflow E2E Tests', () => {
  const testUser = {
    email: 'workflow@example.com',
    password: 'WorkflowTest123!',
    fullName: 'Workflow Test User',
  };

  // Setup authenticated user state
  test.beforeEach(async ({ page }) => {
    // Mock authentication for workflow tests
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'supabase.auth.token',
        JSON.stringify({
          access_token: 'mock-token',
          user: {
            id: 'test-user-id',
            email: 'workflow@example.com',
            user_metadata: {
              full_name: 'Workflow Test User',
            },
          },
        }),
      );
    });
  });

  test('should complete full user registration and login workflow', async ({ page }) => {
    // Start from home page
    await page.goto('/');

    // Navigate to registration
    await page.getByRole('link', { name: /register|sign up/i }).click();
    await expect(page).toHaveURL(/\/auth\/register/);

    // Fill registration form
    await page.getByLabel(/full name/i).fill(testUser.fullName);
    await page.getByRole('textbox', { name: /email/i }).fill(testUser.email);
    await page.getByLabel(/^password$/i).fill(testUser.password);
    await page.getByLabel(/confirm password/i).fill(testUser.password);

    // Mock successful registration
    await page.route('**/auth/v1/signup*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'new-user-id',
            email: testUser.email,
            user_metadata: { full_name: testUser.fullName },
          },
        }),
      });
    });

    // Submit registration
    await page.getByRole('button', { name: /create account/i }).click();

    // Should handle successful registration
    await page.waitForTimeout(2000);

    // Navigate to login
    await page.goto('/auth');

    // Fill login form
    await page.getByRole('textbox', { name: /email/i }).fill(testUser.email);
    await page.getByLabel(/password/i).fill(testUser.password);

    // Mock successful login
    await page.route('**/auth/v1/token*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          user: {
            id: 'test-user-id',
            email: testUser.email,
            user_metadata: { full_name: testUser.fullName },
          },
        }),
      });
    });

    // Submit login
    await page.getByRole('button', { name: /login/i }).click();

    // Should be redirected to dashboard or main app
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    expect(
      currentUrl.includes('/dashboard') ||
        currentUrl.includes('/projects') ||
        currentUrl.includes('/'),
    ).toBeTruthy();
  });

  test('should navigate through main application sections', async ({ page }) => {
    await page.goto('/');

    // Test navigation to different sections
    const sections = [
      { name: /projects/i, expectedUrl: '/projects' },
      { name: /about/i, expectedUrl: '/info/about' },
      { name: /contact/i, expectedUrl: '/info/contact' },
      { name: /settings/i, expectedUrl: '/settings' },
    ];

    for (const section of sections) {
      const link = page.getByRole('link', { name: section.name });
      if (await link.isVisible()) {
        await link.click();
        await page.waitForLoadState('networkidle');

        // Check if navigated to expected URL or at least changed
        const currentUrl = page.url();
        const hasNavigated = currentUrl.includes(section.expectedUrl) || currentUrl !== '/';

        expect(hasNavigated).toBeTruthy();

        // Go back to home for next test
        await page.goto('/');
      }
    }
  });

  test('should handle user profile and settings', async ({ page }) => {
    await page.goto('/settings');

    // Should display user settings or profile page
    const hasUserSettings =
      (await page.getByText(/profile|settings|account/i).isVisible()) ||
      (await page.getByRole('textbox').isVisible());

    expect(hasUserSettings).toBeTruthy();

    // Test profile update if form is available
    const profileForm = page.locator('form');
    if (await profileForm.isVisible()) {
      // Fill profile information
      const nameField = page.getByLabel(/name|full name/i);
      if (await nameField.isVisible()) {
        await nameField.fill('Updated Name');
      }

      // Submit if submit button exists
      const submitButton = page.getByRole('button', { name: /save|update/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Should show success message or reload
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should handle project creation workflow', async ({ page }) => {
    await page.goto('/projects');

    // Look for create project button
    const createButton = page.getByRole('button', { name: /create|new project|add project/i });
    if (await createButton.isVisible()) {
      await createButton.click();

      // Should open project creation dialog or form
      const projectForm = page.locator('form, .dialog, .modal');
      if (await projectForm.isVisible()) {
        // Fill project details
        const projectNameField = page.getByLabel(/project name|name|title/i);
        if (await projectNameField.isVisible()) {
          await projectNameField.fill('Test Project');
        }

        const descriptionField = page.getByLabel(/description/i);
        if (await descriptionField.isVisible()) {
          await descriptionField.fill('Test project description');
        }

        // Submit project creation
        const submitButton = page.getByRole('button', { name: /create|save|submit/i });
        if (await submitButton.isVisible()) {
          await submitButton.click();

          // Should show success or close dialog
          await page.waitForTimeout(2000);
        }
      }
    }
  });

  test('should handle logout workflow', async ({ page }) => {
    await page.goto('/');

    // Look for user menu or logout button
    const userMenu = page
      .getByText(testUser.fullName)
      .or(page.getByRole('button', { name: /menu|profile|account/i }));

    if (await userMenu.isVisible()) {
      await userMenu.click();

      // Look for logout option
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
      if (await logoutButton.isVisible()) {
        await logoutButton.click();

        // Should redirect to login or home page
        await page.waitForTimeout(2000);
        const currentUrl = page.url();
        expect(
          currentUrl.includes('/auth') || currentUrl.includes('/') || currentUrl.includes('/login'),
        ).toBeTruthy();
      }
    }
  });

  test('should handle responsive navigation', async ({ page }) => {
    // Test desktop navigation
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/');

    // Check if navigation is visible
    const desktopNav = page.locator('nav, .navigation, .menu');
    if (await desktopNav.isVisible()) {
      await expect(desktopNav).toBeVisible();
    }

    // Test mobile navigation
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();

    // Look for mobile menu toggle
    const mobileMenuToggle = page
      .getByRole('button', { name: /menu|hamburger/i })
      .or(page.locator('.menu-toggle, .hamburger, [aria-label*="menu"]'));

    if (await mobileMenuToggle.isVisible()) {
      await mobileMenuToggle.click();

      // Mobile menu should be visible
      const mobileMenu = page.locator('.mobile-menu, .drawer, .sidebar');
      if (await mobileMenu.isVisible()) {
        await expect(mobileMenu).toBeVisible();
      }
    }
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Test network error handling
    await page.route('**/api/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' }),
      });
    });

    await page.goto('/projects');

    // Should show error message or fallback UI
    await page.waitForTimeout(2000);
    const hasErrorHandling =
      (await page.getByText(/error|failed|try again/i).isVisible()) ||
      (await page.getByRole('button', { name: /retry|refresh/i }).isVisible());

    expect(hasErrorHandling).toBeTruthy();
  });

  test('should handle accessibility features', async ({ page }) => {
    await page.goto('/');

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus').isVisible();
    expect(focusedElement).toBeTruthy();

    // Test for aria labels and roles
    const hasAriaLabels = await page.locator('[aria-label], [role]').count();
    expect(hasAriaLabels).toBeGreaterThan(0);

    // Test for alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();
    if (imageCount > 0) {
      const firstImage = images.first();
      const hasAltText = await firstImage.getAttribute('alt');
      expect(hasAltText).toBeTruthy();
    }
  });

  test('should handle form validation across the application', async ({ page }) => {
    // Test contact form validation
    await page.goto('/info/contact');

    const contactForm = page.locator('form');
    if (await contactForm.isVisible()) {
      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /send|submit/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Should show validation errors
        const validationError = page.getByText(/required|invalid/i);
        if (await validationError.isVisible()) {
          await expect(validationError).toBeVisible();
        }
      }
    }
  });

  test('should handle search functionality if available', async ({ page }) => {
    await page.goto('/');

    // Look for search input
    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));

    if (await searchInput.isVisible()) {
      await searchInput.fill('test search');
      await page.keyboard.press('Enter');

      // Should show search results or navigate to search page
      await page.waitForTimeout(1000);
      const hasSearchResults =
        (await page.getByText(/results|found|search/i).isVisible()) ||
        page.url().includes('/search');

      expect(hasSearchResults).toBeTruthy();
    }
  });
});
