# Roulette: a character-swapping mode with variants (owner-approved, 2026-11-06)

## The owner's idea
A mode with low gravity and character stats on, where players get a new character to fight with each life. The
owner asked what to call it and what would make it more robust and entertaining.

## The owner's decisions
- **The core is character swapping.**
- **Optional variants** add the gravity mechanics, rerolls, swap on kill and so on. Variants are meant for **this mode
  and others**.
- **No free rerolls on the death screen.** A reroll is earned through kills, as an optional variant.
- **Standard for this mode:**
  - **Signature loadouts.**
  - **Jackpot rolls.**
  - **Kill-streak rewards that let a player choose their next character from a set.**
- **Ship it in two steps:**
  1. A one-click **party preset**, "Lunar Roulette", and the variants frame in the Match Setup redesign. It's built
     from today's settings: Low gravity, Character stats, and Random characters, which already gives everyone a random
     character each life. **Built** (`wip/match-setup`, 2026-11-06): `shared/src/sim/setupVariants.ts`.
  2. **This mode, queued after the Match Setup redesign:** the new mechanics, plugged into its variants frame.
     - A variant is an entry in `SETUP_VARIANTS` (id, label, tip, the modes it's offered in, the `MatchSetup` fields it
       `sets`, what it `clears`, `conflicts` and `needs`, and why it's `unavailable` on a map); Match setup draws a chip
       for each, so Earned rerolls, Swap on kill, Jackpot rolls, Streak pick and Signature loadouts need the setting
       each sets (a `MatchSetup` field and its rule) and an entry, no UI.
     - Lunar Roulette then points at the mode: in `PARTY_PRESETS`, `mode: { ffa: 'core.roulette' }, variants: ['lunar']`.

## The mode: Roulette
**Core (always on)**
- Every life, a new character from the roster, with **character stats** on: size class, hitbox, health, speed.
- **Fair shuffle:** each player draws from their own shuffled deck of the roster, so there are no quick repeats.
- **Spawn card:** for two seconds, "You are: Big Bab · Large: tougher, slower".
- A moment of **spawn protection**.
- Free-for-all by default. A **Teams** variant plays it as Team Deathmatch, with strong team-colour outlines, because
  random looks hide who is on which side.

**Standard (on by default; each can be switched off as a variant)**
- **Signature loadouts.** Each character spawns with a weapon that suits it: the knight a spear, a soldier a rifle,
  an alien a ray gun.
  - This is data: a `signature` per character, with a fallback by character group.
  - Only weapons we already have; they must be in the match's arsenal.
- **Jackpot rolls.**
  - A small chance of a legendary roll: a glow, an announcer line, and a little extra (a better signature weapon or
    some extra armour).
  - Now and then, a tiny roll.
  - A **Giant Slayer** bonus when a small character kills a large one.
- **Streak pick.** A kill streak (e.g. 3 kills in one life) earns a **pick**: at your next spawn, choose your
  character from a set of 3. The set has a jackpot chance of its own.

**Variants (off by default; the host chooses)**
- **Lunar:**
  - low gravity, fall damage off;
  - a bonus for kills while airborne;
  - explosions knock players about;
  - floaty ragdolls;
  - stronger jump pads;
  - a **gravity storm** every minute: gravity shifts after a 3-second warning.
- **Earned rerolls.** Kills earn reroll tokens (e.g. one per 2 kills, at most 2). A token spent on the death screen
  rerolls your next character. Never free.
- **Swap on kill.** You become your victim's character at once, keeping your health share and your weapons. The
  leader keeps changing.
- **Variety bonus.** Bonus points for kills made as several different characters.
- **Teams** (above).

**Awards at the end of the match**
- Shapeshifter: most different characters.
- Giant Slayer.
- Moonwalker: most air kills, with Lunar on.
- Unluckiest Roll.

**Variants for other modes**
- Using the same frame: Lunar and Roulette bodies for Team Deathmatch, CTF, King of the Hill and others, where they
  make sense.
- Each mode's own fun options can join later.

## Rules that frame it
- **Server-authoritative and deterministic by seed.** Rolls, decks, picks and tokens are sim state. A streak pick is
  a small input message from the client, checked by the server.
- **Bots:**
  - they use picks and tokens sensibly;
  - they play to their body: small ones flank, large ones push (Bot AI Phase B).
- **Performance.** A body swap each life means many character models.
  - Preload each player's next few cards from the deck, so a spawn never waits on a download.
  - Check with 48 bots and `pnpm bench:96:clump`.
  - Use the client warm-up from performance round 3, so swaps don't build shaders mid-match.
- **Content.** Signature weapons and jackpot characters are data in `content/`. The game keeps its rule that players
  can't upload or generate content.

## As built (`wip/roulette`, 2026-11-07)
The full description is docs/GAME_MODES.md, "Roulette". What follows is where each part of the plan landed, and the
choices made along the way.

- **The mode** is `core.roulette` (`sim/rules.ts` `DEFAULT_ROULETTE_RULES`: free-for-all, 20 points or the size's
  suggestion, Deathmatch's ×1.2 for the bonus points; character stats on). Every map that offers Deathmatch or Team
  Deathmatch offers it (`playableModes`). The mechanics live in `sim/roulette.ts` (`RouletteDirector`), not in a
  `ModeLogic`: they run wherever `rouletteOn(rules)` (the mode, or `rules.roulette` on another mode), so the Teams
  variant is Team Deathmatch with Roulette on, and other modes can take Roulette's bodies the same way later.
- **Decks:** a seeded shuffle of the roster per slot and round of the roster; no look twice within 6 deals
  (`NO_REPEAT`), across decks too. A streak pick's three cards are the next card and the two after it.
- **Spawn card** 2 s, **spawn protection** 2 s (only other players' hits; ended by firing, throwing or melee).
- **Signature loadouts** are data: `content/roulette.json` (`characters`: 103 of the roster's looks; `groups`: the
  fallback; `jackpot`: the better weapon a jackpot hands out; the odds, the tiny roll, the streak and reroll counts),
  checked and written by `tools/content/roulette.mjs` (part of `pnpm content:rebuild` and `content:check`). The table,
  for the owner to look over, is in the file; group fallbacks: soldiers rifle, legends spear, folk shotgun, horror
  sawed-off, animals SMG, creatures laser rifle. The weapon set decides last (`inSetOr`).
- **Jackpot rolls:** jackpot 5 % a life (steady gold glow, an announcer line, the better weapon, 50 armour), tiny 4 %
  (0.65 of the body, 8 % quicker); a pick card is a jackpot 15 % of the time. **Giant Slayer** +1 (small downs large).
- **Streak pick:** 3 kills in one life. A person's respawn waits up to 6 s for the choice; bots choose at once.
- **Variants** (`SETUP_VARIANTS`): `signature`, `jackpots`, `streakpick` (new: `onByDefault`, so off writes false and a
  party preset leaves them on), `rerolls`, `swap`, `variety`, `rlteams`, and `lunar` (its settings as before: its
  extras come wherever its gravity and no fall damage hold, so nothing new is stored; a setup saved with Lunar on plays
  the extras now).
- **Lunar's extras** (`rules.lunar`, any mode): air-kill bonus, blasts knock players about (knockback at least 10),
  floaty ragdolls (the effects world's gravity follows the match's), jump pads ×1.3 (client prediction the same), the
  gravity storm every 60 s (3 s warning, 12 s of ×0.35 / ×2.5 / ×0.55 / ×3 in turn; prediction follows the snapshot).
- **Party preset:** Lunar Roulette is `mode: { ffa: 'core.roulette' }, variants: ['lunar']`.
- **Awards:** Shapeshifter, Giant Slayer, Moonwalker (Lunar), Unluckiest Roll (the shortest life, and as whom).
- **Bots:** picks (jackpot first, then the body they play best), tokens (spent on a next card of the wrong size, or at
  the most); `BotBrain.playAs` each life: small bodies flank (lone wolves, roam wider), large ones push.
- **Performance:** each spawn event names the player's next 3 cards and the client loads them at once; the loading
  gate also warms the first cards and the outline and glow shaders (`GameView.auraWarm`).
- **Not done:** the host checkpoint (host handoff) doesn't carry decks or tokens (a successor deals fresh decks);
  dedicated servers have no server rules for the variants yet (`MODE=core.roulette` plays the mode with its standard
  features).
