import { querySource } from '../../lib/sourceDb';
import prisma from '../../lib/prismaClient';

export interface CallMasterFilters {
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  clientIds?: number[]; // dialdesk_client_ids
  lob?: 'Inbound' | 'Outbound' | 'All';
}

// Helper: resolve which dialdesk_client_ids a user can see
export async function resolveClientIds(tenantClientId: number | null): Promise<number[] | null> {
  if (tenantClientId === null) return null; // super admin → all
  const client = await prisma.md_clients.findUnique({ where: { id: tenantClientId } });
  return client ? [client.dialdesk_client_id] : [];
}

// Helper: get list of clients visible to this tenant (for filter dropdowns)
export async function getClientList(tenantClientId: number | null) {
  const where = tenantClientId === null
    ? { is_active: true }                          // super admin → all
    : { is_active: true, id: tenantClientId };     // tenant user → only their client
  return prisma.md_clients.findMany({
    where,
    select: { id: true, name: true, dialdesk_client_id: true },
    orderBy: { name: 'asc' },
  });
}

// ─── KPI Cards ───────────────────────────────────────────────────────────────

export async function getKPIs(filters: CallMasterFilters) {
  const { startDate, endDate, clientIds } = filters;
  const lob = filters.lob || 'All';

  // Quality data (Inbound) from db_audit
  let qualityKPIs = {
    totalAudited: 0,
    qualityScore: 0,
    customerExperience: 0,
    compliance: 0,
  };

  if (lob === 'All' || lob === 'Inbound') {
    const clientFilter = clientIds?.length
      ? `AND ClientId IN (${clientIds.map(() => '?').join(',')})` : '';
    const params: (string | number | null)[] =[startDate, endDate, ...(clientIds || [])];

    const [qRow] = await querySource<{
      total: number; avg_quality: number; avg_cx: number; avg_compliance: number;
    }>(`
      SELECT
        COUNT(*) AS total,
        ROUND(AVG(quality_percentage), 2) AS avg_quality,
        ROUND(AVG(
          (COALESCE(customer_concern_acknowledged,0) + COALESCE(express_empathy,0) +
           COALESCE(active_listening,0) + COALESCE(assurance_or_appreciation_provided,0) +
           COALESCE(politeness_and_no_sarcasm,0)) / 5.0 * 100
        ), 2) AS avg_cx,
        ROUND(AVG(
          (COALESCE(professionalism_maintained,0) + COALESCE(proper_hold_procedure,0) +
           COALESCE(correct_and_complete_information,0) + COALESCE(proper_call_closure,0) +
           COALESCE(address_recorded_completely,0)) / 5.0 * 100
        ), 2) AS avg_compliance
      FROM db_audit.call_quality_assessment
      WHERE CallDate BETWEEN ? AND ? ${clientFilter}
    `, params);

    if (qRow) {
      qualityKPIs = {
        totalAudited: Number(qRow.total) || 0,
        qualityScore: Number(qRow.avg_quality) || 0,
        customerExperience: Number(qRow.avg_cx) || 0,
        compliance: Number(qRow.avg_compliance) || 0,
      };
    }
  }

  // Outbound data from db_external
  let outboundKPIs = { totalCalls: 0, salesConversion: 0 };

  if (lob === 'All' || lob === 'Outbound') {
    const clientFilter = clientIds?.length
      ? `AND client_id IN (${clientIds.map(() => '?').join(',')})` : '';
    const params: (string | number | null)[] =[startDate, endDate, ...(clientIds || [])];

    const [oRow] = await querySource<{ total: number; conversion: number }>(`
      SELECT
        COUNT(*) AS total,
        ROUND(SUM(CASE WHEN SaleDone = '1' THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) AS conversion
      FROM db_external.CallDetails
      WHERE CallDate BETWEEN ? AND ? ${clientFilter}
    `, params);

    if (oRow) {
      outboundKPIs = {
        totalCalls: Number(oRow.total) || 0,
        salesConversion: Number(oRow.conversion) || 0,
      };
    }
  }

  // Platform stats from shivamgiri
  const [activeClients, activeProcesses, activeAgents] = await Promise.all([
    prisma.md_clients.count({ where: { is_active: true } }),
    prisma.md_processes.count({ where: { is_active: true } }),
    prisma.md_users.count({ where: { is_active: true, role: { name: { not: 'super_admin' } } } }),
  ]);

  return {
    totalCalls: outboundKPIs.totalCalls,
    totalAudited: qualityKPIs.totalAudited,
    qualityScore: qualityKPIs.qualityScore,
    customerExperience: qualityKPIs.customerExperience,
    compliance: qualityKPIs.compliance,
    salesConversion: outboundKPIs.salesConversion,
    activeClients,
    activeProcesses,
    activeAgents,
  };
}

