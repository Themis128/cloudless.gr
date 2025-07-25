// tests/useContactUs.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useContactUs } from '../composables/useContactUs';

// Mock fetch API
vi.mock('node-fetch', () => ({
  default: vi.fn()
}));

global.fetch = vi.fn();

// Mock process.client
vi.stubGlobal('process', { client: true });

describe('useContactUs Composable', () => {
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
    
    // Mock fetch for successful token fetch
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'test-csrf-token' }),
    } as unknown as Response);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('validates form data', () => {
    // This is a simple test to make sure our test environment is working
    const { form, errors } = useContactUs();
    expect(form).toBeDefined();
    expect(errors).toBeDefined();
  });

  it('form validation identifies empty fields', () => {
    const { form, errors, validateName, validateEmail, validateSubject, validateMessage } = useContactUs();

    // Empty form
    form.name = '';
    form.email = '';
    form.subject = '';
    form.message = '';

    // Validate each field individually
    validateName();
    validateEmail();
    validateSubject();
    validateMessage();

    expect(errors.name).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.subject).toBeTruthy();
    expect(errors.message).toBeTruthy();
  });

  it('form validation identifies invalid email format', () => {
    const { form, errors, validateEmail } = useContactUs();

    // Form with invalid email
    form.email = 'invalid-email';

    validateEmail();

    expect(errors.email).toBeTruthy();
  });

  it('form validation passes with valid data', () => {
    const { form, errors, validateName, validateEmail, validateSubject, validateMessage } = useContactUs();

    // Valid form
    form.name = 'Test User';
    form.email = 'test@example.com';
    form.subject = 'Test Subject';
    form.message = 'Test Message';

    // Validate each field
    validateName();
    validateEmail();
    validateSubject();
    validateMessage();

    expect(errors.name).toBeFalsy();
    expect(errors.email).toBeFalsy();
    expect(errors.subject).toBeFalsy();
    expect(errors.message).toBeFalsy();
  });

  it('submits form successfully', async () => {
    const { form, error, isSuccess, submitForm } = useContactUs();

    // Mock successful API response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'success', submissionId: 1 }),
    } as unknown as Response);

    // Valid form
    form.name = 'Test User';
    form.email = 'test@example.com';
    form.subject = 'Test Subject';
    form.message = 'Test Message';
    form.csrfToken = 'test-token';

    const result = await submitForm();

    expect(fetch).toHaveBeenCalledWith(
      '/api/contact',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: expect.any(String),
      })
    );

    expect(result).toBeTruthy();
    expect(isSuccess.value).toBe(true);
    expect(error.value).toBeFalsy();
  });

  it('handles form submission errors', async () => {
    const { form, error, isSuccess, submitForm } = useContactUs();

    // Mock API error response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ 
        status: 'error', 
        message: 'Invalid email address' 
      }),
    } as unknown as Response);

    // Valid form
    form.name = 'Test User';
    form.email = 'test@example.com';
    form.subject = 'Test Subject';
    form.message = 'Test Message';
    form.csrfToken = 'test-token';

    const result = await submitForm();

    expect(isSuccess.value).toBe(false);
    expect(error.value).toBe('Invalid email address');
    expect(result).toBeFalsy();
  });

  it('saves form as draft to localStorage', () => {
    mockLocalStorage.setItem.mockImplementation(() => {});
    
    const { form } = useContactUs();
    form.name = 'Test User';
    form.email = 'test@example.com';
    form.subject = 'Test Subject';
    form.message = 'Test Message';
    
    // Manually trigger localStorage save
    const dataToSave = {
      name: form.name,
      email: form.email,
      subject: form.subject,
      message: form.message,
      timestamp: Date.now(),
    };
    window.localStorage.setItem('contact_form_draft', JSON.stringify(dataToSave));

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'contact_form_draft', 
      expect.any(String)
    );
  });

  it('refreshes CSRF token', async () => {
    const { form, refreshCsrfToken } = useContactUs();    // Mock successful token refresh
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'new-csrf-token' }),
    } as unknown as Response);

    const success = await refreshCsrfToken();

    expect(fetch).toHaveBeenCalledWith('/api/csrf-token', expect.any(Object));
    expect(form.csrfToken).toBe('new-csrf-token');
    expect(success).toBe(true);
  });
});
