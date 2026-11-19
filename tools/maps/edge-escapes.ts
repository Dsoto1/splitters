// Edge escapes: can anyone get out of a map past its built edge? (Atomic Court, 2026-11-19: a crouched player squeezed
// between the perimeter fence's posts into the strip behind it, and his team spawned out there.) For every ground-level
// cell side with nothing built beyond it, a body 0.5 (a tiny roulette roll on a small look) and 1.0 (standard) tries to
// go out prone, crouched and sprint-jumping, 2.5 s each from 1.2 m inside, in the real sim. An escape: still alive, past
// the edge by 0.8 m or more, and outside the play area (past the boundary, or on ground that doesn't route back to the
// spawns: Match.inPlay). Walking out onto ground that is still in play (a terrain map's open edge) is no escape.
//
//   node --experimental-transform-types --no-warnings tools/maps/edge-escapes.ts [map id ...]
//
// No ids: every map in maps/. Prints a line per map and exits 1 when any map has an escape.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUTTON_CROUCH, BUTTON_JUMP, BUTTON_PRONE, BUTTON_SPRINT, initPhysics, loadMap, rulesForMap } from '../../packages/shared/src/index.ts';
import { Match, initNavigation } from '../../packages/shared/src/match.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MAPS = join(ROOT, 'maps');
const SIDES = { N: [0, 1, 0], S: [0, -1, Math.PI], E: [1, 0, Math.PI / 2], W: [-1, 0, -Math.PI / 2] } as const;
const SIZES = [0.5, 1];
const MODES = ['prone', 'crouch', 'jump'] as const;

/** The escapes from one map (empty: none), and how many tries were made. */
export function edgeEscapes(id: string): { tries: number; escapes: string[] } {
  const loaded = loadMap(readFileSync(join(MAPS, `${id}.json`), 'utf8'));
  if (!loaded.ok) throw new Error(`${id}: ${loaded.issues.map((i) => i.message).join('; ')}`);
  const map = loaded.map;
  const m = new Match(map, { ...rulesForMap(map), respawnDelayTicks: 1 }, 1);
  const me = m.addHuman('probe')!;
  for (let i = 0; i < 5; i++) m.step();
  const cs = map.classicStructure;
  const built = new Set(cs.tiles.map((t) => `${t.x},${t.y},${t.z}`));
  const half = cs.cellSize / 2;
  let seq = 1;
  let tries = 0;
  const escapes: string[] = [];
  const hold = (n: number, yaw: number, buttons: (i: number) => number, forward = 1) => {
    for (let i = 0; i < n; i++) {
      m.queueInputs(me.slot, [{ seq: seq++, forward, right: 0, yaw, pitch: 0, buttons: buttons(i) }]);
      m.step();
    }
  };
  for (const t of cs.tiles) {
    if (t.z !== 0) continue;
    for (const [side, [dx, dz, yaw]] of Object.entries(SIDES)) {
      if (built.has(`${t.x + dx},${t.y + dz},0`)) continue;
      const cx = t.x * cs.cellSize;
      const cz = t.y * cs.cellSize;
      for (const off of [-2.3, 0.4, 2.7]) {
        const sx = cx + dx * (half - 1.2) + (dz ? off : 0);
        const sz = cz + dz * (half - 1.2) + (dx ? off : 0);
        for (const size of SIZES)
          for (const mode of MODES) {
            for (let i = 0; i < 10 && !me.alive; i++) m.step();
            me.size = size;
            me.outsideTicks = 0;
            me.move = { pos: { x: sx, y: 0.6, z: sz }, velY: 0, grounded: false };
            hold(20, yaw, () => 0, 0);
            if (!me.alive || !me.move.grounded || !m.inPlay(me.move.pos)) continue;
            tries++;
            hold(150, yaw, (i) => (mode === 'prone' ? BUTTON_PRONE : mode === 'crouch' ? BUTTON_CROUCH : i % 25 < 2 ? BUTTON_JUMP | BUTTON_SPRINT : BUTTON_SPRINT));
            const p = me.move.pos;
            const past = dx ? (p.x - (cx + dx * half)) * dx : (p.z - (cz + dz * half)) * dz;
            if (me.alive && past > 0.8 && !m.inPlay(p)) escapes.push(`${t.id} ${side} from (${sx.toFixed(1)}, ${sz.toFixed(1)}), size ${size} ${mode}, to (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`);
            hold(30, yaw, () => 0, 0);
          }
      }
    }
  }
  m.destroy();
  return { tries, escapes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await Promise.all([initPhysics(), initNavigation()]);
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(MAPS).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  let bad = 0;
  for (const id of ids) {
    const { tries, escapes } = edgeEscapes(id);
    if (escapes.length) bad++;
    console.log(`${escapes.length ? 'ESCAPES' : 'ok     '} ${id}: ${tries} tries, ${escapes.length} escapes${escapes.length ? `\n  ${escapes.slice(0, 10).join('\n  ')}` : ''}`);
  }
  if (bad) process.exitCode = 1;
}
