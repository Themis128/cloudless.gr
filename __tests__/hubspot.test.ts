import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as hubspot from '../src/lib/hubspot';
import { resetIntegrationCache } from '../src/lib/integrations';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

describe('hubspot.ts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetIntegrationCache();
    mockFetch.mockReset();
    process.env.HUBSPOT_API_KEY = 'test-token';
  });

  it('should upsert a contact (create)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new-id' }) });
    const id = await hubspot.upsertContact({ email: 'a@b.com', firstname: 'A' });
    expect(id).toBe('new-id');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should upsert a contact (update)', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ id: 'cid' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const id = await hubspot.upsertContact({ email: 'a@b.com', firstname: 'A' });
    expect(id).toBe('cid');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should create a ticket and associate contact', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'tid' }) });
    const result = await hubspot.createTicket({ subject: 'Test', content: 'Hello' }, 'cid');
    expect(result?.id).toBe('tid');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should list contacts', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [
      { id: 'cid', properties: { email: 'a@b.com', firstname: 'A', lastname: 'B', company: 'C' } }
    ] }) });
    const contacts = await hubspot.listContacts(1);
    const first = contacts[0] as { properties: Record<string, string> };
    expect(first.properties.email).toBe('a@b.com');
    expect(first.properties.firstname).toBe('A');
  });

  it('listContacts clamps limit to 100 max', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
    await hubspot.listContacts(999);
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain('limit=100');
  });

  it('listContacts clamps limit to 1 min', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
    await hubspot.listContacts(-5);
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain('limit=1');
  });

  it('listContacts uses default 10 for NaN', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
    await hubspot.listContacts(Number.NaN);
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain('limit=10');
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ message: 'fail' }) });
    const id = await hubspot.upsertContact({ email: 'fail@b.com' });
    expect(id).toBeNull();
  });

  it('should detect config when HubSpot credentials exist', async () => {
    expect(await hubspot.isHubSpotConfigured()).toBe(true);
  });
});

describe('setNewsletterStatus()', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetIntegrationCache();
    mockFetch.mockReset();
    process.env.HUBSPOT_API_KEY = 'test-token';
  });

  it('patches lead_source when contact already exists', async () => {
    // search returns existing contact
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ id: 'cid-1' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const ok = await hubspot.setNewsletterStatus('a@b.com', 'newsletter_signup');
    expect(ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [patchUrl, patchInit] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(patchUrl).toContain('cid-1');
    expect(JSON.parse(patchInit.body as string).properties.lead_source).toBe('newsletter_signup');
  });

  it('creates a new contact for newsletter_signup when email not found', async () => {
    // search returns empty, create succeeds
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new-id' }) });
    const ok = await hubspot.setNewsletterStatus('new@b.com', 'newsletter_signup');
    expect(ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [, createInit] = mockFetch.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(createInit.body as string);
    expect(body.properties.lifecyclestage).toBe('subscriber');
    expect(body.properties.lead_source).toBe('newsletter_signup');
  });

  it('returns true (no-op) when unsubscribing an email not in HubSpot', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
    const ok = await hubspot.setNewsletterStatus('ghost@b.com', 'newsletter_unsubscribed');
    expect(ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns false when the API call fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    const ok = await hubspot.setNewsletterStatus('a@b.com', 'newsletter_signup');
    expect(ok).toBe(false);
  });
});

describe('listNewsletterSubscribers()', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetIntegrationCache();
    mockFetch.mockReset();
    process.env.HUBSPOT_API_KEY = 'test-token';
  });

  it('returns email addresses of all newsletter_signup contacts', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { properties: { email: 'a@b.com' } },
          { properties: { email: 'c@d.com' } },
        ],
        paging: undefined,
      }),
    });
    const emails = await hubspot.listNewsletterSubscribers();
    expect(emails).toEqual(['a@b.com', 'c@d.com']);
  });

  it('paginates through multiple pages', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ properties: { email: 'p1@b.com' } }],
          paging: { next: { after: 'cursor-2' } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ properties: { email: 'p2@b.com' } }],
          paging: undefined,
        }),
      });
    const emails = await hubspot.listNewsletterSubscribers();
    expect(emails).toContain('p1@b.com');
    expect(emails).toContain('p2@b.com');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns empty array when the API returns an error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    const emails = await hubspot.listNewsletterSubscribers();
    expect(emails).toEqual([]);
  });

  it('deduplicates email addresses returned across pages', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ properties: { email: 'dup@b.com' } }],
          paging: { next: { after: 'cursor-2' } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ properties: { email: 'dup@b.com' } }],
          paging: undefined,
        }),
      });
    const emails = await hubspot.listNewsletterSubscribers();
    expect(emails.filter((e) => e === 'dup@b.com')).toHaveLength(1);
  });
});
