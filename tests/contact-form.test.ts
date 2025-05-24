// tests/contact-form.test.ts
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import Contact from '../components/Layout/Contact.vue';

// Mock the useContactUs composable
vi.mock('../composables/useContactUs', () => ({
  useContactUs: () => ({
    form: {
      name: '',
      email: '',
      subject: '',
      message: '',
      csrfToken: 'mock-token'
    },
    errors: {
      name: '',
      email: '',
      subject: '',
      message: ''
    },
    isSubmitting: false,
    isSuccess: false,
    error: null,
    validateName: vi.fn(),
    validateEmail: vi.fn(),
    validateSubject: vi.fn(),
    validateMessage: vi.fn(),
    submitForm: vi.fn(),
    refreshCsrfToken: vi.fn(),
    saveFormDraft: vi.fn(),
    loadSavedForm: vi.fn(),
  })
}));

describe('Contact Form Component', () => {
  // Create localStorage mock
  const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  beforeEach(() => {
    // Setup localStorage mock
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders the form correctly', () => {
    const wrapper = mount(Contact, { shallow: true });
    expect(wrapper.find('form').exists()).toBe(true);
    expect(wrapper.find('[data-cy="input-name"]').exists()).toBe(true);
    expect(wrapper.find('[data-cy="input-email"]').exists()).toBe(true);
    expect(wrapper.find('[data-cy="input-subject"]').exists()).toBe(true);
    expect(wrapper.find('[data-cy="input-message"]').exists()).toBe(true);
  });

  it('contains a honeypot field for spam prevention', () => {
    const wrapper = mount(Contact, { shallow: true });
    const honeypotField = wrapper.find('[data-cy="honeypot-field"]');
    expect(honeypotField.exists()).toBe(true);
    expect(honeypotField.attributes('aria-hidden')).toBe('true');
  });

  it('shows error messages when validation fails', async () => {
    const wrapper = mount(Contact, { shallow: true });
    
    // Simulate validation errors
    await wrapper.setData({
      errors: {
        name: 'Name is required',
        email: 'Valid email is required'
      }
    });
    
    await nextTick();
    
    expect(wrapper.find('[data-cy="error-name"]').exists()).toBe(true);
    expect(wrapper.find('[data-cy="error-email"]').exists()).toBe(true);
  });

  it('shows a success message after successful submission', async () => {
    const wrapper = mount(Contact, { shallow: true });
    
    // Simulate form submission success
    await wrapper.setData({ formSuccess: true });
    await nextTick();
    
    expect(wrapper.find('[data-cy="success-message"]').exists()).toBe(true);
  });
});
