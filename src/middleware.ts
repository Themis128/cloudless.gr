/**
 * Next.js 15.x middleware entry point.
 *
 * Next.js 15 only recognises `middleware.ts` as the edge middleware file.
 * The actual logic lives in `src/proxy.ts` (the Next.js 16 canonical name).
 * This file re-exports it so the proxy runs under Next.js 15.5.x.
 *
 * When upgrading to Next.js 16, delete this file — `proxy.ts` is canonical
 * and Next.js 16 forbids both files coexisting.
 */
export { proxy as default, config } from "@/proxy";
