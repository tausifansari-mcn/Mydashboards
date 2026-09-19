import { querySource } from './sourceDb';
import { encryptSecret, decryptSecret } from './crypto';
import { buildProvider, setActiveProvider, getAIProviderStatus } from '../modules/ai-bot/ai-bot.provider';
import type { ProviderConfig } from '../modules/ai-bot/ai-bot.provider';

// Same shape as mailer.ts's SMTP-password-in-DB pattern: single-row table, AES-256-GCM encrypted
// at rest, loaded at startup to override the .env default, updatable live from the portal without
// a redeploy. Kept in shivamgiri via raw querySource for the same reason as md_smtp_settings —
// this DB already has several ad-hoc tables not tracked in schema.prisma.
async function ensureAiSettingsTable(): Promise<void> {
  await querySource(`
    CREATE TABLE IF NOT EXISTS shivamgiri.md_ai_settings (
      id INT PRIMARY KEY,
      provider VARCHAR(30),
      api_key_enc TEXT,
      model VARCHAR(100),
      base_url VARCHAR(255),
      updated_by_name VARCHAR(100),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Additive migration for installs that created this table before base_url existed.
  const cols = await querySource<{ COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = 'shivamgiri' AND table_name = 'md_ai_settings' AND COLUMN_NAME = 'base_url'`,
  );
  if (cols.length === 0) {
    await querySource(`ALTER TABLE shivamgiri.md_ai_settings ADD COLUMN base_url VARCHAR(255)`);
  }
}

// Called once at server startup — if an admin previously saved a key via the portal, use that
// instead of whatever's in .env, without requiring a new deploy to pick it up.
export async function initAiSettingsFromDb(): Promise<void> {
  try {
    await ensureAiSettingsTable();
    const rows = await querySource<{ provider: string | null; api_key_enc: string | null; model: string | null; base_url: string | null }>(
      'SELECT provider, api_key_enc, model, base_url FROM shivamgiri.md_ai_settings WHERE id = 1',
    );
    if (rows[0]?.api_key_enc) {
      const apiKey = decryptSecret(rows[0].api_key_enc);
      const cfg: ProviderConfig = { provider: rows[0].provider || 'anthropic', apiKey, model: rows[0].model || undefined, baseUrl: rows[0].base_url || undefined };
      setActiveProvider(buildProvider(cfg), cfg, 'stored');
      console.log('[ai-bot] Using AI settings stored via Profile page');
    }
  } catch (err) {
    console.error('[ai-bot] Failed to load stored AI settings, falling back to .env:', err instanceof Error ? err.message : err);
  }
}

// Called after a successful save from the Profile page. Verifies the key actually works (a real,
// minimal API call — same "fail fast, tell the admin immediately" spirit as mailer.ts's
// transporter.verify()) before persisting or swapping the live provider in.
export async function updateAiSettings(
  providerName: string, apiKey: string, model: string | undefined, baseUrl: string | undefined, updatedByName: string,
): Promise<{ ok: boolean; error?: string }> {
  const cfg: ProviderConfig = { provider: providerName, apiKey, model, baseUrl };
  const candidate = buildProvider(cfg);
  if (!candidate.enabled) {
    return { ok: false, error: providerName === 'openai-compatible' && !baseUrl ? 'Base URL is required for an OpenAI-compatible provider.' : 'Unsupported provider or missing key — could not build a working client.' };
  }
  try {
    // A non-throwing response already proves the key/model/base URL work — each provider throws
    // on any non-2xx (bad key, bad model name, wrong URL, etc.), so there's nothing more to check.
    await candidate.chat('You are a connectivity check. Reply with the single word OK.', [
      { role: 'user', text: 'Reply with OK.' },
    ]);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Verification call failed' };
  }

  await ensureAiSettingsTable();
  const encrypted = encryptSecret(apiKey);
  await querySource(`
    INSERT INTO shivamgiri.md_ai_settings (id, provider, api_key_enc, model, base_url, updated_by_name)
    VALUES (1, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE provider = VALUES(provider), api_key_enc = VALUES(api_key_enc), model = VALUES(model), base_url = VALUES(base_url), updated_by_name = VALUES(updated_by_name)
  `, [providerName, encrypted, model ?? null, baseUrl ?? null, updatedByName]);
  setActiveProvider(candidate, cfg, 'stored');
  console.log('[ai-bot] AI settings updated from Profile page — verified and active');
  return { ok: true };
}

export async function getAiSettingsStatus(): Promise<{
  provider: string; model: string; enabled: boolean; keySource: 'stored' | 'env' | 'none'; keyPreview: string | null; baseUrl: string | null;
  updatedByName: string | null; updatedAt: string | null;
}> {
  await ensureAiSettingsTable();
  const rows = await querySource<{ updated_by_name: string | null; updated_at: string | null }>(
    'SELECT updated_by_name, updated_at FROM shivamgiri.md_ai_settings WHERE id = 1',
  );
  return {
    ...getAIProviderStatus(),
    updatedByName: rows[0]?.updated_by_name ?? null,
    updatedAt: rows[0]?.updated_at ?? null,
  };
}
