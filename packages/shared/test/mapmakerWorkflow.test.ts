import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CARD_ASPECT,
  CARD_EYE_HEIGHT,
  CARD_FOV,
  DEFAULT_DEATHMATCH_RULES,
  EditHistory,
  MAP_FORMAT_VERSION,
  TICK_RATE,
  WORKFLOW_KEYS,
  applyCommand,
  blockBoxes,
  buildMapGeometry,
  cardCamera,
  cardFrameIn,
  cardTarget,
  cardViewFov,
  entityLevel,
  eyeLevel,
  initPhysics,
  loadMap,
  mapContentHash,
  migrateMapDocument,
  newMapDocument,
  newTerrain,
  placeTileCommand,
  planArea,
  planFileName,
  planFitAspect,
  planFrame,
  planMarkers,
  planMove,
  planPan,
  planScale,
  planTiles,
  planToScreen,
  planZoom,
  playFromHereSpot,
  propBoxes,
  screenToPlan,
  serializeMap,
  setCardCameraCommand,
  type Combatant,
  type MapDocument,
  type MapEntity,
  type WorldBox,
} from '../src/index.ts';
import { COUNTDOWN_SECONDS, Match, initNavigation } from '../src/match.ts';

/** The starter room, a room on Level 1 over the next cell east, a block standing in the open, on open ground. */
function scene(): { doc: MapDocument; boxes: WorldBox[] } {
  let doc: MapDocument = { ...newMapDocument('workflow'), terrain: { ...newTerrain(80, 2, [0, 0], 'grass'), baseY: -0.15 } };
  const up = placeTileCommand(doc, 'core.room', 1, 0, 1, 0);
  if ('error' in up) throw new Error(up.error);
  doc = applyCommand(doc, up.command);
  const block: MapEntity = { id: 'block1', kind: 'block', position: [20, 0, 20], size: [2, 3, 2], yaw: 0, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 } as MapEntity;
  doc = applyCommand(doc, { kind: 'addEntities', entities: [block] });
  const boxes = [...buildMapGeometry(doc), ...blockBoxes(doc), ...propBoxes(doc), ...propBoxes(doc, true)];
  return { doc, boxes };
}