// ─── Quality Trend ───────────────────────────────────────────────────────────

export async function getQualityTrend(filters: CallMasterFilters, period: 'daily' | 'weekly' | 'monthly' = 'daily') {
  const { startDate, endDate, clientIds } = filters;
  const clientFilter = clientIds?.length ? `AND ClientId IN (${clientIds.map(() => '?').join(',')})` : '';
  const params: (string | number | null)[] =[startDate, endDate, ...(clientIds || [])];

  const groupExpr = period === 'monthly'
    ? "DATE_FORMAT(CallDate, '%Y-%m')"
    : period === 'weekly'
    ? "DATE_FORMAT(CallDate, '%Y-%u')"
    : "DATE_FORMAT(CallDate, '%Y-%m-%d')";

  return querySource<{ period: string; quality: number; calls: number }>(`
    SELECT
      ${groupExpr} AS period,
      ROUND(AVG(quality_percentage), 2) AS quality,
      COUNT(*) AS calls
    FROM db_audit.call_quality_assessment
    WHERE CallDate BETWEEN ? AND ? ${clientFilter}
    GROUP BY ${groupExpr}
    ORDER BY period ASC
    LIMIT 90
  `, params);
}

// ─── Calls by Client ─────────────────────────────────────────────────────────

export async function getCallsByClient(filters: CallMasterFilters) {
  const { startDate, endDate, clientIds } = filters;

  // Quality (inbound)
  const qFilter = clientIds?.length ? `AND q.ClientId IN (${clientIds.map(() => '?').join(',')})` : '';
  const qRows = await querySource<{ client_name: string; audited: number; quality: number }>(`
    SELECT
      COALESCE(c.name, CONCAT('Client ', q.ClientId)) AS client_name,
      COUNT(*) AS audited,
      ROUND(AVG(q.quality_percentage), 2) AS quality
    FROM db_audit.call_quality_assessment q
    LEFT JOIN shivamgiri.md_clients c ON c.dialdesk_client_id = CAST(q.ClientId AS UNSIGNED)
    WHERE q.CallDate BETWEEN ? AND ? ${qFilter}
    GROUP BY q.ClientId, c.name
    ORDER BY audited DESC
    LIMIT 20
  `, [startDate, endDate, ...(clientIds || [])]);

  // Outbound calls
  const oFilter = clientIds?.length ? `AND cd.client_id IN (${clientIds.map(() => '?').join(',')})` : '';
  const oRows = await querySource<{ client_name: string; calls: number; sales: number }>(`
    SELECT
      COALESCE(c.name, CONCAT('Client ', cd.client_id)) AS client_name,
      COUNT(*) AS calls,
      SUM(CASE WHEN cd.SaleDone = '1' THEN 1 ELSE 0 END) AS sales
    FROM db_external.CallDetails cd
    LEFT JOIN shivamgiri.md_clients c ON c.dialdesk_client_id = cd.client_id
    WHERE cd.CallDate BETWEEN ? AND ? ${oFilter}
    GROUP BY cd.client_id, c.name
    ORDER BY calls DESC
    LIMIT 20
  `, [startDate, endDate, ...(clientIds || [])]);

  return { inbound: qRows, outbound: oRows };
}

