# CLAP Branch Voice-of-Customer Quotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user clicks the Logistic, Agent, or Product branch under "CLAP Word Analysis — Customer Voice" (Process Analysis page), show verbatim customer quotes (Positive/Negative) sourced from the dedicated `customer_voc_*` database columns, replacing the old keyword-chip and per-product breakdown.

**Architecture:** One backend query in the existing `getClapCustomerAnalysis` swaps its pos/neg counting logic to the new columns and drops product-detection queries. A new endpoint `GET /inbound-quality/clap-voc-quotes` returns up to 50 positive + 50 negative verbatim quotes (with lead id, agent name, call date) for a given branch, fetched lazily by the frontend only when that branch is opened. The frontend replaces the old chip-cloud/product-grid JSX for each branch with a shared `VocQuoteList` component.

**Tech Stack:** Express + TypeScript + mysql2 (backend), React + TypeScript + axios (frontend). Spec: `docs/superpowers/specs/2026-07-20-clap-voc-quotes-design.md`.

**Note on verification:** This codebase has no automated test framework (no Jest/Vitest/Mocha configured, no `*.test.*` files anywhere). Verification steps below use direct SQL checks, `curl` against the running dev backend, and manual browser checks — consistent with how the rest of this codebase is verified (see `backend/src/scripts/test-*.ts` ad hoc scripts).

---

### Task 1: Simplify `getClapCustomerAnalysis` — switch count source, drop product queries

**Files:**
- Modify: `backend/src/modules/inbound-quality/inbound-quality.service.ts:3859-4051`

- [ ] **Step 1: Replace the interfaces and the whole `getClapCustomerAnalysis` function**

Find this block (starts at the `ClapSubScen` interface, ends after the closing brace of `getClapCustomerAnalysis`):

```ts
export interface ClapSubScen { sub: string; count: number; }
export interface ClapScenWithSubs { scenario: string; count: number; subs: ClapSubScen[]; }
export interface ClapCustomerProduct {
  name: string;
  total: number;
  pos: number;
  neg: number;
  posWords: string[];
  negWords: string[];
  scenarioBreakdown: ClapScenWithSubs[];
}
export interface ClapCustomerBranch {
  clap: string;
  total: number;
  pos: number;
  neg: number;
  posWords: string[];
  negWords: string[];
  scenarioBreakdown: ClapScenWithSubs[];
  products: ClapCustomerProduct[];
  agentAllTotal?: number;
  agentAllPos?: number;
  agentAllNeg?: number;
  agentAllPosWords?: string[];
  agentAllNegWords?: string[];
}
export interface ClapCustomerAnalysis {
  overall: { total: number; pos: number; neg: number };
  branches: ClapCustomerBranch[];
}
```

Replace with:

```ts
export interface ClapSubScen { sub: string; count: number; }
export interface ClapScenWithSubs { scenario: string; count: number; subs: ClapSubScen[]; }
export interface ClapCustomerBranch {
  clap: string;
  total: number;
  pos: number;
  neg: number;
  scenarioBreakdown: ClapScenWithSubs[];
}
export interface ClapCustomerAnalysis {
  overall: { total: number; pos: number; neg: number };
  branches: ClapCustomerBranch[];
}
```

Then find the full `getClapCustomerAnalysis` function body:

```ts
export async function getClapCustomerAnalysis(filters: InboundQualityFilters): Promise<ClapCustomerAnalysis> {
  const { startDate, endDate, clientId } = filters;
  const cf = clientId ? ' AND q.ClientId = ?' : '';
  const base: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];
  const productCase = buildProductCaseInbound();

  const [overallRows, branchRows, productRows, productScenRows, branchScenRows, agentAllRows] = await Promise.all([
    // 1. Overall totals
    querySource<{ total: number; pos: number; neg: number }>(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN q.top_positive_words IS NOT NULL AND q.top_positive_words != '' THEN 1 ELSE 0 END) AS pos,
        SUM(CASE WHEN q.top_negative_words IS NOT NULL AND q.top_negative_words != '' THEN 1 ELSE 0 END) AS neg
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
    `, base),

    // 2. Per-branch totals — Agent uses agent-specific word columns
    querySource<{ clap: string; total: number; pos: number; neg: number; pw: string; nw: string; apw: string; anw: string }>(`
      SELECT ${CLAP_CASE_INBOUND} AS clap,
        COUNT(*) AS total,
        SUM(CASE
          WHEN (${CLAP_CASE_INBOUND}) = 'Agent'
            THEN CASE WHEN q.top_positive_words_agent IS NOT NULL AND q.top_positive_words_agent != '' THEN 1 ELSE 0 END
          ELSE CASE WHEN q.top_positive_words IS NOT NULL AND q.top_positive_words != '' THEN 1 ELSE 0 END
        END) AS pos,
        SUM(CASE
          WHEN (${CLAP_CASE_INBOUND}) = 'Agent'
            THEN CASE WHEN q.top_negative_words_agent IS NOT NULL AND q.top_negative_words_agent != '' THEN 1 ELSE 0 END
          ELSE CASE WHEN q.top_negative_words IS NOT NULL AND q.top_negative_words != '' THEN 1 ELSE 0 END
        END) AS neg,
        LEFT(GROUP_CONCAT(q.top_positive_words      SEPARATOR '|'), 3000) AS pw,
        LEFT(GROUP_CONCAT(q.top_negative_words      SEPARATOR '|'), 3000) AS nw,
        LEFT(GROUP_CONCAT(NULLIF(TRIM(q.top_positive_words_agent),'') SEPARATOR '|'), 8000) AS apw,
        LEFT(GROUP_CONCAT(NULLIF(TRIM(q.top_negative_words_agent),'') SEPARATOR '|'), 8000) AS anw
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
        AND ${CLAP_CASE_INBOUND} IN ('Logistic','Agent','Product')
      GROUP BY clap ORDER BY total DESC
    `, base),

    // 3. Per-product totals (all three branches, product detected via Transcribe_Text)
    querySource<{ clap: string; product: string; total: number; pos: number; neg: number; pw: string; nw: string }>(`
      SELECT ${CLAP_CASE_INBOUND} AS clap,
        ${productCase} AS product,
        COUNT(*) AS total,
        SUM(CASE WHEN q.top_positive_words IS NOT NULL AND q.top_positive_words != '' THEN 1 ELSE 0 END) AS pos,
        SUM(CASE WHEN q.top_negative_words IS NOT NULL AND q.top_negative_words != '' THEN 1 ELSE 0 END) AS neg,
        LEFT(GROUP_CONCAT(q.top_positive_words SEPARATOR '|'), 2000) AS pw,
        LEFT(GROUP_CONCAT(q.top_negative_words SEPARATOR '|'), 2000) AS nw
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
        AND ${CLAP_CASE_INBOUND} IN ('Logistic','Agent','Product')
        AND q.Transcribe_Text IS NOT NULL AND q.Transcribe_Text != ''
        AND ${productCase} IS NOT NULL
      GROUP BY clap, product ORDER BY clap, total DESC
    `, base),

    // 4. Per-product per-scenario+sub counts (subquery avoids GROUP BY alias issue)
    querySource<{ clap: string; product: string; scenario: string; sub_scenario: string; cnt: number }>(`
      SELECT t.clap, t.product, t.scenario, t.sub_scenario, COUNT(*) AS cnt
      FROM (
        SELECT (${CLAP_CASE_INBOUND}) AS clap,
          (${productCase}) AS product,
          q.scenario,
          COALESCE(NULLIF(TRIM(q.scenario1),''),'—') AS sub_scenario
        FROM db_audit.call_quality_assessment q
        WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
          AND q.Transcribe_Text IS NOT NULL AND q.Transcribe_Text != ''
      ) AS t
      WHERE t.clap IN ('Logistic','Agent','Product') AND t.product IS NOT NULL
      GROUP BY t.clap, t.product, t.scenario, t.sub_scenario
      ORDER BY t.clap, t.product, cnt DESC
    `, base),

    // 5. Logistic + Agent scenario+sub breakdown (subquery for reliability)
    querySource<{ clap: string; scenario: string; sub_scenario: string; cnt: number }>(`
      SELECT t.clap, t.scenario, t.sub_scenario, COUNT(*) AS cnt
      FROM (
        SELECT (${CLAP_CASE_INBOUND}) AS clap,
          q.scenario,
          COALESCE(NULLIF(TRIM(q.scenario1),''),'—') AS sub_scenario
        FROM db_audit.call_quality_assessment q
        WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
      ) AS t
      WHERE t.clap IN ('Logistic','Agent')
      GROUP BY t.clap, t.scenario, t.sub_scenario
      ORDER BY t.clap, cnt DESC
    `, base),

    // 6. All-calls agent phrase summary (top_positive/negative_words_agent across every audit)
    querySource<{ total: number; pos: number; neg: number; apw: string; anw: string }>(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN q.top_positive_words_agent IS NOT NULL AND TRIM(q.top_positive_words_agent) NOT IN ('','None','N/A','Not applicable','Not Available') THEN 1 ELSE 0 END) AS pos,
        SUM(CASE WHEN q.top_negative_words_agent IS NOT NULL AND TRIM(q.top_negative_words_agent) NOT IN ('','None','N/A','Not applicable','Not Available') THEN 1 ELSE 0 END) AS neg,
        LEFT(GROUP_CONCAT(NULLIF(TRIM(q.top_positive_words_agent),'') ORDER BY q.CallDate DESC SEPARATOR '|'), 12000) AS apw,
        LEFT(GROUP_CONCAT(NULLIF(TRIM(q.top_negative_words_agent),'') ORDER BY q.CallDate DESC SEPARATOR '|'), 12000) AS anw
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
    `, base),
  ]);

  const overall = overallRows[0] ?? { total: 0, pos: 0, neg: 0 };
  const agentAll = agentAllRows[0] ?? { total: 0, pos: 0, neg: 0, apw: '', anw: '' };

  const branches: ClapCustomerBranch[] = branchRows.map(br => {
    const clap = String(br.clap);
    const isAgent = clap === 'Agent';
    return {
      clap,
      total: Number(br.total),
      pos:   Number(br.pos),
      neg:   Number(br.neg),
      posWords: isAgent ? agentPhraseListFromRaw(br.apw as unknown as string) : wordListFromRaw(br.pw as unknown as string),
      negWords: isAgent ? agentPhraseListFromRaw(br.anw as unknown as string) : wordListFromRaw(br.nw as unknown as string),
      ...(isAgent ? {
        agentAllTotal:    Number(agentAll.total),
        agentAllPos:      Number(agentAll.pos),
        agentAllNeg:      Number(agentAll.neg),
        agentAllPosWords: agentPhraseListFromRaw(agentAll.apw as unknown as string),
        agentAllNegWords: agentPhraseListFromRaw(agentAll.anw as unknown as string),
      } : {}),
      scenarioBreakdown: groupScenWithSubs(
        branchScenRows.filter(r => String(r.clap) === clap)
      ),
      products: productRows
        .filter(pr => String(pr.clap) === clap && pr.product)
        .map(pr => ({
          name:     String(pr.product),
          total:    Number(pr.total),
          pos:      Number(pr.pos),
          neg:      Number(pr.neg),
          posWords: wordListFromRaw(pr.pw as unknown as string),
          negWords: wordListFromRaw(pr.nw as unknown as string),
          scenarioBreakdown: groupScenWithSubs(
            productScenRows.filter(s => String(s.clap) === clap && String(s.product) === String(pr.product))
          ),
        })),
    };
  });

  return { overall: { total: Number(overall.total), pos: Number(overall.pos), neg: Number(overall.neg) }, branches };
}
```

