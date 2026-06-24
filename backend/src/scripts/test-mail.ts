import 'dotenv/config';
import nodemailer from 'nodemailer';

async function testMail() {
  const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false },
  });

  console.log('Config:', {
    host: process.env.SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    user: process.env.SMTP_USER,
  });

  console.log('\nVerifying connection...');
  try {
    await transporter.verify();
    console.log('✓ Connection OK');
  } catch (e: any) {
    console.error('✗ Connection failed:', e.message);
    process.exit(1);
  }

  console.log('\nSending test email to', process.env.SMTP_USER, '...');
  try {
    const info = await transporter.sendMail({
      from: `"My Dashboard" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: 'My Dashboard — SMTP Test ✓',
      html: `<div style="font-family:sans-serif;padding:24px;background:#0F172A;color:#E2E8F0;border-radius:8px;">
        <h2 style="color:#3B82F6;">✅ SMTP is working!</h2>
        <p>Test email from <strong>My Dashboard</strong>.</p>
        <p>Sent: <strong>${new Date().toLocaleString()}</strong></p>
        <p>Host: ${process.env.SMTP_HOST}:${SMTP_PORT}</p>
      </div>`,
      text: `SMTP test OK. Sent at ${new Date().toLocaleString()}`,
    });
    console.log('✓ Email sent! Message ID:', info.messageId);
  } catch (e: any) {
    console.error('✗ Send failed:', e.message);
  }

  process.exit(0);
}

testMail();
