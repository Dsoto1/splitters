import {
  ACTION_INFO,
  ACTION_TYPES,
  COMPARE_OPS,
  CONDITION_INFO,
  CONDITION_TYPES,
  EVENT_INFO,
  EVENT_TYPES,
  TOGGLEABLE_KINDS,
  PLAYERS_FACTION,
  RELATIONS,
  entityLabel,
  mapFactions,
  type Faction,
  newId,
  type ActionType,
  type ConditionType,
  type EventType,
  type LogicAction,
  type LogicCondition,
  type LogicRule,
  type MapDocument,
  type MapEntity,
  type ScenarioLogic,
  type TargetKind,
} from '@chronosplit/shared';

export interface LogicPanelHost {
  doc(): MapDocument;
  /** Record a logic change as one undo step. */
  commit(label: string, after: ScenarioLogic): void;
  /** Record a factions change as one undo step. */
  commitFactions(label: string, after: Faction[]): void;
  /** Select and frame an entity in the 3D view. */
  focusEntity(id: string): void;
  /** The panel opened or closed (the top bar's workspace tabs follow it). */
  openChanged?(open: boolean): void;
}

/** Event a new rule listens for when created from a selected entity. */
const EVENT_FOR_KIND: Partial<Record<MapEntity['kind'], EventType>> = {
  button: 'button_pressed',
  zone: 'zone_enter',
  destructible: 'destroyed',
  door: 'door_opened',
  trap: 'trap_fired',
  pickup: 'pickup_taken',
  encounter: 'encounter_cleared',
};

const action = (type: ActionType, extra: Partial<LogicAction> = {}): LogicAction => ({ type, target: null, value: 0, text: '', state: '', ...extra });
const newRule = (name: string, when: LogicRule['when'], actions: LogicAction[] = [], extra: Partial<LogicRule> = {}): LogicRule => ({ id: newId('rule'), name, enabled: true, once: false, when, if: [], do: actions, ...extra });

/**
 * MapMaker's LOGIC workspace: objectives, variables, timers and WHEN -> IF ->
 * DO rules, edited as forms built from the shared logic catalogs. Templates
 * add ready-made rule sets for common setups.
 */
export class LogicPanel {
  private readonly el: HTMLElement;
  private focusRule: string | null = null;
  isOpen = false;

