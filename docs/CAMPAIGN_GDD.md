> The owner's campaign design (2026-11-25), not set in stone: the discussion and decisions go in docs/STORY_CAMPAIGN.md (later lines win).

# Tile Trigger --- Campaign & Progression Design Document

**Document type:** Game Design Document / Agent Handoff\
**Project:** Tile Trigger\
**Status:** Foundational design --- implementation details remain
data-driven and subject to iteration\
**Design direction:** Lightweight, comedic, arcade-first campaign
supporting a broad cast of characters and wildly varied arenas

------------------------------------------------------------------------

## 1. Executive Summary

Tile Trigger's campaign provides a loose structure for exploring the
game's many themes, time periods, characters, and environments. It is
not intended to be a tightly scripted, linear narrative. Its primary
purposes are to:

-   Give players a reason to visit themed groups of maps.
-   Introduce characters in the context of their home themes.
-   Provide a satisfying progression path and character unlocks.
-   Support boss encounters and memorable themed matchups.
-   Explain why unrelated people, creatures, technologies, and
    environments can coexist.
-   Create a framework that can expand as new maps, characters, and
    themes are added.

The campaign is built around **Temporal Sectors**. Each sector
represents a disrupted period, place, or thematic pocket in the timeline
and contains a short sequence of connected maps. Players can approach
sectors in a flexible order. Within a sector, its maps are completed in
sequence, with the third map typically culminating in a boss encounter.

A defining campaign feature is the **14-character Expedition Roster**:

-   Each expedition sends a friendly roster of 14 characters.
-   Typically, 9--10 are members of the Chrono Crew.
-   The remaining 4--5 are characters associated with the destination's
    theme.
-   These local allies fight alongside the crew and can become
    permanently unlocked for other game modes as the player completes
    the sector.

When two repaired sectors continue to produce a temporal overlap, a
hidden **Convergence Zone** may be discovered. These secret operations
combine elements of both themes and provide additional maps, encounters,
bosses, and character unlocks.

The campaign should feel like an entertaining arcade adventure with a
loose Saturday-morning-cartoon / time-travel-action tone. The story
supports the gameplay; it should never become a barrier to jumping into
a match.

## 2. Narrative Foundation

### 2.1 The premise

The Chrono Crew operates a temporal response facility equipped with an
experimental system capable of reaching different points in history and
alternate timelines.

During an experiment, the system suffers a catastrophic malfunction. The
resulting fractures scatter people, creatures, technologies, locations,
and entire environments across time. Some periods become unstable, some
locations merge, and some characters find themselves somewhere they
absolutely do not belong.

The crew must travel to affected sectors, contain hostile incursions,
defeat the most dangerous figures in each region, and stabilize the
damaged timeline.

The premise is intentionally broad. It should comfortably accommodate:

-   Historical civilizations and famous archetypes.
-   Modern and contemporary environments.
-   Science-fiction settings and alien worlds.
-   Prehistoric creatures.
-   Alternate histories and strange inventions.
-   Toy-like, cartoonish, surreal, or abstract worlds.
-   Unexpected crossovers between otherwise unrelated themes.

### 2.2 Tone

The tone should be energetic, playful, and self-aware. The game is an
arcade arena shooter, not a serious science-fiction drama.

Use: - Short mission briefings. - Exaggerated incident reports. - Quick
character exchanges. - Silly explanations for strange events. -
Occasional dry humor from the crew. - Dramatic presentation for
deliberately ridiculous situations.

Avoid: - Long exposition. - Complicated lore prerequisites. - Mandatory
dialogue sequences. - A single serious tone that limits future themes. -
Narrative explanations for every small gameplay detail.

### 2.3 The Chrono Operations Database

The campaign is presented through a central operations interface: the
**Chrono Operations Database**.

It serves as the player's campaign hub and records: - Discovered
Temporal Sectors. - Map completion and sector repair status. - Available
expeditions. - Recovered or unlocked characters. - Discovered
Convergence Zones. - Boss encounters and campaign rewards.

The database should behave like an evolving record of what the player
has discovered. It should not reveal every possible sector or secret
operation from the beginning.

## 3. Campaign Architecture

### 3.1 Flexible sector selection

The campaign is organized into independently selectable Temporal Sectors
rather than one mandatory global sequence.

Players can choose among available sectors in an order that suits them.
A sector may have a suggested difficulty or recommended progression
point, but the overall campaign should not require players to complete
every sector in a fixed order.

