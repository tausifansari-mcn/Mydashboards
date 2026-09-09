import 'dotenv/config';
import { querySource } from '../lib/sourceDb';

function oldFlag(col: string, w: number) { return `IF(q.${col}=1,${w},0)`; }
function newFlag(col: string, w: number) { return `IF(q.${col}=1,${w},IF(q.${col} IS NULL AND q.call_answered_within_5_seconds=1,${w},0))`; }

async function run(label: string, start: string, end: string, fn: typeof oldFlag) {
  const drop = `q.scenario1 IN ('Call Drop in between','Short Call/Blank Call')`;
  const opening = `ROUND(AVG(CASE WHEN ${drop} THEN 1 ELSE IF(q.call_answered_within_5_seconds=1,1,0) END)*100,1)`;
  const soft = `ROUND(AVG(CASE WHEN ${drop} THEN 1 ELSE (${[
    fn('professionalism_maintained', 0.111111111111111), fn('assurance_or_appreciation_provided', 0.111111111111111),
    fn('pronunciation_and_clarity', 0.111111111111111), fn('enthusiasm_and_no_fumbling', 0.111111111111111),
    fn('active_listening', 0.111111111111111), fn('politeness_and_no_sarcasm', 0.111111111111111),
    fn('proper_grammar', 0.111111111111111), fn('accurate_issue_probing', 0.111111111111111),
    fn('customer_concern_acknowledged', 0.111111111111111),
  ].join('+')}) END)*100,1)`;
  const hold = `ROUND(AVG(CASE WHEN ${drop} THEN 1 ELSE (${fn('proper_hold_procedure',0.333)}+${fn('proper_transfer_and_language',0.333)}+${fn('dead_air_under_10_seconds',0.334)}) END)*100,1)`;
  const res = `ROUND(AVG(CASE WHEN ${drop} THEN 1 ELSE (${fn('case_escalated_correctly',0.25)}+${fn('address_recorded_completely',0.25)}+${fn('correct_and_complete_information',0.25)}+${fn('upselling_or_offers_suggested',0.25)}) END)*100,1)`;
  const clos = `ROUND(AVG(CASE WHEN ${drop} THEN 1 ELSE (${fn('further_assistance_offered',0.5)}+${fn('proper_call_closure',0.5)}) END)*100,1)`;

  const rows = await querySource<any>(`
    SELECT ${opening} AS opening_skill, ${soft} AS soft_skill, ${hold} AS hold_procedure, ${res} AS resolution, ${clos} AS closing, COUNT(*) AS n
    FROM db_audit.call_quality_assessment q
    WHERE q.ClientId = '468' AND q.CallDate BETWEEN ? AND ?
  `, [start, end]);
  console.log(label, rows[0]);
}

async function main() {
  await run('MTD (Sep1-9) OLD formula:', '2026-09-01 00:00', '2026-09-09 23:59', oldFlag);
  await run('MTD (Sep1-9) NEW formula:', '2026-09-01 00:00', '2026-09-09 23:59', newFlag);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
