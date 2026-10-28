import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_DIFFICULTIES, CORE_BOT_PROFILES, DEFAULT_DEATHMATCH_RULES, DEFAULT_RULES, INTEREST_MIN_PLAYERS, MAX_PLAYER_SLOTS, SNAPSHOT_INTERVAL_TICKS, SnapshotDecoder, SnapshotStream, encodeSnapshots, initPhysics, interestFor, loadMap, rulesForMode, type GameEvent, type PlayerSnapshot, type ServerMessage, type SnapshotBody } from '../src/index.ts';
import { AWAY, BotFiller, Match, clumpArea, clumpInto, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const yard = () => {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [30, 0, 4], [10, 0, 10], [20, 0, 10]]);
};

const run = (m: Match, n: number): GameEvent[] => {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...m.step());
  return out;
};

describe('players joining and leaving running matches', () => {
  it('a joining player replaces the worst-scoring bot on the team that needs a player and spawns normally', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] }, 5);
    const filler = new BotFiller(match);
    const host = filler.join('Host', undefined, 4)!;
    expect(match.combatants()).toHaveLength(4);
    run(match, 90);
    // The host's team already has a person: the newcomer goes to the other one.
    const bots = match.combatants().filter((c) => c.kind === 'bot' && c.faction !== host.faction);
    bots[0]!.kills = 3;
    if (bots[1]) bots[1].deaths = 2;
    const worst = [...bots].sort((a, b) => a.kills - a.deaths - (b.kills - b.deaths))[0]!;
    const gone = { name: worst.name, pos: { ...worst.move.pos } };
    const ana = filler.join('Ana', undefined, 4)!;
    // The worst-scoring bot on the team that needs a player is gone; Ana takes a fresh place there.
    expect(match.combatants().some((c) => c.name === gone.name)).toBe(false);
    expect(ana.faction).not.toBe(host.faction);
    expect(match.combatants()).toHaveLength(4);
    expect(ana.kind).toBe('human');
    expect(ana.bot).toBeUndefined();
    expect(ana.kills).toBe(0);
    // She spawns at a spawn point like anyone else, not where the bot stood.
    const spawns = match.map.entities.filter((e) => e.kind === 'spawn');
    expect(spawns.some((e) => Math.hypot(e.position[0] - ana.move.pos.x, e.position[2] - ana.move.pos.z) < 1.5)).toBe(true);
    expect(match.step().find((e) => e.e === 'takeover')).toEqual({ e: 'takeover', s: ana.slot, to: 'Ana', from: gone.name });
    // Its inputs start from seq 1 like any new player.
    match.queueInputs(ana.slot, [{ seq: 1, forward: 1, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
    expect(ana.queue).toHaveLength(1);
  });

  it('a leaving player\u2019s slot empties and a fresh bot spawns normally (or, with take-back on, a bot takes their place where they were)', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] }, 6);
    const filler = new BotFiller(match);
    filler.join('Host', undefined, 4);
    run(match, 30);
    const ana = filler.join('Ana', undefined, 4)!;
    const team = ana.faction;
    filler.leave(ana.slot, 4);
    expect(match.combatants()).toHaveLength(4);
    expect(match.combatants().filter((c) => c.kind === 'human')).toHaveLength(1);
    // The fresh bot fills Ana's team, spawned like anyone else (no take-over).
    expect(match.combatants().filter((c) => c.faction === team && c.kind === 'bot')).toHaveLength(2);
    expect(match.step().some((e) => e.e === 'takeover' && e.bot)).toBe(false);

    const keep = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] }, 6);
    const back = new BotFiller(keep, BOT_DIFFICULTIES.normal, { takeBack: true });
    back.join('Host', undefined, 4);
    run(keep, 30);
    const bea = back.join('Bea', undefined, 4)!;
    run(keep, 60);
    const slot = bea.slot;
    const pos = { ...bea.move.pos };
    back.leave(slot, 4);
    const bot = keep.slots[slot]!;
    expect(bot.kind).toBe('bot');
    expect(bot.move.pos).toEqual(pos);
    expect(keep.step().find((e) => e.e === 'takeover')).toMatchObject({ s: slot, from: 'Bea', bot: 1 });
  });

  it('a match without bots to take over gives the newcomer a free slot, and a full one turns them away', () => {
    const match = new Match(yard(), DEFAULT_DEATHMATCH_RULES, 1);
    const filler = new BotFiller(match);
    expect(filler.join('A', undefined, 1)!.kind).toBe('human');
    expect(match.combatants()).toHaveLength(1);
    expect(filler.join('B', undefined, 1)!.kind).toBe('human');
    for (let i = 2; i < MAX_PLAYER_SLOTS; i++) match.addHuman(`p${i}`);
    expect(filler.join('late', undefined, 1)).toBeNull();
  });
});

