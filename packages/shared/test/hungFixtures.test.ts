import { describe, expect, it } from 'vitest';
import { HANG_REACH, buildMapGeometry, ceilingOver, fixtureGap, hungPropLift, newMapDocument, type MapDocument, type MapEntity } from '../src/index.ts';

/** A room's ceiling: one block slab whose underside is at `bottom`, turned a little like a hall stretched onto a real footprint. */
function underSlab(bottom: number, ...entities: MapEntity[]): MapDocument {
  const doc = newMapDocument('Hung');
  const slab: MapEntity = { id: 'slab', kind: 'block', position: [0, bottom, 0], size: [12, 0.3, 8], yaw: 0.02, material: 'core.pbr_floorboards', tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 } as MapEntity;
  return { ...doc, entities: [slab, ...entities] };
}

const light = (y: number, fixture: 'ceiling' | 'strip' | 'bulb' | 'chandelier' | 'wall' | 'candle', x = 0): MapEntity => ({ id: `light_${fixture}`, kind: 'light', position: [x, y, 1], yaw: 0, color: '#ffe9c4', intensity: 0.8, range: 11, fixture }) as MapEntity;
const chandelier = (y: number, scale = 1, x = 0): MapEntity => ({ id: 'prop_ch', kind: 'prop', model: 'prop.hm_chandelier', position: [x, y, -1], yaw: 0, scale, solid: false, tint: null }) as MapEntity;

describe('hung fixtures', () => {
  it('finds the underside of the ceiling over a point, within reach and not beside it', () => {
    const boxes = buildMapGeometry(underSlab(3.22));
    expect(ceilingOver(boxes, 0, 0, 2.7)).toBeCloseTo(3.22, 5);
    expect(ceilingOver(boxes, 0, 0, 3.22 - HANG_REACH - 0.1)).toBeNull();
    expect(ceilingOver(boxes, 7, 0, 2.7)).toBeNull();
    // Already above its underside (inside the slab or over it): nothing over it to hang from.
    expect(ceilingOver(boxes, 0, 0, 3.4)).toBeNull();
  });

  it("a ceiling panel placed under a ceiling is drawn against it; a bulb's cord and a chandelier's chain reach it", () => {
    // St. John's: every ceiling panel sat 0.55 m under its ceiling (a panel 6.5 cm thick floating half a metre down).
    const doc = underSlab(3.22, light(2.67, 'ceiling'), light(2.8, 'strip'), light(2.2, 'bulb'), light(2.9, 'chandelier'), light(2.67, 'wall'), light(2.67, 'candle'));
    const boxes = buildMapGeometry(doc);
    const gap = (fixture: string) => fixtureGap(boxes, doc.entities.find((e) => e.id === `light_${fixture}`) as Extract<MapEntity, { kind: 'light' }>);
    expect(gap('ceiling')).toBeCloseTo(3.22 - 2.67 - 0.065, 3);
    expect(gap('strip')).toBeCloseTo(3.22 - 2.8 - 0.035, 3);
    expect(gap('bulb')).toBeCloseTo(3.22 - 2.2 - 0.6, 3);
    expect(gap('chandelier')).toBeCloseTo(3.22 - 2.9, 3);
    // Wall lamps and standing candelabra don't hang.
    expect(gap('wall')).toBe(0);
    expect(gap('candle')).toBe(0);
  });

  it('leaves fixtures that already touch, that have nothing over them, or whose ceiling is out of reach', () => {
    const touching = underSlab(3.22, light(3.155, 'ceiling'));
    expect(fixtureGap(buildMapGeometry(touching), touching.entities[1] as Extract<MapEntity, { kind: 'light' }>)).toBe(0);
    const open = underSlab(3.22, light(2.67, 'ceiling', 9));
    expect(fixtureGap(buildMapGeometry(open), open.entities[1] as Extract<MapEntity, { kind: 'light' }>)).toBe(0);
    const high = underSlab(9, light(2.67, 'ceiling'));
    expect(fixtureGap(buildMapGeometry(high), high.entities[1] as Extract<MapEntity, { kind: 'light' }>)).toBe(0);
  });

  it('a chandelier prop is drawn with its top against the ceiling over it; other props stay put', () => {
    // St. John's chapel: chandeliers (1 m tall) at 7.15 under a roof slab at 9.15 hung a metre short of it.
    const doc = underSlab(9.15, chandelier(7.15), chandelier(7.15, 1, 9), { id: 'prop_desk', kind: 'prop', model: 'prop.desk', position: [0, 7.15, -1], yaw: 0, scale: 1, solid: false, tint: null } as MapEntity);
    const boxes = buildMapGeometry(doc);
    const lift = (id: string) => hungPropLift(boxes, doc.entities.find((e) => e.id === id) as Extract<MapEntity, { kind: 'prop' }>);
    expect(lift('prop_ch')).toBeCloseTo(1, 3);
    expect(hungPropLift(boxes, { ...(doc.entities[2] as Extract<MapEntity, { kind: 'prop' }>), id: 'prop_ch2' })).toBe(0);
    expect(lift('prop_desk')).toBe(0);
    // Scaled down, its top is lower, so it rises further.
    const small = underSlab(4.04, chandelier(2.5, 0.8));
    expect(hungPropLift(buildMapGeometry(small), small.entities[1] as Extract<MapEntity, { kind: 'prop' }>)).toBeCloseTo(4.04 - 2.5 - 0.8, 3);
  });
});
