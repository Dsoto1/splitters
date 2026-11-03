# Content scalability plan (owner-approved picks, 2026-11-03)

Analysis from the claude/launcher-ui-map-cards session, asked for by the Project Control Center (Workbench).
The owner said "i like your picks": every ★ below is decided. Notes are not orders: each step is still
scoped, done on its own `wip/` branch, green on a `check/` branch, then fast-forwarded to `main`.

## Order of work

1. **Menu's first download** (do before the remaining style packs).
   - **Problem:** it is at about 798 of 800 KB gzip (`node tools/ci/bundle-budget.mjs packages/client/dist`).
     Pack tile geometry (`packTiles*.ts`), the full prop table (`props.generated.ts`, about 240 KB of source)
     and `STYLE_PACKS` reach it through `map/catalog.ts`, but the menu draws none of them.
   - **Fix:** load those content tables when a match or MapMaker opens, like maps already are
     (docs/LOADING.md; `virtual:map-index`). Also add top-level-side-effect hygiene: `/* @__PURE__ */`, and
     lazy maps as in `serverRules.ts`.
   - **Goal:** room for every future pack and prop.
2. **Generated files per pack, and one rebuild command** (do before the remaining style packs).
   - **Problem:** parallel branches and accounts collide in `content/props.json`, `props.generated.ts`,
     `thumbs/palette.json` and its atlases, `provenance.json` and the lock files. Whoever merges second
     rebuilds them by hand.
   - **Fix:**
     - split props into `content/props/<pack>.json`, as characters already are;
     - give each style pack its own palette atlas file;
     - add `pnpm content:rebuild`, which runs build → preview → atlas → `content:build` → `content:check`
       after a merge.
3. **Weapons, throwables, classes and abilities as data:** see "Weapons as data" below.
4. **Vehicles, turrets and NPC roles as data:**
   - vehicles and turrets (`sim/mounts.ts`): speed, health, seats, weapons;
   - NPC roles (`sim/npc.ts`): health, speed, damage, size.

   Same pattern as weapons: JSON → generator → `.generated.ts`, behaviour stays in code.
5. **Pickups as data** (`sim/items.ts`): heal, armor and ammo amounts, respawn.
6. **Library materials as data** (`map/materials.ts`): colour, pattern id and settings; the pattern painters
   stay in code (`client/materials/patterns.ts`).
7. **Tiles as data, as the base of the planned MapMaker overhaul** (HANDOFF "After the style packs").
   - **Today:** each pack is 400–900 lines of procedural TypeScript (`packTiles*.ts`).
   - **Target:** a tile is a list of parts from a shared kit (box, wall with opening, gable roof, stair, arch,
     column, pier on piles…) with sizes and materials, in `content/tiles/<pack>.json`. The pack entries
     (`STYLE_PACKS`) become JSON too.
   - **What it buys:** fixes such as upside-down roofs and floating trims happen once, in the shared parts.
     MapMaker can later let the owner make tiles. It fits "maps are declarative data".
   - **Before starting:** scope it with the owner.

Not worth moving: behaviour code (mine arming, abilities' mechanics, VFX), sounds and skies (already data), and
maps (already data).

## Weapons as data

**Problems today:**
- Families (`FAMILY_DEFAULTS` in `sim/gunplay.ts`, merged with per-weapon overrides in `gunplayOf`) are the
  right idea.
- Defaults are spread over three places:
  - the `weapon()` default block and the `sidearm()`/`longarm()` helpers in `sim/weapons.ts`;
  - the families in `gunplay.ts`;
  - stopping power by category in `sim/impact.ts`.
- Tuning is written as positional number lists (`acc(...)`, `kick(...)`).
- The exotic arsenal uses a legacy `recoil` + `spread` path.
- Design intent lives in comments.
- **Network codes come from object order** (`weaponCode`: "added last so every older weapon keeps its code").
  Class codes come from `CLASS_IDS` order (`classSay`).
- Ability numbers are constants inside `ClassPlay` (`CLOAK_SECONDS`, `OVERCHARGE_*`,
  `SENTRY_REBUILD_SECONDS`, `DISPENSER`).

**Decided (★):**
1. Families plus per-weapon overrides.
2. One file per weapon.
3. Ticks stored, the Workbench shows seconds and RPM.
4. Convert the legacy recoil to family-style kick, proven identical.
5. Holds are edited only in the grip tool.
6. Abilities: numbers in data, behaviour in code.
7. Start after the Snow pack and the Market Town/dropship branches are on main.

**Data:**
- `content/weapons/families.json`: global defaults (today's `weapon()` block) and the 10 families, with
  named fields.
- `content/weapons/<id>.json`: name, category, slot, family, model, only the values that differ, an explicit
  network `code`, and `notes` for design intent.
- `content/throwables.json`.
- `content/classes.json`: explicit codes.
- `content/abilities.json`: numbers per ability kind.

**Generator:** `tools/content/weapons.mjs`.
- It checks the schema.
- It cross-checks references:
  - ammo types, models and sounds exist;
  - slots are 0–9;
  - codes are unique and never reused;
  - classes name real weapons.
- It writes `weapons.generated.ts`. The runtime keeps `gunplayOf`.
- Behaviours (projectile kinds, alt fire, status, the ability handlers) stay in code. The data names a
  behaviour and gives its numbers.

**Proof of no change:**
- First commit a fixture of every weapon fully resolved: the definition, `gunplayOf`, and the code.
- Add the same for throwables and classes.
- A test then deep-equals the data-built tables against the fixture.
- Run the `arsenal` e2e as usual.

**Workbench fields** (`.control-center/workbench.json`; format in Dsoto1/dashboard docs/WORKBENCH.md):
- **Weapons:**
  - name, category, slot, family, model;
  - damage, pellets, range, falloff, head and leg multipliers;
  - fire rate shown as RPM, reload and raise shown in seconds;
  - magazine, reserve, pickup;
  - base and ADS accuracy, kick strength;
  - projectile speed, splash and fuse;
  - heat;
  - bot desirability and range.

  Each field shows "from family" or overridden, with a reset. Not editable: id, code, kind, holds.
- **Classes:** name, role, blurb, health, speed, weapons, ability and its numbers.
- **Throwables:** name, max, interval, splash, fuse.

**Steps:**
1. Fixture test.
2. One-off extraction to JSON plus the generator, proven identical.
3. Throwables, classes and abilities.
4. Fold the legacy recoil into kicks, proven identical.
5. Workbench collections and a "how to add a weapon" section in docs/CONTENT_PIPELINE.md.

**Risks:**
- network codes;
- the menu bundle (step 1 of the plan first);
- lost comments (hence `notes`).
