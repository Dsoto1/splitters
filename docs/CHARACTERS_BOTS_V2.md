# PROJECT CHRONOSPLIT — CHARACTERS & BOTS SPECIFICATION v2

**Document:** `CHARACTERS_BOTS.md`  
**Status:** Pre-production handoff  
**Authority:** Supporting specification. `MASTER_SPEC_V2.md` is authoritative if any conflict remains.

**Purpose:** Define the character roster, visual identity, bot personalities, NPC reuse, content pipeline, originality guardrails, and technical requirements for the browser-first arcade FPS / creation platform without reproducing protected character designs.

---

## 1. DESIGN MANDATE

The roster must feel impossibly broad.

A player opening the character browser should immediately understand that almost anything can exist in this universe: historical fighters, monsters, civilians, robots, aliens, animals, undead, mascots, aristocrats, mutants, adventurers, bizarre machines, supernatural beings, and characters that are difficult to classify at all.

The target is not realism and not a coherent military faction roster.

The target feeling is:

> **"I have no idea who is going to appear on the next page."**

Characters must remain visually readable during fast multiplayer combat and must belong to this game's own fictional universe.

### Core pillars

1. **Extreme variety** — era, species, silhouette, costume, scale, personality, and tone.
2. **Immediate readability** — recognize characters rapidly at gameplay distance.
3. **Original identity** — never create substitutes for specific copyrighted characters.
4. **Humor without dependency on parody** — funny because the character concept is funny, not because it copies another property.
5. **Reusable systems** — hundreds of characters must be economically achievable.
6. **Bots are characters** — AI behavior should reinforce personality.
7. **Scenario-ready** — any suitable character can function as player avatar, player bot, NPC, ally, enemy, objective character, or boss variant.
8. **Creator freedom** — MapMaker/Scenario Maker exposes the roster with strong filtering and overrides.

---

# 2. ORIGINALITY / IP GUARDRAILS

## 2.1 Rule: Copy the creative permission, not the character

The project may study broad design principles common to arcade shooters:

- large eclectic rosters
- exaggerated silhouettes
- genre collision
- historical/futuristic/horror/comedy themes
- unlockable characters
- stylized proportions
- character-specific bot flavor

It must **not** intentionally recreate the distinctive expression of a specific character from TimeSplitters or another franchise.

Do not begin with:

> "Make our version of [existing character]."

Begin with:

> "What character belongs in our multiverse that we haven't seen before?"

## 2.2 Character originality checklist

Before approving a character, check:

- Original name
- Original silhouette
- Original costume combination
- Original head/face design
- Original color/material treatment
- Original backstory
- Original personality
- Original voice identity
- No copied logos/emblems
- No distinctive copyrighted accessories reproduced as a set
- No deliberate one-to-one correspondence with an existing franchise character

Individual generic concepts such as "cowboy," "robot," "mummy," or "astronaut" are allowed as creative building blocks. The final combination and expression must be ours.

## 2.3 Legacy imports

Legacy map compatibility must reference our character equivalents only through abstract gameplay roles when necessary. An imported legacy scenario should never require distributing original character models, textures, audio, animation, or other proprietary assets.

If an unsupported legacy character reference is encountered, importer behavior should be:

1. identify broad gameplay category if available;
2. choose or request an original replacement;
3. preserve gameplay properties where legally/technically appropriate;
4. report substitution to the creator.

---

# 3. FICTIONAL PERMISSION STRUCTURE

The game needs a premise that permits characters from wildly different realities and eras to coexist without requiring every character to share a conventional setting.

Working premise:

> Reality has fractured into overlapping timelines, simulations, worlds, and impossible histories. Combat arenas and scenarios pull participants from these realities into unstable crossings.

The fiction is intentionally flexible. It exists primarily to grant the roster permission to be chaotic.

It supports:

- alternate histories
- fictional civilizations
- impossible futures
- monsters
- robots
- supernatural characters
- historical archetypes
- mundane civilians
- absurd joke characters
- creator-made scenarios mixing all of the above

The fiction must never become so complicated that it restricts content creation.

---

# 4. CHARACTER DNA SYSTEM