// ─── Calls by Hour ───────────────────────────────────────────────────────────

export async function getCallsByHour(filters: CallMasterFilters) {
  const { startDate, endDate, clientIds } = filters;
  const results: Record<number, { hour: number; inbound: number; outbound: number }> = {};
  for (let i = 0; i < 24; i++) results[i] = { hour: i, inbound: 0, outbound: 0 };

  const qFilter = clientIds?.length ? `AND ClientId IN (${clientIds.map(() => '?').join(',')})` : '';
  const qRows = await querySource<{ hour: number; cnt: number }>(`
    SELECT HOUR(CallDate) AS hour, COUNT(*) AS cnt
    FROM db_audit.call_quality_assessment
    WHERE CallDate BETWEEN ? AND ? ${qFilter}
    GROUP BY HOUR(CallDate)
  `, [startDate, endDate, ...(clientIds || [])]);

  const oFilter = clientIds?.length ? `AND client_id IN (${clientIds.map(() => '?').join(',')})` : '';
  const oRows = await querySource<{ hour: number; cnt: number }>(`
    SELECT HOUR(CallDate) AS hour, COUNT(*) AS cnt
    FROM db_external.CallDetails
    WHERE CallDate BETWEEN ? AND ? ${oFilter}
    GROUP BY HOUR(CallDate)
  `, [startDate, endDate, ...(clientIds || [])]);

  qRows.forEach((r) => { results[r.hour].inbound = Number(r.cnt); });
  oRows.forEach((r) => { results[r.hour].outbound = Number(r.cnt); });

  return Object.values(results).map((r) => ({
    hour: `${String(r.hour).padStart(2, '0')}:00`,
    inbound: r.inbound,
    outbound: r.outbound,
    total: r.inbound + r.outbound,
  }));
}

// ─── Calls by Day of Week ─────────────────────────────────────────────────────

export async function getCallsByDay(filters: CallMasterFilters) {
  const { startDate, endDate, clientIds } = filters;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const results: Record<number, { day: string; inbound: number; outbound: number }> = {};
  days.forEach((d, i) => { results[i] = { day: d, inbound: 0, outbound: 0 }; });

  const qFilter = clientIds?.length ? `AND ClientId IN (${clientIds.map(() => '?').join(',')})` : '';
  const qRows = await querySource<{ dow: number; cnt: number }>(`
    SELECT (DAYOFWEEK(CallDate) - 1) AS dow, COUNT(*) AS cnt
    FROM db_audit.call_quality_assessment
    WHERE CallDate BETWEEN ? AND ? ${qFilter}
    GROUP BY (DAYOFWEEK(CallDate) - 1)
  `, [startDate, endDate, ...(clientIds || [])]);

  const oFilter = clientIds?.length ? `AND client_id IN (${clientIds.map(() => '?').join(',')})` : '';
  const oRows = await querySource<{ dow: number; cnt: number }>(`
    SELECT (DAYOFWEEK(CallDate) - 1) AS dow, COUNT(*) AS cnt
    FROM db_external.CallDetails
    WHERE CallDate BETWEEN ? AND ? ${oFilter}
    GROUP BY (DAYOFWEEK(CallDate) - 1)
  `, [startDate, endDate, ...(clientIds || [])]);

  qRows.forEach((r) => { results[r.dow].inbound = Number(r.cnt); });
  oRows.forEach((r) => { results[r.dow].outbound = Number(r.cnt); });

  return Object.values(results);
}

// ─── Top/Bottom Agents ────────────────────────────────────────────────────────

