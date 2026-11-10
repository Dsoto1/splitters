import type { Scene } from '@babylonjs/core/scene';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { BotDebugBot, BotDebugFrame } from '@tiletrigger/shared/match';

/**
 * The in-game bot debug view (`?botdebug=1`, host or offline only; BOT_AI_PLAN.md Phase D item 4; docs/BOTS.md, "Bot
 * debug view"). From the frames the match sends four times a second (shared bots/debugView.ts):
 * - in the world: each bot's route (its team's colour), a thin line on to its goal, where it remembers enemies (orange
 *   posts), its scan's angles when holding a spot (cyan), and every failed route search (a red cross where it was
 *   going, a dark red line from where it asked);
 * - over each bot: its name, state and what it did; "stopped:" and why when it meant to stand or couldn't move;
 * - a panel: every bot's team, role, skill, state, choice and its top scores, why it stopped, failed searches, stucks.
 * Nothing of it exists unless asked for.
 */
const TEAM_COLOURS = ['#4aa3ff', '#ff5a4a', '#5ad16a', '#ffd23f', '#c77dff', '#ff9f43'];
/** Labels further than this from the camera (m) are hidden. */
const LABEL_RANGE = 90;

const hex = (h: string, a = 1): Color4 => {
  const n = parseInt(h.slice(1), 16);
  return new Color4(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a);
};

export class BotDebugView {
  private lines: LinesMesh | null = null;
  private frame: BotDebugFrame | null = null;
  private readonly root: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly labels = new Map<number, HTMLDivElement>();
  private readonly teams = new Map<string, number>();
  private readonly p = new Vector3();

