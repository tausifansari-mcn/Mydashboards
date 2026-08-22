const fs = require('fs');
const fp = 'C:\\Users\\MAS60358\\Desktop\\My Dash\\Mydashboards\\frontend\\src\\features\\ai-quality\\InboundQualityDashboard.tsx';
const lines = fs.readFileSync(fp, 'utf8').split(/\r?\n/);
console.log('Total lines:', lines.length);

// Find key markers
const gComment = lines.findIndex((l,i) => l.includes('Agent Guidance & Parameter Focus') && i > 5000);
const kwDrill = lines.findIndex((l,i) => l.includes('CLAP Keyword Drill Modal') && i > 5000);
const popupComment = lines.findIndex((l,i) => l.includes('Agent Parameter Popup') && i > 5000);
const tniStart = lines.findIndex((l,i) => l.includes('activeSlide === 6 &&'));
const fraudStart = lines.findIndex((l,i) => l.includes('Fraud Call slide'));

console.log('Guidance comment at:', gComment + 1);
console.log('KW Drill at:', kwDrill + 1);
console.log('Popup at:', popupComment + 1);
console.log('TNI at:', tniStart + 1);
console.log('Fraud at:', fraudStart + 1);

// The guidance block is lines gComment..kwDrill-1 (everything before KW Drill)
// The popup block is lines popupComment..?
// Find popup's document.body
let popupBody = -1;
for (let i = popupComment; i < popupComment + 200; i++) {
  if (lines[i] && lines[i].trim() === 'document.body') { popupBody = i; break; }
}
console.log('Popup document.body at:', popupBody + 1);

// Popup ends with })}
let popupEnd = popupBody;
for (let i = popupBody; i < popupBody + 5; i++) {
  if (lines[i] && lines[i].trim() === ')}') { popupEnd = i; break; }
}
console.log('Popup ends at:', popupEnd + 1);
console.log('Popup next line:', JSON.stringify(lines[popupEnd + 1]?.trim()));

// Find TNI end
let tniFraudGap = lines.slice(tniStart, fraudStart);
let lastNonBlank = -1;
for (let i = fraudStart - 1; i >= tniStart; i--) {
  if (lines[i].trim() !== '') { lastNonBlank = i; break; }
}
console.log('Last non-blank before Fraud Call:', lastNonBlank + 1, JSON.stringify(lines[lastNonBlank]?.trim()));

// Walk backwards from lastNonBlank to find })()}) pattern
let idx = lastNonBlank;
while (idx >= tniStart) {
  const t = lines[idx].trim();
  if (t.startsWith('})()')) { console.log('IIFE close at:', idx + 1, JSON.stringify(t)); break; }
  idx--;
}

// Find the </> just before the TNI IIFE close
for (let i = lastNonBlank; i >= tniStart; i--) {
  if (lines[i].trim() === '</>') { console.log('Fragment close at:', i + 1); break; }
  if (lines[i].trim() === ')}') { console.log('Ternary close at:', i + 1); }
}
