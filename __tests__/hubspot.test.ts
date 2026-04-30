import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as hubspot from '../src/lib/hubspot';
import { resetIntegrationCache } from '../src/lib/integrations';

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

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
    expect((contacts[0] as any).properties.email).toBe('a@b.com');
    expect((contacts[0] as any).properties.firstname).toBe('A');
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
    await hubspot.listContacts(NaN);
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
