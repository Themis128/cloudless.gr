import { describe, it, expect } from 'vitest';
import { locales, defaultLocale, isSupportedLocale, type Locale } from '@/lib/i18n';

describe('i18n utilities', () => {
  it('should export supported locales', () => {
    expect(locales).toEqual(['en', 'el', 'fr']);
  });

  it('should have en as default locale', () => {
    expect(defaultLocale).toBe('en');
  });

  it('should validate supported locales', () => {
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('el')).toBe(true);
    expect(isSupportedLocale('fr')).toBe(true);
  });

  it('should reject unsupported locales', () => {
    expect(isSupportedLocale('es')).toBe(false);
    expect(isSupportedLocale('de')).toBe(false);
    expect(isSupportedLocale('invalid')).toBe(false);
    expect(isSupportedLocale('')).toBe(false);
  });

  it('should type-check locale values', () => {
    const validLocale: Locale = 'en';
    const anotherValid: Locale = 'el';
    const another: Locale = 'fr';
    
    expect(validLocale).toBeDefined();
    expect(anotherValid).toBeDefined();
    expect(another).toBeDefined();
  });

  it('should have consistent locale definitions', () => {
    locales.forEach((locale) => {
      expect(isSupportedLocale(locale)).toBe(true);
    });
  });
});
