import { querySource } from '../../lib/sourceDb';

// ─── Simple in-memory cache (2-min TTL) ──────────────────────────────────────
const _cache = new Map<string, { value: unknown; exp: number }>();
function cacheGet<T>(key: string): T | null {
  const e = _cache.get(key);
  if (!e || Date.now() > e.exp) { _cache.delete(key); return null; }
  return e.value as T;
}
function cacheSet(key: string, value: unknown, ttlMs = 120_000) {
  _cache.set(key, { value, exp: Date.now() + ttlMs });
}

// ─── Concurrency limiter: run tasks in batches to protect DB connection pool ──
async function batchRun<T>(tasks: (() => Promise<T>)[], batchSize = 3): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(t => t()));
    results.push(...batchResults);
  }
  return results;
}

export interface InboundFilters {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;
}

export interface ProjectDailyRow {
  key: string;
  name: string;
  icon: string;
  color: string;
  date: string;
  offered: number;
  answered: number;
  al: number;
  sl: number;
  acht: number;
  repeat_pct: number;
  login_count: number;
  fcr_pct: number | null;
  deficit: number;
}

// ─── Project Config ────────────────────────────────────────────────────────────

interface ProjectConfig {
  key: string;
  name: string;
  icon: string;
  color: string;
  table: string;
  pattern: 'A' | 'B';
  campaigns: string[];
  mandate: number;
  required: number;
  hasFCR: boolean;
  fcrClientId?: number;
  hourlyTimeField?: string; // column with actual call time when CallDate has no time component
}

const PROJECTS: ProjectConfig[] = [
  {
    key: 'gnc',
    name: 'GNC',
    icon: '🛒',
    color: '#2E86C1',
    table: 'cdr_in_4',
    pattern: 'A',
    campaigns: ['GNC_Order_Related', 'GNC_Product_Quality', 'GNC_Other_Queries', 'GNC_Product_Info', 'GNC_Offer_Order', 'GNC_Authentication'],
    mandate: 8,
    required: 6,
    hasFCR: false,
    hourlyTimeField: 'Time',
  },
  {
    key: 'bellavita',
    name: 'Bellavita',
    icon: '🌸',
    color: '#E67E22',
    table: 'cdr_in_11_5',
    pattern: 'A',
    campaigns: ['H_Bellavita_Luxury', 'E_Bellavita_Organic', 'E_Bellavita_Luxury', 'H_Bellavita_Organic', 'H_Bevzilla_Complaint', 'H_Bevzilla_CC_Agent', 'E_Bevzilla_CC_Agent', 'H_Bevzilla_Order', 'E_Bevzilla_Order', 'E_Bevzilla_Complaint', 'E_Emb_Existing_Order', 'H_Bevzilla_Product', 'H_Emb_New_Order', 'H_Emb_Existing_Order', 'E_Bevzilla_Product', 'E_Emb_New_Order'],
    mandate: 14,
    required: 12,
    hasFCR: false,
    hourlyTimeField: 'Time',
  },
  {
    key: 'clovia',
    name: 'Clovia',
    icon: '👗',
    color: '#27AE60',
    table: 'cdr_in_250',
    pattern: 'A',
    campaigns: ['Clovia_English', 'Clovia_Hindi'],
    mandate: 7,
    required: 6,
    hasFCR: false,
    hourlyTimeField: 'Time',
  },
  {
    key: 'neemans',
    name: "Neemans",
    icon: '👟',
    color: '#8E44AD',
    table: 'cdr_in_249',
    pattern: 'B',
    campaigns: ['Neemans_IB'],
    mandate: 10,
    required: 10,
    hasFCR: true,
    fcrClientId: 475,
    hourlyTimeField: 'Time',
  },
  {
    key: 'viega',
    name: 'Viega',
    icon: '🚰',
    color: '#E74C3C',
    table: 'cdr_in_249',
    pattern: 'B',
    campaigns: ['Viega'],
    mandate: 2,
    required: 2,
    hasFCR: false,
    hourlyTimeField: 'Time',
  },
  {
    key: 'exicom',
    name: 'Exicom',
    icon: '⚡',
    color: '#3498DB',
    table: 'cdr_in_9',
    pattern: 'B',
    campaigns: ['Exicom_TC_Battery', 'Exicom_EV_Battery', 'EV_Charger833'],
    mandate: 5,
    required: 5,
    hasFCR: false,
    hourlyTimeField: 'Time',
  },
  {
    key: 'dubangladesh',
    name: 'DU Bangladesh',
    icon: '🇧🇩',
    color: '#F39C12',
    table: 'cdr_in_4',
    pattern: 'B',
    campaigns: ['DU_Bangladesh_Bangla', 'DU_Bangladesh_Eng', 'DU_Bangladesh_Hindi'],
    mandate: 3,
    required: 3,
    hasFCR: false,
    hourlyTimeField: 'Time',
  },
];