### 3.2 Three-map sector structure

The standard sector contains three connected maps:

  -----------------------------------------------------------------------
  Stage                   Purpose                 Typical encounter
  ----------------------- ----------------------- -----------------------
  Map 1 --- Discovery     Introduce the location, Standard encounter /
                          theme, and local        initial incursion
                          characters              

  Map 2 --- Escalation    Increase the threat and Larger or more
                          reveal more of the      challenging encounter
                          sector's problem        

  Map 3 --- Resolution    Confront the dominant   Boss or featured
                          threat and stabilize    encounter
                          the sector              
  -----------------------------------------------------------------------

Three maps are the default structure, not a hard technical limitation.
Some future sectors may justify a different length.

### 3.3 Sector completion

Completing the final map marks the sector as **Repaired**. This may: -
Complete the sector's campaign progression. - Unlock the sector's
remaining character rewards. - Mark its boss as defeated. - Trigger
checks for newly eligible Convergence Zones. - Update the Chrono
Operations Database.

A repaired sector remains replayable. Campaign completion should not
remove access to its maps or encounters.

### 3.4 Campaign and other game modes

Campaign progression should be kept separate from general match
availability.

-   Campaign unlocks can reward characters, cosmetics, titles, or other
    progression items.
-   Custom matches should remain flexible and should not require
    campaign completion to use a map if the game design intends that map
    to be available in custom play.
-   Character unlocks earned in the campaign should carry into the
    broader game roster.
-   Campaign-specific encounter rules should not become dependencies of
    the core arena combat system.

## 4. Temporal Sector Catalog

The following catalog is a proposed organizational framework. It is not
a requirement to create all of these sectors before launch. Existing
maps and characters should be organized into the most suitable sectors
first. Names and map concepts are placeholders until finalized.

### 4.1 Historical sectors

  -----------------------------------------------------------------------
  Sector            Theme             Example map       Possible final
                                      sequence          threat
  ----------------- ----------------- ----------------- -----------------
  **The Sunken      Ancient Egypt     Sandgate →        Pharaoh, undead
  Dynasty**                           Sunstone Crag →   guardian, or
                                      Royal Necropolis  ancient champion

  **The Jade        Aztec /           Jungle Outpost →  Jaguar warrior,
  Empire**          Mesoamerican      Step Temple →     high priest, or
                                      Sacrificial       stone guardian
                                      Grounds           

  **The Iron        Classical Rome    Forum → Legion's  Emperor, champion
  Republic**                          Crossing → Grand  gladiator, or
                                      Colosseum         general

  **The Broken      Medieval          Twin Spires →     Corrupted king or
  Crown**                             Black Keep →      knight commander
                                      King's Last Stand 

  **The Last        Wild West         Dusty Gulch →     Outlaw king,
  Frontier**                          Dead Man's Ridge  sheriff, or
                                      → The Last Train  mechanical
                                                        gunslinger
  -----------------------------------------------------------------------

### 4.2 Modern and industrial sectors

  -----------------------------------------------------------------------
  Sector            Theme             Example map       Possible final
                                      sequence          threat
  ----------------- ----------------- ----------------- -----------------
  **Urban           Modern city       Serene City →     Crime lord, riot
  Breakdown**                         Riot Junction →   commander, or
                                      Concrete Maze     rogue security
                                                        force

  **The Machine     Industrial /      Silo Complex →    Factory overseer
  Age**             alternate history Ironworks → The   or steam-powered
                                      Foundry           automaton

  **The War That    Alternate         Shingle Point →   General,
  Never Was**       20th-century      Saltmarsh Harbor  experimental
                    conflict          → The Beachhead   vehicle
                                                        commander, or
                                                        super-soldier
  -----------------------------------------------------------------------

### 4.3 Future and science-fiction sectors

  ------------------------------------------------------------------------
  Sector            Theme              Example map       Possible final
                                       sequence          threat
  ----------------- ------------------ ----------------- -----------------
  **Neon Tomorrow** Cyberpunk          Sector 9 → Neon   Rogue AI or
                                       Grid → The Core   corporate
                                                         overlord

  **Beyond the      Space / alien      Orbital Station → Alien commander
  Stars**                              Alien Frontier →  or bio-weapon
                                       The Mothership    

  **After the End** Post-apocalyptic   The Wastes →      Wasteland king,
                                       Scrap City → The  mutant, or war
                                       Last Citadel      machine
  ------------------------------------------------------------------------

