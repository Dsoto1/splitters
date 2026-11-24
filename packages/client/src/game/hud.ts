import { WHEEL_CATEGORIES, WHEEL_CATEGORY_LABELS, type WheelCategory, wheelCategoryOf } from './wheelCategories.ts';
import { CLASS_DEFS, CLASS_IDS, CORE_WEAPONS, NPC_ID_BASE, lookBranch, nameWithoutRank, shownRank, weaponByCode, type ShownRank, type Faction, type InsigniaId, type MatchAward, type MatchPhase, type RosterEntry, type ScoreEntry, type ServerStats } from '@tiletrigger/shared';
import { slotColor } from './view.ts';
import { PARTY_COLOR, ffaPartyMate } from './ffaParty.ts';
import { applyCrosshair, applyHitmarker } from './crosshair.ts';
import { weaponIcon } from '../frontend/weaponIcons.ts';
import { Minimap } from './minimap.ts';
import { ScoreBoard, type BoardData, type BoardRow } from './scoreBoard.ts';
import { readSquads, squadGroups, squadHonours, type SquadHonours } from './squadBoard.ts';
import { HEAVY_LOOK, HURT_LOOKS, HeavyFade, HurtFade, paintVignette } from './hurtVignette.ts';
import { LOW_HEALTH_LOOK } from './lowHealth.ts';

/** The hold ring's radius and length (viewBox units). */
const HOLD_RING_R = 26;
const HOLD_RING_LEN = 2 * Math.PI * HOLD_RING_R;
import { reduceFlashing } from './reduceFlashing.ts';
import { hintKey } from './keyBindings.ts';
import { EYE_BOX, eyeBoxShade, stepScopeFade } from './scopeFeel.ts';
import { feedLines } from './feedLimit.ts';
import { insigniaSvg } from './insigniaSvg.ts';
import { teamSymbolSvg } from './teamSymbols.ts';
import { emblemSvg } from './emblemSvg.ts';
import { RankBook } from './rankBook.ts';
import { ranksOn } from './ranksSetting.ts';
import { isTouchDevice } from '../touchDevice.ts';
import { setLoadingCard, setLoadingProgress, showLoadingScreen, type LoadingCard } from '../loadingScreen.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Green when healthy, amber when hurt, red when about to go. */
const hpColor = (pct: number) => (pct > 55 ? 'var(--success)' : pct > 25 ? '#f0b429' : 'var(--danger)');

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const HAZARD_DEATHS: Record<string, string> = {
  'core.trap_spikes': 'was impaled',
  'core.trap_flames': 'was burned',
  'core.trap_crusher': 'was crushed',
  'core.trap_mine': 'stepped on a mine',
  'core.trap_laser': 'was sliced by a laser',
  'core.trap_shock': 'was electrocuted',
  'core.barrel': 'was caught in a barrel blast',
  'core.fall': 'fell',
  'core.fallback': 'was left behind the line',
  'core.respawn': 'respawned',
  'core.lava': 'melted in lava',
  'core.acid': 'dissolved in acid',
  'core.drown': 'drowned',
  'core.wreck': 'went up with a vehicle',
  'core.roadkill': 'was run over',
};
/** Kill-feed labels for things that aren't weapons (no model to draw an icon from). */
const OTHER_LABELS: Record<string, string> = { 'core.barrel': 'Barrel', 'core.wreck': '✹ Wreck', 'core.roadkill': 'Roadkill', 'core.punch': 'Punch', 'core.kick': 'Kick' };
const weaponLabel = (id: string) => CORE_WEAPONS[id]?.displayName ?? OTHER_LABELS[id] ?? '✕';

export class Hud {
  private readonly root = $('hud');
  private readonly health = $('health');
  private readonly timer = $('timer');
  private readonly countdown = $('countdown');
  private readonly loading = $('loading-screen');
  private readonly countdownInfo = $('countdown-info');
  private goUntil = 0;
  private readonly modeLabel = $('mode-label');
  private readonly sbLeft = $('sb-left');
  private readonly sbRight = $('sb-right');
  private readonly healthBar = $('health-bar');
  private readonly armorBar = $('armor-bar');
  private readonly ammoReserve = $('ammo-reserve');
  private readonly portrait = $<HTMLImageElement>('hud-portrait');
  private readonly target = $('target');
  private targetTimer?: number;
  readonly minimap = new Minimap($<HTMLCanvasElement>('minimap'));
  /** The two sides in Team Deathmatch; null in other modes. */
  private teams: readonly Faction[] | null = null;
  /** Objective modes: team scores (captures, hill seconds, rounds) in team order, replacing kill totals. */
  private modeScores: readonly number[] | null = null;
  private readonly modeStatus = $('mode-status');
  private readonly modeMarkers = $('mode-markers');
  private lastModeStatus = '';
  private lastTeamScore = '';
  private readonly feed = $('feed');
  private readonly banner = $('banner');
  private readonly scoreboard = $('scoreboard');
  private readonly board = new ScoreBoard(this.scoreboard, { maxWidth: 1240, sizeSelf: true });
  private readonly boardRows = (this.board.onRow = (slot, row) => this.onPlayerCard?.(slot, row));
  private pauseBoard: ScoreBoard | null = null;
  /** Scoreboard facts from snapshots: who is alive, team leaders, online pings. */
  private alive = new Map<number, boolean>();
  private leaders = new Set<number>();
  private pings = new Map<number, number>();
  /** The mode's per-player objective stat ('Caps', 'Bomb', 'Saves'), or null. */
  private objLabel: string | null = null;
  /** Co-op and Zombies: everyone on one side, one list. */
  private coop = false;
  private readonly perf = $('perf');
  private readonly hitmarker = $('hitmarker');
  private readonly armor = $('armor');
  private readonly weaponName = $('weapon-name');
  private readonly ammoCount = $('ammo-count');
  private readonly altEl = $('ammo-alt');
  private readonly throwEl = $('throwable');
  private readonly weaponBar = $('weapon-bar');
  /** The weapon category keys as shown on the weapon bar (Options → Controls). */
  categoryKeys: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8'];
  private readonly powerups = $('powerups');
  private readonly pickupMsg = $('pickup-msg');
  private readonly scope = $('scope');
  private readonly objectives = $('objectives');
  private readonly message = $('message');
  private readonly prompt = $('prompt');
  private readonly scTimers = $('sc-timers');
  private readonly marker = $('marker');
  private messageTimer?: number;
  private lastObjectives = '';
  private lastPrompt = '';
  private lastTimers = '';
  private pickupTimer?: number;
  private lastWeaponBar = '';
  private roster = new Map<number, RosterEntry>();
  /** Hosting online: shown in the Tab scoreboard under its title (listed or code only, players, the join code). */
  onlineNote = '';
  /** At the end of a match: where the map rotation goes next ("Next map: Diamond Park (Capture the Flag)"), on the scoreboard. */
  nextMap = '';
  private hitTimer?: number;
  /** Classes: each player's class (CLASS_IDS index), from snapshots; and lines about your own class and power disc. */
  private classes = new Map<number, number>();
  private statusLines: { text: string; color: string }[] = [];
  private lastClassMenu = '';

  show(): void {
    applyCrosshair();
    applyHitmarker();
    this.root.classList.remove('only-loading');
    this.root.hidden = false;
  }

  hide(): void {
    this.root.classList.remove('only-loading', 'ls-staged');
    this.root.hidden = true;
    this.countdownInfo.hidden = true;
  }

  /**
   * Before the match has let us in: the loading screen alone (show() brings the rest of the HUD), with the map's card
   * when it is known (Start match already showed it from the click: loadingScreen.ts).
   */
  showLoading(card: LoadingCard | null, progress = 0): void {
    showLoadingScreen(card, progress);
  }

