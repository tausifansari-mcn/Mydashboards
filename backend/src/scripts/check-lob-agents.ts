import 'dotenv/config';
import { querySource } from '../lib/sourceDb';

(async () => {
  // Check if agents exist in AgentMaster with LOB values
  const rows = await querySource<{ MasId: string; Lob: string }>(`
    SELECT DISTINCT am.MasId, COALESCE(am.Lob, 'Unknown') AS Lob
    FROM db_external.CallDetails cd
    JOIN Shivamgiri.AgentMaster am ON am.MasId = cd.AgentName COLLATE utf8mb4_unicode_ci
    WHERE cd.CallDate >= '2026-08-01' AND cd.CallDate < '2026-09-01'
      AND cd.client_id = 375
      AND cd.AgentName IS NOT NULL AND TRIM(cd.AgentName) != ''
    ORDER BY Lob, MasId
  `, []);
  console.log('LOB agents found (in AgentMaster):', rows.length);
  for (const r of rows) console.log('  ', r.MasId, '|', r.Lob);

  if (rows.length === 0) {
    // Show agents NOT in AgentMaster
    const noMaster = await querySource<{ agentId: string; cnt: number }>(`
      SELECT cd.AgentName AS agentId, COUNT(*) AS cnt
      FROM db_external.CallDetails cd
      LEFT JOIN Shivamgiri.AgentMaster am ON am.MasId = cd.AgentName COLLATE utf8mb4_unicode_ci
      WHERE cd.CallDate >= '2026-08-01' AND cd.CallDate < '2026-09-01'
        AND cd.client_id = 375
        AND cd.AgentName IS NOT NULL AND TRIM(cd.AgentName) != ''
        AND am.MasId IS NULL
      GROUP BY cd.AgentName ORDER BY cnt DESC LIMIT 40
    `, []);
    console.log('\nAgents NOT in AgentMaster (need LOB data):');
    for (const r of noMaster) console.log('  ', r.agentId, '| calls:', r.cnt);
  }

  process.exit(0);
})();
