import { DEFAULT_PLAYBOOK, type Playbook } from './teamBrain.ts';

/**
 * Playbooks per mode (docs/BOTS.md, "Playbooks"; BOT_AI_PLAN.md Phase B item 3): the numbers each mode's bots play by,
 * as data in one place. `team` is the team brain's (groups over the trips' corridors, staging, bounds, prices,
 * interceptors: bots/teamBrain.ts); the rest are the mode's own roles (sim/modes/*Bots.ts read them).
 */
export interface CtfRoles {
  /** Defenders a team keeps by its size: [team size from, defenders], largest first (the owner: 2-3, 3 for 12+). */
  defenders: readonly (readonly [number, number])[];
  /** Attackers nearest a teammate carrying the enemy flag that escort it closely (the rest follow further back). */
  escorts: number;
  /** Bots this close to their own flag when it's in trouble drop their role to deal with it (m). */
  respond: number;
  /** An enemy this close to a flag at its base: the flag is in trouble (m). */
  threat: number;
  /** Defenders keep watch within this of their flag (m). */
  defendRadius: number;
  /** Carriers notice enemies only this close (they shoot back on the run, m). */
  carrierAwareness: number;
  /** A carrier this close to its base while its own flag is away keeps watch round the base until it's back (m). */
  carrierWait: number;
}

/**
 * Breakthrough's roles (the owner's brief for Iron Coast, docs/map-briefs/MAP_21_Iron_Coast.md; the mode is
 * `core.breakthrough`): what the mode's bot logic reads for each side. The attackers' part that is the team brain's
 * (spreading over the sector's ways, groups, bounds) is in the playbook's `team`.
 */
export interface BreakthroughRoles {
  /** Attackers: smoke before crossing open ground once the weapons have a smoke grenade (the weapons intake). */
  smoke: boolean;
  /** Attackers: a tunnel (a corridor underground) is pushed as a group, gathering at its mouth (`team` staging). */
  tunnelGroups: boolean;
  /** Defenders' shares (of a sector's defenders): manning its guns (mounted weapons), holding its trenches, sniping
   * from the crest (vantage spots high over the beach). The rest hold the sector's objective. */
  guns: number;
  trenches: number;
  crestSnipers: number;
  /** Defenders falling back early to the next line: this share of them, once the sector's capture passes `fallBackAt`
   * (0..1) or half of its defenders are down. */
  fallBack: number;
  fallBackAt: number;
}

export interface ModePlaybook {
  team: Playbook;
  ctf?: CtfRoles;
  breakthrough?: BreakthroughRoles;
}

const CTF_ROLES: CtfRoles = {
  defenders: [
    [12, 3],
    [4, 2],
    [2, 1],
  ],
  escorts: 3,
  respond: 22,
  threat: 16,
  defendRadius: 9,
  carrierAwareness: 15,
  carrierWait: 8,
};

/**
 * The team brain splits a mode's attackers over the ways only where it was measured to pay: Capture the Flag on trips
 * of 180 m and more (DEFAULT_PLAYBOOK); King of the Hill never (steady pressure on the hill beat gathering to retake
 * it: the side that gathered held the hill 37 s to 170 in the same matches; split over the ways, the hill was held 33 %
 * of the time against 49 % going straight). The other modes have no attack brief yet: their bots go as their mode
 * sends them, by the side's priced corridors when they head for the enemy on their own.
 */
const STRAIGHT: Playbook = { ...DEFAULT_PLAYBOOK, split: 'never' };

/**
 * Breakthrough (the owner, for Iron Coast): the attackers spread over the sector's ways on any length of trip (a main
 * push, flankers and a recon pair), bound up the beach cover to cover whatever their style (Arena's rush aside), push a
 * tunnel as a group and smoke their way across open ground once there's smoke; the defenders man the guns and the
 * trenches, snipers hold the crest, and some fall back early to the next line. Not measured yet: the mode and its map
 * are on their way (wip/breakthrough).
 */
const BREAKTHROUGH: ModePlaybook = {
  team: { ...DEFAULT_PLAYBOOK, groupsFromLength: 0, bound: 'all' },
  breakthrough: { smoke: true, tunnelGroups: true, guns: 0.25, trenches: 0.4, crestSnipers: 0.15, fallBack: 0.3, fallBackAt: 0.5 },
};

export const PLAYBOOKS: Readonly<Record<string, ModePlaybook>> = {
  'core.ctf': { team: DEFAULT_PLAYBOOK, ctf: CTF_ROLES },
  'core.forts': { team: DEFAULT_PLAYBOOK, ctf: CTF_ROLES },
  'core.koth': { team: STRAIGHT },
  'core.bomb': { team: STRAIGHT },
  'core.hostage': { team: STRAIGHT },
  'core.elim': { team: STRAIGHT },
  'core.tdm': { team: STRAIGHT },
  'core.coop': { team: STRAIGHT },
  'core.zombies': { team: STRAIGHT },
  'core.breakthrough': BREAKTHROUGH,
};

/** A mode's playbook (the default's for a mode without one of its own). */
export function playbookFor(mode: string): ModePlaybook {
  return PLAYBOOKS[mode] ?? { team: DEFAULT_PLAYBOOK };
}

/** How many of a team's Player Bots defend its flag, by the team's size (CtfRoles.defenders). */
export function ctfDefendersBy(roles: CtfRoles, teamSize: number): number {
  for (const [from, n] of roles.defenders) if (teamSize >= from) return n;
  return 0;
}
