import 'dotenv/config';
import { querySource } from '../lib/sourceDb';
import { queryMasmis, getMasmisPool } from '../lib/masmisDb';

const VIDEO_PHRASES = [
  { id: 'unboxing_video_request', label: 'Agent Asked for Unboxing Video', patterns: [
    'unboxing video', 'kiya apne unboxing', 'kya aapne unboxing', 'unboxing ki hai',
    'unboxing video create', 'unboxing video bana', 'unboxing video banaiye',
    'unboxing video bhejiye', 'unboxing video share', 'unboxing video karke',
    'unboxing video banake', 'unboxing video create krni', 'unboxing video create karni',
    'unboxing video create hoti', 'unboxing video banani hoti', 'unboxing video banana hota',
    'unboxing video banana tha', 'unboxing video bana leni', 'unboxing video bana lete',
    'short video', 'choti video', 'chhota video', 'short video create', 'short video bana',
    'short video bhejiye', 'short video share', 'short video banake',
  ]},
  { id: 'video_with_invoice', label: 'Video + Invoice Together', patterns: [
    'invoice ke sath', 'invoice ke saath', 'invoice k sath', 'invoice k saath',
    'invoice ke saath video', 'invoice ke sath video', 'invoice k saath video',
    'video invoice', 'invoice or video', 'invoice aur video',
    'invoice ke sath share', 'invoice ke saath share', 'invoice sath share',
    'screenshot ke sath', 'screenshot ke saath',
  ]},
  { id: 'video_not_proper', label: 'Video/Details Not Proper', patterns: [
    'proper nahi hai', 'proper ni hai', 'proper ni h', 'video proper nahi', 'video proper ni',
    'unboxing proper nahi', 'unboxing proper ni', 'details proper nahi', 'details proper ni',
    'sahi se nahi hai', 'sahi se ni hai', 'theek se nahi hai', 'theek se ni hai',
    'proper share nahi kiya', 'properly share nahi', 'dhang se nahi',
    'proper tarike se nahi', 'proper tareeke se nahi',
  ]},
  { id: 'invoice_not_visible', label: 'Invoice Not Visible', patterns: [
    'invoice show nahi', 'invoice show ni', 'invoice dikh nahi', 'invoice dikh ni',
    'invoice clearly nahi', 'invoice saaf nahi', 'invoice blur', 'invoice visible nahi',
    'invoice nazar nahi', 'invoice nazar ni', 'invoice padh nahi', 'invoice read nahi',
    'amount show nahi', 'amount dikh nahi', 'order id show nahi',
  ]},
  { id: 'video_not_clear_blur', label: 'Video Not Clear/Blur', patterns: [
    'video clear nahi', 'video clear ni', 'video saaf nahi', 'video saaf ni',
    'video blur', 'video blurry', 'video dhundhla', 'video dikh nahi', 'video dikh ni',
    'video clearly nahi', 'video properly nahi', 'video sahi se nahi dikh',
    'video visible nahi', 'video nazar nahi', 'record sahi se nahi',
  ]},
  { id: 'complaint_cannot_raise', label: 'Complaint Cannot Be Raised', patterns: [
    'complaint raise nahi', 'complaint raise ni', 'complaint raise nahi kr',
    'complaint raise nahi kar', 'complaint raise nahi ho', 'complaint raise ni pauga',
    'complaint raise nahi pauga', 'complaint nahi le sakte', 'complaint nahi le paenge',
    'complaint process nahi', 'complaint process nahi ho', 'complaint process ni hoga',
    'complaint filed nahi', 'complaint register nahi', 'complaint darj nahi',
    'bina details complaint', 'bina video complaint', 'bina proof complaint',
    'complaint ke liye details', 'complaint ke liye video', 'complaint ke liye proof',
    'maaf kijiye complaint', 'maafi complaint',
  ]},
  { id: 'video_not_received', label: 'Agent Has Not Received Video', patterns: [
    'video receive nahi', 'video receive ni', 'video received nahi', 'video received ni',
    'video nahi mili', 'video nahi mila', 'video nahi aayi', 'video nahi aaya',
    'video abhi tak nahi', 'video abhi tak ni', 'video share nahi', 'video share ni',
    'video nahi bheja', 'video nahi bheji', 'video nahi dikha', 'video nahi dikha hai',
    'abhi tak video nahi', 'abhi tak video ni', 'mere paas video nahi',
  ]},
  { id: 'video_refund_block', label: 'Video Required for Refund', patterns: [
    'video ke bina refund', 'video ke bina return', 'video ke bagair refund',
    'refund ke liye video', 'return ke liye video', 'replacement ke liye video',
    'video nahi to refund', 'video nahi toh refund', 'video nahi to return',
    'bina video refund', 'bina video return', 'video ke sath refund',
    'video ke sath return', 'video dijiye refund', 'video bhejiye refund',
  ]},
  { id: 'agent_email_whatsapp', label: 'Agent Directs Email/WhatsApp', patterns: [
    'mail pe bhejiye', 'mail pe share', 'mail pe send', 'mail id pe',
    'email pe bhejiye', 'email pe share', 'email pe send',
    'whatsapp pe bhejiye', 'whatsapp pe share', 'whatsapp kar dijiye',
    'whatsapp kar do', 'number pe bhejiye', 'number pe share',
  ]},
  { id: 'update_24_48_hrs', label: '24-48 Hrs Update Timeline', patterns: [
    '24 se 48', '24 to 48', '24-48', '24 hours', '48 hours',
    'ek din se', 'do din se', 'ek do din', 'update share kr', 'update share kar',
    'update de denge', 'update de diya jayega', 'update kr diya jayega',
    'jaldi update', 'jaldi se update',
  ]},
  { id: 'customer_no_video', label: 'Customer Has No Video', patterns: [
    'mere paas video nahi', 'mere paas video ni', 'mere pass video nahi',
    'video nahi bana', 'video nahi banaya', 'video nahi banai',
    'video nahi hai mere', 'video nahi hai hamare', 'video nahi hai mera',
    'maine video nahi', 'maine video ni', 'humne video nahi',
    'video nahi kiya', 'video nahi ki', 'video nahi ban payi', 'video nahi ban paya',
    'video banana nahi', 'video banana ni', 'koi video nahi', 'koi video ni',
  ]},
  { id: 'share_send_video', label: 'Share/Send the Video', patterns: [
    'video share karo', 'video share kar dijiye', 'video share kar do',
    'video bhejiye', 'video bhej dijiye', 'video bhej do',
    'video send karo', 'video send kar dijiye',
    'video upload karo', 'video upload kar dijiye', 'video upload kar do',
    'video submit karo', 'video submit kar dijiye',
    'video upload karke bhejiye', 'video upload karke share',
    'video portal pe upload', 'video portal pe bhejiye',
  ]},
  { id: 'complaint_invalid_rejected', label: 'Complaint Invalid/Rejected', patterns: [
    'complaint invalid', 'complaint rejected', 'complaint closed',
    'complaint cancel', 'complaint cancelled', 'request reject', 'request rejected',
    'request rhagyi', 'request reh gayi', 'request pending', 'request hold',
    'complaint deny', 'complaint denied',
  ]},
];

