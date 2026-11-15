import { aa as EVENT_INFO, ab as CONDITION_INFO, ac as ACTION_INFO, ad as entityFitsTarget, _ as isBreakableProp, j as coreCatalog, r as rotateXZ, N as yawXZ, g as getProp, S as SIDE_DIRS, B as coreMaterials, ae as withGroundAsPlayed, l as buildOccupancy, af as hasBorder, ag as borderRect, D as coreThemes, ah as SURFACE_SLOTS, t as floatingProps, n as cellKey, ai as propBoxes, aj as cellHasFloor, J as isEnvModel, a as getEnvSpecies, a8 as dynamicBlockIds, m as mapGroundBores, z as rotateSide, ak as edgeSegments, a1 as resolveEdge, al as terrainUnderFloors, am as withPathsLaid, an as cellSides } from "./settle-BDJE4VMF.js";
import { $ as MAP_FORMAT_VERSION, a0 as MAP_FORMAT, aU as LEGACY_MAP_FORMAT, P as PLAYER, y as SPRINT, aV as STANCES, aW as isMapId, aX as PLAYERS_FACTION, aY as mapFactions, aZ as rosterSize, X as mapTeams, Y as MAX_TEAMS, aI as hypot, a_ as horizontalDistance, a4 as TICK_RATE, a$ as isRetiredMount, b0 as RETIRED_MOUNT_NAMES, al as getMountDef, b1 as liveMount, b2 as carryReleaseOverRaceDrop, b3 as isCastId, a6 as isWeaponSetId, b4 as IMPROMPTU_MIN_PLAYERS, b5 as SPAWN_SHARE, W as terrainHeightAt, b6 as getItem, b7 as itemCategory, b8 as WEAPON_CATEGORY_LABELS, b9 as releaseCurrent, ba as validateTrack, bb as ziplineShapeIssues, bc as arcSentryIssues } from "./index-BAsW2uYW.js";
import { f as buildZone, S as SET_PIECE_TILE_ALIASES, a as setPieceMirrorProblem, g as SET_PIECE_GRID, b as builtInSetPieces, h as expandSetPieces, j as setPieceOverlapIssues } from "./setPieceLibrary-B87Q0Jtb.js";
import { p as propAlias, u as utf8Length, R as RESOURCE_BUDGETS, f as MapDocument, r as resourceBudgetIssues, G as GLASS_EDGES } from "./scenarioDefs-BcDISE-R.js";
const MIGRATIONS = /* @__PURE__ */ new Map([
  // v1 -> v2: tiles gained optional per-surface styles. Absent means "theme default", so v1 data is already valid.
  [1, (doc) => ({ ...doc })],
  // v2 -> v3: new `pickup` entity kind. Existing entities are unchanged.
  [2, (doc) => ({ ...doc })],
  // v3 -> v4: scenario entities (door, button, destructible, zone, trap) and the `logic` block, which defaults to empty.
  [3, (doc) => ({ ...doc })],
  // v4 -> v5: `encounter` entities and the `factions` list (defaults to empty = the built-in enemy faction).
  [4, (doc) => ({ ...doc })],
  // v5 -> v6: per-side tile edges, the trim surface slot and `prop` entities, all optional.
  [5, (doc) => ({ ...doc })],
  // v6 -> v7: optional outdoor `terrain` (absent = none).
  [6, (doc) => ({ ...doc })],
  // v7 -> v8: optional map `bounds` and `teamSetup` (absent = none).
  [7, (doc) => ({ ...doc })],
  // v8 -> v9: optional `backdrop` (absent = the theme's) and terrain `foliage` (absent = from each cell's material).
  [8, (doc) => ({ ...doc })],
  // v9 -> v10: optional `blood` settings (absent = dark red, light).
  [9, (doc) => ({ ...doc })],
  // v10 -> v11: `flag` (Capture the Flag bases) and `hill` (King of the Hill) entity kinds. Existing entities are unchanged.
  [10, (doc) => ({ ...doc })],
  // v11 -> v12: `ladder` entity kind. Existing entities are unchanged.
  [11, (doc) => ({ ...doc })],
  // v12 -> v13: `bombsite` entity kind (Bomb mode). Existing entities are unchanged.
  [12, (doc) => ({ ...doc })],
  // v13 -> v14: `hostage` and `rescue` entity kinds (Hostage mode). Existing entities are unchanged.
  [13, (doc) => ({ ...doc })],
  // v14 -> v15: `light` entity kind (lights and their fixtures). Existing entities are unchanged.
  [14, (doc) => ({ ...doc })],
  // v15 -> v16: optional room `options` on tiles (layout, floor, ceiling, corners) and three wall styles (broken, bars, shutter).
  [15, (doc) => ({ ...doc })],
  // v16 -> v17: zombies in encounter rosters (optional).
  [16, (doc) => ({ ...doc })],
  // v17 -> v18: optional race `track` (absent = none).
  [17, (doc) => ({ ...doc })],
  // v18 -> v19: `airplane` entity kind (transport plane, air drop) and an optional `skin` on mounts (absent = automatic).
  [18, (doc) => ({ ...doc })],
  // v19 -> v20: `mover` entity kind; optional light `off`/`blink`, block `pitch`/`roll`/`startHidden`, liquid `tint`,
  // and `team` on buttons, doors and zones; new logic actions and conditions. All additive: v19 data is valid as is.
  [19, (doc) => ({ ...doc })],
  // v20 -> v21: optional `onWater` on mounts (vehicles that float). Absent = sinks, as before: v20 data is valid as is.
  [20, (doc) => ({ ...doc })],
  // v21 -> v22: optional `metadata.thumbnail` (the map's picture) and `metadata.thumbnailCamera`. Additive.
  [21, (doc) => ({ ...doc })],
  // v22 -> v23: one path primitive. Paths gain `closed` (was `loop`) and `uses`; the race `track` becomes a race path.
  [22, migratePathsV23],
  // v23 -> v24: optional `random` (a weapon category) and `keepFixed` on pickups. Absent = the item as placed: additive.
  [23, (doc) => ({ ...doc })],
  // v24 -> v25: `zipline` entity kind. Existing entities are unchanged.
  [24, (doc) => ({ ...doc })],
  // v25 -> v26: optional `upperFloors` on tiles (floors added in a piece's own upper storeys). Additive.
  [25, (doc) => ({ ...doc })],
  // v26 -> v27: optional `setPieces` (placements, expanded into their parts on load) and `setPieceDefs`, the room
  // ceiling `vault`, the wall style `arch_segmental` and the facade `collegiate_stone`. Additive: v26 data is valid as is.
  [26, (doc) => ({ ...doc })],
  // v27 -> v28: optional `weaponSet` (the map's default weapon set, sim/weaponSets.ts). Absent = Standard, as every
  // map played before: v27 data is valid as is.
  [27, (doc) => ({ ...doc })],
  // v28 -> v29: Breakthrough's `sector` and `objective` entity kinds, and a spawn's optional `sector` and `side` (its
  // spawn group); a team setup of up to 48 a team and recommended players up to 96 (large maps). Additive: v28 data
  // is valid as is.
  [28, (doc) => ({ ...doc })],
  // v29 -> v30: optional `metadata.cardCamera` (the menu card shot's camera, MapMaker's Card shot). Absent = the
  // automatic camera choice, as before: v29 data is valid as is.
  [29, (doc) => ({ ...doc })],
  // v30 -> v31: optional `groups` (MapMaker's groups) and `editorNotes` (note pins for the map's makers). Absent =
  // none, as before: v30 data is valid as is.
  [30, (doc) => ({ ...doc })],
  // v31 -> v32: a terrain up to 321 vertices a side (was 161; MapMaker's Change grid) and the border style `coast`.
  // Additive: v31 data is valid as is.
  [31, (doc) => ({ ...doc })],
  // v32 -> v33: optional `botHints` (bot hints placed in MapMaker: chokepoints, sniper, camp and staging spots, jump
  // links). Absent = none, as before: v32 data is valid as is.
  [32, (doc) => ({ ...doc })],
  // v33 -> v34: optional `timeOfDay` (hours: the sun, its light and the sky blended between the presets) and `weather`
  // (rain or snow, wind, fog banks). Absent = the sky's own look and no weather, as before: v33 data is valid as is.
  [33, (doc) => ({ ...doc })],
  // v34 -> v35: optional `metadata.tier` (`core` or `experimental`: the map's place on the roster). Absent = core, as
  // every map offered before: v34 data is valid as is.
  [34, (doc) => ({ ...doc })],
  // v35 -> v36: optional `metadata.destruction` (every solid prop can break) and a prop's own `health` and
  // `unbreakable`. Absent = as before: v35 data is valid as is.
  [35, (doc) => ({ ...doc })],
  // v36 -> v37: a placed tile's optional `family` (the tunnel kit's material families: the same shape drawn in
  // another family's materials and trim). Absent = the tile's own, as before: v36 data is valid as is.
  [36, (doc) => ({ ...doc })],
  // v37 -> v38: two more wall styles a side may name, `shopfront` and `window_arched` (Tileset 11, Urban & Civilian;
  // content/tiles/edges.json). Nothing an older map says changes meaning: v37 data is valid as is. The bump is for
  // the other direction: a build that only knows v37 refuses a v38 map outright, instead of failing on a style it
  // has never heard of.
  [37, (doc) => ({ ...doc })],
  // v38 -> v39: race mode's dead settings go (race mode was removed on 2026-11-08): a track path's `race` keeps
  // its curbs, NPC cars (`ambient`, `ambientVehicle`) and pit lane, and loses `laps`, `grid`, `vehicle` and `combat`.
  [38, dropRaceSettingsV39]
]);
const DEAD_RACE_KEYS = ["laps", "grid", "vehicle", "combat"];
function dropRaceSettingsV39(doc) {
  if (!Array.isArray(doc.paths)) return { ...doc };
  const paths = doc.paths.map((p) => {
    if (!p || typeof p !== "object" || !("race" in p)) return p;
    const race = p.race;
    if (!race || typeof race !== "object") return p;
    const kept = Object.fromEntries(Object.entries(race).filter(([k]) => !DEAD_RACE_KEYS.includes(k)));
    return { ...p, race: kept };
  });
  return { ...doc, paths };
}
const V22_TRACK_DEFAULTS = { width: 12, loop: true, laps: 3, grid: 8, vehicle: "kart", combat: false, surface: "asphalt", curbs: true, ambient: 0, ambientVehicle: "kart", pit: null };
function migratePathsV23(doc) {
  const { track, ...rest } = doc;
  const old = Array.isArray(doc.paths) ? doc.paths : [];
  const paths = old.map((p) => {
    const { loop, ...keep } = p;
    return { ...keep, closed: loop === true, uses: ["road"] };
  });
  if (track && typeof track === "object") {
    const t = { ...V22_TRACK_DEFAULTS, ...track };
    const ids = new Set(paths.map((p) => p.id));
    let id = "race_track";
    for (let n = 2; ids.has(id); n++) id = `race_track_${n}`;
    paths.unshift({
      id,
      points: t.points,
      closed: t.loop,
      uses: ["road", "race"],
      width: t.width,
      style: t.surface === "dirt" ? "dirt" : "asphalt",
      lay: false,
      curve: "classic",
      race: { laps: t.laps, grid: t.grid, vehicle: t.vehicle, combat: t.combat, curbs: t.curbs, ambient: t.ambient, ambientVehicle: t.ambientVehicle, pit: t.pit }
    });
  }
  return paths.length ? { ...rest, paths } : (({ paths: _none, ...r }) => r)(rest);
}
class MapMigrationError extends Error {
}
function migrateMapDocument(raw, migrations = MIGRATIONS, targetVersion = MAP_FORMAT_VERSION) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new MapMigrationError("map document must be a JSON object");
  const obj = raw;
  if (obj.format !== MAP_FORMAT && obj.format !== LEGACY_MAP_FORMAT) throw new MapMigrationError(`not a Tile Trigger map (format=${String(obj.format)})`);
  const fromVersion = obj.formatVersion;
  if (typeof fromVersion !== "number" || !Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new MapMigrationError(`invalid formatVersion ${String(fromVersion)}`);
  }
  if (fromVersion > targetVersion) {
    throw new MapMigrationError(`map format v${fromVersion} is newer than this game supports (v${targetVersion})`);
  }
  let doc = { ...structuredClone(obj), format: MAP_FORMAT };
  for (let v = fromVersion; v < targetVersion; v++) {
    const step = migrations.get(v);
    if (!step) throw new MapMigrationError(`no migration from map format v${v}`);
    doc = { ...step(doc), formatVersion: v + 1 };
  }
  return { doc, fromVersion };
}
const BOT_HINT_SPECS = {
  choke: { label: "Chokepoint", radius: 4, facing: true, what: "A narrow way between areas (a doorway, a bridge, a gap): worth holding or pushing through. Facing: the way through." },
  sniper: { label: "Sniper spot", radius: 1.5, facing: true, what: "A long-sight spot to hold. Facing: the way to watch." },
  camp: { label: "Camp spot", radius: 1.5, facing: true, what: "A tucked-in spot to hold. Facing: the way to watch." },
  staging: { label: "Staging spot", radius: 6, facing: true, what: "Where a side gathers before a push. Facing: the way it pushes." },
  jump: { label: "Jump link", radius: 1, facing: false, what: "A jump a player can make: from its start to its landing (both on the ground)." }
};
function mapBotHints(map, kind, team) {
  const all = map.botHints ?? [];
  if (!kind && true) return all;
  return all.filter((h) => (!kind || h.kind === kind) && true);
}
const hintAt = (h) => ({ x: h.position[0], y: h.position[1], z: h.position[2] });
const hintTo = (h) => h.to ? { x: h.to[0], y: h.to[1], z: h.to[2] } : null;
const TUCK = PLAYER.height - STANCES[1].height;
const JUMP_SLACK = 1;
const DROP_HURTS = 5 + 30 / 9;
function hintJumpReach(rise, gravity = 1) {
  const g = PLAYER.gravity * Math.max(0.05, gravity);
  const v = PLAYER.jumpSpeed;
  const apex = v * v / (2 * g);
  const up = apex + TUCK;
  if (rise > up) return { up, across: 0 };
  const h = rise > apex ? rise - TUCK : rise;
  const t = (v + Math.sqrt(Math.max(0, v * v - 2 * g * h))) / g;
  return { up, across: PLAYER.runSpeed * SPRINT.speed * t + JUMP_SLACK };
}
function jumpTrouble(h, physics = null) {
  const to = hintTo(h);
  if (!to) return null;
  const from = hintAt(h);
  const across = Math.hypot(to.x - from.x, to.z - from.z);
  const rise = to.y - from.y;
  if (across < 0.75 && Math.abs(rise) < 0.75) return "its start and landing are the same spot";
  const gravity = physics?.gravity ?? 1;
  const r = hintJumpReach(rise, gravity);
  if (rise > r.up) return `its landing is ${rise.toFixed(1)} m up: a jump reaches ${r.up.toFixed(1)} m at most`;
  if (across > r.across) return `it is ${across.toFixed(1)} m across: a running jump ${rise > 0.3 ? `${rise.toFixed(1)} m up ` : rise < -0.3 ? `${(-rise).toFixed(1)} m down ` : ""}reaches about ${r.across.toFixed(1)} m`;
  if (physics?.fallDamage && -rise * gravity > DROP_HURTS) return `it drops ${(-rise).toFixed(1)} m: a fall that hurts (fall damage is on)`;
  return null;
}
const SAME_SPOT = 1;
const name = (h) => `${BOT_HINT_SPECS[h.kind].label} ${h.id}`;
function ends(h) {
  const to = hintTo(h);
  if (!to) return [{ p: hintAt(h), of: name(h) }];
  return [
    { p: hintAt(h), of: `${name(h)}'s start` },
    { p: to, of: `${name(h)}'s landing` }
  ];
}
function botHintIssues(map) {
  const hints = map.botHints ?? [];
  if (!hints.length) return [];
  const out = [];
  for (const h of hints) {
    for (const { p, of } of ends(h)) {
      if (buildZone(map, p.x, p.z) !== "play") out.push({ severity: "warning", code: "bothint.outside", message: `${of} is outside the map boundary`, targetId: h.id });
    }
    const why = h.kind === "jump" ? jumpTrouble(h, map.physics) : null;
    if (why) out.push({ severity: "warning", code: "bothint.jump", message: `${name(h)}: a player couldn't make it (${why})`, targetId: h.id });
  }
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < SAME_SPOT;
  for (let i = 0; i < hints.length; i++) {
    const a = hints[i];
    for (let j = 0; j < i; j++) {
      const b = hints[j];
      if (a.kind !== b.kind || (a.team ?? "") !== (b.team ?? "") || !near(a.position, b.position)) continue;
      if (a.to && b.to && !near(a.to, b.to)) continue;
      out.push({ severity: "warning", code: "bothint.duplicate", message: `${name(a)} is on the same spot as ${b.id}: one is enough`, targetId: a.id });
      break;
    }
  }
  return out;
}
const ON_MESH = { x: 1.2, y: 1.6, z: 1.2 };
function botHintNavIssues(map, nav) {
  const out = [];
  for (const h of map.botHints ?? []) {
    for (const { p, of } of ends(h)) {
      const at = nav.nearestPoly(p, ON_MESH);
      if (!at || Math.hypot(at.point.x - p.x, at.point.z - p.z) > ON_MESH.x) out.push({ severity: "warning", code: "bothint.offNav", message: `${of} is off the navmesh: no bot can stand there (put it on a floor or the ground)`, targetId: h.id });
    }
  }
  return out;
}
const SIDE_NAMES = { attack: "attackers'", defend: "defenders'" };
const OBJECTIVE_NAMES = { zone: "capture zone", target: "target", final: "final hold" };
function breakthroughIssues(map) {
  const sectors = map.entities.filter((e) => e.kind === "sector");
  const objectives = map.entities.filter((e) => e.kind === "objective");
  const spawns = map.entities.filter((e) => e.kind === "spawn" && (e.sector !== void 0 || e.side !== void 0));
  const listed = map.metadata.supportedModes.includes("core.breakthrough");
  if (!listed && !sectors.length && !objectives.length && !spawns.length) return [];
  const issues = [];
  const severity = listed ? "error" : "warning";
  if (!sectors.length) {
    issues.push({ severity, code: "breakthrough.no_sectors", message: "Breakthrough needs sectors: place a Sector (Entities tab, Spawns & Objectives), then its objectives and spawn groups" });
    return issues;
  }
  const orders = /* @__PURE__ */ new Map();
  for (const s of sectors) orders.set(s.order, [...orders.get(s.order) ?? [], s]);
  const top = Math.max(...orders.keys());
  for (const [order, list] of orders) {
    if (list.length > 1) issues.push({ severity, code: "breakthrough.sector_twice", message: `${list.length} sectors are number ${order}: give each its own place in the order`, targetId: list[1].id });
  }
  const gaps = Array.from({ length: top }, (_, i) => i + 1).filter((n) => !orders.has(n));
  if (gaps.length) issues.push({ severity, code: "breakthrough.order_gap", message: `the sectors' order has a gap: there is no sector ${gaps.join(", ")} (sectors go 1, 2, 3… in the order they are taken)` });
  const last = top;
  for (const [order, list] of [...orders].sort((a, b) => a[0] - b[0])) {
    const s = list[0];
    const name2 = s.name ? `Sector ${order} (${s.name})` : `Sector ${order}`;
    const own = objectives.filter((o) => o.sector === order);
    if (!own.length) issues.push({ severity, code: "breakthrough.no_objectives", message: `${name2} has no objectives: place a Capture Zone, Destroy Target or Final Hold in it`, targetId: s.id });
    for (const side of ["attack", "defend"]) {
      if (!spawns.some((p) => p.sector === order && p.side === side)) issues.push({ severity, code: "breakthrough.no_spawns", message: `${name2} has no ${SIDE_NAMES[side]} spawn group: place ${side === "attack" ? "Attackers'" : "Defenders'"} Spawns for it`, targetId: s.id });
    }
    const targets = own.filter((o) => o.objective === "target").length;
    if (s.need !== void 0 && s.need > targets) issues.push({ severity: "warning", code: "breakthrough.need", message: `${name2} needs ${s.need} of its targets destroyed but has ${targets}: it falls once all ${targets} are`, targetId: s.id });
    if (s.need !== void 0 && !targets) issues.push({ severity: "warning", code: "breakthrough.need", message: `${name2} counts targets to destroy but has none`, targetId: s.id });
  }
  for (const o of objectives) {
    const what = `${OBJECTIVE_NAMES[o.objective]} ${o.label}`;
    if (!orders.has(o.sector)) issues.push({ severity, code: "breakthrough.objective_sector", message: `${what} is in sector ${o.sector}, and there is no sector ${o.sector}`, targetId: o.id });
    else if (o.objective === "final" && o.sector !== last) issues.push({ severity: "warning", code: "breakthrough.final_early", message: `${what} ends the round but is in sector ${o.sector}, not the last (${last}): it plays as a capture zone there`, targetId: o.id });
  }
  for (const p of spawns) {
    if (p.sector === void 0 || !p.side) issues.push({ severity: "warning", code: "breakthrough.spawn_half", message: `spawn ${p.id} has a ${p.sector === void 0 ? "side but no sector" : "sector but no side"}: Breakthrough leaves it out of the spawn groups`, targetId: p.id });
    else if (!orders.has(p.sector)) issues.push({ severity: "warning", code: "breakthrough.spawn_sector", message: `spawn ${p.id} is in the ${SIDE_NAMES[p.side]} group of sector ${p.sector}, and there is no sector ${p.sector}`, targetId: p.id });
  }
  return issues;
}
const KIND_LABEL = {
  door: "door",
  button: "button",
  destructible: "destructible, block or breakable prop",
  zone: "zone",
  trap: "trap",
  pickup: "pickup",
  encounter: "encounter",
  toggleable: "button, zone, trap, pickup, block, mover, light or portal",
  light: "light",
  block: "block",
  mover: "mover",
  variable: "variable",
  timer: "timer",
  objective: "objective"
};
function validateScenario(map) {
  const issues = [];
  const { logic } = map;
  const entities = new Map(map.entities.map((e) => [e.id, e]));
  const ids = new Set(map.entities.map((e) => e.id));
  for (const item of [...logic.variables, ...logic.timers, ...logic.objectives, ...logic.rules]) {
    if (ids.has(item.id)) issues.push({ severity: "error", code: "id.duplicate", message: `duplicate ID "${item.id}" in logic`, targetId: item.id });
    ids.add(item.id);
  }
  const lists = {
    variable: new Set(logic.variables.map((v) => v.id)),
    timer: new Set(logic.timers.map((t) => t.id)),
    objective: new Set(logic.objectives.map((o) => o.id))
  };
  const matches = (id, kind) => {
    if (kind === "variable" || kind === "timer" || kind === "objective") return lists[kind].has(id);
    const e = entities.get(id);
    if (!e) return false;
    return entityFitsTarget(e.kind, kind, isBreakableProp(e, !!map.metadata.destruction));
  };
  const checkTarget = (ruleId, ruleName, where, target, kind) => {
    if (!kind) return;
    if (target === null) {
      issues.push({ severity: "warning", code: "logic.target_missing", message: `rule "${ruleName}": ${where} needs a ${KIND_LABEL[kind]}`, targetId: ruleId });
    } else if (!matches(target, kind)) {
      issues.push({ severity: "warning", code: "logic.target_broken", message: `rule "${ruleName}": ${where} refers to a missing ${KIND_LABEL[kind]} (${target})`, targetId: ruleId });
    }
  };
  const used = { buttons: /* @__PURE__ */ new Set(), zones: /* @__PURE__ */ new Set(), unlocked: /* @__PURE__ */ new Set(), fired: /* @__PURE__ */ new Set(), completed: /* @__PURE__ */ new Set(), dropped: /* @__PURE__ */ new Set(), shown: /* @__PURE__ */ new Set(), sent: /* @__PURE__ */ new Set() };
  for (const rule of logic.rules) {
    const name2 = rule.name || rule.id;
    const when = EVENT_INFO[rule.when.event];
    checkTarget(rule.id, name2, `WHEN "${when.label}"`, rule.when.target, when.target);
    if (rule.when.event === "button_pressed" && rule.when.target) used.buttons.add(rule.when.target);
    if ((rule.when.event === "zone_enter" || rule.when.event === "zone_exit") && rule.when.target) used.zones.add(rule.when.target);
    for (const c of rule.if) {
      const info = CONDITION_INFO[c.type];
      checkTarget(rule.id, name2, `IF "${info.label}"`, c.target, info.target);
      if (info.states && !info.states.includes(c.state)) {
        issues.push({ severity: "warning", code: "logic.state", message: `rule "${name2}": IF "${info.label}" needs one of ${info.states.join(", ")}`, targetId: rule.id });
      }
      if (c.type === "zone_count" && c.target) used.zones.add(c.target);
    }
    if (rule.do.length === 0) issues.push({ severity: "warning", code: "logic.no_actions", message: `rule "${name2}" does nothing yet (add a DO action)`, targetId: rule.id });
    for (const a of rule.do) {
      const info = ACTION_INFO[a.type];
      checkTarget(rule.id, name2, `DO "${info.label}"`, a.target, info.target);
      if (info.states && a.state && !info.states.includes(a.state)) {
        issues.push({ severity: "warning", code: "logic.state", message: `rule "${name2}": DO "${info.label}" needs one of ${info.states.join(", ")}`, targetId: rule.id });
      }
      if (a.type === "next_map" && !isMapId(a.text.trim())) issues.push({ severity: "warning", code: "logic.next_map", message: `rule "${name2}": "Next map" needs a map ID from our suite (like creature_lab)`, targetId: rule.id });
      if (a.type === "message" && !a.text.trim()) issues.push({ severity: "warning", code: "logic.empty_message", message: `rule "${name2}": message is empty`, targetId: rule.id });
      if ((a.type === "door_unlock" || a.type === "door_open" || a.type === "door_toggle") && a.target) used.unlocked.add(a.target);
      if ((a.type === "trap_fire" || a.type === "enable") && a.target) used.fired.add(a.target);
      if (a.type === "objective" && a.state === "complete" && a.target) used.completed.add(a.target);
      if ((a.type === "destroy" || a.type === "block_drop" || a.type === "disable") && a.target) used.dropped.add(a.target);
      if ((a.type === "block_restore" || a.type === "enable") && a.target) used.shown.add(a.target);
      if ((a.type === "mover_go" || a.type === "mover_to") && a.target) used.sent.add(a.target);
      if (a.type === "light_color" && a.text.trim() && !/^#[0-9a-fA-F]{6}$/.test(a.text.trim())) {
        issues.push({ severity: "warning", code: "logic.color", message: `rule "${name2}": "Set light colour" needs a colour like #ff2020 (or nothing for the light's own)`, targetId: rule.id });
      }
      const mover = a.target ? entities.get(a.target) : void 0;
      if (a.type === "mover_to" && mover?.kind === "mover" && (a.value < 1 || a.value > mover.points.length || !Number.isInteger(a.value))) {
        issues.push({ severity: "warning", code: "logic.mover_point", message: `rule "${name2}": mover ${mover.id} has points 1 to ${mover.points.length}, not ${a.value}`, targetId: rule.id });
      }
    }
  }
  issues.push(...undoingRules(logic.rules));
  for (const o of logic.objectives) {
    if (o.marker && !entities.has(o.marker)) issues.push({ severity: "warning", code: "logic.marker", message: `objective "${o.text}" points at a missing object`, targetId: o.id });
    if (!used.completed.has(o.id)) issues.push({ severity: "suggestion", code: "logic.objective_never_completes", message: `objective "${o.text}" is never completed by a rule`, targetId: o.id });
  }
  const factionIds = /* @__PURE__ */ new Set([PLAYERS_FACTION, ...mapFactions(map).map((f) => f.id)]);
  for (const f of map.factions) {
    for (const other of Object.keys(f.relations)) {
      if (!factionIds.has(other)) issues.push({ severity: "warning", code: "faction.unknown", message: `faction "${f.name}" has a relation with unknown faction "${other}"` });
    }
  }
  for (const e of map.entities) {
    if (e.kind !== "encounter") continue;
    if (!factionIds.has(e.faction) || e.faction === PLAYERS_FACTION) issues.push({ severity: "error", code: "encounter.faction", message: `encounter ${e.id} uses unknown faction "${e.faction}"`, targetId: e.id });
    if (rosterSize(e.roster) === 0) issues.push({ severity: "warning", code: "encounter.empty", message: `encounter ${e.id} has nobody in its squad`, targetId: e.id });
    const route = e.route ? map.paths?.find((p) => p.id === e.route) : void 0;
    if (e.route && !route) issues.push({ severity: "warning", code: "encounter.route", message: `encounter ${e.id} patrols route "${e.route}", which the map doesn't have`, targetId: e.id });
    if ((e.order === "defend" || e.order === "patrol" && !route) && (!e.orderTarget || !entities.has(e.orderTarget))) {
      issues.push({ severity: "warning", code: "encounter.target", message: `encounter ${e.id} is ordered to ${e.order} but has no ${e.order === "patrol" ? "route or " : ""}target object`, targetId: e.id });
    }
  }
  if (map.metadata.supportedModes[0] === "core.coop" && !map.entities.some((e) => e.kind === "encounter")) {
    issues.push({ severity: "suggestion", code: "coop.no_enemies", message: "co-op map has no NPC encounters to fight" });
  }
  if (map.metadata.supportedModes[0] === "core.tdm") {
    const teams = mapTeams(map);
    const spawns = map.entities.filter((e) => e.kind === "spawn");
    const anyTeam = mapTeams(map, MAX_TEAMS);
    for (const sp of spawns) {
      if (sp.faction !== null && !anyTeam.some((t) => t.id === sp.faction)) {
        issues.push({ severity: "warning", code: "tdm.spawn_team", message: `spawn ${sp.id} belongs to "${sp.faction}", which is not a team`, targetId: sp.id });
      }
    }
    const counts = teams.map((t) => spawns.filter((sp) => sp.faction === t.id).length);
    if (counts.some((n) => n > 0) && counts.some((n) => n === 0)) {
      const missing = teams[counts.indexOf(0)];
      issues.push({ severity: "warning", code: "tdm.spawn_missing", message: `${missing.name} has no spawn points of its own; it will use the shared ones` });
    }
  }
  const flags = map.entities.filter((e) => e.kind === "flag");
  const ctfTeams = mapTeams(map, 2);
  if (map.metadata.supportedModes.includes("core.ctf") || map.metadata.supportedModes.includes("core.forts") || flags.length) {
    const listed = map.metadata.supportedModes.includes("core.ctf") || map.metadata.supportedModes.includes("core.forts");
    for (const t of ctfTeams) {
      const n = flags.filter((f) => f.team === t.id).length;
      if (n === 0) issues.push({ severity: listed ? "error" : "warning", code: "ctf.flag_missing", message: `Capture the Flag needs a flag base for ${t.name}` });
      else if (n > 1) issues.push({ severity: "warning", code: "ctf.flag_extra", message: `${t.name} has ${n} flag bases; only the first is used` });
    }
    for (const f of flags) {
      if (!ctfTeams.some((t) => t.id === f.team)) issues.push({ severity: "warning", code: "ctf.flag_team", message: `flag base ${f.id} belongs to "${f.team}", which is not one of the two teams`, targetId: f.id });
    }
    if (flags.length >= 2) {
      const [a, b] = ctfTeams.map((t) => flags.find((f) => f.team === t.id));
      if (a && b && Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]) < 16) issues.push({ severity: "suggestion", code: "ctf.flags_close", message: "the two flag bases are less than 16 m apart" });
    }
  }
  if (map.metadata.supportedModes.includes("core.koth") && !map.entities.some((e) => e.kind === "hill")) {
    issues.push({ severity: "error", code: "koth.no_hill", message: "King of the Hill needs at least one hill" });
  }
  issues.push(...breakthroughIssues(map));
  const sides = /* @__PURE__ */ new Set([PLAYERS_FACTION, ...mapTeams(map, MAX_TEAMS).map((t) => t.id), ...mapFactions(map).map((f) => f.id)]);
  const carriedBy = /* @__PURE__ */ new Map();
  for (const e of map.entities) {
    if ((e.kind === "button" || e.kind === "door" || e.kind === "zone") && e.team && !sides.has(e.team)) {
      issues.push({ severity: "warning", code: "team.unknown", message: `${e.kind} ${e.id} is for team "${e.team}", which is not a team or faction of this map`, targetId: e.id });
    }
    if (e.kind !== "mover") continue;
    for (const id of e.blocks) {
      const b = entities.get(id);
      if (b?.kind !== "block") issues.push({ severity: "warning", code: "mover.block", message: `mover ${e.id} carries a missing block (${id})`, targetId: e.id });
      else if (carriedBy.has(id)) issues.push({ severity: "error", code: "mover.shared_block", message: `block ${id} is carried by two movers (${carriedBy.get(id)} and ${e.id})`, targetId: e.id });
      else carriedBy.set(id, e.id);
    }
    for (const id of e.props ?? []) {
      const p = entities.get(id);
      if (p?.kind !== "prop") issues.push({ severity: "warning", code: "mover.prop", message: `mover ${e.id} carries a missing prop (${id})`, targetId: e.id });
      else if (carriedBy.has(id)) issues.push({ severity: "error", code: "mover.shared_prop", message: `prop ${id} is carried by two movers (${carriedBy.get(id)} and ${e.id})`, targetId: e.id });
      else if (p.solid) issues.push({ severity: "error", code: "mover.solid_prop", message: `mover ${e.id} carries prop ${id}, which is solid: carried props never collide, so untick Solid (its blocks are what you stand on)`, targetId: e.id });
      else carriedBy.set(id, e.id);
    }
    if ((e.angles?.length ?? 0) > e.points.length) issues.push({ severity: "warning", code: "mover.angles", message: `mover ${e.id} has more angles than points; the extra ones are ignored`, targetId: e.id });
    if (e.mode === "trigger" && !used.sent.has(e.id)) issues.push({ severity: "warning", code: "mover.never_moves", message: `mover ${e.id} only moves when logic sends it, but no rule does`, targetId: e.id });
  }
  const pairs = /* @__PURE__ */ new Map();
  for (const e of map.entities) if (e.kind === "portal") pairs.set(e.pair, [...pairs.get(e.pair) ?? [], e]);
  for (const [pair, list] of pairs) {
    const first = list[0];
    if (list.length === 1) issues.push({ severity: "warning", code: "portal.unpaired", message: `portal ${first.id} has no other end (pair "${pair}"): place a second portal with the same pair`, targetId: first.id });
    else if (list.length > 2) issues.push({ severity: "error", code: "portal.pair_crowded", message: `pair "${pair}" has ${list.length} portals; a pair links exactly two`, targetId: list[2].id });
    else {
      const [a, b] = list;
      if (Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]) < Math.max(a.size[0], b.size[0]) + 1) {
        issues.push({ severity: "warning", code: "portal.too_close", message: `portals ${a.id} and ${b.id} (pair "${pair}") are on top of each other`, targetId: b.id });
      }
    }
    for (const e of list) {
      if (!e.startEnabled && !used.shown.has(e.id)) issues.push({ severity: "warning", code: "portal.never_opens", message: `portal ${e.id} starts off and no rule ever enables it`, targetId: e.id });
    }
  }
  for (const e of map.entities) {
    if (e.kind === "block" && (e.behaviour === "crumble" || e.behaviour === "trapdoor") && e.trigger === "logic" && !used.dropped.has(e.id)) {
      issues.push({ severity: "warning", code: "block.never_drops", message: `block ${e.id} only gives way from logic, but no rule drops it`, targetId: e.id });
    } else if (e.kind === "block" && e.startHidden && !used.shown.has(e.id)) {
      issues.push({ severity: "warning", code: "block.never_appears", message: `block ${e.id} starts hidden and no rule ever rebuilds or enables it`, targetId: e.id });
    } else if (e.kind === "button" && !used.buttons.has(e.id)) {
      issues.push({ severity: "warning", code: "button.unused", message: `button ${e.id} does nothing (no rule uses it)`, targetId: e.id });
    } else if (e.kind === "zone" && !used.zones.has(e.id) && e.gravity === void 0) {
      issues.push({ severity: "suggestion", code: "zone.unused", message: `zone ${e.id} isn't used by any rule`, targetId: e.id });
    } else if (e.kind === "door" && e.locked && !e.startOpen && !used.unlocked.has(e.id)) {
      issues.push({ severity: "warning", code: "door.never_opens", message: `door ${e.id} is locked and no rule ever unlocks or opens it`, targetId: e.id });
    } else if (e.kind === "trap" && e.trap !== "mine" && e.activation === "logic" && !used.fired.has(e.id)) {
      issues.push({ severity: "warning", code: "trap.never_fires", message: `trap ${e.id} only fires from logic, but no rule fires it`, targetId: e.id });
    }
  }
  return issues;
}
const UNDOES = {
  door_open: "door_close",
  door_close: "door_open",
  door_lock: "door_unlock",
  door_unlock: "door_lock",
  enable: "disable",
  disable: "enable",
  light_on: "light_off",
  light_off: "light_on"
};
const ACTION_STATE = {
  door_open: "door",
  door_close: "door",
  door_toggle: "door",
  door_lock: "door",
  door_unlock: "door",
  enable: "enabled",
  disable: "enabled",
  light_on: "light",
  light_off: "light",
  light_toggle: "light",
  set_var: "variable",
  add_var: "variable",
  objective: "objective",
  block_drop: "block",
  block_restore: "block",
  mover_go: "mover",
  mover_to: "mover"
};
const CONDITION_STATE = { door: "door", enabled: "enabled", light: "light", variable: "variable", objective: "objective", block: "block", mover_at: "mover" };
function undoingRules(rules) {
  const issues = [];
  const byEvent = /* @__PURE__ */ new Map();
  for (const r of rules) {
    if (!r.enabled) continue;
    const k = `${r.when.event}|${r.when.target ?? ""}`;
    const list = byEvent.get(k);
    if (list) list.push(r);
    else byEvent.set(k, [r]);
  }
  for (const list of byEvent.values()) {
    if (list.length < 2) continue;
    const now = list.map((r) => {
      const out = [];
      for (const a of r.do) {
        if (a.type === "wait") break;
        if (a.target && UNDOES[a.type]) out.push(a);
      }
      return out;
    });
    const writes = list.map((r) => {
      const out = /* @__PURE__ */ new Set();
      for (const a of r.do) {
        if (a.type === "wait") break;
        const k = a.target ? ACTION_STATE[a.type] : void 0;
        if (k) out.add(`${k}:${a.target}`);
      }
      return out;
    });
    for (let j = 1; j < list.length; j++) {
      const reads = list[j].if.map((c) => c.target && CONDITION_STATE[c.type] ? `${CONDITION_STATE[c.type]}:${c.target}` : "").filter(Boolean);
      for (let i = 0; i < j; i++) {
        if (reads.length && !reads.some((k) => writes[i].has(k))) continue;
        const b = now[j].find((x) => now[i].some((a2) => a2.target === x.target && UNDOES[a2.type] === x.type));
        if (!b) continue;
        const a = now[i].find((x) => x.target === b.target && UNDOES[x.type] === b.type);
        const first = list[i].name || list[i].id;
        const second = list[j].name || list[j].id;
        issues.push({
          severity: "warning",
          code: "logic.undoes",
          message: `rules "${first}" and "${second}" run one after the other on the same event: "${ACTION_INFO[b.type].label}" (${b.target}) undoes "${ACTION_INFO[a.type].label}" straight away, so nothing changes. To switch something back and forth use one rule (Toggle door, Toggle light), or react to "Door opened" / "Door closed"`,
          targetId: list[j].id
        });
        break;
      }
    }
  }
  return issues;
}
function airRoute(e) {
  const points = e.route.map(([dx, dz]) => ({ x: e.position[0] + dx, z: e.position[2] + dz }));
  const legs = e.closed ? points.length : points.length - 1;
  const at = [0];
  let length = 0;
  for (let i = 0; i < legs; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    length += hypot(b.x - a.x, b.z - a.z);
    at.push(length);
  }
  return { points, y: e.position[1] + e.altitude, loopSeconds: e.loopSeconds, closed: e.closed, at, length: Math.max(length, 1e-6) };
}
const routeSpeed = (r) => r.length / r.loopSeconds;
const routePhase = (r, tick) => tick / TICK_RATE % r.loopSeconds / r.loopSeconds;
function routePose(r, tick) {
  const phase = routePhase(r, tick);
  const d = phase * r.length;
  let i = 0;
  while (i < r.at.length - 2 && r.at[i + 1] < d) i++;
  const a = r.points[i];
  const b = r.points[(i + 1) % r.points.length];
  const leg = Math.max(1e-6, r.at[i + 1] - r.at[i]);
  const t = Math.min(1, (d - r.at[i]) / leg);
  const pos = { x: a.x + (b.x - a.x) * t, y: r.y, z: a.z + (b.z - a.z) * t };
  let yaw = Math.atan2(b.x - a.x, b.z - a.z);
  const turnIn = Math.min(12, leg / 3);
  const left = leg - (d - r.at[i]);
  const next = r.points[(i + 2) % r.points.length];
  if (left < turnIn && (r.closed || i + 2 < r.points.length)) {
    const yaw2 = Math.atan2(next.x - b.x, next.z - b.z);
    const k = (1 - left / turnIn) * 0.5;
    yaw += Math.atan2(Math.sin(yaw2 - yaw), Math.cos(yaw2 - yaw)) * k;
  }
  const speed = routeSpeed(r);
  return { pos, yaw, vel: { x: Math.sin(yaw) * speed, z: Math.cos(yaw) * speed }, phase };
}
function ticksToRouteEnd(r, tick) {
  if (r.closed) return Infinity;
  return Math.round((1 - routePhase(r, tick)) * r.loopSeconds * TICK_RATE);
}
const routeDistance = (r, tick) => routePhase(r, tick) * r.length;
function routePointAt(r, d) {
  const t = (d % r.length + r.length) % r.length;
  let i = 0;
  while (i < r.at.length - 2 && r.at[i + 1] < t) i++;
  const a = r.points[i];
  const b = r.points[(i + 1) % r.points.length];
  const k = Math.min(1, Math.max(0, (t - r.at[i]) / Math.max(1e-6, r.at[i + 1] - r.at[i])));
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
}
const dropStep = (r) => Math.max(4, routeSpeed(r) / TICK_RATE * 1.5);
const JUMP_CARRY_SECONDS = 2.5;
function dropOffsets(r, halfLength) {
  const exit = -(halfLength + 1);
  return [exit, Math.max(exit, exit + routeSpeed(r) * 0.5 * JUMP_CARRY_SECONDS)];
}
function dropPlan(r, land, reach = () => true, offsets = [0]) {
  const step = dropStep(r);
  const n = Math.max(1, Math.ceil(r.length / step));
  const ok = [];
  const bot = [];
  const at = (d) => routePointAt(r, r.closed ? d : Math.max(0, Math.min(r.length, d)));
  for (let i = 0; i < n; i++) {
    const d = Math.min(r.length, (i + 0.5) * step);
    const good = offsets.every((o) => {
      const p2 = at(d + o);
      return land(p2.x, p2.z);
    });
    ok.push(good);
    const p = at(d + offsets[offsets.length - 1]);
    bot.push(good && reach(p.x, p.z));
  }
  return { step, ok, bot, any: ok.some(Boolean) };
}
const dropIndex = (plan, r, tick) => Math.min(plan.ok.length - 1, Math.floor(routeDistance(r, tick) / plan.step));
const canDrop = (plan, r, tick) => !plan.any || plan.ok[dropIndex(plan, r, tick)];
function dropStretchEnds(plan, r, tick) {
  if (!plan.any || !canDrop(plan, r, tick)) return false;
  if (ticksToRouteEnd(r, tick) <= 1) return true;
  return !canDrop(plan, r, tick + 1);
}
function botDropIndex(plan, r, target, landOffset = 0, pick = 0, spread = 12) {
  const dist = [];
  plan.bot.forEach((good, i) => {
    if (!good) return;
    const along = Math.min(r.length, (i + 0.5) * plan.step) + landOffset;
    const p = routePointAt(r, r.closed ? along : Math.max(0, Math.min(r.length, along)));
    dist.push({ i, d: hypot(p.x - target.x, p.z - target.z) });
  });
  if (!dist.length) return -1;
  const best = Math.min(...dist.map((x) => x.d));
  const near = dist.filter((x) => x.d <= best + spread);
  return near[Math.min(near.length - 1, Math.floor(pick * near.length))].i;
}
function dropArea(map, margin = DROP_MARGIN) {
  let a = null;
  if (map.bounds) a = { x0: map.bounds.min[0], z0: map.bounds.min[1], x1: map.bounds.max[0], z1: map.bounds.max[1] };
  else {
    const { cellSize } = map.classicStructure;
    const grow = (x0, z0, x1, z1) => {
      a = a ? { x0: Math.min(a.x0, x0), z0: Math.min(a.z0, z0), x1: Math.max(a.x1, x1), z1: Math.max(a.z1, z1) } : { x0, z0, x1, z1 };
    };
    for (const t2 of map.classicStructure.tiles) grow(t2.x * cellSize - cellSize / 2, t2.y * cellSize - cellSize / 2, t2.x * cellSize + cellSize / 2, t2.y * cellSize + cellSize / 2);
    const t = map.terrain;
    if (t) grow(t.origin[0], t.origin[1], t.origin[0] + (t.cols - 1) * t.spacing, t.origin[1] + (t.rows - 1) * t.spacing);
  }
  if (!a) return null;
  const r = a;
  const mx = Math.min(margin, (r.x1 - r.x0) / 4);
  const mz = Math.min(margin, (r.z1 - r.z0) / 4);
  return { x0: r.x0 + mx, z0: r.z0 + mz, x1: r.x1 - mx, z1: r.z1 - mz };
}
const DROP_MARGIN = 3;
function mapAirplanes(map) {
  const out = [];
  map.entities.forEach((e, index) => {
    if (e.kind === "airplane") out.push({ index, entity: e });
  });
  return out;
}
function dropTarget(map, team, pick, mode = "") {
  const p = (e) => ({ x: e.position[0], y: e.position[1], z: e.position[2] });
  const first = Math.min(...map.entities.flatMap((e) => e.kind === "sector" ? [e.order] : []));
  const objectives = map.entities.filter((e) => mode === "core.ctf" && e.kind === "flag" && e.team !== team || mode === "core.koth" && e.kind === "hill" || mode === "core.bomb" && e.kind === "bombsite" || mode === "core.breakthrough" && e.kind === "objective" && e.sector === first);
  if (objectives.length) return p(objectives[Math.floor(pick * objectives.length) % objectives.length]);
  const spawns = map.entities.filter((e) => e.kind === "spawn");
  const own = spawns.filter((e) => e.kind === "spawn" && team !== null && e.faction === team);
  const from = own.length ? own : spawns;
  if (from.length) return p(from[Math.floor(pick * from.length) % from.length]);
  return { x: 0, y: 0, z: 0 };
}
function shouldJump(planePos, target, prev, ticksLeft) {
  const dist = horizontalDistance(planePos, target);
  const passing = prev !== void 0 && dist > prev + 0.01 && dist < 60;
  return { jump: dist < 18 || passing || ticksLeft < TICK_RATE * 2, dist };
}
function airplaneIssues(map, groundAt) {
  const out = [];
  const { cellSize, levelHeight } = map.classicStructure;
  const roofs = /* @__PURE__ */ new Map();
  for (const t of map.classicStructure.tiles) {
    const k = `${t.x},${t.y}`;
    roofs.set(k, Math.max(roofs.get(k) ?? -Infinity, (t.z + 1) * levelHeight));
  }
  const builtAt = (x, z) => roofs.get(`${Math.round(x / cellSize)},${Math.round(z / cellSize)}`) ?? -Infinity;
  for (const { entity: e } of mapAirplanes(map)) {
    const r = airRoute(e);
    const legs = r.at.slice(1).map((d, i) => d - r.at[i]);
    if (legs.some((l) => l < 10)) {
      out.push({ severity: "error", code: "airplane.route", message: `drop carrier ${e.id}: route points closer than 10 m (each leg needs room to fly)`, targetId: e.id });
      continue;
    }
    const speed = routeSpeed(r);
    if (speed < 8 || speed > 90) out.push({ severity: "warning", code: "airplane.speed", message: `drop carrier ${e.id} flies at ${Math.round(speed)} m/s (keep it 8-90: change the lap time)`, targetId: e.id });
    let lowest = Infinity;
    for (let i = 0; i < r.points.length - (r.closed ? 0 : 1); i++) {
      const a = r.points[i];
      const b = r.points[(i + 1) % r.points.length];
      const steps = Math.max(1, Math.ceil(hypot(b.x - a.x, b.z - a.z) / 8));
      for (let k = 0; k <= steps; k++) {
        const x = a.x + (b.x - a.x) * k / steps;
        const z = a.z + (b.z - a.z) * k / steps;
        lowest = Math.min(lowest, r.y - Math.max(groundAt(x, z) ?? -Infinity, builtAt(x, z), e.position[1]));
      }
    }
    if (lowest < 12) out.push({ severity: "warning", code: "airplane.low", message: `drop carrier ${e.id} passes ${Math.max(0, Math.round(lowest))} m over the ground or buildings (fly it at least 12 m up, 40+ for a parachute drop)`, targetId: e.id });
    const area = dropArea(map);
    if (area && e.airdrop !== "off") {
      const plan = dropPlan(r, (x, z) => x >= area.x0 && x <= area.x1 && z >= area.z0 && z <= area.z1);
      if (!plan.any) out.push({ severity: "warning", code: "airplane.nodrop", message: `${e.craft === "dropship" ? "dropship" : "drop carrier"} ${e.id} never flies over the play area: its riders can't jump out anywhere (draw some of its route over the map)`, targetId: e.id });
    }
  }
  return out;
}
const TILE_ALIASES = /* @__PURE__ */ new Map(SET_PIECE_TILE_ALIASES.map((a) => [a.tile, a.piece]));
function placementId(tileId, taken) {
  let base = tileId.length <= 48 ? tileId : `${tileId.slice(0, 39)}_${hash(tileId)}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base.slice(0, 44)}_${n}`;
  taken.add(id);
  return id;
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36).padStart(7, "0").slice(0, 8);
}
function placementsForTiles(doc, tiles, piece) {
  const replaced = new Set(tiles.map((t) => t.id));
  const taken = /* @__PURE__ */ new Set([...doc.classicStructure.tiles.filter((t) => !replaced.has(t.id)).map((t) => t.id), ...doc.entities.map((e) => e.id), ...(doc.setPieces ?? []).map((p) => p.id)]);
  const out = [];
  for (const t of tiles) {
    const to = piece ?? TILE_ALIASES.get(t.tile);
    if (!to) continue;
    out.push({ id: placementId(t.id, taken), piece: to, x: t.x, y: t.y, z: t.z, rotation: t.rotation, mirror: false });
  }
  return out;
}
function withTileAliases(doc) {
  const old = doc.classicStructure.tiles.filter((t) => TILE_ALIASES.has(t.tile));
  if (!old.length) return doc;
  const gone = new Set(old.map((t) => t.id));
  return {
    ...doc,
    classicStructure: { ...doc.classicStructure, tiles: doc.classicStructure.tiles.filter((t) => !gone.has(t.id)) },
    setPieces: [...doc.setPieces ?? [], ...placementsForTiles(doc, old)]
  };
}
function aliasedProp(e) {
  if (e.kind !== "prop") return e;
  const a = propAlias(e.model);
  if (!a) return e;
  const scale = Math.min(4, Math.max(0.25, Math.round(e.scale * a.scale * 1e4) / 1e4));
  return { ...e, model: a.model, variant: a.variant, scale };
}
function withPropAliases(doc) {
  if (!doc.entities.some((e) => e.kind === "prop" && propAlias(e.model))) return doc;
  return { ...doc, entities: doc.entities.map(aliasedProp) };
}
function aliasedMount(e) {
  return e.kind === "mount" && isRetiredMount(e.model) ? { ...e, model: liveMount(e.model) } : e;
}
function aliasedPath(p) {
  const r = p.race;
  if (!r || !isRetiredMount(r.ambientVehicle)) return p;
  return { ...p, race: { ...r, ambientVehicle: liveMount(r.ambientVehicle) } };
}
function retiredMountUses(doc) {
  const by = /* @__PURE__ */ new Map();
  const of = (model) => by.get(model) ?? (by.set(model, { model, entities: [], paths: [] }), by.get(model));
  for (const e of doc.entities) if (e.kind === "mount" && isRetiredMount(e.model)) of(e.model).entities.push(e.id);
  for (const p of doc.paths ?? []) if (isRetiredMount(p.race?.ambientVehicle)) of(p.race.ambientVehicle).paths.push(p.id);
  return [...by.values()];
}
function withMountAliases(doc) {
  if (!retiredMountUses(doc).length) return doc;
  return { ...doc, entities: doc.entities.map(aliasedMount), ...doc.paths ? { paths: doc.paths.map(aliasedPath) } : {} };
}
function retiredMountIssues(doc) {
  return retiredMountUses(doc).map((u) => {
    const where = [u.entities.length ? `${u.entities.length} placed` : "", u.paths.length ? `the track's cars (${u.paths.join(", ")})` : ""].filter(Boolean).join(" and ");
    const first = u.entities[0];
    return { severity: "warning", code: "mount.retired", message: `the ${RETIRED_MOUNT_NAMES[u.model]} is retired (${where}): it plays as the ${getMountDef(u.model).displayName}. Replace all (the vehicle's inspector, or the track's pane) to keep that in the map`, ...first ? { targetId: first } : {} };
  });
}
const EDGE = 1e-6;
function checkSetPieceDefinition(def, opts = {}) {
  const catalog = opts.catalog ?? coreCatalog;
  const out = [];
  const { cellSize, levelHeight } = SET_PIECE_GRID;
  const cells = new Set(def.footprint.cells.map(([x, y]) => `${x},${y}`));
  if (cells.size !== def.footprint.cells.length) out.push("footprint: a cell is listed twice");
  const [l0, l1] = def.footprint.levels;
  if (l0 > l1) out.push(`footprint: levels [${l0}, ${l1}] go from the lowest to the highest`);
  const inCell = (x, y, z) => cells.has(`${x},${y}`) && z >= l0 && z <= l1;
  const inside = (px, py, pz) => {
    if (py < l0 * levelHeight - EDGE || py > (l1 + 1) * levelHeight + EDGE) return false;
    const near = (v) => [Math.floor((v + cellSize / 2 + EDGE) / cellSize), Math.floor((v + cellSize / 2 - EDGE) / cellSize)];
    return near(px).some((cx) => near(pz).some((cy) => cells.has(`${cx},${cy}`)));
  };
  for (const pack of def.packs) if (opts.packs && !opts.packs.has(pack)) out.push(`packs: ${pack} is not a role pack (content/setpieces/roles.json)`);
  const material = (m, where) => {
    if (!coreMaterials.get(m)) out.push(`${where}: ${m} is not a material (content/materials.json)`);
  };
  for (const [role, v] of Object.entries(def.roles ?? {})) if (v && typeof v === "object") material(v.material, `roles.${role}`);
  def.parts.forEach((part, i) => {
    const where = `parts[${i}] (${part.kind})`;
    if (part.kind === "tile") {
      const t = catalog.get(part.tile);
      if (!t) {
        out.push(`${where}: ${part.tile} is not a tile`);
        return;
      }
      const own = new Set(t.cells.map((c) => `${c[0]},${c[1]},${c[2]}`));
      for (const [dx, dy, dz] of t.cells) {
        const [rx, ry] = rotateXZ(dx, dy, part.rotation);
        if (!inCell(part.x + rx, part.y + ry, part.z + dz)) out.push(`${where}: ${t.id}'s cell [${dx}, ${dy}, ${dz}] lands at [${part.x + rx}, ${part.y + ry}, ${part.z + dz}], outside the footprint`);
      }
      const keys = [...Object.keys(part.edges ?? {}), ...Object.keys(part.glass ?? {})].map((k) => k.split(":")[0]);
      for (const k of [...keys, ...part.upperFloors ?? []]) if (!own.has(k)) out.push(`${where}: ${k} is not one of ${t.id}'s own cells (edge, glass and floor keys are in the tile's frame)`);
      for (const [slot, s] of Object.entries(part.surfaces ?? {})) if (s && "material" in s) material(s.material, `${where}.surfaces.${slot}`);
      if (part.options && !t.configurable && Object.keys(part.options).some((k) => k !== "facade")) out.push(`${where}: ${t.id} takes no room options (a facade only)`);
      return;
    }
    const [px, py, pz] = part.position;
    if (part.kind === "block") {
      if (typeof part.material === "string") material(part.material, `${where}.material`);
      const [w, h, d] = part.size;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const [ox, oz] = yawXZ(sx * w / 2, sz * d / 2, part.yaw);
        if (!inside(px + ox, py, pz + oz) || !inside(px + ox, py + h, pz + oz)) {
          out.push(`${where}: its corner at [${(px + ox).toFixed(2)}, ${(pz + oz).toFixed(2)}] (up to ${(py + h).toFixed(2)} m) is outside the footprint`);
          break;
        }
      }
      return;
    }
    if (part.kind === "prop") {
      const prop = getProp(part.model);
      if (!prop) out.push(`${where}: ${part.model} is not a prop`);
      else {
        const [w, h, d] = prop.size.map((v) => v * part.scale);
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => yawXZ(sx * w / 2, sz * d / 2, part.yaw));
        if (!corners.every(([ox, oz]) => inside(px + ox, py, pz + oz) && inside(px + ox, py + h, pz + oz))) out.push(`${where}: ${part.model} reaches outside the footprint`);
      }
      return;
    }
    if (!inside(px, py, pz)) out.push(`${where}: at [${px}, ${py}, ${pz}], outside the footprint`);
  });
  def.ports.forEach((p, i) => {
    const [x, y] = p.cell;
    if (!inCell(x, y, p.level)) out.push(`ports[${i}]: cell [${x}, ${y}] on level ${p.level} is not in the footprint`);
    const [dx, dy] = SIDE_DIRS[p.side];
    if (inCell(x + dx, y + dy, p.level)) out.push(`ports[${i}]: side ${p.side} of [${x}, ${y}] faces the piece's own cell [${x + dx}, ${y + dy}], not its outside`);
  });
  for (const m of def.markers ?? []) {
    for (const i of m.parts) if (i >= def.parts.length) out.push(`markers.${m.name}: part ${i} doesn't exist`);
    if (m.kind === "doorPair" && (m.parts.length !== 2 || m.parts.some((i) => def.parts[i]?.kind !== "door"))) out.push(`markers.${m.name}: a door pair is two doors`);
  }
  if (def.mirror === "free") {
    const why = setPieceMirrorProblem(def, catalog);
    if (why) out.push(`mirror: "free", but ${why}: say "none"`);
  }
  return out;
}
function loadMap(json, catalog = coreCatalog, opts = {}) {
  let raw = json;
  const bytes = typeof json === "string" ? utf8Length(json) : utf8Length(JSON.stringify(json) ?? "");
  if (bytes > RESOURCE_BUDGETS.mapBytes) {
    return { ok: false, issues: [{ severity: "error", code: "budget.bytes", message: `the map is ${(bytes / 1048576).toFixed(1)} MB: at most ${RESOURCE_BUDGETS.mapBytes / 1048576} MB` }] };
  }
  if (typeof json === "string") {
    try {
      raw = JSON.parse(json);
    } catch (e) {
      return { ok: false, issues: [{ severity: "error", code: "json.parse", message: `invalid JSON: ${e.message}` }] };
    }
  }
  let migrated;
  try {
    migrated = migrateMapDocument(raw);
  } catch (e) {
    if (e instanceof MapMigrationError) return { ok: false, issues: [{ severity: "error", code: "format.version", message: e.message }] };
    throw e;
  }
  const parsed = MapDocument.safeParse(migrated.doc);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ severity: "error", code: "schema", message: `${i.path.join(".") || "(root)"}: ${i.message}` }))
    };
  }
  if (migrated.fromVersion < 39) parsed.data = carryReleaseOverRaceDrop(raw, parsed.data);
  const library = opts.library ?? builtInSetPieces();
  const issues = validateMap(parsed.data, catalog, library);
  const doc = opts.forEditing ? parsed.data : withTileAliases(parsed.data);
  if (issues.some((i) => i.severity === "error") && !(opts.forEditing && opts.openWithErrors)) return { ok: false, issues };
  const map = opts.forEditing ? parsed.data : withGroundAsPlayed(withMountAliases(withPropAliases(expandSetPieces(doc, library, catalog).map)), catalog);
  return { ok: true, map, issues, migratedFrom: migrated.fromVersion };
}
function validateMap(map, catalog = coreCatalog, library = builtInSetPieces()) {
  const issues = validatePieces(map, catalog, library);
  if (map.groups?.length) issues.push(...groupIssues(map));
  issues.push(...retiredMountIssues(map));
  if (map.botHints?.length) issues.push(...botHintIssues(map));
  return issues;
}
function buriedMouthIssues(map, cells, catalog) {
  const made = map.terrain;
  if (!made || !mapGroundBores(map, catalog).tiles.size) return [];
  const issues = [];
  const { cellSize, levelHeight } = map.classicStructure;
  let ground = null;
  for (const [key, occ] of cells) {
    if (!occ.def.bore) continue;
    const [gx, gy, gz] = key.split(",").map(Number);
    for (const port of occ.def.ports) {
      if (port.level !== occ.level || (port.cell?.[0] ?? 0) !== occ.local[0] || (port.cell?.[1] ?? 0) !== occ.local[1]) continue;
      const side = rotateSide(port.side, occ.placement.rotation);
      const [dx, dy] = SIDE_DIRS[side];
      if (cells.has(cellKey(gx + dx, gy + dy, gz))) continue;
      if (edgeSegments(resolveEdge(cells, gx, gy, gz, side), cellSize / 2, levelHeight).some(([u0, u1, y0, y1]) => u0 < 0 && u1 > 0 && y0 < 1 && y1 > 1)) continue;
      ground ??= terrainUnderFloors(withPathsLaid(map), void 0, catalog);
      const floor = gz * levelHeight;
      let over = -Infinity;
      for (const out of [0.4, 1.2, 2]) over = Math.max(over, (terrainHeightAt(ground, (gx + dx * 0.5) * cellSize + dx * out, (gy + dy * 0.5) * cellSize + dy * out) ?? -Infinity) - floor);
      if (over > PLAYER.maxStepHeight + 0.1) {
        issues.push({
          severity: "warning",
          code: "tunnel.mouth_buried",
          message: `the ${occ.def.displayName} at (${gx}, ${gy}) ends in the ground on its ${side} side (${over.toFixed(1)} m of earth over its floor): put a Tunnel Portal on that end, or close it with a wall`,
          targetId: occ.placement.id
        });
      }
    }
  }
  return issues;
}
function moundedRunIssues(map, cells, catalog) {
  const t = map.terrain;
  if (!t || !mapGroundBores(map, catalog).tiles.size) return [];
  const { cellSize, levelHeight } = map.classicStructure;
  const made = withPathsLaid(map).terrain ?? t;
  const mounded = [];
  for (const [key, occ] of cells) {
    const cover = occ.def.bore?.cover?.[0]?.[4];
    if (cover === void 0 || occ.def.bore?.open) continue;
    const [gx, gy, gz] = key.split(",").map(Number);
    if (cells.has(cellKey(gx, gy, gz - 1))) continue;
    const want = gz * levelHeight + cover;
    let low = Infinity;
    let high = -Infinity;
    for (const [ox, oz] of [[0, 0], [-3, -3], [3, -3], [-3, 3], [3, 3]]) {
      const h = terrainHeightAt(made, gx * cellSize + ox, gy * cellSize + oz);
      if (h === null) continue;
      low = Math.min(low, h);
      high = Math.max(high, h);
    }
    if (low < want - 0.5 && low >= want - levelHeight - 0.01 && high - low < 0.5) mounded.push(occ.placement.id);
  }
  if (!mounded.length) return [];
  const ids = [...new Set(mounded)];
  return [{ severity: "suggestion", code: "tunnel.flush_a_level_down", message: `${ids.length} buried tunnel piece${ids.length === 1 ? " stands" : "s stand"} as a mound on flat ground: a level down (Page Down) the ground already covers ${ids.length === 1 ? "it" : "them"} and the surface stays flat, with a ramp down to each portal`, targetId: ids[0] }];
}
function floodedBoreIssues(map, catalog) {
  const bores = mapGroundBores(map, catalog);
  if (!bores.cuts.length) return [];
  const issues = [];
  for (const e of map.entities) {
    if (e.kind !== "water") continue;
    const [x, y, z] = e.position;
    const [w, h, d] = e.size;
    const top = y + h;
    const hit = bores.cuts.find((c) => x - w / 2 < c.max[0] && x + w / 2 > c.min[0] && z - d / 2 < c.max[2] && z + d / 2 > c.min[2] && top > c.min[1] + 0.5 + 0.05 && y < Math.min(c.max[1], c.min[1] + 4.25));
    if (hit) {
      issues.push({ severity: "warning", code: "tunnel.flooded", message: `the ${e.liquid} ${e.id} reaches into a buried tunnel ${(top - hit.min[1] - 0.5).toFixed(1)} m over its floor: the passage is flooded there (keep the liquid's box out of the tunnel if that isn't meant)`, targetId: e.id });
    }
  }
  return issues;
}
function groupIssues(map) {
  const issues = [];
  const have = /* @__PURE__ */ new Set([...map.classicStructure.tiles.map((t) => t.id), ...map.entities.map((e) => e.id), ...(map.setPieces ?? []).map((p) => p.id)]);
  const seen = /* @__PURE__ */ new Map();
  for (const g of map.groups ?? []) {
    for (const m of g.members) {
      if (!have.has(m)) issues.push({ severity: "warning", code: "group.member", message: `group ${g.id} lists ${m}, which isn't in the map`, targetId: g.id });
      else if (seen.has(m) && seen.get(m) !== g.id) issues.push({ severity: "warning", code: "group.member", message: `${m} is in two groups (${seen.get(m)} and ${g.id})`, targetId: m });
      seen.set(m, g.id);
    }
  }
  return issues;
}
function validatePieces(map, catalog, library) {
  if (map.setPieces === void 0 && map.setPieceDefs === void 0) return validateExpanded(map, map, catalog);
  const ex = expandSetPieces(map, library, catalog);
  const issues = [];
  const taken = /* @__PURE__ */ new Set([...map.classicStructure.tiles.map((t) => t.id), ...map.entities.map((e) => e.id)]);
  for (const p of map.setPieces ?? []) {
    if (taken.has(p.id)) issues.push({ severity: "error", code: "id.duplicate", message: `duplicate ID "${p.id}"`, targetId: p.id });
    taken.add(p.id);
  }
  issues.push(...ex.issues, ...setPieceOverlapIssues(map, ex, buildOccupancy(map, catalog).cells));
  const played = ex.map === map ? 0 : utf8Length(JSON.stringify(ex.map));
  if (played > RESOURCE_BUDGETS.mapBytes) issues.push({ severity: "error", code: "budget.bytes", message: `as played (its set pieces expanded) the map is ${(played / 1048576).toFixed(1)} MB: at most ${RESOURCE_BUDGETS.mapBytes / 1048576} MB` });
  for (const def of map.setPieceDefs ?? []) for (const p of checkSetPieceDefinition(def, { packs: library.packs, catalog })) issues.push({ severity: "warning", code: "setpiece.def", message: `the map's set piece ${def.id}: ${p}` });
  for (const i of validateExpanded(ex.map, map, catalog)) {
    const placement = i.targetId ? ex.partOf.get(i.targetId) : void 0;
    issues.push(placement ? { ...i, targetId: placement } : i);
  }
  return issues;
}
function validateExpanded(map, stored, catalog) {
  const issues = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of [...map.classicStructure.tiles, ...map.entities]) {
    if (seen.has(item.id)) issues.push({ severity: "error", code: "id.duplicate", message: `duplicate ID "${item.id}"`, targetId: item.id });
    seen.add(item.id);
  }
  if (map.bounds) {
    const { min: min2, max: max2 } = map.bounds;
    for (const e of map.entities) {
      const [x, , z] = e.position;
      if (x < min2[0] || x > max2[0] || z < min2[1] || z > max2[1]) {
        issues.push({ severity: e.kind === "spawn" ? "error" : "warning", code: "bounds.outside", message: `${e.kind} ${e.id} is outside the map boundary`, targetId: e.id });
      }
    }
  }
  if (hasBorder(map) && !borderRect(map)) {
    issues.push({ severity: "warning", code: "border.noBoundary", message: "the map has a border but no boundary (or walled terrain edge) to stand it along" });
  }
  const { cells, overlaps, unknownTiles } = buildOccupancy(map, catalog);
  for (const t of unknownTiles) {
    issues.push({ severity: "error", code: "tile.unknown", message: `unknown tile "${t.tile}"`, targetId: t.id });
  }
  for (const o of overlaps) {
    issues.push({ severity: "error", code: "tile.overlap", message: `tiles ${o.ids[0]} and ${o.ids[1]} overlap at cell ${o.key}`, targetId: o.ids[1] });
  }
  if (!coreThemes.get(map.classicStructure.theme)) {
    issues.push({ severity: "error", code: "theme.unknown", message: `unknown theme "${map.classicStructure.theme}"` });
  }
  for (const t of map.classicStructure.tiles) {
    for (const slot of SURFACE_SLOTS) {
      const style = t.surfaces?.[slot];
      if (style && !coreMaterials.get(style.material)) {
        issues.push({ severity: "error", code: "material.unknown", message: `tile ${t.id} uses unknown material "${style.material}"`, targetId: t.id });
      }
    }
  }
  const blocks = map.entities.filter((e) => e.kind === "block");
  for (const b of blocks) {
    if (b.kind === "block" && b.material && !coreMaterials.get(b.material)) issues.push({ severity: "error", code: "material.unknown", message: `block ${b.id} uses unknown material "${b.material}"`, targetId: b.id });
  }
  if (map.classicStructure.tiles.length === 0 && !map.terrain && blocks.length === 0) {
    issues.push({ severity: "error", code: "tile.none", message: "nothing to stand on: add terrain (Environment → Terrain), a structure tile or a block" });
  }
  issues.push(...budgetIssues(map));
  for (const x of map.botCast ?? []) if (!isCastId(x)) issues.push({ severity: "warning", code: "bots.cast_unknown", message: `bot characters: unknown group or theme "${x}" (left out)` });
  if (map.weaponSet !== void 0 && !isWeaponSetId(map.weaponSet)) issues.push({ severity: "warning", code: "weapons.set_unknown", message: `weapon set: no set "${map.weaponSet}" (it plays Standard)` });
  const floating = floatingProps(map);
  if (floating.length) {
    const worst = floating.reduce((a, b) => b.gap > a.gap ? b : a);
    issues.push({
      severity: "warning",
      code: "prop.floating",
      message: `${floating.length} prop${floating.length > 1 ? "s float" : " floats"} above the ground (worst: ${worst.id}, ${worst.gap} m); MapMaker's "Settle on ground" beds them in`,
      targetId: worst.id
    });
  }
  const spawns = map.entities.filter((e) => e.kind === "spawn");
  if (spawns.length === 0) {
    issues.push({ severity: "error", code: "spawn.none", message: "map has no spawn points" });
  } else if (spawns.length < map.metadata.recommendedPlayers.max) {
    issues.push({
      severity: "warning",
      code: "spawn.few",
      message: `${spawns.length} spawn points for up to ${map.metadata.recommendedPlayers.max} players; spawns will be shared (matches of ${IMPROMPTU_MIN_PLAYERS}+ players add spawn points of their own on open ground, but placed ones play better)`
    });
  } else {
    const sides = [...new Set(spawns.map((s) => s.faction).filter((f) => !!f))];
    if (sides.length >= 2) {
      const want = Math.ceil(map.metadata.recommendedPlayers.max / sides.length / SPAWN_SHARE);
      const short = sides.filter((t) => spawns.filter((s) => s.faction === t).length < want);
      if (short.length) {
        issues.push({
          severity: "warning",
          code: "spawn.few",
          message: `${short.join(", ")} ${short.length === 1 ? "has" : "have"} fewer than ${want} spawn points of ${short.length === 1 ? "its" : "their"} own for up to ${map.metadata.recommendedPlayers.max} players (matches of ${IMPROMPTU_MIN_PLAYERS}+ players add spawn points of their own on the team's side, but placed ones play better)`
        });
      }
    }
  }
  const { cellSize, levelHeight } = map.classicStructure;
  let propTops;
  for (const s of spawns) {
    const [x, y, z] = s.position;
    const gx = Math.round(x / cellSize);
    const gy = Math.round(z / cellSize);
    const gz = Math.floor((y + 0.01) / levelHeight);
    const occ = cells.get(cellKey(gx, gy, gz));
    const ground = map.terrain ? terrainHeightAt(map.terrain, x, z) : null;
    const onTerrain = ground !== null && Math.abs(ground - y) < 1.5;
    const onBlock = blocks.some((b) => b.kind === "block" && Math.abs(b.position[1] + b.size[1] - y) < 1 && pointOnBlock(b, x, z));
    const onProp = !onTerrain && !onBlock && (propTops ??= propBoxes(map)).some((b) => Math.abs(b.max[1] - y) < 1 && pointOnBox(b, x, z));
    if (!onTerrain && !onBlock && !onProp && (!occ || !cellHasFloor(occ))) {
      issues.push({ severity: "warning", code: "spawn.no_floor", message: `spawn ${s.id} is not above a tile floor`, targetId: s.id });
    }
  }
  issues.push(...buriedMouthIssues(map, cells, catalog));
  issues.push(...floodedBoreIssues(map, catalog));
  issues.push(...moundedRunIssues(map, cells, catalog));
  for (const t of map.classicStructure.tiles) {
    if (t.family && !catalog.familiesOf(t.tile).some((d) => d.familyOf.family === t.family)) {
      issues.push({ severity: "warning", code: "tile.family_unknown", message: `tile ${t.id} (${catalog.get(t.tile)?.displayName ?? t.tile}) doesn't come in the "${t.family}" family: it is drawn as its own`, targetId: t.id });
    }
  }
  const pickups = map.entities.filter((e) => e.kind === "pickup");
  for (const p of pickups) {
    if (!getItem(p.item)) issues.push({ severity: "error", code: "pickup.unknown", message: `pickup ${p.id} uses unknown item "${p.item}"`, targetId: p.id });
    else if (p.random && itemCategory(getItem(p.item)) !== p.random) issues.push({ severity: "warning", code: "pickup.random_item", message: `pickup ${p.id} rolls ${WEAPON_CATEGORY_LABELS[p.random].toLowerCase()} but shows "${getItem(p.item)?.displayName}" in MapMaker`, targetId: p.id });
    if (p.keepFixed && !itemCategory(getItem(p.item))) issues.push({ severity: "suggestion", code: "pickup.keep_fixed", message: `pickup ${p.id} is kept fixed, but only weapon pickups are ever mixed up`, targetId: p.id });
  }
  const discsOnly = map.metadata.supportedModes.length > 0 && map.metadata.supportedModes.every((m) => m === "core.discs");
  if (!discsOnly && !pickups.some((p) => getItem(p.item)?.effect.kind === "health")) {
    issues.push({ severity: "suggestion", code: "pickup.no_health", message: "no health pickups: fights will snowball" });
  }
  for (const e of map.entities) {
    if (e.kind === "prop" && !getProp(e.model)) issues.push({ severity: "error", code: "prop.unknown", message: `prop ${e.id} uses unknown model "${e.model}"`, targetId: e.id });
  }
  issues.push(...glassIssues(map, catalog));
  issues.push(...validateScenario(map));
  issues.push(...resourceBudgetIssues(map));
  if (stored.metadata.release && !releaseCurrent(stored)) {
    issues.push({ severity: "warning", code: "release.changed", message: "changed since it was exported: the next export gives it a new version" });
  }
  issues.push(...validateTrack(map));
  const terrain = map.terrain;
  issues.push(...airplaneIssues(map, (x, z) => terrain ? terrainHeightAt(terrain, x, z) : null));
  issues.push(...ziplineShapeIssues(map.entities));
  issues.push(...arcSentryIssues(map.entities));
  const { min, max } = map.metadata.recommendedPlayers;
  if (min > max) issues.push({ severity: "error", code: "meta.players", message: `recommended players min ${min} > max ${max}` });
  return issues;
}
function glassIssues(map, catalog = coreCatalog) {
  const out = [];
  for (const e of map.entities) {
    if (e.kind !== "block" || !e.glass) continue;
    if (e.behaviour !== "solid" || e.field) out.push({ severity: "warning", code: "glass.block", message: `block ${e.id} is glass but ${e.field ? "a force field" : e.behaviour}: glass needs a plain solid block`, targetId: e.id });
  }
  if (!map.classicStructure.tiles.some((t) => t.glass)) return out;
  const { cells } = buildOccupancy(map, catalog);
  for (const [key, occ] of cells) {
    const glass = occ.placement.glass;
    if (!glass) continue;
    const [x, y, z] = key.split(",").map(Number);
    for (const [edge, worldSide] of cellSides(occ)) {
      if (!glass[edge]) continue;
      const style = resolveEdge(cells, x, y, z, worldSide);
      if (!GLASS_EDGES.has(style)) out.push({ severity: "warning", code: "glass.edge", message: `tile ${occ.placement.id} has glass on side ${edge} but no window there (${style === "none" ? "no wall" : style})`, targetId: occ.placement.id });
    }
  }
  for (const t of map.classicStructure.tiles) {
    for (const edge of Object.keys(t.glass ?? {})) {
      const [dx, dy, dz] = edge.split(":")[0].split(",").map(Number);
      const has = [...cells.values()].some((o) => o.placement === t && o.local[0] === dx && o.local[1] === dy && o.local[2] === dz);
      if (!has) out.push({ severity: "warning", code: "glass.edge", message: `tile ${t.id} has glass on ${edge}, which isn't one of its cells`, targetId: t.id });
    }
  }
  return out;
}
function serializeMap(map) {
  const t = map.terrain;
  if (!t) return `${JSON.stringify(map, null, 2)}
`;
  const mark = (k) => `terrain:${k}`;
  let text = JSON.stringify({ ...map, terrain: { ...t, heights: mark("heights"), materials: mark("materials"), foliage: mark("foliage") } }, null, 2);
  const rows = (values, perRow) => {
    if (!values.length) return "[]";
    const lines = [];
    for (let i = 0; i < values.length; i += perRow) lines.push(`      ${values.slice(i, i + perRow).join(", ")}`);
    return `[
${lines.join(",\n")}
    ]`;
  };
  for (const [k, values, perRow] of [["heights", t.heights, t.cols], ["materials", t.materials, t.cols - 1], ["foliage", t.foliage, t.cols - 1]]) {
    const key = `${JSON.stringify(k)}: ${JSON.stringify(mark(k))}`;
    const at = text.indexOf(key);
    if (at >= 0) text = `${text.slice(0, at)}${JSON.stringify(k)}: ${rows(values, Math.max(1, perRow))}${text.slice(at + key.length)}`;
  }
  return `${text}
`;
}
function pointOnBox(b, x, z) {
  const [cx, cz] = [(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2];
  const [lx, lz] = yawXZ(x - cx, z - cz, -(b.yaw ?? 0));
  return Math.abs(lx) <= (b.max[0] - b.min[0]) / 2 && Math.abs(lz) <= (b.max[2] - b.min[2]) / 2;
}
function pointOnBlock(b, x, z) {
  const [lx, lz] = yawXZ(x - b.position[0], z - b.position[2], -b.yaw);
  return Math.abs(lx) <= b.size[0] / 2 && Math.abs(lz) <= b.size[2] / 2;
}
const MAP_BUDGETS = {
  /** Playable footprint across (m). */
  footprint: 400,
  tiles: 1500,
  props: 1500,
  /** Different prop models (each is a download and a set of draw calls). */
  propModels: 80,
  /** Solid free blocks: merged into the level's meshes like tiles, so mostly a navmesh build-time cost. */
  blocks: 3e3,
  /** Breakable, crumbling and trapdoor blocks, and solid blocks logic drives or movers carry (each is simulated and sent to players). */
  dynamicBlocks: 150,
  liquids: 32,
  /** Gameplay pieces that think every tick: doors, traps, zones, squads, mounts, pads, buttons, movers. */
  active: 300,
  /** Lights (each lamp lights the pixels within its range: clustered, but a crowd of overlapping ones still costs every pixel they reach). */
  lights: 256,
  /**
   * Procedural environment species (`env.*` props, docs/PROCEDURAL_ENVIRONMENT.md): their own budget, apart from props.
   * They draw as thin instances batched per species, variant, level of detail and 64 m sector, so a copy costs far
   * less than a prop; what grows with the count is collision and navigation (trunks, boulders, cliffs).
   */
  env: {
    /** Placements in all (trees, shrubs, ground cover, boulders, cliffs). */
    placements: 4e3,
    /** Placements that collide (trees, boulders, cliffs): shapes in every player's physics and the navmesh. */
    colliding: 3e3,
    /** Cliff panels: each is a triangle-mesh collider and a navigation boundary. */
    cliffs: 120,
    /** Different species variants (each is a download and its own batches). */
    variants: 24
  }
};
function budgetIssues(map) {
  const out = [];
  const over = (code, n, max, what) => {
    if (n > max) out.push({ severity: "warning", code: `budget.${code}`, message: `${n} ${what} (budget ${max}): the map may run slowly on ordinary laptops` });
  };
  const e = map.entities;
  const all = e.filter((x) => x.kind === "prop");
  const props = all.filter((x) => !isEnvModel(x.model));
  const env = all.filter((x) => isEnvModel(x.model));
  over("tiles", map.classicStructure.tiles.length, MAP_BUDGETS.tiles, "tiles");
  over("props", props.length, MAP_BUDGETS.props, "props");
  over("prop_models", new Set(props.map((x) => x.model)).size, MAP_BUDGETS.propModels, "different prop models");
  if (env.length) {
    const species = env.map((x) => getEnvSpecies(x.model));
    over("env", env.length, MAP_BUDGETS.env.placements, "environment species placed (trees, plants, rocks, cliffs)");
    over("env_colliding", species.filter((s) => s && s.nav !== "none").length, MAP_BUDGETS.env.colliding, "trees, boulders and cliffs (environment species that collide)");
    over("env_cliffs", species.filter((s) => s?.category === "cliff").length, MAP_BUDGETS.env.cliffs, "cliff panels");
    over("env_variants", new Set(env.map((x) => `${x.model}#${x.variant ?? 0}`)).size, MAP_BUDGETS.env.variants, "different environment species variants");
  }
  const dynamic = dynamicBlockIds(map);
  over("blocks", e.filter((x) => x.kind === "block" && !dynamic.has(x.id)).length, MAP_BUDGETS.blocks, "solid blocks");
  over("dynamic_blocks", dynamic.size, MAP_BUDGETS.dynamicBlocks, "breakable, crumbling, trapdoor, logic-driven or moving blocks");
  over("liquids", e.filter((x) => x.kind === "water").length, MAP_BUDGETS.liquids, "bodies of water, lava, acid or swamp");
  over("lights", e.filter((x) => x.kind === "light").length, MAP_BUDGETS.lights, "lights");
  over("active", e.filter((x) => ["door", "trap", "zone", "encounter", "mount", "pad", "button", "mover", "portal"].includes(x.kind)).length, MAP_BUDGETS.active, "doors, traps, zones, squads, vehicles, pads, buttons, movers and portals");
  const xs = e.map((x) => x.position[0]);
  const zs = e.map((x) => x.position[2]);
  const span = xs.length ? Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) : 0;
  over("footprint", Math.round(span), MAP_BUDGETS.footprint, "m across");
  return out;
}
export {
  BOT_HINT_SPECS as B,
  MAP_BUDGETS as M,
  TILE_ALIASES as T,
  airRoute as a,
  hintAt as b,
  botHintNavIssues as c,
  dropTarget as d,
  botDropIndex as e,
  dropOffsets as f,
  canDrop as g,
  hintTo as h,
  dropIndex as i,
  shouldJump as j,
  dropArea as k,
  loadMap as l,
  mapBotHints as m,
  dropPlan as n,
  dropStretchEnds as o,
  aliasedMount as p,
  aliasedPath as q,
  routePose as r,
  serializeMap as s,
  ticksToRouteEnd as t,
  placementsForTiles as u,
  checkSetPieceDefinition as v,
  jumpTrouble as w,
  retiredMountUses as x,
  validateMap as y
};