### 4.4 Unclassified sectors

  -----------------------------------------------------------------------
  Sector            Theme             Example map       Possible final
                                      sequence          threat
  ----------------- ----------------- ----------------- -----------------
  **The Age         Prehistoric       Lost Valley →     Alpha predator or
  Before**                            Bone Canyon → The giant prehistoric
                                      Great Nest        creature

  **The Playhouse** Toys / imaginary  Toybox →          Toy soldier, evil
                    worlds            Candyland         doll, or wind-up
                                      Catastrophe → The king
                                      Dollhouse         

  **The Unwritten** Abstract /        The In-Between →  Reality-bender or
                    dimensional       Negative Space →  glitch creature
                                      The Null Point    
  -----------------------------------------------------------------------

### 4.5 Catalog principles

-   Treat the catalog as a flexible framework, not a launch checklist.
-   Prefer reusing existing maps and characters over creating content
    solely to fill a category.
-   A sector's three maps should feel related, but they do not need to
    be visually identical.
-   Bosses should be recognizable, memorable, and appropriate to the
    sector.
-   Existing characters can serve as bosses; a new boss is not required
    for every sector.
-   Sector names, map names, and classifications should be editable data
    rather than hard-coded UI text.

## 5. Map Progression and Boss Encounters

### 5.1 Map sequence

Maps within a sector unlock in order. Completing map 1 unlocks map 2;
completing map 2 unlocks map 3.

The campaign should communicate: - Which map is currently playable. -
Which map comes next. - What has already been completed. - What the
sector's final objective is, without revealing unnecessary spoilers.

### 5.2 Boss encounters

The third map usually features a boss or a distinct final encounter.

A boss may be: - A powerful character already associated with the
theme. - A new character introduced specifically for the sector. - A
faction leader or champion. - A creature, machine, or other unusual
threat.

Boss encounters should use the existing combat and match systems
wherever practical. A boss can have custom behaviors, abilities, health
rules, or reinforcements, but those should be configurable encounter
features rather than a separate campaign-only combat engine.

### 5.3 Boss presentation

Keep introductions brief: - A short title card or database entry. - A
quick character reveal. - Optional one-line crew commentary. - Immediate
transition into gameplay.

The goal is to make the boss feel special without interrupting the
arcade pace.

## 6. Convergence Zone System

### 6.1 Concept

A Convergence Zone is a secret operation created when two previously
repaired sectors continue to interfere with one another.

Repairing two sectors separately does not necessarily resolve the damage
caused by their original collision. Their remaining temporal energy can
combine into a new hybrid location.

These are not ordinary bonus maps. They are the final cleanup operations
for the overlap between two themes.

### 6.2 Discovery requirements

Each Convergence Zone is associated with exactly two prerequisite
sectors for the initial implementation.

A zone becomes discoverable when both prerequisite sectors have been
repaired.

-   The player may complete the sectors in either order.
-   The second sector's completion triggers the eligibility check.
-   If the zone has not already been discovered, it is added to the
    Operations Database.
-   The zone is hidden completely before discovery.

**Important UI rule:** Do not show undiscovered Convergence Zones as
dimmed cards, locked entries, silhouettes, question marks, or named
placeholders. They should not appear in the database at all until
discovered.

### 6.3 Discovery event

When a new zone is discovered, show a short, skippable notification.
Example:

> TEMPORAL RESONANCE DETECTED\
> Two previously stabilized sectors are exhibiting synchronized
> fluctuations. A previously unregistered location has appeared within
> the temporal grid.\
> Classification: Unknown\
> Coordinates: Unstable\
> Recommendation: Investigate immediately.\
> NEW OPERATION ADDED TO DATABASE.

Optional crew exchanges can add humor:

-   Commander: "We fixed those two sectors. How is there another one?"
-   Scientist: "Technically, we fixed them separately."
-   Engineer: "I told you the machine wasn't finished."
-   Veteran: "I'm taking my vacation after this."

### 6.4 Convergence structure

A Convergence Zone will usually contain three maps:

1.  **Collision Site** --- Introduces the hybrid environment and its
    mixed factions.
2.  **Instability** --- Escalates the overlap and introduces stronger
    threats.
3.  **Convergence** --- Final encounter against the force holding the
    overlap together.

This is a default pattern, not a rigid requirement. Some combinations
may work better as a single large boss arena, a special multi-wave
encounter, or another compact structure.