describe('away players', () => {
  const still = (seq: number) => ({ seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 });
  const moving = (seq: number) => ({ ...still(seq), forward: 1 });

  it('warns an idle player, then a bot plays their place until they play again', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] }, 7);
    const filler = new BotFiller(match);
    filler.join('Host', undefined, 4);
    const ana = filler.join('Ana', undefined, 4)!;
    const people = new Set([ana.slot]);
    const team = ana.faction;
    filler.input(ana.slot, [still(1)]);
    // Untouched inputs (a client sends them all the time) don't count as playing.
    let seq = 2;
    let warned = false;
    for (let s = 0; s < AWAY.afkSeconds - 1; s++) {
      run(match, 60);
      filler.input(ana.slot, [still(seq++)]);
      warned ||= filler.watch(4, people, AWAY.afkSeconds).warn.includes(ana.slot);
    }
    expect(warned).toBe(true);
    expect(filler.isAway(ana.slot)).toBe(false);
    run(match, 120);
    expect(filler.watch(4, people, AWAY.afkSeconds).away).toEqual([ana.slot]);
    const body = match.slots[ana.slot]!;
    expect(body).toMatchObject({ kind: 'bot', faction: team, name: 'Ana (away)' });
    // The place stays theirs: a newcomer takes another bot, and the fill doesn't change around it.
    const cleo = filler.join('Cleo', undefined, 4)!;
    expect(cleo.slot).not.toBe(ana.slot);
    expect(match.combatants()).toHaveLength(4);
    run(match, 60);
    // Still idle long after: the host is told to remove them.
    expect(filler.watch(4, people, AWAY.afkSeconds, 1).kick).toEqual([]);
    run(match, 60 * 61);
    expect(filler.watch(4, people, AWAY.afkSeconds, 1).kick).toEqual([ana.slot]);
    // They play: the place is theirs again, the name too.
    expect(filler.input(ana.slot, [moving(seq++)])).toBe(true);
    expect(match.slots[ana.slot]).toMatchObject({ kind: 'human', name: 'Ana' });
    expect(match.idleSeconds(ana.slot)).toBe(0);
  });

  it("keeps a dropped player's place for their next connection, then gives it to the bot", () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] }, 8);
    const filler = new BotFiller(match);
    filler.join('Host', undefined, 4);
    const bea = filler.join('Bea', undefined, 4)!;
    run(match, 30);
    bea.kills = 5;
    expect(filler.hold(bea.slot, 'dropped', 'pk:bea', 4)).toBe(true);
    expect(match.slots[bea.slot]!.kind).toBe('bot');
    run(match, 60);
    // Someone else's connection doesn't get it; hers does, score and all.
    expect(filler.reclaim('pk:other', 'Bea')).toBeNull();
    const back = filler.reclaim('pk:bea', 'Bea')!;
    expect(back).toMatchObject({ slot: bea.slot, kind: 'human', name: 'Bea', kills: 5 });
    // Her new connection counts inputs from 1 again.
    filler.input(bea.slot, [moving(1)]);
    expect(back.queue).toHaveLength(1);
    // Dropped again and gone too long: the bot keeps the place, under a bot name.
    filler.hold(bea.slot, 'dropped', 'pk:bea', 4, 1);
    run(match, 70);
    expect(filler.watch(4, new Set(), AWAY.afkSeconds).released).toEqual(['Bea']);
    expect(match.slots[bea.slot]).toMatchObject({ kind: 'bot' });
    expect(match.slots[bea.slot]!.away).toBeUndefined();
    expect(filler.reclaim('pk:bea', 'Bea')).toBeNull();
    // No key (nothing to recognise them by): they simply leave.
    const cy = filler.join('Cy', undefined, 4)!;
    expect(filler.hold(cy.slot, 'dropped', null, 4)).toBe(false);
    expect(match.combatants().some((c) => c.name === 'Cy')).toBe(false);
  });
});

