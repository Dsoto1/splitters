import type { Scene } from '@babylonjs/core/scene';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PLAYER, type MapEntity } from '@tiletrigger/shared';
import { PICKUP_HOVER } from '../game/pickupVisuals.ts';
import { smallIconKind } from './editorParts.ts';

/**
 * MapMaker: picking things inside others (QUEUE Features; owner, 2026-11-18: a spawn dragged into the Grand Cliff
 * Stair could only be reached by zooming right in). Every small thing (editorParts.ts isSmallThing: spawns, pickups,
 * lights, logic) has an icon with a halo that is drawn only where something stands in front of it: the icon's depth
 * test is reversed (it passes where the wall is nearer), so a thing in the open looks as it always did and a thing
 * inside a wall or a set piece shows through it, where a click picks it (hover.ts). The icon stands a little in front
 * of the thing (towards the camera), so the thing's own model never counts as in front of it. Steady: no blinking.
 */

type IconKind = ReturnType<typeof smallIconKind>;

const COLORS: Record<IconKind, string> = { spawn: '#5ab0ff', pickup: '#ffc24a', light: '#fff07a', logic: '#c58cff' };

/** The icon a small thing shows: a soft halo in its colour, a dark disc, and a white glyph (a figure, a diamond, a sun, a star). */
function drawIcon(ctx: CanvasRenderingContext2D, kind: IconKind, selected: boolean): void {
  const n = 128;
  const c = n / 2;
  ctx.clearRect(0, 0, n, n);
  const halo = ctx.createRadialGradient(c, c, 26, c, c, 62);
  halo.addColorStop(0, COLORS[kind]);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(c, c, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(16,22,32,0.92)';
  ctx.beginPath();
  ctx.arc(c, c, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = selected ? 6 : 4;
  ctx.strokeStyle = selected ? '#ffffff' : COLORS[kind];
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  if (kind === 'spawn') {
    ctx.arc(c, c - 11, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(c - 10, c + 15);
    ctx.lineTo(c - 7, c - 2);
    ctx.lineTo(c + 7, c - 2);
    ctx.lineTo(c + 10, c + 15);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'pickup') {
    ctx.moveTo(c, c - 16);
    ctx.lineTo(c + 13, c);
    ctx.lineTo(c, c + 16);
    ctx.lineTo(c - 13, c);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'light') {
    ctx.arc(c, c, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 11, c + Math.sin(a) * 11);
      ctx.lineTo(c + Math.cos(a) * 17, c + Math.sin(a) * 17);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 ? 7 : 16;
      ctx[i ? 'lineTo' : 'moveTo'](c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
}

/** Where the thing's middle is (its marker's), and how far in front of it the icon stands. */
function middleOf(e: MapEntity): { at: [number, number, number]; off: number } {
  const [x, y, z] = e.position;
  if (e.kind === 'spawn') return { at: [x, y + PLAYER.height / 2, z], off: PLAYER.radius + 0.25 };
  if (e.kind === 'pickup') return { at: [x, y + PICKUP_HOVER, z], off: 0.6 };
  return { at: [x, y + 0.4, z], off: 0.7 };
}

interface Icon {
  mesh: Mesh;
  at: Vector3;
  off: number;
  kind: IconKind;
  selected: boolean;
}

export class SmallIcons {
  private readonly icons = new Map<string, Icon>();
  private readonly mats = new Map<string, StandardMaterial>();
  private shown = true;

  constructor(
    private readonly scene: Scene,
    /** The icon's mesh picks the thing (EditorView.pickEntities). */
    private readonly own: (mesh: Mesh, id: string | null) => void,
  ) {}

  /** The icon's material, one for each look (kind, selected or not). */
  private material(kind: IconKind, selected: boolean): StandardMaterial {
    const key = `${kind}${selected ? '+' : ''}`;
    let mat = this.mats.get(key);
    if (mat) return mat;
    const tex = new DynamicTexture(`edicon_${key}`, { width: 128, height: 128 }, this.scene, true);
    drawIcon(tex.getContext() as unknown as CanvasRenderingContext2D, kind, selected);
    tex.hasAlpha = true;
    tex.update();
    mat = new StandardMaterial(`ediconmat_${key}`, this.scene);
    mat.diffuseTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.emissiveColor = Color3.White();
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    // Drawn only where something is nearer than the icon: through walls, never over the thing in the open.
    mat.depthFunction = Constants.GREATER;
    mat.disableDepthWrite = true;
    mat.alpha = 0.95;
    this.mats.set(key, mat);
    return mat;
  }

  /** Show (or refresh) the icon of a small thing. */
  set(e: MapEntity, enabled: boolean, selected: boolean): void {
    const kind = smallIconKind(e);
    let icon = this.icons.get(e.id);
    if (!icon) {
      const mesh = CreatePlane(`edicon_${e.id}`, { size: 1 }, this.scene);
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      mesh.alphaIndex = 10000;
      icon = { mesh, at: new Vector3(), off: 0, kind, selected: !selected };
      this.icons.set(e.id, icon);
      this.own(mesh, e.id);
    }
    if (icon.kind !== kind || icon.selected !== selected || !icon.mesh.material) {
      icon.kind = kind;
      icon.selected = selected;
      icon.mesh.material = this.material(kind, selected);
    }
    const m = middleOf(e);
    icon.at.set(m.at[0], m.at[1], m.at[2]);
    icon.off = m.off;
    icon.mesh.setEnabled(enabled && this.shown);
  }

  /** Remove the icons of things no longer drawn. */
  keepOnly(ids: ReadonlySet<string>): void {
    for (const [id, icon] of this.icons) {
      if (ids.has(id)) continue;
      this.own(icon.mesh, null);
      icon.mesh.dispose();
      this.icons.delete(id);
    }
  }

  /** Each frame: every icon a little in front of its thing, towards the camera, and sized to read at any distance. */
  update(camera: Vector3): void {
    for (const icon of this.icons.values()) {
      if (!icon.mesh.isEnabled()) continue;
      const dx = camera.x - icon.at.x;
      const dy = camera.y - icon.at.y;
      const dz = camera.z - icon.at.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      const off = Math.min(icon.off, d * 0.5);
      icon.mesh.position.set(icon.at.x + (dx / d) * off, icon.at.y + (dy / d) * off, icon.at.z + (dz / d) * off);
      icon.mesh.scaling.setAll(Math.max(0.7, Math.min(3, d * 0.04)));
    }
  }

  /** The icons as editing aids (hidden for a card shot). */
  get meshes(): Mesh[] {
    return [...this.icons.values()].map((i) => i.mesh);
  }
}
