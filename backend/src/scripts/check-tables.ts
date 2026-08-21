import 'dotenv/config';
import { queryMasmis } from '../lib/masmisDb';

(async () => {
  // Show all tables - use raw result
  const tables = await queryMasmis<Record<string, string>>(
    `SHOW TABLES`, []
  );
  console.log('All tables in db_masmis:');
  for (const t of tables) {
    const vals = Object.values(t);
    console.log('  ' + vals.join(', '));
  }

  // Find transcript/video related tables
  const videoTable = await queryMasmis<Record<string, string>>(
    `SHOW TABLES LIKE '%video%'`, []
  );
  console.log('\nVideo-related tables:');
  for (const t of videoTable) console.log('  ' + Object.values(t).join(', '));

  const phraseTable = await queryMasmis<Record<string, string>>(
    `SHOW TABLES LIKE '%phrase%'`, []
  );
  console.log('\nPhrase-related tables:');
  for (const t of phraseTable) console.log('  ' + Object.values(t).join(', '));

  const transcriptTable = await queryMasmis<Record<string, string>>(
    `SHOW TABLES LIKE '%transcript%'`, []
  );
  console.log('\nTranscript-related tables:');
  for (const t of transcriptTable) console.log('  ' + Object.values(t).join(', '));

  process.exit(0);
})();
