import type { MatchPhase, RosterEntry, ScoreEntry, ServerStats } from '@chronosplit/shared';
import { slotColor } from './view.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export class Hud {
  private readonly root = $('hud');
  private readonly health = $('health');
  private readonly timer = $('timer');
  private readonly feed = $('feed');
  private readonly banner = $('banner');
  private readonly scoreboard = $('scoreboard');
  private readonly perf = $('perf');
  private readonly hitmarker = $('hitmarker');
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

  setHealth(hp: number, alive: boolean): void {
    this.health.textContent = alive ? String(Math.max(0, hp)) : '';
  }

  setStatus(phase: MatchPhase, timeLeft: number, alive: boolean, winner: string | null): void {
    const m = Math.floor(timeLeft / 60);
    const s = String(timeLeft % 60).padStart(2, '0');
    this.timer.textContent = phase === 'intermission' ? 'Intermission' : timeLeft ? `${m}:${s}` : '';
    if (phase === 'intermission') this.banner.textContent = winner ? `${winner} wins the round` : 'Round over';
    else this.banner.textContent = alive ? '' : 'Respawning…';
  }

  kill(killer: number | null, victim: number, localSlot: number): void {
    const line = document.createElement('div');
    const name = (slot: number | null) => `<span style="color:${slot === null ? '#ccc' : slotColor(slot)}">${escapeHtml(this.name(slot))}</span>`;
    line.innerHTML = killer === null ? `${name(victim)} fell` : `${name(killer)} ✕ ${name(victim)}`;
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
