import { NextResponse } from "next/server";

/**
 * GET /.well-known/http-message-signatures-directory — Web Bot Auth JWKS.
 * Publishes the Ed25519 public key our agents use to sign outbound requests
 * (HTTP Message Signatures, RFC 9421; IETF WebBotAuth WG). Receiving sites
 * verify Signature/Signature-Input headers against this key. The private key
 * lives in the SocialAuto stack env (BOT_AUTH_SIGNING_KEY_B64), never here.
 */
const JWKS = {
  keys: [
    {
      kty: "OKP",
      crv: "Ed25519",
      x: "tYRI8xtCCA4JhHI8eHhFbmHu0ol1rcORbQmZ1iPHr8o",
      alg: "EdDSA",
      use: "sig",
      kid: "Bng5NAERjK8vX06O2B1dwWmDMGxhJ9WaL34mCnNYXE8",
    },
  ],
};

export async function GET() {
  return NextResponse.json(JWKS, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
