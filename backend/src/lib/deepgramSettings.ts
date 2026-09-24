import { querySource } from './sourceDb';
import { encryptSecret, decryptSecret } from './crypto';

// Same shape as aiSettings.ts's AI-provider-key pattern (itself mirrored from mailer.ts's SMTP
// password): single-row table, AES-256-GCM encrypted at rest, loaded at startup to override the
// .env default, updatable live from the Profile page without a redeploy. Deepgram is kept
// deliberately separate from md_ai_settings — it's Call Audit's speech-to-text provider, not CAM
// BOT's chat/reasoning provider, and the two can be swapped independently.
async function ensureDeepgramSettingsTable(): Promise<void> {
  await querySource(`
    CREATE TABLE IF NOT EXISTS shivamgiri.md_deepgram_settings (
      id INT PRIMARY KEY,
      api_key_enc TEXT,
      updated_by_name VARCHAR(100),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

let activeApiKey: string | undefined;
let activeKeyPreview: string | null = null;
let activeSource: 'stored' | 'env' | 'none' = 'none';

function applyEnvDefault(): void {
  const envKey = process.env.DEEPGRAM_API_KEY;
  activeApiKey = envKey || undefined;
  activeKeyPreview = envKey ? envKey.slice(-4) : null;
  activeSource = envKey ? 'env' : 'none';
}
applyEnvDefault();

// Called once at server startup — if an admin previously saved a key via the portal, use that
// instead of whatever's in .env, without requiring a new deploy to pick it up.
export async function initDeepgramSettingsFromDb(): Promise<void> {
  try {
    await ensureDeepgramSettingsTable();
    const rows = await querySource<{ api_key_enc: string | null }>(
      'SELECT api_key_enc FROM shivamgiri.md_deepgram_settings WHERE id = 1',
    );
    if (rows[0]?.api_key_enc) {
      const apiKey = decryptSecret(rows[0].api_key_enc);
      activeApiKey = apiKey;
      activeKeyPreview = apiKey.slice(-4);
      activeSource = 'stored';
      console.log('[call-audit] Using Deepgram key stored via Profile page');
    }
  } catch (err) {
    console.error('[call-audit] Failed to load stored Deepgram settings, falling back to .env:', err instanceof Error ? err.message : err);
  }
}

// A real, minimal Deepgram API call that succeeds only with a valid key — Deepgram's own project
// listing endpoint, not a transcription call, so verifying a key costs nothing and needs no audio.
async function verifyDeepgramKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { authorization: `Token ${apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `Deepgram returned ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not reach Deepgram' };
  }
}

export async function updateDeepgramSettings(apiKey: string, updatedByName: string): Promise<{ ok: boolean; error?: string }> {
  const verification = await verifyDeepgramKey(apiKey);
  if (!verification.ok) return verification;

  await ensureDeepgramSettingsTable();
  const encrypted = encryptSecret(apiKey);
  await querySource(`
    INSERT INTO shivamgiri.md_deepgram_settings (id, api_key_enc, updated_by_name)
    VALUES (1, ?, ?)
    ON DUPLICATE KEY UPDATE api_key_enc = VALUES(api_key_enc), updated_by_name = VALUES(updated_by_name)
  `, [encrypted, updatedByName]);

  activeApiKey = apiKey;
  activeKeyPreview = apiKey.slice(-4);
  activeSource = 'stored';
  console.log('[call-audit] Deepgram key updated from Profile page — verified and active');
  return { ok: true };
}

export async function getDeepgramSettingsStatus(): Promise<{
  enabled: boolean; keySource: 'stored' | 'env' | 'none'; keyPreview: string | null;
  updatedByName: string | null; updatedAt: string | null;
}> {
  await ensureDeepgramSettingsTable();
  const rows = await querySource<{ updated_by_name: string | null; updated_at: string | null }>(
    'SELECT updated_by_name, updated_at FROM shivamgiri.md_deepgram_settings WHERE id = 1',
  );
  return {
    enabled: !!activeApiKey,
    keySource: activeSource,
    keyPreview: activeKeyPreview,
    updatedByName: rows[0]?.updated_by_name ?? null,
    updatedAt: rows[0]?.updated_at ?? null,
  };
}

// Server-internal only — the real key, for call-audit.service.ts's transcription call. Never
// expose this over an API route (getDeepgramSettingsStatus above is the masked-preview version).
export function getActiveDeepgramKey(): string | undefined {
  return activeApiKey;
}
