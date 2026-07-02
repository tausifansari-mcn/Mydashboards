import 'dotenv/config';
import { getSourcePool } from '../lib/sourceDb';

async function run() {
  const pool = getSourcePool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS Shivamgiri.AgentMaster (
      MasId       VARCHAR(20)  NOT NULL PRIMARY KEY,
      AgentName   VARCHAR(100) NOT NULL,
      Lob         VARCHAR(20)  NOT NULL DEFAULT '',
      CreatedAt   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('Table created (or already exists).');

  const agents: [string, string, string][] = [
    ['MAS57024', 'M. GAURAV RAW',   'Inbound'],
    ['MAS60428', 'ASHISH EKKA',     'Inbound'],
    ['MAS59369', 'ARUSHI',          'Inbound'],
    ['MAS58974', 'SURJEET KAUR',    'Inbound'],
    ['MAS60429', 'TANISHA',         'Inbound'],
    ['MAS61400', 'MD ANWAR ALI',    'Inbound'],
    ['MAS61152', 'RAJ KUMAR',       'Inbound'],
    ['MAS61401', 'BHARTI',          'Inbound'],
    ['MAS60682', 'PRACHI SHARMA',   'Inbound'],
    ['MAS61153', 'PRINCE KUMAR',    'Inbound'],
    ['MAS59804', 'SHUBHAM YADAV',   'Inbound'],
    ['MAS60426', 'SIKHAR TYAGI',    'Inbound'],
    ['MAS60821', 'PIYUSH SHARMA',   'Outbound'],
    ['MAS61684', 'VIJAY YADAV',     'Outbound'],
    ['MAS60644', 'RAHIL HASAN',     'Outbound'],
    ['MAS61392', 'NANDITA SHARMA',  'Outbound'],
    ['MAS50846', 'CHANCHAL',        'Outbound'],
    ['MAS60701', 'KUMKUM KUMARI',   'Outbound'],
    ['MAS61304', 'NADEEM ANSARI',   'Outbound'],
    ['MAS59063', 'SHIVANI SINGH',   'Outbound'],
    ['MAS60705', 'SAHIL PANCHAL',   'Outbound'],
    ['MAS61393', 'DIKSHITA GUPTA',  'Outbound'],
    ['MAS57009', 'NIKHIL GIRI',     'Outbound'],
    ['MAS57105', 'AKASH BHARTI',    'Outbound'],
    ['MAS61685', 'ASHWIN PATHAK',   'Outbound'],
    ['MAS61112', 'AKANSHA MISHRA',  'Outbound'],
    ['MAS60702', 'MOHD RIHAN',      'Outbound'],
    ['MAS61389', 'AMAN TYAGI',      'Outbound'],
    ['MAS54531', 'SUHAIL SAIFI',    'Outbound'],
  ];

  for (const [masId, name, lob] of agents) {
    await pool.execute(
      `INSERT INTO Shivamgiri.AgentMaster (MasId, AgentName, Lob)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE AgentName = VALUES(AgentName), Lob = VALUES(Lob)`,
      [masId, name, lob],
    );
  }

  console.log(`Inserted/updated ${agents.length} agents.`);
  await pool.end();
}

run().catch(err => { console.error(err); process.exit(1); });