  constructor(private readonly host: LogicPanelHost) {
    this.el = document.getElementById('ed-logic')!;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(focusRule?: string): void {
    this.isOpen = true;
    this.el.hidden = false;
    this.syncTabs();
    this.focusRule = focusRule ?? null;
    this.render();
    if (focusRule) this.el.querySelector(`[data-rule="${focusRule}"]`)?.scrollIntoView({ block: 'center' });
  }

  close(): void {
    this.isOpen = false;
    this.el.hidden = true;
    this.syncTabs();
  }

  /** The top bar's Build / Logic tabs follow the panel. */
  private syncTabs(): void {
    if (this.host.openChanged) return this.host.openChanged(this.isOpen);
    document.getElementById('ed-build-btn')?.classList.toggle('on', !this.isOpen);
    document.getElementById('ed-logic-btn')?.classList.toggle('on', this.isOpen);
  }

  /** New rule listening to `entity` (from the inspector's "Add rule" button). */
  addRuleFor(entity: MapEntity): void {
    const event = EVENT_FOR_KIND[entity.kind];
    if (!event) return;
    const doc = this.host.doc();
    const rule = newRule(`${EVENT_INFO[event].label}: ${entityLabel(doc, entity)}`, { event, target: entity.id });
    this.commit('Add rule', (l) => l.rules.push(rule));
    this.open(rule.id);
  }

  private get logic(): ScenarioLogic {
    return this.host.doc().logic;
  }

  private commit(label: string, mutate: (l: ScenarioLogic) => void): void {
    const next = structuredClone(this.logic);
    mutate(next);
    this.host.commit(label, next);
  }

  // ---------------------------------------------------------------- render

  render(): void {
    if (!this.isOpen) return;
    const scroll = this.el.scrollTop;
    this.el.replaceChildren();
    const doc = this.host.doc();
    const logic = doc.logic;

    const head = div('lg-head');
    const title = document.createElement('h2');
    title.innerHTML = 'Logic <small>WHEN → IF → DO</small>';
    const templates = select([['', 'Quick add…'], ...TEMPLATES.map((t, i): [string, string] => [String(i), t.label])], '', (v) => {
      if (v === '') return;
      const t = TEMPLATES[Number(v)]!;
      this.commit(`Add "${t.label}"`, (l) => t.apply(l, doc));
    });
    templates.title = 'Add a ready-made set of rules';
    head.append(title, templates, btn('×', () => this.close(), 'Close (L)'));
    this.el.append(head);

    // Factions
    this.el.append(section('Factions', 'Sides for NPC squads. Each faction is allied with itself; set how it treats the players and the other factions.'));
    const factions = mapFactions(doc);
    const editFactions = (label: string, f: (list: Faction[]) => void) => {
      const next = structuredClone([...factions]) as Faction[];
      f(next);
      this.host.commitFactions(label, next);
    };
    factions.forEach((fa, i) => {
      const r = div('lg-row');
      const color = document.createElement('input');
      color.type = 'color';
      color.value = fa.color;
      color.addEventListener('change', () => editFactions('Recolour faction', (l) => (l[i]!.color = color.value.toLowerCase())));
      r.append(color, input(fa.name, (v) => editFactions('Rename faction', (l) => (l[i]!.name = v.slice(0, 40) || fa.id)), 'Faction name'));
      const rel = (other: string, label: string) =>
        labeled(
          label,
          select(RELATIONS.map((x): [string, string] => [x, x]), fa.relations[other] ?? factions.find((o) => o.id === other)?.relations[fa.id] ?? 'enemy', (v) =>
            editFactions('Change relation', (l) => {
              l[i]!.relations[other] = v as Faction['relations'][string];
              const back = l.find((o) => o.id === other);
              if (back) back.relations[fa.id] = v as Faction['relations'][string];
            }),
          ),
        );
      r.append(rel(PLAYERS_FACTION, 'vs players'));
      for (const other of factions) if (other.id !== fa.id) r.append(rel(other.id, `vs ${other.name}`));
      r.append(btn('🗑', () => factions.length > 1 && editFactions('Delete faction', (l) => l.splice(i, 1)), factions.length > 1 ? 'Delete' : 'A map needs at least one faction'));
      this.el.append(r);
    });
    this.el.append(
      btn('+ Faction', () =>
        editFactions('Add faction', (l) => {
          let n = l.length + 1;
          while (l.some((f) => f.id === `faction${n}`)) n++;
          l.push({ id: `faction${n}`, name: `Faction ${n}`, color: '#4aa36b', relations: { [PLAYERS_FACTION]: 'ally' } });
        }),
      undefined, 'lg-add'),
    );

    // Objectives
    this.el.append(section('Objectives', 'Shown on every player\'s HUD while active. Rules start, complete or fail them.'));
    logic.objectives.forEach((o, i) => {
      const r = div('lg-row');
      r.dataset.rule = o.id;
      r.append(
        input(o.text, (v) => this.commit('Edit objective', (l) => (l.objectives[i]!.text = v.slice(0, 80) || 'Objective')), 'Objective text'),
        check('Active at start', o.startActive, (v) => this.commit('Edit objective', (l) => (l.objectives[i]!.startActive = v))),
        select([['', 'No marker'], ...doc.entities.filter((e) => e.kind !== 'spawn').map((e): [string, string] => [e.id, entityLabel(doc, e)])], o.marker ?? '', (v) => this.commit('Edit objective', (l) => (l.objectives[i]!.marker = v || null)), 'HUD marker points at'),
        btn('🗑', () => this.commit('Delete objective', (l) => l.objectives.splice(i, 1)), 'Delete'),
      );
      this.el.append(r);
    });
    this.el.append(btn('+ Objective', () => this.commit('Add objective', (l) => l.objectives.push({ id: newId('obj'), text: 'New objective', startActive: l.objectives.length === 0, marker: null })), undefined, 'lg-add'));

    // Variables
    this.el.append(section('Variables', 'Numbers your rules can set, add to and test (use 0/1 for on/off).'));
    logic.variables.forEach((v, i) => {
      const r = div('lg-row');
      r.append(
        input(v.name, (x) => this.commit('Rename variable', (l) => (l.variables[i]!.name = x.slice(0, 40) || 'var')), 'Name'),
        labeled('starts at', num(v.initial, (x) => this.commit('Edit variable', (l) => (l.variables[i]!.initial = x)))),
        btn('🗑', () => this.commit('Delete variable', (l) => l.variables.splice(i, 1)), 'Delete'),
      );
      this.el.append(r);
    });
    this.el.append(btn('+ Variable', () => this.commit('Add variable', (l) => l.variables.push({ id: newId('var'), name: `var${l.variables.length + 1}`, initial: 0 })), undefined, 'lg-add'));

    // Timers
    this.el.append(section('Timers', 'Start them from rules; "Timer runs out" fires when they finish.'));
    logic.timers.forEach((t, i) => {
      const r = div('lg-row');
      r.append(
        input(t.name, (x) => this.commit('Rename timer', (l) => (l.timers[i]!.name = x.slice(0, 40) || 'Timer')), 'Name'),
        labeled('seconds', num(t.seconds, (x) => this.commit('Edit timer', (l) => (l.timers[i]!.seconds = Math.max(0.1, Math.min(3600, x)))))),
        check('Repeat', t.loop, (x) => this.commit('Edit timer', (l) => (l.timers[i]!.loop = x))),
        check('On HUD', t.visible, (x) => this.commit('Edit timer', (l) => (l.timers[i]!.visible = x))),
        btn('🗑', () => this.commit('Delete timer', (l) => l.timers.splice(i, 1)), 'Delete'),
      );
      this.el.append(r);
    });
    this.el.append(btn('+ Timer', () => this.commit('Add timer', (l) => l.timers.push({ id: newId('timer'), name: `Timer ${l.timers.length + 1}`, seconds: 30, loop: false, visible: true })), undefined, 'lg-add'));

    // Rules
    this.el.append(section('Rules', 'WHEN something happens, IF every condition holds, DO the actions in order. "Wait" pauses the list.'));
    logic.rules.forEach((rule, i) => this.el.append(this.ruleCard(doc, rule, i)));
    this.el.append(btn('+ Rule', () => this.commit('Add rule', (l) => l.rules.push(newRule(`Rule ${l.rules.length + 1}`, { event: 'match_start', target: null }))), undefined, 'lg-add'));
    this.el.scrollTop = scroll;
  }

  private ruleCard(doc: MapDocument, rule: LogicRule, i: number): HTMLElement {
    const card = div('lg-rule');
    card.dataset.rule = rule.id;
    if (rule.id === this.focusRule) card.classList.add('focus');
    if (!rule.enabled) card.classList.add('off');
    const edit = (label: string, f: (r: LogicRule) => void) => this.commit(label, (l) => f(l.rules[i]!));

    const head = div('lg-rule-head');
    head.append(
      check('', rule.enabled, (v) => edit(v ? 'Enable rule' : 'Disable rule', (r) => (r.enabled = v)), 'Enabled'),
      input(rule.name, (v) => edit('Rename rule', (r) => (r.name = v.slice(0, 80))), 'Rule name'),
      check('Once', rule.once, (v) => edit('Edit rule', (r) => (r.once = v)), 'Only fires once per round'),
      btn('⧉', () => this.commit('Duplicate rule', (l) => l.rules.splice(i + 1, 0, { ...structuredClone(rule), id: newId('rule'), name: `${rule.name} copy` })), 'Duplicate'),
      btn('🗑', () => this.commit('Delete rule', (l) => l.rules.splice(i, 1)), 'Delete'),
    );
    card.append(head);

    // WHEN
    const when = div('lg-line');
    const info = EVENT_INFO[rule.when.event];
    when.append(
      tag('WHEN'),
      select(
        EVENT_TYPES.map((t): [string, string] => [t, EVENT_INFO[t].label]),
        rule.when.event,
        (v) => edit('Edit WHEN', (r) => (r.when = { event: v as EventType, target: EVENT_INFO[v as EventType].target === EVENT_INFO[r.when.event].target ? r.when.target : null })),
      ),
    );
    if (info.target) when.append(this.targetSelect(doc, info.target, rule.when.target, (v) => edit('Edit WHEN', (r) => (r.when.target = v)), info.target !== 'objective' && info.target !== 'variable' && info.target !== 'timer'));
    card.append(when);

    // IF
    rule.if.forEach((c, k) => {
      const line = div('lg-line');
      const ci = CONDITION_INFO[c.type];
      const set = (f: (c: LogicCondition) => void) => edit('Edit IF', (r) => f(r.if[k]!));
      line.append(
        tag(k === 0 ? 'IF' : 'AND'),
        select(CONDITION_TYPES.map((t): [string, string] => [t, CONDITION_INFO[t].label]), c.type, (v) => set((x) => Object.assign(x, { type: v as ConditionType, target: null, state: CONDITION_INFO[v as ConditionType].states?.[0] ?? '' }))),
        this.targetSelect(doc, ci.target, c.target, (v) => set((x) => (x.target = v)), false),
      );
      if (ci.compare) line.append(select(COMPARE_OPS.map((o): [string, string] => [o, o]), c.op, (v) => set((x) => (x.op = v as LogicCondition['op']))), num(c.value, (v) => set((x) => (x.value = v))));
      if (ci.states) line.append(select(ci.states.map((s): [string, string] => [s, s]), c.state, (v) => set((x) => (x.state = v))));
      line.append(btn('×', () => edit('Remove condition', (r) => r.if.splice(k, 1)), 'Remove'));
      card.append(line);
    });

    // DO
    rule.do.forEach((a, k) => {
      const line = div('lg-line');
      const ai = ACTION_INFO[a.type];
      const set = (f: (a: LogicAction) => void) => edit('Edit DO', (r) => f(r.do[k]!));
      line.append(
        tag(k === 0 ? 'DO' : 'THEN'),
        select(ACTION_TYPES.map((t): [string, string] => [t, ACTION_INFO[t].label]), a.type, (v) => {
          const next = ACTION_INFO[v as ActionType];
          set((x) => Object.assign(x, { type: v as ActionType, target: next.target === ai.target ? x.target : null, state: next.states?.[0] ?? '', value: v === 'message' ? 4 : v === 'wait' ? 1 : x.value }));
        }),
      );
      if (ai.target) line.append(this.targetSelect(doc, ai.target, a.target, (v) => set((x) => (x.target = v)), false));
      if (ai.states) line.append(select(ai.states.map((s): [string, string] => [s, s]), a.state || ai.states[0]!, (v) => set((x) => (x.state = v))));
      if (ai.text) line.append(input(a.text, (v) => set((x) => (x.text = v.slice(0, 200))), 'Message text'));
      if (ai.value) line.append(labeled(ai.value, num(a.value, (v) => set((x) => (x.value = v)))));
      line.append(
        btn('↑', () => k > 0 && edit('Reorder actions', (r) => r.do.splice(k - 1, 0, ...r.do.splice(k, 1))), 'Move up'),
        btn('↓', () => k < rule.do.length - 1 && edit('Reorder actions', (r) => r.do.splice(k + 1, 0, ...r.do.splice(k, 1))), 'Move down'),
        btn('×', () => edit('Remove action', (r) => r.do.splice(k, 1)), 'Remove'),
      );
      card.append(line);
    });

    const adders = div('lg-line');
    adders.append(
      btn('+ IF', () => edit('Add condition', (r) => r.if.push({ type: 'variable', target: null, op: '==', value: 0, state: '' }))),
      btn('+ DO', () => edit('Add action', (r) => r.do.push(action('message', { text: 'Something happened!', value: 4 })))),
    );
    card.append(adders);
    return card;
  }

  /** Dropdown of everything a field of this kind can point at; a "◎" button frames entities in the view. */
  private targetSelect(doc: MapDocument, kind: TargetKind, value: string | null, onChange: (v: string | null) => void, allowAny: boolean): HTMLElement {
    const options: [string, string][] = [['', allowAny ? 'any' : '— choose —']];
    const logic = doc.logic;
    if (kind === 'variable') for (const v of logic.variables) options.push([v.id, v.name]);
    else if (kind === 'timer') for (const t of logic.timers) options.push([t.id, t.name]);
    else if (kind === 'objective') for (const o of logic.objectives) options.push([o.id, o.text]);
    else {
      for (const e of doc.entities) {
        const ok = kind === 'toggleable' ? (TOGGLEABLE_KINDS as readonly string[]).includes(e.kind) : e.kind === kind;
        if (ok) options.push([e.id, entityLabel(doc, e)]);
      }
    }
    if (value && !options.some(([v]) => v === value)) options.push([value, `(missing: ${value})`]);
    const wrap = document.createElement('span');
    wrap.className = 'lg-target';
    const sel = select(options, value ?? '', (v) => onChange(v || null));
    if (value && !doc.entities.some((e) => e.id === value) && !['variable', 'timer', 'objective'].includes(kind)) sel.classList.add('bad');
    wrap.append(sel);
    if (value && doc.entities.some((e) => e.id === value)) wrap.append(btn('◎', () => this.host.focusEntity(value), 'Show in map'));
    return wrap;
  }
}

// ---------------------------------------------------------------- templates

const first = (doc: MapDocument, pred: (e: MapEntity) => boolean): string | null => doc.entities.find(pred)?.id ?? null;

/** Ready-made rule sets. They wire up the first matching objects; creators then adjust the dropdowns. */
const TEMPLATES: { label: string; apply: (l: ScenarioLogic, doc: MapDocument) => void }[] = [
  {
    label: 'Button opens a locked door',
    apply: (l, doc) => {
      const door = first(doc, (e) => e.kind === 'door' && e.locked) ?? first(doc, (e) => e.kind === 'door');
      l.rules.push(newRule('Button opens door', { event: 'button_pressed', target: first(doc, (e) => e.kind === 'button') }, [action('door_unlock', { target: door }), action('door_open', { target: door }), action('sound', { state: 'chime' })]));
    },
  },
  {
    label: 'Trap ambush (zone fires a trap)',
    apply: (l, doc) => {
      const trap = first(doc, (e) => e.kind === 'trap' && e.activation === 'logic') ?? first(doc, (e) => e.kind === 'trap');
      l.rules.push(newRule('Ambush', { event: 'zone_enter', target: first(doc, (e) => e.kind === 'zone') }, [action('wait', { value: 0.5 }), action('trap_fire', { target: trap })]));
    },
  },
  {
    label: 'Reach the exit (objective + win)',
    apply: (l, doc) => {
      const zone = first(doc, (e) => e.kind === 'zone');
      const obj = { id: newId('obj'), text: 'Reach the exit', startActive: true, marker: zone };
      l.objectives.push(obj);
      l.rules.push(
        newRule('Exit reached', { event: 'zone_enter', target: zone }, [action('objective', { target: obj.id, state: 'complete' }), action('message', { text: 'Exit reached!', value: 3 }), action('wait', { value: 2 }), action('end_round', { state: 'instigator wins' })], { once: true }),
      );
    },
  },
  {
    label: 'Breach alarm (wall destroyed)',
    apply: (l, doc) => {
      l.rules.push(
        newRule('Breach alarm', { event: 'destroyed', target: first(doc, (e) => e.kind === 'destructible' && e.model === 'wall') ?? first(doc, (e) => e.kind === 'destructible') }, [
          action('sound', { state: 'alarm' }),
          action('message', { text: 'Alarm! The wall has been breached.', value: 4 }),
          action('door_open', { target: first(doc, (e) => e.kind === 'door') }),
        ]),
      );
    },
  },
  {
    label: 'Ambush (zone starts an NPC squad)',
    apply: (l, doc) => {
      l.rules.push(
        newRule('Ambush', { event: 'zone_enter', target: first(doc, (e) => e.kind === 'zone') }, [action('encounter_start', { target: first(doc, (e) => e.kind === 'encounter') }), action('message', { text: 'Ambush!', value: 3 }), action('sound', { state: 'alarm' })], { once: true }),
      );
    },
  },
  {
    label: 'Clear the squad (objective)',
    apply: (l, doc) => {
      const squad = first(doc, (e) => e.kind === 'encounter');
      const obj = { id: newId('obj'), text: 'Defeat the enemy squad', startActive: true, marker: squad };
      l.objectives.push(obj);
      l.rules.push(newRule('Squad defeated', { event: 'encounter_cleared', target: squad }, [action('objective', { target: obj.id, state: 'complete' }), action('message', { text: 'Area clear!', value: 3 })], { once: true }));
    },
  },
  {
    label: 'Co-op: win when all squads are cleared',
    apply: (l, doc) => {
      const squads = doc.entities.filter((e) => e.kind === 'encounter');
      const v = { id: newId('var'), name: 'squads_cleared', initial: 0 };
      l.variables.push(v);
      l.rules.push(newRule('Count cleared squads', { event: 'encounter_cleared', target: null }, [action('add_var', { target: v.id, value: 1 })]));
      const win = newRule('All clear', { event: 'variable_changed', target: v.id }, [action('message', { text: 'Mission complete!', value: 3 }), action('wait', { value: 2 }), action('end_round', { state: 'players win' })], { once: true });
      win.if.push({ type: 'variable', target: v.id, op: '>=', value: Math.max(1, squads.length), state: '' });
      l.rules.push(win);
    },
  },
  {
    label: 'Countdown (time limit)',
    apply: (l) => {
      const timer = { id: newId('timer'), name: 'Time left', seconds: 90, loop: false, visible: true };
      l.timers.push(timer);
      l.rules.push(newRule('Start countdown', { event: 'match_start', target: null }, [action('timer_start', { target: timer.id })]));
      l.rules.push(newRule('Out of time', { event: 'timer_done', target: timer.id }, [action('message', { text: "Time's up!", value: 3 }), action('sound', { state: 'buzzer' }), action('end_round', { state: 'nobody wins' })]));
    },
  },
  {
    label: 'Collect 3 items to open a door',
    apply: (l, doc) => {
      const v = { id: newId('var'), name: 'collected', initial: 0 };
      l.variables.push(v);
      l.rules.push(newRule('Count pickups', { event: 'pickup_taken', target: null }, [action('add_var', { target: v.id, value: 1 })]));
      const open = newRule('Enough collected', { event: 'variable_changed', target: v.id }, [action('message', { text: 'The way is open!', value: 3 }), action('door_open', { target: first(doc, (e) => e.kind === 'door') })], { once: true });
      open.if.push({ type: 'variable', target: v.id, op: '>=', value: 3, state: '' });
      l.rules.push(open);
    },
  },
];

// ---------------------------------------------------------------- DOM helpers

function div(cls: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  return d;
}

function section(title: string, hint: string): HTMLElement {
  const s = div('lg-section');
  const h = document.createElement('h3');
  h.textContent = title;
  const p = document.createElement('small');
  p.textContent = hint;
  s.append(h, p);
  return s;
}

function tag(t: string): HTMLElement {
  const s = document.createElement('b');
  s.className = `lg-tag lg-${t.toLowerCase()}`;
  s.textContent = t;
  return s;
}

function btn(label: string, onClick: () => void, title?: string, cls?: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  if (title) b.title = title;
  if (cls) b.className = cls;
  b.addEventListener('click', onClick);
  return b;
}

function select(options: [string, string][], value: string, onChange: (v: string) => void, title?: string): HTMLSelectElement {
  const s = document.createElement('select');
  for (const [v, label] of options) s.append(new Option(label, v, false, v === value));
  if (title) s.title = title;
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

function input(value: string, onChange: (v: string) => void, placeholder: string): HTMLInputElement {
  const i = document.createElement('input');
  i.value = value;
  i.placeholder = placeholder;
  i.addEventListener('change', () => onChange(i.value.trim()));
  i.addEventListener('keydown', (e) => e.key === 'Enter' && i.blur());
  return i;
}

function num(value: number, onChange: (v: number) => void): HTMLInputElement {
  const i = document.createElement('input');
  i.type = 'number';
  i.className = 'num';
  i.value = String(value);
  i.addEventListener('change', () => Number.isFinite(Number(i.value)) && onChange(Number(i.value)));
  return i;
}

function check(label: string, value: boolean, onChange: (v: boolean) => void, title?: string): HTMLElement {
  const l = document.createElement('label');
  l.className = 'lg-check';
  const c = document.createElement('input');
  c.type = 'checkbox';
  c.checked = value;
  c.addEventListener('change', () => onChange(c.checked));
  l.append(c, label);
  if (title) l.title = title;
  return l;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  const l = document.createElement('label');
  l.className = 'lg-labeled';
  l.append(label, control);
  return l;
}
