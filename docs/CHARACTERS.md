# Characters

Players, Player Bots and NPCs are animated characters built from CC0 parts by
Quaternius, plus whole-body Meshy characters (see "Adding a Meshy character") (see [`ASSET_SOURCES.md`](ASSET_SOURCES.md)). Nothing is generated:
every mesh, texture and animation comes from a human-made pack, and players
express themselves by combining parts and colourways.

## The rig standard

- One 65-joint humanoid skeleton (Unreal-style names: `root`, `pelvis`,
  `spine_01..03`, `neck_01`, `Head`, `clavicle/upperarm/lowerarm/hand_l|r`,
  fingers, `thigh/calf/foot/ball_l|r`). The joint list is recorded in
  `content/characters.lock.json` (`rigJoints`).
- Two body types, `male` and `female`. Every part is rebound to its body's
  "Regular" bind pose, so any head, hair and outfit for that body share one
  skeleton.
- Models stand on their origin facing +Z, in metres.

## Parts (`packages/client/public/characters`)

Everything in the free editions of the four packs is used: both base bodies,
every outfit part, every hairstyle, every colourway and both mannequins.

| Files | Slot | Notes |
|---|---|---|
| `rig.glb` | — | Male mannequin and skeleton with 20 clips from Universal Animation Library 1 + 2. Also the male NPC body, tinted to the faction colour |
| `mannequin_f.glb` | — | Female mannequin (Animation Library 2), rebound to the rig; about half of each NPC squad uses it |
| `head_male`, `head_female` | head | Cut from the base bodies (including eyes and eyebrows) |
| `athlete_torso/legs/feet_m/f` | torso, legs, feet | The base bodies below the neck (sportswear), cut along the same regions so they mix with outfit parts. The torso includes the arms and hips |
| `ranger_arms/torso/legs/feet/hood/pauldron_m/f` | arms … pauldron | Ranger outfit parts |
| `peasant_arms/torso/legs/feet_m/f` | arms … feet | Peasant outfit parts |
| `hair_simpleparted`, `hair_buzzed`, `hair_beard` | hair | Male; a look can wear hair and a beard. The beard's file is no longer loaded: `gear.ts` (`BEARD`) builds a full beard on the face instead |
| `hair_long`, `hair_buns`, `hair_buzzedfemale` | hair | Female |
| `textures/*.jpg` | — | Shared base colour maps: `ranger`, `peasant`, `skin_m/f`, `athlete_m/f`, `hair_1/2`, and the colourways `ranger_moss`, `peasant_dusk`, `athlete_light_m/f` |

Gear (`GEAR` in `looks.ts`, built by `packages/client/src/content/gear.ts`) is fitted to the wearer: the head and
hair are measured in the bind pose into a map of how far the surface is from the skull's middle in every direction
(`headFit.ts`, `HeadMap`); caps, berets, beanies, the wide-brim hat, headband, mask and goggle strap are surfaces laid
over that map (with thickness), shades sit on the nose bridge and reach back to the ears, and hair a hat covers is cut
away. Helmets are textured models (`public/gear/`, `tools/content/prepare-gear.mjs`, `content/gear.json`) seated by
`fitModel`: the smallest size and lowest seat that keep the skull clear of the shell's inside, its rim over the eyes
at the brows (a deep shell is made a little shallower). Head gear and helmets hang on the Head joint, so full-body
first person's head cut hides them. Check a change by eye: `?mode=grips`, `__grips.pose(look, weapon, 'third')`
then `__grips.head(alpha, radius, beta?)`.

Parts carry no textures of their own: the game assigns the shared maps by
material name (`textureFor` in `looks.ts`), so a texture downloads once however
many parts use it.

Clips: `idle`, `aim_idle`, `walk`, `run`, `sprint`, `jump_start`, `jump_air`,
`jump_land`, `death`, `hit`, `shoot`, `reload`, `melee`, `melee_heavy`,
`interact`, `dance`, `knockback`, `throw`, `cheer`, `idle_arms`, `jab`,
`hit_head`. `jab` (Punch_Jab) and `hit_head` (Hit_Head) come from Universal
Animation Library 1 Standard (CC0), added with `node
tools/content/add-rig-clips.mjs <UAL2_Standard.glb> <UAL1_Standard.glb>`; the
cross is `melee` (Punch_Cross). Neither library's free edition has a kick, so
the unarmed kick is procedural (`characterAnimator`: the right thigh swings
up, the body leans back).

## Looks

A look (`packages/shared/src/content/looks.ts`) is made of:
- a body type and a head;
- outfit parts (at most one per slot; the first carries the skeleton);
- hair (any number);
- colourways;
- a skin tint and a hair tint, multiplied over the textures.

The part-built presets (the originals) wear these outfits; the Designer
offers every part, hairstyle and colourway, and a unit test keeps it that way:

| Preset | Made of |
|---|---|
| Ranger, Huntress | Full ranger outfit |
| Warden, Scout | Ranger in moss |
| Farmhand, Sprout, Medic | Peasant |
| Tracker, Pathfinder | Ranger top with peasant trousers |
| Drifter, Wayfarer | Peasant with a ranger hood |
| Brawler | Shirtless with peasant trousers and shoes |
| Bulwark, Commando, Frost, Operative, Sentinel | Ranger, dyed |
| Engineer | Peasant, dyed |

Retired presets (Champion, Desperado, Miller, Raider, Sprinter, Striker) resolve
to a kept look (`RETIRED_LOOKS` in looks.ts), so saved choices still load.

Players pick one on the main menu (remembered locally). It's sent in `hello`
and carried in the roster, so every client sees it. Bots get a spread of looks;
unknown IDs fall back to the default.

### Character Select's groups

Character Select sorts characters by what they are, not by how the look was
built. The groups are `CHARACTER_GROUPS` in looks.ts (section order and labels);
every built-in look names exactly one, and a unit test
(`packages/shared/test/lookGroups.test.ts`) keeps it that way:

The owner's Roster Board (2026-11-14, categories decided 2026-11-15) set nine. Knights &
Legends became Legends (`legends`), Creatures & Machines split into Creatures and Machines (`machines`),
Animals renamed Animalia (`animals`, the board's Animalia merged in), Undead & Horror renamed Horrors (`horror`, the
board's Supernatural merged in), the board's Future merged into Outer Space; its "other" was empty and dropped.
The owner's pass of 2026-11-17 made it seven: Creatures merged into **Horrors & Creatures** (`horror`) and Agents &
Spies into **Soldiers & Spies** (`soldiers`); Steel Guardian moved to Machines, Shadow Enforcer to Outer Space, Teddy,
The Hollow Pilgrim and Scary Larry to Horrors & Creatures. The retired ids still read (`CHARACTER_GROUP_ALIASES`;
in a bot-characters setting `CAST_ID_ALIASES`: `agents` is Agency, the same characters as before, `creatures` is
`horror`), so saved setups, maps and host.json files that name them keep working.
Retired looks (Capt. Nova, Bamboo, Uncle Bao, the Rusty Mech, the Gas Mask Engineer, Tinker Goblina, the Sunset Gunslinger and the earlier ones in `RETIRED_LOOKS`) sort as the
look they play.

**Collections: the Chrono Crew (owner, 2026-11-22).** A collection (`CHARACTER_COLLECTIONS` in looks.ts; `collection`
in a manifest, the checker's `COLLECTIONS` the same list) is a set of characters with a Character Select section of its
own, placed after the group it names (`after`). It is only Character Select's: its characters keep their `group` for
everything else (bot types, rank marks, Roulette, NPC casts), and the section lists them whatever their tier (an
experimental one is still never a bot's, a random or a Roulette pick). One today: **Chrono Crew** (`chrono`, after
Outer Space), the time crew of the owner's 2026-11-21/22 Drive batch, each with their own name (the lead's list,
owner 2026-11-22): Vesper Quill (the Alchemist), Nova Kade (Cyborg), Fuse Hollister (Demolitions), Dex Calloway
(Gunslinger), Gears Okafor (Mechanic), Doc Seraphine Vale (Medic), Flicker (Phase-Shifter), Wren Halloway (Recon),
Sarge Tobias Crane (Veteran), Mags Petrov (Quartermaster) and Lyra Vantis (Chrono Mage). Their group is Outer Space;
the Time Traveler was not in the crew then. **2026-11-25 (owner):** Clio Everwhen (the Time Traveler) joins, and she and Sarge Tobias Crane are the team's #1 and #2, the first two tiles of the section (`sortAs` `01 …`, `02 …`); Fuse Hollister leaves for Machines; two new members, Blix Orrin (the alien recruit) and Juno Hartwell (the pilot): 13 in all. `characterSectionOf(look)` gives a look's section.

**Army and Agency.** Every character in Soldiers & Spies carries a sub-designator, `branch` (`CHARACTER_BRANCHES`):
**Army** (the uniformed soldiers; the old Soldiers) or **Agency** (agents and spies; the old Agents & Spies: Customs
Agent Zhao, Kenji, Stealth Operative and the Dummy). A map's Bot characters (MapMaker's Map properties), Match
Setup, the pause menu and the server's `cast` rule offer them as two bot types, Soldiers and Spies (`army`,
`agency`; both ticked is `soldiers`), so a map that recreates a real battle (Shingle Point) can field Army only. `lookBranch(id)` reads it; the
manifest checker wants one on every `soldiers` character and none elsewhere. Character Select shows it as a tag.
Santa was Agency (owner, 2026-11-17) until the owner moved him to Legends (2026-11-22); the Operatives (the retired Operative preset and Crimson Operative, held back)
are Agency too. Shingle Point's Bot characters are Soldiers only (set in MapMaker).

**Bot types (owner, 2026-11-19).** Match Setup's Bots & AI tab, the pause menu's Host tab and MapMaker's map
settings pick random bots' characters with one tick-box per bot type (`BOT_TYPES`: Soldiers, Spies, Everyday Folk,
Outer Space, Legends, Animalia, Machines, Horrors; every one ticked: all; All and None to start over). The old
"Named as" sets fold into a type (`THEME_BOT_TYPES`: pirate, knight, ninja, wizard, barbarian, myth → Legends; the
animals → Animalia; undead, spooky, goblin → Horrors; robot → Machines; alien → Outer Space; cowboy, gangster,
townsfolk → Everyday Folk; soldier → Soldiers), so saved setups, links, server rules and maps that named one load
as that type (`validBotCast`, `normalizeSetup`). Under the types, plain switches: **Ranks & badges** (the Options
setting, `game/ranksSetting.ts`) and **Themed names** (`MatchSetup.themedNames`, `MatchRules.themedNames`; off:
random bots take the general names, `BOT_NAMES`).

**Ranks & badges (owner, 2026-11-18; Options → Ranks & badges and the pause menu, off by default).** Off, names are
plain and the marker over a head is the arrow (the ally diamond, the enemy's downward triangle), as before 11-18: an
Army bot's "Sgt. Dunmore" shows as "Dunmore" (its name keeps the rank; a character's own, "Flt. Lt. Ember", stays). On,
every player and bot wears a rank on nine steps: its title before the name and its badge, in the kill feed, on the Tab
and pause boards and as the marker over the head on both sides (in the marker's colour: your ally colour, red over
enemies where enemy markers are shown; hidden as the arrow is, under smoke or a cloak; far off it grows, up to 2.5 times).

| Group (rank group) | Badge | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| Soldiers & Spies: Army (`army`) | chevrons, bars, stars | Pvt. | Pfc. | Cpl. | Sgt. | SSgt. | Lt. | Capt. | Maj. | Col. |
| Soldiers & Spies: Agency (`agency`) | Agency ring | Asset | Courier | Contact | Handler | Operative | Agent | Senior Agent | Station Chief | Spymaster |
| Horrors & Creatures (`horror`) | skull | Ghoul | Shade | Wraith | Ghast | Fiend | Revenant | Horror | Dread Lord | Overlord |
| Outer Space (`space`) | star | Cadet | Ensign | Pilot | Navigator | Flight Officer | Commander | Captain | Commodore | Admiral |
| Machines (`machines`) | gear | Unit | Drone | Servo | Automaton | Android | Titan | Overseer | Mainframe | Prime, Fuse Hollister (from the Chrono Crew, 2026-11-25) |
| Legends (`legends`) | crown | Squire | Knight | Champion | Baron | Earl | Duke | Prince | King | Emperor |
| Animalia (`animals`) | paw | Pup | Cub | Scout | Tracker | Hunter | Stalker | Prowler | Alpha | Apex, and from 2026-11-25 Fenn Dustwhirl, Kiko Banyan, Deuce Droopwell, Ottis Crema, Boogie Tuskworth, Det. Drake Montego, Napsworth (Pip Quickfoot's new model too) |
| Everyday Folk (`folk`; also a design of yours) | plain chevron | Rookie | Regular | Local | Pro | Ace | Star | Hero | Superstar | Icon |

The first and last titles are the owner's ("as written is fine"); the steps between are the lead's. **Badges**
(`content/insignia.ts`, `INSIGNIA_SHAPES` and `INSIGNIA_CUTS`; a few flat polygons in a -1..1 box, so they read at
kill-feed size and far off): the Army's are its military ranks (Pvt. one chevron, Pfc. one and a rocker, Cpl. two,
Sgt. three, SSgt. three and a rocker, Lt. one bar, Capt. two bars, Maj. one star, Col. two stars). Every other group
wears its own mark, the step told the same way for all: steps 1-3 the bare mark, 4-6 the mark inside a ring, 7-9 inside
a double ring, with no, one or two bars under it. A skull's eyes, nose and teeth and a gear's hole are cuts drawn in the
dark outline colour. The badge shows in the name's colour with a dark outline (inline SVG, `game/insigniaSvg.ts`) and
over the head as a flat mesh with a dark rim (`game/insigniaMesh.ts`; crowds batch markers by colour and badge).

**Progression** (`content/ranks.ts`, `game/rankBook.ts`): rank points, a kill 10 and an objective play 30 (Fireteams'
own points where higher); steps start at 0, 100, 250, 500, 900, 1,500, 2,400, 3,600 and 5,000 points. Everyone starts on
step 1; a squad leader wears at least step 3 and a team leader step 4 while they lead. Ranks rise quietly over a
session and carry from match to match: bots by name for the session (an Army bot's own rank left off its name; kept in
the page until it closes), players with their career (`points` in `net/career.ts`, summed from each match's summary;
a career from before them counts its kills at 10 each). A player's browser sends its career rank points as it joins
(`rx` in the hello; the roster passes it on), so everyone sees the same rank for them. Every browser works ranks out
from the roster and the scoreboard it already has: no message more and nothing at match start. Purely cosmetic.

**Rank-up** (`game/rankGlow.ts`, style.css `rank-up`): when a rank rises from points, the badge swells (to 1.45 times)
and a soft halo in its colour rises and fades over a second, in the kill feed (its lines naming them take the new title)
and over the head. Under Reduce flashing it is smaller and dimmer (1.2 times, the halo at most 0.3) and eases in and
out: a soft glow, no flash. The flicker check's `rankup` moment records it.

**Order in a section.** By name, unless a manifest sets `sortAs` (the name it is listed as): the owner swapped Spud
Marshal and Astronaut Explorer (2026-11-17) so the astronauts sit together.

