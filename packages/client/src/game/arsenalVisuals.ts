import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { STATUS_BURN, STATUS_CHILL, STATUS_FROZEN, STATUS_POISON, STATUS_SLOW, ZONE_KINDS, type ProjectileVisual, type Vec3, type ZoneSnapshot } from '@tiletrigger/shared';

/**
 * Looks for the extended arsenal, all built from simple shapes and glowing
 * materials: projectiles (bubbles, goo, discs, nails, swarm missiles…),
 * ground hazards (fire, oil, toxic clouds, goo, singularities), beams,
 * chain lightning and status auras on characters.
 */

const materials = new WeakMap<Scene, Map<string, StandardMaterial>>();

/** Shared material per look (never disposed by effects). */
function mat(scene: Scene, hex: string, emissive = 0, alpha = 1): StandardMaterial {
  let byKey = materials.get(scene);
  if (!byKey) materials.set(scene, (byKey = new Map()));
  const key = `${hex}|${emissive}|${alpha}`;
  let m = byKey.get(key);
  if (!m) {
    m = new StandardMaterial(`arsenal_${key}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.2, 0.2, 0.2);
    if (emissive) m.emissiveColor = Color3.FromHexString(hex).scale(emissive);
    if (alpha < 1) {
      m.alpha = alpha;
      m.backFaceCulling = false;
    }
    byKey.set(key, m);
  }
  return m;
}

/** Projectile looks this module draws; others are drawn by the view. */
export const ARSENAL_LOOKS: ReadonlySet<ProjectileVisual> = new Set(['bubble', 'goo', 'oil', 'flame', 'disc', 'nail', 'flare', 'swarm', 'vortex', 'shard', 'sticky', 'molotov', 'gas', 'bolt', 'holy', 'banana', 'sheep', 'bomblet', 'bomb', 'sandbag', 'spear', 'dynamite']);

export function createArsenalProjectile(scene: Scene, id: number, look: ProjectileVisual): TransformNode {
  const node = new TransformNode(`proj_${id}`, scene);
  const add = (m: Mesh) => {
    m.parent = node;
    m.isPickable = false;
    return m;
  };
  switch (look) {
    case 'bubble': {
      add(CreateSphere(`bubble_${id}`, { diameter: 0.55, segments: 10 }, scene)).material = mat(scene, '#7dff6a', 0.5, 0.45);
      const core = add(CreateSphere(`bubbleCore_${id}`, { diameter: 0.18, segments: 6 }, scene));
      core.material = mat(scene, '#c8ff40', 1);
      core.position.set(0.1, 0.1, 0);
      break;
    }
    case 'goo':
      add(CreateSphere(`goo_${id}`, { diameter: 0.28, segments: 8 }, scene)).material = mat(scene, '#ff5ac8', 0.5);
      break;
    case 'oil':
      add(CreateSphere(`oil_${id}`, { diameter: 0.26, segments: 8 }, scene)).material = mat(scene, '#2a2218', 0.05);
      break;
    case 'flame':
      add(CreateSphere(`flame_${id}`, { diameter: 0.35, segments: 6 }, scene)).material = mat(scene, '#ff8a2a', 1, 0.7);
      break;
    case 'disc': {
      const d = add(CreateCylinder(`disc_${id}`, { diameter: 0.5, height: 0.08, tessellation: 18 }, scene));
      d.material = mat(scene, '#7ad6ff', 0.9);
      add(CreateTorus(`discRim_${id}`, { diameter: 0.52, thickness: 0.05, tessellation: 18 }, scene)).material = mat(scene, '#e8f8ff', 1);
      break;
    }
    case 'spear': {
      // Shaft and head along the flight (the node turns to face where it's going).
      const shaft = add(CreateCylinder(`spear_${id}`, { diameter: 0.035, height: 1.5, tessellation: 6 }, scene));
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = -0.45;
      shaft.material = mat(scene, '#8a6238');
      const head = add(CreateCylinder(`spearHead_${id}`, { diameterTop: 0, diameterBottom: 0.07, height: 0.24, tessellation: 4 }, scene));
      head.rotation.x = Math.PI / 2;
      head.position.z = 0.4;
      head.material = mat(scene, '#a7adb4', 0.1);
      break;
    }
    case 'nail': {
      const n = add(CreateCylinder(`nail_${id}`, { diameter: 0.03, height: 0.22, tessellation: 5 }, scene));
      n.rotation.x = Math.PI / 2;
      n.material = mat(scene, '#d8d8d8', 0.3);
      break;
    }
    case 'flare':
      add(CreateSphere(`flare_${id}`, { diameter: 0.16, segments: 6 }, scene)).material = mat(scene, '#ff4a2a', 1.2);
      add(CreateSphere(`flareHalo_${id}`, { diameter: 0.5, segments: 6 }, scene)).material = mat(scene, '#ff7a3a', 0.8, 0.3);
      break;
    case 'swarm': {
      const body = add(CreateCylinder(`swarm_${id}`, { diameter: 0.08, height: 0.32, tessellation: 8 }, scene));
      body.rotation.x = Math.PI / 2;
      body.material = mat(scene, '#d0d4c0');
      const f = add(CreateSphere(`swarmFlame_${id}`, { diameter: 0.14, segments: 6 }, scene));
      f.position.z = -0.2;
      f.scaling.z = 2;
      f.material = mat(scene, '#ffb347', 1);
      break;
    }
    case 'vortex':
      add(CreateSphere(`vortex_${id}`, { diameter: 0.45, segments: 10 }, scene)).material = mat(scene, '#1a0830', 0.2);
      add(CreateTorus(`vortexRing_${id}`, { diameter: 0.75, thickness: 0.06, tessellation: 24 }, scene)).material = mat(scene, '#b07aff', 1.2);
      break;
    case 'shard':
      add(CreateSphere(`shard_${id}`, { diameter: 0.09, segments: 4 }, scene)).material = mat(scene, '#ffcf6a', 1.2);
      break;
    case 'sticky': {
      add(CreateSphere(`sticky_${id}`, { diameter: 0.2, segments: 8 }, scene)).material = mat(scene, '#5ad24a', 0.3);
      const l = add(CreateSphere(`sticky_${id}_light`, { diameter: 0.07, segments: 6 }, scene));
      l.position.y = 0.1;
      l.material = mat(scene, '#ff3b3b', 1.2);
      break;
    }
    case 'dynamite': {
      // A red stick with a sparking fuse.
      const b = add(CreateCylinder(`dynamite_${id}`, { diameter: 0.08, height: 0.28, tessellation: 8 }, scene));
      b.material = mat(scene, '#b3261e', 0.15);
      const fuse = add(CreateCylinder(`dynamiteFuse_${id}`, { diameter: 0.012, height: 0.1, tessellation: 4 }, scene));
      fuse.position.y = 0.18;
      fuse.material = mat(scene, '#d9cfae');
      const spark = add(CreateSphere(`dynamite_${id}_light`, { diameter: 0.06, segments: 4 }, scene));
      spark.position.y = 0.24;
      spark.material = mat(scene, '#ffd24a', 1.4);
      break;
    }
    case 'molotov': {
      const b = add(CreateCylinder(`molotov_${id}`, { diameter: 0.1, height: 0.26, tessellation: 8 }, scene));
      b.material = mat(scene, '#7a5a2a', 0.1, 0.85);
      const f = add(CreateSphere(`molotovRag_${id}`, { diameter: 0.1, segments: 6 }, scene));
      f.position.y = 0.17;
      f.material = mat(scene, '#ff8a2a', 1);
      break;
    }
    case 'gas': {
      const c = add(CreateCylinder(`gas_${id}`, { diameter: 0.12, height: 0.24, tessellation: 10 }, scene));
      c.material = mat(scene, '#6a7a5a', 0.1);
      const band = add(CreateCylinder(`gasBand_${id}`, { diameter: 0.125, height: 0.04, tessellation: 10 }, scene));
      band.material = mat(scene, '#c8ff40', 0.8);
      break;
    }
    case 'holy': {
      // A golden orb with a cross on top.
      add(CreateSphere(`holy_${id}`, { diameter: 0.34, segments: 12 }, scene)).material = mat(scene, '#ffd24a', 0.6);
      const v = add(CreateCylinder(`holyV_${id}`, { diameter: 0.04, height: 0.22, tessellation: 6 }, scene));
      v.position.y = 0.25;
      v.material = mat(scene, '#fff2b0', 0.8);
      const h = add(CreateCylinder(`holyH_${id}`, { diameter: 0.04, height: 0.14, tessellation: 6 }, scene));
      h.position.y = 0.28;
      h.rotation.z = Math.PI / 2;
      h.material = mat(scene, '#fff2b0', 0.8);
      break;
    }
    case 'banana': {
      // A bunch of bombs that looks a lot like fruit.
      for (const [i, a] of [-0.5, 0, 0.5].entries()) {
        const b = add(CreateCylinder(`banana_${id}_${i}`, { diameterTop: 0.03, diameterBottom: 0.08, height: 0.3, tessellation: 8 }, scene));
        b.rotation.z = a;
        b.position.x = a * 0.12;
        b.material = mat(scene, '#f5d33a', 0.2);
      }
      break;
    }
    case 'sheep': {
      add(CreateSphere(`sheep_${id}`, { diameter: 0.6, segments: 8 }, scene)).material = mat(scene, '#f4f2ea');
      const head = add(CreateSphere(`sheepHead_${id}`, { diameter: 0.26, segments: 8 }, scene));
      head.position.set(0, 0.12, 0.34);
      head.material = mat(scene, '#22201e');
      for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]] as const) {
        const leg = add(CreateCylinder(`sheepLeg_${id}_${x}_${z}`, { diameter: 0.06, height: 0.24, tessellation: 6 }, scene));
        leg.position.set(x, -0.28, z);
        leg.material = mat(scene, '#22201e');
      }
      break;
    }
    case 'bomblet':
      add(CreateSphere(`bomblet_${id}`, { diameter: 0.14, segments: 6 }, scene)).material = mat(scene, '#2a2d33', 0.1);
      break;
    case 'sandbag':
      add(CreateCylinder(`sandbag_${id}`, { diameter: 0.32, height: 0.55, tessellation: 8 }, scene)).material = mat(scene, '#b39b6b');
      break;
    case 'bomb': {
      const b = add(CreateCylinder(`bomb_${id}`, { diameterTop: 0.3, diameterBottom: 0.12, height: 0.7, tessellation: 10 }, scene));
      b.material = mat(scene, '#4a5340');
      const fin = add(CreateCylinder(`bombFin_${id}`, { diameter: 0.34, height: 0.04, tessellation: 4 }, scene));
      fin.position.y = 0.36;
      fin.material = mat(scene, '#3a3f30');
      break;
    }
    case 'bolt':
    default:
      add(CreateSphere(`bolt_${id}`, { diameter: 0.18, segments: 6 }, scene)).material = mat(scene, '#c69bff', 1);
  }
  return node;
}

/** Per-frame motion for arsenal projectiles (spin, wobble, point along flight). */
export function animateArsenalProjectile(node: TransformNode, look: ProjectileVisual, now: number, moved: Vector3, born: number): void {
  const along = () => {
    if (moved.lengthSquared() > 1e-6) node.lookAt(node.position.add(moved));
  };
  switch (look) {
    case 'bubble':
      node.scaling.set(1 + Math.sin(now * 0.012) * 0.08, 1 + Math.cos(now * 0.014) * 0.08, 1);
      break;
    case 'flame':
      // Puffs grow as they fly.
      node.scaling.setAll(Math.min(3, 1 + (now - born) / 200));
      break;
    case 'disc':
      node.rotation.y += 0.6;
      break;
    case 'vortex':
      node.rotation.y += 0.25;
      node.rotation.x = 0.4;
      break;
    case 'nail':
    case 'swarm':
      along();
      break;
    case 'sticky': {
      const light = node.getChildMeshes().find((m) => m.name.endsWith('_light'));
      light?.setEnabled(Math.floor(now / 160) % 2 === 0);
      break;
    }
    case 'molotov':
    case 'gas':
    case 'dynamite': {
      node.rotation.x += 0.2;
      const spark = node.getChildMeshes().find((m) => m.name.endsWith('_light'));
      spark?.scaling.setAll(0.6 + Math.abs(Math.sin(now * 0.05)) * 0.9);
      break;
    }
    case 'banana':
    case 'holy':
      node.rotation.x += 0.25;
      break;
    case 'sheep':
      // Faces the way it walks, with a bob in its step.
      if (moved.x * moved.x + moved.z * moved.z > 1e-6) node.rotation.y = Math.atan2(moved.x, moved.z);
      node.rotation.z = Math.sin(now * 0.03) * 0.12;
      break;
    default:
      break;
  }
}

interface ZoneMesh {
  root: TransformNode;
  kind: (typeof ZONE_KINDS)[number];
  radius: number;
  phase: number;
}

/** Ground hazards and fields from the snapshot, kept in step every frame. */
export class ZoneVisuals {
  private readonly zones = new Map<string, ZoneMesh>();

  constructor(private readonly scene: Scene) {}

  apply(list: readonly ZoneSnapshot[] | undefined, now: number): void {
    const seen = new Set<string>();
    for (const z of list ?? []) {
      const kind = ZONE_KINDS[z[0]] ?? 'fire';
      // Zones never move, so their kind and spot identify them (fire replaces oil in place).
      const key = `${z[1].toFixed(1)}:${z[2].toFixed(1)}:${z[3].toFixed(1)}`;
      seen.add(key);
      let m = this.zones.get(key);
      if (m && m.kind !== kind) {
        m.root.dispose();
        m = undefined;
      }
      if (!m) {
        m = this.create(kind, z[4]);
        m.root.position.set(z[1], z[2], z[3]);
        this.zones.set(key, m);
      }
      // Fade out over the last second.
      const fade = Math.min(1, z[5]);
      this.animate(m, now, fade);
    }
    for (const [key, m] of this.zones) {
      if (!seen.has(key)) {
        m.root.dispose();
        this.zones.delete(key);
      }
    }
  }

  private create(kind: ZoneMesh['kind'], radius: number): ZoneMesh {
    const scene = this.scene;
    const root = new TransformNode(`zone_${kind}`, scene);
    const disc = (name: string, r: number, m: StandardMaterial, y = 0.04) => {
      const d = CreateDisc(name, { radius: r, tessellation: 32 }, scene);
      d.rotation.x = Math.PI / 2;
      d.position.y = y;
      d.material = m;
      d.parent = root;
      d.isPickable = false;
      return d;
    };
    switch (kind) {
      case 'oil':
        disc('oil', radius, mat(scene, '#1c1810', 0.02, 0.9));
        disc('oilSheen', radius * 0.6, mat(scene, '#4a3a6a', 0.15, 0.35), 0.05);
        break;
      case 'goo':
        disc('goo', radius, mat(scene, '#e04ab0', 0.35, 0.8));
        break;
      case 'fire': {
        disc('scorch', radius, mat(scene, '#2a1408', 0, 0.85));
        disc('fire', radius * 0.9, mat(scene, '#ff6a1a', 1, 0.55), 0.06);
        const tongues = Math.round(6 + radius * 3);
        for (let i = 0; i < tongues; i++) {
          const a = (i / tongues) * Math.PI * 2 + i;
          const r = radius * (0.15 + 0.75 * ((i * 37) % 10) / 10);
          const tongue = CreateCylinder(`flame${i}`, { diameterTop: 0, diameterBottom: 0.35, height: 0.9, tessellation: 5 }, scene);
          tongue.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r);
          tongue.material = mat(scene, i % 3 === 0 ? '#ffd24a' : '#ff6a1a', 1.1, 0.55);
          tongue.parent = root;
          tongue.isPickable = false;
        }
        break;
      }
      case 'toxic': {
        const cloud = CreateSphere('toxic', { diameter: radius * 2, segments: 12 }, scene);
        cloud.scaling.y = 0.55;
        cloud.position.y = radius * 0.25;
        cloud.material = mat(scene, '#7dff3a', 0.35, 0.22);
        cloud.parent = root;
        cloud.isPickable = false;
        break;
      }
      case 'singularity': {
        const core = CreateSphere('singularity', { diameter: 1.2, segments: 14 }, scene);
        core.material = mat(scene, '#05010a', 0);
        core.parent = root;
        const ring = CreateTorus('singRing', { diameter: radius * 0.6, thickness: 0.12, tessellation: 40 }, scene);
        ring.material = mat(scene, '#b07aff', 1.4, 0.8);
        ring.parent = root;
        const outer = CreateSphere('singField', { diameter: radius * 2, segments: 16 }, scene);
        outer.material = mat(scene, '#6a3aff', 0.4, 0.08);
        outer.parent = root;
        for (const m of root.getChildMeshes()) m.isPickable = false;
        break;
      }
    }
    return { root, kind, radius, phase: Math.random() * 10 };
  }

  private animate(m: ZoneMesh, now: number, fade: number): void {
    const t = now * 0.001 + m.phase;
    m.root.scaling.setAll(m.kind === 'singularity' ? 1 : 0.5 + 0.5 * fade);
    if (m.kind === 'fire') {
      m.root.getChildMeshes().forEach((c, i) => {
        if (i < 2) return;
        c.scaling.y = 0.7 + Math.abs(Math.sin(t * 9 + i * 1.7)) * 0.9;
        c.position.y = 0.45 * c.scaling.y;
      });
    } else if (m.kind === 'toxic') {
      m.root.rotation.y = t * 0.3;
      m.root.scaling.y = (0.5 + 0.5 * fade) * (1 + Math.sin(t * 2) * 0.06);
    } else if (m.kind === 'singularity') {
      m.root.rotation.y = t * 3;
      m.root.rotation.x = 0.35;
      const [core] = m.root.getChildMeshes();
      core?.scaling.setAll(0.8 + Math.sin(t * 14) * 0.15);
    }
  }
}

/** A solid glowing beam (lasers, rails, freeze rays) that thins out over its short life. */
export function createBeam(scene: Scene, from: Vec3, to: Vec3, color: string, width: number): Mesh {
  const a = new Vector3(from.x, from.y - 0.08, from.z);
  const b = new Vector3(to.x, to.y, to.z);
  const len = Vector3.Distance(a, b);
  const beam = CreateCylinder('beam', { diameter: width, height: Math.max(0.01, len), tessellation: 6 }, scene);
  beam.position = a.add(b).scale(0.5);
  // Cylinders run along Y: tip the beam onto the line from a to b.
  const dir = b.subtract(a).normalize();
  const axis = Vector3.Cross(Vector3.Up(), dir);
  const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(Vector3.Up(), dir))));
  if (axis.lengthSquared() > 1e-9) beam.rotate(axis.normalize(), angle);
  const m = new StandardMaterial('beamMat', scene);
  m.emissiveColor = Color3.FromHexString(color);
  m.diffuseColor = Color3.Black();
  m.alpha = 0.85;
  m.disableLighting = true;
  beam.material = m;
  beam.isPickable = false;
  return beam;
}

/** Jagged lightning through a list of points. */
export function createArc(scene: Scene, pts: readonly Vec3[], color: string) {
  const points: Vector3[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const steps = Math.max(3, Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 0.8));
    for (let s = 0; s < steps; s++) {
      const f = s / steps;
      const j = s === 0 ? 0 : 0.35;
      points.push(new Vector3(a.x + (b.x - a.x) * f + (Math.random() - 0.5) * j, a.y + (b.y - a.y) * f + (Math.random() - 0.5) * j, a.z + (b.z - a.z) * f + (Math.random() - 0.5) * j));
    }
  }
  const last = pts[pts.length - 1]!;
  points.push(new Vector3(last.x, last.y, last.z));
  const lines = CreateLines('arc', { points }, scene);
  lines.color = Color3.FromHexString(color);
  lines.isPickable = false;
  return lines;
}

/** Colour of the strongest status (for character auras and the local screen tint), or null. */
export function statusColor(bits: number): string | null {
  if (bits & STATUS_FROZEN) return '#9fe8ff';
  if (bits & STATUS_BURN) return '#ff7a2a';
  if (bits & STATUS_POISON) return '#8aff3a';
  if (bits & STATUS_SLOW) return '#ff5ac8';
  if (bits & STATUS_CHILL) return '#c8f0ff';
  return null;
}

/** A see-through shell round a character showing its status (a block of ice when frozen). */
export function createAura(scene: Scene, parent: TransformNode): Mesh {
  const shell = CreateCylinder('aura', { diameter: 1.0, height: 1.95, tessellation: 12 }, scene);
  shell.position.y = 0.95;
  shell.parent = parent;
  shell.isPickable = false;
  shell.setEnabled(false);
  return shell;
}

export function setAura(scene: Scene, aura: Mesh, bits: number, now: number): void {
  const color = statusColor(bits);
  aura.setEnabled(!!color);
  if (!color) return;
  const frozen = (bits & STATUS_FROZEN) !== 0;
  aura.material = mat(scene, color, frozen ? 0.4 : 0.9, frozen ? 0.55 : 0.18 + 0.08 * Math.sin(now * 0.012));
  aura.scaling.set(frozen ? 1.05 : 1 + Math.sin(now * 0.01) * 0.04, 1, frozen ? 1.05 : 1 + Math.cos(now * 0.01) * 0.04);
}
