import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  NATURE_SWAP_TABLE,
  applyCommand,
  isRetiredNatureProp,
  loadMap,
  serializeMap,
  envCanBreak,
  getEnvSpecies,
  getProp,
  invertCommand,
  natureSwapCommand,
  natureSwapEntity,
  newMapDocument,
  withRockLook,
  type MapDocument,
  type PropEntity,
} from '../src/index.ts';

const prop = (id: string, model: string, extra: Partial<PropEntity> = {}): PropEntity => ({ id, kind: 'prop', model, position: [1, 2, 3], yaw: 0.5, scale: 1, solid: true, tint: null, ...extra }) as PropEntity;
/** The Quaternius Ultimate Nature pack's 39 props (the pack left the build once no shipped map placed them). */
const QUATERNIUS = Object.keys(NATURE_SWAP_TABLE).filter((id) => id.startsWith('prop.nt_'));
const kenney = JSON.parse(readFileSync(new URL('../../../content/props/kenney-nature-kit.json', import.meta.url), 'utf8')) as { props: { id: string; category: string }[] };

describe('the nature swap (Quaternius nature and kit rocks to our species)', () => {
  it('matches every prop of the Quaternius nature pack to a species look that exists', () => {
    expect(QUATERNIUS.length).toBe(39);
    // The Kenney Nature Kit's trees, logs and stumps too (owner, 2026-11-19); its Log Stack (firewood) stays.
    for (const p of kenney.props) if (p.category === 'Trees' || /^(log_big|stump_)/.test(p.id)) expect(NATURE_SWAP_TABLE[`prop.${p.id}`], p.id).toBeDefined();
    expect(NATURE_SWAP_TABLE['prop.log_stack']).toBeUndefined();
    for (const [old, targets] of Object.entries(NATURE_SWAP_TABLE)) {
      expect(getProp(old) ?? isRetiredNatureProp(old), old).toBeTruthy();
      for (const x of targets) {
        const s = getEnvSpecies(x.model);
        expect(s, `${old} → ${x.model}`).toBeDefined();
        expect(s!.variants.some((v) => v.name === x.look), `${x.model} look ${x.look}`).toBe(true);
      }
    }
  });

  it('keeps play: trees and rocks collide, bushes stay cover you hide in, about the old height', () => {
    for (const [old, targets] of Object.entries(NATURE_SWAP_TABLE)) {
      // (Retired props were checked here while they were in the build.)
      const def = getProp(old);
      if (!def) continue;
      for (const x of targets) {
        const s = getEnvSpecies(x.model)!;
        const blocks = s.variants[0]!.shapes.some((sh) => sh.blocks === 'all');
        if (def.collision) expect(blocks, `${old} collided; ${x.model} must too`).toBe(true);
        if (def.conceals && def.size[1] >= 0.8 && !old.includes('wheat') && !old.includes('corn')) expect(s.conceals, `${old} hid you; ${x.model} must too`).not.toBeNull();
        // Height within 40 % of the old (logs and stumps lie down: their length counts instead).
        const h = s.variants[0]!.size[1] * x.k;
        if (s.category !== 'deadwood') expect(Math.abs(h - def.size[1]) / def.size[1], `${old} → ${x.model}: ${h.toFixed(2)} m for ${def.size[1]} m`).toBeLessThan(0.4);
      }
    }
  });

  it('keeps spot, turn, name and flags; scales by the factor; one undo step with the same ids', () => {
    const doc: MapDocument = {
      ...newMapDocument('Swap'),
      entities: [prop('a', 'prop.pine_tall', { scale: 2, name: 'Big pine' }), prop('b', 'prop.tree_round', { solid: false }), prop('c', 'prop.crate_small'), prop('d', 'prop.log_big', { health: 300 }), prop('e', 'prop.rock_spire_tall', { health: 50 }), prop('f', 'prop.mn_rock_spires'), prop('g', 'prop.log_stack')],
    };
    const r = natureSwapCommand(doc, 'listed');
    expect(r.command!.before.map((e) => e.id)).toEqual(['a', 'b', 'd', 'e', 'f']);
    const after = applyCommand(doc, r.command!);
    const a = after.entities[0] as PropEntity;
    expect(a).toMatchObject({ id: 'a', model: 'env.conifer.pine_tall', position: [1, 2, 3], yaw: 0.5, scale: 2, name: 'Big pine', tint: null });
    expect(a.variant).toBeUndefined();
    expect((after.entities[1] as PropEntity).solid).toBe(false);
    expect(after.entities[2]).toEqual(doc.entities[2]);
    // The Kenney Big Log lay along x, ours along z: it turns a quarter (0.5 → 2.071), within one round.
    expect((after.entities[3] as PropEntity).yaw).toBe(2.071);
    expect(natureSwapEntity(prop('l', 'prop.log_big', { yaw: 3 }))!.yaw).toBe(-1.712);
    expect(natureSwapEntity(prop('m', 'prop.nt_log_large', { yaw: 3 }))!.yaw).toBe(3);
    // A log keeps its own health (logs may break); a rock drops one it could not use.
    expect((after.entities[3] as PropEntity).health).toBe(300);
    expect(envCanBreak((after.entities[3] as PropEntity).model)).toBe(true);
    expect((after.entities[4] as PropEntity).health).toBeUndefined();
    expect((after.entities[4] as PropEntity).variant).toBeUndefined(); // the shard's bare look
    // The Red Rock Spires become the generated spire formation (red); the Log Stack (firewood) stays.
    expect(after.entities[5]).toMatchObject({ id: 'f', model: 'env.rock.sandstone_spires', scale: 1 });
    expect((after.entities[5] as PropEntity).variant).toBeUndefined();
    expect(after.entities[6]).toEqual(doc.entities[6]);
    expect(r.swapped).toEqual({ 'prop.pine_tall': 1, 'prop.tree_round': 1, 'prop.log_big': 1, 'prop.rock_spire_tall': 1, 'prop.mn_rock_spires': 1 });
    expect(applyCommand(after, invertCommand(r.command!)).entities).toEqual(doc.entities);
    // Nothing left to swap the second time.
    expect(natureSwapCommand(after).command).toBeNull();
  });

  it('mixes deterministically by id, and keeps sizes within MapMaker’s limits', () => {
    const many = Array.from({ length: 200 }, (_, i) => prop(`t${i}`, 'prop.nt_common_tree'));
    const models = many.map((e) => natureSwapEntity(e)!.model);
    expect(new Set(models)).toEqual(new Set(['env.broadleaf.oak', 'env.broadleaf.maple']));
    expect(models.filter((m) => m === 'env.broadleaf.oak').length).toBeGreaterThan(100);
    expect(many.map((e) => natureSwapEntity(e)!.model)).toEqual(models);
    expect(natureSwapEntity(prop('x', 'prop.rock_spire_tall', { scale: 3 }))!.scale).toBe(4);
  });

  it('rock looks: mossy, sandstone, and auto by the ground', () => {
    expect(withRockLook({ model: 'env.rock.boulder_round', look: 'bare', k: 1 }, 'moss').look).toBe('moss');
    expect(withRockLook({ model: 'env.rock.boulder_shard', look: 'bare', k: 1 }, 'moss').look).toBe('lichen');
    const sand = withRockLook({ model: 'env.rock.outcrop', look: 'bare', k: 1 }, 'sandstone');
    expect(sand.model).toBe('env.rock.sandstone');
    expect(sand.k).toBeGreaterThan(1.5);
    // Shards keep their shape on sandy ground and take the sandstone look (bare and lichen; snow stays snow).
    expect(withRockLook({ model: 'env.rock.boulder_shard', look: 'bare', k: 1.2 }, 'sandstone')).toEqual({ model: 'env.rock.boulder_shard', look: 'sandstone', k: 1.2 });
    expect(withRockLook({ model: 'env.rock.boulder_shard', look: 'lichen', k: 1 }, 'sandstone').look).toBe('sandstone');
    expect(withRockLook({ model: 'env.rock.boulder_shard', look: 'snow', k: 1 }, 'sandstone').look).toBe('snow');
    expect(natureSwapEntity(prop('t', 'prop.rock_spire_tall'), 'sandstone')).toMatchObject({ model: 'env.rock.boulder_shard', variant: 3 });
    // Trees are not rocks.
    expect(withRockLook({ model: 'env.broadleaf.oak', look: 'summer', k: 1 }, 'sandstone').model).toBe('env.broadleaf.oak');
    const flat = { ...newMapDocument('Flat'), entities: [prop('r', 'prop.boulder_jagged')] };
    expect(natureSwapCommand(flat).rockLook).toBe('listed');
    expect(natureSwapCommand(flat, 'sandstone').command!.after[0]!).toMatchObject({ model: 'env.rock.sandstone' });
  });

  it('the Quaternius nature pack left the build: older maps load its props as our species, in MapMaker too', () => {
    for (const id of QUATERNIUS) {
      expect(getProp(id), id).toBeUndefined();
      expect(isRetiredNatureProp(id), id).toBe(true);
    }
    expect(isRetiredNatureProp('prop.rock_mossy_spire')).toBe(true);
    expect(isRetiredNatureProp('prop.pine_tall')).toBe(false); // still in the build: MapMaker's button swaps it
    const base = newMapDocument('Old');
    const doc: MapDocument = {
      ...base,
      entities: [...base.entities, prop('old_qa', 'prop.nt_pine_tall', { scale: 2, name: 'Old pine' }), prop('old_qb', 'prop.nt_boulder_moss'), prop('old_qc', 'prop.log_stack')],
      setPieceDefs: [{ id: 'local.grove', displayName: 'Grove', family: 'grove', category: 'Nature', footprint: { cells: [[0, 0]], levels: [0, 0] }, parts: [{ kind: 'prop', model: 'prop.nt_birch', position: [0, 0, 0], yaw: 0, scale: 1, solid: true, tint: null }] }],
    } as unknown as MapDocument;
    for (const forEditing of [true, false]) {
      const r = loadMap(serializeMap(doc), undefined, { forEditing });
      expect(r.ok, JSON.stringify(r.issues.filter((i) => i.severity === 'error'))).toBe(true);
      if (!r.ok) continue;
      expect(r.map.entities.find((e) => e.id === 'old_qa')).toMatchObject({ model: 'env.conifer.pine_tall', scale: 1.64, name: 'Old pine' });
      expect(r.map.entities.find((e) => e.id === 'old_qb')).toMatchObject({ model: 'env.rock.boulder_shard', variant: 1 });
      expect(r.map.entities.find((e) => e.id === 'old_qc')).toMatchObject({ model: 'prop.log_stack' });
      if (forEditing) expect(r.map.setPieceDefs![0]!.parts[0]).toMatchObject({ kind: 'prop', model: 'env.broadleaf.birch', scale: 0.74 });
      expect(r.map.entities.some((e) => e.kind === 'prop' && isRetiredNatureProp(e.model))).toBe(false);
    }
  });
});
