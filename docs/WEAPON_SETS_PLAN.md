# Weapon sets (owner-approved, 2026-11-06)

## The owner's idea
In a bot match, nearly everyone ends up with a pistol. The fun weapons almost never turn up. The owner: "I have never
once seen the sheep weapon, hardly see swarm launcher or gravity weapon. … Weapon sets for map defaults … would allow
weapon style sets or a mixed bag, all depending on the map default and host setting."

## Why it happens today (main 02ec505a)
- **Spawn loadout:** Team Deathmatch, CTF, Deathmatch and most modes start everyone with `core.knife` and
  `core.pistol` (`startingWeapons`, `shared/src/sim/rules.ts`). Only co-op and zombies add a rifle.
- **Pickups:** every other gun comes from pickups. The 89 shipped maps place a **median of 11 weapon pickups**, for
  up to 48 players.
- **Exotics are barely placed:**
  - placed most: SMG 124, rifle 120, shotgun 120, sniper 82;
  - placed least: Swarm 0, Bubble Blaster 0, Arc Caster 0, Guided 0, Singularity (the gravity gun) 1, Flak 1, Pulse
    Pistol 1, the sheep 2, Freeze Ray 2, Goo Gun 2.
- **No variety tools in use:** no map uses "Random from category" pickups, and "Mix up weapon pickups" is off by
  default.
- **Knock-on effect:** the bots' sniper role only works while a bot carries a scoped gun (docs/BOTS.md, "Roles"), so it
  rarely switches on.

## The sets (owner: "set list is fine")
A set is data in `content/weapon-sets.json`. It decides:
- **the spawn loadout,** so nobody is stuck on a pistol;
- **what weapon pickups turn into:** a placed pickup rolls a weapon of the set in its own category, or the nearest
  category the set has (a sniper pickup in Sci-fi becomes the Railgun);
- **what drops** (only set weapons).

| Set | Spawn loadout | Weapons in the set | Grenades (owner, 2026-11-07) |
|---|---|---|---|
| **Standard** | knife, pistol (today's pickup hunt) | as placed on the map (today) | as placed; a frag at spawn |
| **Military** (owner: "pistol and a main gun") | knife, pistol, **assault rifle**; sniper-role bots a **marksman rifle** instead | rifle, burst rifle, SMG, machine pistol, LMG, shotgun, auto shotgun, sawed-off, sniper, marksman, grenade launcher, rockets, pistol, revolver, hand cannon | frag, mine (+ smoke when the weapons intake lands) |
| **Sci-fi** | knife, pulse pistol, **plasma rifle**; sniper-role bots the **railgun** | plasma, laser rifle, railgun, pulse pistol, arc caster, disc launcher, swarm, guided | sticky, vortex (+ smoke) |
| **Medieval** | knife, **spear** | spear, battle axe, knife | incendiary, holy bomb |
| **Chaos** | knife, pistol, **one random oddball each life** | the sheep, swarm, singularity, freeze ray, goo gun, bubble blaster, oil slicker, flare gun, nailgun, flak, blast rockets, gilded pistol | sheep, holy bomb, cluster bomb (everyone spawns with the sheep) |
| **Mixed bag** | knife, pistol, **a random main gun each life** | every weapon a pickup can hold | every grenade |

- **The knife in every set** (owner, 2026-11-07: "for consistency"), Chaos and Mixed bag included.
- **Grenades** (owner, 2026-11-07): grenade pickups roll within the set's grenades, and everyone spawns with the set's
  first.
- **Random spawn guns** (Chaos, Mixed bag) are rolled from the match seed, the slot and the life. A match replays the
  same, and every peer agrees.
- **Classes on:** class loadouts stay as they are. Pickups still roll within the set.
- **Roulette's signature loadouts** (docs/ROULETTE_MODE_PLAN.md): a signature weapon outside the set falls back to
  the set's main gun.
- **Mode-only weapons** (arena discs), tools (medkit, builder, grapple) and mounted guns are never in a set. Modes
  with fixed weapons (Disc Arena, Spear Fight) ignore the set.

## Map default and host choice
- **Each map's default set** is a map property, MapMaker → Map properties → Weapon set, saved in the map file. The
  default is Standard when a map doesn't say.
- **Official maps** get defaults by theme, set through MapMaker (CLAUDE.md, "Maps"). The agent proposes a table first
  (e.g. Shingle Point Military, Halcyon Station Sci-fi) and the owner confirms it.
- **The host chooses:** Match Setup → Weapons: Map default, or any set. The same choice is in the pause menu's Host
  tab. The setup shows what the map's default is. Saved setups and presets keep their choice.

## Bots
- Bots weigh every set weapon sensibly: range, splash, a projectile's flight, beams, heat.
- A bot match per set has every set weapon getting kills (a scorecard line: kills by weapon).
- Sniper-role bots spawn with the set's scoped gun where it has one (Military, Sci-fi), so the sniper role actually
  plays (docs/BOT_AI_PLAN.md, Phase B).

## Proof
- **Unit tests:** set data, rolls (deterministic, in category), loadouts per set, map default and host override, old
  saves and maps (Standard).
- **e2e:** Match Setup's Weapons choice; a Military match spawns with pistol and rifle; a Chaos match's spawn guns
  vary by life.
- **Scorecard:** kills by weapon per set on a few maps. Each set's weapons all appear.

## Order
- After the Match Setup follow-ups (they share Match Setup and the Host tab).
- It runs alongside Bot AI Phase B.
