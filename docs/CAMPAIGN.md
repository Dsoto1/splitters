# The story campaign: how it is built

The framework of the story campaign (docs/CAMPAIGN_GDD.md Phase 1; the owner's decisions are docs/STORY_CAMPAIGN.md, later lines win). Built 2026-11-25 on today's maps with placeholder sectors; no map was changed. The campaign only assigns content and records results: it knows nothing of combat, bots or rendering (GDD §16).

## The pieces

| Piece | Where | What it does |
|---|---|---|
| Content | `content/campaign.json` | Sectors and convergence zones as data, by stable id |
| Model and checks | `packages/shared/src/campaign/campaign.ts` | Types, `campaignProblems` (shape, ids, references, sizes) |
| Progress | `packages/shared/src/campaign/progress.ts` | Completion events, sector status, map locks, convergence tiles, merging |
| Character locks | `packages/shared/src/campaign/unlocks.ts` | The unlock check, **off** (one switch) |
| The device's copy, the account's | `packages/client/src/campaign/storyProgress.ts` | Saved in the browser and on the hub profile, merged by union |
| A map's match | `packages/client/src/campaign/storyMatch.ts` | The bot match a Story map launches |
| Operations Database | `packages/client/src/frontend/storyScreen.ts` | Story's screen (the main menu's first item) |
| The hub | `packages/server/src/profiles.ts` | Keeps `campaign` on the profile, merged by union with every save |

Tests: `packages/shared/test/campaign.test.ts` (the real data: every map and character it names exists and is usable), `campaignProgress.test.ts` (the loop of GDD §16.4), `packages/server/test/profiles.test.ts`, `packages/client/test/storyMatch.test.ts`; e2e flow `story`.

## Content: `content/campaign.json`

Ids never change once shipped: progress is saved by them. `provisional: true` marks a placeholder the owner hasn't named or placed.

A **sector**: `id`, `name`, `classification` (historical, modern, future, unclassified), `period`, `description`, `maps`, `boss` (`character` and `companions`), `rewards` (unlocked when the sector is repaired: the boss or companions), `expedition` (`crew`: how many Chrono Crew the player picks, usually 8-10, at most 14; `allies`: the sector's local allies).

A sector's **maps** are in play order, one or more (usually 3; a Wars sector has one per war, in time order, owner 2026-11-25). The last is the boss map. Each map has its `map` (a `maps/<id>.json` of the suite), its `unlock` (the one character its win unlocks) and, optionally, **its own match** (owner 2026-11-25): `mode` (a game mode id the map plays; absent, Team Deathmatch), `picked` (the crew the player picks for it, at most 14), `allies` (local allies added), `enemies` (enemy bots), `waves` (reinforcement waves). Only the picked roster is capped at 14; the battle may be bigger (up to 32 v 32, or 14 v 50), scaled down to the device.

A **convergence**: `id`, `name`, `description`, `sectors` (its two prerequisite sectors), `maps`, `rewards`.

The checks: ids unique across sectors and convergences, one or more maps a sector, every map and character resolves (a boss may be an NPC-only look; an unlock or an ally must be a core character on the roster), picked at most 14, a convergence joins two different real sectors and no pair twice, no character unlocked by two places.

### The placeholder slice (all provisional)

| Sector | Kind | Maps (unlocks) | Boss encounter | Repaired unlocks |
|---|---|---|---|---|
| The Jade Empire | Historical, Mesoamerica | Cradle of Idols (Kiko Banyan), Vinefall Sanctum (Silas Coilwhisper), Step Temple (Talon Skycrest) | Balam Nightclaw with Talon Skycrest, the Sun Warrior and Aurelio (owner, 2026-11-25) | Balam, Sun Warrior, Aurelio |
| Lockdown | Modern, today | Runway Nine (Tactical Soldier), Midnight Keel (Stealth Operative), Cormorant Isle (Pemberton) | Customs Agent Zhao with Imperial Guard and Kenji | Zhao |
| Neon Tomorrow | Future city | Express Lobby (Reef Wanderer), Neon Spire (Ricochet), Halcyon Station (Cyber Lion) | Inquisitor Vesk Tockley (NPC-only) with Shadow Enforcer and Steel Guardian | Shadow Enforcer |

Convergence: **The Cold Cells** (Lockdown × Neon Tomorrow), on Glasswork Office as a stand-in until its own map exists; unlocks Steel Guardian. Halcyon Station stands in for the Future City's third map (Serene City went to Community, owner 2026-11-25). The maps' modes and sizes are examples of the per-map match (Cradle of Idols 6 v 6, Step Temple 10 + 4 allies v 14 with a wave, Midnight Keel a Deathmatch).

## Progress

`CampaignProgress` is four lists of ids: `maps` (stages won, as `<sector or convergence>/<map>`, so one map can serve two places), `sectors` (repaired), `convergences` (discovered), `characters` (unlocked by the campaign).

- **A win completes a map** (challenges are a later extra). `recordWin` is the completion event: it counts only for the stage that is open (the one before it won), records it, grants its unlock, repairs the sector on its last map and grants the rewards, then discovers any convergence whose two sectors are both repaired. Replaying a won map changes nothing (idempotent). `settleProgress` works out everything that follows from the stages won, so a merged or older copy is never half-done.
- **Where it is kept** (STORY_CAMPAIGN answer 2): the device keeps a copy (`localStorage` `tiletrigger.campaign`), so Story works signed out and offline. Signed in, the profile on the hub keeps it too (`campaign` on `GET/PUT /api/v1/profile`, next to the career). The hub merges every save with what it has (a union), so a device that missed another's wins never takes them away; opening Story brings the device and the account in step both ways. A few KB a player; no new service. The client reports its own wins (fine: no rankings depend on them). In co-op each player saves their own wins.
- **How a win is reported:** Story's Launch passes the stage with the match (`FrontEndHooks.playLocal`'s `story`); main.ts keeps it while that match lasts (any other match, a change of map or a rotation drops it) and, when the match's end reports a win (the career's `record`), calls `recordStoryWin`.

