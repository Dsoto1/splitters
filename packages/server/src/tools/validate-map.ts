import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initPhysics, loadMap } from '@tiletrigger/shared';
import { initNavigation, validateMapNavigation } from '@tiletrigger/shared/match';

/**
 * Usage: pnpm validate-map <map.json> — prints creator-facing issues; exits 1 on errors. A map in the repo's maps/
 * folder is official: the navigation audit's findings (traps, spawn points, objectives and pickups cut off) and spawn
 * points inside something solid are errors there (docs/BOTS.md, "Navigation audit"); warnings for anyone else's.
 */
const arg = process.argv[2];
if (!arg) {
  console.error('usage: validate-map <map.json>');
  process.exit(2);
}
// pnpm runs scripts from the package directory; resolve against where the user ran the command.
const path = resolve(process.env.INIT_CWD ?? process.cwd(), arg);
const official = path.startsWith(fileURLToPath(new URL('../../../../maps/', import.meta.url)));
await Promise.all([initPhysics(), initNavigation()]);
const result = loadMap(readFileSync(path, 'utf8'));
const issues = [...result.issues];
if (result.ok) issues.push(...validateMapNavigation(result.map, official).issues);
for (const i of issues) console.log(`${i.severity.toUpperCase().padEnd(10)} ${i.code.padEnd(20)} ${i.message}`);
const errors = issues.filter((i) => i.severity === 'error').length;
console.log(result.ok && !errors ? `OK (${issues.length} issue${issues.length === 1 ? '' : 's'})` : `FAILED (${errors} error${errors === 1 ? '' : 's'})`);
process.exit(result.ok && !errors ? 0 : 1);