// ─── Query builders ────────────────────────────────────────────────────────────

function buildPatternAQuery(p: ProjectConfig): string {
  const inPlaceholders = p.campaigns.map(() => '?').join(',');
  // WHERE already filters to the right campaigns — no need to repeat IN inside CASE
  return `
    SELECT
      DATE(CallDate) AS date,
      COUNT(DISTINCT CASE WHEN DisconnBy != 'HOLDTIME' THEN AgentId  END) AS login_count,
      SUM(CASE WHEN DisconnBy != 'HOLDTIME' THEN 1 ELSE 0 END)           AS offered,
      SUM(CASE WHEN (AgentId != 'VDCL' AND DisconnBy != 'HOLDTIME')
               OR   (AgentId = 'VDCL'  AND TIME_TO_SEC(QueueDuration) = 0) THEN 1 ELSE 0 END) AS answered,
      SUM(CASE WHEN TIME_TO_SEC(QueueDuration) <= 20 AND DisconnBy != 'HOLDTIME'
               AND (AgentId != 'VDCL' OR (AgentId = 'VDCL' AND TIME_TO_SEC(QueueDuration) = 0)) THEN 1 ELSE 0 END) AS sl_num,
      ROUND(AVG(CASE WHEN DisconnBy != 'HOLDTIME' THEN CallDurationSecond END), 0) AS acht,
      COUNT(DISTINCT CASE WHEN DisconnBy != 'HOLDTIME' THEN PhoneNumber END) AS unique_phones
    FROM dialer_db.${p.table}
    WHERE CallDate >= ? AND CallDate < DATE_ADD(DATE(?), INTERVAL 1 DAY)
      AND CampaignName IN (${inPlaceholders})
    GROUP BY DATE(CallDate)
    ORDER BY date DESC
  `;
}

function buildPatternBQuery(p: ProjectConfig): string {
  const inPlaceholders = p.campaigns.map(() => '?').join(',');
  return `
    SELECT
      DATE(CallDate) AS date,
      COUNT(DISTINCT CASE WHEN AgentId != 'VDCL' THEN AgentId END) AS login_count,
      COUNT(*) AS offered,
      SUM(CASE WHEN AgentId != 'VDCL' THEN 1 ELSE 0 END) AS answered,
      SUM(CASE WHEN AgentId != 'VDCL' AND TIME_TO_SEC(QueueDuration) <= 30 THEN 1 ELSE 0 END) AS sl_num,
      ROUND(AVG(CallDurationSecond), 0) AS acht,
      COUNT(DISTINCT PhoneNumber) AS unique_phones
    FROM dialer_db.${p.table}
    WHERE CallDate >= ? AND CallDate < DATE_ADD(DATE(?), INTERVAL 1 DAY)
      AND CampaignName IN (${inPlaceholders})
    GROUP BY DATE(CallDate)
    ORDER BY date DESC
  `;
}

