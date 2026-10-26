import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import {
  BUILDER_WEAPON,
  FORT_BARRIER_HALF,
  FORT_BUILD,
  FORT_FLAG_CLEARANCE,
  FORT_MAX_PIECES,
  FORT_PIECES,
  FORT_PIECE_KINDS,
  FORT_SPAWN_CLEARANCE,
  fortAimPlacement,
  fortBounds,
  fortFlagBases,
  fortMidfield,
  fortPieceBoxes,
  fortPlacementProblem,
  type Faction,
  type FortPieceKind,
  type FortPieceState,
  type MapDocument,
  type ModeSnapshot,
  type PhysicsWorld,
  type Vec3,
} from '@tiletrigger/shared';
import type { AudioSystem } from '../audio/audio.ts';
import type { RemotePose } from './interpolation.ts';
import type { GameView } from './view.ts';

/** Colour of each piece (human-readable tiers: wood, steel, canvas). */
const PIECE_COLOR: Record<FortPieceKind, string> = {
  block: '#a0723f',
  plank: '#b3854d',
  wall: '#8f6436',
  metal_wall: '#7d8791',
  ramp: '#a87a45',
  stairs: '#9c6e3c',
  crate: '#5f6b45',
  sandbags: '#b39b6b',
};

interface ClientPiece extends FortPieceState {
  node: TransformNode;
  colliders: ReturnType<PhysicsWorld['createBox']>[];
  health: number;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Fort Wars on the client: the pieces (drawn from boxes, with colliders in
 * the prediction world so walking into a wall predicts like on the server),
 * the midfield force field during the build phase, the Builder's ghost
 * preview (green where it can go, red with the reason where it can't), and
 * the panel with the phase timer, build points, team piece counts and the
 * piece picker (number keys or the wheel; R turns the piece).
 */
export class FortsClient {
  /** Picked piece (FORT_PIECE_KINDS index) and quarter turns. */
  kind = 0;
  rot = 0;
  fo: NonNullable<ModeSnapshot['fo']> | null = null;
  readonly pieces = new Map<number, ClientPiece>();
  private readonly midfield: ReturnType<typeof fortMidfield> | null;
  private readonly bases: [Vec3, Vec3] | null;
  private readonly spawns: Vec3[];
  private barrier: { body: ReturnType<PhysicsWorld['createBox']>; node: TransformNode } | null = null;
  private readonly materials = new Map<string, StandardMaterial>();
  private ghost: { node: TransformNode; key: string } | null = null;
  private ghostOk: StandardMaterial | null = null;
  private ghostBad: StandardMaterial | null = null;
  private readonly panel: HTMLElement;
  /** Why the ghost can't go where it is (shown under the picker), or ''. */
  why = '';
  private lastPanel = '';
  private loaded = false;

  constructor(
    private readonly view: GameView,
    private readonly physics: PhysicsWorld,
    private readonly map: MapDocument,
    private readonly teams: readonly Faction[],
    private readonly myTeam: () => string | null,
    private readonly audio: AudioSystem | null,
  ) {
    this.bases = fortFlagBases(map, teams);
    this.midfield = this.bases ? fortMidfield(this.bases[0], this.bases[1]) : null;
    this.spawns = map.entities.filter((e) => e.kind === 'spawn').map((e) => ({ x: e.position[0], y: e.position[1], z: e.position[2] }));
    this.panel = document.createElement('div');
    this.panel.id = 'fort-panel';
    (document.getElementById('hud') ?? document.body).append(this.panel);
  }

  private get scene(): Scene {
    return this.view.scene;
  }

  get pieceKind(): FortPieceKind {
    return FORT_PIECE_KINDS[this.kind] ?? 'block';
  }

  /** The `build` field for inputs: piece plus quarter turns × 16. */
  get code(): number {
    return this.kind + this.rot * 16;
  }

  get building(): boolean {
    return this.fo?.[0] === FORT_BUILD;
  }

  /** Is this the Builder in hand during the build phase? */
  holding(held: number, heldId: string | undefined): boolean {
    void held;
    return this.building && heldId === BUILDER_WEAPON;
  }

  pick(i: number): void {
    if (i >= 0 && i < FORT_PIECE_KINDS.length) this.kind = i;
  }

  cycle(steps: number): void {
    const n = FORT_PIECE_KINDS.length;
    this.kind = (((this.kind + Math.sign(steps)) % n) + n) % n;
  }

  rotate(): void {
    this.rot = (this.rot + 1) % 4;
  }

  private teamIndex(): number {
    const id = this.myTeam();
    return this.teams.slice(0, 2).findIndex((t) => t.id === id);
  }

  // ---------------------------------------------------------------- snapshots

  apply(md: ModeSnapshot | undefined): void {
    if (!md?.fo) return;
    this.fo = md.fo;
    this.setBarrier(md.fo[0] === FORT_BUILD);
    if (md.fp) this.applyPieces(md.fp);
  }

  private applyPieces(list: NonNullable<ModeSnapshot['fp']>): void {
    const seen = new Set<number>();
    let changed = false;
    // The first list (on joining) goes up silently.
    const quiet = !this.loaded;
    this.loaded = true;
    for (const [id, k, team, x, y, z, rot, hp] of list) {
      seen.add(id);
      const kind = FORT_PIECE_KINDS[k];
      if (!kind) continue;
      const have = this.pieces.get(id);
      if (have) {
        if (have.health !== hp) {
          have.health = hp;
          this.paint(have);
        }
        continue;
      }
      const base = { x, y, z };
      const boxes = fortPieceBoxes(kind, rot, base);
      const colliders = boxes.map((b) => this.physics.createBox(centre(b), half(b)));
      const piece: ClientPiece = { id, kind, team, base, rot, boxes, colliders, health: hp, node: new TransformNode(`fort_${id}`, this.scene) };
      this.build(piece);
      this.pieces.set(id, piece);
      changed = true;
      if (!quiet) this.audio?.play('impact.thud', { at: centre(fortBounds(boxes)), gain: 0.6 });
    }
    for (const [id, p] of this.pieces) {
      if (seen.has(id)) continue;
      for (const c of p.colliders) this.physics.removeCollider(c);
      p.node.dispose();
      this.pieces.delete(id);
      changed = true;
      const b = fortBounds(p.boxes);
      const at = centre(b);
      // Broken (combat) or picked up (build): splinters either way, louder when it breaks.
      this.view.debris(at, PIECE_COLOR[p.kind], Math.min(1.2, 0.4 + (b.max.y - b.min.y) * 0.3));
      if (!this.building) this.audio?.play(FORT_PIECES[p.kind].tier === 'metal' ? 'impact.heavy' : 'break.wall', { at });
    }
    if (changed) this.physics.commit();
  }

  private material(kind: FortPieceKind, shade: number): StandardMaterial {
    const key = `${kind}_${shade}`;
    let m = this.materials.get(key);
    if (!m) {
      m = new StandardMaterial(`fort_${key}`, this.scene);
      m.diffuseColor = Color3.FromHexString(PIECE_COLOR[kind]).scale([1, 0.72, 0.48][shade]!);
      m.specularColor = FORT_PIECES[kind].tier === 'metal' ? new Color3(0.35, 0.35, 0.35) : new Color3(0.05, 0.05, 0.05);
      this.materials.set(key, m);
    }
    return m;
  }

  private teamMaterial(team: number): StandardMaterial {
    const key = `team_${team}`;
    let m = this.materials.get(key);
    if (!m) {
      m = new StandardMaterial(`fort_${key}`, this.scene);
      const c = Color3.FromHexString(this.teams[team]?.color ?? '#ffffff');
      m.diffuseColor = c;
      m.emissiveColor = c.scale(0.35);
      this.materials.set(key, m);
    }
    return m;
  }

  /** Boxes for each part, a sloped deck on ramps, and a strip of team colour along the top. */
  private build(p: ClientPiece): void {
    const mat = this.material(p.kind, 0);
    p.boxes.forEach((b, i) => {
      const box = CreateBox(`fort_${p.id}_${i}`, { width: b.max.x - b.min.x, height: b.max.y - b.min.y, depth: b.max.z - b.min.z }, this.scene);
      box.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
      box.material = mat;
      box.parent = p.node;
      box.receiveShadows = true;
    });
    const def = FORT_PIECES[p.kind];
    const all = fortBounds(p.boxes);
    if (def.rise === 'ramp') {
      // A smooth deck over the little steps.
      const [w, h, d] = def.size;
      const deck = CreateBox(`fort_${p.id}_deck`, { width: w, height: 0.14, depth: Math.hypot(d, h) }, this.scene);
      const pivot = new TransformNode(`fort_${p.id}_pivot`, this.scene);
      pivot.position.set(p.base.x, p.base.y, p.base.z);
      pivot.rotation.y = (p.rot * Math.PI) / 2;
      pivot.parent = p.node;
      deck.parent = pivot;
      deck.position.set(0, h / 2 + 0.08, 0);
      deck.rotation.x = -Math.atan2(h, d);
      deck.material = mat;
    } else if (!def.rise) {
      const strip = CreateBox(`fort_${p.id}_team`, { width: all.max.x - all.min.x + 0.02, height: 0.06, depth: all.max.z - all.min.z + 0.02 }, this.scene);
      strip.position.set((all.min.x + all.max.x) / 2, all.max.y - 0.03, (all.min.z + all.max.z) / 2);
      strip.material = this.teamMaterial(p.team);
      strip.parent = p.node;
    }
    this.paint(p);
  }

  /** Darker as it takes damage. */
  private paint(p: ClientPiece): void {
    const shade = p.health > 66 ? 0 : p.health > 33 ? 1 : 2;
    const mat = this.material(p.kind, shade);
    for (const m of p.node.getChildMeshes()) if (!m.name.endsWith('_team')) m.material = mat;
  }

  private setBarrier(on: boolean): void {
    if (!this.midfield) return;
    if (on && !this.barrier) {
      const m = this.midfield;
      const body = this.physics.createBox(m.mid, FORT_BARRIER_HALF, m.yaw);
      this.physics.commit();
      const b = this.map.bounds;
      const length = b ? Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1]) : 300;
      const node = new TransformNode('fort_barrier', this.scene);
      const wall = CreateBox('fort_barrier_field', { width: length, height: 16, depth: 0.05 }, this.scene);
      const mat = new StandardMaterial('fort_barrier', this.scene);
      mat.diffuseColor = Color3.FromHexString('#4fd3ff');
      mat.emissiveColor = Color3.FromHexString('#2aa8ff');
      mat.alpha = 0.16;
      mat.backFaceCulling = false;
      wall.material = mat;
      wall.parent = node;
      wall.position.y = 6;
      wall.isPickable = false;
      node.position.set(m.mid.x, m.mid.y, m.mid.z);
      node.rotation.y = m.yaw;
      this.barrier = { body, node };
    } else if (!on && this.barrier) {
      this.physics.removeCollider(this.barrier.body);
      this.physics.commit();
      this.barrier.node.getChildMeshes().forEach((m) => m.material?.dispose());
      this.barrier.node.dispose();
      this.barrier = null;
    }
  }

