import type { MapDocument, ObjectiveEntity, SectorEntity, SpawnEntity } from './schema.ts';
import type { ValidationIssue } from './validate.ts';

const SIDE_NAMES = { attack: "attackers'", defend: "defenders'" } as const;
const OBJECTIVE_NAMES = { zone: 'capture zone', target: 'target', final: 'final hold' } as const;

/**
 * Breakthrough's checks (MapMaker's issues list, validate-map): the sectors' order is complete (1, 2, 3… with no gap
 * or repeat), each sector has objectives and a spawn group for each side, every objective and spawn group names a
 * sector there is, a sector's "N of M" asks for no more targets than it has, and a final hold is in the last sector.
 * Errors when the map lists Breakthrough (it can't run right), warnings when it only has the pieces.
 */
export function breakthroughIssues(map: MapDocument): ValidationIssue[] {
  const sectors = map.entities.filter((e): e is SectorEntity => e.kind === 'sector');
  const objectives = map.entities.filter((e): e is ObjectiveEntity => e.kind === 'objective');
  const spawns = map.entities.filter((e): e is SpawnEntity => e.kind === 'spawn' && (e.sector !== undefined || e.side !== undefined));
  const listed = map.metadata.supportedModes.includes('core.breakthrough');
  if (!listed && !sectors.length && !objectives.length && !spawns.length) return [];
  const issues: ValidationIssue[] = [];
  const severity = listed ? 'error' : 'warning';
  if (!sectors.length) {
    issues.push({ severity, code: 'breakthrough.no_sectors', message: 'Breakthrough needs sectors: place a Sector (Game Modes & Objectives), then its objectives and spawn groups' });
    return issues;
  }
  // The order: 1..N, each once.
  const orders = new Map<number, SectorEntity[]>();
  for (const s of sectors) orders.set(s.order, [...(orders.get(s.order) ?? []), s]);
  const top = Math.max(...orders.keys());
  for (const [order, list] of orders) {
    if (list.length > 1) issues.push({ severity, code: 'breakthrough.sector_twice', message: `${list.length} sectors are number ${order}: give each its own place in the order`, targetId: list[1]!.id });
  }
  const gaps = Array.from({ length: top }, (_, i) => i + 1).filter((n) => !orders.has(n));
  if (gaps.length) issues.push({ severity, code: 'breakthrough.order_gap', message: `the sectors' order has a gap: there is no sector ${gaps.join(', ')} (sectors go 1, 2, 3… in the order they are taken)` });
  const last = top;
  for (const [order, list] of [...orders].sort((a, b) => a[0] - b[0])) {
    const s = list[0]!;
    const name = s.name ? `Sector ${order} (${s.name})` : `Sector ${order}`;
    const own = objectives.filter((o) => o.sector === order);
    if (!own.length) issues.push({ severity, code: 'breakthrough.no_objectives', message: `${name} has no objectives: place a Capture Zone, Destroy Target or Final Hold in it`, targetId: s.id });
    for (const side of ['attack', 'defend'] as const) {
      if (!spawns.some((p) => p.sector === order && p.side === side)) issues.push({ severity, code: 'breakthrough.no_spawns', message: `${name} has no ${SIDE_NAMES[side]} spawn group: place ${side === 'attack' ? "Attackers'" : "Defenders'"} Spawns for it`, targetId: s.id });
    }
    const targets = own.filter((o) => o.objective === 'target').length;
    if (s.need !== undefined && s.need > targets) issues.push({ severity: 'warning', code: 'breakthrough.need', message: `${name} needs ${s.need} of its targets destroyed but has ${targets}: it falls once all ${targets} are`, targetId: s.id });
    if (s.need !== undefined && !targets) issues.push({ severity: 'warning', code: 'breakthrough.need', message: `${name} counts targets to destroy but has none`, targetId: s.id });
  }
  for (const o of objectives) {
    const what = `${OBJECTIVE_NAMES[o.objective]} ${o.label}`;
    if (!orders.has(o.sector)) issues.push({ severity, code: 'breakthrough.objective_sector', message: `${what} is in sector ${o.sector}, and there is no sector ${o.sector}`, targetId: o.id });
    else if (o.objective === 'final' && o.sector !== last) issues.push({ severity: 'warning', code: 'breakthrough.final_early', message: `${what} ends the round but is in sector ${o.sector}, not the last (${last}): it plays as a capture zone there`, targetId: o.id });
  }
  for (const p of spawns) {
    if (p.sector === undefined || !p.side) issues.push({ severity: 'warning', code: 'breakthrough.spawn_half', message: `spawn ${p.id} has a ${p.sector === undefined ? 'side but no sector' : 'sector but no side'}: Breakthrough leaves it out of the spawn groups`, targetId: p.id });
    else if (!orders.has(p.sector)) issues.push({ severity: 'warning', code: 'breakthrough.spawn_sector', message: `spawn ${p.id} is in the ${SIDE_NAMES[p.side]} group of sector ${p.sector}, and there is no sector ${p.sector}`, targetId: p.id });
  }
  return issues;
}
