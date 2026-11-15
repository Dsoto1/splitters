import { a as applyToneMapping, C as CharacterLibrary, M as ModelLibrary, l as listCustomLooks, g as getLook, D as DEFAULT_LOOK, e as encodeLook, b as lookProblems, P as PLAYER, B as BODY_SIZES, c as CharacterAnimator, d as getWeapon, p as partInfo, f as COLORWAYS, H as HAIR_STYLES, G as GEAR_SLOTS, h as GEAR, s as saveCustomLook, S as SKIN_TONES, i as HAIR_COLORS, j as PART_SLOTS, k as CHARACTER_PARTS, m as PART_SLOT_LABELS, n as gearInfo, o as CORE_LOOKS, q as DYE_COLORS, R as REQUIRED_SLOTS, r as GEAR_SLOT_LABELS, t as deleteCustomLook } from "./index-BAsW2uYW.js";
import { S as Scene, C as Color4, V as Vector3, H as HemisphericLight, a as Color3, D as DirectionalLight, P as PointLight, b as CreateDisc, c as StandardMaterial } from "./babylon-PnzH6wcM.js";
import { A as ArcRotateCamera } from "./arcRotateCamera-CsS6MmRY.js";
import { C as CreateTorus } from "./torusBuilder-BTtpdox_.js";
import "./vendor-BIr0ad6t.js";
import "./easing-CT5FBt-r.js";
const sx = (body) => body === "male" ? "m" : "f";
class CharacterDesigner {
  constructor(engine, canvas, startLook, done, portraits) {
    this.done = done;
    this.portraits = portraits;
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.043, 0.059, 0.102, 1);
    applyToneMapping(this.scene);
    const camera = new ArcRotateCamera("designerCam", Math.PI / 2 - 0.3, 1.32, 3.4, new Vector3(0, 0.95, 0), this.scene);
    camera.lowerRadiusLimit = 1.4;
    camera.upperRadiusLimit = 6;
    camera.wheelPrecision = 60;
    camera.minZ = 0.05;
    camera.attachControl(canvas, true);
    const hemi = new HemisphericLight("hemi", new Vector3(0.3, 1, 0.4), this.scene);
    hemi.intensity = 0.9;
    hemi.groundColor = new Color3(0.1, 0.12, 0.2);
    new DirectionalLight("key", new Vector3(-0.5, -0.8, -0.9), this.scene).intensity = 2.2;
    const fill = new DirectionalLight("fill", new Vector3(0.6, -0.3, -1), this.scene);
    fill.intensity = 0.8;
    fill.specular = Color3.Black();
    const rim = new PointLight("rim", new Vector3(0, 2.4, -1.4), this.scene);
    rim.diffuse = Color3.FromHexString("#00d1ff");
    rim.intensity = 2;
    rim.range = 4;
    const floor = CreateDisc("designerFloor", { radius: 1.3, tessellation: 64 }, this.scene);
    floor.rotation.x = Math.PI / 2;
    const fm = new StandardMaterial("designerFloorMat", this.scene);
    fm.emissiveColor = Color3.FromHexString("#16233a");
    fm.disableLighting = true;
    floor.material = fm;
    const ring = CreateTorus("designerRing", { diameter: 2.6, thickness: 0.025, tessellation: 96 }, this.scene);
    ring.position.y = 0.01;
    const rm = new StandardMaterial("designerRingMat", this.scene);
    rm.emissiveColor = Color3.FromHexString("#00d1ff");
    rm.disableLighting = true;
    ring.material = rm;
    this.characters = new CharacterLibrary(this.scene);
    this.models = new ModelLibrary(this.scene);
    const saved = listCustomLooks().find((s) => s.id === startLook);
    const l = getLook(getLook(startLook).whole ? DEFAULT_LOOK : startLook);
    this.draft = { name: saved?.name ?? (l.name === "Custom" ? "My character" : `My ${l.name}`), body: l.body, parts: [...l.parts], hair: [...l.hair], colorways: [...l.colorways], skin: l.skin, hairColor: l.hairColor, size: l.size, cloth: l.cloth ?? null, trim: l.trim ?? null, gear: [...l.gear ?? []] };
    this.root.id = "designer";
    document.body.append(this.root);
    window.addEventListener("keydown", this.keys);
    this.render();
    this.rebuild();
    window.__designer = this;
  }
  done;
  portraits;
  scene;
  characters;
  models;
  root = document.createElement("div");
  draft;
  anim = null;
  token = 0;
  rebuildTimer;
  weapon = "core.rifle";
  state = { speed: 0, moveAngle: 0, airborne: false, alive: true, pitch: 0, celebrate: false };
  tab = "body";
  keys = (e) => this.onKey(e);
  /** The look being edited, as its ID (for tests and saving). */
  get lookId() {
    return encodeLook(this.draft);
  }
  get problems() {
    return lookProblems(this.draft);
  }
  frame(dt) {
    this.anim?.update(dt, this.state);
    this.scene.render();
  }
  dispose() {
    window.removeEventListener("keydown", this.keys);
    clearTimeout(this.rebuildTimer);
    this.anim?.dispose();
    this.root.remove();
    this.scene.dispose();
  }
  // ---------------------------------------------------------------- preview
  /** Rebuild the preview character (debounced; the previous one stays until the new one is ready). */
  rebuild() {
    clearTimeout(this.rebuildTimer);
    this.rebuildTimer = window.setTimeout(() => void this.build(), 40);
  }
  async build() {
    if (this.problems.length) return;
    const token = ++this.token;
    const ch = await this.characters.create({ look: this.lookId }, `designer_${token}`);
    if (token !== this.token || this.scene.isDisposed) return ch.dispose();
    const { min, max } = ch.root.getHierarchyBoundingVectors(true);
    ch.root.scaling.scaleInPlace(PLAYER.height * BODY_SIZES[this.draft.size ?? "standard"].scale / Math.max(0.5, max.y - min.y));
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
  update(change) {
    this.draft = { ...this.draft, ...change };
    this.render();
    this.rebuild();
  }
  setPart(slot, id) {
    let parts = this.draft.parts.filter((p) => partInfo(p)?.slot !== slot);
    if (id) parts.push(id);
    const top = parts.map(partInfo).find((p) => p?.slot === "torso");
    if (slot === "torso" && top?.outfit === "athlete") parts = parts.filter((p) => partInfo(p)?.slot !== "arms");
    if (slot === "torso" && top && top.outfit !== "athlete" && !parts.some((p) => partInfo(p)?.slot === "arms")) parts.push(`${top.outfit}_arms_${sx(this.draft.body)}`);
    const outfits = new Set(parts.map((p) => partInfo(p)?.outfit));
    this.update({ parts, colorways: this.draft.colorways.filter((c) => outfits.has(COLORWAYS.find((w) => w.id === c)?.family)) });
  }
  setBody(body) {
    if (body === this.draft.body) return;
    const swap = (id) => id.replace(/_[mf]$/, `_${sx(body)}`);
    const colorways = this.draft.colorways.map((c) => c.startsWith("athlete_light") ? `athlete_light_${sx(body)}` : c);
    this.update({ body, parts: this.draft.parts.map(swap), hair: [HAIR_STYLES[body][0].id], colorways });
  }
  load(id) {
    const l = getLook(id);
    const saved = listCustomLooks().find((s) => s.id === id);
    this.update({ name: saved?.name ?? `My ${l.name}`, body: l.body, parts: [...l.parts], hair: [...l.hair], colorways: [...l.colorways], skin: l.skin, hairColor: l.hairColor, size: l.size, cloth: l.cloth ?? null, trim: l.trim ?? null, gear: [...l.gear ?? []] });
  }
  /** A random wearable look for the current body. */
  randomize() {
    const body = this.draft.body;
    const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
    const of = (slot) => CHARACTER_PARTS.filter((p) => p.body === body && p.slot === slot);
    const torso = pick(of("torso"));
    const parts = [torso.id];
    if (torso.outfit !== "athlete") parts.push(pick(of("arms")).id);
    parts.push(pick(of("legs")).id, pick(of("feet")).id);
    if (Math.random() < 0.5) parts.push(pick(of("hood")).id);
    if (Math.random() < 0.4) parts.push(pick(of("pauldron")).id);
    const styles = HAIR_STYLES[body];
    const hair = [pick(styles.filter((h) => h.id !== "hair_beard")).id, ...body === "male" && Math.random() < 0.35 ? ["hair_beard"] : []];
    const outfits = new Set(parts.map((p) => partInfo(p)?.outfit));
    const colorways = COLORWAYS.filter((c) => outfits.has(c.family) && (c.body === null || c.body === body) && Math.random() < 0.5).map((c) => c.id);
    const hooded = parts.some((p) => partInfo(p)?.slot === "hood");
    const gear = GEAR_SLOTS.flatMap((slot) => {
      const options = GEAR.filter((g) => g.slot === slot && !(hooded && slot === "hat"));
      return options.length && Math.random() < 0.45 ? [pick(options).id] : [];
    });
    const dye = () => Math.random() < 0.6 ? pick(DYE_COLORS) : null;
    this.update({ parts, hair, colorways, skin: pick([null, ...SKIN_TONES.slice(1)]), hairColor: pick(HAIR_COLORS), cloth: dye(), trim: dye(), gear });
  }
  onKey(e) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    const tabs = ["body", "head", "outfit", "gear", "colours"];
    if (e.key === "q" || e.key === "e") {
      this.tab = tabs[(tabs.indexOf(this.tab) + (e.key === "e" ? 1 : tabs.length - 1)) % tabs.length];
      this.render();
    } else if (e.key === "r") this.randomize();
    else if (e.key === "Escape") this.done(null);
    else if (e.key === "Enter" && !this.problems.length) this.save();
  }
  save() {
    const entry = { id: this.lookId, name: this.draft.name };
    saveCustomLook(entry);
    this.done(entry.id);
  }
  // ---------------------------------------------------------------- panel
  render() {
    const d = this.draft;
    const left = document.createElement("div");
    left.className = "dz-left panel";
    const right = document.createElement("div");
    right.className = "dz-right panel";
    const add = (parent, ...children) => parent.append(...children);
    const h = (parent, text) => {
      const x = document.createElement("h3");
      x.textContent = text;
      parent.append(x);
    };
    const rowOf = (parent, ...children) => {
      const r = document.createElement("div");
      r.className = "dz-row";
      r.append(...children);
      parent.append(r);
      return r;
    };
    const button = (label, on, click, title2 = "") => {
      const b = document.createElement("button");
      b.textContent = label;
      b.title = title2;
      b.classList.toggle("on", on);
      b.addEventListener("click", click);
      return b;
    };
    const tile = (label, on, click) => {
      const b = button(label, on, click);
      b.className = `dz-tile${on ? " on" : ""}`;
      return b;
    };
    const select = (options, value, change) => {
      const s = document.createElement("select");
      for (const [v, l] of options) s.append(new Option(l, v, false, v === value));
      s.addEventListener("change", () => change(s.value));
      return s;
    };
    const swatches = (parent, colors, value, set, noneLabel) => {
      const r = rowOf(parent);
      r.classList.add("dz-swatches");
      r.append(button(noneLabel, value === null, () => set(null), "No tint"));
      for (const c of colors) {
        const b = button("", value === c, () => set(c), c);
        b.style.background = c;
        r.append(b);
      }
      const custom = document.createElement("input");
      custom.type = "color";
      custom.value = value ?? "#ffffff";
      custom.title = "Any colour";
      custom.addEventListener("change", () => set(custom.value.toLowerCase()));
      r.append(custom);
    };
    const top = document.createElement("header");
    top.className = "dz-top";
    const title = document.createElement("h2");
    title.innerHTML = "Character <em>Designer</em>";
    const tabs = document.createElement("div");
    tabs.className = "tabs";
    const bumper = (k) => Object.assign(document.createElement("span"), { className: "bumper", textContent: k });
    tabs.append(bumper("Q"));
    for (const [id, label] of [["body", "Body"], ["head", "Head"], ["outfit", "Outfit"], ["gear", "Gear"], ["colours", "Colours"]]) {
      const b = button(label, this.tab === id, () => (this.tab = id, this.render()));
      b.className = `tab${this.tab === id ? " on" : ""}`;
      tabs.append(b);
    }
    tabs.append(bumper("E"));
    top.append(title, tabs);
    if (this.tab === "body") {
      h(left, "Body type");
      add(left, tile("Male", d.body === "male", () => this.setBody("male")), tile("Female", d.body === "female", () => this.setBody("female")));
      h(left, "Size");
      add(
        left,
        ...["small", "standard", "large"].map(
          (z) => tile(BODY_SIZES[z].label, (d.size ?? "standard") === z, () => this.update({ size: z === "standard" ? void 0 : z }))
        )
      );
      left.append(Object.assign(document.createElement("p"), { className: "dz-note", textContent: "Small: a smaller, quicker target that fits through gaps others must crouch for, 85 health. Large: bigger, slower, 115 health. Hosts can turn sizes off." }));
      h(left, "Skin tone");
      swatches(left, SKIN_TONES.filter((c) => c !== "#ffffff"), d.skin, (c) => this.update({ skin: c }), "Base");
    } else if (this.tab === "head") {
      h(left, "Hair & beard");
      add(left, ...HAIR_STYLES[d.body].map((st) => tile(st.label, d.hair.includes(st.id), () => this.update({ hair: d.hair.includes(st.id) ? d.hair.filter((x) => x !== st.id) : [...d.hair, st.id] }))));
      h(left, "Hair colour");
      swatches(left, HAIR_COLORS, d.hairColor, (c) => this.update({ hairColor: c }), "Natural");
    } else if (this.tab === "outfit") {
      h(left, "Outfit parts");
      const bareArms = d.parts.some((p) => partInfo(p)?.outfit === "athlete" && partInfo(p)?.slot === "torso");
      for (const slot of PART_SLOTS) {
        if (slot === "arms" && bareArms) continue;
        const current = d.parts.find((p) => partInfo(p)?.slot === slot) ?? "";
        const options = CHARACTER_PARTS.filter((p) => p.body === d.body && p.slot === slot).map((p) => [p.id, p.label]);
        if (!REQUIRED_SLOTS.includes(slot) && slot !== "arms") options.unshift(["", "None"]);
        const label = document.createElement("label");
        label.textContent = PART_SLOT_LABELS[slot];
        rowOf(left, label, select(options, current, (v) => this.setPart(slot, v || null)));
      }
    } else if (this.tab === "gear") {
      const hooded = d.parts.some((p) => partInfo(p)?.slot === "hood");
      for (const slot of GEAR_SLOTS) {
        h(left, GEAR_SLOT_LABELS[slot]);
        const current = (d.gear ?? []).find((g) => gearInfo(g)?.slot === slot) ?? null;
        const set = (id) => this.update({ gear: [...(d.gear ?? []).filter((g) => gearInfo(g)?.slot !== slot), ...id ? [id] : []] });
        add(left, tile("None", current === null, () => set(null)), ...GEAR.filter((g) => g.slot === slot).map((g) => tile(g.label, current === g.id, () => set(g.id))));
        if (slot === "hat" && hooded) left.append(Object.assign(document.createElement("p"), { className: "dz-note", textContent: "Hats need the hood off (Outfit tab)." }));
      }
      left.append(Object.assign(document.createElement("p"), { className: "dz-note", textContent: "Gear takes its colours from the outfit dyes (Colours tab)." }));
    } else {
      h(left, "Outfit dye");
      const dyeRow = (label, value, set) => {
        const l = document.createElement("label");
        l.textContent = label;
        left.append(l);
        swatches(left, DYE_COLORS, value ?? null, set, "Original");
      };
      dyeRow("Cloth", d.cloth, (c) => this.update({ cloth: c }));
      dyeRow("Leather & trim", d.trim, (c) => this.update({ trim: c }));
      const families = [...new Set(d.parts.map((p) => partInfo(p)?.outfit))].filter((f) => !!f && COLORWAYS.some((c) => c.family === f));
      h(left, "Colour palette");
      for (const f of families) {
        const ways = COLORWAYS.filter((c) => c.family === f && (c.body === null || c.body === d.body));
        const current = d.colorways.find((c) => ways.some((w) => w.id === c)) ?? "";
        const label = document.createElement("label");
        label.textContent = f === "athlete" ? "Sportswear" : f[0].toUpperCase() + f.slice(1);
        rowOf(left, label, select([["", "Original"], ...ways.map((w) => [w.id, w.label])], current, (v) => this.update({ colorways: [...d.colorways.filter((c) => !ways.some((w) => w.id === c)), ...v ? [v] : []] })));
      }
      h(left, "Skin");
      swatches(left, SKIN_TONES.filter((c) => c !== "#ffffff"), d.skin, (c) => this.update({ skin: c }), "Base");
      h(left, "Hair");
      swatches(left, HAIR_COLORS, d.hairColor, (c) => this.update({ hairColor: c }), "Natural");
    }
    h(left, "Preview");
    const pose = (label, on, st) => tile(label, on, () => (Object.assign(this.state, { speed: 0, celebrate: false, ...st }), this.render()));
    add(left, pose("Idle", this.state.speed === 0 && !this.state.celebrate, {}), pose("Run", this.state.speed > 0, { speed: 6 }), pose("Dance", this.state.celebrate, { celebrate: true }));
    const weapon = (label, id) => tile(label, this.weapon === id, () => (this.weapon = id, this.render(), this.rebuild()));
    add(left, weapon("Unarmed", null), weapon("Pistol", "core.pistol"), weapon("Rifle", "core.rifle"), weapon("Shotgun", "core.shotgun"));
    h(right, "Name");
    const name = document.createElement("input");
    name.value = d.name;
    name.maxLength = 24;
    name.addEventListener("change", () => this.draft = { ...this.draft, name: name.value.trim() || "My character" });
    right.append(name);
    h(right, "Start from");
    const grid = document.createElement("div");
    grid.className = "dz-looks";
    const saved = listCustomLooks();
    for (const l of [...CORE_LOOKS.filter((x) => !x.whole).map((x) => ({ id: x.id, name: x.name })), ...saved]) {
      const b = document.createElement("button");
      b.className = "dz-look";
      b.title = l.name;
      const img = document.createElement("img");
      img.alt = "";
      void this.portraits?.get(l.id).then((src) => img.src = src, () => void 0);
      b.append(img);
      b.addEventListener("click", () => this.load(l.id));
      grid.append(b);
    }
    right.append(grid);
    const problems = this.problems;
    if (problems.length) {
      const p = document.createElement("p");
      p.className = "dz-problems";
      p.textContent = `Can't wear this yet: ${problems.join("; ")}.`;
      right.append(p);
    }
    const actions = rowOf(right, button("Save and use", false, () => this.save()), button("Back", false, () => this.done(null)));
    actions.className = "dz-actions";
    actions.firstChild.classList.add("primary");
    actions.firstChild.disabled = problems.length > 0;
    if (saved.some((x) => x.id === this.lookId)) {
      actions.append(
        button("Delete saved", false, () => {
          deleteCustomLook(this.lookId);
          this.render();
        })
      );
    }
    const foot = document.createElement("footer");
    foot.className = "dz-foot hintbar";
    foot.innerHTML = '<span><kbd>Drag</kbd>Rotate</span><span><kbd>Wheel</kbd>Zoom</span><span class="dz-random"><kbd class="y">R</kbd>Randomize</span><span><kbd class="b">Esc</kbd>Back</span><span><kbd class="a">↵</kbd>Apply</span>';
    foot.querySelector(".dz-random").addEventListener("click", () => this.randomize());
    this.root.replaceChildren(top, left, right, foot);
  }
}
export {
  CharacterDesigner
};