| Group (`id`) | Who |
|---|---|
| Soldiers & Spies (`soldiers`) | Azure Sentinel, Customs Agent Zhao, Desert Ranger, Dummy (NPC skin), Flt. Lt. Ember, Grunt '68, Kenji, Pemberton, Sentinel in Green, Stealth Operative, Tactical Soldier, Virtua Soldier, Warrior Sentinel, WWII Infantry, and from 2026-11-25 Cpl. Tinwhistle, Pvt. Pete Plastic |
| Everyday Folk (`folk`) | Big Bogdan, Biker Gang Girl, Bill the Barbarian, Cal, Chef Basile, Coffee Brown, Dusty Ranger, Hazmat Joe, Imperial Guard, King Aldric, Lancer Mei, Merrow the Wise, Mister Lanky, Old King Halvard, Old Timer, Orange Suit Engineer, Patches, Rosa Rivets, Rourke, Ser Brannock, Sgt. Mackie, Shaka Mpande, Sir Galloway, Spike Scavenger, The Butcher, The Dapper, The Mechanic, The Prospector, The Racer, Thornweaver (the plains huntress model since 2026-11-25), Cutter McCrae (2026-11-25), Umpire, Velvet Vance |
| Outer Space (`space`) | Alien Biker, Alien Encounter, Spud Marshal, Beanie Alien, Neon Guardian, Neon Shadow Ninja, Reef Wanderer, Ricochet, Shadow Enforcer, Space Marine, Spacewalker, Astronaut Explorer, Star Voyager, Starfarer, Steampunk Warrior, The Visitor |
| Chrono Crew (`chrono`, a collection) | Clio Everwhen and Sarge Tobias Crane first (owner, 2026-11-25), then Blix Orrin, Dex Calloway, Doc Seraphine Vale, Flicker, Gears Okafor, Juno Hartwell, Lyra Vantis, Mags Petrov, Nova Kade, Vesper Quill, Wren Halloway (their group is Outer Space) |
| Legends (`legends`) | Anoobys (new model 2026-11-25), Bronzer, Brother Silencio, Cap'n Rusty Barnacle, Elder Tomo (new model 2026-11-25), Frost Viking, Grandpa Chains, Honest Abe, Iron Knight, Luther Vanguard, Santa, Sun Warrior, The Purple Comet, and from 2026-11-25 Ignatius Slagg (from Horrors & Creatures), Silas Coilwhisper, Talon Skycrest, Balam Nightclaw |
| Animalia (`animals`) | Rascal McGraw (id `core.bandit`), Barnaby Bruin, Big Bab, Biscuit, Boglurker, Brass Hare, Croakley, Cyber Lion, Elephant Warrior, Fishy Fred, Gorilla G, Greyfang, Hyena Warrior, Lion in a Suit, Octo Buddy, Newt Calloway (id `core.warlord`), Scamp, Seetah J. Chloth, Shellback, Shiba, Warrior of the Skies, and from 2026-11-25 Fenn Dustwhirl, Kiko Banyan, Deuce Droopwell, Ottis Crema, Boogie Tuskworth, Det. Drake Montego, Napsworth (Pip Quickfoot's new model too) |
| Machines (`machines`) | Armored Sentinel, Baseball Robot, Botboy, Botney Mullz, CRT Robot, Emerald Robot, Field Medic Automaton, Inspector Bigotes, Steel Guardian, T-TreeFitty, Fuse Hollister (from the Chrono Crew, 2026-11-25) |
| Horrors & Creatures (`horror`) | Bonejack, Cool Hands Rex, Count Bonesworth, Dog Tag Doyle, Fearsome Undead, Freaky Frida, Giggles, Goblin Gunslinger, Goblin Warlord, Goblina, Gorgle, Grinning Gus, Groaner, Mummy Bot, Pharaoh Mummy Warrior, Pink Mantis, Punkin, Rattles, Scary Larry, Shambler, Snikkit, Spiked Skeleton Biker, Sugar Skull, Teddy, The Hollow Pilgrim, The Masked Figure, Zombie Soldier A |

Where a group comes from: a part-built preset has `group` on its entry in
`CORE_LOOKS`; a whole-body character has `group` in its manifest (below,
copied into characters.generated.ts); an NPC skin gets it from
`NPC_LOOK_GROUPS` in sim/npc.ts (creatures and the zombie → Horrors & Creatures,
the Dummy (trooper) → Soldiers & Spies as Agency, the other soldier roles as Army). `lookGroup(id)` reads any of
them; a design of yours has none and goes under **Yours**. The screen is one
grid that scrolls through the sections in that order (each group with anyone
in it, its characters by name, then Yours with **Design new**), each under a
compact header with its count. The jump strip above lights the section in
view; a chip, or Q / E (LB / RB), scrolls to a section. Arrow keys and the
d-pad cross from one section into the next.

Picking: a click (tap, Enter, controller A) on a portrait **shows** that
character (the big model, bio, loadout); hovering only highlights it, so the
mouse is free to drag the model round. Only **Choose** (the button, Enter / A
again, or a double-click on the portrait) makes them yours; Back (Esc / B)
leaves your character as it was. Your current one wears a **Chosen** badge.
Character Select opens from Profile (the main menu's Profile entry → **Change
character**) or Online; Back and Choose return there.

### Tier

A character is **Core** or **Experimental** (owner, 2026-11-11: the same rules as for maps, docs/BUILDING_KIT.md,
"Tier"). `tier` in its manifest (`core` or `experimental`; left out = core, as every character offered before the
tiers; anything else fails `pnpm content:check`) is copied into its look (`tier` on `CharacterLook`,
`characterTier(look)` in looks.ts). The Workbench's **Characters** collection edits and filters by it.

- **Offered under its own heading.** Character Select lists experimental characters in an **Experimental** section
  after the groups and before Yours (they leave their group's section); no section while there are none
  (`characterSections`). A person can still choose one, for themselves or for a bot in the bot manager (`BOT_LOOKS`),
  and a saved choice keeps working (`getLook` resolves any roster look by id).
- **Promoted (owner, 2026-11-24: "the experimental characters are ok to move up").** Every experimental character is core
  now (the 42 of the 2026-11-21/22 intake: `tier` left out of their manifests), so none is under Experimental and the section
  is hidden (`characterSections` drops an empty one; the mechanism stays for the next batch), and all of them are in the
  automatic picks (random bots, Random characters, Roulette). **Display names only** changed, ids kept (saved picks and
  profiles work): Rufus Boomwell → **Rufus Boomtown**, Bandit → **Rascal McGraw** (the raccoon, Zero Ringtail's model),
  Salamander Warlord → **Newt Calloway** (the tactical salamander; new bio; the NPC role `warlord` takes the name too).
  **Order:** a section lists its characters by name, so the nine the owner wanted together carry `sortAs` `01`..`09`
  (`"01 Pip Quickfoot"`) and open Animalia as its first tiles, in this order: Pip Quickfoot, Rocket Nutley, Rowdy
  Gnashwell, Rufus Boomtown, Ollie Hootman, Barnaby Burrows, Rascal McGraw, Chester Knuckleby, Newt Calloway.
- **Left out of automatic picks.** `PICKABLE_LOOKS` (the core tier of `CORE_LOOKS`; "core" in `CORE_LOOKS` is the id
  prefix, not the tier) is what the default look, random bots (`Match.botLook`: the match's own shuffle of `castLooks`,
  `botLookOrder` from the match seed, each bot a different look until the pool runs out; seed 1, tests, keeps roster order), Random characters and Roulette (`RANDOM_LOOK_POOL`) draw from. `content/npcs.json` and
  `content/roulette.json` may not name an experimental character (`pnpm content:check` says which).
- **Experimental now (2026-11-22):** the owner's Drive batch of 2026-11-21/22, eleven of the twelve of 2026-11-22's
  afternoon and four of its evening, rigged Meshy downloads built as the 2026-11-14 batch was (the download's own rig, its clips unused;
  those over the 1.8 MB character budget rebaked, `surface: rebake` at 12k triangles; grip offsets from the auto-fit).
  All Meshy, owned (the owner's own, 2026-11-22) but Juice (Meshy Community). Names are personal names (see
  "Names" under Adding a Meshy character); the batch's first labels are in each manifest's notes. Their groups once
  promoted:
  - Legends: Sigrun Frostmane (was Frost Valkyrie), Aurelio Dawnmantle (Sun Priest), Ser Castor Brightmoor
    (Celestial Knight), Madame Zephyrine (Mystic).
  - Horrors & Creatures: Dredge Marrow (Abyssal Hunter).
  - Outer Space: Clio Everwhen (Time Traveler), and the **Chrono Crew** (their own section now, whatever their tier;
    see "Collections"): Vesper Quill, Nova Kade, Fuse Hollister, Dex Calloway, Gears Okafor, Doc Seraphine Vale,
    Flicker, Wren Halloway, Sarge Tobias Crane, and from the afternoon Mags Petrov (Quartermaster) and Lyra Vantis
    (Chrono Mage).
  - Animalia: Rocket Nutley (Ace Squirrel), King Waddleston (Penguin King), Axel Gainz (Gym Bro Axolotl), Barnaby
    Burrows (Agent Badger), Coach Hank Shelton (Coach Tortoise), Rio Neonwing (Cyber Flamingo), Juice (Box Duck,
    named by the owner), Chad Croakley (Gym Bro Frog), Dr. Hugo Hue (Doc Chameleon), Ollie Hootman (Owl Sniper),
    Chompers McFinn (Wacky Shark), Master Bodhi (Zen Capybara); and from the afternoon Brutus Hornbeck (armoured
    rhino juggernaut), Zero Ringtail (raccoon hacker; Rascal McGraw's (Bandit's) model since the evening, below), Tag Malone (graffiti raccoon), Ryo Snapclaw (mantis shrimp
    samurai; blue blood, as a crustacean's), Maximus Cluckworth (gladiator rooster), DJ Volta Coilwave (synthwave
    eel DJ), Rowdy Gnashwell (Tasmanian devil), Pip Quickfoot (hare courier, a her), Buster Haymaker (boxer bunny) and
    Duke Dashwood (the cheetah kingpin; the download says "cheetah pimp"). From the owner's third batch of 2026-11-22 (the Drive uploads after 15:00):
    Sterling Purrcival (tuxedo cat), Rufus Boomtown (baboon; first named Boomwell) and Chester Knuckleby (chimpanzee).
  - Horrors & Creatures, from the third batch: Ignatius Slagg (the magma juggernaut; bleeds stone).
  Two of the batch became the models of characters already on the roster (owner, 2026-11-22) and left it: Tinker
  Goblina's GoblinaRigged is **Goblina**'s model, the Sunset Gunslinger's is **Dusty Ranger**'s (both keep their name,
  roster place and Core tier; `RETIRED_LOOKS` sends saved choices and bot sets of the two to them). The third batch
  (owner, 2026-11-22) swapped three more models, each keeping its id, name, roster place and tier: "shiba inu 15k"
  is **Shiba**'s model and "salamander 15k" the **Salamander Warlord**'s (the old community models no longer ship),
  and Zero Ringtail's raccoon hacker is **Bandit**'s (its built files renamed to Bandit's; Zero Ringtail left the
  roster, `RETIRED_LOOKS` sends `core.raccoonhacker` to `core.bandit`). All three are Meshy, owned now. The Drive's
  "veteran time crew rigged" is the same model as "veteran time crew 15k" (built from the latter); the afternoon's
  re-uploads of characters already in the game were not reprocessed (owner).
- **Gates.** To be core a character passes every blocking gate; for an experimental one they only report.
  `pnpm quality-gates` prints the characters after the maps and exits 1 on a failing core character
  (`--characters`: only them; `content/characterGates.ts`, facts read by `packages/server/src/tools/characterFacts.ts`;
  `packages/server/test/characterGates.test.ts` holds the core roster to them). The headless gates, from what the
  content build already recorded:

  | Gate | Passes when | From |
  |---|---|---|
  | `triangles` | the model is within the character budget (20 000 triangles); the note tells what its cut asked for (`fixes.triangles`) | `content/meshy.lock.json`, `content/models.json` `characterBudgets` |
  | `lod` | a far copy was built, lighter than the model | `content/meshy.lock.json` `lodTriangles` |
  | `hands` | the hands were measured, the body's and its own first-person arms' | `content/meshy.lock.json` `hands` |
  | `clips` | its clip set holds all five clips (a rolling body, or one that keeps the rig's gait, has none to hold) | `content/clip-sets.lock.json`, a character's own `<id>_clips` |
  | `hitbox` | a hit shape was measured from its model | `MEASURED_HITBOXES` |
  | `portrait` | a portrait ships with the site | `portraitIndex.ts` |

  `triangles`, `lod` and `hands` are for whole-body characters; a look built from the shared parts has no file of its
  own (its parts are budgeted in `pnpm content:check`). A gate the core roster fails would be listed in
  `REPORT_ONLY_CHARACTER_GATES` (reports for every tier, with a TODO in the output) rather than weaken the roster:
  none today. Not gated yet, because they need the game's renderer: how the hands sit on each gun (the grip sheet),
  the face and the portrait's picture, clipping in first person. A new experimental character has no shipped portrait
  until the next capture (the menu draws it live), so `portrait` reports until then.

## Blood

What a character bleeds when hit (the owner, 2026-11-17, "a"): `blood` in its manifest, one of `BLOOD_KINDS`
(`packages/shared/src/content/looks.ts`; the manifest checker wants one on every built character). Drawn by
`game/bloodVisuals.ts` (`bloodStyle`) at every hit on the character and its body, its kill and its headshot:

| Kind | Drawn as |
|---|---|
| `red` | the red spray, mist, splats and pool (people) |
| `green`, `blue` | the same in MapMaker's Alien green or Coolant blue (aliens) |
| `oil` | black oil drops, splats and pool, with Binbun Electric FX sparks (`blood.oil` in content/vfx.json map.gameplay; robots and machines) |
| `bone` | a few pale bone chips and a drifting cloud of bone dust; no splats, no pool, no wet splat sound (skeletons) |
| `stone` | the same in grey: stone dust (a statue) |
| `spirit` | a white-grey spectral wisp that eases in, rises and fades, with Binbun Hit FX's `vfx_impact_05` tinted white-grey (`blood.spirit`); no drops, no splats, no pool, no wet splat sound (ghosts and spirits) |

**Who decides.** A character's own kind wins over the map's colour. Anyone without one bleeds the map's blood (MapMaker →
Map properties → Blood; red unless set): the part-built presets (Ranger, Medic …), designs of yours, the soldier NPC
mannequins (the Dummy) and the hostages. NPC creature skins have theirs by role (`NPC_SKIN_BLOOD` in `sim/npc.ts`:
imp, puglin and zombie red, cyclops blue, oculus and scolitex green); roles drawn as a character (goblin, otter …)
bleed what that character's manifest says. The map's **amount** (None, Light, Heavy) and the player's **Blood** switch
in the pause menu rule every kind: None or switched off, nothing is drawn, sparks and wisps included. `lookBlood(id)`
reads it; the manifests' kinds are generated into `WHOLE_BODY_BLOOD` (characterBlood.generated.ts; `content/blood.ts`), apart from the
looks, so the menu's first JS doesn't carry it.

**Reduce flashing.** The sparks and the wisp play smaller and dimmer, eased in, and at most one of each a second
however fast the hits come (a machine gun on a robot crackles once a second, not ten times); off, at most one every
60 ms. The `flashing` e2e flow records a robot, a skeleton and a ghost hit ten times a second each at night (moment
`blood`).

**Who gets what** (tagged by group first: Machines oil, every other group red; then by hand, in *italics*; the owner's
answers of 2026-11-18: Alien Biker, Spud Marshal and Space Marine blue, Brass Hare red, Bronzer stone dust, the wisp
white-grey; 133 characters on the roster):

| Kind | How many | Who |
|---|---|---|
| **Red** (`red`) | 99 | Anoobys, Astronaut Explorer, Azure Sentinel, Rascal McGraw, Barnaby Bruin, Big Bab, Big Bogdan, Biker Gang Girl, Bill the Barbarian, Biscuit, Boglurker, Brass Hare, Brother Silencio, Cal, Cap'n Rusty Barnacle, Chef Basile, Coffee Brown, Cool Hands Rex, Croakley, Customs Agent Zhao, Cyber Lion, Desert Ranger, Dusty Ranger, Elder Tomo, Elephant Warrior, Fearsome Undead, Fishy Fred, Flt. Lt. Ember, Freaky Frida, Frost Viking, Giggles, Goblin Gunslinger, Goblin Warlord, Goblina, Gorilla G, Grandpa Chains, Greyfang, Groaner, Grunt '68, Hazmat Joe, Honest Abe, Hyena Warrior, Imperial Guard, Iron Knight, Kenji, King Aldric, Lancer Mei, Lion in a Suit, Luther Vanguard, Merrow the Wise, Mister Lanky, Neon Guardian, Neon Shadow Ninja, Old King Halvard, Old Timer, Orange Suit Engineer, Patches, Pemberton, Punkin, Rosa Rivets, Rourke, Salamander Warlord, Santa, Scamp, Scary Larry, Seetah J. Chloth, Sentinel in Green, Ser Brannock, Sgt. Mackie, Shadow Enforcer, Shaka Mpande, Shambler, Shellback, Shiba, Sir Galloway, Snikkit, Spacewalker, Spike Scavenger, Star Voyager, Starfarer, Stealth Operative, Steampunk Warrior, Sun Warrior, Tactical Soldier, The Butcher, The Dapper, The Masked Figure, The Mechanic, The Prospector, The Purple Comet, The Racer, Thornweaver, Umpire, Velvet Vance, Virtua Soldier, Warrior of the Skies, Warrior Sentinel, WWII Infantry, Zombie Soldier A |
| **Green** (`green`) | 5 | *Alien Encounter*, *Beanie Alien*, *Gorgle*, *Pink Mantis*, *The Visitor* |
| **Blue** (`blue`) | 6 | *Alien Biker*, *Octo Buddy*, *Reef Wanderer*, *Ricochet*, *Space Marine*, *Spud Marshal* |
| **Black oil and sparks** (`oil`) | 10 | Armored Sentinel, Baseball Robot, Botboy, Botney Mullz, CRT Robot, Emerald Robot, Field Medic Automaton, Inspector Bigotes, Steel Guardian, T-TreeFitty |
| **Bone dust** (`bone`) | 10 | *Bonejack*, *Count Bonesworth*, *Dog Tag Doyle*, *Grinning Gus*, *Mummy Bot*, *Pharaoh Mummy Warrior*, *Rattles*, *Spiked Skeleton Biker*, *Sugar Skull*, *Teddy* |
| **Stone dust** (`stone`) | 1 | *Bronzer* |
| **Spectral wisp** (`spirit`) | 1 | *The Hollow Pilgrim* |

Retired looks (`RETIRED_LOOKS`) keep a `blood` in their manifests, but bleed as the look they play: Bamboo (as Shellback), Bill (as Cal), Briggs (as Grunt '68), Capt. Nova (as Spacewalker), Crimson Operative (as Stealth Operative), Dust Trooper (as Desert Ranger), Goblin (as Goblina), Hollis (as WWII Infantry), Ivory Rustwalker (as T-TreeFitty), Rotter (as Shambler), Rusty Mech (as T-TreeFitty), Shade (as Lancer Mei), Slugger-9 (as T-TreeFitty), The Hollow Visitor (as The Visitor), Uncle Bao (as Old Timer), Vampire (as Count Bonesworth), Wealthy Otter (as Brass Hare).

**Stone dust** (`stone`) is bone dust's chips and cloud in grey (`#a6a39b`), for a statue. The **wisp** is white-grey:
its own mist `#c4c6ca`, the pack's burst tinted `#a9adb3` at 0.22 of its size and 0.45 of its strength, eased in (softer than a white burst; owner, 2026-11-18).

## Character Designer

Character Select → **Design new** (D / controller X), or **Customise** on a part-built look (or `?mode=designer`).
Players choose:
- a body;
- one part per slot (top, arms, trousers, feet, hood, pauldrons);
- hair and beard, with a hair colour;
- colourways and a skin tone (swatches or any colour).

A live preview idles, runs or dances, holding a weapon of the player's choice. Each
change rebuilds it from the shared parts.

How custom looks are stored:
- **Saving:** looks are saved in the browser (up to 24) and listed under "Your characters" in the Character picker.
- **ID format:** a look travels as a 22-character ID (`encodeLook`): `c1-`, the body, then bitmasks of parts, hair and colourways in catalogue order, then the two colours.
- **Validation:** the server and every client decode the ID with the same `decodeLook`. Anything malformed or unwearable becomes the default look.
- **Catalogue:** `CHARACTER_PARTS`, `HAIR_STYLES`, `COLORWAYS`, `SKIN_TONES` and `HAIR_COLORS` in `looks.ts`. A test keeps `CHARACTER_PARTS` equal to the shipped parts.

Mixing rules (`lookProblems`; the designer shows them and won't save until they're met):
- The athlete torso includes bare arms, so it doesn't take an `arms` part.
- A look needs a top, trousers and feet, and arms unless the top is sportswear.
- Low-rise trousers (female peasant) show the sportswear waistband above them.
- Athlete feet are bare feet only (no shins), so they pair with athlete legs.

## Animation in game

`CharacterAnimator` (client) drives each character from interpolated snapshots:

- **Legs:** crossfaded loops chosen by speed and airtime (aim idle, the
  upright gait, crouch, prone, airborne). Moving starts above 0.6 m/s and
  stops below 0.45 m/s, so the legs don't flicker at the edge.
- **Gait (`gait.ts`):** walk, run and sprint are one blend. Walk turns into run
  by speed (all walk below 1.2 m/s, all run from 3.6 m/s), and the sprint fades
  in over the run while sprinting (or from 7.4 m/s). All three play at the one
  cycle rate that keeps the planted foot still for the speed and body size, and
  a loop joining the blend starts in step with the one already playing (left
  feet down together), so the feet never skip or swap. Each loop's
  planted-foot speed and left-touchdown point are measured from `rig.glb`
  (walk 0.95 m/s, run 5.9 m/s, sprint 9.0 m/s at speedRatio 1).
  `test/gait.test.ts` measures them again from the file, so re-exporting the
  rig with other clips fails the test until the numbers are updated. Running
  pace (5.2 m/s) plays the run at 0.88×, a sprint (7.8 m/s) the sprint at 0.87×.
  The old fixed guesses (run 4.2, sprint 6.5, walk 1.6 m/s) slid the planted
  foot about 40% of the ground speed (measured in the viewer).
- **Strafing and backpedalling:** there are no strafe clips, so the hips (and
  legs) turn toward the direction of travel, up to 77°, and the spine turns
  back by as much, keeping the shoulders and the gun on the aim. Moving more
  than 108° from facing (staying until under 94°) turns the hips toward the
  opposite of the motion and plays the gait backwards. Every turn after the
  clips is about a world axis (`worldTurn`): the glTF import mirrors the
  skeleton, and reading the up axis through a rotation-only inverse wound the
  spine the same way as the hips, so until 2026-11-02 a strafe turned the chest
  about 140° off the aim (the arms wrapped round to a gun still pointing ahead).
- **Third person, your own body:** the gun points at what the crosshair is on
  (`MotionState.aimYaw` and the aim's pitch from `thirdPersonAim`, where the
  host sends the rounds), not along the view beside it; the shoulders turn
  with it. Remote players and bots aim along their view.
- **Authored clip sets (`clips`):** a look can move with clips authored on a
  Meshy rig instead of the rig's gait while it holds a gun upright (below).
- **Upper body:** holds the aim pose while moving, so the weapon stays up.
  One-shots (shooting, melee, reloads) play over it through an upper-body mask.
- **After the clips:**
  - The spine is bent for aim pitch and twisted toward strafing.
  - The weapon is placed and the hands close on it (below).
- **Death:** plays once and holds until respawn. Intermission plays the dance.

Clips are retargeted from the rig onto each character's joints by name. The
hip track is offset per body type.

Remote characters move as smoothly as the snapshots allow (`interpolation.ts`):
the server clock is estimated from snapshot arrivals and each arrival only
nudges the estimate, so snapshots arriving unevenly (network, or the sim
worker running ticks in bursts) don't jerk them about. A late snapshot is
ridden out by carrying on along the last motion for up to 5 ticks, and drawing
never goes back in time. Their speed, and so the gait, comes from these drawn
positions. Crowd animation LOD (more than 24 remote characters) still steps
characters past 45 m every other frame and past 120 m every fourth; nearer
ones animate every frame.

Universal Animation Library 2 (Standard, checked 2026-10-27) has no jog, run,
sprint, strafe or locomotion transition clips (its 43 clips are carry, zombie,
slide, ninja jump, sword, farming and idle variants), so locomotion stays on
Library 1's walk, jog and sprint.

### The pose check (owner, 2026-11-22)

A third-person body standing in its bind pose (a T-pose) was seen once (St. John's, Team Deathmatch, spectating with the free camera: a green-hooded ranger, no gun, on a white ring) and couldn't be reproduced (`wip/fix-tpose-1122`). So the game watches for it quietly (`game/poseCheck.ts`): four times a second GameView hands it every third-person character body (the living and corpses; not your own hidden one), and a body that is on screen and

- drawn in its bind pose for 0.6 s (its drawn skin matrices: the upper and lower arms turned exactly as the chest is, which no clip's pose does; `CharacterAnimator.drawnBindPose`), or
- alive and never given an evaluated pose (`CharacterAnimator.poses`) for 1 s since it was shown or given to a player,

is written down once per body per match (8 a match at most): who (name, slot, look, body, the character's node, NPC or not), its state (alive, spawning, dead), whether the spectator camera follows it and how you were watching (first or third person, following, kill cam, free camera), the match, whether the body came from the body pool and how many lives it has stood in, the detail level drawn, whether the legs are in the bind pose too, whether a gun is in its hands, the time since its spawn, death and body, its distance and place, and the animator's state (clip, playing clips and weights, dead, dormant, frozen, the LOD gate, smoothing, poses, armed).

Where to read it: the browser console (`[pose-check]` warnings), `window.__poseReports` (this page), `localStorage['tt.poseReports']` (the last 20, across games), and the end of the performance report (Pause → Settings → Copy performance report: "pose check: …"). Nothing shows on screen. It is off in `?test=1` runs unless a test sets `window.__poseCheck = true`; the `characters3` flow (a 26-bot crowd: far, culled, dying and pooled bodies) turns it on and expects no report.

### Authored clip sets (clip retargeting)

A rigged Meshy "All Animations" download carries its own clips on Mixamo-named
joints (Walking, Running, Walk_Forward_While_Shooting, ...).
`tools/content/clip-set.mjs` retargets them onto the rig (`retarget.mjs`):

- **Rest pose compensated per bone:** each rig joint takes its source joint's
  world turn away from the source's rest pose, applied to the rig's T-pose
  re-posed onto that rest pose the way `prepare-meshy-characters.mjs` re-poses
  the mesh (arms, forearms, thighs, shins and feet turned onto the rig's
  directions). On the character the clips came from, every vertex moves as in
  the download; on any other character on the rig the pose reads the same.
- **Root motion stripped:** the hips' straight-line travel from the first frame
  to the last comes off (the game moves the body); their bob and sway stay,
  scaled from the source's legs to the rig's.
- **Measured:** each clip's natural ground speed (m/s at the rig's size) and
  direction from its planted foot, and where its left foot goes down, are kept
  in the file's top node extras; the game plays each at the rate that keeps the
  feet still and joins loops in step.

**Every look on the rig moves with a clip set by default.** `DEFAULT_CLIP_SET`
(`shooter`, packages/shared/src/content/looks.ts; `clipSetOf(look)`) applies to
every look that doesn't say otherwise: the modular looks, Designer looks and
every whole-body manifest, including ones rigged later, with nothing to add to
their manifests. A manifest can name another set (`"clips": "<set id>"`) or opt
out with a reason (`"clips": false, "clipsWhy": "..."`: the rig's own gait). A
rolling body (`locomotion: roll`) has no set. The set's file
(`characters/shooter_clips.glb`, 103 KB) is loaded once, with the first
character that needs it (never with the menu's code), and shared by all.

**Shared sets** (`content/clip-sets/<id>.json`) take each clip from whichever
download does it best: `sources` records each download (model, licence, who
rigged it, its file name pattern), `clips` which clip comes from which.
`node tools/content/clip-set.mjs --build <downloads dir> [<id>]` writes the set
and `content/clip-sets.lock.json`; `pnpm content:build` records its
provenance. A manifest can still carry `clipsFrom` to build a set of its own
download with the character (`prepare-meshy-characters.mjs`, lock role
`meshy-clips`). `node tools/content/clip-set.mjs <download.glb>` lists what a
download's clips would give (speeds, directions).

The `shooter` set (2026-11-02), each clip from the download that retargets
closest to the four downloads' consensus (mean world bone direction against
the others at 24 phases, per region):

| Clip | What it does in game | From | Measured |
|---|---|---|---|
| `clip_walk` | legs, below running pace | WWII Infantry, Walking | 1.53 m/s; legs 2.0° from consensus (others 2.4-3.4) |
| `clip_run` | legs, running | The Hollow Visitor, Running | 4.98 m/s; legs 3.5° (Fearsome Undead 7.5) |
| `clip_shoot_fwd` | upper body with the walk's share | Biker Gang Girl, Walk_Forward_While_Shooting | 0.31 m/s; upper body 2.0° (2.4-2.6) |
| `clip_shoot_run` | upper body with the run's share | The Hollow Visitor, Run_and_Shoot | 2.02 m/s, 0.67 s; upper body 2.4° (3.2-3.4) |
| `clip_shoot_back` | whole body, backing up | Biker Gang Girl, Walk_Backward_While_Shooting_inplace | 0.83 m/s; 3.1° (3.3-3.8) |

Side_Shot (in the three newer downloads) isn't used: it is a 4 s kneeling shot
in place (hips 0.45-0.56 m against 1.01 m standing), no help to an upright
strafe, which already turns the hips toward the motion and the shoulders onto
the aim. Run_and_Shoot is a crouched run (hips 0.87 m) whose legs take short
2 m/s steps, so only its upper body is used, over the Running legs; its loop
(0.67 s) is one stride like Running's (0.63 s), so it plays at about its own
pace at game speeds.

In game (`CharacterAnimator`, armed, upright, on the ground): forward and
strafing (hips turned toward the motion as with the rig's gait), the set's walk
and run play on the legs, blended by speed between their own speeds at one
cycle rate; the upper body plays the shooting walk with the walk's share and
the running shot with the run's (`clipUpperWeights`, in step with the legs: at
the game's 3.9 m/s aiming and 5.2 m/s it is nearly all the running shot);
backing up, the backward shooting walk plays on the whole body, and past twice
its own cadence its stride lengthens (thighs and knees swing up to 2.2× as far
about the clip's middle pose: `strideWarp`) rather than stepping faster. The
arms still go to the gun by IK and the aim, recoil and grips are unchanged;
crouch, prone, jumps, seats, unarmed movement and first person are the rig's.

The downloads' shooting walks are slow combat steps (forward 0.3 m/s, back
0.85 m/s, measured), far below the game's 3.9-5.2 m/s, which is why the legs
come from Walking (1.5 m/s) and Running (5.0 m/s) and the shooting clips hold
the upper body (forward) or are stride-warped (back).

Not on clips: the rolling Baseball Robot (no legs); creature skins (Imp,
Puglin: their own rigs, CreatureAnimator); the NPC soldier mannequins (NPC
roles, `spec.npc`), which keep the rig's gait. No manifest opts out: every
walking look was checked on contact sheets (strafing, backing up and running
while firing, ADS strafing; over the shoulder and from the side, 2026-11-02),
small and large bodies, creatures, animals with tails and the modular looks
alike, and none looked wrong on the clips. A body that does gets `"clips":
false` and its reason in `clipsWhy`.

## Holding weapons

Each weapon's `view.hold` (in its `content/weapons/<name>.json`) gives a
style and points on the model, in model space (+Z barrel, +Y up):

| Style | Weapon placement | Hands |
|---|---|---|
| `pistol` | Points along the aim, its `grip` in the right hand where the clip puts it (at the palm, by the middle of the hand's width) | Left palm IK'd to `support` |
| `long` | Points along the aim, its `shoulder` point (the butt) in the right shoulder pocket; the shoulders turn into the stock | Right palm IK'd to `grip`, left to `support` |
| `melee` | Carried in the right hand (first person: a long one is held two-handed by its grip, "Long melee in first person") | — |

How the hands close on the weapon:
- Two-bone arm IK runs in the skeleton's own space, because the glTF import
  mirrors the scene above it.
- The hands keep their animated orientation, and the fingers curl toward the
  palm.
- During reloads, melee, throws and hits, the IK fades out and the weapon rides
  in the right hand; it fades back in afterwards.
- The finger joints keep their animation tracks in the clips that hold things.
- **Measured hands** (Meshy characters): the file carries each hand's
  measurements on its hand joint (`extras.hand`, see "Adding a Meshy
  character" below). The palm that goes on the grip is the measured palm
  centre, not the rig's (the middle knuckle x 0.6), and it rests from the grip's
  centre line by half the grip plus half the hand's thickness, so a big hand
  wraps the grip instead of sinking into it or hovering beside it. The fingers
  close as far as the hand allows (`curl`: 0 for a fist or gauntlet that is
  already closed).
- **A pistol's grip** (`style: pistol`): `grip` is the middle of the grip about
  2 cm below the trigger guard and about 3 cm behind the front strap (the hand's
  knuckles go 2 cm ahead of it in first person: just behind the front strap, so
  the fingers bend there and wrap round); `support` is 2 cm left of it, 1 cm
  lower and 1 cm ahead (every pistol-class gun the same: the support hand goes
  round the shooting hand); `rake` is the grip's lean back from upright in
  degrees, its foot further back (12 unless set: the Flare Gun's and Grapple's
  34, the Freeze Ray's handle 20). Read them off a side view of the model with a
  grid (the hold's points sat in the trigger guard on the Freeze Ray and at the
  end of the wire stock on the Machine Pistol until 2026-11-06).

### Grips auto-fit (owner, 2026-11-18)

The owner: "How can we avoid having to fine tune all these grips custom to the model? ... I would still want to ensure
bullets come out of the gun properly (especially in 3rd person)"; answer "1a 2a autofit plan". The plan, as built on
`wip/grips-autofit`:

| | What is automatic | What is measured | Pass mark | Hand-tuned only when |
|---|---|---|---|---|
| **1. First person** | Every character wears the **universal first-person arms** (`ranger_arms_m/f`) wherever first person draws arms: Arms only, and full body's fallbacks (a seat, before your character has loaded, a `body: false` character). Their colours are read off the character's own model at content build (`tools/content/arm-colours.mjs`): **skin** = the median texture colour of the skin on the hand and finger joints (a glove, a paw), **cloth** = the forearms', **trim** = the upper arms' (a darker shade of the cloth where they match). **Full body keeps the character's own arms for now** (owner question): tried 2026-11-18, the universal arms holding the gun with the body's arms cut out left shreds of a Meshy character's sleeves at the shoulders looking down, shrinking the arms into the shoulders crushed the sleeves into shards, and shrinking only the forearms left a blob at each elbow (Croakley's shirt worst). Full body has no per-character first-person tuning (GripTune is third person only). | The same first-person grip checks as before (`characters` e2e: palms within 2 cm of their points, drawn hands on the grip). | as before | A manifest can still set `firstPerson.skin/cloth/trim` (a colour read badly), or `arms: "own"` (opt out). No per-character first-person grip tuning. |
| **2. Third person** | Each character's grip offsets (`gripLong`, `supportLong`, `gripPistol`, `supportPistol`) are **fitted from its drawn hands** (`tools/content/grip-fit.mjs`, in the game's own animator): with no offsets the hands are drawn, the error from the target measured, the points moved by it, five damped steps. The **target** is the median drawn hand position (gun axes, model m) over every character whose hold the audit passes as approved (hand-set where the owner set some, else the shared hold). Results in `content/grip-fit.json` (keyed by the model's hash), generated into `packages/shared/src/content/gripFit.generated.ts` (loaded with the first character, not with the menu: the menu's first script has a size budget) and applied under the manifest's own values. | Per character × hold (long gun: the rifle; pistol: the pistol): each hand's **error** in cm from the target, weighted by axis (shooting hand: up and ahead 1, across the grip 0.5; long gun's support hand: across and up 1, ahead 0: it slides along the handguard by design; pistol support: all 1), plus the audit's hand flags (`palm`, `off`, `open`, `back`; tools/content/grip-flags.mjs). | shooting hand ≤ 2.5 cm, support hand ≤ 4 cm, no hand flag | The audit compares none / hand-set / fitted per hold. The hand-set offsets stay in the manifest only where they beat the fit by more than 0.5 cm of summed error (`KEEP_MARGIN`); the rest are removed (`STRIP=1`). A hold over the pass mark either way is an **outlier**, listed in `summary.md` for hand tuning. |
| **3. Bullets** | Tracers and muzzle flashes start at the gun's **muzzle as drawn**: the weapon's `muzzleAt`, else the middle of the model's front-most geometry (`game/muzzlePoint.ts`; was the bounds' front a fifth above the middle). Your own shots in third person leave your character's gun (they started under your eyes) and flash on it (they didn't flash); every tracer's start settles on its gun's muzzle in the frame it first shows (`ImpactVisuals.settleStarts`, after the guns are placed). Hits still come from the aim. | The `physicsfx` e2e (`tracerMuzzleChecks`): three builds (Ranger, Wealthy Otter, Iron Knight) × rifle and pistol × standing, strafing, crouched and aiming, third person (and first person): each tracer's gap to the muzzle point that frame (drift), to the nearest drawn vertex of the gun, and behind the gun's front. | drift ≤ 1 cm, on the gun ≤ 3 cm, ≤ 3 cm behind its front, never from the eyes, a flash on your gun | — |

Re-run the fit after a character's model changes (its hash in `content/grip-fit.json` no longer matches the lock):

    pnpm build && pnpm --filter @tiletrigger/client exec vite preview --port 4860
    ONLY=<ids> WRITE=1 STRIP=1 node tools/content/grip-fit.mjs http://localhost:4860 <work dir outside the repo>
    node tools/content/character-manifests.mjs

(`ONLY` fits to the committed targets; a run of everyone measures them again.) Reduce flashing applies to the
third-person flash on your own gun as to everyone's (`SAFE_MUZZLE`).

### Full-body first person (default)

Options → Display → **First person: Full body / Arms only** (`tiletrigger.firstPerson`, `graphicsSettings.ts`;
applies at once in a match). Full body draws your own third-person character (the avatar the view already keeps
loaded for third person, `hiddenSelf`) from its eyes, `FirstPersonBodyRig` in `game/firstPersonBody.ts`:
- **Placement:** the body stands where prediction has you, animated by your own motion (walk, run, sprint,
  crouch, jump; `View.showFpBody`). After the clips and the spine's aim (the spine bends by only a quarter of
  the pitch, `FP_BODY_PITCH`) the whole body is moved so the base of its neck sits `FP_NECK_BACK` behind and
  `FP_NECK_DROP` below the steady (unshaken) eye; looking down, the neck goes further back, as a tipping head
  carries the eyes out over the chest, so you see your chest, legs and feet, never down the collar.
- **Head:** the neck joint is scaled to nothing each frame (head, hair, hats and anything skinned to them go
  with it), meshes wholly on the head aren't drawn, and a colourless ball where the head would be casts its
  shadow.
- **Hands:** the gun is the same viewmodel as before (bob, recoil, ADS, reload dip, switch timings untouched);
  the body's hands grip it by IK (`gripExternal`), each shoulder starting from its own place on the body and
  coming forward only as far as the arm needs. Copies of the forearm, hand and finger triangles (same skeleton
  and material) are drawn in rendering group 1 with the gun, so the hands never clip into a wall the gun is
  drawn over; the rest of the body is in the world (group 0). A free hand (knife, axe) hangs at your side.
- **Head cut:** besides the shrunk neck, `cutHead` hides the meshes wholly on the head and draws a copy of
  each mesh partly on it without the triangles on the head or (bind pose) above the base of the neck: a Meshy
  character is one mesh, its hat and collar included. A character whose model still fills the view (Grizzelda's
  hat brim) opts out in its manifest, `firstPerson.body: false`, and keeps the arms.
  Shoulder pads (skin on the clavicle or upper arm well out from the upper arm's bone, near the shoulder: the
  Knight's pauldrons) are cut the same way; the arm stays.
- **Shoulders:** a shoulder that must come forward to reach the gun first rolls its collarbone (up to
  `FP_CLAVICLE_MAX`), then the joint moves the rest (which stretches skin, and that's in view looking down).
- **When:** only while the camera is your own eyes. In a vehicle seat, the kill cam, spectating, third person
  or before your character has loaded it falls back to the arms below (built only when needed); scoped, the
  body is hidden with the gun.
- **Check:** `?mode=grips`, `__grips.pose(look, weapon, 'body')`, then `__grips.look(pitch, { speed, stance,
  drop })` (game pitch: + looks up) and `__grips.miss()`; the `characters` e2e flow checks palms in this view.

### Long melee in first person (owner, 2026-11-22)

The owner: the Katana, Scimitar, Baseball Bat and Battle Axe "show only the blade in first person, the hands below the
frame". Placed by `viewOffset` like a gun, a long weapon's grip sat at the eye's depth, out of view. `game/meleeView.ts`,
one rule for every long melee weapon, nothing per weapon:
- **Which:** a melee weapon whose `hold.grip` is 0.2 m or more behind its model's middle (`LONG_MELEE_GRIP`; the knife's
  is 0.1, the tools' less). Its measured length (the model's front end, from the viewmodel's bounds) picks a blade, bat
  or axe, or a **polearm** (over 1.2 m ahead of the grip, `POLE_REACH`: the Spear).
- **Placement:** by the grip, not `viewOffset`: the grip goes low in the lower right of the view and the weapon is
  turned about it. A blade stands raised about 40 degrees and leaning in (the middle of the view stays clear); a polearm
  points ahead along the aim.
- **Hands:** two-handed in first person (`firstPersonHold`): the shooting hand on `grip`, the support hand a hand's
  width and a little (10 cm, kept 1.5 cm inside the pommel) behind it toward the pommel, or 30 cm ahead of it along a polearm's shaft; held as a long gun's hands
  are (the support hand cups from below). Both views (arms only and full body).
- **Swing** (a pose curve over the strike in `meleePlacement`, at most 0.5 s): a blade winds up over the shoulder and cuts down and
  across to the lower left, then comes back; a polearm draws back and thrusts. The old jab (the weapon nosing down,
  away from the eye) is gone for these. Nothing flashes: only the weapon moves (Reduce flashing).
- **Draw:** the match's raise brings it up from low on the right shoulder. A switch away is instant, as for every weapon
  (no put-away pose: switching stays fast).
- **The Battle Axe's barrel:** its alt shot brings it level to the aim with a gun's kick, so it fires where you look.
- **Third person** is unchanged: the weapon rides in the right hand (`style: melee`).
- **Checks:** `packages/client/test/meleeView.test.ts` (both hand points inside the view at rest for any length; the
  swing and draw return to rest); the `characters2` e2e flow (`drawnHands`): for each long melee weapon, arms only and
  full body, both hand joints on screen (`__grips.handsOnScreen()`), both palms within 2 cm of their points and the
  shooting hand drawn round the handle. On the grip page `__grips.fpSwing(u)` and `__grips.fpDraw(raise)` hold a
  swing or draw for pictures.

### First-person arms (Arms only, and full body's fallback)

Your own view shows your look's arms holding the viewmodel:
- **Which arms:** the arms part of your look. Under a sportswear top it's `athlete_fparms_m/f`, bare arms cut from the base body for this view only.
- **Whole-body characters** (the Meshy characters, `content/characters`) wear the **universal arms** (since 2026-11-18, grips auto-fit): `ranger_arms_m/f` on the shared rig, sleeves dyed and hands tinted with the colours read off the model (`content/grip-fit.json` `arms`; a manifest's `firstPerson: { skin, cloth, trim }` overrides any of them, `arms: "peasant_arms_f"` another part). `firstPerson: { arms: "own" }` opts back into the character's own forearms and hands, `<id>_fparms.glb` (still built: cut from the same model, the elbow half of each forearm dropped, sleeves pulled in towards the bone, hands a little smaller), on the character's own fitted skeleton.
- **Placement:** they hang from the camera at the character's own size, the body a little behind the eyes. While a gun is held, the shoulder joints are set from the view, not from the character's build (a hunched cat's would sit in front of the eyes): beside and below the eye (`FP_SHOULDER` in characterAnimator.ts), so the forearms rise from the bottom of the screen. A shoulder comes forward toward its point on the gun as far as the arm needs to keep a natural bend (only the off-screen shoulder region stretches); the support hand first slides back along the handguard (no nearer the grip than 12 cm) before the shoulder comes further. A hand with nothing to hold (a knife) hangs out of view.
- **Grip:** the gun keeps its tuned viewmodel placement, with bob, recoil and the reload dip. `gripExternal` IKs the palms onto its grip and support points with the same solver as third person; on a long gun the support hand is turned to cup the handguard from below (palm up, fingers round its far side). `window.__grips.miss()` in `?mode=grips` says how far each palm ended from its point (the `characters` e2e flow checks large guns).
- **A pistol in first person** (both views; `PISTOL` in characterAnimator.ts, owner 2026-11-05: "looks as if their
  fingers are just pinching the grip"): the grip sits deep in the shooting hand, the web of the thumb high on the
  backstrap, the fingers round the grip, the support hand round the shooting hand.
  - Each hand is turned about its palm so its knuckle line (index to little finger) runs down the grip at the gun's
    `rake` (the support hand's 18° further, canted forward), so the fingers close round the grip rather than up
    across it; the shooting palm faces in against the grip, the support palm in against the shooting fingers.
  - Each hand is set by its knuckles, not its palm point: the middle of the shooting hand's knuckle line goes 2 cm
    ahead of `grip` (a hand longer than 9 cm from wrist to knuckles goes further round, so its palm stays on the
    backstrap), the support hand's 1.5 cm ahead of and 1 cm below `support`, its palm 1.1 cm further in (first
    person only: `support` is third person's too). Set by the palm point, the knuckles stood 2-3 cm ahead of the
    front strap and the fingers closed round the trigger guard.
  - The fingers close until the middle fingertip is round on the grip's far side, no further (the shooting hand's
    past 2.2 cm left of the grip's middle, the support hand's past 1.5 cm right of it); a full close on
    top of the clips' bend folded them back into the palm.
  - The thumbs lie along the frame (each straightened most of the way, the support thumb forward along the left side).
  - Tune it live on the grip page: `__grips.pistol({ knuckles: [right, up, ahead], wrap, supportShift, ... })` (model
    m, the gun's axes; returns the whole tune), then `__grips.pose(...)`. Third person keeps the clips' hold.
  - Only a two-handed pistol grip (a `support` point) is held this way. A one-handed `pistol`-style hold, the Spear's
    shaft or the Medkit's and Medi-Beam's handle, keeps the close it had before (turned and closed as a raked grip,
    their fingers stood straight off the shaft and the handle; the grip audit's Spear and Spin Gun pass, 2026-11-06).

**Where hands are drawn:** `gripMiss` and `__grips.miss()` measure the joints. A Meshy hand needn't sit on its
joint as the rig's does (the dapper's lay a quarter turn round), so each measured hand's own frame is read off its
skin (`handProbe.skinHandFrame`) and the hand is turned onto the gun by it (`gripHand`). `__grips.drawn()` and, in a
match, `__cs.view.gripReport()` measure the drawn skin: model metres from each hand's skin to its point on the gun,
`aheadR` (fingers along the barrel), `sideR` (the shooting palm in against the grip's side: 1; its back there, the
palm facing out: -1) and `palmL` (the support palm up into a long gun's handguard, or up and in round a pistol's
shooting hand: 1; palm down or out: negative); the `characters` e2e checks them. `atR` / `atL` say where each drawn
hand's skin centre is from its point in the gun's axes (right, up, ahead) and `wrapR` the share of the shooting hand's
skin past the grip's middle on its far side (the fingers round the grip).

**Which side is the palm** (2026-11-05). A hand's flat (its thinnest way) has two sides; `skinHandFrame` takes the
palm's from the hand's joints, the first cue that speaks clearly:
1. **Handedness** (`knuckles`): fingers ahead, index knuckle on the thumb's side of the little finger's (ring or
   middle where there's no little finger), a right hand's palm is on one side of them and a left's on the other
   (worked in the mesh's own glTF space, which is right-handed; the import mirrors the world). On a download's own
   fingers these are its own knuckles; on re-fitted fingers they were placed by `hands.mjs` from its palm side.
2. **Curl** (`curl`): the finger joints bend toward the palm (only where they bend by more than about 6° a link).
3. **Thumb** (`thumb`): the thumb's tip sits on the palm's side of the flat.
4. **Measured** (`measured`): the import's palm side (`extras.hand.palmSide`).
Before, the sign came from the thumb's first joint against the wrist joint, nearly level with the flat on most hands:
on some (the Gnoll, Hyena Warrior's model) it picked the back, and the grip turn put the shooting palm out from the
grip and the support palm down (owner, 2026-11-05). `drawnHand` reads the drawn palm the same way (handedness from
the drawn knuckles), so the measures are signed. `__grips.palms()` lists each posed hand's cues (`by`, `votes`, and
`rig`: the rig's thumb-side reading in the drawn pose), `__grips.palmRule('old')` builds the next hands by the old
rule (a before/after), and the grip audit flags `palm` (`sideR` under 0.25 or `palmL` under 0, third or first
person; `PALMS=old` audits by the old rule).

To fit a new weapon, read the grip, support and butt positions off a side view
of the model, then check them in `?mode=characters`.

## Level of detail

Every character file except the first-person arms carries a low-detail copy of
each mesh (`<name>_lod`, about 30% of the triangles, same skin and materials). It's
added by `prepare-characters.mjs` and recorded as `lodTriangles` in the lock
file. The game registers each copy as a Babylon LOD level of its mesh and draws
it beyond 18 m (`LOD_DISTANCE`). In the viewer from 30 m, 253k triangles drop to
90k. The copies live in the same file because separate low-detail files loaded
in the background were seen to stall in the browser.

**Whole-body (Meshy) characters' far copy** (`tools/content/character-lod.mjs`): 30% of
the body's triangles (`fixes.lod` sets another share, 0.15-0.6), cut with the texture
coordinates weighed in, so a seam collapses only where the colour layout agrees on both
sides. The old sloppy cut joined triangles across the texture's charts: Saint Nick's far
copy wore white streaks over his red coat (half its triangles spanned a seam; now 5 of
4,800). A mesh that cut can't bring near its share is cut on its shape alone with its
seams welded, each corner taking back the copy in the chart its triangle shares.
`prepare-meshy-characters.mjs` adds it; `node tools/content/relod-built.mjs`
(`ONLY=<ids>`, `OUT=<dir>` for a trial) remakes it in the built files without the
downloads and updates the lock. **Through a scope** the switch moves out with the zoom
(`setCharacterLodZoom`, from the view's FOV against the game's: a sniper scope's 0.4 rad
keeps full detail to about 71 m), so a scope never shows the far copy filling the view.

**Meshy characters' normal maps.** A Meshy body is cut from hundreds of
thousands of triangles to about 11,000, which alone shades as lumpy facets.
`prepare-meshy-characters.mjs` bakes a 512 px (`fixes.normalSize`: 1024) tangent-space normal map from the
surface before the cut (and Meshy's own normal map) into the download's texture
layout (`bakeNormals` in `tools/content/meshy-mesh.mjs`, with a TANGENT
attribute), for the body, its low-detail copy (same material) and the
first-person arms. Characters not rebuilt since (their download or rig task
not at hand) keep the plain cut until they are; HANDOFF.md lists which.

### Hand fitting: the same fit for less (owner, 2026-11-23, "start 2")

The owner's profile of St. John's TDM at 63 players (M1 Pro, High, build ffab1e8) had the main thread about 100% busy
and `CharacterAnimator.pose` at 4.2 s of 43.4 s; 2.7 s of it (6% of the frame) was `gripPlaced`, and 0.9 s
`placeWeapon`. Read through the build's source map, `gripPlaced` is **your own** hands on the first-person gun (full
body, or the arms), one call a frame; other characters are `placeWeapon`, and they already have a level of detail by
size on screen (animation LOD: `full`, `cached` fingers, `coarse` arms past about 25 m, every few frames further out,
none off screen). So the saving had to keep the fit exactly as it was, up close and far, and it does:

- **The support hand's slide** (first person: a support point out of the arm's reach moves back along the handguard a
  centimetre at a time until the arm reaches it) read the hand's palm side and fingers afresh at every step, up to forty
  steps a frame, though nothing moves while it slides. They are read once (`slideSupport`): the same numbers.
- **World matrices only where stale** (`game/freshWorld.ts`): Babylon's `computeWorldMatrix(true)` works out the whole
  chain above a joint every call (15-20 matrices for a finger), and the fit reads joints a few hundred times a frame:
  about 5,900 matrices for your own hands each frame. `freshWorld` works out only the stale part of the chain, top
  down, by Babylon's own dirty flags, and gives the same numbers: 244 matrices a frame. Every forced compute in the
  animator and `armReach` goes through it. A chain under a camera (arms only), a mesh or a frozen matrix in its stale
  part takes the forced compute as before.

Measured (headless, SwiftShader; relative only): your own first-person hands 7.5-8.8 ms → 1.9 ms a call in a 62-bot
St. John's match, 5.1 → 0.9 ms on the grip page (-80 to -85%); other characters' `placeWeapon` -48% in the match,
-82% on the grip page; `pose` as a whole -51%. Arms only (under the camera) is unchanged. On the owner's profile that is
about 2.6 s of 43.4 s back (6% of the main thread). The overlay's `systems` line shows it as `hands` (of the clips).

- **Switch:** `?perfoff=gripfit` (both), or `window.__gripFit(false)` in a page to measure both ways turn about.
- **Checks:** `packages/client/test/freshWorld.test.ts` (3,000 random turns and reads against the forced compute, a
  camera and a mesh in the chain, the slide with its hand read once and at every step); the `characters` e2e flows
  compare every matrix `freshWorld` gives with the forced compute's (`window.__freshCheck`): the grip page in every
  view, every character on the long guns in third person, and in play (your hands and the bots'). Pictures with the savings on
  and off in the same frame, the clips held still (the grip page: two characters, a rifle, pistol and katana, third
  person at 3, 12 and 30 m, first person full body and arms) are the same pixel for pixel.

## Tools

- `?mode=characters`: viewer with every look and the male and female NPC
  trooper and heavy in two rows, with buttons for each motion, one-shot and
  weapon, and an aim-pitch slider. `&alpha=`, `&dist=`, `&x=` and `&z=` set
  the camera; `&looks=core.goblin,core.otter` shows just those looks and
  `&creatures=0` hides the creature row.
- `node tools/content/prepare-characters.mjs <downloads dir>` rebuilds the parts
  from the original pack downloads (the free "Standard" editions; about 500 MB,
  so they are not in the repo). The script records every change made to them.
- `pnpm content:check` verifies the shipped files against
  `content/characters.lock.json` (hashes, triangle and size budgets, licences)
  and lists them in `content/provenance.json`.

## Creatures

Creature NPCs (imp, puglin, cyclops, oculus, scolitex; see SCENARIO.md) are
kept apart from the character parts: `packages/client/public/creatures/<id>.glb`,
built by `node tools/content/prepare-creatures.mjs <downloads dir>` from the
Quaternius Bestiary – Dungeon Monsters kit (imp, puglin) and the Modular SciFi
MegaKit's aliens, and checked against `content/creatures.lock.json`.

- **Imp and puglin** share our rig's joint names (minus the pinkies) but ship
  without clips. The script retargets our rig clips onto them: each joint keeps
  its own rest pose and takes the rig's rotation relative to the rig's rest
  pose, and the hips' motion is scaled by leg length. Clips: `idle`, `walk`,
  `run`, `attack` (the imp's is the heavy swing, the puglin's the punch),
  `hit`, `death`.
- **Holding a gun** (a player or bot in a humanoid creature's skin): `holdWith` (characterAnimator.ts) closes its
  hands on the gun as for a look, and the creature's own `grip` in `CREATURE_SPECS` (packages/shared/src/sim/creatures.ts;
  a GripTune, as a look's `fixes.grip`: points moved, curl, roll, elbow) adjusts that creature alone. The Imp's left
  claw stood above the handguard with its claws up: `supportLong [0, -0.05, 0]`, `rollL -0.8`, `curlL 1.3` put it
  under the handguard round it. Check with `window.__grips.creature('imp', 'core.rifle')` on `?mode=grips`.
- **Aliens** keep their own spine-chain skeletons and their one `idle` clip.
  The game leans them into their motion, speeds the idle up as they move,
  lunges them forward to attack, jolts them on hits, and drops and rolls them
  over when they die.
- **The zombie body** (Quaternius' Zombie, CC0) is an FBX with its own
  Mixamo-style rig and clips. `tools/content/fbx.mjs` (`fbxRiggedToGlb`)
  converts it with three.js' FBXLoader and GLTFExporter, renames its clips to
  ours (`idle`, `walk`, `run`, and the first 1.8 s of the bite as `attack`),
  drops still tracks and stands it 1.8 m tall; its palette is embedded as it
  is. It has no hit or death clip: hits jolt it and death drops and rolls it,
  as for the aliens. Its spec's `gait` gives its own clips' ground speeds
  (a 0.3 m/s shamble, a 3 m/s run from 1.4 m/s up). The `zombie` NPC role no
  longer wears it (owner, 2026-11-12): every zombie, in Zombies and in co-op
  squads, wears one of the roster's zombie characters (`ZOMBIE_LOOKS`,
  by NPC id) on the soldiers' rig with the zombie clips, so it dies as a
  ragdoll like a player. The creature body stays in the library, unused.
- **The creature originals** (goblin, otter, toad, salamander, hyena: models the
  owner generated on their Meshy subscription and downloaded as textured FBX,
  unrigged) are not creature-library bodies: `prepare-meshy-characters.mjs`
  rigs them onto our rig (joints placed by hand from front and side views,
  tails on the hips), so they are
  whole-body looks with every rig clip, and the NPC roles `goblin`, `otter`,
  `boglurker`, `warlord` and `hyena` draw them through their spec's `look`,
  holding the role's weapon like a soldier. Goblins rush in with blades, the
  otter snipes, the boglurker soaks fire with a shotgun, the warlord shells
  you with a grenade launcher, hyenas run you down with SMGs. They have no
  `npc:` skin of their own (players pick the look). `SKIN_DEBUG=<dir>` on the
  script writes each rest mesh coloured by joint to check the weights.
- **The community originals** (Meshy community T-pose downloads, CC0 per the
  owner; see ASSET_SOURCES.md) go through the same in-house rig. Modelled in a
  T-pose, their arm joints sit on one level line, read off slab profiles of
  each limb. Looks: Elder Tomo (robed monk, the robe skinned as cloth; until 2026-11-25, now the owner's rigged model), The
  Visitor (grey alien), Biscuit (a tabby cat on its hind legs: tail on the
  hips, digitigrade legs on their centre line; `size: 'small'`), Flt. Lt.
  Ember (flight suit), Cap'n Barnacle (pirate with a peg leg; no foot turn,
  so the peg stays straight) and Big Bogdan (circus strongman;
  `size: 'large'`). NPC roles (appended to `NPC_ROLES`): `alien` (Visitor,
  laser rifle), `pirate` (sawed-off) and `titan` (Strongman, spin gun, 300
  health). The cat's hips sit at 60% of the rig's height, so a body whose hip
  height differs from the rig's by more than 10% has its hip track scaled,
  not shifted (`retarget` in `characters.ts`): with a plain offset its death
  pose lay 0.8 m under the floor.
- **Their skin weights** (`tools/content/autoskin.mjs`) are bone heat: each
  vertex is tied to the nearest bone it can see (the line to it stays inside a
  voxel fill of the body, and the bone is the nearest along the surface too, so
  a hand resting on a thigh stays the hand's), and the weights diffuse over the
  surface from there, at most four per vertex. Rules on top: cloth hanging
  below the hips (aprons, rags, loincloths: `cloth: true`) follows the pelvis,
  with a little of the nearer thigh towards the hem; the clavicles keep only
  the top of the shoulder and the upper arms keep off the chest, so the chest
  stays rigid when the arms move; a head hung low over the chest keeps off it.
- **Stance:** hunched bodies (goblin, boglurker) lean back per spine joint when
  re-posed (`lean`), the head keeping the way it faced, so the shared clips
  stand them up. A character whose rigged download can't be fetched (its Meshy
  rig task 404s on this key) is leaned in its shipped file instead:
  `ONLY=<id> node tools/content/relean-built.mjs` turns the built chain back the
  same way (the collarbones and arms ride the chest without turning), moves the
  joints and bind matrices with it and records the lean in the file, so a
  second run does nothing (Rattles, 2026-11-17). The hyena's digitigrade legs have their joints on the leg's
  centre line (hock as the ankle, paw as the foot), so straightening them
  turns the thigh and shin only a little. The goblin's rags are hundreds of
  small texture islands: its simplification collapses across seams only where
  the texture matches on both sides (and between them), 19.7k to 11.7k triangles.
- **Normal maps (2026-11-03).** A download's own map is read as its renderer draws it (no TANGENT attribute: each
  triangle's own texture directions); a map we baked (a rebake's) in our own green (`hiGreen`; read as a download's,
  every rebaked face was lit upside down: Cal's cheek line, Sgt. Mackie's wedge); the map we ship is the inverse of the
  shader's interpolated frame (Babylon's vTBN). A download kept uncut (a low-poly one within its budget: Biker Gang
  Girl, Kenji) ships its own map, untouched, with no TANGENT attribute, and its texture's gutters are filled before it is
  shrunk (`padCharts`).
- **Rebaked characters (`surface: rebake`):** some downloads cut their texture
  into thousands of small islands (Barnaby Bruin's coat, Slugger-9's plating, the
  Rusty Mech's baked map): every cut that keeps the texture coordinates stops over
  the 20k budget, and even the careful cut scrambles them in places. A download
  already within its budget may want it too, for its face: Kenji's map is a
  mosaic of one island per triangle at 2048 px, and the shared 1024 px copy (with
  its gutters filled) washed the dark fringe strands painted over his forehead
  into a pale patch; rebaked (no cut: 10000 triangles), the head's charts get 2.5
  times the texels and the strands, brows and eyes stay sharp (2026-11-17). These are
  cut on the download itself, before rigging and posing (rebakeDownload in
  prepare-meshy-characters.mjs): the copies of a vertex on either side of a seam
  become one, the full mesh is cut to `triangles` (head 12%, hands 8%, never past
  0.8% of the model's size), laid out afresh in charts grown across shared edges
  while each triangle faces within 60 degrees of the chart's first and never
  overlaps it (meshy-mesh.mjs rebake `grow`; the props' six-axis charts broke a body
  into thousands of slivers), and its 1024 px colour and normal maps are painted
  from the full download (rays along the cut surface's normal, 1.2% of the
  model's size each way). Both maps are in the new layout, so they hold through
  the posing (the normal map is in tangent space). The cut only removes
  vertices, so a rigged download's vertices keep Meshy's skin weights; an
  unrigged one is rigged from the cut mesh as usual. Known limit: where cloth sits
  close over the body (Barnaby's coat tails) the two are cut separately and the
  body shows through in a few small patches.
- **Long guns on deep or short-armed bodies:** the stock's clearance also counts
  the chest straight ahead of the shoulder (a deep chest turned across the
  aim), the support hand slides back along the handguard when the arms can't
  reach (never off its end; see "Third-person long guns since 2026-11-20"), and a stock the arms still can't hold clear tucks out past the
  shoulder (the otter, the warlord) instead of into the chest.
- In game, `content/creatures.ts` (`CreatureLibrary`) loads and instances
  them and `game/creatureAnimator.ts` drives them; `view.ts` uses them when an
  avatar's spec names a creature. No ragdoll: their death plays and the body
  is left as a corpse.
- `?mode=characters` shows the five creatures and the zombie body in a row in front of the
  characters, driven by the same buttons.

- **Not every creature download can be rigged.** The Meshy community "Spiky
  Dinosaur" (a carnotaur-like theropod) is a biped, but its body is level with
  a tail as long again and tiny arms: on the shared humanoid rig the clips
  would stand it up like a person, it couldn't hold a weapon, and the
  player-sized hit capsule would cover a fraction of its 5.8 m length. It
  ships as a stone statue prop instead (`mp_dino_statue`, Jungle Ruins).

## Adding a Meshy character

Whole-body characters are Meshy models: the owner's own (owned), or Meshy
community models under CC0. Models from the owner's Drive are Meshy Community
CC0 unless the owner says they made them (owner, 2026-11-06); only those, and
ones we generate through the Meshy API with the owner's approval, are owned.
The owner's Drive characters of 2026-11-21/22 and those of 2026-11-22's
afternoon and evening are their own (owner, 2026-11-22), all but Juice. Each is one manifest,
`content/characters/<id>.json`, and nothing else: the tools read every
manifest, so adding a character needs no code. Raw downloads never enter the
repo; they live in a downloads dir outside it.

### 1. The manifest

```json
{
  "id": "meshy_galloway",
  "kind": "character",
  "use": "player",
  "order": 15,
  "name": "Sir Galloway",
  "look": "core.galloway",
  "group": "legends",
  "nameTheme": "knight",
  "bio": "One line for character select.",
  "body": "male",
  "size": "large",
  "notes": "Anything the next person should know about this model.",
  "source": {
    "license": "CC0",
    "author": "Meshy community (author not recorded; CC0 per the owner)",
    "date": "2026-10-29",
    "url": "https://www.meshy.ai/posts/019fb494-…",
    "community": { "model": "T-pose knight" },
    "file": "^Meshy_AI_T_Pose_Knight_.*_texture\\.fbx$"
  },
  "finish": { "metallic": 0.3, "roughness": 0.5 },
  "firstPerson": { "arms": "own" },
  "fixes": { "triangles": 11000, "feet": true, "hands": { "curl": 0.8 } },
  "landmarks": { "spine": [[0, 0.5, 0], …7 points], "L": […10 points], "R": […10 points] }
}
```

| Field | Meaning |
|---|---|
| `id` | File names: `<id>.json`, `<id>.glb`, `<id>_fparms.glb`. Lower case, `meshy_…`. |
| `kind`, `use` | `character` (rides our rig) or `creature` (not built here: creatures keep their own rigs); `player`, `npc` or `player+npc`. An NPC-only character gets a look (`WHOLE_BODY_NPC_LOOKS`) but isn't on the roster; NPC roles name looks in `NPC_ROLE_SPECS` by hand. |
| `status` | `queued` for a stub that isn't ready: it is checked only for the queue's fields and not built. Drop it once the rest is filled in. |
| `order` | Roster position among the whole-body characters (unique). |
| `group` | What the character is, for Character Select's sections: `soldiers`, `folk`, `space`, `legends`, `animals`, `machines` or `horror` (see Looks, Character Select's groups). Needed on a player look; the checker's list (`GROUPS`) matches `CHARACTER_GROUPS`. |
| `branch` | `soldiers` only, and needed there: `army` or `agency` (Soldiers & Spies' Army or Agency; `CHARACTER_BRANCHES`). A bot-characters setting can ask for one. |
| `collection` | Optional: a Character Select collection it is listed in instead of its group's section, whatever its tier (`chrono`, the Chrono Crew; `CHARACTER_COLLECTIONS`). See Looks, Character Select's groups, "Collections". |
| `sortAs` | Optional: the name Character Select lists it under within its section (left out: its `name`). |
| `tier` | `core` or `experimental` (left out: core): an experimental character sits under its own heading in Character Select and is never a bot's, a random character's or Roulette's pick (see Looks, Tier). |
| `nameTheme` | What kind of creature it is, for its bots' names (`shared/content/botNames.ts`): `soldier`, `monkey`, `bear`, `wolf`, `dog`, `cat`, `raccoon`, `critter`, `frog`, `pirate`, `knight`, `ninja`, `wizard`, `barbarian`, `undead`, `spooky`, `robot`, `alien`, `goblin`, `cowboy`, `gangster`, `townsfolk` or `myth`. The first bot wearing the character takes its `name`, the rest the theme's names ("Sgt. Dunmore"). Left out: its group's (soldiers → soldier, legends → knight, folk → townsfolk, horror → spooky; animals → the general names). Every character on the roster has one (a test checks); the checker's list (`NAME_THEMES`) matches botNames.ts. |
| `name`, `look`, `bio` | The look's display name, its ID (`core.<name>`, never changed once shipped: saved looks and bots use it) and its one-line bio. A new character's name is a fun, unique, personal name (below, "Names"), never a label of what it is. |
| `body`, `size` | `male` or `female` proportions (clips and hip height); `small` / `large` body size, or left out. |
| `source.license` | `owned` (the owner says they made it, or we generated it through the Meshy API with their approval; provenance pack `meshy-owned`) or `CC0` (a community model, which is what a model from the owner's Drive is unless the owner says they made it, 2026-11-06; pack `meshy-community-characters`, with `community.model` as named on its page or download). A licence changed in a manifest reaches the lock without the download: `node tools/content/prepare-meshy-characters.mjs <any empty dir>` gives every character it keeps its manifest's pack (content:check fails until it has). |
| `source.author`, `date`, `url` | Who made it, when (YYYY-MM-DD), and the community post or the owner's share link (`https://www.meshy.ai/s/…`), or `null`. |
| `source.meshy` | The owner's own models only: Meshy task IDs (`preview`, `refine`, `image`, `multiImage`, `remesh`, `retexture`, `rig`), which `fetch-meshy.mjs` downloads by. |
| `source.file` | A regular expression for the download's file name (a rigged `.glb`, or the textured `.fbx`), when it isn't saved as `<id>.glb`. |
| `finish` | The one material's metallic and roughness (0–1). `maps: true` keeps the download's metal-roughness map (G roughness, B metal; 512 px, painted into the new layout for a rebake) and the factors multiply it (give 1 and 1 for the download's own): Grinning Gus's black chrome skull, Dog Tag Doyle's glossy helmet. |
| `clipsFrom` | A rigged download's own clips to retarget onto the rig as this character's clip set (`<id>_clips.glb`): `{ "<clip>": "<the download's clip name>" }` for `clip_walk`, `clip_run` (both needed), `clip_shoot_fwd`, `clip_shoot_run`, `clip_shoot_back`. See "Authored clip sets". |
| `clips` | The clip set this look moves with while it holds a gun: left out, the default (`shooter`); a shared set's id (`content/clip-sets`) or a manifest with `clipsFrom`; `false` (with `clipsWhy`, the reason): the rig's own gait. |
| `clipsWhy` | With `clips: false` only: why this body keeps the rig's own gait. |
| `firstPerson.arms` | `own` (its own forearms and hands, `<id>_fparms.glb`), or a universal arms part with `skin`, `cloth` and `trim` dyes. |
| `firstPerson.body` | `false`: full-body first person shows this character's arms only (its hat brim, cape or hood would fill the view from its own eyes: Grizzelda). Left out: full body. |
| `fixes` | `triangles` (the body's budget; 11000 for an unrigged download, half the download's for a rigged one), `lean` (degrees back per spine joint for a hunched body), `cloth` (cloth below the hips follows the pelvis), `tail` (points from the hips), `feet` (turn the feet level: the foot bone pointed the rig's way, then each foot turned about its ankle until the lowest points of its heel and of its front are level; Meshy's rig left feet 7-23 degrees toes up without this), `centre` (true: the body moved over the origin by its hips; Meshy centres a download's box, so a long tail behind stood the body that far ahead of the origin the game moves and collides it by: the crocodile's hips 0.39 m ahead at 1.8 m, nearer Character Select's camera than everyone else with its head out of frame. As of 2026-11-06 Bandit 0.48 m, Scamp 0.35 and Greyfang 0.26 stand ahead too: candidates once their downloads are at hand), `seamWeld` (simplify across texture seams; the head and hands then get no share of their own), `surface` (`rebake`: the download cut to `triangles` with its texture seams closed, laid out afresh and its colour and normal maps painted from the full download; see "Rebaked characters"), `scrubBlue` (repaint blue badges: `#rrggbb` repaints every strongly blue texel; `{ "color": "#rrggbb", "within": [[u0, v0, u1, v1], …] }` only those inside boxes of the download's colour map (shares of its width and height, the download's own layout, so not with `surface: rebake`): the Spacewalker's mission patch went, the flag on its other shoulder stayed), `recolor` (colours shifted by rule on the colour map, after `scrubBlue`: each rule picks texels by `hue` (degrees `[from, to]`, may wrap past 360), `sat` and `light` (HSL 0-1 `[from, to]`), fading over `feather` (0.06) past each bound so no edge shows, and sets `toHue` (degrees), `toSat` or `satScale`, and `lightScale`, mixed by `amount`; Azure Sentinel's coat navy and lenses amber, Spud Marshal's armour olive drab, both so they read as their own characters, owner 2026-11-14), `hands` (below), `armCloth` (cloth hanging off an arm goes with the body; see "Arm skin kept to the arms"), `skinClean` (weights cleaned in the download's own pose, contacts torn; see "Skin cleaned in the download's pose"), `handsShare` (the share of the triangle budget the hands keep in the cut, 0.04 unless set (0.08 in a rebake): more where cuffs the skinning left on the hands took it, as on King Aldric), `headShare` (the head's share, 0.12 unless set), `face` (`{ box, share }`, with `surface: rebake` only: the face its own part of the rebaked cut, ahead of the rest of the head, with `share` of the budget out of the head's and its charts laid out as finely as the head's; `box` `[x0, y0, z0, x1, y1, z1]` in shares of the download's height in its own pose, the `landmarks` frame. A head's share counts the hair and a cap too, and cut by error alone Sgt. Mackie's brim and cap took the triangles and a wedge of cheek ran up over each eye: `box [-0.05, 0.855, 0, 0.05, 0.921, 0.12]`, `share 0.1`, `headShare 0.26` (the cap and hair keep the 0.16 they had); the face went from 354 to 1310 triangles, 2026-11-17; the build log's `parts kept` gives each part's triangles), `normalSize` (1024: a 1024 px normal map instead of 512), `lod` (the far copy's share of the body's triangles, 0.3 unless set; see "Level of detail"), `hold` (`{ forward, down, out }`, metres at a 1.8 m body: this look's long-gun hold against everyone's, along the barrel, square to it and out to the gun shoulder's side, in third person and Character Select; Bandit's broad build put the stock at his snout, Bamboo's big low head the rifle across its snout), `grip` (this look's own hands and arms on a gun, in third person and Character Select: `supportPistol` / `supportLong` / `gripLong` / `gripPistol` move the support hand's point on a pistol or handguard and the shooting palm's point on a long gun's or (`gripPistol`, 2026-11-17) a pistol's grip (`[right, up, ahead]` in the gun's frame, m), `curlR` / `curlL` scale how far each hand closes, `rollR` / `rollL` turn a hand about its fingers (radians), `elbowOut` / `elbowDown` move where the long-gun shooting elbow bends toward (m); set per look from before/after shots and the grip audit, since a change to the shared hold moves every look; HANDOFF.md, "Grips round 3"; an offset set before 2026-11-05 was tuned while some palms were read back to front, so re-check it: in hands round 5 a pistol's `supportPistol` near `[-0.01, 0.03, -0.03]` put the support hand round the shooting hand where the old `[0, 0.04, -0.08]` held it back under the wrist, and `supportLong [0, 0.02, 0.03]` the long-gun support hand on the handguard. First person reads none of it), `skin` (this look's own skin weights: finger `tips`, `knuckle`, `joints`, `lanes`, `fingers`; body `hops`, `clamp`, `smooth`, `wrist`; a hard part held whole by one joint, `rigid`; see "A look's own skin weights")., `fingers` (`own`, the default: a rigged download whose finger chains are whole keeps its own finger joints and weights; `fit`: re-fitted from the mesh as before; see "The download's own fingers"), `rejoint` (`{ <rig joint>: share }`, a rigged download only: the joint moved along its bone toward its parent to that share of the way (0.3–1; `upperarm` without a side moves both), or out past its own place (1–1.6: the skin the joint held inside the new place goes back to the parent, eased over 15% of the bone either side, at any distance from the bone's line; Meshy rigged Freaky Frida's shoulders 3 cm inside her arms' roots and her upper arms held her back under the vest's straps, which lifted off her shoulders in the hold: `upperarm: 1.3`, 2026-11-19), in the download's own pose, and (moving in) the skin the parent held past the new place (eased over 15% of the bone either side, within the limb's radius of its line, eased out to 1.5 radii so a robe's side under the arm stays with the body) handed to the joint; `moveJoints` in skinfix.mjs. Meshy rigged The Hollow Pilgrim's shoulders out at its robe's dropped shoulder seam, 9.7 cm from the elbow, so its arms were a sixth of its height and the support hand fell 12 cm short of a rifle's handguard: `upperarm: 0.7`, 2026-11-16), `plugs` (`{ at: [[x, y, z, reach], …], shrink }`: closed ellipsoids added inside the body where the download's own surface is open, before it is rigged (rigged with the rest by bone heat; on a rigged download, since 2026-11-19, added in its own pose after any `rejoint`, each new vertex skinned as the download's vertex nearest it), so a gap shows the cloth's colour, not the scene behind; each `[x, y, z, reach]` in shares of the download's height in its own pose, the `landmarks` frame, fitted inside the points within `reach` (principal axes, each radius `shrink` (0.85) times their 70th percentile spread) and coloured by the point nearest its centre; tools/content/plugs.mjs. Freaky Frida's download models the shirt under her vest's armholes as loose torn sheets, see-through in the download itself (108 and 68 open edges round her shoulders); her T-pose arms covered the holes, and lowered to hold a gun or run they showed the scene through her shoulders, the owner's "textures that are tearing" (skin stretch there was 1.4-1.7x, as on Sun Warrior): six plugs, `shrink 0.8`, 2026-11-17; kept, at the same places, when she was rebuilt from the owner's rigged download, 2026-11-19: the download is the same mesh). |
| `source.modelUrl` | For Meshy's rigging API: `"upload"` (the unrigged download in the downloads dir, sent as a data URI; the usual choice), or a public link to a `.glb` file. Meshy refuses a link whose path doesn't end in `.glb` ("invalid model file format"), so Google Drive download links don't work. |
| `landmarks` | Optional, for an unrigged download: found from the mesh when left out (see "Rigging an unrigged download"). The joints in units of the model's height, feet at y = 0, +x the character's left, +z its front. `spine`: hips, three spine joints, neck, head, top of the head. `L`/`R`: clavicle, shoulder, elbow, wrist, hand tip, hip, knee, ankle, ball, toe tip. Read them off front and side views. |

**Names (owner, 2026-11-22).** Every new character starts with a fun, unique, personal name, the way the Chrono
Crew got "Vesper Quill" and "Fuse Hollister": a name a player would call them by, not a descriptive label of what
the model is ("Raccoon Hacker", "Gladiator Rooster", the download's own name). It is unique on the roster, it may
play on the character ("Maximus Cluckworth" for the gladiator rooster, "Pip Quickfoot" for the hare courier), and
it stays clear of real people and other games' characters. The owner can rename any of them later; a rename
changes only `name` (the look ID stays). The 2026-11-21/22 batch's labels were renamed this way on 2026-11-22
(each manifest's notes keep the old label), and its time crew got the lead's names.

`content/intake/meshy-queue.json` lists models the owner picked.
`node tools/content/character-manifests.mjs --stubs [ids…]` writes a queued
stub for each queued character or creature that has no manifest yet; fill it
in, drop `status`, and remove the entry from the queue once it ships.

### 2. Get the download

The downloads dir is anywhere outside the repo (say `~/meshy-downloads`). The
importer finds a character's download there by its manifest id or its
`source.file` pattern:
- `<id>.glb`: a rigged GLB (Meshy's auto-rig output: its joints are mapped
  onto ours, no landmarks needed), or one matched by `source.file`. Meshy's
  "All Animations" export names the joints the Mixamo way (`mixamorig:Hips`,
  `Spine`, `Spine1`, `Spine2`, `Neck`, `HeadTop_End`, ...): they are read as
  Meshy's own (its clips are not used; the rig's are);
- an unrigged textured GLB (Meshy's "texture" download, no skin), matched by
  `source.file`: rigged here (below);
- a textured FBX folder (the `.fbx` with its `.png` beside it), anywhere under
  the dir, matched by `source.file` or named `<id>_texture.fbx`: rigged here.

Record which download a manifest takes in its `source.file` pattern (one
download per pattern; the importer says when none matches).

A fresh download of a model already shipped (the owner's T-pose uploads of
2026-11-01: The Visitor, Elder Tomo, Flt. Lt. Ember and Biscuit came back as
textured GLBs of the FBX models they were built from; Biscuit's rebuild waits
on his paws, see HANDOFF.md) is the same character:
widen `source.file` to take it (`…_texture\.(glb|fbx)$`), keep the look ID,
licence and landmarks (they are in units of the model's height, so they fit
the GLB too: check with front and side views), and rebuild with `ONLY=<id>`.
Look before matching by name: the same uploads' Frog in Suspenders, Goblin
and Monkey were different models from Boglurker, the Goblin and Big Bab, so
they became new characters (a pattern that would match both, like Big Bab's
`T_Pose_Monkey_`, is narrowed to its own download).

**Community (CC0) models are downloaded by hand.** Meshy's API only serves
tasks in the key holder's own account; it has no endpoint for community posts.
Download the model from its page (the rigged GLB if it has one, otherwise the
textured FBX) and save it as above.

**The owner's own models** (their `meshy.ai/s/…` share links) are fetched by
task ID: put the IDs in `source.meshy` and run

    MESHY_API_KEY=… node tools/content/fetch-meshy.mjs ~/meshy-downloads [ids…]

It reads each task through the Meshy API (`api.meshy.ai`; the rig task gives
the rigged GLB, otherwise the latest textured stage gives the FBX and its
base colour map) and downloads the files from `assets.meshy.ai`, saving
`<id>.glb` or `<id>/<id>_texture.fbx` and `.png`. Without a key, when Meshy
can't be reached, or for a task that hasn't finished, it says so and why.

### Rigging an unrigged download

Two ways, the first preferred when it's available:
1. **Meshy's rigging API**, with `MESHY_API_KEY` set and the manifest's
   `source.modelUrl`: `fetch-meshy.mjs` (and so `pnpm content:meshy`) sends the
   model to `POST /openapi/v1/rigging` (`model_url`, `height_meters`), waits for
   the task, and saves the rigged GLB as `<id>.glb`, which then goes through the
   rigged path (Meshy's joints mapped onto ours). It prints the task ID: put it
   in `source.meshy.rig` to fetch the same result again later. Meshy rigs
   textured humanoids only; a request it refuses comes back with its message.
   With `modelUrl: "upload"` the download goes up as a data URI; one over 300k
   triangles is cut to 200k first (Meshy failed a 917k-triangle king and rigged
   the same model cut to 150k). A rigging task costs 5 credits.
2. **In-house** (no key, or no `modelUrl`): `prepare-meshy-characters.mjs` cuts
   the mesh to 40k triangles first (meshopt, looser and then sloppy for
   million-triangle downloads), finds the joints from the mesh
   (`tools/content/landmarks.mjs`), and skins it with `autoskin.mjs`:
   - the mesh is drawn into a front view (coverage and depth per pixel);
   - the neck is the narrowest row of the body's middle below the head (kept
     between 0.80 and 0.88 of the height), the crotch the highest row with the
     gap between the legs showing (a coat or robe that hides it: 0.44);
   - each arm is the direction from the shoulder (level for a T-pose, down to
     75° for an A-pose) that stays in the mesh furthest, followed to the hand's
     tip; elbow and wrist at 38% and 74% of its length; the shoulder line is
     lowered until it meets the arm when a collar or cape hides it;
   - knees and ankles are the middle of each leg's run at the usual heights; the
     foot runs from the heel to the furthest toe near the ground.
   `LANDMARK_DEBUG=<dir>` draws what it found over front and side views
   (`<id>.landmarks.png`); `LANDMARK_PRINT=1` prints the landmarks in manifest
   form. When they're wrong, paste them into the manifest's `landmarks`, fix the
   bad points, and build again: the manifest's landmarks replace the found ones.
   Tails, hunched spines (`fixes.lean`) and cloth (`fixes.cloth`) are not found:
   set them in the manifest.

### 3. Build it

    MESHY_API_KEY=… pnpm content:meshy ~/meshy-downloads

builds every manifest not built yet (or `ONLY=<ids>`): it fetches what it can,
then runs `prepare-meshy-characters.mjs` for those characters only (everything
else is kept as built), writes the looks and refreshes `content/provenance.json`.
The steps on their own:
- `ONLY=<ids> node tools/content/prepare-meshy-characters.mjs ~/meshy-downloads`
  builds `packages/client/public/characters/<id>.glb` (body and low-detail
  copy) and `<id>_fparms.glb` (first-person arms), recorded in
  `content/meshy.lock.json`. `SKIN_DEBUG=<dir>` writes the weights to look at.
- `node tools/content/character-manifests.mjs` writes
  `packages/shared/src/content/characters.generated.ts`, the looks and bios
  `looks.ts` reads (`pnpm content:check` fails while it is out of date, a
  manifest is unbuilt or a built file has no manifest).
- `pnpm content:build` refreshes the provenance ledger.

**Hands.** At import every hand is measured and fitted (`tools/content/hands.mjs`):
- measured in the hand joint's space: finger direction, palm centre, length
  from the wrist joint to the fingertips, width and thickness;
- the rig's finger joints moved onto it (knuckles on the knuckle line, the
  thumb scaled from the rig's), keeping the rig's joint orientations;
- the fingers weighted to the rig's finger chains: split into index, middle,
  ring and pinky where the gaps between the fingers show, blended at the
  knuckles and along each finger; a mitten, claw or fused hand curls as one
  wide finger along the middle finger's three joints (it was bent once at the
  knuckle line, which stood the fingers out flat under a handguard); long
  fingers (a frog's, a monkey's) curl further, by their length against the
  rig's, up to 1.5 times; left rigid only when the hand is a
  compact block already closed (a fist: thicker than half its length and less
  than 1.5 times as long as wide, or thicker than 0.65 of its length). A
  relaxed Meshy hand, its fingers a little bent, measures 0.3 to 0.45 thick for
  its length and still bends (it was taken for a fist and left flat on the gun);
- a cuff the skinning left on the hand (a ring at the wrist end, round in
  section and three times as dense as the hand past it: King Aldric's fur
  cuffs, Brass Hare's) is measured out and stays on the hand joint: it had
  held the knuckle line inside itself and curled into flaps;
- vertices far from the hand's core (straps, a cape's edge left on the hand:
  past 1.6 times the 80th percentile of their distance from its centre) are
  left out of the measure and keep their weights;
- the palm side is the rig's (palm down in the T-pose) unless the hand's own
  flat (its thinnest way) disagrees: a hand turned a quarter on its joint (the
  dapper's, the Knight's) takes its flat, facing the body's front;
- the measurements written on the hand joints (`extras.hand`) for the game.

In the game a long gun's support hand cups the handguard over the base of its
fingers (its palm centre sits back from the handguard by 0.22 of the hand's
length, `CUP_BACK`) and closes round it; a pistol's support hand
closes part way round the shooting hand.

**Third-person long guns since 2026-11-20** (owner, "ok fix them all": the support hand sat behind the magazine or
under the gun, the gun out in front of the chest, the hands janky; it had been so since at least v0.9.0):
- **Stock nearer the chest:** the stock's butt may sink `STOCK_SINK` (6 cm) into the body's surface in front of the
  shooting shoulder (the torso's clearance less that); it sat 13-18 cm out along the barrel on the WWII Infantry and
  Big Bogdan.
- **Support shoulder forward:** the body turns `longGunBlade` into the stock (0.3 rad; a gun whose support point is
  more than 32 cm ahead of its grip further, up to 0.6: the shotgun, the sniper rifle), and the support shoulder
  comes up to 10 cm toward the handguard by rolling its collarbone (`reachShoulder`, `SUPPORT_CLAVICLE_MAX`), held
  at 0.96 of the arm's reach (a little bend left in the elbow).
- **On the handguard:** the handguard is measured off the gun's own model under its support point
  (`game/guardUnderside.ts`: a vertical line through the gun's faces, solid by solid; a vertical grip or a bipod
  clamp at the point moves the guard's start just behind it) and followed back while its underside stays within
  3 cm of that height. The support hand slides back along it only as far as the arm still needs and never past
  its end (a magazine, a receiver); a gun still out of reach then comes back into the shoulder (the stock deeper,
  up to 8 cm). The palm lies on the guard's measured underside, half the hand's thickness below it (the support
  point is a point to hold, not on the surface: on the Assault Rifle it is 1.5 cm up inside the wood).
- **Fingers close to their curl, not by it:** each finger joint closes to its share of the curl counted from
  straight (`closeHand`), not that much more on top of the hold clip's bend: fingers already bent folded into the
  palm and turned their skin through itself at the knuckles (the grip audit's flipped triangles, three to five
  times an open hand's). A handguard's support hand closes to 0.6 of the full curl (`LONG_SUPPORT_CURL`): fingers
  up round its side from a palm on its underside. The shooting thumb lies over the grip along its far side
  (`LONG_THUMB`), not stood up beside the gun. A pistol held round its grip in first person keeps its own close.
- **Checked:** the e2e flow `characters4` poses every character in Character Select's pose with the rifle (the
  shotgun on every second, the SMG and the sniper rifle on every eighth) and checks the drawn support hand lies where the animator
  put it on the handguard, within reach and not off the guard's end (`__grips.support()`); the unit test
  `guardUnderside.test.ts` finds a guard under every long gun's support point.

A long gun's barrel line keeps
`HEAD_CLEAR` (0.15 m) from the head's joint: the stock drops (up to 5 cm) where
a big helmet or a short neck put the head by the gun (Capt. Nova).

In the game a hand closes onto the point of the gun it holds (`closeHand`):
the fingers curl whichever way brings their tips toward it, so a hand whose
palm side came out reversed still wraps the gun instead of bending its fingers
up off it.

**The download's own fingers** (`fixes.fingers`, 2026-11-05). A Meshy rig with the Mixamo skeleton can carry finger
chains (`LeftHandThumb1`…`LeftHandPinky4`). Before, they were folded into the hand joint and `hands.mjs` re-fitted the
fingers from the mesh, so a re-rig improved only the body. Now, per side, when the download's chains are whole (thumb
and four fingers, three joints each; the `…4` end markers optional):
- the rig's finger joints go onto the download's (`thumb_01`…`pinky_04_leaf`, rig orientations kept, so the clips and
  the game's curl mean the same), and each finger joint's weights go to its rig joint (an end marker's onto `…_03`);
- `hands.mjs` measures the hand only (palm, frame, size, curl: `extras.hand`, `fingers: 'own'`); nothing is moved or
  re-weighted (`fixes.hands.scale` still applies, and moves the finger and thumb joints with the skin about the wrist;
  `fixes.skin`'s finger options don't);
- the first-person arms shrink the hand about its joint, and the finger joints with it;
- a check before the build falls back to the re-fit for a side where a finger mostly holds fewer than 6 vertices or a
  finger's chain runs back into the hand (the log says which);
- `rehand-built.mjs` keeps a hand built this way (measured only).
Falls back to the re-fit with no chains (a 24-joint rig: Dapper, CRT Robot, Frida, Alien Biker), part chains (thumb
and middle only: Old Timer, Imperial Guard, Zhao, Halvard; a frog without an index finger) or `fixes.fingers: fit`,
which a manifest sets where the grip audit scored the kept weights worse (HANDOFF.md, "Drive intake of 2026-11-05").
The lock records `fingers: own l r` on a build that kept them.

**Arm skin kept to the arms** (`tools/content/armweights.mjs`, opt-in with
`fixes.armCloth: true`): a vertex an arm holds that hangs well below it (past
2.2 limb radii from its bones, clear of the shoulder) is cloth, eased from the
arm's weights to the body's by its share of the way from the arm to the body
ALONG THE SURFACE (eased between 0.3 and 0.8 of the way), taking the weights of
the body vertex nearest along the surface. A coat's side joined to the body
under the arm goes with the body; a wide sleeve, joined to the body only round
the shoulder, stays on the arm. (The first rule, 2026-10-31, took the nearest
body vertex in a straight line: wide sleeves by the hips went to the hips and
grew wings from the arms, Giggles' and the Dust Trooper's.) As of 2026-11-01 no
character needs it: the audit's spikes are in the legs (a tabard or coat
between them: the Iron Knight, Ser Brannock), the armpits (Big Bogdan, the
Dapper) and low-detail fingers, which it does not touch. The audit reports
spikes by joint (`stretch.by`).

**Skin cleaned in the download's pose** (`tools/content/skinclean.mjs`, opt-in
with `fixes.skinClean: true`; rigged and unrigged downloads alike, in
prepare-meshy-characters.mjs `pose()`). Most Meshy downloads stand with their
arms down, hands on the hips and wide sleeves against the body, and their
weights leak across those contacts (hand vertices partly on the hips or a
thigh, a sleeve's inside partly on the spine). Turning the arms out to the
T-pose dragged those vertices part of the way between arm and hip: long sheets
and strands from the hands to the hips, already in the built bind pose (so the
grip audit's stretch test, which compares the hold with the bind pose, never
saw them). The pass, before the turn: whose skin each arm-held vertex is (skin
faces away from its own bone: a sleeve's inside faces the body; the body's side
under a hanging arm faces the arm, when that patch is joined mostly to the
body; else the nearer bone); only joints within two of its anchor on the rig's
skeleton keep a share (a hand never keeps the hips). After the turn, triangles
reaching a forearm or a hand that stretched past 3x their length (a fingertip
fused to a thigh, a cuff to the hip) are torn out and each hole closed with a
flat fan; the upper arm's skin to the body (armpits) is never torn. Used by
Giggles, the Dust Trooper, Goblina and Luther Vanguard. Not on by default: on
Freaky Frida it pulled pigtails hanging by her shoulders into strands, and it
put a flap on Kenji's vest side (both already fixed by hand-set landmarks and
`armCloth`). Check a character in its download pose with the weight pictures
(any rest mesh coloured by limb) before turning it on.

**A look's own skin weights** (`fixes.skin`, `tools/content/skinfix.mjs`; owner-approved 2026-11-04). For a
fault the shared weighting leaves on one look's hands or cloth, that look's manifest sets its own weighting; a look
without `fixes.skin` is weighted exactly as before. Set from before/after shots (rifle and pistol: 3/4, each hand
close, side, front) and the grip audit, and kept only where the shots are clearly better (HANDOFF.md, "Hands round
4"). The finger options go to `fitHands` (hands.mjs) and so are applied afresh on every build and rehand; each takes
both hands or one (`l` / `r`):
- `tips` (0–0.5): skin past the knuckle line that the hand's core measured out as a stray (a long fingertip) is
  weighted as its finger, up to this share of the hand's length past the fingertips. Zombie Soldier A's right
  middle fingertip stayed on the hand while the rest of the finger curled: a 40x "needle" (`tips: 0.3`).
- `knuckle` (0.02–0.3, default 0.1) and `joints` (0.02–0.3, default 0.08): how wide the blend from the hand to the
  fingers, and between a finger's joints, is (shares of the hand's and of the finger's length).
- `lanes` (0–1): skin within this share of a finger's width of the boundary between two split fingers is shared by
  both (half each on the boundary), so neighbouring fingers don't tear apart (the Iron Knight's gauntlet: `0.8`).
- `fingers: 'lanes'`: fused fingers (no gaps to find) split evenly across the hand into four.

The body options run after the hands, once (a file records them as `extras.skinFix` on its skin, and
`rehand-built.mjs` does not apply the same ones again; to change them, start from the file before them):
- `hops` (1–4): influences of joints further than this many steps along the skeleton from the vertex's own joint
  are dropped (a belly held by a thigh and a collarbone at once). Low values tear blended skin (a belly half on the
  spine, half on a thigh): Croakley at `hops: 2` stretched 120x; not used.
- `clamp` (0–0.3): influences under this weight are dropped.
- `smooth` (`{ joints: "<regex>", passes: 1–8 }`): the weights of vertices those joints hold most are evened with
  their neighbours' (texture seams joined). The Iron Knight's tabard flipped from one thigh to the other between
  neighbouring vertices and tore open between the legs: `{ "joints": "^(thigh|calf)_", "passes": 6 }`.
- `wrist` (`{ until, band }`, shares of the hand's length past the wrist joint): the skin up to `until` rides the
  forearm alone, easing back to the hand over `band` (a cuff or bracelet twisting with the hand).

A hard part the download's rig spread over several joints (a back pack held partly by the arms, the neck and the head)
is bound whole to one joint with `rigid` (`bindRigid` in skinfix.mjs; 2026-11-06, Starfarer's pack). Unlike the body
options it runs in the download's own pose, before the build turns the arms out to the T-pose (`pose()` in
prepare-meshy-characters.mjs): that turn had already dragged the pack's lower corners out with the arms in the bind
pose. So only a build from the download applies it; `rehand-built.mjs` keeps what the file has.
- `rigid`: `[{ joint, box, blend, except }]` (1–4 regions). `joint` is the rig joint the part rides (`spine_03`, the
  chest). `box` is one box `[x0, y0, z0, x1, y1, z1]` or a list of up to 8, in shares of the download's height in its
  own pose: feet at 0, x and z from its origin, +x its left, +z its front (the `landmarks` frame; read them off the
  download's back and side views). Every vertex inside is held by `joint` alone. Outside, a vertex within `blend`
  (0–0.1 of the height, 0.03 unless set) eases from its own weights to the joint, so the skin round the part has no
  hard edge. `except` is a pattern of rig joints: a vertex held most by one is left as it is (the helmet's back
  where the pack's tank sits against it: `^Head$`). The build log says how many vertices it bound and eased.
  Starfarer: the pack box and the tank above it, `blend 0.025`, `except: "^Head$"` (1315 bound, 377 eased).
  Fishy Fred (2026-11-07): the download's rig held the fish's face on the left collarbone and the rest of the fish on
  the head. Two regions: the fish to `spine_03` (two boxes, the hips spared), then its face to `Head` (`blend 0.1`), each
  `except` the legs, arms, hips and lower spine, with `smooth` over the spine, hips and head. The head sphere is then
  the face (0.30 m, was 0.55 m round the whole fish) and the fish is body; no stretched edges standing, aiming or running.

`rehand-built.mjs` applies `fixes.skin` to a built file (`ONLY=<ids>`); `SIDES=r` (or `l`) refits only that hand,
the other kept as built (a refit from the built file measures a hand a little differently from the download, so a
fix for one hand needn't move the other: Zombie Soldier A).

**Head and hands keep their detail** (`cutKeeping` in `tools/content/meshy-mesh.mjs`):
both cuts (an unrigged download's work cut to 40k triangles, and the final
cut) keep at least 12% of the budget for the head and 4% for the hands, cut
apart from the body (never sloppily) with the vertices on their edges locked.
A realistic body cut by error alone from a million triangles had kept a face
of 133 triangles and hands of a few dozen (Lancer Mei, Merrow the Wise).

The log prints each hand's size and what it got (`split`, `mitten`, `none`).
For an odd model, `fixes.hands` overrides: `palm` (`[x, y, z]` in the hand
joint's space, metres), `curl` (0–1.5, how far the fingers close; 0 for paws
that can't close, as Teddy's balls), `scale` (shrink or grow the hand about the
wrist), `wrist` (true: the skin past the wrist joint rides the hand alone, none
of it eased into the forearm; Biscuit's stubby paws folded at the wrist when the
hand turned hard onto a gun pointed at the ground), `mitten` (true: the fingers bend
together even where gaps were found; a thumb or fold read as a gap crumpled a split
hand into shards: Honest Abe's and Virtua Soldier's right hands), `together` (0–1, written on the hand for the game:
as the hand closes, its fingers come in toward the middle finger by that share of their spread, in every view; a
download's own fingers can be fanned wide, and closed as they lay they stood apart round the grip like a claw: Frost
Viking's 23 degrees from index to little finger, the Goblin Warlord's 20), for both hands or one (`l`, `r`). `graft`
(`true`, or `'l'` / `'r'`: **new hand geometry**, `tools/content/handgraft.mjs`, 2026-11-17): the hand is replaced by
the rig's own, the athlete body part's (Quaternius Universal Base Characters, CC0, as shipped), fitted to it. A
low-poly Meshy hand (a few long slivers per finger, cut that way from the download) folded into shards when it closed,
whatever its weights: blends, lanes and curls only softened it (HANDOFF.md, "Hands round 5"). The donor hand is laid
in the old hand's joint frame as it sits in its own (so the clips' finger poses and the game's curl bend it as the
rig's), sized to the old hand's measured length and width (its thickness in proportion: a measured thickness counts
relaxed, half-closed fingers), subdivided once (Loop's rules, weights and normals blended: the donor's own fingers are
six-sided and closed they read as blocks; `GRAFT_SMOOTH`), skinned with the donor's finger weights and the rig's
finger and thumb joints moved onto it; the old hand's triangles go (those the hand chain holds at least half). Its
surface is the old hand's own: each new triangle reads the character's map through the old hand triangle nearest it
(its corners projected onto that triangle and kept inside it), so a glove keeps its weave and a skin its tone and
mottling (an early version took one flat colour: owner, 2026-11-17, "plain grey"). About 1,500 triangles a hand
(the far copy keeps the donor's own, not subdivided). From then on the hand is measured only (`fingers: 'own'`).
`rehand-built.mjs` applies it to a built file, the body and the first-person arms, once (`extras.graft` on the skin;
the lock's `graft`; provenance names the hands' source); a rebuild from the download brings the download's hands
back, and `prepare-meshy-characters.mjs` says to run `rehand-built.mjs` for it. On Alien Biker, Beanie Alien, Luther
Vanguard, Agent Zhao and Anoobys (whose mitten paddle also curled away from a rifle's handguard), all with
`curl: 0.7`. In full-body first person a closed grafted hand reads lower on the audit's pistol palm (`sideR`, from the
hand's thinnest way: a fist has none): 0.5-0.7 closed against 0.8 open; Vanguard's 0.13 (its narrow hand). A rigid
gauntlet (`fingers: none`, curl 0) given a `curl` is skinned as a mitten that closes on the grip. The Iron Knight's
gauntlets (own fingers since its Iron Warden model) measure thick for their length, which caps the curl at 0.5; it has
`fixes.hands.curl: 1` (2026-11-06: they close round the grip in both views).

**The gun inside a hand** (2026-11-17). The grip audit measures, per weapon and hand, third person and full-body
first person, how far the gun goes into the hand as drawn (`tools/gripInside.ts`, `__grips.inside()`; summary.md's
last column, the pistol's): the hand's skin inside the gun (vertices behind its nearest face, how deep) and the gun
inside the hand's skin (points on the gun's faces, by ray parity, how deep). Measured, not flagged. The grafted hands
(`graft` above) sat their palms in the pistol's grip in third person, its panel showing through the palm (owner,
2026-11-17): each look's `gripPistol` (about 5 cm out along the palm, `[0.05, 0, 0]`; Alien Biker 0.065), `supportPistol`
moved left off the grip, and `gripLong` / `supportLong` for the rifle and shotgun put the palms on the grips' surfaces
(HANDOFF.md for the numbers). First person reads none of a look's grip settings. `__grips.tune(look, { grip, hands })`
tries a look's GripTune and measured hands live before a manifest is written.

**Hand size against a gun.** A hand much bigger than a grip swallows it, worst in first person (Frost Viking's and the
Goblin Warlord's own hands were 24-28 cm long and 19-21 cm wide, splayed). `fixes.hands.scale` shrinks one at import
(prepare-meshy-characters.mjs, from the download; rehand-built leaves the scale out, as a built hand was scaled
already): about 20 cm long suits a 1.8 m body (Frost Viking 0.8; the Goblin Warlord right 0.75, left 0.85, its hands
were uneven). A hand with the download's own fingers keeps its finger and thumb joints in step: they are scaled about
the wrist with the skin (left where the download had them, the fingers curled about points past the shrunk knuckles,
a claw that folded its low-poly fingers into shards). A smaller hand closed fully can fold into shards too: soften it
with `curl` (Frost Viking's right 0.6, left 0.75).

`node tools/content/rehand-built.mjs` (`ONLY=<ids>`) does the same to
characters already built, from their shipped files, when the downloads
aren't at hand: it re-skins the hand region in place (and, with
`fixes.armCloth`, eases arm cloth to the body: armweights.mjs), cuts first-person arms from the body for a character
without them, and updates the lock (then run `pnpm content:build`). Running it
again changes nothing. `OUT=<dir>` writes the files there instead (a trial;
the lock is left alone).

### 4. Check the grip sheet and the grip audit

    pnpm build && pnpm --filter @tiletrigger/client exec vite preview --port 4860
    node tools/content/grip-audit.mjs http://localhost:4860 <out dir outside the repo>

The **grip audit** renders every player character holding the rifle, the pistol,
the Spin Gun, the shotgun and the Spear in the Character Select pose, from the side and the front,
measures each hold as drawn (`__grips.audit()`, `tools/gripAudit.ts`: finger
weights per hand, fingertips against the grip with the hands open and closed
(the curl test), elbow bend against the arm's own skin, the gun against the
head and shoulders, arms across the midline, stretched skin edges, which way
each drawn palm faces: the `palm` flag, see "Which side is the palm") and writes
`audit.json`, a ranked `summary.md` and contact sheets (`sheet-<n>.png`,
`<id>.png`). Judge a gun "at the face" from the side: front views foreshorten
a rifle pointed at the camera. `ONLY=<ids>`, `NO_SHOTS=1`, `NO_FP=1`,
`RESUME=1` (it saves after every character) and `RESCORE=1` (flags again after
changing a threshold); `WEAPONS_ONLY=rifle,pistol,shotgun,spear` measures only
those (a run of every weapon takes about 75 s a character on a busy machine) and
`AUDIT_PX=400` renders a smaller page (software GL is pixel-bound). `summary.md`
ends with each character's flags per weapon. `window.__grips.closeUp(joint,
alpha, beta, radius)` frames one joint (a support hand) after a third-person pose.

The per-character sheet:

    pnpm build && pnpm --filter @tiletrigger/client exec vite preview --port 4860
    ONLY=<ids> node tools/content/grip-sheet.mjs http://localhost:4860 ~/grip-sheets

writes `~/grip-sheets/<id>.png` (outside the repo): the character holding a
pistol, a rifle, a shotgun and a knife, in third person framed on the hands
and in first person as the game draws it (`?mode=grips`, the game's own
renderer). Look for palms on the grips, fingers round them (not through the
gun or splayed in the air), the support hand on the handguard, and in first
person, sleeves that don't cover the sights. Fix a bad hand with
`fixes.hands` and build again. For posture, the same page frames the whole body
after a pose: `window.__grips.body('side' | 'front' | 'feet')` (side-on is
where a hunched back or toes-up feet show), and `window.__grips.joints()`
gives the posed joints' positions. A hunched body gets `fixes.lean`
(Bonesworth: 4, 6, 6 and 16 degrees on Spine02, Spine01, Spine and neck). `?mode=characters&looks=<look>` shows the
character with every clip.

### 5. Ship it

- Commit the manifest, the built files, `content/meshy.lock.json`,
  `content/provenance.json` and `characters.generated.ts` (never the
  downloads). For a community model, add it to the licence file's list
  (`assets-src/meshy-community-characters/License.txt`).
- Run `pnpm content:check`, `pnpm typecheck`, `pnpm test:changed` and the
  `characters` and `designer` e2e flows.
- Capture its portrait (the **Capture portraits** workflow) once it's on `main`.

## Known gaps

- The ranger boots barely simplify (their texture seams stop the simplifier),
  so a distant full ranger is still about 7.5k triangles.
- More outfits and era costumes on the same rig. The free pack editions hold
  only the Ranger and Peasant outfits; the other ten are in the paid Source
  editions.
- NPCs use the plain mannequins in faction colours until faction outfits exist.
- The aliens have no walk, attack or death clips of their own (procedural
  motion stands in).

## Hitboxes

Shots are tested against each look's own **hit shapes**, measured from its model (owner, 2026-11-04: exact per-look
hitboxes, no evening-out within a size class; small or thin looks are harder to hit). `packages/shared/src/sim/hitbox.ts`.

- **The shapes:** a head sphere; a torso capsule squashed across the body (`w`, half its width, against `r`, its
  depth, so a broad body is wider than deep); a round capsule for each thigh and each shin (with its foot), so the
  gap between the legs and a stride are not body; and an arm capsule only where an arm sticks out of the rest
  (mostly the forearms on the gun). Creatures get their own (an alien without legs or a head has none of those).
- **Margin** (owner, 2026-11-04: generous padding): every shape is tested `HITBOX_MARGIN` larger (constants.ts:
  `body` 0.18 m on the torso, legs and arms, `head` 0.12 m on the head sphere; metres at a 1.8 m body, scaled with its
  size), so players hit about as often as on the old 0.8 m capsule and TTK stays where it was (tuned on the duel,
  weapons, ballistics and bot-aim tests, which pass with main's thresholds). Each look keeps its own proportions: a
  standard chest is 0.68 × 0.62 m with the margin (0.32 × 0.26 measured), its head 0.50 m across (0.26).
- **Zones:** a round strikes the nearest padded surface; its zone is the shape whose own (unpadded) core the line
  passes deepest into or nearest to: head sphere = head (×`head`), thighs and shins = legs (×`legs`), torso = body (1.0×),
  arms = arms (×`arms`, 0.9 for every bullet family; 2026-11-17, GUNPLAY_SPEC §11). A shot at the face over a padded
  forearm is a head shot, one at the belt a body shot, one through a forearm into the chest a body shot, one that
  clips a forearm held out and misses the chest an arm shot. No height bands
  (the old fixed 0.32 m head band was a third of a small look's height).
- **Stance and size:** standing, crouching and prone each have their own shapes, measured in the pose the game draws
  (below). They turn with the body's yaw and scale with its size (the size class, or a `size` stat). The game has
  no lean input; a hunched body's lean (`fixes.lean`, Hyena, Croakley) is in the model, so its shapes have it.
- **No animation per frame:** the host has no skeletons. The shapes are the clip's first frame, the same everywhere.
- **Lag compensation** records each body's feet, yaw, stance, scale and shapes; a rewound shot is tested against
  exactly what was there (`Match.targetsFor`). Bullets in flight rewind less each tick, as before.
- **Melee** keeps its forgiving reach capsule (`PLAYER.radius` at the body's size): a swing is a sweep. Thrown and
  launched projectiles (spears, rockets, grenades, discs) are `PROJECTILE_THICKNESS` (0.12 m) thick against bodies,
  on top of the margin; a sticky grenade sticks on the body (within 0.25 m of its middle), not out on the margin.
- **Not hittable** (owner, 2026-11-04): tails, capes' hems and hat brims (they are left out of the shapes). Crouched
  shapes may sit up to ~8 cm sideways of the drawn body (accepted).
  Medkit and ping aim keep their generous capsules.
- **Bots** aim at the real head (the head sphere's centre) and the middle of the real chest (`bots/aim.ts`); with
  the margin their aim error is as before and each difficulty hits as often as on main (botai.test.ts).
- **NPCs:** a creature is hit as drawn (its own shapes in its own metres); an NPC drawn as a character look uses that
  look's shapes at the role's scale; soldiers the male or female mannequin (as the client picks, by id); zombies the
  zombie body or the mannequin. A player in a creature skin uses the creature's shapes fitted to a player's height.
- **Movement collision is unchanged:** the player collider is still the 0.4 m capsule (physics.ts).

**How they are measured** (`tools/content/hitboxes.mjs` → `packages/shared/src/content/hitboxes.generated.ts`;
`pnpm content:check` fails while it is out of date, `pnpm content:rebuild` rewrites it). Each look's model (a whole
body, or a part-built look's head, parts and hair; custom designs use their body's mannequin) is posed in Node
(`tools/content/skinpose.mjs`) as the game draws it, holding a gun: standing `aim_idle`; crouching `crouch_idle`'s
hips and legs, the chest, neck and head three quarters of the way to the aim pose (`CROUCH_AIM`: the animator layers
the aim pose over the upper body and the hold lifts the gun to the eye) and the standing arms carried with the head;
prone `prone_idle`. Crouched, the drawn upper body also turns a little toward the gun, so crouched shapes can sit a
few centimetres off sideways. Its vertices are
grouped by the joint holding them (head, torso, thighs, shins, arms) and fitted: the head sphere holds 80% of the
head's vertices (ears, horns and brims stick out) and stands no higher than the head; the torso's axis follows its
own line, and vertices far from the spine (a tail, a cape's hem) are left out. Everything is in metres at a 1.8 m
body (the game fits every character's rest height to 1.8 m), creatures in their drawn metres.

**Overrides** in the look's manifest (`content/characters/<id>.json`), applied to every stance:

```json
"hitbox": { "head": { "r": 0.13, "dy": 0.02, "dz": 0.01 }, "torso": { "w": 0.24, "r": 0.15 }, "legs": { "r": 0.08 }, "arms": false }
```

`head.r`, `torso.w`/`r` and `legs.r` are absolute (m at 1.8 m), `dy`/`dz` move the head, `arms: false` drops them.
Then `node tools/content/hitboxes.mjs`. None are set yet.

**Seeing them:** Options → Display → **Show hitboxes** (only on a dev server, a test build or a page served from
this machine), or `?hitboxes=1`: every body's shapes over it in a match (head red, torso yellow, arms green, legs
blue), and a faint shell round each with the margin that shots are actually tested against. The character viewer (`?mode=characters`) has **Hitboxes** and **Stand / Crouch / Prone** buttons
(`&hitboxes=1`; `window.__charHitboxes(on, stance)`).

**The audit** (`tools/content/test/hitboxes.test.mjs`, in the unit tests): for every look and creature, posed
standing, the shapes' top within 0.1 m of the model's (a pointed hat may stand 0.12 m over the head), their bottom
within 0.12 m of its feet, the head sphere's centre within 0.1 m of the drawn head's middle, and at least 85% of
the model's vertices inside the shapes with 4 cm of slack (creatures 70%). `HITBOX_AUDIT=1` prints every look's
numbers. The same file checks shots at the drawn heads of a short, a tall and two hunched looks.

**Cost:** a shot against 96 bodies is about 8-12 µs (a bounding-sphere test rejects almost every body; the old
capsule test was 13-19 µs); `HITBOX_BENCH=1 npx vitest run packages/shared/test/hitboxPerf.test.ts`.

## Character stats

A look may set its own stats in its manifest (`stats`), each optional; one left out is its size class's value, so
nothing changes until a field is set (`packages/shared/src/sim/characterStats.ts`):

| Stat | Range | Without it | Wired into |
|---|---|---|---|
| `health` | 50–200 | size class: 85 / 100 / 115 | health on spawn, the most pickups give |
| `speed` | 0.8–1.25 | 1.06 / 1 / 0.94 | movement (and now client prediction) |
| `size` | 0.7–1.3 | 0.78 / 1 / 1.18 | body, collider, eyes and hit shapes (as the class scale) |
| `damage` | 0.75–1.3 | 1 | damage dealt by everything but melee |
| `stamina` | 0.5–2 | 1 | sprint stamina drains this many times slower |
| `jump` | 0.8–1.3 | 1 | jump speed (and a class's double jump) |
| `melee` | 0.5–2 | 1 | damage dealt by knives, axes, punches and kicks |
| `armor` | 0–0.4 | 0 | share of incoming damage shrugged off (before armor pickups) |

```json
"stats": { "health": 120, "speed": 0.95, "armor": 0.1 }
```

The match setting **Character stats** (On / Off; `MatchRules.characterStats`, setup `stats`, host rule `stats`)
off ignores every look's own stats: everyone plays their size class (owner, 2026-11-04: it doesn't touch size classes;
Character sizes: All equal makes everyone standard).
Character Select shows a look's stats as bars (each across its range, a mark at standard; green above, amber below)
while the match setup has stats on. The Workbench's **Characters** collection edits them. The manifests' checker
keeps its own copy of the ranges (`STAT_RANGES` in character-manifests.mjs; a test keeps them equal). Speed, jump
and stamina reach the predicting client in the private state (`bs`).

## Random characters

The match setting **Random characters** (Off by default on every map; in Match Setup it is the **Roulette Bodies** variant, there is no separate Rules row since 2026-11-12; `MatchRules.randomCharacters`, setup
`randomChars`, host rule `randomchars`): everyone, people and bots, plays a random look each life, any on the roster
(`PICKABLE_LOOKS`: playable, not retired, core tier; never NPC-only bodies, NPC skins or experimental characters). The pick hashes the match seed, the slot
and the life (`sim/randomLooks.ts`: the same every replay, never the look just played); the look travels in the
`spawn` event (and the roster for anyone joining later), and its size, stats and hit shapes go with it. Off again,
each plays their own choice from their next life. It works with Character stats on or off.

## Character sizes

Every look is small, standard or large (`size` on the look; custom looks add
`-s` / `-l` to their ID, and the Character Designer has a Size choice on the
Body tab). Presets: Sprout (retired) was small, Bulwark is large, everyone else standard.

| Size | Body (height, width, eyes) | Speed | Health |
|---|---|---|---|
| Small | × 0.78 (1.40 m tall) | × 1.06 | 85 |
| Standard | 1.80 m | × 1 | 100 |
| Large | × 1.18 (2.12 m tall) | × 0.94 | 115 |

The body size scales the hit shapes (see Hitboxes) and the collision capsule, so small characters
are harder to hit and fit through gaps others must crouch for (a 1.6 m
ceiling, a low window), and large ones are easier to hit and must crouch
under openings a little over 2 m. A look's own `size` stat (Character stats) replaces its class's scale. Health pickups fill up to the size's
health. The match setting **Character sizes: Matter / All equal**
(`MatchRules.bodySizes`) makes everyone play and look standard.
Character Select and the Character Designer draw each look at its size too (a small look at 1.40 m, a large one at
2.12 m), as a match does.

## Portraits

Character Select, the player badge and the HUD show a portrait of each look,
rendered from the 3D character by `client/src/frontend/portraits.ts`: head
and shoulders, framed from the neck joint up to the top of the model and
centred on the head joint (any body shape), three-quarter from the front;
creatures whole. The built-in looks' portraits ship with the site
(`client/public/portraits/*.webp`, listed in `frontend/portraitIndex.ts`) so
the menu shows them at once. A look whose face the default framing hides or
leaves off centre gets its own view in `PORTRAIT_VIEWS` (portraits.ts): `from`
(where the camera sits from the face), `aim` (a nudge of the aim point) and
`zoom` (the frame's size against the default); `__front.portraits.renderLive(look,
view)` tries one without a rebuild. They're made by the **Capture portraits**
workflow (`tools/content/capture-portraits.mjs`, the same renderer), which
commits them to `check/portraits`; run it after adding characters or changing
the framing. A look without a shipped portrait (new since the last capture,
or a player's own design) is rendered live in the browser, as before.

## Linktifa and Sprout retired (owner, 2026-11-24)

"Let's just retire linktifa and sprout." Both leave Character Select, random bots, Random characters, Roulette and the bot
themes (`RETIRED_LOOKS`; files, manifests and portraits kept). A saved pick, setup or bot set that names one plays a kept
look of the same group: Linktifa (`core.ranger`) is **Honest Abe** (`core.abe`, Legends), Sprout (`core.sprout`) is
**Lancer Mei** (`core.mei`, Everyday Folk). Every older retirement that led to either now leads straight to Abe or Mei
(one step). The Character Designer keeps Linktifa's modular body as its base (`DESIGNER_BASE_LOOK`, used by "Design new"
from a whole-body character), so custom characters keep working. `DEFAULT_LOOK` is now only the sim's fixed fallback (the
first pickable look); a new player with no saved pick gets a random pickable one (`randomFirstLook`), saved like any pick so
it stays; browser tests (`?test=1` or any automated browser) keep the fixed default.

## More retirements and neighbours (owner, 2026-11-24)

Retired the same way (`RETIRED_LOOKS`; files, manifests and portraits kept), each resolving to a kept look of its group:
Astronaut Explorer -> Spacewalker, Neon Shadow Ninja -> Shadow Enforcer, Neon Guardian -> Star Voyager, Bill the Barbarian
(`core.hector`) -> Cal, Brass Hare -> Biscuit (and the Wealthy Otter's old retirement now leads there too), Big Bab ->
Gorilla G, Shellback -> Coach Hank Shelton (Bamboo's retirement too), Giggles -> Teddy. The Dummy is the trooper NPC
skin (`npc:trooper`): off Character Select (`PLAYER_NPC_LOOKS`), a saved pick plays Stealth Operative (`RETIRED_LOOKS`,
read by `validLookId` before the NPC-skin check); the trooper NPC role, training targets included, keeps its mannequin.
`DEFAULT_LOOK` (the sim's fixed default and `getLook`'s fallback) is Cal, a kept look; the Designer's base stays Linktifa's
body (`DESIGNER_BASE_LOOK`). Character Select's neighbours are one list, `CHARACTER_NEIGHBOURS` in
`looks.ts`: each list sits together where its first member falls in the section's order (Freaky Frida and Scary Larry;
Dog Tag Doyle, Grinning Gus, Zombie Soldier A; Groaner, Shambler, Fearsome Undead; Rattles, Count Bonesworth; Mummy Bot,
Pharaoh Mummy Warrior; King Aldric, Old King Halvard; Imperial Guard, Lancer Mei). Browser tests use Cal as the fixed look.
The e2e flow `slidepeek`'s online part starts Alice and Bob at fixed spots on void_yard's open floor (the dedicated
server's `E2E_START_AT`, tests only) instead of wherever the clock-seeded match spawned them.

## Characters of 2026-11-25 (owner)

The owner's Drive uploads of 2026-11-24/25 (rigged and animated Meshy downloads, Mixamo joint names; Meshy, owned, the
standing rule for the owner's Drive characters), built as the 2026-11-22 batches were (`fixes` 11k triangles, or a
rebake at 12k for one over the 1.8 MB budget; grips from the auto-fit; portraits captured). Core tier, as the roster has
been since 2026-11-24. Names are the lead's (personal names, "Names" above; the download's label is in each manifest's
notes); the owner can rename any.

- **Chrono Crew:** Blix Orrin (`core.crewalien`, "crew alien recruit") and Juno Hartwell (`core.crewpilot`, "crew pilot
  v2"); Clio Everwhen joins; Fuse Hollister to Machines; Clio and Sarge first (see Collections).
- **Model swaps, id, name and place kept** (as Shiba's and the Salamander Warlord's): Pip Quickfoot (a her: `body: female`, owner 2026-11-25; "hare courier clean
  game ready"; still small, still first in Animalia), Anoobys ("AnubisSentinelRigged"; the community Anubis no longer
  ships) and Thornweaver ("PlainsHuntressRemesh15k", the plains huntress; the community Tribal Warrior no longer ships;
  the name fits, so the character keeps it rather than a retirement through `RETIRED_LOOKS`).
- **Soldiers & Spies (Army):** Cpl. Tinwhistle (`core.toysoldier`, the toy soldier) and Pvt. Pete Plastic
  (`core.greenarmy`, the green army man).
- **Legends:** Silas Coilwhisper (`core.snakeshaman`, "SnakeEyeShaman"), Talon Skycrest (`core.eagleclan`, "EagleClan"),
  Balam Nightclaw (`core.aztecjaguar`, "AztecJaguar"): the Aztec period's people (docs/STORY_CAMPAIGN.md); and Ignatius
  Slagg moved here from Horrors & Creatures.
- **Everyday Folk:** Cutter McCrae (`core.outlawranger`, "OutlawRanger").
- **Animalia:** Fenn Dustwhirl (`core.fennec`, desert rally fennec, small), Kiko Banyan (`core.monkeyspirit`, monkey
  spirit; bleeds spirit), Deuce Droopwell (`core.blobfish`, Vegas dealer blobfish), Ottis Crema (`core.baristaotter`,
  espresso barista otter, small), Boogie Tuskworth (`core.warthog`, funky biker warthog, large), Det. Drake Montego
  (`core.detectiveduck`, Miami detective duck), Napsworth (`core.koala`, sleepy koala, small).
- **Elder Tomo's new model** (owner, 2026-11-25: "use it"; built in the fix batch `wip/fixes-20261125`): "elder tomo
  rigged" (2026-11-25, Meshy, owned) replaces the community "Elder T-pose" (no longer shipped); id, name, size and place
  kept; rebaked at 12k (10.4k after the seams close), grips auto-fitted (no outliers), a new portrait.

### Bosses, parked

The three Chrono Crew story bosses (docs/STORY_CAMPAIGN.md, "Bosses"; provisional names: Emperor Kronax
`core.bosstyrant`, The Unhour `core.bossvoid`, Inquisitor Vesk Tockley `core.bossinquisitor`) are built like any
character but kept out of play: `use: "npc"` (an NPC-only body: `WHOLE_BODY_NPC_LOOKS`, not on the roster, so not on
Character Select, never a bot's, a random or a Roulette pick; a saved or typed id falls back as an unknown one does) and
`tier: "experimental"`, and no NPC role (`NPC_ROLE_SPECS`) names them. Bringing one in is naming its look in a role or
moving it to `use: "player"`.

