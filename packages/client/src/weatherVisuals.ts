import type { Scene } from '@babylonjs/core/scene';
import type { Observer } from '@babylonjs/core/Misc/observable';
import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CLEAR_WEATHER, FOG_BANK_SPRITES, weatherFogDensity, weatherParticles, type MapWeather, type SkyDefinition, type Vec3 } from '@tiletrigger/shared';
import type { GraphicsQuality } from './game/graphicsSettings.ts';
import { reduceFlashing } from './game/reduceFlashing.ts';

/**
 * Weather in the world (map/weather.ts; map format v34): rain or snow falling round the camera, fog banks drifting low
 * over the ground, and the haze thickened by fog. Shared by play (game/view.ts) and MapMaker's preview (editorView.ts).
 *
 * Cheap by design (docs/MAP_BUDGETS.md, "Weather"): the fall is one mesh of quads, each drop or flake placed by the
 * vertex shader from a fixed seed, the time and the wind (wrapped in a box that moves with the camera), so the CPU only
 * sets a few uniforms a frame; fog banks are a second mesh of a few large soft sprites. Low graphics (phones) draw no
 * particles at all, only the thicker haze. Nothing here flashes: there is no lightning (CLAUDE.md "Accessibility").
 * Under a roof the fall fades out (a ray up from the camera, a few times a second).
 */

/** The box (m) round the camera the fall wraps in: across, and high. */
const RAIN_BOX = [36, 22] as const;
const SNOW_BOX = [30, 18] as const;
/** Fog banks wrap in this square (m) round the camera. */
const FOG_BOX = 320;
/** How often (s) the camera looks up for a roof. */
const SHELTER_EVERY = 0.25;

Effect.ShadersStore.ttWeatherVertexShader = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 viewProjection;
uniform vec3 camPos;
uniform vec3 camRight;
uniform vec3 camUp;
uniform vec3 fall;
uniform vec2 box;
uniform vec2 size;
uniform float time;
uniform float snow;
varying vec2 vUV;
varying float vFade;
void main(void) {
  // position: the drop's seed (0-1 in its box) and its own speed; uv: the quad's corner.
  vec3 seed = position;
  float speed = 0.75 + 0.5 * fract(seed.x * 13.7 + seed.z * 7.1);
  vec3 b = vec3(box.x, box.y, box.x);
  vec3 p = seed * b + fall * speed * time;
  if (snow > 0.5) p.xz += vec2(sin(time * 1.3 + seed.y * 40.0), cos(time * 1.1 + seed.x * 30.0)) * 0.35;
  vec3 rel = mod(p - camPos + b * 0.5, b) - b * 0.5;
  vec3 world = camPos + rel;
  vec2 c = uv * 2.0 - 1.0;
  vec3 corner;
  if (snow > 0.5) {
    corner = camRight * c.x * size.x + camUp * c.y * size.x;
  } else {
    // A streak along its fall, turned round that line to face the camera.
    vec3 along = normalize(fall);
    vec3 side = normalize(cross(along, world - camPos + vec3(0.0001)));
    corner = side * c.x * size.x + along * c.y * size.y;
  }
  gl_Position = viewProjection * vec4(world + corner, 1.0);
  vUV = uv;
  // Thinner towards the box's edge (no popping as drops wrap) and right at the eye.
  float d = length(rel.xz) / (box.x * 0.5);
  float h = abs(rel.y) / (box.y * 0.5);
  vFade = (1.0 - smoothstep(0.6, 1.0, max(d, h))) * smoothstep(0.4, 1.2, length(rel));
}`;

Effect.ShadersStore.ttWeatherFragmentShader = `
precision highp float;
varying vec2 vUV;
varying float vFade;
uniform vec4 tint;
uniform float snow;
void main(void) {
  vec2 c = vUV * 2.0 - 1.0;
  float a = snow > 0.5 ? 1.0 - smoothstep(0.3, 1.0, length(c)) : (1.0 - abs(c.x)) * (1.0 - c.y * c.y);
  a *= vFade * tint.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(tint.rgb, a);
}`;

Effect.ShadersStore.ttFogBankVertexShader = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 viewProjection;
uniform vec3 camPos;
uniform vec3 camRight;
uniform vec2 drift;
uniform float time;
uniform float baseY;
uniform float boxSize;
varying vec2 vUV;
varying float vFade;
varying float vSeed;
void main(void) {
  // position: x, z seeds (0-1), y the bank's size seed.
  float s = 38.0 + position.y * 46.0;
  vec2 p = position.xz * boxSize + drift * time;
  vec2 rel = mod(p - camPos.xz + boxSize * 0.5, boxSize) - boxSize * 0.5;
  vec3 centre = vec3(camPos.x + rel.x, baseY + s * 0.18, camPos.z + rel.y);
  vec2 c = uv * 2.0 - 1.0;
  // Upright: turned to the camera round the vertical only, wide and low.
  vec3 right = normalize(vec3(camRight.x, 0.0, camRight.z) + vec3(0.0001));
  vec3 world = centre + right * c.x * s + vec3(0.0, 1.0, 0.0) * c.y * s * 0.32;
  gl_Position = viewProjection * vec4(world, 1.0);
  vUV = uv;
  float dist = length(world.xz - camPos.xz);
  // Faded close up (no sprite edge across your face) and towards the square's edge.
  vFade = smoothstep(8.0, 34.0, dist) * (1.0 - smoothstep(boxSize * 0.32, boxSize * 0.5, length(rel)));
  vSeed = position.x * 17.0 + position.z * 5.0;
}`;

