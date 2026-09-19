import 'dotenv/config';
import prisma from '../lib/prismaClient';
import { isScamAlert, computeNextRun } from '../modules/task-scheduler/task-scheduler.service';

(async () => {
  const tasks = await prisma.md_scheduled_tasks.findMany({ orderBy: { id: 'asc' } });
  for (const t of tasks) {
    console.log(`id=${t.id} task_type=${JSON.stringify((t as { task_type?: string }).task_type)} isScamAlert=${isScamAlert(t)} freq=${t.frequency} cursor=${(t as { alert_cursor?: number }).alert_cursor}`);
  }
  const t14 = tasks.find(t => t.id === 14);
  if (t14) {
    console.log('\nkeys returned by prisma:', Object.keys(t14).join(', '));
    console.log('computeNextRun(realtime) =>', computeNextRun('realtime', '00:00', null, null).toISOString());
  }
  const due = await prisma.md_scheduled_tasks.findMany({ where: { is_active: true, next_run_at: { lte: new Date() } } });
  console.log('\ndue right now:', due.map(d => `${d.id}(${(d as { task_type?: string }).task_type})`).join(', ') || 'none');
  process.exit(0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
