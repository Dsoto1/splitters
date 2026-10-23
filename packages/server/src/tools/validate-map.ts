import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildMapGeometry, initPhysics, loadMap, mapTerrainMesh } from '@chronosplit/shared';
import { NavWorld, initNavigation, validateNavigation } from '@chronosplit/shared/match';

/** Usage: pnpm validate-map <map.json> — prints creator-facing issues; exits 1 on errors. */
const arg = process.argv[2];
if (!arg) {
  console.error('usage: validate-map <map.json>');
  process.exit(2);
}
// pnpm runs scripts from the package directory; resolve against where the user ran the command.
const path = resolve(process.env.INIT_CWD ?? process.cwd(), arg);
await Promise.all([initPhysics(), initNavigation()]);
const result = loadMap(readFileSync(path, 'utf8'));
const issues = [...result.issues];
if (result.ok) {
  const nav = NavWorld.build(buildMapGeometry(result.map), mapTerrainMesh(result.map));
  issues.push(...validateNavigation(result.map, nav));
  nav.destroy();
}
for (const i of issues) console.log(`${i.severity.toUpperCase().padEnd(10)} ${i.code.padEnd(20)} ${i.message}`);
console.log(result.ok ? `OK (${issues.length} issue${issues.length === 1 ? '' : 's'})` : 'FAILED');
process.exit(result.ok ? 0 : 1);
