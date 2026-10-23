import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import {
  CHARACTER_PARTS,
  COLORWAYS,
  CORE_LOOKS,
  HAIR_COLORS,
  HAIR_STYLES,
  PART_SLOTS,
  PART_SLOT_LABELS,
  PLAYER,
  REQUIRED_SLOTS,
  SKIN_TONES,
  encodeLook,
  getLook,
  getWeapon,
  lookProblems,
  partInfo,
  type BodyType,
  type CharacterLook,
  type PartSlot,
} from '@chronosplit/shared';
import { CharacterLibrary } from '../content/characters.ts';
import { ModelLibrary } from '../content/models.ts';
import { CharacterAnimator, type MotionState } from '../game/characterAnimator.ts';
import { deleteCustomLook, listCustomLooks, saveCustomLook, type SavedLook } from './customLooks.ts';

type Draft = Pick<CharacterLook, 'body' | 'parts' | 'hair' | 'colorways' | 'skin' | 'hairColor'> & { name: string };

const sx = (body: BodyType) => (body === 'male' ? 'm' : 'f');

/**
 * The Character Designer: mix a body, outfit parts, hair, colourways and
 * skin and hair colours from the shared part catalogue, with a live animated
 * preview. Looks are saved in this browser and travel to other players as
 * short IDs (see encodeLook in looks.ts).
 */
export class CharacterDesigner {
  private readonly scene: Scene;
  private readonly characters: CharacterLibrary;
  private readonly models: ModelLibrary;
  private readonly root = document.createElement('div');
  private draft: Draft;
  private anim: CharacterAnimator | null = null;
  private token = 0;
  private rebuildTimer?: number;
  private weapon: string | null = 'core.rifle';
  private readonly state: MotionState = { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false };

