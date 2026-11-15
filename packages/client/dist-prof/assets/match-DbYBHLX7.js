import { s as simProfile, P as PhysicsWorld } from "./shadowGenerator-_IcnNyty.js";
import { b6 as getItem, a4 as TICK_RATE, fd as clamp, bT as angleDelta, a_ as horizontalDistance, bf as pathUses, bg as pathGeometry, aI as hypot, P as PLAYER, dP as BUTTON_SPRINT, dH as stepMovement, aT as TICK_DT, fe as BUTTON_JUMP, ff as BUTTON_CROUCH, fg as OPENING_BITS, fh as LIFT_FLAG, eG as mapPortals, fi as portalEntry, fj as ziplineClearanceIssues, bx as mapZiplines, fk as ziplineLinks, fl as trackGeometry, fm as PORTAL_EXIT, B as BODY_SIZES, aV as STANCES, z as shapesFor, fn as headPoint, fo as bodyToWorld, aF as lookAngles, aG as viewDirection, c3 as normalize, cm as enterReach, fp as createRng, fq as hasTag, dO as BUTTON_FIRE, dU as BUTTON_ALT, fr as BUTTON_THROW, dT as BUTTON_MELEE, dQ as BUTTON_USE, fs as BUTTON_PRONE, c2 as smokeBlocks, dY as distance, bZ as THROWABLE_DEFS, cw as weaponCode, d as getWeapon, ft as PICKUP_RADIUS$1, dS as BUTTON_ZOOM, dR as BUTTON_RELOAD, aH as MATCH_PLAY, fu as navLinks, bA as mapLiquids, bH as liquidAt, fv as SWIM_DEPTH, fw as LIQUID_SPECS, eB as matchPhysics, dc as FLAG_CARRIED, fx as FLAG_HOME, dd as FLAG_DROPPED, di as BOMB_CARRIED, dg as BOMB_PLANTED, fy as BOMB_EXPLODED, dh as BOMB_DROPPED, fz as BOMB_DEFUSED, df as HOSTAGE_WAITING, de as HOSTAGE_FOLLOWING, db as HOSTAGE_RESCUED, d7 as breakthroughSectors, fA as BREAKTHROUGH_SECTOR_SECONDS, fB as BT_IN_NOBODY, fC as BT_OBJ_WAITING, dj as BT_ROUND_PLAYING, al as getMountDef, W as terrainHeightAt, dl as BT_OBJ_DONE, d8 as BT_OBJ_ACTIVE, d9 as BT_OBJ_PLANTED, dp as BT_IN_DEFENDERS, fD as BREAKTHROUGH_POOL, fE as BT_OBJ_SKIPPED, dm as BT_IN_BOTH, dn as BT_IN_ATTACKERS, fF as behindLine, dk as BT_ROUND_ATTACKERS, fG as BT_ROUND_DEFENDERS, dD as eyeHeightOf, eI as NPC_ROLES, fH as rosterCount, fI as NAME_THEME_INFO, ec as builtInLook, fJ as lookTheme, fK as nameThemeInfo, cq as BOT_DIFFICULTIES, fL as botSetInUse, fM as mapBotSet, fN as CORE_BOT_PROFILES, V as MAX_PLAYER_SLOTS, fO as validLookId, fP as DEFAULT_DEATHMATCH_RULES, fQ as restrictedWeapons, fR as ambientCarEntities, cf as airCraftDef, eC as mapPads, eD as LUNAR_PAD_BOOST, eE as mapLadders, eF as mapGravityZones, fS as relation, eA as classesInPlay, eb as rouletteOn, cc as NPC_ID_BASE, fT as RouletteDirector, fU as profileFor, fV as ClassPlay, ck as MOUNT_DEFS, ch as BUILT_MOUNT_BASE, aY as mapFactions, fW as ZombieSurvival, J as isTeamMode, ez as matchTeams, aX as PLAYERS_FACTION, N as NPC_ROLE_SPECS, fX as NPC_ROLE_PROFILES, D as DEFAULT_LOOK, fY as classStats, fZ as validBotCast, f_ as lookForBot, f$ as castLooks, g0 as dropsInPlay, ed as matchStats, g1 as randomLook, g2 as sanitizeInput, bJ as CORE_WEAPONS, g3 as gravityAt, g4 as chargeIntoMelee, g5 as dodgeDisc, g6 as keepOnDeck, K as fireteamMode, g7 as Fireteams, eT as ORDER_KINDS, g8 as checkOrder, e_ as REFUSALS, eW as SQUAD_SPACINGS, g9 as memberGoal, ga as squadHalf, gb as leaderSpotSafe, gc as classFromSay, gd as orderFromSay, ge as PING, gf as SAY_FOLLOW, gg as SAY_HOLD, gh as EMOTE_DANCE, ew as QUICK_MESSAGES, gi as BUTTON_RESPAWN, f2 as BUTTON_STEER_LOOK, dF as JET, dI as SPEED_BOOST, dG as applyPads, dJ as applyPortals, dK as bodyHeightOf, dL as stepJetFuel, dV as oneHanded, dE as BUTTON_THIRD_PERSON, ef as unarmedStrike, dW as BUTTON_AUTO_RELOAD, gj as throwableWeaponId, c4 as add, c5 as scale, gk as stanceOf, gl as rayTarget, gm as lastHit, gn as resolveHitscan, go as discThrows, gp as DISC_SPAWN_GUARD_SECONDS, gq as DISC_KNOCK_CREDIT_SECONDS, eg as UNARMED, dN as OIL_TRACTION, gr as portalSegment, gs as portalCarry, gt as splitVelocities, gu as waterSpan, gv as rayCapsule, gw as sub, gx as dot, gy as sealedMount, f4 as firingSeat, f6 as mountToWorld, gz as setLoadout, eS as heightAboveGround, fc as CHUTE, gA as VEHICLE_DAMAGE_SCALE, gB as armourScale, gC as MOUNT_BURN_FRACTION, gD as MOUNT_WRECK_SECONDS, b$ as MOUNT_WRECK_FADE_SECONDS, gE as ammoRefillTicks, gF as ammoRefilledBy, gG as MOUNT_BURN_SECONDS, gH as footprintGap, gI as mountMass, gJ as FLOAT, c0 as floatSurface, cn as MOUNT_FLAG_ALIVE, co as MOUNT_FLAG_WRECK, ci as MOUNT_FLAG_BURNING, gK as smokeRadius, bq as SMOKE, gL as BREATH_SECONDS, gM as DAMAGE_BOOST, gN as NPC_DAMAGE_TO_PLAYERS, gO as ARMOR_ABSORB, gP as ZIP, gQ as leaveZipline, gR as SPAWN_DEATHS_KEPT, cb as CLASS_DEFS, eJ as setSpawnWeapons, bW as weaponByCode, eM as setPickupPool, gS as rollPickup, gT as DISC_POWER_SHOTS, gU as MAX_ARMOR, gV as pickSpawn, gW as spawnProtection, dt as weaponSetInPlay, gX as ARENA_DISC, gY as SpawnSides, b4 as IMPROMPTU_MIN_PLAYERS, gZ as spawnShortfall, g_ as centroid, g$ as generateSpawns, h0 as spawnsPerTick, h1 as WAVE_MIN_PLAYERS, h2 as tallied, h3 as tallyRow, h4 as tallyOf, bN as POWERUP_SPEED_BIT, bM as POWERUP_DAMAGE_BIT, bO as FX_PROTECTED, ev as FX_JACKPOT, h5 as classIndex, ex as STREAK_REWARDS, eP as DISC_POWERS, dX as THROWABLES, h6 as squadSnapshot, bp as ZONE_KINDS, bY as PROJECTILE_VISUALS, dM as zoneContains, cp as MOUNT_FLAG_CHARGING, cj as MOUNT_FLAG_ARC, bV as FX_JET, h7 as FX_SWIM, bl as STATUS_BURN, bm as STATUS_POISON, bn as STATUS_SLOW, bk as STATUS_FROZEN, bo as STATUS_CHILL, h8 as PROJECTILE_THICKNESS, h9 as setAllowsDrop, ha as weatherLabel, hb as mapWeather, hc as mapWeaponSet, d0 as isWeatherChoice, a6 as isWeaponSetId, a3 as SCORE_LIMIT_MAX, cI as BREAKTHROUGH_POOL_MAX, cE as getWeaponSet, hd as validateTeamSizes, he as validateBotSet, hf as sameBotSet, cX as botSetLabel, hg as botCastLabel, F as rulesForMode, U as isTwoTeamMode, hh as padLandings } from "./index-BAsW2uYW.js";
import { hi, hj, hk, hl } from "./index-BAsW2uYW.js";
import { a9 as __vitePreload } from "./babylon-PnzH6wcM.js";
import { av as boxesRay, aw as boxesOverlap, ax as boxesToTriangles, ap as mapTerrainMesh, ai as propBoxes, ao as blockBoxes, ay as mapKillY, b as buildMapGeometry, a as getEnvSpecies, g as getProp, m as mapGroundBores, az as nearGroundCut } from "./settle-BDJE4VMF.js";
import { G as AMMO_BOX_REACH, N as liftLinks, i as isAmmoBoxPickup, O as Scenario, Q as AMMO_BOX_ITEM, R as COOK_OFF, J as teamAllows, T as DEPLOYED_BOX, U as PLACED_BOX, E as AMMO_BOX_HALF, X as cookOff, Y as resupplyLoadout, Z as resupplyPoint, _ as BOT_RESUPPLY_REACH, z as resupplyReach, $ as AMMO_BOX_WAIT } from "./abstractMesh-CcTXW9P4.js";
import { n as gunplayOf, N as NEAR_INSTANT_M, O as BULLET_GRAVITY, P as segmentHitsAabb, Q as joinTriangles, U as environmentNavTriangles, e as environmentShapes, V as windowPanes, W as doorway, X as DOOR, Y as destructibleBox, Z as EncounterEntity, R as RESOURCE_BUDGETS, o as newGunState, s as counterRecoil, w as stepAds, I as roundsReady, x as autoReloadDue, y as recoilIdle, v as beginReload, t as stepReload, A as shotCone, z as recoilShot, _ as GLASS, $ as falloffAt, E as bulletPhysics, a0 as BULLET_SUBSTEPS, a1 as flyBullet, a2 as BULLET_LIFETIME, a3 as PENETRATION_MIN_ENERGY, a4 as penetrationLoss, a5 as MATERIAL_BALLISTICS, a6 as MAX_RICOCHETS, a7 as RICOCHET_MAX_ANGLE, a8 as ricochets, a9 as MAX_PENETRATIONS, aa as penetrate, i as SURFACE_TYPES, J as glassAt, ab as entityMaterial, ac as surfaceMaterial, ad as lethalityScale, H as RELOAD_KINDS } from "./scenarioDefs-BcDISE-R.js";
import { m as mapBotHints, h as hintTo, b as hintAt, c as botHintNavIssues, a as airRoute, r as routePose, d as dropTarget, e as botDropIndex, f as dropOffsets, g as canDrop, i as dropIndex, j as shouldJump, t as ticksToRouteEnd, k as dropArea, n as dropPlan, o as dropStretchEnds } from "./validate-CT4vQOFf.js";
import { n as npcHitbox, l as lookHitbox } from "./lookHitbox-C8CMJlSr.js";
import { o as snapFortBase, d as fortBounds, f as fortFlagBases, a as fortMidfield, b as FORT_BUILD, e as FORT_PIECES, p as FORT_COMBAT, g as FORT_BARRIER_HALF, B as BUILDER_WEAPON, h as fortAimPlacement, F as FORT_PIECE_KINDS, q as FORT_REACH, k as FORT_FLAG_CLEARANCE, l as FORT_SPAWN_CLEARANCE, i as FORT_MAX_PIECES, j as fortPlacementProblem, c as fortPieceBoxes, r as FORT_BULLET_SCALE, u as FORT_BLAST_SCALE, v as blastKnockback, M as MatchAwards, w as newImpact, t as thirdPersonAim, x as hitImpact, s as stoppingPower, y as stepImpact, z as blastThrow, A as impactSpeed } from "./forts-aE5925HD.js";
import { b as suspensionOf, n as newSuspension, d as stepSuspension, e as suspensionSnapshot } from "./mountVisuals-DcqHY-wo.js";
import { w as withPending, t as teamCount, a as teamsLabel } from "./hostRules-B_Hae2mK.js";
import { H as HEAT_LAYERS, h as heatGrid, a as addHeat, b as heatCells, s as samplePlaces, E as EXPOSURE_SAMPLES, c as spawnExposure, l as longSightlines, d as heatCellFor } from "./spawnExposure-Bh2h5Jjf.js";
import "./rapier-BmnBVapV.js";
import "./thinInstanceMesh.pure-BG4P9X5v.js";
import "./envMaterials-BVmVluEo.js";
import "./materialPluginBase-Dhlt5oKE.js";
import "./babylonFileParser.function-CbkFZ5Hm.js";
import "./vendor-BIr0ad6t.js";
import "./linesBuilder-6E0Gh92-.js";
import "./shaderMaterial.pure-T5Xe2ebz.js";
import "./cylinderBuilder-B3IbC6dA.js";
import "./capsuleBuilder-D5ktebP4.js";
import "./sphereBuilder.pure-CT5peVwp.js";
import "./groundBuilder-BbO9y42p.js";
import "./torusBuilder-BTtpdox_.js";
import "./dynamicTexture.pure-Sh-mex-9.js";
import "./geometryBufferRenderer.pure-CTzrC3G0.js";
import "./multiRenderTarget.pure-CHje0eeK.js";
import "./bakedVertexAnimation-D_Sv770W.js";
import "./morphTargetsVertex-ChAeSZCm.js";
import "./clipPlaneVertex-BdoNWmEf.js";
import "./instancesDeclaration-CoQOC7Vy.js";
import "./pointCloudVertex-wlAeL2fL.js";
import "./bonesVertex-Cpn2iSQy.js";
import "./instancesVertex-23t-Q1Uk.js";
import "./morphTargetsVertex-73_uAtmG.js";
import "./instancesDeclaration-DL63iftc.js";
import "./setPieceLibrary-B87Q0Jtb.js";
const DROP_LIE_SECONDS = 30;
const MAX_DROPS$1 = 24;
const DROP_REACH = 40;
function dropItem(def) {
  const item = getItem(`core.weapon_${def.id.replace(/^core\./, "")}`);
  return item?.effect.kind === "weapon" && item.effect.weapon === def.id ? item : void 0;
}
function hasAmmo(w) {
  if (w.def.magazine > 0 || w.def.reserveMax > 0) return w.mag + w.reserve > 0;
  return !!w.def.heat;
}
function droppable(w, defaults, allowed) {
  const def = w.def;
  return !!def.category && !def.projectile?.retrievable && !defaults.has(def.id) && (!allowed || allowed(def)) && !!dropItem(def) && hasAmmo(w);
}
function chooseDrop(weapons, held, defaults, allowed) {
  if (held && droppable(held, defaults, allowed)) return held;
  let best = null;
  for (const w of weapons) if (droppable(w, defaults, allowed) && (!best || w.def.botDesirability > best.def.botDesirability)) best = w;
  return best;
}
function takeDropAmmo(owned, drop) {
  const def = owned.def;
  let taken = false;
  const room = Math.max(0, def.reserveMax - owned.reserve);
  const rounds = Math.min(room, drop.mag + drop.reserve);
  if (rounds > 0) {
    owned.reserve += rounds;
    const fromReserve = Math.min(drop.reserve, rounds);
    drop.reserve -= fromReserve;
    drop.mag -= rounds - fromReserve;
    taken = true;
  }
  const altMax = def.alt?.ammo === "own" ? def.alt.max ?? 0 : 0;
  const altRounds = Math.min(Math.max(0, altMax - owned.alt), drop.alt);
  if (altRounds > 0) {
    owned.alt += altRounds;
    drop.alt -= altRounds;
    taken = true;
  }
  return taken;
}
const dropSpent = (d) => d.mag + d.reserve + d.alt <= 0 && (d.def.magazine > 0 || d.def.reserveMax > 0);
function roadHandling(track, pos, hover) {
  if (!track || hover) return { grip: 1, speed: 1 };
  return track.onRoad(pos.x, pos.y, pos.z) ? { grip: 1.7, speed: 1 } : { grip: 1, speed: 0.85 };
}
class TrackDriver {
  /**
   * `lane`: where on the road it likes to drive (-1 left edge .. 1 right edge).
   * `pace`: 0.85–1, how hard it pushes in the bends.
   */
  constructor(lane = 0, pace = 1) {
    this.lane = lane;
    this.pace = pace;
  }
  lane;
  pace;
  slow = 0;
  reverseUntil = 0;
  /** Overtaking: lane offset (-1 left edge .. 1 right edge) to hold until `passUntil`. */
  pass = 0;
  passUntil = 0;
  drive(track, v, tick, others = []) {
    const near2 = track.nearest(v.pos.x, v.pos.z, 400);
    if (!near2) return { forward: 0, right: 0, brake: false };
    const speed = Math.max(0, v.speed);
    const s = near2.sample.s;
    const fwd = { x: Math.sin(v.yaw), z: Math.cos(v.yaw) };
    let ahead = null;
    for (const o of others) {
      const rx = o.pos.x - v.pos.x;
      const rz = o.pos.z - v.pos.z;
      const along = rx * fwd.x + rz * fwd.z;
      const side = rx * fwd.z - rz * fwd.x;
      if (along < 1 || along > 10 + speed * 1.2 || Math.abs(side) > 2.8 || Math.abs(o.pos.y - v.pos.y) > 3) continue;
      if (!ahead || along < ahead.dist) ahead = { dist: along, car: o, side };
    }
    let lane = tick < this.passUntil ? this.pass : this.lane;
    let limit = Infinity;
    if (ahead && ahead.car.speed < speed + 1) {
      const theirs = track.nearest(ahead.car.pos.x, ahead.car.pos.z, track.width)?.lateral ?? ahead.side;
      this.pass = theirs > 0 ? -0.65 : 0.65;
      this.passUntil = tick + TICK_RATE * 2;
      lane = this.pass;
      if (ahead.dist < 7) limit = Math.max(0, ahead.car.speed - 1);
    }
    const look = track.at(s + 7 + speed * 0.7);
    const off = clamp(lane, -1, 1) * (track.width / 2 - 2);
    const aim = { x: look.x + look.dz * off, z: look.z - look.dx * off };
    const err = angleDelta(v.yaw, Math.atan2(aim.x - v.pos.x, aim.z - v.pos.z));
    if (tick < this.reverseUntil) return { forward: -1, right: clamp(-err * 2, -1, 1), brake: false };
    this.slow = Math.abs(v.speed) < 0.8 ? this.slow + 1 : 0;
    if (this.slow > TICK_RATE * 1.5) {
      this.slow = 0;
      this.reverseUntil = tick + TICK_RATE;
      return { forward: -1, right: clamp(-err * 2, -1, 1), brake: false };
    }
    const bendAt = track.at(s + 20 + speed * 1.1);
    const bend = Math.abs(angleDelta(Math.atan2(near2.sample.dx, near2.sample.dz), Math.atan2(bendAt.dx, bendAt.dz)));
    const corner = bend > 1.4 ? 0.42 : bend > 0.9 ? 0.55 : bend > 0.5 ? 0.72 : bend > 0.25 ? 0.88 : 1;
    const want = Math.min(limit, v.maxSpeed * Math.min(1, corner * (0.88 + 0.12 * this.pace)));
    let forward = speed > want + 3 ? -1 : speed > want ? 0 : 1;
    if (Math.abs(err) > 1.6) forward = Math.min(forward, 0.4);
    return { forward, right: clamp(err * 2.4, -1, 1), brake: Math.abs(err) > 0.9 && speed > 10 };
  }
}
const MIN_ROAD_WIDTH = 4;
const JOIN = 8;
const ARRIVE = 30;
function vehicleGuides(paths) {
  const out = [];
  for (const p of paths ?? []) {
    if (p.points.length < 2) continue;
    const route = pathUses(p, "route");
    if (!route && !(pathUses(p, "road") && p.width >= MIN_ROAD_WIDTH)) continue;
    out.push({ line: pathGeometry(p), oneWay: !!p.oneWay, speed: p.speed ?? null, half: route && !pathUses(p, "road") ? 0 : p.width / 2 });
  }
  return out;
}
function followGuide(guides, pos, yaw, goal, speed) {
  const left = horizontalDistance(pos, goal);
  if (left < ARRIVE || !guides.length) return null;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const look = 10 + Math.max(0, speed) * 0.6;
  let best = null;
  let bestScore = -Infinity;
  for (const g of guides) {
    const reach2 = g.half + JOIN;
    const near2 = g.line.nearest(pos.x, pos.z, reach2);
    if (!near2 || near2.dist > reach2 || Math.abs(near2.sample.y - pos.y) > 4) continue;
    for (const dir of g.oneWay ? [1] : [1, -1]) {
      const ahead = g.line.at(near2.sample.s + dir * look);
      const gain = left - horizontalDistance(ahead, goal);
      if (gain < look * 0.35) continue;
      const along = (ahead.dx * fx + ahead.dz * fz) * dir;
      const score = gain / look + 0.3 * along - 0.3 * near2.dist / reach2;
      if (score <= bestScore) continue;
      bestScore = score;
      const lane = g.oneWay || g.half < 3 ? 0 : g.half / 2;
      best = { aim: { x: ahead.x + ahead.dz * dir * lane, y: ahead.y, z: ahead.z - ahead.dx * dir * lane }, speed: g.speed };
    }
  }
  return best;
}
const BOT_TTK_DISTANCES = [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 75, 100, 125, 150];
const BOT_TTK = {
  "core.pistol": [667, 667, 683, 683, 700, 717, 900, 917, 1267, 3233, 3433, 3667, 3733, null],
  "core.rifle": [500, 500, 500, 500, 517, 517, 517, 633, 750, 850, 967, 1300, 1933, null],
  "core.shotgun": [0, 750, 1500, 5033, null, null, null, null, null, null, null, null, null, null],
  "core.sniper": [833, 833, 833, 833, 850, 850, 850, 850, 867, 883, 900, 917, 950, 967],
  "core.launcher": [1100, 1250, 1433, 1633, 1833, 2050, 2283, 2517, 3083, null, null, null, null, null],
  "core.smg": [400, 400, 400, 550, 767, 3383, 3450, 3567, 3667, 3683, 3825, 6983, null, null],
  "core.rockets": [117, 283, 450, 617, 783, 950, 1117, 1283, 1617, 1950, 2450, 3283, null, null],
  "core.plasma": [533, 617, 708, 800, 883, 983, 1075, 1167, 1350, 1533, 1975, 2675, null, null],
  "core.pulse_pistol": [600, 600, 600, 600, 750, 750, 900, 1050, 1350, 1350, 1350, 1275, null, null],
  "core.hand_cannon": [500, 500, 517, 533, 800, 1067, 2917, 5267, 6050, null, null, null, null, null],
  "core.gilded_pistol": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "core.flare_gun": [3433, 3600, 3767, 3933, 4100, 4267, 4450, 4617, 4983, 5050, 5500, 6333, null, null],
  "core.machine_pistol": [700, 925, 3167, null, null, null, null, null, null, null, null, null, null, null],
  "core.burst_rifle": [533, 533, 533, 533, 550, 550, 817, 833, 917, 983, 1300, 1767, null, null],
  "core.laser_rifle": [800, 800, 800, 800, 800, 800, 800, 800, 800, 800, 800, null, null, null],
  "core.marksman": [600, 600, 600, 600, 617, 617, 617, 633, 633, 650, 667, 1e3, 1017, 1350],
  "core.sawed_off": [0, 233, 2567, null, null, null, null, null, null, null, null, null, null, null],
  "core.auto_shotgun": [300, 600, 1950, 5867, null, null, null, null, null, null, null, null, null, null],
  "core.flak": [900, 1017, 1950, 2900, 5825, 7600, null, null, null, null, null, null, null, null],
  "core.railgun": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "core.disc_launcher": [933, 1083, 1233, 1383, 1517, 1667, 1817, 1967, 2250, 2550, 3e3, 3733, null, null],
  "core.bubble_blaster": [2200, 2750, 3400, null, null, null, null, null, null, null, null, null, null, null],
  "core.goo_gun": [1367, 1583, 1817, 2067, 2333, 2617, 2950, 3450, null, null, null, null, null, null],
  "core.oil_slicker": [null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  "core.lmg": [550, 550, 550, 550, 567, 542, 558, 608, 2375, null, null, null, null, null],
  "core.nailgun": [783, 850, 925, 992, 1058, 1175, 1367, 1642, 1942, 2575, 3442, 5025, null, null],
  "core.swarm": [183, 450, 692, 942, 1200, 1450, 1700, 1950, 2450, 2950, 3717, null, null, null],
  "core.guided": [217, 500, 800, 1100, 1383, 1683, 1967, 2267, 2850, 3450, 4333, 5800, 7267, null],
  "core.singularity": [5833, 6400, 6783, 7167, null, null, null, null, null, null, null, null, null, null],
  "core.arc_caster": [900, 900, 900, 900, 900, 900, null, null, null, null, null, null, null, null],
  "core.flamethrower": [900, null, null, null, null, null, null, null, null, null, null, null, null, null],
  "core.freeze_ray": [1650, 1650, 1650, 1650, 1650, 1650, 1650, 1650, null, null, null, null, null, null],
  "core.blast_rockets": [983, 1133, 1317, 1517, 1700, 1900, 2083, 2283, 2667, 3050, 3633, 4583, null, null],
  "core.revolver": [667, 667, 683, 700, 1050, 1400, 1417, 3375, 7867, 7900, null, null, null, null],
  "core.battle_rifle": [600, 600, 600, 600, 617, 617, 617, 633, 1033, 1558, 1467, 7300, null, null]
};
const BOT_DRAW_MS = {
  "core.pistol": 133,
  "core.rifle": 317,
  "core.shotgun": 250,
  "core.sniper": 483,
  "core.launcher": 617,
  "core.smg": 183,
  "core.rockets": 517,
  "core.plasma": 317,
  "core.pulse_pistol": 183,
  "core.hand_cannon": 350,
  "core.gilded_pistol": 400,
  "core.flare_gun": 233,
  "core.machine_pistol": 183,
  "core.burst_rifle": 317,
  "core.laser_rifle": 317,
  "core.marksman": 350,
  "core.sawed_off": 217,
  "core.auto_shotgun": 350,
  "core.flak": 383,
  "core.railgun": 833,
  "core.disc_launcher": 417,
  "core.bubble_blaster": 317,
  "core.goo_gun": 283,
  "core.oil_slicker": 283,
  "core.lmg": 933,
  "core.nailgun": 283,
  "core.swarm": 483,
  "core.guided": 517,
  "core.singularity": 550,
  "core.arc_caster": 317,
  "core.flamethrower": 383,
  "core.freeze_ray": 317,
  "core.blast_rockets": 450,
  "core.revolver": 250,
  "core.battle_rifle": 350
};
const BAND_SLACK = { ratio: 1.6, extraMs: 500, goodMs: 800, capMs: 2500 };
function effectiveBand(ttk, distances) {
  let best = -1;
  for (let i = 0; i < ttk.length; i++) {
    const t = ttk[i];
    if (t !== null && t !== void 0 && (best < 0 || t < ttk[best])) best = i;
  }
  if (best < 0) return null;
  const quickest = ttk[best];
  const limit = Math.min(BAND_SLACK.capMs, Math.max(BAND_SLACK.goodMs, quickest * BAND_SLACK.ratio, quickest + BAND_SLACK.extraMs));
  const good = (i) => {
    const t = ttk[i];
    return t !== null && t !== void 0 && t <= limit;
  };
  if (!good(best)) return null;
  let lo = best;
  let hi2 = best;
  while (lo > 0 && good(lo - 1)) lo--;
  while (hi2 < ttk.length - 1 && good(hi2 + 1)) hi2++;
  const near2 = lo === 0 ? 0 : (distances[lo - 1] + distances[lo]) / 2;
  const far = hi2 === ttk.length - 1 ? distances[hi2] : (distances[hi2] + distances[hi2 + 1]) / 2;
  return [near2, far];
}
const BENCHMARK_GUNS = ["core.pistol", "core.revolver", "core.smg", "core.rifle", "core.shotgun", "core.sniper", "core.rockets"];
function benchmarkMedian(curves, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const ts = BENCHMARK_GUNS.map((id) => curves[id]?.[i] ?? Infinity).sort((a, b) => a - b);
    out.push(ts[Math.floor(ts.length / 2)]);
  }
  return out;
}
function edgeOf(ttk, distances, median2, band) {
  let best = null;
  let i = 0;
  const ok = (k) => {
    const t = ttk[k];
    return t !== null && t !== void 0 && t <= median2[k] && distances[k] >= band[0] && distances[k] <= band[1];
  };
  while (i < ttk.length) {
    if (!ok(i)) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < ttk.length && ok(j + 1)) j++;
    if (j > i && (!best || j - i > best[1] - best[0])) best = [i, j];
    i = j + 1;
  }
  if (!best) return null;
  const [a, b] = best;
  return [a === 0 ? 0 : (distances[a - 1] + distances[a]) / 2, b === ttk.length - 1 ? distances[b] : (distances[b] + distances[b + 1]) / 2];
}
const bands = /* @__PURE__ */ new Map();
const edges = /* @__PURE__ */ new Map();
const median = benchmarkMedian(BOT_TTK, BOT_TTK_DISTANCES.length);
for (const [id, ttk] of Object.entries(BOT_TTK)) {
  const band = effectiveBand(ttk, BOT_TTK_DISTANCES);
  if (!band) continue;
  bands.set(id, band);
  const edge = edgeOf(ttk, BOT_TTK_DISTANCES, median, band);
  if (edge) edges.set(id, edge);
}
function curveAt(ttk, distances, d) {
  const v = (i) => ttk[i] ?? Infinity;
  if (d <= distances[0]) return v(0);
  for (let i = 1; i < distances.length; i++) {
    if (d > distances[i]) continue;
    const a = v(i - 1);
    const b = v(i);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Math.max(a, b);
    const u = (d - distances[i - 1]) / (distances[i] - distances[i - 1]);
    return a + (b - a) * u;
  }
  return v(distances.length - 1);
}
function ttkEdge(id, dist, held = true) {
  const ttk = BOT_TTK[id];
  if (!ttk) return 0;
  const t = curveAt(ttk, BOT_TTK_DISTANCES, dist) + (held ? 0 : BOT_DRAW_MS[id] ?? 0);
  const m = curveAt(median, BOT_TTK_DISTANCES, dist);
  if (!Number.isFinite(t)) return -1;
  if (!Number.isFinite(m)) return 1;
  return Math.max(-1, Math.min(1, (m - t) / Math.max(1, m)));
}
function botBand(def) {
  const m = bands.get(def.id);
  if (!m) return def.botRange;
  const splash = def.projectile && def.projectile.selfDamageScale > 0 ? def.projectile.splashRadius : 0;
  return splash > 0 && m[0] < splash + 1 ? [splash + 1, Math.max(m[1], splash + 3)] : m;
}
const instances = ["Recast", "Detour", "DetourNavMeshBuilder", "DetourTileCacheBuilder", "NavMeshImporter", "NavMeshExporter", "CrowdUtils", "ChunkyTriMeshUtils", "RecastDebugDraw", "DetourDebugDraw"];
const classes = ["rcConfig", "rcContext", "dtNavMeshParams", "dtNavMeshCreateParams", "RecastLinearAllocator", "RecastFastLZCompressor", "rcChunkyTriMesh", "dtTileCacheParams", "dtTileCacheLayerHeader", "Vec3", "BoolRef", "IntRef", "UnsignedIntRef", "UnsignedCharRef", "UnsignedShortRef", "FloatRef", "IntArray", "UnsignedIntArray", "UnsignedCharArray", "UnsignedShortArray", "FloatArray"];
const Raw = {
  isNull: (obj) => {
    return Raw.Module.getPointer(obj) === 0;
  },
  destroy: (obj) => {
    Raw.Module.destroy(obj);
  }
};
const Recast = {};
const init = async (impl) => {
  if (Raw.Module !== void 0) {
    return;
  }
  {
    const defaultExport = (await __vitePreload(async () => {
      const { default: __vite_default__ } = await import("./recast-navigation.wasm-compat-DEbyPJ95.js");
      return { default: __vite_default__ };
    }, true ? [] : void 0)).default;
    Raw.Module = await defaultExport();
  }
  for (const instance of instances) {
    Raw[instance] = new Raw.Module[instance]();
  }
  for (const clazz of classes) {
    Raw[clazz] = Raw.Module[clazz];
  }
  Recast.RC_BORDER_REG = Raw.Recast.BORDER_REG;
  Recast.RC_MULTIPLE_REGS = Raw.Recast.MULTIPLE_REGS;
  Recast.RC_BORDER_VERTEX = Raw.Recast.BORDER_VERTEX;
  Recast.RC_AREA_BORDER = Raw.Recast.AREA_BORDER;
  Recast.RC_CONTOUR_REG_MASK = Raw.Recast.CONTOUR_REG_MASK;
  Recast.RC_MESH_NULL_IDX = Raw.Recast.MESH_NULL_IDX;
  Recast.RC_NULL_AREA = Raw.Recast.NULL_AREA;
  Recast.RC_WALKABLE_AREA = Raw.Recast.WALKABLE_AREA;
  Recast.RC_NOT_CONNECTED = Raw.Recast.NOT_CONNECTED;
  Recast.RC_CONTOUR_TESS_WALL_EDGES = Raw.Module.RC_CONTOUR_TESS_WALL_EDGES;
  Recast.RC_CONTOUR_TESS_AREA_EDGES = Raw.Module.RC_CONTOUR_TESS_AREA_EDGES;
  Recast.RC_LOG_PROGRESS = Raw.Module.RC_LOG_PROGRESS;
  Recast.RC_LOG_WARNING = Raw.Module.RC_LOG_WARNING;
  Recast.RC_LOG_ERROR = Raw.Module.RC_LOG_ERROR;
  Recast.RC_TIMER_TOTAL = Raw.Module.RC_TIMER_TOTAL;
  Recast.RC_TIMER_TEMP = Raw.Module.RC_TIMER_TEMP;
  Recast.RC_TIMER_RASTERIZE_TRIANGLES = Raw.Module.RC_TIMER_RASTERIZE_TRIANGLES;
  Recast.RC_TIMER_BUILD_COMPACTHEIGHTFIELD = Raw.Module.RC_TIMER_BUILD_COMPACTHEIGHTFIELD;
  Recast.RC_TIMER_BUILD_CONTOURS = Raw.Module.RC_TIMER_BUILD_CONTOURS;
  Recast.RC_TIMER_BUILD_CONTOURS_TRACE = Raw.Module.RC_TIMER_BUILD_CONTOURS_TRACE;
  Recast.RC_TIMER_BUILD_CONTOURS_SIMPLIFY = Raw.Module.RC_TIMER_BUILD_CONTOURS_SIMPLIFY;
  Recast.RC_TIMER_FILTER_BORDER = Raw.Module.RC_TIMER_FILTER_BORDER;
  Recast.RC_TIMER_FILTER_WALKABLE = Raw.Module.RC_TIMER_FILTER_WALKABLE;
  Recast.RC_TIMER_MEDIAN_AREA = Raw.Module.RC_TIMER_MEDIAN_AREA;
  Recast.RC_TIMER_FILTER_LOW_OBSTACLES = Raw.Module.RC_TIMER_FILTER_LOW_OBSTACLES;
  Recast.RC_TIMER_BUILD_POLYMESH = Raw.Module.RC_TIMER_BUILD_POLYMESH;
  Recast.RC_TIMER_MERGE_POLYMESH = Raw.Module.RC_TIMER_MERGE_POLYMESH;
  Recast.RC_TIMER_ERODE_AREA = Raw.Module.RC_TIMER_ERODE_AREA;
  Recast.RC_TIMER_MARK_BOX_AREA = Raw.Module.RC_TIMER_MARK_BOX_AREA;
  Recast.RC_TIMER_MARK_CYLINDER_AREA = Raw.Module.RC_TIMER_MARK_CYLINDER_AREA;
  Recast.RC_TIMER_MARK_CONVEXPOLY_AREA = Raw.Module.RC_TIMER_MARK_CONVEXPOLY_AREA;
  Recast.RC_TIMER_BUILD_DISTANCEFIELD = Raw.Module.RC_TIMER_BUILD_DISTANCEFIELD;
  Recast.RC_TIMER_BUILD_DISTANCEFIELD_DIST = Raw.Module.RC_TIMER_BUILD_DISTANCEFIELD_DIST;
  Recast.RC_TIMER_BUILD_DISTANCEFIELD_BLUR = Raw.Module.RC_TIMER_BUILD_DISTANCEFIELD_BLUR;
  Recast.RC_TIMER_BUILD_REGIONS = Raw.Module.RC_TIMER_BUILD_REGIONS;
  Recast.RC_TIMER_BUILD_REGIONS_WATERSHED = Raw.Module.RC_TIMER_BUILD_REGIONS_WATERSHED;
  Recast.RC_TIMER_BUILD_REGIONS_EXPAND = Raw.Module.RC_TIMER_BUILD_REGIONS_EXPAND;
  Recast.RC_TIMER_BUILD_REGIONS_FLOOD = Raw.Module.RC_TIMER_BUILD_REGIONS_FLOOD;
  Recast.RC_TIMER_BUILD_REGIONS_FILTER = Raw.Module.RC_TIMER_BUILD_REGIONS_FILTER;
  Recast.RC_TIMER_BUILD_LAYERS = Raw.Module.RC_TIMER_BUILD_LAYERS;
  Recast.RC_TIMER_BUILD_POLYMESHDETAIL = Raw.Module.RC_TIMER_BUILD_POLYMESHDETAIL;
  Recast.RC_TIMER_MERGE_POLYMESHDETAIL = Raw.Module.RC_TIMER_MERGE_POLYMESHDETAIL;
  Recast.RC_MAX_TIMERS = Raw.Module.RC_MAX_TIMERS;
  Raw.Detour.FAILURE;
  Raw.Detour.SUCCESS;
  Raw.Detour.IN_PROGRESS;
  Raw.Detour.STATUS_DETAIL_MASK;
  Raw.Detour.WRONG_MAGIC;
  Raw.Detour.WRONG_VERSION;
  Raw.Detour.OUT_OF_MEMORY;
  Raw.Detour.INVALID_PARAM;
  Raw.Detour.BUFFER_TOO_SMALL;
  Raw.Detour.OUT_OF_NODES;
  Raw.Detour.PARTIAL_RESULT;
  Raw.Detour.ALREADY_OCCUPIED;
  Raw.Detour.VERTS_PER_POLYGON;
  Raw.Detour.NAVMESH_MAGIC;
  Raw.Detour.NAVMESH_VERSION;
  Raw.Detour.NAVMESH_STATE_MAGIC;
  Raw.Detour.NAVMESH_STATE_VERSION;
  Raw.Detour.TILECACHE_MAGIC;
  Raw.Detour.TILECACHE_VERSION;
  Raw.Detour.TILECACHE_NULL_AREA;
  Raw.Detour.TILECACHE_WALKABLE_AREA;
  Raw.Detour.TILECACHE_NULL_IDX;
  Raw.Detour.NULL_LINK;
  Raw.Detour.NULL_LINK;
  Raw.Detour.EXT_LINK;
  Raw.Detour.OFFMESH_CON_BIDIR;
  Raw.Module.DT_STRAIGHTPATH_START;
  Raw.Module.DT_STRAIGHTPATH_END;
  Raw.Module.DT_STRAIGHTPATH_OFFMESH_CONNECTION;
  Raw.Module.DT_STRAIGHTPATH_AREA_CROSSINGS;
  Raw.Module.DT_STRAIGHTPATH_ALL_CROSSINGS;
  Raw.Module.DT_FINDPATH_ANY_ANGLE;
  Raw.Module.DT_RAYCAST_USE_COSTS;
  Raw.Module.DT_CROWDAGENT_STATE_INVALID;
  Raw.Module.DT_CROWDAGENT_STATE_WALKING;
  Raw.Module.DT_CROWDAGENT_STATE_OFFMESH;
  Raw.Module.DT_CROWDAGENT_TARGET_NONE;
  Raw.Module.DT_CROWDAGENT_TARGET_FAILED;
  Raw.Module.DT_CROWDAGENT_TARGET_VALID;
  Raw.Module.DT_CROWDAGENT_TARGET_REQUESTING;
  Raw.Module.DT_CROWDAGENT_TARGET_WAITING_FOR_QUEUE;
  Raw.Module.DT_CROWDAGENT_TARGET_WAITING_FOR_PATH;
  Raw.Module.DT_CROWDAGENT_TARGET_VELOCITY;
  Raw.Module.DT_COMPRESSEDTILE_FREE_DATA;
  Raw.Module.DT_TILE_FREE_DATA;
};
class BaseArray {
  get size() {
    return this.raw.size;
  }
  constructor(raw) {
    this.raw = raw;
  }
  get(i) {
    return this.raw.get(i);
  }
  set(i, value) {
    this.raw.set(i, value);
  }
  resize(size) {
    this.raw.resize(size);
  }
  copy(data) {
    this.raw.resize(data.length);
    const view = this.getHeapView();
    view.set(data);
  }
  destroy() {
    Raw.destroy(this.raw);
  }
  getHeapView() {
    const heap = this.getHeap();
    return new this.ArrayConstructor(heap.buffer, this.raw.getDataPointer(), this.size);
  }
  toTypedArray() {
    const view = this.getHeapView();
    const data = new this.ArrayConstructor(new ArrayBuffer(this.size * view.BYTES_PER_ELEMENT), 0, this.size);
    data.set(view);
    return data;
  }
}
class IntArray extends BaseArray {
  ArrayConstructor = Int32Array;
  constructor(raw) {
    super(raw ?? new Raw.Module.IntArray());
  }
  getHeap() {
    return Raw.Module.HEAP32;
  }
  static fromRaw(raw) {
    return new IntArray(raw);
  }
}
class UnsignedIntArray extends BaseArray {
  ArrayConstructor = Uint32Array;
  constructor(raw) {
    super(raw ?? new Raw.Module.UnsignedIntArray());
  }
  getHeap() {
    return Raw.Module.HEAPU32;
  }
  static fromRaw(raw) {
    return new UnsignedIntArray(raw);
  }
}
class UnsignedCharArray extends BaseArray {
  ArrayConstructor = Uint8Array;
  constructor(raw) {
    super(raw ?? new Raw.Module.UnsignedCharArray());
  }
  getHeap() {
    return Raw.Module.HEAPU8;
  }
  static fromRaw(raw) {
    return new UnsignedCharArray(raw);
  }
}
class FloatArray extends BaseArray {
  ArrayConstructor = Float32Array;
  constructor(raw) {
    super(raw ?? new Raw.Module.FloatArray());
  }
  getHeap() {
    return Raw.Module.HEAPF32;
  }
  static fromRaw(raw) {
    return new FloatArray(raw);
  }
}
const VerticesArray = FloatArray;
const TrianglesArray = IntArray;
const TriangleAreasArray = UnsignedCharArray;
const vec3 = {
  toRaw: ({
    x,
    y,
    z
  }, existing) => {
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.z = z;
      return existing;
    }
    return new Raw.Module.Vec3(x, y, z);
  },
  fromRaw: (vec32) => {
    const {
      x,
      y,
      z
    } = vec32;
    return {
      x,
      y,
      z
    };
  },
  fromArray: ([x, y, z]) => {
    return {
      x,
      y,
      z
    };
  },
  toArray: ({
    x,
    y,
    z
  }) => {
    return [x, y, z];
  },
  lerp: (a, b, t, out = {
    x: 0,
    y: 0,
    z: 0
  }) => {
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
  },
  copy: (source, out = {
    x: 0,
    y: 0,
    z: 0
  }) => {
    out.x = source.x;
    out.y = source.y;
    out.z = source.z;
  }
};
const array = (getter, count) => {
  const array2 = [];
  for (let i = 0; i < count; i++) {
    array2.push(getter(i));
  }
  return array2;
};
const statusSucceed = (status) => {
  return Raw.Detour.statusSucceed(status);
};
class DetourPolyDetail {
  constructor(raw) {
    this.raw = raw;
  }
  vertBase() {
    return this.raw.vertBase;
  }
  triBase() {
    return this.raw.triBase;
  }
  vertCount() {
    return this.raw.vertCount;
  }
  triCount() {
    return this.raw.triCount;
  }
}
class DetourLink {
  constructor(raw) {
    this.raw = raw;
  }
  ref() {
    return this.raw.ref;
  }
  next() {
    return this.raw.next;
  }
  edge() {
    return this.raw.edge;
  }
  side() {
    return this.raw.side;
  }
  bmin() {
    return this.raw.bmin;
  }
  bmax() {
    return this.raw.bmax;
  }
}
class DetourBVNode {
  constructor(raw) {
    this.raw = raw;
  }
  bmin() {
    return vec3.fromArray(array((i) => this.raw.get_bmin(i), 3));
  }
  bmax() {
    return vec3.fromArray(array((i) => this.raw.get_bmax(i), 3));
  }
  i() {
    return this.raw.i;
  }
}
class DetourOffMeshConnection {
  constructor(raw) {
    this.raw = raw;
  }
  pos(index) {
    return this.raw.get_pos(index);
  }
  rad() {
    return this.raw.rad;
  }
  poly() {
    return this.raw.poly;
  }
  flags() {
    return this.raw.flags;
  }
  side() {
    return this.raw.side;
  }
  userId() {
    return this.raw.userId;
  }
}
class DetourMeshHeader {
  constructor(raw) {
    this.raw = raw;
  }
  magic() {
    return this.raw.magic;
  }
  version() {
    return this.raw.version;
  }
  x() {
    return this.raw.x;
  }
  y() {
    return this.raw.y;
  }
  layer() {
    return this.raw.layer;
  }
  userId() {
    return this.raw.userId;
  }
  polyCount() {
    return this.raw.polyCount;
  }
  vertCount() {
    return this.raw.vertCount;
  }
  maxLinkCount() {
    return this.raw.maxLinkCount;
  }
  detailMeshCount() {
    return this.raw.detailMeshCount;
  }
  detailVertCount() {
    return this.raw.detailVertCount;
  }
  detailTriCount() {
    return this.raw.detailTriCount;
  }
  bvNodeCount() {
    return this.raw.bvNodeCount;
  }
  offMeshConCount() {
    return this.raw.offMeshConCount;
  }
  offMeshBase() {
    return this.raw.offMeshBase;
  }
  walkableHeight() {
    return this.raw.walkableHeight;
  }
  walkableRadius() {
    return this.raw.walkableRadius;
  }
  walkableClimb() {
    return this.raw.walkableClimb;
  }
  bmin(index) {
    return this.raw.get_bmin(index);
  }
  bmax(index) {
    return this.raw.get_bmax(index);
  }
  bvQuantFactor() {
    return this.raw.bvQuantFactor;
  }
}
class DetourPoly {
  constructor(raw) {
    this.raw = raw;
  }
  firstLink() {
    return this.raw.firstLink;
  }
  verts(index) {
    return this.raw.get_verts(index);
  }
  neis(index) {
    return this.raw.get_neis(index);
  }
  flags() {
    return this.raw.flags;
  }
  vertCount() {
    return this.raw.vertCount;
  }
  areaAndType() {
    return this.raw.get_areaAndtype();
  }
  getType() {
    return this.raw.getType();
  }
}
class DetourMeshTile {
  constructor(raw) {
    this.raw = raw;
  }
  salt() {
    return this.raw.salt;
  }
  linksFreeList() {
    return this.raw.linksFreeList;
  }
  header() {
    return !Raw.isNull(this.raw.header) ? new DetourMeshHeader(this.raw.header) : null;
  }
  polys(index) {
    return new DetourPoly(this.raw.get_polys(index));
  }
  verts(index) {
    return this.raw.get_verts(index);
  }
  links(index) {
    return new DetourLink(this.raw.get_links(index));
  }
  detailMeshes(index) {
    return new DetourPolyDetail(this.raw.get_detailMeshes(index));
  }
  detailVerts(index) {
    return this.raw.get_detailVerts(index);
  }
  detailTris(index) {
    return this.raw.get_detailTris(index);
  }
  bvTree(index) {
    return new DetourBVNode(this.raw.get_bvTree(index));
  }
  offMeshCons(index) {
    return new DetourOffMeshConnection(this.raw.get_offMeshCons(index));
  }
  data(index) {
    return this.raw.get_data(index);
  }
  dataSize() {
    return this.raw.dataSize;
  }
  flags() {
    return this.raw.flags;
  }
  next() {
    return new DetourMeshTile(this.raw.next);
  }
}
const createNavMeshData = (navMeshCreateParams) => {
  const result = Raw.DetourNavMeshBuilder.createNavMeshData(navMeshCreateParams.raw);
  return {
    success: result.success,
    navMeshData: UnsignedCharArray.fromRaw(result.navMeshData)
  };
};
class NavMeshCreateParams {
  constructor(raw) {
    this.raw = raw ?? new Raw.Module.dtNavMeshCreateParams();
  }
  setPolyMeshCreateParams(polyMesh) {
    Raw.DetourNavMeshBuilder.setPolyMeshCreateParams(this.raw, polyMesh.raw);
  }
  setPolyMeshDetailCreateParams(polyMeshDetail) {
    Raw.DetourNavMeshBuilder.setPolyMeshDetailCreateParams(this.raw, polyMeshDetail.raw);
  }
  setOffMeshConnections(offMeshConnections) {
    if (offMeshConnections.length <= 0) return;
    const verts = [];
    const rads = [];
    const dir = [];
    const areas = [];
    const flags = [];
    const userIds = [];
    for (let i = 0; i < offMeshConnections.length; i++) {
      const connection = offMeshConnections[i];
      verts.push(connection.startPosition.x, connection.startPosition.y, connection.startPosition.z);
      verts.push(connection.endPosition.x, connection.endPosition.y, connection.endPosition.z);
      rads.push(connection.radius);
      dir.push(connection.bidirectional ? 1 : 0);
      areas.push(connection.area ?? 0);
      flags.push(connection.flags ?? 1);
      userIds.push(connection.userId ?? 1e3 + i);
    }
    Raw.DetourNavMeshBuilder.setOffMeshConnections(this.raw, offMeshConnections.length, verts, rads, dir, areas, flags, userIds);
  }
  verts(index) {
    return this.raw.get_verts(index);
  }
  setVerts(index, value) {
    this.raw.set_verts(index, value);
  }
  vertCount() {
    return this.raw.vertCount;
  }
  polys(index) {
    return this.raw.get_polys(index);
  }
  setPolys(index, value) {
    this.raw.set_polys(index, value);
  }
  polyAreas(index) {
    return this.raw.get_polyAreas(index);
  }
  setPolyAreas(index, value) {
    this.raw.set_polyAreas(index, value);
  }
  polyFlags(index) {
    return this.raw.get_polyFlags(index);
  }
  setPolyFlags(index, value) {
    this.raw.set_polyFlags(index, value);
  }
  polyCount() {
    return this.raw.polyCount;
  }
  nvp() {
    return this.raw.nvp;
  }
  setNvp(value) {
    this.raw.nvp = value;
  }
  detailMeshes(index) {
    return this.raw.get_detailMeshes(index);
  }
  setDetailMeshes(index, value) {
    this.raw.set_detailMeshes(index, value);
  }
  detailVerts(index) {
    return this.raw.get_detailVerts(index);
  }
  setDetailVerts(index, value) {
    this.raw.set_detailVerts(index, value);
  }
  detailVertsCount() {
    return this.raw.detailVertsCount;
  }
  detailTris(index) {
    return this.raw.get_detailTris(index);
  }
  setDetailTris(index, value) {
    this.raw.set_detailTris(index, value);
  }
  detailTriCount() {
    return this.raw.detailTriCount;
  }
  offMeshConVerts(index) {
    return this.raw.get_offMeshConVerts(index);
  }
  offMeshConRad(index) {
    return this.raw.get_offMeshConRad(index);
  }
  offMeshConDir(index) {
    return this.raw.get_offMeshConDir(index);
  }
  offMeshConAreas(index) {
    return this.raw.get_offMeshConAreas(index);
  }
  offMeshConFlags(index) {
    return this.raw.get_offMeshConFlags(index);
  }
  offMeshConUserID(index) {
    return this.raw.get_offMeshConUserID(index);
  }
  offMeshConCount() {
    return this.raw.offMeshConCount;
  }
  userId() {
    return this.raw.userId;
  }
  tileX() {
    return this.raw.tileX;
  }
  setTileX(value) {
    this.raw.tileX = value;
  }
  tileY() {
    return this.raw.tileY;
  }
  setTileY(value) {
    this.raw.tileY = value;
  }
  tileLayer() {
    return this.raw.tileLayer;
  }
  setTileLayer(value) {
    this.raw.tileLayer = value;
  }
  boundsMin() {
    return array((i) => this.raw.get_bmin(i), 3);
  }
  setBoundsMin(value) {
    this.raw.set_bmin(0, value[0]);
    this.raw.set_bmin(1, value[1]);
    this.raw.set_bmin(2, value[2]);
  }
  boundsMax() {
    return array((i) => this.raw.get_bmax(i), 3);
  }
  setBoundsMax(value) {
    this.raw.set_bmax(0, value[0]);
    this.raw.set_bmax(1, value[1]);
    this.raw.set_bmax(2, value[2]);
  }
  walkableHeight() {
    return this.raw.walkableHeight;
  }
  setWalkableHeight(value) {
    this.raw.walkableHeight = value;
  }
  walkableRadius() {
    return this.raw.walkableRadius;
  }
  setWalkableRadius(value) {
    this.raw.walkableRadius = value;
  }
  walkableClimb() {
    return this.raw.walkableClimb;
  }
  setWalkableClimb(value) {
    this.raw.walkableClimb = value;
  }
  cellSize() {
    return this.raw.cs;
  }
  setCellSize(value) {
    this.raw.cs = value;
  }
  cellHeight() {
    return this.raw.ch;
  }
  setCellHeight(value) {
    this.raw.ch = value;
  }
  buildBvTree() {
    return this.raw.buildBvTree;
  }
  setBuildBvTree(value) {
    this.raw.buildBvTree = value;
  }
}
class QueryFilter {
  get includeFlags() {
    return this.raw.getIncludeFlags();
  }
  set includeFlags(flags) {
    this.raw.setIncludeFlags(flags);
  }
  get excludeFlags() {
    return this.raw.getExcludeFlags();
  }
  set excludeFlags(flags) {
    this.raw.setExcludeFlags(flags);
  }
  constructor(raw) {
    this.raw = raw ?? new Raw.Module.dtQueryFilter();
  }
  getAreaCost(i) {
    return this.raw.getAreaCost(i);
  }
  setAreaCost(i, cost) {
    this.raw.setAreaCost(i, cost);
  }
}
class NavMeshQuery {
  /**
   * Default query filter.
   */
  /**
   * Default search distance along each axis.
   */
  defaultQueryHalfExtents = {
    x: 1,
    y: 1,
    z: 1
  };
  constructor(value, params) {
    if (value instanceof Raw.Module.NavMeshQuery) {
      this.raw = value;
    } else {
      this.raw = new Raw.Module.NavMeshQuery();
      this.raw.init(value.raw, params?.maxNodes ?? 2048);
    }
    if (params?.defaultQueryFilter) {
      this.defaultFilter = params.defaultQueryFilter;
    } else {
      this.defaultFilter = new QueryFilter();
      this.defaultFilter.includeFlags = 65535;
      this.defaultFilter.excludeFlags = 0;
    }
  }
  /**
   * Finds the polygon nearest to the given position.
   */
  findNearestPoly(position, options) {
    const nearestRefRaw = new Raw.UnsignedIntRef();
    const nearestPointRaw = new Raw.Vec3();
    const isOverPolyRaw = new Raw.BoolRef();
    const status = this.raw.findNearestPoly(vec3.toArray(position), vec3.toArray(options?.halfExtents ?? this.defaultQueryHalfExtents), options?.filter?.raw ?? this.defaultFilter.raw, nearestRefRaw, nearestPointRaw, isOverPolyRaw);
    const nearestPoint = vec3.fromRaw(nearestPointRaw);
    Raw.destroy(nearestPointRaw);
    const nearestRef = nearestRefRaw.value;
    Raw.destroy(nearestRefRaw);
    const isOverPoly = isOverPolyRaw.value;
    Raw.destroy(isOverPolyRaw);
    return {
      success: statusSucceed(status),
      status,
      nearestRef,
      nearestPoint,
      isOverPoly
    };
  }
  /**
   * Finds the polygons along the navigation graph that touch the specified circle.
   * @param startRef Reference of polygon to start search from
   * @param centerPos Center of circle
   * @param radius Radius of circle
   * @param options
   */
  findPolysAroundCircle(startRef, centerPos, radius, options) {
    const filter = options?.filter ?? this.defaultFilter;
    const maxPolys = options?.maxPolys ?? 256;
    const resultRefArray = new UnsignedIntArray();
    const resultParentArray = new UnsignedIntArray();
    const resultCostArray = new FloatArray();
    resultRefArray.resize(maxPolys);
    resultParentArray.resize(maxPolys);
    resultCostArray.resize(maxPolys);
    const resultCountRef = new Raw.IntRef();
    const status = this.raw.findPolysAroundCircle(startRef, vec3.toArray(centerPos), radius, filter.raw, resultRefArray.raw, resultParentArray.raw, resultCostArray.raw, resultCountRef, maxPolys);
    const resultRefs = [...resultRefArray.getHeapView()];
    resultRefArray.destroy();
    const resultParents = [...resultParentArray.getHeapView()];
    resultParentArray.destroy();
    const resultCost = [...resultCostArray.getHeapView()];
    resultCostArray.destroy();
    const resultCount = resultCountRef.value;
    Raw.destroy(resultCountRef);
    return {
      success: statusSucceed(status),
      status,
      resultRefs,
      resultParents,
      resultCost,
      resultCount
    };
  }
  /**
   * Finds polygons that overlap the search box.
   * @param center The center of the search box
   * @param halfExtents The search distance along each axis
   * @param options
   */
  queryPolygons(center, halfExtents, options) {
    const filter = options?.filter ?? this.defaultFilter;
    const maxPolys = options?.maxPolys ?? 256;
    const polysRefsArray = new UnsignedIntArray();
    polysRefsArray.resize(maxPolys);
    const polyCountRef = new Raw.IntRef();
    const status = this.raw.queryPolygons(vec3.toArray(center), vec3.toArray(halfExtents), filter.raw, polysRefsArray.raw, polyCountRef, maxPolys);
    const polyCount = polyCountRef.value;
    Raw.destroy(polyCountRef);
    const polyRefs = [...polysRefsArray.getHeapView()].slice(0, polyCount);
    polysRefsArray.destroy();
    return {
      success: statusSucceed(status),
      status,
      polyRefs
    };
  }
  /**
   * Returns the closest point on the given polygon to the given position.
   *
   * @param polyRef The reference of the polygon
   * @param position The position to find the closest point to
   */
  closestPointOnPoly(polyRef, position) {
    const closestPointRaw = new Raw.Vec3();
    const positionOverPolyRaw = new Raw.BoolRef();
    const status = this.raw.closestPointOnPoly(polyRef, vec3.toArray(position), closestPointRaw, positionOverPolyRaw);
    const closestPoint = vec3.fromRaw(closestPointRaw);
    Raw.destroy(closestPointRaw);
    const isPointOverPoly = positionOverPolyRaw.value;
    Raw.destroy(positionOverPolyRaw);
    return {
      success: statusSucceed(status),
      status,
      closestPoint,
      isPointOverPoly
    };
  }
  /**
   * Finds the closest point on the NavMesh to the given position.
   * @param position the position to find the closest point to
   * @param options additional options
   * @returns the result of the find closest point operation
   */
  findClosestPoint(position, options) {
    const filter = options?.filter ?? this.defaultFilter;
    const halfExtents = options?.halfExtents ?? this.defaultQueryHalfExtents;
    const resultPolyRef = new Raw.UnsignedIntRef();
    const resultPoint = new Raw.Vec3();
    const resultPointOverPoly = new Raw.BoolRef();
    const status = this.raw.findClosestPoint(vec3.toArray(position), vec3.toArray(halfExtents), filter.raw, resultPolyRef, resultPoint, resultPointOverPoly);
    const polyRef = resultPolyRef.value;
    Raw.destroy(resultPolyRef);
    const point = vec3.fromRaw(resultPoint);
    Raw.destroy(resultPoint);
    const isPointOverPoly = resultPointOverPoly.value;
    Raw.destroy(resultPointOverPoly);
    return {
      success: statusSucceed(status),
      status,
      polyRef,
      point,
      isPointOverPoly
    };
  }
  /**
   * Returns a random point on the NavMesh within the given radius of the given position.
   *
   * @param position the center of the search circle
   * @param radius the radius of the search circle
   * @param options additional options
   */
  findRandomPointAroundCircle(position, radius, options) {
    const filter = options?.filter ?? this.defaultFilter;
    const halfExtents = options?.halfExtents ?? this.defaultQueryHalfExtents;
    let startRef;
    if (options?.startRef) {
      startRef = options.startRef;
    } else {
      const nearestPoly = this.findNearestPoly(position, {
        filter,
        halfExtents
      });
      if (!nearestPoly.success) {
        return {
          success: false,
          status: nearestPoly.status,
          randomPolyRef: 0,
          randomPoint: {
            x: 0,
            y: 0,
            z: 0
          }
        };
      }
      startRef = nearestPoly.nearestRef;
    }
    const randomPolyRefRaw = new Raw.UnsignedIntRef();
    const randomPointRaw = new Raw.Vec3();
    const status = this.raw.findRandomPointAroundCircle(startRef, vec3.toArray(position), radius, filter.raw, randomPolyRefRaw, randomPointRaw);
    const randomPolyRef = randomPolyRefRaw.value;
    Raw.destroy(randomPolyRefRaw);
    const randomPoint = vec3.fromRaw(randomPointRaw);
    Raw.destroy(randomPointRaw);
    return {
      success: statusSucceed(status),
      status,
      randomPolyRef,
      randomPoint
    };
  }
  /**
   * Moves from the start to the end position constrained to the navigation mesh.
   *
   * @param startRef the reference id of the start polygon.
   * @param startPosition a position of the mover within the start polygon.
   * @param endPosition the desired end position of the mover.
   *
   * @returns The result of the move along surface operation.
   */
  moveAlongSurface(startRef, startPosition, endPosition, options) {
    const maxVisitedSize = options?.maxVisitedSize ?? 256;
    const resultPositionRaw = new Raw.Vec3();
    const visitedArray = new UnsignedIntArray();
    const filter = options?.filter?.raw ?? this.defaultFilter.raw;
    const status = this.raw.moveAlongSurface(startRef, vec3.toArray(startPosition), vec3.toArray(endPosition), filter, resultPositionRaw, visitedArray.raw, maxVisitedSize);
    const resultPosition = vec3.fromRaw(resultPositionRaw);
    Raw.destroy(resultPositionRaw);
    const visited = [...visitedArray.getHeapView()];
    visitedArray.destroy();
    return {
      success: statusSucceed(status),
      status,
      resultPosition,
      visited
    };
  }
  /**
   * Returns a random point on the navmesh.
   * @param options additional options
   * @returns a random point on the navmesh
   */
  findRandomPoint(options) {
    const randomPolyRefRaw = new Raw.UnsignedIntRef();
    const randomPointRaw = new Raw.Vec3();
    const status = this.raw.findRandomPoint(options?.filter?.raw ?? this.defaultFilter.raw, randomPolyRefRaw, randomPointRaw);
    const randomPolyRef = randomPolyRefRaw.value;
    Raw.destroy(randomPolyRefRaw);
    const randomPoint = vec3.fromRaw(randomPointRaw);
    Raw.destroy(randomPointRaw);
    return {
      success: statusSucceed(status),
      status,
      randomPolyRef,
      randomPoint
    };
  }
  /**
   * Gets the height of the polygon at the provided position using the height detail.
   *
   * @param polyRef the reference id of the polygon.
   * @param position a position within the xz-bounds of the polygon.
   */
  getPolyHeight(polyRef, position) {
    const floatRef = new Raw.FloatRef();
    const status = this.raw.getPolyHeight(polyRef, vec3.toArray(position), floatRef);
    const height = floatRef.value;
    Raw.destroy(floatRef);
    return {
      success: statusSucceed(status),
      status,
      height
    };
  }
  /**
   * Finds a straight path from the start position to the end position.
   *
   * @param start the start position
   * @param end the end position
   * @param options additional options
   *
   * @returns an array of Vector3 positions that make up the path, or an empty array if no path was found.
   */
  computePath(start, end, options) {
    const filter = options?.filter ?? this.defaultFilter;
    const halfExtents = options?.halfExtents ?? this.defaultQueryHalfExtents;
    const startNearestPolyResult = this.findNearestPoly(start, {
      filter,
      halfExtents
    });
    if (!startNearestPolyResult.success) {
      return {
        success: false,
        error: {
          name: "findNearestPoly for start position failed",
          status: startNearestPolyResult.status
        },
        path: []
      };
    }
    const endNearestPolyResult = this.findNearestPoly(end, {
      filter,
      halfExtents
    });
    if (!endNearestPolyResult.success) {
      return {
        success: false,
        error: {
          name: "findNearestPoly for end position failed",
          status: endNearestPolyResult.status
        },
        path: []
      };
    }
    const startRef = startNearestPolyResult.nearestRef;
    const endRef = endNearestPolyResult.nearestRef;
    const maxPathPolys = options?.maxPathPolys ?? 256;
    const findPathResult = this.findPath(startRef, endRef, start, end, {
      filter,
      maxPathPolys
    });
    if (!findPathResult.success) {
      return {
        success: false,
        error: {
          name: "findPath unsuccessful",
          status: findPathResult.status
        },
        path: []
      };
    }
    if (findPathResult.polys.size <= 0) {
      return {
        success: false,
        error: {
          name: "no polygon path found"
        },
        path: []
      };
    }
    const lastPoly = findPathResult.polys.get(findPathResult.polys.size - 1);
    let closestEnd = {
      x: end.x,
      y: end.y,
      z: end.z
    };
    if (lastPoly !== endRef) {
      const lastPolyClosestPointResult = this.closestPointOnPoly(lastPoly, end);
      if (!lastPolyClosestPointResult.success) {
        return {
          success: false,
          error: {
            name: "no closest point on last polygon found",
            status: lastPolyClosestPointResult.status
          },
          path: []
        };
      }
      closestEnd = lastPolyClosestPointResult.closestPoint;
    }
    const maxStraightPathPoints = options?.maxStraightPathPoints;
    const findStraightPathResult = this.findStraightPath(start, closestEnd, findPathResult.polys, {
      maxStraightPathPoints
    });
    if (!findStraightPathResult.success) {
      return {
        success: false,
        error: {
          name: "findStraightPath unsuccessful",
          status: findStraightPathResult.status
        },
        path: []
      };
    }
    const {
      straightPath,
      straightPathCount
    } = findStraightPathResult;
    const points = [];
    for (let i = 0; i < straightPathCount; i++) {
      points.push({
        x: straightPath.get(i * 3),
        y: straightPath.get(i * 3 + 1),
        z: straightPath.get(i * 3 + 2)
      });
    }
    findPathResult.polys.destroy();
    findStraightPathResult.straightPath.destroy();
    findStraightPathResult.straightPathFlags.destroy();
    findStraightPathResult.straightPathRefs.destroy();
    return {
      success: true,
      path: points
    };
  }
  /**
   * Finds a path from the start polygon to the end polygon.
   * @param startRef the reference id of the start polygon.
   * @param endRef the reference id of the end polygon.
   * @param startPosition position within the start polygon.
   * @param endPosition position within the end polygon.
   * @param options additional options
   * @returns
   *
   * The `polys` array returned must be freed after use.
   *
   * ```ts
   * findPathResult.polys.destroy();
   * ```
   */
  findPath(startRef, endRef, startPosition, endPosition, options) {
    const filter = options?.filter ?? this.defaultFilter;
    const maxPathPolys = options?.maxPathPolys ?? 256;
    const polysArray = new UnsignedIntArray();
    polysArray.resize(maxPathPolys);
    const status = this.raw.findPath(startRef, endRef, vec3.toArray(startPosition), vec3.toArray(endPosition), filter.raw, polysArray.raw, maxPathPolys);
    return {
      success: statusSucceed(status),
      status,
      polys: polysArray
    };
  }
  /**
   * Finds the straight path from the start to the end position within the polygon corridor.
   *
   * This method peforms what is often called 'string pulling'.
   *
   * The start position is clamped to the first polygon in the path, and the
   * end position is clamped to the last. So the start and end positions should
   * normally be within or very near the first and last polygons respectively.
   *
   * The returned polygon references represent the reference id of the polygon
   * that is entered at the associated path position. The reference id associated
   * with the end point will always be zero.  This allows, for example, matching
   * off-mesh link points to their representative polygons.
   *
   * If the provided result arrays are too small for the entire result set,
   * they will be filled as far as possible from the start toward the end
   * position.
   *
   * @param start path start position
   * @param end path end position
   * @param path an array of polygon references that represent the path corridor
   * @param options additional options
   * @returns the straight path result
   *
   * The straightPath, straightPathFlags, and straightPathRefs arrays returned must be freed after use.
   *
   * ```ts
   * findStraightPathResult.straightPath.destroy();
   * findStraightPathResult.straightPathFlags.destroy();
   * findStraightPathResult.straightPathRefs.destroy();
   * ```
   */
  findStraightPath(start, end, path, options) {
    const maxStraightPathPoints = options?.maxStraightPathPoints ?? 256;
    const straightPathOptions = options?.straightPathOptions ?? 0;
    let pathPolys;
    if (Array.isArray(path)) {
      pathPolys = new UnsignedIntArray();
      pathPolys.copy(path);
    } else {
      pathPolys = path;
    }
    const straightPath = new FloatArray();
    straightPath.resize(maxStraightPathPoints * 3);
    const straightPathFlags = new UnsignedCharArray();
    straightPathFlags.resize(maxStraightPathPoints);
    const straightPathRefs = new UnsignedIntArray();
    straightPathRefs.resize(maxStraightPathPoints);
    const straightPathCountRaw = new Raw.IntRef();
    const status = this.raw.findStraightPath(vec3.toArray(start), vec3.toArray(end), pathPolys.raw, straightPath.raw, straightPathFlags.raw, straightPathRefs.raw, straightPathCountRaw, maxStraightPathPoints, straightPathOptions);
    const straightPathCount = straightPathCountRaw.value;
    Raw.destroy(straightPathCountRaw);
    if (Array.isArray(path)) {
      pathPolys.destroy();
    }
    return {
      success: statusSucceed(status),
      status,
      straightPath,
      straightPathFlags,
      straightPathRefs,
      straightPathCount
    };
  }
  /**
   * Casts a 'walkability' ray along the surface of the navigation mesh from the start position toward the end position.
   *
   * This method is meant to be used for quick, short distance checks.
   *
   * If the path array is too small to hold the result, it will be filled as far as possible from the start postion toward the end position.
   *
   * The raycast ignores the y-value of the end position. (2D check.) This places significant limits on how it can be used.
   *
   * <b>Using the Hit Parameter (t)</b>
   *
   * If the hit parameter is a very high value, then the ray has hit
   * the end position. In this case the path represents a valid corridor to the
   * end position and the value of hitNormal is undefined.
   *
   * If the hit parameter is zero, then the start position is on the wall that
   * was hit and the value of hitNormal is undefined.
   *
   * If 0 < t < 1.0 then the following applies:
   *
   * ```
   * distanceToHitBorder = distanceToEndPosition * t
   * hitPoint = startPos + (endPos - startPos) * t
   * ```
   *
   * <b>Use Case Restriction</b>
   *
   * Consider a scene where there is a main floor with a second floor balcony that hangs over the main floor.
   * So the first floor mesh extends below the balcony mesh.
   * The start position is somewhere on the first floor.
   * The end position is on the balcony.
   *
   * The raycast will search toward the end position along the first floor mesh.
   * If it reaches the end position's xz-coordinates it will indicate FLT_MAX,(no wall hit), meaning it reached the end position.
   * This is one example of why this method is meant for short distance checks.
   *
   * @param startRef the reference id of the start polygon.
   * @param startPosition a position within the start polygon representing the start of the ray
   * @param endPosition the position to cast the ray toward.
   * @param options additional options
   */
  raycast(startRef, startPosition, endPosition, options) {
    const raycastHit = new Raw.Module.dtRaycastHit();
    const raycastOptions = options?.raycastOptions ?? 0;
    const prevRef = options?.prevRef ?? 0;
    const queryFilter = options?.filter?.raw ?? this.defaultFilter.raw;
    const status = this.raw.raycast(startRef, vec3.toArray(startPosition), vec3.toArray(endPosition), queryFilter, raycastOptions, raycastHit, prevRef);
    const result = {
      success: statusSucceed(status),
      status,
      t: raycastHit.t,
      hitNormal: vec3.fromArray(array((i) => raycastHit.get_hitNormal(i), 3)),
      hitEdgeIndex: raycastHit.hitEdgeIndex,
      path: array((i) => raycastHit.get_path(i), raycastHit.pathCount),
      maxPath: raycastHit.maxPath,
      pathCost: raycastHit.pathCost
    };
    Raw.destroy(raycastHit);
    return result;
  }
  /**
   * Destroys the NavMeshQuery instance
   */
  destroy() {
    this.raw.destroy();
  }
}
class NavMeshGetTilesAtResult {
  constructor(raw) {
    this.raw = raw;
  }
  tiles(index) {
    return new DetourMeshTile(this.raw.get_tiles(index));
  }
  tileCount() {
    return this.raw.tileCount;
  }
}
class NavMeshRemoveTileResult {
  constructor(raw) {
    this.raw = raw;
  }
  data() {
    return array((i) => this.raw.get_data(i), this.raw.dataSize);
  }
  dataSize() {
    return this.raw.dataSize;
  }
}
class NavMeshCalcTileLocResult {
  constructor(raw) {
    this.raw = raw;
  }
  tileX() {
    return this.raw.tileX;
  }
  tileY() {
    return this.raw.tileY;
  }
}
class NavMeshStoreTileStateResult {
  constructor(raw) {
    this.raw = raw;
  }
  data() {
    return array((i) => this.raw.get_data(i), this.raw.dataSize);
  }
  dataSize() {
    return this.raw.dataSize;
  }
}
class NavMesh {
  constructor(raw) {
    this.raw = raw ?? new Raw.Module.NavMesh();
  }
  /**
   * Initializes the NavMesh for use with a single tile.
   * @param navMeshData the nav mesh data
   * @returns the status of the operation
   */
  initSolo(navMeshData) {
    return this.raw.initSolo(navMeshData.raw);
  }
  /**
   * Initializes the NavMesh for use with multiple tiles.
   * @param params parameters for the NavMesh
   * @returns the status of the operation
   */
  initTiled(params) {
    return this.raw.initTiled(params.raw);
  }
  /**
   * Adds a tile to the NavMesh.
   * @param navMeshData the nav mesh data
   * @param flags the flags to use when building the nav mesh
   * @param lastRef
   * @returns the status of the operation and the reference of the added tile
   */
  addTile(navMeshData, flags, lastRef) {
    const tileRefRaw = new Raw.UnsignedIntRef();
    const status = this.raw.addTile(navMeshData.raw, flags, lastRef, tileRefRaw);
    const tileRef = tileRefRaw.value;
    Raw.destroy(tileRefRaw);
    return {
      status,
      tileRef
    };
  }
  /**
   * Decodes a standard polygon reference.
   * @param polyRef The polygon reference to decode
   * @returns the decoded polygon reference
   */
  decodePolyId(polyRef) {
    const saltRef = new Raw.UnsignedIntRef();
    const itRef = new Raw.UnsignedIntRef();
    const ipRef = new Raw.UnsignedIntRef();
    this.raw.decodePolyId(polyRef, saltRef, itRef, ipRef);
    const tileSalt = saltRef.value;
    Raw.destroy(saltRef);
    const tileIndex = itRef.value;
    Raw.destroy(itRef);
    const tilePolygonIndex = ipRef.value;
    Raw.destroy(ipRef);
    return {
      tileSalt,
      tileIndex,
      tilePolygonIndex
    };
  }
  /**
   * Derives a standard polygon reference.
   * @param salt The tile's salt value.
   * @param tileIndex The index of the tile. `it` in the C++ api.
   * @param tilePolygonIndex The index of the polygon within the tile. `ip` in the C++ api.
   * @returns the derived polygon reference
   */
  encodePolyId(salt, tileIndex, tilePolygonIndex) {
    return this.raw.encodePolyId(salt, tileIndex, tilePolygonIndex);
  }
  /**
   * Removes a tile from the NavMesh
   * @param ref the tile ref
   * @returns the nav mesh data, so it can be added back later
   */
  removeTile(ref) {
    return new NavMeshRemoveTileResult(this.raw.removeTile(ref));
  }
  /**
   * Calculates the tile grid location for the specified world position.
   * @param pos The world position for the query. [(x, y, z)]
   * @returns
   */
  calcTileLoc(pos) {
    return new NavMeshCalcTileLocResult(this.raw.calcTileLoc(vec3.toArray(pos)));
  }
  /**
   * Gets the tile at the specified grid location.
   * @param x The tile's x-location. (x, y, layer)
   * @param y The tile's y-location. (x, y, layer)
   * @param layer The tile's layer. (x, y, layer)
   * @returns The tile, or null if the tile does not exist.
   */
  getTileAt(x, y, layer) {
    const tile = this.raw.getTileAt(x, y, layer);
    return !Raw.isNull(tile) ? new DetourMeshTile(tile) : null;
  }
  /**
   * Gets all tiles at the specified grid location. (All layers.)
   * @param x The tile's x-location. (x, y)
   * @param y The tile's y-location. (x, y)
   * @param maxTiles The maximum tiles the tiles parameter can hold.
   */
  getTilesAt(x, y, maxTiles) {
    return new NavMeshGetTilesAtResult(this.raw.getTilesAt(x, y, maxTiles));
  }
  /**
   * Gets the tile reference for the tile at specified grid location.
   * @param x The tile's x-location. (x, y, layer)
   * @param y The tile's y-location. (x, y, layer)
   * @param layer The tile's layer. (x, y, layer)
   * @returns The tile reference of the tile, or 0 if there is none.
   */
  getTileRefAt(x, y, layer) {
    return this.raw.getTileRefAt(x, y, layer);
  }
  /**
   * Gets the tile reference for the specified tile.
   * @param tile
   * @returns
   */
  getTileRef(tile) {
    return this.raw.getTileRef(tile.raw);
  }
  /**
   * Gets the tile for the specified tile reference.
   * @param ref The tile reference of the tile to retrieve.
   * @returns The tile for the specified reference, or null if the reference is invalid.
   */
  getTileByRef(ref) {
    const tile = this.raw.getTileByRef(ref);
    return !Raw.isNull(tile) ? new DetourMeshTile(tile) : null;
  }
  /**
   * Returns the maximum number of tiles supported by the navigation mesh.
   */
  getMaxTiles() {
    return this.raw.getMaxTiles();
  }
  /**
   * Gets the tile at the specified index.
   * @param i the tile index. [Limit: 0 >= index < #getMaxTiles()]
   * @returns
   */
  getTile(i) {
    return new DetourMeshTile(this.raw.getTile(i));
  }
  /**
   * Gets the tile and polygon for the specified polygon reference.
   * @param ref The reference for the a polygon.
   * @returns
   */
  getTileAndPolyByRef(ref) {
    const result = this.raw.getTileAndPolyByRef(ref);
    const tile = new DetourMeshTile(result.tile);
    const poly = new DetourPoly(result.poly);
    return {
      success: statusSucceed(result.status),
      status: result.status,
      tile,
      poly
    };
  }
  /**
   * Gets the tile and polygon for the specified polygon reference.
   * @param ref A known valid reference for a polygon.
   * @returns
   */
  getTileAndPolyByRefUnsafe(ref) {
    const result = this.raw.getTileAndPolyByRef(ref);
    const tile = new DetourMeshTile(result.tile);
    const poly = new DetourPoly(result.poly);
    return {
      tile,
      poly
    };
  }
  /**
   * Checks the validity of a polygon reference.
   * @param ref
   * @returns
   */
  isValidPolyRef(ref) {
    return this.raw.isValidPolyRef(ref);
  }
  /**
   * Gets the polygon reference for the tile's base polygon.
   * @param tile
   * @returns
   */
  getPolyRefBase(tile) {
    return this.raw.getPolyRefBase(tile.raw);
  }
  /**
   * Gets the endpoints for an off-mesh connection, ordered by "direction of travel".
   * @param prevRef The reference of the polygon before the connection.
   * @param polyRef The reference of the off-mesh connection polygon.
   * @returns
   */
  getOffMeshConnectionPolyEndPoints(prevRef, polyRef) {
    const startRaw = new Raw.Vec3();
    const endRaw = new Raw.Vec3();
    const status = this.raw.getOffMeshConnectionPolyEndPoints(prevRef, polyRef, startRaw, endRaw);
    const start = vec3.fromRaw(startRaw);
    Raw.destroy(startRaw);
    const end = vec3.fromRaw(endRaw);
    Raw.destroy(endRaw);
    return {
      success: statusSucceed(status),
      status,
      start,
      end
    };
  }
  /**
   * Gets the specified off-mesh connection.
   * @param ref The polygon reference of the off-mesh connection.
   * @returns
   */
  getOffMeshConnectionByRef(ref) {
    return new DetourOffMeshConnection(this.raw.getOffMeshConnectionByRef(ref));
  }
  /**
   * Sets the user defined flags for the specified polygon.
   * @param ref The polygon reference.
   * @param flags The new flags for the polygon.
   */
  setPolyFlags(ref, flags) {
    return this.raw.setPolyFlags(ref, flags);
  }
  /**
   * Gets the user defined flags for the specified polygon.
   * @param ref The polygon reference.
   * @returns
   */
  getPolyFlags(ref) {
    const flagsRaw = new Raw.UnsignedShortRef();
    const status = this.raw.getPolyFlags(ref, flagsRaw);
    const flags = flagsRaw.value;
    Raw.destroy(flagsRaw);
    return {
      status,
      flags
    };
  }
  /**
   * Sets the user defined area for the specified polygon.
   * @param ref The polygon reference.
   * @param flags The new flags for the polygon.
   */
  setPolyArea(ref, area) {
    return this.raw.setPolyArea(ref, area);
  }
  /**
   * Gets the user defined area for the specified polygon.
   * @param ref The polygon reference.
   * @returns
   */
  getPolyArea(ref) {
    const areaRaw = new Raw.UnsignedCharRef();
    const status = this.raw.getPolyArea(ref, areaRaw);
    const area = areaRaw.value;
    Raw.destroy(areaRaw);
    return {
      status,
      area
    };
  }
  /**
   * Gets the size of the buffer required by #storeTileState to store the specified tile's state.
   * @param tile
   * @returns The size of the buffer required to store the state.
   */
  getTileStateSize(tile) {
    return this.raw.getTileStateSize(tile.raw);
  }
  /**
   * Stores the non-structural state of the tile in the specified buffer. (Flags, area ids, etc.)
   * @param tile The tile.
   * @param maxDataSize The size of the data buffer. [Limit: >= #getTileStateSize]
   * @returns
   */
  storeTileState(tile, maxDataSize) {
    return new NavMeshStoreTileStateResult(this.raw.storeTileState(tile.raw, maxDataSize));
  }
  /**
   * Restores the state of the tile.
   * @param tile The tile.
   * @param data The new state. (Obtained from @see storeTileState)
   * @param maxDataSize The size of the state within the data buffer.
   * @returns
   */
  restoreTileState(tile, data, maxDataSize) {
    return this.raw.restoreTileState(tile.raw, data, maxDataSize);
  }
  /**
   * Destroys the NavMesh.
   */
  destroy() {
    this.raw.destroy();
    Raw.Module.destroy(this.raw);
  }
}
const getNavMeshPositionsAndIndices = (navMesh, flags) => {
  const positions = [];
  const indices = [];
  let tri = 0;
  const maxTiles = navMesh.getMaxTiles();
  for (let tileIndex = 0; tileIndex < maxTiles; tileIndex++) {
    const tile = navMesh.getTile(tileIndex);
    const tileHeader = tile.header();
    if (!tileHeader) continue;
    const tilePolyCount = tileHeader.polyCount();
    for (let tilePolyIndex = 0; tilePolyIndex < tilePolyCount; ++tilePolyIndex) {
      const poly = tile.polys(tilePolyIndex);
      if (poly.getType() === 1) continue;
      const polyVertCount = poly.vertCount();
      const polyDetail = tile.detailMeshes(tilePolyIndex);
      const polyDetailTriBase = polyDetail.triBase();
      const polyDetailTriCount = polyDetail.triCount();
      for (let polyDetailTriIndex = 0; polyDetailTriIndex < polyDetailTriCount; ++polyDetailTriIndex) {
        const detailTrisBaseIndex = (polyDetailTriBase + polyDetailTriIndex) * 4;
        for (let trianglePoint = 0; trianglePoint < 3; ++trianglePoint) {
          if (tile.detailTris(detailTrisBaseIndex + trianglePoint) < polyVertCount) {
            const tileVertsBaseIndex = poly.verts(tile.detailTris(detailTrisBaseIndex + trianglePoint)) * 3;
            positions.push(tile.verts(tileVertsBaseIndex), tile.verts(tileVertsBaseIndex + 1), tile.verts(tileVertsBaseIndex + 2));
          } else {
            const tileVertsBaseIndex = (polyDetail.vertBase() + tile.detailTris(detailTrisBaseIndex + trianglePoint) - poly.vertCount()) * 3;
            positions.push(tile.detailVerts(tileVertsBaseIndex), tile.detailVerts(tileVertsBaseIndex + 1), tile.detailVerts(tileVertsBaseIndex + 2));
          }
          indices.push(tri++);
        }
      }
    }
  }
  return [positions, indices];
};
const recastConfigDefaults = {
  borderSize: 0,
  tileSize: 0,
  cs: 0.2,
  ch: 0.2,
  walkableSlopeAngle: 60,
  walkableHeight: 2,
  walkableClimb: 2,
  walkableRadius: 0.5,
  maxEdgeLen: 12,
  maxSimplificationError: 1.3,
  minRegionArea: 8,
  mergeRegionArea: 20,
  maxVertsPerPoly: 6,
  detailSampleDist: 6,
  detailSampleMaxError: 1
};
const createRcConfig = (partialConfig) => {
  const config = {
    ...recastConfigDefaults,
    ...partialConfig
  };
  const rcConfig = new Raw.Module.rcConfig();
  rcConfig.borderSize = config.borderSize;
  rcConfig.tileSize = config.tileSize;
  rcConfig.cs = config.cs;
  rcConfig.ch = config.ch;
  rcConfig.walkableSlopeAngle = config.walkableSlopeAngle;
  rcConfig.walkableHeight = config.walkableHeight;
  rcConfig.walkableClimb = config.walkableClimb;
  rcConfig.walkableRadius = config.walkableRadius;
  rcConfig.maxEdgeLen = config.maxEdgeLen;
  rcConfig.maxSimplificationError = config.maxSimplificationError;
  rcConfig.minRegionArea = config.minRegionArea;
  rcConfig.mergeRegionArea = config.mergeRegionArea;
  rcConfig.maxVertsPerPoly = config.maxVertsPerPoly;
  rcConfig.detailSampleDist = config.detailSampleDist;
  rcConfig.detailSampleMaxError = config.detailSampleMaxError;
  return rcConfig;
};
class RecastBuildContext {
  logs = [];
  startTimes = {};
  accumulatedTimes = {};
  constructor(timersAndLogsEnabled = true) {
    const impl = new Raw.Module.RecastBuildContextJsImpl();
    impl.log = (category, msg, len) => {
      if (!this.raw.logEnabled()) return;
      const msgPointer = msg;
      const view = new Uint8Array(Raw.Module.HEAPU8.buffer, msgPointer, len);
      const data = new Uint8Array(len);
      data.set(view);
      const msgString = new TextDecoder().decode(data);
      this.log(category, msgString);
    };
    impl.resetLog = () => {
      this.resetLog();
    };
    impl.startTimer = (label) => {
      if (!this.raw.timerEnabled()) return;
      this.startTimer(label);
    };
    impl.stopTimer = (label) => {
      if (!this.raw.timerEnabled()) return;
      this.stopTimer(label);
    };
    impl.getAccumulatedTime = (label) => {
      if (!this.raw.timerEnabled()) return -1;
      return this.getAccumulatedTime(label);
    };
    impl.resetTimers = () => {
      if (!this.raw.timerEnabled()) return;
      this.startTimes = {};
      this.accumulatedTimes = {};
    };
    this.raw = new Raw.Module.RecastBuildContext(impl);
    this.raw.enableTimer(timersAndLogsEnabled);
    this.raw.enableLog(timersAndLogsEnabled);
    this.resetTimers();
  }
  log(category, msg) {
    this.logs.push({
      category,
      msg
    });
  }
  resetLog() {
    this.logs = [];
  }
  startTimer(label) {
    this.startTimes[label] = performance.now();
  }
  stopTimer(label) {
    const endTime = performance.now();
    const deltaTime = endTime - this.startTimes[label];
    if (this.accumulatedTimes[label] === -1) {
      this.accumulatedTimes[label] = deltaTime;
    } else {
      this.accumulatedTimes[label] += deltaTime;
    }
  }
  getAccumulatedTime(label) {
    return this.accumulatedTimes[label];
  }
  resetTimers() {
    for (let i = 0; i < Recast.RC_MAX_TIMERS; i++) {
      this.startTimes[i] = -1;
      this.accumulatedTimes[i] = -1;
    }
  }
}
class RecastSpan {
  constructor(raw) {
    this.raw = raw;
  }
  smin() {
    return this.raw.smin;
  }
  smax() {
    return this.raw.smax;
  }
  area() {
    return this.raw.area;
  }
  next() {
    return !Raw.isNull(this.raw.next) ? new RecastSpan(this.raw.next) : null;
  }
}
class RecastSpanPool {
  constructor(raw) {
    this.raw = raw;
  }
  next() {
    return !Raw.isNull(this.raw.next) ? new RecastSpanPool(this.raw.next) : null;
  }
  items(index) {
    return new RecastSpan(this.raw.get_items(index));
  }
}
class RecastHeightfield {
  constructor(raw) {
    this.raw = raw;
  }
  width() {
    return this.raw.width;
  }
  height() {
    return this.raw.height;
  }
  bmin() {
    return vec3.fromArray(array((i) => this.raw.get_bmin(i), 3));
  }
  bmax() {
    return vec3.fromArray(array((i) => this.raw.get_bmax(i), 3));
  }
  cs() {
    return this.raw.cs;
  }
  ch() {
    return this.raw.ch;
  }
  spans(index) {
    return new RecastSpan(this.raw.get_spans(index));
  }
  pools(index) {
    return new RecastSpanPool(this.raw.get_pools(index));
  }
  freelist(index) {
    return new RecastSpan(this.raw.get_freelist(index));
  }
}
class RecastCompactCell {
  constructor(raw) {
    this.raw = raw;
  }
  index() {
    return this.raw.get_index();
  }
  count() {
    return this.raw.get_count();
  }
}
class RecastCompactSpan {
  constructor(raw) {
    this.raw = raw;
  }
  y() {
    return this.raw.get_y();
  }
  reg() {
    return this.raw.get_reg();
  }
  con() {
    return this.raw.get_con();
  }
  h() {
    return this.raw.get_h();
  }
}
class RecastCompactHeightfield {
  constructor(raw) {
    this.raw = raw;
  }
  width() {
    return this.raw.width;
  }
  height() {
    return this.raw.height;
  }
  spanCount() {
    return this.raw.spanCount;
  }
  walkableHeight() {
    return this.raw.walkableHeight;
  }
  walkableClimb() {
    return this.raw.walkableClimb;
  }
  borderSize() {
    return this.raw.borderSize;
  }
  maxDistance() {
    return this.raw.maxDistance;
  }
  maxRegions() {
    return this.raw.maxRegions;
  }
  bmin() {
    return vec3.fromArray(array((i) => this.raw.get_bmin(i), 3));
  }
  bmax() {
    return vec3.fromArray(array((i) => this.raw.get_bmax(i), 3));
  }
  cs() {
    return this.raw.cs;
  }
  ch() {
    return this.raw.ch;
  }
  cells(index) {
    return new RecastCompactCell(this.raw.get_cells(index));
  }
  spans(index) {
    return new RecastCompactSpan(this.raw.get_spans(index));
  }
  dist(index) {
    return this.raw.get_dist(index);
  }
  areas(index) {
    return this.raw.get_areas(index);
  }
}
class RecastContour {
  constructor(raw) {
    this.raw = raw;
  }
  verts(index) {
    return this.raw.get_verts(index);
  }
  nverts() {
    return this.raw.nverts;
  }
  rverts(index) {
    return this.raw.get_rverts(index);
  }
  nrverts() {
    return this.raw.nrverts;
  }
  reg() {
    return this.raw.reg;
  }
  area() {
    return this.raw.area;
  }
}
class RecastContourSet {
  constructor(raw) {
    this.raw = raw;
  }
  conts(index) {
    return new RecastContour(this.raw.get_conts(index));
  }
  nconts() {
    return this.raw.nconts;
  }
  bmin() {
    return vec3.fromArray(array((i) => this.raw.get_bmin(i), 3));
  }
  bmax() {
    return vec3.fromArray(array((i) => this.raw.get_bmax(i), 3));
  }
  cs() {
    return this.raw.cs;
  }
  ch() {
    return this.raw.ch;
  }
  width() {
    return this.raw.width;
  }
  height() {
    return this.raw.height;
  }
  borderSize() {
    return this.raw.borderSize;
  }
  maxError() {
    return this.raw.maxError;
  }
}
class RecastPolyMesh {
  constructor(raw) {
    this.raw = raw;
  }
  verts(index) {
    return this.raw.get_verts(index);
  }
  polys(index) {
    return this.raw.get_polys(index);
  }
  regs(index) {
    return this.raw.get_regs(index);
  }
  flags(index) {
    return this.raw.get_flags(index);
  }
  setFlags(index, value) {
    this.raw.set_flags(index, value);
  }
  areas(index) {
    return this.raw.get_areas(index);
  }
  setAreas(index, value) {
    this.raw.set_areas(index, value);
  }
  nverts() {
    return this.raw.nverts;
  }
  npolys() {
    return this.raw.npolys;
  }
  maxpolys() {
    return this.raw.maxpolys;
  }
  nvp() {
    return this.raw.nvp;
  }
  bmin() {
    return vec3.fromArray(array((i) => this.raw.get_bmin(i), 3));
  }
  bmax() {
    return vec3.fromArray(array((i) => this.raw.get_bmax(i), 3));
  }
  cs() {
    return this.raw.cs;
  }
  ch() {
    return this.raw.ch;
  }
  borderSize() {
    return this.raw.borderSize;
  }
  maxEdgeError() {
    return this.raw.maxEdgeError;
  }
}
class RecastPolyMeshDetail {
  constructor(raw) {
    this.raw = raw;
  }
  meshes(index) {
    return this.raw.get_meshes(index);
  }
  verts(index) {
    return this.raw.get_verts(index);
  }
  tris(index) {
    return this.raw.get_tris(index);
  }
  nmeshes() {
    return this.raw.nmeshes;
  }
  nverts() {
    return this.raw.nverts;
  }
  ntris() {
    return this.raw.ntris;
  }
}
const calcGridSize = (bmin, bmax, cs) => {
  return Raw.Recast.calcGridSize(bmin, bmax, cs);
};
const createHeightfield = (buildContext, heightfield, width, height, bmin, bmax, cs, ch) => {
  return Raw.Recast.createHeightfield(buildContext.raw, heightfield.raw, width, height, bmin, bmax, cs, ch);
};
const markWalkableTriangles = (buildContext, walkableSlopeAngle, verts, nv, tris, nt, areas) => {
  return Raw.Recast.markWalkableTriangles(buildContext.raw, walkableSlopeAngle, verts.raw, nv, tris.raw, nt, areas.raw);
};
const rasterizeTriangles = (buildContext, verts, nv, tris, areas, nt, heightfield, flagMergeThreshold = 1) => {
  return Raw.Recast.rasterizeTriangles(buildContext.raw, verts.raw, nv, tris.raw, areas.raw, nt, heightfield.raw, flagMergeThreshold);
};
const filterLowHangingWalkableObstacles = (buildContext, walkableClimb, heightfield) => {
  return Raw.Recast.filterLowHangingWalkableObstacles(buildContext.raw, walkableClimb, heightfield.raw);
};
const filterLedgeSpans = (buildContext, walkableHeight, walkableClimb, heightfield) => {
  return Raw.Recast.filterLedgeSpans(buildContext.raw, walkableHeight, walkableClimb, heightfield.raw);
};
const filterWalkableLowHeightSpans = (buildContext, walkableHeight, heightfield) => {
  return Raw.Recast.filterWalkableLowHeightSpans(buildContext.raw, walkableHeight, heightfield.raw);
};
const buildCompactHeightfield = (buildContext, walkableHeight, walkableClimb, heightfield, compactHeightfield) => {
  return Raw.Recast.buildCompactHeightfield(buildContext.raw, walkableHeight, walkableClimb, heightfield.raw, compactHeightfield.raw);
};
const erodeWalkableArea = (buildContext, radius, compactHeightfield) => {
  return Raw.Recast.erodeWalkableArea(buildContext.raw, radius, compactHeightfield.raw);
};
const buildDistanceField = (buildContext, compactHeightfield) => {
  return Raw.Recast.buildDistanceField(buildContext.raw, compactHeightfield.raw);
};
const buildRegions = (buildContext, compactHeightfield, borderSize, minRegionArea, mergeRegionArea) => {
  return Raw.Recast.buildRegions(buildContext.raw, compactHeightfield.raw, borderSize, minRegionArea, mergeRegionArea);
};
const buildContours = (buildContext, compactHeightfield, maxError, maxEdgeLen, contourSet, buildFlags = Recast.RC_CONTOUR_TESS_WALL_EDGES) => {
  return Raw.Recast.buildContours(buildContext.raw, compactHeightfield.raw, maxError, maxEdgeLen, contourSet.raw, buildFlags);
};
const buildPolyMesh = (buildContext, contourSet, nvp, polyMesh) => {
  return Raw.Recast.buildPolyMesh(buildContext.raw, contourSet.raw, nvp, polyMesh.raw);
};
const buildPolyMeshDetail = (buildContext, mesh, compactHeightfield, sampleDist, sampleMaxError, polyMeshDetail) => {
  return Raw.Recast.buildPolyMeshDetail(buildContext.raw, mesh.raw, compactHeightfield.raw, sampleDist, sampleMaxError, polyMeshDetail.raw);
};
const allocHeightfield = () => {
  return new RecastHeightfield(Raw.Recast.allocHeightfield());
};
const freeHeightfield = (heightfield) => {
  return Raw.Recast.freeHeightfield(heightfield.raw);
};
const allocCompactHeightfield = () => {
  return new RecastCompactHeightfield(Raw.Recast.allocCompactHeightfield());
};
const freeCompactHeightfield = (compactHeightfield) => {
  return Raw.Recast.freeCompactHeightfield(compactHeightfield.raw);
};
const allocContourSet = () => {
  return new RecastContourSet(Raw.Recast.allocContourSet());
};
const freeContourSet = (contourSet) => {
  return Raw.Recast.freeContourSet(contourSet.raw);
};
const allocPolyMesh = () => {
  return new RecastPolyMesh(Raw.Recast.allocPolyMesh());
};
const freePolyMesh = (polyMesh) => {
  return Raw.Recast.freePolyMesh(polyMesh.raw);
};
const allocPolyMeshDetail = () => {
  return new RecastPolyMeshDetail(Raw.Recast.allocPolyMeshDetail());
};
const freePolyMeshDetail = (polyMeshDetail) => {
  return Raw.Recast.freePolyMeshDetail(polyMeshDetail.raw);
};
const KNOWN = [
  // Places a map means to be one-way (its own description says so): a pad up, no way back.
  { map: "skyward", code: "nav.trap", near: [0, 8.1, -32], why: "the heavy-armour perch: a pad up, no way back, as the map says" },
  { map: "skyward", code: "nav.trap", near: [0, 8.1, 32], why: "the railgun perch: a pad up, no way back, as the map says" },
  { map: "skyward", code: "nav.trap", near: [-40, 4.1, 0], why: "the plasma gun tower (x -40): a pad up, no way back, as the map says" },
  { map: "skyward", code: "nav.trap", near: [40, 4.1, 0], why: "the disc launcher tower (x 40): a pad up, no way back, as the map says" }
];
function knownNavIssue(map, code, near2, id) {
  for (const k of KNOWN) {
    if (k.map !== map || k.code !== code) continue;
    if (k.id !== void 0 && k.id !== id) continue;
    if (k.near && (!near2 || hypot(near2.x - k.near[0], near2.z - k.near[2]) > 6 || Math.abs(near2.y - k.near[1]) > 4)) continue;
    return k.why;
  }
  return null;
}
const STEP_OFF_REACH = 2.2;
const FALL_SPACING = 1.5;
const FALL_REACH = [1.3, 2.2, 3.2];
const FALL_MIN = PLAYER.maxStepHeight + 0.05;
const CLEAR_AT = [0.35, 0.9, 1.6];
const EXITS_PER_PATCH = 3;
const EXIT_SPACING = 4;
const EXIT_RIM = 16;
const EXIT_SPACING_LONG = 8;
const EXITS_MAX_PER_PATCH = 12;
const MAX_EXITS = 600;
function moveRay(physics, solids, o, d, maxDist) {
  const a = physics.moveRay(o, d, maxDist);
  if (!solids?.length) return a;
  const b = boxesRay(solids, o, d, a ?? maxDist);
  return b === null ? a : a === null ? b : Math.min(a, b);
}
const shapes = /* @__PURE__ */ new WeakMap();
function polyShapes(g) {
  let s = shapes.get(g);
  if (s) return s;
  const centre = new Float32Array(g.count * 3);
  const area = new Float32Array(g.count);
  for (let i = 0; i < g.count; i++) {
    const a = g.vstart[i];
    const b = g.vstart[i + 1];
    let x = 0;
    let y = 0;
    let z = 0;
    for (let k = a; k < b; k++) {
      x += g.vxyz[k * 3];
      y += g.vxyz[k * 3 + 1];
      z += g.vxyz[k * 3 + 2];
    }
    const n = Math.max(1, b - a);
    centre[i * 3] = x / n;
    centre[i * 3 + 1] = y / n;
    centre[i * 3 + 2] = z / n;
    if (g.type[i] !== 0) continue;
    let s2 = 0;
    for (let k = a; k < b; k++) {
      const k2 = k + 1 < b ? k + 1 : a;
      s2 += g.vxyz[k * 3] * g.vxyz[k2 * 3 + 2] - g.vxyz[k2 * 3] * g.vxyz[k * 3 + 2];
    }
    area[i] = Math.abs(s2) / 2;
  }
  s = { centre, area };
  shapes.set(g, s);
  return s;
}
const DOWN$1 = { x: 0, y: -1, z: 0 };
function fallsFrom(nav, physics, poly, opts, near2, slides = false) {
  const g = nav.graph();
  const out = [];
  if (g.type[poly] !== 0 || !g.open[poly] || disabled(g, poly)) return out;
  const { centre } = polyShapes(g);
  const cx = centre[poly * 3];
  const cz = centre[poly * 3 + 2];
  const a0 = g.vstart[poly];
  const vc = g.vstart[poly + 1] - a0;
  const v = g.vxyz;
  for (let j = 0; j < vc; j++) {
    if (!(g.open[poly] & 1 << j)) continue;
    const ia = (a0 + j) * 3;
    const ib = (a0 + (j + 1) % vc) * 3;
    const ax = v[ia];
    const ay = v[ia + 1];
    const az = v[ia + 2];
    const dx = v[ib] - ax;
    const dy = v[ib + 1] - ay;
    const dz = v[ib + 2] - az;
    const len = hypot(dx, dz);
    if (len < 0.2) continue;
    let nx = dz / len;
    let nz = -dx / len;
    if (nx * (ax + dx / 2 - cx) + nz * (az + dz / 2 - cz) < 0) {
      nx = -nx;
      nz = -nz;
    }
    const m = Math.max(1, Math.round(len / FALL_SPACING));
    for (let k = 0; k < m; k++) {
      const t = (k + 0.5) / m;
      const at2 = { x: ax + dx * t, y: ay + dy * t, z: az + dz * t };
      if (near2 && !near2(at2.x, at2.y, at2.z)) continue;
      const f = traceFall(physics, at2, nx, nz, opts);
      if (!f) continue;
      let hit = nav.nearestPoly({ x: f.x, y: f.y + 0.3, z: f.z }, { x: 1.6, y: 0.8, z: 1.6 });
      if (hit && !walkable(physics, opts.solids, f, hit.point)) hit = null;
      if (slides && (!hit || hit.point.y > f.y + 0.4) && steepAt(physics, opts, f)) hit = slideFoot(nav, physics, f, at2.y - opts.maxDrop, opts) ?? hit;
      if (hit && hit.index === poly) continue;
      const land = hit ? hit.point : f;
      out.push({ from: poly, to: hit ? hit.index : -1, at: at2, land, drop: at2.y - land.y });
    }
  }
  return out;
}
function walkable(physics, solids, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = hypot(dx, dz);
  if (len < 0.05) return true;
  const dir = { x: dx / len, y: 0, z: dz / len };
  for (const h of [0.4, 0.9]) {
    const y = Math.max(a.y, b.y) + h;
    const d = moveRay(physics, solids, { x: a.x, y, z: a.z }, dir, len);
    if (d !== null) return false;
  }
  return true;
}
const BODY_FROM = PLAYER.maxStepHeight + 0.1;
const BODY_HALF = { x: PLAYER.radius - 0.05, y: (PLAYER.height - BODY_FROM) / 2, z: PLAYER.radius - 0.05 };
const BODY_STEP = 0.25;
function bodyFits(physics, solids, feet) {
  const c = { x: feet.x, y: feet.y + BODY_FROM + BODY_HALF.y, z: feet.z };
  return physics.boxClear(c, BODY_HALF) && !(solids?.length && boxesOverlap(solids, c, BODY_HALF));
}
function traceFall(physics, at2, nx, nz, opts) {
  const dir = { x: nx, y: 0, z: nz };
  const far = FALL_REACH[FALL_REACH.length - 1];
  let clear = far;
  for (const h of CLEAR_AT) {
    const d = moveRay(physics, opts.solids, { x: at2.x, y: at2.y + h, z: at2.z }, dir, far);
    if (d !== null && d < clear) clear = d;
  }
  const floorY = opts.floorY ?? -60;
  for (const d of FALL_REACH) {
    if (d > clear - PLAYER.radius) return null;
    const x = at2.x + nx * d;
    const z = at2.z + nz * d;
    const top = at2.y + 0.5;
    const down = moveRay(physics, opts.solids, { x, y: top, z }, DOWN$1, top - floorY);
    if (down === null) return null;
    const y = top - down;
    if (y > at2.y - FALL_MIN) continue;
    if (at2.y - y > opts.maxDrop) return null;
    const land = { x, y, z };
    if (opts.deadly?.(land) || opts.underLiquid?.(land)) return null;
    return bodyGetsOff(physics, at2, nx, nz, d, opts) ? land : null;
  }
  return null;
}
function bodyGetsOff(physics, at2, nx, nz, d, opts) {
  for (let s = BODY_STEP; s <= d + 1e-6; s += BODY_STEP) {
    const x = at2.x + nx * s;
    const z = at2.z + nz * s;
    const ground = moveRay(physics, opts.solids, { x, y: at2.y + 0.5, z }, DOWN$1, 0.5 + FALL_MIN);
    if (!bodyFits(physics, opts.solids, { x, y: ground === null ? at2.y : Math.max(at2.y, at2.y + 0.5 - ground), z })) return false;
    if (ground === null) return true;
  }
  return true;
}
const SLIDE_REACH = 8;
const SLIDE_DOWN = 12;
function steepAt(physics, opts, p) {
  const y = (dx, dz) => {
    const top = p.y + 1.5;
    const d = moveRay(physics, opts.solids, { x: p.x + dx, y: top, z: p.z + dz }, DOWN$1, 3);
    return d === null ? null : top - d;
  };
  const xa = y(0.4, 0);
  const xb = y(-0.4, 0);
  const za = y(0, 0.4);
  const zb = y(0, -0.4);
  if (xa === null || xb === null || za === null || zb === null) return false;
  const slope = Math.hypot((xa - xb) / 0.8, (za - zb) / 0.8);
  return slope > Math.tan((PLAYER.maxSlopeDegrees - 2) * Math.PI / 180);
}
function slideFoot(nav, physics, f, lowest, opts) {
  const down = Math.min(SLIDE_DOWN, f.y - lowest);
  if (down < 0.3) return null;
  const hit = nav.nearestPoly({ x: f.x, y: f.y - down / 2, z: f.z }, { x: SLIDE_REACH, y: down / 2 + 0.2, z: SLIDE_REACH });
  if (!hit) return null;
  const p = hit.point;
  const d = hypot(p.x - f.x, p.z - f.z);
  if (p.y > f.y || d > SLIDE_REACH) return null;
  const n = Math.max(2, Math.ceil(d / 0.25));
  const ground = [f];
  let prev = f.y;
  for (let k = 1; k <= n; k++) {
    const x = f.x + (p.x - f.x) * k / n;
    const z = f.z + (p.z - f.z) * k / n;
    const top = prev + 1;
    const g = moveRay(physics, opts.solids, { x, y: top, z }, DOWN$1, top - p.y + 1);
    if (g === null) return null;
    const y = top - g;
    if (y > prev + PLAYER.maxStepHeight) return null;
    prev = Math.min(prev, y);
    ground.push({ x, y, z });
  }
  for (let k = 0; k + 1 < ground.length; k += 4) {
    const a = ground[k];
    const b = ground[Math.min(ground.length - 1, k + 4)];
    for (const h of [0.9, 1.6]) if (!physics.lineOfSight({ x: a.x, y: a.y + h, z: a.z }, { x: b.x, y: b.y + h, z: b.z })) return null;
  }
  if (opts.deadly?.(p) || opts.underLiquid?.(p)) return null;
  return hit;
}
const disabled = (g, i) => g.type[i] === 0 && g.flags[i] === 0;
function edgesOf(g, extra = []) {
  const n = g.count;
  const ok = (a, b) => !disabled(g, a) && !disabled(g, b);
  const deg = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) for (let l = g.linkStart[i]; l < g.linkStart[i + 1]; l++) if (ok(i, g.links[l])) deg[i + 1]++;
  for (const [a, b] of extra) if (ok(a, b)) deg[a + 1]++;
  for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
  const fill = deg.slice(0, n);
  const to = new Int32Array(deg[n]);
  for (let i = 0; i < n; i++) for (let l = g.linkStart[i]; l < g.linkStart[i + 1]; l++) if (ok(i, g.links[l])) to[fill[i]++] = g.links[l];
  for (const [a, b] of extra) if (ok(a, b)) to[fill[a]++] = b;
  return { start: deg, to };
}
function reverseOf(e, n) {
  const deg = new Int32Array(n + 1);
  for (let i = 0; i < e.to.length; i++) deg[e.to[i] + 1]++;
  for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
  const fill = deg.slice(0, n);
  const to = new Int32Array(e.to.length);
  for (let a = 0; a < n; a++) for (let k = e.start[a]; k < e.start[a + 1]; k++) to[fill[e.to[k]]++] = a;
  return { start: deg, to };
}
function reach(e, n, seeds) {
  const seen = new Uint8Array(n);
  const stack = [];
  for (const s of seeds) {
    if (s < 0 || s >= n || seen[s]) continue;
    seen[s] = 1;
    stack.push(s);
  }
  while (stack.length) {
    const a = stack.pop();
    for (let k = e.start[a]; k < e.start[a + 1]; k++) {
      const b = e.to[k];
      if (!seen[b]) {
        seen[b] = 1;
        stack.push(b);
      }
    }
  }
  return seen;
}
function components(e, n) {
  const index = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const of = new Int32Array(n).fill(-1);
  const stack = [];
  const call = [];
  const edge = [];
  let next = 0;
  let count = 0;
  for (let s = 0; s < n; s++) {
    if (index[s] >= 0) continue;
    call.push(s);
    edge.push(e.start[s]);
    index[s] = low[s] = next++;
    stack.push(s);
    onStack[s] = 1;
    while (call.length) {
      const v = call[call.length - 1];
      const k = edge[edge.length - 1];
      if (k < e.start[v + 1]) {
        edge[edge.length - 1] = k + 1;
        const w = e.to[k];
        if (index[w] < 0) {
          index[w] = low[w] = next++;
          stack.push(w);
          onStack[w] = 1;
          call.push(w);
          edge.push(e.start[w]);
        } else if (onStack[w]) low[v] = Math.min(low[v], index[w]);
        continue;
      }
      call.pop();
      edge.pop();
      if (call.length) {
        const u = call[call.length - 1];
        low[u] = Math.min(low[u], low[v]);
      }
      if (low[v] === index[v]) {
        let w;
        do {
          w = stack.pop();
          onStack[w] = 0;
          of[w] = count;
        } while (w !== v);
        count++;
      }
    }
  }
  return { of, count };
}
function reachSet(start, to, n, seeds) {
  return reach({ start, to }, n, seeds);
}
function routeComponents(g, spawns = []) {
  const e = edgesOf(g);
  const comps = components(e, g.count);
  const main = g.count ? mainOf(g, comps, spawns, e) : -1;
  const mainPolys = [];
  for (let i = 0; i < g.count; i++) if (comps.of[i] === main) mainPolys.push(i);
  return { comp: comps.of, main, fromMain: reach(e, g.count, mainPolys), start: e.start, to: e.to };
}
function spawnPolys(map, nav) {
  const all = [];
  const byTeam = /* @__PURE__ */ new Map();
  const at2 = /* @__PURE__ */ new Map();
  for (const e of map.entities) {
    if (e.kind !== "spawn") continue;
    const hit = nav.nearestPoly({ x: e.position[0], y: e.position[1], z: e.position[2] }, { x: 1, y: 1, z: 1 });
    if (!hit) continue;
    all.push(hit.index);
    at2.set(e.id, hit.index);
    const team = e.faction ?? "";
    (byTeam.get(team) ?? byTeam.set(team, []).get(team)).push(hit.index);
  }
  return { all, byTeam, at: at2 };
}
function mainOf(g, comps, spawns, edges2) {
  const { area } = polyShapes(g);
  const size = new Float64Array(comps.count);
  for (let i = 0; i < g.count; i++) if (!disabled(g, i)) size[comps.of[i]] += area[i];
  const score = new Float64Array(comps.count);
  if (edges2 && spawns.length) {
    const byComp = /* @__PURE__ */ new Map();
    for (const s of spawns) {
      const c = comps.of[s];
      const e = byComp.get(c);
      if (e) e.n++;
      else byComp.set(c, { poly: s, n: 1 });
    }
    const back = reverseOf(edges2, g.count);
    const hit = new Uint8Array(comps.count);
    for (const { poly, n } of [...byComp.values()].slice(0, 64)) {
      for (const e of [edges2, back]) {
        const seen = reach(e, g.count, [poly]);
        hit.fill(0);
        for (let i = 0; i < g.count; i++) if (seen[i]) hit[comps.of[i]] = 1;
        for (let c = 0; c < comps.count; c++) if (hit[c]) score[c] += n;
      }
    }
  }
  let best = -1;
  for (let c = 0; c < comps.count; c++) if (best < 0 || score[c] > score[best] || score[c] === score[best] && size[c] > size[best]) best = c;
  return best;
}
const OBJECTIVES = { flag: "flag base", hill: "hill", bombsite: "bomb site", hostage: "hostage", rescue: "rescue zone", objective: "Breakthrough objective" };
function auditNavigation(map, nav, physics, opts) {
  const g = nav.graph();
  const n = g.count;
  const { centre, area } = polyShapes(g);
  const routes = edgesOf(g);
  const back = reverseOf(routes, n);
  const comps = components(routes, n);
  const spawns = spawnPolys(map, nav);
  const main = n ? mainOf(g, comps, spawns.all, routes) : -1;
  const mainPolys = [];
  for (let i = 0; i < n; i++) if (comps.of[i] === main) mainPolys.push(i);
  const toMain = reach(back, n, mainPolys);
  const fromMain = reach(routes, n, mainPolys);
  const off = [];
  const wet = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (toMain[i] || g.type[i] !== 0 || disabled(g, i)) continue;
    if (opts.underLiquid?.({ x: centre[i * 3], y: centre[i * 3 + 1], z: centre[i * 3 + 2] })) wet[i] = 1;
    else off.push(i);
  }
  const grid = /* @__PURE__ */ new Map();
  const CELL2 = 8;
  const key2 = (cx, cz) => (cx + 4096) * 8192 + (cz + 4096);
  for (const i of off) {
    const cx = Math.floor(centre[i * 3] / CELL2);
    const cz = Math.floor(centre[i * 3 + 2] / CELL2);
    (grid.get(key2(cx, cz)) ?? grid.set(key2(cx, cz), []).get(key2(cx, cz))).push(i);
  }
  const isOff = new Uint8Array(n);
  for (const i of off) isOff[i] = 1;
  const nearOff = (x, y, z) => {
    const cx = Math.floor(x / CELL2);
    const cz = Math.floor(z / CELL2);
    for (let ax = cx - 1; ax <= cx + 1; ax++) {
      for (let az = cz - 1; az <= cz + 1; az++) {
        for (const i of grid.get(key2(ax, az)) ?? []) if (centre[i * 3 + 1] < y && hypot(centre[i * 3] - x, centre[i * 3 + 2] - z) < CELL2 + 4) return true;
      }
    }
    return false;
  };
  const falls = [];
  if (off.length) {
    for (let i = 0; i < n; i++) {
      if (g.type[i] !== 0 || !g.open[i]) continue;
      for (const f of fallsFrom(nav, physics, i, opts, isOff[i] ? void 0 : nearOff)) falls.push(f);
    }
  }
  const withFalls = edgesOf(g, falls.filter((f) => f.to >= 0).map((f) => [f.from, f.to]));
  const reached = reach(withFalls, n, spawns.all);
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  const join = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  for (const a of off) for (let k = routes.start[a]; k < routes.start[a + 1]; k++) if (isOff[routes.to[k]]) join(a, routes.to[k]);
  for (let l = 0; l < n; l++) {
    if (g.type[l] === 0 || toMain[l]) continue;
    for (let k = routes.start[l]; k < routes.start[l + 1]; k++) for (let k2 = back.start[l]; k2 < back.start[l + 1]; k2++) if (isOff[routes.to[k]] && isOff[back.to[k2]]) join(routes.to[k], back.to[k2]);
  }
  const byRoot = /* @__PURE__ */ new Map();
  for (const i of off) (byRoot.get(find(i)) ?? byRoot.set(find(i), []).get(find(i))).push(i);
  const patchOf = new Int32Array(n).fill(-1);
  const patches = [];
  for (const polys of byRoot.values()) {
    let a = 0;
    let x = 0;
    let y = 0;
    let z = 0;
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const i of polys) {
      const w2 = Math.max(1e-3, area[i]);
      a += area[i];
      x += centre[i * 3] * w2;
      y += centre[i * 3 + 1] * w2;
      z += centre[i * 3 + 2] * w2;
      for (let k = g.vstart[i]; k < g.vstart[i + 1]; k++) {
        min.x = Math.min(min.x, g.vxyz[k * 3]);
        min.y = Math.min(min.y, g.vxyz[k * 3 + 1]);
        min.z = Math.min(min.z, g.vxyz[k * 3 + 2]);
        max.x = Math.max(max.x, g.vxyz[k * 3]);
        max.y = Math.max(max.y, g.vxyz[k * 3 + 1]);
        max.z = Math.max(max.z, g.vxyz[k * 3 + 2]);
      }
      patchOf[i] = patches.length;
    }
    const w = polys.reduce((s, i) => s + Math.max(1e-3, area[i]), 0);
    patches.push({ polys, area: a, centre: { x: x / w, y: y / w, z: z / w }, min, max, entries: [], dropOut: null, holds: [] });
  }
  const at3 = (i) => ({ x: centre[i * 3], y: centre[i * 3 + 1], z: centre[i * 3 + 2] });
  for (const f of falls) {
    if (f.to < 0) continue;
    const p = patchOf[f.to];
    if (p >= 0 && patchOf[f.from] !== p && reached[f.from] && patches[p].entries.length < 24) patches[p].entries.push({ kind: "fall", at: f.at, drop: Math.round(f.drop * 10) / 10 });
    const q = patchOf[f.from];
    if (q >= 0 && toMain[f.to] && (!patches[q].dropOut || f.drop < patches[q].dropOut.drop)) patches[q].dropOut = f;
  }
  for (let l = 0; l < n; l++) {
    if (g.type[l] === 0) continue;
    for (let k = routes.start[l]; k < routes.start[l + 1]; k++) {
      const p = patchOf[routes.to[k]];
      if (p < 0) continue;
      for (let k2 = back.start[l]; k2 < back.start[l + 1]; k2++) {
        const from = back.to[k2];
        if (patchOf[from] !== p && reached[from] && from !== routes.to[k] && patches[p].entries.length < 24) patches[p].entries.push({ kind: "link", at: at3(from) });
      }
    }
  }
  for (const e of map.entities) {
    const i = spawns.at.get(e.id);
    if (i === void 0) continue;
    const p = patchOf[i];
    if (p >= 0) patches[p].entries.push({ kind: "spawn", at: { x: e.position[0], y: e.position[1], z: e.position[2] }, id: e.id });
  }
  const clear = (a, b) => {
    const y = Math.max(a.y, b.y);
    return physics.lineOfSight({ x: a.x, y: y + 0.5, z: a.z }, { x: b.x, y: y + 0.5, z: b.z }) && physics.lineOfSight({ x: a.x, y: y + 1.6, z: a.z }, { x: b.x, y: y + 1.6, z: b.z });
  };
  for (const p of patches) {
    if (!p.polys.some((i) => reached[i])) continue;
    let goal = null;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!toMain[i] || !fromMain[i] || g.type[i] !== 0) continue;
      const d = hypot(centre[i * 3] - p.centre.x, centre[i * 3 + 2] - p.centre.z) + Math.abs(centre[i * 3 + 1] - p.centre.y);
      if (d < best) {
        best = d;
        goal = at3(i);
      }
    }
    const step = Math.max(1, Math.floor(p.polys.length / 12));
    for (let k = 0; goal && k < p.polys.length && !p.hopOut; k += step) if (nav.escapes(at3(p.polys[k]), goal, clear).length) p.hopOut = true;
  }
  const traps = patches.filter((p) => !p.hopOut && p.polys.some((i) => reached[i]));
  const issues = [];
  const severity = (code, near2, id) => {
    if (!opts.official) return { severity: "warning", note: "" };
    const known = knownNavIssue(map.metadata.id, code, near2, id);
    return known ? { severity: "warning", note: ` (known: ${known})` } : { severity: "error", note: "" };
  };
  const fmt = (p) => `(${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)})`;
  const polyOf = /* @__PURE__ */ new Map();
  for (const e of map.entities) {
    if (e.kind !== "pickup" && !OBJECTIVES[e.kind]) continue;
    const r = e.kind === "hill" ? Math.max(1.5, (e.radius ?? 3) * 0.8) : 1.6;
    const hit = nav.nearestPoly({ x: e.position[0], y: e.position[1] + 0.3, z: e.position[2] }, { x: r, y: 2, z: r });
    if (hit) polyOf.set(e.id, hit.index);
  }
  for (const [id, i] of [...spawns.at, ...polyOf]) {
    const p = patchOf[i];
    if (p >= 0) patches[p].holds.push(id);
  }
  for (const t of traps) {
    if (t.entries.every((e) => e.kind === "spawn")) continue;
    const s = severity("nav.trap", t.centre);
    const how = t.entries.filter((e) => e.kind !== "spawn");
    const falls2 = how.filter((e) => e.kind === "fall");
    const way = falls2.length ? `falling from ${fmt(falls2[0].at)} (${falls2[0].drop} m${falls2.length > 1 ? `, and ${falls2.length - 1} more` : ""})` : `a one-way link from ${fmt(how[0].at)}`;
    const out = t.dropOut ? `; players can drop out at ${fmt(t.dropOut.at)} (${t.dropOut.drop.toFixed(1)} m), bots have no route` : "; nobody gets out";
    issues.push({ severity: s.severity, code: "nav.trap", message: `a trap of ${t.area.toFixed(0)} m² round ${fmt(t.centre)}: bots get in by ${way} and can't walk out${out}${t.holds.length ? ` (on it: ${t.holds.join(", ")})` : ""}${s.note}` });
  }
  for (const e of map.entities) {
    const i = spawns.at.get(e.id);
    if (i === void 0 || toMain[i]) continue;
    const s = severity("nav.disconnected", null, e.id);
    issues.push({ severity: s.severity, code: "nav.disconnected", message: `spawn ${e.id} is cut off: a bot spawning there can't walk to the rest of the map${s.note}`, targetId: e.id });
  }
  const teams = [...spawns.byTeam.keys()].filter((t) => t !== "");
  const spawnAt = (team) => {
    for (const e of map.entities) {
      if (e.kind !== "spawn" || team !== null && (e.faction ?? "") !== team) continue;
      const i = spawns.at.get(e.id);
      if (i !== void 0 && toMain[i]) return at3(i);
    }
    return null;
  };
  const by = (si, goal) => !!si && (si.exact || hypot(si.pos.x - goal.x, si.pos.z - goal.z) < STEP_OFF_REACH && Math.abs(si.pos.y - goal.y) < 1.4);
  const reachedBy = (from, goal) => {
    if (!from) return false;
    const si = nav.standIn(from, goal);
    if (by(si, goal)) return true;
    return !!si && nav.escapes(si.pos, goal, clear).some((e) => by(nav.standIn(e.across, goal), goal));
  };
  const anyFrom = spawnAt(null);
  for (const e of map.entities) {
    const what = e.kind === "pickup" ? "pickup" : OBJECTIVES[e.kind];
    if (!what) continue;
    const i = polyOf.get(e.id);
    const goal = { x: e.position[0], y: e.position[1], z: e.position[2] };
    let problem = "";
    if (i === void 0 && !reachedBy(anyFrom, goal)) problem = "is not on or by walkable ground";
    else if (e.kind === "pickup" || !teams.length) {
      if (!reachedBy(anyFrom, goal)) problem = "cannot be reached on foot from any spawn point";
    } else {
      const without = teams.filter((t) => !reachedBy(spawnAt(t) ?? anyFrom, goal));
      if (without.length) problem = `cannot be reached on foot from ${without.join(" and ")}'s spawn points`;
    }
    if (!problem && i !== void 0 && !toMain[i] && !reachedBy(anyFrom, goal)) problem = "is on a patch bots can't walk out of";
    if (!problem) continue;
    const s = severity(`nav.${e.kind}_unreachable`, null, e.id);
    issues.push({ severity: s.severity, code: `nav.${e.kind}_unreachable`, message: `${what} ${e.id} ${problem}${s.note}`, targetId: e.id });
  }
  return { graph: g, comp: comps.of, main, toMain, fromMain, reached, patches, traps, falls, issues };
}
function trapExits(nav, physics, spawns, links, opts) {
  const g = nav.graph();
  const n = g.count;
  if (!n) return [];
  const extra = [];
  for (const l of links) {
    const a = nav.nearestPoly(l.start, { x: 0.5, y: 1, z: 0.5 });
    const b = nav.nearestPoly(l.end, { x: 0.5, y: 1, z: 0.5 });
    if (a && b && a.index !== b.index) extra.push([a.index, b.index]);
  }
  const seeds = spawns.flatMap((p) => {
    const hit = nav.nearestPoly(p, { x: 1, y: 1, z: 1 });
    return hit ? [hit.index] : [];
  });
  const routes = edgesOf(g, extra);
  const comps = components(routes, n);
  const main = mainOf(g, comps, seeds, routes);
  const mainPolys = [];
  for (let i = 0; i < n; i++) if (comps.of[i] === main) mainPolys.push(i);
  let toMain = reach(reverseOf(routes, n), n, mainPolys);
  const out = [];
  const rim = new Float64Array(comps.count);
  for (let i = 0; i < n; i++) {
    if (g.type[i] !== 0 || !g.open[i]) continue;
    const a0 = g.vstart[i];
    const vc = g.vstart[i + 1] - a0;
    for (let j = 0; j < vc; j++) {
      if (!(g.open[i] & 1 << j)) continue;
      const ia = (a0 + j) * 3;
      const ib = (a0 + (j + 1) % vc) * 3;
      rim[comps.of[i]] += hypot(g.vxyz[ib] - g.vxyz[ia], g.vxyz[ib + 2] - g.vxyz[ia + 2]);
    }
  }
  const traced = /* @__PURE__ */ new Map();
  for (let round = 0; round < 16 && out.length < MAX_EXITS; round++) {
    const added = [];
    const patchFalls = /* @__PURE__ */ new Map();
    for (let i = 0; i < n; i++) {
      if (toMain[i] || g.type[i] !== 0 || !g.open[i] || disabled(g, i)) continue;
      let fs = traced.get(i);
      if (!fs) traced.set(i, fs = fallsFrom(nav, physics, i, opts, void 0, true));
      for (const f of fs) {
        if (f.to < 0 || !toMain[f.to]) continue;
        const c = comps.of[i];
        (patchFalls.get(c) ?? patchFalls.set(c, []).get(c)).push(f);
      }
    }
    if (!patchFalls.size) break;
    for (const c of [...patchFalls.keys()].sort((a, b) => a - b)) {
      const fs = patchFalls.get(c);
      fs.sort((a, b) => a.drop - b.drop || a.at.x - b.at.x || a.at.z - b.at.z);
      const picked = [];
      const want = Math.min(EXITS_MAX_PER_PATCH, Math.max(EXITS_PER_PATCH, Math.ceil(rim[c] / EXIT_RIM)));
      const spacing = want > EXITS_PER_PATCH ? EXIT_SPACING_LONG : EXIT_SPACING;
      for (const f of fs) {
        if (picked.length >= want || out.length >= MAX_EXITS) break;
        if (picked.some((p) => hypot(p.at.x - f.at.x, p.at.z - f.at.z) < spacing)) continue;
        picked.push(f);
        out.push({ start: { ...f.at }, end: { ...f.land } });
        added.push([f.from, f.to]);
      }
    }
    if (!added.length) break;
    extra.push(...added);
    toMain = reach(reverseOf(edgesOf(g, extra), n), n, mainPolys);
  }
  return out;
}
const PARKOUR_AREA = 2;
const SAMPLE_SPACING = 1.5;
const PROBE_STEP = 0.3;
const GAP_MAX = 5.5;
const UP_MAX = 1.8;
const UP_MIN = PLAYER.maxStepHeight + 0.15;
const PARKOUR_SAVING = 2.5;
const PARKOUR_MIN_WALK = 9;
const PARKOUR_WALK = 60;
const MAX_LINKS = 160;
const MAX_KIND = 80;
const MAX_DROPS = 50;
const MAX_TRIALS = 240;
const cache$2 = /* @__PURE__ */ new Map();
const LINK_SPACING = 4;
const FAILED_SPACING = 1.6;
const BODIES = [
  { scale: 1, speed: 1 },
  { scale: 0.78, speed: 1.06 },
  { scale: 1.18, speed: 0.94 }
];
const LAND_REACH = 4;
const MAX_TICKS = 100;
function parkourInput(link, pos, grounded, jumped) {
  const dx = Math.sin(link.yaw);
  const dz = Math.cos(link.yaw);
  const along = (pos.x - link.start.x) * dx + (pos.z - link.start.z) * dz;
  const jump = link.takeoff >= 0 && !jumped && grounded && along >= link.takeoff;
  let buttons = link.sprint ? BUTTON_SPRINT : 0;
  if (jump) buttons |= BUTTON_JUMP;
  else if (jumped && !grounded && link.tuck) buttons = BUTTON_CROUCH;
  return { yaw: link.yaw, buttons, jump };
}
function parkourAlong(link, pos) {
  return (pos.x - link.start.x) * Math.sin(link.yaw) + (pos.z - link.start.z) * Math.cos(link.yaw);
}
function hintCandidate(nav, physics, j) {
  const a = nav.nearestPoly(j.start, { x: 1.2, y: 1.6, z: 1.2 });
  const b = nav.nearestPoly(j.end, { x: 1.2, y: 1.6, z: 1.2 });
  if (!a || !b || a.index === b.index) return null;
  const start = a.point;
  const end = b.point;
  const rise = end.y - start.y;
  const across = hypot(end.x - start.x, end.z - start.z);
  if (across < 0.3) return null;
  const kind = rise > UP_MIN ? "up" : across >= 1.5 && rise > -3.5 ? "gap" : "drop";
  const dx = (end.x - start.x) / across;
  const dz = (end.z - start.z) / across;
  let at2 = { x: (start.x + end.x) / 2, y: start.y, z: (start.z + end.z) / 2 };
  for (let t = 0.2; t < across; t += PROBE_STEP) {
    const p = { x: start.x + dx * t, y: start.y + 0.4, z: start.z + dz * t };
    const down = physics.raycastWorld(p, { x: 0, y: -1, z: 0 }, 1.2);
    const wall = kind === "up" ? physics.raycastWorld({ x: p.x, y: start.y + 0.35, z: p.z }, { x: dx, y: 0, z: dz }, PROBE_STEP) : null;
    if (down === null || wall !== null) {
      at2 = { x: p.x, y: start.y, z: p.z };
      break;
    }
  }
  return { kind, from: a.index, to: b.index, start, end, at: at2, saving: Infinity, hint: true };
}
function walkFrom(g, centre, from, limit, dist, extra) {
  const touched = [from];
  dist[from] = 0;
  const hc = [];
  const hp = [];
  const swap = (i, j) => {
    const c = hc[i];
    hc[i] = hc[j];
    hc[j] = c;
    const p = hp[i];
    hp[i] = hp[j];
    hp[j] = p;
  };
  const push = (c, p) => {
    hc.push(c);
    hp.push(p);
    for (let i = hc.length - 1; i > 0; ) {
      const up = i - 1 >> 1;
      if (hc[up] <= hc[i]) break;
      swap(up, i);
      i = up;
    }
  };
  push(0, from);
  while (hc.length) {
    const c = hc[0];
    const a = hp[0];
    const lc = hc.pop();
    const lp = hp.pop();
    if (hc.length) {
      hc[0] = lc;
      hp[0] = lp;
      for (let i = 0; ; ) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < hc.length && hc[l] < hc[m]) m = l;
        if (r < hc.length && hc[r] < hc[m]) m = r;
        if (m === i) break;
        swap(m, i);
        i = m;
      }
    }
    if (c > dist[a]) continue;
    const more = extra?.get(a);
    const end = g.linkStart[a + 1] + (more?.length ?? 0);
    for (let l = g.linkStart[a]; l < end; l++) {
      const b = l < g.linkStart[a + 1] ? g.links[l] : more[l - g.linkStart[a + 1]];
      if (disabled(g, b)) continue;
      const d = c + hypot(centre[a * 3] - centre[b * 3], centre[a * 3 + 2] - centre[b * 3 + 2]) + Math.abs(centre[a * 3 + 1] - centre[b * 3 + 1]);
      if (d > limit || d >= dist[b]) continue;
      if (dist[b] === Infinity) touched.push(b);
      dist[b] = d;
      push(d, b);
    }
  }
  return touched;
}
function groundAt(physics, solids, x, z, top, depth) {
  const o = { x, y: top, z };
  const d = physics.moveRay(o, DOWN, depth);
  const b = solids?.length ? boxesRay(solids, o, DOWN, d ?? depth) : null;
  const hit = d === null ? b : b === null ? d : Math.min(d, b);
  return hit === null ? null : top - hit;
}
const DOWN = { x: 0, y: -1, z: 0 };
function probeOut(physics, opts, at2, nx, nz) {
  const out = [];
  const top = at2.y + UP_MAX + PLAYER.height * 1.2;
  const depth = top - (at2.y - Math.max(4, opts.maxDrop + 1));
  let gapFrom = -1;
  let level = true;
  let bottom = Infinity;
  for (let d = PROBE_STEP; d <= GAP_MAX + 1e-6; d += PROBE_STEP) {
    const x = at2.x + nx * d;
    const z = at2.z + nz * d;
    const y = groundAt(physics, opts.solids, x, z, top, depth);
    if (y !== null && y > at2.y + UP_MAX) return out;
    if (level) {
      if (y !== null && y > at2.y + UP_MIN && d < 2.6) {
        const inY = groundAt(physics, opts.solids, at2.x + nx * (d + 0.5), at2.z + nz * (d + 0.5), top, depth);
        if (inY !== null && Math.abs(inY - y) < 0.2) out.push({ kind: "up", land: { x: at2.x + nx * (d + 0.5), y: inY, z: at2.z + nz * (d + 0.5) } });
        return out;
      }
      if (y === null || y < at2.y - 1) {
        level = false;
        gapFrom = d;
        bottom = y ?? -Infinity;
      } else if (Math.abs(y - at2.y) > UP_MIN) return out;
      continue;
    }
    if (y !== null && y > at2.y - 3 && y < at2.y + 0.5 && y > bottom + 1 && d - gapFrom >= 1) {
      const inY = groundAt(physics, opts.solids, at2.x + nx * (d + 0.5), at2.z + nz * (d + 0.5), top, depth);
      if (inY !== null && Math.abs(inY - y) < 0.25) out.push({ kind: "gap", land: { x: at2.x + nx * (d + 0.5), y: inY, z: at2.z + nz * (d + 0.5) } });
      return out;
    }
    if (y !== null && y >= at2.y + 0.5) return out;
    bottom = Math.min(bottom, y ?? -Infinity);
  }
  return out;
}
function playThrough(physics, collider, link, body, gravity, side) {
  const px = Math.cos(link.yaw);
  const pz = -Math.sin(link.yaw);
  parkourStats.sims++;
  let s = { pos: { x: link.start.x + px * side, y: link.start.y + 0.12, z: link.start.z + pz * side }, velY: 0, grounded: false };
  const env = { scale: body.scale, gravity, jump: 1, stamina: 1, autoChute: true };
  const still = { forward: 0, right: 0, yaw: link.yaw, pitch: 0, buttons: 0 };
  for (let i = 0; i < 12 && !s.grounded; i++) s = stepMovement(physics, collider, s, still, body.speed, TICK_DT, 1, env);
  if (!s.grounded) return false;
  const from = s.pos.y;
  let jumped = false;
  let left = false;
  const lowest = Math.min(link.end.y, link.start.y) - 1;
  for (let t = 0; t < MAX_TICKS; t++) {
    const c = parkourInput(link, s.pos, s.grounded, jumped);
    if (c.jump) jumped = true;
    parkourStats.ticks++;
    s = stepMovement(physics, collider, s, { forward: 1, right: 0, yaw: c.yaw, pitch: 0, buttons: c.buttons }, body.speed, TICK_DT, 1, env);
    if (!s.grounded && s.pos.y < from - 0.4) left = true;
    if ((jumped || left) && s.pos.y < lowest) return false;
    if (s.grounded && (jumped || left) && Math.abs(s.pos.y - link.end.y) < 0.6) {
      const d = hypot(s.pos.x - link.end.x, s.pos.z - link.end.z);
      return d < 0.9 || d < LAND_REACH && physics.lineOfSight({ x: s.pos.x, y: s.pos.y + 0.5, z: s.pos.z }, { x: link.end.x, y: link.end.y + 0.5, z: link.end.z });
    }
    if (!jumped && !left && t > 60) return false;
    if (s.grounded && (jumped || left) && t > 4) return false;
  }
  return false;
}
const parkourStats = { cands: {}, trials: {}, links: {}, sims: 0, ticks: 0, findMs: 0, verifyMs: 0, hints: { given: 0, made: 0 } };
function parkourLinks(nav, physics, opts, gravity = 1, others = [], spawns = []) {
  const g = nav.graph();
  const jumps = (opts.jumps ?? []).map((j) => `${j.start.x.toFixed(1)},${j.start.y.toFixed(1)},${j.start.z.toFixed(1)}>${j.end.x.toFixed(1)},${j.end.y.toFixed(1)},${j.end.z.toFixed(1)}`).join(";");
  const key2 = `${fingerprint$1(g)}|${gravity}|${opts.maxDrop}|${opts.solids?.length ?? 0}|${opts.blockers?.length ?? 0}|${others.length}|${spawns.length}|${jumps}`;
  const known = cache$2.get(key2);
  if (known) return known;
  const links = parkourLinksNow(nav, g, physics, opts, gravity, others, spawns);
  if (cache$2.size >= 4) cache$2.delete(cache$2.keys().next().value);
  cache$2.set(key2, links);
  return links;
}
function fingerprint$1(g) {
  let h = 2166136261;
  const step = Math.max(1, Math.floor(g.vxyz.length / 512));
  for (let i = 0; i < g.vxyz.length; i += step) h = Math.imul(h ^ Math.round(g.vxyz[i] * 20), 16777619);
  return `${g.count}:${g.vxyz.length}:${h >>> 0}`;
}
function parkourLinksNow(nav, g, physics, opts, gravity, others, spawns) {
  const n = g.count;
  if (!n) return [];
  const { centre } = polyShapes(g);
  const extraFrom = /* @__PURE__ */ new Map();
  for (const [a, b] of others) (extraFrom.get(a) ?? extraFrom.set(a, []).get(a)).push(b);
  const dist = new Float64Array(n).fill(Infinity);
  const cands = [];
  const t0 = performance.now();
  parkourStats.cands = {};
  parkourStats.trials = {};
  parkourStats.links = {};
  parkourStats.sims = 0;
  parkourStats.ticks = 0;
  const dropOpts = { ...opts, maxDrop: Math.min(opts.maxDrop, 5 / Math.max(0.05, gravity)) };
  for (let i = 0; i < n; i++) {
    if (g.type[i] !== 0 || !g.open[i] || disabled(g, i)) continue;
    const found = [];
    for (const f of fallsFrom(nav, physics, i, dropOpts)) if (f.to >= 0 && f.to !== i && f.drop > 0.6) found.push({ kind: "drop", at: f.at, land: f.land, to: f.to });
    const a0 = g.vstart[i];
    const vc = g.vstart[i + 1] - a0;
    const cx = centre[i * 3];
    const cz = centre[i * 3 + 2];
    for (let j = 0; j < vc; j++) {
      if (!(g.open[i] & 1 << j)) continue;
      const ia = (a0 + j) * 3;
      const ib = (a0 + (j + 1) % vc) * 3;
      const ax = g.vxyz[ia];
      const ay = g.vxyz[ia + 1];
      const az = g.vxyz[ia + 2];
      const dx = g.vxyz[ib] - ax;
      const dy = g.vxyz[ib + 1] - ay;
      const dz = g.vxyz[ib + 2] - az;
      const len = hypot(dx, dz);
      if (len < 0.4) continue;
      let nx = dz / len;
      let nz = -dx / len;
      if (nx * (ax + dx / 2 - cx) + nz * (az + dz / 2 - cz) < 0) {
        nx = -nx;
        nz = -nz;
      }
      const m = Math.max(1, Math.round(len / SAMPLE_SPACING));
      for (let k = 0; k < m; k++) {
        const t = (k + 0.5) / m;
        const at2 = { x: ax + dx * t, y: ay + dy * t, z: az + dz * t };
        for (const p of probeOut(physics, opts, at2, nx, nz)) {
          const hit = nav.nearestPoly({ x: p.land.x + nx * 0.6, y: p.land.y + 0.2, z: p.land.z + nz * 0.6 }, { x: 1, y: 0.4, z: 1 });
          if (!hit || hit.index === i || disabled(g, hit.index) || Math.abs(hit.point.y - p.land.y) > 0.5) continue;
          found.push({ kind: p.kind, at: at2, land: hit.point, to: hit.index });
        }
      }
    }
    if (!found.length) continue;
    const touched = walkFrom(g, centre, i, PARKOUR_WALK, dist);
    for (const f of found) {
      const start = nav.nearestPoly(f.at, { x: 0.3, y: 0.5, z: 0.3 })?.point ?? f.at;
      const move = hypot(f.land.x - start.x, f.land.z - start.z) + Math.abs(f.land.y - start.y);
      const walk = dist[f.to];
      const also = extraFrom.get(i)?.includes(f.to) ?? false;
      if (also || walk < Math.max(PARKOUR_MIN_WALK, move * PARKOUR_SAVING)) continue;
      cands.push({ kind: f.kind, from: i, to: f.to, start, end: f.land, at: f.at, saving: walk / Math.max(0.5, move) });
    }
    for (const p of touched) dist[p] = Infinity;
  }
  parkourStats.hints = { given: opts.jumps?.length ?? 0, made: 0 };
  for (const j of opts.jumps ?? []) {
    const c = hintCandidate(nav, physics, j);
    if (c) cands.push(c);
  }
  for (const c of cands) parkourStats.cands[c.kind] = (parkourStats.cands[c.kind] ?? 0) + 1;
  const t1 = performance.now();
  parkourStats.findMs = t1 - t0;
  const walked = new Uint8Array(n);
  const seeds = spawns.flatMap((p) => {
    const hit = nav.nearestPoly(p, { x: 1, y: 1, z: 1 });
    return hit ? [hit.index] : [];
  });
  if (!seeds.length) walked.fill(1);
  for (const s of seeds) {
    if (walked[s]) continue;
    const touched = walkFrom(g, centre, s, Infinity, dist, extraFrom);
    for (const p of touched) {
      walked[p] = 1;
      dist[p] = Infinity;
    }
  }
  cands.sort((a, b) => (b.hint ? 1 : 0) - (a.hint ? 1 : 0) || (a.saving === b.saving ? 0 : b.saving - a.saving) || walked[b.from] - walked[a.from] || a.start.x - b.start.x || a.start.z - b.start.z || a.start.y - b.start.y);
  const out = [];
  const ends = [];
  const kinds = { drop: 0, gap: 0, up: 0 };
  const collider = physics.createPlayerCollider();
  const blockers = (opts.blockers ?? []).map((b) => physics.createBox(b.center, b.half, b.yaw));
  if (blockers.length) physics.commit();
  let trials = 0;
  const failed = [];
  try {
    for (const c of cands) {
      if (out.length >= MAX_LINKS || trials >= MAX_TRIALS) break;
      if (kinds[c.kind] >= (c.kind === "drop" ? MAX_DROPS : MAX_KIND)) continue;
      const near2 = (l, r) => l.kind === c.kind && hypot(l.start.x - c.start.x, l.start.z - c.start.z) < r && Math.abs(l.start.y - c.start.y) < 1 && hypot(l.end.x - c.end.x, l.end.z - c.end.z) < r && Math.abs(l.end.y - c.end.y) < 1;
      if (out.some((l) => near2(l, LINK_SPACING)) || failed.some((l) => near2(l, FAILED_SPACING))) continue;
      const yaw = Math.atan2(c.end.x - c.start.x, c.end.z - c.start.z);
      const len = hypot(c.end.x - c.start.x, c.end.z - c.start.z);
      if (opts.solids?.length && [0.5, 1.2].some((h) => boxesRay(opts.solids, { x: c.start.x, y: Math.max(c.start.y, c.end.y) + h, z: c.start.z }, { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }, len) !== null)) continue;
      if (c.kind === "gap") {
        const h = Math.max(0, c.start.y - c.end.y);
        const g2 = PLAYER.gravity * gravity;
        const air = (PLAYER.jumpSpeed + Math.sqrt(PLAYER.jumpSpeed ** 2 + 2 * g2 * h)) / g2;
        if (len - 1.4 > air * PLAYER.runSpeed * 1.5 * BODIES[2].speed) continue;
      }
      trials++;
      parkourStats.trials[c.kind] = (parkourStats.trials[c.kind] ?? 0) + 1;
      const link = verify(physics, collider, c, yaw, gravity);
      if (!link) {
        failed.push(c);
        continue;
      }
      out.push(link);
      if (c.hint) parkourStats.hints.made++;
      ends.push([c.from, c.to]);
      kinds[c.kind]++;
    }
  } finally {
    physics.removeCollider(collider);
    for (const b of blockers) physics.removeCollider(b);
    if (blockers.length) physics.commit();
  }
  const kept = safeLinks(g, out, ends, others, spawns.flatMap((p) => {
    const hit = nav.nearestPoly(p, { x: 1, y: 1, z: 1 });
    return hit ? [hit.index] : [];
  }));
  for (const l of kept) parkourStats.links[l.kind] = (parkourStats.links[l.kind] ?? 0) + 1;
  parkourStats.verifyMs = performance.now() - t1;
  return kept;
}
function safeLinks(g, links, ends, others, seeds) {
  const n = g.count;
  let keep = links.map(() => true);
  for (let round = 0; round < 8; round++) {
    const pairs = [...others, ...ends.filter((_, i) => keep[i])];
    const e = edgesOf(g, pairs);
    const comps = components(e, n);
    const main = mainOf(g, comps, seeds, e);
    const mainPolys = [];
    for (let i = 0; i < n; i++) if (comps.of[i] === main) mainPolys.push(i);
    const back = reverseOf(e, n);
    const toMain = reachSet(back.start, back.to, n, mainPolys);
    let dropped = false;
    keep = keep.map((k, i) => {
      if (!k) return false;
      const [a, b] = ends[i];
      if (toMain[a] && !toMain[b]) {
        dropped = true;
        return false;
      }
      return true;
    });
    if (!dropped) break;
  }
  return links.filter((_, i) => keep[i]);
}
function verify(physics, collider, c, yaw, gravity) {
  const base = { kind: c.kind, start: c.start, end: c.end, yaw, takeoff: -1, sprint: false, tuck: false };
  const works = (l) => {
    if (!playThrough(physics, collider, l, BODIES[1], gravity, -0.2)) return false;
    if (!playThrough(physics, collider, l, BODIES[2], gravity, 0.2)) return false;
    return true;
  };
  if (c.kind === "drop") return playThrough(physics, collider, base, BODIES[0], gravity, 0) ? base : null;
  const edge = parkourAlong(base, c.at);
  const rise = c.end.y - c.start.y;
  const variants = c.kind === "gap" ? [{ sprint: true, tuck: false }] : rise > 0.9 ? [{ sprint: false, tuck: true }] : [{ sprint: false, tuck: false }, { sprint: false, tuck: true }];
  const offsets = c.kind === "gap" ? [0.6, 0.4, 0.2, 0] : [0.2, 0, -0.2, -0.4];
  for (const v of variants) {
    for (const o of offsets) {
      const l = { ...base, ...v, takeoff: Math.max(0, edge + o) };
      if (!playThrough(physics, collider, l, BODIES[0], gravity, 0)) continue;
      if (!playThrough(physics, collider, { ...l, takeoff: l.takeoff + 0.15 }, BODIES[0], gravity, 0)) continue;
      if (!playThrough(physics, collider, { ...l, takeoff: Math.max(0, l.takeoff - 0.15) }, BODIES[0], gravity, 0)) continue;
      if (works(l)) return l;
    }
  }
  return null;
}
const LOW_AREA = 3;
function boundingBox(positions, indices) {
  const lo = [Infinity, Infinity, Infinity];
  const hi2 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i] * 3;
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], positions[v + k]);
      hi2[k] = Math.max(hi2[k], positions[v + k]);
    }
  }
  return { bbMin: lo, bbMax: hi2 };
}
function markLow(chf, low) {
  const raw = chf.raw;
  const w = raw.get_width();
  const h = raw.get_height();
  const n = raw.get_spanCount();
  if (!n) return 0;
  const limit = Math.ceil(low.height / raw.get_ch());
  const cellsPtr = Raw.Module.getPointer(raw.get_cells(0)) >>> 2;
  const spansPtr = Raw.Module.getPointer(raw.get_spans(0)) >>> 2;
  const heap = Raw.Module.HEAPU32;
  const marked = new Uint8Array(n);
  const cellOf = new Int32Array(n);
  const seeds = [];
  for (let c = 0; c < w * h; c++) {
    const cell = heap[cellsPtr + c];
    const first = cell & 16777215;
    const count = cell >>> 24;
    for (let i = first; i < first + count; i++) {
      cellOf[i] = c;
      const room = heap[spansPtr + i * 2 + 1] >>> 24;
      if (room >= limit) continue;
      if (raw.get_areas(i) === Recast.RC_NULL_AREA) continue;
      marked[i] = 1;
      seeds.push(i);
    }
  }
  if (!seeds.length) return 0;
  const steps = Math.round(low.reach / raw.get_cs());
  const dx = [-1, 0, 1, 0];
  const dz = [0, 1, 0, -1];
  let front = seeds;
  for (let s = 0; s < steps && front.length; s++) {
    const next = [];
    for (const i of front) {
      const con = heap[spansPtr + i * 2 + 1] & 16777215;
      const c = cellOf[i];
      const x = c % w;
      const z = (c - x) / w;
      for (let d = 0; d < 4; d++) {
        const k = con >>> d * 6 & 63;
        if (k === 63) continue;
        const nc = x + dx[d] + (z + dz[d]) * w;
        const j = (heap[cellsPtr + nc] & 16777215) + k;
        if (marked[j] || raw.get_areas(j) === Recast.RC_NULL_AREA) continue;
        marked[j] = 1;
        next.push(j);
      }
    }
    front = next;
  }
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (!marked[i]) continue;
    raw.set_areas(i, LOW_AREA);
    total++;
  }
  return total;
}
function generateSolo(positions, indices, config, keepIntermediates, low) {
  const buildContext = new RecastBuildContext();
  const inter = { type: "solo", buildContext };
  const cleanup = () => {
    if (keepIntermediates) return;
    if (inter.heightfield) freeHeightfield(inter.heightfield);
    if (inter.compactHeightfield) freeCompactHeightfield(inter.compactHeightfield);
    if (inter.contourSet) freeContourSet(inter.contourSet);
    if (inter.polyMesh) freePolyMesh(inter.polyMesh);
    if (inter.polyMeshDetail) freePolyMeshDetail(inter.polyMeshDetail);
    inter.heightfield = inter.compactHeightfield = inter.contourSet = inter.polyMesh = inter.polyMeshDetail = void 0;
  };
  const fail = (error) => {
    cleanup();
    return { success: false, error, intermediates: inter };
  };
  const verticesArray = new VerticesArray();
  verticesArray.copy(positions);
  const numVertices = indices.length;
  const numTriangles = indices.length / 3;
  const trianglesArray = new TrianglesArray();
  trianglesArray.copy(indices);
  const { bbMin, bbMax } = boundingBox(positions, indices);
  const rcConfig = createRcConfig({ ...recastConfigDefaults, ...config });
  rcConfig.minRegionArea = rcConfig.minRegionArea * rcConfig.minRegionArea;
  rcConfig.mergeRegionArea = rcConfig.mergeRegionArea * rcConfig.mergeRegionArea;
  rcConfig.detailSampleDist = rcConfig.detailSampleDist < 0.9 ? 0 : rcConfig.cs * rcConfig.detailSampleDist;
  rcConfig.detailSampleMaxError = rcConfig.ch * rcConfig.detailSampleMaxError;
  const gridSize = calcGridSize(bbMin, bbMax, rcConfig.cs);
  rcConfig.width = gridSize.width;
  rcConfig.height = gridSize.height;
  const heightfield = allocHeightfield();
  inter.heightfield = heightfield;
  if (!createHeightfield(buildContext, heightfield, rcConfig.width, rcConfig.height, bbMin, bbMax, rcConfig.cs, rcConfig.ch)) return fail("Could not create heightfield");
  const triangleAreasArray = new TriangleAreasArray();
  triangleAreasArray.resize(numTriangles);
  markWalkableTriangles(buildContext, rcConfig.walkableSlopeAngle, verticesArray, numVertices, trianglesArray, numTriangles, triangleAreasArray);
  if (!rasterizeTriangles(buildContext, verticesArray, numVertices, trianglesArray, triangleAreasArray, numTriangles, heightfield, rcConfig.walkableClimb)) return fail("Could not rasterize triangles");
  triangleAreasArray.destroy();
  verticesArray.destroy();
  trianglesArray.destroy();
  filterLowHangingWalkableObstacles(buildContext, rcConfig.walkableClimb, heightfield);
  filterLedgeSpans(buildContext, rcConfig.walkableHeight, rcConfig.walkableClimb, heightfield);
  filterWalkableLowHeightSpans(buildContext, rcConfig.walkableHeight, heightfield);
  const chf = allocCompactHeightfield();
  inter.compactHeightfield = chf;
  if (!buildCompactHeightfield(buildContext, rcConfig.walkableHeight, rcConfig.walkableClimb, heightfield, chf)) return fail("Failed to build compact data");
  if (!keepIntermediates) {
    freeHeightfield(heightfield);
    inter.heightfield = void 0;
  }
  if (!erodeWalkableArea(buildContext, rcConfig.walkableRadius, chf)) return fail("Failed to erode walkable area");
  const lowSpans = low ? markLow(chf, low) : 0;
  if (!buildDistanceField(buildContext, chf)) return fail("Failed to build distance field");
  if (!buildRegions(buildContext, chf, rcConfig.borderSize, rcConfig.minRegionArea, rcConfig.mergeRegionArea)) return fail("Failed to build regions");
  const contourSet = allocContourSet();
  inter.contourSet = contourSet;
  if (!buildContours(buildContext, chf, rcConfig.maxSimplificationError, rcConfig.maxEdgeLen, contourSet, Recast.RC_CONTOUR_TESS_WALL_EDGES)) return fail("Failed to create contours");
  const polyMesh = allocPolyMesh();
  inter.polyMesh = polyMesh;
  if (!buildPolyMesh(buildContext, contourSet, rcConfig.maxVertsPerPoly, polyMesh)) return fail("Failed to triangulate contours");
  const polyMeshDetail = allocPolyMeshDetail();
  inter.polyMeshDetail = polyMeshDetail;
  if (!buildPolyMeshDetail(buildContext, polyMesh, chf, rcConfig.detailSampleDist, rcConfig.detailSampleMaxError, polyMeshDetail)) return fail("Failed to build detail mesh");
  if (!keepIntermediates) {
    freeCompactHeightfield(chf);
    inter.compactHeightfield = void 0;
    freeContourSet(contourSet);
    inter.contourSet = void 0;
  }
  for (let i = 0; i < polyMesh.npolys(); i++) {
    if (polyMesh.areas(i) === Recast.RC_WALKABLE_AREA) polyMesh.setAreas(i, 0);
    const a = polyMesh.areas(i);
    if (a === 0 || a === LOW_AREA) polyMesh.setFlags(i, 1);
  }
  const params = new NavMeshCreateParams();
  params.setPolyMeshCreateParams(polyMesh);
  params.setPolyMeshDetailCreateParams(polyMeshDetail);
  params.setWalkableHeight(rcConfig.walkableHeight * rcConfig.ch);
  params.setWalkableRadius(rcConfig.walkableRadius * rcConfig.cs);
  params.setWalkableClimb(rcConfig.walkableClimb * rcConfig.ch);
  params.setCellSize(rcConfig.cs);
  params.setCellHeight(rcConfig.ch);
  params.setBuildBvTree(true);
  if (config.offMeshConnections) params.setOffMeshConnections(config.offMeshConnections);
  const created = createNavMeshData(params);
  if (!created.success) return fail("Failed to create Detour navmesh data");
  cleanup();
  const navMesh = new NavMesh();
  if (!navMesh.initSolo(created.navMeshData)) {
    created.navMeshData.destroy();
    return { success: false, error: "Failed to initialize solo NavMesh", intermediates: inter };
  }
  return { success: true, navMesh, intermediates: inter, low: lowSpans };
}
let initPromise;
function initNavigation() {
  initPromise ??= init();
  return initPromise;
}
const CELL$2 = 0.2;
const CELL_HEIGHT = 0.05;
const NAV_RADIUS_CELLS = 4;
const PLACE_CELL = 7;
const MAX_NODES = 65535;
const MAX_PATH_POLYS = 8192;
const MAX_CORNERS = 1024;
const ESCAPE_REACH = 14;
const ESCAPE_GAP = 8;
const ESCAPE_RISE = 1.4;
const OPEN_AREA = 1;
const EXPOSED_REACH = 3;
const OPEN_COST = [1, 1.2, 1.45];
const PARKOUR_COST = 1.6;
const LOW_HEADROOM = { height: BODY_SIZES.large.scale * PLAYER.height + 0.05, reach: 0.4 };
const LOW_ROOF_COST = 4;
const TALL_SIZE = 1.02;
const FOUR = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 }
];
const RECAST_CONFIG = {
  cs: CELL$2,
  ch: CELL_HEIGHT,
  walkableSlopeAngle: PLAYER.maxSlopeDegrees,
  walkableHeight: Math.ceil(PLAYER.height / CELL_HEIGHT),
  // Round, not floor: 0.3 / 0.05 is 5.999… in floating point, which would reject 0.25 m steps at some heights.
  walkableClimb: Math.round(PLAYER.maxStepHeight / CELL_HEIGHT),
  // Clearance beyond the capsule radius so corner-cutting bots do not snag door frames (NAV_RADIUS_CELLS: 0.8 m).
  walkableRadius: NAV_RADIUS_CELLS,
  maxEdgeLen: 12 / CELL$2,
  maxSimplificationError: 1.3,
  minRegionArea: 8,
  mergeRegionArea: 20,
  maxVertsPerPoly: 6,
  detailSampleDist: 6,
  detailSampleMaxError: 1
};
const offMesh = (l) => ({ startPosition: l.start, endPosition: l.end, radius: 0.8, bidirectional: false, area: l.area ?? 0 });
function withLinks(inter, links) {
  const polyMesh = inter.polyMesh;
  const detail = inter.polyMeshDetail;
  if (!polyMesh || !detail) throw new Error("navmesh generation kept no polygon mesh");
  const params = new NavMeshCreateParams();
  params.setPolyMeshCreateParams(polyMesh);
  params.setPolyMeshDetailCreateParams(detail);
  params.setWalkableHeight(RECAST_CONFIG.walkableHeight * CELL_HEIGHT);
  params.setWalkableRadius(RECAST_CONFIG.walkableRadius * CELL$2);
  params.setWalkableClimb(RECAST_CONFIG.walkableClimb * CELL_HEIGHT);
  params.setCellSize(CELL$2);
  params.setCellHeight(CELL_HEIGHT);
  params.setBuildBvTree(true);
  params.setOffMeshConnections(links.map(offMesh));
  const data = createNavMeshData(params);
  if (!data.success) throw new Error("navmesh generation failed: Detour data with the links");
  const navMesh = new NavMesh();
  if (!navMesh.initSolo(data.navMeshData)) throw new Error("navmesh generation failed: Detour navmesh with the links");
  return navMesh;
}
function freeIntermediates(inter) {
  if (inter.heightfield) freeHeightfield(inter.heightfield);
  if (inter.compactHeightfield) freeCompactHeightfield(inter.compactHeightfield);
  if (inter.contourSet) freeContourSet(inter.contourSet);
  if (inter.polyMesh) freePolyMesh(inter.polyMesh);
  if (inter.polyMeshDetail) freePolyMeshDetail(inter.polyMeshDetail);
}
const NO_ESCAPE = [];
class NavWorld {
  constructor(navMesh, query) {
    this.navMesh = navMesh;
    this.query = query;
  }
  navMesh;
  query;
  /**
   * `extra` adds triangle geometry (terrain) to the boxes; `links` are one-way jumps (jump pads) bots can take.
   * `drops`: one-way ledge-drop links off the patches of navmesh that have no route to the main area (a ledge, a
   * scaffold, a roof bots land on), as many as they need (audit.ts trapExits; a map without such patches gets none,
   * and its navmesh is the same as without).
   */
  static build(boxes, extra = null, links = [], snapped = false, drops = null) {
    const box = boxesToTriangles(boxes.filter((b) => b.sourceId !== "ground"));
    let positions = box.positions;
    let indices = box.indices;
    if (extra) {
      positions = new Float32Array(box.positions.length + extra.positions.length);
      positions.set(box.positions);
      positions.set(extra.positions, box.positions.length);
      indices = new Uint32Array(box.indices.length + extra.indices.length);
      indices.set(box.indices);
      const offset = box.positions.length / 3;
      for (let i = 0; i < extra.indices.length; i++) indices[box.indices.length + i] = extra.indices[i] + offset;
    }
    const relink = !snapped && (links.length > 0 || !!drops);
    const result = generateSolo(positions, indices, { ...RECAST_CONFIG, offMeshConnections: (snapped ? links : []).map(offMesh) }, relink, LOW_HEADROOM);
    if (!result.success) throw new Error(`navmesh generation failed: ${result.error}`);
    const lowSpans = result.low;
    const inter = result.intermediates;
    try {
      const world = new NavWorld(result.navMesh, new NavMeshQuery(result.navMesh, { maxNodes: MAX_NODES }));
      if (drops) {
        world.spawnSeeds = drops.spawns;
        world.disableInsideSolid(drops.physics, drops.solids);
      }
      const done = (w) => {
        w.lowSpans = lowSpans;
        if (drops) w.markExposure(drops.physics);
        return w;
      };
      if (!relink) return done(world);
      const onMesh = links.flatMap((l) => {
        const start = world.closestPoint(l.start, l.reach ?? { x: 1.5, y: 2, z: 1.5 });
        const end = world.closestPoint(l.end, l.reach ?? { x: 2.5, y: 3, z: 2.5 });
        return start && end ? [{ start, end }] : [];
      });
      const parkour = drops && !drops.noParkour ? parkourLinks(world, drops.physics, drops, drops.gravity ?? 1, linkPairs(world, onMesh), drops.spawns) : [];
      const exits = drops ? trapExits(world, drops.physics, drops.spawns, [...onMesh, ...parkour], drops) : [];
      if (!onMesh.length && !exits.length && !parkour.length) return done(world);
      const all = [...onMesh, ...parkour.map((l) => ({ start: l.start, end: l.end, area: PARKOUR_AREA })), ...exits];
      const walkOnly = parkour.length ? world.walkOnlyFromMain(drops.spawns, onMesh) : null;
      const navMesh = withLinks(inter, all);
      world.destroy();
      const built = new NavWorld(navMesh, new NavMeshQuery(navMesh, { maxNodes: MAX_NODES }));
      if (drops) {
        built.spawnSeeds = drops.spawns;
        built.disableInsideSolid(drops.physics, drops.solids);
      }
      built.drops = exits.length;
      built.setParkour(parkour, walkOnly);
      return done(built);
    } finally {
      if (relink) freeIntermediates(inter);
    }
  }
  /** Ledge-drop links the build added (NavWorld.build `drops`). */
  drops = 0;
  /** Walkable cells of low headroom the build marked (nav/solo.ts LOW_AREA; 0: no polygon is low). */
  lowSpans = 0;
  lowCache = null;
  /** Ground polygons under low headroom (LOW_AREA), by graph index. */
  lowPolys() {
    if (this.lowCache) return this.lowCache;
    const g = this.graph();
    const out = new Uint8Array(g.count);
    if (this.lowSpans) {
      for (let i = 0; i < g.count; i++) if (g.type[i] === 0 && this.navMesh.getPolyArea(g.base + i).area === LOW_AREA) out[i] = 1;
    }
    return this.lowCache = out;
  }
  /** Whether ground polygon `i` (graph index) is under low headroom. */
  lowAt(i) {
    return this.lowSpans > 0 && this.lowPolys()[i] === 1;
  }
  /** Low ground polygons, how many (and their area, m²). */
  lowCount() {
    const low = this.lowPolys();
    const { area } = polyShapes(this.graph());
    let n = 0;
    let m2 = 0;
    for (let i = 0; i < low.length; i++) {
      if (!low[i]) continue;
      n++;
      m2 += area[i] ?? 0;
    }
    return { polys: n, area: m2 };
  }
  /**
   * Whether the last route findPath found for a tall body (`tall`) goes under low headroom: no way round it (or it
   * starts or ends there). The bot crouches through those polygons (brain.ts lowRoute).
   */
  lastLow = false;
  /** Tall routes that had to go under low headroom (lastLow), and tall routes asked for, in the match (measuring). */
  lowRoutes = 0;
  tallRoutes = 0;
  /** Start and end polygons whose tall route went under low headroom: asked again, the plain search at once. */
  lowForced = /* @__PURE__ */ new Set();
  /** Parkour links the build added (nav/parkour.ts), and a lookup of them by where they start (2 m cells). */
  parkour = [];
  parkourCells = /* @__PURE__ */ new Map();
  /** Ground polygons walking (and the map's own links) reach from the spawns without parkour; null without parkour. */
  walkReach = null;
  /** At build: the parkour links, and what walking reaches without them. */
  setParkour(links, walkReach) {
    this.parkour = links;
    this.walkReach = walkReach;
    this.parkourCells.clear();
    for (const l of links) {
      const k = cellKey$1(Math.floor(l.start.x / 2), Math.floor(l.start.z / 2));
      (this.parkourCells.get(k) ?? this.parkourCells.set(k, []).get(k)).push(l);
    }
  }
  /** Times bots missed each parkour link (landed somewhere else: knocked off it, short). */
  linkMisses = /* @__PURE__ */ new Map();
  /** Parkour links switched off in the match (linkFailed). */
  linksOff = 0;
  /**
   * A bot gave up on a parkour link (it couldn't start or finish it: something the build didn't have in the way), or
   * missed it (`gaveUp` false). Given up on, or missed three times, the link is switched off for everyone for the match:
   * its navmesh polygon's flags to 0 (no route takes it), out of the lookup, and bots plan their routes again.
   */
  linkFailed(l, gaveUp) {
    const misses = (this.linkMisses.get(l) ?? 0) + 1;
    this.linkMisses.set(l, misses);
    if (!gaveUp && misses < 3) return;
    const list2 = this.parkourCells.get(cellKey$1(Math.floor(l.start.x / 2), Math.floor(l.start.z / 2)));
    const at2 = list2?.indexOf(l) ?? -1;
    if (at2 < 0) return;
    list2.splice(at2, 1);
    const mesh = this.navMesh;
    const tile = mesh.getMaxTiles() === 1 ? mesh.getTile(0) : null;
    const header = tile?.header();
    if (!tile || !header) return;
    const base = mesh.getPolyRefBase(tile);
    for (let i = 0; i < header.offMeshConCount(); i++) {
      const con = tile.offMeshCons(i);
      if (hypot(con.pos(0) - l.start.x, con.pos(2) - l.start.z) > 0.35 || Math.abs(con.pos(1) - l.start.y) > 0.5) continue;
      if (hypot(con.pos(3) - l.end.x, con.pos(5) - l.end.z) > 0.35 || Math.abs(con.pos(4) - l.end.y) > 0.5) continue;
      mesh.setPolyFlags(base + con.poly(), 0);
    }
    this.linksOff++;
    this.noRoute.clear();
    this.goneVersion++;
  }
  /** The parkour link a route's leg from `a` to `b` takes (its corners at the link's start and end), or null. */
  parkourAt(a, b) {
    if (!this.parkour.length) return null;
    const cx = Math.floor(a.x / 2);
    const cz = Math.floor(a.z / 2);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list2 = this.parkourCells.get(cellKey$1(cx + dx, cz + dz));
        if (!list2) continue;
        for (const l of list2) if (hypot(l.start.x - a.x, l.start.z - a.z) < 0.35 && Math.abs(l.start.y - a.y) < 0.5 && hypot(l.end.x - b.x, l.end.z - b.z) < 0.35 && Math.abs(l.end.y - b.y) < 0.5) return l;
      }
    }
    return null;
  }
  /**
   * Walking (and the map's own links, `links`) from the spawn points, before any parkour link goes in: what each ground
   * polygon of this (first) build is reached by. The rebuilt navmesh keeps the same ground polygons, in the same order.
   */
  walkOnlyFromMain(spawns, links) {
    const g = this.graph();
    const seeds = spawns.flatMap((p) => {
      const h = this.nearestPoly(p, { x: 1, y: 1, z: 1 });
      return h ? [h.index] : [];
    });
    const e = edgesOf(g, linkPairs(this, links));
    return reachSet(e.start, e.to, g.count, seeds);
  }
  parkourPlaceCache = null;
  /**
   * mainPlaces() only parkour gets to (roofs and ledges a jump up or across reaches, that walking and the map's own
   * links don't): where snipers look for spots others don't go (bots/vantage.ts).
   */
  parkourPlaces() {
    if (this.parkourPlaceCache) return this.parkourPlaceCache;
    const walk = this.walkReach;
    if (!walk) return this.parkourPlaceCache = [];
    const out = [];
    const base = this.graph().base;
    for (const p of this.mainPlaces()) {
      const h = this.query.findNearestPoly(p, { halfExtents: { x: 0.5, y: 1, z: 0.5 } });
      const i = h.success && h.nearestRef ? h.nearestRef - base : -1;
      if (i >= 0 && i < walk.length && !walk[i]) out.push(p);
    }
    return this.parkourPlaceCache = out;
  }
  /** Polygons the build found inside something solid and left out (disableInsideSolid). */
  insideSolid = 0;
  /** Ground polygons in the open (markExposure), and their area. */
  exposed = 0;
  exposedArea = 0;
  /**
   * Route costs that prefer cover (BOT_AI_PLAN.md Phase B item 6): each ground polygon with nothing within EXPOSED_REACH
   * m of its middle at chest height in any of four directions (open ground: a field, a square) gets area OPEN_AREA,
   * which a route asked for with `open` costs more to cross (findPath; Tactical bots most, Arena bots not at all). Four
   * rays a polygon, at build.
   */
  markExposure(physics) {
    const g = this.graph();
    const { centre, area } = polyShapes(g);
    let n = 0;
    let m2 = 0;
    for (let i = 0; i < g.count; i++) {
      if (g.type[i] !== 0 || g.flags[i] === 0) continue;
      if (this.lowAt(i)) continue;
      const o = { x: centre[i * 3], y: centre[i * 3 + 1] + 1, z: centre[i * 3 + 2] };
      let hit = false;
      for (const d of FOUR) {
        if (physics.raycastWorld(o, d, EXPOSED_REACH) !== null) {
          hit = true;
          break;
        }
      }
      if (hit) continue;
      this.navMesh.setPolyArea(g.base + i, OPEN_AREA);
      n++;
      m2 += area[i] ?? 0;
    }
    this.exposed = n;
    this.exposedArea = m2;
    return n;
  }
  /**
   * Recast rasterizes surfaces, not volumes: inside a closed box at least a body's height tall (a stack of 2 m rock
   * blocks, a thick wall) the floor reads as open ground, and the navmesh gets patches inside solid rock (Eagle
   * Spires' spires: one at every block, 2 m apart, 7,000 m² in all). Falls and goals snapped onto them, and the audit
   * saw traps there. Each ground polygon with no room to stand over its surface at its middle and at most of the
   * points part way to its corners (the level, or one of `solids`, in the way) gets flags 0, which every route search
   * and nearest-polygon lookup leaves out. The surface is the detail mesh's (Detour's height on the polygon), not its
   * corners' average: on terrain that is often half a metre or more off (a hollow, a rise), and the check found
   * thousands of square metres of open hillside "inside" the ground (Frost Basin 17,000 m², Iron Maw 14,000 m²).
   * At build, before anything else reads the navmesh.
   */
  disableInsideSolid(physics, solids = []) {
    const g = this.graph();
    const { centre } = polyShapes(g);
    const half = { x: 0.2, y: 0.6, z: 0.2 };
    const blocked = (i, x, z) => {
      let lo = Infinity;
      let hi2 = -Infinity;
      for (let k = g.vstart[i]; k < g.vstart[i + 1]; k++) {
        lo = Math.min(lo, g.vxyz[k * 3 + 1]);
        hi2 = Math.max(hi2, g.vxyz[k * 3 + 1]);
      }
      const h = this.query.getPolyHeight(g.base + i, { x, y: centre[i * 3 + 1], z });
      const y = h.success && h.height > lo - 0.6 && h.height < hi2 + 0.6 ? h.height : centre[i * 3 + 1];
      const c = { x, y: y + 1, z };
      return !physics.boxClear(c, half) || solids.some((b) => !b.yaw && c.x + half.x > b.min[0] && c.x - half.x < b.max[0] && c.y + half.y > b.min[1] && c.y - half.y < b.max[1] && c.z + half.z > b.min[2] && c.z - half.z < b.max[2]);
    };
    let n = 0;
    for (let i = 0; i < g.count; i++) {
      if (g.type[i] !== 0) continue;
      const cx = centre[i * 3];
      const cz = centre[i * 3 + 2];
      if (!blocked(i, cx, cz)) continue;
      let inner = 0;
      let out = 0;
      for (let k = g.vstart[i]; k < g.vstart[i + 1]; k++) {
        if (blocked(i, cx + (g.vxyz[k * 3] - cx) * 0.6, cz + (g.vxyz[k * 3 + 2] - cz) * 0.6)) out++;
        inner++;
      }
      if (out * 2 <= inner) continue;
      this.navMesh.setPolyFlags(g.base + i, 0);
      g.flags[i] = 0;
      n++;
    }
    this.insideSolid = n;
    return n;
  }
  /** Nearest point on the navmesh, or null if nothing walkable is close. */
  closestPoint(p, halfExtents = { x: 2, y: 3, z: 2 }) {
    const r = this.query.findClosestPoint(p, { halfExtents });
    return r.success && r.polyRef !== 0 ? { ...r.point } : null;
  }
  /**
   * Straight-path corners from a to b, or null if b is unreachable from a. `shut`: openings (markOpenings' flag
   * bits) the route must keep out of, such as doors shut to the bot's team that no button opens for it. `agile`:
   * parkour links at walking's cost (PARKOUR_COST otherwise). `tall`: a body taller than the navmesh's (a large look):
   * ground under low headroom costs LOW_ROOF_COST a metre, so the route goes round it where the way round is short
   * enough; one that still goes under (crouching through is cheaper, or it starts or ends there) sets lastLow.
   */
  findPath(a, b, shut = 0, partial = false, open = 0, agile = false, tall = false) {
    if (!simProfile.on) return this.findPathNow(a, b, shut, partial, open, agile, tall);
    const t0 = performance.now();
    const r = this.findPathNow(a, b, shut, partial, open, agile, tall);
    simProfile.add("nav", performance.now() - t0);
    simProfile.count("nav");
    if (!r) simProfile.count("navFail");
    return r;
  }
  /**
   * Routes that don't exist, by start and end polygon: asked again, the answer
   * is a lookup instead of a search of everything reachable. (The navmesh
   * never changes under a NavWorld.) Found routes aren't shared: the tail of
   * another bot's corridor is shortest from where that bot entered a polygon,
   * not from where this one stands, and on open ground the difference showed
   * (Fort Wars bots stopped reaching the flag).
   */
  noRoute = /* @__PURE__ */ new Set();
  /**
   * `partial`: a route that exists but that the search ran out of nodes on (a very long way over a big map) comes
   * back as far as the search got, Detour's partial route: walk it, and ask again from its end.
   */
  findPathNow(a, b, shut = 0, partial = false, open = 0, agile = false, tall = false) {
    this.lastLow = false;
    const ext = { x: 2, y: 3, z: 2 };
    const s = this.query.findNearestPoly(a, { halfExtents: ext });
    const e = this.query.findNearestPoly(b, { halfExtents: ext });
    if (!s.success || !e.success || !s.nearestRef || !e.nearestRef) return null;
    const start = s.nearestPoint;
    const end = e.nearestPoint;
    if (this.part(s.nearestRef) !== this.part(e.nearestRef)) {
      if (simProfile.on) simProfile.count("navSearchFail");
      return null;
    }
    const base = this.graph().base;
    if (!this.routable(s.nearestRef - base, e.nearestRef - base)) {
      if (simProfile.on) simProfile.count("navSearchFail");
      return null;
    }
    if (this.gone) shut |= this.gone & ~this.navMesh.getPolyFlags(s.nearestRef).flags & ~this.navMesh.getPolyFlags(e.nearestRef).flags;
    const failKey = `${s.nearestRef}:${e.nearestRef}:${shut}`;
    let heavy = false;
    if (tall && this.lowSpans) {
      this.tallRoutes++;
      const lowKey = `${s.nearestRef}:${e.nearestRef}`;
      heavy = !this.lowAt(s.nearestRef - base) && !this.lowAt(e.nearestRef - base) && !this.lowForced.has(lowKey);
    }
    const filtered = shut || open || heavy || this.parkour.length && !agile;
    if (!partial && this.noRoute.has(failKey)) return null;
    const r = this.query.findPath(s.nearestRef, e.nearestRef, start, end, filtered ? { maxPathPolys: MAX_PATH_POLYS, filter: this.filterFor(shut, open, agile, heavy) } : { maxPathPolys: MAX_PATH_POLYS });
    const n = r.polys.size;
    if (tall && this.lowSpans && r.success) {
      for (let i = 0; i < n; i++) {
        if (!this.lowAt(r.polys.get(i) - base)) continue;
        this.lastLow = true;
        break;
      }
      if (this.lastLow) {
        this.lowRoutes++;
        if (heavy) {
          if (this.lowForced.size >= 4096) this.lowForced.clear();
          this.lowForced.add(`${s.nearestRef}:${e.nearestRef}`);
        }
      }
    }
    const whole = r.success && n > 0 && r.polys.get(n - 1) === e.nearestRef;
    if (simProfile.on) simProfile.count(whole ? "navSearch" : "navSearchFail");
    if (!whole && partial && r.success && n > 1) {
      const c = this.query.closestPointOnPoly(r.polys.get(n - 1), end);
      const sp2 = c.success ? this.query.findStraightPath(start, c.closestPoint, r.polys, { maxStraightPathPoints: MAX_CORNERS }) : null;
      r.polys.destroy();
      const out2 = [];
      if (sp2?.success) for (let i = 0; i < sp2.straightPathCount; i++) out2.push({ x: sp2.straightPath.get(i * 3), y: sp2.straightPath.get(i * 3 + 1), z: sp2.straightPath.get(i * 3 + 2) });
      if (sp2) {
        sp2.straightPath.destroy();
        sp2.straightPathFlags.destroy();
        sp2.straightPathRefs.destroy();
      }
      return out2.length > 1 ? out2 : null;
    }
    if (!whole) {
      r.polys.destroy();
      if (this.noRoute.size >= 4096) this.noRoute.clear();
      this.noRoute.add(failKey);
      return null;
    }
    const sp = this.query.findStraightPath(start, end, r.polys, { maxStraightPathPoints: MAX_CORNERS });
    r.polys.destroy();
    const out = [];
    if (sp.success) {
      const v = sp.straightPath;
      for (let i = 0; i < sp.straightPathCount; i++) out.push({ x: v.get(i * 3), y: v.get(i * 3 + 1), z: v.get(i * 3 + 2) });
    }
    sp.straightPath.destroy();
    sp.straightPathFlags.destroy();
    sp.straightPathRefs.destroy();
    const last = out[out.length - 1];
    if (!last || hypot(last.x - end.x, last.z - end.z) > 0.5 || Math.abs(last.y - end.y) > 1) return null;
    return out;
  }
  /**
   * A route that keeps to a corridor (nav/corridors.ts: its polygons, start to goal) the rest of the way to `to` (its
   * goal's end): from `from` onto the corridor polygon nearest it ahead (one short search), then along the corridor's
   * own polygons, the straight path through them all (BOT_AI_PLAN.md Phase C item 4: a group's bots keep to its lane,
   * where a route with the corridor's via went back to the shortest way by the trip's middle). Null when it can't: the
   * corridor shut or gone on the way (a door, a fallen bridge: `shut`), `to` off its last polygon, or no way onto it.
   */
  pathAlong(from, polys, to, shut = 0, tall = false) {
    const g = this.graph();
    if (polys.length < 2) return null;
    const ext = { x: 2, y: 3, z: 2 };
    const s = this.query.findNearestPoly(from, { halfExtents: ext });
    const e = this.query.findNearestPoly(to, { halfExtents: ext });
    if (!s.success || !s.nearestRef || !e.success || !e.nearestRef || e.nearestRef - g.base !== polys[polys.length - 1]) return null;
    const mask = shut | this.gone;
    const { centre } = polyShapes(g);
    let k = -1;
    let best = Infinity;
    for (let i = 0; i < polys.length; i++) {
      const p = polys[i];
      const d = hypot(centre[p * 3] - from.x, centre[p * 3 + 2] - from.z) + Math.abs(centre[p * 3 + 1] - from.y) * 2;
      if (d <= best) {
        best = d;
        k = i;
      }
    }
    if (k < 0 || best > 30) return null;
    for (let i = k; i < polys.length; i++) if (mask && g.flags[polys[i]] & mask) return null;
    if (tall && this.lowSpans) {
      for (let i = k; i < polys.length; i++) if (this.lowAt(polys[i])) return null;
    }
    const head = [];
    if (s.nearestRef - g.base !== polys[k]) {
      const target = this.query.closestPointOnPoly(g.base + polys[k], from);
      if (!target.success) return null;
      const r = this.query.findPath(s.nearestRef, g.base + polys[k], s.nearestPoint, target.closestPoint, { maxPathPolys: MAX_PATH_POLYS, filter: this.filterFor(shut | this.gone, 0) });
      const n = r.polys.size;
      const whole = r.success && n > 0 && r.polys.get(n - 1) === g.base + polys[k];
      for (let i = 0; whole && i < n - 1; i++) head.push(r.polys.get(i));
      r.polys.destroy();
      if (!whole) return null;
    }
    const refs = [...head];
    for (let i = k; i < polys.length; i++) refs.push(g.base + polys[i]);
    const sp = this.query.findStraightPath(s.nearestPoint, e.nearestPoint, refs, { maxStraightPathPoints: MAX_CORNERS });
    const out = [];
    if (sp.success) for (let i = 0; i < sp.straightPathCount; i++) out.push({ x: sp.straightPath.get(i * 3), y: sp.straightPath.get(i * 3 + 1), z: sp.straightPath.get(i * 3 + 2) });
    sp.straightPath.destroy();
    sp.straightPathFlags.destroy();
    sp.straightPathRefs.destroy();
    const last = out[out.length - 1];
    if (!last || hypot(last.x - e.nearestPoint.x, last.z - e.nearestPoint.z) > 0.5) return null;
    if (simProfile.on) simProfile.count("navAlong");
    return out;
  }
  placeCache = null;
  /**
   * Walkable sample points spread over the whole navmesh (about one per
   * `PLACE_CELL` metres on every floor), for bots choosing where to go and
   * which way round. Built once, deterministic.
   */
  places() {
    if (this.placeCache) return this.placeCache;
    const [pos, idx] = getNavMeshPositionsAndIndices(this.navMesh);
    const best = /* @__PURE__ */ new Map();
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const a = idx[t] * 3;
      const b = idx[t + 1] * 3;
      const c = idx[t + 2] * 3;
      const centre = { x: (pos[a] + pos[b] + pos[c]) / 3, y: (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, z: (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3 };
      const big = Math.max(Math.abs(pos[a] - pos[b]), Math.abs(pos[a + 2] - pos[b + 2]), Math.abs(pos[a] - pos[c]), Math.abs(pos[a + 2] - pos[c + 2])) > PLACE_CELL;
      for (const v of big ? [-1, a, b, c] : [-1]) {
        const p = v < 0 ? centre : { x: centre.x + (pos[v] - centre.x) * 0.7, y: centre.y + (pos[v + 1] - centre.y) * 0.7, z: centre.z + (pos[v + 2] - centre.z) * 0.7 };
        const cx = Math.floor(p.x / PLACE_CELL);
        const cz = Math.floor(p.z / PLACE_CELL);
        const key2 = ((cx + 2048) * 4096 + (cz + 2048)) * 256 + (Math.floor(p.y / 2.5) + 128);
        const d = hypot(p.x - (cx + 0.5) * PLACE_CELL, p.z - (cz + 0.5) * PLACE_CELL);
        const prev = best.get(key2);
        if (!prev || d < prev.d) best.set(key2, { p, d });
      }
    }
    this.placeCache = [...best.entries()].sort((x, y) => x[0] - y[0]).map(([, v]) => v.p);
    if (this.insideSolid) this.placeCache = this.placeCache.filter((p) => !!this.query.findNearestPoly(p, { halfExtents: { x: 0.5, y: 1, z: 0.5 } }).nearestRef);
    this.partsNow();
    this.placePolysNow();
    this.routesNow();
    this.toMainNow();
    return this.placeCache;
  }
  /**
   * The navmesh's connected parts: which part each polygon is in (links, off-mesh ones included, taken both
   * ways) and each part's size in polygons. Worked out once, on first use (about 15 ms for a big map). Points on
   * different parts have no route between them, whatever a search would say.
   */
  parts = null;
  partsNow() {
    if (this.parts) return this.parts;
    const mesh = this.navMesh;
    const tile = mesh.getMaxTiles() === 1 ? mesh.getTile(0) : null;
    const n = tile?.header()?.polyCount() ?? 0;
    if (!tile || !n) return this.parts = { of: new Int32Array(0), size: [], base: 0 };
    const base = mesh.getPolyRefBase(tile);
    const next = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      for (let l = tile.polys(i).firstLink(), k = 0; l !== 4294967295 && l >= 0 && k < 64; k++) {
        const link = tile.links(l);
        const j = link.ref() - base;
        if (j >= 0 && j < n && j !== i) {
          next[i].push(j);
          next[j].push(i);
        }
        l = link.next();
      }
    }
    const of = new Int32Array(n).fill(-1);
    const size = [];
    const stack = [];
    for (let i = 0; i < n; i++) {
      if (of[i] >= 0) continue;
      const id = size.length;
      let count = 0;
      of[i] = id;
      stack.push(i);
      while (stack.length) {
        const k = stack.pop();
        count++;
        for (const j of next[k]) {
          if (of[j] < 0) {
            of[j] = id;
            stack.push(j);
          }
        }
      }
      size.push(count);
    }
    return this.parts = { of, size, base };
  }
  /** Route filters that keep out of shut openings, by mask (a few per match: doors open and shut). */
  filters = /* @__PURE__ */ new Map();
  filterFor(shut, open = 0, agile = false, tall = false) {
    const key2 = ((shut * 4 + open) * 2 + (agile ? 1 : 0)) * 2 + (tall ? 1 : 0);
    let f = this.filters.get(key2);
    if (!f) {
      f = new QueryFilter();
      f.includeFlags = 65535;
      f.excludeFlags = shut;
      f.setAreaCost(OPEN_AREA, OPEN_COST[open] ?? 1);
      f.setAreaCost(PARKOUR_AREA, agile ? 1 : PARKOUR_COST);
      f.setAreaCost(LOW_AREA, tall ? LOW_ROOF_COST : 1);
      if (this.filters.size >= 64) this.filters.clear();
      this.filters.set(key2, f);
    }
    return f;
  }
  /**
   * Openings (doors, walls that block paths until broken: Scenario.openings) as navmesh flags: the polygons
   * under the first OPENING_BITS of them get bit k + 1 each, so findPath's `shut` can keep a route out of the
   * ones shut to a bot. Sampled every 0.25 m over each opening's footprint, keeping only polygons the samples
   * stand over (not ones that merely come near). Once, at match start (and when the navmesh is rebuilt).
   */
  markOpenings(boxes, surfacesFrom = Infinity) {
    const half = { x: 0.15, y: 0.9, z: 0.15 };
    const g = this.graph();
    const { centre } = polyShapes(g);
    boxes.slice(0, OPENING_BITS).forEach((b, k) => {
      const bit = 1 << k + 1;
      const marked = /* @__PURE__ */ new Set();
      const surface = k >= surfacesFrom;
      const y = surface ? b.max.y : b.min.y + 0.3;
      const points = [];
      const o = b.obox;
      if (o) {
        const c = Math.cos(o.yaw);
        const s = Math.sin(o.yaw);
        for (let lx = -o.half.x; lx <= o.half.x + 1e-6; lx += 0.25) {
          for (let lz = -o.half.z; lz <= o.half.z + 1e-6; lz += 0.25) points.push([o.center.x + lx * c + lz * s, o.center.z - lx * s + lz * c]);
        }
      } else {
        for (let x = b.min.x; x <= b.max.x + 1e-6; x += 0.25) for (let z = b.min.z; z <= b.max.z + 1e-6; z += 0.25) points.push([x, z]);
      }
      for (const [x, z] of points) {
        const r = this.query.findNearestPoly({ x, y, z }, { halfExtents: surface ? { x: 0.15, y: 0.4, z: 0.15 } : half });
        if (!r.success || !r.nearestRef || !r.isOverPoly || marked.has(r.nearestRef)) continue;
        marked.add(r.nearestRef);
        if (surface) {
          const i = r.nearestRef - g.base;
          const cx = centre[i * 3];
          const cz = centre[i * 3 + 2];
          if (cx < b.min.x - 0.3 || cx > b.max.x + 0.3 || cz < b.min.z - 0.3 || cz > b.max.z + 0.3) continue;
          if (Math.abs(centre[i * 3 + 1] - b.max.y) > 0.25) continue;
        }
        const f = this.navMesh.getPolyFlags(r.nearestRef);
        if (this.insideSolid && f.flags === 0) continue;
        this.navMesh.setPolyFlags(r.nearestRef, (f.flags || 1) | bit);
        this.usedBits |= bit;
        const gi = r.nearestRef - g.base;
        if (gi >= 0 && gi < g.count) g.flags[gi] = (f.flags || 1) | bit;
      }
    });
    this.noRoute.clear();
  }
  /**
   * The per-tick search budget (BOT_AI_PLAN.md Phase C item 4: big matches, huge maps): route searches bots may start
   * this tick before the rest wait for the next (a bot with a route keeps to it meanwhile). Infinite until the match
   * sets one (beginTick).
   */
  searchesLeft = Infinity;
  /** Searches put off by the budget (measuring). */
  searchesPutOff = 0;
  /** The match, each tick: `budget` route searches for bots this tick. */
  beginTick(budget) {
    this.searchesLeft = budget;
  }
  /** A bot that would plan its route again now: whether the tick's budget has a search for it (one is used). */
  takeSearch() {
    if (this.searchesLeft <= 0) {
      this.searchesPutOff++;
      return false;
    }
    this.searchesLeft--;
    return true;
  }
  /** Surfaces gone now (Scenario.surfacesGone: flag bits every route keeps off), and a count of changes to them. */
  gone = 0;
  goneVersion = 0;
  /** Opening bits markOpenings gave to at least one polygon (a surface that flagged none changes no route). */
  usedBits = 0;
  /** The match, when what's gone changes: every route search from now on keeps off those polygons. */
  setGone(mask) {
    mask &= this.usedBits;
    if (mask === this.gone) return;
    this.gone = mask;
    this.goneVersion++;
  }
  /**
   * Lift rides as navmesh flags: the off-mesh links whose ends are a lift's two stops (Match: liftLinks) get
   * LIFT_FLAG, so a route can be asked to keep off lifts. Once, at match start.
   */
  markLifts(lifts) {
    if (!lifts.length) return;
    const mesh = this.navMesh;
    const tile = mesh.getMaxTiles() === 1 ? mesh.getTile(0) : null;
    const header = tile?.header();
    if (!tile || !header) return;
    const base = mesh.getPolyRefBase(tile);
    const near2 = (x, y, z, p) => hypot(x - p.x, z - p.z) < 3 && Math.abs(y - p.y) < 1.5;
    for (let i = 0; i < header.offMeshConCount(); i++) {
      const con = tile.offMeshCons(i);
      const a = [con.pos(0), con.pos(1), con.pos(2)];
      const b = [con.pos(3), con.pos(4), con.pos(5)];
      if (!lifts.some((l) => near2(a[0], a[1], a[2], l.start) && near2(b[0], b[1], b[2], l.end))) continue;
      const ref = base + con.poly();
      const f = mesh.getPolyFlags(ref);
      mesh.setPolyFlags(ref, (f.flags || 1) | LIFT_FLAG);
    }
    this.noRoute.clear();
  }
  graphCache = null;
  /**
   * The navmesh as a graph (the navigation audit, nav/audit.ts; drop links at build): every polygon's corners, its
   * edges with no neighbour (where the walkable ground ends: a wall, a ledge, a step too high), and Detour's own
   * links between polygons, one way (an off-mesh link is a polygon of its own, entered from its start's polygon
   * and left to its end's). Read once, on first use, from the navmesh's single tile (empty for any other).
   */
  graph() {
    if (this.graphCache) return this.graphCache;
    const mesh = this.navMesh;
    const tile = mesh.getMaxTiles() === 1 ? mesh.getTile(0) : null;
    const header = tile?.header();
    const n = header?.polyCount() ?? 0;
    const empty = { count: 0, base: 0, type: new Uint8Array(0), vstart: new Int32Array(1), vxyz: new Float32Array(0), open: new Uint8Array(0), linkStart: new Int32Array(1), links: new Int32Array(0), flags: new Uint16Array(0) };
    if (!tile || !header || !n) return this.graphCache = empty;
    const base = mesh.getPolyRefBase(tile);
    const tileVerts = header.vertCount();
    const tv = new Float32Array(tileVerts * 3);
    for (let i = 0; i < tv.length; i++) tv[i] = tile.verts(i);
    const type = new Uint8Array(n);
    const flags = new Uint16Array(n);
    const vstart = new Int32Array(n + 1);
    const open = new Uint8Array(n);
    const coords = [];
    const linkStart = new Int32Array(n + 1);
    const links = [];
    for (let i = 0; i < n; i++) {
      const poly = tile.polys(i);
      type[i] = poly.getType();
      flags[i] = poly.flags();
      const vc = poly.vertCount();
      vstart[i] = coords.length / 3;
      let bits = 0;
      for (let j = 0; j < vc; j++) {
        const v = poly.verts(j) * 3;
        coords.push(tv[v], tv[v + 1], tv[v + 2]);
        if (type[i] === 0 && poly.neis(j) === 0) bits |= 1 << j;
      }
      open[i] = bits;
      linkStart[i] = links.length;
      for (let l = poly.firstLink(), k = 0; l !== 4294967295 && l >= 0 && k < 64; k++) {
        const link = tile.links(l);
        const j = link.ref() - base;
        if (j >= 0 && j < n && j !== i) links.push(j);
        l = link.next();
      }
    }
    vstart[n] = coords.length / 3;
    linkStart[n] = links.length;
    return this.graphCache = { count: n, base, type, vstart, vxyz: Float32Array.from(coords), open, linkStart, links: Int32Array.from(links), flags };
  }
  /**
   * Route reachability, exact (one-way links count one way): each polygon's component of routes (polygons that all
   * route to each other), the biggest one, and what routes from it reach. Worked out once, on first use (a few ms).
   */
  routesCache = null;
  /** What routes reach from each component asked about (by component; the main one is routesCache.fromMain). */
  reachFrom = /* @__PURE__ */ new Map();
  routesNow() {
    if (this.routesCache) return this.routesCache;
    const g = this.graph();
    const seeds = this.spawnSeeds.flatMap((p) => {
      const r2 = this.query.findNearestPoly(p, { halfExtents: { x: 1, y: 1, z: 1 } });
      return r2.success && r2.nearestRef ? [r2.nearestRef - g.base] : [];
    });
    const r = routeComponents(g, seeds);
    return this.routesCache = r;
  }
  /** Spawn points (the build's `drops.spawns`): they say which component of routes is the main area. */
  spawnSeeds = [];
  mainPlacesCache = null;
  /**
   * places() in the main area: those routes from it reach and that route back to it (not a roof nobody gets onto,
   * a pit nobody gets out of): where bots pick goals, squads regions, campers and snipers their spots.
   */
  mainPlaces() {
    if (this.mainPlacesCache) return this.mainPlacesCache;
    const places = this.places();
    const r = this.routesNow();
    if (r.main < 0) return this.mainPlacesCache = [...places];
    const toMain = this.toMainNow();
    const out = [];
    for (const p of places) {
      const hit = this.query.findNearestPoly(p, { halfExtents: { x: 0.5, y: 1, z: 0.5 } });
      const i = hit.success && hit.nearestRef ? hit.nearestRef - this.graph().base : -1;
      if (i >= 0 && r.fromMain[i] && toMain[i]) out.push(p);
    }
    return this.mainPlacesCache = out.length ? out : [...places];
  }
  toMainCache = null;
  reverseCache = null;
  reachTo = /* @__PURE__ */ new Map();
  /** The routes' edges reversed (CSR), made once. */
  reverseNow() {
    if (this.reverseCache) return this.reverseCache;
    const r = this.routesNow();
    const n = r.comp.length;
    const deg = new Int32Array(n + 1);
    for (let k = 0; k < r.to.length; k++) deg[r.to[k] + 1]++;
    for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
    const fill = deg.slice(0, n);
    const to = new Int32Array(r.to.length);
    for (let a = 0; a < n; a++) for (let k = r.start[a]; k < r.start[a + 1]; k++) to[fill[r.to[k]]++] = a;
    return this.reverseCache = { start: deg, to };
  }
  /** Polygons that route to the main area. */
  toMainNow() {
    if (this.toMainCache) return this.toMainCache;
    const r = this.routesNow();
    const n = r.comp.length;
    const seeds = [];
    for (let i = 0; i < n; i++) if (r.comp[i] === r.main) seeds.push(i);
    const back = this.reverseNow();
    return this.toMainCache = reachSet(back.start, back.to, n, seeds);
  }
  /** Polygons that route to polygon `i` (to its component; cached per component, at most 256 kept). */
  routesTo(i) {
    const r = this.routesNow();
    const c = r.comp[i];
    if (c === r.main) return this.toMainNow();
    let seen = this.reachTo.get(c);
    if (seen) return seen;
    const back = this.reverseNow();
    seen = reachSet(back.start, back.to, r.comp.length, [i]);
    if (this.reachTo.size >= 256) this.reachTo.clear();
    this.reachTo.set(c, seen);
    return seen;
  }
  /** Whether `p` (on or near the navmesh) routes to the main area and is routed to from it. */
  inMain(p) {
    const s = this.nearestPoly(p);
    if (!s) return false;
    const r = this.routesNow();
    return r.fromMain[s.index] === 1 && this.toMainNow()[s.index] === 1;
  }
  /** What routes from polygon `i`'s component reach (cached per component; at most 256 kept). */
  reachOf(i) {
    const r = this.routesNow();
    const c = r.comp[i];
    if (c === r.main) return r.fromMain;
    let seen = this.reachFrom.get(c);
    if (seen) return seen;
    seen = reachSet(r.start, r.to, r.comp.length, [i]);
    if (this.reachFrom.size >= 256) this.reachFrom.clear();
    this.reachFrom.set(c, seen);
    return seen;
  }
  /** Whether a route can exist from polygon `a` to polygon `b` (graph indices): no search, a lookup. */
  routable(a, b) {
    const r = this.routesNow();
    if (a < 0 || b < 0 || a >= r.comp.length || b >= r.comp.length) return false;
    return r.comp[a] === r.comp[b] || this.reachOf(a)[b] === 1;
  }
  /** Whether a route can exist from `a` to `b` (each on or near the navmesh; false off it). */
  reachable(a, b) {
    const s = this.nearestPoly(a);
    const e = this.nearestPoly(b);
    return !!s && !!e && this.routable(s.index, e.index);
  }
  standInCache = /* @__PURE__ */ new Map();
  /**
   * Where to head for `goal` from `from`: the goal itself when a route reaches it (exact), else the place nearest it
   * that a route from `from` does reach (a flag on a ledge: below it; a pickup on a crate: beside it; a goal on a
   * roof: under it), remembered per component of routes and goal polygon for the match (no search for it ever
   * again). Null when `from` is off the navmesh, or nothing routes anywhere from there.
   */
  standIn(from, goal) {
    const s = this.nearestPoly(from);
    if (!s) return null;
    const e = this.nearestPoly(goal);
    if (e && this.routable(s.index, e.index)) return { pos: goal, exact: true };
    const r = this.routesNow();
    const key2 = `${r.comp[s.index]}>${e ? e.index : `${Math.round(goal.x)},${Math.round(goal.y)},${Math.round(goal.z)}`}`;
    let pos = this.standInCache.get(key2);
    if (pos === void 0) {
      pos = this.nearestRoutable(s.index, goal);
      if (this.standInCache.size >= 2048) this.standInCache.clear();
      this.standInCache.set(key2, pos);
    }
    return pos ? { pos, exact: false } : null;
  }
  /** The point nearest `goal` (height counts double) on a polygon routes from polygon `from` reach. */
  nearestRoutable(from, goal) {
    const g = this.graph();
    const seen = this.reachOf(from);
    const comp = this.routesNow().comp;
    const { centre } = polyShapes(g);
    const best = [];
    for (let i = 0; i < g.count; i++) {
      if (g.type[i] !== 0 || !(seen[i] || comp[i] === comp[from])) continue;
      const d = hypot(centre[i * 3] - goal.x, centre[i * 3 + 2] - goal.z) + Math.abs(centre[i * 3 + 1] - goal.y) * 2;
      if (best.length < 6 || d < best[best.length - 1].d) {
        best.push({ i, d });
        best.sort((a, b) => a.d - b.d || a.i - b.i);
        if (best.length > 6) best.pop();
      }
    }
    let out = null;
    let outD = Infinity;
    for (const { i } of best) {
      const c = this.query.closestPointOnPoly(g.base + i, goal);
      if (!c.success) continue;
      const p = c.closestPoint;
      const d = hypot(p.x - goal.x, p.z - goal.z) + Math.abs(p.y - goal.y) * 2;
      if (d < outD) {
        outD = d;
        out = { x: p.x, y: p.y, z: p.z };
      }
    }
    return out;
  }
  /**
   * Off the navmesh (pushed or fallen onto ground it doesn't cover, a narrow ledge, spawned badly): the nearest place
   * on it to walk to, level or below (a body can step or drop down, not climb), within a few metres; null when
   * `p` is on the navmesh (or nothing is near).
   */
  wayOnto(p, clear) {
    const near2 = this.query.findNearestPoly(p, { halfExtents: { x: 2, y: 3, z: 2 } });
    if (near2.nearestRef) {
      const q = near2.nearestPoint;
      if (!clear || hypot(q.x - p.x, q.z - p.z) < 0.6 || clear(p, q)) return null;
    }
    for (const [r, down] of [
      [6, 6],
      [12, 30],
      [24, 60]
    ]) {
      if (!clear) {
        const hit = this.query.findNearestPoly({ x: p.x, y: p.y - down / 2 + 0.3, z: p.z }, { halfExtents: { x: r, y: down / 2 + 0.3, z: r } });
        if (hit.success && hit.nearestRef && hit.nearestPoint.y < p.y + 0.6) return { ...hit.nearestPoint };
        continue;
      }
      const q = this.query.queryPolygons({ x: p.x, y: p.y - down / 2 + 0.3, z: p.z }, { x: r, y: down / 2 + 0.3, z: r }, { maxPolys: 256 });
      const pts = [];
      for (const ref of q.success ? q.polyRefs : []) {
        if (this.insideSolid && this.navMesh.getPolyFlags(ref).flags === 0) continue;
        const c = this.query.closestPointOnPoly(ref, p);
        if (!c.success || c.closestPoint.y >= p.y + 0.6) continue;
        const pt = { x: c.closestPoint.x, y: c.closestPoint.y, z: c.closestPoint.z };
        pts.push({ q: pt, d: hypot(pt.x - p.x, pt.z - p.z) + (p.y - pt.y) * 0.5 });
      }
      pts.sort((a, b) => a.d - b.d || a.q.x - b.q.x || a.q.z - b.q.z);
      for (const { q: pt } of pts.slice(0, 12)) if (clear(p, pt)) return pt;
    }
    return null;
  }
  /** The polygon (index into graph()) nearest `p` within `halfExtents`, and the nearest point on it; null off the navmesh. */
  nearestPoly(p, halfExtents = { x: 2, y: 3, z: 2 }) {
    const r = this.query.findNearestPoly(p, { halfExtents });
    if (!r.success || !r.nearestRef) return null;
    const index = r.nearestRef - this.graph().base;
    return { index, point: { ...r.nearestPoint }, over: r.isOverPoly };
  }
  /** The part of the navmesh a polygon is in (-1 when unknown: then every polygon counts as one part). */
  part(ref) {
    const p = this.partsNow();
    const i = ref - p.base;
    return i >= 0 && i < p.of.length ? p.of[i] : -1;
  }
  /** The part of the navmesh under `p` (within the reach routes search from), and its size in polygons; null off the navmesh. */
  partAt(p) {
    const r = this.query.findNearestPoly(p, { halfExtents: { x: 2, y: 3, z: 2 } });
    if (!r.success || !r.nearestRef) return null;
    const id = this.part(r.nearestRef);
    return { id, size: id >= 0 ? this.partsNow().size[id] : 0 };
  }
  /** The polygon (graph index) each of places() is on (-1: none). */
  placePolys = null;
  placePolysNow() {
    if (this.placePolys) return this.placePolys;
    const places = this.placeCache ?? this.places();
    const base = this.graph().base;
    const polys = new Int32Array(places.length);
    places.forEach((p, i) => {
      const r = this.query.findNearestPoly(p, { halfExtents: { x: 0.5, y: 1, z: 0.5 } });
      polys[i] = r.success && r.nearestRef ? r.nearestRef - base : -1;
    });
    return this.placePolys = polys;
  }
  escapeCache = /* @__PURE__ */ new Map();
  /**
   * Ways off a patch of navmesh cut off from `goal` (docs/BOTS.md, "Cut off"). The navmesh is more cautious
   * than legs are: it keeps 0.8 m from walls where a body needs 0.4, and a step under a low roof, a narrow
   * gap or a slab edge a hair over the step height can leave a patch players walk off with no route out of it
   * (Capitol Mall's reflecting pool; Diamond Park's dugouts, three spawn points each, until their roofs were
   * raised in the map). For a point no route from which reaches the goal (or off the navmesh altogether), up to
   * three places close by that do route to it and are a short step or hop across (up to ESCAPE_RISE up, 8 m
   * across) from where the point's routes get, nearest first: where to cross from (null when the point is off the
   * navmesh) and the place across. From ground that routes to the main area, only onto ground that routes back to
   * it too (onto a dais the navmesh doesn't climb, never down into a pit). `clear`: a body gets straight across
   * from one to the other (nothing in the way). Empty when nothing is near enough, or a route reaches the goal.
   * Cached per polygon and the goal's component of routes.
   */
  escapes(from, goal, clear) {
    const ext = { x: 2, y: 3, z: 2 };
    const e = this.query.findNearestPoly(goal, { halfExtents: ext });
    if (!e.success || !e.nearestRef) return NO_ESCAPE;
    if (this.part(e.nearestRef) < 0) return NO_ESCAPE;
    const s = this.query.findNearestPoly(from, { halfExtents: ext });
    const on = s.success && !!s.nearestRef;
    const base = this.graph().base;
    const goalIdx = e.nearestRef - base;
    const toGoal = this.routesTo(goalIdx);
    const toMain = this.toMainNow();
    let safe = false;
    if (on) {
      const i = s.nearestRef - base;
      if (toGoal[i]) return NO_ESCAPE;
      safe = toMain[i] === 1;
    }
    const landing = (poly) => poly >= 0 && toGoal[poly] === 1 && (!safe || toMain[poly] === 1);
    const goalComp = this.routesNow().comp[goalIdx];
    const key2 = on ? `${s.nearestRef}>${goalComp}` : `${Math.round(from.x)},${Math.round(from.y)},${Math.round(from.z)}>${goalComp}`;
    const known = this.escapeCache.get(key2);
    if (known) return known;
    const places = this.places();
    const placePolys = this.placePolysNow();
    const near2 = [];
    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      if (!landing(placePolys[i]) || Math.abs(p.y - from.y) > 5) continue;
      const d = hypot(p.x - from.x, p.z - from.z);
      if (d < ESCAPE_REACH) near2.push({ p, d });
    }
    near2.sort((a, b) => a.d - b.d);
    const out = [];
    const tried = [];
    const tryAcross = (p) => {
      if (tried.some((t) => hypot(t.x - p.x, t.z - p.z) < 1 && Math.abs(t.y - p.y) < 1)) return;
      tried.push(p);
      const edge = on ? this.nearestReach(s.nearestRef, s.nearestPoint, p) : null;
      if (on && !edge) return;
      const at2 = edge ?? from;
      const rise = p.y - at2.y;
      if (hypot(p.x - at2.x, p.z - at2.z) > ESCAPE_GAP || rise > ESCAPE_RISE || rise < -4 || !clear(at2, p)) return;
      out.push({ edge, across: { ...p } });
    };
    const routes = this.routesNow();
    const joined = (p) => {
      const h = this.query.findNearestPoly(p, { halfExtents: { x: 0.5, y: 1, z: 0.5 } });
      return h.success && !!h.nearestRef && routes.comp[h.nearestRef - base] === goalComp;
    };
    for (const pass of [true, false]) {
      for (const { p } of near2) {
        if (out.length >= 3 || tried.length >= 12) break;
        if (pass === joined(p)) tryAcross(p);
      }
    }
    if (!out.length) {
      const q = this.query.queryPolygons(from, { x: ESCAPE_REACH, y: 5, z: ESCAPE_REACH }, { maxPolys: 512 });
      const ground = [];
      for (const ref of q.success ? q.polyRefs : []) {
        if (!landing(ref - base)) continue;
        const c = this.query.closestPointOnPoly(ref, from);
        if (!c.success || Math.abs(c.closestPoint.y - from.y) > 5) continue;
        const p = { x: c.closestPoint.x, y: c.closestPoint.y, z: c.closestPoint.z };
        const d = hypot(p.x - from.x, p.z - from.z);
        if (d < ESCAPE_REACH) ground.push({ p, d });
      }
      ground.sort((a, b) => a.d - b.d || a.p.x - b.p.x || a.p.z - b.p.z);
      for (const { p } of ground) {
        if (out.length >= 3 || tried.length >= 24) break;
        tryAcross(p);
      }
    }
    if (this.escapeCache.size >= 2048) this.escapeCache.clear();
    this.escapeCache.set(key2, out);
    return out;
  }
  reachCache = /* @__PURE__ */ new Map();
  /**
   * The nearest point to `b` that a route from `a` gets to, when `b` itself can't be reached (a flag dropped into
   * a pit, a goal on a roof): Detour's partial route ends at the polygon nearest it. The same for every start on
   * one part of the navmesh, so cached per part and goal polygon: one search however many bots ask.
   */
  reachToward(a, b) {
    const ext = { x: 2, y: 3, z: 2 };
    const s = this.query.findNearestPoly(a, { halfExtents: ext });
    const e = this.query.findNearestPoly(b, { halfExtents: { x: 4, y: 8, z: 4 } });
    if (!s.success || !s.nearestRef || !e.success || !e.nearestRef) return null;
    const key2 = `${this.part(s.nearestRef)}>${e.nearestRef}`;
    if (this.reachCache.has(key2)) return this.reachCache.get(key2);
    const p = this.nearestReach(s.nearestRef, s.nearestPoint, b, { x: 4, y: 8, z: 4 });
    if (this.reachCache.size >= 1024) this.reachCache.clear();
    this.reachCache.set(key2, p);
    return p;
  }
  /** The point of the start polygon's patch nearest `to` (on another part: Detour's partial route ends at the polygon nearest it). */
  nearestReach(startRef, start, to, reach2 = { x: 1, y: 2, z: 1 }) {
    const e = this.query.findNearestPoly(to, { halfExtents: reach2 });
    if (!e.success || !e.nearestRef) return null;
    const r = this.query.findPath(startRef, e.nearestRef, start, e.nearestPoint, { maxPathPolys: MAX_PATH_POLYS });
    const n = r.polys.size;
    const last = r.success && n > 0 ? r.polys.get(n - 1) : 0;
    r.polys.destroy();
    if (!last) return null;
    const c = this.query.closestPointOnPoly(last, to);
    return c.success ? { ...c.closestPoint } : null;
  }
  destroy() {
    for (const f of this.filters.values()) f.raw?.__destroy__?.();
    this.filters.clear();
    this.query.destroy();
    this.navMesh.destroy();
  }
}
const cellKey$1 = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
function linkPairs(nav, links) {
  const out = [];
  for (const l of links) {
    const a = nav.nearestPoly(l.start, { x: 0.5, y: 1, z: 0.5 });
    const b = nav.nearestPoly(l.end, { x: 0.5, y: 1, z: 0.5 });
    if (a && b && a.index !== b.index) out.push([a.index, b.index]);
  }
  return out;
}
function validateNavigation(map, nav, physics, audit) {
  const issues = [];
  const spawns = map.entities.filter((e) => e.kind === "spawn");
  const onMesh = spawns.filter((s) => {
    const p = { x: s.position[0], y: s.position[1], z: s.position[2] };
    if (!nav.closestPoint(p, { x: 1, y: 1, z: 1 })) {
      issues.push({ severity: "warning", code: "nav.spawn_off_mesh", message: `spawn ${s.id} is not on walkable ground`, targetId: s.id });
      return false;
    }
    return true;
  });
  const [first, ...rest] = onMesh;
  if (physics && audit) issues.push(...(audit.done ?? auditNavigation(map, nav, physics, audit)).issues);
  else if (first) {
    const from = { x: first.position[0], y: first.position[1], z: first.position[2] };
    for (const s of rest) {
      if (!nav.findPath(from, { x: s.position[0], y: s.position[1], z: s.position[2] })) {
        issues.push({ severity: "warning", code: "nav.disconnected", message: `spawn ${s.id} cannot be reached from spawn ${first.id}`, targetId: s.id });
      }
    }
    const what = { pickup: "pickup", flag: "flag base", hill: "hill", bombsite: "bomb site", hostage: "hostage", rescue: "rescue zone", objective: "Breakthrough objective" };
    for (const p of map.entities) {
      if (!what[p.kind]) continue;
      const to = { x: p.position[0], y: p.position[1], z: p.position[2] };
      const path = nav.findPath(from, to);
      const end = path?.[path.length - 1];
      if (!end || hypot(end.x - to.x, end.z - to.z) > 1.5 || Math.abs(end.y - to.y) > 2) {
        issues.push({ severity: "warning", code: `nav.${p.kind}_unreachable`, message: `${what[p.kind]} ${p.id} cannot be reached on foot from spawn ${first.id}`, targetId: p.id });
      }
    }
  }
  for (const p of mapPortals(map.entities)) {
    if (p.link < 0) continue;
    for (const [what, at2] of [["in front of", portalEntry(p, 0.9)], ["out of", portalEntry(p, PORTAL_EXIT + 0.6)]]) {
      if (!nav.closestPoint(at2, { x: 1.2, y: 1.5, z: 1.2 })) {
        issues.push({ severity: "warning", code: "nav.portal_blocked", message: `the ground ${what} portal ${p.id} is not walkable (nothing to stand on, or something in the way)`, targetId: p.id });
        break;
      }
    }
  }
  if (physics) {
    for (const s of spawns) {
      if (!physics.boxClear({ x: s.position[0], y: s.position[1] + 1, z: s.position[2] }, { x: 0.25, y: 0.5, z: 0.25 })) {
        issues.push({ severity: audit?.official ? "error" : "warning", code: "spawn.blocked", message: `spawn ${s.id} is inside something solid: whoever spawns there can't move`, targetId: s.id });
      }
    }
    issues.push(...ziplineClearanceIssues(map.entities, physics));
    const zips = mapZiplines(map.entities);
    for (const z of zips) {
      for (const l of ziplineLinks([z], physics)) {
        for (const [what, at2] of [["where riders grab it", l.start], ["where it drops riders off", l.end]]) {
          if (!nav.closestPoint(at2, { x: 1.5, y: 1.5, z: 1.5 })) issues.push({ severity: "warning", code: "nav.zipline_end", message: `zipline ${z.id}: the ground ${what} is not walkable (nothing to stand on, or something in the way)`, targetId: z.id });
        }
      }
    }
  }
  issues.push(...validateTrackNavigation(map, nav));
  return issues;
}
function validateTrackNavigation(map, nav) {
  const g = trackGeometry(map);
  if (!g) return [];
  const issues = [];
  const reach2 = { x: g.width / 2, y: 4, z: g.width / 2 };
  const spots = g.gates.map((gate) => nav.closestPoint({ x: gate.x, y: gate.y, z: gate.z }, reach2));
  spots.forEach((p, i) => {
    if (!p) issues.push({ severity: "warning", code: "nav.checkpoint_off_mesh", message: `checkpoint ${i + 1} is not on drivable ground` });
  });
  const legs = g.loop ? spots.length : spots.length - 1;
  for (let i = 0; i < legs; i++) {
    const a = spots[i];
    const b = spots[(i + 1) % spots.length];
    if (a && b && !nav.findPath(a, b)) issues.push({ severity: "warning", code: "nav.checkpoint_unreachable", message: `checkpoint ${(i + 1) % spots.length + 1} cannot be reached from checkpoint ${i + 1}` });
  }
  return issues;
}
const aimBody = { feet: { x: 0, y: 0, z: 0 }, yaw: 0, stance: 0, scale: 1, box: null };
const HISTORY = 32;
const REACQUIRE_TICKS = Math.round(TICK_RATE * 0.8);
class AimModel {
  constructor(rng, difficulty, profile) {
    this.rng = rng;
    this.difficulty = difficulty;
    this.profile = profile;
  }
  rng;
  difficulty;
  profile;
  /** Current aim error (radians). */
  errYaw = 0;
  errPitch = 0;
  trackSlot = null;
  /** Tick the current target was acquired (aim starts unsettled). */
  acquiredTick = 0;
  lastSeenTick = -Infinity;
  hist = new Float64Array(HISTORY * 3);
  histCount = 0;
  histHead = 0;
  spareGauss = null;
  // Trigger state.
  burstLeft = 0;
  pauseUntil = 0;
  nextTap = 0;
  held = false;
  head = false;
  nextPointPick = 0;
  /** Aim at the upper body until this tick (the chest is behind something low). */
  highUntil = -Infinity;
  /** Accuracy multiplier from the profile: 50 → 1, 80 → 0.64, 30 → 1.24. */
  get accuracyScale() {
    return 1.6 - clamp(this.profile.accuracy, 0, 100) / 100 * 1.2;
  }
  gauss() {
    if (this.spareGauss !== null) {
      const g = this.spareGauss;
      this.spareGauss = null;
      return g;
    }
    const u = Math.max(1e-9, this.rng());
    const v = this.rng();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spareGauss = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }
  /** Reset on respawn. */
  reset() {
    this.trackSlot = null;
    this.histCount = 0;
    this.errYaw = this.errPitch = 0;
    this.burstLeft = 0;
    this.held = false;
    this.highUntil = -Infinity;
  }
  /**
   * The crosshair is on something in the way while the target stands clear
   * beside it: a person sees that and brings it back onto them. (The bot
   * can't otherwise see its own error.) Halves the wander.
   */
  correct() {
    this.errYaw *= 0.5;
    this.errPitch *= 0.5;
  }
  /** Only their upper body shows over cover: aim there (not at the chest) until `until`. */
  raise(until) {
    this.highUntil = until;
  }
  /** The target's speed across the view from `eye` (m/s), as the bot has seen it move. */
  speedAcross(eye, target) {
    const v = this.velocity(0);
    const dx = target.x - eye.x;
    const dz = target.z - eye.z;
    return Math.abs(v.x * dz - v.z * dx) / Math.max(1, hypot(dx, dz));
  }
  /** The aim's wander is within about the target's width: a shot a careful person would take. */
  settledOn(sol) {
    return hypot(this.errYaw, this.errPitch) < sol.halfAngle * 1.2;
  }
  /** Ticks since the current target was acquired. */
  trackedTicks(tick) {
    return this.trackSlot === null ? 0 : tick - this.acquiredTick;
  }
  /**
   * Every tick while the bot sees `target` (or null): record where the target
   * is (for the lag model) and evolve the aim error.
   */
  track(ctx, target) {
    if (!target) {
      if (this.trackSlot !== null && ctx.tick - this.lastSeenTick > REACQUIRE_TICKS) this.trackSlot = null;
      return;
    }
    const skill = this.difficulty.aim;
    if (this.trackSlot !== target.slot || ctx.tick - this.lastSeenTick > REACQUIRE_TICKS) {
      this.trackSlot = target.slot;
      this.acquiredTick = ctx.tick;
      this.histCount = 0;
      const e = skill.acquireRad * this.accuracyScale * (0.7 + 0.6 * this.rng());
      const a = this.rng() * Math.PI * 2;
      this.errYaw = Math.cos(a) * e;
      this.errPitch = Math.sin(a) * e * 0.5;
      this.burstLeft = 0;
      this.pauseUntil = ctx.tick + Math.round(TICK_RATE * 0.05);
      this.head = false;
      this.nextPointPick = 0;
    }
    this.lastSeenTick = ctx.tick;
    const i = this.histHead * 3;
    this.hist[i] = target.pos.x;
    this.hist[i + 1] = target.pos.y;
    this.hist[i + 2] = target.pos.z;
    this.histHead = (this.histHead + 1) % HISTORY;
    this.histCount = Math.min(HISTORY, this.histCount + 1);
    const sigma = this.sigma(ctx, target);
    const k = Math.exp(-TICK_DT / Math.max(0.05, skill.settleSeconds));
    const n = Math.sqrt(1 - k * k) * sigma;
    this.errYaw = this.errYaw * k + n * this.gauss();
    this.errPitch = this.errPitch * k + n * 0.55 * this.gauss();
  }
  /** Target position `ago` ticks back (clamped to the history we have). */
  past(ago) {
    if (this.histCount === 0) return null;
    const back = Math.min(ago, this.histCount - 1);
    const i = (this.histHead - 1 - back + HISTORY * 2) % HISTORY * 3;
    return { x: this.hist[i], y: this.hist[i + 1], z: this.hist[i + 2] };
  }
  /** The target's velocity as the bot has seen it (m/s), `ago` ticks back. */
  velocity(ago) {
    const span = 6;
    const a = this.past(ago);
    const b = this.past(ago + span);
    if (!a || !b || this.histCount < 3) return { x: 0, y: 0, z: 0 };
    const ticks = Math.max(1, Math.min(span, this.histCount - 1 - Math.min(ago, this.histCount - 1)));
    return { x: (a.x - b.x) / (ticks * TICK_DT), y: 0, z: (a.z - b.z) / (ticks * TICK_DT) };
  }
  /** Current error spread (1σ, radians). */
  sigma(ctx, target) {
    const skill = this.difficulty.aim;
    const dx = target.pos.x - ctx.eye.x;
    const dz = target.pos.z - ctx.eye.z;
    const dist = Math.max(1, hypot(dx, dz));
    const v = this.velocity(0);
    const lateral = Math.abs(v.x * dz - v.z * dx) / dist;
    const omega = lateral / dist;
    const distF = 0.85 + dist / 80;
    const moveF = 1 + 0.9 * Math.min(1.5, ctx.speed / PLAYER.runSpeed) + (ctx.airborne ? 0.8 : 0);
    const stanceF = ctx.stance === 2 ? 0.62 : ctx.stance === 1 ? 0.8 : 1;
    const targetF = 1 + Math.min(2, omega * 1.6);
    const steadyF = ctx.steady ? 0.75 : 1;
    return skill.settledRad * this.accuracyScale * distF * moveF * stanceF * targetF * steadyF;
  }
  /**
   * Where to point: the target as seen a moment ago, led by part of that lag
   * (and by the flight time for projectiles), at chest or head height, plus
   * the current error.
   */
  solve(ctx, target) {
    const skill = this.difficulty.aim;
    const lagTicks = Math.round(skill.lagSeconds * TICK_RATE);
    const seen = this.past(lagTicks) ?? target.pos;
    const v = this.velocity(lagTicks);
    const size = target.size ?? 1;
    const height = STANCES[target.stance ?? 0].height * size;
    if (ctx.tick >= this.nextPointPick) {
      const dist0 = hypot(target.pos.x - ctx.eye.x, target.pos.z - ctx.eye.z);
      const settled = this.trackedTicks(ctx.tick) > skill.settleSeconds * TICK_RATE;
      this.head = settled && dist0 < 40 && this.rng() < skill.headChance * (this.profile.accuracy / 50);
      this.nextPointPick = ctx.tick + Math.round(TICK_RATE * (0.6 + this.rng() * 0.8));
    }
    let up = this.head ? height - 0.15 * size : ctx.tick < this.highUntil ? height - 0.3 * size : height * 0.6;
    let ox = 0;
    let oz = 0;
    const box = target.box;
    if (box && (target.stance ?? 0) === (target.bodyStance ?? 0)) {
      aimBody.yaw = target.yaw ?? 0;
      aimBody.stance = target.bodyStance ?? 0;
      aimBody.scale = (target.hitScale ?? 1) * size;
      aimBody.box = box;
      const s = shapesFor(box, aimBody.stance);
      const high = ctx.tick < this.highUntil;
      const p = this.head || high || !s.torso ? headPoint(aimBody) : bodyToWorld(aimBody, s.torso.x, (s.torso.a[0] + s.torso.b[0]) / 2, (s.torso.a[1] + s.torso.b[1]) / 2);
      if (high && !this.head && s.head) p.y -= s.head.r * 0.5 * aimBody.scale;
      ox = p.x;
      up = p.y;
      oz = p.z;
    }
    let lead = skill.lagSeconds * skill.prediction;
    const proj = ctx.weapon?.projectile;
    const dist = hypot(seen.x - ctx.eye.x, seen.y + up - ctx.eye.y, seen.z - ctx.eye.z);
    if (proj && proj.speed > 0) lead += dist / proj.speed * (0.35 + 0.5 * skill.prediction);
    const bal = ctx.weapon ? gunplayOf(ctx.weapon).ballistic : null;
    const flight = bal ? Math.max(0, dist - NEAR_INSTANT_M) / bal.velocity : 0;
    if (bal) lead += flight * (skill.leadSkill ?? 0.5);
    const point = { x: seen.x + ox + v.x * lead, y: seen.y + up, z: seen.z + oz + v.z * lead };
    const want = lookAngles(ctx.eye, point);
    if (proj && proj.gravity > 0) {
      const t = dist / proj.speed;
      want.pitch += Math.atan2(0.5 * proj.gravity * t * t, dist);
    }
    if (bal) want.pitch += Math.atan2(0.5 * BULLET_GRAVITY * bal.gravityScale * flight * flight, dist) * (skill.dropComp ?? 0.5);
    return { yaw: want.yaw + this.errYaw, pitch: want.pitch + this.errPitch, dist, halfAngle: Math.atan2(PLAYER.radius, Math.max(1, dist)) };
  }
  /**
   * Trigger discipline. Given whether the shot is lined up (the bot's own
   * view; it can't see its error), decide whether to hold fire this tick.
   * `clear`, asked only when a round would otherwise go, can still hold it
   * (BotBrain: the line from the eye is blocked short of the target).
   */
  trigger(ctx, sol, yaw, pitch, reacted, clear) {
    const def = ctx.weapon;
    const skill = this.difficulty.aim;
    const tol = sol.halfAngle + 0.012;
    const lined = Math.abs(angleDelta(yaw, sol.yaw)) < tol && Math.abs(pitch - sol.pitch) < tol * 1.6;
    let pull = false;
    if (def && reacted && lined && (def.kind !== "melee" || sol.dist < def.range + 0.6)) {
      const mode = def.fireMode ?? "auto";
      if (def.windupTicks) pull = true;
      else if (def.kind === "melee") pull = true;
      else if (mode === "auto" && def.fireIntervalTicks <= 12 && !def.projectile?.splashRadius) {
        if ((sol.dist < 9 || ctx.tick >= this.pauseUntil) && (!clear || clear())) pull = this.autoBurst(ctx, sol, def);
      } else {
        const slow = def.fireIntervalTicks >= 30 || def.damage >= 50;
        const settledEnough = !slow || hypot(this.errYaw, this.errPitch) < sol.halfAngle * 1.3 || this.trackedTicks(ctx.tick) > skill.settleSeconds * TICK_RATE * 2.5;
        if (!this.held && ctx.tick >= this.nextTap && settledEnough && (!clear || clear())) {
          pull = true;
          const gap = Math.max(def.fireIntervalTicks + 1, Math.round(skill.tapSeconds * TICK_RATE * (0.8 + this.rng() * 0.5)));
          this.nextTap = ctx.tick + gap;
        }
      }
    }
    this.held = pull;
    return pull;
  }
  /** Automatic fire: spray up close, short controlled bursts further out. */
  autoBurst(ctx, sol, def) {
    if (sol.dist < 9) return true;
    if (ctx.tick < this.pauseUntil) return false;
    if (this.burstLeft <= 0) {
      const [lo, hi2] = this.difficulty.aim.burst;
      const spreadRatio = (def.spread + (def.recoil?.maxBloom ?? 0) * 0.5) / Math.max(5e-3, sol.halfAngle);
      const shrink = sol.dist > 30 || spreadRatio > 1.5 ? 1 : 0;
      let shots = Math.max(2, Math.round(lo + this.rng() * (hi2 - lo)) - shrink);
      const tight = gunplayOf(def).accuracy?.tight;
      if (tight !== void 0) {
        const discipline = this.difficulty.aim.discipline ?? 0.5;
        shots = discipline >= 0.5 ? Math.min(shots, tight + 1) : shots + Math.round((1 - discipline) * 6);
      }
      this.burstLeft = shots * def.fireIntervalTicks;
    }
    this.burstLeft--;
    if (this.burstLeft <= 0) {
      this.pauseUntil = ctx.tick + Math.round(TICK_RATE * (0.18 + 4e-3 * sol.dist + this.rng() * 0.18));
    }
    return true;
  }
}
const CROUCH_EYE = STANCES[1].eye - 0.1;
const STAND_EYE = STANCES[0].eye;
const DIRECTIONS = 10;
const RADII = [2.2, 4.5, 7.5];
const HUG = 2.4;
function blockedNear(physics, eye, threat) {
  const dx = threat.x - eye.x;
  const dy = threat.y - eye.y;
  const dz = threat.z - eye.z;
  const d = hypot(dx, dy, dz);
  if (d < 1) return null;
  const hit = physics.raycastWorld(eye, { x: dx / d, y: dy / d, z: dz / d }, Math.min(d - 0.3, HUG));
  return hit;
}
function exposedTo(physics, eye, threat) {
  return physics.lineOfSight(eye, threat);
}
function findCover(q) {
  const { physics, nav, from, threat } = q;
  const toThreat = hypot(threat.x - from.x, threat.z - from.z) || 1;
  let best = null;
  const tried = [];
  const phase = q.rng() * Math.PI * 2;
  const crouchY = CROUCH_EYE * (q.eyeScale ?? 1);
  const standY = STAND_EYE * (q.eyeScale ?? 1);
  for (const r of RADII) {
    if (r > q.radius) break;
    for (let i = 0; i < DIRECTIONS; i++) {
      const a = phase + i / DIRECTIONS * Math.PI * 2;
      const want = { x: from.x + Math.sin(a) * r, y: from.y + 0.4, z: from.z + Math.cos(a) * r };
      const p = nav.closestPoint(want, { x: 1.2, y: 1.6, z: 1.2 });
      if (!p || Math.abs(p.y - from.y) > 2.5) continue;
      if (tried.some((t) => horizontalDistance(t, p) < 0.8)) continue;
      tried.push(p);
      const dThreat = hypot(threat.x - p.x, threat.z - p.z);
      if (dThreat < 3) continue;
      const crouchEye = { x: p.x, y: p.y + crouchY, z: p.z };
      const blocker = blockedNear(physics, crouchEye, threat);
      if (blocker === null) continue;
      const sx = (threat.z - p.z) / dThreat * 0.35;
      const sz = -(threat.x - p.x) / dThreat * 0.35;
      if (blockedNear(physics, { x: crouchEye.x + sx, y: crouchEye.y, z: crouchEye.z + sz }, threat) === null) continue;
      if (blockedNear(physics, { x: crouchEye.x - sx, y: crouchEye.y, z: crouchEye.z - sz }, threat) === null) continue;
      const standEye = { x: p.x, y: p.y + standY, z: p.z };
      const low = exposedTo(physics, standEye, threat);
      let peek = 0;
      if (!low) {
        const lx = (threat.z - p.z) / dThreat;
        const lz = -(threat.x - p.x) / dThreat;
        for (const side of [1, -1]) {
          const lean = { x: p.x + lx * side * 1.1, y: p.y + standY, z: p.z + lz * side * 1.1 };
          if (exposedTo(physics, lean, threat)) {
            peek = side;
            break;
          }
        }
      }
      const travel = horizontalDistance(from, p);
      let score = -travel * 0.8 - Math.abs(dThreat - q.preferred) * 0.25 + (low || peek ? 3 : 0) + (blocker < 1.2 ? 1 : 0);
      if (dThreat < toThreat - 1 && toThreat < 12) score -= 4;
      if (q.away) score += (dThreat - toThreat) * 0.5;
      if (q.avoid?.some((o) => horizontalDistance(o, p) < 1.6)) score -= 6;
      if (!best || score > best.score) best = { spot: { pos: { x: p.x, y: p.y, z: p.z }, low, peek, threat: { ...threat } }, score };
    }
  }
  return best?.spot ?? null;
}
function stillCovered(physics, spot2, threat, eyeScale = 1) {
  return blockedNear(physics, { x: spot2.x, y: spot2.y + CROUCH_EYE * eyeScale, z: spot2.z }, threat) !== null;
}
const CELL$1 = 7;
const FLOOR$2 = 2.5;
const MAX_CELLS$1 = 256;
class MapMemory {
  visited = /* @__PURE__ */ new Map();
  key(p) {
    return (Math.floor(p.x / CELL$1) + 512) * 1e6 + (Math.floor(p.z / CELL$1) + 512) * 1e3 + (Math.floor(p.y / FLOOR$2) + 100);
  }
  clear() {
    this.visited.clear();
  }
  mark(p, tick) {
    const k = this.key(p);
    this.visited.delete(k);
    this.visited.set(k, tick);
    if (this.visited.size > MAX_CELLS$1) this.visited.delete(this.visited.keys().next().value);
  }
  /** Seconds since the bot was last around `p` (Infinity if never). */
  ageSeconds(p, tick) {
    const t = this.visited.get(this.key(p));
    return t === void 0 ? Infinity : (tick - t) / TICK_RATE;
  }
}
function pickExploreGoal(places, extra, from, memory, tick, rng, exploration) {
  const ideal = 14 + exploration / 100 * 40;
  let best = null;
  const consider = (p) => {
    const d = horizontalDistance(p, from) + Math.abs(p.y - from.y) * 2;
    if (d < 6) return;
    const age = Math.min(90, memory.ageSeconds(p, tick)) / 90;
    const s = age * 2 - Math.abs(d - ideal) / 40 + rng() * 0.6;
    if (!best || s > best.s) best = { p, s };
  };
  for (const p of extra) consider(p);
  const n = Math.min(places.length, 14);
  for (let i = 0; i < n; i++) consider(places[Math.floor(rng() * places.length)]);
  return best ? { ...best.p } : null;
}
function laneWaypoint(places, from, to, lane) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const D = hypot(dx, dz);
  if (D < 30) return null;
  const ux = dx / D;
  const uz = dz / D;
  const want = lane * Math.min(D * 0.3, 28);
  let best = null;
  let bestS = Infinity;
  for (const p of places) {
    const rx = p.x - from.x;
    const rz = p.z - from.z;
    const along = (rx * ux + rz * uz) / D;
    if (along < 0.3 || along > 0.65) continue;
    const side = rx * uz - rz * ux;
    const s = Math.abs(side - want) + Math.abs(along - 0.45) * 20 + Math.abs(p.y - from.y) * 2;
    if (s < bestS) {
      bestS = s;
      best = p;
    }
  }
  return best ? { ...best } : null;
}
const MEMORY_SIZE = 8;
const SAME = 4;
const EXPECT_AFTER = TICK_RATE;
const WEIGHT = { shot: 1.6, seen: 1.2, callout: 0.9, heard: 0.6 };
class EnemyMemory {
  spots = [];
  clear() {
    this.spots.length = 0;
  }
  /** Something about an enemy here and now: refreshes that enemy's spot (or one close by of nobody known), else a new one. */
  note(slot, pos, tick, source) {
    const s = this.spots;
    let at2 = -1;
    for (let i = 0; i < s.length; i++) {
      const e = s[i];
      if (slot >= 0 ? e.slot === slot : e.slot < 0 && horizontalDistance(e.pos, pos) < SAME) {
        at2 = i;
        break;
      }
    }
    if (at2 >= 0) {
      const e = s[at2];
      if (e.tick > tick || e.tick === tick && WEIGHT[e.source] > WEIGHT[source]) return;
      e.pos.x = pos.x;
      e.pos.y = pos.y;
      e.pos.z = pos.z;
      e.tick = tick;
      e.source = source;
      return;
    }
    if (s.length >= MEMORY_SIZE) {
      let old = 0;
      for (let i = 1; i < s.length; i++) if (s[i].tick < s[old].tick) old = i;
      s.splice(old, 1);
    }
    s.push({ slot, pos: { x: pos.x, y: pos.y, z: pos.z }, tick, source });
  }
  /** Does it know of that enemy (a spot of it within `keepTicks`)? */
  knows(slot, tick, keepTicks) {
    for (const e of this.spots) if (e.slot === slot && tick - e.tick <= keepTicks) return true;
    return false;
  }
  /** That enemy is dead (or gone): nothing to remember of it. */
  forget(slot) {
    for (let i = this.spots.length - 1; i >= 0; i--) if (this.spots[i].slot === slot) this.spots.splice(i, 1);
  }
  /** Entries older than `keepTicks` go. */
  expire(tick, keepTicks) {
    for (let i = this.spots.length - 1; i >= 0; i--) if (tick - this.spots[i].tick > keepTicks) this.spots.splice(i, 1);
  }
  /**
   * The spot most worth a look from `from`: by its source, fresher and nearer first (within `range` m and `keepTicks`).
   * Null for none.
   */
  best(from, tick, keepTicks, range = 60) {
    let best = null;
    let top = 0;
    for (const e of this.spots) {
      const age = tick - e.tick;
      if (age > keepTicks) continue;
      const d = horizontalDistance(e.pos, from);
      if (d > range || d < 2) continue;
      const v = WEIGHT[e.source] * (1 - age / (keepTicks + 1)) * (1 - d / range * 0.5);
      if (v > top) {
        top = v;
        best = e;
      }
    }
    return best;
  }
  /**
   * Is `pos` (an enemy just seen) where it expected someone: within `near` m of a spot it remembers, at least
   * EXPECT_AFTER old (one lost from sight a moment ago and seen again is no surprise either way: the full reaction, as
   * before) and fresh enough.
   */
  expected(pos, tick, keepTicks, near2 = 7) {
    for (const e of this.spots) {
      const age = tick - e.tick;
      if (age >= EXPECT_AFTER && age <= keepTicks && horizontalDistance(e.pos, pos) < near2 && Math.abs(e.pos.y - pos.y) < 4) return true;
    }
    return false;
  }
}
const BOARD_SIZE = 64;
const RECALL_TICKS = TICK_RATE * 2;
class CalloutBoard {
  ring = [];
  next = 0;
  /** Callouts posted so far (measuring). */
  posted = 0;
  /** When each caller last called out each enemy (caller * 4096 + enemy), so one sighting isn't repeated every look. */
  lastCall = /* @__PURE__ */ new Map();
  /** A bot saw an enemy here (posted at most every RECALL_TICKS per caller and enemy). */
  post(by, slot, pos, tick) {
    const k = by * 4096 + slot;
    const last = this.lastCall.get(k);
    if (last !== void 0 && tick - last < RECALL_TICKS) return;
    this.lastCall.set(k, tick);
    if (this.lastCall.size > 2048) this.lastCall.clear();
    const c = this.ring[this.next];
    if (c) {
      c.slot = slot;
      c.pos.x = pos.x;
      c.pos.y = pos.y;
      c.pos.z = pos.z;
      c.tick = tick;
      c.by = by;
    } else this.ring[this.next] = { slot, pos: { x: pos.x, y: pos.y, z: pos.z }, tick, by };
    this.next = (this.next + 1) % BOARD_SIZE;
    this.posted++;
  }
  /** Callouts after tick `since` (not the reader's own), within `range` m of `from`, each handed to `take`. */
  read(since, from, range, reader, take) {
    for (const c of this.ring) if (c.tick > since && c.by !== reader && horizontalDistance(c.pos, from) <= range) take(c);
  }
  /** The newest callouts (debug view). */
  recent(tick, ticks) {
    return this.ring.filter((c) => tick - c.tick <= ticks);
  }
}
const spot = (h) => ({ pos: hintAt(h), yaw: h.yaw ?? null, radius: h.radius, id: h.id });
function sideHints(hints, side) {
  const mine = hints.filter((h) => !h.team || h.team === side);
  return { chokes: mine.filter((h) => h.kind === "choke").map(spot), staging: mine.filter((h) => h.kind === "staging").map(spot) };
}
const SNIPER_HINT_SCORE = 2.6;
const CAMP_HINT_SCORE = 2.2;
const HINT_REPLACES = 8;
const EYE$1 = 1.5;
const FAR$1 = 90;
function hintSpots(hints, raycast) {
  const out = [];
  for (const h of hints) {
    if (h.kind !== "sniper" && h.kind !== "camp") continue;
    const p = hintAt(h);
    const eye = { x: p.x, y: p.y + EYE$1, z: p.z };
    const reachAt = (a) => raycast(eye, { x: Math.sin(a), y: 0, z: Math.cos(a) }, FAR$1) ?? FAR$1;
    let yaw = h.yaw ?? 0;
    let reach2 = 0;
    if (h.yaw === void 0 || h.yaw === null) {
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2;
        const r = reachAt(a);
        if (r > reach2) {
          reach2 = r;
          yaw = a;
        }
      }
    } else reach2 = reachAt(yaw);
    out.push({ pos: p, kind: h.kind, yaw, reach: reach2, height: 0, score: h.kind === "sniper" ? SNIPER_HINT_SCORE : CAMP_HINT_SCORE, hint: h.id, ...h.team ? { team: h.team } : {} });
  }
  return out;
}
function withHintSpots(computed, hinted) {
  if (!hinted.length) return computed;
  const kept = computed.filter((s) => !hinted.some((h) => h.kind === s.kind && horizontalDistance(h.pos, s.pos) < HINT_REPLACES && Math.abs(h.pos.y - s.pos.y) < 3));
  return [...kept, ...hinted];
}
const STAGE_OFF_ROUTE = 14;
const STAGE_FROM_COMPUTED = 40;
function stageHint(line, computed, staging) {
  if (!staging.length || !line.length) return null;
  const goal = line[line.length - 1];
  let best = null;
  let bestD = STAGE_FROM_COMPUTED;
  for (const h of staging) {
    const d = horizontalDistance(h.pos, computed);
    if (d >= bestD) continue;
    if (horizontalDistance(h.pos, goal) < horizontalDistance(computed, goal) - h.radius) continue;
    let off = Infinity;
    for (const p of line) off = Math.min(off, horizontalDistance(p, h.pos));
    if (off > STAGE_OFF_ROUTE) continue;
    best = h;
    bestD = d;
  }
  return best ? { ...best.pos } : null;
}
function chokesNear(chokes, at2, range) {
  const out = [];
  for (const c of chokes) if (horizontalDistance(c.pos, at2) <= range + c.radius && Math.abs(c.pos.y - at2.y) < 6) out.push(c);
  return out;
}
function hintJumps(map) {
  return mapBotHints(map, "jump").flatMap((h) => {
    const to = hintTo(h);
    return to ? [{ start: hintAt(h), end: to }] : [];
  });
}
const HULL_STILL = 1;
const HULL_LOOK = 7;
const TOUCH = PLAYER.radius + 0.1;
const ROUND = PLAYER.radius + 0.55;
const SIDE_KEEP = 1.5;
function stillHull(m) {
  if (!m.half) return false;
  if (!m.alive) return !!m.wreck;
  return m.kind !== "vehicle" || (m.speed ?? 0) < HULL_STILL;
}
function insideHull(hulls, p, skip = -1) {
  for (const m of hulls) {
    const half = m.half;
    if (!half || m.index === skip || !stillHull(m)) continue;
    if (p.y > m.pos.y + half[1] * 2 - 0.4 || p.y < m.pos.y - 1.2) continue;
    const dx = p.x - m.pos.x;
    const dz = p.z - m.pos.z;
    if (Math.abs(dx) > half[0] + half[2] + 1 || Math.abs(dz) > half[0] + half[2] + 1) continue;
    const c = Math.cos(m.yaw);
    const s = Math.sin(m.yaw);
    if (Math.abs(dx * c - dz * s) < half[0] + PLAYER.radius && Math.abs(dx * s + dz * c) < half[2] + PLAYER.radius) return true;
  }
  return false;
}
function segmentEntersBox(ax, az, bx, bz, ex, ez) {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-9) return q > 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (!clip(-dx, ax + ex) || !clip(dx, ex - ax) || !clip(-dz, az + ez) || !clip(dz, ez - az)) return -1;
  return t1 - t0 > 1e-6 ? t0 : -1;
}
function hullDetour(hulls, me, to, w) {
  let wx = to.x - me.x;
  let wz = to.z - me.z;
  const len = Math.hypot(wx, wz);
  if (len < 0.3) return null;
  const look = Math.min(len, HULL_LOOK);
  const ex = me.x + wx / len * look;
  const ez = me.z + wz / len * look;
  wx /= len;
  wz /= len;
  let best = null;
  let bestT = Infinity;
  let under = false;
  for (const m of hulls) {
    const half2 = m.half;
    if (!half2 || m.index === w.boarding || !stillHull(m)) continue;
    const reach2 = Math.max(half2[0], half2[2]) + TOUCH;
    if (Math.hypot((me.x + ex) / 2 - m.pos.x, (me.z + ez) / 2 - m.pos.z) > look / 2 + reach2) continue;
    if (me.y > m.pos.y + half2[1] * 2 - 0.4 || me.y < m.pos.y - 1.2) continue;
    const c2 = Math.cos(m.yaw);
    const s2 = Math.sin(m.yaw);
    const ax2 = (me.x - m.pos.x) * c2 - (me.z - m.pos.z) * s2;
    const az2 = (me.x - m.pos.x) * s2 + (me.z - m.pos.z) * c2;
    if (Math.abs(ax2) < half2[0] + TOUCH * 0.5 && Math.abs(az2) < half2[2] + TOUCH * 0.5) continue;
    const gx2 = (to.x - m.pos.x) * c2 - (to.z - m.pos.z) * s2;
    const gz2 = (to.x - m.pos.x) * s2 + (to.z - m.pos.z) * c2;
    const inside = Math.abs(gx2) < half2[0] + TOUCH && Math.abs(gz2) < half2[2] + TOUCH;
    if (!inside && Math.abs(gx2) < half2[0] + ROUND + 0.3 && Math.abs(gz2) < half2[2] + ROUND + 0.3) continue;
    if (inside && !w.beyond) continue;
    const bx = (ex - m.pos.x) * c2 - (ez - m.pos.z) * s2;
    const bz = (ex - m.pos.x) * s2 + (ez - m.pos.z) * c2;
    const t = segmentEntersBox(ax2, az2, bx, bz, half2[0] + TOUCH, half2[2] + TOUCH);
    if (t >= 0 && t < bestT) {
      bestT = t;
      best = m;
      under = inside;
    }
  }
  if (!best) return null;
  const half = best.half;
  const c = Math.cos(best.yaw);
  const s = Math.sin(best.yaw);
  const local = (p) => [(p.x - best.pos.x) * c - (p.z - best.pos.z) * s, (p.x - best.pos.x) * s + (p.z - best.pos.z) * c];
  const world = (x, z) => ({ x: best.pos.x + x * c + z * s, y: me.y, z: best.pos.z - x * s + z * c });
  const blocked = (x0, z0, x1, z1) => segmentEntersBox(x0, z0, x1, z1, half[0] + TOUCH, half[2] + TOUCH) >= 0;
  const [ax, az] = local(me);
  const goal = under ? w.beyond : to;
  const [gx, gz] = local(goal);
  if (under && !blocked(ax, az, gx, gz) && w.ok(me, goal)) return "beyond";
  const hx = half[0] + ROUND;
  const hz = half[2] + ROUND;
  const cx = [hx, hx, -hx, -hx];
  const cz = [hz, -hz, -hz, hz];
  const ways = [];
  for (let k = 0; k < 4; k++) {
    const kx = cx[k];
    const kz = cz[k];
    if (blocked(ax, az, kx, kz)) continue;
    const p = world(kx, kz);
    const side = wx * (p.z - me.z) - wz * (p.x - me.x) > 0 ? 1 : -1;
    const kept = w.keep && w.keep.index === best.index && w.keep.side !== side ? SIDE_KEEP : 0;
    const first = Math.hypot(kx - ax, kz - az) + kept;
    if (!blocked(kx, kz, gx, gz)) ways.push({ k, q: -1, cost: first + Math.hypot(gx - kx, gz - kz), side });
    for (const q of [(k + 1) % 4, (k + 3) % 4]) {
      const qx = cx[q];
      const qz = cz[q];
      if (!blocked(qx, qz, gx, gz)) ways.push({ k, q, cost: first + Math.hypot(qx - kx, qz - kz) + Math.hypot(gx - qx, gz - qz), side });
    }
  }
  ways.sort((a, b) => a.cost - b.cost || a.k - b.k || a.q - b.q);
  for (const v of ways) {
    const p = world(cx[v.k], cz[v.k]);
    if (!w.ok(me, p)) continue;
    const q = v.q >= 0 ? world(cx[v.q], cz[v.q]) : null;
    if (q && !w.ok(p, q)) continue;
    if (!w.ok(q ?? p, { ...goal, y: me.y })) continue;
    return { pos: p, index: best.index, side: v.side };
  }
  return "none";
}
const OPT_GOAL = 0;
const OPT_ROAM = 1;
const OPT_COVER = 2;
const OPT_RETREAT = 3;
const OPT_PICKUP = 4;
const OPT_CHASE = 5;
const OPT_NOISE = 6;
const OPT_FIGHT = 7;
const OPT_POST = 8;
const OPTIONS = 9;
const MARGIN = 0.25;
const ROAM_WEIGHT = 0.3;
const CHASE_WEIGHT = 1.6;
const NOISE_WEIGHT = 1.5;
const COVER_WEIGHT = 2.9;
const GUN_WEIGHT = 2.75;
const RETREAT_WEIGHT = 2.6;
const POST_WEIGHT = 1.35;
const SCOPE_WEIGHT = 2.8;
const PUSH_NOTICE = 12;
const HOLD_NOTICE = 12;
const ORDER_NOTICE = 10;
const SQUAD_NOTICE = 15;
const ORDER_WEIGHT = 2.4;
const SQUAD_WEIGHT = 1.3;
const POST_NOTICE = 10;
function goalWeight(g, p) {
  const care = p.objectivePriority / 100 * 0.3;
  if (g.run) return 6;
  if (g.order) return ORDER_WEIGHT;
  if (g.squad) return SQUAD_WEIGHT + care;
  if (g.push) return 1 + care;
  if (g.watch) return 0.9 + care;
  return 0.8 + care;
}
function leaveCost(g, d, at2) {
  if (!g) return 0;
  if (g.run) return Infinity;
  if (g.order) return d > ORDER_NOTICE ? Infinity : 0;
  if (g.squad) return d > SQUAD_NOTICE ? Infinity : 0;
  if (g.push) return d > PUSH_NOTICE ? Infinity : 0;
  const off = horizontalDistance(g.pos, at2) - g.radius;
  return Math.min(1.6, Math.max(0, (off - HOLD_NOTICE) / 12));
}
function scoreChoices(i, sc) {
  const g = i.goal;
  const p = i.profile;
  sc.fill(-Infinity);
  sc[OPT_GOAL] = g ? goalWeight(g, p) : -Infinity;
  sc[OPT_ROAM] = g ? -Infinity : ROAM_WEIGHT;
  if (i.cover) sc[OPT_COVER] = COVER_WEIGHT;
  if (i.retreating) sc[OPT_RETREAT] = RETREAT_WEIGHT;
  sc[OPT_PICKUP] = i.pickup;
  sc[OPT_POST] = i.post;
  const lost = i.lost;
  if (lost && !i.hurt) {
    const most = 1 + p.pursuitPersistence / 100 * 7;
    const d = horizontalDistance(i.me, lost.pos);
    if (lost.age < most && d > 1.5) sc[OPT_CHASE] = CHASE_WEIGHT + p.pursuitPersistence / 100 * 0.4 + 0.4 * (1 - lost.age / most) - (i.lowAmmo ? 0.3 : 0) - leaveCost(g, d, lost.pos);
    if (i.posted && d > POST_NOTICE) sc[OPT_CHASE] = -Infinity;
  }
  const noise = i.noise;
  if (noise) {
    const d = horizontalDistance(i.me, noise.pos);
    if (noise.age < 10 && d > 2) sc[OPT_NOISE] = NOISE_WEIGHT + p.aggression / 100 * 0.25 + p.exploration / 100 * 0.15 + 0.2 * (1 - noise.age / 10) - (i.hurt ? 0.6 : 0) - leaveCost(g, d, noise.pos);
    if (i.posted && d > POST_NOTICE) sc[OPT_NOISE] = -Infinity;
  }
}
function bestChoice(sc, last, hasGoal) {
  let best = -1;
  let top = -Infinity;
  for (let i = 0; i < OPTIONS; i++) {
    const v = sc[i] + (i === last && sc[i] > -Infinity ? MARGIN : 0);
    if (v > top) {
      top = v;
      best = i;
    }
  }
  return best < 0 ? hasGoal ? OPT_GOAL : OPT_ROAM : best;
}
const STILL = 1.2;
const UNAWARE = 0.5;
const SETTLE_WAIT = 1;
const PATIENCE = 1.5;
const SPRINT = 4.8;
function goodShot(s) {
  if (s.dist > s.reach || !s.settled && s.tracked < SETTLE_WAIT) return false;
  if (s.lateral < STILL || s.facing < UNAWARE) return true;
  return s.tracked >= PATIENCE && s.lateral < SPRINT;
}
function shotsPerSpot(p) {
  return p.aggression >= 60 ? 3 : 2;
}
function laneCover(spot2, lines, sees, most = 24) {
  const eye = { x: spot2.pos.x, y: spot2.pos.y + 1.5, z: spot2.pos.z };
  const fx = Math.sin(spot2.yaw);
  const fz = Math.cos(spot2.yaw);
  const cos = Math.cos(35 * Math.PI / 180);
  const cands = [];
  for (const line of lines) {
    for (let i = 0; i < line.length; i += 2) {
      const p = line[i];
      const dx = p.x - eye.x;
      const dz = p.z - eye.z;
      const d = Math.hypot(dx, dz);
      if (d < 12 || d > spot2.reach) continue;
      if ((dx * fx + dz * fz) / d < cos) continue;
      cands.push({ p, d });
    }
  }
  if (!cands.length) return 0;
  cands.sort((a, b) => a.d - b.d);
  const step = Math.max(1, Math.floor(cands.length / most));
  let seen = 0;
  let checked = 0;
  for (let i = 0; i < cands.length && checked < most; i += step) {
    checked++;
    const p = cands[i].p;
    if (sees(eye, { x: p.x, y: p.y + 1.2, z: p.z })) seen++;
  }
  return seen / checked;
}
function relocatePrefer(from, before, apart = 18) {
  return (p) => {
    if (horizontalDistance(p, from) < apart) return -5;
    if (before && horizontalDistance(p, before) < horizontalDistance(from, before)) return -1;
    return 0;
  };
}
const PROBE_HEIGHT = 1.2;
function isDoorway(physics, at2, dx, dz, halfWidth = 1.7) {
  const len = hypot(dx, dz) || 1;
  const px = -dz / len;
  const pz = dx / len;
  const o = { x: at2.x, y: at2.y + PROBE_HEIGHT, z: at2.z };
  return physics.raycastWorld(o, { x: px, y: 0, z: pz }, halfWidth) !== null && physics.raycastWorld(o, { x: -px, y: 0, z: -pz }, halfWidth) !== null;
}
function turnAngle(a, b, c) {
  const ux = b.x - a.x;
  const uz = b.z - a.z;
  const vx = c.x - b.x;
  const vz = c.z - b.z;
  const lu = hypot(ux, uz);
  const lv = hypot(vx, vz);
  if (lu < 1e-3 || lv < 1e-3) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uz * vz) / (lu * lv))));
}
function fanPoints(physics, eye, yaw, spread2, count, maxDist = 18) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = yaw - spread2 + 2 * spread2 * i / (count - 1);
    const dir = { x: Math.sin(a), y: 0, z: Math.cos(a) };
    const d = physics.raycastWorld(eye, dir, maxDist) ?? maxDist;
    const reach2 = Math.max(1.5, d - 0.3);
    out.push({ x: eye.x + dir.x * reach2, y: eye.y, z: eye.z + dir.z * reach2 });
  }
  return out;
}
const THROW_LIFT = 0.12;
function throwImpact(physics, eye, yaw, pitch, spec, maxTicks = 150) {
  const aim = normalize({ ...viewDirection(yaw, pitch), y: viewDirection(yaw, pitch).y + THROW_LIFT });
  let pos = { x: eye.x + aim.x * 0.5, y: eye.y + aim.y * 0.5, z: eye.z + aim.z * 0.5 };
  let vel = { x: aim.x * spec.speed, y: aim.y * spec.speed, z: aim.z * spec.speed };
  const step = 2 * TICK_DT;
  for (let t = 0; t < maxTicks; t += 2) {
    vel = { x: vel.x, y: vel.y - spec.gravity * step, z: vel.z };
    const delta = { x: vel.x * step, y: vel.y * step, z: vel.z * step };
    const len = hypot(delta.x, delta.y, delta.z);
    const hit = physics.raycastWorld(pos, { x: delta.x / len, y: delta.y / len, z: delta.z / len }, len);
    if (hit !== null) return { x: pos.x + delta.x / len * hit, y: pos.y + delta.y / len * hit, z: pos.z + delta.z / len * hit };
    pos = { x: pos.x + delta.x, y: pos.y + delta.y, z: pos.z + delta.z };
  }
  return null;
}
function solveThrow(physics, eye, target, spec, tolerance = 2) {
  const baseYaw = Math.atan2(target.x - eye.x, target.z - eye.z);
  const full = horizontalDistance(eye, target);
  const v = spec.speed;
  const g = spec.gravity;
  for (const off of [0, -0.12, 0.12, -0.24, 0.24]) {
    const yaw = baseYaw + off;
    const D = full * (spec.bounce ? 0.85 : 1) / Math.cos(off);
    const H = target.y + 0.3 - eye.y;
    const disc = v ** 4 - g * (g * D * D + 2 * H * v * v);
    if (disc < 0 || D < 1) continue;
    for (const elev of [Math.atan((v * v - Math.sqrt(disc)) / (g * D)), Math.atan((v * v + Math.sqrt(disc)) / (g * D))]) {
      if (elev > 1.25) continue;
      let pitch = elev;
      for (let i = 0; i < 4; i++) {
        const d = viewDirection(yaw, pitch);
        pitch += elev - Math.atan2(d.y + THROW_LIFT, hypot(d.x, d.z));
      }
      pitch = Math.max(-1.4, Math.min(1.4, pitch));
      const impact = throwImpact(physics, eye, yaw, pitch, spec);
      if (impact && horizontalDistance(impact, target) <= tolerance && Math.abs(impact.y - target.y) < 0.6) return { yaw, pitch, impact };
    }
  }
  return null;
}
const STUCK_SLOW_TICKS = 90;
const STUCK_WINDOW_TICKS$1 = 150;
const STUCK_MIN_PROGRESS = 2;
const RECOVER_TICKS = 60;
const RECOVER_GRACE_TICKS = 180;
const MAX_RECOVERIES = 3;
const BAIL_HEALTH = 0.3;
const STUCK_AVOID_SECONDS = 30;
const MAX_AVOID_SECONDS = 240;
const BOARD_CHECK_TICKS = 15;
const MAX_BOARD_FAILS = 2;
const avoidSeconds = (times) => Math.min(MAX_AVOID_SECONDS, STUCK_AVOID_SECONDS * 2 ** Math.max(0, times - 1));
const RIDER_STUCK_TICKS = 180;
const RIDER_MIN_PROGRESS = 2;
const ROADKILL_SPEED = 4;
const ROADKILL_LOOKAHEAD = 2.5;
const ROADKILL_HALF_WIDTH = 3;
const ANTI_VEHICLE_SPLASH = 50;
function inBoardingReach(m, feet) {
  return enterReach({ half: m.half ?? [0, 0, 0], enterRadius: m.enterRadius }, m.pos, m.yaw, feet) !== null;
}
function boardingSpot(m, from) {
  const half = m.half;
  if (!half) return m.pos;
  const s = Math.sin(m.yaw);
  const c = Math.cos(m.yaw);
  const dx = from.x - m.pos.x;
  const dz = from.z - m.pos.z;
  const lx = clamp(dx * c - dz * s, -half[0] - 0.7, half[0] + 0.7);
  const lz = clamp(dx * s + dz * c, -half[2] - 0.7, half[2] + 0.7);
  const out = Math.abs(lx) > half[0] || Math.abs(lz) > half[2];
  const ox = out ? lx : Math.abs(lx) / half[0] > Math.abs(lz) / half[2] ? Math.sign(lx || 1) * (half[0] + 0.7) : lx;
  const oz = out ? lz : Math.abs(lx) / half[0] > Math.abs(lz) / half[2] ? lz : Math.sign(lz || 1) * (half[2] + 0.7);
  return { x: m.pos.x + ox * c + oz * s, y: m.pos.y, z: m.pos.z - ox * s + oz * c };
}
const FIT_HALF_HEIGHT = 0.5;
const FIT_LIFT = 1.4;
const FIT_STEP = 2;
const FIT_STEP_UP = 1.2;
const FIT_PROBE = 2.5;
const FIT_SHIFTS = [0, 0.75, -0.75, 1.5, -1.5, 2.5, -2.5];
const FIT_HULL_SLACK = 0.15;
function routeFits(physics, path, halfWidth, skip = 4, upTo = Infinity, hull) {
  const down = { x: 0, y: -1, z: 0 };
  const line = [];
  if (hull) {
    let along2 = 0;
    let prev2 = path[0]?.y ?? 0;
    for (let i = 1; i < path.length && along2 <= upTo + hull.reach; i++) {
      const a = path[i - 1];
      const b = path[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      for (let d = 0; d < len; d += FIT_STEP) {
        const t = d / len;
        const y = Math.max(prev2, a.y + (b.y - a.y) * t) + FIT_PROBE;
        const hit = physics.raycastHit({ x: a.x + (b.x - a.x) * t, y, z: a.z + (b.z - a.z) * t }, down, FIT_PROBE + 4);
        const ground = hit ? y - hit.dist : a.y + (b.y - a.y) * t;
        if (ground <= prev2 + FIT_STEP_UP) prev2 = ground;
        line.push({ along: along2 + d, ground: prev2 });
      }
      along2 += len;
    }
  }
  const highest = (at2, ground) => {
    let top = ground;
    for (const p of line) if (Math.abs(p.along - at2) <= hull.reach) top = Math.max(top, p.ground);
    return top;
  };
  let along = 0;
  let prev = path[0]?.y ?? 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const sx = len > 0 ? (b.z - a.z) / len : 0;
    const sz = len > 0 ? -(b.x - a.x) / len : 0;
    for (let d = 0; d < len; d += FIT_STEP) {
      if (along + d < skip) continue;
      if (along + d > upTo) return true;
      const t = d / len;
      const fits = FIT_SHIFTS.some((k) => {
        const x = a.x + (b.x - a.x) * t + sx * k;
        const z = a.z + (b.z - a.z) * t + sz * k;
        const y = Math.max(prev, a.y + (b.y - a.y) * t) + FIT_PROBE;
        const hit = physics.raycastHit({ x, y, z }, down, FIT_PROBE + 4);
        const ground = hit ? y - hit.dist : a.y + (b.y - a.y) * t;
        if (ground > prev + FIT_STEP_UP) return false;
        const bottom = ground + FIT_LIFT - FIT_HALF_HEIGHT;
        const top = Math.max(bottom + 2 * FIT_HALF_HEIGHT, hull ? highest(along + d, ground) + hull.height - FIT_HULL_SLACK : 0);
        if (!physics.boxClear({ x, y: (bottom + top) / 2, z }, { x: halfWidth, y: (top - bottom) / 2, z: halfWidth })) return false;
        prev = ground;
        return true;
      });
      if (!fits) return false;
    }
    along += len;
  }
  return true;
}
const HULL_STEP = 0.75;
const HULL_LIFT = 0.45;
const HULL_PROBE_LOW = 0.7;
const HULL_SHIFTS = [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2];
function hullFits(physics, path, hull, skip = 4, upTo = Infinity) {
  const down = { x: 0, y: -1, z: 0 };
  const [hx, , hz] = hull.half;
  const ground = (x, y, z) => {
    const low = physics.raycastHit({ x, y: y + HULL_PROBE_LOW, z }, down, HULL_PROBE_LOW + 4);
    if (low && low.dist > 0.01) return y + HULL_PROBE_LOW - low.dist;
    const high = physics.raycastHit({ x, y: y + FIT_PROBE, z }, down, FIT_PROBE + 4);
    return high ? y + FIT_PROBE - high.dist : y;
  };
  const headings = [];
  const lengths = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    lengths.push(Math.hypot(b.x - a.x, b.z - a.z));
    headings.push(Math.atan2(b.x - a.x, b.z - a.z));
  }
  const fitsAt = (x, y, z, yaw, k) => {
    const s = Math.sin(yaw);
    const c = Math.cos(yaw);
    const px = x + c * k;
    const pz = z - s * k;
    const top = Math.max(ground(px, y, pz), ground(px + s * hz, y, pz + c * hz), ground(px - s * hz, y, pz - c * hz));
    const bottom = top + HULL_LIFT;
    const roof = top + hull.height - FIT_HULL_SLACK;
    if (roof <= bottom) return true;
    return physics.boxClear({ x: px, y: (bottom + roof) / 2, z: pz }, { x: hx, y: (roof - bottom) / 2, z: hz }, void 0, false, yaw);
  };
  let open = HULL_SHIFTS.map(() => true);
  let along = 0;
  for (let i = 0; i < lengths.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    const len = lengths[i];
    for (let d = 0; d < len; d += HULL_STEP) {
      if (along + d < skip) continue;
      if (along + d > upTo) return true;
      const t = d / len;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const z = a.z + (b.z - a.z) * t;
      const yaws = [headings[i]];
      if (i > 0 && d < hz) yaws.push(headings[i - 1], midAngle(headings[i - 1], headings[i]));
      if (i + 1 < headings.length && len - d < hz) yaws.push(headings[i + 1], midAngle(headings[i], headings[i + 1]));
      const was = open;
      open = HULL_SHIFTS.map((k, j) => (was[j] || was[j - 1] === true || was[j + 1] === true) && yaws.every((yaw) => fitsAt(x, y, z, yaw, k)));
      if (!open.includes(true)) return false;
    }
    along += len;
  }
  return true;
}
function midAngle(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d / 2;
}
function vehicleRouteFits(physics, m, path, upTo = Infinity) {
  if (!m.routeHalfWidth || !m.half) return true;
  const long = Math.max(m.half[0], m.half[2]);
  const wide = Math.min(m.half[0], m.half[2]);
  const skip = long + wide + 0.5;
  if (!routeFits(physics, path, m.routeHalfWidth, skip, upTo, { height: m.half[1] * 2, reach: long })) return false;
  return hullFits(physics, path, { half: [m.routeHalfWidth, m.half[1], long], height: m.half[1] * 2 }, skip, upTo);
}
function inArc(m, seat, p) {
  const d = horizontalDistance(m.pos, p);
  if (!seat.weapon || d > Math.min(seat.weapon.range, 70)) return false;
  if (seat.arc === void 0) return true;
  const a = Math.atan2(p.x - m.pos.x, p.z - m.pos.z);
  return Math.abs(angleDelta(m.yaw + (seat.facing ?? 0), a)) <= seat.arc * 0.92;
}
function turretFor(mounts, from, enemy, reach2, skip) {
  let best = null;
  let bestD = reach2;
  for (const m of mounts) {
    if (!m.alive || m.kind !== "turret" || m.health < 0.35 || m.hostile || skip?.(m)) continue;
    const seat = m.seats.find((s) => s.role === "gunner" && s.free && s.weapon);
    if (!seat || !inArc(m, seat, enemy)) continue;
    if (horizontalDistance(m.pos, enemy) < 10) continue;
    const d = horizontalDistance(m.pos, from) + Math.abs(m.pos.y - from.y) * 3;
    if (d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}
const TANK_PREFERENCE = 15;
const TANK_DETOUR = 20;
function vehicleFor(mounts, from, goal, reach2, skip) {
  const trip = horizontalDistance(from, goal);
  if (trip < 55) return null;
  let best = null;
  let bestD = Infinity;
  for (const m of mounts) {
    if (!m.alive || m.kind !== "vehicle" || m.health < 0.5 || m.humanNear || m.hostile || m.burning || m.wedged || skip?.(m)) continue;
    const driver = m.seats.find((s) => s.role === "driver");
    if (!driver?.free || m.seats.some((s) => !s.free)) continue;
    const walk = horizontalDistance(m.pos, from) + Math.abs(m.pos.y - from.y) * 3;
    if (walk + horizontalDistance(m.pos, goal) > trip + 15 + (m.sealed ? TANK_DETOUR : 0)) continue;
    const d = walk - (m.sealed ? TANK_PREFERENCE : 0);
    if (walk > reach2 + (m.sealed ? TANK_PREFERENCE : 0)) continue;
    if (d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}
function rideFor(mounts, from, self, allies, reach2, skip) {
  let best = null;
  let bestScore = Infinity;
  for (const m of mounts) {
    if (!m.alive || m.kind !== "vehicle" || m.health < 0.35 || m.hostile || m.burning || m.wedged || skip?.(m)) continue;
    const by = m.seats.find((s) => s.role === "driver")?.by;
    if (by === void 0 || by === self) continue;
    const driver = allies.find((a) => a.slot === by);
    if (!driver) continue;
    const free = m.seats.filter((s) => s.free && s.role !== "driver");
    if (!free.length) continue;
    const d = horizontalDistance(m.pos, from) + Math.abs(m.pos.y - from.y) * 3;
    const speed = m.speed ?? 0;
    if (d > reach2 || speed > 11 && d > 8 || !driver.human && speed > 2 && d > 6) continue;
    const score = d - (driver.human ? 10 : 0) - (free.some((s) => s.role === "gunner") ? 3 : 0);
    if (score < bestScore) {
      best = m;
      bestScore = score;
    }
  }
  return best;
}
const freshDrive = () => ({ slow: 0, reverseUntil: 0, unstick: 0, last: null, anchor: null, anchorTick: 0, stuck: false, tick: -1 });
function steer(st, tick, m, aim, distLeft) {
  const pos = m.pos;
  const err = angleDelta(m.yaw, Math.atan2(aim.x - pos.x, aim.z - pos.z));
  if (st.stuck) return { forward: 0, right: 0 };
  if (tick < st.reverseUntil) {
    st.last = { ...pos };
    st.anchor = null;
    return { forward: -1, right: clamp(-err * 2, -1, 1) };
  }
  if (st.tick !== tick) {
    st.tick = tick;
    const turned = st.lastYaw === void 0 ? 0 : Math.abs(angleDelta(st.lastYaw, m.yaw));
    const moved = (st.last ? horizontalDistance(pos, st.last) : 1) + turned * 2;
    st.last = { ...pos };
    st.lastYaw = m.yaw;
    if (m.pivots && turned > 4e-3) st.anchor = null;
    st.slow = moved < 0.01 ? st.slow + 1 : Math.max(0, st.slow - 2);
    let stuck = st.slow > STUCK_SLOW_TICKS;
    if (!st.anchor) {
      st.anchor = { ...pos };
      st.anchorTick = tick;
    } else if (tick - st.anchorTick >= STUCK_WINDOW_TICKS$1) {
      if (horizontalDistance(pos, st.anchor) < STUCK_MIN_PROGRESS) stuck = true;
      st.anchor = { ...pos };
      st.anchorTick = tick;
    }
    if (stuck) {
      st.slow = 0;
      st.anchor = null;
      if (st.unstick > 0 && tick - st.reverseUntil < RECOVER_GRACE_TICKS || st.unstick >= MAX_RECOVERIES) {
        st.stuck = true;
        return { forward: 0, right: 0 };
      }
      st.unstick++;
      st.reverseUntil = tick + RECOVER_TICKS;
      return { forward: -1, right: clamp(-err * 2, -1, 1) };
    }
  }
  const right = clamp(err * 2.2, -1, 1);
  let forward = Math.abs(err) > 1.4 ? m.pivots ? 0 : 0.35 : Math.abs(err) > 0.7 ? 0.6 : 1;
  if (distLeft < 25) forward = Math.min(forward, 0.5);
  return { forward, right };
}
const aboutToBlow = (m) => m.health < (m.bailHealth ?? BAIL_HEALTH) || !!m.burning;
function noHeadway(h, pos, tick, window, min) {
  if (!h.pos) {
    h.pos = { ...pos };
    h.tick = tick;
    return false;
  }
  if (tick - h.tick < window) return false;
  const stuck = horizontalDistance(pos, h.pos) < min;
  h.pos = { ...pos };
  h.tick = tick;
  return stuck;
}
function mountOf(mounts, slot) {
  for (const m of mounts) {
    if (!m.alive) continue;
    for (let i = 0; i < m.seats.length; i++) if (m.seats[i].by === slot) return { mount: m, seat: i };
  }
  return null;
}
const antiVehicle = (def) => (def.vehicleDamage ?? 1) > 1 || (def.projectile?.splashDamage ?? 0) >= ANTI_VEHICLE_SPLASH;
function inVehiclePath(m, p) {
  const speed = m.speed ?? 0;
  if (!m.alive || m.kind !== "vehicle" || speed < ROADKILL_SPEED || Math.abs(p.y - m.pos.y) > 3) return null;
  const dir = m.reversing ? -1 : 1;
  const fx = Math.sin(m.yaw) * dir;
  const fz = Math.cos(m.yaw) * dir;
  const dx = p.x - m.pos.x;
  const dz = p.z - m.pos.z;
  const along = dx * fx + dz * fz;
  if (along < 0 || along > speed * ROADKILL_LOOKAHEAD + 3) return null;
  const lateral = dx * fz - dz * fx;
  if (Math.abs(lateral) > ROADKILL_HALF_WIDTH) return null;
  const side = lateral >= 0 ? 1 : -1;
  return { eta: along / speed, side, away: Math.atan2(side * fz, -side * fx) };
}
const SIGHT_RANGE = 60;
const SCOPE_SIGHT = 120;
const SCOPE_COS = Math.cos(30 * Math.PI / 180);
const HEARING_RANGE = 6;
const CONCEAL_SPOT = 4;
const CONCEAL_TRACK = 9;
const FOV_COS = Math.cos(110 / 2 * (Math.PI / 180));
const STUCK_WINDOW_TICKS = TICK_RATE;
const PATH_REFRESH_TICKS = TICK_RATE / 2;
const SIDEARM = 0.4;
function pathLength(route) {
  let len = 0;
  for (let i = 1; i < route.length; i++) len += horizontalDistance(route[i - 1], route[i]);
  return len;
}
const VEHICLE_TRIP = 55;
const GUN_DETOUR = 30;
const BOUND_FROM = 12;
const BOUND_MIXED = 18;
const COVER_FIRE_SECONDS = 2.5;
const SCOPE_DETOUR = 70;
const SPOTTED_FACING = 0.9;
const RIDE_PARKED_SECONDS = 8;
const BAIL_SPEED = 3;
const DRIVE_PROGRESS_SECONDS = 12;
const DRIVE_MIN_PROGRESS = 10;
const TANK_STANDOFF = 28;
const TANK_TOO_CLOSE = 10;
const SHELL_MIN_RANGE = 10;
const SHELL_RESERVE = 0.3;
const AMMO_DETOUR = 120;
const AMMO_LOW_SHARE = 0.3;
const AMMO_LOW_DETOUR = 70;
const SHELTERED_TARGET_SCALE = 3;
const SHIELDED_TARGET_SCALE = 6;
const SHIELD_FIRE_BEFORE = MATCH_PLAY.botFireBefore;
const SHIELD_HOLD_INSIDE = 2;
const RIDE_DUCK = TICK_RATE * 1.5;
const RIDE_DUCK_UP = TICK_RATE * 0.4;
const NO_FIT_SECONDS = 20;
const FIT_AHEAD = 80;
const EXIT_GROUND_WAIT = 8;
const PICKUP_GIVE_UP_SECONDS = 90;
const RIDE_REACH = 25;
const LAUNCHER_DETOUR = 30;
const ARMOUR_ALERT_RANGE = 60;
const ARMOUR_LAUNCHER_DETOUR = 60;
const ARMOUR_PICKUP_BOOST = 3;
const LANE_FROM = 50;
const ROUTE_FROM = 25;
const STAGE_RADIUS = 6;
const LIFT_PATIENCE = 6;
const VEHICLE_MEMORY = 12;
const ANTI_VEHICLE_BONUS = 1.2;
const DODGE_SECONDS = 0.8;
const DODGE_SPRINT_ETA = 1.2;
const STEP_OFF = 2.2;
const CORNER_RADIUS = 0.45;
const SEPARATE_MAX = 0.8;
const HULL_LOOK_TICKS = 6;
const ONCOMING = 4;
const PASS_RADIUS = 1.4;
const DECIDE_TICKS = 6;
const STANCE_SIGHT = [1, 0.8, 0.55];
const SIGHT_SEARCH = 16;
const SIGHT_TRACK = 6;
const CLEAR_MARGIN = 1.5;
const SUPPRESS_MARGIN = 3;
const CLEAR_UNDER = 0.012;
const CLEAR_TTL = 3;
const BLOCKED_HOLD = 3;
const SUPPRESS_SECONDS = 1.5;
const TRACK_UNCHECKED_TICKS = TICK_RATE / 2;
const byScore = (a, b) => a.score - b.score || a.o.slot - b.o.slot;
const slotSets = /* @__PURE__ */ new WeakMap();
function slotsOf(list2) {
  let set = slotSets.get(list2);
  if (!set) slotSets.set(list2, set = new Set(list2.map((o) => o.slot)));
  return set;
}
const OPTION_NAMES = ["goal", "roam", "cover", "retreat", "pickup", "chase", "noise", "fight", "post"];
class BotBrain {
  constructor(slot, profile, difficulty, seed) {
    this.slot = slot;
    this.difficulty = difficulty;
    this.profile = profile;
    this.baseProfile = profile;
    this.rng = createRng(seed * 7919 + slot);
    this.routeRng = createRng(seed * 104729 + slot * 7919 + 17 >>> 0);
    this.skillRng = createRng(seed * 15485863 + slot * 31337 + 101 >>> 0);
    this.aim = new AimModel(this.rng, difficulty, profile);
    this.clearCheck = () => this.clearShot();
    this.choice = { me: { x: 0, y: 0, z: 0 }, goal: null, profile, hurt: false, lowAmmo: false, cover: false, retreating: false, pickup: -Infinity, post: -Infinity, lost: null, noise: null, posted: false };
  }
  slot;
  difficulty;
  state = "roam";
  /** Current path corners, exposed for the debug overlay. */
  path = [];
  /** Destination of the current path. */
  goal = null;
  stuckCount = 0;
  /** What it did on its last think (measuring: BotDoing), and whether it meant to move then. */
  doing = "roam";
  meantToMove = false;
  /** Route searches that found no way there (measuring). */
  pathFailures = 0;
  /** Route searches for where it was going (followPathNow; measuring), found or not. */
  pathSearches = 0;
  /** The last search that found no way (measuring: the scorecard's failed-search spots): from where, to where. */
  lastNoRoute = null;
  /** Route requests for a goal no route reaches, answered with a stand-in as near it as a route gets (measuring). */
  standIns = 0;
  /**
   * The goal it last asked for can't be reached from where it is (NavWorld.standIn): where it heads instead, as
   * near the goal as a route gets. Null when the route is to the goal itself.
   */
  standIn = null;
  /** The last followPathTo found no route (or was backing off asking again) rather than arriving. */
  pathMiss = false;
  /** The pickup it last set out for (the same object as roamGoal while it still goes for it). */
  pickupAt = null;
  /** Keeping watch on station (keepWatch): the place it stands, until when, and the way it faces. */
  watch = null;
  /** In a seat at the last think (the transport plane, a flyer), and out of one in the air with no canopy yet. */
  seated = false;
  bailedOut = false;
  /** Where its order goal was at the last think (does it move?). */
  lastOrder = { x: 1e9, y: 0, z: 1e9 };
  /** Getting off a cut-off patch of navmesh (planEscape): the place across, the goal it is for, until when it tries. */
  escape = null;
  /** Places across it tried and couldn't get to, left alone for a while. */
  failedCrossings = [];
  /**
   * On a parkour link of its route (nav/parkour.ts: a drop, a gap jump, a jump up): the link, the route and corner it
   * was found at, when it started on it, and when it jumped (-1: not yet) or went over the edge (a drop).
   */
  link = null;
  /** Going round a still hull (hulls.ts): the corner, till when it stands before a fresh look, and the side kept for that hull. */
  hullPass = null;
  hullSide = null;
  /** No still hull in the way: not looked for again till this tick. */
  hullFreeUntil = 0;
  /** Hulls walked round (bot-report). */
  hullDetours = 0;
  /** Parkour moves it made, by kind, and gave up on (measuring: bot-report). */
  parkourDone = { drop: 0, gap: 0, up: 0 };
  parkourGaveUp = 0;
  /** The link it was last on and since when (kept between routes: watchLink). */
  linkClock = null;
  /** The navmesh's goneVersion its route was planned against. */
  goneSeen = 0;
  parkourMissed = 0;
  /** On a parkour link (the match has it think every tick until it lands: the jump is timed to the tick). */
  get parkouring() {
    return this.link !== null;
  }
  /** Last hop on a crossing. */
  hopAt = -Infinity;
  /** The hop across (planEscape) is up a ledge higher than a jump clears: the legs tuck up in the air till it lands. */
  tuckHop = false;
  /** The way it takes to a far objective (orderTarget): the goal it was picked for and the waypoint (null: straight). */
  lane = null;
  /** Side-lane trips that took a corridor of the side's trip by its vias (orderTarget; bot-report). */
  laneCorridors = 0;
  /**
   * Route variety: the corridor it goes by to a far goal (its group's, its squad's, or the cheapest of its side's trip:
   * teamBrain.ts), the goal it is for, whether it has been by the corridor's via yet, and when it last went by it.
   */
  route = null;
  /** A corridor picked with its roaming goal (toward the enemy's side), for that goal only. */
  roamRoute = null;
  /** A few steps aside after getting stuck on the same spot again and again (planSidestep). */
  sidestep = null;
  /** Waiting for a lift since (-1: not waiting), and until when routes keep off lifts after waiting too long. */
  liftWaitSince = -1;
  offLiftsUntil = -Infinity;
  seq = 0;
  rng;
  aim;
  memory = new MapMemory();
  /**
   * What it remembers of its enemies (Phase D item 1, memory.ts): where each was seen, where shots came from, noises
   * and teammates' callouts, for its skill's `memorySeconds`. Kept across lives (a player remembers where they died).
   */
  enemies = new EnemyMemory();
  /** Its skill tier's choices (reaction spread, decision noise, scan dwell): a stream of its own, so the others stay as they were. */
  skillRng;
  /** When it has reacted to each enemy in sight (the tick: its skill's reaction for that sighting; reactAfter). */
  reactAt = /* @__PURE__ */ new Map();
  /** The last tick it read its side's callouts. */
  calloutsRead = -1;
  targetSlot = null;
  visibleSince = /* @__PURE__ */ new Map();
  /** Last tick each enemy in visibleSince was confirmed in sight. */
  confirmed = /* @__PURE__ */ new Map();
  /** Last tick each enemy was a candidate that perception did not cast a ray to. */
  unchecked = /* @__PURE__ */ new Map();
  /** Scratch for perception (no allocations per look). */
  pool = [];
  live = [];
  eyeAt = { x: 0, y: 0, z: 0 };
  eyeTo = { x: 0, y: 0, z: 0 };
  /** Scratch for grid queries (perception, keeping apart). */
  nearScratch = [];
  /** Last tick perception ran (a steering tick may have run it before a full think). */
  lastPerceiveTick = -1;
  lastKnown = null;
  /** A noise worth checking out. */
  heard = null;
  /** A gun close enough to fetch before going on (set while deciding). */
  gunNearby = null;
  /** A noise or sighting we couldn't get to: noises near it are ignored for a while. */
  unreachable = null;
  /** Closest we have come to the current chase/investigate goal, and when. */
  headway = null;
  pathIndex = 0;
  /** Came out of a portal since the path was last followed: the portal leg is done. */
  portalled = false;
  roamGoal = null;
  via = null;
  lastPathTick = -Infinity;
  /** The last goal no path led to, from where, and until when not to ask again (doubling with each failure in a row). */
  noPath = null;
  pathFails = 0;
  strafeDir = 1;
  nextStrafeFlip = 0;
  /** When the current strafe run started, and the last tick spent strafing. */
  strafeStart = -Infinity;
  lastStrafeTick = -Infinity;
  /** Strafing (with hysteresis on the distance band). */
  strafing = false;
  /** Fighting in the open: closing in, holding, or backing off (with hysteresis on the range). */
  spacing = "hold";
  /** Where a retreat is headed, kept for a while so the bot runs one way. */
  retreatGoal = null;
  /** Retreating: sprint away (run) or back off shooting, committed for a moment. */
  retreatMode = null;
  /** Smoothed movement intent in world space (inputs ease in and out rather than snapping). */
  moveX = 0;
  moveZ = 0;
  nextHop = 0;
  yaw = 0;
  pitch = 0;
  stuckCheck = null;
  /**
   * The route goes under a low roof (NavWorld.lastLow: a tall body with no way round, or a goal under one): it crouches
   * where there's no room to stand (mustDuck). Off on every other route, so a tall body never ducks on its way
   * anywhere a way round exists.
   */
  lowRoute = false;
  /** Ducking under something too low for its body, until then (mustDuck). */
  duckUntil = -Infinity;
  /** Ticks this bot spent ducking under a low roof (measuring: how rare the fallback is). */
  duckTicks = 0;
  jumpNext = false;
  lastPos = null;
  /** The tick of the previous think (big matches skip some ticks for bots with nobody to fight). */
  lastThinkTick = 0;
  speed = 0;
  lastHealth = 100;
  hurtTick = -Infinity;
  /** When it last fired from a seat (thinkMounted: a rider who ducks stays up while shooting). */
  rideFiredTick = -Infinity;
  underFireTick = -Infinity;
  threatFrom = null;
  // Cover and peeking.
  cover = null;
  nextCoverSearch = 0;
  peekPhase = "hide";
  phaseUntil = 0;
  peeks = 0;
  // Corners and rooms.
  pie = null;
  /** After a corner check: sweep the room once through (points empty until past the corner). */
  clearing = null;
  checked = /* @__PURE__ */ new Map();
  scanUntil = 0;
  scanYaw = 0;
  // Grenades.
  throwPlan = null;
  nextThrow = 0;
  // Turrets and vehicles.
  /** The mount it is going for; `spot`: where it walks to board (just off the hull), worked out where the mount stood at `spotOf`. */
  mountPlan = null;
  /** Riding with a teammate: when the driver left (or the vehicle stopped), and how long before getting out. */
  rideIdleSince = -Infinity;
  noDriverSince = -Infinity;
  bailDelay = 0;
  drive = freshDrive();
  mountedSince = 0;
  lastTargetTick = -Infinity;
  useLatch = false;
  lastUseTick = -Infinity;
  /** Vehicles (by mount index) this bot got stuck in, and until when it leaves them alone. */
  avoidMounts = /* @__PURE__ */ new Map();
  /** How many times it has given up on each mount (by index): each time it leaves it alone twice as long (avoidSeconds). */
  giveUps = /* @__PURE__ */ new Map();
  /** Use pressed beside the mount it was going for (and when): still not in it BOARD_CHECK_TICKS later, that boarding failed. */
  boardTry = null;
  /** Failed boardings per mount since it last got in one: at MAX_BOARD_FAILS it gives up on that one. */
  boardFails = /* @__PURE__ */ new Map();
  /** Boardings so far (bot-report): use pressed for a planned mount, those that failed, mounts given up on, and plans for one it had given up on before (`back`). */
  boarding = { tries: 0, failed: 0, gaveUp: 0, back: 0 };
  /**
   * At the wheel of a sealed vehicle (a tank; bot-report): drives taken, back-outs (stuck recoveries), drives given up
   * as stuck, bail-outs with it about to blow, and drives to an ammo pickup for shells.
   */
  tankLog = { drives: 0, backOuts: 0, stuck: 0, bails: 0, resupply: 0, stuckAt: [] };
  tankUnstick = 0;
  tankResupply = false;
  /** Ammo pickups (by "x,z") a vehicle's route didn't fit, till the tick given (resupplyFor passes them over). */
  ammoSkip = /* @__PURE__ */ new Map();
  skipMount = (m) => (this.avoidMounts.get(m.index) ?? -Infinity) > this.lastThinkTick;
  /** Riding with a bot at the wheel: is it getting anywhere? */
  riderHeadway = { pos: null, tick: 0 };
  /** Driving: how far the route still was when the current progress window opened, and when. */
  driveLeft = { left: Infinity, tick: 0 };
  /** The target's mount, when it is in one (refreshed each think). */
  targetMount = null;
  /** Last tick an enemy in a vehicle was in sight (launchers are worth fetching for a while after). */
  vehicleSeenTick = -Infinity;
  /** Last tick an enemy-crewed armoured vehicle (a tank) was about (watchArmour), and which. */
  armourSeenTick = -Infinity;
  armourMount = null;
  /** Getting out of an enemy vehicle's way: which way, until when, and whether to sprint. */
  dodge = null;
  /** The vehicle bearing down (mount index), when it was first noticed, and whether this bot reacts to it at all this time. */
  roadkill = null;
  /** Going to press a button that opens a door in the way. */
  pressPlan = null;
  pressedAt = -Infinity;
  /** The door the last press was for, and doors whose buttons didn't open them for us (left alone a while). */
  pressedDoor = null;
  noPress = [];
  /** Waiting for or riding a lift: stand still this tick. */
  holdStill = false;
  /** Standing where a zipline on the route is grabbed: press E this tick. */
  zipPress = false;
  /** Last tick's act was aiming and shooting at the target (nothing else on): steer() can stand in for a think. */
  steerable = false;
  /** Route variety and roles (seeded per bot): a stream of its own, so the bot's other choices stay as they were. */
  routeRng;
  /**
   * Holding a vantage spot (camper and sniper roles, director.ts): which spot,
   * when it got there (-1: on the way), how long it holds once there, until when.
   */
  post = null;
  /**
   * How much its routes keep out of open ground (NavWorld.findPath `open`; Phase B item 6): Tactical bots the most,
   * Arena bots not at all, the rest a little.
   */
  get coverRoutes() {
    return this.arena ? 0 : this.methodical ? 2 : 1;
  }
  /** Bounding (boundPhase): this half moving from cover to cover, or covering; null when not bounding. */
  bound = null;
  /**
   * Covering fire (Fireteams Part 2): a squad's covering half keeps firing at where its enemy went out of sight, from
   * its cover, while the other half moves, until this tick; and the ticks it fired so (measuring).
   */
  coverFireUntil = -1;
  coverShots = 0;
  /** Where its last vantage spot was (a sniper moves on somewhere else, not back the way it came). */
  prevSpot = null;
  /** Snipers: shots held for a better one, and spots left after a shot or two or for being spotted (measuring). */
  heldShots = 0;
  relocations = 0;
  nextPost = 0;
  lastSpot = -1;
  /** Recent stuck recoveries (when and where), to notice being stuck in a loop. */
  stuckLog = [];
  /** Times it gave up on a goal it kept getting stuck on (debug and bench). */
  stuckLoops = 0;
  /** A goal it kept getting stuck on: left alone until then. */
  avoid = null;
  /**
   * Pickups this bot got stuck going for (stuck three times by the same spot): left alone for
   * PICKUP_GIVE_UP_SECONDS, across respawns (a bot spawns by the same unreachable item again). Without it the
   * pickup check every 2 s sent it straight back, and whole squads stood at their spawn walking into a wall.
   */
  lostPickups = [];
  /** The squad goal last taken on (a new one replaces the bot's own goal). */
  squadGoal = null;
  /** Catching up with its squad's leader. */
  regrouping = false;
  /** The personality it plays now (playAs: Roulette's body each life), and the one it was made with. */
  profile;
  baseProfile;
  /**
   * Play another personality from now (Roulette: the body dealt this life; docs/BOT_AI_PLAN.md Phase B, "bots play to
   * their body"): its choices, ranges and tags. Its aim stays its own.
   */
  playAs(profile) {
    this.profile = profile;
    this.choice.profile = profile;
  }
  /** Enemy currently targeted (actor ID), if any. */
  get target() {
    return this.targetSlot;
  }
  /** Where an enemy was last seen, and when. */
  get lastSeen() {
    return this.lastKnown;
  }
  /** The cover spot the bot is using, if any (debug and tests). */
  get coverSpot() {
    return this.cover;
  }
  /** A squadmate saw an enemy here: go and look, unless already fighting. */
  alert(pos, tick) {
    if (this.targetSlot !== null) return;
    if (this.lastKnown && this.lastKnown.tick >= tick) return;
    this.lastKnown = { pos: { ...pos }, tick };
  }
  /** Reset per-life memory when the bot respawns. */
  /** Under spawn protection and holding fire (until SHIELD_FIRE_BEFORE s before it runs out), unless an unshielded enemy is right on top of it. */
  holdingForShield(me, target, tick) {
    return !!me.shielded && (me.shieldUntil ?? 0) - tick > SHIELD_FIRE_BEFORE * TICK_RATE && !(target && !target.shielded && horizontalDistance(me.pos, target.pos) < SHIELD_HOLD_INSIDE);
  }
  onSpawn(yaw) {
    this.yaw = yaw;
    this.pitch = 0;
    this.targetSlot = null;
    this.portalled = false;
    this.visibleSince.clear();
    this.reactAt.clear();
    this.confirmed.clear();
    this.unchecked.clear();
    this.lastKnown = null;
    this.heard = null;
    this.unreachable = null;
    this.noPath = null;
    this.pathFails = 0;
    this.headway = null;
    this.path = [];
    this.goal = null;
    this.roamGoal = null;
    this.via = null;
    this.stuckCheck = null;
    this.cover = null;
    this.pie = null;
    this.clearing = null;
    this.checked.clear();
    this.throwPlan = null;
    this.mountPlan = null;
    this.memory.clear();
    this.aim.reset();
    this.lastPos = null;
    this.lastHealth = 100;
    this.hurtTick = this.underFireTick = -Infinity;
    this.retreatGoal = null;
    this.retreatMode = null;
    this.lowRoute = false;
    this.duckUntil = -Infinity;
    this.link = null;
    this.hullPass = null;
    this.hullSide = null;
    this.linkClock = null;
    this.spacing = "hold";
    this.strafing = false;
    this.moveX = this.moveZ = 0;
    this.steerable = false;
    if (this.post) this.post.board.release(this.post.spot, this.slot);
    this.post = null;
    this.stuckLog.length = 0;
    this.avoid = null;
    this.squadGoal = null;
    this.regrouping = false;
    this.watch = null;
    this.escape = null;
    this.lane = null;
    this.sidestep = null;
    this.route = null;
    this.roamRoute = null;
    this.pickCand = null;
  }
  /** It killed someone: a sniper moves on to another spot soon after (they know where the shot came from). */
  onKill(tick) {
    const p = this.post;
    if (p?.kind === "sniper" && p.arrived >= 0) p.until = Math.min(p.until, tick + Math.round(TICK_RATE * (0.6 + this.routeRng() * 0.8)));
  }
  /**
   * What the in-game bot debug view shows of it (`?botdebug=1`, debugView.ts; Phase D item 4): its state, what it did on
   * its last think and whether it meant to move (why it stood still), its goal and the rest of its route, the scored
   * choices it weighed, what it remembers, its scan, its vantage spot and the last search that found no way.
   */
  debugInfo() {
    const scores = {};
    for (let i = 0; i < OPTIONS; i++) if (this.scores[i] > -Infinity) scores[OPTION_NAMES[i]] = Math.round(this.scores[i] * 100) / 100;
    const w = this.watch;
    return {
      state: this.state,
      doing: this.doing,
      moving: this.meantToMove,
      option: this.option >= 0 ? OPTION_NAMES[this.option] : null,
      scores,
      goal: this.goal ? { ...this.goal } : null,
      standIn: this.standIn ? { ...this.standIn } : null,
      path: this.path.slice(this.pathIndex, this.pathIndex + 32).map((p) => ({ ...p })),
      target: this.targetSlot,
      memory: this.enemies.spots.map((e) => ({ slot: e.slot, pos: { ...e.pos }, tick: e.tick, source: e.source })),
      watch: w ? { spot: { ...w.spot }, looks: [...w.looks], peek: w.peek ? { ...w.peek } : null } : null,
      vantage: this.vantage,
      noRoute: this.lastNoRoute ? { from: { ...this.lastNoRoute.from }, goal: { ...this.lastNoRoute.goal } } : null,
      failures: this.pathFailures,
      stuck: this.stuckCount,
      skill: this.difficulty.id
    };
  }
  /** Holding (or heading for) a vantage spot: its kind and position (debug and tests). */
  get vantage() {
    const p = this.post;
    return p ? { kind: p.kind, pos: p.board.spots[p.spot].pos, arrived: p.arrived >= 0, parkour: !!p.board.spots[p.spot].parkour } : null;
  }
  // ------------------------------------------------------------------ main loop
  think(view) {
    const seq = ++this.seq;
    const me = view.self;
    this.steerable = false;
    if (!me.alive) {
      this.state = "dead";
      this.doing = "dead";
      this.meantToMove = false;
      return { seq, forward: 0, right: 0, yaw: this.yaw, pitch: this.pitch, buttons: 0 };
    }
    const ticks = Math.max(1, Math.min(4, view.tick - this.lastThinkTick));
    this.lastThinkTick = view.tick;
    this.speed = this.lastPos ? Math.min(20, horizontalDistance(me.pos, this.lastPos) / (TICK_DT * ticks)) : 0;
    this.lastPos = { ...me.pos };
    if (me.health < this.lastHealth) this.hurtTick = view.tick;
    this.lastHealth = me.health;
    if (view.shotAt && view.tick - view.shotAt.tick <= 1) {
      this.underFireTick = view.shotAt.tick;
      this.threatFrom = { x: view.shotAt.from.x, y: view.shotAt.from.y - PLAYER.eyeHeight, z: view.shotAt.from.z };
      this.enemies.note(-1, this.threatFrom, view.tick, "shot");
    }
    const interval = this.difficulty.perceptionIntervalTicks;
    if ((view.tick + this.slot) % interval === 0 && this.lastPerceiveTick !== view.tick) this.perceive(view);
    const target = this.targetSlot === null ? void 0 : view.others.find((o) => o.slot === this.targetSlot && o.alive);
    if (this.targetSlot !== null && !target) this.targetSlot = null;
    if (target) this.lastTargetTick = view.tick;
    this.targetMount = target?.mounted && view.mounts ? mountOf(view.mounts, target.slot)?.mount ?? null : null;
    if (this.targetMount?.kind === "vehicle") this.vehicleSeenTick = view.tick;
    const ctx = this.aimContext(view);
    const ta = simProfile.on ? performance.now() : 0;
    this.aim.track(ctx, target ? { slot: target.slot, pos: this.aimPos(view.seat?.weapon ?? ctx.weapon, target), stance: target.stance } : null);
    if (simProfile.on) simProfile.add("botAim", performance.now() - ta);
    if (view.seat) this.seated = true;
    else if (this.seated) {
      this.seated = false;
      this.bailedOut = me.grounded === false;
    }
    if (me.grounded !== false || me.chute || me.climbing) this.bailedOut = false;
    if (view.seat) {
      this.doing = "mounted";
      this.meantToMove = false;
      return this.thinkMounted(view, seq, target, ctx);
    }
    this.useLatch = false;
    const tried = this.boardTry;
    if (tried && view.tick - tried.tick >= BOARD_CHECK_TICKS) {
      this.boardTry = null;
      this.boarding.failed++;
      const n = (this.boardFails.get(tried.index) ?? 0) + 1;
      this.boardFails.set(tried.index, n);
      if (n >= MAX_BOARD_FAILS) {
        this.giveUpOn(tried.index, view.tick);
        if (this.mountPlan?.index === tried.index) this.mountPlan = null;
      }
    }
    if (this.mountPlan && view.tick >= this.mountPlan.until) {
      if (!this.mountPlan.ride) this.giveUpOn(this.mountPlan.index, view.tick);
      this.mountPlan = null;
    }
    if ((view.tick + this.slot) % DECIDE_TICKS === 0) this.decide(view, target);
    if (this.state === "chase" && !this.lastKnown || this.state === "investigate" && !this.heard || this.state === "hold" && !view.orderGoal || this.state === "dead" || this.state === "mounted") this.state = "advance";
    if (this.state === "mount" && !this.mountPlan) this.state = "advance";
    return this.act(view, seq, target, ctx);
  }
  aimContext(view) {
    const me = view.self;
    const stance = me.stance ?? 0;
    const def = this.heldDef(view);
    return {
      tick: view.tick,
      // Where its rounds start: the sim fires from the eye, which scales with body size.
      eye: { x: me.pos.x, y: me.pos.y + STANCES[stance].eye * (me.size ?? 1), z: me.pos.z },
      speed: this.speed,
      airborne: false,
      stance,
      steady: !!(def?.view.zoomFov && !def.alt),
      weapon: def
    };
  }
  heldDef(view) {
    return this.heldWeapon(view)?.def;
  }
  /** Low on health by this bot's standards. */
  hurt(view) {
    return view.self.health < this.profile.selfPreservation / 100 * PLAYER.maxHealth * (this.coward ? 0.8 : 0.6);
  }
  /** COWARD: gives up a fight sooner, and won't take on several at once. */
  get coward() {
    return hasTag(this.profile, "COWARD");
  }
  /** A coward who has been hurt and can see three or more enemies backs off (shooting). */
  outnumbered() {
    return this.coward && this.visibleSince.size >= 3 && this.lastHealth < PLAYER.maxHealth * 0.85;
  }
  /** On its vantage spot and holding it. */
  posted(me) {
    const p = this.post;
    return !!p && p.arrived >= 0 && horizontalDistance(me, p.board.spots[p.spot].pos) < 1.6;
  }
  /** Done with the vantage spot (time up, flushed out, no way there): roam for a while before the next. */
  leavePost(tick, cooldownSeconds) {
    const p = this.post;
    if (!p) return;
    p.board.release(p.spot, this.slot);
    this.prevSpot = { ...p.board.spots[p.spot].pos };
    this.post = null;
    this.nextPost = tick + Math.round(TICK_RATE * cooldownSeconds);
    this.roamGoal = null;
    this.via = null;
  }
  /** How long a camper or sniper rests between spots (s): campers roam a good while (fun over camping), snipers relocate. */
  postCooldown(kind) {
    if (kind === "sniper") return 4 + this.routeRng() * 6;
    return (this.arena ? 60 : this.methodical ? 35 : 45) + this.routeRng() * 30;
  }
  /**
   * Cover-to-cover advance (BOT_AI_PLAN.md Phase B item 6): a bot on its way to an objective (a goal to keep to, not a
   * carrier's run) in a fight at range bounds by its style: Tactical always, Mixed when the fight is BOUND_MIXED m or
   * further, Arena never (it keeps the rush; so do berserkers). Half the bots cover while half move, on a shared clock
   * by slot (odd and even), so teammates near each other take turns without anyone arranging it: 'cover' holds cover
   * facing the threat (peeking and shooting, not running at it), 'move' leaves it for cover further on, or advances in
   * the open shooting when there's none. Null: not bounding.
   */
  boundPhase(view, target, goal) {
    const squadHalf2 = goal?.half;
    if (!target || !goal || !(goal.push || squadHalf2 !== void 0 && goal.order) || goal.run || this.arena || this.berserker || view.self.mounted) return null;
    const dist = horizontalDistance(view.self.pos, target.pos);
    const all = !!view.plan?.job?.bound;
    if (dist < BOUND_FROM || !this.methodical && !all && dist < BOUND_MIXED) return null;
    const period = TICK_RATE * (this.methodical ? 3.5 : 4.5);
    if (squadHalf2 !== void 0) return (Math.floor(view.tick / (TICK_RATE * 4)) + squadHalf2) % 2 === 0 ? "move" : "cover";
    return (Math.floor(view.tick / period) + this.slot) % 2 === 0 ? "move" : "cover";
  }
  /** On its sniper spot with its scoped gun in hand. */
  sniping(view, def) {
    const p = this.post;
    return !!p && p.kind === "sniper" && !!def?.view.zoomFov && !def.alt && this.posted(view.self.pos);
  }
  /** A shot from its sniper spot: after its share of them (one, or two for the bold), it moves on. */
  sniperShot(tick) {
    const p = this.post;
    if (!p || ++p.shots < shotsPerSpot(this.profile)) return;
    this.relocate(tick, 0.4 + this.routeRng() * 0.6);
  }
  /** Leave the sniper spot in `seconds` for another one somewhere else soon after (counted once a spot). */
  relocate(tick, seconds) {
    const p = this.post;
    if (!p || p.moving) return;
    p.moving = true;
    p.until = Math.min(p.until, tick + Math.round(TICK_RATE * seconds));
    this.relocations++;
  }
  /** A scoped gun with rounds in it. */
  hasScope(view) {
    for (const w of view.inventory) if (w.def.view.zoomFov && !w.def.alt && (w.def.magazine === 0 || w.mag + w.reserve > 0)) return true;
    return false;
  }
  /**
   * Camper and sniper roles, out of a fight with nowhere it was sent: take up
   * a free vantage spot (a camp spot with cover; a sniper spot with a long
   * view, only with a scoped gun) for a limited time. Team modes prefer spots
   * between the bases (not deep in its own, not in the enemy's).
   */
  considerPost(view) {
    const plan = view.plan;
    const board = plan?.vantage;
    const tick = view.tick;
    const g = view.orderGoal ?? null;
    if (!board || this.post || tick < this.nextPost) return;
    if (plan.role !== "camper" && plan.role !== "sniper") return;
    const kind = plan.role === "camper" ? "camp" : "sniper";
    if (g && (kind !== "sniper" || !holdsPost(g))) return;
    if (kind === "sniper" && !this.hasScope(view)) {
      this.nextPost = tick + TICK_RATE * 5;
      return;
    }
    const towards = plan.towards;
    const away = kind === "sniper" ? relocatePrefer(view.self.pos, this.prevSpot) : null;
    const eye = (p) => ({ x: p.x, y: p.y + 1.5, z: p.z });
    const prefer = (p) => {
      let v = away ? away(p) : 0;
      if (g) {
        const d = horizontalDistance(p, g.pos);
        v += d > 75 ? -3 : view.physics.lineOfSight(eye(p), eye(g.pos)) ? 1 : -0.5;
      } else if (towards?.length) {
        let near2 = Infinity;
        for (const t of towards) near2 = Math.min(near2, horizontalDistance(t, p));
        v += near2 < 35 ? -2 : near2 < 130 ? 0.4 : 0;
      }
      return v;
    };
    const i = board.pick(kind, view.self.pos, tick, kind === "sniper" ? 110 : 75, this.routeRng, prefer, this.lastSpot, plan.side);
    if (i < 0) {
      this.nextPost = tick + TICK_RATE * 8;
      return;
    }
    const hold = kind === "sniper" ? 25 + this.routeRng() * 25 : this.arena ? 10 + this.routeRng() * 8 : this.methodical ? 25 + this.routeRng() * 20 : 18 + this.routeRng() * 17;
    this.post = { board, spot: i, kind, arrived: -1, hold: Math.round(TICK_RATE * hold), until: tick + TICK_RATE * 40, shots: 0, moving: false };
    board.claim(i, this.slot, this.post.until);
    this.lastSpot = i;
  }
  /**
   * Going to or holding a vantage spot: get there, then stay on it (crouched,
   * or prone for a sniper with a scope) watching its sightline with a slow
   * sweep. Null when the post is over (time up, no way there).
   */
  actPost(view) {
    const p = this.post;
    const spot2 = p.board.spots[p.spot];
    const me = view.self.pos;
    const tick = view.tick;
    if (tick >= p.until) {
      this.leavePost(tick, this.postCooldown(p.kind));
      return null;
    }
    const d = horizontalDistance(me, spot2.pos);
    if (p.arrived < 0) {
      if (d < 1.2 && Math.abs(me.y - spot2.pos.y) < 1.5) {
        p.arrived = tick;
        p.until = tick + p.hold;
        p.board.claim(p.spot, this.slot, p.until);
      } else {
        const moveYaw = this.followPathTo(view, spot2.pos, false);
        if (moveYaw === null) {
          p.board.unreachable(p.spot, this.slot, tick, TICK_RATE * 120);
          this.post = null;
          this.nextPost = tick + TICK_RATE * 3;
          return null;
        }
        return { moveYaw, stance: 0, moveScale: 1 };
      }
    }
    const sweep = Math.sin((tick + this.slot * 53) / (p.kind === "sniper" ? 90 : 55)) * (p.kind === "sniper" ? 0.35 : 0.7);
    const m = this.remembered(view, p.kind === "sniper" ? 110 : 60);
    const toM = m ? Math.atan2(m.pos.x - me.x, m.pos.z - me.z) : 0;
    const watchYaw = m && (m.source === "shot" || p.kind === "camp" && m.source !== "heard" && Math.abs(angleDelta(spot2.yaw, toM)) < 1.4) ? toM : spot2.yaw;
    this.turnToward(watchYaw + sweep, spot2.height > 2 ? -0.08 : 0);
    const scoped = !!this.heldDef(view)?.view.zoomFov;
    const settled = view.tick - this.underFireTick > TICK_RATE * 2;
    const prone = p.kind === "sniper" && scoped && settled;
    const t = tick + this.slot * 37;
    const cycle = TICK_RATE * 6;
    let at2 = spot2.pos;
    let stance = prone ? 2 : 1;
    if (!prone && p.kind === "camp") {
      if (t % cycle < TICK_RATE * 1.6) {
        const side = Math.floor(t / cycle) % 2 ? 0.8 : -0.8;
        const step = { x: spot2.pos.x + Math.cos(spot2.yaw) * side, y: spot2.pos.y, z: spot2.pos.z - Math.sin(spot2.yaw) * side };
        if (view.physics.lineOfSight({ x: spot2.pos.x, y: spot2.pos.y + 0.5, z: spot2.pos.z }, { x: step.x, y: step.y + 0.5, z: step.z })) at2 = step;
      }
      if (t % (TICK_RATE * 5) < TICK_RATE) stance = 0;
    }
    const da = horizontalDistance(me, at2);
    return { moveYaw: da > (at2 === spot2.pos ? 0.6 : 0.3) ? Math.atan2(at2.x - me.x, at2.z - me.z) : null, stance, moveScale: 0.5 };
  }
  /** How far (m) a bot on its way to `goal` goes out of its way: the goal's say, else by how much it cares for objectives (8–20 m). */
  detourFor(goal) {
    return goal.detour ?? 20 - this.profile.objectivePriority / 100 * 12;
  }
  /** The corridor it walks (route variety: measuring, and the team brain's crowd price); null when it goes its own way. */
  get corridor() {
    const r = this.route;
    return r && this.lastThinkTick - r.used < TICK_RATE * 3 ? r.c : null;
  }
  /**
   * Where to head for `goal` by corridor `c` (route variety): its vias in order (Corridor.vias: where it is furthest from
   * the trip's other corridors), each until the bot has been by it or is nearer the goal than it is, then the goal; the
   * bot's own routes do the rest, so it goes that corridor's way without following it point by point. (Following its
   * points every 12 m went wrong on maps with floors: a bot on a deck above a corridor counted as on it, headed for a
   * point on the ground ahead and stood under a gallery's rail; captures halved on the dev sample.)
   */
  viaRoute(view, c, goal) {
    const me = view.self.pos;
    let r = this.route;
    if (!r || r.c !== c || horizontalDistance(r.goal, goal) > 8) r = this.route = { c, goal: { ...goal }, next: 0, used: view.tick };
    r.used = view.tick;
    const left = horizontalDistance(me, goal);
    while (r.next < c.vias.length) {
      const via = c.vias[r.next];
      if (horizontalDistance(me, via) < 6 && Math.abs(me.y - via.y) < 3 || left < horizontalDistance(via, goal)) r.next++;
      else return via;
    }
    return goal;
  }
  /**
   * Keeping to its group's corridor all the way (orderTarget, then the route search: NavWorld.pathAlong): which, when it
   * was last asked for, and when a route along it last failed (then by its via for a while).
   */
  along = null;
  /** Routes that kept to a corridor all the way (measuring). */
  alongRoutes = 0;
  alongFailed(c, tick) {
    const a = this.along;
    return !!a && a.c === c && tick - a.failed < TICK_RATE * 10;
  }
  /**
   * Toward `goal` by corridor `c`: all the way along its own polygons (NavWorld.pathAlong) when it runs to the goal and
   * that hasn't failed lately; else by its via, then the shortest way on. Either way the corridor is the one it walks
   * (BotBrain.corridor: the team brain's crowd price counts it).
   */
  byCorridor(view, c, goal) {
    if (c.polys.length > 1 && !this.alongFailed(c, view.tick)) {
      this.along = { c, tick: view.tick, failed: this.along?.c === c ? this.along.failed : -Infinity };
      let r = this.route;
      if (!r || r.c !== c || horizontalDistance(r.goal, goal) > 8) r = this.route = { c, goal: { ...goal }, next: 0, used: view.tick };
      r.used = view.tick;
      return goal;
    }
    return this.viaRoute(view, c, goal);
  }
  /** `to`, where it was heading for `goal`, was one of its corridor's vias and no route gets there from here: on past it. */
  skipVia(to, goal) {
    const r = this.route;
    const via = r?.c.vias[r.next];
    if (!r || !via || horizontalDistance(r.goal, goal) > 8 || horizontalDistance(via, to) > 0.5) return false;
    r.next++;
    return true;
  }
  /** The team brain's job for this goal, if the job is for it (its route and staging only apply to their objective). */
  jobFor(view, g) {
    const job = view.plan?.job;
    return job?.to && !g.run && horizontalDistance(job.to, g.pos) < 10 && Math.abs(job.to.y - g.pos.y) < 4 ? job : null;
  }
  /**
   * Where to head for an objective goal: far off, by a way of its own first (left, right or straight, picked once
   * per goal and life from its route stream), so a team's attackers spread over the map's routes instead of all
   * meeting the enemy's head-on in one corridor; then the goal itself. With a job from the team brain: its group's
   * corridor instead, and its staging spot first while the group gathers for a push.
   */
  orderTarget(view, g) {
    const me = view.self.pos;
    const job = this.jobFor(view, g);
    if (job) {
      if (job.stage) return job.stage;
      if (!job.route || horizontalDistance(me, g.pos) <= ROUTE_FROM) return g.pos;
      return this.byCorridor(view, job.route, g.pos);
    }
    let lane = this.lane;
    if (!g.push || g.detour === 0 || g.radius >= 1) return g.pos;
    if (!lane || horizontalDistance(lane.goal, g.pos) > 8) {
      const far = horizontalDistance(me, g.pos) > LANE_FROM;
      const r = this.routeRng();
      const side = r < 0.35 ? -1 : r < 0.7 ? 1 : 0;
      const c = far && side && BOT_SWITCHES.sideCorridors ? sideCorridor(view.plan?.trips, me, g.pos, side) : null;
      if (c && c.vias.every((v) => view.nav.reachable(me, v)) && view.nav.reachable(c.vias[c.vias.length - 1], g.pos)) {
        this.laneCorridors++;
        lane = this.lane = { goal: { ...g.pos }, via: null, c };
      } else {
        let via2 = far && side ? laneWaypoint(view.nav.mainPlaces(), me, g.pos, side) : null;
        if (via2 && (!view.nav.reachable(me, via2) || !view.nav.reachable(via2, g.pos))) via2 = null;
        lane = this.lane = { goal: { ...g.pos }, via: via2 };
      }
    }
    if (lane.c) {
      if (horizontalDistance(me, g.pos) <= ROUTE_FROM) return g.pos;
      return this.viaRoute(view, lane.c, g.pos);
    }
    const via = lane.via;
    if (via && (horizontalDistance(me, via) < 6 || horizontalDistance(me, g.pos) < horizontalDistance(via, g.pos))) lane.via = null;
    return lane.via ?? g.pos;
  }
  get berserker() {
    return hasTag(this.profile, "BERSERKER");
  }
  /** Arena style (Quake feel): keeps moving, strafe-jumps, times the item respawns, rarely takes cover. */
  get arena() {
    return hasTag(this.profile, "ARENA");
  }
  /** Tactical style (Counter-Strike feel): slow and careful, holds angles, uses cover and stance a lot. */
  get methodical() {
    return hasTag(this.profile, "TACTICAL");
  }
  /** How tactically this bot plays (difficulty × personality), 0..1. */
  get tactical() {
    return this.difficulty.tactics * (0.35 + this.profile.tacticalAwareness / 100 * 0.9);
  }
  preferredRange(view) {
    const def = this.heldDef(view);
    const base = 4 + this.profile.rangePreference / 100 * 22;
    if (!def) return base;
    const [lo, hi2] = def.botRange;
    return clamp(base, lo + 1, Math.max(lo + 2, Math.min(hi2 - 2, hi2 * 0.7)));
  }
  // ------------------------------------------------------------------ tactical decisions (~10 Hz)
  decide(view, target) {
    if (!simProfile.on) return this.decideNow(view, target);
    const t0 = performance.now();
    this.decideNow(view, target);
    simProfile.add("botDecide", performance.now() - t0);
  }
  decideNow(view, target) {
    const me = view.self;
    const tick = view.tick;
    const hurt = this.hurt(view);
    const underFire = tick - this.underFireTick < TICK_RATE * 1.5 || tick - this.hurtTick < TICK_RATE * 1.5;
    const post = this.post;
    if (post && (post.arrived >= 0 && (this.hurtTick > post.arrived || underFire && !target) || tick >= post.until)) this.leavePost(tick, post.moving ? 1 + this.routeRng() * 2 : this.postCooldown(post.kind));
    const holding = this.posted(me.pos);
    const goal = view.orderGoal;
    const push = !!goal?.push;
    this.watchTraffic(view);
    this.watchArmour(view);
    const armedForVehicles = this.canHurtVehicles(view);
    if (this.mountPlan && (this.mountPlan.ride || !hurt && (!target || horizontalDistance(me.pos, target.pos) > 10))) this.state = "mount";
    else if (target && hurt && !this.berserker && !goal?.run) this.state = "retreat";
    else if (!underFire && !armedForVehicles && this.fetchLauncher(view, target)) {
      this.state = "advance";
    } else if (target) {
      this.state = this.cover ? "cover" : "engage";
      this.option = OPT_FIGHT;
    } else this.choose(view, hurt, underFire);
    this.bound = this.boundPhase(view, target, goal);
    if (this.bound === "cover" && goal?.half !== void 0) this.coverFireUntil = tick + Math.round(TICK_RATE * COVER_FIRE_SECONDS);
    const threat = target?.pos ?? (underFire ? this.threatFrom : null);
    const outgunned = !!target && this.targetMount?.kind === "vehicle" && !armedForVehicles;
    const coverChance = Math.max(this.arena ? this.tactical * 0.4 : 0.15 + this.tactical * 1.7 + (this.methodical ? 0.3 : 0), outgunned ? 0.4 + this.tactical * 0.6 : 0);
    if (threat && !this.berserker && !holding && !goal?.run && (this.bound !== null || this.rng() < coverChance)) {
      const dist = horizontalDistance(me.pos, threat);
      const held = this.heldWeapon(view);
      const lowAmmo = !!held && held.def.magazine > 0 && held.mag <= Math.ceil(held.def.magazine * 0.25);
      const wantCover = underFire && !push || hurt || lowAmmo || !!view.reloading || dist > 11 && !push || this.state === "retreat" || outgunned || this.bound !== null;
      const threatEye = { x: threat.x, y: threat.y + PLAYER.eyeHeight, z: threat.z };
      if (this.cover && (horizontalDistance(this.cover.threat, threatEye) > 4 || tick % 30 < DECIDE_TICKS && !stillCovered(view.physics, this.cover.pos, threatEye, me.size ?? 1))) {
        this.cover = null;
      }
      if (wantCover && !this.cover && tick >= this.nextCoverSearch) {
        this.nextCoverSearch = tick + Math.round(TICK_RATE * (1.2 + this.rng()));
        const advance = view.squad?.advance === true || this.bound === "move";
        this.cover = findCover({
          physics: view.physics,
          nav: view.nav,
          from: me.pos,
          threat: threatEye,
          radius: this.state === "retreat" ? 9 : 8,
          preferred: advance ? Math.max(6, dist - 8) : this.preferredRange(view),
          avoid: view.allies?.filter((a) => a.slot !== me.slot).map((a) => a.pos),
          away: this.state === "retreat",
          eyeScale: me.size ?? 1,
          rng: this.rng
        });
        if (this.cover) {
          this.peekPhase = "hide";
          this.peeks = 0;
          this.phaseUntil = tick + Math.round(TICK_RATE * (0.4 + this.rng() * 0.6));
        }
      }
    } else if (!target && !underFire && tick - this.lastTargetTick > TICK_RATE * 4) {
      this.cover = null;
    }
    const moving = view.squad?.advance || this.bound === "move" && !view.reloading && !hurt;
    if (moving && this.cover && target && horizontalDistance(this.cover.pos, target.pos) > horizontalDistance(me.pos, target.pos) - 1 && tick >= this.nextCoverSearch) {
      this.cover = null;
    }
    this.considerGrenade(view, target);
    this.considerSmoke(view, target);
    this.considerMount(view, target);
  }
  // ------------------------------------------------------------------ scored choices
  /** The option it chose last (scored choices: OPT_*), and the scores it weighed (debug and tests). */
  option = -1;
  scores = new Float32Array(OPTIONS);
  /** The choice's input, refilled each choice (no allocation per think). */
  choice;
  /** The pickup worth a detour from its objective, worked out about once a second: where, and its score. */
  pickCand = null;
  /**
   * Scored choices (BOT_AI_PLAN.md Phase B item 1), with nobody in sight: what to do now. Each option gets a score from
   * the bot's personality, its health, the mode's goal and its role (OrderGoal: keep to it, run, hold a place, a
   * person's order), the team brain's job, and distance; the best wins, and the one it chose last gets MARGIN more so
   * it doesn't dither between two. The states stay the "how".
   * - the objective (the mode's goal, a person's order, the team brain's cut-off point), or roaming without one;
   * - keeping up hide-and-peek behind cover just after a fight, or running on a moment after losing sight while
   *   getting away;
   * - a pickup: a real gun with only a sidearm (before chasing anyone), or what it needs while holding an objective
   *   (health when hurt, ammo when low), close by;
   * - chasing an enemy that slipped out of sight (more for persistent bots, fresh sightings and close ones);
   * - a noise.
   * Leaving the objective costs (leaveCost): a carrier never does; a bot keeping to its way turns aside only for
   * something within PUSH_NOTICE; one holding a place less the further it is. So a CTF attacker fights on its way to
   * the flag and turns back to it after the fight, and a defender or a bot on the hill doesn't wander off after a
   * shot it heard 30 m away.
   */
  choose(view, hurt, underFire) {
    const me = view.self;
    const tick = view.tick;
    const g = view.orderGoal ?? null;
    const held = this.heldWeapon(view);
    const lk = this.lastKnown;
    const hd = this.heard;
    const c = this.choice;
    c.me = me.pos;
    c.goal = g;
    c.hurt = hurt;
    c.lowAmmo = !!held && held.def.magazine > 0 && held.mag + held.reserve <= held.def.magazine;
    c.cover = !!this.cover && (underFire || !!view.reloading || hurt || tick - this.lastTargetTick < TICK_RATE * (g?.push ? 1 : 2.5 + (1 - this.profile.aggression / 100) * 3));
    c.retreating = this.state === "retreat" && !!lk && tick - lk.tick < TICK_RATE * 3;
    c.pickup = this.pickupScore(view, g, underFire, hurt);
    c.lost = lk ? { pos: lk.pos, age: (tick - lk.tick) / TICK_RATE } : null;
    c.noise = hd ? { pos: hd.pos, age: (tick - hd.tick) / TICK_RATE } : null;
    c.posted = !!this.post;
    c.post = this.postScore(view, g);
    scoreChoices(c, this.scores);
    const noise = this.difficulty.decisionNoise;
    if (noise > 0 && !g?.run) {
      for (let i = 0; i < OPTIONS; i++) if (this.scores[i] > -Infinity) this.scores[i] = this.scores[i] + noise * (this.skillRng() * 2 - 1);
    }
    const best = bestChoice(this.scores, this.option, !!g);
    if (this.state === "chase" && best !== OPT_CHASE) {
      if (lk && horizontalDistance(me.pos, lk.pos) <= 1.5) {
        this.scanUntil = tick + Math.round(TICK_RATE * (0.8 + this.tactical));
        this.scanYaw = this.yaw;
      }
      this.lastKnown = null;
    }
    if (this.state === "investigate" && best !== OPT_NOISE) this.heard = null;
    this.option = best;
    switch (best) {
      case OPT_COVER:
        this.state = "cover";
        break;
      case OPT_RETREAT:
        this.state = "retreat";
        break;
      case OPT_CHASE:
        this.state = "chase";
        break;
      case OPT_NOISE:
        this.state = "investigate";
        break;
      case OPT_POST:
        this.state = "advance";
        break;
      case OPT_PICKUP: {
        const at2 = this.gunNearby ?? this.pickCand?.pos ?? null;
        this.state = "advance";
        if (at2 && (!this.roamGoal || horizontalDistance(this.roamGoal, at2) > 0.5)) {
          this.roamGoal = this.pickupAt = { ...at2 };
          this.via = null;
        }
        break;
      }
      default:
        this.state = this.mountPlan ? "mount" : g ? "hold" : "advance";
        if (this.state === "advance") this.considerPost(view);
    }
  }
  /**
   * A sniper's spot (POST_WEIGHT; Phase B item 5): the sniper role with a scoped gun, with nowhere it was sent or a goal
   * to hold (its spot looks over it), holding a spot or able to take one now. -Infinity otherwise.
   */
  postScore(view, g) {
    if (view.plan?.role !== "sniper" || g && !holdsPost(g)) return -Infinity;
    if (!this.post) this.considerPost(view);
    return this.post ? POST_WEIGHT : -Infinity;
  }
  /**
   * The pickup option's score: a sniper's scoped gun first (SCOPE_WEIGHT, within SCOPE_DETOUR), a real gun close by
   * with only a sidearm (GUN_WEIGHT: before chasing anyone; on the way to an objective, one a few steps off it), else,
   * holding an objective, what it needs close by (health when hurt, ammo when low: its pickup score, worth more when
   * badly hurt), worked out about once a second. A roaming bot picks up what it needs as it goes (act()).
   */
  pickupScore(view, g, underFire, hurt) {
    this.gunNearby = null;
    if (underFire || g?.run || g?.order) return -Infinity;
    if (view.plan?.role === "sniper" && !this.hasScope(view) && (!g || holdsPost(g))) {
      this.gunNearby = this.pickupGoal(view, "weapon", SCOPE_DETOUR, (def) => !!def.view.zoomFov && !def.alt);
      if (this.gunNearby) return SCOPE_WEIGHT;
    }
    const keep = !g || (!!g.push || !!g.watch) && g.detour !== 0;
    if (keep && bestLoadedDesirability(view.inventory) <= SIDEARM) {
      this.gunNearby = this.pickupGoal(view, "weapon", g ? Math.min(GUN_DETOUR, this.detourFor(g)) : GUN_DETOUR);
      if (this.gunNearby) return GUN_WEIGHT;
    }
    if (!g || g.detour === 0) return -Infinity;
    const tick = view.tick;
    let c = this.pickCand;
    if (!c || tick - c.tick >= TICK_RATE) {
      const within = g.push ? this.detourFor(g) : 8;
      const pick = this.pickupScored(view, within);
      c = this.pickCand = { pos: pick?.pos ?? null, score: pick?.score ?? 0, tick };
    }
    if (!c.pos) return -Infinity;
    const health = view.self.health <= PLAYER.maxHealth * 0.5 || hurt;
    return c.score * 2.4 * (health ? 1.6 : 1);
  }
  /** Short enough to resupply (an ammo box, a Supply Buggy): any gun under half its reserve, or no grenades. */
  wantsResupply(view) {
    if (view.inventory.some((w) => w.def.reserveMax > 0 && w.reserve < w.def.reserveMax / 2)) return true;
    return view.throwable === null;
  }
  /** The best pickup within `within` m that a route reaches, with its score (bestPickup's), or null. */
  pickupScored(view, within) {
    for (let tries = 0; tries < 3; tries++) {
      const pick = this.bestPickup(view, void 0, within);
      if (!pick || this.collectable(view, pick.pos)) return pick;
      this.losePickup(view, pick.pos);
    }
    return null;
  }
  // ------------------------------------------------------------------ per-tick actions
  act(view, seq, target, ctx) {
    const me = view.self;
    const tick = view.tick;
    this.holdStill = false;
    if (this.pressPlan && tick >= this.pressPlan.until) this.pressPlan = null;
    if (this.pressPlan && !view.blockers?.some((b) => sameBox(b, this.pressPlan.door))) {
      this.pressPlan = null;
      this.path = [];
      this.goal = null;
      this.lastPathTick = -Infinity;
    }
    const atButton = this.pressPlan !== null && this.pressReach(me, this.pressPlan);
    const yaw0 = this.yaw;
    const pitch0 = this.pitch;
    let moveYaw = null;
    let moveScale = 1;
    let backOff = false;
    let sprint = false;
    let wantFire = false;
    let stance = 0;
    let strafe = false;
    let sol = null;
    let lookDone = false;
    let doing = this.state === "engage" ? "fight" : this.state === "cover" || this.state === "retreat" || this.state === "chase" || this.state === "investigate" || this.state === "mount" ? this.state : "roam";
    this.pathMiss = false;
    const def = ctx.weapon;
    const hurt = this.hurt(view);
    const underFire = tick - this.underFireTick < TICK_RATE * 1.5;
    if (this.state !== "retreat") {
      this.retreatGoal = null;
      this.retreatMode = null;
    }
    let aimedTarget = false;
    const aimAtTarget = (t) => {
      aimedTarget = true;
      const ta2 = simProfile.on ? performance.now() : 0;
      sol = this.aim.solve(ctx, { slot: t.slot, pos: this.aimPos(def, t), stance: this.aimStance(def, t), size: t.size ?? 1, box: t.box ?? null, yaw: t.yaw, hitScale: t.hitScale ?? 1, bodyStance: t.stance ?? 0 });
      if (simProfile.on) simProfile.add("botAim", performance.now() - ta2);
      this.turnToward(sol.yaw, sol.pitch);
      lookDone = true;
      wantFire = true;
    };
    switch (this.state) {
      case "engage":
      case "cover":
      case "retreat": {
        const t = target;
        if (!t) {
          const threat = this.lastKnown?.pos ?? this.threatFrom;
          if (this.state === "retreat" && !this.cover && this.retreatGoal) {
            moveYaw = this.followPathTo(view, this.retreatGoal.pos, false);
            if (moveYaw !== null) {
              sprint = true;
              this.turnToward(moveYaw, 0);
              lookDone = true;
              break;
            }
          } else if (!this.cover && this.strafing && tick - this.lastTargetTick < TICK_RATE * 0.6) {
            strafe = true;
          }
          if (this.cover && threat) {
            const r = this.inCover(view, threat, def);
            moveYaw = r.moveYaw;
            sprint = r.sprint;
            stance = r.stance;
            moveScale = r.moveScale;
            const lk = this.lastKnown;
            if (tick < this.coverFireUntil && !sprint && lk && tick - lk.tick < TICK_RATE * COVER_FIRE_SECONDS && horizontalDistance(me.pos, lk.pos) > 6) {
              const sup = this.suppress(view, lk.pos, ctx);
              if (sup) {
                sol = sup;
                wantFire = true;
                this.lookAt(view, lk.pos, 1.2);
                lookDone = true;
                this.coverShots++;
                break;
              }
            }
          }
          if (threat && !sprint) this.lookAt(view, threat, 1.2);
          lookDone = !sprint;
          break;
        }
        const dist = horizontalDistance(me.pos, t.pos);
        const preferred = this.preferredRange(view);
        if (this.state === "retreat" && !this.cover) {
          const refuge = this.refuge(view, t.pos);
          moveYaw = this.followPathTo(view, refuge, false);
          if (moveYaw === null) this.retreatGoal = null;
          if (!this.retreatMode || tick >= this.retreatMode.until) {
            const run = dist > 9 || this.berserker || this.rng() < 0.5;
            this.retreatMode = { run, until: tick + Math.round(TICK_RATE * (1.3 + this.rng() * 1.2)) };
          }
          if (moveYaw !== null && this.retreatMode.run) {
            sprint = true;
            this.turnToward(moveYaw, 0);
            lookDone = true;
          } else aimAtTarget(t);
          break;
        }
        if (this.cover) {
          const r = this.inCover(view, t.pos, def);
          moveYaw = r.moveYaw;
          sprint = r.sprint;
          stance = r.stance;
          moveScale = r.moveScale;
          if (r.shoot) aimAtTarget(t);
          else if (sprint && moveYaw !== null) {
            this.turnToward(moveYaw, 0);
            lookDone = true;
          } else {
            this.lookAt(view, t.pos, STANCES[t.stance ?? 0].height * 0.6);
            lookDone = true;
          }
          break;
        }
        if (this.berserker) {
          if (dist > 7) moveYaw = this.followPathTo(view, t.pos, true);
          if (dist > 18) sprint = true;
          strafe = dist < 10;
        } else {
          const squadAdvance = view.squad?.advance === true;
          const reach2 = def?.kind === "melee";
          if (this.spacing === "close") {
            if (dist < preferred + (reach2 ? 0.3 : 2.5) && !(squadAdvance && dist > 8)) this.spacing = "hold";
          } else if (this.spacing === "back") {
            if (dist > preferred - 1.5) this.spacing = "hold";
          } else if (dist > preferred + (reach2 ? 1 : 4) || squadAdvance && dist > 8) this.spacing = "close";
          else if (dist < preferred - 4) this.spacing = "back";
          if (this.outnumbered() && dist < preferred + 6) this.spacing = "back";
          this.strafing = this.strafing ? dist < 15.5 : dist < 13;
          if (this.spacing === "close") {
            moveYaw = this.followPathTo(view, t.pos, true);
            moveScale = 0.75;
          } else if (this.spacing === "back") backOff = true;
          else if (this.strafing) strafe = true;
          if (moveYaw === null && !backOff && !strafe) {
            stance = this.wantsProne(view, dist) ? 2 : dist > 13 && !this.arena && this.tactical > 0.25 ? 1 : 0;
          }
          if (dist > 7 && this.posted(me.pos)) {
            moveYaw = null;
            backOff = false;
            strafe = false;
            stance = this.wantsProne(view, dist) || this.post.kind === "sniper" && !!def?.view.zoomFov && dist > 15 ? 2 : 1;
          }
          const g = view.orderGoal;
          if (g?.push && this.bound !== "cover" && (dist > 9 || g.run) && (horizontalDistance(me.pos, g.pos) > g.radius + 0.5 || Math.abs(me.pos.y - g.pos.y) > 2)) {
            const go = this.followPathTo(view, this.orderTarget(view, g), false);
            if (go !== null) {
              moveYaw = go;
              moveScale = 0.85;
              backOff = false;
              strafe = false;
              stance = 0;
              if (g.run && dist > 12) sprint = true;
            }
          }
        }
        if (!sprint) aimAtTarget(t);
        break;
      }
      case "chase": {
        const lk = this.lastKnown;
        if (this.methodical && tick - lk.tick < TICK_RATE * (1 + this.tactical) && this.canSee(view, ctx.eye, lk.pos)) {
          this.lookAt(view, lk.pos, 1.2);
          lookDone = true;
          stance = this.tactical > 0.5 ? 1 : 0;
          doing = "chaseHold";
          break;
        }
        const far = horizontalDistance(me.pos, lk.pos) > 25;
        moveYaw = this.followPathTo(view, lk.pos, false);
        if (moveYaw === null && horizontalDistance(me.pos, lk.pos) > 1.5 || this.stalled(view, lk.pos)) {
          this.lastKnown = null;
          this.state = "advance";
          break;
        }
        if (far && !this.careful()) sprint = true;
        else moveScale = this.careful() ? 0.7 : 1;
        if (hasTag(this.profile, "SUPPRESSOR") && tick - lk.tick < TICK_RATE * SUPPRESS_SECONDS && horizontalDistance(me.pos, lk.pos) > 6) {
          moveYaw = null;
          const sup = this.suppress(view, lk.pos, ctx);
          if (sup) {
            sol = sup;
            lookDone = true;
            wantFire = true;
          }
        }
        break;
      }
      case "investigate": {
        const goal = this.heard.pos;
        moveYaw = this.followPathTo(view, goal, false);
        moveScale = this.careful() ? 0.65 : 1;
        if (moveYaw === null && horizontalDistance(me.pos, goal) > 2 || this.stalled(view, goal)) {
          this.unreachable = { pos: goal, until: tick + TICK_RATE * 10 };
          this.heard = null;
          this.state = "advance";
        }
        break;
      }
      case "mount": {
        const plan2 = this.mountPlan;
        const m = plan2 && view.mounts?.find((x) => x.index === plan2.index);
        if (!plan2 || !m || !m.alive || !m.seats.some((s) => s.free)) {
          this.mountPlan = null;
          break;
        }
        const d = horizontalDistance(me.pos, m.pos);
        if (plan2.ride) {
          const driver = m.seats.find((x) => x.role === "driver")?.by;
          if (driver === void 0 || !view.allies?.some((a) => a.slot === driver) || !m.seats.some((x) => x.free && x.role !== "driver") || d > RIDE_REACH + 6) {
            this.mountPlan = null;
            break;
          }
          if (d > m.enterRadius * 0.75) {
            moveYaw = d < 6 ? Math.atan2(m.pos.x - me.pos.x, m.pos.z - me.pos.z) : this.followPathTo(view, m.pos, true);
            sprint = d > 4;
          }
          break;
        }
        if (!inBoardingReach(m, me.pos)) {
          if (!plan2.spot || !plan2.spotOf || horizontalDistance(plan2.spotOf, m.pos) > 1.5) {
            plan2.spot = boardingSpot(m, me.pos);
            plan2.spotOf = { ...m.pos };
          }
          moveYaw = this.followPathTo(view, plan2.spot, false);
          sprint = d > 8;
          if (moveYaw === null && horizontalDistance(me.pos, plan2.spot) > 2) {
            this.giveUpOn(m.index, tick);
            this.mountPlan = null;
          }
        }
        break;
      }
      case "hold": {
        const g = view.orderGoal;
        if (!g) break;
        const lo = this.lastOrder;
        const moving = horizontalDistance(lo, g.pos) > 0.05 || Math.abs(lo.y - g.pos.y) > 0.05;
        lo.x = g.pos.x;
        lo.y = g.pos.y;
        lo.z = g.pos.z;
        const stage = this.jobFor(view, g)?.stage ?? null;
        if (stage && horizontalDistance(me.pos, stage) < STAGE_RADIUS && Math.abs(me.pos.y - stage.y) < 3) {
          this.watch = this.watch && horizontalDistance(this.watch.spot, stage) < STAGE_RADIUS + 1 ? this.watch : null;
          const r = this.keepWatch(view, { pos: stage, radius: STAGE_RADIUS - 1, watch: g.pos }, true);
          moveYaw = r.moveYaw;
          moveScale = r.moveScale;
          stance = r.stance;
          lookDone = true;
          doing = "stage";
          break;
        }
        if (horizontalDistance(me.pos, g.pos) > g.radius || Math.abs(me.pos.y - g.pos.y) > 2) {
          const near2 = this.outOfReach(view, g.pos);
          if (near2) {
            this.watch = this.watch && horizontalDistance(this.watch.spot, near2) < 3.5 ? this.watch : null;
            const r = this.keepWatch(view, { pos: near2, radius: 3, watch: g.pos });
            moveYaw = r.moveYaw;
            moveScale = r.moveScale;
            stance = r.stance;
            lookDone = true;
            doing = "station";
            break;
          }
          const to = this.orderTarget(view, g);
          moveYaw = this.followPathTo(view, to, moving);
          if (moveYaw === null && this.pathMiss && this.lane?.via) this.lane.via = null;
          else if (moveYaw === null && this.pathMiss && this.skipVia(to, g.pos)) moveYaw = null;
          else if (moveYaw === null && this.pathMiss && me.grounded !== false) {
            this.pathMiss = false;
            this.watch = null;
            const r = this.keepWatch(view, { pos: this.standIn ?? view.nav.reachToward(me.pos, g.pos) ?? me.pos, radius: 3, watch: g.pos });
            moveYaw = r.moveYaw;
            moveScale = r.moveScale;
            stance = r.stance;
            lookDone = true;
            doing = "station";
            break;
          }
          moveScale = this.careful() && !g.push ? 0.8 : 1;
          if (g.push && (g.run || horizontalDistance(me.pos, to) > 15)) sprint = true;
          doing = "goal";
          this.watch = null;
        } else {
          const r = this.keepWatch(view, g);
          moveYaw = r.moveYaw;
          moveScale = r.moveScale;
          stance = hasTag(this.profile, "SNIPER") && me.grounded !== false ? Math.max(1, r.stance) : r.stance;
          lookDone = true;
          doing = "station";
        }
        break;
      }
      case "advance":
      case "roam":
      default: {
        if (this.post) {
          const r = this.actPost(view);
          if (r) {
            moveYaw = r.moveYaw;
            stance = r.stance;
            moveScale = r.moveScale;
            lookDone = r.moveYaw === null || horizontalDistance(me.pos, this.post.board.spots[this.post.spot].pos) < 1.6;
            doing = this.post && this.post.arrived >= 0 ? "post" : "postTravel";
            break;
          }
        }
        const cl = view.plan?.cluster ?? null;
        const av = this.avoid;
        if (cl?.goal && !view.orderGoal && !(av && tick < av.until && horizontalDistance(av.pos, cl.goal) < 6)) {
          if (!this.squadGoal || horizontalDistance(this.squadGoal, cl.goal) > 3) {
            this.squadGoal = { ...cl.goal };
            this.roamGoal = { ...cl.goal };
            this.via = cl.via ? { ...cl.via } : null;
            this.roamRoute = cl.route ? { c: cl.route, goal: { ...cl.goal } } : null;
          } else if (!this.roamGoal) this.roamGoal = { ...cl.goal };
        } else this.squadGoal = null;
        if (!this.roamGoal || horizontalDistance(me.pos, this.roamGoal) < 2 || (tick + this.slot) % (TICK_RATE * 2) === 0) {
          const pick = this.pickupGoal(view);
          if (pick) this.roamGoal = this.pickupAt = pick;
          else if (this.squadGoal && horizontalDistance(me.pos, this.squadGoal) > 2 && (!this.roamGoal || horizontalDistance(me.pos, this.roamGoal) < 2)) {
            this.roamGoal = { ...this.squadGoal };
            this.via = null;
          } else if (!this.roamGoal || horizontalDistance(me.pos, this.roamGoal) < 2) this.pickAdvanceGoal(view);
        }
        let goal = this.roamGoal;
        if (this.via) {
          if (horizontalDistance(me.pos, this.via) < 4) this.via = null;
          else goal = this.via;
        }
        const rr = this.roamRoute;
        if (!this.via && rr && horizontalDistance(rr.goal, goal) < 3 && horizontalDistance(me.pos, goal) > ROUTE_FROM) goal = this.viaRoute(view, rr.c, goal);
        const follower = !!cl && cl.leader !== me.slot;
        const fromLeader = cl ? horizontalDistance(me.pos, cl.leaderPos) : 0;
        this.regrouping = follower && (fromLeader > 28 || this.regrouping && fromLeader > 15);
        const regroup = this.regrouping;
        if (regroup) goal = cl.leaderPos;
        const waiting = follower && !regroup && !!this.squadGoal && !!this.roamGoal && horizontalDistance(this.roamGoal, this.squadGoal) < 1 && horizontalDistance(me.pos, this.squadGoal) < 8;
        const watching = waiting ? this.keepWatch(view, { pos: this.squadGoal, radius: 7, watch: nearestOf(view.plan?.towards, me.pos) }) : null;
        moveYaw = watching ? watching.moveYaw : this.followPathTo(view, goal, regroup);
        if (watching) {
          stance = watching.stance;
          lookDone = true;
        }
        doing = waiting ? "squadWait" : regroup ? "regroup" : this.squadGoal && this.roamGoal && horizontalDistance(this.roamGoal, this.squadGoal) < 1 ? "squad" : this.roamGoal && this.roamGoal === this.pickupAt ? "pickup" : "roam";
        if (moveYaw === null && !regroup && !waiting) {
          if (this.squadGoal && this.roamGoal && horizontalDistance(this.roamGoal, this.squadGoal) < 1 && horizontalDistance(me.pos, this.squadGoal) > 3) this.avoid = { pos: { ...this.squadGoal }, until: tick + TICK_RATE * 20 };
          else if (this.roamGoal && !this.via && horizontalDistance(me.pos, this.roamGoal) > 1.5) this.losePickup(view, this.roamGoal);
          else if (this.roamGoal && this.roamGoal === this.pickupAt && this.refused(view, this.roamGoal)) this.losePickup(view, this.roamGoal);
          this.roamGoal = null;
          this.via = null;
        }
        moveScale = watching ? watching.moveScale : this.careful() && this.clearing ? 0.7 : 1;
        if (cl && moveYaw !== null && !regroup && !watching) {
          if (follower && cl.goal && fromLeader > cl.spacing * 2 && horizontalDistance(me.pos, cl.goal) < horizontalDistance(cl.leaderPos, cl.goal) - 5) moveScale = Math.min(moveScale, 0.35);
          else if (!follower && cl.lagging) moveScale = Math.min(moveScale, 0.7);
          if (follower && this.squadmateAhead(view, moveYaw)) {
            moveYaw = null;
            doing = "singleFile";
          }
        }
        break;
      }
    }
    if (this.pathMiss && moveYaw === null) doing = "noPath";
    if (me.climbing && moveYaw === null && !backOff && !strafe && !target) {
      moveYaw = this.yaw;
      moveScale = 1;
      if (doing === "noPath") doing = "goal";
    }
    if (me.chute && moveYaw === null && !backOff && !strafe) {
      const to = view.orderGoal?.pos ?? this.goal;
      if (to && horizontalDistance(me.pos, to) > 1) {
        moveYaw = Math.atan2(to.x - me.pos.x, to.z - me.pos.z);
        moveScale = 1;
        if (doing === "noPath") doing = "goal";
      }
    }
    if (this.bailedOut && me.grounded === false && !me.chute) {
      const to = view.orderGoal?.pos ?? this.goal;
      if (!to || me.pos.y - to.y > 12) this.jumpNext = true;
    }
    const noLine = target && this.shotBlocked && tick < this.shotBlocked.until ? this.shotBlocked : null;
    if (noLine && (this.state === "engage" || this.state === "cover")) {
      stance = 0;
      if (noLine.side) {
        if (this.cover && this.peekPhase === "peek") this.cover = null;
        if (moveYaw === null && !sprint && !backOff) strafe = true;
      }
    }
    const travelling = this.state === "advance" || this.state === "chase" || this.state === "investigate" || this.state === "hold";
    if (travelling && !target && moveYaw !== null && !sprint) {
      const r = this.checkCorners(view);
      if (r.pause !== void 0) {
        moveScale = Math.min(moveScale, r.pause);
        if (r.pause === 0) {
          moveYaw = null;
          doing = "corner";
        }
      }
      if (r.look && !this.throwPlan) {
        this.lookAt(view, r.look, 0);
        lookDone = true;
      }
    } else if (target) {
      this.pie = null;
      this.clearing = null;
    }
    const dodge = this.dodge && tick < this.dodge.until ? this.dodge : null;
    if (dodge) {
      moveYaw = dodge.yaw;
      moveScale = 1;
      backOff = false;
      strafe = false;
      stance = 0;
      sprint = dodge.sprint;
      doing = "dodge";
    }
    let throwNow = false;
    if (this.throwPlan) {
      if (tick > this.throwPlan.until) this.throwPlan = null;
      else {
        this.turnToward(this.throwPlan.yaw, this.throwPlan.pitch);
        lookDone = true;
        wantFire = false;
        if (Math.abs(angleDelta(this.yaw, this.throwPlan.yaw)) < 0.03 && Math.abs(this.pitch - this.throwPlan.pitch) < 0.03) {
          throwNow = true;
          const away = this.throwPlan.clear;
          if (away) this.dodge = { yaw: Math.atan2(me.pos.x - away.x, me.pos.z - away.z), until: tick + Math.round(TICK_RATE * ((this.throwPlan.fuse ?? 3) + 0.3)), sprint: true };
          this.throwPlan = null;
          this.nextThrow = tick + Math.round(TICK_RATE * (6 + this.rng() * 6));
          if (this.pie) this.pie.until = Math.max(this.pie.until, tick + Math.round(TICK_RATE * 2.8));
        }
      }
    }
    if (this.throwPlan || throwNow) doing = "throw";
    if (!lookDone && !atButton) {
      if (tick < this.scanUntil) {
        this.turnToward(this.scanYaw + Math.sin((this.scanUntil - tick) / 14) * 1.6, 0);
        if (moveYaw === null) doing = "scan";
      } else if (this.holdStill) {
        const corner = this.path[this.pathIndex];
        const t = tick + this.slot * 41;
        const base = corner ? Math.atan2(corner.x - me.pos.x, corner.z - me.pos.z) : this.yaw;
        this.turnToward(base + Math.sin(t / 45) * 1.1 + (t % (TICK_RATE * 6) < TICK_RATE ? Math.PI * 0.8 : 0), 0);
      } else if (this.state === "chase" && this.lastKnown && horizontalDistance(me.pos, this.lastKnown.pos) < 30 && this.canSee(view, ctx.eye, this.lastKnown.pos)) {
        this.lookAt(view, this.lastKnown.pos, 1.2);
      } else this.lookAlongPath(view);
    }
    if (moveYaw !== null && this.hazardAhead(view, moveYaw)) {
      moveYaw = null;
      doing = "hazard";
    }
    const meaning = moveYaw !== null || backOff || strafe;
    moveYaw = this.separate(view, moveYaw, !target && !strafe && !backOff);
    let forward = 0;
    let right = 0;
    if (moveYaw !== null) {
      if (sprint) {
        this.turnToward(moveYaw, 0);
        const rel = angleDelta(this.yaw, moveYaw);
        forward = Math.cos(rel);
        right = Math.sin(rel);
        if (Math.abs(rel) > 0.5) sprint = false;
      } else {
        const rel = angleDelta(this.yaw, moveYaw);
        forward = Math.cos(rel) * moveScale;
        right = Math.sin(rel) * moveScale;
      }
    } else if (backOff) {
      forward = -0.8;
    }
    let pressNow = false;
    if (this.holdStill) {
      forward = 0;
      right = 0;
      doing = "lift";
    }
    const plan = this.pressPlan;
    if (plan) doing = "press";
    if (plan && !aimedTarget && this.pressReach(me, plan)) {
      forward = 0;
      right = 0;
      sprint = false;
      const a = lookAngles({ x: me.pos.x, y: me.pos.y + PLAYER.eyeHeight, z: me.pos.z }, plan.face);
      this.yaw = yaw0;
      this.pitch = pitch0;
      this.turnToward(a.yaw, a.pitch);
      if (Math.abs(angleDelta(this.yaw, a.yaw)) < 0.3 && Math.abs(this.pitch - a.pitch) < 0.3) {
        pressNow = true;
        this.pressedDoor = plan.door;
        this.pressPlan = null;
        this.pressedAt = tick;
        this.path = [];
        this.goal = null;
        this.lastPathTick = -Infinity;
      }
    }
    if (strafe) {
      this.updateStrafe(tick);
      right = clamp(right + this.strafeDir * 0.7, -1, 1);
    }
    [forward, right] = this.smoothMove(forward, right, !!target || tick - this.lastTargetTick < TICK_RATE || strafe || backOff || this.state === "retreat");
    const pk = this.link && (moveYaw !== null || this.link.jumped >= 0 || this.link.left >= 0) ? this.parkourMove(view) : null;
    if (pk) {
      this.yaw = pk.yaw;
      forward = pk.wait ? 0 : 1;
      right = 0;
      this.moveX = Math.sin(pk.yaw) * forward;
      this.moveZ = Math.cos(pk.yaw) * forward;
      doing = "parkour";
      strafe = false;
    }
    let buttons = 0;
    const reacted = target ? this.reacted(view, target) : true;
    let pull = false;
    const ta = simProfile.on ? performance.now() : 0;
    const sniping = !!target && !!sol && wantFire && this.sniping(view, def);
    if (sniping && !goodShot({ dist: sol.dist, reach: botBand(def)[1], lateral: this.aim.speedAcross(ctx.eye, target.pos), facing: facingOf(target, me.pos), settled: this.aim.settledOn(sol), tracked: this.aim.trackedTicks(tick) / TICK_RATE })) {
      wantFire = false;
      if (tick % TICK_RATE === 0) this.heldShots++;
      this.aim.trigger(ctx, { yaw: this.yaw + 9, pitch: 0, dist: 1, halfAngle: 0 }, this.yaw, this.pitch, false);
    } else if (wantFire && sol && !sprint) pull = this.aim.trigger(ctx, sol, this.yaw, this.pitch, reacted, this.shotCheck(view, ctx, sol, target));
    else this.aim.trigger(ctx, { yaw: this.yaw + 9, pitch: 0, dist: 1, halfAngle: 0 }, this.yaw, this.pitch, false);
    if (simProfile.on) simProfile.add("botAim", performance.now() - ta);
    if (pull) buttons |= BUTTON_FIRE;
    if (pull && sniping) this.sniperShot(tick);
    else if (sniping && facingOf(target, me.pos) > SPOTTED_FACING && this.aim.trackedTicks(tick) > TICK_RATE * 1.5) this.relocate(tick, 0.2);
    const sDist = sol?.dist ?? 0;
    if ((wantFire || sniping) && def?.view.zoomFov && !def.alt && sDist > 7) buttons |= BUTTON_ZOOM;
    if (throwNow) buttons |= BUTTON_THROW;
    const held = this.heldWeapon(view);
    const inCoverHidden = !!this.cover && this.peekPhase === "hide" && horizontalDistance(me.pos, this.cover.pos) < 0.8;
    if (held && held.def.magazine > 0 && held.reserve > 0 && !view.reloading) {
      if (held.mag === 0 || !target && held.mag < held.def.magazine / 2 || inCoverHidden && held.mag < held.def.magazine * 0.6) buttons |= BUTTON_RELOAD;
    }
    const barrel = held && held.def.kind === "melee" && held.def.alt?.kind === "hitscan" ? held.def.alt : null;
    if (held && barrel) {
      const loaded = (held.alt ?? 0) >= barrel.cost;
      const s = sol;
      const lined = !!s && Math.abs(angleDelta(this.yaw, s.yaw)) < s.halfAngle + 0.05 && Math.abs(this.pitch - s.pitch) < s.halfAngle + 0.08;
      if (wantFire && s && loaded && reacted && lined && !sprint && s.dist > held.def.range + 0.6 && s.dist < barrelReach(barrel) && !view.reloading) {
        buttons |= BUTTON_ALT;
        buttons &= ~BUTTON_FIRE;
      }
      const near2 = !!target && horizontalDistance(me.pos, target.pos) < barrelReach(barrel) + 4;
      if (barrel.reload && !view.reloading && held.reserve > 0 && (held.alt ?? 0) < (barrel.max ?? 1) && (!target || !near2 && !loaded)) buttons |= BUTTON_RELOAD;
    }
    const igniter = held && held.def.projectile?.zone?.kind === "oil" && held.def.alt?.projectile?.ignites ? held.def.alt : null;
    if (igniter && pull && held.mag >= igniter.cost && (tick + this.slot * 23) % (TICK_RATE * 3) >= TICK_RATE * 2.2) buttons = buttons & ~BUTTON_FIRE | BUTTON_ALT;
    if (target && held && held.def.kind !== "melee" && !held.def.projectile?.disc && held.def.magazine > 0 && held.mag === 0 && held.reserve === 0 && horizontalDistance(me.pos, target.pos) < 2 && (tick + this.slot) % 12 === 0) {
      buttons |= BUTTON_MELEE;
      buttons &= ~BUTTON_FIRE;
    }
    if (view.reloading && !this.berserker && target && moveYaw === null) stance = Math.max(stance, 1);
    if (hurt && inCoverHidden && this.tactical > 0.5) stance = 2;
    if (buttons & (BUTTON_FIRE | BUTTON_ALT | BUTTON_THROW | BUTTON_MELEE) && this.holdingForShield(me, target, tick)) buttons &= -2147;
    if (pressNow) buttons |= BUTTON_USE;
    if (this.zipPress && !me.riding && tick - this.lastUseTick > 15) {
      buttons |= BUTTON_USE;
      this.lastUseTick = tick;
    }
    if (this.zipPress || me.riding) doing = "zip";
    this.zipPress = false;
    if (!me.riding && !pressNow && tick - this.lastUseTick > TICK_RATE && this.wantsResupply(view)) {
      const stop = view.pickups.find((p) => p.available && (p.id.startsWith("box_") || p.id.startsWith("supply_")) && Math.hypot(p.pos.x - me.pos.x, p.pos.z - me.pos.z) < (p.id.startsWith("box_") ? AMMO_BOX_REACH - 0.2 : 1.3) && Math.abs(p.pos.y - me.pos.y) < 1.2);
      if (stop) {
        buttons |= BUTTON_USE;
        this.lastUseTick = tick;
      }
    }
    if (this.lowRoute && moveYaw !== null && this.mustDuck(view, moveYaw)) {
      stance = Math.max(stance, 1);
      sprint = false;
      this.duckTicks++;
    }
    if (sprint && moveYaw !== null && forward > 0.3) buttons |= BUTTON_SPRINT;
    else if (stance === 2) buttons |= BUTTON_PRONE;
    else if (stance === 1) buttons |= BUTTON_CROUCH;
    if (this.arena && me.grounded && stance === 0 && tick >= this.nextHop) {
      const fighting = !!target || underFire;
      const gap = arenaHop(this.profile.hop === "always", fighting, strafe, forward > 0.6 && !sprint);
      if (gap) {
        this.jumpNext = true;
        this.nextHop = tick + Math.round(TICK_RATE * (gap[0] + this.rng() * (gap[1] - gap[0])));
      }
    }
    this.meantToMove = meaning && (forward !== 0 || right !== 0);
    if (this.escape && moveYaw !== null) {
      doing = "escape";
      if (this.meantToMove && me.grounded && this.pathIndex >= this.path.length - 1 && this.speed < 1.5 && tick - this.hopAt > 18) {
        this.jumpNext = true;
        this.hopAt = tick;
        this.tuckHop = this.escape.across.y - me.pos.y > 1;
      }
    }
    if (me.grounded) {
      if (tick - this.hopAt > 2) this.tuckHop = false;
    } else if (this.tuckHop) buttons = buttons & -641 | BUTTON_CROUCH;
    this.doing = doing;
    if (this.checkStuck(view, this.meantToMove && (moveYaw !== null || backOff)) && (!me.climbing || me.grounded) || this.jumpNext) {
      buttons |= BUTTON_JUMP;
      this.jumpNext = false;
    }
    if (pk) buttons = buttons & -940 | pk.buttons;
    if (this.state === "mount" && this.mountPlan) {
      const m = view.mounts?.find((x) => x.index === this.mountPlan.index);
      if (m && inBoardingReach(m, me.pos) && tick - this.lastUseTick > 20) {
        buttons |= BUTTON_USE;
        this.lastUseTick = tick;
        this.boardTry ??= { index: m.index, tick };
        this.boarding.tries++;
      }
    }
    this.steerable = aimedTarget && wantFire && !sprint && !dodge && !throwNow && !pressNow && !this.throwPlan && !this.pressPlan && !this.holdStill && this.state !== "mount" && !this.link;
    return { seq, forward, right, yaw: this.yaw, pitch: this.pitch, buttons, weapon: this.chooseWeapon(view, target) };
  }
  /**
   * A steering tick (big matches, a fighting bot between its full thinks:
   * Match.runBots): no new decisions or route, but perception runs when it is
   * due (so a bot notices as fast as when it thinks every tick), the aim keeps
   * tracking the target, the trigger discipline runs, and the move carries on
   * in the same direction over the ground. Null when the bot should think in
   * full: it wasn't simply aiming at its target, perception picked another
   * target or lost it, or a decision is due.
   */
  steer(view) {
    const me = view.self;
    if (!this.steerable || !me.alive || this.targetSlot === null) return null;
    const tick = view.tick;
    if ((tick + this.slot) % DECIDE_TICKS === 0) return null;
    if (me.health < this.lastHealth || view.shotAt && tick - view.shotAt.tick <= 1) return null;
    if ((tick + this.slot) % this.difficulty.perceptionIntervalTicks === 0) {
      const was = this.targetSlot;
      this.perceive(view);
      if (this.targetSlot !== was) return null;
    }
    let target;
    for (const o of view.others) {
      if (o.slot === this.targetSlot) {
        target = o;
        break;
      }
    }
    if (!target?.alive) return null;
    const ctx = this.aimContext(view);
    const ta = simProfile.on ? performance.now() : 0;
    const aimed = this.aimed;
    aimed.slot = target.slot;
    aimed.pos = this.aimPos(ctx.weapon, target);
    aimed.stance = this.aimStance(ctx.weapon, target) ?? 0;
    aimed.size = target.size ?? 1;
    this.aim.track(ctx, aimed);
    const sol = this.aim.solve(ctx, aimed);
    this.turnToward(sol.yaw, sol.pitch);
    const fire = this.aim.trigger(ctx, sol, this.yaw, this.pitch, this.reacted(view, target), this.shotCheck(view, ctx, sol, target)) && !this.holdingForShield(me, target, tick);
    if (simProfile.on) simProfile.add("botAim", performance.now() - ta);
    this.lastTargetTick = tick;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const def = ctx.weapon;
    return { forward: sin * this.moveX + cos * this.moveZ, right: cos * this.moveX - sin * this.moveZ, yaw: this.yaw, pitch: this.pitch, fire, zoom: !!(def?.view.zoomFov && !def.alt && sol.dist > 7) };
  }
  /** Scratch for steer()'s aim target. */
  aimed = { slot: -1, pos: { x: 0, y: 0, z: 0 }, stance: 0, size: 1 };
  sightCache = { tick: -Infinity, ok: false };
  /** Line of sight to a spot, rechecked a few times a second (it only steers the look). */
  canSee(view, eye, p) {
    if (view.tick - this.sightCache.tick >= DECIDE_TICKS) {
      const at2 = { x: p.x, y: p.y + 1.2, z: p.z };
      this.sightCache = { tick: view.tick, ok: view.physics.lineOfSight(eye, at2) && !(view.smoke && smokeBlocks(eye, at2, view.smoke)) };
    }
    return this.sightCache.ok;
  }
  // ------------------------------------------------------------------ clear shot
  /** Trigger pulls held because the line was blocked (tests and the probe). */
  blockedShots = 0;
  /** No shooting from here: stand up / step aside to get a line on the target, until `until`. */
  shotBlocked = null;
  holdFireUntil = -Infinity;
  /** Last clear verdict: when, and the aim and position it was for. */
  clearAt = { tick: -Infinity, yaw: 0, pitch: 0, x: 0, y: 0, z: 0 };
  clearCheck;
  shotView = null;
  shotCtx = null;
  shotSol = null;
  shotTarget = void 0;
  shotDir = { x: 0, y: 0, z: 0 };
  shotPoint = { x: 0, y: 0, z: 0 };
  /** The clear-shot check for this tick's trigger pull (asked by the aim model only when a round would go). */
  shotCheck(view, ctx, sol, target) {
    this.shotView = view;
    this.shotCtx = ctx;
    this.shotSol = sol;
    this.shotTarget = target;
    return this.clearCheck;
  }
  /**
   * Would a round fired now reach the target? One ray from the eye (where the
   * sim starts every shot) along the bot's aim, to just short of the aim
   * point. Blocked, the bot holds fire, and works out why with one or two more
   * rays: its wandering aim was on something beside or in front of a target in
   * the open (it corrects, as a person seeing their crosshair on a rock
   * would); only their upper body shows over low cover (it aims higher); or
   * nothing of them can be hit from here (it stands up, or steps aside, for a
   * moment). Lobbed rounds, melee, and shots at vehicles and gun emplacements
   * (their bodies are what it shoots) aren't checked.
   */
  clearShot() {
    const view = this.shotView;
    const ctx = this.shotCtx;
    const sol = this.shotSol;
    const target = this.shotTarget;
    const def = ctx.weapon;
    const proj = def?.projectile;
    if (!def || def.kind === "melee" || proj && proj.gravity > 0 || target?.mounted || target?.object) return true;
    const tick = view.tick;
    if (tick < this.holdFireUntil) return false;
    const margin = target ? Math.max(CLEAR_MARGIN, (proj?.splashRadius ?? 0) * 0.7) : SUPPRESS_MARGIN;
    const reach2 = sol.dist - margin;
    if (reach2 < 1) return true;
    const eye = ctx.eye;
    const c = this.clearAt;
    if (tick - c.tick < CLEAR_TTL && Math.abs(angleDelta(c.yaw, this.yaw)) < 0.02 && Math.abs(c.pitch - this.pitch) < 0.02 && Math.abs(c.x - eye.x) + Math.abs(c.y - eye.y) + Math.abs(c.z - eye.z) < 0.25) return true;
    const pitch = this.pitch - CLEAR_UNDER;
    const cp = Math.cos(pitch);
    const dir = this.shotDir;
    dir.x = Math.sin(this.yaw) * cp;
    dir.y = Math.sin(pitch);
    dir.z = Math.cos(this.yaw) * cp;
    if (simProfile.on) simProfile.count("botClearShot");
    if (view.physics.raycastHit(eye, dir, reach2) === null) {
      c.tick = tick;
      c.yaw = this.yaw;
      c.pitch = this.pitch;
      c.x = eye.x;
      c.y = eye.y;
      c.z = eye.z;
      return true;
    }
    this.blockedShots++;
    this.holdFireUntil = tick + BLOCKED_HOLD;
    c.tick = -Infinity;
    this.steerable = false;
    if (!target) return false;
    const size = target.size ?? 1;
    const height = STANCES[target.stance ?? 0].height * size;
    const p = this.shotPoint;
    p.x = target.pos.x;
    p.z = target.pos.z;
    p.y = target.pos.y + height * 0.6;
    if (view.physics.shotLine(eye, p)) {
      this.aim.correct();
      return false;
    }
    p.y = target.pos.y + height - 0.3 * size;
    if (view.physics.shotLine(eye, p)) {
      this.aim.raise(tick + TICK_RATE * 1.5);
      this.aim.correct();
      if ((view.self.stance ?? 0) !== 0) this.shotBlocked = { until: tick + Math.round(TICK_RATE * (0.8 + this.slot % 5 * 0.1)), side: false };
      return false;
    }
    this.shotBlocked = { until: tick + Math.round(TICK_RATE * (0.8 + this.slot % 5 * 0.1)), side: (view.self.stance ?? 0) === 0 };
    return false;
  }
  /** Searching and clearing at a walk, not a run (berserkers don't bother). */
  careful() {
    if (this.methodical) return true;
    return !this.berserker && !this.arena && this.tactical > 0.3;
  }
  /**
   * Keeping watch (owner, 2026-11-06: "why would some bots not be moving at all?"): a bot holding a spot on
   * purpose (a CTF defender by its flag, an escort by the carrier, a bot told to hold, a squad member waiting on
   * the squad's next goal) doesn't stand like a statue. Every few seconds it walks to another place round the
   * spot (in sight of its middle, toward where the enemy comes from), watches that way with a slow sweep and a
   * glance over its shoulder now and then, turns to a threat it knows of, and crouches and stands up again
   * (peeking). One nav lookup and one sight line per new place; nothing else per tick but a few sums.
   */
  keepWatch(view, g, brisk = false) {
    const me = view.self.pos;
    const tick = view.tick;
    let w = this.watch;
    if (!w || tick >= w.until || horizontalDistance(w.spot, g.pos) > g.radius + 0.5) w = this.watch = this.watchSpot(view, g, w, brisk);
    const recent = (t2) => tick - t2 < TICK_RATE * 12;
    const keep = this.memoryTicks;
    let look = null;
    const shotTurned = tick - this.underFireTick >= this.difficulty.shotTurnMs / 1e3 * TICK_RATE;
    if (this.threatFrom && recent(this.underFireTick) && shotTurned) look = Math.atan2(this.threatFrom.x - me.x, this.threatFrom.z - me.z);
    else if (this.lastKnown && recent(this.lastKnown.tick)) look = Math.atan2(this.lastKnown.pos.x - me.x, this.lastKnown.pos.z - me.z);
    else {
      const m = this.remembered(view);
      if (m && (m.source !== "shot" || shotTurned)) look = Math.atan2(m.pos.x - me.x, m.pos.z - me.z);
      else if (this.heard && tick - this.heard.tick < keep) look = Math.atan2(this.heard.pos.x - me.x, this.heard.pos.z - me.z);
    }
    const t = tick + this.slot * 41;
    let peeking = false;
    if (look === null) {
      const k = Math.floor((tick - w.since) / w.dwell);
      look = w.looks[k % w.looks.length];
      peeking = !!w.peek && (tick - w.since) % (w.dwell * 3) < w.dwell;
      if (peeking) look = w.looks[0];
      look += Math.sin(t / 40) * 0.18;
    } else look += Math.sin(t / 50) * 0.35;
    const glance = t % (TICK_RATE * 7) < TICK_RATE * 0.8 ? Math.PI * 0.7 * (this.slot % 2 ? 1 : -1) : 0;
    this.turnToward(look + glance, Math.sin(t / 90) * 0.05);
    const at2 = peeking ? w.peek : w.spot;
    let moveYaw = horizontalDistance(me, at2) > (peeking ? 0.3 : 0.5) ? peeking && horizontalDistance(me, w.spot) < 2 ? Math.atan2(at2.x - me.x, at2.z - me.z) : this.followPathTo(view, w.spot, false) : null;
    if (moveYaw === null && this.pathMiss) {
      w.until = tick;
      this.pathMiss = false;
      moveYaw = null;
    }
    const period = TICK_RATE * (4 + this.slot % 3);
    const down = t % period < period * (this.careful() ? 0.55 : 0.3);
    return { moveYaw, moveScale: 0.5, stance: moveYaw === null && down && view.self.grounded !== false ? 1 : 0 };
  }
  /** The last outOfReach answer: for which goal, until when, and the stand-in (null: reachable). */
  reachMemo = null;
  /**
   * A goal no route reaches from where the bot is, which is in the main area (nothing to get off first): the place
   * as near it as a route gets (NavWorld.standIn, known per component of routes and goal for the match). Null when
   * a route reaches it, or the bot is off the main area (followPathTo's escapes and stand-ins see to that). Asked at
   * most every second for the same goal.
   */
  outOfReach(view, goal) {
    const m = this.reachMemo;
    if (m && view.tick < m.until && horizontalDistance(m.goal, goal) < 1.5 && Math.abs(m.goal.y - goal.y) < 1.5) return m.near;
    const me = view.self.pos;
    const si = view.self.grounded !== false && view.nav.inMain(me) ? view.nav.standIn(me, goal) : null;
    const near2 = si && !si.exact && (horizontalDistance(si.pos, goal) > 0.5 || Math.abs(si.pos.y - goal.y) > 1.5) ? si.pos : null;
    this.reachMemo = { goal: { ...goal }, until: view.tick + TICK_RATE, near: near2 };
    return near2;
  }
  /** The next place to keep watch from: inside the area, on its floor, in sight of its middle, not where it just was. */
  watchSpot(view, g, prev, brisk = false) {
    const hold = brisk ? 1.5 + this.routeRng() * 2 : (this.methodical ? 6 : this.arena ? 2.5 : 4) + this.routeRng() * 5;
    const facing = g.watch ? Math.atan2(g.watch.x - g.pos.x, g.watch.z - g.pos.z) : null;
    let spot2 = { ...g.pos };
    let part;
    if (g.radius >= 1.5) {
      for (let i = 0; i < 3; i++) {
        const a = facing !== null ? facing + (this.routeRng() - 0.5) * Math.PI * 1.3 : this.routeRng() * Math.PI * 2;
        const r = g.radius * (0.3 + this.routeRng() * 0.6);
        const p = view.nav.closestPoint({ x: g.pos.x + Math.sin(a) * r, y: g.pos.y + 0.5, z: g.pos.z + Math.cos(a) * r }, { x: 1.5, y: 2, z: 1.5 });
        if (!p || horizontalDistance(p, g.pos) > g.radius || Math.abs(p.y - g.pos.y) > 2) continue;
        if (prev && horizontalDistance(p, prev.spot) < 1.5) continue;
        if (part === void 0) part = view.nav.partAt(g.pos)?.id ?? null;
        if (view.nav.partAt(p)?.id !== part) continue;
        if (!view.physics.lineOfSight({ x: g.pos.x, y: g.pos.y + 1.2, z: g.pos.z }, { x: p.x, y: p.y + 1.2, z: p.z })) continue;
        spot2 = p;
        break;
      }
    }
    const yaw = facing ?? (horizontalDistance(spot2, g.pos) > 0.5 ? Math.atan2(spot2.x - g.pos.x, spot2.z - g.pos.z) : this.yaw);
    const { looks, peek } = this.scanFrom(view, spot2, yaw);
    const dwell = Math.max(TICK_RATE * 0.8, Math.round(TICK_RATE * this.difficulty.scanDwell * (0.75 + this.skillRng() * 0.5)));
    return { spot: spot2, until: view.tick + Math.round(TICK_RATE * hold), yaw, looks, since: view.tick, dwell, peek };
  }
  /**
   * The angles a bot holding `spot` scans (Phase D item 2): the way it watches first, then the chokepoint hints near it
   * (the map's: bots/hints.ts), then the two most open of eight ways (rays at eye height, once per spot), each at least
   * 50 degrees from the others. And a peek: when the way it watches is blocked within 2.5 m (a wall's corner), a step
   * of 1.2 m to the side from which it is open (stepping out to look, then back).
   */
  scanFrom(view, spot2, yaw) {
    const looks = [yaw];
    const apart = (a) => looks.every((l) => Math.abs(angleDelta(l, a)) > 0.87);
    const eye = { x: spot2.x, y: spot2.y + PLAYER.eyeHeight, z: spot2.z };
    for (const c of chokesNear(view.plan?.hints?.chokes ?? [], spot2, 35)) {
      if (looks.length >= 3) break;
      if (horizontalDistance(c.pos, spot2) < 2) continue;
      const a = Math.atan2(c.pos.x - spot2.x, c.pos.z - spot2.z);
      if (apart(a) && view.physics.lineOfSight(eye, { x: c.pos.x, y: c.pos.y + 1.2, z: c.pos.z })) looks.push(a);
    }
    const open = [];
    let ahead = 0;
    for (let k = 0; k < 8; k++) {
      const a = yaw + k / 8 * Math.PI * 2;
      const d = view.physics.raycastWorld(eye, { x: Math.sin(a), y: 0, z: Math.cos(a) }, 40) ?? 40;
      if (k === 0) ahead = d;
      else open.push({ a, d });
    }
    open.sort((p, q) => q.d - p.d);
    for (const o of open) {
      if (looks.length >= 4) break;
      if (o.d >= 8 && apart(o.a)) looks.push(o.a);
    }
    let peek = null;
    if (ahead < 2.5) {
      for (const side of [1, -1]) {
        const p = view.nav.closestPoint({ x: spot2.x + Math.cos(yaw) * 1.2 * side, y: spot2.y + 0.5, z: spot2.z - Math.sin(yaw) * 1.2 * side }, { x: 0.6, y: 1.5, z: 0.6 });
        if (!p || Math.abs(p.y - spot2.y) > 0.6 || horizontalDistance(p, spot2) < 0.6) continue;
        const pe = { x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z };
        if (!view.physics.lineOfSight({ x: spot2.x, y: spot2.y + 0.5, z: spot2.z }, { x: p.x, y: p.y + 0.5, z: p.z })) continue;
        if ((view.physics.raycastWorld(pe, { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }, 12) ?? 12) < 6) continue;
        peek = p;
        break;
      }
    }
    return { looks, peek };
  }
  /** Where to retreat to: health close by, or the far side from the threat; re-picked only now and then. */
  refuge(view, threat) {
    const me = view.self.pos;
    const r = this.retreatGoal;
    if (!r || view.tick >= r.until || horizontalDistance(me, r.pos) < 1.5) {
      const pos = this.pickupGoal(view, "health") ?? farthest(view.spawnPoints, threat) ?? me;
      this.retreatGoal = { pos: { ...pos }, until: view.tick + Math.round(TICK_RATE * (3.5 + this.rng() * 2)) };
    }
    return this.retreatGoal.pos;
  }
  /**
   * Strafing: commit to a direction for a while (shorter, with the odd quick
   * juke, for better bots), then usually reverse; turn round straight away
   * when blocked.
   */
  updateStrafe(tick) {
    const id = this.difficulty.id;
    if (tick - this.lastStrafeTick > TICK_RATE / 2) {
      this.strafeDir = this.rng() < 0.5 ? -1 : 1;
      this.nextStrafeFlip = tick + this.strafeRun(id);
      this.strafeStart = tick;
    } else if (tick >= this.nextStrafeFlip || tick - this.strafeStart > 18 && this.speed < 0.8) {
      const blocked = tick < this.nextStrafeFlip;
      if (blocked || this.rng() < (id === "hard" ? 0.8 : 0.7)) this.strafeDir = -this.strafeDir;
      this.nextStrafeFlip = tick + this.strafeRun(id);
      this.strafeStart = tick;
    }
    this.lastStrafeTick = tick;
  }
  /** Length (ticks) of one strafe run. */
  strafeRun(id) {
    if (id === "hard" && this.rng() < 0.2) return Math.round(TICK_RATE * (0.25 + this.rng() * 0.15));
    const [lo, span] = id === "hard" ? [0.5, 0.8] : id === "easy" ? [0.8, 0.9] : [0.6, 1];
    return Math.round(TICK_RATE * (lo + this.rng() * span));
  }
  /**
   * Ease the movement intent in and out (in world space, so turning doesn't
   * smear it) rather than snapping between directions each tick: no
   * stutter-steps. Better bots change direction more sharply; out of a
   * fight the easing is slight, so the bot keeps to its route round corners.
   */
  smoothMove(forward, right, fighting) {
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wx = sin * forward + cos * right;
    const wz = cos * forward - sin * right;
    const tau = !fighting ? 0.035 : this.difficulty.id === "hard" ? 0.06 : this.difficulty.id === "easy" ? 0.12 : 0.09;
    const k = 1 - Math.exp(-TICK_DT / tau);
    this.moveX += (wx - this.moveX) * k;
    this.moveZ += (wz - this.moveZ) * k;
    if (wx === 0 && wz === 0 && hypot(this.moveX, this.moveZ) < 0.08) this.moveX = this.moveZ = 0;
    return [sin * this.moveX + cos * this.moveZ, cos * this.moveX - sin * this.moveZ];
  }
  reacted(view, target) {
    const since = this.visibleSince.get(target.slot);
    if (since === void 0) return false;
    return view.tick >= (this.reactAt.get(target.slot) ?? since + this.reactionTicks());
  }
  /**
   * This sighting's reaction (ticks; Phase D item 3, skill tiers that feel human): its tier's and personality's
   * reaction, for a fresh contact up to `reactionSpread` longer, longer by `surprise` for someone showing
   * outside its view (behind or beside it), shorter by `prepared` for someone showing where it expected them (a
   * remembered spot at least a second old: memory.ts).
   */
  reactAfter(o, outOfView, tick) {
    const d = this.difficulty;
    const keep = this.memoryTicks;
    let f = this.enemies.knows(o.slot, tick, keep) ? 1 : 1 + d.reactionSpread * this.skillRng();
    if (outOfView) f *= 1 + d.surprise;
    else if (this.enemies.expected(o.pos, tick, keep)) f *= 1 - d.prepared;
    return Math.max(1, Math.ceil(this.reactionTicks() * f));
  }
  /** How long (ticks) it remembers an enemy's spot, a shot or a callout (its tier's memorySeconds). */
  get memoryTicks() {
    return this.difficulty.memorySeconds * TICK_RATE;
  }
  /**
   * Memory upkeep at each look about (memory.ts): old spots go, the dead are forgotten (once a second), and its side's
   * callouts since the last look, within its tier's calloutRange of it, come in.
   */
  recall(view) {
    const tick = view.tick;
    const mem = this.enemies;
    if ((tick + this.slot) % TICK_RATE < this.difficulty.perceptionIntervalTicks) {
      mem.expire(tick, this.memoryTicks);
      for (let i = mem.spots.length - 1; i >= 0; i--) {
        const e = mem.spots[i];
        if (e.slot < 0) continue;
        let alive = false;
        for (const o of view.others) {
          if (o.slot === e.slot) {
            alive = o.alive;
            break;
          }
        }
        if (!alive) mem.forget(e.slot);
      }
    }
    const board = view.plan?.callouts;
    if (board) {
      const since = this.calloutsRead < 0 ? tick - TICK_RATE : this.calloutsRead;
      this.calloutsRead = tick;
      board.read(since, view.self.pos, this.difficulty.calloutRange, this.slot, (c) => {
        if (c.slot !== this.targetSlot) mem.note(c.slot, c.pos, c.tick, "callout");
      });
    }
  }
  /** The remembered spot most worth a look (null: none, or a dead one), within `range` m. */
  remembered(view, range = 60) {
    return this.enemies.best(view.self.pos, view.tick, this.memoryTicks, range);
  }
  wantsProne(view, dist) {
    const def = this.heldDef(view);
    const scoped = !!def?.view.zoomFov;
    const sniper = hasTag(this.profile, "SNIPER") || this.methodical && this.tactical > 0.75 && scoped && dist > 28;
    return sniper && dist > 22 && (scoped || (def?.botRange[0] ?? 0) >= 10) && view.tick - this.underFireTick > TICK_RATE * 2;
  }
  /**
   * Behind cover: get there (sprinting if under fire), then alternate hiding
   * (crouched, reloading) and peeking (standing up over low cover or leaning
   * out past tall cover) to shoot.
   */
  inCover(view, threat, def) {
    const me = view.self;
    const tick = view.tick;
    const c = this.cover;
    const d = horizontalDistance(me.pos, c.pos);
    const underFire = tick - this.underFireTick < TICK_RATE * 1.2;
    if (d > 0.45 && !(this.peekPhase === "peek" && c.peek !== 0 && d < 1.8)) {
      const moveYaw = this.followPathTo(view, c.pos, false);
      if (moveYaw === null) {
        this.cover = null;
        return { moveYaw: null, sprint: false, stance: 0, moveScale: 1, shoot: true };
      }
      const sprint = d > 2.5 && (underFire || this.hurt(view) || this.state === "retreat");
      return { moveYaw, sprint, stance: 0, moveScale: 1, shoot: !sprint };
    }
    if (tick >= this.phaseUntil) {
      const aggr = this.profile.aggression / 100;
      if (this.peekPhase === "hide") {
        this.peekPhase = "peek";
        this.peeks++;
        this.phaseUntil = tick + Math.round(TICK_RATE * (0.7 + this.rng() * 0.9 + aggr * 0.6) * (underFire ? 0.75 : 1));
      } else {
        this.peekPhase = "hide";
        this.phaseUntil = tick + Math.round(TICK_RATE * (0.6 + this.rng() * 0.8 + (1 - aggr) * 0.6));
      }
    }
    if (tick - this.lastTargetTick > TICK_RATE * 2 && this.peeks > 2 && !underFire) {
      this.cover = null;
      return { moveYaw: null, sprint: false, stance: 0, moveScale: 1, shoot: false };
    }
    const reloading = !!view.reloading;
    const held = this.heldWeapon(view);
    const empty = !!held && held.def.magazine > 0 && held.mag === 0;
    const sniping = this.wantsProne(view, horizontalDistance(me.pos, threat)) && c.low;
    if (this.peekPhase === "hide" || reloading || empty) {
      return { moveYaw: d > 0.35 ? this.followPathTo(view, c.pos, false) : null, sprint: false, stance: 1, moveScale: 0.5, shoot: false };
    }
    if (c.low) return { moveYaw: null, sprint: false, stance: sniping ? 1 : 0, moveScale: 1, shoot: true };
    if (c.peek !== 0) {
      const tx = c.threat.x - c.pos.x;
      const tz = c.threat.z - c.pos.z;
      const l = hypot(tx, tz) || 1;
      const lean = { x: c.pos.x + tz / l * c.peek * 1.1, y: c.pos.y, z: c.pos.z - tx / l * c.peek * 1.1 };
      const moveYaw = horizontalDistance(me.pos, lean) > 0.3 ? Math.atan2(lean.x - me.pos.x, lean.z - me.pos.z) : null;
      return { moveYaw, sprint: false, stance: 0, moveScale: 0.8, shoot: true };
    }
    this.cover = null;
    return { moveYaw: null, sprint: false, stance: 0, moveScale: 1, shoot: true };
  }
  /** Fire at a spot where an enemy went out of sight (suppression). */
  suppress(view, pos, ctx) {
    const aimAt = { x: pos.x, y: pos.y + 1, z: pos.z };
    const want = lookAngles(ctx.eye, aimAt);
    const wob = 0.04 * Math.sin(view.tick * 0.21 + this.slot);
    const sol = { yaw: want.yaw + wob, pitch: want.pitch + wob * 0.3, dist: distance(ctx.eye, aimAt), halfAngle: 0.08 };
    this.turnToward(sol.yaw, sol.pitch);
    return sol;
  }
  // ------------------------------------------------------------------ corners and rooms
  /**
   * Before going round a corner or through a doorway the bot slows and looks
   * into the space beyond, sweeping across it ("pieing" the corner); once
   * through, it checks the room's corners in turn. Spaces it went through
   * recently are not re-checked.
   */
  checkCorners(view) {
    const me = view.self;
    const tick = view.tick;
    if (this.pie) {
      const p = this.pie;
      if (tick >= p.until) {
        this.pie = null;
        this.clearing = { corner: p.corner, yaw: Math.atan2(p.points[1].x - p.corner.x, p.points[1].z - p.corner.z), points: [], start: 0, until: tick + TICK_RATE * 6 };
      } else {
        const per = Math.max(1, (p.until - p.start) / p.points.length);
        const idx = clamp(Math.floor((tick - p.start) / per), 0, p.points.length - 1);
        const d = horizontalDistance(me.pos, p.corner);
        return { pause: d > 2 ? 0.3 : 0, look: p.points[idx] };
      }
    }
    if (this.clearing) {
      const c2 = this.clearing;
      if (c2.points.length === 0) {
        const d = horizontalDistance(me.pos, c2.corner);
        const ahead = (me.pos.x - c2.corner.x) * Math.sin(c2.yaw) + (me.pos.z - c2.corner.z) * Math.cos(c2.yaw);
        if (tick > c2.until || d > 8) {
          this.clearing = null;
          return {};
        }
        if (ahead < 0.6) return {};
        const eye = { x: me.pos.x, y: me.pos.y + 1.4, z: me.pos.z };
        const pts2 = fanPoints(view.physics, eye, c2.yaw, 1.3, 4, 16);
        c2.points = [pts2[0], pts2[3], pts2[1], pts2[2]];
        c2.start = tick;
        c2.until = tick + Math.round(TICK_RATE * (0.8 + this.tactical * 0.8));
      }
      if (tick < c2.until) {
        const per = Math.max(1, (c2.until - c2.start) / c2.points.length);
        const i = clamp(Math.floor((tick - c2.start) / per), 0, c2.points.length - 1);
        return { pause: 0.6, look: c2.points[i] };
      }
      this.clearing = null;
      return {};
    }
    if (!this.careful() || (tick + this.slot) % 4 !== 0) return {};
    const c = this.path[this.pathIndex];
    if (!c) return {};
    const dc = horizontalDistance(me.pos, c);
    if (dc < 0.5) return {};
    const dirX = (c.x - me.pos.x) / dc;
    const dirZ = (c.z - me.pos.z) / dc;
    let at2 = null;
    let yawIn = 0;
    const probeD = Math.min(dc, 2.4);
    const probe = { x: me.pos.x + dirX * probeD, y: me.pos.y, z: me.pos.z + dirZ * probeD };
    const beyond = { x: probe.x + dirX * 1.8, y: probe.y, z: probe.z + dirZ * 1.8 };
    const doorKey = `d${Math.round(probe.x / 2)},${Math.round(probe.y)},${Math.round(probe.z / 2)}`;
    if (!this.recentlyChecked(doorKey, tick) && isDoorway(view.physics, probe, dirX, dirZ, 2.3) && !isDoorway(view.physics, beyond, dirX, dirZ, 2.8)) {
      this.markChecked(doorKey, tick);
      at2 = probe;
      yawIn = Math.atan2(dirX, dirZ);
    } else {
      const next = this.path[this.pathIndex + 1];
      const k = key(c);
      if (next && dc < 3.2 && !this.recentlyChecked(k, tick) && turnAngle(me.pos, c, next) > 0.75) {
        this.markChecked(k, tick);
        at2 = c;
        yawIn = Math.atan2(next.x - c.x, next.z - c.z);
      }
    }
    if (!at2) return {};
    const into = { x: at2.x + Math.sin(yawIn) * 4, y: at2.y, z: at2.z + Math.cos(yawIn) * 4 };
    if (this.memory.ageSeconds(into, tick) < 20) return {};
    const pts = fanPoints(view.physics, { x: at2.x, y: at2.y + 1.4, z: at2.z }, yawIn, 0.85, 4, 16);
    const side = Math.sign(angleDelta(Math.atan2(at2.x - me.pos.x, at2.z - me.pos.z), yawIn)) || 1;
    if (side > 0) pts.reverse();
    this.pie = { start: tick, until: tick + Math.round(TICK_RATE * (0.6 + this.tactical * 0.9)), points: pts, corner: { ...at2 } };
    return { pause: 0.3, look: pts[0] };
  }
  recentlyChecked(k, tick) {
    const last = this.checked.get(k);
    return last !== void 0 && tick - last < TICK_RATE * 25;
  }
  markChecked(k, tick) {
    this.checked.set(k, tick);
    if (this.checked.size > 48) this.checked.delete(this.checked.keys().next().value);
  }
  // ------------------------------------------------------------------ grenades
  /**
   * Throw a grenade to flush an enemy out of cover (last seen moments ago,
   * now hidden, in throwing range) or into a room it is about to clear where
   * an enemy was heard. The throw is solved so it lands there, not at the
   * door frame or the enemy's face.
   */
  considerGrenade(view, target) {
    const tick = view.tick;
    if (this.throwPlan || tick < this.nextThrow || !(view.throwables ?? 0) || !view.throwable || view.throwable === "mine" || view.throwable === "sandbag" || view.throwable === "smoke") return;
    if (this.rng() > 0.25 + this.tactical * 0.5) return;
    const me = view.self;
    const eye = { x: me.pos.x, y: me.pos.y + STANCES[me.stance ?? 0].eye, z: me.pos.z };
    const walking = THROWABLE_DEFS[view.throwable].projectile;
    if (walking.walker) return this.considerWalker(view, target, eye, walking);
    let at2 = null;
    if (!target && this.lastKnown && tick - this.lastKnown.tick > TICK_RATE * 0.6 && tick - this.lastKnown.tick < TICK_RATE * 5) {
      const d = horizontalDistance(me.pos, this.lastKnown.pos);
      if (d > 7 && d < 24 && !view.physics.lineOfSight(eye, { x: this.lastKnown.pos.x, y: this.lastKnown.pos.y + 1, z: this.lastKnown.pos.z })) at2 = this.lastKnown.pos;
    } else if (!target && this.heard && tick - this.heard.tick < TICK_RATE * 6 && this.pie) {
      const d = horizontalDistance(me.pos, this.heard.pos);
      if (d > 5.5 && d < 22) at2 = this.heard.pos;
    } else if (target && this.targetMount?.kind === "vehicle" && (this.targetMount.speed ?? 0) < 3 && THROWABLE_DEFS[view.throwable].projectile.splashDamage >= ANTI_VEHICLE_SPLASH) {
      const d = horizontalDistance(me.pos, this.targetMount.pos);
      if (d > 8 && d < 22) at2 = this.targetMount.pos;
    } else if (target && this.cover && this.peekPhase === "hide") {
      const d = horizontalDistance(me.pos, target.pos);
      if (d > 9 && d < 22 && this.rng() < 0.15) at2 = target.pos;
    }
    if (!at2 || !grenadeWorthIt(view.throwables ?? 0, !!target, this.tactical)) return;
    const spec = THROWABLE_DEFS[view.throwable].projectile;
    const sol = solveThrow(view.physics, eye, at2, spec);
    if (!sol) {
      this.nextThrow = tick + TICK_RATE;
      return;
    }
    const near2 = horizontalDistance(sol.impact, me.pos);
    if (near2 < spec.splashRadius + 0.5) {
      if (spec.fuseSeconds < 2.5 || near2 < spec.splashRadius * 0.5) return;
      this.throwPlan = { yaw: sol.yaw, pitch: sol.pitch, until: tick + TICK_RATE, clear: sol.impact, fuse: spec.fuseSeconds };
      return;
    }
    this.throwPlan = { yaw: sol.yaw, pitch: sol.pitch, until: tick + TICK_RATE };
  }
  /**
   * A walker (the sheep: it lands, waddles on the way it was thrown, hops over low things and goes off on the first
   * enemy it meets) at an enemy in sight, or seen a moment ago, 6-20 m off across open ground: thrown short along the
   * line to them (its slow throw carries 5-6 m), it walks the rest before its fuse runs out.
   */
  considerWalker(view, target, eye, spec) {
    const tick = view.tick;
    const me = view.self;
    const goal = target?.pos ?? (this.lastKnown && tick - this.lastKnown.tick < TICK_RATE * 3 ? this.lastKnown.pos : null);
    if (!goal || !grenadeWorthIt(view.throwables ?? 0, !!target, this.tactical)) return;
    const d = horizontalDistance(me.pos, goal);
    if (d < 6 || d > 20 || Math.abs(goal.y - me.pos.y) > 1.2) return;
    const reach2 = Math.min(d - 2, spec.speed * spec.speed / spec.gravity * 0.8);
    if (reach2 < 2.5 || (d - reach2) / spec.walker.speed > spec.fuseSeconds - 1.5) return;
    const land = { x: me.pos.x + (goal.x - me.pos.x) / d * reach2, y: me.pos.y, z: me.pos.z + (goal.z - me.pos.z) / d * reach2 };
    if (!view.physics.lineOfSight({ x: land.x, y: land.y + 0.4, z: land.z }, { x: goal.x, y: goal.y + 0.4, z: goal.z })) {
      this.nextThrow = tick + TICK_RATE;
      return;
    }
    const sol = solveThrow(view.physics, eye, land, spec, 1.5);
    if (!sol) {
      this.nextThrow = tick + TICK_RATE;
      return;
    }
    this.throwPlan = { yaw: sol.yaw, pitch: sol.pitch, until: tick + TICK_RATE };
  }
  /**
   * A smoke screen (a smoke grenade carried): caught in the open by an enemy 10-45 m off (no cover, and hurt or shot
   * at), the bot throws one a few metres out toward it, so the cloud stands between them while it moves on or back:
   * the enemy loses sight of it (bots and turrets alike; rounds still pass). Tactical bots do it more. Bounding cover
   * to cover (Phase B, boundPhase), the moving half sends one ahead before it crosses open ground (docs/BOTS.md, "Smoke").
   */
  considerSmoke(view, target) {
    const tick = view.tick;
    if (view.throwable !== "smoke" || !(view.throwables ?? 0) || this.throwPlan || tick < this.nextThrow || !target || this.cover) return;
    if (this.bound === "move" && !view.reloading) {
      this.smokeScreen(view, target.pos);
      return;
    }
    const me = view.self;
    const shot = !!view.shotAt && tick - view.shotAt.tick < TICK_RATE * 1.5;
    if (me.health >= 70 && !shot) return;
    if (this.rng() > 0.3 + this.tactical * 0.5) return;
    this.smokeScreen(view, target.pos);
  }
  /** Throw smoke a few metres out toward `threat` (the cloud's middle between the bot and it); false when it can't. */
  smokeScreen(view, threat) {
    const me = view.self;
    const d = horizontalDistance(me.pos, threat);
    if (view.throwable !== "smoke" || !(view.throwables ?? 0) || d < 10 || d > 45) return false;
    const k = 5.5 / d;
    const at2 = { x: me.pos.x + (threat.x - me.pos.x) * k, y: me.pos.y, z: me.pos.z + (threat.z - me.pos.z) * k };
    const eye = { x: me.pos.x, y: me.pos.y + STANCES[me.stance ?? 0].eye, z: me.pos.z };
    const sol = solveThrow(view.physics, eye, at2, THROWABLE_DEFS.smoke.projectile, 2.5);
    if (!sol) {
      this.nextThrow = view.tick + TICK_RATE;
      return false;
    }
    this.throwPlan = { yaw: sol.yaw, pitch: sol.pitch, until: view.tick + TICK_RATE };
    return true;
  }
  // ------------------------------------------------------------------ turrets and vehicles
  /** Can hurt a tank's crew (through the tank): something that hurts vehicles, carried or the seat's gun. */
  armedVsTanks(view) {
    return !!view.seat?.weapon && antiVehicle(view.seat.weapon) && view.seat.shells !== 0 || this.canHurtVehicles(view);
  }
  /**
   * Carries something that hurts vehicles properly: a launcher with rounds, or a grenade with a big blast. With an
   * enemy tank about (armourAbout) grenades don't count: two frags barely mark one (100 x 1.25 of its 1200 each).
   */
  canHurtVehicles(view) {
    if (this.hasLauncher(view)) return true;
    if (this.armourAbout(view.tick)) return false;
    const t = view.throwable;
    return !!t && t !== "mine" && t !== "sandbag" && (view.throwables ?? 0) > 0 && THROWABLE_DEFS[t].projectile.splashDamage >= ANTI_VEHICLE_SPLASH;
  }
  /** Carries a weapon that hurts vehicles (antiVehicle: a rocket or grenade launcher) with rounds left. */
  hasLauncher(view) {
    for (const w of view.inventory) if (antiVehicle(w.def) && w.mag + w.reserve > 0) return true;
    return false;
  }
  /**
   * An enemy tank about (any armoured vehicle with an enemy aboard, alive, within ARMOUR_ALERT_RANGE): remembered for
   * VEHICLE_MEMORY s, as an enemy vehicle seen (fetchLauncher), even while its sealed crew isn't the target.
   */
  watchArmour(view) {
    const mounts = view.mounts;
    if (!mounts?.length) return;
    const me = view.self.pos;
    const hostile = slotsOf(view.others);
    let best = null;
    let bestD = ARMOUR_ALERT_RANGE;
    for (const m of mounts) {
      if (m.kind !== "vehicle" || !m.alive || !(m.armoured || m.sealed)) continue;
      const d = horizontalDistance(me, m.pos);
      if (d >= bestD) continue;
      let enemy = false;
      for (const s of m.seats) if (s.by !== void 0 && hostile.has(s.by)) enemy = true;
      if (!enemy) continue;
      best = m;
      bestD = d;
    }
    if (!best) return;
    this.armourMount = best;
    this.armourSeenTick = view.tick;
    this.vehicleSeenTick = view.tick;
  }
  /** An enemy tank was about lately (watchArmour). */
  armourAbout(tick) {
    return tick - this.armourSeenTick <= TICK_RATE * VEHICLE_MEMORY;
  }
  /**
   * An enemy vehicle seen lately (or in sight, not too close) and nothing
   * that hurts it: go for a launcher lying close by (further with a tank
   * about). True when it set off.
   */
  fetchLauncher(view, target) {
    const tick = view.tick;
    if (tick - this.vehicleSeenTick > TICK_RATE * VEHICLE_MEMORY || view.orderGoal) return false;
    if (target && (this.targetMount?.kind !== "vehicle" || horizontalDistance(view.self.pos, target.pos) < 15)) return false;
    const p = this.pickupGoal(view, "weapon", this.armourAbout(tick) ? ARMOUR_LAUNCHER_DETOUR : LAUNCHER_DETOUR, antiVehicle);
    if (!p) return false;
    this.roamGoal = p;
    this.gunNearby = p;
    this.via = null;
    return true;
  }
  /** How long (ticks) this bot takes to react to something it sees. */
  reactionTicks() {
    return this.difficulty.reactionMs / 1e3 * TICK_RATE * (1.5 - this.profile.reactionSpeed / 100);
  }
  /**
   * An enemy vehicle bearing down on the bot (driven at it, or just coming
   * its way): step out of its path, after its reaction time, if it notices
   * at all (easier bots often don't). Arithmetic only, at decision rate; one
   * sight ray when a dodge starts, to pick a side with room.
   */
  watchTraffic(view) {
    const tick = view.tick;
    if (this.dodge && tick >= this.dodge.until) this.dodge = null;
    const mounts = view.mounts;
    if (!mounts?.length) {
      this.roadkill = null;
      return;
    }
    const me = view.self;
    const hostile = slotsOf(view.others);
    let worst = null;
    let hit = null;
    for (const m of mounts) {
      if (m.kind !== "vehicle" || !m.alive || (m.speed ?? 0) < ROADKILL_SPEED) continue;
      let enemyAboard = false;
      for (const s of m.seats) if (s.role === "driver" && s.by !== void 0 && hostile.has(s.by)) enemyAboard = true;
      if (!enemyAboard) continue;
      const h = inVehiclePath(m, me.pos);
      if (h && (!hit || h.eta < hit.eta)) {
        worst = m;
        hit = h;
      }
    }
    if (!worst || !hit) {
      this.roadkill = null;
      return;
    }
    if (this.roadkill?.index !== worst.index) this.roadkill = { index: worst.index, since: tick, notice: this.rng() < 0.4 + 0.6 * this.difficulty.tactics };
    if (!this.roadkill.notice || tick - this.roadkill.since < this.reactionTicks()) return;
    let yaw = hit.away;
    if (!this.dodge && hit.eta > 1.5) {
      const chest2 = { x: me.pos.x, y: me.pos.y + 1, z: me.pos.z };
      if (!view.physics.lineOfSight(chest2, { x: chest2.x + Math.sin(yaw) * 3, y: chest2.y, z: chest2.z + Math.cos(yaw) * 3 })) yaw += Math.PI;
    } else if (this.dodge) yaw = this.dodge.yaw;
    this.dodge = { yaw, until: tick + Math.round(TICK_RATE * DODGE_SECONDS), sprint: hit.eta < DODGE_SPRINT_ETA };
  }
  /**
   * Worth a shell (limited mounted ammunition, the Tank's cannon): a vehicle, a turret or a sentry always; someone on
   * foot only far enough off that the blast spares the tank, and then while there are shells to spare (over
   * SHELL_RESERVE of the load) or with another enemy beside them. Never with none left.
   */
  worthShell(view, shells, max, t) {
    if (shells <= 0) return false;
    if (t.mounted || t.object) return true;
    if (horizontalDistance(view.self.pos, t.pos) < SHELL_MIN_RANGE) return false;
    if (shells > Math.ceil(max * SHELL_RESERVE)) return true;
    for (const o of view.others) if (o !== t && o.alive && horizontalDistance(o.pos, t.pos) < 5) return true;
    return false;
  }
  /**
   * Where a bot at the wheel goes to refill its vehicle's limited gun (the Tank's cannon: its own, driverFires, or a
   * crewmate's), or null: out of shells, an ammo pickup within AMMO_DETOUR; low (AMMO_LOW_SHARE) with no target, or
   * already on its way and not yet full, within AMMO_LOW_DETOUR.
   */
  resupplyFor(view, m, seat, target) {
    const gun = seat.shells !== void 0 ? seat : m.seats.find((s) => s.shells !== void 0 && s.maxShells);
    if (gun?.shells === void 0 || !gun.maxShells) return null;
    if (gun.shells === 0) return this.ammoPickupFor(view, m.pos, gun.refills, AMMO_DETOUR);
    if (gun.shells >= gun.maxShells) return null;
    if (this.tankResupply || !target && gun.shells <= gun.maxShells * AMMO_LOW_SHARE) return this.ammoPickupFor(view, m.pos, gun.refills, AMMO_LOW_DETOUR);
    return null;
  }
  /** One of the pickups that refill the gun (`refills`, SeatAmmo.pickups: the Ammo Box) that is up, within `reach` of `from` (a tank short of shells drives over it), or null. */
  ammoPickupFor(view, from, refills, reach2 = AMMO_DETOUR) {
    if (!refills?.length) return null;
    let best = null;
    let bestD = reach2;
    for (const p of view.pickups) {
      if (!p.available || !refills.includes(p.item.id)) continue;
      if ((this.ammoSkip.get(`${p.pos.x},${p.pos.z}`) ?? -1) > view.tick) continue;
      const d = horizontalDistance(p.pos, from) + Math.abs(p.pos.y - from.y) * 3;
      if (d < bestD) {
        best = p.pos;
        bestD = d;
      }
    }
    return best;
  }
  /** Explosives at an enemy in a vehicle go at the hull (low), not at the head poking out of it. */
  aimStance(def, t) {
    return def && this.targetMount && t.slot === this.targetSlot && antiVehicle(def) ? 2 : t.stance;
  }
  hullAim = { x: 0, y: 0, z: 0 };
  /**
   * Where to aim at `t`: a weapon that hurts vehicles at an enemy in a vehicle goes at the middle of its hull (a tank's
   * crew can't be hit and its turret isn't solid: a rocket at the gunner flies over the deck), with aimStance's low aim
   * point (prone: 0.6 of 0.8 m up) landing on the box's centre. Anyone else: where they stand.
   */
  aimPos(def, t) {
    const m = this.targetMount;
    if (!def || !m || m.kind !== "vehicle" || t.slot !== this.targetSlot || !antiVehicle(def)) return t.pos;
    const h = this.hullAim;
    h.x = m.pos.x;
    h.y = m.pos.y + (m.half?.[1] ?? 0.8) - STANCES[2].height * 0.6 * (t.size ?? 1);
    h.z = m.pos.z;
    return h;
  }
  /**
   * Leave mount `index` alone for a while (stuck in it, couldn't reach it, couldn't get in): each time it gives up on
   * the same one it stays away twice as long (avoidSeconds), so a vehicle nobody can use stops drawing it back.
   */
  giveUpOn(index, tick) {
    if ((this.avoidMounts.get(index) ?? -Infinity) > tick) return;
    const n = (this.giveUps.get(index) ?? 0) + 1;
    this.giveUps.set(index, n);
    this.avoidMounts.set(index, tick + Math.round(TICK_RATE * avoidSeconds(n)));
    this.boardFails.delete(index);
    if (this.boardTry?.index === index) this.boardTry = null;
    this.boarding.gaveUp++;
  }
  considerMount(view, target) {
    const mounts = view.mounts;
    if (!mounts?.length || this.mountPlan || hasTag(this.profile, "NPC") || view.tick < this.nextMountTick) return;
    if ((view.tick + this.slot * 7) % (TICK_RATE / 2) >= DECIDE_TICKS) return;
    const me = view.self;
    const g = view.orderGoal;
    const onStation = !!g && horizontalDistance(me.pos, g.pos) < g.radius + 8;
    const ride = view.allies?.length ? rideFor(mounts, me.pos, me.slot, view.allies, RIDE_REACH, this.skipMount) : null;
    if (ride && !(onStation && horizontalDistance(g.pos, ride.pos) > g.radius + 4)) {
      const close = target && horizontalDistance(me.pos, target.pos) < 12 && horizontalDistance(me.pos, ride.pos) > 6;
      if (!close && this.rng() < 0.6 + this.profile.teamLoyalty / 100 * 0.4) {
        this.mountPlan = { index: ride.index, until: view.tick + TICK_RATE * 8, drive: false, ride: true };
        if (this.giveUps.has(ride.index)) this.boarding.back++;
        this.state = "mount";
        return;
      }
    }
    const enemy = target?.pos ?? (this.lastKnown && view.tick - this.lastKnown.tick < TICK_RATE * 4 ? this.lastKnown.pos : null);
    if (enemy) {
      if (target && horizontalDistance(me.pos, target.pos) < 12) return;
      const m = turretFor(mounts, me.pos, enemy, Math.min(14, horizontalDistance(me.pos, enemy) * 0.6), this.skipMount);
      if (m && this.rng() < 0.4 + this.tactical * 0.6) {
        this.mountPlan = { index: m.index, until: view.tick + TICK_RATE * 6, drive: false };
        if (this.giveUps.has(m.index)) this.boarding.back++;
        this.state = "mount";
      }
      return;
    }
    let goal = this.roamGoal ?? view.orderGoal?.pos ?? null;
    if (!view.orderGoal && (!goal || horizontalDistance(me.pos, goal) < VEHICLE_TRIP)) {
      if (bestLoadedDesirability(view.inventory) <= SIDEARM && this.pickupGoal(view, "weapon", GUN_DETOUR)) return;
      goal = farthest(view.spawnPoints, me.pos) ?? goal;
    }
    if (!goal) return;
    const v = vehicleFor(mounts, me.pos, goal, 22, this.skipMount);
    if (v && this.rng() < 0.5) {
      const route = view.nav.findPath(v.pos, goal);
      if (!route && !v.floats) return;
      if (route && pathLength(route) > horizontalDistance(v.pos, goal) * 1.5 && !v.floats) return;
      if (route && !vehicleRouteFits(view.physics, v, route)) {
        this.avoidMounts.set(v.index, view.tick + TICK_RATE * NO_FIT_SECONDS);
        return;
      }
      this.roamGoal = { ...goal };
      this.via = null;
      this.mountPlan = { index: v.index, until: view.tick + TICK_RATE * 8, drive: true };
      if (this.giveUps.has(v.index)) this.boarding.back++;
      this.state = "mount";
    }
  }
  /** In a turret or vehicle. */
  thinkMounted(view, seq, target, ctx) {
    const tick = view.tick;
    const seat = view.seat;
    const m = view.mounts?.find((x) => x.index === seat.mount);
    if (this.state !== "mounted") {
      this.state = "mounted";
      this.mountedSince = tick;
      this.boardTry = null;
      this.boardFails.delete(seat.mount);
      this.giveUps.delete(seat.mount);
      this.drive = freshDrive();
      this.useLatch = true;
      this.path = [];
      this.goal = null;
      this.moveX = this.moveZ = 0;
      this.rideIdleSince = this.noDriverSince = -Infinity;
      this.bailDelay = Math.round(TICK_RATE * (0.35 + this.rng() * 0.5));
      this.riderHeadway = { pos: null, tick: 0 };
      this.driveLeft = { left: Infinity, tick };
      this.dodge = null;
      this.roadkill = null;
      this.tankResupply = false;
    }
    this.mountPlan = null;
    let forward = 0;
    let right = 0;
    let buttons = 0;
    let leave = false;
    let slowing = false;
    const gunCtx = { ...ctx, weapon: seat.weapon ?? ctx.weapon, steady: !!seat.weapon, speed: 0, stance: 0 };
    const armed = !!seat.weapon || seat.role === "passenger";
    const inSeatArc = (p) => !m || inArc(m, seat, p) || !seat.weapon && seat.role === "passenger";
    let fireAt = target && armed && inSeatArc(target.pos) ? target : void 0;
    const worth = !target || seat.shells === void 0 || this.worthShell(view, seat.shells, seat.maxShells ?? seat.shells, target);
    if (!worth) fireAt = void 0;
    if (seat.role === "driver" && m) {
      const resupply = this.resupplyFor(view, m, seat, target);
      const goal = resupply ?? this.roamGoal ?? view.orderGoal?.pos ?? farthest(view.spawnPoints, m.pos) ?? m.pos;
      const left = horizontalDistance(m.pos, goal);
      if (!this.goal || horizontalDistance(this.goal, goal) > 3 || tick - this.lastPathTick > TICK_RATE * 2) {
        this.goal = { ...goal };
        let next = view.nav.findPath(m.pos, goal) ?? [];
        if (m.floats && (next.length < 2 || pathLength(next) > left * 1.5)) next = [];
        this.lastPathTick = tick;
        const fitPath = resupply && next.length >= 2 ? trimRouteEnd(next, Math.max(m.half?.[0] ?? 0, m.half?.[2] ?? 0) + 1.2) : next;
        const fits = fitPath.length < 2 || vehicleRouteFits(view.physics, m, fitPath, FIT_AHEAD);
        if (!fits && resupply) this.ammoSkip.set(`${resupply.x},${resupply.z}`, tick + TICK_RATE * NO_FIT_SECONDS * 3);
        else if (fits || this.path.length < 2) {
          this.path = next;
          this.pathIndex = 1;
          this.routeTooNarrow = !fits;
        }
      }
      while (this.pathIndex < this.path.length - 1 && horizontalDistance(m.pos, this.path[this.pathIndex]) < 6) this.pathIndex++;
      const guided = view.guides?.length && !m.floats ? followGuide(view.guides, m.pos, m.yaw, goal, m.speed ?? 0) : null;
      const aimPt = guided?.aim ?? this.path[this.pathIndex] ?? goal;
      let ctl = steer(this.drive, tick, m, aimPt, left);
      if (guided?.speed && (m.speed ?? 0) > guided.speed) ctl = { ...ctl, forward: Math.min(ctl.forward, 0) };
      const crewGun = m.seats.some((x, i) => i !== seat.seat && x.weapon && x.arc !== void 0 && !x.free && x.by !== view.self.slot);
      const engaging = !!target && (seat.weapon ? worth : crewGun) && horizontalDistance(m.pos, target.pos) < (m.sealed ? 60 : 45);
      if (engaging && m.sealed) {
        const d = horizontalDistance(m.pos, target.pos);
        if (d > TANK_STANDOFF) ctl = steer(this.drive, tick, m, target.pos, 30);
        else {
          const err = angleDelta(m.yaw, Math.atan2(target.pos.x - m.pos.x, target.pos.z - m.pos.z));
          ctl = { forward: d < TANK_TOO_CLOSE ? -0.4 : Math.abs(err) > 0.5 && !m.pivots ? 0.3 : 0, right: clamp(err * 2.5, -1, 1) };
          this.drive.slow = 0;
          this.drive.anchor = null;
          this.drive.last = { ...m.pos };
          this.driveLeft = { left: Infinity, tick };
        }
        fireAt = seat.weapon && worth && inArc(m, seat, target.pos) ? target : void 0;
      } else if (seat.weapon && target && horizontalDistance(m.pos, target.pos) < 45) {
        ctl = steer(this.drive, tick, m, target.pos, 30);
        fireAt = worth && inArc(m, seat, target.pos) ? target : void 0;
      }
      forward = ctl.forward;
      right = ctl.right;
      if (!fireAt) {
        const a = Math.atan2(aimPt.x - m.pos.x, aimPt.z - m.pos.z);
        this.turnToward(a, 0);
      }
      const routeLeft = this.path.length > 1 ? pathLength(this.path) : left;
      if (tick - this.driveLeft.tick >= TICK_RATE * DRIVE_PROGRESS_SECONDS) {
        if (!fireAt && !engaging && routeLeft > this.driveLeft.left - DRIVE_MIN_PROGRESS) this.drive.stuck = true;
        this.driveLeft = { left: routeLeft, tick };
      } else if (this.driveLeft.left === Infinity) this.driveLeft = { left: routeLeft, tick };
      if (left < 14 && !engaging && !resupply || aboutToBlow(m) || this.drive.stuck || target && !seat.weapon && !m.sealed && horizontalDistance(m.pos, target.pos) < 22) leave = true;
      if (this.routeTooNarrow && !engaging) {
        leave = true;
        this.avoidMounts.set(m.index, tick + TICK_RATE * NO_FIT_SECONDS);
      }
      if (leave && !aboutToBlow(m) && (m.speed ?? 0) > BAIL_SPEED) {
        forward = m.reversing ? 1 : -1;
        slowing = true;
      } else if (leave && !aboutToBlow(m) && this.overWater(view, m, tick)) slowing = true;
      if (this.drive.stuck) this.giveUpOn(m.index, tick);
      if (m.sealed) {
        if (tick === this.mountedSince) {
          this.tankLog.drives++;
          this.tankUnstick = 0;
          this.tankResupply = false;
        }
        if (this.drive.unstick > this.tankUnstick) this.tankLog.backOuts += this.drive.unstick - this.tankUnstick;
        this.tankUnstick = this.drive.unstick;
        if (resupply && !this.tankResupply) this.tankLog.resupply++;
        this.tankResupply = !!resupply;
        if (leave && !slowing && this.drive.stuck && tick - this.mountedSince > TICK_RATE && !this.useLatch) {
          this.tankLog.stuck++;
          this.tankLog.stuckAt.push([Math.round(m.pos.x), Math.round(m.pos.y), Math.round(m.pos.z)]);
        } else if (leave && aboutToBlow(m) && tick - this.mountedSince > TICK_RATE && !this.useLatch) this.tankLog.bails++;
      }
    } else if (m && m.kind === "vehicle") {
      if (fireAt) this.lastTargetTick = tick;
      const driver = m.seats.find((s) => s.role === "driver")?.by;
      const ally = driver !== void 0 && driver !== view.self.slot ? view.allies?.find((a) => a.slot === driver) : void 0;
      const driven = !!ally;
      if (driven) this.noDriverSince = -Infinity;
      else if (this.noDriverSince === -Infinity) this.noDriverSince = tick;
      if ((m.speed ?? 0) > 0.5 || fireAt) this.rideIdleSince = -Infinity;
      else if (this.rideIdleSince === -Infinity) this.rideIdleSince = tick;
      const parked = this.rideIdleSince !== -Infinity && tick - this.rideIdleSince > TICK_RATE * RIDE_PARKED_SECONDS && tick - this.lastTargetTick > TICK_RATE * 4;
      const stuck = driven && !ally.human && noHeadway(this.riderHeadway, m.pos, tick, RIDER_STUCK_TICKS, RIDER_MIN_PROGRESS);
      if (stuck) this.giveUpOn(m.index, tick);
      if (!driven && tick - this.noDriverSince >= this.bailDelay || aboutToBlow(m) || parked || stuck) leave = true;
      if (leave && !aboutToBlow(m) && ((m.speed ?? 0) > BAIL_SPEED || this.overWater(view, m, tick))) slowing = true;
      if (!fireAt) this.turnToward(m.yaw, 0);
    } else if (m) {
      if (fireAt) this.lastTargetTick = tick;
      const idle = tick - Math.max(this.lastTargetTick, this.mountedSince) > TICK_RATE * 7;
      const flanked = target && !inSeatArc(target.pos) && horizontalDistance(m.pos, target.pos) < 12;
      if (idle || m.health < 0.3 || flanked) leave = true;
      if (!fireAt) this.turnToward(m.yaw + (seat.facing ?? 0), 0);
    }
    if (fireAt) {
      const sol = this.aim.solve(gunCtx, { slot: fireAt.slot, pos: this.aimPos(gunCtx.weapon, fireAt), stance: this.aimStance(gunCtx.weapon, fireAt) });
      this.turnToward(sol.yaw, sol.pitch);
      const cool = !seat.overheated && seat.heat < 0.85;
      if (cool && this.aim.trigger(gunCtx, sol, this.yaw, this.pitch, this.reacted(view, fireAt))) buttons |= BUTTON_FIRE;
    }
    if (leave && !slowing && tick - this.mountedSince > TICK_RATE && !this.useLatch) buttons |= BUTTON_USE;
    this.useLatch = (buttons & BUTTON_USE) !== 0;
    if (leave) this.nextMountTick = tick + TICK_RATE * 10;
    if (buttons & BUTTON_FIRE) this.rideFiredTick = tick;
    const incoming = tick - Math.max(this.underFireTick, this.hurtTick) < RIDE_DUCK;
    if (seat.ducks && incoming && tick - this.rideFiredTick > RIDE_DUCK_UP && !(buttons & BUTTON_USE)) buttons |= BUTTON_CROUCH;
    return { seq, forward, right, yaw: this.yaw, pitch: this.pitch, buttons };
  }
  nextMountTick = 0;
  /** When it began waiting to get out until it is over walkable ground (overWater), or -1. */
  outWaitSince = -1;
  /**
   * Wanting out of `m` on or over water (a hovercraft on the harbour, a flyer over the sea): it
   * stays aboard (a while: EXIT_GROUND_WAIT), as out there it only swims and gets stuck at the quay. Before, bots
   * jumped out of a sinking dropship over Midnight Keel's moat and were stuck in it by the wall.
   */
  overWater(view, m, tick) {
    if (!m.overWater) return false;
    if (this.outWaitSince < 0 || tick - this.outWaitSince > TICK_RATE * (EXIT_GROUND_WAIT + 2)) this.outWaitSince = tick;
    return tick - this.outWaitSince < TICK_RATE * EXIT_GROUND_WAIT;
  }
  /** At the wheel: the current route goes somewhere the vehicle doesn't fit (vehicleRouteFits), so the bot gets out. */
  routeTooNarrow = false;
  // ------------------------------------------------------------------ weapons and items
  heldCache = { view: null, w: void 0 };
  heldWeapon(view) {
    if (this.heldCache.view !== view) this.heldCache = { view, w: view.inventory.find((w) => weaponCode(w.def) === view.held) };
    return this.heldCache.w;
  }
  /**
   * Best owned weapon with ammo for the current distance: data-driven via each
   * weapon's desirability and range band, nudged by personality (range
   * preference, explosives fans, favourite weapons) and avoiding splash
   * damage up close. An empty gun in a close fight: draw another rather than
   * reload in the open.
   */
  chooseWeapon(view, target) {
    const dist = target ? distance(view.self.pos, target.pos) : this.lastKnown ? Math.min(30, distance(view.self.pos, this.lastKnown.pos)) : 15;
    const others = view.inventory.filter((w) => w.def.magazine === 0 || w.mag > 0).length;
    const vehicle = target ? this.targetMount?.kind === "vehicle" : this.armourAbout(view.tick);
    let best = view.held;
    let bestScore = -Infinity;
    for (const w of view.inventory) {
      const score = weaponScore(w, { dist, target, held: weaponCode(w.def) === view.held, loadedElsewhere: others - (w.def.magazine === 0 || w.mag > 0 ? 1 : 0) > 0, profile: this.profile, vehicle });
      if (score > bestScore) {
        bestScore = score;
        best = weaponCode(w.def);
      }
    }
    return best;
  }
  /**
   * The most worthwhile available pickup, if any is worth the detour. Value
   * depends on need (health/armor missing, weapon not owned, ammo low) and the
   * bot's item greed, discounted by distance.
   */
  pickupGoal(view, only, within = Infinity, weapons) {
    for (let tries = 0; tries < 3; tries++) {
      const pick = this.bestPickup(view, only, within, weapons);
      if (!pick || this.collectable(view, pick.pos)) return pick?.pos ?? null;
      this.losePickup(view, pick.pos);
    }
    return null;
  }
  /**
   * Whether a route gets the bot within reach of picking up what's at `pos` (on a crate it can't climb: beside it, close
   * enough), and back: not one in a trap seen from the main area (a perch a jump pad throws you onto with no way down,
   * Skyward's and Sky Islands'; a pit), where the bot would stand for the rest of its life.
   */
  collectable(view, pos) {
    const si = view.nav.standIn(view.self.pos, pos);
    if (si?.exact && !view.nav.inMain(pos) && view.nav.inMain(view.self.pos)) return false;
    return !si || si.exact || horizontalDistance(si.pos, pos) < STEP_OFF && Math.abs(si.pos.y - pos.y) < 1.4;
  }
  bestPickup(view, only, within = Infinity, weapons) {
    const me = view.self;
    let best = null;
    const owned = new Map(view.inventory.map((w) => [w.def.id, w]));
    const bestOwned = bestLoadedDesirability(view.inventory);
    let armour;
    for (const p of view.pickups) {
      const timed = this.arena && p.respawnIn !== void 0 && p.respawnIn < horizontalDistance(me.pos, p.pos) / 5 + 1;
      if (!p.available && !timed) continue;
      if (this.lostPickups.length && this.pickupLost(p.pos)) continue;
      const e = p.item.effect;
      if (only && e.kind !== only) continue;
      if (weapons && (e.kind !== "weapon" || !weapons(getWeapon(e.weapon)))) continue;
      let need = pickupNeed(e, me, view.inventory, owned, view.throwables ?? 0, view.throwable ?? null);
      if (need <= 0) continue;
      if (e.kind === "weapon" && !owned.has(e.weapon)) need *= clamp(1 + (getWeapon(e.weapon).botDesirability - bestOwned) * 2.5, 0.4, 2);
      if ((armour ??= this.armourAbout(view.tick) && !this.canHurtVehicles(view)) && this.fightsArmour(e, view.inventory)) need *= ARMOUR_PICKUP_BOOST;
      const greed = 0.3 + this.profile.itemGreed / 100 * 1.2;
      const d = horizontalDistance(me.pos, p.pos) + Math.abs(me.pos.y - p.pos.y) * 2;
      if (d > within) continue;
      const score = p.item.botValue * need * greed / (1 + d / 20);
      if (score > 0.12 && (!best || score > best.score)) best = { pos: p.pos, score };
    }
    return best ? { pos: { ...best.pos }, score: best.score } : null;
  }
  /** Pickup effect `e` gives something that hurts vehicles: a launcher, or ammo for an empty one carried. */
  fightsArmour(e, inventory) {
    if (e.kind === "weapon") return antiVehicle(getWeapon(e.weapon));
    if (e.kind !== "ammo") return false;
    for (const w of inventory) if (antiVehicle(w.def) && w.def.magazine > 0 && w.mag + w.reserve <= 0 && (e.ammo === void 0 || e.ammo === w.def.ammo)) return true;
    return false;
  }
  /** `goal` is a pickup this bot can't get to (stuck on the way, or no way there): leave it alone for a good while. */
  losePickup(view, goal) {
    if (!view.pickups.some((p) => horizontalDistance(p.pos, goal) < 0.5)) return;
    if (this.lostPickups.length >= 8) this.lostPickups.shift();
    this.lostPickups.push({ pos: { ...goal }, until: view.tick + TICK_RATE * PICKUP_GIVE_UP_SECONDS });
  }
  /** Within pickup reach of an item still lying at `pos`: the match already offered it and it wasn't taken. */
  refused(view, pos) {
    const me = view.self.pos;
    if (horizontalDistance(me, pos) > PICKUP_RADIUS$1 || Math.abs(me.y - pos.y) > 1.5) return false;
    return view.pickups.some((p) => p.available && horizontalDistance(p.pos, pos) < 0.5);
  }
  /** A pickup at `pos` this bot gave up on (stuck going for it) and still leaves alone. */
  pickupLost(pos) {
    const list2 = this.lostPickups;
    for (let i = list2.length - 1; i >= 0; i--) {
      if (list2[i].until <= this.lastThinkTick) list2.splice(i, 1);
      else if (horizontalDistance(list2[i].pos, pos) < 1.5) return true;
    }
    return false;
  }
  /**
   * Where to advance next: in team modes the enemy's side of the map (by one
   * of several routes, so teammates spread out); otherwise the places it
   * hasn't checked lately.
   */
  pickAdvanceGoal(view) {
    const me = view.self.pos;
    for (let tries = 0; tries < 3; tries++) {
      this.pickAdvanceGoalNow(view);
      if (!this.roamGoal || view.nav.reachable(me, this.roamGoal)) break;
    }
    if (this.via && !view.nav.reachable(me, this.via)) this.via = null;
  }
  pickAdvanceGoalNow(view) {
    const me = view.self;
    const pts = view.spawnPoints;
    const places = view.nav.mainPlaces();
    this.via = null;
    this.roamRoute = null;
    const plan = view.plan;
    if (plan?.regions && !view.orderGoal) {
      const lone = plan.role === "lone_wolf";
      const explore = this.profile.exploration / 100;
      const o = { from: me.pos, tick: view.tick, rng: this.routeRng, ideal: 25 + explore * 50 + (lone ? 20 : 0), novelty: hasTag(this.profile, "EXPLORER") ? 2 : 0.7 + explore, crowd: lone ? 2.5 : hasTag(this.profile, "GRUNT") ? 0.2 : 0.8, towards: plan.towards, push: lone ? 1 : 1.7 - explore * 0.6, contact: lone ? 0.3 : 1 - explore * 0.4, memory: this.memory };
      const push = !lone && !!plan.towards?.length && this.routeRng() < 0.3 + this.profile.aggression / 250;
      let pick = push ? { pos: { ...plan.towards[Math.floor(this.routeRng() * plan.towards.length)] } } : plan.regions.pick(o);
      const av = this.avoid;
      if (pick && av && view.tick < av.until && horizontalDistance(pick.pos, av.pos) < 6) pick = plan.regions.pick(o);
      if (pick) {
        this.roamGoal = pick.pos;
        const route = push ? cheapestRoute(plan.trips, pick.pos, this.routeRng) : null;
        if (route) {
          this.roamRoute = { c: route, goal: { ...pick.pos } };
          return;
        }
        const r = this.routeRng();
        const lane2 = lone ? r < 0.5 ? -1.6 : 1.6 : r < 0.35 ? -1 : r < 0.7 ? 1 : 0;
        if (lane2 !== 0) this.via = laneWaypoint(places, me.pos, pick.pos, lane2);
        return;
      }
    }
    if (this.rng() * 100 < this.profile.exploration * 0.6 || pts.length === 0) {
      this.roamGoal = pickExploreGoal(places, pts, me.pos, this.memory, view.tick, this.rng, this.profile.exploration) ?? { ...pts[0] ?? me.pos };
    } else {
      this.roamGoal = { ...pts[Math.floor(this.rng() * pts.length)] };
    }
    const lane = this.slot % 3 - 1;
    if (lane !== 0 && this.roamGoal) this.via = laneWaypoint(places, me.pos, this.roamGoal, lane);
  }
  // ------------------------------------------------------------------ perception
  perceive(view) {
    this.lastPerceiveTick = view.tick;
    if (!simProfile.on) return this.perceiveNow(view);
    const t0 = performance.now();
    this.perceiveNow(view);
    simProfile.add("botPerceive", performance.now() - t0);
    simProfile.count("botPerceive");
  }
  perceiveNow(view) {
    const me = view.self;
    const tick = view.tick;
    const myEye = this.eyeAt;
    myEye.x = me.pos.x;
    myEye.y = me.pos.y + STANCES[me.stance ?? 0].eye * (me.size ?? 1);
    myEye.z = me.pos.z;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    this.memory.mark(me.pos, tick);
    const live = this.live;
    live.length = 0;
    const held = this.post?.kind === "sniper" ? this.heldDef(view) : void 0;
    const sight = held && this.sniping(view, held) ? Math.max(SIGHT_RANGE, Math.min(SCOPE_SIGHT, botBand(held)[1])) : SIGHT_RANGE;
    let armedVsTanks;
    const aboard = view.seat ? view.mounts?.find((x) => x.index === view.seat.mount)?.seats : void 0;
    for (const o of view.others) {
      if (!o.alive) continue;
      if (aboard?.some((s) => s.by === o.slot)) continue;
      const ox = o.pos.x - me.pos.x;
      const oy = o.pos.y - me.pos.y;
      const oz = o.pos.z - me.pos.z;
      const d2 = ox * ox + oy * oy + oz * oz;
      if (d2 >= sight * sight) continue;
      const d = Math.sqrt(d2);
      const range = sight * STANCE_SIGHT[o.stance ?? 0];
      if (d > range && !this.visibleSince.has(o.slot)) continue;
      const dx = ox / (d || 1);
      const dz = oz / (d || 1);
      const ahead = dx * fx + dz * fz;
      const inFov = ahead >= FOV_COS * Math.sqrt(dx * dx + dz * dz);
      if (!inFov && d > HEARING_RANGE) continue;
      if (d > SIGHT_RANGE && ahead < SCOPE_COS * Math.sqrt(dx * dx + dz * dz)) continue;
      if (o.concealed && d > (this.visibleSince.has(o.slot) ? CONCEAL_TRACK : CONCEAL_SPOT)) continue;
      const c = this.pool[live.length] ?? (this.pool[live.length] = { o, dx: 0, dz: 0, score: 0, checked: false });
      c.o = o;
      c.dx = dx;
      c.dz = dz;
      c.score = d * (o.slot === this.targetSlot ? 0.7 : 1) * (o.sheltered && !(armedVsTanks ??= this.armedVsTanks(view)) ? SHELTERED_TARGET_SCALE : 1) * (o.shielded ? SHIELDED_TARGET_SCALE : 1);
      c.checked = false;
      live.push(c);
    }
    if (live.length > 1) live.sort(byScore);
    let best = null;
    let rays = 0;
    const theirEye = this.eyeTo;
    for (const c of live) {
      if (view.crowded && rays >= (best ? SIGHT_TRACK : SIGHT_SEARCH)) break;
      const o = c.o;
      theirEye.x = o.pos.x;
      theirEye.y = o.pos.y + STANCES[o.stance ?? 0].eye * (o.size ?? 1);
      theirEye.z = o.pos.z;
      rays++;
      c.checked = true;
      let clear;
      if (o.object) {
        theirEye.x -= c.dx * 0.8;
        theirEye.z -= c.dz * 0.8;
        clear = view.physics.lineOfSight(myEye, theirEye);
      } else clear = view.sight ? view.sight.lineOfSight(tick, me.slot, myEye, o.slot, theirEye) : view.physics.lineOfSight(myEye, theirEye);
      if (clear && view.smoke && smokeBlocks(myEye, theirEye, view.smoke)) clear = false;
      if (!clear) continue;
      if (view.physics.armorGlass && !view.physics.shotLine(myEye, theirEye)) continue;
      if (!this.visibleSince.has(o.slot)) {
        this.visibleSince.set(o.slot, tick);
        this.reactAt.set(o.slot, tick + this.reactAfter(o, c.dx * fx + c.dz * fz < FOV_COS, tick));
      }
      this.confirmed.set(o.slot, tick);
      this.enemies.note(o.slot, o.pos, tick, "seen");
      if (!best) best = c;
    }
    for (const c of live) if (!c.checked) this.unchecked.set(c.o.slot, tick);
    for (const [slot] of this.visibleSince) {
      const at2 = this.confirmed.get(slot) ?? -Infinity;
      if (at2 === tick || this.unchecked.get(slot) === tick && tick - at2 <= TRACK_UNCHECKED_TICKS) continue;
      this.visibleSince.delete(slot);
      this.reactAt.delete(slot);
      this.confirmed.delete(slot);
    }
    if (best) {
      this.targetSlot = best.o.slot;
      const t = best.o;
      this.lastKnown = { pos: { ...t.pos }, tick };
      view.plan?.callouts?.post(this.slot, t.slot, t.pos, tick);
    } else {
      this.targetSlot = null;
    }
    this.recall(view);
    if (view.noises?.length && !best) {
      const hostile = slotsOf(view.others);
      let loud = null;
      for (const n of view.noises) {
        if (n.by >= 0 && !hostile.has(n.by)) continue;
        const d = horizontalDistance(n.pos, me.pos) + Math.abs(n.pos.y - me.pos.y) * 2;
        if (d > n.range || d < 3) continue;
        if (this.unreachable && view.tick < this.unreachable.until && horizontalDistance(n.pos, this.unreachable.pos) < 8) continue;
        if (!loud || d < loud.d) loud = { pos: n.pos, tick: n.tick, d };
      }
      if (loud && view.crowded && view.alliesGrid && loud.d > 18) {
        let there = 0;
        for (const a of view.alliesGrid.near(loud.pos.x, loud.pos.z, 12, this.nearScratch)) {
          if (a.slot !== me.slot && horizontalDistance(a.pos, loud.pos) < 12 && ++there >= 4) break;
        }
        if (there >= 4) loud = null;
      }
      if (loud && (!this.heard || loud.tick > this.heard.tick + TICK_RATE)) {
        const err = Math.min(4, loud.d * 0.08);
        const p = view.nav.closestPoint({ x: loud.pos.x + (this.rng() * 2 - 1) * err, y: loud.pos.y + 0.5, z: loud.pos.z + (this.rng() * 2 - 1) * err }, { x: 3, y: 3, z: 3 });
        if (p) {
          this.heard = { pos: p, tick: loud.tick };
          this.enemies.note(-1, p, loud.tick, "heard");
        }
      }
    }
  }
  lookAlongPath(view) {
    const corner = this.path[this.pathIndex];
    if (!corner) return;
    const me = view.self;
    const a = lookAngles({ x: me.pos.x, y: me.pos.y + PLAYER.eyeHeight, z: me.pos.z }, { x: corner.x, y: corner.y + PLAYER.eyeHeight, z: corner.z });
    const m = view.orderGoal?.run ? null : this.remembered(view, 30);
    if (m && m.source !== "heard") {
      const to = lookAngles({ x: me.pos.x, y: me.pos.y + PLAYER.eyeHeight, z: me.pos.z }, { x: m.pos.x, y: m.pos.y + 1.2, z: m.pos.z });
      if (Math.abs(angleDelta(a.yaw, to.yaw)) < 1.3) {
        this.turnToward(to.yaw, to.pitch);
        return;
      }
    }
    const glance = Math.sin((view.tick + this.slot * 37) / 50) * 0.45 * (this.careful() ? 1 : 0.3);
    this.turnToward(a.yaw + glance, 0);
  }
  lookAt(view, p, up) {
    const me = view.self;
    const a = lookAngles({ x: me.pos.x, y: me.pos.y + STANCES[me.stance ?? 0].eye, z: me.pos.z }, { x: p.x, y: p.y + up, z: p.z });
    this.turnToward(a.yaw, a.pitch);
  }
  /**
   * Within reach of the button a press plan is for: players press from up to 2.2 m, eye to face. (Only at the one spot
   * in front of it, a few bots at one button kept each other off it: Primeval Park's fence power, 38 s.)
   */
  pressReach(me, plan) {
    if (Math.abs(me.pos.y - plan.stand.y) >= 1) return false;
    return horizontalDistance(me.pos, plan.stand) < 0.8 || distance({ x: me.pos.x, y: me.pos.y + PLAYER.eyeHeight, z: me.pos.z }, plan.face) < 1.9;
  }
  turnToward(yaw, pitch) {
    const maxStep = this.difficulty.turnRateRadPerSec * TICK_DT;
    this.yaw += clamp(angleDelta(this.yaw, yaw), -maxStep, maxStep);
    this.pitch += clamp(pitch - this.pitch, -maxStep, maxStep);
    this.pitch = clamp(this.pitch, -1.5, 1.5);
  }
  /** A teammate within 2.6 m ahead along `moveYaw` (grid query in big matches). */
  squadmateAhead(view, moveYaw) {
    if (!view.allies?.length) return false;
    const me = view.self.pos;
    const fx = Math.sin(moveYaw);
    const fz = Math.cos(moveYaw);
    const near2 = view.alliesGrid ? view.alliesGrid.near(me.x, me.z, 2.6, this.nearScratch) : view.allies;
    for (const a of near2) {
      if (a.slot === view.self.slot || Math.abs(a.pos.y - me.y) > 1.5) continue;
      const dx = a.pos.x - me.x;
      const dz = a.pos.z - me.z;
      const d = hypot(dx, dz);
      if (d < 2.6 && d > 1e-3 && (dx * fx + dz * fz) / d > 0.7) return true;
    }
    return false;
  }
  /**
   * Teammates don't stack up: steer away from allies close by, and step aside when
   * standing on top of one (squads walking one navmesh path would otherwise move as a clump).
   * Going somewhere out of a fight (`travelling`), the push only steers aside, never back, and at most as strongly as
   * the way itself: two bots meeting in a narrow way pushed each other back and forth (Shingle Point's MG nest by hill
   * 1), and bodies don't block each other anyway. (In a fight it stays as it was: spread out, bots die less.) At a
   * ladder's foot and on it, none: everyone goes through that one place, one after another (three or four bots pushed
   * each other off Shingle Point's seawall ladders for seconds on end).
   */
  separate(view, moveYaw, travelling = false) {
    if (!view.allies?.length) return moveYaw;
    if (view.self.climbing || !this.holdStill && this.atLadder(view.self.pos)) return moveYaw;
    const me = view.self.pos;
    let px = 0;
    let pz = 0;
    let keepRight = 0;
    const fx = moveYaw === null ? 0 : Math.sin(moveYaw);
    const fz = moveYaw === null ? 0 : Math.cos(moveYaw);
    const reach2 = travelling && moveYaw !== null ? ONCOMING : 2.2;
    const near2 = view.alliesGrid ? view.alliesGrid.near(me.x, me.z, reach2, this.nearScratch) : view.allies;
    for (const a of near2) {
      if (a.slot === view.self.slot) continue;
      const dx = me.x - a.pos.x;
      const dz = me.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > reach2 * reach2 || Math.abs(a.pos.y - me.y) > 1.5) continue;
      if (reach2 > 2.2 && d2 > 0.01) {
        const d3 = Math.sqrt(d2);
        const ahead = -(dx * fx + dz * fz) / d3;
        const facing = -(Math.sin(a.yaw) * fx + Math.cos(a.yaw) * fz);
        if (ahead > 0.6 && facing > 0.5) keepRight = Math.max(keepRight, (1 - d3 / ONCOMING) * 0.9 + 0.2);
      }
      if (d2 > 2.2 * 2.2) continue;
      const d = Math.sqrt(d2);
      const ux = d < 1e-3 ? view.self.slot < a.slot ? 1 : -1 : dx / d;
      const uz = d < 1e-3 ? 0 : dz / d;
      px += ux * (2.2 - d);
      pz += uz * (2.2 - d);
    }
    if (keepRight) {
      px += fz * keepRight;
      pz -= fx * keepRight;
      if (simProfile.on) simProfile.count("botKeepRight");
    }
    if (!px && !pz) return moveYaw;
    if (moveYaw === null) return hypot(px, pz) > 1.4 ? Math.atan2(px, pz) : null;
    const wx = Math.sin(moveYaw);
    const wz = Math.cos(moveYaw);
    if (travelling) {
      const back = px * wx + pz * wz;
      if (back < 0) {
        px -= back * wx;
        pz -= back * wz;
      }
      const push = hypot(px, pz);
      if (push > SEPARATE_MAX) {
        px *= SEPARATE_MAX / push;
        pz *= SEPARATE_MAX / push;
      }
    }
    return Math.atan2(wx + px, wz + pz);
  }
  /**
   * A body taller than the navmesh's standing on its ground: whether there's no room to stand a step ahead along
   * `moveYaw` (or here) but room to crouch; then it ducks for a moment. Looked at every few ticks (a shape query), only
   * on a route under a low roof (lowRoute).
   */
  mustDuck(view, moveYaw) {
    const me = view.self;
    const k = me.size ?? 1;
    if (k <= TALL_SIZE || me.grounded === false) return false;
    const tick = view.tick;
    if (tick < this.duckUntil) return true;
    if ((tick + this.slot) % DECIDE_TICKS !== 0) return false;
    const r = PLAYER.radius * k;
    for (const ahead of [0, 0.5, 1]) {
      for (const up of [0, PLAYER.maxStepHeight - 0.02]) {
        const at2 = { x: me.pos.x + Math.sin(moveYaw) * ahead, y: me.pos.y + up, z: me.pos.z + Math.cos(moveYaw) * ahead };
        if (!view.physics.headroom(at2, STANCES[0].height * k, r) && view.physics.headroom(at2, STANCES[1].height * k, r)) {
          this.duckUntil = tick + Math.round(TICK_RATE * 0.6);
          return true;
        }
      }
    }
    return false;
  }
  /** Heading for a ladder's foot (within a few metres) or up or down one: the path's leg there is too steep to walk. */
  atLadder(me) {
    const i = this.pathIndex;
    const c = this.path[i];
    if (!c) return false;
    const steep = (a, b) => !!a && !!b && Math.abs(b.y - a.y) > 1.5 && Math.abs(b.y - a.y) > horizontalDistance(a, b) * 1.5;
    return steep(c, this.path[i + 1]) && horizontalDistance(me, c) < 4 || steep(i > 0 ? this.path[i - 1] : void 0, c);
  }
  // ------------------------------------------------------------------ navigation
  /** Follow a navmesh path to `goal`; returns the world yaw to move along, or null when there is nowhere to go. */
  followPathTo(view, goal, movingGoal) {
    if (!simProfile.on) return this.followPathNow(view, goal, movingGoal);
    const t0 = performance.now();
    const r = this.followPathNow(view, goal, movingGoal);
    simProfile.add("botPath", performance.now() - t0);
    return r;
  }
  followPathNow(view, goal, movingGoal) {
    const me = view.self;
    if (me.riding) {
      const c = this.path[this.pathIndex];
      return c ? Math.atan2(c.x - me.pos.x, c.z - me.pos.z) : null;
    }
    if (this.pressPlan) {
      goal = this.pressPlan.stand;
      movingGoal = false;
    } else if (this.sidestep) {
      if (view.tick >= this.sidestep.until || horizontalDistance(me.pos, this.sidestep.pos) < 0.8) this.sidestep = null;
      else {
        goal = this.sidestep.pos;
        movingGoal = false;
      }
    }
    const esc = this.escape;
    if (esc && horizontalDistance(me.pos, esc.across) < 1.2 && Math.abs(me.pos.y - esc.across.y) < 1.5) {
      this.escape = null;
      this.noPath = null;
      this.pathFails = 0;
      this.path = [];
      this.lastPathTick = -Infinity;
    }
    const navChanged = view.nav.goneVersion !== this.goneSeen;
    const goalMoved = this.goal === null || navChanged || horizontalDistance(this.goal, goal) > 2 || Math.abs(this.goal.y - goal.y) > 1.5;
    const stale = movingGoal && view.tick - this.lastPathTick > PATH_REFRESH_TICKS || !!this.standIn && view.tick - this.lastPathTick > TICK_RATE;
    const exhausted = this.pathIndex >= this.path.length && horizontalDistance(me.pos, this.standIn ?? goal) > 1;
    let replan = goalMoved && view.tick - this.lastPathTick >= 2 || (stale || exhausted) && view.tick - this.lastPathTick >= 6;
    if (replan && !exhausted && this.path.length && this.pathIndex < this.path.length && this.goneSeen === view.nav.goneVersion && !view.nav.takeSearch()) replan = false;
    if (replan && (me.grounded === false || me.climbing) && !view.nav.closestPoint(me.pos)) {
      this.goal = { ...goal };
      if (!this.path.length) this.pathMiss = true;
    } else if (replan) {
      this.goal = { ...goal };
      this.goneSeen = view.nav.goneVersion;
      const np = this.noPath;
      const backedOff = !!np && view.tick < np.until && horizontalDistance(np.goal, goal) < 2 && Math.abs(np.goal.y - goal.y) < 1.5 && horizontalDistance(np.from, me.pos) < 2 && Math.abs(np.from.y - me.pos.y) < 1.5;
      const offLifts = view.tick < this.offLiftsUntil ? LIFT_FLAG : 0;
      const onto = backedOff || me.grounded === false || me.climbing ? null : view.nav.wayOnto(me.pos, this.walkClear(view));
      const round = !onto && !backedOff && me.grounded !== false && !me.climbing && !view.nav.nearestPoly(me.pos) ? this.wayRound(view) : null;
      const si = backedOff || onto || round ? null : view.nav.standIn(me.pos, goal);
      this.standIn = si && !si.exact && (horizontalDistance(si.pos, goal) > 0.5 || Math.abs(si.pos.y - goal.y) > 1.5) ? si.pos : null;
      const to = this.standIn ?? goal;
      let found = null;
      if (onto) found = [{ ...me.pos }, onto];
      else if (round) found = [{ ...me.pos }, ...round];
      else if (!backedOff) {
        const agile = this.agile(view);
        const al = this.along;
        const tall = this.tall(view);
        this.lowRoute = false;
        if (al && view.tick - al.tick <= DECIDE_TICKS * 2 && !offLifts && !this.standIn) {
          found = view.nav.pathAlong(me.pos, al.c.polys, to, view.shut ?? 0, tall);
          if (found) this.alongRoutes++;
          else al.failed = view.tick;
        }
        if (!found) {
          found = offLifts && view.nav.findPath(me.pos, to, offLifts, false, this.coverRoutes, agile, tall) || view.nav.findPath(me.pos, to, 0, true, this.coverRoutes, agile, tall);
          this.lowRoute = tall && !!found && view.nav.lastLow;
        }
      }
      if (!backedOff && !onto && !round) {
        this.pathFails = found ? 0 : Math.min(this.pathFails + 1, 6);
        this.pathSearches++;
        if (this.standIn) this.standIns++;
        if (!found) this.noPath = { goal: { ...goal }, from: { ...me.pos }, until: view.tick + Math.min(TICK_RATE * 4, 6 << this.pathFails) };
        else if (np && horizontalDistance(np.goal, goal) < 2 && Math.abs(np.goal.y - goal.y) < 1.5) this.noPath = null;
        if (!found) {
          this.pathFailures++;
          this.lastNoRoute = this.noPath;
        }
      }
      this.path = found ?? [];
      if (found && !this.standIn) this.escape = null;
      else if (!onto && !round && horizontalDistance(me.pos, goal) > 1.5 && (me.grounded !== false || me.climbing)) {
        this.planEscape(view, goal);
        if (this.escape) this.standIn = null;
      } else if (this.escape && view.tick <= this.escape.until) {
        this.path = [{ ...me.pos }, { ...this.escape.across }];
        this.standIn = null;
      }
      const door = this.pathBlocked(view);
      if (door) {
        this.path = [];
        const pd = this.pressedDoor;
        if (pd && sameBox(pd, door) && view.tick - this.pressedAt > TICK_RATE * 3) {
          this.noPress.push({ door: pd, until: view.tick + TICK_RATE * 30 });
          if (this.noPress.length > 4) this.noPress.shift();
          this.pressedDoor = null;
        }
        if (!this.pressPlan && view.tick - this.pressedAt > TICK_RATE * 3) this.planPress(view, door);
        if (!this.pressPlan && view.shut) {
          const round22 = view.nav.findPath(me.pos, goal, view.shut, false, 0, false, this.tall(view));
          if (round22) {
            this.path = round22;
            this.lowRoute = view.nav.lastLow;
            if (this.pathBlocked(view)) this.path = [];
          }
          if (!this.path.length) {
            const near2 = view.nav.findPath(me.pos, goal, view.shut, true, 0, false, this.tall(view));
            const end = near2?.[near2.length - 1];
            if (near2 && end && horizontalDistance(end, goal) > 1) {
              this.path = near2;
              this.lowRoute = view.nav.lastLow;
              this.standIn = end;
            }
          }
        }
      }
      this.pathIndex = this.path.length > 1 ? 1 : 0;
      this.lastPathTick = view.tick;
    }
    if (this.portalled) {
      this.portalled = false;
      const corner2 = this.path[this.pathIndex];
      if (corner2 && view.portals?.length && this.portalFace(view, corner2, this.pathIndex > 0 ? this.path[this.pathIndex - 1] : null)) this.pathIndex++;
    }
    while (this.pathIndex < this.path.length) {
      const c = this.path[this.pathIndex];
      const d = horizontalDistance(me.pos, c);
      if (Math.abs(me.pos.y - c.y) >= 1.6) break;
      const prev = this.pathIndex > 0 ? this.path[this.pathIndex - 1] : null;
      const past = !!prev && this.pathIndex < this.path.length - 1 && d < PASS_RADIUS && (me.pos.x - c.x) * (c.x - prev.x) + (me.pos.z - c.z) * (c.z - prev.z) > 0;
      if (d < CORNER_RADIUS || past) this.pathIndex++;
      else break;
    }
    const corner = this.path[this.pathIndex];
    if (!corner) {
      const si = this.standIn;
      if (si) {
        const dy = goal.y - me.pos.y;
        if (horizontalDistance(me.pos, goal) > 0.5 && horizontalDistance(si, goal) < STEP_OFF && dy < 1.4 && dy > -2 && view.physics.lineOfSight({ x: me.pos.x, y: me.pos.y + 1.2, z: me.pos.z }, { x: goal.x, y: Math.max(goal.y + 0.3, me.pos.y + 1.2), z: goal.z })) return Math.atan2(goal.x - me.pos.x, goal.z - me.pos.z);
        this.pathMiss = true;
        return null;
      }
      if (horizontalDistance(me.pos, goal) < 0.5) return null;
      if (this.path.length === 0) {
        this.pathMiss = true;
        return null;
      }
      const g = this.pastHulls(view, goal);
      return Math.atan2(g.x - me.pos.x, g.z - me.pos.z);
    }
    if (view.nav.parkour.length) this.watchLink(view, corner);
    if (view.lifts?.length) this.holdStill = this.liftWait(view, corner, this.pathIndex > 0 ? this.path[this.pathIndex - 1] : null);
    const face = view.portals?.length ? this.portalFace(view, corner, this.pathIndex > 0 ? this.path[this.pathIndex - 1] : null) : null;
    if (face) return Math.atan2(face.x - me.pos.x, face.z - me.pos.z);
    const grab = view.ziplines?.length ? this.zipGrab(view, corner, this.pathIndex > 0 ? this.path[this.pathIndex - 1] : null) : null;
    if (grab) {
      if (horizontalDistance(me.pos, grab) < 1.1) this.zipPress = true;
      return Math.atan2(grab.x - me.pos.x, grab.z - me.pos.z);
    }
    const aim = this.pastHulls(view, corner);
    return Math.atan2(aim.x - me.pos.x, aim.z - me.pos.z);
  }
  /**
   * The route's first corner from `from` on that isn't under a still hull (a vehicle left on the route: the navmesh
   * doesn't know of it), when the corner at `from` is under one (not the one it is getting into); else -1.
   */
  cornerBeyond(view, from) {
    const hulls = view.hulls;
    const boarding = this.mountPlan?.index ?? -1;
    let j = from;
    while (j < this.path.length - 1 && insideHull(hulls, this.path[j], boarding)) j++;
    return j > from ? j : -1;
  }
  /**
   * Where to head for on the way to `aim`: `aim` itself, or the corner of a still hull in the way (hulls.ts). Looked
   * for every few ticks; a corner chosen stands till it is reached or the next look. Not on a ladder, a zipline or a
   * parkour link.
   */
  pastHulls(view, aim) {
    const hulls = view.hulls;
    const me = view.self;
    if (!hulls?.length || !BOT_SWITCHES.hulls || me.riding || me.climbing || this.link || me.grounded === false) return aim;
    const tick = view.tick;
    const hp = this.hullPass;
    if (hp && tick < hp.until && horizontalDistance(me.pos, hp.pos) > 0.6) return hp.pos;
    if (!hp && tick < this.hullFreeUntil) return aim;
    const keep = this.hullSide && tick < this.hullSide.until ? this.hullSide : null;
    const onPath = this.path[this.pathIndex] === aim;
    const j = onPath ? this.cornerBeyond(view, this.pathIndex) : -1;
    const walk = this.walkClear(view);
    const pass = hullDetour(hulls, me.pos, aim, {
      keep,
      beyond: j >= 0 ? this.path[j] : null,
      boarding: this.mountPlan?.index ?? -1,
      ok: (from, p) => {
        const ground = view.nav.closestPoint({ x: p.x, y: p.y + 0.5, z: p.z }, { x: 0.6, y: 1.5, z: 0.6 });
        if (!ground || horizontalDistance(ground, p) > 0.6 || Math.abs(ground.y - from.y) > 1.2) return false;
        return walk(from, { x: p.x, y: ground.y, z: p.z });
      }
    });
    if (pass === "beyond") {
      this.pathIndex = j;
      this.hullPass = null;
      return this.path[j];
    }
    if (!pass || pass === "none") {
      this.hullPass = null;
      this.hullFreeUntil = tick + (pass ? TICK_RATE / 2 : HULL_LOOK_TICKS);
      return aim;
    }
    if (!hp || hp.index !== pass.index) this.hullDetours++;
    this.hullPass = { ...pass, until: tick + HULL_LOOK_TICKS * 2 };
    this.hullSide = { index: pass.index, side: pass.side, until: tick + TICK_RATE * 3 };
    return pass.pos;
  }
  /**
   * Whether a body walks straight from `a` toward `b` (a point on the navmesh near it) with nothing in the way at a
   * knee's and a chest's height over the higher of the two (going down: off the edge, then falling to it).
   */
  walkClear(view) {
    return (a, b) => {
      const top = Math.max(a.y, b.y);
      for (const h of [0.5, 1.2]) if (!view.physics.lineOfSight({ x: a.x, y: top + h, z: a.z }, { x: b.x, y: top + h, z: b.z })) return false;
      return true;
    };
  }
  /**
   * Off the navmesh with no straight way onto it: a spot on the ground a few metres off (any side, level, up or down a
   * walkable slope) that it walks straight to and from which a way on is clear; that spot and the place on the navmesh,
   * shortest first. Null when there is none. A dozen or two rays, only then.
   */
  wayRound(view) {
    const me = view.self.pos;
    const clear = this.walkClear(view);
    let best = null;
    for (const r of [3, 6, 9]) {
      for (let k = 0; k < 12; k++) {
        const a = k * Math.PI / 6;
        const x = me.x + Math.sin(a) * r;
        const z = me.z + Math.cos(a) * r;
        const drop = view.physics.raycastWorld({ x, y: me.y + 4, z }, { x: 0, y: -1, z: 0 }, 8);
        if (drop === null || drop < 1.9) continue;
        const via = { x, y: me.y + 4 - drop, z };
        if (via.y - me.y > r * 0.85 || !clear(me, via)) continue;
        const on = view.nav.nearestPoly(via, { x: 0.5, y: 1, z: 0.5 });
        const onto = on ? null : view.nav.wayOnto(via, clear);
        if (!on && !onto) continue;
        const d = r + (onto ? horizontalDistance(via, onto) : 0);
        if (!best || d < best.d) best = { via, onto, d };
      }
      if (best) break;
    }
    return best ? best.onto ? [best.via, best.onto] : [best.via] : null;
  }
  /** Flankers, recon, snipers and Arena bots: parkour links cost them no more than walking (NavWorld.findPath `agile`). */
  /** A body taller than the navmesh's 1.8 m (a large look): routes round low roofs (NavWorld.findPath `tall`). */
  tall(view) {
    return (view.self.size ?? 1) > TALL_SIZE;
  }
  agile(view) {
    const plan = view.plan;
    return this.arena || plan?.role === "sniper" || plan?.job?.group === "flank" || plan?.job?.group === "recon";
  }
  /**
   * Whether the route's leg into `corner` is a parkour link (its corners the link's start and end): then it is the one
   * to run. A link it is already on (jumped, or over the edge) is kept until it lands, whatever the route does.
   */
  watchLink(view, corner) {
    const k = this.link;
    if (k && (k.jumped >= 0 || k.left >= 0)) return;
    if (k && k.path === this.path && k.index === this.pathIndex) return;
    const prev = this.pathIndex > 0 ? this.path[this.pathIndex - 1] : null;
    const l = prev ? view.nav.parkourAt(prev, corner) : null;
    if (!l) {
      this.link = null;
      return;
    }
    const clock = this.linkClock;
    const since = clock && clock.l === l && view.tick - clock.at < TICK_RATE * 20 ? clock.since : view.tick;
    this.linkClock = { l, since, at: view.tick };
    this.link = { l, path: this.path, index: this.pathIndex, since, jumped: -1, left: -1 };
  }
  /**
   * Running a parkour link (nav/parkour.ts parkourInput, as the build played it through the movement code): facing
   * its way and running (sprinting for a gap), jumping at its takeoff, tucking the legs up in the air for a high ledge.
   * Null when it isn't on one now (still on its way to the link's start, wandered off it, or done: landed).
   */
  parkourMove(view) {
    const k = this.link;
    const me = view.self;
    const l = k.l;
    const tick = view.tick;
    const grounded = me.grounded !== false;
    if (k.left < 0 && !grounded && me.pos.y < l.start.y - 0.4) k.left = tick;
    const off = k.jumped >= 0 ? k.jumped : k.left;
    if (off >= 0) {
      if (grounded && tick - off > 3) {
        if (horizontalDistance(me.pos, l.end) < 4.5 && Math.abs(me.pos.y - l.end.y) < 0.8) this.parkourDone[l.kind]++;
        else {
          this.parkourMissed++;
          view.nav.linkFailed(l, false);
        }
        this.link = null;
        return null;
      }
      if (tick - off > TICK_RATE * 4) {
        this.link = null;
        return null;
      }
    } else {
      const along = parkourAlong(l, me.pos);
      const len = horizontalDistance(l.start, l.end);
      const side = Math.abs((me.pos.x - l.start.x) * Math.cos(l.yaw) - (me.pos.z - l.start.z) * Math.sin(l.yaw));
      if (along < -0.8 || side > 0.9 || along > len + 1) {
        if (tick - k.since > TICK_RATE * 6) {
          this.parkourGaveUp++;
          this.link = null;
        }
        return null;
      }
      if (tick - k.since > TICK_RATE * (l.sprint ? 8 : 4)) {
        this.parkourGaveUp++;
        view.nav.linkFailed(l, true);
        this.link = null;
        return null;
      }
      if (l.sprint && me.winded) return { yaw: l.yaw, buttons: 0, wait: true };
    }
    const c = parkourInput(l, me.pos, grounded, k.jumped >= 0);
    if (c.jump) k.jumped = tick;
    return { yaw: c.yaw, buttons: c.buttons, wait: false };
  }
  /**
   * No route from here to `goal`. Standing on a patch of navmesh cut off from it that players walk off
   * (NavWorld.escapes: Capitol Mall's reflecting pool, slab edges, low roofs), the bot heads for the edge of the
   * patch nearest a place close by that does route to the goal, and steps or hops across (act() hops when the
   * crossing holds it up). Before, it stood where it was until it died (Diamond Park's dugouts were such patches,
   * fixed in the map since: "most of the team hung out in the dugout"). A crossing not made within 8 s is left
   * alone for 30 s and the next one, if any, is tried.
   */
  planEscape(view, goal) {
    const me = view.self.pos;
    const tick = view.tick;
    const failed = this.failedCrossings;
    for (let i = failed.length - 1; i >= 0; i--) if (failed[i].until <= tick) failed.splice(i, 1);
    let esc = this.escape;
    if (esc && tick > esc.until) {
      failed.push({ at: esc.across, until: tick + TICK_RATE * 30 });
      if (failed.length > 6) failed.shift();
      esc = this.escape = null;
    }
    const physics = view.physics;
    const clear = (a, b) => {
      const y = Math.max(a.y, b.y);
      return physics.lineOfSight({ x: a.x, y: y + 0.5, z: a.z }, { x: b.x, y: y + 0.5, z: b.z }) && physics.lineOfSight({ x: a.x, y: y + 1.6, z: a.z }, { x: b.x, y: y + 1.6, z: b.z });
    };
    const pick = view.nav.escapes(me, goal, clear).find((o) => !failed.some((f) => horizontalDistance(f.at, o.across) < 1));
    if (!pick) {
      this.escape = null;
      return;
    }
    if (!esc || horizontalDistance(esc.across, pick.across) > 0.5) this.escape = { across: { ...pick.across }, goal: { ...goal }, until: tick + TICK_RATE * 8 };
    const lead = pick.edge && horizontalDistance(me, pick.edge) > 0.6 ? view.nav.findPath(me, pick.edge) : null;
    this.path = lead ? [...lead, { ...pick.across }] : [{ ...me }, { ...pick.across }];
  }
  /**
   * Stuck on the same spot again and again: somewhere 3–5 m to one side of the way it was going (walkable, and a
   * route there that isn't the way it was stuck), to walk to before carrying on. A few nav lookups, only then.
   */
  planSidestep(view) {
    const me = view.self.pos;
    const corner = this.path[this.pathIndex] ?? this.goal;
    const ahead = corner ? Math.atan2(corner.x - me.x, corner.z - me.z) : this.yaw;
    const first = this.routeRng() < 0.5 ? 1 : -1;
    for (const side of [first, -first]) {
      for (const turn of [0.5, 0.75]) {
        const a = ahead + side * Math.PI * turn;
        const d = 3 + this.routeRng() * 2;
        const p = view.nav.closestPoint({ x: me.x + Math.sin(a) * d, y: me.y + 0.5, z: me.z + Math.cos(a) * d }, { x: 1, y: 2, z: 1 });
        if (!p || horizontalDistance(p, me) < 2 || Math.abs(p.y - me.y) > 1.5) continue;
        const route = view.nav.findPath(me, p);
        if (!route || pathLength(route) > d * 2.5) continue;
        this.sidestep = { pos: p, until: view.tick + TICK_RATE * 4 };
        this.path = [];
        this.goal = null;
        this.lastPathTick = -Infinity;
        return;
      }
    }
  }
  /** The portal surface to walk into when the path's next leg is a portal link (from in front of one portal to out of the other). */
  portalFace(view, corner, prev) {
    if (!prev) return null;
    const near2 = (a, b, r) => horizontalDistance(a, b) < r && Math.abs(a.y - b.y) < 1.2;
    for (const p of view.portals) if (near2(prev, p.start, 1.6) && near2(corner, p.end, 1.8)) return p.face;
    return null;
  }
  /** Where to grab the zipline when the path's next leg is a zipline ride (from its grab spot to where it drops you). */
  zipGrab(view, corner, prev) {
    if (!prev) return null;
    const near2 = (a, b, r) => horizontalDistance(a, b) < r && Math.abs(a.y - b.y) < 1.2;
    for (const z of view.ziplines) if (z.on && near2(prev, z.start, 1.6) && near2(corner, z.end, 1.8)) return z.start;
    return null;
  }
  /** Went through a portal: the view turned with you (the server turned the body). */
  turned(turn) {
    this.yaw += turn;
    this.portalled = true;
  }
  /**
   * Lifts: the navmesh has a link from the platform's top at one end of its
   * run to the other. Coming up to the link, wait (a couple of metres back)
   * until the platform is there; on it, stand still until it has arrived.
   */
  liftWait(view, corner, prev) {
    const me = view.self.pos;
    const near2 = (a, b) => horizontalDistance(a, b) < 2.6 && Math.abs(a.y - b.y) < 0.8;
    for (const l of view.lifts) {
      if (prev && near2(prev, l.start) && near2(corner, l.end)) {
        const aboard = horizontalDistance(me, l.top) < l.half + 0.2 && Math.abs(me.y - l.top.y) < 0.3;
        if (aboard && Math.abs(me.y - l.end.y) > 0.5) return true;
      } else if (near2(corner, l.start)) {
        if (Math.abs(l.top.y - l.start.y) > 0.3 && horizontalDistance(me, l.start) < 2.5) {
          if (this.liftWaitSince < 0) this.liftWaitSince = view.tick;
          if (view.tick - this.liftWaitSince < TICK_RATE * LIFT_PATIENCE) return true;
          this.liftWaitSince = -1;
          this.offLiftsUntil = view.tick + TICK_RATE * 20;
          this.path = [];
          this.lastPathTick = -Infinity;
          return false;
        }
      }
    }
    this.liftWaitSince = -1;
    return false;
  }
  /** The path is shut by a door some button opens: go and press it (if it can be reached). */
  planPress(view, door) {
    const me = view.self.pos;
    for (let i = this.noPress.length - 1; i >= 0; i--) if (this.noPress[i].until <= view.tick) this.noPress.splice(i, 1);
    if (this.noPress.some((n) => sameBox(n.door, door))) return;
    const options = (view.doorButtons ?? []).filter((d) => sameBox(d.door, door)).sort((a, b) => horizontalDistance(me, a.stand) - horizontalDistance(me, b.stand));
    for (const o of options) {
      const path = view.nav.findPath(me, o.stand);
      if (!path) continue;
      const saved = this.path;
      this.path = path;
      const blocked = this.pathBlocked(view);
      this.path = saved;
      if (blocked) continue;
      const end = path[path.length - 1];
      const stand = end && horizontalDistance(end, o.stand) < 1.5 ? { x: o.stand.x, y: end.y, z: o.stand.z } : o.stand;
      this.pressPlan = { stand, face: o.face, until: view.tick + TICK_RATE * 20, door };
      this.path = path;
      this.goal = { ...stand };
      return;
    }
  }
  /** Chasing or investigating `goal` without getting any closer for five seconds. */
  stalled(view, goal) {
    const me = view.self.pos;
    const d = horizontalDistance(me, goal) + Math.abs(me.y - goal.y);
    const h = this.headway;
    if (!h || horizontalDistance(h.goal, goal) > 3 || view.tick - h.tick > TICK_RATE * 8) {
      this.headway = { goal: { ...goal }, best: d, tick: view.tick };
      return false;
    }
    if (d < h.best - 1) {
      h.best = d;
      h.tick = view.tick;
      return false;
    }
    return view.tick - h.tick > TICK_RATE * 5;
  }
  /** The closed door or breakable wall the planned path crosses, if any. */
  pathBlocked(view) {
    const shut = [...view.portals?.filter((p) => !p.on) ?? [], ...view.ziplines?.filter((z) => !z.on).map((z) => ({ ...z, face: z.start })) ?? []];
    if (shut.length) {
      const near2 = (a, b, r) => horizontalDistance(a, b) < r && Math.abs(a.y - b.y) < 1.2;
      for (let i = 1; i < this.path.length; i++) {
        const leg = shut.find((p) => near2(this.path[i - 1], p.start, 1.6) && near2(this.path[i], p.end, 1.8));
        if (leg) return { min: { x: leg.face.x - 0.5, y: leg.face.y, z: leg.face.z - 0.5 }, max: { x: leg.face.x + 0.5, y: leg.face.y + 3, z: leg.face.z + 0.5 } };
      }
    }
    if (!view.blockers?.length) return null;
    let prev = view.self.pos;
    for (const c of this.path) {
      const a = { x: prev.x, y: prev.y + 1, z: prev.z };
      const b = { x: c.x, y: c.y + 1, z: c.z };
      const rise = b.y - a.y;
      let hit;
      if (Math.abs(rise) > 1.5 && Math.abs(rise) > horizontalDistance(a, b) * 1.5) {
        const low = rise > 0 ? a : b;
        const corner = { x: low.x, y: Math.max(a.y, b.y), z: low.z };
        hit = view.blockers.find((box) => segmentHitsAabb(a, corner, box) || segmentHitsAabb(corner, b, box));
      } else hit = view.blockers.find((box) => segmentHitsAabb(a, b, box));
      if (hit) return hit;
      prev = c;
    }
    return null;
  }
  /** Would the next couple of metres along `moveYaw` enter an active trap we are not already standing in? */
  hazardAhead(view, moveYaw) {
    if (!view.hazards?.length) return false;
    const me = view.self.pos;
    const here = { x: me.x, y: me.y + 0.5, z: me.z };
    const ahead = { x: me.x + Math.sin(moveYaw) * 2, y: me.y + 0.5, z: me.z + Math.cos(moveYaw) * 2 };
    const inside = view.hazards.some((h) => segmentHitsAabb(here, here, h, PLAYER.radius));
    return !inside && view.hazards.some((h) => segmentHitsAabb(here, ahead, h, PLAYER.radius));
  }
  /** Detect lack of progress while trying to move; repath and hop when stuck. */
  checkStuck(view, moving) {
    const pos = view.self.pos;
    if (!moving) {
      this.stuckCheck = null;
      return false;
    }
    if (!this.stuckCheck) {
      this.stuckCheck = { tick: view.tick, pos: { ...pos } };
      return false;
    }
    if (view.tick - this.stuckCheck.tick < STUCK_WINDOW_TICKS) return false;
    const progressed = horizontalDistance(pos, this.stuckCheck.pos) > 0.6 || Math.abs(pos.y - this.stuckCheck.pos.y) > 0.5;
    this.stuckCheck = { tick: view.tick, pos: { ...pos } };
    if (progressed) return false;
    this.stuckCount++;
    this.path = [];
    this.goal = null;
    this.lastPathTick = -Infinity;
    this.cover = null;
    const log = this.stuckLog;
    log.push({ tick: view.tick, x: pos.x, z: pos.z });
    while (log.length && view.tick - log[0].tick > TICK_RATE * 10) log.shift();
    if (log.length >= 3 && log.every((l) => hypot(l.x - pos.x, l.z - pos.z) < 4)) {
      log.length = 0;
      this.stuckLoops++;
      this.planSidestep(view);
      if (this.roamGoal) this.avoid = { pos: { ...this.roamGoal }, until: view.tick + TICK_RATE * 20 };
      if (this.roamGoal) this.losePickup(view, this.roamGoal);
      this.roamGoal = null;
      this.via = null;
      this.heard = null;
      if (this.state === "chase") this.lastKnown = null;
      if (this.post) {
        this.post.board.unreachable(this.post.spot, this.slot, view.tick, TICK_RATE * 120);
        this.post = null;
        this.nextPost = view.tick + TICK_RATE * 5;
      }
    }
    return true;
  }
}
const key = (p) => `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)}`;
const sameBox = (a, b) => Math.abs(a.min.x - b.min.x) + Math.abs(a.min.z - b.min.z) + Math.abs(a.max.x - b.max.x) + Math.abs(a.max.z - b.max.z) + Math.abs(a.min.y - b.min.y) < 0.05;
function barrelReach(alt) {
  return Math.min(alt.range ?? 10, (alt.falloff?.end ?? 16) * 0.45);
}
const EDGE_WEIGHT = 0.4;
function weaponScore(w, c) {
  const { def } = w;
  const rounds = w.mag + w.reserve;
  if (def.magazine > 0 && rounds <= 0) return -Infinity;
  const { dist, target, profile } = c;
  const [lo, reach2] = botBand(def);
  const barrel = def.kind === "melee" && def.alt?.kind === "hitscan" && (w.alt ?? 0) >= def.alt.cost ? def.alt : null;
  const hi2 = barrel ? Math.max(reach2, barrelReach(barrel)) : reach2;
  let score = def.botDesirability + (dist >= lo && dist <= hi2 ? 0.6 : -Math.min(dist < lo ? lo - dist : dist - hi2, 20) * 0.03);
  score += EDGE_WEIGHT * ttkEdge(def.id, dist, !!c.held || dist >= 15);
  if (def.projectile && dist < def.projectile.splashRadius + 1) score -= 1.5 * (profile.selfPreservation / 100);
  if (profile.tags.includes("EXPLOSIVES_FAN") && def.projectile) score += 0.4;
  if (def.kind === "melee") score += profile.meleePreference / 100 * 0.5;
  if (c.vehicle) {
    if (antiVehicle(def) && !(def.projectile && dist < def.projectile.splashRadius + 1)) score += ANTI_VEHICLE_BONUS;
    else if (def.kind === "melee") score -= 1;
  }
  if (profile.weaponPreferences.includes(def.id)) score += 0.25;
  if (def.magazine > 0) {
    const scarcity = Math.max(0, 1 - rounds / Math.max(def.magazine * 2, def.reserveMax / 3));
    score -= scarcity * def.botDesirability * 0.5;
    if (target && !c.vehicle && target.health + target.armor <= 35) score -= scarcity * def.botDesirability * 0.6;
    if (target && dist < 15 && c.loadedElsewhere) {
      if (w.mag === 0) score -= 0.5;
      else if (def.magazine >= 6 && w.mag <= Math.max(1, Math.floor(def.magazine * 0.1))) score -= 0.3;
    }
  }
  if (c.held) score += 0.15;
  return score;
}
function pickupNeed(e, me, inventory, owned, throwables, throwable) {
  if (e.kind === "health") return (100 - me.health) / 60;
  if (e.kind === "armor") return (100 - me.armor) / 100;
  if (e.kind === "powerup") return 1;
  if (e.kind === "weapon") {
    const w = owned.get(e.weapon);
    if (w?.def.projectile?.disc && w.mag < w.def.magazine) return w.mag === 0 ? 1.2 : 0.5;
    return !w ? 1 : w.def.magazine > 0 && w.mag === 0 && w.reserve === 0 ? 1.2 : w.reserve < w.def.reserveMax / 3 ? 0.4 : 0;
  }
  if (e.kind === "ammo") {
    const low = inventory.filter((w) => w.def.magazine > 0 && (!e.ammo || w.def.ammo === e.ammo) && w.reserve < w.def.reserveMax / 3);
    return low.length ? low.some((w) => w.mag + w.reserve === 0) ? 0.9 : 0.6 : 0;
  }
  if (e.kind === "throwable") return throwables === 0 ? 0.5 : throwable === e.throwable && throwables < 2 ? 0.3 : 0;
  if (e.kind === "disc") return inventory.some((w) => w.def.projectile?.disc) ? 0.8 : 0;
  return 0;
}
function bestLoadedDesirability(inventory) {
  let best = 0;
  for (const w of inventory) if (w.def.magazine <= 0 || w.mag + w.reserve > 0) best = Math.max(best, w.def.botDesirability);
  return best;
}
function grenadeWorthIt(count, enemyInSight, tactical) {
  if (count <= 0) return false;
  return count > 1 || enemyInSight || tactical < 0.3;
}
function farthest(points, from) {
  let best;
  let bestD = -1;
  for (const p of points) {
    const d = horizontalDistance(p, from) + Math.abs(p.y - from.y);
    if (d > bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
const BOT_SWITCHES = { sideCorridors: true, hulls: true, squadDefend: true };
function sideCorridor(trips, me, goal, side) {
  if (!trips?.length) return null;
  let best = null;
  let bestD = 40;
  for (const t of trips) {
    const d = horizontalDistance(t.trip.to, goal);
    if (d < bestD && t.trip.corridors.length > 1) {
      bestD = d;
      best = t;
    }
  }
  if (!best) return null;
  const dx = goal.x - me.x;
  const dz = goal.z - me.z;
  const D = Math.hypot(dx, dz);
  if (D < 1) return null;
  let pick = null;
  let low = Infinity;
  best.trip.corridors.forEach((c, k) => {
    const v = c.via;
    if (k === 0 || !v) return;
    const rx = v.x - me.x;
    const rz = v.z - me.z;
    const along = (rx * dx + rz * dz) / (D * D);
    const off = (rx * dz - rz * dx) / D;
    if (along < 0.1 || along > 0.9 || off * side < 4) return;
    const cost = best.cost[k] ?? c.length;
    if (cost < low) {
      low = cost;
      pick = c;
    }
  });
  return pick;
}
function cheapestRoute(trips, goal, rng) {
  let best = null;
  let bestD = 40;
  for (const t of trips) {
    const d = horizontalDistance(t.trip.to, goal);
    if (d < bestD && t.trip.corridors.length) {
      bestD = d;
      best = t;
    }
  }
  if (!best) return null;
  let pick = null;
  let low = Infinity;
  best.trip.corridors.forEach((c, k) => {
    const cost = best.cost[k] * (1 + rng() * 0.3);
    if (cost < low) {
      low = cost;
      pick = c;
    }
  });
  return pick;
}
function holdsPost(g) {
  return !g.run && !g.order && !g.push && !g.squad;
}
function facingOf(t, at2) {
  const dx = at2.x - t.pos.x;
  const dz = at2.z - t.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  return (Math.sin(t.yaw) * dx + Math.cos(t.yaw) * dz) / d;
}
function nearestOf(points, from) {
  let best = null;
  let bestD = Infinity;
  for (const p of points ?? []) {
    const d = horizontalDistance(p, from);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
function arenaHop(always, fighting, strafing, running) {
  if (always) return strafing || running ? [0.5, 1.1] : null;
  return fighting && strafing ? [1.3, 2.4] : null;
}
function trimRouteEnd(path, d) {
  const out = [...path];
  let left = d;
  while (out.length >= 2 && left > 0) {
    const a = out[out.length - 2];
    const b = out[out.length - 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (len > left) {
      const k = (len - left) / len;
      out[out.length - 1] = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
      return out;
    }
    left -= len;
    out.pop();
  }
  return out;
}
const SIGHT_TTL_TICKS = 6;
const SIGHT_SLACK = 0.6;
class SightCache {
  constructor(physics) {
    this.physics = physics;
    this.version = physics.structureVersion;
  }
  physics;
  entries = /* @__PURE__ */ new Map();
  sweepTick = 0;
  /** The level's shape the entries were cast in (PhysicsWorld.structureVersion). */
  version = 0;
  hits = 0;
  misses = 0;
  /** Can actor `a` (eye `ea`) see actor `b` (eye `eb`) at `tick`? */
  lineOfSight(tick, a, ea, b, eb) {
    if (this.physics.structureVersion !== this.version) {
      this.entries.clear();
      this.version = this.physics.structureVersion;
    }
    const lo = a < b;
    const key2 = lo ? a * 2097152 + b : b * 2097152 + a;
    const p = lo ? ea : eb;
    const q = lo ? eb : ea;
    let e = this.entries.get(key2);
    if (e && tick - e.tick <= SIGHT_TTL_TICKS && near(e.ax, e.ay, e.az, p) && near(e.bx, e.by, e.bz, q)) {
      this.hits++;
      if (simProfile.on) simProfile.count("losShared");
      return e.ok;
    }
    this.misses++;
    const ok = this.physics.lineOfSight(p, q);
    if (!e) this.entries.set(key2, e = { tick, ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, ok });
    e.tick = tick;
    e.ax = p.x;
    e.ay = p.y;
    e.az = p.z;
    e.bx = q.x;
    e.by = q.y;
    e.bz = q.z;
    e.ok = ok;
    if (tick - this.sweepTick > 120) {
      this.sweepTick = tick;
      for (const [k, v] of this.entries) if (tick - v.tick > SIGHT_TTL_TICKS) this.entries.delete(k);
    }
    return ok;
  }
  /** Forget everything (the level changed: a door, a wall broken, rebuilt forts). */
  clear() {
    this.entries.clear();
  }
}
function near(x, y, z, p) {
  const dx = x - p.x;
  const dy = y - p.y;
  const dz = z - p.z;
  return dx * dx + dy * dy + dz * dz <= SIGHT_SLACK * SIGHT_SLACK;
}
const CELL = 8;
const OFFSET = 32768;
class ViewGrid {
  cells = /* @__PURE__ */ new Map();
  /** Arrays kept from earlier builds (no allocation per tick once warm). */
  spare = [];
  size = 0;
  /** Start over with these views. */
  reset(views) {
    for (const list2 of this.cells.values()) {
      list2.length = 0;
      this.spare.push(list2);
    }
    this.cells.clear();
    this.size = 0;
    for (const v of views) this.add(v);
    return this;
  }
  add(v) {
    const key2 = cellKey(Math.floor(v.pos.x / CELL), Math.floor(v.pos.z / CELL));
    let list2 = this.cells.get(key2);
    if (!list2) this.cells.set(key2, list2 = this.spare.pop() ?? []);
    list2.push(v);
    this.size++;
  }
  /**
   * The views within `r` m of (x, z) over the ground, into `out` (cleared first; maybe
   * a few just outside `r`, in the corner cells: callers check their own distance).
   */
  near(x, z, r, out) {
    out.length = 0;
    const x0 = Math.floor((x - r) / CELL);
    const x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL);
    const z1 = Math.floor((z + r) / CELL);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > this.cells.size * 2) {
      for (const list2 of this.cells.values()) for (const v of list2) out.push(v);
      return out;
    }
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const list2 = this.cells.get(cellKey(cx, cz));
        if (list2) for (const v of list2) out.push(v);
      }
    }
    return out;
  }
}
function cellKey(cx, cz) {
  return (cx + OFFSET) * 65536 + (cz + OFFSET);
}
const REGION = 24;
const FLOOR$1 = 4;
const layouts = /* @__PURE__ */ new WeakMap();
const regionKey = (p) => ((Math.floor(p.x / REGION) + 1024) * 2048 + (Math.floor(p.z / REGION) + 1024)) * 128 + (Math.floor(p.y / FLOOR$1) + 64);
function regionLayout(places) {
  let l = layouts.get(places);
  if (l) return l;
  const best = /* @__PURE__ */ new Map();
  for (const p of places) {
    const k = regionKey(p);
    const cx = (Math.floor(p.x / REGION) + 0.5) * REGION;
    const cz = (Math.floor(p.z / REGION) + 0.5) * REGION;
    const d = hypot(p.x - cx, p.z - cz);
    const prev = best.get(k);
    if (!prev || d < prev.d) best.set(k, { p, d });
  }
  const keys = [...best.keys()].sort((a, b) => a - b);
  const index = /* @__PURE__ */ new Map();
  keys.forEach((k, i) => index.set(k, i));
  l = { spots: keys.map((k) => best.get(k).p), index };
  layouts.set(places, l);
  return l;
}
class RegionMap {
  constructor(layout) {
    this.layout = layout;
    const n = layout.spots.length;
    this.lastVisit = new Float64Array(n).fill(-Infinity);
    this.count = new Uint16Array(n);
    this.claimedUntil = new Float64Array(n);
    this.contactUntil = new Float64Array(n);
  }
  layout;
  lastVisit;
  count;
  claimedUntil;
  /** Until when each region counts as where the side last met the enemy. */
  contactUntil;
  /** The regions of the latest contacts (a few, newest last): always among the candidates a pick looks at. */
  contacts = [];
  /** Someone on the side is fighting an enemy seen at `p`. */
  contact(p, until) {
    const i = this.regionOf(p);
    if (i < 0) return;
    this.contactUntil[i] = until;
    const at2 = this.contacts.indexOf(i);
    if (at2 >= 0) this.contacts.splice(at2, 1);
    this.contacts.push(i);
    if (this.contacts.length > 8) this.contacts.shift();
  }
  get size() {
    return this.layout.spots.length;
  }
  regionOf(p) {
    return this.layout.index.get(regionKey(p)) ?? -1;
  }
  /** Where the side's living members are now. */
  update(members, tick) {
    this.count.fill(0);
    for (const p of members) {
      const i = this.regionOf(p);
      if (i < 0) continue;
      this.lastVisit[i] = tick;
      if (this.count[i] < 65535) this.count[i]++;
    }
  }
  claim(i, until) {
    if (i >= 0) this.claimedUntil[i] = until;
  }
  /**
   * Somewhere worth going: regions nobody on the side has seen for a while
   * (and the bot hasn't either), at about the distance it likes, toward the
   * enemy in team modes, not crowded with teammates, not another squad's
   * goal. A walkable spot, or null.
   */
  pick(o) {
    const n = this.size;
    if (!n) return null;
    const samples = Math.min(n, o.samples ?? 24);
    let best = -1;
    let bestS = -Infinity;
    let fromTowards = Infinity;
    if (o.towards?.length && o.push) for (const t of o.towards) fromTowards = Math.min(fromTowards, horizontalDistance(t, o.from));
    const extra = o.contact ? this.contacts.length : 0;
    for (let s = 0; s < samples + extra; s++) {
      const i = s < samples ? Math.floor(o.rng() * n) : this.contacts[s - samples];
      const p = this.layout.spots[i];
      const d = horizontalDistance(p, o.from) + Math.abs(p.y - o.from.y) * 2;
      if (d < 12) continue;
      const sideAge = Math.min(90, (o.tick - this.lastVisit[i]) / TICK_RATE) / 90;
      const ownAge = o.memory ? Math.min(90, o.memory.ageSeconds(p, o.tick)) / 90 : 1;
      let score = (sideAge * 0.6 + ownAge * 0.4) * 2 * o.novelty - Math.abs(d - o.ideal) / 40 - Math.min(this.count[i], 6) * 0.25 * o.crowd + o.rng() * 0.6;
      if (o.avoidClaimed && o.tick < this.claimedUntil[i]) score -= 1.5;
      if (o.contact && o.tick < this.contactUntil[i] && this.count[i] < 4) score += o.contact;
      if (o.towards?.length && o.push) {
        let near2 = Infinity;
        for (const t of o.towards) near2 = Math.min(near2, horizontalDistance(t, p));
        score += Math.max(-1, Math.min(1, (fromTowards - near2) / 60)) * o.push;
      }
      if (score > bestS) {
        bestS = score;
        best = i;
      }
    }
    return best < 0 ? null : { pos: { ...this.layout.spots[best] }, region: best };
  }
}
const CORRIDOR_WIDTH = 10;
const SAME_WIDTH = 7;
const FLOOR = 3;
const PENALTY = 4;
const MAX_SHARED = 0.4;
const MAX_STRETCH = 1.6;
const EXTRA = 30;
const END_ZONE = 14;
const END_SHARE = 0.15;
const SPACING$1 = 12;
const LINE_STEP = 4;
const MAX_CORRIDORS = 3;
const prepared = /* @__PURE__ */ new WeakMap();
function prepare(g) {
  let p = prepared.get(g);
  if (p) return p;
  const { centre } = polyShapes(g);
  const ok = new Uint8Array(g.count);
  let h = 2166136261;
  for (let i = 0; i < g.count; i++) {
    ok[i] = g.flags[i] !== 0 ? 1 : 0;
    if (i % 7 === 0) {
      h = Math.imul(h ^ Math.round(centre[i * 3] * 10), 16777619);
      h = Math.imul(h ^ Math.round(centre[i * 3 + 1] * 10), 16777619);
      h = Math.imul(h ^ Math.round(centre[i * 3 + 2] * 10), 16777619);
    }
  }
  p = { g, centre, ok, key: `${g.count}:${g.links.length}:${h >>> 0}` };
  prepared.set(g, p);
  return p;
}
class Heap {
  idx;
  key;
  size = 0;
  constructor(n) {
    this.idx = new Int32Array(Math.max(16, n));
    this.key = new Float64Array(Math.max(16, n));
  }
  push(i, k) {
    if (this.size >= this.idx.length) {
      const idx = new Int32Array(this.idx.length * 2);
      const key2 = new Float64Array(this.key.length * 2);
      idx.set(this.idx);
      key2.set(this.key);
      this.idx = idx;
      this.key = key2;
    }
    let c = this.size++;
    while (c > 0) {
      const p = c - 1 >> 1;
      if (this.key[p] <= k) break;
      this.idx[c] = this.idx[p];
      this.key[c] = this.key[p];
      c = p;
    }
    this.idx[c] = i;
    this.key[c] = k;
  }
  pop() {
    const top = this.idx[0];
    const last = --this.size;
    if (last > 0) {
      const i = this.idx[last];
      const k = this.key[last];
      let c = 0;
      for (; ; ) {
        let m = c * 2 + 1;
        if (m >= last) break;
        if (m + 1 < last && this.key[m + 1] < this.key[m]) m++;
        if (this.key[m] >= k) break;
        this.idx[c] = this.idx[m];
        this.key[c] = this.key[m];
        c = m;
      }
      this.idx[c] = i;
      this.key[c] = k;
    }
    return top;
  }
}
function search(p, s, t, mult) {
  const { g, centre, ok } = p;
  const n = g.count;
  const cost = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = new Heap(256);
  const tx = centre[t * 3];
  const ty = centre[t * 3 + 1];
  const tz = centre[t * 3 + 2];
  const h = (i) => hypot(centre[i * 3] - tx, centre[i * 3 + 1] - ty, centre[i * 3 + 2] - tz);
  cost[s] = 0;
  heap.push(s, h(s));
  while (heap.size) {
    const a = heap.pop();
    if (done[a]) continue;
    done[a] = 1;
    if (a === t) break;
    const ax = centre[a * 3];
    const ay = centre[a * 3 + 1];
    const az = centre[a * 3 + 2];
    for (let k = g.linkStart[a]; k < g.linkStart[a + 1]; k++) {
      const b = g.links[k];
      if (done[b] || !ok[b]) continue;
      const step = hypot(centre[b * 3] - ax, centre[b * 3 + 1] - ay, centre[b * 3 + 2] - az) * (mult ? mult[b] : 1);
      const c = cost[a] + step;
      if (c < cost[b]) {
        cost[b] = c;
        from[b] = a;
        heap.push(b, c + h(b));
      }
    }
  }
  if (!done[t]) return null;
  const out = [];
  for (let i = t; i >= 0; i = from[i]) {
    out.push(i);
    if (i === s) break;
  }
  return out[out.length - 1] === s ? out.reverse() : null;
}
function crossing(g, a, b, centre) {
  const v = g.vxyz;
  if (g.type[b] !== 0) return { x: v[g.vstart[b] * 3], y: v[g.vstart[b] * 3 + 1], z: v[g.vstart[b] * 3 + 2] };
  if (g.type[a] !== 0) {
    const e = g.vstart[a] + 1;
    return { x: v[e * 3], y: v[e * 3 + 1], z: v[e * 3 + 2] };
  }
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let n = 0;
  for (let i = g.vstart[a]; i < g.vstart[a + 1]; i++) {
    for (let j = g.vstart[b]; j < g.vstart[b + 1]; j++) {
      if (Math.abs(v[i * 3] - v[j * 3]) + Math.abs(v[i * 3 + 1] - v[j * 3 + 1]) + Math.abs(v[i * 3 + 2] - v[j * 3 + 2]) < 1e-3) {
        sx += v[i * 3];
        sy += v[i * 3 + 1];
        sz += v[i * 3 + 2];
        n++;
      }
    }
  }
  if (n) return { x: sx / n, y: sy / n, z: sz / n };
  return { x: (centre[a * 3] + centre[b * 3]) / 2, y: (centre[a * 3 + 1] + centre[b * 3 + 1]) / 2, z: (centre[a * 3 + 2] + centre[b * 3 + 2]) / 2 };
}
function routeOf(p, polys, from, to) {
  const line = [{ ...from }];
  for (let i = 1; i < polys.length; i++) line.push(crossing(p.g, polys[i - 1], polys[i], p.centre));
  line.push({ ...to });
  return line;
}
function alongOf$1(pts) {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return out;
}
function lengthOf(line) {
  let len = 0;
  for (let i = 1; i < line.length; i++) len += hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z) + Math.abs(line[i].y - line[i - 1].y) * 0.5;
  return len;
}
function resample(line, step) {
  const out = [];
  if (!line.length) return out;
  out.push({ ...line[0] });
  let since = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    if (Math.abs(b.y - a.y) > 2.5) {
      const last2 = out[out.length - 1];
      if (hypot(last2.x - a.x, last2.z - a.z) > 0.5 || Math.abs(last2.y - a.y) > 0.5) out.push({ ...a });
      out.push({ ...b });
      since = 0;
      continue;
    }
    const d = hypot(b.x - a.x, b.z - a.z);
    let at2 = step - since;
    while (at2 <= d) {
      const f = d > 0 ? at2 / d : 0;
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f });
      at2 += step;
    }
    since = d - (at2 - step);
  }
  const last = line[line.length - 1];
  const end = out[out.length - 1];
  if (hypot(end.x - last.x, end.z - last.z) > 1 || Math.abs(end.y - last.y) > 1) out.push({ ...last });
  return out;
}
class PointGrid {
  constructor(cell) {
    this.cell = cell;
  }
  cell;
  cells = /* @__PURE__ */ new Map();
  pts = [];
  k(x, z) {
    return (Math.floor(x / this.cell) + 4096) * 8192 + (Math.floor(z / this.cell) + 4096);
  }
  add(p) {
    const i = this.pts.length / 3;
    this.pts.push(p.x, p.y, p.z);
    const k = this.k(p.x, p.z);
    const c = this.cells.get(k);
    if (c) c.push(i);
    else this.cells.set(k, [i]);
  }
  /** Whether a point lies within `r` (across) and FLOOR (up or down) of any point added. */
  near(x, y, z, r) {
    const span = Math.ceil(r / this.cell);
    const cx = Math.floor(x / this.cell);
    const cz = Math.floor(z / this.cell);
    for (let dx = -span; dx <= span; dx++) {
      for (let dz = -span; dz <= span; dz++) {
        const c = this.cells.get((cx + dx + 4096) * 8192 + (cz + dz + 4096));
        if (!c) continue;
        for (const i of c) {
          const px = this.pts[i * 3];
          const py = this.pts[i * 3 + 1];
          const pz = this.pts[i * 3 + 2];
          if (Math.abs(py - y) < FLOOR && (px - x) * (px - x) + (pz - z) * (pz - z) < r * r) return true;
        }
      }
    }
    return false;
  }
}
const cache$1 = /* @__PURE__ */ new Map();
function findCorridors(nav, from, to) {
  const g = nav.graph();
  const p = prepare(g);
  const s = nav.nearestPoly(from);
  const t = nav.nearestPoly(to);
  const key2 = `${p.key}|${s?.index ?? -1}|${t?.index ?? -1}|${Math.round(from.x)},${Math.round(from.z)}|${Math.round(to.x)},${Math.round(to.z)}`;
  const hit = cache$1.get(key2);
  if (hit) return hit;
  const trip = { from: { ...from }, to: { ...to }, corridors: s && t ? corridorsBetween(p, s.index, t.index, s.point, t.point) : [] };
  if (cache$1.size >= 256) cache$1.delete(cache$1.keys().next().value);
  cache$1.set(key2, trip);
  return trip;
}
function corridorsBetween(p, s, t, from, to) {
  const out = [];
  if (s === t || !p.ok[s] || !p.ok[t]) return out;
  const straight = hypot(to.x - from.x, to.z - from.z);
  const end = Math.max(END_ZONE, straight * END_SHARE);
  const inEnd = (x, y, z) => hypot(x - from.x, z - from.z) < end && Math.abs(y - from.y) < FLOOR * 2 || hypot(x - to.x, z - to.z) < end && Math.abs(y - to.y) < FLOOR * 2;
  const found = new PointGrid(4);
  const mult = new Float32Array(p.g.count).fill(1);
  for (let k = 0; k < MAX_CORRIDORS; k++) {
    const polys = search(p, s, t, k ? mult : null);
    if (!polys) break;
    const line = routeOf(p, polys, from, to);
    const length = lengthOf(line);
    const dense = resample(line, 2);
    let mid = 0;
    let shared = 0;
    for (const q of dense) {
      if (inEnd(q.x, q.y, q.z)) continue;
      mid++;
      if (k && found.near(q.x, q.y, q.z, SAME_WIDTH)) shared++;
    }
    const share = mid ? shared / mid : 1;
    if (k) {
      if (share > MAX_SHARED || length > out[0].length * MAX_STRETCH + EXTRA) break;
    }
    const points = resample(line, SPACING$1);
    const measure = resample(line, LINE_STEP);
    const lineAt = alongOf$1(measure);
    out.push({ points, pointsAt: alongOf$1(points), line: measure, lineAt, length, shared: k ? share : 0, via: null, viaApart: 0, vias: [], polys });
    for (const q of dense) found.add(q);
    const c = p.centre;
    for (let i = 0; i < p.g.count; i++) {
      if (mult[i] > 1) continue;
      const x = c[i * 3];
      const y = c[i * 3 + 1];
      const z = c[i * 3 + 2];
      if (!inEnd(x, y, z) && found.near(x, y, z, CORRIDOR_WIDTH)) mult[i] = 1 + PENALTY;
    }
  }
  if (out.length < 2) return out;
  return out.map((c, k) => {
    const [via, viaApart] = furthestFrom(c.line, c.lineAt, out.filter((_, j) => j !== k));
    return { ...c, via, viaApart, vias: via ? [via] : [] };
  });
}
function furthestFrom(line, lineAt, earlier) {
  const end = lineAt[lineAt.length - 1] ?? 0;
  let best = null;
  let bestD = -1;
  for (let i = 0; i < line.length; i++) {
    const at2 = lineAt[i];
    if (at2 < end * 0.2 || at2 > end * 0.8) continue;
    const p = line[i];
    let near2 = Infinity;
    for (const c of earlier) {
      for (const q of c.line) {
        if (Math.abs(q.y - p.y) > FLOOR) continue;
        const d = (q.x - p.x) * (q.x - p.x) + (q.z - p.z) * (q.z - p.z);
        if (d < near2) near2 = d;
      }
    }
    if (near2 > bestD) {
      bestD = near2;
      best = p;
    }
  }
  return best ? [{ ...best }, Math.sqrt(bestD)] : [null, 0];
}
function placeOn(c, p) {
  let best = -1;
  let bestD = Infinity;
  const line = c.line;
  for (let i = 0; i < line.length; i++) {
    const q = line[i];
    if (Math.abs(q.y - p.y) > FLOOR * 1.5) continue;
    const d = (q.x - p.x) * (q.x - p.x) + (q.z - p.z) * (q.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { at: best, off: best < 0 ? Infinity : Math.sqrt(bestD) };
}
const DEFAULT_PLAYBOOK = {
  recon: 2,
  split: "always",
  bound: "style",
  reconFrom: 6,
  reconFrom1: 4,
  flank: 0.45,
  stretch: 1.35,
  groupsFrom: 3,
  groupsFromLength: 180,
  stageShare: 0.35,
  stageMin: 28,
  stageMax: 60,
  gathered: 0.6,
  waitAfterFirst: 10,
  pushMost: 45,
  together: true,
  interceptors: 0,
  cutAhead: 30,
  crowd: 0.15,
  death: 0.35,
  seen: 0.2
};
const STAGE_PATIENCE = 25;
const NEAR_ROUTE = 12;
const DEATH_SECONDS = 60;
const SEEN_SECONDS = 20;
const MEMORY = 64;
const SAME_GOAL = 8;
const FORGET_SECONDS = 30;
class TeamBrain {
  /**
   * `sees`: whether one eye point sees another (the match's physics; without it, staging spots are picked by distance
   * alone).
   */
  constructor(playbook = DEFAULT_PLAYBOOK, sees = null, stagingHints = []) {
    this.playbook = playbook;
    this.sees = sees;
    this.stagingHints = stagingHints;
    this.pb = playbook;
  }
  playbook;
  sees;
  stagingHints;
  stats = { started: 0, reached: 0, lostHalf: 0, metres: 0, seconds: 0 };
  /** The side's trips with their prices (BotPlan.trips: every member reads the same list). */
  trips = [];
  groupOf = /* @__PURE__ */ new Map();
  /** The corridor (of the attack trip) each attacker set out on: kept until it dies or stops attacking. */
  ways = /* @__PURE__ */ new Map();
  /** Since when (tick) each attacker has been on its way to its staging spot without getting there. */
  staging = /* @__PURE__ */ new Map();
  lastAlive = /* @__PURE__ */ new Map();
  groups = {
    main: newGroup("main"),
    flank: newGroup("flank"),
    recon: newGroup("recon")
  };
  deaths = [];
  sightings = [];
  waves = [];
  attackTo = null;
  tripsFor = null;
  /** The playbook this update plays by (the mode's, from its brief, or the brain's own). */
  pb;
  /** Staging spots worked out per corridor (stagePoint: a few sight lines each, once). */
  stages = /* @__PURE__ */ new Map();
  /** A member of the side died here (the death price of the corridors near it). */
  death(pos, tick) {
    this.deaths.push({ pos: { ...pos }, tick });
    if (this.deaths.length > MEMORY) this.deaths.shift();
  }
  /**
   * The side's update, once a second: prices, groups, pushes, interceptors. `trips` are the side's own (the mode's,
   * and spawn to spawn); `all` every side's (an enemy's way home is one of them). Returns each member's job (members
   * without one: null).
   */
  update(tick, members, brief, trips, all) {
    this.pb = brief?.playbook ?? this.playbook;
    const pb = this.pb;
    const jobs = /* @__PURE__ */ new Map();
    for (const m of members) {
      jobs.set(m.slot, null);
      this.lastAlive.set(m.slot, tick);
      if (m.seen) {
        for (let k = this.groupOf.get(m.slot) === "recon" ? 2 : 1; k > 0; k--) this.sightings.push({ pos: { ...m.seen }, tick });
        while (this.sightings.length > MEMORY) this.sightings.shift();
      }
    }
    for (const [slot, at2] of this.lastAlive) {
      if (tick - at2 > TICK_RATE * FORGET_SECONDS) {
        this.lastAlive.delete(slot);
        this.groupOf.delete(slot);
      }
    }
    this.price(tick, members, trips);
    const attack = brief?.attack ?? null;
    const trip = attack ? this.tripTo(attack.pos) : null;
    if (!attack || !this.attackTo || horizontalDistance(this.attackTo, attack.pos) > SAME_GOAL) {
      this.attackTo = attack ? { ...attack.pos } : null;
      for (const g of Object.values(this.groups)) resetGroup(g);
      this.ways.clear();
      this.waves.length = 0;
    }
    const attackers = attack ? members.filter((m) => !m.ordered && !m.mounted && m.goal && !m.goal.run && horizontalDistance(m.goal.pos, attack.pos) < SAME_GOAL && Math.abs(m.goal.pos.y - attack.pos.y) < 4) : [];
    if (attack && trip && trip.trip.corridors.length && attackers.length >= pb.groupsFrom && (pb.split === "always" || pb.split === "push" && attack.stage)) this.assign(tick, attackers, attack, trip, jobs, members);
    else {
      for (const m of attackers) this.groupOf.delete(m.slot);
      for (const g of Object.values(this.groups)) g.members.length = 0;
    }
    const cut = brief?.intercept ?? null;
    if (cut && pb.interceptors > 0) this.intercept(cut, members, all, jobs);
    return jobs;
  }
  /** The side's trip ending at `to` (within SAME_GOAL), if any. */
  tripTo(to) {
    for (const t of this.trips) if (horizontalDistance(t.trip.to, to) < SAME_GOAL && Math.abs(t.trip.to.y - to.y) < 4) return t;
    return null;
  }
  /** Each corridor's price: crowd (members on it), deaths in the last minute and sightings lately near its route. */
  price(tick, members, trips) {
    const pb = this.pb;
    const known = this.tripsFor;
    if (!known || known.length !== trips.length || trips.some((t, i) => t !== known[i])) {
      this.tripsFor = trips;
      this.trips.length = 0;
      for (const t of trips) {
        const n = t.corridors.length;
        this.trips.push({ trip: t, cost: t.corridors.map((c) => c.length), crowd: new Array(n).fill(0), deaths: new Array(n).fill(0), seen: new Array(n).fill(0) });
      }
    }
    while (this.deaths.length && tick - this.deaths[0].tick > TICK_RATE * DEATH_SECONDS) this.deaths.shift();
    while (this.sightings.length && tick - this.sightings[0].tick > TICK_RATE * SEEN_SECONDS) this.sightings.shift();
    for (const p of this.trips) {
      const cs = p.trip.corridors;
      for (let k = 0; k < cs.length; k++) {
        const c = cs[k];
        let crowd = 0;
        for (const m of members) if (m.corridor === c) crowd++;
        let deaths = 0;
        for (const d of this.deaths) if (nearRoute(c, d.pos)) deaths++;
        let seen = 0;
        for (const s of this.sightings) if (nearRoute(c, s.pos)) seen++;
        p.crowd[k] = crowd;
        p.deaths[k] = deaths;
        p.seen[k] = seen;
        p.cost[k] = c.length * (1 + crowd * pb.crowd + deaths * pb.death + Math.min(seen, 6) * pb.seen);
      }
    }
  }
  /** Groups for the attackers, their corridors and pushes; each attacker's job. */
  assign(tick, attackers, attack, trip, jobs, members) {
    const pb = this.pb;
    if (!splits(trip.trip, pb)) {
      for (const m of attackers) this.groupOf.delete(m.slot);
      for (const g of Object.values(this.groups)) {
        g.members.length = 0;
        resetGroup(g);
      }
      return;
    }
    const ways = trip.trip.corridors.length;
    const n = attackers.length;
    const short = Math.min(...trip.trip.corridors.map((c) => c.length));
    const recon = n >= pb.reconFrom ? pb.recon : n >= pb.reconFrom1 ? 1 : 0;
    const flank = Math.round((n - recon) * pb.flank);
    const want = { main: n - recon - flank, flank, recon };
    const have = { main: [], flank: [], recon: [] };
    const loose = [];
    for (const m of [...attackers].sort((a, b) => a.slot - b.slot)) {
      const g = this.groupOf.get(m.slot);
      if (g && have[g].length < want[g]) have[g].push(m);
      else loose.push(m);
    }
    for (const kind of ["recon", "flank", "main"]) {
      const short2 = want[kind] - have[kind].length;
      if (short2 <= 0) continue;
      loose.sort((a, b) => suits(b.profile, kind) - suits(a.profile, kind) || a.slot - b.slot);
      have[kind].push(...loose.splice(0, short2));
    }
    have.main.push(...loose);
    for (const kind of ["main", "flank", "recon"]) {
      const g = this.groups[kind];
      g.members = have[kind].map((m) => m.slot);
      for (const m of have[kind]) this.groupOf.set(m.slot, kind);
    }
    const risk = (k) => trip.trip.corridors[k].length * (1 + trip.deaths[k] * pb.death + Math.min(trip.seen[k], 6) * pb.seen);
    const order = Array.from({ length: ways }, (_, k) => k).filter((k) => trip.trip.corridors[k].length <= short * pb.stretch + 20).sort((a, b) => risk(a) - risk(b) || a - b);
    const main = this.groups.main;
    const flk = this.groups.flank;
    const rec = this.groups.recon;
    const keep = (g, taken) => {
      if (g.corridor < 0 || g.corridor >= ways || taken.includes(g.corridor)) return false;
      if (g.waiting.size > 0 || g.sent.size > 0) return true;
      const best = order.find((k) => !taken.includes(k));
      return best === void 0 || risk(g.corridor) <= risk(best) * 1.33;
    };
    if (!keep(main, [])) main.corridor = order[0];
    if (!keep(flk, [main.corridor])) flk.corridor = order.find((k) => k !== main.corridor) ?? main.corridor;
    if (!keep(rec, [main.corridor, flk.corridor])) rec.corridor = order.find((k) => k !== main.corridor && k !== flk.corridor) ?? flk.corridor;
    const living = new Map(attackers.map((m) => [m.slot, m]));
    for (const slot of this.ways.keys()) if (!living.has(slot)) this.ways.delete(slot);
    for (const slot of this.staging.keys()) if (!living.has(slot)) this.staging.delete(slot);
    const to = trip.trip.to;
    const state = [];
    for (const kind of ["main", "flank", "recon"]) {
      const g = this.groups[kind];
      for (const slot of g.sent) if (!living.has(slot)) g.sent.delete(slot);
      for (const slot of g.waiting.keys()) if (!living.has(slot)) g.waiting.delete(slot);
      const ms = g.members.map((slot) => living.get(slot)).filter((m) => !!m);
      if (g.corridor < 0 || g.corridor >= ways || !ms.length) {
        resetGroup(g);
        continue;
      }
      for (const m of ms) if (!this.ways.has(m.slot)) this.ways.set(m.slot, g.corridor);
      const stages = attack.stage && kind !== "recon" && g.members.length >= 2;
      g.stage = stages ? this.stageOn(trip.trip.corridors[g.corridor], pb) : null;
      let behind = 0;
      for (const m of ms) {
        const stage = stages ? this.stageOn(trip.trip.corridors[this.ways.get(m.slot)], pb) : null;
        if (!stage || g.sent.has(m.slot)) continue;
        if (horizontalDistance(m.pos, to) < horizontalDistance(stage, to) - 5) {
          g.waiting.delete(m.slot);
          continue;
        }
        behind++;
        if (horizontalDistance(m.pos, stage) < 15 && Math.abs(m.pos.y - stage.y) < 4) {
          if (!g.waiting.has(m.slot)) g.waiting.set(m.slot, tick);
        } else g.waiting.delete(m.slot);
      }
      let ready = false;
      if (stages && g.waiting.size) {
        let first = tick;
        for (const at2 of g.waiting.values()) first = Math.min(first, at2);
        ready = g.waiting.size >= 2 && g.waiting.size >= Math.ceil(behind * pb.gathered) || tick - first >= TICK_RATE * pb.waitAfterFirst;
      }
      state.push({ g, kind, ms, ready });
    }
    const all = pb.together && state.some((x) => x.ready);
    for (const x of state) {
      const g = x.g;
      if ((x.ready || all) && g.waiting.size) {
        const slots = [...g.waiting.keys()].sort((a, b) => a - b);
        for (const slot of slots) g.sent.add(slot);
        g.waiting.clear();
        const c = trip.trip.corridors[this.ways.get(slots[0]) ?? g.corridor];
        this.waves.push({ at: tick, slots, from: meanLeft(slots.map((slot) => living.get(slot)), c), corridor: c });
        this.stats.started++;
      }
      for (const m of x.ms) {
        const c = trip.trip.corridors[this.ways.get(m.slot) ?? g.corridor];
        const stage = g.stage ? this.stageOn(c, pb) : null;
        let waits = !!stage && !g.sent.has(m.slot) && horizontalDistance(m.pos, to) >= horizontalDistance(stage, to) - 5;
        if (waits && !g.waiting.has(m.slot)) {
          const since = this.staging.get(m.slot) ?? tick;
          this.staging.set(m.slot, since);
          if (tick - since > TICK_RATE * STAGE_PATIENCE) {
            g.sent.add(m.slot);
            waits = false;
          }
        }
        if (!waits || g.waiting.has(m.slot)) this.staging.delete(m.slot);
        jobs.set(m.slot, { group: x.kind, to: { ...to }, route: c, stage: waits ? stage : null, goal: null, bound: pb.bound === "all" });
      }
    }
    this.followWaves(tick, attack.pos, new Map(members.map((m) => [m.slot, m])));
  }
  /** A corridor's staging spot (worked out once per corridor: a few sight lines). */
  stageOn(c, pb) {
    let at2 = this.stages.get(c);
    if (!at2) {
      at2 = stagePoint(c, pb, this.sees);
      this.stages.set(c, at2 = stageHint(c.line, at2, this.stagingHints) ?? at2);
    }
    return at2;
  }
  /**
   * Waves under way, for the scorecard: one that got a member to the objective reached it; one that lost half of those
   * who set out first, or ran past PUSH_MOST, is spent. Metres gained along the route and seconds go to the totals.
   */
  followWaves(tick, to, living) {
    const pb = this.pb;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      const alive = w.slots.map((s) => living.get(s)).filter((m) => !!m);
      const reached = alive.some((m) => horizontalDistance(m.pos, to) < 10 && Math.abs(m.pos.y - to.y) < 4);
      const lost = alive.length * 2 <= w.slots.length;
      if (!reached && !lost && tick - w.at < TICK_RATE * pb.pushMost) continue;
      if (reached) this.stats.reached++;
      else if (lost) this.stats.lostHalf++;
      this.stats.metres += Math.max(0, w.from - (reached || !alive.length ? 0 : meanLeft(alive, w.corridor)));
      this.stats.seconds += (tick - w.at) / TICK_RATE;
      this.waves.splice(i, 1);
    }
  }
  /**
   * Interceptors (a reaction: our flag carried off): up to `interceptors` members the enemy will run into: ahead of it
   * on its way home (nearer where it's going than it is), within reach of its route (the corridor, of the trips to
   * where it's going, that it is nearest), not right on it (those chase it as the mode says), not carrying anything.
   * Each goes to the point of that route nearest it if that is well ahead of the enemy, else `cutAhead` m ahead of the
   * enemy, and waits there for it (a goal to keep to); once the enemy is close, straight at it. Bots behind the enemy
   * don't turn back for it: chasing from behind is the mode's (the defenders and those close by).
   */
  intercept(cut, members, all, jobs) {
    const pb = this.pb;
    let route = null;
    let from = -1;
    let off = 25;
    for (const t of all) {
      if (horizontalDistance(t.to, cut.to) > 12) continue;
      for (const c of t.corridors) {
        const p = placeOn(c, cut.pos);
        if (p.at >= 0 && p.off < off) {
          off = p.off;
          route = c;
          from = p.at;
        }
      }
    }
    if (!route) return;
    const line = route.line;
    const at0 = route.lineAt[from];
    let ahead = from;
    while (ahead < line.length - 1 && route.lineAt[ahead] - at0 < pb.cutAhead) ahead++;
    const left = horizontalDistance(cut.pos, cut.to);
    const picks = [];
    for (const m of members) {
      if (m.ordered || m.mounted || m.goal?.run) continue;
      const near2 = horizontalDistance(m.pos, cut.pos);
      if (near2 < 20 || horizontalDistance(m.pos, cut.to) >= left) continue;
      const p = placeOn(route, m.pos);
      if (p.at < 0 || p.off > 40) continue;
      const k = route.lineAt[p.at] - at0 >= 10 ? p.at : ahead;
      const pos = near2 < 15 ? cut.pos : line[k];
      picks.push({ m, pos, d: horizontalDistance(m.pos, pos) + Math.abs(m.pos.y - pos.y) * 2 });
    }
    picks.sort((a, b) => a.d - b.d || a.m.slot - b.m.slot);
    for (const { m, pos } of picks.slice(0, pb.interceptors)) {
      jobs.set(m.slot, { group: "intercept", to: null, route: null, stage: null, goal: { pos: { ...pos }, radius: pos === cut.pos ? 1.5 : 3, push: true }, bound: false });
    }
  }
  /** Groups now (tests and the debug view): each one's corridor, staging spot, members, who waits there and who went on. */
  groupsNow() {
    return Object.values(this.groups).map((g) => ({ kind: g.kind, corridor: g.corridor, stage: g.stage, members: [...g.members], waiting: [...g.waiting.keys()], sent: [...g.sent] }));
  }
}
function newGroup(kind) {
  return { kind, corridor: -1, stage: null, waiting: /* @__PURE__ */ new Map(), sent: /* @__PURE__ */ new Set(), members: [] };
}
function splits(trip, pb) {
  const short = Math.min(...trip.corridors.map((c) => c.length));
  return short >= pb.groupsFromLength && trip.corridors.filter((c) => c.length <= short * pb.stretch + 20).length >= 2;
}
function resetGroup(g) {
  g.stage = null;
  g.waiting.clear();
  g.sent.clear();
}
function alongOf(c, p) {
  const at2 = placeOn(c, p);
  return at2.at < 0 || at2.off > 30 ? null : c.lineAt[at2.at];
}
function nearRoute(c, p) {
  return placeOn(c, p).off < NEAR_ROUTE;
}
function stagePoint(c, pb, sees) {
  const back = Math.min(pb.stageMax, Math.max(pb.stageMin, c.length * pb.stageShare));
  const end = c.lineAt[c.lineAt.length - 1];
  let k = c.line.length - 1;
  while (k > 0 && end - c.lineAt[k] < back) k--;
  if (!sees) return { ...c.line[k] };
  const goal = c.line[c.line.length - 1];
  const eye = (p) => ({ x: p.x, y: p.y + 1.5, z: p.z });
  const from = eye(goal);
  const lo = Math.max(pb.stageMin, 0);
  const hi2 = Math.min(pb.stageMax, end * 0.5);
  let best = k;
  let bestD = Infinity;
  for (let i = 0; i < c.line.length; i++) {
    const left = end - c.lineAt[i];
    if (left < lo || left > hi2) continue;
    const d = Math.abs(left - back);
    if (d >= bestD || sees(from, eye(c.line[i]))) continue;
    best = i;
    bestD = d;
  }
  return { ...c.line[best] };
}
function meanLeft(ms, c) {
  const end = c.lineAt[c.lineAt.length - 1];
  let sum = 0;
  let n = 0;
  for (const m of ms) {
    const at2 = alongOf(c, m.pos);
    if (at2 === null) continue;
    sum += end - at2;
    n++;
  }
  return n ? sum / n : c.length;
}
function suits(p, kind) {
  if (kind === "recon") return p.exploration + (hasTag(p, "EXPLORER") ? 60 : 0) + (hasTag(p, "LONE_WOLF") ? 50 : 0) + (hasTag(p, "ARENA") ? 15 : 0) - (hasTag(p, "BERSERKER") ? 40 : 0);
  if (kind === "flank") return p.aggression * 0.6 + p.exploration * 0.4 + (hasTag(p, "LONE_WOLF") ? 30 : 0);
  return 0;
}
const CLUSTER_MIN_PLAYERS = 16;
const CLUSTER_MIN_FREE = 6;
const LEAVE_RADIUS = 60;
const JOIN_RADIUS = 30;
const GATHER_RADIUS = 25;
const GOAL_PROGRESS = 15;
const ROLE_MIN_BOTS = 6;
const ROLE_SHARE = {
  mixed: { camper: 0.08, sniper: 0.1, lone_wolf: 0.1 },
  arena: { camper: 0.03, sniper: 0.05, lone_wolf: 0.12 },
  tactical: { camper: 0.14, sniper: 0.14, lone_wolf: 0.06 }
};
function assignRoles(bots, style, seed) {
  const out = /* @__PURE__ */ new Map();
  for (const b of bots) out.set(b.slot, "squad");
  const n = bots.length;
  const share = ROLE_SHARE[style];
  const hash = (slot) => createRng(seed * 31 + slot * 977 >>> 0)() * 0.5;
  const fill = (role, suit) => {
    const cap = n < ROLE_MIN_BOTS ? 0 : Math.max(0, Math.floor(n * share[role]));
    const cands = bots.filter((b) => out.get(b.slot) === "squad" && suit(b.profile) > 0).map((b) => ({ b, s: suit(b.profile) + hash(b.slot) })).sort((x, y) => y.s - x.s || x.b.slot - y.b.slot);
    for (const { b } of cands.slice(0, cap)) out.set(b.slot, role);
  };
  fill("sniper", (p) => hasTag(p, "BERSERKER") ? 0 : hasTag(p, "SNIPER") ? 2 + p.rangePreference / 100 : p.rangePreference >= 80 ? p.rangePreference / 100 : 0);
  fill("camper", (p) => hasTag(p, "BERSERKER") || hasTag(p, "RECKLESS") ? 0 : hasTag(p, "CAMPER") ? 3 : (p.selfPreservation + (100 - p.aggression) + p.tacticalAwareness - p.exploration) / 200 - 0.4);
  fill("lone_wolf", (p) => hasTag(p, "LONE_WOLF") ? 3 : hasTag(p, "EXPLORER") ? 1 + p.exploration / 100 : p.exploration >= 75 && p.teamLoyalty <= 50 ? 0.5 : 0);
  return out;
}
class BotDirector {
  constructor(seed, layout, places, sees = null, hints = []) {
    this.layout = layout;
    this.places = places;
    this.sees = sees;
    this.hints = hints;
    this.rng = createRng(seed * 2246822519 + 3266489917 >>> 0);
  }
  layout;
  places;
  sees;
  hints;
  plans = /* @__PURE__ */ new Map();
  sides = /* @__PURE__ */ new Map();
  clusters = /* @__PURE__ */ new Map();
  /** Each side's team brain (teamBrain.ts). */
  brains = /* @__PURE__ */ new Map();
  rng;
  nextId = 1;
  vantage = null;
  /** Each side's callouts (memory.ts: a teammate's sighting reaches the others). */
  callouts = /* @__PURE__ */ new Map();
  /** The map's bot hints by side (hints.ts). */
  sideHints = /* @__PURE__ */ new Map();
  /** The bot's plan (created on first use; the same object for the whole match). */
  planFor(slot) {
    let p = this.plans.get(slot);
    if (!p) this.plans.set(slot, p = { role: "squad", cluster: null, regions: null, vantage: this.vantage, towards: null, job: null, trips: NO_TRIPS });
    return p;
  }
  /** A side's team brain (made on first use). */
  brainFor(side) {
    let b = this.brains.get(side);
    if (!b) this.brains.set(side, b = new TeamBrain(void 0, this.sees, this.hintsFor(side).staging));
    return b;
  }
  /** A side's callouts (made on first use). */
  calloutsFor(side) {
    let b = this.callouts.get(side);
    if (!b) this.callouts.set(side, b = new CalloutBoard());
    return b;
  }
  /** The map's bot hints a side's bots use (its own and every side's). */
  hintsFor(side) {
    let h = this.sideHints.get(side);
    if (!h) this.sideHints.set(side, h = sideHints(this.hints, side));
    return h;
  }
  /** Someone on `side` died here: the team brain prices the corridors near it up for a minute. */
  noteDeath(side, pos, tick) {
    this.brainFor(side).death(pos, tick);
  }
  /** A side's group pushes so far (measuring: bot-report). */
  pushStats(side) {
    return this.brains.get(side)?.stats ?? null;
  }
  setRole(slot, role) {
    this.planFor(slot).role = role;
  }
  /** A bot's role, if it has a plan (measuring: bot-report). */
  roleOf(slot) {
    return this.plans.get(slot)?.role ?? null;
  }
  /** A side's region knowledge. */
  regionsFor(side) {
    let r = this.sides.get(side);
    if (!r) this.sides.set(side, r = new RegionMap(this.layout));
    return r;
  }
  /** A bot left the match (or was replaced): out of its squad. */
  forget(slot) {
    this.plans.delete(slot);
    for (const list2 of this.clusters.values()) for (const c of list2) c.members = c.members.filter((m) => m !== slot);
  }
  /**
   * One side's update: region knowledge from where everyone on it stands
   * (`everyone`), then squads from its free bots. `alert` tells a squad member
   * where its busy leader's enemy is.
   */
  update(tick, side, everyone, members, towards, squads, alert, brief = null, trips = [], allTrips = trips, fixed = null) {
    const regions = this.regionsFor(side);
    regions.update(everyone, tick);
    for (const m of members) if (m.enemyAt) regions.contact(m.enemyAt, tick + TICK_RATE * 20);
    const brain = this.brainFor(side);
    const jobs = brain.update(
      tick,
      members.map((m) => ({ slot: m.slot, pos: m.pos, profile: m.profile, goal: m.goal ?? null, corridor: m.corridor ?? null, ordered: !!m.ordered, mounted: !!m.mounted, seen: m.seen ?? null })),
      brief,
      trips,
      allTrips
    );
    for (const m of members) {
      const plan = this.planFor(m.slot);
      plan.regions = regions;
      plan.towards = towards;
      plan.vantage = this.vantage;
      plan.job = (m.unit !== void 0 ? jobs.get(m.unit) : void 0) ?? jobs.get(m.slot) ?? null;
      plan.trips = brain.trips;
      plan.side = side;
      plan.callouts = this.calloutsFor(side);
      plan.hints = this.hintsFor(side);
    }
    let list2 = this.clusters.get(side);
    if (!list2) this.clusters.set(side, list2 = []);
    let free = /* @__PURE__ */ new Map();
    for (const m of members) if (m.free) free.set(m.slot, m);
    if (!squads || !fixed && free.size < CLUSTER_MIN_FREE) {
      for (const m of members) this.planFor(m.slot).cluster = null;
      list2.length = 0;
      return;
    }
    if (fixed) {
      free = new Map(members.map((m) => [m.slot, m]));
      list2 = this.fixedClusters(list2, fixed, free);
    } else list2 = this.formClusters(list2, free);
    this.clusters.set(side, list2);
    this.directClusters(tick, list2, free, members, regions, towards, brain, alert);
  }
  /** Fireteams' bot-led squads as the director's clusters (the same cluster for the same leader, for its goal). */
  fixedClusters(list2, fixed, pool) {
    const byLeader = new Map(list2.map((c) => [c.view.leader, c]));
    const out = [];
    for (const g of fixed) {
      const lead = pool.get(g[0]);
      const ms = g.filter((s) => pool.has(s));
      if (!lead || ms.length < 2) continue;
      const c = byLeader.get(lead.slot) ?? { view: { id: this.nextId++, leader: lead.slot, leaderPos: { ...lead.pos }, goal: null, via: null, size: ms.length, leaderBusy: false, lagging: false, spacing: 3, route: null }, members: [], goalUntil: 0, region: -1, goalDist: Infinity };
      c.members = ms;
      out.push(c);
    }
    return out;
  }
  /** Squads from free bots close together (the usual way): keep, re-lead, break up, join, gather. */
  formClusters(list2, free) {
    const maxSize = free.size >= 30 ? 6 : free.size >= 16 ? 5 : 4;
    const assigned = /* @__PURE__ */ new Set();
    for (const c of list2) {
      let leader = free.get(c.view.leader);
      const kept = c.members.filter((s) => free.has(s));
      if (!leader && kept.length) leader = kept.map((s) => free.get(s)).sort((a, b) => leadScore(b) - leadScore(a) || a.slot - b.slot)[0];
      c.members = leader ? kept.filter((s) => s === leader.slot || horizontalDistance(free.get(s).pos, leader.pos) < LEAVE_RADIUS) : [];
      const boss = c.members.map((s) => free.get(s)).find((m) => m.teamLeader);
      if (boss) leader = boss;
      if (leader) c.view.leader = leader.slot;
      for (const s of c.members) assigned.add(s);
    }
    for (const c of list2) {
      if (c.members.length < 2) {
        for (const s of c.members) assigned.delete(s);
        c.members = [];
      }
    }
    list2 = list2.filter((c) => c.members.length > 0);
    const loose = [...free.values()].filter((m) => !assigned.has(m.slot)).sort((a, b) => a.slot - b.slot);
    for (const m of loose) {
      if (assigned.has(m.slot)) continue;
      let join = null;
      let joinD = JOIN_RADIUS;
      for (const c2 of list2) {
        if (c2.members.length >= maxSize) continue;
        const l = free.get(c2.view.leader);
        const d = l ? horizontalDistance(l.pos, m.pos) : Infinity;
        if (d < joinD) {
          joinD = d;
          join = c2;
        }
      }
      if (join) {
        join.members.push(m.slot);
        assigned.add(m.slot);
        continue;
      }
      const near2 = loose.filter((o) => o !== m && !assigned.has(o.slot) && horizontalDistance(o.pos, m.pos) < GATHER_RADIUS).sort((a, b) => horizontalDistance(a.pos, m.pos) - horizontalDistance(b.pos, m.pos) || a.slot - b.slot);
      if (!near2.length) continue;
      const group = [m, ...near2.slice(0, maxSize - 1)];
      const leader = group.slice().sort((a, b) => leadScore(b) - leadScore(a) || a.slot - b.slot)[0];
      const c = {
        view: { id: this.nextId++, leader: leader.slot, leaderPos: { ...leader.pos }, goal: null, via: null, size: group.length, leaderBusy: false, lagging: false, spacing: 3, route: null },
        members: group.map((g) => g.slot),
        goalUntil: 0,
        region: -1,
        goalDist: Infinity
      };
      for (const g of group) assigned.add(g.slot);
      list2.push(c);
    }
    return list2;
  }
  /** Each squad: where its leader is, whether it fights, whether someone lags; a new goal when due. */
  directClusters(tick, list2, free, members, regions, towards, brain, alert) {
    for (const m of members) this.planFor(m.slot).cluster = null;
    let lane = 0;
    for (const c of list2) {
      const leader = free.get(c.view.leader);
      const v = c.view;
      v.leaderPos.x = leader.pos.x;
      v.leaderPos.y = leader.pos.y;
      v.leaderPos.z = leader.pos.z;
      v.size = c.members.length;
      v.leaderBusy = leader.fighting;
      v.lagging = c.members.some((s) => horizontalDistance(free.get(s).pos, leader.pos) > 22);
      v.spacing = c.members.every((s) => hasTag(free.get(s).profile, "GRUNT")) ? 2 : 3.5;
      if (v.goal && tick >= c.goalUntil) {
        const d = horizontalDistance(leader.pos, v.goal);
        if (d < c.goalDist - GOAL_PROGRESS) {
          c.goalDist = d;
          c.goalUntil = tick + Math.round(TICK_RATE * (15 + this.rng() * 10));
          regions.claim(c.region, c.goalUntil);
        }
      }
      const arrived = !!v.goal && (horizontalDistance(leader.pos, v.goal) < 12 || c.members.filter((m) => horizontalDistance(free.get(m).pos, v.goal) < 12).length * 2 >= c.members.length);
      if (!v.goal || arrived || tick >= c.goalUntil) {
        const toEnemy = !!towards?.length && this.rng() < 0.5;
        const pick = toEnemy ? this.enemySide(towards, list2, c) : regions.pick({ from: leader.pos, tick, rng: this.rng, ideal: 70, novelty: 1, crowd: 0.6, towards, push: 1.8, avoidClaimed: true, contact: 1.2, samples: 32 });
        if (pick) {
          v.goal = pick.pos;
          c.region = pick.region;
          c.goalUntil = tick + Math.round(TICK_RATE * (20 + this.rng() * 15));
          c.goalDist = horizontalDistance(leader.pos, pick.pos);
          regions.claim(pick.region, c.goalUntil);
          v.route = toEnemy ? squadRoute(brain.trips, pick.pos, list2, c) : null;
          const l = (c.view.id + lane++) % 3 - 1;
          v.via = v.route || l === 0 ? null : laneWaypoint(this.places, leader.pos, pick.pos, l);
        }
      }
      for (const s of c.members) {
        this.planFor(s).cluster = v;
        const mm = free.get(s);
        if (v.leaderBusy && s !== leader.slot && !mm.fighting && leader.enemyAt && horizontalDistance(mm.pos, leader.pos) < 45) alert(s, leader.enemyAt);
      }
    }
  }
  /** One of the enemy's spawn points no other squad of the side is heading for (if there is one), as a goal. */
  enemySide(towards, squads, self) {
    const start = Math.floor(this.rng() * towards.length);
    let p = towards[start];
    for (let k = 0; k < towards.length; k++) {
      const q = towards[(start + k) % towards.length];
      if (!squads.some((o) => o !== self && o.view.goal && horizontalDistance(o.view.goal, q) < 3)) {
        p = q;
        break;
      }
    }
    return { pos: { ...p }, region: -1 };
  }
  /** Squads on a side (tests and the debug overlay). */
  squads(side) {
    return (this.clusters.get(side) ?? []).map((c) => ({ leader: c.view.leader, members: c.members, goal: c.view.goal }));
  }
}
const NO_TRIPS = [];
function squadRoute(trips, goal, squads, self) {
  let best = null;
  let bestD = 40;
  for (const t of trips) {
    const d = horizontalDistance(t.trip.to, goal);
    if (d < bestD && t.trip.corridors.length) {
      bestD = d;
      best = t;
    }
  }
  if (!best) return null;
  let pick = -1;
  let low = Infinity;
  best.trip.corridors.forEach((c, k) => {
    const taken = squads.some((o) => o !== self && o.view.route === c);
    const cost = best.cost[k] * (taken ? 2 : 1);
    if (cost < low) {
      low = cost;
      pick = k;
    }
  });
  return pick >= 0 ? best.trip.corridors[pick] : null;
}
const leadAbility = (p) => p.teamLoyalty + p.tacticalAwareness + (hasTag(p, "TACTICAL") ? 20 : 0) - (hasTag(p, "COWARD") ? 500 : 0);
const leadScore = (m) => (m.teamLeader ? 1e3 : 0) + leadAbility(m.profile);
const SAMPLES = 640;
const KEEP = 36;
const SPACING = 14;
const DIRS = 8;
const EYE = 1.5;
const FAR = 90;
const PARKOUR_SPOT = 0.45;
const PARKOUR_SAMPLES = 160;
function computeVantage(places, raycast, parkour = []) {
  if (!places.length) return [];
  const CELL2 = 16;
  const cellY = /* @__PURE__ */ new Map();
  const ck = (x, z) => (Math.floor(x / CELL2) + 4096) * 8192 + (Math.floor(z / CELL2) + 4096);
  for (const p of places) {
    const k = ck(p.x, p.z);
    const c = cellY.get(k);
    if (c) {
      c.sum += p.y;
      c.n++;
    } else cellY.set(k, { sum: p.y, n: 1 });
  }
  const groundNear = (p) => {
    let low = Infinity;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const c = cellY.get(ck(p.x + dx * CELL2, p.z + dz * CELL2));
        if (c) low = Math.min(low, c.sum / c.n);
      }
    }
    return Number.isFinite(low) ? low : p.y;
  };
  const stride = Math.max(1, places.length / SAMPLES);
  const sniper = [];
  const camp = [];
  const dist = new Float64Array(DIRS);
  const samples = [];
  for (let f = 0; f < places.length; f += stride) samples.push({ p: places[Math.floor(f)], parkour: false });
  const pStride = Math.max(1, parkour.length / PARKOUR_SAMPLES);
  for (let f = 0; f < parkour.length; f += pStride) samples.push({ p: parkour[Math.floor(f)], parkour: true });
  for (const { p, parkour: only } of samples) {
    const eye = { x: p.x, y: p.y + EYE, z: p.z };
    for (let k = 0; k < DIRS; k++) {
      const a = k / DIRS * Math.PI * 2;
      dist[k] = raycast(eye, { x: Math.sin(a), y: 0, z: Math.cos(a) }, FAR) ?? FAR;
    }
    let bestK = 0;
    let bestOpen = -1;
    let walls = 0;
    for (let k = 0; k < DIRS; k++) {
      const open = (dist[(k + DIRS - 1) % DIRS] + dist[k] * 2 + dist[(k + 1) % DIRS]) / 4;
      if (open > bestOpen) {
        bestOpen = open;
        bestK = k;
      }
      if (dist[k] < 3) walls++;
    }
    const yaw = bestK / DIRS * Math.PI * 2;
    const height = p.y - groundNear(p);
    const backed = dist[(bestK + DIRS / 2) % DIRS] < 4 ? 1 : 0;
    if (bestOpen >= 40 && walls < DIRS - 2) {
      const score = Math.min(bestOpen, FAR) / FAR + Math.max(0, Math.min(height / 8, 1)) * 0.8 + backed * 0.5 + Math.min(walls, 4) * 0.12 + (only ? PARKOUR_SPOT : 0);
      sniper.push({ pos: { ...p }, kind: "sniper", yaw, reach: bestOpen, height, score, ...only ? { parkour: true } : {} });
    }
    if (walls >= 2 && walls <= DIRS - 3 && bestOpen >= 10 && bestOpen <= 55) {
      const score = walls / DIRS * 1.2 + Math.min(bestOpen, 40) / 40 * 0.6 + (height > 1.5 ? 0.2 : 0) + backed * 0.2;
      camp.push({ pos: { ...p }, kind: "camp", yaw, reach: bestOpen, height, score });
    }
  }
  return [...spread(sniper), ...spread(camp)];
}
function spread(list2) {
  list2.sort((a, b) => b.score - a.score || a.pos.x - b.pos.x || a.pos.z - b.pos.z);
  const out = [];
  for (const s of list2) {
    if (out.length >= KEEP) break;
    if (out.some((o) => horizontalDistance(o.pos, s.pos) < SPACING && Math.abs(o.pos.y - s.pos.y) < 3)) continue;
    out.push(s);
  }
  return out;
}
const cache = /* @__PURE__ */ new Map();
function fingerprint(places) {
  let h = 2166136261;
  for (let i = 0; i < places.length; i += Math.max(1, places.length >> 6)) {
    const p = places[i];
    h = Math.imul(h ^ Math.round(p.x * 10), 16777619);
    h = Math.imul(h ^ Math.round(p.y * 10), 16777619);
    h = Math.imul(h ^ Math.round(p.z * 10), 16777619);
  }
  return `${places.length}:${h >>> 0}`;
}
function vantageFor(places, raycast, parkour = []) {
  const key2 = `${fingerprint(places)}+${fingerprint(parkour)}`;
  let spots = cache.get(key2);
  if (!spots) {
    spots = computeVantage(places, raycast, parkour);
    if (cache.size >= 8) cache.delete(cache.keys().next().value);
    cache.set(key2, spots);
  }
  return spots;
}
class VantageBoard {
  constructor(spots) {
    this.spots = spots;
    this.holder = new Int32Array(spots.length).fill(-1);
    this.holdUntil = new Float64Array(spots.length);
    this.badUntil = new Float64Array(spots.length);
    this.bonus = new Float32Array(spots.length);
  }
  spots;
  holder;
  holdUntil;
  badUntil;
  /** Each spot's worth for this match on top of its own score (snipers: how well it covers the ways the enemy comes). */
  bonus;
  /**
   * The match's lanes (the trips' corridors' routes): each sniper spot's bonus is how well it covers them (sniper.ts
   * laneCover: the share of the lane points in its view it can see), × `weight`. A sight line per point checked, at most
   * 24 a spot, once per match.
   */
  lanes(lines, sees, weight = 0.8) {
    for (let i = 0; i < this.spots.length; i++) {
      const s = this.spots[i];
      if (s.kind === "sniper") this.bonus[i] = laneCover(s, lines, sees) * weight;
    }
  }
  /**
   * The best free spot of a kind for a bot at `from`: by the spot's own score,
   * nearer is better (within `within` m), and `prefer` (0..1 per spot, e.g. the
   * middle of the map in team modes) on top. Returns its index, or -1.
   */
  pick(kind, from, tick, within, rng, prefer, skip = -1, side) {
    let best = -1;
    let bestS = -Infinity;
    for (let i = 0; i < this.spots.length; i++) {
      const s = this.spots[i];
      if (s.kind !== kind || i === skip || s.team !== void 0 && s.team !== side || tick < this.badUntil[i] || this.holder[i] >= 0 && tick < this.holdUntil[i]) continue;
      const d = horizontalDistance(s.pos, from) + Math.abs(s.pos.y - from.y) * 2;
      if (d > within) continue;
      const score = s.score + this.bonus[i] - d / within + (prefer ? prefer(s.pos) : 0) + rng() * 0.3;
      if (score > bestS) {
        bestS = score;
        best = i;
      }
    }
    return best;
  }
  claim(i, slot, until) {
    this.holder[i] = slot;
    this.holdUntil[i] = until;
  }
  release(i, slot) {
    if (this.holder[i] === slot) this.holder[i] = -1;
  }
  /** No way there: leave it alone for a while. */
  unreachable(i, slot, tick, ticks) {
    this.release(i, slot);
    this.badUntil[i] = tick + ticks;
  }
  heldBy(i) {
    return this.holder[i];
  }
}
const DEBUG_FAILED = 200;
const DEBUG_EVERY = Math.round(TICK_RATE / 4);
class BotDebugCollector {
  failed = [];
  lastFail = /* @__PURE__ */ new Map();
  frame(src) {
    const bots = [];
    const calls = /* @__PURE__ */ new Map();
    for (const b of src.bots()) {
      const info = b.brain.debugInfo();
      const nr = info.noRoute;
      if (nr) {
        const k = `${info.failures}`;
        if (this.lastFail.get(b.slot) !== k) {
          this.lastFail.set(b.slot, k);
          this.failed.push({ from: nr.from, goal: nr.goal, tick: src.tick });
          if (this.failed.length > DEBUG_FAILED) this.failed.shift();
        }
      }
      for (const c of b.callouts) if (src.tick - c.tick <= TICK_RATE * 3) calls.set(`${c.by}:${c.slot}:${c.tick}`, { by: c.by, slot: c.slot, pos: { ...c.pos }, tick: c.tick });
      bots.push({ ...info, slot: b.slot, team: b.faction, pos: { ...b.pos }, alive: b.alive, role: b.role });
    }
    return { tick: src.tick, bots, failed: this.failed.map((f) => ({ ...f })), callouts: [...calls.values()] };
  }
}
const DROP_HURTS_UP_TO = 5 + 30 / 9;
const DROP_FREE = 60;
function scenarioBlockers(map) {
  const out = windowPanes(map).map((p) => p.box);
  for (const e of map.entities) {
    if (e.kind === "door") {
      const d = doorway(e);
      out.push({ ...d, half: { ...d.half, z: DOOR.thickness } });
    } else if (e.kind === "destructible") out.push(destructibleBox(e));
  }
  return out;
}
const solidsRay = (solids) => solids.length ? (o, d, max) => boxesRay(solids, o, d, max) : void 0;
function dropOptions(map, physics, geometry, phys) {
  const liquids = mapLiquids(map.entities);
  return {
    physics,
    gravity: phys.gravity,
    blockers: scenarioBlockers(map),
    spawns: map.entities.filter((e) => e.kind === "spawn").map((e) => ({ x: e.position[0], y: e.position[1], z: e.position[2] })),
    maxDrop: phys.fallDamage ? DROP_HURTS_UP_TO / Math.max(0.05, phys.gravity) : DROP_FREE,
    floorY: mapKillY(geometry, map),
    deadly: liquids.length ? (p) => {
      const l = liquidAt(liquids, { x: p.x, y: p.y + 0.3, z: p.z });
      return !!l && LIQUID_SPECS[l.liquid].dps >= 30;
    } : void 0,
    // Over a body's chest: swimming (bots don't swim out; they surface and drown in the end).
    underLiquid: liquids.length ? (p) => !!liquidAt(liquids, { x: p.x, y: p.y + SWIM_DEPTH + 0.2, z: p.z }) : void 0,
    // Breakable props and moving or breaking blocks: the scenario's, added to the physics after the navmesh.
    solids: [...propBoxes(map, true), ...blockBoxes(map, true)],
    // The map's jump links (bot hints): parkour candidates first, played through like the rest.
    jumps: hintJumps(map)
  };
}
function buildMapNav(map, geometry, physics, envShapes, phys, extra = [], parkour = true) {
  const drops = { ...dropOptions(map, physics, geometry, phys), noParkour: !parkour };
  const solids = drops.solids ?? [];
  return NavWorld.build(
    [...geometry, ...solids, ...extra],
    joinTriangles(mapTerrainMesh(map), environmentNavTriangles(envShapes)),
    // (Jump pads' flights come down on the scenario's solids too, as the navmesh has them.)
    [...navLinks(map.entities, physics, phys.gravity, solidsRay(extra.length ? [...solids, ...extra] : solids)), ...liftLinks(map)],
    false,
    drops
  );
}
function validateMapNavigation(map, official, opts = {}) {
  const built = mapNavigation(map);
  try {
    const drop = { ...dropOptions(map, built.physics, built.geometry, built.phys), official };
    const audit = auditNavigation(map, built.nav, built.physics, drop);
    const issues = [...validateNavigation(map, built.nav, built.physics, { ...drop, done: audit }), ...botHintNavIssues(map, built.nav)];
    return { issues, audit, ...opts.computed ? { computed: computedBotSpots(built) } : {} };
  } finally {
    built.physics.free();
    built.nav.destroy();
  }
}
function computedBotSpots(built) {
  const { nav, physics } = built;
  const vantage = vantageFor(nav.mainPlaces(), (o, d, max) => physics.raycastWorld(o, d, max), nav.parkourPlaces()).map((v) => ({ ...v, pos: { ...v.pos } }));
  return { vantage, parkour: nav.parkour.map((l) => ({ kind: l.kind, start: { ...l.start }, end: { ...l.end } })) };
}
function mapNavigation(map, rules) {
  const geometry = buildMapGeometry(map);
  const envShapes = environmentShapes(map);
  const physics = new PhysicsWorld(geometry, mapTerrainMesh(map), envShapes);
  const phys = rules ? matchPhysics(rules, map) : { gravity: map.physics?.gravity ?? 1, fallDamage: map.physics?.fallDamage ?? false };
  const nav = buildMapNav(map, geometry, physics, envShapes, phys);
  return { geometry, physics, nav, phys, envShapes };
}
const CTF_ROLES = {
  defenders: [
    [12, 3],
    [4, 2],
    [2, 1]
  ],
  escorts: 3,
  respond: 22,
  threat: 16,
  defendRadius: 9,
  carrierAwareness: 15,
  carrierWait: 8
};
const STRAIGHT = { ...DEFAULT_PLAYBOOK, split: "never" };
const BREAKTHROUGH = {
  team: { ...DEFAULT_PLAYBOOK, groupsFromLength: 0, bound: "all" },
  breakthrough: { smoke: true, tunnelGroups: true, guns: 0.25, trenches: 0.4, crestSnipers: 0.15, fallBack: 0.3, fallBackAt: 0.5 }
};
const PLAYBOOKS = {
  "core.ctf": { team: DEFAULT_PLAYBOOK, ctf: CTF_ROLES },
  "core.forts": { team: DEFAULT_PLAYBOOK, ctf: CTF_ROLES },
  "core.koth": { team: STRAIGHT },
  "core.bomb": { team: STRAIGHT },
  "core.hostage": { team: STRAIGHT },
  "core.elim": { team: STRAIGHT },
  "core.tdm": { team: STRAIGHT },
  "core.coop": { team: STRAIGHT },
  "core.zombies": { team: STRAIGHT },
  "core.breakthrough": BREAKTHROUGH
};
function playbookFor(mode) {
  return PLAYBOOKS[mode] ?? { team: DEFAULT_PLAYBOOK };
}
function ctfDefendersBy(roles, teamSize) {
  for (const [from, n] of roles.defenders) if (teamSize >= from) return n;
  return 0;
}
const ROLES$1 = playbookFor("core.ctf").ctf;
const RESPOND_RANGE = ROLES$1.respond;
const THREAT_RANGE = ROLES$1.threat;
const ESCORTS = ROLES$1.escorts;
const DEFEND_RADIUS = ROLES$1.defendRadius;
const CARRIER_AWARENESS = ROLES$1.carrierAwareness;
const CARRIER_WAIT = ROLES$1.carrierWait;
function ctfDefenders(teamSize) {
  return ctfDefendersBy(ROLES$1, teamSize);
}
const SQUAD_DEFEND_MIN = 4;
function ctfSquadRoles(squads) {
  const out = /* @__PURE__ */ new Map();
  let def = null;
  if (squads.length >= SQUAD_DEFEND_MIN) {
    for (const q of squads) if (!def || q.size < def.size || q.size === def.size && q.id > def.id) def = q;
  }
  for (const q of squads) out.set(q.id, q === def ? "defend" : "attack");
  return out;
}
function fitRoles(sizes, n) {
  let held = 0;
  let attackers = sizes.length;
  return sizes.map((size) => {
    const defend = attackers > 1 && held + size <= n;
    if (defend) {
      held += size;
      attackers--;
    }
    return defend ? "defend" : "attack";
  });
}
function defendScore(c) {
  const p = c.bot.profile;
  let s = (100 - p.aggression) * 0.5 + (100 - p.exploration) * 0.3 + p.tacticalAwareness * 0.2;
  if (hasTag(p, "CAMPER")) s += 100;
  if (hasTag(p, "SNIPER")) s += 60;
  if (hasTag(p, "BERSERKER") || hasTag(p, "RECKLESS") || hasTag(p, "LONE_WOLF") || hasTag(p, "EXPLORER")) s -= 100;
  return s;
}
class CtfBotPlan {
  /** Each Player Bot's standing role (attack or defend). */
  roles = /* @__PURE__ */ new Map();
  /** Bots escorting a teammate who carries the enemy flag (the nearest few attackers). */
  escorts = /* @__PURE__ */ new Set();
  /** Per team: the nearest enemy within THREAT_RANGE of its flag while the flag is at home. */
  threat = /* @__PURE__ */ new Map();
  lineup = "";
  rolesAt = -Infinity;
  /**
   * Fireteams (Part 2, objective first; ModeLogic.botUnits): a bot's bot-led squad, which takes one role for all of it
   * (null: a bot in a person's squad, no role of its own; undefined: no squads).
   */
  unitOf = null;
  /** Fireteams follow-ups: every slot's squad, people's included (ModeLogic.botUnits' second argument). */
  squadOf = null;
  /** Fireteams follow-ups: each squad's role (by squad id), worked out with the bots' roles. */
  squadRoleOf = /* @__PURE__ */ new Map();
  update(tick, everyone, flags) {
    if (tick % 6 !== 0 && tick - this.rolesAt < TICK_RATE * 5) return;
    const unit = this.unitOf;
    const sq = this.squadOf;
    const squadKey = (slot) => {
      const q = sq?.(slot);
      return q ? `${q.id}${q.human ? q.ordered ? "o" : "h" : ""}` : "-";
    };
    const lineup = everyone.map((c) => `${c.slot}${c.faction ?? ""}${c.kind[0]}${unit ? `:${unit(c.slot) ?? "-"}` : ""}${sq ? `/${squadKey(c.slot)}` : ""}`).join(",");
    if (lineup !== this.lineup || tick - this.rolesAt >= TICK_RATE * 5) {
      this.lineup = lineup;
      this.rolesAt = tick;
      this.roles.clear();
      this.squadRoleOf.clear();
      const teams = /* @__PURE__ */ new Map();
      for (const c of everyone) {
        if (!c.faction || c.kind === "npc") continue;
        let t = teams.get(c.faction);
        if (!t) teams.set(c.faction, t = []);
        t.push(c);
      }
      for (const members of teams.values()) {
        const bots = members.filter((c) => c.kind === "bot" && c.bot).sort((a, b) => defendScore(b) - defendScore(a) || a.slot - b.slot);
        const keep = members.some((c) => c.kind === "human") ? 0 : 1;
        const n = Math.max(0, Math.min(ctfDefenders(members.length), bots.length - keep));
        if (sq && members.some((c) => sq(c.slot) !== void 0)) this.squadRoles(members, bots, n, sq);
        else if (unit && bots.some((c) => unit(c.slot) !== void 0)) this.fitSquadRoles(bots, n, unit);
        else bots.forEach((c, i) => this.roles.set(c.slot, i < n ? "defend" : "attack"));
      }
    }
    this.escorts.clear();
    this.threat.clear();
    for (const f of flags) {
      if (f.state === FLAG_CARRIED && f.carrier !== null) {
        const carrier = everyone.find((c) => c.slot === f.carrier);
        if (!carrier) continue;
        const mates = everyone.filter((c) => c.alive && c.bot && c.faction === carrier.faction && c !== carrier && this.roles.get(c.slot) !== "defend");
        mates.sort((a, b) => horizontalDistance(a.move.pos, carrier.move.pos) - horizontalDistance(b.move.pos, carrier.move.pos));
        for (const c of mates.slice(0, ESCORTS)) this.escorts.add(c.slot);
      } else if (f.state === FLAG_HOME) {
        let best = THREAT_RANGE;
        let at2 = null;
        for (const c of everyone) {
          if (!c.alive || !c.faction || c.faction === f.team || c.kind === "npc") continue;
          const d = horizontalDistance(c.move.pos, f.base);
          if (d < best && Math.abs(c.move.pos.y - f.base.y) < 4) {
            best = d;
            at2 = c.move.pos;
          }
        }
        if (at2) this.threat.set(f.team, { ...at2 });
      }
    }
  }
  /**
   * Fireteams follow-ups (owner, 2026-11-10): roles by whole squads (ctfSquadRoles). With SQUAD_DEFEND_MIN (4) or more
   * squads on the side the smallest defends its own flag (holds round its base, goes to touch it when dropped, chases its carrier:
   * ctfBotGoal's defend), ties to the higher squad id; with fewer all attack. A bot-led squad plays its role; a person's
   * squad has it only as its default until the person gives an order (then the bots do what they're told, and play
   * attack meanwhile when ordered: they follow the person). `everyone`: the side's players, people included (each squad's
   * size counts them, alive or not). BOT_OFF=squadDefend: Part 2's rule (fitSquadRoles), for measuring.
   */
  squadRoles(everyone, bots, n, sq) {
    if (!BOT_SWITCHES.squadDefend) {
      const unit = (slot) => {
        const q = sq(slot);
        return q ? q.human ? null : q.id : void 0;
      };
      this.fitSquadRoles(bots, n, unit);
      return;
    }
    const sizes = /* @__PURE__ */ new Map();
    for (const c of everyone) {
      const q = sq(c.slot);
      if (q) sizes.set(q.id, (sizes.get(q.id) ?? 0) + 1);
    }
    const roles = ctfSquadRoles([...sizes].map(([id, size]) => ({ id, size })));
    for (const [id, r] of roles) this.squadRoleOf.set(id, r);
    for (const c of bots) {
      const q = sq(c.slot);
      const r = q ? roles.get(q.id) : void 0;
      this.roles.set(c.slot, r && (!q.human || !q.ordered) ? r : "attack");
    }
  }
  /**
   * Part 2's rule (before the follow-ups; BOT_OFF=squadDefend): a bot-led squad defends only when it fits in the team's
   * defenders (a squad of 3 when 3 are wanted) and another squad still attacks; every other squad attacks, its members
   * with it. Bots in a person's squad attack (they follow the person anyway). Measured (docs/FIRETEAMS_PLAN.md, Part 2).
   */
  fitSquadRoles(bots, n, unit) {
    const squads = /* @__PURE__ */ new Map();
    for (const c of bots) {
      const u = unit(c.slot);
      if (u === null || u === void 0) {
        this.roles.set(c.slot, "attack");
        continue;
      }
      let list2 = squads.get(u);
      if (!list2) squads.set(u, list2 = []);
      list2.push(c);
    }
    const order = [...squads.values()];
    const roles = fitRoles(order.map((l) => l.length), n);
    order.forEach((list2, i) => {
      for (const c of list2) this.roles.set(c.slot, roles[i]);
    });
  }
  /** Fireteams follow-ups: a squad's CTF role (null: none worked out, as with the variant off). */
  squadRole(id) {
    return this.squadRoleOf.get(id) ?? null;
  }
  /** A bot's role now (escort while it escorts a carrier). */
  role(c) {
    return this.escorts.has(c.slot) ? "escort" : this.roles.get(c.slot) ?? "attack";
  }
}
function ctfBotTookFlag(c) {
  c.bot?.onSpawn(c.yaw);
}
function ctfBotAwareness(c, flags) {
  return flags.some((f) => f.carrier === c.slot) ? CARRIER_AWARENESS : Infinity;
}
function ctfBotGoal(c, flags, plan) {
  const own = flags.find((f) => f.team === c.faction);
  const enemy = flags.find((f) => f.team !== c.faction);
  if (!own || !enemy) return null;
  const role = plan.roles.get(c.slot) ?? "attack";
  const near2 = (p) => horizontalDistance(c.move.pos, p) < RESPOND_RANGE;
  if (enemy.carrier === c.slot) {
    if (own.state !== FLAG_HOME && horizontalDistance(c.move.pos, own.base) < CARRIER_WAIT) return { pos: own.base, radius: CARRIER_WAIT - 2, push: true, watch: own.pos };
    return { pos: own.base, radius: 0.6, push: true, detour: 0, run: true };
  }
  if (own.state === FLAG_DROPPED && (role === "defend" || near2(own.pos))) return { pos: own.pos, radius: 0.5, push: true };
  if (own.state === FLAG_CARRIED) {
    const waiting = enemy.state === FLAG_CARRIED && horizontalDistance(enemy.pos, own.base) < 12;
    if (role === "defend" || near2(own.pos) || waiting && !plan.escorts.has(c.slot)) return { pos: own.pos, radius: 1.5, push: true };
  }
  const threat = own.state === FLAG_HOME ? plan.threat.get(own.team) : void 0;
  if (threat && role === "defend") return { pos: threat, radius: 2, push: true };
  if (role === "defend") return { pos: own.base, radius: DEFEND_RADIUS, watch: enemy.base };
  if (enemy.state === FLAG_CARRIED) return { pos: enemy.pos, radius: plan.escorts.has(c.slot) ? 4 : 10, push: true, watch: enemy.base };
  return { pos: enemy.pos, radius: 0.5, push: true };
}
function ctfRoleOf(c, flags, plan) {
  return flags.some((f) => f.carrier === c.slot) ? "carrier" : plan.role(c);
}
const FLAG_TOUCH_RADIUS = 1.3;
const FLAG_CAPTURE_RADIUS = 1.8;
const FLAG_CARRIER_SPEED = 0.85;
const TOUCH_HEIGHT = 2;
class CtfMode {
  constructor(host) {
    this.host = host;
    const teams = host.teams.slice(0, 2);
    this.flags = teams.map((t) => {
      const e = host.map.entities.find((x) => x.kind === "flag" && x.team === t.id);
      const at2 = e?.position ?? host.map.entities.find((x) => x.kind === "spawn" && x.faction === t.id)?.position ?? [0, 0, 0];
      const base = { x: at2[0], y: at2[1], z: at2[2] };
      return { team: t.id, base, pos: { ...base }, state: FLAG_HOME, carrier: null, returnAt: 0, savedJet: null };
    });
    this.reset();
  }
  host;
  flags;
  captures = /* @__PURE__ */ new Map();
  /** Roles, escorts and flags in trouble for the Player Bots (ctfBots.ts), refreshed in step(). */
  botPlan = new CtfBotPlan();
  get returnTicks() {
    return Math.round((this.host.rules.flagReturnSeconds ?? 30) * TICK_RATE);
  }
  flagOf(team) {
    return this.flags.find((f) => f.team === team);
  }
  /** The flag this player is carrying, if any. */
  carried(c) {
    return this.flags.find((f) => f.carrier === c.slot);
  }
  reset() {
    for (const f of this.flags) this.sendHome(f);
    this.captures.clear();
    for (const t of this.host.teams) this.captures.set(t.id, 0);
  }
  step() {
    const host = this.host;
    this.botPlan.update(host.tick, host.combatants(), this.flags);
    const byslot = new Map(host.combatants().map((c) => [c.slot, c]));
    for (const f of this.flags) {
      if (f.state === FLAG_CARRIED) {
        const c = f.carrier === null ? void 0 : byslot.get(f.carrier);
        if (!c || !c.alive) {
          this.drop(f, c?.move.pos ?? f.pos, c?.slot ?? null);
          continue;
        }
        f.pos = { ...c.move.pos };
        if (c.jetFuel !== null) {
          f.savedJet = Math.max(f.savedJet ?? 0, c.jetFuel);
          c.jetFuel = null;
        }
      } else if (f.state === FLAG_DROPPED && host.tick >= f.returnAt) {
        this.sendHome(f);
        this.event("return", f, null);
      }
    }
    for (const c of host.combatants()) {
      if (!c.alive || c.mount || !c.faction) continue;
      for (const f of this.flags) {
        if (f.state === FLAG_CARRIED || !touching(c.move.pos, f.pos, FLAG_TOUCH_RADIUS)) continue;
        if (f.team === c.faction) {
          if (f.state === FLAG_DROPPED) {
            this.sendHome(f);
            this.event("return", f, c.slot);
          }
        } else if (this.flagOf(c.faction) && !this.carried(c)) this.take(f, c);
      }
      const held = this.carried(c);
      const own = this.flagOf(c.faction);
      if (held && own && own.state === FLAG_HOME && touching(c.move.pos, own.base, FLAG_CAPTURE_RADIUS)) this.capture(held, c);
      if (host.rules.scoreLimit > 0 && (this.captures.get(c.faction) ?? 0) >= host.rules.scoreLimit) {
        host.endRound();
        return;
      }
    }
  }
  onKill(victim) {
    const f = this.carried(victim);
    if (f) this.drop(f, victim.move.pos, victim.slot);
  }
  onLeave(c) {
    this.onKill(c);
  }
  /** Host handoff: the team scores a checkpoint carried (as teamScores gives them). */
  restoreScores(scores) {
    for (const t of this.host.teams) this.captures.set(t.id, scores.get(t.id) ?? 0);
  }
  teamScores() {
    return new Map(this.host.teams.map((t) => [t.id, this.captures.get(t.id) ?? 0]));
  }
  snapshot() {
    const r2 = (v) => Math.round(v * 100) / 100;
    const teams = this.host.teams;
    return {
      ts: teams.map((t) => this.captures.get(t.id) ?? 0),
      fl: this.flags.map((f) => [
        teams.findIndex((t) => t.id === f.team),
        f.state,
        r2(f.pos.x),
        r2(f.pos.y),
        r2(f.pos.z),
        f.carrier ?? -1,
        f.state === FLAG_DROPPED ? Math.max(0, Math.ceil((f.returnAt - this.host.tick) / TICK_RATE)) : 0
      ])
    };
  }
  blocksVehicle(c) {
    return !!this.carried(c);
  }
  botAwareness(c) {
    return ctfBotAwareness(c, this.flags);
  }
  botGoal(c) {
    return ctfBotGoal(c, this.flags, this.botPlan);
  }
  /**
   * The team brain's brief: the attackers go for the enemy's flag, gathering first and going together while it's at
   * home (a group push; a flag lying out in the open they just run for), and nobody while a teammate carries it (they
   * escort); with our flag carried off, its carrier is the one to cut off on its way home.
   */
  botBrief(team) {
    const own = this.flagOf(team);
    const enemy = this.flags.find((f) => f.team !== team);
    if (!own || !enemy) return null;
    const attack = enemy.state === FLAG_CARRIED ? null : { pos: { ...enemy.pos }, stage: enemy.state === FLAG_HOME };
    const carrier = own.state === FLAG_CARRIED && own.carrier !== null ? own.carrier : null;
    return { attack, intercept: carrier !== null ? { pos: { ...own.pos }, to: { ...enemy.base }, slot: carrier } : null, playbook: playbookFor("core.ctf").team };
  }
  /** Fireteams (Part 2): bot-led squads take their CTF role together (CtfBotPlan.unitOf); the follow-ups: by squad size (`squadOf`). */
  botUnits(unitOf, squadOf) {
    this.botPlan.unitOf = unitOf;
    this.botPlan.squadOf = squadOf ?? null;
  }
  /** Fireteams follow-ups: a squad's CTF role (defend its flag or attack), for its default and the squad HUD. */
  squadRole(squad) {
    return this.botPlan.squadRole(squad);
  }
  /** Fireteams' "Defend the objective": our flag where it is (at its base, or lying where it fell; its base while carried off). */
  defendSpot(team) {
    const own = this.flagOf(team);
    if (!own) return null;
    return { ...own.state === FLAG_CARRIED ? own.base : own.pos };
  }
  /** Each team's way from its own flag to the enemy's (its attackers' trip, and the way an enemy carrier runs home with its flag). */
  botTrips() {
    const [a, b] = this.flags;
    if (!a || !b) return [];
    return [
      { team: a.team, from: { ...a.base }, to: { ...b.base }, kind: "attack" },
      { team: b.team, from: { ...b.base }, to: { ...a.base }, kind: "attack" }
    ];
  }
  // ---------------------------------------------------------------- flag moves
  take(f, c) {
    f.state = FLAG_CARRIED;
    f.carrier = c.slot;
    f.pos = { ...c.move.pos };
    f.savedJet = c.jetFuel;
    c.jetFuel = null;
    c.modeSpeed = FLAG_CARRIER_SPEED;
    if (c.bot) ctfBotTookFlag(c);
    this.event("take", f, c.slot);
  }
  /** Let go of the carrier: normal speed, jetpack back. */
  release(f) {
    const c = f.carrier === null ? void 0 : this.host.combatants().find((o) => o.slot === f.carrier);
    if (c) {
      c.modeSpeed = void 0;
      if (c.alive && f.savedJet !== null) c.jetFuel = f.savedJet;
    }
    f.carrier = null;
    f.savedJet = null;
  }
  drop(f, at2, by) {
    this.release(f);
    const floor = this.host.groundBelow({ x: at2.x, y: at2.y + 0.5, z: at2.z });
    if (floor === null || floor < this.host.killY + 1 || this.host.deadly?.({ x: at2.x, y: floor, z: at2.z })) {
      this.sendHome(f);
      this.event("return", f, null);
      return;
    }
    f.state = FLAG_DROPPED;
    f.pos = { x: at2.x, y: floor, z: at2.z };
    f.returnAt = this.host.tick + this.returnTicks;
    this.event("drop", f, by);
  }
  sendHome(f) {
    if (f.state === FLAG_CARRIED) this.release(f);
    f.state = FLAG_HOME;
    f.carrier = null;
    f.pos = { ...f.base };
    f.returnAt = 0;
  }
  capture(f, c) {
    this.sendHome(f);
    this.captures.set(c.faction, (this.captures.get(c.faction) ?? 0) + 1);
    this.event("capture", f, c.slot);
  }
  event(a, f, s) {
    this.host.emit({ e: "flag", a, team: f.team, s });
  }
}
const touching = (p, target, radius) => horizontalDistance(p, target) <= radius && Math.abs(p.y - target.y) < TOUCH_HEIGHT;
function teamHome(spawnPoints, team) {
  const own = spawnPoints.filter((s) => s.team === team && !s.generated);
  if (!own.length) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const s of own) {
    x += s.pos.x;
    y += s.pos.y;
    z += s.pos.z;
  }
  const mid = { x: x / own.length, y: y / own.length, z: z / own.length };
  let best = own[0];
  let bestD = Infinity;
  for (const s of own) {
    const d = (s.pos.x - mid.x) ** 2 + (s.pos.z - mid.z) ** 2 + (s.pos.y - mid.y) ** 2 * 4;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return { ...best.pos };
}
const ELIM_BREAK_SECONDS = 3;
const ELIM_ROUND_SECONDS = 120;
const HUNT_AFTER_SECONDS = 30;
class ElimMode {
  constructor(host) {
    this.host = host;
    this.reset();
  }
  host;
  round = 1;
  wins = /* @__PURE__ */ new Map();
  /** Tick the next round starts (between rounds), else null. */
  restartAt = null;
  roundStart = 0;
  reset() {
    this.round = 1;
    this.wins.clear();
    this.restartAt = null;
    this.roundStart = this.host.tick;
  }
  /** Living players per team, in team order. */
  alive() {
    const all = this.host.combatants();
    return this.host.teams.map((t) => all.filter((c) => c.faction === t.id && c.alive).length);
  }
  step() {
    const host = this.host;
    if (this.restartAt !== null) {
      if (host.tick >= this.restartAt) this.nextRound();
      return;
    }
    const all = host.combatants();
    const manned = host.teams.filter((t) => all.some((c) => c.faction === t.id));
    if (manned.length < 2) {
      for (const c of all) if (!c.alive && c.respawnTick === Infinity) c.respawnTick = host.tick + host.rules.respawnDelayTicks;
      this.roundStart = host.tick;
      return;
    }
    const alive = this.alive();
    const standing = host.teams.filter((_, i) => alive[i] > 0);
    const timeUp = host.tick - this.roundStart >= ELIM_ROUND_SECONDS * TICK_RATE;
    if (standing.length > 1 && !timeUp) return;
    let winner = standing.length === 1 ? standing[0].id : null;
    if (timeUp && standing.length > 1) {
      const best = Math.max(...alive);
      const top = host.teams.filter((_, i) => alive[i] === best);
      winner = top.length === 1 ? top[0].id : null;
    }
    if (winner) this.wins.set(winner, (this.wins.get(winner) ?? 0) + 1);
    host.emit({ e: "elim", a: "win", round: this.round, team: winner });
    if (winner && host.rules.scoreLimit > 0 && this.wins.get(winner) >= host.rules.scoreLimit) {
      host.endRound();
      return;
    }
    this.restartAt = host.tick + ELIM_BREAK_SECONDS * TICK_RATE;
  }
  nextRound() {
    this.round++;
    this.restartAt = null;
    this.roundStart = this.host.tick;
    for (const c of this.host.combatants()) this.host.respawn(c);
    this.host.emit({ e: "elim", a: "start", round: this.round, team: null });
  }
  /** The dead wait for the next round. */
  onKill(victim) {
    victim.respawnTick = Infinity;
  }
  onLeave() {
  }
  /** Host handoff: the team scores a checkpoint carried (as teamScores gives them). */
  restoreScores(scores) {
    for (const t of this.host.teams) this.wins.set(t.id, scores.get(t.id) ?? 0);
  }
  teamScores() {
    return new Map(this.host.teams.map((t) => [t.id, this.wins.get(t.id) ?? 0]));
  }
  snapshot() {
    const host = this.host;
    return {
      ts: host.teams.map((t) => this.wins.get(t.id) ?? 0),
      el: [this.round, this.restartAt === null ? 0 : Math.max(0, Math.ceil((this.restartAt - host.tick) / TICK_RATE)), ...this.alive()]
    };
  }
  botAwareness() {
    return Infinity;
  }
  blocksVehicle() {
    return false;
  }
  /** Each team's way from its spawn to the other's (two teams). */
  botTrips() {
    const [a, b] = this.host.teams;
    const ha = a ? teamHome(this.host.spawnPoints, a.id) : null;
    const hb = b ? teamHome(this.host.spawnPoints, b.id) : null;
    if (!a || !b || !ha || !hb) return [];
    return [
      { team: a.id, from: ha, to: hb, kind: "attack" },
      { team: b.id, from: hb, to: ha, kind: "attack" }
    ];
  }
  /** Roam as in Team Deathmatch at first; once a round drags on, hunt the nearest enemy left standing. */
  botGoal(c, hostiles) {
    if (this.host.tick - this.roundStart < HUNT_AFTER_SECONDS * TICK_RATE) return null;
    let best = null;
    for (const h of hostiles) if (h.kind !== "npc" && (!best || horizontalDistance(h.move.pos, c.move.pos) < horizontalDistance(best.move.pos, c.move.pos))) best = h;
    return best ? { pos: best.move.pos, radius: 2 } : null;
  }
}
const BOMB_PLANT_SECONDS = 3;
const BOMB_DEFUSE_SECONDS = 5;
const BOMB_FUSE_SECONDS = 40;
const BOMB_ROUND_SECONDS = 115;
const BOMB_BREAK_SECONDS = 4;
const PICKUP_RADIUS = 1.3;
const DEFUSE_RADIUS = 1.6;
const STEADY$1 = 0.6;
const BLAST$1 = { radius: 14, damage: 400 };
class BombMode {
  constructor(host) {
    this.host = host;
    this.reset();
  }
  host;
  round = 1;
  wins = /* @__PURE__ */ new Map();
  restartAt = null;
  roundStart = 0;
  state = BOMB_CARRIED;
  pos = { x: 0, y: 0, z: 0 };
  carrier = null;
  /** Planted: the site and the tick it blows. */
  site = -1;
  blowAt = 0;
  action = null;
  get attackers() {
    return this.host.teams[0].id;
  }
  get defenders() {
    return this.host.teams[1].id;
  }
  /** Bomb sites as [entity index, entity]. */
  sites() {
    return this.host.map.entities.flatMap((e, i) => e.kind === "bombsite" ? [[i, e]] : []);
  }
  siteAt(p) {
    for (const [i, e] of this.sites()) {
      if (hypot(p.x - e.position[0], p.z - e.position[2]) <= e.radius && Math.abs(p.y - e.position[1]) < 3) return i;
    }
    return -1;
  }
  reset() {
    this.round = 1;
    this.wins.clear();
    this.startRound();
  }
  startRound() {
    this.restartAt = null;
    this.roundStart = this.host.tick;
    this.state = BOMB_CARRIED;
    this.site = -1;
    this.action = null;
    this.carrier = null;
    this.handOut();
  }
  /** Give the bomb to an attacker (a human when there is one) if nobody has it. */
  handOut() {
    const attackers = this.host.combatants().filter((c) => c.faction === this.attackers && c.alive);
    const pick = attackers.find((c) => c.kind === "human") ?? attackers[0] ?? null;
    this.carrier = pick?.slot ?? null;
    if (pick) this.pos = { ...pick.move.pos };
  }
  alive() {
    const all = this.host.combatants();
    return this.host.teams.map((t) => all.filter((c) => c.faction === t.id && c.alive).length);
  }
  player(slot) {
    return slot === null ? void 0 : this.host.combatants().find((c) => c.slot === slot);
  }
  step() {
    const host = this.host;
    if (this.restartAt !== null) {
      if (host.tick >= this.restartAt) this.nextRound();
      return;
    }
    const all = host.combatants();
    if (host.teams.slice(0, 2).some((t) => !all.some((c) => c.faction === t.id))) {
      for (const c of all) if (!c.alive && c.respawnTick === Infinity) c.respawnTick = host.tick + host.rules.respawnDelayTicks;
      this.roundStart = host.tick;
      if (this.carrier === null && this.state === BOMB_CARRIED) this.handOut();
      return;
    }
    if (this.carrier === null && this.state === BOMB_CARRIED) this.handOut();
    this.moveBomb(all);
    this.runAction(all);
    if (this.state === BOMB_PLANTED && host.tick >= this.blowAt) {
      this.state = BOMB_EXPLODED;
      host.emit({ e: "bomb", a: "explode", s: null, p: [this.pos.x, this.pos.y, this.pos.z], i: this.site });
      host.explode({ x: this.pos.x, y: this.pos.y + 0.5, z: this.pos.z }, BLAST$1.radius, BLAST$1.damage, null);
      return this.winRound(this.attackers);
    }
    const [att, def] = this.alive();
    if (def === 0) return this.winRound(this.attackers);
    if (att === 0 && this.state !== BOMB_PLANTED) return this.winRound(this.defenders);
    if (this.state !== BOMB_PLANTED && host.tick - this.roundStart >= BOMB_ROUND_SECONDS * TICK_RATE) return this.winRound(this.defenders);
  }
  /** The bomb follows its carrier; a dropped one goes to the first attacker who walks over it. */
  moveBomb(all) {
    if (this.state === BOMB_CARRIED) {
      const c = this.player(this.carrier);
      if (c?.alive) this.pos = { ...c.move.pos };
      else this.drop(c ?? null);
      return;
    }
    if (this.state !== BOMB_DROPPED) return;
    for (const c of all) {
      if (!c.alive || c.faction !== this.attackers) continue;
      if (horizontalDistance(c.move.pos, this.pos) <= PICKUP_RADIUS && Math.abs(c.move.pos.y - this.pos.y) < 1.5) {
        this.state = BOMB_CARRIED;
        this.carrier = c.slot;
        this.host.emit({ e: "bomb", a: "pickup", s: c.slot });
        return;
      }
    }
  }
  drop(c) {
    this.state = BOMB_DROPPED;
    this.carrier = null;
    const ground = this.host.groundBelow({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z });
    if (ground !== null) this.pos = { ...this.pos, y: ground };
    if (this.action) this.action = null;
    this.host.emit({ e: "bomb", a: "drop", s: c?.slot ?? null, p: [this.pos.x, this.pos.y, this.pos.z] });
  }
  /** Planting and defusing: start with Use (bots: just by being there), then hold still. */
  runAction(all) {
    const tick = this.host.tick;
    const a = this.action;
    if (a) {
      const c = this.player(a.slot);
      const ok = c?.alive && horizontalDistance(c.move.pos, a.from) <= STEADY$1 && (this.state === BOMB_PLANTED ? c.faction === this.defenders : this.carrier === c.slot);
      if (!ok) {
        this.action = null;
        return;
      }
      const need = (this.state === BOMB_PLANTED ? BOMB_DEFUSE_SECONDS : BOMB_PLANT_SECONDS) * TICK_RATE;
      if (tick - a.start < need) return;
      this.action = null;
      if (this.state === BOMB_PLANTED) {
        this.state = BOMB_DEFUSED;
        this.host.emit({ e: "bomb", a: "defuse", s: c.slot, i: this.site });
        return this.winRound(this.defenders);
      }
      this.state = BOMB_PLANTED;
      this.site = a.site;
      this.carrier = null;
      const ground = this.host.groundBelow({ x: c.move.pos.x, y: c.move.pos.y + 1, z: c.move.pos.z });
      this.pos = { ...c.move.pos, y: ground ?? c.move.pos.y };
      this.blowAt = tick + BOMB_FUSE_SECONDS * TICK_RATE;
      this.host.emit({ e: "bomb", a: "plant", s: c.slot, i: a.site, p: [this.pos.x, this.pos.y, this.pos.z] });
      return;
    }
    const starts = (c) => c.useTick === tick || c.kind !== "human" && (c.move.vx ?? 0) === 0;
    if (this.state === BOMB_CARRIED) {
      const c = this.player(this.carrier);
      if (!c) return;
      const site = this.siteAt(c.move.pos);
      if (site >= 0 && starts(c)) this.action = { slot: c.slot, start: tick, from: { ...c.move.pos }, site };
    } else if (this.state === BOMB_PLANTED) {
      for (const c of all) {
        if (!c.alive || c.faction !== this.defenders) continue;
        if (horizontalDistance(c.move.pos, this.pos) <= DEFUSE_RADIUS && Math.abs(c.move.pos.y - this.pos.y) < 1.5 && starts(c)) {
          this.action = { slot: c.slot, start: tick, from: { ...c.move.pos }, site: this.site };
          return;
        }
      }
    }
  }
  winRound(team) {
    const host = this.host;
    this.wins.set(team, (this.wins.get(team) ?? 0) + 1);
    host.emit({ e: "elim", a: "win", round: this.round, team });
    if (host.rules.scoreLimit > 0 && this.wins.get(team) >= host.rules.scoreLimit) return host.endRound();
    this.restartAt = host.tick + BOMB_BREAK_SECONDS * TICK_RATE;
  }
  nextRound() {
    this.round++;
    for (const c of this.host.combatants()) this.host.respawn(c);
    this.startRound();
    this.host.emit({ e: "elim", a: "start", round: this.round, team: null });
  }
  /** The dead wait for the next round; a carrier's death drops the bomb (next tick). */
  onKill(victim) {
    victim.respawnTick = Infinity;
  }
  onLeave(c) {
    if (this.carrier === c.slot) this.drop(c);
  }
  /** Host handoff: the team scores a checkpoint carried (as teamScores gives them). */
  restoreScores(scores) {
    for (const t of this.host.teams) this.wins.set(t.id, scores.get(t.id) ?? 0);
  }
  teamScores() {
    return new Map(this.host.teams.map((t) => [t.id, this.wins.get(t.id) ?? 0]));
  }
  snapshot() {
    const host = this.host;
    const a = this.action;
    const need = this.state === BOMB_PLANTED ? BOMB_DEFUSE_SECONDS : BOMB_PLANT_SECONDS;
    const r2 = (v) => Math.round(v * 100) / 100;
    return {
      ts: host.teams.map((t) => this.wins.get(t.id) ?? 0),
      el: [this.round, this.restartAt === null ? 0 : Math.max(0, Math.ceil((this.restartAt - host.tick) / TICK_RATE)), ...this.alive()],
      bm: [
        this.state,
        r2(this.pos.x),
        r2(this.pos.y),
        r2(this.pos.z),
        this.carrier ?? -1,
        this.state === BOMB_PLANTED ? Math.max(0, Math.ceil((this.blowAt - host.tick) / TICK_RATE)) : 0,
        a ? Math.min(100, Math.round((host.tick - a.start) / (need * TICK_RATE) * 100)) : -1,
        a?.slot ?? -1,
        this.site
      ]
    };
  }
  botAwareness() {
    return Infinity;
  }
  blocksVehicle(c) {
    return this.carrier === c.slot;
  }
  /** Each side's way from its spawn to every site (the attackers to plant, the defenders to hold it). */
  botTrips() {
    const out = [];
    for (const team of [this.attackers, this.defenders]) {
      const home = teamHome(this.host.spawnPoints, team);
      if (!home) continue;
      for (const [, e] of this.sites()) out.push({ team, from: home, to: { x: e.position[0], y: e.position[1], z: e.position[2] }, kind: team === this.attackers ? "attack" : "defend" });
    }
    return out;
  }
  /**
   * Attackers: the carrier heads for a site (one per round), the rest go with
   * it or fetch a dropped bomb; after the plant they guard it. Defenders split
   * between the sites, and rush the bomb once it's down.
   */
  botGoal(c) {
    const sites = this.sites();
    if (!sites.length) return null;
    const target = sites[this.round % sites.length][1];
    const targetPos = { x: target.position[0], y: target.position[1], z: target.position[2] };
    if (c.faction === this.attackers) {
      if (this.state === BOMB_PLANTED) return { pos: this.pos, radius: 6 };
      if (this.state === BOMB_DROPPED) return { pos: this.pos, radius: 0.8 };
      if (this.carrier === c.slot) return { pos: targetPos, radius: Math.max(1, target.radius * 0.4) };
      return { pos: targetPos, radius: target.radius + 4 };
    }
    if (this.state === BOMB_PLANTED) return { pos: this.pos, radius: 1 };
    const guard = sites[c.slot % sites.length][1];
    return { pos: { x: guard.position[0], y: guard.position[1], z: guard.position[2] }, radius: guard.radius + 2 };
  }
}
const HOSTAGE_ROUND_SECONDS = 150;
const HOSTAGE_BREAK_SECONDS = 4;
const TAKE_RADIUS = 2;
const FOLLOW_GAP = 1.8;
const WALK_SPEED = 5;
const RUN_SPEED = 8;
const LOSE_RADIUS = 25;
class HostageMode {
  constructor(host) {
    this.host = host;
    this.reset();
  }
  host;
  round = 1;
  wins = /* @__PURE__ */ new Map();
  restartAt = null;
  roundStart = 0;
  hostages = [];
  get rescuers() {
    return this.host.teams[0].id;
  }
  get guards() {
    return this.host.teams[1].id;
  }
  zones() {
    return this.host.map.entities.filter((e) => e.kind === "rescue");
  }
  reset() {
    this.round = 1;
    this.wins.clear();
    this.startRound();
  }
  startRound() {
    this.restartAt = null;
    this.roundStart = this.host.tick;
    this.hostages = this.host.map.entities.flatMap((e) => {
      if (e.kind !== "hostage") return [];
      const home = { x: e.position[0], y: e.position[1], z: e.position[2] };
      return [{ home, homeYaw: e.yaw, pos: { ...home }, yaw: e.yaw, state: HOSTAGE_WAITING, leader: null, route: [], routeAt: 0 }];
    });
  }
  alive() {
    const all = this.host.combatants();
    return this.host.teams.map((t) => all.filter((c) => c.faction === t.id && c.alive).length);
  }
  /** Rescues needed to win: half of them, at least one. */
  get needed() {
    return Math.max(1, Math.ceil(this.hostages.length / 2));
  }
  step() {
    const host = this.host;
    if (this.restartAt !== null) {
      if (host.tick >= this.restartAt) this.nextRound();
      return;
    }
    const all = host.combatants();
    if (host.teams.slice(0, 2).some((t) => !all.some((c) => c.faction === t.id))) {
      for (const c of all) if (!c.alive && c.respawnTick === Infinity) c.respawnTick = host.tick + host.rules.respawnDelayTicks;
      this.roundStart = host.tick;
      return;
    }
    this.takeAlong(all);
    for (const [i, h] of this.hostages.entries()) if (h.state === HOSTAGE_FOLLOWING) this.follow(h, i);
    const rescued = this.hostages.filter((h) => h.state === HOSTAGE_RESCUED).length;
    if (rescued >= this.needed) return this.winRound(this.rescuers);
    const [res, grd] = this.alive();
    if (grd === 0) return this.winRound(this.rescuers);
    if (res === 0) return this.winRound(this.guards);
    if (host.tick - this.roundStart >= HOSTAGE_ROUND_SECONDS * TICK_RATE) this.winRound(this.guards);
  }
  /** Rescuers start a waiting hostage following them: Use beside it (bots: just walking up). */
  takeAlong(all) {
    for (const c of all) {
      if (!c.alive || c.faction !== this.rescuers) continue;
      const pressed = c.useTick === this.host.tick || c.kind !== "human";
      if (!pressed) continue;
      for (const [i, h] of this.hostages.entries()) {
        if (h.state !== HOSTAGE_WAITING || horizontalDistance(c.move.pos, h.pos) > TAKE_RADIUS || Math.abs(c.move.pos.y - h.pos.y) > 1.5) continue;
        h.state = HOSTAGE_FOLLOWING;
        h.leader = c.slot;
        h.routeAt = 0;
        this.host.emit({ e: "hostage", a: "follow", i, s: c.slot });
        if (c.kind === "human") break;
      }
    }
  }
  follow(h, i) {
    const host = this.host;
    const leader = h.leader === null ? void 0 : host.combatants().find((c) => c.slot === h.leader);
    if (!leader?.alive || horizontalDistance(leader.move.pos, h.pos) > LOSE_RADIUS) {
      h.state = HOSTAGE_WAITING;
      h.leader = null;
      host.emit({ e: "hostage", a: "stop", i, s: null });
      return;
    }
    for (const z of this.zones()) {
      if (hypot(h.pos.x - z.position[0], h.pos.z - z.position[2]) <= z.radius && Math.abs(h.pos.y - z.position[1]) < 3) {
        h.state = HOSTAGE_RESCUED;
        h.leader = null;
        host.emit({ e: "hostage", a: "rescue", i, s: leader.slot });
        return;
      }
    }
    if (horizontalDistance(leader.move.pos, h.pos) <= FOLLOW_GAP) return;
    if (host.tick >= h.routeAt) {
      h.route = host.path(h.pos, leader.move.pos)?.slice(1) ?? [{ ...leader.move.pos }];
      h.routeAt = host.tick + Math.round(TICK_RATE * 0.5);
    }
    let step = (horizontalDistance(leader.move.pos, h.pos) > 5 ? RUN_SPEED : WALK_SPEED) * TICK_DT;
    while (step > 0 && h.route.length) {
      const next = h.route[0];
      const d = horizontalDistance(h.pos, next);
      if (d <= step) {
        h.pos = { ...next };
        h.route.shift();
        step -= d;
        continue;
      }
      const k = step / d;
      h.yaw = Math.atan2(next.x - h.pos.x, next.z - h.pos.z);
      h.pos = { x: h.pos.x + (next.x - h.pos.x) * k, y: h.pos.y + (next.y - h.pos.y) * k, z: h.pos.z + (next.z - h.pos.z) * k };
      step = 0;
    }
    const ground = host.groundBelow({ x: h.pos.x, y: h.pos.y + 1, z: h.pos.z });
    if (ground !== null) h.pos = { ...h.pos, y: ground };
  }
  winRound(team) {
    const host = this.host;
    this.wins.set(team, (this.wins.get(team) ?? 0) + 1);
    host.emit({ e: "elim", a: "win", round: this.round, team });
    if (host.rules.scoreLimit > 0 && this.wins.get(team) >= host.rules.scoreLimit) return host.endRound();
    this.restartAt = host.tick + HOSTAGE_BREAK_SECONDS * TICK_RATE;
  }
  nextRound() {
    this.round++;
    for (const c of this.host.combatants()) this.host.respawn(c);
    this.startRound();
    this.host.emit({ e: "elim", a: "start", round: this.round, team: null });
  }
  onKill(victim) {
    victim.respawnTick = Infinity;
  }
  onLeave() {
  }
  /** Host handoff: the team scores a checkpoint carried (as teamScores gives them). */
  restoreScores(scores) {
    for (const t of this.host.teams) this.wins.set(t.id, scores.get(t.id) ?? 0);
  }
  teamScores() {
    return new Map(this.host.teams.map((t) => [t.id, this.wins.get(t.id) ?? 0]));
  }
  snapshot() {
    const host = this.host;
    const r2 = (v) => Math.round(v * 100) / 100;
    return {
      ts: host.teams.map((t) => this.wins.get(t.id) ?? 0),
      el: [this.round, this.restartAt === null ? 0 : Math.max(0, Math.ceil((this.restartAt - host.tick) / TICK_RATE)), ...this.alive()],
      hg: this.hostages.map((h) => [r2(h.pos.x), r2(h.pos.y), r2(h.pos.z), r2(h.yaw), h.state, h.leader ?? -1])
    };
  }
  botAwareness() {
    return Infinity;
  }
  blocksVehicle(c) {
    return this.hostages.some((h) => h.leader === c.slot);
  }
  /**
   * The rescuers' way from their spawn to every hostage and from each hostage to the nearest rescue zone, and the
   * guards' way to the hostages.
   */
  botTrips() {
    const out = [];
    const zones = this.zones().map((e) => ({ x: e.position[0], y: e.position[1], z: e.position[2] }));
    for (const team of [this.rescuers, this.guards]) {
      const home = teamHome(this.host.spawnPoints, team);
      if (!home) continue;
      for (const h of this.hostages) out.push({ team, from: home, to: { ...h.home }, kind: team === this.rescuers ? "attack" : "defend" });
    }
    for (const h of this.hostages) {
      let best = null;
      for (const z of zones) if (!best || horizontalDistance(z, h.home) < horizontalDistance(best, h.home)) best = z;
      if (best) out.push({ team: this.rescuers, from: { ...h.home }, to: best, kind: "carry" });
    }
    return out;
  }
  /**
   * Rescuers: lead your hostages to the nearest rescue zone; otherwise go and
   * fetch the nearest waiting one. Guards hold near the hostages, and chase
   * whoever is leading one away.
   */
  botGoal(c) {
    const zones = this.zones();
    const waiting = this.hostages.filter((h2) => h2.state === HOSTAGE_WAITING);
    const nearest = (list2) => list2.reduce((b, h2) => !b || horizontalDistance(h2.pos, c.move.pos) < horizontalDistance(b.pos, c.move.pos) ? h2 : b, null);
    if (c.faction === this.rescuers) {
      if (this.hostages.some((h3) => h3.leader === c.slot) && zones.length) {
        const z = nearest(zones.map((e) => ({ pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, r: e.radius })));
        return { pos: z.pos, radius: Math.max(1, z.r * 0.5) };
      }
      const h2 = nearest(waiting);
      return h2 ? { pos: h2.pos, radius: 1.2 } : null;
    }
    const led = nearest(this.hostages.filter((h2) => h2.state === HOSTAGE_FOLLOWING));
    if (led) return { pos: led.pos, radius: 3 };
    const h = waiting[c.slot % Math.max(1, waiting.length)];
    return h ? { pos: h.pos, radius: 6 } : null;
  }
}
const PLAYBOOK = playbookFor("core.breakthrough");
const ROLES = PLAYBOOK.breakthrough;
const POST_REACH = 60;
const CREST_RISE = 2.5;
const CREST_APART = 6;
const CREST_SPOTS = 6;
const FOCUS_GUARD = 15;
const FOCUS_SECONDS = 20;
const FOCUS_NEAR = 60;
const groupHome = (spots) => teamHome(spots.map((s) => ({ pos: s.pos, team: "" })), "");
const BT_PLANT_SECONDS = 3;
const BT_DEFUSE_SECONDS = 5;
const BT_FUSE_SECONDS = 20;
const BT_FALLBACK_SECONDS = 10;
const BT_FALLBACK_DPS = 20;
const BT_ZONE_SECONDS = 20;
const BT_FINAL_SECONDS = 40;
const BT_BREAK_SECONDS = 8;
const BT_DEFENDER_RESPAWN = 1.5;
const ZONE_CROWD = 3;
const ZONE_BELOW = 1;
const ZONE_ABOVE = 3.5;
const TARGET_HEIGHT = 2;
const STEADY = 0.6;
const BLAST = { radius: 9, damage: 260 };
const GROUP_SHARE = 3;
function inObjective(o, p) {
  if (horizontalDistance(o.pos, p) > o.radius) return false;
  return o.kind === "target" ? Math.abs(p.y - o.pos.y) < TARGET_HEIGHT : p.y > o.pos.y - ZONE_BELOW && p.y < o.pos.y + ZONE_ABOVE;
}
class BreakthroughMode {
  constructor(host) {
    this.host = host;
    const map = host.map;
    const spawnEntities = map.entities.filter((e) => e.kind === "spawn");
    this.sectors = breakthroughSectors(map).map((s) => ({
      index: s.index,
      order: s.order,
      name: s.name,
      pos: s.pos,
      dir: s.dir,
      need: 0,
      seconds: s.seconds ?? host.rules.breakthroughSectorSeconds ?? BREAKTHROUGH_SECTOR_SECONDS,
      objectives: [],
      spawns: { attack: [], defend: [] },
      posts: { guns: [], trenches: [], crest: [] }
    }));
    const byOrder = /* @__PURE__ */ new Map();
    for (const s of this.sectors) if (!byOrder.has(s.order)) byOrder.set(s.order, s);
    this.objectives = [];
    map.entities.forEach((e, index) => {
      if (e.kind !== "objective") return;
      const sector = byOrder.get(e.sector);
      if (!sector) return;
      const o = {
        index,
        kind: e.objective,
        sector: this.sectors.indexOf(sector),
        label: e.label,
        pos: { x: e.position[0], y: e.position[1], z: e.position[2] },
        radius: e.radius,
        seconds: e.seconds ?? (e.objective === "final" ? BT_FINAL_SECONDS : BT_ZONE_SECONDS),
        state: BT_OBJ_WAITING,
        progress: 0,
        presence: BT_IN_NOBODY,
        blowAt: 0,
        planter: null,
        action: null
      };
      this.objectives.push(o);
      sector.objectives.push(o);
    });
    const needs = new Map(breakthroughSectors(map).map((s) => [s.index, s.need]));
    for (const s of this.sectors) {
      const targets = s.objectives.filter((o) => o.kind === "target").length;
      s.need = Math.min(targets, needs.get(s.index) ?? targets);
    }
    spawnEntities.forEach((e, i) => {
      if (e.kind !== "spawn" || e.sector === void 0 || !e.side) return;
      const sector = byOrder.get(e.sector);
      const spot2 = host.spawnPoints[i];
      if (sector && spot2) sector.spawns[e.side].push(spot2);
    });
    this.findPosts();
    this.reset();
  }
  host;
  sectors;
  objectives;
  round = 1;
  /** The sector in play (0-based); the sector count once the last has fallen. */
  active = 0;
  /** Reinforcements left. */
  pool = 0;
  /** The tick the clock runs out. */
  clockEnd = 0;
  /** How the round stands (BT_ROUND_*), and when the next one starts (between rounds). */
  outcome = BT_ROUND_PLAYING;
  restartAt = null;
  /** Each team's attack: sectors taken, and the seconds left on the clock when it took its last. */
  results = /* @__PURE__ */ new Map();
  /** Defenders behind the line: since when (tick). */
  behind = /* @__PURE__ */ new Map();
  /** Spots added round a spawn group too small for its team (per sector and side). */
  extraSpots = /* @__PURE__ */ new Map();
  warnedQuarter = false;
  /**
   * Bots: each sector's posts its defenders can use (postsOf); this tick's plan (plan): each attacker's place among its
   * side's bots, each defender's duty with its place among those on it (`j`) and among those answering the attack
   * (`a`), and whether the defenders fall back early; the attackers' objective and since when (attackFocus).
   */
  usable = /* @__PURE__ */ new Map();
  placeOf = /* @__PURE__ */ new Map();
  duty = /* @__PURE__ */ new Map();
  planTick = -1;
  /** The sector the plan was made for: a sector that falls mid-tick plans again (a gun duty kept into a sector with no guns read past an empty list). */
  planSector = -1;
  fallingBack = false;
  focus = null;
  focusAt = 0;
  /** Attacking bots spawned as they were added, before they had a brain: armed with smoke at their first input. */
  unarmed = /* @__PURE__ */ new Set();
  /**
   * Each sector's posts for its defenders (BtSectorRt.posts): what stands within POST_REACH of its objectives on the
   * defenders' side of its line (its own ground, or a later sector's overlooking it), the best first, the same order
   * every time.
   */
  findPosts() {
    const map = this.host.map;
    const { cellSize, levelHeight } = map.classicStructure;
    const ground = map.terrain;
    for (const s of this.sectors) {
      if (!s.objectives.length) continue;
      const near2 = (p) => s.objectives.reduce((d, o) => Math.min(d, horizontalDistance(o.pos, p)), Infinity);
      const ours = (p) => !behindLine(s, p) && near2(p) <= POST_REACH;
      const base = s.objectives.reduce((y, o) => Math.min(y, o.pos.y), Infinity);
      const { guns, trenches, crest } = s.posts;
      for (const e of map.entities) {
        if (e.kind !== "mount" && e.kind !== "prop") continue;
        const p = { x: e.position[0], y: e.position[1], z: e.position[2] };
        if (!ours(p)) continue;
        if (e.kind === "mount" && getMountDef(e.model)?.kind === "turret") guns.push(p);
        else if (e.kind === "prop" && /sandbag/.test(e.model)) trenches.push({ x: p.x + s.dir.x * 1.2, y: p.y, z: p.z + s.dir.z * 1.2 });
      }
      const high = [];
      const add2 = (p) => high.push({ p, score: Math.min(15, p.y - base) - near2(p) * 0.1 });
      for (const t of map.classicStructure.tiles) {
        const p = { x: t.x * cellSize, y: t.z * levelHeight, z: t.y * cellSize };
        if (!ours(p)) continue;
        if (/trench/.test(t.tile)) trenches.push({ ...p, y: p.y - 1.5 });
        else if (p.y >= base + CREST_RISE) add2(p);
      }
      if (ground) {
        const seen = /* @__PURE__ */ new Set();
        for (const o of s.objectives) {
          for (let dx = -POST_REACH; dx <= POST_REACH; dx += 8) {
            for (let dz = -POST_REACH; dz <= POST_REACH; dz += 8) {
              const x = Math.round((o.pos.x + dx) / 8) * 8;
              const z = Math.round((o.pos.z + dz) / 8) * 8;
              const key2 = `${x},${z}`;
              if (seen.has(key2)) continue;
              seen.add(key2);
              const h = terrainHeightAt(ground, x, z);
              if (h !== null && h >= base + CREST_RISE && ours({ x, z })) add2({ x, y: h, z });
            }
          }
        }
      }
      high.sort((a, b) => b.score - a.score || a.p.x - b.p.x || a.p.z - b.p.z || a.p.y - b.p.y);
      for (const h of high) {
        if (crest.length >= CREST_SPOTS * 4) break;
        if (crest.every((q) => horizontalDistance(q, h.p) >= CREST_APART || Math.abs(q.y - h.p.y) > 3)) crest.push(h.p);
      }
      const spread2 = (ps) => {
        const by = s.objectives.map((o) => ({ o, ps: [] }));
        for (const p of ps) by.reduce((a, b) => horizontalDistance(b.o.pos, p) < horizontalDistance(a.o.pos, p) ? b : a).ps.push(p);
        for (const g of by) g.ps.sort((a, b) => horizontalDistance(a, g.o.pos) - horizontalDistance(b, g.o.pos) || a.x - b.x || a.z - b.z);
        const out = [];
        for (let i = 0; out.length < ps.length; i++) for (const g of by) if (g.ps[i]) out.push(g.ps[i]);
        return out;
      };
      s.posts.guns = spread2(guns);
      s.posts.trenches = spread2(trenches);
    }
  }
  /**
   * A sector's posts its defenders can use, worked out the first time they are asked for: those they can walk to from
   * their spawn group (on the navmesh), and of the crest's, up to CREST_SPOTS that see one of its objectives.
   */
  postsOf(s) {
    let posts = this.usable.get(s.index);
    if (posts) return posts;
    const home = groupHome(s.spawns.defend) ?? s.objectives[0]?.pos ?? null;
    const walk = (p) => !!home && this.host.path(home, p) !== null;
    const eye = (p) => ({ x: p.x, y: p.y + 1.5, z: p.z });
    const sees = (p) => s.objectives.some((o) => this.host.physics.lineOfSight(eye(p), { x: o.pos.x, y: o.pos.y + 1, z: o.pos.z }));
    const crest = [];
    for (const p of s.posts.crest) if (crest.length < CREST_SPOTS && walk(p) && sees(p)) crest.push(p);
    posts = { guns: s.posts.guns.filter(walk), trenches: s.posts.trenches.filter(walk), crest };
    this.usable.set(s.index, posts);
    return posts;
  }
  /**
   * This tick's plan for the bots (worked out once a tick). Each side's Player Bots go by their place in slot order (`k`
   * of `n`: not by slot, which alternates between the teams). The defenders: whether they fall back early (the sector
   * more than half taken, or half of them down), and each one's duty by the playbook's shares of its place (k + 0.5) / n:
   * the first quarter on the sector's guns, then 40 % in its trenches (the first 30 % of the side falling back early to
   * the next line when it's time), 15 % on its crest, the rest on its objectives; a share whose posts the sector lacks
   * holds the objectives. `j` is its place among those on its duty, `a` among those answering the attack (trenches and
   * objectives; -1 for the others).
   */
  plan() {
    if (this.planTick === this.host.tick && this.planSector === this.active) return;
    this.planTick = this.host.tick;
    this.planSector = this.active;
    this.placeOf.clear();
    this.duty.clear();
    const all = this.host.combatants();
    const bots = (team) => all.filter((x) => x.faction === team && x.kind === "bot").sort((a, b) => a.slot - b.slot);
    for (const team of [this.attackers, this.defenders]) {
      const side2 = bots(team);
      side2.forEach((x, k) => this.placeOf.set(x.slot, { k, n: side2.length }));
    }
    const side = all.filter((x) => x.faction === this.defenders);
    const down = side.filter((x) => !x.alive).length;
    this.fallingBack = side.length > 1 && (down * 2 >= side.length || this.sectorProgress() > ROLES.fallBackAt);
    const sector = this.sector;
    if (!sector) return;
    const posts = this.postsOf(sector);
    const back = !!this.sectors[this.active + 1]?.objectives.length && this.fallingBack;
    const guns = ROLES.guns;
    const trenches = guns + ROLES.trenches;
    const crest = trenches + ROLES.crestSnipers;
    const on = { gun: 0, crest: 0, back: 0, trench: 0, hold: 0 };
    let answering = 0;
    const defenders = bots(this.defenders);
    const n = defenders.length;
    defenders.forEach((x, k) => {
      const share = (k + 0.5) / n;
      const duty = share < guns && posts.guns.length ? "gun" : back && n >= 3 && share >= guns && share < guns + ROLES.fallBack ? "back" : share >= trenches && share < crest && posts.crest.length ? "crest" : share >= guns && share < trenches && posts.trenches.length ? "trench" : "hold";
      this.duty.set(x.slot, { duty, j: on[duty]++, a: duty === "trench" || duty === "hold" ? answering++ : -1 });
    });
  }
  /** How far the attackers have got with the sector in play, 0..1: its zones' capture, or its targets toward the need. */
  sectorProgress() {
    const s = this.sector;
    if (!s) return 0;
    const zones = s.objectives.filter((o) => o.kind !== "target");
    const zoneShare = zones.length ? zones.reduce((a, o) => a + (o.state === BT_OBJ_DONE ? 1 : o.progress), 0) / zones.length : 0;
    const gone = s.objectives.filter((o) => o.kind === "target" && o.state === BT_OBJ_DONE).length;
    return Math.max(zoneShare, s.need > 0 ? gone / s.need : 0);
  }
  /** Where the attackers come from in a sector (for its defenders to watch): its attackers' spawn group, else short of its line. */
  attackFrom(s) {
    return groupHome(s.spawns.attack) ?? { x: s.pos.x - s.dir.x * 20, y: s.pos.y, z: s.pos.z - s.dir.z * 20 };
  }
  /**
   * The attackers' objective in the sector in play: of those still to take, the least defended (the fewest defenders
   * alive within FOCUS_GUARD of it, then the map's order), kept until it is taken or planted and looked at again every
   * FOCUS_SECONDS while no attacker is on it (it changes only for one with fewer defenders, two fewer beyond FOCUS_NEAR);
   * else a burning charge.
   */
  attackFocus() {
    const s = this.sector;
    if (!s) return null;
    const live = s.objectives.filter((o) => o.state === BT_OBJ_ACTIVE);
    if (!live.length) return s.objectives.find((o) => o.state === BT_OBJ_PLANTED) ?? null;
    const tick = this.host.tick;
    const f = this.focus && live.includes(this.focus) ? this.focus : null;
    if (f && tick - this.focusAt < FOCUS_SECONDS * TICK_RATE) return f;
    const all = this.host.combatants();
    if (f && all.some((c) => c.alive && c.faction === this.attackers && horizontalDistance(c.move.pos, f.pos) < f.radius + 3)) return f;
    const guards = (o) => all.filter((c) => c.alive && c.faction === this.defenders && horizontalDistance(c.move.pos, o.pos) < FOCUS_GUARD).length;
    let best = live[0];
    let fewest = guards(best);
    for (const o of live) {
      const g = guards(o);
      if (g < fewest) {
        best = o;
        fewest = g;
      }
    }
    if (f && guards(f) - fewest < (horizontalDistance(f.pos, best.pos) > FOCUS_NEAR ? 2 : 1)) best = f;
    this.focus = best;
    this.focusAt = tick;
    return best;
  }
  /** Whether the defenders hold an objective: a zone they alone stand in, or a target with one of them within reach and 6 m. */
  held(o) {
    if (o.kind !== "target") return o.presence === BT_IN_DEFENDERS;
    return this.host.combatants().some((c) => c.alive && c.faction === this.defenders && horizontalDistance(c.move.pos, o.pos) < o.radius + 6);
  }
  get attackIndex() {
    return (this.round - 1) % 2;
  }
  /** The attacking team's ID this round. */
  get attackers() {
    return this.host.teams[this.attackIndex].id;
  }
  get defenders() {
    return this.host.teams[1 - this.attackIndex].id;
  }
  /** Rounds in the match: two with the sides swapped, else one. */
  get rounds() {
    return this.host.rules.breakthroughSwap ? 2 : 1;
  }
  /** The side a player plays this round (null: not on either team). */
  sideOf(c) {
    return c.faction === this.attackers ? "attack" : c.faction === this.defenders ? "defend" : null;
  }
  /** The sector in play (null once the last has fallen). */
  get sector() {
    return this.sectors[this.active] ?? null;
  }
  get perAttacker() {
    return Math.max(1, Math.round(this.host.rules.breakthroughPool ?? BREAKTHROUGH_POOL));
  }
  /** The attacking team's size: as the rules set it, or as many as are on it. */
  attackerCount() {
    const sized = this.host.rules.teamSizes?.[this.attackIndex] ?? 0;
    return Math.max(1, sized, this.host.combatants().filter((c) => c.faction === this.attackers).length);
  }
  /** Seconds left on the clock. */
  get timeLeft() {
    return Math.max(0, Math.ceil((this.clockEnd - this.host.tick) / TICK_RATE));
  }
  reset() {
    this.round = 1;
    this.results.clear();
    this.startRound();
  }
  startRound() {
    this.restartAt = null;
    this.outcome = BT_ROUND_PLAYING;
    this.active = 0;
    this.behind.clear();
    this.warnedQuarter = false;
    this.focus = null;
    for (const o of this.objectives) {
      o.state = o.sector === 0 ? BT_OBJ_ACTIVE : BT_OBJ_WAITING;
      o.progress = 0;
      o.presence = BT_IN_NOBODY;
      o.blowAt = 0;
      o.planter = null;
      o.action = null;
    }
    this.pool = this.perAttacker * this.attackerCount();
    this.clockEnd = this.host.tick + (this.sectors[0]?.seconds ?? BREAKTHROUGH_SECTOR_SECONDS) * TICK_RATE;
    if (!this.results.has(this.attackers)) this.results.set(this.attackers, { sectors: 0, timeLeft: 0 });
  }
  player(slot) {
    return slot === null ? void 0 : this.host.combatants().find((c) => c.slot === slot);
  }
  step() {
    const host = this.host;
    if (this.restartAt !== null) {
      if (host.tick >= this.restartAt) this.nextRound();
      return;
    }
    if (this.outcome !== BT_ROUND_PLAYING) return;
    const all = host.combatants();
    if (!all.some((c) => c.faction === this.attackers) || !all.some((c) => c.faction === this.defenders)) {
      this.clockEnd++;
      this.pool = Math.max(this.pool, this.perAttacker * this.attackerCount());
      for (const c of all) if (!c.alive && c.respawnTick === Infinity) c.respawnTick = host.tick + host.rules.respawnDelayTicks;
      return;
    }
    const sector = this.sector;
    if (!sector) return;
    for (const o of sector.objectives) {
      if (o.state === BT_OBJ_DONE || o.state === BT_OBJ_SKIPPED) continue;
      if (o.kind === "target") this.runTarget(o, all);
      else this.runZone(o, all);
      if (this.outcome !== BT_ROUND_PLAYING || this.sector !== sector) return;
    }
    if (this.sectorTaken(sector)) return this.sectorFalls();
    this.fallBack(all);
    const burning = sector.objectives.some((o) => o.state === BT_OBJ_PLANTED);
    if (host.tick >= this.clockEnd && !burning) return this.endAttack(false);
    if (this.pool <= 0 && !all.some((c) => c.faction === this.attackers && (c.alive || c.respawnTick < Infinity))) this.endAttack(false);
  }
  /** A zone: attackers alone capture it, a defender in it holds it, defenders alone push it back. */
  runZone(o, all) {
    let att = 0;
    let def = 0;
    const inside = [];
    for (const c of all) {
      if (!c.alive || !inObjective(o, c.move.pos)) continue;
      if (c.faction === this.attackers) {
        att++;
        inside.push(c);
      } else if (c.faction === this.defenders) def++;
    }
    o.presence = att && def ? BT_IN_BOTH : att ? BT_IN_ATTACKERS : def ? BT_IN_DEFENDERS : BT_IN_NOBODY;
    const step = 1 / (o.seconds * TICK_RATE);
    if (att && !def) o.progress = Math.min(1, o.progress + step * (1 + 0.5 * (Math.min(att, ZONE_CROWD) - 1)));
    else if (def && !att) o.progress = Math.max(0, o.progress - step);
    if (o.progress < 1) return;
    o.state = BT_OBJ_DONE;
    o.presence = BT_IN_NOBODY;
    for (const c of inside) c.objective++;
    this.host.emit({ e: "bt", a: "capture", i: o.index, team: this.attackers });
  }
  /** A target: plant (attackers), defuse (defenders), and the charge going off. */
  runTarget(o, all) {
    const host = this.host;
    const tick = host.tick;
    const planted = o.state === BT_OBJ_PLANTED;
    if (planted && tick >= o.blowAt) {
      o.state = BT_OBJ_DONE;
      o.action = null;
      host.explode({ x: o.pos.x, y: o.pos.y + 0.6, z: o.pos.z }, BLAST.radius, BLAST.damage, this.player(o.planter) ?? null);
      host.emit({ e: "bt", a: "destroy", i: o.index, s: o.planter, team: this.attackers, p: [o.pos.x, o.pos.y, o.pos.z] });
      return;
    }
    const side = planted ? this.defenders : this.attackers;
    const a = o.action;
    if (a) {
      const c = this.player(a.slot);
      if (!c?.alive || c.faction !== side || horizontalDistance(c.move.pos, a.from) > STEADY || !inObjective(o, c.move.pos)) {
        o.action = null;
        return;
      }
      if (tick - a.start < (planted ? BT_DEFUSE_SECONDS : BT_PLANT_SECONDS) * TICK_RATE) return;
      o.action = null;
      if (planted) {
        o.state = BT_OBJ_ACTIVE;
        o.planter = null;
        host.emit({ e: "bt", a: "defuse", i: o.index, s: c.slot, team: this.attackers });
      } else {
        o.state = BT_OBJ_PLANTED;
        o.planter = c.slot;
        o.blowAt = tick + BT_FUSE_SECONDS * TICK_RATE;
        host.emit({ e: "bt", a: "plant", i: o.index, s: c.slot, team: this.attackers });
      }
      return;
    }
    for (const c of all) {
      if (!c.alive || c.faction !== side || !inObjective(o, c.move.pos)) continue;
      if (c.useTick === tick || c.kind !== "human" && (c.move.vx ?? 0) === 0 && (c.move.vz ?? 0) === 0) {
        o.action = { slot: c.slot, start: tick, from: { ...c.move.pos } };
        return;
      }
    }
  }
  sectorTaken(s) {
    let destroyed = 0;
    for (const o of s.objectives) {
      if (o.kind === "target") {
        if (o.state === BT_OBJ_DONE) destroyed++;
      } else if (o.state !== BT_OBJ_DONE) return false;
    }
    return destroyed >= s.need && s.objectives.length > 0;
  }
  /** The sector in play has fallen: spawns move up, the next one's objectives and time come into play (or the attackers have won). */
  sectorFalls() {
    const host = this.host;
    const fallen = this.sector;
    for (const o of fallen.objectives) {
      if (o.state === BT_OBJ_DONE) continue;
      o.state = BT_OBJ_SKIPPED;
      o.action = null;
      o.planter = null;
    }
    const res = this.results.get(this.attackers);
    res.sectors = this.active + 1;
    res.timeLeft = this.timeLeft;
    host.emit({ e: "bt", a: "sector", n: this.active, team: this.attackers });
    this.active++;
    this.behind.clear();
    const next = this.sector;
    if (!next) return this.endAttack(true);
    this.pool += Math.ceil(this.perAttacker / 2) * this.attackerCount();
    this.warnedQuarter = false;
    this.clockEnd = Math.max(this.clockEnd, host.tick) + next.seconds * TICK_RATE;
    for (const o of next.objectives) o.state = BT_OBJ_ACTIVE;
  }
  /** Defenders on the attackers' side of the line once a sector has fallen: a warning, then it hurts. */
  fallBack(all) {
    const line = this.active > 0 ? this.sector : null;
    for (const c of all) {
      if (c.faction !== this.defenders || !c.alive || !line || !behindLine(line, c.move.pos)) {
        this.behind.delete(c.slot);
        continue;
      }
      const since = this.behind.get(c.slot);
      if (since === void 0) this.behind.set(c.slot, this.host.tick);
      else if (this.host.tick - since >= BT_FALLBACK_SECONDS * TICK_RATE) this.host.hurt?.(c, BT_FALLBACK_DPS / TICK_RATE, "core.fallback");
    }
  }
  /** The round is over: the attackers took the last sector (`won`) or the defenders held. */
  endAttack(won) {
    const host = this.host;
    this.outcome = won ? BT_ROUND_ATTACKERS : BT_ROUND_DEFENDERS;
    this.behind.clear();
    for (const o of this.objectives) o.action = null;
    host.emit({ e: "bt", a: "round", n: this.round, team: won ? this.attackers : this.defenders });
    if (this.round < this.rounds) {
      this.restartAt = host.tick + BT_BREAK_SECONDS * TICK_RATE;
      return;
    }
    host.endRound(this.winner(won));
  }
  /** Who won the match: one round, its winner; two, more sectors taken, then more time left when the last was taken. */
  winner(lastWon) {
    if (this.rounds === 1) return lastWon ? this.attackers : this.defenders;
    const [a, b] = this.host.teams.slice(0, 2).map((t) => this.results.get(t.id) ?? { sectors: 0, timeLeft: 0 });
    if (a.sectors !== b.sectors) return a.sectors > b.sectors ? this.host.teams[0].id : this.host.teams[1].id;
    if (a.sectors > 0 && a.timeLeft !== b.timeLeft) return a.timeLeft > b.timeLeft ? this.host.teams[0].id : this.host.teams[1].id;
    return null;
  }
  nextRound() {
    this.round++;
    this.startRound();
    for (const c of this.host.combatants()) this.host.respawn(c);
    this.host.emit({ e: "bt", a: "start", n: this.round, team: this.attackers });
  }
  onKill(victim) {
    this.behind.delete(victim.slot);
    const host = this.host;
    if (victim.faction === this.defenders) {
      victim.respawnTick = host.tick + Math.round(host.rules.respawnDelayTicks * BT_DEFENDER_RESPAWN);
      return;
    }
    if (victim.faction !== this.attackers || this.outcome !== BT_ROUND_PLAYING || this.restartAt !== null) return;
    if (this.pool <= 0) {
      victim.respawnTick = Infinity;
      return;
    }
    this.pool--;
    const start = this.perAttacker * this.attackerCount();
    if (this.pool === 0) host.emit({ e: "bt", a: "pool", n: 0, team: this.attackers });
    else if (!this.warnedQuarter && this.pool <= Math.floor(start / 4)) {
      this.warnedQuarter = true;
      host.emit({ e: "bt", a: "pool", n: this.pool, team: this.attackers });
    }
  }
  onLeave(c) {
    this.behind.delete(c.slot);
    this.unarmed.delete(c.slot);
    for (const o of this.objectives) if (o.action?.slot === c.slot) o.action = null;
  }
  /**
   * The playbook's smoke (BreakthroughRoles.smoke): an attacking bot that moves up cover to cover (every style but
   * Arena's and the berserkers', who rush and never bound) carries smoke grenades instead of its frags, so bounding up
   * the beach the moving half screens the open ground it crosses (BotBrain.considerSmoke; docs/BOTS.md, "Smoke"). The
   * rushers keep their frags.
   */
  onSpawn(c) {
    this.behind.delete(c.slot);
    if (c.kind === "bot" && !c.bot) this.unarmed.add(c.slot);
    else this.armSmoke(c);
  }
  armSmoke(c) {
    const profile = c.bot?.profile;
    if (!ROLES.smoke || c.kind !== "bot" || !profile || c.throwable?.kind !== "frag" || this.sideOf(c) !== "attack") return;
    if (hasTag(profile, "ARENA") || hasTag(profile, "BERSERKER")) return;
    c.throwable = { kind: "smoke", count: Math.min(THROWABLE_DEFS.smoke.max, c.throwable.count) };
  }
  /** Host handoff: the team scores a checkpoint carried (sectors taken). */
  restoreScores(scores) {
    for (const t of this.host.teams) {
      const n = scores.get(t.id);
      if (n !== void 0) this.results.set(t.id, { sectors: n, timeLeft: this.results.get(t.id)?.timeLeft ?? 0 });
    }
  }
  /** Each team's score: the sectors it took attacking. */
  teamScores() {
    return new Map(this.host.teams.map((t) => [t.id, this.results.get(t.id)?.sectors ?? 0]));
  }
  /** The time the HUD shows: the sector clock (the break's while sides swap). */
  clock() {
    if (this.restartAt !== null) return Math.max(0, Math.ceil((this.restartAt - this.host.tick) / TICK_RATE));
    return this.outcome === BT_ROUND_PLAYING ? this.timeLeft : 0;
  }
  snapshot() {
    const host = this.host;
    const tick = host.tick;
    return {
      ts: host.teams.map((t) => this.results.get(t.id)?.sectors ?? 0),
      bt: [
        this.round,
        this.rounds,
        this.attackIndex,
        this.active,
        Math.max(0, this.pool),
        this.outcome === BT_ROUND_PLAYING ? this.timeLeft : 0,
        this.restartAt === null ? 0 : Math.max(0, Math.ceil((this.restartAt - tick) / TICK_RATE)),
        this.outcome
      ],
      bo: this.objectives.map((o) => {
        const a = o.action;
        const need = (o.state === BT_OBJ_PLANTED ? BT_DEFUSE_SECONDS : BT_PLANT_SECONDS) * TICK_RATE;
        if (o.kind !== "target") return [o.index, o.state, Math.floor(o.progress * 100), o.presence, -1];
        return [o.index, o.state, a ? Math.min(100, Math.round((tick - a.start) / need * 100)) : -1, o.state === BT_OBJ_PLANTED ? Math.max(0, Math.ceil((o.blowAt - tick) / TICK_RATE)) : 0, a?.slot ?? -1];
      }),
      ...this.behind.size ? { bf: [...this.behind].map(([slot, since]) => [slot, Math.max(0, Math.ceil((since + BT_FALLBACK_SECONDS * TICK_RATE - tick) / TICK_RATE))]) } : {}
    };
  }
  botAwareness() {
    return Infinity;
  }
  blocksVehicle() {
    return false;
  }
  /** Where a side spawns now: its group for the sector in play, else the nearest sector's group for that side (further back for defenders, further forward for attackers first). */
  spawnSpots(c) {
    const side = this.sideOf(c);
    if (!side || !this.sectors.length) return null;
    const k = Math.min(this.active, this.sectors.length - 1);
    const n = this.sectors.length;
    const order = [k];
    for (let d = 1; d < n; d++) {
      const fwd = k + d;
      const back = k - d;
      for (const s of side === "defend" ? [fwd, back] : [back, fwd]) if (s >= 0 && s < n) order.push(s);
    }
    for (const s of order) {
      const spots = this.groupSpots(s, side);
      if (spots.length) return spots;
    }
    return null;
  }
  /** A spawn group's spots, with spots round its own when it holds too few for its team (each checked for room and ground). */
  groupSpots(s, side) {
    const own = this.sectors[s].spawns[side];
    if (!own.length) return own;
    const team = side === "attack" ? this.attackIndex : 1 - this.attackIndex;
    const players = Math.max(this.host.rules.teamSizes?.[team] ?? 0, this.host.combatants().filter((c) => c.faction === this.host.teams[team]?.id).length);
    if (own.length * GROUP_SHARE >= players) return own;
    const key2 = `${s}:${side}`;
    let extra = this.extraSpots.get(key2);
    if (!extra) {
      extra = [];
      const want = Math.ceil(players / GROUP_SHARE) - own.length;
      const physics = this.host.physics;
      for (const sp of own) {
        for (let k = 0; k < 8 && extra.length < want; k++) {
          const a = sp.yaw + k * Math.PI / 4;
          const p = { x: sp.pos.x + Math.sin(a) * 2.5, y: sp.pos.y + 0.6, z: sp.pos.z + Math.cos(a) * 2.5 };
          const ground = this.host.groundBelow(p);
          if (ground === null || Math.abs(ground - sp.pos.y) > 0.7) continue;
          const at2 = { x: p.x, y: ground, z: p.z };
          if (!physics.headroom({ x: at2.x, y: at2.y + 0.05, z: at2.z }, 1.8)) continue;
          if (!physics.lineOfSight({ x: sp.pos.x, y: sp.pos.y + 1, z: sp.pos.z }, { x: at2.x, y: at2.y + 1, z: at2.z })) continue;
          if (this.host.deadly?.(at2)) continue;
          extra.push({ pos: at2, yaw: sp.yaw, team: sp.team });
        }
      }
      this.extraSpots.set(key2, extra);
    }
    return extra.length ? [...own, ...extra] : own;
  }
  /** Squad spawns: not beside a defender left behind the line. */
  spawnBeside(c, mate) {
    if (this.sideOf(c) !== "defend") return true;
    const line = this.active > 0 ? this.sector : null;
    return !line || !behindLine(line, mate.move.pos);
  }
  /**
   * Fireteams' "Defend the objective": the sector in play's objective nearest `near` still standing (or a planted one),
   * for either side (the attackers' squad holds it while it's taken, the defenders' while they hold it).
   */
  defendSpot(_team, near2) {
    const s = this.sector;
    if (!s) return null;
    const live = s.objectives.filter((o) => o.state === BT_OBJ_ACTIVE || o.state === BT_OBJ_PLANTED);
    let best = null;
    for (const o of live) if (!best || horizontalDistance(o.pos, near2) < horizontalDistance(best, near2)) best = o.pos;
    return best ? { ...best } : null;
  }
  /** The team brain's brief (bots/teamBrain.ts): the attackers' objective, a group push while the defenders hold it; the playbook. */
  botBrief(team) {
    if (this.outcome !== BT_ROUND_PLAYING || this.restartAt !== null) return null;
    if (team !== this.attackers) return { attack: null, intercept: null, playbook: PLAYBOOK.team };
    const o = this.attackFocus();
    return { attack: o ? { pos: { ...o.pos }, stage: this.held(o) } : null, intercept: null, playbook: PLAYBOOK.team };
  }
  /**
   * The trips the bots make again and again (their corridors are worked out once, at setup): each sector's attackers'
   * spawn group to each of its objectives, and its defenders' group to each (both teams each way when the sides swap).
   */
  botTrips() {
    const teams = this.host.teams;
    if (teams.length < 2) return [];
    const both = [teams[0].id, teams[1].id];
    const attack = this.rounds > 1 ? both : [teams[0].id];
    const defend = this.rounds > 1 ? both : [teams[1].id];
    const out = [];
    for (const s of this.sectors) {
      this.postsOf(s);
      const from = { attack: groupHome(s.spawns.attack), defend: groupHome(s.spawns.defend) };
      for (const o of s.objectives) {
        if (from.attack) for (const team of attack) out.push({ team, from: from.attack, to: { ...o.pos }, kind: "attack" });
        if (from.defend) for (const team of defend) out.push({ team, from: from.defend, to: { ...o.pos }, kind: "defend" });
      }
    }
    return out;
  }
  /**
   * A bot within reach of a target to plant (an attacker, at one still standing in the sector in play) or to defuse (a
   * defender, at a burning charge) holds still, crouched, still shooting, until it is done, as a player would: bots
   * plant and defuse by holding still within reach, and kept to their way (OrderGoal.push) they fight on the move, so
   * one shot at on the target never planted (none in 8 v 8 matches on the Breakthrough Range).
   */
  botInput(c, input) {
    if (this.unarmed.size && this.unarmed.delete(c.slot)) this.armSmoke(c);
    const sector = this.sector;
    if (!sector || !c.alive || c.mount || this.outcome !== BT_ROUND_PLAYING || this.restartAt !== null) return;
    const side = this.sideOf(c);
    if (!side) return;
    for (const o of sector.objectives) {
      if (o.kind !== "target" || o.state !== (side === "attack" ? BT_OBJ_ACTIVE : BT_OBJ_PLANTED)) continue;
      if (o.action && o.action.slot !== c.slot || !inObjective(o, c.move.pos)) continue;
      input.forward = 0;
      input.right = 0;
      input.buttons = input.buttons & -642 | BUTTON_CROUCH;
      return;
    }
  }
  /**
   * Breakthrough's bots, by its playbook (docs/BOTS.md, "Breakthrough's playbook"), each by its place and duty in this
   * tick's plan (`plan`). Attackers: one in three guards a burning charge, the rest go for the side's objective (the
   * brief's: the least defended still to take), which the team brain spreads over the sector's ways in groups that
   * bound cover to cover and gather for a push on a held objective; they stand in a zone to capture it, or still at a
   * target to plant. Defenders: one caught behind the line as it fell runs for it; the guns' and the crest's hold their
   * posts (manning the sector's guns, sniping from high ground that sees its objectives); those falling back early go
   * to the next line's trenches, else its objectives; the rest answer the attack (all but one in three rush a burning
   * charge to defuse it, two in three crowd a zone being taken), else hold their trench or sandbags, or the objectives,
   * spread over them. All watch the way the attackers come. Between rounds: roam.
   */
  botGoal(c) {
    const sector = this.sector;
    if (!sector || this.outcome !== BT_ROUND_PLAYING || this.restartAt !== null) return null;
    const side = this.sideOf(c);
    const open = sector.objectives.filter((o2) => o2.state === BT_OBJ_ACTIVE || o2.state === BT_OBJ_PLANTED);
    if (!side || !open.length) return null;
    this.plan();
    const planted = open.filter((o2) => o2.state === BT_OBJ_PLANTED);
    const guard = (o2) => ({ pos: o2.pos, radius: Math.max(3, o2.radius + 3) });
    const reach2 = (o2) => ({ pos: o2.pos, radius: Math.max(0.6, Math.min(1.2, o2.radius * 0.4)), push: true });
    if (side === "attack") {
      const { k } = this.placeOf.get(c.slot) ?? { k: 0 };
      const destroyed = sector.objectives.filter((o3) => o3.kind === "target" && o3.state === BT_OBJ_DONE).length;
      const enough = sector.need > 0 && destroyed + planted.length >= sector.need && sector.objectives.every((o3) => o3.kind === "target" || o3.state === BT_OBJ_DONE);
      if (planted.length && (enough || k % 3 === 0)) return guard(planted[(enough ? k : Math.floor(k / 3)) % planted.length]);
      const o2 = this.attackFocus() ?? open[k % open.length];
      if (o2.state === BT_OBJ_PLANTED) return guard(o2);
      if (o2.kind === "target") return reach2(o2);
      return { pos: o2.pos, radius: Math.max(1, o2.radius * 0.6 - k % 3 * 0.5), push: true };
    }
    if (this.behind.has(c.slot)) {
      const home = groupHome(sector.spawns.defend);
      let to = null;
      for (const p of [...open.map((o2) => o2.pos), ...home ? [home] : []]) if (!to || horizontalDistance(p, c.move.pos) < horizontalDistance(to, c.move.pos)) to = p;
      if (to) return { pos: to, radius: 3, run: true };
    }
    const { duty, j, a } = this.duty.get(c.slot) ?? { duty: "hold", j: 0, a: 0 };
    const watch = this.attackFrom(sector);
    const posts = this.postsOf(sector);
    const post = (at2, radius) => ({ pos: at2[j % at2.length], radius, watch });
    const next = duty === "back" ? this.sectors[this.active + 1] : void 0;
    if (next) {
      const there = this.postsOf(next).trenches;
      if (there.length) return post(there, 1.5);
      const o2 = next.objectives[j % next.objectives.length];
      return { pos: o2.pos, radius: Math.max(2, o2.radius * 0.8), watch };
    }
    if (duty === "gun") return post(posts.guns, 2.5);
    if (duty === "crest") return post(posts.crest, 1.5);
    if (planted.length && a % 3 !== 2) return reach2(planted.reduce((x, y) => horizontalDistance(x.pos, c.move.pos) <= horizontalDistance(y.pos, c.move.pos) ? x : y));
    const taking = open.filter((o2) => o2.kind !== "target" && (o2.presence === BT_IN_ATTACKERS || o2.presence === BT_IN_BOTH));
    if (taking.length && a % 3 !== 2) {
      const o2 = taking[a % taking.length];
      return { pos: o2.pos, radius: Math.max(1, o2.radius * 0.5), push: true };
    }
    if (duty === "trench") return post(posts.trenches, 1.5);
    const o = open[j % open.length];
    return { pos: o.pos, radius: o.kind === "target" ? Math.max(3, o.radius + 3) : Math.max(1.5, o.radius * 0.8), watch };
  }
}
const TEMPLATE = [
  ["wall", 6, -2, 0],
  ["wall", 6, 2, 0],
  ["wall", 6, -4, 0],
  ["wall", 6, 4, 0],
  ["metal_wall", 3.5, -3, 0],
  ["sandbags", 8.5, -4, 0],
  ["sandbags", 8.5, 4, 0],
  ["wall", 4.75, -5.25, 1],
  ["wall", 4.75, 5.25, 1],
  // Tower: two layers of four blocks, stairs up the side.
  ["block", -4, 4, 0],
  ["block", -4, 5, 0],
  ["block", -5, 4, 0],
  ["block", -5, 5, 0],
  ["stairs", -4, 2.5, 1],
  ["block", -4, 4, 0],
  ["block", -4, 5, 0],
  ["block", -5, 4, 0],
  ["block", -5, 5, 0],
  ["crate", 1.5, -4.5, 0]
];
const TEMPLATE_BIG = [
  // Second tower on the left flank.
  ["block", -4, -4, 0],
  ["block", -4, -5, 0],
  ["block", -5, -4, 0],
  ["block", -5, -5, 0],
  ["stairs", -4, -2.5, 3],
  ["block", -4, -4, 0],
  ["block", -4, -5, 0],
  ["block", -5, -4, 0],
  ["block", -5, -5, 0],
  // Outer wall line with a gap in the middle.
  ["wall", 11, -7, 0],
  ["wall", 11, -5, 0],
  ["wall", 11, -3, 0],
  ["wall", 11, 3, 0],
  ["wall", 11, 5, 0],
  ["wall", 11, 7, 0],
  ["wall", 9.75, -8.25, 1],
  ["wall", 9.75, 8.25, 1],
  // Metal facing behind the outer wall's gap, and on the inner front.
  ["metal_wall", 9, -1, 0],
  ["metal_wall", 9, 1, 0],
  ["metal_wall", 3.5, 3, 0],
  // Firing steps up behind the front wall.
  ["ramp", 4.5, -2, 2],
  ["ramp", 4.5, 2, 2],
  // Side walls for the back of the fort.
  ["wall", 0, -6, 1],
  ["wall", -2, -6, 1],
  ["wall", 0, 6, 1],
  ["wall", -2, 6, 1],
  // Cover inside.
  ["sandbags", 2, 0, 0],
  ["sandbags", 7.5, -6, 1],
  ["sandbags", 7.5, 6, 1],
  ["crate", 1.5, 4.5, 0],
  ["crate", -1.5, -2.5, 0]
];
const BIG_FORT_BUDGET = 250;
const REACH_TIMEOUT = 15 * TICK_RATE;
const PLACE_EVERY = Math.round(0.6 * TICK_RATE);
const BLAST_LOOKAHEAD = 6;
class FortBots {
  constructor(mode, host) {
    this.mode = mode;
    this.host = host;
  }
  mode;
  host;
  plans = [[], []];
  nextPlace = /* @__PURE__ */ new Map();
  blasting = /* @__PURE__ */ new Map();
  /** Where each bot was a second ago, and whether it has barely moved since (stuck against something). */
  lastPos = /* @__PURE__ */ new Map();
  /** Lay out each team's template afresh (a new build phase: pieces still standing are simply skipped). */
  reset() {
    this.nextPlace.clear();
    this.blasting.clear();
    this.lastPos.clear();
    for (const team of [0, 1]) this.plans[team] = this.layout(team);
  }
  layout(team) {
    const home = this.mode.bases[team];
    const away = this.mode.bases[1 - team];
    const ex = away.x - home.x;
    const ez = away.z - home.z;
    const facing = Math.abs(ex) >= Math.abs(ez) ? ex >= 0 ? 1 : 3 : ez >= 0 ? 0 : 2;
    const turn = (x, z, r) => r === 0 ? [x, z] : r === 1 ? [z, -x] : r === 2 ? [-x, -z] : [-z, x];
    const [fx, fz] = turn(0, 1, facing);
    const [rx, rz] = turn(1, 0, facing);
    const items = this.mode.budget >= BIG_FORT_BUDGET ? [...TEMPLATE, ...TEMPLATE_BIG] : TEMPLATE;
    return items.map(([kind, f, r, q]) => {
      const rot = (facing + q) % 4;
      const at2 = snapFortBase(kind, rot, { x: home.x + fx * f + rx * r, y: home.y, z: home.z + fz * f + rz * r });
      const dx = home.x - at2.x;
      const dz = home.z - at2.z;
      const d = hypot(dx, dz) || 1;
      const stand = { x: at2.x + dx / d * 2.4, y: home.y, z: at2.z + dz / d * 2.4 };
      return { kind, rot, at: at2, stand, state: "todo", tries: 0, claimedBy: null, claimedAt: 0 };
    });
  }
  /** The plan this bot is working on, claiming the next free one if it has none. */
  claim(c, team) {
    const plans = this.plans[team];
    const mine = plans.find((p) => p.state === "todo" && p.claimedBy === c.slot);
    if (mine) return mine;
    const alive = new Set(this.host.combatants().filter((o) => o.alive).map((o) => o.slot));
    const free = plans.find((p) => p.state === "todo" && (p.claimedBy === null || !alive.has(p.claimedBy)));
    if (free) {
      free.claimedBy = c.slot;
      free.claimedAt = this.host.tick;
    }
    return free;
  }
  goal(c) {
    const team = this.mode.teamIndex(c.faction);
    if (team < 0) return null;
    const plan = this.claim(c, team);
    if (plan) return { pos: plan.stand, radius: 0.8 };
    return { pos: this.mode.bases[team], radius: 6 };
  }
  /** Build phase, every tick: bots at their spot place their piece. */
  build() {
    const tick = this.host.tick;
    for (const c of this.host.combatants()) {
      if (!c.bot || !c.alive) continue;
      const team = this.mode.teamIndex(c.faction);
      if (team < 0) continue;
      const plan = this.plans[team].find((p) => p.state === "todo" && p.claimedBy === c.slot);
      if (!plan) continue;
      if (tick - plan.claimedAt > REACH_TIMEOUT) {
        plan.state = "skip";
        continue;
      }
      if (horizontalDistance(c.move.pos, plan.stand) > 1.8 || tick < (this.nextPlace.get(c.slot) ?? 0)) continue;
      this.nextPlace.set(c.slot, tick + PLACE_EVERY);
      const down = this.host.physics.raycastHit({ x: plan.at.x, y: plan.at.y + 3.5, z: plan.at.z }, { x: 0, y: -1, z: 0 }, 8);
      if (!down) {
        plan.state = "skip";
        continue;
      }
      const base = { x: plan.at.x, y: Math.round((plan.at.y + 3.5 - down.dist) * 100) / 100, z: plan.at.z };
      const placed = this.mode.place(team, plan.kind, plan.rot, base, c.slot);
      if (typeof placed !== "string") plan.state = "done";
      else if (placed === "Not enough build points" || placed === "Your team has built all it can" || ++plan.tries >= 4) plan.state = "skip";
    }
  }
  /**
   * Combat: a bot whose way toward its goal is shut by an enemy piece within a
   * few metres, and which isn't fighting anyone (or has been stuck against
   * the piece for a second), turns on it and shoots until it breaks,
   * preferring an explosive weapon if it has one.
   */
  blast(c, input) {
    const bot = c.bot;
    const tick = this.host.tick;
    let last = this.lastPos.get(c.slot);
    if (!last || tick - last.tick >= TICK_RATE) {
      const stuck = !!last && c.alive && horizontalDistance(last.pos, c.move.pos) < 0.5;
      this.lastPos.set(c.slot, last = { pos: { ...c.move.pos }, tick, stuck });
    }
    if (!bot || !c.alive || c.mount || bot.target !== null && !last.stuck && !this.blasting.has(c.slot)) {
      this.blasting.delete(c.slot);
      return;
    }
    const team = this.mode.teamIndex(c.faction);
    if (team < 0) return;
    if (last.stuck && !this.blasting.has(c.slot) && this.mode.pieces.some((p) => p.team === team && boxDistance(fortBounds(p.boxes), c.move.pos) < 1.2)) {
      input.right = Math.floor(tick / (2 * TICK_RATE) + c.slot) % 2 ? 1 : -1;
      return;
    }
    const chest2 = { x: c.move.pos.x, y: c.move.pos.y + PLAYER.height * 0.55, z: c.move.pos.z };
    let job = this.blasting.get(c.slot);
    let piece = job ? this.mode.pieces.find((p) => p.id === job.piece) : void 0;
    if (!piece || job && tick > job.until) {
      this.blasting.delete(c.slot);
      job = void 0;
      piece = void 0;
      if ((tick + c.slot) % 8 !== 0) return;
      const goal = this.mode.ctf.botGoal(c);
      if (!goal) return;
      const dx = goal.pos.x - chest2.x;
      const dz = goal.pos.z - chest2.z;
      const d = hypot(dx, dz);
      if (d < 1) return;
      const k = Math.min(1, BLAST_LOOKAHEAD / d);
      const ahead = { x: chest2.x + dx * k, y: chest2.y, z: chest2.z + dz * k };
      piece = this.nearestBlocking(chest2, ahead, team);
      if (!piece) return;
      job = { piece: piece.id, until: tick + 4 * TICK_RATE };
      this.blasting.set(c.slot, job);
    }
    const b = fortBounds(piece.boxes);
    const aim = { x: Math.max(b.min.x, Math.min(b.max.x, chest2.x)), y: Math.min(b.max.y - 0.1, Math.max(b.min.y + 0.3, chest2.y)), z: Math.max(b.min.z, Math.min(b.max.z, chest2.z)) };
    const centre = { x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2 };
    const look = lookAngles({ x: chest2.x, y: c.move.pos.y + 1.6, z: chest2.z }, { x: (aim.x + centre.x) / 2, y: aim.y, z: (aim.z + centre.z) / 2 });
    input.yaw = look.yaw;
    input.pitch = look.pitch;
    input.forward = 0;
    input.right = 0;
    const gun = this.bestWeapon(c);
    if (gun && gun !== c.current) input.weapon = gun;
    input.buttons = tick % 2 === 0 ? input.buttons | BUTTON_FIRE : input.buttons & ~BUTTON_FIRE;
  }
  nearestBlocking(from, to, team) {
    let best;
    let bestD = Infinity;
    for (const p of this.mode.pieces) {
      if (p.team === team) continue;
      if (!p.boxes.some((box) => segmentHitsAabb(from, to, box, PLAYER.radius))) continue;
      const b = fortBounds(p.boxes);
      const d = hypot((b.min.x + b.max.x) / 2 - from.x, (b.min.z + b.max.z) / 2 - from.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
  /** An explosive launcher with rounds if it has one, else the hardest-hitting loaded gun, else what it holds. */
  bestWeapon(c) {
    let best = null;
    let score = -Infinity;
    for (const [code, w] of c.weapons) {
      if (w.def.magazine > 0 && w.mag + w.reserve === 0) continue;
      if (w.def.heal || w.def.grapple || w.def.damage <= 0 && !w.def.projectile) continue;
      const blast = w.def.projectile?.splashDamage ?? 0;
      const s = blast * 3 + w.def.damage * Math.max(1, w.def.pellets) * (TICK_RATE / Math.max(1, w.def.fireIntervalTicks));
      if (s > score) {
        score = s;
        best = code;
      }
    }
    return best ?? (weaponCode(c.weapons.get(c.current)?.def ?? { id: "" }) || null);
  }
}
function boxDistance(b, p) {
  return hypot(Math.max(b.min.x - p.x, 0, p.x - b.max.x), Math.max(b.min.z - p.z, 0, p.z - b.max.z));
}
class FortsMode {
  constructor(host) {
    this.host = host;
    this.ctf = new CtfMode(host);
    this.bases = fortFlagBases(host.map, host.teams) ?? [{ ...this.ctf.flags[0].base }, { ...this.ctf.flags[1].base }];
    this.midfield = fortMidfield(this.bases[0], this.bases[1]);
    this.bots = new FortBots(this, host);
    this.reset();
  }
  host;
  ctf;
  phase = FORT_BUILD;
  cycle = 1;
  phaseEnd = 0;
  pieces = [];
  bases;
  midfield;
  bots;
  byHandle = /* @__PURE__ */ new Map();
  barrier = null;
  /** The bots' navmesh was rebuilt with the forts in at the start of combat (small maps only). */
  navRebuilt = false;
  nextId = 1;
  version = 0;
  sentVersion = -1;
  snapshots = 0;
  healthDirty = false;
  healthSent = 0;
  prevButtons = /* @__PURE__ */ new Map();
  get buildTicks() {
    return Math.round(Math.max(10, this.host.rules.fortBuildSeconds ?? 150) * TICK_RATE);
  }
  get combatTicks() {
    return Math.round(Math.max(10, this.host.rules.fortCombatSeconds ?? 300) * TICK_RATE);
  }
  get cycles() {
    return Math.max(1, Math.round(this.host.rules.fortCycles ?? 1));
  }
  get budget() {
    return Math.max(0, Math.round(this.host.rules.fortBudget ?? 420));
  }
  /** Team index (0, 1) of a faction, -1 for anyone else. */
  teamIndex(faction) {
    return faction === null ? -1 : this.host.teams.slice(0, 2).findIndex((t) => t.id === faction);
  }
  /** Build points a team has left: its budget less what it has standing. */
  pointsLeft(team) {
    return this.budget - this.pieces.filter((p) => p.team === team).reduce((n, p) => n + FORT_PIECES[p.kind].cost, 0);
  }
  count(team) {
    return this.pieces.filter((p) => p.team === team).length;
  }
  reset() {
    for (const p of [...this.pieces]) this.removePiece(p);
    this.cycle = 1;
    this.ctf.reset();
    this.startBuild(false);
  }
  // ---------------------------------------------------------------- phases
  startBuild(respawn) {
    this.phase = FORT_BUILD;
    this.phaseEnd = this.host.tick + this.buildTicks;
    this.setBarrier(true);
    this.bots.reset();
    this.prevButtons.clear();
    if (respawn) for (const c of this.host.combatants()) this.host.respawn(c);
    else for (const c of this.host.combatants()) if (c.alive) this.equipBuilder(c);
    this.host.emit({ e: "msg", text: `Build phase${this.cycles > 1 ? ` ${this.cycle} of ${this.cycles}` : ""}: fortify your flag!`, secs: 4 });
  }
  startCombat() {
    this.phase = FORT_COMBAT;
    this.phaseEnd = this.host.tick + this.combatTicks;
    this.setBarrier(false);
    this.flagsHome();
    this.navRebuilt = this.host.rebuildNav(this.pieces.flatMap((p) => p.boxes.map((b) => ({ min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z], kind: "solid", sourceId: `fort_${p.id}` }))));
    for (const c of this.host.combatants()) this.host.respawn(c);
    this.host.emit({ e: "msg", text: "The barrier is down: capture their flag!", secs: 4 });
  }
  endCombat() {
    if (this.cycle >= this.cycles) {
      this.host.endRound();
      return;
    }
    this.cycle++;
    this.flagsHome();
    this.startBuild(true);
  }
  /** Both flags back on their bases (captures kept). */
  flagsHome() {
    const saved = new Map(this.ctf.captures);
    this.ctf.reset();
    for (const [k, v] of saved) this.ctf.captures.set(k, v);
  }
  setBarrier(on) {
    const physics = this.host.physics;
    if (on && !this.barrier) {
      const m = this.midfield;
      this.barrier = physics.createBox(m.mid, FORT_BARRIER_HALF, m.yaw);
    } else if (!on && this.barrier) {
      physics.removeCollider(this.barrier);
      this.barrier = null;
    }
    physics.commit();
  }
  get barrierUp() {
    return this.barrier !== null;
  }
  step() {
    const host = this.host;
    if (this.phase === FORT_BUILD) {
      this.keepToOwnHalves();
      this.bots.build();
      if (host.tick >= this.phaseEnd) this.startCombat();
      return;
    }
    this.ctf.step();
    if (host.tick >= this.phaseEnd) this.endCombat();
  }
  /** Nobody spends the build phase on the other team's half (a spawn there, or slipping round the field's end). */
  keepToOwnHalves() {
    for (const c of this.host.combatants()) {
      const t = this.teamIndex(c.faction);
      if (!c.alive || t < 0 || c.mount) continue;
      if (this.midfield.side(c.move.pos) * (t === 0 ? -1 : 1) > 0.3) continue;
      const home = this.bases[t];
      const back = t === 0 ? -1 : 1;
      c.move = { pos: { x: home.x + this.midfield.dir.x * back * 1.5, y: home.y + 0.3, z: home.z + this.midfield.dir.z * back * 1.5 }, velY: 0, grounded: false };
    }
  }
  // ---------------------------------------------------------------- the Builder
  onSpawn(c) {
    if (this.phase === FORT_BUILD) this.equipBuilder(c);
  }
  /** Build phase: the Builder is all anyone holds. */
  equipBuilder(c) {
    const def = getWeapon(BUILDER_WEAPON);
    const code = weaponCode(def);
    c.weapons = /* @__PURE__ */ new Map([[code, { def, mag: 0, reserve: 0, alt: 0 }]]);
    c.current = code;
    c.throwable = null;
    c.raiseTicks = 0;
    c.reloadTicks = 0;
  }
  blocksDamage(victim, attacker) {
    return this.phase === FORT_BUILD && attacker !== null && attacker !== victim;
  }
  useInput(c, input) {
    if (c.weapons.get(c.current)?.def.id !== BUILDER_WEAPON) return false;
    const prev = this.prevButtons.get(c.slot) ?? 0;
    this.prevButtons.set(c.slot, input.buttons);
    if (this.phase !== FORT_BUILD) return true;
    const pressed = input.buttons & ~prev;
    const team = this.teamIndex(c.faction);
    if (team < 0 || !(pressed & (BUTTON_FIRE | BUTTON_ALT | BUTTON_ZOOM))) return true;
    const eye = { x: c.move.pos.x, y: c.move.pos.y + eyeHeightOf(c.move, c.size), z: c.move.pos.z };
    const code = input.build ?? 0;
    const kind = FORT_PIECE_KINDS[code & 15] ?? "block";
    const rot = code >> 4 & 3;
    if (pressed & BUTTON_FIRE) {
      const base = fortAimPlacement(this.host.physics, eye, c.yaw, c.pitch, kind, rot);
      if (base) this.place(team, kind, rot, base, c.slot);
    } else {
      const hit = this.host.physics.raycastHit(eye, viewDirection(c.yaw, c.pitch), FORT_REACH);
      const p = hit ? this.byHandle.get(hit.handle) : void 0;
      if (p && p.team === team) this.removePiece(p);
    }
    return true;
  }
  /** What placement checks see. */
  world() {
    const keepClear = [
      ...this.bases.map((pos) => ({ pos, r: FORT_FLAG_CLEARANCE })),
      ...this.host.spawnPoints.map((s) => ({ pos: s.pos, r: FORT_SPAWN_CLEARANCE }))
    ];
    return {
      physics: this.host.physics,
      side: this.midfield.side,
      pieces: this.pieces,
      bodies: this.host.combatants().filter((c) => c.alive).map((c) => c.move.pos),
      keepClear
    };
  }
  /** Why team `team` can't put this piece here right now (null: it can). */
  problem(team, kind, rot, base) {
    if (this.phase !== FORT_BUILD) return "Only in the build phase";
    if (FORT_PIECES[kind].cost > this.pointsLeft(team)) return "Not enough build points";
    if (this.count(team) >= FORT_MAX_PIECES) return "Your team has built all it can";
    return fortPlacementProblem(this.world(), team, kind, rot, base);
  }
  /** Place a piece for a team if the rules allow it; returns it, or the reason it can't go there. */
  place(team, kind, rot, base, by = -1) {
    const why = this.problem(team, kind, rot, base);
    if (why) return why;
    const def = FORT_PIECES[kind];
    const boxes = fortPieceBoxes(kind, rot, base);
    const physics = this.host.physics;
    const colliders = boxes.map(
      (b) => physics.createBox({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 }, { x: (b.max.x - b.min.x) / 2, y: (b.max.y - b.min.y) / 2, z: (b.max.z - b.min.z) / 2 })
    );
    physics.commit();
    const p = { id: this.nextId++, kind, team, base: { ...base }, rot: (rot % 4 + 4) % 4, boxes, health: def.health, max: def.health, colliders, by };
    this.pieces.push(p);
    for (const col of colliders) this.byHandle.set(col.handle, p);
    this.version++;
    return p;
  }
  removePiece(p) {
    const i = this.pieces.indexOf(p);
    if (i < 0) return;
    this.pieces.splice(i, 1);
    for (const col of p.colliders) {
      this.byHandle.delete(col.handle);
      this.host.physics.removeCollider(col);
    }
    this.host.physics.commit();
    this.version++;
  }
  pieceByHandle(handle) {
    return this.byHandle.get(handle);
  }
  // ---------------------------------------------------------------- damage
  /** Combat only; teams don't wreck their own forts (unless friendly fire is on). */
  hurtPiece(p, amount, attacker) {
    if (this.phase !== FORT_COMBAT || amount <= 0 || !this.pieces.includes(p)) return;
    if (attacker && this.teamIndex(attacker.faction) === p.team && (this.host.rules.friendlyFire ?? "off") === "off") return;
    p.health -= amount;
    this.healthDirty = true;
    if (p.health <= 0) this.removePiece(p);
  }
  damageBody(handle, amount, attacker) {
    const p = this.byHandle.get(handle);
    if (!p) return false;
    this.hurtPiece(p, amount * FORT_BULLET_SCALE[FORT_PIECES[p.kind].tier], attacker);
    return true;
  }
  splash(at2, radius, damage, edge, attacker) {
    if (this.phase !== FORT_COMBAT) return;
    for (const p of [...this.pieces]) {
      const b = fortBounds(p.boxes);
      const dx = Math.max(b.min.x - at2.x, 0, at2.x - b.max.x);
      const dy = Math.max(b.min.y - at2.y, 0, at2.y - b.max.y);
      const dz = Math.max(b.min.z - at2.z, 0, at2.z - b.max.z);
      const d = hypot(dx, dy, dz);
      if (d > radius) continue;
      this.hurtPiece(p, (damage + (edge - damage) * (d / radius)) * FORT_BLAST_SCALE[FORT_PIECES[p.kind].tier], attacker);
    }
  }
  // ---------------------------------------------------------------- CTF and the rest
  onKill(victim, killer) {
    this.ctf.onKill(victim);
  }
  onLeave(c) {
    this.ctf.onLeave(c);
    this.prevButtons.delete(c.slot);
  }
  /** Host handoff: the team scores a checkpoint carried (as teamScores gives them). */
  restoreScores(scores) {
    this.ctf.restoreScores(scores);
  }
  teamScores() {
    return this.ctf.teamScores();
  }
  snapshot() {
    const md = this.ctf.snapshot();
    const secs = Math.max(0, Math.ceil((this.phaseEnd - this.host.tick) / TICK_RATE));
    md.fo = [this.phase, secs, this.cycle, this.cycles, this.pointsLeft(0), this.pointsLeft(1), this.count(0), this.count(1), this.budget];
    const keyframe = this.snapshots++ % 60 === 0;
    if (keyframe || this.version !== this.sentVersion || this.healthDirty && this.host.tick - this.healthSent >= TICK_RATE / 2) {
      const r2 = (v) => Math.round(v * 100) / 100;
      md.fp = this.pieces.map((p) => [p.id, FORT_PIECE_KINDS.indexOf(p.kind), p.team, r2(p.base.x), r2(p.base.y), r2(p.base.z), p.rot, Math.ceil(Math.max(0, p.health) / p.max * 100)]);
      this.sentVersion = this.version;
      this.healthDirty = false;
      this.healthSent = this.host.tick;
    }
    return md;
  }
  blocksVehicle(c) {
    return this.phase === FORT_BUILD || this.ctf.blocksVehicle(c);
  }
  botAwareness(c) {
    return this.phase === FORT_BUILD ? 0 : this.ctf.botAwareness(c);
  }
  botGoal(c) {
    return this.phase === FORT_BUILD ? this.bots.goal(c) : this.ctf.botGoal(c);
  }
  /** The team brain's brief: nothing while the teams build; the fight's, CTF's. */
  botBrief(team) {
    return this.phase === FORT_BUILD ? null : this.ctf.botBrief(team);
  }
  /** The fight's trips (the flags'), worked out again once the navmesh has the forts in it. */
  /** Fireteams' "Defend the objective": our flag (Capture the Flag's). */
  defendSpot(team) {
    return this.ctf.defendSpot(team);
  }
  botTrips() {
    return this.ctf.botTrips();
  }
  botInput(c, input) {
    if (this.phase === FORT_BUILD) input.buttons &= -47;
    else this.bots.blast(c, input);
  }
}
const onHill = (h, p) => horizontalDistance(h.pos, p) <= h.radius && p.y > h.pos.y - 1 && p.y < h.pos.y + 3.5;
class KothMode {
  constructor(host) {
    this.host = host;
    this.hills = host.map.entities.flatMap((e, index) => e.kind === "hill" ? [{ index, pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, radius: e.radius }] : []);
    if (!this.hills.length) this.hills.push({ index: -1, pos: { x: 0, y: 0, z: 0 }, radius: 5 });
    this.reset();
  }
  host;
  hills;
  active = 0;
  moveAt = 0;
  /** Ticks held per team. */
  held = /* @__PURE__ */ new Map();
  /** Team holding the hill right now, null for nobody, 'contested'. */
  holder = null;
  get moveTicks() {
    return Math.round((this.host.rules.hillSeconds ?? 60) * TICK_RATE);
  }
  get hill() {
    return this.hills[this.active];
  }
  reset() {
    this.active = 0;
    this.moveAt = this.host.tick + this.moveTicks;
    this.held.clear();
    this.holder = null;
  }
  step() {
    const host = this.host;
    if (host.tick >= this.moveAt) {
      this.moveAt = host.tick + this.moveTicks;
      if (this.hills.length > 1) {
        this.active = (this.active + 1) % this.hills.length;
        this.holder = null;
        host.emit({ e: "hill", a: "move", i: this.hill.index, team: null });
      }
    }
    const present = /* @__PURE__ */ new Set();
    for (const c of host.combatants()) if (c.alive && c.faction && onHill(this.hill, c.move.pos)) present.add(c.faction);
    const holder = present.size === 1 ? [...present][0] : present.size > 1 ? "contested" : null;
    if (holder !== this.holder) {
      this.holder = holder;
      host.emit({ e: "hill", a: "hold", i: this.hill.index, team: holder === "contested" ? null : holder });
    }
    if (holder && holder !== "contested") {
      const ticks = (this.held.get(holder) ?? 0) + 1;
      this.held.set(holder, ticks);
      if (host.rules.scoreLimit > 0 && Math.floor(ticks / TICK_RATE) >= host.rules.scoreLimit) host.endRound();
    }
  }
  onKill() {
  }
  onLeave() {
  }
  /** Host handoff: the team scores a checkpoint carried (as teamScores gives them). */
  restoreScores(scores) {
    for (const t of this.host.teams) this.held.set(t.id, (scores.get(t.id) ?? 0) * TICK_RATE);
  }
  teamScores() {
    return new Map(this.host.teams.map((t) => [t.id, Math.floor((this.held.get(t.id) ?? 0) / TICK_RATE)]));
  }
  snapshot() {
    const teams = this.host.teams;
    const holder = this.holder === "contested" ? -2 : teams.findIndex((t) => t.id === this.holder);
    return {
      ts: teams.map((t) => Math.floor((this.held.get(t.id) ?? 0) / TICK_RATE)),
      hl: [this.hill.index, holder, this.hills.length > 1 ? Math.max(0, Math.ceil((this.moveAt - this.host.tick) / TICK_RATE)) : 0]
    };
  }
  botAwareness() {
    return Infinity;
  }
  blocksVehicle() {
    return false;
  }
  /** Each team's way from its spawn to every hill. */
  botTrips() {
    const out = [];
    for (const t of this.host.teams) {
      const home = teamHome(this.host.spawnPoints, t.id);
      if (home) {
        for (const h of this.hills) if (h.index >= 0) out.push({ team: t.id, from: home, to: { ...h.pos }, kind: "attack" });
      }
    }
    return out;
  }
  /** Fireteams' "Defend the objective": the hill in play. */
  defendSpot() {
    return { ...this.hill.pos };
  }
  /**
   * The team brain's brief: everyone goes for the hill; while the other team holds it, they gather first and retake it
   * together (a group push), otherwise straight in.
   */
  botBrief(team) {
    const theirs = this.holder !== null && this.holder !== "contested" && this.holder !== team;
    return { attack: { pos: { ...this.hill.pos }, stage: theirs }, intercept: null, playbook: playbookFor("core.koth").team };
  }
  /**
   * Everyone heads for the hill and spreads out on it. A goal to hold (bots/brain.ts scored choices: what happens near
   * the hill draws a bot on it, gunfire further off doesn't), not one to keep to on the way (`push`: such a bot takes
   * cover only when hurt or reloading). Before scores a bot on the hill went after any gunfire it heard and the hill
   * emptied: held 26 % of the time on the dev sample (Shingle Point, Diamond Park, Bunker Cross), 40 % with them.
   */
  botGoal(c) {
    const h = this.hill;
    return { pos: h.pos, radius: Math.max(1, h.radius * 0.6 - c.slot % 3) };
  }
}
function createMode(mode, host) {
  switch (mode) {
    case "core.ctf":
      return new CtfMode(host);
    case "core.koth":
      return new KothMode(host);
    case "core.elim":
      return new ElimMode(host);
    case "core.bomb":
      return new BombMode(host);
    case "core.hostage":
      return new HostageMode(host);
    case "core.breakthrough":
      return new BreakthroughMode(host);
    case "core.forts":
      return new FortsMode(host);
    default:
      return null;
  }
}
const ROUTE_STEP = 5;
const ROUTE_ON = 4;
const ALERT_INTERVAL_TICKS = 15;
const SAFE_SPAWN_DISTANCE = 6;
const ENTRANCE_GAP_TICKS = Math.round(TICK_RATE * 0.9);
class Encounters {
  constructor(map, host) {
    this.host = host;
    for (const e of map.entities) if (e.kind === "encounter") this.list.set(e.id, this.fresh(e));
    for (const p of map.paths ?? []) if (p.points.length >= 2) this.routes.set(p.id, p);
  }
  host;
  list = /* @__PURE__ */ new Map();
  byNpc = /* @__PURE__ */ new Map();
  started = false;
  /** The map's paths by id: the routes squads with the patrol order walk (an encounter's `route`). */
  routes = /* @__PURE__ */ new Map();
  fresh(e) {
    return { e, active: false, budget: 0, spawned: 0, members: [], nextSpawn: 0, order: e.order, cleared: false, queue: [], legs: /* @__PURE__ */ new Map(), wander: /* @__PURE__ */ new Map(), dirs: /* @__PURE__ */ new Map(), homing: /* @__PURE__ */ new Set() };
  }
  /** Back to the start (new round). The match removes the NPCs themselves. */
  reset() {
    for (const [id, r] of this.list) this.list.set(id, this.fresh(r.e));
    this.byNpc.clear();
    this.started = false;
  }
  start(id) {
    const r = this.list.get(id);
    if (!r || r.active) return;
    const extraPlayers = Math.max(0, this.host.players().length - 1);
    const roster = NPC_ROLES.flatMap((role) => Array(rosterCount(r.e.roster, role)).fill(role));
    if (!roster.length) roster.push("trooper");
    r.queue = roster;
    r.budget = r.spawned + roster.length + r.e.reinforcements + r.e.perPlayer * extraPlayers;
    r.active = true;
    r.cleared = false;
    r.nextSpawn = this.host.tick;
  }
  /** Stop reinforcing; the squad is cleared once the living members die. */
  stop(id) {
    const r = this.list.get(id);
    if (!r) return;
    r.budget = r.spawned;
    this.checkCleared(r, null);
  }
  setOrder(id, order) {
    const r = this.list.get(id);
    if (r) r.order = order;
  }
  alive(id) {
    const r = this.list.get(id);
    return r ? r.members.filter((m) => this.host.npc(m)?.alive).length : 0;
  }
  totalAlive() {
    let n = 0;
    for (const id of this.list.keys()) n += this.alive(id);
    return n;
  }
  step() {
    const tick = this.host.tick;
    if (!this.started) {
      this.started = true;
      for (const r of this.list.values()) if (r.e.startActive) this.start(r.e.id);
    }
    for (const r of this.list.values()) {
      r.members = r.members.filter((m) => this.host.npc(m));
      const living = r.members.filter((m) => this.host.npc(m).alive);
      if (r.active && r.spawned < r.budget && living.length < r.e.activeCap && tick >= r.nextSpawn) {
        const role = r.queue[r.spawned % r.queue.length] ?? "trooper";
        const id = this.spawnMember(r, role);
        if (id !== null) {
          r.spawned++;
          r.members.push(id);
          this.byNpc.set(id, r);
        }
        const firstWave = r.spawned < r.queue.length;
        r.nextSpawn = tick + (firstWave ? (r.e.entrance ?? "none") === "none" ? 1 : ENTRANCE_GAP_TICKS : Math.round(r.e.respawnSeconds * TICK_RATE));
      }
      if ((tick + r.e.id.length) % ALERT_INTERVAL_TICKS === 0) this.shareSightings(living);
    }
  }
  spawnMember(r, role) {
    const origin = { x: r.e.position[0], y: r.e.position[1], z: r.e.position[2] };
    if (r.e.entrance && r.e.entrance !== "none") return this.throughEntrance(r, role, origin);
    const hostiles = this.host.hostiles(r.e.faction);
    let best = null;
    for (let i = 0; i < 12; i++) {
      const a = this.host.random() * Math.PI * 2;
      const d = Math.sqrt(this.host.random()) * r.e.radius;
      const p = this.host.nav.closestPoint({ x: origin.x + Math.cos(a) * d, y: origin.y + 0.5, z: origin.z + Math.sin(a) * d }, { x: 1.5, y: 2, z: 1.5 });
      if (!p || this.host.inShutDoor(p)) continue;
      const nearestHostile = hostiles.reduce((m, h) => Math.min(m, horizontalDistance(h.pos, p)), Infinity);
      const crowd = r.members.some((m) => {
        const n = this.host.npc(m);
        return n?.alive && horizontalDistance(n.pos, p) < 1.2;
      });
      const score = Math.min(nearestHostile, SAFE_SPAWN_DISTANCE * 3) - (crowd ? 10 : 0) - (nearestHostile < SAFE_SPAWN_DISTANCE ? 20 : 0);
      if (!best || score > best.score) best = { pos: { x: p.x, y: p.y, z: p.z }, score };
    }
    const pos = best?.pos ?? origin;
    return this.host.spawnNpc(r.e, role, pos, r.e.yaw);
  }
  /**
   * One member out of the squad's entrance: at its mouth (a breach's is just
   * in front of the wall), or from a vent above, dropping to the floor. Waits
   * while the last one is still standing in the way.
   */
  throughEntrance(r, role, origin) {
    const e = r.e;
    const out = e.entrance === "breach" ? 0.8 : 0;
    const jitter = () => (this.host.random() - 0.5) * 0.5;
    const mouth = { x: origin.x + Math.sin(e.yaw) * out + jitter(), y: origin.y, z: origin.z + Math.cos(e.yaw) * out + jitter() };
    const blocked = r.members.some((m) => {
      const n = this.host.npc(m);
      return n?.alive && horizontalDistance(n.pos, mouth) < 1.1 && Math.abs(n.pos.y - origin.y) < 2.5;
    });
    if (blocked) return null;
    const ground = this.host.nav.closestPoint({ x: mouth.x, y: mouth.y + 0.5, z: mouth.z }, { x: 1, y: 2, z: 1 });
    const pos = ground ? { x: ground.x, y: ground.y, z: ground.z } : mouth;
    if (e.entrance === "vent") pos.y += clamp((e.ventHeight ?? 3.5) - PLAYER.height * (e.size ?? 1) - 0.1, 0, 10);
    return this.host.spawnNpc(e, role, pos, e.yaw);
  }
  /** Squadmates who can see an enemy tell the others where it is. */
  shareSightings(living) {
    let seen = null;
    for (const m of living) {
      const brain = this.host.npc(m).brain;
      const s = brain.target !== null ? brain.lastSeen : null;
      if (s && (!seen || s.tick > seen.tick)) seen = s;
    }
    if (!seen) return;
    for (const m of living) this.host.npc(m).brain.alert(seen.pos, seen.tick);
  }
  /** Roamers and route patrols keep moving with nobody near (they don't doze off like guards). */
  roaming(npcId) {
    const r = this.byNpc.get(npcId);
    return !!r && (r.order === "roam" || r.order === "patrol" && !!this.route(r));
  }
  /** The route a squad patrols (its encounter's `route`, when the map has that path), or null. */
  route(r) {
    return r.e.route && this.routes.get(r.e.route) || null;
  }
  /**
   * Walking a route: a point a few metres ahead along it, members a little
   * apart side by side. Off the route, the nearest point on it first. Round
   * and round a loop; on an open route there and back (turning at its ends),
   * or round (back to the start from the end) when the path says so. A
   * one-way route is only walked its own way.
   */
  routeGoal(r, path, npcId, pos, index) {
    const g = pathGeometry(path);
    const lane = (index % 3 - 1) * 0.9;
    const at2 = (s) => {
      const q = g.at(s);
      return { x: q.x + q.dz * lane, y: q.y, z: q.z - q.dx * lane };
    };
    if (r.homing.has(npcId)) {
      if (horizontalDistance(pos, g.samples[0]) > 3) return { pos: at2(0), radius: 1.5 };
      r.homing.delete(npcId);
    }
    const near2 = g.nearest(pos.x, pos.z, 1e5);
    if (near2.dist > ROUTE_ON) return { pos: at2(near2.sample.s), radius: 1.5 };
    const style = path.patrol ?? (path.closed ? "loop" : "back_and_forth");
    let dir = path.oneWay ? 1 : r.dirs.get(npcId) ?? 1;
    if (!g.loop) {
      const s = near2.sample.s;
      if (style === "back_and_forth" && !path.oneWay) {
        if (dir > 0 && s >= g.length - 2) dir = -1;
        else if (dir < 0 && s <= 2) dir = 1;
      } else if (s >= g.length - 2) {
        r.homing.add(npcId);
        return { pos: at2(0), radius: 1.5 };
      }
    }
    r.dirs.set(npcId, dir);
    return { pos: at2(near2.sample.s + dir * ROUTE_STEP), radius: 1.5 };
  }
  /** Where a member should be when not fighting. */
  goalFor(npcId) {
    const r = this.byNpc.get(npcId);
    const me = this.host.npc(npcId);
    if (!r || !me) return null;
    const index = Math.max(0, r.members.indexOf(npcId));
    const home = { x: r.e.position[0], y: r.e.position[1], z: r.e.position[2] };
    const target = r.e.orderTarget && this.host.entityPos(r.e.orderTarget) || home;
    const ring = (p, base) => {
      const a = index * 2.39996;
      const d = base + index % 3 * 0.8;
      return { x: p.x + Math.cos(a) * d, y: p.y, z: p.z + Math.sin(a) * d };
    };
    switch (r.order) {
      case "hold":
        return { pos: ring(home, 1.5), radius: 1.5 };
      case "defend":
        return { pos: ring(target, 2), radius: 2 };
      case "patrol": {
        const route = this.route(r);
        if (route) return this.routeGoal(r, route, npcId, me.pos, index);
        let leg = r.legs.get(npcId) ?? 1;
        const goal = leg ? target : home;
        if (horizontalDistance(me.pos, goal) < 2.5) {
          leg = 1 - leg;
          r.legs.set(npcId, leg);
        }
        return { pos: leg ? target : home, radius: 1.5 };
      }
      case "attack": {
        let best = null;
        let bestD = Infinity;
        for (const h of this.host.hostiles(r.e.faction)) {
          const d = horizontalDistance(h.pos, me.pos) + Math.abs(h.pos.y - me.pos.y) * 2;
          if (d < bestD) {
            bestD = d;
            best = h.pos;
          }
        }
        return best ? { pos: best, radius: 2 } : { pos: ring(home, 1.5), radius: 1.5 };
      }
      case "roam": {
        let goal = r.wander.get(npcId);
        if (!goal || horizontalDistance(me.pos, goal) < 3) {
          const places = this.host.nav.places();
          goal = places.length ? places[Math.floor(this.host.random() * places.length)] : ring(home, 6);
          r.wander.set(npcId, goal);
        }
        return { pos: goal, radius: 2.5 };
      }
      case "follow": {
        let best = null;
        let bestD = Infinity;
        for (const p of this.host.players()) {
          const d = horizontalDistance(p.pos, me.pos);
          if (d < bestD) {
            bestD = d;
            best = p.pos;
          }
        }
        return best ? { pos: ring(best, 2.5), radius: 3 } : { pos: ring(home, 1.5), radius: 1.5 };
      }
    }
  }
  /**
   * Bounding overwatch for attacking squads: grunts pair up and take turns,
   * one moving up to the next cover while its partner holds and covers.
   * Null when the member isn't part of that (other orders, heavies, snipers).
   */
  squadFor(npcId, role) {
    const r = this.byNpc.get(npcId);
    if (!r || r.order !== "attack" || role !== "trooper" && role !== "gunner") return null;
    const grunts = r.members.filter((m) => this.host.npc(m)?.alive);
    if (grunts.length < 2) return { advance: true };
    const index = grunts.indexOf(npcId);
    const phase = Math.floor(this.host.tick / (TICK_RATE * 3)) % 2;
    return { advance: index % 2 === phase };
  }
  /** Bookkeeping when a member dies: logic events and the cleared check. */
  onNpcKilled(npcId, killer) {
    const r = this.byNpc.get(npcId);
    if (!r) return;
    this.host.fire("npc_killed", r.e.id, killer);
    this.checkCleared(r, killer, npcId);
  }
  checkCleared(r, killer, justDied) {
    if (r.cleared || r.spawned === 0 || r.spawned < r.budget) return;
    const anyAlive = r.members.some((m) => m !== justDied && this.host.npc(m)?.alive);
    if (anyAlive) return;
    r.cleared = true;
    r.active = false;
    this.host.fire("encounter_cleared", r.e.id, killer);
  }
  encounterOf(npcId) {
    return this.byNpc.get(npcId)?.e.id;
  }
}
const BOT_THEME_MIN = 96;
const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
const BOT_NAMES = [
  "Brassneck",
  "Mildred",
  "Captain Pell",
  "Wick",
  "Doctor Umber",
  "Spoke",
  "Gloam",
  "Tibbs",
  "Ferro",
  "Lady Ash",
  "Nub",
  "Quill",
  "Rustbucket",
  "Old Saltpeter",
  "Pigeon",
  "Hollis Crane",
  "Madame Thistle",
  "Biscotti",
  "Sergeant Gravy",
  "Lumen",
  "Ratchet",
  "Nana Voss",
  "Dregs",
  "Crumpet",
  "Sister Vex",
  "Lanternjaw",
  "Fennimore",
  "Dazzle",
  "Moss",
  "Brigadier Fudge",
  "Kettle",
  "Ivy Strand",
  "Gristle",
  "Professor Snoot",
  "Tumble",
  "Ozzie Pike",
  "Cinderbell",
  "Wally Hex",
  "Pickles",
  "Dame Rook",
  "Scuttle",
  "Barnaby Wren",
  "Flint",
  "Auntie Sprocket",
  "Grub",
  "Major Mulch",
  "Velvet",
  "Dot",
  "Corporal Puddle",
  "Splinter",
  "Hob",
  "Miss Fortescue",
  "Sprat",
  "Gideon Lark",
  "Mudlark",
  "Bellows",
  "Countess Cog",
  "Zip",
  "Tinder",
  "Old Hob",
  "Wren Kettering",
  "Bolt",
  "Lady Pincushion",
  "Rumble",
  "Juniper",
  "Scrap",
  "Colonel Custard",
  "Fizz",
  "Smudge",
  "Bramble",
  "Inspector Gloat",
  "Patch",
  "Marigold",
  "Clank",
  "Uncle Dredge",
  "Pip",
  "Tallow",
  "Sir Wobble",
  "Gravel",
  "Mabel Stone",
  "Stitch",
  "Quirk",
  "Admiral Dunk",
  "Sootfoot",
  "Hazel Grim",
  "Plunk",
  "Brisket",
  "Captain Mops",
  "Ember Wick",
  "Dingo",
  "Prudence",
  "Rook",
  "Nettle",
  "Duchess Rust",
  "Boomer",
  "Sable",
  "Ogden",
  "Cricket",
  "Glimmer",
  "Barnacle Bill",
  "Pudding",
  "Vesper",
  "Hatchet",
  "Tuppence",
  "Grimsby",
  "Slate",
  "Mister Mottle",
  "Fable"
];
const SOLDIER_RANKS = ["Pvt.", "Pfc.", "Cpl.", "Sgt.", "SSgt.", "Lt.", "Capt.", "Maj.", "Col."];
const RANK_ORDER = ["Pvt.", "Cpl.", "Pfc.", "Sgt.", "Pvt.", "Lt.", "Pfc.", "Cpl.", "SSgt.", "Pvt.", "Capt.", "Sgt.", "Pfc.", "Maj.", "Cpl.", "Pvt.", "Sgt.", "Col."];
const SOLDIER_SURNAMES = list(`
  Haskett, Mulroy, Pickering, Dunmore, Okafor, Brackley, Tolliver, Vasquez, Kowalczyk, Ferrante, Lindqvist, Nakamura,
  Abernathy, Quarles, Delacroix, Ostrowski, Mbeki, Halloran, Petrakis, Sandoval, Whitlock, Castellano, Brannigan,
  Achterberg, Rooney, Gallardo, Hendricks, Ishikawa, Jablonski, Kilbride, Larkspur, Moncrieff, Nwosu, Oyelaran,
  Pemberton, Quintero, Rasmussen, Szabo, Thackeray, Underhill, Valdivia, Wexley, Yardley, Zielinski, Ambrose,
  Birchall, Cartwright, Dorsey, Ellwood, Fairweather, Grummond, Ingersoll, Jarvie, Kettering, Lomax,
  Mackintyre, Nettleton, Ormsby, Pruett, Ravenhill, Stroud, Tremaine, Upshaw, Varga, Winterbourne, Yancey, Ashdown,
  Bellamy, Coker, Drummond, Eckhart, Fortunato, Gimble, Hargreave, Iwasaki, Jessup, Kincaid, Lowther, Merriweather,
  Nobbs, Ogilvie, Puckett, Shoemaker, Umberton, Vickery, Wainwright, Abiodun, Bolanos, Crabtree,
  Dabrowski, Enright, Flanagan, Gutierrez, Holcombe, Ivanovic, Jorgensen, Kavanagh, Mendoza, Nash,
  Pinkney, Spalding, Trujillo, Vandermeer, Wozniak, Zamora, Bixby, Cobbett, Dimmock,
  Fenwick, Gaskell, Knapp, Ludlow, Mayhew, Nutley, Prendergast, Ruddock, Stubbs, Tatum, Whitcombe,
`);
function soldierNames() {
  const out = /* @__PURE__ */ new Set();
  const n = SOLDIER_SURNAMES.length;
  for (let pass = 0; pass < 4; pass++) for (let i = 0; i < n; i++) out.add(`${RANK_ORDER[(i + pass * 5) % RANK_ORDER.length]} ${SOLDIER_SURNAMES[i]}`);
  return [...out];
}
const LISTS = [
  { id: "soldier", names: soldierNames() },
  {
    id: "monkey",
    names: list(`
      Coco Bean, Chitter, Mango, Banjo, Nutmeg, Tamarind, Kumquat, Buttons, Fig, Cheeky, Rascal, Squeaks, Bongo,
      Jibber, Jabber, Twiggs, Mischief, Pockets, Noodle, Ruckus, Hootie, Dangle, Lychee, Papaya, Gumdrop, Tumbles,
      Peanut, Cashew, Bounce, Rumpus, Kiki, Loopy, Grabby, Skitter, Dodger, Monty Vine, Tango, Mojo, Chuckles,
      Sir Swings, Captain Fuzz, Grins, Fritter, Doodle, Jinx, Topsy, Wobbles, Treetop, Canopy, Liana, Kapok, Ziggy,
      Pepper, Taffy, Waffles, Nibs, Plantain, Guava, Biscuit Thief, Hollerbelly, Swingtail, Knucklebump,       Pinky, Muddle, Scribble, Rufus Branch, Tiko, Baba Lou, Gogo, Hoopla, Juju, Kukui, Limbo,       Ooki, Puddy, Quibble, Rattan, Slinky, Tinsel, Umbo, Vinnie Vine, Wiggles, Yoyo, Zuzu, Clatter, Fidget,
      Hullabaloo, Nana Peel, Old Silverback, Pip Swinger, Rowdy, Snaffle, Tuft, Uncle Knuckles, Whoopsie, Bramble Tail,
      Coconut, Monsoon, Dewdrop, Kumbo,
    `)
  },
  {
    id: "bear",
    names: list(`
      Bumble, Honeypot, Bruno Bramble, Grizwald, Fuzzbert, Cubby, Huckle, Barley, Maple, Clover, Snuffles, Bramblebear,
      Big Bertie, Mossback, Dozer, Ursula Plum, Hibernia, Pawsworth, Nugget, Marmalade, Cinnamon, Butterscotch,
      Kodi, Grumbles, Thimble, Woolly, Toffee, Burlap, Snickerdoodle, Ginger Snap, Tumbleweed, Sir Snores,
      Lady Honeycomb, Mumbles, Crumbs, Pancake, Waffle Paws, Nutkin, Hazel Paw, Dumpling, Muffin, Barnacle Bear,
      Porridge, Oatcake, Fluffernut, Snowcap, Pinecone, Sleepy Jo, Bouldy, Rumbleguts, Scruff, Teaspoon, Haggis,
      Hunnybun, Grumpus, Sir Fluff, Old Gruffy, Buttons Bear, Cuddles, Patchwork, Bobbin, Mittens, Furgus, Bjorn,
      Blackberry, Saskia, Kumo, Taiga, Tundra, Yukon, Cobble, Driftwood, Fudge Ripple, Gingham, Hamish, Iggy Bear,
      Jellyroll, Klondike, Lumberjack, Mocha, Nimbus, Oswald Paws, Pudgy, Quilt, Russet, Sundae, Truffle, Umber,
      Velvet Paw, Whisker Biscuit, Yawn, Zephyr Bear, Bramwell, Custard Cub, Doughnut, Elmwood, Fernley,
      Honeydew, Gruffle, Pawpaw Bear, Snoozles, Bramblepatch, Berrybelly, Hushabye,
    `)
  },
  {
    id: "wolf",
    names: list(`
      Howler, Moonfang, Ashpelt, Snarl, Duskrunner, Frostjaw, Grimtooth, Shadowpaw, Ragged Ear, Nightmuzzle, Cackle,
      Smirk, Giggletooth, Bonecrunch, Ironhide, Scraggle, Sable Fang, Tundra, Hackles, Rimefur, Ember Eye, Thornpelt,
      Wolfram, Brisk, Lupa, Vargo, Fenrick, Lowell, Stormhowl, Gnash, Scruffle, Prowl, Lurk, Skulk, Glint,
      Mangy Mo, Old Greymuzzle, Slinkfoot, Tatter, Bristle, Cinder Paw, Ridgeback, Hollowbark, Blackmoor, Rook Fang,
      Silvertail, Whitewhisker, Coal, Smoke, Slate Wolf, Thicket, Bramblefang, Yowl, Yip, Snicker, Hee Haw, Chortle,
      Guffaw, Titter, Chuckle Fang, Spotty, Scavvy, Bone Bandit, Stripe, Dappled Dan, Rufus Ruff, Grizzleback,
      Hunter Moon, Pale Fang, Starling, Wildroot, Kestrel, Nightshade, Brindle, Copper, Rusty Jaw, Sundown, Thistle,
      Wolfsbane, Yarrow, Zealot, Barker, Chaser, Dingo Dan, Ember Fang, Flurry, Gale, Haze, Inkfang, Jagged, Knave,
      Lope, Murk, Nettle Fang, Outrider,
      Moonsong, Frostbite Fang, Greyrunner, Ashwhisker, Duskhowl, Pinescent, Crag Fang, Rimewalker,
    `)
  },
  {
    id: "dog",
    names: list(`
      Biscuit Bark, Waffles Woof, Pup Pup, Fetch, Sir Barksalot, Rover Grove, Patches, Noodle Nose,       Buster Bean, Sparky, Wiggles Wag, Kibble, Chomper, Barkley, Sniffy, Bandit Pup, Tater Tot, Meatball, Pickle Pup,
      Corndog, Bingo Bongo, Scamper, Rascal Rex, Duke Drool, Lady Floof, Floofington, Toasty, Mochi, Daikon, Soba,
      Udon, Miso, Tofu Pup, Yuzu, Kinako, Azuki, Taro, Sesame, Furikake, Nori, Wasabi Pup, Ponzu, Kombu,
      Shoyu, Tempura, Gyoza, Onigiri, Ramen, Bento, Edamame, Katsu, Mugi, Kuri, Hana Paw, Sora Pup, Ponpon,
      Zoomies, Tail Spin, Good Boy, Sock Thief, Squeaky, Ball Hog, Slobbers, Wagster, Ruff Ruff,
      Bonesy, Nugget Pup, Corky, Dottie, Freckles, Honey Pup, Jellybean, Kipper, Lucky Lou, Mopsy, Nacho,
      Cookie Pup, Poppy, Ruffles, Sprinkles, Tinker, Ziggy Pup, Dash, Echo Pup, Fudge Pup,
      Goober, Hopscotch, Jumbo, Lollipop, Marshmallow, Pretzel,           Wigglebutt, Puddle Paws, Flopsy Ears, Barkington, Snoot Boop, Treat Hound, Pawprint, Tailwind Pup, Chewtoy, Fluffernutter Pup, Snuggle Pup, Zoom Zoom,
    `)
  },
  {
    id: "cat",
    names: list(`
      Whiskers, Mittens Mcgee, Purrcy, Sir Pounce, Tabby Tam, Marmalade Max, Smokey Joe, Paws, Furball, Clawdia,
      Purrsephone, Meowington, Kit Kitson, Shadow Puss, Ginger Nut, Tuxedo, Bootsie, Pumpkin Spice,
      Nibbles, Snoozer, Loaf, Scratch, Hiss, Tiddles, Fluffkins, Prowler, Tom Tiddler, Moggy Moe, Slinky Sue,
      Velvet Claw, Purrfect, Catnip, Yarnball, Cream Puff, Sardine, Kipper Cat, Tuna Melt, Pilchard, Saucer, Milky,
      Pepperpot, Nutmeg Puss, Cloudy, Dusty Paws, Fishbone, Knead, Mouser, Napkin, Ottoline, Pawpaw,
      Quaver, Sardinia, Ursa Purr, Vixie, Whiskerton, Yowler, Zuzu Puss, Alleycat Al,
      Biscuit Paws, Calico Kate, Doodle Cat, Earl Grey, Felicity, Gremlin, Hairball Harry, Inkblot, Jasper Purr,
      Kitty Hawk, Lady Whisk, Midnight, Oolong, Purrcival, Queenie, Rascal Cat, Sphinxy, Tigerlily,
      Underfoot, Vole Hunter, Windowsill, Yuki, Zest, Box Lover, Cardboard, Laser Dot, Tail Flick,
      Ninelives, Pounce Pounce, Scruffy Puss,
      Pawsley, Whiskerella, Mister Mews, Lady Purrington, Tuna Breath, Slippers, Biscuit Kneader, Sunbeam, Hissy Fit, Furrari, Catapult, Meowzer, Scritches, Toe Beans, Napsack,
    `)
  },
  {
    id: "raccoon",
    names: list(`
      Trashcan Tess, Ringtail, Masked Max, Rummage, Scavenger, Bin Diver, Lidlifter, Nightscrounge, Pilfer, Swipe,
      Snatch, Pocketpaws, Grabbit, Scrounger, Moonlighter, Dumpster Dan, Garbage Gus, Rinse, Washbear, Dunk Dunk,
      Rascal Ring, Bandana Bo, Cornerstash, Sly Sal, Stripes, Banded Ben, Sticky Fingers, Klepto, Crumbcatcher,
      Hoarder, Squirrelly, Tinpot, Canopener, Wrapper, Peel, Crust, Leftovers, Rubbish Rita, Scrapheap, Gutterball,
      Alleyway Al, Backyard Bob, Picnic Pete, Cooler Raider, Lunchbox, Tupperware, Nightowl Nell, Shady Sadie,
      Skulker, Rattle Lid, Clatterpaw, Tinfoil, Bottlecap, Corkscrew, Napkin Ned, Crumb, Raisin, Pretzel Paws,
      Midnight Snack, Cheese Puff, Crackers, Muffin Top, Pizza Crust, Taco Tuesday, Popcorn, Cheddar, Sardine Can,
      Fishstick, Ketchup, Mustard, Relish, Gravy Boat, Pickle Jar, Jam Jar, Toast Crumb, Bagel, Donut Hole, Churro,
      Waffle Cone, Ringle Rascal, Masky, Domino, Bandit Jr, Little Mask, Stash, Fence,
      Loot, Pockets Pratt, Nab, Nicks, Rifle Through, Scoundrel, Smuggler, Trickster,
      Lid Rattler, Rummage Rosie, Midnight Mooch, Tin Lid Tom, Moochie, Crumbsnatch, Scraps Mcgee, Binbag Barney, Wheelie Bin,
    `)
  },
  {
    id: "critter",
    names: list(`
      Sir Splashington, Lady Paddles, Pebble, Riverbank, Driftwood, Slipstream, Whiskerworth, Monocle, Tophat Ted,
      Moneybags, Old Money, Lord Puddle, Baroness Burrow, Count Clover, Hopscotch Hal, Clockwork Cloe,
      Gearspring, Brassbutton, Copperkettle, Sprocket Hare, Bunbun, Fluffytail, Radish,
      Parsnip, Turnip, Buttercup, Dandelion, Daisy Hop, Meadow, Clover Leaf, Burrows, Warren, Nibbler, Nutsy,
      Acorn, Chestnut, Hazelnut, Walnut, Pistachio, Almond, Pecan, Squeak, Scurry, Twitch, Ripple, Babble, Brook,
      Eddy, Torrent, Rapids, Shallows, Kelp, Seaweed, Clam, Shellby, Mussel, Cockle, Winkle, Limpet, Barnacle Bun,
      Pondweed, Lilypad, Reed, Rush, Cattail, Sedge, Willow, Alder, Birch, Rowan, Aspen, Poplar, Hawthorn, Holly,
      Ivy, Fern, Moss Bun, Lichen, Truffle Hunter, Mole Major, Shrew, Vole, Dormouse, Hedgy, Prickles, Quillby,
      Spud, Sprout Bun, Wigglenose, Puddlejump, Splashdown, Bubbles Brook, Fishfinger, Pondsworth,
      Hopsworth, Lord Lettuce, Burrowby, Duchess Dewdrop, Sir Whiskerton, Mudslide, Paddlepaw, Pebblebrook, Nibblesworth,
    `)
  },
  {
    id: "frog",
    names: list(`
      Ribbit, Croaker, Hoppity, Lilypad Lou, Swampy, Bogwart, Mudpuddle, Bullfrog Bo, Toadstool, Warty, Gloop,
      Slurp, Splosh, Pondscum, Marshmallow Toad, Fen, Mire, Sludge, Muckle, Gumbo, Bayou Bill, Cypress, Spanish Moss,
      Dragonfly, Mayfly, Skeeter, Gnat Snatcher, Tongue Twister, Flycatcher, Leapfrog, Tadpole, Polliwog, Spawn,
      Newt, Eft, Axolotl, Mudskipper, Salamandra, Gecko, Iguana, Skink, Basilisk, Chameleon, Komodo, Monitor,
      Scaly, Coldblood, Sunbask, Bogtrotter, Quagmire, Morass, Slough, Sump, Ooze, Grimy, Slick, Dank, Moldy, Squelch,
      Goober, Bulging Eyes, Puffcheek, Throatsac, Hopscotch Toad, Jumpy, Springer, Bouncer, Lily, Duckweed, Reedy,
      Cattail Cal, Bog Myrtle, Peat, Moor, Heath, Nettle Toad, Hemlock, Bladderwort, Sundew, Pitcher, Venus,
      Wartface, Knobbly, Lumpy, Bumpy, Gnarly, Slimeball, Glop, Splat, Plop, Sploosh, Dribble, Drool, Gurgle, Burble,
      Blub, Bubble, Froglet, Toady,           Bogsworth, Croaksley, Lilyhopper, Murkwater,
    `)
  },
  {
    id: "pirate",
    names: list(`
      Barnaby Bilge, Saltbeard, One Eyed Wren, Peg Leg Pip, Scurvy Sam, Bosun Brine, Cutlass Kate, Mad Mollie,
      Gunwale Gus, Hook Hand Hal, Rumbelly, Plank Walker, Davy Drench, Squid Ink, Kraken Kev, Bilgewater, Driftwood Dan,
      Sea Dog Sid, Mister Mizzen, Captain Keel, First Mate Flint, Powder Monkey, Grog Barrel, Jolly Jim,       Red Molly, Salty Sue, Barnacle Betty, Anchor Annie, Chum Bucket, Ship Rat, Cannonball, Swabbie, Deckhand Dill,
      Crows Nest, Lookout Lou, Mainsail, Topsail, Jib, Spanker, Rudder, Tiller, Bowsprit, Figurehead, Doubloon,
      Piece of Eight, Treasure Tom, Gold Tooth, Silver Earring, Parrot Pete, Polly Cracker, Short Fuse,
      Gunpowder Gail, Blunderbuss, Musket Mo, Flintlock, Scallywag, Bilge Rat, Landlubber, Matey, Shiver, Timbers,
      Avast, Ahoy Annie, Yo Ho, Plunderpuss, Looter, Buccaneer Bea, Corsair Cora, Privateer, Marooner, Castaway,
      Tidewater, Riptide, Undertow, Maelstrom, Squall, Gale Force, Hurricane Hank, Typhoon, Seasalt, Brine Barrel,
      Kelpie, Coral Reef, Shipwreck, Sunken Sal, Davy Down, Cap'n Crab, Crabclaw, Lobster Larry, Eelbite,       Stingray, Starboard, Portside, Hardtack, Weevil, Sea Shanty,
      Barrelhouse Bess, Rope Burn, Seasick Sid, Keelhaul Kit, Bilgebottom, Rum Runner Ron, Gangplank Gil,
    `)
  },
  {
    id: "knight",
    names: list(`
      Sir Brambleton, Sir Oakheart, Dame Ironwood, Sir Tinsley, Lady Gauntlet, Sir Cuthbert Plume, Squire Pip, Sir Wendel,
      Dame Hollin, Sir Fernwick, Lord Ashby, Sir Bertrand, Sir Roderick, Sir Godfrey Hale,
      Dame Rowena, Sir Edmund Vale, Sir Percy Plum, Lady Marigold, Sir Aldous, Sir Barnabus, Dame Beatrix, Sir Cedric,
      Dame Clementine, Sir Dunstan, Dame Edith, Sir Fulke, Dame Gwenna, Sir Humphrey, Dame Ingrid, Sir Jasper,
      Dame Katarina, Dame Mathilda, Sir Neville, Dame Odette, Dame Philippa, Sir Quentin,
      Dame Rosamund, Sir Sigmund, Dame Tamsin, Sir Ulric, Dame Verity, Sir Wilfred, Dame Winifred,       Sir Mortimer, Lord Hawksley, Baron Brackenridge, Duke Dunhollow, Earl Elmstead, Count Crestwood,       Squire Tumbleby, Squire Nettles, Squire Hob, Page Perrin, Herald Hugo, Lord Longsword, Sir Shieldsworth,
      Sir Helmsley, Sir Visor, Sir Chainmail, Sir Lanceford, Sir Banner, Sir Gallop, Dame Saddle, Sir Joust, Sir Tilt,
      Sir Pennant, Sir Rampart, Sir Portcullis, Sir Turret, Sir Moatsby, Sir Drawbridge, Sir Battlement, King Crumpet,
      Prince Peregrine, Princess Primrose, Lord Thistlewood, Sir Barleycorn, Sir Mead, Sir Pottage,
      Sir Tankard, Sir Trencher, Dame Hearth, Sir Hedge, Sir Furrow, Sir Wheatley, Sir Bracken,
      Sir Gorse, Sir Heather, Sir Thornbury, Sir Redwick, Sir Graymane,
      Sir Puddingstone, Dame Brightshield, Sir Clanksworth, Sir Ironsides, Dame Larkmoor, Sir Ploddington, Sir Beaverbrook, Squire Dimble, Lady Ashcombe, Sir Crumbleton, Dame Featherhelm, Sir Gallantry, Sir Dewberry,
    `)
  },
  {
    id: "ninja",
    names: list(`
      Kage, Hayate, Kaze, Kumori, Yoru, Tsuki, Hoshi, Kasumi, Shizuka, Kiri, Hibana, Tora,       Kitsune, Tanuki, Fukuro, Karasu, Suzume, Tsubame, Hebi, Kumo, Kamome, Kamakiri, Inazuma, Arashi, Fubuki,
      Yuki Kage, Hanabi, Sakura Blade, Momiji, Kaede, Matsu, Take, Ume, Sumi, Ishi, Iwa, Kawa, Umi Kaze, Nami,
      Hotaru, Semi, Kani, Tako, Ika, Saba, Iwashi, Unagi, Masu, Koi, Silent Step, Quiet Fox, Paper Lantern,
      Bamboo Shadow, Folded Crane, Ink Brush, Smoke Bomb, Throwing Star, Rooftop Runner, Night Blossom, Still Water,
      Falling Leaf, Hidden Moon, Swift Reed, Iron Fan, Silk Cord, Grey Heron, Mountain Mist, River Stone, Cold Dawn,
      Red Lantern, Jade Fang, Lotus Edge, Plum Rain, Pine Needle, Tiger Lily, Crane Wing, Old Master Ume,
      Sensei Kobu, Kenji Mura, Taro Kiba, Jiro Sake, Saburo Nobe, Shiro Kuro, Goro Hana, Rokuro, Hachiro,
      Kuro Neko, Shiro Usagi, Midori, Aoi, Akane, Kogane, Gin, Tetsu, Hagane,
      Kaminari, Shinobu Kaze, Yamikawa, Tobikage, Kurokumo, Hisame, Tsukikage, Mizuhara Ko,
    `)
  },
  {
    id: "wizard",
    names: list(`
      Wizzlewick, Old Mumblebeard, Mother Cauldron, Granny Toadwort, Professor Pocus, Hocus, Brewster, Sparkleby,
      Fizzlewit, Mystic Mabel, Grimoire, Thaddeus Quill, Morwenna, Eldritch Ed, Spellbinder, Runecaster, Hexley,
      Madame Mandrake, Wartnose, Crookstaff, Starcloak, Moonhat, Sir Sparks, Abracadabra, Prestidigitus, Zappo,
      Cobweb, Nightcap, Wormwood, Henbane, Belladonna, Foxglove, Mugwort, Hyssop, Rue, Sage, Thyme, Rosemary,
      Bramblewitch, Broomstick Betty, Cackling Cass, Old Nell Nettles, Auntie Augury, Crystal Clara, Tea Leaf Tilly,
      Bubble And Toil, Potion Pete, Elixir Ellie, Philtre Phil, Tincture, Draught, Simmer, Stir Stir, Ladle,
      Eye of Newt, Toe of Frog, Batwing, Owl Feather, Raven Quill, Dragon Scale, Unicorn Hair, Phoenix Ash, Moonstone,
      Starglass, Sunpowder, Moondust, Comet Tail, Nebula, Aurora, Twilight, Gloaming, Solstice, Equinox, Zenith,
      Alchemy Al, Brimstone, Cinnabar, Orpiment, Vitriol, Wizbert, Spindleshanks,
      Hobnail, Pointy Hat, Long Sleeves, Robe Trailer, Staff Bearer, Orb Gazer, Scroll Keeper, Tome Hoarder,
      Candle Wax, Wand Waver, Familiar,
      Sparkwhistle, Gloomcap, Wanda Wobblewand, Old Spellsby, Hatpin Hattie, Mistwhisper, Cauldron Kate, Twinkleby, Bramble Hex, Owlbert, Fogwell,
    `)
  },
  {
    id: "barbarian",
    names: list(`
      Grumak, Bonebreaker, Axel Hewn, Skullsplit, Ragnhild, Borga, Hruff, Ironjaw, Stonefist, Bloodmane,
      Wartusk, Gorehowl, Bearhug, Hammerhand, Battlecry, Warpaint, Shieldbiter, Mountainback, Rockjaw, Thunderthighs,
      Boulderbrow, Cragg, Flintface, Grunhilda, Helga Hornhelm, Ingvar, Jorund, Kolbrun, Leif Loudmouth, Magnar,
      Orm, Rolf Redbeard, Sigrid, Torvald, Ulla, Vigdis, Yngvar, Agnar, Brynja, Dagny, Eirik Axe,       Gunnar Gruff, Ketil, Ljot, Mord, Odd, Thorgrim, Ulf, Vali,
      Asha Ember, Kofi Spear, Nala Storm, Zuri Flame, Imani Shield, Tendai, Zola Dust, Baraka, Amara Ash,
      Sefu, Chidi Thunder, Mosi, Kamau, Nia Bright, Femi, Ayo Strong, Kito, Zawadi, Tau Lion, Ndidi, Obi Stone,
      Big Mug, Meat Shield, Loincloth Larry, Shirtless Steve, Furboots, Hornhat, Bonenecklace, Mead Hall, Feast,
      Bellow, Roar, Stomp, Smash, Crush, Bash, Thump, Wallop, Clobber, Pummel, Brute, Brawn, Muscles Mcgee,
      Grimbold, Axehilda, Thundergut, Bonegrinder, Mammoth Mo, Ironbrow, Stonehilda, Wolfhide, Bigsby Brawn, Grogbeard, Tusker,
    `)
  },
  {
    id: "undead",
    names: list(`
      Moaner, Gnawbone, Rotgut, Sir Rattlebones, Mister Marrow, Calcium, Femur, Tibia, Fibula, Ulna, Radius, Patella,
      Clavicle, Sternum, Vertebra, Skully, Jawbone, Knucklebones, Ribcage, Bonita, Boneyard, Grave Dan,
      Tombstone, Headstone, Mausoleum, Ossuary, Catacomb, Coffin Carl, Casket, Shroud, Wormfood,
      Maggot, Grubby, Mouldy, Mildewy, Fester, Pustule, Oozy, Drippy, Stumbles, Lurchy, Slouch, Drag,
      Limp, Hobble, Totter, Teeter, Wobbly, Floppy, Saggy, Droopy, Gloopy, Rot, Decay, Blight, Wither, Wilt, Mortimer,
      Ghastly, Gruesome, Grisly, Gristly, Brainless, Cranium, Noggin, Bonehead, Numbskull,
      Deadeye, Deadbolt, Deadwood, Dead Ned, Late Larry, Former Fred, Ex Ted, Undying Ian, Rising Rita, Gravedigger,
      Spade, Shovel, Pickaxe, Lantern Larry, Midnight Moe, Full Moon Phil, Howl, Groan, Grunt Grunt, Ugh, Urrgh,
      Mrrrh, Arms Out, Shuffle, Sir Shamble,
      Clatterbones, Rotsworth, Graveyard Gus, Sir Crumbleskull, Lady Lurchington, Shufflefoot, Moldersby, Ribsy, Cadaver Cal, Gnasher, Tombsy,
    `)
  },
  {
    id: "spooky",
    names: list(`
      Jack O Grin, Candlewick, Hollowgourd, Cackles, Mister Grins, Funhouse, Big Top,       Honk Honk, Squeaky Shoes, Greasepaint, Ringmaster Rot, Count Fangsley, Lady Nocturne, Baron Batsworth, Duke Dusk,
      Madame Midnight, Crimson Cape, Coffin Nails, Sanguine, Velvet Fang, Mister Nightly,
      Gloomsbury, Dreadmore, Shiverly, Creepwell, Spookums, Ghostly Gail, Phantom Phil, Wraith, Spectre,
      Poltergeist Pam, Banshee Bea, Ghoul, Goblin Moon, Bogeyman, Night Terror, Bump In Night, Under The Bed,
      In The Closet, Attic Annie, Cellar Sid, Basement Bob, Creaky Floor, Squeaky Door, Cobweb Carl, Dusty Sheet,
      Chandelier, Candelabra, Grandfather Clock, Portrait Eyes, Mirror Mary, Crow, Bat, Spider, Moth, Rat,
      Toad Witch, Hemlock Hank, Nightshade Nell, Mandrake Mo, Gourd, Squash, Turnip Head,       Hayseed, Strawman, Crowbait, Tentacle Ted, Slime Lord, Goo, Glorp, Squelchy, Mutant Mike, Lab Rat,
      Specimen Six, Vat Grown, Formaldehyde, Jar Brain, Stitches, Bolts, Hunchback Hal, Fog, Mist,
      Murk Mire, Gloaming Grin, Witching Hour, Hallows, Trick, Treat,
      Creepers, Shadowgrin, Hollowcackle, Gourdon, Fangsworth, Lady Gloom, Grinsley, Wretch, Nightgrin Ned, Shriek, Gibber, Skulkington, Bonechill, Murkwood Moe, Dreadful Dot,
    `)
  },
  {
    id: "robot",
    names: list(`
      Clanker, Beep Boop, Gearbox, Servo, Piston, Widget, Gadget, Doohickey, Thingamabob, Gizmotron,
      Rivet, Bolt Bot, Nuts N Bolts, Ratchet Bot, Spanner, Wrench, Torque, Sprocket Bot, Flywheel, Crankshaft,
      Camshaft, Carburetor, Spark Plug, Fuse, Circuit, Diode, Transistor, Capacitor, Resistor, Relay, Solenoid,
      Actuator, Motherboard, Microchip, Byte, Nibble, Kilobyte, Megabyte, Pixel, Vector, Bitmap, Cursor, Mousepad,
      Keyboard, Joystick, Floppy, Cassette, Dial Up, Modem, Router, Toaster, Blender, Vacuum, Dishwasher, Mixer,
      Kettle Bot, Microwave, Fridge, Mopbot, Sweeper, Dustpan, Unit Alpha, Unit Beta,
      Unit Gamma, Unit Delta, Unit Omega, Model Tee, Prototype, Beta Build, Firmware, Patch Notes, Reboot, Shutdown,
      Standby, Low Battery, Overclock, Underclock, Heatsink, Coolant, Oilcan, Rustbelt, Chrome Dome,
      Steel Sally, Iron Ike, Copper Kid, Brass Knuckles, Titanium Ty, Alloy, Magnet, Laser, Sonar, Radar, Lidar,
      Gyro, Rotor, Hydraulic, Pneumatic, Clunk, Whirr, Bleep, Bloop, Zap, Ping,
    `)
  },
  {
    id: "alien",
    names: list(`
      Zorbo, Glixx, Xyloth, Quorp, Blinx, Zarnak, Vrell, Ooblek, Krix, Pleeb, Zeeble, Nebbo, Gloonix, Tharx, Zibzab,
      Wubbo, Yorrik, Qwex, Skreel, Vexxo, Bloopus, Gorbix, Ploonk, Zentar, Xibbit, Quazz,       Zip Zop, Meep, Morp, Glorbo, Snarfle, Floob, Gleep, Zorp, Blip Blip, Probe, Abductor, Saucer Sid, Mothership,
      Tractor Beam, Crop Circle, Little Green, Big Grey, Area Fifty, Stargazer, Comet, Asteroid,
      Meteor, Quasar, Pulsar, Nova Nix, Supernova, Galaxy, Cosmo, Astro, Orbit, Lunar, Solar, Stellar, Nebula Ned,
      Void, Wormhole, Warp, Hyperdrive, Parsec, Antenna, Tentacles, Three Eyes, Big Head, Green Gary,
      Purple Pat, Blue Blip, Glowstick, Neon, Plasma Pete, Ray Gun, Zapper, Blaster, Ionizer, Anomaly,
      Specimen, Outsider, Stranger, Newcomer, Earthling Fan, Tourist, Ambassador Zed, Envoy Ix, Observer,
      Scanner, Sample Taker, Mind Reader,
      Zooble, Plixx, Grommox, Quibbix, Xandle, Vorbit, Snorg, Blerp, Ziggorath, Plorx, Yumbo,
    `)
  },
  {
    id: "goblin",
    names: list(`
      Snaggletooth, Grubnik, Nixit, Skrag, Ratbag, Grizz, Mugwort Gob, Fungus, Mushroom Mo, Toadstool Tim,
      Wartnik, Bogey, Snizzle, Gnarl, Krunk, Zogg, Snik, Nikk, Pikk, Skab, Scab, Scrabble, Gribble, Grizzle,
      Drizzle, Muck, Mucky, Grubby Gob, Sneaky Pete, Pickpocket, Cutpurse, Shiv, Stabby, Pokey, Jabby, Slashy, Hacky,
      Bitey, Nippy, Snappy, Twitchy, Greasy, Grimy Gob, Oily, Stinky, Smelly,
      Whiffy, Reeky, Rancid, Rotten Ron, Mouldy Mo, Crusty, Flaky, Scaly Gob, Lumpy Gob, Knobbly Gob,
      Warty Gob, Bumpy Gob, Gnashy, Toothy, Fangy, Ears, Big Nose, Long Ears, Pointy, Spiky, Prickly, Thorny,
      Bramble Gob, Nettle Gob, Thistle Gob, Burr, Briar, Gorse Gob, Hob Gob, Hobnob, Nobgob, Gobsmack, Gobstopper,
      Gobble, Gobbet, Impy, Puglin Pal, Pug, Snub, Squat, Runt, Tiddler, Nipper, Sprog,
      Grizzletooth, Nibnab, Skulch, Gnashbog, Snickerblade, Mudgob, Greb, Pilchard Gob, Rotnose, Scrump, Fizzgob, Wonkle, Nettlenose,
    `)
  },
  {
    id: "cowboy",
    names: list(`
      Dusty Boots, Tumbleweed Tex, Sagebrush Sam, Rattlesnake Ray, Lasso Lou, Spurs, Saddlebag, Buckaroo Bill,
      Bronco Bess, Mustang Mae, Stallion, Pinto Pete, Palomino, Appaloosa, Rawhide, Chaps, Stetson Steve, Ten Gallon,
      Bandana Bill, Hitching Post, Water Trough, Prickly Pear, Mesquite, Yucca, Coyote Cal, Jackrabbit,
      Roadrunner Ron, Vulture Vic, Gila Gus, Scorpion Sue, Sidewinder, Diamondback, Desert Rose, Canyon Kate,
      Mesa Mike, Butte, Gulch, Arroyo, Bluff, Ridge Rider, Trail Boss, Cattle Kate, Wrangler, Rustler Ruth, Drover,
      Ranch Hand Hank, Chuckwagon Charlie, Beans N Bacon, Coffee Pot, Campfire, Harmonica Hal, Banjo Bob, Fiddle Fred,
      Saloon Sal, Swinging Doors, Whiskey Wil, Sarsaparilla, Poker Face, Ace High, Full House,       Quickdraw, Sixgun Sadie, Two Gun Tilly, Long Rifle, Buckshot, Iron Horse, Stagecoach,
      Pony Express, Gold Rush, Prospector Pat, Nugget Ned, Panhandler, Sluice, Claim Jumper, Boomtown, Ghost Town,
      High Noon, Sundown Sid, Dust Devil, Dry Gulch, Lonesome Lee, Drifter Dan, Wanted Wes, Bounty, Sheriff Shaw,
      Marshal Mae, Posse, Outlaw Ollie, Bandito, Desperado Dee, Hombre,
      Saddlesore Sam, Dustbowl Dot, Mule Kick, Rope Trick, Canteen Cal, Spittoon, Horseshoe Hank, Prairie Prue, Cattle Drive, Sunrise Sue, Brandin Iron, Tin Star,
    `)
  },
  {
    id: "gangster",
    names: list(`
      Fingers Mulgrew, Two Bits, Knuckles Nolan, Slick Vinnie, Pinstripe Pete, Fedora Fran, Tommy Gunn, Big Sal,
      Little Sal, Lucky Lenny, Sly Sully, Smiles Moretti, Bootleg Bill, Speakeasy Sue, Moonshine Mo,
      Bathtub Gin, Rumrunner, Nickels, Dimes, Quarters, Greenback, Moolah, Dough, Bread, Clams, Lettuce, Cabbage,
      Spondulix, Racketeer, Bookie Bo, Numbers Ned, Ledger Lou, Shakedown, Muscle, Enforcer Ed, Lookout Lucy,
      Wheelman Wally, Getaway Gus, Safecracker Sam, Locksmith Lil, Forger Fred, Counterfeit Carl, Con Man Connie,
      Grifter Greg, Hustler Hank, Shill, Mark, Patsy, Fall Guy, Stoolie, Rat Finkley, Canary, Songbird, Snitch,
      Gumshoe, Flatfoot, Bullseye Bert, Stiletto Stella, Velvet Glove, Silk Tie, Spats, Cufflinks,
      Tie Pin, Pocket Watch, Cigar, Smoke Ring, Ashtray, Jazz Hands, Trumpet, Saxophone Sid, Torch Singer,
      Flapper Flo, Charleston, Foxtrot, Tango Tony, Ritzy, Swanky, Glitzy, Ritz, Gilded, Velvet Rope, Back Room,
      Card Shark, High Roller, Low Roller, Big Shot, Hot Shot, Top Hat, Bowler, Boater, Homburg, Trilby, Newsboy,
      Ledger Lenny, Double Cross, Crooked Carl, Pinky Ring, Wiseguy, Tailcoat, Slippery Sal, Backroom Bertie, Velvet Voice, Racket Ricky,
    `)
  },
  {
    id: "townsfolk",
    names: list(`
      Uncle Moe, Auntie Pearl, Grandma Fig, Grandpa Gus, Milkman Mel, Baker Bea, Butcher Bob,
      Candlestick Carl, Plumber Pete, Janitor Jan, Mechanic Mo, Barista Bo, Cashier Cass, Waiter Walt, Busboy Benny,
      Line Cook Lou, Sous Chef Sid, Dishwasher Di, Delivery Dee, Courier Kit, Paperboy Paul, Crossing Guard,
      Lollipop Lady, Librarian Lin, Teacher Tess, Principal Pam, Coach Carl, Referee Ray, Umpire Ugo, Lifeguard Lu,
      Park Ranger Pip, Gardener Gil, Florist Flo, Grocer Greg, Tailor Tom, Cobbler Cal, Barber Barry, Hairdresser Hal,
      Dentist Dot, Vet Vic, Pharmacist Phil, Optician Opal, Locksmith Len, Electrician Eli, Carpenter Cam, Roofer Rue,
      Painter Pia, Tiler Ty, Glazier Gwen, Welder Wes, Trucker Tex, Cabbie Cole, Bus Driver Bea, Conductor Con,
      Pilot Pru, Sailor Sal, Fisher Finn, Farmer Fen, Shepherd Shay, Beekeeper Bee, Miller Mae, Brewer Bram,
      Vintner Vin, Cheesemaker Ches, Potter Pott, Weaver Wynn, Knitter Nan, Quilter Quinn, Juggler Jo, Mime Mim,
      Busker Buzz, Magician Mags, Clown Around, Accountant Al, Clerk Clem, Notary Ned, Banker Bern, Realtor Rhea,
      Influencer Izzy, Podcaster Pod, Gamer Gail, Streamer Stan, Tourist Tilly, Retiree Rex, Neighbour Ned, Mayor May,
      Town Crier, Night Watch, Dog Walker, Cat Sitter, Snow Shoveller, Leaf Raker, Lawn Mower, Handyman Hap,
      Auntie Agatha, Cousin Clem, Granny Gumdrop, Neighbour Nell, Old Man Oakes, Uncle Ernie, Paper Route Pat, Lunch Lady Lou, Bingo Barb, Allotment Al,
    `)
  },
  {
    id: "myth",
    names: list(`
      Anubiscuit, Ra Ra, Sobekky, Horace Horus, Thothy, Bastet Belle, Setto, Khonsu Koo, Ptahbert,
      Hathorsome, Sekhmetty, Nephthys Nell, Scarabeus, Sphinxley, Pharaoh Phil, Mummy Mo, Wrappings,
      Papyrus, Hieroglyph, Obelisk, Pyramid Pete, Sarcophagus, Canopic, Ankh, Sun Disc, Jackal Jack, Ibis, Falcon,
      Father Frost, Old Saint Snow, Yule Log, Mistletoe, Holly King, Ivy Queen, Jingle, Tinsel Toes, Sleigh Bell,
      Stocking, Chimney Sweep, Snowflake, Frostbite, Icicle, Reindeer Rex, Antler, Sugarplum, Gingerbread, Candy Cane,
      Eggnog, Fruitcake, Plum Pudding, Mince Pie, Roast Chestnut, Wassail, Carol, Noel,       Thunder Lord, Storm Bringer, Sky Father, Sea Mother, Earth Shaker, Fire Keeper, Moon Weaver, Sun Strider,
      Star Herder, Dawn Bringer, Dusk Warden, Starlit Mother, Day Father, Harvest Lord, Rain Maker, Wind Caller,
      Oak Father, River Queen, Mountain King, Cave Mother, Hearth Spirit, Trickster Fox, Raven Spirit, Coyote Spirit,
      Spider Spirit, Hare Spirit, Turtle Spirit, Bear Spirit, Wolf Spirit, Owl Spirit, Elk Spirit, Salmon Spirit,
      Whale Spirit, Crane Spirit, Dragon Spirit, Lion Spirit,
      Sun Hare, Moon Toad, Star Whale, Cloud Shepherd, Thunder Bird, Frost Giant, Sea Serpent, Fire Drake, Hearth Mother, Stone Giant, Sky Whale, Dream Spinner,
    `)
  }
];
const NAMES_BY_ID = new Map(LISTS.map((t) => [t.id, t.names]));
const NAME_THEMES = NAME_THEME_INFO.map((t) => ({ ...t, names: NAMES_BY_ID.get(t.id) ?? [] }));
const THEMES_BY_ID = new Map(NAME_THEMES.map((t) => [t.id, t]));
const nameTheme = (id) => id && nameThemeInfo(id) ? THEMES_BY_ID.get(id) : void 0;
function botNameFor(look, taken, offset = 0) {
  const own = builtInLook(look)?.name;
  if (own && !taken(own)) return own;
  const theme = nameTheme(lookTheme(look) ?? void 0);
  if (theme) {
    const n = theme.names.length;
    const start = (offset % n + n) % n;
    for (let i = 0; i < n; i++) {
      const name = theme.names[(start + i) % n];
      if (!taken(name)) return name;
    }
  }
  for (const name of BOT_NAMES) if (!taken(name)) return name;
  for (let round = 2; ; round++) for (const base of BOT_NAMES) if (!taken(`${base} ${round}`)) return `${base} ${round}`;
}
const MAX_INPUTS_PER_TICK = 2;
const SPOT_GROUND = { x: 0.8, y: 1.6, z: 0.8 };
const SQUAD_ALERT = 45;
const MAX_QUEUED_INPUTS = 32;
const DEFAULT_HITBOX = lookHitbox(DEFAULT_LOOK);
const MAX_REWIND_TICKS = 18;
const HISTORY_TICKS = MAX_REWIND_TICKS + 2;
const OWNER_GRACE_TICKS = 8;
const DEALT_KEEP_TICKS = 8;
const DISC_DROP_REACH = 40;
const DISC_LIE_SECONDS = 15;
const DISC_PICKUP_DELAY = 0.4;
function lyingItem(p) {
  return getItem(`core.weapon_${p.weapon.replace(/^core\./, "")}`);
}
const START_WAIT_SECONDS = 30;
const COUNTDOWN_SECONDS = 3;
const RAM_MIN_SPEED = 5;
const DEFAULT_IDLE_BRAKE = 10;
const EXIT_STEP_DOWN = 2;
const TURRET_ON_AIM = 0.05;
const ROUTE_FIT = 0.95;
const RAM_DAMAGE = 8;
const SENTRY_VIEW_BASE = 1e6;
const WEDGE_STEP = 0.01;
const WEDGE_TICKS = 180;
const WEDGE_FREED = 3;
const CLIMB_ASSIST_TICKS = 30;
const LUNAR_BLAST_KNOCK = 10;
const MAX_ZONES = 48;
const NAV_REBUILD_MAX_AREA = 22500;
const MAX_COVERS = 16;
const BURN_DPS = 12;
const POISON_DPS = 9;
const FIRE_ZONE_DPS = 14;
const FROZEN_TICKS = Math.round(TICK_RATE * 1.4);
const r3 = (v) => Math.round(v * 1e3) / 1e3;
function arcFlags(m) {
  const st = m.arc;
  const arc = m.def.sentry?.arc;
  if (!arc || st.target === null || st.vent > 0) return 0;
  return st.charge < Math.round(arc.windUpSeconds * TICK_RATE) ? MOUNT_FLAG_CHARGING : MOUNT_FLAG_ARC;
}
const LOOK_STEER_GAIN = 2.2;
const VEHICLE_SKIN = 0.02;
const SUSPENSION_RAY_BUDGET = 96;
const tuple = (v) => [r3(v.x), r3(v.y), r3(v.z)];
const CHEST = PLAYER.height * 0.55;
const chest = (p) => ({ x: p.x, y: p.y + CHEST, z: p.z });
const heldWeapon = (c) => c.weapons.get(c.current);
class Match {
  /** Requires initPhysics() and initNavigation() to have resolved. */
  constructor(map, rules = DEFAULT_DEATHMATCH_RULES, seed = 1, opts = {}) {
    this.map = map;
    this.rules = rules;
    this.seed = seed;
    this.opts = opts;
    this.geometry = buildMapGeometry(map);
    this.killY = mapKillY(this.geometry, map);
    this.phys = matchPhysics(rules, map);
    this.envShapes = environmentShapes(map);
    this.physics = new PhysicsWorld(this.geometry, mapTerrainMesh(map), this.envShapes);
    this.sight = new SightCache(this.physics);
    this.nav = buildMapNav(map, this.geometry, this.physics, this.envShapes, this.phys);
    this.rng = createRng(seed);
    this.spawnPoints = map.entities.filter((e) => e.kind === "spawn").map((e) => ({ pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, yaw: e.yaw, team: e.faction }));
    this.pickups = [];
    for (const e of map.entities) {
      if (e.kind !== "pickup") continue;
      const item = getItem(e.item);
      if (!item) continue;
      if (isAmmoBoxPickup(e)) {
        if (!restrictedWeapons(rules)) this.addBox("placed", { x: e.position[0], y: e.position[1], z: e.position[2] }, 0, null, e.id, Math.round(Math.max(item.respawnSeconds, e.respawnSeconds ?? 0, 20) * TICK_RATE));
        continue;
      }
      const p = { id: e.id, item, placed: item, pool: null, rolls: 0, entity: { item: e.item, random: e.random, keepFixed: e.keepFixed }, pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, respawnTicks: Math.round((e.respawnSeconds ?? item.respawnSeconds) * TICK_RATE), availableAt: 0, enabled: true };
      this.pickups.push(p);
      this.repool(p);
    }
    for (const e of map.entities) {
      if (e.kind !== "prop") continue;
      const env = getEnvSpecies(e.model);
      if (env) {
        if (env.conceals) this.hides.push({ x: e.position[0], z: e.position[2], r: env.conceals.radius * e.scale, y0: e.position[1] - 0.3, y1: e.position[1] + env.conceals.height * e.scale });
        continue;
      }
      const def = getProp(e.model);
      if (!def?.conceals) continue;
      this.hides.push({ x: e.position[0], z: e.position[2], r: Math.min(def.size[0], def.size[2]) * e.scale / 2, y0: e.position[1] - 0.3, y1: e.position[1] + def.size[1] * e.scale });
    }
    map.entities.forEach((e, index) => {
      if (e.kind !== "mount") return;
      const def = getMountDef(e.model);
      if (def) this.addMount(index, def, { x: e.position[0], y: e.position[1], z: e.position[2] }, e.yaw, e.faction, e.respawnSeconds, !!e.onWater && !!def.vehicle);
    });
    this.road = trackGeometry(map);
    this.guides = vehicleGuides(map.paths);
    if (this.road) {
      const base = map.entities.length;
      for (const [i, car] of ambientCarEntities(map).entries()) {
        const def = getMountDef(car.entity.model);
        if (!def) continue;
        const index = this.mounts.length;
        this.addMount(base + i, def, { x: car.entity.position[0], y: car.entity.position[1], z: car.entity.position[2] }, car.entity.yaw, null, 12);
        this.mounts[index].home = { pos: { x: car.pit[0], y: car.pit[1], z: car.pit[2] }, yaw: car.pitYaw };
        this.mounts[index].ambient = true;
        this.ambient.push({ mount: index, driver: new TrackDriver((i % 3 - 1) * 0.4, 0.86 + i % 4 * 0.04), stuck: 0 });
      }
    }
    map.entities.forEach((e, index) => {
      if (e.kind !== "airplane") return;
      const route = airRoute(e);
      const pose = routePose(route, 0);
      this.addMount(index, airCraftDef(e.craft), { x: pose.pos.x, y: pose.pos.y, z: pose.pos.z }, pose.yaw, null, null);
      const m = this.mounts[this.mounts.length - 1];
      m.route = route;
      m.airdrop = e.airdrop;
      this.physics.setBoxEnabled(m.body, false);
    });
    this.pads = mapPads(map.entities, rules.lunar ? LUNAR_PAD_BOOST : 1);
    this.ladders = mapLadders(map.entities);
    this.ziplines = mapZiplines(map.entities);
    this.zipRides = this.ziplines.flatMap((z) => ziplineLinks([z], this.physics).map((l) => ({ ...l, ...z.team ? { team: z.team } : {} })));
    this.liquids = mapLiquids(map.entities);
    this.gravityZones = mapGravityZones(map.entities);
    this.phaseEndTick = this.roundEndTick();
    if (opts.startGate) {
      this.phase = "waiting";
      this.phaseEndTick = START_WAIT_SECONDS * TICK_RATE;
    }
    const match = this;
    this.scenario = new Scenario(map, this.physics, {
      get tick() {
        return match.tick;
      },
      players: () => this.combatants().map((c) => ({ slot: c.slot, alive: c.alive, pos: c.move.pos, team: c.faction })),
      actors: () => this.actors().map((c) => ({ slot: c.slot, alive: c.alive, pos: c.move.pos, team: c.faction })),
      teamOf: (slot) => this.actor(slot)?.faction ?? null,
      hurt: (slot, amount, weapon) => {
        const c = this.actor(slot);
        if (c) this.damage(c, amount, null, weapon);
      },
      push: (slot, dir, speed) => {
        const c = this.actor(slot);
        if (c?.alive) this.push(c, dir, speed);
      },
      blast: (at2, radius, damage, edge, owner, weapon) => {
        this.pendingEvents.push({ e: "explode", s: owner ?? -1, p: tuple(at2), r: radius, ...weapon ? { w: weapon } : {} });
        this.splash(at2, radius, damage, edge, owner === null ? null : this.actor(owner) ?? null, weapon, 1, blastKnockback({ splashDamage: damage }));
      },
      endRound: (winner, outcome, next) => this.endRound(winner, outcome, next),
      encounter: (id, op, order) => {
        if (op === "start") this.encounters.start(id);
        else if (op === "stop") this.encounters.stop(id);
        else if (order) this.encounters.setOrder(id, order);
      },
      encounterAlive: (id) => this.encounters.alive(id),
      budgetWarning: (text) => this.budgetWarning(`logic:${text}`, text),
      setPickupEnabled: (id, enabled) => {
        const p = this.pickups.find((q) => q.id === id);
        if (p) p.enabled = enabled;
      },
      emit: (ev) => this.pendingEvents.push(ev)
    });
    this.nav.markOpenings([...this.scenario.openings(), ...this.scenario.surfaces()], this.scenario.openings().length);
    this.nav.markLifts(liftLinks(map));
    this.encounters = new Encounters(map, {
      get tick() {
        return match.tick;
      },
      get nav() {
        return match.nav;
      },
      players: () => this.combatants().filter((c) => c.alive).map((c) => ({ slot: c.slot, pos: c.move.pos })),
      hostiles: (faction) => this.actors().filter((c) => c.alive && relation(this.factions, faction, c.faction) === "enemy").map((c) => ({ id: c.slot, pos: c.move.pos })),
      spawnNpc: (e, role, pos, yaw) => this.spawnNpc(e, role, pos, yaw),
      npc: (id) => {
        const c = this.npcs.get(id);
        return c && { alive: c.alive, pos: c.move.pos, brain: c.bot };
      },
      inShutDoor: (pos) => this.scenario.inShutDoor(pos, PLAYER.radius),
      entityPos: (id) => {
        const e = map.entities.find((x) => x.id === id);
        return e && { x: e.position[0], y: e.position[1], z: e.position[2] };
      },
      fire: (event, target, instigator) => this.scenario.fire(event, target, instigator),
      random: () => this.rng()
    });
    this.mode = this.teams ? createMode(rules.mode, {
      get tick() {
        return match.tick;
      },
      teams: this.teams,
      rules,
      map,
      killY: this.killY,
      combatants: () => this.combatants(),
      emit: (ev) => this.pendingEvents.push(ev),
      endRound: (winner) => winner === void 0 ? this.endRound() : this.endRound(void 0, void 0, void 0, winner),
      hurt: (c, amount, cause) => this.damage(c, amount, null, cause),
      respawn: (c) => {
        this.leaveMount(c, false);
        this.spawn(c);
      },
      groundBelow: (p) => {
        const hit = this.physics.raycastHit(p, { x: 0, y: -1, z: 0 }, 8);
        return hit ? p.y - hit.dist : null;
      },
      deadly: (p) => {
        const l = this.liquids.length ? liquidAt(this.liquids, { x: p.x, y: p.y + 0.3, z: p.z }) : null;
        return !!l && LIQUID_SPECS[l.liquid].dps >= 30;
      },
      path: (a, b) => this.nav.findPath(a, b),
      explode: (at2, radius, damage, by) => {
        this.pendingEvents.push({ e: "explode", s: by?.slot ?? -1, p: tuple(at2), r: radius, w: "core.bomb" });
        this.splash(at2, radius, damage, damage * 0.15, by, "core.bomb", 1, 12);
      },
      physics: this.physics,
      spawnPoints: this.spawnPoints,
      rebuildNav: (extra) => this.rebuildNav(extra)
    }) : null;
    this.zombies = rules.mode === "core.zombies" ? this.zombieDirector() : null;
    this.classes = classesInPlay(rules) ? this.classDirector() : null;
    this.roulette = rouletteOn(rules) ? this.rouletteDirector() : null;
  }
  map;
  rules;
  seed;
  opts;
  geometry;
  /** The map's environment colliders (map/environment.ts): physics and navigation. */
  envShapes;
  /** Falling below this height kills (some way under the lowest floor). */
  killY;
  /** Gravity multiple and fall damage in force (match rules over the map's own). */
  phys;
  physics;
  /** Bots' shared, briefly cached sight lines between actors (see SightCache). */
  sight;
  /** Rebuilt mid-match only by Fort Wars (when the forts are done). */
  nav;
  slots = new Array(MAX_PLAYER_SLOTS).fill(null);
  /** The map's spawn points, then any made up for this match (see ensureSpawnCapacity). */
  spawnPoints;
  pickups;
  /** Weapons dropped by the fallen (rules.dropWeapons, sim/drops.ts), oldest first. */
  drops = [];
  nextDropId = 1;
  /** Doors, buttons, destructibles, zones, traps and the map's logic rules. */
  scenario;
  /** NPC squads spawned by encounter entities. */
  encounters;
  /** The wave director in Zombies (null in every other mode). */
  zombies;
  /** Living and recently dead NPCs by actor ID. */
  npcs = /* @__PURE__ */ new Map();
  nextNpcId = NPC_ID_BASE;
  tick = 0;
  phase = "playing";
  /** Tick when the current phase ends (round time limit or intermission). */
  phaseEndTick;
  pendingEvents = [];
  rng;
  projectiles = [];
  bullets = [];
  zones = [];
  pads;
  /** Foliage to hide in (bushes, ferns, tall crops): footprint centre, radius, base and top. */
  hides = [];
  /** The tick each actor last fired (giving away where they hide). */
  lastShot = /* @__PURE__ */ new Map();
  ladders;
  /** The map's ziplines (zipline.ts): riders' MoveState.zip indexes this. */
  ziplines;
  /** Each zipline's ride as bots see it (its navmesh link's ends) and the team it is for. */
  zipRides;
  liquids;
  /** Low-gravity (or heavy) zones: movement falls by their factor inside. */
  gravityZones;
  mounts = [];
  /** Collider handle -> mount, so shots and blasts can hurt vehicles. */
  mountBodies = /* @__PURE__ */ new Map();
  /** Air drop: who has had this round's start in the plane, and where each bot aboard means to jump (target, last distance). */
  airdropped = /* @__PURE__ */ new Set();
  planeDrops = /* @__PURE__ */ new Map();
  /** The tick each rider was last told they can't jump out here (the hint isn't repeated every tick the key is held). */
  dropHints = /* @__PURE__ */ new Map();
  nextProjectileId = 1;
  covers = [];
  /** Ammo boxes: placed crates and deployed ones (sim/resupply.ts). */
  boxes = [];
  nextBoxId = 1;
  /** Cook-off blasts still to go off: when, where, whose. */
  cookOffs = [];
  /** UAV sweeps running: side (team, or one player in free-for-all) -> tick it ends. */
  uavUntil = /* @__PURE__ */ new Map();
  /** Counter-UAVs running: the jamming side -> tick it ends (everyone else's minimap is jammed). */
  jamUntil = /* @__PURE__ */ new Map();
  nextCoverId = 1;
  /** Positions of everyone at recent ticks, for lag-compensated hitscan. */
  /**
   * Where everyone was over the last HISTORY_TICKS ticks (lag compensation), as a ring: each tick reuses the
   * oldest entry's map and position objects instead of making new ones (they lived just long enough to be
   * promoted out of the young generation, then died: work for the full collections behind the hiccups).
   */
  history = [];
  /** Bot AI time spent in the most recent tick, for instrumentation. */
  lastAiMs = 0;
  /**
   * The in-game bot debug view's frame (`?botdebug=1`, host or offline: bots/debugView.ts), built only when the page
   * asks (a few times a second while the view is on). Player Bots only.
   */
  botDebugFrame() {
    this.botDebug ??= new BotDebugCollector();
    const d = this.director;
    const slots = this.slots;
    const tick = this.tick;
    return this.botDebug.frame({
      tick,
      *bots() {
        for (const c of slots) {
          if (!c?.bot || c.kind !== "bot") continue;
          yield { slot: c.slot, faction: c.faction, pos: c.move.pos, alive: c.alive, brain: c.bot, role: d?.roleOf(c.slot) ?? null, callouts: d && c.faction ? d.calloutsFor(c.faction).recent(tick, TICK_RATE * 3) : [] };
        }
      }
    });
  }
  botDebug = null;
  /**
   * Slots that count as people watching for movement detail (load tests stand
   * bots in for players with it; see relaxedMove).
   */
  watchers = /* @__PURE__ */ new Set();
  /** The movement environment handed to stepMovement, refilled per actor (applyInputs). */
  moveEnv = { liquids: void 0, jet: false, ladders: void 0, scale: 1, gravity: 1, gravityZones: void 0, airJumps: void 0, jetpack: void 0, glider: void 0, autoChute: void 0, ground: void 0, jump: 1, stamina: 1 };
  /** Where the people (and watchers) are this tick, in big matches only (relaxedMove). */
  watched = null;
  /** The cuts buried tunnels make in the ground (groundBore.ts): bots in or over one never move coarsely (relaxedMove). */
  get groundBores() {
    return this.map.terrain ? mapGroundBores(this.map).cuts : NO_BORES;
  }
  /** The terrain's height, for coarse moves (relaxedMove), on maps with terrain. */
  groundFn;
  get groundAt() {
    if (this.groundFn === void 0) {
      const t = this.map.terrain;
      this.groundFn = t ? (x, z) => terrainHeightAt(t, x, z) : null;
    }
    return this.groundFn;
  }
  /** Objective rules (Capture the Flag, King of the Hill, Elimination); null in other modes. */
  mode;
  /** The map's track (its path used as a track, `race`), if it has one: vehicles grip better on the road, and ambient NPC cars lap it. */
  road;
  /** Routes and roads bots driving vehicles follow (bots/guides.ts). */
  guides;
  /** Ambient cars: NPC-driven vehicles lapping the track in any mode (mount index, driver, ticks stuck). */
  ambient = [];
  /** Recent gunfire and explosions, for bots' hearing. */
  noises = [];
  /** Classes (rules.classes): loadouts, abilities and class bots; null without classes. */
  classes;
  /**
   * Roulette (sim/roulette.ts): decks, rolls, picks, tokens, the awards and Lunar's gravity storm, when the match
   * plays it (the Roulette mode, or `rules.roulette` in another).
   */
  roulette;
  /** End-of-match awards and the revenge and nemesis callouts (sim/awards.ts), every mode. */
  awards = new MatchAwards();
  rouletteDirector() {
    const match = this;
    const base = this.phys.gravity;
    return new RouletteDirector({
      seed: this.seed,
      get rules() {
        return match.rules;
      },
      tick: () => match.tick,
      emit: (ev) => match.pendingEvents.push(ev),
      weaponSet: () => match.weaponSet,
      baseGravity: base
    });
  }
  /** Roulette, Swap on kill: `c` becomes `look` at once, keeping its share of health and its weapons. */
  swapLook(c, look) {
    const share = c.maxHealth > 0 ? c.health / c.maxHealth : 1;
    c.look = look;
    this.applyBodySize(c);
    c.health = Math.max(1, Math.round(share * c.maxHealth));
    if (c.bot) c.bot.playAs(this.bodyProfile(c));
    this.pendingEvents.push({ e: "rl", a: "swap", s: c.slot, l: look });
  }
  /**
   * Bots play to their body (docs/BOT_AI_PLAN.md Phase B; Roulette deals a new one every life): the look's own
   * personality, then a small body flanks (a lone wolf that roams wide), a large one pushes (more aggressive, closes in,
   * keeps after its target).
   */
  bodyProfile(c) {
    const base = c.bot.baseProfile;
    const own = profileFor(c.look, base, c.botSet?.style ?? this.rules.botStyle);
    if (c.size < 0.9) return { ...own, aggression: Math.max(0, own.aggression - 10), exploration: Math.min(100, own.exploration + 20), rangePreference: Math.min(100, own.rangePreference + 5), tags: [.../* @__PURE__ */ new Set([...own.tags.filter((t) => t !== "GRUNT" && t !== "BERSERKER"), "LONE_WOLF"])] };
    if (c.size > 1.1) return { ...own, aggression: Math.min(100, own.aggression + 20), pursuitPersistence: Math.min(100, own.pursuitPersistence + 20), riskTolerance: Math.min(100, own.riskTolerance + 15), rangePreference: Math.max(0, own.rangePreference - 20), tags: own.tags.filter((t) => t !== "LONE_WOLF" && t !== "COWARD" && t !== "CAMPER") };
    return own;
  }
  /** A vehicle as a track driver sees it. */
  trackVehicle(m) {
    return { pos: m.pos, yaw: m.yaw, speed: m.speed, maxSpeed: m.def.vehicle?.maxSpeed ?? 0 };
  }
  /** Other vehicles out and about near `m` (for a track driver's overtaking). */
  vehiclesNear(m) {
    const out = [];
    for (const o of this.mounts) if (o !== m && o.alive && o.def.vehicle && Math.abs(o.pos.x - m.pos.x) < 40 && Math.abs(o.pos.z - m.pos.z) < 40) out.push(this.trackVehicle(o));
    return out;
  }
  /**
   * Ambient cars: each one nobody has taken the wheel of drives the track
   * (TrackDriver). One stuck for a while (or lost far off the road) is
   * taken back to the pit lane; wrecked ones come back there on their own.
   */
  driveAmbient(track) {
    for (const a of this.ambient) {
      const m = this.mounts[a.mount];
      if (!m.alive) continue;
      const driverSeat = m.def.seats.findIndex((s) => s.role === "driver");
      if (driverSeat >= 0 && m.seats[driverSeat] !== null) continue;
      const d = a.driver.drive(track, this.trackVehicle(m), this.tick, this.vehiclesNear(m));
      m.drive = { forward: d.forward, right: d.right, brake: d.brake };
      const near2 = track.nearest(m.pos.x, m.pos.z, 100);
      a.stuck = Math.abs(m.speed) < 1 || !near2 || near2.dist > track.width / 2 + 40 ? a.stuck + 1 : 0;
      if (a.stuck > TICK_RATE * 8) {
        a.stuck = 0;
        for (const slot of m.seats) if (slot !== null) this.leaveMount(this.actor(slot), true);
        this.respawnMount(m);
      }
    }
  }
  /** Classes: what the class rules may see and do in the match. */
  classDirector() {
    const match = this;
    return new ClassPlay({
      get tick() {
        return match.tick;
      },
      rules: this.rules,
      get teams() {
        return match.teams;
      },
      combatants: () => this.combatants(),
      hostile: (a, b) => this.hostile(a, b),
      emit: (ev) => this.pendingEvents.push(ev),
      groundBelow: (p) => {
        const hit = this.physics.raycastHit(p, { x: 0, y: -1, z: 0 }, 4);
        return hit ? p.y - hit.dist : null;
      },
      lineOfSight: (a, b) => this.physics.lineOfSight(a, b),
      buildSentry: (c, at2, yaw) => this.buildSentry(c, at2, yaw),
      sentryOf: (slot) => {
        const m = this.mounts.find((x) => x.builtBy === slot && x.alive);
        return m ? m.pos : null;
      },
      removeSentry: (slot) => {
        const m = this.mounts.find((x) => x.builtBy === slot);
        if (m?.alive) {
          m.alive = false;
          m.health = 0;
          m.respawnAt = Infinity;
          this.physics.setBoxEnabled(m.body, false);
          this.physics.commit();
        }
      }
    });
  }
  /**
   * Classes: a Mechanic's sentry, on the floor at `at` facing `yaw`, on their
   * side (credit for its kills is theirs). Each builder has one: building
   * again moves it. False when someone or something is in the way.
   */
  buildSentry(c, at2, yaw) {
    const def = MOUNT_DEFS.sentry;
    const half = { x: def.half[0], y: def.half[1], z: def.half[2] };
    if (!this.physics.headroom({ x: at2.x, y: at2.y + 0.05, z: at2.z }, half.y * 2, Math.max(half.x, half.z))) return false;
    if (this.actors().some((o) => o.alive && horizontalDistance(o.move.pos, at2) < half.x + PLAYER.radius && Math.abs(o.move.pos.y - at2.y) < 1.5)) return false;
    let m = this.mounts.find((x) => x.builtBy === c.slot);
    if (!m) {
      this.addMount(BUILT_MOUNT_BASE + c.slot, def, at2, yaw, c.faction, Infinity);
      m = this.mounts[this.mounts.length - 1];
      m.builtBy = c.slot;
    }
    m.faction = c.faction;
    m.home = { pos: { ...at2 }, yaw };
    this.respawnMount(m);
    this.physics.commit();
    return true;
  }
  /**
   * A fresh navmesh with extra obstacles (Fort Wars forts); bots replan on it.
   * Recast rebuilds the whole mesh, which on big terrain maps takes seconds,
   * so those keep the mesh they have (false).
   */
  rebuildNav(extra) {
    const t = this.map.terrain;
    const xs = this.geometry.filter((b) => b.sourceId !== "ground").flatMap((b) => [b.min[0], b.max[0]]);
    const zs = this.geometry.filter((b) => b.sourceId !== "ground").flatMap((b) => [b.min[2], b.max[2]]);
    if (t) {
      xs.push(t.origin[0], t.origin[0] + (t.cols - 1) * t.spacing);
      zs.push(t.origin[1], t.origin[1] + (t.rows - 1) * t.spacing);
    }
    const area = xs.length ? (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs)) : 0;
    if (area > NAV_REBUILD_MAX_AREA) return false;
    const old = this.nav;
    this.nav = buildMapNav(this.map, this.geometry, this.physics, this.envShapes, this.phys, extra, false);
    old.destroy();
    this.nav.markOpenings([...this.scenario.openings(), ...this.scenario.surfaces()], this.scenario.openings().length);
    this.nav.markLifts(liftLinks(this.map));
    this.nav.places();
    this.sight.clear();
    this.trips = null;
    return true;
  }
  /** Zombies: the horde spawner the director raises zombies through, and its link to the match. */
  zombieDirector() {
    const horde = EncounterEntity.parse({ id: "zombie_horde", kind: "encounter", position: [0, 0, 0], yaw: 0, faction: mapFactions(this.map)[0]?.id ?? "syndicate" });
    let spots = null;
    const match = this;
    return new ZombieSurvival({
      get tick() {
        return match.tick;
      },
      players: () => this.combatants().map((c) => ({ slot: c.slot, alive: c.alive, pos: c.move.pos, eye: { x: c.move.pos.x, y: c.move.pos.y + PLAYER.eyeHeight, z: c.move.pos.z }, bot: c.kind === "bot" })),
      spawnSpots: () => spots ??= [
        // The map's NPC spawners (their vents, hatches and burrows), its spawn points, then open floor all over.
        ...this.map.entities.filter((e) => e.kind === "encounter" || e.kind === "spawn").map((e) => ({ x: e.position[0], y: e.position[1], z: e.position[2] })),
        ...this.nav.places()
      ],
      sees: (a, b) => this.physics.lineOfSight(a, b),
      spawnZombie: (pos, health, speed) => {
        const id = this.spawnNpc(horde, "zombie", pos, this.rng() * Math.PI * 2);
        const c = id === null ? void 0 : this.npcs.get(id);
        if (!c) return null;
        c.health = c.maxHealth = Math.round(c.maxHealth * health);
        c.speedMul *= speed;
        return id;
      },
      zombieAlive: (id) => !!this.npcs.get(id)?.alive,
      revive: (slot) => {
        const c = this.slots[slot];
        if (c && !c.alive) this.spawn(c);
      },
      emit: (ev) => this.pendingEvents.push(ev),
      defeat: () => this.endRound(null, "defeat"),
      random: () => this.rng()
    });
  }
  factionList;
  /** The map's NPC factions (or the default enemy faction), after the teams in Team Deathmatch. */
  get factions() {
    if (!this.factionList) {
      const npc = mapFactions(this.map);
      this.factionList = this.teams ? [...this.teams, ...npc.filter((f) => !this.teams.some((t) => t.id === f.id))] : npc;
    }
    return this.factionList;
  }
  teamList;
  /** The sides in team modes (2–8; Capture the Flag always has two); null in other modes. */
  get teams() {
    if (this.teamList === void 0) this.teamList = isTeamMode(this.rules.mode) ? matchTeams(this.map, this.rules) : null;
    return this.teamList;
  }
  /** Target players per team: the rules' sizes, or even teams. */
  teamTargets() {
    const teams = this.teams ?? [];
    return new Map(teams.map((t, i) => [t.id, this.rules.teamSizes?.[i] ?? 16]));
  }
  /**
   * Faction players join: everyone shares one side in co-op; deathmatch is
   * free-for-all; team modes put each newcomer on the team furthest below its
   * size (as a share of it, so a 12-player team fills alongside 2-player ones).
   */
  get playerFaction() {
    return this.factionFor("bot");
  }
  /**
   * The team a newcomer joins. People follow the rules' team assignment
   * (fixed: the first person to `hostTeam`; random: any team with room);
   * bots, and people under 'balanced', go where playerFaction puts them.
   */
  factionFor(kind) {
    if (this.teams && kind === "human") {
      const assign = this.rules.teamAssign;
      const people = this.combatants().filter((c) => c.kind === "human").length;
      const fixed = this.rules.hostTeam;
      if (assign === "fixed" && people === 0 && fixed !== void 0 && Number.isInteger(fixed) && this.teams[fixed]) return this.teams[fixed].id;
      if (assign === "random") {
        const targets = this.teamTargets();
        const open = this.teams.filter((t) => this.combatants().filter((c) => c.faction === t.id && c.kind === "human").length < targets.get(t.id));
        const pool = open.length ? open : this.teams;
        return pool[Math.min(pool.length - 1, Math.floor(this.rng() * pool.length))].id;
      }
    }
    if (this.teams) {
      const targets = this.teamTargets();
      const count = (id) => this.combatants().filter((c) => c.faction === id).length;
      let best = this.teams[0].id;
      let bestFill = Infinity;
      for (const t of this.teams) {
        const fill = count(t.id) / targets.get(t.id);
        if (fill < bestFill - 1e-9) {
          bestFill = fill;
          best = t.id;
        }
      }
      return best;
    }
    return this.rules.mode === "core.coop" || this.rules.mode === "core.zombies" ? PLAYERS_FACTION : null;
  }
  /** Kills per team in Team Deathmatch; objective modes keep their own score. */
  teamScores() {
    if (this.mode) return this.mode.teamScores();
    const out = new Map((this.teams ?? []).map((t) => [t.id, 0]));
    for (const c of this.combatants()) if (c.faction && out.has(c.faction)) out.set(c.faction, out.get(c.faction) + c.kills);
    for (const [team, n] of this.leaderBounty) if (out.has(team)) out.set(team, out.get(team) + n);
    return out;
  }
  hostility = /* @__PURE__ */ new Map();
  /** Should `a` attack (and be able to hurt) `b`? */
  hostile(a, b) {
    if (a === b) return false;
    if (a.faction === null && b.faction === null) return true;
    if (a.faction === b.faction) return false;
    const key2 = `${a.faction}|${b.faction}`;
    let h = this.hostility.get(key2);
    if (h === void 0) {
      h = relation(this.factions, a.faction, b.faction) === "enemy";
      this.hostility.set(key2, h);
    }
    return h;
  }
  /**
   * Can `a`'s shots, blasts, blades and fire hurt `b`? An enemy always; a teammate (anyone not hostile) only with
   * the match's friendly fire on, and never between NPCs and players (as `damage` rules). Hit tests use this, so with
   * friendly fire on a teammate in the line of fire takes the round (and stops it) instead of letting it through;
   * aiming, homing and bots' choice of target stay on `hostile`.
   */
  canHurt(a, b) {
    if (a === b) return false;
    if (this.hostile(a, b)) return true;
    return (this.rules.friendlyFire ?? "off") !== "off" && !a.npc && !b.npc;
  }
  /** Players and NPCs. */
  actors() {
    return [...this.combatants(), ...this.npcs.values()];
  }
  actor(id) {
    return id >= NPC_ID_BASE ? this.npcs.get(id) : this.slots[id] ?? void 0;
  }
  /** Recent NPC spawn ticks (the per-second and per-minute spawn budgets). */
  npcSpawnTicks = [];
  spawnNpc(e, role, pos, yaw) {
    let alive = 0;
    for (const n of this.npcs.values()) if (n.alive) alive++;
    if (alive >= RESOURCE_BUDGETS.activeNpcs) {
      this.budgetWarning("npcs", `${RESOURCE_BUDGETS.activeNpcs} NPCs alive at once: more wait until some fall`);
      return null;
    }
    const t = this.tick;
    this.npcSpawnTicks = this.npcSpawnTicks.filter((x) => x > t - 60 * TICK_RATE);
    const lastSecond = this.npcSpawnTicks.filter((x) => x > t - TICK_RATE).length;
    if (lastSecond >= RESOURCE_BUDGETS.npcSpawnsPerSecond || this.npcSpawnTicks.length >= RESOURCE_BUDGETS.npcSpawnsPerMinute) {
      this.budgetWarning("npcSpawns", `NPCs spawning faster than ${RESOURCE_BUDGETS.npcSpawnsPerSecond} a second or ${RESOURCE_BUDGETS.npcSpawnsPerMinute} a minute: spawns wait`);
      return null;
    }
    this.npcSpawnTicks.push(t);
    const spec = NPC_ROLE_SPECS[role];
    const id = this.nextNpcId++;
    const def = getWeapon(spec.weapon);
    const npcHit = npcHitbox(role, id);
    const c = {
      ...this.blankCombatant(id, "npc", spec.label),
      faction: e.faction,
      speedMul: spec.speed,
      npc: { encounter: e.id, role, removeAt: Infinity, damage: e.damage ?? 1 },
      move: { pos: { ...pos }, velY: 0, grounded: false },
      yaw,
      health: spec.health * (e.health ?? 1),
      maxHealth: spec.health * (e.health ?? 1),
      size: e.size ?? 1,
      // Hit as drawn: its creature body, its character look or the mannequin, at the role's scale.
      hitbox: npcHit.box,
      hitScale: npcHit.scale,
      alive: true,
      weapons: /* @__PURE__ */ new Map([[weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: def.alt?.max ?? 0 }]]),
      current: weaponCode(def)
    };
    c.bot = new BotBrain(id, NPC_ROLE_PROFILES[role], BOT_DIFFICULTIES[e.difficulty], this.seed);
    c.bot.onSpawn(yaw);
    this.npcs.set(id, c);
    return id;
  }
  blankCombatant(slot, kind, name, team) {
    return {
      slot,
      kind,
      name,
      look: DEFAULT_LOOK,
      faction: kind === "npc" ? null : team !== void 0 ? team : this.factionFor(kind),
      speedMul: 1,
      size: 1,
      hitbox: DEFAULT_HITBOX.box,
      hitLook: DEFAULT_LOOK,
      hitScale: DEFAULT_HITBOX.scale,
      stats: classStats("standard"),
      maxHealth: PLAYER.maxHealth,
      collider: this.physics.createPlayerCollider(),
      move: { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: false },
      yaw: 0,
      pitch: 0,
      health: PLAYER.maxHealth,
      armor: 0,
      alive: false,
      respawnTick: 0,
      kills: 0,
      selfKills: 0,
      objective: 0,
      deaths: 0,
      weapons: /* @__PURE__ */ new Map(),
      current: 0,
      throwable: null,
      fireCooldown: 0,
      meleeCooldown: 0,
      punchedAt: -1e3,
      throwCooldown: 0,
      reloadTicks: 0,
      raiseTicks: 0,
      speedTicks: 0,
      damageTicks: 0,
      prevButtons: 0,
      moveSpeed: 0,
      windup: 0,
      semiLatch: false,
      burstLeft: 0,
      burstTimer: 0,
      bloom: 0,
      gun: newGunState(),
      reload: null,
      burnTicks: 0,
      jetFuel: null,
      breath: 0,
      poisonTicks: 0,
      slowTicks: 0,
      impact: newImpact(),
      chill: 0,
      frozenTicks: 0,
      statusBy: null,
      statusWeapon: "",
      queue: [],
      lastSeq: 0
    };
  }
  removeNpc(id) {
    const c = this.npcs.get(id);
    if (!c) return;
    this.physics.removeCollider(c.collider);
    this.npcs.delete(id);
  }
  roundEndTick() {
    return this.rules.timeLimitSeconds > 0 ? this.tick + this.rules.timeLimitSeconds * TICK_RATE : Infinity;
  }
  combatants() {
    return this.slots.filter((c) => c !== null);
  }
  /** `team`: the faction to join (default: the rules' team assignment). */
  /**
   * MapMaker's Play from here (editor/playFromHere.ts): put a player at a spot now, feet there and facing that way,
   * and start any life before play begins there too (the countdown's). Once play begins, the spawn points again.
   */
  startHere(c, at2) {
    c.startAt = { pos: { ...at2.pos }, yaw: at2.yaw, pitch: at2.pitch };
    if (!c.alive) return;
    this.leaveMount(c, false);
    c.move = { pos: { ...at2.pos }, velY: 0, grounded: false };
    c.yaw = at2.yaw;
    c.pitch = at2.pitch;
  }
  addHuman(name, look, team) {
    const c = this.addCombatant("human", name, team);
    if (c) this.chooseLook(c, validLookId(look));
    return c;
  }
  /**
   * `asCharacter`: play the look's own profile (under the match's bot style) instead of `profile` when it has one.
   * `o`: a bot of the host's bot set: its team (a faction ID), look, and own skill, style and squad.
   */
  addBot(name, profile, difficulty = BOT_DIFFICULTIES.normal, asCharacter = false, o) {
    const team = o?.team !== void 0 && this.teams?.some((t) => t.id === o.team) ? o.team : void 0;
    const c = this.addCombatant("bot", typeof name === "string" ? name : "", team);
    if (c) {
      const own = o?.look ? validLookId(o.look) : this.botLook(c.slot);
      if (typeof name === "function") c.name = name(own);
      this.chooseLook(c, own);
      if (o?.botSet) c.botSet = { ...o.botSet };
      const skill = c.botSet?.skill ? BOT_DIFFICULTIES[c.botSet.skill] : difficulty;
      c.bot = new BotBrain(c.slot, asCharacter ? profileFor(c.ownLook ?? c.look, profile, c.botSet?.style ?? this.rules.botStyle) : profile, skill, this.seed);
      c.bot.onSpawn(c.yaw);
      this.nav.places();
      this.refreshRoles();
    }
    return c;
  }
  /** Every name in the match now: players, bots and spectators (bot naming skips them). */
  namesInUse() {
    return [...this.combatants().map((c) => c.name), ...[...this.spectators.values()].map((s) => s.name)];
  }
  /**
   * Which looks random bots wear (content/botNames.ts): the host's choice (rules.botCast), else the map's
   * (MapDocument.botCast); empty: every look.
   */
  get botCast() {
    return this.rules.botCast ?? validBotCast(this.map.botCast);
  }
  /** A random bot's look for its slot: spread across the looks the bot-characters setting allows (all: the whole roster, as ever). */
  botLook(slot) {
    const cast = this.botCast;
    if (!cast.length) return lookForBot(slot);
    const pool = castLooks(cast);
    return pool[(slot + 1) % pool.length].id;
  }
  /**
   * The bot-characters setting changed mid-match: a random bot (not the host's set's, not playing for an away
   * player) wearing a look it no longer allows wears an allowed one and takes a name for it. Returns how many changed.
   */
  recastBots(name) {
    let n = 0;
    const cast = this.botCast;
    const pool = castLooks(cast);
    for (const c of this.combatants()) {
      if (c.kind !== "bot" || c.away || c.botSet || pool.some((l) => l.id === c.look)) continue;
      c.look = this.botLook(c.slot);
      this.applyBodySize(c);
      c.name = name(c.look, c);
      this.rebrain(c, c.bot.difficulty);
      n++;
    }
    if (n) this.rolesFor = -1;
    return n;
  }
  /**
   * A player joining a running match makes room by removing a Player Bot: the
   * worst-scoring bot (fewest kills less deaths) on the team that most needs a
   * player (fewest people for its size). The player then spawns like anyone
   * else, at a spawn point, never in the bot's place. Null when there is no bot
   * to remove or no free slot after.
   */
  takeOverBot(name, look, party) {
    const all = this.combatants();
    const bots = all.filter((c2) => c2.kind === "bot" && !c2.away);
    if (!bots.length) return null;
    const targets = this.teamTargets();
    const people = (team) => all.filter((c2) => c2.kind === "human" && c2.faction === team).length / (team ? targets.get(team) ?? 1 : 1);
    const score = (c2) => c2.kills - c2.deaths;
    const want = this.teams && this.rules.teamAssign && this.rules.teamAssign !== "balanced" ? this.factionFor("human") : void 0;
    const mine = (c2) => want !== void 0 && c2.faction === want ? 0 : 1;
    const with_ = party ? this.partyTeam(party) : void 0;
    const near2 = (c2) => with_ !== void 0 && c2.faction === with_ ? 0 : 1;
    bots.sort((a, b) => mine(a) - mine(b) || near2(a) - near2(b) || people(a.faction) - people(b.faction) || setRank(a) - setRank(b) || score(a) - score(b) || a.kills - b.kills || b.slot - a.slot);
    const out = bots[0];
    const from = out.name;
    this.botThought.delete(out.slot);
    this.remove(out.slot);
    const c = this.addHuman(name, look, want !== void 0 && out.faction === want ? want : out.faction);
    if (c) {
      if (party) c.party = party;
      this.pendingEvents.push({ e: "takeover", s: c.slot, from, to: name });
    }
    return c;
  }
  /** Free-for-all: the living people (and kept places) of `c`'s party, besides `c` (none: an empty set). */
  partyNear(c) {
    const out = /* @__PURE__ */ new Set();
    for (const o of this.combatants()) if (o !== c && o.alive && o.party === c.party && (o.kind === "human" || o.away)) out.add(o);
    return out;
  }
  /** Team modes: the team most of `party`'s people are on now (ties: the first team), or undefined (none in the match, or no teams). */
  partyTeam(party) {
    if (!this.teams) return void 0;
    const n = /* @__PURE__ */ new Map();
    for (const c of this.combatants()) if (c.party === party && (c.kind === "human" || c.away) && c.faction) n.set(c.faction, (n.get(c.faction) ?? 0) + 1);
    let best;
    for (const t of this.teams) if ((n.get(t.id) ?? 0) > (best === void 0 ? 0 : n.get(best) ?? 0)) best = t.id;
    return best;
  }
  /**
   * Between matches (sim/mapVote.ts): keep the scoreboard up until at least `tick` (the vote, then its winner, before
   * the host travels), so the match doesn't start itself over meanwhile. Never shortens a longer hold.
   */
  holdIntermission(tick) {
    if (this.phase === "intermission") this.phaseEndTick = Math.max(this.phaseEndTick, tick);
  }
  /** The tick the intermission ends at (the next round starts) while there is one, else null. */
  get intermissionEnds() {
    return this.phase === "intermission" ? this.phaseEndTick : null;
  }
  /**
   * A player left: a Player Bot takes their slot back in place (same body,
   * position, team, loadout and score) instead of the slot emptying.
   */
  handToBot(slot, name, profile, difficulty = BOT_DIFFICULTIES.normal, asCharacter = false) {
    const c = this.slots[slot];
    if (!c || c.kind !== "human") return null;
    const from = c.name;
    c.kind = "bot";
    c.name = name;
    delete c.party;
    c.queue = [];
    c.prevButtons = 0;
    this.readySlots.delete(slot);
    c.bot = new BotBrain(c.slot, asCharacter ? profileFor(c.look, profile, this.rules.botStyle) : profile, difficulty, this.seed);
    c.bot.onSpawn(c.yaw);
    this.nav.places();
    this.refreshRoles();
    this.squadsDirty = true;
    this.pendingEvents.push({ e: "takeover", s: c.slot, from, to: name, bot: 1 });
    return c;
  }
  /**
   * The host changed bot skill or style mid-match: every Player Bot gets a
   * fresh brain with the new skill, playing its character under the new style
   * (rules.botStyle), from where it stands.
   */
  retuneBots(difficulty, style) {
    if (style) this.setRules({ botStyle: style === "mixed" ? void 0 : style });
    for (const c of this.combatants()) {
      if (c.kind !== "bot" || !c.bot) continue;
      this.rebrain(c, c.away ? difficulty : c.botSet?.skill ? BOT_DIFFICULTIES[c.botSet.skill] : difficulty);
    }
    this.rolesFor = -1;
    this.refreshRoles();
  }
  /** A fresh brain for a Player Bot from where it stands: `difficulty`, playing its character under its style (its own, else the match's). */
  rebrain(c, difficulty) {
    if (!c.bot) return;
    c.bot = new BotBrain(c.slot, profileFor(c.look, c.bot.profile, c.botSet?.style ?? this.rules.botStyle), difficulty, this.seed);
    c.bot.onSpawn(c.yaw);
    this.botThought.delete(c.slot);
  }
  /**
   * The host's bot set changed for this bot (BotFiller.setBotSet): its name, look, skill, style and squad from
   * `entry` (index `index`), where it stands. `difficulty`: the match's skill, for an entry without its own.
   * A new look rebuilds its character on every screen (the clients' character queue spreads that out).
   */
  updateSetBot(c, index, entry, difficulty) {
    if (c.kind !== "bot" || c.away) return;
    const before = c.botSet;
    c.botSet = { index, ...entry.skill ? { skill: entry.skill } : {}, ...entry.style ? { style: entry.style } : {}, ...entry.squad ? { squad: entry.squad } : {} };
    c.name = entry.name;
    const look = entry.look ? validLookId(entry.look) : c.look;
    const relook = look !== c.look;
    if (relook) {
      c.look = look;
      this.applyBodySize(c);
    }
    if (relook || before?.skill !== c.botSet.skill || before?.style !== c.botSet.style) {
      this.rebrain(c, c.botSet.skill ? BOT_DIFFICULTIES[c.botSet.skill] : difficulty);
      this.rolesFor = -1;
    }
    this.squadLeads = null;
  }
  /** A bot no longer plays an entry of the host's set (the set changed): a random bot from now on, under `name`. */
  dropSetBot(c, name, difficulty) {
    if (!c.botSet) return;
    const own = c.botSet.skill !== void 0 || c.botSet.style !== void 0;
    delete c.botSet;
    c.name = name;
    if (own) this.rebrain(c, difficulty);
    this.squadLeads = null;
  }
  /** The faction the next bot joins (the team that most needs a player), or null outside team modes. */
  nextBotTeam() {
    return this.teams ? this.factionFor("bot") : null;
  }
  /** How many are on a team now, and how many it should have (team modes). */
  teamRoom(team) {
    return { on: this.combatants().filter((c) => c.faction === team).length, size: this.teamTargets().get(team) ?? 0 };
  }
  /**
   * The host changed a setting mid-match (team sizes, bot style): the match
   * takes a new rules object (the one it was given may be shared, e.g. a
   * mode's defaults). Team count stays as it started.
   */
  setRules(patch) {
    this.rules = { ...this.rules, ...patch };
    if ("mixPickups" in patch || "weaponSet" in patch) for (const p of this.pickups) this.repool(p);
    if (!dropsInPlay(this.rules)) this.drops.length = 0;
  }
  /** The host ends the match now: the results as they stand, then the scoreboard (and a fresh round after the intermission). */
  endMatch() {
    if (this.phase !== "playing") return false;
    this.endRound();
    return true;
  }
  /** The host starts the match over on the same map: scores cleared, everyone respawned, the countdown again. */
  restartMatch() {
    this.startRound();
  }
  /**
   * A look's size and stats (sim/characterStats.ts): small and large looks play differently unless the match turns
   * body sizes off, and a look's own stats count unless it turns character stats off.
   */
  applyBodySize(c) {
    const spec = matchStats(c.look, this.rules);
    c.stats = spec;
    c.size = spec.size;
    if (c.cls) return;
    c.speedMul = spec.speed;
    if (!c.alive || c.health >= c.maxHealth) c.health = spec.health;
    c.maxHealth = spec.health;
  }
  /**
   * A player's or bot's own choice of look: worn now, or (while Random characters gives it random ones) kept for
   * when that goes off.
   */
  chooseLook(c, look) {
    if (c.ownLook !== void 0) {
      c.ownLook = look;
      return;
    }
    c.look = look;
    this.applyBodySize(c);
  }
  /**
   * Random characters: a player or bot (not an NPC) starting a life plays a random roster look (sim/randomLooks.ts),
   * its own choice kept for when the setting goes off again. True when its look changed (the spawn event carries it).
   */
  relookOnSpawn(c) {
    if (c.kind === "npc") return false;
    if (this.roulette) {
      c.ownLook ??= c.look;
      c.lives = (c.lives ?? 0) + 1;
      c.look = this.roulette.deal(c).look;
      this.applyBodySize(c);
      return true;
    }
    if (this.rules.randomCharacters) {
      c.ownLook ??= c.look;
      c.lives = (c.lives ?? 0) + 1;
      const look = randomLook(this.seed, c.slot, c.lives, c.look);
      if (look === c.look) return false;
      c.look = look;
    } else {
      if (c.ownLook === void 0) return false;
      const own = c.ownLook;
      c.ownLook = void 0;
      if (own === c.look) return false;
      c.look = own;
    }
    this.applyBodySize(c);
    return true;
  }
  /** `at`: this slot (a spectator joining again takes back the slot kept for them); else the first free one. */
  addCombatant(kind, name, team, at2) {
    const slot = at2 ?? this.slots.findIndex((s, i) => s === null && !this.spectators.has(i));
    if (slot < 0 || this.slots[slot]) return null;
    const c = this.blankCombatant(slot, kind, name, team);
    this.slots[slot] = c;
    this.squadsDirty = true;
    this.spawnOrQueue(c);
    return c;
  }
  remove(slot) {
    const c = this.slots[slot];
    if (!c) {
      if (this.spectators.delete(slot)) {
        this.activity.delete(slot);
        this.readySlots.delete(slot);
      }
      return;
    }
    this.activity.delete(slot);
    if (this.phase === "playing") this.mode?.onLeave(c);
    this.fireteams?.scores.leave(c.slot);
    this.classes?.onLeave(c);
    this.roulette?.forget(slot);
    this.readySlots.delete(slot);
    this.leaveMount(c, false);
    this.physics.removeCollider(c.collider);
    this.slots[slot] = null;
    this.squadsDirty = true;
    this.director?.forget(slot);
    this.rolesFor = -1;
    this.leadGoals.delete(slot);
    this.squadLeads = null;
  }
  /**
   * Spectators by choice (pause menu → Spectate): out of the match (no body, no team, not counted for team
   * sizes or the bot fill, so a bot can take the place), their slot kept for them with nothing in it, and
   * their score kept for when they join again (joinFromSpectating). Their connection keeps its slot.
   */
  spectators = /* @__PURE__ */ new Map();
  /** A player leaves play to watch: their body goes (as if they left), their slot and score wait for them. False if not a player in the match. */
  spectate(slot) {
    const c = this.slots[slot];
    if (!c || c.kind !== "human") return false;
    const s = { name: c.name, look: c.look, kills: c.kills, deaths: c.deaths, selfKills: c.selfKills, objective: c.objective, since: this.tick, ...c.account ? { account: true } : {}, ...c.party ? { party: c.party } : {} };
    const loaded = this.readySlots.has(slot);
    this.remove(slot);
    this.spectators.set(slot, s);
    if (loaded) this.readySlots.add(slot);
    this.activity.set(slot, { tick: this.tick, yaw: NaN, pitch: NaN });
    return true;
  }
  /** A spectator joins play again, in the slot kept for them, with the score they had (team: the rules' assignment). */
  joinFromSpectating(slot) {
    const s = this.spectators.get(slot);
    if (!s) return null;
    this.spectators.delete(slot);
    const c = this.addCombatant("human", s.name, void 0, slot);
    if (!c) return null;
    this.chooseLook(c, validLookId(s.look));
    c.kills = s.kills;
    c.deaths = s.deaths;
    c.selfKills = s.selfKills;
    c.objective = s.objective;
    if (s.account) c.account = true;
    if (s.party) c.party = s.party;
    this.readySlots.add(slot);
    this.resetIdle(slot);
    return c;
  }
  /** Whether this slot is kept for a spectator. */
  isSpectator(slot) {
    return this.spectators.has(slot);
  }
  /** How many spectators there are (each keeps a slot). */
  get spectatorCount() {
    return this.spectators.size;
  }
  /** The spectators' slots. */
  spectatorSlots() {
    return [...this.spectators.keys()];
  }
  /** When each player last really played (moved, turned or pressed something), and where they last looked. */
  activity = /* @__PURE__ */ new Map();
  /**
   * Note what a player's inputs say about them being there: moving, a button or
   * turning counts (a client sends inputs all the time, even untouched). Returns
   * whether they played. Works for a player who is away too (AWAY: they come back).
   */
  noteActivity(slot, inputs) {
    const c = this.slots[slot];
    if (c ? c.kind !== "human" && !c.away : !this.spectators.has(slot)) return false;
    const was = this.activity.get(slot);
    let active = false;
    let yaw = was?.yaw ?? NaN;
    let pitch = was?.pitch ?? NaN;
    for (const i of inputs) {
      const turned = Number.isFinite(yaw) && (Math.abs(i.yaw - yaw) > 0.02 || Math.abs(i.pitch - pitch) > 0.02);
      if (i.forward || i.right || i.buttons || i.sp || turned) active = true;
      yaw = i.yaw;
      pitch = i.pitch;
    }
    this.activity.set(slot, { tick: active || !was ? this.tick : was.tick, yaw, pitch });
    return active;
  }
  /** Seconds since this player last played (0 when unknown: just joined). */
  idleSeconds(slot) {
    const a = this.activity.get(slot);
    return a ? (this.tick - a.tick) / TICK_RATE : 0;
  }
  /** Start counting idle time again now (a new round, a player back from being away). */
  resetIdle(slot) {
    for (const [s, a] of this.activity) if (slot === void 0 || s === slot) a.tick = this.tick;
  }
  /**
   * A player is away: a bot plays their body where it is (team, score and
   * loadout stay), shown as "Name (away)", until they come back (comeBack).
   */
  setAway(slot, away, profile, difficulty = BOT_DIFFICULTIES.normal) {
    const c = this.slots[slot];
    if (!c || c.kind !== "human") return null;
    c.kind = "bot";
    c.away = away;
    c.name = `${away.name.slice(0, 25)} (away)`;
    c.queue = [];
    c.prevButtons = 0;
    this.readySlots.delete(slot);
    c.bot = new BotBrain(c.slot, profileFor(c.look, profile, this.rules.botStyle), difficulty, this.seed);
    c.bot.onSpawn(c.yaw);
    this.nav.places();
    this.refreshRoles();
    this.squadsDirty = true;
    return c;
  }
  /** An away player is back: their body is theirs again, where the bot left it. */
  comeBack(slot, name) {
    const c = this.slots[slot];
    if (!c?.away) return null;
    c.kind = "human";
    c.name = name ?? c.away.name;
    delete c.away;
    c.bot = void 0;
    c.queue = [];
    c.prevButtons = 0;
    c.lastSeq = 0;
    this.botThought.delete(slot);
    this.nav.places();
    this.refreshRoles();
    this.resetIdle(slot);
    this.squadsDirty = true;
    return c;
  }
  /** Queue untrusted client inputs. Out-of-order or duplicate sequence numbers are dropped. */
  queueInputs(slot, inputs) {
    const c = this.slots[slot];
    if (!c || c.kind !== "human") return;
    const last = c.queue.length ? c.queue[c.queue.length - 1].seq : c.lastSeq;
    let seq = last;
    for (const raw of inputs) {
      const input = sanitizeInput(raw);
      if (input.seq <= seq) continue;
      seq = input.seq;
      c.queue.push(input);
    }
    if (c.queue.length > MAX_QUEUED_INPUTS) {
      const dropped = c.queue.splice(0, c.queue.length - MAX_QUEUED_INPUTS);
      const say = dropped.reverse().find((i) => i.say)?.say;
      if (say && !c.queue[0].say) c.queue[0].say = say;
    }
  }
  /** Advance the simulation by one fixed tick and return the events it produced. */
  step() {
    this.tick++;
    if (this.rules.leaders && this.teams) this.updateLeaders();
    this.stepFireteams();
    if (this.phase === "intermission") {
      if (this.tick >= this.phaseEndTick) this.startRound();
    } else if (this.phase === "waiting" || this.phase === "countdown") {
      for (const c of this.actors()) {
        for (const input of c.queue) {
          input.forward = 0;
          input.right = 0;
          input.buttons = 0;
        }
        this.applyInputs(c);
      }
      this.spawnDue();
      const people = [...this.combatants().filter((c) => c.kind === "human").map((c) => c.slot), ...this.spectators.keys()];
      if (this.phase === "waiting" && (people.length > 0 && people.every((slot) => this.readySlots.has(slot)) || this.tick >= this.phaseEndTick)) this.startCountdown();
      else if (this.phase === "countdown" && this.tick >= this.phaseEndTick) this.beginPlay();
    } else {
      const prof = simProfile.on;
      let t = prof ? performance.now() : 0;
      const lap = (key2) => {
        const now = performance.now();
        simProfile.add(key2, now - t);
        t = now;
      };
      this.runBots();
      if (prof) lap("bots");
      this.scenario.moveMovers();
      if (prof) lap("scenario");
      const actors = this.actors();
      this.watched = this.botBudget(actors) > 1 ? actors.filter((c) => c.alive && (c.kind === "human" || this.watchers.has(c.slot))).map((c) => c.move.pos) : null;
      for (const c of actors) this.applyInputs(c);
      if (prof) lap("players");
      if (this.ambient.length && this.road) this.driveAmbient(this.road);
      this.stepMounts();
      if (prof) lap("mounts");
      this.stepProjectiles();
      this.stepDrops();
      this.stepBullets();
      this.stepZones();
      this.stepBoxes();
      this.stepStatuses();
      if (prof) lap("projectiles");
      if (this.phase === "playing") this.scenario.step();
      if (this.phase === "playing") this.encounters.step();
      if (this.phase === "playing") this.mode?.step();
      if (this.phase === "playing" && this.roulette) this.phys.gravity = this.roulette.step();
      if (this.phase === "playing") this.zombies?.step();
      if (this.phase === "playing") this.classes?.step();
      this.spawnDue();
      for (const c of this.npcs.values()) if (!c.alive && this.tick >= c.npc.removeAt) this.removeNpc(c.slot);
      if (this.tick >= this.phaseEndTick) this.endRound();
      if (prof) lap("scenario");
    }
    this.recordHistory();
    const events = this.pendingEvents;
    this.pendingEvents = [];
    this.noteCombat(events);
    this.noteObjectives(events);
    this.awards.events(
      events,
      (slot) => {
        const c = this.actor(slot);
        return !!c && c.kind !== "npc";
      },
      (a, b) => {
        const x = this.actor(a);
        const y = this.actor(b);
        return !!x && !!y && x !== y && this.hostile(x, y);
      },
      (w) => {
        const d = CORE_WEAPONS[w];
        return !!d && !d.projectile && d.kind !== "melee";
      }
    );
    this.classes?.events(events);
    return events;
  }
  /** Big matches: an empty vehicle (ambient traffic, a parked car rolling) more than twice RELAXED_RANGE from every player. */
  farVehicle(m) {
    const near2 = this.watched;
    if (!near2 || m.route || !m.seats.every((s) => s === null)) return false;
    const r = RELAXED_RANGE * 2;
    for (const w of near2) if ((w.x - m.pos.x) ** 2 + (w.z - m.pos.z) ** 2 < r * r) return false;
    return true;
  }
  /**
   * Movement detail for big matches (past BOT_FULL_RATE bots), for bots and
   * NPCs walking on the ground (no push, jump, ladder, swim, canopy or
   * jetpack). 'coarse': on terrain maps the terrain's height function stands
   * in for its collision mesh (PhysicsWorld.moveCharacter), the dearest thing
   * the character controller collides with. 'far': also more than
   * RELAXED_RANGE from every player, so it moves every other tick by two
   * ticks' worth; snapshots go out every other tick anyway, so nobody sees
   * the difference. 'full': the same move a player makes.
   */
  relaxedMove(c, input) {
    const near2 = this.watched;
    if (!near2 || c.kind === "human" || this.watchers.has(c.slot) || c.bot?.parkouring) return "full";
    const m = c.move;
    if (!m.grounded || m.velY !== 0 || m.vx || m.vz || m.swim || m.climb || m.chute || m.jet || m.zip !== void 0 || input.buttons & (BUTTON_JUMP | BUTTON_USE)) return "full";
    const p = m.pos;
    for (const g of this.scenario.portals) if ((g.pos.x - p.x) ** 2 + (g.pos.z - p.z) ** 2 < (RELAXED_PORTAL + g.width / 2) ** 2) return "full";
    if (this.gravityZones.length && gravityAt(this.gravityZones, p) !== 1) return "full";
    if (this.groundBores.length && nearGroundCut(this.groundBores, p.x, p.z, RELAXED_BORE)) return "full";
    for (const w of near2) if ((w.x - p.x) ** 2 + (w.z - p.z) ** 2 < RELAXED_RANGE * RELAXED_RANGE) return "coarse";
    return "far";
  }
  /**
   * Hidden in foliage: inside a bush (or fern, or tall crop) whose top is above
   * your eyes (crouch or lie down in the small ones), and not given away by
   * firing in the last two seconds. Bots then only spot you up close.
   */
  concealed(c) {
    if (c.alive && this.classes?.cloaked(c)) return true;
    if (!this.hides.length || c.mount || !c.alive) return false;
    const fired = this.lastShot.get(c.slot);
    if (fired !== void 0 && this.tick - fired < 2 * TICK_RATE) return false;
    const p = c.move.pos;
    const eye = p.y + eyeHeightOf(c.move);
    return this.hides.some((h) => p.y >= h.y0 && eye <= h.y1 + 0.15 && hypot(p.x - h.x, p.z - h.z) < h.r);
  }
  runBots() {
    if (this.tick % 6 === 0) this.nav.setGone(this.scenario.surfacesGone());
    this.nav.beginTick(SEARCH_BUDGET);
    const t0 = performance.now();
    const actors = this.actors();
    const views = this.views;
    if (views.size > actors.length * 2 + 16) views.clear();
    for (const c of actors) {
      if (c.shieldUntil && !this.shielded(c)) c.shieldUntil = 0;
      const v = views.get(c.slot);
      if (v) fillView(v, c, this.concealed(c), this.sheltered(c));
      else views.set(c.slot, toView(c, this.concealed(c), this.sheltered(c)));
    }
    const lying = [];
    for (const p of this.projectiles) {
      if (!p.stuck || !p.spec.retrievable) continue;
      const item = lyingItem(p);
      if (item) lying.push({ id: `${p.spec.disc ? "disc" : "spear"}_${p.id}`, item, pos: p.pos, available: true });
    }
    for (const d of this.drops) lying.push({ id: `drop_${d.id}`, item: d.item, pos: d.pos, available: true });
    const boxItem = getItem(AMMO_BOX_ITEM);
    if (boxItem && !restrictedWeapons(this.rules)) {
      for (const b of this.boxes) {
        const up = !!b.body && b.uses > 0;
        lying.push({ id: `box_${b.id}`, item: boxItem, pos: b.pos, available: up && b.health >= b.max * 0.6, ...!up && b.kind === "placed" ? { respawnIn: Math.max(0, (b.until - this.tick) / TICK_RATE) } : {} });
      }
    }
    const pickups = [...lying, ...this.pickups.filter((p) => !restrictedWeapons(this.rules) || !["weapon", "ammo", "throwable"].includes(p.item.effect.kind)).map((p) => ({ id: p.id, item: p.item, pos: p.pos, available: p.enabled && this.tick >= p.availableAt, ...p.enabled && this.tick < p.availableAt ? { respawnIn: (p.availableAt - this.tick) / TICK_RATE } : {} }))];
    const npcPickups = [];
    const blockersBy = /* @__PURE__ */ new Map();
    const blockersFor = (team) => blockersBy.get(team) ?? blockersBy.set(team, this.scenario.blockers(team)).get(team);
    const shutBy = /* @__PURE__ */ new Map();
    const shutFor = (team) => shutBy.get(team) ?? shutBy.set(team, this.scenario.openingsShut(team)).get(team);
    const buttonsBy = /* @__PURE__ */ new Map();
    const doorButtonsFor = (team) => buttonsBy.get(team) ?? buttonsBy.set(team, this.scenario.doorButtons(team)).get(team);
    const lifts = this.scenario.liftViews();
    const portals = this.scenario.portalViews();
    const hazards = [
      ...this.scenario.hazards(),
      ...this.cookOffs.map((k) => ({ min: { x: k.at.x - COOK_OFF.radius, y: k.at.y - 1, z: k.at.z - COOK_OFF.radius }, max: { x: k.at.x + COOK_OFF.radius, y: k.at.y + 2, z: k.at.z + COOK_OFF.radius } }))
    ];
    const spawnPoints = this.spawnPoints.map((s) => s.pos);
    const teamRoam = /* @__PURE__ */ new Map();
    for (const t of this.teams ?? []) {
      if (!this.spawnPoints.some((s) => s.team === t.id)) continue;
      const away = this.spawnPoints.filter((s) => s.team !== null && s.team !== t.id).map((s) => s.pos);
      if (away.length) teamRoam.set(t.id, away);
    }
    const coop = this.rules.mode === "core.coop";
    const zombies = this.rules.mode === "core.zombies";
    const mounts = this.mounts.length ? this.mountViews(actors) : void 0;
    const noises = this.noises.length ? this.noises : void 0;
    const factionViews = /* @__PURE__ */ new Map();
    for (const o of actors) {
      if (!o.alive || o.faction === null) continue;
      let list2 = factionViews.get(o.faction);
      if (!list2) factionViews.set(o.faction, list2 = []);
      list2.push(views.get(o.slot));
    }
    const hostileBySide = /* @__PURE__ */ new Map();
    const hostilesOf = (c) => {
      let list2 = hostileBySide.get(c.faction);
      if (!list2) hostileBySide.set(c.faction, list2 = actors.filter((o) => o.alive && (o === c || this.hostile(c, o)) && (o !== c || c.faction === null)));
      return list2.includes(c) ? list2.filter((o) => o !== c) : list2;
    };
    const hostileViewsBySide = /* @__PURE__ */ new Map();
    const hostileViews = (c, hostiles) => {
      if (hostiles !== hostileBySide.get(c.faction)) return hostiles.map((o) => views.get(o.slot));
      let list2 = hostileViewsBySide.get(c.faction);
      if (!list2) hostileViewsBySide.set(c.faction, list2 = hostiles.map((o) => views.get(o.slot)));
      return list2;
    };
    const anySentries = this.mounts.some((m) => m.def.sentry && m.alive);
    this.directBots(actors);
    const director = this.director;
    const every = this.botBudget(actors);
    const alliesGrids = /* @__PURE__ */ new Map();
    if (every > 1) {
      let i = 0;
      for (const [side, list2] of factionViews) alliesGrids.set(side, this.gridFor(i++, list2));
    }
    let thinkers = 0;
    for (const c of actors) if (c.bot && c.alive) thinkers++;
    const cap = every > 1 ? Math.ceil(thinkers / every) + BOT_THINK_SLACK : Infinity;
    let thoughts = 0;
    const deferredBefore = this.botDeferred;
    const deferred = /* @__PURE__ */ new Set();
    const n = actors.length;
    const from = every > 1 && n ? this.tick * 7 % n : 0;
    for (let k = 0; k < n; k++) {
      const c = actors[(k + from) % n];
      if (!c.bot) continue;
      const due = every === 1 || (this.tick + c.slot) % every === 0 || deferredBefore.has(c.slot) || c.bot.parkouring;
      if (!due && this.coastBot(c, every)) continue;
      const hostiles = hostilesOf(c);
      const aware = this.mode && !c.npc ? this.mode.botAwareness(c) : Infinity;
      const npc = c.npc;
      const shambler = npc?.role === "zombie";
      if (npc && !shambler && c.alive && !c.bot.lastSeen && !this.encounters.roaming(c.slot) && !hostiles.some((o) => horizontalDistance(o.move.pos, c.move.pos) < 70)) {
        c.queue.push({ seq: c.lastSeq + 1, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0 });
        continue;
      }
      const others = aware < Infinity || anySentries ? [...(aware < Infinity ? hostiles.filter((o) => horizontalDistance(o.move.pos, c.move.pos) <= aware) : hostiles).map((o) => views.get(o.slot)), ...this.hostileSentries(c)] : hostileViews(c, hostiles);
      const allies = c.faction === null ? void 0 : factionViews.get(c.faction);
      const tt = simProfile.on ? performance.now() : 0;
      const over = due && every > 1 && thoughts >= cap && !deferredBefore.has(c.slot) && !c.bot.parkouring;
      const mayWait = every > 1 && (!due || over) && c.alive && !c.mount;
      let orderGoal = mayWait && !this.classes ? void 0 : this.botGoal(c, hostiles, zombies, coop);
      const view = {
        tick: this.tick,
        self: views.get(c.slot),
        others,
        physics: this.physics,
        // Shared sight lines and bounded perception only in big matches: smaller ones see exactly as before.
        sight: every > 1 ? this.sight : void 0,
        crowded: every > 1,
        ...this.smokeClouds().length ? { smoke: this.smokeClouds() } : {},
        nav: this.nav,
        spawnPoints: orderGoal === void 0 ? spawnPoints : npc && orderGoal ? [orderGoal.pos] : c.faction && teamRoam.get(c.faction) || spawnPoints,
        pickups: npc ? npcPickups : this.withSupplyStops(pickups, c),
        inventory: this.inventoryOf(c),
        throwables: c.throwable?.count ?? 0,
        throwable: c.throwable?.kind ?? null,
        held: c.current,
        reloading: c.reloadTicks > 0,
        blockers: blockersFor(c.faction),
        shut: shutFor(c.faction),
        doorButtons: doorButtonsFor(c.faction),
        ...lifts.length ? { lifts } : {},
        ...portals.length ? { portals } : {},
        ...this.zipRides.length ? { ziplines: this.zipRides.map((r) => ({ start: r.start, end: r.end, on: teamAllows(r.team, c.faction) })) } : {},
        hazards,
        orderGoal: orderGoal ?? null,
        allies,
        // Focused bots (flag carriers) also ignore distant gunfire and near misses: they keep running.
        noises: aware < Infinity ? void 0 : noises,
        shotAt: aware < Infinity ? null : c.shotAt ?? null,
        // Bots that may not take a vehicle right now (carrying the bomb, leading hostages) don't see any to get in.
        mounts: aware < Infinity ? void 0 : mounts && !c.mount && this.mode?.blocksVehicle(c) ? mounts.filter((m) => m.kind !== "vehicle") : mounts,
        // Every mount's hull, for walking round the ones standing still (BotBrain.pastHulls), even for a focused bot.
        hulls: c.mount ? void 0 : mounts,
        seat: c.mount ? this.seatView(c) : null,
        guides: this.guides,
        squad: npc ? this.encounters.squadFor(c.slot, npc.role) : null,
        // (Always present, so every view has one shape: bot code reading it stays monomorphic.)
        alliesGrid: every > 1 && c.faction !== null ? alliesGrids.get(c.faction) : void 0,
        plan: npc || !director || c.kind !== "bot" ? void 0 : director.planFor(c.slot)
      };
      let input = null;
      if (mayWait) {
        const last = this.botThought.get(c.slot);
        const s = last && this.tick - last.tick < every ? c.bot.steer(view) : null;
        if (s && last) {
          input = { seq: c.lastSeq + 1, forward: s.forward, right: s.right, yaw: s.yaw, pitch: s.pitch, buttons: last.input.buttons & COAST_BUTTONS | (s.fire ? BUTTON_FIRE : 0) | (s.zoom ? BUTTON_ZOOM : 0) };
          if (simProfile.on) simProfile.count("botSteer");
        } else if (over && this.coastBot(c, every, true)) {
          deferred.add(c.slot);
          if (simProfile.on) simProfile.count("botDeferred");
          continue;
        }
        if (input && over) {
          deferred.add(c.slot);
          if (simProfile.on) simProfile.count("botDeferred");
        }
      }
      if (!input) {
        if (orderGoal === void 0) {
          orderGoal = this.botGoal(c, hostiles, zombies, coop);
          view.orderGoal = orderGoal;
          view.spawnPoints = npc && orderGoal ? [orderGoal.pos] : c.faction && teamRoam.get(c.faction) || spawnPoints;
        }
        input = c.bot.think(view);
        thoughts++;
        if (simProfile.on) {
          const took = performance.now() - tt;
          simProfile.add("botThink", took);
          simProfile.count("botThink");
          if (took > (simProfile.ms.get("botThink slowest") ?? 0)) simProfile.ms.set("botThink slowest", took);
        }
      }
      if (npc && NPC_ROLE_SPECS[npc.role].melee && c.alive) {
        const target = c.bot.target === null ? null : this.actor(c.bot.target);
        chargeIntoMelee(input, c.move.pos, target?.alive ? target.move.pos : null, getWeapon(NPC_ROLE_SPECS[npc.role].weapon).range);
      }
      if (!npc) this.mode?.botInput?.(c, input);
      if (!npc) this.classes?.botInput(c, input, orderGoal ?? null);
      if (!npc && c.alive && !c.mount && this.rules.weapons === "discs") this.dodgeDiscs(c, input);
      this.planeBot(c, input);
      if (c.alive && (c.gun.rp > 0 || c.gun.ry !== 0)) {
        const k2 = c.bot.difficulty.aim.recoilComp ?? 0.5;
        input.rc = [c.gun.rp * k2, c.gun.ry * k2];
      }
      c.queue.push(input);
      if (every > 1) this.botThought.set(c.slot, { input, tick: this.tick });
    }
    this.botDeferred = deferred;
    this.lastAiMs = performance.now() - t0;
  }
  /** Bots' views of the actors, by actor ID, refilled each tick (runBots). */
  views = /* @__PURE__ */ new Map();
  /** Each bot's last thought-out (or steered) input and its tick (only kept in big matches, see coastBot). */
  botThought = /* @__PURE__ */ new Map();
  /** Bots whose think the budget put off last tick: they think first this tick. */
  botDeferred = /* @__PURE__ */ new Set();
  /** Grids reused tick to tick (runBots). */
  grids = [];
  /** Squads, roles and each side's map knowledge for Player Bots (bots/director.ts); made with the first bot. */
  director = null;
  /** The bots' common trips with their corridors (botTrips); null until asked for, and again once the navmesh changes. */
  trips = null;
  /** A side's team brain (bots/teamBrain.ts: its groups, pushes and prices), for measuring and tests; null before the first bot. */
  teamBrain(side) {
    return this.director?.brainFor(side) ?? null;
  }
  /** A Player Bot's role this match (director.ts: squad, camper, sniper, lone wolf), for measuring; null without one. */
  botRole(slot) {
    return this.director?.roleOf(slot) ?? null;
  }
  /**
   * The trips a team's bots make again and again (the mode's: base to flag, spawn to hill...; without a mode, each
   * team's spawn to the other's) and two or three corridors for each (nav/corridors.ts: a few ms each, kept per
   * navmesh), worked out the first time they are asked for (at setup: refreshRoles) and again once the navmesh is
   * rebuilt (Fort Wars). The team brain spreads its groups over them; the scorecard measures who walks which.
   */
  /** Measuring (bot-report, tests): every mount's id, state, crew and limited ammunition, read only. */
  mountStates() {
    return this.mounts.map((m) => ({ index: m.index, id: m.def.id, pos: { ...m.pos }, yaw: m.yaw, speed: m.speed, health: Math.max(0, m.health), alive: m.alive, seats: [...m.seats], shells: m.guns.map((g) => g?.shells ?? null) }));
  }
  botTrips() {
    if (this.trips) return this.trips;
    let specs = this.mode?.botTrips?.() ?? [];
    if (!this.mode && this.teams && this.teams.length === 2) {
      const [a, b] = this.teams;
      const ha = teamHome(this.spawnPoints, a.id);
      const hb = teamHome(this.spawnPoints, b.id);
      if (ha && hb) specs = [{ team: a.id, from: ha, to: hb, kind: "attack" }, { team: b.id, from: hb, to: ha, kind: "attack" }];
    }
    this.nav.mainPlaces();
    return this.trips = specs.map((s) => ({ ...s, trip: findCorridors(this.nav, s.from, s.to) }));
  }
  /** Player Bots the roles were last handed out for (-1: hand them out again). */
  rolesFor = -1;
  /**
   * Roles for the Player Bots (director.ts assignRoles: campers, snipers and
   * lone wolves a small share each, by the match's bot style), when the roster
   * has changed. The first time a camper or sniper turns up, the map's vantage
   * spots are worked out (once per map: vantage.ts), at setup, not mid-tick.
   */
  refreshRoles() {
    const bots = this.combatants().filter((c) => c.kind === "bot" && c.bot);
    if (!bots.length || bots.length === this.rolesFor) return;
    this.rolesFor = bots.length;
    const places = this.nav.mainPlaces();
    this.director ??= new BotDirector(this.seed, regionLayout(places), places, (a, b) => this.physics.lineOfSight(a, b), mapBotHints(this.map));
    const roles = assignRoles(
      bots.map((c) => ({ slot: c.slot, profile: c.bot.profile })),
      this.rules.botStyle ?? "mixed",
      this.seed
    );
    if (this.fireteams) for (const k of roles.keys()) roles.set(k, "squad");
    for (const [slot, role] of roles) this.director.setRole(slot, role);
    for (const c of bots) this.rearmForRole(c);
    this.botTrips();
    if (!this.director.vantage && [...roles.values()].some((r) => r === "camper" || r === "sniper")) {
      const ray = (o, d, max) => this.physics.raycastWorld(o, d, max);
      this.director.vantage = new VantageBoard(withHintSpots(vantageFor(places, ray, this.nav.parkourPlaces()), hintSpots(this.director.hints, ray)));
      this.director.vantage.lanes(
        this.botTrips().flatMap((t) => t.trip.corridors.map((c) => c.line)),
        (a, b) => this.physics.lineOfSight(a, b)
      );
      for (const c of bots) this.director.planFor(c.slot).vantage = this.director.vantage;
    }
  }
  /**
   * The director's low-rate pass (once a second per side, sides staggered):
   * each team's region knowledge, and squads in big team matches without an
   * objective mode (objective modes send bots where the objective is).
   */
  directBots(actors) {
    const d = this.director;
    const teams = this.teams;
    if (!d || !teams) return;
    const ft = this.fireteams;
    const squads = (actors.length >= CLUSTER_MIN_PLAYERS || !!ft) && !this.mode && this.rules.mode !== "core.coop" && this.rules.mode !== "core.zombies";
    const trips = this.botTrips();
    const all = trips.map((x) => x.trip);
    teams.forEach((t, i) => {
      if ((this.tick + i * 29) % TICK_RATE !== 0) return;
      const brief = this.mode?.botBrief?.(t.id) ?? null;
      const everyone = [];
      const members = [];
      for (const c of actors) {
        if (c.faction !== t.id || !c.alive) continue;
        everyone.push(c.move.pos);
        if (!c.bot || c.npc || c.kind !== "bot") continue;
        const fighting = c.bot.target !== null;
        const seen = c.bot.lastSeen;
        const ordered = !!c.order && this.tick <= c.order.until;
        const team = ft?.squadOf(c.slot);
        const follower = !!team && team.leader !== c.slot;
        members.push({
          slot: c.slot,
          pos: c.move.pos,
          fighting,
          enemyAt: fighting && seen ? seen.pos : null,
          free: !team && !c.mount && !c.order && !c.botSet?.squad && d.planFor(c.slot).role === "squad",
          teamLeader: this.isLeader(c),
          profile: c.bot.profile,
          // (The mode's goal only when the mode briefs the side: the team brain's groups are made of its attackers.)
          goal: brief && !ordered && !follower ? this.mode?.botGoal(c, []) ?? null : null,
          corridor: c.bot.corridor,
          ordered: ordered || !!c.botSet?.squad || follower,
          mounted: !!c.mount,
          seen: seen && this.tick - seen.tick < TICK_RATE * 1.5 ? seen.pos : null,
          // (Fireteams: a bot-led squad's member plays its leader's play: the same group, corridor and staging.)
          ...follower && team && !team.human && team.leader !== null ? { unit: team.leader } : {}
        });
      }
      const towards = this.spawnPoints.filter((s) => s.team !== null && s.team !== t.id && !s.generated).map((s) => s.pos);
      const own = trips.filter((x) => x.team === t.id).map((x) => x.trip);
      const fixed = ft ? ft.teamSquads(t.id).filter((q) => !q.human && q.leader !== null).map((q) => [q.leader, ...q.members.filter((m) => m !== q.leader && this.slots[m]?.alive)]) : null;
      d.update(this.tick, t.id, everyone, members, towards.length ? towards : null, squads, (slot, at2) => this.slots[slot]?.bot?.alert(at2, this.tick), brief, own, all, fixed);
    });
  }
  /** The team brain's own goal for a bot (an interceptor's cut-off point), if it has one. */
  jobGoal(c) {
    if (c.kind !== "bot" || !this.director) return null;
    return this.director.planFor(c.slot).job?.goal ?? null;
  }
  /** Where a bot is told to go (squad orders, teammates' orders, co-op and mode goals), or null to roam. */
  botGoal(c, hostiles, zombies, coop) {
    const g = this.botGoalOf(c, hostiles, zombies, coop);
    return this.fireteams && c.bot && c.kind === "bot" ? this.fireteamPlayGoal(c, g) : g;
  }
  botGoalOf(c, hostiles, zombies, coop) {
    const npc = c.npc;
    if (npc) return npc.role === "zombie" ? this.nearestGoal(c, hostiles, 1.5) : this.encounters.goalFor(c.slot);
    const told = this.fireteamGoal(c);
    if (told && !this.mode?.blocksVehicle(c)) return told;
    const order = this.teammateOrder(c);
    if (order) return order;
    const squad = this.squadGoal(c);
    if (squad !== void 0) return squad;
    const job = this.jobGoal(c);
    if (job) return job;
    const goal = zombies ? this.holdOutGoal(c, hostiles) : coop ? this.coopGoal(c, hostiles) : this.classGoal(c, this.mode?.botGoal(c, hostiles) ?? null);
    if (c.botSet?.squad) this.leadGoals.set(c.slot, goal);
    return goal;
  }
  /** Squads of the host's bot set: "side|label" -> the leader's slot (the first of them alive), rebuilt once a tick. */
  squadLeads = null;
  /** Each squad leader's own goal when it last thought (null: roaming). */
  leadGoals = /* @__PURE__ */ new Map();
  squadKey(c) {
    const label = c.botSet?.squad;
    if (!label || c.kind !== "bot" || c.away || c.faction === null) return null;
    return `${c.faction}|${label.toLowerCase()}`;
  }
  /**
   * A bot in a squad of the host's set that isn't its leader: back to the leader when it strays (more than
   * SQUAD_STRAY m), else the leader's own goal, else (the leader roaming) close by the leader. Undefined: not
   * a follower (no squad, or it leads), so its own goals apply.
   */
  squadGoal(c) {
    const key2 = this.squadKey(c);
    if (!key2) return void 0;
    if (this.squadLeads?.tick !== this.tick) {
      const lead = /* @__PURE__ */ new Map();
      for (const x of this.combatants()) {
        const k = x.alive ? this.squadKey(x) : null;
        if (k && !lead.has(k)) lead.set(k, x.slot);
      }
      this.squadLeads = { tick: this.tick, lead };
    }
    const slot = this.squadLeads.lead.get(key2);
    const leader = slot === void 0 ? void 0 : this.slots[slot];
    if (!leader || leader === c || !leader.alive) return void 0;
    if (horizontalDistance(c.move.pos, leader.move.pos) > SQUAD_STRAY) return { pos: leader.move.pos, radius: 5 };
    return this.leadGoals.get(leader.slot) ?? { pos: leader.move.pos, radius: 6 };
  }
  gridFor(i, list2) {
    const g = this.grids[i] ?? (this.grids[i] = new ViewGrid());
    return g.reset(list2);
  }
  /** The bot's weapons as it sees them: the same objects tick to tick, refreshed (no allocation per bot a tick). */
  inventoryOf(c) {
    let list2 = this.botInventory.get(c.slot);
    if (!list2) this.botInventory.set(c.slot, list2 = []);
    let i = 0;
    for (const w of c.weapons.values()) {
      const v = list2[i];
      if (v) {
        v.def = w.def;
        v.mag = w.mag;
        v.reserve = w.reserve;
        v.alt = w.alt;
      } else list2[i] = { def: w.def, mag: w.mag, reserve: w.reserve, alt: w.alt };
      i++;
    }
    list2.length = i;
    return list2;
  }
  botInventory = /* @__PURE__ */ new Map();
  /**
   * Think budget: up to BOT_FULL_RATE thinking bots (Player Bots and awake
   * NPCs) all think every tick; past that, bots think in full on one tick in
   * BOT_THINK_EVERY (20 Hz), steering (fighting) or coasting (not) in between.
   */
  botBudget(actors) {
    let n = 0;
    for (const c of actors) if (c.bot && c.alive) n++;
    return n > BOT_FULL_RATE ? BOT_THINK_EVERY : 1;
  }
  /**
   * Between its thinks, a bot that is alive, on foot, not fighting and not
   * under fire repeats the move it thought out last (without one-shot buttons).
   * `force` (over the think budget): a fighting bot too. Returns false when it
   * should think now.
   */
  coastBot(c, every, force = false) {
    if (!c.alive || c.mount) return false;
    if (!force && (c.bot.target !== null || c.shotAt && this.tick - c.shotAt.tick <= every)) return false;
    const last = this.botThought.get(c.slot);
    if (!last || this.tick - last.tick >= every) return false;
    const i = last.input;
    const next = { seq: c.lastSeq + 1, forward: i.forward, right: i.right, yaw: i.yaw, pitch: i.pitch, buttons: i.buttons & (force ? COAST_BUTTONS | BUTTON_FIRE : COAST_BUTTONS) };
    if (i.viewTick !== void 0) next.viewTick = i.viewTick;
    if (i.rc) next.rc = i.rc;
    c.queue.push(next);
    return true;
  }
  /**
   * Sentries that would shoot this bot, close enough to matter, as targets it
   * can shoot back at (they can be destroyed). Seen as a prone figure so the
   * bot aims at the gun's body, not over it.
   */
  hostileSentries(c) {
    const out = [];
    for (const m of this.mounts) {
      const spec = m.def.sentry;
      if (!spec || !m.alive || m.builtBy === c.slot) continue;
      if (m.faction !== null && relation(this.factions, m.faction, c.faction) !== "enemy") continue;
      if (horizontalDistance(m.pos, c.move.pos) > spec.range + 10) continue;
      out.push({ slot: SENTRY_VIEW_BASE + m.index, pos: m.pos, yaw: m.aimYaw, pitch: 0, health: Math.max(0, m.health), armor: 0, alive: true, stance: 2, human: false, mounted: false, grounded: true, object: true, concealed: false, size: 1 });
    }
    return out;
  }
  /** Is vehicle `m` on or over water (or another liquid): afloat, its feet in it, or (a flyer) water under it? */
  overWater(m) {
    if (m.afloat || liquidAt(this.liquids, { x: m.pos.x, y: m.pos.y + 0.2, z: m.pos.z }) || liquidAt(this.liquids, { x: m.pos.x, y: m.pos.y - 0.5, z: m.pos.z })) return true;
    if (!m.def.vehicle?.fly) return false;
    const hit = this.physics.raycastHit({ x: m.pos.x, y: m.pos.y - 0.05, z: m.pos.z }, { x: 0, y: -1, z: 0 }, 60);
    const below = hit ? m.pos.y - 0.05 - hit.dist : m.pos.y - 60;
    for (let y = m.pos.y - 0.5; y > below; y -= 1) if (liquidAt(this.liquids, { x: m.pos.x, y, z: m.pos.z })) return true;
    return false;
  }
  /** Turrets and vehicles as bots see them (built once per tick). */
  mountViews(actors) {
    const humans = actors.filter((a) => a.kind === "human" && a.alive);
    return this.mounts.map((m) => ({
      index: m.index,
      kind: m.def.kind,
      pos: m.pos,
      yaw: m.yaw,
      health: Math.max(0, m.health) / m.def.health,
      alive: m.alive,
      enterRadius: m.def.enterRadius,
      seats: m.def.seats.map((s, i) => ({ role: s.role, free: m.seats[i] === null, ...m.seats[i] !== null ? { by: m.seats[i] } : {}, ...s.weapon ? { weapon: getWeapon(s.weapon) } : {}, ...s.arc !== void 0 ? { arc: s.arc } : {}, ...s.facing ? { facing: s.facing } : {}, ...s.ammo && m.guns[i]?.shells !== void 0 ? { shells: m.guns[i].shells, maxShells: s.ammo.max, ...s.ammo.pickups ? { refills: s.ammo.pickups } : {} } : {} })),
      ...m.def.vehicle ? { maxSpeed: m.def.vehicle.maxSpeed, speed: Math.abs(m.speed) } : {},
      ...m.def.vehicle && m.speed < -0.5 ? { reversing: true } : {},
      ...m.burning ? { burning: true } : {},
      ...!m.alive && m.wreckUntil > this.tick ? { wreck: true } : {},
      ...m.floats ? { floats: true } : {},
      ...m.wedged ? { wedged: true } : {},
      ...m.def.armour?.sealed ? { sealed: true } : {},
      ...m.def.armour && (m.def.armour.bullets ?? 1) < 0.5 ? { armoured: true } : {},
      ...m.def.bailHealth !== void 0 ? { bailHealth: m.def.bailHealth } : {},
      ...m.def.vehicle?.pivot ? { pivots: true } : {},
      ...m.def.vehicle && this.liquids.length && this.overWater(m) ? { overWater: true } : {},
      ...m.def.vehicle && !m.def.vehicle.fly ? { routeHalfWidth: Math.min(m.def.half[0], m.def.half[2]) * (m.def.vehicle.routeFit ?? ROUTE_FIT) } : {},
      half: m.def.half,
      humanNear: humans.some((h) => horizontalDistance(h.move.pos, m.pos) < 35)
    }));
  }
  seatView(c) {
    const m = this.mounts[c.mount.index];
    const seat = m?.def.seats[c.mount.seat];
    if (!m || !seat) return null;
    const gs = this.gunSeatOf(c);
    const gun = gs === null ? null : m.guns[gs];
    const aim = gs === null ? seat : m.def.seats[gs];
    const arc = gs !== null && gs !== c.mount.seat ? aim.driverArc ?? aim.arc : aim.arc;
    const ammo = gs === null ? void 0 : m.def.seats[gs].ammo;
    return { mount: m.index, seat: c.mount.seat, role: seat.role, ...seat.role !== "driver" && !seat.seated && !m.def.airplane ? { ducks: true } : {}, ...gun ? { weapon: gun.def } : {}, ...arc !== void 0 ? { arc } : {}, ...aim.facing ? { facing: aim.facing } : {}, heat: gun?.heat ?? 0, overheated: gun?.overheated ?? false, ...gun?.shells !== void 0 && ammo ? { shells: gun.shells, maxShells: ammo.max, ...ammo.pickups ? { refills: ammo.pickups } : {} } : {} };
  }
  /**
   * What bots hear and feel this tick: gunfire and explosions become noises
   * (kept for a second), and shots passing close to (or hitting) someone mark
   * them as under fire, with where it came from.
   */
  noteCombat(events) {
    this.noises = this.noises.filter((n) => this.tick - n.tick < TICK_RATE);
    let actors;
    for (const ev of events) {
      if (ev.e === "explode") this.noises.push({ pos: { x: ev.p[0], y: ev.p[1], z: ev.p[2] }, tick: this.tick, by: ev.s, range: 60 });
      if (ev.e === "impact") {
        const shooter2 = this.actor(ev.s);
        const from2 = { x: ev.from[0], y: ev.from[1], z: ev.from[2] };
        const to2 = { x: ev.to[0], y: ev.to[1], z: ev.to[2] };
        if (shooter2) {
          for (const c of actors ??= this.actors()) if (c.bot && c.alive && this.hostile(shooter2, c) && (ev.hit === c.slot || segmentDistance(c.move.pos, from2, to2, CHEST) < 1.6)) c.shotAt = { tick: this.tick, from: from2 };
        }
        continue;
      }
      if (ev.e !== "shot" || ev.s < 0) continue;
      const from = { x: ev.from[0], y: ev.from[1], z: ev.from[2] };
      this.noises.push({ pos: from, tick: this.tick, by: ev.s, range: 45 });
      this.lastShot.set(ev.s, this.tick);
      const shooter = this.actor(ev.s);
      const end = ev.to[0];
      if (!shooter || !end) continue;
      const to = { x: end[0], y: end[1], z: end[2] };
      for (const c of actors ??= this.actors()) {
        if (!c.bot || !c.alive || !this.hostile(shooter, c)) continue;
        if (ev.hit.includes(c.slot) || segmentDistance(c.move.pos, from, to, CHEST) < 1.6) c.shotAt = { tick: this.tick, from };
      }
    }
    if (this.noises.length > 48) this.noises.splice(0, this.noises.length - 48);
  }
  /**
   * Co-op Player Bots head for the nearest enemy they know of (the mission's
   * NPCs), or stay near a human when there is nothing to fight.
   */
  /** The nearest of `among` (a zombie's prey), as a goal. */
  nearestGoal(c, among, radius) {
    let best = null;
    let bestD = Infinity;
    for (const h of among) {
      const d = horizontalDistance(h.move.pos, c.move.pos) + Math.abs(h.move.pos.y - c.move.pos.y) * 2;
      if (d < bestD) {
        bestD = d;
        best = h.move.pos;
      }
    }
    return best ? { pos: best, radius } : null;
  }
  /** Zombies: Player Bots stay with the humans and let the horde come to them; alone, they go hunting. */
  holdOutGoal(c, hostiles) {
    const human = this.nearestGoal(c, this.combatants().filter((o) => o.kind === "human" && o.alive), 5);
    return human ?? this.nearestGoal(c, hostiles, 3);
  }
  coopGoal(c, hostiles) {
    let best = null;
    let bestD = Infinity;
    for (const h of hostiles) {
      const d = horizontalDistance(h.move.pos, c.move.pos) + Math.abs(h.move.pos.y - c.move.pos.y) * 2;
      if (d < bestD) {
        bestD = d;
        best = h.move.pos;
      }
    }
    if (best) return { pos: best, radius: 2 };
    const human = this.combatants().find((o) => o.kind === "human" && o.alive);
    return human ? { pos: human.move.pos, radius: 4 } : null;
  }
  /** Classes: Medics follow patients, Mechanics hold their sentry; others keep the mode's goal. */
  classGoal(c, goal) {
    return this.classes ? this.classes.botGoal(c, goal) : goal;
  }
  /** Disc Arena: a bot sidesteps and hops an enemy disc about to hit it, and never walks off the edge. */
  dodgeDiscs(c, input) {
    const floorAt = (p) => this.physics.raycastHit({ x: p.x, y: p.y + 0.5, z: p.z }, { x: 0, y: -1, z: 0 }, 6) !== null;
    const discs = this.projectiles.filter((p) => p.spec.disc && p.owner !== c.slot && !p.stuck).map((p) => ({ pos: p.pos, vel: p.vel, owner: this.actor(p.owner) }));
    const threats = discs.filter((d) => !d.owner || this.hostile(d.owner, c));
    if (threats.length && dodgeDisc(input, { pos: c.move.pos, yaw: input.yaw, grounded: c.move.grounded }, threats, floorAt)) return;
    keepOnDeck(input, { ...c.move, padFlight: !!c.padFlight }, floorAt);
  }
  /** Where a teammate told this bot to be ("Follow me!" / "Hold here!"), while the order lasts. */
  /** Team leaders (rules.leaders): team ID -> leader slot. */
  leaderOf = /* @__PURE__ */ new Map();
  /** Leader variant: points each team earned by downing enemy leaders. */
  leaderBounty = /* @__PURE__ */ new Map();
  /** Whether `c` leads their team (rules.leaders). */
  isLeader(c) {
    return !!this.rules.leaders && !!c.faction && this.leaderOf.get(c.faction) === c.slot && this.slots[c.slot] === c;
  }
  /** Each team's leader slot, in team order (-1: nobody on the team). */
  leaders() {
    return (this.teams ?? []).map((t) => this.leaderOf.get(t.id) ?? -1);
  }
  /**
   * Keep a leader on every team: a person leads ahead of a bot (the first to
   * join, by slot); the leader keeps the job until they leave, or until a
   * person joins a team a bot was leading. A player who takes over the
   * leading bot (same slot) leads straight away.
   */
  updateLeaders() {
    for (const t of this.teams) {
      const cur = this.leaderOf.get(t.id);
      const c = cur === void 0 ? null : this.slots[cur];
      const onTeam = c && c.faction === t.id ? c : null;
      if (onTeam?.kind === "human") continue;
      const members = this.combatants().filter((m) => m.faction === t.id);
      const next = members.find((m) => m.kind === "human") ?? onTeam ?? members[0];
      if (!next) {
        this.leaderOf.delete(t.id);
        continue;
      }
      if (next === onTeam) continue;
      this.leaderOf.set(t.id, next.slot);
      this.pendingEvents.push({ e: "leader", a: "lead", s: next.slot, team: t.id });
    }
  }
  /** A leader went down: the Leader variant pays the side that did it. */
  leaderDown(victim, killer) {
    const team = victim.faction;
    const scorer = killer && killer !== victim && killer.faction && this.hostile(killer, victim) ? killer.faction : null;
    const n = this.rules.leaders === "vip" && scorer && !this.mode ? LEADER_BOUNTY : 0;
    if (n && scorer) this.leaderBounty.set(scorer, (this.leaderBounty.get(scorer) ?? 0) + n);
    this.pendingEvents.push({ e: "leader", a: "down", s: victim.slot, team, ...n ? { n } : {} });
  }
  teammateOrder(c) {
    const o = c.order;
    if (!o || this.tick > o.until) return null;
    if (o.kind === "hold") return { pos: o.pos, radius: 3, order: true };
    const leader = this.actor(o.leader);
    if (!leader?.alive) {
      c.order = void 0;
      return null;
    }
    return { pos: leader.move.pos, radius: 4, order: true };
  }
  // ------------------------------------------------------------------ Fireteams (sim/fireteams.ts)
  /** Fireteams: every team's fixed squads (null: the variant is off). */
  fireteams = null;
  /** The roster changed since the squads were last brought in line with it. */
  squadsDirty = true;
  squadsAt = -Infinity;
  /** Once a tick: the squads kept in line with the roster (when it changed, and every 2 s), and their orders a few times a second. */
  stepFireteams() {
    const size = this.rules.fireteams;
    if (!size || !this.teams || !fireteamMode(this.rules.mode)) {
      if (this.fireteams) {
        this.fireteams = null;
        this.rolesFor = -1;
        this.refreshRoles();
      }
      return;
    }
    if (!this.fireteams || this.fireteams.size !== size) {
      this.fireteams = new Fireteams(size);
      this.squadsDirty = true;
      this.rolesFor = -1;
      this.refreshRoles();
    }
    const ft = this.fireteams;
    if (this.squadsDirty || this.tick - this.squadsAt >= TICK_RATE * 2) {
      this.squadsDirty = false;
      this.squadsAt = this.tick;
      const roster = this.combatants().map((c) => ({ slot: c.slot, team: c.faction, human: c.kind === "human", lead: c.bot ? leadAbility(c.bot.profile) : 0, pos: c.move.pos }));
      this.squadNotes(ft.sync(roster, this.tick));
    }
    this.mode?.botUnits?.(this.squadUnit, this.squadInfo);
    if (this.phase === "playing" && this.tick % 6 === 0) this.squadNotes(ft.step(this.tick, this.squadWorld));
    if (this.phase === "playing" && this.tick % 6 === 0) this.tallySquads(this.tick % TICK_RATE === 0);
    if (this.phase === "playing") {
      for (const s of ft.squads) {
        if (s.human || s.leader === null || (this.tick + s.id * 7) % TICK_RATE !== 0) continue;
        const l = this.slots[s.leader];
        const seen = l?.alive && l.bot && l.bot.target !== null ? l.bot.lastSeen : null;
        if (!seen) continue;
        for (const m of s.members) {
          const b = this.slots[m];
          if (b && b !== l && b.alive && b.bot && b.bot.target === null && horizontalDistance(b.move.pos, l.move.pos) < SQUAD_ALERT) b.bot.alert(seen.pos, this.tick);
        }
      }
    }
  }
  /** Fireteams: the squad a slot is in now (its id), for the squad scores. */
  squadIdOf = (slot) => this.fireteams?.squadOf(slot)?.id;
  /**
   * Squad scores (sim/squadScores.ts): each player's objective plays since last counted (the scoreboard's objective
   * column, however the mode credits it) go to them and their squad; `second`: King of the Hill's second on the hill
   * for every living player of the team alone holding it.
   */
  tallySquads(second) {
    const ft = this.fireteams;
    if (!ft) return;
    for (const c of this.combatants()) ft.scores.objectives(c.slot, c.objective, ft.squadOf(c.slot)?.id);
    const koth = second && this.mode instanceof KothMode ? this.mode : null;
    if (!koth || !koth.holder || koth.holder === "contested") return;
    for (const c of this.combatants()) if (c.alive && c.faction === koth.holder && onHill(koth.hill, c.move.pos)) ft.scores.hill(c.slot, ft.squadOf(c.slot)?.id);
  }
  /** Fireteams: a bot's unit for the mode's roles (its bot-led squad's id; null: in a person's squad; undefined: none). */
  squadUnit = (slot) => {
    const s = this.fireteams?.squadOf(slot);
    return s ? s.human ? null : s.id : void 0;
  };
  /** Fireteams follow-ups: any slot's squad for the mode's squad roles (its id, a person leads it, they've given it an order). */
  squadInfo = (slot) => {
    const s = this.fireteams?.squadOf(slot);
    return s ? { id: s.id, human: s.human, ordered: s.ordered } : void 0;
  };
  /**
   * Fireteams follow-ups: a person's squad plays its mode role by itself (CTF: Defend, the smallest of 4+ squads) until
   * the person gives it an order; meanwhile its bots play the role as a bot-led squad's do (ctfBotGoal's defend: round
   * our flag's base, to our dropped flag, after its carrier).
   */
  roleDefault(s) {
    return s.human && !s.ordered && this.mode?.squadRole?.(s.id) === "defend";
  }
  /** What the squads' step reads of the match (formations: sight lines at chest height, the walkable ground). */
  squadWorld = {
    member: (slot) => {
      const c = this.slots[slot];
      return c ? { alive: c.alive, pos: c.move.pos, yaw: c.yaw, carrying: !!this.mode?.blocksVehicle(c) } : null;
    },
    target: (slot) => {
      const c = this.actor(slot);
      return c?.alive ? c.move.pos : null;
    },
    clear: (a, b) => {
      const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      if (d < 1e-3) return 0;
      const hit = this.physics.raycastWorld(a, { x: (b.x - a.x) / d, y: (b.y - a.y) / d, z: (b.z - a.z) / d }, d);
      return hit === null ? d : hit;
    },
    ground: (p) => this.nav.closestPoint(p, SPOT_GROUND)
  };
  /** The squads' news as events: a new leader, an order (the match's own, as a squad forms up or an order ends). */
  squadNotes(notes) {
    for (const n of notes) {
      const sq = n.squad;
      if (n.a === "lead") this.pendingEvents.push({ e: "squad", a: "lead", s: n.slot, sq: sq.id, n: sq.members.length, ...n.human ? { h: 1 } : {}, ...n.from !== null ? { from: n.from } : {}, team: sq.team });
      else if (sq.leader !== null) this.pendingEvents.push({ e: "squad", a: "order", s: sq.leader, sq: sq.id, k: ORDER_KINDS.indexOf(n.order.kind), ...n.order.auto ? { auto: 1 } : {}, team: sq.team });
    }
  }
  /**
   * A leader's order from the wheel (or the B menu's Follow me / Hold here): checked (sim/fireteams.ts checkOrder:
   * only a person leading a squad, alive; Go there their fresh ping or the point they aim at; Attack that the enemy in
   * their sights or their fresh ping's; Defend the objective the mode's nearest), then given to the squad, and the
   * first member alive answers (the callout). A refused order tells the leader why.
   */
  squadOrder(c, kind) {
    const ft = this.fireteams;
    if (!ft || !c.faction) return;
    const s = ft.ledBy(c.slot);
    const aim = c.alive ? this.aimAt(c) : null;
    const lp = c.lastPing;
    const pinged = lp?.target != null ? this.actor(lp.target) : null;
    const ping = lp ? { pos: lp.pos, target: pinged?.alive && this.hostile(c, pinged) ? pinged.slot : null, age: (this.tick - lp.tick) / TICK_RATE } : null;
    const r = checkOrder(kind, {
      leads: !!s?.human,
      alive: c.alive,
      pos: c.move.pos,
      aim: aim?.at ?? null,
      aimEnemy: aim?.target?.alive && this.hostile(c, aim.target) ? aim.target.slot : null,
      ping: ping && (lp.target === null || ping.target !== null) ? ping : null,
      objective: kind === "defend" ? this.squadObjective(c.faction, c.move.pos) : null
    });
    if (!r.ok || !s) {
      this.pendingEvents.push({ e: "squad", a: "deny", s: c.slot, n: REFUSALS.indexOf(r.ok ? "notLeader" : r.why), team: c.faction });
      return;
    }
    ft.order(s, kind, r.pos, r.target, this.tick);
    const k = ORDER_KINDS.indexOf(kind);
    const sp = kind === "spacing" ? { n: SQUAD_SPACINGS.indexOf(s.spacing) } : {};
    this.pendingEvents.push({ e: "squad", a: "order", s: c.slot, sq: s.id, k, ...sp, team: s.team });
    const target = r.target !== null ? this.actor(r.target) : null;
    let answered = false;
    for (const m of s.members) {
      const b = this.slots[m];
      if (!b || b === c || !b.alive || b.kind !== "bot") continue;
      if (!answered) {
        answered = true;
        this.pendingEvents.push({ e: "squad", a: "ack", s: b.slot, sq: s.id, k, ...sp, team: s.team });
      }
      if (target) b.bot?.alert(target.move.pos, this.tick);
    }
  }
  /**
   * The objective a squad defends: the mode's own for the side, nearest the leader (ModeLogic.defendSpot: the hill in
   * play, the sector's objectives, our flag), else the nearest end of the side's trips to hold (the sites, the
   * hostages), else any trip's end (the site to plant at); null in Team Deathmatch.
   */
  squadObjective(team, near2) {
    const own = this.mode?.defendSpot?.(team, near2);
    if (own !== void 0) return own;
    const trips = this.botTrips().filter((t) => t.team === team && t.kind !== "carry");
    const pick = (list2) => {
      let best = null;
      for (const t of list2) if (!best || horizontalDistance(t.to, near2) < horizontalDistance(best, near2)) best = t.to;
      return best;
    };
    return pick(trips.filter((t) => t.kind === "defend")) ?? pick(trips);
  }
  /** Fireteams: where a squad member goes (its squad's order; its leader's way), or null (not a member: its own goals). */
  fireteamGoal(c) {
    const s = c.kind === "bot" ? this.fireteams?.squadOf(c.slot) : void 0;
    if (!s || s.leader === null || s.leader === c.slot) return null;
    if (this.roleDefault(s)) return null;
    const leader = this.slots[s.leader];
    const t = s.order.kind === "attack" && s.order.target !== null ? this.actor(s.order.target) : null;
    return memberGoal(s, c.slot, leader?.alive ? s.anchor ?? leader.move.pos : null, t?.alive ? t.move.pos : null, { me: c.move.pos, tick: this.tick });
  }
  /**
   * Fireteams (Part 2): a bot-led squad playing its play (the mode's goal, the leader's team-brain job) bounds by its
   * halves while it is on the move (the leader and every other member, then the rest: `OrderGoal.half`), so one half
   * covers, firing at where the enemy went, while the other moves up. Any other bot: as it was.
   */
  fireteamPlayGoal(c, g) {
    const s = this.fireteams.squadOf(c.slot);
    if (!s || s.human || !g || this.tick >= s.movingUntil || !g.push || g.half !== void 0) return g;
    return { ...g, half: squadHalf(s, c.slot) };
  }
  /**
   * Fireteams: a squadmate respawns beside its leader when it's safe there (spawns.ts leaderSpotSafe: no enemy within
   * 20 m, no fresh deaths, out of sight of the nearest enemies; the leader on foot on the ground, not hurt lately, and
   * where the mode allows a squad spawn), else (null) at the team's spawn. Undefined: not a squadmate (the usual rule).
   */
  fireteamSpawn(c) {
    const s = c.kind === "npc" ? void 0 : this.fireteams?.squadOf(c.slot);
    if (!s || s.leader === null || s.leader === c.slot) return void 0;
    const l = this.slots[s.leader];
    if (!l?.alive || l.mount || !l.move.grounded || this.tick - (l.hurtAt ?? -Infinity) < TICK_RATE * 4) return null;
    if (this.mode?.spawnBeside?.(c, l) === false) return null;
    const enemies = [];
    for (const o of this.actors()) if (o.alive && this.hostile(c, o)) enemies.push(o.move.pos);
    if (!leaderSpotSafe(l.move.pos, { tick: this.tick, enemies, deaths: this.recentDeaths, sees: (a, b) => this.sees(a, b) })) return null;
    return this.besideMate(l);
  }
  applyInputs(c) {
    const n = Math.min(MAX_INPUTS_PER_TICK, c.queue.length);
    for (let i = 0; i < n; i++) {
      const input = c.queue.shift();
      c.lastSeq = input.seq;
      c.yaw = input.yaw;
      c.pitch = input.pitch;
      const pick = this.classes && !c.npc ? classFromSay(input.say) : null;
      if (pick) {
        this.classes.choose(c, pick);
        input.say = void 0;
      }
      if (this.roulette?.input(c, input.say)) input.say = void 0;
      if (!c.alive) continue;
      if (c.shieldUntil && input.buttons & (BUTTON_FIRE | BUTTON_ALT | BUTTON_THROW | BUTTON_MELEE)) c.shieldUntil = 0;
      if (input.rc) counterRecoil(c.gun, input.rc[0], input.rc[1]);
      const ordered = orderFromSay(input.say);
      if (ordered) {
        if (!c.npc && this.tick >= (c.orderAt ?? 0)) {
          c.orderAt = this.tick + Math.round(TICK_RATE * 0.3);
          this.squadOrder(c, ordered);
        }
        input.say = void 0;
      }
      if (input.say === PING && !c.npc && this.tick >= (c.pingAt ?? 0)) {
        c.pingAt = this.tick + Math.round(TICK_RATE * 0.75);
        this.ping(c);
      } else if (input.say && !c.npc && this.tick >= (c.sayAt ?? 0)) {
        c.sayAt = this.tick + TICK_RATE;
        if (input.say === SAY_FOLLOW || input.say === SAY_HOLD) {
          if (this.fireteams?.ledBy(c.slot)) this.squadOrder(c, input.say === SAY_FOLLOW ? "follow" : "hold");
          else this.orderBots(c, input.say === SAY_FOLLOW ? "follow" : "hold");
        }
        if (this.rules.emotes !== false) {
          if (input.say === EMOTE_DANCE) c.emoteUntil = this.tick + TICK_RATE * 3;
          else if (input.say <= QUICK_MESSAGES.length) this.pendingEvents.push({ e: "say", s: c.slot, m: input.say, ...this.teams && c.faction ? { team: c.faction } : {} });
        }
      }
      if (c.emoteUntil && (input.forward || input.right || input.buttons & BUTTON_FIRE)) c.emoteUntil = void 0;
      if (input.buttons & BUTTON_RESPAWN && !c.npc) {
        this.kill(c, null, "core.respawn");
        continue;
      }
      if (input.weapon && input.weapon !== c.current && c.weapons.has(input.weapon)) this.switchTo(c, input.weapon);
      const zipBefore = c.move.zip;
      const seat = c.mount ? this.seatOf(c) : null;
      if (seat) {
        const m = this.mounts[c.mount.index];
        c.rideCrouch = seat.role !== "driver" && !seat.seated && !m.def.airplane && !!(input.buttons & BUTTON_CROUCH);
        if (m.def.airplane && input.buttons & BUTTON_JUMP && !(input.buttons & BUTTON_USE)) {
          if (this.mayJumpOut(c, m)) {
            this.leaveMount(c, true);
            continue;
          }
        }
        if (seat.role === "driver") {
          const up = !!(input.buttons & BUTTON_JUMP);
          const down = !!(input.buttons & BUTTON_CROUCH);
          let right = input.right;
          if (input.buttons & BUTTON_STEER_LOOK && m.def.vehicle && !m.def.vehicle.fly) {
            const off = Math.atan2(Math.sin(c.yaw - m.yaw), Math.cos(c.yaw - m.yaw));
            right = Math.max(-1, Math.min(1, right + off * LOOK_STEER_GAIN * (m.speed < -0.5 ? -1 : 1)));
          }
          m.drive = m.def.vehicle?.fly ? { forward: input.forward, right, lift: (up ? 1 : 0) - (down ? 1 : 0) } : { forward: input.forward, right, brake: up };
        }
        if (seat.arc !== void 0) {
          const centre = m.yaw + (seat.facing ?? 0);
          const d = Math.atan2(Math.sin(c.yaw - centre), Math.cos(c.yaw - centre));
          c.yaw = centre + Math.max(-seat.arc, Math.min(seat.arc, d));
        }
        c.pitch = Math.max(-0.5, Math.min(0.75, c.pitch));
        const gunSeat2 = this.gunSeatOf(c);
        if (gunSeat2 !== null && (m.def.turret === void 0 || m.def.turret.seat === gunSeat2)) {
          const want = gunSeat2 === c.mount.seat ? c.yaw : this.arcYaw(m, gunSeat2, c.yaw, true);
          const traverse = m.def.turret?.traverse;
          if (traverse) {
            const d = Math.atan2(Math.sin(want - m.aimYaw), Math.cos(want - m.aimYaw));
            const step = traverse * TICK_DT;
            m.aimYaw += Math.max(-step, Math.min(step, d));
          } else m.aimYaw = want;
          m.aimPitch = c.pitch;
        }
      } else {
        const ridden = zipBefore === void 0 ? this.scenario.carry(c.move.pos) : null;
        if (ridden) c.move = { ...c.move, pos: ridden };
        else if (this.scenario.strike(c.move.pos, PLAYER.radius * c.size, PLAYER.height * c.size) > 0) {
          this.damage(c, 500, null, "core.roadkill");
          if (!c.alive) continue;
        }
        const was = c.move.pos;
        const before = c.move;
        const detail = ridden ? "full" : this.relaxedMove(c, input);
        if (detail === "far" && !c.moveOwed && (this.tick + c.slot) % 2 === 0) c.moveOwed = true;
        else {
          const dt = c.moveOwed ? TICK_DT * 2 : TICK_DT;
          c.moveOwed = false;
          const env = this.moveEnv;
          env.liquids = this.liquids;
          env.jet = c.jetFuel !== null && c.jetFuel >= JET.burn;
          env.ladders = this.ladders;
          env.scale = c.size;
          env.jump = c.stats.jump;
          env.stamina = c.stats.stamina;
          env.gravity = this.phys.gravity;
          env.gravityZones = this.gravityZones.length ? this.gravityZones : void 0;
          env.airJumps = c.cls ? this.classes?.airJumps(c) ?? 0 : void 0;
          env.jetpack = c.jetFuel !== null ? true : void 0;
          env.glider = c.glider ? true : void 0;
          env.autoChute = c.kind !== "human" ? true : void 0;
          env.ground = detail !== "full" && this.groundAt ? this.groundAt : void 0;
          env.ziplines = this.ziplines.length ? this.ziplines : void 0;
          env.team = this.ziplines.length ? c.faction : void 0;
          if (c.bot && c.move.zip !== void 0) input.buttons &= -18;
          const stepped = stepMovement(this.physics, c.collider, c.move, input, (c.speedTicks > 0 ? SPEED_BOOST : 1) * c.speedMul * statusSpeed(c), dt, this.tractionAt(c.move.pos), env);
          c.move = applyPads(this.pads, stepped);
          const through = this.scenario.portals.length && c.move.zip === void 0 ? applyPortals(this.scenario.portals, before, c.move, this.scenario.portalOn, c.size, bodyHeightOf(c.move, c.size)) : null;
          if (through) {
            c.move = through.state;
            c.yaw += through.turn;
            c.bot?.turned(through.turn);
          }
          this.trackFall(c, before, c.move !== stepped);
          c.moveSpeed = hypot(c.move.pos.x - was.x, c.move.pos.z - was.z) / dt;
          if (c.jetFuel !== null) c.jetFuel = stepJetFuel(c.jetFuel, !!c.move.jet);
        }
      }
      if (c.fireCooldown > 0) c.fireCooldown--;
      if (c.throwCooldown > 0) c.throwCooldown--;
      if (c.meleeCooldown > 0) c.meleeCooldown--;
      if (c.raiseTicks > 0) c.raiseTicks--;
      if (c.speedTicks > 0) c.speedTicks--;
      if (c.damageTicks > 0) c.damageTicks--;
      this.advanceReload(c);
      if (input.buttons & BUTTON_USE && c.move.zip !== void 0 !== (zipBefore !== void 0)) input.buttons &= ~BUTTON_USE;
      if (input.buttons & BUTTON_USE) {
        c.useTick = this.tick;
        if (c.mount) {
          const ride = this.mounts[c.mount.index];
          if (!ride?.route || this.mayJumpOut(c, ride)) this.leaveMount(c, true);
        } else if (!this.resupplyAtBox(c) && !this.resupplyAtMount(c) && !this.enterMount(c)) this.scenario.use(c.slot, { x: c.move.pos.x, y: c.move.pos.y + PLAYER.eyeHeight, z: c.move.pos.z }, c.yaw, c.pitch);
        if (this.phase !== "playing") break;
      }
      if (!c.mount && this.mode?.useInput?.(c, input)) input.buttons &= -47;
      const seatNow = c.mount ? this.seatOf(c) : null;
      const gunSeat = this.gunSeatOf(c);
      const gun = gunSeat !== null ? this.mounts[c.mount.index].guns[gunSeat] : null;
      const held = gun ?? heldWeapon(c);
      const unarmed = seatNow?.role === "driver" && !gun || !!c.mount && !!this.mounts[c.mount.index].def.airplane || c.move.zip !== void 0 && !gun && !oneHanded(held.def);
      const def = held.def;
      c.thirdPerson = c.kind === "human" && !c.mount && (input.buttons & BUTTON_THIRD_PERSON) !== 0;
      const fireDown = (input.buttons & BUTTON_FIRE) !== 0;
      const pressed = input.buttons & ~c.prevButtons;
      c.prevButtons = input.buttons;
      if (!fireDown) c.semiLatch = false;
      if (c.reload && (pressed & BUTTON_SPRINT && input.forward > 0 || pressed & BUTTON_USE)) this.cancelReload(c);
      if (input.buttons & BUTTON_RELOAD) this.startReload(c);
      const frozen = c.frozenTicks > 0;
      const gp = gunplayOf(def);
      stepAds(c.gun, gp.accuracy, !!(input.buttons & BUTTON_ZOOM) && !gun);
      if (c.reload && !gun && c.fireCooldown === 0 && c.raiseTicks === 0) {
        const swing = def.kind === "melee" && (fireDown && !c.semiLatch || (pressed & BUTTON_MELEE) !== 0);
        const shoot = fireDown && !c.semiLatch && roundsReady(held) > 0 || input.buttons & BUTTON_ALT && !fireDown && def.alt?.reload && held.alt >= def.alt.cost;
        if (swing || shoot) this.cancelReload(c);
      }
      const ready = c.fireCooldown === 0 && (gun ? this.turretOnAim(c) : c.raiseTicks === 0) && c.reloadTicks === 0 && !frozen && !unarmed;
      if (def.windupTicks) {
        const able = fireDown && c.raiseTicks === 0 && c.reloadTicks === 0 && !frozen && !held.overheated && (def.magazine === 0 || roundsReady(held) > 0);
        c.windup = able ? Math.min(def.windupTicks, c.windup + 1) : Math.max(0, c.windup - 2);
      }
      let fired = false;
      if (c.burstLeft > 0) {
        if (--c.burstTimer <= 0) {
          if (!frozen && c.reloadTicks === 0 && spendRound(held)) {
            this.fire(c, primaryTrigger(def), input.viewTick ?? 0);
            fired = true;
            c.burstLeft--;
            c.burstTimer = def.burst?.intervalTicks ?? 1;
          } else c.burstLeft = 0;
        }
      } else if (fireDown && ready && !c.semiLatch && (!def.windupTicks || c.windup >= def.windupTicks)) {
        if (def.magazine > 0 && roundsReady(held) === 0) this.startReload(c);
        else if (spendRound(held)) {
          const mode = def.fireMode ?? "auto";
          c.fireCooldown = def.fireIntervalTicks;
          c.semiLatch = mode !== "auto";
          this.fire(c, primaryTrigger(def), input.viewTick ?? 0);
          fired = true;
          if (mode === "burst" && def.burst) {
            c.burstLeft = def.burst.count - 1;
            c.burstTimer = def.burst.intervalTicks;
          }
          if (def.windupResets) c.windup = 0;
        }
      } else if (input.buttons & BUTTON_ALT && ready && held.def.alt) {
        const alt = held.def.alt;
        if (alt.ammo === "own" ? held.alt >= alt.cost : held.mag >= alt.cost) {
          if (alt.ammo === "own") held.alt -= alt.cost;
          else held.mag -= alt.cost;
          c.fireCooldown = alt.fireIntervalTicks;
          this.fire(c, altTrigger(held.def, alt), input.viewTick ?? 0);
        } else if (alt.ammo === "shared" || alt.reload) this.startReload(c);
      }
      if (pressed & BUTTON_MELEE && !c.mount && !frozen && !fired) {
        if (def.kind === "melee" && !getWeapon(def.id).heal) {
          if (ready && spendRound(held)) {
            c.fireCooldown = def.fireIntervalTicks;
            this.fire(c, primaryTrigger(def), input.viewTick ?? 0);
            fired = true;
          }
        } else {
          if (c.reload) this.cancelReload(c);
          if (c.meleeCooldown === 0 && !def.projectile?.disc) this.strike(c, unarmedStrike(input.forward, this.tick - c.punchedAt), input.viewTick ?? 0);
        }
      }
      if (input.buttons & BUTTON_AUTO_RELOAD && !gun && !unarmed && !frozen && !fired && autoReloadDue(def, held, c, (input.buttons & BUTTON_SPRINT) !== 0 && input.forward > 0 || (input.buttons & BUTTON_MELEE) !== 0)) this.startReload(c);
      if (fired && gun) gun.firedTick = this.tick;
      for (const w of c.weapons.values()) {
        if (!w.def.heat || fired && w === held) continue;
        w.heat = Math.max(0, (w.heat ?? 0) - w.def.heat.coolPerTick);
        if (w.heat === 0) w.overheated = false;
      }
      if (!fired && c.bloom > 0) c.bloom = Math.max(0, c.bloom - (def.recoil?.recover ?? 2e-3));
      if (!fired) recoilIdle(c.gun, gp.kick, gp.accuracy, def.fireIntervalTicks);
      if (input.buttons & BUTTON_THROW && !frozen && !gun && c.cls && this.classes?.useAbility(c)) ;
      else if (input.buttons & BUTTON_THROW && c.throwCooldown === 0 && c.throwable && c.throwable.count > 0 && !frozen && !unarmed && !gun) {
        const def2 = THROWABLE_DEFS[c.throwable.kind];
        c.throwCooldown = def2.throwIntervalTicks;
        if (--c.throwable.count === 0) c.throwable = null;
        this.launch(c, def2.projectile, throwableWeaponId(def2.kind), 0.12);
        this.pendingEvents.push({ e: "throw", s: c.slot });
      }
      if (c.mount) ;
      else if (!c.npc) this.collectPickups(c);
      else if (held.reserve < held.def.magazine) held.reserve = held.def.reserveMax;
      if (c.move.pos.y < this.killY) this.fallKill(c);
      if (!c.alive) break;
    }
  }
  // ---------------------------------------------------------------- weapons
  switchTo(c, code) {
    const w = c.weapons.get(code);
    if (!w) return;
    c.current = code;
    c.raiseTicks = w.def.raiseTicks;
    this.cancelReload(c);
    c.windup = 0;
    c.burstLeft = 0;
    c.bloom = 0;
    c.gun.shots = 0;
    c.gun.spray = 0;
    c.gun.ads = 0;
  }
  /** Start a reload of the held weapon: a staged magazine change or round by round (gunplay.ts). */
  startReload(c) {
    if (c.reloadTicks > 0) return;
    const w = heldWeapon(c);
    const run = beginReload(w.def, w);
    if (!run) return;
    c.reload = run;
    c.reloadTicks = run.total;
    c.burstLeft = 0;
  }
  /** Stop a reload where it is: the ammunition keeps the stage it reached. */
  cancelReload(c) {
    c.reload = null;
    c.reloadTicks = 0;
  }
  /** One applied input of reloading (something else zeroing `reloadTicks` cancels it). */
  advanceReload(c) {
    if (!c.reload || c.reloadTicks === 0) {
      c.reload = null;
      c.reloadTicks = 0;
      return;
    }
    const w = heldWeapon(c);
    c.reload = stepReload(w.def, w, c.reload);
    c.reloadTicks = c.reload ? Math.max(1, c.reload.total - c.reload.t) : 0;
  }
  /** Where a shooter's rounds go: the view plus the mechanical recoil offset. */
  /**
   * Where a shot goes: the view plus the gun's recoil offset. In third person the view is first turned, from
   * the eye, onto what the crosshair is on (sim/thirdPerson.ts), worked out here from the host's own world and
   * `targets` (as the shooter saw them): the client only says the view is third person.
   */
  aimOf(c, targets) {
    let yaw = c.yaw;
    let pitch = c.pitch;
    if (c.thirdPerson && !c.mount) {
      const eye = { x: c.move.pos.x, y: c.move.pos.y + eyeHeightOf(c.move, c.size), z: c.move.pos.z };
      const bodies = targets ? (o, d, max) => {
        let best = null;
        for (const t of targets) {
          const h = rayTarget(o, d, t, max);
          if (h !== null && h < max && (best === null || h < best)) best = h;
        }
        return best;
      } : void 0;
      ({ yaw, pitch } = thirdPersonAim(this.worldRay, eye, yaw, pitch, bodies));
    }
    return viewDirection(yaw + c.gun.ry, Math.max(-1.55, Math.min(1.55, pitch + c.gun.rp)));
  }
  /** Level geometry along a ray (third-person aim). */
  worldRay = (o, d, max) => this.physics.raycastWorld(o, d, max);
  /** Launch a projectile from the eye along the aim (lifted a little for throws, so they arc). */
  launch(shooter, spec, weapon, lift = 0, spread2 = 0) {
    const eye = { x: shooter.move.pos.x, y: shooter.move.pos.y + eyeHeightOf(shooter.move, shooter.size), z: shooter.move.pos.z };
    const aim = this.spreadDir(lift ? normalize(add(viewDirection(shooter.yaw, shooter.pitch), { x: 0, y: lift, z: 0 })) : this.aimOf(shooter, shooter.thirdPerson ? this.targetsFor(shooter, 0, true) : void 0), spread2);
    this.projectiles.push({
      id: this.nextProjectileId++,
      owner: shooter.slot,
      spec,
      weapon,
      pos: add(eye, scale(aim, 0.5)),
      vel: scale(aim, spec.speed),
      ticksLeft: Math.round(spec.fuseSeconds * TICK_RATE),
      age: 0,
      ...shooter.mount ? { fromMount: shooter.mount.index } : {}
    });
  }
  fire(shooter, def, viewTick) {
    this.physics.shotSkip = shooter.mount ? this.mounts[shooter.mount.index]?.body ?? null : null;
    const ride = shooter.mount ? this.mounts[shooter.mount.index] : void 0;
    const gunSeat = ride ? this.gunSeatOf(shooter) : null;
    const lookYaw = shooter.yaw;
    if (ride && gunSeat !== null && gunSeat !== shooter.mount.seat) shooter.yaw = this.arcYaw(ride, gunSeat, lookYaw, true);
    try {
      if (!simProfile.on) return this.fireNow(shooter, def, viewTick);
      const t0 = performance.now();
      this.fireNow(shooter, def, viewTick);
      simProfile.add("fire", performance.now() - t0);
      simProfile.count("fire");
    } finally {
      this.physics.shotSkip = null;
      shooter.yaw = lookYaw;
    }
  }
  fireNow(shooter, def, viewTick) {
    const eye = { x: shooter.move.pos.x, y: shooter.move.pos.y + eyeHeightOf(shooter.move, shooter.size), z: shooter.move.pos.z };
    const aim = this.aimOf(shooter, shooter.thirdPerson ? this.targetsFor(shooter, viewTick, true) : void 0);
    const gp = gunplayOf(getWeapon(def.id));
    let spread2;
    if (gp.accuracy && !def.alt) {
      spread2 = shotCone(def, gp.accuracy, shooter.gun, { run: shooter.moveSpeed / PLAYER.runSpeed, airborne: !shooter.move.grounded, stance: STANCE_SPREAD[stanceOf(shooter.move)] });
      const zoom = getWeapon(def.id).view.zoomFov;
      if (zoom && !shooter.npc && shooter.gun.ads < 0.5) spread2 += zoom < 0.5 ? NO_SCOPE_SPREAD : 0.012;
    } else {
      spread2 = aimSpread(shooter, def, def.spread + (def.alt ? 0 : shooter.bloom) + movementSpread(shooter, def)) * STANCE_SPREAD[stanceOf(shooter.move)];
      if (def.recoil && !def.alt) shooter.bloom = Math.min(def.recoil.maxBloom, shooter.bloom + def.recoil.bloom);
    }
    if (!def.alt && def.kind !== "melee") recoilShot(shooter.gun, gp.kick);
    else if (def.alt && def.kick) recoilShot(shooter.gun, def.kick);
    if (def.kind === "projectile" && def.projectile?.disc && !def.alt) {
      this.throwDisc(shooter, def.projectile, def.id);
      return;
    }
    if (def.kind === "projectile" && def.projectile) {
      for (let p = 0; p < Math.max(1, def.pellets); p++) this.launch(shooter, def.projectile, def.id, 0, spread2);
      if (def.alt) this.pendingEvents.push({ e: "shot", s: shooter.slot, w: def.id, from: tuple(eye), to: [], hit: [], alt: 1 });
      return;
    }
    const grapple = getWeapon(def.id).grapple;
    if (grapple) {
      this.fireGrapple(shooter, eye, aim, def, grapple.speed);
      return;
    }
    const heal = getWeapon(def.id).heal;
    if (heal) {
      this.useMedkit(shooter, eye, aim, heal, def.range);
      return;
    }
    const targets = this.targetsFor(shooter, viewTick);
    if (def.kind === "melee") {
      const { hit, body } = this.meleeTrace(shooter, eye, def.range, targets);
      this.pendingEvents.push({ e: "melee", s: shooter.slot, hit });
      if (hit !== null) {
        const victim = this.actor(hit);
        this.damage(victim, def.damage, shooter, def.id);
        this.stagger(victim, this.powerOf(def.id), viewDirection(shooter.yaw, 0), 1);
        if (def.knockback && victim.alive) this.push(victim, viewDirection(shooter.yaw, 0), def.knockback);
      } else if (body !== null && !this.damageMountBody(body, this.boosted(shooter, def.damage), shooter, "melee")) this.scenario.damageBody(body, this.boosted(shooter, def.damage), shooter.slot);
      return;
    }
    if (gp.ballistic && !def.alt && def.kind === "hitscan") {
      this.fireBullets(shooter, def, gp, eye, aim, spread2, viewTick, targets);
      return;
    }
    const to = [];
    const hits = [];
    const zones = [];
    const bodies = [];
    const struck = [];
    for (let p = 0; p < def.pellets; p++) {
      const dir = this.spreadDir(aim, spread2);
      const world = this.physics.raycastHit(eye, dir, def.range);
      if (def.pierce) {
        const wallAt = world?.dist ?? def.range;
        const along = targets.map((t) => {
          const d = rayTarget(eye, dir, t, wallAt);
          return { slot: t.slot, d, zone: d === null ? 0 : lastHit.zone };
        }).filter((t) => t.d !== null && t.d < wallAt).sort((a, b) => a.d - b.d).slice(0, def.pierce + 1);
        const panes = this.scenario.glassAlong(eye, dir, wallAt);
        this.scenario.shootGlass(eye, dir, wallAt, shooter.slot);
        for (const t of along) struck.push({ slot: t.slot, dir, zone: t.zone, dist: t.d, keep: GLASS.passDamage ** panes.filter((d) => d < t.d).length });
        to.push(tuple(add(eye, scale(dir, wallAt))));
        hits.push(along[0]?.slot ?? null);
        zones.push(along[0]?.zone ?? 0);
        if (world) bodies.push({ handle: world.handle, dist: wallAt, at: add(eye, scale(dir, wallAt)) });
        continue;
      }
      const shot = resolveHitscan(eye, dir, def.range, world?.dist ?? null, targets);
      const broke = this.scenario.shootGlass(eye, dir, hypot(shot.end.x - eye.x, shot.end.y - eye.y, shot.end.z - eye.z), shooter.slot);
      to.push(tuple(shot.end));
      hits.push(shot.hitSlot);
      const zone = shot.hitSlot !== null ? shot.zone : 0;
      zones.push(zone);
      if (shot.hitSlot !== null) struck.push({ slot: shot.hitSlot, dir, zone, dist: shot.distance, keep: GLASS.passDamage ** broke });
      else if (world) bodies.push({ handle: world.handle, dist: world.dist, at: shot.end });
    }
    this.pendingEvents.push({ e: "shot", s: shooter.slot, w: def.id, from: tuple(eye), to, hit: hits, ...zones.some((z) => z) ? { z: zones } : {}, ...def.alt ? { alt: 1 } : {} });
    const falloff = def.falloff ?? gp.falloff;
    for (const { slot, dir, zone, dist, keep } of struck) {
      const victim = this.actor(slot);
      const zoneK = zone === 1 && def.alt && def.headshot !== void 0 ? def.headshot : zoneScale(gp, zone);
      this.damage(victim, def.damage * zoneK * falloffAt(falloff, dist) * keep, shooter, def.id, zone === 1);
      if (def.status) this.applyStatus(victim, def.status, shooter, def.id);
      this.stagger(victim, this.powerOf(def.id), dir, falloffAt(falloff, dist) * keep / Math.max(1, def.pellets));
      if (def.knockback) this.push(victim, dir, def.knockback);
    }
    for (const b of bodies) {
      this.noteTargetHit(shooter, b.handle, this.boosted(shooter, def.damage) * falloffAt(falloff, b.dist), b.at);
      if (!this.damageMountBody(b.handle, this.boosted(shooter, def.damage), shooter, "bullet", def.id)) this.scenario.damageBody(b.handle, this.boosted(shooter, def.damage), shooter.slot);
    }
    if (def.chain && struck.length) this.chainLightning(shooter, def, struck[0].slot, eye);
  }
  /** Disc Arena: throw a disc (or, with a power disc, a fast, triple, splitting or freezing throw). */
  throwDisc(shooter, spec, weapon) {
    const power = shooter.discPower ?? null;
    const eye = { x: shooter.move.pos.x, y: shooter.move.pos.y + eyeHeightOf(shooter.move, shooter.size), z: shooter.move.pos.z };
    discThrows(spec, power?.kind ?? null).forEach((t, i) => {
      const aim = viewDirection(shooter.yaw + t.yaw, shooter.pitch);
      this.projectiles.push({ id: this.nextProjectileId++, owner: shooter.slot, spec: t.spec, weapon, pos: add(eye, scale(aim, 0.5)), vel: scale(aim, t.spec.speed), ticksLeft: Math.round(t.spec.fuseSeconds * TICK_RATE), age: 0, ...i > 0 ? { extra: true } : {} });
    });
    if (power && --power.shots <= 0) shooter.discPower = void 0;
  }
  /** A disc struck a player: shove them along its flight (credit for a fall), maybe freeze them. */
  discHit(victim, p, dir) {
    const disc = p.spec.disc;
    const owner = this.actor(p.owner);
    if (this.tick - (victim.spawnedAt ?? -Infinity) < DISC_SPAWN_GUARD_SECONDS * TICK_RATE) return;
    if (p.spec.status) this.applyStatus(victim, p.spec.status, owner ?? null, p.weapon);
    const h = hypot(dir.x, dir.z) || 1;
    victim.move = { ...victim.move, vx: (victim.move.vx ?? 0) + dir.x / h * disc.push, vz: (victim.move.vz ?? 0) + dir.z / h * disc.push, velY: Math.max(victim.move.velY, disc.lift), grounded: false };
    if (owner && owner !== victim) victim.knockedBy = { slot: owner.slot, tick: this.tick, weapon: p.weapon };
    victim.hurtAt = this.tick;
    this.pendingEvents.push({ e: "knock", s: p.owner, t: victim.slot });
  }
  /** Off the edge: a fall soon after an enemy's disc hit is their kill, otherwise your own. */
  fallKill(c) {
    const k = c.knockedBy;
    const by = k && this.tick - k.tick <= DISC_KNOCK_CREDIT_SECONDS * TICK_RATE ? this.actor(k.slot) : void 0;
    c.knockedBy = void 0;
    if (by && by !== c && this.hostile(by, c)) this.kill(c, by, k.weapon);
    else this.kill(c, null, "core.fall");
  }
  /** Lightning jumps from the first target to the nearest enemies in reach (with a clear line), weaker each jump. */
  chainLightning(shooter, def, first, from) {
    const chain = def.chain;
    const hit = /* @__PURE__ */ new Set([first]);
    let at2 = this.actor(first);
    let damage = def.damage;
    const pts = [tuple(from), tuple(chest(at2.move.pos))];
    for (let j = 0; j < chain.jumps; j++) {
      const here = chest(at2.move.pos);
      let next = null;
      let best = chain.range;
      for (const o of this.actors()) {
        if (!o.alive || hit.has(o.slot) || !this.hostile(shooter, o)) continue;
        const d = distance(here, chest(o.move.pos));
        if (d < best && this.physics.lineOfSight(here, chest(o.move.pos))) {
          best = d;
          next = o;
        }
      }
      if (!next) break;
      damage *= chain.falloff;
      hit.add(next.slot);
      pts.push(tuple(chest(next.move.pos)));
      this.damage(next, damage, shooter, def.id);
      at2 = next;
    }
    this.pendingEvents.push({ e: "arc", s: shooter.slot, pts });
  }
  /** Put a status effect on a player (kill credit for its damage goes to `by`). */
  applyStatus(c, st, by, weapon) {
    if (!c.alive || by && by !== c && !this.canHurt(by, c)) return;
    const ticks = Math.round(st.seconds * TICK_RATE);
    if (st.kind === "burn") c.burnTicks = Math.max(c.burnTicks, ticks);
    else if (st.kind === "poison") c.poisonTicks = Math.max(c.poisonTicks, ticks);
    else if (st.kind === "slow") c.slowTicks = Math.max(c.slowTicks, ticks);
    else if (c.frozenTicks === 0) {
      c.chill = Math.min(1, c.chill + (st.amount ?? 0.1));
      if (c.chill >= 1) {
        c.frozenTicks = FROZEN_TICKS;
        c.chill = 0;
      }
    }
    c.statusBy = by?.slot ?? null;
    c.statusWeapon = weapon;
  }
  /**
   * Stopping power (sim/impact.ts): a hit by `weapon` with `share` of a full shot's damage shoves a
   * living body a little along `dir` and slows it briefly, within the stagger caps and immunity.
   * Stays on the ground (no lift), so the ground's grip takes the shove back off quickly.
   */
  stagger(victim, power, dir, share) {
    if (!victim.alive || victim.mount || victim.invulnerable) return;
    const shove = hitImpact(victim.impact, power, share);
    if (shove <= 0) return;
    const h = hypot(dir.x, dir.z);
    if (h < 0.05) return;
    victim.move = { ...victim.move, vx: (victim.move.vx ?? 0) + dir.x / h * shove, vz: (victim.move.vz ?? 0) + dir.z / h * shove };
  }
  /** Stopping power by weapon id (cached). */
  stopping = /* @__PURE__ */ new Map();
  powerOf(weapon) {
    let power = this.stopping.get(weapon);
    if (power === void 0) {
      power = stoppingPower(getWeapon(weapon));
      this.stopping.set(weapon, power);
    }
    return power;
  }
  /** Three short rays in a narrow fan (forgiving melee without a full sweep): who it hits, or the body it strikes. A swing at a window smashes it. */
  meleeTrace(shooter, eye, range, shapes2) {
    let body = null;
    const targets = shapes2.map((t) => ({ slot: t.slot, feet: t.feet, height: t.height, radius: t.radius }));
    for (const yawOffset of [0, -0.3, 0.3]) {
      const dir = viewDirection(shooter.yaw + yawOffset, shooter.pitch);
      const world = this.physics.raycastHit(eye, dir, range);
      const shot = resolveHitscan(eye, dir, range, world?.dist ?? null, targets);
      if (yawOffset === 0) this.scenario.shootGlass(eye, dir, shot.distance, shooter.slot);
      if (shot.hitSlot !== null) return { hit: shot.hitSlot, body: null };
      if (world && body === null) body = world.handle;
    }
    return { hit: null, body };
  }
  /**
   * Unarmed quick melee (UNARMED): a punch or a kick at whoever is in reach. Small damage, a stagger
   * (stopping power) and, for a kick, a shove. Breaks into a reload like any emergency action.
   */
  strike(c, kind, viewTick) {
    const s = UNARMED[kind];
    c.meleeCooldown = s.cooldownTicks;
    if (kind === "punch") c.punchedAt = this.tick;
    else c.punchedAt = -1e3;
    if (c.reload) this.cancelReload(c);
    const eye = { x: c.move.pos.x, y: c.move.pos.y + eyeHeightOf(c.move, c.size), z: c.move.pos.z };
    const { hit, body } = this.meleeTrace(c, eye, s.range * c.size, this.targetsFor(c, viewTick));
    this.pendingEvents.push({ e: "melee", s: c.slot, hit, u: kind === "punch" ? 1 : 2 });
    if (hit !== null) {
      const victim = this.actor(hit);
      const dir = viewDirection(c.yaw, 0);
      this.damage(victim, s.damage, c, s.id);
      this.stagger(victim, s.stopping, dir, 1);
      if (s.shove && victim.alive && !victim.mount) this.push(victim, dir, s.shove);
    } else if (body !== null && !this.damageMountBody(body, this.boosted(c, s.damage), c, "melee")) this.scenario.damageBody(body, this.boosted(c, s.damage), c.slot);
  }
  /** Shove a player along `dir` (horizontal push plus a little lift). */
  push(c, dir, speed) {
    const h = hypot(dir.x, dir.z) || 1;
    c.move = { ...c.move, vx: (c.move.vx ?? 0) + dir.x / h * speed, vz: (c.move.vz ?? 0) + dir.z / h * speed, velY: Math.max(c.move.velY, speed * 0.45 + dir.y * speed * 0.5), grounded: false };
  }
  /** A blast throw (blastThrow): adds its sideways speed to the push and lifts at least as hard as it says. */
  throwBy(c, v) {
    if (!v.x && !v.y && !v.z) return;
    c.move = { ...c.move, vx: (c.move.vx ?? 0) + v.x, vz: (c.move.vz ?? 0) + v.z, velY: Math.max(c.move.velY, v.y), grounded: false };
  }
  /** Ground grip at a point: oil makes it slick. */
  tractionAt(pos) {
    for (const z of this.zones) if (z.kind === "oil" && inZone(z, pos)) return OIL_TRACTION;
    return 1;
  }
  /** Uniform random direction within a cone around `dir`. */
  spreadDir(dir, spread2) {
    if (spread2 <= 0) return dir;
    const a = this.rng() * Math.PI * 2;
    const r = Math.sqrt(this.rng()) * spread2;
    const up = Math.abs(dir.y) < 0.99 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const right = normalize({ x: up.y * dir.z - up.z * dir.y, y: up.z * dir.x - up.x * dir.z, z: up.x * dir.y - up.y * dir.x });
    const up2 = { x: dir.y * right.z - dir.z * right.y, y: dir.z * right.x - dir.x * right.z, z: dir.x * right.y - dir.y * right.x };
    return normalize(add(dir, add(scale(right, Math.cos(a) * r), scale(up2, Math.sin(a) * r))));
  }
  /**
   * Hit targets as the shooter saw them. Humans see remote players about one
   * round trip plus the interpolation delay in the past, so their shots are
   * resolved against recorded positions at the tick they were viewing
   * (bounded by MAX_REWIND_TICKS). Bots see the present.
   */
  targetsFor(shooter, viewTick, aimOnly = false) {
    let past;
    if (shooter.kind === "human" && viewTick > 0) {
      const t = Math.max(this.tick - MAX_REWIND_TICKS, Math.min(this.tick, viewTick));
      const e = this.history[t % HISTORY_TICKS];
      past = e?.tick === t ? e.at : void 0;
    }
    return this.actors().filter((o) => o.alive && !this.sheltered(o) && (aimOnly ? this.hostile(shooter, o) : this.canHurt(shooter, o))).map((o) => {
      const then = past?.get(o.slot);
      return then ? { slot: o.slot, feet: then, height: then.h, radius: PLAYER.radius * o.size, box: then.box, yaw: then.yaw, stance: then.stance, scale: then.scale, who: o } : this.shotBody(o);
    });
  }
  /** A combatant's body where it is now, for shots: its measured shapes, facing, stance and scale. */
  shotBody(o) {
    const box = hitboxOf(o);
    return { slot: o.slot, feet: o.move.pos, height: bodyHeightOf(o.move, o.size), radius: PLAYER.radius * o.size, box, yaw: o.yaw, stance: stanceOf(o.move), scale: o.hitScale * o.size, who: o };
  }
  recordHistory() {
    const i = this.tick % HISTORY_TICKS;
    const e = this.history[i] ?? (this.history[i] = { tick: -1, at: /* @__PURE__ */ new Map(), pool: /* @__PURE__ */ new Map() });
    e.tick = this.tick;
    e.at.clear();
    for (const c of this.actors()) {
      if (!c.alive) continue;
      let o = e.pool.get(c.slot);
      if (!o) e.pool.set(c.slot, o = { x: 0, y: 0, z: 0, h: 0, yaw: 0, stance: 0, scale: 1, box: c.hitbox });
      o.x = c.move.pos.x;
      o.y = c.move.pos.y;
      o.z = c.move.pos.z;
      o.h = bodyHeightOf(c.move, c.size);
      o.yaw = c.yaw;
      o.stance = stanceOf(c.move);
      o.box = hitboxOf(c);
      o.scale = c.hitScale * c.size;
      e.at.set(c.slot, o);
    }
  }
  stepProjectiles() {
    const keep = [];
    for (const p of this.projectiles) {
      const spec = p.spec;
      p.age++;
      const owner = this.actor(p.owner);
      if (p.stuckTo !== void 0) {
        const host = this.actor(p.stuckTo);
        if (host?.alive) p.pos = add(host.move.pos, p.stuckOffset);
        if (--p.ticksLeft <= 0) this.explode(p, p.pos);
        else keep.push(p);
        continue;
      }
      if (p.stuck && spec.retrievable) {
        if (this.retrieve(p)) continue;
        if (--p.ticksLeft <= 0) {
          const w = owner?.weapons.get(weaponCode(getWeapon(p.weapon)));
          if (w) w.mag = Math.min(w.def.magazine, w.mag + 1);
          continue;
        }
        keep.push(p);
        continue;
      }
      if (p.stuck) {
        const armed = this.tick >= (p.armAt ?? 0);
        const trigger = spec.mine?.triggerRadius ?? 0;
        const near2 = armed && this.actors().some((c) => c.alive && (!owner || c !== owner) && (!owner || this.hostile(owner, c)) && distance(chest(c.move.pos), p.pos) <= trigger);
        if (near2 || --p.ticksLeft <= 0) {
          this.explode(p, p.pos);
          continue;
        }
        keep.push(p);
        continue;
      }
      if (p.walking) {
        if (this.walk(p, owner ?? null)) keep.push(p);
        continue;
      }
      if (spec.homing && owner) this.steer(p, owner, spec.homing);
      if (spec.guided && owner?.alive) this.guide(p, owner, spec.guided.turnRate);
      if (spec.drag) p.vel = scale(p.vel, Math.max(0, 1 - spec.drag * TICK_DT));
      p.vel = { x: p.vel.x, y: p.vel.y - spec.gravity * TICK_DT, z: p.vel.z };
      const delta = scale(p.vel, TICK_DT);
      const len = hypot(delta.x, delta.y, delta.z);
      const dir = scale(delta, 1 / (len || 1));
      this.physics.shotSkip = p.fromMount !== void 0 ? this.mounts[p.fromMount]?.body ?? null : null;
      const wall = this.physics.raycastNormal(p.pos, dir, len);
      this.physics.shotSkip = null;
      const gate = this.scenario.portals.length ? portalSegment(this.scenario.portals, p.pos, add(p.pos, delta), this.scenario.portalOn) : null;
      if (gate && (!wall || wall.dist >= gate.t * len - 0.15)) {
        const at2 = add(p.pos, scale(delta, gate.t));
        const out = portalCarry(gate.a, gate.b, at2, p.vel);
        p.pos = out.pos;
        p.vel = out.vel;
        keep.push(p);
        continue;
      }
      if (len > 0) this.scenario.shootGlass(p.pos, dir, wall?.dist ?? len, p.owner);
      let hitDist = wall?.dist ?? null;
      let victim = null;
      for (const c of this.actors()) {
        if (!c.alive || c === owner && (p.age < OWNER_GRACE_TICKS || spec.disc)) continue;
        if (owner && c !== owner && !this.canHurt(owner, c)) continue;
        const d = rayTarget(p.pos, dir, this.shotBody(c), len, PROJECTILE_THICKNESS);
        if (d !== null && d <= len && (hitDist === null || d < hitDist)) {
          hitDist = d;
          victim = c;
        }
      }
      if (hitDist !== null) {
        const at2 = add(p.pos, scale(dir, Math.max(0, hitDist - 0.05)));
        if (victim && spec.retrievable) {
          if (spec.impactDamage) this.damage(victim, spec.impactDamage, owner ?? null, p.weapon);
          const down = this.physics.raycastHit({ x: at2.x, y: at2.y + 0.2, z: at2.z }, { x: 0, y: -1, z: 0 }, 4);
          p.pos = { x: at2.x, y: down ? at2.y + 0.2 - down.dist + 0.1 : victim.move.pos.y + 0.1, z: at2.z };
          p.vel = { x: 0, y: 0, z: 0 };
          p.stuck = true;
          keep.push(p);
          continue;
        }
        if (victim && spec.sticky === "any") {
          if (spec.impactDamage) this.damage(victim, spec.impactDamage, owner ?? null, p.weapon);
          if (spec.status) this.applyStatus(victim, spec.status, owner ?? null, p.weapon);
          p.stuckTo = victim.slot;
          const ox = at2.x - victim.move.pos.x;
          const oz = at2.z - victim.move.pos.z;
          const in_ = Math.min(1, 0.25 * victim.size / Math.max(1e-6, Math.hypot(ox, oz)));
          p.stuckOffset = { x: ox * in_, y: Math.min(PLAYER.height, Math.max(0.3, at2.y - victim.move.pos.y)), z: oz * in_ };
          keep.push(p);
          continue;
        }
        if (!victim && wall && spec.walker && wall.normal.y > 0.6) {
          const h = hypot(p.vel.x, p.vel.z);
          p.heading = h > 0.1 ? { x: p.vel.x / h, y: 0, z: p.vel.z / h } : { x: Math.sin(owner?.yaw ?? 0), y: 0, z: Math.cos(owner?.yaw ?? 0) };
          p.pos = add(at2, scale(wall.normal, 0.05));
          p.vel = { x: 0, y: 0, z: 0 };
          p.walking = true;
          p.hopIn = 0;
          keep.push(p);
          continue;
        }
        if (!victim && wall && spec.sticky) {
          p.pos = add(at2, scale(wall.normal, 0.06));
          p.stuck = true;
          keep.push(p);
          continue;
        }
        if (!victim && wall && spec.mine) {
          p.pos = add(at2, scale(wall.normal, 0.06));
          p.stuck = true;
          p.armAt = this.tick + Math.round(spec.mine.armSeconds * TICK_RATE);
          keep.push(p);
          continue;
        }
        if (!victim && wall && spec.bounce !== void 0) {
          const n = wall.normal;
          const vn = p.vel.x * n.x + p.vel.y * n.y + p.vel.z * n.z;
          p.vel = scale({ x: p.vel.x - 2 * vn * n.x, y: p.vel.y - 2 * vn * n.y, z: p.vel.z - 2 * vn * n.z }, spec.bounce);
          p.pos = add(at2, scale(n, 0.05));
          p.bounces = (p.bounces ?? 0) + 1;
          if (spec.disc?.split && p.bounces === 1) {
            const plain = { ...spec, disc: { push: spec.disc.push, lift: spec.disc.lift } };
            for (const v of splitVelocities(p.vel)) this.projectiles.push({ id: this.nextProjectileId++, owner: p.owner, spec: plain, weapon: p.weapon, pos: { ...p.pos }, vel: v, ticksLeft: p.ticksLeft, age: p.age, bounces: 1, extra: true });
          }
          if (--p.ticksLeft <= 0 || spec.maxBounces !== void 0 && p.bounces > spec.maxBounces) this.explode(p, p.pos);
          else keep.push(p);
          continue;
        }
        if (victim && spec.disc) {
          this.discHit(victim, p, dir);
          this.explode(p, at2);
          continue;
        }
        if (victim && spec.impactDamage) this.damage(victim, spec.impactDamage, owner ?? null, p.weapon);
        if (victim && spec.status) this.applyStatus(victim, spec.status, owner ?? null, p.weapon);
        if (!victim && wall && spec.impactDamage && !this.damageMountBody(wall.handle, spec.impactDamage, owner ?? null, "blast", p.weapon)) this.scenario.damageBody(wall.handle, spec.impactDamage, p.owner);
        this.explode(p, at2);
        continue;
      }
      p.pos = add(p.pos, delta);
      if (--p.ticksLeft <= 0 || p.pos.y < this.killY) {
        this.explode(p, p.pos);
        continue;
      }
      keep.push(p);
    }
    this.projectiles = keep;
    if (keep.length > RESOURCE_BUDGETS.activeProjectiles) this.capProjectiles();
  }
  /** Over the projectile budget: the oldest bots' and NPCs' projectiles go first, then the oldest of all (no blast). */
  capProjectiles() {
    let excess = this.projectiles.length - RESOURCE_BUDGETS.activeProjectiles;
    this.budgetWarning("projectiles", `over ${RESOURCE_BUDGETS.activeProjectiles} projectiles in flight: the oldest are removed`);
    const human = (p) => this.slots[p.owner]?.kind === "human";
    const drop = /* @__PURE__ */ new Set();
    for (const pass of [false, true]) {
      for (const p of this.projectiles) {
        if (excess <= 0) break;
        if (drop.has(p) || !pass && human(p)) continue;
        drop.add(p);
        excess--;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !drop.has(p));
  }
  /** Runtime budget warnings (map/budgets.ts), logged once per kind and match. */
  budgetWarned = /* @__PURE__ */ new Set();
  budgetWarning(kind, text) {
    if (this.budgetWarned.has(kind)) return;
    this.budgetWarned.add(kind);
    console.warn(`[map budget] ${this.map.metadata.name}: ${text}`);
  }
  // ---------------------------------------------------------------- bullets (GUNPLAY_SPEC §3-6, §8, §38)
  /**
   * Fire conventional bullets (weapons with a ballistic spec).
   *
   * Lag compensation is designed together with travel (spec §38). The first
   * NEAR_INSTANT_M metres are a ray resolved in this tick against the world
   * as the shooter saw it (their view tick), so close range is instant and
   * fair. The bullet then "catches up" the ticks the input spent on its way
   * to the server, one tick of flight per recorded tick, against those
   * rewound positions; after that it flies against the live world. A shooter
   * therefore leads only for the bullet's travel time, never for latency, and
   * nobody is ever rewound further than MAX_REWIND_TICKS. Bots and NPCs have
   * no latency: their bullets fly against the live world from the start.
   */
  fireBullets(shooter, def, gp, eye, aim, spread2, viewTick, viewTargets) {
    const bal = gp.ballistic;
    const phys = bulletPhysics(bal, this.rules);
    const lag = shooter.kind === "human" && viewTick > 0 ? Math.max(0, Math.min(MAX_REWIND_TICKS, this.tick - viewTick)) : 0;
    const byTick = [viewTargets];
    const seen = (k) => byTick[k] ??= lag > 0 ? this.targetsFor(shooter, this.tick - lag + k) : viewTargets;
    const to = [];
    const hits = [];
    const zones = [];
    const flying = [];
    const marks = [];
    const ends = [];
    let armored = false;
    for (let p = 0; p < Math.max(1, def.pellets); p++) {
      const dir = this.spreadDir(aim, spread2);
      const b = { owner: shooter.slot, trig: def, origin: eye, pos: { ...eye }, vel: scale(dir, phys.speed), gravity: phys.gravity, drag: phys.drag, travelled: 0, age: 0, energy: bal.energy, scale: 1, pens: 0, rics: 0, marks: [], born: this.tick };
      const near2 = add(eye, scale(dir, Math.min(NEAR_INSTANT_M, def.range)));
      b.pos = near2;
      let end = this.bulletSegment(b, eye, near2, seen(0));
      for (let k = 1; !end && k <= Math.max(1, lag); k++) end = this.flyTick(b, seen(k));
      marks.push(...b.marks);
      b.marks = [];
      if (end) {
        to.push(tuple(end.at));
        hits.push(end.victim?.slot ?? null);
        zones.push(end.zone);
        if (end.victim && end.victim.armor > 0) armored = true;
        ends.push(end);
      } else {
        to.push(tuple(b.pos));
        hits.push(null);
        zones.push(0);
        flying.push(p);
        this.bullets.push(b);
      }
    }
    this.pendingEvents.push({
      e: "shot",
      s: shooter.slot,
      w: def.id,
      from: tuple(eye),
      to,
      hit: hits,
      ...zones.some((z) => z) ? { z: zones } : {},
      v: Math.round(phys.speed),
      g: r3(phys.gravity),
      ...flying.length ? { fl: flying } : {},
      ...armored ? { ar: 1 } : {},
      ...marks.length ? { pn: marks } : {}
    });
    for (const end of ends) this.bulletHit(shooter, def, end);
  }
  /** Bullets in flight: one tick each (sub-stepped), against the live world. */
  stepBullets() {
    if (!this.bullets.length) return;
    const keep = [];
    const targets = /* @__PURE__ */ new Map();
    for (const b of this.bullets) {
      if (b.born === this.tick) {
        keep.push(b);
        continue;
      }
      const side = this.actor(b.owner)?.faction;
      const key2 = side === null || side === void 0 ? b.owner : side;
      let list2 = targets.get(key2);
      if (!list2) targets.set(key2, list2 = this.liveTargets(b.owner));
      const end = this.flyTick(b, list2);
      if (!end) {
        keep.push(b);
        continue;
      }
      const owner = this.actor(b.owner) ?? null;
      this.pendingEvents.push({
        e: "impact",
        s: b.owner,
        w: b.trig.id,
        from: tuple(b.origin),
        to: tuple(end.at),
        hit: end.victim?.slot ?? null,
        ...end.zone ? { z: end.zone } : {},
        ...end.victim && end.victim.armor > 0 ? { ar: 1 } : {},
        ...b.marks.length ? { pn: b.marks } : {},
        ...end.gone ? { gone: 1 } : {}
      });
      this.bulletHit(owner, b.trig, end);
    }
    this.bullets = keep;
  }
  /** Living actors a bullet of `owner`'s can hit, where they are now (allies are passed through unless friendly fire is on, as with every shot). */
  liveTargets(owner) {
    const shooter = this.actor(owner);
    if (shooter) return this.targetsFor(shooter, 0);
    return this.actors().filter((o) => o.alive && o.slot !== owner && !this.sheltered(o)).map((o) => this.shotBody(o));
  }
  /** One tick of flight (BULLET_SUBSTEPS segments). Returns where it ended, or null while it flies on. */
  flyTick(b, targets) {
    const dt = TICK_DT / BULLET_SUBSTEPS;
    for (let i = 0; i < BULLET_SUBSTEPS; i++) {
      const seg = flyBullet(b, b.gravity, b.drag, dt);
      b.age += dt;
      const end = this.bulletSegment(b, seg.from, seg.to, targets);
      if (end) return end;
      if (b.travelled >= b.trig.range || b.age >= BULLET_LIFETIME || b.pos.y < this.killY) return { at: { ...b.pos }, victim: null, zone: 0, damage: 0, dir: normalize(b.vel), gone: true };
    }
    return null;
  }
  /**
   * Test the straight piece of flight a → c against players and the world.
   * Returns the bullet's end when it stops (a body, or a surface it can't get
   * through). Otherwise the bullet is moved on: to c, or out of the far side
   * of a surface it went through (energy-based penetration, spec §8), or off a
   * surface it glanced off (rare, bounded ricochets).
   */
  bulletSegment(b, a, c, targets) {
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const dz = c.z - a.z;
    const len = hypot(dx, dy, dz);
    if (len < 1e-6) return null;
    const u = { x: dx / len, y: dy / len, z: dz / len };
    const wall = this.physics.raycastNormal(a, u, len);
    let best = wall?.dist ?? Infinity;
    let victim = null;
    let zone = 0;
    const mx = (a.x + c.x) / 2;
    const mz = (a.z + c.z) / 2;
    const reach2 = len / 2 + 2;
    for (const t of targets) {
      if (Math.abs(t.feet.x - mx) > reach2 || Math.abs(t.feet.z - mz) > reach2 || t.who && !t.who.alive) continue;
      const d = rayTarget(a, u, t, Math.min(len, best));
      if (d !== null && d <= len && d < best) {
        best = d;
        victim = t;
        zone = lastHit.zone;
      }
    }
    const wet = this.liquids.length ? waterSpan(this.liquids, a, u, Math.min(len, best)) : null;
    if (wet) {
      const left = penetrate(b.energy, "water", wet.length);
      if (left === null) {
        const stop = wet.enter + Math.max(0, b.energy - PENETRATION_MIN_ENERGY) / MATERIAL_BALLISTICS.water.resist;
        return { at: add(a, scale(u, stop)), victim: null, zone: 0, damage: 0, dir: u };
      }
      const kept = left / b.energy;
      b.energy = left;
      b.vel = scale(b.vel, Math.sqrt(kept));
      b.scale *= kept;
    }
    const panes = this.scenario.shootGlass(a, u, Math.min(best, len), b.owner);
    if (panes) {
      b.scale *= GLASS.passDamage ** panes;
      b.energy = Math.max(PENETRATION_MIN_ENERGY, b.energy - penetrationLoss("glass", GLASS.thickness) * panes);
    }
    if (victim) {
      const at2 = add(a, scale(u, best));
      const gp = gunplayOf(getWeapon(b.trig.id));
      const damage = b.trig.damage * zoneScale(gp, zone) * falloffAt(gp.falloff, b.travelled + best) * b.scale;
      return { at: at2, victim: this.actor(victim.slot) ?? null, zone, damage, dir: u };
    }
    if (wall) {
      const at2 = add(a, scale(u, wall.dist));
      const mat = this.materialAt(wall.handle);
      const spec = MATERIAL_BALLISTICS[mat];
      const owner = this.actor(b.owner) ?? null;
      const raw = owner ? this.boosted(owner, b.trig.damage * b.scale) : b.trig.damage * b.scale;
      this.noteTargetHit(owner, wall.handle, raw * falloffAt(gunplayOf(getWeapon(b.trig.id)).falloff, b.travelled + wall.dist), at2);
      if (!this.damageMountBody(wall.handle, raw, owner, "bullet", b.trig.id) && spec.destruction > 0) this.scenario.damageBody(wall.handle, raw * spec.destruction, b.owner);
      const n = wall.normal;
      const grazing = Math.asin(Math.min(1, Math.abs(u.x * n.x + u.y * n.y + u.z * n.z)));
      if (b.rics < MAX_RICOCHETS && spec.ricochet > 0 && grazing < RICOCHET_MAX_ANGLE && ricochets(mat, grazing, this.rng())) {
        const vn = b.vel.x * n.x + b.vel.y * n.y + b.vel.z * n.z;
        b.vel = scale({ x: b.vel.x - 2 * vn * n.x, y: b.vel.y - 2 * vn * n.y, z: b.vel.z - 2 * vn * n.z }, 0.6);
        b.pos = add(at2, scale(n, 0.02));
        b.scale *= 0.5;
        b.energy *= 0.4;
        b.rics++;
        b.travelled += wall.dist;
        b.marks.push(tuple(at2));
        return null;
      }
      if (b.pens < MAX_PENETRATIONS && this.rules.ballistics !== "arcade") {
        const exit = this.exitPoint(at2, u);
        if (exit) {
          const thick = distance(at2, exit);
          const left = penetrate(b.energy, mat, thick);
          if (left !== null) {
            const kept = left / b.energy;
            b.energy = left;
            b.vel = scale(b.vel, Math.sqrt(kept));
            b.scale *= kept;
            b.pens++;
            b.travelled += wall.dist + thick;
            b.pos = add(exit, scale(u, 0.01));
            b.marks.push(tuple(at2));
            return null;
          }
        }
      }
      return { at: at2, victim: null, zone: 0, damage: 0, dir: u };
    }
    b.travelled += len;
    return null;
  }
  /** Where a ray entering a surface at `at` comes out (null: thicker than a metre or so, or solid all the way). */
  exitPoint(at2, u) {
    const probe = 1.2;
    const start = add(at2, scale(u, probe));
    const back = this.physics.raycastHit(start, scale(u, -1), probe - 5e-3);
    if (!back || back.dist <= 1e-3) return null;
    return add(start, scale(u, -back.dist));
  }
  /** What a collider is made of, ballistically (gunplay.ts). */
  materialAt(handle) {
    const mount = this.mountBodies.get(handle);
    if (mount) {
      const surface = mount.def.armour?.surface;
      return surface ? SURFACE_TYPES[surface]?.ballistic ?? "metal" : "metal";
    }
    if (this.covers.some((c) => c.body.handle === handle)) return "soil";
    const i = this.scenario.bodies.entityAt(handle);
    if (i !== void 0) {
      if (glassAt(this.map, i)) return "armor";
      const e = this.map.entities[i];
      return e ? entityMaterial(e) : "concrete";
    }
    const env = this.physics.shapeAt(handle);
    if (env) return SURFACE_TYPES[env.surface].ballistic;
    const box = this.physics.boxAt(handle);
    if (!box) return "concrete";
    if (box.kind === "prop") {
      const e = this.entityById(box.sourceId);
      return e ? entityMaterial(e) : "wood";
    }
    return box.surface ? surfaceMaterial(box.surface.material) : "concrete";
  }
  entityIds;
  entityById(id) {
    this.entityIds ??= new Map(this.map.entities.map((e) => [e.id, e]));
    return this.entityIds.get(id);
  }
  /** A bullet struck someone: damage, status and push. */
  bulletHit(shooter, def, end) {
    const victim = end.victim;
    if (!victim) return;
    this.damage(victim, end.damage, shooter, def.id, end.zone === 1);
    if (def.status) this.applyStatus(victim, def.status, shooter, def.id);
    this.stagger(victim, this.powerOf(def.id), end.dir, end.damage / Math.max(1, def.damage * Math.max(1, def.pellets)));
    if (def.knockback) this.push(victim, end.dir, def.knockback * (end.damage / Math.max(1, def.damage)));
  }
  /** A lying spear or disc goes to the first living player close by who has a throw of it to spare. */
  retrieve(p) {
    const code = weaponCode(getWeapon(p.weapon));
    const disc = !!p.spec.disc;
    if (this.tick < (p.armAt ?? 0)) return false;
    for (const c of this.actors()) {
      if (!c.alive || distance(c.move.pos, p.pos) > 1.6) continue;
      const w = c.weapons.get(code);
      if (!w || w.mag >= w.def.magazine) continue;
      w.mag++;
      if (c.current !== code) this.switchTo(c, code);
      this.pendingEvents.push({ e: "pickup", s: c.slot, id: `${disc ? "disc" : "spear"}_${p.id}`, item: lyingItem(p)?.id ?? "core.weapon_spear" });
      return true;
    }
    return false;
  }
  explode(p, at2) {
    const spec = p.spec;
    const owner = this.actor(p.owner) ?? null;
    if (spec.disc) {
      if (p.extra) return;
      const down = this.physics.raycastHit({ x: at2.x, y: at2.y + 0.2, z: at2.z }, { x: 0, y: -1, z: 0 }, DISC_DROP_REACH);
      if (!down) {
        const w = owner?.weapons.get(weaponCode(getWeapon(p.weapon)));
        if (w) w.mag = Math.min(w.def.magazine, w.mag + 1);
        return;
      }
      this.projectiles.push({ ...p, id: this.nextProjectileId++, spec: { ...spec, retrievable: true }, pos: { x: at2.x, y: at2.y + 0.2 - down.dist + 0.1, z: at2.z }, vel: { x: 0, y: 0, z: 0 }, stuck: true, ticksLeft: Math.round(DISC_LIE_SECONDS * TICK_RATE), armAt: this.tick + Math.round(DISC_PICKUP_DELAY * TICK_RATE) });
      return;
    }
    if (spec.splashRadius > 0) this.pendingEvents.push({ e: "explode", s: p.owner, p: tuple(at2), r: spec.splashRadius, w: p.weapon });
    if (spec.splashRadius > 0) this.splash(at2, spec.splashRadius, spec.splashDamage, spec.splashEdgeDamage, owner, p.weapon, spec.selfDamageScale, blastKnockback(spec), spec.status);
    if (spec.ignites || spec.splashDamage >= 30) this.ignite(at2, Math.max(1, spec.splashRadius));
    if (spec.zone) this.spawnZone(spec.zone, at2, p.owner, p.weapon);
    if (spec.cluster) {
      for (let i = 0; i < spec.cluster.count; i++) {
        const a = (i + this.rng() * 0.6) / spec.cluster.count * Math.PI * 2;
        const up = 0.55 + this.rng() * 0.35;
        const out = Math.sqrt(1 - up * up);
        this.spawnProjectile(p.owner, spec.cluster.spec, p.weapon, { x: at2.x, y: at2.y + 0.2, z: at2.z }, scale({ x: Math.cos(a) * out, y: up, z: Math.sin(a) * out }, spec.cluster.speed));
      }
    }
    if (spec.airstrike) {
      const yaw = owner?.yaw ?? 0;
      const f = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const n = spec.airstrike.count;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * spec.airstrike.spacing;
        this.spawnProjectile(p.owner, spec.airstrike.bomb, p.weapon, { x: at2.x + f.x * off, y: at2.y + spec.airstrike.height + i * 1.5, z: at2.z + f.z * off }, { x: 0, y: -8, z: 0 });
      }
      this.pendingEvents.push({ e: "msg", text: "Airstrike inbound!", secs: 3 });
    }
    if (spec.cover) this.deployCover(p, at2, spec.cover);
    if (spec.ammoBox) this.deployBox(p, at2);
  }
  /** A sandbag wall on the ground where it landed, square to the thrower; nothing when someone stands in the way. */
  deployCover(p, at2, cover) {
    const owner = this.actor(p.owner);
    const yaw = owner?.yaw ?? Math.atan2(p.vel.x, p.vel.z);
    const back = { x: -Math.sin(yaw) * 0.35, z: -Math.cos(yaw) * 0.35 };
    const from = { x: at2.x + back.x, y: at2.y + 0.4, z: at2.z + back.z };
    const down = this.physics.raycastHit(from, { x: 0, y: -1, z: 0 }, 6);
    if (!down) return;
    const pos = { x: from.x, y: from.y - down.dist, z: from.z };
    const half = { x: cover.half[0], y: cover.half[1], z: cover.half[2] };
    const reach2 = hypot(half.x, half.z) + PLAYER.radius;
    for (const c of this.actors()) {
      if (c.alive && hypot(c.move.pos.x - pos.x, c.move.pos.z - pos.z) < reach2 && c.move.pos.y < pos.y + half.y * 2 && c.move.pos.y + PLAYER.height > pos.y) {
        if (owner?.alive && (!owner.throwable || owner.throwable.kind === "sandbag")) owner.throwable = { kind: "sandbag", count: Math.min(THROWABLE_DEFS.sandbag.max, (owner.throwable?.count ?? 0) + 1) };
        return;
      }
    }
    const body = this.physics.createBox({ x: pos.x, y: pos.y + half.y, z: pos.z }, half, yaw);
    this.physics.commit();
    this.covers.push({ id: this.nextCoverId++, pos, yaw, half, health: cover.health, max: cover.health, body });
    if (this.covers.length > MAX_COVERS) this.removeCover(this.covers[0]);
  }
  removeCover(cv) {
    this.covers = this.covers.filter((c) => c !== cv);
    this.physics.removeCollider(cv.body);
    this.physics.commit();
  }
  damageCover(cv, amount) {
    cv.health -= amount;
    if (cv.health > 0) return;
    this.removeCover(cv);
  }
  /**
   * Hook the surface you're aiming at and get yanked toward it: the launch is
   * aimed a little above the hook (gravity pulls the arc down) and capped so
   * a long throw doesn't fling you through the far wall.
   */
  fireGrapple(shooter, eye, aim, def, speed) {
    const dist = this.physics.raycastWorld(eye, aim, def.range);
    if (dist === null || dist < 1.5) {
      this.pendingEvents.push({ e: "shot", s: shooter.slot, w: def.id, from: tuple(eye), to: [tuple(add(eye, scale(aim, dist ?? def.range)))], hit: [null] });
      return;
    }
    const hook = add(eye, scale(aim, dist));
    const feet = shooter.move.pos;
    const to = { x: hook.x - feet.x, y: hook.y - feet.y - 0.6, z: hook.z - feet.z };
    const flat = hypot(to.x, to.z);
    const t = Math.max(0.25, hypot(flat, to.y) / speed);
    const h = flat || 1;
    const along = Math.min(speed, flat / t);
    shooter.move = {
      ...shooter.move,
      vx: to.x / h * along,
      vz: to.z / h * along,
      velY: Math.min(speed * 1.1, Math.max(4, to.y / t + PLAYER.gravity * t * 0.5)),
      grounded: false
    };
    this.pendingEvents.push({ e: "shot", s: shooter.slot, w: def.id, from: tuple(eye), to: [tuple(hook)], hit: [null] });
  }
  /** Heal the hurt teammate you're aiming at within reach, or else yourself. */
  useMedkit(shooter, eye, aim, amount, range) {
    let best = null;
    let bestD = range;
    for (const c of this.actors()) {
      if (c === shooter || !c.alive || this.hostile(shooter, c) || c.health >= c.maxHealth) continue;
      const d = rayCapsule(eye, aim, c.move.pos, PLAYER.radius * c.size + 0.3, bodyHeightOf(c.move, c.size));
      if (d !== null && d <= bestD) {
        best = c;
        bestD = d;
      }
    }
    const target = best ?? (shooter.health < shooter.maxHealth ? shooter : null);
    if (!target) return;
    const n = Math.min(amount, target.maxHealth - target.health);
    target.health += n;
    this.pendingEvents.push({ e: "heal", s: shooter.slot, t: target.slot, n });
  }
  spawnProjectile(owner, spec, weapon, pos, vel) {
    this.projectiles.push({ id: this.nextProjectileId++, owner, spec, weapon, pos, vel, ticksLeft: Math.round(spec.fuseSeconds * TICK_RATE), age: OWNER_GRACE_TICKS });
  }
  /** Laser-guided rockets turn toward whatever their shooter is aiming at. */
  guide(p, owner, turnRate) {
    const eye = { x: owner.move.pos.x, y: owner.move.pos.y + eyeHeightOf(owner.move, owner.size), z: owner.move.pos.z };
    const look = viewDirection(owner.yaw, owner.pitch);
    const hit = this.physics.raycastWorld(eye, look, 300);
    const target = add(eye, scale(look, hit ?? 300));
    const to = sub(target, p.pos);
    const d = hypot(to.x, to.y, to.z);
    if (d < 0.5) return;
    const speed = hypot(p.vel.x, p.vel.y, p.vel.z) || 1;
    const k = Math.min(1, turnRate * TICK_DT);
    p.vel = scale(normalize(add(scale(p.vel, (1 - k) / speed), scale(to, k / d))), speed);
  }
  /**
   * A walker's step on the ground: forward at its pace, falling when the ground
   * drops away, hopping at low obstacles and turning at walls. Bursts on an enemy
   * (or when the fuse runs out). Returns whether it is still going.
   */
  walk(p, owner) {
    const spec = p.spec;
    const speed = spec.walker.speed;
    if (--p.ticksLeft <= 0 || p.pos.y < this.killY) {
      this.explode(p, p.pos);
      return false;
    }
    for (const c of this.actors()) {
      if (!c.alive || owner && c === owner || owner && !this.hostile(owner, c)) continue;
      if (horizontalDistance(c.move.pos, p.pos) < 0.9 && Math.abs(c.move.pos.y + 0.6 - p.pos.y) < 1.4) {
        this.explode(p, p.pos);
        return false;
      }
    }
    let h = p.heading;
    if (p.hopIn) p.hopIn--;
    const ahead = this.physics.raycastWorld({ x: p.pos.x, y: p.pos.y + 0.3, z: p.pos.z }, h, 0.5);
    if (ahead !== null) {
      const high = this.physics.raycastWorld({ x: p.pos.x, y: p.pos.y + 1.3, z: p.pos.z }, h, 0.6);
      if (high === null && !p.hopIn && p.vel.y === 0) {
        p.vel = { x: 0, y: 6, z: 0 };
        p.hopIn = 30;
      } else if (p.vel.y === 0) {
        h = p.heading = { x: h.z, y: 0, z: -h.x };
      }
    }
    let vy = p.vel.y - spec.gravity * TICK_DT;
    const next = { x: p.pos.x + h.x * speed * TICK_DT, y: p.pos.y + vy * TICK_DT, z: p.pos.z + h.z * speed * TICK_DT };
    if (this.physics.raycastWorld({ x: next.x, y: next.y + 0.3, z: next.z }, h, 0.2) !== null) {
      next.x = p.pos.x;
      next.z = p.pos.z;
    }
    const ground = vy <= 0 ? this.physics.raycastWorld({ x: next.x, y: p.pos.y + 0.3, z: next.z }, { x: 0, y: -1, z: 0 }, 0.3 + Math.max(0.05, -vy * TICK_DT)) : null;
    if (ground !== null) {
      next.y = p.pos.y + 0.3 - ground;
      vy = 0;
    }
    p.vel = { x: 0, y: vy, z: 0 };
    p.pos = next;
    return true;
  }
  /** Swarm missiles turn toward the nearest enemy ahead of them that they can see. */
  steer(p, owner, homing) {
    const speed = hypot(p.vel.x, p.vel.y, p.vel.z) || 1;
    const fwd = scale(p.vel, 1 / speed);
    let best = null;
    let bestD = homing.range;
    for (const c of this.actors()) {
      if (!c.alive || c === owner || !this.hostile(owner, c)) continue;
      const to = sub(chest(c.move.pos), p.pos);
      const d = hypot(to.x, to.y, to.z);
      if (d > bestD || dot(to, fwd) < d * 0.3) continue;
      if (!this.sees(p.pos, chest(c.move.pos))) continue;
      best = scale(to, 1 / d);
      bestD = d;
    }
    if (!best) return;
    const k = Math.min(1, homing.turnRate * TICK_DT);
    p.vel = scale(normalize(add(scale(fwd, 1 - k), scale(best, k))), speed);
  }
  // ---------------------------------------------------------------- turrets, sentries and vehicles
  addMount(index, def, pos, yaw, faction, respawnSeconds, floats = false) {
    const half = { x: def.half[0], y: def.half[1], z: def.half[2] };
    const body = this.physics.createBox({ x: pos.x, y: pos.y + half.y, z: pos.z }, half, yaw);
    const probe = def.vehicle ? this.physics.createVehicleProbe(Math.min(half.x, half.z) * 0.95) : null;
    const lowProbe = def.vehicle && !def.vehicle.fly ? this.physics.createLowVehicleProbe(Math.min(half.x, half.z) * 0.95, half.y * 2) : null;
    const m = {
      index,
      def,
      home: { pos: { ...pos }, yaw },
      pos: { ...pos },
      yaw,
      velY: 0,
      speed: 0,
      push: { x: 0, z: 0 },
      aimYaw: yaw,
      aimPitch: 0,
      health: def.health,
      alive: true,
      respawnAt: 0,
      respawnTicks: Math.round((respawnSeconds ?? def.respawnSeconds) * TICK_RATE),
      supply: def.resupply?.uses ?? 0,
      seats: def.seats.map(() => null),
      guns: def.seats.map((seat) => seat.weapon ? { def: getWeapon(seat.weapon), mag: 0, reserve: 0, alt: 0, heat: 0, ...seat.ammo ? { shells: seat.ammo.start ?? seat.ammo.max, shellTicks: 0 } : {} } : null),
      ammoGuns: def.seats.some((seat) => !!seat.weapon && !!seat.ammo),
      body,
      probe,
      lowProbe,
      low: false,
      faction,
      drive: { forward: 0, right: 0 },
      slide: 0,
      airborne: false,
      floats,
      afloat: false,
      cooldown: 0,
      lastHitBy: null,
      runOver: /* @__PURE__ */ new Map(),
      burning: false,
      wreckUntil: 0,
      vel: { x: 0, z: 0 },
      rammed: /* @__PURE__ */ new Map(),
      stall: 0,
      climbAssist: 0,
      assistFrom: null
    };
    const setup = suspensionOf(def);
    if (setup) {
      m.suspSetup = setup;
      m.susp = newSuspension(setup);
    }
    this.mounts.push(m);
    this.mountBodies.set(body.handle, m);
  }
  seatOf(c) {
    if (!c.mount) return null;
    return this.mounts[c.mount.index]?.def.seats[c.mount.seat] ?? null;
  }
  /** Aboard a sealed vehicle that still stands (MountArmour.sealed, the Tank): out of reach of everything outside. */
  sheltered(c) {
    if (!c.mount) return false;
    const m = this.mounts[c.mount.index];
    return !!m && m.alive && sealedMount(m.def);
  }
  /** The seat whose gun this rider fires (their own, or the driver's on an empty driverFires seat: mounts.ts firingSeat), or null. */
  gunSeatOf(c) {
    if (!c.mount) return null;
    const m = this.mounts[c.mount.index];
    return m ? firingSeat(m.def, c.mount.seat, (i) => m.seats[i] !== null) : null;
  }
  /**
   * `yaw` kept within seat `seat`'s arc on mount `m` (all round: unchanged). `driver`: for a driver working the
   * seat's gun (driverFires), whose arc may be narrower (SeatDef.driverArc).
   */
  arcYaw(m, seat, yaw, driver = false) {
    const s = m.def.seats[seat];
    const arc = driver ? s?.driverArc ?? s?.arc : s?.arc;
    if (!s || arc === void 0) return yaw;
    const centre = m.yaw + (s.facing ?? 0);
    const d = Math.atan2(Math.sin(yaw - centre), Math.cos(yaw - centre));
    return centre + Math.max(-arc, Math.min(arc, d));
  }
  /**
   * A turret with a traverse rate (MountDef.turret.traverse): is its barrel on the aim of `c`, who works its gun?
   * True for every other gun. The gun holds its shot until it is (the trigger held, it fires as the barrel arrives),
   * so a round always goes where its gunner is looking.
   */
  turretOnAim(c) {
    const m = c.mount ? this.mounts[c.mount.index] : void 0;
    const t = m?.def.turret;
    if (!m || !t?.traverse) return true;
    const gunSeat = this.gunSeatOf(c);
    if (gunSeat !== t.seat) return true;
    const want = gunSeat === c.mount.seat ? c.yaw : this.arcYaw(m, gunSeat, c.yaw, true);
    return Math.abs(Math.atan2(Math.sin(want - m.aimYaw), Math.cos(want - m.aimYaw))) <= TURRET_ON_AIM;
  }
  /** Where a seat's occupant stands right now. */
  seatFeet(m, seat) {
    return mountToWorld(m.pos, m.yaw, m.def.seats[seat].offset);
  }
  /**
   * A rider's movement state in a seat: on the seat point; sitting (a real seat) takes the crouching eye and height,
   * and so does a rider in a standing place who ducks (`crouch`: Combatant.rideCrouch).
   */
  seatMove(m, seat, crouch = false) {
    const pos = this.seatFeet(m, seat);
    return m.def.seats[seat].seated || crouch ? { pos, velY: 0, grounded: true, stance: 1 } : { pos, velY: 0, grounded: true };
  }
  /** Climb into the nearest turret or vehicle in reach with a free seat (driver first, then gunner, then passengers). */
  // ---------------------------------------------------------------- ammo boxes (sim/resupply.ts)
  /** A box standing at `pos` (its ground point), full. Placed ones keep their pickup's id and respawn time. */
  addBox(kind, pos, yaw, owner, pickupId, respawnTicks = 0) {
    const spec = kind === "placed" ? PLACED_BOX : DEPLOYED_BOX;
    const b = { id: this.nextBoxId++, kind, ...pickupId ? { pickupId } : {}, pos, yaw, health: spec.health, max: spec.health, uses: spec.uses, maxUses: spec.uses, body: null, owner, until: kind === "deployed" ? this.tick + Math.round(DEPLOYED_BOX.lifeSeconds * TICK_RATE) : 0, respawnTicks, lastHitBy: null };
    this.standBox(b);
    this.boxes.push(b);
    return b;
  }
  standBox(b) {
    const [hx, hy, hz] = AMMO_BOX_HALF;
    b.body = this.physics.createBox({ x: b.pos.x, y: b.pos.y + hy, z: b.pos.z }, { x: hx, y: hy, z: hz }, b.yaw);
    this.physics.commit();
  }
  /** Emptied, destroyed or expired: its collider goes; a placed one comes back full later, a deployed one is gone. */
  removeBox(b) {
    if (b.body) {
      this.physics.removeCollider(b.body);
      this.physics.commit();
      b.body = null;
    }
    if (b.kind === "placed") b.until = this.tick + b.respawnTicks;
    else this.boxes = this.boxes.filter((x) => x !== b);
  }
  damageBox(b, amount, attacker) {
    if (!b.body || amount <= 0) return;
    if (attacker) b.lastHitBy = attacker.slot;
    b.health -= amount;
    if (b.health > 0) return;
    const share = b.uses / b.maxUses;
    const base = { x: b.pos.x, y: b.pos.y, z: b.pos.z };
    for (const k of cookOff(share, b.id * 7919 + this.seed, TICK_RATE)) this.cookOffs.push({ tick: this.tick + k.tick, at: { x: base.x + k.dx, y: base.y + k.dy, z: base.z + k.dz }, owner: b.lastHitBy });
    this.pendingEvents.push({ e: "boxcook", p: tuple({ x: base.x, y: base.y + AMMO_BOX_HALF[1], z: base.z }), n: Math.round(share * 10) / 10 });
    b.uses = 0;
    this.removeBox(b);
  }
  /** Deployed boxes expire, placed ones come back, and cook-offs go off. */
  stepBoxes() {
    for (const b of [...this.boxes]) {
      if (b.kind === "deployed" && b.body && this.tick >= b.until) this.removeBox(b);
      else if (b.kind === "placed" && !b.body && this.tick >= b.until) {
        b.health = b.max;
        b.uses = b.maxUses;
        b.lastHitBy = null;
        this.standBox(b);
      }
    }
    if (!this.cookOffs.length) return;
    const due = this.cookOffs.filter((k) => k.tick <= this.tick);
    if (!due.length) return;
    this.cookOffs = this.cookOffs.filter((k) => k.tick > this.tick);
    for (const k of due) {
      const owner = k.owner === null ? null : this.actor(k.owner) ?? null;
      this.pendingEvents.push({ e: "explode", s: k.owner ?? -1, p: tuple(k.at), r: COOK_OFF.radius, w: COOK_OFF.weapon });
      this.splash(k.at, COOK_OFF.radius, COOK_OFF.damage, COOK_OFF.edge, owner, COOK_OFF.weapon, 1, 2);
    }
  }
  /** An Ammo Box Kit lands: a box on the ground there, square to the thrower; their older one goes. */
  deployBox(p, at2) {
    const owner = this.actor(p.owner);
    const yaw = owner?.yaw ?? Math.atan2(p.vel.x, p.vel.z);
    const back = { x: -Math.sin(yaw) * 0.4, z: -Math.cos(yaw) * 0.4 };
    const from = { x: at2.x + back.x, y: at2.y + 0.4, z: at2.z + back.z };
    const down = this.physics.raycastHit(from, { x: 0, y: -1, z: 0 }, 6);
    if (!down) return;
    const pos = { x: from.x, y: from.y - down.dist, z: from.z };
    const reach2 = Math.hypot(AMMO_BOX_HALF[0], AMMO_BOX_HALF[2]) + PLAYER.radius;
    if (this.actors().some((c) => c.alive && hypot(c.move.pos.x - pos.x, c.move.pos.z - pos.z) < reach2 && c.move.pos.y < pos.y + AMMO_BOX_HALF[1] * 2 && c.move.pos.y + PLAYER.height > pos.y)) {
      if (owner?.alive && !owner.throwable) owner.throwable = { kind: "ammo_box", count: 1 };
      return;
    }
    for (const old of this.boxes.filter((b) => b.kind === "deployed" && b.owner === p.owner)) this.removeBox(old);
    this.addBox("deployed", pos, yaw, p.owner);
  }
  /**
   * On foot beside a standing ammo box: Use resupplies you there (sim/resupply.ts). True when Use was taken by it:
   * resupplied, or nothing given (full, or waiting; the event says which).
   */
  resupplyAtBox(c) {
    let best = null;
    let bestD = Infinity;
    for (const b of this.boxes) {
      if (!b.body || b.uses <= 0 || Math.abs(c.move.pos.y - b.pos.y) > 1.6) continue;
      const d = horizontalDistance(c.move.pos, b.pos);
      if (d <= AMMO_BOX_REACH && d < bestD) {
        best = b;
        bestD = d;
      }
    }
    if (!best) return false;
    let given = false;
    if (this.tick >= (c.resupplyAt ?? 0)) {
      const spawn = this.weaponSet && !restrictedWeapons(this.rules) ? setLoadout(this.weaponSet, this.rules, { seed: this.seed, slot: c.slot, life: 0, sniper: false }).throwable?.kind ?? null : null;
      const r = resupplyLoadout(c.weapons.values(), c.throwable, spawn);
      if (r.given) {
        given = true;
        c.throwable = r.throwable;
        best.uses--;
        c.resupplyAt = this.tick + Math.round(AMMO_BOX_WAIT * TICK_RATE);
      }
    }
    this.pendingEvents.push({ e: "resupply", s: c.slot, m: -1, b: best.id, left: best.uses, ok: given });
    if (best.uses <= 0) this.removeBox(best);
    return true;
  }
  /** Standing boxes for the snapshot (`ab`): [id, x, y, z, yaw, health %, uses left, 1 when deployed]. */
  boxSnapshots() {
    return this.boxes.filter((b) => b.body).map((b) => [b.id, r3(b.pos.x), r3(b.pos.y), r3(b.pos.z), r3(b.yaw), Math.ceil(Math.max(0, b.health) / b.max * 100), b.uses, b.kind === "deployed" ? 1 : 0]);
  }
  /** Standing boxes with stock, for the bots (and the tank refill): where, how many uses, and how hurt. */
  ammoBoxes() {
    return this.boxes.filter((b) => b.body && b.uses > 0).map((b) => ({ id: b.id, pos: b.pos, uses: b.uses, health: b.health / b.max, placed: b.kind === "placed" }));
  }
  /**
   * The bots' pickups plus the Supply Buggies (MountDef.resupply) a bot may resupply at: its own team's or nobody's,
   * standing, with stock, within BOT_RESUPPLY_REACH. Each is an Ammo Box pickup at the tailgate (`supply_<entity
   * index>`) to the bot's pickup choice (BotBrain.bestPickup: worth it when short of ammo), and beside it the bot
   * presses Use (BotBrain.act).
   */
  withSupplyStops(pickups, c) {
    if (c.mount || restrictedWeapons(this.rules)) return pickups;
    const item = getItem("core.ammo");
    if (!item) return pickups;
    let out = null;
    for (const m of this.mounts) {
      const spec = m.def.resupply;
      if (!spec || !m.alive || m.supply <= 0 || m.faction !== null && m.faction !== c.faction) continue;
      const at2 = resupplyPoint(spec, m.pos, m.yaw);
      if (horizontalDistance(at2, c.move.pos) > BOT_RESUPPLY_REACH) continue;
      (out ??= [...pickups]).push({ id: `supply_${m.index}`, item, pos: at2, available: true });
    }
    return out ?? pickups;
  }
  /**
   * On foot at a resupply vehicle's reach point (the Supply Buggy's tailgate): Use resupplies you there instead of
   * getting in (sim/resupply.ts). True when Use was taken by it: resupplied, or nothing given (full, empty, waiting;
   * the event says which, so the HUD can).
   */
  resupplyAtMount(c) {
    let best = null;
    let bestD = Infinity;
    for (const m of this.mounts) {
      if (!m.alive || !m.def.resupply) continue;
      const d = resupplyReach(m.def.resupply, m.pos, m.yaw, c.move.pos);
      if (d !== null && d < bestD) {
        best = m;
        bestD = d;
      }
    }
    if (!best) return false;
    const spec = best.def.resupply;
    let left = best.supply;
    let given = false;
    if (left > 0 && this.tick >= (c.resupplyAt ?? 0)) {
      const spawn = this.weaponSet && !restrictedWeapons(this.rules) ? setLoadout(this.weaponSet, this.rules, { seed: this.seed, slot: c.slot, life: 0, sniper: false }).throwable?.kind ?? null : null;
      const r = resupplyLoadout(c.weapons.values(), c.throwable, spawn);
      if (r.given) {
        given = true;
        c.throwable = r.throwable;
        left = --best.supply;
        c.resupplyAt = this.tick + Math.round(spec.wait * TICK_RATE);
      }
    }
    this.pendingEvents.push({ e: "resupply", s: c.slot, m: best.index, left, ok: given });
    return true;
  }
  enterMount(c) {
    let best = null;
    let bestD = Infinity;
    for (const m of this.mounts) {
      if (!m.alive || !m.def.seats.length || !m.seats.includes(null)) continue;
      if (m.def.vehicle && this.mode?.blocksVehicle(c)) continue;
      const d = enterReach(m.def, m.pos, m.yaw, c.move.pos);
      if (d !== null && d < bestD) {
        best = m;
        bestD = d;
      }
    }
    if (!best) return false;
    const order = ["driver", "gunner", "passenger"];
    let seat = -1;
    for (const role of order) {
      seat = best.def.seats.findIndex((s, i) => s.role === role && best.seats[i] === null);
      if (seat >= 0) break;
    }
    if (seat < 0) return false;
    best.seats[seat] = c.slot;
    c.mount = { index: this.mounts.indexOf(best), seat };
    c.move = this.seatMove(best, seat);
    c.reloadTicks = 0;
    c.windup = 0;
    c.burstLeft = 0;
    this.pendingEvents.push({ e: "mount", s: c.slot, m: best.index, seat });
    return true;
  }
  /** Get out (beside the mount, where there is room), or just free the seat (death, leaving the match). */
  leaveMount(c, step) {
    if (!c.mount) return;
    const m = this.mounts[c.mount.index];
    const seat = c.mount.seat;
    c.mount = void 0;
    c.rideCrouch = false;
    if (!m) return;
    m.seats[seat] = null;
    if (m.def.seats[seat]?.role === "driver") m.drive = { forward: 0, right: 0 };
    this.pendingEvents.push({ e: "mount", s: c.slot, m: m.index, seat: -1 });
    this.planeDrops.delete(c.slot);
    if (!step) return;
    if (m.route) {
      const pose = routePose(m.route, this.routeTick(m));
      const at2 = mountToWorld(m.pos, m.yaw, [0, -1.5, -m.def.half[2] - 1]);
      c.move = { pos: at2, velY: 0, grounded: false, vx: pose.vel.x * 0.5, vz: pose.vel.z * 0.5, drop: true };
      return;
    }
    const [hx, , hz] = m.def.half;
    for (const o of [[-(hx + 0.9), 0, 0], [hx + 0.9, 0, 0], [0, 0, -(hz + 0.9)], [0, 0, hz + 0.9]]) {
      const spot2 = mountToWorld(m.pos, m.yaw, o);
      if (this.physics.raycastHit({ x: spot2.x, y: spot2.y + 0.4, z: spot2.z }, { x: 0, y: 1, z: 0 }, PLAYER.height)) continue;
      if (!this.exitReachable(m, o, spot2)) continue;
      c.move = this.bailOut({ x: spot2.x, y: spot2.y + 0.3, z: spot2.z });
      return;
    }
    c.move = this.bailOut({ x: m.pos.x, y: m.pos.y + m.def.half[1] * 2 + 0.2, z: m.pos.z });
  }
  /**
   * A side's step-out spot (leaveMount) is on this side of whatever the hull is parked against: nothing solid (a wall,
   * a fence) between the hull's face and the spot, at the knees and at the chest; and ground under it within
   * EXIT_STEP_DOWN (or water; a flyer's rider may step out anywhere, under the parachute when high): a buggy parked along Riot Junction's east wall put a
   * rider beyond the wall, over the void outside the street, and it fell to the slab 4 m under the street with no
   * way out (gunplay pass 3's find).
   */
  exitReachable(m, o, spot2) {
    const len = Math.hypot(o[0], o[2]);
    const face = Math.abs(o[0]) > 0 ? m.def.half[0] : m.def.half[2];
    const dir = { x: (spot2.x - m.pos.x) / len, y: 0, z: (spot2.z - m.pos.z) / len };
    const reach2 = len - face + PLAYER.radius;
    for (const h of [0.5, 1.2]) {
      const from = { x: m.pos.x + dir.x * (face + 0.02), y: spot2.y + h, z: m.pos.z + dir.z * (face + 0.02) };
      if (this.physics.moveRay(from, dir, reach2) !== null) return false;
    }
    if (m.def.vehicle?.fly || liquidAt(this.liquids, { x: spot2.x, y: spot2.y + 0.1, z: spot2.z })) return true;
    return this.physics.moveRay({ x: spot2.x, y: spot2.y + 0.4, z: spot2.z }, { x: 0, y: -1, z: 0 }, 0.4 + EXIT_STEP_DOWN) !== null;
  }
  /** Stepping out at `at`: high up (a flyer in the air), the parachute's automatic opener is armed. */
  bailOut(at2) {
    const high = heightAboveGround(this.physics, at2, CHUTE.minHeight + 1) === null;
    return { pos: at2, velY: 0, grounded: false, ...high ? { drop: true } : {} };
  }
  /**
   * A bot riding the plane: it picks where to come down (its side's
   * objective or base) and jumps when the plane passes over it, then
   * parachutes in. It never presses E or jump aboard otherwise.
   */
  planeBot(c, input) {
    const m = c.mount ? this.mounts[c.mount.index] : void 0;
    if (!m?.route) return;
    input.buttons &= -18;
    const drops = this.dropPlanFor(m);
    if (this.phase !== "playing" || this.routeTick(m) < 1) return;
    let plan = this.planeDrops.get(c.slot);
    if (!plan) {
      const objective = dropTarget(this.map, c.faction, this.rng(), this.rules.mode);
      const goal = this.mode?.botGoal(c, [])?.pos;
      const target = goal ? { ...goal } : objective;
      const at2 = botDropIndex(drops, m.route, target, dropOffsets(m.route, m.def.half[2])[1], this.rng());
      this.planeDrops.set(c.slot, plan = { target, ...at2 >= 0 ? { at: at2 } : {} });
    }
    if (!canDrop(drops, m.route, this.routeTick(m))) return;
    if (plan.at !== void 0) {
      if (dropIndex(drops, m.route, this.routeTick(m)) === plan.at) input.buttons |= BUTTON_USE;
      return;
    }
    const { jump, dist } = shouldJump(m.pos, plan.target, plan.prev, ticksToRouteEnd(m.route, this.routeTick(m)));
    plan.prev = dist;
    if (jump) input.buttons |= BUTTON_USE;
  }
  /** Ticks a drop route has flown: its clock starts with play (the wait and countdown hold it at its first point). */
  routeTick(m) {
    return Math.max(0, this.tick - (m.routeT0 ?? 0));
  }
  /**
   * Where riders of a drop route may jump out: over the map's play area
   * (dropArea), above a floor or the terrain (not the void), clear of lava
   * and acid; bots also want ground on their navmesh. Worked out once.
   */
  dropPlanFor(m) {
    if (m.drops) return m.drops;
    const route = m.route;
    const area = dropArea(this.map);
    const ground = (x, z) => {
      if (area && (x < area.x0 || x > area.x1 || z < area.z0 || z > area.z1)) return null;
      const top = route.y - 4;
      const d = this.physics.raycastWorld({ x, y: top, z }, { x: 0, y: -1, z: 0 }, top - this.killY);
      if (d === null) return null;
      const y = top - d;
      if (y < this.killY + 2) return null;
      const wet = liquidAt(this.liquids, { x, y: y + 0.3, z });
      if (wet && (wet.liquid === "lava" || wet.liquid === "acid")) return null;
      return y;
    };
    const reach2 = (x, z) => {
      const y = ground(x, z);
      if (y === null) return false;
      const q = this.nav.closestPoint({ x, y: y + 0.5, z }, { x: 2, y: 2, z: 2 });
      return !!q && Math.abs(q.y - y) < 1.5;
    };
    return m.drops = dropPlan(route, (x, z) => ground(x, z) !== null, reach2, dropOffsets(route, m.def.half[2]));
  }
  /** Whether a rider of mount `m` may jump out now; if not, they're told why (once a second at most). */
  mayJumpOut(c, m) {
    if (!m.route || canDrop(this.dropPlanFor(m), m.route, this.routeTick(m))) return true;
    if (!c.npc && this.tick - (this.dropHints.get(c.slot) ?? -Infinity) >= TICK_RATE) {
      this.dropHints.set(c.slot, this.tick);
      this.pendingEvents.push({ e: "msg", text: `Not over the drop zone: you can jump when the ${m.def.displayName.toLowerCase()} is over the map`, secs: 2, s: c.slot });
    }
    return false;
  }
  /** Air drop: seat a spawning player in a transport plane with a free bench; false when there is none. */
  boardPlane(c) {
    for (const m of this.mounts) {
      if (!m.route || m.airdrop === "off" || m.airdrop === void 0) continue;
      if (m.airdrop === "start" && this.airdropped.has(c.slot)) continue;
      const seat = m.seats.indexOf(null);
      if (seat < 0) continue;
      this.airdropped.add(c.slot);
      m.seats[seat] = c.slot;
      c.mount = { index: this.mounts.indexOf(m), seat };
      c.move = this.seatMove(m, seat);
      c.yaw = m.yaw;
      this.pendingEvents.push({ e: "mount", s: c.slot, m: m.index, seat });
      return true;
    }
    return false;
  }
  /** Damage whatever mount owns this collider; false when it isn't one. */
  damageMountBody(handle, amount, attacker, hit = "other", weapon) {
    if (this.mode?.damageBody?.(handle, amount, attacker)) return true;
    const cv = this.covers.find((c) => c.body.handle === handle);
    if (cv) {
      this.damageCover(cv, amount);
      return true;
    }
    const box = this.boxes.find((b) => b.body?.handle === handle);
    if (box) {
      this.damageBox(box, amount, attacker);
      return true;
    }
    const m = this.mountBodies.get(handle);
    if (!m) return false;
    this.damageMount(m, amount, attacker, false, hit, weapon);
    return true;
  }
  /**
   * Hurt a mount. Vehicles take the match's vehicle damage share (tough:
   * half, off: none); `raw` skips that (fire, lava and water run on their
   * own clock). The attacker gets the credit when it blows; damage from
   * nobody (fire, crashes, water) leaves the last attacker's credit standing.
   * The transport plane can't be hurt. Armour (MountDef.armour) takes its share of bullets, blasts and melee (`hit`).
   * A vehicle takes `weapon`'s vehicleDamage multiple of it (rockets: more), before its armour's share.
   */
  damageMount(m, amount, attacker, raw = false, hit = "other", weapon) {
    if (!m.alive || this.phase !== "playing" || amount <= 0 || m.route) return;
    if (m.def.kind === "vehicle" && !raw) amount *= VEHICLE_DAMAGE_SCALE[this.rules.vehicleDamage ?? "normal"] * (weapon ? CORE_WEAPONS[weapon]?.vehicleDamage ?? 1 : 1);
    amount *= armourScale(m.def, hit);
    if (amount <= 0) return;
    m.health -= amount;
    if (attacker) m.lastHitBy = attacker.slot;
    if (m.health > 0 && m.def.kind === "vehicle" && m.health < m.def.health * MOUNT_BURN_FRACTION) m.burning = true;
    if (m.health <= 0) this.destroyMount(m);
  }
  /**
   * It blows up: everyone aboard is thrown out into the blast, which hurts
   * people, other mounts and destructibles (so barrels and gas cans nearby go
   * up too) and lights oil. A vehicle leaves a charred wreck that stays as
   * solid cover for a while; it comes back where it was placed later.
   * `wreck` false: nothing is left (it fell off the map).
   */
  destroyMount(m, wreck = true) {
    m.alive = false;
    m.health = 0;
    m.burning = false;
    m.arc = void 0;
    m.respawnAt = this.tick + m.respawnTicks;
    const aboard = m.seats.map((slot) => slot === null ? void 0 : this.actor(slot)).filter((c) => !!c);
    const killer = m.lastHitBy === null ? null : this.actor(m.lastHitBy) ?? null;
    if (sealedMount(m.def) && wreck) for (const c of aboard) this.kill(c, killer === c ? null : killer, "core.wreck");
    else for (const c of aboard) this.leaveMount(c, true);
    const keep = wreck && m.def.vehicle ? Math.min(MOUNT_WRECK_SECONDS * TICK_RATE, m.respawnTicks - Math.round(MOUNT_WRECK_FADE_SECONDS * TICK_RATE)) : 0;
    m.wreckUntil = keep > 0 ? this.tick + keep : 0;
    m.speed *= 0.4;
    m.slide *= 0.4;
    this.physics.setBoxEnabled(m.body, false);
    this.physics.commit();
    const at2 = { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z };
    this.pendingEvents.push({ e: "explode", s: m.lastHitBy ?? -1, p: tuple(at2), r: m.def.blast.radius, m: m.index });
    const by = m.lastHitBy === null ? null : this.actor(m.lastHitBy) ?? null;
    this.splash(at2, m.def.blast.radius, m.def.blast.damage, m.def.blast.damage * 0.2, by, "core.wreck", 1, 9);
    this.ignite(at2, m.def.blast.radius);
    if (m.wreckUntil && !m.alive) {
      this.physics.setBoxEnabled(m.body, true);
      this.physics.commit();
    }
  }
  respawnMount(m) {
    m.alive = true;
    m.health = m.def.health;
    m.supply = m.def.resupply?.uses ?? 0;
    m.burning = false;
    m.wreckUntil = 0;
    m.restSince = void 0;
    m.pos = { ...m.home.pos };
    m.yaw = m.aimYaw = m.home.yaw;
    m.aimPitch = 0;
    m.speed = m.velY = m.slide = 0;
    m.vel = { x: 0, z: 0 };
    m.airborne = m.afloat = false;
    m.push = { x: 0, z: 0 };
    m.lastHitBy = null;
    m.stall = m.climbAssist = 0;
    m.assistFrom = null;
    m.wedged = void 0;
    m.low = false;
    if (m.suspSetup) m.susp = newSuspension(m.suspSetup);
    m.guns.forEach((g, i) => {
      if (!g) return;
      g.heat = 0;
      g.overheated = false;
      const ammo = m.def.seats[i]?.ammo;
      if (ammo) {
        g.shells = ammo.start ?? ammo.max;
        g.shellTicks = 0;
      }
    });
    this.physics.setBoxEnabled(m.body, true);
    this.physics.setBoxPose(m.body, { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z }, m.yaw);
  }
  stepMounts() {
    const prof = simProfile.on;
    this.suspensionRays = 0;
    for (const m of this.mounts) {
      const t0 = prof ? performance.now() : 0;
      this.stepMount(m);
      if (prof) simProfile.add(`mount ${m.def.kind}${m.seats.some((s) => s !== null) ? " (manned)" : ""}`, performance.now() - t0);
    }
    if (this.mounts.length) this.physics.commit();
  }
  stepMount(m) {
    {
      if (!m.alive) {
        if (this.tick < m.wreckUntil) this.settleWreck(m);
        else if (m.wreckUntil) {
          m.wreckUntil = 0;
          this.physics.setBoxEnabled(m.body, false);
        }
        if (this.phase === "playing" && this.tick >= m.respawnAt) this.respawnMount(m);
        return;
      }
      for (const g of m.guns) {
        if (!g?.def.heat || g.firedTick === this.tick) continue;
        g.heat = Math.max(0, (g.heat ?? 0) - g.def.heat.coolPerTick);
        if (g.heat === 0) g.overheated = false;
      }
      if (m.ammoGuns) this.resupply(m);
      if (m.route) this.flyPlane(m);
      if (m.def.vehicle) {
        if (this.farVehicle(m) && !m.moveOwed && (this.tick + m.index) % 2 === 0) m.moveOwed = true;
        else {
          this.driveVehicle(m, m.moveOwed ? 2 : 1);
          m.moveOwed = false;
        }
      }
      if (m.def.sentry) this.runSentry(m);
      if (m.alive && m.def.vehicle) this.vehicleHazards(m);
      if (!m.alive) return;
      m.seats.forEach((slot, seat) => {
        const c = slot === null ? void 0 : this.actor(slot);
        if (!c?.alive) return;
        c.move = this.seatMove(m, seat, c.rideCrouch);
        c.moveSpeed = Math.abs(m.speed);
      });
    }
  }
  /**
   * Limited mounted ammunition (SeatDef.ammo): a round back every refillSeconds, and every round back when the
   * vehicle, crewed, stands over one of the ammo pickups the seat names (SeatAmmo.pickups: the Tank's cannon, the
   * Ammo Box only) that is up (which it takes, as a player would).
   */
  resupply(m) {
    let short = false;
    m.guns.forEach((g, i) => {
      const ammo = m.def.seats[i]?.ammo;
      if (!g || !ammo || g.shells === void 0) return;
      if (g.shells >= ammo.max) {
        g.shellTicks = 0;
        return;
      }
      short = true;
      const every = ammoRefillTicks(ammo, TICK_RATE);
      if (every && (g.shellTicks = (g.shellTicks ?? 0) + 1) >= every) {
        g.shells++;
        g.shellTicks = 0;
      }
    });
    if (!short || (this.tick + m.index) % 6) return;
    const crew = m.seats.find((s) => s !== null);
    if (crew === void 0 || crew === null) return;
    const reach2 = Math.max(m.def.half[0], m.def.half[2]) + PICKUP_RADIUS$1;
    for (const b of this.boxes) {
      if (!b.body || b.uses <= 0 || b.kind !== "placed" || restrictedWeapons(this.rules)) continue;
      if (!m.guns.some((g, i) => g?.shells !== void 0 && m.def.seats[i]?.ammo && g.shells < m.def.seats[i].ammo.max && ammoRefilledBy(m.def.seats[i].ammo, AMMO_BOX_ITEM))) continue;
      if (horizontalDistance(b.pos, m.pos) > reach2 + AMMO_BOX_REACH || Math.abs(b.pos.y - m.pos.y) > 1.5) continue;
      const s = Math.sin(m.yaw);
      const c = Math.cos(m.yaw);
      const dx = b.pos.x - m.pos.x;
      const dz = b.pos.z - m.pos.z;
      if (Math.abs(dx * c - dz * s) > m.def.half[0] + AMMO_BOX_REACH || Math.abs(dx * s + dz * c) > m.def.half[2] + AMMO_BOX_REACH) continue;
      m.guns.forEach((g, i) => {
        const ammo = m.def.seats[i]?.ammo;
        if (g && ammo && ammoRefilledBy(ammo, AMMO_BOX_ITEM)) {
          g.shells = ammo.max;
          g.shellTicks = 0;
        }
      });
      b.uses--;
      this.pendingEvents.push({ e: "resupply", s: crew, m: m.index, b: b.id, left: b.uses, ok: true });
      if (b.uses <= 0) this.removeBox(b);
      return;
    }
    for (const p of this.pickups) {
      if (!p.enabled || this.tick < p.availableAt || p.item.effect.kind !== "ammo" || restrictedWeapons(this.rules)) continue;
      if (!m.guns.some((g, i) => g?.shells !== void 0 && m.def.seats[i]?.ammo && g.shells < m.def.seats[i].ammo.max && ammoRefilledBy(m.def.seats[i].ammo, p.item.id))) continue;
      if (horizontalDistance(p.pos, m.pos) > reach2 || p.pos.y < m.pos.y - 1.5 || p.pos.y > m.pos.y + m.def.half[1] * 2 + 1) continue;
      const s = Math.sin(m.yaw);
      const c = Math.cos(m.yaw);
      const dx = p.pos.x - m.pos.x;
      const dz = p.pos.z - m.pos.z;
      if (Math.abs(dx * c - dz * s) > m.def.half[0] + PICKUP_RADIUS$1 || Math.abs(dx * s + dz * c) > m.def.half[2] + PICKUP_RADIUS$1) continue;
      m.guns.forEach((g, i) => {
        const ammo = m.def.seats[i]?.ammo;
        if (g && ammo && ammoRefilledBy(ammo, p.item.id)) {
          g.shells = ammo.max;
          g.shellTicks = 0;
        }
      });
      p.availableAt = this.tick + p.respawnTicks;
      this.pendingEvents.push({ e: "pickup", s: crew, id: p.id, item: p.item.id });
      this.scenario.pickupTaken(p.id, crew);
      this.reroll(p);
      return;
    }
  }
  /** The private seat state (PrivateState.mo): [map entity index, seat, the gun's heat %, and its rounds aboard when they are limited]. */
  seatState(c) {
    const m = this.mounts[c.mount.index];
    const gs = this.gunSeatOf(c);
    const gun = gs === null ? null : m.guns[gs];
    const heat = Math.round((gun?.heat ?? 0) * 100);
    return gun?.shells !== void 0 ? [m.index, c.mount.seat, heat, gun.shells] : [m.index, c.mount.seat, heat];
  }
  /** The plane follows its route by the clock; at the end of an open route it starts over, throwing out anyone still aboard. */
  flyPlane(m) {
    const route = m.route;
    const t = this.routeTick(m);
    const pose = routePose(route, t);
    const drops = this.dropPlanFor(m);
    if (drops.any ? dropStretchEnds(drops, route, t) : ticksToRouteEnd(route, t) <= 1) {
      for (const slot of m.seats) {
        const c = slot === null ? void 0 : this.actor(slot);
        if (c) this.leaveMount(c, true);
      }
    }
    m.pos = pose.pos;
    m.yaw = m.aimYaw = pose.yaw;
  }
  /**
   * Fire, lava and water. A burning vehicle loses health on its own (from
   * the burn threshold it blows in MOUNT_BURN_SECONDS), so it goes up unless
   * someone finishes it first; lava sets it alight at once and eats it fast;
   * acid corrodes it; a ground vehicle sunk in deep water floods. Credit goes
   * to whoever hit it last.
   */
  vehicleHazards(m) {
    if (this.phase !== "playing" || (this.rules.vehicleDamage ?? "normal") === "off") return;
    const v = m.def.vehicle;
    const max = m.def.health;
    if (this.liquids.length) {
      const low = liquidAt(this.liquids, { x: m.pos.x, y: m.pos.y + 0.2, z: m.pos.z });
      if (low?.liquid === "lava") {
        m.burning = true;
        this.damageMount(m, max * 0.2 / TICK_RATE, null, true);
      } else if (low?.liquid === "acid") this.damageMount(m, max * 0.06 / TICK_RATE, null, true);
      const deep = !v.hover && !v.fly && !m.afloat ? liquidAt(this.liquids, { x: m.pos.x, y: m.pos.y + m.def.half[1] * 1.5, z: m.pos.z }) : null;
      if (deep && deep.liquid !== "lava") this.damageMount(m, max * 0.12 / TICK_RATE, null, true);
    }
    if (m.alive && m.burning) this.damageMount(m, max * MOUNT_BURN_FRACTION / MOUNT_BURN_SECONDS / TICK_RATE, null, true);
  }
  /** A wreck coasts to a stop and drops to the ground (a downed flyer falls), staying solid. */
  settleWreck(m) {
    if (!m.probe) return;
    m.speed *= 0.9;
    m.slide *= 0.8;
    m.push = { x: m.push.x * 0.85, z: m.push.z * 0.85 };
    const vx = Math.sin(m.yaw) * m.speed + Math.cos(m.yaw) * m.slide + m.push.x;
    const vz = Math.cos(m.yaw) * m.speed - Math.sin(m.yaw) * m.slide + m.push.z;
    if (Math.abs(vx) + Math.abs(vz) < 0.05 && !m.airborne && this.tick % 15 !== m.index % 15) {
      m.vel = { x: 0, z: 0 };
      return;
    }
    m.velY = Math.max(-30, m.velY - PLAYER.gravity * TICK_DT);
    const moved = this.moveVehicleProbe(m, { x: vx * TICK_DT, y: m.velY * TICK_DT, z: vz * TICK_DT });
    if (moved.grounded) m.velY = 0;
    m.airborne = !moved.grounded;
    m.vel = { x: vx, z: vz };
    m.pos = moved.feet;
    this.physics.setBoxPose(m.body, { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z }, m.yaw);
    if (m.pos.y < this.killY) {
      m.wreckUntil = 0;
      this.physics.setBoxEnabled(m.body, false);
    }
  }
  /**
   * Move a vehicle's probe by `delta`. The probe capsule's dome stands well over the hull (its radius follows the
   * hull's width: a Hauler's is 3.4 m tall, its hull 2 m), so under a deck, a beam or a low roof the capsule caught
   * where the hull fits and the vehicle wedged there, unable to drive in or out. With something over the hull that
   * the dome would touch (PhysicsWorld.overhead), or when the capsule is stopped and the low probe (the same bottom,
   * cut off at the hull's top) gets further, the low probe carries it (`low`) until the space over it is clear
   * again. Over open ground nothing is overhead: the capsule alone, as before.
   */
  moveVehicleProbe(m, delta) {
    const lowProbe = m.lowProbe;
    if (!lowProbe) return this.physics.moveVehicle(m.probe, m.body, m.pos, delta, !m.def.vehicle.fly);
    const r = Math.min(m.def.half[0], m.def.half[2]) * 0.95;
    const hull = m.def.half[1] * 2;
    m.low = this.physics.overhead(m.pos, hull, this.physics.probeHeight(m.probe) + 0.1, r, m.body);
    if (m.low) return this.physics.moveVehicle(lowProbe, m.body, m.pos, delta);
    const moved = this.physics.moveVehicle(m.probe, m.body, m.pos, delta);
    if (moved.blocked < 0.25) return moved;
    const low = this.physics.moveVehicle(lowProbe, m.body, m.pos, delta);
    if (low.blocked > moved.blocked - 0.05) return moved;
    m.low = true;
    return low;
  }
  /**
   * Crashes between mounts: a vehicle driven into another vehicle, a wreck
   * or a turret hurts both, by how fast they closed and how heavy the other
   * one is (a hover bike into a tank comes off far worse), and shoves the lighter
   * one. Each side's driver gets the credit for the other's damage.
   */
  ramMounts(m, vx, vz, driver) {
    if (hypot(vx, vz) < RAM_MIN_SPEED) return;
    const reach2 = hypot(m.def.half[0], m.def.half[2]) + 0.5;
    for (const o of this.mounts) {
      if (o === m || o.route || !o.alive && this.tick >= o.wreckUntil || (m.rammed.get(o.index) ?? 0) > this.tick) continue;
      const r = reach2 + hypot(o.def.half[0], o.def.half[2]);
      if (Math.abs(o.pos.x - m.pos.x) > r || Math.abs(o.pos.z - m.pos.z) > r) continue;
      const c = footprintGap({ pos: m.pos, yaw: m.yaw, half: m.def.half }, { pos: o.pos, yaw: o.yaw, half: o.def.half });
      if (!c || c.gap > 0.3) continue;
      const closing = (vx - o.vel.x) * c.nx + (vz - o.vel.z) * c.nz;
      if (closing < RAM_MIN_SPEED) continue;
      m.rammed.set(o.index, this.tick + TICK_RATE / 2);
      o.rammed.set(m.index, this.tick + TICK_RATE / 2);
      const ma = mountMass(m.def);
      const mb = mountMass(o.def);
      const hit = (closing - 3) * RAM_DAMAGE;
      const otherSlot = o.alive ? o.seats[o.def.seats.findIndex((s) => s.role === "driver")] ?? null : null;
      const other = otherSlot === null ? null : this.actor(otherSlot) ?? null;
      this.damageMount(o, hit * 2 * ma / (ma + mb), driver);
      this.damageMount(m, hit * 2 * mb / (ma + mb), other);
      if (o.def.vehicle) {
        const shove = closing * ma / (ma + mb);
        o.push = { x: o.push.x + c.nx * shove, z: o.push.z + c.nz * shove };
      }
      if (m.alive) m.speed *= mb > ma ? 0.3 : 0.6;
      const at2 = { x: (m.pos.x + o.pos.x) / 2, y: m.pos.y + Math.min(m.def.half[1], o.def.half[1]), z: (m.pos.z + o.pos.z) / 2 };
      this.pendingEvents.push({ e: "crash", p: tuple(at2), n: Math.min(1, closing / 25) });
    }
  }
  /**
   * Arcade driving with weight. Throttle pushes along the heading; the tyres
   * (or hover pads) only kill part of any sideways slide each tick, so
   * turning hard at speed drifts, the handbrake (jump) breaks grip for a
   * powerslide, and hovercraft glide. Steering is sharpest at mid speed.
   * Going over a crest keeps the climb's upward speed, so ramps launch you;
   * in the air there's little steering and no throttle, and a hard landing
   * dents the vehicle. Walls bleed speed, less for heavy ones.
   */
  driveVehicle(m, ticks = 1) {
    const dt = TICK_DT * ticks;
    const v = m.def.vehicle;
    const { forward, right, brake } = m.drive;
    const speedBefore = m.speed;
    const mass = v.mass ?? 1;
    const grounded = !m.airborne || !!v.hover || !!v.fly;
    const road = roadHandling(this.road, m.pos, !!v.hover || !!v.fly);
    const water = m.afloat ? FLOAT.speed : 1;
    const target = (forward > 0 ? v.maxSpeed * forward : forward < 0 ? -v.reverseSpeed * -forward : 0) * road.speed * water;
    const braking = target === 0 || Math.sign(target) !== Math.sign(m.speed);
    let rate = (target === 0 ? v.accel * (v.hover ? 0.35 : 0.8) : braking ? v.accel * 1.8 : v.accel) * dt;
    if (!grounded) rate = 0;
    if (brake && grounded) rate = Math.max(rate, v.accel * 1.2 * dt);
    const piloted = m.def.seats.some((s, i) => s.role === "driver" && m.seats[i] !== null);
    const idle = !piloted && !m.ambient && grounded ? (v.idleBrake ?? DEFAULT_IDLE_BRAKE) * dt : 0;
    if (idle) {
      rate = Math.max(rate, idle);
      const slide = Math.abs(m.slide);
      m.slide = slide > idle ? m.slide - Math.sign(m.slide) * idle : 0;
    }
    m.speed += Math.max(-rate, Math.min(rate, (brake || idle ? 0 : target) - m.speed));
    const frac = Math.min(1, Math.abs(m.speed) / v.maxSpeed);
    const steer2 = Math.min(1, Math.abs(m.speed) / 5) * (1 - 0.35 * frac * frac) * (grounded ? 1 : 0.2) * (brake ? 1.35 : 1);
    const pivot = v.pivot && grounded ? v.pivot * Math.max(0, 1 - Math.abs(m.speed) / 5) : 0;
    const turn = right * dt * (v.turnRate * steer2 + pivot) * (m.speed >= -0.05 ? 1 : -1);
    m.yaw += turn;
    m.slide += -m.speed * Math.sin(turn);
    const loose = v.drift ? 1 - v.drift * frac * frac : 1;
    const wheels = m.susp && m.suspSetup ? 0.35 + 0.65 * m.susp.contact / m.suspSetup.points.length : 1;
    const grip = grounded ? Math.min(0.6, (v.grip ?? (v.hover ? 0.06 : 0.25)) * road.grip * loose * wheels) * (brake ? 0.25 : 1) * (m.afloat ? FLOAT.grip : 1) : 0;
    m.slide *= (1 - grip) ** ticks;
    if (Math.abs(m.slide) < 0.02) m.slide = 0;
    if (v.fly) {
      const asked = m.drive.lift ?? 0;
      if (asked) m.assistFrom = null;
      else if (m.climbAssist > 0) m.assistFrom ??= m.pos.y;
      else if (m.assistFrom !== null && m.pos.y <= m.assistFrom + 0.05) m.assistFrom = null;
      const want = !piloted ? -v.fly.climb * 0.5 : m.climbAssist > 0 ? Math.max(1, asked) * v.fly.climb : m.assistFrom !== null ? -v.fly.climb * 0.5 : asked * v.fly.climb;
      m.velY += Math.max(-v.fly.climb * 3 * dt, Math.min(v.fly.climb * 3 * dt, want - m.velY));
      if (m.pos.y >= m.home.pos.y + v.fly.ceiling && m.velY > 0) m.velY = 0;
    } else m.velY -= PLAYER.gravity * dt;
    const dir = { x: Math.sin(m.yaw), z: Math.cos(m.yaw) };
    const side = { x: Math.cos(m.yaw), z: -Math.sin(m.yaw) };
    const vx = dir.x * m.speed + side.x * m.slide + m.push.x;
    const vz = dir.z * m.speed + side.z * m.slide + m.push.z;
    const parked = !vx && !vz && m.seats.every((s) => s === null) && (!m.susp || m.susp.settled);
    if (!parked) m.restSince = void 0;
    else if (m.restSince !== void 0 && (this.tick - m.restSince) % 30 !== 0) {
      m.vel = { x: 0, z: 0 };
      m.velY = 0;
      return;
    }
    const startY = m.pos.y;
    const surface = m.floats && this.liquids.length ? floatSurface(this.liquids, m.pos) : null;
    const line = surface === null ? null : surface - (v.draft ?? FLOAT.draft);
    if (line !== null && m.pos.y + m.velY * dt < line) m.velY = Math.min(FLOAT.rise, (line - m.pos.y) / dt);
    const moved = this.moveVehicleProbe(m, { x: vx * dt, y: m.velY * dt, z: vz * dt });
    if (parked && Math.abs(moved.feet.y - startY) < 1e-3) m.restSince ??= this.tick;
    else m.restSince = void 0;
    const climbed = (moved.feet.y - startY) / dt;
    const afloat = line !== null && moved.feet.y <= line + 0.02;
    const wasAfloat = m.afloat;
    const wasAirborne = m.airborne;
    const fallSpeed = m.velY;
    m.afloat = afloat;
    if (afloat && !moved.grounded) {
      m.velY = 0;
      m.airborne = false;
    } else if (moved.grounded) {
      if (m.airborne && !wasAfloat && !afloat && m.velY < -11 && !v.hover && !v.fly) this.damageMount(m, (-m.velY - 11) * 6 * mass, null);
      m.velY = v.fly ? Math.max(0, m.velY) : Math.max(0, Math.min(climbed, 14));
      m.airborne = false;
    } else m.airborne = true;
    if (moved.blocked > 0.6 && Math.abs(m.speed) > 4) {
      m.speed *= Math.min(0.8, 0.4 + mass * 0.1);
      m.slide *= 0.5;
    }
    const throttle = piloted && Math.abs(forward) > 0.2;
    if (v.fly) m.climbAssist = throttle && moved.blocked > 0.5 ? CLIMB_ASSIST_TICKS : Math.max(0, m.climbAssist - ticks);
    const step = Math.hypot(moved.feet.x - m.pos.x, moved.feet.z - m.pos.z);
    m.stall = throttle && step < WEDGE_STEP * ticks ? m.stall + ticks : Math.max(0, m.stall - 2 * ticks);
    if (m.stall >= WEDGE_TICKS && !m.wedged) m.wedged = { at: { ...moved.feet } };
    else if (m.wedged && Math.hypot(moved.feet.x - m.wedged.at.x, moved.feet.z - m.wedged.at.z) > WEDGE_FREED) {
      m.wedged = void 0;
      m.stall = 0;
    }
    m.pos = moved.feet;
    if (m.susp) this.suspend(m, ticks, speedBefore, turn, right, wasAirborne && !m.airborne ? Math.max(0, -fallSpeed) : 0);
    const decay = (moved.grounded || afloat ? 0.9 : 0.99) ** ticks;
    m.push = { x: m.push.x * decay, z: m.push.z * decay };
    this.physics.setBoxPose(m.body, { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z }, m.yaw);
    if (m.pos.y < this.killY) {
      this.destroyMount(m, false);
      return;
    }
    const driverSlot = m.seats[m.def.seats.findIndex((s) => s.role === "driver")] ?? null;
    const driver = driverSlot === null ? null : this.actor(driverSlot) ?? null;
    m.vel = { x: vx, z: vz };
    this.ramMounts(m, vx, vz, driver);
    if (!m.alive) return;
    if (Math.abs(m.speed) < 5) return;
    for (const c of this.actors()) {
      if (!c.alive || m.seats.includes(c.slot) || (m.runOver.get(c.slot) ?? 0) > this.tick) continue;
      const rel = { x: c.move.pos.x - m.pos.x, z: c.move.pos.z - m.pos.z };
      const lx = rel.x * Math.cos(m.yaw) - rel.z * Math.sin(m.yaw);
      const lz = rel.x * Math.sin(m.yaw) + rel.z * Math.cos(m.yaw);
      if (Math.abs(lx) > m.def.half[0] + PLAYER.radius || Math.abs(lz) > m.def.half[2] + PLAYER.radius || Math.abs(c.move.pos.y - m.pos.y) > 1.5) continue;
      if (driver && driver !== c && !this.canHurt(driver, c)) continue;
      m.runOver.set(c.slot, this.tick + 30);
      this.push(c, { x: dir.x + (lx >= 0 ? 1 : -1) * Math.cos(m.yaw) * 0.6, y: 0.4, z: dir.z - (lx >= 0 ? 1 : -1) * Math.sin(m.yaw) * 0.6 }, Math.abs(m.speed) * 0.8);
      this.damage(c, Math.abs(m.speed) * 5, driver, "core.roadkill");
      this.pendingEvents.push({ e: "crash", p: tuple(chest(c.move.pos)), n: Math.min(1, Math.abs(m.speed) / 40) });
    }
  }
  /** Suspension rays cast this tick (stepMounts resets it): past SUSPENSION_RAY_BUDGET, vehicles sample less often. */
  suspensionRays = 0;
  /**
   * The sprung body (sim/suspension.ts) after the chassis moved: one ray down per wheel, then the springs. Far,
   * parked and settled vehicles skip it (driveVehicle's parked early return, Match.farVehicle); past the tick's
   * ray budget a vehicle reuses the ground it found last tick on two ticks of three.
   */
  suspend(m, ticks, speedBefore, turn, steer2, landing) {
    const s = m.susp;
    const t = m.suspSetup;
    if (ticks > 1) {
      s.h = s.hv = s.p = s.pv = s.r = s.rv = s.steer = 0;
      s.wheel.fill(0);
      s.contact = t.points.length;
      s.settled = true;
      return;
    }
    const dt = TICK_DT;
    const aLong = Math.max(-40, Math.min(40, (m.speed - speedBefore) / dt));
    const aLat = Math.max(-40, Math.min(40, m.speed * turn / dt));
    const grounded = !m.airborne;
    if (s.settled && grounded && !landing && m.vel.x === 0 && m.vel.z === 0 && m.speed === 0 && steer2 === 0) return;
    if (grounded && (this.suspensionRays < SUSPENSION_RAY_BUDGET || (this.tick + m.index) % 3 === 0)) {
      const sin = Math.sin(m.yaw);
      const cos = Math.cos(m.yaw);
      const top = t.hubY + 0.6;
      const reach2 = top + t.travel + 0.5;
      for (let i = 0; i < t.points.length; i++) {
        const [x, z] = t.points[i];
        const d = this.physics.groundBelow({ x: m.pos.x + x * cos + z * sin, y: m.pos.y + top, z: m.pos.z - x * sin + z * cos }, reach2, m.body);
        s.ground[i] = d === null ? null : top - d + VEHICLE_SKIN;
      }
      this.suspensionRays += t.points.length;
    }
    stepSuspension(s, t, dt, { grounded, aLong, aLat, landing, steer: steer2 });
  }
  /** Sentries turn toward the nearest enemy they can see and fire while lined up. */
  runSentry(m) {
    const spec = m.def.sentry;
    if (spec.arc) return this.runArcSentry(m);
    const muzzle = { x: m.pos.x, y: m.pos.y + m.def.half[1] * 2 + 0.2, z: m.pos.z };
    let target = null;
    let bestD = spec.range;
    for (const c of this.actors()) {
      if (!c.alive || c.slot === m.builtBy) continue;
      if (m.faction !== null && relation(this.factions, m.faction, c.faction) !== "enemy") continue;
      const d = distance(muzzle, chest(c.move.pos));
      if (d < bestD && this.sees(muzzle, chest(c.move.pos))) {
        bestD = d;
        target = c;
      }
    }
    if (m.cooldown > 0) m.cooldown--;
    if (!target) return;
    const want = lookAngles(muzzle, chest(target.move.pos));
    const dy = Math.atan2(Math.sin(want.yaw - m.aimYaw), Math.cos(want.yaw - m.aimYaw));
    const turn = spec.turnRate * TICK_DT;
    m.aimYaw += Math.max(-turn, Math.min(turn, dy));
    m.aimPitch += Math.max(-turn, Math.min(turn, want.pitch - m.aimPitch));
    if (Math.abs(dy) > 0.12 || m.cooldown > 0) return;
    const def = getWeapon(spec.weapon);
    m.cooldown = def.fireIntervalTicks;
    const dir = this.spreadDir(viewDirection(m.aimYaw, m.aimPitch), def.spread);
    const world = this.physics.raycastHit(muzzle, dir, def.range);
    const targets = this.actors().filter((c) => c.alive && c.slot !== m.builtBy && (m.faction === null || relation(this.factions, m.faction, c.faction) === "enemy")).map((c) => this.shotBody(c));
    const shot = resolveHitscan(muzzle, dir, def.range, world && world.handle !== m.body.handle ? world.dist : null, targets);
    this.scenario.shootGlass(muzzle, dir, shot.distance, m.builtBy ?? null);
    this.pendingEvents.push({ e: "shot", s: -1, w: def.id, from: tuple(muzzle), to: [tuple(shot.end)], hit: [shot.hitSlot] });
    if (shot.hitSlot !== null) this.damage(this.actor(shot.hitSlot), def.damage, m.builtBy === void 0 ? null : this.slots[m.builtBy] ?? null, def.id);
  }
  /** Whether an arc sentry may shoot this combatant (alive, not its builder, an enemy of its team if it has one). */
  arcTargetable(m, c) {
    if (!c || !c.alive || c.slot === m.builtBy) return false;
    return m.faction === null || relation(this.factions, m.faction, c.faction) === "enemy";
  }
  /**
   * An arc sentry (mounts.ts ArcSentrySpec): keeps to the target it has while it can see it in range, else takes
   * the nearest one it can see; turns to it, winds up while lined up, then holds an arc on it that hits every
   * `fireIntervalTicks` (and jumps to one enemy beside it, `chain`). Losing sight or range drops the lock and the
   * charge: the next target needs the full wind-up. A full lock ends in a vent.
   */
  runArcSentry(m) {
    const spec = m.def.sentry;
    const arc = spec.arc;
    const st = m.arc ??= { charge: 0, target: null, lockTicks: 0, vent: 0 };
    const def = getWeapon(spec.weapon);
    const muzzle = { x: m.pos.x, y: m.pos.y + m.def.half[1] * 2 + 0.2, z: m.pos.z };
    const sees = (c) => distance(muzzle, chest(c.move.pos)) <= spec.range && this.sees(muzzle, chest(c.move.pos));
    if (m.cooldown > 0) m.cooldown--;
    if (st.vent > 0) {
      st.vent--;
      return;
    }
    const held = st.target === null ? void 0 : this.actor(st.target);
    if (!this.arcTargetable(m, held) || !sees(held)) {
      st.target = null;
      st.charge = 0;
      st.lockTicks = 0;
      let bestD = spec.range;
      for (const c of this.actors()) {
        if (!this.arcTargetable(m, c)) continue;
        const d = distance(muzzle, chest(c.move.pos));
        if (d < bestD && this.sees(muzzle, chest(c.move.pos))) {
          bestD = d;
          st.target = c.slot;
        }
      }
      if (st.target === null) return;
    }
    const target = this.actor(st.target);
    const want = lookAngles(muzzle, chest(target.move.pos));
    const dy = Math.atan2(Math.sin(want.yaw - m.aimYaw), Math.cos(want.yaw - m.aimYaw));
    const turn = spec.turnRate * TICK_DT;
    m.aimYaw += Math.max(-turn, Math.min(turn, dy));
    m.aimPitch += Math.max(-turn, Math.min(turn, want.pitch - m.aimPitch));
    const windUp = Math.round(arc.windUpSeconds * TICK_RATE);
    if (st.charge < windUp) {
      if (Math.abs(dy) <= 0.2) st.charge++;
      return;
    }
    if (st.lockTicks >= Math.round(arc.lockSeconds * TICK_RATE)) {
      st.vent = Math.round(arc.ventSeconds * TICK_RATE);
      st.target = null;
      st.charge = 0;
      st.lockTicks = 0;
      m.cooldown = 0;
      return;
    }
    st.lockTicks++;
    if (m.cooldown > 0) return;
    m.cooldown = def.fireIntervalTicks;
    const by = m.builtBy === void 0 ? null : this.slots[m.builtBy] ?? null;
    const pts = [tuple(muzzle), tuple(chest(target.move.pos))];
    this.damage(target, def.damage, by, def.id);
    const chain = def.chain;
    let at2 = target;
    let damage = def.damage;
    const hit = /* @__PURE__ */ new Set([target.slot]);
    for (let j = 0; chain && j < chain.jumps; j++) {
      const here = chest(at2.move.pos);
      let next = null;
      let best = chain.range;
      for (const o of this.actors()) {
        if (hit.has(o.slot) || !this.arcTargetable(m, o)) continue;
        const d = distance(here, chest(o.move.pos));
        if (d < best && this.physics.lineOfSight(here, chest(o.move.pos))) {
          best = d;
          next = o;
        }
      }
      if (!next) break;
      damage *= chain.falloff;
      hit.add(next.slot);
      pts.push(tuple(chest(next.move.pos)));
      this.damage(next, damage, by, def.id);
      at2 = next;
    }
    this.pendingEvents.push({ e: "arc", s: -1, pts, m: m.index });
  }
  /** Vehicles with raycast suspension, alive, for snapshots (`ms`, see suspensionSnapshot). */
  suspensionSnapshots() {
    const out = [];
    for (const m of this.mounts) if (m.susp && m.alive) out.push(suspensionSnapshot(m.index, m.susp));
    return out;
  }
  /** Mounts for snapshots (see MountSnapshot). */
  mountSnapshots() {
    return this.mounts.map((m) => [m.index, r3(m.pos.x), r3(m.pos.y), r3(m.pos.z), r3(m.yaw), r3(m.aimYaw), r3(m.aimPitch), Math.ceil(Math.max(0, m.health) / m.def.health * 100), (m.alive ? MOUNT_FLAG_ALIVE : 0) | (this.tick < m.wreckUntil ? MOUNT_FLAG_WRECK : 0) | (m.burning ? MOUNT_FLAG_BURNING : 0) | (m.alive && m.arc ? arcFlags(m) : 0), ...m.seats.map((s) => s ?? -1), ...m.def.resupply ? [m.supply] : []]);
  }
  // ---------------------------------------------------------------- hazards and status effects
  /** A smoke zone's radius now (SMOKE: it billows out, sits, thins; 0 once it hides nothing). */
  smokeNow(z) {
    return smokeRadius(z.radius, (this.tick - z.start) / TICK_RATE, (z.endTick - z.start) / TICK_RATE);
  }
  smokeCache = { tick: -1, clouds: [] };
  /** The smoke clouds up now, for the sight checks (bots, sentries, homing, spawn safety); worked out once a tick. */
  smokeClouds() {
    if (this.smokeCache.tick === this.tick) return this.smokeCache.clouds;
    const clouds = [];
    for (const z of this.zones) {
      if (z.kind !== "smoke") continue;
      const radius = this.smokeNow(z);
      if (radius > 0) clouds.push({ x: z.pos.x, y: z.pos.y + radius * SMOKE.rise, z: z.pos.z, radius });
    }
    this.smokeCache = { tick: this.tick, clouds };
    return clouds;
  }
  /**
   * Whether `b` can be seen from `a`: nothing static in the way and no smoke cloud across it. For sight only:
   * shots, blasts and chain lightning go through smoke (they use the physics' own line).
   */
  sees(a, b) {
    return this.physics.lineOfSight(a, b) && !smokeBlocks(a, b, this.smokeClouds());
  }
  spawnZone(spec, at2, owner, weapon) {
    let pos = at2;
    if (spec.kind === "fire" || spec.kind === "oil" || spec.kind === "goo" || spec.kind === "smoke") {
      const down = this.physics.raycastHit({ x: at2.x, y: at2.y + 0.3, z: at2.z }, { x: 0, y: -1, z: 0 }, 8);
      if (down) pos = { x: at2.x, y: at2.y + 0.3 - down.dist, z: at2.z };
    }
    const endTick = this.tick + Math.round(spec.seconds * TICK_RATE);
    const same = this.zones.find((z) => z.kind === spec.kind && distance(z.pos, pos) < spec.radius * 0.5);
    if (same) {
      same.endTick = Math.max(same.endTick, endTick);
      same.owner = owner;
      return;
    }
    this.zones.push({ kind: spec.kind, pos, radius: spec.radius, start: this.tick, endTick, owner, weapon });
    if (this.zones.length > MAX_ZONES) this.zones.shift();
  }
  /** Oil within reach of a flame or blast catches fire. */
  ignite(at2, reach2) {
    for (const z of this.zones) {
      if (z.kind !== "oil" || distance(z.pos, at2) > z.radius + reach2) continue;
      z.kind = "fire";
      z.radius *= 1.15;
      z.endTick = this.tick + TICK_RATE * 7;
    }
  }
  stepZones() {
    if (!this.zones.length) return;
    const live = [];
    for (const z of this.zones) {
      if (this.tick < z.endTick) {
        live.push(z);
        continue;
      }
      if (z.kind === "singularity") {
        this.pendingEvents.push({ e: "explode", s: z.owner, p: tuple(z.pos), r: 5, w: z.weapon });
        this.splash(z.pos, 5, 90, 20, this.actor(z.owner) ?? null, z.weapon, 0.6, blastKnockback({ splashDamage: 90 }));
        this.ignite(z.pos, 5);
      }
    }
    this.zones = live;
    for (const f of this.zones) if (f.kind === "fire") this.ignite(f.pos, f.radius * 0.5);
    for (const c of this.actors()) {
      if (!c.alive) continue;
      for (const z of this.zones) {
        if (z.kind === "smoke" || !inZone(z, c.move.pos)) continue;
        const owner = this.actor(z.owner) ?? null;
        switch (z.kind) {
          case "fire":
            this.applyStatus(c, { kind: "burn", seconds: 2 }, owner, z.weapon);
            this.damage(c, FIRE_ZONE_DPS / TICK_RATE, owner, z.weapon);
            break;
          case "toxic":
            this.applyStatus(c, { kind: "poison", seconds: 2 }, owner, z.weapon);
            break;
          case "goo":
            this.applyStatus(c, { kind: "slow", seconds: 0.4 }, owner, z.weapon);
            break;
          case "singularity": {
            const to = sub(z.pos, chest(c.move.pos));
            const d = hypot(to.x, to.y, to.z) || 1;
            const pull = 0.9 * (1 - d / z.radius) + 0.15;
            const vx = Math.max(-14, Math.min(14, (c.move.vx ?? 0) + to.x / d * pull));
            const vz = Math.max(-14, Math.min(14, (c.move.vz ?? 0) + to.z / d * pull));
            c.move = { ...c.move, vx, vz, velY: Math.max(c.move.velY, to.y > 0 ? 2.5 : c.move.velY), grounded: to.y > 0 ? false : c.move.grounded };
            break;
          }
        }
        if (!c.alive) break;
      }
    }
  }
  /** Lava and acid burn while you stand in them; staying under water too long drowns you. */
  stepLiquid(c) {
    if (!this.liquids.length) return;
    const p = c.move.pos;
    const feet = liquidAt(this.liquids, { x: p.x, y: p.y + 0.1, z: p.z });
    if (feet && LIQUID_SPECS[feet.liquid].dps > 0) this.damage(c, LIQUID_SPECS[feet.liquid].dps / TICK_RATE, null, `core.${feet.liquid}`);
    const head = liquidAt(this.liquids, { x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z });
    c.breath = head ? c.breath + 1 : 0;
    if (c.alive && c.breath > BREATH_SECONDS * TICK_RATE) this.damage(c, 10 / TICK_RATE, null, "core.drown");
  }
  /** Damage over time, slows wearing off, chill thawing. */
  stepStatuses() {
    for (const c of this.actors()) {
      if (!c.alive) continue;
      const by = c.statusBy === null ? null : this.actor(c.statusBy) ?? null;
      if (c.burnTicks > 0) {
        c.burnTicks--;
        this.damage(c, BURN_DPS / TICK_RATE, by, c.statusWeapon);
      }
      if (c.alive && c.poisonTicks > 0) {
        c.poisonTicks--;
        this.damage(c, POISON_DPS / TICK_RATE, by, c.statusWeapon);
      }
      if (c.alive) this.stepLiquid(c);
      if (c.slowTicks > 0) c.slowTicks--;
      stepImpact(c.impact);
      if (c.frozenTicks > 0) c.frozenTicks--;
      else if (c.chill > 0) c.chill = Math.max(0, c.chill - 0.45 / TICK_RATE);
    }
  }
  /** Radial damage falling off from `damage` at the centre to `edge` at `radius`, blocked by walls. Also hits destructibles. */
  splash(at2, radius, damage, edge, owner, weapon, selfScale, knockback = 0, status) {
    if (this.rules.lunar && knockback < LUNAR_BLAST_KNOCK && damage > 0) knockback = LUNAR_BLAST_KNOCK;
    for (const c of this.actors()) {
      if (!c.alive || this.sheltered(c)) continue;
      const target = chest(c.move.pos);
      const d = distance(at2, target);
      if (d > radius || !this.physics.lineOfSight(at2, target)) continue;
      let dmg = damage + (edge - damage) * (d / radius);
      if (owner && c === owner) dmg *= selfScale;
      if (knockback && !c.mount) this.throwBy(c, blastThrow(d > 0.01 ? scale(sub(target, at2), 1 / d) : { x: 0, y: 1, z: 0 }, d, radius, knockback, c === owner));
      if (dmg > 0) this.damage(c, dmg, owner, weapon);
      if (status && c.alive) this.applyStatus(c, status, owner, weapon);
    }
    const boost = owner && owner.damageTicks > 0 ? DAMAGE_BOOST : 1;
    for (const m of this.mounts) {
      if (!m.alive) continue;
      const centre = { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z };
      const d = Math.max(0, distance(at2, centre) - Math.min(m.def.half[0], m.def.half[2]));
      if (d <= radius) this.damageMount(m, (damage + (edge - damage) * (d / radius)) * boost, owner, false, "blast", weapon);
    }
    for (const b of [...this.boxes]) {
      if (!b.body) continue;
      const d = Math.max(0, distance(at2, { x: b.pos.x, y: b.pos.y + AMMO_BOX_HALF[1], z: b.pos.z }) - AMMO_BOX_HALF[2]);
      if (d <= radius) this.damageBox(b, (damage + (edge - damage) * (d / radius)) * boost, owner);
    }
    for (const cv of [...this.covers]) {
      const d = Math.max(0, distance(at2, { x: cv.pos.x, y: cv.pos.y + cv.half.y, z: cv.pos.z }) - cv.half.x);
      if (d <= radius) this.damageCover(cv, (damage + (edge - damage) * (d / radius)) * boost * 1.5);
    }
    this.scenario.splash(at2, radius, damage * boost, edge * boost, owner?.slot ?? null, this.physics);
    this.mode?.splash?.(at2, radius, damage * boost, edge * boost, owner);
  }
  boosted(attacker, amount) {
    return attacker.damageTicks > 0 ? amount * DAMAGE_BOOST : amount;
  }
  /**
   * Fall damage (when the match or map has it on): the drop from the top of
   * the fall to where you land, weighted by gravity, past 5 m hurts and about
   * 16 m kills. Jump-pad flights, ladders and water landings are free.
   */
  trackFall(c, before, padded) {
    const m = c.move;
    if (m.chute) {
      c.fallPeak = m.pos.y;
      c.padFlight = false;
      return;
    }
    if (padded || m.climb || m.swim) {
      c.fallPeak = void 0;
      c.padFlight = padded || c.padFlight;
      return;
    }
    if (!m.grounded) {
      c.fallPeak = Math.max(c.fallPeak ?? before.pos.y, m.pos.y);
      return;
    }
    const peak = c.fallPeak;
    const free = c.padFlight;
    c.fallPeak = void 0;
    c.padFlight = false;
    if (!this.phys.fallDamage || peak === void 0 || free || before.grounded) return;
    const drop = (peak - m.pos.y) * this.phys.gravity * gravityAt(this.gravityZones, m.pos);
    if (drop > 5) this.damage(c, (drop - 5) * 9, null, "core.fall");
  }
  /** Apply damage through armor and the attacker's damage boost. */
  damage(victim, amount, attacker, weapon, head = false) {
    if (!victim.alive || this.phase !== "playing" || victim.invulnerable) return;
    if (this.sheltered(victim)) return;
    if (this.mode?.blocksDamage?.(victim, attacker)) return;
    if (attacker && attacker !== victim && this.shielded(victim)) return;
    if (this.classes) amount = this.classes.adjustDamage(victim, attacker, weapon, amount);
    amount *= lethalityScale(this.rules);
    if (amount <= 0) return;
    if (attacker && attacker !== victim && !this.hostile(attacker, victim)) {
      const ff = this.rules.friendlyFire ?? "off";
      if (ff === "off" || attacker.npc || victim.npc) return;
      if (ff === "half") amount *= 0.5;
    }
    if (attacker?.npc && !victim.npc) amount *= NPC_DAMAGE_TO_PLAYERS;
    if (attacker?.npc) amount *= (NPC_ROLE_SPECS[attacker.npc.role].damage ?? 1) * attacker.npc.damage;
    else if (attacker && attacker !== victim) amount *= isMeleeWeapon(weapon) ? attacker.stats.melee : attacker.stats.damage;
    if (victim.stats.armor > 0) amount *= 1 - victim.stats.armor;
    let dmg = attacker && attacker !== victim && attacker.damageTicks > 0 ? amount * DAMAGE_BOOST : amount;
    const hit = dmg;
    if (victim.armor > 0) {
      const absorbed = Math.min(victim.armor, dmg * ARMOR_ABSORB);
      victim.armor -= absorbed;
      dmg -= absorbed;
      if (victim.armor <= 0.01) {
        victim.armor = 0;
        this.pendingEvents.push({ e: "hurt", a: "armor", s: victim.slot, p: [round2(victim.move.pos.x), round2(victim.move.pos.y + 1.2 * victim.size), round2(victim.move.pos.z)] });
      }
    }
    if (attacker && attacker !== victim && hit >= MATCH_PLAY.heavyHit) this.pendingEvents.push({ e: "hurt", a: "big", s: victim.slot, k: attacker.slot, n: Math.round(hit), p: [round2(victim.move.pos.x), round2(victim.move.pos.y + 1.1 * victim.size), round2(victim.move.pos.z)] });
    const armoured = dmg < hit;
    victim.health -= dmg;
    victim.hurtAt = this.tick;
    if (attacker && attacker !== victim) {
      if (this.fireteams && !attacker.npc && !victim.npc && this.hostile(attacker, victim)) this.fireteams.scores.hurt(attacker.slot, victim.slot, this.tick);
      const k = victim.size;
      const at2 = { x: victim.move.pos.x, y: victim.move.pos.y + (head ? 1.75 : 1.2) * k, z: victim.move.pos.z };
      this.noteDealt(attacker, hit, (head ? 1 : 0) | (armoured ? 2 : 0) | (victim.health <= 0 ? 4 : 0), at2, victim.slot);
    }
    if (victim.move.zip !== void 0 && dmg >= ZIP.knockDamage) victim.move = leaveZipline(this.ziplines, victim.move);
    if (victim.health <= 0) this.kill(victim, attacker === victim ? null : attacker, weapon, head);
  }
  /**
   * Damage numbers (a HUD option): what a human player's hit did, summed per target per tick, kept for the last few
   * snapshots (privateState `dd`). `key` tells targets apart (a combatant's slot, or -1 - a body's handle).
   */
  noteDealt(attacker, amount, flags, at2, key2) {
    if (attacker.kind !== "human" || !(amount > 0)) return;
    const list2 = attacker.dealt ??= [];
    const last = list2[list2.length - 1];
    if (last && last[0] === this.tick && last[6] === key2) {
      last[1] += amount;
      last[2] |= flags;
      return;
    }
    while (list2.length && (list2[0][0] < this.tick - DEALT_KEEP_TICKS || list2.length >= 24)) list2.shift();
    list2.push([this.tick, amount, flags, at2.x, at2.y, at2.z, key2]);
  }
  /** A round struck a body: on a target (a breakable board, crate or barrel), the shooter sees what it would do to a body. */
  noteTargetHit(owner, handle, amount, at2) {
    if (owner?.kind === "human" && this.scenario.shootableTarget(handle)) this.noteDealt(owner, amount, 8, at2, -1 - handle);
  }
  kill(victim, killer, weapon, head = false) {
    this.leaveMount(victim, false);
    victim.alive = false;
    victim.health = 0;
    if (!victim.npc) this.dropWeapon(victim);
    const teamKill = !!killer && killer !== victim && !this.hostile(killer, victim);
    this.pendingEvents.push({ e: "kill", killer: killer?.slot ?? null, victim: victim.slot, weapon, ...head && !teamKill ? { hs: 1 } : {}, ...teamKill ? { tk: 1 } : {} });
    if (killer && !killer.npc && !teamKill) killer.kills++;
    if (killer && killer !== victim && !teamKill) killer.bot?.onKill(this.tick);
    victim.streak = 0;
    if (teamKill) {
      killer.streak = 0;
      this.awards.endStreak(killer.slot);
      this.roulette?.endStreak(killer);
    } else if (killer && killer !== victim && !killer.npc && killer.alive) {
      killer.streak = (killer.streak ?? 0) + 1;
      this.streakReward(killer);
    }
    const credited = teamKill ? null : killer;
    if (!victim.npc) {
      const scored = !!credited && credited !== victim && !credited.npc;
      for (const call of this.awards.kill(scored ? credited.slot : null, victim.slot)) this.pendingEvents.push({ e: "callout", ...call });
      if (this.fireteams) this.fireteams.scores.kill(scored ? credited.slot : null, victim.slot, this.tick, TICK_RATE, this.squadIdOf);
    }
    if (victim.npc) {
      victim.npc.removeAt = this.tick + TICK_RATE * 2;
      this.encounters.onNpcKilled(victim.slot, credited?.slot ?? null);
      return;
    }
    victim.deaths++;
    if (killer && killer !== victim && !teamKill) {
      this.recentDeaths.push({ pos: { ...victim.move.pos }, tick: this.tick });
      if (this.recentDeaths.length > SPAWN_DEATHS_KEPT) this.recentDeaths.shift();
    }
    if (this.teams && victim.faction) this.director?.noteDeath(victim.faction, victim.move.pos, this.tick);
    victim.respawnTick = this.zombies ? Infinity : this.tick + this.rules.respawnDelayTicks;
    if (!killer) victim.selfKills++;
    this.scenario.playerKilled(victim.slot, killer?.slot ?? null);
    if (this.isLeader(victim)) this.leaderDown(victim, credited);
    this.mode?.onKill(victim, credited);
    if (this.roulette) {
      const scorer = killer && !killer.npc && killer !== victim && !teamKill ? killer : null;
      const r = this.roulette.onKill(victim, scorer, !!scorer);
      if (scorer && r.bonus) scorer.kills += r.bonus;
      if (scorer && r.swap && scorer.alive) this.swapLook(scorer, r.swap);
      if (victim.kind === "bot") this.roulette.botChoose(victim, this.botBodyStyle(victim));
    }
    if (!credited || credited.npc || this.rules.scoreLimit <= 0) return;
    const score = this.teams && credited.faction ? this.teamScores().get(credited.faction) ?? 0 : credited.kills;
    if (score >= this.rules.scoreLimit) this.endRound();
  }
  // ---------------------------------------------------------------- pickups
  collectPickups(c) {
    for (const p of this.pickups) {
      if (!p.enabled || this.tick < p.availableAt) continue;
      if (restrictedWeapons(this.rules) && (p.item.effect.kind === "weapon" || p.item.effect.kind === "ammo" || p.item.effect.kind === "throwable")) continue;
      if (horizontalDistance(p.pos, c.move.pos) > PICKUP_RADIUS$1 || Math.abs(p.pos.y - c.move.pos.y) > 1.5) continue;
      if (!this.applyItem(c, p.item)) continue;
      p.availableAt = this.tick + p.respawnTicks;
      this.pendingEvents.push({ e: "pickup", s: c.slot, id: p.id, item: p.item.id });
      this.scenario.pickupTaken(p.id, c.slot);
      this.reroll(p);
    }
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      if (horizontalDistance(d.pos, c.move.pos) > PICKUP_RADIUS$1 || Math.abs(d.pos.y - c.move.pos.y) > 1.5) continue;
      if (!this.takeDrop(c, d)) continue;
      this.pendingEvents.push({ e: "pickup", s: c.slot, id: `drop_${d.id}`, item: d.item.id });
      if (!dropSpent(d)) continue;
      this.drops.splice(i--, 1);
    }
  }
  /**
   * A fallen player's or bot's primary with ammo left drops at the body (rules.dropWeapons; sim/drops.ts):
   * the weapon in hand unless it's part of the starting loadout, else their best one with ammo. It lies on
   * the ground below them (none over the void) for DROP_LIE_SECONDS; past MAX_DROPS the oldest goes.
   */
  dropWeapon(c) {
    if (!dropsInPlay(this.rules)) return;
    const set = this.weaponSet;
    const defaults = /* @__PURE__ */ new Set([...set ? setSpawnWeapons(set, this.rules) : this.rules.startingWeapons, ...c.cls ? CLASS_DEFS[c.cls.id].weapons : []]);
    const w = chooseDrop(c.weapons.values(), c.weapons.get(c.current), defaults, (def) => setAllowsDrop(set, def.id));
    const item = w && dropItem(w.def);
    if (!w || !item) return;
    const at2 = c.move.pos;
    const down = this.physics.raycastHit({ x: at2.x, y: at2.y + 0.5, z: at2.z }, { x: 0, y: -1, z: 0 }, DROP_REACH);
    if (!down) return;
    if (this.drops.length >= MAX_DROPS$1) this.drops.splice(0, this.drops.length - MAX_DROPS$1 + 1);
    this.drops.push({ id: this.nextDropId++, def: w.def, item, mag: w.mag, reserve: w.reserve, alt: w.alt, pos: { x: at2.x, y: at2.y + 0.5 - down.dist, z: at2.z }, yaw: c.yaw, until: this.tick + Math.round(DROP_LIE_SECONDS * TICK_RATE) });
  }
  /**
   * Picking up a dropped weapon: someone without it gets it with exactly the ammo it held (and comes up like a
   * map pickup's); someone with it takes its ammo as far as their reserve has room. False: nothing taken.
   */
  takeDrop(c, d) {
    const code = weaponCode(d.def);
    const owned = c.weapons.get(code);
    if (owned) return takeDropAmmo(owned, d);
    c.weapons.set(code, { def: d.def, mag: Math.min(d.def.magazine, d.mag), reserve: Math.min(d.def.reserveMax, d.reserve), alt: d.alt });
    d.mag = d.reserve = d.alt = 0;
    if (d.def.slot > (weaponByCode(c.current)?.slot ?? 0)) this.switchTo(c, code);
    d.until = -1;
    return true;
  }
  /** Dropped weapons lying past their time go. */
  stepDrops() {
    if (!this.drops.length) return;
    const keep = this.drops.filter((d) => d.until > this.tick);
    if (keep.length !== this.drops.length) this.drops.splice(0, this.drops.length, ...keep);
  }
  /** Dropped weapons lying now, for the snapshot (`dw`): [id, item ID, x, y, z, yaw]. */
  dropSnapshots() {
    return this.drops.map((d) => [d.id, d.item.id, r3(d.pos.x), r3(d.pos.y), r3(d.pos.z), r3(d.yaw)]);
  }
  /** Work out what a pickup rolls from (the weapon set, its own category, or the host's mix-up), and roll it afresh when that changed. */
  repool(p) {
    const pool = setPickupPool(this.weaponSet, p.entity, !!this.rules.mixPickups);
    if (pool === p.pool) return;
    p.pool = pool;
    if (pool) this.reroll(p);
    else p.item = p.placed;
  }
  /** The next roll of a random pickup (deterministic: the match seed, its ID and its roll count). */
  reroll(p) {
    if (p.pool) p.item = rollPickup(this.seed, p.id, p.rolls++, p.pool, p.item);
  }
  /** What random pickups hold now, where it isn't what was placed: [pickup ID, item ID] (the snapshot's `pw`). */
  pickupItems() {
    return this.pickups.filter((p) => p.item !== p.placed).map((p) => [p.id, p.item.id]);
  }
  /** Returns false when the item would be wasted (full health, weapon already maxed), leaving it in place. */
  applyItem(c, item) {
    const e = item.effect;
    switch (e.kind) {
      case "health":
        if (c.health >= c.maxHealth) return false;
        c.health = Math.min(c.maxHealth, c.health + e.amount);
        return true;
      case "armor":
        if (c.armor >= MAX_ARMOR) return false;
        c.armor = Math.min(MAX_ARMOR, c.armor + e.amount);
        return true;
      case "ammo": {
        let used = false;
        for (const w of c.weapons.values()) {
          if (w.def.reserveMax === 0 || e.ammo && w.def.ammo !== e.ammo) continue;
          if (w.reserve < w.def.reserveMax) {
            w.reserve = Math.min(w.def.reserveMax, w.reserve + (e.ammo ? w.def.pickupAmmo : Math.ceil(w.def.pickupAmmo / 2)));
            used = true;
          }
        }
        if (!e.ammo || e.ammo === "explosive") {
          for (const w of c.weapons.values()) {
            const alt = w.def.alt;
            if (alt?.ammo === "own" && !alt.reload && w.alt < (alt.max ?? 0)) {
              w.alt = Math.min(alt.max ?? 0, w.alt + (e.ammo ? alt.pickup ?? 1 : 1));
              used = true;
            }
          }
        }
        return used;
      }
      case "throwable": {
        const max = THROWABLE_DEFS[e.throwable].max;
        if (c.throwable && c.throwable.kind === e.throwable && c.throwable.count >= max) return false;
        const have = c.throwable?.kind === e.throwable ? c.throwable.count : 0;
        c.throwable = { kind: e.throwable, count: Math.min(max, have + e.count) };
        return true;
      }
      case "weapon": {
        const def = getWeapon(e.weapon);
        const owned = c.weapons.get(weaponCode(def));
        if (owned) {
          const altMax = def.alt?.ammo === "own" ? def.alt.max ?? 0 : 0;
          if (owned.reserve >= def.reserveMax && owned.alt >= altMax) return false;
          owned.reserve = Math.min(def.reserveMax, owned.reserve + def.pickupAmmo);
          owned.alt = Math.min(altMax, owned.alt + (def.alt?.pickup ?? 0));
          return true;
        }
        c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: Math.min(def.reserveMax, def.pickupAmmo), alt: def.alt?.ammo === "own" ? def.alt.pickup ?? 0 : 0 });
        if (def.slot > (weaponByCode(c.current)?.slot ?? 0)) this.switchTo(c, weaponCode(def));
        return true;
      }
      case "jetpack":
        if (c.jetFuel === JET.max) return false;
        c.jetFuel = JET.max;
        return true;
      case "glider":
        if (c.glider) return false;
        c.glider = true;
        return true;
      case "uav":
        this.uavUntil.set(this.uavSide(c), this.tick + e.seconds * TICK_RATE);
        this.pendingEvents.push({ e: "msg", text: `${c.name}: UAV online`, secs: 3 });
        return true;
      case "disc":
        if (![...c.weapons.values()].some((w) => w.def.projectile?.disc)) return false;
        c.discPower = { kind: e.power, shots: DISC_POWER_SHOTS };
        return true;
      case "powerup":
        if (e.powerup === "speed") c.speedTicks = e.seconds * TICK_RATE;
        else c.damageTicks = e.seconds * TICK_RATE;
        return true;
    }
  }
  // ---------------------------------------------------------------- lifecycle
  /**
   * Spawn at the best spawn point (sim/spawns.ts pickSpawn: far from living
   * enemies, out of their sight, nobody standing on it, not used in the last
   * few seconds), with a little randomness among near-equal choices. In team
   * modes a team uses its own spawns when the map has any, and usually
   * spawns beside a teammate out of the fight (squad spawn).
   */
  spawn(c) {
    this.ensureSpawnCapacity();
    const relook = this.relookOnSpawn(c);
    const enemies = [];
    const occupants = [];
    const party = !this.teams && c.party ? this.partyNear(c) : null;
    for (const o of this.actors()) {
      if (!o.alive || o === c) continue;
      occupants.push(o.move.pos);
      if (this.hostile(c, o) && !party?.has(o)) enemies.push(o.move.pos);
    }
    const forMode = this.mode?.spawnSpots?.(c) ?? null;
    const own = forMode?.length ? forMode : this.teams && c.faction ? this.spawnPoints.filter((sp2) => sp2.team === c.faction) : [];
    const shared = this.spawnPoints.filter((sp2) => sp2.team === null);
    const candidates = own.length ? own : shared.length ? shared : this.spawnPoints;
    const rotating = !!this.teams && c.faction !== null && !own.length;
    const calm = this.tick - TICK_RATE * 4;
    const mates = rotating && c.faction ? this.combatants().filter((o) => o !== c && o.alive && o.faction === c.faction && (o.hurtAt ?? -Infinity) < calm).map((o) => o.move.pos) : void 0;
    const side = rotating && c.faction ? this.spawnSides.of(c.faction) : null;
    const home = own.length && own.some((sp2) => sp2.generated) && c.faction ? this.sideHome(c.faction) : null;
    const partyAt = party?.size ? [...party].filter((o) => (o.hurtAt ?? -Infinity) < calm).map((o) => o.move.pos) : [];
    const pick = pickSpawn({ tick: this.tick, candidates, lastUsed: this.spawnUsed, enemies, occupants, ...mates ? { mates } : {}, ...partyAt.length ? { party: partyAt } : {}, home, side, deaths: this.recentDeaths, sees: (a, b) => this.sees(a, b), rng: this.rng });
    const best = candidates[pick];
    const leader = this.fireteamSpawn(c);
    const squad = leader !== void 0 ? leader : this.teams && this.rules.squadSpawn !== false && this.rng() < 0.7 ? this.squadSpawnSpot(c) : null;
    if (!squad && best) this.spawnUsed.set(best, this.tick);
    const at2 = c.startAt;
    const sp = at2 ? { pos: at2.pos, yaw: at2.yaw } : squad ?? best ?? { pos: { x: 0, y: 0, z: 0 }, yaw: 0 };
    if (rotating && c.faction) this.spawnSides.note(c.faction, sp.pos);
    c.streak = 0;
    c.order = void 0;
    c.move = { pos: { ...sp.pos }, velY: 0, grounded: false };
    c.yaw = sp.yaw;
    c.pitch = at2?.pitch ?? 0;
    c.health = c.maxHealth;
    c.armor = 0;
    c.alive = true;
    c.burnTicks = c.poisonTicks = c.slowTicks = c.frozenTicks = 0;
    c.impact = newImpact();
    c.jetFuel = null;
    c.glider = void 0;
    c.fallPeak = void 0;
    c.padFlight = false;
    c.breath = 0;
    c.chill = c.bloom = c.windup = c.burstLeft = 0;
    c.semiLatch = false;
    c.gun = newGunState();
    c.reload = null;
    c.spawns = (c.spawns ?? 0) + 1;
    this.loadout(c, c.spawns);
    c.discPower = void 0;
    c.knockedBy = void 0;
    c.spawnedAt = this.tick;
    c.fireCooldown = 0;
    c.throwCooldown = 0;
    c.reloadTicks = 0;
    c.raiseTicks = 0;
    c.speedTicks = 0;
    c.damageTicks = 0;
    this.classes?.onSpawn(c);
    const rl = this.roulette && !c.cls && c.kind !== "npc" ? this.roulette : null;
    if (rl) {
      const sig = rl.signatureFor(c);
      if (sig) this.give(c, sig);
      rl.equip(c);
      if (c.bot) c.bot.playAs(this.bodyProfile(c));
    }
    const midRound = (c.spawns ?? 0) > 1 || this.tick - this.roundBegan > TICK_RATE * 2;
    const shield = c.kind === "npc" || !midRound ? 0 : spawnProtection(this.rules);
    c.shieldUntil = shield > 0 ? this.tick + Math.round(shield * TICK_RATE) : 0;
    c.bot?.onSpawn(sp.yaw);
    this.mode?.onSpawn?.(c);
    const roll = rl?.rollOf(c);
    this.pendingEvents.push({ e: "spawn", s: c.slot, ...relook ? { l: c.look } : {}, ...roll ? { j: roll === "jackpot" ? 1 : 2 } : {}, ...rl ? { nx: rl.upcoming(c, 3) } : {} });
    if (rl && c.kind === "bot") rl.botChoose(c, this.botBodyStyle(c));
    if (at2) return;
    if (this.mounts.some((m) => m.route && m.airdrop && m.airdrop !== "off")) this.boardPlane(c);
  }
  /**
   * The weapon set in play (sim/weaponSets.ts, docs/WEAPON_SETS_PLAN.md): the host's (rules.weaponSet), else the map's
   * default, else Standard; null where the weapons are fixed (spears or discs only, Disc Arena).
   */
  get weaponSet() {
    return weaponSetInPlay(this.rules, this.map);
  }
  /**
   * The scoped gun a sniper-role Player Bot spawns with in place of its main gun (docs/BOT_AI_PLAN.md Phase B item 5):
   * the weapon set's (Military: the marksman rifle; Sci-fi: the railgun). None in the other sets, where a sniper goes
   * for a scoped pickup first (BotBrain.pickupScore).
   */
  get sniperGun() {
    return this.weaponSet?.sniper ?? null;
  }
  /**
   * The starting weapons and grenades for life number `life` (a bot waiting for its spawn wave carries them already):
   * the weapon set's (sim/weaponSets.ts setLoadout: its spawn weapons, its random gun for the life, a sniper-role
   * bot's scoped gun, its first grenade), or one spear or a hand of arena discs where the weapons are fixed.
   */
  loadout(c, life) {
    c.weapons = /* @__PURE__ */ new Map();
    const set = this.weaponSet;
    const kit = set ? setLoadout(set, this.rules, { seed: this.seed, slot: c.slot, life, sniper: c.kind === "bot" && this.director?.roleOf(c.slot) === "sniper" }) : { weapons: [this.rules.weapons === "spears" ? "core.spear" : ARENA_DISC], throwable: null };
    for (const id of kit.weapons) {
      const def = getWeapon(id);
      c.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: Math.min(def.reserveMax, def.pickupAmmo), alt: def.alt?.ammo === "own" ? def.alt.pickup ?? 0 : 0 });
      c.current = weaponCode(def);
    }
    c.throwable = kit.throwable ? { ...kit.throwable } : null;
  }
  /** A weapon in hand at spawn (Roulette's signature): added full (or topped up when carried), and held. */
  give(c, id) {
    const def = getWeapon(id);
    const code = weaponCode(def);
    c.weapons.set(code, { def, mag: def.magazine, reserve: Math.min(def.reserveMax, def.pickupAmmo), alt: def.alt?.ammo === "own" ? def.alt.pickup ?? 0 : 0 });
    c.current = code;
  }
  /** How a bot plays its body (Roulette's picks and tokens): a pusher (large, or aggressive), a flanker (small, or a lone wolf). */
  botBodyStyle(c) {
    const p = c.bot?.profile;
    const flank = !!p && (p.tags.includes("LONE_WOLF") || p.tags.includes("SNIPER") || p.tags.includes("COWARD"));
    return { push: !!p && !flank && (p.aggression >= 60 || p.tags.includes("BERSERKER")), flank };
  }
  /**
   * A bot whose role was worked out after it spawned (a bot is added, spawns, then the roles are shared out again)
   * takes the loadout of its role at once while it still carries its untouched spawn loadout: a sniper the set's
   * scoped gun, a bot that is no longer one the set's main gun.
   */
  rearmForRole(c) {
    if (!c.alive || c.kind !== "bot" || c.cls || !this.sniperGun || c.spawnedAt !== this.tick) return;
    const set = this.weaponSet;
    if (!set) return;
    const life = c.spawns ?? 0;
    const kit = (sniper2) => setLoadout(set, this.rules, { seed: this.seed, slot: c.slot, life, sniper: sniper2 }).weapons.join();
    const now = [...c.weapons.values()].map((w) => w.def.id).join();
    const sniper = this.director?.roleOf(c.slot) === "sniper";
    if (now !== kit(sniper) && now === kit(!sniper)) this.loadout(c, life);
  }
  /** Under spawn protection now (sim/spawns.ts spawnProtection): nobody else's damage gets through. */
  shielded(c) {
    return c.alive && this.tick < (c.shieldUntil ?? 0);
  }
  /** Spawn points used lately (tick), for the recent-use penalty. */
  spawnUsed = /* @__PURE__ */ new Map();
  /** Where people died lately (the newest SPAWN_DEATHS_KEPT): a spawn point by a fresh body is a worse one. */
  recentDeaths = [];
  /** Team modes on shared spawns: where each side has been spawning lately (each keeps its end of the map). */
  spawnSides = new SpawnSides();
  /** Players the made-up spawn points were last worked out for. */
  impromptuFor = 0;
  /**
   * Big matches on maps with too few (or too bunched) spawn points for the
   * players in it: extra points made up from the navmesh (sim/spawns.ts
   * generateSpawns), added to `spawnPoints` for this match only (the map is
   * never changed). Worked out again only when the match grows past the
   * players they were made for; the same map and seed give the same points.
   */
  ensureSpawnCapacity() {
    const sized = this.teams && this.rules.teamSizes?.length ? this.rules.teamSizes.reduce((a, b) => a + b, 0) : 0;
    const players = Math.min(MAX_PLAYER_SLOTS, Math.max(sized, this.combatants().length));
    if (players <= this.impromptuFor || players < IMPROMPTU_MIN_PLAYERS) return;
    const target = Math.min(MAX_PLAYER_SLOTS, Math.ceil(players / 8) * 8);
    this.impromptuFor = target;
    const mapSpots = this.spawnPoints.filter((sp) => !sp.generated);
    const targets = this.teamTargets();
    const planned = [...targets.values()].reduce((a, b) => a + b, 0);
    const sides = this.teams ? this.teams.map((t) => ({ id: t.id, players: Math.ceil((targets.get(t.id) ?? 1) * (sized ? 1 : target / Math.max(1, planned))) })) : null;
    const short = spawnShortfall(mapSpots, sides, target);
    if (!short.size) return;
    const avoid = this.map.entities.filter((e) => e.kind === "trap" || e.kind === "zone" || e.kind === "pad" || e.kind === "portal").map((e) => ({ x: e.position[0], y: e.position[1], z: e.position[2] }));
    const valid = (p) => {
      if (p.y < this.killY + 3) return false;
      if (avoid.some((a) => horizontalDistance(a, p) < 4.5 && Math.abs(a.y - p.y) < 4)) return false;
      if (this.liquids.length && (liquidAt(this.liquids, { x: p.x, y: p.y + 0.3, z: p.z }) || liquidAt(this.liquids, { x: p.x, y: p.y - 0.6, z: p.z }))) return false;
      if (!this.physics.headroom({ x: p.x, y: p.y + 0.05, z: p.z }, PLAYER.height)) return false;
      if (this.physics.raycastWorld({ x: p.x, y: p.y + 0.5, z: p.z }, { x: 0, y: -1, z: 0 }, 1.5) === null) return false;
      let around = 0;
      for (const [dx, dz] of [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]]) {
        const q = this.nav.closestPoint({ x: p.x + dx, y: p.y + 0.5, z: p.z + dz }, { x: 0.6, y: 1.2, z: 0.6 });
        if (q && Math.abs(q.y - p.y) < 1) around++;
      }
      return around >= 3;
    };
    const made = [];
    const allCentre = centroid(mapSpots.map((sp) => sp.pos)) ?? { x: 0, y: 0, z: 0 };
    let k = 0;
    for (const [side, count] of short) {
      const home = side ? this.sideHome(side) : null;
      const away = side ? centroid(mapSpots.filter((sp) => sp.team !== null && sp.team !== side).map((sp) => sp.pos)) : null;
      made.push(
        ...generateSpawns({
          places: this.nav.places(),
          existing: [...mapSpots, ...made],
          side,
          count,
          seed: this.seed * 2654435761 + 977 * ++k >>> 0,
          home,
          away,
          faceTo: away ?? allCentre,
          valid,
          reachable: (a, b) => this.nav.findPath(a, b) !== null
        })
      );
    }
    this.spawnPoints.length = 0;
    this.spawnPoints.push(...mapSpots, ...made);
  }
  /** The middle of a side's own spawn points (the map's), or null when it has none. */
  sideHome(side) {
    return centroid(this.spawnPoints.filter((sp) => sp.team === side && !sp.generated).map((sp) => sp.pos));
  }
  /**
   * Big matches: a bot joining (or starting a round) waits for its spawn wave
   * instead of spawning on the spot (Match.spawnDue): its loadout now, its place
   * when its turn comes, a few bots a tick.
   */
  queueSpawn(c) {
    c.alive = false;
    c.respawnTick = this.tick;
    this.loadout(c, (c.spawns ?? 0) + 1);
    this.ensureSpawnCapacity();
  }
  /** Spawn everyone due: people at once, bots a few a tick in big matches (spawnsPerTick), longest-waiting first. */
  spawnDue() {
    const all = this.combatants();
    const budget = spawnsPerTick(all.length);
    let due = null;
    for (const c of all) {
      if (c.alive || this.tick < c.respawnTick) continue;
      if (c.kind === "human" || budget === Infinity) this.spawn(c);
      else (due ??= []).push(c);
    }
    if (!due) return;
    due.sort((a, b) => a.respawnTick - b.respawnTick || a.slot - b.slot);
    for (let i = 0; i < due.length && i < budget; i++) this.spawn(due[i]);
  }
  /** In a big match a bot waits for its spawn wave; otherwise it spawns now. */
  spawnOrQueue(c) {
    if (c.kind === "bot" && this.combatants().length >= WAVE_MIN_PLAYERS) this.queueSpawn(c);
    else this.spawn(c);
  }
  /**
   * Ends the round; the winner is the top scorer unless scenario logic names
   * one (`null` = nobody). Co-op missions end with an outcome instead.
   */
  /** The map a "Next map" logic action sent everyone on to (a suite map ID; hosts check it), once the round has ended. */
  nextMap = null;
  endRound(forced, outcome, next, winTeam) {
    if (this.phase !== "playing") return;
    if (next) this.nextMap = next;
    const ranked = this.combatants().sort((a, b) => b.kills - a.kills);
    const named = forced === void 0 || forced === null ? void 0 : this.actor(forced);
    const top = forced === void 0 ? ranked[0] : named && !named.npc ? named : void 0;
    const tied = forced === void 0 && top && ranked[1] && ranked[1].kills === top.kills;
    this.phase = "intermission";
    this.phaseEndTick = this.tick + this.rules.intermissionTicks;
    const players = this.combatants().filter((c) => c.kind !== "npc");
    if (this.fireteams) this.tallySquads(false);
    const here = new Set(players.map((c) => c.slot));
    const aw = [...this.awards.awards(players.map((c) => c.slot)), ...this.fireteams ? this.fireteams.scores.awards(this.fireteams.squads, here) : [], ...this.roulette ? this.roulette.awards(players) : []];
    if (aw.length) this.pendingEvents.push({ e: "awards", aw });
    if (this.roulette) this.phys.gravity = this.roulette.calmGravity();
    this.projectiles = [];
    this.bullets = [];
    this.zones = [];
    if (this.teams && !outcome) {
      const scores = [...this.teamScores()].sort((x, y) => y[1] - x[1]);
      const team = winTeam !== void 0 ? winTeam : named && !named.npc ? named.faction : scores.length > 1 && scores[0][1] === scores[1][1] ? null : scores[0]?.[0] ?? null;
      this.pendingEvents.push({ e: "round_end", winner: null, team });
      return;
    }
    this.pendingEvents.push(outcome ? { e: "round_end", winner: null, outcome, ...next ? { next } : {} } : { e: "round_end", winner: top && !tied ? top.slot : null });
  }
  /** Scenario chains: start this player with what they carried from the previous map (score, weapons). */
  applyCarry(c, carry) {
    if (carry.kills !== void 0) c.kills = carry.kills;
    if (carry.deaths !== void 0) c.deaths = carry.deaths;
    for (const [id, mag, reserve] of carry.weapons ?? []) {
      let def;
      try {
        def = getWeapon(id);
      } catch {
        continue;
      }
      c.weapons.set(weaponCode(def), { def, mag: Math.max(0, Math.min(def.magazine, mag)), reserve: Math.max(0, Math.min(def.reserveMax, reserve)), alt: def.alt?.max ?? 0 });
    }
  }
  /**
   * Host handoff: everyone in the match as they stand now (people, away players and Player Bots), for a
   * successor host to restore (MatchCheckpoint). `keyOf`: a person's hashed key (handoffKey), when known.
   */
  checkpointPlayers(keyOf, successor) {
    const r = (v) => Math.round(v * 100) / 100;
    return this.combatants().map((c) => {
      const person = c.kind === "human" || !!c.away;
      const key2 = person ? keyOf(c) : null;
      const held = c.weapons.get(c.current);
      return {
        name: c.away ? c.away.name : c.name,
        kind: person ? "human" : "bot",
        ...key2 ? { key: key2 } : {},
        ...c.slot === successor ? { succ: 1 } : {},
        ...c.account ? { acct: 1 } : {},
        ...person && c.party ? { py: c.party } : {},
        look: c.look,
        team: c.faction,
        k: c.kills,
        d: c.deaths,
        ...c.selfKills ? { x: c.selfKills } : {},
        ...c.objective ? { o: c.objective } : {},
        alive: c.alive,
        ...c.alive ? { p: [r(c.move.pos.x), r(c.move.pos.y), r(c.move.pos.z)], yaw: r(c.yaw), hp: Math.round(c.health), ar: Math.round(c.armor) } : {},
        w: [...c.weapons.values()].map((w) => [w.def.id, w.mag, w.reserve]),
        ...held ? { cur: held.def.id } : {},
        ...((t) => t && tallied(t) ? { sp: tallyRow(t) } : {})(this.fireteams?.scores.player(c.slot))
      };
    });
  }
  /**
   * Host handoff (Fireteams follow-ups): the squads as they stand, their members and leader by their index in
   * `checkpointPlayers`' list (the same order: `combatants()`), with each squad's points. Undefined: no squads.
   */
  checkpointSquads() {
    const ft = this.fireteams;
    if (!ft?.squads.length) return void 0;
    const index = new Map(this.combatants().map((c, i) => [c.slot, i]));
    const out = [];
    for (const q of ft.squads) {
      const m = q.members.map((slot) => index.get(slot)).filter((i) => i !== void 0);
      if (!m.length) continue;
      const l = q.leader !== null ? index.get(q.leader) ?? -1 : -1;
      out.push({ m, l, t: tallyRow(ft.scores.squad(q.id)), ...q.human ? { h: 1 } : {} });
    }
    return out.length ? out : void 0;
  }
  /**
   * Host handoff (Fireteams follow-ups): the squads and points a checkpoint carried, put back once its players are in
   * (`placed`: each checkpoint player's index → their new place). The squads are made again as they were (in their
   * order, members and leader), each with its points, and every player gets their own points back, so nothing starts
   * from zero; the next `sync` brings them in line with whoever is here (a person still away: a bot leads their squad
   * until they're back, as for anyone away).
   */
  restoreSquads(cp, placed) {
    const size = this.rules.fireteams;
    if (!size || !this.teams || !fireteamMode(this.rules.mode)) return;
    if (!this.fireteams || this.fireteams.size !== size) {
      this.fireteams = new Fireteams(size);
      this.rolesFor = -1;
    }
    const ft = this.fireteams;
    this.squadsDirty = true;
    cp.players.forEach((p, i) => {
      const c = placed.get(i);
      if (c && p.sp) ft.scores.restorePlayer(c.slot, tallyOf(p.sp));
    });
    const list2 = (cp.squads ?? []).map((q) => {
      const lead = q.l >= 0 ? placed.get(q.l) : void 0;
      const first = lead ?? q.m.map((i) => placed.get(i)).find((c) => !!c?.faction);
      const team = first?.faction ?? null;
      const members = q.m.map((i) => placed.get(i)).filter((c) => !!c && c.faction === team && team !== null).map((c) => c.slot);
      return { team: team ?? "", leader: lead && lead.faction === team ? lead.slot : null, members: team === null ? [] : members, human: q.h === 1 && lead?.kind === "human" };
    });
    ft.adopt(list2, this.tick).forEach((s, k) => {
      if (s) ft.scores.restoreSquad(s.id, tallyOf(cp.squads[k].t));
    });
  }
  /**
   * Host handoff: a player just added to this match (addHuman / addBot) takes the place a checkpoint
   * recorded: team, score, weapons, and (alive) where they stood, facing the same way, with the same health.
   * The dead wait a moment and respawn as usual.
   */
  restoreCombatant(c, p) {
    const team = p.team === null ? null : this.teams?.find((t) => t.id === p.team)?.id ?? c.faction;
    if (team !== c.faction) {
      c.faction = team;
      this.squadsDirty = true;
    }
    c.kills = p.k;
    c.deaths = p.d;
    c.selfKills = p.x ?? 0;
    c.objective = p.o ?? 0;
    c.account = p.acct === 1;
    if (p.py && p.kind === "human") c.party = p.py;
    if (p.alive && p.p) {
      if (!c.alive) this.spawn(c);
      this.leaveMount(c, false);
      c.move = { pos: { x: p.p[0], y: p.p[1], z: p.p[2] }, velY: 0, grounded: false };
      c.yaw = p.yaw ?? c.yaw;
      c.pitch = 0;
      c.health = Math.max(1, Math.min(c.maxHealth, p.hp ?? c.maxHealth));
      c.armor = Math.max(0, Math.min(MAX_ARMOR, p.ar ?? 0));
    } else {
      this.leaveMount(c, false);
      c.alive = false;
      c.respawnTick = this.zombies ? Infinity : this.tick + Math.max(TICK_RATE, this.rules.respawnDelayTicks);
    }
    const weapons = /* @__PURE__ */ new Map();
    for (const [id, mag, reserve] of p.w ?? []) {
      let def;
      try {
        def = getWeapon(id);
      } catch {
        continue;
      }
      weapons.set(weaponCode(def), { def, mag: Math.max(0, Math.min(def.magazine, mag)), reserve: Math.max(0, Math.min(def.reserveMax, reserve)), alt: def.alt?.max ?? 0 });
    }
    if (weapons.size) {
      c.weapons = weapons;
      const cur = [...weapons.values()].find((w) => w.def.id === p.cur) ?? [...weapons.values()][0];
      c.current = weaponCode(cur.def);
      c.raiseTicks = 0;
      c.reload = null;
    }
  }
  /**
   * Host handoff: carry on a match restored from a checkpoint in `phase`, with `timeLeft` seconds of it to
   * go: no start gate, countdown or round_start. Objective modes get their team scores back. A checkpoint
   * from before the round began just starts as a new match does.
   */
  resume(phase, timeLeft, teams) {
    if (phase === "playing") {
      this.phase = "playing";
      for (const c of this.combatants()) c.spawnedAt = this.tick;
      this.mode?.reset();
      this.zombies?.reset();
      this.phaseEndTick = this.rules.timeLimitSeconds > 0 ? this.tick + Math.max(1, timeLeft) * TICK_RATE : Infinity;
    } else if (phase === "intermission") {
      this.phase = "intermission";
      this.phaseEndTick = this.tick + Math.max(1, timeLeft) * TICK_RATE;
    }
    if (teams?.length) this.mode?.restoreScores?.(new Map(teams));
  }
  /** What `c` would carry into the next map of a chain. */
  carryOf(c) {
    return { kills: c.kills, deaths: c.deaths, weapons: [...c.weapons.values()].map((w) => [w.def.id, w.mag, w.reserve]) };
  }
  /** People (players and spectators) whose client has loaded everything (start gate). */
  readySlots = /* @__PURE__ */ new Set();
  /** A client finished loading. Late joiners just play; the first ones start the countdown. */
  ready(slot) {
    this.readySlots.add(slot);
  }
  startCountdown() {
    this.phase = "countdown";
    this.phaseEndTick = this.tick + COUNTDOWN_SECONDS * TICK_RATE;
  }
  /** The countdown is over: the round (and its clock, objectives and waves) starts now. */
  beginPlay() {
    for (const m of this.mounts) if (m.route) m.routeT0 = this.tick;
    this.phase = "playing";
    for (const c of this.combatants()) {
      c.spawnedAt = this.tick;
      c.startAt = void 0;
    }
    this.phaseEndTick = this.roundEndTick();
    this.mode?.reset();
    this.zombies?.reset();
    this.roulette?.calm();
    this.pendingEvents.push({ e: "round_start" });
  }
  /**
   * Called as each new round starts (the scoreboard's end, or a restart), before it resets: HostControl puts the
   * rules the host saved for the next match in play.
   */
  beforeRound;
  /** The tick the round in play began (spawn protection leaves out the lives the round opens with). */
  roundBegan = 0;
  startRound() {
    this.beforeRound?.();
    this.phase = "playing";
    this.roundBegan = this.tick;
    for (const m of this.mounts) if (m.route) m.routeT0 = this.tick;
    this.phaseEndTick = this.roundEndTick();
    for (const p of this.pickups) p.availableAt = 0;
    this.drops.length = 0;
    for (const id of [...this.npcs.keys()]) this.removeNpc(id);
    this.encounters.reset();
    this.scenario.reset();
    for (const cv of [...this.covers]) this.removeCover(cv);
    this.uavUntil.clear();
    this.jamUntil.clear();
    this.leaderBounty.clear();
    for (const c of this.combatants()) {
      c.kills = 0;
      c.selfKills = 0;
      c.objective = 0;
      c.deaths = 0;
      c.alive = false;
      this.leaveMount(c, false);
    }
    this.airdropped.clear();
    this.mode?.reset();
    this.zombies?.reset();
    this.classes?.reset();
    this.roulette?.reset();
    this.awards.reset();
    this.fireteams?.scores.reset();
    for (const c of this.combatants()) this.spawnOrQueue(c);
    if (this.opts.startGate) {
      this.startCountdown();
      return;
    }
    this.pendingEvents.push({ e: "round_start" });
  }
  timeLeftSeconds() {
    const own = this.phase === "playing" ? this.mode?.clock?.() ?? null : null;
    if (own !== null) return own;
    return Number.isFinite(this.phaseEndTick) ? Math.max(0, Math.ceil((this.phaseEndTick - this.tick) / TICK_RATE)) : 0;
  }
  // ---------------------------------------------------------------- snapshots
  playerSnapshots() {
    return this.combatants().map((c) => {
      const s = {
        s: c.slot,
        p: [c.move.pos.x, c.move.pos.y, c.move.pos.z],
        vy: c.move.velY,
        g: c.move.grounded ? 1 : 0,
        yaw: r3(c.yaw),
        pitch: r3(c.pitch),
        hp: Math.ceil(c.health),
        ar: Math.ceil(c.armor),
        alive: c.alive ? 1 : 0,
        w: c.current,
        pu: (c.speedTicks > 0 ? POWERUP_SPEED_BIT : 0) | (c.damageTicks > 0 ? POWERUP_DAMAGE_BIT : 0)
      };
      if (c.move.vx || c.move.vz) {
        s.vx = c.move.vx ?? 0;
        s.vz = c.move.vz ?? 0;
      }
      const fx = statusBits(c) | (this.classes?.fx(c) ?? 0) | (c.alive && this.shielded(c) ? FX_PROTECTED : 0) | (this.roulette && c.alive && this.roulette.rollOf(c) === "jackpot" ? FX_JACKPOT : 0);
      if (fx) s.fx = fx;
      if (c.cls) s.cl = classIndex(c.cls.id);
      if (c.bot) s.st = c.bot.state;
      if (c.move.stance) s.sn = c.move.stance;
      if (c.emoteUntil && this.tick < c.emoteUntil) s.em = 1;
      if (c.move.sprint) s.sr = 1;
      if (c.move.chute) s.ch = c.move.chute;
      if (c.move.drop) s.dr = 1;
      if (c.move.zip !== void 0) s.zl = [c.move.zip, c.move.zs ?? 0, c.move.zv ?? 0];
      return s;
    });
  }
  uavSide(c) {
    return this.teams && c.faction ? `team:${c.faction}` : `slot:${c.slot}`;
  }
  /** Under an enemy Counter-UAV: the minimap shows static. */
  jammed(c) {
    const side = this.uavSide(c);
    let until = 0;
    for (const [jammer, end] of this.jamUntil) if (jammer !== side && end > until) until = end;
    return until > this.tick ? until : 0;
  }
  /** Mark what you're aiming at for your side: an enemy in your sights, or the spot. */
  ping(c) {
    const aim = this.aimAt(c);
    if (!aim) return;
    const { at: at2, target } = aim;
    c.lastPing = { pos: { ...at2 }, target: target?.slot ?? null, tick: this.tick };
    this.pendingEvents.push({ e: "ping", s: c.slot, p: tuple(at2), ...target ? { t: target.slot } : {}, ...this.teams && c.faction ? { team: c.faction } : {} });
  }
  /** What `c` aims at: an enemy in their sights (its middle), else the world along their view within 150 m; null: nothing. */
  aimAt(c) {
    const eye = { x: c.move.pos.x, y: c.move.pos.y + eyeHeightOf(c.move, c.size), z: c.move.pos.z };
    const dir = viewDirection(c.yaw, c.pitch);
    const wall = this.physics.raycastWorld(eye, dir, 150) ?? 150;
    let target = null;
    let best = wall;
    for (const o of this.actors()) {
      if (!o.alive || o === c || !this.hostile(c, o)) continue;
      const d = rayCapsule(eye, dir, o.move.pos, PLAYER.radius * o.size + 0.35, bodyHeightOf(o.move, o.size));
      if (d !== null && d < best) {
        best = d;
        target = o;
      }
    }
    if (best >= 150 && !target) return null;
    const at2 = target ? { x: target.move.pos.x, y: target.move.pos.y + 1, z: target.move.pos.z } : add(eye, scale(dir, best));
    return { at: at2, target };
  }
  /** "Follow me!" / "Hold here!": your side's bots nearby do it for a while. */
  orderBots(c, kind) {
    const lead = this.isLeader(c);
    for (const b of this.combatants()) {
      if (b.kind !== "bot" || !b.alive || b === c || this.hostile(c, b)) continue;
      if (!this.teams && this.rules.mode !== "core.coop" && this.rules.mode !== "core.zombies") continue;
      if (!lead && horizontalDistance(b.move.pos, c.move.pos) > 30) continue;
      b.order = { kind, leader: c.slot, pos: { ...c.move.pos }, until: this.tick + TICK_RATE * 40 };
    }
  }
  /** Kill-streak rewards, earned at these streaks. */
  streakReward(c) {
    if (this.rules.killstreaks === false || c.npc) return;
    const r = STREAK_REWARDS.findIndex((x) => x.kills === c.streak);
    if (r < 0) return;
    const reward = STREAK_REWARDS[r];
    this.pendingEvents.push({ e: "streak", s: c.slot, r });
    const side = this.uavSide(c);
    switch (reward.id) {
      case "uav":
        this.uavUntil.set(side, Math.max(this.uavUntil.get(side) ?? 0, this.tick + TICK_RATE * 20));
        break;
      case "supply":
        for (const o of this.actors()) {
          if (!o.alive || o.npc || o !== c && (this.hostile(c, o) || horizontalDistance(o.move.pos, c.move.pos) > 15)) continue;
          const healed = Math.min(50, o.maxHealth - o.health);
          o.health += healed;
          for (const w of o.weapons.values()) w.reserve = Math.max(w.reserve, w.def.reserveMax);
          if (healed > 0) this.pendingEvents.push({ e: "heal", s: c.slot, t: o.slot, n: Math.round(healed) });
        }
        break;
      case "counter_uav":
        this.jamUntil.set(side, this.tick + TICK_RATE * 20);
        break;
      case "airstrike":
        c.throwable = { kind: "airstrike", count: 1 };
        break;
    }
  }
  /**
   * Team modes: a spot beside a teammate nobody is shooting at (no enemy
   * within 20 m, not hurt in the last few seconds), or null.
   */
  squadSpawnSpot(c) {
    if (!this.teams || !c.faction || this.rules.squadSpawn === false || c.kind === "npc") return null;
    const enemies = this.actors().filter((o) => o.alive && this.hostile(c, o));
    const mates = this.combatants().filter((o) => o !== c && o.alive && !o.mount && o.faction === c.faction && o.move.grounded && this.tick - (o.hurtAt ?? -Infinity) > TICK_RATE * 4 && !enemies.some((e) => distance(e.move.pos, o.move.pos) < 20) && this.mode?.spawnBeside?.(c, o) !== false);
    if (!mates.length) return null;
    for (let i = mates.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [mates[i], mates[j]] = [mates[j], mates[i]];
    }
    let mate = null;
    let mateScore = -Infinity;
    for (const o of mates.slice(0, 4)) {
      const near2 = enemies.map((e) => ({ e, d: distance(e.move.pos, o.move.pos) })).filter((x) => x.d < 50).sort((a, b) => a.d - b.d);
      const head = { x: o.move.pos.x, y: o.move.pos.y + 1.6, z: o.move.pos.z };
      if (near2.slice(0, 3).some((x) => this.sees({ x: x.e.move.pos.x, y: x.e.move.pos.y + 1.6, z: x.e.move.pos.z }, head))) continue;
      const score = -(near2.length ? near2[0].d : 50);
      if (score > mateScore) [mate, mateScore] = [o, score];
    }
    if (!mate) return null;
    return this.besideMate(mate);
  }
  /** A clear spot on walkable ground a step from `mate` (behind or beside them), facing their way; null: none. */
  besideMate(mate) {
    const walkable2 = (p) => {
      const q = this.nav.closestPoint({ x: p.x, y: p.y + 0.5, z: p.z }, { x: 0.6, y: 1.2, z: 0.6 });
      return !!q && Math.abs(q.y - p.y) < 1;
    };
    if (!walkable2(mate.move.pos)) return null;
    for (const a of [Math.PI, Math.PI / 2, -Math.PI / 2, 0, 3 * Math.PI / 4, -3 * Math.PI / 4]) {
      const yaw = mate.yaw + a;
      const pos = { x: mate.move.pos.x + Math.sin(yaw) * 1.4, y: mate.move.pos.y, z: mate.move.pos.z + Math.cos(yaw) * 1.4 };
      if (!this.physics.headroom({ x: pos.x, y: pos.y + 0.05, z: pos.z }, PLAYER.height)) continue;
      const floor = this.physics.raycastWorld({ x: pos.x, y: pos.y + 0.5, z: pos.z }, { x: 0, y: -1, z: 0 }, 1.5);
      if (floor === null) continue;
      if (!this.physics.lineOfSight({ x: mate.move.pos.x, y: mate.move.pos.y + 1, z: mate.move.pos.z }, { x: pos.x, y: pos.y + 1, z: pos.z })) continue;
      const at2 = { x: pos.x, y: pos.y + 0.5 - floor, z: pos.z };
      if (!walkable2(at2)) continue;
      return { pos: at2, yaw: mate.yaw };
    }
    return null;
  }
  /** The owning player's inventory and timers. */
  privateState(slot) {
    const c = this.slots[slot];
    if (!c) return void 0;
    return {
      inv: [...c.weapons.entries()].sort((a, b) => a[0] - b[0]).map(([code, w]) => w.def.heat ? [code, w.mag, w.reserve, w.alt, Math.round((w.heat ?? 0) * 100) + (w.overheated ? 100 : 0)] : [code, w.mag, w.reserve, w.alt]),
      ...statusSpeed(c) !== 1 ? { ms: Math.round(statusSpeed(c) * 1e3) } : {},
      ...c.speedMul !== 1 || c.stats.jump !== 1 || c.stats.stamina !== 1 ? { bs: [Math.round(c.speedMul * 1e3), Math.round(c.stats.jump * 1e3), Math.round(c.stats.stamina * 1e3)] } : {},
      ...c.mount ? { mo: this.seatState(c) } : {},
      ...c.throwable ? { gr: [THROWABLES.indexOf(c.throwable.kind), c.throwable.count] } : {},
      rl: c.reloadTicks,
      rs: c.raiseTicks,
      ...c.dealt?.some((d) => d[0] > this.tick - DEALT_KEEP_TICKS) ? { dd: c.dealt.filter((d) => d[0] > this.tick - DEALT_KEEP_TICKS).map((d) => [d[0], Math.round(d[1]), d[2], round2(d[3]), round2(d[4]), round2(d[5])]) } : {},
      ...c.reload && c.reloadTicks > 0 ? { rd: [RELOAD_KINDS.indexOf(c.reload.kind), c.reload.t, c.reload.total, c.reload.stage] } : {},
      ...[...c.weapons.values()].some((w) => w.unchambered) ? { uc: [...c.weapons.entries()].filter(([, w]) => w.unchambered).map(([code]) => code) } : {},
      sp: c.speedTicks,
      dm: c.damageTicks,
      ...c.jetFuel !== null ? { jp: c.jetFuel } : {},
      ...c.glider ? { gl: 1 } : {},
      ...this.jammed(c) ? { jm: Math.ceil((this.jammed(c) - this.tick) / TICK_RATE) } : {},
      ...c.streak ? { ks: c.streak } : {},
      ...(this.uavUntil.get(this.uavSide(c)) ?? 0) > this.tick ? { uv: Math.ceil((this.uavUntil.get(this.uavSide(c)) - this.tick) / TICK_RATE) } : {},
      ...c.move.stamina !== void 0 || c.move.rest || c.move.winded ? { sta: [Math.round((c.move.stamina ?? 1) * 1e3), c.move.rest ?? 0, c.move.winded ? 1 : 0] } : {},
      ...this.classes?.privateState(c) ?? {},
      ...c.discPower ? { dp: [DISC_POWERS.indexOf(c.discPower.kind), c.discPower.shots] } : {},
      ...this.roulette ? { rp: this.roulette.privateState(c) } : {}
    };
  }
  /** Compact NPC state for snapshots (see NpcSnapshot). */
  npcSnapshots() {
    const factions = this.factions;
    const r2 = (v) => Math.round(v * 100) / 100;
    return [...this.npcs.values()].map((c) => {
      const role = NPC_ROLES.indexOf(c.npc.role);
      const snap = [c.slot, r2(c.move.pos.x), r2(c.move.pos.y), r2(c.move.pos.z), r3(c.yaw), r3(c.pitch), Math.ceil(Math.max(0, c.health) / c.maxHealth * 100), role, Math.max(0, factions.findIndex((f) => f.id === c.faction)), c.alive ? 1 : 0, c.current];
      if (c.size !== 1) snap.push(r2(c.size));
      return snap;
    });
  }
  scores() {
    const ft = this.fireteams;
    return this.combatants().map((c) => {
      const pts = ft ? ft.scores.points(c.slot) : 0;
      return { s: c.slot, k: c.kills, d: c.deaths, ...c.selfKills ? { x: c.selfKills } : {}, ...c.objective ? { o: c.objective } : {}, ...pts ? { p: pts } : {} };
    });
  }
  /** Credit objective plays (the scoreboard's Caps / Bomb / Rescues column) to the player who made them. */
  noteObjectives(events) {
    for (const ev of events) {
      const play = ev.e === "flag" && ev.a === "capture" || (ev.e === "bomb" || ev.e === "bt") && (ev.a === "plant" || ev.a === "defuse") || ev.e === "hostage" && ev.a === "rescue";
      if (!play || ev.s === null || ev.s === void 0) continue;
      const c = this.slots[ev.s];
      if (c) c.objective++;
    }
  }
  /** Snapshot message body shared by every recipient; hosts add the per-recipient `ack` and `me`. */
  snapshot(events) {
    return {
      tick: this.tick,
      phase: this.phase,
      timeLeft: this.timeLeftSeconds(),
      players: this.playerSnapshots(),
      score: this.scores(),
      ev: events,
      pr: this.projectiles.map((p) => [p.id, r3(p.pos.x), r3(p.pos.y), r3(p.pos.z), PROJECTILE_VISUALS.indexOf(p.spec.visual)]),
      pk: this.pickups.filter((p) => !p.enabled || this.tick < p.availableAt).map((p) => p.id),
      ...this.pickups.some((p) => p.item !== p.placed) ? { pw: this.pickupItems() } : {},
      ...this.drops.length ? { dw: this.dropSnapshots() } : {},
      ...this.mounts.length ? { mt: this.mountSnapshots() } : {},
      ...this.boxes.some((b) => b.body) ? { ab: this.boxSnapshots() } : {},
      ...this.mounts.some((m) => m.susp && m.alive) ? { ms: this.suspensionSnapshots() } : {},
      ...this.covers.length ? { cv: this.covers.map((c) => [c.id, r3(c.pos.x), r3(c.pos.y), r3(c.pos.z), r3(c.yaw), Math.ceil(Math.max(0, c.health) / c.max * 100)]) } : {},
      ...this.zones.length ? { zn: this.zones.map((z) => [ZONE_KINDS.indexOf(z.kind), r3(z.pos.x), r3(z.pos.y), r3(z.pos.z), r3(z.kind === "smoke" ? this.smokeNow(z) : z.radius), Math.round((z.endTick - this.tick) / 6) / 10]) } : {},
      sc: this.scenario.delta(),
      np: this.npcSnapshots(),
      ...this.rules.leaders && this.teams ? { ld: this.teams.map((t) => this.leaderOf.get(t.id) ?? -1) } : {},
      ...this.fireteams && this.teams ? { fs: this.fireteams.squads.map((q) => squadSnapshot(q, this.teams.findIndex((t) => t.id === q.team), this.fireteams.scores.squad(q.id).points, q.human && q.ordered ? null : this.mode?.squadRole?.(q.id) ?? null)) } : {},
      ...this.roulette?.snapshot() ? { rl: this.roulette.snapshot() } : {},
      ...this.mode ? { md: this.mode.snapshot() } : this.zombies ? { md: { ts: [this.zombies.wave], zb: this.zombies.snapshot() } } : {}
    };
  }
  roster() {
    const players = this.combatants().map((c) => ({ slot: c.slot, name: c.name, bot: c.kind === "bot", look: c.look, team: this.teams ? c.faction : null, ...c.account && c.kind === "human" ? { acct: 1 } : {}, ...c.party && c.kind === "human" ? { py: c.party } : {} }));
    if (!this.spectators.size) return players;
    return [...players, ...[...this.spectators].map(([slot, s]) => ({ slot, name: s.name, bot: false, look: s.look, team: null, sp: 1, ...s.account ? { acct: 1 } : {}, ...s.party ? { py: s.party } : {} }))];
  }
  destroy() {
    this.nav.destroy();
    this.physics.free();
  }
}
function toView(c, concealed = false, sheltered = false) {
  return { slot: c.slot, pos: c.move.pos, yaw: c.yaw, pitch: c.pitch, health: c.health, armor: c.armor, alive: c.alive, stance: stanceOf(c.move), human: c.kind === "human", mounted: !!c.mount, sheltered, grounded: c.move.grounded, object: false, concealed, riding: c.move.zip !== void 0, climbing: !!c.move.climb, chute: !!c.move.chute, size: c.size, box: hitboxOf(c), hitScale: c.hitScale, winded: !!c.move.winded, ...c.shieldUntil ? { shielded: true, shieldUntil: c.shieldUntil } : {} };
}
function fillView(v, c, concealed, sheltered) {
  v.slot = c.slot;
  v.pos = c.move.pos;
  v.yaw = c.yaw;
  v.pitch = c.pitch;
  v.health = c.health;
  v.armor = c.armor;
  v.alive = c.alive;
  v.stance = stanceOf(c.move);
  v.human = c.kind === "human";
  v.mounted = !!c.mount;
  v.sheltered = sheltered;
  v.grounded = c.move.grounded;
  v.concealed = concealed;
  v.riding = c.move.zip !== void 0;
  v.climbing = !!c.move.climb;
  v.chute = !!c.move.chute;
  v.size = c.size;
  v.box = hitboxOf(c);
  v.hitScale = c.hitScale;
  v.shielded = !!c.shieldUntil && c.alive;
  v.shieldUntil = c.shieldUntil ?? 0;
}
function hitboxOf(c) {
  if (c.kind !== "npc" && c.hitLook !== c.look) {
    const h = lookHitbox(c.look);
    c.hitbox = h.box;
    c.hitScale = h.scale;
    c.hitLook = c.look;
  }
  return c.hitbox;
}
function segmentDistance(p, a, b, lift = 0) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const py = p.y + lift;
  const len2 = abx * abx + aby * aby + abz * abz;
  const t = len2 > 1e-9 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (py - a.y) * aby + (p.z - a.z) * abz) / len2)) : 0;
  const dx = p.x - (a.x + abx * t);
  const dy = py - (a.y + aby * t);
  const dz = p.z - (a.z + abz * t);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
const AWAY = {
  /** Idle this long (no moving, turning or pressing anything) and a bot plays for you (0: never). */
  afkSeconds: 90,
  /** The warning comes this long before. */
  warnSeconds: 15,
  /** A dropped player's place is kept this long for them to reconnect. */
  holdSeconds: 60,
  /** Away for being idle this long (still connected): removed from the match, freeing the place (0: never). */
  kickMinutes: 10
};
const SQUAD_STRAY = 14;
const isPerson = (c) => c.kind === "human" || !!c.away;
const setRank = (c) => c.botSet ? 1e6 - c.botSet.index : 0;
class BotFiller {
  constructor(match, difficulty = BOT_DIFFICULTIES.normal, opts = {}) {
    this.match = match;
    this.difficulty = difficulty;
    this.opts = opts;
    this.chosen = botSetInUse(opts.botSet);
    this.set = this.chosen ? opts.botSet : mapBotSet(match.map);
  }
  match;
  difficulty;
  opts;
  counter = 0;
  /** The host's bot set (sim/botSet.ts): its bots come first, in order; null: every bot random. */
  set = null;
  /** The set changed mid-match: bots are swapped in and out one at a time (stage), not all at once. */
  staging = false;
  /** The host chose the set (a map change carries it on); otherwise it is the map's own (MapDocument.bots), or none. */
  chosen = false;
  /** The set the host chose (null: theirs is none, so the next map's own bots play), for a map change to carry on. */
  get hostSet() {
    return this.chosen ? this.set : null;
  }
  /** The host's bot set now (null: random bots). */
  get botSet() {
    return this.set;
  }
  /** Whether a changed set is still being swapped in (stage). */
  get settling() {
    return this.staging;
  }
  /** The next random bot's base profile (it plays its look's own when it has one). */
  nextProfile() {
    return CORE_BOT_PROFILES[this.counter++ % CORE_BOT_PROFILES.length];
  }
  /**
   * A random bot's name for what it wears (content/botNames.ts): the look's own name, else its theme's next free
   * name, else a general one. Never a name in use in the match (players, bots, spectators) or the host's set's;
   * `self`: the bot being renamed (its own name is free to keep).
   */
  nameFor(look, self) {
    const used = /* @__PURE__ */ new Set();
    for (const n of this.match.namesInUse()) used.add(n.toLowerCase());
    if (self) used.delete(self.name.toLowerCase());
    if (this.set) for (const e of this.set.entries) used.add(e.name.toLowerCase());
    const from = this.match.roulette ? void 0 : look;
    return botNameFor(from, (n) => used.has(n.toLowerCase()), (this.match.seed - 1) * 37);
  }
  /**
   * The bot-characters setting changed (Match.setRules({ botCast }) first): random bots wearing a look it no
   * longer allows change into one it does, named for it. Returns how many changed.
   */
  recast() {
    return this.match.recastBots((look, self) => this.nameFor(look, self));
  }
  /** A team of the match by order (a set's `team`), or undefined (auto, or no such team). */
  teamAt(i) {
    return i === void 0 ? void 0 : this.match.teams?.[i]?.id;
  }
  /** The set's bots not in the match now, in order. */
  waiting() {
    const set = this.set;
    if (!set) return [];
    const used = /* @__PURE__ */ new Set();
    for (const c of this.match.combatants()) if (c.kind === "bot" && c.botSet) used.add(c.botSet.index);
    return set.entries.flatMap((entry, index) => used.has(index) ? [] : [{ entry, index }]);
  }
  /**
   * The next bot to add: the set's first bot waiting for the team that most needs a player (its own team's
   * first, then one without a team), else a random bot; with "only these bots", null when none fits.
   */
  pick() {
    const set = this.set;
    if (!set) return "random";
    const free = this.waiting();
    const m = this.match;
    if (m.teams) {
      const team = m.nextBotTeam();
      const own = free.find((x) => this.teamAt(x.entry.team) === team) ?? free.find((x) => this.teamAt(x.entry.team) === void 0);
      if (own) return { ...own, team };
      if (set.fill === "random") return "random";
      const other = free.find((x) => {
        const t = this.teamAt(x.entry.team);
        if (!t) return false;
        const r = m.teamRoom(t);
        return r.on < r.size;
      });
      return other ? { ...other, team: this.teamAt(other.entry.team) } : null;
    }
    const first = free[0];
    return first ?? (set.fill === "only" ? null : "random");
  }
  /** Add one bot (the set's next, else a random one). False when none can be added. */
  addOne() {
    const p = this.pick();
    if (!p) return false;
    if (p === "random") {
      return !!this.match.addBot((look) => this.nameFor(look), this.nextProfile(), this.difficulty, true);
    }
    const e = p.entry;
    const profile = CORE_BOT_PROFILES[p.index % CORE_BOT_PROFILES.length];
    const botSet = { index: p.index, ...e.skill ? { skill: e.skill } : {}, ...e.style ? { style: e.style } : {}, ...e.squad ? { squad: e.squad } : {} };
    return !!this.match.addBot(e.name, profile, this.difficulty, true, { ...p.team ? { team: p.team } : {}, ...e.look ? { look: e.look } : {}, botSet });
  }
  /**
   * The host set a new bot set (or none) mid-match. Bots already playing one of its entries keep their place
   * (matched by name, else by position in the list) and take the entry's name, look, skill, style and squad
   * now; bots whose entry is gone play on as random bots. The rest (new entries, team moves, "only these
   * bots") is swapped in one bot at a time by `stage`, so a big change never lands in one frame.
   */
  setBotSet(next) {
    const set = botSetInUse(next) ? next : null;
    this.set = set;
    this.chosen = true;
    const bots = this.match.combatants().filter((c) => c.kind === "bot" && !c.away && c.botSet);
    const claimed = /* @__PURE__ */ new Map();
    const taken = /* @__PURE__ */ new Set();
    if (set) {
      for (const c of bots) {
        const i = set.entries.findIndex((e, j) => !taken.has(j) && e.name.toLowerCase() === c.name.toLowerCase());
        if (i >= 0) {
          claimed.set(c, i);
          taken.add(i);
        }
      }
      for (const c of bots) {
        const i = c.botSet.index;
        if (claimed.has(c) || i >= set.entries.length || taken.has(i)) continue;
        claimed.set(c, i);
        taken.add(i);
      }
    }
    for (const c of bots) {
      const i = claimed.get(c);
      if (i === void 0) this.match.dropSetBot(c, this.nameFor(c.look, c), this.difficulty);
      else this.match.updateSetBot(c, i, set.entries[i], this.difficulty);
    }
    this.staging = true;
  }
  /**
   * One step of swapping a changed set in (call a few times a second while `settling`): one bot that no
   * longer fits (a random bot where a set bot waits for its team, a set bot on the wrong team, any random
   * bot under "only these bots") goes, and the fill brings in the next. Returns whether the roster changed.
   */
  stage(fill) {
    if (!this.staging) return false;
    const m = this.match;
    const set = this.set;
    const bots = m.combatants().filter((c) => c.kind === "bot" && !c.away);
    const waiting = this.waiting();
    const fits = (team) => waiting.some((x) => {
      const t = this.teamAt(x.entry.team);
      return t === void 0 || t === team;
    });
    const stale = bots.filter((c) => {
      if (c.botSet) {
        const e = set?.entries[c.botSet.index];
        const t = this.teamAt(e?.team);
        return !e || t !== void 0 && t !== c.faction;
      }
      return !!set && (set.fill === "only" || fits(c.faction));
    }).sort((a, b) => setRank(a) - setRank(b) || b.slot - a.slot)[0];
    if (stale) {
      m.remove(stale.slot);
      this.rebalance(fill);
      return true;
    }
    this.staging = false;
    const before = bots.length;
    this.rebalance(fill);
    return m.combatants().filter((c) => c.kind === "bot" && !c.away).length !== before;
  }
  /**
   * A player joins: the worst-scoring bot on the team that needs them is removed
   * to make room (Match.takeOverBot) and they spawn normally, or they get a slot
   * of their own when there is no bot. Then the fill is kept.
   */
  join(name, look, fill, party) {
    let c = this.match.takeOverBot(name, look, party);
    if (!c) {
      c = this.match.addHuman(name, look, party ? this.match.partyTeam(party) : void 0);
      if (c && party) c.party = party;
    }
    this.rebalance(fill);
    return c;
  }
  /** A player leaves: their slot empties and the fill spawns a fresh bot normally (or, with `takeBack`, a bot takes their place where they were). */
  leave(slot, fill) {
    const c = this.match.slots[slot];
    if (!c) return this.match.remove(slot);
    if (c.away) {
      this.release(slot);
      return this.rebalance(fill);
    }
    const all = this.match.combatants();
    const humans = all.filter(isPerson).length - (c.kind === "human" ? 1 : 0);
    const bots = all.filter((x) => x.kind === "bot" && !x.away).length;
    const want = Math.max(0, Math.min(fill - humans, MAX_PLAYER_SLOTS - humans - this.match.spectatorCount));
    if (this.opts.takeBack === true && c.kind === "human" && bots < want) {
      this.match.handToBot(slot, this.nameFor(c.look), this.nextProfile(), this.difficulty, true);
    } else this.match.remove(slot);
    this.rebalance(fill);
  }
  /**
   * A player chooses to spectate (Match.spectate): their body leaves the match and the fill brings in a bot
   * for the place, as when a player leaves. False when they aren't a player in the match.
   */
  spectate(slot, fill) {
    if (!this.match.spectate(slot)) return false;
    this.warned.delete(slot);
    this.rebalance(fill);
    return true;
  }
  /** A spectator joins play again (their kept slot and score); a bot gives way to keep the fill, as when a player joins. */
  rejoin(slot, fill) {
    const c = this.match.joinFromSpectating(slot);
    if (c) this.rebalance(fill);
    return c;
  }
  warned = /* @__PURE__ */ new Set();
  /**
   * A player is away: a bot plays their place for them. `why` afk: idle but
   * connected (they come back by playing: input); dropped: their connection
   * closed, and the place is kept `holdSeconds` for their next connection
   * (reclaim, by `key`: their account, else their browser key). Without a key
   * a dropped player simply leaves.
   */
  hold(slot, why, key2, fill, holdSeconds = AWAY.holdSeconds) {
    const c = this.match.slots[slot];
    if (!c) return false;
    if (why === "dropped" && (!key2 || holdSeconds <= 0)) {
      this.leave(slot, fill);
      return false;
    }
    this.warned.delete(slot);
    const until = why === "dropped" ? this.match.tick + Math.round(holdSeconds * TICK_RATE) : null;
    if (c.away) {
      c.away = { ...c.away, why, key: key2 ?? c.away.key, until };
      return true;
    }
    const profile = this.nextProfile();
    return !!this.match.setAway(slot, { name: c.name, key: key2, why, until, since: this.match.tick }, profile, this.difficulty);
  }
  /** A player's inputs: a player away for being idle is back the moment they play. Then the inputs are queued. */
  input(slot, inputs) {
    const active = this.match.noteActivity(slot, inputs);
    const c = this.match.slots[slot];
    let back = false;
    if (active && c?.away?.why === "afk") back = !!this.match.comeBack(slot);
    if (active) this.warned.delete(slot);
    this.match.queueInputs(slot, inputs);
    return back;
  }
  /**
   * Host handoff: fill a fresh match from a checkpoint. Bots come back as bots, `me` (the successor's own
   * player, marked `succ`) as a player, and everyone else as an away player whose place a bot keeps, held
   * for their next connection by their hashed key (reclaim). Returns the successor's own player.
   */
  restore(cp, fill, me, placed = /* @__PURE__ */ new Map()) {
    let mine = null;
    const order = cp.players.map((p, i) => ({ p, i })).sort((a, b) => a.p.kind === b.p.kind ? 0 : a.p.kind === "human" ? -1 : 1);
    for (const { p, i } of order) {
      if (p.kind === "bot") {
        const profile = CORE_BOT_PROFILES[this.counter % CORE_BOT_PROFILES.length];
        this.counter++;
        const c2 = this.match.addBot(p.name, profile, this.difficulty, true);
        if (!c2) continue;
        c2.look = validLookId(p.look);
        this.match.restoreCombatant(c2, p);
        placed.set(i, c2);
        continue;
      }
      const self = p.succ === 1 && !mine;
      const c = this.match.addHuman(self ? me.name : p.name, self ? me.look ?? p.look : p.look, p.team);
      if (!c) continue;
      this.match.restoreCombatant(c, p);
      placed.set(i, c);
      if (self) mine = c;
      else this.hold(c.slot, "dropped", p.key ?? null, fill, AWAY.holdSeconds * 2);
    }
    mine ??= this.match.addHuman(me.name, me.look);
    this.match.restoreSquads(cp, placed);
    this.rebalance(fill);
    return mine;
  }
  /** A new connection takes back the place held for `key` (a dropped player reconnecting). Null when none is held. */
  reclaim(key2, name) {
    const c = this.match.combatants().find((x) => x.away && x.away.key === key2);
    if (!c) return null;
    this.warned.delete(c.slot);
    return this.match.comeBack(c.slot, name);
  }
  /** Whether this player is away (a bot plays for them). */
  isAway(slot) {
    return !!this.match.slots[slot]?.away;
  }
  /**
   * Once a second or so: warn players about to go idle, hand idle players'
   * places to bots (`afkSeconds`; 0: never), and end holds that ran out (the
   * bot stays). `people`: the slots this applies to (online players; never the
   * host's own player in a browser-hosted game).
   */
  watch(fill, people, afkSeconds = AWAY.afkSeconds, kickMinutes = AWAY.kickMinutes) {
    const out = { warn: [], away: [], released: [], kick: [] };
    const m = this.match;
    for (const c of m.combatants()) {
      const away = c.away;
      if (away && away.until !== null && m.tick >= away.until) {
        out.released.push(away.name);
        this.release(c.slot);
      }
    }
    if (out.released.length) this.rebalance(fill);
    if (m.phase !== "playing") {
      m.resetIdle();
      this.warned.clear();
      return out;
    }
    if (afkSeconds <= 0) return out;
    if (kickMinutes > 0) {
      for (const c of m.combatants()) {
        const a = c.away;
        if (a?.why === "afk" && people.has(c.slot) && a.since !== void 0 && m.tick - a.since >= kickMinutes * 60 * TICK_RATE) out.kick.push(c.slot);
      }
      for (const slot of m.spectatorSlots()) if (people.has(slot) && m.idleSeconds(slot) >= kickMinutes * 60) out.kick.push(slot);
    }
    for (const c of m.combatants()) {
      if (c.kind !== "human" || !people.has(c.slot)) continue;
      const idle = m.idleSeconds(c.slot);
      if (idle >= afkSeconds) {
        this.hold(c.slot, "afk", null, fill);
        out.away.push(c.slot);
      } else if (idle >= afkSeconds - AWAY.warnSeconds && !this.warned.has(c.slot)) {
        this.warned.add(c.slot);
        out.warn.push(c.slot);
      }
    }
    return out;
  }
  /** A held place is no longer kept: the bot playing it stays, under a bot name. */
  release(slot) {
    const c = this.match.slots[slot];
    if (!c?.away) return;
    delete c.away;
    delete c.party;
    c.name = this.nameFor(c.look, c);
    this.warned.delete(slot);
  }
  /** Bot skill now (the host can change it mid-match: retune). */
  get skill() {
    return this.difficulty;
  }
  /** The host changed bot skill (and maybe style): bots in the match and bots added later play that way. */
  retune(difficulty, style) {
    this.difficulty = difficulty;
    this.match.retuneBots(difficulty, style);
  }
  /**
   * Keep humans + bots at `fill`. Too many: bots go, the worst-scoring first
   * (fewest kills less deaths, as when a player joins), from the team most
   * over its size so the sides stay as set. Too few: bots join and spawn
   * normally on the teams that need them.
   */
  rebalance(fill) {
    if (this.match.teams) {
      const targets2 = this.match.teamTargets();
      const score = (c) => c.kills - c.deaths;
      for (const t of this.match.teams) {
        const on = this.match.combatants().filter((c) => c.faction === t.id);
        const spare = on.filter((c) => c.kind === "bot" && !c.away).sort((a, b) => setRank(a) - setRank(b) || score(a) - score(b) || a.kills - b.kills || b.slot - a.slot);
        for (let n = on.length; n > (targets2.get(t.id) ?? n) && spare.length; n--) this.match.remove(spare.shift().slot);
      }
    }
    const all = this.match.combatants();
    const humans = all.filter(isPerson).length;
    const bots = all.filter((c) => c.kind === "bot" && !c.away);
    const want = Math.max(0, Math.min(fill - humans, MAX_PLAYER_SLOTS - humans - this.match.spectatorCount));
    const targets = this.match.teamTargets();
    for (let i = bots.length; i > want; i--) {
      const live = this.match.combatants();
      const over = (team) => (live.filter((c) => c.faction === team).length - 1) / (team ? targets.get(team) ?? 1 : 1);
      const score = (c) => c.kills - c.deaths;
      const left = live.filter((c) => c.kind === "bot" && !c.away).sort((a, b) => over(b.faction) - over(a.faction) || setRank(a) - setRank(b) || score(a) - score(b) || a.kills - b.kills || b.slot - a.slot);
      this.match.remove(left[0].slot);
    }
    for (let i = bots.length; i < want; i++) if (!this.addOne()) break;
  }
}
const LEADER_BOUNTY = 3;
const BOT_FULL_RATE = 40;
const BOT_THINK_EVERY = 3;
const BOT_THINK_SLACK = 6;
const RELAXED_RANGE = 45;
const RELAXED_BORE = 2;
const NO_BORES = [];
const RELAXED_PORTAL = 6;
const COAST_BUTTONS = BUTTON_SPRINT | BUTTON_CROUCH | BUTTON_PRONE;
const SEARCH_BUDGET = 24;
const STANCE_SPREAD = [1, 0.7, 0.5];
const NO_SCOPE_SPREAD = 0.03;
function movementSpread(c, def) {
  if (def.kind === "melee") return 0;
  const k = def.pellets > 1 ? 0.35 : 1;
  const run = Math.min(1, c.moveSpeed / PLAYER.runSpeed);
  return (run > 0.25 ? 0.014 * run : 0) * k + (c.move.grounded ? 0 : 0.035 * k);
}
const ADS_SPREAD = 0.55;
function aimSpread(c, def, spread2) {
  const w = getWeapon(def.id);
  if (def.alt || c.npc) return spread2;
  if (!w.view.zoomFov) return c.prevButtons & BUTTON_ZOOM ? spread2 * ADS_SPREAD : spread2;
  if (c.prevButtons & BUTTON_ZOOM) return spread2 * 0.35;
  return spread2 + (w.view.zoomFov < 0.5 ? 0.05 : 0.012);
}
function primaryTrigger(def) {
  return {
    id: def.id,
    kind: def.kind,
    damage: def.damage,
    pellets: def.pellets,
    spread: def.spread,
    range: def.range,
    ...def.projectile ? { projectile: def.projectile } : {},
    ...def.pierce ? { pierce: def.pierce } : {},
    ...def.chain ? { chain: def.chain } : {},
    ...def.status ? { status: def.status } : {},
    ...def.knockback ? { knockback: def.knockback } : {},
    ...def.recoil ? { recoil: def.recoil } : {},
    ...def.headshot !== void 0 ? { headshot: def.headshot } : {}
  };
}
function spendRound(w) {
  if (w.shells !== void 0) {
    if (w.shells <= 0 || w.overheated) return false;
    w.shells--;
  }
  const heat = w.def.heat;
  if (heat) {
    if (w.overheated) return false;
    w.heat = (w.heat ?? 0) + heat.perShot;
    if (w.heat >= 1) {
      w.heat = 1;
      w.overheated = true;
    }
    return true;
  }
  if (w.def.magazine > 0) {
    if (w.mag === 0 || w.unchambered) return false;
    w.mag--;
  }
  return true;
}
function isMeleeWeapon(weapon) {
  if (weapon === UNARMED.punch.id || weapon === UNARMED.kick.id) return true;
  return CORE_WEAPONS[weapon]?.kind === "melee";
}
function zoneScale(gp, zone) {
  return zone === 1 ? gp.head : zone === 2 ? gp.legs : 1;
}
function statusSpeed(c) {
  if (c.frozenTicks > 0) return 0;
  return (c.slowTicks > 0 ? 0.55 : 1) * impactSpeed(c.impact) * (1 - 0.6 * c.chill) * (c.modeSpeed ?? 1) * (c.classSpeed ?? 1);
}
const inZone = (z, feet) => zoneContains(z.kind, z.pos, z.radius, feet);
function statusBits(c) {
  return (c.move.jet ? FX_JET : 0) | (c.move.swim ? FX_SWIM : 0) | (c.burnTicks > 0 ? STATUS_BURN : 0) | (c.poisonTicks > 0 ? STATUS_POISON : 0) | (c.slowTicks > 0 ? STATUS_SLOW : 0) | (c.frozenTicks > 0 ? STATUS_FROZEN : 0) | (c.chill > 0.05 ? STATUS_CHILL : 0);
}
function altTrigger(def, alt) {
  return {
    id: def.id,
    kind: alt.kind,
    damage: alt.damage ?? def.damage,
    pellets: alt.pellets ?? def.pellets,
    spread: alt.spread ?? def.spread,
    range: alt.range ?? def.range,
    ...alt.projectile ? { projectile: alt.projectile } : {},
    ...alt.kick ? { kick: alt.kick } : {},
    ...alt.falloff ? { falloff: alt.falloff } : {},
    ...alt.headshot !== void 0 ? { headshot: alt.headshot } : {},
    alt: true
  };
}
const round2 = (v) => Math.round(v * 100) / 100;
class HostControl {
  constructor(match, bots, fill, title = "Host", max = MAX_PLAYER_SLOTS) {
    this.match = match;
    this.bots = bots;
    this.fill = fill;
    this.title = title;
    this.max = max;
    match.beforeRound = () => this.playPending();
  }
  match;
  bots;
  fill;
  title;
  max;
  /** Rules changed mid-match that wait for the next match (Save for next match; Apply & restart plays them at once). */
  pending = {};
  /** The rules the next match plays: these now, with the changes waiting for it (a map change and the rotation take them on). */
  nextRules() {
    return withPending(this.match.rules, this.pending);
  }
  /** Told when the rules saved for the next match have gone into play (a new round began with them): the host tells everyone. */
  onNextRules;
  /** The changes saved for the next match go into play (a new round is starting). */
  playPending() {
    if (!Object.keys(this.pending).length) return;
    const { weaponSet: _set, ...p } = this.pending;
    const { weather, ...q } = p;
    this.match.setRules({ ...q, ...p.friendlyFire === "off" ? { friendlyFire: void 0 } : {}, ...weather !== void 0 ? { weather: weather ?? void 0 } : {} });
    this.pending = {};
    this.onNextRules?.();
  }
  state() {
    const r = this.match.rules;
    const teams = teamCount(r);
    const sizes = r.teamSizes?.slice(0, teams) ?? [];
    return {
      fill: this.fill,
      teamSize: teams ? sizes.length ? Math.max(...sizes) : Math.max(1, Math.round(this.fill / teams)) : null,
      teams,
      max: this.max,
      skill: this.bots.skill.id,
      style: r.botStyle ?? "mixed",
      map: this.match.map.metadata.id,
      mode: r.mode,
      teamNames: this.match.teams?.map((t) => t.name) ?? [],
      teamColors: this.match.teams?.map((t) => t.color) ?? [],
      sizes: teams ? Array.from({ length: teams }, (_, i) => sizes[i] ?? Math.max(1, Math.round(this.fill / teams))) : [],
      rules: { scoreLimit: r.scoreLimit, timeLimitSeconds: r.timeLimitSeconds, friendlyFire: r.friendlyFire ?? "off", respawnDelayTicks: r.respawnDelayTicks, mixPickups: !!r.mixPickups, dropWeapons: r.dropWeapons !== false, breakthroughPool: r.breakthroughPool ?? BREAKTHROUGH_POOL, breakthroughSectorSeconds: r.breakthroughSectorSeconds ?? BREAKTHROUGH_SECTOR_SECONDS, breakthroughSwap: !!r.breakthroughSwap, weaponSet: isWeaponSetId(r.weaponSet) ? r.weaponSet : null, weather: isWeatherChoice(r.weather) ? r.weather : null },
      pending: { ...this.pending },
      botSet: this.bots.botSet,
      ...this.bots.botSet && !this.bots.hostSet ? { mapBots: true } : {},
      cast: r.botCast ? [...r.botCast] : null,
      mapCast: validBotCast(this.match.map.botCast),
      mapWeaponSet: mapWeaponSet(this.match.map),
      mapWeather: weatherLabel(mapWeather(this.match.map))
    };
  }
  /**
   * Run a bots / restart / end command. Returns the line everyone's feed shows
   * ("Host set teams to 8v8"), or an error for the host alone.
   */
  apply(cmd) {
    const who = this.title;
    if (cmd.c === "rules") {
      const p = {};
      const r = cmd.rules;
      if (r.scoreLimit !== void 0) p.scoreLimit = Math.max(0, Math.min(SCORE_LIMIT_MAX, Math.round(r.scoreLimit)));
      if (r.timeLimitSeconds !== void 0) p.timeLimitSeconds = Math.max(0, Math.min(7200, Math.round(r.timeLimitSeconds)));
      if (r.respawnDelayTicks !== void 0) p.respawnDelayTicks = Math.max(0, Math.min(1800, Math.round(r.respawnDelayTicks)));
      if (r.friendlyFire !== void 0) p.friendlyFire = r.friendlyFire;
      if (r.breakthroughPool !== void 0) p.breakthroughPool = Math.max(1, Math.min(BREAKTHROUGH_POOL_MAX, Math.round(r.breakthroughPool)));
      if (r.breakthroughSectorSeconds !== void 0) p.breakthroughSectorSeconds = Math.max(60, Math.min(1800, Math.round(r.breakthroughSectorSeconds)));
      if (r.breakthroughSwap !== void 0) p.breakthroughSwap = r.breakthroughSwap;
      if (r.weather !== void 0) p.weather = isWeatherChoice(r.weather) ? r.weather : null;
      let mixed;
      if (r.mixPickups !== void 0 && r.mixPickups !== !!this.match.rules.mixPickups) {
        this.match.setRules({ mixPickups: r.mixPickups || void 0 });
        mixed = `${who} ${r.mixPickups ? "mixed up" : "stopped mixing up"} the weapon pickups`;
      }
      if (r.dropWeapons !== void 0 && r.dropWeapons !== (this.match.rules.dropWeapons !== false)) {
        this.match.setRules({ dropWeapons: r.dropWeapons ? void 0 : false });
        const line = `${who} turned weapon drops ${r.dropWeapons ? "on" : "off"}`;
        mixed = mixed ? `${mixed}; ${line}` : line;
      }
      const set = r.weaponSet === void 0 ? void 0 : r.weaponSet === null || !isWeaponSetId(r.weaponSet) ? null : r.weaponSet;
      if (set !== void 0 && set !== (isWeaponSetId(this.match.rules.weaponSet) ? this.match.rules.weaponSet : null)) {
        this.match.setRules({ weaponSet: set ?? void 0 });
        const line = `${who} set the weapons to ${set ? getWeaponSet(set).name : `the map's (${getWeaponSet(mapWeaponSet(this.match.map)).name})`}`;
        mixed = mixed ? `${mixed}; ${line}` : line;
      }
      this.pending = { ...this.pending, ...p };
      const now = this.match.rules;
      const current = (k) => k === "friendlyFire" ? now.friendlyFire ?? "off" : k === "breakthroughPool" ? now.breakthroughPool ?? BREAKTHROUGH_POOL : k === "breakthroughSectorSeconds" ? now.breakthroughSectorSeconds ?? BREAKTHROUGH_SECTOR_SECONDS : k === "breakthroughSwap" ? !!now.breakthroughSwap : k === "weather" ? isWeatherChoice(now.weather) ? now.weather : null : now[k];
      for (const k of Object.keys(this.pending)) if (current(k) === this.pending[k]) delete this.pending[k];
      if (Object.keys(p).length) return { notice: `${mixed ? `${mixed}; ` : ""}${who} changed the rules for the next match` };
      return mixed ? { notice: mixed } : {};
    }
    if (cmd.c === "restart") {
      this.bots.rebalance(this.fill);
      this.match.restartMatch();
      return { notice: `${who} restarted the match` };
    }
    if (cmd.c === "end") return this.match.endMatch() ? { notice: `${who} ended the match` } : { error: "The match is not in play" };
    const lines = [];
    const teams = teamCount(this.match.rules);
    if (teams && cmd.teamSizes !== void 0) {
      const sizes = validateTeamSizes(cmd.teamSizes, this.match.rules.mode, void 0, this.max).sizes.slice(0, teams);
      while (sizes.length < teams) sizes.push(sizes[sizes.length - 1] ?? 1);
      this.match.setRules({ teamSizes: sizes });
      this.fill = sizes.reduce((a, b) => a + b, 0);
      lines.push(`teams to ${sizes.join("v")}`);
    } else if (teams && cmd.teamSize !== void 0) {
      const size = Math.max(1, Math.min(Math.floor(this.max / teams), cmd.teamSize));
      this.match.setRules({ teamSizes: Array.from({ length: teams }, () => size) });
      this.fill = size * teams;
      lines.push(`teams to ${teamsLabel(teams, size)}`);
    } else if (!teams && cmd.fill !== void 0) {
      this.fill = Math.max(1, Math.min(this.max, cmd.fill));
      const coop = this.match.rules.mode === "core.coop" || this.match.rules.mode === "core.zombies";
      lines.push(coop ? `the squad to ${this.fill}` : `the match to ${this.fill} players`);
    }
    if (cmd.botSet !== void 0) {
      const next = cmd.botSet === null ? null : validateBotSet(cmd.botSet)?.set ?? null;
      if (!sameBotSet(next, this.bots.botSet)) {
        this.bots.setBotSet(next);
        lines.push(`the bots to ${botSetLabel(this.bots.botSet)}`);
      }
    }
    if (cmd.cast !== void 0) {
      const next = cmd.cast === null ? void 0 : validBotCast(cmd.cast);
      if (JSON.stringify(next) !== JSON.stringify(this.match.rules.botCast)) {
        this.match.setRules({ botCast: next });
        this.bots.recast();
        lines.push(`the bots to ${next === void 0 ? `the map's characters (${botCastLabel(this.match.botCast)})` : botCastLabel(next).toLowerCase()}`);
      }
    }
    const skill = cmd.skill && cmd.skill !== this.bots.skill.id ? cmd.skill : void 0;
    const style = cmd.style && cmd.style !== (this.match.rules.botStyle ?? "mixed") ? cmd.style : void 0;
    if (skill || style) {
      this.bots.retune(BOT_DIFFICULTIES[skill ?? this.bots.skill.id], style);
      if (skill) lines.push(`bot skill to ${skill}`);
      if (style) lines.push(`bot style to ${style}`);
    }
    this.bots.rebalance(this.fill);
    if (!lines.length) return {};
    return { notice: `${who} set ${lines.join(", ")}` };
  }
}
class BotTrace {
  stuck = /* @__PURE__ */ new Map();
  fails = /* @__PURE__ */ new Map();
  /** What happened to this bot since the last look (null: not a bot). */
  look(c) {
    const b = c.bot;
    if (!b) return null;
    const stuck = b.stuckCount - (this.stuck.get(c.slot) ?? 0);
    if (stuck > 0) this.stuck.set(c.slot, b.stuckCount);
    const failed = b.pathFailures - (this.fails.get(c.slot) ?? 0);
    if (failed > 0) this.fails.set(c.slot, b.pathFailures);
    return { stuck: Math.max(0, stuck), at: c.move.pos, doing: b.doing, failed: Math.max(0, failed), noRoute: failed > 0 ? b.lastNoRoute : null };
  }
}
const BOT_TEST_MAX_BOTS = 64;
const VISIT_EVERY = 0.5;
const MAX_CELLS = 4e3;
const OBJECTIVE_LABELS = {
  "hill hold": "Hill taken",
  "flag take": "Flag taken",
  "flag capture": "Flag captured",
  "flag return": "Flag returned",
  "flag drop": "Flag dropped",
  "bomb plant": "Bomb planted",
  "bomb defuse": "Bomb defused",
  "bomb explode": "Bomb exploded",
  "hostage rescue": "Hostage rescued",
  "bt sector": "Sector taken",
  "elim win": "Round won",
  "bt capture": "Objective captured",
  "bt destroy": "Objective destroyed"
};
function botTestRules(map, o) {
  const base = rulesForMode(map, o.mode);
  const rules = { ...base, scoreLimit: 0, timeLimitSeconds: 0 };
  let total;
  if (isTeamMode(o.mode)) {
    const teams = isTwoTeamMode(o.mode) ? 2 : rules.teamSizes?.length ?? 2;
    const per = Math.max(1, Math.min(Math.floor(BOT_TEST_MAX_BOTS / teams), Math.round(o.teamSize)));
    rules.teamSizes = Array.from({ length: teams }, () => per);
    total = per * teams;
  } else total = Math.max(1, Math.min(BOT_TEST_MAX_BOTS, Math.round(o.bots)));
  return { rules, total };
}
class BotTestRun {
  /** Requires initPhysics() and initNavigation() to have resolved. */
  constructor(map, opts) {
    this.opts = opts;
    const t0 = performance.now();
    const { rules, total } = botTestRules(map, opts);
    this.match = new Match(map, rules, opts.seed ?? 1);
    for (let i = 0; i < total; i++) this.match.addBot(`bot${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length], BOT_DIFFICULTIES.normal, true);
    this.bots = total;
    this.totalTicks = Math.max(1, Math.round(opts.seconds * TICK_RATE));
    let lo = Infinity;
    let hi2 = -Infinity;
    for (const b of this.match.geometry) {
      lo = Math.min(lo, b.min[0], b.min[2]);
      hi2 = Math.max(hi2, b.max[0], b.max[2]);
    }
    const cell = heatCellFor(Number.isFinite(hi2 - lo) ? hi2 - lo : 100);
    this.grids = Object.fromEntries(HEAT_LAYERS.map((l) => [l, heatGrid(cell)]));
    this.ms += performance.now() - t0;
  }
  opts;
  match;
  totalTicks;
  tick = 0;
  trace = new BotTrace();
  grids;
  firsts = /* @__PURE__ */ new Map();
  hill = { held: 0, contested: 0 };
  kills = 0;
  ms = 0;
  bots;
  get done() {
    return this.tick >= this.totalTicks;
  }
  /** Share of the run played (0..1). */
  get progress() {
    return this.tick / this.totalTicks;
  }
  /** Play up to `ticks` more ticks (fewer at the end). */
  advance(ticks) {
    const t0 = performance.now();
    const visitEvery = Math.round(VISIT_EVERY * TICK_RATE);
    const end = Math.min(this.totalTicks, this.tick + ticks);
    const koth = this.match.mode instanceof KothMode ? this.match.mode : null;
    while (this.tick < end) {
      const events = this.match.step();
      this.tick++;
      const t = this.tick / TICK_RATE;
      for (const e of events) {
        if (e.e === "kill") {
          this.kills++;
          const v = this.match.actor(e.victim);
          if (v) addHeat(this.grids.died, v.move.pos.x, v.move.pos.y, v.move.pos.z);
        }
        if (e.e === "flag" || e.e === "hill" || e.e === "bomb" || e.e === "hostage" || e.e === "bt" || e.e === "elim") {
          const k = `${e.e} ${e.a}`;
          if (!OBJECTIVE_LABELS[k]) continue;
          const f = this.firsts.get(k);
          if (f) f.count++;
          else this.firsts.set(k, { first: Math.round(t), count: 1 });
        }
      }
      if (koth) {
        if (koth.holder === "contested") this.hill.contested += 1 / TICK_RATE;
        else if (koth.holder) this.hill.held += 1 / TICK_RATE;
      }
      if (this.tick % visitEvery) continue;
      for (const c of this.match.combatants()) {
        if (!c.bot) continue;
        const tr = this.trace.look(c);
        if (tr.stuck > 0) addHeat(this.grids.stuck, tr.at.x, tr.at.y, tr.at.z, tr.stuck);
        if (tr.failed > 0 && tr.noRoute) addHeat(this.grids.failed, tr.noRoute.from.x, tr.noRoute.from.y, tr.noRoute.from.z, tr.failed);
        if (c.alive && !c.mount) addHeat(this.grids.went, c.move.pos.x, c.move.pos.y, c.move.pos.z);
      }
    }
    this.ms += performance.now() - t0;
  }
  result() {
    const bots = this.match.combatants().filter((c) => c.bot);
    const seconds = this.tick / TICK_RATE;
    const summary = {
      mode: this.opts.mode,
      bots: this.bots,
      seconds: Math.round(seconds),
      kills: this.kills,
      stuck: bots.reduce((a, c) => a + c.bot.stuckCount, 0),
      searches: bots.reduce((a, c) => a + c.bot.pathSearches, 0),
      failed: bots.reduce((a, c) => a + c.bot.pathFailures, 0),
      objective: [...this.firsts].map(([k, f]) => ({ what: OBJECTIVE_LABELS[k], ...f })).sort((a, b) => a.first - b.first),
      ...this.match.mode instanceof KothMode ? { hill: { held: Math.round(this.hill.held), contested: Math.round(this.hill.contested) } } : {},
      ms: Math.round(this.ms),
      msPerSecond: seconds > 0 ? Math.round(this.ms / seconds * 10) / 10 : 0
    };
    const layers = Object.fromEntries(HEAT_LAYERS.map((l) => [l, heatCells(this.grids[l], 0, MAX_CELLS)]));
    return { summary, cell: this.grids.went.cell, layers };
  }
  destroy() {
    this.match.destroy();
  }
}
const DENSE = 3.5;
function densePlaces(nav) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const add2 = (p) => {
    const k = `${Math.floor(p.x / DENSE)},${Math.floor(p.z / DENSE)},${Math.floor(p.y / 2.5)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(p);
  };
  const main = nav.mainPlaces();
  for (const p of main) add2(p);
  for (const p of main) {
    for (const [dx, dz] of [[DENSE, 0], [-DENSE, 0], [0, DENSE], [0, -DENSE]]) {
      const want = { x: p.x + dx, y: p.y, z: p.z + dz };
      const q = nav.closestPoint(want, { x: 0.5, y: 1.5, z: 0.5 });
      if (q && Math.hypot(q.x - want.x, q.z - want.z) < 0.6 && nav.inMain(q)) add2(q);
    }
  }
  return out;
}
function mapExposure(map) {
  const t0 = performance.now();
  const built = mapNavigation(map);
  try {
    const places = samplePlaces(densePlaces(built.nav), EXPOSURE_SAMPLES);
    const sees = (a, b) => built.physics.lineOfSight(a, b);
    const spawns = map.entities.filter((e) => e.kind === "spawn").map((e) => ({ id: e.id, pos: { x: e.position[0], y: e.position[1], z: e.position[2] }, team: e.faction ?? null }));
    const exposure = spawnExposure(spawns, places, sees);
    const lines = longSightlines(samplePlaces(places, 250), sees);
    return { spawns: exposure, lines, places: places.length, ms: Math.round(performance.now() - t0) };
  } finally {
    built.physics.free();
    built.nav.destroy();
  }
}
const PAD_MISS_M = 2.5;
const PAD_MISS_HEIGHT_M = 1;
const FLIGHT_TICKS = 600;
function flyer(map) {
  const match = new Match(map, void 0, 1);
  const me = match.addHuman("pad-check");
  if (me) return { match, me, seq: 0, flown: 0 };
  match.destroy();
  return null;
}
function flyPad(f, map, id, pad) {
  const { match, me } = f;
  f.flown++;
  const predicted = padLandings([pad], match.physics, match.phys.gravity, mapGravityZones(map.entities))[0]?.end ?? null;
  me.health = 100;
  match.leaveMount(me, false);
  me.move = { pos: { ...pad.pos }, velY: 0, grounded: true };
  let left = false;
  let down = false;
  for (let t = 0; t < FLIGHT_TICKS && me.alive; t++) {
    me.health = 100;
    match.queueInputs(me.slot, [{ seq: ++f.seq, forward: 0, right: 0, yaw: me.yaw, pitch: 0, buttons: 0 }]);
    match.step();
    if (!me.move.grounded) left = true;
    else if (left) {
      down = true;
      break;
    }
  }
  const landed = down && me.alive ? { ...me.move.pos } : null;
  return {
    id,
    pad: { ...pad.pos },
    predicted,
    landed,
    alive: me.alive,
    miss: landed && predicted ? Math.hypot(landed.x - predicted.x, landed.z - predicted.z) : Infinity,
    height: landed && predicted ? landed.y - predicted.y : 0
  };
}
const padFlightOk = (f) => f.alive && !!f.landed && !!f.predicted && f.miss <= PAD_MISS_M && Math.abs(f.height) <= PAD_MISS_HEIGHT_M;
function flyPads(map) {
  const entities = map.entities.filter((e) => e.kind === "pad");
  const pads = mapPads(entities);
  const out = [];
  let shared = null;
  try {
    for (const [i, pad] of pads.entries()) {
      shared ??= flyer(map);
      if (!shared) break;
      const first = shared.flown === 0;
      let flight = flyPad(shared, map, entities[i].id, pad);
      if (!padFlightOk(flight) && !first) {
        const own = flyer(map);
        if (own) {
          try {
            flight = flyPad(own, map, entities[i].id, pad);
          } finally {
            own.match.destroy();
          }
        }
      }
      out.push(flight);
      if (!shared.me.alive) {
        shared.match.destroy();
        shared = null;
      }
    }
  } finally {
    shared?.match.destroy();
  }
  return out;
}
const at = (p) => `${p.x.toFixed(1)}, ${p.z.toFixed(1)}`;
function padFlightIssues(flights) {
  const out = [];
  for (const f of flights) {
    const name = `jump pad "${f.id}" (at ${at(f.pad)})`;
    let message = null;
    if (!f.alive) message = `${name}: a player thrown by it dies before landing${f.predicted ? ` (predicted landing ${at(f.predicted)})` : ""}: the flight ends in the void or something deadly`;
    else if (!f.landed) message = `${name}: a player standing on it is not thrown and back on the ground within 10 s: check the pad is on a floor and its power`;
    else if (!f.predicted) message = `${name}: its arc comes down nowhere, but a player lands at ${at(f.landed)}: bots will not use it`;
    else if (f.miss > PAD_MISS_M) message = `${name}: a player lands ${f.miss.toFixed(1)} m from its predicted landing (at ${at(f.landed)}, predicted ${at(f.predicted)}): the body hits something on the way (a roof, beam or ledge over the arc) or slides off the landing; clear the arc or change the pad's power, push or direction`;
    else if (Math.abs(f.height) > PAD_MISS_HEIGHT_M) message = `${name}: a player lands ${Math.abs(f.height).toFixed(1)} m ${f.height > 0 ? "above" : "below"} its predicted landing (at ${at(f.landed)}, height ${f.landed.y.toFixed(1)} m, predicted ${f.predicted.y.toFixed(1)} m): the body catches a ledge or misses the floor the arc ends on`;
    if (message) out.push({ severity: "warning", code: "pad.flight", message, targetId: f.id });
  }
  return out;
}
function validateMapPlay(map, official, opts = {}) {
  const nav = validateMapNavigation(map, official, opts);
  return { ...nav, issues: [...nav.issues, ...padFlightIssues(flyPads(map))] };
}
function clumpArea(match, radius = 20) {
  const teams = [...new Set(match.combatants().map((c) => c.faction ?? ""))];
  const centroid2 = (pts) => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length });
  const own = match.spawnPoints.filter((s) => !s.generated);
  const all = own.map((s) => s.pos);
  const mid = centroid2(all);
  const a = centroid2(own.filter((s) => s.team === teams[0]).map((s) => s.pos).concat(all.length ? [] : [mid]));
  const b = centroid2(own.filter((s) => s.team === teams[1]).map((s) => s.pos).concat(all.length ? [] : [mid]));
  let ax = b.x - a.x;
  let az = b.z - a.z;
  const al = hypot(ax, az);
  if (!Number.isFinite(al) || al < 1) {
    ax = 1;
    az = 0;
  } else {
    ax /= al;
    az /= al;
  }
  const spotsAround = (c) => {
    const out = [];
    for (let dx = -radius; dx <= radius; dx += 2) {
      for (let dz = -radius; dz <= radius; dz += 2) {
        if (dx * dx + dz * dz > radius * radius) continue;
        const p = match.nav.closestPoint({ x: c.x + dx, y: c.y + 1, z: c.z + dz }, { x: 0.8, y: 4, z: 0.8 });
        if (p && Math.abs(p.y - c.y) < 3 && horizontalDistance(p, c) <= radius) out.push(p);
      }
    }
    return out;
  };
  const places = [...match.nav.places()].sort((p, q) => horizontalDistance(p, mid) - horizontalDistance(q, mid)).slice(0, 24);
  let best = null;
  for (const p of places) {
    const spots2 = spotsAround(p);
    if (!best || spots2.length > best.spots.length) best = { center: p, spots: spots2 };
  }
  const center = best?.center ?? mid;
  const spots = best?.spots ?? [mid];
  const sides = /* @__PURE__ */ new Map();
  for (const t of teams) sides.set(t, []);
  for (const p of spots) {
    const side = (p.x - center.x) * ax + (p.z - center.z) * az < 0 ? 0 : 1;
    sides.get(teams[Math.min(side, teams.length - 1)] ?? "")?.push(p);
  }
  for (const [t, list2] of sides) if (!list2.length) sides.set(t, spots);
  return { center, radius, sides };
}
function clumpInto(match, area, slots, seed = 1) {
  const rng = createRng(seed);
  const list2 = slots ? [...slots].map((s) => match.actor(s)).filter((c) => !!c) : match.combatants();
  for (const c of list2) {
    if (!c.alive || c.mount) continue;
    const spots = area.sides.get(c.faction ?? "") ?? [area.center];
    const p = spots[Math.floor(rng() * spots.length)];
    const pos = { x: p.x + (rng() - 0.5) * 0.6, y: p.y + 0.05, z: p.z + (rng() - 0.5) * 0.6 };
    c.move = { pos, velY: 0, grounded: false };
    c.yaw = Math.atan2(area.center.x - pos.x, area.center.z - pos.z);
    c.bot?.onSpawn(c.yaw);
  }
}
export {
  AWAY,
  BAIL_SPEED,
  BOMB_DEFUSE_SECONDS,
  BOMB_FUSE_SECONDS,
  BOMB_PLANT_SECONDS,
  BOMB_ROUND_SECONDS,
  BOT_FULL_RATE,
  BOT_NAMES,
  BOT_SWITCHES,
  BOT_TEST_MAX_BOTS,
  BOT_THEME_MIN,
  BOT_THINK_EVERY,
  BT_BREAK_SECONDS,
  BT_DEFENDER_RESPAWN,
  BT_DEFUSE_SECONDS,
  BT_FALLBACK_DPS,
  BT_FALLBACK_SECONDS,
  BT_FINAL_SECONDS,
  BT_FUSE_SECONDS,
  BT_PLANT_SECONDS,
  BT_ZONE_SECONDS,
  BombMode,
  BotBrain,
  BotDebugCollector,
  BotFiller,
  BotTestRun,
  BotTrace,
  BreakthroughMode,
  CARRIER_AWARENESS,
  CHASE_WEIGHT,
  CORRIDOR_WIDTH,
  COUNTDOWN_SECONDS,
  COVER_WEIGHT,
  CalloutBoard,
  CtfBotPlan,
  CtfMode,
  DEBUG_EVERY,
  DEBUG_FAILED,
  DEFAULT_PLAYBOOK,
  DROP_HURTS_UP_TO,
  ELIM_BREAK_SECONDS,
  ELIM_ROUND_SECONDS,
  ESCAPE_RISE,
  ElimMode,
  Encounters,
  EnemyMemory,
  FLAG_CAPTURE_RADIUS,
  FLAG_CARRIER_SPEED,
  FLAG_TOUCH_RADIUS,
  FortBots,
  FortsMode,
  GUN_WEIGHT,
  HOLD_NOTICE,
  HOSTAGE_ROUND_SECONDS,
  HostControl,
  HostageMode,
  KothMode,
  LEADER_BOUNTY,
  LINE_STEP,
  LOW_AREA,
  LOW_ROOF_COST,
  MARGIN,
  MAX_QUEUED_INPUTS,
  MAX_REWIND_TICKS,
  MEMORY_SIZE,
  Match,
  NAME_THEMES,
  NOISE_WEIGHT,
  NO_SCOPE_SPREAD,
  NavWorld,
  OPEN_AREA,
  OPTIONS,
  OPTION_NAMES,
  OPT_CHASE,
  OPT_COVER,
  OPT_FIGHT,
  OPT_GOAL,
  OPT_NOISE,
  OPT_PICKUP,
  OPT_POST,
  OPT_RETREAT,
  OPT_ROAM,
  ORDER_NOTICE,
  ORDER_WEIGHT,
  PAD_MISS_HEIGHT_M,
  PAD_MISS_M,
  PLAYBOOKS,
  POST_NOTICE,
  POST_WEIGHT,
  PUSH_NOTICE,
  RELAXED_RANGE,
  RETREAT_WEIGHT,
  ROAM_WEIGHT,
  SCOPE_WEIGHT,
  SOLDIER_RANKS,
  SOLDIER_SURNAMES,
  SPACING$1 as SPACING,
  SQUAD_DEFEND_MIN,
  SQUAD_NOTICE,
  SQUAD_WEIGHT,
  START_WAIT_SECONDS,
  TALL_SIZE,
  TeamBrain,
  VantageBoard,
  arenaHop,
  auditNavigation,
  barrelReach,
  bestChoice,
  bestLoadedDesirability,
  botNameFor,
  botTestRules,
  buildMapNav,
  hi as castAllows,
  chokesNear,
  clumpArea,
  clumpInto,
  components,
  computeVantage,
  createMode,
  ctfBotAwareness,
  ctfBotGoal,
  ctfDefenders,
  ctfDefendersBy,
  ctfRoleOf,
  ctfSquadRoles,
  densePlaces,
  disabled,
  dropOptions,
  edgesOf,
  fallsFrom,
  findCorridors,
  flyPads,
  goalWeight,
  goodShot,
  grenadeWorthIt,
  heldWeapon,
  hintJumps,
  hintSpots,
  inObjective,
  initNavigation,
  knownNavIssue,
  laneCover,
  leadAbility,
  leaveCost,
  lookTheme,
  mainOf,
  mapExposure,
  mapNavigation,
  nameTheme,
  onHill,
  padFlightIssues,
  padFlightOk,
  pickupNeed,
  placeOn,
  playbookFor,
  polyShapes,
  hj as randomGunFor,
  reachSet,
  relocatePrefer,
  resample,
  reverseOf,
  routeComponents,
  scoreChoices,
  hk as setHas,
  hl as setMainGuns,
  shotsPerSpot,
  sideCorridor,
  sideHints,
  simProfile,
  solidsRay,
  splits,
  stageHint,
  teamHome,
  trapExits,
  validateMapNavigation,
  validateMapPlay,
  validateNavigation,
  validateTrackNavigation,
  vantageFor,
  weaponScore,
  withHintSpots
};
