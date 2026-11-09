import type { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { EXPOSED_SHARE, heatColor, type HeatCell, type HeatLayer, type SpawnExposure, type Sightline, type Vec3 } from '@tiletrigger/shared';

/**
 * What MapMaker's map tests draw over the map (mapTestPanel.ts; editor-only, never in the map): a bot test run's
 * heatmaps, each layer one mesh of flat squares lying on the floors the bots stood on (so they show in the 3D view
 * and, from above, in the plan view, which cuts away the levels over the one shown), the long sightlines and each
 * spawn's longest lines of sight as line systems, and a label by each spawn with how much of the map sees it.
 * Every mesh's name starts `edMapTest` (photo mode hides them for the card shot).
 */
export interface MapTestOverlayHost {
  scene: Scene;
  project(p: Vec3): { x: number; y: number } | null;
  overlay: HTMLElement;
}

/** The layers' looks: 'went' in the heat colours, the others one colour each, brighter where there's more. */
const LAYER_TINT: Record<Exclude<HeatLayer, 'went'>, [number, number, number]> = {
  stuck: [1, 0.25, 0.95],
  died: [1, 0.12, 0.08],
  failed: [1, 0.6, 0.05],
};
/** Each layer a little higher than the last, so all four can show at once. */
const LAYER_LIFT: Record<HeatLayer, number> = { went: 0.08, stuck: 0.14, died: 0.11, failed: 0.17 };

export class MapTestOverlay {
  private readonly layers = new Map<HeatLayer, Mesh>();
  private lines?: LinesMesh;
  private labels: { el: HTMLElement; at: Vec3 }[] = [];

  constructor(private readonly host: MapTestOverlayHost) {}

  /** Draw a layer's cells (or none: hide it). */
  setLayer(layer: HeatLayer, cells: readonly HeatCell[] | null, cell: number): void {
    this.layers.get(layer)?.dispose(false, true);
    this.layers.delete(layer);
    if (!cells?.length) return;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const lift = LAYER_LIFT[layer];
    // The other layers' squares are smaller, so the heat underneath shows round them.
    const half = (layer === 'went' ? 0.48 : 0.36) * cell;
    for (const c of cells) {
      // A square root lifts the quiet cells into sight (a few busy cells would otherwise wash the rest out).
      const s = Math.sqrt(c.share);
      const [r, g, b] = layer === 'went' ? heatColor(s) : LAYER_TINT[layer];
      const a = layer === 'went' ? 0.5 + 0.4 * s : 0.55 + 0.45 * s;
      const base = positions.length / 3;
      const y = c.y + lift;
      positions.push(c.x - half, y, c.z - half, c.x + half, y, c.z - half, c.x + half, y, c.z + half, c.x - half, y, c.z + half);
      for (let k = 0; k < 4; k++) colors.push(r, g, b, a);
      indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
    const mesh = new Mesh(`edMapTest_${layer}`, this.host.scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.colors = colors;
    vd.indices = indices;
    vd.applyToMesh(mesh);
    mesh.hasVertexAlpha = true;
    const mat = new StandardMaterial(`edMapTest_${layer}_mat`, this.host.scene);
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.emissiveColor = Color3.White();
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    // Lying on the floor: pulled toward the camera so the floor doesn't fight it.
    mat.zOffset = -2;
    mesh.material = mat;
    mesh.useVertexColors = true;
    mesh.isPickable = false;
    this.layers.set(layer, mesh);
  }

  hasLayer(layer: HeatLayer): boolean {
    return this.layers.has(layer);
  }

  /** The long sightlines (yellow) and each spawn's longest lines of sight (red for exposed spawns, else orange). */
  setSightlines(lines: readonly Sightline[] | null, spawns: readonly SpawnExposure[] | null, share = EXPOSED_SHARE): void {
    this.lines?.dispose();
    this.lines = undefined;
    const ls: Vector3[][] = [];
    const cs: Color4[][] = [];
    const v = (p: Vec3) => new Vector3(p.x, p.y, p.z);
    const long = new Color4(1, 0.86, 0.2, 0.85);
    for (const l of lines ?? []) {
      ls.push([v(l.a), v(l.b)]);
      cs.push([long, long]);
    }
    for (const s of spawns ?? []) {
      const c = s.share >= share ? new Color4(1, 0.2, 0.15, 0.9) : new Color4(1, 0.55, 0.15, 0.55);
      for (const [a, b] of s.lines) {
        ls.push([v(a), v(b)]);
        cs.push([c, c]);
      }
    }
    if (!ls.length) return;
    this.lines = CreateLineSystem('edMapTest_lines', { lines: ls, colors: cs, useVertexAlpha: true }, this.host.scene);
    this.lines.isPickable = false;
    this.lines.renderingGroupId = 1;
  }

  /** A label by each spawn: the share of the map that sees it and from how far; red when it is exposed. */
  setSpawnLabels(spawns: readonly SpawnExposure[] | null, share = EXPOSED_SHARE): void {
    for (const l of this.labels) l.el.remove();
    this.labels = [];
    for (const s of spawns ?? []) {
      const el = document.createElement('div');
      el.className = `ed-exposure-label${s.share >= share ? ' exposed' : ''}`;
      el.dataset.spawn = s.id;
      el.innerHTML = '<b></b><span></span>';
      el.querySelector('b')!.textContent = `${Math.round(s.share * 100)}%`;
      el.querySelector('span')!.textContent = s.seenFrom ? `seen to ${Math.round(s.farthest)} m` : 'unseen';
      el.title = `Seen from ${s.seenFrom} of ${s.of} places on the map (${Math.round(s.share * 100)}%), ${Math.round(s.nearest)}-${Math.round(s.farthest)} m away, half of them within ${Math.round(s.median)} m`;
      this.host.overlay.append(el);
      this.labels.push({ el, at: { x: s.pos.x, y: s.pos.y + 2.2, z: s.pos.z } });
    }
    this.frame();
  }

  /** Keep the spawn labels on their spawns as the camera moves (one projection each a frame). */
  frame(): void {
    if (!this.labels.length) return;
    // Only over the open view: not over the top bar, the palette, the side panel or the status bar.
    const o = this.host.overlay.getBoundingClientRect();
    const edge = (id: string, side: 'left' | 'right' | 'top' | 'bottom', fallback: number) => {
      const el = document.getElementById(id);
      if (!el || el.hidden || !el.offsetParent) return fallback;
      const r = el.getBoundingClientRect();
      return side === 'left' || side === 'right' ? r[side] - o.left : r[side] - o.top;
    };
    const minX = edge('ed-palette', 'right', 0);
    const maxX = edge('ed-right', 'left', o.width);
    const minY = edge('ed-top', 'bottom', 0);
    const maxY = o.height - 36;
    for (const l of this.labels) {
      const p = this.host.project(l.at);
      const s = p && p.x > minX + 30 && p.x < maxX - 30 && p.y > minY + 34 && p.y < maxY ? p : null;
      l.el.hidden = !s;
      if (s) l.el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%)`;
    }
  }

  clear(): void {
    for (const m of this.layers.values()) m.dispose(false, true);
    this.layers.clear();
    this.setSightlines(null, null);
    this.setSpawnLabels(null);
  }
}