function buildFCRQuery(): string {
  return `
    SELECT
      DATE(CallDate) AS date,
      ROUND(100 * SUM(CASE WHEN Field2='FCR' THEN 1 ELSE 0 END) / NULLIF(COUNT(Field2), 0), 2) AS fcr_pct
    FROM dialer_db.data_master_in
    WHERE CallDate >= ? AND CallDate < DATE_ADD(DATE(?), INTERVAL 1 DAY)
      AND ClientId = ?
      AND Field1 = 'Inbound'
    GROUP BY DATE(CallDate)
  `;
}

// Pattern A: CASE expressions no longer repeat campaigns — only WHERE needs them
function buildPatternAParams(p: ProjectConfig, startDate: string, endDate: string): (string | number)[] {
  return [
    startDate,      // WHERE CallDate >=
    endDate,        // WHERE DATE_ADD(DATE(?), ...)
    ...p.campaigns, // WHERE CampaignName IN
  ];
}

// Pattern B: WHERE CallDate >= ? AND CallDate < DATE_ADD(DATE(?), INTERVAL 1 DAY)
function buildPatternBParams(p: ProjectConfig, startDate: string, endDate: string): (string | number)[] {
  return [
    startDate,      // WHERE CallDate >=
    endDate,        // WHERE DATE_ADD(DATE(?), ...)
    ...p.campaigns, // WHERE CampaignName IN
  ];
}

// ─── Row normalizer ────────────────────────────────────────────────────────────

interface RawRow {
  date: string;
  login_count: number;
  offered: number;
  answered: number;
  sl_num: number;
  acht: number;
  unique_phones: number;
}

function normalizeRow(raw: RawRow, p: ProjectConfig, fcr: number | null = null): Omit<ProjectDailyRow, 'date'> & { date: string } {
  const offered = Number(raw.offered) || 0;
  const answered = Number(raw.answered) || 0;
  const sl_num = Number(raw.sl_num) || 0;
  const unique_phones = Number(raw.unique_phones) || 0;
  const login_count = Number(raw.login_count) || 0;
  const acht = Number(raw.acht) || 0;

  const al = offered > 0 ? Math.round(answered * 10000 / offered) / 100 : 0;
  const sl = offered > 0 ? Math.round(sl_num * 10000 / offered) / 100 : 0;
  const repeat_pct = offered > 0 ? Math.round((offered - unique_phones) * 10000 / offered) / 100 : 0;
  const deficit = p.required - login_count;

  return {
    key: p.key,
    name: p.name,
    icon: p.icon,
    color: p.color,
    date: String(raw.date),
    offered,
    answered,
    al,
    sl,
    acht,
    repeat_pct,
    login_count,
    fcr_pct: fcr,
    deficit,
  };
}

// ─── Project metadata export ───────────────────────────────────────────────────

export function getProjectsMeta() {
  return PROJECTS.map(p => ({
    key: p.key,
    name: p.name,
    icon: p.icon,
    color: p.color,
    mandate: p.mandate,
    required: p.required,
    hasFCR: p.hasFCR,
  }));
}

// ─── Hourly query builders ─────────────────────────────────────────────────────

function buildPatternAHourlyQuery(p: ProjectConfig): string {
  const inPlaceholders = p.campaigns.map(() => '?').join(',');
  const hourExpr = p.hourlyTimeField ? `HOUR(${p.hourlyTimeField})` : 'HOUR(CallDate)';
  return `
    SELECT
      ${hourExpr} AS hour,
      SUM(CASE WHEN DisconnBy != 'HOLDTIME' THEN 1 ELSE 0 END) AS offered,
      SUM(CASE WHEN (AgentId != 'VDCL' AND DisconnBy != 'HOLDTIME')
               OR   (AgentId = 'VDCL'  AND TIME_TO_SEC(QueueDuration) = 0) THEN 1 ELSE 0 END) AS answered,
      SUM(CASE WHEN TIME_TO_SEC(QueueDuration) <= 20 AND DisconnBy != 'HOLDTIME'
               AND (AgentId != 'VDCL' OR (AgentId = 'VDCL' AND TIME_TO_SEC(QueueDuration) = 0)) THEN 1 ELSE 0 END) AS sl_num
    FROM dialer_db.${p.table}
    WHERE CallDate >= ? AND CallDate < DATE_ADD(?, INTERVAL 1 DAY)
      AND CampaignName IN (${inPlaceholders})
    GROUP BY ${hourExpr}
    ORDER BY hour ASC
  `;
}

