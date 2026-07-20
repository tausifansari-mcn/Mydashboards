# CLAP Branch Voice-of-Customer Quotes — Design

## Context

Page: AI Quality → Inbound → Process Analysis (`/quality/inbound/:id`), "CLAP Word Analysis" card.

Today, clicking the "Customer" node expands three branches — Logistic & Ops, Agent, Product — each showing a total-audit count and pos/neg counts on the card face. This part already works correctly and is unchanged by this design.

Clicking into a branch currently shows:
- **Agent**: pos/neg phrase chip clouds (from `top_positive_words_agent` / `top_negative_words_agent`) + scenario/sub-scenario drilldown.
- **Logistic**: scenario/sub-scenario drilldown + a "Products Mentioned in Logistic Calls" grid (product detected via keyword-matching `Transcribe_Text`), no pos/neg words shown.
- **Product**: a list of detected products, each expandable to show pos/neg word chips (from generic `top_positive_words` / `top_negative_words`) + per-product scenario breakdown.

The database has three new dedicated TEXT columns on `db_audit.call_quality_assessment`, populated by a newer AI-extraction pipeline, holding full verbatim customer quotes per branch (not yet used anywhere in the app):
- `customer_voc_logistic_positive` / `customer_voc_logistic_negative`
- `customer_voc_agent_positive` / `customer_voc_agent_negative`
- `customer_voc_product_positive` / `customer_voc_product_negative`

These columns are only populated for calls from 2026-07-17 onward (~3 days of data at time of writing; older date ranges will show empty results — accepted, no fallback).

## Goal

When a branch (Logistic / Agent / Product) is clicked, show its Positive and Negative sentiment as a list of verbatim customer quotes sourced from the matching dedicated column pair above — replacing the old keyword/chip-based approach for that branch. Product-level breakdown is dropped entirely (the new columns aren't product-specific).

## Backend Changes

File: `backend/src/modules/inbound-quality/inbound-quality.service.ts`

1. **`getClapCustomerAnalysis`** — branch totals query (`branchRows`, ~line 3926): change the `pos`/`neg` `SUM(CASE...)` per branch to check the matching voc column pair instead of `top_positive_words` / `top_positive_words_agent`:
   - `Logistic` → `customer_voc_logistic_positive` / `customer_voc_logistic_negative`
   - `Agent` → `customer_voc_agent_positive` / `customer_voc_agent_negative`
   - `Product` → `customer_voc_product_positive` / `customer_voc_product_negative`

   Drop the `pw`/`nw`/`apw`/`anw` GROUP_CONCAT columns from this query (no longer used for chips here).

2. **Remove product-level queries** (`productRows`, `productScenRows`, and their only other caller `buildProductCaseInbound()` if unused elsewhere) and the `products` field from `ClapCustomerBranch` / `ClapCustomerProduct` interfaces.

3. **New service function** `getClapVocQuotes(branch: 'Logistic'|'Agent'|'Product', filters)`:
   - Runs two queries (positive, negative) against the matching column pair, each:
     ```sql
     SELECT q.lead_id AS leadId,
            COALESCE(am.AgentName, q.User) AS agentName,
            q.CallDate AS callDate,
            q.<voc_column> AS quote
     FROM db_audit.call_quality_assessment q
     LEFT JOIN Shivamgiri.AgentMaster am ON am.MasId = q.User COLLATE utf8mb4_unicode_ci
     WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL <clientFilter>
       AND q.<voc_column> IS NOT NULL AND TRIM(q.<voc_column>) != ''
     ORDER BY q.CallDate DESC
     LIMIT 50
     ```
   - Returns `{ positive: VocQuote[], negative: VocQuote[] }` where `VocQuote = { leadId, agentName, callDate, quote }`.

4. **New route**: `GET /inbound-quality/clap-voc-quotes?clap=Logistic|Agent|Product&startDate=&endDate=&clientId=` → new controller `getClapVocQuotes`, validates `clap` against the three allowed values.

## Frontend Changes

File: `frontend/src/features/ai-quality/InboundQualityDashboard.tsx`

1. Branch cards (unchanged visually) now reflect the new counts automatically via the modified `getClapCustomerAnalysis` response.
2. New state: `clapVocQuotes: { positive: VocQuote[]; negative: VocQuote[] } | null`, `clapVocLoading: boolean`. On branch click (`setClapActiveBranch`), fetch `/inbound-quality/clap-voc-quotes?clap=<branch>&...` lazily and populate this state; reset to `null` when branch closes or changes.
3. New shared `VocQuoteList` render block (two columns, Positive / Negative), each quote rendered as a small card: quote text, then `agentName · callDate` as a subline. Empty state: "No positive/negative quotes recorded". Loading state while fetching.
4. **Agent panel**: keep the scenario/sub-scenario drilldown section as-is; replace the phrase-chip clouds with `VocQuoteList`.
5. **Logistic panel**: keep the scenario/sub-scenario drilldown section as-is; remove the "Products Mentioned in Logistic Calls" grid; add `VocQuoteList` below the scenario section.
6. **Product panel**: replace entirely with `VocQuoteList` (no scenario breakdown existed here before; none added).

## Out of scope

- No changes to the "Customer" root node or its counts.
- No changes to scenario/sub-scenario drilldown logic (Agent, Logistic).
- No fallback to old keyword-based data for pre-2026-07-17 date ranges.
- No changes to the separate `Clap360Intelligence` component or `/quality/clap-analysis` endpoint.
