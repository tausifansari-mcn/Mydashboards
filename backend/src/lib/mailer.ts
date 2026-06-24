import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(to: string, name: string, resetLink: string): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Reset Your My Dashboard Password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#1E40AF;">Password Reset Request</h2>
        <p>Hi ${name},</p>
        <p>You requested a password reset for your My Dashboard account. Click the button below to set a new password:</p>
        <a href="${resetLink}" style="display:inline-block;background:#1E40AF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">Reset Password</a>
        <p style="color:#64748b;font-size:0.85rem;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
        <p style="color:#94a3b8;font-size:0.75rem;">My Dashboard — Mass Call Net Analytics</p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(to: string, name: string, tempPassword: string): Promise<void> {
  const loginLink = `${process.env.FRONTEND_URL}/login`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Welcome to My Dashboard',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#1E40AF;">Welcome to My Dashboard</h2>
        <p>Hi ${name},</p>
        <p>Your account has been created. Here are your login credentials:</p>
        <div style="background:#F8FAFC;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0;"><strong>Email:</strong> ${to}</p>
          <p style="margin:8px 0 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
        </div>
        <a href="${loginLink}" style="display:inline-block;background:#1E40AF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Login Now</a>
        <p style="color:#64748b;font-size:0.85rem;margin-top:16px;">Please change your password after your first login.</p>
      </div>
    `,
  });
}
