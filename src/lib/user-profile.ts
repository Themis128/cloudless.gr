import { getAuthDbFromEnv, getUserById, patchUserProfile as patchD1Profile } from "@/lib/auth-d1";

/**
 * Provider-agnostic user-profile store.
 *
 * D1 `user` row via AUTH_DB. Reads return {} when AUTH_DB is unbound or the
 * user has no row; writes fail closed when AUTH_DB is missing.
 */

export interface UserProfile {
  name?: string;
  company?: string;
  phone?: string;
  preferences?: unknown;
}

/** Read a user's stored profile. Returns {} when no record / no AUTH_DB. */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  const db = getAuthDbFromEnv();
  if (!db) return {};

  const user = await getUserById(db, userId);
  if (!user) return {};

  let preferences: unknown;
  if (user.preferences_json) {
    try {
      preferences = JSON.parse(user.preferences_json);
    } catch {
      // ignore malformed
    }
  }
  return {
    name: user.name ?? undefined,
    company: user.company ?? undefined,
    phone: user.phone ?? undefined,
    preferences,
  };
}

/**
 * Upsert the provided profile fields, keyed by userId.
 *
 * Partial update: only the keys present in `fields` are written. A string set
 * to "" clears that attribute; `undefined` leaves it untouched.
 */
export async function putUserProfile(userId: string, fields: UserProfile): Promise<void> {
  const db = getAuthDbFromEnv();
  if (!db) {
    throw new Error("AUTH_DB is not configured");
  }

  if (
    fields.name === undefined &&
    fields.company === undefined &&
    fields.phone === undefined &&
    fields.preferences === undefined
  ) {
    return;
  }

  const ok = await patchD1Profile(db, userId, fields);
  if (!ok) throw new Error("User not found");
}