  get barrierUp(): boolean {
    return this.barrier !== null;
  }

  // ---------------------------------------------------------------- per frame

  /**
   * Ghost preview and panel. `eye` is null when dead; `holding` while the
   * Builder is in hand in the build phase.
   */
  frame(eye: Vec3 | null, yaw: number, pitch: number, holding: boolean, poses: readonly RemotePose[], self: Vec3 | null): void {
    const team = this.teamIndex();
    let base: Vec3 | null = null;
    this.why = '';
    if (holding && eye && team >= 0 && this.midfield && this.bases && this.fo) {
      const kind = this.pieceKind;
      base = fortAimPlacement(this.physics, eye, yaw, pitch, kind, this.rot);
      if (!base) this.why = 'Aim at the ground or a piece';
      else if (FORT_PIECES[kind].cost > (this.fo[4 + team] ?? 0)) this.why = 'Not enough build points';
      else if ((this.fo[6 + team] ?? 0) >= FORT_MAX_PIECES) this.why = 'Your team has built all it can';
      else {
        const bodies = poses.filter((p) => p.alive).map((p) => ({ x: p.x, y: p.y, z: p.z }));
        if (self) bodies.push(self);
        this.why =
          fortPlacementProblem(
            {
              physics: this.physics,
              side: this.midfield.side,
              pieces: [...this.pieces.values()],
              bodies,
              keepClear: [...this.bases.map((pos) => ({ pos, r: FORT_FLAG_CLEARANCE })), ...this.spawns.map((pos) => ({ pos, r: FORT_SPAWN_CLEARANCE }))],
            },
            team,
            kind,
            this.rot,
            base,
          ) ?? '';
      }
    }
    this.drawGhost(base);
    this.drawPanel(holding, team);
  }

