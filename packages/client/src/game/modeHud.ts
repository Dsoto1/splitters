import { FLAG_CARRIED, FLAG_DROPPED, type Faction, type GameEvent, type MapDocument, type ModeSnapshot, type Vec3 } from '@chronosplit/shared';
import { ModeVisuals } from './flagVisuals.ts';
import type { Hud } from './hud.ts';
import type { RemotePose } from './interpolation.ts';
import type { GameView } from './view.ts';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Objective modes on the client (Capture the Flag, King of the Hill,
 * Elimination): the flags and hill in the world, team scores, the status
 * line under the scorebar, markers pointing to the objectives and the
 * announcer's lines. The session feeds it snapshots, events and frames.
 */
export class ModeHud {
  private md: ModeSnapshot | undefined;
  private readonly visuals: ModeVisuals;

  constructor(
    private readonly hud: Hud,
    private readonly view: GameView,
    private readonly map: MapDocument,
    private readonly teams: readonly Faction[],
    readonly mode: string,
    private readonly slot: () => number,
  ) {
    this.visuals = new ModeVisuals(view.scene, map, teams, mode);
    hud.waitLabel = mode === 'core.elim' ? 'Out until the next round' : 'Respawning…';
  }

  /** Flags drawn (for tests). */
  get flagCount(): number {
    return this.visuals.flagCount;
  }

  /** Latest mode state (for tests). */
  get state(): ModeSnapshot | undefined {
    return this.md;
  }

  private get myTeam(): Faction | undefined {
    return this.hud.team(this.slot());
  }

  private teamName(id: string | null): string {
    return this.teams.find((t) => t.id === id)?.name ?? 'Nobody';
  }

  snapshot(md: ModeSnapshot | undefined): void {
    if (!md) return;
    this.md = md;
    this.hud.setModeScores(md.ts);
  }

  /** Announcer lines for objective events (sounds are played by SessionAudio). */
  event(ev: GameEvent): void {
    const mine = this.myTeam?.id;
    const me = this.slot();
    const name = (s: number | null) => (s === me ? 'You' : this.hud.name(s));
    if (ev.e === 'flag') {
      const ours = ev.team === mine;
      const team = this.teamName(ev.team);
      const text =
        ev.a === 'take'
          ? ours
            ? 'Your flag has been taken!'
            : ev.s === me
              ? 'You have the flag! Take it home!'
              : `${name(ev.s)} has the ${team} flag!`
          : ev.a === 'drop'
            ? ours
              ? 'Your flag has been dropped!'
              : `The ${team} flag has been dropped!`
            : ev.a === 'return'
              ? ours
                ? 'Your flag has been returned'
                : `The ${team} flag has been returned`
              : ours
                ? `${this.teamName(this.teams.find((t) => t.id !== ev.team)?.id ?? null)} captured your flag!`
                : ev.s === me
                  ? 'You captured the flag!'
                  : 'Flag captured!';
      this.hud.showMessage(text, ev.a === 'capture' ? 3.5 : 2.5);
    } else if (ev.e === 'hill') {
      if (ev.a === 'move') this.hud.showMessage('The hill has moved!', 2.5);
      else if (ev.team !== null) this.hud.showMessage(ev.team === mine ? 'Your team holds the hill' : `${this.teamName(ev.team)} hold the hill!`, 2);
    } else if (ev.e === 'elim') {
      if (ev.a === 'start') this.hud.showMessage(`Round ${ev.round}: fight!`, 2);
      else this.hud.showMessage(ev.team === null ? `Round ${ev.round} drawn` : ev.team === mine ? `Your team wins round ${ev.round}!` : `${this.teamName(ev.team)} win round ${ev.round}`, 3);
    }
  }