  /** Clear per-match state left over from a previous session. */
  reset(): void {
    this.feed.replaceChildren();
    this.banner.textContent = '';
    this.timer.textContent = '';
    this.modeLabel.textContent = '';
    this.sbLeft.innerHTML = '';
    this.sbRight.innerHTML = '';
    this.lastTeamScore = '';
    this.showScorebar(true);
    this.portrait.removeAttribute('src');
    this.target.hidden = true;
    this.teams = null;
    this.modeScores = null;
    this.setModeStatus('');
    this.setModeMarkers([]);
    this.health.textContent = '';
    this.armor.textContent = '';
    this.weaponBar.innerHTML = '';
    this.lastWeaponBar = '';
    this.ammoCount.textContent = '';
    this.weaponName.textContent = '';
    this.powerups.innerHTML = '';
    this.scope.hidden = true;
    this.scopeLevel = 0;
    this.optic.hidden = true;
    this.scoreboard.hidden = true;
    this.scoreboard.parentElement?.classList.remove('sb-up');
    this.board.clear();
    this.boardOpen = false;
    this.pauseBoard?.clear();
    this.alive.clear();
    this.leaders.clear();
    this.pings.clear();
    this.objLabel = null;
    this.coop = false;
    this.objectives.replaceChildren();
    this.lastObjectives = '';
    this.message.classList.remove('on');
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
  setBoardMode(mode: string): void {
    this.objLabel = mode === 'core.ctf' || mode === 'core.forts' ? 'Caps' : mode === 'core.bomb' ? 'Bomb' : mode === 'core.hostage' ? 'Saves' : mode === 'core.breakthrough' ? 'Obj' : null;
    this.coop = mode === 'core.coop' || mode === 'core.zombies';
  }

  /** Who is alive (from a snapshot; players a big match leaves out keep their last state). */
  setLife(players: readonly { s: number; alive: 0 | 1 }[]): void {
    for (const p of players) this.alive.set(p.s, p.alive === 1);
  }

  /** Team leaders (rules.leaders), or none. */
  setLeaders(slots: readonly number[] | undefined): void {
    if (!slots?.length && !this.leaders.size) return;
    this.leaders = new Set((slots ?? []).filter((s) => s >= 0));
  }

  /** Online: each human's round trip, as flat [slot, ms, …]. */
  setPings(flat: readonly number[]): void {
    this.pings.clear();
    for (let i = 0; i + 1 < flat.length; i += 2) this.pings.set(flat[i]!, flat[i + 1]!);
  }

  /** Classes: who plays what (for the scoreboard). */
  setClasses(players: readonly { s: number; cl?: number }[]): void {
    this.classes.clear();
    for (const p of players) if (p.cl !== undefined) this.classes.set(p.s, p.cl);
  }

  /** Lines over the vitals about your class's ability or a power disc (shown with the powerups). */
  setStatusLines(lines: { text: string; color: string }[]): void {
    this.statusLines = lines;
  }

  /**
   * The class screen (Classes): every class with its keys, health and what it
   * does; your class and the one you asked for marked, full ones dimmed.
   * Clicking one picks it (when the pointer is free); so does its number key.
   */
  setClassMenu(open: boolean, menu: { current: number | null; next: number | null; full: readonly boolean[]; /** Your favourite class (Profile), marked ★; -1 for none. */ fav?: number; pick: (index: number) => void } | null): void {
    let el = document.getElementById('class-menu');
    if (!open || !menu) {
      if (el) el.hidden = true;
      this.lastClassMenu = '';
      return;
    }
    const key = `${menu.current}|${menu.next}|${menu.fav ?? -1}|${menu.full.join()}`;
    if (!el) {
      el = document.createElement('div');
      el.id = 'class-menu';
      this.root.append(el);
    }
    el.hidden = false;
    if (key === this.lastClassMenu) return;
    this.lastClassMenu = key;
    const grid = document.createElement('div');
    grid.className = 'grid';
    CLASS_IDS.forEach((id, i) => {
      const def = CLASS_DEFS[id];
      const b = document.createElement('button');
      b.className = [i === menu.current ? 'on' : '', i === menu.next && menu.next !== menu.current ? 'next' : '', menu.full[i] ? 'full' : ''].filter(Boolean).join(' ');
      b.innerHTML = `<kbd>${i + 1}</kbd><b>${escapeHtml(def.name)}</b>${i === menu.fav ? ' <span class="fav" title="Your favourite class (Profile)">★</span>' : ''} · ${def.role} · ${def.health} HP${i === menu.current ? ' · <em>playing</em>' : i === menu.next ? ' · <em>next</em>' : menu.full[i] ? ' · full' : ''}<small>${escapeHtml(def.blurb)}</small>`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.pick(i);
      });
      grid.append(b);
    });
    el.replaceChildren(Object.assign(document.createElement('b'), { textContent: 'Choose your class' }), grid, Object.assign(document.createElement('small'), { textContent: 'Number keys or click · L or , opens and closes this · a new class starts at your next spawn (straight away if you have only just spawned)' }));
  }

  /** Your own slot (the session sets it at the welcome): free-for-all parties' names (ffaParty.ts). */
  self = -1;
  /** The friendly colour your party's names wear in a free-for-all. */
  partyColor = PARTY_COLOR;

  /** A player's name colour: their team's, else (free-for-all) the friendly colour for your party, else their slot's. */
  nameColor(slot: number, self = this.self): string {
    return this.team(slot)?.color ?? (ffaPartyMate(this.roster, self, slot) ? this.partyColor : slotColor(slot));
  }

  /** Free-for-all: whether `slot` is in your party (friendly name and marker). */
  partyMate(slot: number, self = this.self): boolean {
    return ffaPartyMate(this.roster, self, slot);
  }

  /**
   * A player's rank as shown (Options → Ranks & badges; shared content/ranks.ts, rankBook.ts): their title, badge and
   * ranked name. Null with the switch off, and for NPCs and anyone not on the roster.
   */
  rank(slot: number): ShownRank | null {
    if (!ranksOn() || slot >= NPC_ID_BASE) return null;
    const p = this.roster.get(slot);
    if (!p) return null;
    // Before their first scoreboard line: step 1, or a leader's.
    const step = this.ranks?.step(slot) ?? this.leaderStep(slot);
    // Asked every frame for each marker: kept until their look, name or step changes.
    const hit = this.rankCache.get(slot);
    if (hit && hit.look === p.look && hit.name === p.name && hit.r.step === step) return hit.r;
    const r = shownRank(p.look, p.name, step);
    this.rankCache.set(slot, { look: p.look, name: p.name, r });
    return r;
  }

  /** A player's rank badge (Options → Ranks & badges), else null: the plain arrow over their head and no badge by their name. */
  insignia(slot: number): InsigniaId | null {
    return this.rank(slot)?.ins ?? null;
  }

  private readonly rankCache = new Map<number, { look: string; name: string; r: ShownRank }>();
  /** Who ranks how (rankBook.ts): made when the switch is first on. `myPoints`: your career's rank points. */
  private ranks: RankBook | null = null;
  rankPoints: () => number = () => 0;
  /** A player ranked up (from points): the session shows it over their head too (view.rankUp). */
  onRankUp: ((slot: number) => void) | null = null;

  /** A leader's least step: a team leader 4, a squad leader 3 (content/ranks.ts LEADER_STEP), else 1. */
  private leaderStep(slot: number): number {
    if (this.leaders.has(slot)) return 4;
    return this.squadLeaders().has(slot) ? 3 : 1;
  }
  private squadLeaders(): Set<number> {
    if (this.squadLeadCache?.raw !== this.squadsRaw) {
      const set = new Set<number>();
      if (this.squadsRaw) for (const q of readSquads(this.squadsRaw)) if (q.leader >= 0) set.add(q.leader);
      this.squadLeadCache = { raw: this.squadsRaw, set };
    }
    return this.squadLeadCache.set;
  }
  private squadLeadCache: { raw: readonly (readonly number[])[] | null; set: Set<number> } | null = null;

  /**
   * The scoreboard changed (every score message): ranks again, with the switch on. A rank-up's badge swells and glows
   * in the kill feed (its lines naming them) and over the head (onRankUp).
   */
  updateRanks(scores: readonly ScoreEntry[], localSlot: number): void {
    if (!ranksOn()) return;
    this.ranks ??= new RankBook(() => this.rankPoints());
    const up = this.ranks.update(this.roster, scores, localSlot, (slot) => (this.leaders.has(slot) ? 'team' : this.squadLeaders().has(slot) ? 'squad' : null));
    for (const slot of up) {
      this.feedRankUp(slot);
      this.onRankUp?.(slot);
    }
  }

  /** The kill feed's names of `slot` take their new rank, the badge swelling and glowing (style.css `.rank-up`). */
  private feedRankUp(slot: number): void {
    for (const el of this.feed.querySelectorAll<HTMLElement>(`span[data-rs="${slot}"]`)) {
      el.innerHTML = this.feedName(slot);
      el.querySelector('svg.ins')?.classList.add('rank-up', ...(reduceFlashing() ? ['calm'] : []));
    }
  }

  /** A name in the kill feed: the badge (with the switch on) and the name as shown. */
  private feedName(slot: number | null): string {
    const ins = slot === null ? null : this.insignia(slot);
    const p = slot === null ? undefined : this.roster.get(slot);
    // The team's symbol beside its colour (Colour vision: teamSymbols.ts), always.
    return `${slot === null ? '' : teamSymbolSvg(this.teamIndex(slot))}${ins ? insigniaSvg(ins) : ''}${escapeHtml(this.name(slot))}${p && !p.bot ? emblemSvg(p.em) : ''}`;
  }

  setRoster(players: RosterEntry[]): void {
    this.roster = new Map(players.map((p) => [p.slot, p]));
  }

  setTeams(teams: readonly Faction[] | null): void {
    this.teams = teams;
  }

  /** Switch team: whether you may (the host supports it, you play on a team), and the team your switch waits for (-1: none). */
  switchTeam = { can: false, pending: -1 };
  /** Switch team: the pause menu board's Join was clicked (team index). */
  onJoinTeam: ((team: number) => void) | null = null;

  /** Fireteams (Part 3): the snapshot's squads (`fs`; null: the variant is off), for the scoreboard's squads. */
  setSquads(fs: readonly (readonly number[])[] | null): void {
    this.squadsRaw = fs;
  }
  private squadsRaw: readonly (readonly number[])[] | null = null;

  /** Fireteams: the squad awards at the end of the match (each squad's MVP, the Best Squad); [] clears them. */
  setSquadAwards(aw: readonly MatchAward[]): void {
    this.honours = squadHonours(aw);
  }
  private honours: SquadHonours = { mvp: new Map(), best: null };

  teamById(id: string | null): Faction | undefined {
    return id ? this.teams?.find((t) => t.id === id) : undefined;
  }

  /** A player's team's place in the match's order (its symbol: teamSymbols.ts); -1 without a team. */
  teamIndex(slot: number): number {
    const id = this.roster.get(slot)?.team;
    return id && this.teams ? this.teams.findIndex((t) => t.id === id) : -1;
  }

  /** Team of a player slot in Team Deathmatch. */
  team(slot: number): Faction | undefined {
    const id = this.roster.get(slot)?.team;
    return id ? this.teams?.find((t) => t.id === id) : undefined;
  }

  /** Objective mode scores in team order (null: team scores are kill totals). */
  setModeScores(scores: readonly number[] | null): void {
    this.modeScores = scores;
  }

  /** The line under the scorebar in objective modes: flag status, the hill, the round (HTML). */
  setModeStatus(html: string): void {
    if (html === this.lastModeStatus) return;
    this.lastModeStatus = html;
    this.modeStatus.innerHTML = html;
  }

  /**
   * Objective markers (flags, the hill): on screen at the objective, or an
   * arrow at the screen edge pointing the way when it is behind you or off
   * to the side (`edge`: its bearing in radians, 0 ahead, clockwise).
   */
  setModeMarkers(list: ScreenMarker[]): void {
    this.drawMarkers(this.modeMarkers, list);
  }

  /** Team pings (T), drawn like the objective markers on their own layer. */
  setPingMarkers(list: ScreenMarker[]): void {
    let layer = document.getElementById('ping-markers');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'ping-markers';
      this.modeMarkers.after(layer);
    }
    this.drawMarkers(layer, list);
  }

  /** Hints (the low-health warning's nearest health), drawn like the objective markers on their own layer. */
  setHintMarkers(list: ScreenMarker[]): void {
    let layer = document.getElementById('hint-markers');
    if (!layer) {
      if (!list.length) return;
      layer = document.createElement('div');
      layer.id = 'hint-markers';
      this.modeMarkers.after(layer);
    }
    this.drawMarkers(layer, list);
  }

  private drawMarkers(layer: HTMLElement, list: ScreenMarker[]): void {
    const seen = new Set<string>();
    for (const m of list) {
      seen.add(m.id);
      let el = layer.querySelector<HTMLElement>(`[data-id="${m.id}"]`);
      if (!el) {
        el = document.createElement('div');
        el.dataset.id = m.id;
        el.className = 'mode-marker';
        el.innerHTML = '<i></i><b></b><span></span>';
        layer.append(el);
      }
      el.style.left = `${m.x}px`;
      el.style.top = `${m.y}px`;
      el.style.color = m.color;
      el.classList.toggle('edge', m.edge !== undefined);
      (el.firstElementChild as HTMLElement).style.transform = m.edge !== undefined ? `rotate(${m.edge}rad)` : '';
      el.querySelector('b')!.textContent = m.icon;
      el.querySelector('span')!.textContent = m.label;
    }
    for (const el of [...layer.children] as HTMLElement[]) if (!seen.has(el.dataset.id ?? '')) el.remove();
  }

  /** Team scores: the objective mode's, else kills per team from the per-player scores. */
  teamTotals(scores: readonly ScoreEntry[]): Map<string, number> {
    if (this.modeScores && this.teams) return new Map(this.teams.map((t, i) => [t.id, this.modeScores![i] ?? 0]));
    const out = new Map<string, number>((this.teams ?? []).map((t) => [t.id, 0]));
    for (const s of scores) {
      const t = this.roster.get(s.s)?.team;
      if (t && out.has(t)) out.set(t, out.get(t)! + Math.max(0, s.k));
    }
    return out;
  }

  setModeLabel(text: string): void {
    this.modeLabel.textContent = text;
  }

  /** The map's name, shown on the pause screen and the scoreboard. */
  private mapName = '';
  setMapName(name: string): void {
    this.mapName = name;
    this.pauseContext();
  }

  /** The pause menu's match line: map, mode and time left. */
  pauseContext(): void {
    const line = document.getElementById('pause-context');
    if (!line) return;
    const clock = this.timer.textContent ? ` · ${this.timer.textContent} left` : '';
    const text = `${this.mapName} · ${this.modeLabel.textContent ?? ''}${clock}`;
    if (line.textContent !== text) line.textContent = text;
  }

  setPortrait(src: string): void {
    this.portrait.src = src;
  }

  /** The scorebar at the top (score boxes, timer, mode): hidden in the tutorial, where there is no score to play for. */
  showScorebar(on: boolean): void {
    $('scorebar').style.display = on ? '' : 'none';
  }

  /**
   * The scorebar's boxes either side of the timer (reference board): your team
   * and theirs in Team Deathmatch; you and the leader in Deathmatch; nothing
   * in co-op.
   */
  setTeamScore(scores: readonly ScoreEntry[], localSlot: number, limit: number, coop = false): void {
    let left = '';
    let right = '';
    const box = (value: number, label: string, color: string, team = -1) => `<b style="background:${color}">${value}</b><small>${teamSymbolSvg(team, color)}${escapeHtml(label)}</small>`;
    if (this.teams) {
      // Your team on the left; on the right the strongest other team (with 3+ teams, the leader among them).
      const totals = this.teamTotals(scores);
      const mine = this.roster.get(localSlot)?.team;
      const own = this.teams.find((t) => t.id === mine) ?? this.teams[0]!;
      const rival = this.teams.filter((t) => t.id !== own.id).sort((x, y) => (totals.get(y.id) ?? 0) - (totals.get(x.id) ?? 0))[0]!;
      left = box(totals.get(own.id) ?? 0, own.name, own.color, this.teams.indexOf(own));
      right = box(totals.get(rival.id) ?? 0, this.teams.length > 2 ? `${rival.name} · lead` : rival.name, rival.color, this.teams.indexOf(rival));
    } else if (!coop) {
      const me = scores.find((s) => s.s === localSlot)?.k ?? 0;
      const best = scores.filter((s) => s.s !== localSlot).reduce((m, s) => Math.max(m, s.k), 0);
      left = box(me, 'You', '#00d1ff');
      right = box(best, 'Leader', '#ff8a3d');
    }
    const key = `${left}|${right}|${limit}`;
    if (key === this.lastTeamScore) return;
    this.lastTeamScore = key;
    this.sbLeft.innerHTML = left;
    this.sbRight.innerHTML = right;
    this.sbLeft.title = this.sbRight.title = limit > 0 ? `First to ${limit}` : '';
  }

  /** Name and health of whatever you just hit (fades after a few seconds). */
  showTarget(name: string, frac: number, color: string, team = -1): void {
    this.target.hidden = false;
    // Their team's symbol before the name (Colour vision: teamSymbols.ts).
    $('target-name').innerHTML = `${teamSymbolSvg(team, color)}${escapeHtml(name)}`;
    const bar = $('target-bar');
    bar.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    bar.style.background = color;
    clearTimeout(this.targetTimer);
    this.targetTimer = window.setTimeout(() => (this.target.hidden = true), 2500);
  }

  /** Display names for NPC actor IDs, provided by the session. */
  npcName: (id: number) => string | undefined = () => undefined;

  name(slot: number | null): string {
    if (slot === null) return 'The arena';
    if (slot >= NPC_ID_BASE) return this.npcName(slot) ?? 'Enemy';
    const p = this.roster.get(slot);
    if (!p) return `Player ${slot + 1}`;
    // Ranks & badges on: the title before the name; off: plain, an Army bot's rank left off ("Sgt. Dunmore" → "Dunmore").
    return this.rank(slot)?.name ?? (p.bot && lookBranch(p.look) === 'army' ? nameWithoutRank(p.name) : p.name);
  }

  /** The team a player is on, as the roster has it (team modes), else null. */
  rosterTeam(slot: number): Faction | null {
    const id = this.roster.get(slot)?.team;
    return (id && this.teams?.find((t) => t.id === id)) || null;
  }

  /** The name a player joined with, as the roster has it (no rank title): for listings, not for show. */
  rosterName(slot: number): string {
    return this.roster.get(slot)?.name ?? `Player ${slot + 1}`;
  }

  setHealth(hp: number, armor: number, alive: boolean): void {
    this.health.textContent = alive ? String(Math.max(0, hp)) : '';
    this.armor.textContent = alive && armor > 0 ? String(armor) : '';
    this.healthBar.style.width = `${alive ? Math.max(0, Math.min(100, hp)) : 0}%`;
    this.healthBar.classList.toggle('low', hp <= 30);
    this.armorBar.style.width = `${alive ? Math.max(0, Math.min(100, armor)) : 0}%`;
    this.root.classList.toggle('dead', !alive);
  }

  /** Sprint stamina (shown while not full) and the stance you're in. */
  setStamina(stamina: number, winded: boolean, alive: boolean, stance: number): void {
    const row = document.getElementById('stamina-row');
    if (!row) return;
    row.classList.toggle('on', alive && (stamina < 1 || stance > 0));
    row.classList.toggle('winded', winded);
    (document.getElementById('stamina-bar') as HTMLElement).style.width = `${Math.round(stamina * 100)}%`;
    const label = stance === 2 ? 'Prone' : stance === 1 ? 'Crouch' : '';
    const st = document.getElementById('stance')!;
    if (st.textContent !== label) st.textContent = label;
  }

  /** Held weapon, ammo and the owned-weapons bar. */
  /** The vehicle you're in: its name and health (null hides the panel); `burning` adds the warning to bail out. */
  setVehicle(v: { name: string; pct: number; burning?: boolean } | null): void {
    const el = document.getElementById('vehicle-hp');
    if (!el) return;
    el.hidden = !v;
    if (!v) return;
    el.querySelector('span')!.textContent = v.name;
    const bar = el.querySelector('b')!;
    bar.style.setProperty('--hp', `${Math.max(0, Math.min(100, v.pct))}%`);
    bar.style.setProperty('--hp-color', hpColor(v.pct));
    let warn = el.querySelector<HTMLElement>('em');
    if (!warn) {
      warn = document.createElement('em');
      warn.textContent = 'Vehicle on fire — bail out!';
      el.append(warn);
    }
    warn.hidden = !v.burning;
    el.classList.toggle('burning', !!v.burning);
  }

  /** Small health bars over damaged vehicles (screen positions in CSS px). */
  setVehicleBars(bars: { id: number; x: number; y: number; pct: number }[]): void {
    const root = document.getElementById('vehicle-bars');
    if (!root) return;
    const seen = new Set<string>();
    for (const b of bars) {
      const key = String(b.id);
      seen.add(key);
      let el = root.querySelector<HTMLElement>(`i[data-id="${key}"]`);
      if (!el) {
        el = document.createElement('i');
        el.dataset.id = key;
        el.append(document.createElement('b'));
        root.append(el);
      }
      el.style.left = `${b.x}px`;
      el.style.top = `${b.y}px`;
      const fill = el.firstElementChild as HTMLElement;
      fill.style.setProperty('--hp', `${b.pct}%`);
      fill.style.setProperty('--hp-color', hpColor(b.pct));
    }
    for (const el of [...root.children] as HTMLElement[]) if (!seen.has(el.dataset.id ?? '')) el.remove();
  }

  /** Grenade / mine count beside the ammo (reference board: the grenade icon and number). */
  setThrowable(t: { kind: string; count: number } | null, alive: boolean): void {
    const text = alive && t ? `${t.kind === 'mine' ? '◎' : '●'} ${t.count}` : '';
    if (this.throwEl.textContent !== text) this.throwEl.textContent = text;
    this.throwEl.title = t ? `${t.kind === 'mine' ? 'Proximity mines' : 'Grenades'} (hold ${hintKey('throw')} to aim, let go to throw)` : '';
  }

  /** Riding as a passenger or gunner: the seat's gun (heat) instead of your own. */
  /** Swap the crosshair for a gunner's reticle while on a mounted gun; `heat` (0-100) fills its ring. */
  setGunnerReticle(heat: number | null): void {
    const el = document.getElementById('crosshair');
    if (!el) return;
    el.classList.toggle('gunner', heat !== null);
    if (heat !== null) el.style.setProperty('--heat', String(Math.min(100, heat)));
  }

  /**
   * A mounted gun in the ammo counter: its heat, or (limited ammunition: the Tank's cannon) its rounds aboard over the
   * most it carries, low under a quarter and "Empty" at none (they come back slowly, or all at an ammo pickup).
   */
  setMountedGun(name: string, heat: number, shells?: number, max?: number): void {
    this.weaponName.textContent = name;
    if (shells !== undefined) {
      this.ammoReserve.textContent = max !== undefined ? String(max) : '';
      this.ammoCount.textContent = shells > 0 ? String(shells) : 'Empty';
      this.ammoCount.classList.toggle('reloading', heat >= 100);
      this.ammoCount.classList.toggle('low', max !== undefined && shells <= Math.ceil(max / 4));
      this.ammoCount.title = 'Shells: one comes back every few seconds; drive over an ammo pickup to fill up';
    } else {
      this.ammoReserve.textContent = '';
      this.ammoCount.textContent = heat >= 100 ? 'OVERHEAT' : `${heat}°`;
      this.ammoCount.classList.toggle('reloading', heat >= 100);
      this.ammoCount.classList.toggle('low', false);
      this.ammoCount.title = '';
    }
    this.altEl.textContent = '';
  }

  /** The held weapon's fire mode readout (U switches), or null for a weapon with one mode. */
  private readonly fireModeEl = $('fire-mode');
  private lastFireMode = '';
  setFireMode(f: { label: string; mode: string; burst: { count: number } | null } | null, count = 1): void {
    const key = f ? `${f.label}|${count}` : '';
    if (key === this.lastFireMode) return;
    const switched = !!f && !!this.lastFireMode && this.lastFireMode.split('|')[0] !== f.label;
    this.lastFireMode = key;
    if (!f) {
      this.fireModeEl.innerHTML = '';
      return;
    }
    // Pips: one round for Single, the burst's count, a long bar for Auto; then the mode's name and its key.
    const pips = f.mode === 'auto' ? '<i class="auto"></i>' : '<i></i>'.repeat(f.burst?.count ?? 1);
    this.fireModeEl.innerHTML = `<span class="pips">${pips}</span>${escapeHtml(f.label)}<kbd>${escapeHtml(hintKey('fireMode'))}</kbd>`;
    // A short nudge on a switch (a size change only: nothing brightens, Reduce flashing or not).
    if (switched) {
      this.fireModeEl.classList.remove('switched');
      void this.fireModeEl.offsetWidth;
      this.fireModeEl.classList.add('switched');
    }
  }

  /**
   * `pair`: dual wielding, a pair in hand: the second gun's magazine and whether it is reloading. The count then
   * reads "L | R" (the second gun is the left hand's, the one you already held the right's) over the one reserve,
   * and each side shows its own reload.
   */
  setWeapons(owned: ReadonlyMap<number, readonly [number, number, number, number]>, held: number, reloading: boolean, alive: boolean, driving = false, pair: { mag: number; reloading: boolean } | null = null): void {
    if (driving) {
      this.weaponName.textContent = 'Driving';
      this.ammoCount.textContent = '';
      this.ammoReserve.textContent = '';
      this.altEl.textContent = '';
      return;
    }
    const def = weaponByCode(held);
    const altDef = def?.alt;
    // A melee weapon's barrel loaded from a reserve (the Battle Axe): the counter shows its loads and shells.
    const barrel = !!def && def.magazine === 0 && !!altDef?.reload;
    const altText = alive && altDef ? (altDef.ammo === 'own' && !barrel ? `RMB ${altDef.label} · ${owned.get(held)?.[2] ?? 0}` : `RMB ${altDef.label}`) : '';
    if (this.altEl.textContent !== altText) this.altEl.textContent = altText;
    const ammo = owned.get(held);
    this.weaponName.textContent = alive && def ? def.displayName : '';
    this.ammoReserve.textContent = alive && def && ammo && (def.magazine > 0 || barrel) && !reloading ? String(ammo[1]) : '';
    if (!alive || !def || !ammo) this.ammoCount.textContent = '';
    else if (barrel) this.ammoCount.textContent = reloading ? 'Loading…' : String(ammo[2]);
    else if (def.heat) this.ammoCount.textContent = ammo[3] >= 100 ? 'OVERHEAT' : `${Math.round(ammo[3])}°`;
    else if (def.magazine === 0) this.ammoCount.textContent = '∞';
    else if (pair) {
      // Two magazines over the one reserve; a gun that is reloading shows the cue in its place (the reserve stays up).
      this.ammoReserve.textContent = String(ammo[1]);
      const low = Math.ceil(def.magazine / 4);
      const side = (mag: number, busy: boolean, hand: string) => `<span class="pair-${hand}${busy ? ' reloading' : mag <= low ? ' low' : ''}">${busy ? '↻' : mag}</span>`;
      const html = `${side(pair.mag, pair.reloading, 'l')}<i class="pair-bar">|</i>${side(ammo[0], reloading, 'r')}`;
      if (this.ammoCount.innerHTML !== html) this.ammoCount.innerHTML = html;
    } else this.ammoCount.textContent = reloading ? 'Reloading…' : String(ammo[0]);
    this.ammoCount.classList.toggle('pair', !!pair && alive && !!def && !!ammo);
    this.ammoCount.classList.toggle('reloading', !pair && (reloading || (!!def?.heat && !!ammo && ammo[3] >= 100)));
    this.ammoCount.classList.toggle('low', !pair && !!def && !!ammo && (barrel ? ammo[2] === 0 : def.magazine > 0 && ammo[0] <= Math.ceil(def.magazine / 4)));
    const key = `${alive}|${held}|${[...owned.keys()].join(',')}`;
    if (key === this.lastWeaponBar) return;
    this.lastWeaponBar = key;
    // The weapon categories (the wheel's slices, keys 1-8 by default), with a pip per extra weapon held in one.
    const byCat = new Map<WheelCategory, string[]>();
    for (const code of owned.keys()) {
      const w = weaponByCode(code);
      if (w) byCat.set(wheelCategoryOf(w), [...(byCat.get(wheelCategoryOf(w)) ?? []), w.displayName]);
    }
    const heldCat = def ? wheelCategoryOf(def) : null;
    this.weaponBar.innerHTML = alive
      ? WHEEL_CATEGORIES.map((cat, i) => {
          const names = byCat.get(cat) ?? [];
          const pips = names.length > 1 ? `<i>${'•'.repeat(Math.min(4, names.length))}</i>` : '';
          return `<span class="${names.length ? 'owned' : ''} ${heldCat === cat ? 'held' : ''}" title="${escapeHtml(`${WHEEL_CATEGORY_LABELS[cat]}: ${names.join(', ') || 'none'}`)}">${escapeHtml(this.categoryKeys[i] ?? String(i + 1))}${pips}</span>`;
        }).join('')
      : '';
  }

  /** Full-screen edge glow while you are burning, poisoned, slowed or frozen. */
  setStatusTint(color: string | null): void {
    let el = document.getElementById('status-tint');
    if (!el) {
      el = document.createElement('div');
      el.id = 'status-tint';
      this.root.append(el);
    }
    el.style.boxShadow = color ? `inset 0 0 120px 30px ${color}88` : 'none';
  }

  setPowerups(speedSeconds: number, damageSeconds: number, jetFuel: number | null = null, uavSeconds = 0, jamSeconds = 0, streak = ''): void {
    const parts: string[] = [];
    if (streak) parts.push(`<span style="color:#ffd24a">${escapeHtml(streak)}</span>`);
    if (jamSeconds > 0) parts.push(`<span style="color:#ff5a5a">MINIMAP JAMMED ${Math.ceil(jamSeconds)}</span>`);
    if (uavSeconds > 0) parts.push(`<span style="color:#9fe8ff">UAV ${Math.ceil(uavSeconds)}</span>`);
    // Jetpack fuel as a little gauge: ten blocks.
    if (jetFuel !== null) {
      const n = Math.round(jetFuel * 10);
      parts.push(`<span style="color:#ffa040">JETPACK ${'▮'.repeat(n)}<span style="opacity:.3">${'▮'.repeat(10 - n)}</span></span>`);
    }
    if (damageSeconds > 0) parts.push(`<span style="color:#d77bff">DOUBLE DAMAGE ${Math.ceil(damageSeconds)}</span>`);
    if (speedSeconds > 0) parts.push(`<span style="color:#5fe0ff">SPEED ${Math.ceil(speedSeconds)}</span>`);
    for (const l of this.statusLines) parts.push(`<span style="color:${l.color}">${escapeHtml(l.text)}</span>`);
    const html = parts.join('');
    if (html !== this.powerups.innerHTML) this.powerups.innerHTML = html;
  }

  pickup(text: string): void {
    this.pickupMsg.textContent = text;
    this.pickupMsg.classList.add('on');
    clearTimeout(this.pickupTimer);
    this.pickupTimer = window.setTimeout(() => this.pickupMsg.classList.remove('on'), 1200);
  }

  /**
   * The full-screen scope with its optic kind's reticle (`fine`: a sniper scope's crosshair; `chevron`: a 2-3x optic's)
   * and holdover marks. It comes in at once with the zoom and fades out (scopeFeel.ts SCOPE_FADE; slower with Reduce
   * flashing on): never a cut to the bright scene.
   */
  setScope(on: boolean, marks: readonly HoldoverMark[] = [], reticle = 'fine'): void {
    const now = performance.now();
    const dt = Math.max(0, Math.min(0.1, (now - this.scopeAt) / 1000));
    this.scopeAt = now;
    if (!on && this.scopeLevel <= 0) return;
    this.scopeLevel = stepScopeFade(this.scopeLevel, on, dt, reduceFlashing());
    this.scope.hidden = this.scopeLevel <= 0;
    const shown = this.scopeLevel.toFixed(3);
    if (shown !== this.scopeShown) this.scope.style.setProperty('--so', (this.scopeShown = shown));
    if (on) {
      drawHoldover($('scope-holdover'), marks, 1);
      if (this.scope.dataset.reticle !== reticle) this.scope.dataset.reticle = reticle;
    }
  }
  private scopeLevel = 0;
  private scopeAt = 0;
  private scopeShown = '';

  /**
   * The eye box (scopeFeel.ts EYE_BOX): the scope's shadow slid `x`, `y` glass radii off the middle (x right, y down),
   * `dark` its darkness. On whichever of the scope and the optic is up.
   */
  setEyeBox(x: number, y: number, dark: number): void {
    this.eyeBox = { x, y, dark };
    const host = !this.scope.hidden ? this.scope : !this.optic.hidden ? this.optic : null;
    if (!host) return;
    const el = (this.eyeBoxEls[host.id] ??= host.querySelector<HTMLElement>('.eyebox i'));
    if (!el) return;
    // (The sheet is three glass diameters across: a glass radius is a sixth of it.)
    const key = `translate(${((x / 6) * 100).toFixed(2)}%, ${((y / 6) * 100).toFixed(2)}%)|${dark.toFixed(2)}`;
    if (this.eyeBoxShown[host.id] === key) return;
    this.eyeBoxShown[host.id] = key;
    el.style.transform = key.slice(0, key.indexOf('|'));
    el.style.opacity = dark.toFixed(2);
  }
  private eyeBox = { x: 0, y: 0, dark: 0 };
  private readonly eyeBoxEls: Record<string, HTMLElement | null> = {};
  private readonly eyeBoxShown: Record<string, string> = {};

  /**
   * The scope's or the optic's shade as drawn now, for the flicker check (it draws it over its frames, as it does the
   * hurt vignette): the surround round the glass, the glass's darkened edge and the eye box's shadow. Null: none up.
   */
  scopeOverlay(): { image: HTMLCanvasElement; opacity: number } | null {
    const scoped = !this.scope.hidden;
    if (!scoped && this.optic.hidden) return null;
    const c = (this.scopePicture ??= document.createElement('canvas'));
    [c.width, c.height] = [320, Math.max(1, Math.round((320 * innerHeight) / Math.max(1, innerWidth)))];
    const g = c.getContext('2d')!;
    const [cx, cy] = [c.width / 2, c.height / 2];
    // The glass's radius: the scope's is 92 of its 100 units (the shorter side's half), the optic's its --r.
    const r = scoped ? 0.92 * Math.min(cx, cy) : (parseFloat(this.optic.style.getPropertyValue('--r')) / 50) * cy;
    g.clearRect(0, 0, c.width, c.height);
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();
    // The glass's own darkened edge, then the eye box's sheet with its clear hole slid off the middle.
    const edge = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    edge.addColorStop(0.78, 'rgba(0,0,0,0)');
    edge.addColorStop(0.93, 'rgba(0,0,0,0.45)');
    edge.addColorStop(1, 'rgba(0,0,0,0.95)');
    g.fillStyle = edge;
    g.fillRect(0, 0, c.width, c.height);
    const [hx, hy] = [cx + this.eyeBox.x * r, cy + this.eyeBox.y * r];
    const shade = g.createRadialGradient(hx, hy, 0, hx, hy, r * EYE_BOX.full);
    for (let i = 0; i <= 8; i++) {
      const at = EYE_BOX.clear + ((EYE_BOX.full - EYE_BOX.clear) * i) / 8;
      shade.addColorStop(at / EYE_BOX.full, `rgba(0,0,0,${(eyeBoxShade(at) * this.eyeBox.dark).toFixed(3)})`);
    }
    g.fillStyle = shade;
    g.fillRect(0, 0, c.width, c.height);
    g.restore();
    // The surround: everything outside the glass.
    g.fillStyle = scoped ? '#000' : 'rgba(0,0,0,0.9)';
    g.beginPath();
    g.rect(0, 0, c.width, c.height);
    g.arc(cx, cy, r, 0, Math.PI * 2, true);
    g.fill();
    return { image: c, opacity: scoped ? this.scopeLevel : Number(this.optic.style.getPropertyValue('--o') || 1) };
  }
  private scopePicture: HTMLCanvasElement | null = null;

  /** A real optic's view (game/opticView.ts): the glass's radius as a share of the half-height, or null. */
  private readonly optic = $('optic');
  private opticKey = '';
  setOptic(o: { lens: number; blend: number; reticle: string; marks?: readonly HoldoverMark[] } | null): void {
    if (o) {
      drawHoldover($('optic-holdover'), o.marks ?? [], 1.4);
      // Holdover marks take the place of the duplex's two plain hash marks below the centre.
      this.optic.classList.toggle('holdover-on', !!o.marks?.length);
    }
    const key = o ? `${o.lens.toFixed(4)}|${o.blend.toFixed(3)}|${o.reticle}` : '';
    if (key === this.opticKey) return;
    this.opticKey = key;
    this.optic.hidden = !o;
    if (!o) return;
    this.optic.style.setProperty('--r', `${(o.lens * 50).toFixed(3)}vh`);
    // The shade and reticle come in over the second half of the eye's move (a fade, never a flash).
    this.optic.style.setProperty('--o', Math.max(0, Math.min(1, (o.blend - 0.4) / 0.6)).toFixed(3));
    this.optic.dataset.reticle = o.reticle;
  }

  /** While out of play: what you're watching ("Watching Ana", "Free camera") and the controls for it (null hides it). */
  setSpectating(title: string | null, hint = ''): void {
    let el = document.getElementById('spectating');
    if (!el) {
      if (!title) return;
      el = document.createElement('div');
      el.id = 'spectating';
      el.innerHTML = '<b></b><small></small>';
      this.root.append(el);
    }
    el.hidden = !title;
    if (!title) return;
    const [b, small] = [el.querySelector('b')!, el.querySelector('small')!];
    if (b.textContent !== title) b.textContent = title;
    if (small.textContent !== hint) small.textContent = hint;
  }

  /** The kill cam's banner: who killed you, with what, and the health they have left (null hides it). */
  setKillCam(k: { name: string; color: string; weapon: string; hp: number | null; team?: number } | null): void {
    let el = document.getElementById('killcam');
    if (!el) {
      if (!k) return;
      el = document.createElement('div');
      el.id = 'killcam';
      this.root.append(el);
    }
    el.hidden = !k;
    if (!k) return;
    const key = `${k.name}|${k.color}|${k.weapon}|${k.hp}|${k.team ?? -1}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.innerHTML = `<small>Killed by</small> <b style="color:${escapeHtml(k.color)}">${teamSymbolSvg(k.team ?? -1)}${escapeHtml(k.name)}</b> <span class="kc-w"></span>${k.hp === null ? '' : ` <span class="kc-hp">${k.hp > 0 ? `${k.hp} HP left` : 'down'}</span>`}<em>Click or Space: skip</em>`;
    const icon = weaponIcon(k.weapon);
    const slot = el.querySelector('.kc-w')!;
    slot.textContent = weaponLabel(k.weapon);
    if (icon) {
      icon.title = weaponLabel(k.weapon);
      slot.replaceChildren(icon);
    }
  }

  /** Out of play (dead, or spectating): the crosshair goes. */
  setWatching(on: boolean): void {
    if (this.root.classList.contains('watching') !== on) this.root.classList.toggle('watching', on);
  }

  /**
   * Aiming down the sights (0..1): the crosshair fades out. `dot`: the HUD's own aim dot takes its place, for a gun
   * with neither sights nor an optic (game/optics.ts); iron sights show none (the front sight is the aim) and a red
   * dot's or a holographic sight's mark is drawn on its glass (game/opticHousing.ts).
   */
  setAds(amount: number, dot = true): void {
    let mark = document.getElementById('reddot');
    if (!mark) {
      mark = document.createElement('div');
      mark.id = 'reddot';
      document.getElementById('crosshair')?.after(mark);
    }
    const on = dot && amount > 0.6;
    mark.style.opacity = on ? String(Math.min(1, (amount - 0.6) / 0.3)) : '0';
    const cross = document.getElementById('crosshair');
    // Through an optic its reticle is the aim (the crosshair would sit on top of it).
    if (cross) cross.style.opacity = this.optic.hidden ? String(1 - Math.min(1, amount * 1.6)) : '0';
  }

  /** Breath meter under the scope (spent: it has to recover before you can hold again). */
  setBreath(breath: number, spent: boolean): void {
    for (const el of [this.scope, this.optic]) {
      if (el.hidden) continue;
      el.style.setProperty('--breath', `${Math.round(breath * 100)}%`);
      el.classList.toggle('spent', spent);
    }
  }

  setStatus(phase: MatchPhase, timeLeft: number, alive: boolean, winner: string | null, outcome: 'victory' | 'defeat' | null = null): void {
    const m = Math.floor(timeLeft / 60);
    const s = String(timeLeft % 60).padStart(2, '0');
    this.timer.textContent = phase === 'intermission' ? 'Intermission' : phase === 'waiting' || phase === 'countdown' ? '' : timeLeft ? `${m}:${s}` : '';
    // The start countdown: a big 3, 2, 1 (then "Go!" from flashGo).
    if (phase === 'countdown') {
      this.countdown.hidden = false;
      this.countdown.classList.remove('go');
      this.countdown.textContent = String(Math.max(1, timeLeft));
      // Under the number: the map and mode, and the goal (it fades out with "Go!").
      this.countdownInfo.hidden = !this.countdownInfo.querySelector('b')!.textContent;
      this.countdownInfo.classList.remove('go');
    } else if (performance.now() > this.goUntil) this.countdown.hidden = this.countdownInfo.hidden = true;
    if (phase === 'waiting') this.banner.textContent = 'Waiting for players…';
    else if (phase === 'countdown') this.banner.textContent = '';
    else if (phase === 'intermission') this.banner.textContent = outcome === 'victory' ? 'Mission complete' : outcome === 'defeat' ? 'Mission failed' : winner ? `${winner} wins the round` : 'Round over';
    else this.banner.textContent = alive ? '' : this.waitLabel;
  }

  /** "Go!" as the countdown ends. */
  flashGo(): void {
    this.countdown.hidden = false;
    this.countdown.textContent = 'Go!';
    this.countdown.classList.add('go');
    this.countdownInfo.classList.add('go');
    this.goUntil = performance.now() + 900;
    setTimeout(() => {
      if (performance.now() >= this.goUntil) this.countdown.hidden = this.countdownInfo.hidden = true;
    }, 950);
  }

  /** The loading screen's card (the map, its mode, the match's goal) and bar. */
  setLoadingCard(card: Parameters<typeof setLoadingCard>[0]): void {
    setLoadingCard(card);
  }

  setLoadingProgress(progress: number): void {
    setLoadingProgress(progress);
  }

  /**
   * Partway through loading the match's info and the Tab board join the loading screen (style.css `#hud.ls-staged`):
   * the board sits under the card, over the screen.
   */
  stageLoading(on: boolean): void {
    this.root.classList.toggle('ls-staged', on);
  }

  /** The loading screen fades out (into the countdown); the board goes with it. */
  endLoading(): void {
    if (this.loading.hidden) return;
    this.loading.classList.add('ls-out');
    window.setTimeout(() => {
      this.loading.hidden = true;
      this.loading.classList.remove('ls-out');
      this.root.classList.remove('ls-staged');
    }, 350);
  }

  /** The line under the countdown's big number: the map and mode, and the goal in a few words. */
  setCountdownInfo(head: string, goal: string): void {
    this.countdownInfo.querySelector('b')!.textContent = head;
    this.countdownInfo.querySelector('span')!.textContent = goal;
  }

  /** Shown while you are dead ("Respawning…", or "Next round" in Elimination). */
  waitLabel = 'Respawning…';

  kill(killer: number | null, victim: number, weapon: string, localSlot: number, headshot = false, teamKill = false): void {
    const line = document.createElement('div');
    const color = (slot: number | null) => (slot === null ? '#ccc' : this.nameColor(slot, localSlot));
    // With Ranks & badges on, the rank badge and title before the name (feedName; a rank-up redraws it: feedRankUp).
    const name = (slot: number | null) => `<span style="color:${color(slot)}"${slot === null ? '' : ` data-rs="${slot}"`}>${this.feedName(slot)}</span>`;
    line.innerHTML = killer === null ? `${name(victim)} ${HAZARD_DEATHS[weapon] ?? 'blew themselves up'}` : `${name(killer)} <small>${escapeHtml(weaponLabel(weapon))}</small> ${name(victim)}`;
    // Weapon icon between the names (reference board), rendered from the weapon's model.
    const icon = killer !== null ? weaponIcon(weapon) : null;
    const label = line.querySelector('small');
    if (icon && label) {
      icon.title = weaponLabel(weapon);
      label.replaceWith(icon);
    }
    if (killer === localSlot || victim === localSlot) line.style.outline = '1px solid rgba(255,255,255,0.5)';
    if (headshot && killer !== null && !teamKill) line.insertAdjacentHTML('beforeend', ' <b class="hs" title="Headshot">✛</b>');
    // A team kill (friendly fire): a TK tag and the warning style, for everyone who sees the feed.
    if (teamKill && killer !== null) {
      line.classList.add('tk');
      line.insertAdjacentHTML('afterbegin', '<b class="tk-tag" title="Team kill">TK</b> ');
    }
    this.feed.prepend(line);
    this.trimFeed();
    window.setTimeout(() => line.remove(), 5000);
  }

  /** The feed keeps its newest lines: 5, or 3 on a phone sideways (feedLimit.ts). */
  private trimFeed(): void {
    const keep = feedLines(isTouchDevice(), window.innerHeight);
    while (this.feed.children.length > keep) this.feed.lastChild?.remove();
  }

  /** A slot changed hands mid-match: "Ana joined, replacing Mildred" (a player joined), or "Mildred took over for Ana" (they left). */
  takeover(slot: number, to: string, from: string, bot: boolean): void {
    const line = document.createElement('div');
    const color = this.nameColor(slot);
    line.className = 'say takeover';
    line.innerHTML = `<span style="color:${color}">${escapeHtml(to)}</span> ${bot ? 'took over for' : 'joined, replacing'} <span style="color:${color}">${escapeHtml(from)}</span>`;
    this.feed.prepend(line);
    this.trimFeed();
    window.setTimeout(() => line.remove(), 6000);
  }

  /** A line from the match itself in the feed: what the host changed ("Host set teams to 8v8"). */
  note(text: string): void {
    const line = document.createElement('div');
    line.className = 'say note';
    line.textContent = text;
    this.feed.prepend(line);
    this.trimFeed();
    window.setTimeout(() => line.remove(), 6000);
  }

  /** A quick message in the feed: "Name: Enemy spotted!". */
  say(slot: number, text: string): void {
    if (!text) return;
    const line = document.createElement('div');
    const color = this.nameColor(slot);
    line.className = 'say';
    line.innerHTML = `<span style="color:${color}">${escapeHtml(this.name(slot))}:</span> ${escapeHtml(text)}`;
    this.feed.prepend(line);
    this.trimFeed();
    window.setTimeout(() => line.remove(), 6000);
  }

  /** The quick-message menu (B): the numbered messages, or hidden. */
  setMessageMenu(open: boolean, messages: readonly string[]): void {
    let el = document.getElementById('msg-menu');
    if (!el) {
      el = document.createElement('div');
      el.id = 'msg-menu';
      el.hidden = true;
      this.root.append(el);
    }
    // (Drawn again each time: the keys it names follow Options → Controls.)
    if (open && el.hidden !== false) {
      el.innerHTML = `<b>Quick message</b>${messages.map((m, i) => `<div><kbd>${i + 1}</kbd> ${escapeHtml(m)}</div>`).join('')}<small>1 &amp; 7 also order your team's bots · ${escapeHtml(hintKey('ping'))}: ping · ${escapeHtml(hintKey('dance'))}: dance · ${escapeHtml(hintKey('quickMessage'))}: close</small>`;
    }
    el.hidden = !open;
  }

  /** Active objectives, plus completed/failed ones while they fade out. */
  setObjectives(list: { text: string; state: 'active' | 'complete' | 'failed' | 'gone' }[]): void {
    const key = JSON.stringify(list);
    if (key === this.lastObjectives) return;
    this.lastObjectives = key;
    this.objectives.innerHTML = list.map((o) => `<div class="${o.state}">${escapeHtml(o.text)}</div>`).join('');
  }

  showMessage(text: string, seconds: number): void {
    this.message.textContent = text;
    this.message.classList.add('on');
    clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => this.message.classList.remove('on'), seconds * 1000);
  }

  /** "[E] Open the gate" under the crosshair; `denied` shows a refusal (locked). */
  /** The use prompt (its key: F by default), and optionally a second key to show beside it (H: the vehicle camera). */
  setPrompt(text: string | null, denied = false, hint?: { key: string; text: string }): void {
    const key = `${text}|${denied}|${hint?.key}|${hint?.text}`;
    if (key === this.lastPrompt) return;
    this.lastPrompt = key;
    this.prompt.classList.toggle('denied', denied);
    const extra = hint ? `<span class="prompt-hint"><kbd>${escapeHtml(hint.key)}</kbd>${escapeHtml(hint.text)}</span>` : '';
    this.prompt.innerHTML = text === null ? '' : denied ? escapeHtml(text) : `<kbd>${escapeHtml(hintKey('use'))}</kbd>${escapeHtml(text)}${extra}`;
  }

  setTimers(lines: string[]): void {
    const key = lines.join('|');
    if (key === this.lastTimers) return;
    this.lastTimers = key;
    this.scTimers.innerHTML = lines.map((l) => `<div>${escapeHtml(l)}</div>`).join('');
  }

  /** Objective marker at screen position (CSS px), or hidden. */
  setMarker(at: { x: number; y: number; dist: number } | null): void {
    this.marker.hidden = !at;
    if (!at) return;
    this.marker.style.left = `${at.x}px`;
    this.marker.style.top = `${at.y}px`;
    this.marker.querySelector('span')!.textContent = `${Math.round(at.dist)} m`;
  }

  /**
   * Hit confirmation on the crosshair, told apart by shape (GUNPLAY_SPEC §21):
   * a diamond for a body hit, a bigger red one for the head, a blue square
   * when armor soaked it, a ring when a spawn-protected target's shield took it. `true` / `false` are head / body (older callers).
   */
  hit(kind: 'body' | 'head' | 'armor' | 'shield' | boolean = 'body'): void {
    const k = kind === true ? 'head' : kind === false ? 'body' : kind;
    // A kill marker still showing wins over the hit that caused it.
    if (this.hitmarker.classList.contains('kill')) return;
    // Restart the pop animation on every hit.
    this.hitmarker.classList.remove('on', 'head', 'armor', 'shield');
    void this.hitmarker.offsetWidth;
    this.hitmarker.classList.add('on');
    if (k !== 'body') this.hitmarker.classList.add(k);
    clearTimeout(this.hitTimer);
    this.hitTimer = window.setTimeout(() => this.hitmarker.classList.remove('on', 'head', 'armor', 'shield'), k === 'head' ? 220 : 140);
  }

  /** Kill confirmation: a sharp X that punches in, bigger and brighter with each kill in a row (`multi`, from 1). */
  killConfirm(multi: number): void {
    this.hitmarker.classList.remove('on', 'head', 'armor', 'shield', 'kill');
    void this.hitmarker.offsetWidth;
    this.hitmarker.dataset.multi = String(Math.min(4, Math.max(1, multi)));
    this.hitmarker.classList.add('on', 'kill');
    clearTimeout(this.hitTimer);
    this.hitTimer = window.setTimeout(() => this.hitmarker.classList.remove('on', 'kill'), 380 + Math.min(3, multi - 1) * 60);
  }

  /**
   * You took damage: the screen edge flashes red, with an arc pointing at the
   * attacker when we know where it came from (radians, 0 = straight ahead, + = right).
   * With Reduce flashing on it is a duller red that eases in and holds under fire (hurtVignette.ts); `tickHurt`
   * draws it each frame.
   */
  hurt(direction: number | null, amount: number): void {
    const el = document.getElementById('hurt');
    if (!el) return;
    el.style.setProperty('--hurt-dir', `${direction ?? 0}rad`);
    el.classList.toggle('dir', direction !== null);
    this.hurtFade.hit(amount, performance.now());
    this.tickHurt();
  }
  private readonly hurtFade = new HurtFade();
  /** The vignette's look shown now, and its pictures (made when first shown). */
  private hurtLook: 'classic' | 'calm' | null = null;
  private readonly hurtPictures: Partial<Record<'classic' | 'calm', HTMLCanvasElement>> = {};

  private hurtPicture(look: 'classic' | 'calm'): HTMLCanvasElement {
    return (this.hurtPictures[look] ??= paintVignette(HURT_LOOKS[look]));
  }

  /** The hurt vignette this frame: its look (Reduce flashing) and how strong it is now. */
  tickHurt(): void {
    const el = document.getElementById('hurt');
    if (!el) return;
    const look = reduceFlashing() ? 'calm' : 'classic';
    if (look !== this.hurtLook) {
      this.hurtLook = look;
      el.style.backgroundImage = `url(${this.hurtPicture(look).toDataURL()})`;
    }
    const level = this.hurtFade.update(performance.now(), look === 'calm');
    const shown = level > 0.002 ? level.toFixed(3) : '0';
    if (shown !== this.hurtShown) el.style.opacity = this.hurtShown = shown;
  }
  private hurtShown = '';

  /**
   * A hold to use (sim/holdUse.ts: resupplying, healing): a ring round the crosshair that fills as it runs, with what
   * it is under it. Steady (no blinking); null hides it.
   */
  setHold(label: string | null, progress: number): void {
    if (label === null) {
      if (this.holdEl && !this.holdEl.hidden) this.holdEl.hidden = true;
      return;
    }
    if (!this.holdEl) {
      this.holdEl = document.createElement('div');
      this.holdEl.id = 'hold-ring';
      this.holdEl.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle class="track" cx="32" cy="32" r="${HOLD_RING_R}"/><circle class="fill" cx="32" cy="32" r="${HOLD_RING_R}" stroke-dasharray="${HOLD_RING_LEN.toFixed(2)}"/></svg><span></span>`;
      (document.getElementById('hud') ?? document.body).append(this.holdEl);
    }
    this.holdEl.hidden = false;
    const span = this.holdEl.querySelector('span')!;
    if (span.textContent !== label) span.textContent = label;
    const left = (HOLD_RING_LEN * (1 - Math.max(0, Math.min(1, progress)))).toFixed(2);
    const fill = this.holdEl.querySelector<SVGCircleElement>('circle.fill')!;
    if (fill.getAttribute('stroke-dashoffset') !== left) fill.setAttribute('stroke-dashoffset', left);
  }
  private holdEl: HTMLElement | null = null;

  /**
   * The low-health warning's HUD parts (lowHealth.ts): the health bar's slow pulse (`pulse` 0..1, at most once a
   * second, low contrast) and the screen edge's darkening (`edge` 0..1, a near-black, not a red).
   */
  setLowHealth(edge: number, pulse: number): void {
    const shown = edge > 0.002 ? edge.toFixed(3) : '0';
    if (shown !== this.lowShown) {
      this.lowShown = shown;
      if (!this.lowEl && edge > 0.002) {
        this.lowEl = document.createElement('div');
        this.lowEl.id = 'low-health';
        this.lowEl.style.backgroundImage = `url(${paintVignette(LOW_HEALTH_LOOK).toDataURL()})`;
        (document.getElementById('hud') ?? document.body).prepend(this.lowEl);
      }
      if (this.lowEl) this.lowEl.style.opacity = shown;
    }
    const p = pulse > 0.002 ? pulse.toFixed(2) : '0';
    if (p !== this.lowPulse) {
      this.lowPulse = p;
      this.healthBar.style.setProperty('--low-pulse', p);
      this.healthBar.classList.toggle('pulse', pulse > 0.002);
    }
  }
  private lowEl: HTMLElement | null = null;
  private lowShown = '';
  private lowPulse = '';

  /** The low-health edge as drawn now (the flicker check draws it over its frames). */
  lowHealthOverlay(): { image: HTMLCanvasElement; opacity: number } {
    return { image: (this.lowPicture ??= paintVignette(LOW_HEALTH_LOOK)), opacity: Number(this.lowShown || 0) };
  }
  private lowPicture: HTMLCanvasElement | null = null;

  /** You took a heavy hit (content/match-play.json heavyHit): the screen's edges darken for a moment (hurtVignette.ts HeavyFade). */
  heavyHit(amount: number): void {
    this.heavyFade.hit(amount, performance.now());
    this.tickHeavy();
  }
  private readonly heavyFade = new HeavyFade();
  private heavyEl: HTMLElement | null = null;
  private heavyShown = '';
  private heavyPicture: HTMLCanvasElement | null = null;

  /** The heavy-hit edge this frame. */
  tickHeavy(): void {
    const level = this.heavyFade.update(performance.now(), reduceFlashing());
    if (!this.heavyEl && level <= 0.002) return;
    if (!this.heavyEl) {
      this.heavyEl = document.createElement('div');
      this.heavyEl.id = 'heavy-hit';
      this.heavyPicture ??= paintVignette(HEAVY_LOOK);
      this.heavyEl.style.backgroundImage = `url(${this.heavyPicture.toDataURL()})`;
      (document.getElementById('hud') ?? document.body).append(this.heavyEl);
    }
    const shown = level > 0.002 ? level.toFixed(3) : '0';
    if (shown === this.heavyShown) return;
    this.heavyShown = shown;
    this.heavyEl.style.opacity = shown;
    // A small kick inward with the hit (none with flashing reduced: the edge only eases).
    this.heavyEl.style.transform = reduceFlashing() ? '' : `scale(${(1 + level * 0.04).toFixed(3)})`;
  }

  /** The heavy-hit edge as drawn now (the flicker check draws it over its frames). */
  heavyOverlay(): { image: HTMLCanvasElement; opacity: number } {
    return { image: (this.heavyPicture ??= paintVignette(HEAVY_LOOK)), opacity: this.heavyFade.level };
  }

  /** The hurt vignette as drawn now (the flicker check draws it over its frames). */
  hurtOverlay(): { image: HTMLCanvasElement; opacity: number } {
    return { image: this.hurtPicture(this.hurtLook ?? 'classic'), opacity: this.hurtFade.level };
  }

  /** "HEADSHOT" call-out for a kill you made with a head hit. */
  headshot(): void {
    const el = document.getElementById('headshot');
    if (!el) return;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
  }

  /**
   * The Tab / end-of-round scoreboard. Drawn when it opens, then patched at
   * most 4 times a second while it stays open (cheap at 96 players).
   */
  renderScoreboard(visible: boolean, scores: readonly ScoreEntry[], localSlot: number, final = false): void {
    if (this.scoreboard.hidden !== !visible) {
      this.scoreboard.hidden = !visible;
      // (Fireteams: the squad panel gives way to the board, style.css #hud.sb-up.)
      this.scoreboard.parentElement?.classList.toggle('sb-up', visible);
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
    this.card?.refresh(final);
  }
  private boardAt = 0;

  /** Your profile card under the board (game/profileCard.ts; not on the pause menu's): `refresh` patches it as the board redraws. */
  setProfileCard(card: { el: HTMLElement; refresh(final: boolean): void } | null): void {
    this.card = card;
    this.board.setExtra(card?.el ?? null);
  }
  private card: { el: HTMLElement; refresh(final: boolean): void } | null = null;
  /** A scoreboard row was clicked (the pause menu's Match tab, the end-of-match board): that player's card (session: game/playerCard.ts). */
  onPlayerCard: ((slot: number, row: HTMLElement) => void) | null = null;
  /** The roster entry of a slot (the player card reads who they are). */
  rosterOf(slot: number): RosterEntry | undefined {
    return this.roster.get(slot);
  }
  private boardOpen = false;

  /** The pause menu's Match tab: the same board, in the menu's width (`final`: the match is over, so where it goes next too). */
  renderPauseScores(box: HTMLElement, scores: readonly ScoreEntry[], localSlot: number, final = false): void {
    if (this.pauseBoard?.root !== box) {
      this.pauseBoard = new ScoreBoard(box, { maxWidth: 560, sizeSelf: false });
      this.pauseBoard.onJoin = (team) => this.onJoinTeam?.(team);
      this.pauseBoard.onRow = (slot, row) => this.onPlayerCard?.(slot, row);
    }
    this.pauseBoard.render(this.boardData(scores, localSlot, final));
  }

  /** What the scoreboards show: the teams (or everyone), sorted, with each row's stats. */
  boardData(scores: readonly ScoreEntry[], localSlot: number, final: boolean): BoardData {
    // Guests are marked once more than one person plays (an online match), so a typed name can't pass for an account.
    const people = [...this.roster.values()].filter((p) => !p.bot).length;
    // Your party (net/party.ts): the people who came with you, when there are any.
    const myParty = this.roster.get(localSlot)?.py;
    const inParty = myParty ? [...this.roster.values()].filter((p) => !p.bot && p.py === myParty).length > 1 : false;
    // Fireteams: the teams' rows grouped by squad, with a points column.
    const squads = this.teams && this.squadsRaw ? readSquads(this.squadsRaw) : null;
    const row = (s: ScoreEntry): BoardRow => {
      const p = this.roster.get(s.s);
      const cls = this.classes.get(s.s);
      const ping = this.pings.get(s.s);
      return {
        slot: s.s,
        name: this.name(s.s),
        ins: this.insignia(s.s),
        em: p && !p.bot ? (p.em ?? null) : null,
        bot: !!p?.bot,
        ...(p && !p.bot ? (p.acct ? { who: 'acct' as const } : people > 1 ? { who: 'guest' as const } : {}) : {}),
        ...(inParty && p && !p.bot && p.py === myParty ? { party: true } : {}),
        color: this.nameColor(s.s, localSlot),
        sym: this.teamIndex(s.s),
        cls: cls === undefined ? '' : (CLASS_DEFS[CLASS_IDS[cls] ?? 'rocketeer']?.name ?? ''),
        k: s.k,
        d: s.d,
        obj: this.objLabel ? String(s.o ?? 0) : '',
        ping: p?.bot ? '–' : ping === undefined ? '' : String(ping),
        ...(squads ? { pts: String(s.p ?? 0) } : {}),
        leader: this.leaders.has(s.s),
        dead: this.alive.get(s.s) === false,
        me: s.s === localSlot,
      };
    };
    const sorted = [...scores].sort((a, b) => b.k - a.k || (b.o ?? 0) - (a.o ?? 0) || a.d - b.d || a.s - b.s);
    const clock = this.timer.textContent ? ` · ${this.timer.textContent} left` : '';
    const watching = [...this.roster.values()].filter((p) => p.sp).map((p) => p.name);
    const spectators = watching.length ? `Spectating: ${watching.join(', ')}` : '';
    const note = [final && this.nextMap ? this.nextMap : '', this.onlineNote, spectators].filter(Boolean).join(' · ');
    const head = `${final ? 'Final · ' : ''}${this.mapName} · ${this.modeLabel.textContent ?? ''}${final ? '' : clock}`;
    const flags = { cls: this.classes.size > 0, obj: this.objLabel, ping: this.pings.size > 0, ...(squads ? { pts: true } : {}) };
    if (!this.teams) {
      return { head, note, kind: this.coop ? 'coop' : 'ffa', groups: [{ id: 'all', name: '', color: '', score: 0, lead: false, rows: sorted.map(row) }], ...flags };
    }
    const totals = this.teamTotals(scores);
    const top = Math.max(...this.teams.map((t) => totals.get(t.id) ?? 0));
    const mine = this.roster.get(localSlot)?.team;
    const joinable = this.switchTeam.can && !final && !!mine;
    const groups = this.teams.map((t, i) => {
      const rows = sorted.filter((s) => this.roster.get(s.s)?.team === t.id).map(row);
      const sq = squads ? squadGroups(rows, squads, i, localSlot, this.honours, (slot) => this.name(slot)) : null;
      return {
        id: t.id,
        name: t.name,
        color: t.color,
        sym: i,
        score: totals.get(t.id) ?? 0,
        lead: top > 0 && (totals.get(t.id) ?? 0) === top,
        rows: sq ? sq.flatMap((q) => q.rows) : rows,
        ...(sq ? { squads: sq } : {}),
        ...(joinable && t.id !== mine ? { join: this.switchTeam.pending === i ? ('pending' as const) : ('join' as const) } : {}),
      };
    });
    return { head, note, kind: 'teams', groups, ...flags };
  }

  renderPerf(visible: boolean, lines: Record<string, string | number>, server: ServerStats | null, botStates: string[]): void {
    this.perf.hidden = !visible;
    if (!visible) return;
    const out = Object.entries(lines).map(([k, v]) => `${k.padEnd(14)} ${v}`);
    if (server) {
      out.push(
        '',
        `server tick    ${server.tickMsAvg.toFixed(2)} ms avg / ${server.tickMsMax.toFixed(2)} max`,
        `server ai      ${server.aiMsAvg.toFixed(2)} ms`,
        `snapshot       ${server.snapshotBytes} B`,
        `downstream     ${(server.bytesPerSecPerClient / 1024).toFixed(1)} KiB/s`,
        `players        ${server.humans} humans, ${server.bots} bots`,
        `late ticks     ${server.lateTicks}`,
      );
    }
    if (botStates.length) out.push('', 'bots', ...botStates);
    this.perf.textContent = out.join('\n');
  }
}

/** A marker on screen at a world point, or an arrow at the edge pointing the way (`edge`: bearing, radians). */
export interface ScreenMarker {
  id: string;
  x: number;
  y: number;
  color: string;
  label: string;
  icon: string;
  edge?: number;
}

/** A scope's holdover mark (spec §5): `y` below the centre in the reticle's own units (100: the edge), and its label. */
export interface HoldoverMark {
  y: number;
  label: string;
  /** Every 200 m: a longer tick. */
  major?: boolean;
}

/**
 * Holdover marks on a reticle (game/holdover.ts works out where): a short tick on the lower post for each distance,
 * its hundreds of metres beside it. Redrawn only when they move. `k`: line weight (the optic's svg is drawn smaller).
 */
export function drawHoldover(g: HTMLElement | SVGElement, marks: readonly HoldoverMark[], k: number): void {
  const key = marks.map((m) => `${m.y.toFixed(1)}:${m.label}`).join('|');
  if (g.dataset.key === key) return;
  g.dataset.key = key;
  g.innerHTML = marks
    .map((m) => {
      const w = (m.major ? 2.4 : 1.6) * k;
      const y = m.y.toFixed(1);
      return `<line x1="${-w}" y1="${y}" x2="${w}" y2="${y}" stroke-width="${(0.32 * k).toFixed(2)}" /><text x="${(w + 0.8 * k).toFixed(2)}" y="${y}" dy="${(0.9 * k).toFixed(2)}" font-size="${(2.2 * k).toFixed(2)}" stroke="none">${m.label}</text>`;
    })
    .join('');
}
