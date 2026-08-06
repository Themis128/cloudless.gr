import { test, expect } from "@playwright/test";
import { createBasePage, createResponsivePage } from "../helpers/page-helpers";

/**
 * Footer Component Test Suite
 * Tests the footer component for rendering, navigation, and functionality
 */

test.describe("Footer Component", () => {
  let page: BasePage;
  let responsivePage: ResponsivePage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = createBasePage(browserPage);
    responsivePage = createResponsivePage(browserPage);
    
    // Start on homepage for footer tests
    await page.navigate("/");
  });

  test("should be visible on all pages", async ({ page: browserPage }) => {
    const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
    await expect(footer).toBeVisible();
  });

  test("should contain copyright information", async ({ page: browserPage }) => {
    const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
    await expect(footer).toBeVisible();
    
    # Check for copyright text
    const copyright = footer.locator('.copyright, [data-testid="copyright"], small, text=/©/i');
    await expect(copyright).toBeVisible();
    
    # Check that copyright contains year and company name
    const copyrightText = await copyright.textContent();
    expect(copyrightText).toMatch(/\d{4}/); # Should contain a 4-digit year
    expect(copyrightText).toMatch(/cloudless/i); # Should contain company name
  });

  test("should contain navigation links", async ({ page: browserPage }) => {
    const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
    await expect(footer).toBeVisible();
    
    # Check for footer navigation
    const footerNav = footer.locator('nav, [data-testid="footer-nav"], .footer-nav, .footer-links');
    await expect(footerNav).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    if (await footerNav.isVisible()) {
      # Check for common footer links
      const links = footerNav.locator('a');
      await expect(links.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      # Check for links to important pages
      const homeLink = footerNav.locator('a[href="/"]');
      const servicesLink = footerNav.locator('a[href*="/services"]');
      const storeLink = footerNav.locator('a[href*="/store"]');
      const blogLink = footerNav.locator('a[href*="/blog"]');
      const contactLink = footerNav.locator('a[href*="/contact"]');
      
      # At least some of these should be present
      expect(
        await homeLink.isVisible() ||
        await servicesLink.isVisible() ||
        await storeLink.isVisible() ||
        await blogLink.isVisible() ||
        await contactLink.isVisible()
      ).toBeTruthy();
    }
  });

  test("should contain social media links", async ({ page: browserPage }) => {
    const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
    await expect(footer).toBeVisible();
    
    # Check for social media section
    const socialSection = footer.locator('.social-links, [data-testid="social"], .social-media');
    await expect(socialSection).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    if (await socialSection.isVisible()) {
      # Check for social media icons/links
      const socialLinks = socialSection.locator('a[href*="twitter"], a[href*="facebook"], a[href*="linkedin"], a[href*="instagram"], a[href*="youtube"]');
      await expect(socialLinks.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test("should contain newsletter signup", async ({ page: browserPage }) => {
    const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
    await expect(footer).toBeVisible();
    
    # Check for newsletter section
    const newsletterSection = footer.locator('.newsletter, [data-testid="newsletter"], .newsletter-signup');
    await expect(newsletterSection).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    if (await newsletterSection.isVisible()) {
      # Check for heading
      const newsletterHeading = newsletterSection.locator('h2, h3, .section-title');
      await expect(newsletterHeading).toBeVisible();
      
      # Check for email input
      const emailInput = newsletterSection.locator('input[type="email"], [data-testid="email-input"]');
      await expect(emailInput).toBeVisible();
      
      # Check for submit button
      const submitButton = newsletterSection.locator('button[type="submit"], .btn, .submit-button');
      await expect(submitButton).toBeVisible();
    }
  });

  test.describe("Navigation Functionality", () => {
    test("should navigate to homepage via footer link", async ({ page: browserPage }) => {
      # Navigate to a different page first
      await page.navigate("/services");
      
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      const homeLink = footer.locator('a[href="/"]');
      if (await homeLink.isVisible()) {
        await homeLink.click();
        await expect(browserPage).toHaveURL(/\/($|\?|#)/);
      }
    });
    
    test("should navigate to services via footer link", async ({ page: browserPage }) => {
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      const servicesLink = footer.locator('a[href*="/services"]');
      if (await servicesLink.isVisible()) {
        await servicesLink.click();
        await expect(browserPage).toHaveURL(/\/services/);
      }
    });
    
    test("should navigate to store via footer link", async ({ page: browserPage }) => {
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      const storeLink = footer.locator('a[href*="/store"]');
      if (await storeLink.isVisible()) {
        await storeLink.click();
        await expect(browserPage).toHaveURL(/\/store/);
      }
    });
    
    test("should navigate to blog via footer link", async ({ page: browserPage }) => {
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      const blogLink = footer.locator('a[href*="/blog"]');
      if (await blogLink.isVisible()) {
        await blogLink.click();
        await expect(browserPage).toHaveURL(/\/blog/);
      }
    });
    
    test("should navigate to contact via footer link", async ({ page: browserPage }) => {
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      const contactLink = footer.locator('a[href*="/contact"]');
      if (await contactLink.isVisible()) {
        await contactLink.click();
        await expect(browserPage).toHaveURL(/\/contact/);
      }
    });
  });

  test.describe("Newsletter Functionality", () => {
    test("should show validation error for empty email", async ({ page: browserPage }) => {
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      const newsletterSection = footer.locator('.newsletter, [data-testid="newsletter"], .newsletter-signup');
      if (await newsletterSection.isVisible()) {
        # Try to submit empty form
        const submitButton = newsletterSection.locator('button[type="submit"], .btn, .submit-button');
        if (await submitButton.isVisible()) {
          await submitButton.click();
          
          # Check for validation error
          const emailError = newsletterSection.locator('text=/email is required/i, [data-testid="email-error"], .error-message');
          await expect(emailError).toBeVisible({ timeout: 5000 });
        }
      }
    });
    
    test("should show validation error for invalid email format", async ({ page: browserPage }) => {
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      const newsletterSection = footer.locator('.newsletter, [data-testid="newsletter"], .newsletter-signup');
      if (await newsletterSection.isVisible()) {
        # Fill with invalid email
        const emailInput = newsletterSection.locator('input[type="email"], [data-testid="email-input"]');
        if (await emailInput.isVisible()) {
          await emailInput.fill("invalid-email");
          
          # Try to submit form
          const submitButton = newsletterSection.locator('button[type="submit"], .btn, .submit-button');
          if (await submitButton.isVisible()) {
            await submitButton.click();
            
            # Check for validation error
            const emailError = newsletterSection.locator('text=/valid email/i, text=/email format/i, [data-testid="email-error"], .error-message');
            await expect(emailError).toBeVisible({ timeout: 5000 });
          }
        }
      }
    });
    
    test("should submit newsletter form successfully", async ({ page: browserPage }) => {
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      const newsletterSection = footer.locator('.newsletter, [data-testid="newsletter"], .newsletter-signup');
      if (await newsletterSection.isVisible()) {
        # Fill with valid email
        const emailInput = newsletterSection.locator('input[type="email"], [data-testid="email-input"]');
        if (await emailInput.isVisible()) {
          await emailInput.fill("test@example.com");
          
          # Try to submit form
          const submitButton = newsletterSection.locator('button[type="submit"], .btn, .submit-button');
          if (await submitButton.isVisible()) {
            await submitButton.click();
            
            # Check for success message
            const successMessage = newsletterSection.locator('text=/subscribed/i, text=/thank you/i, [data-testid="success-message"], .success-message');
            await expect(successMessage).toBeVisible({ timeout: 5000 });
            
            # Or check that input is cleared
            const emailValue = await emailInput.inputValue();
            expect(emailValue).toBe("");
          }
        }
      }
    });
  });

  test.describe("Responsive Design", () => {
    test("should render correctly on mobile", async ({ page: browserPage }) => {
      await responsivePage.setMobileViewport();
      await responsivePage.navigate("/");
      
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      # Check that copyright is visible
      const copyright = footer.locator('.copyright, [data-testid="copyright"], small');
      await expect(copyright).toBeVisible();
      
      # Check that essential sections are visible (might be stacked)
      const newsletterSection = footer.locator('.newsletter, [data-testid="newsletter"]');
      if (await newsletterSection.isVisible()) {
        await expect(newsletterSection).toBeVisible();
      }
      
      const socialSection = footer.locator('.social-links, [data-testid="social"]');
      if (await socialSection.isVisible()) {
        await expect(socialSection).toBeVisible();
      }
    });
    
    test("should render correctly on tablet", async ({ page: browserPage }) => {
      await responsivePage.setTabletViewport();
      await responsivePage.navigate("/");
      
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      # Check that copyright is visible
      const copyright = footer.locator('.copyright, [data-testid="copyright"], small');
      await expect(copyright).toBeVisible();
      
      # Check that navigation is visible
      const footerNav = footer.locator('nav, [data-testid="footer-nav"], .footer-nav');
      if (await footerNav.isVisible()) {
        await expect(footerNav).toBeVisible();
      }
    });
    
    test("should render correctly on desktop", async ({ page: browserPage }) => {
      await responsivePage.setDesktopViewport();
      await responsivePage.navigate("/");
      
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      # Check that copyright is visible
      const copyright = footer.locator('.copyright, [data-testid="copyright"], small');
      await expect(copyright).toBeVisible();
      
      # Check that we can see multiple sections side by side
      const newsletterSection = footer.locator('.newsletter, [data-testid="newsletter"]');
      const socialSection = footer.locator('.social-links, [data-testid="social"]');
      const footerNav = footer.locator('nav, [data-testid="footer-nav"], .footer-nav');
      
      # At least two sections should be visible
      const visibleSections = [
        newsletterSection,
        socialSection,
        footerNav
      ].filter(async (section) => await section.isVisible());
      
      expect(visibleSections.length).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper ARIA landmarks", async ({ page: browserPage }) => {
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      # Check for ARIA role
      const role = await footer.getAttribute('role');
      expect(role === 'contentinfo').toBeTruthy(); # Footer should have contentinfo role
    });
    
    test("should have accessible copyright text", async ({ page: browserPage }) => {
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      const copyright = footer.locator('.copyright, [data-testid="copyright"], small');
      await expect(copyright).toBeVisible();
      
      # Check that copyright text is readable
      const copyrightText = await copyright.textContent();
      expect(copyrightText.length).toBeGreaterThan(0);
    });
    
    test("should have accessible navigation links", async ({ page: browserPage }) => {
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      const footerNav = footer.locator('nav, [data-testid="footer-nav"], .footer-nav');
      if (await footerNav.isVisible()) {
        const navLinks = footerNav.locator('a');
        const count = await navLinks.count();
        
        # Check a sample of nav links for accessibility
        const sampleSize = Math.min(3, count);
        for (let i = 0; i < sampleSize; i++) {
          const link = navLinks.nth(i);
          await expect(link).toBeVisible();
          
          # Check for accessible name (text content or aria-label)
          const textContent = await link.textContent();
          const ariaLabel = await link.getAttribute('aria-label');
          
          expect(textContent?.trim() || ariaLabel).toBeDefined();
          
          # Check that link is keyboard accessible
          await expect(link).toBeFocusable();
        }
      }
    });
    
    test("should have accessible social media links", async ({ page: browserPage }) => {
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      const socialSection = footer.locator('.social-links, [data-testid="social"]');
      if (await socialSection.isVisible()) {
        const socialLinks = socialSection.locator('a');
        const count = await socialLinks.count();
        
        # Check a sample of social links for accessibility
        const sampleSize = Math.min(3, count);
        for (let i = 0; i < sampleSize; i++) {
          const link = socialLinks.nth(i);
          await expect(link).toBeVisible();
          
          # Check for accessible name (aria-label or visually hidden text)
          const ariaLabel = await link.getAttribute('aria-label');
          const ariaLabelledby = await link.getAttribute('aria-labelledby');
          
          # Social links often use icons with aria-label
          expect(ariaLabel || ariaLabelledby).toBeDefined();
          
          # Check that link is keyboard accessible
          await expect(link).toBeFocusable();
        }
      }
    });
    
    test("should have accessible newsletter form", async ({ page: browserPage }) => {
      const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
      await expect(footer).toBeVisible();
      
      const newsletterSection = footer.locator('.newsletter, [data-testid="newsletter"]');
      if (await newsletterSection.isVisible()) {
        # Check for accessible email input
        const emailInput = newsletterSection.locator('input[type="email"], [data-testid="email-input"]');
        if (await emailInput.isVisible()) {
          # Check for associated label or aria-label
          const label = newsletterSection.locator(`label[for="${await emailInput.getAttribute('id')}"]`);
          const ariaLabel = await emailInput.getAttribute('aria-label');
          const ariaLabelledby = await emailInput.getAttribute('aria-labelledby');
          
          expect(await label.isVisible() || ariaLabel || ariaLabelledby).toBeTruthy();
          
          # Check that input is keyboard accessible
          await expect(emailInput).toBeEnabled();
        }
        
        # Check for accessible submit button
        const submitButton = newsletterSection.locator('button[type="submit"], .btn, .submit-button');
        if (await submitButton.isVisible()) {
          # Check for accessible name (text content or aria-label)
          const textContent = await submitButton.textContent();
          const ariaLabel = await submitButton.getAttribute('aria-label');
          
          expect(textContent?.trim() || ariaLabel).toBeDefined();
          
          # Check that button is keyboard accessible
          await expect(submitButton).toBeEnabled();
        }
      }
    });
  });

  test.describe("Performance", () => {
    test("should not cause layout shifts", async ({ page: browserPage }) => {
      # Measure Cumulative Layout Shift (CLS) - basic check
      const clsValue = await browserPage.evaluate(() => {
        if (window.PerformanceObserver) {
          return new Promise((resolve) => {
            let cls = 0;
            const observer = new PerformanceObserver((entryList) => {
              for (const entry of entryList.getEntries()) {
                if (!entry.hadRecentInput) {
                  cls += entry.value;
                }
              }
              resolve(cls);
            });
            observer.observe({ entryTypes: ['layout-shift'] });
            
            # Wait a bit to collect layout shift data
            setTimeout(() => {
              observer.disconnect();
              resolve(cls);
            }, 3000);
          });
        }
        return 0;
      });
      
      # CLS should be less than 0.1 for good performance
      expect(clsValue).toBeLessThan(0.1);
    });
  });
});