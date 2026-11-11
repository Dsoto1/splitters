import {
  isBreakableProp,
  propHealth,
  AIR_CRAFT_LABELS,
  AIR_CRAFTS,
  AIRDROP_MODES,
  BLOCK_BEHAVIOURS,
  BREAKTHROUGH_MAX_SECTORS,
  BREAKTHROUGH_OBJECTIVE_LABELS,
  BREAKTHROUGH_OBJECTIVES,
  categoryItems,
  CORE_ITEMS,
  CORE_PROPS,
  CORE_WEAPONS,
  coreMaterials,
  DESTRUCTIBLE_MODELS,
  DESTRUCTIBLE_SPECS,
  DOOR_STYLE_LABELS,
  DOOR_STYLES,
  ELECTRIC_FENCE,
  ENCOUNTER_ENTRANCES,
  entityLabel,
  ENV_SPECIES,
  FLOAT,
  getEnvSpecies,
  getKitFamily,
  getItem,
  getProp,
  GLASS_KIND_LABELS,
  GLASS_KINDS,
  isTeamMode,
  isWeaponCategory,
  itemCategory,
  LADDER_STYLE_LABELS,
  LADDER_STYLES,
  LIQUID_SPECS,
  LIQUIDS,
  mapFactions,
  mapTeams,
  MAX_TEAMS,
  MOUNT_DEFS,
  MOUNT_MODELS,
  MOUNT_SKIN_LABELS,
  MOUNT_SKINS,
  MOVER_MODES,
  normalizeYaw,
  NPC_ROLE_SPECS,
  NPC_ROLES,
  PLAYER,
  PROP_CATEGORIES,
  rosterSize,
  sectorOrders,
  SQUAD_ORDERS,
  TRAP_ACTIVATIONS,
  TRAP_KINDS,
  TRAP_SPECS,
  WEAPON_CATEGORIES,
  WEAPON_CATEGORY_LABELS,
  yawStep,
  type AirCraft,
  type AirdropMode,
  type DoorStyle,
  type EncounterEntrance,
  type GlassKind,
  type LadderStyle,
  type LightFixture,
  type MapEntity,
  type MountModel,
  type MountSkin,
  type MoverMode,
  type ObjectiveEntity
} from '@tiletrigger/shared';
import { envRendererOn } from '../environment/envFlag.ts';
import { LIQUID_LOOKS } from '../game/scenarioVisuals.ts';
import type { EditorApp } from './editorApp.ts';
import { button, h2, numberInput, row, small } from './editorDom.ts';
import { pathLabel } from './pathTool.ts';

/** The inspector for one entity: spawns, pickups, props, doors, lights, movers, triggers, traps, NPC squads, vehicles, objectives and the rest (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */
export class EntityInspector {
  constructor(readonly app: EditorApp) {}

