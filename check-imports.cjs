// Run from your BACKEND folder:  node check-imports.js
// Finds imports whose capital letters don't match the real file name stored in Git.
// (Windows ignores capitals; Render's Linux servers don't, so these crash the deploy.)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
let tracked;
try {
  tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })
    .split(/\r?\n/).filter(Boolean);
} catch (e) {
  console.error('Could not run "git ls-files". Run this inside your backend repo folder.');
  process.exit(1);
}
const exact = new Set(tracked);
const lowerMap = new Map();
tracked.forEach(f => { const k = f.toLowerCase(); (lowerMap.get(k) || lowerMap.set(k, []).get(k)).push(f); });

let problems = 0;
const importRe = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

for (const file of tracked.filter(f => /\.(m?js|cjs)$/.test(f) && !f.startsWith('node_modules/'))) {
  let src;
  try { src = fs.readFileSync(path.join(root, file), 'utf8'); } catch { continue; }
  let m;
  while ((m = importRe.exec(src))) {
    const spec = m[1] || m[2];
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
    const candidates = [target, target + '.js', target + '/index.js'];
    if (candidates.some(c => exact.has(c))) continue;
    const near = candidates.flatMap(c => lowerMap.get(c.toLowerCase()) || []);
    problems++;
    if (near.length) console.log(`CASE MISMATCH in ${file}\n   imports  : ${spec}\n   Git has  : ${near[0]}\n`);
    else console.log(`MISSING FILE  in ${file}\n   imports  : ${spec}\n   (nothing with that name is tracked in Git — add/commit it)\n`);
  }
}

// Also flag files whose name differs only by capitals (two copies in Git)
for (const [, names] of lowerMap) {
  if (names.length > 1) { problems++; console.log('TWO FILES differing only by capitals:\n   ' + names.join('\n   ') + '\n'); }
}
console.log(problems ? `${problems} problem(s) found. Fix these before pushing.` : 'All imports match the file names in Git. 👍');
