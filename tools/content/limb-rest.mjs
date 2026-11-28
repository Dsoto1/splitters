// Rest-pose check for the limb audit (docs/CHARACTER_LIMBS.md, cause (a)): each character body's limb joints' rest
// rotations (its glTF nodes) against the rig's (rig.glb), whose clips every body plays unchanged (characters.ts
// retarget copies the clips' local rotations by joint name). Prints, per body file, the largest difference (degrees)
// among the legs' and arms' joints, and which joint; a body whose rest differs would bend its limbs off the rig's planes.
//
//   node tools/content/limb-rest.mjs            every body file in packages/client/public/characters
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = join(ROOT, 'packages/client/public/characters');
export const LIMB_REST_JOINTS = ['pelvis', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r', 'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l', 'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r'];

/** The angle (degrees) between two unit quaternions [x, y, z, w]. */
export const quatAngle = (a, b) => (2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))) * 180) / Math.PI;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const rest = async (file) => new Map((await io.read(file)).getRoot().listNodes().map((n) => [n.getName(), n.getRotation()]));
const rig = await rest(join(DIR, 'rig.glb'));
const files = readdirSync(DIR).filter((f) => f.endsWith('.glb') && f !== 'rig.glb' && !/_clips\.glb$|_fparms|^hair_|^head_/.test(f));
let worst = 0;
for (const f of files) {
  const own = await rest(join(DIR, f)).catch(() => null);
  if (!own || !own.has('thigh_l')) continue;
  let most = 0;
  let at = '';
  for (const j of LIMB_REST_JOINTS) {
    if (!own.has(j) || !rig.has(j)) continue;
    const d = quatAngle(own.get(j), rig.get(j));
    if (d > most) ((most = d), (at = j));
  }
  worst = Math.max(worst, most);
  if (most > 0.5 || process.env.ALL) console.log(`${f}: ${most.toFixed(2)}° at ${at}`);
}
console.log(`${files.length} body files; largest limb rest difference from the rig: ${worst.toFixed(2)}°`);