## Map locks (on)

Owner, 2026-11-25: real progression, "the game is free; we don't give it all at once". A sector's first map is open; its others are locked for **hosting** until won in Story (in Story itself, the next one opens as soon as the one before is won). `mapLock` in the data layer says which; `hostLockReason` (client) words it: "Win Vinefall Sanctum in Story to unlock Step Temple (The Jade Empire)."

- Match Setup dims a locked map's card ("Locked: Story") and Start refuses it with that line.
- Quick Play never picks a locked map; the host's Change map picker leaves them out.
- **Joining** a match someone else hosts on a locked map is never refused (the lock is only on the hosting paths above).
- A player's own and community maps are never locked. Convergence maps aren't locked (the stand-in is an ordinary map).
- Browser tests (`?test=1`, automated browsers) and bots play every map; `&maplocks=1` turns the locks on in a test.
- Later (its own item): Match Setup arranged by sector.

## Character locks (off)

STORY_CAMPAIGN answer 3: characters locked everywhere until unlocked, new players start with the Chrono Crew, bots still use every character; non-campaign characters unlock through ordinary play (XP and challenges, some with prerequisites). Those play rules don't exist yet, so **locks ship off**: `CHARACTER_LOCKS_ON = false` in `packages/shared/src/campaign/unlocks.ts` is the one switch. The state (the campaign's unlocked characters, the Chrono Crew as the starting set) and the check (`characterUnlocked`, used by Character Select's Choose) are built; with the switch off every character is unlocked and nothing changes for anyone. Turning it on also needs the other pick paths (a saved look, Roulette, random) to consult it.

## The Operations Database (Story)

The main menu is **Story · Quick Play · Local · Online**, then MapMaker, Characters, Options below them (owner, 2026-11-25; Local is the old Play, Match Setup). Quick Play stays the highlighted item a new player starts on.

Story opens the database: a row per discovered sector (every sector today), its card (classification and period, name, description, status as a word and a symbol as well as a colour: Available ○, In Progress », Repaired ✓; maps won; the next map) and a 4th tile, **Unknown** ("the database can't see that logged event yet"), which becomes the sector's convergence once discovered (owner 2026-11-25; this replaces GDD §9.4's "no card at all"). An Unknown tile never names the convergence or its partner, and a sector in none still shows one. A sector's detail lists its maps in order (picture, its match, what it unlocks, Won / Next / Locked) with Launch for the next and Replay for won ones, the boss encounter, the expedition and the sector's rewards. A discovered convergence opens the same way.

Launch starts a normal bot match on that map through Match Setup's path (`rulesFromSetup`, `playLocal`), with the map's own mode and size (`storyMatch.ts`): your side is the picked crew plus the allies, the other the enemies, both shrunk together to what the device runs; absent a size, Quick Play's (the map's recommended count). The phone layouts stack the rows; a phone held sideways keeps the lower menu group in one row.

## Not built yet (later phases)

- The expedition picker (choosing the crew), local allies by look, enemy rosters, waves and boss rules in the match (GDD Phase 2; the data carries them).
- Discovery notification, briefings, boss intros (Phases 3-4); challenges and stars.
- Sectors hidden until found (all are discovered from the start today).
- The unlock-by-play rules, then character locks on.
- Match Setup by sector.