function buildPatternBHourlyQuery(p: ProjectConfig): string {
  const inPlaceholders = p.campaigns.map(() => '?').join(',');
  const hourExpr = p.hourlyTimeField ? `HOUR(${p.hourlyTimeField})` : 'HOUR(CallDate)';
  return `
    SELECT
      ${hourExpr} AS hour,
      COUNT(*) AS offered,
      SUM(CASE WHEN AgentId != 'VDCL' THEN 1 ELSE 0 END) AS answered,
      SUM(CASE WHEN AgentId != 'VDCL' AND TIME_TO_SEC(QueueDuration) <= 30 THEN 1 ELSE 0 END) AS sl_num
    FROM dialer_db.${p.table}
    WHERE CallDate >= ? AND CallDate < DATE_ADD(?, INTERVAL 1 DAY)
      AND CampaignName IN (${inPlaceholders})
    GROUP BY ${hourExpr}
    ORDER BY hour ASC
  `;
}

// Pattern A hourly: CASE expressions no longer repeat campaigns
function buildPatternAHourlyParams(p: ProjectConfig, date: string): (string | number)[] {
  return [
    date,           // WHERE CallDate >=
    date,           // WHERE DATE_ADD(?, ...)
    ...p.campaigns, // WHERE CampaignName IN
  ];
}

// Pattern B hourly: [date (>=), date (DATE_ADD), campaigns (WHERE)]
function buildPatternBHourlyParams(p: ProjectConfig, date: string): (string | number)[] {
  return [date, date, ...p.campaigns];
}

export interface HourlyRow {
  hour: number;
  offered: number;
  answered: number;
  al: number;
  sl: number;
}

export async function getProjectHourly(projectKey: string, date: string): Promise<HourlyRow[]> {
  const p = PROJECTS.find(proj => proj.key === projectKey);
  if (!p) return [];

  let sql: string;
  let params: (string | number)[];
  if (p.pattern === 'A') {
    sql = buildPatternAHourlyQuery(p);
    params = buildPatternAHourlyParams(p, date);
  } else {
    sql = buildPatternBHourlyQuery(p);
    params = buildPatternBHourlyParams(p, date);
  }

  interface RawHourRow { hour: number; offered: number; answered: number; sl_num: number; }
  const rows = await querySource<RawHourRow>(sql, params);

  return rows.map(r => {
    const offered = Number(r.offered) || 0;
    const answered = Number(r.answered) || 0;
    const sl_num = Number(r.sl_num) || 0;
    const al = offered > 0 ? Math.round(answered * 10000 / offered) / 100 : 0;
    const sl = offered > 0 ? Math.round(sl_num * 10000 / offered) / 100 : 0;
    return { hour: Number(r.hour), offered, answered, al, sl };
  });
}

// ─── getProjectSummary ─────────────────────────────────────────────────────────

