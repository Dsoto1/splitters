# Ragdolls, debris, blood and hit sounds

All of this is **drawn only**. Each client runs its own small physics world
(`EffectsWorld`, `packages/shared/src/sim/effectsPhysics.ts`, Rapier, the same
engine as the game) holding the level's static shapes and the terrain. Nothing
in it feeds back into the match, so it can't cause desyncs or cheating, and
the server never runs it.

## Ragdolls

When a player or bot dies, their body goes limp, thrown by whatever killed them:

- **Shots** push the body along the shot (harder for big guns; shotgun pellets add up).
- **Melee** knocks it back and up a little.
- **Explosions** throw everyone nearby up and away from the blast, with its force (a big blast harder).
- Otherwise it keeps the speed it was running at.

Every death is physical, cheaply. A body gets one of three tiers
(`ragdollBudget.ts`):

| Tier | When | What |
|---|---|---|
| Full | within 10 m, or in view within 35 m | ten capsules (torso, head, upper and lower arms, thighs, shins) joined at the neck, shoulders, elbows, hips and knees |
| Cheap | in view, further away | three bodies (pelvis, chest, head); the arms and legs hang in the death's limp pose |
| Laid down | out of view | no simulation: the body lies on the ground under where it died, along the hit, in the death's final pose |

- **Budget**: at most 300 ragdoll bodies awake at once (a full ragdoll is 10, a
  cheap one 3). Past it, the farthest ragdoll still moving drops a tier (full
  to cheap with the same motion, cheap to frozen) before a new death is
  lowered; nothing falls back to the canned death animation.
- **Pool**: ragdoll bodies are parked in the effects world and reused (a
  dozen standard bodies are made with the map), so a blast that kills ten
  allocates nothing.
- **Settle and freeze**: after the first tumble (0.9 s) the bodies are damped
  harder; once they rest, or after 4 s (cheap: 2.5 s), the bodies go back to
  the pool and the pose stays as it is: the skeleton and its joints stop
  updating, so a body on the ground costs nothing per frame.