describe('Play from here (MapMaker overhaul Phase 3 item 1)', () => {
  it('stands you on the floor or ground straight under the camera, facing where it looks', () => {
    const { doc, boxes } = scene();
    const inRoom = playFromHereSpot({ camera: { x: 0, y: 2.5, z: 0 }, yaw: 1, pitch: -0.3, boxes, ground: doc.terrain, bounds: null });
    expect(inRoom.ok).toBe(true);
    if (!inRoom.ok) return;
    expect(inRoom.position[1]).toBeCloseTo(0, 1);
    expect([inRoom.position[0], inRoom.position[2], inRoom.yaw, inRoom.pitch, inRoom.offset]).toEqual([0, 0, 1, -0.3, 0]);
    // High above the open ground: on the ground below; looking straight down is kept to the sim's limit.
    const open = playFromHereSpot({ camera: { x: -30, y: 40, z: -30 }, yaw: 0, pitch: -1.57, boxes, ground: doc.terrain, bounds: null });
    expect(open.ok && open.on).toBe('ground');
    expect(open.ok && open.pitch).toBeCloseTo(-1.4);
  });

  it("over a block's top it stands you on it; inside a solid, the nearest spot with room round it", () => {
    const { doc, boxes } = scene();
    const top = playFromHereSpot({ camera: { x: 20, y: 10, z: 20 }, yaw: 0, pitch: 0, boxes, ground: doc.terrain, bounds: null });
    expect(top.ok && top.on).toBe('top');
    expect(top.ok && top.position[1]).toBeCloseTo(3);
    // Eye level inside the block: no room straight under it, so the nearest open ground beside it.
    const beside = playFromHereSpot({ camera: { x: 20, y: 1.6, z: 20 }, yaw: 0, pitch: 0, boxes, ground: doc.terrain, bounds: null });
    expect(beside.ok).toBe(true);
    if (!beside.ok) return;
    expect(beside.on).toBe('ground');
    expect(beside.offset).toBeGreaterThan(1);
    expect(beside.offset).toBeLessThanOrEqual(4);
  });

  it('refuses with a reason: nothing below, outside the boundary', () => {
    const { boxes } = scene();
    // A sky map (no terrain), the camera off the side of the build.
    const none = playFromHereSpot({ camera: { x: 200, y: 10, z: 200 }, yaw: 0, pitch: 0, boxes, ground: null, bounds: null });
    expect(none).toEqual({ ok: false, reason: expect.stringMatching(/^Nothing to stand on under the camera/) });
    const out = playFromHereSpot({ camera: { x: 50, y: 10, z: 0 }, yaw: 0, pitch: 0, boxes, ground: null, bounds: { min: [-20, -20], max: [20, 20] } });
    expect(out).toEqual({ ok: false, reason: expect.stringMatching(/outside the playable boundary/) });
  });

  describe('in the match', () => {
    beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

    it('you start at the spot through the countdown; once play begins, lives start at the spawn points again', () => {
      const { doc } = scene();
      const played = loadMap(doc);
      if (!played.ok) throw new Error('map failed to load');
      const m = new Match(played.map, DEFAULT_DEATHMATCH_RULES, 1, { startGate: true });
      const me = m.addHuman('me')!;
      m.startHere(me, { pos: { x: -12, y: 0, z: -12 }, yaw: 2, pitch: -0.2 });
      expect([me.move.pos.x, me.move.pos.z, me.yaw, me.pitch]).toEqual([-12, -12, 2, -0.2]);
      m.ready(me.slot);
      for (let i = 0; i < (COUNTDOWN_SECONDS + 1) * TICK_RATE && m.phase !== 'playing'; i++) m.step();
      expect(m.phase).toBe('playing');
      expect(Math.hypot(me.move.pos.x + 12, me.move.pos.z + 12)).toBeLessThan(0.5);
      expect(me.startAt).toBeUndefined();
      (m as unknown as { damage(v: Combatant, n: number, a: Combatant | null, w: string): void }).damage(me, 10_000, null, 'core.fall');
      for (let i = 0; i < TICK_RATE * 10 && !me.alive; i++) m.step();
      expect(me.alive).toBe(true);
      // The map's spawn is in the starter room, not out on the ground at (-12, -12).
      expect(Math.hypot(me.move.pos.x + 12, me.move.pos.z + 12)).toBeGreaterThan(4);
    });
  });
});

