/** * Single source of truth for where the weekly voice brief is persisted. * * D1 primary (Cloudflare Workers). * D1 table: voice_brief */ import type { AuthDatabase } from "@/lib/auth-d1";

export const VOICE_BRIEF_SSM_NAME = "/cloudless/production/VOICE_BRIEF_LATEST"; const D1_KEY = "latest";

export interface VoiceBriefRecord { text: string; generatedAt: string; week: string; }

// D1 binding interface - provided by Worker context interface Env { AUTH_DB: AuthDatabase; }

function getAuthDb(): AuthDatabase | null { const env = process.env as unknown as Env; return env.AUTH_DB ?? null; }

export async function persistVoiceBrief(brief: VoiceBriefRecord): Promise<void> { const db = getAuthDb(); if (db) { try { await db .prepare( "INSERT INTO voice_brief (id, text, generated_at, week, created_at) VALUES (?, ?, ?, ?, ?) " + "ON CONFLICT(id) DO UPDATE SET text = excluded.text, generated_at = excluded.generated_at, week = excluded.week, created_at = excluded.created_at" ) .bind(D1_KEY, brief.text, brief.generatedAt, brief.week, Math.floor(Date.now() / 1000)) .run(); return; } catch (err) { console.warn( "[voice-brief-store] D1 persist failed:", err instanceof Error ? err.message : err ); return; } } }

export async function readVoiceBrief(): Promise<VoiceBriefRecord | null> { const db = getAuthDb(); if (db) { try { const row = await db .prepare("SELECT text, generated_at, week FROM voice_brief WHERE id = ?") .bind(D1_KEY) .first<{ text: string; generated_at: string; week: string }>(); if (row) { return { text: row.text, generatedAt: row.generated_at, week: row.week, }; } return null; } catch (err) { console.warn( "[voice-brief-store] D1 read failed:", err instanceof Error ? err.message : err ); return null; } } return null; }