import 'dotenv/config';
import { querySource } from '../lib/sourceDb';

const CLAP_CASE = `
  CASE
    WHEN q.scenario IN ('Query','General Query','General Queries','Feedback','Unclear','Short Call/Blank Call','Repeat','Customer Profile','Brand','Marketing','Content','Collaboration Request') THEN 'Customer'
    WHEN q.scenario IN ('Return/Exchange','Return Request','Return & Exchange','Wrong product','Product Issue','Pricing','Refund Status','Refund issue','Refund Request','Tech issue','Policies and FAQs','Sale Done') THEN 'Product'
    WHEN q.scenario IN ('Delivery Issue','Post Order','Order Status','Reverse Pickup Issue','Pending payment','Payment issues','Wallet issue') THEN 'Logistic'
    WHEN q.scenario IN ('Needs Improvement','Hold Procedure','Transfer','') THEN 'Agent'
    WHEN q.scenario = 'Complaint' THEN
      CASE
        WHEN q.scenario1 IS NULL OR q.scenario1 = '' THEN 'Product'
        WHEN q.scenario1 LIKE '%Dispatch%' OR q.scenario1 LIKE '%Delivery%' OR q.scenario1 LIKE '%RTO%' OR q.scenario1 = 'Delivery Fail'
          OR q.scenario1 LIKE '%Late dispatch%' OR q.scenario1 LIKE '%No communication%' OR q.scenario1 LIKE '%Fake remark%'
          OR q.scenario1 LIKE '%Extra Charge%' OR q.scenario1 LIKE '%Misbehave%' OR q.scenario1 LIKE '%Delivery Boy%'
          OR q.scenario1 LIKE '%Delivery Delay%' OR q.scenario1 LIKE '%POD%' OR q.scenario1 LIKE '%Courier%' THEN 'Logistic'
        WHEN q.scenario1 LIKE '%Fraud%' THEN 'Agent'
        ELSE 'Product'
      END
    ELSE 'Agent'
  END`;

const PRODUCT_CASE = `CASE
  WHEN LOWER(q.Transcribe_Text) LIKE '%ceo man%' THEN 'CEO Man Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%date woman%' THEN 'DATE Woman Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%skai%' THEN 'SKAI Aquatic Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%klub%' THEN 'KLUB Man Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%g.o.a.t%' THEN 'G.O.A.T. Man Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%hot mess%' THEN 'HOT Mess Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%night fever%' THEN 'Night Fever Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%dynamite%' THEN 'Dynamite Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%oud white%' THEN 'OUD WHITE Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%white oud%' THEN 'WHITE Oud Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%honey oud%' THEN 'HONEY Oud Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%dark oud%' THEN 'DARK Oud Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%narco%' THEN 'Narco Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%senorita%' THEN 'SENORITA Woman Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%glam woman%' THEN 'GLAM Woman Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%ghost%' THEN 'Ghost Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%impact man%' THEN 'IMPACT Man Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%blush parfum%' THEN 'Blush Parfum'
  WHEN LOWER(q.Transcribe_Text) LIKE '%beast%' THEN 'Beast Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%ocean man%' THEN 'OCEAN Man Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%blu man%' THEN 'BLU Man Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%growbrow%' THEN 'Growbrow'
  WHEN LOWER(q.Transcribe_Text) LIKE '%deo pack%' THEN 'Deo Pack'
  WHEN LOWER(q.Transcribe_Text) LIKE '%niacinamide%' THEN 'Niacinamide Face Wash'
  WHEN LOWER(q.Transcribe_Text) LIKE '%sunscreen%' THEN 'Sunscreen SPF 50'
  WHEN LOWER(q.Transcribe_Text) LIKE '%rose woman%' THEN 'ROSE Woman Perfume'
  WHEN LOWER(q.Transcribe_Text) LIKE '%mood collection%' THEN 'Mood Collection Gift Set'
  WHEN LOWER(q.Transcribe_Text) LIKE '%luxury perfume%' THEN 'Luxury Perfume Gift Set'
  WHEN LOWER(q.Transcribe_Text) LIKE '%discovery gift%' THEN 'Discovery Gift Set'
  ELSE NULL
END`;

async function go() {
  const sd = '2026-01-01', ed = '2026-07-07', cid = 375;
  const base = [sd, ed, cid];

  // Query 3: productRows (what the product totals show)
  const productRows = await querySource<{ clap: string; product: string; total: number }>(
    `SELECT ${CLAP_CASE} AS clap,
       ${PRODUCT_CASE} AS product,
       COUNT(*) AS total
     FROM db_audit.call_quality_assessment q
     WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL AND q.ClientId = ?
       AND ${CLAP_CASE} IN ('Logistic','Agent','Product')
       AND q.Transcribe_Text IS NOT NULL AND q.Transcribe_Text != ''
       AND ${PRODUCT_CASE} IS NOT NULL
     GROUP BY clap, product ORDER BY clap, total DESC`, base);

  console.log('=== productRows (top 10) ===');
  console.log(JSON.stringify(productRows.slice(0, 10), null, 2));

  // Query 4: productScenRows (the scenario breakdown)
  const productScenRows = await querySource<{ clap: string; product: string; scenario: string; cnt: number }>(
    `SELECT ${CLAP_CASE} AS clap,
       ${PRODUCT_CASE} AS product,
       q.scenario,
       COUNT(*) AS cnt
     FROM db_audit.call_quality_assessment q
     WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL AND q.ClientId = ?
       AND ${CLAP_CASE} IN ('Logistic','Agent','Product')
       AND q.Transcribe_Text IS NOT NULL AND q.Transcribe_Text != ''
       AND ${PRODUCT_CASE} IS NOT NULL
     GROUP BY clap, product, q.scenario ORDER BY clap, product, cnt DESC`, base);

  console.log(`\n=== productScenRows total rows: ${productScenRows.length} ===`);
  console.log('First 10 rows:');
  console.log(JSON.stringify(productScenRows.slice(0, 10), null, 2));

  // Check if "Product" clap rows match
  const prodClap = productRows.filter(r => String(r.clap) === 'Product');
  const scenProd = productScenRows.filter(r => String(r.clap) === 'Product');
  console.log(`\nproductRows with clap='Product': ${prodClap.length}`);
  console.log(`productScenRows with clap='Product': ${scenProd.length}`);

  // Check clap value types
  if (productRows.length > 0) {
    console.log(`\nclap type from productRows[0]: ${typeof productRows[0].clap}, value: "${productRows[0].clap}"`);
  }
  if (productScenRows.length > 0) {
    console.log(`clap type from productScenRows[0]: ${typeof productScenRows[0].clap}, value: "${productScenRows[0].clap}"`);
  }

  process.exit(0);
}
go().catch(e => { console.error(e.message); process.exit(1); });