export async function getTopAgents(filters: CallMasterFilters, limit = 10) {
  const { startDate, endDate, clientIds } = filters;
  const clientFilter = clientIds?.length ? `AND ClientId IN (${clientIds.map(() => '?').join(',')})` : '';
  const params: (string | number | null)[] =[startDate, endDate, ...(clientIds || [])];

  const top = await querySource<{ agent: string; calls: number; quality: number; compliance: number }>(`
    SELECT
      User AS agent,
      COUNT(*) AS calls,
      ROUND(AVG(quality_percentage), 2) AS quality,
      ROUND(AVG(
        (COALESCE(professionalism_maintained,0) + COALESCE(correct_and_complete_information,0) +
         COALESCE(proper_call_closure,0)) / 3.0 * 100
      ), 2) AS compliance
    FROM db_audit.call_quality_assessment
    WHERE CallDate BETWEEN ? AND ? ${clientFilter}
    GROUP BY User
    HAVING calls >= 3
    ORDER BY quality DESC
    LIMIT ${limit}
  `, params);

  const bottom = await querySource<{ agent: string; calls: number; quality: number; compliance: number }>(`
    SELECT
      User AS agent,
      COUNT(*) AS calls,
      ROUND(AVG(quality_percentage), 2) AS quality,
      ROUND(AVG(
        (COALESCE(professionalism_maintained,0) + COALESCE(correct_and_complete_information,0) +
         COALESCE(proper_call_closure,0)) / 3.0 * 100
      ), 2) AS compliance
    FROM db_audit.call_quality_assessment
    WHERE CallDate BETWEEN ? AND ? ${clientFilter}
    GROUP BY User
    HAVING calls >= 3
    ORDER BY quality ASC
    LIMIT ${limit}
  `, params);

  return { top, bottom };
}

// ─── Sales Funnel ─────────────────────────────────────────────────────────────

