import { DEFAULT_RULES, TICK_RATE, isTeamMode, suggestedLimits, type HostRulesPatch, type HostState, type MatchRules, type MatchSetup } from '@tiletrigger/shared';

/**
 * The pause menu's Host tab as Match Setup (owner, 2026-11-19, "a"): the match being played read back as a setup
 * (Match Setup's own tabs edit it), and what an edited one changes: what the host applies now (players and bots,
 * the bot options, the live rules) and what needs the match to start over (everything else, a new setting too).
 */

/** Settings that change the match now (HostCommand `bots`, and the live rules); every other one waits for a restart. */
export const LIVE_KEYS: readonly (keyof MatchSetup)[] = ['bots', 'teams', 'skill', 'botStyle', 'botCast', 'botSet', 'mixPickups', 'dropWeapons', 'weaponSet'];

/** Match Setup's controls (their ids) that change the match now, for the tab's Now marks; the rest say At restart. */
export const LIVE_IDS: readonly string[] = ['arcade-bots', 'setup-teams', 'arcade-skill', 'arcade-style', 'setup-bot-types', 'arcade-botset', 'arcade-ranks', 'arcade-mix', 'arcade-weapons', 'arcade-drops'];

/** Restart-only settings the match itself can take on its restart (HostCommand `rules`, then `restart`): no reload. */
const PATCHED: readonly (keyof MatchSetup)[] = ['scoreLimit', 'minutes', 'scoreAuto', 'timeAuto', 'respawn', 'friendlyFire', 'weather', 'btSwap'];

/** The match as it plays now, as a Match Setup on `key` (its map in Match Setup's list): its rules, with the host's live settings. */
export function setupOfMatch(r: MatchRules, s: HostState, key: string): MatchSetup {
  const rlTeams = !!r.roulette && r.mode === 'core.tdm';
  const mode = rlTeams ? 'core.roulette' : r.mode;
  const base = DEFAULT_RULES[mode];
  const teams = isTeamMode(mode) && s.teams ? (s.sizes?.length === s.teams ? [...s.sizes] : Array.from({ length: s.teams }, () => s.teamSize ?? 1)) : undefined;
  const bt = mode === 'core.breakthrough';
  const score = bt ? (r.breakthroughPool ?? 1) : r.scoreLimit;
  const minutes = Math.round((bt ? (r.breakthroughSectorSeconds ?? 240) : r.timeLimitSeconds) / 60);
  // Score and time follow the size while they are what's suggested for it (as Match Setup keeps them).
  const sug = suggestedLimits(rlTeams ? 'core.tdm' : mode, teams ? teams.reduce((a, b) => a + b, 0) : s.fill, teams);
  const out: MatchSetup = { map: key, mode, bots: Math.max(0, s.fill - 1), skill: s.skill, scoreLimit: score, minutes, scoreAuto: score === sug.scoreLimit, timeAuto: minutes === sug.minutes };
  const put = <K extends keyof MatchSetup>(k: K, v: MatchSetup[K] | undefined | false, when = true) => {
    if (when && v !== undefined && v !== false) out[k] = v as MatchSetup[K];
  };
  if (teams) out.teams = teams;
  put('teamNames', r.teamNames);
  put('teamColors', r.teamColors);
  if (r.teamAssign === 'random' || r.teamAssign === 'fixed') out.assign = r.teamAssign;
  if (r.teamAssign === 'fixed') out.playerTeam = r.hostTeam ?? 0;
  put('leaders', r.leaders === 'vip' ? 'vip' : r.leaders ? 'on' : undefined);
  if (r.fireteams) {
    out.fireteams = true;
    out.squadSize = r.fireteams;
  }
  if (r.bodySizes === false) out.sizes = false;
  if (r.characterStats === false) out.stats = false;
  put('randomChars', r.randomCharacters);
  if (r.emotes === false) out.emotes = false;
  if (s.style !== 'mixed') out.botStyle = s.style;
  if (s.cast !== undefined ? s.cast !== null : r.botCast) out.botCast = [...((s.cast !== undefined ? s.cast : r.botCast) ?? [])];
  if (r.themedNames === false) out.themedNames = false;
  if (r.killstreaks === false) out.killstreaks = false;
  put('powerupsOff', r.powerupsOff?.length ? [...r.powerupsOff] : undefined);
  const rules = s.rules;
  put('mixPickups', rules ? rules.mixPickups : r.mixPickups);
  if ((rules ? rules.dropWeapons : r.dropWeapons) === false) out.dropWeapons = false;
  if (r.akimbo === false) out.akimbo = false;
  put('weaponSet', (rules ? rules.weaponSet : r.weaponSet) ?? undefined);
  put('weather', r.weather);
  if (r.squadSpawn === false) out.squadSpawn = false;
  put('gravity', r.gravity);
  if (r.fallDamage !== undefined) out.fallDamage = r.fallDamage;
  if (r.friendlyFire && r.friendlyFire !== 'off') out.friendlyFire = r.friendlyFire;
  put('spears', r.weapons === 'spears');
  put('discs', r.weapons === 'discs');
  put('classes', r.classes);
  put('classLimit', r.classLimit || undefined, !!r.classes);
  put('vehicleDamage', r.vehicleDamage === 'normal' ? undefined : r.vehicleDamage);
  put('lethality', r.lethality === 'standard' ? undefined : r.lethality);
  put('ballistics', r.ballistics === 'standard' ? undefined : r.ballistics);
  if (r.respawnDelayTicks !== base.respawnDelayTicks) out.respawn = Math.round(r.respawnDelayTicks / TICK_RATE);
  put('flagReturn', r.flagReturnSeconds !== 30 ? r.flagReturnSeconds : undefined, mode === 'core.ctf' || mode === 'core.forts');
  put('hill', r.hillSeconds !== 60 ? r.hillSeconds : undefined, mode === 'core.koth');
  if (mode === 'core.forts') {
    out.fortBuild = (r.fortBuildSeconds ?? 150) / 60;
    out.fortCombat = (r.fortCombatSeconds ?? 300) / 60;
    out.fortCycles = r.fortCycles ?? 1;
    out.fortBudget = r.fortBudget ?? 420;
  }
  put('btSwap', r.breakthroughSwap, bt);
  if (r.roulette || mode === 'core.roulette') {
    if (r.rouletteSignature === false) out.rlSignature = false;
    if (r.rouletteJackpots === false) out.rlJackpots = false;
    if (r.rouletteStreakPick === false) out.rlPick = false;
    put('rlRerolls', r.rouletteRerolls);
    put('rlSwap', r.rouletteSwapOnKill);
    put('rlVariety', r.rouletteVariety);
    put('rlTeams', rlTeams);
    if (rlTeams) out.bots = Math.max(0, (r.teamSizes ?? []).reduce((a, b) => a + b, 0) - 1);
  }
  put('botSet', !s.mapBots && s.botSet ? s.botSet : undefined);
  return out;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * What `draft` changes from `base`, by setting: `live`, applied now; `restart`, the rest (the match starts over with
 * them). A team size is live while the teams stay as many; score and time that follow the size count only when set
 * by hand. `patched`: every restart change is one the match takes on its own restart (no reload).
 */
export function setupChanges(base: MatchSetup, draft: MatchSetup): { live: (keyof MatchSetup)[]; restart: (keyof MatchSetup)[]; patched: boolean } {
  const live: (keyof MatchSetup)[] = [];
  const restart: (keyof MatchSetup)[] = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(draft)] as (keyof MatchSetup)[]);
  const modeSame = base.mode === draft.mode;
  for (const k of keys) {
    if (same(base[k], draft[k])) continue;
    // Score and time that follow the size (both sides) aren't a change of their own.
    if ((k === 'scoreLimit' && draft.scoreAuto && base.scoreAuto) || (k === 'minutes' && draft.timeAuto && base.timeAuto)) continue;
    const isLive = LIVE_KEYS.includes(k) && modeSame && (k !== 'teams' || (base.teams?.length ?? 0) === (draft.teams?.length ?? 0));
    (isLive ? live : restart).push(k);
  }
  return { live, restart, patched: restart.every((k) => PATCHED.includes(k)) };
}