describe('interest management', () => {
  const player = (s: number, x: number, alive: 0 | 1 = 1): PlayerSnapshot => ({ s, p: [x, 0, 0], vy: 0, g: 1, yaw: 0, pitch: 0, hp: 100, ar: 0, alive, w: 1, pu: 0 });
  const body = (players: PlayerSnapshot[], tick: number): SnapshotBody => ({ tick, phase: 'playing', timeLeft: 0, players, score: [], ev: [], pr: [], pk: [], np: [] });

  it('small matches send everyone every time', () => {
    const players = Array.from({ length: INTEREST_MIN_PLAYERS }, (_, i) => player(i, i * 20));
    const [text] = encodeSnapshots(body(players, 10), [{ slot: 0, ack: 3 }]);
    const msg = JSON.parse(text!);
    expect(msg.players).toHaveLength(INTEREST_MIN_PLAYERS);
    expect(msg.hold).toBeUndefined();
    expect(msg.ack).toBe(3);
  });

  it('big matches send far players less often, near ones and yourself every time, and say who was held back', () => {
    const players = Array.from({ length: 96 }, (_, i) => player(i, i < 10 ? i : i < 40 ? 100 : 400));
    const seen = new Map<number, number>();
    const snaps = 8;
    for (let k = 0; k < snaps; k++) {
      const b = body(players, k * SNAPSHOT_INTERVAL_TICKS);
      const { send, hold } = interestFor(b, 0);
      expect(send.length + hold.length).toBe(96);
      for (const i of send) seen.set(players[i]!.s, (seen.get(players[i]!.s) ?? 0) + 1);
      const msg = JSON.parse(encodeSnapshots(b, [{ slot: 0, ack: 1, me: { inv: [], rl: 0, rs: 0, sp: 0, dm: 0 } }])[0]!);
      expect(msg.players.length + msg.hold.length).toBe(96);
      expect(msg.me).toBeDefined();
    }
    expect(seen.get(0)).toBe(snaps);
    expect(seen.get(5)).toBe(snaps);
    expect(seen.get(20)).toBe(snaps / 2);
    expect(seen.get(60)).toBe(snaps / 4);
    // A dead viewer (spectating) gets everyone.
    const dead = players.map((p) => (p.s === 0 ? player(0, 0, 0) : p));
    expect(interestFor(body(dead, 2), 0).hold).toHaveLength(0);
  });

  it('delta snapshots rebuild every player as sent (others to the centimetre, yourself exactly), through joins, leaves, held players and changing fields', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (const size of [8, 96]) {
      let players = Array.from({ length: size }, (_, i) => player(i, rand() * 400));
      const streams = [new SnapshotStream(), new SnapshotStream()];
      const decoders = [new SnapshotDecoder(), new SnapshotDecoder()];
      const seen = new Map<number, PlayerSnapshot>();
      let bytes = 0;
      for (let k = 0; k < 60; k++) {
        players = players.map((p) => {
          const q: PlayerSnapshot = { ...p, p: [p.p[0] + rand() * 0.37 - 0.15, p.p[1] + (rand() < 0.1 ? 0.5 : 0), p.p[2] + rand() * 0.2], yaw: Math.round(rand() * 6000) / 1000, vy: rand() < 0.2 ? rand() * 3 : 0 };
          if (rand() < 0.1) q.hp = Math.ceil(rand() * 100);
          if (rand() < 0.1) q.sn = 1;
          else if (rand() < 0.1) delete q.sn;
          if (rand() < 0.05) q.st = rand() < 0.5 ? 'engage' : 'cover';
          return q;
        });
        // Someone leaves now and then, and someone else takes the slot a few snapshots later.
        if (k % 10 === 3) players = players.filter((p) => p.s !== 5);
        if (k % 10 === 6) players = [...players, player(5, rand() * 400)];
        const b: SnapshotBody = { ...body(players, k * SNAPSHOT_INTERVAL_TICKS), score: [{ s: 0, k: Math.floor(k / 20), d: 0 }], ...(k % 7 < 3 ? { mt: [[1, 2, 3]] } : {}) };
        const texts = encodeSnapshots(b, [0, 1].map((slot) => ({ slot, ack: k, stream: streams[slot]! })));
        texts.forEach((text, viewer) => {
          bytes += text.length;
          const msg = decoders[viewer]!.snapshot(JSON.parse(text) as Extract<ServerMessage, { t: 'snapshot' }>);
          expect(msg.score).toEqual(b.score);
          expect(msg.mt).toEqual(b.mt);
          expect((msg as { same?: unknown }).same).toBeUndefined();
          for (const got of msg.players) {
            const want = players.find((p) => p.s === got.s)!;
            if (got.s === viewer) expect(got).toEqual(want);
            else {
              expect(Math.max(...got.p.map((x, i) => Math.abs(x - want.p[i]!)))).toBeLessThan(0.0051);
              expect({ ...got, p: 0, vy: 0 }).toEqual({ ...want, p: 0, vy: 0 });
              expect(Math.abs(got.vy - want.vy)).toBeLessThan(0.0051);
            }
            seen.set(got.s, got);
          }
          expect(msg.players.length + (msg.hold?.length ?? 0)).toBe(players.length);
        });
      }
      const full = encodeSnapshots(body(players, 0), [{ slot: 0, ack: 0 }])[0]!.length;
      // Changes only: well under half the size of full snapshots.
      expect(bytes / 120).toBeLessThan(full * 0.5);
    }
  });
});