Character concepts are generated and classified using a multidimensional DNA system.

This is a **design tool**, not a mandate to procedurally generate the final roster.

## Primary DNA

```text
ERA / WORLD
+
ARCHETYPE / OCCUPATION
+
SPECIES / NATURE
+
BODY FAMILY
+
PERSONALITY
+
TWIST
+
VISUAL MOTIF
```

Example:

```text
Victorian Macabre
+ Undertaker
+ Human
+ Lanky
+ Miserable
+ Clockwork prosthetics
+ Funeral brass
```

Result: an original mechanical undertaker character.

Another:

```text
Retro Space Resort
+ Tourist
+ Alien
+ Tiny
+ Reckless
+ Vacation fanatic
+ Loud tropical clothing
```

Result: an alien tourist who treats firefights like sightseeing.

## Secondary DNA

Additional axes:

- social class
- age presentation
- movement attitude
- damage state
- material language
- dominant shape language
- facial structure
- costume density
- technology level
- cleanliness/grime
- symmetry/asymmetry
- seriousness/comedy rating
- voice family
- animation attitude

The DNA database should be searchable by design tools and Scenario Maker.

---

# 5. CHARACTER TONAL SCALE

The roster deliberately ranges from credible to completely absurd.

## Level 1 — Grounded

Examples:

- detective
- explorer
- mercenary
- knight
- astronaut
- gunslinger
- resistance fighter
- scientist

These characters anchor scenarios that want a more serious presentation.

## Level 2 — Heightened

Examples:

- cybernetic outlaw
- occult investigator
- undead knight
- mutant commando
- clockwork constable
- lunar prospector

## Level 3 — Weird

Examples:

- possessed governess
- skeletal chimney sweep
- alien lounge singer
- cursed poultry knight
- mummy accountant
- malfunctioning mascot
- amphibian private investigator

## Level 4 — "What is that?"

Examples:

- sentient vending machine
- three small creatures operating one disguise
- goldfish piloting a combat walker
- garden ornament on mechanical legs
- giant eyeball in athletic shoes
- skeleton whose torso is a bird cage
- haunted suit of diving equipment with nobody inside
- aristocratic worm operating a human-sized exoskeleton

The final names and designs require curation. Examples above establish tonal permission, not mandatory production characters.

### Roster distribution target

A healthy launch roster should not be dominated by joke characters.

Suggested distribution:

- 30% Grounded
- 30% Heightened
- 25% Weird
- 15% Extreme

This keeps absurdity surprising rather than exhausting.

---

# 6. WORLD / THEME FAMILIES

Characters should often be developed in small themed universes. This produces visual cohesion within scenarios while preserving enormous variety across the total roster.

Initial theme families:

1. Victorian Macabre
2. Retro Space Resort
3. Pulp Jungle Expedition
4. Gothic Kingdom
5. Neon Megacity
6. Dustbowl Weird West
7. Ancient Mythic Empire
8. Frozen Research Colony
9. Deep-Sea Civilization
10. Haunted Suburbia
11. Industrial Revolution Gone Wrong
12. Interstellar Truck Stop
13. Bioengineered Future
14. Post-Apocalyptic Carnival
15. Secret Government Laboratory
16. Clockwork Metropolis
17. Pirate Archipelago
18. Lunar Mining Frontier
19. Cursed Museum
20. Subterranean Kingdom
21. Retro Tomorrowland
22. Monster Movie Backlot
23. Dystopian Game Show
24. Fantasy Bureaucracy
25. Alien Wildlife Preserve
26. Arctic Occult Expedition
27. Dieselpunk Siege City
28. Impossible Toy Factory
29. Temporal Prison
30. Reality Glitch / Unknown

Each theme should eventually support roughly 8–20 characters, but production does not need to complete every theme at launch.

---

# 7. SILHOUETTE BIBLE

Silhouette diversity is mandatory.

A roster page should remain visually interesting when every character is rendered as a black shape.

## Body families

### Human-compatible rigs

- Average
- Athletic
- Heavy
- Lanky
- Short
- Very tall
- Broad / top-heavy
- Elderly / stooped
- Hunched

### Extended humanoids

