import { CORE_WEAPONS, NPC_ID_BASE, weaponByCode, type Faction, type MatchPhase, type RosterEntry, type ScoreEntry, type ServerStats } from '@chronosplit/shared';
import { slotColor } from './view.ts';
import { applyCrosshair, applyHitmarker } from './crosshair.ts';
import { weaponIcon } from '../frontend/weaponIcons.ts';
import { Minimap } from './minimap.ts';

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
  'core.barrel': 'was caught in a barrel blast',
  'core.fall': 'fell',
  'core.lava': 'melted in lava',
  'core.acid': 'dissolved in acid',
  'core.drown': 'drowned',
};
const weaponLabel = (id: string) => CORE_WEAPONS[id]?.displayName ?? (id === 'core.barrel' ? 'Barrel' : '✕');

export class Hud {
  private readonly root = $('hud');
  private readonly health = $('health');
  private readonly timer = $('timer');
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
  private readonly perf = $('perf');
  private readonly hitmarker = $('hitmarker');
  private readonly armor = $('armor');
  private readonly weaponName = $('weapon-name');
  private readonly ammoCount = $('ammo-count');
  private readonly altEl = $('ammo-alt');
  private readonly throwEl = $('throwable');
  private readonly weaponBar = $('weapon-bar');
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
  private hitTimer?: number;

  show(): void {
    applyCrosshair();
    applyHitmarker();
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
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
    this.scoreboard.hidden = true;
    this.objectives.replaceChildren();
    this.lastObjectives = '';
    this.message.classList.remove('on');
    this.setPrompt(null);
    this.setTimers([]);
    this.marker.hidden = true;
    this.roster.clear();
  }

  setRoster(players: RosterEntry[]): void {
    this.roster = new Map(players.map((p) => [p.slot, p]));
  }

  setTeams(teams: readonly Faction[] | null): void {
    this.teams = teams;
  }

