const fs = require('fs');
const fp = 'C:\\Users\\MAS60358\\Desktop\\My Dash\\Mydashboards\\frontend\\src\\features\\ai-quality\\InboundQualityDashboard.tsx';
let lines = fs.readFileSync(fp, 'utf8').split(/\r?\n/);
console.log('Starting lines:', lines.length);

function findLine(pattern, after = 0) {
  for (let i = after; i < lines.length; i++) {
    if (lines[i].includes(pattern)) return i;
  }
  return -1;
}

function deindent(arr, n) {
  return arr.map(l => {
    if (l.trim() === '') return '';
    const spaces = l.match(/^(\s*)/)[1].length;
    if (spaces >= n) return l.slice(n);
    return l;
  });
}

// ── 1. Move PARAM_TIPS + CAT_COLOR to component scope (de-indent from 10 to 0) ──
const tnEnd = findLine('};', findLine('TNI_CAT_COLOR'));
const pStart = findLine('const PARAM_TIPS:', 5000);
const cStart = findLine('const CAT_COLOR:', 5000);
const cEnd = findLine('};', cStart);

const scopeBlock = deindent(lines.slice(pStart, cEnd + 1), 10);
lines.splice(tnEnd + 1, 0, '', ...scopeBlock, '');
const inserted = scopeBlock.length + 2;
lines.splice(5178 + inserted, cEnd + 1 - pStart);
const shift = inserted - (cEnd + 1 - pStart);
console.log('Scope moved. Shift:', shift);

// ── 2. Find blocks ──
const b1Comment = findLine('Agent Guidance & Parameter Focus', 5000);
const kwDrill = findLine('CLAP Keyword Drill Modal', 5000);
let b1End = kwDrill;
while (b1End > b1Comment && lines[b1End - 1].trim() === '') b1End--;
const block1 = lines.slice(b1Comment, b1End);
console.log('Block1:', block1.length, 'lines');

const b2Comment = findLine('Agent Parameter Popup', kwDrill);
let b2Body = -1;
for (let i = b2Comment; i < b2Comment + 200; i++) {
  if (lines[i]?.trim() === 'document.body') { b2Body = i; break; }
}
let b2End = b2Body;
for (let i = b2Body; i < b2Body + 5; i++) {
  if (lines[i]?.trim() === ')}') { b2End = i + 1; break; }
}
while (b2End < lines.length && lines[b2End].trim() === '') b2End++;
const block2 = lines.slice(b2Comment, b2End);
console.log('Block2:', block2.length, 'lines');

// ── 3. Remove from CLAP ──
let b2Start = b2Comment;
if (b2Start > 0 && lines[b2Start - 1].trim() === '') b2Start--;
const b2Gone = b2End - b2Start;
lines.splice(b2Start, b2Gone);

let b1Start = b1Comment;
if (b1Start > 0 && lines[b1Start - 1].trim() === '') b1Start--;
b1Start -= b2Gone;
const b1Gone = b1End - b2Gone - (b1Start + b2Gone);
lines.splice(b1Start, b1Gone);
console.log('After removals:', lines.length);

// ── 4. De-indent blocks (18sp → 8sp = subtract 10) ──
const d1 = deindent(block1, 10);
const d2 = deindent(block2, 10);

// ── 5. Insert before Fraud Call ──
const fraudLine = findLine('Fraud Call slide');

const wrapper = [
  '',
  '        {/* ── Agent Guidance & Parameter Focus (moved from CLAP to TNI Detection) ── */}',
  '        {activeSlide === 6 && (<>',
  ...d1,
  ...d2,
  '</>)}',
  '',
];

lines.splice(fraudLine, 0, ...wrapper);
console.log('Final lines:', lines.length);

// ── 6. Actionable Insights changes ──
let content = lines.join('\r\n');

content = content.replace(
  "import FraudCallTab from './FraudCallTab';",
  "import FraudCallTab from './FraudCallTab';\nimport ActionableInsightsPanel from './ActionableInsightsPanel';"
);

content = content.replace(
  "{ label: 'Fraud Call',          color: 'rose'    },\n  { label: 'Raw Data',",
  "{ label: 'Fraud Call',          color: 'rose'    },\n  { label: 'Actionable Insights', color: 'indigo'  },\n  { label: 'Raw Data',"
);

content = content.replace(
  "{/* Fraud Call slide */}\n        {activeSlide === 7 && clientId && (\n          <FraudCallTab clientId={clientId} sd={sd} ed={ed} />\n        )}\n\n        {/* Raw Data slide */}\n        {activeSlide === 8 && clientId && canViewRawData && (",
  "{/* Fraud Call slide */}\n        {activeSlide === 7 && clientId && (\n          <FraudCallTab clientId={clientId} sd={sd} ed={ed} />\n        )}\n\n        {/* Actionable Insights slide */}\n        {activeSlide === 8 && (\n          <ActionableInsightsPanel />\n        )}\n\n        {/* Raw Data slide */}\n        {activeSlide === 9 && clientId && canViewRawData && ("
);

fs.writeFileSync(fp, content);
console.log('DONE!');
