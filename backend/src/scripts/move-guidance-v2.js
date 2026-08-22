const fs = require('fs');
const fp = String.raw`C:\Users\MAS60358\Desktop\My Dash\Mydashboards\frontend\src\features\ai-quality\InboundQualityDashboard.tsx`;
let c = fs.readFileSync(fp, 'utf8');

// Step 1: Copy PARAM_TIPS + CAT_COLOR to component scope (after TNI_CAT_COLOR)
const PARAM_TIPS_ORIG = c.substring(
  c.indexOf('          const PARAM_TIPS: Record<string, string> = {'),
  c.indexOf('          };', c.indexOf('const PARAM_TIPS:', 50000)) + 11
);
const CAT_COLOR_ORIG = c.substring(
  c.indexOf('          const CAT_COLOR: Record<string, string> = {'),
  c.indexOf('};', c.indexOf('const CAT_COLOR:', 50000)) + 2
);
const BOTH = PARAM_TIPS_ORIG + '\n' + CAT_COLOR_ORIG;

// De-indent by 10 spaces
const BOTH_DEINDENTED = BOTH.split('\n').map(l => {
  if (l.trim() === '') return '';
  return l.startsWith('          ') ? l.slice(10) : l;
}).join('\n');

// Insert after TNI_CAT_COLOR closing
const tniEnd = c.indexOf('};', c.indexOf('TNI_CAT_COLOR')) + 2;
c = c.slice(0, tniEnd) + '\n' + BOTH_DEINDENTED + '\n' + c.slice(tniEnd);

// Now remove originals from CLAP scope (find second occurrence)
const secondParam = c.indexOf('          const PARAM_TIPS:', c.indexOf('TNI_CAT_COLOR'));
const secondCatEnd = c.indexOf('};', c.indexOf('          const CAT_COLOR:', secondParam)) + 2;
c = c.slice(0, secondParam) + c.slice(secondCatEnd);
console.log('Step 1 done: vars moved');

// Step 2: Extract Agent Guidance IIFE block
const GUIDANCE_START_MARKER = '                  {/* \u2500\u2500 Agent Guidance & Parameter Focus \u2500\u2500 */}';
const KW_DRILL_MARKER = '                  {/* \u2500\u2500 CLAP Keyword Drill Modal \u2500\u2500 */}';
const gIdx = c.indexOf(GUIDANCE_START_MARKER);
const kwIdx = c.indexOf(KW_DRILL_MARKER);
// Grab from guidance comment up to (but not including) KW Drill
const guidanceBlock = c.substring(gIdx, kwIdx).trimEnd();
console.log('Step 2: guidance block =', guidanceBlock.split('\n').length, 'lines');

// Step 3: Extract Agent Parameter Popup
const POPUP_MARKER = '                  {/* \u2500\u2500 Agent Parameter Popup \u2500\u2500 */}';
const pIdx = c.indexOf(POPUP_MARKER);
// Find end: the closing })} after document.body
const portalBodyIdx = c.indexOf('document.body', pIdx);
const popupCloseIdx = c.indexOf(')}', portalBodyIdx) + 2;
// Include trailing newline
let popupEnd = popupCloseIdx;
if (c[popupEnd] === '\n') popupEnd++;
const popupBlock = c.substring(pIdx, popupEnd).trimEnd();
console.log('Step 3: popup block =', popupBlock.split('\n').length, 'lines');

// Step 4: Remove both blocks from CLAP
// Remove popup first (higher position)
c = c.slice(0, pIdx) + c.slice(popupEnd);
// Remove guidance
c = c.slice(0, gIdx) + c.slice(gIdx + guidanceBlock.length);
console.log('Step 4 done: blocks removed from CLAP');

// Step 5: De-indent both blocks by 10 spaces
function deindent10(text) {
  return text.split('\n').map(l => {
    if (l.trim() === '') return '';
    return l.startsWith('                  ') ? l.slice(10) : l;
  }).join('\n');
}

const gDeindented = deindent10(guidanceBlock);
const pDeindented = deindent10(popupBlock);

// Step 6: Insert before Fraud Call slide (inside the component's return JSX)
const FRAUD_MARKER = '        {/* Fraud Call slide */}';
const fraudIdx = c.indexOf(FRAUD_MARKER);
if (fraudIdx === -1) { console.error('FRAUD_MARKER not found!'); process.exit(1); }
console.log('Found Fraud Call at char:', fraudIdx);

const insertion = '\n' +
  '        {/* \u2500\u2500 Agent Guidance & Parameter Focus (TNI Detection) \u2500\u2500 */}\n' +
  '        {activeSlide === 6 && (<>\n' +
  gDeindented + '\n' +
  pDeindented + '\n' +
  '</>)}\n\n';

c = c.slice(0, fraudIdx) + insertion + c.slice(fraudIdx);
console.log('Step 6 done: blocks inserted for TNI');

// Step 7: Actionable Insights changes
c = c.replace(
  "import FraudCallTab from './FraudCallTab';",
  "import FraudCallTab from './FraudCallTab';\nimport ActionableInsightsPanel from './ActionableInsightsPanel';"
);
c = c.replace(
  "{ label: 'Fraud Call',          color: 'rose'    },\n  { label: 'Raw Data',",
  "{ label: 'Fraud Call',          color: 'rose'    },\n  { label: 'Actionable Insights', color: 'indigo'  },\n  { label: 'Raw Data',"
);
c = c.replace(
  "{/* Fraud Call slide */}\n        {activeSlide === 7 && clientId && (\n          <FraudCallTab clientId={clientId} sd={sd} ed={ed} />\n        )}\n\n        {/* Raw Data slide */}\n        {activeSlide === 8 && clientId && canViewRawData && (",
  "{/* Fraud Call slide */}\n        {activeSlide === 7 && clientId && (\n          <FraudCallTab clientId={clientId} sd={sd} ed={ed} />\n        )}\n\n        {/* Actionable Insights slide */}\n        {activeSlide === 8 && (\n          <ActionableInsightsPanel />\n        )}\n\n        {/* Raw Data slide */}\n        {activeSlide === 9 && clientId && canViewRawData && ("
);

fs.writeFileSync(fp, c);
console.log('DONE! Final length:', c.length);
