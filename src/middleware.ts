// Re-export proxy.ts as the Next.js middleware entry point.
// proxy.ts owns the full request pipeline: HTTPS enforcement, CORS,
// security headers, rate-limiting, Cognito auth guard, and next-intl
// locale routing. It was decoupled from this file to avoid a naming
// conflict introduced in the Next.js 16 upgrade cycle; this shim
// restores the hook.
export { proxy as middleware, config } from "./proxy";