Effect.ShadersStore.ttFogBankFragmentShader = `
precision highp float;
varying vec2 vUV;
varying float vFade;
varying float vSeed;
uniform vec4 tint;
uniform float time;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main(void) {
  vec2 c = vUV * 2.0 - 1.0;
  float body = 1.0 - smoothstep(0.15, 1.0, length(vec2(c.x, c.y * 1.25)));
  // Soft lumps that roll slowly (no flicker: 0.02 Hz).
  float n = noise(vUV * 3.0 + vec2(vSeed, time * 0.02)) * 0.6 + noise(vUV * 7.0 - vec2(time * 0.015, vSeed)) * 0.4;
  float a = body * smoothstep(0.25, 0.75, n) * vFade * tint.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(tint.rgb, a);
}`;

/** A mesh of `n` quads, each vertex's position its quad's seed (deterministic), uv its corner. */
function quads(scene: Scene, name: string, n: number, seed: number): Mesh {
  const positions = new Float32Array(n * 12);
  const uvs = new Float32Array(n * 8);
  const indices = new Uint32Array(n * 6);
  let h = seed >>> 0 || 1;
  const rnd = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
  const corners = [0, 0, 1, 0, 1, 1, 0, 1];
  for (let i = 0; i < n; i++) {
    const s = [rnd(), rnd(), rnd()];
    for (let k = 0; k < 4; k++) {
      positions.set(s, i * 12 + k * 3);
      uvs[i * 8 + k * 2] = corners[k * 2]!;
      uvs[i * 8 + k * 2 + 1] = corners[k * 2 + 1]!;
    }
    indices.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  const mesh = new Mesh(name, scene);
  const vd = new VertexData();
  vd.positions = positions;
  vd.uvs = uvs;
  vd.indices = indices;
  vd.applyToMesh(mesh, false);
  mesh.isPickable = false;
  // Placed in the vertex shader round the camera: never culled.
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.doNotSyncBoundingInfo = true;
  mesh.metadata = { effect: true };
  return mesh;
}

function material(scene: Scene, name: string, shader: string, uniforms: string[]): ShaderMaterial {
  const m = new ShaderMaterial(name, scene, { vertex: shader, fragment: shader }, { attributes: ['position', 'uv'], uniforms, needAlphaBlending: true });
  m.backFaceCulling = false;
  m.disableDepthWrite = true;
  m.alphaMode = Constants.ALPHA_COMBINE;
  m.blockDirtyMechanism = true;
  return m;
}

export interface WeatherStats {
  /** Drops or flakes drawn (0 on Low). */
  particles: number;
  /** Fog bank sprites drawn. */
  fogBanks: number;
  /** Draw calls the weather adds. */
  draws: number;
  /** The haze it adds (scene fog density). */
  fogDensity: number;
  /** 0 out in the open, 1 under a roof (the fall faded out). */
  shelter: number;
}

export class WeatherVisuals {
  private weather: MapWeather = CLEAR_WEATHER;
  private fall: Mesh | null = null;
  private fallMat: ShaderMaterial | null = null;
  private banks: Mesh | null = null;
  private bankMat: ShaderMaterial | null = null;
  private observer: Observer<Scene> | null = null;
  private addedFog = 0;
  /** The haze colour before thick fog greyed it (put back by clear). */
  private fogColorBefore: Color3 | null = null;
  /** The haze as this left it: clear takes its part back only if nothing set the haze afresh since (the backdrop). */
  private fogSet: { density: number; color: Color3 } | null = null;
  private shelterAt = 0;
  private covered = false;
  private shelterLevel = 0;
  private last = 0;
  private readonly start = performance.now();
  /** The fall's colour by the sky's light, and the fog's. */
  private tints = { fall: new Color3(0.7, 0.75, 0.8), fog: new Color3(0.7, 0.72, 0.75), light: 1 };
  readonly stats: WeatherStats = { particles: 0, fogBanks: 0, draws: 0, fogDensity: 0, shelter: 0 };

  constructor(
    private readonly scene: Scene,
    private readonly quality: GraphicsQuality,
    /** A ray up from a point hits a roof within this many metres (play: the level's shapes); absent: always open sky. */
    private readonly roofOver?: (at: Vec3) => boolean,
  ) {}

  /** The weather in effect (clear when none). */
  get current(): MapWeather {
    return this.weather;
  }

  /**
   * Show a weather under a sky (its colours light the rain, snow and fog), `groundY` the low ground the fog banks lie
   * on. Call after the backdrop is built (it adds to the backdrop's haze; calling again replaces what it added).
   */
  set(weather: MapWeather, sky: SkyDefinition | null, groundY: number): void {
    this.clear();
    this.weather = weather;
    const light = sky ? Math.min(1.15, sky.light.hemi * 0.75 + sky.light.sun * 0.35) : 1;
    const horizon = sky ? Color3.FromHexString(sky.horizon) : new Color3(0.6, 0.65, 0.7);
    this.tints = {
      fall: weather.fall === 'snow' ? new Color3(0.95, 0.97, 1).scale(Math.min(1, 0.35 + light * 0.6)) : Color3.Lerp(horizon, new Color3(0.8, 0.84, 0.9), 0.5).scale(Math.min(1, 0.45 + light * 0.5)),
      fog: Color3.Lerp(horizon, new Color3(0.8, 0.82, 0.85), 0.35).scale(Math.min(1, 0.5 + light * 0.45)),
      light,
    };
    // The haze: the weather's fog on every setting (Low too: it's the mist, and costs nothing).
    this.addedFog = weatherFogDensity(weather);
    if (this.addedFog > 0) {
      if (this.scene.fogMode !== 2) this.scene.fogMode = 2;
      this.scene.fogDensity += this.addedFog;
      // Thick fog greys the haze towards the fog's own colour.
      if (weather.fog > 0) {
        this.fogColorBefore = this.scene.fogColor.clone();
        this.scene.fogColor = Color3.Lerp(this.scene.fogColor, this.tints.fog, Math.min(0.6, weather.fog * 0.6));
      }
      this.fogSet = { density: this.scene.fogDensity, color: this.scene.fogColor.clone() };
    }
    const n = weatherParticles(weather, this.quality);
    if (n > 0) {
      this.fall = quads(this.scene, 'weather_fall', n, weather.fall === 'snow' ? 0x5eed5 : 0x7a11);
      this.fallMat = material(this.scene, 'weather_fallMat', 'ttWeather', ['viewProjection', 'camPos', 'camRight', 'camUp', 'fall', 'box', 'size', 'time', 'snow', 'tint']);
      this.fall.material = this.fallMat;
    }
    const banks = weather.fog > 0.05 ? Math.round(FOG_BANK_SPRITES[this.quality] * Math.min(1, 0.4 + weather.fog)) : 0;
    if (banks > 0) {
      this.banks = quads(this.scene, 'weather_fogBanks', banks, 0xf09);
      this.bankMat = material(this.scene, 'weather_fogBankMat', 'ttFogBank', ['viewProjection', 'camPos', 'camRight', 'drift', 'time', 'baseY', 'boxSize', 'tint']);
      this.bankMat.setFloat('baseY', groundY);
      this.bankMat.setFloat('boxSize', FOG_BOX);
      this.banks.material = this.bankMat;
    }
    Object.assign(this.stats, { particles: n, fogBanks: banks, draws: (n ? 1 : 0) + (banks ? 1 : 0), fogDensity: this.addedFog, shelter: 0 });
    if (this.fall || this.banks) this.observer = this.scene.onBeforeRenderObservable.add(() => this.frame());
  }

  /** The wind as a velocity (m/s) on the ground: from the west-south-west, as the shafts of the presets' sun. */
  private windVelocity(): [number, number] {
    const w = this.weather.wind;
    return [w * 9, w * 4];
  }

  private frame(): void {
    const cam = this.scene.activeCamera;
    if (!cam) return;
    const now = performance.now();
    const t = (now - this.start) / 1000;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const eye = cam.globalPosition;
    const vp = this.scene.getTransformMatrix();
    const view = cam.getViewMatrix();
    // The camera's right and up in the world (the view matrix's first two columns).
    const m = view.m;
    const right = new Vector3(m[0], m[4], m[8]);
    const up = new Vector3(m[1], m[5], m[9]);
    const [wx, wz] = this.windVelocity();
    // Under a roof: the fall fades out over half a second, and back in the open.
    if (this.roofOver && this.fall) {
      this.shelterAt -= dt;
      if (this.shelterAt <= 0) {
        this.shelterAt = SHELTER_EVERY;
        this.covered = this.roofOver({ x: eye.x, y: eye.y, z: eye.z });
      }
      this.shelterLevel += ((this.covered ? 1 : 0) - this.shelterLevel) * Math.min(1, dt * 4);
      this.stats.shelter = this.shelterLevel;
    }
    // Reduce flashing (CLAUDE.md "Accessibility"): the fall a little fainter, flakes never brighter than mid-white.
    const calm = reduceFlashing();
    if (this.fall && this.fallMat) {
      const snow = this.weather.fall === 'snow';
      const mat = this.fallMat;
      const a = this.weather.amount;
      const open = 1 - this.shelterLevel;
      mat.setMatrix('viewProjection', vp);
      mat.setVector3('camPos', eye);
      mat.setVector3('camRight', right);
      mat.setVector3('camUp', up);
      mat.setVector3('fall', snow ? new Vector3(wx * 0.6, -1.4, wz * 0.6) : new Vector3(wx, -11, wz));
      const box = snow ? SNOW_BOX : RAIN_BOX;
      mat.setVector2('box', new Vector2(box[0], box[1]));
      mat.setVector2('size', snow ? new Vector2(0.035 + a * 0.02, 0) : new Vector2(0.008 + a * 0.004, 0.35 + a * 0.25));
      mat.setFloat('time', t);
      mat.setFloat('snow', snow ? 1 : 0);
      const tint = this.tints.fall.scale(calm && snow ? 0.85 : 1);
      const alpha = (snow ? 0.55 + a * 0.3 : 0.18 + a * 0.17) * open * (calm ? 0.85 : 1);
      mat.setColor4('tint', new Color4(tint.r, tint.g, tint.b, alpha));
      this.fall.isVisible = open > 0.01;
    }
    if (this.banks && this.bankMat) {
      const mat = this.bankMat;
      mat.setMatrix('viewProjection', vp);
      mat.setVector3('camPos', eye);
      mat.setVector3('camRight', right);
      mat.setVector2('drift', new Vector2(wx * 0.35 + 0.4, wz * 0.35 + 0.2));
      mat.setFloat('time', t);
      mat.setColor4('tint', new Color4(this.tints.fog.r, this.tints.fog.g, this.tints.fog.b, 0.22 + this.weather.fog * 0.3));
    }
  }

  /** Take the weather away (what it added to the haze too). */
  clear(): void {
    if (this.observer) this.scene.onBeforeRenderObservable.remove(this.observer);
    this.observer = null;
    this.fall?.dispose();
    this.fallMat?.dispose();
    this.banks?.dispose();
    this.bankMat?.dispose();
    this.fall = this.banks = null;
    this.fallMat = this.bankMat = null;
    const ours = !!this.fogSet && Math.abs(this.scene.fogDensity - this.fogSet.density) < 1e-9 && this.scene.fogColor.equals(this.fogSet.color);
    if (ours && this.addedFog) this.scene.fogDensity = Math.max(0, this.scene.fogDensity - this.addedFog);
    if (ours && this.fogColorBefore) this.scene.fogColor = this.fogColorBefore;
    this.addedFog = 0;
    this.fogColorBefore = null;
    this.fogSet = null;
    this.weather = CLEAR_WEATHER;
    this.shelterLevel = 0;
    this.covered = false;
    Object.assign(this.stats, { particles: 0, fogBanks: 0, draws: 0, fogDensity: 0, shelter: 0 });
  }

  dispose(): void {
    this.clear();
  }
}
