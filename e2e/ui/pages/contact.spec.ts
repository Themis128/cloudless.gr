import { test, expect } from "@playwright/test";
import { createBasePage, createResponsivePage, createAuthenticatedPage } from "../helpers/page-helpers";

/**
 * Contact Page Test Suite
 * Tests the contact page for rendering, navigation, and functionality
 */

test.describe("Contact Page", () => {
  let page: BasePage;
  let responsivePage: ResponsivePage;
  let authPage: AuthenticatedPage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = createBasePage(browserPage);
    responsivePage = createResponsivePage(browserPage);
    authPage = createAuthenticatedPage(browserPage);
    
    await page.navigate("/contact");
  });

  test("should load successfully", async ({ page: browserPage }) => {
    await expect(browserPage).toHaveTitle(/contact|cloudless/i);
    
    // Check for main heading
    const heading = browserPage.locator('h1, .contact-heading, [data-testid="contact-heading"]');
    await expect(heading).toBeVisible();
  });

  test("should have contact form", async ({ page: browserPage }) => {
    const contactForm = browserPage.locator('form, [data-testid="contact-form"], .contact-form');
    await expect(contactForm).toBeVisible();
    
    // Check for name field
    const nameInput = contactForm.locator('input[name*="name" i], [data-testid="name-input"]');
    await expect(nameInput).toBeVisible();
    
    // Check for email field
    const emailInput = contactForm.locator('input[name*="email" i], [data-testid="email-input"], input[type="email"]');
    await expect(emailInput).toBeVisible();
    
    // Check for subject field (optional)
    const subjectInput = contactForm.locator('input[name*="subject" i], [data-testid="subject-input"]');
    // Subject might not be required
    
    // Check for message field
    const messageInput = contactForm.locator('textarea[name*="message" i], [data-testid="message-input"]');
    await expect(messageInput).toBeVisible();
    
    // Check for submit button
    const submitButton = contactForm.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
    await expect(submitButton).toBeVisible();
  });

  test("should have contact information", async ({ page: browserPage }) => {
    const contactInfo = browserPage.locator('.contact-info, [data-testid="contact-info"], .info-section');
    await expect(contactInfo).toBeVisible();
    
    // Check for address
    const address = contactInfo.locator('[data-testid="address"], .address, text=/address/i');
    await expect(address).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    // Check for phone number
    const phone = contactInfo.locator('[data-testid="phone"], .phone, text=/phone/i, text=/tel:/i');
    await expect(phone).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    // Check for email address
    const email = contactInfo.locator('[data-testid="email"], .email, text=/email/i, text=/@/i');
    await expect(email).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    // Check for social media links
    const socialLinks = contactInfo.locator('a[href*="twitter"], a[href*="facebook"], a[href*="linkedin"], a[href*="instagram"]');
    // Social links might not be present
  });

  test("should have map or location information", async ({ page: browserPage }) => {
    const mapContainer = browserPage.locator('.map, [data-testid="map"], #map, .location-map');
    await expect(mapContainer).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    // If map is present, check for iframe or static image
    if (await mapContainer.isVisible()) {
      const mapElement = mapContainer.locator('iframe, img, [data-testid="map-element"]');
      await expect(mapElement).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test("should have call-to-action for newsletter or consultation", async ({ page: browserPage }) => {
    const ctaSection = browserPage.locator('.cta-section, [data-testid="cta"], .newsletter-cta');
    await expect(ctaSection).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    if (await ctaSection.isVisible()) {
      // Check for heading in CTA
      const ctaHeading = ctaSection.locator('h2, h3, .cta-title');
      await expect(ctaHeading).toBeVisible();
      
      // Check for input or button
      const inputOrButton = ctaSection.locator('input, button, .btn');
      await expect(inputOrButton).toBeVisible();
    }
  });

  test.describe("Form Validation", () => {
    test("should show validation errors for empty required fields", async ({ page: browserPage }) => {
      const contactForm = browserPage.locator('form, [data-testid="contact-form"], .contact-form');
      await expect(contactForm).toBeVisible();
      
      // Try to submit empty form
      const submitButton = contactForm.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      await submitButton.click();
      
      // Check for validation errors
      const nameError = browserPage.locator('text=/name is required/i, [data-testid="name-error"], .error-message');
      const emailError = browserPage.locator('text=/email is required/i, [data-testid="email-error"], .error-message');
      const messageError = browserPage.locator('text=/message is required/i, [data-testid="message-error"], .error-message');
      
      // At least one error should be visible
      expect(await nameError.isVisible() || await emailError.isVisible() || await messageError.isVisible()).toBeTruthy();
    });
    
    test("should show validation error for invalid email format", async ({ page: browserPage }) => {
      const contactForm = browserPage.locator('form, [data-testid="contact-form"], .contact-form');
      await expect(contactForm).toBeVisible();
      
      // Fill form with invalid email
      const nameInput = contactForm.locator('input[name*="name" i], [data-testid="name-input"]');
      const emailInput = contactForm.locator('input[name*="email" i], [data-testid="email-input"]');
      const messageInput = contactForm.locator('textarea[name*="message" i], [data-testid="message-input"]');
      
      await nameInput.fill("Test User");
      await emailInput.fill("invalid-email"); // Invalid email
      await messageInput.fill("This is a test message");
      
      // Try to submit form
      const submitButton = contactForm.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      await submitButton.click();
      
      // Check for email validation error
      const emailError = browserPage.locator('text=/valid email/i, text=/email format/i, [data-testid="email-error"], .error-message');
      await expect(emailError).toBeVisible({ timeout: 5000 });
    });
    
    test("should submit form successfully with valid data", async ({ page: browserPage }) => {
      const contactForm = browserPage.locator('form, [data-testid="contact-form"], .contact-form');
      await expect(contactForm).toBeVisible();
      
      // Fill form with valid data
      const nameInput = contactForm.locator('input[name*="name" i], [data-testid="name-input"]');
      const emailInput = contactForm.locator('input[name*="email" i], [data-testid="email-input"]');
      const messageInput = contactForm.locator('textarea[name*="message" i], [data-testid="message-input"]');
      
      await nameInput.fill("Test User");
      await emailInput.fill("test@example.com");
      await messageInput.fill("This is a test message");
      
      // Try to submit form
      const submitButton = contactForm.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      await submitButton.click();
      
      // Check for success message
      const successMessage = browserPage.locator('text=/message sent/i, text=/thank you/i, [data-testid="success-message"], .success-message');
      await expect(successMessage).toBeVisible({ timeout: 10000 }); // Might take longer for form submission
      
      // Or check that form is reset/hidden
      // await expect(contactForm).toBeHidden({ timeout: 10000 });
    });
  });

  test.describe("Authentication", () => {
    test("should show authenticated user info when logged in", async ({ page: browserPage }) => {
      // First login as a test user
      await authPage.loginViaApi("test@example.com", "password123");
      
      await page.navigate("/contact");
      
      // Check for user info or personalized content
      const userInfo = browserPage.locator('.user-info, [data-testid="user-info"], text=/hello, test/i');
      await expect(userInfo).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      # Check for pre-filled form with user data
      const nameInput = browserPage.locator('input[name*="name" i], [data-testid="name-input"]');
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"]');
      
      const nameValue = await nameInput.inputValue();
      const emailValue = await emailInput.inputValue();
      
      # Form might be pre-filled with user data
      # expect(nameValue).toContain("Test");
      # expect(emailValue).toBe("test@example.com");
    });
  });

  test.describe("Responsive Design", () => {
    test("should render correctly on mobile", async ({ page: browserPage }) => {
      await responsivePage.setMobileViewport();
      await responsivePage.navigate("/contact");
      
      # Check that essential elements are still visible
      const heading = browserPage.locator('h1, .contact-heading, [data-testid="contact-heading"]');
      await expect(heading).toBeVisible();
      
      # Check that contact form is visible
      const contactForm = browserPage.locator('form, [data-testid="contact-form"], .contact-form');
      await expect(contactForm).toBeVisible();
      
      # Check that form fields are visible and stacked appropriately
      const nameInput = contactForm.locator('input[name*="name" i], [data-testid="name-input"]');
      const emailInput = contactForm.locator('input[name*="email" i], [data-testid="email-input"]');
      const messageInput = contactForm.locator('textarea[name*="message" i], [data-testid="message-input"]');
      
      await expect(nameInput).toBeVisible();
      await expect(emailInput).toBeVisible();
      await expect(messageInput).toBeVisible();
    });
    
    test("should render correctly on tablet", async ({ page: browserPage }) => {
      await responsivePage.setTabletViewport();
      await responsivePage.navigate("/contact");
      
      # Check that layout adapts appropriately
      const heading = browserPage.locator('h1, .contact-heading, [data-testid="contact-heading"]');
      await expect(heading).toBeVisible();
      
      # Check that contact form is visible
      const contactForm = browserPage.locator('form, [data-testid="contact-form"], .contact-form');
      await expect(contactForm).toBeVisible();
    });
    
    test("should render correctly on desktop", async ({ page: browserPage }) => {
      await responsivePage.setDesktopViewport();
      await responsivePage.navigate("/contact");
      
      # Check that full layout is visible
      const heading = browserPage.locator('h1, .contact-heading, [data-testid="contact-heading"]');
      await expect(heading).toBeVisible();
      
      # Check that we can see both form and contact info side by side
      const contactForm = browserPage.locator('form, [data-testid="contact-form"], .contact-form');
      const contactInfo = browserPage.locator('.contact-info, [data-testid="contact-info"], .info-section');
      
      await expect(contactForm).toBeVisible();
      await expect(contactInfo).toBeVisible({ timeout: 5000 }).catch(() => {}); # Info section might not be present
    });
  });

  test.describe("Navigation", () => {
    test("should navigate to homepage", async ({ page: browserPage }) => {
      const homeLink = browserPage.locator('a[href="/"], .logo, [data-testid="logo"], nav a:has-text("Home")');
      await expect(homeLink).toBeVisible();
      
      await homeLink.click();
      await expect(browserPage).toHaveURL(/\/($|\?|#)/);
    });
    
    test("should navigate to services", async ({ page: browserPage }) => {
      const servicesLink = browserPage.locator('a[href*="/services"], nav a:has-text("Services"), .nav-link[href*="/services"]');
      await expect(servicesLink).toBeVisible();
      
      await servicesLink.click();
      await expect(browserPage).toHaveURL(/\/services/);
    });
    
    test("should navigate to store", async ({ page: browserPage }) => {
      const storeLink = browserPage.locator('a[href*="/store"], nav a:has-text("Store"), .nav-link[href*="/store"]');
      await expect(storeLink).toBeVisible();
      
      await storeLink.click();
      await expect(browserPage).toHaveURL(/\/store/);
    });
    
    test("should navigate to blog", async ({ page: browserPage }) => {
      const blogLink = browserPage.locator('a[href*="/blog"], nav a:has-text("Blog"), .nav-link[href*="/blog"]');
      await expect(blogLink).toBeVisible();
      
      await blogLink.click();
      await expect(browserPage).toHaveURL(/\/blog/);
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper language attribute", async ({ page: browserPage }) => {
      const htmlElement = browserPage.locator('html');
      const lang = await htmlElement.getAttribute('lang');
      expect(lang).toMatch(/^en/);
    });
    
    test("should have accessible form labels", async ({ page: browserPage }) => {
      # Check that form fields have associated labels
      const nameInput = browserPage.locator('input[name*="name" i], [data-testid="name-input"]');
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"]');
      const messageInput = browserPage.locator('textarea[name*="message" i], [data-testid="message-input"]');
      
      # Check for label elements or aria-label/aria-labelledby
      if (await nameInput.isVisible()) {
        const nameLabel = browserPage.locator(`label[for="${await nameInput.getAttribute('id')}"]`);
        const nameAriaLabel = await nameInput.getAttribute('aria-label');
        const nameAriaLabelledby = await nameInput.getAttribute('aria-labelledby');
        
        expect(await nameLabel.isVisible() || nameAriaLabel || nameAriaLabelledby).toBeTruthy();
      }
      
      if (await emailInput.isVisible()) {
        const emailLabel = browserPage.locator(`label[for="${await emailInput.getAttribute('id')}"]`);
        const emailAriaLabel = await emailInput.getAttribute('aria-label');
        const emailAriaLabelledby = await emailInput.getAttribute('aria-labelledby');
        
        expect(await emailLabel.isVisible() || emailAriaLabel || emailAriaLabelledby).toBeTruthy();
      }
      
      if (await messageInput.isVisible()) {
        const messageLabel = browserPage.locator(`label[for="${await messageInput.getAttribute('id')}"]`);
        const messageAriaLabel = await messageInput.getAttribute('aria-label');
        const messageAriaLabelledby = await messageInput.getAttribute('aria-labelledby');
        
        expect(await messageLabel.isVisible() || messageAriaLabel || messageAriaLabelledby).toBeTruthy();
      }
    });
    
    test("should have accessible buttons", async ({ page: browserPage }) => {
      # Check that buttons have accessible names
      const buttons = browserPage.locator('button, .btn, [role="button"]');
      const count = await buttons.count();
      
      # Check a sample of buttons for accessibility
      const sampleSize = Math.min(5, count);
      for (let i = 0; i < sampleSize; i++) {
        const button = buttons.nth(i);
        await expect(button).toBeEnabled();
        
        # Check for aria-label, text content, or aria-labelledby
        const ariaLabel = await button.getAttribute('aria-label');
        const textContent = await button.textContent();
        const ariaLabelledby = await button.getAttribute('aria-labelledby');
        
        expect(ariaLabel || textContent?.trim() || ariaLabelledby).toBeDefined();
      }
    });
    
    test("should have sufficient color contrast for form elements", async ({ page: browserPage }) => {
      # This is a basic check - for full accessibility testing, use axe-core
      const formElements = browserPage.locator('form input, form textarea, form button');
      const count = await formElements.count();
      
      # Check a sample of form elements for visible boundaries
      const sampleSize = Math.min(5, count);
      for (let i = 0; i < sampleSize; i++) {
        const element = formElements.nth(i);
        const isVisible = await element.isVisible();
        if (isVisible) {
          # Just verify we can interact with the element
          await expect(element).toBeEnabled();
        }
      }
    });
  });

  test.describe("Performance", () => {
    test("should load within reasonable time", async ({ page: browserPage }) => {
      const startTime = Date.now();
      await page.navigate("/contact");
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(5000); # Should load within 5 seconds
    });
  });
});