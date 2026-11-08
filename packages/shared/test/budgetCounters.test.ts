import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BUDGET_ROWS,
  BudgetTracker,
  EditHistory,
  budgetCulprits,
  budgetLevel,
  countBudgets,
  loadMap,
  newMapDocument,
  newTerrain,
  resourceBudgetIssues,
  serializeMap,
  utf8Length,
  validateMap,
  type MapDocument,
  type MapEntity,
} from '../src/index.ts';

const coverage = (): MapDocument => {
  const r = loadMap(readFileSync(fileURLToPath(new URL('../../../maps/test_coverage.json', import.meta.url)), 'utf8'), undefined, { forEditing: true });
  if (!r.ok) throw new Error('coverage map failed to load');
  return r.map;
};

/** A tracker fed by a history, as MapMaker wires it. */
function tracked(doc: MapDocument) {
  const history = new EditHistory(doc);
  const tracker = new BudgetTracker(doc);
  history.onChange = (c) => (c.reset ? tracker.reset(c.reset) : tracker.apply(c.command, c.doc));
  const same = (what: string) => expect(tracker.counts, what).toEqual(countBudgets(history.doc));
  return { history, tracker, same };
}

const envProp = (id: string, model: string, x: number, variant?: number): MapEntity => ({ id, kind: 'prop', model, position: [x, 0, 40], yaw: 0, scale: 1, solid: true, tint: null, ...(variant === undefined ? {} : { variant }) }) as MapEntity;

describe('the live budget bar (MapMaker Phase 1, item 2)', () => {
  it('a full count matches the validator: the file size, and over a budget exactly when it warns', () => {
    const doc = coverage();
    expect(doc.setPieces?.length).toBeGreaterThan(0);
    const c = countBudgets(doc);
    expect(c.size).toBe(utf8Length(serializeMap(doc)));
    expect(c.entities).toBe(doc.entities.length);
    // Set pieces count as played: their parts' props too.
    expect(c.props).toBeGreaterThan(doc.entities.filter((e) => e.kind === 'prop').length);
    // The soft budgets the validator warns about, row by row (the coverage map has one of everything: 81 prop models).
    const codes = new Set(validateMap(doc).map((i) => i.code));
    const warns: Partial<Record<(typeof BUDGET_ROWS)[number]['id'], string>> = { props: 'budget.props', models: 'budget.prop_models', lights: 'budget.lights', env: 'budget.env', envColliding: 'budget.env_colliding', envCliffs: 'budget.env_cliffs', envVariants: 'budget.env_variants' };
    for (const r of BUDGET_ROWS) {
      const code = warns[r.id];
      if (code) expect(budgetLevel(c[r.id], r.max) === 'over', r.id).toBe(codes.has(code));
      else if (r.hard) expect(budgetLevel(c[r.id], r.max), r.id).not.toBe('over');
    }
    expect(budgetLevel(c.models, 80)).toBe('over');
    expect(resourceBudgetIssues(doc).filter((i) => i.code.startsWith('budget.'))).toEqual([]);
  });

  it('the counters match a full count after a series of commands, undo and redo', () => {
    const full = coverage();
    const start = newMapDocument('budget');
    const { history, tracker, same } = tracked(start);
    same('new map');
    // Entities in chunks, every kind of the coverage map; tiles; set pieces.
    const chunks = [full.entities.slice(0, 60), full.entities.slice(60, 140), full.entities.slice(140)];
    for (const [i, entities] of chunks.entries()) {
      history.execute(`add ${i}`, { kind: 'addEntities', entities });
      same(`added chunk ${i}`);
    }
    history.execute('tiles', { kind: 'addTiles', tiles: full.classicStructure.tiles });
    same('tiles');
    const unpieced = tracker.counts;
    history.execute('pieces', { kind: 'addSetPieces', setPieces: full.setPieces ?? [] });
    same('set pieces');
    expect(tracker.counts.props + tracker.counts.lights).toBeGreaterThan(unpieced.props + unpieced.lights);
    // Environment species: placements, colliding, cliffs, variants.
    history.execute('env', { kind: 'addEntities', entities: [envProp('e1', 'env.broadleaf.oak', 1), envProp('e2', 'env.broadleaf.oak', 2, 1), envProp('e3', 'env.cliff.face', 3), envProp('e4', 'env.shrub.broadleaf', 4)] });
    same('env');
    // Changes: tint a prop (its own draw), make a block breakable, move a light; one batch.
    const doc = history.doc;
    const prop = doc.entities.find((e) => e.kind === 'prop' && !e.tint)!;
    const block = doc.entities.find((e) => e.kind === 'block' && e.behaviour === 'solid' && !e.glass)!;
    const light = doc.entities.find((e) => e.kind === 'light')!;
    history.execute('change', {
      kind: 'batch',
      commands: [
        { kind: 'updateEntities', before: [prop], after: [{ ...prop, tint: '#ff0000' } as MapEntity] },
        { kind: 'updateEntities', before: [block], after: [{ ...block, behaviour: 'breakable' } as MapEntity] },
        { kind: 'updateEntities', before: [light], after: [{ ...light, position: [light.position[0] + 1, light.position[1], light.position[2]] }] },
      ],
    });
    same('batch of changes');
    // Remove some, change the theme (set pieces take its look), a terrain, a set piece moved.
    history.execute('remove', { kind: 'removeEntities', entities: history.doc.entities.filter((e) => e.kind === 'light' || e.kind === 'mount') });
    same('removed lights and vehicles');
    history.execute('theme', { kind: 'setTheme', before: history.doc.classicStructure.theme, after: 'core.industrial' });
    same('theme');
    history.execute('terrain', { kind: 'setTerrain', before: history.doc.terrain, after: newTerrain(120, 2) });
    same('terrain');
    const piece = history.doc.setPieces![0]!;
    history.execute('move piece', { kind: 'updateSetPieces', before: [piece], after: [{ ...piece, x: piece.x + 40 }] });
    same('set piece moved');
    // A stroke: each edit joins the step.
    history.beginStroke();
    for (const e of history.doc.entities.filter((x) => x.kind === 'spawn')) history.execute('erase', { kind: 'removeEntities', entities: [e] });
    history.endStroke();
    same('stroke');
    // Undo everything, step by step, then redo it all.
    while (history.canUndo) {
      history.undo();
      same(`undo to ${history.undoLabel ?? 'the start'}`);
    }
    expect(tracker.counts).toEqual(countBudgets(start));
    while (history.canRedo) {
      history.redo();
      same(`redo ${history.undoLabel}`);
    }
    // All set pieces removed (the key goes from the file), and a reset.
    history.execute('no pieces', { kind: 'removeSetPieces', setPieces: history.doc.setPieces ?? [] });
    same('set pieces removed');
    history.reset(full);
    same('reset');
  });

  it('levels go green, amber, red; the culprits are what the row counts', () => {
    expect(budgetLevel(10, 100)).toBe('ok');
    expect(budgetLevel(80, 100)).toBe('near');
    expect(budgetLevel(100, 100)).toBe('near');
    expect(budgetLevel(101, 100)).toBe('over');
    const doc = coverage();
    expect(budgetCulprits(doc, 'lights')).toEqual(doc.entities.filter((e) => e.kind === 'light').map((e) => e.id));
    expect(budgetCulprits(doc, 'vehicles').length).toBe(doc.entities.filter((e) => e.kind === 'mount' || e.kind === 'airplane').length);
    expect(budgetCulprits(doc, 'size')).toEqual([]);
  });
});
