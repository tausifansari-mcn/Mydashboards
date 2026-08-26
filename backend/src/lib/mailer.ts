import nodemailer, { type Transporter } from 'nodemailer';
import { querySource } from './sourceDb';
import { encryptSecret, decryptSecret } from './crypto';

// Kept in shivamgiri (same DB as the rest of the app's own tables) but created/read via the raw
// querySource connection rather than Prisma — a `prisma db push` diffs the ENTIRE live schema
// against schema.prisma, and this DB already has several tables (AgentsMaster, md_magical_scripts,
// md_sale_brand_access, ...) that were created ad hoc via raw SQL and were never added back into
// schema.prisma; pushing a new model here would have offered to drop all of them. Single-row
// table (id is always 1) — smtp_pass_enc is AES-256-GCM encrypted (see lib/crypto.ts).
async function ensureSmtpSettingsTable(): Promise<void> {
  await querySource(`
    CREATE TABLE IF NOT EXISTS shivamgiri.md_smtp_settings (
      id INT PRIMARY KEY,
      smtp_pass_enc TEXT,
      updated_by_name VARCHAR(100),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;

// Gmail App Passwords are displayed with spaces (e.g. "xxxx xxxx xxxx xxxx")
// but must be sent without spaces — strip them here.
function cleanPass(pass: string): string {
  return pass.replace(/\s+/g, '');
}

let transporter: Transporter = buildTransporter(process.env.SMTP_PASS || '');
let usingStoredPassword = false;

function buildTransporter(pass: string): Transporter {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: cleanPass(pass),
    },
    tls: { rejectUnauthorized: false },
  });
}

function verifyAndLog(): void {
  if (!process.env.SMTP_USER) return;
  transporter.verify((err) => {
    if (err) {
      console.error('[mailer] SMTP connection FAILED:', err.message);
    } else {
      console.log('[mailer] SMTP connection OK — ready to send emails');
    }
  });
}

verifyAndLog();

// Called once at server startup — if an admin has previously saved a replacement SMTP password
// via the Profile page (e.g. because a Gmail app password expired), use that instead of
// whatever's baked into .env, without requiring a new deploy to pick it up.
export async function initSmtpFromDb(): Promise<void> {
  try {
    await ensureSmtpSettingsTable();
    const rows = await querySource<{ smtp_pass_enc: string | null }>(
      'SELECT smtp_pass_enc FROM shivamgiri.md_smtp_settings WHERE id = 1',
    );
    if (rows[0]?.smtp_pass_enc) {
      transporter = buildTransporter(decryptSecret(rows[0].smtp_pass_enc));
      usingStoredPassword = true;
      console.log('[mailer] Using SMTP password stored via Profile page');
      verifyAndLog();
    }
  } catch (err) {
    console.error('[mailer] Failed to load stored SMTP password, falling back to .env:', err instanceof Error ? err.message : err);
  }
}

// Called after a successful save from the Profile page — swaps the live transporter in
// immediately so a fixed password (e.g. a freshly rotated app password) takes effect without a
// restart, and reports back whether nodemailer can actually authenticate with it.
export async function updateSmtpPassword(newPassword: string, updatedByName: string): Promise<{ ok: boolean; error?: string }> {
  const candidate = buildTransporter(newPassword);
  try {
    await candidate.verify();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'SMTP verification failed' };
  }
  await ensureSmtpSettingsTable();
  const encrypted = encryptSecret(newPassword);
  await querySource(`
    INSERT INTO shivamgiri.md_smtp_settings (id, smtp_pass_enc, updated_by_name)
    VALUES (1, ?, ?)
    ON DUPLICATE KEY UPDATE smtp_pass_enc = VALUES(smtp_pass_enc), updated_by_name = VALUES(updated_by_name)
  `, [encrypted, updatedByName]);
  transporter = candidate;
  usingStoredPassword = true;
  console.log('[mailer] SMTP password updated from Profile page — verified and active');
  return { ok: true };
}

export async function getSmtpStatus(): Promise<{ host: string | undefined; user: string | undefined; usingStoredPassword: boolean; updatedByName: string | null; updatedAt: string | null }> {
  await ensureSmtpSettingsTable();
  const rows = await querySource<{ updated_by_name: string | null; updated_at: string | null }>(
    'SELECT updated_by_name, updated_at FROM shivamgiri.md_smtp_settings WHERE id = 1',
  );
  return {
    host: process.env.SMTP_HOST,
    user: process.env.SMTP_USER,
    usingStoredPassword,
    updatedByName: rows[0]?.updated_by_name ?? null,
    updatedAt: rows[0]?.updated_at ?? null,
  };
}

const FROM = `"${process.env.SMTP_FROM_NAME || 'My Dashboard'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function send(to: string, subject: string, html: string, text: string): Promise<void> {
  if (!process.env.SMTP_USER) {
    console.log(`[DEV EMAIL → ${to}]\nSubject: ${subject}\n${text}\n`);
    return;
  }
  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, html, text });
    console.log(`[mailer] Sent "${subject}" → ${to} (messageId: ${info.messageId})`);
  } catch (err: any) {
    console.error(`[mailer] SMTP error sending to ${to}: ${err.message}`);
    throw err; // re-throw so callers know the email failed
  }
}