- Oversized head
- Long arms
- Short legs
- Digitigrade
- Mechanical lower body
- Floating lower body
- Multi-arm visual variants

### Creature / special rigs

- Small biped
- Large biped
- Quadruped
- Hovering
- Serpentine
- Walker/mech
- Object-bodied

Not every special family must be playable in competitive modes. Collision fairness and camera requirements determine eligibility.

## Competitive silhouette rules

For standard competitive playlists:

- collision capsules remain within approved classes;
- apparent size cannot create a major hitbox advantage;
- extreme characters may use normalized gameplay collision;
- first-person camera height must remain within tested bounds;
- cosmetics cannot conceal weapon/readability information excessively.

Scenario creators may enable less balanced character rules in custom/private scenarios.

---

# 8. MODULAR PRODUCTION SYSTEM

Hundreds of characters are only feasible if production is modular.

## Shared components

Human-compatible characters should reuse:

- skeletons
- animation graphs
- locomotion sets
- hand sockets
- weapon sockets
- hit reactions
- IK systems
- ragdoll definitions
- facial base rigs where practical

Characters differentiate through:

- head meshes
- body proportions
- clothing modules
- accessories
- material sets
- facial treatments
- animation overlays
- voice
- bot personality

## Asset categories

```text
Head
Hair / head attachment
Torso
Arms
Hands
Legs
Feet
Outerwear
Back attachment
Face attachment
Accessory A
Accessory B
Material set
Voice set
Animation attitude
```

Authored hero characters can break modular rules when their concept justifies the cost.

## LOD requirements

All characters require automatic or authored LOD tiers suitable for browser play and large battles.

Example target:

- LOD0: local / close combat
- LOD1: nearby combat
- LOD2: medium distance
- LOD3: distant crowd/NPC
- impostor/cull where appropriate

Character shaders must support aggressive batching/material reuse where visually acceptable.

---

# 9. ROSTER TARGETS

Do not attempt hundreds of characters before core gameplay is stable.

## Prototype

12 characters

Purpose: prove body families, animation sharing, browser performance, and AI personality differentiation.

## Vertical slice

12 characters

At least:

- 8 grounded
- 8 heightened
- 6 weird
- 2–6 extreme

## Early Access / first public content target

60–100 polished characters depending on production capacity.

## Full launch aspiration

100–150 characters.

## Long-term platform target

300–500+ curated characters.

The platform architecture must support the long-term number even when the initial content count is much smaller.

---

# 10. PLAYER BOTS

A Player Bot occupies one of the maximum 32 player slots and follows essentially the same game rules as a human player.

Player Bots can:

- navigate the complete playable map
- acquire weapons
- acquire ammunition
- seek health/armor/powerups
- understand objectives
- change weapons
- engage targets
- retreat
- pursue
- defend
- use interactive objects
- respond to scenario triggers
- cooperate with teams
- use supported traversal systems

They are fundamentally different from cheaper scenario NPC combatants.

---

# 11. BOT PERSONALITY SYSTEM

Every roster character has a **default personality profile**. Scenario creators may override it.

## Continuous attributes

Suggested normalized values 0–100:

- Accuracy
- Reaction Speed
- Aggression
- Self Preservation
- Tactical Awareness
- Objective Priority
- Item Greed
- Pursuit Persistence
- Exploration
- Team Loyalty
- Risk Tolerance
- Melee Preference
- Range Preference

## Personality tags

Tags modify decision weighting and create memorable behavior.

Examples:

- BERSERKER
- COWARD
- SNIPER
- CAMPER
- LOOT_GOBLIN
- SHOWOFF
- BODYGUARD
- LONE_WOLF
- TACTICIAN
- BRAWLER
- TRICKSTER
- OBJECTIVE_FANATIC
- EXPLORER
- AMBUSHER
- CHAOTIC
- EXPLOSIVES_FAN
- SURVIVOR
- RECKLESS

Characters may combine several tags.

Example:

```text
Character: unnamed alien tourist
Accuracy: 28
Reaction: 62
Aggression: 94
Self Preservation: 12
Objective Priority: 40
Risk Tolerance: 96
Tags:
  RECKLESS
  EXPLOSIVES_FAN
  SHOWOFF
```

