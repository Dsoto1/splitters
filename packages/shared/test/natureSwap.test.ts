import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  NATURE_SWAP_TABLE,
  applyCommand,
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
const pack = JSON.parse(readFileSync(new URL('../../../content/props/quaternius-ultimate-nature.json', import.meta.url), 'utf8')) as { props: { id: string }[] };

describe('the nature swap (Quaternius nature and kit rocks to our species)', () => {
  it('matches every prop of the Quaternius nature pack to a species look that exists', () => {
    for (const p of pack.props) expect(NATURE_SWAP_TABLE[`prop.${p.id}`], p.id).toBeDefined();
    for (const [old, targets] of Object.entries(NATURE_SWAP_TABLE)) {
      expect(getProp(old), old).toBeDefined();
      for (const x of targets) {
        const s = getEnvSpecies(x.model);
        expect(s, `${old} → ${x.model}`).toBeDefined();
        expect(s!.variants.some((v) => v.name === x.look), `${x.model} look ${x.look}`).toBe(true);
      }
    }
  });

  it('keeps play: trees and rocks collide, bushes stay cover you hide in, about the old height', () => {
    for (const [old, targets] of Object.entries(NATURE_SWAP_TABLE)) {
      const def = getProp(old)!;
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
      entities: [prop('a', 'prop.nt_pine_tall', { scale: 2, name: 'Big pine' }), prop('b', 'prop.nt_bush_leafy', { solid: false }), prop('c', 'prop.crate_small'), prop('d', 'prop.nt_log_moss', { health: 300 }), prop('e', 'prop.nt_boulder_moss', { health: 50 }), prop('f', 'prop.mn_rock_spires')],
    };
    const r = natureSwapCommand(doc, 'listed');
    expect(r.command!.before.map((e) => e.id)).toEqual(['a', 'b', 'd', 'e']);
    const after = applyCommand(doc, r.command!);
    const a = after.entities[0] as PropEntity;
    expect(a).toMatchObject({ id: 'a', model: 'env.conifer.pine_tall', position: [1, 2, 3], yaw: 0.5, scale: 1.64, name: 'Big pine', tint: null });
    expect(a.variant).toBeUndefined();
    expect((after.entities[1] as PropEntity).solid).toBe(false);
    expect(after.entities[2]).toEqual(doc.entities[2]);
    // A log keeps its own health (logs may break); a rock drops one it could not use.
    expect((after.entities[3] as PropEntity).health).toBe(300);
    expect(envCanBreak((after.entities[3] as PropEntity).model)).toBe(true);
    expect((after.entities[4] as PropEntity).health).toBeUndefined();
    expect((after.entities[4] as PropEntity).variant).toBe(1); // the shard's lichen look
    // The spires (a formation, built by hand as cliffs) stay and are not counted as swapped.
    expect(after.entities[5]).toEqual(doc.entities[5]);
    expect(r.swapped).toEqual({ 'prop.nt_pine_tall': 1, 'prop.nt_bush_leafy': 1, 'prop.nt_log_moss': 1, 'prop.nt_boulder_moss': 1 });
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
    // Trees and shards are not rocks to re-look as sandstone.
    expect(withRockLook({ model: 'env.rock.boulder_shard', look: 'bare', k: 1 }, 'sandstone').model).toBe('env.rock.boulder_shard');
    const flat = { ...newMapDocument('Flat'), entities: [prop('r', 'prop.boulder_jagged')] };
    expect(natureSwapCommand(flat).rockLook).toBe('listed');
    expect(natureSwapCommand(flat, 'sandstone').command!.after[0]!).toMatchObject({ model: 'env.rock.sandstone' });
  });
});
