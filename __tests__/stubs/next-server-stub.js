/**
 * ESM stub for next/server — Vitest alias target.
 *
 * next-auth imports `next/server` as a bare ESM specifier. Next.js ships
 * next/server.js as CJS, which Vitest's ESM resolver rejects. This stub
 * re-exports the real NextRequest/NextResponse from the CJS dist path
 * that Vitest CAN resolve.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const req = require("next/dist/server/web/spec-extension/request");
const res = require("next/dist/server/web/spec-extension/response");

export const NextRequest = req.NextRequest;
export const NextResponse = res.NextResponse;
const nextServerStub = { NextRequest, NextResponse };
export default nextServerStub;
