# Audio

**Status:** first audio pass (October 2026). Every shipped sound is either **CC0** (Kenney, and a few Freesound recordings by named authors) or **synthesised by our own code**. There are no generated (AI) sounds and no Artlist sounds; see [`ASSET_SOURCES.md`](ASSET_SOURCES.md) for why Artlist is excluded.

## Where sounds come from

| Group | Source | Sounds |
|---|---|---|
| Weapon fire | **In-house synthesiser** (`packages/client/src/audio/synth.ts`) | pistol, rifle, shotgun (with pump), sniper (with echo and bolt), grenade launcher "foomp", knife swing, dry-fire click |
| Explosions | Kenney Sci-Fi Sounds (CC0) | low-frequency boom plus a debris crunch layer |
| Impacts, bodies, footsteps, landing | Kenney Impact Sounds (CC0) | bullet hits on walls, deaths, concrete footsteps, the low thud under body hits |
| Hits on players (flesh) | Freesound CC0: magnuswaker, modusmogulus, Pablobd, gprosser | `impact.body`, `impact.heavy` (45+ damage), `blood.splat` on kills; see [`PHYSICS_FX.md`](PHYSICS_FX.md) |
| Reload, weapon raise, knife hits, ammo/weapon pickups | Kenney RPG Audio (CC0) | metal click/latch, belt handling, knife slices, coins |
| Hit marker | synthesised (`hitmark` recipe) | a short bright tick, four variants |
| Kill confirm, health pickup | Kenney Interface Sounds (CC0) | |
| Armor and powerup pickups | Kenney Impact / Sci-Fi Sounds (CC0) | |
| Announcer | Kenney Voiceover Pack: Fighter (CC0) | "Fight!", "You win", "You lose", "Tie", "Multi kill" |
| Scenario (M3) | Kenney Sci-Fi / Impact / Interface (CC0) + synthesiser | doors, button press and refusal, spike/crusher/laser traps, crate and wall breaks, chime/buzzer cues, objective and message chimes; synthesised flame roar, mine warning beep and alarm siren |

The synthesiser is ordinary signal processing written by us, in the same spirit as the procedural map materials. Each weapon is a recipe of layers (supersonic crack, filtered noise body, low "thump" sweep, room tail, mechanical clicks, echoes), rendered at load time with fixed seeds, so it always sounds the same. It is a stand-in for recorded gunshots: when we get CC0 recordings (Sonniss GDC bundles, Freesound CC0, our own foley), switch that sound's entry in `content/sounds.json` from `synth` to file variants. No code changes.

The cloud development environment could not reach Freesound, OpenGameArt, itch.io creator pages or Sonniss when this pass was made, which is why recorded gunshots aren't in yet.

## How it fits together

- **`content/sounds.json`** is the single list of game sounds. Each sound has variants (files or a synth recipe) and mix settings: `gain`, `range` (`near` / `mid` / `far`: how far it carries), `jitter` (random pitch spread so repeats don't sound identical) and `rate`.
- **`pnpm content:build`** copies the selected Ogg files from `assets-src/kenney-*` to `packages/client/public/sounds/<id>_<n>.ogg`, removes stale files and adds each file to `content/provenance.json`. **`pnpm content:check`** (CI) verifies they're current, under budget (128 KB each) and CC0/CC-BY.
- **`AudioSystem`** (`packages/client/src/audio/audio.ts`) is one Web Audio graph for the whole app: per-voice gain → distance low-pass → HRTF panner → master volume → limiter. It caps voices (6 per sound, 40 total) and culls sounds beyond their range. The browser only allows audio after a user gesture, so the first click or key press starts it.
- **`SessionAudio`** (`packages/client/src/game/sessionAudio.ts`) maps match events to sounds:
  - Your own shots, footsteps, landings, reloads, weapon switches and dry fire play instantly from client prediction and aren't positioned.
  - Other players' shots, impacts (at most two per shotgun blast), knife swings, deaths, pickups, footsteps and explosions are positioned in the world.
  - The hit marker and kill confirm play when the server confirms a hit or kill. Two kills within 4 s trigger "Multi kill". Round start and end have announcer lines.
- **Volume** is a slider in the pause menu, saved in the browser.

## Tests

- `packages/client/test/audio.test.ts`: every recipe renders finite, normalised, non-silent and deterministic samples that end in silence; the manifest only names known recipes and built files; every weapon has a fire sound and every item kind a pickup sound.
- e2e (`pnpm e2e`): all sounds load and decode in Chromium, and an offline bot match plays sounds.

## Known gaps

- **Gunshots are synthesised placeholders** until recorded CC0 gunshots are imported.
- **Ogg Vorbis** files may not decode on older Safari versions. Those sounds are skipped and the game keeps running. Add an AAC/MP3 copy in the build if Safari matters before then.
- No occlusion (sounds pass through walls), reverb zones, music, ambience or per-material footsteps yet. Remote reloads aren't audible because snapshots don't carry them.
