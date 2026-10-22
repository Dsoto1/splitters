import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CreateLines, CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import provenance from '../../../../content/provenance.json';
import { ModelLibrary } from '../content/models.ts';

/**
 * Asset viewer (team tool, `?mode=assets`): every built model laid out on a
 * 10 cm grid with a +Z forward arrow, plus its source, licence and budget
 * figures, so imports can be checked for orientation, scale and colour.
 */
export async function openAssetViewer(engine: AbstractEngine, canvas: HTMLCanvasElement): Promise<() => void> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.16, 0.18, 0.21, 1);
  const camera = new ArcRotateCamera('cam', -Math.PI / 2, 0.55, 4.2, new Vector3(1.1, 0, 0.7), scene);
  camera.minZ = 0.01;
  camera.wheelPrecision = 60;
  camera.attachControl(canvas, true);
  new HemisphericLight('hemi', new Vector3(0.3, 1, 0.2), scene).intensity = 0.9;
  new DirectionalLight('sun', new Vector3(-0.4, -1, 0.5), scene).intensity = 0.6;

  const lines: Vector3[][] = [];
  for (let i = -10; i <= 40; i++) lines.push([new Vector3(i * 0.1, 0, -1), new Vector3(i * 0.1, 0, 2)]);
  for (let j = -10; j <= 20; j++) lines.push([new Vector3(-1, 0, j * 0.1), new Vector3(4, 0, j * 0.1)]);
  const grid = CreateLineSystem('grid', { lines }, scene);
  grid.color = new Color3(0.35, 0.4, 0.46);

  const library = new ModelLibrary(scene);
  const panel = document.createElement('div');
  panel.id = 'asset-panel';
  panel.style.cssText = 'position:fixed;right:0;top:0;bottom:0;width:340px;overflow:auto;background:rgba(21,24,29,.94);padding:12px;font:12px/1.4 system-ui;color:#eee';
  panel.innerHTML = `<h2 style="margin:0 0 8px">Asset viewer</h2><p style="color:#9aa">Orbit: drag · Zoom: wheel · Red arrow = +Z (forward) · Grid = 10 cm</p>`;
  document.body.append(panel);

  const assets = provenance.assets.filter((a) => a.file.startsWith('models/'));
  const cols = 3;
  await Promise.all(
    assets.map(async (a, i) => {
      const x = (i % cols) * 1.1;
      const z = Math.floor(i / cols) * 0.75 - 0.3;
      const root = await library.instantiate(a.file.replace(/^models\//, ''), `asset_${i}`);
      root.position.set(x, 0.15, z);
      const arrow = CreateLines(`fwd_${i}`, { points: [new Vector3(x, 0.01, z), new Vector3(x, 0.01, z + 0.3)] }, scene);
      arrow.color = new Color3(1, 0.3, 0.3);
      const row = document.createElement('div');
      row.style.cssText = 'padding:8px 0;border-top:1px solid #333';
      row.innerHTML = `<b>#${i + 1} ${a.file}</b><br>${a.triangles} tris · ${(a.bytes / 1024).toFixed(0)} KiB<br>${a.title} — ${a.creator} (${a.license})<br><span style="color:#9aa">${a.source}</span>`;
      panel.append(row);
    }),
  );
  (window as unknown as { __assetsReady: boolean }).__assetsReady = true;

  engine.runRenderLoop(() => scene.render());
  return () => {
    panel.remove();
    scene.dispose();
  };
}