### 6.5 Example Convergence Zones

  -----------------------------------------------------------------------
  Prerequisite sectors    Convergence concept     Example content
  ----------------------- ----------------------- -----------------------
  Egypt + Cyberpunk       **Pharaoh.exe**         Neon pyramids, robotic
                                                  mummies, ancient
                                                  security systems

  Wild West + Space       **Space Frontier**      Cowboys, aliens,
                                                  frontier outposts,
                                                  strange technology

  Medieval + Industrial   **Mechanical Kingdom**  Steam-powered castles,
                                                  armored machinery,
                                                  clockwork knights

  Rome + Prehistoric      **Jurassic Games**      Colosseum spectacle,
                                                  gladiators, prehistoric
                                                  beasts

  Modern City + Toy       **Neighborhood Watch**  Oversized streets, toy
  Dimension                                       factions,
                                                  household-scale hazards

  Aztec +                 **Lost World**          Overgrown ruins,
  Post-apocalyptic                                scavenger tribes,
                                                  ancient machinery

  Egypt + Prehistoric     **Sands of Extinction** Desert ruins, giant
                                                  creatures, buried
                                                  ecosystems

  Industrial + Sci-Fi     **Machine Rebellion**   Factory complexes,
                                                  autonomous weapons,
                                                  rogue machines

  Medieval + Cyberpunk    **Knights of Neon**     Futuristic armor, neon
                                                  fortresses, high-tech
                                                  sword fighters

  Modern City + Abstract  **Reality Check**       Distorted streets,
                                                  impossible geometry,
                                                  unstable spaces
  -----------------------------------------------------------------------

These pairings are curated examples, not an instruction to generate
every possible pair. Only combinations with a strong gameplay or visual
identity should be authored.

### 6.6 Future expansion

A later version could support three-sector or larger convergence chains.
Do not build that complexity into the initial system. The first
implementation should support curated two-sector requirements cleanly.

## 7. Character Unlock Progression

### 7.1 Characters as campaign rewards

Characters are a major campaign reward. Players should meet and fight
alongside themed characters before unlocking them for general play.

The campaign should make character rewards feel connected to the places
and encounters in which they appear.

### 7.2 Suggested sector reward cadence

A typical three-map sector can distribute character unlocks as follows:

  Milestone        Possible reward
  ---------------- -----------------------------------------------
  Complete map 1   First local thematic character
  Complete map 2   Second local thematic character
  Complete map 3   Remaining sector allies and/or boss character

The exact number and timing of unlocks should be configurable per
sector. Some sectors may have fewer characters, while others may have a
larger roster.

### 7.3 Boss unlocks

Defeating a sector boss should normally unlock that character if they
are intended to be playable. If the boss is not a playable character,
the reward can be another themed character or cosmetic.

### 7.4 Convergence rewards

Completing a Convergence Zone can unlock: - Its boss character. - Hybrid
characters associated with the two themes. - Special cosmetics, titles,
or other rewards.

### 7.5 Persistent unlocks

Character unlocks earned in campaign should persist and become available
in the game's general character selection systems. Campaign completion
should not be required again after an unlock has been earned.

## 8. The Chrono Crew

### 8.1 The core cast

The Chrono Crew is a recurring group of 14 characters who operate the
temporal response facility.

They provide a recognizable cast across the campaign. Their
personalities and roles help frame the different missions, but the
campaign should not require all 14 to appear in every briefing or
encounter.

Potential crew archetypes:

1.  **Commander** --- Tries to maintain order and professionalism.
2.  **Veteran** --- Has seen everything and is no longer impressed.
3.  **Rookie** --- Asks the questions the player might be thinking.
4.  **Scientist** --- Understands the temporal system, at least most of
    the time.
5.  **Engineer** --- Keeps questionable equipment operational.
6.  **Scout** --- Finds trouble before anyone else.
7.  **Heavy** --- Believes most problems can be solved with more
    firepower.
8.  **Marksman** --- Calm, focused, and competitive.
9.  **Medic** --- Treats injuries that should not be medically possible.
10. **Historian** --- Recognizes the historical significance of places
    and people.
11. **Pilot** --- Gets the crew into dangerous locations.
12. **Mechanic** --- Has a personal relationship with the equipment.
13. **Recruiter** --- Somehow knows everyone.
14. **Wildcard** --- Nobody is entirely sure why they were hired.

These are functional and personality archetypes, not final character
designs or mandatory names.

### 8.2 Crew presence

Only a portion of the 14-member crew should be assigned to a given
expedition. The remaining crew members stay at the operations facility
and can appear in briefings, communications, or support roles.

