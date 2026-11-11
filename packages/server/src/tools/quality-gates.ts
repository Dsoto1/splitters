import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, TICK_RATE, initPhysics, isRetiredMap, loadMap, mapGates, mapTier, rulesForMap, type MapDocument, type MapTier } from '@tiletrigger/shared';
import { Match, initNavigation, validateMapNavigation } from '@tiletrigger/shared/match';

/**
 * Quality gates for maps (HANDOFF, "Quality tiers": the checks a map must pass to be on the core roster; for an
 * experimental one they only report). One line a gate, per map:
 *
 * - `loads`: the file loads and validates with no errors;
 * - `navigation`: the navigation audit as for an official map (no traps, every spawn, objective and pickup reachable);
 * - `spawns`: spawn points for as many players as the map recommends at most;
 * - `budgets`: nothing over its budget (props, models, draws, lights, plants, the file's size…);
 * - `card`: the menu card's shot, when the map sets one (MapMaker's Card shot), isn't a picture of a wall;
 * - `plays`: a bots-only match of its main mode runs: nobody is left alive below the world, positions stay finite, and most
 *   bots get somewhere (moved more than a few metres in the time).
 *
 * Usage (from the repo root):
 *   pnpm quality-gates                      every map of maps/ that is offered (retired ones left out)
 *   pnpm quality-gates iron_coast citadel   those maps
 *   pnpm quality-gates --json=gates.json    the results as a file too
 *   pnpm quality-gates --seconds=30         a longer bots-only match (default 15)
 * Exits 1 when a core map fails a gate (an experimental map's gates only report). Characters' gates (grips, portraits, faces) need the game's renderer: not here yet.
 */
const MAPS = fileURLToPath(new URL('../../../../maps/', import.meta.url));
const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const seconds = Number(opt('seconds') ?? 15);
const named = args.filter((a) => !a.startsWith('--'));
const ids = (named.length ? named : readdirSync(MAPS).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter((id) => !isRetiredMap(id) && !id.startsWith('test_'))).sort();

type Gate = 'loads' | 'navigation' | 'spawns' | 'budgets' | 'card' | 'plays';
interface Result {
  map: string;
  name: string;
  tier: MapTier;
  gates: Record<Gate, { pass: boolean; note: string } | null>;
}

function plays(map: MapDocument): { pass: boolean; note: string } {
  const bots = Math.max(4, Math.min(16, map.metadata.recommendedPlayers.max));
  const match = new Match(map, rulesForMap(map), 7);
  for (let i = 0; i < bots; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal);
  const floor = Math.min(-5, ...map.entities.filter((e) => e.kind === 'spawn').map((e) => e.position[1] - 2));
  const start = new Map<number, { x: number; z: number }>();
  const far = new Map<number, number>();
  // Falling off can be the game (a ring-out map): what fails is someone left alive below the world, never killed.
  const below = new Map<number, number>();
  const fell = new Set<string>();
  let broken = false;
  for (let t = 0; t < seconds * TICK_RATE; t++) {
    match.step();
    for (const c of match.combatants()) {
      const p = c.move.pos;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) broken = true;
      if (c.alive && p.y < floor) {
        below.set(c.slot, (below.get(c.slot) ?? 0) + 1);
        if (below.get(c.slot)! > 3 * TICK_RATE) fell.add(c.name);
      } else below.delete(c.slot);
      if (!c.alive) {
        start.delete(c.slot);
        continue;
      }
      const s = start.get(c.slot) ?? start.set(c.slot, { x: p.x, z: p.z }).get(c.slot)!;
      far.set(c.slot, Math.max(far.get(c.slot) ?? 0, Math.hypot(p.x - s.x, p.z - s.z)));
    }
  }
  const moved = [...far.values()].filter((d) => d > 3).length;
  match.destroy();
  if (broken) return { pass: false, note: 'a position stopped being a number' };
  if (fell.size) return { pass: false, note: `${fell.size} fell out of the world and lived (${[...fell].slice(0, 3).join(', ')})` };
  const share = far.size ? moved / far.size : 0;
  return { pass: share >= 0.6, note: `${moved} of ${far.size} bots got somewhere in ${seconds} s` };
}

await Promise.all([initPhysics(), initNavigation()]);
const results: Result[] = [];
for (const id of ids) {
  const text = readFileSync(resolve(MAPS, `${id}.json`), 'utf8');
  const loaded = loadMap(text);
  let tier: MapTier = 'core';
  const gates: Result['gates'] = { loads: null, navigation: null, spawns: null, budgets: null, card: null, plays: null };
  const errors = loaded.issues.filter((i) => i.severity === 'error');
  gates.loads = { pass: loaded.ok && !errors.length, note: errors.length ? errors[0]!.message : `${loaded.issues.length} note${loaded.issues.length === 1 ? '' : 's'}` };
  if (loaded.ok) {
    const map = loaded.map;
    const nav = validateMapNavigation(map, true).issues.filter((i) => i.severity === 'error');
    gates.navigation = { pass: !nav.length, note: nav.length ? `${nav.length}: ${nav[0]!.message}` : 'no traps, everything reachable' };
    for (const g of mapGates(map)) gates[g.id as Gate] = { pass: g.pass, note: g.note };
    tier = mapTier(map.metadata);
    try {
      gates.plays = plays(map);
    } catch (e) {
      gates.plays = { pass: false, note: `the match threw: ${(e as Error).message}` };
    }
  }
  results.push({ map: id, name: loaded.ok ? loaded.map.metadata.name : id, tier, gates });
  const failed = (Object.entries(gates) as [Gate, Result['gates'][Gate]][]).filter(([, g]) => g && !g.pass);
  // A core map must pass; for an experimental one the gates only report.
  console.log(`${failed.length ? (tier === 'core' ? 'FAIL' : 'note') : 'pass'}  ${id.padEnd(24)} ${tier === 'core' ? '' : '(experimental) '}${failed.map(([k, g]) => `${k}: ${g!.note}`).join(' | ')}`);
}
const failing = results.filter((r) => r.tier === 'core' && Object.values(r.gates).some((g) => g && !g.pass));
const core = results.filter((r) => r.tier === 'core').length;
console.log(`\n${core - failing.length} of ${core} core maps pass every gate (${results.length - core} experimental: reported only)`);
const json = opt('json');
if (json) writeFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), json), JSON.stringify(results, null, 1));
process.exit(failing.length ? 1 : 0);