export async function getProjectSummary(filters: InboundFilters, projectKey?: string): Promise<ProjectDailyRow[]> {
  const { startDate, endDate } = filters;
  const cacheKey = `summary:${projectKey ?? 'all'}:${startDate}:${endDate}`;
  const cached = cacheGet<ProjectDailyRow[]>(cacheKey);
  if (cached) return cached;

  const projectsToQuery = projectKey ? PROJECTS.filter(p => p.key === projectKey) : PROJECTS;

  const results = await batchRun(
    projectsToQuery.map((p) => async () => {
      let sql: string;
      let params: (string | number)[];

      if (p.pattern === 'A') {
        sql = buildPatternAQuery(p);
        params = buildPatternAParams(p, startDate, endDate);
      } else {
        sql = buildPatternBQuery(p);
        params = buildPatternBParams(p, startDate, endDate);
      }

      const rows = await querySource<RawRow>(sql, params);

      // Aggregate all days into one summary row
      let totalOffered = 0;
      let totalAnswered = 0;
      let totalSlNum = 0;
      let totalUniquePhones = 0;
      let totalLoginCount = 0;
      let weightedAcht = 0;

      for (const r of rows) {
        const offered = Number(r.offered) || 0;
        totalOffered += offered;
        totalAnswered += Number(r.answered) || 0;
        totalSlNum += Number(r.sl_num) || 0;
        totalUniquePhones += Number(r.unique_phones) || 0;
        totalLoginCount = Math.max(totalLoginCount, Number(r.login_count) || 0);
        weightedAcht += (Number(r.acht) || 0) * offered;
      }

      const acht = totalOffered > 0 ? Math.round(weightedAcht / totalOffered) : 0;

      const syntheticRaw: RawRow = {
        date: endDate,
        login_count: totalLoginCount,
        offered: totalOffered,
        answered: totalAnswered,
        sl_num: totalSlNum,
        acht,
        unique_phones: totalUniquePhones,
      };

      // FCR for Neemans
      let fcrPct: number | null = null;
      if (p.hasFCR && p.fcrClientId) {
        const fcrRows = await querySource<{ date: string; fcr_pct: number }>(
          buildFCRQuery(),
          [startDate, endDate, p.fcrClientId]
        );
        if (fcrRows.length > 0) {
          const totalFcr = fcrRows.reduce((sum, r) => sum + (Number(r.fcr_pct) || 0), 0);
          fcrPct = Math.round((totalFcr / fcrRows.length) * 100) / 100;
        }
      }

      return normalizeRow(syntheticRaw, p, fcrPct);
    })
  );

  cacheSet(cacheKey, results);
  return results;
}

// ─── getProjectTrend ───────────────────────────────────────────────────────────

export interface TrendProject {
  key: string;
  name: string;
  color: string;
  rows: {
    date: string;
    offered: number;
    answered: number;
    al: number;
    sl: number;
    acht: number;
    repeat_pct: number;
    fcr_pct: number | null;
    login_count: number;
  }[];
}

export interface ConsolidatedTrendRow {
  date: string;
  offered: number;
  answered: number;
  al: number;
  sl: number;
  acht: number;
  total_login: number;
}

export async function getProjectTrend(filters: InboundFilters, projectKey?: string): Promise<TrendProject[]> {
  const { startDate, endDate } = filters;
  const cacheKey = `trend:${projectKey ?? 'all'}:${startDate}:${endDate}`;
  const cached = cacheGet<TrendProject[]>(cacheKey);
  if (cached) return cached;
  const projectsToQuery = projectKey ? PROJECTS.filter(p => p.key === projectKey) : PROJECTS;

  const results = await batchRun(
    projectsToQuery.map((p) => async () => {
      let sql: string;
      let params: (string | number)[];

      if (p.pattern === 'A') {
        sql = buildPatternAQuery(p);
        params = buildPatternAParams(p, startDate, endDate);
      } else {
        sql = buildPatternBQuery(p);
        params = buildPatternBParams(p, startDate, endDate);
      }

      const rows = await querySource<RawRow>(sql, params);

      // FCR map for Neemans
      const fcrMap = new Map<string, number>();
      if (p.hasFCR && p.fcrClientId) {
        const fcrRows = await querySource<{ date: string; fcr_pct: number }>(
          buildFCRQuery(),
          [startDate, endDate, p.fcrClientId]
        );
        for (const r of fcrRows) {
          const d = (r.date as unknown) instanceof Date
            ? `${(r.date as unknown as Date).getUTCFullYear()}-${String((r.date as unknown as Date).getUTCMonth()+1).padStart(2,'0')}-${String((r.date as unknown as Date).getUTCDate()).padStart(2,'0')}`
            : String(r.date).slice(0, 10);
          fcrMap.set(d, Number(r.fcr_pct) || 0);
        }
      }

      const trendRows = rows.map((r) => {
        const rawDate = r.date as unknown;
        const dateStr = rawDate instanceof Date
          ? `${rawDate.getUTCFullYear()}-${String(rawDate.getUTCMonth()+1).padStart(2,'0')}-${String(rawDate.getUTCDate()).padStart(2,'0')}`
          : String(rawDate).slice(0, 10);
        const offered = Number(r.offered) || 0;
        const answered = Number(r.answered) || 0;
        const sl_num = Number(r.sl_num) || 0;
        const unique_phones = Number(r.unique_phones) || 0;
        const acht = Number(r.acht) || 0;

        const al = offered > 0 ? Math.round(answered * 10000 / offered) / 100 : 0;
        const sl = offered > 0 ? Math.round(sl_num * 10000 / offered) / 100 : 0;
        const repeat_pct = offered > 0 ? Math.round((offered - unique_phones) * 10000 / offered) / 100 : 0;
        const fcr_pct = p.hasFCR ? (fcrMap.get(dateStr) ?? null) : null;

        return { date: dateStr, offered, answered, al, sl, acht, repeat_pct, fcr_pct, login_count: Number(r.login_count) || 0 };
      });

      return { key: p.key, name: p.name, color: p.color, rows: trendRows };
    })
  );

  cacheSet(cacheKey, results, 5 * 60_000); // trend is heavier — 5-min TTL
  return results;
}

