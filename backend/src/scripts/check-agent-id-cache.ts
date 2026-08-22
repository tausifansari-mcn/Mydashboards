import 'dotenv/config';
import { queryMasmis } from '../lib/masmisDb';

(async () => {
  const total = await queryMasmis<{c:number}>(`SELECT COUNT(*) AS c FROM db_masmis.outbound_dashboard_cache WHERE client_id=375`,[]);
  const withAgent = await queryMasmis<{c:number}>(`SELECT COUNT(*) AS c FROM db_masmis.outbound_dashboard_cache WHERE client_id=375 AND agent_id IS NOT NULL AND agent_id != ''`,[]);
  const sample = await queryMasmis<{agent_id:string|null; agent_name:string|null}>(`SELECT agent_id, agent_name FROM db_masmis.outbound_dashboard_cache WHERE client_id=375 LIMIT 10`,[]);
  console.log('Total rows:', total[0]?.c);
  console.log('With agent_id:', withAgent[0]?.c);
  console.log('Sample:', JSON.stringify(sample, null, 2));
  process.exit(0);
})();
