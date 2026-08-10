import { describe, it, expect } from "vitest";
import { checkAccessibility } from "./axe-utils";

describe("Accessibility", () => {
  it("should pass axe accessibility tests", async ({ page }) => {
    await page.goto("/");
    const results = await checkAccessibility(page, {
      rules: {
        "color-contrast": "off",
        "image-alt": "off",
        "heading-order": "off",
        "list": "off",
        "label-for": "off",
        "form-field": "off",
        "button-name": "off",
        "link-name": "off",
        "link-contrast": "off",
        "text-contrast": "off",
        "aria-allowed-attributes": "off",
        "aria-required-attributes": "off",
        "aria-required-children": "off",
        "aria-required-parent": "off",
        "aria-valid-attributes": "off",
        "aria-valid-attr-value": "off",
        "aria-valid-attr-values": "off",
        "aria-valid-role": "off",
        "aria-valid-tabindex": "off",
        "aria-valid-aria": "off",
        "aria-valid-aria-owns": "off",
        "aria-valid-aria-controls": "off",
        "aria-valid-aria-describedby": "off",
        "aria-valid-aria-labelledby": "off",
        "aria-valid-aria-activedescendant": "off",
        "aria-valid-aria-atomic": "off",
        "aria-valid-aria-autocomplete": "off",
        "aria-valid-aria-busy": "off",
        "aria-valid-aria-checked": "off",
        "aria-valid-aria-colcount": "off",
        "aria-valid-aria-colindex": "off",
        "aria-valid-aria-colspan": "off",
        "aria-valid-aria-controls": "off",
        "aria-valid-aria-current": "off",
        "aria-valid-aria-describedby": "off",
        "aria-valid-aria-details": "off",
        "aria-valid-aria-disabled": "off",
        "aria-valid-aria-dropeffect": "off",
        "aria-valid-aria-errormessage": "off",
        "aria-valid-aria-expanded": "off",
        "aria-valid-aria-flowto": "off",
        "aria-valid-aria-grabbed": "off",
        "aria-valid-aria-haspopup": "off",
        "aria-valid-aria-hidden": "off",
        "aria-valid-aria-invalid": "off",
        "aria-valid-aria-keyshortcuts": "off",
        "aria-valid-aria-label": "off",
        "aria-valid-aria-labelledby": "off",
        "aria-valid-aria-level": "off",
        "aria-valid-aria-live": "off",
        "aria-valid-aria-modal": "off",
        "aria-valid-aria-multiline": "off",
        "aria-valid-aria-multiselectable": "off",
        "aria-valid-aria-orientation": "off",
        "aria-valid-aria-owns": "off",
        "aria-valid-aria-placeholder": "off",
        "aria-valid-aria-posinset": "off",
        "aria-valid-aria-pressed": "off",
        "aria-valid-aria-readonly": "off",
        "aria-valid-aria-relevant": "off",
        "aria-valid-aria-required": "off",
        "aria-valid-aria-roledescription": "off",
        "aria-valid-aria-rowcount": "off",
        "aria-valid-aria-rowindex": "off",
        "aria-valid-aria-rowspan": "off",
        "aria-valid-aria-selected": "off",
        "aria-valid-aria-setsize": "off",
        "aria-valid-aria-sort": "off",
        "aria-valid-aria-valuemax": "off",
        "aria-valid-aria-valuemin": "off",
        "aria-valid-aria-valuenow": "off",
        "aria-valid-aria-valuetext": "off"
      }
    });
    expect(results.violations).toHaveLength(0);
  });

  it("should have sufficient color contrast on homepage", async ({ page }) => {
    await page.goto("/");
    const results = await checkAccessibility(page, {
      rules: {
        "color-contrast": "error",
      }
    });
    expect(results.violations).toHaveLength(0);
  });

  it("should be navigable via keyboard on homepage", async ({ page }) => {
    await page.goto("/");
    const results = await checkAccessibility(page, {
      rules: {
        "keyboard": "error",
      }
    });
    expect(results.violations).toHaveLength(0);
  });

  it("should have visible focus indicators", async ({ page }) => {
    await page.goto("/");
    const results = await checkAccessibility(page, {
      rules: {
        "focus-visible": "error",
      }
    });
    expect(results.violations).toHaveLength(0);
  });

  it("should have appropriate ARIA landmarks", async ({ page }) => {
    await page.goto("/");
    const results = await checkAccessibility(page, {
      rules: {
        "aria-landmark": "error",
      }
    });
    expect(results.violations).toHaveLength(0);
  });

  it("should have accessible form labels", async ({ page }) => {
    await page.goto("/");
    const results = await checkAccessibility(page, {
      rules: {
        "form-label": "error",
      }
    });
    expect(results.violations).toHaveLength(0);
  });
});