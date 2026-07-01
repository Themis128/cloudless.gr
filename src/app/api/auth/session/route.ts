import { handlers } from "@/lib/auth";

// Dedicated route so `/api/auth/session` works even when Turbopack has
// trouble resolving the catch-all `/api/auth/[...nextauth]` segment.
export const { GET } = handlers;