Replace with:

```ts
export async function getClapCustomerAnalysis(filters: InboundQualityFilters): Promise<ClapCustomerAnalysis> {
  const { startDate, endDate, clientId } = filters;
  const cf = clientId ? ' AND q.ClientId = ?' : '';
  const base: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const [overallRows, branchRows, branchScenRows] = await Promise.all([
    // 1. Overall totals (Customer root node — unchanged)
    querySource<{ total: number; pos: number; neg: number }>(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN q.top_positive_words IS NOT NULL AND q.top_positive_words != '' THEN 1 ELSE 0 END) AS pos,
        SUM(CASE WHEN q.top_negative_words IS NOT NULL AND q.top_negative_words != '' THEN 1 ELSE 0 END) AS neg
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
    `, base),

    // 2. Per-branch totals — sourced from the dedicated customer_voc_* columns per branch
    querySource<{ clap: string; total: number; pos: number; neg: number }>(`
      SELECT ${CLAP_CASE_INBOUND} AS clap,
        COUNT(*) AS total,
        SUM(CASE
          WHEN (${CLAP_CASE_INBOUND}) = 'Agent'
            THEN CASE WHEN q.customer_voc_agent_positive IS NOT NULL AND q.customer_voc_agent_positive != '' THEN 1 ELSE 0 END
          WHEN (${CLAP_CASE_INBOUND}) = 'Logistic'
            THEN CASE WHEN q.customer_voc_logistic_positive IS NOT NULL AND q.customer_voc_logistic_positive != '' THEN 1 ELSE 0 END
          ELSE CASE WHEN q.customer_voc_product_positive IS NOT NULL AND q.customer_voc_product_positive != '' THEN 1 ELSE 0 END
        END) AS pos,
        SUM(CASE
          WHEN (${CLAP_CASE_INBOUND}) = 'Agent'
            THEN CASE WHEN q.customer_voc_agent_negative IS NOT NULL AND q.customer_voc_agent_negative != '' THEN 1 ELSE 0 END
          WHEN (${CLAP_CASE_INBOUND}) = 'Logistic'
            THEN CASE WHEN q.customer_voc_logistic_negative IS NOT NULL AND q.customer_voc_logistic_negative != '' THEN 1 ELSE 0 END
          ELSE CASE WHEN q.customer_voc_product_negative IS NOT NULL AND q.customer_voc_product_negative != '' THEN 1 ELSE 0 END
        END) AS neg
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
        AND ${CLAP_CASE_INBOUND} IN ('Logistic','Agent','Product')
      GROUP BY clap ORDER BY total DESC
    `, base),

    // 3. Logistic + Agent scenario+sub breakdown (subquery for reliability) — unchanged
    querySource<{ clap: string; scenario: string; sub_scenario: string; cnt: number }>(`
      SELECT t.clap, t.scenario, t.sub_scenario, COUNT(*) AS cnt
      FROM (
        SELECT (${CLAP_CASE_INBOUND}) AS clap,
          q.scenario,
          COALESCE(NULLIF(TRIM(q.scenario1),''),'—') AS sub_scenario
        FROM db_audit.call_quality_assessment q
        WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
      ) AS t
      WHERE t.clap IN ('Logistic','Agent')
      GROUP BY t.clap, t.scenario, t.sub_scenario
      ORDER BY t.clap, cnt DESC
    `, base),
  ]);

  const overall = overallRows[0] ?? { total: 0, pos: 0, neg: 0 };

  const branches: ClapCustomerBranch[] = branchRows.map(br => {
    const clap = String(br.clap);
    return {
      clap,
      total: Number(br.total),
      pos:   Number(br.pos),
      neg:   Number(br.neg),
      scenarioBreakdown: groupScenWithSubs(
        branchScenRows.filter(r => String(r.clap) === clap)
      ),
    };
  });

  return { overall: { total: Number(overall.total), pos: Number(overall.pos), neg: Number(overall.neg) }, branches };
}
```

- [ ] **Step 2: Confirm the now-unused helpers are still used elsewhere (do not delete them)**

Run:
```bash
cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards/backend"
grep -n "wordListFromRaw\|agentPhraseListFromRaw\|buildProductCaseInbound(" src/modules/inbound-quality/inbound-quality.service.ts
```
Expected: `wordListFromRaw` and `agentPhraseListFromRaw` still have call sites around line ~4300-4400 (the separate "CLAP 360°" feature), and `buildProductCaseInbound()` still has a call site around line ~4000 (also CLAP 360°). None of these three should show zero remaining call sites — if any does, stop and investigate before deleting it (out of scope for this plan either way; just confirming Task 1 didn't orphan anything).

- [ ] **Step 3: Type-check the backend**

Run: `cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards/backend" && npx tsc --noEmit`
Expected: no errors referencing `inbound-quality.service.ts`. (Pre-existing unrelated errors elsewhere in the repo, if any, are not this task's concern — only confirm nothing new points at this file.)

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards"
git add backend/src/modules/inbound-quality/inbound-quality.service.ts
git commit -m "feat(inbound-quality): source CLAP branch pos/neg counts from customer_voc_* columns"
```

---

### Task 2: Add `getClapVocQuotes` service function

**Files:**
- Modify: `backend/src/modules/inbound-quality/inbound-quality.service.ts` (add after the `getClapCustomerAnalysis` function from Task 1)

- [ ] **Step 1: Add the VOC quote types, column map, and service function**

Insert immediately after the closing `}` of `getClapCustomerAnalysis` (the function just rewritten in Task 1):

```ts
export interface VocQuote { leadId: string; agentName: string; callDate: string; quote: string; }
export interface ClapVocQuotesResponse { positive: VocQuote[]; negative: VocQuote[]; }