This makes the crew feel like an organization rather than a group that
inexplicably travels everywhere together.

### 8.3 Crew recovery (optional)

The initial timeline accident could scatter some crew members.
Recovering them through campaign objectives is a possible additional
progression layer.

This should remain optional until the core campaign loop is established.
It should not complicate the basic sector and character-unlock
structure.

## 9. Chrono Operations Database --- UI/UX

### 9.1 Overall presentation

The database should feel like a functional operations system rather than
a conventional fantasy campaign map.

Visual direction: - A clean, compact database or mission-control
interface. - Strong map and sector artwork. - Clear status indicators. -
Readable metadata and progression. - A little science-fiction
personality without excessive visual noise.

Avoid making the interface look like a mobile app. It should feel like a
desktop game system with useful information density.

### 9.2 Sector cards

Each discovered sector card should communicate: - Sector name. - Theme
or classification. - Representative artwork. - Short description. -
Progress status. - Completed map count. - Current available mission.

Suggested status labels: - **Available** --- Discovered and ready to
begin. - **In Progress** --- At least one map completed, sector not yet
repaired. - **Repaired** --- Final map completed.

Use concise visual treatments. Do not rely on color alone to communicate
status.

### 9.3 Sector detail view

Selecting a sector should reveal: - Sector overview. - Its three-map
sequence. - Map completion states. - Boss or final encounter
information, where appropriate. - The expedition roster. - Available
character rewards, without spoiling undiscovered content
unnecessarily. - A clear action to launch the next available mission.

### 9.4 Convergence visibility

Only discovered Convergence Zones appear in the database. An
undiscovered zone has no card, placeholder, silhouette, or visible
entry.

When discovered, it should enter the database with a clear new-operation
notification.

### 9.5 Information hierarchy

The player should be able to answer these questions quickly: 1. What
sectors can I play? 2. Which mission is next? 3. Who is joining this
expedition? 4. What characters can I unlock? 5. Which sectors have I
repaired? 6. What new operations have become available?

Do not let decorative UI obscure these answers.

## 10. Expedition Composition & Thematic Allies

### 10.1 Overview

Every campaign operation assembles a friendly **14-character Expedition
Roster**. This is a defining feature of the campaign.

The roster combines the recurring Chrono Crew with characters native to
the destination. The player therefore brings familiar crew members into
each world while also fighting alongside characters who belong there.

The expedition roster is a campaign assignment. It should be distinct
from the number of characters simultaneously active in the match.

### 10.2 Standard expedition composition

A typical expedition is:

  ------------------------------------------------------------------------
  Roster component                             Count Role
  --------------------- ---------------------------- ---------------------
  Chrono Crew                                  9--10 Recurring campaign
                                                     team

  Local thematic allies                         4--5 Characters associated
                                                     with the destination

  **Total friendly                            **14** Full expedition
  roster**                                           assignment
  ------------------------------------------------------------------------

The exact split can be configured when a sector requires it, but the
default target is 10 Chrono Crew and 4 local allies.

The 14-member Chrono Crew is the full organization, not the number
automatically sent on every operation. The player selects or assigns
9--10 crew members for the expedition; the remaining members stay at the
facility.

### 10.3 Local thematic allies

Local allies are actual characters assigned to the friendly expedition.
They are not merely skins or temporary visual variants.

For example, a Wild West operation might include:

-   10 selected Chrono Crew members.
-   A Sheriff.
-   A Gunslinger.
-   A Prospector.
-   An Outlaw.

These four characters represent the local theme and fight as part of the
friendly side.

The opposing roster can include bandits, train robbers, bounty hunters,
a corrupt marshal, and an outlaw boss.

### 10.4 Meet characters before unlocking them

The campaign should introduce local allies through play before making
them permanent roster unlocks.

This creates a natural progression: 1. The player enters a new sector.
2. The local characters are introduced as expedition allies. 3. They
participate in the campaign matches. 4. Completing map objectives or
sector milestones unlocks them for general play.

The player gets to experience the characters in context before deciding
how to use them elsewhere.

### 10.5 Reward timing

The four local allies do not all need to unlock at once. A sector can
distribute them across its maps.

Example:

  Campaign milestone   Wild West reward example
  -------------------- ----------------------------------------------------
  Complete map 1       Sheriff unlocked
  Complete map 2       Gunslinger unlocked
  Complete map 3       Prospector and Outlaw unlocked; sector boss reward

