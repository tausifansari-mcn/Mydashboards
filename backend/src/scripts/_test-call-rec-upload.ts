import 'dotenv/config';
import * as XLSX from 'xlsx';
import { getMasmisPool } from '../lib/masmisDb';
import * as svc from '../modules/call-rec-upload/call-rec-upload.service';

function bufferFromRows(rows: (string | number)[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function main() {
  await svc.ensureBatchColumns();
  console.log('ensureBatchColumns: done (upload_batch_id column present on all 5 CR_* tables)');

  const testBatchIds: { table: string; batchId: string }[] = [];

  // Housing Owner — positional, phone sci-notation, ddmmyyyy date, int durations
  {
    const buf = bufferFromRows([
      ['direction', 'status', 'callDate', 'callId', 'clientNumber', 'myNumber', 'callFlow', 'ivr',
        'autoAttendant', 'department', 'voicemail', 'timeGroup', 'answered', 'notAnswered', 'callDuration',
        'inboundDuration', 'outboundDuration', 'hangupCause', 'notes', 'dtmf', 'recording', 'agentRingDuration',
        'circle', 'operator', 'reasonKey', 'agentDisposition', 'agentDispositionName', 'agentName',
        'agentOnCall', 'sipResponse'],
      ['Inbound', 'Answered', '19-09-2026', 'TESTCALL1', 9180000000012, '9876543210', 'Flow1', 'IVR1',
        'AA1', 'Dept1', 'VM1', 'TG1', 'Yes', 'No', 45, 20, 25, 'Normal', 'note', '1', 'http://rec/1', '5',
        'Delhi', 'OpA', 'RK1', 'D1', 'DN1', 'TestAgent', 'Yes', '200'],
    ]);
    const batchId = 'TEST-BATCH-housing-owner';
    const result = await svc.uploadHousingOwner(buf, 1, batchId);
    console.log('uploadHousingOwner:', result);
    testBatchIds.push({ table: 'CR_housing_owner', batchId });
  }

  // LP Feedback — header-name based, MDY datetime, HMS duration
  {
    const buf = bufferFromRows([
      ['ClientName', 'AgentName', 'Phone', 'AllocatedOn', 'CampaignId', 'Disposition', 'CallNumber',
        'Task', 'LeadSubStatusFeedback', 'ConnectedTime', 'DisConnectedTime', 'AllocatedOn', 'LeadStatus',
        'LeadSubStatus', 'CallDurationMinutes', 'RecordingUrl'],
      ['TestClient', 'TestAgent', '9876543210', '9/19/26 10:00', 'CAMP1', 'Connected', 'CN1',
        'Task1', 'SubStatus1', '9/19/26 10:01', '9/19/26 10:05', '9/19/26 10:00', 'Closed',
        'Sub1', '0:04:00', 'http://rec/2'],
    ]);
    const batchId = 'TEST-BATCH-lp-feedback';
    const result = await svc.uploadLPFeedback(buf, 1, batchId);
    console.log('uploadLPFeedback:', result);
    testBatchIds.push({ table: 'CR_lp_feedback', batchId });
  }

  // LP Regional — positional, MDY datetime, HMS duration
  {
    const buf = bufferFromRows([
      ['recordsTotalCount', 'clientName', 'agentName', 'allocatedOn', 'campaignId', 'disposition',
        'callNumber', 'task', 'leadSubStatusFeedback', 'connectedTime', 'disconnectedTime',
        'leadSubStatus', 'leadStatus', 'callDuration', 'recordingUrl'],
      [1, 'TestClient', 'TestAgent', '9/19/26 10:00', 'CAMP1', 'Connected', 'CN1', 'Task1', 'Sub1',
        '9/19/26 10:01', '9/19/26 10:05', 'SubX', 'Closed', '0:03:30', 'http://rec/3'],
    ]);
    const batchId = 'TEST-BATCH-lp-regional';
    const result = await svc.uploadLPRegional(buf, 1, batchId);
    console.log('uploadLPRegional:', result);
    testBatchIds.push({ table: 'CR_lp_regional', batchId });
  }

  // Housing Premium — positional, ddmmyyyy call_date, various date/int fields
  {
    const buf = bufferFromRows([
      ['callPhone', 'callCenter', 'memberNo', 'callGroup', 'callGroup2', 'endTime', 'callDate', 'duration',
        'callTime', 'partnerName', 'circle', 'member', 'fileUrl', 'routingNumbers', 'routingStatus', 'callResult',
        'keyCoins', 'legDetails', 'caller', 'routingErrorCode', 'cpartyNumbers', 'cpartyName', 'cpartyCallStatus',
        'channel', 'talkDuration', 'ringingDuration', 'callerNameComment', 'startTime', 'legAPickedTime',
        'legBStartTime', 'legBPickedTime', 'callSid', 'smsCoins', 'timeOnly'],
      ['9876543210', 'CC1', 'MEM1', 'Group1', 'Group2', '19-09-2026', '19-09-2026', 60,
        '10:00', 'Partner1', 'Delhi', 'Member1', 'http://file/1', '9999999999', 'OK', 'Answered',
        1, 'legs', 'CallerX', '', '8888888888', 'CParty1', 'Connected',
        'Voice', 40, 5, 'Comment1', '19-09-2026', '19-09-2026',
        '19-09-2026', '19-09-2026', 'SID1', 0, '10:00:00'],
    ]);
    const batchId = 'TEST-BATCH-housing-premium';
    const result = await svc.uploadHousingPremium(buf, 1, batchId);
    console.log('uploadHousingPremium:', result);
    testBatchIds.push({ table: 'CR_housing_premium', batchId });
  }

  // LP Non Regional — same shape as LP Regional, different table/campaign tag
  {
    const buf = bufferFromRows([
      ['recordsTotalCount', 'clientName', 'agentName', 'allocatedOn', 'campaignId', 'disposition',
        'callNumber', 'task', 'leadSubStatusFeedback', 'connectedTime', 'disconnectedTime',
        'leadSubStatus', 'leadStatus', 'callDuration', 'recordingUrl'],
      [1, 'TestClient', 'TestAgent', '9/19/26 10:00', 'CAMP2', 'Connected', 'CN2', 'Task2', 'Sub2',
        '9/19/26 10:01', '9/19/26 10:06', 'SubY', 'Closed', '0:05:15', 'http://rec/4'],
    ]);
    const batchId = 'TEST-BATCH-lp-non-regional';
    const result = await svc.uploadLPNonRegional(buf, 1, batchId);
    console.log('uploadLPNonRegional:', result);
    testBatchIds.push({ table: 'CR_lp_non_regional', batchId });
  }

  // Cleanup — remove every test row this script just inserted, leaving the live tables untouched.
  for (const { table, batchId } of testBatchIds) {
    const [r] = await getMasmisPool().execute(`DELETE FROM db_masmis.${table} WHERE upload_batch_id = ?`, [batchId]);
    console.log(`cleanup ${table}:`, (r as any).affectedRows, 'rows removed');
  }

  process.exit(0);
}

main().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
