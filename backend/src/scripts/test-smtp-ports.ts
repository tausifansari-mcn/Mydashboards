import 'dotenv/config';
import nodemailer from 'nodemailer';
import net from 'net';

function checkPort(host: string, port: number, timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

async function run() {
  console.log('Checking network reachability...');
  const checks = [
    { host: 'smtp.gmail.com', port: 587 },
    { host: 'smtp.gmail.com', port: 465 },
    { host: 'smtp.gmail.com', port: 25 },
  ];
  for (const c of checks) {
    const ok = await checkPort(c.host, c.port);
    console.log(`  ${ok ? '✓' : '✗'} ${c.host}:${c.port}`);
  }

  console.log('\nTrying port 465 (SSL)...');
  try {
    const t = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await t.verify();
    console.log('✓ Port 465 works!');
    const info = await t.sendMail({
      from: process.env.SMTP_FROM, to: process.env.SMTP_USER,
      subject: 'My Dashboard SMTP Test (465)',
      html: '<p><b>✅ SMTP working on port 465</b></p>',
    });
    console.log('✓ Email sent! ID:', info.messageId);
  } catch (e: any) { console.error('✗ Port 465 failed:', e.message); }

  process.exit(0);
}

run();
