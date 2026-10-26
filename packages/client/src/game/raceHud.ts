import { trackGeometry, type GameEvent, type MapDocument, type RaceSnapshot, type TrackGeometry, type Vec3 } from '@tiletrigger/shared';
import type { Hud } from './hud.ts';
import type { GameView } from './view.ts';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** m:ss.t from milliseconds. */
export function raceTime(ms: number): string {
  if (ms < 0) return '–';
  const t = Math.floor(ms / 100);
  const m = Math.floor(t / 600);
  const s = Math.floor((t % 600) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${t % 10}`;
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;

/**
 * Race mode on the client: lap X/Y, your place, the race clock and your best
 * lap on the status line; a marker on the next checkpoint (an arrow round
 * the screen edge when it's behind you); the countdown, a wrong-way warning
 * and the running order in a panel; announcer lines for laps, best laps and
 * the finish. The session feeds it snapshots, events and frames.
 */
export class RaceHud {
  private rc: RaceSnapshot | undefined;
  private readonly track: TrackGeometry | null;
  private readonly panel: HTMLElement;
  private readonly big: HTMLElement;
  private lastCount = -1;

  constructor(
    private readonly hud: Hud,
    private readonly view: GameView,
    map: MapDocument,
    private readonly slot: () => number,
  ) {
    this.track = trackGeometry(map);
    hud.waitLabel = 'Back on the track in a moment…';
    const root = document.getElementById('hud') ?? document.body;
    this.panel = document.createElement('div');
    this.panel.id = 'race-order';
    this.panel.style.cssText = 'position:absolute;left:12px;top:120px;min-width:170px;padding:6px 8px;background:rgba(10,12,16,.55);border-radius:6px;font:600 13px/1.45 system-ui,sans-serif;color:#e8e8e8;pointer-events:none';
    this.big = document.createElement('div');
    this.big.id = 'race-big';
    this.big.style.cssText = 'position:absolute;left:0;right:0;top:28%;text-align:center;font:800 64px/1 system-ui,sans-serif;color:#ffd34d;text-shadow:0 3px 10px #000;pointer-events:none';
    root.append(this.panel, this.big);
  }

  /** Latest race state (for tests). */
  get state(): RaceSnapshot | undefined {
    return this.rc;
  }

  snapshot(rc: RaceSnapshot | undefined): void {
    if (rc) this.rc = rc;
  }

  event(ev: GameEvent): void {
    if (ev.e !== 'race') return;
    const me = this.slot();
    const laps = this.rc?.laps ?? 1;
    if (ev.a === 'go') this.hud.showMessage('GO!', 1.2);
    else if (ev.s !== me) {
      if (ev.a === 'finish' && ev.n === 1) this.hud.showMessage(`${this.hud.name(ev.s)} wins the race!`, 3);
    } else if (ev.a === 'lap' && ev.n > 1) this.hud.showMessage(ev.n === laps ? 'Final lap!' : `Lap ${ev.n} of ${laps}`, 2);
    else if (ev.a === 'best' && ev.t !== undefined && ev.n > 1) this.hud.showMessage(`Best lap ${raceTime(ev.t)}`, 2);
    else if (ev.a === 'finish') this.hud.showMessage(`You finished ${ordinal(ev.n)}${ev.t !== undefined ? ` · ${raceTime(ev.t)}` : ''}`, 4);
  }

  frame(eye: Vec3 | null, yaw: number): void {
    const rc = this.rc;
    if (!rc) return;
    const me = this.slot();
    const i = rc.r.findIndex((r) => r[0] === me);
    const row = rc.r[i];
    const parts: string[] = [];
    if (row) {
      const [, lap, , finish, best, current] = row;
      parts.push(`<span class="ms" data-race-lap="${lap}" style="color:#ffd34d"><b>⚑</b><em>${finish >= 0 ? 'Finished' : `Lap ${lap}/${rc.laps}`}</em></span>`);
      parts.push(`<span class="ms" data-race-pos="${i + 1}" style="color:#fff"><em>${ordinal(i + 1)} of ${rc.r.length}</em></span>`);
      parts.push(`<span class="ms" style="color:#cfe8ff"><em>${raceTime(finish >= 0 ? finish : rc.t)}${finish < 0 && rc.st ? ` · lap ${raceTime(current)}` : ''}${best >= 0 ? ` · best ${raceTime(best)}` : ''}</em></span>`);
    }
    if (rc.combat) parts.push('<span class="ms" style="color:#ff7a4d"><em>Combat race</em></span>');
    this.hud.setModeStatus(parts.join(''));
    // The next checkpoint: a marker over its arch, or an arrow at the edge of the screen.
    const markers: Parameters<Hud['setModeMarkers']>[0] = [];
    const g = this.track;
    if (row && g && eye && row[3] < 0) {
      const gate = g.gates[row[2]];
      if (gate) {
        const finishLine = g.loop ? gate.index === 0 : gate.index === g.gates.length - 1;
        const label = finishLine ? (row[1] >= rc.laps || !g.loop ? 'Finish' : 'Lap') : `Checkpoint ${gate.index}`;
        const dist = Math.hypot(gate.x - eye.x, gate.z - eye.z);
        const screen = this.view.project({ x: gate.x, y: gate.y + 5, z: gate.z });
        const w = window.innerWidth;
        const h = window.innerHeight;
        const text = `${label} · ${Math.round(dist)} m`;
        if (screen && screen.x > 30 && screen.x < w - 30 && screen.y > 60 && screen.y < h - 30) markers.push({ id: 'race_next', x: screen.x, y: screen.y, color: '#ffd34d', icon: '⚑', label: text });
        else {
          const bearing = Math.atan2(gate.x - eye.x, gate.z - eye.z) - yaw;
          const a = Math.atan2(Math.sin(bearing), Math.cos(bearing));
          markers.push({ id: 'race_next', x: w / 2 + Math.sin(a) * (w / 2 - 70), y: h / 2 - Math.cos(a) * (h / 2 - 70), color: '#ffd34d', icon: '⚑', label: text, edge: a });
        }
      }
    }
    this.hud.setModeMarkers(markers);
    // Countdown, then the wrong-way warning, in big letters.
    const count = rc.st === 0 && rc.cd > 0 ? rc.cd : 0;
    if (count !== this.lastCount) this.lastCount = count;
    const big = count ? String(count) : row && row[6] && row[3] < 0 ? 'WRONG WAY' : '';
    if (this.big.textContent !== big) {
      this.big.textContent = big;
      this.big.style.color = big === 'WRONG WAY' ? '#ff4a3a' : '#ffd34d';
    }
    // Running order (finish times once in).
    const order = rc.r
      .map((r, k) => {
        const name = escapeHtml(r[0] === me ? 'You' : this.hud.name(r[0]));
        const right = r[3] >= 0 ? raceTime(r[3]) : `L${r[1]}`;
        return `<div style="display:flex;gap:10px;justify-content:space-between${r[0] === me ? ';color:#ffd34d' : ''}"><span>${k + 1}. ${name}</span><span>${right}</span></div>`;
      })
      .join('');
    if (this.panel.innerHTML !== order) this.panel.innerHTML = order;
  }

  dispose(): void {
    this.panel.remove();
    this.big.remove();
    this.hud.setModeStatus('');
    this.hud.setModeMarkers([]);
    this.hud.waitLabel = 'Respawning…';
  }
}