describe('The plan view (MapMaker overhaul Phase 3 item 2)', () => {
  it('frames the area in any aspect, north up, and maps world and screen both ways', () => {
    const f = planFrame({ x0: -10, z0: -20, x1: 30, z1: 20 }, 2, 0);
    // 40 × 40 m in a 2:1 view: the height decides, the width is twice it.
    expect(f).toEqual({ cx: 10, cz: 0, halfW: 40, halfH: 20 });
    const w = 800;
    const h = 400;
    expect(planToScreen(f, w, h, 10, 0)).toEqual({ x: 400, y: 200 });
    // North (+Z) is up, east (+X) right.
    expect(planToScreen(f, w, h, 10, 20)).toEqual({ x: 400, y: 0 });
    expect(planToScreen(f, w, h, 50, -20)).toEqual({ x: 800, y: 400 });
    const back = screenToPlan(f, w, h, 123, 77);
    const again = planToScreen(f, w, h, back.x, back.z);
    expect(again.x).toBeCloseTo(123);
    expect(again.y).toBeCloseTo(77);
    expect(planScale(f, h)).toBe(10);
    // A tall view: the width decides.
    const tall = planFrame({ x0: 0, z0: 0, x1: 40, z1: 10 }, 0.5, 0);
    expect(tall.halfW).toBeCloseTo(20);
    expect(tall.halfH).toBeCloseTo(40);
    expect(planFitAspect(f, 1)).toEqual({ ...f, halfW: 20 });
  });

  it('zooms about the pointer (the point under it stays put) and pans with the drag', () => {
    const f = planFrame({ x0: -20, z0: -20, x1: 20, z1: 20 }, 1, 0);
    const at = screenToPlan(f, 400, 400, 300, 100);
    const z = planZoom(f, 0.5, at);
    expect(z.halfH).toBeCloseTo(10);
    const still = planToScreen(z, 400, 400, at.x, at.z);
    expect(still.x).toBeCloseTo(300);
    expect(still.y).toBeCloseTo(100);
    // Zoom is held within its limits.
    expect(planZoom(f, 1e-6).halfH).toBe(4);
    // Dragging right by a quarter of the view moves the ground right: the frame's centre goes west.
    const p = planPan(f, 400, 400, 100, 0);
    expect(p.cx).toBeCloseTo(-10);
    expect(planPan(f, 400, 400, 0, 100).cz).toBeCloseTo(10);
    expect(planMove(f, 3, -2)).toEqual({ ...f, cx: 3, cz: -2 });
  });

  it("opens on the boundary, else what's built and placed", () => {
    const { doc } = scene();
    const a = planArea(doc);
    expect(a.x0).toBeLessThan(0);
    expect(a.x1).toBeGreaterThan(20);
    expect(planArea({ ...doc, bounds: { min: [-5, -6], max: [7, 8], style: 'invisible', height: 8 } })).toEqual({ x0: -5, z0: -6, x1: 7, z1: 8 });
  });

  it("outlines the level's tiles (the level below faint) and lists its icons: spawns by team, objectives, flags, hills, pickups", () => {
    const { doc: base } = scene();
    const cell = base.classicStructure.cellSize;
    const ents: MapEntity[] = [
      { id: 'sp_red', kind: 'spawn', position: [1, 0, 1], yaw: 0, faction: 'embers' } as MapEntity,
      { id: 'flag_b', kind: 'flag', position: [3, 0, 1], yaw: 0, team: 'tide' } as MapEntity,
      { id: 'hill_1', kind: 'hill', position: [5, 0, 1], radius: 6 } as MapEntity,
      { id: 'site_a', kind: 'bombsite', position: [7, 0, 1], label: 'A', radius: 4 } as MapEntity,
      { id: 'pick_1', kind: 'pickup', position: [cell, 4, 0], item: 'core.health', respawnSeconds: null } as MapEntity,
      { id: 'prop_1', kind: 'prop', position: [0, 0, 3], model: 'prop.table', yaw: 0, scale: 1, solid: true, tint: null } as MapEntity,
    ];
    const doc = applyCommand(base, { kind: 'addEntities', entities: ents });
    const ground = planMarkers(doc, 0).map((m) => [m.id, m.kind, m.color, m.label]);
    expect(ground).toEqual(
      expect.arrayContaining([
        ['sp_red', 'spawn', '#e2703a', ''],
        ['flag_b', 'flag', '#3a8fe2', ''],
        ['hill_1', 'hill', '#ffd34d', ''],
        ['site_a', 'objective', '#ff8a3a', 'A'],
      ]),
    );
    // The pickup is on Level 1 (on the upper room's floor), props aren't icons.
    expect(ground.map((g) => g[0])).not.toContain('pick_1');
    expect(ground.map((g) => g[0])).not.toContain('prop_1');
    expect(planMarkers(doc, 1).map((m) => m.id)).toEqual(['pick_1']);
    // On a hill the ground is the ground plan, however high (groundAt).
    expect(planMarkers(doc, 1, (x) => (x === cell ? 4 : null)).map((m) => m.id)).toEqual([]);
    expect(entityLevel(3.9, 4)).toBe(1);
    expect(entityLevel(-0.4, 4)).toBe(0);
    // Tiles: Level 1's room is current on Level 1; the starter room shows faint below it.
    const l1 = planTiles(doc, 1);
    expect(l1.filter((t) => t.current)).toHaveLength(1);
    expect(l1.filter((t) => !t.current).length).toBeGreaterThanOrEqual(1);
    const room = l1.find((t) => t.current)!;
    expect([room.x0, room.x1]).toEqual([cell - cell / 2, cell + cell / 2]);
    expect(planTiles(doc, 0).every((t) => t.current)).toBe(true);
    expect(planFileName('Step Temple', 0)).toBe('step_temple-ground-plan.png');
    expect(planFileName('Ünïcode / ?', -1)).toBe('n_code-basement1-plan.png');
  });
});

