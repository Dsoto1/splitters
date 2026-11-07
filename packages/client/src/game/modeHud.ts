import {
  HOSTAGE_FOLLOWING,
  HOSTAGE_RESCUED,
  HOSTAGE_WAITING,
  BOMB_CARRIED,
  BOMB_DROPPED,
  BOMB_PLANTED,
  BT_IN_ATTACKERS,
  BT_IN_BOTH,
  BT_IN_DEFENDERS,
  BT_OBJ_ACTIVE,
  BT_OBJ_DONE,
  BT_OBJ_PLANTED,
  BT_OBJ_SKIPPED,
  BT_ROUND_ATTACKERS,
  BT_ROUND_PLAYING,
  FLAG_CARRIED,
  FLAG_DROPPED,
  breakthroughSectors,
  sectorLetter,
  type Faction,
  type GameEvent,
  type MapDocument,
  type ModeSnapshot,
  type SectorInfo,
  type Vec3,
} from '@tiletrigger/shared';
import { BT_COLORS, ModeVisuals } from './flagVisuals.ts';
import type { Hud } from './hud.ts';
import type { RemotePose } from './interpolation.ts';
import type { MinimapBlip } from './minimap.ts';
import type { GameView } from './view.ts';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Objective modes on the client (Capture the Flag, King of the Hill,
 * Elimination): the flags and hill in the world, team scores, the status
 * line under the scorebar, markers pointing to the objectives and the
 * announcer's lines. The session feeds it snapshots, events and frames.
 */
/** Hostages are drawn as avatars with slots from here up. */
export const HOSTAGE_SLOT_BASE = 900_000;

export class ModeHud {
  private md: ModeSnapshot | undefined;
  private readonly visuals: ModeVisuals;
  /** Breakthrough: the sectors in order, and the fall-back warning over the crosshair. */
  private readonly sectors: SectorInfo[];
  private warning: HTMLElement | null = null;

  constructor(
    private readonly hud: Hud,
    private readonly view: GameView,
    private readonly map: MapDocument,
    private readonly teams: readonly Faction[],
    readonly mode: string,
    private readonly slot: () => number,
  ) {
    this.visuals = new ModeVisuals(view.scene, map, teams, mode);
    hud.waitLabel = mode === 'core.elim' || mode === 'core.bomb' || mode === 'core.hostage' ? 'Out until the next round' : 'Respawning…';
    this.sectors = mode === 'core.breakthrough' ? breakthroughSectors(map) : [];
    if (mode === 'core.breakthrough') {
      this.warning = document.createElement('div');
      this.warning.id = 'bt-warning';
      this.warning.hidden = true;
      (document.getElementById('hud') ?? document.body).append(this.warning);
    }
  }

  /** Breakthrough: is my team attacking this round? */
  private get attacking(): boolean {
    const bt = this.md?.bt;
    return !!bt && this.teams[bt[2]]?.id === this.myTeam?.id;
  }

  /** Breakthrough: an objective's label, kind and sector, from its map entity. */
  private btObjective(i: number): { label: string; kind: 'zone' | 'target' | 'final'; sector: number } {
    const e = this.map.entities[i];
    return e?.kind === 'objective' ? { label: e.label, kind: e.objective, sector: e.sector } : { label: '?', kind: 'zone', sector: 0 };
  }

  /** Breakthrough: the objectives in play as minimap blips (labelled squares, held at the rim when far). */
  minimapBlips(): MinimapBlip[] {
    const bo = this.md?.bo;
    if (!bo) return [];
    return bo.flatMap(([i, state]) => {
      if (state !== BT_OBJ_ACTIVE && state !== BT_OBJ_PLANTED) return [];
      const e = this.map.entities[i];
      if (!e) return [];
      const o = this.btObjective(i);
      return [{ x: e.position[0], z: e.position[2], color: state === BT_OBJ_PLANTED ? '#ff4a3a' : BT_COLORS[o.kind], label: o.label }];
    });
  }

  /** Flags drawn (for tests). */
  get flagCount(): number {
    return this.visuals.flagCount;
  }

