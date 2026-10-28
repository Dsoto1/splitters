// Effect packs → what the game draws (content/vfx.json says which packs and their licences).
//
//   node tools/content/prepare-vfx.mjs --downloads <dir>
//
// <dir> holds each pack unzipped under its id (binbun-muzzle-flash/assets/BinbunVFX/…). The packs are
// Godot 4 projects: their scenes say how each effect is put together (which textured quads, how many,
// how big, how they turn, fade and shrink, the colours and the glow), and their shaders how a quad is
// drawn. This reads the scenes and materials (tools/content/godot.mjs) into a small JSON of settings,
// and packs the textures into one atlas, for packages/client/src/game/muzzleFlash.ts, which redraws
// them the way the shaders do. Nothing of the packs is committed but these outputs.
//
// Muzzle flashes: packages/client/public/vfx/muzzle_flash.webp (a 4 × 4 atlas of the 16 flash
// textures, grey: the shaders use the red channel only) and muzzle_flash.json (the 24 effects).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { curvePoints, parseGodot, resources, rgb, vec } from './godot.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/client/public/vfx');
const LOCK = join(ROOT, 'content/vfx.lock.json');
const argv = process.argv.slice(2);
const downloads = argv.includes('--downloads') ? resolve(argv[argv.indexOf('--downloads') + 1]) : null;
if (!downloads) throw new Error('usage: node tools/content/prepare-vfx.mjs --downloads <dir>');
mkdirSync(OUT, { recursive: true });

const r4 = (n) => Math.round(n * 10000) / 10000;
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);
const lock = [];
function write(file, buf, source, src, title) {
  writeFileSync(join(OUT, file), buf);
  lock.push({ file: `vfx/${file}`, source, src, title, bytes: buf.length, sha256: sha(buf) });
}

