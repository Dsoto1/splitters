/**
 * Headless bot-match audit, skipped in the normal suite. Eight bots of mixed
 * skill play Team Deathmatch on each map; prints kills, accuracy, vehicle and
 * grenade use, how much of the map they cover, how often a bot stands stuck,
 * where they spend their time and how well armed they are. Run:
 *   AUDIT_MAPS=sandgate,canyon AUDIT_SECONDS=180 pnpm exec vitest run packages/shared/test/botAudit.test.ts --silent=false
 */
import { readFileSync } from "node:fs";
import { it } from "vitest";
import {
  BOT_DIFFICULTIES,
  CORE_BOT_PROFILES,
  DEFAULT_TDM_RULES,
  TICK_RATE,
  initPhysics,
  loadMap,
  type GameEvent,
} from "../src/index.ts";
import { Match, initNavigation } from "../src/match.ts";

const MAPS = (process.env.AUDIT_MAPS ?? "").split(",").filter(Boolean);
const SECONDS = Number(process.env.AUDIT_SECONDS ?? 180);

it.skipIf(MAPS.length === 0)(
  "bot match audit",
  async () => {
    await Promise.all([initPhysics(), initNavigation()]);
    const lines: string[] = [];
    for (const id of MAPS) {
      const r = loadMap(
        JSON.parse(
          readFileSync(
            new URL(`../../../maps/${id}.json`, import.meta.url),
            "utf8",
          ),
        ),
      );
      if (!r.ok) {
        lines.push(`${id}: load failed`);
        continue;
      }
      const t0 = performance.now();
      const match = new Match(
        r.map,
        { ...DEFAULT_TDM_RULES, scoreLimit: 0, timeLimit: 0 } as never,
        7,
      );
      const diffs = [
        BOT_DIFFICULTIES.easy,
        BOT_DIFFICULTIES.normal,
        BOT_DIFFICULTIES.hard,
      ];
      const bots = Array.from(
        { length: 8 },
        (_, i) =>
          match.addBot(
            `b${i}`,
            CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!,
            diffs[i % 3]!,
          )!,
      );
      const states: Record<string, number> = {};
      let kills = 0,
        hs = 0,
        worldKills = 0,
        shots = 0,
        hits = 0,
        mounts = 0,
        throws = 0;
      const weaponKills: Record<string, number> = {};
      const stuck = new Map<number, number>();
      const last = new Map<number, { x: number; z: number; t: number }>();
      const cells = new Set<string>();
      let stuckEvents = 0;
      let sentryDown = 0;
      const sAlive = new Map<number, boolean>();
      let atSentry = 0;
      let armed = 0,
        aliveT = 0;
      const picks: Record<string, number> = {};
      const stuckSpots: string[] = [];
      for (let t = 0; t < SECONDS * TICK_RATE; t++) {
        const ev = match.step() as GameEvent[];
        for (const e of ev) {
          if (e.e === "kill") {
            kills++;
            if (e.hs) hs++;
            if (e.killer === null || e.killer === e.victim) worldKills++;
            weaponKills[e.weapon] = (weaponKills[e.weapon] ?? 0) + 1;
          } else if (e.e === "shot") {
            shots++;
            hits += e.hit.filter((h) => h !== null).length ? 1 : 0;
          } else if (e.e === "mount" && e.seat >= 0) mounts++;
          else if (e.e === "throw") throws++;
          else if (e.e === "pickup") picks[e.item] = (picks[e.item] ?? 0) + 1;
        }
        for (const m of (
          match as unknown as {
            mounts: { index: number; alive: boolean; def: { kind: string } }[];
          }
        ).mounts) {
          if (m.def.kind !== "sentry") continue;
          if (sAlive.get(m.index) && !m.alive) sentryDown++;
          sAlive.set(m.index, m.alive);
        }
        for (const b of bots)
          if (
            (b.bot as unknown as { targetSlot: number | null }).targetSlot! >=
            1_000_000
          )
            atSentry++;
        for (const b of bots) {
          if (!b.alive || !b.move) continue;
          const st = (b.bot as unknown as { state: string }).state;
          aliveT++;
          if (b.weapons.size > 2) armed++;
          states[st] = (states[st] ?? 0) + 1;
          const p = b.move.pos;
          cells.add(`${Math.floor(p.x / 8)},${Math.floor(p.z / 8)}`);
          if (t % TICK_RATE === 0) {
            const l = last.get(b.slot);
            if (
              l &&
              Math.hypot(p.x - l.x, p.z - l.z) < 0.5 &&
              !["hold", "cover", "engage", "mounted"].includes(st)
            ) {
              const n = (stuck.get(b.slot) ?? 0) + 1;
              stuck.set(b.slot, n);
              if (n === 8) {
                stuckEvents++;
                if (stuckSpots.length < 6)
                  stuckSpots.push(
                    `${st}@${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)}`,
                  );
              }
            } else stuck.set(b.slot, 0);
            last.set(b.slot, { x: p.x, z: p.z, t });
          }
        }
      }
      const tot = Object.values(states).reduce((a, b) => a + b, 0);
      const pct = Object.entries(states)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${((v / tot) * 100).toFixed(0)}%`)
        .join(" ");
      lines.push(
        `${id}: ${((performance.now() - t0) / 1000).toFixed(0)}s cpu | kills ${kills} (hs ${hs}, world ${worldKills}) shots ${shots} hit% ${shots ? ((hits / shots) * 100).toFixed(0) : 0} | mounts ${mounts} throws ${throws} | cells ${cells.size} | stuck ${stuckEvents} ${stuckSpots.join(" ")}\n    ${pct}\n    ${Object.entries(
          weaponKills,
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([k, v]) => `${k.replace("core.", "")} ${v}`)
          .join(", ")}`,
      );
      lines[lines.length - 1] +=
        `\n    sentryDown ${sentryDown} sentryTargetTicks ${atSentry} pickupEnts ${r.map.entities.filter((e) => e.kind === "pickup").length} armed ${((armed / aliveT) * 100).toFixed(0)}% picks ${Object.entries(
          picks,
        )
          .map(([k, v]) => `${k.replace("core.", "")} ${v}`)
          .join(", ")}`;
      console.log(lines.at(-1));
    }
  },
  3_600_000,
);
