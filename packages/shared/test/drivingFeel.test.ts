import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, it } from 'vitest';
import { BUTTON_USE, initPhysics, loadMap, rulesForMode, type MapDocument, type MapEntity, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * The Troop Buggy's feel measured on Rockfall Canyon (DRIVE_TRACE=<dir> writes feel.txt): speed kept over the roughest
 * straight stretch of the canyon floor, air time off its biggest natural crest, and the test yard's 1 m kicker
 * (drivePhysics.test.ts). docs/DRIVING_PHYSICS_PLAN.md, "Lighter" (owner, 2026-11-15: "really heavy and hard to hit
 * jumps on uneven terrain").
 */
describe.runIf(!!process.env.DRIVE_TRACE)('Troop Buggy feel on Rockfall Canyon', () => {
  it('rough stretch, natural crest', () => {
    const r = loadMap(readFileSync(fileURLToPath(new URL('../../../maps/canyon.json', import.meta.url)), 'utf8'));
    if (!r.ok) throw new Error('canyon');
    // Its buggies only, so nothing else is in the way.
    const first = r.map.entities.find((e: MapEntity) => e.kind === 'mount' && (e as { model: string }).model === 'troop_buggy');
    const map: MapDocument = { ...r.map, entities: r.map.entities.filter((e: MapEntity) => e.kind !== 'mount' || e === first) };
    const probe = new Match(map, { ...rulesForMode(map, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0 }, 1);
    const ph = (probe as unknown as { physics: { raycastNormal(o: unknown, d: unknown, l: number): { dist: number; normal: { y: number } } | null; boxClear(c: unknown, h: unknown, s?: unknown, l?: boolean, yaw?: number): boolean } }).physics;
    const at = (x: number, z: number) => {
      const h = ph.raycastNormal({ x, y: 200, z }, { x: 0, y: -1, z: 0 }, 400);
      return h ? { y: 200 - h.dist, ny: h.normal.y } : null;
    };
    // 40 m lines on the floor after a 26 m run-up (no slope over 14 degrees in the run-up, 20 on the line, nothing
    // in the way at the hull's height): the bumpiest (height change summed) and the one
    // with the biggest crest (a rise then a drop of at least 1 m within 20 m).
    let rough: { x: number; z: number; yaw: number; score: number } | null = null;
    let crest: { x: number; z: number; yaw: number; score: number } | null = null;
    for (let x = -100; x <= 100; x += 10)
      for (let z = -100; z <= 100; z += 10)
        for (let k = 0; k < 8; k++) {
          const yaw = (k * Math.PI) / 4;
          const pts: number[] = [];
          let ok = true;
          let prev: number | null = null;
          for (let d = -26; d <= 40 && ok; d += 2) {
            const g = at(x + Math.sin(yaw) * d, z + Math.cos(yaw) * d);
            ok = !!g && g.ny > Math.cos(((d < 0 ? 14 : 20) * Math.PI) / 180) && (prev === null || Math.abs(g.y - prev) < (d < 0 ? 0.6 : 0.9));
            prev = g?.y ?? null;
            if (g && ok) ok = ph.boxClear({ x: x + Math.sin(yaw) * d, y: g.y + 1.4, z: z + Math.cos(yaw) * d }, { x: 1.2, y: 0.4, z: 1 }, undefined, false, yaw);
            if (g && d >= 0) pts.push(g.y);
          }
          if (!ok) continue;
          let bump = 0;
          for (let i = 1; i < pts.length; i++) bump += Math.abs(pts[i]! - pts[i - 1]!);
          if (!rough || bump > rough.score) rough = { x, z, yaw, score: bump };
          let best = 0;
          for (let i = 6; i < pts.length - 6; i++) best = Math.max(best, Math.min(pts[i]! - Math.min(...pts.slice(i - 6, i)), pts[i]! - Math.min(...pts.slice(i, i + 6))));
          if (best > 0.6 && (!crest || best > crest.score)) crest = { x, z, yaw, score: best };
        }
    const out: string[] = [];
    const ride = (line: { x: number; z: number; yaw: number }, name: string) => {
      const match = new Match(map, { ...rulesForMode(map, 'core.tdm'), scoreLimit: 0, timeLimitSeconds: 0 }, 1);
      const me = match.addHuman('me')! as Combatant;
      let seq = 0;
      const send = (i: Partial<PlayerInput> = {}) => match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: me.yaw, pitch: 0, buttons: 0, ...i }]);
      for (let k = 0; k < 400; k++) { send(); match.step(); }
      const mounts = (match as unknown as { mounts: { def: { id: string }; pos: { x: number; y: number; z: number }; yaw: number; speed: number; airborne: boolean; seats: (number | null)[] }[] }).mounts;
      const m = mounts.find((x) => x.def.id === 'troop_buggy')!;
      me.move = { pos: { x: m.pos.x + 2.4, y: m.pos.y + 0.3, z: m.pos.z }, velY: 0, grounded: true };
      send({ buttons: BUTTON_USE });
      match.step();
      // 40 m run-up behind the line, then flat out along it.
      const ux = Math.sin(line.yaw);
      const uz = Math.cos(line.yaw);
      const s0 = at(line.x - ux * 26, line.z - uz * 26)!;
      m.pos = { x: line.x - ux * 26, y: s0.y + 0.1, z: line.z - uz * 26 };
      m.yaw = line.yaw;
      let air = 0;
      let longest = 0;
      let run = 0;
      const speeds: number[] = [];
      for (let k = 0; k < 600; k++) {
        send({ forward: 1, yaw: line.yaw });
        match.step();
        const along = (m.pos.x - line.x) * ux + (m.pos.z - line.z) * uz;
        if (along < 0 || along > 40) continue;
        speeds.push(m.speed);
        if (m.airborne) {
          air++;
          run++;
          longest = Math.max(longest, run);
        } else run = 0;
      }
      const mean = speeds.reduce((a, b) => a + b, 0) / Math.max(1, speeds.length);
      out.push(`${name}: over 40 m mean speed ${mean.toFixed(1)} m/s, slowest ${Math.min(...speeds).toFixed(1)}, ${speeds.length} ticks; airborne ${air} ticks, longest flight ${longest} ticks`);
    };
    if (rough) ride(rough, `rough stretch (${rough.score.toFixed(1)} m of ups and downs) at ${rough.x},${rough.z}`);
    if (crest) ride(crest, `crest (${crest.score.toFixed(1)} m) at ${crest.x},${crest.z}`);
    writeFileSync(`${process.env.DRIVE_TRACE}/feel.txt`, out.join('\n'));
  }, 600_000);
});
