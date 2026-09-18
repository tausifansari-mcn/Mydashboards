import 'dotenv/config';
import { getOverview, getTimeline, getBlankCalls } from '../modules/audit-monitor/audit-monitor.service';

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

(async () => {
  const now = new Date();
  const start = new Date(now.getTime() - 7*24*3600*1000); start.setHours(0,0,0,0);
  const filters = { startDate: fmt(start), endDate: fmt(now), blankThreshold: 5, staleHours: 24 };

  const t0 = Date.now();
  const ov = await getOverview(filters);
  console.log(`getOverview: ${Date.now()-t0}ms`);
  console.log('SUMMARY:', JSON.stringify(ov.summary, null, 1));
  console.table(ov.processes.map(p => ({
    process: p.processName, lob: p.lob, status: p.status,
    total: p.total, ok: p.scoredOk, blank: p.scoredBlank, noTxt: p.noTranscript,
    streak: p.blankStreak, blankRate: p.blankRate, cov: p.coverage,
    hrs: p.hoursSinceLastCall,
  })));
  console.log('\nREASONS (non-healthy):');
  ov.processes.filter(p => p.status !== 'healthy').forEach(p => console.log(` [${p.status}] ${p.processName} (${p.lob}): ${p.reason}`));

  const tl = await getTimeline(filters);
  console.log('\nTIMELINE:'); console.table(tl);

  const worst = ov.processes.find(p => p.scoredBlank > 0);
  if (worst) {
    const s = await getBlankCalls(worst.dialdeskClientId, worst.lob, filters, 5);
    console.log(`\nBLANK CALLS for ${worst.processName} (${worst.lob}):`); console.table(s);
  }
  process.exit(0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