  render(el: HTMLElement, e: MapEntity): void {
    const doc = this.app.doc;
    const update = (label: string, patch: Partial<MapEntity>) => this.app.run(label, { kind: 'updateEntities', before: [e], after: [{ ...e, ...patch } as MapEntity] });
    el.append(h2(e.kind === 'spawn' ? 'Player Spawn' : e.kind === 'pickup' ? (e.random ? `Random ${WEAPON_CATEGORY_LABELS[e.random]}` : (getItem(e.item)?.displayName ?? e.item)) : entityLabel(doc, e)));
    if (e.kind !== 'spawn' && e.kind !== 'pickup') {
      const name = document.createElement('input');
      name.type = 'text';
      name.value = e.name ?? '';
      name.placeholder = entityLabel(doc, { ...e, name: undefined });
      name.maxLength = 40;
      name.addEventListener('change', () => update('Rename', { name: name.value.trim() || undefined }));
      el.append(row('Name', name));
    }
    const setPos = (i: number, v: number) => {
      const position = [...e.position] as [number, number, number];
      position[i] = v;
      update(`Move ${e.kind}`, { position });
    };
    el.append(
      row('X', numberInput(e.position[0], 0.5, (v) => setPos(0, v))),
      row('Height', numberInput(e.position[1], 0.25, (v) => setPos(1, v))),
      row('Z', numberInput(e.position[2], 0.5, (v) => setPos(2, v))),
    );
    if ('yaw' in e) el.append(row('Facing °', numberInput(Math.round((e.yaw * 180) / Math.PI), Math.round((yawStep(e.kind) * 180) / Math.PI), (deg) => update('Turn', { yaw: normalizeYaw((deg * Math.PI) / 180) }))), this.app.inspector.quickFacings({ tiles: [], entities: [e.id] }, e.yaw));

    const toggle = (label: string, value: boolean, patch: (v: boolean) => Partial<MapEntity>) => {
      const c = document.createElement('input');
      c.type = 'checkbox';
      c.checked = value;
      c.addEventListener('change', () => update(`Set ${label.toLowerCase()}`, patch(c.checked)));
      el.append(row(label, c));
    };
    const choose = (label: string, options: readonly (readonly [string, string])[], value: string, patch: (v: string) => Partial<MapEntity>) => {
      const sel = document.createElement('select');
      for (const [v, l] of options) sel.append(new Option(l, v, false, v === value));
      sel.addEventListener('change', () => update(`Set ${label.toLowerCase()}`, patch(sel.value)));
      el.append(row(label, sel));
    };
    const number = (label: string, value: number, step: number, patch: (v: number) => Partial<MapEntity>) => el.append(row(label, numberInput(value, step, (v) => update(`Set ${label.toLowerCase()}`, patch(v)))));
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    // Team-only buttons, doors and zones (any team of the map, or an NPC faction).
    const teamFilter = (value: string | undefined, what: string) => {
      const sides = [...mapTeams(doc, MAX_TEAMS).map((t) => [t.id, t.name] as const), ...mapFactions(doc).map((f) => [f.id, `${f.name} (NPCs)`] as const), ['players', 'Players (co-op)'] as const];
      choose('Team only', [['', 'Everyone'] as const, ...sides], value ?? '', (v) => ({ team: v || undefined }) as Partial<MapEntity>);
      if (value) el.append(small(`Only that team ${what}.`));
    };

    switch (e.kind) {
      case 'prop': {
        const model = document.createElement('select');
        for (const category of PROP_CATEGORIES) {
          const group = document.createElement('optgroup');
          group.label = category;
          for (const def of CORE_PROPS.filter((d) => d.category === category)) group.append(new Option(def.displayName, def.id, false, def.id === e.model));
          model.append(group);
        }
        // Environment species (the procedural environment's preview): listed when the map has one or with ?env=1.
        const species = getEnvSpecies(e.model);
        if (species || envRendererOn()) {
          const group = document.createElement('optgroup');
          group.label = 'Environment (preview)';
          for (const s of ENV_SPECIES) group.append(new Option(s.displayName, s.id, false, s.id === e.model));
          model.append(group);
        }
        // A species' variant is kept only while it stays an environment species (a kit family's starts at its first).
        model.addEventListener('change', () => update('Change prop', { model: model.value, variant: getEnvSpecies(model.value) ? e.variant : undefined }));
        el.append(row('Model', model));
        if (species) {
          choose('Variant', species.variants.map((v) => [String(v.index), v.name[0]!.toUpperCase() + v.name.slice(1)] as const), String(e.variant ?? 0), (v) => ({ variant: v === '0' ? undefined : Number(v) }));
          el.append(small(`${species.displayName}: ${species.role === 'decorative' ? 'decoration only' : species.nav === 'none' ? 'walk-through cover (conceals)' : 'solid: its trunk or rock stops movement, shots and bots'}.`));
        }
        // A kit family's variants (content/kitProps.ts): how it is drawn only; size and collision are the family's.
        const kit = getKitFamily(e.model);
        if (kit && kit.variants.length > 1) choose('Variant', kit.variants.map((v) => [String(v.index), (v.name[0]!.toUpperCase() + v.name.slice(1)).replace(/_/g, ' ')] as const), String(e.variant ?? 0), (v) => ({ variant: v === '0' ? undefined : Number(v) }));
        number('Scale', e.scale, 0.25, (v) => ({ scale: Math.max(0.25, Math.min(4, v)) }));
        toggle('Solid', e.solid, (v) => ({ solid: v }));
        {
          // Breaking (v36): the catalogue's breakable props, any prop given its own health, every solid prop on a map
          // where everything breaks; Unbreakable keeps a piece whatever else says.
          const def = getProp(e.model);
          const everything = !!this.app.viewDoc.metadata.destruction;
          if (def?.collision && e.solid && !species) {
            const usual = def.breakable ? def.breakable.health * e.scale : propHealth(e.model, def.collision, e.scale);
            const breaks = isBreakableProp({ ...e, unbreakable: undefined }, everything);
            toggle('Unbreakable', !!e.unbreakable, (v) => ({ unbreakable: v || undefined }));
            if (!e.unbreakable) {
              // 0: the usual (the catalogue's, or its size and material's); on a map where not everything breaks, giving a health makes the piece breakable.
              number('Health', e.health ?? (breaks ? Math.round(usual) : 0), 10, (v) => ({ health: v <= 0 || (breaks && e.health === undefined && Math.round(v) === Math.round(usual)) ? undefined : clamp(v, 1, 100000) }));
              el.append(small(breaks ? `Breaks at ${Math.round(e.health ?? usual)} damage${e.health === undefined ? '' : ' (its own; 0 for the usual)'}; comes back at the next round.` : 'Does not break. Give it a health to make it breakable, or turn on Everything breaks in Map properties.'));
            } else el.append(small('Never breaks.'));
          }
        }
        const tint = document.createElement('input');
        tint.type = 'color';
        tint.value = e.tint ?? '#ffffff';
        tint.addEventListener('change', () => update('Tint prop', { tint: tint.value.toLowerCase() === '#ffffff' ? null : tint.value.toLowerCase() }));
        el.append(row('Tint', tint));
        if (!getProp(e.model)?.collision && !species) el.append(small('This prop never blocks (decoration).'));
        this.app.inspector.replaceAllSection(el, e.model);
        break;
      }
      case 'pickup': {
        choose('Item', CORE_ITEMS.map((it) => [it.id, it.displayName] as const), e.item, (v) => ({ item: v, ...(e.random && itemCategory(getItem(v)) !== e.random ? { random: undefined } : {}) }));
        // Weapon pickups: a fixed weapon, or a random one of a category rolled each time it comes back.
        if (itemCategory(getItem(e.item)) || e.random) {
          const mode = document.createElement('select');
          mode.id = 'ed-pickup-weapon';
          mode.append(new Option('Fixed: this weapon', '', false, !e.random));
          for (const c of WEAPON_CATEGORIES) mode.append(new Option(`Random from category: ${WEAPON_CATEGORY_LABELS[c]}`, c, false, c === e.random));
          mode.addEventListener('change', () => {
            const c = isWeaponCategory(mode.value) ? mode.value : null;
            // A random pickup shows a weapon of its category here (the first, unless it already holds one).
            const item = c && itemCategory(getItem(e.item)) !== c ? categoryItems(c)[0]?.id : undefined;
            update(c ? 'Random weapon pickup' : 'Fixed weapon pickup', { random: c ?? undefined, ...(item ? { item } : {}), ...(c ? { keepFixed: undefined } : {}) });
          });
          el.append(row('Weapon', mode));
          if (e.random) el.append(small(`Rolls one of ${categoryItems(e.random).map((i) => i.displayName).join(', ')} each time it comes back.`));
          else {
            const keep = document.createElement('input');
            keep.type = 'checkbox';
            keep.id = 'ed-pickup-keep';
            keep.checked = !!e.keepFixed;
            keep.addEventListener('change', () => update('Set keep fixed', { keepFixed: keep.checked || undefined }));
            el.append(row('Keep fixed', keep));
            el.append(small(e.keepFixed ? 'Stays this weapon when the host mixes up weapon pickups.' : 'The host\'s "Mix up weapon pickups" swaps it for another weapon of its kind; tick to keep it.'));
          }
        }
        const def = getItem(e.item)?.respawnSeconds ?? 0;
        number('Respawn (s)', e.respawnSeconds ?? def, 5, (v) => ({ respawnSeconds: v === def ? null : clamp(v, 1, 600) }));
        el.append(small(e.respawnSeconds === null ? `Item default (${def}s)` : 'Custom respawn time'));
        break;
      }
      case 'door':
        choose('Look', DOOR_STYLES.map((s) => [s, DOOR_STYLE_LABELS[s]] as const), e.style ?? 'sliding', (v) => ({ style: v === 'sliding' ? undefined : (v as DoorStyle) }));
        toggle('Opens by itself', e.auto, (v) => ({ auto: v }));
        toggle('Locked', e.locked, (v) => ({ locked: v }));
        toggle('Starts open', e.startOpen, (v) => ({ startOpen: v }));
        el.append(small(e.auto ? 'Slides open when a player comes close (unless locked).' : 'Players press E to open it, or logic opens it.'));
        teamFilter(e.team, 'opens it by walking up or pressing E (logic still opens it for everyone); bots of other teams path round it');
        break;
      case 'button':
        {
          const label = document.createElement('input');
          label.type = 'text';
          label.value = e.label;
          label.maxLength = 40;
          label.addEventListener('change', () => update('Set prompt', { label: label.value.trim() || 'Press' }));
          el.append(row('Prompt', label));
        }
        toggle('Single use', e.once, (v) => ({ once: v }));
        number('Cooldown (s)', e.cooldownSeconds, 0.5, (v) => ({ cooldownSeconds: clamp(v, 0.2, 60) }));
        toggle('Starts enabled', e.startEnabled, (v) => ({ startEnabled: v }));
        teamFilter(e.team, 'can press it');
        break;
      case 'destructible': {
        const spec = DESTRUCTIBLE_SPECS[e.model];
        choose('Model', DESTRUCTIBLE_MODELS.map((m) => [m, DESTRUCTIBLE_SPECS[m].label] as const), e.model, (v) => ({ model: v as typeof e.model, health: null }));
        number('Health', e.health ?? spec.health, 10, (v) => ({ health: v === spec.health ? null : clamp(v, 1, 5000) }));
        toggle('Explosives only', e.explosiveOnly, (v) => ({ explosiveOnly: v }));
        if (spec.blast) el.append(small('Explodes when destroyed.'));
        break;
      }
      case 'block': {
        number('Width (X)', e.size[0], 0.5, (v) => ({ size: [clamp(v, e.glass ? 0.05 : 0.2, 64), e.size[1], e.size[2]] }));
        number('Thickness', e.size[1], 0.25, (v) => ({ size: [e.size[0], clamp(v, 0.1, 32), e.size[2]] }));
        number('Depth (Z)', e.size[2], 0.5, (v) => ({ size: [e.size[0], e.size[1], clamp(v, e.glass ? 0.05 : 0.2, 64)] }));
        const labels: Record<(typeof BLOCK_BEHAVIOURS)[number], string> = { solid: 'Solid (sky block)', breakable: 'Breakable (shoot it)', crumble: 'Crumbles when stood on', trapdoor: 'Trapdoor (drops away)' };
        choose('Behaviour', BLOCK_BEHAVIOURS.map((b) => [b, labels[b]] as const), e.behaviour, (v) => ({ behaviour: v as typeof e.behaviour }));
        const mats = document.createElement('select');
        mats.append(new Option("Theme's solid material", '', false, e.material === null));
        for (const m of coreMaterials.all()) mats.append(new Option(m.displayName, m.id, false, m.id === e.material));
        mats.addEventListener('change', () => update('Block material', { material: mats.value || null }));
        el.append(row('Material', mats));
        if (e.behaviour === 'crumble' || e.behaviour === 'trapdoor') {
          choose('Set off by', [['step', 'someone standing on it'], ['logic', 'logic only (destroy action)']], e.trigger, (v) => ({ trigger: v as typeof e.trigger }));
          number('Delay (s)', e.delaySeconds, 0.1, (v) => ({ delaySeconds: clamp(v, 0, 10) }));
        }
        if (e.behaviour === 'breakable') number('Health', e.health, 10, (v) => ({ health: clamp(v, 1, 5000) }));
        if (e.behaviour !== 'solid') {
          toggle('Comes back', e.respawnSeconds !== null, (v) => ({ respawnSeconds: v ? 8 : null }));
          if (e.respawnSeconds !== null) number('Back after (s)', e.respawnSeconds, 1, (v) => ({ respawnSeconds: clamp(v, 1, 600) }));
        }
        // Tilt: ramps, roofs, toppled wrecks (±45°, about the block's centre).
        const deg = (r: number | undefined) => Math.round(((r ?? 0) * 180) / Math.PI);
        const rad = (d: number) => {
          const r = (clamp(Math.round(d), -45, 45) * Math.PI) / 180;
          return r === 0 ? undefined : r;
        };
        number('Pitch ° (±45)', deg(e.pitch), 5, (v) => ({ pitch: rad(v) }));
        number('Roll ° (±45)', deg(e.roll), 5, (v) => ({ roll: rad(v) }));
        if (e.pitch || e.roll) el.append(small(`Pitch lifts its far (+Z) end, roll its +X side. Players walk up slopes of ${PLAYER.maxSlopeDegrees}° or less; steeper ones are slides and walls (bots treat them so too).`));
        toggle('Starts hidden', !!e.startHidden, (v) => ({ startHidden: v || undefined }));
        if (e.startHidden) el.append(small('Appears when a rule rebuilds or enables it (a bridge that extends).'));
        if (e.behaviour === 'solid' && !e.field) {
          // Glass as the block's material: see-through, stops players; breakable shatters, reinforced cracks.
          choose('Glass', [['', 'None'], ...GLASS_KINDS.map((k) => [k, GLASS_KIND_LABELS[k]] as const)], e.glass ?? '', (v) => ({ glass: (v || undefined) as GlassKind | undefined }));
          if (e.glass) el.append(small(e.glass === 'breakable' ? 'A glass panel: players can\'t pass, everyone sees through, and the first shot or blast shatters it (shots carry on through). It comes back next round, or after the map\'s glass time (Map settings).' : 'Bulletproof glass: players can\'t pass and shots stop at it, but everyone sees through. Hits crack and frost it; it never breaks.'));
        }
        if (e.behaviour === 'solid' && !e.glass) {
          toggle('Force field', !!e.field, (v) => ({ field: v || undefined, ...(v && !e.tint ? { tint: '#5ad8ff' } : {}) }));
          if (e.field) {
            const glow = document.createElement('input');
            glow.type = 'color';
            glow.value = e.tint ?? '#5ad8ff';
            glow.addEventListener('change', () => update('Colour field', { tint: glow.value.toLowerCase() }));
            el.append(row('Field colour', glow));
            el.append(small('A humming energy barrier: players and vehicles can\'t pass, but shots, grenades and sight go straight through. Switch it with logic: Drop block or Disable turns it off, Rebuild block or Enable back on (a team button that drops the enemy\'s shield).'));
          }
        }
        el.append(small(e.behaviour === 'solid' ? 'Part of the level: walk on it anywhere, at any height. Logic can drop it (Drop block), bring it back (Rebuild block) or carry it on a mover.' : 'Drawn with a coloured lip so players can learn what it does. Logic can drop it at any time (Drop block) and rebuild it.'));
        break;
      }
      case 'water':
        number('Width (X)', e.size[0], 1, (v) => ({ size: [clamp(v, 0.5, 512), e.size[1], e.size[2]] }));
        number('Depth (deep)', e.size[1], 0.25, (v) => ({ size: [e.size[0], clamp(v, 0.2, 64), e.size[2]] }));
        number('Length (Z)', e.size[2], 1, (v) => ({ size: [e.size[0], e.size[1], clamp(v, 0.5, 512)] }));
        choose('Liquid', LIQUIDS.map((l) => [l, LIQUID_SPECS[l].label] as const), e.liquid, (v) => ({ liquid: v as typeof e.liquid }));
        el.append(small(e.liquid === 'water' ? 'Deeper than 1 m you swim (hold jump to rise). Stay under 15 s and you start drowning.' : e.liquid === 'swamp' ? 'Slows everyone right down.' : `Hurts ${LIQUID_SPECS[e.liquid].dps} a second while you stand in it.`));
        {
          const tint = document.createElement('input');
          tint.type = 'color';
          tint.value = e.tint ?? LIQUID_LOOKS[e.liquid].color;
          tint.addEventListener('change', () => update('Tint liquid', { tint: tint.value.toLowerCase() }));
          el.append(row('Colour', tint));
          if (e.tint) el.append(button('Default colour', () => update('Tint liquid', { tint: undefined })));
        }
        el.append(small('Its surface is at Height + Depth: sink it into a pit or a dip in the terrain. Colour only changes the look (green acid, murky sewer water).'));
        break;
      case 'zone':
        number('Width (X)', e.size[0], 0.5, (v) => ({ size: [clamp(v, 0.5, 64), e.size[1], e.size[2]] }));
        number('Height', e.size[1], 0.5, (v) => ({ size: [e.size[0], clamp(v, 0.5, 32), e.size[2]] }));
        number('Depth (Z)', e.size[2], 0.5, (v) => ({ size: [e.size[0], e.size[1], clamp(v, 0.5, 64)] }));
        choose('Fires when', [['any', 'any player enters'], ['count', 'enough players are in'], ['all', 'every living player is in']], e.who, (v) => ({ who: v as typeof e.who }));
        if (e.who === 'count') number('Players needed', e.count, 1, (v) => ({ count: clamp(Math.round(v), 1, 32) }));
        toggle('Starts enabled', e.startEnabled, (v) => ({ startEnabled: v }));
        teamFilter(e.team, 'counts in it ("every living player" means all of that team)');
        number('Gravity (× map, 1 = none)', e.gravity ?? 1, 0.05, (v) => {
          const g = Math.round(clamp(v, 0.1, 3) * 100) / 100;
          return { gravity: g === 1 ? undefined : g };
        });
        if (e.gravity !== undefined) el.append(small(`Gravity inside is ${Math.round(e.gravity * 100)}% of the map's: jumps go ${e.gravity < 1 ? 'higher and float down slowly' : 'lower and drop fast'}, and so do jump-pad flights. Always on, whatever logic does to the zone.`));
        break;
      case 'trap': {
        const spec = TRAP_SPECS[e.trap];
        choose('Trap', TRAP_KINDS.map((k) => [k, TRAP_SPECS[k].label] as const), e.trap, (v) => {
          const d = TRAP_SPECS[v as typeof e.trap].defaults;
          return { trap: v as typeof e.trap, activation: d.activation, onSeconds: d.onSeconds, offSeconds: d.offSeconds, damage: null };
        });
        const labels: Record<(typeof TRAP_ACTIVATIONS)[number], string> = { always: 'always on', cycle: 'on a cycle', proximity: 'when stepped on', logic: 'only from logic' };
        if (e.trap !== 'mine') choose('Fires', TRAP_ACTIVATIONS.map((a) => [a, labels[a]] as const), e.activation, (v) => ({ activation: v as typeof e.activation }));
        if (e.activation !== 'always' || e.trap === 'mine') number(e.trap === 'mine' ? 'Rearm (s)' : 'Off (s)', e.offSeconds, 0.5, (v) => ({ offSeconds: clamp(v, 0.2, 600) }));
        if (e.trap !== 'mine' && e.activation !== 'always') number('On (s)', e.onSeconds, 0.5, (v) => ({ onSeconds: clamp(v, 0.2, 60) }));
        if (e.activation === 'cycle' && e.trap !== 'mine') number('Offset (s)', e.offsetSeconds, 0.25, (v) => ({ offsetSeconds: clamp(v, 0, 60) }));
        if (e.trap === 'shock') number('Length (m)', e.length ?? ELECTRIC_FENCE.defaultLength, 2, (v) => ({ length: clamp(v, 2, 96) }));
        if (e.trap === 'crusher') choose('Look', [['press', 'Steel press'], ['rockfall', 'Falling rocks']] as const, e.style ?? 'press', (v) => ({ style: v === 'rockfall' ? 'rockfall' : undefined }));
        number('Damage', e.damage ?? spec.blast?.damage ?? spec.damage, 5, (v) => ({ damage: v === (spec.blast?.damage ?? spec.damage) ? null : clamp(v, 1, 1000) }));
        toggle('Starts enabled', e.startEnabled, (v) => ({ startEnabled: v }));
        break;
      }
      case 'encounter': {
        const factions = mapFactions(doc);
        choose('Faction', factions.map((f) => [f.id, f.name] as const), e.faction, (v) => ({ faction: v }));
        for (const role of NPC_ROLES) number(NPC_ROLE_SPECS[role].label.endsWith('s') ? NPC_ROLE_SPECS[role].label : `${NPC_ROLE_SPECS[role].label}s`, e.roster[role] ?? 0, 1, (v) => ({ roster: { ...e.roster, [role]: clamp(Math.round(v), 0, 16) } }));
        number('Max alive', e.activeCap, 1, (v) => ({ activeCap: clamp(Math.round(v), 1, 32) }));
        number('Reinforcements', e.reinforcements, 1, (v) => ({ reinforcements: clamp(Math.round(v), 0, 500) }));
        number('+ per extra player', e.perPlayer, 1, (v) => ({ perPlayer: clamp(Math.round(v), 0, 16) }));
        number('Reinforce every (s)', e.respawnSeconds, 1, (v) => ({ respawnSeconds: clamp(v, 0.5, 120) }));
        const entranceLabels: Record<EncounterEntrance, string> = { none: 'spread round the point', vent: 'drop from a ceiling vent', hatch: 'climb out of a floor hatch', burrow: 'dig out of a burrow', breach: 'step through a breach in the wall behind' };
        choose('Arrives by', ENCOUNTER_ENTRANCES.map((k) => [k, entranceLabels[k]] as const), e.entrance ?? 'none', (v) => ({ entrance: v as EncounterEntrance }));
        if ((e.entrance ?? 'none') === 'none') number('Spawn radius (m)', e.radius, 0.5, (v) => ({ radius: clamp(v, 1, 16) }));
        if (e.entrance === 'vent') number('Vent height (m)', e.ventHeight ?? 3.5, 0.25, (v) => ({ ventHeight: clamp(v, 2, 12) }));
        if ((e.entrance ?? 'none') !== 'none') number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        const orderLabels: Record<(typeof SQUAD_ORDERS)[number], string> = { hold: 'hold here', attack: 'hunt the enemy', defend: 'defend the target', patrol: 'patrol a route (or to the target and back)', follow: 'follow the players (allies)', roam: 'roam the whole map (wildlife, monsters)' };
        choose('Order', SQUAD_ORDERS.map((o) => [o, orderLabels[o]] as const), e.order, (v) => ({ order: v as typeof e.order }));
        if (e.order === 'patrol') {
          // Routes (and roads) drawn with the Paths tool: the squad walks one, round a loop or there and back.
          const routes = (doc.paths ?? []).map((p, i) => [p, i] as const).filter(([p]) => p.uses.includes('route') || p.uses.includes('road'));
          choose('Route', [['', '— none: to the target and back —'] as const, ...routes.map(([p, i]) => [p.id, pathLabel(p, i)] as const)], e.route ?? '', (v) => ({ route: v || undefined }));
          if (e.route) {
            el.append(
              button('Edit the route on the map', () => {
                this.app.setTool({ kind: 'path' });
                this.app.paths.edit(e.route!);
              }),
            );
          } else {
            el.append(
              button('Draw a new route', () => {
                this.app.paths.preset('route');
                this.app.setTool({ kind: 'path' });
                this.app.toast('Click the ground to draw the route (join the ends for a loop), then pick it in this squad\'s Route');
              }),
            );
          }
        }
        if (e.order === 'defend' || (e.order === 'patrol' && !e.route)) {
          choose('Target', [['', '— choose —'] as const, ...doc.entities.filter((o) => o.id !== e.id && o.kind !== 'spawn').map((o) => [o.id, entityLabel(doc, o)] as const)], e.orderTarget ?? '', (v) => ({ orderTarget: v || null }));
        }
        choose('Skill', [['easy', 'easy'], ['normal', 'normal'], ['hard', 'hard']], e.difficulty, (v) => ({ difficulty: v as typeof e.difficulty }));
        toggle('Active at start', e.startActive, (v) => ({ startActive: v }));
        // Per-encounter tuning as percentages of the roles' own numbers (100 = unchanged).
        const pct = (x: number | undefined) => Math.round((x ?? 1) * 100);
        const ratio = (v: number, lo: number, hi: number) => {
          const r = clamp(Math.round(v) / 100, lo, hi);
          return r === 1 ? undefined : r;
        };
        number('Health (%)', pct(e.health), 25, (v) => ({ health: ratio(v, 0.25, 10) }));
        number('Damage (%)', pct(e.damage), 25, (v) => ({ damage: ratio(v, 0, 5) }));
        number('Size (%)', pct(e.size), 10, (v) => ({ size: ratio(v, 0.5, 2.5) }));
        el.append(small(`${rosterSize(e.roster)} in the first wave, then ${e.reinforcements} reinforcements (+${e.perPlayer} per extra player). Factions are edited in the Logic panel (L).`));
        if ((e.entrance ?? 'none') !== 'none') el.append(small(e.entrance === 'vent' ? 'They come one at a time, dropping from the vent: put the point under a ceiling and set the vent height to it (3.5 m under a standard floor).' : e.entrance === 'breach' ? 'They come one at a time through the hole: put the point right against a wall, facing into the room.' : 'They come one at a time, climbing out of it.'));
        break;
      }
      case 'flag': {
        const teams = mapTeams(doc, 2);
        choose('Team', teams.map((t) => [t.id, t.name] as const), e.team, (v) => ({ team: v }));
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        el.append(small('Capture the Flag: this team\'s flag stands here. Players bring the enemy flag to it to score, while their own flag is home. One base per team; put it somewhere the team can defend, off its spawn points.'));
        break;
      }
      case 'light': {
        choose('Fixture', [['ceiling', 'Ceiling panel'], ['wall', 'Wall lamp'], ['bulb', 'Hanging bulb'], ['strip', 'Strip light'], ['sign', 'Neon sign'], ['billboard', 'Holo billboard'], ['candle', 'Candelabra (flickers)'], ['chandelier', 'Chandelier (flickers)'], ['none', 'Hidden (light only)']] as const, e.fixture, (v) => ({ fixture: v as LightFixture }));
        if (e.fixture === 'candle' || e.fixture === 'chandelier') el.append(small('Candles flicker by themselves; blinking (here or from logic) makes them gutter and flare.'));
        if (e.fixture === 'sign' || e.fixture === 'billboard') {
          const words = document.createElement('input');
          words.type = 'text';
          words.maxLength = 24;
          words.value = e.text ?? '';
          words.placeholder = e.fixture === 'sign' ? 'OPEN' : 'TILE TRIGGER';
          words.addEventListener('change', () => update('Sign text', { text: words.value.trim() || undefined }));
          el.append(row('Words', words));
          const [sw, sh] = e.size ?? (e.fixture === 'billboard' ? [6, 3.4] : [2.4, 0.8]);
          number('Sign width (m)', sw, 0.2, (v) => ({ size: [clamp(v, 0.4, 24), sh] }));
          number('Sign height (m)', sh, 0.1, (v) => ({ size: [sw, clamp(v, 0.3, 16)] }));
        }
        const color = document.createElement('input');
        color.type = 'color';
        color.value = e.color;
        color.addEventListener('change', () => update('Colour light', { color: color.value.toLowerCase() }));
        el.append(row('Colour', color));
        number('Brightness', e.intensity, 0.1, (v) => ({ intensity: clamp(v, 0.1, 5) }));
        number('Reach (m)', e.range, 1, (v) => ({ range: clamp(v, 1, 30) }));
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        toggle('Starts off', !!e.off, (v) => ({ off: v || undefined }));
        number('Blinks per s (0 steady)', e.blink ?? 0, 0.5, (v) => ({ blink: v <= 0 ? undefined : clamp(v, 0.2, 10) }));
        el.append(small('Logic can switch it on and off, change its colour, flash it or make it blink (alarms, trap tells, a cinema dimming).'));
        el.append(small('Lights the area round it out to its reach (lighting only). Ceiling panels and strips go just under a ceiling (within 1.5 m they are drawn fastened to it; a bulb\'s cord and a chandelier\'s chain reach up to it), wall lamps on a wall facing into the room. Hundreds are fine on most GPUs.'));
        break;
      }
      case 'hostage':
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        el.append(small('Hostage Rescue: a hostage waits here each round. Rescuers (the first team) press E beside it and lead it to a Rescue Zone; rescuing half of them wins the round.'));
        break;
      case 'rescue':
        number('Radius (m)', e.radius, 0.5, (v) => ({ radius: clamp(v, 2, 12) }));
        el.append(small('Hostage Rescue: hostages led in here are rescued. Usually near the rescuers\' spawn, away from the hostages.'));
        break;
      case 'bombsite':
        choose('Site', ['A', 'B', 'C', 'D', 'E'].map((l) => [l, l] as const), e.label, (v) => ({ label: v }));
        number('Radius (m)', e.radius, 0.5, (v) => ({ radius: clamp(v, 2, 12) }));
        el.append(small('Bomb mode: attackers (the first team) plant the bomb inside a site (E, then hold still 3 s); defenders defuse it (E at the bomb, hold still 5 s). Place two, A and B, away from both spawns.'));
        break;
      case 'hill':
        number('Radius (m)', e.radius, 0.5, (v) => ({ radius: clamp(v, 2, 20) }));
        el.append(small('King of the Hill: the hill moves between hills in the order they were placed, every minute. A team scores a point per second while it alone stands inside.'));
        break;
      case 'zipline': {
        // The far post, in world terms (the map keeps it as an offset from the start post).
        const far = (i: number, v: number) => {
          const end = [...e.end] as [number, number, number];
          end[i] = clamp(v - e.position[i]!, i === 1 ? -200 : -400, i === 1 ? 200 : 400);
          update('Move zipline end', { end });
        };
        el.append(
          row('Far end X', numberInput(e.position[0] + e.end[0], 0.5, (v) => far(0, v))),
          row('Far end height', numberInput(e.position[1] + e.end[1], 0.25, (v) => far(1, v))),
          row('Far end Z', numberInput(e.position[2] + e.end[2], 0.5, (v) => far(2, v))),
        );
        const place = button('Place ends on the map', () => {
          this.app.routes.edit(e.id);
          this.app.setTool({ kind: 'route' });
        });
        place.id = 'ed-zip-ends';
        place.title = 'Click the ground (or a platform) to put the far end there; drag either end to move it (Esc when done)';
        el.append(place);
        number('Post height (m)', e.height, 0.1, (v) => ({ height: clamp(v, 2.5, 8) }));
        number('Speed (m/s)', e.speed, 1, (v) => ({ speed: clamp(v, 3, 30) }));
        toggle('Both ways', e.twoWay, (v) => ({ twoWay: v }));
        teamFilter(e.team, 'can ride it');
        number('Droop (%)', Math.round(e.sag * 100), 1, (v) => ({ sag: clamp(v, 0, 10) / 100 }));
        const run = Math.hypot(e.end[0], e.end[2]);
        const len = Math.hypot(e.end[0], e.end[1], e.end[2]);
        const slope = Math.round((Math.atan2(e.end[1], run) * 180) / Math.PI);
        el.append(small(`${len.toFixed(1)} m, ${slope === 0 ? 'level' : slope < 0 ? `${-slope}° downhill` : `${slope}° uphill`}, about ${Math.max(1, Math.round(len / e.speed))} s a ride. Players press E under either post (or the cable) to grab it, ride to the far end${e.twoWay ? ' (or back)' : ''}, and jump or E to let go. Sidearms and blades fire on the way; bots use it as a shortcut.`));
        break;
      }
      case 'ladder':
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        number('Height (m)', e.height, 0.5, (v) => ({ height: Math.max(1, Math.min(24, v)) }));
        number('Width (m)', e.width, 0.1, (v) => ({ width: Math.max(0.5, Math.min(3, v)) }));
        choose('Look', LADDER_STYLES.map((st) => [st, LADDER_STYLE_LABELS[st]] as const), e.style ?? 'rungs', (v) => ({ style: v === 'rungs' ? undefined : (v as LadderStyle) }));
        el.append(small('Put its foot against a wall, facing out (R turns it). Players and bots walk into it to climb and jump to let go. 4 m reaches the next level.'));
        break;
      case 'pad':
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        number('Launch up (m/s)', e.power, 1, (v) => ({ power: Math.max(2, Math.min(40, v)) }));
        number('Push forward (m/s)', e.push, 1, (v) => ({ push: Math.max(0, Math.min(40, v)) }));
        el.append(small(`About ${((e.power * e.power) / (2 * 20)).toFixed(1)} m high and ${((e.push * 2 * e.power) / 20).toFixed(0)} m along, landing level. The arrows point the way it throws you.`));
        break;
      case 'portal': {
        const partner = doc.entities.find((o) => o.kind === 'portal' && o.pair === e.pair && o.id !== e.id);
        const crowd = doc.entities.filter((o) => o.kind === 'portal' && o.pair === e.pair).length;
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        number('Width (m)', e.size[0], 0.2, (v) => ({ size: [clamp(v, 1.2, 8), e.size[1]] }));
        number('Height (m)', e.size[1], 0.2, (v) => ({ size: [e.size[0], clamp(v, 2.2, 8)] }));
        {
          const pair = document.createElement('input');
          pair.type = 'text';
          pair.maxLength = 32;
          pair.value = e.pair;
          pair.addEventListener('change', () => {
            const v = pair.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
            if (v) update('Pair portal', { pair: v });
          });
          el.append(row('Pair', pair));
          const glow = document.createElement('input');
          glow.type = 'color';
          glow.value = e.color ?? '#3aa8ff';
          glow.addEventListener('change', () => update('Colour portal', { color: glow.value.toLowerCase() }));
          el.append(row('Colour', glow));
        }
        toggle('Starts on', e.startEnabled, (v) => ({ startEnabled: v }));
        el.append(small(partner ? `Leads to ${entityLabel(doc, partner)}: walk (or shoot) into its front and you come out of the other, moving the same way relative to it. Turning one portal turns where you face coming out.` : crowd > 2 ? `Pair "${e.pair}" has ${crowd} portals: a pair links exactly two.` : `No other end yet: give a second portal the pair "${e.pair}" (the Portal Pair tool places both).`));
        el.append(small('Logic switches portals on and off (Enable / Disable): a pair works only while both are on. Bots take portals as shortcuts. Leave room to stand in front of both.'));
        break;
      }
      case 'mount': {
        const def = MOUNT_DEFS[e.model];
        choose('Type', MOUNT_MODELS.map((m) => [m, MOUNT_DEFS[m].displayName] as const), e.model, (v) => ({ model: v as MountModel }));
        number('Facing (°)', Math.round((e.yaw * 180) / Math.PI), 15, (v) => ({ yaw: (v * Math.PI) / 180 }));
        const teams = mapTeams(doc, MAX_TEAMS);
        if (def.kind === 'sentry') choose('Team', [['', 'Nobody (shoots everyone)'] as const, ...teams.map((t) => [t.id, t.name] as const)], e.faction ?? '', (v) => ({ faction: v || null }));
        else {
          choose('Team', [['', 'Nobody (anyone\'s)'] as const, ...teams.map((t) => [t.id, t.name] as const)], e.faction ?? '', (v) => ({ faction: v || null }));
          choose('Paint', MOUNT_SKINS.map((k) => [k, MOUNT_SKIN_LABELS[k]] as const), e.skin ?? 'auto', (v) => ({ skin: v === 'auto' ? undefined : (v as MountSkin) }));
        }
        if (def.kind === 'vehicle' && !def.vehicle?.fly) {
          toggle('Rides on water', !!e.onWater, (v) => ({ onWater: v ? true : undefined }));
          el.append(small(e.onWater ? `Floats on water and swamp, ${def.vehicle?.draft ?? FLOAT.draft} m deep in it: a bit slower and slidier there, and it drives up the shore. Lava and acid still take it.` : 'Sinks to the bottom in water (tick Rides on water for a boat or jet ski).'));
        }
        number('Respawn (s)', e.respawnSeconds ?? def.respawnSeconds, 5, (v) => ({ respawnSeconds: Math.max(5, Math.min(600, v)) }));
        const seats = def.seats.length ? def.seats.map((s) => `${s.label}${s.weapon ? ` (${CORE_WEAPONS[s.weapon]?.displayName})` : ''}`).join(', ') : 'none: it fires on its own';
        el.append(small(`${def.blurb}. Seats: ${seats}. Health ${def.health}. Players get in and out with E.`));
        break;
      }
      case 'airplane': {
        // What flies it: the transport plane or a dropship (looks and benches; the same route and drop rules).
        choose('Aircraft', AIR_CRAFTS.map((c) => [c, AIR_CRAFT_LABELS[c]] as const), e.craft ?? 'plane', (v) => ({ craft: v as AirCraft }));
        // The route as a point list: [x, z] offsets from the plane's anchor, flown in order.
        number('Altitude (m)', e.altitude, 5, (v) => ({ altitude: clamp(v, 15, 400) }));
        number('Lap time (s)', e.loopSeconds, 5, (v) => ({ loopSeconds: clamp(v, 10, 600) }));
        toggle('Loops round', e.closed, (v) => ({ closed: v }));
        const dropLabels: Record<AirdropMode, string> = { off: 'Off (it just flies over)', start: 'Round start (everyone starts aboard)', always: 'Every spawn' };
        choose('Air drop', AIRDROP_MODES.map((m) => [m, dropLabels[m]] as const), e.airdrop, (v) => ({ airdrop: v as AirdropMode }));
        const h3 = document.createElement('h3');
        h3.textContent = 'Route';
        el.append(h3);
        e.route.forEach(([x, z], i) => {
          const set = (j: 0 | 1, v: number) => {
            const route = e.route.map((p) => [...p] as [number, number]);
            route[i]![j] = clamp(v, -2000, 2000);
            return { route };
          };
          const xIn = numberInput(x, 5, (v) => update('Move route point', set(0, v)));
          const zIn = numberInput(z, 5, (v) => update('Move route point', set(1, v)));
          const del = button('✕', () => update('Remove route point', { route: e.route.filter((_, j) => j !== i) }));
          del.disabled = e.route.length <= 2;
          del.title = 'Remove this point';
          const wrap = document.createElement('span');
          wrap.className = 'route-point';
          wrap.append(xIn, zIn, del);
          el.append(row(`${i + 1}. X, Z`, wrap));
        });
        el.append(button('+ Add point', () => {
          const [lx, lz] = e.route[e.route.length - 1]!;
          const [fx, fz] = e.route[0]!;
          // Half-way back to the start (or 40 m on) so the new point is easy to find.
          const next: [number, number] = e.closed ? [(lx + fx) / 2 + 20, (lz + fz) / 2 + 20] : [lx + 40, lz];
          if (e.route.length < 32) update('Add route point', { route: [...e.route, next] });
        }));
        const length = e.route.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - e.route[i - 1]![0], p[1] - e.route[i - 1]![1]) : 0), 0) + (e.closed ? Math.hypot(e.route[0]![0] - e.route[e.route.length - 1]![0], e.route[0]![1] - e.route[e.route.length - 1]![1]) : 0);
        el.append(this.app.inspector.drawRouteButton(e.id));
        el.append(small(`Points are metres from the marker (moving it moves the whole route). ${Math.round(length)} m a lap at ${Math.round(length / e.loopSeconds)} m/s. Draw it in and out of the map's boundary as you like: riders (players and bots) can only jump out while it is over the play area, above ground they can land on (not the void, lava or acid); anyone still aboard when it leaves that stretch is dropped at its last good point. Bots jump where they land nearest their objective.`));
        break;
      }
      case 'mover': {
        const modeLabels: Record<MoverMode, string> = { loop: 'round its points, over and over', pingpong: 'there and back, over and over', trigger: 'only when logic sends it' };
        choose('Moves', MOVER_MODES.map((m) => [m, modeLabels[m]] as const), e.mode, (v) => ({ mode: v as MoverMode }));
        number('Speed (m/s)', e.speed, 0.5, (v) => ({ speed: clamp(v, 0.2, 40) }));
        number('Turn speed (°/s)', e.turnSpeed, 5, (v) => ({ turnSpeed: clamp(v, 5, 360) }));
        number('Wait at points (s)', e.wait, 0.5, (v) => ({ wait: clamp(v, 0, 120) }));
        if (e.mode !== 'trigger') toggle('Runs from the start', e.startActive, (v) => ({ startActive: v }));
        const h3 = document.createElement('h3');
        h3.textContent = 'Points';
        el.append(h3);
        e.points.forEach((p, i) => {
          const set = (j: 0 | 1 | 2, v: number) => {
            const points = e.points.map((q) => [...q] as [number, number, number]);
            points[i]![j] = clamp(v, -500, 500);
            return { points };
          };
          const angle = numberInput(Math.round(((e.angles?.[i] ?? 0) * 180) / Math.PI), 15, (v) => {
            const angles = e.points.map((_, k) => e.angles?.[k] ?? 0);
            angles[i] = (clamp(Math.round(v), -180, 180) * Math.PI) / 180;
            update('Turn mover point', { angles: angles.some((a) => a !== 0) ? angles : undefined });
          });
          angle.title = 'Hinge angle (°): turns the blocks about a level hinge through the marker, square to its facing (drawbridges)';
          const wrap = document.createElement('span');
          wrap.className = 'route-point';
          const del = button('✕', () => update('Remove mover point', { points: e.points.filter((_, j) => j !== i), ...(e.angles ? { angles: e.angles.filter((_, j) => j !== i) } : {}) }));
          del.disabled = e.points.length <= 2;
          wrap.append(numberInput(p[0], 0.5, (v) => update('Move mover point', set(0, v))), numberInput(p[1], 0.5, (v) => update('Move mover point', set(1, v))), numberInput(p[2], 0.5, (v) => update('Move mover point', set(2, v))), angle, del);
          el.append(row(`${i + 1}. X, Y, Z, °`, wrap));
        });
        el.append(button('+ Add point', () => {
          const last = e.points[e.points.length - 1]!;
          if (e.points.length < 16) update('Add mover point', { points: [...e.points, [last[0], last[1] + 2, last[2]]], ...(e.angles ? { angles: [...e.angles, e.angles[e.angles.length - 1] ?? 0] } : {}) });
        }), this.app.inspector.drawRouteButton(e.id));
        const h3b = document.createElement('h3');
        h3b.textContent = 'Carries';
        el.append(h3b);
        // Every block it carries, then free blocks near the marker (not another mover's) to tick.
        const elsewhere = new Set(doc.entities.flatMap((o) => (o.kind === 'mover' && o.id !== e.id ? o.blocks : [])));
        const dist = (o: MapEntity) => Math.hypot(o.position[0] - e.position[0], o.position[2] - e.position[2]);
        const blocks = doc.entities.filter((o): o is Extract<MapEntity, { kind: 'block' }> => o.kind === 'block');
        const near = [
          ...blocks.filter((o) => e.blocks.includes(o.id)),
          ...blocks.filter((o) => !e.blocks.includes(o.id) && !elsewhere.has(o.id) && dist(o) < 24).sort((a, b) => dist(a) - dist(b)).slice(0, 12),
        ];
        for (const b of near) {
          const c = document.createElement('input');
          c.type = 'checkbox';
          c.checked = e.blocks.includes(b.id);
          c.addEventListener('change', () => {
            const blocks = c.checked ? [...e.blocks, b.id] : e.blocks.filter((id) => id !== b.id);
            if (blocks.length) update('Carry blocks', { blocks });
            else c.checked = true;
          });
          el.append(row(entityLabel(doc, b), c));
        }
        // Props riding along (a locomotive, a mine cart): drawn only, so ticking one makes it walk-through.
        const nearProps = doc.entities
          .filter((o): o is Extract<MapEntity, { kind: 'prop' }> => o.kind === 'prop' && ((e.props ?? []).includes(o.id) || Math.hypot(o.position[0] - e.position[0], o.position[2] - e.position[2]) < 24))
          .sort((a, b) => Math.hypot(a.position[0] - e.position[0], a.position[2] - e.position[2]) - Math.hypot(b.position[0] - e.position[0], b.position[2] - e.position[2]))
          .slice(0, 16);
        if (nearProps.length) {
          const h3c = document.createElement('h3');
          h3c.textContent = 'Props riding along';
          el.append(h3c);
          for (const pr of nearProps) {
            const c = document.createElement('input');
            c.type = 'checkbox';
            c.checked = (e.props ?? []).includes(pr.id);
            c.addEventListener('change', () => {
              const list = c.checked ? [...(e.props ?? []), pr.id] : (e.props ?? []).filter((id) => id !== pr.id);
              const after = [{ ...e, props: list.length ? list : undefined } as MapEntity];
              const before: MapEntity[] = [e];
              if (c.checked && pr.solid) {
                before.push(pr);
                after.push({ ...pr, solid: false });
              }
              this.app.run('Carry props', { kind: 'updateEntities', before, after });
            });
            el.append(row(`${getProp(pr.model)?.displayName ?? pr.model} (${pr.id})`, c));
          }
        }
        el.append(small('Points are metres from where the blocks are placed (point 1 is usually 0, 0, 0). Players standing on a carried block ride it; bots ride lifts that run by themselves. Props riding along are drawn only (their blocks collide); blocks moving faster than 4 m/s run over whoever is in the way. Logic: "Send mover", "Move mover to point", Enable/Disable (start, park), and the "Mover arrives" event.'));
        break;
      }
      case 'spawn': {
        const teams = mapTeams(doc, MAX_TEAMS);
        choose('Team', [['', 'Any (shared)'] as const, ...teams.map((t) => [t.id, t.name] as const)], e.faction ?? '', (v) => ({ faction: v || null }));
        el.append(small(isTeamMode(doc.metadata.supportedModes[0] ?? '') ? 'In team modes a team spawns on its own points; shared points are used when a team has none.' : 'Teams only matter in team modes (Team Deathmatch, Capture the Flag, King of the Hill, Elimination).'));
        // Breakthrough: a spawn group (a sector and a side), or none.
        const orders = sectorOrders(doc);
        const group = document.createElement('select');
        group.id = 'ed-spawn-group';
        group.append(new Option('None', '', false, e.sector === undefined));
        for (const n of orders.length ? orders : [1]) {
          for (const side of ['attack', 'defend'] as const) group.append(new Option(`Sector ${n}: ${side === 'attack' ? 'attackers' : 'defenders'}`, `${n}:${side}`, false, e.sector === n && e.side === side));
        }
        group.addEventListener('change', () => {
          const [n, side] = group.value.split(':');
          update('Set spawn group', group.value ? { sector: Number(n), side: side as 'attack' | 'defend' } : { sector: undefined, side: undefined });
        });
        el.append(row('Breakthrough group', group));
        el.append(small('Breakthrough: each side spawns at its group for the sector in play, and moves up (attackers) or falls back (defenders) as sectors fall. Other modes use it like any spawn point.'));
        break;
      }
      case 'sector': {
        const order = numberInput(e.order, 1, (v) => update('Set sector order', { order: Math.round(clamp(v, 1, BREAKTHROUGH_MAX_SECTORS)) }));
        order.id = 'ed-bt-order';
        el.append(row('Order', order));
        const targets = doc.entities.filter((o) => o.kind === 'objective' && o.sector === e.order && o.objective === 'target').length;
        // Kept whatever its targets are so far (set it before placing them); more than there are warns, and plays as all.
        const need = numberInput(e.need ?? targets, 1, (v) => update('Set targets needed', { need: v < 1 ? undefined : Math.round(clamp(v, 1, 32)) }));
        need.id = 'ed-bt-need';
        el.append(row('Targets to destroy', need));
        const secs = numberInput(e.seconds ?? 0, 30, (v) => update('Set sector time', { seconds: v < 30 ? undefined : Math.round(clamp(v, 30, 1800)) }));
        secs.id = 'ed-bt-seconds';
        el.append(row('Time (s, 0: the match\'s)', secs));
        const own = doc.entities.filter((o) => o.kind === 'objective' && o.sector === e.order).length;
        const groups = (['attack', 'defend'] as const).map((side) => doc.entities.filter((o) => o.kind === 'spawn' && o.sector === e.order && o.side === side).length);
        el.append(small(`Breakthrough: the attackers take the sectors in order (1, 2, 3…). The line runs across the map through this marker, square to its facing (the arrows: the way the attackers push); once the sector before falls, defenders left on the attackers' side of it have 10 s to fall back. It falls when its zones are captured and enough of its targets destroyed (${targets ? `${e.need ?? targets} of ${targets}` : 'none here'}). In it: ${own} objective${own === 1 ? '' : 's'}; ${groups[0]} attackers' and ${groups[1]} defenders' spawn point${groups[1] === 1 ? '' : 's'}.`));
        break;
      }
      case 'objective': {
        const kind = document.createElement('select');
        kind.id = 'ed-bt-kind';
        for (const k of BREAKTHROUGH_OBJECTIVES) kind.append(new Option(BREAKTHROUGH_OBJECTIVE_LABELS[k], k, false, k === e.objective));
        kind.addEventListener('change', () => update('Set objective kind', { objective: kind.value as ObjectiveEntity['objective'] }));
        el.append(row('Kind', kind));
        const orders = sectorOrders(doc);
        const sector = document.createElement('select');
        sector.id = 'ed-bt-sector';
        for (const n of orders.includes(e.sector) ? orders : [...orders, e.sector].sort((a, b) => a - b)) sector.append(new Option(`Sector ${n}`, String(n), false, n === e.sector));
        sector.addEventListener('change', () => update('Set objective sector', { sector: Number(sector.value) }));
        el.append(row('Sector', sector));
        const label = document.createElement('input');
        label.type = 'text';
        label.id = 'ed-bt-label';
        label.maxLength = 3;
        label.value = e.label;
        label.addEventListener('change', () => update('Set objective label', { label: label.value.trim().slice(0, 3) || e.label }));
        el.append(row('Label', label));
        number(e.objective === 'target' ? 'Reach (m)' : 'Radius (m)', e.radius, 0.5, (v) => ({ radius: clamp(v, 1, 20) }));
        if (e.objective !== 'target') number('Capture time (s)', e.seconds ?? (e.objective === 'final' ? 40 : 20), 5, (v) => ({ seconds: Math.round(clamp(v, 5, 300)) }));
        el.append(
          small(
            e.objective === 'target'
              ? 'Breakthrough: attackers plant a charge here (E within reach, then hold still 3 s); it goes off 20 s later unless a defender defuses it (E, hold still 5 s). The sector says how many of its targets must go.'
              : e.objective === 'final'
                ? 'Breakthrough: the last stand. A capture zone in the last sector: capturing it ends the round, the attackers winning.'
                : 'Breakthrough: attackers standing in it alone capture it (more of them quicker); a defender in it holds it (contested), and defenders alone push it back. Once captured it stays so.',
          ),
        );
        break;
      }
    }

    // Rules that mention this entity, and a shortcut to add one.
    if (e.kind !== 'spawn') {
      const rules = doc.logic.rules.filter((r) => r.when.target === e.id || r.if.some((c) => c.target === e.id) || r.do.some((a) => a.target === e.id));
      const h3 = document.createElement('h3');
      h3.textContent = 'Logic';
      el.append(h3);
      for (const r of rules) {
        const b = button(`⚙ ${r.name || r.id}`, () => this.app.logic.open(r.id));
        b.className = 'rule-link';
        el.append(b);
      }
      if (!rules.length) el.append(small('No rules use this yet.'));
      el.append(button('+ Add rule for this', () => this.app.logic.addRuleFor(e)));
    }
    el.append(small(`ID ${e.id}`));
  }
}
