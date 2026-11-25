# Story campaign: the owner's notes

Owner's notes, 2026-11-24. A direction to build toward, not yet a plan: the owner is writing the story, and the maps get "mapped out" against it (current maps and future ones).

## The shape

- **A storyline across time periods and themes.** About **3 maps per period or theme** (for example Aztec / Mesoamerican, ancient Egypt, medieval, modern, future, space).
- **Map challenges unlock the next map** in the story or timeline. Each map has its own challenges.
- **Bosses.** Each period's thematic characters are harder to kill, and some are bosses. Example: the Aztec maps lead to a boss fight with the sun characters (Aurelio, the Sun Warrior).
- **Start:** 5 maps unlocked, and only the Chrono Crew.

## The Chrono Crew is the player's team

- The player uses the Chrono Crew through the whole storyline.
- Today there are **13**, with a 14th place kept (owner, 2026-11-25): **Clio Everwhen** and **Sarge Tobias Crane**, the team's #1 and #2 (first in Character Select's Chrono Crew section), then Dex Calloway, Doc Seraphine Vale, Flicker, Gears Okafor, Juno Hartwell (the pilot), Lyra Vantis, Mags Petrov, Nova Kade, **Rocco Tickwell** (the K9: "the K9 is new chrono member"), Vesper Quill and Wren Halloway. Fuse Hollister left the crew for Machines, and Blix Orrin (the alien recruit) for Outer Space. **The 14th place is the Inquisitor's**: Character Select shows it as an **Unknown** tile until the story unlocks him (a data hook, `COLLECTION_RESERVED_PLACES` in looks.ts; the unlock comes with the campaign's rules).
- **Team management:** the player swaps team members out for characters they've unlocked.

## Bosses (owner, 2026-11-25)