export async function getSalesFunnel(filters: CallMasterFilters) {
  const { startDate, endDate, clientIds } = filters;
  const clientFilter = clientIds?.length ? `AND client_id IN (${clientIds.map(() => '?').join(',')})` : '';

  const [row] = await querySource<{
    total: number; offered: number; objection: number; upsell: number; sold: number;
  }>(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN Opening = '1' OR Opening = 1 THEN 1 ELSE 0 END) AS offered,
      SUM(CASE WHEN ObjectionHandling = '1' OR ObjectionHandling = 1 THEN 1 ELSE 0 END) AS objection,
      SUM(CASE WHEN UpsellingEfforts = '1' OR UpsellingEfforts = 1 THEN 1 ELSE 0 END) AS upsell,
      SUM(CASE WHEN SaleDone = '1' OR SaleDone = 1 THEN 1 ELSE 0 END) AS sold
    FROM db_external.CallDetails
    WHERE CallDate BETWEEN ? AND ? ${clientFilter}
  `, [startDate, endDate, ...(clientIds || [])]);

  if (!row) return [];

  const total = Number(row.total) || 1;
  return [
    { stage: 'Total Calls', value: Number(row.total), pct: 100 },
    { stage: 'Offer Presented', value: Number(row.offered), pct: Math.round(Number(row.offered) / total * 100) },
    { stage: 'Objection Handled', value: Number(row.objection), pct: Math.round(Number(row.objection) / total * 100) },
    { stage: 'Upsell Attempted', value: Number(row.upsell), pct: Math.round(Number(row.upsell) / total * 100) },
    { stage: 'Sale Completed', value: Number(row.sold), pct: Math.round(Number(row.sold) / total * 100) },
  ];
}

// ─── CX Parameters ────────────────────────────────────────────────────────────

export const INBOUND_PARAMS = [
  { key: 'call_answered_within_5_seconds',   label: 'Answered ≤5s' },
  { key: 'customer_concern_acknowledged',    label: 'Concern Acknowledged' },
  { key: 'professionalism_maintained',       label: 'Professionalism' },
  { key: 'assurance_or_appreciation_provided', label: 'Assurance' },
  { key: 'pronunciation_and_clarity',        label: 'Pronunciation & Clarity' },
  { key: 'enthusiasm_and_no_fumbling',       label: 'Enthusiasm' },
  { key: 'active_listening',                 label: 'Active Listening' },
  { key: 'politeness_and_no_sarcasm',        label: 'Politeness' },
  { key: 'proper_grammar',                   label: 'Proper Grammar' },
  { key: 'accurate_issue_probing',           label: 'Issue Probing' },
  { key: 'proper_hold_procedure',            label: 'Hold Procedure' },
  { key: 'proper_transfer_and_language',     label: 'Transfer & Language' },
  { key: 'dead_air_under_10_seconds',        label: 'Dead Air <10s' },
  { key: 'case_escalated_correctly',         label: 'Escalation' },
  { key: 'address_recorded_completely',      label: 'Address Recorded' },
  { key: 'correct_and_complete_information', label: 'Correct Info' },
  { key: 'upselling_or_offers_suggested',    label: 'Upselling' },
  { key: 'further_assistance_offered',       label: 'Further Assistance' },
  { key: 'proper_call_closure',              label: 'Call Closure' },
] as const;

export const OUTBOUND_PARAMS = [
  { key: 'Opening',           label: 'Opening' },
  { key: 'Offered',           label: 'Offer Presented' },
  { key: 'ObjectionHandling', label: 'Objection Handling' },
  { key: 'PrepaidPitch',      label: 'Prepaid Pitch' },
  { key: 'UpsellingEfforts',  label: 'Upselling Efforts' },
  { key: 'OfferUrgency',      label: 'Offer Urgency' },
] as const;

export async function getCXParameters(filters: CallMasterFilters) {
  const { startDate, endDate, clientIds } = filters;
  const ibFilter = clientIds?.length ? `AND ClientId IN (${clientIds.map(() => '?').join(',')})` : '';
  const obFilter = clientIds?.length ? `AND client_id IN (${clientIds.map(() => '?').join(',')})` : '';
  const ibParams: (string | number | null)[] = [startDate, endDate, ...(clientIds || [])];
  const obParams: (string | number | null)[] = [startDate, endDate, ...(clientIds || [])];

  // Inbound: all 19 parameters
  const ibSelect = INBOUND_PARAMS
    .map(p => `ROUND(AVG(COALESCE(\`${p.key}\`,0))*100,1) AS \`${p.key}\``)
    .join(', ');

  const [ibRow] = await querySource<Record<string, number>>(`
    SELECT ${ibSelect}
    FROM db_audit.call_quality_assessment
    WHERE CallDate BETWEEN ? AND ? ${ibFilter}
  `, ibParams);

  const inbound = INBOUND_PARAMS.map(p => ({
    parameter: p.label,
    key: p.key,
    score: ibRow ? (Number(ibRow[p.key]) || 0) : 0,
  }));

  // Outbound: 6 parameters
  const [obRow] = await querySource<Record<string, number>>(`
    SELECT
      ROUND(AVG(CASE WHEN Opening=1           OR Opening='1'           THEN 1 ELSE 0 END)*100,1) AS Opening,
      ROUND(AVG(CASE WHEN Offered=1           OR Offered='1'           THEN 1 ELSE 0 END)*100,1) AS Offered,
      ROUND(AVG(CASE WHEN ObjectionHandling=1 OR ObjectionHandling='1' THEN 1 ELSE 0 END)*100,1) AS ObjectionHandling,
      ROUND(AVG(CASE WHEN PrepaidPitch=1      OR PrepaidPitch='1'      THEN 1 ELSE 0 END)*100,1) AS PrepaidPitch,
      ROUND(AVG(CASE WHEN UpsellingEfforts=1  OR UpsellingEfforts='1'  THEN 1 ELSE 0 END)*100,1) AS UpsellingEfforts,
      ROUND(AVG(CASE WHEN OfferUrgency=1      OR OfferUrgency='1'      THEN 1 ELSE 0 END)*100,1) AS OfferUrgency
    FROM db_external.CallDetails
    WHERE CallDate BETWEEN ? AND ? ${obFilter}
  `, obParams);

  const outbound = OUTBOUND_PARAMS.map(p => ({
    parameter: p.label,
    key: p.key,
    score: obRow ? (Number(obRow[p.key]) || 0) : 0,
  }));

  // Scenario distribution (QRC + Sale) from inbound
  const scenarioRows = await querySource<{ scenario: string; cnt: number }>(`
    SELECT scenario, COUNT(*) AS cnt
    FROM db_audit.call_quality_assessment
    WHERE CallDate BETWEEN ? AND ? ${ibFilter}
      AND scenario IS NOT NULL AND scenario != ''
    GROUP BY scenario
    ORDER BY cnt DESC
  `, ibParams);

  const scenario = scenarioRows.map(r => ({
    name: String(r.scenario),
    value: Number(r.cnt),
  }));

  return { inbound, outbound, scenario };
}

// ─── Agent Parameter Drill-down ───────────────────────────────────────────────

export async function getAgentParams(agentName: string, filters: CallMasterFilters) {
  const { startDate, endDate, clientIds } = filters;
  const clientFilter = clientIds?.length ? `AND ClientId IN (${clientIds.map(() => '?').join(',')})` : '';
  const params: (string | number | null)[] = [startDate, endDate, agentName, ...(clientIds || [])];

  const ibSelect = INBOUND_PARAMS
    .map(p => `ROUND(AVG(COALESCE(\`${p.key}\`,0))*100,1) AS \`${p.key}\``)
    .join(', ');

  const [row] = await querySource<Record<string, number>>(`
    SELECT ${ibSelect}
    FROM db_audit.call_quality_assessment
    WHERE CallDate BETWEEN ? AND ? AND User = ? ${clientFilter}
  `, params);

  if (!row) return [];

  return INBOUND_PARAMS.map(p => ({
    parameter: p.label,
    key: p.key,
    score: Number(row[p.key]) || 0,
  }));
}

// ─── Calls by Month ───────────────────────────────────────────────────────────

export async function getCallsByMonth(filters: CallMasterFilters) {
  const { startDate, endDate, clientIds } = filters;

  const qFilter = clientIds?.length ? `AND ClientId IN (${clientIds.map(() => '?').join(',')})` : '';
  const oFilter = clientIds?.length ? `AND client_id IN (${clientIds.map(() => '?').join(',')})` : '';

  const [inbound, outbound] = await Promise.all([
    querySource<{ month: string; calls: number }>(`
      SELECT DATE_FORMAT(CallDate, '%Y-%m') AS month, COUNT(*) AS calls
      FROM db_audit.call_quality_assessment
      WHERE CallDate BETWEEN ? AND ? ${qFilter}
      GROUP BY month ORDER BY month ASC LIMIT 24
    `, [startDate, endDate, ...(clientIds || [])]),
    querySource<{ month: string; calls: number; sales: number }>(`
      SELECT
        DATE_FORMAT(CallDate, '%Y-%m') AS month,
        COUNT(*) AS calls,
        SUM(CASE WHEN SaleDone='1' THEN 1 ELSE 0 END) AS sales
      FROM db_external.CallDetails
      WHERE CallDate BETWEEN ? AND ? ${oFilter}
      GROUP BY month ORDER BY month ASC LIMIT 24
    `, [startDate, endDate, ...(clientIds || [])]),
  ]);

  // Merge by month
  const months: Record<string, { month: string; inbound: number; outbound: number; sales: number }> = {};
  inbound.forEach((r) => { months[r.month] = { month: r.month, inbound: Number(r.calls), outbound: 0, sales: 0 }; });
  outbound.forEach((r) => {
    if (!months[r.month]) months[r.month] = { month: r.month, inbound: 0, outbound: 0, sales: 0 };
    months[r.month].outbound = Number(r.calls);
    months[r.month].sales = Number(r.sales);
  });

  return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
}
