import nodemailer from 'nodemailer';

const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});

const FROM = `"${process.env.SMTP_FROM_NAME || 'My Dashboard'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function send(to: string, subject: string, html: string, text: string): Promise<void> {
  if (!process.env.SMTP_USER) {
    console.log(`[DEV EMAIL → ${to}]\nSubject: ${subject}\n${text}\n`);
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html, text });
    console.log(`[email] Sent "${subject}" → ${to}`);
  } catch (err: any) {
    console.error(`[email] SMTP failed for ${to}: ${err.message}`);
    console.log(`[FALLBACK]\nTo: ${to}\nSubject: ${subject}\n${text}`);
  }
}

function branded(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,#1E40AF,#3B82F6);padding:28px 40px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">My Dashboard</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:12px;">Mass Call Net Analytics Platform</p>
  </td></tr>
  <tr><td style="padding:36px 40px;">${body}</td></tr>
  <tr><td style="background:#f9fafb;padding:18px 40px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} Mass Call Net. All rights reserved.</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

export async function sendPasswordResetEmail(to: string, name: string, resetLink: string): Promise<void> {
  const body = `
    <p style="margin:0 0 8px;color:#111827;font-size:16px;">Hi <strong>${name}</strong>,</p>
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
    <p style="margin:0 0 12px;color:#111827;font-size:16px;">Welcome, <strong>${name}</strong>!</p>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;line-height:1.6;">Your My Dashboard account has been created. Use the credentials below to log in.</p>
    <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;padding:16px;margin:0 0 20px;">
      <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Email:</p>
      <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1e1b4b;">${to}</p>
      <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Temporary Password:</p>
      <p style="margin:0;font-size:18px;font-weight:800;letter-spacing:3px;color:#1e1b4b;">${tempPassword}</p>
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
