# Audio

**Status:** first audio pass (October 2026). Every shipped sound is either **CC0** (Kenney, and a few Freesound recordings by named authors) or **synthesised by our own code**. The one exception is **the owner's own music and announcer** (2026-11-18): tracks and lines the owner made themself through Artlist, which the owner cleared for the game (owner, 2026-11-17: shipped inside the game only, never as separate downloads; [`AUDIO_MUSIC_ANNOUNCER_PLAN.md`](AUDIO_MUSIC_ANNOUNCER_PLAN.md)). Artlist's stock catalog stays excluded; see [`ASSET_SOURCES.md`](ASSET_SOURCES.md).

## Where sounds come from

| Group | Source | Sounds |
|---|---|---|
| Weapon fire | **In-house synthesiser** (`packages/client/src/audio/synth.ts`) | pistol, rifle, shotgun (with pump), sniper (with echo and bolt), grenade launcher "foomp", knife swing, dry-fire click |
| Explosions | Kenney Sci-Fi Sounds (CC0) | low-frequency boom plus a debris crunch layer; a vehicle blowing up adds `explosion.vehicle` (the same booms pitched down) and a metal crash |
| Vehicle crashes | Kenney Impact Sounds (CC0) | `vehicle.crash`: heavy metal and plate impacts for rams and run-overs, louder the harder the hit |
| Weather | synthesised (`rain` and `wind` recipes) | `weather.rain` (a hiss of high noise with a patter of drop ticks) and `weather.wind` (low noise swelling in gusts, a faint whistle): 2.4 s copies faded at both ends, one every 1.2 s while it rains or blows, unpositioned, louder with the weather (`game/weatherAudio.ts`); under a roof the rain is quieter. Our own code (no recordings), so no licence to record |
| Vehicle engines | synthesised (`engine` recipe) | `vehicle.engine`: a low combustion rumble, a 1.2 s copy restarted every 0.6 s while anyone rides, pitched up with speed (lower for tanks, higher for hovercraft and flyers); your own ride's is unpositioned, others' come from the vehicle (the nearest two). A stand-in until audio pass 2's engine loops |
| Impacts, bodies, footsteps, landing | Kenney Impact Sounds (CC0) | bullet hits on walls, deaths, concrete footsteps, the low thud under body hits |
| Hits on players (flesh) | Freesound CC0: magnuswaker, modusmogulus, Pablobd, gprosser | `impact.body`, `impact.heavy` (45+ damage), `blood.splat` on kills; see [`PHYSICS_FX.md`](PHYSICS_FX.md) |
| Reload, weapon raise, knife hits, ammo/weapon pickups | Kenney RPG Audio (CC0) | metal click/latch, belt handling, knife slices, coins |
| Hit marker | synthesised (`hitmark` recipe) | a short bright tick, four variants |
| Kill confirm, health pickup | Kenney Interface Sounds (CC0) | |
| Armor and powerup pickups | Kenney Impact / Sci-Fi Sounds (CC0) | |
| Announcer | **The owner's own lines** (39; `content/owner-audio.json`, made by the owner, owned) and Kenney Voiceover Pack: Fighter (CC0) | the owner's lines on the conditions in [`AUDIO_MUSIC_ANNOUNCER_PLAN.md`](AUDIO_MUSIC_ANNOUNCER_PLAN.md); Kenney's "You win", "You lose" and "Tie" (no owner line for them), and "Fight!" / "Multi kill" while an owner line isn't loaded |
| Music | **The owner's own tracks** (`content/owner-audio.json`, owned) | five on the main menu, Match Setup and lobbies, five in MapMaker; none in a match |
| Scenario (M3) | Kenney Sci-Fi / Impact / Interface (CC0) + synthesiser | doors, button press and refusal, spike/crusher/laser traps, crate and wall breaks, chime/buzzer cues, objective and message chimes; synthesised flame roar, mine warning beep and alarm siren |
| Glass and water | Kenney Impact Sounds (CC0) + synthesiser | `break.glass` when a pane shatters; synthesised `glass.crack` (a bright tick and short ring) when bulletproof glass takes a hit, and `water.splash` (a falling "bloop" under filtered spray) when someone or something goes into water |

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
- **Volume** is a slider in the pause menu, saved in the browser. **Music** and **Announcer** have their own sliders under it in Options (the Announcer in the pause menu too), saved as `cs.music` (default 50 %) and `cs.announcer` (100 %); 0 is off.
- **The owner's music and announcer** (`content/owner-audio.json`): `node tools/content/owner-audio.mjs <folder with the owner's files>` trims their silence, evens loudness to -16 LUFS (two-pass EBU R128) and encodes Ogg Opus (music 64 kbps stereo to `public/music/`, lines 48 kbps mono to `public/voice/`), recording each in `content/owner-audio.lock.json`; `pnpm content:build` puts them in provenance (owned) and `pnpm content:check` holds the files to the lock and the budgets (2 MB a track, 14 MB of music, 64 KB a line). The owner's originals never go in the repo, and the files are never listed or offered for download on their own.
- **Music** (`audio/music.ts`): each scene's tracks shuffled (none again until all have played), 3 s crossfades, a 1.2 s fade out when a match starts; streamed through an `<audio>` element into the music's bus, so only the playing track is fetched, and only after the first click or key (the menu's first paint and a match's start never wait on it); a hidden tab pauses it where it is. Browser tests leave it off unless `?music=1` (`?music=0` turns it off anywhere).
- **Announcer** (`audio/announcer.ts`): one line at a time, at least 2.5 s from one start to the next, the most important first (match flow, objectives, multi-kills, streaks, special kills, hype); a newer line of the same kind replaces a waiting one, and a line that waited too long is dropped. Its lines load after the game's sounds.

## Tests

- `packages/client/test/audio.test.ts`: every recipe renders finite, normalised, non-silent and deterministic samples that end in silence; the manifest only names known recipes and built files; every weapon has a fire sound and every item kind a pickup sound.
- e2e (`pnpm e2e`): all sounds load and decode in Chromium, and an offline bot match plays sounds.

## Known gaps

- **Gunshots are synthesised placeholders** until recorded CC0 gunshots are imported.
- **Ogg Vorbis** files may not decode on older Safari versions. Those sounds are skipped and the game keeps running. Add an AAC/MP3 copy in the build if Safari matters before then.
- No occlusion (sounds pass through walls), reverb zones, ambience or per-material footsteps yet. Remote reloads aren't audible because snapshots don't carry them.