The story's bosses, from the owner's Drive uploads of 2026-11-25 ("boss chrono tyrant", "boss void rift entity", "boss temporal inquisitor"). **Names are provisional** (the lead's; the owner names them for the story). Built into the game like any character (manifest, model, hit shape, grips), but **out of play for now**: each is an NPC-only manifest (`use: "npc"`, `tier: "experimental"`) that no NPC role names, so none is on Character Select, a bot's, a random or a Roulette pick, and a saved id falls back to the default look. To bring one into a fight, an NPC role or a boss rule names its look (docs/CHARACTERS.md, "Bosses, parked").

| Boss (provisional) | Look id | Model | Size | Ideas from the model |
|---|---|---|---|---|
| Emperor Kronax | `core.bosstyrant` | boss chrono tyrant rigged | large | the Chrono Tyrant: the crew's arch-enemy, the end of the line |
| The Unhour | `core.bossvoid` | boss void rift entity rigged | large | a thing from the rift between times; bleeds spirit |
| Inquisitor Vesk Tockley | `core.bossinquisitor` | boss temporal inquisitor 15k | standard | the time police: hunts unlicensed travellers, a mid-story boss |

**The crew's 14th (owner, 2026-11-25: "Maybe their 14th is unlocked. We have a boss that is humanish, maybe the story completes and he joins the crew as a good guy").** Owner's answer (2026-11-25, with the K9): Blix Orrin leaves for Outer Space, so the crew is 13 and the Inquisitor is its 14th. The humanish boss, Inquisitor Vesk Tockley (`core.bossinquisitor`, standard size), turns good when the story completes and joins the crew as its 14th, unlocked by finishing the campaign. Until the campaign's unlocks exist he stays NPC-only as above; the unlock then gives him a roster place in the Chrono Crew section, with a good-guy name and bio from the owner.

## Characters by sector (owner, 2026-11-25)

Until the campaign's sector data exists, the sectors' own characters are listed here (the campaign framework moves them
into its data):
- **Mesoamerica:** Balam Nightclaw, Talon Skycrest, the Sun Warrior and Aurelio Dawnmantle (the boss encounter; owner
  2026-11-25), and **Tetl Stonewarden** (`core.basaltguardian`, the Basalt Guardian: "Basalt guardian is for
  mesoamerica"), large, bleeds stone: a sector ally, an unlock or a guard on the boss map.
- **Wars:** Civil War: Capt. Elias Harrowgate (`core.unionofficer`) and Col. Josiah Beaumont (`core.rebelcommander`);
  Vietnam: Pfc. Danny Okerlund (`core.vietnamsoldier`) and Lien Vo (`core.vcscout`) (2026-11-25); WW2: WWII Infantry and
  the Army soldiers already on the roster.

## Unlocking characters (ideas, any or all)

- By playing different maps.
- A weapon or gadget that "catches" characters.
- A number of kills of a character earns that character.

## Map pass and clusters (owner, 2026-11-25)

The owner's direction, condensed: "we have a considerable amount of maps and i would like to utilize some of what we have already built to plug into our story line. others can be relegated to community maps or another named section."
- **The big map pass builds the story.** The pass that goes over every map once the features are in (docs/QUEUE.md, Maps) is also the one that builds out the storyline, based on the maps.
- **Clusters of 3 by theme.** The final map of each 3 is the boss or challenge map (for example Mesoamerica ending with the Jaguar King, with buffs or power-ups).
- **Convergence maps**, all new, unlock when two sections linked by the timeline or story conflict. Each combines the two themes, with a convergence line that clearly splits one half of the map and shows the fracture ("like a celestial fault line of time and space").
- **Audit first**, so this is coordinated without extra work where it isn't needed: docs/STORY_MAP_AUDIT.md (every live map, 12 proposed clusters, the maps outside the story, convergence candidates, and the owner's questions).

## How it fits what exists

- Maps are already one file each, built in MapMaker. Story maps stay ordinary maps, and the campaign is data around them (order, challenges, unlocks).
- Map-by-map rework (docs/QUEUE.md, Maps): the game-inspired maps get reimagined to be funny and distinct, and fitted to this story.
- Character tiers and collections (docs/CHARACTERS.md): unlocks would sit on top of them.

## Owner's answers (2026-11-24)

1. **Both:** solo against bots, and co-op with friends.
2. **Saved on the device and on the profile.** The device keeps a copy, so play works signed out and offline. Signed in, the hub keeps it on the player's profile, next to their career stats (packages/server/src/profiles.ts, already per Cognito account on the hub box). On sign-in the two merge: unlocks are a union, and progress takes the furthest. It's a few KB per player on the existing box: no new AWS service or cost. The client reports its own progress; that's fine for a campaign (no rankings depend on it).
3. **Locked everywhere:** until a player unlocks a character, they can't pick it in any mode (campaign, Quick Play, Match Setup, online). Bots can still use it, so players meet the characters they're working toward. New players start with the Chrono Crew. No existing players to carry over (owner, 2026-11-24: "we have no userbase"): the locks apply to everyone from the day they ship.
4. **Bosses: keep it simple.** Better bot intelligence (the top skill and more), better stats (more HP, extra damage), and some bosses favour certain weapons or power-ups. The existing bot skill and character stats carry most of it.

### Owner's answers on the map audit (2026-11-25; docs/STORY_MAP_AUDIT.md)
1. How much story at the start: **waiting**: the owner will share a .md to take inspiration from first.
2. Mesoamerica's boss fight: **Balam Nightclaw, Talon Skycrest, the Sun Warrior and Aurelio** (all four in the boss encounter).
3. The 10 homage arenas outside the story: **rework their layouts** (as decided 2026-11-23), not only a new look.
4. Maps outside the story: **labelled sections** in Match Setup's tabs (Arenas, Arcade, Battlegrounds); the 3 MapMaker samples go to Community.
5. Film-inspired maps (Fernwood Moon, Serene City and the others in inspirations.ts): **moved to Community** for now; they may be reworked later. So the Space and Future City clusters each need a replacement for them (from existing maps first; docs/STORY_MAP_AUDIT.md).

### Owner's answers on the campaign design (2026-11-25; docs/CAMPAIGN_GDD.md)
- **Unlocks:** about 3 characters per sector, one per map; finishing the whole sector may also unlock the boss or the boss's companions. Convergence maps can unlock extras from their two themes. Every other character unlocks through ordinary play: XP and challenges, some with prerequisites.
- **Team sizes vary by match:** never more than 14 a side (14 v 14 at most). Some matches have a smaller team the player picks (8-10), with the map or sector adding local allies to the player's side (e.g. the Wild West's own heroes fighting with you).
- **The Playhouse is reimagined:** another dimension for the many anthropomorphic characters; a reworked Pantry Raid belongs to it, with other maps.
- Lead's suggestions with no objection so far: one map per convergence (the doc allows compact zones); a win moves you on, challenges give stars or cosmetics; in co-op each player saves their own wins; start with a slice (one historical, one modern, one future sector and one convergence); build the campaign system now, on today's maps, and let the map pass polish them.
- **Later (owner):** 4-player split screen and deeper co-op, all of it able to go online: 1-3 friends on one machine host a match with bots online, and online players join to fill spaces or take bots' places.
- **Maps follow the campaign (owner, 2026-11-25):** maps are reworked or rebuilt only as their sector is built; the campaign decides what each map needs. The maps outside the story are decided afterwards, once every story map (convergences included) is set. The plan is QUEUE's "The plan".
- **Map locks are real progression (owner, 2026-11-25):** a sector's maps are locked in both the Story screen and Match Setup: map 1 open, maps 2 and 3 dimmed until won in Story. A locked map can't be hosted yet, but anyone can **join** a match someone else hosts on it. "The game is free; we don't give it all at once, so players come back, online or not." Each sector's row shows a 4th tile, **Unknown** (the database can't see that logged event yet); it becomes the sector's convergence once found. This replaces the design doc's "hide convergences completely".
- **Each map in a sector has its own mode and size (owner, 2026-11-25):** a sequence can mix small close-quarters matches with large battles; mode, team sizes and waves are set per campaign map.
- **A Wars sector, one map per war, in time order (owner, 2026-11-25):** Civil War, WW2, Vietnam, Desert Storm, future battlefields; the boss on the last map; longer than three maps (the design doc allows other lengths). WW2 from Shingle Point or Iron Coast; the others new or reworked as the sector is built. This takes over the audit's WW2 cluster.
- **Big battles (owner, 2026-11-25):** the player still picks up to 14; a battle map adds local allies and enemy waves on top, up to 32 v 32 or 14 v 50 where the machine copes (bots fill, scaled down on phones). The "14 a side at most" line applies to the picked roster, not the battle.
- **The framework is built (2026-11-25, `wip/campaign-1125`): docs/CAMPAIGN.md** (the data in `content/campaign.json`, progress on the device and the profile, map locks on, character locks built but off behind one switch, the Operations Database). Its three sectors and the convergence are placeholders, provisional until the owner names them.
- **Owner's answers on the framework (2026-11-25):** convergence maps lock once each has its own map (the stand-in stays open); every sector is visible in the database from the start (each one's first map open); Halcyon Station stands in as Future City's third map until the sector is built. Waves and local-ally looks are played with the expedition step; character-lock coverage of Roulette and random picks comes with the unlock-by-play rules.
