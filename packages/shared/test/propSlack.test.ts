// The slack pass in play (owner's bug, 2026-11-06, Capitol Mall: "These pillars are blocking my bullets."). The white
// Ionic column (prop.im_column_ionic) collided as one box as wide as its plinth and capital all the way up: rounds aimed
// just past its round shaft stopped in the air 0.2-0.3 m beside it (more at 45°). It collides as voxel boxes now
// (tools/content/voxel-collision.mjs; the slack audit in tools/content/prop-openings.mjs): here, in the real sim, at
// scale 1 and at Capitol Mall's 1.333, rounds beside the shaft fly past, rounds at it hit it, a player stands against
// it and doesn't pass through it, and cover behind it still holds.
import { beforeAll, describe, expect, it } from 'vitest';
import { getProp } from '../src/content/props.ts';
import { PhysicsWorld, buildMapGeometry, emptyInput, initPhysics, propBoxes, stepMovement, type MapDocument, type MapEntity, type MoveState, type Vec3 } from '../src/index.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { findCover } from '../src/bots/cover.ts';
import { propMaterial } from '../src/sim/gunplay.ts';
import { PLAYER } from '../src/sim/constants.ts';
import { makeMap } from './helpers.ts';

beforeAll(async () => {
  await Promise.all([initPhysics(), initNavigation()]);
});

const COLUMN = 'prop.im_column_ionic';
/** The model, measured (tools/content/prepare-ancient.mjs builds it): the round shaft's radius, and the old box's half-sizes. */
const SHAFT = 0.39;
const OLD = { x: 1.34 / 2, z: 1.2 / 2 };

/** An 8 m room (walls 3.5 m out) with the column in the middle, at `scale`, and whatever else. */
function room(scale: number, extra: MapEntity[] = []): MapDocument {
  const map = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[0, 0, -2.5]]);
  map.entities.push({ id: 'column', kind: 'prop', model: COLUMN, position: [0, 0, 0], yaw: 0, scale, solid: true, tint: null }, ...extra);
  return map;
}

const block = (id: string, min: Vec3, max: Vec3): MapEntity => ({ id, kind: 'block', position: [(min.x + max.x) / 2, min.y, (min.z + max.z) / 2], size: [max.x - min.x, max.y - min.y, max.z - min.z], yaw: 0, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 });

/** Walk along `yaw` for four seconds from `from`; the end, and the nearest the player's middle came to the column's axis. */
function walk(physics: PhysicsWorld, from: Vec3, yaw: number): { end: MoveState; nearest: number } {
  const collider = physics.createPlayerCollider();
  let s: MoveState = { pos: { ...from }, velY: 0, grounded: true };
  let nearest = Infinity;
  for (let i = 0; i < 240; i++) {
    s = stepMovement(physics, collider, s, { ...emptyInput(i), forward: 1, yaw });
    nearest = Math.min(nearest, Math.hypot(s.pos.x, s.pos.z));
  }
  physics.removeCollider(collider);
  return { end: s, nearest };
}

