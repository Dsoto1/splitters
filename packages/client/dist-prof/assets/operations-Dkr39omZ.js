import { j as coreCatalog, k as emptyLogic, r as rotateXZ, s as settledPropY, F as FLOAT_TOLERANCE, l as buildOccupancy, n as cellKey, o as edgeKey, p as localSide, S as SIDE_DIRS, q as supportBoxes, t as floatingProps, u as supportUnder, v as canAddFloor, w as localCellKey, g as getProp, x as cellSlab, E as ELECTRIC_FENCE, a as getEnvSpecies, y as envVariant } from "./settle-BDJE4VMF.js";
import { T as TRAP_SPECS, D as DESTRUCTIBLE_SPECS, B as BREAKTHROUGH_MAX_SECTORS, g as getKitFamily } from "./scenarioDefs-BcDISE-R.js";
import { $ as MAP_FORMAT_VERSION, a0 as MAP_FORMAT, a1 as newId, X as mapTeams, a2 as DEFAULT_TEAMS } from "./index-BAsW2uYW.js";
import { b as builtInSetPieces, p as piecesFor, s as setPieceCells, a as setPieceMirrorProblem, c as setPieceFootprint, i as insideBuildLimit, d as buildLimitShort, e as buildLimitReason } from "./setPieceLibrary-B87Q0Jtb.js";
const emptySelection = () => ({ tiles: [], entities: [] });
function placementCells(p, catalog = coreCatalog) {
  const def = catalog.get(p.tile);
  if (!def) return null;
  return def.cells.map(([dx, dy, dz]) => {
    const [rx, ry] = rotateXZ(dx, dy, p.rotation);
    return [p.x + rx, p.y + ry, p.z + dz];
  });
}
function levelName(level) {
  if (level === 0) return "Ground";
  if (level > 0) return `Level ${level}`;
  return level === -1 ? "Basement" : `Basement ${-level}`;
}
function checkPlacement(doc, placements, ignoreIds = [], catalog = coreCatalog, library = builtInSetPieces()) {
  return checkLayout(doc, { tiles: placements }, ignoreIds, catalog, library);
}
function checkLayout(doc, moving, ignoreIds = [], catalog = coreCatalog, library = builtInSetPieces()) {
  const tiles = moving.tiles ?? [];
  const placements = moving.setPieces ?? [];
  const ignore = /* @__PURE__ */ new Set([...ignoreIds, ...tiles.map((p) => p.id), ...placements.map((p) => p.id)]);
  const others = { ...doc, classicStructure: { ...doc.classicStructure, tiles: doc.classicStructure.tiles.filter((t) => !ignore.has(t.id)) } };
  const { cells } = buildOccupancy(others, catalog);
  const pieces = piecesFor(doc, library);
  const held = doc.setPieces?.length ? setPieceCells(doc, pieces, ignore) : /* @__PURE__ */ new Map();
  const claimed = /* @__PURE__ */ new Map();
  const conflicts = /* @__PURE__ */ new Set();
  let first;
  let inside;
  const claim = (id, x, y, z, byPiece) => {
    if (!insideBuildLimit(x, y, z)) return { ok: false, reason: buildLimitReason(doc, z), short: buildLimitShort(z), conflicts: [] };
    const key = cellKey(x, y, z);
    const hit = cells.get(key);
    if (hit) {
      conflicts.add(hit.placement.id);
      first ??= { occ: hit, z, byPiece };
    }
    const piece = held.get(key);
    if (piece) {
      conflicts.add(piece.id);
      inside ??= { p: piece, z, byPiece };
    }
    const mine = claimed.get(key);
    if (mine && mine !== id) conflicts.add(mine);
    claimed.set(key, id);
    return null;
  };
  for (const p of tiles) {
    const pc = placementCells(p, catalog);
    if (!pc) return { ok: false, reason: `unknown tile ${p.tile}`, short: "Unknown tile", conflicts: [] };
    for (const [x, y, z] of pc) {
      const refused = claim(p.id, x, y, z, false);
      if (refused) return refused;
    }
  }
  for (const p of placements) {
    const def = pieces.get(p.piece);
    if (!def) return { ok: false, reason: `unknown set piece ${p.piece}`, short: "Unknown set piece", conflicts: [] };
    if (p.mirror && (def.mirror === "none" || setPieceMirrorProblem(def, catalog))) return { ok: false, reason: `${def.displayName} can't be mirrored: place it unmirrored`, short: `${def.displayName} can't be mirrored`, conflicts: [] };
    for (const [x, y, z] of setPieceFootprint(p, def)) {
      const refused = claim(p.id, x, y, z, true);
      if (refused) return refused;
    }
  }
  if (!conflicts.size) return { ok: true };
  const name = (p) => pieces.get(p.piece)?.displayName ?? p.piece;
  let reason = "overlaps another of the pieces being placed: spread them out";
  let short = "Overlaps another piece being placed";
  if (first) {
    reason = first.byPiece ? `its footprint overlaps ${first.occ.def.displayName} on ${levelName(first.z)}: pick a free spot, or move or delete the ${first.occ.def.displayName} first` : overlapReason(first.occ, first.z);
    short = `Overlaps the ${first.occ.def.displayName} on ${levelName(first.z)}`;
  } else if (inside) {
    const n = name(inside.p);
    reason = inside.byPiece ? `its footprint overlaps the ${n} set piece on ${levelName(inside.z)}: pick a free spot, or move the ${n}` : `inside the ${n} set piece on ${levelName(inside.z)} (it holds every cell of its footprint): pick a free cell or another level, move the ${n}, or explode it into its parts to build into it`;
    short = inside.byPiece ? `Overlaps the ${n} set piece on ${levelName(inside.z)}` : `Inside the ${n} set piece on ${levelName(inside.z)}`;
  }
  return { ok: false, reason, short, conflicts: [...conflicts] };
}
function overlapReason(occ, z) {
  const name = occ.def.displayName;
  const storeys = new Set(occ.def.cells.map((c) => c[2])).size;
  const level = levelName(z);
  if (canAddFloor(occ.def, occ.local)) {
    if (cellSlab(occ)) return `overlaps ${name}: ${level} here is its upper storey, and it has a floor there already (stand things on it, or pick a free cell)`;
    return `overlaps ${name}: ${level} here is its upper storey (it stands ${storeys} levels tall). To put a floor there, place a Platform on it (it becomes the ${name}'s floor), or select the ${name} and tick “Floor on ${level}”`;
  }
  if (storeys > 1 && occ.level > 0) return `overlaps ${name}: ${level} here is part of it (it stands ${storeys} levels tall). Pick a free cell or another level, or move the ${name}`;
  return `overlaps ${name} on ${level}: pick a free cell or another level, or move or delete the ${name} first`;
}
function upperFloorAt(doc, x, y, z, catalog = coreCatalog) {
  const occ = buildOccupancy(doc, catalog).cells.get(cellKey(x, y, z));
  if (!occ || !canAddFloor(occ.def, occ.local)) return null;
  return { placement: occ.placement, key: localCellKey(occ.local), has: cellSlab(occ) };
}
function upperFloorLevels(t, catalog = coreCatalog) {
  const def = catalog.get(t.tile);
  if (!def) return [];
  const byLevel = /* @__PURE__ */ new Map();
  for (const c of def.cells) if (canAddFloor(def, c)) byLevel.set(c[2], [...byLevel.get(c[2]) ?? [], localCellKey(c)]);
  const have = new Set(t.upperFloors ?? []);
  return [...byLevel].sort((a, b) => a[0] - b[0]).map(([dz, keys]) => ({ dz, keys, on: keys.filter((k) => have.has(k)).length }));
}
function setUpperFloorsCommand(doc, t, keys, on, catalog = coreCatalog) {
  const def = catalog.get(t.tile);
  if (!def) return { error: `unknown tile ${t.tile}` };
  const next = new Set(t.upperFloors ?? []);
  for (const k of keys) {
    if (!canAddFloor(def, k.split(",").map(Number))) return { error: `${def.displayName} can't take a floor there` };
    if (on) next.add(k);
    else next.delete(k);
  }
  const { upperFloors: _old, ...rest } = t;
  const after = next.size ? { ...rest, upperFloors: [...next].sort() } : rest;
  return { kind: "updateTiles", before: [t], after: [after] };
}
function isBareFloor(def) {
  return !!def && def.cells.length === 1 && def.floors.length === 1 && def.floors[0] === def.cells[0][2] && !def.solids?.length && !def.extraFloors?.length && !def.model && def.edgeDefault === "open" && !def.edgeDefaults;
}
function tileAt(doc, x, y, z, catalog = coreCatalog) {
  return buildOccupancy(doc, catalog).cells.get(cellKey(x, y, z))?.placement;
}
function placeTileCommand(doc, tile, x, y, z, rotation, catalog = coreCatalog) {
  const placement = { id: newId("tile"), tile, x, y, z, rotation };
  const check = checkPlacement(doc, [placement], [], catalog);
  if (!check.ok) {
    const host = isBareFloor(catalog.get(tile)) ? upperFloorAt(doc, x, y, z, catalog) : null;
    if (host && !host.has) {
      const command = setUpperFloorsCommand(doc, host.placement, [host.key], true, catalog);
      if (!("error" in command)) return { command, floorOf: host.placement };
    }
    return { error: check.reason };
  }
  return { command: { kind: "addTiles", tiles: [placement] }, placement };
}
function selected(doc, sel) {
  const t = new Set(sel.tiles);
  const e = new Set(sel.entities);
  const p = new Set(sel.setPieces ?? []);
  return { tiles: doc.classicStructure.tiles.filter((x) => t.has(x.id)), entities: doc.entities.filter((x) => e.has(x.id)), setPieces: (doc.setPieces ?? []).filter((x) => p.has(x.id)) };
}
function deleteCommand(doc, sel) {
  const { tiles, entities, setPieces } = selected(doc, sel);
  const gone = new Set(entities.map((e) => e.id));
  const before = [];
  const after = [];
  const emptied = [];
  for (const m of doc.entities) {
    if (m.kind !== "mover" || gone.has(m.id)) continue;
    const blocks = m.blocks.filter((id) => !gone.has(id));
    const props = (m.props ?? []).filter((id) => !gone.has(id));
    if (blocks.length === m.blocks.length && props.length === (m.props ?? []).length) continue;
    if (!blocks.length) emptied.push(m);
    else {
      before.push(m);
      after.push({ ...m, blocks, props: props.length ? props : void 0 });
    }
  }
  const defs = setPieces.length ? unusedDefsCommand(doc, new Set(setPieces.map((p) => p.id))) : null;
  return { kind: "batch", commands: [{ kind: "removeTiles", tiles }, { kind: "removeEntities", entities: [...entities, ...emptied] }, { kind: "updateEntities", before, after }, { kind: "removeSetPieces", setPieces }, ...defs ? [defs] : []] };
}
function unusedDefsCommand(doc, gone) {
  const before = doc.setPieceDefs ?? null;
  if (!before?.length) return null;
  const used = new Set((doc.setPieces ?? []).filter((p) => !gone.has(p.id)).map((p) => p.piece));
  const after = before.filter((d) => used.has(d.id));
  if (after.length === before.length) return null;
  return { kind: "setSetPieceDefs", before, after: after.length ? after : null };
}
function moverGroupOf(doc, id) {
  for (const m of doc.entities) {
    if (m.kind !== "mover") continue;
    if (m.id === id || m.blocks.includes(id) || (m.props ?? []).includes(id)) return [m.id, ...m.blocks, ...m.props ?? []];
  }
  return null;
}
function withMoverGroups(doc, ids) {
  const out = new Set(ids);
  for (const id of ids) for (const g of moverGroupOf(doc, id) ?? []) out.add(g);
  return [...out];
}
function moveCommand(doc, sel, dx, dy, dz, catalog = coreCatalog, library = builtInSetPieces()) {
  const { tiles, entities, setPieces } = selected(doc, sel);
  const { cellSize, levelHeight } = doc.classicStructure;
  const moved = tiles.map((t) => ({ ...t, x: t.x + dx, y: t.y + dy, z: t.z + dz }));
  const movedPieces = setPieces.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy, z: p.z + dz }));
  const check = checkLayout(doc, { tiles: moved, setPieces: movedPieces }, [], catalog, library);
  if (!check.ok) return { error: check.reason };
  const movedEntities = entities.map((e) => ({ ...e, position: [e.position[0] + dx * cellSize, e.position[1] + dz * levelHeight, e.position[2] + dy * cellSize] }));
  return {
    kind: "batch",
    commands: [
      { kind: "updateTiles", before: tiles, after: moved },
      { kind: "updateEntities", before: entities, after: movedEntities },
      { kind: "updateSetPieces", before: setPieces, after: movedPieces }
    ]
  };
}
function yawStep(kind, fine = false) {
  const deg = kind === "spawn" ? fine ? 15 : 45 : kind === "prop" || kind === "mount" ? fine ? 5 : 15 : kind === "tile" || kind === "zone" || kind === "water" ? 90 : fine ? 15 : 90;
  return deg * Math.PI / 180;
}
function rotateCommand(doc, sel, catalog = coreCatalog, opts = {}) {
  const { tiles: selTiles, entities, setPieces } = selected(doc, sel);
  if (!selTiles.length && !entities.length && !setPieces.length) return { error: "nothing selected" };
  const tiles = [...selTiles, ...setPieces.map((p) => ({ id: p.id, tile: "", x: p.x, y: p.y, z: p.z, rotation: p.rotation }))];
  const { cellSize } = doc.classicStructure;
  const ids = new Set(entities.map((e) => e.id));
  const movers = entities.filter((m) => m.kind === "mover" && [...m.blocks, ...m.props ?? []].every((id) => ids.has(id)));
  const oneBuild = !tiles.length && movers.length === 1 && entities.length === 1 + movers[0].blocks.length + (movers[0].props?.length ?? 0);
  const single = !tiles.length && entities.length === 1;
  const gridBound = tiles.length > 0 || entities.some((e) => e.kind === "zone" || e.kind === "water");
  let angle;
  let pivot;
  if (single) {
    angle = opts.angle ?? yawStep(entities[0].kind, opts.fine);
    pivot = [entities[0].position[0], entities[0].position[2]];
  } else {
    if (opts.fine && gridBound && opts.angle === void 0) return { error: "tiles, zones and liquids turn in quarter turns" };
    angle = opts.angle ?? (opts.fine ? yawStep("block", true) : Math.PI / 2);
    if (gridBound && Math.abs(angle - Math.round(angle / (Math.PI / 2)) * (Math.PI / 2)) > 1e-6) return { error: "tiles, set pieces, zones and liquids turn in quarter turns" };
    if (oneBuild) pivot = [movers[0].position[0], movers[0].position[2]];
    else if (tiles.length) {
      const xs = tiles.map((t) => t.x);
      const ys = tiles.map((t) => t.y);
      let cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      let cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      if (!Number.isInteger(cx * 2) || Number.isInteger(cx) !== Number.isInteger(cy)) [cx, cy] = [Math.floor(cx), Math.floor(cy)];
      pivot = [cx * cellSize, cy * cellSize];
    } else {
      const xs = entities.map((e) => e.position[0]);
      const zs = entities.map((e) => e.position[2]);
      const half = (v) => Math.round(v * 2) / 2;
      pivot = [half((Math.min(...xs) + Math.max(...xs)) / 2), half((Math.min(...zs) + Math.max(...zs)) / 2)];
    }
  }
  const quarters = Math.round(angle / (Math.PI / 2));
  const isQuarter = Math.abs(angle - quarters * (Math.PI / 2)) < 1e-9;
  if (single && !isQuarter && (entities[0].kind === "zone" || entities[0].kind === "water")) return { error: "zones and liquids turn in quarter turns" };
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const r3 = (v) => Math.round(v * 1e3) / 1e3 + 0;
  const turn = (x, z) => [r3(x * c + z * s), r3(z * c - x * s)];
  const about = (x, z) => {
    const [ox, oz] = turn(x - pivot[0], z - pivot[1]);
    return [r3(pivot[0] + ox), r3(pivot[1] + oz)];
  };
  const turn4 = (x, y, rotation) => {
    const [wx, wz] = about(x * cellSize, y * cellSize);
    return { x: Math.round(wx / cellSize), y: Math.round(wz / cellSize), rotation: ((rotation + quarters) % 4 + 4) % 4 };
  };
  const rotated = selTiles.map((t) => ({ ...t, ...turn4(t.x, t.y, t.rotation) }));
  const turnedPieces = setPieces.map((p) => ({ ...p, ...turn4(p.x, p.y, p.rotation) }));
  const check = checkLayout(doc, { tiles: rotated, setPieces: turnedPieces }, [], catalog, opts.library);
  if (!check.ok) return { error: check.reason };
  const turned = entities.map((e) => {
    const [x, z] = single ? [e.position[0], e.position[2]] : about(e.position[0], e.position[2]);
    const out = { ...e, position: [x, e.position[1], z] };
    if ("yaw" in out) out.yaw = normalizeYaw(out.yaw + angle);
    if (out.kind === "mover") out.points = out.points.map(([px, py, pz]) => {
      const [a, b] = turn(px, pz);
      return [a, py, b];
    });
    if (out.kind === "airplane") out.route = out.route.map(([px, pz]) => turn(px, pz));
    if ((out.kind === "zone" || out.kind === "water") && quarters % 2) out.size = [out.size[2], out.size[1], out.size[0]];
    return out;
  });
  return {
    kind: "batch",
    commands: [
      { kind: "updateTiles", before: selTiles, after: rotated },
      { kind: "updateEntities", before: entities, after: turned },
      { kind: "updateSetPieces", before: setPieces, after: turnedPieces }
    ]
  };
}
function duplicateCommand(doc, sel, catalog = coreCatalog, library = builtInSetPieces()) {
  const { tiles, entities, setPieces } = selected(doc, sel);
  if (!tiles.length && !entities.length && !setPieces.length) return { error: "nothing selected" };
  const { cellSize } = doc.classicStructure;
  for (let dx = 1; dx <= 32; dx++) {
    const copies = tiles.map((t) => ({ ...t, id: newId("tile"), x: t.x + dx }));
    const pieceCopies = setPieces.map((p) => ({ ...p, id: newId("setpiece"), x: p.x + dx }));
    if (!checkLayout({ ...doc, classicStructure: doc.classicStructure }, { tiles: copies, setPieces: pieceCopies }, [], catalog, library).ok) continue;
    const idMap = new Map(entities.map((e) => [e.id, newId(e.kind)]));
    const pairs = /* @__PURE__ */ new Map();
    for (const e of entities) if (e.kind === "portal" && entities.filter((o) => o.kind === "portal" && o.pair === e.pair).length === 2 && !pairs.has(e.pair)) pairs.set(e.pair, newId("pair"));
    const entityCopies = entities.map((e) => {
      const copy = { ...e, id: idMap.get(e.id), position: [e.position[0] + dx * cellSize, e.position[1], e.position[2]] };
      if (copy.kind === "mover") {
        copy.blocks = copy.blocks.map((id) => idMap.get(id) ?? id);
        if (copy.props) copy.props = copy.props.map((id) => idMap.get(id) ?? id);
      }
      if (copy.kind === "portal" && pairs.has(copy.pair)) copy.pair = pairs.get(copy.pair);
      return copy;
    });
    return {
      command: { kind: "batch", commands: [{ kind: "addTiles", tiles: copies }, { kind: "addEntities", entities: entityCopies }, { kind: "addSetPieces", setPieces: pieceCopies }] },
      selection: { tiles: copies.map((c) => c.id), entities: entityCopies.map((c) => c.id), ...pieceCopies.length ? { setPieces: pieceCopies.map((c) => c.id) } : {} }
    };
  }
  return { error: "no free space to duplicate into" };
}
function addSpawnCommand(position, yaw) {
  const id = newId("spawn");
  return { command: { kind: "addEntities", entities: [{ id, kind: "spawn", position, yaw, faction: null }] }, id };
}
function normalizeYaw(yaw) {
  let y = yaw % (Math.PI * 2);
  if (y > Math.PI) y -= Math.PI * 2;
  if (y <= -Math.PI) y += Math.PI * 2;
  return Math.round(y * 1e3) / 1e3;
}
function newMapDocument(name = "Untitled Map", now = /* @__PURE__ */ new Date()) {
  const ts = now.toISOString();
  return {
    format: MAP_FORMAT,
    formatVersion: MAP_FORMAT_VERSION,
    metadata: {
      id: newId("map"),
      name,
      author: "",
      description: "",
      createdAt: ts,
      updatedAt: ts,
      parentId: null,
      recommendedPlayers: { min: 2, max: 8 },
      supportedModes: ["core.deathmatch"],
      // A new map starts experimental (owner, 2026-11-11): promoted to core in Map properties once its gates pass.
      tier: "experimental"
    },
    classicStructure: { cellSize: 8, levelHeight: 4, theme: "core.prototype", tiles: [{ id: newId("tile"), tile: "core.room", x: 0, y: 0, z: 0, rotation: 0 }] },
    entities: [{ id: newId("spawn"), kind: "spawn", position: [0, 0, 0], yaw: 0, faction: null }],
    factions: [],
    logic: emptyLogic(),
    terrain: null,
    bounds: null,
    teamSetup: null,
    backdrop: null,
    blood: null,
    physics: null,
    dependencies: []
  };
}
function updateTileCommand(doc, before, after, catalog = coreCatalog) {
  const check = checkPlacement(doc, [after], [before.id], catalog);
  if (!check.ok) return { error: check.reason };
  return { kind: "updateTiles", before: [before], after: [after] };
}
function moveEntitiesCommand(doc, ids, dx, dy, dz) {
  const set = new Set(ids);
  const before = doc.entities.filter((e) => set.has(e.id));
  const r = (v) => Math.round(v * 1e3) / 1e3;
  const t = doc.terrain;
  const after = before.map((e) => {
    const moved = { ...e, position: [r(e.position[0] + dx), r(e.position[1] + dy), r(e.position[2] + dz)] };
    if (t && e.kind === "prop" && moved.kind === "prop" && !dy) {
      const was = settledPropY(t, e);
      const now = settledPropY(t, moved);
      if (was !== null && now !== null && Math.abs(e.position[1] - was) <= FLOAT_TOLERANCE) moved.position = [moved.position[0], now, moved.position[2]];
    }
    return moved;
  });
  return { kind: "updateEntities", before, after };
}
function settlePropsCommand(doc, ids) {
  const t = doc.terrain;
  const before = [];
  const after = [];
  if (!t) return { kind: "updateEntities", before, after };
  const want = ids ? new Set(ids) : null;
  const boxes = supportBoxes(doc);
  const floating = new Set(floatingProps(doc, boxes).map((f) => f.id));
  for (const e of doc.entities) {
    if (e.kind !== "prop" || want && !want.has(e.id)) continue;
    const y = settledPropY(t, e);
    if (y === null || Math.abs(y - e.position[1]) < 0.01) continue;
    const held = supportUnder(boxes, e.position[0], e.position[2], e.position[1], e.id);
    if (held > y + 0.05 && held >= e.position[1] - FLOAT_TOLERANCE) continue;
    const near = e.position[1] - y < FLOAT_TOLERANCE + 0.05 && e.position[1] - y > -1.5;
    if (!near && !floating.has(e.id)) continue;
    before.push(e);
    after.push({ ...e, position: [e.position[0], y, e.position[2]] });
  }
  return { kind: "updateEntities", before, after };
}
function parseModelChoice(choice) {
  const [model, v] = choice.split("#");
  const variant = v === void 0 ? void 0 : Number(v);
  return { model, variant: (getEnvSpecies(model) || getKitFamily(model)) && variant ? variant : void 0 };
}
function modelSize(model, variant) {
  const species = getEnvSpecies(model);
  if (species) return envVariant(species, variant).size;
  return getProp(model)?.size;
}
const measure = (size, keep) => size ? keep === "length" ? Math.max(size[0], size[2]) : size[1] : void 0;
function turnYaw(yaw, quarters) {
  if (!quarters) return yaw;
  let y = yaw + quarters * Math.PI / 2;
  while (y > Math.PI) y -= 2 * Math.PI;
  while (y <= -Math.PI) y += 2 * Math.PI;
  return Math.round(y * 1e4) / 1e4;
}
function replacePropsCommand(doc, from, to, size = "height", turn = 0) {
  const before = [];
  const after = [];
  const target = parseModelChoice(to);
  const newMeasure = measure(modelSize(target.model, target.variant), size);
  if (!newMeasure || target.model === from) return { kind: "updateEntities", before, after };
  for (const e of doc.entities) {
    if (e.kind !== "prop" || e.model !== from) continue;
    const oldMeasure = measure(modelSize(e.model, e.variant), size);
    const ratio = size !== "scale" && oldMeasure ? oldMeasure / newMeasure : 1;
    const scale = Math.round(Math.max(0.25, Math.min(4, e.scale * ratio)) * 100) / 100;
    const { variant: _old, ...rest } = e;
    const next = { ...rest, model: target.model, scale, yaw: turnYaw(e.yaw, turn), ...target.variant !== void 0 ? { variant: target.variant } : {} };
    const t = doc.terrain;
    const was = t ? settledPropY(t, e) : null;
    const now = t && was !== null && Math.abs(was - e.position[1]) <= 0.02 ? settledPropY(t, next) : null;
    before.push(e);
    after.push(now === null ? next : { ...next, position: [e.position[0], now, e.position[2]] });
  }
  return { kind: "updateEntities", before, after };
}
function paintCommand(doc, tileId, slot, style, scope = "surface") {
  const origin = doc.classicStructure.tiles.find((t) => t.id === tileId);
  if (!origin) return { kind: "updateTiles", before: [], after: [] };
  const inScope = (t) => scope === "surface" ? t.id === tileId : scope === "sameType" ? t.tile === origin.tile : scope === "level" ? t.z === origin.z : true;
  const before = [];
  const after = [];
  for (const t of doc.classicStructure.tiles) {
    if (!inScope(t)) continue;
    const current = t.surfaces?.[slot];
    const same = style === null ? current === void 0 : current?.material === style.material && (current.tint ?? null) === (style.tint ?? null);
    if (same) continue;
    const surfaces = { ...t.surfaces };
    if (style === null) delete surfaces[slot];
    else surfaces[slot] = { material: style.material, tint: style.tint ?? null };
    const next = { ...t, surfaces };
    if (Object.keys(surfaces).length === 0) delete next.surfaces;
    before.push(t);
    after.push(next);
  }
  return { kind: "updateTiles", before, after };
}
function setThemeCommand(doc, theme) {
  return { kind: "setTheme", before: doc.classicStructure.theme, after: theme };
}
const SCENARIO_PALETTE = [
  { key: "door", label: "Door", search: "door auto sliding gate" },
  { key: "door_locked", label: "Locked Door", search: "door locked key gate vault" },
  { key: "button", label: "Button", search: "button switch lever press use" },
  { key: "pad", label: "Jump Pad", search: "jump pad launch bounce boost trampoline" },
  { key: "ladder", label: "Ladder", search: "ladder climb wall up rungs" },
  { key: "zipline", label: "Zipline", search: "zipline zip line cable slide ride rope trolley flying fox cross chasm gap tower jungle" },
  { key: "flag", label: "Flag Base", search: "flag base ctf capture the flag team objective" },
  { key: "hill", label: "Hill", search: "hill king of the hill koth zone objective control point" },
  { key: "hostage", label: "Hostage", search: "hostage rescue civilian objective counter strike cs" },
  { key: "rescue", label: "Rescue Zone", search: "rescue zone hostage extraction objective" },
  { key: "bombsite", label: "Bomb Site", search: "bomb site plant defuse objective counter strike cs a b" },
  // Breakthrough (core.breakthrough): sectors in order, their objectives, and each side's spawn group per sector.
  { key: "sector", label: "Sector", search: "sector breakthrough line front assault attack defend push order rush conquest frontline" },
  { key: "objective:zone", label: "Capture Zone", search: "capture zone breakthrough sector objective flag point control hold take" },
  { key: "objective:target", label: "Destroy Target", search: "destroy target breakthrough sector objective charge plant defuse gun radio mcom demolish blow up" },
  { key: "objective:final", label: "Final Hold", search: "final hold breakthrough sector objective last capture zone end round command bunker" },
  { key: "spawn:attack", label: "Attackers' Spawn", search: "spawn group attackers breakthrough sector start landing assault team" },
  { key: "spawn:defend", label: "Defenders' Spawn", search: "spawn group defenders breakthrough sector start hold line team" },
  { key: "crate", label: "Crate", search: "crate box destructible break cover" },
  { key: "barrel", label: "Explosive Barrel", search: "barrel explosive destructible red boom" },
  { key: "wall", label: "Breakable Wall", search: "wall breakable destructible breach" },
  { key: "glass", label: "Window Pane", search: "glass window pane breakable shatter destructible" },
  { key: "block:glass", label: "Glass Panel", search: "glass panel pane window partition see through breakable shatter block wall" },
  { key: "block:glass_reinforced", label: "Bulletproof Glass", search: "glass bulletproof reinforced armoured panel window see through cracks block wall bank teller" },
  { key: "boards", label: "Board Barricade", search: "boards planks barricade doorway breakable destructible" },
  { key: "gas", label: "Gas Cylinder", search: "gas cylinder tank explosive destructible boom" },
  { key: "generator", label: "Generator", search: "generator machine objective destroy explosive destructible" },
  { key: "zone", label: "Trigger Zone", search: "zone trigger volume area region enter" },
  { key: "encounter", label: "NPC Squad", search: "npc squad encounter enemy soldiers spawner faction ai" },
  { key: "encounter:vent", label: "Ceiling Vent Spawner", search: "npc spawner vent ceiling duct drop squad enemy soldiers" },
  { key: "encounter:hatch", label: "Floor Hatch Spawner", search: "npc spawner hatch floor manhole sewer climb squad enemy soldiers" },
  { key: "encounter:burrow", label: "Burrow Spawner", search: "npc spawner burrow hole ground dig creatures monsters nest" },
  { key: "encounter:breach", label: "Wall Breach Spawner", search: "npc spawner breach broken wall hole crack squad enemy soldiers creatures" },
  { key: "trap:spikes", label: "Spike Floor", search: "trap spikes floor hazard" },
  { key: "trap:flames", label: "Flame Jet", search: "trap flame fire jet hazard burn" },
  { key: "trap:crusher", label: "Crusher", search: "trap crusher ceiling piston hazard" },
  { key: "trap:mine", label: "Proximity Mine", search: "trap mine explosive proximity hazard" },
  { key: "trap:laser", label: "Laser Fence", search: "trap laser beam fence tripwire hazard" },
  { key: "trap:shock", label: "Electric Fence", search: "trap electric fence park dino zoo shock zap wire posts barrier prop hazard border" },
  { key: "block:solid", label: "Sky Block", search: "block sky platform floating box stepping stone ledge solid" },
  { key: "block:crumble", label: "Crumbling Floor", search: "block crumble crumbling platform give way collapse falling floor" },
  { key: "block:trapdoor", label: "Trapdoor", search: "block trapdoor trap door fall drop pit floor hatch" },
  { key: "block:breakable", label: "Breakable Block", search: "block breakable destructible platform shoot" },
  { key: "light:ceiling", label: "Ceiling Light", search: "light lamp ceiling panel lighting bright interior indoor" },
  { key: "light:wall", label: "Wall Lamp", search: "light lamp wall sconce lighting bright" },
  { key: "light:bulb", label: "Light Bulb", search: "light bulb lamp hanging lighting bright" },
  { key: "light:strip", label: "Strip Light", search: "light strip neon fluorescent tube lighting bright" },
  { key: "light:none", label: "Hidden Light", search: "light glow fill hidden invisible lighting bright" },
  { key: "water:water", label: "Water", search: "water pool lake river swim liquid" },
  { key: "water:lava", label: "Lava", search: "lava magma liquid hazard burn" },
  { key: "water:acid", label: "Acid", search: "acid toxic liquid hazard pool" },
  { key: "water:swamp", label: "Swamp", search: "swamp mud bog marsh liquid slow" },
  { key: "airplane", label: "Drop Carrier", search: "drop carrier airplane plane transport air drop parachute route fly over battle royale jump" },
  { key: "airplane:dropship", label: "Dropship Drop", search: "dropship drop ship gunship air drop parachute route fly over battle royale jump transport" },
  { key: "mover:lift", label: "Lift", search: "mover lift elevator platform moving up down ride" },
  { key: "mover:slider", label: "Sliding Wall", search: "mover sliding wall door gate moving platform train car shuttle" },
  { key: "mover:drawbridge", label: "Drawbridge", search: "mover drawbridge bridge hinge lower raise castle moat" },
  // Style Pack gameplay pieces (04 Orbital Station, 07 Neon Megacity).
  { key: "block:field", label: "Force Field", search: "force field energy shield barrier laser gate sci-fi orbital station blocks players not shots hum logic" },
  { key: "zone:lowgrav", label: "Low-Gravity Zone", search: "low gravity zone moon float drift space reactor jump orbital station" },
  { key: "light:sign", label: "Neon Sign", search: "neon sign signage glow lit letters shop bar light logic neon megacity cyberpunk" },
  { key: "light:billboard", label: "Holo Billboard", search: "billboard hologram holographic screen advert sign emissive light logic neon megacity cyberpunk" },
  { key: "mover:elevator", label: "Tower Elevator", search: "mover elevator lift tower floors storeys cab ride up down neon megacity" },
  { key: "mover:tram", label: "Sky Tram", search: "mover tram skytrain transit train car shuttle cable car ride moving platform neon megacity" },
  // Style Pack gameplay pieces (01 Military Compound, 02 Frontier Dust), built on the same systems.
  { key: "door:blast", label: "Blast Door", search: "door blast security bunker military compound heavy steel hazard" },
  { key: "door:saloon", label: "Saloon Doors", search: "door saloon swinging batwing western frontier" },
  { key: "door:vault", label: "Vault Door", search: "door vault bank safe locked round steel heist frontier" },
  { key: "light:alarm", label: "Alarm Light", search: "light alarm red blinking beacon siren security military logic" },
  { key: "block:barrier", label: "Destructible Barrier", search: "block barrier destructible concrete breakable military cover" },
  { key: "block:planks", label: "Breakable Planks", search: "block planks wood breakable boards wall western frontier" },
  { key: "mover:minecart", label: "Mine Cart", search: "mover mine cart rails ride ore western frontier" },
  { key: "mover:train", label: "Steam Train", search: "mover train locomotive railroad rails ride western frontier wagon" },
  // Style Pack gameplay pieces (05 Gothic Estate, 06 Jungle Ruins, 08 Suburban Chaos), built on the same systems.
  { key: "mover:bookcase", label: "Secret Bookcase", search: "mover secret door bookcase bookshelf hidden passage slide logic gothic manor library" },
  { key: "mover:shelf", label: "Moving Bookshelf", search: "mover moving bookshelf bookcase cover sliding gothic manor library" },
  { key: "block:rotten", label: "Rotten Floorboards", search: "block rotten floor floorboards crumble give way breakable floor gothic manor attic" },
  { key: "light:candle", label: "Candelabra", search: "light candle candelabra flicker gothic manor horror logic" },
  { key: "light:chandelier", label: "Chandelier", search: "light chandelier candles flicker hanging gothic manor horror logic" },
  { key: "block:rope_bridge", label: "Rope Bridge", search: "block rope bridge planks sag crumble jungle ruins chasm river" },
  { key: "block:old_planks", label: "Crumbling Planks", search: "block planks crumble rope bridge give way jungle ruins" },
  { key: "ladder:vines", label: "Climbing Vines", search: "ladder vines climb creepers jungle ruins wall cliff" },
  { key: "trap:rockfall", label: "Falling Rocks", search: "trap rockfall falling rocks boulders crusher zone jungle ruins cave" },
  { key: "mover:garage_door", label: "Garage Door", search: "mover garage door up and over roll up logic suburban house" },
  { key: "block:fence", label: "Breakable Fence", search: "block fence picket breakable wood suburban garden yard" },
  { key: "block:roof", label: "Pitched Roof", search: "block roof pitched gable slate shingles house suburban" },
  { key: "water:pool", label: "Pool Water", search: "water pool swimming blue suburban" },
  // Style Pack gameplay pieces (03 Imperial Arena, 09 Sands of Egypt).
  { key: "portal", label: "Portal Pair", search: "portal teleport teleporter gate warp pair link shortcut swirl stargate arena egypt tomb" },
  { key: "door:portcullis", label: "Portcullis", search: "door portcullis gate iron grille bars raise arena gladiator castle roman" },
  { key: "mover:portcullis", label: "Portcullis Gate", search: "mover portcullis gate iron grille bars raise lift wide arena gladiator roman logic" },
  { key: "mover:cage", label: "Lift Cage", search: "mover lift cage elevator hypogeum arena floor rise beast gladiator roman hatch" },
  { key: "light:brazier", label: "Brazier", search: "light brazier fire torch flame bowl warm roman egypt temple" },
  // Style Pack gameplay pieces (10 Medieval Village).
  { key: "door:oak", label: "Oak Door", search: "door oak wooden plank ironbound iron bound hinged medieval village house castle" },
  { key: "block:wattle", label: "Wattle Hurdle", search: "block wattle hurdle fence woven breakable wood medieval village farm" },
  // Style Pack gameplay pieces (12 Snow Outpost).
  { key: "mover:rollup_door", label: "Roll-up Door", search: "mover roll up rolling shutter door hangar garage warehouse wide steel logic snow outpost" },
  { key: "block:ice", label: "Ice Block", search: "block ice glacier breakable shatter cover frozen snow outpost" },
  { key: "block:thin_ice", label: "Thin Ice", search: "block thin ice frozen lake crack give way fall water trap snow" },
  // Style Pack gameplay pieces (11 Coastal Harbor).
  { key: "water:harbour", label: "Harbour Water", search: "water harbour harbor sea deep swim boat quay pier coast" },
  // Style Pack gameplay pieces (09 Desert City).
  { key: "block:lattice", label: "Lattice Screen", search: "block lattice screen mashrabiya window wood breakable desert city arab middle eastern" }
];
const snapsToDoorway = (key) => key === "door" || key === "door_locked" || key.startsWith("door:") || key === "wall" || key === "glass" || key === "boards" || key === "trap:laser" || key === "block:field" || key === "block:glass" || key === "block:glass_reinforced" || key === "mover:bookcase" || key === "mover:garage_door" || key === "mover:rollup_door" || key === "mover:portcullis";
const MULTI_KEYS = /* @__PURE__ */ new Set(["block:rope_bridge", "block:roof"]);
function newScenarioEntities(key, position, yaw, doc) {
  if (key === "portal") return newPortalPair(position, yaw, doc);
  if (!key.startsWith("mover:") && !MULTI_KEYS.has(key)) return [newScenarioEntity(key, position, yaw, doc)];
  const block = (size, at) => ({ id: newId("block"), kind: "block", position: at, yaw, size, material: null, tint: null, behaviour: "solid", trigger: "step", delaySeconds: 0.8, respawnSeconds: 8, health: 120 });
  const mover = (blocks, points, extra) => ({ id: newId("mover"), kind: "mover", position, yaw, blocks, points, mode: "pingpong", speed: 2, turnSpeed: 45, wait: 2, startActive: true, ...extra });
  const [x, y, z] = position;
  const along = (d) => [Math.round(Math.sin(yaw) * d * 100) / 100, Math.round(Math.cos(yaw) * d * 100) / 100];
  const prop = (model, d, turn = 0) => {
    const [dx, dz] = along(d);
    return { id: newId("prop"), kind: "prop", model, position: [x + dx, y, z + dz], yaw: yaw + turn, scale: 1, solid: false, tint: null };
  };
  const hull = (size, d, y0, material, tint) => {
    const [dx, dz] = along(d);
    return { ...block(size, [x + dx, y + y0, z + dz]), material, tint };
  };
  if (key === "mover:minecart") {
    const b2 = hull([0.96, 0.72, 1.24], 0, 0.14, "core.pbr_rock", "#5a5048");
    const cart = prop("prop.mine_cart", 0);
    const [ex, ez] = along(12);
    return [b2, cart, { ...mover([b2.id], [[0, 0, 0], [ex, 0, ez]], { speed: 3, wait: 2 }), props: [cart.id] }];
  }
  if (key === "mover:train") {
    const loco = prop("prop.locomotive_red", 0, Math.PI);
    const cars = [prop("prop.flatbed_wagon", -7.4), prop("prop.flatbed_wagon", -14.9)];
    const dark = "#2e2c2a";
    const blocks = [hull([2, 2, 3.6], 1.5, 0.6, "core.pbr_steel", dark), hull([2.9, 3.1, 2.8], -1.8, 0.6, "core.pbr_steel", dark), ...cars.map((c, i) => hull([2.7, 0.35, 6.6], -7.4 - 7.5 * i, 0.55, "core.pbr_weathered_planks", null))];
    const [ex, ez] = along(60);
    return [...blocks, loco, ...cars, { ...mover(blocks.map((b2) => b2.id), [[0, 0, 0], [ex, 0, ez]], { speed: 8, wait: 6 }), props: [loco.id, ...cars.map((c) => c.id)] }];
  }
  if (key === "mover:portcullis") {
    const b2 = { ...block([3.2, 3.2, 0.2], [x, y, z]), material: "core.grate", tint: "#5a524a", name: "Portcullis" };
    return [b2, mover([b2.id], [[0, 0, 0], [0, 3.4, 0]], { mode: "trigger", speed: 1.2, wait: 0, name: "Portcullis" })];
  }
  if (key === "mover:cage") {
    const up = doc?.classicStructure.levelHeight ?? 4;
    const [fx, fz] = [Math.sin(yaw), Math.cos(yaw)];
    const [rx, rz] = [Math.cos(yaw), -Math.sin(yaw)];
    const at = (across, along2, dy) => [Math.round((x + rx * across + fx * along2) * 100) / 100, y + dy, Math.round((z + rz * across + fz * along2) * 100) / 100];
    const floor = { ...block([3, 0.3, 3], [x, y, z]), material: "core.pbr_weathered_planks", name: "Cage floor" };
    const bars = { material: "core.grate", tint: "#4a4440" };
    const sides = [
      { ...block([0.2, up - 0.6, 3], at(-1.4, 0, 0.3)), ...bars },
      { ...block([0.2, up - 0.6, 3], at(1.4, 0, 0.3)), ...bars },
      { ...block([3, up - 0.6, 0.2], at(0, -1.4, 0.3)), ...bars }
    ];
    const hatch = { ...block([3, 0.3, 3], [x, y + up - 0.3, z]), material: "core.pbr_sand", name: "Hatch" };
    const parts = [floor, ...sides, hatch];
    return [...parts, mover(parts.map((b2) => b2.id), [[0, 0, 0], [0, up, 0]], { speed: 1.5, wait: 4, name: "Lift cage" })];
  }
  const local = (s, up, d) => [Math.round((x + Math.cos(yaw) * s + Math.sin(yaw) * d) * 100) / 100, Math.round((y + up) * 100) / 100, Math.round((z - Math.sin(yaw) * s + Math.cos(yaw) * d) * 100) / 100];
  if (key === "mover:bookcase" || key === "mover:shelf") {
    const secret = key === "mover:bookcase";
    const b2 = { ...block(secret ? [3, 3, 0.5] : [2.2, 3, 0.6], [x, y, z]), material: "core.pbr_walnut", tint: "#6a4a34" };
    const shelf = { ...prop("prop.ge_bookcase_tall", secret ? 0.27 : 0.32), position: local(0, 0, secret ? 0.27 : 0.32) };
    const [ex, , ez] = local(secret ? 3.2 : 4, 0, 0);
    const end = [Math.round((ex - x) * 100) / 100, 0, Math.round((ez - z) * 100) / 100];
    return [b2, shelf, { ...mover([b2.id], [[0, 0, 0], end], secret ? { mode: "trigger", speed: 1.2, wait: 0, name: "Secret bookcase" } : { speed: 0.8, wait: 3, name: "Moving bookshelf" }), props: [shelf.id] }];
  }
  if (key === "mover:rollup_door") {
    const b2 = { ...block([6, 4.6, 0.2], [x, y, z]), material: "core.pbr_grey_corrugated", tint: "#d8dce0", name: "Roll-up door" };
    return [b2, mover([b2.id], [[0, 0, 0], [0, 4.4, 0]], { mode: "trigger", speed: 1.6, wait: 0, name: "Roll-up door" })];
  }
  if (key === "mover:garage_door") {
    const b2 = { ...block([3.6, 2.8, 0.2], [x, y, z]), material: "core.pbr_white_panel", tint: "#f0eee8" };
    return [b2, { ...mover([b2.id], [[0, 0, 0], [0, 0, 0]], { angles: [0, -Math.PI / 2], mode: "trigger", turnSpeed: 60, wait: 0, name: "Garage door" }), position: [x, y + 2.8, z] }];
  }
  if (key === "block:rope_bridge") {
    const L = 12;
    const n = 8;
    const sag = (d) => -4 * 0.6 * (d / L) * (1 - d / L);
    const planks = Array.from({ length: n }, (_, i) => {
      const d = (i + 0.5) * (L / n);
      const pitch = Math.round(Math.atan(-4 * 0.6 * (1 - 2 * d / L) / L) * 1e3) / 1e3;
      const rotten = i === 3 || i === 4;
      return { ...block([2.4, 0.15, L / n + 0.04], local(0, Math.round((sag(d) - 0.15) * 100) / 100, d)), material: "core.pbr_weathered_planks", tint: rotten ? "#8a7a68" : null, behaviour: rotten ? "crumble" : "solid", delaySeconds: 0.6, respawnSeconds: 10, ...pitch ? { pitch } : {} };
    });
    const posts = [prop("prop.jg_bridge_post", 0), prop("prop.jg_bridge_post", L, Math.PI)].map((p) => ({ ...p, solid: false }));
    return [...planks, ...posts];
  }
  if (key === "block:roof") {
    const pitch = 0.6;
    const span = 4.4;
    const slope = Math.round(span / Math.cos(pitch) * 100) / 100;
    const rise = Math.tan(pitch) * span;
    const mid = Math.round((rise / 2 - 0.4 * Math.tan(pitch) - 0.11) * 100) / 100;
    return [-1, 1].map((sgn) => ({ ...block([8.8, 0.22, slope], local(0, mid, sgn * (span / 2 - 0.4))), material: "core.pbr_slate_roof", pitch: -sgn * pitch }));
  }
  if (key === "mover:lift") {
    const b2 = block([3, 0.4, 3], [x, y, z]);
    return [b2, mover([b2.id], [[0, 0, 0], [0, doc?.classicStructure.levelHeight ?? 4, 0]], { speed: 2, wait: 2.5 })];
  }
  if (key === "mover:elevator") {
    const up = 3 * (doc?.classicStructure.levelHeight ?? 4);
    const floor = block([3, 0.3, 3], [x, y, z]);
    return [floor, mover([floor.id], [[0, 0, 0], [0, up, 0]], { speed: 3, wait: 3, name: "Elevator" })];
  }
  if (key === "mover:tram") {
    const [fx, fz] = [Math.sin(yaw), Math.cos(yaw)];
    const floor = block([3, 0.3, 7], [x, y, z]);
    const roof = block([3.2, 0.25, 7.2], [x, y + 3, z]);
    const posts = [[-1.4, -3.3], [1.4, -3.3], [-1.4, 3.3], [1.4, 3.3]].map(([px, pz]) => block([0.2, 2.7, 0.2], [Math.round((x + px * Math.cos(yaw) + pz * fx) * 100) / 100, y + 0.3, Math.round((z - px * Math.sin(yaw) + pz * fz) * 100) / 100]));
    const parts = [floor, roof, ...posts];
    return [...parts, mover(parts.map((b2) => b2.id), [[0, 0, 0], [Math.round(fx * 2400) / 100, 0, Math.round(fz * 2400) / 100]], { speed: 4, wait: 4, name: "Sky tram" })];
  }
  if (key === "mover:slider") {
    const [sx, sz] = [Math.cos(yaw) * 4, -Math.sin(yaw) * 4];
    const b2 = block([4, 3, 0.4], [x, y, z]);
    return [b2, mover([b2.id], [[0, 0, 0], [Math.round(sx * 100) / 100, 0, Math.round(sz * 100) / 100]], { speed: 1.5, wait: 3 })];
  }
  const b = block([3, 0.3, 8], [x + Math.sin(yaw) * 4, y, z + Math.cos(yaw) * 4]);
  return [b, mover([b.id], [[0, 0, 0], [0, 0, 0]], { angles: [Math.PI / 2, 0], mode: "trigger", turnSpeed: 30, wait: 0 })];
}
function freePair(doc) {
  const taken = new Set(doc?.entities.flatMap((e) => e.kind === "portal" ? [e.pair] : []) ?? []);
  for (let i = 0; ; i++) {
    const id = i < 26 ? String.fromCharCode(97 + i) : `p${i + 1}`;
    if (!taken.has(id)) return id;
  }
}
const PORTAL_COLORS = [
  ["#3aa8ff", "#ff8a2a"],
  ["#4dff9a", "#c06bff"],
  ["#ffe14d", "#ff4d8a"]
];
function newPortalPair(position, yaw, doc) {
  const pair = freePair(doc);
  const n = doc?.entities.filter((e) => e.kind === "portal").length ?? 0;
  const [ca, cb] = PORTAL_COLORS[Math.floor(n / 2) % PORTAL_COLORS.length];
  const [x, y, z] = position;
  const far = [Math.round((x + Math.sin(yaw) * 8) * 100) / 100, y, Math.round((z + Math.cos(yaw) * 8) * 100) / 100];
  const portal = (at, facing, color) => ({ id: newId("portal"), kind: "portal", position: at, yaw: facing, size: [2.4, 3.2], pair, startEnabled: true, color });
  return [portal(position, yaw, ca), portal(far, yaw + Math.PI, cb)];
}
function newScenarioEntity(key, position, yaw, doc) {
  const base = { position, yaw };
  switch (key) {
    case "flag": {
      const teams = doc ? mapTeams(doc, 2) : DEFAULT_TEAMS.slice(0, 2);
      const free = teams.find((t) => !doc?.entities.some((e) => e.kind === "flag" && e.team === t.id)) ?? teams[0];
      return { id: newId("flag"), kind: "flag", ...base, team: free.id };
    }
    case "hill":
      return { id: newId("hill"), kind: "hill", position, radius: 5 };
    case "hostage":
      return { id: newId("hostage"), kind: "hostage", position, yaw: 0 };
    case "rescue":
      return { id: newId("rescue"), kind: "rescue", position, radius: 4 };
    case "bombsite": {
      const n = doc?.entities.filter((e) => e.kind === "bombsite").length ?? 0;
      return { id: newId("site"), kind: "bombsite", position, label: String.fromCharCode(65 + Math.min(n, 25)), radius: 4 };
    }
    case "sector":
      return { id: newId("sector"), kind: "sector", position, yaw, order: Math.min(BREAKTHROUGH_MAX_SECTORS, nextSectorOrder(doc)) };
    case "objective:zone":
    case "objective:target":
    case "objective:final": {
      const objective = key.slice(10);
      const sector = latestSector(doc);
      const letter = String.fromCharCode(65 + (sector - 1) % 26);
      const n = (doc?.entities.filter((e) => e.kind === "objective" && e.sector === sector && e.objective !== "final").length ?? 0) + 1;
      const radius = objective === "target" ? 2.5 : objective === "final" ? 8 : 6;
      return { id: newId("objective"), kind: "objective", position, yaw, objective, sector, label: objective === "final" ? letter : `${letter}${Math.min(n, 99)}`, radius };
    }
    case "spawn:attack":
    case "spawn:defend":
      return { id: newId("spawn"), kind: "spawn", position, yaw, faction: null, sector: latestSector(doc), side: key === "spawn:attack" ? "attack" : "defend" };
    case "door":
    case "door_locked":
      return { id: newId("door"), kind: "door", ...base, startOpen: false, locked: key === "door_locked", auto: key === "door" };
    case "door:blast":
      return { id: newId("door"), kind: "door", ...base, startOpen: false, locked: false, auto: false, style: "blast" };
    case "door:saloon":
      return { id: newId("door"), kind: "door", ...base, startOpen: false, locked: false, auto: true, style: "saloon" };
    case "door:vault":
      return { id: newId("door"), kind: "door", ...base, startOpen: false, locked: true, auto: false, style: "vault" };
    case "light:brazier":
      return { id: newId("light"), kind: "light", position, yaw, color: "#ff9a3c", intensity: 1.4, range: 11, fixture: "bulb", blink: 0.4 };
    case "door:oak":
      return { id: newId("door"), kind: "door", ...base, startOpen: false, locked: false, auto: true, style: "oak" };
    case "door:portcullis":
      return { id: newId("door"), kind: "door", ...base, startOpen: false, locked: false, auto: false, style: "portcullis" };
    case "light:alarm":
      return { id: newId("light"), kind: "light", position, yaw, color: "#ff3020", intensity: 1.6, range: 12, fixture: "bulb", off: true, blink: 2.5 };
    case "light:candle":
      return { id: newId("light"), kind: "light", position, yaw, color: "#ffb45a", intensity: 0.9, range: 7, fixture: "candle" };
    case "light:chandelier":
      return { id: newId("light"), kind: "light", position, yaw, color: "#ffc070", intensity: 1.4, range: 12, fixture: "chandelier" };
    case "block:rotten":
      return { id: newId("block"), kind: "block", position, yaw: 0, size: [3, 0.3, 3], material: "core.pbr_floorboards", tint: "#9a8a7a", behaviour: "crumble", trigger: "step", delaySeconds: 0.5, respawnSeconds: 15, health: 120 };
    case "block:old_planks":
      return { id: newId("block"), kind: "block", position, yaw, size: [2.4, 0.15, 1.5], material: "core.pbr_weathered_planks", tint: "#8a7a68", behaviour: "crumble", trigger: "step", delaySeconds: 0.4, respawnSeconds: 12, health: 120 };
    case "block:lattice":
      return { id: newId("block"), kind: "block", position, yaw, size: [2.2, 2.4, 0.12], material: "core.mashrabiya", tint: null, behaviour: "breakable", trigger: "step", delaySeconds: 0.8, respawnSeconds: 30, health: 45 };
    case "block:wattle":
      return { id: newId("block"), kind: "block", position, yaw, size: [2.4, 1.2, 0.15], material: "core.wattle", tint: null, behaviour: "breakable", trigger: "step", delaySeconds: 0.8, respawnSeconds: 25, health: 50 };
    case "block:ice":
      return { id: newId("block"), kind: "block", position, yaw, size: [2, 1.4, 1], material: "core.glacier_ice", tint: null, behaviour: "breakable", trigger: "step", delaySeconds: 0.8, respawnSeconds: 30, health: 150 };
    case "block:thin_ice":
      return { id: newId("block"), kind: "block", position, yaw, size: [4, 0.15, 4], material: "core.lake_ice", tint: "#c8e4f0", behaviour: "crumble", trigger: "step", delaySeconds: 0.7, respawnSeconds: 12, health: 60 };
    case "block:fence":
      return { id: newId("block"), kind: "block", position, yaw, size: [4, 1.1, 0.2], material: "core.paint_matte", tint: "#f2f0ea", behaviour: "breakable", trigger: "step", delaySeconds: 0.8, respawnSeconds: 25, health: 40 };
    case "ladder:vines":
      return { id: newId("ladder"), kind: "ladder", ...base, height: 6, width: 1.2, style: "vines" };
    case "trap:rockfall":
      return { id: newId("rockfall"), kind: "trap", trap: "crusher", ...base, activation: "proximity", onSeconds: 1.2, offSeconds: 8, offsetSeconds: 0, startEnabled: true, damage: null, style: "rockfall" };
    case "water:harbour":
      return { id: newId("harbour"), kind: "water", position, size: [16, 2.5, 16], liquid: "water", tint: "#2e5a66" };
    case "water:pool":
      return { id: newId("pool"), kind: "water", position, size: [5, 1.75, 12], liquid: "water", tint: "#3fc8e8" };
    case "block:rope_bridge":
    case "block:roof":
      return newScenarioEntities(key, position, yaw, doc)[0];
    case "block:barrier":
      return { id: newId("block"), kind: "block", position, yaw, size: [3, 1.1, 0.8], material: "core.pbr_bunker_panels", tint: null, behaviour: "breakable", trigger: "step", delaySeconds: 0.8, respawnSeconds: 30, health: 400 };
    case "block:planks":
      return { id: newId("block"), kind: "block", position, yaw, size: [3, 3, 0.25], material: "core.pbr_weathered_planks", tint: null, behaviour: "breakable", trigger: "step", delaySeconds: 0.8, respawnSeconds: 20, health: 80 };
    case "button":
      return { id: newId("button"), kind: "button", ...base, label: "Press", once: false, cooldownSeconds: 1, startEnabled: true };
    case "pad":
      return { id: newId("pad"), kind: "pad", ...base, power: 14, push: 6 };
    case "ladder":
      return { id: newId("ladder"), kind: "ladder", ...base, height: 4, width: 0.9 };
    case "zipline": {
      const [dx, dz] = [Math.round(Math.sin(yaw) * 1600) / 100, Math.round(Math.cos(yaw) * 1600) / 100];
      return { id: newId("zipline"), kind: "zipline", position, end: [dx, 0, dz], height: 3.6, speed: 12, twoWay: false, sag: 0.03 };
    }
    case "crate":
    case "barrel":
    case "wall":
    case "glass":
    case "boards":
    case "gas":
    case "generator":
      return { id: newId(key), kind: "destructible", model: key, ...base, health: null, explosiveOnly: false };
    case "zone":
      return { id: newId("zone"), kind: "zone", position, size: [4, 3, 4], who: "any", count: 1, startEnabled: true };
    case "encounter":
    case "encounter:vent":
    case "encounter:hatch":
    case "encounter:burrow":
    case "encounter:breach": {
      const entrance = key.slice(10) || "none";
      const creatures = entrance === "burrow";
      return {
        id: newId("squad"),
        kind: "encounter",
        position,
        yaw,
        faction: "syndicate",
        roster: creatures ? { trooper: 0, gunner: 0, heavy: 0, imp: 2, puglin: 1, cyclops: 0, oculus: 0, scolitex: 0 } : { trooper: 2, gunner: 1, heavy: 0, imp: 0, puglin: 0, cyclops: 0, oculus: 0, scolitex: 0 },
        activeCap: 4,
        reinforcements: entrance === "none" ? 0 : 3,
        perPlayer: 1,
        respawnSeconds: 4,
        radius: 3,
        order: "hold",
        orderTarget: null,
        startActive: true,
        difficulty: "normal",
        entrance,
        ventHeight: 3.5
      };
    }
    case "block:solid":
    case "block:crumble":
    case "block:trapdoor":
    case "block:breakable": {
      const behaviour = key.slice(6);
      return { id: newId("block"), kind: "block", position, yaw: 0, size: [4, 0.5, 4], material: null, tint: null, behaviour, trigger: "step", delaySeconds: behaviour === "trapdoor" ? 0.15 : 0.8, respawnSeconds: 8, health: 120 };
    }
    case "light:ceiling":
    case "light:wall":
    case "light:bulb":
    case "light:strip":
    case "light:none": {
      const fixture = key.slice(6);
      return { id: newId("light"), kind: "light", position, yaw, color: fixture === "strip" ? "#e8f4ff" : "#fff1d6", intensity: 1, range: fixture === "none" ? 12 : 10, fixture };
    }
    case "light:sign":
      return { id: newId("light"), kind: "light", position, yaw, color: "#ff4fd8", intensity: 1.2, range: 8, fixture: "sign", text: "OPEN" };
    case "light:billboard":
      return { id: newId("light"), kind: "light", position, yaw, color: "#4fe0ff", intensity: 1.5, range: 14, fixture: "billboard", text: "TILE TRIGGER" };
    case "block:glass":
    case "block:glass_reinforced":
      return { id: newId("glass"), kind: "block", position, yaw, size: [3, 3, 0.06], material: null, tint: null, behaviour: "solid", trigger: "logic", delaySeconds: 0.8, respawnSeconds: null, health: 120, glass: key === "block:glass" ? "breakable" : "reinforced" };
    case "block:field":
      return { id: newId("field"), kind: "block", position, yaw, size: [3, 3, 0.2], material: null, tint: "#5ad8ff", behaviour: "solid", trigger: "logic", delaySeconds: 0.8, respawnSeconds: null, health: 120, field: true };
    case "zone:lowgrav":
      return { id: newId("zone"), kind: "zone", position, size: [8, 8, 8], who: "any", count: 1, startEnabled: true, gravity: 0.35, name: "Low gravity" };
    case "airplane":
      return { id: newId("plane"), kind: "airplane", position, route: [[-80, -80], [80, -80], [80, 80], [-80, 80]], altitude: 70, loopSeconds: 60, closed: true, airdrop: "off" };
    case "airplane:dropship":
      return { id: newId("dropship"), kind: "airplane", craft: "dropship", position, route: [[-140, 0], [0, 0], [140, 0]], altitude: 45, loopSeconds: 30, closed: false, airdrop: "off" };
    case "water:water":
    case "water:lava":
    case "water:acid":
    case "water:swamp":
      return { id: newId(key.slice(6)), kind: "water", position, size: [8, 1.2, 8], liquid: key.slice(6) };
    case "mover:lift":
    case "mover:slider":
    case "mover:drawbridge":
    case "mover:elevator":
    case "mover:tram":
    case "mover:minecart":
    case "mover:train":
    case "mover:bookcase":
    case "mover:shelf":
    case "mover:garage_door":
    case "mover:rollup_door": {
      const all = newScenarioEntities(key, position, yaw, doc);
      return all[all.length - 1];
    }
    default: {
      const trap = key.slice(5);
      const d = TRAP_SPECS[trap].defaults;
      return { id: newId(trap), kind: "trap", trap, ...base, activation: d.activation, onSeconds: d.onSeconds, offSeconds: d.offSeconds, offsetSeconds: 0, startEnabled: true, damage: null, ...trap === "shock" ? { length: ELECTRIC_FENCE.defaultLength } : {} };
    }
  }
}
function snapToDoorway(x, z, cellSize) {
  const half = cellSize / 2;
  const ex = Math.round((x - half) / cellSize) * cellSize + half;
  const ez = Math.round(z / cellSize) * cellSize;
  const nx = Math.round(x / cellSize) * cellSize;
  const nz = Math.round((z - half) / cellSize) * cellSize + half;
  return Math.hypot(x - ex, z - ez) <= Math.hypot(x - nx, z - nz) ? { x: ex, z: ez, yaw: Math.PI / 2 } : { x: nx, z: nz, yaw: 0 };
}
const BREAKTHROUGH_OBJECTIVE_LABELS = { zone: "Capture Zone", target: "Destroy Target", final: "Final Hold" };
const nextSectorOrder = (doc) => 1 + Math.max(0, ...(doc?.entities ?? []).flatMap((e) => e.kind === "sector" ? [e.order] : []));
const latestSector = (doc) => Math.max(1, ...(doc?.entities ?? []).flatMap((e) => e.kind === "sector" ? [e.order] : []));
const sectorOrders = (doc) => [...new Set(doc.entities.flatMap((e) => e.kind === "sector" ? [e.order] : []))].sort((a, b) => a - b);
const KIND_LABELS = { spawn: "Spawn", pickup: "Pickup", door: "Door", button: "Button", destructible: "Object", zone: "Zone", trap: "Trap", encounter: "Encounter", prop: "Prop", mount: "Vehicle", pad: "Jump Pad", block: "Block", water: "Water", flag: "Flag Base", hill: "Hill", ladder: "Ladder", bombsite: "Bomb Site", hostage: "Hostage", rescue: "Rescue Zone", light: "Light", airplane: "Drop Carrier", mover: "Mover", portal: "Portal", zipline: "Zipline", sector: "Sector", objective: "Objective" };
function entityKindLabel(e) {
  if (e.kind === "trap") return TRAP_SPECS[e.trap].label;
  if (e.kind === "destructible") return DESTRUCTIBLE_SPECS[e.model].label;
  if (e.kind === "prop") return getProp(e.model)?.displayName ?? "Prop";
  return KIND_LABELS[e.kind];
}
function entityNumberKey(e) {
  return e.kind === "trap" ? `trap:${e.trap}` : e.kind === "destructible" ? `destructible:${e.model}` : e.kind === "prop" ? `prop:${e.model}` : e.kind;
}
function entityLabel(doc, e, number) {
  if (e.name) return e.kind === "sector" ? `Sector ${e.order}: ${e.name}` : e.name;
  if (e.kind === "sector") return `Sector ${e.order}`;
  if (e.kind === "objective") return `${BREAKTHROUGH_OBJECTIVE_LABELS[e.objective]} ${e.label}`;
  if (number === void 0) {
    const key = entityNumberKey(e);
    number = doc.entities.filter((o) => entityNumberKey(o) === key).indexOf(e) + 1;
  }
  return `${entityKindLabel(e)} ${number}`;
}
const OPPOSITE_SIDE = { N: "S", E: "W", S: "N", W: "E" };
function edgeTargetAt(doc, point, normal, catalog = coreCatalog) {
  const { cellSize, levelHeight } = doc.classicStructure;
  const { cells } = buildOccupancy(doc, catalog);
  for (const k of [0.3, -0.8]) {
    const q = point.map((v, i) => v + normal[i] * k);
    const cell = [Math.round(q[0] / cellSize) + 0, Math.round(q[2] / cellSize) + 0, Math.floor((q[1] + 0.01) / levelHeight) + 0];
    if (!cells.has(cellKey(...cell))) continue;
    const dx = q[0] - cell[0] * cellSize;
    const dz = q[2] - cell[1] * cellSize;
    const side = Math.abs(dx) > Math.abs(dz) ? dx > 0 ? "E" : "W" : dz > 0 ? "N" : "S";
    return { cell, side };
  }
  return null;
}
function setEdgeCommand(doc, target, style, catalog = coreCatalog) {
  const { cells } = buildOccupancy(doc, catalog);
  const here = cells.get(cellKey(...target.cell));
  if (!here) return { error: "no tile there" };
  const [dx, dy] = SIDE_DIRS[target.side];
  const there = cells.get(cellKey(target.cell[0] + dx, target.cell[1] + dy, target.cell[2]));
  if (there?.placement === here.placement) return { error: "that side is inside one piece" };
  const withEdge = (t, key, value) => {
    const edges = { ...t.edges ?? {} };
    if (value === null || value === "auto") delete edges[key];
    else edges[key] = value;
    const { edges: _old, ...rest } = t;
    return Object.keys(edges).length ? { ...rest, edges } : rest;
  };
  const before = [here.placement];
  const after = [withEdge(here.placement, edgeKey(here.local, localSide(target.side, here.placement.rotation)), style)];
  if (there) {
    const key = edgeKey(there.local, localSide(OPPOSITE_SIDE[target.side], there.placement.rotation));
    if (there.placement.edges?.[key] !== void 0) {
      before.push(there.placement);
      after.push(withEdge(there.placement, key, null));
    }
  }
  return { kind: "updateTiles", before, after };
}
function edgeChoiceAt(doc, target, catalog = coreCatalog) {
  const { cells } = buildOccupancy(doc, catalog);
  const here = cells.get(cellKey(...target.cell));
  if (!here) return "auto";
  const own = here.placement.edges?.[edgeKey(here.local, localSide(target.side, here.placement.rotation))];
  if (own) return own;
  const [dx, dy] = SIDE_DIRS[target.side];
  const there = cells.get(cellKey(target.cell[0] + dx, target.cell[1] + dy, target.cell[2]));
  return (there && there.placement.edges?.[edgeKey(there.local, localSide(OPPOSITE_SIDE[target.side], there.placement.rotation))]) ?? "auto";
}
function setEdgeGlassCommand(doc, target, glass, catalog = coreCatalog) {
  const { cells } = buildOccupancy(doc, catalog);
  const here = cells.get(cellKey(...target.cell));
  if (!here) return { error: "no tile there" };
  const [dx, dy] = SIDE_DIRS[target.side];
  const there = cells.get(cellKey(target.cell[0] + dx, target.cell[1] + dy, target.cell[2]));
  if (there?.placement === here.placement) return { error: "that side is inside one piece" };
  const withGlass = (t, key, value) => {
    const glass2 = { ...t.glass ?? {} };
    if (value === null) delete glass2[key];
    else glass2[key] = value;
    const { glass: _old, ...rest } = t;
    return Object.keys(glass2).length ? { ...rest, glass: glass2 } : rest;
  };
  const before = [here.placement];
  const after = [withGlass(here.placement, edgeKey(here.local, localSide(target.side, here.placement.rotation)), glass)];
  if (there) {
    const key = edgeKey(there.local, localSide(OPPOSITE_SIDE[target.side], there.placement.rotation));
    if (there.placement.glass?.[key] !== void 0) {
      before.push(there.placement);
      after.push(withGlass(there.placement, key, null));
    }
  }
  return { kind: "updateTiles", before, after };
}
function edgeGlassAt(doc, target, catalog = coreCatalog) {
  const { cells } = buildOccupancy(doc, catalog);
  const here = cells.get(cellKey(...target.cell));
  if (!here) return null;
  const own = here.placement.glass?.[edgeKey(here.local, localSide(target.side, here.placement.rotation))];
  if (own) return own;
  const [dx, dy] = SIDE_DIRS[target.side];
  const there = cells.get(cellKey(target.cell[0] + dx, target.cell[1] + dy, target.cell[2]));
  return (there && there.placement.glass?.[edgeKey(there.local, localSide(OPPOSITE_SIDE[target.side], there.placement.rotation))]) ?? null;
}
export {
  replacePropsCommand as A,
  BREAKTHROUGH_OBJECTIVE_LABELS as B,
  paintCommand as C,
  setThemeCommand as D,
  setEdgeCommand as E,
  setEdgeGlassCommand as F,
  placeTileCommand as G,
  addSpawnCommand as H,
  newScenarioEntities as I,
  snapsToDoorway as J,
  snapToDoorway as K,
  deleteCommand as L,
  duplicateCommand as M,
  settlePropsCommand as N,
  SCENARIO_PALETTE as S,
  checkPlacement as a,
  upperFloorAt as b,
  checkLayout as c,
  moveEntitiesCommand as d,
  normalizeYaw as e,
  entityNumberKey as f,
  entityLabel as g,
  moverGroupOf as h,
  isBareFloor as i,
  emptySelection as j,
  edgeTargetAt as k,
  levelName as l,
  moveCommand as m,
  newMapDocument as n,
  edgeChoiceAt as o,
  placementCells as p,
  updateTileCommand as q,
  rotateCommand as r,
  sectorOrders as s,
  tileAt as t,
  unusedDefsCommand as u,
  edgeGlassAt as v,
  withMoverGroups as w,
  upperFloorLevels as x,
  yawStep as y,
  setUpperFloorsCommand as z
};
