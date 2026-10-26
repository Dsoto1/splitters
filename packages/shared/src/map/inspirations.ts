/**
 * The famous maps our homage maps are recreated from (layouts only: our own
 * names, assets and tiles). Shown as "Inspired by …" in the map picker.
 * Keyed by map id; imported TimeSplitters maps say where they came from.
 */
export const MAP_INSPIRATIONS: Readonly<Record<string, string>> = {
  bottling: 'Facility (GoldenEye 007)',
  step_temple: 'Temple (GoldenEye 007)',
  silo_complex: 'Complex (GoldenEye 007)',
  reactor: 'Nuke (Counter-Strike)',
  lantern_quarter: 'Italy (Counter-Strike)',
  jade_sanctum: 'Temple (GoldenEye 007)',
  concrete_annex: 'Complex (GoldenEye 007)',
  pump_tower: 'Stack (GoldenEye 007)',
  sandgate: 'Dust (Counter-Strike)',
  dockside_depot: 'Assault (Counter-Strike)',
  backwoods: 'Militia (Counter-Strike)',
  jungle_steps: 'Aztec (Counter-Strike)',
  bunker_cross: 'Crossfire (Half-Life Deathmatch)',
  rail_stockyard: 'Stalkyard (Half-Life Deathmatch)',
  void_yard: 'The Longest Yard (Quake III Arena)',
  twin_spires: 'Facing Worlds (Unreal Tournament)',
  frost_basin: 'Katabatic (Tribes 2)',
  gallows_yard: "Hang 'Em High (Halo)",
  coldwater_gulch: 'Blood Gulch (Halo)',
  dead_reel: 'Kino der Toten (Call of Duty: Black Ops)',
  kanto_plaza: 'Nakatomi Plaza (Die Hard)',
  shingle_point: 'the D-Day beach landings (1944)',
  atomic_court: 'Nuketown (Call of Duty: Black Ops)',
  fallout_lane: 'Nuketown (Call of Duty: Black Ops)',
  glasswork_office: 'Office (Counter-Strike)',
  razor_edge: 'The Edge (Quake II)',
  stonewatch_keep: "Helm's Deep (The Lord of the Rings: The Two Towers)",
  serpent_gorge: 'the Indiana Jones films',
  undergate_transit: 'the transit system (Half-Life)',
  iron_tide: 'Assault Ship (Counter-Strike: Condition Zero)',
  capitol_mall: 'the National Mall, Washington, D.C.',
  executive_grounds: 'the White House, Washington, D.C.',
  norman_shores: 'Lake Norman, North Carolina',
  primeval_park: 'Jurassic Park',
  starhaven: 'the Enterprise (Star Trek)',
  lucky_strip: 'the Las Vegas Strip',
  obsidian_orb: 'the Death Star (Star Wars)',
  dune_harbor: 'Mos Eisley (Star Wars)',
  fernwood_moon: 'Endor (Star Wars)',
  glacier_line: 'Hoth (Star Wars)',
};

/** "Inspired by …" for a map, if it has one (imported TimeSplitters maps name their game). */
export function mapInspiration(id: string): string | null {
  if (MAP_INSPIRATIONS[id]) return MAP_INSPIRATIONS[id]!;
  if (id.startsWith('ts2_')) return 'a TimeSplitters 2 MapMaker map';
  if (id.startsWith('tsfp_')) return 'a TimeSplitters: Future Perfect MapMaker map';
  return null;
}