describe('96 players', () => {
  it(`runs ${MAX_PLAYER_SLOTS} bots on Frost Basin within the tick budget (bench, generous threshold)`, () => {
    expect(MAX_PLAYER_SLOTS).toBe(96);
    const loaded = loadMap(readFileSync(fileURLToPath(new URL('../../../maps/frost_basin.json', import.meta.url)), 'utf8'));
    if (!loaded.ok) throw new Error('Frost Basin failed to load');
    const map = loaded.map;
    const match = new Match(map, { ...rulesForMode(map, 'core.tdm'), teamSizes: [48, 48], scoreLimit: 0, timeLimitSeconds: 0 }, 42);
    for (let i = 0; i < MAX_PLAYER_SLOTS; i++) expect(match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal)).not.toBeNull();
    const teams = new Map<string | null, number>();
    for (const c of match.combatants()) teams.set(c.faction, (teams.get(c.faction) ?? 0) + 1);
    expect([...teams.values()]).toEqual([48, 48]);
    const ticks = 60 * 15;
    let total = 0;
    let max = 0;
    for (let i = 0; i < ticks; i++) {
      const t0 = performance.now();
      match.step();
      const ms = performance.now() - t0;
      total += ms;
      max = Math.max(max, ms);
    }
    const avg = total / ticks;
    console.log(`96 bots on Frost Basin: avg tick ${avg.toFixed(2)} ms, max ${max.toFixed(1)} ms (target avg < 8 ms; pnpm bench 96 60 maps/frost_basin.json --mode=core.tdm)`);
    // Generous: shared CI runners are slow and noisy. The real budget is 16.7 ms a tick.
    expect(avg).toBeLessThan(30);
    for (const c of match.combatants()) expect(c.move.pos.y).toBeGreaterThan(match.killY);
    match.destroy();
  }, 180_000);

  // A browser host's friends at 48 v 48: what one friend is sent a second (characters before compression,
  // which is also what host and friend spend compressing and parsing), and the host's time writing them.
  it('a hosted 48 v 48 snapshot stream stays within its byte and time budget per friend (clumped Frost Basin)', () => {
    const loaded = loadMap(readFileSync(fileURLToPath(new URL('../../../maps/frost_basin.json', import.meta.url)), 'utf8'));
    if (!loaded.ok) throw new Error('Frost Basin failed to load');
    const map = loaded.map;
    const match = new Match(map, { ...rulesForMode(map, 'core.tdm'), teamSizes: [48, 48], scoreLimit: 0, timeLimitSeconds: 0 }, 42);
    for (let i = 0; i < MAX_PLAYER_SLOTS; i++) match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, BOT_DIFFICULTIES.normal);
    const friends = 10;
    for (let s = 0; s < friends; s++) match.watchers.add(s);
    run(match, 120);
    const area = clumpArea(match, 20);
    clumpInto(match, area, undefined, 7);
    const streams = Array.from({ length: friends }, () => new SnapshotStream());
    const decoder = new SnapshotDecoder();
    let chars = 0;
    let fullChars = 0;
    let ms = 0;
    let snaps = 0;
    let pending: GameEvent[] = [];
    const seconds = 4;
    for (let i = 0; i < seconds * 60; i++) {
      pending.push(...match.step());
      if (match.tick % SNAPSHOT_INTERVAL_TICKS) continue;
      const b = match.snapshot(pending);
      pending = [];
      const t0 = performance.now();
      const texts = encodeSnapshots(b, streams.map((stream, s) => ({ slot: s, ack: 0, me: match.privateState(s), stream })));
      ms += performance.now() - t0;
      snaps++;
      chars += texts[1]!.length;
      fullChars += encodeSnapshots(b, [{ slot: 1, ack: 0, me: match.privateState(1) }])[0]!.length;
      const msg = decoder.snapshot(JSON.parse(texts[1]!));
      expect(msg.players.length + (msg.hold?.length ?? 0)).toBe(MAX_PLAYER_SLOTS);
    }
    const perSecond = chars / seconds / 1024;
    console.log(`hosted 48 v 48, clumped Frost Basin: ${perSecond.toFixed(0)} KB/s a friend before compression (full snapshots: ${(fullChars / seconds / 1024).toFixed(0)} KB/s); writing ${friends} friends' copies ${(ms / snaps).toFixed(2)} ms a snapshot`);
    // Measured ~120 KB/s (full snapshots ~450); generous for noisy runners.
    expect(perSecond).toBeLessThan(220);
    expect(ms / snaps).toBeLessThan(15);
    match.destroy();
  }, 180_000);
});