describe('The card-shot camera (MapMaker overhaul Phase 3 item 8)', () => {
  it('eye level: 1.7 m over the floor, roof or ground under the camera', () => {
    const { doc, boxes } = scene();
    expect(CARD_EYE_HEIGHT).toBe(1.7);
    const room = eyeLevel({ x: 0, y: 3, z: 0 }, boxes, doc.terrain);
    expect(room?.y).toBeCloseTo(1.7, 1);
    const block = eyeLevel({ x: 20, y: 30, z: 20 }, boxes, doc.terrain);
    expect(block?.y).toBeCloseTo(4.7);
    expect(eyeLevel({ x: 500, y: 30, z: 500 }, boxes, null)).toBeNull();
    // Kept at eye level beside the 3 m block, then over it: it doesn't climb onto it (3 m is more than a jump);
    // straight over it from high up, it does.
    const ground = eyeLevel({ x: 17, y: 1.6, z: 20 }, boxes, doc.terrain, true)!;
    expect(ground.y).toBeCloseTo(1.55);
    expect(eyeLevel({ x: 20, y: ground.y, z: 20 }, boxes, doc.terrain, true)?.y).toBeCloseTo(1.55);
  });

  it("the card's frame and lens: 16:9, the capture's FOV over the frame's height", () => {
    expect(CARD_ASPECT).toBeCloseTo(16 / 9);
    expect(cardFrameIn(1600, 900)).toEqual({ x: 0, y: 0, w: 1600, h: 900 });
    const wide = cardFrameIn(2000, 900, 0);
    expect([wide.w, wide.h, wide.x]).toEqual([1600, 900, 200]);
    // A frame the full height of the view: the card's own FOV; half the height: wider, so the frame sees the same.
    expect(cardViewFov(900, 900)).toBeCloseTo(CARD_FOV);
    expect(Math.tan(cardViewFov(450, 900) / 2)).toBeCloseTo(Math.tan(CARD_FOV / 2) * 2);
  });

  it('stores a pose (rounded, pitch held to ±1.55), points the capture at its target, one undo step', () => {
    const pose = cardCamera({ x: 1.234, y: 1.7049, z: -3.3333 }, Math.PI * 2 + 0.5, -2);
    expect(pose).toEqual({ position: [1.23, 1.7, -3.33], yaw: 0.5, pitch: -1.55 });
    const flat = cardCamera({ x: 0, y: 2, z: 0 }, Math.PI / 2, 0);
    expect(cardTarget(flat)).toEqual([10, 2, 0]);
    const { doc } = scene();
    const h = new EditHistory(doc);
    const set = setCardCameraCommand(h.doc, pose)!;
    h.execute('Set card shot', set);
    expect(h.doc.metadata.cardCamera).toEqual(pose);
    expect(setCardCameraCommand(h.doc, pose)).toBeNull();
    h.undo();
    expect(h.doc.metadata.cardCamera).toBeUndefined();
    h.redo();
    h.execute('Clear card shot', setCardCameraCommand(h.doc, null)!);
    expect(h.doc.metadata.cardCamera).toBeUndefined();
    // It's presentation, like the picture's camera: not part of the content hash.
    expect(mapContentHash({ ...doc, metadata: { ...doc.metadata, cardCamera: pose } })).toBe(mapContentHash(doc));
  });

  it('format v30: a v29 map migrates unchanged; a map with a card camera saves and loads; a bad one is refused', () => {
    expect(MAP_FORMAT_VERSION).toBe(30);
    const v29 = { ...JSON.parse(readFileSync(new URL('./fixtures/iron_compound_v26.json', import.meta.url), 'utf8')), formatVersion: 29 };
    const { doc, fromVersion } = migrateMapDocument(structuredClone(v29));
    expect(fromVersion).toBe(29);
    expect(doc).toEqual({ ...v29, formatVersion: 30 });
    expect(loadMap(structuredClone(v29)).ok).toBe(true);
    const { doc: map } = scene();
    const pose = cardCamera({ x: 2, y: 1.7, z: 3 }, 1, -0.1);
    const back = loadMap(serializeMap({ ...map, metadata: { ...map.metadata, cardCamera: pose } }));
    expect(back.ok && back.map.metadata.cardCamera).toEqual(pose);
    const bad = loadMap(JSON.parse(serializeMap({ ...map, metadata: { ...map.metadata, cardCamera: { ...pose, pitch: 3 } } })));
    expect(bad.ok).toBe(false);
  });
});

describe("Phase 3 part A's keys", () => {
  it('Shift+F5 plays from here, K toggles the plan view, and neither clashes with the other', () => {
    expect(WORKFLOW_KEYS.map((k) => [k.action, k.keys])).toEqual([
      ['playFromHere', 'Shift+F5'],
      ['planView', 'K'],
    ]);
  });
});