- **Joint limits** (`ragdollJoints.ts`): every joint is limited like a body's:
  knees and elbows are hinges that fold one way only (never past straight),
  hips swing forward far and back a little, shoulders cover the arm's
  reach, the neck nods and turns but never round, and nothing twists far.
  The joints' frames are made from where the joints are at the moment of
  death (body up, right, forward; each limb's direction; the elbow's and
  knee's own bend), never from the bones' axes, so the same limits hold for
  the modular rig and every whole-body Meshy rig, small or large, a rig that
  folds two joints into one place, or one that calls its left side right.
  Each range is widened to take the pose at death, so nothing snaps.
  Before 2026-11-02 the joints were free balls: bodies came to rest folded
  with knees and elbows bent backwards and limbs twisted round.
- Creatures (zombies' toads, aliens and the like) keep their own death and
  fall to the ground under gravity.

`view.ragdollStats()` reports bodies by tier, frozen ones and awake physics
bodies. The mass-casualty perf scenario (`PERF_SCENARIOS=mass node
tools/perf/perf96.mjs`, docs/PERF_96.md) kills 20 with one blast in a
24 v 24 and times the frames after it.
(`packages/client/src/game/ragdoll.ts`, `ragdollBudget.ts`)

## Debris

Chunks from broken crates, barrels, glass, walls and props are real little
boxes now: they bounce off the floor and each other, roll down slopes and come
to rest, then shrink away after 6 s. Glass panes (window glass and glass
blocks, see [`BUILDING_KIT.md`](BUILDING_KIT.md#glass-glass-panes)) shatter
into a shower of pale shards sized to the pane, with the CC0 glass-break sound;
bulletproof glass only cracks (a synthesised `glass.crack` tick). A vehicle blowing up throws two dozen
charred and glowing chunks harder and further, alongside its layered fireball,
shockwave ring, sparks and smoke (see [`VEHICLES.md`](VEHICLES.md)); blasts
and crashes near you shake the camera.

## Blood

Light by default: a quick spray of droplets and a puff of mist where a shot or
blade hits, small splats on the floor and on the wall behind the target, and a
small pool under a body. Splats fade after about 9 s (at most 50 at a time,
120 on heavy). (`packages/client/src/game/bloodVisuals.ts`)

**Per map** (MapMaker → Map properties → **Blood**):

| Setting | Values |
|---|---|
| Colour | any colour; quick picks: Red, Alien (green), Oil (black), Ichor (gold), Coolant (blue) |
| Amount | None, Light (default), Heavy |

Stored as `blood: { color, amount }` in the map (format v10; `null` means red
and light).

**Per player**: Pause menu → **Blood** switch, remembered in the browser.
Off hides all blood and the splat sound, whatever the map says.

## Hit sounds

Every hit on a player or bot plays a fleshy impact at the victim:

- `impact.body`: three CC0 recordings (Pound of Flesh, Meat Slap by magnuswaker; Meaty Damage Impact by modusmogulus), layered with
- `impact.thud`: a low Kenney punch for weight;
- `impact.heavy` for big hits (45+ damage per shot: shotgun blasts, rifles, rockets): Gore Impact (magnuswaker) and Headshot (Pablobd);
- `blood.splat` on a kill (gprosser), unless blood is off;
- `ui.hit`: your own hit-confirm tick, synthesised in code (four variants).

One body hit per victim per shot, so a shotgun blast is one meaty thump, not
eight. All recordings are CC0; credits are in each `assets-src/freesound-*/License.txt`.

## Props on slopes

Props no longer float on hillsides:

- **Placing** a prop on the terrain beds it in: its base goes to the lowest
  ground under its footprint (trees use their trunk, not their crown), so no
  corner hangs in the air.
- **Dragging** a prop that sits on the ground keeps it on the ground, up or down hill.
- The **Scatter** brush beds every plant and rock the same way.
- **Rocks, logs, stumps and plants lean** with the slope (up to 25°). Trees,
  buildings, crates and furniture stay upright.
- **Settle on ground** (inspector, with props selected) and **Settle all props
  on ground** (Map properties) fix older maps in one undo step. Props standing
  on floors, blocks or other props stay put.
- The validator warns about props floating more than 20 cm over the terrain
  (`prop.floating`), and map scripts settle props when they save.

(`packages/shared/src/map/settle.ts`)

## Pack effects (Binbun VFX)

Also drawn only. The owner's Binbun packs are Godot 4 projects; `tools/content/prepare-vfx.mjs` writes each pack
named in `content/vfx.json` (`packs.<id>.dir`, `.file`) as JSON (only the effects `map` names; pictures they sample
as small WebPs), and `game/godotVfx.ts` plays them: a small GPUParticles3D simulator plus each pack shader rewritten
in GLSL (`PORTS`, keyed `<PackDir>/<shader>` where two packs' shaders share a name). Rebuild one pack with
`ONLY=<file> node tools/content/prepare-vfx.mjs --downloads /home/user/fx-packs/links-full` (the links point at
the extracted zips in `/home/user/fx-packs/`: `links-full/<pack id>` → the folder its zip was extracted into, so
`<pack id>/assets/BinbunVFX…` is there (a zip with a top folder of its own, `PortalVFXFull.zip` and
`MagicAreaVFX.zip` and `StatusFXFull.zip`, is linked to that folder); the zips come from the owner's Drive folder `fx` and are fetched again on a
new machine, never committed); `node tools/content/vfx-map.mjs` after editing the map.

- **One-shots** (`GodotVfx.play`): impacts, explosions, lightning bolts (`map.arcs`: each jump a pack zap whose
  tube is stretched to the jump and played 2.5-4x faster to fit 0.1-0.15 s between arcs), moments of play.
- **Lasting effects** (`map.lasting`, `game/lastingFx.ts`): owners ask every frame for an effect at a spot under
  an id (a fire on a burning patch, a vehicle, a flare, a flame trap; the Arc Turret's charge ball; a toxic cloud;
  wreck smoke). The nearest within 70 m are drawn, as many as the graphics quality allows (low 4, medium 10,
  high 16; low also thins their particles), started once and moved; the rest keep their plain look (`drawn(id)`).
  Places go by tier, nearest first within each: the effects of the moment, then the map's `fixture`s (portals,
  jump pads), then `decor` (pickup glows, prop flames). A request may carry its own `range`, `yaw`, `tint`
  (changing it starts the effect again) and `stretch` (`LastingPlace`).
- **Fire props** (`game/propFlames.ts`): braziers, fire bowls, torches, campfires and a few candles carry a
  `flame` in content/props/<pack>.json (`fx` brazier / torch / candle / campfire → map.lasting `flame.<fx>`,
  `at` the flame's foot in the prop's space as drawn, x mirrored; `size` its height in metres; `hide` the model's
  own flame materials). They are `decor`: placed after every gameplay effect, not drawn on low graphics, and the
  model's flame shows wherever the pack flame isn't drawn. Torches use the cheaper candle effect (24 particles).
- **Pickup glows** (`game/lootGlow.ts`, map.lasting `loot.<kind>`; Binbun's Loot VFX, the ground glows): a ring,
  a flare of soft streaks and a low glowing dome on the floor under a weapon (the pack's gold), health (green),
  armor (the pack's teal one tinted the game's armor blue) or ammo (pale) pickup that is there to take, with a few
  sparkles drifting up. The pack's pillars of light, second rings and flares are left out (`skip` in the map: the
  pillars stood through the pickup itself). `decor`: placed after every gameplay effect, the nearest pickups within
  28 m, at most half the lasting places (low 2, medium 5, high 8); the pickup's own model, ring and bob never
  change, so one without a glow looks as it always did. It eases in over about a second (a pickup coming back
  doesn't pop). **Reduce flashing on:** held still (`steady`: the shaders' clock at zero, so no scrolling streaks
  and no bob, and no sparkles), at 0.5 of its strength instead of 0.8, eased in over two seconds. The pack counts
  on Godot's glow pass; without one its flare (20 % opaque at most) and thin rings could not be seen, so they are
  lifted three times and the flare adds its light (`LOOT_LIFT`). It is light added to the scene: clear on dark and
  mid floors, fainter on a sunlit pale one (the Range's). Cost: four draws a glow (three held still), so at most
  8 / 20 / 32 draws on low / medium / high; not measured with `pnpm perf:budget`. The e2e flow `flashing` records
  six of them coming up at night (moment `loot`).
- **Portals and jump pads** (`game/fixtureFx.ts`, map.lasting `portal` and `pad`; asked for by
  `scenarioVisuals.ts`). A portal that is switched on wears the gate of Binbun's **Portal VFX**
  (`gate_portal_vfx_01`: sheets of cloud turning slowly and drawn back into the frame, with a glow licking round
  its edge), tinted the pair's colour (blue unless the map gives one), sized to the frame (the map's scale is per
  metre of width; the swirl and glow quads are stretched to the frame's height) and set 4 cm proud of the frame's
  face. It comes up over the painted swirl in about 0.8 s and the painted one fades as it does (`portalCover`); a
  portal with no place, or switched off, shows the painted swirl as before; the stone frame and the rim in the
  pair's colour never change. A jump pad wears the blue lift area of Binbun's **Magic Area VFX**
  (`lift_area_vfx_02`: a column of pale blue streaks rising 2.3 m off the plate, a faint ring round it), at 0.75 of
  the pack's size so it stands on the 2.2 m plate; it is light added over the pad, so the plate, the glowing ring
  and the chevrons that show which way it throws you stay as they are and show through it. **Places:** both are
  `fixture`s, a tier of their own in `lastingFx.ts`: after the effects of the moment (fire, gas, a charge ball, a
  shield: tier 0) and before every `decor` one (pickup glows, prop flames), nearest first within a tier. So when
  places run out, pickup glows and prop flames go first, then the far pads and portals; pickup glows still take
  at most half the places of what is left to them. Portals ask within 60 m, pads within 36 m (a map with many pads
  does not hold places for ones across the map). **Reduce flashing on:** both are held still (`steady`: the swirl
  does not turn, the streaks do not rise), dimmer (portal 0.7 of its strength, pad 0.6) and eased in over about two
  seconds; off, the motion is a slow turn and a slow rise, nothing blinks or pulses. The swirl is drawn unlit and in its own colours (the
  pack's portal is its own light; the effects' usual roll-off is undone for it, which had turned an orange pair
  mustard), so the pair's colour is the colour seen, as bright at night as by day; it fills the frame (a 2.4 x 3.2 m panel),
  which up close is much of the screen, hence the slow rise. **What is not ported from the Portal pack:** its
  particles (they start from 512 points written into each scene as a float picture and are drawn with a plain
  StandardMaterial3D; `prepare-vfx.mjs` leaves such pictures out of the JSON, 150 KB an effect), its Warp mode
  (it bends a copy of the screen) and its stencil window; the swirl is drawn in the pack's Opaque mode (the
  effect's second colour between the sheets), where the pack's scenes use the stencil one. New in the player for
  these: the `portal` and `portal_glow` shaders (parallax through `layers` sheets; a varying of their own for the
  view in the quad's frame), square gradient fills (a gate's shape), ping-pong noise (folded into bands for the ports that ask, `pingPong`;
  the toxic cloud's one ping-pong mask stays the plain noise it was fitted to), and
  `magic_areas/transparent`: the Vol. 1 family's shader drawn additive, unlit and lifted three times, since the
  Magic Area pack too leans on Godot's glow pass (its masks multiply down to a few per cent of alpha; unlifted the
  column could not be seen even at night). Cost: a portal two draws (the swirl's fragment shader reads 24 texels a
  pixel), a pad four; not measured with `pnpm perf:budget`. The e2e flow `flashing` records a portal and a pad
  coming up at night (moment `fixtures`).
- **Status auras** (`game/statusFx.ts`, map.lasting `status.<kind>`; Binbun's **Stylized Status FX**, asked for by
  `view.ts` for every other character in view with a status). Burning: `vfx_status_flame` (a tall shell of orange
  and yellow streaks twisting up round the body, flecks drifting up). Poisoned: `vfx_status_poison` (a soft green
  haze and green bubbles). Slowed by goo: `vfx_status_rot` tinted the goo's pink `#ff5ac8` (a pink haze, small
  bubbles). Chilled or frozen: `vfx_status_ice` (pale ice crystals growing and melting round the body, a faint cold
  haze); a frozen character keeps its block of ice under them, since the block is what says "can't move". One aura
  a character, the strongest status (frozen, burn, poison, slow, chill: the plain shell's order). Placed at the
  middle of the body at 0.9 of the pack's size (its figure is 2 m) times the character's own. **Drawing only**: what
  a status does and how long it lasts is the simulation's. **Places:** effects of the moment (tier 0, with fire and
  gas: someone near you on fire is news, and a status lasts two to four seconds), but only the nearest 3 characters
  within 40 m ask (`STATUS_FX_MAX`, `STATUS_FX_RANGE`), so a burning crowd cannot take every place and Low graphics
  (4 places) always keeps one for a fire. A character with no place keeps the plain look (the see-through shell in
  the status' colour, `arsenalVisuals.ts setAura`), and the shell is hidden while the aura is worn
  (`plainStatus`). The auras are see-through and sit round the body: the character's own colours, its ally outline
  and its outline against the scene stay readable (checked on dark characters at night, the worst case for the
  poison haze). **Your own character** never wears one: from its eyes an aura is a sheet over the view; the
  screen's tint in the status' colour (`hud.setStatusTint`) is unchanged. A cloaked character is not asked for
  either (its shell fades with it). **Reduce flashing on:** each aura runs at half the pack's speed (`slow`: the
  shaders' clock and the particles; flames and bubbles drift), at 0.65 of its strength instead of 0.8, eased in
  over about 0.8 s instead of a quarter second; the plain shell, which pulsed about twice a second, holds still.
  Off, nothing blinks either: the motion is noise scrolling and particles fading in and out over two seconds. The
  aura starts with its particles already out (`prefill`), so it is whole for a three second status; its level
  fades it in. New in the player for these: the pack's five shaders used here (`StatusFX/aura_particle`,
  `aura_sphere`, `noise_particle`, `bubble_particle`, `ice_particle`), `VfxOptions.slow` and `prefill`
  (`LastingPlace.slow`, `.prefill`; a slowed play is gone as soon as it has faded out, so its long-lived particles
  do not hold a place unseen), and orbit speeds given as a `CurveXYZTexture` (about Y, each particle its own
  between `orbit_velocity_min` and `_max`). **Not ported:** the pack's 17 overlay materials (`status_overlay`: a
  second pass over the character's own meshes that recolours its rim; it would cover team and skin colours and
  needs a next-pass on every character material), its proximity fade (reads the depth buffer), the flecks'
  `directional_velocity_curve` (they rise straight instead of weaving), and the 14 other auras (heal, sleep,
  nature, dark, shard, green, water, divine, glow, purple, shatter, gem, magic, void: the game has no state for
  them; `streaks`, `heal_particle`, `sleep_particle` and `texture_particle` have no port). Spawn protection and
  the powerups keep their Electric and Flame FX looks. Cost: two draws an aura (three for the flame), 64 particles;
  at most 3 at once; not measured with `pnpm perf:budget`. The e2e flow `flashing` records three bots' auras
  (burning, poisoned, slowed) coming up at night (moment `status`).
- Map entries may `skip` parts of an effect (node names) and lasting effects may be held `steady`
  (`VfxOptions.steady`, `LastingPlace.steady`; changing it starts the effect again).
- Every effect piece has its own geometry: thin-instance buffers live on the geometry, so pieces sharing one
  drew with another's buffers and nothing once it was gone (the mesh-part bug that hid fires' `Core`, and the
  loot glows' rings, flare and dome in the 3 Nov pass: an effect's MeshInstance parts all shared the base mesh's
  geometry, so of several plays of one effect, or one started after the same effect was warmed, only the last
  piece to set its buffers drew, and none once that piece was gone. Checked again on 12 Nov with three of each
  side by side: fires' `Core`, the toxic cloud's `Glow` and the loot glows' parts all draw; with shared geometry
  put back for the test, a twentieth of the loot parts' pixels and a seventh of the fire cores' were left).
- A lasting effect asked for after the frame's `update` (pickups) is kept until the next one, however long the
  frame took: at under three frames a second it was dropped and started again every frame (`lastingFx.ts` KEEP_MS).
- One-shots are capped too (low 6 / medium 12 / high 16 at once, minor ones 3 / 7 / 10), and every mapped effect
  is built while the map loads (`warm`), so the first one mid-fight costs no build.
- `pnpm perf:budget` times starting each kind (`arc`, `arc sentry`, `lasting <key>`) against the 40 ms budget.