  teamById(id: string | null): Faction | undefined {
    return id ? this.teams?.find((t) => t.id === id) : undefined;
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
  setModeMarkers(list: { id: string; x: number; y: number; color: string; label: string; icon: string; edge?: number }[]): void {
    const seen = new Set<string>();
    for (const m of list) {
      seen.add(m.id);
      let el = this.modeMarkers.querySelector<HTMLElement>(`[data-id="${m.id}"]`);
      if (!el) {
        el = document.createElement('div');
        el.dataset.id = m.id;
        el.className = 'mode-marker';
        el.innerHTML = '<i></i><b></b><span></span>';
        this.modeMarkers.append(el);
      }
      el.style.left = `${m.x}px`;
      el.style.top = `${m.y}px`;
      el.style.color = m.color;
      el.classList.toggle('edge', m.edge !== undefined);
      (el.firstElementChild as HTMLElement).style.transform = m.edge !== undefined ? `rotate(${m.edge}rad)` : '';
      el.querySelector('b')!.textContent = m.icon;
      el.querySelector('span')!.textContent = m.label;
    }
    for (const el of [...this.modeMarkers.children] as HTMLElement[]) if (!seen.has(el.dataset.id ?? '')) el.remove();
  }

  /** Team scores: the objective mode's, else kills per team from the per-player scores. */
  teamTotals(scores: readonly ScoreEntry[]): Map<string, number> {
    if (this.modeScores && this.teams) return new Map(this.teams.map((t, i) => [t.id, this.modeScores![i] ?? 0]));
    const out = new Map<string, number>((this.teams ?? []).map((t) => [t.id, 0]));
    for (const s of scores) {
      const t = this.roster.get(s.s)?.team;
      if (t && out.has(t)) out.set(t, out.get(t)! + s.k);
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
    const title = document.querySelector('#pause .pause-title');
    if (title) title.innerHTML = `Paused <small>${escapeHtml(name)} · ${escapeHtml(this.modeLabel.textContent ?? '')}</small>`;
  }

  setPortrait(src: string): void {
    this.portrait.src = src;
  }

  /**
   * The scorebar's boxes either side of the timer (reference board): your team
   * and theirs in Team Deathmatch; you and the leader in Deathmatch; nothing
   * in co-op.
   */
  setTeamScore(scores: readonly ScoreEntry[], localSlot: number, limit: number, coop = false): void {
    let left = '';
    let right = '';
    const box = (value: number, label: string, color: string) => `<b style="background:${color}">${value}</b><small>${escapeHtml(label)}</small>`;
    if (this.teams) {
      // Your team on the left; on the right the strongest other team (with 3+ teams, the leader among them).
      const totals = this.teamTotals(scores);
      const mine = this.roster.get(localSlot)?.team;
      const own = this.teams.find((t) => t.id === mine) ?? this.teams[0]!;
      const rival = this.teams.filter((t) => t.id !== own.id).sort((x, y) => (totals.get(y.id) ?? 0) - (totals.get(x.id) ?? 0))[0]!;
      left = box(totals.get(own.id) ?? 0, own.name, own.color);
      right = box(totals.get(rival.id) ?? 0, this.teams.length > 2 ? `${rival.name} · lead` : rival.name, rival.color);
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
  showTarget(name: string, frac: number, color: string): void {
    this.target.hidden = false;
    $('target-name').textContent = name;
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
  /** The vehicle you're in: its name and health (null hides the panel). */
  setVehicle(v: { name: string; pct: number } | null): void {
    const el = document.getElementById('vehicle-hp');
    if (!el) return;
    el.hidden = !v;
    if (!v) return;
    el.querySelector('span')!.textContent = v.name;
    const bar = el.querySelector('b')!;
    bar.style.setProperty('--hp', `${Math.max(0, Math.min(100, v.pct))}%`);
    bar.style.setProperty('--hp-color', hpColor(v.pct));
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
    this.throwEl.title = t ? (t.kind === 'mine' ? 'Proximity mines (hold G to aim, let go to throw)' : 'Grenades (hold G to aim, let go to throw)') : '';
  }

  /** `owned` and `held` are weapon codes; the bar shows slots 1–9, with a pip per extra weapon carried in a slot. */
  /** Riding as a passenger or gunner: the seat's gun (heat) instead of your own. */
  /** Swap the crosshair for a gunner's reticle while on a mounted gun; `heat` (0-100) fills its ring. */
  setGunnerReticle(heat: number | null): void {
    const el = document.getElementById('crosshair');
    if (!el) return;
    el.classList.toggle('gunner', heat !== null);
    if (heat !== null) el.style.setProperty('--heat', String(Math.min(100, heat)));
  }

  setMountedGun(name: string, heat: number): void {
    this.weaponName.textContent = name;
    this.ammoReserve.textContent = '';
    this.ammoCount.textContent = heat >= 100 ? 'OVERHEAT' : `${heat}°`;
    this.ammoCount.classList.toggle('reloading', heat >= 100);
    this.altEl.textContent = '';
  }

  setWeapons(owned: ReadonlyMap<number, readonly [number, number, number, number]>, held: number, reloading: boolean, alive: boolean, driving = false): void {
    if (driving) {
      this.weaponName.textContent = 'Driving';
      this.ammoCount.textContent = '';
      this.ammoReserve.textContent = '';
      this.altEl.textContent = '';
      return;
    }
    const def = weaponByCode(held);
    const altDef = def?.alt;
    const altText = alive && altDef ? (altDef.ammo === 'own' ? `RMB ${altDef.label} · ${owned.get(held)?.[2] ?? 0}` : `RMB ${altDef.label}`) : '';
    if (this.altEl.textContent !== altText) this.altEl.textContent = altText;
    const ammo = owned.get(held);
    this.weaponName.textContent = alive && def ? def.displayName : '';
    this.ammoReserve.textContent = alive && def && ammo && def.magazine > 0 && !reloading ? String(ammo[1]) : '';
    if (!alive || !def || !ammo) this.ammoCount.textContent = '';
    else if (def.heat) this.ammoCount.textContent = ammo[3] >= 100 ? 'OVERHEAT' : `${Math.round(ammo[3])}°`;
    else if (def.magazine === 0) this.ammoCount.textContent = '∞';
    else this.ammoCount.textContent = reloading ? 'Reloading…' : String(ammo[0]);
    this.ammoCount.classList.toggle('reloading', reloading || (!!def?.heat && !!ammo && ammo[3] >= 100));
    this.ammoCount.classList.toggle('low', !!def && def.magazine > 0 && !!ammo && ammo[0] <= Math.ceil(def.magazine / 4));
    const key = `${alive}|${held}|${[...owned.keys()].join(',')}`;
    if (key === this.lastWeaponBar) return;
    this.lastWeaponBar = key;
    const bySlot = new Map<number, string[]>();
    for (const code of owned.keys()) {
      const w = weaponByCode(code);
      if (w) bySlot.set(w.slot, [...(bySlot.get(w.slot) ?? []), w.displayName]);
    }
    this.weaponBar.innerHTML = alive
      ? [1, 2, 3, 4, 5, 6, 7, 8, 9]
          .map((slot) => {
            const names = bySlot.get(slot) ?? [];
            const pips = names.length > 1 ? `<i>${'•'.repeat(Math.min(4, names.length))}</i>` : '';
            return `<span class="${names.length ? 'owned' : ''} ${def?.slot === slot ? 'held' : ''}" title="${escapeHtml(names.join(', '))}">${slot}${pips}</span>`;
          })
          .join('')
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

  setPowerups(speedSeconds: number, damageSeconds: number, jetFuel: number | null = null): void {
    const parts: string[] = [];
    // Jetpack fuel as a little gauge: ten blocks.
    if (jetFuel !== null) {
      const n = Math.round(jetFuel * 10);
      parts.push(`<span style="color:#ffa040">JETPACK ${'▮'.repeat(n)}<span style="opacity:.3">${'▮'.repeat(10 - n)}</span></span>`);
    }
    if (damageSeconds > 0) parts.push(`<span style="color:#d77bff">DOUBLE DAMAGE ${Math.ceil(damageSeconds)}</span>`);
    if (speedSeconds > 0) parts.push(`<span style="color:#5fe0ff">SPEED ${Math.ceil(speedSeconds)}</span>`);
    const html = parts.join('');
    if (html !== this.powerups.innerHTML) this.powerups.innerHTML = html;
  }

  pickup(text: string): void {
    this.pickupMsg.textContent = text;
    this.pickupMsg.classList.add('on');
    clearTimeout(this.pickupTimer);
    this.pickupTimer = window.setTimeout(() => this.pickupMsg.classList.remove('on'), 1200);
  }

  setScope(on: boolean): void {
    this.scope.hidden = !on;
  }

  /** Breath meter under the scope (spent: it has to recover before you can hold again). */
  setBreath(breath: number, spent: boolean): void {
    if (this.scope.hidden) return;
    this.scope.style.setProperty('--breath', `${Math.round(breath * 100)}%`);
    this.scope.classList.toggle('spent', spent);
  }

  setStatus(phase: MatchPhase, timeLeft: number, alive: boolean, winner: string | null, outcome: 'victory' | 'defeat' | null = null): void {
    const m = Math.floor(timeLeft / 60);
    const s = String(timeLeft % 60).padStart(2, '0');
    this.timer.textContent = phase === 'intermission' ? 'Intermission' : timeLeft ? `${m}:${s}` : '';
    if (phase === 'intermission') this.banner.textContent = outcome === 'victory' ? 'Mission complete' : outcome === 'defeat' ? 'Mission failed' : winner ? `${winner} wins the round` : 'Round over';
    else this.banner.textContent = alive ? '' : this.waitLabel;
  }

  /** Shown while you are dead ("Respawning…", or "Next round" in Elimination). */
  waitLabel = 'Respawning…';

  kill(killer: number | null, victim: number, weapon: string, localSlot: number, headshot = false): void {
    const line = document.createElement('div');
    const color = (slot: number | null) => (slot === null ? '#ccc' : (this.team(slot)?.color ?? slotColor(slot)));
    const name = (slot: number | null) => `<span style="color:${color(slot)}">${escapeHtml(this.name(slot))}</span>`;
    line.innerHTML = killer === null ? `${name(victim)} ${HAZARD_DEATHS[weapon] ?? 'blew themselves up'}` : `${name(killer)} <small>${escapeHtml(weaponLabel(weapon))}</small> ${name(victim)}`;
    // Weapon icon between the names (reference board), rendered from the weapon's model.
    const icon = killer !== null ? weaponIcon(weapon) : null;
    const label = line.querySelector('small');
    if (icon && label) {
      icon.title = weaponLabel(weapon);
      label.replaceWith(icon);
    }
    if (killer === localSlot || victim === localSlot) line.style.outline = '1px solid rgba(255,255,255,0.5)';
    if (headshot && killer !== null) line.insertAdjacentHTML('beforeend', ' <b class="hs" title="Headshot">✛</b>');
    this.feed.prepend(line);
    while (this.feed.children.length > 5) this.feed.lastChild?.remove();
    window.setTimeout(() => line.remove(), 5000);
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
  setPrompt(text: string | null, denied = false): void {
    const key = `${text}|${denied}`;
    if (key === this.lastPrompt) return;
    this.lastPrompt = key;
    this.prompt.classList.toggle('denied', denied);
    this.prompt.innerHTML = text === null ? '' : denied ? escapeHtml(text) : `<kbd>E</kbd>${escapeHtml(text)}`;
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

  /** Hit confirmation on the crosshair (red and longer for a head hit). */
  hit(head = false): void {
    // Restart the pop animation on every hit.
    this.hitmarker.classList.remove('on');
    void this.hitmarker.offsetWidth;
    this.hitmarker.classList.add('on');
    this.hitmarker.classList.toggle('head', head);
    clearTimeout(this.hitTimer);
    this.hitTimer = window.setTimeout(() => this.hitmarker.classList.remove('on', 'head'), head ? 220 : 140);
  }

  /**
   * You took damage: the screen edge flashes red, with an arc pointing at the
   * attacker when we know where it came from (radians, 0 = straight ahead, + = right).
   */
  hurt(direction: number | null, amount: number): void {
    const el = document.getElementById('hurt');
    if (!el) return;
    el.style.setProperty('--hurt-dir', `${direction ?? 0}rad`);
    el.classList.toggle('dir', direction !== null);
    el.style.setProperty('opacity', String(Math.min(1, 0.45 + amount / 40)));
    el.classList.add('on');
    clearTimeout(this.hurtTimer);
    this.hurtTimer = window.setTimeout(() => {
      el.classList.remove('on');
      el.style.removeProperty('opacity');
    }, 90);
  }
  private hurtTimer = 0;

  /** "HEADSHOT" call-out for a kill you made with a head hit. */
  headshot(): void {
    const el = document.getElementById('headshot');
    if (!el) return;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
  }

  renderScoreboard(visible: boolean, scores: ScoreEntry[], localSlot: number): void {
    this.scoreboard.hidden = !visible;
    if (!visible) return;
    const row = (s: ScoreEntry) => {
      const p = this.roster.get(s.s);
      const color = this.team(s.s)?.color ?? slotColor(s.s);
      return `<tr class="${s.s === localSlot ? 'me' : ''}"><td><span style="color:${color}">●</span> ${escapeHtml(this.name(s.s))}${p?.bot ? ' <small>(bot)</small>' : ''}</td><td>${s.k}</td><td>${s.d}</td></tr>`;
    };
    const sorted = [...scores].sort((a, b) => b.k - a.k || a.d - b.d);
    // Map, mode and time left over the tables.
    const clock = this.timer.textContent ? ` · ${escapeHtml(this.timer.textContent)} left` : '';
    const head = `<div class="sb-head"><b>${escapeHtml(this.mapName)}</b> · ${escapeHtml(this.modeLabel.textContent ?? '')}${clock}</div>`;
    if (!this.teams) {
      this.scoreboard.innerHTML = `${head}<table><tr><th>Player</th><th>Kills</th><th>Deaths</th></tr>${sorted.map(row).join('')}</table>`;
      return;
    }
    // Team Deathmatch: one table per team, the higher score first.
    const totals = this.teamTotals(scores);
    const teams = [...this.teams].sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0));
    this.scoreboard.classList.toggle('many', teams.length > 2);
    this.scoreboard.innerHTML = head + teams
      .map((t) => {
        const rows = sorted.filter((s) => this.roster.get(s.s)?.team === t.id).map(row).join('');
        return `<table class="team"><tr><th style="color:${t.color}">${escapeHtml(t.name)} <b>${totals.get(t.id) ?? 0}</b></th><th>Kills</th><th>Deaths</th></tr>${rows}</table>`;
      })
      .join('');
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
