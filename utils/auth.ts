// Auth utilities with proper Supabase typing
import type { Profile } from '~/types/project';

// Safe profile query
export async function getProfile(supabaseClient: any, userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data as Profile;
  } catch (error) {
    console.error('Error in getProfile:', error);
    return null;
  }
}

// Safe profile update
export async function updateProfile(
  supabaseClient: any,
  userId: string,
  updates: Partial<Profile>,
): Promise<Profile | null> {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return null;
    }

    return data as Profile;
  } catch (error) {
    console.error('Error in updateProfile:', error);
    return null;
  }
}

// Safe status display for any nullable status
export function isAdminUser(profile: Profile | null): boolean {
  return profile?.role === 'admin' || profile?.is_admin === true;
}

// Check if user is active
export function isActiveUser(profile: Profile | null): boolean {
  return profile?.is_active === true;
}