// ─── getConsolidatedTrend ─────────────────────────────────────────────────────

export async function getConsolidatedTrend(filters: InboundFilters): Promise<ConsolidatedTrendRow[]> {
  const allTrends = await getProjectTrend(filters);

  const dateMap = new Map<string, {
    offered: number; answered: number; sl_num: number; acht_weighted: number; login: number;
  }>();

  for (const project of allTrends) {
    for (const row of project.rows) {
      const d = dateMap.get(row.date) ?? { offered: 0, answered: 0, sl_num: 0, acht_weighted: 0, login: 0 };
      d.offered += row.offered;
      d.answered += row.answered;
      d.sl_num += row.offered > 0 ? Math.round(row.sl * row.offered / 100) : 0;
      d.acht_weighted += (row.acht || 0) * row.offered;
      d.login += row.login_count;
      dateMap.set(row.date, d);
    }
  }

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      offered: d.offered,
      answered: d.answered,
      al: d.offered > 0 ? Math.round(d.answered * 10000 / d.offered) / 100 : 0,
      sl: d.offered > 0 ? Math.round(d.sl_num * 10000 / d.offered) / 100 : 0,
      acht: d.offered > 0 ? Math.round(d.acht_weighted / d.offered) : 0,
      total_login: d.login,
    }));
}

// ─── getConsolidatedToday ──────────────────────────────────────────────────────

export async function getConsolidatedToday(): Promise<ProjectDailyRow[]> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return getProjectSummary({ startDate: today, endDate: today });
}

// ─── getAgentSummary ──────────────────────────────────────────────────────────

export interface AgentRow {
  agent_id:   string;
  agent_name: string;
  offered:    number;
  answered:   number;
  al:         number;
  sl:         number;
  acht:       number;
  repeat_pct: number;
  fcr_pct:    number | null;
}