  constructor(
    private readonly scene: Scene,
    private readonly camera: () => Camera | null,
    private readonly name: (slot: number) => string,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'botdebug';
    this.root.setAttribute('data-testid', 'botdebug');
    Object.assign(this.root.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '40', font: '11px/1.25 ui-monospace, Menlo, monospace', color: '#fff' });
    this.panel = document.createElement('div');
    this.panel.className = 'botdebug-panel';
    Object.assign(this.panel.style, { position: 'absolute', right: '8px', top: '112px', maxHeight: '60vh', overflow: 'hidden', background: 'rgba(0,0,0,0.62)', padding: '6px 8px', borderRadius: '4px', whiteSpace: 'pre' });
    this.root.appendChild(this.panel);
    document.body.appendChild(this.root);
  }

  private colour(team: string | null): string {
    if (!team) return '#dddddd';
    let i = this.teams.get(team);
    if (i === undefined) this.teams.set(team, (i = this.teams.size));
    return TEAM_COLOURS[i % TEAM_COLOURS.length]!;
  }

  /** A new frame from the match: the world's lines rebuilt, the panel rewritten. */
  update(f: BotDebugFrame): void {
    this.frame = f;
    this.lines?.dispose();
    this.lines = null;
    const segs: Vector3[][] = [];
    const cols: Color4[][] = [];
    const add = (pts: { x: number; y: number; z: number }[], c: Color4, up = 0.15) => {
      if (pts.length < 2) return;
      segs.push(pts.map((p) => new Vector3(p.x, p.y + up, p.z)));
      cols.push(pts.map(() => c));
    };
    for (const b of f.bots) {
      if (!b.alive) continue;
      const c = hex(this.colour(b.team));
      const route = [b.pos, ...b.path];
      add(route, c);
      const end = route[route.length - 1]!;
      if (b.goal && Math.hypot(b.goal.x - end.x, b.goal.z - end.z) > 0.5) add([end, b.goal], hex(this.colour(b.team), 0.4), 0.3);
      for (const m of b.memory) add([m.pos, { x: m.pos.x, y: m.pos.y + 2.2, z: m.pos.z }], hex(m.source === 'shot' ? '#ff7a00' : m.source === 'callout' ? '#ffb347' : '#ffcf80'), 0);
      if (b.watch) for (const a of b.watch.looks) add([b.watch.spot, { x: b.watch.spot.x + Math.sin(a) * 4, y: b.watch.spot.y, z: b.watch.spot.z + Math.cos(a) * 4 }], hex('#3de0ff'), 1.5);
    }
    const red = hex('#ff2a2a');
    for (const x of f.failed) {
      const g = x.goal;
      add([{ x: g.x - 0.6, y: g.y, z: g.z - 0.6 }, { x: g.x + 0.6, y: g.y, z: g.z + 0.6 }], red, 0.2);
      add([{ x: g.x - 0.6, y: g.y, z: g.z + 0.6 }, { x: g.x + 0.6, y: g.y, z: g.z - 0.6 }], red, 0.2);
      add([x.from, g], hex('#8a1010', 0.6), 0.25);
    }
    if (segs.length) {
      const mesh = CreateLineSystem('botdebug_lines', { lines: segs, colors: cols }, this.scene);
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.renderingGroupId = 1;
      this.lines = mesh;
    }
    this.panel.textContent = this.table(f);
    // Labels for bots no longer in the match go.
    const live = new Set(f.bots.map((b) => b.slot));
    for (const [slot, el] of this.labels) {
      if (live.has(slot)) continue;
      el.remove();
      this.labels.delete(slot);
    }
  }

  /** Why a bot stood (empty: it is on its way, or fighting on the move). */
  static stopped(b: BotDebugBot): string {
    if (!b.alive) return 'dead';
    if (b.moving) return '';
    return b.doing;
  }

  private table(f: BotDebugFrame): string {
    const rows = [`bots ${f.bots.length}  failed searches ${f.failed.length}  callouts (3 s) ${f.callouts.length}`, 'name           team  role    skill  state       doing       choice   top scores                stopped     fails stuck'];
    for (const b of f.bots) {
      const top = Object.entries(b.scores)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 3)
        .map(([k, v]) => `${k} ${v.toFixed(1)}`)
        .join(', ');
      rows.push(
        [
          this.name(b.slot).slice(0, 14).padEnd(14),
          (b.team ?? '-').slice(0, 5).padEnd(5),
          (b.role ?? '-').slice(0, 7).padEnd(7),
          b.skill.padEnd(6),
          b.state.padEnd(11),
          b.doing.padEnd(11),
          (b.option ?? '-').padEnd(8),
          top.slice(0, 25).padEnd(25),
          BotDebugView.stopped(b).padEnd(11),
          String(b.failures).padStart(5),
          String(b.stuck).padStart(5),
        ].join(' '),
      );
    }
    return rows.join('\n');
  }

  /** Every frame: the labels over the bots, where the camera sees them. */
  draw(): void {
    const f = this.frame;
    const cam = this.camera();
    if (!f || !cam) return;
    const engine = this.scene.getEngine();
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const canvas = engine.getRenderingCanvas();
    const sx = (canvas?.clientWidth ?? w) / w;
    const sy = (canvas?.clientHeight ?? h) / h;
    const rect = canvas?.getBoundingClientRect();
    const vp = cam.viewport.toGlobal(w, h);
    const tm = this.scene.getTransformMatrix();
    const eye = cam.globalPosition;
    for (const b of f.bots) {
      let el = this.labels.get(b.slot);
      if (!el) {
        el = document.createElement('div');
        Object.assign(el.style, { position: 'absolute', transform: 'translate(-50%, -100%)', background: 'rgba(0,0,0,0.55)', padding: '1px 4px', borderRadius: '3px', whiteSpace: 'pre', textAlign: 'center' });
        this.root.appendChild(el);
        this.labels.set(b.slot, el);
      }
      this.p.set(b.pos.x, b.pos.y + 2.3, b.pos.z);
      const far = Vector3.Distance(this.p, eye);
      const s = Vector3.Project(this.p, Matrix.IdentityReadOnly, tm, vp);
      if (!b.alive || far > LABEL_RANGE || s.z < 0 || s.z > 1) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      el.style.left = `${(rect?.left ?? 0) + s.x * sx}px`;
      el.style.top = `${(rect?.top ?? 0) + s.y * sy}px`;
      el.style.borderBottom = `2px solid ${this.colour(b.team)}`;
      const why = BotDebugView.stopped(b);
      const goal = b.goal ? ` ${Math.round(Math.hypot(b.goal.x - b.pos.x, b.goal.z - b.pos.z))} m` : '';
      const text = `${this.name(b.slot)}\n${b.state}/${b.doing}${goal}${why ? `\nstopped: ${why}` : ''}`;
      if (el.textContent !== text) el.textContent = text;
    }
  }

  dispose(): void {
    this.lines?.dispose();
    this.lines = null;
    this.root.remove();
    this.labels.clear();
  }
}

/** Whether the page asked for the bot debug view (`?botdebug=1`). */
export function botDebugWanted(): boolean {
  try {
    return new URLSearchParams(location.search).get('botdebug') === '1';
  } catch {
    return false;
  }
}
