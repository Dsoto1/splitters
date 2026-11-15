const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/match-DbYBHLX7.js","assets/shadowGenerator-_IcnNyty.js","assets/rapier-BmnBVapV.js","assets/settle-BDJE4VMF.js","assets/index-BAsW2uYW.js","assets/babylon-PnzH6wcM.js","assets/vendor-BIr0ad6t.js","assets/vendor-BHvGX0dx.css","assets/index-DMtO9heR.css","assets/thinInstanceMesh.pure-BG4P9X5v.js","assets/scenarioDefs-BcDISE-R.js","assets/envMaterials-BVmVluEo.js","assets/materialPluginBase-Dhlt5oKE.js","assets/babylonFileParser.function-CbkFZ5Hm.js","assets/abstractMesh-CcTXW9P4.js","assets/linesBuilder-6E0Gh92-.js","assets/shaderMaterial.pure-T5Xe2ebz.js","assets/cylinderBuilder-B3IbC6dA.js","assets/capsuleBuilder-D5ktebP4.js","assets/sphereBuilder.pure-CT5peVwp.js","assets/groundBuilder-BbO9y42p.js","assets/torusBuilder-BTtpdox_.js","assets/dynamicTexture.pure-Sh-mex-9.js","assets/geometryBufferRenderer.pure-CTzrC3G0.js","assets/multiRenderTarget.pure-CHje0eeK.js","assets/bakedVertexAnimation-D_Sv770W.js","assets/morphTargetsVertex-ChAeSZCm.js","assets/clipPlaneVertex-BdoNWmEf.js","assets/instancesDeclaration-CoQOC7Vy.js","assets/pointCloudVertex-wlAeL2fL.js","assets/bonesVertex-Cpn2iSQy.js","assets/instancesVertex-23t-Q1Uk.js","assets/morphTargetsVertex-73_uAtmG.js","assets/instancesDeclaration-DL63iftc.js","assets/validate-CT4vQOFf.js","assets/setPieceLibrary-B87Q0Jtb.js","assets/lookHitbox-C8CMJlSr.js","assets/forts-aE5925HD.js","assets/mountVisuals-DcqHY-wo.js","assets/hostRules-B_Hae2mK.js","assets/spawnExposure-Bh2h5Jjf.js"])))=>i.map(i=>d[i]);
import { P as PLAYER, c3 as normalize, c4 as add, c5 as scale, aT as TICK_DT, aI as hypot, aG as viewDirection, a4 as TICK_RATE, T as MODE_LABELS, c6 as PAD_RADIUS, c7 as readSquad, bv as ease, c8 as applyCrosshair, c9 as applyHitmarker, ca as CLASS_IDS, cb as CLASS_DEFS, cc as NPC_ID_BASE, bW as weaponByCode, cd as weaponIcon, ce as isTouchDevice, bi as reduceFlashing, bJ as CORE_WEAPONS, X as mapTeams, Y as MAX_TEAMS, cf as airCraftDef, al as getMountDef, cg as mountTint, ch as BUILT_MOUNT_BASE, ci as MOUNT_FLAG_BURNING, cj as MOUNT_FLAG_ARC, ck as MOUNT_DEFS, cl as SEAT_LEG_DROP, cm as enterReach, cn as MOUNT_FLAG_ALIVE, co as MOUNT_FLAG_WRECK, cp as MOUNT_FLAG_CHARGING, I as rulesForMap, cq as BOT_DIFFICULTIES, V as MAX_PLAYER_SLOTS, cr as BROWSER_MAX_PLAYERS, aK as SNAPSHOT_INTERVAL_TICKS, av as PROTOCOL_VERSION, cs as parseClientMessage, ct as handoffKey, az as BROWSER_HOST_MAX_GUESTS, ai as sanitizeName, cu as STANDBY_ANSWER_SECONDS, cv as CHECKPOINT_EVERY_SECONDS, ax as isJoinCode, d as getWeapon, cw as weaponCode, L as mapPlayerCaps, cx as hubApi, cy as deviceMaxPlayers, aE as loadGraphicsQuality, bz as loadRenderScale, cz as currentFrameCap, cA as el$1, cB as ROTATION_MAX, a2 as DEFAULT_TEAMS, cC as botManager, cD as BOT_SET_PRESETS, cE as getWeaponSet, O as limitsScale, Q as suggestedLimits, cF as limitsText, cG as field, cH as stepper, cI as BREAKTHROUGH_POOL_MAX, cJ as choice, a3 as SCORE_LIMIT_MAX, cK as scoreStep, cL as mapPickPlayers, cM as sizePresets, cN as matchingPreset, cO as sizeChips, cP as teamEditor, cQ as settingRow, cR as peopleAndBots, cS as setupFit, cT as fitChip, cU as fitList, cV as HOST_BOT_SKILLS, cW as HOST_BOT_STYLES, cX as botSetLabel, cY as botCastSelect, J as isTeamMode, cZ as weaponSetSelect, c_ as weatherSelect, U as isTwoTeamMode, c$ as segmented, d0 as isWeatherChoice, d1 as WEATHER_PRESETS, d2 as glyphs, d3 as fullscreenSupported, d4 as isFullscreen, d5 as toggleFullscreen, d6 as PAD, bZ as THROWABLE_DEFS, d7 as breakthroughSectors, d8 as BT_OBJ_ACTIVE, d9 as BT_OBJ_PLANTED, da as sectorLetter, db as HOSTAGE_RESCUED, dc as FLAG_CARRIED, dd as FLAG_DROPPED, de as HOSTAGE_FOLLOWING, df as HOSTAGE_WAITING, dg as BOMB_PLANTED, dh as BOMB_DROPPED, di as BOMB_CARRIED, dj as BT_ROUND_PLAYING, dk as BT_ROUND_ATTACKERS, dl as BT_OBJ_DONE, dm as BT_IN_BOTH, dn as BT_IN_ATTACKERS, dp as BT_IN_DEFENDERS, dq as ORDER_LABELS, dr as SPACING_TEXT, ds as SQUAD_ROLE_TEXT, dt as weaponSetInPlay, du as rouletteSignatures, dv as signatureWeapon, dw as bodyLine, g as getLook, dx as SPAWN_CARD_SECONDS, dy as ROULETTE_SAY_REROLL, dz as ROULETTE_SAY_PICK, dA as STORM_WARN_SECONDS, dB as TUTORIAL_STEPS, dC as TIP_TEXT, bT as angleDelta, dD as eyeHeightOf, bB as WEAPONS_BY_SLOT, dE as BUTTON_THIRD_PERSON, dF as JET, dG as applyPads, dH as stepMovement, dI as SPEED_BOOST, dJ as applyPortals, dK as bodyHeightOf, dL as stepJetFuel, bp as ZONE_KINDS, dM as zoneContains, dN as OIL_TRACTION, dO as BUTTON_FIRE, dP as BUTTON_SPRINT, dQ as BUTTON_USE, dR as BUTTON_RELOAD, dS as BUTTON_ZOOM, dT as BUTTON_MELEE, dU as BUTTON_ALT, dV as oneHanded, dW as BUTTON_AUTO_RELOAD, dX as THROWABLES, dY as distance, b6 as getItem, aF as lookAngles, dZ as loadHitboxOverlay, d_ as InputState, d$ as loadPerfOverlay, e0 as VehicleCamera, aA as hubSetting, e1 as saveReduceFlashing, e2 as REDUCE_FLASHING_EVENT, e3 as roomLightsOn, e4 as saveRoomLights, e5 as ROOM_LIGHTS_EVENT, bw as loadFirstPersonMode, e6 as bindFullscreenButton, e7 as pageHoldsEscape, e8 as browserTookEscape, e9 as DamageNumbers, ea as SprayReadout, eb as rouletteOn, ec as builtInLook, ed as matchStats, ee as TINY_SIZE, ef as unarmedStrike, eg as UNARMED, eh as markerSetting, ei as loadSignaling, au as loadRelay, ej as inSuite, ek as mapIdentity, el as ROTATION_PRESETS, em as validateRotation, en as nextMapLine, eo as builtHub, aw as myParty, ep as relayParams, ak as hubAddress, eq as savePerfOverlay, er as LobbyAdvertiser, es as myRegion, et as currentAccount, eu as sendPlayReport, bO as FX_PROTECTED, ev as FX_JACKPOT, ew as QUICK_MESSAGES, ex as STREAK_REWARDS, ey as withTrackVehicles, ez as matchTeams, eA as classesInPlay, eB as matchPhysics, eC as mapPads, eD as LUNAR_PAD_BOOST, eE as mapLadders, bx as mapZiplines, bA as mapLiquids, eF as mapGravityZones, eG as mapPortals, eH as ZOMBIE_LOOKS, eI as NPC_ROLES, N as NPC_ROLE_SPECS, eJ as setSpawnWeapons, eK as setWeaponsInPlay, bI as heldModel, bK as throwableModel, eL as setThrowables, eM as setPickupPool, eN as matchWeather, eO as DISC_POWER_LABELS, eP as DISC_POWERS, aY as mapFactions, eQ as zombieLook, an as isCreature, eR as grabZipline, eS as heightAboveGround, bj as CHUTE_GLIDER, eT as ORDER_KINDS, eU as orderSay, eV as spacingLabel, eW as SQUAD_SPACINGS, eX as SPACING_ACKS, eY as ORDER_ACKS, eZ as REFUSAL_TEXT, e_ as REFUSALS, e$ as Tutorial, f0 as TipBook, f1 as setTutorialState, f2 as BUTTON_STEER_LOOK, f3 as autoReloadOn, f4 as firingSeat, f5 as zoomLookScale, f6 as mountToWorld, f7 as cockpitEye, aV as STANCES, c1 as mountDamageState, am as npcLookRole, f8 as testMode, f9 as saveMousePrefs, fa as nextSpacing, fb as rayBoxExit, fc as CHUTE } from "./index-BAsW2uYW.js";
import { s as slotColor, b as perfProbe, C as COUNT, S as SYS, d as COUNT_NAMES, G as GameView, B as BLOOD_PREF_KEY, i as impactSoundId, e as impactStyle, g as BODIES_PREF_KEY, D as DEFAULT_FOV, h as BULLET_SPEED, j as statusColor } from "./view-CiZYAbjB.js";
import { a as drawTerrainPlan, b as buriedTiles, f as fillBox, c as drawBuriedPassages } from "./mapPlan-B8abV73I.js";
import { b as buildMapGeometry, aq as borderStyles, ar as borderShockLines, as as fenceRun, E as ELECTRIC_FENCE, at as shockLineNearest, g as getProp, f as fitBounds, ap as mapTerrainMesh, au as OBJECTIVE_STATES } from "./settle-BDJE4VMF.js";
import { r as routePose, a as airRoute, l as loadMap, s as serializeMap } from "./validate-CT4vQOFf.js";
import { z as resupplyReach, E as AMMO_BOX_HALF, A as AMMO_BOX_MODEL, G as AMMO_BOX_REACH, M as ModeVisuals, H as BT_COLORS, I as Movers, J as teamAllows, i as isAmmoBoxPickup, K as pickUsable } from "./abstractMesh-CcTXW9P4.js";
import { a9 as __vitePreload, V as Vector3, M as Matrix, C as Color4, c as StandardMaterial, a as Color3, T as TransformNode, e as CreateBox } from "./babylon-PnzH6wcM.js";
import { K as KeyedLimiter, d as SnapshotStream, Z as Zipper, e as encodeSnapshots, p as playerKey, S as SnapshotCoalescer, N as NetTransport, V as VISUAL_EVENTS } from "./netTransport-CfuKuNhr.js";
import { i as initPhysics, P as PhysicsWorld } from "./shadowGenerator-_IcnNyty.js";
import { C as CreateLineSystem } from "./linesBuilder-6E0Gh92-.js";
import { a as teamsLabel, w as withPending, r as rulesForTravel, b as travelNotice } from "./hostRules-B_Hae2mK.js";
import { C as CreateCapsule } from "./capsuleBuilder-D5ktebP4.js";
import { f as fortFlagBases, a as fortMidfield, F as FORT_PIECE_KINDS, b as FORT_BUILD, B as BUILDER_WEAPON, c as fortPieceBoxes, d as fortBounds, e as FORT_PIECES, g as FORT_BARRIER_HALF, h as fortAimPlacement, i as FORT_MAX_PIECES, j as fortPlacementProblem, k as FORT_FLAG_CLEARANCE, l as FORT_SPAWN_CLEARANCE, m as awardText, t as thirdPersonAim, s as stoppingPower, n as thirdPersonCamera } from "./forts-aE5925HD.js";
import { n as netProbe } from "./netProbe-Bv9gS1yd.js";
import { o as newGunState, q as counterFrom, s as counterRecoil, t as stepReload, v as beginReload, n as gunplayOf, w as stepAds, x as autoReloadDue, y as recoilIdle, z as recoilShot, A as shotCone, C as isTracer, E as bulletPhysics, F as traceBullet, H as RELOAD_KINDS, I as roundsReady, J as glassAt, K as propBreakLook, L as ScenarioBodies, D as DESTRUCTIBLE_SPECS, e as environmentShapes } from "./scenarioDefs-BcDISE-R.js";
import "./vendor-BIr0ad6t.js";
import "./mountVisuals-DcqHY-wo.js";
import "./cylinderBuilder-B3IbC6dA.js";
import "./environmentVisuals-DHOOYxSF.js";
import "./envMaterials-BVmVluEo.js";
import "./materialPluginBase-Dhlt5oKE.js";
import "./rapier-BmnBVapV.js";
import "./thinInstanceMesh.pure-BG4P9X5v.js";
import "./babylonFileParser.function-CbkFZ5Hm.js";
import "./torusBuilder-BTtpdox_.js";
import "./sphereBuilder.pure-CT5peVwp.js";
import "./dynamicTexture.pure-Sh-mex-9.js";
import "./shaderMaterial.pure-T5Xe2ebz.js";
import "./mapMeshes-BbrFew7q.js";
import "./hitboxOverlay-CUGIm5Wp.js";
import "./lookHitbox-C8CMJlSr.js";
import "./setPieceLibrary-B87Q0Jtb.js";
import "./groundBuilder-BbO9y42p.js";
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
function predictThrow(spec, feet, yaw, pitch, lift, raycast, maxSeconds = 4) {
  const eye = { x: feet.x, y: feet.y + PLAYER.eyeHeight, z: feet.z };
  const aim = normalize(add(viewDirection(yaw, pitch), { x: 0, y: lift, z: 0 }));
  let pos = add(eye, scale(aim, 0.5));
  let vel = scale(aim, spec.speed);
  let ticksLeft = Math.round(Math.min(spec.fuseSeconds, maxSeconds) / TICK_DT);
  let bounceCount = 0;
  const points = [pos];
  const bounces = [];
  while (ticksLeft-- > 0) {
    if (spec.drag) vel = scale(vel, Math.max(0, 1 - spec.drag * TICK_DT));
    vel = { x: vel.x, y: vel.y - spec.gravity * TICK_DT, z: vel.z };
    const delta = scale(vel, TICK_DT);
    const len = hypot(delta.x, delta.y, delta.z);
    const dir = scale(delta, 1 / (len || 1));
    const wall = len > 0 ? raycast(pos, dir, len) : null;
    if (wall) {
      const at = add(pos, scale(dir, Math.max(0, wall.dist - 0.05)));
      points.push(at);
      if (spec.sticky) return { points, bounces, end: add(at, scale(wall.normal, 0.06)), ending: "stick" };
      if (spec.mine) return { points, bounces, end: add(at, scale(wall.normal, 0.06)), ending: "mine" };
      if (spec.bounce === void 0) return { points, bounces, end: at, ending: "burst" };
      const n = wall.normal;
      const vn = vel.x * n.x + vel.y * n.y + vel.z * n.z;
      vel = scale({ x: vel.x - 2 * vn * n.x, y: vel.y - 2 * vn * n.y, z: vel.z - 2 * vn * n.z }, spec.bounce);
      pos = add(at, scale(n, 0.05));
      bounces.push(pos);
      bounceCount++;
      if (spec.maxBounces !== void 0 && bounceCount > spec.maxBounces) return { points, bounces, end: pos, ending: "burst" };
      continue;
    }
    pos = add(pos, delta);
    points.push(pos);
  }
  return { points, bounces, end: pos, ending: "burst" };
}
const VOTE_SECONDS = 12;
const VOTE_RESULT_SECONDS = 3;
const VOTE_OPTIONS = 3;
function pickVoteOptions(o) {
  const count = Math.max(2, Math.min(o.count ?? VOTE_OPTIONS, 4));
  const random = o.random ?? Math.random;
  const fits = (c) => c.max >= Math.max(1, o.people);
  const out = [];
  const add2 = (c) => {
    if (out.length < count && !out.some((x) => x.map === c.map)) out.push({ map: c.map, name: c.name, mode: c.mode });
  };
  const fresh = (c) => fits(c) && c.map !== o.current;
  for (const c of o.rotation) if (fresh(c)) add2(c);
  const rest = o.suite.filter(fresh);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  for (const c of rest) add2(c);
  if (out.length < 2) {
    for (const c of [...o.rotation, ...o.suite]) if (fits(c) && c.map === o.current) add2(c);
  }
  return out.length >= 2 ? out : [];
}
function tallyVotes(votes, options, host = null) {
  const counts = Array.from({ length: options }, () => 0);
  for (const i of votes.values()) if (i >= 0 && i < options) counts[i]++;
  const most = Math.max(0, ...counts);
  if (most === 0) return { winner: 0, counts, by: "none" };
  const tied = counts.flatMap((n, i) => n === most ? [i] : []);
  if (tied.length === 1) return { winner: tied[0], counts, by: "votes" };
  const mine = host === null ? void 0 : votes.get(host);
  if (mine !== void 0 && tied.includes(mine)) return { winner: mine, counts, by: "host" };
  return { winner: tied[0], counts, by: "order" };
}
class MapVote {
  constructor(options, closeAt, host = null) {
    this.options = options;
    this.closeAt = closeAt;
    this.host = host;
    this.planned = closeAt;
  }
  options;
  closeAt;
  host;
  votes = /* @__PURE__ */ new Map();
  result = null;
  /** When it closes as planned (a held scoreboard may keep it open longer, never shorter). */
  planned;
  /**
   * Host handoff (net/handoff.ts CheckpointVote): the vote the old host had open, carried on by its successor:
   * the same ballot and votes (by their new slots), closing at `closeAt`, or already won (`won`: the old host's
   * result, which its own vote may have decided, so it isn't tallied again).
   */
  static resumed(options, closeAt, host, votes, won) {
    const v = new MapVote(options, closeAt, host);
    for (const [slot, i] of votes) if (Number.isInteger(i) && i >= 0 && i < options.length) v.votes.set(slot, i);
    if (won && won.w >= 0 && won.w < options.length) {
      const counts = tallyVotes(v.votes, options.length).counts;
      v.result = { winner: won.w, counts, by: won.by ?? "votes" };
    }
    return v;
  }
  /** Every vote cast so far: [slot, option index] (a handoff checkpoint carries them). */
  ballots() {
    return [...this.votes];
  }
  /** The ticks a vote takes, open to travel. */
  static ticks() {
    return (VOTE_SECONDS + VOTE_RESULT_SECONDS) * TICK_RATE;
  }
  get closed() {
    return this.result !== null;
  }
  /** The winning option once closed. */
  get winner() {
    return this.result ? this.options[this.result.winner] ?? null : null;
  }
  /** `slot` votes for option `i` (a later vote replaces an earlier one). False when closed or out of range. */
  cast(slot, i) {
    if (this.result || !Number.isInteger(i) || i < 0 || i >= this.options.length) return false;
    if (this.votes.get(slot) === i) return false;
    this.votes.set(slot, i);
    return true;
  }
  /** Someone left: their vote goes with them. */
  forget(slot) {
    return !this.result && this.votes.delete(slot);
  }
  /** What `slot` voted for (undefined: nothing yet). */
  voteOf(slot) {
    return this.votes.get(slot);
  }
  /**
   * Close the vote at `tick` if it's time; true the tick it closes. `holdUntil`: the match's intermission end (a
   * host or a test held the scoreboard longer): the vote stays open until the winner's moment before it.
   */
  tick(tick, holdUntil = null) {
    if (holdUntil !== null) this.closeAt = Math.max(this.planned, holdUntil - (VOTE_RESULT_SECONDS + 1) * TICK_RATE);
    if (this.result || tick < this.closeAt) return false;
    this.result = tallyVotes(this.votes, this.options.length, this.host);
    return true;
  }
  /** The vote as everyone's screen shows it. */
  state(tick) {
    const counts = this.result?.counts ?? tallyVotes(this.votes, this.options.length).counts;
    return {
      o: this.options.map((x) => ({ ...x })),
      n: counts,
      left: this.result ? 0 : Math.max(0, Math.ceil((this.closeAt - tick) / TICK_RATE)),
      ...this.result ? { w: this.result.winner, by: this.result.by } : {}
    };
  }
}
function parseVoteState(v) {
  if (!v || typeof v !== "object") return null;
  const o = v;
  if (!Array.isArray(o.o) || o.o.length < 2 || o.o.length > 4 || !Array.isArray(o.n) || o.n.length !== o.o.length) return null;
  const opts = [];
  for (const x of o.o) {
    const e = x;
    if (!e || typeof e.map !== "string" || typeof e.name !== "string" || typeof e.mode !== "string") return null;
    opts.push({ map: e.map.slice(0, 80), name: e.name.slice(0, 80), mode: e.mode });
  }
  const n = o.n.map((x) => typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0);
  const w = typeof o.w === "number" && Number.isInteger(o.w) && o.w >= 0 && o.w < opts.length ? o.w : void 0;
  const by = o.by === "votes" || o.by === "host" || o.by === "order" || o.by === "none" ? o.by : void 0;
  return { o: opts, n, left: typeof o.left === "number" && Number.isFinite(o.left) ? Math.max(0, Math.min(120, Math.round(o.left))) : 0, ...w !== void 0 ? { w } : {}, ...by ? { by } : {} };
}
const EARLY_QUIT_MINUTES = 2;
const MAX_REPORTED_PLAYERS = 96;
function targetLabel(name, wearing, roulette) {
  return roulette && wearing && wearing.toLowerCase() !== name.toLowerCase() ? `${name} · ${wearing}` : name;
}
const escapeHtml$5 = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
class MapVoteHud {
  constructor(vote, picture = () => null) {
    this.vote = vote;
    this.picture = picture;
    const host = document.getElementById("hud") ?? document.body;
    this.panel = document.createElement("div");
    this.panel.id = "map-vote";
    this.panel.hidden = true;
    this.panel.setAttribute("role", "group");
    this.panel.setAttribute("aria-label", "Vote for the next map");
    host.append(this.panel);
    window.addEventListener("keydown", this.onKey, { capture: true });
    this.panel.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]");
      if (b && !b.disabled) this.cast(Number(b.dataset.i));
    });
  }
  vote;
  picture;
  panel;
  state = null;
  /** Your vote, as you cast it (the host's count follows a moment later). */
  mine = null;
  onKey = (e) => {
    if (!this.open || this.state?.w !== void 0 || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = /^(?:Digit|Numpad)([1-4])$/.exec(e.code)?.[1];
    if (!n) return;
    const i = Number(n) - 1;
    if (i >= (this.state?.o.length ?? 0)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.cast(i);
  };
  get open() {
    return !!this.state && !this.panel.hidden;
  }
  /** The vote as the host sends it (null: over). */
  update(v) {
    const fresh = !!v && (!this.state || this.state.o.map((o) => o.map).join() !== v.o.map((o) => o.map).join());
    if (fresh || !v) this.mine = null;
    this.state = v;
    this.render();
  }
  /** The leading map now (the winner once closed), for the scoreboard's "Next map" line. */
  leader() {
    const s = this.state;
    if (!s) return null;
    const i = s.w ?? s.n.reduce((best, n, k) => n > (s.n[best] ?? 0) ? k : best, 0);
    const o = s.o[i];
    return o ? { map: o.name, mode: o.mode } : null;
  }
  cast(i) {
    if (!this.state || this.state.w !== void 0) return;
    this.mine = i;
    this.vote(i);
    this.render();
  }
  /** The ballot drawn for (its maps): the cards are built once and updated in place, so a tap never lands on a card being replaced. */
  built = "";
  render() {
    const s = this.state;
    this.panel.hidden = !s;
    document.getElementById("hud")?.classList.toggle("vote-on", !!s);
    if (!s) {
      this.built = "";
      return void this.panel.replaceChildren();
    }
    const key = s.o.map((o) => `${o.map}:${o.mode}`).join();
    if (key !== this.built) {
      this.built = key;
      const cards = s.o.map((o, i) => {
        const pic = this.picture(o.map);
        return `<button type="button" class="mv-card" data-i="${i}" data-map="${escapeHtml$5(o.map)}"><span class="mv-pic"${pic ? ` style="background-image:url('${encodeURI(pic)}')"` : ""}><kbd>${i + 1}</kbd></span><span class="mv-name">${escapeHtml$5(o.name)}</span><span class="mv-mode">${escapeHtml$5(MODE_LABELS[o.mode] ?? o.mode)}</span><span class="mv-votes"><i></i><b></b><span></span></span></button>`;
      }).join("");
      this.panel.innerHTML = `<div class="mv-head"><h3></h3><span class="mv-left" aria-live="polite"></span></div><div class="mv-cards">${cards}</div><p class="mv-hint"></p>`;
    }
    const done = s.w !== void 0;
    const total = s.n.reduce((a, b) => a + b, 0);
    const set = (el2, text) => {
      if (el2 && el2.textContent !== text) el2.textContent = text;
    };
    const h3 = this.panel.querySelector("h3");
    const title = done ? `Next map: ${s.o[s.w]?.name ?? ""}` : "Vote for the next map";
    if (h3.dataset.t !== title) {
      h3.dataset.t = title;
      h3.innerHTML = done ? `Next map: <b>${escapeHtml$5(s.o[s.w]?.name ?? "")}</b>` : "Vote for the next map";
    }
    set(this.panel.querySelector(".mv-left"), done ? `${s.by === "host" ? "Tie: the host decided · " : s.by === "order" ? "Tie · " : s.by === "none" ? "No votes · " : ""}Loading in ${VOTE_RESULT_SECONDS} s` : `${s.left} s`);
    this.panel.querySelectorAll(".mv-card").forEach((b, i) => {
      b.classList.toggle("mine", this.mine === i);
      b.classList.toggle("won", done && s.w === i);
      b.classList.toggle("lost", done && s.w !== i);
      b.disabled = done;
      b.setAttribute("aria-pressed", String(this.mine === i));
      const n = s.n[i] ?? 0;
      b.querySelector(".mv-votes i").style.width = `${total ? Math.round(n / total * 100) : 0}%`;
      set(b.querySelector(".mv-votes b"), String(n));
      set(b.querySelector(".mv-votes span"), n === 1 ? "vote" : "votes");
    });
    const hint = this.panel.querySelector(".mv-hint");
    hint.hidden = done;
    set(hint, this.mine === null ? `Press 1-${s.o.length}, click or tap a map` : "Voted: change it any time until the vote closes");
    this.panel.classList.toggle("closed", done);
    this.layout();
  }
  /** The scoreboard and the awards make room above the cards (style.css `vote-on`). */
  layout() {
    const hud = document.getElementById("hud");
    if (!hud) return;
    hud.style.setProperty("--vote-h", `${this.panel.offsetHeight + 16}px`);
    const aw = document.getElementById("match-awards");
    hud.style.setProperty("--awards-h", aw && !aw.hidden && aw.offsetHeight ? `${aw.offsetHeight + 8}px` : "0px");
  }
  /** For tests: what the panel shows. */
  debug() {
    const s = this.state;
    return { open: this.open, maps: s?.o.map((o) => o.map) ?? [], votes: s?.n ?? [], left: s?.left ?? 0, mine: this.mine, winner: s && s.w !== void 0 ? s.o[s.w]?.map ?? null : null };
  }
  dispose() {
    window.removeEventListener("keydown", this.onKey, { capture: true });
    document.getElementById("hud")?.classList.remove("vote-on");
    this.panel.remove();
  }
}
const PORTAL_NEAR = 2.5;
const TELEPORT = 3;
const PAD_COOLDOWN_MS = 900;
class GameplayFxWatch {
  constructor(pads, portals, play) {
    this.pads = pads;
    this.portals = portals;
    this.play = play;
  }
  pads;
  portals;
  play;
  seen = /* @__PURE__ */ new Map();
  update(poses, now = performance.now()) {
    for (const p of poses) {
      const s = this.seen.get(p.slot);
      if (!s) {
        this.seen.set(p.slot, { x: p.x, y: p.y, z: p.z, alive: p.alive, grounded: p.grounded, zip: p.zip, pad: -Infinity });
        continue;
      }
      if (p.alive && !s.alive) this.play("spawn", { x: p.x, y: p.y + 0.1, z: p.z });
      else if (p.alive) {
        const jump = Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z);
        if (jump > TELEPORT && this.portals.some((q) => Math.hypot(q.pos.x - s.x, q.pos.z - s.z) < PORTAL_NEAR)) {
          this.play("portal", { x: s.x, y: s.y + 1, z: s.z });
          this.play("portal", { x: p.x, y: p.y + 1, z: p.z });
        }
        if (s.grounded && !p.grounded && p.y >= s.y && now - s.pad > PAD_COOLDOWN_MS) {
          const pad = this.pads.find((q) => Math.hypot(q.pos.x - s.x, q.pos.z - s.z) <= PAD_RADIUS && Math.abs(q.pos.y - s.y) < 0.8);
          if (pad) {
            s.pad = now;
            this.play("pad", { x: pad.pos.x, y: pad.pos.y + 0.1, z: pad.pos.z });
          }
        }
        if (p.zip !== void 0 && s.zip === void 0) this.play("zipline", { x: p.x, y: p.y + 2.1, z: p.z });
      }
      s.x = p.x;
      s.y = p.y;
      s.z = p.z;
      s.alive = p.alive;
      s.grounded = p.grounded;
      s.zip = p.zip;
    }
  }
  forget(slot) {
    this.seen.delete(slot);
  }
}
const PARTY_COLOR = "#3ad1ff";
function ffaPartyMate(roster, self, slot) {
  if (slot === self) return false;
  const me = roster.get(self);
  const them = roster.get(slot);
  return !!me?.py && !me.bot && !me.team && !!them && !them.bot && !them.team && them.py === me.py;
}
const PX_PER_M = 5;
const RANGE_M = 26;
class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext("2d");
  }
  canvas;
  plan = null;
  /** The plan as an image bitmap once made (immutable, kept on the GPU: drawing it is a texture draw, not a copy). */
  planImage = null;
  /** What the last draw showed (redrawn only when it would differ). */
  last = "";
  /** The same for the whole-map view (drawWhole). */
  lastWhole = "";
  origin = { x: 0, z: 0, h: 0 };
  /** The play area, in world metres: what the whole-map view fits (setMap). */
  focus = { x0: 0, z0: 0, x1: 1, z1: 1 };
  g;
  setMap(map) {
    const boxes = buildMapGeometry(map);
    let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const b of boxes) {
      x0 = Math.min(x0, b.min[0]);
      z0 = Math.min(z0, b.min[2]);
      x1 = Math.max(x1, b.max[0]);
      z1 = Math.max(z1, b.max[2]);
    }
    const plan = document.createElement("canvas");
    plan.width = Math.ceil((x1 - x0) * PX_PER_M);
    plan.height = Math.ceil((z1 - z0) * PX_PER_M);
    const g = plan.getContext("2d");
    const h = plan.height;
    const px = (x) => (x - x0) * PX_PER_M;
    const py = (z) => h - (z - z0) * PX_PER_M;
    if (map.terrain) {
      g.globalAlpha = 0.85;
      drawTerrainPlan(g, map.terrain, px, py, PX_PER_M);
      g.globalAlpha = 1;
    }
    const buried = buriedTiles(map);
    const seen2 = (b) => !buried.has(b.sourceId);
    g.fillStyle = "rgba(42, 58, 85, 0.95)";
    for (const b of boxes) if (b.kind === "floor" && b.max[1] < 1 && seen2(b)) fillBox(g, b, px, py);
    g.fillStyle = "rgba(138, 106, 63, 0.9)";
    for (const b of boxes) if ((b.kind === "solid" || b.kind === "prop") && b.min[1] < 1 && seen2(b)) fillBox(g, b, px, py);
    g.fillStyle = "#9fb6d8";
    for (const b of boxes) if (b.kind === "wall" && b.min[1] < 1 && seen2(b)) fillBox(g, b, px, py);
    drawBuriedPassages(g, map, px, py, Math.max(1, PX_PER_M * 0.25));
    this.plan = plan;
    this.planImage?.close();
    this.planImage = null;
    this.last = "";
    this.lastWhole = "";
    this.origin = { x: x0, z: z0, h };
    let [fx0, fz0, fx1, fz1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const e of map.entities) {
      if (e.kind !== "spawn" && e.kind !== "flag" && e.kind !== "hill" && e.kind !== "pickup" && e.kind !== "mount") continue;
      fx0 = Math.min(fx0, e.position[0]);
      fz0 = Math.min(fz0, e.position[2]);
      fx1 = Math.max(fx1, e.position[0]);
      fz1 = Math.max(fz1, e.position[2]);
    }
    const pad = 16;
    this.focus = fx1 > fx0 && fz1 > fz0 ? { x0: Math.max(x0, fx0 - pad), z0: Math.max(z0, fz0 - pad), x1: Math.min(x1, fx1 + pad), z1: Math.min(z1, fz1 + pad) } : { x0, z0, x1, z1 };
    if (typeof createImageBitmap === "function") {
      void createImageBitmap(plan).then(
        (bmp) => {
          if (this.plan === plan) {
            this.planImage = bmp;
            this.last = "";
            this.lastWhole = "";
          } else bmp.close();
        },
        () => void 0
      );
    }
  }
  /**
   * The whole map at once on a larger canvas (M in a match): north up, the plan fitted to the canvas, you as an arrow
   * turned the way you face, teammates as dots and objectives as labelled squares where they are.
   */
  drawWhole(canvas, x, z, yaw, blips) {
    const g = canvas.getContext("2d");
    const src = this.planImage ?? this.plan;
    if (!g || !src) return;
    let key = `${canvas.width}x${canvas.height},${Math.round(x)},${Math.round(z)},${Math.round(yaw * 20)}`;
    for (const b of blips) key += `|${Math.round(b.x)},${Math.round(b.z)},${b.color},${b.label ?? ""}`;
    if (key === this.lastWhole) return;
    this.lastWhole = key;
    const pad = 14;
    const f = this.focus;
    const sx = (f.x0 - this.origin.x) * PX_PER_M;
    const sy = this.origin.h - (f.z1 - this.origin.z) * PX_PER_M;
    const sw = (f.x1 - f.x0) * PX_PER_M;
    const sh = (f.z1 - f.z0) * PX_PER_M;
    const scale2 = Math.min((canvas.width - pad * 2) / sw, (canvas.height - pad * 2) / sh);
    const ox = (canvas.width - sw * scale2) / 2 - sx * scale2;
    const oy = (canvas.height - sh * scale2) / 2 - sy * scale2;
    const at = (wx, wz) => [ox + (wx - this.origin.x) * PX_PER_M * scale2, oy + (this.origin.h - (wz - this.origin.z) * PX_PER_M) * scale2];
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = "rgba(11, 15, 26, 0.88)";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.imageSmoothingEnabled = true;
    g.save();
    g.beginPath();
    g.rect(pad / 2, pad / 2, canvas.width - pad, canvas.height - pad);
    g.clip();
    g.drawImage(src, ox, oy, src.width * scale2, src.height * scale2);
    g.restore();
    for (const b of blips) {
      const [bx, by] = at(b.x, b.z);
      g.fillStyle = b.color;
      if (b.label !== void 0) {
        g.fillRect(bx - 9, by - 9, 18, 18);
        g.fillStyle = "#0b0f1a";
        g.font = "bold 11px sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(b.label.slice(0, 2), bx, by + 0.5);
        continue;
      }
      g.beginPath();
      g.arc(bx, by, b.ring ? 6 : 4.5, 0, Math.PI * 2);
      g.fill();
      if (b.ring) {
        g.strokeStyle = "#0b0f1a";
        g.lineWidth = 2;
        g.stroke();
      }
    }
    const [mx, my] = at(x, z);
    g.save();
    g.translate(mx, my);
    g.rotate(yaw);
    g.fillStyle = "#00d1ff";
    g.strokeStyle = "#0b0f1a";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -11);
    g.lineTo(7, 8);
    g.lineTo(0, 4);
    g.lineTo(-7, 8);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
  update(x, z, yaw, blips) {
    const g = this.g;
    if (!g || !this.plan) return;
    let key = `${Math.round(x * PX_PER_M)},${Math.round(z * PX_PER_M)},${Math.round(yaw * 200)}`;
    for (const b of blips) key += `|${Math.round(b.x * 2)},${Math.round(b.z * 2)},${b.color},${b.label ?? ""},${b.ring ? 1 : 0}`;
    if (key === this.last) return;
    this.last = key;
    const size = this.canvas.width;
    const r = size / 2;
    const scale2 = r / (RANGE_M * PX_PER_M);
    const toPlan = (wx, wz) => [(wx - this.origin.x) * PX_PER_M, this.origin.h - (wz - this.origin.z) * PX_PER_M];
    g.clearRect(0, 0, size, size);
    g.save();
    g.beginPath();
    g.arc(r, r, r - 1, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = "rgba(11, 15, 26, 0.82)";
    g.fillRect(0, 0, size, size);
    g.translate(r, r);
    g.rotate(-yaw);
    g.scale(scale2, scale2);
    const [px, py] = toPlan(x, z);
    g.translate(-px, -py);
    const src = this.planImage ?? this.plan;
    const reach = Math.ceil(RANGE_M * PX_PER_M * Math.SQRT2) + 2;
    const sx = Math.max(0, Math.floor(px - reach));
    const sy = Math.max(0, Math.floor(py - reach));
    const sw = Math.min(src.width, Math.ceil(px + reach)) - sx;
    const sh = Math.min(src.height, Math.ceil(py + reach)) - sy;
    if (sw > 0 && sh > 0) g.drawImage(src, sx, sy, sw, sh, sx, sy, sw, sh);
    for (const b of blips) {
      if (b.label !== void 0) continue;
      const [bx, by] = toPlan(b.x, b.z);
      g.fillStyle = b.color;
      g.beginPath();
      g.arc(bx, by, (b.ring ? 5.5 : 4.5) / scale2, 0, Math.PI * 2);
      g.fill();
      if (b.ring) {
        g.strokeStyle = "#0b0f1a";
        g.lineWidth = 2 / scale2;
        g.stroke();
      }
    }
    g.restore();
    for (const b of blips) {
      if (b.label === void 0) continue;
      const dx = b.x - x;
      const dz = b.z - z;
      const ahead = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
      const px2 = PX_PER_M * scale2;
      let sx2 = right * px2;
      let sy2 = -ahead * px2;
      const d = Math.hypot(sx2, sy2);
      const rim = r - 10;
      if (d > rim) {
        sx2 = sx2 / d * rim;
        sy2 = sy2 / d * rim;
      }
      g.fillStyle = b.color;
      g.fillRect(r + sx2 - 7, r + sy2 - 7, 14, 14);
      g.fillStyle = "#0b0f1a";
      g.font = "bold 9px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(b.label.slice(0, 2), r + sx2, r + sy2 + 0.5);
    }
    g.fillStyle = "#00d1ff";
    g.beginPath();
    g.moveTo(r, r - 9);
    g.lineTo(r + 6, r + 7);
    g.lineTo(r, r + 3);
    g.lineTo(r - 6, r + 7);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(0, 209, 255, 0.55)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(r, r, r - 1.5, 0, Math.PI * 2);
    g.stroke();
  }
}
const BOARD_COL_MIN = 230;
function boardLayout(data, width) {
  const players = data.groups.reduce((n2, g) => n2 + g.rows.length, 0);
  const fit = Math.max(1, Math.floor(width / BOARD_COL_MIN));
  const dense = players > 24 || data.groups.some((g) => g.rows.length > 12);
  if (data.kind === "coop") return { name: "coop", cols: 1, dense: players > 16, tall: -1 };
  if (data.kind === "ffa") {
    const want = players <= 12 ? 1 : players <= 36 ? 2 : 3;
    const cols = Math.max(1, Math.min(want, fit));
    return { name: "ffa", cols, dense: Math.ceil(players / cols) > 12, tall: -1 };
  }
  const n = data.groups.length;
  if (n <= 2) return { name: "t2", cols: 2, dense, tall: -1 };
  const tall = tallTeam(data.groups);
  if (n <= 4) return { name: "t4", cols: 2, dense: dense || n > 2, tall };
  return { name: "tn", cols: Math.max(2, Math.min(4, n, Math.floor(width / 190))), dense: true, tall };
}
function tallTeam(groups) {
  if (groups.length < 3) return -1;
  let big = -1;
  let next = 0;
  groups.forEach((g, i) => {
    const n = g.rows.length;
    if (big < 0 || n > groups[big].rows.length) {
      if (big >= 0) next = Math.max(next, groups[big].rows.length);
      big = i;
    } else next = Math.max(next, n);
  });
  const size = groups[big].rows.length;
  return size > 6 && size >= next * 2 ? big : -1;
}
function ffaColumns(rows, cols) {
  const per = Math.max(1, Math.ceil(rows.length / cols));
  const out = [];
  for (let i = 0; i < rows.length; i += per) out.push(rows.slice(i, i + per));
  return out.length ? out : [[]];
}
const make = (tag, cls, text = "") => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
};
class ScoreBoard {
  /**
   * `maxWidth`: the most room the board may take (px); it uses less when the
   * window is narrower. `sizeSelf`: set its own width from the layout (the HUD
   * overlay), else fill the container (pause menu).
   */
  constructor(root, opts) {
    this.root = root;
    this.opts = opts;
  }
  root;
  opts;
  head = null;
  note = null;
  body = null;
  groups = [];
  rows = /* @__PURE__ */ new Map();
  /** Fireteams' squad lines, by `team:squad`. */
  squadEls = /* @__PURE__ */ new Map();
  shape = "";
  /** Which optional cells the rows have (set with the layout). */
  cells = { rank: false, cls: false, obj: false, ping: false, pts: false };
  /** Forget the DOM (the container was emptied, or a new match starts). */
  clear() {
    this.root.replaceChildren();
    this.head = this.note = this.body = null;
    this.groups = [];
    this.rows.clear();
    this.squadEls.clear();
    this.shape = "";
  }
  render(data) {
    const width = Math.min(this.opts.maxWidth, (window.innerWidth || this.opts.maxWidth) * 0.96 - 24);
    const layout = boardLayout(data, width);
    const columns = data.kind === "ffa" ? ffaColumns(data.groups[0]?.rows ?? [], layout.cols) : data.groups.map((g) => g.rows);
    const flags = `${data.cls ? 1 : 0}${data.obj ?? "-"}${data.ping ? 1 : 0}${data.pts ? 1 : 0}`;
    const shape = `${layout.name}|${layout.cols}|${layout.dense}|${layout.tall}|${flags}|${data.kind === "ffa" ? columns.length : data.groups.map((g) => g.id).join(",")}`;
    if (shape !== this.shape || !this.body || this.body.parentNode !== this.root) this.build(data, layout, columns.length, shape);
    if (this.head.textContent !== data.head) this.head.textContent = data.head;
    const note = data.note ?? "";
    if (this.note.textContent !== note) this.note.textContent = note;
    this.note.hidden = !note;
    if (data.kind === "teams") {
      data.groups.forEach((g, i) => {
        const ge = this.groups[i];
        if (ge.name.textContent !== g.name) ge.name.textContent = g.name;
        const score = String(g.score);
        if (ge.score.textContent !== score) ge.score.textContent = score;
        ge.score.classList.toggle("lead", g.lead && data.groups.length > 1);
      });
    }
    const seen2 = /* @__PURE__ */ new Set();
    let rank = 0;
    const squadsSeen = /* @__PURE__ */ new Set();
    columns.forEach((rows, i) => {
      const ge = this.groups[i];
      const want = [ge.hd];
      const squads = data.kind === "teams" ? data.groups[i]?.squads : void 0;
      const add2 = (r) => {
        rank++;
        seen2.add(r.slot);
        want.push(this.row(r, data.kind === "ffa" ? rank : 0).el);
      };
      if (squads) {
        for (const q of squads) {
          const key = `${data.groups[i].id}:${q.id}`;
          squadsSeen.add(key);
          want.push(this.squadLine(key, q).el);
          for (const r of q.rows) add2(r);
        }
      } else for (const r of rows) add2(r);
      const have = ge.list.children;
      let same2 = have.length === want.length;
      for (let j = 0; same2 && j < want.length; j++) same2 = have[j] === want[j];
      if (!same2) ge.list.replaceChildren(...want);
    });
    for (const [slot, r] of this.rows) {
      if (seen2.has(slot)) continue;
      r.el.remove();
      this.rows.delete(slot);
    }
    for (const [key, q] of this.squadEls) {
      if (squadsSeen.has(key)) continue;
      q.el.remove();
      this.squadEls.delete(key);
    }
  }
  /** A squad's line (Fireteams): its name, its MVP at the end, its points; patched in place. */
  squadLine(key, q) {
    let e = this.squadEls.get(key);
    if (!e) {
      const el2 = make("div", "sb-squad");
      el2.dataset.squad = String(q.id);
      e = { el: el2, name: make("span", "sb-sqname"), mvp: make("span", "sb-sqmvp"), points: make("b", "sb-sqpts"), key: "" };
      el2.append(e.name, e.mvp, e.points);
      this.squadEls.set(key, e);
    }
    const k = `${q.name}|${q.points}|${q.mvp}|${q.best ? 1 : 0}|${q.mine ? 1 : 0}`;
    if (k === e.key) return e;
    e.key = k;
    e.name.textContent = q.name;
    e.name.title = q.id >= 0 ? `${q.name}'s squad` : "Joining a squad";
    e.mvp.textContent = q.mvp ? `MVP ${q.mvp}` : "";
    e.mvp.title = q.mvp ? `Squad MVP: ${q.mvp}` : "";
    e.mvp.hidden = !q.mvp;
    e.points.textContent = String(q.points);
    e.points.title = "Squad points: a kill 10, an assist 5, an objective 30, a second on the hill 1";
    e.el.classList.toggle("best", q.best);
    e.el.classList.toggle("mine", q.mine);
    e.el.title = q.best ? "Best Squad" : "";
    return e;
  }
  build(data, layout, count, shape) {
    this.root.replaceChildren();
    this.rows.clear();
    this.shape = shape;
    this.cells = { rank: data.kind === "ffa", cls: data.cls, obj: !!data.obj, ping: data.ping, pts: !!data.pts };
    this.squadEls.clear();
    this.root.classList.remove("sb-t2", "sb-t4", "sb-tn", "sb-ffa", "sb-coop", "sb-dense");
    this.root.classList.add("sb", `sb-${layout.name}`);
    this.root.classList.toggle("sb-dense", layout.dense);
    this.root.style.setProperty("--sb-cols", String(layout.cols));
    const tpl = [data.kind === "ffa" ? "2.1em" : "", "minmax(0, 1fr)", data.cls ? "minmax(0, 5.6em)" : "", "2.3em", "2.3em", data.obj ? "3.1em" : "", data.pts ? "2.9em" : "", data.ping ? "2.9em" : ""].filter(Boolean).join(" ");
    this.root.style.setProperty("--sb-tpl", tpl);
    if (this.opts.sizeSelf) this.root.style.width = `min(${Math.round(layout.cols * (layout.name === "tn" ? 270 : 330) + 32)}px, 96vw)`;
    this.head = make("div", "sb-head");
    this.note = make("div", "sb-note");
    this.body = make("div", "sb-body");
    this.groups = [];
    for (let i = 0; i < count; i++) {
      const g = data.kind === "teams" ? data.groups[i] : null;
      const el2 = make("section", g ? "sb-group" : "sb-group sb-col");
      el2.dataset.group = g?.id ?? `col${i}`;
      let name = null;
      let score = null;
      if (g && i === layout.tall) {
        el2.style.gridColumn = String(layout.cols);
        el2.style.gridRow = `1 / span ${Math.max(1, Math.ceil((count - 1) / (layout.cols - 1)))}`;
      }
      if (g) {
        el2.style.setProperty("--team", g.color);
        const top = make("header", "sb-ghead");
        name = make("span", "sb-gname");
        score = make("b", "sb-gscore");
        top.append(name, score);
        el2.append(top);
      }
      const list = make("div", "sb-list");
      const hd = make("div", "sb-row sb-hd");
      const th = (cls, text, title = "") => {
        const c = make("span", cls, text);
        if (title) c.title = title;
        hd.append(c);
      };
      if (data.kind === "ffa") th("sb-rank", "#", "Rank");
      th("sb-name", data.kind === "teams" ? "Player" : data.kind === "coop" ? "Squad" : "Player");
      if (data.cls) th("sb-cls", "Class");
      th("sb-n", "K", "Kills");
      th("sb-n", "D", "Deaths");
      if (data.obj) th("sb-n", data.obj);
      if (data.pts) th("sb-n", "Pts", "Squad points: a kill 10, an assist 5, an objective 30, a second on the hill 1");
      if (data.ping) th("sb-n", "Ping", "Round trip (ms)");
      list.append(hd);
      el2.append(list);
      this.body.append(el2);
      this.groups.push({ el: el2, name, score, list, hd });
    }
    this.root.append(this.head, this.note, this.body);
  }
  /** The row for a player, patched to `r` (only the cells that changed). */
  row(r, rank) {
    let e = this.rows.get(r.slot);
    if (!e) {
      const el2 = make("div", "sb-row");
      el2.dataset.slot = String(r.slot);
      const rk = make("span", "sb-rank");
      const nameCell = make("span", "sb-name");
      const mark = make("i", "sb-mark");
      const name = make("span", "sb-nm");
      nameCell.append(mark, name);
      e = { el: el2, rank: rk, mark, name, cls: make("span", "sb-cls"), k: make("span", "sb-n"), d: make("span", "sb-n"), obj: make("span", "sb-n"), ping: make("span", "sb-n sb-ping"), pts: make("span", "sb-n sb-pts"), key: "" };
      const f = this.cells;
      if (f.rank) el2.append(rk);
      el2.append(nameCell);
      if (f.cls) el2.append(e.cls);
      el2.append(e.k, e.d);
      if (f.obj) el2.append(e.obj);
      if (f.pts) el2.append(e.pts);
      if (f.ping) el2.append(e.ping);
      this.rows.set(r.slot, e);
    }
    const key = `${rank}|${r.name}|${r.bot}|${r.who ?? ""}|${r.color}|${r.cls}|${r.k}|${r.d}|${r.obj}|${r.ping}|${r.pts ?? ""}|${r.squadLead ? 1 : 0}|${r.leader}|${r.dead}|${r.me}|${r.party ? 1 : 0}`;
    if (key === e.key) return e;
    e.key = key;
    const set = (el2, text) => {
      if (el2.textContent !== text) el2.textContent = text;
    };
    set(e.rank, rank ? String(rank) : "");
    set(e.name, r.name);
    e.name.classList.toggle("bot", r.bot);
    e.name.classList.toggle("acct", r.who === "acct");
    e.name.classList.toggle("guest", r.who === "guest");
    e.name.classList.toggle("party", !!r.party);
    e.name.title = [r.party ? "In your party" : "", r.who === "acct" ? "Signed in: a verified account" : r.who === "guest" ? "Guest: not signed in, so the name is just what they typed" : ""].filter(Boolean).join(" · ");
    set(e.mark, r.leader ? "★" : r.squadLead ? "◆" : "●");
    e.mark.style.color = r.leader ? "" : r.color;
    e.mark.classList.toggle("leader", r.leader);
    e.mark.title = r.leader ? "Team leader" : r.squadLead ? "Squad leader" : "";
    set(e.pts, r.pts ?? "");
    set(e.cls, r.cls);
    set(e.k, String(r.k));
    set(e.d, String(r.d));
    set(e.obj, r.obj);
    set(e.ping, r.ping);
    e.el.classList.toggle("me", r.me);
    e.el.classList.toggle("dead", r.dead);
    return e;
  }
}
function squadHonours(aw) {
  const out = { mvp: /* @__PURE__ */ new Map(), best: null };
  for (const a of aw) {
    if (a[0] === "squadmvp") out.mvp.set(a[3], { slot: a[1], points: a[2] });
    else if (a[0] === "bestsquad") out.best = a[3];
  }
  return out;
}
function readSquads(fs) {
  return fs ? fs.map(readSquad) : [];
}
function squadGroups(rows, squads, team, me, honours, name) {
  const bySlot = new Map(rows.map((r) => [r.slot, r]));
  const used = /* @__PURE__ */ new Set();
  const pts = (r) => Number(r.pts) || 0;
  const order = (a, b) => pts(b) - pts(a) || b.k - a.k || a.d - b.d || a.slot - b.slot;
  const out = [];
  for (const q of [...squads].filter((s) => s.team === team).sort((a, b) => Number(b.members.includes(me)) - Number(a.members.includes(me)) || b.points - a.points || a.id - b.id)) {
    const list = q.members.map((m) => bySlot.get(m)).filter((r) => !!r && !used.has(r.slot));
    if (!list.length) continue;
    for (const r of list) used.add(r.slot);
    const lead = q.leader >= 0 ? q.leader : null;
    const mvp = honours.mvp.get(q.id);
    out.push({
      id: q.id,
      name: lead !== null ? name(lead) : "Squad",
      points: q.points,
      mvp: mvp ? name(mvp.slot) : "",
      best: honours.best === q.id,
      mine: q.members.includes(me),
      rows: list.map((r) => r.slot === lead ? { ...r, squadLead: true } : r).sort(order)
    });
  }
  const loose = rows.filter((r) => !used.has(r.slot));
  if (loose.length) out.push({ id: -1, name: "Joining", points: 0, mvp: "", best: false, mine: loose.some((r) => r.slot === me), rows: [...loose].sort(order) });
  return out;
}
const HURT_LOOKS = {
  classic: { inner: 0.55, color: [200, 0, 0], alpha: 0.55 },
  calm: { inner: 0.62, color: [118, 50, 44], alpha: 0.5 }
};
const CALM_HURT = { peak: 0.75, rise: 0.15, hold: 0.35, fall: 0.8 };
const CLASSIC_HOLD = 0.09;
const CLASSIC_FADE = 0.6;
class HurtFade {
  level = 0;
  peak = 0;
  lastHit = -Infinity;
  at = 0;
  /** A hit of `amount` (health and armour lost) at `now` (ms). */
  hit(amount, now) {
    const strength = Math.min(1, 0.45 + amount / 40);
    this.peak = now - this.lastHit < CALM_HURT.hold * 1e3 ? Math.max(this.peak, strength) : strength;
    this.lastHit = now;
    this.sinceHit = strength;
  }
  /** The newest hit's own strength (classic). */
  sinceHit = 0;
  /** The strength at `now` (ms), `calm` with Reduce flashing on. */
  update(now, calm) {
    const dt = Math.min(0.1, Math.max(0, (now - (this.at || now)) / 1e3));
    this.at = now;
    const t = (now - this.lastHit) / 1e3;
    if (calm) {
      const want = t < CALM_HURT.hold ? this.peak * CALM_HURT.peak : 0;
      this.level = ease(this.level, want, dt, 1 / CALM_HURT.rise, 1 / CALM_HURT.fall);
    } else if (t < CLASSIC_HOLD) this.level = this.sinceHit;
    else {
      const x = Math.min(1, (t - CLASSIC_HOLD) / CLASSIC_FADE);
      this.level = this.sinceHit * (1 - x) * (1 - x);
    }
    return this.level;
  }
}
function paintVignette(look, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const mid = size / 2;
  const g = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid * Math.SQRT2);
  const [r, gr, b] = look.color;
  g.addColorStop(0, `rgba(${r}, ${gr}, ${b}, 0)`);
  g.addColorStop(look.inner, `rgba(${r}, ${gr}, ${b}, 0)`);
  g.addColorStop(1, `rgba(${r}, ${gr}, ${b}, ${look.alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}
const HEAVY_LOOK = { inner: 0.42, color: [34, 22, 12], alpha: 0.82 };
const CALM_HEAVY = { peak: 0.6, rise: 0.15, hold: 0.1, fall: 0.8 };
const HEAVY_FADE = 0.45;
class HeavyFade {
  level = 0;
  lastHit = -Infinity;
  at = 0;
  strength = 0;
  /** A heavy hit of `amount` damage at `now` (ms). */
  hit(amount, now) {
    this.strength = Math.min(1, 0.55 + amount / 200);
    this.lastHit = now;
  }
  update(now, calm) {
    const dt = Math.min(0.1, Math.max(0, (now - (this.at || now)) / 1e3));
    this.at = now;
    const t = (now - this.lastHit) / 1e3;
    if (calm) this.level = ease(this.level, t < CALM_HEAVY.hold ? this.strength * CALM_HEAVY.peak : 0, dt, 1 / CALM_HEAVY.rise, 1 / CALM_HEAVY.fall);
    else this.level = t < HEAVY_FADE ? this.strength * (1 - t / HEAVY_FADE) ** 2 : 0;
    return this.level;
  }
}
const FEED_LINES = 5;
const SHORT_FEED_LINES = 3;
const SHORT_SCREEN = 480;
function feedLines(touch, height) {
  return touch && height <= SHORT_SCREEN ? SHORT_FEED_LINES : FEED_LINES;
}
const $$2 = (id) => document.getElementById(id);
const hpColor = (pct2) => pct2 > 55 ? "var(--success)" : pct2 > 25 ? "#f0b429" : "var(--danger)";
const escapeHtml$4 = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const HAZARD_DEATHS = {
  "core.trap_spikes": "was impaled",
  "core.trap_flames": "was burned",
  "core.trap_crusher": "was crushed",
  "core.trap_mine": "stepped on a mine",
  "core.trap_laser": "was sliced by a laser",
  "core.trap_shock": "was electrocuted",
  "core.barrel": "was caught in a barrel blast",
  "core.fall": "fell",
  "core.fallback": "was left behind the line",
  "core.respawn": "respawned",
  "core.lava": "melted in lava",
  "core.acid": "dissolved in acid",
  "core.drown": "drowned",
  "core.wreck": "went up with a vehicle",
  "core.roadkill": "was run over"
};
const OTHER_LABELS = { "core.barrel": "Barrel", "core.wreck": "✹ Wreck", "core.roadkill": "Roadkill", "core.punch": "Punch", "core.kick": "Kick" };
const weaponLabel = (id) => CORE_WEAPONS[id]?.displayName ?? OTHER_LABELS[id] ?? "✕";
class Hud {
  root = $$2("hud");
  health = $$2("health");
  timer = $$2("timer");
  countdown = $$2("countdown");
  loading = $$2("loading-screen");
  goUntil = 0;
  modeLabel = $$2("mode-label");
  sbLeft = $$2("sb-left");
  sbRight = $$2("sb-right");
  healthBar = $$2("health-bar");
  armorBar = $$2("armor-bar");
  ammoReserve = $$2("ammo-reserve");
  portrait = $$2("hud-portrait");
  target = $$2("target");
  targetTimer;
  minimap = new Minimap($$2("minimap"));
  /** The two sides in Team Deathmatch; null in other modes. */
  teams = null;
  /** Objective modes: team scores (captures, hill seconds, rounds) in team order, replacing kill totals. */
  modeScores = null;
  modeStatus = $$2("mode-status");
  modeMarkers = $$2("mode-markers");
  lastModeStatus = "";
  lastTeamScore = "";
  feed = $$2("feed");
  banner = $$2("banner");
  scoreboard = $$2("scoreboard");
  board = new ScoreBoard(this.scoreboard, { maxWidth: 1240, sizeSelf: true });
  pauseBoard = null;
  /** Scoreboard facts from snapshots: who is alive, team leaders, online pings. */
  alive = /* @__PURE__ */ new Map();
  leaders = /* @__PURE__ */ new Set();
  pings = /* @__PURE__ */ new Map();
  /** The mode's per-player objective stat ('Caps', 'Bomb', 'Saves'), or null. */
  objLabel = null;
  /** Co-op and Zombies: everyone on one side, one list. */
  coop = false;
  perf = $$2("perf");
  hitmarker = $$2("hitmarker");
  armor = $$2("armor");
  weaponName = $$2("weapon-name");
  ammoCount = $$2("ammo-count");
  altEl = $$2("ammo-alt");
  throwEl = $$2("throwable");
  weaponBar = $$2("weapon-bar");
  powerups = $$2("powerups");
  pickupMsg = $$2("pickup-msg");
  scope = $$2("scope");
  objectives = $$2("objectives");
  message = $$2("message");
  prompt = $$2("prompt");
  scTimers = $$2("sc-timers");
  marker = $$2("marker");
  messageTimer;
  lastObjectives = "";
  lastPrompt = "";
  lastTimers = "";
  pickupTimer;
  lastWeaponBar = "";
  roster = /* @__PURE__ */ new Map();
  /** Hosting online: shown in the Tab scoreboard under its title (listed or code only, players, the join code). */
  onlineNote = "";
  /** At the end of a match: where the map rotation goes next ("Next map: Diamond Park (Capture the Flag)"), on the scoreboard. */
  nextMap = "";
  hitTimer;
  /** Classes: each player's class (CLASS_IDS index), from snapshots; and lines about your own class and power disc. */
  classes = /* @__PURE__ */ new Map();
  statusLines = [];
  lastClassMenu = "";
  show() {
    applyCrosshair();
    applyHitmarker();
    this.root.hidden = false;
  }
  hide() {
    this.root.hidden = true;
  }
  /** Clear per-match state left over from a previous session. */
  reset() {
    this.feed.replaceChildren();
    this.banner.textContent = "";
    this.timer.textContent = "";
    this.modeLabel.textContent = "";
    this.sbLeft.innerHTML = "";
    this.sbRight.innerHTML = "";
    this.lastTeamScore = "";
    this.showScorebar(true);
    this.portrait.removeAttribute("src");
    this.target.hidden = true;
    this.teams = null;
    this.modeScores = null;
    this.setModeStatus("");
    this.setModeMarkers([]);
    this.health.textContent = "";
    this.armor.textContent = "";
    this.weaponBar.innerHTML = "";
    this.lastWeaponBar = "";
    this.ammoCount.textContent = "";
    this.weaponName.textContent = "";
    this.powerups.innerHTML = "";
    this.scope.hidden = true;
    this.scoreboard.hidden = true;
    this.scoreboard.parentElement?.classList.remove("sb-up");
    this.board.clear();
    this.boardOpen = false;
    this.pauseBoard?.clear();
    this.alive.clear();
    this.leaders.clear();
    this.pings.clear();
    this.objLabel = null;
    this.coop = false;
    this.objectives.replaceChildren();
    this.lastObjectives = "";
    this.message.classList.remove("on");
    this.setPrompt(null);
    this.setTimers([]);
    this.marker.hidden = true;
    this.roster.clear();
    this.classes.clear();
    this.statusLines = [];
    this.setClassMenu(false, null);
    this.setSpectating(null);
    this.setKillCam(null);
    this.setWatching(false);
  }
  /** The match's mode, for the scoreboard: its objective column, and co-op as one list. */
  setBoardMode(mode) {
    this.objLabel = mode === "core.ctf" || mode === "core.forts" ? "Caps" : mode === "core.bomb" ? "Bomb" : mode === "core.hostage" ? "Saves" : mode === "core.breakthrough" ? "Obj" : null;
    this.coop = mode === "core.coop" || mode === "core.zombies";
  }
  /** Who is alive (from a snapshot; players a big match leaves out keep their last state). */
  setLife(players) {
    for (const p of players) this.alive.set(p.s, p.alive === 1);
  }
  /** Team leaders (rules.leaders), or none. */
  setLeaders(slots) {
    if (!slots?.length && !this.leaders.size) return;
    this.leaders = new Set((slots ?? []).filter((s) => s >= 0));
  }
  /** Online: each human's round trip, as flat [slot, ms, …]. */
  setPings(flat) {
    this.pings.clear();
    for (let i = 0; i + 1 < flat.length; i += 2) this.pings.set(flat[i], flat[i + 1]);
  }
  /** Classes: who plays what (for the scoreboard). */
  setClasses(players) {
    this.classes.clear();
    for (const p of players) if (p.cl !== void 0) this.classes.set(p.s, p.cl);
  }
  /** Lines over the vitals about your class's ability or a power disc (shown with the powerups). */
  setStatusLines(lines) {
    this.statusLines = lines;
  }
  /**
   * The class screen (Classes): every class with its keys, health and what it
   * does; your class and the one you asked for marked, full ones dimmed.
   * Clicking one picks it (when the pointer is free); so does its number key.
   */
  setClassMenu(open, menu) {
    let el2 = document.getElementById("class-menu");
    if (!open || !menu) {
      if (el2) el2.hidden = true;
      this.lastClassMenu = "";
      return;
    }
    const key = `${menu.current}|${menu.next}|${menu.full.join()}`;
    if (!el2) {
      el2 = document.createElement("div");
      el2.id = "class-menu";
      this.root.append(el2);
    }
    el2.hidden = false;
    if (key === this.lastClassMenu) return;
    this.lastClassMenu = key;
    const grid = document.createElement("div");
    grid.className = "grid";
    CLASS_IDS.forEach((id, i) => {
      const def = CLASS_DEFS[id];
      const b = document.createElement("button");
      b.className = [i === menu.current ? "on" : "", i === menu.next && menu.next !== menu.current ? "next" : "", menu.full[i] ? "full" : ""].filter(Boolean).join(" ");
      b.innerHTML = `<kbd>${i + 1}</kbd><b>${escapeHtml$4(def.name)}</b> · ${def.role} · ${def.health} HP${i === menu.current ? " · <em>playing</em>" : i === menu.next ? " · <em>next</em>" : menu.full[i] ? " · full" : ""}<small>${escapeHtml$4(def.blurb)}</small>`;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.pick(i);
      });
      grid.append(b);
    });
    el2.replaceChildren(Object.assign(document.createElement("b"), { textContent: "Choose your class" }), grid, Object.assign(document.createElement("small"), { textContent: "Number keys or click · L or , opens and closes this · a new class starts at your next spawn (straight away if you have only just spawned)" }));
  }
  /** Your own slot (the session sets it at the welcome): free-for-all parties' names (ffaParty.ts). */
  self = -1;
  /** The friendly colour your party's names wear in a free-for-all. */
  partyColor = PARTY_COLOR;
  /** A player's name colour: their team's, else (free-for-all) the friendly colour for your party, else their slot's. */
  nameColor(slot, self = this.self) {
    return this.team(slot)?.color ?? (ffaPartyMate(this.roster, self, slot) ? this.partyColor : slotColor(slot));
  }
  /** Free-for-all: whether `slot` is in your party (friendly name and marker). */
  partyMate(slot, self = this.self) {
    return ffaPartyMate(this.roster, self, slot);
  }
  setRoster(players) {
    this.roster = new Map(players.map((p) => [p.slot, p]));
  }
  setTeams(teams) {
    this.teams = teams;
  }
  /** Fireteams (Part 3): the snapshot's squads (`fs`; null: the variant is off), for the scoreboard's squads. */
  setSquads(fs) {
    this.squadsRaw = fs;
  }
  squadsRaw = null;
  /** Fireteams: the squad awards at the end of the match (each squad's MVP, the Best Squad); [] clears them. */
  setSquadAwards(aw) {
    this.honours = squadHonours(aw);
  }
  honours = { mvp: /* @__PURE__ */ new Map(), best: null };
  teamById(id) {
    return id ? this.teams?.find((t) => t.id === id) : void 0;
  }
  /** Team of a player slot in Team Deathmatch. */
  team(slot) {
    const id = this.roster.get(slot)?.team;
    return id ? this.teams?.find((t) => t.id === id) : void 0;
  }
  /** Objective mode scores in team order (null: team scores are kill totals). */
  setModeScores(scores) {
    this.modeScores = scores;
  }
  /** The line under the scorebar in objective modes: flag status, the hill, the round (HTML). */
  setModeStatus(html) {
    if (html === this.lastModeStatus) return;
    this.lastModeStatus = html;
    this.modeStatus.innerHTML = html;
  }
  /**
   * Objective markers (flags, the hill): on screen at the objective, or an
   * arrow at the screen edge pointing the way when it is behind you or off
   * to the side (`edge`: its bearing in radians, 0 ahead, clockwise).
   */
  setModeMarkers(list) {
    this.drawMarkers(this.modeMarkers, list);
  }
  /** Team pings (T), drawn like the objective markers on their own layer. */
  setPingMarkers(list) {
    let layer = document.getElementById("ping-markers");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "ping-markers";
      this.modeMarkers.after(layer);
    }
    this.drawMarkers(layer, list);
  }
  drawMarkers(layer, list) {
    const seen2 = /* @__PURE__ */ new Set();
    for (const m of list) {
      seen2.add(m.id);
      let el2 = layer.querySelector(`[data-id="${m.id}"]`);
      if (!el2) {
        el2 = document.createElement("div");
        el2.dataset.id = m.id;
        el2.className = "mode-marker";
        el2.innerHTML = "<i></i><b></b><span></span>";
        layer.append(el2);
      }
      el2.style.left = `${m.x}px`;
      el2.style.top = `${m.y}px`;
      el2.style.color = m.color;
      el2.classList.toggle("edge", m.edge !== void 0);
      el2.firstElementChild.style.transform = m.edge !== void 0 ? `rotate(${m.edge}rad)` : "";
      el2.querySelector("b").textContent = m.icon;
      el2.querySelector("span").textContent = m.label;
    }
    for (const el2 of [...layer.children]) if (!seen2.has(el2.dataset.id ?? "")) el2.remove();
  }
  /** Team scores: the objective mode's, else kills per team from the per-player scores. */
  teamTotals(scores) {
    if (this.modeScores && this.teams) return new Map(this.teams.map((t, i) => [t.id, this.modeScores[i] ?? 0]));
    const out = new Map((this.teams ?? []).map((t) => [t.id, 0]));
    for (const s of scores) {
      const t = this.roster.get(s.s)?.team;
      if (t && out.has(t)) out.set(t, out.get(t) + Math.max(0, s.k));
    }
    return out;
  }
  setModeLabel(text) {
    this.modeLabel.textContent = text;
  }
  /** The map's name, shown on the pause screen and the scoreboard. */
  mapName = "";
  setMapName(name) {
    this.mapName = name;
    this.pauseContext();
  }
  /** The pause menu's match line: map, mode and time left. */
  pauseContext() {
    const line = document.getElementById("pause-context");
    if (!line) return;
    const clock = this.timer.textContent ? ` · ${this.timer.textContent} left` : "";
    const text = `${this.mapName} · ${this.modeLabel.textContent ?? ""}${clock}`;
    if (line.textContent !== text) line.textContent = text;
  }
  setPortrait(src) {
    this.portrait.src = src;
  }
  /** The scorebar at the top (score boxes, timer, mode): hidden in the tutorial, where there is no score to play for. */
  showScorebar(on) {
    $$2("scorebar").style.display = on ? "" : "none";
  }
  /**
   * The scorebar's boxes either side of the timer (reference board): your team
   * and theirs in Team Deathmatch; you and the leader in Deathmatch; nothing
   * in co-op.
   */
  setTeamScore(scores, localSlot, limit, coop = false) {
    let left = "";
    let right = "";
    const box = (value, label, color) => `<b style="background:${color}">${value}</b><small>${escapeHtml$4(label)}</small>`;
    if (this.teams) {
      const totals = this.teamTotals(scores);
      const mine = this.roster.get(localSlot)?.team;
      const own = this.teams.find((t) => t.id === mine) ?? this.teams[0];
      const rival = this.teams.filter((t) => t.id !== own.id).sort((x, y) => (totals.get(y.id) ?? 0) - (totals.get(x.id) ?? 0))[0];
      left = box(totals.get(own.id) ?? 0, own.name, own.color);
      right = box(totals.get(rival.id) ?? 0, this.teams.length > 2 ? `${rival.name} · lead` : rival.name, rival.color);
    } else if (!coop) {
      const me = scores.find((s) => s.s === localSlot)?.k ?? 0;
      const best = scores.filter((s) => s.s !== localSlot).reduce((m, s) => Math.max(m, s.k), 0);
      left = box(me, "You", "#00d1ff");
      right = box(best, "Leader", "#ff8a3d");
    }
    const key = `${left}|${right}|${limit}`;
    if (key === this.lastTeamScore) return;
    this.lastTeamScore = key;
    this.sbLeft.innerHTML = left;
    this.sbRight.innerHTML = right;
    this.sbLeft.title = this.sbRight.title = limit > 0 ? `First to ${limit}` : "";
  }
  /** Name and health of whatever you just hit (fades after a few seconds). */
  showTarget(name, frac, color) {
    this.target.hidden = false;
    $$2("target-name").textContent = name;
    const bar = $$2("target-bar");
    bar.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    bar.style.background = color;
    clearTimeout(this.targetTimer);
    this.targetTimer = window.setTimeout(() => this.target.hidden = true, 2500);
  }
  /** Display names for NPC actor IDs, provided by the session. */
  npcName = () => void 0;
  name(slot) {
    if (slot === null) return "The arena";
    if (slot >= NPC_ID_BASE) return this.npcName(slot) ?? "Enemy";
    return this.roster.get(slot)?.name ?? `Player ${slot + 1}`;
  }
  setHealth(hp, armor, alive) {
    this.health.textContent = alive ? String(Math.max(0, hp)) : "";
    this.armor.textContent = alive && armor > 0 ? String(armor) : "";
    this.healthBar.style.width = `${alive ? Math.max(0, Math.min(100, hp)) : 0}%`;
    this.healthBar.classList.toggle("low", hp <= 30);
    this.armorBar.style.width = `${alive ? Math.max(0, Math.min(100, armor)) : 0}%`;
    this.root.classList.toggle("dead", !alive);
  }
  /** Sprint stamina (shown while not full) and the stance you're in. */
  setStamina(stamina, winded, alive, stance) {
    const row = document.getElementById("stamina-row");
    if (!row) return;
    row.classList.toggle("on", alive && (stamina < 1 || stance > 0));
    row.classList.toggle("winded", winded);
    document.getElementById("stamina-bar").style.width = `${Math.round(stamina * 100)}%`;
    const label = stance === 2 ? "Prone" : stance === 1 ? "Crouch" : "";
    const st = document.getElementById("stance");
    if (st.textContent !== label) st.textContent = label;
  }
  /** Held weapon, ammo and the owned-weapons bar. */
  /** The vehicle you're in: its name and health (null hides the panel); `burning` adds the warning to bail out. */
  setVehicle(v) {
    const el2 = document.getElementById("vehicle-hp");
    if (!el2) return;
    el2.hidden = !v;
    if (!v) return;
    el2.querySelector("span").textContent = v.name;
    const bar = el2.querySelector("b");
    bar.style.setProperty("--hp", `${Math.max(0, Math.min(100, v.pct))}%`);
    bar.style.setProperty("--hp-color", hpColor(v.pct));
    let warn = el2.querySelector("em");
    if (!warn) {
      warn = document.createElement("em");
      warn.textContent = "Vehicle on fire — bail out!";
      el2.append(warn);
    }
    warn.hidden = !v.burning;
    el2.classList.toggle("burning", !!v.burning);
  }
  /** Small health bars over damaged vehicles (screen positions in CSS px). */
  setVehicleBars(bars) {
    const root = document.getElementById("vehicle-bars");
    if (!root) return;
    const seen2 = /* @__PURE__ */ new Set();
    for (const b of bars) {
      const key = String(b.id);
      seen2.add(key);
      let el2 = root.querySelector(`i[data-id="${key}"]`);
      if (!el2) {
        el2 = document.createElement("i");
        el2.dataset.id = key;
        el2.append(document.createElement("b"));
        root.append(el2);
      }
      el2.style.left = `${b.x}px`;
      el2.style.top = `${b.y}px`;
      const fill = el2.firstElementChild;
      fill.style.setProperty("--hp", `${b.pct}%`);
      fill.style.setProperty("--hp-color", hpColor(b.pct));
    }
    for (const el2 of [...root.children]) if (!seen2.has(el2.dataset.id ?? "")) el2.remove();
  }
  /** Grenade / mine count beside the ammo (reference board: the grenade icon and number). */
  setThrowable(t, alive) {
    const text = alive && t ? `${t.kind === "mine" ? "◎" : "●"} ${t.count}` : "";
    if (this.throwEl.textContent !== text) this.throwEl.textContent = text;
    this.throwEl.title = t ? t.kind === "mine" ? "Proximity mines (hold G to aim, let go to throw)" : "Grenades (hold G to aim, let go to throw)" : "";
  }
  /** `owned` and `held` are weapon codes; the bar shows slots 1–9, with a pip per extra weapon carried in a slot. */
  /** Riding as a passenger or gunner: the seat's gun (heat) instead of your own. */
  /** Swap the crosshair for a gunner's reticle while on a mounted gun; `heat` (0-100) fills its ring. */
  setGunnerReticle(heat) {
    const el2 = document.getElementById("crosshair");
    if (!el2) return;
    el2.classList.toggle("gunner", heat !== null);
    if (heat !== null) el2.style.setProperty("--heat", String(Math.min(100, heat)));
  }
  /**
   * A mounted gun in the ammo counter: its heat, or (limited ammunition: the Tank's cannon) its rounds aboard over the
   * most it carries, low under a quarter and "Empty" at none (they come back slowly, or all at an ammo pickup).
   */
  setMountedGun(name, heat, shells, max) {
    this.weaponName.textContent = name;
    if (shells !== void 0) {
      this.ammoReserve.textContent = max !== void 0 ? String(max) : "";
      this.ammoCount.textContent = shells > 0 ? String(shells) : "Empty";
      this.ammoCount.classList.toggle("reloading", heat >= 100);
      this.ammoCount.classList.toggle("low", max !== void 0 && shells <= Math.ceil(max / 4));
      this.ammoCount.title = "Shells: one comes back every few seconds; drive over an ammo pickup to fill up";
    } else {
      this.ammoReserve.textContent = "";
      this.ammoCount.textContent = heat >= 100 ? "OVERHEAT" : `${heat}°`;
      this.ammoCount.classList.toggle("reloading", heat >= 100);
      this.ammoCount.classList.toggle("low", false);
      this.ammoCount.title = "";
    }
    this.altEl.textContent = "";
  }
  setWeapons(owned, held, reloading, alive, driving = false) {
    if (driving) {
      this.weaponName.textContent = "Driving";
      this.ammoCount.textContent = "";
      this.ammoReserve.textContent = "";
      this.altEl.textContent = "";
      return;
    }
    const def = weaponByCode(held);
    const altDef = def?.alt;
    const barrel = !!def && def.magazine === 0 && !!altDef?.reload;
    const altText = alive && altDef ? altDef.ammo === "own" && !barrel ? `RMB ${altDef.label} · ${owned.get(held)?.[2] ?? 0}` : `RMB ${altDef.label}` : "";
    if (this.altEl.textContent !== altText) this.altEl.textContent = altText;
    const ammo = owned.get(held);
    this.weaponName.textContent = alive && def ? def.displayName : "";
    this.ammoReserve.textContent = alive && def && ammo && (def.magazine > 0 || barrel) && !reloading ? String(ammo[1]) : "";
    if (!alive || !def || !ammo) this.ammoCount.textContent = "";
    else if (barrel) this.ammoCount.textContent = reloading ? "Loading…" : String(ammo[2]);
    else if (def.heat) this.ammoCount.textContent = ammo[3] >= 100 ? "OVERHEAT" : `${Math.round(ammo[3])}°`;
    else if (def.magazine === 0) this.ammoCount.textContent = "∞";
    else this.ammoCount.textContent = reloading ? "Reloading…" : String(ammo[0]);
    this.ammoCount.classList.toggle("reloading", reloading || !!def?.heat && !!ammo && ammo[3] >= 100);
    this.ammoCount.classList.toggle("low", !!def && !!ammo && (barrel ? ammo[2] === 0 : def.magazine > 0 && ammo[0] <= Math.ceil(def.magazine / 4)));
    const key = `${alive}|${held}|${[...owned.keys()].join(",")}`;
    if (key === this.lastWeaponBar) return;
    this.lastWeaponBar = key;
    const bySlot = /* @__PURE__ */ new Map();
    for (const code of owned.keys()) {
      const w = weaponByCode(code);
      if (w) bySlot.set(w.slot, [...bySlot.get(w.slot) ?? [], w.displayName]);
    }
    this.weaponBar.innerHTML = alive ? [1, 2, 3, 4, 5, 6, 7, 8, 9].map((slot) => {
      const names = bySlot.get(slot) ?? [];
      const pips = names.length > 1 ? `<i>${"•".repeat(Math.min(4, names.length))}</i>` : "";
      return `<span class="${names.length ? "owned" : ""} ${def?.slot === slot ? "held" : ""}" title="${escapeHtml$4(names.join(", "))}">${slot}${pips}</span>`;
    }).join("") : "";
  }
  /** Full-screen edge glow while you are burning, poisoned, slowed or frozen. */
  setStatusTint(color) {
    let el2 = document.getElementById("status-tint");
    if (!el2) {
      el2 = document.createElement("div");
      el2.id = "status-tint";
      this.root.append(el2);
    }
    el2.style.boxShadow = color ? `inset 0 0 120px 30px ${color}88` : "none";
  }
  setPowerups(speedSeconds, damageSeconds, jetFuel = null, uavSeconds = 0, jamSeconds = 0, streak = "") {
    const parts = [];
    if (streak) parts.push(`<span style="color:#ffd24a">${escapeHtml$4(streak)}</span>`);
    if (jamSeconds > 0) parts.push(`<span style="color:#ff5a5a">MINIMAP JAMMED ${Math.ceil(jamSeconds)}</span>`);
    if (uavSeconds > 0) parts.push(`<span style="color:#9fe8ff">UAV ${Math.ceil(uavSeconds)}</span>`);
    if (jetFuel !== null) {
      const n = Math.round(jetFuel * 10);
      parts.push(`<span style="color:#ffa040">JETPACK ${"▮".repeat(n)}<span style="opacity:.3">${"▮".repeat(10 - n)}</span></span>`);
    }
    if (damageSeconds > 0) parts.push(`<span style="color:#d77bff">DOUBLE DAMAGE ${Math.ceil(damageSeconds)}</span>`);
    if (speedSeconds > 0) parts.push(`<span style="color:#5fe0ff">SPEED ${Math.ceil(speedSeconds)}</span>`);
    for (const l of this.statusLines) parts.push(`<span style="color:${l.color}">${escapeHtml$4(l.text)}</span>`);
    const html = parts.join("");
    if (html !== this.powerups.innerHTML) this.powerups.innerHTML = html;
  }
  pickup(text) {
    this.pickupMsg.textContent = text;
    this.pickupMsg.classList.add("on");
    clearTimeout(this.pickupTimer);
    this.pickupTimer = window.setTimeout(() => this.pickupMsg.classList.remove("on"), 1200);
  }
  setScope(on) {
    this.scope.hidden = !on;
  }
  /** While out of play: what you're watching ("Watching Ana", "Free camera") and the controls for it (null hides it). */
  setSpectating(title, hint = "") {
    let el2 = document.getElementById("spectating");
    if (!el2) {
      if (!title) return;
      el2 = document.createElement("div");
      el2.id = "spectating";
      el2.innerHTML = "<b></b><small></small>";
      this.root.append(el2);
    }
    el2.hidden = !title;
    if (!title) return;
    const [b, small] = [el2.querySelector("b"), el2.querySelector("small")];
    if (b.textContent !== title) b.textContent = title;
    if (small.textContent !== hint) small.textContent = hint;
  }
  /** The kill cam's banner: who killed you, with what, and the health they have left (null hides it). */
  setKillCam(k) {
    let el2 = document.getElementById("killcam");
    if (!el2) {
      if (!k) return;
      el2 = document.createElement("div");
      el2.id = "killcam";
      this.root.append(el2);
    }
    el2.hidden = !k;
    if (!k) return;
    const key = `${k.name}|${k.color}|${k.weapon}|${k.hp}`;
    if (el2.dataset.key === key) return;
    el2.dataset.key = key;
    el2.innerHTML = `<small>Killed by</small> <b style="color:${escapeHtml$4(k.color)}">${escapeHtml$4(k.name)}</b> <span class="kc-w"></span>${k.hp === null ? "" : ` <span class="kc-hp">${k.hp > 0 ? `${k.hp} HP left` : "down"}</span>`}<em>Click or Space: skip</em>`;
    const icon = weaponIcon(k.weapon);
    const slot = el2.querySelector(".kc-w");
    slot.textContent = weaponLabel(k.weapon);
    if (icon) {
      icon.title = weaponLabel(k.weapon);
      slot.replaceChildren(icon);
    }
  }
  /** Out of play (dead, or spectating): the crosshair goes. */
  setWatching(on) {
    if (this.root.classList.contains("watching") !== on) this.root.classList.toggle("watching", on);
  }
  /** Aiming down the sights (0..1): the crosshair fades out and a red-dot reticle takes its place. */
  setAds(amount) {
    let dot = document.getElementById("reddot");
    if (!dot) {
      dot = document.createElement("div");
      dot.id = "reddot";
      document.getElementById("crosshair")?.after(dot);
    }
    const on = amount > 0.6;
    dot.style.opacity = on ? String(Math.min(1, (amount - 0.6) / 0.3)) : "0";
    const cross = document.getElementById("crosshair");
    if (cross) cross.style.opacity = String(1 - Math.min(1, amount * 1.6));
  }
  /** Breath meter under the scope (spent: it has to recover before you can hold again). */
  setBreath(breath, spent) {
    if (this.scope.hidden) return;
    this.scope.style.setProperty("--breath", `${Math.round(breath * 100)}%`);
    this.scope.classList.toggle("spent", spent);
  }
  setStatus(phase, timeLeft, alive, winner, outcome = null) {
    const m = Math.floor(timeLeft / 60);
    const s = String(timeLeft % 60).padStart(2, "0");
    this.timer.textContent = phase === "intermission" ? "Intermission" : phase === "waiting" || phase === "countdown" ? "" : timeLeft ? `${m}:${s}` : "";
    if (phase === "countdown") {
      this.countdown.hidden = false;
      this.countdown.classList.remove("go");
      this.countdown.textContent = String(Math.max(1, timeLeft));
    } else if (performance.now() > this.goUntil) this.countdown.hidden = true;
    if (phase === "waiting") this.banner.textContent = "Waiting for players…";
    else if (phase === "countdown") this.banner.textContent = "";
    else if (phase === "intermission") this.banner.textContent = outcome === "victory" ? "Mission complete" : outcome === "defeat" ? "Mission failed" : winner ? `${winner} wins the round` : "Round over";
    else this.banner.textContent = alive ? "" : this.waitLabel;
  }
  /** "Go!" as the countdown ends. */
  flashGo() {
    this.countdown.hidden = false;
    this.countdown.textContent = "Go!";
    this.countdown.classList.add("go");
    this.goUntil = performance.now() + 900;
    setTimeout(() => {
      if (performance.now() >= this.goUntil) this.countdown.hidden = true;
    }, 950);
  }
  /** The loading screen over the match while its files arrive (null hides it). */
  setLoading(text, progress = 0) {
    this.loading.hidden = text === null;
    if (text === null) return;
    this.loading.querySelector("b").textContent = text;
    this.loading.querySelector(".bar i").style.width = `${Math.round(Math.min(1, progress) * 100)}%`;
  }
  /** Shown while you are dead ("Respawning…", or "Next round" in Elimination). */
  waitLabel = "Respawning…";
  kill(killer, victim, weapon, localSlot, headshot = false, teamKill = false) {
    const line = document.createElement("div");
    const color = (slot) => slot === null ? "#ccc" : this.nameColor(slot, localSlot);
    const name = (slot) => `<span style="color:${color(slot)}">${escapeHtml$4(this.name(slot))}</span>`;
    line.innerHTML = killer === null ? `${name(victim)} ${HAZARD_DEATHS[weapon] ?? "blew themselves up"}` : `${name(killer)} <small>${escapeHtml$4(weaponLabel(weapon))}</small> ${name(victim)}`;
    const icon = killer !== null ? weaponIcon(weapon) : null;
    const label = line.querySelector("small");
    if (icon && label) {
      icon.title = weaponLabel(weapon);
      label.replaceWith(icon);
    }
    if (killer === localSlot || victim === localSlot) line.style.outline = "1px solid rgba(255,255,255,0.5)";
    if (headshot && killer !== null && !teamKill) line.insertAdjacentHTML("beforeend", ' <b class="hs" title="Headshot">✛</b>');
    if (teamKill && killer !== null) {
      line.classList.add("tk");
      line.insertAdjacentHTML("afterbegin", '<b class="tk-tag" title="Team kill">TK</b> ');
    }
    this.feed.prepend(line);
    this.trimFeed();
    window.setTimeout(() => line.remove(), 5e3);
  }
  /** The feed keeps its newest lines: 5, or 3 on a phone sideways (feedLimit.ts). */
  trimFeed() {
    const keep = feedLines(isTouchDevice(), window.innerHeight);
    while (this.feed.children.length > keep) this.feed.lastChild?.remove();
  }
  /** A slot changed hands mid-match: "Ana joined, replacing Mildred" (a player joined), or "Mildred took over for Ana" (they left). */
  takeover(slot, to, from, bot) {
    const line = document.createElement("div");
    const color = this.nameColor(slot);
    line.className = "say takeover";
    line.innerHTML = `<span style="color:${color}">${escapeHtml$4(to)}</span> ${bot ? "took over for" : "joined, replacing"} <span style="color:${color}">${escapeHtml$4(from)}</span>`;
    this.feed.prepend(line);
    this.trimFeed();
    window.setTimeout(() => line.remove(), 6e3);
  }
  /** A line from the match itself in the feed: what the host changed ("Host set teams to 8v8"). */
  note(text) {
    const line = document.createElement("div");
    line.className = "say note";
    line.textContent = text;
    this.feed.prepend(line);
    this.trimFeed();
    window.setTimeout(() => line.remove(), 6e3);
  }
  /** A quick message in the feed: "Name: Enemy spotted!". */
  say(slot, text) {
    if (!text) return;
    const line = document.createElement("div");
    const color = this.nameColor(slot);
    line.className = "say";
    line.innerHTML = `<span style="color:${color}">${escapeHtml$4(this.name(slot))}:</span> ${escapeHtml$4(text)}`;
    this.feed.prepend(line);
    this.trimFeed();
    window.setTimeout(() => line.remove(), 6e3);
  }
  /** The quick-message menu (B): the numbered messages, or hidden. */
  setMessageMenu(open, messages) {
    let el2 = document.getElementById("msg-menu");
    if (!el2) {
      el2 = document.createElement("div");
      el2.id = "msg-menu";
      el2.innerHTML = `<b>Quick message</b>${messages.map((m, i) => `<div><kbd>${i + 1}</kbd> ${escapeHtml$4(m)}</div>`).join("")}<small>1 &amp; 7 also order your team's bots · T: ping · N: dance · B: close</small>`;
      this.root.append(el2);
    }
    el2.hidden = !open;
  }
  /** Active objectives, plus completed/failed ones while they fade out. */
  setObjectives(list) {
    const key = JSON.stringify(list);
    if (key === this.lastObjectives) return;
    this.lastObjectives = key;
    this.objectives.innerHTML = list.map((o) => `<div class="${o.state}">${escapeHtml$4(o.text)}</div>`).join("");
  }
  showMessage(text, seconds) {
    this.message.textContent = text;
    this.message.classList.add("on");
    clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => this.message.classList.remove("on"), seconds * 1e3);
  }
  /** "[E] Open the gate" under the crosshair; `denied` shows a refusal (locked). */
  /** The use prompt (E), and optionally a second key to show beside it (H: the vehicle camera). */
  setPrompt(text, denied = false, hint) {
    const key = `${text}|${denied}|${hint?.key}|${hint?.text}`;
    if (key === this.lastPrompt) return;
    this.lastPrompt = key;
    this.prompt.classList.toggle("denied", denied);
    const extra = hint ? `<span class="prompt-hint"><kbd>${escapeHtml$4(hint.key)}</kbd>${escapeHtml$4(hint.text)}</span>` : "";
    this.prompt.innerHTML = text === null ? "" : denied ? escapeHtml$4(text) : `<kbd>E</kbd>${escapeHtml$4(text)}${extra}`;
  }
  setTimers(lines) {
    const key = lines.join("|");
    if (key === this.lastTimers) return;
    this.lastTimers = key;
    this.scTimers.innerHTML = lines.map((l) => `<div>${escapeHtml$4(l)}</div>`).join("");
  }
  /** Objective marker at screen position (CSS px), or hidden. */
  setMarker(at) {
    this.marker.hidden = !at;
    if (!at) return;
    this.marker.style.left = `${at.x}px`;
    this.marker.style.top = `${at.y}px`;
    this.marker.querySelector("span").textContent = `${Math.round(at.dist)} m`;
  }
  /**
   * Hit confirmation on the crosshair, told apart by shape (GUNPLAY_SPEC §21):
   * a diamond for a body hit, a bigger red one for the head, a blue square
   * when armor soaked it. `true` / `false` are head / body (older callers).
   */
  hit(kind = "body") {
    const k = kind === true ? "head" : kind === false ? "body" : kind;
    if (this.hitmarker.classList.contains("kill")) return;
    this.hitmarker.classList.remove("on", "head", "armor");
    void this.hitmarker.offsetWidth;
    this.hitmarker.classList.add("on");
    if (k !== "body") this.hitmarker.classList.add(k);
    clearTimeout(this.hitTimer);
    this.hitTimer = window.setTimeout(() => this.hitmarker.classList.remove("on", "head", "armor"), k === "head" ? 220 : 140);
  }
  /** Kill confirmation: a sharp X that punches in, bigger and brighter with each kill in a row (`multi`, from 1). */
  killConfirm(multi) {
    this.hitmarker.classList.remove("on", "head", "armor", "kill");
    void this.hitmarker.offsetWidth;
    this.hitmarker.dataset.multi = String(Math.min(4, Math.max(1, multi)));
    this.hitmarker.classList.add("on", "kill");
    clearTimeout(this.hitTimer);
    this.hitTimer = window.setTimeout(() => this.hitmarker.classList.remove("on", "kill"), 380 + Math.min(3, multi - 1) * 60);
  }
  /**
   * You took damage: the screen edge flashes red, with an arc pointing at the
   * attacker when we know where it came from (radians, 0 = straight ahead, + = right).
   * With Reduce flashing on it is a duller red that eases in and holds under fire (hurtVignette.ts); `tickHurt`
   * draws it each frame.
   */
  hurt(direction, amount) {
    const el2 = document.getElementById("hurt");
    if (!el2) return;
    el2.style.setProperty("--hurt-dir", `${direction ?? 0}rad`);
    el2.classList.toggle("dir", direction !== null);
    this.hurtFade.hit(amount, performance.now());
    this.tickHurt();
  }
  hurtFade = new HurtFade();
  /** The vignette's look shown now, and its pictures (made when first shown). */
  hurtLook = null;
  hurtPictures = {};
  hurtPicture(look) {
    return this.hurtPictures[look] ??= paintVignette(HURT_LOOKS[look]);
  }
  /** The hurt vignette this frame: its look (Reduce flashing) and how strong it is now. */
  tickHurt() {
    const el2 = document.getElementById("hurt");
    if (!el2) return;
    const look = reduceFlashing() ? "calm" : "classic";
    if (look !== this.hurtLook) {
      this.hurtLook = look;
      el2.style.backgroundImage = `url(${this.hurtPicture(look).toDataURL()})`;
    }
    const level = this.hurtFade.update(performance.now(), look === "calm");
    const shown = level > 2e-3 ? level.toFixed(3) : "0";
    if (shown !== this.hurtShown) el2.style.opacity = this.hurtShown = shown;
  }
  hurtShown = "";
  /** You took a heavy hit (content/match-play.json heavyHit): the screen's edges darken for a moment (hurtVignette.ts HeavyFade). */
  heavyHit(amount) {
    this.heavyFade.hit(amount, performance.now());
    this.tickHeavy();
  }
  heavyFade = new HeavyFade();
  heavyEl = null;
  heavyShown = "";
  heavyPicture = null;
  /** The heavy-hit edge this frame. */
  tickHeavy() {
    const level = this.heavyFade.update(performance.now(), reduceFlashing());
    if (!this.heavyEl && level <= 2e-3) return;
    if (!this.heavyEl) {
      this.heavyEl = document.createElement("div");
      this.heavyEl.id = "heavy-hit";
      this.heavyPicture ??= paintVignette(HEAVY_LOOK);
      this.heavyEl.style.backgroundImage = `url(${this.heavyPicture.toDataURL()})`;
      (document.getElementById("hud") ?? document.body).append(this.heavyEl);
    }
    const shown = level > 2e-3 ? level.toFixed(3) : "0";
    if (shown === this.heavyShown) return;
    this.heavyShown = shown;
    this.heavyEl.style.opacity = shown;
    this.heavyEl.style.transform = reduceFlashing() ? "" : `scale(${(1 + level * 0.04).toFixed(3)})`;
  }
  /** The heavy-hit edge as drawn now (the flicker check draws it over its frames). */
  heavyOverlay() {
    return { image: this.heavyPicture ??= paintVignette(HEAVY_LOOK), opacity: this.heavyFade.level };
  }
  /** The hurt vignette as drawn now (the flicker check draws it over its frames). */
  hurtOverlay() {
    return { image: this.hurtPicture(this.hurtLook ?? "classic"), opacity: this.hurtFade.level };
  }
  /** "HEADSHOT" call-out for a kill you made with a head hit. */
  headshot() {
    const el2 = document.getElementById("headshot");
    if (!el2) return;
    el2.classList.remove("on");
    void el2.offsetWidth;
    el2.classList.add("on");
  }
  /**
   * The Tab / end-of-round scoreboard. Drawn when it opens, then patched at
   * most 4 times a second while it stays open (cheap at 96 players).
   */
  renderScoreboard(visible, scores, localSlot, final = false) {
    if (this.scoreboard.hidden !== !visible) {
      this.scoreboard.hidden = !visible;
      this.scoreboard.parentElement?.classList.toggle("sb-up", visible);
    }
    if (!visible) {
      this.boardOpen = false;
      return;
    }
    const now = performance.now();
    if (this.boardOpen && now - this.boardAt < 250) return;
    this.boardAt = now;
    this.boardOpen = true;
    this.board.render(this.boardData(scores, localSlot, final));
  }
  boardAt = 0;
  boardOpen = false;
  /** The pause menu's Match tab: the same board, in the menu's width (`final`: the match is over, so where it goes next too). */
  renderPauseScores(box, scores, localSlot, final = false) {
    if (this.pauseBoard?.root !== box) this.pauseBoard = new ScoreBoard(box, { maxWidth: 560, sizeSelf: false });
    this.pauseBoard.render(this.boardData(scores, localSlot, final));
  }
  /** What the scoreboards show: the teams (or everyone), sorted, with each row's stats. */
  boardData(scores, localSlot, final) {
    const people = [...this.roster.values()].filter((p) => !p.bot).length;
    const myParty2 = this.roster.get(localSlot)?.py;
    const inParty = myParty2 ? [...this.roster.values()].filter((p) => !p.bot && p.py === myParty2).length > 1 : false;
    const squads = this.teams && this.squadsRaw ? readSquads(this.squadsRaw) : null;
    const row = (s) => {
      const p = this.roster.get(s.s);
      const cls = this.classes.get(s.s);
      const ping = this.pings.get(s.s);
      return {
        slot: s.s,
        name: this.name(s.s),
        bot: !!p?.bot,
        ...p && !p.bot ? p.acct ? { who: "acct" } : people > 1 ? { who: "guest" } : {} : {},
        ...inParty && p && !p.bot && p.py === myParty2 ? { party: true } : {},
        color: this.nameColor(s.s, localSlot),
        cls: cls === void 0 ? "" : CLASS_DEFS[CLASS_IDS[cls] ?? "rocketeer"]?.name ?? "",
        k: s.k,
        d: s.d,
        obj: this.objLabel ? String(s.o ?? 0) : "",
        ping: p?.bot ? "–" : ping === void 0 ? "" : String(ping),
        ...squads ? { pts: String(s.p ?? 0) } : {},
        leader: this.leaders.has(s.s),
        dead: this.alive.get(s.s) === false,
        me: s.s === localSlot
      };
    };
    const sorted = [...scores].sort((a, b) => b.k - a.k || (b.o ?? 0) - (a.o ?? 0) || a.d - b.d || a.s - b.s);
    const clock = this.timer.textContent ? ` · ${this.timer.textContent} left` : "";
    const watching = [...this.roster.values()].filter((p) => p.sp).map((p) => p.name);
    const spectators = watching.length ? `Spectating: ${watching.join(", ")}` : "";
    const note = [final && this.nextMap ? this.nextMap : "", this.onlineNote, spectators].filter(Boolean).join(" · ");
    const head = `${final ? "Final · " : ""}${this.mapName} · ${this.modeLabel.textContent ?? ""}${final ? "" : clock}`;
    const flags = { cls: this.classes.size > 0, obj: this.objLabel, ping: this.pings.size > 0, ...squads ? { pts: true } : {} };
    if (!this.teams) {
      return { head, note, kind: this.coop ? "coop" : "ffa", groups: [{ id: "all", name: "", color: "", score: 0, lead: false, rows: sorted.map(row) }], ...flags };
    }
    const totals = this.teamTotals(scores);
    const top = Math.max(...this.teams.map((t) => totals.get(t.id) ?? 0));
    const groups = this.teams.map((t, i) => {
      const rows = sorted.filter((s) => this.roster.get(s.s)?.team === t.id).map(row);
      const sq = squads ? squadGroups(rows, squads, i, localSlot, this.honours, (slot) => this.name(slot)) : null;
      return {
        id: t.id,
        name: t.name,
        color: t.color,
        score: totals.get(t.id) ?? 0,
        lead: top > 0 && (totals.get(t.id) ?? 0) === top,
        rows: sq ? sq.flatMap((q) => q.rows) : rows,
        ...sq ? { squads: sq } : {}
      };
    });
    return { head, note, kind: "teams", groups, ...flags };
  }
  renderPerf(visible, lines, server, botStates) {
    this.perf.hidden = !visible;
    if (!visible) return;
    const out = Object.entries(lines).map(([k, v]) => `${k.padEnd(14)} ${v}`);
    if (server) {
      out.push(
        "",
        `server tick    ${server.tickMsAvg.toFixed(2)} ms avg / ${server.tickMsMax.toFixed(2)} max`,
        `server ai      ${server.aiMsAvg.toFixed(2)} ms`,
        `snapshot       ${server.snapshotBytes} B`,
        `downstream     ${(server.bytesPerSecPerClient / 1024).toFixed(1)} KiB/s`,
        `players        ${server.humans} humans, ${server.bots} bots`,
        `late ticks     ${server.lateTicks}`
      );
    }
    if (botStates.length) out.push("", "bots", ...botStates);
    this.perf.textContent = out.join("\n");
  }
}
const angleLerp = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
class MountState {
  constructor(map, physics) {
    this.physics = physics;
    const teams = map.entities.some((e) => e.kind === "mount" && e.faction) ? mapTeams(map, MAX_TEAMS) : [];
    map.entities.forEach((e, index) => {
      const plane = e.kind === "airplane";
      if (e.kind !== "mount" && !plane) return;
      const def = plane ? airCraftDef(e.craft) : getMountDef(e.model);
      if (!def) return;
      const start = plane ? routePose(airRoute(e), 0) : null;
      const pos = start ? start.pos : { x: e.position[0], y: e.position[1], z: e.position[2] };
      const yaw = start ? start.yaw : e.kind === "mount" ? e.yaw : 0;
      const body = physics.createBox({ x: pos.x, y: pos.y + def.half[1], z: pos.z }, { x: def.half[0], y: def.half[1], z: def.half[2] }, yaw);
      if (plane) physics.setBoxEnabled(body, false);
      const team = e.kind === "mount" && e.faction ? teams.find((t) => t.id === e.faction)?.color ?? null : null;
      const tint = e.kind === "mount" && def.kind !== "sentry" ? mountTint(e.skin, team) : null;
      this.mounts.set(index, { index, def, model: def.id, pos, yaw, aimYaw: yaw, aimPitch: 0, health: 100, alive: true, wreck: false, burning: false, charging: 0, arcing: false, wreckGoneAt: 0, seats: def.seats.map(() => -1), supply: def.resupply?.uses ?? 0, tint, shown: { pos: { ...pos }, yaw, aimYaw: yaw, aimPitch: 0 }, vel: { x: 0, y: 0, z: 0 }, spin: 0, tick: -1, at: 0, body, susp: null });
    });
  }
  physics;
  mounts = /* @__PURE__ */ new Map();
  /** Where arc sentries started winding up since the last takeCharges. */
  charges = [];
  /** Arc sentries that started winding up since the last call (where they stand), for their warning sound. */
  takeCharges() {
    const out = this.charges;
    this.charges = [];
    return out;
  }
  apply(list, tick = -1) {
    if (!list) return;
    const now = performance.now();
    for (const s of list) {
      const m = this.mounts.get(s[0]) ?? (s[0] >= BUILT_MOUNT_BASE ? this.addBuilt(s) : void 0);
      if (!m) continue;
      const pos = { x: s[1], y: s[2], z: s[3] };
      const dt = m.tick >= 0 && tick > m.tick ? (tick - m.tick) / TICK_RATE : 0;
      if (dt > 0 && dt < 0.5) {
        const k = 0.5;
        m.vel = { x: m.vel.x + ((pos.x - m.pos.x) / dt - m.vel.x) * k, y: m.vel.y + ((pos.y - m.pos.y) / dt - m.vel.y) * k, z: m.vel.z + ((pos.z - m.pos.z) / dt - m.vel.z) * k };
        m.spin += (Math.atan2(Math.sin(s[4] - m.yaw), Math.cos(s[4] - m.yaw)) / dt - m.spin) * k;
      } else if (dt >= 0.5) {
        m.vel = { x: 0, y: 0, z: 0 };
        m.spin = 0;
      }
      if (tick >= 0) m.tick = tick;
      if (dt > 0 && dt < 0.5 && m.at > 0) {
        const due = m.at + dt * 1e3;
        m.at = Math.min(now, due + (now - due) * 0.1);
      } else m.at = now;
      m.pos = pos;
      m.yaw = s[4];
      m.aimYaw = s[5];
      m.aimPitch = s[6];
      m.health = s[7];
      const flags = s[8];
      const alive = (flags & MOUNT_FLAG_ALIVE) !== 0;
      const wreck = (flags & MOUNT_FLAG_WRECK) !== 0;
      if (!m.alive && alive) {
        m.shown = { pos: { ...m.pos }, yaw: m.yaw, aimYaw: m.aimYaw, aimPitch: m.aimPitch };
        m.vel = { x: 0, y: 0, z: 0 };
        m.spin = 0;
      }
      if (m.wreck && !wreck && !alive) m.wreckGoneAt = now;
      if (alive || wreck) m.wreckGoneAt = 0;
      m.alive = alive;
      m.wreck = wreck;
      m.burning = (flags & MOUNT_FLAG_BURNING) !== 0;
      const charging = (flags & MOUNT_FLAG_CHARGING) !== 0;
      if (charging && !m.charging) this.charges.push({ ...m.pos });
      m.charging = charging ? m.charging || now : 0;
      m.arcing = (flags & MOUNT_FLAG_ARC) !== 0;
      m.seats = s.slice(9, 9 + m.def.seats.length);
      m.supply = m.def.resupply ? s[9 + m.def.seats.length] ?? 0 : 0;
      const solid = (alive || wreck) && !m.def.airplane;
      this.physics.setBoxEnabled(m.body, solid);
      if (solid) this.physics.setBoxPose(m.body, { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z }, m.yaw);
    }
    this.physics.commit();
  }
  /**
   * The suspension entries of a snapshot (`ms`, see suspensionSnapshot): latest values, drawn eased by View.suspend.
   * Undefined (none sent): every vehicle goes back to the drawn-only suspension.
   */
  applySuspension(list) {
    const seen2 = /* @__PURE__ */ new Set();
    for (const e of list ?? []) {
      const m = this.mounts.get(e[0]);
      if (!m) continue;
      seen2.add(m.index);
      const wheel = e.slice(5).map((v) => v / 100);
      m.susp = { h: e[1] / 100, p: e[2] / 1e3, r: e[3] / 1e3, steer: e[4] / 100, wheel };
    }
    for (const m of this.mounts.values()) if (!seen2.has(m.index)) m.susp = null;
  }
  /** A sentry someone built (Classes): not on the map, so it first shows up in a snapshot. */
  addBuilt(s) {
    const def = MOUNT_DEFS.sentry;
    const pos = { x: s[1], y: s[2], z: s[3] };
    const yaw = s[4];
    const body = this.physics.createBox({ x: pos.x, y: pos.y + def.half[1], z: pos.z }, { x: def.half[0], y: def.half[1], z: def.half[2] }, yaw);
    const m = { index: s[0], def, model: def.id, pos, yaw, aimYaw: yaw, aimPitch: 0, health: 100, alive: false, wreck: false, burning: false, charging: 0, arcing: false, wreckGoneAt: 0, seats: [], supply: 0, tint: null, shown: { pos: { ...pos }, yaw, aimYaw: yaw, aimPitch: 0 }, vel: { x: 0, y: 0, z: 0 }, spin: 0, tick: -1, at: 0, body, susp: null };
    this.mounts.set(m.index, m);
    return m;
  }
  /**
   * Ease the drawn poses toward where each mount is now: its latest state
   * carried on by its motion since that snapshot (at most a few frames'
   * worth), so a fast vehicle glides between snapshots instead of surging
   * at each one.
   */
  smooth(dt) {
    const k = Math.min(1, dt * 18);
    const now = performance.now();
    for (const m of this.mounts.values()) {
      const p = m.shown.pos;
      const ahead = m.alive ? Math.min(0.1, (now - m.at) / 1e3) : 0;
      const want = { x: m.pos.x + m.vel.x * ahead, y: m.pos.y + m.vel.y * ahead, z: m.pos.z + m.vel.z * ahead };
      if (Math.hypot(want.x - p.x, want.z - p.z) > 8) m.shown.pos = want;
      else m.shown.pos = { x: p.x + (want.x - p.x) * k, y: p.y + (want.y - p.y) * k, z: p.z + (want.z - p.z) * k };
      m.shown.yaw = angleLerp(m.shown.yaw, m.yaw + m.spin * ahead, k);
      m.shown.aimYaw = angleLerp(m.shown.aimYaw, m.aimYaw, k);
      m.shown.aimPitch += (m.aimPitch - m.shown.aimPitch) * k;
    }
  }
  /** Every slot riding in something. */
  riders() {
    const out = /* @__PURE__ */ new Set();
    for (const m of this.mounts.values()) for (const s of m.seats) if (s >= 0) out.add(s);
    return out;
  }
  /** Every rider (slot) and their seat: the mount and the seat's offset (the seat point riders are drawn on). */
  seatedRiders() {
    const out = /* @__PURE__ */ new Map();
    for (const m of this.mounts.values()) {
      if (!m.alive) continue;
      m.seats.forEach((s, i) => {
        const seat = m.def.seats[i];
        if (s >= 0 && seat) out.set(s, { mount: m.index, offset: seat.offset });
      });
    }
    return out;
  }
  /** Riders in a real seat (SeatDef.seated), drawn sitting: the way the seat faces and its floor under the cushion. */
  sitters() {
    const out = /* @__PURE__ */ new Map();
    for (const m of this.mounts.values())
      m.seats.forEach((s, i) => {
        const seat = m.def.seats[i];
        if (s >= 0 && seat?.seated) out.set(s, { yaw: m.shown.yaw + (seat.facing ?? 0), legDrop: seat.legDrop ?? SEAT_LEG_DROP, straddle: seat.straddle ?? 0 });
      });
    return out;
  }
  /** A resupply vehicle (MountDef.resupply) whose reach point you stand at (Use resupplies there), or null. */
  resupplyInReach(feet) {
    let best = null;
    let bestD = Infinity;
    for (const m of this.mounts.values()) {
      if (!m.alive || !m.def.resupply) continue;
      const d = resupplyReach(m.def.resupply, m.pos, m.yaw, feet);
      if (d !== null && d < bestD) {
        best = m;
        bestD = d;
      }
    }
    return best;
  }
  /** A vehicle in reach whose every seat is taken (the prompt says so instead of offering nothing), or null. */
  fullInReach(feet) {
    for (const m of this.mounts.values()) {
      if (!m.alive || m.def.kind !== "vehicle" || !m.def.seats.length || m.seats.includes(-1) || m.def.airplane) continue;
      if (enterReach(m.def, m.pos, m.yaw, feet) !== null) return m;
    }
    return null;
  }
  /** The mount you would get into from here, and the seat (same rule as the server: driver, then gunner, then passengers). */
  enterable(feet) {
    let best = null;
    let bestD = Infinity;
    for (const m of this.mounts.values()) {
      if (!m.alive || !m.def.seats.length || !m.seats.includes(-1) || m.def.airplane) continue;
      const d = enterReach(m.def, m.pos, m.yaw, feet);
      if (d !== null && d < bestD) {
        best = m;
        bestD = d;
      }
    }
    if (!best) return null;
    for (const role of ["driver", "gunner", "passenger"]) {
      const seat = best.def.seats.findIndex((s, i) => s.role === role && best.seats[i] === -1);
      if (seat >= 0) return { mount: best, seat };
    }
    return null;
  }
}
const RIDER_BLEND_SECONDS = 0.25;
const smooth$1 = (w) => w * w * (3 - 2 * w);
class RiderPlacement {
  blend = /* @__PURE__ */ new Map();
  /** Slots placed on (or easing on or off) a seat by the last `place`: no footsteps for them. */
  placed = /* @__PURE__ */ new Set();
  /**
   * Move the poses of riders (`riders`: slot → seat, from the latest snapshot) onto their seats, in place.
   * `seatPoint(mount, offset)`: that point of the mount as drawn now, or null (the mount is gone).
   */
  place(poses, riders, seatPoint, dt) {
    this.placed.clear();
    const step = Math.max(0, dt) / RIDER_BLEND_SECONDS;
    const seen2 = /* @__PURE__ */ new Set();
    for (const p of poses) {
      seen2.add(p.slot);
      const seat = p.alive ? riders.get(p.slot) : void 0;
      let st = this.blend.get(p.slot);
      if (!p.alive) {
        this.blend.delete(p.slot);
        continue;
      }
      if (seat) {
        if (!st) this.blend.set(p.slot, st = { w: 0, seat });
        st.seat = seat;
        st.w = Math.min(1, st.w + step);
      } else if (st) {
        st.w -= step;
        if (st.w <= 0) {
          this.blend.delete(p.slot);
          continue;
        }
      } else continue;
      const at = seatPoint(st.seat.mount, st.seat.offset);
      if (!at) {
        this.blend.delete(p.slot);
        continue;
      }
      const k = smooth$1(st.w);
      p.x += (at.x - p.x) * k;
      p.y += (at.y - p.y) * k;
      p.z += (at.z - p.z) * k;
      p.grounded = true;
      this.placed.add(p.slot);
    }
    for (const slot of this.blend.keys()) if (!seen2.has(slot)) this.blend.delete(slot);
  }
}
function ownBodyDrawn(o) {
  if (!o.alive) return false;
  if (o.seated) return o.rideView === "chase";
  return o.thirdPerson && !o.tpClose;
}
const BOT_DEBUG_EVERY = Math.round(TICK_RATE / 4);
const MAX_EARLY_MESSAGES = 64;
const MAX_CATCH_UP_TICKS = 4;
const HIDDEN_CATCH_UP_TICKS = 150;
const simWake = {
  wakes: 0,
  ticks: 0,
  maxBatch: 0,
  /** Ticks dropped to resync after falling behind. */
  dropped: 0,
  /** Compressing friends' streams (ms), and the characters compressed. */
  zipMs: 0,
  zipChars: 0,
  /** Time spent ticking (ms) and the slowest single wake. */
  ms: 0,
  maxWakeMs: 0,
  /** Each tick's time (ms, the step and its snapshots), the latest 20,000: perf runs read percentiles. */
  tickMs: [],
  reset() {
    this.wakes = this.ticks = this.maxBatch = this.dropped = this.ms = this.maxWakeMs = this.zipMs = this.zipChars = 0;
    this.tickMs.length = 0;
  }
};
globalThis.__simWake = simWake;
const capOf = (map, rules) => mapPlayerCaps(map, rules.mode).max;
const FRIEND_SILENT_MS = 2e4;
const FRIEND_LOADING_SILENT_MS = 6e4;
const FRIEND_STALLED_SILENT_MS = 6e4;
const LINK_UP_FRESH_MS = 6e3;
function silentLimit(r, now) {
  if (!r.loaded) return FRIEND_LOADING_SILENT_MS;
  return r.upAt !== void 0 && now - r.upAt < LINK_UP_FRESH_MS ? FRIEND_STALLED_SILENT_MS : FRIEND_SILENT_MS;
}
const FRIEND_JOINS_PER_MINUTE = 12;
const SUCCESSOR_KEEP_SECONDS = 30;
class MatchHost {
  constructor(map, opts, sink) {
    this.map = map;
    this.opts = opts;
    this.sink = sink;
  }
  map;
  opts;
  sink;
  stopped = false;
  timer;
  match;
  me;
  mod;
  control;
  bots;
  remotes = /* @__PURE__ */ new Map();
  joins = new KeyedLimiter({ perMinute: FRIEND_JOINS_PER_MINUTE, burst: FRIEND_JOINS_PER_MINUTE });
  /** Browser keys the host banned (this game only). */
  banned = /* @__PURE__ */ new Set();
  hidden = false;
  factsSent = "";
  /**
   * The map rotation's next map (display name) and mode, set by the page that keeps the rotation: a match
   * that ends says so to everyone (round_end `up`), and the page takes everyone there after the scoreboard.
   */
  upNext = null;
  /** Between matches: the vote on the next map (the page picks the maps and travels to the winner; sim/mapVote.ts). */
  vote = null;
  cap = Infinity;
  /** Called with the match once it runs (the page's test hooks). */
  onMatch;
  /** Ticking time and wake count, for perf probes on the page's thread: (ms, ticks) per wake, without delivery to the local player. */
  onWake;
  /** Load the simulation, start the match and its loop. Resolves once the welcome has gone out. */
  async start() {
    const [mod] = await Promise.all([__vitePreload(() => import("./match-DbYBHLX7.js"), true ? __vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40]) : void 0), initPhysics()]);
    await mod.initNavigation();
    if (this.stopped) return;
    const { Match, BotFiller, HostControl } = mod;
    const cp = this.opts.restore;
    const rules = cp?.rules ?? this.opts.rules ?? rulesForMap(this.map);
    const test = this.opts.test;
    const match = new Match(this.map, rules, test ? test.seed : Math.floor(Math.random() * 1e6), { startGate: true });
    const bots = new BotFiller(match, BOT_DIFFICULTIES[cp?.skill ?? this.opts.difficulty], { botSet: this.opts.botSet ?? null });
    const fill = Math.min(cp?.fill ?? this.opts.botFill, MAX_PLAYER_SLOTS);
    let me;
    if (cp) {
      const placed = /* @__PURE__ */ new Map();
      me = bots.restore(cp, fill, { name: this.opts.name, ...this.opts.look ? { look: this.opts.look } : {} }, placed);
      match.resume(cp.phase, cp.timeLeft, cp.teams);
      this.resumeVote(match, me, cp, placed);
      for (const key of cp.banned ?? []) this.banned.add(key);
      if (cp.listing) this.listing = { name: cp.listing.name };
    } else {
      me = match.addHuman(this.opts.name, this.opts.look);
      if (this.opts.party) me.party = this.opts.party;
      if (this.opts.carry) match.applyCarry(me, this.opts.carry);
      const at = this.opts.startAt;
      if (at) match.startHere(me, { pos: { x: at.pos[0], y: at.pos[1], z: at.pos[2] }, yaw: at.yaw, pitch: at.pitch });
    }
    me.account = !!this.opts.verified;
    if (test?.god) me.invulnerable = true;
    const control = new HostControl(match, bots, fill, "Host", Math.max(this.opts.maxPlayers ?? BROWSER_MAX_PLAYERS, fill));
    control.onNextRules = () => this.rulesChanged();
    Object.assign(this, { match, me, mod, control, bots });
    this.cap = capOf(this.map, rules);
    if (!cp) bots.rebalance(control.fill);
    if (!cp && this.opts.spectate) bots.spectate(me.slot, control.fill);
    this.onMatch?.(match, me, mod);
    this.sink.local({ t: "welcome", protocol: PROTOCOL_VERSION, slot: me.slot, maxSlots: MAX_PLAYER_SLOTS, tickRate: TICK_RATE, snapshotInterval: SNAPSHOT_INTERVAL_TICKS, map: this.map, rules, sc: match.scenario.fullState(), spectate: 1 });
    this.sink.local({ t: "roster", players: match.roster() });
    this.sink.local({ t: "host", state: control.state() });
    this.voteToAll();
    this.sendFacts();
    for (const r of this.remotes.values()) {
      const early = r.early ?? [];
      r.early = null;
      for (const text of early) this.message(r.id, text);
    }
    this.loop(match);
  }
  loop(match) {
    let events = [];
    const tickMs = 1e3 / TICK_RATE;
    let next = performance.now();
    let statsAt = next;
    let tickTotal = 0;
    let tickMax = 0;
    let aiTotal = 0;
    let ticks = 0;
    let late = 0;
    let pingRounds = 0;
    const wake = () => {
      if (this.stopped) return;
      const now = performance.now();
      const most = this.hidden ? HIDDEN_CATCH_UP_TICKS : MAX_CATCH_UP_TICKS;
      let n = 0;
      let localMs = 0;
      const w0 = now;
      for (; now >= next && n < most; n++) {
        const s = performance.now();
        const stepped = match.step();
        if (this.upNext) {
          for (const ev of stepped) if (ev.e === "round_end" && !ev.next) ev.up = { ...this.upNext };
        }
        events.push(...stepped);
        if (this.vote) this.tendVote(match, stepped);
        if (match.tick % SNAPSHOT_INTERVAL_TICKS === 0) {
          const snap = match.snapshot(events);
          const l0 = performance.now();
          const me = this.me;
          this.sink.local({ t: "snapshot", ack: me.lastSeq, me: match.privateState(me.slot), ...snap });
          localMs += performance.now() - l0;
          const guests = [...this.remotes.values()].filter((r) => r.slot !== null);
          if (guests.length) {
            const texts = encodeSnapshots(snap, guests.map((r) => ({ slot: r.slot, ack: match.slots[r.slot]?.lastSeq ?? 0, me: match.privateState(r.slot), stream: r.stream })));
            guests.forEach((r, i) => this.sink.send(r.id, texts[i]));
          }
          events = [];
        }
        const ms2 = performance.now() - s;
        if (simWake.tickMs.length < 2e4) simWake.tickMs.push(ms2);
        tickTotal += ms2;
        tickMax = Math.max(tickMax, ms2);
        aiTotal += match.lastAiMs;
        ticks++;
        next += tickMs;
        if (match.tick % 30 === 0) this.sendFacts();
        if (this.botDebugOn && match.tick % BOT_DEBUG_EVERY === 0) this.sendBotDebug(match);
        const bots = this.bots;
        if (bots?.settling && match.tick % Math.round(TICK_RATE / 4) === 0 && this.control && bots.stage(this.control.fill)) {
          this.rosterToAll();
          if (!bots.settling) this.announce({ t: "host", state: this.control.state() });
        }
      }
      if (n) {
        const ms2 = performance.now() - w0;
        simWake.wakes++;
        simWake.ticks += n;
        simWake.maxBatch = Math.max(simWake.maxBatch, n);
        simWake.ms += ms2;
        simWake.maxWakeMs = Math.max(simWake.maxWakeMs, ms2);
        this.onWake?.(ms2 - localMs, n);
      }
      if (now - next > tickMs) {
        const behind = Math.floor((now - next) / tickMs);
        late += behind;
        simWake.dropped += behind;
        next = now;
      }
      if (now - statsAt >= 1e3) {
        statsAt = now;
        const all = match.combatants();
        this.sink.local({
          t: "stats",
          tickMsAvg: ticks ? tickTotal / ticks : 0,
          tickMsMax: tickMax,
          aiMsAvg: ticks ? aiTotal / ticks : 0,
          snapshotBytes: 0,
          bytesPerSecPerClient: 0,
          humans: all.filter((c) => c.kind === "human").length,
          bots: all.filter((c) => c.kind === "bot").length,
          lateTicks: late
        });
        tickTotal = tickMax = aiTotal = ticks = late = 0;
        if (this.remotes.size || match.combatants().some((c) => c.away)) this.watchAway(match);
        if (this.remotes.size || this.successor) this.tendSuccessor(match);
        if (this.remotes.size && ++pingRounds % 2 === 0) {
          const p = [this.me.slot, 0, ...[...this.remotes.values()].flatMap((r) => r.slot !== null && r.rtt !== void 0 ? [r.slot, r.rtt] : [])];
          this.announce({ t: "pings", p });
        }
      }
      this.timer = setTimeout(wake, Math.max(0, next - performance.now()));
    };
    wake();
  }
  /** Once a second: idle friends (never the host's own player), kept places, silent links. */
  watchAway(match) {
    const { bots, control } = this;
    if (!bots || !control) return;
    const friends = [...this.remotes.values()].filter((r) => r.slot !== null);
    const changes = bots.watch(control.fill, new Set(friends.map((r) => r.slot)));
    for (const slot of changes.warn) {
      const r = friends.find((f) => f.slot === slot);
      if (r) this.sink.send(r.id, JSON.stringify({ t: "notice", text: `You're idle: move or a bot plays for you in ${this.mod?.AWAY.warnSeconds ?? 15} s` }));
    }
    for (const slot of changes.away) this.announce({ t: "notice", text: `${match.slots[slot]?.away?.name ?? "A player"} is away: a bot plays for them` });
    for (const slot of changes.kick) {
      const r = friends.find((f) => f.slot === slot);
      if (!r) continue;
      const name = match.slots[slot]?.away?.name ?? "A player";
      this.sink.send(r.id, JSON.stringify({ t: "reject", reason: `Removed for being idle (${this.mod?.AWAY.kickMinutes ?? 10} minutes)` }));
      this.leave(r);
      this.remotes.delete(r.id);
      this.sink.close(r.id, 500);
      this.announce({ t: "notice", text: `${name} was removed for being idle` });
    }
    if (changes.kick.length) this.rosterToAll();
    if (changes.away.length || changes.released.length) this.rosterToAll();
    const now = Date.now();
    const slept = now - this.lastWatch > 5e3 || this.hidden || now - this.pageHeardAt > 5e3;
    this.lastWatch = now;
    for (const r of friends) {
      if (slept) r.heardAt = now;
      else if (now - r.heardAt > silentLimit(r, now)) {
        const up = r.upAt !== void 0 && now - r.upAt < LINK_UP_FRESH_MS;
        console.warn(`closing ${this.match?.slots[r.slot]?.name ?? "a friend"}'s link: silent ${((now - r.heardAt) / 1e3).toFixed(0)} s${r.loaded ? "" : " (loading)"}${up ? " (connection up)" : ""}`);
        this.sink.close(r.id, 0);
        this.closed(r.id);
      }
    }
  }
  /** When watchAway last ran (ms). */
  lastWatch = Date.now();
  /** The page's tab was hidden or shown again (a hidden tab's timers wake rarely: catch up further then). */
  setHidden(hidden) {
    this.hidden = hidden;
  }
  /**
   * The bot debug view (`?botdebug=1`, host or offline: BOT_AI_PLAN.md Phase D item 4): frames a few times a second
   * while on. Not while a friend plays in the match (it shows every bot, enemies included, through walls).
   */
  botDebugOn = false;
  setBotDebug(on) {
    this.botDebugOn = on;
  }
  sendBotDebug(match) {
    for (const r of this.remotes.values()) if (r.slot !== null) return;
    this.sink.botdebug?.(match.botDebugFrame());
  }
  /** When this browser's own player last sent inputs (ms): the page is alive and passing friends' messages on. */
  pageHeardAt = Date.now();
  input(inputs) {
    this.pageHeardAt = Date.now();
    if (this.match && this.me) this.match.queueInputs(this.me.slot, inputs);
  }
  ready() {
    if (this.match && this.me) this.match.ready(this.me.slot);
  }
  /** This browser's own player spectates by choice (a bot fills the place), or joins play again. */
  spectate(on) {
    const { match, me, bots, control } = this;
    if (!match || !me || !bots || !control) return;
    if (on) {
      if (!bots.spectate(me.slot, control.fill)) return;
    } else {
      const back = bots.rejoin(me.slot, control.fill);
      if (!back) return;
      back.account = me.account;
      if (me.invulnerable) back.invulnerable = true;
      this.me = back;
    }
    this.announce({ t: "notice", text: `${me.name} ${on ? "is spectating" : "joined the game"}` }, true);
    this.rosterToAll();
  }
  /** A friend spectates by choice, or joins play again. */
  friendSpectates(r, on) {
    const { match, bots, control } = this;
    if (!match || !bots || !control) return;
    const name = match.slots[r.slot]?.name ?? match.roster().find((p) => p.slot === r.slot)?.name ?? "A player";
    if (!(on ? bots.spectate(r.slot, control.fill) : bots.rejoin(r.slot, control.fill))) return;
    this.announce({ t: "notice", text: `${name} ${on ? "is spectating" : "joined the game"}` });
    this.rosterToAll();
  }
  /** What the local player would take into the next map of a chain (score and weapons). */
  carry() {
    return this.match && this.me && !this.stopped ? this.match.carryOf(this.me) : null;
  }
  /** The match's host settings now (null before it runs). */
  hostState() {
    return this.stopped ? null : this.control?.state() ?? null;
  }
  /**
   * Between matches: the page (which knows our suite) opens the vote on these maps; the scoreboard stays up while
   * everyone votes. Only during the intermission, and only once per match end.
   */
  openVote(options) {
    const { match, me } = this;
    if (!match || !me || this.stopped || this.vote || match.intermissionEnds === null || options.length < 2) return;
    this.vote = new MapVote(options.slice(0, 4), match.tick + VOTE_SECONDS * TICK_RATE, me.slot);
    match.holdIntermission(match.tick + MapVote.ticks() + TICK_RATE);
    this.voteToAll();
  }
  /**
   * Host handoff: the old host's open (or just closed) vote goes on here: the same ballot, everyone's votes on
   * their new places, the time it had left (closed: its winner, as the old host decided it, and the travel).
   */
  resumeVote(match, me, cp, placed) {
    const cv = cp.vote;
    if (!cv || match.intermissionEnds === null) return;
    const votes = cv.votes.flatMap(([i, o]) => {
      const c = placed.get(i);
      return c ? [[c.slot, o]] : [];
    });
    const won = cv.w !== void 0 ? { w: cv.w, ...cv.by ? { by: cv.by } : {} } : null;
    this.vote = MapVote.resumed(cv.o, match.tick + cv.left * TICK_RATE, me.slot, votes, won);
    match.holdIntermission(match.tick + (won ? VOTE_RESULT_SECONDS + 4 : cv.left + VOTE_RESULT_SECONDS + 1) * TICK_RATE);
  }
  /** The open vote for a checkpoint (`order`: the slots in the checkpoint's player order), or undefined. */
  voteCheckpoint(match, order) {
    const v = this.vote;
    if (!v) return void 0;
    const index = new Map(order.map((slot, i) => [slot, i]));
    const st = v.state(match.tick);
    const votes = v.ballots().flatMap(([slot, o]) => index.has(slot) ? [[index.get(slot), o]] : []);
    return { o: st.o, votes, left: st.left, ...st.w !== void 0 ? { w: st.w, ...st.by ? { by: st.by } : {} } : {} };
  }
  /** This browser's player votes (the host: its vote breaks a tie). */
  voteLocal(i) {
    if (this.me) this.castVote(this.me.slot, i);
  }
  castVote(slot, i) {
    if (this.vote?.cast(slot, i)) this.voteToAll();
  }
  voteToAll() {
    const v = this.vote;
    if (!v || !this.match) return;
    this.announce({ t: "vote", v: v.state(this.match.tick) });
    this.checkpointAt = 0;
  }
  /** Each tick of an open vote: close it on time (the page travels to the winner), a fresh count every second; over once a round starts. */
  tendVote(match, stepped) {
    const v = this.vote;
    if (stepped.some((e) => e.e === "round_start")) {
      this.vote = null;
      return this.announce({ t: "vote", v: null });
    }
    if (v.closed) return;
    match.holdIntermission(v.planned + (VOTE_RESULT_SECONDS + 1) * TICK_RATE);
    if (v.tick(match.tick, match.intermissionEnds)) {
      match.holdIntermission(match.tick + (VOTE_RESULT_SECONDS + 4) * TICK_RATE);
      this.voteToAll();
    } else if (match.tick % TICK_RATE === 0) this.voteToAll();
  }
  /** Where the map rotation goes after this match (null: nowhere, the match replays). */
  setUpNext(next) {
    this.upNext = next;
  }
  /** The host's controls (bots, skill, style, restart, end). Returns the error, if it was refused. */
  command(cmd) {
    const c = this.control;
    if (!c || this.stopped) return "The match has not started";
    if (cmd.c === "kick" || cmd.c === "ban") {
      const r2 = [...this.remotes.values()].find((x) => x.slot === cmd.slot);
      if (!r2 || r2.slot === null) return cmd.slot === this.me?.slot ? "You can't remove yourself" : "Only friends who joined can be removed (bots come and go by themselves)";
      const name = this.match?.slots[r2.slot]?.name ?? "A player";
      if (cmd.c === "ban" && r2.pk) this.banned.add(r2.pk);
      const why = cmd.reason ? `: ${cmd.reason}` : "";
      this.sink.send(r2.id, JSON.stringify({ t: "reject", reason: cmd.c === "ban" ? `You were banned from this game${why}` : `The host removed you from the game${why}` }));
      this.leave(r2);
      this.remotes.delete(r2.id);
      this.sink.close(r2.id, 500);
      this.announce({ t: "notice", text: `${name} was ${cmd.c === "ban" ? "banned" : "kicked"}` });
      this.rosterToAll();
      return null;
    }
    const r = c.apply(cmd);
    if (r.error) return r.error;
    if (r.notice) this.announce({ t: "notice", text: r.notice });
    if (cmd.c === "restart" || cmd.c === "rules") this.announce({ t: "rules", rules: c.match.rules });
    this.announce({ t: "roster", players: c.match.roster() });
    this.announce({ t: "host", state: c.state() });
    this.sendFacts();
    return null;
  }
  /** The rules in play changed by themselves (a new round began with the ones saved for it): everyone's HUD, and the host's panel, follow. */
  rulesChanged() {
    const c = this.control;
    if (!c || this.stopped) return;
    this.announce({ t: "rules", rules: c.match.rules });
    this.announce({ t: "host", state: c.state() });
    this.sendFacts();
  }
  /** Go offline: every friend is told why and disconnected, and bots take their places again. */
  dropGuests(reason) {
    const text = JSON.stringify({ t: "reject", reason });
    for (const r of [...this.remotes.values()]) {
      if (r.slot !== null) {
        this.sink.send(r.id, text);
        this.leave(r);
      }
      this.remotes.delete(r.id);
      this.sink.close(r.id, 500);
    }
    if (this.control && !this.stopped) this.announce({ t: "roster", players: this.control.match.roster() });
  }
  /** Tell everyone something ("Changing map to …"); `guestsOnly` when the page has shown it to its player already. */
  notice(text, guestsOnly = false) {
    this.announce({ t: "notice", text }, guestsOnly);
  }
  /** A friend's link opened (Host game). Before the match runs, what they say waits for it. */
  open(id, zip = false) {
    if (this.stopped || this.opts.test) return this.sink.close(id, 0);
    this.remotes.set(id, { id, slot: null, early: this.match ? null : [], stream: new SnapshotStream(), heardAt: Date.now() });
    if (zip) this.sink.compress?.(id);
  }
  /** Text from a friend's link. */
  message(id, text) {
    const r = this.remotes.get(id);
    const { match, bots, control } = this;
    if (!r) return;
    r.heardAt = Date.now();
    if (r.early || !match || !bots || !control) return void (r.early && r.early.length < MAX_EARLY_MESSAGES && r.early.push(text));
    const msg = parseClientMessage(text);
    if (!msg) return;
    if (msg.t === "hello" && r.slot === null) {
      if (msg.protocol !== PROTOCOL_VERSION) {
        this.sink.send(id, JSON.stringify({ t: "reject", reason: `protocol ${msg.protocol} unsupported (host speaks ${PROTOCOL_VERSION})` }));
        return this.drop(id);
      }
      if (msg.pk && (this.banned.has(msg.pk) || this.banned.has(handoffKey(`pk:${msg.pk}`)))) {
        this.sink.send(id, JSON.stringify({ t: "reject", reason: "You were banned from this game" }));
        return this.drop(id);
      }
      r.pk = msg.pk;
      if (this.guests >= BROWSER_HOST_MAX_GUESTS) {
        this.sink.send(id, JSON.stringify({ t: "reject", reason: `match full (a player-hosted game takes up to ${BROWSER_HOST_MAX_GUESTS} friends)` }));
        return this.drop(id);
      }
      if (!this.joins.allow("all")) {
        this.sink.send(id, JSON.stringify({ t: "reject", reason: "Too many people are joining right now: try again in a minute" }));
        return this.drop(id);
      }
      const name = r.account?.name ?? sanitizeName(msg.name);
      const key = r.account ? `sub:${r.account.sub}` : msg.pk ? `pk:${msg.pk}` : null;
      const old = key ? [...this.remotes.values()].find((o) => o !== r && o.slot !== null && (o.account ? `sub:${o.account.sub}` : o.pk ? `pk:${o.pk}` : null) === key) : void 0;
      if (old) {
        console.warn(`${name}'s new link replaces their old one`);
        this.remotes.delete(old.id);
        bots.hold(old.slot, "dropped", key, control.fill);
        this.sink.guest(old.id, null);
        this.sink.close(old.id, 0);
      }
      const back = key ? bots.reclaim(key, name) ?? bots.reclaim(handoffKey(key), name) : null;
      const people = match.combatants().filter((c) => c.kind === "human").length + match.spectatorCount;
      const most = Math.max(this.cap, control.fill);
      if (!back && people >= most) {
        this.sink.send(id, JSON.stringify({ t: "reject", reason: `match full (${this.map.metadata.name} takes ${most} players in this mode)` }));
        return this.drop(id);
      }
      const player = back ?? bots.join(name, msg.look, control.fill, msg.party);
      if (!player) {
        this.sink.send(id, JSON.stringify({ t: "reject", reason: "match full" }));
        return this.drop(id);
      }
      r.slot = player.slot;
      player.account = !!r.account?.name;
      this.sink.guest(id, player.slot);
      this.sink.send(id, JSON.stringify({ t: "welcome", protocol: PROTOCOL_VERSION, slot: player.slot, maxSlots: MAX_PLAYER_SLOTS, tickRate: TICK_RATE, snapshotInterval: SNAPSHOT_INTERVAL_TICKS, map: this.map, rules: match.rules, sc: match.scenario.fullState(), spectate: 1 }));
      if (back) this.announce({ t: "notice", text: `${name} is back` });
      this.rosterToAll();
      if (this.vote) this.sink.send(id, JSON.stringify({ t: "vote", v: this.vote.state(match.tick) }));
      if (this.successorSent) this.sink.send(id, this.successorSent);
    } else if (msg.t === "input" && r.slot !== null) {
      if (bots.input(r.slot, msg.inputs)) {
        this.announce({ t: "notice", text: `${match.slots[r.slot]?.name ?? "A player"} is back` });
        this.rosterToAll();
      }
    } else if (msg.t === "spectate" && r.slot !== null) this.friendSpectates(r, msg.on);
    else if (msg.t === "vote" && r.slot !== null) this.castVote(r.slot, msg.i);
    else if (msg.t === "ready" && r.slot !== null) {
      r.loaded = true;
      match.ready(r.slot);
    } else if (msg.t === "ping") {
      if (msg.rtt !== void 0) r.rtt = msg.rtt;
      this.sink.send(id, JSON.stringify({ t: "pong", id: msg.id, ct: msg.ct }));
    } else if (msg.t === "standby" && r.slot !== null) this.standingBy(r, msg.code);
    else if ((msg.t === "host" || msg.t === "admin") && r.slot !== null) this.sink.send(id, JSON.stringify({ t: "host", state: null, error: "Only the host can change the match" }));
  }
  /** A friend's link closed: a bot plays their place, kept a while for them to reconnect (or, with no key, takes it over). */
  /** The page saw this friend's connection up (every few seconds): a silent friend with it up gets longer (FRIEND_STALLED_SILENT_MS). */
  linkUp(id) {
    const r = this.remotes.get(id);
    if (r) r.upAt = Date.now();
  }
  closed(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    this.remotes.delete(id);
    if (r.slot === null || this.stopped || !this.control) return;
    if (this.vote?.forget(r.slot)) this.voteToAll();
    this.control.bots.hold(r.slot, "dropped", r.account ? `sub:${r.account.sub}` : r.pk ? `pk:${r.pk}` : null, this.control.fill);
    this.sink.guest(r.id, null);
    this.rosterToAll();
  }
  /**
   * Host handoff: the friend named to take over (asked to stand by until `code` comes back), when they were
   * asked, and since when they've been ready (their code came).
   */
  successor = null;
  /**
   * A friend with a clearly better connection, asked to stand by to replace a successor that is ready: the
   * successor stays named until they answer, so the match is never without one in between.
   */
  candidate = null;
  /** Friends who were asked and never answered (they aren't asked again), and everyone asked. */
  passedOver = /* @__PURE__ */ new Set();
  asked = /* @__PURE__ */ new Set();
  checkpointAt = 0;
  /** The successor message friends were last sent ('' before any). */
  successorSent = "";
  /** The game browser listing (the page tells us), for the successor to carry on. */
  listing = null;
  /** The page listed (or unlisted) the match in the game browser. */
  setListing(listing) {
    this.listing = listing;
  }
  /** A friend's key as the match holds places by it: their account, else their browser key. */
  keyOf(r) {
    return r.account ? `sub:${r.account.sub}` : r.pk ? `pk:${r.pk}` : null;
  }
  /**
   * Once a second with friends in: keep one of them named successor (the best connection, asked to stand
   * by first), tell everyone who it is and its code, and send it a fresh checkpoint every few seconds.
   */
  tendSuccessor(match) {
    const now = Date.now();
    const friends = [...this.remotes.values()].filter((r) => r.slot !== null && !match.slots[r.slot]?.away);
    let s = this.successor;
    const current = s ? friends.find((r) => r.id === s.id) : void 0;
    if (s && !current) s = null;
    if (s && !s.code && now - s.askedAt > STANDBY_ANSWER_SECONDS * 1e3) {
      this.passedOver.add(s.id);
      s = null;
    }
    let c = this.candidate;
    if (c && (!friends.some((r) => r.id === c.id) || now - c.askedAt > STANDBY_ANSWER_SECONDS * 1e3)) {
      this.passedOver.add(c.id);
      c = null;
    }
    const rtt = (r) => r.rtt ?? 999;
    const best = friends.filter((r) => !this.passedOver.has(r.id)).sort((a, b) => rtt(a) - rtt(b) || a.id - b.id)[0];
    if (!s && c) {
      s = { id: c.id, code: null, askedAt: c.askedAt, since: 0 };
      c = null;
    } else if (!s && best) {
      s = { id: best.id, code: null, askedAt: now, since: 0 };
      this.ask(best.id);
    } else if (s?.code && current && best && !c && best.id !== s.id && rtt(best) + 80 < rtt(current) && rtt(best) < rtt(current) * 0.6 && now - s.since >= SUCCESSOR_KEEP_SECONDS * 1e3) {
      c = { id: best.id, askedAt: now };
      this.ask(best.id);
    }
    this.candidate = c;
    this.successor = s;
    this.announceSuccessor();
    this.sendFacts();
    if (s?.code && now - this.checkpointAt >= CHECKPOINT_EVERY_SECONDS * 1e3) this.sendCheckpoint();
  }
  /**
   * A friend asked to stand by answered with its code: it's the successor now. A late answer (we'd moved on
   * to asking someone else) still counts while nobody else is ready. Friends never asked are ignored.
   */
  standingBy(r, code) {
    const s = this.successor;
    if (!this.asked.has(r.id) || r.slot === null || !isJoinCode(code)) return;
    const replacing = this.candidate?.id === r.id;
    if (s?.code && s.id !== r.id && !replacing) return;
    if (replacing) this.candidate = null;
    this.passedOver.delete(r.id);
    this.successor = { id: r.id, code, askedAt: s?.id === r.id ? s.askedAt : Date.now(), since: s?.id === r.id && s.code === code ? s.since : Date.now() };
    this.announceSuccessor();
    this.sendFacts();
    this.sendCheckpoint();
  }
  /** Ask a friend to stand by (open a join code of their own to take the match over on). */
  ask(id) {
    this.asked.add(id);
    this.sink.send(id, JSON.stringify({ t: "standby" }));
  }
  /** Tell every friend who takes over (and where), when that changes. */
  announceSuccessor() {
    const s = this.successor;
    const r = s?.code ? this.remotes.get(s.id) : void 0;
    const msg = s?.code && r && r.slot !== null ? { t: "successor", code: s.code, slot: r.slot, name: this.match?.slots[r.slot]?.name ?? "A player" } : { t: "successor", code: "" };
    const text = JSON.stringify(msg);
    if (text === this.successorSent || !this.successorSent && !s?.code) return;
    this.successorSent = text;
    for (const g of this.remotes.values()) if (g.slot !== null) this.sink.send(g.id, text);
  }
  /** The match as it stands, to the successor only. */
  sendCheckpoint() {
    const s = this.successor;
    const r = s ? this.remotes.get(s.id) : void 0;
    if (!s?.code || !r || r.slot === null) return;
    const cp = this.checkpoint(r.slot);
    if (!cp) return;
    this.checkpointAt = Date.now();
    this.sink.send(r.id, JSON.stringify({ t: "checkpoint", cp }));
  }
  /** A checkpoint of the match for a successor at `successor` (net/handoff.ts): people by hashed key only. */
  checkpoint(successor) {
    const { match, control, bots, me } = this;
    if (!match || !control || !bots || this.stopped) return null;
    const keys2 = /* @__PURE__ */ new Map();
    for (const r of this.remotes.values()) {
      const key = r.slot !== null ? this.keyOf(r) : null;
      if (key) keys2.set(r.slot, key);
    }
    const keyOf = (c) => {
      const key = keys2.get(c.slot) ?? (c === me ? this.opts.selfKey : c.away?.key) ?? null;
      return key ? handoffKey(key) : null;
    };
    const teams = match.mode ? [...match.mode.teamScores()] : void 0;
    return {
      v: 1,
      map: this.map.metadata.id,
      rules: match.rules,
      phase: match.phase,
      timeLeft: match.timeLeftSeconds(),
      fill: control.fill,
      skill: bots.skill.id,
      ...teams?.length ? { teams } : {},
      players: match.checkpointPlayers(keyOf, successor),
      .../* @__PURE__ */ ((squads) => squads ? { squads } : {})(match.checkpointSquads()),
      .../* @__PURE__ */ ((vote) => vote ? { vote } : {})(this.voteCheckpoint(match, match.combatants().map((c) => c.slot))),
      ...this.banned.size ? { banned: [...this.banned].map((k) => k.startsWith("h:") ? k : handoffKey(`pk:${k}`)) } : {},
      ...this.listing ? { listing: { name: this.listing.name } } : {}
    };
  }
  /** The page checked a friend's account ticket (their hello follows). */
  verified(id, sub, name) {
    const r = this.remotes.get(id);
    if (r && r.slot === null) r.account = { sub, ...name ? { name } : {} };
  }
  /** Friends playing in this match. */
  get guests() {
    return [...this.remotes.values()].filter((r) => r.slot !== null).length;
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    clearTimeout(this.timer);
    this.match?.destroy();
  }
  /** Test hook: run `src` (a function's source) against the match: `(match, me, arg, module) => …`. */
  evaluate(src, arg) {
    if (!this.match) throw new Error("The match has not started");
    const fn = new Function(`return (${src})`)();
    return fn(this.match, this.me, arg, this.mod);
  }
  /** Test hook: hand the local player a weapon, full. */
  give(id) {
    const me = this.me;
    if (!me) return;
    const def = getWeapon(id);
    me.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: def.alt?.max ?? 0 });
    me.current = weaponCode(def);
    me.raiseTicks = 0;
  }
  drop(id) {
    this.remotes.delete(id);
    this.sink.close(id, 0);
  }
  leave(r) {
    if (r.slot !== null && this.control && !this.stopped) this.control.bots.leave(r.slot, this.control.fill);
    r.slot = null;
    this.sink.guest(r.id, null);
  }
  rosterToAll() {
    if (this.match) this.announce({ t: "roster", players: this.match.roster() });
  }
  /** Notices, rosters and the host's settings: to this player, and (except the settings) to every friend. */
  announce(msg, guestsOnly = false) {
    if (!guestsOnly) this.sink.local(msg);
    if (msg.t === "host") return;
    const text = JSON.stringify(msg);
    for (const r of this.remotes.values()) if (r.slot !== null) this.sink.send(r.id, text);
  }
  sendFacts() {
    const c = this.control;
    if (!c || !this.match || !this.me || this.stopped) return;
    const facts = { state: c.state(), rules: this.match.rules, carry: this.match.carryOf(this.me), ...this.successor?.code ? { successor: this.successor.id } : {} };
    const key = JSON.stringify(facts);
    if (key === this.factsSent) return;
    this.factsSent = key;
    this.sink.facts(facts);
  }
}
function sinkTo(post) {
  const zips = /* @__PURE__ */ new Map();
  return {
    local: (msg) => post({ k: "local", msg }),
    send: (id, text) => {
      const zip = zips.get(id);
      if (!zip) return post({ k: "send", id, text });
      const t0 = performance.now();
      const pieces = zip.pieces(text);
      simWake.zipMs += performance.now() - t0;
      simWake.zipChars += text.length;
      post({ k: "bytes", id, pieces }, pieces.map((p) => p.buffer));
    },
    compress: (id) => void zips.set(id, new Zipper()),
    close: (id, delay) => {
      zips.delete(id);
      post({ k: "close", id, delay });
    },
    guest: (id, slot) => post({ k: "guest", id, slot }),
    facts: (facts) => post({ k: "facts", facts }),
    botdebug: (f) => post({ k: "botdebug", f })
  };
}
function dispatchToHost(host, m, post) {
  switch (m.k) {
    case "input":
      return host.input(m.inputs);
    case "ready":
      return host.ready();
    case "spectate":
      return host.spectate(m.on);
    case "cmd": {
      const error = host.command(m.cmd);
      if (error) post({ k: "local", msg: { t: "host", state: host.hostState(), error } });
      return;
    }
    case "upnext":
      return host.setUpNext(m.next);
    case "voteopen":
      return host.openVote(m.options);
    case "vote":
      return host.voteLocal(m.i);
    case "drop":
      return host.dropGuests(m.reason);
    case "notice":
      return host.notice(m.text, m.guestsOnly);
    case "open":
      return host.open(m.id, m.zip);
    case "msg":
      return host.message(m.id, m.text);
    case "verified":
      return host.verified(m.id, m.sub, m.name);
    case "closed":
      return host.closed(m.id);
    case "up":
      return host.linkUp(m.id);
    case "hidden":
      return host.setHidden(m.v);
    case "listing":
      return host.setListing(m.listing);
    case "give":
      return host.give(m.id);
    case "botdebug":
      return host.setBotDebug(m.on);
    case "eval":
      try {
        post({ k: "eval", req: m.req, ok: true, value: host.evaluate(m.src, m.arg) });
      } catch (err) {
        post({ k: "eval", req: m.req, ok: false, error: err.message });
      }
      return;
    case "stop":
      return host.stop();
    case "warm":
      return;
  }
}
let keys = null;
let fetchedAt = 0;
const seen = /* @__PURE__ */ new Map();
function hubKeys(force = false) {
  if (!keys || force && Date.now() - fetchedAt > 3e4) {
    fetchedAt = Date.now();
    const url = hubApi("ticket-keys");
    keys = url ? fetch(url, { signal: AbortSignal.timeout(6e3) }).then((r) => r.ok ? r.json() : { keys: [] }).then((j) => new Map((j.keys ?? []).flatMap((k) => typeof k.kid === "string" && typeof k.x === "string" && k.x.length < 100 ? [[k.kid, k.x]] : []))).catch(() => /* @__PURE__ */ new Map()) : Promise.resolve(/* @__PURE__ */ new Map());
  }
  return keys;
}
const unb64 = (s) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
async function checkTicket(ticket, code) {
  if (typeof ticket !== "string" || ticket.length > 1e3 || typeof crypto === "undefined" || !crypto.subtle) return null;
  const [body, sig] = ticket.split(".");
  if (!body || !sig) return null;
  let claims;
  try {
    claims = JSON.parse(new TextDecoder().decode(unb64(body)));
  } catch {
    return null;
  }
  if (typeof claims.kid !== "string" || typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 128) return null;
  if (claims.code !== code || typeof claims.exp !== "number" || claims.exp * 1e3 < Date.now() || typeof claims.jti !== "string") return null;
  if (claims.name !== void 0 && !(typeof claims.name === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]{2,15}$/.test(claims.name))) return null;
  let x = (await hubKeys()).get(claims.kid);
  if (!x) x = (await hubKeys(true)).get(claims.kid);
  if (!x) return null;
  try {
    const key = await crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x }, { name: "Ed25519" }, false, ["verify"]);
    if (!await crypto.subtle.verify({ name: "Ed25519" }, key, unb64(sig), new TextEncoder().encode(body))) return null;
  } catch {
    return null;
  }
  const now = Date.now();
  for (const [j, exp] of seen) if (exp * 1e3 < now) seen.delete(j);
  if (seen.has(claims.jti)) return null;
  seen.set(claims.jti, claims.exp);
  return { sub: claims.sub, ...typeof claims.name === "string" ? { name: claims.name } : {} };
}
function helloTicket(text) {
  if (text.length > 4096 || !text.includes('"ticket"')) return null;
  try {
    const m = JSON.parse(text);
    return m.t === "hello" && typeof m.ticket === "string" ? m.ticket : null;
  } catch {
    return null;
  }
}
class PlayTracker {
  constructor(now = () => Date.now()) {
    this.now = now;
  }
  now;
  open = /* @__PURE__ */ new Map();
  /** Finished stays by account: the time played, and whether any lasted past EARLY_QUIT_MINUTES. */
  done = /* @__PURE__ */ new Map();
  /** A friend's link (`id`) proved this account. */
  joined(id, sub) {
    this.open.set(id, { sub, from: this.now() });
  }
  /** A friend's link closed. */
  left(id) {
    const s = this.open.get(id);
    if (!s) return;
    this.open.delete(id);
    this.add(s.sub, this.now() - s.from);
  }
  add(sub, ms2) {
    const d = this.done.get(sub) ?? { ms: 0, stayed: false };
    d.ms += ms2;
    d.stayed ||= ms2 >= EARLY_QUIT_MINUTES * 6e4;
    this.done.set(sub, d);
  }
  /**
   * The report as the match ends: everyone still in stops now. `host`: the host's own account (signed in) and when
   * the match started. Reading it closes every stay (a tracker reports once).
   */
  report(code, contentHash, host) {
    const t = this.now();
    for (const id of [...this.open.keys()]) this.left(id);
    if (host) this.add(host.sub, t - host.since);
    const players = [...this.done].slice(0, MAX_REPORTED_PLAYERS).map(([sub, d]) => ({ sub, minutes: Math.round(d.ms / 6e4 * 10) / 10, early: !d.stayed }));
    this.done.clear();
    return { code, contentHash, players };
  }
}
const SIM_KEY = "tiletrigger.sim";
const LINK_UP_EVERY_MS = 2e3;
function simThreadWanted() {
  if (typeof Worker === "undefined") return "main";
  try {
    if (new URLSearchParams(location.search).get("sim") === "main") return "main";
    if (localStorage.getItem(SIM_KEY) === "main") return "main";
  } catch {
  }
  return "worker";
}
let spare = null;
function newSimWorker() {
  return new Worker(new URL(
    /* @vite-ignore */
    "/assets/simWorker-B6CnIta7.js",
    import.meta.url
  ), { type: "module", name: "match" });
}
function prewarmSimWorker() {
  if (spare || simThreadWanted() !== "worker") return;
  try {
    const w = newSimWorker();
    w.onerror = () => {
      w.terminate();
      if (spare === w) spare = null;
    };
    w.postMessage({ k: "warm" });
    spare = w;
  } catch {
    spare = null;
  }
}
class LocalTransport {
  constructor(map, opts) {
    this.map = map;
    this.opts = opts;
  }
  map;
  opts;
  label = "local";
  rttMs = 0;
  bytesIn = 0;
  /** Time from start() to the welcome message, for the TEST transition budget. */
  startupMs = 0;
  /** Where the match runs (known once started). */
  thread = null;
  stopped = false;
  worker;
  inThread;
  /** What we've told the host before it existed (and, with a worker, until it welcomed us: replayed if it fails). */
  early = [];
  welcomed = false;
  facts = null;
  /** Friends playing in this match (Host game), by the id the host knows them by. */
  links = /* @__PURE__ */ new Map();
  nextLink = 1;
  /** Friends were sent `travel`: give it time to arrive before their links close. */
  departing = false;
  /** Every few seconds: which friends' links are up (the match gives a stalled friend longer: MatchHost.linkUp). */
  upTimer;
  evals = /* @__PURE__ */ new Map();
  nextEval = 1;
  onVisibility;
  onMessage;
  onBotDebug;
  onClose;
  /** With the match in a worker: a page that fell behind handles the snapshots waiting for it as one. */
  snapshots;
  /**
   * The in-game bot debug view (`?botdebug=1`, host or offline: game/botDebugView.ts): frames from the match a few
   * times a second while `onFrame` is given; null turns it off.
   */
  botDebug(onFrame) {
    this.onBotDebug = onFrame ?? void 0;
    if (this.worker || this.inThread) this.toHost({ k: "botdebug", on: !!onFrame });
  }
  /** A browser test's deterministic match (testMode.ts): offline only. */
  get testMode() {
    return !!this.opts.test;
  }
  /** What the local player would take into the next map of a chain (score and weapons), or null before the match runs. */
  carry() {
    if (this.stopped) return null;
    return this.inThread ? this.inThread.carry() : this.facts?.carry ?? null;
  }
  /**
   * How many people can play: friends take bots' places up to the match's size,
   * and the host's browser takes BROWSER_HOST_MAX_GUESTS friends at most (its upload carries their snapshots).
   */
  get capacity() {
    return Math.max(1, Math.min(this.facts?.state.fill ?? this.opts.botFill, MAX_PLAYER_SLOTS, 1 + BROWSER_HOST_MAX_GUESTS));
  }
  /** The match's host settings now (null before it runs). */
  hostState() {
    return this.stopped ? null : this.facts?.state ?? null;
  }
  /** The rules the match plays now (the host may have changed team sizes and bot style), or null before it runs. */
  liveRules() {
    return this.stopped ? null : this.facts?.rules ?? null;
  }
  /**
   * The host runs the match (this browser's player: offline, or Host game).
   * A map change is the session's (it restarts the match on the new map);
   * everything else happens there, live. A refused command comes back as a
   * `host` message with its error. Friends can't: their commands are refused.
   */
  host(cmd) {
    if (this.stopped || !this.facts) return "The match has not started";
    this.toHost({ k: "cmd", cmd });
    return null;
  }
  /** Where the map rotation (kept by the page) goes after this match: the end-of-match scoreboard says so to everyone. */
  setUpNext(next) {
    this.toHost({ k: "upnext", next });
  }
  /** Go offline: every friend is told why and disconnected, and bots take their places again (the match carries on). */
  dropGuests(reason) {
    this.toHost({ k: "drop", reason });
  }
  /**
   * The game browser listing (or none): if the match is handed on, the successor lists it under the same name.
   * Its ID and secret stay on this page until we leave: then the successor gets them with its goodbye (sayGoodbye).
   */
  setListing(listing) {
    this.listing = listing?.id && listing.secret ? { id: listing.id, secret: listing.secret } : null;
    this.toHost({ k: "listing", listing: listing ? { name: listing.name } : null });
  }
  listing = null;
  /** Tell everyone the map is about to change ("Changing map to …"). */
  notice(text) {
    if (!this.stopped) this.onMessage?.({ t: "notice", text });
    this.toHost({ k: "notice", text, guestsOnly: true });
  }
  /** Host game, map change: friends get `travel` and reconnect by themselves to the same join code, where the next match lets them in. */
  travelGuests(mapName) {
    const text = JSON.stringify({ t: "travel", map: mapName });
    for (const r of this.links.values()) if (r.slot !== null) r.link.send(text);
    this.departing = true;
  }
  /**
   * This host is leaving on purpose (left the match, the tab is closing): every friend is told (`bye`) before the
   * links close, so they know it wasn't a network drop. Sent from the page: the match may stop before it could.
   */
  sayGoodbye() {
    if (this.departing || this.stopped || this.saidBye) return;
    const text = JSON.stringify({ t: "bye" });
    const heir = this.listing && this.facts?.successor !== void 0 ? this.facts.successor : null;
    const theirs = JSON.stringify({ t: "bye", ...this.listing ? { listing: this.listing } : {} });
    for (const [id, r] of this.links) if (r.slot !== null) r.link.send(id === heir ? theirs : text);
    this.saidBye = true;
  }
  saidBye = false;
  /** Players connected from elsewhere (Host game). */
  get guests() {
    return [...this.links.values()].filter((r) => r.slot !== null).length;
  }
  start(onMessage, onClose) {
    const t0 = performance.now();
    this.onMessage = (m) => {
      if (m.t === "welcome" && !this.welcomed) {
        this.welcomed = true;
        this.early = [];
        this.startupMs = performance.now() - t0;
      }
      onMessage(m);
    };
    this.onClose = onClose;
    this.onVisibility = () => this.toHost({ k: "hidden", v: document.hidden });
    if (typeof document.addEventListener === "function") document.addEventListener("visibilitychange", this.onVisibility);
    if (typeof window.addEventListener === "function") window.addEventListener("pagehide", this.onPageHide);
    const start = { k: "start", map: this.map, opts: { selfKey: `pk:${playerKey()}`, maxPlayers: deviceMaxPlayers(), ...this.opts }, hidden: document.hidden };
    if (!(simThreadWanted() === "worker" && this.startWorker(start))) this.startHere(start);
    if (this.onBotDebug) this.toHost({ k: "botdebug", on: true });
  }
  /** The match in a module worker. False when one can't be made here. */
  startWorker(start) {
    let worker;
    try {
      worker = spare ?? newSimWorker();
      spare = null;
    } catch {
      return false;
    }
    this.worker = worker;
    this.thread = "worker";
    this.snapshots = new SnapshotCoalescer((m) => {
      if (!this.stopped) this.onMessage?.(m);
    });
    worker.onmessage = (e) => this.receive(e.data);
    worker.onerror = (e) => {
      e.preventDefault();
      if (this.stopped) return;
      if (!this.welcomed) {
        console.warn("match worker failed, running the match on the page instead", e.message);
        return this.fallBack(start);
      }
      const error = new Error(`match worker: ${e.message || "error"}`);
      window.setTimeout(() => {
        throw error;
      });
    };
    worker.postMessage(start);
    for (const m of this.early) worker.postMessage(m);
    this.installHooks();
    return true;
  }
  /** The match on the page's own thread (no workers, or asked for). */
  startHere(start) {
    if (start.k !== "start") return;
    this.thread = "main";
    const post = (m) => this.receive(m);
    const host = new MatchHost(start.map, start.opts, sinkTo(post));
    this.inThread = host;
    host.setHidden(start.hidden);
    host.onWake = (ms2, ticks) => perfProbe.on && perfProbe.addSim(ms2, ticks);
    host.onMatch = (match) => window.__match = match;
    const early = this.early.splice(0);
    for (const m of early) if (m.k !== "start") dispatchToHost(host, m, post);
    this.installHooks();
    host.start().catch((e) => post({ k: "failed", error: e.message }));
  }
  fallBack(start) {
    this.worker?.terminate();
    this.worker = void 0;
    this.snapshots = void 0;
    this.startHere(start);
  }
  installHooks() {
    const transport = this;
    const hook = {
      mode: this.thread ?? "main",
      get backlog() {
        return transport.snapshots?.backlog ?? null;
      },
      eval: (src, arg) => new Promise((resolve, reject) => {
        const req = this.nextEval++;
        this.evals.set(req, { resolve, reject });
        this.toHost({ k: "eval", req, src, arg });
      })
    };
    const w = window;
    w.__sim = hook;
    w.__give = (id) => this.toHost({ k: "give", id });
  }
  /** To the match: posted to the worker, called on this thread, or kept until there is a match. */
  toHost(m) {
    if (this.stopped) return;
    if (this.worker) {
      if (!this.welcomed) this.early.push(m);
      this.worker.postMessage(m);
    } else if (this.inThread) dispatchToHost(this.inThread, m, (r) => this.receive(r));
    else this.early.push(m);
  }
  /** From the match. */
  receive(m) {
    if (this.stopped) return;
    switch (m.k) {
      case "local":
        if (this.snapshots) return this.snapshots.push(m.msg);
        return this.onMessage?.(m.msg);
      case "facts":
        this.facts = m.facts;
        return;
      case "send":
        return this.links.get(m.id)?.link.send(m.text);
      case "bytes":
        return this.links.get(m.id)?.link.sendPieces?.(m.pieces);
      case "close": {
        const r = this.links.get(m.id);
        this.links.delete(m.id);
        if (r) window.setTimeout(() => r.link.close(), m.delay);
        return;
      }
      case "guest": {
        const r = this.links.get(m.id);
        if (r) r.slot = m.slot;
        return;
      }
      case "failed":
        return this.fail(`local match failed: ${m.error}`);
      case "botdebug":
        return this.onBotDebug?.(m.f);
      case "eval": {
        const p = this.evals.get(m.req);
        this.evals.delete(m.req);
        if (m.ok) p?.resolve(m.value);
        else p?.reject(new Error(m.error));
        return;
      }
    }
  }
  fail(reason) {
    const cb = this.onClose;
    this.close();
    cb?.(reason);
  }
  /** This game's join code while it's hosted (friends' account tickets are for it); set by the session. */
  joinCode = null;
  /** Signed-in friends and how long they played (the end-of-match report on a community map: communityPlays.ts). */
  plays = new PlayTracker();
  /** Let a friend into this match (Host game). Links arriving while the match loads wait for it (a map change brings everyone back at once). */
  accept(link) {
    if (this.stopped || this.testMode) return link.close();
    const id = this.nextLink++;
    this.links.set(id, { link, slot: null });
    this.toHost({ k: "open", id, ...link.zip ? { zip: true } : {} });
    this.upTimer ??= window.setInterval(() => {
      for (const [lid, r] of this.links) if (r.link.connected?.()) this.toHost({ k: "up", id: lid });
    }, LINK_UP_EVERY_MS);
    let held = null;
    let first = true;
    link.onMessage((text) => {
      if (held) return void (held.length < 64 && held.push(text));
      const ticket = first ? helloTicket(text) : null;
      first = false;
      const code = this.joinCode;
      if (!ticket || !code) return this.toHost({ k: "msg", id, text });
      const waiting = held = [text];
      void checkTicket(ticket, code).then((proof) => {
        if (proof && this.links.has(id)) {
          this.toHost({ k: "verified", id, sub: proof.sub, ...proof.name ? { name: proof.name } : {} });
          this.plays.joined(id, proof.sub);
        }
        held = null;
        for (const t of waiting) this.toHost({ k: "msg", id, text: t });
      });
    });
    link.onClose(() => {
      this.plays.left(id);
      if (!this.links.delete(id)) return;
      this.toHost({ k: "closed", id });
    });
  }
  flush() {
    this.snapshots?.flush();
  }
  sendInputs(inputs) {
    if (inputs.length) this.toHost({ k: "input", inputs });
  }
  sendReady() {
    this.toHost({ k: "ready" });
  }
  sendSpectate(on) {
    this.toHost({ k: "spectate", on });
  }
  sendVote(i) {
    this.toHost({ k: "vote", i });
  }
  /** Between matches: open the vote on these maps (the page picked them from our suite). */
  openVote(options) {
    this.toHost({ k: "voteopen", options });
  }
  onPageHide = () => this.sayGoodbye();
  close() {
    if (this.stopped) return;
    this.sayGoodbye();
    const links = [...this.links.values()].map((r) => r.link);
    if (this.departing) window.setTimeout(() => links.forEach((l) => l.close()), 3e3);
    else if (this.saidBye && links.length) window.setTimeout(() => links.forEach((l) => l.close()), 1e3);
    else links.forEach((l) => l.close());
    if (typeof window.removeEventListener === "function") window.removeEventListener("pagehide", this.onPageHide);
    window.clearInterval(this.upTimer);
    this.upTimer = void 0;
    this.links.clear();
    this.toHost({ k: "stop" });
    this.stopped = true;
    this.snapshots?.clear();
    this.worker?.terminate();
    this.worker = void 0;
    this.inThread = void 0;
    if (this.onVisibility && typeof document.removeEventListener === "function") document.removeEventListener("visibilitychange", this.onVisibility);
    for (const p of this.evals.values()) p.reject(new Error("The match ended"));
    this.evals.clear();
  }
}
const TEAM_COLOURS = ["#4aa3ff", "#ff5a4a", "#5ad16a", "#ffd23f", "#c77dff", "#ff9f43"];
const LABEL_RANGE = 90;
const hex = (h, a = 1) => {
  const n = parseInt(h.slice(1), 16);
  return new Color4((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, a);
};
class BotDebugView {
  constructor(scene, camera, name) {
    this.scene = scene;
    this.camera = camera;
    this.name = name;
    this.root = document.createElement("div");
    this.root.className = "botdebug";
    this.root.setAttribute("data-testid", "botdebug");
    Object.assign(this.root.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "40", font: "11px/1.25 ui-monospace, Menlo, monospace", color: "#fff" });
    this.panel = document.createElement("div");
    this.panel.className = "botdebug-panel";
    Object.assign(this.panel.style, { position: "absolute", right: "8px", top: "112px", maxHeight: "60vh", overflow: "hidden", background: "rgba(0,0,0,0.62)", padding: "6px 8px", borderRadius: "4px", whiteSpace: "pre" });
    this.root.appendChild(this.panel);
    document.body.appendChild(this.root);
  }
  scene;
  camera;
  name;
  lines = null;
  frame = null;
  root;
  panel;
  labels = /* @__PURE__ */ new Map();
  teams = /* @__PURE__ */ new Map();
  p = new Vector3();
  colour(team) {
    if (!team) return "#dddddd";
    let i = this.teams.get(team);
    if (i === void 0) this.teams.set(team, i = this.teams.size);
    return TEAM_COLOURS[i % TEAM_COLOURS.length];
  }
  /** A new frame from the match: the world's lines rebuilt, the panel rewritten. */
  update(f) {
    this.frame = f;
    this.lines?.dispose();
    this.lines = null;
    const segs = [];
    const cols = [];
    const add2 = (pts, c, up = 0.15) => {
      if (pts.length < 2) return;
      segs.push(pts.map((p) => new Vector3(p.x, p.y + up, p.z)));
      cols.push(pts.map(() => c));
    };
    for (const b of f.bots) {
      if (!b.alive) continue;
      const c = hex(this.colour(b.team));
      const route = [b.pos, ...b.path];
      add2(route, c);
      const end = route[route.length - 1];
      if (b.goal && Math.hypot(b.goal.x - end.x, b.goal.z - end.z) > 0.5) add2([end, b.goal], hex(this.colour(b.team), 0.4), 0.3);
      for (const m of b.memory) add2([m.pos, { x: m.pos.x, y: m.pos.y + 2.2, z: m.pos.z }], hex(m.source === "shot" ? "#ff7a00" : m.source === "callout" ? "#ffb347" : "#ffcf80"), 0);
      if (b.watch) for (const a of b.watch.looks) add2([b.watch.spot, { x: b.watch.spot.x + Math.sin(a) * 4, y: b.watch.spot.y, z: b.watch.spot.z + Math.cos(a) * 4 }], hex("#3de0ff"), 1.5);
    }
    const red = hex("#ff2a2a");
    for (const x of f.failed) {
      const g = x.goal;
      add2([{ x: g.x - 0.6, y: g.y, z: g.z - 0.6 }, { x: g.x + 0.6, y: g.y, z: g.z + 0.6 }], red, 0.2);
      add2([{ x: g.x - 0.6, y: g.y, z: g.z + 0.6 }, { x: g.x + 0.6, y: g.y, z: g.z - 0.6 }], red, 0.2);
      add2([x.from, g], hex("#8a1010", 0.6), 0.25);
    }
    if (segs.length) {
      const mesh = CreateLineSystem("botdebug_lines", { lines: segs, colors: cols }, this.scene);
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.renderingGroupId = 1;
      this.lines = mesh;
    }
    this.panel.textContent = this.table(f);
    const live = new Set(f.bots.map((b) => b.slot));
    for (const [slot, el2] of this.labels) {
      if (live.has(slot)) continue;
      el2.remove();
      this.labels.delete(slot);
    }
  }
  /** Why a bot stood (empty: it is on its way, or fighting on the move). */
  static stopped(b) {
    if (!b.alive) return "dead";
    if (b.moving) return "";
    return b.doing;
  }
  table(f) {
    const rows = [`bots ${f.bots.length}  failed searches ${f.failed.length}  callouts (3 s) ${f.callouts.length}`, "name           team  role    skill  state       doing       choice   top scores                stopped     fails stuck"];
    for (const b of f.bots) {
      const top = Object.entries(b.scores).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ");
      rows.push(
        [
          this.name(b.slot).slice(0, 14).padEnd(14),
          (b.team ?? "-").slice(0, 5).padEnd(5),
          (b.role ?? "-").slice(0, 7).padEnd(7),
          b.skill.padEnd(6),
          b.state.padEnd(11),
          b.doing.padEnd(11),
          (b.option ?? "-").padEnd(8),
          top.slice(0, 25).padEnd(25),
          BotDebugView.stopped(b).padEnd(11),
          String(b.failures).padStart(5),
          String(b.stuck).padStart(5)
        ].join(" ")
      );
    }
    return rows.join("\n");
  }
  /** Every frame: the labels over the bots, where the camera sees them. */
  draw() {
    const f = this.frame;
    const cam = this.camera();
    if (!f || !cam) return;
    const engine = this.scene.getEngine();
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const canvas = engine.getRenderingCanvas();
    const sx = (canvas?.clientWidth ?? w) / w;
    const sy = (canvas?.clientHeight ?? h) / h;
    const rect = canvas?.getBoundingClientRect();
    const vp = cam.viewport.toGlobal(w, h);
    const tm = this.scene.getTransformMatrix();
    const eye = cam.globalPosition;
    for (const b of f.bots) {
      let el2 = this.labels.get(b.slot);
      if (!el2) {
        el2 = document.createElement("div");
        Object.assign(el2.style, { position: "absolute", transform: "translate(-50%, -100%)", background: "rgba(0,0,0,0.55)", padding: "1px 4px", borderRadius: "3px", whiteSpace: "pre", textAlign: "center" });
        this.root.appendChild(el2);
        this.labels.set(b.slot, el2);
      }
      this.p.set(b.pos.x, b.pos.y + 2.3, b.pos.z);
      const far = Vector3.Distance(this.p, eye);
      const s = Vector3.Project(this.p, Matrix.IdentityReadOnly, tm, vp);
      if (!b.alive || far > LABEL_RANGE || s.z < 0 || s.z > 1) {
        el2.style.display = "none";
        continue;
      }
      el2.style.display = "";
      el2.style.left = `${(rect?.left ?? 0) + s.x * sx}px`;
      el2.style.top = `${(rect?.top ?? 0) + s.y * sy}px`;
      el2.style.borderBottom = `2px solid ${this.colour(b.team)}`;
      const why = BotDebugView.stopped(b);
      const goal = b.goal ? ` ${Math.round(Math.hypot(b.goal.x - b.pos.x, b.goal.z - b.pos.z))} m` : "";
      const text = `${this.name(b.slot)}
${b.state}/${b.doing}${goal}${why ? `
stopped: ${why}` : ""}`;
      if (el2.textContent !== text) el2.textContent = text;
    }
  }
  dispose() {
    this.lines?.dispose();
    this.lines = null;
    this.root.remove();
    this.labels.clear();
  }
}
function botDebugWanted() {
  try {
    return new URLSearchParams(location.search).get("botdebug") === "1";
  } catch {
    return false;
  }
}
const KEEP = 3600;
const HITCH_MS = 50;
const WINDOW_S = 5;
const SPLIT_KEYS = ["characters", "charAnim", "charSkin", "effects", "ragdolls", "flames", "hud", "net", "game", "renderScene", "renderCull", "renderShadow", "renderPost"];
function frameSplit(f) {
  const y = f.sys ?? [];
  const at = (i) => y[i] ?? 0;
  const inRender = at(SYS.anim) + at(SYS.skin);
  const systems = at(SYS.avatars) + at(SYS.fx) + at(SYS.ragdoll) + at(SYS.flames) + at(SYS.hud);
  return {
    characters: at(SYS.avatars) + inRender,
    charAnim: at(SYS.anim),
    charSkin: at(SYS.skin),
    effects: at(SYS.fx),
    ragdolls: at(SYS.ragdoll),
    flames: at(SYS.flames),
    hud: at(SYS.hud),
    net: f.msg,
    game: Math.max(0, f.js - systems),
    renderScene: Math.max(0, f.render - inRender - at(SYS.shadow) - at(SYS.post)),
    renderCull: at(SYS.cull),
    renderShadow: at(SYS.shadow),
    renderPost: at(SYS.post)
  };
}
function frameCounts(f) {
  const n = f.n ?? [];
  return { animated: n[COUNT.animated] ?? 0, skinned: n[COUNT.skinned] ?? 0, ragdolls: n[COUNT.ragdolls] ?? 0, lasting: n[COUNT.lasting] ?? 0, effects: n[COUNT.effects] ?? 0, built: n[COUNT.built] ?? 0 };
}
let gpu = null;
function gpuName() {
  if (gpu !== null) return gpu;
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    gpu = gl && (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || "unknown";
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    gpu = "unknown";
  }
  return gpu;
}
const avg = (xs) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
const pct = (xs, q) => {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const ms = (x) => `${x.toFixed(1)} ms`;
const SPLIT_LABEL = {
  characters: "chars",
  charAnim: " clips",
  charSkin: " skin",
  effects: "effects",
  ragdolls: "ragdolls",
  flames: "flames",
  hud: "hud",
  net: "net in",
  game: "other",
  renderScene: "r.scene",
  renderCull: " culling",
  renderShadow: "r.shadow",
  renderPost: "r.post"
};
const onWorker = (frames) => frames.every((f) => f.ticks === 0);
class PerfOverlay {
  counts = [];
  shown = false;
  /** Show or hide: the frame probe runs while shown (or while a recording or a trace wants it). */
  set visible(on) {
    if (on === this.shown) return;
    this.shown = on;
    if (on) {
      perfProbe.frames = [];
      this.counts = [];
    }
    perfProbe.keep = KEEP;
    perfProbe.use("overlay", on);
  }
  get visible() {
    return this.shown;
  }
  /** After each rendered frame: what it drew. */
  noteFrame(c) {
    this.counts.push(c);
    if (this.counts.length > KEEP) this.counts.splice(0, this.counts.length - KEEP);
  }
  /** The newest frames covering the last `seconds`. */
  recent(seconds) {
    const frames = perfProbe.frames;
    let t = 0;
    let i = frames.length;
    while (i > 0 && t < seconds * 1e3) t += frames[--i].dt;
    const n = frames.length - i;
    return { frames: frames.slice(i), counts: this.counts.slice(-n) };
  }
  /** The overlay's lines (label → value), over the last few seconds. */
  lines() {
    const { frames, counts } = this.recent(WINDOW_S);
    if (!frames.length) return { performance: "measuring…" };
    const dt = frames.map((f) => f.dt);
    const seconds = dt.reduce((s, x) => s + x, 0) / 1e3;
    const hitches = perfProbe.frames.filter((f) => f.dt > HITCH_MS).length;
    const sim = avg(frames.map((f) => f.sim));
    const net = avg(frames.map((f) => f.msg));
    const game = avg(frames.map((f) => f.js));
    const render = avg(frames.map((f) => f.render));
    const c = (k) => Math.round(avg(counts.map((x) => x[k])));
    const splits = frames.map(frameSplit);
    const sp = (k) => avg(splits.map((x) => x[k])).toFixed(1);
    const n = frames.map(frameCounts);
    const cn = (k) => Math.round(avg(n.map((x) => x[k])));
    return {
      fps: `${(frames.length / seconds).toFixed(0)}  (frame ${ms(avg(dt))}, slowest 5% ${ms(pct(dt, 0.95))}, worst ${Math.round(Math.max(...dt))} ms)`,
      hitches: `${hitches} over ${HITCH_MS} ms in the last minute`,
      "frame split": `sim ${onWorker(frames) ? "on a worker" : sim.toFixed(1)} · net ${net.toFixed(1)} · game ${game.toFixed(1)} · render ${render.toFixed(1)} ms`,
      render: `scene ${sp("renderScene")} (culling ${sp("renderCull")}) · shadows ${sp("renderShadow")} · post ${sp("renderPost")} ms`,
      systems: `characters ${sp("characters")} (clips ${sp("charAnim")}, skinning ${sp("charSkin")}) · effects ${sp("effects")} · ragdolls ${sp("ragdolls")} · flames ${sp("flames")} · hud ${sp("hud")} · other game ${sp("game")} ms`,
      drawn: `${c("draws")} draws · ${c("meshes")} meshes · ${c("casters")} shadow casters`,
      "": `${c("characters")} characters (${cn("animated")} animated, ${cn("skinned")} skinned a frame) · ${c("effects")} effects · ${cn("lasting")} lasting · ${cn("ragdolls")} ragdolls awake`,
      gpu: gpuName(),
      report: "Pause → Settings → Copy performance report"
    };
  }
  /** The text to paste when reporting a slowdown: the machine, the settings, the match and the last minute's frames. */
  report(ctx) {
    const frames = perfProbe.frames;
    const dt = frames.map((f) => f.dt);
    const seconds = dt.reduce((s, x) => s + x, 0) / 1e3;
    const field2 = (k) => frames.map((f) => f[k]);
    const line = (name, xs) => `${name.padEnd(8)} avg ${ms(avg(xs))}, slowest 5% ${ms(pct(xs, 0.95))}, worst ${ms(xs.length ? Math.max(...xs) : 0)}`;
    const count = (k) => {
      const xs = this.counts.map((c) => c[k]);
      return `${Math.round(avg(xs))} avg, ${xs.length ? Math.max(...xs) : 0} most`;
    };
    const splits = frames.map(frameSplit);
    const counts = frames.map(frameCounts);
    const perFrame = (k) => {
      const xs = counts.map((c) => c[k]);
      return `${avg(xs).toFixed(1)} avg / ${xs.length ? Math.max(...xs) : 0} most`;
    };
    const nav = navigator;
    return [
      `Tile Trigger v${"0.9.0"} (${"e694c415"}) performance report, ${(/* @__PURE__ */ new Date()).toISOString()}`,
      "",
      `Browser   ${navigator.userAgent}`,
      `Machine   ${navigator.hardwareConcurrency ?? "?"} cores${nav.deviceMemory ? `, ${nav.deviceMemory} GB` : ""}; screen ${screen.width}×${screen.height} at ${devicePixelRatio}×; window ${innerWidth}×${innerHeight}`,
      `GPU       ${gpuName()}`,
      `Renderer  ${ctx.renderer}; graphics ${loadGraphicsQuality()}, render scale ${loadRenderScale()}, frame cap ${currentFrameCap() || "none"}`,
      `Match     ${ctx.map}, ${ctx.mode}, ${ctx.players} players; ${ctx.match}; ping ${ctx.ping}`,
      "",
      `Frames    ${frames.length} over ${seconds.toFixed(0)} s: ${seconds ? (frames.length / seconds).toFixed(1) : 0} fps`,
      line("frame", dt),
      `hitches   ${dt.filter((x) => x > HITCH_MS).length} over ${HITCH_MS} ms, ${dt.filter((x) => x > 100).length} over 100 ms, ${dt.filter((x) => x > 250).length} over 250 ms`,
      onWorker(frames) ? "sim      runs on a worker thread, off this one" : line("sim", field2("sim")),
      line("net", field2("msg")),
      line("game", field2("js")),
      line("render", field2("render")),
      "",
      "Per system (ms a frame; docs/PERF_TOOLS.md):",
      ...SPLIT_KEYS.map((k) => line(SPLIT_LABEL[k], splits.map((x) => x[k]))),
      "",
      `draws     ${count("draws")}`,
      `meshes    ${count("meshes")}`,
      `shadows   ${count("casters")} shadow casters`,
      `people    ${count("characters")} characters drawn`,
      `effects   ${count("effects")}`,
      `per frame ${["animated", "skinned", "ragdolls", "lasting", "built"].map((k) => `${k} ${perFrame(k)}`).join(", ")}`
    ].join("\n");
  }
}
const RECORDING_FORMAT = "tiletrigger-perf-recording";
const RECORDING_VERSION = 1;
const BUCKETS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100, 150, 250, 500, 1e3];
const MAX_HITCHES = 2e3;
const SECOND_FIELDS = [
  "t",
  "frames",
  "frameAvg",
  "frameP95",
  "frameMax",
  ...SPLIT_KEYS.map((k) => `${k}Avg`),
  ...SPLIT_KEYS.map((k) => `${k}Max`),
  "draws",
  "meshes",
  "casters",
  "characters",
  "effectsDrawn",
  ...COUNT_NAMES,
  "shadersNew",
  "serverTickAvg",
  "serverTickMax"
];
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
function watchMainThread(keepMs = 5e3) {
  const seen2 = [];
  const observers = [];
  const keep = () => {
    const old = performance.now() - keepMs;
    while (seen2.length && seen2[0].start + seen2[0].dur < old) seen2.shift();
  };
  const watch = (type, f) => {
    try {
      const o = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) seen2.push(f(e));
        seen2.sort((a, b) => a.start - b.start);
        keep();
      });
      o.observe({ type, buffered: false });
      observers.push(o);
    } catch {
    }
  };
  watch("longtask", (e) => ({ start: e.startTime, dur: e.duration }));
  watch("long-animation-frame", (e) => {
    const l = e;
    const scripts = [...l.scripts ?? []].sort((a, b) => b.duration - a.duration).slice(0, 3);
    return {
      start: e.startTime,
      dur: e.duration,
      blocking: round(l.blockingDuration ?? 0, 1),
      scripts: scripts.map((x) => `${round(x.duration, 0)} ms ${x.sourceFunctionName || x.invoker || "?"} ${(x.sourceURL ?? "").split("/").pop() ?? ""}`.trim()),
      ...l.renderStart ? { render: round(l.renderStart - e.startTime, 1) } : {}
    };
  });
  return {
    blocks: (from, to) => seen2.filter((b) => b.start < to && b.start + b.dur > from),
    stop: () => observers.forEach((o) => o.disconnect())
  };
}
class PerfRecorder {
  constructor(ctx) {
    this.ctx = ctx;
    perfProbe.keep ||= 3600;
    perfProbe.use("record", true);
  }
  ctx;
  started = /* @__PURE__ */ new Date();
  t0 = performance.now();
  second = [];
  secondAt = performance.now();
  seconds = [];
  hitches = [];
  hitchCount = 0;
  hist = /* @__PURE__ */ new Map();
  frames = 0;
  shaders0 = -1;
  shadersAt = 0;
  header = null;
  main = watchMainThread();
  /** After each rendered frame (the probe's last sample and what it drew). */
  noteFrame(c) {
    const f = perfProbe.last;
    if (!f) return;
    perfProbe.last = null;
    this.frames++;
    const split = frameSplit(f);
    this.histAdd("frame", f.dt);
    for (const k of SPLIT_KEYS) this.histAdd(k, split[k]);
    this.second.push({ f, c });
    if (f.dt > HITCH_MS) this.hitch(f, split, c);
    const now = performance.now();
    if (now - this.secondAt >= 1e3) this.flushSecond(now);
  }
  histAdd(key, ms2) {
    let h = this.hist.get(key);
    if (!h) this.hist.set(key, h = new Array(BUCKETS.length + 1).fill(0));
    let i = 0;
    while (i < BUCKETS.length && ms2 > BUCKETS[i]) i++;
    h[i]++;
  }
  hitch(f, split, c) {
    this.hitchCount++;
    if (this.hitches.length >= MAX_HITCHES) return;
    const x = this.ctx();
    const n = frameCounts(f);
    const busy = f.sim + f.msg + f.js + f.render;
    const shaders = x.shaders;
    const end = performance.now();
    const blocks = this.main.blocks(end - f.dt, end);
    const mainLong = blocks.filter((b) => b.blocking === void 0).reduce((t, b) => t + Math.min(end, b.start + b.dur) - Math.max(end - f.dt, b.start), 0);
    this.hitches.push({
      t: round((performance.now() - this.t0) / 1e3, 2),
      dt: round(f.dt, 1),
      busy: round(busy, 1),
      outside: round(Math.max(0, f.dt - busy), 1),
      split: Object.fromEntries(SPLIT_KEYS.map((k) => [k, round(split[k], 2)])),
      pos: x.pos?.map((v) => round(v, 1)) ?? null,
      map: x.map,
      inView: { characters: c.characters, effects: c.effects, lasting: n.lasting, ragdolls: n.ragdolls, draws: c.draws, meshes: c.meshes, casters: c.casters },
      counts: n,
      shadersNew: this.shaders0 >= 0 ? shaders - this.shadersAt : 0,
      main: { longTasks: round(mainLong, 1), frames: blocks.filter((b) => b.blocking !== void 0).map((b) => ({ dur: round(b.dur, 1), blocking: b.blocking, ...b.render !== void 0 ? { render: b.render } : {}, scripts: b.scripts })) },
      quality: { graphics: loadGraphicsQuality(), renderScale: loadRenderScale(), frameCap: currentFrameCap() || null },
      server: x.server ? { tickAvg: round(x.server.tickMsAvg), tickMax: round(x.server.tickMsMax), aiAvg: round(x.server.aiMsAvg), late: x.server.lateTicks, bots: x.server.bots, ...x.server.split ? { split: x.server.split } : {} } : null
    });
  }
  flushSecond(now) {
    const rows = this.second;
    this.second = [];
    this.secondAt = now;
    if (!rows.length) return;
    const x = this.ctx();
    if (!this.header) this.header = x;
    if (this.shaders0 < 0) this.shaders0 = this.shadersAt = x.shaders;
    const shadersNew = x.shaders - this.shadersAt;
    this.shadersAt = x.shaders;
    const dt = rows.map((r) => r.f.dt);
    const splits = rows.map((r) => frameSplit(r.f));
    const counts = rows.map((r) => r.f.n ?? []);
    const drawn = (k) => round(avg(rows.map((r) => r.c[k])), 1);
    this.seconds.push([
      round((now - this.t0) / 1e3, 1),
      rows.length,
      round(avg(dt)),
      round(pct(dt, 0.95)),
      round(Math.max(...dt), 1),
      ...SPLIT_KEYS.map((k) => round(avg(splits.map((s) => s[k])), 3)),
      ...SPLIT_KEYS.map((k) => round(Math.max(...splits.map((s) => s[k])), 2)),
      drawn("draws"),
      drawn("meshes"),
      drawn("casters"),
      drawn("characters"),
      drawn("effects"),
      ...COUNT_NAMES.map((_, i) => round(avg(counts.map((n) => n[i] ?? 0)), 2)),
      shadersNew,
      x.server ? round(x.server.tickMsAvg) : -1,
      x.server ? round(x.server.tickMsMax) : -1
    ]);
  }
  /** Stop: the recording as the file's object. */
  finish() {
    perfProbe.use("record", false);
    this.main.stop();
    this.flushSecond(performance.now());
    const x = this.header ?? this.ctx();
    const nav = navigator;
    return {
      format: RECORDING_FORMAT,
      version: RECORDING_VERSION,
      app: `${"0.9.0"} (${"e694c415"})`,
      started: this.started.toISOString(),
      ended: (/* @__PURE__ */ new Date()).toISOString(),
      seconds: round((performance.now() - this.t0) / 1e3, 1),
      frames: this.frames,
      hitchMs: HITCH_MS,
      hitchCount: this.hitchCount,
      machine: {
        browser: navigator.userAgent,
        cores: navigator.hardwareConcurrency ?? null,
        memoryGB: nav.deviceMemory ?? null,
        gpu: gpuName(),
        screen: `${screen.width}x${screen.height}@${devicePixelRatio}`,
        window: `${innerWidth}x${innerHeight}`
      },
      settings: { renderer: x.renderer, graphics: loadGraphicsQuality(), renderScale: loadRenderScale(), frameCap: currentFrameCap() || null },
      match: { map: x.map, mode: x.mode, players: x.players, match: x.match },
      buckets: BUCKETS,
      histograms: Object.fromEntries(this.hist),
      secondFields: SECOND_FIELDS,
      perSecond: this.seconds,
      hitches: this.hitches
    };
  }
}
function downloadJson(name, data) {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1e4);
}
function fileStamp(map) {
  const t = (/* @__PURE__ */ new Date()).toISOString().replace(/[:T]/g, "-").slice(0, 19);
  return `${map.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "match"}-${t}`;
}
function captureTrace(seconds, name, meta) {
  perfProbe.spans = [];
  perfProbe.trace = true;
  perfProbe.use("trace", true);
  performance.mark("tt:trace start");
  return new Promise((done) => {
    setTimeout(() => {
      performance.mark("tt:trace end");
      perfProbe.trace = false;
      perfProbe.use("trace", false);
      const spans = perfProbe.spans;
      perfProbe.spans = [];
      const traceEvents = [
        { name: "process_name", ph: "M", pid: 1, tid: 1, args: { name: "Tile Trigger page" } },
        { name: "thread_name", ph: "M", pid: 1, tid: 1, args: { name: "main thread (tt: spans)" } },
        ...spans.map((s) => ({ name: s.name.replace(/^tt:/, ""), cat: "tiletrigger", ph: "X", ts: s.ts, dur: s.dur, pid: 1, tid: 1 }))
      ];
      downloadJson(`${name}.trace.json`, { traceEvents, displayTimeUnit: "ms", metadata: { ...meta, app: `${"0.9.0"} (${"e694c415"})`, gpu: gpuName() } });
      done(spans.length);
    }, seconds * 1e3);
  });
}
const SKILL_LABELS = { easy: "Easy", normal: "Normal", hard: "Hard" };
const STYLE_LABELS = { mixed: "Mixed", arena: "Arena", tactical: "Tactical" };
const FF_LABELS = { off: "Off", half: "Half", on: "Full" };
const nextRules = (s) => s.rules ? { ...s.rules, ...s.pending ?? {} } : null;
const LIVE_RULES = ["mixPickups", "dropWeapons", "weaponSet"];
const same = (a, b) => (a ?? null) === (b ?? null) || !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);
const rulePhrases = (p) => [
  ...p.scoreLimit !== void 0 ? [`score ${p.scoreLimit}`] : [],
  ...p.timeLimitSeconds !== void 0 ? [`time ${p.timeLimitSeconds ? `${Math.round(p.timeLimitSeconds / 60)} min` : "∞"}`] : [],
  ...p.respawnDelayTicks !== void 0 ? [`respawn ${Math.round(p.respawnDelayTicks / TICK_RATE)} s`] : [],
  ...p.friendlyFire !== void 0 ? [`friendly fire ${FF_LABELS[p.friendlyFire].toLowerCase()}`] : [],
  ...p.weather !== void 0 ? [`weather ${isWeatherChoice(p.weather) ? WEATHER_PRESETS[p.weather].label.toLowerCase() : "the map's"}`] : []
];
class HostPanel {
  constructor(hooks, title) {
    this.hooks = hooks;
    this.title = title;
    this.render();
  }
  hooks;
  title;
  root = el$1("details", { id: "host-controls", class: "host-controls" });
  /** The Host tab's foot (the pause menu puts it in its own foot): Resume, Apply, what Apply will do, the status. */
  foot = el$1("div", { class: "hc-foot", id: "hc-foot" });
  state = null;
  /** Settings being edited, applied together. */
  draft = null;
  status = el$1("p", { class: "hint hc-status", id: "hc-status" });
  /** People in the match besides you (kick and ban). */
  people = [];
  /** Team modes: people on each team besides you, and your team (null: spectating, or not known). */
  teamPeople = null;
  peopleKey = "";
  /** The rotation this browser keeps (offline, Host game); a server's comes in its HostState. */
  ownRotation = null;
  /** Shown first while you run the match (the Host tab's Online block); back in its home otherwise. */
  lead = null;
  /** The match's map (presets and the fit check are worked out from it), once known. */
  map = null;
  /** Even teams in the team editor (shown on while the teams are matched). */
  even = true;
  /** Why the last change to the teams stopped short (a limit). */
  stopped = null;
  /** The fit check's details are showing. */
  fitOpen = false;
  /** Apply & restart was pressed once with other people in the match: the next press does it. */
  armed = null;
  /**
   * When changed rules that need a new match apply: 'now' (Apply & restart: the match starts over with them) or
   * 'next' (Save for next match: they wait for the next match, after this one's scoreboard or Restart match, and
   * this one carries on). The host's choice stays while the panel does.
   */
  when = "now";
  /** The match's settings now (null: you don't run it). A change being edited stays where the match hasn't changed it meanwhile. */
  setState(state) {
    const prev = this.state;
    const d = this.draft;
    this.state = state;
    if (!state) this.draft = null;
    else {
      const fresh = { fill: state.fill, sizes: this.sizesOf(state), skill: state.skill, style: state.style, cast: state.cast, rules: nextRules(state) };
      if (d && prev && prev.map === state.map && prev.mode === state.mode) {
        if (prev.fill === state.fill && same(this.sizesOf(prev), fresh.sizes) && d.sizes.length === fresh.sizes.length) {
          fresh.fill = d.fill;
          fresh.sizes = d.sizes;
        }
        if (prev.skill === state.skill) fresh.skill = d.skill;
        if (prev.style === state.style) fresh.style = d.style;
        if (same(prev.cast, state.cast)) fresh.cast = d.cast;
        const was = nextRules(prev);
        if (d.rules && fresh.rules && was) {
          for (const k of Object.keys(fresh.rules)) if (was[k] === fresh.rules[k]) fresh.rules[k] = d.rules[k];
        }
      }
      this.draft = fresh;
    }
    this.render();
  }
  /** The match's map: the size presets and the fit check are worked out from it. */
  setMap(map) {
    this.map = map;
    if (this.state) this.render();
  }
  /**
   * The roster's people (not bots), you left out: whoever runs the match can kick or ban them. `teams`: how
   * many of them are on each team, and yours (team modes), so each team reads as who's on it.
   */
  setPeople(people, teams = null) {
    const key = `${people.map((p) => `${p.slot}:${p.name}`).join("|")}/${teams ? `${teams.others.join()}:${teams.you}` : ""}`;
    if (key === this.peopleKey) return;
    this.peopleKey = key;
    this.people = people;
    this.teamPeople = teams;
    if (this.state) this.render();
  }
  /** The rotation kept by this browser (null: the host's state carries it, or there is none). */
  setRotation(rotation) {
    this.ownRotation = rotation;
    if (this.state) this.render();
  }
  /** Put `node` (with its listeners) first while you run the match; otherwise it sits first in `home`. */
  setLead(node, home) {
    this.lead = { node, home };
    if (this.state) this.render();
  }
  /** Take the panel off the page; the lead goes back home (the next match's panel picks it up). */
  remove() {
    if (this.lead && this.lead.node.parentElement !== this.lead.home) this.lead.home.prepend(this.lead.node);
    this.lead = null;
    this.root.remove();
    this.foot.remove();
  }
  get controlling() {
    return !!this.state;
  }
  setStatus(text, error = false) {
    this.status.textContent = text;
    this.status.classList.toggle("error", error);
  }
  /**
   * The map rotation: the maps played in turn after each match, each in its mode. Add (the map picker),
   * remove, move up and down, start from a preset, shuffle, skip to the next now; "Next up" says where the
   * match goes. Every change sends the whole list (the host checks it).
   */
  rotationSection(s) {
    const hook = this.hooks.rotation;
    const r = this.ownRotation ?? s.rotation ?? null;
    if (!hook || !r) return [];
    const entries = r.entries.map((e) => ({ map: e.map, mode: e.mode }));
    const set = (list2) => this.hooks.command({ c: "rotation", entries: list2 });
    const next = r.next !== null ? r.entries[r.next] : void 0;
    const head = el$1("p", { class: "hc-rot-next", id: "hc-rot-next", textContent: next ? `Next up: ${next.name} · ${MODE_LABELS[next.mode]}` : r.vote ? "Empty: everyone votes on the next map from our maps for this mode. Add maps to put them on the ballot first." : "Empty: the match replays this map. Add maps, or start from a preset." });
    const list = el$1("ol", { class: "hc-rot", id: "hc-rot-list" });
    r.entries.forEach((e, i) => {
      const button = (id, text, title, disabled, act) => {
        const b = el$1("button", { id: `hc-rot-${id}-${i}`, textContent: text, title, disabled });
        b.addEventListener("click", act);
        return b;
      };
      const swap = (j) => {
        const l = [...entries];
        [l[i], l[j]] = [l[j], l[i]];
        set(l);
      };
      const label = el$1("span", { textContent: `${e.name} ` }, el$1("small", { textContent: MODE_LABELS[e.mode] }));
      const li = el$1(
        "li",
        { class: i === r.current ? "now" : i === r.next ? "next" : "", title: i === r.current ? "Playing now" : i === r.next ? "Next up" : "" },
        label,
        button("up", "↑", "Move up", i === 0, () => swap(i - 1)),
        button("down", "↓", "Move down", i === r.entries.length - 1, () => swap(i + 1)),
        button("del", "✕", "Remove", false, () => set(entries.filter((_, j) => j !== i)))
      );
      list.append(li);
    });
    const add2 = el$1("button", { id: "hc-rot-add", textContent: "Add map…", title: `Pick a map and mode for the rotation (up to ${ROTATION_MAX})`, disabled: r.entries.length >= ROTATION_MAX });
    add2.addEventListener("click", () => hook.add());
    const preset = el$1("select", { id: "hc-rot-preset", title: "Replace the rotation with a built-in one" });
    preset.append(new Option("Start from a preset…", ""));
    for (const p of hook.presets) {
      const o = new Option(`${p.name} (${p.maps.length})`, p.id);
      o.title = p.description;
      preset.append(o);
    }
    preset.addEventListener("change", () => {
      const p = hook.presets.find((x) => x.id === preset.value);
      if (p) this.hooks.command({ c: "rotation", entries: p.maps.map((m) => ({ map: m.map, mode: m.mode })), shuffle: p.shuffle });
    });
    const shuffle = el$1("input", { type: "checkbox", id: "hc-rot-shuffle", checked: r.shuffle });
    shuffle.addEventListener("change", () => this.hooks.command({ c: "rotation", shuffle: shuffle.checked }));
    const skip = el$1("button", { id: "hc-rot-skip", textContent: "Skip to next", title: next ? `Go to ${next.name} now` : "The rotation is empty", disabled: !next });
    skip.addEventListener("click", () => this.hooks.command({ c: "skip" }));
    const clear = el$1("button", { id: "hc-rot-clear", textContent: "Clear", title: "Empty the rotation (matches replay their map)", disabled: !r.entries.length });
    clear.addEventListener("click", () => set([]));
    const vote = r.vote === void 0 ? null : el$1("input", { type: "checkbox", id: "hc-rot-vote", checked: r.vote });
    vote?.addEventListener("change", () => this.hooks.command({ c: "rotation", vote: vote.checked }));
    const voteRow = vote ? [el$1("div", { class: "hc-row hc-rot-tools" }, el$1("label", { class: "hc-check", title: "At the end of a match everyone votes on the next map: two or three of our maps that fit the players here, the rotation's next first. Ties go to your vote. Off: plain rotation (an empty one replays the map)." }, vote, " Vote on the next map"))] : [];
    return [
      card(
        "Rotation",
        null,
        head,
        ...r.entries.length ? [list] : [],
        el$1("div", { class: "hc-row hc-rot-tools" }, add2, preset),
        el$1("div", { class: "hc-row hc-rot-tools" }, el$1("label", { class: "hc-check" }, shuffle, " Shuffle"), skip, clear),
        ...voteRow
      )
    ];
  }
  /** The Bots window over the pause menu: Apply sends the whole set (the match swaps bots in one at a time). */
  openBots(s) {
    if (document.getElementById("bot-manager")) return;
    const teams = s.teams ? Array.from({ length: s.teams }, (_, i) => ({ name: s.teamNames?.[i] ?? DEFAULT_TEAMS[i]?.name ?? `Team ${i + 1}`, color: s.teamColors?.[i] ?? DEFAULT_TEAMS[i]?.color ?? "#00d1ff" })) : [];
    const players = s.teams ? this.sizesOf(s).reduce((a, b) => a + b, 0) : s.fill;
    const opener = document.getElementById("hc-bots");
    const win = botManager({
      set: s.botSet ?? null,
      teams,
      presets: BOT_SET_PRESETS,
      applyLabel: "Apply",
      note: `Applies to this match now: bots swap in one at a time. ${players} players in all, you included.`,
      players: Math.max(0, players - 1),
      onApply: (set) => this.hooks.command({ c: "bots", botSet: set }),
      onClose: () => (document.getElementById("hc-bots") ?? opener)?.focus()
    });
    (document.getElementById("pause") ?? document.body).append(win);
  }
  /** Every team's size (an older server only says the largest). */
  sizesOf(s) {
    if (!s.teams) return [];
    return s.sizes?.length === s.teams ? [...s.sizes] : Array.from({ length: s.teams }, () => s.teamSize ?? 1);
  }
  /** The draft as a match setup, for the presets and the fit check (the map's own rules otherwise). */
  asSetup(s, d) {
    return { map: s.map, mode: s.mode, bots: Math.max(0, d.fill - 1), skill: d.skill, scoreLimit: d.rules?.scoreLimit ?? 0, minutes: Math.round((d.rules?.timeLimitSeconds ?? 0) / 60), ...s.teams ? { teams: [...d.sizes] } : {} };
  }
  /**
   * What the draft changes, as short phrases for the foot ("+2 bots", "score 16"): `live`, now; `restart`, the rules
   * that need a new match, against what plays now (Apply & restart plays them, any saved for the next match too);
   * `fresh`, those not saved for the next match yet (Save for next match saves them).
   */
  changes(s, d) {
    const now = this.sizesOf(s);
    const live = [];
    const total = (sizes, fill) => s.teams ? sizes.reduce((a, b) => a + b, 0) : fill;
    const delta = total(d.sizes, d.fill) - total(now, s.fill);
    if (delta) live.push(`${delta > 0 ? "+" : "−"}${Math.abs(delta)} bot${Math.abs(delta) === 1 ? "" : "s"}`);
    else if (s.teams && !same(d.sizes, now)) live.push(d.sizes.join("v"));
    if (d.skill !== s.skill) live.push(`${SKILL_LABELS[d.skill].toLowerCase()} bots`);
    if (d.style !== s.style) live.push(`${STYLE_LABELS[d.style].toLowerCase()} style`);
    if (d.cast !== void 0 && !same(d.cast, s.cast)) live.push("bot characters");
    const liveRules = {};
    const restartRules = {};
    const freshRules = {};
    const want = nextRules(s);
    const r = d.rules;
    if (r && want && s.rules) {
      for (const k of Object.keys(r)) {
        if (LIVE_RULES.includes(k)) {
          if (r[k] !== s.rules[k]) liveRules[k] = r[k];
          continue;
        }
        if (r[k] !== s.rules[k] || r[k] !== want[k]) restartRules[k] = r[k];
        if (r[k] !== want[k]) freshRules[k] = r[k];
      }
      if (liveRules.mixPickups !== void 0) live.push(`mixed pickups ${liveRules.mixPickups ? "on" : "off"}`);
      if (liveRules.dropWeapons !== void 0) live.push(`weapon drops ${liveRules.dropWeapons ? "on" : "off"}`);
      if (liveRules.weaponSet !== void 0) live.push(`${liveRules.weaponSet ? getWeaponSet(liveRules.weaponSet).name : `the map's (${getWeaponSet(s.mapWeaponSet).name})`} weapons`);
    }
    return { live, restart: rulePhrases(restartRules), fresh: rulePhrases(freshRules), liveRules, restartRules, freshRules };
  }
  /**
   * Send what the draft changes: the live part now, then the rules, then (`when` 'now', when any needs it) the
   * restart. 'next': the rules wait for the next match (the match keeps them: HostControl's pending rules).
   */
  apply(when) {
    const s = this.state;
    const d = this.draft;
    if (!s || !d) return;
    const c = this.changes(s, d);
    const now = this.sizesOf(s);
    const cmd = { c: "bots" };
    if (s.teams) {
      if (!same(d.sizes, now)) {
        if (d.sizes.every((n) => n === d.sizes[0])) cmd.teamSize = d.sizes[0];
        else cmd.teamSizes = [...d.sizes];
      }
    } else if (d.fill !== s.fill) cmd.fill = d.fill;
    if (d.skill !== s.skill) cmd.skill = d.skill;
    if (d.style !== s.style) cmd.style = d.style;
    if (d.cast !== void 0 && !same(d.cast, s.cast)) cmd.cast = d.cast;
    if (Object.keys(cmd).length > 1) this.hooks.command(cmd);
    const rules = { ...c.liveRules, ...when === "now" ? c.restartRules : c.freshRules };
    if (Object.keys(rules).length) this.hooks.command({ c: "rules", rules });
    if (when === "now" && c.restart.length) this.hooks.command({ c: "restart" });
  }
  render() {
    const open = this.root.open;
    const s = this.state;
    const d = this.draft;
    this.root.hidden = !s && !this.hooks.login;
    if (!s || !d) {
      if (this.lead && this.lead.node.parentElement !== this.lead.home) this.lead.home.prepend(this.lead.node);
      const token = el$1("input", { id: "hc-token", type: "password", placeholder: "Admin token", autocomplete: "off" });
      const login = el$1("button", { id: "hc-login", textContent: "Log in" });
      login.addEventListener("click", () => token.value.trim() && this.hooks.login?.(token.value.trim()));
      this.root.replaceChildren(el$1("summary", {}, "Server admin"), el$1("p", { class: "hint", textContent: "The server's ADMIN_TOKEN lets you change bots and map, restart and end the match." }), el$1("div", { class: "hc-row" }, token, login), this.status);
      this.root.open = open;
      this.foot.replaceChildren();
      return;
    }
    const redraw = () => this.render();
    const now = this.sizesOf(s);
    const map = this.map && this.map.metadata.id === s.map ? this.map : null;
    const coop = s.mode === "core.coop" || s.mode === "core.zombies";
    const r = d.rules;
    const players = s.teams ? d.sizes.reduce((a, b) => a + b, 0) : d.fill;
    const sug = r && limitsScale(s.mode) ? suggestedLimits(s.mode, players, s.teams ? d.sizes : void 0) : null;
    const suggestion = [];
    const bt = s.mode === "core.breakthrough";
    const btSecs = r?.breakthroughSectorSeconds ?? 240;
    if (r && sug) {
      const size = s.teams && d.sizes.length <= 4 ? d.sizes.join("v") : `${players} players`;
      const off = bt ? r.breakthroughPool !== sug.scoreLimit || btSecs !== sug.minutes * 60 : r.scoreLimit !== sug.scoreLimit || r.timeLimitSeconds !== sug.minutes * 60;
      const use = el$1("button", { type: "button", class: "link", id: "hc-use-suggested", textContent: "Use suggested", title: "Set the score and time suggested for this many players and bots (they apply with a new match: Apply & restart, or Save for next match)" });
      use.addEventListener("click", () => {
        if (bt) {
          r.breakthroughPool = sug.scoreLimit;
          r.breakthroughSectorSeconds = sug.minutes * 60;
        } else {
          r.scoreLimit = sug.scoreLimit;
          r.timeLimitSeconds = sug.minutes * 60;
        }
        redraw();
      });
      suggestion.push(el$1("p", { class: "setup-hint limits-line", id: "hc-suggest" }, el$1("span", { textContent: `Suggested for ${size}: ${limitsText(s.mode, sug)}${bt ? " a sector" : ""}.` }), ...off ? [use] : []));
    }
    const fields = !r ? [] : bt ? [
      field("Reinforcements", "Respawns per attacker (the pool is this times the attacking team, topped up by half as much for each sector taken).", stepper({ value: r.breakthroughPool, min: 1, max: BREAKTHROUGH_POOL_MAX, id: "hc-score", label: "reinforcements per attacker", onChange: (v) => (r.breakthroughPool = v, redraw()) }), { restart: true }),
      field("Sector time", "Minutes each sector puts on the clock (taking one adds the next one's).", stepper({ value: Math.round(btSecs / 60), min: 1, max: 15, id: "hc-minutes", fmt: (v) => `${v} min`, onChange: (v) => (r.breakthroughSectorSeconds = v * 60, redraw()) }), { restart: true }),
      field("Second round", "A second round with the sides swapped.", choice([["off", "One round"], ["on", "Swap sides"]], r.breakthroughSwap ? "on" : "off", (v) => (r.breakthroughSwap = v === "on", redraw()), "hc-bt-swap"), { restart: true })
    ] : [
      // Small scores step by one (a capture, a round); big ones by more (10, 50, 100).
      field("Score limit", "Score that wins (0: none).", stepper({ value: r.scoreLimit, min: 0, max: SCORE_LIMIT_MAX, step: r.scoreLimit < 50 ? 1 : scoreStep(r.scoreLimit), id: "hc-score", label: "score limit", onChange: (v) => (r.scoreLimit = v, redraw()) }), { restart: true }),
      field("Time limit", "Minutes until the match ends (∞: none).", stepper({ value: Math.round(r.timeLimitSeconds / 60), min: 0, max: 120, id: "hc-minutes", fmt: (v) => v ? `${v} min` : "∞", onChange: (v) => (r.timeLimitSeconds = v * 60, redraw()) }), { restart: true })
    ];
    const win = r ? [card("To win", null, el$1("div", { class: "field-grid" }, ...fields), ...suggestion)] : [];
    const rows = [];
    const setup = this.asSetup(s, d);
    const deviceMax = s.max;
    if (map) {
      const pickPlayers = mapPickPlayers(map.metadata.recommendedPlayers);
      const presets = sizePresets(s.mode, map, { teams: s.teams || void 0, deviceMax, device: "this match", pickPlayers }).filter((p) => !s.teams || p.teams?.length === s.teams);
      const on = matchingPreset(setup, map, presets, deviceMax);
      rows.push(
        sizeChips(presets, on, s.teams ? d.sizes.join("v") : `${d.fill} players`, (p) => {
          if (p.teams) {
            d.sizes = [...p.teams];
            this.even = p.teams.every((n) => n === p.teams[0]);
          } else d.fill = p.players ?? d.fill;
          this.stopped = null;
          redraw();
        }, "hc-sizes")
      );
    }
    if (s.teams) {
      const names = d.sizes.map((_, i) => s.teamNames?.[i] ?? DEFAULT_TEAMS[i]?.name ?? `Team ${i + 1}`);
      rows.push(
        teamEditor({
          id: "hc",
          state: { sizes: d.sizes, names, colors: d.sizes.map((_, i) => s.teamColors?.[i] ?? DEFAULT_TEAMS[i]?.color ?? "#00d1ff"), you: this.teamPeople?.you ?? null },
          ...this.teamPeople ? { people: this.teamPeople.others } : {},
          countLocked: "The number of teams is set when the match starts: change it from Play → Match setup, or Change map.",
          namesLocked: "Names and colours are set when the match starts (Play → Match setup).",
          cap: { max: s.max, by: "device" },
          device: "this match",
          mode: s.mode,
          even: { on: this.even && d.sizes.every((n) => n === d.sizes[0]), onToggle: (on) => this.even = on },
          stopped: this.stopped,
          onChange: (next, stopped) => {
            d.sizes = next.sizes;
            this.stopped = stopped;
            redraw();
          }
        }),
        el$1("p", { class: "setup-hint", textContent: "Bots join or leave to fit, at once when you Apply. People who join take bots' places. Drag a bot pip to move it to another team." })
      );
    } else {
      rows.push(
        settingRow(coop ? "Squad" : "Players", coop ? "You and your bot squadmates." : "Everyone in the match, you included; bots fill the rest.", stepper({ value: d.fill, min: 1, max: s.max, id: "hc-players", label: coop ? "squad" : "players", onChange: (v) => (d.fill = v, redraw()) })),
        el$1("p", { class: "setup-hint", id: "hc-players-line", textContent: `${peopleAndBots(1 + this.people.length, Math.max(0, d.fill - 1 - this.people.length), coop ? "squadmate" : "bot")}. People who join take bots' places.` })
      );
    }
    let fitTag = null;
    if (map) {
      const fit = setupFit(setup, map, { deviceMax, device: "this match", pickPlayers: mapPickPlayers(map.metadata.recommendedPlayers) });
      fitTag = fitChip(fit, this.fitOpen, () => (this.fitOpen = !this.fitOpen, redraw()), "hc-fit");
      const shown = this.fitOpen ? fit.items : fit.items.filter((i) => i.level === "problem");
      const fix = (f) => {
        if (f.teams && f.teams.length === d.sizes.length) d.sizes = [...f.teams];
        else if (f.players) d.fill = f.players;
        redraw();
      };
      if (shown.length) rows.unshift(fitList(shown, fix, "hc-fit-list"));
    }
    const live = el$1("span", { class: "when-tag live", textContent: "Live", title: "Changes the match now (Apply)" });
    const botRows = [
      settingRow("Bot skill", "Easy bots aim slowly and miss often; hard ones react fast, use cover and lead their shots.", choice(HOST_BOT_SKILLS.map((v) => [v, SKILL_LABELS[v]]), d.skill, (v) => (d.skill = v, redraw()), "hc-skill")),
      settingRow("Bot style", "Mixed: every character plays its own way. Arena: always moving (Quake). Tactical: careful, cover, held angles (Counter-Strike).", choice(HOST_BOT_STYLES.map((v) => [v, STYLE_LABELS[v]]), d.style, (v) => (d.style = v, redraw()), "hc-style"))
    ];
    if (s.botSet !== void 0) {
      const bots = el$1("button", { id: "hc-bots", textContent: "Bots…", title: "Your own bots: names, looks, skill, style, team and squad (the window applies them live: bots swap in one at a time)" });
      bots.addEventListener("click", () => this.openBots(s));
      botRows.push(settingRow("Bot set", "Your own bots by name, look, skill, style, team and squad; random bots fill the rest unless the set says only these.", el$1("div", { class: "bot-set-line" }, el$1("span", { class: "bot-set-sum", id: "hc-bots-sum", textContent: `${s.mapBots ? "The map's: " : ""}${botSetLabel(s.botSet)}`, title: `${s.mapBots ? "The map's own bots: " : ""}${botSetLabel(s.botSet)}` }), bots)));
    }
    if (d.cast !== void 0) {
      botRows.push(settingRow("Bot characters", `Which characters random bots play, and so their names (a soldier is "Sgt. Dunmore"; the first bot in a character takes its name). Map default: the map maker's choice. Random bots out of it change when you Apply. Your bot set keeps its own.`, botCastSelect(d.cast ?? void 0, s.mapCast, (v) => (d.cast = v ?? null, redraw()), "hc-cast")));
    }
    const ruleRows = [];
    if (r) {
      ruleRows.push(
        settingRow("Respawn delay", "Seconds before players are back in.", stepper({ value: Math.round(r.respawnDelayTicks / TICK_RATE), min: 0, max: 30, id: "hc-respawn", fmt: (v) => `${v} s`, onChange: (v) => (r.respawnDelayTicks = v * TICK_RATE, redraw()) }), { restart: true }),
        settingRow("Friendly fire", "Whether shots and blasts hurt teammates.", choice(["off", "half", "on"].map((v) => [v, FF_LABELS[v]]), r.friendlyFire, (v) => (r.friendlyFire = v, redraw()), "hc-ff", isTeamMode(s.mode) || coop ? null : `No teammates in ${MODE_LABELS[s.mode]}.`), { restart: true })
      );
      if (s.rules?.mixPickups !== void 0) ruleRows.push(settingRow("Mix up weapon pickups", 'Every weapon pickup not marked "keep fixed" in MapMaker holds a random weapon of the same kind as the one placed there, and a new one each time it comes back. Applies at once.', choice([["off", "Off"], ["on", "On"]], r.mixPickups ? "on" : "off", (v) => (r.mixPickups = v === "on", redraw()), "hc-mix"), { live: true }));
      if (s.rules?.weaponSet !== void 0 && s.mode !== "core.discs") ruleRows.push(settingRow("Weapon set", "What everyone spawns with and what the weapon and grenade pickups hold (Map default: the map maker's choice). Applies at once: the pickups change now, and everyone's next life spawns with the set.", weaponSetSelect(r.weaponSet ?? void 0, s.mapWeaponSet ?? "standard", (v) => (r.weaponSet = v ?? null, redraw()), "hc-weapons"), { live: true }));
      if (s.rules?.weather !== void 0) ruleRows.push(settingRow("Weather", `Rain, snow, wind and fog for everyone (fog: everyone sees less far). Map: the map maker's choice (${s.mapWeather ?? "Clear"}). Fixed while a match plays: it changes from the next match.`, weatherSelect(r.weather ?? void 0, s.mapWeather ?? "Clear", (v) => (r.weather = v ?? null, redraw()), "hc-weather"), { restart: true }));
      if (s.rules?.dropWeapons !== void 0 && s.mode !== "core.discs") ruleRows.push(settingRow("Drop weapon on death", "A fallen player's or bot's primary with ammo left lies at the body for 30 s, with exactly that ammo; the rest of what they carried is recycled. Applies at once (off clears the ones lying about).", choice([["on", "On"], ["off", "Off"]], r.dropWeapons ? "on" : "off", (v) => (r.dropWeapons = v === "on", redraw()), "hc-drops"), { live: true }));
    }
    const pending = s.pending && Object.keys(s.pending).length ? s.pending : null;
    if (pending) ruleRows.push(el$1("p", { class: "hc-pending", id: "hc-pending", textContent: `Saved for the next match: ${rulePhrases(pending).join(", ")}. They play once this match ends (or on Restart match, or a map change).` }));
    const routine = [];
    if (this.hooks.changeMap) {
      const mapBtn = el$1("button", { id: "hc-map", textContent: "Change map…", title: "Pick another map (and mode): the match starts over there with the same players and bots" });
      mapBtn.addEventListener("click", () => this.hooks.changeMap?.());
      routine.push(mapBtn);
    }
    const restart = el$1("button", { id: "hc-restart", class: "danger", textContent: "Restart match", title: pending ? "Start over with the rules saved for the next match (asks for a second click)" : "Start the match over on this map (asks for a second click)" });
    confirmTwice(restart, "Click again to restart", () => this.hooks.command({ c: "restart" }));
    const end = el$1("button", { id: "hc-end", class: "danger", textContent: "End match", title: "End the match now and show the scoreboard (asks for a second click)" });
    confirmTwice(end, "Click again to end", () => this.hooks.command({ c: "end" }));
    const matchCard = card("Match", null, ...routine.length ? [el$1("div", { class: "hc-actions" }, ...routine)] : [], el$1("div", { class: "hc-actions hc-danger" }, restart, end));
    const people = this.people.length ? [
      card(
        "Players",
        null,
        ...this.people.map((p) => {
          const kick = el$1("button", { id: `hc-kick-${p.slot}`, textContent: "Kick", title: `Remove ${p.name} (they may rejoin)` });
          kick.addEventListener("click", () => this.hooks.command({ c: "kick", slot: p.slot }));
          const ban = el$1("button", { id: `hc-ban-${p.slot}`, class: "danger", textContent: "Ban", title: `Remove ${p.name} and keep them out` });
          ban.addEventListener("click", () => window.confirm(`Ban ${p.name} from this ${this.title === "Admin" ? "server" : "game"}?`) && this.hooks.command({ c: "ban", slot: p.slot }));
          return el$1("div", { class: "hc-row hc-person" }, el$1("span", { textContent: p.name }), kick, ban);
        })
      )
    ] : [];
    const label = s.teams ? now.every((n) => n === now[0]) ? teamsLabel(s.teams, now[0]) : now.join("v") : `${s.fill} players`;
    const summary = el$1("summary", {}, `Match (${this.title.toLowerCase()})`, el$1("small", { textContent: ` ${label} · ${MODE_LABELS[s.mode]} · ${SKILL_LABELS[s.skill]} bots` }));
    const teamsTitle = s.teams ? isTwoTeamMode(s.mode) ? "Teams" : "Players & teams" : coop ? "Squad" : "Players";
    this.root.replaceChildren(
      summary,
      el$1(
        "div",
        { class: "hc-grid" },
        ...this.lead ? [this.lead.node] : [],
        ...win,
        card(teamsTitle, fitTag ? el$1("span", { class: "hc-tags" }, fitTag, live) : live, ...rows),
        card("Bots", live.cloneNode(true), ...botRows),
        ...ruleRows.length ? [card("Rules", null, ...ruleRows)] : [],
        matchCard,
        ...this.rotationSection(s),
        ...people
      )
    );
    this.root.open = open;
    this.drawFoot(s, d);
  }
  /**
   * The foot, always in view: Resume, then Apply, named by what it will do: Apply now (everything changes live),
   * Apply & restart (a rule that needs a new match changed: the match starts over with it) or Save for next match
   * (those rules wait for the next match and this one carries on). While such a rule has changed, beside it the
   * choice between the last two (Restart now | Next match); then a line saying what will happen, and the status.
   */
  drawFoot(s, d) {
    const c = this.changes(s, d);
    const rules = c.restart.length > 0;
    const next = rules && this.when === "next";
    const restart = rules && !next;
    const any = c.live.length > 0 || (next ? c.fresh.length > 0 : rules);
    const resume = el$1("button", { type: "button", class: "primary", id: "hc-resume", textContent: "Resume", title: "Back to the game (Esc)" });
    resume.addEventListener("click", () => this.hooks.resume?.());
    const saving = next && (c.fresh.length > 0 || !c.live.length);
    const apply = el$1("button", { type: "button", class: `hc-apply${restart ? " restart" : saving ? " next" : ""}`, id: "hc-apply", textContent: restart ? "Apply & restart" : saving ? "Save for next match" : "Apply now", disabled: !any });
    apply.title = !any ? next ? "Saved already: the next match plays with it" : "Change something above first" : restart ? "Apply these changes and start the match over (scores reset): some rules only change with a new match" : next ? `Keep the changed rules for the next match (after this one's scoreboard, or Restart match): this match carries on${c.live.length ? "; players and bots change now" : ""}` : "Apply these changes now (bots join or leave one at a time)";
    const others = this.people.length;
    apply.addEventListener("click", () => {
      if (!any) return;
      if (restart && others && !this.armed) {
        apply.textContent = "Click again to restart";
        apply.classList.add("armed");
        this.armed = setTimeout(() => {
          this.armed = null;
          if (apply.isConnected) this.drawFoot(s, d);
        }, 3e3);
        return;
      }
      if (this.armed) clearTimeout(this.armed);
      this.armed = null;
      this.apply(next ? "next" : "now");
    });
    const when = rules ? [
      segmented(
        [
          ["now", "Restart now", null, "hc-when-now", "Apply restarts the match now with the changed rules (scores reset)."],
          ["next", "Next match", null, "hc-when-next", "Save the changed rules for the next match: this one carries on, and they play after its scoreboard (or when you restart it, or change map). Players and bots still change now."]
        ],
        this.when,
        (v) => {
          this.when = v;
          this.drawFoot(s, d);
          document.getElementById(`hc-when-${v}`)?.focus();
        },
        { id: "hc-when", label: "When the rule changes apply" }
      )
    ] : [];
    const list = (xs) => xs.join(", ");
    const text = !rules ? c.live.length ? list(c.live) : "No changes" : restart ? `${list([...c.live, ...c.restart])}: the match restarts now` : [c.live.length ? `${list(c.live)} now` : "", c.fresh.length ? `${list(c.fresh)} from the next match` : `saved for the next match: ${list(c.restart)}`].filter(Boolean).join("; ");
    const what = el$1("span", { class: "hc-changes", id: "hc-changes", textContent: text, title: text });
    this.foot.replaceChildren(resume, apply, ...when, what, this.status);
  }
}
function card(title, tag, ...children) {
  return el$1("section", { class: "hc-card" }, el$1("h4", { class: "hc-card-title" }, el$1("span", { textContent: title }), ...tag ? [tag] : []), ...children);
}
function confirmTwice(button, ask, act) {
  const label = button.textContent ?? "";
  let armed = null;
  button.addEventListener("click", () => {
    if (armed) {
      clearTimeout(armed);
      armed = null;
      button.textContent = label;
      button.classList.remove("armed");
      act();
      return;
    }
    button.textContent = ask;
    button.classList.add("armed");
    armed = setTimeout(() => {
      armed = null;
      button.textContent = label;
      button.classList.remove("armed");
    }, 3e3);
  });
}
const $$1 = (id) => document.getElementById(id);
class PauseMenu {
  constructor(hooks, signal) {
    this.hooks = hooks;
    for (const b of this.tabButtons()) b.addEventListener("click", () => this.show(b.dataset.tab), { signal });
    const back = document.getElementById("pause-back");
    if (back) {
      back.addEventListener("click", () => this.back(), { signal });
      const label = back.querySelector(".back-label");
      if (label) this.backLabels.push(label);
    }
    this.buildHints(signal);
    const pause = document.getElementById("pause");
    if (pause) {
      const watch = new MutationObserver(() => this.refresh());
      watch.observe(pause, { childList: true });
      signal.addEventListener("abort", () => watch.disconnect());
    }
    document.addEventListener("fullscreenchange", () => this.refresh(), { signal });
    this.show("match");
  }
  hooks;
  tab = "match";
  prevPad = [];
  backLabels = [];
  fullscreenLabel = null;
  /** The footer's key hints, each a button doing what its key does. */
  buildHints(signal) {
    const bar = document.getElementById("pause-hints");
    if (!bar) return;
    const hint = (id, keys2, label, title, act) => {
      const b = document.createElement("button");
      b.type = "button";
      b.id = id;
      b.className = "hint-btn";
      b.title = title;
      const text = document.createElement("span");
      text.textContent = label;
      b.append(...keys2, text);
      b.addEventListener("click", act, { signal });
      bar.append(b);
      return text;
    };
    bar.replaceChildren();
    this.backLabels.push(hint("pause-hint-back", glyphs("Esc", "B", "b"), "Back", "Back one level (Esc, controller B)", () => this.back()));
    hint("pause-hint-tabs", [...glyphs("Q", "LB"), ...glyphs("E", "RB")], "Tabs", "Next tab (Q / E, controller LB / RB)", () => this.cycle(1));
    if (fullscreenSupported()) this.fullscreenLabel = hint("pause-hint-fullscreen", glyphs("F11"), "Fullscreen", "Fullscreen on or off (F11)", () => void toggleFullscreen());
  }
  /** What Back does from here, on the Back button and the footer's hint. */
  refresh() {
    const overlay = this.hooks.overlay();
    const label = overlay ? "Back" : this.tab === "host" ? "Resume" : this.tab !== "match" ? "Back" : this.hooks.top?.label ?? "Resume";
    for (const l of this.backLabels) l.textContent = label;
    const back = document.getElementById("pause-back");
    if (back) back.title = overlay ? "Close the window (Esc)" : this.tab === "host" ? "Back to the game (Esc)" : this.tab !== "match" ? "Back to Match (Esc)" : `${label} (Esc)`;
    if (this.fullscreenLabel) this.fullscreenLabel.textContent = isFullscreen() ? "Exit fullscreen" : "Fullscreen";
  }
  tabButtons() {
    return [...document.querySelectorAll("#pause .pause-tabs [data-tab]")];
  }
  /** Show or hide a tab (the Host tab is for whoever runs the match). */
  setTabVisible(tab, visible) {
    const b = this.tabButtons().find((x) => x.dataset.tab === tab);
    if (b) b.hidden = !visible;
    if (!visible && this.tab === tab) this.show("match");
  }
  show(tab) {
    this.tab = tab;
    for (const b of this.tabButtons()) {
      const on = b.dataset.tab === tab;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", String(on));
    }
    for (const s of document.querySelectorAll("#pause .pause-sec")) s.hidden = s.dataset.sec !== tab;
    const foot = document.getElementById("pause-host-foot");
    if (foot) foot.hidden = tab !== "host";
    this.refresh();
    this.hooks.opened?.(tab);
  }
  /** Next or previous visible tab. */
  cycle(dir) {
    const tabs = this.tabButtons().filter((b) => !b.hidden);
    const at = tabs.findIndex((b) => b.dataset.tab === this.tab);
    const next = tabs[(at + dir + tabs.length) % tabs.length];
    if (next) this.show(next.dataset.tab);
  }
  /** On the Match tab with no dialog open: one more Esc would leave the menu. */
  get atTop() {
    return !this.hooks.overlay() && this.tab === "match";
  }
  /** Esc / B / Back: close the dialog, else back to Match (the Host tab: resume), else resume (or the `top` hook). One level per call. */
  back() {
    const overlay = this.hooks.overlay();
    if (overlay) {
      const cancel = overlay.querySelector("[data-cancel], #hm-close");
      if (cancel) cancel.click();
      else overlay.remove();
      this.refresh();
      return;
    }
    if (this.tab === "host") return this.hooks.resume();
    if (this.tab !== "match") return this.show("match");
    if (this.hooks.top) return this.hooks.top.act();
    this.hooks.resume();
  }
  /** Move the focus through what can be pressed in the dialog, or the open tab and the footer. */
  moveFocus(dir) {
    const scope = this.hooks.overlay() ?? $$1("pause");
    const items = [...scope.querySelectorAll('button, input, select, summary, [tabindex="0"]')].filter((e) => !e.disabled && e.offsetParent !== null && !e.closest(".pause-tabs"));
    if (!items.length) return;
    const at = items.indexOf(document.activeElement);
    const next = items[at < 0 ? dir > 0 ? 0 : items.length - 1 : (at + dir + items.length) % items.length];
    next.focus();
    next.scrollIntoView({ block: "nearest" });
  }
  /** Keys while paused; true when the menu used the key. */
  key(e) {
    const t = e.target;
    const typing = !!t && (t.tagName === "INPUT" && t.type !== "checkbox" && t.type !== "range" ? true : t.tagName === "SELECT");
    if (typing) return false;
    if (e.code === "KeyQ" || e.code === "KeyE") {
      this.cycle(e.code === "KeyE" ? 1 : -1);
      return true;
    }
    if ((e.code === "ArrowDown" || e.code === "ArrowUp") && t?.type !== "range") {
      this.moveFocus(e.code === "ArrowDown" ? 1 : -1);
      return true;
    }
    return false;
  }
  /** Once a frame while paused: a controller drives the menu. */
  pollPad() {
    const pad = [...navigator.getGamepads?.() ?? []].find((g) => g?.connected && g.mapping === "standard");
    if (!pad) return;
    const down = pad.buttons.map((b) => b.pressed);
    const pressed = (i) => !!down[i] && !this.prevPad[i];
    if (pressed(PAD.up)) this.moveFocus(-1);
    if (pressed(PAD.down)) this.moveFocus(1);
    if (pressed(PAD.lb)) this.cycle(-1);
    if (pressed(PAD.rb)) this.cycle(1);
    if (pressed(PAD.a)) document.activeElement?.click();
    if (pressed(PAD.b)) this.back();
    if (pressed(PAD.start)) this.hooks.resume();
    this.prevPad = down;
  }
}
class CoverState {
  constructor(scene, physics, broke, models) {
    this.scene = scene;
    this.physics = physics;
    this.broke = broke;
    this.models = models;
  }
  scene;
  physics;
  broke;
  models;
  covers = /* @__PURE__ */ new Map();
  half = THROWABLE_DEFS.sandbag.projectile.cover.half;
  material = null;
  apply(list) {
    const seen2 = /* @__PURE__ */ new Set();
    let changed = false;
    for (const [id, x, y, z, yaw] of list ?? []) {
      seen2.add(id);
      if (this.covers.has(id)) continue;
      const pos = { x, y, z };
      const [hx, hy, hz] = this.half;
      const body = this.physics.createBox({ x, y: y + hy, z }, { x: hx, y: hy, z: hz }, yaw);
      this.covers.set(id, { node: this.build(id, pos, yaw), body, pos });
      changed = true;
    }
    for (const [id, c] of this.covers) {
      if (seen2.has(id)) continue;
      this.physics.removeCollider(c.body);
      c.node.dispose();
      this.covers.delete(id);
      this.broke({ x: c.pos.x, y: c.pos.y + this.half[1], z: c.pos.z });
      changed = true;
    }
    if (changed) this.physics.commit();
  }
  /** Two staggered rows of bags filling the collision box. */
  build(id, pos, yaw) {
    this.material ??= Object.assign(new StandardMaterial("sandbag", this.scene), { diffuseColor: Color3.FromHexString("#b39b6b"), specularColor: Color3.Black() });
    const node = new TransformNode(`cover_${id}`, this.scene);
    node.position.set(pos.x, pos.y, pos.z);
    node.rotation.y = yaw;
    const [hx, hy, hz] = this.half;
    const wall = THROWABLE_DEFS.sandbag.view?.cover;
    if (this.models) {
      void this.models.instantiate(wall, `coverwall_${id}`).then((m) => {
        if (node.isDisposed()) return m.dispose();
        m.parent = node;
        m.position.y = hy;
      });
      return node;
    }
    const rows = 3;
    const h = hy * 2 / rows;
    for (let r = 0; r < rows; r++) {
      const count = r % 2 ? 3 : 4;
      const w = hx * 2 / count;
      for (let i = 0; i < count; i++) {
        const bag = CreateCapsule(`bag_${id}`, { radius: h * 0.55, height: w * 1.05, tessellation: 8, subdivisions: 1 }, this.scene);
        bag.rotation.z = Math.PI / 2;
        bag.scaling.set(1, 1, hz * 2 / (h * 1.1));
        bag.position.set(-hx + w * (i + 0.5), h * (r + 0.5), 0);
        bag.material = this.material;
        bag.parent = node;
      }
    }
    return node;
  }
  dispose() {
    for (const c of this.covers.values()) c.node.dispose();
    this.covers.clear();
  }
}
class AmmoBoxState {
  constructor(scene, physics, models) {
    this.scene = scene;
    this.physics = physics;
    this.models = models;
  }
  scene;
  physics;
  models;
  boxes = /* @__PURE__ */ new Map();
  apply(list) {
    const seen2 = /* @__PURE__ */ new Set();
    let changed = false;
    for (const [id, x, y, z, yaw, , uses, deployed] of list ?? []) {
      seen2.add(id);
      const had = this.boxes.get(id);
      if (had) {
        had.uses = uses;
        continue;
      }
      const pos = { x, y, z };
      const [hx, hy, hz] = AMMO_BOX_HALF;
      const body = this.physics.createBox({ x: pos.x, y: pos.y + hy, z: pos.z }, { x: hx, y: hy, z: hz }, yaw);
      this.boxes.set(id, { node: this.build(id, pos, yaw), body, pos, uses, deployed: deployed === 1 });
      changed = true;
    }
    for (const [id, b] of this.boxes) {
      if (seen2.has(id)) continue;
      this.physics.removeCollider(b.body);
      b.node.dispose();
      this.boxes.delete(id);
      changed = true;
    }
    if (changed) this.physics.commit();
  }
  /** The crate model, standing on the ground point, turned to the box's yaw. */
  build(id, pos, yaw) {
    const node = new TransformNode(`ammobox_${id}`, this.scene);
    node.position.set(pos.x, pos.y, pos.z);
    node.rotation.y = yaw;
    void this.models.instantiate(AMMO_BOX_MODEL, `ammobox_${id}_model`).then((m) => {
      if (node.isDisposed()) return m.dispose();
      m.parent = node;
      const { min } = m.getHierarchyBoundingVectors(true);
      m.position.y -= min.y - pos.y;
      for (const mesh of m.getChildMeshes()) mesh.isPickable = false;
    });
    return node;
  }
  /** The box with stock whose reach your feet are in (the server's rule: Match.resupplyAtBox), or null. */
  inReach(feet) {
    let best = null;
    let bestD = Infinity;
    for (const b of this.boxes.values()) {
      if (b.uses <= 0 || Math.abs(feet.y - b.pos.y) > 1.6) continue;
      const d = Math.hypot(feet.x - b.pos.x, feet.z - b.pos.z);
      if (d <= AMMO_BOX_REACH && d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best && { uses: best.uses, deployed: best.deployed };
  }
  dispose() {
    for (const b of this.boxes.values()) b.node.dispose();
    this.boxes.clear();
  }
}
const PIECE_COLOR = {
  block: "#a0723f",
  plank: "#b3854d",
  wall: "#8f6436",
  metal_wall: "#7d8791",
  ramp: "#a87a45",
  stairs: "#9c6e3c",
  crate: "#5f6b45",
  sandbags: "#b39b6b"
};
const escapeHtml$3 = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
class FortsClient {
  constructor(view, physics, map, teams, myTeam, audio) {
    this.view = view;
    this.physics = physics;
    this.map = map;
    this.teams = teams;
    this.myTeam = myTeam;
    this.audio = audio;
    this.bases = fortFlagBases(map, teams);
    this.midfield = this.bases ? fortMidfield(this.bases[0], this.bases[1]) : null;
    this.spawns = map.entities.filter((e) => e.kind === "spawn").map((e) => ({ x: e.position[0], y: e.position[1], z: e.position[2] }));
    this.panel = document.createElement("div");
    this.panel.id = "fort-panel";
    (document.getElementById("hud") ?? document.body).append(this.panel);
  }
  view;
  physics;
  map;
  teams;
  myTeam;
  audio;
  /** Picked piece (FORT_PIECE_KINDS index) and quarter turns. */
  kind = 0;
  rot = 0;
  fo = null;
  pieces = /* @__PURE__ */ new Map();
  midfield;
  bases;
  spawns;
  barrier = null;
  materials = /* @__PURE__ */ new Map();
  ghost = null;
  ghostOk = null;
  ghostBad = null;
  panel;
  /** Why the ghost can't go where it is (shown under the picker), or ''. */
  why = "";
  lastPanel = "";
  loaded = false;
  get scene() {
    return this.view.scene;
  }
  get pieceKind() {
    return FORT_PIECE_KINDS[this.kind] ?? "block";
  }
  /** The `build` field for inputs: piece plus quarter turns × 16. */
  get code() {
    return this.kind + this.rot * 16;
  }
  get building() {
    return this.fo?.[0] === FORT_BUILD;
  }
  /** Is this the Builder in hand during the build phase? */
  holding(held, heldId) {
    return this.building && heldId === BUILDER_WEAPON;
  }
  pick(i) {
    if (i >= 0 && i < FORT_PIECE_KINDS.length) this.kind = i;
  }
  cycle(steps) {
    const n = FORT_PIECE_KINDS.length;
    this.kind = ((this.kind + Math.sign(steps)) % n + n) % n;
  }
  rotate() {
    this.rot = (this.rot + 1) % 4;
  }
  teamIndex() {
    const id = this.myTeam();
    return this.teams.slice(0, 2).findIndex((t) => t.id === id);
  }
  // ---------------------------------------------------------------- snapshots
  apply(md) {
    if (!md?.fo) return;
    this.fo = md.fo;
    this.setBarrier(md.fo[0] === FORT_BUILD);
    if (md.fp) this.applyPieces(md.fp);
  }
  applyPieces(list) {
    const seen2 = /* @__PURE__ */ new Set();
    let changed = false;
    const quiet = !this.loaded;
    this.loaded = true;
    for (const [id, k, team, x, y, z, rot, hp] of list) {
      seen2.add(id);
      const kind = FORT_PIECE_KINDS[k];
      if (!kind) continue;
      const have = this.pieces.get(id);
      if (have) {
        if (have.health !== hp) {
          have.health = hp;
          this.paint(have);
        }
        continue;
      }
      const base = { x, y, z };
      const boxes = fortPieceBoxes(kind, rot, base);
      const colliders = boxes.map((b) => this.physics.createBox(centre(b), half(b)));
      const piece = { id, kind, team, base, rot, boxes, colliders, health: hp, node: new TransformNode(`fort_${id}`, this.scene) };
      this.build(piece);
      this.pieces.set(id, piece);
      changed = true;
      if (!quiet) this.audio?.play("impact.thud", { at: centre(fortBounds(boxes)), gain: 0.6 });
    }
    for (const [id, p] of this.pieces) {
      if (seen2.has(id)) continue;
      for (const c of p.colliders) this.physics.removeCollider(c);
      p.node.dispose();
      this.pieces.delete(id);
      changed = true;
      const b = fortBounds(p.boxes);
      const at = centre(b);
      this.view.debris(at, PIECE_COLOR[p.kind], Math.min(1.2, 0.4 + (b.max.y - b.min.y) * 0.3));
      if (!this.building) this.audio?.play(FORT_PIECES[p.kind].tier === "metal" ? "impact.heavy" : "break.wall", { at });
    }
    if (changed) this.physics.commit();
  }
  material(kind, shade) {
    const key = `${kind}_${shade}`;
    let m = this.materials.get(key);
    if (!m) {
      m = new StandardMaterial(`fort_${key}`, this.scene);
      m.diffuseColor = Color3.FromHexString(PIECE_COLOR[kind]).scale([1, 0.72, 0.48][shade]);
      m.specularColor = FORT_PIECES[kind].tier === "metal" ? new Color3(0.35, 0.35, 0.35) : new Color3(0.05, 0.05, 0.05);
      this.materials.set(key, m);
    }
    return m;
  }
  teamMaterial(team) {
    const key = `team_${team}`;
    let m = this.materials.get(key);
    if (!m) {
      m = new StandardMaterial(`fort_${key}`, this.scene);
      const c = Color3.FromHexString(this.teams[team]?.color ?? "#ffffff");
      m.diffuseColor = c;
      m.emissiveColor = c.scale(0.35);
      this.materials.set(key, m);
    }
    return m;
  }
  /** Boxes for each part, a sloped deck on ramps, and a strip of team colour along the top. */
  build(p) {
    const mat = this.material(p.kind, 0);
    p.boxes.forEach((b, i) => {
      const box = CreateBox(`fort_${p.id}_${i}`, { width: b.max.x - b.min.x, height: b.max.y - b.min.y, depth: b.max.z - b.min.z }, this.scene);
      box.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
      box.material = mat;
      box.parent = p.node;
      box.receiveShadows = true;
    });
    const def = FORT_PIECES[p.kind];
    const all = fortBounds(p.boxes);
    if (def.rise === "ramp") {
      const [w, h, d] = def.size;
      const deck = CreateBox(`fort_${p.id}_deck`, { width: w, height: 0.14, depth: Math.hypot(d, h) }, this.scene);
      const pivot = new TransformNode(`fort_${p.id}_pivot`, this.scene);
      pivot.position.set(p.base.x, p.base.y, p.base.z);
      pivot.rotation.y = p.rot * Math.PI / 2;
      pivot.parent = p.node;
      deck.parent = pivot;
      deck.position.set(0, h / 2 + 0.08, 0);
      deck.rotation.x = -Math.atan2(h, d);
      deck.material = mat;
    } else if (!def.rise) {
      const strip = CreateBox(`fort_${p.id}_team`, { width: all.max.x - all.min.x + 0.02, height: 0.06, depth: all.max.z - all.min.z + 0.02 }, this.scene);
      strip.position.set((all.min.x + all.max.x) / 2, all.max.y - 0.03, (all.min.z + all.max.z) / 2);
      strip.material = this.teamMaterial(p.team);
      strip.parent = p.node;
    }
    this.paint(p);
  }
  /** Darker as it takes damage. */
  paint(p) {
    const shade = p.health > 66 ? 0 : p.health > 33 ? 1 : 2;
    const mat = this.material(p.kind, shade);
    for (const m of p.node.getChildMeshes()) if (!m.name.endsWith("_team")) m.material = mat;
  }
  setBarrier(on) {
    if (!this.midfield) return;
    if (on && !this.barrier) {
      const m = this.midfield;
      const body = this.physics.createBox(m.mid, FORT_BARRIER_HALF, m.yaw);
      this.physics.commit();
      const b = this.map.bounds;
      const length = b ? Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1]) : 300;
      const node = new TransformNode("fort_barrier", this.scene);
      const wall = CreateBox("fort_barrier_field", { width: length, height: 16, depth: 0.05 }, this.scene);
      const mat = new StandardMaterial("fort_barrier", this.scene);
      mat.diffuseColor = Color3.FromHexString("#4fd3ff");
      mat.emissiveColor = Color3.FromHexString("#2aa8ff");
      mat.alpha = 0.16;
      mat.backFaceCulling = false;
      wall.material = mat;
      wall.parent = node;
      wall.position.y = 6;
      wall.isPickable = false;
      node.position.set(m.mid.x, m.mid.y, m.mid.z);
      node.rotation.y = m.yaw;
      this.barrier = { body, node };
    } else if (!on && this.barrier) {
      this.physics.removeCollider(this.barrier.body);
      this.physics.commit();
      this.barrier.node.getChildMeshes().forEach((m) => m.material?.dispose());
      this.barrier.node.dispose();
      this.barrier = null;
    }
  }
  get barrierUp() {
    return this.barrier !== null;
  }
  // ---------------------------------------------------------------- per frame
  /**
   * Ghost preview and panel. `eye` is null when dead; `holding` while the
   * Builder is in hand in the build phase.
   */
  frame(eye, yaw, pitch, holding, poses, self) {
    const team = this.teamIndex();
    let base = null;
    this.why = "";
    if (holding && eye && team >= 0 && this.midfield && this.bases && this.fo) {
      const kind = this.pieceKind;
      base = fortAimPlacement(this.physics, eye, yaw, pitch, kind, this.rot);
      if (!base) this.why = "Aim at the ground or a piece";
      else if (FORT_PIECES[kind].cost > (this.fo[4 + team] ?? 0)) this.why = "Not enough build points";
      else if ((this.fo[6 + team] ?? 0) >= FORT_MAX_PIECES) this.why = "Your team has built all it can";
      else {
        const bodies = poses.filter((p) => p.alive).map((p) => ({ x: p.x, y: p.y, z: p.z }));
        if (self) bodies.push(self);
        this.why = fortPlacementProblem(
          {
            physics: this.physics,
            side: this.midfield.side,
            pieces: [...this.pieces.values()],
            bodies,
            keepClear: [...this.bases.map((pos) => ({ pos, r: FORT_FLAG_CLEARANCE })), ...this.spawns.map((pos) => ({ pos, r: FORT_SPAWN_CLEARANCE }))]
          },
          team,
          kind,
          this.rot,
          base
        ) ?? "";
      }
    }
    this.drawGhost(base);
    this.drawPanel(holding, team);
  }
  drawGhost(base) {
    if (!base) {
      if (this.ghost) this.ghost.node.setEnabled(false);
      return;
    }
    const key = `${this.pieceKind}_${this.rot}`;
    if (this.ghost?.key !== key) {
      this.ghost?.node.dispose();
      this.ghostOk ??= Object.assign(new StandardMaterial("fort_ghost_ok", this.scene), { diffuseColor: Color3.FromHexString("#4dff88"), emissiveColor: Color3.FromHexString("#3cff7a"), alpha: 0.4 });
      this.ghostBad ??= Object.assign(new StandardMaterial("fort_ghost_bad", this.scene), { diffuseColor: Color3.FromHexString("#ff5040"), emissiveColor: Color3.FromHexString("#ff3a28"), alpha: 0.4 });
      const node = new TransformNode("fort_ghost", this.scene);
      fortPieceBoxes(this.pieceKind, this.rot, { x: 0, y: 0, z: 0 }).forEach((b, i) => {
        const box = CreateBox(`fort_ghost_${i}`, { width: b.max.x - b.min.x + 0.02, height: b.max.y - b.min.y + 0.02, depth: b.max.z - b.min.z + 0.02 }, this.scene);
        box.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
        box.isPickable = false;
        box.parent = node;
      });
      this.ghost = { node, key };
    }
    const g = this.ghost;
    g.node.setEnabled(true);
    g.node.position.set(base.x, base.y, base.z);
    const mat = this.why ? this.ghostBad : this.ghostOk;
    for (const m of g.node.getChildMeshes()) m.material = mat;
  }
  drawPanel(holding, team) {
    const fo = this.fo;
    if (!fo) return;
    const [phase, secs, cycle, cycles, p0, p1, c0, c1, budget] = fo;
    const mine = team === 1 ? { points: p1, count: c1, other: c0 } : { points: p0, count: c0, other: c1 };
    const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    const phaseText = phase === FORT_BUILD ? "Build phase" : "Combat";
    const parts = [
      `<div class="fp-phase${phase === FORT_BUILD ? " build" : ""}" data-phase="${phase}"><b>${phaseText}</b> <span>${clock}</span>${cycles > 1 ? ` <small>cycle ${cycle}/${cycles}</small>` : ""}</div>`,
      `<div class="fp-stats"><span data-points="${mine.points}">Build points <b>${mine.points}</b> / ${budget}</span><span>Pieces <b>${mine.count}</b> · theirs ${mine.other}</span></div>`
    ];
    if (holding) {
      parts.push(
        `<div class="fp-pieces">${FORT_PIECE_KINDS.map((k, i) => {
          const d = FORT_PIECES[k];
          const cls = `${i === this.kind ? "on" : ""}${d.cost > mine.points ? " poor" : ""}`;
          return `<span class="${cls}" data-kind="${k}"><kbd>${i + 1}</kbd>${escapeHtml$3(d.label)} <em>${d.cost}</em></span>`;
        }).join("")}</div>`,
        `<div class="fp-why">${this.why ? escapeHtml$3(this.why) : "&nbsp;"}</div>`,
        `<div class="fp-help">LMB place · RMB pick up · R turn · 1-8 / wheel: piece</div>`
      );
    }
    const html = parts.join("");
    if (html !== this.lastPanel) {
      this.panel.innerHTML = html;
      this.lastPanel = html;
    }
  }
  dispose() {
    this.setBarrier(false);
    for (const p of this.pieces.values()) {
      for (const c of p.colliders) this.physics.removeCollider(c);
      p.node.dispose();
    }
    this.pieces.clear();
    this.ghost?.node.dispose();
    for (const m of this.materials.values()) m.dispose();
    this.ghostOk?.dispose();
    this.ghostBad?.dispose();
    this.panel.remove();
  }
}
const centre = (b) => ({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 });
const half = (b) => ({ x: (b.max.x - b.min.x) / 2, y: (b.max.y - b.min.y) / 2, z: (b.max.z - b.min.z) / 2 });
const escapeHtml$2 = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const HOSTAGE_SLOT_BASE = 9e5;
class ModeHud {
  constructor(hud, view, map, teams, mode, slot) {
    this.hud = hud;
    this.view = view;
    this.map = map;
    this.teams = teams;
    this.mode = mode;
    this.slot = slot;
    this.visuals = new ModeVisuals(view.scene, map, teams, mode);
    hud.waitLabel = mode === "core.elim" || mode === "core.bomb" || mode === "core.hostage" ? "Out until the next round" : "Respawning…";
    this.sectors = mode === "core.breakthrough" ? breakthroughSectors(map) : [];
    if (mode === "core.breakthrough") {
      this.warning = document.createElement("div");
      this.warning.id = "bt-warning";
      this.warning.hidden = true;
      (document.getElementById("hud") ?? document.body).append(this.warning);
    }
  }
  hud;
  view;
  map;
  teams;
  mode;
  slot;
  md;
  visuals;
  /** Breakthrough: the sectors in order, and the fall-back warning over the crosshair. */
  sectors;
  warning = null;
  /** Breakthrough: is my team attacking this round? */
  get attacking() {
    const bt = this.md?.bt;
    return !!bt && this.teams[bt[2]]?.id === this.myTeam?.id;
  }
  /** Breakthrough: an objective's label, kind and sector, from its map entity. */
  btObjective(i) {
    const e = this.map.entities[i];
    return e?.kind === "objective" ? { label: e.label, kind: e.objective, sector: e.sector } : { label: "?", kind: "zone", sector: 0 };
  }
  /** Breakthrough: the objectives in play as minimap blips (labelled squares, held at the rim when far). */
  minimapBlips() {
    const bo = this.md?.bo;
    if (!bo) return [];
    return bo.flatMap(([i, state]) => {
      if (state !== BT_OBJ_ACTIVE && state !== BT_OBJ_PLANTED) return [];
      const e = this.map.entities[i];
      if (!e) return [];
      const o = this.btObjective(i);
      return [{ x: e.position[0], z: e.position[2], color: state === BT_OBJ_PLANTED ? "#ff4a3a" : BT_COLORS[o.kind], label: o.label }];
    });
  }
  /** Flags drawn (for tests). */
  get flagCount() {
    return this.visuals.flagCount;
  }
  /** Breakthrough objectives showing in the world (for tests). */
  get objectiveCount() {
    return this.visuals.objectiveCount;
  }
  /** Latest mode state (for tests). */
  get state() {
    return this.md;
  }
  get myTeam() {
    return this.hud.team(this.slot());
  }
  teamName(id) {
    return this.teams.find((t) => t.id === id)?.name ?? "Nobody";
  }
  snapshot(md) {
    if (!md) return;
    this.md = md;
    this.hud.setModeScores(md.ts);
  }
  /** Announcer lines for objective events (sounds are played by SessionAudio). */
  event(ev) {
    const mine = this.myTeam?.id;
    const me = this.slot();
    const name = (s) => s === me ? "You" : this.hud.name(s);
    if (ev.e === "flag") {
      const ours = ev.team === mine;
      const team = this.teamName(ev.team);
      const text = ev.a === "take" ? ours ? "Your flag has been taken!" : ev.s === me ? "You have the flag! Take it home!" : `${name(ev.s)} has the ${team} flag!` : ev.a === "drop" ? ours ? "Your flag has been dropped!" : `The ${team} flag has been dropped!` : ev.a === "return" ? ours ? "Your flag has been returned" : `The ${team} flag has been returned` : ours ? `${this.teamName(this.teams.find((t) => t.id !== ev.team)?.id ?? null)} captured your flag!` : ev.s === me ? "You captured the flag!" : "Flag captured!";
      this.hud.showMessage(text, ev.a === "capture" ? 3.5 : 2.5);
    } else if (ev.e === "hill") {
      if (ev.a === "move") this.hud.showMessage("The hill has moved!", 2.5);
      else if (ev.team !== null) this.hud.showMessage(ev.team === mine ? "Your team holds the hill" : `${this.teamName(ev.team)} hold the hill!`, 2);
    } else if (ev.e === "hostage") {
      const rescuer = mine === this.teams[0]?.id;
      const text = ev.a === "rescue" ? rescuer ? "Hostage rescued!" : "A hostage has been rescued!" : ev.a === "follow" ? ev.s === me ? "The hostage follows you: take it to a rescue zone" : rescuer ? "" : "A hostage is being taken!" : ev.s === null && rescuer ? "A hostage was left behind" : "";
      if (text) this.hud.showMessage(text, 2.5);
    } else if (ev.e === "bomb") {
      const attacker = mine === this.teams[0]?.id;
      const site = ev.i !== void 0 ? this.siteLabel(ev.i) : "";
      const text = ev.a === "plant" ? attacker ? `Bomb planted at ${site}! Defend it` : `Bomb planted at ${site}! Defuse it` : ev.a === "defuse" ? "Bomb defused!" : ev.a === "explode" ? "The bomb exploded!" : ev.a === "pickup" ? ev.s === me ? "You have the bomb: plant it at a site (E, then hold still)" : attacker ? `${name(ev.s)} has the bomb` : "" : attacker ? "The bomb has been dropped!" : "";
      if (text) this.hud.showMessage(text, 3);
    } else if (ev.e === "elim") {
      if (ev.a === "start") this.hud.showMessage(`Round ${ev.round}: fight!`, 2);
      else this.hud.showMessage(ev.team === null ? `Round ${ev.round} drawn` : ev.team === mine ? `Your team wins round ${ev.round}!` : `${this.teamName(ev.team)} win round ${ev.round}`, 3);
    } else if (ev.e === "bt") {
      const text = this.btLine(ev, mine);
      if (text) this.hud.showMessage(text, ev.a === "round" || ev.a === "sector" ? 4 : 3);
    }
  }
  /** Breakthrough's announcer: the same news worded for each side. */
  btLine(ev, mine) {
    const attacker = ev.team === mine;
    const o = ev.i !== void 0 ? this.btObjective(ev.i) : null;
    const me = this.slot();
    switch (ev.a) {
      case "capture":
        return o?.kind === "final" ? attacker ? `${o.label} is ours!` : `${o?.label} has fallen!` : attacker ? `Zone ${o?.label} captured!` : `Zone ${o?.label} lost!`;
      case "plant":
        return ev.s === me ? `Charge set on ${o?.label}: defend it!` : attacker ? `Charge planted on ${o?.label}! Defend it` : `Charge planted on ${o?.label}! Defuse it`;
      case "defuse":
        return ev.s === me ? `You defused the charge on ${o?.label}` : attacker ? `Our charge on ${o?.label} was defused!` : `Charge on ${o?.label} defused!`;
      case "destroy":
        return attacker ? `Target ${o?.label} destroyed!` : `We lost ${o?.label}!`;
      case "sector": {
        const s = this.sectors[ev.n ?? 0];
        const name = s?.name ?? `Sector ${sectorLetter(ev.n ?? 0)}`;
        const last = (ev.n ?? 0) + 1 >= this.sectors.length;
        if (last) return "";
        return attacker ? `${name} taken! Push on` : `${name} lost! Fall back to the next line`;
      }
      case "round": {
        const won = ev.team === mine;
        const breakthrough = ev.team !== null && this.teams[this.md?.bt?.[2] ?? 0]?.id === ev.team;
        return breakthrough ? won ? "We broke through!" : "They broke through!" : won ? "The line held!" : "Our attack is spent: the line held";
      }
      case "start":
        return `Round ${ev.n}: sides swapped. ${attacker ? "You attack!" : "You defend!"}`;
      case "pool":
        if (ev.n === 0) return attacker ? "Out of reinforcements: last stand!" : "Their reinforcements are spent!";
        return attacker ? "Reinforcements running low!" : "";
    }
    return "";
  }
  /** Hostages as poses to draw like players (slots from HOSTAGE_SLOT_BASE), the rescued ones gone. */
  hostagePoses() {
    return (this.md?.hg ?? []).flatMap(
      (h, i) => h[4] === HOSTAGE_RESCUED ? [] : [{ slot: HOSTAGE_SLOT_BASE + i, x: h[0], y: h[1], z: h[2], yaw: h[3], pitch: 0, alive: true, grounded: true, weapon: -1, powerups: 0, status: 0 }]
    );
  }
  siteLabel(i) {
    const e = this.map.entities[i];
    return e?.kind === "bombsite" ? e.label : "?";
  }
  /** Per frame: world visuals, the status line and objective markers. */
  frame(poses, eye, yaw, now) {
    const md = this.md;
    this.visuals.update(md, poses, this.slot(), eye ? { x: eye.x, y: eye.y - 1.6, z: eye.z } : null, now);
    if (!md) return;
    const mine = this.myTeam?.id;
    const parts = [];
    const markers = [];
    const mark = (id, p, color, icon, label) => {
      if (!eye) return;
      const dist = Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z);
      const text = `${label}${label ? " · " : ""}${Math.round(dist)} m`;
      const screen2 = this.view.project({ x: p.x, y: p.y + 2.9, z: p.z });
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (screen2 && screen2.x > 30 && screen2.x < w - 30 && screen2.y > 60 && screen2.y < h - 30) {
        markers.push({ id, x: screen2.x, y: screen2.y, color, icon, label: text });
        return;
      }
      const bearing = Math.atan2(p.x - eye.x, p.z - eye.z) - yaw;
      const a = Math.atan2(Math.sin(bearing), Math.cos(bearing));
      markers.push({ id, x: w / 2 + Math.sin(a) * (w / 2 - 70), y: h / 2 - Math.cos(a) * (h / 2 - 70), color, icon, label: text, edge: a });
    };
    for (const row of md.fl ?? []) {
      const [ti, state, x, y, z, carrier, secs] = row;
      const t = this.teams[ti];
      if (!t) continue;
      const ours = t.id === mine;
      const word = state === FLAG_CARRIED ? carrier === this.slot() ? "You have it" : `Taken · ${escapeHtml$2(this.hud.name(carrier))}` : state === FLAG_DROPPED ? `Dropped · ${secs}s` : "Home";
      const cls = `ms${state === FLAG_CARRIED ? " taken" : ""}${carrier === this.slot() && state === FLAG_CARRIED ? " me" : ""}`;
      parts.push(`<span class="${cls}" data-flag="${t.id}" data-state="${["home", "taken", "dropped"][state]}" style="color:${t.color}"><b>⚑</b><em>${escapeHtml$2(ours ? "Your flag" : `${t.name} flag`)}: ${word}</em></span>`);
      const pose = state === FLAG_CARRIED ? poses.find((p) => p.slot === carrier) : void 0;
      const at = pose ? { x: pose.x, y: pose.y, z: pose.z } : { x, y, z };
      if (carrier !== this.slot() && (!ours || state !== 0)) mark(`flag_${t.id}`, at, t.color, "⚑", ours ? state === FLAG_CARRIED ? "Stop them" : "Return" : state === FLAG_CARRIED ? "Escort" : "Take");
    }
    if (md.fl) {
      const carrying = md.fl.find((r) => r[1] === FLAG_CARRIED && r[5] === this.slot());
      const base = this.map.entities.find((e) => e.kind === "flag" && e.team === mine);
      if (carrying && base && this.myTeam) mark("base", { x: base.position[0], y: base.position[1], z: base.position[2] }, this.myTeam.color, "⌂", "Home");
    }
    if (md.hl) {
      const [index, holder, secs] = md.hl;
      const e = this.map.entities[index];
      const who = holder >= 0 ? this.teams[holder] : void 0;
      const color = who?.color ?? (holder === -2 ? "#ffb03b" : "#f2f2f2");
      const word = holder === -2 ? "Contested" : who ? `${escapeHtml$2(who.name)} holding` : "Nobody holding";
      parts.push(`<span class="ms" data-hill="${holder}" style="color:${color}"><b>▲</b><em>Hill: ${word}${secs ? ` · moves in ${secs}s` : ""}</em></span>`);
      if (e) mark("hill", { x: e.position[0], y: e.position[1], z: e.position[2] }, color, "▲", "Hill");
    }
    if (md.el) {
      const [round2, next, ...alive] = md.el;
      const counts = this.teams.map((t, i) => `<span style="color:${t.color}">${alive[i] ?? 0}</span>`).join(" v ");
      parts.push(`<span class="ms" data-round="${round2}" style="color:#f2f2f2"><em>Round ${round2} · ${next ? `next round in ${next}s` : `${counts} standing`}</em></span>`);
    }
    if (md.hg) {
      const rescuer = mine === this.teams[0]?.id;
      const me = this.slot();
      const total = md.hg.length;
      const rescued = md.hg.filter((h) => h[4] === HOSTAGE_RESCUED).length;
      const mineLed = md.hg.filter((h) => h[4] === HOSTAGE_FOLLOWING && h[5] === me).length;
      parts.push(`<span class="ms" style="color:#3ddc84"><b>✚</b><em>Hostages: ${rescued} of ${total} rescued (${Math.max(1, Math.ceil(total / 2))} to win)${mineLed ? ` · ${mineLed} following you` : ""}</em></span>`);
      md.hg.forEach((h, i) => {
        if (h[4] === HOSTAGE_RESCUED) return;
        const at = { x: h[0], y: h[1], z: h[2] };
        if (h[4] === HOSTAGE_WAITING) mark(`hostage_${i}`, at, "#e8d8a0", "H", rescuer ? "Rescue (E)" : "Guard");
        else if (!rescuer) mark(`hostage_${i}`, at, "#ff4a3a", "H", "Stop them");
      });
      if (rescuer && mineLed) {
        for (const [i, e] of this.map.entities.entries()) if (e.kind === "rescue") mark(`rescue_${i}`, { x: e.position[0], y: e.position[1], z: e.position[2] }, "#3ddc84", "✚", "Rescue zone");
      }
    }
    if (md.bm) {
      const [state, x, y, z, carrier, secs, progress, actor, site] = md.bm;
      const attacker = mine === this.teams[0]?.id;
      const me = this.slot();
      const at = { x, y, z };
      let word = "";
      if (state === BOMB_PLANTED) word = `Planted at ${this.siteLabel(site)} · ${secs}s`;
      else if (state === BOMB_DROPPED) word = "Dropped";
      else if (state === BOMB_CARRIED) word = carrier === me ? "You carry it" : attacker ? `Carried by ${escapeHtml$2(this.hud.name(carrier))}` : "With the attackers";
      parts.push(`<span class="ms" data-bomb="${state}" style="color:${state === BOMB_PLANTED ? "#ff4a3a" : "#ffb03b"}"><b>✱</b><em>Bomb: ${word}</em></span>`);
      if (progress >= 0 && actor === me) parts.push(`<span class="ms" style="color:#fff"><em>${state === BOMB_PLANTED ? "Defusing" : "Planting"} ${progress}% — hold still</em></span>`);
      if (state === BOMB_PLANTED) mark("bomb", at, "#ff4a3a", "✱", attacker ? "Defend" : "Defuse");
      else if (attacker && state === BOMB_DROPPED) mark("bomb", at, "#ffb03b", "✱", "Pick up");
      if (state !== BOMB_PLANTED) {
        for (const [i, e] of this.map.entities.entries()) if (e.kind === "bombsite") mark(`site_${i}`, { x: e.position[0], y: e.position[1], z: e.position[2] }, "#ff7a2a", e.label, attacker ? carrier === me ? "Plant" : "Site" : "Guard");
      }
    }
    if (md.bt) this.btFrame(md, parts, mark, eye);
    this.hud.setModeStatus(parts.join(""));
    this.hud.setModeMarkers(markers);
  }
  /**
   * Breakthrough on the HUD: the sector strip (taken, in play, to come), the round, the attackers' reinforcements;
   * the objectives in play with their state (a zone's capture, a charge's fuse) and markers on them; your own plant or
   * defuse; and, left behind the line, the fall-back warning with its countdown.
   */
  btFrame(md, parts, mark, eye) {
    const [round2, rounds, , active, pool, , next, outcome] = md.bt;
    const attacking = this.attacking;
    const me = this.slot();
    const strip = this.sectors.map((s, i) => `<i class="bt-sec ${i < active ? "done" : i === active ? "on" : "next"}" title="${escapeHtml$2(s.name)}">${sectorLetter(i)}</i>`).join("");
    const current = this.sectors[active];
    const where = outcome !== BT_ROUND_PLAYING ? outcome === BT_ROUND_ATTACKERS ? "Broken through" : "The line held" : current ? escapeHtml$2(current.name) : "";
    const side = attacking ? "Attack" : "Defend";
    parts.push(`<span class="ms bt-strip" data-bt-sector="${active}" data-bt-side="${attacking ? "attack" : "defend"}" style="color:${attacking ? "#ff8a3a" : "#5ab0ff"}"><b>${side}</b>${strip}<em>${where}${rounds > 1 ? ` · round ${round2}/${rounds}` : ""}${next ? ` · next round in ${next}s` : ""}</em></span>`);
    parts.push(`<span class="ms bt-pool" data-bt-pool="${pool}" style="color:${pool === 0 ? "#ff4a3a" : pool < 10 ? "#ffb03b" : "#f2f2f2"}"><b>⚑</b><em>Reinforcements ${pool}</em></span>`);
    const near = (p, r) => !!eye && Math.hypot(p.x - eye.x, p.z - eye.z) <= r && Math.abs(eye.y - 1.6 - p.y) < 2;
    let need = 0;
    let gone = 0;
    for (const [i, state, progress, extra, actor] of md.bo ?? []) {
      const o = this.btObjective(i);
      const e = this.map.entities[i];
      if (!e || o.sector !== current?.order) continue;
      if (o.kind === "target") {
        need++;
        if (state === BT_OBJ_DONE) gone++;
      }
      if (state !== BT_OBJ_ACTIVE && state !== BT_OBJ_PLANTED && state !== BT_OBJ_DONE) continue;
      const at = { x: e.position[0], y: e.position[1], z: e.position[2] };
      const color = state === BT_OBJ_PLANTED ? "#ff4a3a" : BT_COLORS[o.kind];
      let word;
      if (o.kind === "target") word = state === BT_OBJ_DONE ? "destroyed" : state === BT_OBJ_PLANTED ? `charge ${extra}s` : "standing";
      else if (state === BT_OBJ_DONE) word = "captured";
      else word = `${progress}%${extra === BT_IN_BOTH ? " · contested" : extra === BT_IN_ATTACKERS ? " · taking" : extra === BT_IN_DEFENDERS ? " · held" : ""}`;
      parts.push(`<span class="ms bt-obj" data-bt-obj="${escapeHtml$2(o.label)}" data-state="${state}" style="color:${state === BT_OBJ_DONE ? "#8a93a6" : color}"><b>${o.kind === "target" ? "✱" : "◆"}</b><em>${escapeHtml$2(o.label)} ${word}</em></span>`);
      if (state === BT_OBJ_DONE) continue;
      const label = o.kind === "target" ? state === BT_OBJ_PLANTED ? attacking ? "Defend" : "Defuse" : attacking ? "Plant" : "Guard" : attacking ? o.kind === "final" ? "Take" : "Capture" : "Hold";
      mark(`bt_${i}`, at, color, o.label, label);
      if (actor === me && progress >= 0) parts.push(`<span class="ms me"><em>${state === BT_OBJ_PLANTED ? "Defusing" : "Planting"} ${progress}% — hold still</em></span>`);
      else if (o.kind === "target" && near(at, (e.kind === "objective" ? e.radius : 2) + 0.2) && (attacking && state === BT_OBJ_ACTIVE || !attacking && state === BT_OBJ_PLANTED)) {
        parts.push(`<span class="ms me"><em>E: ${attacking ? "plant a charge" : "defuse"}, then hold still</em></span>`);
      }
    }
    if (current && need > (current.need ?? need) && outcome === BT_ROUND_PLAYING) parts.push(`<span class="ms" style="color:#ff7a5a"><em>Targets: ${gone} of ${current.need} destroyed (${need} to choose from)</em></span>`);
    const behind = md.bf?.find(([slot]) => slot === me);
    if (this.warning) {
      this.warning.hidden = !behind;
      if (behind) {
        const text = behind[1] > 0 ? `Fall back behind the line! ${behind[1]}` : "Fall back behind the line!";
        if (this.warning.textContent !== text) this.warning.textContent = text;
        this.warning.classList.toggle("hurting", behind[1] === 0);
      }
    }
    this.hud.waitLabel = attacking && pool === 0 ? "Out of reinforcements" : "Respawning…";
  }
  dispose() {
    this.visuals.dispose();
    this.warning?.remove();
    this.hud.setModeScores(null);
    this.hud.setModeStatus("");
    this.hud.setModeMarkers([]);
    this.hud.waitLabel = "Respawning…";
  }
}
const SQUAD_COLOR = "#ffb347";
const PLACE_LABEL = { hold: "H", go: "G", defend: "D" };
class SquadHud {
  constructor(root, portraitOf) {
    this.root = root;
    this.portraitOf = portraitOf;
  }
  root;
  portraitOf;
  el = null;
  list = null;
  squad = null;
  /** The cards by slot (made once each; a portrait asked for once per look). */
  cards = /* @__PURE__ */ new Map();
  lastKey = "";
  /** Your squad from the snapshot's squads (null: you lead none, or the variant is off). */
  read(fs, me) {
    let mine = null;
    if (fs) {
      for (const a of fs) {
        const v = readSquad(a);
        if (v.members.includes(me)) {
          mine = v;
          break;
        }
      }
    }
    this.squad = mine;
    return mine;
  }
  get current() {
    return this.squad;
  }
  /** Is this player one of your squadmates (not you)? */
  isMate(slot, me) {
    return !!this.squad && slot !== me && this.squad.members.includes(slot);
  }
  /** The panel, once a snapshot: the order line and a card per squadmate. */
  update(me, mate) {
    const s = this.squad;
    if (!s) {
      if (this.el) this.el.hidden = true;
      return;
    }
    const el2 = this.ensure();
    el2.hidden = false;
    const order = ORDER_LABELS[s.order];
    const spacing = SPACING_TEXT[s.spacing];
    el2.querySelector("#squad-order b").textContent = order;
    const role = el2.querySelector("#squad-order em");
    role.textContent = s.role ? SQUAD_ROLE_TEXT[s.role] : "";
    role.hidden = !s.role;
    role.dataset.role = s.role ?? "";
    const sp = el2.querySelector("#squad-order i");
    sp.textContent = spacing;
    sp.hidden = !spacing;
    const mates = s.members.filter((m) => m !== me).map(mate);
    const key = mates.map((m) => `${m.slot}:${Math.round(m.hp * 20)}:${m.alive ? 1 : 0}:${m.look ?? ""}:${m.name}`).join("|");
    if (key === this.lastKey) return;
    this.lastKey = key;
    const keep = new Set(mates.map((m) => m.slot));
    for (const [slot, c] of this.cards) {
      if (keep.has(slot)) continue;
      c.el.remove();
      this.cards.delete(slot);
    }
    for (const m of mates) {
      let c = this.cards.get(m.slot);
      if (!c) {
        const card2 = document.createElement("div");
        card2.className = "sq-mate";
        card2.dataset.slot = String(m.slot);
        const img = document.createElement("img");
        img.alt = "";
        const name = document.createElement("span");
        name.className = "sq-name";
        const hp = document.createElement("span");
        hp.className = "sq-hp";
        const bar = document.createElement("i");
        hp.append(bar);
        card2.append(img, name, hp);
        c = { el: card2, look: void 0, bar, name };
        this.cards.set(m.slot, c);
      }
      this.list.append(c.el);
      if (c.look !== m.look) {
        c.look = m.look;
        const img = c.el.querySelector("img");
        img.removeAttribute("src");
        const want = m.look;
        if (want) void this.portraitOf?.(want).then((src) => c.look === want && (img.src = src), () => void 0);
      }
      c.name.textContent = m.name;
      const pct2 = m.alive ? Math.max(0, Math.min(1, m.hp)) : 0;
      c.bar.style.width = `${Math.round(pct2 * 100)}%`;
      c.el.classList.toggle("down", !m.alive);
      c.el.classList.toggle("low", m.alive && pct2 < 0.35);
      c.el.title = m.alive ? `${m.name} · ${Math.round(pct2 * 100)}%` : `${m.name} · down`;
    }
  }
  /** Squad markers for the minimap: your squadmates alive (ringed dots) and the order's place. */
  blips(me, at) {
    const s = this.squad;
    if (!s) return [];
    const out = [];
    for (const m of s.members) {
      if (m === me) continue;
      const p = at(m);
      if (p?.alive) out.push({ x: p.x, z: p.z, color: SQUAD_COLOR, ring: true });
    }
    if (s.place) out.push({ x: s.place.x, z: s.place.z, color: SQUAD_COLOR, label: PLACE_LABEL[s.order] ?? "" });
    return out;
  }
  ensure() {
    if (this.el) return this.el;
    const el2 = document.createElement("div");
    el2.id = "squad-hud";
    el2.innerHTML = '<div id="squad-order"><small>Squad</small><em hidden></em><b></b><i hidden></i></div><div class="sq-mates"></div>';
    this.root.append(el2);
    this.el = el2;
    this.list = el2.querySelector(".sq-mates");
    return el2;
  }
}
class CappedTimer {
  constructor(cap = 0.1) {
    this.cap = cap;
  }
  cap;
  /** Seconds left; 0 or less: done. */
  left = 0;
  /** The last frame's time (ms), or null: none yet. */
  last = null;
  /** Start (or restart) it: `seconds` of drawn frames from the next frame on. */
  start(seconds) {
    this.left = seconds;
  }
  /** Each frame (`now` in ms); `run` false: the time passes without counting (held). True while time is left. */
  frame(now, run = true) {
    const step = this.last === null ? 0 : Math.min(this.cap, Math.max(0, (now - this.last) / 1e3));
    this.last = now;
    if (run && this.left > 0) this.left -= step;
    return this.left > 0;
  }
}
const escapeHtml$1 = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const CARD_STEP_CAP = 0.1;
const GLOW = { peak: 0.55, calmPeak: 0.32, easeIn: 0.45, calmEaseIn: 1.2, hold: 1.6, fadeOut: 1.6 };
class RouletteHud {
  constructor(hud, input, map, rules, slot, portraitOf) {
    this.hud = hud;
    this.input = input;
    this.map = map;
    this.rules = rules;
    this.slot = slot;
    this.portraitOf = portraitOf;
    const host = document.getElementById("hud") ?? document.body;
    this.root = el("div", "rl-layer");
    this.glow = el("div", "rl-glow");
    this.card = el("div", "rl-card");
    this.next = el("div", "rl-next");
    this.pick = el("div", "rl-pick");
    this.storm = el("div", "rl-storm");
    for (const e of [this.card, this.next, this.pick, this.storm]) e.hidden = true;
    this.glow.style.opacity = "0";
    this.glow.style.backgroundImage = `url(${glowPicture().toDataURL()})`;
    this.root.append(this.glow, this.card, this.next, this.pick, this.storm);
    host.append(this.root);
  }
  hud;
  input;
  map;
  rules;
  slot;
  portraitOf;
  root;
  card;
  glow;
  pick;
  next;
  storm;
  /** The spawn card's time, over drawn frames (a hitch as the new body is built doesn't use it up unseen). */
  cardTime = new CappedTimer(CARD_STEP_CAP);
  /** The glow's start (ms), or 0: none. */
  glowAt = 0;
  /** The glow's brightest since the last jackpot began (tests). */
  glowPeak = 0;
  me = null;
  offerKey = "";
  stormState = null;
  dispose() {
    this.root.remove();
    this.input.roulettePick = 0;
    this.input.rouletteReroll = false;
  }
  /** The look's name, its body line and the weapon it spawns holding. */
  describe(look, jackpot, tiny = false) {
    const rules = this.rules() ?? {};
    const set = weaponSetInPlay(rules, this.map);
    const sig = rouletteSignatures(rules) ? signatureWeapon(look, jackpot, set) : null;
    return { name: getLook(look).name, line: bodyLine(look, rules, tiny ? "tiny" : null), weapon: sig ? CORE_WEAPONS[sig]?.displayName ?? null : null };
  }
  /** You spawned as `look` (`roll` 1 jackpot, 2 tiny): the spawn card for a couple of seconds; a jackpot's glow. */
  spawned(look, roll) {
    const d = this.describe(look, roll === 1, roll === 2);
    this.card.className = `rl-card${roll === 1 ? " jackpot" : roll === 2 ? " tiny" : ""}`;
    this.card.innerHTML = `${roll === 1 ? "<em>Jackpot!</em>" : roll === 2 ? "<em>Tiny roll!</em>" : ""}<small>You are</small><b>${escapeHtml$1(d.name)}</b><span>${escapeHtml$1(d.line)}</span>${d.weapon ? `<i>${escapeHtml$1(d.weapon)}${roll === 1 ? " · +armour" : ""}</i>` : ""}`;
    this.card.hidden = false;
    this.cardTime.start(SPAWN_CARD_SECONDS);
    if (roll === 1) {
      this.glowAt = performance.now();
      this.glowPeak = 0;
    }
    this.hidePick();
  }
  /** Roulette's events: announcer lines and the feed, the storm (the awards are the match's: awardsHud.ts). */
  event(ev) {
    if (ev.e !== "rl") return;
    const me = ev.s === this.slot();
    switch (ev.a) {
      case "jackpot":
        if (!me) this.hud.say(ev.s, `hit the jackpot as ${getLook(ev.l).name}!`);
        break;
      case "pick":
        if (me) this.hud.showMessage("Streak pick! Choose your next character when you respawn", 3);
        break;
      case "token":
        if (me) this.hud.showMessage(`Reroll token earned (${ev.n} held)`, 2);
        break;
      case "giant":
        if (me) this.hud.showMessage("Giant Slayer! +1", 2);
        else this.hud.say(ev.s, `Giant Slayer: downed ${this.hud.name(ev.t)}`);
        break;
      case "air":
        if (me) this.hud.showMessage("Air kill! +1", 1.5);
        break;
      case "variety":
        if (me) this.hud.showMessage(`Variety bonus +1 (${ev.n} characters)`, 2);
        break;
      case "swap":
        if (me) this.hud.showMessage(`You are now ${getLook(ev.l).name}`, 2);
        break;
      case "reroll":
        if (me) this.hud.showMessage(`Rerolled: next up ${getLook(ev.l).name}`, 2);
        break;
      case "storm":
        if (ev.n === 2) this.hud.showMessage(ev.g !== void 0 && ev.g > (this.rules()?.gravity ?? 1) ? "Gravity surge!" : "Gravity storm: float!", 2.5);
        else if (ev.n === 0) this.hud.showMessage("The gravity storm is over", 2);
        break;
    }
  }
  /** Your own Roulette state (the private snapshot) and whether you are alive: the death screen. */
  state(rp, alive, phase) {
    this.me = rp ?? null;
    const down = !alive && phase === "playing" && !!rp;
    if (!alive && !this.hold) this.hideCard();
    const offer = down && rp?.o && (rp.oc ?? -1) < 0 ? rp.o : null;
    const tokens = rp?.t ?? 0;
    this.input.roulettePick = offer ? offer.length : 0;
    this.input.rouletteReroll = down && tokens > 0;
    if (offer) this.showPick(offer, rp.oj ?? 0, tokens);
    else this.hidePick();
    if (down && !offer && rp) {
      const chosen = rp.o && rp.oc !== void 0 && rp.oc >= 0 ? rp.o[rp.oc] : null;
      const look = chosen ?? rp.n;
      const d = this.describe(look, false);
      const key = `${look}|${tokens}|${chosen ? 1 : 0}`;
      if (this.next.dataset.key !== key) {
        this.next.dataset.key = key;
        this.next.innerHTML = `<small>${chosen ? "You chose" : "Next up"}</small><b>${escapeHtml$1(d.name)}</b><span>${escapeHtml$1(d.line)}</span>${tokens > 0 && !chosen ? `<button type="button" class="rl-reroll" id="rl-reroll">R: reroll <small>(${tokens} ${tokens === 1 ? "token" : "tokens"})</small></button>` : ""}`;
        this.next.querySelector("button")?.addEventListener("click", () => this.input.chooseRoulette(ROULETTE_SAY_REROLL));
      }
      this.next.hidden = false;
    } else this.next.hidden = true;
  }
  showPick(cards, jackpots, tokens) {
    const key = `${cards.join()}|${jackpots}|${tokens}`;
    if (this.offerKey === key && !this.pick.hidden) return;
    this.offerKey = key;
    this.pick.innerHTML = "";
    this.pick.append(Object.assign(document.createElement("h3"), { textContent: "Streak pick: choose your next character" }));
    const row = document.createElement("div");
    row.className = "rl-pick-row";
    cards.forEach((look, i) => {
      const jp = (jackpots & 1 << i) !== 0;
      const d = this.describe(look, jp);
      const b = document.createElement("button");
      b.type = "button";
      b.className = `rl-pick-card${jp ? " jackpot" : ""}`;
      b.id = `rl-pick-${i}`;
      b.dataset.look = look;
      b.innerHTML = `<kbd>${i + 1}</kbd><img alt="" /><b>${escapeHtml$1(d.name)}</b><span>${escapeHtml$1(d.line)}</span>${d.weapon ? `<i>${escapeHtml$1(d.weapon)}</i>` : ""}${jp ? "<em>Jackpot</em>" : ""}`;
      b.addEventListener("click", () => this.input.chooseRoulette(ROULETTE_SAY_PICK + i));
      const img = b.querySelector("img");
      void this.portraitOf?.(look).then((src) => img.src = src, () => void 0);
      row.append(b);
    });
    this.pick.append(row, Object.assign(document.createElement("p"), { textContent: `Press 1, 2 or 3 (or click)${tokens > 0 ? " · R: reroll the three" : ""}. The first if you don't choose.` }));
    this.pick.hidden = false;
  }
  hidePick() {
    if (this.pick.hidden) return;
    this.pick.hidden = true;
    this.offerKey = "";
  }
  /** Lunar's gravity storm (the snapshot's `rl`): the warning's countdown, then the storm's line. */
  stormSnapshot(rl) {
    this.stormState = rl ?? null;
    if (!rl || rl[0] === 0) {
      this.storm.hidden = true;
      return;
    }
    const heavy = rl[3] > (this.rules()?.gravity ?? 1) * 100;
    const text = rl[0] === 1 ? `Gravity storm in ${Math.max(1, Math.min(STORM_WARN_SECONDS, rl[1]))}` : `${heavy ? "Gravity surge" : "Gravity storm"}: ${rl[1]} s`;
    if (this.storm.textContent !== text) this.storm.textContent = text;
    this.storm.className = `rl-storm${rl[0] === 2 ? " on" : ""}${heavy ? " heavy" : ""}`;
    this.storm.hidden = false;
  }
  /** Off the playing field (the scoreboard, the countdown): the card, the storm and the death screen go. */
  phase(phase) {
    if (phase !== "playing") {
      if (!this.hold) this.hideCard();
      this.storm.hidden = true;
      this.next.hidden = true;
      this.hidePick();
    }
  }
  hideCard() {
    this.card.hidden = true;
    this.cardTime.start(0);
  }
  /** Tests (pictures on a slow page): the card and the glow stay as they are while held. */
  hold = false;
  /** Each frame: the card's time, the glow's ease (in, hold, out; never a flash). */
  frame(now) {
    const cardOn = this.cardTime.frame(now, !this.hold);
    if (this.hold) return;
    if (!this.card.hidden && !cardOn) this.card.hidden = true;
    if (!this.glowAt) return;
    const calm = reduceFlashing();
    const t = (now - this.glowAt) / 1e3;
    const easeIn = calm ? GLOW.calmEaseIn : GLOW.easeIn;
    const peak = calm ? GLOW.calmPeak : GLOW.peak;
    let v;
    if (t < easeIn) v = peak * smooth(t / easeIn);
    else if (t < easeIn + GLOW.hold) v = peak;
    else if (t < easeIn + GLOW.hold + GLOW.fadeOut) v = peak * (1 - smooth((t - easeIn - GLOW.hold) / GLOW.fadeOut));
    else {
      v = 0;
      this.glowAt = 0;
    }
    this.glow.style.opacity = v.toFixed(3);
    this.glowPeak = Math.max(this.glowPeak, v);
  }
  /** The jackpot glow as drawn (its picture and its opacity now): the flashing flow lays it over the frames it grabs. */
  glowOverlay() {
    return { image: glowPicture(), opacity: Number(this.glow.style.opacity || 0) };
  }
  /** For tests: the glow's opacity now, the storm and the state last seen. */
  debug() {
    return { glow: Number(this.glow.style.opacity || 0), glowPeak: this.glowPeak, storm: this.stormState, me: this.me };
  }
}
let glowCanvas = null;
function glowPicture() {
  if (glowCanvas) return glowCanvas;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 144;
  const ctx = c.getContext("2d");
  ctx.save();
  ctx.translate(128, 72);
  ctx.scale(1, 144 / 256);
  const g = ctx.createRadialGradient(0, 0, 70, 0, 0, 182);
  g.addColorStop(0, "rgba(255, 196, 60, 0)");
  g.addColorStop(0.55, "rgba(255, 196, 60, 0.35)");
  g.addColorStop(1, "rgba(255, 196, 60, 0.9)");
  ctx.fillStyle = g;
  ctx.fillRect(-128, -128, 256, 256);
  ctx.restore();
  return glowCanvas = c;
}
const smooth = (x) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};
function el(tag, id) {
  const e = document.createElement(tag);
  e.id = id;
  return e;
}
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
class AwardsHud {
  constructor(hud, slot, squad = () => null) {
    this.hud = hud;
    this.slot = slot;
    this.squad = squad;
    const host = document.getElementById("hud") ?? document.body;
    this.panel = document.createElement("div");
    this.panel.id = "match-awards";
    this.panel.hidden = true;
    host.append(this.panel);
  }
  hud;
  slot;
  squad;
  panel;
  aw = [];
  dispose() {
    this.panel.remove();
  }
  event(ev) {
    if (ev.e === "awards") {
      this.aw = ev.aw;
      this.hud.setSquadAwards(ev.aw);
    } else if (ev.e === "callout") {
      const me = this.slot();
      const them = (s) => this.hud.name(s);
      if (ev.a === "revenge") {
        if (ev.s === me) this.hud.showMessage(`Revenge on ${them(ev.t)}!`, 2);
        else if (ev.t === me) this.hud.showMessage(`${them(ev.s)} got their revenge`, 2);
      } else if (ev.s === me) this.hud.showMessage(`You're ${them(ev.t)}'s nemesis: ${ev.n ?? 3} in a row`, 2.5);
      else if (ev.t === me) this.hud.showMessage(`${them(ev.s)} is your nemesis: ${ev.n ?? 3} in a row`, 2.5);
    }
  }
  /** The awards while the scoreboard is up (intermission); cleared once the next round is under way. */
  phase(phase) {
    const show = phase === "intermission" && this.aw.length > 0;
    if (show && this.panel.hidden) {
      this.panel.innerHTML = `<h3>Awards</h3>${this.shown().map((a) => {
        const t = awardText(a, (s) => this.hud.name(s));
        if (a[0] === "squadmvp" && a[3] === this.squad()) t.title = "Your Squad's MVP";
        return `<div class="award ${a[0]}"><b>${escapeHtml(t.title)}</b><span>${escapeHtml(t.line)}</span></div>`;
      }).join("")}`;
    }
    this.panel.hidden = !show;
    if (phase !== "intermission" && phase !== "playing") {
      if (this.aw.length) this.hud.setSquadAwards([]);
      this.aw = [];
    }
  }
  /** The awards on the panel: the match's, Best Squad, and one Squad MVP (yours, else the best squad's). */
  shown() {
    const mine = this.squad();
    const best = this.aw.find((a) => a[0] === "bestsquad")?.[3];
    const mvp = this.aw.find((a) => a[0] === "squadmvp" && a[3] === mine) ?? this.aw.find((a) => a[0] === "squadmvp" && a[3] === best);
    return this.aw.filter((a) => a[0] !== "squadmvp" || a === mvp);
  }
  /** For tests: the awards last given. */
  debug() {
    return { awards: this.aw.length, kinds: this.aw.map((a) => a[0]), shown: this.shown().map((a) => a[0]) };
  }
  /** Tests and the flashing flow's picture: show these awards as the scoreboard would. */
  show(aw) {
    this.aw = aw;
    this.hud.setSquadAwards(aw);
    this.panel.hidden = true;
    this.phase("intermission");
  }
}
const PAD_CENTRE = 0.32;
const LONG_PRESS_MS = 380;
const PAD_SLIDE = 0.5;
const SPRINT_PAST = 1.2;
const DEADZONE = 0.12;
class TouchControls {
  constructor(input, parent, hooks) {
    this.input = input;
    this.hooks = hooks;
    const signal = this.abort.signal;
    this.el = document.createElement("div");
    this.el.id = "touch-ui";
    this.el.hidden = true;
    const look = div("tc-look");
    const pad = div("tc-pad");
    for (const d of ["up", "right", "down", "left"]) pad.append(div(`tc-arm ${d}`));
    const knob = div("tc-knob");
    const jump = div("tc-jump");
    jump.innerHTML = "<span>Jump</span><small>hold: crouch</small>";
    pad.append(knob, jump);
    const btn = (cls, label, title) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `tc-btn ${cls}`;
      b.textContent = label;
      b.setAttribute("aria-label", title);
      return b;
    };
    const fire = btn("tc-fire", "Fire", "Fire (drag to aim)");
    this.aimBtn = btn("tc-aim", "Aim", "Aim down the sights");
    const melee = btn("tc-melee", "Melee", "Quick melee");
    const reload = btn("tc-reload", "Reload", "Reload");
    const use = btn("tc-use", "Use", "Use: vehicles, doors, pickups");
    const thrw = btn("tc-throw", "Throw", "Hold to aim a throw, let go to throw");
    this.wheelBtn = btn("tc-wheel", "Weapons", "Weapon wheel");
    this.ordersBtn = btn("tc-orders", "Orders", "Squad orders (the order wheel)");
    this.ordersBtn.hidden = true;
    const pause = btn("tc-pause", "II", "Pause");
    this.scoresBtn = btn("tc-scores", "", "Scores: tap to show or hide the scoreboard");
    this.el.append(look, pad, fire, this.aimBtn, melee, reload, use, thrw, this.wheelBtn, this.ordersBtn, pause, this.scoresBtn);
    this.watchBar = div("tc-watch");
    this.watchBar.hidden = true;
    const watchBtn = (label, title, code) => {
      const b = btn("tc-wbtn", label, title);
      b.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.input.virtualKey(code, true);
          this.input.virtualKey(code, false);
        },
        { signal }
      );
      return b;
    };
    this.joinBtn = watchBtn("Join", "Join the game", "KeyJ");
    this.watchBar.append(watchBtn("◀", "Previous player", "ArrowLeft"), watchBtn("Camera", "Follow players or fly the free camera", "Space"), watchBtn("▶", "Next player", "ArrowRight"), this.joinBtn);
    this.el.append(this.watchBar);
    this.rotate = div("");
    this.rotate.id = "touch-rotate";
    this.rotate.innerHTML = "<div><b>Turn your phone sideways</b><small>Tile Trigger plays in landscape</small></div>";
    parent.append(this.el, this.rotate);
    const opts = { signal };
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const track = (target, h) => {
      const fingers = /* @__PURE__ */ new Set();
      target.addEventListener(
        "pointerdown",
        (e) => {
          stop(e);
          try {
            target.setPointerCapture(e.pointerId);
          } catch {
          }
          fingers.add(e.pointerId);
          h.down(e);
        },
        opts
      );
      target.addEventListener(
        "pointermove",
        (e) => {
          if (fingers.has(e.pointerId)) h.move?.(e);
        },
        opts
      );
      const end = (e) => {
        if (!fingers.delete(e.pointerId)) return;
        h.up(e);
      };
      target.addEventListener("pointerup", end, opts);
      target.addEventListener("pointercancel", end, opts);
      target.addEventListener("lostpointercapture", end, opts);
    };
    const dragLook = () => {
      const last = /* @__PURE__ */ new Map();
      return {
        start: (e) => last.set(e.pointerId, { x: e.clientX, y: e.clientY }),
        move: (e) => {
          const l = last.get(e.pointerId);
          if (!l) return;
          this.input.addTouchLook(e.clientX - l.x, e.clientY - l.y);
          last.set(e.pointerId, { x: e.clientX, y: e.clientY });
        },
        end: (e) => last.delete(e.pointerId)
      };
    };
    const lookDrag = dragLook();
    track(look, { down: lookDrag.start, move: lookDrag.move, up: lookDrag.end });
    const fireDrag = dragLook();
    track(fire, {
      down: (e) => {
        fireDrag.start(e);
        fire.classList.add("on");
        this.input.virtualKey("KeyF", true);
      },
      move: fireDrag.move,
      up: (e) => {
        fireDrag.end(e);
        fire.classList.remove("on");
        this.input.virtualKey("KeyF", false);
      }
    });
    const holdKey = (b, code) => track(b, {
      down: () => {
        b.classList.add("on");
        this.input.virtualKey(code, true);
      },
      up: () => {
        b.classList.remove("on");
        this.input.virtualKey(code, false);
      }
    });
    holdKey(melee, "KeyY");
    holdKey(reload, "KeyR");
    holdKey(use, "KeyE");
    holdKey(thrw, "KeyG");
    track(this.aimBtn, {
      down: () => this.input.virtualKey("KeyX", !this.input.held("KeyX")),
      up: () => void 0
    });
    track(this.wheelBtn, {
      down: () => {
        if (this.input.wheelOpen) this.input.closeWheel(false);
        else this.input.openWheel("touch");
      },
      up: () => void 0
    });
    track(this.ordersBtn, {
      down: () => {
        if (this.input.wheelOpen) this.input.closeWheel(false);
        else this.input.openWheel("touch", "order");
      },
      up: () => void 0
    });
    track(pause, { down: () => this.hooks.pause(), up: () => void 0 });
    track(this.scoresBtn, { down: () => this.input.virtualKey("Tab", !this.input.held("Tab")), up: () => void 0 });
    let centre2 = null;
    let sprinting = false;
    const vec = (e) => {
      const r = pad.getBoundingClientRect();
      const half2 = r.width / 2;
      return { x: (e.clientX - r.left - half2) / half2, y: (e.clientY - r.top - half2) / half2 };
    };
    const setMove = (x, y) => {
      const len = Math.hypot(x, y);
      const k = len > 1 ? 1 / len : 1;
      const mx = Math.abs(x * k) < DEADZONE ? 0 : x * k;
      const my = Math.abs(y * k) < DEADZONE ? 0 : y * k;
      this.input.setTouchMove(mx, -my);
      knob.style.transform = `translate(${mx * 100}%, ${my * 100}%)`;
      const sprint = len > SPRINT_PAST && -y / len > 0.75;
      if (sprint !== sprinting) {
        sprinting = sprint;
        this.input.virtualKey("ShiftLeft", sprint);
        pad.classList.toggle("sprint", sprint);
      }
    };
    const endCentre = () => {
      if (!centre2) return;
      clearTimeout(centre2.timer);
      jump.classList.remove("on");
      centre2 = null;
    };
    track(pad, {
      down: (e) => {
        const v = vec(e);
        if (Math.hypot(v.x, v.y) < PAD_CENTRE) {
          jump.classList.add("on");
          const c = {
            id: e.pointerId,
            at: e.timeStamp,
            long: false,
            timer: window.setTimeout(() => {
              requestAnimationFrame(() => {
                if (centre2 !== c) return;
                c.long = true;
                this.input.virtualKey("KeyC", true);
                this.input.virtualKey("KeyC", false);
                navigator.vibrate?.(15);
              });
            }, LONG_PRESS_MS)
          };
          centre2 = c;
        } else setMove(v.x, v.y);
      },
      move: (e) => {
        const v = vec(e);
        if (centre2?.id === e.pointerId) {
          if (Math.hypot(v.x, v.y) < PAD_SLIDE) return;
          endCentre();
        }
        setMove(v.x, v.y);
      },
      up: (e) => {
        if (centre2?.id === e.pointerId) {
          const tap = e.timeStamp - centre2.at < LONG_PRESS_MS;
          if (tap && centre2.long) {
            this.input.virtualKey("KeyC", true);
            this.input.virtualKey("KeyC", false);
          }
          if (tap && centre2.long && !this.input.crouchOn && !this.input.spectating) {
            this.input.jumpAfterStanding();
          } else if (tap) {
            this.input.virtualKey("Space", true);
            this.input.virtualKey("Space", false);
          }
          endCentre();
        }
        setMove(0, 0);
      }
    });
    this.el.addEventListener("contextmenu", (e) => e.preventDefault(), opts);
  }
  input;
  hooks;
  el;
  rotate;
  abort = new AbortController();
  aimBtn;
  wheelBtn;
  /** Fireteams: the order wheel's button (shown while you lead a squad). */
  ordersBtn;
  watchBar;
  /** The scorebar's tap target (proposal 6 in docs/MOBILE_AUDIT.md). */
  scoresBtn;
  joinBtn;
  /** Shown while you play; hidden in the pause menu. Keeps the Aim and Weapons buttons' state in step. */
  setActive(on) {
    if (this.el.hidden === !on) return;
    this.el.hidden = !on;
    if (!on && this.input.held("Tab")) this.input.virtualKey("Tab", false);
  }
  /** Out of play: the watching buttons (Join for spectators by choice); null hides them. */
  setWatching(w) {
    if (this.watchBar.hidden !== !w) this.watchBar.hidden = !w;
    if (w && this.joinBtn.hidden === w.join) this.joinBtn.hidden = !w.join;
  }
  /** Once a frame: the toggle buttons show their state. */
  update() {
    this.aimBtn.classList.toggle("on", this.input.held("KeyX"));
    this.scoresBtn.classList.toggle("on", this.input.held("Tab"));
    this.wheelBtn.classList.toggle("on", this.input.wheelOpen && this.input.wheelKind === "weapon");
    if (this.ordersBtn.hidden === this.input.ordersOn) this.ordersBtn.hidden = !this.input.ordersOn;
    this.ordersBtn.classList.toggle("on", this.input.wheelOpen && this.input.wheelKind === "order");
  }
  dispose() {
    this.abort.abort();
    this.el.remove();
    this.rotate.remove();
  }
}
function div(cls) {
  const d = document.createElement("div");
  if (cls) d.className = cls;
  return d;
}
function wheelEntries(codes, inventory, held) {
  const out = [];
  for (const code of codes) {
    const def = weaponByCode(code);
    const a = inventory.get(code);
    if (!def || !a) continue;
    const ammo = def.heat ? `${Math.round(a[3])}°` : def.magazine === 0 ? def.alt?.reload ? `∞ · ${a[2]} / ${a[1]}` : "∞" : `${a[0]} / ${a[1]}`;
    out.push({ code, name: def.displayName, ammo, empty: def.magazine > 0 && !def.heat && a[0] === 0 && a[1] === 0, held: code === held, weaponId: def.id });
  }
  return out;
}
const DEAD = 0.3;
class WeaponWheel {
  el;
  ring;
  label;
  dot;
  entries = [];
  items = [];
  hover = -1;
  key = "";
  /** A finger points the wheel (the input keeps where it points, as it does for the mouse). */
  onPoint;
  /** A finger picked an entry on the wheel (touch): the session closes it with a pick. */
  onTouchPick;
  /** A finger let go on the middle: close without switching. */
  onTouchCancel;
  /** `id`: the overlay's id ('order-wheel': Fireteams' order wheel, the same ring with orders on it, no icons). */
  constructor(parent, id = "weapon-wheel") {
    this.el = document.createElement("div");
    this.el.id = id;
    this.el.hidden = true;
    this.ring = document.createElement("div");
    this.ring.className = "ww-ring";
    this.label = document.createElement("div");
    this.label.className = "ww-centre";
    this.dot = document.createElement("i");
    this.dot.className = "ww-dot";
    this.ring.append(this.label, this.dot);
    this.el.append(this.ring);
    parent.append(this.el);
    const point = (e) => {
      const r = this.ring.getBoundingClientRect();
      const half2 = r.width / 2;
      const x = (e.clientX - r.left - half2) / half2;
      const y = (e.clientY - r.top - half2) / half2;
      this.aim(x, y);
      this.onPoint?.(x, y);
      return Math.hypot(x, y);
    };
    let outside = false;
    this.el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        this.el.setPointerCapture(e.pointerId);
      } catch {
      }
      outside = point(e) > 1.1;
    });
    this.el.addEventListener("pointermove", (e) => {
      if (this.el.hasPointerCapture?.(e.pointerId)) point(e);
    });
    this.el.addEventListener("pointerup", (e) => {
      if (!this.el.hasPointerCapture?.(e.pointerId)) return;
      point(e);
      if (this.hover >= 0 && !outside) this.onTouchPick?.();
      else this.onTouchCancel?.();
    });
  }
  get shown() {
    return !this.el.hidden;
  }
  /** Open (or refresh) the wheel with these weapons. */
  show(entries) {
    const key = entries.map((e) => `${e.code}:${e.ammo}:${e.empty ? 1 : 0}:${e.held ? 1 : 0}`).join(",");
    if (this.shown && key === this.key) return;
    const layout = !this.shown || entries.map((e) => e.code).join() !== this.entries.map((e) => e.code).join();
    this.key = key;
    this.entries = entries;
    if (layout) {
      for (const it of this.items) it.remove();
      const n = entries.length;
      const fit = Math.min(25, 2 * Math.PI * 37 / Math.max(n, 1) * 0.92);
      this.ring.style.setProperty("--ww-item", `${fit.toFixed(2)}%`);
      this.ring.classList.toggle("compact", n > 9);
      this.ring.classList.toggle("dense", n > 16);
      this.items = entries.map((e, i) => {
        const it = document.createElement("div");
        it.className = "ww-item";
        it.dataset.code = String(e.code);
        const a = i / n * Math.PI * 2;
        it.style.left = `${50 + Math.sin(a) * 37}%`;
        it.style.top = `${50 - Math.cos(a) * 37}%`;
        const icon = e.weaponId ? weaponIcon(e.weaponId, "ww-icon") : null;
        const name = document.createElement("b");
        const ammo = document.createElement("small");
        it.append(...icon ? [icon] : [], name, ammo);
        this.ring.append(it);
        return it;
      });
      this.hover = -1;
    }
    entries.forEach((e, i) => {
      const it = this.items[i];
      it.querySelector("b").textContent = e.name;
      it.querySelector("small").textContent = e.ammo;
      it.classList.toggle("empty", e.empty);
      it.classList.toggle("held", e.held);
    });
    this.el.hidden = false;
    this.paint();
  }
  /** Point the wheel (x right, y down; the rim is length 1). */
  aim(x, y) {
    const len = Math.hypot(x, y);
    const n = this.entries.length;
    let hover = -1;
    if (n && len >= DEAD) {
      const a = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2);
      hover = Math.round(a / (Math.PI * 2 / n)) % n;
    }
    const k = len > 1 ? 1 / len : 1;
    this.dot.style.left = `${50 + x * k * 37}%`;
    this.dot.style.top = `${50 + y * k * 37}%`;
    if (hover === this.hover) return;
    this.hover = hover;
    this.paint();
  }
  /** The weapon highlighted now, or null. */
  get picked() {
    return this.hover >= 0 ? this.entries[this.hover]?.code ?? null : null;
  }
  /** Close the wheel; returns the weapon it pointed at (or null). */
  hide() {
    const pick = this.picked;
    this.el.hidden = true;
    this.hover = -1;
    this.key = "";
    return pick;
  }
  dispose() {
    this.el.remove();
  }
  paint() {
    this.items.forEach((it, i) => it.classList.toggle("on", i === this.hover));
    const e = this.hover >= 0 ? this.entries[this.hover] : this.entries.find((x) => x.held);
    this.label.replaceChildren();
    if (!e) return;
    const b = document.createElement("b");
    b.textContent = e.name;
    const s = document.createElement("small");
    s.textContent = e.empty ? "Empty" : e.ammo;
    this.label.append(b, s);
  }
}
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const keyMarkup = (s) => esc(s).replace(/\[([^\]]+)\]/g, "<kbd>$1</kbd>");
class CoachHud {
  constructor(root, touch, tutorial) {
    this.touch = touch;
    this.tip = document.createElement("div");
    this.tip.id = "coach-tip";
    this.tip.setAttribute("role", "status");
    this.tip.setAttribute("aria-live", "polite");
    root.append(this.tip);
    if (!tutorial) return;
    const p = document.createElement("div");
    p.id = "tutorial";
    p.className = "coach-panel";
    p.innerHTML = `<div class="tut-head"><span class="tut-kicker">Tutorial</span><span class="tut-count"></span><button type="button" id="tutorial-skip" class="tut-skip" title="Skip the tutorial and go back to the main menu">Skip${touch ? "" : " <small>Esc pauses</small>"}</button></div><div class="tut-dots">${TUTORIAL_STEPS.map(() => "<i></i>").join("")}</div><b class="tut-title"></b><p class="tut-text"></p><div class="tut-bar"><i></i></div>`;
    p.querySelector("#tutorial-skip").addEventListener("click", (e) => {
      e.stopPropagation();
      tutorial.onSkip();
    });
    root.append(p);
    this.panel = p;
  }
  touch;
  panel = null;
  tip;
  shownTip = null;
  drawn = "";
  justDone = 0;
  /** The tutorial's card, as it stands. `stepDone`: a step just finished (its tick shows for a moment). */
  tutorial(t, stepDone, now) {
    const p = this.panel;
    if (!p) return;
    if (stepDone) this.justDone = now + 0.7;
    const step = t.step;
    const total = TUTORIAL_STEPS.length;
    const key = step ? `${t.index}` : "done";
    if (key !== this.drawn) {
      this.drawn = key;
      p.dataset.step = step?.id ?? "done";
      p.querySelector(".tut-count").textContent = `${Math.min(t.index + 1, total)} / ${total}`;
      p.querySelectorAll(".tut-dots i").forEach((d, i) => {
        d.className = i < t.index ? "done" : i === t.index ? "on" : "";
      });
      p.querySelector(".tut-title").textContent = step ? step.title : "Tutorial complete";
      p.querySelector(".tut-text").innerHTML = step ? keyMarkup(this.touch ? step.touch : step.kb) : keyMarkup(this.touch ? "You're ready. Practise here as long as you like; [II] then Leave goes back to the menu, where Quick Play starts a match." : "You're ready. Practise here as long as you like; [Esc] then Leave goes back to the menu, where Quick Play starts a match.");
      p.querySelector("#tutorial-skip").hidden = !step;
    }
    p.classList.toggle("just-done", now < this.justDone);
    p.querySelector(".tut-bar i").style.width = `${Math.round(t.progress * 100)}%`;
  }
  /** The tip to show (null: none). */
  setTip(id) {
    if (id === this.shownTip) return;
    this.shownTip = id;
    if (id) {
      this.tip.innerHTML = `<span class="tip-kicker">Tip</span> ${keyMarkup(this.touch ? TIP_TEXT[id].touch : TIP_TEXT[id].kb)}`;
      this.tip.dataset.tip = id;
    }
    this.tip.classList.toggle("on", !!id);
  }
  dispose() {
    this.tip.remove();
    this.panel?.remove();
  }
}
const INTERP_DELAY_TICKS = 6;
const BUFFER_TICKS = TICK_RATE * 2;
const CLOCK_GAIN = 0.05;
const CLOCK_RESYNC_TICKS = 6;
const EXTRAPOLATE_TICKS = 5;
const LATE_RUN_RESYNC = 12;
class Interpolator {
  frames = [];
  latestTick = 0;
  /** Smoothed server tick minus local time in ticks (null before the first snapshot). */
  clockOffset = null;
  /** Snapshots in a row that came far later than the estimate. */
  lateRun = 0;
  /** `hold`: slots left out of this snapshot to save bandwidth; they are drawn from the frames that had them. */
  push(tick, players, projectiles = [], hold, now = performance.now()) {
    if (tick <= this.latestTick && this.frames.length) return;
    this.frames.push({ tick, players: new Map(players.map((p) => [p.s, p])), projectiles: new Map(projectiles.map(([id, x, y, z, v]) => [id, [x, y, z, v ?? 0]])), ...hold?.length ? { hold: new Set(hold) } : {} });
    this.latestTick = tick;
    const offset = tick - now / 1e3 * TICK_RATE;
    const late = this.clockOffset !== null && offset < this.clockOffset - CLOCK_RESYNC_TICKS;
    this.lateRun = late ? this.lateRun + 1 : 0;
    if (this.clockOffset === null || offset > this.clockOffset + CLOCK_RESYNC_TICKS || this.lateRun > LATE_RUN_RESYNC) {
      if (netProbe.on && this.clockOffset !== null) netProbe.resyncs++;
      this.clockOffset = offset;
      this.lateRun = 0;
    } else if (!late) this.clockOffset += (offset - this.clockOffset) * CLOCK_GAIN;
    while (this.frames.length > 2 && this.frames[0].tick < tick - BUFFER_TICKS) this.frames.shift();
  }
  /** The (fractional) server tick remote players are currently drawn at. Sent with inputs for lag compensation. */
  renderTick(now = performance.now()) {
    if (!this.frames.length) return 0;
    return Math.min(this.drawTick(now), this.latestTick);
  }
  /** The tick players are drawn at: renderTick, but allowed a little past the newest snapshot. */
  drawTick(now) {
    const estServerTick = now / 1e3 * TICK_RATE + (this.clockOffset ?? this.latestTick);
    const tick = Math.min(estServerTick - INTERP_DELAY_TICKS, this.latestTick + EXTRAPOLATE_TICKS);
    if (now >= this.lastDraw.at) this.lastDraw = { at: now, tick: Math.max(tick, this.lastDraw.tick) };
    return Math.min(this.lastDraw.tick, this.latestTick + EXTRAPOLATE_TICKS);
  }
  lastDraw = { at: -Infinity, tick: -Infinity };
  /** The two buffered frames around `renderTick` and the blend factor between them. */
  bracket(renderTick) {
    let a = this.frames[0];
    let b = a;
    for (const f of this.frames) {
      if (f.tick <= renderTick) a = f;
      if (f.tick >= renderTick) {
        b = f;
        break;
      }
      b = f;
    }
    const span = b.tick - a.tick;
    return { a, b, t: span > 0 ? Math.max(0, Math.min(1, (renderTick - a.tick) / span)) : 1 };
  }
  /** Interpolated projectile positions by ID. */
  sampleProjectiles(now = performance.now()) {
    const out = /* @__PURE__ */ new Map();
    if (!this.frames.length) return out;
    const { a, b, t } = this.bracket(this.renderTick(now));
    for (const [id, pb] of b.projectiles) {
      const pa = a.projectiles.get(id) ?? pb;
      out.set(id, [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t, pb[3]]);
    }
    return out;
  }
  sample(now = performance.now()) {
    if (!this.frames.length) return [];
    const drawTick = this.drawTick(now);
    const renderTick = Math.min(drawTick, this.latestTick);
    let a = this.frames[0];
    let b = a;
    for (const f of this.frames) {
      if (f.tick <= renderTick) a = f;
      if (f.tick >= renderTick) {
        b = f;
        break;
      }
      b = f;
    }
    const n = this.frames.length;
    if (netProbe.on) {
      netProbe.sampled++;
      if (drawTick > this.latestTick) netProbe.extrapolated++;
    }
    if (drawTick > this.latestTick && n > 1) {
      a = this.frames[n - 2];
      b = this.frames[n - 1];
    }
    const span = b.tick - a.tick;
    const t = span > 0 ? Math.max(0, Math.min(1 + EXTRAPOLATE_TICKS / span, (drawTick - a.tick) / span)) : 1;
    const out = [];
    const last = this.frames[this.frames.length - 1];
    const held = last.hold || b.hold ? [...last.players.keys(), ...last.hold ?? []].filter((slot) => !b.players.has(slot)) : [];
    const pairs = [];
    for (const [slot, pb] of b.players) {
      if (a !== b && a.hold?.has(slot)) held.push(slot);
      else pairs.push([slot, a.players.get(slot), pb, t]);
    }
    for (const slot of held) {
      let f0;
      let fa;
      let fb;
      for (const f of this.frames) {
        if (!f.players.has(slot)) continue;
        if (f.tick <= renderTick) {
          f0 = fa;
          fa = f;
        } else {
          fb = f;
          break;
        }
      }
      if (!fb && fa && f0) {
        const gap = fa.tick - f0.tick;
        pairs.push([slot, f0.players.get(slot), fa.players.get(slot), gap > 0 ? Math.min(2, (renderTick - f0.tick) / gap) : 1]);
        continue;
      }
      if (netProbe.on && !fb) netProbe.frozen++;
      const pa = (fa ?? fb)?.players.get(slot);
      const pb = (fb ?? fa)?.players.get(slot);
      if (!pa || !pb) continue;
      const span2 = fa && fb ? fb.tick - fa.tick : 0;
      pairs.push([slot, pa, pb, span2 > 0 ? Math.max(0, Math.min(1, (renderTick - fa.tick) / span2)) : 1]);
    }
    for (const [slot, pa, pb, t2] of pairs) {
      const jumped = pa ? Math.hypot(pb.p[0] - pa.p[0], pb.p[1] - pa.p[1], pb.p[2] - pa.p[2]) > 6 : false;
      const blend = pa && pa.alive === pb.alive && !jumped ? t2 : 1;
      const from = blend === 1 || !pa ? pb : pa;
      out.push({
        slot,
        x: from.p[0] + (pb.p[0] - from.p[0]) * blend,
        y: from.p[1] + (pb.p[1] - from.p[1]) * blend,
        z: from.p[2] + (pb.p[2] - from.p[2]) * blend,
        yaw: from.yaw + angleDelta(from.yaw, pb.yaw) * blend,
        pitch: from.pitch + (pb.pitch - from.pitch) * blend,
        alive: pb.alive === 1,
        grounded: pb.g === 1,
        ...pb.sn ? { stance: pb.sn } : {},
        ...pb.sr ? { sprinting: true } : {},
        ...pb.em ? { emote: true } : {},
        ...pb.ch ? { chute: pb.ch } : {},
        ...pb.zl ? { zip: pb.zl[0], zipSpeed: Math.abs(pb.zl[2]) } : {},
        weapon: pb.w,
        powerups: pb.pu,
        status: pb.fx ?? 0,
        state: pb.st
      });
    }
    return out;
  }
}
const MAX_PENDING = 120;
const ORDER = new Map(WEAPONS_BY_SLOT.map((w) => [w.id, weaponCode(w)]));
const STANCE_SPREAD = [1, 0.7, 0.5];
class LocalPlayer {
  constructor(physics) {
    this.physics = physics;
    this.collider = physics.createPlayerCollider();
  }
  physics;
  state = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: false };
  alive = false;
  health = 100;
  armor = 0;
  /** Held weapon code (predicted). */
  held = 0;
  /** Owned weapons: code -> [magazine, reserve, second-trigger rounds, heat %] (server values, adjusted by predicted shots). */
  inventory = /* @__PURE__ */ new Map();
  /** The map's jump pads (launches are predicted like the server's). */
  pads = [];
  liquids = [];
  ladders = [];
  /** The map's ziplines (E grabs one; riding is predicted like the server's), and your team for team-only lines. */
  ziplines = [];
  team = () => null;
  /** Your body size (BODY_SIZES scale), the same the server uses. */
  scale = 1;
  /** Jetpack fuel units (see JET), or null without a jetpack. */
  jetFuel = null;
  /** Carrying a glider (canopies open as gliders, as on the server). */
  glider = false;
  /** Seated in a turret or vehicle: the server moves you, so movement isn't predicted. */
  mounted = false;
  /** The seat's gun (set by the session while seated), its heat, and whether the seat can't shoot at all (driving). */
  seatGun = null;
  seatAmmo = [0, 0, 0, 0];
  /** The seat gun's rounds aboard when limited (the Tank's shells, PrivateState.mo[3]); null: it never runs dry. */
  seatShells = null;
  unarmed = false;
  /** Movement multiplier from status effects (server value). */
  statusSpeed = 1;
  /** Your body's own speed, jump and stamina (size class and character stats; server values). */
  bodySpeed = 1;
  jump = 1;
  stamina = 1;
  /** Classes: extra jumps in the air your class has (the Runner's double jump). */
  airJumps = 0;
  /** Ground hazards from the latest snapshot (oil makes movement slick). */
  zones = [];
  /**
   * Moving platforms (map movers): put their colliders where they are at a
   * tick and carry feet standing on them, exactly as the server does.
   */
  platforms = null;
  /** The map's portals, and whether one (entity index) is switched on (replicated scenario state): crossings are predicted like the server's. */
  portals = [];
  portalOn = () => true;
  /** View turn (radians) from portals walked through in live prediction, for the session to add to your yaw (replays never turn it again). */
  portalTurn = 0;
  /** Server tick the latest predicted input will run on (estimate: snapshot tick + inputs not yet acknowledged). */
  predTick = 0;
  /**
   * Gunplay state mirrored exactly from the server (gunplay.ts): the
   * mechanical recoil offset (the camera shows it, and it is where rounds
   * go), spray, sights, and the reload in progress with its stages.
   */
  gun = newGunState();
  reload = null;
  /** Weapons with a magazine in but no round chambered. */
  unchambered = /* @__PURE__ */ new Set();
  /** Rounds fired since drawing the held weapon (tracer intervals). */
  rounds = 0;
  /** Angles sent with the last input (mouse movement is measured from them to counter recoil). */
  lastYaw = 0;
  lastPitch = 0;
  prevButtons = 0;
  /** Match rules the drawn rounds fly by (ballistics). */
  rules = {};
  /** Trigger state mirrored from the server rules (semi-auto latch, spin-up, burst). */
  semiLatch = false;
  windup = 0;
  burstLeft = 0;
  burstTimer = 0;
  /** Carried grenades or mines. */
  throwable = null;
  reloadTicks = 0;
  raiseTicks = 0;
  speedTicks = 0;
  damageTicks = 0;
  collider;
  pending = [];
  seq = 0;
  /** The last input's sequence number: the game's own clock (one a tick), for readouts timed in game time. */
  get inputSeq() {
    return this.seq;
  }
  fireCooldown = 0;
  corrections = 0;
  lastCorrection = 0;
  /** Gravity multiple in force (match rules over the map's), so prediction falls like the server. */
  gravity = 1;
  /** The map's low-gravity zones (see mapGravityZones), applied exactly as the server applies them. */
  gravityZones = [];
  /** Position at the start of the latest predicted tick (drawing blends from it to `state.pos`). */
  prevPos = null;
  /**
   * Where to draw you between ticks: prediction runs at 60 Hz, screens often refresh faster,
   * so without blending the camera and your third-person body step instead of gliding.
   * `alpha` is how far into the next tick (0..1); big jumps (respawns, teleports) snap.
   */
  renderPos(alpha) {
    const p = this.prevPos;
    const c = this.state.pos;
    if (!p || Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z) > 2) return c;
    const k = Math.min(1, Math.max(0, alpha));
    return { x: p.x + (c.x - p.x) * k, y: p.y + (c.y - p.y) * k, z: p.z + (c.z - p.z) * k };
  }
  /** Where your eyes are (they drop when you crouch or go prone). */
  get eye() {
    return { x: this.state.pos.x, y: this.state.pos.y + eyeHeightOf(this.state, this.scale), z: this.state.pos.z };
  }
  get weapon() {
    return weaponByCode(this.held);
  }
  /** Owned weapon codes in slot order (for wheel cycling and number keys). */
  ownedCodes() {
    return WEAPONS_BY_SLOT.map((w) => ORDER.get(w.id)).filter((code) => this.inventory.has(code));
  }
  /** Where the camera and the rounds point: the view plus the mechanical recoil offset. */
  aimAngles(yaw, pitch) {
    return { yaw: yaw + this.gun.ry, pitch: Math.max(-1.55, Math.min(1.55, pitch + this.gun.rp)) };
  }
  /**
   * Where a round fired with this input goes (Match.aimOf): the view plus the recoil; in third person, first
   * turned from the eye onto what the crosshair is on. (The host works that out against the players as you saw
   * them too; this cosmetic copy only against the level.)
   */
  shotAim(input) {
    if (!(input.buttons & BUTTON_THIRD_PERSON) || this.seatGun) return this.aimAngles(input.yaw, input.pitch);
    const a = thirdPersonAim((o, d, max) => this.physics.raycastWorld(o, d, max), this.eye, input.yaw, input.pitch);
    return this.aimAngles(a.yaw, a.pitch);
  }
  /**
   * Predict one tick. Returns the input to send, any predicted shot, and the
   * part of this tick's mouse movement that went into countering recoil
   * (`absorbed`, pitch and yaw): the caller adds it back to its view angles,
   * because that movement brought the recoil down instead of turning the view.
   */
  tick(sample, yaw, pitch, weapon, viewTick) {
    let absorbed = null;
    if (this.alive) {
      const [cp, cy] = counterFrom(this.gun, pitch - this.lastPitch, angleDelta(this.lastYaw, yaw));
      if (cp || cy) {
        counterRecoil(this.gun, cp, cy);
        pitch += cp;
        yaw += cy;
        absorbed = [cp, cy];
      }
    }
    this.lastYaw = yaw;
    this.lastPitch = pitch;
    const input = { seq: ++this.seq, ...sample, yaw, pitch, weapon, viewTick, ...absorbed ? { rc: absorbed } : {} };
    this.prevPos = { ...this.state.pos };
    let shot = null;
    if (this.alive) {
      if (weapon && weapon !== this.held && this.inventory.has(weapon)) {
        this.held = weapon;
        this.raiseTicks = this.weapon?.raiseTicks ?? 0;
        this.reloadTicks = 0;
        this.reload = null;
        this.windup = 0;
        this.burstLeft = 0;
        this.gun.shots = 0;
        this.gun.spray = 0;
        this.gun.ads = 0;
        this.rounds = 0;
      }
      if (!this.mounted) this.state = this.move(this.state, input, this.predTick + 1, true);
      if (this.fireCooldown > 0) this.fireCooldown--;
      if (this.raiseTicks > 0) this.raiseTicks--;
      this.advanceReload();
      shot = this.predictFire(input);
    }
    this.predTick++;
    this.pending.push(input);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    return { input, shot, absorbed };
  }
  /** The held weapon's ammunition as the reload code sees it (written back with `storeBox`). */
  box(code, ammo) {
    return { mag: ammo[0], reserve: ammo[1], unchambered: this.unchambered.has(code), alt: ammo[2] };
  }
  storeBox(code, ammo, b) {
    ammo[0] = b.mag;
    ammo[1] = b.reserve;
    ammo[2] = b.alt ?? ammo[2];
    if (b.unchambered) this.unchambered.add(code);
    else this.unchambered.delete(code);
  }
  /** The server's reload, step for step: ammunition follows the stages. */
  advanceReload() {
    const def = this.weapon;
    const ammo = this.inventory.get(this.held);
    if (!this.reload || this.reloadTicks === 0 || !def || !ammo) {
      this.reload = null;
      this.reloadTicks = 0;
      return;
    }
    const b = this.box(this.held, ammo);
    this.reload = stepReload(def, b, this.reload);
    this.storeBox(this.held, ammo, b);
    this.reloadTicks = this.reload ? Math.max(1, this.reload.total - this.reload.t) : 0;
  }
  startReload() {
    const def = this.weapon;
    const ammo = this.inventory.get(this.held);
    if (this.reloadTicks > 0 || !def || !ammo) return;
    const run = beginReload(def, this.box(this.held, ammo));
    if (!run) return;
    this.reload = run;
    this.reloadTicks = run.total;
    this.burstLeft = 0;
  }
  cancelReload() {
    this.reload = null;
    this.reloadTicks = 0;
  }
  /** Same order as the server: move with the current boost, then count the boost down. */
  move(state, input, tick, live = false) {
    if (this.platforms) {
      this.platforms.poseAt(tick);
      const ridden = this.platforms.carry(state.pos, tick);
      if (ridden) state = { ...state, pos: ridden };
    }
    const jet = this.jetFuel !== null && this.jetFuel >= JET.burn;
    const before = state;
    let next = applyPads(this.pads, stepMovement(this.physics, this.collider, state, input, (this.speedTicks > 0 ? SPEED_BOOST : 1) * this.bodySpeed * this.statusSpeed, TICK_DT, this.traction(state.pos), { liquids: this.liquids, jet, ladders: this.ladders, scale: this.scale, jump: this.jump, stamina: this.stamina, gravity: this.gravity, ...this.gravityZones.length ? { gravityZones: this.gravityZones } : {}, ...this.airJumps ? { airJumps: this.airJumps } : {}, ...this.jetFuel !== null ? { jetpack: true } : {}, ...this.glider ? { glider: true } : {}, ...this.ziplines.length ? { ziplines: this.ziplines, team: this.team() } : {} }));
    const through = this.portals.length && next.zip === void 0 ? applyPortals(this.portals, before, next, this.portalOn, this.scale, bodyHeightOf(next, this.scale)) : null;
    if (through) {
      next = through.state;
      if (live) this.portalTurn += through.turn;
    }
    if (this.jetFuel !== null) this.jetFuel = stepJetFuel(this.jetFuel, !!next.jet);
    if (this.speedTicks > 0) this.speedTicks--;
    return next;
  }
  traction(pos) {
    for (const z of this.zones) {
      if (ZONE_KINDS[z[0]] === "oil" && zoneContains("oil", { x: z[1], y: z[2], z: z[3] }, z[4], pos)) return OIL_TRACTION;
    }
    return 1;
  }
  /**
   * Mirrors the server's trigger rules (semi-auto, burst, spin-up, heat,
   * reload interrupts, recoil and spray) so tracers, the HUD and the camera
   * match what will happen. Same order as Match.applyInputs.
   */
  predictFire(input) {
    const def = this.seatGun ?? this.weapon;
    const ammo = this.seatGun ? this.seatAmmo : this.inventory.get(this.held);
    const fireDown = (input.buttons & BUTTON_FIRE) !== 0;
    const pressed = input.buttons & ~this.prevButtons;
    this.prevButtons = input.buttons;
    if (!fireDown) this.semiLatch = false;
    if (!def || !ammo) return null;
    if (this.reload && (pressed & BUTTON_SPRINT && input.forward > 0 || pressed & BUTTON_USE)) this.cancelReload();
    if (input.buttons & BUTTON_RELOAD) this.startReload();
    const gp = gunplayOf(def);
    stepAds(this.gun, gp.accuracy, !!(input.buttons & BUTTON_ZOOM) && !this.seatGun);
    const ready = (a) => this.seatGun ? a[0] : roundsReady(this.box(this.held, a));
    if (this.reload && !this.seatGun && this.fireCooldown === 0 && this.raiseTicks === 0) {
      const swing = def.kind === "melee" && (fireDown && !this.semiLatch || (pressed & BUTTON_MELEE) !== 0);
      const shoot = fireDown && !this.semiLatch && ready(ammo) > 0 || input.buttons & BUTTON_ALT && !fireDown && def.alt?.reload && ammo[2] >= def.alt.cost;
      if (swing || shoot) this.cancelReload();
    }
    const { shot, fired } = this.trigger(def, ammo, input, fireDown, ready);
    if (!this.seatGun && this.statusSpeed !== 0 && !fired) {
      if (pressed & BUTTON_MELEE && !this.mounted && def.kind !== "melee" && this.reload) this.cancelReload();
      const armed = !this.unarmed && !(this.state.zip !== void 0 && !oneHanded(def));
      const timers = { reloadTicks: this.reloadTicks, fireCooldown: this.fireCooldown, raiseTicks: this.raiseTicks, burstLeft: this.burstLeft };
      if (armed && input.buttons & BUTTON_AUTO_RELOAD && autoReloadDue(def, this.box(this.held, ammo), timers, (input.buttons & BUTTON_SPRINT) !== 0 && input.forward > 0 || (input.buttons & BUTTON_MELEE) !== 0)) this.startReload();
    }
    if (!fired) recoilIdle(this.gun, gp.kick, gp.accuracy, def.fireIntervalTicks);
    return shot;
  }
  /** The trigger itself. `fired`: a primary round (or swing) went off, as the server counts it. */
  trigger(def, ammo, input, fireDown, ready) {
    const none = { shot: null, fired: false };
    if (def.windupTicks) {
      const able = fireDown && this.raiseTicks === 0 && this.reloadTicks === 0 && ammo[3] < 100 && (def.magazine === 0 || ready(ammo) > 0);
      this.windup = able ? Math.min(def.windupTicks, this.windup + 1) : Math.max(0, this.windup - 2);
    }
    if (this.unarmed || this.state.zip !== void 0 && !this.seatGun && !oneHanded(def)) return none;
    if (this.burstLeft > 0) {
      if (--this.burstTimer > 0) return none;
      if (ready(ammo) === 0 || this.reloadTicks > 0 || this.statusSpeed === 0) {
        this.burstLeft = 0;
        return none;
      }
      ammo[0]--;
      this.burstLeft--;
      this.burstTimer = def.burst?.intervalTicks ?? 1;
      return { shot: this.primaryShot(def, input, ammo), fired: true };
    }
    if (this.fireCooldown > 0 || this.raiseTicks > 0 && !this.seatGun || this.reloadTicks > 0 || this.statusSpeed === 0) return none;
    if (fireDown) {
      if (this.semiLatch || def.windupTicks && this.windup < def.windupTicks) return none;
      if (def.magazine > 0 && ready(ammo) === 0) {
        if (!this.seatGun) this.startReload();
        return none;
      }
      if (this.seatGun && this.seatShells !== null) {
        if (this.seatShells <= 0 || def.heat && ammo[3] >= 100) return none;
        this.seatShells--;
      }
      if (def.heat) {
        if (ammo[3] >= 100) return none;
        ammo[3] = Math.min(100, ammo[3] + def.heat.perShot * 100);
      }
      if (def.magazine > 0) ammo[0]--;
      this.fireCooldown = def.fireIntervalTicks;
      this.semiLatch = (def.fireMode ?? "auto") !== "auto";
      if (def.fireMode === "burst" && def.burst) {
        this.burstLeft = def.burst.count - 1;
        this.burstTimer = def.burst.intervalTicks;
      }
      if (def.windupResets) this.windup = 0;
      return { shot: this.primaryShot(def, input, ammo), fired: true };
    }
    if (input.buttons & BUTTON_ALT && def.alt) {
      const a = def.alt;
      if (a.ammo === "own" ? ammo[2] < a.cost : ammo[0] < a.cost) {
        if ((a.ammo === "shared" || a.reload) && !this.seatGun) this.startReload();
        return none;
      }
      if (a.ammo === "own") ammo[2] -= a.cost;
      else ammo[0] -= a.cost;
      this.fireCooldown = a.fireIntervalTicks;
      const aim = this.shotAim(input);
      if (a.kick) recoilShot(this.gun, a.kick);
      if (a.kind !== "hitscan") return { shot: { def, ends: [], alt: true }, fired: false };
      return { shot: this.hitscanShot(def, aim, a.pellets ?? def.pellets, a.spread ?? def.spread, true, a.range), fired: false };
    }
    return none;
  }
  /** A primary round: spread from the gunplay model, then the recoil kick (as the server does in Match.fire). */
  primaryShot(def, input, ammo) {
    const gp = gunplayOf(def);
    const aim = this.shotAim(input);
    const run = this.prevPos ? Math.hypot(this.state.pos.x - this.prevPos.x, this.state.pos.z - this.prevPos.z) / TICK_DT / PLAYER.runSpeed : 0;
    const spread = gp.accuracy ? shotCone(def, gp.accuracy, this.gun, { run, airborne: !this.state.grounded, stance: STANCE_SPREAD[this.state.stance ?? 0] ?? 1 }) : def.spread;
    if (def.kind !== "melee") recoilShot(this.gun, gp.kick);
    if (def.kind !== "hitscan") return { def, ends: [] };
    const shot = this.hitscanShot(def, aim, def.pellets, spread, false);
    if (gp.ballistic) shot.tracer = isTracer(gp.ballistic, this.rounds, ammo[0]);
    this.rounds++;
    return shot;
  }
  hitscanShot(def, aim, pellets, spread, alt, reach = def.range) {
    const eye = this.eye;
    const ends = [];
    const times = [];
    const bal = alt ? null : gunplayOf(def).ballistic;
    const phys = bal ? bulletPhysics(bal, this.rules) : null;
    for (let i = 0; i < pellets; i++) {
      const yaw = aim.yaw + (Math.random() - 0.5) * 2 * spread;
      const pitch = aim.pitch + (Math.random() - 0.5) * 2 * spread;
      const dir = viewDirection(yaw, pitch);
      if (phys) {
        const t = traceBullet(eye, dir, phys, def.range, (o, d2, len) => this.physics.raycastHit(o, d2, len)?.dist ?? null);
        ends.push(t.end);
        times.push(t.time);
        continue;
      }
      const d = this.physics.raycastHit(eye, dir, reach)?.dist ?? reach;
      ends.push({ x: eye.x + dir.x * d, y: eye.y + dir.y * d, z: eye.z + dir.z * d });
    }
    return { def, ends, ...alt ? { alt } : {}, ...phys ? { speed: phys.speed, times } : {} };
  }
  /** Server reconciliation. */
  reconcile(server, ack, me, serverTick) {
    const wasAlive = this.alive;
    this.alive = server.alive === 1;
    this.health = server.hp;
    this.armor = server.ar;
    this.pending = this.pending.filter((i) => i.seq > ack);
    if (me) {
      this.inventory = new Map(me.inv.map(([code, mag, reserve, alt, heat]) => [code, [mag, reserve, alt ?? 0, heat ?? 0]]));
      this.statusSpeed = (me.ms ?? 1e3) / 1e3;
      [this.bodySpeed, this.jump, this.stamina] = (me.bs ?? [1e3, 1e3, 1e3]).map((v) => v / 1e3);
      this.mounted = !!me.mo;
      this.seatAmmo = [0, 0, 0, me.mo?.[2] ?? 0];
      this.seatShells = me.mo?.[3] ?? null;
      this.throwable = me.gr ? { kind: THROWABLES[me.gr[0]] ?? "frag", count: me.gr[1] } : null;
      this.speedTicks = me.sp;
      this.damageTicks = me.dm;
      this.jetFuel = me.jp ?? null;
      this.airJumps = me.cl ? CLASS_DEFS[CLASS_IDS[me.cl[0]] ?? "rocketeer"].airJumps ?? 0 : 0;
      this.glider = me.gl === 1;
      this.reloadTicks = Math.max(0, me.rl - this.pending.length);
      this.raiseTicks = Math.max(0, me.rs - this.pending.length);
      this.unchambered = new Set(me.uc ?? []);
      this.reload = me.rd && this.reloadTicks > 0 ? { kind: RELOAD_KINDS[me.rd[0]] ?? "tactical", t: me.rd[1] + this.pending.length, total: me.rd[2], stage: me.rd[3] } : null;
    }
    if (!wasAlive && this.alive) {
      this.gun = newGunState();
      this.rounds = 0;
    }
    const pendingSwitch = [...this.pending].reverse().find((i) => i.weapon && this.inventory.has(i.weapon))?.weapon;
    this.held = pendingSwitch ?? server.w;
    const before = this.state.pos;
    const sta = me?.sta;
    this.state = {
      pos: { x: server.p[0], y: server.p[1], z: server.p[2] },
      velY: server.vy,
      grounded: server.g === 1,
      ...server.vx || server.vz ? { vx: server.vx ?? 0, vz: server.vz ?? 0 } : {},
      ...server.sn ? { stance: server.sn } : {},
      ...server.ch ? { chute: server.ch } : {},
      ...server.dr ? { drop: true } : {},
      ...server.zl ? { zip: server.zl[0], zs: server.zl[1], zv: server.zl[2] } : {},
      ...sta ? { ...sta[0] < 1e3 ? { stamina: sta[0] / 1e3 } : {}, ...sta[1] ? { rest: sta[1] } : {}, ...sta[2] ? { winded: true } : {} } : {},
      // Double jumps already used and whether jump was held, so a replay doesn't jump again.
      ...me?.cl && me.cl[4] & 3 ? { airJumps: me.cl[4] & 3 } : {},
      ...me?.cl && me.cl[4] & 4 ? { jumpHeld: true } : {}
    };
    let t = serverTick ?? this.predTick - this.pending.length;
    if (this.alive && !this.mounted) {
      for (const input of this.pending) this.state = this.move(this.state, input, ++t);
    } else t += this.pending.length;
    this.predTick = t;
    const err = distance(before, this.state.pos);
    if (wasAlive && this.alive && err > 0.01) {
      this.corrections++;
      this.lastCorrection = err;
    }
  }
  get pendingCount() {
    return this.pending.length;
  }
}
const STRIDE = 2.3;
const MULTI_KILL_WINDOW = 4;
const MAX_IMPACTS_PER_SHOT = 2;
const fireSound = (weaponId) => CORE_WEAPONS[weaponId]?.view.sound ?? `fire.${weaponId.replace(/^core\./, "")}`;
const ENGINE_REPEAT_MS = 600;
const ENGINE_OTHERS = 2;
const ENGINE_REACH = 60;
const tuple = (p) => ({ x: p[0], y: p[1], z: p[2] });
const ARC_SOUND_MS = 300;
class SessionAudio {
  constructor(audio, localSlot) {
    this.audio = audio;
    this.localSlot = localSlot;
  }
  audio;
  localSlot;
  pickupAt = /* @__PURE__ */ new Map();
  entities = [];
  doc = null;
  strides = /* @__PURE__ */ new Map();
  localStride = 0;
  wasGrounded = true;
  fallSpeed = 0;
  prevReload = 0;
  prevHeld = 0;
  dryFireAt = 0;
  recentKills = [];
  fences = [];
  humAt = 0;
  /** Force fields (block index and the run of its long side) and when one last hummed. */
  fields = [];
  fieldHumAt = 0;
  /** When each arc sentry (mount index) last crackled: its arc hits ten times a second, heard every ARC_SOUND_MS. */
  arcSoundAt = /* @__PURE__ */ new Map();
  /** Whether a block (entity index) is up: force fields only hum while they stand. */
  blockPresent = () => true;
  /** Your team in team modes (null otherwise), for objective and round announcements. */
  myTeam = () => null;
  /**
   * The sound of a round from `from` landing at `to` in the level: its surface type's sound family (game/fxMap.ts
   * impactSoundId; the session asks the view what it struck). Default: the one generic impact.
   */
  worldImpact = () => "impact.world";
  /** Whether blood is shown (the map's setting and the player's): the wet splat on a kill goes with it. */
  bloodOn = () => true;
  /** An arc sentry starting its wind-up on someone: the warning (break its line of sight). */
  sentryCharge(at) {
    this.audio.play("trap.warn", { at });
  }
  setMap(doc) {
    this.entities = doc.entities;
    this.doc = doc;
    this.fences = Object.values(borderStyles(doc)).includes("fence") ? borderShockLines(doc, 0) : [];
    for (const e of doc.entities) {
      if (e.kind !== "trap" || e.trap !== "shock" || e.activation !== "always" || !e.startEnabled) continue;
      const run = fenceRun(e);
      this.fences.push({ a: run.a, b: run.b, y0: e.position[1], height: ELECTRIC_FENCE.height, push: null, entity: null });
    }
    for (const e of doc.entities) if (e.kind === "pickup") this.pickupAt.set(e.id, tuple(e.position));
    this.fields = [];
    doc.entities.forEach((e, i) => {
      if (e.kind !== "block" || !e.field) return;
      const [w, h, d] = e.size;
      const along = w >= d ? w / 2 : d / 2;
      const [ax, az] = w >= d ? [Math.cos(e.yaw), -Math.sin(e.yaw)] : [Math.sin(e.yaw), Math.cos(e.yaw)];
      const [x, , z] = e.position;
      this.fields.push({ i, line: { a: [x - ax * along, z - az * along], b: [x + ax * along, z + az * along], y0: e.position[1], height: h, push: null, entity: null } });
    });
  }
  /** Someone or something going into water (the view's splash effects call this). */
  splash(at) {
    this.audio.play("water.splash", { at });
  }
  joined() {
  }
  /** One tick of the start countdown, or the "Go!" when it ends. */
  countdownBeep(go) {
    this.audio.play(go ? "announce.fight" : "message");
  }
  /** A shot the local player just fired (predicted). */
  localShot(def, alt = false) {
    const own = alt ? def.view.altShot : void 0;
    if (own) this.audio.play(own.sound, { rate: own.rate ?? 1, gain: 1.15 });
    else this.audio.play(alt && def.alt?.kind === "projectile" && def.alt.ammo === "own" ? "fire.launcher" : fireSound(def.id));
  }
  /** Your own punch or kick: a swish as you throw it. */
  localStrike() {
    this.audio.play("fire.knife", { gain: 0.6 });
  }
  /** The fire button is down with an empty magazine. */
  dryFire(now) {
    if (now - this.dryFireAt < 300) return;
    this.dryFireAt = now;
    this.audio.play("dryfire");
  }
  /** Per-tick local movement: footsteps and landings (none while `mounted`: riding in a seat). */
  localStep(local, before, speedScale, mounted = false) {
    const s = local.state;
    if (!local.alive || mounted) {
      this.wasGrounded = true;
      this.fallSpeed = 0;
      this.localStride = 0;
      return;
    }
    if (s.zip !== void 0) {
      this.whirr(-1, void 0, Math.abs(s.zv ?? 0));
      this.fallSpeed = 0;
      this.prevReload = local.reloadTicks;
      return;
    }
    if (s.grounded) {
      if (!this.wasGrounded && this.fallSpeed > 5) this.audio.play("land", { gain: Math.min(1.4, this.fallSpeed / 9) });
      this.localStride += Math.hypot(s.pos.x - before.x, s.pos.z - before.z);
      if (this.localStride > STRIDE * speedScale) {
        this.localStride = 0;
        this.audio.play("footstep", { gain: 0.7 });
      }
    } else {
      this.fallSpeed = -s.velY;
    }
    this.wasGrounded = s.grounded;
    this.fenceHum(s.pos);
    this.fieldHum(s.pos);
  }
  /** The low hum of a standing force field nearby (and only while it is up). */
  fieldHum(pos) {
    if (!this.fields.length) return;
    const now = performance.now();
    if (now - this.fieldHumAt < 1700) return;
    let best = null;
    for (const f of this.fields) {
      if (!this.blockPresent(f.i) || pos.y < f.line.y0 - 3 || pos.y > f.line.y0 + f.line.height + 2) continue;
      const n = shockLineNearest(f.line, pos.x, pos.z);
      if (!best || n.dist < best.dist) best = n;
    }
    if (!best || best.dist > 12) return;
    this.fieldHumAt = now;
    this.audio.play("fence.hum", { at: { x: best.x, y: pos.y + 1.2, z: best.z }, gain: 0.55 });
  }
  /** The hum of a live electric fence nearby, from its nearest point (each buzz is 2 s; they overlap). */
  fenceHum(pos) {
    if (!this.fences.length) return;
    const now = performance.now();
    if (now - this.humAt < 1700) return;
    let best = null;
    for (const l of this.fences) {
      const n = shockLineNearest(l, pos.x, pos.z);
      if (!best || n.dist < best.dist) best = n;
    }
    if (!best || best.dist > 16) return;
    this.humAt = now;
    this.audio.play("fence.hum", { at: { x: best.x, y: pos.y + 1.6, z: best.z } });
  }
  /** Per-frame local weapon state: reload and weapon-raise cues. */
  localWeapon(local) {
    if (local.alive) {
      if (local.held !== this.prevHeld && this.prevHeld !== 0) this.audio.play("weapon.raise");
      if (local.reloadTicks > 0 && this.prevReload === 0) this.audio.play("reload.start");
      if (local.reloadTicks === 0 && this.prevReload > 0 && local.held === this.prevHeld) this.audio.play("reload.end");
    }
    this.prevHeld = local.alive ? local.held : 0;
    this.prevReload = local.alive ? local.reloadTicks : 0;
  }
  /** When each rider's (slot; -1 you) zipline whirr last started. */
  whirrAt = /* @__PURE__ */ new Map();
  /** A zipline trolley running: the whirr again every ~0.6 s (each one overlaps the last), pitched by speed. */
  whirr(slot, at, speed) {
    const now = performance.now();
    if (now - (this.whirrAt.get(slot) ?? 0) < 600) return;
    this.whirrAt.set(slot, now);
    if (this.whirrAt.size > 64) this.whirrAt.clear();
    this.audio.play("zip.whirr", { ...at ? { at } : {}, rate: 0.75 + Math.min(1, speed / 20) * 0.6, gain: 0.5 + Math.min(1, speed / 15) * 0.6 });
  }
  /** When each vehicle's (mount index) engine copy last started. */
  engineAt = /* @__PURE__ */ new Map();
  /**
   * Vehicle engines, every frame: each living vehicle anyone rides runs its engine (`vehicle.engine`, a 1.2 s copy
   * every 0.6 s, overlapping into a drone), pitched by its speed. `mine` (the vehicle you ride, or null) is heard
   * unpositioned; the nearest ENGINE_OTHERS others from where they are (`ear`: the camera).
   */
  engines(mounts, mine, ear) {
    const now = performance.now();
    const running = [];
    for (const m of mounts) {
      if (!m.alive || m.def.kind !== "vehicle" || !m.seats.some((s) => s >= 0)) continue;
      const d = m.index === mine ? -1 : Math.hypot(m.shown.pos.x - ear.x, m.shown.pos.y - ear.y, m.shown.pos.z - ear.z);
      if (d <= ENGINE_REACH) running.push({ m, d });
    }
    running.sort((a, b) => a.d - b.d);
    const heard = /* @__PURE__ */ new Set();
    for (const { m, d } of running.slice(0, mine === null ? ENGINE_OTHERS : ENGINE_OTHERS + 1)) {
      heard.add(m.index);
      const last = this.engineAt.get(m.index);
      if (last !== void 0 && now - last < ENGINE_REPEAT_MS) continue;
      this.engineAt.set(m.index, now);
      const speed = Math.hypot(m.vel.x, m.vel.z);
      const v = m.def.vehicle;
      const base = v?.fly ? 1.3 : v?.hover ? 1.15 : m.def.turret ? 0.7 : 1;
      const pace = Math.min(1, speed / (v?.maxSpeed || 25));
      const rate = base * (0.8 + pace * 0.6);
      const gain = 0.6 + pace * 0.5;
      if (d < 0) this.audio.play("vehicle.engine", { rate, gain: gain * 0.8 });
      else this.audio.play("vehicle.engine", { at: { x: m.shown.pos.x, y: m.shown.pos.y + 0.6, z: m.shown.pos.z }, rate, gain });
    }
    for (const i of this.engineAt.keys()) if (!heard.has(i)) this.engineAt.delete(i);
  }
  /** Per-frame remote movement: footsteps from interpolated poses (none for `riding`: slots in a seat). */
  remoteSteps(poses, riding = /* @__PURE__ */ new Set()) {
    const me = this.localSlot();
    for (const p of poses) {
      if (p.slot === me) continue;
      if (p.alive && p.zip !== void 0) this.whirr(p.slot, { x: p.x, y: p.y + 2, z: p.z }, p.zipSpeed ?? 0);
      const prev = this.strides.get(p.slot);
      if (!p.alive || !prev || riding.has(p.slot)) {
        this.strides.set(p.slot, { x: p.x, z: p.z, acc: 0 });
        continue;
      }
      const d = Math.hypot(p.x - prev.x, p.z - prev.z);
      prev.acc = d > 3 ? 0 : prev.acc + d;
      prev.x = p.x;
      prev.z = p.z;
      if (prev.acc > STRIDE) {
        prev.acc = 0;
        this.audio.play("footstep", { at: { x: p.x, y: p.y, z: p.z } });
      }
    }
  }
  /** Server events. `poses` gives remote positions for events that carry none. */
  /** Your hit, by sound (GUNPLAY_SPEC §21): a bright ding for the head, a dull clank for armor, the tick for flesh. */
  hitSound(hits, zones, armor) {
    if (!hits.some((h) => h !== null && h !== void 0)) return;
    const head = zones?.some((z, i) => z === 1 && hits[i] !== null && hits[i] !== void 0) ?? false;
    this.audio.play(head ? "ui.hit.head" : armor ? "ui.hit.armor" : "ui.hit");
  }
  event(ev, poses, now) {
    const me = this.localSlot();
    const poseOf = (slot) => {
      const p = poses().find((q) => q.slot === slot);
      return p && { x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z };
    };
    switch (ev.e) {
      case "shot": {
        const mine = ev.s === me;
        const altLaunch = ev.alt && getWeapon(ev.w).alt?.kind === "projectile" && getWeapon(ev.w).alt?.ammo === "own";
        const own = ev.alt ? getWeapon(ev.w).view.altShot : void 0;
        if (!mine && own) this.audio.play(own.sound, { at: tuple(ev.from), rate: own.rate ?? 1, gain: 1.15 });
        else if (!mine) this.audio.play(altLaunch ? "fire.launcher" : fireSound(ev.w), { at: tuple(ev.from) });
        let impacts = 0;
        const def = getWeapon(ev.w);
        const perVictim = /* @__PURE__ */ new Map();
        ev.to.forEach((to, i) => {
          if (ev.fl?.includes(i)) return;
          const hit = ev.hit[i];
          if (hit !== null && hit !== void 0) {
            const v = perVictim.get(hit);
            perVictim.set(hit, { at: v?.at ?? to, pellets: (v?.pellets ?? 0) + 1, head: (v?.head ?? false) || ev.z?.[i] === 1 });
            return;
          }
          if (impacts >= MAX_IMPACTS_PER_SHOT) return;
          impacts++;
          const sound = this.worldImpact(tuple(ev.from), tuple(to));
          if (sound) this.audio.play(sound, { at: tuple(to) });
        });
        for (const [victim, v] of perVictim) {
          const heavy = v.head || ((ev.alt ? def.alt?.damage : void 0) ?? def.damage) * v.pellets >= 45;
          const at = victim === me ? void 0 : tuple(v.at);
          this.audio.play(heavy ? "impact.heavy" : "impact.body", { at, gain: victim === me ? 0.6 : 1 });
          this.audio.play("impact.thud", { at, gain: 0.8 });
        }
        if (mine) this.hitSound(ev.hit, ev.z, !!ev.ar);
        break;
      }
      case "impact": {
        if (ev.gone) break;
        const def = getWeapon(ev.w);
        if (ev.hit !== null) {
          const head = ev.z === 1;
          const at = ev.hit === me ? void 0 : tuple(ev.to);
          this.audio.play(head || def.damage >= 45 ? "impact.heavy" : "impact.body", { at, gain: ev.hit === me ? 0.6 : 1 });
          this.audio.play("impact.thud", { at, gain: 0.8 });
        } else {
          const sound = this.worldImpact(tuple(ev.from), tuple(ev.to));
          if (sound) this.audio.play(sound, { at: tuple(ev.to) });
        }
        if (ev.s === me) this.hitSound([ev.hit], ev.z !== void 0 ? [ev.z] : void 0, !!ev.ar);
        break;
      }
      case "melee": {
        if (ev.u) {
          const at = poseOf(ev.s);
          const hitAt = ev.hit !== null && ev.hit !== me ? poseOf(ev.hit) : void 0;
          if (ev.s !== me && at) this.audio.play("fire.knife", { at, gain: 0.6 });
          if (ev.hit !== null) {
            this.audio.play("impact.body", hitAt ? { at: hitAt, gain: 0.9 } : { gain: 0.6 });
            this.audio.play("impact.thud", hitAt ? { at: hitAt } : {});
            if (ev.s === me) this.audio.play("ui.hit");
          }
          break;
        }
        if (ev.s !== me) {
          const at = poseOf(ev.s);
          if (at) this.audio.play("fire.knife", { at });
          if (at && ev.hit !== null) this.audio.play("knife.hit", { at });
        } else if (ev.hit !== null) {
          this.audio.play("knife.hit");
          this.audio.play("ui.hit");
        }
        break;
      }
      case "knock": {
        const at = ev.t === me ? void 0 : poseOf(ev.t);
        this.audio.play("impact.thud", at ? { at } : {});
        if (ev.s === me) this.audio.play("ui.hit");
        break;
      }
      case "explode": {
        const at = tuple(ev.p);
        if (ev.m !== void 0) this.audio.play("explosion.vehicle", { at });
        this.audio.play("explosion", { at });
        this.audio.play("explosion.debris", { at });
        if (ev.m !== void 0) this.audio.play("vehicle.crash", { at, gain: 0.7 });
        break;
      }
      case "crash": {
        this.audio.play("vehicle.crash", { at: tuple(ev.p), gain: 0.4 + ev.n * 0.8 });
        break;
      }
      case "resupply": {
        if (!ev.ok) break;
        if (ev.s === me) this.audio.play("pickup.ammo");
        else {
          const at = poseOf(ev.s);
          if (at) this.audio.play("pickup.ammo", { at, gain: 0.7 });
        }
        break;
      }
      case "pickup": {
        const kind = getItem(ev.item)?.effect.kind ?? "ammo";
        const id = `pickup.${kind}`;
        if (ev.s === me) this.audio.play(id);
        else {
          const at = this.pickupAt.get(ev.id) ?? poseOf(ev.s);
          if (at) this.audio.play(id, { at, gain: 0.7 });
        }
        break;
      }
      case "kill": {
        const at = ev.victim === me ? void 0 : poseOf(ev.victim);
        if (ev.victim === me) this.audio.play("death");
        else if (at) this.audio.play("death", { at });
        if (at && this.bloodOn()) this.audio.play("blood.splat", { at });
        if (ev.killer === me && ev.victim !== me && !ev.tk) {
          const t = now / 1e3;
          this.recentKills = [...this.recentKills.filter((k) => t - k < MULTI_KILL_WINDOW), t];
          const step = Math.min(4, this.recentKills.length) - 1;
          this.audio.play("ui.kill.confirm", { rate: 1 + step * 0.12 });
          this.audio.play("ui.kill", { rate: 1 + step * 0.122, gain: 0.8 });
          if (this.recentKills.length === 2) this.audio.play("announce.multikill");
        }
        break;
      }
      case "round_end":
        if (ev.team !== void 0) this.audio.play(ev.team === null ? "announce.tie" : ev.team === this.myTeam() ? "announce.win" : "announce.lose");
        else this.audio.play(ev.winner === null ? "announce.tie" : ev.winner === me ? "announce.win" : "announce.lose");
        break;
      // Objective modes: existing cues, chosen by whether it is good or bad news for your team.
      case "flag": {
        const ours = ev.team === this.myTeam();
        if (ev.a === "take") this.audio.play(ours ? "cue.alarm" : ev.s === me ? "pickup.powerup" : "objective.new");
        else if (ev.a === "drop") this.audio.play("message");
        else if (ev.a === "return") this.audio.play("cue.chime");
        else this.audio.play(ours ? "cue.buzzer" : "objective.complete");
        break;
      }
      case "hill":
        if (ev.a === "move") this.audio.play("objective.new");
        else if (ev.team !== null) this.audio.play(ev.team === this.myTeam() ? "cue.chime" : "cue.buzzer", { gain: 0.6 });
        break;
      case "hostage":
        if (ev.a === "rescue") this.audio.play("objective.complete");
        else if (ev.a === "follow" && ev.s === me) this.audio.play("cue.chime");
        break;
      case "bomb":
        if (ev.a === "plant") this.audio.play("cue.alarm");
        else if (ev.a === "defuse") this.audio.play("objective.complete");
        else if (ev.a === "pickup" && ev.s === me) this.audio.play("pickup.powerup");
        else if (ev.a === "drop") this.audio.play("message");
        break;
      // Breakthrough (`team`: the attackers, but on a round's end the winners): good or bad news for your side.
      case "bt": {
        const ours = ev.team === this.myTeam();
        if (ev.a === "plant") this.audio.play("cue.alarm");
        else if (ev.a === "capture" || ev.a === "destroy" || ev.a === "defuse") this.audio.play(ours === (ev.a !== "defuse") ? "objective.complete" : "cue.buzzer");
        else if (ev.a === "sector") this.audio.play(ours ? "objective.new" : "cue.alarm");
        else if (ev.a === "round") this.audio.play(ours ? "announce.win" : "announce.lose");
        else if (ev.a === "start") this.audio.play("announce.fight");
        else if (ev.a === "pool" && ours) this.audio.play("cue.alarm");
        break;
      }
      case "elim":
        if (ev.a === "start") this.audio.play("announce.fight");
        else this.audio.play(ev.team === null ? "announce.tie" : ev.team === this.myTeam() ? "announce.win" : "announce.lose");
        break;
      case "round_start":
        this.recentKills = [];
        this.audio.play("announce.fight");
        break;
      case "door":
        this.audio.play(ev.open ? "door.open" : "door.close", { at: this.entityAt(ev.i, 1.5) });
        break;
      case "use":
        if (ev.s === me) this.audio.play(ev.ok ? "button.press" : "use.denied");
        else if (ev.ok) this.audio.play("button.press", { at: this.entityAt(ev.i, 1.2) });
        break;
      case "arc":
        if (ev.m !== void 0 && ev.pts[0]) {
          const now2 = performance.now();
          if (now2 - (this.arcSoundAt.get(ev.m) ?? -Infinity) >= ARC_SOUND_MS) {
            this.arcSoundAt.set(ev.m, now2);
            this.audio.play("fire.arc", { at: tuple(ev.pts[0]), gain: 0.8 });
          }
        } else if (ev.s === -1 && ev.pts[0]) this.audio.play("trap.shock", { at: tuple(ev.pts[0]) });
        break;
      case "trap": {
        const e = this.entities[ev.i];
        if (e?.kind !== "trap") break;
        const at = this.entityAt(ev.i, 0.5);
        if (ev.warn) this.audio.play("trap.warn", { at });
        else if (e.trap !== "mine") this.audio.play(`trap.${e.trap}`, { at });
        break;
      }
      case "crack": {
        const pane = this.doc && glassAt(this.doc, ev.i);
        if (pane) this.audio.play("glass.crack", { at: pane.box.center });
        break;
      }
      case "broken": {
        const e = this.entities[ev.i];
        const pane = this.doc && glassAt(this.doc, ev.i);
        if (pane) {
          this.audio.play("break.glass", { at: pane.box.center });
          break;
        }
        if (e?.kind === "block" && e.field) {
          this.audio.play("trap.shock", { at: this.entityAt(ev.i, e.size[1] / 2), gain: 0.6 });
          break;
        }
        if (e?.kind === "prop") {
          if (!getProp(e.model)?.breakable?.blast) this.audio.play(getProp(e.model)?.breakable ? "break.crate" : propBreakLook(e.model).sound, { at: this.entityAt(ev.i, 0.6) });
          break;
        }
        if (e?.kind !== "destructible" || e.model === "barrel" || e.model === "gas" || e.model === "generator") break;
        this.audio.play(e.model === "wall" ? "break.wall" : e.model === "glass" ? "break.glass" : "break.crate", { at: this.entityAt(ev.i, e.model === "glass" ? 1.7 : 0.6) });
        if (e.model === "wall") this.audio.play("explosion.debris", { at: this.entityAt(ev.i, 1) });
        break;
      }
      case "throw": {
        const at = ev.s === me ? void 0 : poseOf(ev.s);
        if (ev.s === me) this.audio.play("throw");
        else if (at) this.audio.play("throw", { at });
        break;
      }
      case "cue":
        this.audio.play(ev.cue === "boom" ? "explosion" : `cue.${ev.cue}`);
        break;
      case "obj":
        this.audio.play(ev.st === 2 ? "objective.complete" : ev.st === 3 ? "cue.buzzer" : "objective.new");
        break;
      case "msg":
        this.audio.play("message");
        break;
    }
  }
  entityAt(i, lift) {
    const e = this.entities[i];
    return e && { x: e.position[0], y: e.position[1] + lift, z: e.position[2] };
  }
}
const REPEAT_MS = 1200;
class WeatherAudio {
  constructor(audio) {
    this.audio = audio;
  }
  audio;
  rainAt = -Infinity;
  windAt = -Infinity;
  /** Copies started (tests). */
  started = { rain: 0, wind: 0 };
  /** How loud each bed plays for a weather, 0-1 (`shelter`: 0 in the open, 1 under a roof). */
  static levels(w, shelter) {
    const rain = w.fall === "rain" ? w.amount * (1 - shelter * 0.6) : 0;
    const wind = Math.min(1, w.wind + (w.fall === "snow" ? w.amount * 0.25 : 0)) * (1 - shelter * 0.5);
    return { rain, wind };
  }
  /** Every frame in play (`now`: performance.now()). */
  update(w, shelter, now) {
    const { rain, wind } = WeatherAudio.levels(w, shelter);
    if (rain > 0.02 && now - this.rainAt >= REPEAT_MS) {
      this.rainAt = now;
      this.started.rain++;
      this.audio.play("weather.rain", { gain: 0.35 + rain * 0.9 });
    }
    if (wind > 0.02 && now - this.windAt >= REPEAT_MS) {
      this.windAt = now;
      this.started.wind++;
      this.audio.play("weather.wind", { gain: 0.25 + wind * 0.9, rate: 0.9 + wind * 0.2 });
    }
  }
}
class ScenarioState {
  constructor(map, physics) {
    this.map = map;
    this.bodies = new ScenarioBodies(physics, map);
    this.movers = new Movers(map);
    this.objectives = map.logic.objectives.map((o) => o.startActive ? 1 : 0);
  }
  map;
  entities = /* @__PURE__ */ new Map();
  objectives = [];
  /** Visible timers as [timer index, seconds left, local time the value arrived]. */
  timers = [];
  /** Movers (lifts, drawbridges): legs from the server; poses are worked out for any tick. */
  movers;
  bodies;
  posedTick = NaN;
  apply(sc, now = performance.now()) {
    if (!sc) return;
    for (const [i, a, b] of sc.es ?? []) {
      this.entities.set(i, [a, b]);
      const kind = this.map.entities[i]?.kind;
      if (kind === "door") this.bodies.setDoorOpen(i, a / 100);
      else if (kind === "destructible" || kind === "prop" || kind === "block" || i >= this.map.entities.length) this.bodies.setSolid(i, a > 0);
      else if (kind === "mover") {
        this.movers.decode(i, a, b);
        this.posedTick = NaN;
      }
    }
    if (sc.es?.length) this.bodies.commit();
    if (sc.ob) this.objectives = sc.ob;
    if (sc.tm) this.timers = sc.tm.map(([k, secs]) => [k, secs, now]);
  }
  /** Whether a portal (entity index) is switched on (its start state until the server says otherwise). */
  portalOn = (i) => {
    const s = this.entities.get(i);
    if (s) return s[0] > 0;
    const e = this.map.entities[i];
    return e?.kind === "portal" ? e.startEnabled : false;
  };
  /** Whether a block (entity index) is there: dropped and hidden blocks carry nobody. */
  present = (i) => {
    const s = this.entities.get(i);
    if (s) return s[0] > 0;
    const e = this.map.entities[i];
    return !(e?.kind === "block" && e.startHidden);
  };
  /** Put moving platforms' colliders where they are at `tick` (prediction runs this before each move). */
  poseAt(tick) {
    if (!this.movers.defs.length || tick === this.posedTick) return;
    this.posedTick = tick;
    for (const t of this.movers.transforms(tick)) this.bodies.setTransform(t.block.i, t.center, t.rot);
    this.bodies.commit();
  }
  /** Where feet standing on a moving platform are carried from `tick - 1` to `tick` (null: not riding). */
  carry(feet, tick) {
    if (!this.movers.defs.length) return null;
    return this.movers.carry(feet, tick, this.present);
  }
  /** Seconds left on a visible timer, counted down locally between updates. */
  timerLeft(entry, now = performance.now()) {
    return Math.max(0, entry[1] - Math.floor((now - entry[2]) / 1e3));
  }
  state(i) {
    return this.entities.get(i);
  }
  /** Locked doors and manual doors can be used; buttons when enabled; team-only ones by their team. Mirrors Scenario.usable. */
  usable(i, team = null) {
    const e = this.map.entities[i];
    if ((e?.kind === "door" || e?.kind === "button") && !teamAllows(e.team, team)) return false;
    if (e?.kind === "door") return !e.auto || (this.entities.get(i)?.[1] ?? (e.locked ? 1 : 0)) === 1;
    return e?.kind === "button";
  }
}
const KILL_CAM_SECONDS = 3.5;
const KILL_CAM_FRAME_MS = 250;
const KILL_CAM_TURN = 0.45;
const FREE_CAM_SPEED = 9;
const FREE_CAM_FAST = 24;
function spectateRule(o) {
  const open = !o.teamMode || o.pureSpectator || o.offline || o.runsMatch;
  return { teamOnly: !open, freeCam: open };
}
const lerpAngle = (a, b, t) => a + angleDelta(a, b) * t;
function freeCamBounds(map) {
  const b = map.bounds ?? fitBounds(map, 12);
  if (!b) return null;
  let low = Infinity;
  let high = -Infinity;
  for (const e of map.entities) {
    low = Math.min(low, e.position[1]);
    high = Math.max(high, e.position[1]);
  }
  if (!Number.isFinite(low)) low = high = 0;
  return { min: { x: b.min[0], y: low - 10, z: b.min[1] }, max: { x: b.max[0], y: high + 60, z: b.max[1] } };
}
class SpectatorCam {
  kill = null;
  /** How the last kill cam ended: skipped (a key), over (its time ran out), or null (in progress, reset or none yet). */
  killCamEnd = null;
  /** The slot followed (-1: none yet). */
  following = -1;
  /** Flying the free camera. */
  free = false;
  /** The free camera's position (set from the view when it starts). */
  freePos = null;
  /** You died to `killer` (a player or NPC, not yourself): the kill cam starts. */
  startKillCam(o) {
    this.kill = { killer: o.killer, weapon: o.weapon, length: (o.seconds ?? KILL_CAM_SECONDS) * 1e3, shown: 0, drawnAt: null, body: { ...o.body }, from: o.from, yaw: o.yaw, pitch: o.pitch, lastSeen: null };
    this.killCamEnd = null;
    this.following = -1;
  }
  /** The kill cam in progress (null when it isn't), for the banner. `left`: seconds of it still to draw. */
  killCam() {
    const k = this.kill;
    if (!k) return null;
    if (k.shown >= k.length) {
      this.kill = null;
      this.killCamEnd = "over";
      return null;
    }
    return { killer: k.killer, weapon: k.weapon, left: (k.length - k.shown) / 1e3 };
  }
  /** Skip the kill cam (a spectator key). */
  endKillCam() {
    if (this.kill) this.killCamEnd = "skipped";
    this.kill = null;
  }
  /** Back in play: everything resets for the next time. */
  reset() {
    this.kill = null;
    this.killCamEnd = null;
    this.free = false;
    this.freePos = null;
  }
  /**
   * The kill cam's view this frame: from behind and above your body, turning (over KILL_CAM_TURN) from where
   * you looked to the killer (`target`: their chest as drawn), or to where the shot came from when they
   * aren't in view. Called once a frame it's drawn: that's what runs its time.
   */
  killCamPose(now, target, cast) {
    const k = this.kill;
    if (!k) return null;
    if (k.drawnAt !== null) k.shown += Math.min(KILL_CAM_FRAME_MS, Math.max(0, now - k.drawnAt));
    k.drawnAt = now;
    if (target) k.lastSeen = { ...target };
    const look = target ?? k.lastSeen ?? k.from;
    const head = { x: k.body.x, y: k.body.y + 1.6, z: k.body.z };
    if (!look) return { pos: head, yaw: k.yaw, pitch: k.pitch };
    const dx = look.x - head.x;
    const dz = look.z - head.z;
    const flat = Math.hypot(dx, dz) || 1;
    const off = { x: -dx / flat * 2.6, y: 1.4, z: -dz / flat * 2.6 };
    const len = Math.hypot(off.x, off.y, off.z);
    const dir = { x: off.x / len, y: off.y / len, z: off.z / len };
    const hit = cast(head, dir, len);
    const d = hit === null ? len : Math.max(0.3, hit - 0.25);
    const pos = { x: head.x + dir.x * d, y: head.y + dir.y * d, z: head.z + dir.z * d };
    const aim = lookAngles(pos, look);
    const t = Math.min(1, k.shown / 1e3 / KILL_CAM_TURN);
    const e = 1 - (1 - t) * (1 - t);
    return { pos, yaw: lerpAngle(k.yaw, aim.yaw, e), pitch: k.pitch + (aim.pitch - k.pitch) * e };
  }
  /** Whom to follow among `candidates` (in slot order): the one followed now if still there, else the first. */
  target(candidates) {
    if (!candidates.length) return null;
    const now = candidates.find((c) => c.slot === this.following);
    if (now) return now;
    this.following = candidates[0].slot;
    return candidates[0];
  }
  /** Next (+1) or previous (-1) player to follow. */
  cycle(step, candidates) {
    if (!candidates.length || !step) return;
    const i = candidates.findIndex((c) => c.slot === this.following);
    const n = candidates.length;
    const next = i < 0 ? step > 0 ? 0 : n - 1 : ((i + Math.sign(step)) % n + n) % n;
    this.following = candidates[next].slot;
  }
  /** Over the shoulder of whom you follow, pulled in where a wall is in the way. */
  followPose(watch, cast) {
    const fwd = viewDirection(watch.yaw, 0.25);
    const at = { x: watch.x, y: watch.y + 1.7, z: watch.z };
    const back = { x: -fwd.x, y: 0.35, z: -fwd.z };
    const len = Math.hypot(back.x, back.y, back.z);
    const dir = { x: back.x / len, y: back.y / len, z: back.z / len };
    const hit = cast(at, dir, 3.2);
    const d = hit === null ? 3.2 : Math.max(0.4, hit - 0.25);
    return { pos: { x: at.x + dir.x * d, y: at.y + dir.y * d, z: at.z + dir.z * d }, yaw: watch.yaw, pitch: -0.2 };
  }
  /** Start (or stop) the free camera, from `from` (the view as it is). */
  setFree(on, from) {
    this.free = on;
    this.freePos = on ? { ...from } : null;
  }
  /** Where the free camera is (null when it isn't flying). */
  get freeAt() {
    return this.freePos;
  }
  /**
   * One step of the free camera: `forward`/`right` (-1..1) along the view, `up` (-1..1) straight up, for
   * `dt` seconds, kept inside `bounds`. Returns whether it moved.
   */
  moveFree(dt, forward, right, up, yaw, pitch, fast, bounds) {
    const p = this.freePos;
    if (!p || !forward && !right && !up) return false;
    const speed = (fast ? FREE_CAM_FAST : FREE_CAM_SPEED) * dt;
    const f = viewDirection(yaw, pitch);
    const r = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    p.x += (f.x * forward + r.x * right) * speed;
    p.y += (f.y * forward + up) * speed;
    p.z += (f.z * forward + r.z * right) * speed;
    if (bounds) {
      p.x = Math.min(bounds.max.x, Math.max(bounds.min.x, p.x));
      p.y = Math.min(bounds.max.y, Math.max(bounds.min.y, p.y));
      p.z = Math.min(bounds.max.z, Math.max(bounds.min.z, p.z));
    }
    return true;
  }
}
function followable(poses, me, rule, teamOf, npcBase) {
  const mine = teamOf(me);
  return poses.filter((p) => p.alive && p.slot !== me && p.slot < npcBase && (!rule.teamOnly || mine !== void 0 && teamOf(p.slot) === mine)).sort((a, b) => a.slot - b.slot);
}
const ADS_FOV = 0.72;
const MULTI_KILL_MS = 4e3;
const $ = (id) => document.getElementById(id);
class GameSession {
  constructor(opts) {
    this.opts = opts;
    this.view = new GameView(opts.engine);
    this.view.showHitboxes = loadHitboxOverlay();
    if (botDebugWanted() && opts.transport instanceof LocalTransport) {
      const v = this.botDebug = new BotDebugView(this.view.scene, () => this.view.scene.activeCamera, (slot) => this.hud.name(slot));
      opts.transport.botDebug((f) => v.update(f));
    }
    this.input = new InputState(opts.canvas);
    this.sfx = new SessionAudio(opts.audio, () => this.slot);
    this.weatherSound = new WeatherAudio(opts.audio);
    this.showStats = opts.showStats || loadPerfOverlay();
    this.input.onToggle.set("F3", () => this.setShowStats(!this.showStats));
    this.input.onToggle.set("KeyM", () => {
      if (!this.bigMap) return;
      this.bigMap.hidden = !this.bigMap.hidden;
      if (!this.bigMap.hidden) this.hud.pickup("Map (M to put it away)");
    });
    if (opts.exitOnF5) this.input.onToggle.set("F5", () => this.exit());
    this.input.onToggle.set("Space", () => {
      if (this.outOfPlay || this.spectator || this.local && !this.local.alive && this.phase === "playing") this.input.toggleSpectateCamera();
    });
    this.input.onToggle.set("KeyJ", () => {
      if (this.spectator) this.setSpectating(false);
    });
    this.input.onToggle.set("KeyH", () => {
      const ride = this.seat && this.local?.alive ? this.mounts?.mounts.get(this.seat[0]) : void 0;
      if (ride && ride.def.kind === "vehicle" && !ride.def.airplane) {
        if (VehicleCamera.drives(ride.def, this.seat[1])) {
          const view = this.vehicleCam.toggle(ride.def);
          this.hud.pickup(view === "chase" ? "Chase camera (H for the cockpit)" : "Cockpit view (H for the chase camera)");
        } else this.hud.pickup("Riders look out from their seat (the driver can use the chase camera)");
        return;
      }
      this.thirdPerson = !this.thirdPerson;
      this.hud.pickup(this.thirdPerson ? "Third-person view (H to go back)" : "First-person view");
    });
    this.input.onToggle.set("KeyQ", () => {
      if (this.lastWeapon && this.local?.inventory.has(this.lastWeapon)) this.requestWeapon(this.lastWeapon);
    });
    this.wheel.onPoint = (x, y) => this.input.aimWheel(x, y);
    this.wheel.onTouchPick = () => this.input.closeWheel(true);
    this.wheel.onTouchCancel = () => this.input.closeWheel(false);
    this.orderWheel.onPoint = (x, y) => this.input.aimWheel(x, y);
    this.orderWheel.onTouchPick = () => this.input.closeWheel(true);
    this.orderWheel.onTouchCancel = () => this.input.closeWheel(false);
    if (isTouchDevice()) {
      this.touch = new TouchControls(this.input, $("hud"), { pause: () => this.input.setTouchEngaged(false) });
      this.input.onEngage = () => {
        this.touch?.setActive(this.input.touchEngaged);
        this.updatePause();
      };
    }
    this.hud.reset();
    this.setUpCoach();
    const signal = this.abort.signal;
    const lock = () => {
      opts.audio.unlock();
      if (this.touch) {
        if (!this.input.touchEngaged && !isFullscreen() && !testMode()) void toggleFullscreen().then(() => screen.orientation.lock?.("landscape")).catch(() => void 0);
        this.input.setTouchEngaged(true);
        return;
      }
      const raw = opts.canvas.requestPointerLock.call(opts.canvas, { unadjustedMovement: true });
      if (raw instanceof Promise) raw.catch(() => opts.canvas.requestPointerLock());
    };
    opts.canvas.addEventListener("click", lock, { signal });
    $("resume").addEventListener("click", lock, { signal });
    $("exitmatch").addEventListener("click", () => this.confirmLeave(), { signal });
    $("respawn-now").addEventListener(
      "click",
      () => {
        this.input.respawnQueued = true;
        lock();
      },
      { signal }
    );
    $("pause-spectate").addEventListener(
      "click",
      () => {
        this.setSpectating(!this.spectator);
        lock();
      },
      { signal }
    );
    $("exitmatch").textContent = opts.exitLabel;
    this.pauseMenu = new PauseMenu(
      {
        resume: () => {
          lock();
          ((this.pauseMenu.tab === "host" ? document.getElementById("hc-resume") : null) ?? $("resume")).focus();
        },
        overlay: () => document.getElementById("bm-pick-wrap") ?? document.getElementById("bot-manager") ?? document.getElementById("leave-confirm") ?? document.getElementById("online-confirm") ?? this.mapPicker,
        opened: () => this.drawPause(true),
        // MapMaker TEST: back from the top goes back to MapMaker.
        ...opts.exitOnF5 ? { top: { label: "MapMaker", act: () => this.exit() } } : {}
      },
      signal
    );
    $("pause-class").addEventListener(
      "click",
      () => {
        this.input.classMenu = true;
        lock();
      },
      { signal }
    );
    const hostBtn = $("host-game");
    const hostInfo = $("host-info");
    hostBtn.hidden = !opts.hostable || !(opts.transport instanceof LocalTransport) || this.offlineOnly;
    hostInfo.hidden = true;
    hostBtn.textContent = "Host with code only (not listed)";
    hostBtn.disabled = false;
    hostBtn.addEventListener("click", () => void this.startHosting(hostBtn, hostInfo), { signal });
    if (opts.hosting && opts.transport instanceof LocalTransport) {
      const local = opts.transport;
      this.peerHost = opts.hosting.peer;
      this.peerHost.admit = (link) => local.accept(link);
      local.joinCode = this.peerHost.code;
      if (opts.hosting.listing !== void 0) {
        $("host-list").checked = true;
        $("host-name").value = opts.hosting.listing;
      }
      void this.showHostInfo(hostBtn, hostInfo, this.peerHost.code);
    }
    this.hostPanel = this.makeHostPanel();
    $("go-online").addEventListener("click", () => this.peerHost ? void 0 : hubSetting() ? this.confirmGoOnline() : void this.goOnline(false), { signal });
    $("go-offline").addEventListener("click", () => this.peerHost && this.goOffline(), { signal });
    const pub = $("host-public");
    const listBox = $("host-list");
    const listName = $("host-name");
    pub.hidden = hostBtn.hidden || !hubSetting();
    listBox.checked = !!opts.hosting && opts.hosting.listing !== void 0;
    listName.value = opts.hosting?.listing ?? "";
    const showName = () => listName.hidden = !listBox.checked;
    showName();
    listBox.addEventListener("change", () => (showName(), this.updateListing()), { signal });
    listName.addEventListener("change", () => this.updateListing(), { signal });
    if (!opts.hosting && opts.autoHost) void this.goOnline(false);
    const sens = $("mouse-sens");
    const sensVal = $("mouse-sens-val");
    const zoomSens = $("zoom-sens");
    const zoomSensVal = $("zoom-sens-val");
    const invert = $("mouse-invert");
    const assist = $("aim-assist");
    const showMouse = () => {
      assist.checked = this.input.mouse.aimAssist;
      sens.value = String(this.input.mouse.sensitivity);
      sensVal.textContent = `${this.input.mouse.sensitivity.toFixed(1)}×`;
      zoomSens.value = String(this.input.mouse.zoomSensitivity);
      zoomSensVal.textContent = `${this.input.mouse.zoomSensitivity.toFixed(2)}×`;
      invert.checked = this.input.mouse.invertY;
    };
    showMouse();
    const mouseChanged = () => {
      this.input.mouse = { sensitivity: Number(sens.value) || 1, zoomSensitivity: Number(zoomSens.value) || 1, invertY: invert.checked, aimAssist: assist.checked };
      saveMousePrefs(this.input.mouse);
      showMouse();
    };
    sens.addEventListener("input", mouseChanged, { signal });
    zoomSens.addEventListener("input", mouseChanged, { signal });
    invert.addEventListener("change", mouseChanged, { signal });
    assist.addEventListener("change", mouseChanged, { signal });
    const perfBox = $("perf-overlay");
    perfBox.checked = this.showStats;
    perfBox.addEventListener("change", () => this.setShowStats(perfBox.checked), { signal });
    const reportBtn = $("perf-report");
    const reportNote = $("perf-report-note");
    reportBtn.addEventListener(
      "click",
      () => {
        if (!this.perf.visible) {
          this.setShowStats(true);
          reportNote.textContent = "Measuring now: play a minute (as when it was slow), then copy the report.";
          return;
        }
        const text = this.perf.report({
          renderer: this.opts.rendererKind,
          match: this.opts.transport.label,
          map: this.map?.metadata.name ?? "?",
          mode: this.rules?.mode ?? "?",
          players: this.view.avatarCount + 1,
          ping: `${this.opts.transport.rttMs.toFixed(0)} ms`
        });
        void navigator.clipboard?.writeText(text).then(
          () => reportNote.textContent = "Copied: paste it into a message.",
          () => reportNote.textContent = "Copying was blocked: select the report below and copy it."
        );
        const box = document.getElementById("perf-report-text");
        box.value = text;
        box.hidden = false;
      },
      { signal }
    );
    const recordBtn = $("perf-record");
    const recordNote = $("perf-record-note");
    recordBtn.addEventListener(
      "click",
      () => {
        if (this.recorder) {
          this.stopRecording();
          recordBtn.textContent = "Start recording";
          recordNote.textContent = "Saved to your downloads: send that file.";
          return;
        }
        this.recorder = new PerfRecorder(() => this.recorderContext());
        recordBtn.textContent = "Stop and save";
        recordNote.textContent = "Recording: play on. Stop here (or leave the match) to save the file.";
      },
      { signal }
    );
    const traceBtn = $("perf-trace");
    traceBtn.addEventListener(
      "click",
      () => {
        if (traceBtn.disabled) return;
        traceBtn.disabled = true;
        recordNote.textContent = "Tracing for 10 s: close this menu and play.";
        const x = this.recorderContext();
        void captureTrace(10, `tiletrigger-${fileStamp(x.map)}`, { map: x.map, mode: x.mode, players: x.players, renderer: x.renderer }).then((n) => {
          traceBtn.disabled = false;
          recordNote.textContent = `Trace saved to your downloads (${n} spans).`;
        });
      },
      { signal }
    );
    const bloodBox = $("blood-toggle");
    bloodBox.checked = this.view.blood.enabled;
    bloodBox.addEventListener(
      "change",
      () => {
        this.view.blood.enabled = bloodBox.checked;
        try {
          localStorage.setItem(BLOOD_PREF_KEY, bloodBox.checked ? "on" : "off");
        } catch {
        }
      },
      { signal }
    );
    this.sfx.bloodOn = () => this.view.blood.on;
    const flashBox = $("reduce-flashing");
    flashBox.checked = reduceFlashing();
    flashBox.addEventListener("change", () => saveReduceFlashing(flashBox.checked), { signal });
    window.addEventListener(REDUCE_FLASHING_EVENT, () => flashBox.checked = reduceFlashing(), { signal });
    const roomBox = $("room-lights");
    roomBox.checked = roomLightsOn();
    roomBox.addEventListener("change", () => saveRoomLights(roomBox.checked), { signal });
    window.addEventListener(ROOM_LIGHTS_EVENT, () => roomBox.checked = roomLightsOn(), { signal });
    this.sfx.worldImpact = (from, to) => {
      const struck = this.view.surfaceStruck(from, to);
      return impactSoundId(struck ? impactStyle(struck).sound : "hard");
    };
    this.sfx.blockPresent = (i) => this.scenario?.present(i) ?? true;
    this.view.scenario.liquids.fx.onSplash = (at) => this.sfx.splash(at);
    const bodiesSel = $("bodies-setting");
    bodiesSel.value = this.view.bodies;
    bodiesSel.addEventListener(
      "change",
      () => {
        this.view.bodies = bodiesSel.value === "fade" ? "fade" : "stay";
        try {
          localStorage.setItem(BODIES_PREF_KEY, this.view.bodies);
        } catch {
        }
      },
      { signal }
    );
    window.addEventListener("tiletrigger:first-person", () => this.view.setFirstPersonMode(loadFirstPersonMode()), { signal });
    bindFullscreenButton($("pause-fullscreen"), signal);
    document.addEventListener("pointerlockchange", () => this.updatePause(), { signal });
    window.addEventListener(
      "keydown",
      (e) => {
        const paused = !$("pause").hidden;
        if (paused && e.code !== "Escape" && this.pauseMenu.key(e)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        if (e.code !== "Escape") return;
        if (this.input.locked) {
          if (pageHoldsEscape() && !e.repeat) document.exitPointerLock();
          return;
        }
        if (!paused && this.voteHud?.open && !this.votePause) {
          this.votePause = true;
          return this.updatePause();
        }
        if (!paused) return;
        e.preventDefault();
        e.stopPropagation();
        if (browserTookEscape(e)) return;
        const t = e.target;
        if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" && !["checkbox", "radio", "range", "button"].includes(t.type))) return t.blur();
        this.pauseMenu.back();
      },
      { signal, capture: true }
    );
    opts.transport.start(
      (m) => {
        if (!perfProbe.on) return this.onMessage(m);
        const t0 = performance.now();
        this.onMessage(m);
        const t1 = performance.now();
        perfProbe.msg += t1 - t0;
        if (perfProbe.trace) perfProbe.mark("tt:net in", t0, t1);
      },
      // The link closed by itself: after the welcome that's a lost connection (a sleeping phone, a network blip), not a refusal.
      (reason) => this.exit(reason, this.welcomed && !this.rejected ? "lost" : void 0)
    );
  }
  opts;
  view;
  hud = new Hud();
  /** Damage numbers and the spray pattern (combatReadouts.ts; HUD options, off by default). */
  damageNumbers = new DamageNumbers(document.getElementById("damage-numbers"));
  spray = new SprayReadout(document.getElementById("spray-readout"));
  input;
  /** The weapon wheel (hold Q, hold a controller's Y, or the Weapons button on a phone). */
  wheel = new WeaponWheel(document.getElementById("hud"));
  /** Fireteams: the order wheel (hold B, hold a controller's d-pad up, or the Orders button on a phone). */
  orderWheel = new WeaponWheel(document.getElementById("hud"), "order-wheel");
  /** Fireteams' squad HUD: your squad's portraits, health and order; its minimap markers and colour (Part 2). */
  squadHud = new SquadHud(document.getElementById("hud"), (look) => this.opts.portraitOf?.(look) ?? Promise.reject(new Error("no portraits")));
  /** Fireteams: you lead a squad now (its id), and its current order (the HUD's line); null: you lead none. */
  squadLed = null;
  squadOrder = null;
  /** Phones and tablets: the on-screen controls (null with a mouse). */
  touch = null;
  interp = new Interpolator();
  sfx;
  /** The weather's rain and wind (weatherAudio.ts), and the weather last shown. */
  weatherSound;
  weatherKey = "";
  abort = new AbortController();
  slot = -1;
  local = null;
  /** This player has had a life in this match (the first one may start looking up or down: Play from here). */
  livedBefore = false;
  /** Spawns, portals, jump pads and ziplines read off movement, for their effects (gameplayFxWatch.ts). */
  fxWatch = null;
  map = null;
  scenario = null;
  /** When each objective last changed state, for fading out finished ones on the HUD. */
  objectiveChanged = /* @__PURE__ */ new Map();
  phase = "playing";
  timeLeft = 0;
  scores = [];
  serverStats = null;
  winner = null;
  /** Last known health fraction of every player and NPC, for the target bar. */
  hp = /* @__PURE__ */ new Map();
  rules = null;
  /** Your recent kills (ms), for the multi-kill rhythm of the kill marker. */
  killTimes = [];
  /** Out of play: the kill cam, following someone and the free camera (spectatorCam.ts). */
  specCam = new SpectatorCam();
  /** Spectating by choice (the roster marks you `sp`): out of the match until you join again. */
  spectator = false;
  /** The host lets players spectate by choice (welcome `spectate`). */
  canSpectate = false;
  /** Out of play this frame: spectating, or dead in a running match. */
  outOfPlay = false;
  /** The latest shot that hit you: who fired it and from where (the kill cam looks there when the killer isn't in view). */
  lastHitBy = null;
  /** Where the free camera may fly. */
  freeBounds = null;
  /** The view angles sent last tick (turning while watching counts as activity). */
  sentLook = { yaw: NaN, pitch: NaN };
  /** The name shown for whoever you just hit (targetLabel: in Roulette, with the character they wear this life). */
  targetLabel(target) {
    const name = this.hud.name(target);
    if (target >= NPC_ID_BASE) return name;
    return targetLabel(name, builtInLook(this.looks.get(target))?.name, !!this.rules && rouletteOn(this.rules));
  }
  /** Hit confirmation on the crosshair for your shot: head, armor or body, told apart by shape (and by sound, in SessionAudio). */
  hitFeedback(hits, zones, armor) {
    const target = hits.find((h) => h !== null && h !== void 0);
    if (target === void 0) return;
    const head = zones?.some((z, i) => z === 1 && hits[i] !== null && hits[i] !== void 0) ?? false;
    this.hud.hit(head ? "head" : armor ? "armor" : "body");
    this.hud.showTarget(this.targetLabel(target), this.hp.get(target) ?? 1, target >= NPC_ID_BASE ? "#e74c3c" : this.hud.team(target)?.color ?? "#ff8a3d");
  }
  outcome = null;
  /** Role and faction of each NPC seen, for names and looks. */
  npcInfo = /* @__PURE__ */ new Map();
  /** Character look of each player slot (from the roster). */
  looks = /* @__PURE__ */ new Map();
  /** Tests (the flashing flow's jackpot moment): Roulette's jackpot card and glow, as a jackpot life shows them, in any match. */
  testJackpot() {
    if (!this.map) return;
    this.rouletteHud ??= new RouletteHud(this.hud, this.input, this.map, () => this.rules, () => this.slot, this.opts.portraitOf);
    this.rouletteHud.spawned(this.looks.get(this.slot) ?? "core.ranger", 1);
  }
  /** A player plays another look from now (Random characters): their body, size, portrait and arms follow. */
  relook(slot, look) {
    this.looks.set(slot, look);
    const entry = this.lastRoster?.find((p) => p.slot === slot);
    if (entry) {
      entry.look = look;
      this.hud.setRoster(this.lastRoster);
    }
    if (slot === this.slot) {
      this.view.setLocalLook(look);
      if (this.local) this.local.scale = this.sizeOf(slot);
      const want = look;
      this.portraitLook = want;
      void this.opts.portraitOf?.(want).then((src) => this.portraitLook === want && this.hud.setPortrait(src), () => void 0);
    }
    this.view.characters.preload({ look });
  }
  /** The look the HUD portrait is (being) shown for: a late portrait for an earlier body doesn't replace a newer one. */
  portraitLook = null;
  /** A player's body scale: their look's size (class, or its own size stat), as the match plays it (Character sizes and stats). */
  sizeOf(slot) {
    const size = matchStats(this.looks.get(slot), this.rules ?? {}).size;
    return this.rlTiny.has(slot) ? size * TINY_SIZE : size;
  }
  botStates = [];
  /** The bot debug view (`?botdebug=1`, host or offline: botDebugView.ts), when asked for. */
  botDebug = null;
  outbox = [];
  /** The whole-map canvas (M). */
  bigMap = document.getElementById("bigmap");
  showStats;
  closed = false;
  /** Pickups currently taken (hidden until they respawn). */
  taken = /* @__PURE__ */ new Set();
  /** Random weapon pickups holding something other than what was placed (snapshot `pw`). */
  pickupItems = /* @__PURE__ */ new Map();
  /** Weapons the fallen dropped, lying now (snapshot `dw`). */
  drops = [];
  /** Weapon slot the player asked for (0 = no request). */
  wantWeapon = 0;
  /** Ground hazards from the latest snapshot, and your own status effects. */
  zones = [];
  /** Turrets, sentries and vehicles, and your seat in one: [mount entity index, seat, gun heat %]. */
  mounts;
  /** Where riders are drawn (on their seats, see riderPlacement.ts). */
  riderPlacement = new RiderPlacement();
  covers;
  ammoBoxes;
  /** Seconds of UAV sweep left for your side: enemies show on the minimap. */
  uav = 0;
  /** H: a camera over your shoulder, to see your own character. */
  thirdPerson = false;
  /** What you carried when the kept first-person guns were last trimmed (View.trimViewmodels): the map and its codes. */
  carriedInventory = null;
  carried = "";
  /** Third person: your own gun's last turn from the view onto the crosshair point (tests: `__cs.tpAim()`). */
  tpAim = null;
  /** Riding: the cockpit or chase camera (H switches while driving, remembered per ground / air). */
  vehicleCam = new VehicleCamera();
  /** The riding view this frame (cockpit, chase or a rider's seat), null on foot: for tests. */
  rideView = null;
  /** The join code's registration while this match is hosted for friends. */
  peerHost;
  /** The pause menu's Match section (bots, map, restart, end) and the match's settings while you run it. */
  hostPanel;
  hostState = null;
  mapPicker = null;
  /** The pause menu's tabs, keys and controller. */
  pauseMenu;
  /** When the pause menu's scores were last drawn. */
  pauseDrawnAt = 0;
  /** The host has a relay set up (Options → Relay), for the game browser's badge. */
  relayOn = false;
  tpClose = false;
  /** Your position as drawn this frame (blended between prediction ticks). */
  drawnPos = { x: 0, y: 0, z: 0 };
  /** Smoothed ground speed of drawnPos (m/s). */
  drawnSpeed = 0;
  /** Seconds your minimap stays jammed (enemy Counter-UAV), and your kill streak. */
  jam = 0;
  streak = 0;
  /** Classes: whether the match has them, every player's class (CLASS_IDS index), and your own class state (PrivateState.cl). */
  classesOn = false;
  classOf = /* @__PURE__ */ new Map();
  myClass = null;
  /** Disc Arena: your power disc and throws left (PrivateState.dp). */
  myDisc = null;
  /** Team pings on screen: where, who (an enemy when `target` is set), until when. */
  pings = [];
  nextPingId = 1;
  seat = null;
  localStatus = 0;
  lastWeapon = 0;
  /**
   * Quick melee pressed: a melee weapon in hand swings (its kick and sound
   * here; the server lands it); otherwise a punch, or a kick moving forward or
   * straight after a punch (the server's rule, sim UNARMED), shown at once.
   */
  localStrike(def, forward, now) {
    if (def?.kind === "melee") {
      this.view.kick(def);
      this.sfx.localShot(def);
      return;
    }
    if (now < this.meleeReadyAt || def?.projectile?.disc) return;
    const kind = unarmedStrike(forward, (now - this.punchedAt) / 1e3 * TICK_RATE);
    this.meleeReadyAt = now + UNARMED[kind].cooldownTicks / TICK_RATE * 1e3;
    this.punchedAt = kind === "punch" ? now : -1e9;
    this.view.localStrike(kind, this.jabNext);
    if (kind === "punch") this.jabNext = !this.jabNext;
    this.sfx.localStrike();
  }
  /** A remote player's next punch: jab and cross in turn. */
  nextPunch(slot) {
    const jab = this.punches.get(slot) ?? true;
    this.punches.set(slot, !jab);
    return jab ? "jab" : "melee";
  }
  /** Quick melee, as you see it: the key held last input, when the next strike is ready, the last punch (ms), and jab or cross next. */
  meleeHeld = false;
  meleeReadyAt = 0;
  punchedAt = -1e9;
  jabNext = true;
  /** Remote players' next punch: jab or cross, alternating. */
  punches = /* @__PURE__ */ new Map();
  /** Capture the Flag, King of the Hill, Elimination: flags, hill, status line, markers, announcer. */
  modeHud = null;
  /** The end-of-match awards and the revenge and nemesis callouts (awardsHud.ts), every mode. */
  awardsHud = null;
  /** Between matches: the vote on the next map (mapVoteHud.ts), and whether Esc asked for the pause menu over it. */
  voteHud = null;
  votePause = false;
  voteTravelling = false;
  /** Kills in this life by slot (the kill-streak burst at 3, 5, 10...: content/vfx.json map.gameplay streak). */
  lifeKills = /* @__PURE__ */ new Map();
  /** A kill: the killer's streak this life, and its burst over them at 3, 5, 7, 10, 15, 20... */
  streakMoment(ev, poses) {
    this.lifeKills.delete(ev.victim);
    if (ev.killer === null || ev.killer === void 0 || ev.killer === ev.victim) return;
    if (ev.tk) return void this.lifeKills.delete(ev.killer);
    const n = (this.lifeKills.get(ev.killer) ?? 0) + 1;
    this.lifeKills.set(ev.killer, n);
    if (!(n === 3 || n === 5 || n === 7 || n >= 10 && n % 5 === 0) || document.hidden) return;
    if (ev.killer === this.slot && !this.thirdPerson) return void this.hud.showMessage(`${n} kills in a row!`, 1.5);
    const p = ev.killer === this.slot && this.local ? this.local.state.pos : poses().find((x) => x.slot === ev.killer);
    if (p) {
      const at = this.view.towardCamera({ x: p.x, y: p.y + 2.1, z: p.z }, 0.3);
      this.view.playGameplayFx("streak", at, { calmable: true, size: this.view.farSize(at) });
    }
  }
  /** A hit worth showing (the `hurt` event): armour breaking, a heavy hit (and, if it was you, the screen's edge). */
  hurtMoment(ev) {
    const at = { x: ev.p[0], y: ev.p[1], z: ev.p[2] };
    const me = ev.s === this.slot;
    if (me && ev.a === "big") this.hud.heavyHit(ev.n ?? 50);
    if (me && !this.thirdPerson) return;
    const near = this.view.towardCamera(at, 0.5);
    this.view.playGameplayFx(ev.a === "armor" ? "armor.break" : "hit.big", near, { calmable: true, size: this.view.farSize(near) });
  }
  /** Spawn protection on you: a line under the crosshair until it drops (firing ends it). */
  shieldNote(on) {
    if (on) this.tips?.trigger("shield", performance.now() / 1e3);
    let el2 = document.getElementById("shield-note");
    if (!on) {
      if (el2) el2.hidden = true;
      return;
    }
    if (!el2) {
      el2 = document.createElement("div");
      el2.id = "shield-note";
      el2.textContent = "Spawn protection: firing ends it";
      (document.getElementById("hud") ?? document.body).append(el2);
    }
    el2.hidden = false;
  }
  /** Roulette (rouletteHud.ts): the spawn card, the death screen's pick and reroll, the storm, the awards. */
  rouletteHud = null;
  /** Roulette: players on a tiny roll this life (drawn and predicted smaller), on a jackpot (a gold glow); the cards coming up (preloaded). */
  rlTiny = /* @__PURE__ */ new Set();
  rlJackpot = /* @__PURE__ */ new Set();
  rlUpcoming = /* @__PURE__ */ new Set();
  /** Roulette: cards further ahead, loaded once the match has started (the loading gate waits only for the next ones). */
  rlLater = [];
  rlLoaded = /* @__PURE__ */ new Set();
  /** Fort Wars: pieces, the build-phase barrier, the Builder's ghost and panel. */
  forts = null;
  // Frame timing / instrumentation.
  acc = 0;
  last = performance.now();
  frames = 0;
  fps = 0;
  fpsAt = performance.now();
  frameMs = 0;
  /** The performance overlay's measurements (on while it shows). */
  perf = new PerfOverlay();
  /** The match recording while "Record performance" is on (perfRecorder.ts). */
  recorder = null;
  /** What a recording (and a trace's header) needs to know about the moment. */
  recorderContext() {
    const cam = this.view.cameraPosition();
    return {
      map: this.map?.metadata.name ?? "?",
      mode: this.rules?.mode ?? "?",
      players: this.view.avatarCount + 1,
      match: this.opts.transport.label,
      renderer: this.opts.rendererKind,
      pos: this.local ? [this.local.state.pos.x, this.local.state.pos.y, this.local.state.pos.z] : [cam.x, cam.y, cam.z],
      server: this.serverStats,
      shaders: this.view.shaderCount()
    };
  }
  /** Stop the recording and download it. */
  stopRecording() {
    const r = this.recorder;
    if (!r) return;
    this.recorder = null;
    downloadJson(`tiletrigger-perf-${fileStamp(this.map?.metadata.name ?? "match")}.json`, r.finish());
  }
  lastCorrections = 0;
  correctionsPerSec = 0;
  bytesInAt = 0;
  /** Scope sway state and breath (1 full). */
  sway = { x: 0, y: 0, t: 0 };
  breath = 1;
  breathSpent = false;
  /** Smoothed eye height above the feet (crouching and prone lower it). */
  eyeOffset = null;
  /** First-person roll riding a zipline (eased in and out). */
  zipRoll = 0;
  /**
   * Riding a zipline the view banks with the ride: leaning into the line's
   * sideways run across your view, and swaying a little on the cable, more
   * the faster you go. Level again once you let go.
   */
  zipLean(local, dt, now) {
    const line = local.alive && local.state.zip !== void 0 ? local.ziplines[local.state.zip] : void 0;
    let target = 0;
    if (line) {
      const v = local.state.zv ?? 0;
      const k = Math.min(1, Math.abs(v) / 15);
      const across = (Math.cos(this.input.yaw) * line.dir.x - Math.sin(this.input.yaw) * line.dir.z) * Math.sign(v || 1);
      target = -across * 0.12 * k + Math.sin(now / 1e3 * 1.9) * 0.025 * k;
    }
    this.zipRoll += (target - this.zipRoll) * Math.min(1, dt * 4);
    return Math.abs(this.zipRoll) < 1e-4 ? 0 : this.zipRoll;
  }
  /** Camera field of view now (eases for aiming down the sights), the scope's zoom level, and how far the gun is up to the eye. */
  fov = DEFAULT_FOV;
  zoomLevel = 0;
  scopedNow = false;
  adsAmount = 0;
  markers = markerSetting();
  /** Health and armour last frame, and where the latest shot at you (or blast) came from, for the damage flash. */
  lastHealth = 100;
  lastArmor = 0;
  hurtFrom = null;
  kibPerSec = 0;
  /** The match took us in (welcome), and the server refused or removed us (reject): how an exit is reported. */
  welcomed = false;
  rejected = false;
  /**
   * Scoped sway: the sights drift in a slow figure of eight, and the drift
   * moves your real aim. Holding Shift steadies it while your breath lasts;
   * run out and it sways harder until you've recovered.
   */
  updateScopeSway(dt, zoomed) {
    const holding = zoomed && this.input.held("ShiftLeft") && !this.breathSpent;
    this.breath = Math.max(0, Math.min(1, this.breath + (holding ? -dt / 3.5 : dt / 4)));
    if (this.breath === 0) this.breathSpent = true;
    if (this.breathSpent && this.breath > 0.5) this.breathSpent = false;
    this.hud.setBreath(this.breath, this.breathSpent);
    if (!zoomed) {
      this.sway = { x: 0, y: 0, t: 0 };
      return;
    }
    const amp = 35e-4 * (holding ? 0.12 : this.breathSpent ? 2.2 : 1);
    const t = this.sway.t += dt;
    const x = (Math.sin(t * 0.9) + Math.sin(t * 2.1) * 0.3) * amp;
    const y = Math.sin(t * 1.4) * amp * 0.75;
    this.input.yaw += x - this.sway.x;
    this.input.pitch += y - this.sway.y;
    this.sway.x = x;
    this.sway.y = y;
  }
  /**
   * Aim assist (an option, for touchpads and controllers): when an enemy is
   * close to the crosshair and in plain sight, the sights drift onto them, a
   * little faster the closer they already are. Never through walls.
   */
  aimAssist(eye, dt, now) {
    const mine = this.hud.team(this.slot)?.id;
    const coop = this.allied;
    const cone = 0.12;
    let best = null;
    for (const p of this.interp.sample(now)) {
      if (!p.alive || p.slot === this.slot || p.slot >= HOSTAGE_SLOT_BASE) continue;
      const npc = p.slot >= NPC_ID_BASE;
      if (!npc && (coop || mine && this.hud.team(p.slot)?.id === mine)) continue;
      const chest = { x: p.x - eye.x, y: p.y + ((p.stance ?? 0) === 2 ? 0.3 : (p.stance ?? 0) === 1 ? 0.8 : 1.25) - eye.y, z: p.z - eye.z };
      const dist = Math.hypot(chest.x, chest.y, chest.z);
      if (dist < 1 || dist > 80) continue;
      const yaw = Math.atan2(chest.x, chest.z);
      const pitch = Math.asin(chest.y / dist);
      const dy = Math.atan2(Math.sin(yaw - this.input.yaw), Math.cos(yaw - this.input.yaw));
      const dp = pitch - this.input.pitch;
      const off = Math.hypot(dy, dp);
      if (off > cone || best && off >= best.score) continue;
      const dir = { x: chest.x / dist, y: chest.y / dist, z: chest.z / dist };
      const wall = this.view.raycastLevel(eye, dir, dist);
      if (wall && wall.dist < dist - 0.5) continue;
      best = { dy, dp, score: off };
    }
    if (!best) return;
    const pull = Math.min(1, dt * (2 + 4 * (1 - best.score / cone)));
    this.input.yaw += best.dy * pull;
    this.input.pitch += best.dp * pull;
  }
  updatePause() {
    const was = $("pause").hidden;
    $("pause").hidden = this.input.locked || !this.local || this.closed || !!this.voteHud?.open && !this.votePause;
    if (was && !$("pause").hidden) {
      this.drawPause(true);
      $("resume").focus({ preventScroll: true });
    }
  }
  /** What the pause menu shows about the match: its line (map, mode, time), the scores, your online state. */
  drawPause(now = false) {
    if ($("pause").hidden) return;
    const t = performance.now();
    if (!now && t - this.pauseDrawnAt < 500) return;
    this.pauseDrawnAt = t;
    this.hud.pauseContext();
    if (this.pauseMenu.tab === "match") {
      this.hud.renderPauseScores($("pause-scores"), this.scores, this.slot, this.phase === "intermission");
    }
    $("pause-class").hidden = !this.classesOn;
    this.drawSpectateButton();
  }
  /** The pause menu's Spectate / Join game button (only where the host supports it), and Respawn (not while spectating). */
  drawSpectateButton() {
    const btn = $("pause-spectate");
    btn.hidden = !this.canSpectate || !this.opts.transport.sendSpectate;
    btn.textContent = this.spectator ? "Join game" : "Spectate";
    btn.title = this.spectator ? "Back into the match (J)" : "Leave play and watch: follow players or fly a free camera. A bot plays in your place until you join again";
    $("respawn-now").hidden = this.spectator;
  }
  /** Ask the host to make you a spectator (on) or put you back in the game; the roster answers (`sp`). */
  setSpectating(on) {
    if (on === this.spectator || !this.canSpectate) return;
    this.opts.transport.sendSpectate?.(on);
  }
  /** The roster says you are (or are no longer) a spectator. */
  spectatorChanged(on) {
    this.spectator = on;
    this.specCam.reset();
    if (on && this.local) this.local.alive = false;
    this.hud.showMessage(on ? "Spectating · J to join the game" : "Back in the game", 3);
    this.drawSpectateButton();
  }
  /** For browser tests: what the out-of-play camera is doing. */
  specState() {
    const c = this.view.cameraPosition();
    return { spectator: this.spectator, can: this.canSpectate, out: this.outOfPlay, killCam: this.specCam.killCam()?.killer ?? null, killCamEnd: this.specCam.killCamEnd, following: this.specCam.following, free: this.specCam.free, camera: { x: c.x, y: c.y, z: c.z }, rule: this.spectateRule() };
  }
  /** Who you may watch and whether the free camera is yours (spectatorCam.ts spectateRule). */
  spectateRule() {
    const local = this.opts.transport instanceof LocalTransport;
    return spectateRule({ teamMode: !!this.rules && isTeamMode(this.rules.mode), pureSpectator: this.spectator, offline: local, runsMatch: local || this.hostState !== null });
  }
  /** Leave: when friends play in this hosted match, it ends for them too, so ask first. */
  confirmLeave() {
    const local = this.opts.transport instanceof LocalTransport ? this.opts.transport : null;
    const friends = this.peerHost && local ? local.guests : 0;
    if (!friends) return this.exit();
    this.confirmBox("leave-confirm", "Leave the match?", `You host this game: leaving ends it for ${friends === 1 ? "your friend" : `${friends} friends`}.`, "Leave", () => this.exit(), true);
  }
  /** A short confirm over the pause menu (Esc or Cancel closes it). */
  confirmBox(id, title, text, yes, onYes, danger = false) {
    if (document.getElementById(id)) return;
    const box = document.createElement("div");
    box.id = id;
    box.className = "panel confirm";
    box.setAttribute("role", "dialog");
    const h = document.createElement("h3");
    h.className = "panel-title";
    h.textContent = title;
    const p = document.createElement("p");
    p.textContent = text;
    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    cancel.dataset.cancel = "1";
    cancel.id = id.replace("-confirm", "-cancel");
    const ok = document.createElement("button");
    ok.className = danger ? "danger" : "primary";
    ok.id = id.replace("-confirm", "-yes");
    ok.textContent = yes;
    const actions = document.createElement("div");
    actions.className = "confirm-actions";
    actions.append(cancel, ok);
    box.append(h, p, actions);
    $("pause").append(box);
    cancel.addEventListener("click", () => (box.remove(), $("resume").focus()));
    ok.addEventListener("click", () => {
      box.remove();
      onYes();
    });
    ok.focus();
  }
  /** Open a join code for this match and show it (with an invite link) in the pause menu. */
  async startHosting(btn, info) {
    const local = this.opts.transport;
    if (!(local instanceof LocalTransport) || this.peerHost || this.offlineOnly) return;
    btn.disabled = true;
    btn.textContent = "Opening a join code…";
    try {
      const host = (await loadSignaling()).host((link) => local.accept(link));
      this.peerHost = host;
      const code = await host.start();
      if (this.closed) return host.close();
      local.joinCode = code;
      await this.showHostInfo(btn, info, code);
    } catch (e) {
      this.peerHost = void 0;
      btn.disabled = false;
      btn.textContent = "Host with code only (not listed)";
      this.hud.showMessage(`Couldn't host: ${e.message}`, 5);
    }
  }
  /** The join code and invite link in the pause menu (a new code, or one carried over a map change). */
  async showHostInfo(btn, info, code) {
    if (this.closed) return;
    const hubRelay = !!this.peerHost?.relay;
    this.relayOn = !!loadRelay() || hubRelay;
    const link = this.inviteLink(code);
    const onlyHere = /^(localhost|127\.|\[::1\])/.test(location.hostname);
    const hubHere = /^(\w+:\/\/)?(localhost|127\.|\[::1\])/.test(hubSetting());
    btn.hidden = true;
    info.hidden = false;
    info.innerHTML = `<div class="host-code">Join code <b>${code}</b></div><input readonly value="${link}" /><button id="host-copy">Copy invite link</button><p class="hint">Friends open the link (or Online → Join by code). They take bots' places; with the link they join your side (your party), and stay together into the next map. Your browser runs the match: keep this tab open.${hubRelay ? " The hub provides a relay, so friends on strict networks can connect too." : loadRelay() ? " The link carries your relay settings." : " If a friend gets &quot;couldn't connect&quot;, set a relay in Options and send a new link."}</p>${hubHere ? `<p class="hint" style="color:#ffb03b">Your community hub is set to localhost, which other computers can't reach. Friends elsewhere: clear the hub (Online → Game browser → empty → Use) and host again. Same Wi-Fi: use your computer's network address for the hub.</p>` : ""}${phoneHost() ? `<p class="hint" style="color:#ffb03b">You're hosting from a phone or tablet: the match runs on it, so if its screen turns off or you switch apps it stops for everyone. Keep it awake and plugged in, or host from a computer (or a dedicated Host Service) for a game that keeps going.</p>` : ""}${onlyHere ? `<p class="hint" style="color:#ffb03b">This link says localhost, which only works on your computer. Friends on your network: open the game at your computer's network address (for example http://192.168.1.20:5173) and host from there; over the internet, host from the published site.</p>` : ""}`;
    info.querySelector("#host-copy").addEventListener("click", () => void navigator.clipboard?.writeText(link).then(() => this.hud.pickup("Invite link copied")));
    if (onlyHere) void this.lanInvite(info, code, link);
    this.hud.showMessage(`Hosting: join code ${code}`, 5);
    this.updateListing();
  }
  /** Any valid map may be listed publicly: our suite's as they are, others (MapMaker) labelled "Community map". */
  get listable() {
    return !!this.map && !this.offlineOnly;
  }
  /** A browser test's deterministic match (testMode.ts): never hosted, listed or joined. */
  get offlineOnly() {
    return this.opts.transport instanceof LocalTransport && this.opts.transport.testMode;
  }
  /** Not one of our suite's maps: listed as a community map, with its exact version (map/identity.ts). */
  get community() {
    return !!this.map && !inSuite(this.map.metadata.id);
  }
  identityFor;
  /** The map's ID, version and content hash (hashed once per map). */
  mapIdentity() {
    if (!this.map) return null;
    if (this.identityFor?.map !== this.map) this.identityFor = { map: this.map, id: mapIdentity(this.map) };
    return this.identityFor.id;
  }
  /** The online controls and status badge, after any change (hosting, friends, listing). */
  updateOnline() {
    const local = this.opts.transport instanceof LocalTransport ? this.opts.transport : null;
    const can = !!this.opts.hostable && !!local && !!this.map && !this.offlineOnly;
    const online = !!this.peerHost;
    const goOn = $("go-online");
    const goOff = $("go-offline");
    const note = $("online-note");
    const listed = online && $("host-list").checked && !!this.advertiser;
    $("pause-online-switch").hidden = !can;
    goOn.classList.toggle("on", online);
    goOff.classList.toggle("on", !online);
    goOn.setAttribute("aria-checked", String(online));
    goOff.setAttribute("aria-checked", String(!online));
    goOn.title = hubSetting() ? "Host online: the match restarts and is listed in the game browser; friends also join with the code, taking bots' places" : "Host online: a join code and invite link for friends, who take bots' places";
    const line = $("online-state-line");
    line.hidden = !can;
    line.textContent = online ? `${listed ? "Online and listed" : "Online, code only"}: friends join with the code or the invite link, taking bots' places.` : "Offline: only you and your bots. Host online (at the bottom) lets friends join.";
    note.hidden = !can || !this.community || !hubSetting();
    note.textContent = this.community ? 'Not one of our own maps: it is listed as a "Community map".' : "";
    $("host-list").disabled = !this.listable;
    $("host-name").hidden = !$("host-list").checked;
    const where = online && local && this.peerHost ? `${listed ? "Online · listed" : "Online · code only"} · ${1 + local.guests}/${local.capacity} · code ${this.peerHost.code}${this.community ? " · Community map" : ""}` : "";
    this.hud.onlineNote = where;
    const state = $("pause-online-state");
    state.hidden = !can;
    state.textContent = online ? `${where}. Host tab: invite link, Go offline.` : "Offline: only you and bots. Host tab → Go online to let people join.";
    state.classList.toggle("on", online);
    this.pauseMenu.setTabVisible("host", !!local || this.hostPanel.controlling);
  }
  /** "Go online": a short confirm, then the match restarts and is listed (and joinable by code). */
  confirmGoOnline() {
    if (!this.listable) return;
    this.confirmBox("online-confirm", "Go online?", "The match restarts on the same map and rules (scores reset) and is listed publicly in the game browser. Friends can also join with the code.", "Go online", () => void this.goOnline(true));
  }
  /**
   * Host online, one path wherever it's chosen (the Host tab's switch, Match setup's, Host this map): a join code
   * for friends (shown in the Host tab), and the match listed publicly in the game browser when there's a community
   * hub to list it on (a match still loading lists once it has loaded); without a hub, the code only. `restart`: a
   * match under way starts over first, a fresh one for the public (scores reset, bots back to the host's count); a
   * match that is just starting is fresh already.
   */
  async goOnline(restart) {
    const local = this.opts.transport;
    if (!(local instanceof LocalTransport) || !this.opts.hostable || this.offlineOnly) return;
    const first = !this.peerHost;
    if (first && restart) local.host({ c: "restart" });
    if (hubSetting()) $("host-list").checked = true;
    if (first) await this.startHosting($("host-game"), $("host-info"));
    else this.updateListing();
    this.updateOnline();
  }
  /** "Go offline": friends are told and disconnected, the listing and join code go; the match itself carries on. */
  goOffline() {
    const local = this.opts.transport;
    if (!(local instanceof LocalTransport) || !this.peerHost) return;
    local.dropGuests("The host took the game offline");
    $("host-list").checked = false;
    this.advertiser?.stop();
    this.advertiser = void 0;
    this.peerHost.close();
    this.peerHost = void 0;
    const btn = $("host-game");
    btn.hidden = false;
    btn.disabled = false;
    btn.textContent = "Host with code only (not listed)";
    $("host-info").hidden = true;
    $("host-public-status").textContent = "Offline: only you and your bots.";
    this.hud.showMessage("Offline: friends were disconnected and the listing removed", 4);
    this.updateOnline();
  }
  /** The pause menu's Match section: the offline player and the Host game host run their match; on a dedicated server, its admin. */
  makeHostPanel(dedicated = false) {
    const t = this.opts.transport;
    const local = t instanceof LocalTransport ? t : null;
    const net = t instanceof NetTransport || dedicated && !local && t.sendCommand ? t : null;
    const panel = new HostPanel(
      {
        command: (cmd) => {
          if (local) {
            if (cmd.c === "rotation" || cmd.c === "skip") return this.rotationCommand(cmd);
            const error = local.host(cmd);
            if (error) panel.setStatus(error, true);
          } else net?.sendCommand({ t: "host", cmd });
        },
        // The foot's Resume: as the Match tab's (it asks for the mouse back).
        resume: () => $("resume").click(),
        ...(local ? this.opts.hostable : net) && this.opts.mapPicker ? { changeMap: () => this.openMapPicker() } : {},
        ...net ? { login: (token) => net.sendCommand({ t: "admin", token }) } : {},
        // The map rotation: kept by this browser (not in a playlist, whose wins move it on), or by the server (when it has one).
        ...this.opts.mapPicker && (local && this.opts.hostable && this.opts.rotation && !this.opts.chain || net) ? { rotation: { add: () => this.openMapPicker("rotation"), presets: ROTATION_PRESETS } } : {}
      },
      net ? "Admin" : "Host"
    );
    panel.root.hidden = true;
    $(net ? "pause-admin-slot" : "pause-host-slot").append(panel.root);
    $("pause-host-foot").prepend(panel.foot);
    panel.setMap(this.map);
    if (local) this.showRotation(panel);
    const online = document.getElementById("pause-online-box");
    const tab = document.querySelector('#pause .pause-sec[data-sec="host"]');
    if (local && online && tab) panel.setLead(online, tab);
    return panel;
  }
  /** This browser's rotation, if it keeps one here (offline, Host game; not a playlist or MapMaker TEST). */
  get ownRotation() {
    return this.opts.transport instanceof LocalTransport && this.opts.hostable && !this.opts.chain ? this.opts.rotation ?? null : null;
  }
  /** The panel shows the rotation, and the match knows where it goes next (everyone's end-of-match scoreboard says so). */
  showRotation(panel = this.hostPanel) {
    const r = this.ownRotation;
    const t = this.opts.transport;
    if (!r || !(t instanceof LocalTransport)) return;
    const name = (id) => r.info(id)?.name ?? id;
    panel.setRotation({ ...r.list.state(name), vote: r.vote.get() });
    const up = r.list.peek();
    t.setUpNext(up ? { map: name(up.entry.map), mode: up.entry.mode } : null);
  }
  /** The host changed this browser's rotation (the list, shuffle), or skipped to its next map. */
  rotationCommand(cmd) {
    const r = this.ownRotation;
    if (!r) return;
    if (cmd.c === "skip") return void this.skipRotation();
    if (cmd.entries) {
      const v = validateRotation(cmd.entries, r.info);
      if (cmd.entries.length && !v.entries.length) return this.hostPanel.setStatus(`None of those can be played: ${v.dropped.join("; ")}`, true);
      const s = this.hostState;
      r.list.set(v.entries, s ? { map: s.map, mode: s.mode } : null);
    }
    if (cmd.shuffle !== void 0) r.list.setShuffle(cmd.shuffle);
    if (cmd.vote !== void 0) r.vote.set(cmd.vote);
    this.hostPanel.setStatus("");
    this.showRotation();
  }
  /** Skip to next: the rotation's next map now (as Change map does). */
  async skipRotation() {
    const r = this.ownRotation;
    const up = r?.list.peek();
    if (!r || !up || this.travel) return;
    const map = await r.load(up.entry.map);
    if (this.closed || this.travel) return;
    if (!map) return this.hostPanel.setStatus(`${r.info(up.entry.map)?.name ?? up.entry.map} didn't load`, true);
    r.list.advance();
    this.changeMap(map, up.entry.mode);
  }
  /**
   * A match ended with nowhere else to go, the host's vote is on: two or three of our maps that fit the people here
   * (the rotation's next first; sim/mapVote.ts), and the match holds the scoreboard while everyone votes. False when
   * there's no vote to have (off, not this browser's match, fewer than two maps fit): the rotation goes on as before.
   */
  openVote() {
    const r = this.ownRotation;
    const t = this.opts.transport;
    if (!r || !(t instanceof LocalTransport) || !r.vote.get() || !this.rules || !this.map) return false;
    const people = Math.max(1, (this.lastRoster ?? []).filter((p) => !p.bot).length);
    const ahead = r.list.upcomingEntries().flatMap((e) => r.pool(e.mode).filter((c) => c.map === e.map));
    const options = pickVoteOptions({ rotation: ahead, suite: r.pool(this.rules.mode), current: this.map.metadata.id, people });
    if (options.length < 2) return false;
    t.openVote(options);
    return true;
  }
  /** The vote as the host sends it: the cards under the scoreboard, the mouse freed to pick; the winner, then (hosting) the travel. */
  voteMessage(v) {
    const hud = this.voteHud;
    if (!hud) return;
    const was = hud.open;
    hud.update(v);
    if (v && !was) {
      this.votePause = false;
      if (document.pointerLockElement) document.exitPointerLock();
    }
    const lead = hud.leader();
    this.hud.nextMap = v && v.w === void 0 ? "Voting on the next map" : lead && v ? nextMapLine(lead.map, lead.mode) : this.hud.nextMap;
    if (v?.w !== void 0) void this.voteWon(v);
    this.updatePause();
  }
  /** This browser runs the match and the vote closed: everyone to the winner, with the host's settings (as the rotation goes). */
  async voteWon(v) {
    const r = this.ownRotation;
    const t = this.opts.transport;
    const won = v.o[v.w];
    if (!r || !(t instanceof LocalTransport) || !won || this.travel || this.voteTravelling) return;
    this.voteTravelling = true;
    const t0 = performance.now();
    const map = await r.load(won.map);
    const s = this.hostState;
    const live = t.liveRules() ?? this.rules;
    const rules = live && withPending(live, s?.pending);
    this.voteTravelling = false;
    if (this.closed || this.travel || !s || !rules) return;
    if (!map) return void console.warn(`vote: ${won.map} didn't load; the match replays`);
    r.list.moveTo(won);
    const next = rulesForTravel(rules, map, s.fill, won.mode, s.teamSize);
    this.travel = { host: { map, rules: next.rules, fill: next.fill, skill: s.skill, botSet: s.mapBots ? null : s.botSet ?? null } };
    this.showRotation();
    window.setTimeout(() => !this.closed && this.exit("travel"), Math.max(0, VOTE_RESULT_SECONDS * 1e3 - (performance.now() - t0)));
  }
  /** An invite link to this match: its code, the hub and relay friends need, and your party (they join your side). */
  inviteLink(code) {
    const q = new URLSearchParams(location.search);
    const peer = q.get("peer");
    const hub = hubSetting() && hubSetting() !== builtHub() ? hubSetting() : null;
    return `${location.origin}${location.pathname}?join=${code}&party=${myParty()}${peer ? `&peer=${encodeURIComponent(peer)}` : ""}${hub ? `&hub=${encodeURIComponent(hub)}` : ""}${relayParams()}`;
  }
  /** Joined a friend's game by code: the Match tab's invite link, so you can bring more friends (they join your party). */
  showInvite() {
    const box = document.getElementById("pause-invite");
    const code = this.opts.joinCode;
    if (!box) return;
    box.hidden = !code;
    if (!code) return box.replaceChildren();
    const link = this.inviteLink(code);
    const input = document.createElement("input");
    input.readOnly = true;
    input.value = link;
    input.id = "pause-invite-link";
    const copy = document.createElement("button");
    copy.id = "pause-invite-copy";
    copy.textContent = "Copy invite link";
    copy.addEventListener("click", () => void navigator.clipboard?.writeText(link).then(() => this.hud.pickup("Invite link copied")));
    const head = document.createElement("div");
    head.className = "host-code";
    head.innerHTML = `Invite friends · code <b>${code}</b>`;
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Friends who open your link join this match on your side (your party), taking bots' places; the party stays together into the next map.";
    box.replaceChildren(head, input, copy, hint);
  }
  /** A match ended with nowhere else to go: after the scoreboard, the rotation's next map (an empty rotation replays). */
  rotating = false;
  async rotateOn() {
    const r = this.ownRotation;
    const t = this.opts.transport;
    let up = r?.list.peek();
    if (!r || !up || !(t instanceof LocalTransport) || this.travel || this.rotating) return;
    this.rotating = true;
    const t0 = performance.now();
    const wait = Math.max(1e3, (this.rules?.intermissionTicks ?? 300) / TICK_RATE * 1e3 - 1500);
    let map = await r.load(up.entry.map);
    const people = Math.max(1, (this.lastRoster ?? []).filter((p) => !p.bot && !p.sp).length);
    for (let tries = r.list.entries.length; map && tries > 1 && mapPlayerCaps(map, up.entry.mode).max < people; tries--) {
      r.list.advance();
      up = r.list.peek();
      map = await r.load(up.entry.map);
    }
    const s = this.hostState;
    const live = t.liveRules() ?? this.rules;
    const rules = live && withPending(live, s?.pending);
    this.rotating = false;
    if (this.closed || this.travel || !s || !rules) return;
    if (!map) return void console.warn(`rotation: ${up.entry.map} didn't load; the match replays`);
    r.list.advance();
    const next = rulesForTravel(rules, map, s.fill, up.entry.mode, s.teamSize);
    this.travel = { host: { map, rules: next.rules, fill: next.fill, skill: s.skill, botSet: s.mapBots ? null : s.botSet ?? null } };
    this.showRotation();
    window.setTimeout(() => !this.closed && this.exit("travel"), Math.max(0, wait - (performance.now() - t0)));
  }
  /** Change map (or add one to the rotation): the front end's map cards (our suite only on servers, in Host game and for rotations). */
  openMapPicker(purpose = "change") {
    const s = this.hostState;
    if (!s || !this.opts.mapPicker || this.mapPicker) return;
    const local = this.opts.transport instanceof LocalTransport ? this.opts.transport : null;
    const close = () => {
      this.mapPicker?.remove();
      this.mapPicker = null;
    };
    this.mapPicker = this.opts.mapPicker({
      mode: s.mode,
      current: s.map,
      suiteOnly: !local || !!this.peerHost || purpose === "rotation",
      ...purpose === "rotation" ? { title: "Add to rotation" } : {},
      onClose: close,
      onPick: (map, mode) => {
        close();
        if (purpose === "rotation") this.addToRotation(map, mode);
        else this.changeMap(map, mode);
      }
    });
    $("pause").append(this.mapPicker);
  }
  /** The host picked a map for the end of the rotation (the whole list goes, as every rotation change does). */
  addToRotation(map, mode) {
    const entry = { map: map.metadata.id, mode };
    const own = this.ownRotation;
    const now = own ? own.list.entries : this.hostState?.rotation?.entries ?? [];
    const cmd = { c: "rotation", entries: [...now.map((e) => ({ map: e.map, mode: e.mode })), entry] };
    if (own) return this.rotationCommand(cmd);
    this.opts.transport.sendCommand?.({ t: "host", cmd });
  }
  /**
   * The host picked a map. Dedicated server: ask it (it checks the map is ours
   * and sends everyone `travel`). In the browser: tell everyone, then restart
   * the match there with the same rules and players; Host game friends follow.
   */
  changeMap(map, mode) {
    const s = this.hostState;
    const t = this.opts.transport;
    if (!s || this.travel) return;
    if (!(t instanceof LocalTransport)) {
      t.sendCommand?.({ t: "host", cmd: { c: "map", map: map.metadata.id, mode } });
      this.hostPanel.setStatus(`Changing map to ${map.metadata.name}…`);
      return;
    }
    const live = t.liveRules() ?? this.rules;
    if (!live) return;
    const next = rulesForTravel(withPending(live, s.pending), map, s.fill, mode, s.teamSize);
    t.notice(travelNotice(map.metadata.name, next.rules.mode));
    this.travel = { host: { map, rules: next.rules, fill: next.fill, skill: s.skill, botSet: s.mapBots ? null : s.botSet ?? null } };
    window.setTimeout(() => this.exit("travel"), 1200);
  }
  /** A dedicated server's LAN join addresses in the pause menu, to pass on to people on the same network. */
  showLanAddresses(lan) {
    const info = $("host-info");
    info.hidden = false;
    info.replaceChildren();
    const head = document.createElement("div");
    head.className = "host-code";
    head.textContent = "LAN join address";
    info.append(head);
    for (const addr of lan) {
      const row = document.createElement("div");
      row.className = "lan-address";
      const input = document.createElement("input");
      input.readOnly = true;
      input.value = addr;
      const copy = document.createElement("button");
      copy.textContent = "Copy";
      copy.addEventListener("click", () => void navigator.clipboard?.writeText(addr).then(() => this.hud.pickup("LAN address copied")));
      row.append(input, copy);
      info.append(row);
    }
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "People on your network: Online → LAN finds this server, or paste the address under Online → Server.";
    info.append(hint);
  }
  /**
   * Host game on a page opened at localhost: a hub on this computer knows its
   * network addresses, so offer the invite link at one of those instead.
   */
  async lanInvite(info, code, link) {
    const hub = hubAddress();
    if (!hub) return;
    try {
      const res = await fetch(`${hub.secure ? "https" : "http"}://${hub.host}:${hub.port}${hub.path}lobby/lan`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
      const body = res.ok ? await res.json() : {};
      const ip = /^http:\/\/([\d.]+):/.exec(body.addresses?.[0] ?? "")?.[1];
      if (!ip || this.closed) return;
      const lanLink = link.replace(/^(\w+:\/\/)[^:/]+/, `$1${ip}`).replace(/([?&]hub=)[^&]*/, `$1${encodeURIComponent(`${ip}:${hub.port}`)}`);
      const row = document.createElement("div");
      row.className = "lan-address";
      const input = document.createElement("input");
      input.readOnly = true;
      input.value = lanLink;
      const copy = document.createElement("button");
      copy.textContent = "Copy LAN link";
      copy.addEventListener("click", () => void navigator.clipboard?.writeText(lanLink).then(() => this.hud.pickup(`LAN link for ${code} copied`)));
      row.append(input, copy);
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = "Same network: this link uses your computer's network address (the game must be served there too, e.g. by the hub after pnpm build).";
      info.append(row, hint);
    } catch {
    }
  }
  /** Seconds in a row this browser's own match fell behind or rendered slowly (see noteIfSlow); -1 once noted. */
  slowSeconds = 0;
  /**
   * A big match in this browser (offline, Host game) on a device that can't keep
   * up: after a few seconds of the match falling behind real time or frames
   * crawling, one quiet line says what helps. Nothing otherwise.
   */
  /** Show or hide the performance overlay (and remember it). */
  setShowStats(on) {
    this.showStats = on;
    savePerfOverlay(on);
    const box = document.getElementById("perf-overlay");
    if (box) box.checked = on;
  }
  noteIfSlow(stats) {
    if (this.slowSeconds < 0 || !(this.opts.transport instanceof LocalTransport) || this.offlineOnly) return;
    const slow = !document.hidden && (stats.lateTicks > 12 || this.frameMs > 50);
    this.slowSeconds = slow ? this.slowSeconds + 1 : 0;
    if (this.slowSeconds < 5) return;
    this.slowSeconds = -1;
    const players = stats.humans + stats.bots;
    this.hud.showMessage(`This device is finding ${players} players heavy: fewer bots, or lower graphics in Options, will help.`, 6);
  }
  /** Set when a chain moves on (see Travel). */
  travel = null;
  dedicatedPanel = false;
  lastRoster = null;
  /** The roster's people other than you, for the host's kick and ban buttons. */
  peopleIn(players) {
    return players.filter((p) => !p.bot && p.slot !== this.slot).map((p) => ({ slot: p.slot, name: p.name }));
  }
  /** The match's teams' IDs in order (team modes), for counting the people on each. */
  teamIds = null;
  /** People on each team besides you, and your team (team modes; spectators are on none): the Host tab's teams read "You + 6 bots". */
  teamPeople(players) {
    const ids = this.teamIds;
    if (!ids) return null;
    const others = ids.map(() => 0);
    let you = null;
    for (const p of players) {
      const i = p.bot || p.sp || p.team === null ? -1 : ids.indexOf(p.team);
      if (i < 0) continue;
      if (p.slot === this.slot) you = i;
      else others[i]++;
    }
    return { others, you };
  }
  /** A won co-op map in a local match: after a moment for the results, go on to the next map of the chain. */
  chainOn(next) {
    const local = this.opts.transport;
    if (!(local instanceof LocalTransport) || !next && !this.opts.chain || this.travel) return;
    this.travel = { ...next ? { id: next } : {} };
    const wait = Math.max(1e3, (this.rules?.intermissionTicks ?? 300) / TICK_RATE * 1e3 - 600);
    this.hud.showMessage(next ? "Mission complete: on to the next map…" : "Mission complete: next mission…", wait / 1e3);
    window.setTimeout(() => {
      if (this.closed) return;
      this.travel.carry = local.carry() ?? void 0;
      this.exit("travel");
    }, wait);
  }
  advertiser;
  /** Start or stop listing the hosted match in the game browser, following the pause-menu checkbox. */
  updateListing() {
    const box = $("host-list");
    const status = $("host-public-status");
    const local = this.opts.transport;
    const host = this.peerHost;
    if (!box.checked || !host?.code || !(local instanceof LocalTransport) || !this.listable) {
      this.advertiser?.stop();
      this.advertiser = void 0;
      status.textContent = !this.listable && this.map ? "Not listed." : box.checked ? "Will be listed once you host (Go online, or Host with code)." : "Friends only: share the code or link.";
      this.updateOnline();
      return;
    }
    if (this.advertiser) return;
    if (!this.lastRoster) {
      status.textContent = "Listing as the match starts…";
      return;
    }
    const me = this.hud.name(this.slot);
    const show = () => status.textContent = this.advertiser?.error ? `Not listed: ${this.advertiser.error}` : "Listed: anyone can join from Online → Game browser.";
    this.advertiser = new LobbyAdvertiser(
      () => ({
        code: host.code,
        name: $("host-name").value.trim() || `${me}'s game`,
        host: me,
        map: this.map?.metadata.name ?? "Unknown map",
        ...this.community && this.mapIdentity() ? { community: true, mapId: this.mapIdentity().mapId, versionId: this.mapIdentity().versionId, contentHash: this.mapIdentity().contentHash } : { mapId: this.map?.metadata.id },
        mode: this.rules?.mode ?? "core.deathmatch",
        players: 1 + local.guests,
        max: local.capacity,
        relay: this.relayOn,
        region: myRegion()
      }),
      show,
      // The match knows its listing's name (a successor lists the match under it if this browser goes); the page keeps its secret.
      (id, secret) => local.setListing(id ? { name: $("host-name").value.trim() || `${me}'s game`, id, secret } : null)
    );
    this.advertiser.start();
    this.listedSince ??= Date.now();
    window.addEventListener("pagehide", this.pageHideReport);
    show();
    this.updateOnline();
  }
  /** When this match was first listed (a community map's end-of-match report counts from then). */
  listedSince;
  pageHideReport = () => this.reportCommunityPlays(true);
  /**
   * A listed match on a community map ends (leaving, a map change, the tab closing): the host's report of who played
   * (signed-in players only) goes to the hub, which counts it toward Community Picks (docs/COMMUNITY_MAPS.md).
   */
  reportCommunityPlays(closing = false) {
    const local = this.opts.transport instanceof LocalTransport ? this.opts.transport : null;
    const id = this.community ? this.mapIdentity() : null;
    const code = this.peerHost?.code;
    if (!local || !id || !code || this.listedSince === void 0 || !this.map) return;
    const me = currentAccount();
    const map = this.map;
    const report = local.plays.report(code, id.contentHash, me ? { sub: me.sub, since: this.listedSince } : null);
    this.listedSince = void 0;
    void sendPlayReport(report, () => serializeMap(map), closing);
  }
  exit(reason, how) {
    if (this.closed) return;
    this.closed = true;
    this.stopRecording();
    perfProbe.use("overlay", false);
    this.reportCommunityPlays();
    window.removeEventListener("pagehide", this.pageHideReport);
    this.advertiser?.stop();
    const local = this.opts.transport instanceof LocalTransport ? this.opts.transport : null;
    if (reason === "travel" && this.travel && this.peerHost && local) {
      local.travelGuests(this.travel.host?.map.metadata.name ?? this.travel.id ?? "the next map");
      const listed = $("host-list").checked;
      this.travel.hosting = { peer: this.peerHost, ...listed ? { listing: $("host-name").value } : {} };
    } else if (this.peerHost && local?.guests) {
      local.sayGoodbye();
      const peer = this.peerHost;
      window.setTimeout(() => peer.close(), 1500);
    } else this.peerHost?.close();
    const end = this.welcomed && this.welcomeMap && this.rules ? { board: this.hud.boardData(this.scores, this.slot, true), map: this.welcomeMap, rules: this.rules, fill: Math.max(2, this.lastRoster?.length ?? 2) } : void 0;
    this.hostPanel.remove();
    this.wheel.dispose();
    this.orderWheel.dispose();
    this.touch?.dispose();
    this.mapPicker?.remove();
    document.getElementById("online-confirm")?.remove();
    document.getElementById("leave-confirm")?.remove();
    $("pause-scores").replaceChildren();
    if (document.pointerLockElement) document.exitPointerLock();
    this.opts.transport.close();
    this.abort.abort();
    this.input.dispose();
    this.opts.audio.stopAll();
    this.modeHud?.dispose();
    this.forts?.dispose();
    this.rouletteHud?.dispose();
    this.awardsHud?.dispose();
    this.voteHud?.dispose();
    this.voteHud = null;
    this.coach?.dispose();
    this.botDebug?.dispose();
    this.botDebug = null;
    document.getElementById("pause-skip-tutorial")?.remove();
    this.hud.hide();
    $("pause").hidden = true;
    this.view.dispose();
    this.opts.onExit(reason, this.travel ?? void 0, how ?? (this.rejected ? "rejected" : void 0), end);
  }
  /** The map as the welcome brought it (before this page added anything to it), for hosting the match again. */
  welcomeMap = null;
  onMessage(msg) {
    if (this.closed) return;
    switch (msg.t) {
      case "welcome": {
        this.welcomed = true;
        this.welcomeMap = msg.map;
        const loaded = loadMap(withTrackVehicles(msg.map));
        if (!loaded.ok) {
          this.exit(`invalid map: ${loaded.issues[0]?.message}`);
          return;
        }
        this.slot = msg.slot;
        this.hud.self = msg.slot;
        if (this.markers.ally !== "team") this.hud.partyColor = this.markers.ally;
        this.rules = msg.rules;
        this.view.setWeaponSetLook(weaponSetInPlay(msg.rules, loaded.map)?.id);
        this.applyWeather(msg.rules, loaded.map);
        this.canSpectate = msg.spectate === 1;
        this.drawSpectateButton();
        this.freeBounds = freeCamBounds(loaded.map);
        if (msg.lan?.length) this.showLanAddresses(msg.lan);
        if (msg.dedicated && !(this.opts.transport instanceof NetTransport) && !(this.opts.transport instanceof LocalTransport) && !this.dedicatedPanel) {
          this.dedicatedPanel = true;
          this.hostPanel.remove();
          this.hostPanel = this.makeHostPanel(true);
          if (this.lastRoster) this.hostPanel.setPeople(this.peopleIn(this.lastRoster), this.teamPeople(this.lastRoster));
        }
        const teams = isTeamMode(msg.rules.mode) ? matchTeams(loaded.map, msg.rules) : null;
        this.teamIds = teams?.map((t) => t.id) ?? null;
        this.hud.setTeams(teams);
        this.hud.setBoardMode(msg.rules.mode);
        this.hud.setModeLabel(msg.rules.mode === "core.coop" ? "Co-op Mission" : rouletteOn(msg.rules) && msg.rules.mode !== "core.roulette" ? `Roulette: ${MODE_LABELS[msg.rules.mode]}` : MODE_LABELS[msg.rules.mode] ?? "Deathmatch");
        this.hud.waitLabel = msg.rules.mode === "core.zombies" ? "Down: back at the next wave" : "Respawning…";
        this.view.keepBodies = msg.rules.mode === "core.zombies";
        this.classesOn = classesInPlay(msg.rules);
        this.input.classCount = this.classesOn ? CLASS_IDS.length : 0;
        this.input.classMenu = this.classesOn;
        this.hud.setMapName(loaded.map.metadata.name);
        this.sfx.myTeam = () => this.hud.team(this.slot)?.id ?? null;
        this.hud.minimap.setMap(loaded.map);
        void this.opts.portrait?.then((src) => this.portraitLook === null && this.hud.setPortrait(src), () => void 0);
        const geometry = buildMapGeometry(loaded.map);
        this.map = loaded.map;
        this.hostPanel.setMap(loaded.map);
        this.view.buildMap(loaded.map, geometry);
        if (teams && (msg.rules.mode === "core.ctf" || msg.rules.mode === "core.forts" || msg.rules.mode === "core.koth" || msg.rules.mode === "core.elim" || msg.rules.mode === "core.bomb" || msg.rules.mode === "core.hostage" || msg.rules.mode === "core.breakthrough")) this.modeHud = new ModeHud(this.hud, this.view, loaded.map, teams, msg.rules.mode, () => this.slot);
        this.awardsHud?.dispose();
        this.awardsHud = new AwardsHud(this.hud, () => this.slot, () => this.squadHud.current?.id ?? null);
        this.voteHud?.dispose();
        this.voteHud = new MapVoteHud((i) => this.opts.transport.sendVote?.(i), (id) => this.opts.mapPicture?.(id) ?? null);
        this.showInvite();
        if (rouletteOn(msg.rules)) {
          this.rouletteHud = new RouletteHud(this.hud, this.input, loaded.map, () => this.rules, () => this.slot, this.opts.portraitOf);
          this.view.auraWarm = true;
          this.view.auraOf = (slot) => {
            const outline = this.rules?.teamOutlines ? this.hud.team(slot)?.color ?? null : null;
            const glow = this.rlJackpot.has(slot) ? "#ffc93c" : null;
            return outline || glow ? { outline, glow } : null;
          };
        }
        if (msg.rules.lunar) this.view.setEffectsGravity(matchPhysics(msg.rules, loaded.map).gravity);
        this.sfx.setMap(loaded.map);
        this.sfx.joined();
        const physics = new PhysicsWorld(geometry, mapTerrainMesh(loaded.map), environmentShapes(loaded.map));
        this.local = new LocalPlayer(physics);
        this.local.pads = mapPads(loaded.map.entities, msg.rules.lunar ? LUNAR_PAD_BOOST : 1);
        this.local.ladders = mapLadders(loaded.map.entities);
        this.local.ziplines = mapZiplines(loaded.map.entities);
        this.local.team = () => this.hud.team(this.slot)?.id ?? (this.rules?.mode === "core.coop" ? "players" : null);
        this.local.scale = this.sizeOf(this.slot);
        this.local.gravity = matchPhysics(msg.rules, loaded.map).gravity;
        this.local.rules = { ...msg.rules.ballistics ? { ballistics: msg.rules.ballistics } : {} };
        this.local.liquids = mapLiquids(loaded.map.entities);
        this.local.gravityZones = mapGravityZones(loaded.map.entities);
        this.local.portals = mapPortals(loaded.map.entities);
        this.fxWatch = new GameplayFxWatch(this.local.pads, this.local.portals, (key, at) => this.view.playGameplayFx(key, at));
        this.scenario = new ScenarioState(loaded.map, physics);
        if (this.scenario.movers.defs.length) this.local.platforms = this.scenario;
        if (this.local.portals.length) this.local.portalOn = this.scenario.portalOn;
        this.mounts = new MountState(loaded.map, physics);
        this.covers = new CoverState(this.view.scene, physics, (at) => this.view.debris(at, "#b39b6b", 0.7), this.view.models);
        this.ammoBoxes = new AmmoBoxState(this.view.scene, physics, this.view.models);
        if (teams && msg.rules.mode === "core.forts") this.forts = new FortsClient(this.view, physics, loaded.map, teams, () => this.hud.team(this.slot)?.id ?? null, this.opts.audio);
        this.scenario.apply(msg.sc);
        this.hud.show();
        this.hud.npcName = (id) => this.npcLook(id)?.label;
        this.updatePause();
        if (this.peerHost) this.updateListing();
        this.updateOnline();
        window.__cs = { slot: this.slot, hud: this.hud, renderer: this.opts.rendererKind, local: this.local, view: this.view, input: this.input, wheel: this.wheel, orderWheel: this.orderWheel, squad: () => ({ led: this.squadLed, order: this.squadOrder, hud: this.squadHud.current }), mode: this.modeHud, transport: this.opts.transport, mounts: this.mounts, forts: this.forts, phase: () => this.phase, rideView: () => this.rideView, host: () => this.hostState, rules: () => this.rules, roulette: () => this.rouletteHud?.debug(), awards: () => this.awardsHud?.debug(), vote: () => this.voteHud?.debug() ?? null, showAwards: (aw) => this.awardsHud?.show(aw), heavyOverlay: () => this.hud.heavyOverlay(), rouletteGlow: () => this.rouletteHud?.glowOverlay() ?? null, rouletteHold: (on) => void (this.rouletteHud && (this.rouletteHud.hold = on)), jackpotGlow: () => this.testJackpot(), timeLeft: () => this.timeLeft, map: loaded.map.metadata.id, spec: () => this.specState(), spectate: (on) => this.setSpectating(on), thirdPerson: () => this.thirdPerson, tpAim: () => this.tpAim, viewTick: () => this.interp.renderTick(), lifeKills: this.lifeKills, damageNumbers: this.damageNumbers, spray: this.spray };
        this.opts.onReady?.();
        if (this.opts.greeting) this.hud.showMessage(this.opts.greeting, 6);
        void this.prepareMatch();
        break;
      }
      case "reject":
        this.rejected = true;
        this.exit(msg.reason, "rejected");
        break;
      case "roster":
        this.hud.setRoster(msg.players);
        this.lastRoster = msg.players;
        this.hostPanel.setPeople(this.peopleIn(msg.players), this.teamPeople(msg.players));
        if (this.peerHost) {
          if (!this.advertiser) this.updateListing();
          this.updateOnline();
        }
        if (msg.players.find((p) => p.slot === this.slot)?.sp === 1 !== this.spectator) this.spectatorChanged(!this.spectator);
        this.looks = new Map(msg.players.map((p) => [p.slot, p.look]));
        this.view.setLocalLook(this.looks.get(this.slot));
        if (this.local) this.local.scale = this.sizeOf(this.slot);
        for (const p of msg.players) this.view.characters.preload({ look: p.look });
        break;
      case "snapshot": {
        if (this.phase === "countdown" && msg.phase === "playing") this.hud.flashGo();
        if (msg.phase === "countdown" && msg.timeLeft !== this.timeLeft && msg.timeLeft > 0) this.sfx.countdownBeep(false);
        if (this.phase === "countdown" && msg.phase === "playing") this.sfx.countdownBeep(true);
        this.phase = msg.phase;
        this.timeLeft = msg.timeLeft;
        this.scores = msg.score;
        for (const p of msg.players) this.hp.set(p.s, p.hp / PLAYER.maxHealth);
        for (const n of msg.np) this.hp.set(n[0], n[6] / 100);
        for (const n of msg.np) this.npcInfo.set(n[0], { role: n[7], faction: n[8], size: n[11] ?? 1 });
        this.interp.push(msg.tick, [...msg.players, ...msg.np.map(npcAsPlayer)], msg.pr, msg.hold);
        if (netProbe.on) {
          const at = netProbe.inputAt.get(msg.ack);
          if (at !== void 0) {
            netProbe.ackMs.push(performance.now() - at);
            for (const seq of netProbe.inputAt.keys()) if (seq <= msg.ack) netProbe.inputAt.delete(seq);
          }
        }
        if (msg.ld) this.view.setLeaders(new Set(msg.ld.filter((s) => s >= 0)));
        this.hud.setLeaders(msg.ld);
        if (msg.fs || this.squadHud.current) this.squadSnapshot(msg.fs, msg.players);
        this.hud.setSquads(msg.fs ?? null);
        this.hud.setLife(msg.players);
        this.zones = msg.zn ?? [];
        this.mounts?.apply(msg.mt, msg.tick);
        for (const at of this.mounts?.takeCharges() ?? []) this.sfx.sentryCharge(at);
        this.mounts?.applySuspension(msg.ms);
        this.covers?.apply(msg.cv);
        this.ammoBoxes?.apply(msg.ab);
        this.seat = msg.me?.mo ?? null;
        this.uav = msg.me?.uv ?? 0;
        this.jam = msg.me?.jm ?? 0;
        this.streak = msg.me?.ks ?? 0;
        if (this.local) this.local.zones = this.zones;
        this.localStatus = msg.players.find((p) => p.s === this.slot)?.fx ?? 0;
        if (this.classesOn) {
          const kept = msg.hold ? [...this.classOf].filter(([slot]) => msg.hold.includes(slot)) : [];
          this.classOf = new Map([...kept, ...msg.players.filter((p) => p.cl !== void 0).map((p) => [p.s, p.cl])]);
          this.hud.setClasses(msg.players);
        }
        this.myClass = msg.me?.cl ?? null;
        this.myDisc = msg.me?.dp ?? null;
        this.taken = new Set(msg.pk);
        this.pickupItems = new Map(msg.pw ?? []);
        this.drops = msg.dw ?? [];
        this.modeHud?.snapshot(msg.md);
        this.forts?.apply(msg.md);
        this.zombieHud(msg.md?.zb);
        this.awardsHud?.phase(msg.phase);
        this.shieldNote((this.localStatus & FX_PROTECTED) !== 0 && msg.phase === "playing");
        if (this.rouletteHud) {
          this.rouletteHud.stormSnapshot(msg.rl);
          if (msg.rl && this.local) {
            const g = msg.rl[2] / 100;
            if (this.local.gravity !== g) {
              this.local.gravity = g;
              this.view.setEffectsGravity(g);
            }
          }
          const kept = msg.hold ? [...this.rlJackpot].filter((slot) => msg.hold.includes(slot)) : [];
          this.rlJackpot = /* @__PURE__ */ new Set([...kept, ...msg.players.filter((p) => ((p.fx ?? 0) & FX_JACKPOT) !== 0).map((p) => p.s)]);
          const mine = msg.players.find((p) => p.s === this.slot);
          this.rouletteHud.state(msg.me?.rp, mine ? mine.alive === 1 : true, msg.phase);
          this.rouletteHud.phase(msg.phase);
        }
        this.scenario?.apply(msg.sc);
        const me = msg.players.find((p) => p.s === this.slot);
        if (me && this.local) {
          if (!me.alive && this.local.alive && this.classesOn) this.input.classMenu = true;
          if (me.alive && !this.local.alive) {
            this.input.yaw = me.yaw;
            this.input.pitch = this.livedBefore ? 0 : me.pitch;
            this.livedBefore = true;
            this.wantWeapon = 0;
          }
          this.local.reconcile(me, msg.ack, msg.me, msg.tick);
          this.damageNumbers.take(msg.me?.dd, performance.now());
          if (this.wantWeapon && me.w === this.wantWeapon) this.wantWeapon = 0;
        }
        this.botStates = msg.players.filter((p) => p.st).map((p) => `  ${this.hud.name(p.s).padEnd(14)} ${p.st}`);
        let poses;
        const posesNow = () => poses ??= this.interp.sample();
        for (const ev of msg.ev) {
          if (ev.e === "spawn" && this.rouletteHud) {
            if (ev.j === 2) this.rlTiny.add(ev.s);
            else this.rlTiny.delete(ev.s);
            (ev.nx ?? []).forEach((look, i) => {
              if (this.rlLoaded.has(look)) return;
              if (i > 0 && this.rlLater) return void this.rlLater.push(look);
              this.rlLoaded.add(look);
              if (i === 0 && this.rlLater) this.rlUpcoming.add(look);
              void this.view.characters.preload({ look });
            });
          }
          if (ev.e === "spawn" && ev.l) this.relook(ev.s, ev.l);
          else if (ev.e === "spawn" && this.rouletteHud && ev.s === this.slot && this.local) this.local.scale = this.sizeOf(this.slot);
          if (ev.e === "spawn" && this.rouletteHud && ev.s === this.slot) this.rouletteHud.spawned(this.looks.get(this.slot) ?? ev.l ?? "", ev.j);
          if (ev.e === "rl" && ev.a === "swap" && ev.s !== void 0 && ev.l) this.relook(ev.s, ev.l);
          if (ev.e === "rl") this.rouletteHud?.event(ev);
          if (ev.e === "awards" || ev.e === "callout") this.awardsHud?.event(ev);
          if (ev.e === "kill") this.streakMoment(ev, posesNow);
          if (document.hidden && VISUAL_EVENTS.has(ev.e)) continue;
          if (!document.hidden) this.sfx.event(ev, posesNow, performance.now());
          this.modeHud?.event(ev);
          if (ev.e === "hurt") this.hurtMoment(ev);
          if (ev.e === "shot") {
            const def = CORE_WEAPONS[ev.w];
            const mine = ev.s === this.slot;
            const eye = { x: ev.from[0], y: ev.from[1], z: ev.from[2] };
            const muzzle = mine ? null : this.view.muzzleOf(ev.s);
            const color = def?.view.tracer ?? "#ffd36b";
            const strength = Math.min(2.5, Math.max(0.6, ((ev.alt ? def?.alt?.damage : void 0) ?? def?.damage ?? 20) / 25));
            if (def?.grapple) {
              const t = ev.to[0];
              const slot = ev.s;
              const muzzleNow = () => mine ? this.view.localMuzzle() ?? this.view.muzzleOf(slot) : this.view.muzzleOf(slot);
              if (t) this.view.addRope(muzzleNow, { x: eye.x, y: eye.y - 0.25, z: eye.z }, { x: t[0], y: t[1], z: t[2] }, color, 0.025, 450);
              continue;
            }
            const flying = new Set(ev.fl ?? []);
            ev.to.forEach((t, i) => {
              const to = { x: t[0], y: t[1], z: t[2] };
              if (flying.has(i)) {
                if (!mine && ev.v && this.local) {
                  const d = { x: to.x - eye.x, y: to.y - eye.y, z: to.z - eye.z };
                  const len = Math.hypot(d.x, d.y, d.z) || 1;
                  const physics = this.local.physics;
                  const flight = traceBullet(eye, { x: d.x / len, y: d.y / len, z: d.z / len }, { speed: ev.v, gravity: ev.g ?? 0, drag: 0 }, def?.range ?? 300, (o, dir, l) => physics.raycastHit(o, dir, l)?.dist ?? null);
                  this.view.shotVisual({ eye, muzzle, to: flight.end, color, victim: null, zone: 0, strength, def, speed: ev.v, land: false });
                }
                return;
              }
              const wet = this.view.scenario.liquids.fx.shot(eye, to);
              if (wet) this.view.surfaceAccent("water", wet);
              if (def) this.view.hitFx(to, def);
              const victim = ev.hit[i] ?? null;
              const zone = ev.z?.[i] ?? 0;
              if (victim === this.slot) {
                this.hurtFrom = { x: eye.x, z: eye.z, at: performance.now() };
                this.lastHitBy = { slot: ev.s, from: eye, at: performance.now() };
              }
              if (victim !== null) {
                const d = { x: to.x - eye.x, y: to.y - eye.y, z: to.z - eye.z };
                const len = Math.hypot(d.x, d.y, d.z) || 1;
                this.view.pushPlayer(victim, { x: d.x / len * 1.4 * strength, y: zone === 1 ? 0.8 : 0.4, z: d.z / len * 1.4 * strength });
                this.view.flinchPlayer(victim, d, zone, Math.max(strength, def ? stoppingPower(def) * 2.2 : 0));
              }
              if (mine) {
                const dist = Math.hypot(to.x - eye.x, to.y - eye.y, to.z - eye.z);
                if (victim !== null) window.setTimeout(() => this.view.landRound({ eye, to, victim, zone, strength }), Math.max(0, dist / (ev.v ?? BULLET_SPEED) * 1e3 - 40));
                return;
              }
              this.view.shotVisual({ eye, muzzle, to, color, victim, zone, strength, def, slot: ev.s, ...ev.v ? { speed: ev.v } : {} });
            });
            for (const p of ev.pn ?? []) this.view.landRound({ eye, to: { x: p[0], y: p[1], z: p[2] }, victim: null, zone: 0, strength });
            if (mine) {
              this.hitFeedback(ev.hit, ev.z, !!ev.ar);
            } else {
              this.view.avatarAction(ev.s, "shoot");
              if (def && (def.kind !== "melee" || ev.alt)) this.view.remoteFlash(ev.s, def, !!ev.alt);
            }
          } else if (ev.e === "impact") {
            const def = CORE_WEAPONS[ev.w];
            const mine = ev.s === this.slot;
            const from = { x: ev.from[0], y: ev.from[1], z: ev.from[2] };
            const to = { x: ev.to[0], y: ev.to[1], z: ev.to[2] };
            const strength = Math.min(2.5, Math.max(0.6, (def?.damage ?? 20) / 25));
            const zone = ev.z ?? 0;
            if (ev.hit === this.slot) this.hurtFrom = { x: from.x, z: from.z, at: performance.now() };
            if (ev.hit !== null) {
              const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
              const len = Math.hypot(d.x, d.y, d.z) || 1;
              this.view.pushPlayer(ev.hit, { x: d.x / len * 1.4 * strength, y: zone === 1 ? 0.8 : 0.4, z: d.z / len * 1.4 * strength });
              this.view.flinchPlayer(ev.hit, d, zone, Math.max(strength, def ? stoppingPower(def) * 2.2 : 0));
            }
            for (const p of ev.pn ?? []) this.view.landRound({ eye: from, to: { x: p[0], y: p[1], z: p[2] }, victim: null, zone: 0, strength });
            if (!ev.gone && (ev.hit !== null || !mine)) this.view.landRound({ eye: from, to, victim: ev.hit, zone, strength });
            if (mine) this.hitFeedback([ev.hit], [zone], !!ev.ar);
          } else if (ev.e === "melee") {
            if (ev.s === this.slot && ev.hit !== null) this.hud.hit();
            if (ev.s !== this.slot) this.view.avatarAction(ev.s, ev.u === 2 ? "kick" : ev.u === 1 ? this.nextPunch(ev.s) : "melee");
            const at = ev.hit !== null ? this.view.chestOf(ev.hit) : null;
            const from = this.view.chestOf(ev.s) ?? (ev.s === this.slot ? this.view.cameraPosition() : null);
            if (at && from) {
              const d = { x: at.x - from.x, z: at.z - from.z };
              const len = Math.hypot(d.x, d.z) || 1;
              const dir = { x: d.x / len, y: 0.1, z: d.z / len };
              if (!ev.u) this.view.blood.hit(at, dir, 1.4);
              this.view.hitFx(at, "melee");
              this.view.pushPlayer(ev.hit, { x: dir.x * 4, y: 1.5, z: dir.z * 4 });
              this.view.flinchPlayer(ev.hit, dir, ev.u === 1 ? 1 : 0, ev.u === 1 ? 1 : 1.8);
            }
          } else if (ev.e === "knock") {
            if (ev.s === this.slot) this.hud.hit();
          } else if (ev.e === "arc") {
            const glow = ev.m !== void 0 ? this.mounts?.mounts.get(ev.m)?.def.glow : void 0;
            const source = ev.m !== void 0 ? "mount" : ev.s < 0 ? "fence" : "default";
            this.view.addArc(ev.pts.map((p) => ({ x: p[0], y: p[1], z: p[2] })), glow, source, ev.m !== void 0 ? `m${ev.m}` : ev.s >= 0 ? `s${ev.s}` : void 0);
          } else if (ev.e === "explode") {
            this.hurtFrom = { x: ev.p[0], z: ev.p[2], at: performance.now() };
            const at = { x: ev.p[0], y: ev.p[1], z: ev.p[2] };
            if (ev.m !== void 0) this.view.vehicleExplosion(at, ev.r);
            else this.view.explosion(at, ev.r, ev.w);
            this.view.blast(at, ev.r);
            const cam = this.view.cameraPosition();
            const reach = ev.r * (ev.m !== void 0 ? 6 : 3.5);
            const near = 1 - Math.hypot(cam.x - at.x, cam.y - at.y, cam.z - at.z) / reach;
            if (near > 0) this.view.shake(near * (ev.m !== void 0 ? 0.95 : 0.6));
          } else if (ev.e === "crash") {
            const at = { x: ev.p[0], y: ev.p[1], z: ev.p[2] };
            this.view.impacts.sparkBurst(at, Math.round(6 + ev.n * 18), 2 + ev.n * 5);
            const cam = this.view.cameraPosition();
            const near = 1 - Math.hypot(cam.x - at.x, cam.y - at.y, cam.z - at.z) / 12;
            if (near > 0) this.view.shake(near * ev.n * 0.6);
          } else if (ev.e === "resupply") {
            if (ev.s === this.slot) this.hud.pickup(ev.ok ? `Resupplied (${ev.left} left)` : ev.left > 0 ? "Nothing to resupply yet" : "Out of supplies");
            const at = ev.ok ? this.view.chestOf(ev.s) : null;
            if (at) this.view.playGameplayFx("pickup.ammo", at, { size: this.view.farSize(at) });
          } else if (ev.e === "pickup") {
            if (ev.s === this.slot) this.hud.pickup(getItem(ev.item)?.displayName ?? "Item");
            if (ev.s === this.slot && getItem(ev.item)?.effect.kind === "armor") this.tips?.trigger("armor", performance.now() / 1e3);
            const at = this.view.chestOf(ev.s);
            if (at) this.view.playGameplayFx(`pickup.${getItem(ev.item)?.effect.kind ?? "item"}`, at, { size: this.view.farSize(at) });
          } else if (ev.e === "kill") {
            this.hud.kill(ev.killer, ev.victim, ev.weapon, this.slot, !!ev.hs, !!ev.tk);
            if (ev.victim === this.slot && ev.killer !== null && ev.killer !== this.slot && this.local && msg.phase === "playing") this.startKillCam(ev.killer, ev.weapon);
            if (ev.killer === this.slot && ev.victim !== this.slot && !ev.tk) {
              const t = performance.now();
              this.killTimes = [...this.killTimes.filter((k) => t - k < MULTI_KILL_MS), t];
              this.hud.killConfirm(this.killTimes.length);
            }
            const at = this.view.chestOf(ev.victim);
            if (at) this.view.blood.kill(at);
            if (at && ev.hs) this.view.blood.hit({ x: at.x, y: at.y + 0.55, z: at.z }, { x: 0, y: 0.6, z: 0 }, 2.2);
            if (ev.hs && !ev.tk && ev.killer === this.slot) this.hud.headshot();
          } else if (ev.e === "round_end") {
            if (ev.outcome === "victory") this.chainOn(ev.next);
            if (!this.travel && !ev.next && !this.openVote()) void this.rotateOn();
            this.hud.nextMap = ev.up ? nextMapLine(ev.up.map, ev.up.mode) : "";
            this.winner = ev.team !== void 0 ? this.hud.teamById(ev.team)?.name ?? null : ev.winner === null ? null : this.hud.name(ev.winner);
            this.outcome = ev.outcome ?? null;
          } else if (ev.e === "round_start") {
            this.outcome = null;
            this.hud.nextMap = "";
            if (this.voteHud?.open) this.voteMessage(null);
            this.view.clearCorpses();
            this.npcInfo.clear();
          } else if (ev.e === "say") {
            const mine = this.hud.team(this.slot)?.id;
            if (!ev.team || !mine || ev.team === mine) this.hud.say(ev.s, QUICK_MESSAGES[ev.m - 1] ?? "");
          } else if (ev.e === "squad") {
            this.squadEvent(ev);
          } else if (ev.e === "ping") {
            const mine = this.hud.team(this.slot)?.id;
            if (ev.team ? ev.team === mine : ev.s === this.slot) {
              this.pings = this.pings.filter((p) => p.from !== ev.s);
              this.pings.push({ id: this.nextPingId++, at: { x: ev.p[0], y: ev.p[1], z: ev.p[2] }, ...ev.t !== void 0 ? { target: ev.t } : {}, until: performance.now() + (ev.t !== void 0 ? 4e3 : 6e3), from: ev.s });
              if (ev.s !== this.slot) this.hud.say(ev.s, ev.t !== void 0 ? "Enemy here!" : "Look here!");
            }
          } else if (ev.e === "streak") {
            const reward = STREAK_REWARDS[ev.r];
            if (reward) {
              const mine = this.hud.team(this.slot)?.id;
              const ally = ev.s === this.slot || !!mine && this.hud.team(ev.s)?.id === mine;
              if (ev.s === this.slot) this.hud.showMessage(`${reward.name}! ${reward.kills} kill streak`, 3);
              else this.hud.say(ev.s, `${reward.name} (${reward.kills} kill streak)${ally ? "" : " — enemy"}`);
            }
          } else if (ev.e === "heal") {
            if (ev.t === this.slot) this.hud.pickup(ev.s === this.slot ? `+${ev.n} health` : `${this.hud.name(ev.s)} healed you +${ev.n}`);
            else if (ev.s === this.slot) this.hud.pickup(`Healed ${this.hud.name(ev.t)} +${ev.n}`);
          } else if (ev.e === "msg") {
            if (ev.s === void 0 || ev.s === this.slot) this.hud.showMessage(ev.text, ev.secs);
          } else if (ev.e === "obj") {
            this.objectiveChanged.set(ev.i, performance.now());
          } else if (ev.e === "trap" && !ev.warn) {
            const e = this.map?.entities[ev.i];
            if (e?.kind === "trap") this.view.playGameplayFx(`trap.${e.trap}`, { x: e.position[0], y: e.position[1] + 0.3, z: e.position[2] });
          } else if (ev.e === "broken") {
            const e = this.map?.entities[ev.i];
            const pane = this.view.scenario.glass.paneAt(ev.i) ?? (this.map ? glassAt(this.map, ev.i) : null);
            if (pane) {
              this.view.glassShards(pane.box, pane.tint ?? "#d4eef2");
            } else if (e?.kind === "destructible") {
              const spec = DESTRUCTIBLE_SPECS[e.model];
              const h = spec.half;
              const colors = { crate: "#8a5d33", barrel: "#9c2f22", glass: "#bfe6f5", boards: "#7a5430", gas: "#d8d8d0", generator: "#5a6066" };
              this.view.debris({ x: e.position[0], y: e.position[1] + (spec.lift ?? 0) + h.y, z: e.position[2] }, colors[e.model] ?? "#8d8c86", Math.max(h.x, h.y));
            } else if (e?.kind === "prop") {
              const def = getProp(e.model);
              this.view.breakProp(ev.i);
              if (def) this.view.debris({ x: e.position[0], y: e.position[1] + def.size[1] * e.scale / 2, z: e.position[2] }, propBreakLook(e.model, def.breakable?.debris).debris, Math.max(0.3, Math.min(1.2, Math.max(...def.size) * e.scale / 2)));
            }
          } else if (ev.e === "leader") {
            const team = this.hud.teamById(ev.team);
            if (ev.a === "lead" && ev.s === this.slot) this.hud.showMessage('You lead your team: B then 1 "Follow me!" or 7 "Hold here!" orders all its bots', 5);
            else if (ev.a === "lead") this.hud.say(ev.s, `leads ${team?.name ?? "the team"}`);
            else this.hud.say(ev.s, `${team?.name ?? "Team"} leader down!${ev.n ? ` (+${ev.n} to the other side)` : ""}`);
          } else if (ev.e === "takeover") {
            this.hud.takeover(ev.s, ev.to, ev.from, !!ev.bot);
          } else if (ev.e === "throw") {
            if (ev.s !== this.slot) this.view.avatarAction(ev.s, "throw");
          }
        }
        break;
      }
      case "host":
        if (msg.state || !this.hostPanel.controlling) {
          this.hostState = msg.state;
          this.hostPanel.setState(msg.state);
          $(this.hostPanel.controlling ? "pause-host-slot" : "pause-admin-slot").append(this.hostPanel.root);
          if (this.hostPanel.controlling) this.hostPanel.root.open = true;
          this.pauseMenu.setTabVisible("host", this.opts.transport instanceof LocalTransport || this.hostPanel.controlling);
        }
        if (msg.error) {
          this.hostPanel.setStatus(msg.error, true);
          this.hud.showMessage(msg.error, 3);
        } else if (msg.state) this.hostPanel.setStatus("");
        break;
      case "notice":
        this.hud.note(msg.text);
        this.hud.showMessage(msg.text, 4);
        break;
      case "vote":
        this.voteMessage(msg.v === null ? null : parseVoteState(msg.v));
        break;
      case "travel":
        this.travel = { map: msg.map };
        this.hud.showMessage(`Next map: ${msg.map}`, 3);
        this.exit("travel");
        break;
      case "stats":
        this.serverStats = msg;
        this.noteIfSlow(msg);
        break;
      case "pings":
        this.hud.setPings(msg.p);
        break;
      case "rules":
        if (this.rules && msg.rules.mode === this.rules.mode) {
          const before = this.map ? weaponSetInPlay(this.rules, this.map)?.id : void 0;
          this.rules = msg.rules;
          this.view.keepBodies = msg.rules.mode === "core.zombies";
          if (this.map && weaponSetInPlay(msg.rules, this.map)?.id !== before) {
            this.view.setWeaponSetLook(weaponSetInPlay(msg.rules, this.map)?.id);
            this.loadSetGuns();
          }
          if (this.map) this.applyWeather(msg.rules, this.map);
        }
        break;
    }
  }
  /**
   * Load what the match needs before saying we're ready: everyone's characters
   * (players and bots, from the roster), the weapon models we start with and
   * can pick up, mounted guns and vehicles, and the scene's textures and
   * shaders. The server holds the countdown until every player is ready (or
   * gives up waiting), so nobody starts while others still load.
   */
  async prepareMatch() {
    const map = this.map;
    const rules = this.rules;
    if (!map || !rules) return;
    for (let i = 0; i < 40 && this.looks.size === 0; i++) await new Promise((r) => setTimeout(r, 50));
    const jobs = [];
    for (const look2 of /* @__PURE__ */ new Set([...this.looks.values(), ...this.rlUpcoming])) jobs.push(this.view.characters.preload({ look: look2 }));
    jobs.push(this.view.characters.preload({ npc: { color: "#888888", scale: 1, female: true } }));
    const zombies = rules.mode === "core.zombies" || map.entities.some((e) => e.kind === "encounter" && (e.roster?.zombie ?? 0) > 0);
    if (zombies) for (const look2 of ZOMBIE_LOOKS) jobs.push(this.view.characters.preload({ look: look2 }));
    for (const role of NPC_ROLES) {
      const look2 = NPC_ROLE_SPECS[role].look;
      if (look2 && map.entities.some((e) => e.kind === "encounter" && (e.roster?.[role] ?? 0) > 0)) jobs.push(this.view.characters.preload({ look: look2 }));
    }
    const models = /* @__PURE__ */ new Set();
    const set = weaponSetInPlay(rules, map);
    const spawnGuns = set ? setSpawnWeapons(set, rules) : rules.startingWeapons;
    for (const id of spawnGuns) models.add(getWeapon(id).view.model);
    for (const id of set ? setWeaponsInPlay(set, rules) ?? [] : []) models.add(getWeapon(id).view.model);
    for (const id of spawnGuns) {
      const held = heldModel(getWeapon(id), this.view.atmosphere.quality);
      if (held) jobs.push(this.view.models.load(held).catch(() => void 0));
    }
    const thrown = /* @__PURE__ */ new Set();
    const look = set?.id;
    const first = rules.startingGrenades > 0 ? throwableModel(set && setThrowables(set)?.[0] || "frag", look) : null;
    if (first) thrown.add(first);
    for (const e of map.entities) {
      if (e.kind !== "pickup") continue;
      const item = getItem(e.item);
      if (item?.effect.kind !== "throwable") continue;
      for (const it of setPickupPool(set, e, !!rules.mixPickups) ?? [item]) {
        const model = it.effect.kind === "throwable" ? throwableModel(it.effect.throwable, look) : null;
        if (model) thrown.add(model);
      }
    }
    for (const m of thrown) models.add(m);
    for (const e of map.entities) {
      if (e.kind === "pickup") {
        if (isAmmoBoxPickup(e)) models.add(AMMO_BOX_MODEL);
        const fx = getItem(e.item)?.effect;
        const pool = setPickupPool(set, e, !!rules.mixPickups);
        if (fx?.kind === "weapon" && !pool) models.add(getWeapon(fx.weapon).view.model);
        for (const item of pool ?? []) if (item.effect.kind === "weapon") models.add(getWeapon(item.effect.weapon).view.model);
      }
      if (e.kind === "mount") {
        const def = getMountDef(e.model);
        if (def) models.add(def.model);
        if (def?.wheels) models.add(def.wheels.model);
      }
      if (e.kind === "airplane") models.add(airCraftDef(e.craft).model);
    }
    for (const m of models) jobs.push(this.view.models.load(m).catch(() => void 0));
    const looks = [.../* @__PURE__ */ new Set([...this.looks.values(), ...this.rlUpcoming, ...zombies ? ZOMBIE_LOOKS : []])].map((look2) => ({ look: look2 }));
    const guns = [...models].filter((m) => WEAPONS_BY_SLOT.some((w) => w.view.model === m) || thrown.has(m));
    let started = false;
    let filesIn = () => {
    };
    const loaded = new Promise((r) => filesIn = r);
    const warm = this.view.prewarm(looks, guns, () => !started && !this.closed, () => filesIn());
    jobs.push(Promise.race([warm, Promise.race([loaded, new Promise((r) => setTimeout(r, 2e4))]).then(() => new Promise((r) => setTimeout(r, 8e3)))]));
    let done = 0;
    const total = jobs.length + 2;
    const tick = () => void (started || this.hud.setLoading(`Loading ${map.metadata.name}`, ++done / total));
    this.hud.setLoading(`Loading ${map.metadata.name}`, 0);
    const all = Promise.all([...jobs.map((j) => j.then(tick, tick)), this.view.scene.whenReadyAsync().then(tick, tick), this.view.city.ready.then(tick, tick)]);
    await Promise.race([all, new Promise((r) => setTimeout(r, 25e3))]);
    started = true;
    if (this.closed) return;
    for (const look2 of this.rlLater ?? []) {
      if (this.rlLoaded.has(look2)) continue;
      this.rlLoaded.add(look2);
      void this.view.characters.preload({ look: look2 });
    }
    this.rlLater = null;
    this.hud.setLoading(null);
    this.opts.transport.sendReady();
  }
  /** The weapon set's guns (a host switched sets mid-match), loaded in the background. */
  /** The match's weather (the host's choice, else the map's), drawn and heard; set again only when it changed. */
  applyWeather(rules, map) {
    const w = matchWeather(rules, map);
    const key = JSON.stringify(w);
    if (key === this.weatherKey) return;
    this.weatherKey = key;
    this.view.setWeather(w);
  }
  loadSetGuns() {
    const map = this.map;
    const rules = this.rules;
    const set = map && rules ? weaponSetInPlay(rules, map) : null;
    for (const id of set && rules ? setWeaponsInPlay(set, rules) ?? [] : []) void this.view.models.load(getWeapon(id).view.model).catch(() => void 0);
  }
  /** Everyone on one side against NPCs (co-op missions and Zombies). */
  get allied() {
    return this.rules?.mode === "core.coop" || this.rules?.mode === "core.zombies";
  }
  /** Zombies: the wave and how many are left (or the countdown to the next wave) under the mode name. */
  zombieHud(zb) {
    if (!zb) return;
    const [wave, left, wait, best] = zb;
    const record = best > wave ? ` · best ${best}` : "";
    this.hud.setModeLabel(wave === 0 ? `Zombies · first wave in ${wait}s` : wait > 0 ? `Zombies · wave ${wave + 1} in ${wait}s${record}` : `Zombies · wave ${wave} · ${left} left${record}`);
  }
  /** Classes: which classes are at the limit on your side (the server refuses them). */
  classesFull() {
    const limit = this.rules?.classLimit ?? 0;
    const mine = this.hud.team(this.slot)?.id;
    return CLASS_IDS.map((_, i) => {
      if (!limit || this.myClass?.[0] === i) return false;
      let n = 0;
      for (const [slot, cl] of this.classOf) if (slot !== this.slot && cl === i && (!mine || this.hud.team(slot)?.id === mine)) n++;
      return n >= limit;
    });
  }
  /** Your class and its ability (G), and a power disc you hold, for the HUD. */
  classStatusLines() {
    const out = [];
    const disc = this.myDisc;
    if (disc) out.push({ text: `${DISC_POWER_LABELS[DISC_POWERS[disc[0]] ?? "fast"].toUpperCase()} ×${disc[1]}`, color: "#5ff2ff" });
    const cl = this.myClass;
    if (!cl) return out;
    const def = CLASS_DEFS[CLASS_IDS[cl[0]] ?? "rocketeer"];
    const pct2 = cl[2];
    const active = cl[3] === 1;
    let ability = "";
    if (def.ability === "sentry") ability = this.mounts?.mounts.get(BUILT_MOUNT_BASE + this.slot)?.alive ? "SENTRY UP" : pct2 >= 100 ? "SENTRY READY (G)" : `SENTRY ${pct2}%`;
    else if (def.ability === "overcharge") ability = active ? "OVERCHARGED" : pct2 >= 100 ? "OVERCHARGE READY (G)" : `OVERCHARGE ${pct2}%`;
    else if (def.ability === "cloak") ability = active ? `CLOAKED ${pct2}%` : `CLOAK ${pct2}% (G)`;
    const next = cl[1] !== cl[0] ? ` → ${CLASS_DEFS[CLASS_IDS[cl[1]] ?? "rocketeer"].name.toUpperCase()} NEXT` : "";
    out.push({ text: `${def.name.toUpperCase()}${ability ? ` · ${ability}` : ""}${next}`, color: active ? "#ffd24a" : "#cfe8ff" });
    return out;
  }
  npcLook(id) {
    const info = this.npcInfo.get(id);
    if (!info || !this.map) return void 0;
    const faction = mapFactions(this.map)[info.faction];
    const role = NPC_ROLES[info.role] ?? "trooper";
    if (role === "zombie") return { color: "#76866a", scale: info.size, size: info.size, label: "Zombie", zombie: true, look: zombieLook(id) };
    const spec = NPC_ROLE_SPECS[role];
    return { color: faction?.color ?? "#d04a3a", scale: spec.scale * info.size, size: info.size, label: `${faction?.name ?? "Enemy"} ${spec.label}`, ...isCreature(role) ? { creature: role } : {}, ...spec.look ? { look: spec.look } : {} };
  }
  /** Objectives, timers, the Use prompt and the objective marker. */
  updateScenarioHud(local, now) {
    const map = this.map;
    const sc = this.scenario;
    if (!map || !sc) return;
    const objectives = map.logic.objectives.flatMap((o, i) => {
      const state = OBJECTIVE_STATES[sc.objectives[i] ?? 0];
      if (state === "active") return [{ text: o.text, state: "active" }];
      if (state === "complete" || state === "failed") {
        const age = now - (this.objectiveChanged.get(i) ?? -Infinity);
        if (age < 5e3) return [{ text: o.text, state: age < 4e3 ? state : "gone" }];
      }
      return [];
    });
    this.hud.setObjectives(objectives);
    this.hud.setTimers(sc.timers.map((t) => {
      const left = sc.timerLeft(t, now);
      return `${map.logic.timers[t[0]]?.name ?? "Timer"} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    }));
    const myTeam = this.hud.team(this.slot)?.id ?? (this.rules?.mode === "core.coop" ? "players" : null);
    const target = local.alive ? pickUsable(map, local.eye, this.input.yaw, this.input.pitch, (i) => sc.usable(i, myTeam)) : null;
    const e = target === null ? void 0 : map.entities[target];
    const box = local.alive && !this.seat ? this.ammoBoxes?.inReach(local.state.pos) ?? null : null;
    const supply = local.alive && !this.seat && !box ? this.mounts?.resupplyInReach(local.state.pos) ?? null : null;
    const enter = local.alive && !this.seat && !supply && !box ? this.mounts?.enterable(local.state.pos) : null;
    let full = null;
    if (local.alive && this.seat) {
      const m = this.mounts?.mounts.get(this.seat[0]);
      const hint = m && m.def.kind === "vehicle" && !m.def.airplane && VehicleCamera.drives(m.def, this.seat[1]) ? { key: "H", text: this.vehicleCam.viewFor(m.def) === "cockpit" ? "Chase camera" : "Cockpit view" } : void 0;
      this.hud.setPrompt(m?.def.airplane ? "Jump out (E or Space), then Space to open your parachute" : `Get out of the ${m?.def.displayName ?? "vehicle"}`, false, hint);
    } else if (local.alive && local.state.zip !== void 0) {
      const two = local.weapon && !oneHanded(local.weapon);
      this.hud.setPrompt(two ? "Zipline: Space or E to let go (sidearm or blade to shoot)" : "Zipline: Space or E to let go");
    } else if (local.alive && !this.seat && !enter && local.ziplines.length && grabZipline(local.ziplines, local.state.pos, this.input.yaw, local.team())) {
      this.hud.setPrompt("Grab the zipline");
    } else if (box) {
      this.hud.setPrompt(`Resupply from the ammo box (${box.uses} left)`);
    } else if (supply) {
      this.hud.setPrompt(supply.supply > 0 ? `Resupply from the ${supply.def.displayName} (${supply.supply} left)` : `The ${supply.def.displayName} is out of supplies`, supply.supply <= 0);
    } else if (enter) {
      const seat = enter.mount.def.seats[enter.seat];
      const verb = seat.role === "driver" ? enter.mount.def.kind === "vehicle" ? "Drive" : "Use" : seat.role === "gunner" ? "Man the gun on" : "Ride in";
      this.hud.setPrompt(`${verb} the ${enter.mount.def.displayName}`);
    } else if (local.alive && !this.seat && (full = this.mounts?.fullInReach(local.state.pos) ?? null)) {
      this.hud.setPrompt(`The ${full.def.displayName} is full`, true);
    } else if (local.alive && !local.state.grounded && !local.state.chute && local.state.velY < -3 && local.jetFuel === null && heightAboveGround(local.physics, local.state.pos, CHUTE.minHeight) === null) {
      this.hud.setPrompt(local.glider ? "Open your glider (Space)" : "Open your parachute (Space)");
    } else if (local.state.chute) this.hud.setPrompt(local.state.chute === CHUTE_GLIDER ? "Gliding: W faster, S slower, crouch to let go" : "Parachute: steer with WASD, crouch to cut away");
    else if (e?.kind === "button") this.hud.setPrompt(sc.state(target)?.[0] === 0 ? "Not working" : e.label || "Press", sc.state(target)?.[0] === 0);
    else if (e?.kind === "door") {
      const [open, locked] = sc.state(target) ?? [0, 0];
      this.hud.setPrompt(locked ? "Locked" : open > 50 ? "Close" : "Open", locked === 1);
    } else this.hud.setPrompt(null);
    const marked = map.logic.objectives.find((o, i) => o.marker && OBJECTIVE_STATES[sc.objectives[i] ?? 0] === "active");
    const markerEntity = marked ? map.entities.find((m) => m.id === marked.marker) : void 0;
    if (markerEntity && local.alive) {
      const p = { x: markerEntity.position[0], y: markerEntity.position[1] + 1.6, z: markerEntity.position[2] };
      const screen2 = this.view.project(p);
      const eye = local.eye;
      this.hud.setMarker(screen2 && { ...screen2, dist: Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z) });
    } else this.hud.setMarker(null);
  }
  /**
   * You died to `killer`: the kill cam turns to them from by your body, for KILL_CAM_SECONDS or until you
   * respawn (a delay just past that stretches it to the respawn); with a long delay (or none: Elimination)
   * you then watch.
   */
  startKillCam(killer, weapon) {
    this.local;
    const now = performance.now();
    const hit = this.lastHitBy && this.lastHitBy.slot === killer && now - this.lastHitBy.at < 3e3 ? this.lastHitBy.from : null;
    const delay = (this.rules?.respawnDelayTicks ?? 0) / TICK_RATE;
    const seconds = Math.max(KILL_CAM_SECONDS, delay > 0 && delay <= KILL_CAM_SECONDS + 1 ? delay + 0.5 : 0);
    this.specCam.startKillCam({ killer, weapon, body: this.drawnPos, from: hit, yaw: this.input.yaw, pitch: this.input.pitch, seconds });
  }
  /**
   * The camera while out of play (dead, or spectating by choice): the kill cam, then following someone you
   * may watch (spectateRule) or the free camera. Returns the pose set, or null when there is nothing to
   * watch (the view stays where you fell).
   */
  spectatorCamera(now, local, fov, picks) {
    const cast = (o, d, len) => local.physics.raycastWorld(o, d, len);
    const poses = this.interp.sample(now);
    if (this.mounts) this.riderPlacement.place(poses, this.mounts.seatedRiders(), (i, o) => this.view.seatPoint(i, o), 0);
    const rule = this.spectateRule();
    const kc = this.spectator ? null : this.specCam.killCam();
    if (kc) {
      if (picks.step || picks.toggle) {
        this.specCam.endKillCam();
        picks = { step: 0, toggle: false };
      } else {
        const k = poses.find((p) => p.slot === kc.killer);
        const pose2 = this.specCam.killCamPose(now, k ? { x: k.x, y: k.y + 1.3, z: k.z } : null, cast);
        this.view.setCamera(pose2.pos, pose2.yaw, pose2.pitch, fov);
        const hp = this.hp.get(kc.killer);
        this.hud.setKillCam({ name: this.hud.name(kc.killer), color: kc.killer >= NPC_ID_BASE ? "#e74c3c" : this.hud.team(kc.killer)?.color ?? slotColor(kc.killer), weapon: kc.weapon, hp: k?.alive === false ? 0 : hp === void 0 ? null : Math.round(hp * PLAYER.maxHealth) });
        this.hud.setSpectating(null);
        return pose2;
      }
    }
    this.hud.setKillCam(null);
    const list = followable(poses, this.slot, rule, (s) => this.hud.team(s)?.id, NPC_ID_BASE);
    const hint = (free) => [free ? "WASD fly · E/Q up and down · Shift faster" : list.length > 1 ? "Click or ←/→: next player" : "", rule.freeCam ? `Space: ${free ? "follow players" : "free camera"}` : "", this.spectator ? "J: join the game" : ""].filter(Boolean).join(" · ");
    if (picks.toggle && rule.freeCam) {
      const from = this.view.cameraPosition();
      if (!this.specCam.free) {
        this.input.yaw = this.view.camera.rotation.y;
        this.input.pitch = -this.view.camera.rotation.x;
      }
      this.specCam.setFree(!this.specCam.free, from);
    }
    if (!list.length && rule.freeCam && !this.specCam.free) this.specCam.setFree(true, this.view.cameraPosition());
    if (!rule.freeCam && this.specCam.free) this.specCam.setFree(false, this.view.cameraPosition());
    const at = this.specCam.freeAt;
    if (this.specCam.free && at) {
      const pose2 = { pos: at, yaw: this.input.yaw, pitch: this.input.pitch };
      this.view.setCamera(at, pose2.yaw, pose2.pitch, fov);
      this.hud.setSpectating("Free camera", hint(true));
      return pose2;
    }
    this.specCam.cycle(picks.step, list);
    const watch = this.specCam.target(list);
    if (!watch) {
      this.hud.setSpectating(rule.teamOnly ? "No teammates left to watch" : "Nobody to watch", this.spectator ? "J: join the game" : "");
      return null;
    }
    const pose = this.specCam.followPose(watch, cast);
    this.view.setCamera(pose.pos, pose.yaw, pose.pitch, fov);
    this.hud.setSpectating(`Watching ${this.hud.name(watch.slot)}`, hint(false));
    return pose;
  }
  /** "STREAK 4 · Supply Pulse at 5", while streaks are on and you have one. */
  streakLabel() {
    if (!this.streak || this.rules?.killstreaks === false) return "";
    const next = STREAK_REWARDS.find((r) => r.kills > this.streak);
    return `STREAK ${this.streak}${next ? ` · ${next.name} at ${next.kills}` : ""}`;
  }
  /** Team pings as screen markers (or edge arrows), following a pinged enemy while they're seen. */
  updatePings(local, poses, now) {
    this.pings = this.pings.filter((p) => p.until > now);
    const eye = local.eye;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const list = [];
    for (const p of this.pings) {
      const pose = p.target !== void 0 ? poses.find((q) => q.slot === p.target && q.alive) : void 0;
      const at = pose ? { x: pose.x, y: pose.y + 2.2, z: pose.z } : { x: p.at.x, y: p.at.y + 0.6, z: p.at.z };
      const enemy = p.target !== void 0;
      const color = enemy ? "#ff3b3b" : "#ffd24a";
      const label = `${p.from === this.slot ? "" : `${this.hud.name(p.from)} · `}${Math.round(Math.hypot(at.x - eye.x, at.y - eye.y, at.z - eye.z))} m`;
      const screen2 = this.view.project(at);
      if (screen2 && screen2.x > 30 && screen2.x < w - 30 && screen2.y > 60 && screen2.y < h - 30) list.push({ id: `ping${p.id}`, x: screen2.x, y: screen2.y, color, icon: enemy ? "◆" : "●", label });
      else {
        const bearing = Math.atan2(at.x - eye.x, at.z - eye.z) - this.input.yaw;
        const a = Math.atan2(Math.sin(bearing), Math.cos(bearing));
        list.push({ id: `ping${p.id}`, x: w / 2 + Math.sin(a) * (w / 2 - 70), y: h / 2 - Math.cos(a) * (h / 2 - 70), color, icon: enemy ? "◆" : "●", label, edge: a });
      }
    }
    this.hud.setPingMarkers(list);
  }
  /** The turret you are gunning (its gun turns with your view), or null. */
  mannedTurret() {
    const m = this.seat ? this.mounts?.mounts.get(this.seat[0]) : void 0;
    return m?.def.kind === "turret" ? m.index : null;
  }
  /**
   * The weapon wheel, once a frame: open while the input holds it (alive, on foot), showing
   * what you carry; when it closes with a pick, switch to it (as a number key would).
   */
  updateWheel(local, building) {
    const input = this.input;
    input.canOpenWheel = local.alive && !this.seat && !building && local.inventory.size > 0;
    if (input.wheelOpen && input.wheelKind === "weapon" && !input.canOpenWheel) input.closeWheel(false);
    if (input.wheelOpen && input.wheelKind === "weapon") {
      this.wheel.show(wheelEntries(local.ownedCodes(), local.inventory, this.wantWeapon || local.held));
      this.wheel.aim(input.wheelAim.x, input.wheelAim.y);
    }
    const closed = input.takeWheelClose();
    if (closed === null && (input.wheelOpen && input.wheelKind === "weapon" || !this.wheel.shown)) return;
    const pick = this.wheel.hide();
    if (closed && pick && local.inventory.has(pick) && pick !== (this.wantWeapon || local.held)) this.requestWeapon(pick);
  }
  /**
   * Fireteams' order wheel, once a frame: it may open while you lead a squad, alive and on foot; open, it shows the
   * six orders (your squad's current one ringed; Defend the objective dimmed where the mode has none); let go on one
   * and it goes to the match (fireteams.ts orderSay), which checks it.
   */
  updateOrderWheel(local) {
    const input = this.input;
    input.ordersOn = this.squadLed !== null && local.alive && !this.seat && !this.spectator;
    if (input.wheelOpen && input.wheelKind === "order" && !input.ordersOn) input.closeWheel(false);
    if (input.wheelOpen && input.wheelKind === "order") {
      const noObjective = this.rules?.mode === "core.tdm";
      const spacing = this.squadHud.current?.spacing ?? "normal";
      const spaceName = (k) => k === "spacing" ? spacingLabel(spacing) : ORDER_LABELS[k];
      const spaceHint = (k) => k === "spacing" ? nextSpacing(spacing) === "spread" ? "Further apart" : "Closer together" : ORDER_HINTS[k];
      this.orderWheel.show(ORDER_KINDS.map((k, i) => ({ code: i + 1, name: spaceName(k), ammo: spaceHint(k), empty: k === "defend" && noObjective, held: k === this.squadOrder, weaponId: "" })));
      this.orderWheel.aim(input.wheelAim.x, input.wheelAim.y);
    }
    const closed = input.takeOrderClose();
    if (closed === null && (input.wheelOpen && input.wheelKind === "order" || !this.orderWheel.shown)) return;
    const pick = this.orderWheel.hide();
    const kind = pick ? ORDER_KINDS[pick - 1] : void 0;
    if (closed && kind) input.queueSay(orderSay(kind));
  }
  /** Fireteams' news (the 'squad' event): leading a squad, its orders (the HUD's line), the bots' answers, a refusal. */
  squadEvent(ev) {
    const mine = this.hud.team(this.slot)?.id;
    if (ev.team && mine && ev.team !== mine) return;
    const kind = ev.k !== void 0 ? ORDER_KINDS[ev.k] : void 0;
    if (ev.a === "lead") {
      if (ev.s === this.slot) {
        const first = this.squadLed === null;
        this.squadLed = ev.sq ?? null;
        this.squadOrder = "follow";
        if (first) this.hud.showMessage(`You lead a fireteam of ${ev.n ?? 0} · hold B for orders`, 4);
      } else if (ev.from === this.slot) this.squadLed = this.squadOrder = null;
    } else if (ev.a === "order" && kind) {
      if (ev.s === this.slot && kind !== "spacing") {
        this.squadLed = ev.sq ?? this.squadLed;
        this.squadOrder = kind;
      }
      const said = kind === "spacing" ? spacingLabel(SQUAD_SPACINGS[ev.n ?? 0] === "spread" ? "normal" : "spread") : ORDER_LABELS[kind];
      if (!ev.auto && ev.s !== this.slot) this.hud.say(ev.s, `${said}!`);
    } else if (ev.a === "ack" && kind) this.hud.say(ev.s, kind === "spacing" ? SPACING_ACKS[SQUAD_SPACINGS[ev.n ?? 0] ?? "spread"] : ORDER_ACKS[kind]);
    else if (ev.a === "deny" && ev.s === this.slot) this.hud.showMessage(REFUSAL_TEXT[REFUSALS[ev.n ?? 0] ?? "notLeader"], 2.5);
  }
  /**
   * Fireteams' squad HUD (Part 2), once a snapshot: your squad from the snapshot's squads (`fs`), its order and spacing,
   * and each squadmate's portrait and health.
   */
  squadSnapshot(fs, players) {
    for (const p of players) this.alive.set(p.s, p.alive === 1);
    const mine = this.squadHud.read(fs, this.slot);
    if (mine && mine.leader === this.slot && mine.order !== "spacing") this.squadOrder = mine.order;
    this.squadHud.update(this.slot, (slot) => ({ slot, name: this.hud.name(slot), look: this.looks.get(slot), hp: this.hp.get(slot) ?? 1, alive: this.alive.get(slot) ?? true }));
  }
  /** Who is alive, by slot, as the last snapshot had them (the squad HUD's cards). */
  alive = /* @__PURE__ */ new Map();
  requestWeapon(slot) {
    const current = this.wantWeapon || this.local?.held || 0;
    if (slot !== current) this.lastWeapon = current;
    this.wantWeapon = slot;
  }
  /** Advance prediction at a fixed 60 Hz and render one frame. */
  /** The tutorial (opts.tutorial) and the first-time tips (opts.tips): coachHud.ts draws both. */
  coach = null;
  tutorial = null;
  tips = null;
  /** Gathered over a frame's ticks for the tutorial: rounds fired, and those fired aiming. */
  coachShots = 0;
  coachAimed = 0;
  coachMoving = false;
  coachThrowables = -1;
  coachAlive = false;
  coachPickups = null;
  setUpCoach() {
    const tutorial = !!this.opts.tutorial;
    if (tutorial) this.hud.showScorebar(false);
    if (tutorial) this.tutorial = new Tutorial();
    if (this.opts.tips !== false && !tutorial) this.tips = new TipBook();
    if (!this.tutorial && !this.tips) return;
    this.coach = new CoachHud($("hud"), isTouchDevice(), tutorial ? { onSkip: () => this.skipTutorial() } : null);
    if (this.tips) window.__tips = { current: () => this.tips?.current ?? null, trigger: (id) => this.tips?.trigger(id, performance.now() / 1e3) };
    if (!tutorial) return;
    const skip = document.createElement("button");
    skip.id = "pause-skip-tutorial";
    skip.textContent = "Skip tutorial";
    skip.title = "Leave the tutorial and go back to the main menu (it won't be offered again; the main menu has it any time)";
    skip.addEventListener("click", () => this.skipTutorial(), { signal: this.abort.signal });
    $("resume").after(skip);
    window.__tutorial = { state: () => ({ index: this.tutorial?.index ?? -1, step: this.tutorial?.step?.id ?? null, progress: this.tutorial?.progress ?? 0, done: !!this.tutorial?.done }), goTo: (i) => this.tutorial?.goTo(i), skip: () => this.skipTutorial() };
  }
  /** Skip (the card, the pause menu): the tutorial counts as seen, and you go back to the main menu. */
  skipTutorial() {
    if (!this.tutorial) return;
    setTutorialState(this.tutorial.done ? "done" : "skipped");
    this.exit();
  }
  /** Each frame: the tutorial's step from what you did, the tips' situations, and their HUD. */
  coachFrame(local, now, dt, ride, driving) {
    if (!this.coach) return;
    const t = now / 1e3;
    const shots = this.coachShots;
    const aimed = this.coachAimed;
    const moving = this.coachMoving;
    this.coachShots = this.coachAimed = 0;
    this.coachMoving = false;
    const count = local.alive ? local.throwable?.count ?? 0 : -1;
    const thrown = this.coachThrowables > 0 && count >= 0 && count < this.coachThrowables && local.alive ? this.coachThrowables - count : 0;
    this.coachThrowables = count;
    const died = this.coachAlive && !local.alive && this.phase === "playing";
    this.coachAlive = local.alive;
    if (this.tutorial) {
      const at = driving && ride ? ride.shown.pos : local.state.pos;
      const advanced = this.tutorial.update({
        dt,
        alive: local.alive,
        x: at.x,
        z: at.z,
        yaw: this.input.yaw,
        pitch: this.input.pitch,
        moving,
        sprinting: !!local.state.sprint,
        stance: local.state.stance ?? 0,
        shots,
        aimedShots: aimed,
        reloading: local.reloadTicks > 0 || !!local.reload,
        held: local.held,
        thrown,
        driving
      });
      if (advanced && this.tutorial.done) setTutorialState("done");
      this.coach.tutorial(this.tutorial, advanced, t);
      if (this.tutorial.step?.id === "drive" && !this.seat && local.alive && this.mounts) {
        let best = null;
        let bestD = Infinity;
        for (const m of this.mounts.mounts.values()) {
          if (!m.alive || m.def.kind !== "vehicle") continue;
          const d = Math.hypot(m.shown.pos.x - local.state.pos.x, m.shown.pos.z - local.state.pos.z);
          if (d < bestD) [best, bestD] = [m.shown.pos, d];
        }
        if (best) {
          const p = { x: best.x, y: best.y + 2.2, z: best.z };
          const eye = local.eye;
          const w = innerWidth;
          const h = innerHeight;
          let screen2 = this.view.project(p);
          if (!screen2 || screen2.x < 40 || screen2.x > w - 40 || screen2.y < 40 || screen2.y > h - 40) {
            const right = (p.x - eye.x) * Math.cos(this.input.yaw) - (p.z - eye.z) * Math.sin(this.input.yaw);
            screen2 = { x: right >= 0 ? w * 0.78 : w * 0.22, y: h * 0.5 };
          }
          this.hud.setMarker({ ...screen2, dist: Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z) });
        }
      }
    }
    const tips = this.tips;
    if (!tips) return;
    if (tips.enabled && this.phase === "playing") {
      if (died) tips.trigger("death", t);
      if (local.alive && !this.seat) {
        const w = local.weapon;
        const ammo = local.inventory.get(local.held);
        if (w?.magazine && ammo && ammo[0] <= Math.max(1, Math.floor(w.magazine * 0.25)) && ammo[1] > 0 && local.reloadTicks === 0) tips.trigger("reload", t);
        const enter = this.mounts?.enterable(local.state.pos);
        if (enter && enter.mount.def.kind === "vehicle") tips.trigger("vehicle", t);
        this.coachPickups ??= (this.map?.entities ?? []).filter((e) => e.kind === "pickup").map((e) => ({ x: e.position[0], z: e.position[2] }));
        const fx = Math.sin(this.input.yaw);
        const fz = Math.cos(this.input.yaw);
        for (const p of this.coachPickups) {
          const dx = p.x - local.state.pos.x;
          const dz = p.z - local.state.pos.z;
          const d = Math.hypot(dx, dz);
          if (d > 1 && d < 8 && (dx * fx + dz * fz) / d > 0.7) {
            tips.trigger("pickup", t);
            break;
          }
        }
      }
    }
    this.coach.setTip(tips.update(t));
  }
  frame() {
    if (this.closed) return;
    const t0 = performance.now();
    if (!$("pause").hidden) {
      this.pauseMenu.pollPad();
      this.drawPause();
    }
    const now = performance.now();
    if (perfProbe.on) {
      perfProbe.beginFrame(t0);
      perfProbe.add(SYS.hud, t0);
    }
    this.opts.transport.flush?.();
    const dt = Math.min(0.25, (now - this.last) / 1e3);
    this.frameMs = now - this.last;
    this.last = now;
    const local = this.local;
    const building = !!local && !!this.forts?.holding(local.held, local.weapon?.id);
    if (local && building) {
      const pick = this.input.takeSlotRequest();
      if (pick) this.forts.pick(pick - 1);
      const steps = this.input.takeWheel();
      if (steps) this.forts.cycle(steps);
    }
    if (local) {
      const key = this.input.takeSlotRequest();
      if (key) {
        const inSlot = local.ownedCodes().filter((code) => weaponByCode(code)?.slot === key);
        const i = inSlot.indexOf(this.wantWeapon || local.held);
        const next = inSlot[(i + 1) % inSlot.length];
        if (next) this.requestWeapon(next);
      }
      this.updateWheel(local, building);
      this.updateOrderWheel(local);
      this.touch?.update();
      const wheel = this.input.takeWheel();
      if (wheel && this.scopedNow && local.weapon?.view.zoomFov) this.zoomLevel = wheel > 0 ? 1 : 0;
      else if (wheel) {
        const owned = local.ownedCodes();
        const i = owned.indexOf(this.wantWeapon || local.held);
        const next = owned[((i + wheel) % owned.length + owned.length) % owned.length];
        if (next) this.requestWeapon(next);
      }
      if (this.spectator) local.alive = false;
      const out = this.spectator || !local.alive && this.phase === "playing";
      if (!out && this.outOfPlay) {
        this.specCam.reset();
        this.hud.setKillCam(null);
        this.hud.setSpectating(null);
      }
      this.outOfPlay = out;
      this.input.spectating = out;
      this.input.spectatingFree = out && this.specCam.free;
      this.hud.setWatching(out);
      this.touch?.setWatching(out ? { join: this.spectator } : null);
      const picks = out ? this.input.takeSpectate() : { step: 0, toggle: false, used: false };
      let watched = picks.used || picks.step !== 0 || picks.toggle;
      this.input.frame(dt);
      if (this.input.mouse.aimAssist && local.alive && !this.seat) this.aimAssist(local.eye, dt, now);
      this.acc += dt;
      let moving = false;
      const viewTick = Math.round(this.interp.renderTick(now));
      while (this.acc >= TICK_DT) {
        this.acc -= TICK_DT;
        const sample = this.input.sample();
        if (this.phase === "waiting" || this.phase === "countdown") {
          sample.forward = 0;
          sample.right = 0;
          sample.buttons = 0;
        }
        if (building && sample.buttons & BUTTON_RELOAD) {
          this.forts.rotate();
          sample.buttons &= ~BUTTON_RELOAD;
        }
        if (out) {
          const up = this.input.spectateVertical();
          if (this.specCam.moveFree(TICK_DT, sample.forward, sample.right, up, this.input.yaw, this.input.pitch, this.input.held("ShiftLeft"), this.freeBounds)) watched = true;
          if (sample.forward || sample.right || sample.buttons || up) watched = true;
          sample.forward = 0;
          sample.right = 0;
          sample.buttons = 0;
        }
        if (this.seat && local.alive) {
          const ride2 = this.mounts?.mounts.get(this.seat[0]);
          if (ride2 && this.vehicleCam.steersByLook(ride2.def, this.seat[1])) sample.buttons |= BUTTON_STEER_LOOK;
        }
        if (this.thirdPerson && !this.seat && local.alive) sample.buttons |= BUTTON_THIRD_PERSON;
        if (local.alive && autoReloadOn()) sample.buttons |= BUTTON_AUTO_RELOAD;
        moving ||= sample.forward !== 0 || sample.right !== 0;
        this.coachMoving ||= sample.forward !== 0 || sample.right !== 0;
        const before = { ...local.state.pos };
        const meleeNow = (sample.buttons & BUTTON_MELEE) !== 0;
        if (meleeNow && !this.meleeHeld && local.alive && !this.seat) this.localStrike(local.weapon, sample.forward, now);
        this.meleeHeld = meleeNow;
        const { input: cmd, shot, absorbed } = local.tick(sample, this.input.yaw, this.input.pitch, this.wantWeapon, viewTick);
        if (local.portalTurn) {
          this.input.yaw += local.portalTurn;
          local.portalTurn = 0;
        }
        if (absorbed) {
          this.input.pitch += absorbed[0];
          this.input.yaw += absorbed[1];
        }
        if (this.forts) cmd.build = this.forts.code;
        if (out) {
          if (watched || cmd.yaw !== this.sentLook.yaw || cmd.pitch !== this.sentLook.pitch) cmd.sp = 1;
          watched = false;
        }
        this.sentLook = { yaw: cmd.yaw, pitch: cmd.pitch };
        this.outbox.push(cmd);
        this.sfx.localStep(local, before, local.speedTicks > 0 ? SPEED_BOOST : 1, !!this.seat);
        const ammo = local.inventory.get(local.held);
        if (local.alive && sample.buttons & BUTTON_FIRE && ammo && ammo[0] === 0 && ammo[1] === 0 && local.weapon?.magazine) this.sfx.dryFire(now);
        if (shot) {
          this.coachShots++;
          if (this.input.zooming) this.coachAimed++;
          this.sfx.localShot(shot.def, shot.alt);
          if (!shot.alt && shot.def.kind === "hitscan" && shot.def.pellets === 1 && shot.ends[0]) {
            const e = local.eye;
            const d = { x: shot.ends[0].x - e.x, y: shot.ends[0].y - e.y, z: shot.ends[0].z - e.z };
            const len = Math.hypot(d.x, d.y, d.z);
            if (len > 0.01) this.spray.shot(shot.def.id, { x: d.x / len, y: d.y / len, z: d.z / len }, cmd.seq * 1e3 / TICK_RATE);
          }
          this.view.kick(shot.def, shot.alt);
          const muzzle = this.view.localMuzzle();
          const strength = Math.min(2.5, Math.max(0.6, ((shot.alt ? shot.def.alt?.damage : void 0) ?? shot.def.damage) / 25));
          shot.ends.forEach((end2, i) => this.view.shotVisual({ eye: local.eye, muzzle, to: end2, color: shot.def.view.tracer, victim: null, zone: 0, strength, def: shot.def, local: true, ...shot.speed ? { speed: shot.speed, time: shot.times?.[i] ?? 0, tracer: shot.tracer !== false } : {} }));
          const visual = shot.alt ? shot.def.alt?.kick?.visual ?? 0 : shot.def.kind === "melee" ? 0 : gunplayOf(shot.def).kick?.visual ?? 0;
          if (visual >= 0.8) this.view.shake(Math.min(0.25, visual * 0.15));
        }
      }
      if (netProbe.on) for (const i of this.outbox) netProbe.inputAt.set(i.seq, now);
      this.opts.transport.sendInputs(this.outbox.splice(0));
      this.sfx.localWeapon(local);
      if (!out) this.opts.audio.setListener(local.eye, this.input.yaw, this.input.pitch);
      this.mounts?.smooth(dt);
      if (this.mounts) this.view.updateMounts(this.mounts.mounts.values(), this.mannedTurret());
      const ride = local.alive && this.seat ? this.mounts?.mounts.get(this.seat[0]) : void 0;
      const seatDef = ride?.def.seats[this.seat?.[1] ?? 0];
      const gunSeat = ride && this.seat ? firingSeat(ride.def, this.seat[1], (i) => (ride.seats[i] ?? -1) >= 0 && ride.seats[i] !== this.slot) : null;
      const gunWeapon = gunSeat === null ? void 0 : ride.def.seats[gunSeat]?.weapon;
      const seatGun = gunWeapon ? CORE_WEAPONS[gunWeapon] : void 0;
      const handsBusy = !!seatDef && (seatDef.role === "driver" || !!seatDef.weapon || !!ride?.def.airplane);
      local.seatGun = seatGun ?? null;
      local.unarmed = seatDef?.role === "driver" && !seatGun || !!ride?.def.airplane;
      const weapon = local.alive && !handsBusy ? local.weapon : void 0;
      const ready = local.raiseTicks === 0 && local.reloadTicks === 0;
      const zoomed = !!weapon?.view.zoomFov && this.input.zooming && ready;
      const ads = !!weapon && !weapon.view.zoomFov && weapon.kind !== "melee" && this.input.zooming && ready;
      if (!zoomed) this.zoomLevel = 0;
      this.scopedNow = zoomed;
      const wantFov = zoomed ? weapon.view.zoomFov * (this.zoomLevel ? 0.45 : 1) : ads ? DEFAULT_FOV * ADS_FOV : DEFAULT_FOV;
      this.fov = zoomed ? wantFov : this.fov + (wantFov - this.fov) * Math.min(1, dt * 14);
      this.adsAmount += ((ads ? 1 : 0) - this.adsAmount) * Math.min(1, dt * 14);
      const fov = this.fov;
      this.input.sensitivityScale = zoomLookScale(fov, DEFAULT_FOV, DEFAULT_FOV * ADS_FOV, this.input.mouse.zoomSensitivity);
      this.view.firstPersonEye = false;
      if (ride && seatDef) {
        const seatIndex = this.seat[1];
        const feet = mountToWorld(ride.shown.pos, ride.shown.yaw, seatDef.offset);
        const body = ride.body.handle;
        const cast = (from, dir, len) => {
          let start = 0;
          for (let i = 0; i < 4; i++) {
            const o = { x: from.x + dir.x * start, y: from.y + dir.y * start, z: from.z + dir.z * start };
            const hit = local.physics.raycastHit(o, dir, len - start);
            if (!hit) return null;
            if (hit.handle !== body) return start + hit.dist;
            const exit = rayBoxExit(o, dir, { x: ride.pos.x, y: ride.pos.y + ride.def.half[1], z: ride.pos.z }, ride.def.half, ride.yaw);
            start += Math.max(hit.dist, exit ?? 0) + 0.05;
            if (start >= len) return null;
          }
          return null;
        };
        const pose = this.vehicleCam.update(
          dt,
          {
            def: ride.def,
            index: ride.index,
            seat: seatIndex,
            pos: ride.shown.pos,
            yaw: ride.shown.yaw,
            vel: ride.vel,
            tilt: this.view.mountTilt(ride.index),
            cockpitEye: this.view.mountPoint(ride.index, cockpitEye(ride.def, seatIndex)) ?? mountToWorld(ride.shown.pos, ride.shown.yaw, cockpitEye(ride.def, seatIndex)),
            levelEye: mountToWorld(ride.shown.pos, ride.shown.yaw, cockpitEye(ride.def, seatIndex)),
            // A real seat: a seated head height over the cushion (the sim's crouching eye); otherwise standing, or
            // ducked down where you stand (crouch in a standing place that isn't the wheel: Match's rideCrouch).
            seatEye: seatDef.seated ? mountToWorld(ride.shown.pos, ride.shown.yaw, cockpitEye(ride.def, seatIndex)) : { x: feet.x, y: feet.y + (this.input.crouchOn && seatDef.role !== "driver" && !ride.def.airplane ? STANCES[1].eye : PLAYER.eyeHeight), z: feet.z }
          },
          this.input,
          cast,
          fov
        );
        this.rideView = pose.mode;
        this.view.setCockpit(pose.mode === "cockpit" ? ride.index : null);
        this.view.setCamera(pose.pos, pose.yaw, pose.pitch, pose.fov, pose.roll);
      } else {
        this.vehicleCam.reset();
        this.rideView = null;
        this.view.setCockpit(null);
        const eye = local.eye;
        const offset = eye.y - local.state.pos.y;
        this.eyeOffset = this.eyeOffset === null || !local.alive ? offset : this.eyeOffset + (offset - this.eyeOffset) * Math.min(1, dt * 12);
        const drawn = local.renderPos(this.acc / TICK_DT);
        const v = dt > 0 ? Math.hypot(drawn.x - this.drawnPos.x, drawn.z - this.drawnPos.z) / dt : 0;
        this.drawnSpeed += ((v > 20 ? 0 : v) - this.drawnSpeed) * Math.min(1, dt * 10);
        this.drawnPos = drawn;
        const head = { x: drawn.x, y: drawn.y + this.eyeOffset, z: drawn.z };
        const watching = out ? this.spectatorCamera(now, local, fov, picks) : null;
        if (watching) {
          this.opts.audio.setListener(watching.pos, watching.yaw, watching.pitch);
        } else if (out) {
          this.opts.audio.setListener(local.eye, this.input.yaw, this.input.pitch);
          this.view.setCamera(head, this.input.yaw, this.input.pitch, fov);
        } else if (this.thirdPerson && local.alive) {
          const cam = thirdPersonCamera((o, d, max) => local.physics.raycastWorld(o, d, max), head, this.input.yaw, this.input.pitch);
          this.tpClose = cam.dist < 1.6;
          this.view.setCamera(cam.pos, this.input.yaw, this.input.pitch, fov);
        } else {
          const aimed = local.aimAngles(this.input.yaw, this.input.pitch);
          this.view.setCamera(head, aimed.yaw, aimed.pitch, fov, this.zipLean(local, dt, now));
          this.view.firstPersonEye = true;
        }
      }
      this.view.setViewmodel(weapon);
      if (local.inventory !== this.carriedInventory) {
        this.carriedInventory = local.inventory;
        const carried = [...local.inventory.keys()].sort((a, b) => a - b).join(",");
        if (carried !== this.carried) {
          this.carried = carried;
          this.view.trimViewmodels(new Set([...local.inventory.keys()].map((code) => weaponByCode(code)?.id).filter((id) => !!id)));
        }
      }
      const reloadFrac = weapon && local.reloadTicks > 0 ? Math.min(1, local.reloadTicks / 10, ((local.reload?.total ?? weapon.reloadTicks) - local.reloadTicks) / 10) : 0;
      this.view.updateViewmodel(dt, { moving, raise: weapon && weapon.raiseTicks ? local.raiseTicks / weapon.raiseTicks : 0, reload: reloadFrac, hidden: zoomed || this.thirdPerson && !ride || this.rideView === "chase", ads: this.adsAmount, speed: this.drawnSpeed });
      this.hud.setScope(zoomed);
      this.hud.setAds(this.thirdPerson ? 0 : this.adsAmount);
      this.updateScopeSway(dt, zoomed);
      this.hud.setHealth(local.health, local.armor, local.alive);
      const lost = this.lastHealth + this.lastArmor - local.health - local.armor;
      if (local.alive && lost > 0) {
        const from = this.hurtFrom && performance.now() - this.hurtFrom.at < 400 ? this.hurtFrom : null;
        const pos = local.state.pos;
        const dir = from && Math.hypot(from.x - pos.x, from.z - pos.z) > 0.5 ? Math.atan2(from.x - pos.x, from.z - pos.z) - this.input.yaw : null;
        this.hud.hurt(dir, lost);
      }
      this.lastHealth = local.health;
      this.lastArmor = local.armor;
      this.hud.setStamina(local.state.stamina ?? 1, !!local.state.winded, local.alive, this.seat ? 0 : local.state.stance ?? 0);
      this.hud.setGunnerReticle(seatGun && this.seat ? this.seat[2] : null);
      if (seatGun && this.seat) this.hud.setMountedGun(seatGun.displayName, this.seat[2], this.seat[3], gunSeat === null ? void 0 : ride?.def.seats[gunSeat]?.ammo?.max);
      else this.hud.setWeapons(local.inventory, local.held, local.reloadTicks > 0, local.alive, handsBusy);
      this.hud.setThrowable(local.throwable, local.alive);
      const aiming = this.input.throwAiming && local.alive && local.throwable && !handsBusy ? local.throwable.kind : null;
      if (aiming) {
        const spec = THROWABLE_DEFS[aiming].projectile;
        const path = predictThrow(spec, local.state.pos, this.input.yaw, this.input.pitch, 0.12, (o, d, len) => this.view.raycastLevel(o, d, len));
        this.view.throwArc.show(path, spec.mine?.triggerRadius ?? (spec.splashRadius || spec.zone?.radius || 0));
      } else this.view.throwArc.hide();
      this.view.setThrowHold(aiming && !this.thirdPerson ? aiming : null);
      this.input.altTrigger = !!local.weapon?.alt && local.weapon.kind === "melee";
      this.hud.setMessageMenu(this.input.msgMenu && this.rules?.emotes !== false, QUICK_MESSAGES);
      this.hud.setClassMenu(this.classesOn && this.input.classMenu, this.classesOn ? { current: this.myClass?.[0] ?? null, next: this.myClass?.[1] ?? null, full: this.classesFull(), pick: (i) => this.input.chooseClass(i) } : null);
      this.hud.setStatusLines(this.classStatusLines());
      this.hud.setPowerups(local.speedTicks / TICK_RATE, local.damageTicks / TICK_RATE, local.jetFuel === null ? null : local.jetFuel / JET.max, this.uav, this.jam, this.streakLabel());
      this.hud.setStatus(this.phase, this.timeLeft, local.alive || this.spectator, this.winner, this.outcome);
      this.rouletteHud?.frame(now);
      this.updateScenarioHud(local, now);
      this.coachFrame(local, now, dt, ride, !!ride && seatDef?.role === "driver" && ride.def.kind === "vehicle");
    }
    if (this.scenario) {
      this.view.scenario.apply(this.scenario.entities);
      if (this.scenario.movers.defs.length && this.local) {
        const tick = this.local.predTick - 1 + this.acc / TICK_DT;
        this.view.scenario.applyMovers(this.scenario.movers, tick);
        this.view.applyMoverProps(this.scenario.movers, tick);
      }
      this.view.applyPropStates(this.scenario.entities);
    }
    this.view.updatePickups(this.taken, now, this.pickupItems);
    this.view.updateDrops(this.drops);
    const shells = this.interp.sampleProjectiles(now);
    this.view.updateProjectiles(shells);
    this.view.updateZones(this.zones, now);
    if (this.mounts) {
      const manned = this.seat ? this.mounts.mounts.get(this.seat[0]) : void 0;
      this.hud.setVehicle(manned?.alive ? { name: manned.def.displayName, pct: manned.health, burning: manned.def.kind === "vehicle" && mountDamageState(manned.health / 100, manned.burning) === "burning" } : null);
      const cam = this.view.cameraPosition();
      const bars = [];
      for (const m of this.mounts.mounts.values()) {
        if (!m.alive || m.health >= 100 || m === manned) continue;
        const top = { x: m.shown.pos.x, y: m.shown.pos.y + m.def.half[1] * 2 + 0.6, z: m.shown.pos.z };
        if (Math.hypot(top.x - cam.x, top.y - cam.y, top.z - cam.z) > 50) continue;
        const at = this.view.project(top);
        if (at) bars.push({ id: m.index, x: at.x, y: at.y, pct: m.health });
      }
      this.hud.setVehicleBars(bars);
      if (!document.hidden) this.sfx.engines(this.mounts.mounts.values(), manned?.alive ? manned.index : null, cam);
      if (!document.hidden) this.weatherSound.update(this.view.weather.current, this.view.weather.stats.shelter, performance.now());
      if (!local) this.view.updateMounts(this.mounts.mounts.values(), this.mannedTurret());
    }
    this.hud.setStatusTint(statusColor(this.local?.alive ? this.localStatus : 0));
    this.hud.tickHurt();
    this.hud.tickHeavy();
    const poses = this.interp.sample(now);
    if (this.mounts) this.riderPlacement.place(poses, this.mounts.seatedRiders(), (i, o) => this.view.seatPoint(i, o), dt);
    this.view.scenario.liquids.fx.track(poses, shells);
    this.modeHud?.frame(poses, local?.alive ? local.eye : null, this.input.yaw, now);
    this.forts?.frame(local?.alive ? local.eye : null, this.input.yaw, this.input.pitch, !!local?.alive && building, poses.filter((p) => p.slot !== this.slot), local?.alive ? local.state.pos : null);
    const mine = local?.alive && !this.seat ? poses.find((p) => p.slot === this.slot) : void 0;
    if (mine && local) Object.assign(mine, { x: this.drawnPos.x, y: this.drawnPos.y, z: this.drawnPos.z, yaw: this.input.yaw, pitch: this.input.pitch, stance: local.state.stance ?? 0, grounded: local.state.grounded, weapon: local.held, chute: local.state.chute ?? 0, sprinting: !!local.state.sprint, zip: local.state.zip, zipSpeed: Math.abs(local.state.zv ?? 0) });
    const bodyDrawn = ownBodyDrawn({ alive: !!local?.alive, seated: !!this.seat, rideView: this.rideView, thirdPerson: this.thirdPerson, tpClose: this.tpClose });
    const self = bodyDrawn ? mine : void 0;
    const rider = bodyDrawn && this.seat ? poses.find((p) => p.slot === this.slot && p.alive) : void 0;
    if (rider) Object.assign(rider, { yaw: this.input.yaw, pitch: this.input.pitch });
    if (self && local) {
      const aim = thirdPersonAim((o, d, max) => local.physics.raycastWorld(o, d, max), local.eye, this.input.yaw, this.input.pitch);
      self.pitch = aim.pitch;
      self.aimYaw = angleDelta(this.input.yaw, aim.yaw);
      this.tpAim = { yaw: self.aimYaw, pitch: aim.pitch };
    }
    this.view.updateLocalCanopy(local?.alive && !self && !this.seat && local.state.chute ? this.drawnPos : null, this.input.yaw, local?.state.chute ?? 0);
    this.view.updateLocalTrolley(local?.alive && !self && !this.seat && local.state.zip !== void 0 ? this.drawnPos : null, local?.state.zip, local?.scale ?? 1);
    const hostages = this.modeHud?.hostagePoses() ?? [];
    const tAvatars = perfProbe.on ? performance.now() : 0;
    this.view.updateAvatars(
      hostages.length ? [...poses, ...hostages] : poses,
      self || rider ? -1 : this.slot,
      (id) => {
        if (id >= HOSTAGE_SLOT_BASE) return { npc: { color: "#cfc4a8", scale: 1, female: id % 2 === 1 } };
        const npc = this.npcLook(id);
        if (npc?.creature) return npc.size === 1 ? { creature: npc.creature } : { creature: npc.creature, size: npc.size };
        if (npc?.look) return npc.scale === 1 ? { look: npc.look } : { look: npc.look, size: npc.scale };
        if (npc) return { npc: { color: npc.color, scale: npc.scale, female: id % 2 === 1, ...npc.zombie ? { zombie: true } : {} } };
        const role = npcLookRole(this.looks.get(id));
        if (role && NPC_ROLE_SPECS[role].creature && isCreature(role)) return { creature: role, armed: true };
        const size = this.sizeOf(id);
        return size === 1 ? { look: this.looks.get(id) } : { look: this.looks.get(id), size };
      },
      this.phase === "intermission",
      (id) => {
        const mine2 = this.hud.team(this.slot);
        const theirs = id < NPC_ID_BASE ? this.hud.team(id) : void 0;
        if (this.squadHud.isMate(id, this.slot)) return SQUAD_COLOR;
        if (mine2 && theirs && mine2.id === theirs.id) return this.markers.ally === "team" ? mine2.color : this.markers.ally;
        if (mine2 && theirs) return this.markers.enemy;
        if (!mine2 && id < NPC_ID_BASE && this.hud.partyMate(id)) return this.hud.partyColor;
        return null;
      },
      this.mounts?.riders(),
      this.mounts?.sitters()
    );
    if (tAvatars) perfProbe.add(SYS.avatars, tAvatars);
    this.sfx.remoteSteps(poses, this.riderPlacement.placed);
    if (this.fxWatch) {
      const me = this.local;
      this.fxWatch.update(me ? [...poses.filter((p) => p.slot !== this.slot), { slot: this.slot, x: me.state.pos.x, y: me.state.pos.y, z: me.state.pos.z, alive: me.alive, grounded: me.state.grounded, ...me.state.zip !== void 0 ? { zip: me.state.zip } : {} }] : poses);
    }
    const tHud = perfProbe.on ? performance.now() : 0;
    this.hud.renderScoreboard(this.input.held("Tab") || this.phase === "intermission", this.scores, this.slot, this.phase === "intermission");
    this.hud.setTeamScore(this.scores, this.slot, this.rules?.scoreLimit ?? 0, this.allied);
    if (local) {
      const mine2 = this.hud.team(this.slot);
      const coop = this.allied;
      const shown = poses.filter((p) => p.slot !== this.slot && p.slot < NPC_ID_BASE && p.alive && (coop || mine2 && this.hud.team(p.slot)?.id === mine2.id));
      const visible = shown.map((p) => p.slot);
      const blips = shown.map((p) => ({ x: p.x, z: p.z, color: coop ? "#2ecc71" : mine2.color }));
      if (this.squadHud.current) {
        const mates = new Map(poses.map((p) => [p.slot, p]));
        for (let i = blips.length - 1; i >= 0; i--) if (this.squadHud.isMate(visible[i], this.slot)) blips.splice(i, 1);
        blips.push(...this.squadHud.blips(this.slot, (slot) => mates.get(slot) ?? null));
      }
      blips.push(...this.modeHud?.minimapBlips() ?? []);
      for (const p of this.pings) blips.push({ x: p.at.x, z: p.at.z, color: p.target !== void 0 ? "#ff3b3b" : "#ffd24a" });
      if (this.uav > 0) {
        for (const p of poses) {
          if (p.slot === this.slot || !p.alive || blips.length > 64) continue;
          const ally = p.slot < NPC_ID_BASE && (coop || mine2 && this.hud.team(p.slot)?.id === mine2.id);
          if (!ally) blips.push({ x: p.x, z: p.z, color: "#ff3b3b" });
        }
      }
      this.hud.minimap.update(local.eye.x, local.eye.z, this.input.yaw, this.jam > 0 ? [] : blips);
      if (this.bigMap && !this.bigMap.hidden) this.hud.minimap.drawWhole(this.bigMap, local.eye.x, local.eye.z, this.input.yaw, this.jam > 0 ? [] : blips);
      this.updatePings(local, poses, now);
      this.damageNumbers.update((p) => this.view.project(p), now);
      this.spray.update(local.gun, local.inputSeq * 1e3 / TICK_RATE);
    }
    this.frames++;
    if (now - this.fpsAt >= 1e3) {
      const secs = (now - this.fpsAt) / 1e3;
      this.fps = this.frames / secs;
      this.correctionsPerSec = ((local?.corrections ?? 0) - this.lastCorrections) / secs;
      this.lastCorrections = local?.corrections ?? 0;
      this.kibPerSec = (this.opts.transport.bytesIn - this.bytesInAt) / 1024 / secs;
      this.bytesInAt = this.opts.transport.bytesIn;
      this.frames = 0;
      this.fpsAt = now;
    }
    this.botDebug?.draw();
    this.hud.renderPerf(
      this.showStats,
      {
        ...this.showStats ? this.perf.lines() : {},
        renderer: this.opts.rendererKind,
        match: this.opts.transport.label,
        ...this.showStats ? {} : { fps: this.fps.toFixed(0), frame: `${this.frameMs.toFixed(1)} ms` },
        ping: `${this.opts.transport.rttMs.toFixed(0)} ms`,
        "down (client)": `${this.kibPerSec.toFixed(1)} KiB/s`,
        corrections: `${this.correctionsPerSec.toFixed(1)}/s (last ${((local?.lastCorrection ?? 0) * 100).toFixed(1)} cm)`,
        "unacked input": local?.pendingCount ?? 0,
        position: local ? `${local.state.pos.x.toFixed(1)}, ${local.state.pos.y.toFixed(1)}, ${local.state.pos.z.toFixed(1)}` : "-"
      },
      this.serverStats,
      this.botStates
    );
    this.perf.visible = this.showStats;
    if (tHud && perfProbe.on) perfProbe.add(SYS.hud, tHud);
    if (!perfProbe.on) return this.view.render();
    this.view.countDraws();
    const r0 = performance.now();
    this.view.render();
    const end = performance.now();
    perfProbe.render = end - r0;
    perfProbe.endFrame(end);
    const counts = this.view.perfCounts();
    this.perf.noteFrame(counts);
    this.recorder?.noteFrame(counts);
  }
}
function npcAsPlayer(n) {
  return { s: n[0], p: [n[1], n[2], n[3]], vy: 0, g: 1, yaw: n[4], pitch: n[5], hp: n[6], ar: 0, alive: n[9], w: n[10], pu: 0 };
}
function phoneHost() {
  try {
    return matchMedia("(pointer: coarse)").matches && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}
const ORDER_HINTS = { follow: "On you", hold: "Where you stand", go: "Where you aim or ping", attack: "The enemy you aim at or ping", defend: "The mode's objective", regroup: "To you, now", spacing: "Further apart" };
class HostLeftScreen {
  root;
  title;
  text;
  actions;
  board;
  constructor(standings) {
    document.getElementById("host-left")?.remove();
    const root = this.root = document.createElement("div");
    root.id = "host-left";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    const card2 = document.createElement("div");
    card2.className = "panel hl-card";
    this.title = document.createElement("h2");
    this.title.className = "panel-title";
    this.title.id = "hl-title";
    this.text = document.createElement("p");
    this.text.id = "hl-text";
    this.text.setAttribute("role", "status");
    const box = document.createElement("div");
    box.id = "hl-board";
    box.className = "hl-board";
    this.board = new ScoreBoard(box, { maxWidth: 620, sizeSelf: false });
    if (standings) this.board.render(standings);
    box.hidden = !standings;
    this.actions = document.createElement("div");
    this.actions.className = "hl-actions";
    card2.append(this.title, this.text, box, this.actions);
    root.append(card2);
    document.body.append(root);
  }
  /** Something is under way (reconnecting, someone taking over): no buttons yet. */
  wait(title, text) {
    this.title.textContent = title;
    this.text.textContent = text;
    this.root.dataset.state = "wait";
    this.actions.replaceChildren();
  }
  /** It's over: say so, and offer what to do next. */
  ended(title, text, actions) {
    this.title.textContent = title;
    this.text.textContent = text;
    this.root.dataset.state = "ended";
    this.actions.replaceChildren(
      ...actions.map((a) => {
        const b = document.createElement("button");
        b.id = a.id;
        b.textContent = a.label;
        if (a.primary) b.className = "primary";
        b.addEventListener("click", () => a.run(), { once: true });
        return b;
      })
    );
    this.actions.querySelector("button.primary")?.focus({ preventScroll: true });
  }
  get shown() {
    return this.root.isConnected;
  }
  hide() {
    this.root.remove();
  }
}
export {
  GameSession,
  HostLeftScreen,
  LocalTransport,
  NetTransport,
  initPhysics,
  prewarmSimWorker
};