/** The restart-only rules a restart takes from `next` (rulesFromSetup of the draft): score, time, respawn, friendly fire, weather, Breakthrough's. */
export function restartPatch(next: MatchRules): HostRulesPatch {
  const p: HostRulesPatch = { scoreLimit: next.scoreLimit, timeLimitSeconds: next.timeLimitSeconds, respawnDelayTicks: next.respawnDelayTicks, friendlyFire: next.friendlyFire ?? 'off', weather: next.weather ?? null };
  if (next.mode === 'core.breakthrough') {
    p.breakthroughPool = next.breakthroughPool;
    p.breakthroughSectorSeconds = next.breakthroughSectorSeconds;
    p.breakthroughSwap = !!next.breakthroughSwap;
  }
  return p;
}

/** Words for a changed setting in the Host tab's foot ("score", "spawn on teammates"); a new one by its own name. */
const WORDS: Partial<Record<keyof MatchSetup, string>> = {
  mode: 'mode', teams: 'teams', scoreLimit: 'score', minutes: 'time', scoreAuto: 'score', timeAuto: 'time', respawn: 'respawn delay', friendlyFire: 'friendly fire', squadSpawn: 'spawn on teammates', sizes: 'character sizes', stats: 'character stats', randomChars: 'random characters', killstreaks: 'kill streaks', powerupsOff: 'power-ups', mixPickups: 'mixed pickups', dropWeapons: 'weapon drops', akimbo: 'dual wielding', weaponSet: 'weapon set', botStyle: 'bot style', botCast: 'bot types', themedNames: 'themed names', botSet: 'your bots', skill: 'bot skill', bots: 'bots', fallDamage: 'fall damage', vehicleDamage: 'vehicle damage', teamNames: 'team names', teamColors: 'team colours', assign: 'your team', playerTeam: 'your team', btSwap: 'second round', fireteams: 'fireteams', squadSize: 'squad size', leaders: 'team leaders', spears: 'weapons', discs: 'weapons', classLimit: 'classes',
};
export const changeWords = (keys: readonly (keyof MatchSetup)[]): string[] => [...new Set(keys.map((k) => WORDS[k] ?? String(k).replace(/([A-Z])/g, ' $1').toLowerCase()))];
