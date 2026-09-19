import 'dotenv/config';
import { querySource } from '../lib/sourceDb';
import { decryptSecret } from '../lib/crypto';

(async () => {
  const rows = await querySource<{ smtp_pass_enc: string | null; updated_by_name: string; updated_at: string }>(
    'SELECT smtp_pass_enc, updated_by_name, updated_at FROM shivamgiri.md_smtp_settings WHERE id = 1',
  );
  const enc = rows[0]?.smtp_pass_enc;
  console.log('stored row      :', enc ? `present (${enc.length} chars), saved by ${rows[0].updated_by_name} at ${rows[0].updated_at}` : 'MISSING');
  console.log('JWT_SECRET set  :', process.env.JWT_SECRET ? `yes (${process.env.JWT_SECRET.length} chars)` : 'NO');
  if (enc) {
    try {
      const pw = decryptSecret(enc);
      console.log('decrypt         : OK — recovered a', pw.length, 'char password');
      console.log('matches .env    :', pw === process.env.SMTP_PASS ? 'yes' : 'NO (stored differs from .env)');
    } catch (e) {
      console.log('decrypt         : FAILED —', (e as Error).message);
      console.log('  => JWT_SECRET no longer matches the one used when this password was saved.');
    }
  }
  console.log('env SMTP_PASS   :', process.env.SMTP_PASS ? `${process.env.SMTP_PASS.length} chars` : 'unset');
  process.exit(0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