describe('the Ionic column (Capitol Mall) collides as its shaft', () => {
  it('is no longer one box as wide as its plinth and capital', () => {
    const def = getProp(COLUMN)!;
    expect(def.boxes!.length).toBeGreaterThan(3);
    // From 1 m to 5 m up, nothing reaches further out than the shaft (and the 0.1 m cubes round it).
    for (const b of def.boxes!) if (b[1] < 5 && b[4] > 1) expect(Math.max(-b[0], b[3], -b[2], b[5])).toBeLessThan(SHAFT + 0.06);
    // What a round hits is the column's stone, as before.
    expect(propMaterial(COLUMN)).toBe('concrete');
  });

  for (const scale of [1, 4 / 3]) {
    const tag = `at scale ${scale.toFixed(2)}`;
    const shaft = SHAFT * scale;

    it(`${tag}: rounds aimed beside the shaft, inside its old box, fly past; rounds at the shaft stop on it`, () => {
      const physics = new PhysicsWorld(buildMapGeometry(room(scale)));
      for (const y of [1.2, 2.2, 3.2]) {
        // Along z, past either side of the shaft: through where the old box stood, on to the far wall (3.5 m).
        for (const x of [-1, 1].map((side) => side * (shaft + (OLD.x * scale - shaft) * 0.6))) {
          expect(x * x).toBeLessThan((OLD.x * scale) ** 2);
          expect(physics.raycastHit({ x, y, z: -3 }, { x: 0, y: 0, z: 1 }, 10)?.dist ?? 99, `beside at x ${x.toFixed(2)}, y ${y}`).toBeGreaterThan(6);
        }
        // Along x, past either side.
        for (const z of [-1, 1].map((side) => side * (shaft + (OLD.z * scale - shaft) * 0.6))) expect(physics.raycastHit({ x: -3, y, z }, { x: 1, y: 0, z: 0 }, 10)?.dist ?? 99, `beside at z ${z.toFixed(2)}, y ${y}`).toBeGreaterThan(6);
        // At 45°, 0.2 m outside the shaft: the old box's corner stood 0.9 m (× scale) from the axis.
        const d = { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 };
        for (const side of [-1, 1]) {
          const off = side * (shaft + 0.2);
          const o = { x: -3 * d.x - off * Math.SQRT1_2, y, z: -3 * d.z + off * Math.SQRT1_2 };
          expect(off * off).toBeLessThan((OLD.x * scale) ** 2 + (OLD.z * scale) ** 2);
          expect(physics.raycastHit(o, d, 10)?.dist ?? 99, `diagonal ${side}, y ${y}`).toBeGreaterThan(5);
        }
        // At the shaft: it stops on the stone (the shaft's face, give or take the 0.1 m cubes), and it is the column.
        for (const x of [0, shaft * 0.6]) {
          const hit = physics.raycastHit({ x, y, z: -3 }, { x: 0, y: 0, z: 1 }, 10)!;
          const face = 3 - Math.sqrt(shaft * shaft - x * x);
          expect(hit.dist, `at x ${x.toFixed(2)}, y ${y}`).toBeGreaterThan(face - 0.15);
          expect(hit.dist).toBeLessThan(face + 0.05);
          expect(physics.boxAt(hit.handle)?.sourceId).toBe('column');
        }
      }
    });

    it(`${tag}: a player stands against the shaft, closer than the old box let them, and never inside it`, () => {
      // Walking at it from the south: up on the plinth's step (0.3 m × scale) where it's low enough, against the shaft.
      const physics = new PhysicsWorld(buildMapGeometry(room(scale)));
      const straight = walk(physics, { x: 0, y: 0, z: -2.5 }, 0);
      expect(straight.end.pos.z).toBeGreaterThan(-(OLD.z * scale + PLAYER.radius) + 0.1);
      expect(straight.end.pos.z).toBeLessThan(-(shaft + PLAYER.radius) + 0.05);
      // From a deck at chest height beside it (1.2 m up, its edge just clear of the plinth): right up to the shaft.
      const deck = new PhysicsWorld(buildMapGeometry(room(scale, [block('deck', { x: -1.5, y: 0, z: -3.4 }, { x: 1.5, y: 1.2, z: -0.6 * scale - 0.05 })])));
      const onDeck = walk(deck, { x: 0, y: 1.25, z: -2.5 }, 0).end;
      expect(onDeck.pos.y).toBeGreaterThan(1.1);
      expect(Math.abs(onDeck.pos.z) - PLAYER.radius - shaft).toBeLessThan(0.1);
      expect(onDeck.pos.z).toBeGreaterThan(-(OLD.z * scale + PLAYER.radius) + 0.15);
      // From eight sides, nobody gets inside the shaft.
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const { nearest } = walk(physics, { x: -2.5 * Math.sin(a), y: 0, z: -2.5 * Math.cos(a) }, a);
        expect(nearest, `from ${k * 45}°`).toBeGreaterThan(shaft + PLAYER.radius - 0.06);
      }
    });

    it(`${tag}: cover behind the shaft still holds`, () => {
      const map = room(scale);
      const physics = new PhysicsWorld(buildMapGeometry(map));
      const threat = { x: 0, y: 1.6, z: -3 };
      // Crouched or standing right behind the shaft: hidden.
      expect(physics.lineOfSight({ x: 0, y: 0.92, z: 1.5 }, threat)).toBe(false);
      expect(physics.lineOfSight({ x: 0, y: 1.6, z: 1.2 }, threat)).toBe(false);
      // Off to the side, where the line passes the shaft inside its old box: seen now (the old box hid them).
      const target = { x: (shaft + 0.15) * 1.5, y: 0.92, z: 1.5 };
      expect(target.x / 1.5).toBeLessThan(OLD.x * scale);
      expect(physics.lineOfSight(target, threat)).toBe(true);
      // A bot looking for cover from the threat finds a spot the column hides.
      const nav = NavWorld.build([...buildMapGeometry(map), ...propBoxes(map, true)]);
      let seed = 11;
      const spot = findCover({ physics, nav, from: { x: 1.5, y: 0, z: 2 }, threat, radius: 5, preferred: 4, rng: () => (seed = (seed * 16807) % 2147483647) / 2147483647 });
      expect(spot).not.toBeNull();
      expect(physics.lineOfSight({ x: spot!.pos.x, y: spot!.pos.y + 0.92, z: spot!.pos.z }, threat)).toBe(false);
      nav.destroy();
    });
  }
});