const VOC_COLUMNS: Record<'Logistic' | 'Agent' | 'Product', { pos: string; neg: string }> = {
  Logistic: { pos: 'customer_voc_logistic_positive', neg: 'customer_voc_logistic_negative' },
  Agent:    { pos: 'customer_voc_agent_positive',    neg: 'customer_voc_agent_negative' },
  Product:  { pos: 'customer_voc_product_positive',  neg: 'customer_voc_product_negative' },
};

export async function getClapVocQuotes(
  clap: 'Logistic' | 'Agent' | 'Product',
  filters: InboundQualityFilters,
): Promise<ClapVocQuotesResponse> {
  const { startDate, endDate, clientId } = filters;
  const cf = clientId ? ' AND q.ClientId = ?' : '';
  const base: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];
  const cols = VOC_COLUMNS[clap];

  type Row = { leadId: string; agentName: string; callDate: string; quote: string };
  const runQuery = (column: string) => querySource<Row>(`
    SELECT q.lead_id AS leadId,
           COALESCE(am.AgentName, q.User) AS agentName,
           q.CallDate AS callDate,
           q.${column} AS quote
    FROM db_audit.call_quality_assessment q
    LEFT JOIN Shivamgiri.AgentMaster am ON am.MasId = q.User COLLATE utf8mb4_unicode_ci
    WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
      AND q.${column} IS NOT NULL AND TRIM(q.${column}) != ''
    ORDER BY q.CallDate DESC
    LIMIT 50
  `, base);

  const [positiveRows, negativeRows] = await Promise.all([
    runQuery(cols.pos),
    runQuery(cols.neg),
  ]);

  const toQuote = (r: { leadId: string; agentName: string; callDate: string; quote: string }): VocQuote => ({
    leadId:    String(r.leadId ?? ''),
    agentName: String(r.agentName ?? 'Unknown'),
    callDate:  String(r.callDate),
    quote:     String(r.quote),
  });

  return { positive: positiveRows.map(toQuote), negative: negativeRows.map(toQuote) };
}
```

Note: `column` is always one of the six hardcoded literal strings in `VOC_COLUMNS` above (never user input), so string-interpolating it into the SQL is safe — it is not derived from `clap` until after the controller (Task 3) validates `clap` against a whitelist.

- [ ] **Step 2: Type-check the backend**

Run: `cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards/backend" && npx tsc --noEmit`
Expected: no errors referencing `inbound-quality.service.ts`.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards"
git add backend/src/modules/inbound-quality/inbound-quality.service.ts
git commit -m "feat(inbound-quality): add getClapVocQuotes service function"
```

---

### Task 3: Add controller + route for the new endpoint

**Files:**
- Modify: `backend/src/modules/inbound-quality/inbound-quality.controller.ts:527` (after `getClapIntelligence`)
- Modify: `backend/src/modules/inbound-quality/inbound-quality.routes.ts:58` (after the `clap-customer-analysis` route)

- [ ] **Step 1: Add the controller function**

In `inbound-quality.controller.ts`, after the `getClapIntelligence` function (the last function in the file), add:

```ts

