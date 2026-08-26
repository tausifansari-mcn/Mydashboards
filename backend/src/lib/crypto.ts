import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Encrypts small secrets (e.g. the SMTP password stored via the Profile page) at rest, so a DB
// dump/export doesn't hand over plaintext credentials the way an env var effectively wouldn't
// either. Reuses JWT_SECRET as key material via scrypt rather than requiring a brand-new secret
// to provision and keep in sync across environments.
const KEY = scryptSync(process.env.JWT_SECRET || 'dev-only-insecure-key', 'md-smtp-settings', 32);

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
