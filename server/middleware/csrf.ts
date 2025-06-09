import crypto from 'crypto';

interface CSRFOptions {
  cookieName?: string;
  headerName?: string;
  secret?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

export default defineEventHandler(async (event) => {
  // Only apply CSRF protection to specific routes
  const url = getRouterParam(event, 'url') || event.node.req.url || '';

  // Skip CSRF for GET, HEAD, OPTIONS requests and static assets
  if (
    ['GET', 'HEAD', 'OPTIONS'].includes(event.node.req.method || '') ||
    url.startsWith('/_nuxt/') ||
    url.startsWith('/api/_content/') ||
    url.includes('.')
  ) {
    return;
  }

  const options: CSRFOptions = {
    cookieName: 'csrf-token',
    headerName: 'x-csrf-token',
    secret: process.env.CSRF_SECRET || 'default-csrf-secret-change-me',
    httpOnly: false, // Allow JS access for AJAX requests
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  // Generate CSRF token
  const generateToken = (): string => {
    return crypto.randomBytes(32).toString('hex');
  };

  // Verify CSRF token
  const verifyToken = (token: string, cookieToken: string): boolean => {
    return token === cookieToken;
  };

  // Get existing token from cookie
  const existingToken = getCookie(event, options.cookieName!);

  // For POST, PUT, DELETE, PATCH requests, verify token
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(event.node.req.method || '')) {
    const headerToken = getHeader(event, options.headerName!);

    if (!existingToken || !headerToken || !verifyToken(headerToken, existingToken)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'CSRF token mismatch',
      });
    }
  } else {
    // For safe methods, ensure token exists or create one
    if (!existingToken) {
      const newToken = generateToken();
      setCookie(event, options.cookieName!, newToken, {
        httpOnly: options.httpOnly,
        secure: options.secure,
        sameSite: options.sameSite,
        maxAge: 60 * 60 * 24, // 24 hours
      });
    }
  }
});