export async function getClapVocQuotes(req: Request, res: Response) {
  try {
    const clap = req.query.clap as string;
    if (clap !== 'Logistic' && clap !== 'Agent' && clap !== 'Product') {
      res.status(400).json({ message: 'clap must be one of Logistic, Agent, Product' });
      return;
    }
    const data = await svc.getClapVocQuotes(clap, parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}
```

- [ ] **Step 2: Add the route**

In `inbound-quality.routes.ts`, change:

```ts
router.get('/clap-customer-analysis',  ctrl.getClapCustomerAnalysis);
router.get('/clap-intelligence',       ctrl.getClapIntelligence);
```

to:

```ts
router.get('/clap-customer-analysis',  ctrl.getClapCustomerAnalysis);
router.get('/clap-voc-quotes',         ctrl.getClapVocQuotes);
router.get('/clap-intelligence',       ctrl.getClapIntelligence);
```

- [ ] **Step 3: Type-check the backend**

Run: `cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards/backend" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Start the backend and verify the endpoint manually**

If not already running:
```bash
cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards/backend"
npm run dev
```
Wait for `Backend running on port 5000` in the output, then log in via the frontend (or reuse an existing valid `accessToken`) and call:

```bash
curl -s "http://localhost:5000/inbound-quality/clap-voc-quotes?clap=Logistic&startDate=2026-07-17%2000:00:00&endDate=2026-07-20%2023:59:59" -H "Authorization: Bearer <accessToken>"
```

Expected: HTTP 200 with `{"data":{"positive":[...],"negative":[...]}}` — `negative` should contain rows like `"मेरा order deliver नहीं हो रहा है"` (matches the sample pulled from the DB during design). Also verify the 400 guard:

```bash
curl -s "http://localhost:5000/inbound-quality/clap-voc-quotes?clap=Bogus&startDate=2026-07-17&endDate=2026-07-20" -H "Authorization: Bearer <accessToken>" -w "\n%{http_code}\n"
```
Expected: `400` with `{"message":"clap must be one of Logistic, Agent, Product"}`.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards"
git add backend/src/modules/inbound-quality/inbound-quality.controller.ts backend/src/modules/inbound-quality/inbound-quality.routes.ts
git commit -m "feat(inbound-quality): add clap-voc-quotes endpoint"
```

---

### Task 4: Frontend — update CLAP state, drop product state, add VOC quote state

**Files:**
- Modify: `frontend/src/features/ai-quality/InboundQualityDashboard.tsx:1643-1661`

- [ ] **Step 1: Replace the CLAP Customer Product Analysis state block**

Find:

```tsx
  // ── CLAP Customer Product Analysis ──────────────────────────────────────
  type ClapScenWithSubs = { scenario: string; count: number; subs: { sub: string; count: number }[] };
  type ClapProduct = { name: string; total: number; pos: number; neg: number; posWords: string[]; negWords: string[]; scenarioBreakdown: ClapScenWithSubs[] };
  const [clapCustomer, setClapCustomer] = useState<{
    overall: { total: number; pos: number; neg: number };
    branches: {
      clap: string; total: number; pos: number; neg: number;
      posWords: string[]; negWords: string[];
      scenarioBreakdown: ClapScenWithSubs[];
      products: ClapProduct[];
      agentAllTotal?: number; agentAllPos?: number; agentAllNeg?: number;
      agentAllPosWords?: string[]; agentAllNegWords?: string[];
    }[];
  } | null>(null);
  const [clapCustomerLoading, setClapCustomerLoading] = useState(false);
  const [clapCustomerExpanded, setClapCustomerExpanded] = useState(false);
  const [clapActiveBranch, setClapActiveBranch] = useState<string | null>(null);
  const [clapActiveProduct, setClapActiveProduct] = useState<string | null>(null);
  const [clapActiveScenario, setClapActiveScenario] = useState<string | null>(null);
```

Replace with:

```tsx
  // ── CLAP Customer Product Analysis ──────────────────────────────────────
  type ClapScenWithSubs = { scenario: string; count: number; subs: { sub: string; count: number }[] };
  const [clapCustomer, setClapCustomer] = useState<{
    overall: { total: number; pos: number; neg: number };
    branches: {
      clap: string; total: number; pos: number; neg: number;
      scenarioBreakdown: ClapScenWithSubs[];
    }[];
  } | null>(null);
  const [clapCustomerLoading, setClapCustomerLoading] = useState(false);
  const [clapCustomerExpanded, setClapCustomerExpanded] = useState(false);
  const [clapActiveBranch, setClapActiveBranch] = useState<string | null>(null);
  const [clapActiveScenario, setClapActiveScenario] = useState<string | null>(null);
  const [clapVocQuotes, setClapVocQuotes] = useState<{ positive: VocQuote[]; negative: VocQuote[] } | null>(null);
  const [clapVocLoading, setClapVocLoading] = useState(false);

  useEffect(() => {
    if (!clapActiveBranch) { setClapVocQuotes(null); return; }
    setClapVocLoading(true);
    api.get<{ data: { positive: VocQuote[]; negative: VocQuote[] } }>(
      `/inbound-quality/clap-voc-quotes?clap=${clapActiveBranch}&clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setClapVocQuotes(r.data?.data ?? { positive: [], negative: [] }))
      .catch(() => setClapVocQuotes({ positive: [], negative: [] }))
      .finally(() => setClapVocLoading(false));
  }, [clapActiveBranch, clientId, sd, ed]);
```

- [ ] **Step 2: Add the `VocQuote` type near the top-level interfaces**

Find the `AgentMasterRow` interface (around line 184):

```tsx
interface AgentMasterRow  { masId: string; agentName: string; lob: string; }
```

Replace with:

```tsx
interface AgentMasterRow  { masId: string; agentName: string; lob: string; }
interface VocQuote { leadId: string; agentName: string; callDate: string; quote: string; }
```

- [ ] **Step 3: Remove the two remaining `clapActiveProduct` references (they belong to the sections Tasks 5-6 will rewrite, but confirm no stray references remain after this task)**

Run:
```bash
cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards/frontend"
grep -n "clapActiveProduct" src/features/ai-quality/InboundQualityDashboard.tsx
```
Expected right now (before Tasks 5-6 touch the JSX): two matches inside the Logistic and Product branch panels — this is expected at this point in the plan; both will be removed in Task 6.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards"
git add frontend/src/features/ai-quality/InboundQualityDashboard.tsx
git commit -m "feat(inbound-quality-ui): add VOC quote state, drop product-breakdown state"
```

(This commit will not compile in isolation since the JSX still references removed fields — that's expected; Tasks 5-6 fix the JSX. If your workflow requires every commit to build, squash Tasks 4-6 into one commit instead.)

---

### Task 5: Frontend — add the shared `VocQuoteList` component

**Files:**
- Modify: `frontend/src/features/ai-quality/InboundQualityDashboard.tsx` (add near the other standalone helper components, e.g. right after the `AgentNameTag` function around line 1398)

- [ ] **Step 1: Add the component**

Find the `AgentNameTag` function definition (search for `function AgentNameTag`), and insert this new function immediately after it closes:

```tsx
function VocQuoteList({ positive, negative, loading }: { positive: VocQuote[]; negative: VocQuote[]; loading: boolean }) {
  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const Column = ({ title, icon, quotes, borderColor, headerBg }: { title: string; icon: string; quotes: VocQuote[]; borderColor: string; headerBg: string }) => (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor }}>
      <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: headerBg }}>
        <span className="text-white text-sm">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-white">{title}</span>
        <span className="ml-auto text-[9px] text-white/70 font-semibold">{quotes.length}</span>
      </div>
      <div className="bg-white p-3 space-y-2 max-h-80 overflow-y-auto">
        {loading ? (
          <p className="text-[10px] text-slate-400 italic">Loading…</p>
        ) : quotes.length === 0 ? (
          <p className="text-[10px] text-slate-400 italic">No {title.toLowerCase()} recorded</p>
        ) : quotes.map((q, i) => (
          <div key={`${q.leadId}-${i}`} className="rounded-lg border border-slate-100 p-2.5 bg-slate-50">
            <p className="text-[11px] text-slate-700 leading-snug">&ldquo;{q.quote}&rdquo;</p>
            <p className="text-[9px] text-slate-400 font-semibold mt-1">{q.agentName} · {fmtDate(q.callDate)}</p>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-4">
      <Column title="Positive Quotes" icon="😊" quotes={positive} borderColor="#A7F3D0" headerBg="linear-gradient(135deg,#064E3B,#059669)" />
      <Column title="Negative Quotes" icon="😠" quotes={negative} borderColor="#FECACA" headerBg="linear-gradient(135deg,#7F1D1D,#DC2626)" />
    </div>
  );
}
```

- [ ] **Step 2: Type-check the frontend**

Run: `cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards/frontend" && npx tsc --noEmit`
Expected: errors will still exist in `InboundQualityDashboard.tsx` referencing `products`/`posWords`/`negWords` — these are the JSX sections fixed in Task 6. No errors should reference `VocQuoteList` itself.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards"
git add frontend/src/features/ai-quality/InboundQualityDashboard.tsx
git commit -m "feat(inbound-quality-ui): add VocQuoteList component"
```

---

### Task 6: Frontend — rewrite the Agent, Logistic, and Product branch panels

**Files:**
- Modify: `frontend/src/features/ai-quality/InboundQualityDashboard.tsx:4906-5234`

- [ ] **Step 1: Replace the entire branch-detail-panel IIFE**

Find the full block starting at `{/* Branch detail panel */}` and ending at the matching `})()}` (this spans the Agent, Logistic, and Product panel branches — roughly lines 4905-5234):

```tsx
                          {/* Branch detail panel */}
                          {clapActiveBranch && (() => {
                            const m = BRANCH_META[clapActiveBranch];
                            const bd = clapCustomer?.branches.find(b => b.clap === clapActiveBranch);

                            /* ── AGENT branch ── */
                            if (clapActiveBranch === 'Agent') {
```

... (the full existing block through the closing `})()}` at the end of the Product branch, as read from the file) ...

Replace the whole thing with:

```tsx
                          {/* Branch detail panel */}
                          {clapActiveBranch && (() => {
                            const m = BRANCH_META[clapActiveBranch];
                            const bd = clapCustomer?.branches.find(b => b.clap === clapActiveBranch);

                            /* ── AGENT branch ── */
                            if (clapActiveBranch === 'Agent') {
                              const agScens = bd?.scenarioBreakdown ?? [];
                              const agTotal = agScens.reduce((s, r) => s + r.count, 0);
                              return (
                                <div className="rounded-xl overflow-hidden border shadow-sm mb-4" style={{ borderColor: `${m.accent}40` }}>
                                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                                    <span>{m.icon}</span>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-white">Agent — Language &amp; Scenario Analysis</span>
                                    <span className="ml-auto text-[9px] text-white/60 font-semibold">{bd?.total ?? 0} total audits analysed</span>
                                  </div>
                                  <div className="bg-white p-4 space-y-4">
                                    <VocQuoteList positive={clapVocQuotes?.positive ?? []} negative={clapVocQuotes?.negative ?? []} loading={clapVocLoading} />
                                    {/* Scenario drill-down */}
                                    {agScens.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Scenarios — click to expand sub-scenarios</p>
                                        <div className="space-y-1.5">
                                          {agScens.map(s => {
                                            const clr = scenColor(s.scenario);
                                            const pct = agTotal > 0 ? Math.round(s.count / agTotal * 100) : 0;
                                            const isOpen = clapActiveScenario === `Agent:${s.scenario}`;
                                            return (
                                              <div key={s.scenario} className="rounded-lg overflow-hidden border" style={{ borderColor: `${clr}30` }}>
                                                <div
                                                  onClick={() => setClapActiveScenario(isOpen ? null : `Agent:${s.scenario}`)}
                                                  className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                                                  style={{ background: isOpen ? `${clr}10` : 'white' }}
                                                >
                                                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: clr }} />
                                                  <span className="text-[10px] font-bold flex-1 truncate" style={{ color: clr }}>{s.scenario}</span>
                                                  <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden mx-2">
                                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: clr }} />
                                                  </div>
                                                  <span className="text-[10px] font-black tabular-nums w-8 text-right" style={{ color: clr }}>{s.count}</span>
                                                  <span className="text-[9px] text-slate-400 ml-1">{isOpen ? '▲' : '▼'}</span>
                                                </div>
                                                {isOpen && s.subs.length > 0 && (
                                                  <div className="px-6 pb-2 pt-1 space-y-1" style={{ background: `${clr}06` }}>
                                                    {s.subs.map(sub => (
                                                      <div key={sub.sub} className="flex items-center justify-between gap-2">
                                                        <span className="text-[9px] text-slate-600 flex-1 truncate">↳ {sub.sub}</span>
                                                        <span className="text-[9px] font-black tabular-nums" style={{ color: clr }}>{sub.count}</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            /* ── LOGISTIC branch ── */
                            if (clapActiveBranch === 'Logistic') {
                              const scenBreakdown = bd?.scenarioBreakdown ?? [];
                              const logTotal = scenBreakdown.reduce((s, r) => s + r.count, 0);
                              return (
                                <div className="rounded-xl overflow-hidden border shadow-sm mb-4" style={{ borderColor: `${m.accent}40` }}>
                                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                                    <span>{m.icon}</span>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-white">Logistic &amp; Operations — Deep Analysis</span>
                                    <span className="ml-auto text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{bd?.total ?? 0} total calls</span>
                                  </div>
                                  <div className="bg-white p-4 space-y-4">
                                    {/* Scenario drill-down */}
                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Logistic Scenarios — click to expand sub-scenarios</p>
                                      <div className="space-y-1.5">
                                        {scenBreakdown.map(s => {
                                          const clr = scenColor(s.scenario);
                                          const pct = logTotal > 0 ? Math.round(s.count / logTotal * 100) : 0;
                                          const isNeg = ['#DC2626','#EF4444'].includes(clr) || ['issue','complaint','fail','wrong','return','refund','reverse','fraud'].some(k => s.scenario.toLowerCase().includes(k));
                                          const isOpen = clapActiveScenario === `Log:${s.scenario}`;
                                          return (
                                            <div key={s.scenario} className="rounded-lg overflow-hidden border" style={{ borderColor: `${clr}30` }}>
                                              <div
                                                onClick={() => setClapActiveScenario(isOpen ? null : `Log:${s.scenario}`)}
                                                className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                                                style={{ background: isOpen ? `${clr}10` : 'white' }}
                                              >
                                                <span className="text-[10px] shrink-0">{isNeg ? '⚠️' : 'ℹ️'}</span>
                                                <span className="text-[10px] font-bold flex-1 truncate" style={{ color: clr }}>{s.scenario}</span>
                                                <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden mx-2">
                                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: clr }} />
                                                </div>
                                                <span className="text-[10px] font-black tabular-nums w-8 text-right" style={{ color: clr }}>{s.count}</span>
                                                <span className="text-[9px] text-slate-400 tabular-nums w-7 text-right">{pct}%</span>
                                                {s.subs.length > 0 && <span className="text-[9px] text-slate-400 ml-1">{isOpen ? '▲' : '▼'}</span>}
                                              </div>
                                              {isOpen && s.subs.length > 0 && (
                                                <div className="px-6 pb-2 pt-1 space-y-1" style={{ background: `${clr}06` }}>
                                                  {s.subs.map(sub => (
                                                    <div key={sub.sub} className="flex items-center justify-between gap-2">
                                                      <span className="text-[9px] text-slate-600 flex-1 truncate">↳ {sub.sub}</span>
                                                      <span className="text-[9px] font-black tabular-nums" style={{ color: clr }}>{sub.count}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <VocQuoteList positive={clapVocQuotes?.positive ?? []} negative={clapVocQuotes?.negative ?? []} loading={clapVocLoading} />
                                  </div>
                                </div>
                              );
                            }

                            /* ── PRODUCT branch ── */
                            return (
                              <div className="rounded-xl overflow-hidden border shadow-sm mb-4" style={{ borderColor: `${m.accent}40` }}>
                                <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                                  <span>{m.icon}</span>
                                  <span className="text-[11px] font-black uppercase tracking-widest text-white">Product — Customer Sentiment</span>
                                  <span className="ml-auto text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{bd?.total ?? 0} total calls</span>
                                </div>
                                <div className="bg-white p-4">
                                  <VocQuoteList positive={clapVocQuotes?.positive ?? []} negative={clapVocQuotes?.negative ?? []} loading={clapVocLoading} />
                                </div>
                              </div>
                            );
                          })()}
```

- [ ] **Step 2: Confirm no stray references remain**

Run:
```bash
cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards/frontend"
grep -n "clapActiveProduct\|\.products\b\|posWords\|negWords\|agentAllPosWords\|agentAllNegWords\|agentAllTotal\|agentAllPos\|agentAllNeg" src/features/ai-quality/InboundQualityDashboard.tsx
```
Expected: zero matches (all were confined to the branch panel rewritten in this task and the state block from Task 4).

- [ ] **Step 3: Type-check the frontend**

Run: `cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards/frontend" && npx tsc --noEmit`
Expected: no errors in `InboundQualityDashboard.tsx`.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards"
git add frontend/src/features/ai-quality/InboundQualityDashboard.tsx
git commit -m "feat(inbound-quality-ui): replace branch chip/product UI with VOC quote lists"
```

---

### Task 7: Manual end-to-end verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Start both dev servers if not already running**

```bash
cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards/backend" && npm run dev
```
```bash
cd "c:/Users/MAS60358/Desktop/My Dash/Mydashboards/frontend" && npm run dev
```
Wait for `Backend running on port 5000` and Vite's `Local: http://localhost:5173/`.

- [ ] **Step 2: Walk the golden path**

1. Open `http://localhost:5173/quality/inbound/375` (the page from the screenshot) and log in if prompted.
2. Set the date range to include 2026-07-17 through today (2026-07-20) — required, since the voc columns are only populated from 2026-07-17 onward.
3. Scroll to "CLAP Word Analysis — Customer Voice", click the **Customer** card. Confirm it still expands to show Logistic / Agent / Product branch cards with counts (unchanged from before).
4. Click **Logistic**. Confirm:
   - The scenario drilldown section still appears and still works (click a scenario, sub-scenarios expand).
   - The old "Products Mentioned in Logistic Calls" grid is gone.
   - A new "Positive Quotes" / "Negative Quotes" two-column section appears below, showing a brief "Loading…" state then populating with quote cards (quote text, agent name, date) — negative side should show entries like the "मेरा order deliver नहीं हो रहा है" sample found during design.
5. Click **Agent**. Confirm the scenario section still works, and the old phrase-chip clouds are replaced by the same Positive/Negative quote list layout, populated from agent-specific quotes.
6. Click **Product**. Confirm the old per-product list is gone, replaced by a Positive/Negative quote list.
7. Click a branch a second time to close it, then a different branch — confirm the quote list clears and refetches for the new branch (no stale quotes from the previous branch).
8. Change the date range to something entirely before 2026-07-17 (e.g. June 2026) and reopen any branch — confirm both columns show "No positive/negative recorded" rather than an error or crash.

- [ ] **Step 3: Check the browser console and Network tab**

Confirm no red errors in the console while performing the steps above, and that `GET /inbound-quality/clap-voc-quotes?clap=...` requests return `200` in the Network tab each time a branch is opened.

---

### Self-Review Notes

- **Spec coverage:** All three branches (Logistic/Agent/Product) now source pos/neg from their matching `customer_voc_*` column pair (Task 1 counts, Task 2 quotes) — ✅. Product breakdown dropped — ✅ (Task 1 removes queries 3-4, Task 6 removes the product grid/list JSX). Quote cards show quote + date + agent — ✅ (Task 5). Capped at 50 — ✅ (Task 2 `LIMIT 50`). No fallback for pre-2026-07-17 dates — ✅ (no fallback logic anywhere in Task 1-2). Scenario/sub-scenario drilldown for Logistic/Agent preserved — ✅ (Task 1 keeps query 3/renumbered, Task 6 keeps the JSX verbatim).
- **Type consistency:** `VocQuote` (leadId/agentName/callDate/quote) defined once in the frontend (Task 4 Step 2) and reused identically in `VocQuoteList` (Task 5) and the backend `VocQuote` interface (Task 2) — field names match exactly (`leadId`, `agentName`, `callDate`, `quote`) so no mapping/renaming is needed between the API response and the component props.
- **Scope check:** Single subsystem (one page's one card), no decomposition needed.
