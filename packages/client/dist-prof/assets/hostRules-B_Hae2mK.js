import { E as mapCanRun, F as rulesForMode, I as rulesForMap, J as isTeamMode, K as fireteamMode, L as mapPlayerCaps, O as limitsScale, Q as suggestedLimits, T as MODE_LABELS, U as isTwoTeamMode, V as MAX_PLAYER_SLOTS } from "./index-BAsW2uYW.js";
const KEPT = ["teamAssign", "hostTeam", "bodySizes", "characterStats", "randomCharacters", "emotes", "botStyle", "botCast", "killstreaks", "mixPickups", "dropWeapons", "weaponSet", "weather", "squadSpawn", "friendlyFire", "weapons", "classes", "classLimit", "vehicleDamage", "gravity", "fallDamage", "lunar"];
const SAME_MODE = ["scoreLimit", "timeLimitSeconds", "respawnDelayTicks", "fortBuildSeconds", "fortCombatSeconds", "fortCycles", "fortBudget", "breakthroughPool", "breakthroughSectorSeconds", "breakthroughSwap", "roulette", "rouletteSignature", "rouletteJackpots", "rouletteStreakPick", "rouletteRerolls", "rouletteSwapOnKill", "rouletteVariety", "teamOutlines"];
const teamCount = (rules) => !isTeamMode(rules.mode) ? 0 : isTwoTeamMode(rules.mode) ? 2 : Math.max(2, rules.teamSizes?.length ?? 2);
const teamsLabel = (teams, size) => Array.from({ length: teams }, () => size).join("v");
function rulesForTravel(prev, map, fill, mode, teamSize) {
  const want = mode && mapCanRun(map, mode) ? mode : mapCanRun(map, prev.mode) ? prev.mode : null;
  const base = want ? rulesForMode(map, want) : rulesForMap(map);
  const out = { ...base };
  const put = (k) => {
    if (prev[k] !== void 0) out[k] = prev[k];
  };
  for (const k of KEPT) put(k);
  const sameMode = base.mode === prev.mode;
  if (sameMode) for (const k of SAME_MODE) put(k);
  if (prev.leaders && isTeamMode(base.mode)) out.leaders = prev.leaders;
  if (prev.fireteams && fireteamMode(base.mode)) out.fireteams = prev.fireteams;
  if (classesClash(out)) delete out.classes;
  const teams = teamCount(out);
  const most = mapPlayerCaps(map, out.mode).max;
  let players = Math.max(1, Math.min(MAX_PLAYER_SLOTS, fill, most));
  if (teams) {
    const size = Math.max(1, Math.min(Math.floor(MAX_PLAYER_SLOTS / teams), Math.floor(most / teams) || 1, teamSize ?? Math.max(1, Math.round(fill / teams))));
    out.teamSizes = Array.from({ length: teams }, () => size);
    players = size * teams;
  }
  if (!sameMode && limitsScale(base.mode)) {
    const s = suggestedLimits(base.mode, players, out.teamSizes);
    out.scoreLimit = s.scoreLimit;
    out.timeLimitSeconds = s.minutes * 60;
  }
  return { rules: out, fill: players };
}
function withPending(rules, pending) {
  if (!pending || !Object.keys(pending).length) return rules;
  const { weaponSet, weather, ...rest } = pending;
  const out = { ...rules, ...rest };
  if (weather) out.weather = weather;
  else if (weather === null) delete out.weather;
  if (pending.friendlyFire === "off") delete out.friendlyFire;
  if (weaponSet) out.weaponSet = weaponSet;
  else if (weaponSet === null) delete out.weaponSet;
  return out;
}
const classesClash = (r) => !!r.classes && !!r.weapons && r.weapons !== "normal";
const travelNotice = (name, mode) => `Changing map to ${name} (${MODE_LABELS[mode]})…`;
export {
  teamsLabel as a,
  travelNotice as b,
  rulesForTravel as r,
  teamCount as t,
  withPending as w
};
