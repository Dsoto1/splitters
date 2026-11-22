import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BUDGET_ROWS,
  CORE_PROPS,
  DRAW_ESTIMATE_BUDGET,
  MAP_BUDGETS,
  BudgetTracker,
  EditHistory,
  budgetCulprits,
  budgetLevel,
  breakablePropInBudget,
  countBudgets,
  isBreakableProp,
  loadMap,
  newMapDocument,
  newTerrain,
  resourceBudgetIssues,
  serializeMap,
  utf8Length,
  validateMap,
  isEnvModel,
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
    // The soft budgets the validator warns about, row by row (the coverage map has one of everything: more prop models than the budget).
    const codes = new Set(validateMap(doc).map((i) => i.code));
    const warns: Partial<Record<(typeof BUDGET_ROWS)[number]['id'], string>> = { props: 'budget.props', models: 'budget.prop_models', lights: 'budget.lights', env: 'budget.env', envColliding: 'budget.env_colliding', envCliffs: 'budget.env_cliffs', envVariants: 'budget.env_variants' };
    for (const r of BUDGET_ROWS) {
      const code = warns[r.id];
      if (code) expect(budgetLevel(c[r.id], r.max) === 'over', r.id).toBe(codes.has(code));
      else if (r.hard) expect(budgetLevel(c[r.id], r.max), r.id).not.toBe('over');
    }
    expect(budgetLevel(c.models, MAP_BUDGETS.propModels)).toBe('over');
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

  it('different prop models: 120 a map (80 before 2026-11-21); 120 pass, 121 warn, and the bar reads / 120', () => {
    expect(MAP_BUDGETS.propModels).toBe(120);
    const models = CORE_PROPS.filter((p) => !isEnvModel(p.id)).map((p) => p.id);
    expect(models.length).toBeGreaterThan(121);
    const withModels = (n: number): MapDocument => ({ ...newMapDocument('models'), entities: models.slice(0, n).map((model, i) => ({ id: `p${i}`, kind: 'prop', model, position: [i % 20, 0, Math.floor(i / 20)], yaw: 0, scale: 1, solid: false, tint: null }) as MapEntity) });
    const warned = (doc: MapDocument) => validateMap(doc).filter((i) => i.code === 'budget.prop_models');
    // The old budget and one past it, the new one, and one past that: a warning (never an error) only at 121.
    for (const n of [80, 81, 120]) expect(warned(withModels(n)), `${n} models`).toEqual([]);
    const over = warned(withModels(121));
    expect(over.map((i) => i.severity)).toEqual(['warning']);
    expect(over[0]!.message).toContain('121 different prop models (budget 120)');
    // MapMaker's Models row: its scale is the budget, amber from 96 (80 %), red past 120.
    const row = BUDGET_ROWS.find((r) => r.id === 'models')!;
    expect([row.max, row.hard]).toEqual([120, false]);
    expect(countBudgets(withModels(120)).models).toBe(120);
    expect([95, 96, 120, 121].map((n) => budgetLevel(n, row.max))).toEqual(['ok', 'near', 'near', 'over']);
    // The draw estimate kept its own scale (136): the 40 more models are not 40 free draws.
    expect(BUDGET_ROWS.find((r) => r.id === 'draws')!.max).toBe(136);
    expect(DRAW_ESTIMATE_BUDGET).toBe(136);
    expect(countBudgets(withModels(120)).draws).toBe(120);
    expect(budgetLevel(countBudgets(withModels(120)).draws, DRAW_ESTIMATE_BUDGET)).toBe('near');
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

  it('breakable props count in the Destructibles row as the validator counts them, the map switch followed', () => {
    const r = loadMap(readFileSync(fileURLToPath(new URL('../../../maps/breakyard.json', import.meta.url)), 'utf8'), undefined, { forEditing: true });
    if (!r.ok) throw new Error('breakyard failed to load');
    const yard = r.map;
    expect(yard.metadata.destruction).toBe(true);
    const props = yard.entities.filter((e) => isBreakableProp(e, true));
    expect(props.length).toBeGreaterThan(30);
    const others = yard.entities.filter((e) => e.kind === 'destructible' || (e.kind === 'block' && (e.behaviour !== 'solid' || !!e.glass))).length;
    const { history, tracker, same } = tracked(yard);
    same('opened');
    expect(tracker.counts.destructibles).toBe(others + props.length);
    expect(new Set(budgetCulprits(yard, 'destructibles'))).toEqual(new Set([...props.map((e) => e.id), ...yard.entities.filter((e) => e.kind === 'destructible' || (e.kind === 'block' && (e.behaviour !== 'solid' || !!e.glass))).map((e) => e.id)]));
    // "Everything breaks" off: only the log given health still counts.
    history.execute('off', { kind: 'setMetadata', before: { destruction: true }, after: { destruction: false } });
    same('switch off');
    const logs = yard.entities.filter((e) => breakablePropInBudget(e, false));
    expect(logs.map((e) => e.kind === 'prop' && e.model)).toEqual(['env.deadwood.log']);
    expect(tracker.counts.destructibles).toBe(others + 1);
    history.undo();
    same('undo');
    expect(tracker.counts.destructibles).toBe(others + props.length);
    // Over the budget exactly when the validator says so.
    const crate = props.find((e) => e.kind === 'prop' && !isEnvModel(e.model))!;
    const many = Array.from({ length: 1030 }, (_, i) => ({ ...crate, id: `many_${i}` }) as MapEntity);
    history.execute('many', { kind: 'addEntities', entities: many });
    same('many');
    expect(budgetLevel(tracker.counts.destructibles, 1024)).toBe('over');
    expect(resourceBudgetIssues(history.doc).some((i) => i.code === 'budget.destructibles')).toBe(true);
  });
});