  private drawGhost(base: Vec3 | null): void {
    if (!base) {
      if (this.ghost) this.ghost.node.setEnabled(false);
      return;
    }
    const key = `${this.pieceKind}_${this.rot}`;
    if (this.ghost?.key !== key) {
      this.ghost?.node.dispose();
      this.ghostOk ??= Object.assign(new StandardMaterial('fort_ghost_ok', this.scene), { diffuseColor: Color3.FromHexString('#4dff88'), emissiveColor: Color3.FromHexString('#3cff7a'), alpha: 0.4 });
      this.ghostBad ??= Object.assign(new StandardMaterial('fort_ghost_bad', this.scene), { diffuseColor: Color3.FromHexString('#ff5040'), emissiveColor: Color3.FromHexString('#ff3a28'), alpha: 0.4 });
      const node = new TransformNode('fort_ghost', this.scene);
      fortPieceBoxes(this.pieceKind, this.rot, { x: 0, y: 0, z: 0 }).forEach((b, i) => {
        const box = CreateBox(`fort_ghost_${i}`, { width: b.max.x - b.min.x + 0.02, height: b.max.y - b.min.y + 0.02, depth: b.max.z - b.min.z + 0.02 }, this.scene);
        box.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
        box.isPickable = false;
        box.parent = node;
      });
      this.ghost = { node, key };
    }
    const g = this.ghost!;
    g.node.setEnabled(true);
    g.node.position.set(base.x, base.y, base.z);
    const mat = this.why ? this.ghostBad! : this.ghostOk!;
    for (const m of g.node.getChildMeshes()) m.material = mat;
  }

