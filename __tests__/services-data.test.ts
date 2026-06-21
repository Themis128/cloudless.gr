import { describe, it, expect } from "vitest";
import { getServices, getServicesFaqs, bundleTerminal, colorMap } from "@/lib/services-data";

// Pass-through translator — services-data takes a (key, fallback) function
// so it can be locale-aware without importing next-intl.
const tPass = (_key: string, fallback: string) => fallback;

describe("services-data", () => {
  describe("getServices", () => {
    it("returns 6 services in stable order", () => {
      const services = getServices(tPass);
      expect(services).toHaveLength(6);
      expect(services.map((s) => s.num)).toEqual(["01", "02", "03", "04", "05", "06"]);
    });

    it("every service exposes the contract the page renders against", () => {
      const services = getServices(tPass);
      for (const s of services) {
        expect(s).toMatchObject({
          tag: expect.any(String),
          num: expect.any(String),
          title: expect.any(String),
          price: expect.any(String),
          unit: expect.any(String),
          color: expect.any(String),
          planKey: expect.any(String),
          outcome: expect.any(String),
          perfectFor: expect.any(String),
          description: expect.any(String),
        });
        expect(Array.isArray(s.features)).toBe(true);
        expect(s.features.length).toBeGreaterThan(0);
        expect(Array.isArray(s.stats)).toBe(true);
        expect(s.stats.length).toBeGreaterThan(0);
        expect(Array.isArray(s.terminal)).toBe(true);
        expect(s.terminal.length).toBeGreaterThan(0);
      }
    });

    it("every service.color has a matching entry in colorMap", () => {
      const services = getServices(tPass);
      for (const s of services) {
        expect(colorMap[s.color]).toBeDefined();
        expect(typeof colorMap[s.color].badge).toBe("string");
      }
    });

    it("planKeys are unique across services", () => {
      const services = getServices(tPass);
      const keys = services.map((s) => s.planKey);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("stats entries have value + label", () => {
      const services = getServices(tPass);
      for (const s of services) {
        for (const stat of s.stats) {
          expect(stat.value).toBeTruthy();
          expect(stat.label).toBeTruthy();
        }
      }
    });

    it("passes the translator through — non-trivial t() output flows into title", () => {
      const tag = (key: string) => `[T:${key}]`;
      const services = getServices((key, _fallback) => tag(key));
      // service1Title should now be tagged with its translation key.
      expect(services[0].title).toBe("[T:servicesSection.service1Title]");
    });
  });

  describe("getServicesFaqs", () => {
    it("returns a non-empty list with question + answer shape", () => {
      const faqs = getServicesFaqs(tPass);
      expect(faqs.length).toBeGreaterThan(0);
      for (const f of faqs) {
        expect(f.question).toBeTruthy();
        expect(f.answer).toBeTruthy();
      }
    });
  });

  describe("bundleTerminal", () => {
    it("is a non-empty string array (the homepage's terminal animation source)", () => {
      expect(Array.isArray(bundleTerminal)).toBe(true);
      expect(bundleTerminal.length).toBeGreaterThan(0);
      for (const line of bundleTerminal) {
        expect(typeof line).toBe("string");
      }
    });
  });

  describe("colorMap", () => {
    it("each color theme defines every Tailwind slot the renderer uses", () => {
      const requiredSlots = [
        "badge",
        "dot",
        "tag",
        "stat",
        "statValue",
        "check",
        "num",
        "price",
        "link",
      ] as const;
      for (const theme of Object.values(colorMap)) {
        for (const slot of requiredSlots) {
          expect(theme).toHaveProperty(slot);
          expect(typeof (theme as Record<string, string>)[slot]).toBe("string");
        }
      }
    });
  });
});
