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
