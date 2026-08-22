const fs = require('fs');
const fp = 'C:\\Users\\MAS60358\\Desktop\\My Dash\\Mydashboards\\frontend\\src\\features\\ai-quality\\InboundQualityDashboard.tsx';
const raw = fs.readFileSync(fp, 'utf8');
const lines = raw.split('\r\n');

// Step 1: Find the Agent Guidance block (currently misplaced between TNI end and Fraud Call)
const gStart = lines.findIndex(l => l.includes('{/* ── Agent Guidance & Parameter Focus ── */}'));
console.log('Guidance starts at line:', gStart);
console.log('Context before:', JSON.stringify(lines.slice(gStart - 3, gStart).map(s => s.trim())));

// Find end: the block ends with a createPortal closing: document.body then )}
let gEnd = -1;
for (let i = gStart + 10; i < Math.min(gStart + 700, lines.length); i++) {
  if (lines[i].trim() === 'document.body') {
    if (i + 1 < lines.length && lines[i + 1].trim() === '}') {
      gEnd = i + 1;
    }
  }
}
console.log('Guidance ends at line:', gEnd);
console.log('Context after:', JSON.stringify(lines.slice(gEnd + 1, gEnd + 5).map(s => s.trim())));

// Extract the block
const guidanceBlock = lines.slice(gStart, gEnd + 1);
console.log('Block has', guidanceBlock.length, 'lines');

// Remove the block (and any blank lines around it)
let removeStart = gStart;
while (removeStart > 0 && lines[removeStart - 1].trim() === '') removeStart--;
let removeEnd = gEnd + 1;
while (removeEnd < lines.length && lines[removeEnd].trim() === '') removeEnd++;
lines.splice(removeStart, removeEnd - removeStart);
console.log('Removed block, now', lines.length, 'lines');

// Step 2: Find where activeSlide === 4 (CLAP) needs fixing
// The CLAP slide lost its Agent Guidance section, which means it should now end 
// cleanly before the TNI slide. Let me verify:
const clapStart = lines.findIndex(l => l.includes('activeSlide === 4'));
const tniStart = lines.findIndex(l => l.includes('activeSlide === 6'));
console.log('CLAP at:', clapStart, 'TNI at:', tniStart);

// Step 3: Find the TNI slide's return Fragment end
// Look for the pattern: </> followed by ); followed by })()} 
let tniFragClose = -1;
for (let i = tniStart + 1; i < Math.min(tniStart + 700, lines.length); i++) {
  if (lines[i].trim() === '</>') {
    // Check if next meaningful lines form: ); then })()}
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (lines[j]?.trim() === ')') {
      let k = j + 1;
      while (k < lines.length && lines[k].trim() === '') k++;
      if (lines[k]?.trim() === ')') {
        let l = k + 1;
        while (l < lines.length && lines[l].trim() === '') l++;
        if (lines[l]?.trim() === ';') {
          let m = l + 1;
          while (m < lines.length && lines[m].trim() === '') m++;
          if (lines[m]?.trim().startsWith('})()}')) {
            tniFragClose = i;
            break;
          }
        }
      }
    }
  }
}
console.log('TNI Fragment close at:', tniFragClose);

if (tniFragClose === -1) {
  // Fallback: find })()} before Fraud Call
  const fraudLine = lines.findIndex(l => l.includes('Fraud Call slide'));
  let end = fraudLine - 1;
  while (end > 0 && lines[end].trim() === '') end--;
  // Walk back: })()} then ; then ) then </>
  while (end > 0 && !lines[end].trim().startsWith('})()}' )) end--;
  let closeParen = end - 1;
  while (closeParen > 0 && lines[closeParen].trim() === '') closeParen--;
  // Should be ;
  let returnEnd = closeParen - 1;
  while (returnEnd > 0 && lines[returnEnd].trim() === '') returnEnd--;
  // Should be )
  let fragClose = returnEnd - 1;
  while (fragClose > 0 && lines[fragClose].trim() === '') fragClose--;
  // Should be </>
  if (lines[fragClose]?.trim() === '</>') {
    tniFragClose = fragClose;
  }
  console.log('Fallback TNI Fragment close at:', tniFragClose);
}

if (tniFragClose === -1) {
  console.error('Cannot find TNI Fragment close! Aborting.');
  process.exit(1);
}

// Insert the guidance block before the Fragment close
lines.splice(tniFragClose, 0, '', ...guidanceBlock);

fs.writeFileSync(fp, lines.join('\r\n'));
console.log('Done! Final line count:', lines.length);