async function sendWithAttachments(
  to: string, subject: string, html: string, text: string,
  attachments: { filename: string; content: Buffer }[],
): Promise<void> {
  if (!process.env.SMTP_USER) {
    const list = attachments.map(a => `${a.filename} (${a.content.length} bytes)`).join(', ');
    console.log(`[DEV EMAIL → ${to}]\nSubject: ${subject}\n${text}\n(attachments: ${list})\n`);
    return;
  }
  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, html, text, attachments });
    console.log(`[mailer] Sent "${subject}" → ${to} (messageId: ${info.messageId}, attachments: ${attachments.map(a => a.filename).join(', ')})`);
  } catch (err: any) {
    console.error(`[mailer] SMTP error sending to ${to}: ${err.message}`);
    throw err;
  }
}

function branded(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,#1E40AF,#3B82F6);padding:28px 40px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">My Dashboard</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:12px;">Mas CallNet Analytics Platform</p>
  </td></tr>
  <tr><td style="padding:36px 40px;">${body}</td></tr>
  <tr><td style="background:#f9fafb;padding:18px 40px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} Mas CallNet. All rights reserved.</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

export async function sendPasswordResetEmail(to: string, name: string, resetLink: string): Promise<void> {
  const body = `
    <p style="margin:0 0 8px;color:#111827;font-size:16px;">Hi <strong>${escapeHtml(name)}</strong>,</p>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;line-height:1.6;">You requested a password reset for your My Dashboard account. Click the button below — link expires in <strong>1 hour</strong>.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${resetLink}" style="background:#1E40AF;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Reset Password →
      </a>
    </div>
    <p style="margin:0;color:#9ca3af;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>`;

  await send(
    to,
    'Reset Your My Dashboard Password',
    branded('Password Reset', body),
    `Hi ${name},\n\nReset your password: ${resetLink}\n\nLink expires in 1 hour.\n\n— My Dashboard`,
  );
}

export async function sendWelcomeEmail(to: string, name: string, tempPassword: string): Promise<void> {
  const body = `
    <p style="margin:0 0 12px;color:#111827;font-size:16px;">Welcome, <strong>${escapeHtml(name)}</strong>!</p>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;line-height:1.6;">Your My Dashboard account has been created. Use the credentials below to log in.</p>
    <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;padding:16px;margin:0 0 20px;">
      <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Email:</p>
      <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1e1b4b;">${escapeHtml(to)}</p>
      <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Temporary Password:</p>
      <p style="margin:0;font-size:18px;font-weight:800;letter-spacing:3px;color:#1e1b4b;">${escapeHtml(tempPassword)}</p>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/login" style="background:#1E40AF;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Login Now →
      </a>
    </div>
    <p style="margin:0;color:#9ca3af;font-size:12px;">Please change your password after first login.</p>`;

  await send(
    to,
    'Welcome to My Dashboard',
    branded('Welcome!', body),
    `Welcome ${name}!\n\nEmail: ${to}\nTemp Password: ${tempPassword}\n\nLogin: ${APP_URL}/login\n\n— My Dashboard`,
  );
}

export async function sendReportEmail(
  to: string[], taskName: string, rangeLabel: string,
  kpiSectionsHtml: string, attachments: { filename: string; content: Buffer }[],
): Promise<void> {
  const body = `
    <p style="margin:0 0 8px;color:#111827;font-size:16px;">Scheduled report: <strong>${escapeHtml(taskName)}</strong></p>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.6;">Period: <strong style="color:#1e1b4b;">${escapeHtml(rangeLabel)}</strong></p>
    ${kpiSectionsHtml}
    <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">Full CSV data export${attachments.length > 1 ? 's are' : ' is'} attached to this email.</p>`;

  const subject = `[Scheduled Report] ${taskName} — ${rangeLabel}`;
  const text = `Scheduled report: ${taskName}\n\nPeriod: ${rangeLabel}\n\nSee attached CSV${attachments.length > 1 ? 's' : ''}.\n\n— My Dashboard`;
  const html = branded('Scheduled Report', body);

  for (const recipient of to) {
    await sendWithAttachments(recipient, subject, html, text, attachments);
  }
}