  constructor(
    engine: AbstractEngine,
    canvas: HTMLCanvasElement,
    startLook: string,
    private readonly done: (lookId: string | null) => void,
  ) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.13, 0.15, 0.18, 1);
    const camera = new ArcRotateCamera('designerCam', Math.PI / 2 - 0.35, 1.3, 3.6, new Vector3(-0.6, 0.95, 0), this.scene);
    camera.lowerRadiusLimit = 1.4;
    camera.upperRadiusLimit = 6;
    camera.wheelPrecision = 60;
    camera.minZ = 0.05;
    camera.attachControl(canvas, true);
    new HemisphericLight('hemi', new Vector3(0.3, 1, -0.4), this.scene).intensity = 0.95;
    new DirectionalLight('key', new Vector3(-0.5, -1, 0.8), this.scene).intensity = 0.7;
    const floor = CreateDisc('designerFloor', { radius: 1.6, tessellation: 48 }, this.scene);
    floor.rotation.x = Math.PI / 2;
    const fm = new StandardMaterial('designerFloorMat', this.scene);
    fm.diffuseColor = new Color3(0.24, 0.26, 0.3);
    fm.specularColor = Color3.Black();
    floor.material = fm;
    this.characters = new CharacterLibrary(this.scene);
    this.models = new ModelLibrary(this.scene);

    const saved = listCustomLooks().find((s) => s.id === startLook);
    const l = getLook(startLook);
    this.draft = { name: saved?.name ?? (l.name === 'Custom' ? 'My character' : `My ${l.name}`), body: l.body, parts: [...l.parts], hair: [...l.hair], colorways: [...l.colorways], skin: l.skin, hairColor: l.hairColor };

    this.root.id = 'designer';
    document.body.append(this.root);
    this.render();
    this.rebuild();
    (window as unknown as { __designer: CharacterDesigner }).__designer = this;
  }

  /** The look being edited, as its ID (for tests and saving). */
  get lookId(): string {
    return encodeLook(this.draft);
  }

  get problems(): string[] {
    return lookProblems(this.draft);
  }

  frame(dt: number): void {
    this.anim?.update(dt, this.state);
    this.scene.render();
  }

  dispose(): void {
    clearTimeout(this.rebuildTimer);
    this.anim?.dispose();
    this.root.remove();
    this.scene.dispose();
  }

  // ---------------------------------------------------------------- preview

  /** Rebuild the preview character (debounced; the previous one stays until the new one is ready). */
  private rebuild(): void {
    clearTimeout(this.rebuildTimer);
    this.rebuildTimer = window.setTimeout(() => void this.build(), 40);
  }

  private async build(): Promise<void> {
    if (this.problems.length) return;
    const token = ++this.token;
    const ch = await this.characters.create({ look: this.lookId }, `designer_${token}`);
    if (token !== this.token || this.scene.isDisposed) return ch.dispose();
    const { min, max } = ch.root.getHierarchyBoundingVectors(true);
    ch.root.scaling.scaleInPlace(PLAYER.height / Math.max(0.5, max.y - min.y));
    this.anim?.dispose();
    this.anim = new CharacterAnimator(this.scene, ch);
    if (this.weapon) {
      const w = getWeapon(this.weapon);
      const node = await this.models.instantiate(w.view.model, `designer_w_${token}`);
      if (token === this.token) this.anim.hold(node, w.view.hold);
      else node.dispose();
    }
  }

  // ---------------------------------------------------------------- editing

  private update(change: Partial<Draft>): void {
    this.draft = { ...this.draft, ...change };
    this.render();
    this.rebuild();
  }

  private setPart(slot: PartSlot, id: string | null): void {
    let parts = this.draft.parts.filter((p) => partInfo(p)?.slot !== slot);
    if (id) parts.push(id);
    // A sportswear top has bare arms; any other top needs sleeves, so bring the matching arms along.
    const top = parts.map(partInfo).find((p) => p?.slot === 'torso');
    if (slot === 'torso' && top?.outfit === 'athlete') parts = parts.filter((p) => partInfo(p)?.slot !== 'arms');
    if (slot === 'torso' && top && top.outfit !== 'athlete' && !parts.some((p) => partInfo(p)?.slot === 'arms')) parts.push(`${top.outfit}_arms_${sx(this.draft.body)}`);
    // Keep colourways only for outfits still worn.
    const outfits = new Set(parts.map((p) => partInfo(p)?.outfit));
    this.update({ parts, colorways: this.draft.colorways.filter((c) => outfits.has(COLORWAYS.find((w) => w.id === c)?.family)) });
  }

  private setBody(body: BodyType): void {
    if (body === this.draft.body) return;
    const swap = (id: string) => id.replace(/_[mf]$/, `_${sx(body)}`);
    const colorways = this.draft.colorways.map((c) => (c.startsWith('athlete_light') ? `athlete_light_${sx(body)}` : c));
    this.update({ body, parts: this.draft.parts.map(swap), hair: [HAIR_STYLES[body][0]!.id], colorways });
  }

  private load(id: string): void {
    const l = getLook(id);
    const saved = listCustomLooks().find((s) => s.id === id);
    this.update({ name: saved?.name ?? `My ${l.name}`, body: l.body, parts: [...l.parts], hair: [...l.hair], colorways: [...l.colorways], skin: l.skin, hairColor: l.hairColor });
  }

  // ---------------------------------------------------------------- panel

  private render(): void {
    const d = this.draft;
    const el = this.root;
    el.replaceChildren();
    const h = (text: string) => {
      const x = document.createElement('h3');
      x.textContent = text;
      el.append(x);
    };
    const rowOf = (...children: HTMLElement[]) => {
      const r = document.createElement('div');
      r.className = 'dz-row';
      r.append(...children);
      el.append(r);
      return r;
    };
    const button = (label: string, on: boolean, click: () => void, title = '') => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = title;
      b.classList.toggle('on', on);
      b.addEventListener('click', click);
      return b;
    };
    const select = (options: [string, string][], value: string, change: (v: string) => void) => {
      const s = document.createElement('select');
      for (const [v, l] of options) s.append(new Option(l, v, false, v === value));
      s.addEventListener('change', () => change(s.value));
      return s;
    };
    const swatches = (colors: readonly string[], value: string | null, set: (c: string | null) => void, noneLabel: string) => {
      const r = rowOf();
      r.classList.add('dz-swatches');
      r.append(button(noneLabel, value === null, () => set(null), 'No tint'));
      for (const c of colors) {
        const b = button('', value === c, () => set(c), c);
        b.style.background = c;
        r.append(b);
      }
      const custom = document.createElement('input');
      custom.type = 'color';
      custom.value = value ?? '#ffffff';
      custom.title = 'Any colour';
      custom.addEventListener('change', () => set(custom.value.toLowerCase()));
      r.append(custom);
    };

    const title = document.createElement('h2');
    title.textContent = 'Character Designer';
    el.append(title);
    const name = document.createElement('input');
    name.value = d.name;
    name.maxLength = 24;
    name.placeholder = 'Name';
    name.addEventListener('change', () => (this.draft = { ...this.draft, name: name.value.trim() || 'My character' }));
    rowOf(name);

    const saved = listCustomLooks();
    const starts: [string, string][] = [['', 'Start from…'], ...CORE_LOOKS.map((l): [string, string] => [l.id, `Preset: ${l.name}`]), ...saved.map((s): [string, string] => [s.id, `Saved: ${s.name}`])];
    rowOf(select(starts, '', (v) => v && this.load(v)));

    h('Body');
    rowOf(button('Male', d.body === 'male', () => this.setBody('male')), button('Female', d.body === 'female', () => this.setBody('female')));

    h('Outfit');
    const bareArms = d.parts.some((p) => partInfo(p)?.outfit === 'athlete' && partInfo(p)?.slot === 'torso');
    for (const slot of PART_SLOTS) {
      if (slot === 'arms' && bareArms) continue;
      const current = d.parts.find((p) => partInfo(p)?.slot === slot) ?? '';
      const options: [string, string][] = CHARACTER_PARTS.filter((p) => p.body === d.body && p.slot === slot).map((p) => [p.id, p.label]);
      if (!REQUIRED_SLOTS.includes(slot) && slot !== 'arms') options.unshift(['', 'None']);
      const label = document.createElement('label');
      label.textContent = PART_SLOT_LABELS[slot];
      rowOf(label, select(options, current, (v) => this.setPart(slot, v || null)));
    }

    const families = [...new Set(d.parts.map((p) => partInfo(p)?.outfit))].filter((f): f is NonNullable<typeof f> => !!f && COLORWAYS.some((c) => c.family === f));
    if (families.length) {
      h('Colours');
      for (const f of families) {
        const ways = COLORWAYS.filter((c) => c.family === f && (c.body === null || c.body === d.body));
        const current = d.colorways.find((c) => ways.some((w) => w.id === c)) ?? '';
        const label = document.createElement('label');
        label.textContent = f === 'athlete' ? 'Sportswear' : f[0]!.toUpperCase() + f.slice(1);
        rowOf(
          label,
          select([['', 'Original'], ...ways.map((w): [string, string] => [w.id, w.label])], current, (v) =>
            this.update({ colorways: [...d.colorways.filter((c) => !ways.some((w) => w.id === c)), ...(v ? [v] : [])] }),
          ),
        );
      }
    }

    h('Hair');
    rowOf(...HAIR_STYLES[d.body].map((s) => button(s.label, d.hair.includes(s.id), () => this.update({ hair: d.hair.includes(s.id) ? d.hair.filter((x) => x !== s.id) : [...d.hair, s.id] }))));
    swatches(HAIR_COLORS, d.hairColor, (c) => this.update({ hairColor: c }), 'Natural');

    h('Skin');
    swatches(
      SKIN_TONES.filter((c) => c !== '#ffffff'),
      d.skin,
      (c) => this.update({ skin: c }),
      'Base',
    );

    h('Preview');
    const pose = (label: string, on: boolean, s: Partial<MotionState>) => button(label, on, () => (Object.assign(this.state, { speed: 0, celebrate: false, ...s }), this.render()));
    rowOf(pose('Idle', this.state.speed === 0 && !this.state.celebrate, {}), pose('Run', this.state.speed > 0, { speed: 6 }), pose('Dance', this.state.celebrate, { celebrate: true }));
    const weapon = (label: string, id: string | null) =>
      button(label, this.weapon === id, () => {
        this.weapon = id;
        this.render();
        this.rebuild();
      });
    rowOf(weapon('Unarmed', null), weapon('Pistol', 'core.pistol'), weapon('Rifle', 'core.rifle'), weapon('Shotgun', 'core.shotgun'));

    const problems = this.problems;
    if (problems.length) {
      const p = document.createElement('p');
      p.className = 'dz-problems';
      p.textContent = `Can't wear this yet: ${problems.join('; ')}.`;
      el.append(p);
    }
    const actions = rowOf(
      button('Save and use', false, () => {
        const entry: SavedLook = { id: this.lookId, name: this.draft.name };
        saveCustomLook(entry);
        this.done(entry.id);
      }),
      button('Back', false, () => this.done(null)),
    );
    actions.className = 'dz-actions';
    (actions.firstChild as HTMLButtonElement).classList.add('primary');
    (actions.firstChild as HTMLButtonElement).disabled = problems.length > 0;
    if (saved.some((s) => s.id === this.lookId)) {
      actions.append(
        button('Delete saved', false, () => {
          deleteCustomLook(this.lookId);
          this.render();
        }),
      );
    }
  }
}
