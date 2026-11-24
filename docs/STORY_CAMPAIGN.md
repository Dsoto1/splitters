# Story campaign: the owner's notes

Owner's notes, 2026-11-24. A direction to build toward, not yet a plan: the owner is writing the story, and the maps get "mapped out" against it (current maps and future ones).

## The shape

- **A storyline across time periods and themes.** About **3 maps per period or theme** (for example Aztec / Mesoamerican, ancient Egypt, medieval, modern, future, space).
- **Map challenges unlock the next map** in the story or timeline. Each map has its own challenges.
- **Bosses.** Each period's thematic characters are harder to kill, and some are bosses. Example: the Aztec maps lead to a boss fight with the sun characters (Aurelio, the Sun Warrior).
- **Start:** 5 maps unlocked, and only the Chrono Crew.

## The Chrono Crew is the player's team

- The player uses the Chrono Crew through the whole storyline.
- Today there are 11 (Dex Calloway, Doc Seraphine Vale, Flicker, Fuse Hollister, Gears Okafor, Lyra Vantis, Mags Petrov, Nova Kade, Sarge Tobias Crane, Vesper Quill, Wren Halloway). The owner will make **3 more**, for a team of **14**.
- **Team management:** the player swaps team members out for characters they've unlocked.

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
3. **Locked everywhere:** until a player unlocks a character, they can't pick it in any mode (campaign, Quick Play, Match Setup, online). Bots can still use it, so players meet the characters they're working toward. New players start with the Chrono Crew.
4. **Bosses: keep it simple.** Better bot intelligence (the top skill and more), better stats (more HP, extra damage), and some bosses favour certain weapons or power-ups. The existing bot skill and character stats carry most of it.