The expected result is obvious before the match begins: this bot will cause problems.

---

# 12. BOT DIFFICULTY VS PERSONALITY

Difficulty and personality must remain separate.

A cowardly bot on Hard difficulty remains cowardly but executes cowardly behavior intelligently.

A reckless bot on Easy remains reckless but aims and reacts poorly.

Difficulty primarily modifies:

- reaction latency
- aiming error
- tracking ability
- prediction
- tactical evaluation quality
- memory
- navigation efficiency
- weapon-use competence

Personality primarily modifies:

- preferred choices
- risk
- aggression
- goals
- movement style
- item priorities
- social/team behavior

This preserves character identity at every difficulty.

---

# 13. BOT AI UPDATE BUDGET

Bots must support 32-player matches in browsers with dedicated authoritative servers.

Do not run expensive full decision trees every simulation frame.

Suggested architecture:

```text
Server simulation:       fixed tick
Movement control:        frequent
Combat/aim evaluation:   medium frequency
Perception refresh:      staggered
Tactical decisions:      ~5–10 Hz target
Strategic/objective AI:  lower frequency
Path recomputation:      event-driven / throttled
```

Exact frequencies are performance-tested, not hard-coded from this document.

Bots should reuse cached navigation and shared spatial queries whenever possible.

---

# 14. NPC COMBATANTS

NPC Combatants do not consume the 32 player-slot pool.

They populate scenarios and large battles.

Examples:

- soldiers
- guards
- zombies
- aliens
- robots
- civilians
- creatures
- turrets
- scenario bosses

NPCs may reuse roster character models but use cheaper AI.

## Target architecture

- Up to 32 Human/Player Bot combatant slots
- Target up to ~64 active NPC combatants on suitable server/client hardware
- Much larger dormant/reinforcement pools
- Performance scaler can reduce active NPC count

This is a design target requiring profiling, not a guaranteed minimum for every device.

---

# 15. SQUAD AI

Large battles should organize NPC combatants into squads.

Example:

```text
ALPHA SQUAD
- Sergeant
- Rifleman
- Rifleman
- Heavy
- Medic
```

The squad handles high-level intent:

- attack objective
- defend area
- patrol
- escort
- retreat
- reinforce
- follow player

Individuals handle:

- movement
- cover
- target selection
- firing
- grenades
- local survival

This reduces duplicated high-level AI work and creates more coherent battlefield behavior.

---

# 16. PLAYER COMMAND OF NPC SQUADS

Optional scenario feature.

A creator can permit players to command friendly squads.

Minimal commands:

- FOLLOW
- HOLD
- MOVE
- ATTACK
- DEFEND

This is not an RTS interface. It is a lightweight battlefield interaction.

Scenario Maker property:

```text
Allow Player Orders: ON/OFF
Eligible Factions: [...]
Maximum Followers: N
```

---

# 17. CHARACTER → NPC ROLE REUSE

The same roster character can be instantiated in several roles.

```text
CHARACTER DEFINITION
        |
        +-- Player Avatar
        +-- Player Bot
        +-- Friendly NPC
        +-- Hostile NPC
        +-- Neutral NPC
        +-- Objective NPC
        +-- Boss Variant
```

Role-specific gameplay data belongs to the scenario/entity instance rather than being baked permanently into the visual character.

Example:

```text
Character: Mortimer Graves
Role: Hostile NPC
Faction: Cult
Weapon: Scattergun
AI Profile: Defensive Guard
Patrol Route: Library
Drops: Basement Key
```

Another scenario could use the same character as a human avatar with no special properties.

---

# 18. CHARACTER BROWSER

The roster must remain usable at 500+ characters.

## Filters

- Search
- Favorites
- Recently Used
- Era / World
- Species
- Body Family
- Theme
- Tone
- Role suitability
- Voice
- Unlock status
- Player-compatible
- NPC-compatible
- Boss-compatible

Example:

```text
CHARACTERS                                  347

Search [ undertaker________________ ]

WORLD
[x] Victorian Macabre
[ ] Neon Megacity
[ ] Retro Space Resort

TYPE
[x] Human
[x] Creature
[x] Machine
[x] Undead

TONE
[ ] Grounded
[x] Heightened
[x] Weird
[ ] Extreme

ROLE
[x] Player
[x] Bot
[x] NPC
[ ] Boss Only
```

Large thumbnail grids should virtualize rendering so hundreds of portraits do not load simultaneously.

---

# 19. CHARACTER SELECT EXPERIENCE

Character selection should itself communicate the game's personality.

Requirements:

- large readable portrait/model
- immediate silhouette
- character name
- theme/world
- short one-line description
- default bot personality preview
- favorites
- random character
- random by theme
- random by tone

Optional playful statistic fields may include non-gameplay flavor data, but they must not obscure actual competitive information.

A **Random Chaos** option can deliberately select across the entire unlocked roster.

---

# 20. VOICE SYSTEM

Voice identity is valuable but expensive.

Characters do not require full cinematic dialogue sets.

## Core combat bark categories

- Spawn
- Enemy spotted
- Attack
- Hurt
- Kill
- Multi-kill reaction
- Revenge
- Friendly fire
- Weapon pickup
- Powerup
- Objective attack
- Objective defend
- Objective complete
- Panic
- Taunt
- Death
- Victory
- Defeat

Target roughly 20–40 high-value lines for strongly voiced personalities where budget permits.

## Voice families

Some characters can share an actor/base voice family while differing through:

- performance
- vocabulary
- processing
- radio effect
- mechanical processing
- pitch treatment within reasonable quality bounds

Do not use processing as a substitute for performance on major characters.

Scenario creators must be able to reduce/disable character chatter.

---

# 21. ANIMATION ATTITUDE

Characters sharing a skeleton should not all feel identical.

Use additive/overlay animation attitudes where affordable:

- disciplined
- swagger
- nervous
- hunched
- manic
- aristocratic
- robotic
- lumbering
- sneaky
- heroic

These influence idle, locomotion presentation, gestures, victory poses, and menu animation without requiring a wholly unique combat animation set.

Gameplay-critical timings remain standardized where competitive fairness requires it.

---

# 22. UNLOCK PHILOSOPHY

Characters should be rewards for playing, discovering, experimenting, and completing challenges.

Avoid randomized paid loot-box character acquisition.

Unlock sources:

- campaign/scenario completion
- Arcade challenges
- multiplayer milestones
- hidden secrets
- unusual feats
- creator challenges
- community events
- discovery achievements

Examples of desired feeling:

```text
Complete "House of Ash" on Hard
→ unlock a resident of that world

Win a melee-only challenge
→ unlock an appropriately absurd melee character

Discover five hidden developer rooms
→ unlock a secret character
```

The exact character and requirement should be thematically connected whenever possible.

---

# 23. RANDOMIZATION

Random selection should be unusually capable because of roster size.

Options:

- Any Character
- Grounded Only
- Weird Only
- Theme
- Era
- Species
- Favorites
- Unlocked
- Competitive-safe
- Scenario-defined pool

Scenario Maker can define allowed character pools.

Example:

```text
Scenario Character Pool

[x] Victorian Macabre
[x] Gothic Kingdom
[ ] Retro Space Resort

Allow Extreme Characters: NO
Allow Random: YES
```

---

# 24. SCENARIO MAKER INTEGRATION

Every placed character/NPC exposes relevant properties.

```text
IDENTITY
Character
Display Name Override

ROLE
Player / Bot / NPC / Boss / Civilian / Objective

FACTION
Faction ID
Relationship Overrides

COMBAT
Starting Weapon
Secondary Weapon
Health
Armor
Damage Scale

AI
Profile
Difficulty
Patrol
Guard Zone
Squad
Orders

SPAWNING
Spawn Rule
Respawn
Reinforcement Pool

LOGIC
On Spawn
On Alert
On Damaged
On Health Threshold
On Kill
On Death
On Objective State
```

Character events plug directly into the global WHEN → IF → DO trigger system.

---

# 25. BOSS VARIANTS

Bosses should usually be scenario instances rather than entirely separate character systems.

A creator can take an existing character and define:

- larger health pool
- phases
- special weapon
- special movement
- reinforcements
- shield
- destructible armor
- trigger events
- unique presentation

Example:

```text
WHEN Boss Health <= 50%
DO
  Destroy Arena Lights
  Enable Emergency Lighting
  Spawn Reinforcements
  Change Boss Weapon
  Start Phase 2 Music
```

Special boss-only models remain possible.

---

# 26. CHARACTER PERFORMANCE RULES

The roster must be designed around browser delivery.

## Key requirements

- shared skeletons where possible
- texture atlasing where beneficial
- compressed textures
- mesh LODs
- animation compression
- streamed/on-demand character packages
- do not preload hundreds of full-resolution characters
- asynchronous preview loading
- distant NPC simplification
- animation update throttling for distant entities
- visibility/room-based culling

The character browser loads thumbnails/previews separately from full match assets.

Scenario packages should declare required character assets so a client can prepare only what the current match needs.

---

# 27. NETWORKING RULES

Visual character choice and gameplay state are separate.

Network replication should transmit compact identifiers/state rather than model data.

Example conceptual state:

```text
entityId
characterDefinitionId
role
faction
transform
animationState
weaponState
healthState
relevant cosmetic IDs
```

The server remains authoritative for combat-critical state.

NPC interest management should reduce replication for entities far outside a client's relevant combat area.

---

# 28. CHARACTER DATA DEFINITION

Conceptual schema:

```text
CharacterDefinition
{
  id
  version
  displayName
  theme
  era
  species
  tone
  bodyFamily
  skeletonFamily
  visualAssetSet
  portrait
  voiceSet
  animationAttitude
  defaultBotProfile
  gameplayEligibility
  tags[]
  unlockDefinition
  metadata
}
```

Do not put scenario-specific health, weapons, faction, or objective behavior permanently into the character definition unless it is an explicit game-wide characteristic.

---

# 29. BOT PROFILE DATA

Conceptual schema:

```text
BotProfile
{
  accuracy
  reactionSpeed
  aggression
  selfPreservation
  tacticalAwareness
  objectivePriority
  itemGreed
  pursuitPersistence
  exploration
  teamLoyalty
  riskTolerance
  meleePreference
  rangePreference
  tags[]
  weaponPreferences[]
}
```

Difficulty applies modifiers separately.

---

# 30. CONTENT CREATION WORKFLOW

Each character should move through a predictable pipeline.

```text
1. Theme need identified
2. DNA concept generated
3. Originality check
4. Silhouette thumbnails
5. Concept selection
6. Character sheet
7. Body-family assignment
8. Modular asset reuse review
9. 3D production
10. Materials
11. Rig validation
12. Animation attitude
13. Voice/personality definition
14. Bot profile
15. Portrait/menu presentation
16. LOD/performance pass
17. Gameplay readability test
18. Originality review
19. Final approval
```

Batch characters by theme/body family to reduce production cost.

---

# 31. ROSTER QUALITY TEST

Every content milestone should run a "roster wall" review.

Display every character at equal size in silhouette and then fully rendered.

Ask:

- Too many ordinary humans?
- Too many soldiers?
- Too many similar heights?
- Too many similar heads?
- Are women and men represented across varied roles rather than narrow stereotypes?
- Do creatures and machines add genuinely different shapes?
- Are joke characters becoming repetitive?
- Can individual characters be recognized from a distance?
- Does every theme have its own visual language?
- Are any designs suspiciously close to existing franchise characters?

If a page looks homogeneous, production must correct it before simply adding more characters.

---

# 32. INITIAL CONCEPT MATRIX

The first concept sprint should create **50 silhouettes**, not 50 finished models.

Recommended spread:

| Theme | Concepts |
|---|---:|
| Victorian Macabre | 6 |
| Retro Space Resort | 5 |
| Weird West | 5 |
| Neon Megacity | 5 |
| Gothic Kingdom | 5 |
| Secret Laboratory | 5 |
| Pirate Archipelago | 4 |
| Haunted Suburbia | 4 |
| Alien Wildlife Preserve | 4 |
| Impossible Toy Factory | 4 |
| Reality Glitch | 3 |
| **Total** | **50** |

