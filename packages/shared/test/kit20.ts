import { PhysicsWorld, Scenario, buildMapGeometry, loadMap, type GameEvent, type LogicRule, type MapDocument, type MapEntity, type PlayerInput, type ScenarioActor, type ValidationIssue } from '../src/index.ts';
import { Match, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

/** Shared fixtures for the map-kit v20 tests (lights, block logic, movers, team filters…). */

export const EAST = Math.PI / 2;

/** Two rooms side by side along +X with a doorway at x = 4. */
export function twoRooms(entities: MapEntity[], logic: Partial<MapDocument['logic']> = {}, spawn: [number, number, number] = [-2, 0, 0]): MapDocument {
  const map = makeMap(
    [
      { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
      { id: 'room_b', tile: 'core.room', x: 1, y: 0, z: 0, rotation: 0 },
    ],
    [spawn],
  );
  map.entities.push(...entities);
  map.logic = { variables: [], timers: [], objectives: [], rules: [], ...logic };
  return map;
}

let ruleN = 0;
export const rule = (r: Partial<LogicRule> & Pick<LogicRule, 'when' | 'do'>): LogicRule => ({ id: `rule_${++ruleN}_x`, name: '', enabled: true, once: false, if: [], ...r });
export const act = (type: LogicRule['do'][number]['type'], extra: Partial<LogicRule['do'][number]> = {}): LogicRule['do'][number] => ({ type, target: null, value: 0, text: '', state: '', ...extra });
export const cond = (type: LogicRule['if'][number]['type'], extra: Partial<LogicRule['if'][number]> = {}): LogicRule['if'][number] => ({ type, target: null, op: '==', value: 0, state: '', ...extra });

export const block = (id: string, position: [number, number, number], extra: Partial<Extract<MapEntity, { kind: 'block' }>> = {}): Extract<MapEntity, { kind: 'block' }> => ({
  id,
  kind: 'block',
  position,
  yaw: 0,
  size: [4, 0.5, 4],
  material: null,
  tint: null,
  behaviour: 'solid',
  trigger: 'step',
  delaySeconds: 0.8,
  respawnSeconds: 8,
  health: 120,
  ...extra,
});

export const button = (id: string, position: [number, number, number], extra: Partial<Extract<MapEntity, { kind: 'button' }>> = {}): MapEntity => ({ id, kind: 'button', position, yaw: 0, label: 'Press', once: false, cooldownSeconds: 0.5, startEnabled: true, ...extra });

export class Driver {
  seq = 0;
  readonly events: GameEvent[] = [];
  constructor(
    readonly match: Match,
    readonly me: Combatant,
  ) {}

  input(over: Partial<PlayerInput> = {}): void {
    this.match.queueInputs(this.me.slot, [{ seq: ++this.seq, forward: 0, right: 0, yaw: this.me.yaw, pitch: 0, buttons: 0, ...over }]);
    this.events.push(...this.match.step());
  }

  run(ticks: number, over: Partial<PlayerInput> = {}): void {
    for (let i = 0; i < ticks; i++) this.input(over);
  }

  place(x: number, y: number, z: number, yaw = 0): void {
    this.me.move = { pos: { x, y, z }, velY: 0, grounded: true };
    this.me.yaw = yaw;
  }

  of<K extends GameEvent['e']>(e: K): Extract<GameEvent, { e: K }>[] {
    return this.events.filter((x): x is Extract<GameEvent, { e: K }> => x.e === e);
  }
}

export function loaded(map: MapDocument): MapDocument {
  const r = loadMap(map);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.map;
}

export function start(map: MapDocument): Driver {
  const match = new Match(loaded(map), undefined, 3);
  const me = match.addHuman('me')!;
  const d = new Driver(match, me);
  d.run(2);
  return d;
}

/** Warning and error codes, less the small test maps' expected 'spawn.few'. */
export const codes = (issues: readonly ValidationIssue[]): string[] => issues.filter((i) => i.severity !== 'suggestion' && i.code !== 'spawn.few').map((i) => i.code);

/** A scenario on its own, with players of given teams standing where a test puts them. */
export function bareScenario(map: MapDocument, actors: ScenarioActor[]): { scenario: Scenario; events: GameEvent[]; tick: { n: number } } {
  const doc = loaded(map);
  const physics = new PhysicsWorld(buildMapGeometry(doc));
  const events: GameEvent[] = [];
  const tick = { n: 0 };
  const scenario = new Scenario(doc, physics, {
    get tick() {
      return tick.n;
    },
    players: () => actors,
    actors: () => actors,
    teamOf: (slot) => actors.find((a) => a.slot === slot)?.team ?? null,
    hurt: () => {},
    blast: () => {},
    endRound: () => {},
    encounter: () => {},
    encounterAlive: () => 0,
    setPickupEnabled: () => {},
    emit: (ev) => events.push(ev),
  });
  return { scenario, events, tick };
}