  private drawPanel(holding: boolean, team: number): void {
    const fo = this.fo;
    if (!fo) return;
    const [phase, secs, cycle, cycles, p0, p1, c0, c1, budget] = fo;
    const mine = team === 1 ? { points: p1, count: c1, other: c0 } : { points: p0, count: c0, other: c1 };
    const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const phaseText = phase === FORT_BUILD ? 'Build phase' : 'Combat';
    const parts = [
      `<div class="fp-phase${phase === FORT_BUILD ? ' build' : ''}" data-phase="${phase}"><b>${phaseText}</b> <span>${clock}</span>${cycles > 1 ? ` <small>cycle ${cycle}/${cycles}</small>` : ''}</div>`,
      `<div class="fp-stats"><span data-points="${mine.points}">Build points <b>${mine.points}</b> / ${budget}</span><span>Pieces <b>${mine.count}</b> · theirs ${mine.other}</span></div>`,
    ];
    if (holding) {
      parts.push(
        `<div class="fp-pieces">${FORT_PIECE_KINDS.map((k, i) => {
          const d = FORT_PIECES[k];
          const cls = `${i === this.kind ? 'on' : ''}${d.cost > mine.points ? ' poor' : ''}`;
          return `<span class="${cls}" data-kind="${k}"><kbd>${i + 1}</kbd>${escapeHtml(d.label)} <em>${d.cost}</em></span>`;
        }).join('')}</div>`,
        `<div class="fp-why">${this.why ? escapeHtml(this.why) : '&nbsp;'}</div>`,
        `<div class="fp-help">LMB place · RMB pick up · R turn · 1-8 / wheel: piece</div>`,
      );
    }
    const html = parts.join('');
    if (html !== this.lastPanel) {
      this.panel.innerHTML = html;
      this.lastPanel = html;
    }
  }

  dispose(): void {
    this.setBarrier(false);
    for (const p of this.pieces.values()) {
      for (const c of p.colliders) this.physics.removeCollider(c);
      p.node.dispose();
    }
    this.pieces.clear();
    this.ghost?.node.dispose();
    for (const m of this.materials.values()) m.dispose();
    this.ghostOk?.dispose();
    this.ghostBad?.dispose();
    this.panel.remove();
  }
}

const centre = (b: { min: Vec3; max: Vec3 }): Vec3 => ({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 });
const half = (b: { min: Vec3; max: Vec3 }): Vec3 => ({ x: (b.max.x - b.min.x) / 2, y: (b.max.y - b.min.y) / 2, z: (b.max.z - b.min.z) / 2 });
