import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, it } from 'vitest';
import { BUTTON_USE, initPhysics, loadMap, rulesForMode, type MapDocument, type MapEntity, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { simProfile } from '../src/sim/profile.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * The cost of driving (docs/DRIVING_PHYSICS_PLAN.md, "Cost"): eight Troop Buggies, each with a driver weaving flat out,
 * on a big map (Norman Shores: terrain and a few thousand colliders), the whole match step timed per tick, by drive:
 * the classic, driving physics 3's own hull solver (`own`) and the Rapier body (driving physics 4, the default).
 * DRIVE_TRACE=<dir> runs it and writes cost-8.txt there. Eight open places (level ground, 30 m clear ahead) are found first.
 */
function run(file: string, drive: 'classic' | 'own' | 'rigid', ticks: number): { n: number; mean: number; p95: number; chassis: number; dist: number } {
  const r = loadMap(readFileSync(fileURLToPath(new URL(`../../../maps/${file}.json`, import.meta.url)), 'utf8'));
  if (!r.ok) throw new Error(file);
  const first = r.map.entities.find((e: MapEntity) => e.kind === 'mount' && (e as { model: string }).model === 'troop_buggy')!;
  // Eight open places (level ground, nothing at hull height for 30 m ahead), 25 m apart: found once in a probe match.
  const bare: MapDocument = { ...r.map, entities: r.map.entities.filter((e) => e.kind !== 'mount') };
  const probe = new Match(bare, { ...rulesForMode(bare, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0 }, 1);
  const pp = (probe as unknown as { physics: { raycastNormal(o: unknown, d: unknown, l: number): { dist: number; normal: { y: number } } | null; boxClear(c: unknown, h: unknown, s?: unknown, l?: boolean, yaw?: number): boolean } }).physics;
  const spots: [number, number, number][] = [];
  for (let x = -150; x <= 150 && spots.length < 8; x += 5)
    for (let z = -150; z <= 150 && spots.length < 8; z += 5) {
      if (spots.some(([sx, , sz]) => Math.hypot(sx - x, sz - z) < 25)) continue;
      let ok = true;
      let y0 = 0;
      for (let d = 0; d <= 30 && ok; d += 3) {
        const h = pp.raycastNormal({ x: x + d, y: 200, z }, { x: 0, y: -1, z: 0 }, 400);
        ok = !!h && h.normal.y > 0.95;
        if (h && d === 0) y0 = 200 - h.dist;
        if (h && ok) ok = Math.abs(200 - h.dist - y0) < 1.5 && pp.boxClear({ x: x + d, y: 200 - h.dist + 1.4, z }, { x: 2.5, y: 0.8, z: 2.5 });
      }
      if (ok) spots.push([x, y0 + 0.3, z]);
    }
  const extra: MapEntity[] = spots.map((p, i) => ({ ...first, id: `perf_buggy_${i}`, position: p, yaw: Math.PI / 2 }) as MapEntity);
  const map: MapDocument = { ...r.map, entities: [...r.map.entities.filter((e) => e.kind !== 'mount'), ...extra] };
  const match = new Match(map, { ...rulesForMode(map, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0 }, 3, { drive });
  const mounts = (match as unknown as { mounts: { def: { id: string }; pos: { x: number; y: number; z: number }; yaw: number; health: number }[] }).mounts.filter((m) => m.def.id === 'troop_buggy');
  const drivers: { c: Combatant; seq: number }[] = [];
  for (let i = 0; i < mounts.length; i++) drivers.push({ c: match.addHuman(`d${i}`)! as Combatant, seq: 0 });
  const send = (d: { c: Combatant; seq: number }, i: Partial<PlayerInput>) => match.queueInputs(d.c.slot, [{ seq: ++d.seq, forward: 0, right: 0, yaw: d.c.yaw, pitch: 0, buttons: 0, ...i }]);
  match.step();
  for (let i = 0; i < mounts.length; i++) {
    const m = mounts[i]!;
    const d = drivers[i]!;
    d.c.move = { pos: { x: m.pos.x + 2.4, y: m.pos.y + 0.3, z: m.pos.z }, velY: 0, grounded: true };
    send(d, { buttons: BUTTON_USE });
    match.step();
  }
  const times: number[] = [];
  let dist = 0;
  simProfile.reset();
  simProfile.on = true;
  for (let k = 0; k < ticks; k++) {
    for (let i = 0; i < drivers.length; i++) send(drivers[i]!, { forward: 1, right: Math.sin(k / 45 + i) * 0.35 });
    const before = mounts.map((m) => ({ ...m.pos }));
    const t0 = performance.now();
    match.step();
    times.push(performance.now() - t0);
    mounts.forEach((m, i) => {
      dist += Math.hypot(m.pos.x - before[i]!.x, m.pos.z - before[i]!.z);
      m.health = 450;
    });
    for (const d of drivers) d.c.health = 100;
  }
  simProfile.on = false;
  times.sort((a, b) => a - b);
  return { n: mounts.length, mean: times.reduce((a, b) => a + b, 0) / ticks, p95: times[Math.floor(ticks * 0.95)]!, chassis: (simProfile.ms.get('chassis') ?? 0) / ticks, dist };
}

describe.runIf(!!process.env.DRIVE_TRACE)('driving cost', () => {
  it('eight driven buggies on Norman Shores', () => {
    const out: string[] = [];
    run('norman_shores', 'rigid', 120);
    for (let pass = 0; pass < 2; pass++)
      for (const mode of ['classic', 'own', 'rigid'] as const) {
        const r = run('norman_shores', mode, 600);
        out.push(`${mode === 'rigid' ? 'rapier body' : mode}: match step ${r.mean.toFixed(3)} ms mean, ${r.p95.toFixed(3)} ms p95 (Rapier hull steps ${r.chassis.toFixed(3)} ms a tick); ${r.dist.toFixed(0)} m driven by the ${r.n}`);
      }
    mkdirSync(process.env.DRIVE_TRACE!, { recursive: true });
    writeFileSync(`${process.env.DRIVE_TRACE}/cost-8.txt`, out.join('\n'));
  }, 600_000);
});