export async function getAgentSummary(projectKey: string, filters: InboundFilters): Promise<AgentRow[]> {
  const p = PROJECTS.find(proj => proj.key === projectKey);
  if (!p) return [];

  const { startDate, endDate } = filters;
  const inPlaceholders = p.campaigns.map(() => '?').join(',');

  const sql = p.pattern === 'A'
    ? `SELECT
         AgentId   AS agent_id,
         AgentName AS agent_name,
         SUM(CASE WHEN DisconnBy != 'HOLDTIME' THEN 1 ELSE 0 END) AS offered,
         SUM(CASE WHEN AgentId != 'VDCL' AND DisconnBy != 'HOLDTIME' THEN 1 ELSE 0 END) AS answered,
         SUM(CASE WHEN AgentId != 'VDCL' AND DisconnBy != 'HOLDTIME'
                   AND TIME_TO_SEC(QueueDuration) <= 20 THEN 1 ELSE 0 END) AS sl_num,
         ROUND(AVG(CASE WHEN DisconnBy != 'HOLDTIME' THEN CallDurationSecond END), 0) AS acht,
         COUNT(DISTINCT CASE WHEN DisconnBy != 'HOLDTIME' THEN PhoneNumber END) AS unique_phones
       FROM dialer_db.${p.table}
       WHERE CallDate >= ? AND CallDate < DATE_ADD(DATE(?), INTERVAL 1 DAY)
         AND CampaignName IN (${inPlaceholders})
         AND AgentId != 'VDCL'
       GROUP BY AgentId, AgentName
       HAVING offered > 0
       ORDER BY offered DESC`
    : `SELECT
         AgentId   AS agent_id,
         AgentName AS agent_name,
         COUNT(*)  AS offered,
         SUM(CASE WHEN AgentId != 'VDCL' THEN 1 ELSE 0 END) AS answered,
         SUM(CASE WHEN AgentId != 'VDCL' AND TIME_TO_SEC(QueueDuration) <= 30 THEN 1 ELSE 0 END) AS sl_num,
         ROUND(AVG(CallDurationSecond), 0) AS acht,
         COUNT(DISTINCT PhoneNumber) AS unique_phones
       FROM dialer_db.${p.table}
       WHERE CallDate >= ? AND CallDate < DATE_ADD(DATE(?), INTERVAL 1 DAY)
         AND CampaignName IN (${inPlaceholders})
         AND AgentId != 'VDCL'
       GROUP BY AgentId, AgentName
       HAVING offered > 0
       ORDER BY offered DESC`;

  interface RawAgentRow {
    agent_id: string; agent_name: string;
    offered: number; answered: number; sl_num: number; acht: number; unique_phones: number;
  }

  const rows = await querySource<RawAgentRow>(sql, [startDate, endDate, ...p.campaigns]);

  const fcrMap = new Map<string, number>();
  if (p.hasFCR && p.fcrClientId) {
    const fcrRows = await querySource<{ agent_id: string; fcr_pct: number }>(
      `SELECT CAST(AgentId AS CHAR) AS agent_id,
              ROUND(100 * SUM(CASE WHEN Field2='FCR' THEN 1 ELSE 0 END) / NULLIF(COUNT(Field2), 0), 2) AS fcr_pct
       FROM dialer_db.data_master_in
       WHERE CallDate >= ? AND CallDate < DATE_ADD(DATE(?), INTERVAL 1 DAY)
         AND ClientId = ? AND Field1 = 'Inbound'
       GROUP BY AgentId`,
      [startDate, endDate, p.fcrClientId]
    );
    for (const r of fcrRows) fcrMap.set(String(r.agent_id), Number(r.fcr_pct) || 0);
  }

  return rows.map(r => {
    const offered      = Number(r.offered)       || 0;
    const answered     = Number(r.answered)      || 0;
    const sl_num       = Number(r.sl_num)        || 0;
    const unique_phones = Number(r.unique_phones) || 0;
    const acht         = Number(r.acht)          || 0;
    const al           = offered > 0 ? Math.round(answered * 10000 / offered) / 100 : 0;
    const sl           = offered > 0 ? Math.round(sl_num   * 10000 / offered) / 100 : 0;
    const repeat_pct   = offered > 0 ? Math.round((offered - unique_phones) * 10000 / offered) / 100 : 0;
    const fcr_pct      = p.hasFCR ? (fcrMap.get(String(r.agent_id)) ?? null) : null;
    return { agent_id: String(r.agent_id), agent_name: r.agent_name || String(r.agent_id), offered, answered, al, sl, acht, repeat_pct, fcr_pct };
  });
}
