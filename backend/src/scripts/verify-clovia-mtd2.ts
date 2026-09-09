import 'dotenv/config';
import { querySource } from '../lib/sourceDb';

function newFlag(col: string, w: number) { return `IF(q.${col}=1,${w},IF(q.${col} IS NULL AND q.call_answered_within_5_seconds=1,${w},0))`; }

async function run(label: string, start: string, end: string) {
  const drop = `q.scenario1 IN ('Call Drop in between','Short Call/Blank Call')`;
  const opening = `ROUND(AVG(CASE WHEN ${drop} THEN 1 ELSE IF(q.call_answered_within_5_seconds=1,1,0) END)*100,1)`;
  const soft = `ROUND(AVG(CASE WHEN ${drop} THEN 1 ELSE (${[
    newFlag('professionalism_maintained', 0.111111111111111), newFlag('assurance_or_appreciation_provided', 0.111111111111111),
    newFlag('pronunciation_and_clarity', 0.111111111111111), newFlag('enthusiasm_and_no_fumbling', 0.111111111111111),
    newFlag('active_listening', 0.111111111111111), newFlag('politeness_and_no_sarcasm', 0.111111111111111),
    newFlag('proper_grammar', 0.111111111111111), newFlag('accurate_issue_probing', 0.111111111111111),
    newFlag('customer_concern_acknowledged', 0.111111111111111),
  ].join('+')}) END)*100,1)`;
  const hold = `ROUND(AVG(CASE WHEN ${drop} THEN 1 ELSE (${newFlag('proper_hold_procedure',0.333)}+${newFlag('proper_transfer_and_language',0.333)}+${newFlag('dead_air_under_10_seconds',0.334)}) END)*100,1)`;
  const res = `ROUND(AVG(CASE WHEN ${drop} THEN 1 ELSE (${newFlag('case_escalated_correctly',0.25)}+${newFlag('address_recorded_completely',0.25)}+${newFlag('correct_and_complete_information',0.25)}+${newFlag('upselling_or_offers_suggested',0.25)}) END)*100,1)`;
  const clos = `ROUND(AVG(CASE WHEN ${drop} THEN 1 ELSE (${newFlag('further_assistance_offered',0.5)}+${newFlag('proper_call_closure',0.5)}) END)*100,1)`;

  const rows = await querySource<any>(`
    SELECT ${opening} AS opening_skill, ${soft} AS soft_skill, ${hold} AS hold_procedure, ${res} AS resolution, ${clos} AS closing, COUNT(*) AS n
    FROM db_audit.call_quality_assessment q
    WHERE q.ClientId = '468' AND q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL
  `, [start, end]);
  console.log(label, rows[0]);
}

async function main() {
  await run('MTD (Sep1-9), qp not null, NEW formula:', '2026-09-01 00:00', '2026-09-09 23:59');
  await run('Sep9 only, qp not null, NEW formula:', '2026-09-09 00:00', '2026-09-09 23:59');

  const [nullCheck] = await querySource<any>(`
    SELECT
      SUM(CASE WHEN quality_percentage IS NULL THEN 1 ELSE 0 END) AS null_qp,
      SUM(CASE WHEN quality_percentage IS NOT NULL THEN 1 ELSE 0 END) AS not_null_qp,
      COUNT(*) AS total
    FROM db_audit.call_quality_assessment
    WHERE ClientId='468' AND CallDate BETWEEN '2026-09-01 00:00' AND '2026-09-09 23:59'
  `);
  console.log('quality_percentage null-check MTD:', nullCheck);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
