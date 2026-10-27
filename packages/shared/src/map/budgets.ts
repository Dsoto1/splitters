import type { MapDocument } from './schema.ts';
import type { EventType, LogicAction, LogicRule } from './logic.ts';

/**
 * Resource budgets for maps (direction §8, MULTIPLAYER_REVIEW.md 5.3). A
 * community map is declarative data, but data can still ask for too much: so
 * the validator refuses maps over the "load" budgets (MapMaker shows why),
 * and the simulation enforces the "runtime" budgets every tick whatever the
 * map says (Match and Scenario; past them work is deferred or dropped and the
 * host logs one warning per kind).
 */
export const RESOURCE_BUDGETS = {
  // ---- checked before / while loading
  /** Raw map JSON, checked before parsing wherever a map arrives. */
  mapBytes: 2 * 1024 * 1024,
  /** Entities in the file (also the schema's cap). */
  entities: 4096,
  /** Vehicles, mounted guns and airplanes. */
  vehicles: 32,
  /** Destructibles plus blocks that break, crumble, drop or are glass. */
  destructibles: 1024,
  /** Scenario rules (also the schema's cap). */
  triggerRules: 256,
  // ---- enforced while the match runs
  /** NPCs alive at once, map-wide (each encounter also has its own activeCap ≤ 32). */
  activeNpcs: 64,
  /** NPCs spawned per second and per minute, map-wide (encounters and hordes). */
  npcSpawnsPerSecond: 32,
  npcSpawnsPerMinute: 256,
  /** Projectiles in flight (grenades, rockets, arrows…); past it the oldest bot/NPC projectile goes first. */
  activeProjectiles: 512,
  /** Scenario actions run per tick; the rest of a sequence resumes next tick. */
  triggerActionsPerTick: 2000,
  /** Rule firings per tick; later events wait for the next tick. */
  ruleFiringsPerTick: 256,
  /** How often one rule may fire a second; more are dropped. */
  ruleFiringsPerSecond: 30,
  /** Events waiting for the next tick; more are dropped. */
  deferredEvents: 1024,
} as const;

/** Thrown-away bytes before JSON.parse: the length of a string in UTF-8. */
export function utf8Length(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

/** A budget the map goes over, as a creator-facing message (code, message, severity). */
export interface BudgetIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  targetId?: string;
}

/** Load-time budget checks on a schema-valid map. */
export function resourceBudgetIssues(map: MapDocument): BudgetIssue[] {
  const out: BudgetIssue[] = [];
  const count = (pred: (e: MapDocument['entities'][number]) => boolean) => map.entities.filter(pred).length;
  const vehicles = count((e) => e.kind === 'mount' || e.kind === 'airplane');
  if (vehicles > RESOURCE_BUDGETS.vehicles) out.push({ severity: 'error', code: 'budget.vehicles', message: `${vehicles} vehicles and mounted guns: at most ${RESOURCE_BUDGETS.vehicles} per map` });
  const breakables = count((e) => e.kind === 'destructible' || (e.kind === 'block' && (e.behaviour !== 'solid' || !!e.glass)));
  if (breakables > RESOURCE_BUDGETS.destructibles) out.push({ severity: 'error', code: 'budget.destructibles', message: `${breakables} destructibles and breakable blocks: at most ${RESOURCE_BUDGETS.destructibles} per map` });
  const npcCap = map.entities.reduce((n, e) => n + (e.kind === 'encounter' ? e.activeCap : 0), 0);
  if (npcCap > RESOURCE_BUDGETS.activeNpcs) {
    out.push({ severity: 'warning', code: 'budget.npcs', message: `encounters allow ${npcCap} NPCs alive at once; matches keep it to ${RESOURCE_BUDGETS.activeNpcs} map-wide, so some squads will wait` });
  }
  for (const c of logicCycles(map.logic.rules)) {
    const names = c.map((r) => `"${r.name || r.id}"`);
    out.push({
      severity: 'warning',
      code: 'logic.cycle',
      message: `rules set each other off in a loop (${[...names, names[0]].join(' → ')}): it runs up to the per-tick limit every time; add a condition, a Wait or "once" to break it`,
      targetId: c[0]!.id,
    });
  }
  return out;
}

/** The events an action can fire straight away (in the same tick), with their target. */
function eventsOf(a: LogicAction): { event: EventType; target: string | null }[] {
  switch (a.type) {
    case 'set_var':
    case 'add_var':
      return [{ event: 'variable_changed', target: a.target }];
    case 'objective':
      return a.state === 'complete' ? [{ event: 'objective_completed', target: a.target }] : [];
    case 'destroy':
    case 'disable':
    case 'block_drop':
      return [{ event: 'destroyed', target: a.target }];
    case 'door_open':
      return [{ event: 'door_opened', target: a.target }];
    case 'door_close':
      return [{ event: 'door_closed', target: a.target }];
    case 'door_toggle':
      return [
        { event: 'door_opened', target: a.target },
        { event: 'door_closed', target: a.target },
      ];
    default:
      return [];
  }
}

/**
 * Loops in a map's rules: rule A's actions fire an event rule B listens for,
 * and so on back to A, all within one tick (actions after a Wait don't
 * count, nor do rules that fire only once). Conditions are ignored, so a
 * guarded loop is reported too: the creator decides. Each loop once.
 */
export function logicCycles(rules: readonly LogicRule[]): LogicRule[][] {
  const live = rules.filter((r) => r.enabled && !r.once);
  const next = new Map<string, LogicRule[]>();
  for (const a of live) {
    const fired: { event: EventType; target: string | null }[] = [];
    for (const act of a.do) {
      if (act.type === 'wait' && act.value > 0) break;
      fired.push(...eventsOf(act));
    }
    next.set(
      a.id,
      live.filter((b) => fired.some((f) => f.event === b.when.event && (b.when.target === null || b.when.target === f.target))),
    );
  }
  // Tarjan's strongly connected components: each component with a loop is one report.
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: LogicRule[] = [];
  const onStack = new Set<string>();
  const out: LogicRule[][] = [];
  let i = 0;
  const visit = (r: LogicRule) => {
    index.set(r.id, i);
    low.set(r.id, i++);
    stack.push(r);
    onStack.add(r.id);
    for (const n of next.get(r.id) ?? []) {
      if (!index.has(n.id)) {
        visit(n);
        low.set(r.id, Math.min(low.get(r.id)!, low.get(n.id)!));
      } else if (onStack.has(n.id)) low.set(r.id, Math.min(low.get(r.id)!, index.get(n.id)!));
    }
    if (low.get(r.id) !== index.get(r.id)) return;
    const comp: LogicRule[] = [];
    let x: LogicRule;
    do {
      x = stack.pop()!;
      onStack.delete(x.id);
      comp.push(x);
    } while (x.id !== r.id);
    if (comp.length > 1 || (next.get(r.id) ?? []).some((n) => n.id === r.id)) out.push(comp.reverse());
  };
  for (const r of live) if (!index.has(r.id)) visit(r);
  return out;
}
