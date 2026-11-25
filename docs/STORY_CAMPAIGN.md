# Story campaign: the owner's notes

Owner's notes, 2026-11-24. A direction to build toward, not yet a plan: the owner is writing the story, and the maps get "mapped out" against it (current maps and future ones).

## The shape

- **A storyline across time periods and themes.** About **3 maps per period or theme** (for example Aztec / Mesoamerican, ancient Egypt, medieval, modern, future, space).
- **Map challenges unlock the next map** in the story or timeline. Each map has its own challenges.
- **Bosses.** Each period's thematic characters are harder to kill, and some are bosses. Example: the Aztec maps lead to a boss fight with the sun characters (Aurelio, the Sun Warrior).
- **Start:** 5 maps unlocked, and only the Chrono Crew.

## The Chrono Crew is the player's team

- The player uses the Chrono Crew through the whole storyline.
- Today there are 13 (owner, 2026-11-25): **Clio Everwhen** and **Sarge Tobias Crane**, the team's #1 and #2 (first in Character Select's Chrono Crew section), then Blix Orrin (the alien recruit), Dex Calloway, Doc Seraphine Vale, Flicker, Gears Okafor, Juno Hartwell (the pilot), Lyra Vantis, Mags Petrov, Nova Kade, Vesper Quill and Wren Halloway. Fuse Hollister left the crew for Machines. The owner's plan is a team of **14** (2026-11-25: "two new ... bring the team to 14"; with Fuse out it is 13: one more to come, or Fuse stays; an owner question).
- **Team management:** the player swaps team members out for characters they've unlocked.

## Bosses (owner, 2026-11-25)

The story's bosses, from the owner's Drive uploads of 2026-11-25 ("boss chrono tyrant", "boss void rift entity", "boss temporal inquisitor"). **Names are provisional** (the lead's; the owner names them for the story). Built into the game like any character (manifest, model, hit shape, grips), but **out of play for now**: each is an NPC-only manifest (`use: "npc"`, `tier: "experimental"`) that no NPC role names, so none is on Character Select, a bot's, a random or a Roulette pick, and a saved id falls back to the default look. To bring one into a fight, an NPC role or a boss rule names its look (docs/CHARACTERS.md, "Bosses, parked").

| Boss (provisional) | Look id | Model | Size | Ideas from the model |
|---|---|---|---|---|
| Emperor Kronax | `core.bosstyrant` | boss chrono tyrant rigged | large | the Chrono Tyrant: the crew's arch-enemy, the end of the line |
| The Unhour | `core.bossvoid` | boss void rift entity rigged | large | a thing from the rift between times; bleeds spirit |
| Inquisitor Vesk Tockley | `core.bossinquisitor` | boss temporal inquisitor 15k | standard | the time police: hunts unlicensed travellers, a mid-story boss |

**The crew's 14th (owner, 2026-11-25: "Maybe their 14th is unlocked. We have a boss that is humanish, maybe the story completes and he joins the crew as a good guy").** The Chrono Crew stays at 13 on the roster (no 14th upload is coming). The humanish boss, Inquisitor Vesk Tockley (`core.bossinquisitor`, standard size), turns good when the story completes and joins the crew as its 14th, unlocked by finishing the campaign. Until the campaign's unlocks exist he stays NPC-only as above; the unlock then gives him a roster place in the Chrono Crew section, with a good-guy name and bio from the owner.

## Unlocking characters (ideas, any or all)

- By playing different maps.
- A weapon or gadget that "catches" characters.
- A number of kills of a character earns that character.

## How it fits what exists

- Maps are already one file each, built in MapMaker. Story maps stay ordinary maps, and the campaign is data around them (order, challenges, unlocks).
- Map-by-map rework (docs/QUEUE.md, Maps): the game-inspired maps get reimagined to be funny and distinct, and fitted to this story.
- Character tiers and collections (docs/CHARACTERS.md): unlocks would sit on top of them.

## Owner's answers (2026-11-24)

1. **Both:** solo against bots, and co-op with friends.
2. **Saved on the device and on the profile.** The device keeps a copy, so play works signed out and offline. Signed in, the hub keeps it on the player's profile, next to their career stats (packages/server/src/profiles.ts, already per Cognito account on the hub box). On sign-in the two merge: unlocks are a union, and progress takes the furthest. It's a few KB per player on the existing box: no new AWS service or cost. The client reports its own progress; that's fine for a campaign (no rankings depend on it).
3. **Locked everywhere:** until a player unlocks a character, they can't pick it in any mode (campaign, Quick Play, Match Setup, online). Bots can still use it, so players meet the characters they're working toward. New players start with the Chrono Crew. No existing players to carry over (owner, 2026-11-24: "we have no userbase"): the locks apply to everyone from the day they ship.
4. **Bosses: keep it simple.** Better bot intelligence (the top skill and more), better stats (more HP, extra damage), and some bosses favour certain weapons or power-ups. The existing bot skill and character stats carry most of it.