// ------------------------------------------------------------------ muzzle flashes
{
  const pack = join(downloads, 'binbun-muzzle-flash/assets/BinbunVFX');
  if (!existsSync(pack)) throw new Error(`no ${pack}: unzip MuzzleFlashVFX there`);
  const res = (p) => join(pack, p.replace('res://assets/BinbunVFX/', ''));

  // The atlas: every texture in shared/texture/<kind>/<kind>_NN.png, 256 px each, 4 across.
  const TILE = 256;
  const tiles = [];
  for (const kind of ['flash_front', 'flash_long', 'flash_side']) {
    for (const f of readdirSync(join(pack, 'shared/texture', kind)).filter((f) => /_\d+\.png$/.test(f)).sort()) tiles.push({ id: f.slice(0, -4), path: join(pack, 'shared/texture', kind, f) });
  }
  const cols = 4;
  const rows = Math.ceil(tiles.length / cols);
  const parts = await Promise.all(
    tiles.map(async (t, i) => ({
      input: await sharp(t.path).extractChannel('red').resize(TILE, TILE, { kernel: 'lanczos3' }).toColourspace('b-w').png().toBuffer(),
      left: (i % cols) * TILE,
      top: Math.floor(i / cols) * TILE,
    })),
  );
  const atlas = await sharp({ create: { width: cols * TILE, height: rows * TILE, channels: 3, background: '#000' } }).composite(parts).toColourspace('b-w').webp({ quality: 88 }).toBuffer();
  const tileOf = new Map(tiles.map((t, i) => [t.id, i]));

  /** A material's settings (base shader: a textured quad; glow: a gradient mask), from a .tres or a scene's own sub-resource. */
  function material(ref, own) {
    let r;
    let ext;
    let sub;
    if (ref.ExtResource) {
      const secs = parseGodot(res(own.ext[ref.ExtResource]));
      ({ ext, sub } = resources(secs));
      r = secs.find((s) => s.kind === 'resource').props;
    } else {
      ({ ext, sub } = own);
      r = sub[ref.SubResource].props;
    }
    const p = Object.fromEntries(Object.entries(r).filter(([k]) => k.startsWith('shader_parameter/')).map(([k, v]) => [k.slice(17), v]));
    const shader = basename(ext[r.shader.ExtResource], '.gdshader');
    const m = { shader };
    if (p.main_texture) {
      const id = basename(ext[p.main_texture.ExtResource], '.png');
      if (!tileOf.has(id)) throw new Error(`texture ${id} is not in the atlas`);
      m.tile = tileOf.get(id);
    }
    const num = (k, d) => r4(typeof p[k] === 'number' ? p[k] : d);
    if (shader === 'base') {
      Object.assign(m, {
        align: p.alignment ?? 0,
        noise: p.noise_texture ? num('noise_strength', 0.5) : 0,
        scroll: vec(p.noise_scrolling) ?? [0, 0],
        colorSmooth: num('color_smoothness', 1),
        edgeSmooth: num('edge_smoothness', 1),
        fadeBasic: num('fade_basic_amount', 0.121),
        fadeDir: num('fade_direction_amount', 0.121),
        cutoff: num('edge_cutoff_distance', 0.0534),
        emission: num('emission_strength', 2),
      });
      // The cup of a front flash: edges pushed back along the normal by a radial gradient.
      if (p.offset_texture && num('offset_distance', 0) !== 0) m.cup = { dist: num('offset_distance', 0), exp: num('offset_exponent', 1) };
    } else {
      Object.assign(m, { maskExp: num('mask_exponent', 1), emission: num('emission_amount', 2), alphaMul: num('alpha_multiplier', 0.765) });
    }
    return m;
  }

  /** How far along the flash a node sits, checking it points the way the pack's flashes do (+X). */
  function along(node, axis) {
    const t = node.props.transform?.['@Transform3D'] ?? [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    // Godot writes the basis by rows: column 1 (where the quad's +Y goes) is t[1], t[4], t[7].
    const y = [t[1], t[4], t[7]];
    if (Math.abs(Math.abs(y[0]) - 1) > 1e-3) throw new Error(`${node.attrs.name}: expected its Y along the flash (X)`);
    return { at: r4(t[9]), sign: axis === 'y' ? Math.sign(y[0]) : 1 };
  }

  const effects = {};
  const files = readdirSync(join(pack, 'muzzle_flash/effects'))
    .flatMap((d) => readdirSync(join(pack, 'muzzle_flash/effects', d)).filter((f) => f.endsWith('.tscn')).map((f) => join(pack, 'muzzle_flash/effects', d, f)))
    .sort();
  for (const file of files) {
    const secs = parseGodot(file);
    const own = resources(secs);
    const nodes = secs.filter((s) => s.kind === 'node');
    const root = nodes[0].props;
    const fx = { primary: rgb(root.primary_color), secondary: rgb(root.secondary_color), layers: [] };
    for (const n of nodes.slice(1)) {
      const pr = n.props;
      if (n.attrs.type === 'GPUParticles3D') {
        const pm = own.sub[pr.process_material.SubResource].props;
        const mesh = own.sub[pr.draw_pass_1.SubResource].props;
        const front = mesh.orientation === 1;
        const size = vec(mesh.size) ?? [1, 1];
        const offset = vec(mesh.center_offset) ?? [0, 0, 0];
        const curve = (key) => (pm[key] ? curvePoints(own.sub[own.sub[pm[key].SubResource].props.curve.SubResource]) : null);
        fx.layers.push({
          type: front ? 'front' : 'blade',
          ...material(pr.material_override, own),
          count: pr.amount ?? 8,
          life: r4(pr.lifetime ?? 1),
          explode: r4(pr.explosiveness ?? 0),
          at: along(n, 'y').at,
          // Blades lie along the flash: `w` across it, `h` along it, centred `mid` along from where they start.
          w: size[0],
          h: size[1],
          mid: front ? 0 : r4(offset[1]),
          scale: [r4(pm.scale_min ?? 1), r4(pm.scale_max ?? 1)],
          spin: Math.abs(pm.angle_max ?? 0) > 0 || Math.abs(pm.angle_min ?? 0) > 0,
          alpha: curve('alpha_curve'),
          size: curve('scale_curve'),
        });
      } else if (n.attrs.type === 'MeshInstance3D') {
        const mesh = own.sub[pr.mesh.SubResource].props;
        fx.glow = { ...material(pr.material_override, own), at: along(n, 'y').at, radius: r4(mesh.radius ?? 0.5), height: r4(mesh.height ?? 1) };
      } else if (n.attrs.type === 'OmniLight3D') {
        fx.light = { color: rgb(pr.light_color) ?? fx.primary, energy: r4(pr.light_energy ?? 1), range: r4(pr.omni_range ?? 5) };
      }
    }
    const main = secs.find((s) => s.kind === 'sub_resource' && s.props.resource_name === 'main');
    fx.length = r4(main?.props.length ?? 0.2);
    effects[basename(file, '.tscn')] = fx;
  }
  write('muzzle_flash.webp', atlas, 'binbun-muzzle-flash', 'shared/texture/*/*.png', 'flash textures (atlas)');
  const json = Buffer.from(`${JSON.stringify({ $comment: 'Generated by tools/content/prepare-vfx.mjs from Binbun\'s Muzzle Flash VFX (CC0). Do not edit by hand.', atlas: { file: 'muzzle_flash.webp', cols, rows }, effects })}\n`);
  write('muzzle_flash.json', json, 'binbun-muzzle-flash', 'muzzle_flash/effects/*/*.tscn', 'flash effect settings');
  console.log(`muzzle flashes: ${Object.keys(effects).length} effects, atlas ${(atlas.length / 1024).toFixed(0)} KB`);
}

writeFileSync(LOCK, `${JSON.stringify({ $comment: 'Generated by tools/content/prepare-vfx.mjs. Do not edit by hand.', files: lock }, null, 2)}\n`);
console.log(`wrote ${lock.length} files and content/vfx.lock.json`);