The exact distribution is authored in sector data. A character who is an
enemy or boss can also be unlocked after the appropriate victory.

### 10.6 Expedition continuity

The same expedition concept should carry through all three maps in a
sector.

Recommended behavior: - Preserve the assigned roster across the sector's
map sequence. - Allow the player to review or change the selected Chrono
Crew between missions if the campaign design supports it. - Keep the
sector's thematic ally selection tied to the destination. - Do not
require the player to rebuild the entire roster before every map.

A later feature could support persistent squad injuries, relationships,
or other expedition state, but these are not required for the initial
campaign.

### 10.7 Convergence expeditions

Convergence Zones combine two themes, so their expedition roster can
draw allies from both prerequisite sectors.

Example: **Pharaoh.exe** (Egypt + Cyberpunk)

-   10 Chrono Crew members.
-   2 Egyptian allies.
-   2 Cyberpunk allies.
-   Total: 14.

A Convergence Zone may also introduce exclusive hybrid characters. These
can be expedition allies, enemies, bosses, or unlock rewards.

The split between the two themes should be configurable. Do not assume
every convergence uses exactly two allies from each sector if a
different composition better serves the encounter.

### 10.8 Enemy roster and active combatants

Keep these concepts separate in the implementation:

-   **Expedition roster:** The 14 friendly characters assigned to the
    operation.
-   **Enemy roster:** The opposing characters assigned to the encounter.
-   **Active combatants:** The characters currently participating in the
    arena.
-   **Reinforcements:** Characters who enter later as part of encounter
    progression.

A 14v14 encounter is a natural default concept, but the campaign should
also support 14vN encounters, smaller encounters, waves, and boss
fights.

The roster model should not force every assigned character to be active
simultaneously. The encounter configuration and the game's
performance/player-count limits determine how many characters are
present at once.

### 10.9 Roster customization

The player should ideally be able to choose which Chrono Crew members
join an expedition, within the configured crew count.

The thematic allies are normally determined by the sector. This gives
each destination a recognizable identity while still allowing the player
to personalize the recurring team.

The initial implementation can use a fixed default Chrono Crew selection
if a full selection UI is not ready. The data model should leave room
for customization later.

## 11. Progression and Persistence Architecture

### 11.1 Design principles

Campaign progression should be: - Data-driven. - Persisted independently
of active match state. - Evaluated through explicit completion events. -
Separate from map rendering and combat simulation. - Expandable without
rewriting the progression system.

### 11.2 Suggested data models

The following TypeScript interfaces are illustrative starting points.
Adapt naming, persistence, validation, and state management to the
project's existing architecture.

``` ts
type EncounterType = "standard" | "boss";

interface TemporalSector {
  id: string;
  name: string;
  description: string;
  classification: string;
  themeTags: string[];
  mapIds: [string, string, string];
  bossCharacterId: string;
  localAllyCharacterIds: string[];
  unlockCharacterIds: string[];
  expeditionConfig: ExpeditionConfig;
  artwork?: string;
}

interface CampaignMap {
  id: string;
  name: string;
  sectorId: string;
  sequence: number;
  mapAssetId: string;
  encounterType: EncounterType;
  unlockRequirements: {
    previousMapId?: string;
  };
}

interface ExpeditionConfig {
  chronoCrewCount: number;
  thematicAllyCount: number;
  thematicAllyCharacterIds: string[];
  defaultChronoCrewIds?: string[];
  unlockRewards: {
    mapId: string;
    characterIds: string[];
  }[];
}

interface ConvergenceZone {
  id: string;
  name: string;
  description: string;
  requiredSectors: [string, string];
  mapIds: string[];
  bossCharacterId: string;
  unlockCharacterIds: string[];
  themeTags: string[];
  expeditionConfig: ConvergenceExpeditionConfig;
  artwork?: string;
}

interface ConvergenceExpeditionConfig {
  chronoCrewCount: number;
  sectorACharacterIds: string[];
  sectorBCharacterIds: string[];
  exclusiveCharacterIds: string[];
}

interface CampaignProgress {
  completedMapIds: string[];
  repairedSectorIds: string[];
  discoveredConvergenceIds: string[];
  repairedConvergenceIds: string[];
  unlockedCharacterIds: string[];
  recoveredCrewIds: string[];
  discoveredSectorIds: string[];
}
```

The interfaces are conceptual. In particular, avoid duplicating data
that already exists in the character, map, or match configuration
systems. Prefer stable IDs and references to canonical content
definitions.

