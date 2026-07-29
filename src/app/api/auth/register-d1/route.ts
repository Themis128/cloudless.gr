/**
 * Alias for POST /api/auth/register (D1 `user` table via auth-d1).
 * Kept so older clients / e2e that hit /api/auth/register-d1 keep working.
 */
export { POST } from "@/app/api/auth/register/route";
