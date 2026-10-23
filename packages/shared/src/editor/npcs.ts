import { PLAYERS_FACTION, type EncounterEntity, type Faction, type MapDocument, type NpcRole, type SquadOrder } from '../map/schema.ts';
import { DEFAULT_FACTIONS, mapFactions, relation } from '../sim/npc.ts';
import { newId, type EditCommand } from './commands.ts';

/**
 * MapMaker's NPC palette. The sim spawns NPCs only through encounters (a
 * squad marker with a roster of troopers, gunners and heavies), so every entry
 * here is a preconfigured encounter: a lone soldier of one role, or a squad.
 * Everything stays editable in the inspector afterwards.
 */
export interface NpcPaletteEntry {
  key: string;
  label: string;
  blurb: string;
  search: string;
  roster: Record<NpcRole, number>;
  order: SquadOrder;
  activeCap: number;
  reinforcements: number;
  perPlayer: number;
  radius: number;
  /** Fights for the players (adds a Militia faction to the map when it has no ally faction). */
  ally?: boolean;
}

export const NPC_PALETTE: readonly NpcPaletteEntry[] = [
  { key: 'trooper', label: 'Trooper', blurb: 'One rifleman guarding this spot', search: 'trooper soldier guard rifle single npc enemy', roster: { trooper: 1, gunner: 0, heavy: 0 }, order: 'hold', activeCap: 1, reinforcements: 0, perPlayer: 0, radius: 1 },
  { key: 'gunner', label: 'Gunner', blurb: 'One shotgunner guarding this spot', search: 'gunner shotgun soldier guard single npc enemy', roster: { trooper: 0, gunner: 1, heavy: 0 }, order: 'hold', activeCap: 1, reinforcements: 0, perPlayer: 0, radius: 1 },
  { key: 'heavy', label: 'Heavy', blurb: 'One tough grenadier guarding this spot', search: 'heavy grenade launcher tank brute single npc enemy', roster: { trooper: 0, gunner: 0, heavy: 1 }, order: 'hold', activeCap: 1, reinforcements: 0, perPlayer: 0, radius: 1 },
  { key: 'squad', label: 'Squad', blurb: 'Two troopers and a gunner holding this area', search: 'squad group soldiers encounter team npc enemy', roster: { trooper: 2, gunner: 1, heavy: 0 }, order: 'hold', activeCap: 4, reinforcements: 0, perPlayer: 1, radius: 3 },
  { key: 'hunters', label: 'Hunter Squad', blurb: 'Four soldiers that hunt the players down', search: 'hunter squad attack hunt assault soldiers npc enemy', roster: { trooper: 2, gunner: 1, heavy: 1 }, order: 'attack', activeCap: 4, reinforcements: 0, perPlayer: 1, radius: 3 },
  { key: 'waves', label: 'Reinforced Squad', blurb: 'A squad that keeps getting reinforcements', search: 'waves reinforcements horde endless spawner squad npc enemy', roster: { trooper: 2, gunner: 1, heavy: 0 }, order: 'attack', activeCap: 4, reinforcements: 12, perPlayer: 2, radius: 4 },
  { key: 'militia', label: 'Allied Militia', blurb: 'Friendly soldiers that follow the players', search: 'ally allied militia friendly follow escort squad npc', roster: { trooper: 2, gunner: 1, heavy: 0 }, order: 'follow', activeCap: 3, reinforcements: 0, perPlayer: 0, radius: 2, ally: true },
];

export const MILITIA_FACTION: Faction = { id: 'militia', name: 'Militia', color: '#5cc77a', relations: { [PLAYERS_FACTION]: 'ally', syndicate: 'enemy' } };

/**
 * Place an NPC palette entry: one encounter entity, plus (for allies on a map
 * with no friendly faction yet) the Militia faction. One undo step.
 */
export function placeNpcCommand(doc: MapDocument, key: string, position: [number, number, number], yaw: number): { command: EditCommand; id: string; label: string } | { error: string } {
  const entry = NPC_PALETTE.find((e) => e.key === key);
  if (!entry) return { error: `unknown NPC "${key}"` };
  const factions = mapFactions(doc);
  const side = (want: 'ally' | 'enemy') => factions.find((f) => relation(factions, f.id, PLAYERS_FACTION) === want);
  const commands: EditCommand[] = [];
  let faction = entry.ally ? side('ally')?.id : (side('enemy')?.id ?? factions[0]!.id);
  if (!faction) {
    const before = doc.factions;
    const after = [...(before.length ? before : DEFAULT_FACTIONS), MILITIA_FACTION];
    commands.push({ kind: 'setFactions', before: [...before], after });
    faction = MILITIA_FACTION.id;
  }
  const id = newId('squad');
  const entity: EncounterEntity = {
    id,
    kind: 'encounter',
    position,
    yaw,
    faction,
    roster: { ...entry.roster },
    activeCap: entry.activeCap,
    reinforcements: entry.reinforcements,
    perPlayer: entry.perPlayer,
    respawnSeconds: 4,
    radius: entry.radius,
    order: entry.order,
    orderTarget: null,
    startActive: true,
    difficulty: 'normal',
  };
  commands.push({ kind: 'addEntities', entities: [entity] });
  return { command: commands.length === 1 ? commands[0]! : { kind: 'batch', commands }, id, label: entry.label };
}
