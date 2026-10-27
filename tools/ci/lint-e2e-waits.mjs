// Fixed sleeps make browser tests flaky (too short on a loaded runner) and slow (too long everywhere else):
// wait for the condition a check needs instead (page.waitForFunction, simWait). A sleep that is the point of
// the step (let the player run for a while, hold a key) stays, marked with a `// wait-ok: why` comment on its
// line or the line above. CI's check job runs this; it fails on any unmarked `waitForTimeout(`.
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../../e2e/', import.meta.url);
const files = readdirSync(dir).filter((f) => /\.m?js$/.test(f));
const bad = [];
let allowed = 0;
for (const f of files) {
  const lines = readFileSync(new URL(f, dir), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!/\bwaitForTimeout\(/.test(line) || /^\s*(\/\/|\*)/.test(line)) return;
    if (/wait-ok:\s*\S/.test(line) || /wait-ok:\s*\S/.test(lines[i - 1] ?? '')) return void allowed++;
    bad.push(`e2e/${f}:${i + 1}: ${line.trim()}`);
  });
}
if (bad.length) {
  console.log(`${bad.length} fixed sleep(s) in e2e without a "// wait-ok: why" note: wait for the condition the next check needs instead.\n${bad.join('\n')}`);
  process.exit(1);
}
console.log(`e2e waits: no unmarked waitForTimeout (${allowed} marked wait-ok)`);
