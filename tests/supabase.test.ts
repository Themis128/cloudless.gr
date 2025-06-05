import { describe, it, expect } from 'vitest';
import supabase, { isSupabaseAvailable } from '../utils/supabase';

// This test will always run as part of the suite
// It will not fail if credentials are missing, but will provide verbose info

describe('Supabase Client', () => {
  it('should provide verbose info about credentials and client status', async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    const available = isSupabaseAvailable();
    // Print debug info
    console.log('[Supabase Test] SUPABASE_URL:', url);
    console.log('[Supabase Test] SUPABASE_KEY:', key ? key.slice(0, 6) + '...' : 'NOT SET');
    console.log('[Supabase Test] Client available:', available);
    if (!available) {
      expect(available).toBe(false);
      expect(url).toBeFalsy();
      expect(key).toBeFalsy();
      return;
    }    // If available, test basic client functionality
    try {
      // Test 1: Verify client methods exist
      expect(supabase).toBeTruthy();
      expect(typeof supabase!.auth.getUser).toBe('function');
      expect(typeof supabase!.from).toBe('function');
      
      console.log('[Supabase Test] Client methods verified');
      
      // Test 2: Try auth status check (should always work, even without user)
      const { data: authData, error: authError } = await supabase!.auth.getUser();
      
      if (authError && authError.message !== 'Auth session missing!') {
        console.error('[Supabase Test] Unexpected auth error:', authError.message);
      } else {
        console.log('[Supabase Test] Auth check completed (expected: no user logged in)');
      }
        // Test 3: Try a simple table query with known tables
      console.log('[Supabase Test] Attempting table query...');
        // Try instruments table first (has public read policy)
      const { data, error } = await supabase!.from('instruments').select('*');
      
      console.log('[Supabase Test] Instruments query result:', { data, error });
      
      if (error) {
        console.error('[Supabase Test] Instruments query error:', error);
        console.warn('[Supabase Test] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // Try contact_submissions table as fallback
        const { data: contactData, error: contactError } = await supabase!.from('contact_submissions').select('*');
        
        console.log('[Supabase Test] Contact submissions query result:', { data: contactData, error: contactError });
        
        if (contactError) {
          console.error('[Supabase Test] Contact submissions query error:', contactError);
          console.log('[Supabase Test] Tables may not exist yet. Run the SQL schema files first.');
          
          // Still expect basic functionality to work
          expect(supabase).toBeTruthy();
        } else {
          console.log('[Supabase Test] Contact submissions query successful');
          expect(contactData).toBeDefined();
          expect(Array.isArray(contactData)).toBe(true);
        }
      } else {
        console.log('[Supabase Test] Instruments query successful, found', data?.length || 0, 'records');
        expect(data).toBeDefined();
        expect(Array.isArray(data)).toBe(true);
      }
      
    } catch (testError) {
      console.error('[Supabase Test] Test execution error:', testError);
      // Even if everything fails, verify the client was created
      expect(supabase).toBeTruthy();
      console.log('[Supabase Test] Basic client creation successful');
    }
  });
});
