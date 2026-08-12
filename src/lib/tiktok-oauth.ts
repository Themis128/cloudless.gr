/**
 * Builds a TikTok Business Portal OAuth URL
 * @param appId - Your TikTok Business Portal app ID
 * @param redirectUri - URL to redirect to after authentication
 * @param state - CSRF token or state parameter
 */
export function buildTikTokAuthUrl(appId: string, redirectUri: string, state: string): string {
  const baseUrl = "https://business-api.tiktok.com/portal/auth";

  const params = new URLSearchParams({
    app_id: appId,
    redirect_uri: redirectUri,
    state: state,
    response_type: "code",
    scope: "public_profile,ads_management,ads_read", // Adjust scopes as needed
  });

  return `${baseUrl}?${params.toString()}`;
}
