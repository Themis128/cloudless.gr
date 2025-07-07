/**
 * Utility function to get user role using server API to avoid RLS issues
 */
export async function getUserRole(): Promise<string | null> {
  try {
    if (!process.client) return null;
    
    const baseUrl = window.location.origin;
    const response = await fetch(`${baseUrl}/api/auth/get-user-role`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.warn('Failed to fetch user role:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.role || 'user';
  } catch (error) {
    console.error('Error fetching user role:', error);
    return null;
  }
}