  /** Breakthrough objectives showing in the world (for tests). */
  get objectiveCount(): number {
    return this.visuals.objectiveCount;
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
    } else if (ev.e === 'hostage') {
      const rescuer = mine === this.teams[0]?.id;
      const text = ev.a === 'rescue' ? (rescuer ? 'Hostage rescued!' : 'A hostage has been rescued!') : ev.a === 'follow' ? (ev.s === me ? 'The hostage follows you: take it to a rescue zone' : rescuer ? '' : 'A hostage is being taken!') : ev.s === null && rescuer ? 'A hostage was left behind' : '';
      if (text) this.hud.showMessage(text, 2.5);
    } else if (ev.e === 'bomb') {
      const attacker = mine === this.teams[0]?.id;
      const site = ev.i !== undefined ? this.siteLabel(ev.i) : '';
      const text =
        ev.a === 'plant'
          ? attacker
            ? `Bomb planted at ${site}! Defend it`
            : `Bomb planted at ${site}! Defuse it`
          : ev.a === 'defuse'
            ? 'Bomb defused!'
            : ev.a === 'explode'
              ? 'The bomb exploded!'
              : ev.a === 'pickup'
                ? ev.s === me
                  ? 'You have the bomb: plant it at a site (E, then hold still)'
                  : attacker
                    ? `${name(ev.s)} has the bomb`
                    : ''
                : attacker
                  ? 'The bomb has been dropped!'
                  : '';
      if (text) this.hud.showMessage(text, 3);
    } else if (ev.e === 'elim') {
      if (ev.a === 'start') this.hud.showMessage(`Round ${ev.round}: fight!`, 2);
      else this.hud.showMessage(ev.team === null ? `Round ${ev.round} drawn` : ev.team === mine ? `Your team wins round ${ev.round}!` : `${this.teamName(ev.team)} win round ${ev.round}`, 3);
    } else if (ev.e === 'bt') {
      const text = this.btLine(ev, mine);
      if (text) this.hud.showMessage(text, ev.a === 'round' || ev.a === 'sector' ? 4 : 3);
    }
  }

  /** Breakthrough's announcer: the same news worded for each side. */
  private btLine(ev: Extract<GameEvent, { e: 'bt' }>, mine: string | undefined): string {
    const attacker = ev.team === mine;
    const o = ev.i !== undefined ? this.btObjective(ev.i) : null;
    const me = this.slot();
    switch (ev.a) {
      case 'capture':
        return o?.kind === 'final' ? (attacker ? `${o.label} is ours!` : `${o?.label} has fallen!`) : attacker ? `Zone ${o?.label} captured!` : `Zone ${o?.label} lost!`;
      case 'plant':
        return ev.s === me ? `Charge set on ${o?.label}: defend it!` : attacker ? `Charge planted on ${o?.label}! Defend it` : `Charge planted on ${o?.label}! Defuse it`;
      case 'defuse':
        return ev.s === me ? `You defused the charge on ${o?.label}` : attacker ? `Our charge on ${o?.label} was defused!` : `Charge on ${o?.label} defused!`;
      case 'destroy':
        return attacker ? `Target ${o?.label} destroyed!` : `We lost ${o?.label}!`;
      case 'sector': {
        const s = this.sectors[ev.n ?? 0];
        const name = s?.name ?? `Sector ${sectorLetter(ev.n ?? 0)}`;
        const last = (ev.n ?? 0) + 1 >= this.sectors.length;
        if (last) return '';
        return attacker ? `${name} taken! Push on` : `${name} lost! Fall back to the next line`;
      }
      case 'round': {
        const won = ev.team === mine;
        const breakthrough = ev.team !== null && this.teams[this.md?.bt?.[2] ?? 0]?.id === ev.team;
        return breakthrough ? (won ? 'We broke through!' : 'They broke through!') : won ? 'The line held!' : 'Our attack is spent: the line held';
      }
      case 'start':
        return `Round ${ev.n}: sides swapped. ${attacker ? 'You attack!' : 'You defend!'}`;
      case 'pool':
        if (ev.n === 0) return attacker ? 'Out of reinforcements: last stand!' : 'Their reinforcements are spent!';
        return attacker ? 'Reinforcements running low!' : '';
    }
    return '';
  }

  /** Hostages as poses to draw like players (slots from HOSTAGE_SLOT_BASE), the rescued ones gone. */
  hostagePoses(): RemotePose[] {
    return (this.md?.hg ?? []).flatMap((h, i) =>
      h[4] === HOSTAGE_RESCUED ? [] : [{ slot: HOSTAGE_SLOT_BASE + i, x: h[0], y: h[1], z: h[2], yaw: h[3], pitch: 0, alive: true, grounded: true, weapon: -1, powerups: 0, status: 0 }],
    );
  }

  private siteLabel(i: number): string {
    const e = this.map.entities[i];
    return e?.kind === 'bombsite' ? e.label : '?';
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
    if (md.hg) {
      const rescuer = mine === this.teams[0]?.id;
      const me = this.slot();
      const total = md.hg.length;
      const rescued = md.hg.filter((h) => h[4] === HOSTAGE_RESCUED).length;
      const mineLed = md.hg.filter((h) => h[4] === HOSTAGE_FOLLOWING && h[5] === me).length;
      parts.push(`<span class="ms" style="color:#3ddc84"><b>✚</b><em>Hostages: ${rescued} of ${total} rescued (${Math.max(1, Math.ceil(total / 2))} to win)${mineLed ? ` · ${mineLed} following you` : ''}</em></span>`);
      md.hg.forEach((h, i) => {
        if (h[4] === HOSTAGE_RESCUED) return;
        const at = { x: h[0], y: h[1], z: h[2] };
        if (h[4] === HOSTAGE_WAITING) mark(`hostage_${i}`, at, '#e8d8a0', 'H', rescuer ? 'Rescue (E)' : 'Guard');
        else if (!rescuer) mark(`hostage_${i}`, at, '#ff4a3a', 'H', 'Stop them');
      });
      if (rescuer && mineLed) for (const [i, e] of this.map.entities.entries()) if (e.kind === 'rescue') mark(`rescue_${i}`, { x: e.position[0], y: e.position[1], z: e.position[2] }, '#3ddc84', '✚', 'Rescue zone');
    }
    if (md.bm) {
      const [state, x, y, z, carrier, secs, progress, actor, site] = md.bm;
      const attacker = mine === this.teams[0]?.id;
      const me = this.slot();
      const at = { x, y, z };
      let word = '';
      if (state === BOMB_PLANTED) word = `Planted at ${this.siteLabel(site)} · ${secs}s`;
      else if (state === BOMB_DROPPED) word = 'Dropped';
      else if (state === BOMB_CARRIED) word = carrier === me ? 'You carry it' : attacker ? `Carried by ${escapeHtml(this.hud.name(carrier))}` : 'With the attackers';
      parts.push(`<span class="ms" data-bomb="${state}" style="color:${state === BOMB_PLANTED ? '#ff4a3a' : '#ffb03b'}"><b>✱</b><em>Bomb: ${word}</em></span>`);
      if (progress >= 0 && actor === me) parts.push(`<span class="ms" style="color:#fff"><em>${state === BOMB_PLANTED ? 'Defusing' : 'Planting'} ${progress}% — hold still</em></span>`);
      if (state === BOMB_PLANTED) mark('bomb', at, '#ff4a3a', '✱', attacker ? 'Defend' : 'Defuse');
      else if (attacker && state === BOMB_DROPPED) mark('bomb', at, '#ffb03b', '✱', 'Pick up');
      // Attackers see the sites to go to; defenders see theirs to hold.
      if (state !== BOMB_PLANTED) {
        for (const [i, e] of this.map.entities.entries()) if (e.kind === 'bombsite') mark(`site_${i}`, { x: e.position[0], y: e.position[1], z: e.position[2] }, '#ff7a2a', e.label, attacker ? (carrier === me ? 'Plant' : 'Site') : 'Guard');
      }
    }
    if (md.bt) this.btFrame(md, parts, mark, eye);
    this.hud.setModeStatus(parts.join(''));
    this.hud.setModeMarkers(markers);
  }

  /**
   * Breakthrough on the HUD: the sector strip (taken, in play, to come), the round, the attackers' reinforcements;
   * the objectives in play with their state (a zone's capture, a charge's fuse) and markers on them; your own plant or
   * defuse; and, left behind the line, the fall-back warning with its countdown.
   */
  private btFrame(md: ModeSnapshot, parts: string[], mark: (id: string, p: Vec3, color: string, icon: string, label: string) => void, eye: Vec3 | null): void {
    const [round, rounds, , active, pool, , next, outcome] = md.bt!;
    const attacking = this.attacking;
    const me = this.slot();
    const strip = this.sectors
      .map((s, i) => `<i class="bt-sec ${i < active ? 'done' : i === active ? 'on' : 'next'}" title="${escapeHtml(s.name)}">${sectorLetter(i)}</i>`)
      .join('');
    const current = this.sectors[active];
    const where = outcome !== BT_ROUND_PLAYING ? (outcome === BT_ROUND_ATTACKERS ? 'Broken through' : 'The line held') : current ? escapeHtml(current.name) : '';
    const side = attacking ? 'Attack' : 'Defend';
    parts.push(`<span class="ms bt-strip" data-bt-sector="${active}" data-bt-side="${attacking ? 'attack' : 'defend'}" style="color:${attacking ? '#ff8a3a' : '#5ab0ff'}"><b>${side}</b>${strip}<em>${where}${rounds > 1 ? ` · round ${round}/${rounds}` : ''}${next ? ` · next round in ${next}s` : ''}</em></span>`);
    parts.push(`<span class="ms bt-pool" data-bt-pool="${pool}" style="color:${pool === 0 ? '#ff4a3a' : pool < 10 ? '#ffb03b' : '#f2f2f2'}"><b>⚑</b><em>Reinforcements ${pool}</em></span>`);
    // The objectives in play.
    const near = (p: Vec3, r: number) => !!eye && Math.hypot(p.x - eye.x, p.z - eye.z) <= r && Math.abs(eye.y - 1.6 - p.y) < 2;
    let need = 0;
    let gone = 0;
    for (const [i, state, progress, extra, actor] of md.bo ?? []) {
      const o = this.btObjective(i);
      const e = this.map.entities[i];
      if (!e || o.sector !== current?.order) continue;
      if (o.kind === 'target') {
        need++;
        if (state === BT_OBJ_DONE) gone++;
      }
      if (state !== BT_OBJ_ACTIVE && state !== BT_OBJ_PLANTED && state !== BT_OBJ_DONE) continue;
      const at = { x: e.position[0], y: e.position[1], z: e.position[2] };
      const color = state === BT_OBJ_PLANTED ? '#ff4a3a' : BT_COLORS[o.kind];
      let word: string;
      if (o.kind === 'target') word = state === BT_OBJ_DONE ? 'destroyed' : state === BT_OBJ_PLANTED ? `charge ${extra}s` : 'standing';
      else if (state === BT_OBJ_DONE) word = 'captured';
      else word = `${progress}%${extra === BT_IN_BOTH ? ' · contested' : extra === BT_IN_ATTACKERS ? ' · taking' : extra === BT_IN_DEFENDERS ? ' · held' : ''}`;
      parts.push(`<span class="ms bt-obj" data-bt-obj="${escapeHtml(o.label)}" data-state="${state}" style="color:${state === BT_OBJ_DONE ? '#8a93a6' : color}"><b>${o.kind === 'target' ? '✱' : '◆'}</b><em>${escapeHtml(o.label)} ${word}</em></span>`);
      if (state === BT_OBJ_DONE) continue;
      const label = o.kind === 'target' ? (state === BT_OBJ_PLANTED ? (attacking ? 'Defend' : 'Defuse') : attacking ? 'Plant' : 'Guard') : attacking ? (o.kind === 'final' ? 'Take' : 'Capture') : 'Hold';
      mark(`bt_${i}`, at, color, o.label, label);
      if (actor === me && progress >= 0) parts.push(`<span class="ms me"><em>${state === BT_OBJ_PLANTED ? 'Defusing' : 'Planting'} ${progress}% — hold still</em></span>`);
      else if (o.kind === 'target' && near(at, (e.kind === 'objective' ? e.radius : 2) + 0.2) && ((attacking && state === BT_OBJ_ACTIVE) || (!attacking && state === BT_OBJ_PLANTED))) {
        parts.push(`<span class="ms me"><em>E: ${attacking ? 'plant a charge' : 'defuse'}, then hold still</em></span>`);
      }
    }
    if (current && need > (current.need ?? need) && outcome === BT_ROUND_PLAYING) parts.push(`<span class="ms" style="color:#ff7a5a"><em>Targets: ${gone} of ${current.need} destroyed (${need} to choose from)</em></span>`);
    // Left behind the line: the warning, then it hurts.
    const behind = md.bf?.find(([slot]) => slot === me);
    if (this.warning) {
      this.warning.hidden = !behind;
      if (behind) {
        const text = behind[1] > 0 ? `Fall back behind the line! ${behind[1]}` : 'Fall back behind the line!';
        if (this.warning.textContent !== text) this.warning.textContent = text;
        this.warning.classList.toggle('hurting', behind[1] === 0);
      }
    }
    this.hud.waitLabel = attacking && pool === 0 ? 'Out of reinforcements' : 'Respawning…';
  }

  dispose(): void {
    this.visuals.dispose();
    this.warning?.remove();
    this.hud.setModeScores(null);
    this.hud.setModeStatus('');
    this.hud.setModeMarkers([]);
    this.hud.waitLabel = 'Respawning…';
  }
}