  /** Per frame: world visuals, the status line and objective markers. */
  frame(poses: readonly RemotePose[], eye: Vec3 | null, yaw: number, now: number): void {
    const md = this.md;
    this.visuals.update(md, poses, this.slot(), eye ? { x: eye.x, y: eye.y - 1.6, z: eye.z } : null, now);
    if (!md) return;
    const mine = this.myTeam?.id;
    const parts: string[] = [];
    const markers: Parameters<Hud['setModeMarkers']>[0] = [];
    const mark = (id: string, p: Vec3, color: string, icon: string, label: string) => {
      if (!eye) return;
      const dist = Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z);
      const text = `${label}${label ? ' · ' : ''}${Math.round(dist)} m`;
      const screen = this.view.project({ x: p.x, y: p.y + 2.9, z: p.z });
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (screen && screen.x > 30 && screen.x < w - 30 && screen.y > 60 && screen.y < h - 30) {
        markers.push({ id, x: screen.x, y: screen.y, color, icon, label: text });
        return;
      }
      // Off screen: an arrow round the edge, pointing the way.
      const bearing = Math.atan2(p.x - eye.x, p.z - eye.z) - yaw;
      const a = Math.atan2(Math.sin(bearing), Math.cos(bearing));
      markers.push({ id, x: w / 2 + Math.sin(a) * (w / 2 - 70), y: h / 2 - Math.cos(a) * (h / 2 - 70), color, icon, label: text, edge: a });
    };
    for (const row of md.fl ?? []) {
      const [ti, state, x, y, z, carrier, secs] = row;
      const t = this.teams[ti];
      if (!t) continue;
      const ours = t.id === mine;
      const word = state === FLAG_CARRIED ? (carrier === this.slot() ? 'You have it' : `Taken · ${escapeHtml(this.hud.name(carrier))}`) : state === FLAG_DROPPED ? `Dropped · ${secs}s` : 'Home';
      const cls = `ms${state === FLAG_CARRIED ? ' taken' : ''}${carrier === this.slot() && state === FLAG_CARRIED ? ' me' : ''}`;
      parts.push(`<span class="${cls}" data-flag="${t.id}" data-state="${['home', 'taken', 'dropped'][state]}" style="color:${t.color}"><b>⚑</b><em>${escapeHtml(ours ? 'Your flag' : `${t.name} flag`)}: ${word}</em></span>`);
      // Markers: the enemy flag (go get it), your flag when it's away; your base while you carry theirs.
      const pose = state === FLAG_CARRIED ? poses.find((p) => p.slot === carrier) : undefined;
      const at = pose ? { x: pose.x, y: pose.y, z: pose.z } : { x, y, z };
      if (carrier !== this.slot() && (!ours || state !== 0)) mark(`flag_${t.id}`, at, t.color, '⚑', ours ? (state === FLAG_CARRIED ? 'Stop them' : 'Return') : state === FLAG_CARRIED ? 'Escort' : 'Take');
    }
    if (md.fl) {
      const carrying = md.fl.find((r) => r[1] === FLAG_CARRIED && r[5] === this.slot());
      const base = this.map.entities.find((e) => e.kind === 'flag' && e.team === mine);
      if (carrying && base && this.myTeam) mark('base', { x: base.position[0], y: base.position[1], z: base.position[2] }, this.myTeam.color, '⌂', 'Home');
    }
    if (md.hl) {
      const [index, holder, secs] = md.hl;
      const e = this.map.entities[index];
      const who = holder >= 0 ? this.teams[holder] : undefined;
      const color = who?.color ?? (holder === -2 ? '#ffb03b' : '#f2f2f2');
      const word = holder === -2 ? 'Contested' : who ? `${escapeHtml(who.name)} holding` : 'Nobody holding';
      parts.push(`<span class="ms" data-hill="${holder}" style="color:${color}"><b>▲</b><em>Hill: ${word}${secs ? ` · moves in ${secs}s` : ''}</em></span>`);
      if (e) mark('hill', { x: e.position[0], y: e.position[1], z: e.position[2] }, color, '▲', 'Hill');
    }
    if (md.el) {
      const [round, next, ...alive] = md.el;
      const counts = this.teams.map((t, i) => `<span style="color:${t.color}">${alive[i] ?? 0}</span>`).join(' v ');
      parts.push(`<span class="ms" data-round="${round}" style="color:#f2f2f2"><em>Round ${round} · ${next ? `next round in ${next}s` : `${counts} standing`}</em></span>`);
    }
    this.hud.setModeStatus(parts.join(''));
    this.hud.setModeMarkers(markers);
  }

  dispose(): void {
    this.visuals.dispose();
    this.hud.setModeScores(null);
    this.hud.setModeStatus('');
    this.hud.setModeMarkers([]);
    this.hud.waitLabel = 'Respawning…';
  }
}
