import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as hubspot from '../src/lib/hubspot';

global.fetch = vi.fn();

describe('hubspot.ts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.HUBSPOT_PRIVATE_APP_TOKEN = 'test-token';
    process.env.HUBSPOT_ACCESS_TOKEN = '';
  });

  it('should upsert a contact (create)', async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new-id' }) });
    const id = await hubspot.upsertContact({ email: 'a@b.com', firstname: 'A' });
    expect(id).toBe('new-id');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should upsert a contact (update)', async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ id: 'cid' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const id = await hubspot.upsertContact({ email: 'a@b.com', firstname: 'A' });
    expect(id).toBe('cid');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should create a ticket and associate contact', async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'tid' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const id = await hubspot.createTicket({ subject: 'Test', contactId: 'cid' });
    expect(id).toBe('tid');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should list contacts', async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [
        { properties: { email: 'a@b.com', firstname: 'A', lastname: 'B', company: 'C' } }
      ] }) });
    const contacts = await hubspot.listContacts(1);
    expect(contacts[0].email).toBe('a@b.com');
    expect(contacts[0].firstname).toBe('A');
  });

  it('should handle API errors gracefully', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: false, text: async () => 'fail' });
    const id = await hubspot.upsertContact({ email: 'fail@b.com' });
    expect(id).toBeNull();
  });

  it('should detect config', async () => {
    expect(await hubspot.isHubSpotConfigured()).toBe(true);
    process.env.HUBSPOT_PRIVATE_APP_TOKEN = '';
    expect(await hubspot.isHubSpotConfigured()).toBe(false);
  });
});
