import { BOT_DIFFICULTIES } from '../bots/profile.ts';
import type { HostRulesPatch, HostState, MatchCommand } from '../protocol.ts';
import { MAX_PLAYER_SLOTS } from './constants.ts';
import { teamCount, teamsLabel } from './hostRules.ts';
import { validateTeamSizes } from './matchSetup.ts';
import type { BotFiller, Match } from './match.ts';

/** Whoever runs the match: "Host" in a browser-hosted match, "Admin" on a dedicated server. */
export type HostTitle = 'Host' | 'Admin';

/**
 * The host's mid-match controls over one running match (pause menu → Match):
 * bot count, skill and style, restart and end. The map change itself is the
 * transport's (each one travels its own way). Shared by the dedicated server
 * and the browser match (offline, Host game), which only differ in who may
 * send the commands.
 */
export class HostControl {
  constructor(
    readonly match: Match,
    readonly bots: BotFiller,
    /** Players to keep, bots included. */
    public fill: number,
    private readonly title: HostTitle = 'Host',
  ) {}

  /** Rules changed mid-match that wait for the next restart. */
  private pending: HostRulesPatch = {};

  state(): HostState {
    const r = this.match.rules;
    const teams = teamCount(r);
    const sizes = r.teamSizes?.slice(0, teams) ?? [];
    return {
      fill: this.fill,
      teamSize: teams ? (sizes.length ? Math.max(...sizes) : Math.max(1, Math.round(this.fill / teams))) : null,
      teams,
      max: MAX_PLAYER_SLOTS,
      skill: this.bots.skill.id,
      style: r.botStyle ?? 'mixed',
      map: this.match.map.metadata.id,
      mode: r.mode,
      teamNames: this.match.teams?.map((t) => t.name) ?? [],
      teamColors: this.match.teams?.map((t) => t.color) ?? [],
      sizes: teams ? Array.from({ length: teams }, (_, i) => sizes[i] ?? Math.max(1, Math.round(this.fill / teams))) : [],
      rules: { scoreLimit: r.scoreLimit, timeLimitSeconds: r.timeLimitSeconds, friendlyFire: r.friendlyFire ?? 'off', respawnDelayTicks: r.respawnDelayTicks },
      pending: { ...this.pending },
    };
  }

  /**
   * Run a bots / restart / end command. Returns the line everyone's feed shows
   * ("Host set teams to 8v8"), or an error for the host alone.
   */
  apply(cmd: MatchCommand): { notice?: string; error?: string } {
    const who = this.title;
    if (cmd.c === 'rules') {
      const p: HostRulesPatch = {};
      const r = cmd.rules;
      if (r.scoreLimit !== undefined) p.scoreLimit = Math.max(0, Math.min(1000, Math.round(r.scoreLimit)));
      if (r.timeLimitSeconds !== undefined) p.timeLimitSeconds = Math.max(0, Math.min(7200, Math.round(r.timeLimitSeconds)));
      if (r.respawnDelayTicks !== undefined) p.respawnDelayTicks = Math.max(0, Math.min(1800, Math.round(r.respawnDelayTicks)));
      if (r.friendlyFire !== undefined) p.friendlyFire = r.friendlyFire;
      this.pending = { ...this.pending, ...p };
      // Back to what's playing now: nothing waits.
      const now = this.match.rules;
      for (const k of Object.keys(this.pending) as (keyof HostRulesPatch)[]) if ((k === 'friendlyFire' ? (now.friendlyFire ?? 'off') : now[k]) === this.pending[k]) delete this.pending[k];
      return Object.keys(p).length ? { notice: `${who} changed the rules for the next restart` } : {};
    }
    if (cmd.c === 'restart') {
      if (Object.keys(this.pending).length) {
        const p = this.pending;
        this.match.setRules({ ...p, ...(p.friendlyFire === 'off' ? { friendlyFire: undefined } : {}) });
        this.pending = {};
      }
      this.bots.rebalance(this.fill);
      this.match.restartMatch();
      return { notice: `${who} restarted the match` };
    }
    if (cmd.c === 'end') return this.match.endMatch() ? { notice: `${who} ended the match` } : { error: 'The match is not in play' };
    const lines: string[] = [];
    const teams = teamCount(this.match.rules);
    if (teams && cmd.teamSizes !== undefined) {
      const sizes = validateTeamSizes(cmd.teamSizes, this.match.rules.mode).sizes.slice(0, teams);
      while (sizes.length < teams) sizes.push(sizes[sizes.length - 1] ?? 1);
      this.match.setRules({ teamSizes: sizes });
      this.fill = sizes.reduce((a, b) => a + b, 0);
      lines.push(`teams to ${sizes.join('v')}`);
    } else if (teams && cmd.teamSize !== undefined) {
      const size = Math.max(1, Math.min(Math.floor(MAX_PLAYER_SLOTS / teams), cmd.teamSize));
      this.match.setRules({ teamSizes: Array.from({ length: teams }, () => size) });
      this.fill = size * teams;
      lines.push(`teams to ${teamsLabel(teams, size)}`);
    } else if (!teams && cmd.fill !== undefined) {
      this.fill = Math.max(1, Math.min(MAX_PLAYER_SLOTS, cmd.fill));
      const coop = this.match.rules.mode === 'core.coop' || this.match.rules.mode === 'core.zombies';
      lines.push(coop ? `the squad to ${this.fill}` : `the match to ${this.fill} players`);
    }
    const skill = cmd.skill && cmd.skill !== this.bots.skill.id ? cmd.skill : undefined;
    const style = cmd.style && cmd.style !== (this.match.rules.botStyle ?? 'mixed') ? cmd.style : undefined;
    if (skill || style) {
      this.bots.retune(BOT_DIFFICULTIES[skill ?? this.bots.skill.id], style);
      if (skill) lines.push(`bot skill to ${skill}`);
      if (style) lines.push(`bot style to ${style}`);
    }
    this.bots.rebalance(this.fill);
    if (!lines.length) return {};
    return { notice: `${who} set ${lines.join(', ')}` };
  }
}
