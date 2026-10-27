import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CORE_LOOKS, CREATURE_ROLES, NPC_ROLE_SPECS, PLAYER, SPRINT, getWeapon } from '@tiletrigger/shared';
import { CreatureLibrary } from '../content/creatures.ts';
import { CreatureAnimator } from '../game/creatureAnimator.ts';
import { CharacterLibrary, type CharacterSpec } from '../content/characters.ts';
import { ModelLibrary } from '../content/models.ts';
import { CharacterAnimator, type MotionState, type OneShot } from '../game/characterAnimator.ts';

/**
 * Character viewer (team tool, `?mode=characters`): every preset look plus the
 * NPC mannequins in two rows (front row first), with buttons for each animation state, aim pitch
 * and held weapon, to check rig, retargeting, scale and facing.
 */
export async function openCharacterViewer(engine: AbstractEngine, canvas: HTMLCanvasElement): Promise<() => void> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.16, 0.18, 0.21, 1);
  const specs: (CharacterSpec & { label: string })[] = [
    ...CORE_LOOKS.map((l) => ({ look: l.id, label: l.name })),
    { npc: { color: '#d04a3a', scale: NPC_ROLE_SPECS.trooper.scale }, label: 'NPC Trooper' },
    { npc: { color: '#d04a3a', scale: NPC_ROLE_SPECS.trooper.scale, female: true }, label: 'NPC Trooper (F)' },
    { npc: { color: '#5cc77a', scale: NPC_ROLE_SPECS.heavy.scale }, label: 'NPC Heavy' },
    { npc: { color: '#5cc77a', scale: NPC_ROLE_SPECS.heavy.scale, female: true }, label: 'NPC Heavy (F)' },
  ];
  // Two rows, the back one offset so every character shows.
  const spacing = 1.3;
  const perRow = Math.ceil(specs.length / 2);
  const place = (i: number) => ({ x: (i % perRow) * spacing + (i >= perRow ? spacing / 2 : 0), z: i >= perRow ? -1.6 : 0 });
  const mid = ((perRow - 1) * spacing) / 2;
  const params = new URLSearchParams(location.search);
  const camera = new ArcRotateCamera('cam', Number(params.get('alpha') ?? Math.PI / 2), 1.25, Number(params.get('dist') ?? 12), new Vector3(Number(params.get('x') ?? mid), 1, Number(params.get('z') ?? 0)), scene);
  camera.minZ = 0.05;
  camera.wheelPrecision = 40;
  camera.attachControl(canvas, true);
  new HemisphericLight('hemi', new Vector3(0.3, 1, 0.4), scene).intensity = 0.9;
  new DirectionalLight('sun', new Vector3(-0.4, -1, 0.6), scene).intensity = 0.7;
  const ground = CreateGround('ground', { width: 40, height: 20 }, scene);
  const gm = new StandardMaterial('groundMat', scene);
  gm.diffuseColor = new Color3(0.3, 0.32, 0.36);
  ground.material = gm;

  const characters = new CharacterLibrary(scene);
  const models = new ModelLibrary(scene);
  const animators = await Promise.all(
    specs.map(async (s, i) => {
      const ch = await characters.create(s, `view_${i}`);
      ch.root.rotation.y = 0;
      const { min, max } = ch.root.getHierarchyBoundingVectors(true);
      ch.root.scaling.scaleInPlace((PLAYER.height * ch.root.scaling.y) / Math.max(0.5, max.y - min.y));
      const holder = ch.root;
      const p = place(i);
      holder.position.set(p.x, 0, p.z);
      return new CharacterAnimator(scene, ch);
    }),
  );
  // Creature NPCs in a row in front (2.5 m apart), driven by the same buttons.
  const creatureLib = new CreatureLibrary(scene);
  const bodies = [...CREATURE_ROLES, 'zombie'] as const;
  const creatures = await Promise.all(
    bodies.map(async (kind, i) => {
      const ch = await creatureLib.create(kind, `creature_${kind}`);
      ch.root.position.set(mid + (i - (bodies.length - 1) / 2) * 2.6, 0, 2.4);
      return new CreatureAnimator(scene, ch);
    }),
  );
  // Characters face the camera: the camera looks along -Z from +Z.
  const state: MotionState = { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false };

  const panel = document.createElement('div');
  panel.id = 'char-panel';
  panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;padding:10px;background:rgba(21,24,29,.94);font:12px system-ui;color:#eee;display:flex;flex-wrap:wrap;gap:6px;align-items:center';
  const btn = (label: string, f: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = f;
    panel.append(b);
  };
  // The game's own speeds, so foot sliding shows here as it would in a match.
  const move = (speed: number, angle = 0, sprinting = false) => () => Object.assign(state, { speed, moveAngle: angle, sprinting, airborne: false, alive: true, celebrate: false });
  const run = PLAYER.runSpeed;
  btn('Idle', move(0));
  btn('Walk', move(1.6));
  btn('Jog', move(3.2));
  btn('Run', move(run));
  btn('Sprint', move(run * SPRINT.speed, 0, true));
  btn('Diagonal', move(run, Math.PI / 4));
  btn('Strafe →', move(run, Math.PI / 2));
  btn('Backpedal', move(run * 0.85, Math.PI));
  btn('Airborne', () => Object.assign(state, { airborne: !state.airborne }));
  btn('Death', () => Object.assign(state, { alive: !state.alive }));
  btn('Dance', () => Object.assign(state, { celebrate: !state.celebrate }));
  for (const a of ['shoot', 'melee', 'melee_heavy', 'reload', 'throw', 'hit', 'interact'] as OneShot[]) btn(a, () => [...animators, ...creatures].forEach((x) => x.trigger(a)));
  for (const [label, w] of [['Knife', 'core.knife'], ['Pistol', 'core.pistol'], ['Rifle', 'core.rifle'], ['Shotgun', 'core.shotgun'], ['Sniper', 'core.sniper'], ['Launcher', 'core.launcher']] as const) {
    btn(label, () => animators.forEach((x, i) => void models.instantiate(getWeapon(w).view.model, `held_${i}`).then((n) => x.hold(n, getWeapon(w).view.hold))));
  }
  const pitch = document.createElement('input');
  pitch.type = 'range';
  pitch.min = '-60';
  pitch.max = '60';
  pitch.value = '0';
  pitch.oninput = () => (state.pitch = (Number(pitch.value) * Math.PI) / 180);
  panel.append(' Aim pitch ', pitch, ` ${specs.map((s) => s.label).join(' · ')} · front: ${bodies.join(', ')}`);
  document.body.append(panel);
  (window as unknown as { __charsReady: boolean; __charState: MotionState; __charAnimators: CharacterAnimator[] }).__charsReady = true;
  Object.assign(window, { __charState: state, __charAnimators: animators, __creatureAnimators: creatures, __charSpecs: specs.length });

  let last = performance.now();
  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const a of animators) a.update(dt, state);
    for (const c of creatures) c.update(dt, state);
    scene.render();
  });
  return () => {
    panel.remove();
    scene.dispose();
  };
}
