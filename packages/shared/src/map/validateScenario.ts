import { ACTION_INFO, CONDITION_INFO, EVENT_INFO, TOGGLEABLE_KINDS, type TargetKind } from './logic.ts';
import type { MapDocument } from './schema.ts';
import type { ValidationIssue } from './validate.ts';

const KIND_LABEL: Record<TargetKind, string> = {
  door: 'door',
  button: 'button',
  destructible: 'destructible',
  zone: 'zone',
  trap: 'trap',
  pickup: 'pickup',
  toggleable: 'button, zone, trap or pickup',
  variable: 'variable',
  timer: 'timer',
  objective: 'objective',
};

/**
 * Creator-facing checks of the scenario: broken references, rules that can
 * never fire and objects that do nothing. Reference problems are warnings
 * rather than errors so deleting an object never blocks TEST; the runtime
 * simply skips missing targets.
 */
export function validateScenario(map: MapDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { logic } = map;
  const entities = new Map(map.entities.map((e) => [e.id, e]));

  const ids = new Set(map.entities.map((e) => e.id));
  for (const item of [...logic.variables, ...logic.timers, ...logic.objectives, ...logic.rules]) {
    if (ids.has(item.id)) issues.push({ severity: 'error', code: 'id.duplicate', message: `duplicate ID "${item.id}" in logic`, targetId: item.id });
    ids.add(item.id);
  }

  const lists: Record<'variable' | 'timer' | 'objective', Set<string>> = {
    variable: new Set(logic.variables.map((v) => v.id)),
    timer: new Set(logic.timers.map((t) => t.id)),
    objective: new Set(logic.objectives.map((o) => o.id)),
  };
  const matches = (id: string, kind: TargetKind): boolean => {
    if (kind === 'variable' || kind === 'timer' || kind === 'objective') return lists[kind].has(id);
    const e = entities.get(id);
    if (!e) return false;
    return kind === 'toggleable' ? (TOGGLEABLE_KINDS as readonly string[]).includes(e.kind) : e.kind === kind;
  };
  const checkTarget = (ruleId: string, ruleName: string, where: string, target: string | null, kind: TargetKind | null): void => {
    if (!kind) return;
    if (target === null) {
      issues.push({ severity: 'warning', code: 'logic.target_missing', message: `rule "${ruleName}": ${where} needs a ${KIND_LABEL[kind]}`, targetId: ruleId });
    } else if (!matches(target, kind)) {
      issues.push({ severity: 'warning', code: 'logic.target_broken', message: `rule "${ruleName}": ${where} refers to a missing ${KIND_LABEL[kind]} (${target})`, targetId: ruleId });
    }
  };

  const used = { buttons: new Set<string>(), zones: new Set<string>(), unlocked: new Set<string>(), fired: new Set<string>(), completed: new Set<string>() };
  for (const rule of logic.rules) {
    const name = rule.name || rule.id;
    const when = EVENT_INFO[rule.when.event];
    checkTarget(rule.id, name, `WHEN "${when.label}"`, rule.when.target, when.target);
    if (rule.when.event === 'button_pressed' && rule.when.target) used.buttons.add(rule.when.target);
    if ((rule.when.event === 'zone_enter' || rule.when.event === 'zone_exit') && rule.when.target) used.zones.add(rule.when.target);

    for (const c of rule.if) {
      const info = CONDITION_INFO[c.type];
      checkTarget(rule.id, name, `IF "${info.label}"`, c.target, info.target);
      if (info.states && !info.states.includes(c.state)) {
        issues.push({ severity: 'warning', code: 'logic.state', message: `rule "${name}": IF "${info.label}" needs one of ${info.states.join(', ')}`, targetId: rule.id });
      }
      if (c.type === 'zone_count' && c.target) used.zones.add(c.target);
    }

    if (rule.do.length === 0) issues.push({ severity: 'warning', code: 'logic.no_actions', message: `rule "${name}" does nothing yet (add a DO action)`, targetId: rule.id });
    for (const a of rule.do) {
      const info = ACTION_INFO[a.type];
      checkTarget(rule.id, name, `DO "${info.label}"`, a.target, info.target);
      if (info.states && a.state && !info.states.includes(a.state)) {
        issues.push({ severity: 'warning', code: 'logic.state', message: `rule "${name}": DO "${info.label}" needs one of ${info.states.join(', ')}`, targetId: rule.id });
      }
      if (a.type === 'message' && !a.text.trim()) issues.push({ severity: 'warning', code: 'logic.empty_message', message: `rule "${name}": message is empty`, targetId: rule.id });
      if ((a.type === 'door_unlock' || a.type === 'door_open' || a.type === 'door_toggle') && a.target) used.unlocked.add(a.target);
      if ((a.type === 'trap_fire' || a.type === 'enable') && a.target) used.fired.add(a.target);
      if (a.type === 'objective' && a.state === 'complete' && a.target) used.completed.add(a.target);
    }
  }

  for (const o of logic.objectives) {
    if (o.marker && !entities.has(o.marker)) issues.push({ severity: 'warning', code: 'logic.marker', message: `objective "${o.text}" points at a missing object`, targetId: o.id });
    if (!used.completed.has(o.id)) issues.push({ severity: 'suggestion', code: 'logic.objective_never_completes', message: `objective "${o.text}" is never completed by a rule`, targetId: o.id });
  }

  for (const e of map.entities) {
    if (e.kind === 'button' && !used.buttons.has(e.id)) {
      issues.push({ severity: 'warning', code: 'button.unused', message: `button ${e.id} does nothing (no rule uses it)`, targetId: e.id });
    } else if (e.kind === 'zone' && !used.zones.has(e.id)) {
      issues.push({ severity: 'suggestion', code: 'zone.unused', message: `zone ${e.id} isn't used by any rule`, targetId: e.id });
    } else if (e.kind === 'door' && e.locked && !e.startOpen && !used.unlocked.has(e.id)) {
      issues.push({ severity: 'warning', code: 'door.never_opens', message: `door ${e.id} is locked and no rule ever unlocks or opens it`, targetId: e.id });
    } else if (e.kind === 'trap' && e.trap !== 'mine' && e.activation === 'logic' && !used.fired.has(e.id)) {
      issues.push({ severity: 'warning', code: 'trap.never_fires', message: `trap ${e.id} only fires from logic, but no rule fires it`, targetId: e.id });
    }
  }
  return issues;
}