From these, select exactly 12 strongly differentiated characters for vertical-slice development; preserve the remainder as post-slice concept candidates.

---

# 33. SAMPLE ORIGINAL CONCEPT SEEDS

These are prompts for exploration, not locked characters.

### Victorian Macabre

- impossibly tall undertaker with brass mechanical limbs
- soot-covered chimney spirit in oversized work clothes
- aristocratic monster hunter carrying absurd amounts of luggage
- stern clockwork police inspector
- spectral street vendor whose cart follows him
- disgraced surgeon wearing an elaborate experimental breathing apparatus

### Retro Space Resort

- tiny alien tourist dressed for a tropical vacation
- exhausted lunar hotel concierge
- glamorous zero-gravity lounge performer
- maintenance robot covered in vacation stickers
- retired asteroid prospector who refuses to leave the pool

### Weird West

- traveling snake-oil chemist with volatile bottles
- skeletal railway conductor
- mechanical ranch hand built from agricultural equipment
- impeccably dressed outlaw accountant
- desert creature pretending badly to be a horse

### Haunted Suburbia

- possessed neighborhood-watch captain
- spectral mail carrier
- sentient lawn ornament on improvised mechanical legs
- haunted diving suit stored inexplicably in a suburban garage

### Impossible Toy Factory

- wind-up royal guard
- plush monster with disturbingly serious military discipline
- broken educational robot that believes every battle is a quiz
- wooden puppet whose strings disappear upward into nothing

### Reality Glitch

- humanoid figure whose visual style changes by body section
- walking censored rectangle nobody can identify
- character apparently rendered from the wrong game genre

All concepts require visual/legal originality review before production.

---

# 34. ACCEPTANCE CRITERIA — CHARACTER SYSTEM

The character system is ready for vertical slice when:

- [ ] At least 24 distinct characters exist.
- [ ] At least 5 body/silhouette families are represented.
- [ ] Characters share animation systems without obvious cloning.
- [ ] Browser client can stream only required match characters.
- [ ] Character browser handles filtering/search/favorites.
- [ ] Bots inherit default personality from character definition.
- [ ] Difficulty can change without erasing personality.
- [ ] Characters can be assigned as Player Bot or NPC.
- [ ] Scenario Maker can override faction, weapon, AI profile, and role.
- [ ] Character death/kill/alert events connect to trigger logic.
- [ ] Player/bot data structures and protocols are 32-slot capable; the vertical slice proves 8 mixed human/bot slots, followed by staged 16/24/32 load validation.
- [ ] Initial NPC test demonstrates LOD/AI/replication profiling at modest counts; staged scaling toward ~64 active NPCs is a validated target, not a vertical-slice gate.
- [ ] Originality review has been performed for all shipped characters.

---

# 35. NON-GOALS FOR FIRST IMPLEMENTATION

Do **not** block the project waiting for:

- 100+ characters
- fully unique animation sets
- extensive facial animation
- cinematic dialogue
- user-imported character models
- procedural character generation
- elaborate cosmetic economy
- every special creature body family

First prove that a modest roster can look diverse, behave differently, load efficiently, and work across multiplayer + Scenario Maker.

---

# 36. FUTURE EXTENSIONS

Possible later systems:

- player-created characters using approved modular pieces
- community character presets
- creator-defined voice packs where licensing permits
- custom bot personalities
- scenario-specific costumes
- damage-state variants
- seasonal/community roster additions
- curated creator contests
- character relationships/rivalries used by AI flavor
- optional character biographies and collection gallery

Any community asset pipeline requires moderation, security, copyright reporting, performance validation, and content packaging rules before release.

---

# 37. FINAL PRODUCT PRINCIPLE

The character roster should make the game feel like a toy box whose designers never said:

> "That doesn't belong here."

Instead, the question is:

> **"Can we make it original, readable, fun, performant, and memorable?"**

If yes, it belongs.

The technical systems underneath that apparent chaos must remain disciplined: shared rigs, modular assets, standardized gameplay interfaces, data-driven personalities, scalable AI, aggressive LODs, and clean Scenario Maker integration.

That combination — **creative insanity on top, rigorous systems underneath** — is the target.