### 11.3 Unlock evaluation

A Convergence Zone should be discovered when both of its prerequisite
sectors are repaired.

Illustrative logic:

``` ts
function evaluateConvergenceUnlocks(
  progress: CampaignProgress,
  zones: ConvergenceZone[]
): string[] {
  const newlyDiscovered: string[] = [];

  for (const zone of zones) {
    if (progress.discoveredConvergenceIds.includes(zone.id)) {
      continue;
    }

    const [sectorA, sectorB] = zone.requiredSectors;

    const bothRepaired =
      progress.repairedSectorIds.includes(sectorA) &&
      progress.repairedSectorIds.includes(sectorB);

    if (bothRepaired) {
      progress.discoveredConvergenceIds.push(zone.id);
      newlyDiscovered.push(zone.id);
    }
  }

  return newlyDiscovered;
}
```

Production implementation should use the project's normal immutable
state/update conventions, validation, and persistence flow rather than
mutating saved state directly if that conflicts with existing
architecture.

### 11.4 Completion event flow

A typical campaign completion flow:

1.  Match reports its result.
2.  Campaign progression validates that the match belongs to a campaign
    map.
3.  The map completion is recorded.
4.  Character rewards for that milestone are granted.
5.  The next map in the sector becomes available.
6.  If the final map was completed, the sector is marked repaired.
7.  Convergence eligibility is evaluated.
8.  Any newly discovered operation is recorded.
9.  The Operations Database refreshes from the updated campaign state.

Progression should be idempotent: replaying a completion event must not
duplicate unlocks or repeatedly trigger the same discovery.

### 11.5 Persistence

Persist at least: - Completed campaign maps. - Repaired sectors. -
Discovered and repaired Convergence Zones. - Unlocked characters. -
Recovered crew, if that feature is implemented. - Any selected
expedition configuration that should survive between sessions.

Do not rely on the active match session as the source of truth for
campaign progress.

## 12. Relationship to Other Game Modes

The campaign is one way to experience the game's maps and characters,
not the only way.

General principles: - Campaign-specific unlocks can expand the player's
general character roster. - Custom matches should support flexible
teams, bots, maps, and encounter settings. - Campaign map sequencing
should not constrain custom match setup. - Campaign bosses may be reused
as playable characters or special match opponents where appropriate. -
The campaign's 14-character expedition concept should not be imposed on
unrelated game modes unless those modes explicitly use it.

Keep campaign-specific rules in campaign configuration and encounter
setup rather than embedding them into the core character or arena
systems.

## 13. Development Priorities

### Phase 1 --- Campaign foundation

-   Define sector, map, boss, reward, and progression data.
-   Implement map completion tracking.
-   Implement sequential map unlocking within a sector.
-   Implement sector repaired status.
-   Implement persistent character unlock rewards.
-   Build the first version of the Operations Database.

### Phase 2 --- Expedition system

-   Define the 14-character expedition roster.
-   Support 9--10 selected Chrono Crew members.
-   Support 4--5 local thematic allies.
-   Keep assigned rosters separate from active combatants.
-   Configure enemy rosters and encounter sizes independently.
-   Introduce local allies in campaign encounters.

### Phase 3 --- Convergence discovery

-   Define curated two-sector pairings.
-   Evaluate prerequisites after sector repair.
-   Add newly discovered operations to the database.
-   Trigger a skippable discovery notification.
-   Support Convergence Zone map progression and rewards.

### Phase 4 --- Campaign polish

-   Add short briefings and crew dialogue.
-   Add boss introductions and completion presentation.
-   Improve sector artwork and database visual hierarchy.
-   Add optional crew recovery or deeper expedition continuity if it
    adds meaningful gameplay.

### Suggested initial content scope

Start with a small number of complete sectors using existing content. A
strong first vertical slice could include: - One historical sector. -
One modern or industrial sector. - One future or science-fiction
sector. - One Convergence Zone unlocked by completing two of those
sectors.

This tests the full loop without requiring the entire catalog.

## 14. Acceptance Criteria

The campaign foundation is successful when:

-   The player can discover and select available sectors without
    following one global linear order.
-   Each standard sector supports sequential map progression.
-   Completing a sector marks it as repaired.
-   Character rewards are granted once and persist.
-   A sector's expedition can combine Chrono Crew and local thematic
    allies into a 14-character friendly roster.
-   The player can distinguish the assigned expedition roster from the
    characters currently active in a match.
