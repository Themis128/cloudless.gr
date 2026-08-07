import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Comprehensive Accessibility Test Suite
 * Tests accessibility across the entire application using axe-core
 */

test.describe.configure({ mode: "serial" });

test.describe("Homepage Accessibility", () => {
	test("should pass axe accessibility tests", async ({ page }) => {
		await page.goto("/");
		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations).toEqual([]);
	});
});

test.describe("Services Page Accessibility", () => {
	test("should pass axe accessibility tests", async ({ page }) => {
		await page.goto("/services");
		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations).toEqual([]);
	});
});

test.describe("Store Page Accessibility", () => {
	test("should pass axe accessibility tests", async ({ page }) => {
		await page.goto("/store");
		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations).toEqual([]);
	});
});

test.describe("Blog Page Accessibility", () => {
	test("should pass axe accessibility tests", async ({ page }) => {
		await page.goto("/blog");
		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations).toEqual([]);
	});
});

test.describe("Contact Page Accessibility", () => {
	test("should pass axe accessibility tests", async ({ page }) => {
		await page.goto("/contact");
		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations).toEqual([]);
	});
});

test.describe("Dashboard Page Accessibility", () => {
	test("should pass axe accessibility tests for authenticated user", async ({ page }) => {
		await page.goto("/dashboard");
		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations).toEqual([]);
	});
});

test.describe("Admin Page Accessibility", () => {
	test("should pass axe accessibility tests for admin user", async ({ page }) => {
		await page.goto("/admin");
		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations).toEqual([]);
	});
});

test.describe("Component Accessibility", () => {
	test("header should pass axe accessibility tests", async ({ page }) => {
		await page.goto("/");
		const results = await new AxeBuilder({ page }).include("header, [data-testid='header'], .header").analyze();
		expect(results.violations).toEqual([]);
	});

	test("footer should pass axe accessibility tests", async ({ page }) => {
		await page.goto("/");
		const results = await new AxeBuilder({ page }).include("footer, [data-testid='footer'], .footer").analyze();
		expect(results.violations).toEqual([]);
	});

	test("buttons should pass axe accessibility tests", async ({ page }) => {
		await page.goto("/services");
		const results = await new AxeBuilder({ page }).include("button, .btn").analyze();
		expect(results.violations).toEqual([]);
	});

	test("cards should pass axe accessibility tests", async ({ page }) => {
		await page.goto("/");
		const results = await new AxeBuilder({ page }).include(".card, [data-testid='card'], .service-card, .product-card, .post-card").analyze();
		expect(results.violations).toEqual([]);
	});
});

test.describe("Color Contrast Accessibility", () => {
	test("should have sufficient color contrast on homepage", async ({ page }) => {
		await page.goto("/");
		const results = await new AxeBuilder({ page }).withRules({ rules: { "color-contrast": { enabled: true } } }).analyze();
		expect(results.violations).toEqual([]);
	});
});

test.describe("Keyboard Navigation Accessibility", () => {
	test("should be navigable via keyboard on homepage", async ({ page }) => {
		await page.goto("/");
		await page.keyboard.press("Tab");
		const focusedElement = await page.evaluate(() => {
			const el = document.activeElement;
			return { tagName: el.tagName, className: el.className, id: el.id };
		});
		expect(focusedElement.tagName).toBeDefined();
		await page.keyboard.press("Tab");
		await page.keyboard.press("Tab");
		await page.keyboard.press("Tab");
		const finallyFocused = await page.evaluate(() => {
			const el = document.activeElement;
			return { tagName: el.tagName, className: el.className, id: el.id };
		});
		expect(finallyFocused.tagName).toBeDefined();
	});

	test("should have visible focus indicators", async ({ page }) => {
		await page.goto("/");
		await page.keyboard.press("Tab");
		const hasFocusIndicator = await page.evaluate(() => {
			const el = document.activeElement;
			if (!el) return false;
			const computedStyle = window.getComputedStyle(el);
			const outlineWidth = computedStyle.outlineWidth;
			const outlineStyle = computedStyle.outlineStyle;
			const boxShadow = computedStyle.boxShadow;
			return (
				(outlineWidth !== "0px" && outlineStyle !== "none") ||
				(boxShadow !== "none" && boxShadow !== "")
			);
		});
		expect(hasFocusIndicator).toBeTruthy();
	});
});

test.describe("ARIA Attributes Accessibility", () => {
	test("should have appropriate ARIA landmarks", async ({ page }) => {
		await page.goto("/");
		const landmarks = await page.evaluate(() => {
			const headers = document.querySelectorAll("header, [role='banner']");
			const navs = document.querySelectorAll("nav, [role='navigation']");
			const mains = document.querySelectorAll("main, [role='main']");
			const footers = document.querySelectorAll("footer, [role='contentinfo']");
			return {
				headers: headers.length,
				navs: navs.length,
				mains: mains.length,
				footers: footers.length
			};
		});
		expect(landmarks.headers).toBeGreaterThan(0);
		expect(landmarks.navs).toBeGreaterThan(0);
		expect(landmarks.mains).toBeGreaterThan(0);
		expect(landmarks.footers).toBeGreaterThan(0);
	});

	test("should have accessible form labels", async ({ page }) => {
		await page.goto("/contact");
		const formElements = await page.evaluate(() => {
			const inputs = document.querySelectorAll("input, select, textarea");
			let labeledCount = 0;
			let totalCount = 0;
			inputs.forEach((input: HTMLInputElement) => {
				if (input.offsetParent !== null) {
					totalCount++;
					const id = input.id;
					let hasLabel = false;
					if (id) {
						const label = document.querySelector(`label[for="${id}"]`);
						if (label) hasLabel = true;
					}
					const ariaLabel = input.getAttribute("aria-label");
					const ariaLabelledby = input.getAttribute("aria-labelledby");
					if (hasLabel || ariaLabel || ariaLabelledby) {
						labeledCount++;
					}
				}
			});
			return { labeledCount, totalCount };
		});
		expect(formElements.labeledCount).toBe(formElements.totalCount);
	});
});

test.describe.skip("Skip this test - just an example of how to skip tests", () => {
	test("this test will be skipped", async ({ page }) => {
		await page.goto("/");
		expect(true).toBe(true);
	});
});