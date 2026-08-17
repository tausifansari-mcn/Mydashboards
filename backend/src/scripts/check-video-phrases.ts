import 'dotenv/config';
import { getVideoPhraseLeads } from '../modules/inbound-quality/inbound-quality.service';

async function go() {
  const filters = { startDate: '2026-08-01 00:00:00', endDate: '2026-08-31 23:59:59', clientId: '375' };
  
  console.log('Calling getVideoPhraseLeads for update_24_48_hrs...');
  try {
    const leads = await getVideoPhraseLeads(filters, 'update_24_48_hrs', 50);
    console.log('Leads returned:', leads.length);
    if (leads.length > 0) {
      console.log('First lead:', JSON.stringify(leads[0], null, 2));
    }
  } catch (e: any) {
    console.error('ERROR:', e.message);
  }

  console.log('\nCalling getVideoPhraseLeads for unboxing_video_request...');
  try {
    const leads2 = await getVideoPhraseLeads(filters, 'unboxing_video_request', 50);
    console.log('Leads returned:', leads2.length);
    if (leads2.length > 0) {
      console.log('First lead:', JSON.stringify(leads2[0], null, 2));
    }
  } catch (e: any) {
    console.error('ERROR:', e.message);
  }

  process.exit(0);
}
go().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
