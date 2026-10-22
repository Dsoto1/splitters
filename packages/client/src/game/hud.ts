import { CORE_WEAPONS, type MatchPhase, type RosterEntry, type ScoreEntry, type ServerStats } from '@chronosplit/shared';
import { slotColor } from './view.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const weaponLabel = (id: string) => CORE_WEAPONS[id]?.displayName ?? '✕';

export class Hud {
  private readonly root = $('hud');
  private readonly health = $('health');
  private readonly timer = $('timer');
  private readonly feed = $('feed');
  private readonly banner = $('banner');
  private readonly scoreboard = $('scoreboard');
  private readonly perf = $('perf');
  private readonly hitmarker = $('hitmarker');
  private readonly armor = $('armor');
  private readonly weaponName = $('weapon-name');
  private readonly ammoCount = $('ammo-count');
  private readonly weaponBar = $('weapon-bar');
  private readonly powerups = $('powerups');
  private readonly pickupMsg = $('pickup-msg');
  private readonly scope = $('scope');
  private pickupTimer?: number;
  private lastWeaponBar = '';
  private roster = new Map<number, RosterEntry>();
  private hitTimer?: number;

  show(): void {
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
    this.health.textContent = '';
    this.armor.textContent = '';
    this.weaponBar.innerHTML = '';
    this.lastWeaponBar = '';
    this.ammoCount.textContent = '';
    this.weaponName.textContent = '';
    this.powerups.innerHTML = '';
    this.scope.hidden = true;
    this.scoreboard.hidden = true;
    this.roster.clear();
  }

  setRoster(players: RosterEntry[]): void {
    this.roster = new Map(players.map((p) => [p.slot, p]));
  }

  name(slot: number | null): string {
    if (slot === null) return 'The arena';
    return this.roster.get(slot)?.name ?? `Player ${slot + 1}`;
  }

  setHealth(hp: number, armor: number, alive: boolean): void {
    this.health.textContent = alive ? String(Math.max(0, hp)) : '';
    this.armor.textContent = alive && armor > 0 ? String(armor) : '';
  }

  /** Held weapon, ammo and the owned-weapons bar. */
  setWeapons(defs: readonly { slot: number; displayName: string; magazine: number }[], owned: ReadonlyMap<number, [number, number]>, held: number, reloading: boolean, alive: boolean): void {
    const def = defs.find((d) => d.slot === held);
    const ammo = owned.get(held);
    this.weaponName.textContent = alive && def ? def.displayName : '';
    if (!alive || !def || !ammo) this.ammoCount.textContent = '';
    else if (def.magazine === 0) this.ammoCount.textContent = '∞';
    else this.ammoCount.textContent = reloading ? 'Reloading…' : `${ammo[0]} / ${ammo[1]}`;
    this.ammoCount.classList.toggle('low', !!def && def.magazine > 0 && !!ammo && ammo[0] <= Math.ceil(def.magazine / 4));
    const key = `${alive}|${held}|${[...owned.keys()].join(',')}`;
    if (key === this.lastWeaponBar) return;
    this.lastWeaponBar = key;
    this.weaponBar.innerHTML = alive
      ? defs.map((d) => `<span class="${owned.has(d.slot) ? 'owned' : ''} ${d.slot === held ? 'held' : ''}" title="${escapeHtml(d.displayName)}">${d.slot}</span>`).join('')
      : '';
  }

  setPowerups(speedSeconds: number, damageSeconds: number): void {
    const parts: string[] = [];
    if (damageSeconds > 0) parts.push(`<span style="color:#d77bff">DOUBLE DAMAGE ${Math.ceil(damageSeconds)}</span>`);
    if (speedSeconds > 0) parts.push(`<span style="color:#5fe0ff">SPEED ${Math.ceil(speedSeconds)}</span>`);
    this.powerups.innerHTML = parts.join('');
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

  setStatus(phase: MatchPhase, timeLeft: number, alive: boolean, winner: string | null): void {
    const m = Math.floor(timeLeft / 60);
    const s = String(timeLeft % 60).padStart(2, '0');
    this.timer.textContent = phase === 'intermission' ? 'Intermission' : timeLeft ? `${m}:${s}` : '';
    if (phase === 'intermission') this.banner.textContent = winner ? `${winner} wins the round` : 'Round over';
    else this.banner.textContent = alive ? '' : 'Respawning…';
  }

  kill(killer: number | null, victim: number, weapon: string, localSlot: number): void {
    const line = document.createElement('div');
    const name = (slot: number | null) => `<span style="color:${slot === null ? '#ccc' : slotColor(slot)}">${escapeHtml(this.name(slot))}</span>`;
    line.innerHTML = killer === null ? `${name(victim)} ${weapon === 'core.fall' ? 'fell' : 'blew themselves up'}` : `${name(killer)} <small>${escapeHtml(weaponLabel(weapon))}</small> ${name(victim)}`;
    if (killer === localSlot || victim === localSlot) line.style.outline = '1px solid rgba(255,255,255,0.5)';
    this.feed.prepend(line);
    while (this.feed.children.length > 5) this.feed.lastChild?.remove();
    window.setTimeout(() => line.remove(), 5000);
  }

  hit(): void {
    this.hitmarker.classList.add('on');
    clearTimeout(this.hitTimer);
    this.hitTimer = window.setTimeout(() => this.hitmarker.classList.remove('on'), 60);
  }

  renderScoreboard(visible: boolean, scores: ScoreEntry[], localSlot: number): void {
    this.scoreboard.hidden = !visible;
    if (!visible) return;
    const rows = [...scores]
      .sort((a, b) => b.k - a.k || a.d - b.d)
      .map((s) => {
        const p = this.roster.get(s.s);
        return `<tr class="${s.s === localSlot ? 'me' : ''}"><td><span style="color:${slotColor(s.s)}">●</span> ${escapeHtml(this.name(s.s))}${p?.bot ? ' <small>(bot)</small>' : ''}</td><td>${s.k}</td><td>${s.d}</td></tr>`;
      })
      .join('');
    this.scoreboard.innerHTML = `<table><tr><th>Player</th><th>Kills</th><th>Deaths</th></tr>${rows}</table>`;
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