-   Encounter configurations can support 14v14, 14vN, reinforcements,
    and boss encounters without hard-coding one team size into campaign
    progression.
-   Convergence Zones remain completely hidden until both prerequisite
    sectors are repaired.
-   Completing the second prerequisite sector discovers the appropriate
    Convergence Zone exactly once.
-   Newly discovered operations appear in the Operations Database.
-   Campaign progression does not unnecessarily restrict custom matches
    or other game modes.
-   New sectors and convergence pairings can be added through
    data/configuration rather than requiring new progression code for
    each one.

## 15. Final Design Principles

1.  **Arcade first.** The campaign exists to support fun matches, not
    slow them down.
2.  **Flexible order.** Players choose which available sectors to
    tackle.
3.  **Three-map rhythm.** A compact, recognizable progression loop gives
    each theme a beginning, escalation, and payoff.
4.  **Characters matter.** Local allies are introduced through play and
    become meaningful unlock rewards.
5.  **The crew is the connective tissue.** The recurring Chrono Crew
    gives the campaign continuity across wildly different settings.
6.  **Fourteen is the expedition identity.** A standard campaign
    expedition assigns 14 friendly characters, typically 9--10 crew and
    4 local allies.
7.  **Roster is not active count.** Encounter size and active combatants
    remain independently configurable.
8.  **Secrets are discovered.** Convergence Zones do not appear in the
    database before their prerequisites are met.
9.  **Curate crossovers.** Only create convergence pairings that produce
    a strong visual or gameplay concept.
10. **Data drives content.** Sectors, maps, characters, rewards, and
    unlock requirements should be defined through data.
11. **Build incrementally.** Prove the loop with a few complete sectors
    before expanding the catalog.
12. **Keep it light.** Briefings, dialogue, and lore should add charm
    without demanding attention.

------------------------------------------------------------------------

## 16. Implementation Notes for Development Agents

### 16.1 Keep systems decoupled

Do not make the campaign system responsible for: - Character movement or
combat behavior. - Arena simulation. - Bot decision-making. - Rendering
map assets. - General-purpose match team sizing. - Character asset
loading beyond referencing canonical character IDs.

Campaign progression should assign content and record results. Existing
match and character systems should remain responsible for their own
domains.

### 16.2 Recommended ownership boundaries

  -----------------------------------------------------------------------
  System                              Responsibility
  ----------------------------------- -----------------------------------
  Campaign content definitions        Sector, map sequence, boss,
                                      rewards, prerequisite data

  Campaign progression                Completion state, unlocks, repaired
                                      sectors, discoveries

  Expedition builder                  Compose the friendly 14-character
                                      assignment

  Match/encounter configuration       Enemy roster, active combatants,
                                      reinforcements, encounter rules

  Character system                    Character definitions, assets,
                                      abilities, general unlock state

  Operations Database UI              Display discovered campaign state
                                      and launch available missions
  -----------------------------------------------------------------------

### 16.3 Important implementation safeguards

-   Use stable IDs for all sectors, maps, characters, and convergence
    zones.
-   Validate that every sector's map references and character references
    resolve.
-   Validate that a standard expedition composition totals 14.
-   Permit authored exceptions only through explicit configuration.
-   Ensure local ally IDs are valid characters.
-   Ensure Convergence Zone prerequisites reference valid sectors.
-   Make reward grants and discovery events idempotent.
-   Do not show undiscovered convergence metadata in player-facing UI.
-   Do not assume all 14 assigned characters spawn simultaneously.
-   Avoid duplicating canonical character or map definitions inside
    campaign data.
-   Keep campaign content additions possible without changes to core
    combat code.

### 16.4 Suggested first implementation test

Create two small test sectors and one convergence pairing:

-   Sector A: a historical theme with three maps and four local allies.
-   Sector B: a contrasting modern or science-fiction theme with three
    maps and four local allies.
-   Convergence: a curated hybrid operation requiring both sectors to be
    repaired.

Verify: 1. Either sector can be started first. 2. Each sector's maps
unlock in sequence. 3. Its 14-character expedition roster is assembled
correctly. 4. Local allies participate in encounters. 5. Character
rewards persist after each milestone. 6. Repairing only one sector does
not reveal the convergence. 7. Repairing the second sector reveals the
convergence once. 8. The convergence roster can draw allies from both
prerequisite sectors. 9. Replaying completed maps does not duplicate
rewards. 10. Custom matches remain independent of campaign progression.

**End of document.**
