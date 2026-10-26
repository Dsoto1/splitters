import { z } from 'zod';

/**
 * Scenario logic (MAPMAKER_SCENARIO "LOGIC"): data-only WHEN -> IF -> DO rules
 * over the map's entities, variables, timers and objectives. There is no
 * creator code; the runtime interprets these records (sim/scenario.ts).
 *
 * Events, conditions and actions use one flat shape each ({type, target,
 * value, ...}) so the editor can build every form from the catalogs below.
 * Which fields matter for which type is described by the catalogs and checked
 * by the validator.
 */

const LogicId = z.string().regex(/^[A-Za-z0-9_-]{4,64}$/, 'IDs must be 4-64 chars of [A-Za-z0-9_-]');

/** What a `target` field refers to. */
export type TargetKind = 'door' | 'button' | 'destructible' | 'zone' | 'trap' | 'pickup' | 'encounter' | 'toggleable' | 'light' | 'block' | 'mover' | 'variable' | 'timer' | 'objective';

export const EVENT_TYPES = [
  'match_start',
  'button_pressed',
  'zone_enter',
  'zone_exit',
  'door_opened',
  'door_closed',
  'destroyed',
  'trap_fired',
  'pickup_taken',
  'player_killed',
  'timer_done',
  'objective_completed',
  'variable_changed',
  'encounter_cleared',
  'npc_killed',
  'mover_arrived',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_INFO: Record<EventType, { label: string; target: TargetKind | null }> = {
  match_start: { label: 'Match starts', target: null },
  button_pressed: { label: 'Button pressed', target: 'button' },
  zone_enter: { label: 'Players enter zone', target: 'zone' },
  zone_exit: { label: 'Player leaves zone', target: 'zone' },
  door_opened: { label: 'Door opened', target: 'door' },
  door_closed: { label: 'Door closed', target: 'door' },
  destroyed: { label: 'Object destroyed', target: 'destructible' },
  trap_fired: { label: 'Trap fires', target: 'trap' },
  pickup_taken: { label: 'Pickup taken', target: 'pickup' },
  player_killed: { label: 'A player dies', target: null },
  timer_done: { label: 'Timer runs out', target: 'timer' },
  objective_completed: { label: 'Objective completed', target: 'objective' },
  variable_changed: { label: 'Variable changes', target: 'variable' },
  encounter_cleared: { label: 'Encounter cleared', target: 'encounter' },
  npc_killed: { label: 'An NPC dies', target: 'encounter' },
  mover_arrived: { label: 'Mover arrives at a point', target: 'mover' },
};

export const COMPARE_OPS = ['==', '!=', '<', '<=', '>', '>='] as const;
export type CompareOp = (typeof COMPARE_OPS)[number];

export const CONDITION_TYPES = ['variable', 'objective', 'door', 'zone_count', 'enabled', 'encounter_alive', 'light', 'block', 'mover_at'] as const;
export type ConditionType = (typeof CONDITION_TYPES)[number];

/** `states`: allowed values of the condition's `state` field; `compare`: uses op + value. */
export const CONDITION_INFO: Record<ConditionType, { label: string; target: TargetKind; compare?: boolean; states?: readonly string[] }> = {
  variable: { label: 'Variable', target: 'variable', compare: true },
  objective: { label: 'Objective is', target: 'objective', states: ['inactive', 'active', 'complete', 'failed'] },
  door: { label: 'Door is', target: 'door', states: ['open', 'closed', 'locked', 'unlocked'] },
  zone_count: { label: 'Players in zone', target: 'zone', compare: true },
  enabled: { label: 'Is enabled', target: 'toggleable', states: ['enabled', 'disabled'] },
  encounter_alive: { label: 'NPCs alive in', target: 'encounter', compare: true },
  light: { label: 'Light is', target: 'light', states: ['on', 'off'] },
  block: { label: 'Block is', target: 'block', states: ['present', 'gone'] },
  /** Point number (1 = the first) the mover is parked at; 0 while it travels. */
  mover_at: { label: 'Mover parked at point', target: 'mover', compare: true },
};

export const ACTION_TYPES = [
  'door_open',
  'door_close',
  'door_toggle',
  'door_lock',
  'door_unlock',
  'enable',
  'disable',
  'trap_fire',
  'destroy',
  'set_var',
  'add_var',
  'objective',
  'timer_start',
  'timer_stop',
  'message',
  'sound',
  'wait',
  'end_round',
  'encounter_start',
  'encounter_stop',
  'encounter_order',
  'next_map',
  'light_on',
  'light_off',
  'light_toggle',
  'light_color',
  'light_flash',
  'light_blink',
  'block_drop',
  'block_restore',
  'mover_go',
  'mover_to',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const SOUND_CUES = ['alarm', 'chime', 'buzzer', 'boom'] as const;
export const OBJECTIVE_STATES = ['inactive', 'active', 'complete', 'failed'] as const;
export type ObjectiveState = (typeof OBJECTIVE_STATES)[number];

/**
 * Which fields each action uses. `value` is a number (seconds, amount),
 * `text` free text, `states` the allowed `state` values.
 */
export const ACTION_INFO: Record<ActionType, { label: string; target: TargetKind | null; value?: string; text?: boolean; states?: readonly string[] }> = {
  door_open: { label: 'Open door', target: 'door' },
  door_close: { label: 'Close door', target: 'door' },
  door_toggle: { label: 'Toggle door', target: 'door' },
  door_lock: { label: 'Lock door', target: 'door' },
  door_unlock: { label: 'Unlock door', target: 'door' },
  enable: { label: 'Enable', target: 'toggleable' },
  disable: { label: 'Disable', target: 'toggleable' },
  trap_fire: { label: 'Fire trap', target: 'trap' },
  destroy: { label: 'Destroy object', target: 'destructible' },
  set_var: { label: 'Set variable', target: 'variable', value: 'to' },
  add_var: { label: 'Add to variable', target: 'variable', value: 'amount' },
  objective: { label: 'Set objective', target: 'objective', states: OBJECTIVE_STATES },
  timer_start: { label: 'Start timer', target: 'timer' },
  timer_stop: { label: 'Stop timer', target: 'timer' },
  message: { label: 'Show message', target: null, value: 'seconds', text: true },
  sound: { label: 'Play sound', target: null, states: SOUND_CUES },
  wait: { label: 'Wait', target: null, value: 'seconds' },
  end_round: { label: 'End the round', target: null, states: ['instigator wins', 'nobody wins', 'players win', 'players lose'] },
  encounter_start: { label: 'Start encounter', target: 'encounter' },
  encounter_stop: { label: 'Stop reinforcements', target: 'encounter' },
  encounter_order: { label: 'Order squad to', target: 'encounter', states: ['hold', 'attack', 'defend', 'patrol', 'follow', 'roam'] },
  /** Wins the match and sends everyone on to another map of our suite (text: its ID, e.g. creature_lab). */
  next_map: { label: 'Next map (wins, then loads it)', target: null, text: true },
  light_on: { label: 'Light on', target: 'light' },
  light_off: { label: 'Light off', target: 'light' },
  light_toggle: { label: 'Toggle light', target: 'light' },
  /** text: the new colour (#rrggbb); empty puts back the light's own colour. */
  light_color: { label: 'Set light colour', target: 'light', text: true },
  /** A bright pulse for `value` seconds (a trap's tell, a muzzle flash), then back to how it was. */
  light_flash: { label: 'Flash light', target: 'light', value: 'seconds' },
  /** state on: blink `value` times a second (alarms); off: steady again. */
  light_blink: { label: 'Blink light', target: 'light', value: 'per second', states: ['on', 'off'] },
  /** A crumbling floor or trapdoor gives way now (a breakable block breaks; a solid one vanishes). */
  block_drop: { label: 'Drop / crumble block', target: 'block' },
  /** Puts a dropped, broken or hidden block back (if nobody is in the way). */
  block_restore: { label: 'Rebuild block', target: 'block' },
  /** Sends the mover on to its next point (trigger movers), or starts a parked one. */
  mover_go: { label: 'Send mover', target: 'mover' },
  /** value: point number (1 = the first). */
  mover_to: { label: 'Move mover to point', target: 'mover', value: 'point' },
};

export const LogicWhen = z.object({
  event: z.enum(EVENT_TYPES),
  target: LogicId.nullable().default(null),
});

export const LogicCondition = z.object({
  type: z.enum(CONDITION_TYPES),
  target: LogicId.nullable().default(null),
  op: z.enum(COMPARE_OPS).default('=='),
  value: z.number().finite().default(0),
  state: z.string().max(32).default(''),
});

export const LogicAction = z.object({
  type: z.enum(ACTION_TYPES),
  target: LogicId.nullable().default(null),
  value: z.number().finite().default(0),
  text: z.string().max(200).default(''),
  state: z.string().max(32).default(''),
});

export const LogicRule = z.object({
  id: LogicId,
  name: z.string().max(80).default(''),
  enabled: z.boolean().default(true),
  /** Fires at most once per round. */
  once: z.boolean().default(false),
  when: LogicWhen,
  if: z.array(LogicCondition).max(16).default([]),
  do: z.array(LogicAction).max(32).default([]),
});

export const LogicVariable = z.object({
  id: LogicId,
  name: z.string().min(1).max(40),
  initial: z.number().finite().default(0),
});

export const LogicTimer = z.object({
  id: LogicId,
  name: z.string().min(1).max(40),
  seconds: z.number().min(0.1).max(3600).default(10),
  loop: z.boolean().default(false),
  /** Shown on every player's HUD while running. */
  visible: z.boolean().default(true),
});

export const LogicObjective = z.object({
  id: LogicId,
  text: z.string().min(1).max(80),
  startActive: z.boolean().default(false),
  /** Entity the HUD points at while the objective is active. */
  marker: LogicId.nullable().default(null),
});

export const ScenarioLogic = z.object({
  variables: z.array(LogicVariable).max(64).default([]),
  timers: z.array(LogicTimer).max(32).default([]),
  objectives: z.array(LogicObjective).max(32).default([]),
  rules: z.array(LogicRule).max(256).default([]),
});

export type LogicWhen = z.infer<typeof LogicWhen>;
export type LogicCondition = z.infer<typeof LogicCondition>;
export type LogicAction = z.infer<typeof LogicAction>;
export type LogicRule = z.infer<typeof LogicRule>;
export type LogicVariable = z.infer<typeof LogicVariable>;
export type LogicTimer = z.infer<typeof LogicTimer>;
export type LogicObjective = z.infer<typeof LogicObjective>;
export type ScenarioLogic = z.infer<typeof ScenarioLogic>;

export const emptyLogic = (): ScenarioLogic => ({ variables: [], timers: [], objectives: [], rules: [] });

/**
 * Entity kinds that can be enabled/disabled by logic. Blocks: present or
 * gone (any behaviour); movers: running or parked (at their next point);
 * lights: on or off.
 */
export const TOGGLEABLE_KINDS = ['button', 'zone', 'trap', 'pickup', 'block', 'mover', 'light'] as const;

/** Whether an entity of `kind` can be the target of a logic field expecting `target`. Blocks count as destructibles (destroy / destroyed). */
/** Whether an entity of `kind` can be a rule's target of this kind (`breakable`: a prop that can be shot apart, which fires "destroyed" too). */
export function entityFitsTarget(kind: string, target: TargetKind, breakable = false): boolean {
  if (target === 'toggleable') return (TOGGLEABLE_KINDS as readonly string[]).includes(kind);
  if (target === 'destructible') return kind === 'destructible' || kind === 'block' || (kind === 'prop' && breakable);
  return kind === target;
}

/** Light, block and mover targets of a rule (they need to be logic-driven at runtime). */
export function logicTargets(logic: ScenarioLogic): Set<string> {
  const out = new Set<string>();
  for (const r of logic.rules) {
    for (const a of r.do) if (a.target) out.add(a.target);
    for (const c of r.if) if (c.target) out.add(c.target);
  }
  return out;
}