function matchesVideoPhrase(text: string, patterns: readonly string[]): { matched: boolean; context: string } {
  const lower = text.toLowerCase();
  for (const p of patterns) {
    const idx = lower.indexOf(p);
    if (idx !== -1) {
      const start = Math.max(0, idx - 80);
      const end = Math.min(text.length, idx + p.length + 80);
      return { matched: true, context: text.substring(start, end).trim() };
    }
  }
  return { matched: false, context: '' };
}

async function go() {
  const CID = '375';
  const TABLE = 'db_masmis.video_phrase_cache';

  // Step 1: Get ALL August 2026 lead_ids (batch by scenario to stay fast)
  const b1 = await querySource<{ lead_id: string }>(
    `SELECT lead_id FROM db_audit.call_quality_assessment WHERE ClientId = '${CID}' AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01' AND scenario = 'Complaint' LIMIT 60`, []
  );
  const b2 = await querySource<{ lead_id: string }>(
    `SELECT lead_id FROM db_audit.call_quality_assessment WHERE ClientId = '${CID}' AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01' AND scenario = 'Query' LIMIT 60`, []
  );
  const b3 = await querySource<{ lead_id: string }>(
    `SELECT lead_id FROM db_audit.call_quality_assessment WHERE ClientId = '${CID}' AND CallDate >= '2026-08-01' AND CallDate < '2026-09-01' AND scenario = 'Repeat' LIMIT 60`, []
  );

  const allIds = [...b1, ...b2, ...b3];
  const seen = new Set<string>();
  const unique = allIds.filter(r => { if (seen.has(r.lead_id)) return false; seen.add(r.lead_id); return true; });
  console.log(`Scanning ${unique.length} August 2026 transcripts...\n`);

  let inserted = 0;
  let scanned = 0;

  for (const { lead_id } of unique) {
    try {
      const meta = await querySource<{ CallDate: string; User: string; scenario: string }>(
        `SELECT DATE_FORMAT(CallDate, '%Y-%m-%d %H:%i:%s') AS CallDate, User, scenario
         FROM db_audit.call_quality_assessment WHERE lead_id = '${lead_id}' LIMIT 1`, []
      );
      if (!meta.length) continue;

      const textRows = await querySource<{ t: string }>(
        `SELECT Transcribe_Text AS t FROM db_audit.call_quality_assessment WHERE lead_id = '${lead_id}' LIMIT 1`, []
      );
      if (!textRows.length || !textRows[0].t) continue;
      scanned++;

      const lower = textRows[0].t.toLowerCase();
      const text = textRows[0].t;

      for (const phrase of VIDEO_PHRASES) {
        const { matched, context } = matchesVideoPhrase(text, phrase.patterns);
        if (matched) {
          try {
            await queryMasmis(
              `INSERT IGNORE INTO ${TABLE} (lead_id, client_id, call_date, agent, scenario, phrase_id, context)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [lead_id, CID, meta[0].CallDate, meta[0].User ?? null, meta[0].scenario ?? null, phrase.id, context]
            );
            inserted++;
          } catch { }
        }
      }
      process.stdout.write(`  ${scanned}..`);
    } catch { }
  }

  console.log(`\n\nScanned: ${scanned}, Phrase hits inserted: ${inserted}`);

  // Update cursor
  await queryMasmis(`UPDATE db_masmis.video_phrase_cursor SET last_qa_id = 999999999 WHERE id = 1`, []).catch(() => {});

  // Verify
  const cache = await queryMasmis<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM ${TABLE}`, []);
  console.log(`Cache now has ${cache[0]?.cnt} rows`);

  const byPhrase = await queryMasmis<{ phrase_id: string; cnt: number }>(
    `SELECT phrase_id, COUNT(DISTINCT lead_id) AS cnt FROM ${TABLE} GROUP BY phrase_id ORDER BY cnt DESC`, []
  );
  console.log(`\nBy phrase:`);
  for (const r of byPhrase) console.log(`  ${r.phrase_id}: ${r.cnt}`);

  process.exit(0);
}
go().catch(e => { console.error('ERR:', e.message); process.exit(1); });
