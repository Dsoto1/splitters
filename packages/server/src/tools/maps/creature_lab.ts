/**
 * Creature Lab: a co-op mission across a research station (deck, specimen
 * bay east, containment hall north), built from the
 * Quaternius sci-fi kit props, to show the creature NPCs. Three waves: a pack
 * of imps and puglins rushes in, then cyclops and oculus aliens spit from
 * range, then a scolitex brute. Clear all three to win.
 *
 *   z 36  [ containment hall: the brute, pillars        ]
 *   z 20  [ wall, opening at x 0 ]
 *         [ deck: the pack comes from the north     ] [ specimen bay: ]
 *   z  6  [ raised deck, 2 m, stairs south          ]=[ the spitters  ]
 *   z -8  [ players spawn, doorway frame, supplies  ] [ (z -4..20)    ]
 *   z-12  [ walls ]
 *        x -12 .............................. x 12 ......... x 28
 */
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('creature_lab', 'Creature Lab');
m.theme('station');
m.factions([{ id: 'xeno', name: 'Specimens', color: '#8fd14f', relations: {} }]);
const P = Math.PI / 2;

// The deck: 3 × 4 cells of open platform (x -12..12, z -12..20); the specimen bay east of it
// (x 12..28, z -4..20) and the containment hall north (x -12..12, z 20..36).
m.fill('platform', -1, -1, 1, 2);
m.fill('platform', 2, 0, 3, 2);
m.fill('platform', -1, 3, 1, 4);

// ---------------------------------------------------------------- walls (props facing inward), with an opening into each new area
const panels = ['sf_wall_astra_tall', 'sf_wall_window_tall', 'sf_wall_cables_tall', 'sf_wall_band_tall', 'sf_wall_plastic_tall'];
let n = 0;
/** Tall wall panels every 4 m from `from` to `to` along one axis at `at`, skipping the gaps; `yaw` faces inward. */
function wall(axis: 'x' | 'z', at: number, from: number, to: number, yaw: number, gaps: number[] = []): void {
  for (let v = from; v <= to; v += 4) {
    if (gaps.includes(v)) continue;
    const kind = panels[n++ % panels.length]!;
    m.prop(kind, axis === 'x' ? [v, 0, at] : [at, 0, v], yaw);
  }
}
wall('x', -11.6, -10, 10, 0); // deck south
wall('z', -11.4, -10, 18, P); // deck west
wall('z', 11.4, -10, 18, -P, [6, 10]); // deck east: opening into the bay
wall('x', 19.6, -10, 10, Math.PI, [-2, 2]); // deck north: opening into containment
wall('x', -3.6, 14, 26, 0); // bay south
wall('z', 27.4, -2, 18, -P); // bay east
wall('x', 19.6, 14, 26, Math.PI); // bay north
wall('z', -11.4, 22, 34, P); // containment west
wall('z', 11.4, 22, 34, -P); // containment east
wall('x', 35.6, -10, 10, Math.PI); // containment north
m.prop('sf_hanging_cables', [-6, 0, 18.6], Math.PI).prop('sf_hanging_cables', [6, 0, 18.6], Math.PI);

// ---------------------------------------------------------------- specimen bay: tanks and cover
m.prop('sf_crate_large', [16, 0, 2]).prop('sf_crate', [17.2, 0, 3.2]).prop('sf_column_pipes', [24, 0, 2]);
m.prop('sf_low_wall_plates', [20, 0, 8], 0).prop('sf_column_round', [16, 0, 14]).prop('sf_column_round', [24, 0, 14]);
m.prop('sf_computer', [26, 0, 10], -P).prop('sf_barrel', [25, 0, 17]).prop('sf_floor_squares', [20, 0, 16]);

// ---------------------------------------------------------------- containment hall: pillars round the brute's tank
for (const [x, z] of [[-6, 24], [6, 24], [-6, 32], [6, 32]] as const) m.prop('sf_column_pipes', [x, 0, z]);
m.prop('sf_low_wall_triangles', [0, 0, 26], 0).prop('sf_crate_large', [-9, 0, 30]).prop('sf_chest', [9, 0, 33], -P);
m.prop('sf_hanging_cables', [0, 0, 34.6], Math.PI).prop('sf_decal_caution', [0, 0.01, 30]);

// ---------------------------------------------------------------- the raised deck in the middle, stairs up from the south
m.block([0, 0, 6], [6, 2, 6], 'solid', { material: 'pbr_tread_plate' });
m.prop('sf_stairs_wide', [0, 0, 0.96], 0);
m.prop('sf_railing_4', [0, 2, 9], 0).prop('sf_railing_4', [-3, 2, 6], P).prop('sf_railing_4', [3, 2, 6], P);
for (const [x, z] of [[-3.6, 2.6], [3.6, 2.6], [-3.6, 9.4], [3.6, 9.4]] as const) m.prop('sf_column_round', [x, 0, z]);
m.prop('sf_computer', [1.5, 2, 7.5], Math.PI).prop('sf_decal_logo', [0, 0.01, -3], 0);

// ---------------------------------------------------------------- cover and dressing
m.prop('sf_crate_large', [-7, 0, 1]).prop('sf_crate', [-8.2, 0, 2]).prop('sf_barrel', [-6, 0, 2.4]);
m.prop('sf_crate_large', [7, 0, 11], 0.3).prop('sf_chest', [8, 0, 13], -P).prop('sf_barrel', [6, 0, 12.6]);
m.prop('sf_low_wall_triangles', [-6, 0, 14], 0).prop('sf_low_wall_plates', [7, 0, 4], P);
m.prop('sf_column_pipes', [-9, 0, 9]).prop('sf_column_pipes', [9, 0, -2]);
m.prop('sf_pipe_rack', [0, 0, 17], 0).prop('sf_item_holder', [-9, 0, -6], P).prop('sf_floor_light', [9, 0, -9], -P);
m.prop('sf_doorway_a', [0, 0, -9.5], 0);
m.prop('sf_floor_center', [0, 0, -6]).prop('sf_floor_squares', [-6, 0, 16]).prop('sf_floor_squares', [6, 0, 16]);
m.prop('sf_decal_caution', [-3, 0.01, 15]).prop('sf_decal_x', [3, 0.01, 15]).prop('sf_decal_dashes', [0, 0.01, 12.6]);
m.prop('sf_vent', [-8, 0, -2], P).prop('sf_cable_long', [5, 0, -4], 0.4);

// ---------------------------------------------------------------- players, pickups
for (const x of [-4, -1.5, 1.5, 4]) m.spawn([x, 0, -8], 0);
m.pickup('weapon_shotgun', [-8, 0, -9]).pickup('weapon_smg', [8, 0, -6]).pickup('weapon_rockets', [0, 2, 7]);
m.pickup('health_large', [-9, 0, 6]).pickup('health_small', [9, 0, 8]).pickup('armor_large', [0, 0, -1.5]);
m.pickup('ammo_shells', [-6, 0, -6]).pickup('ammo_rifle', [6, 0, -9]);
m.pickup('health_large', [22, 0, 4]).pickup('ammo_rifle', [26, 0, 0]).pickup('weapon_launcher', [18, 0, 18]);
m.pickup('armor_large', [-9, 0, 24]).pickup('health_small', [9, 0, 28]).pickup('ammo_shells', [0, 0, 22]);

// ---------------------------------------------------------------- the creatures
const roster = { trooper: 0, gunner: 0, heavy: 0, imp: 0, puglin: 0, cyclops: 0, oculus: 0, scolitex: 0 };
const squad = { kind: 'encounter', yaw: Math.PI, faction: 'xeno', activeCap: 6, reinforcements: 0, perPlayer: 1, respawnSeconds: 3, radius: 4, order: 'attack', orderTarget: null, difficulty: 'normal' } as const;
m.add({ ...squad, id: 'enc_pack', name: 'Imp pack', position: [0, 0, 15], roster: { ...roster, imp: 3, puglin: 3 }, startActive: true });
m.add({ ...squad, id: 'enc_spitters', name: 'Spitters', position: [22, 0, 12], roster: { ...roster, cyclops: 2, oculus: 2 }, startActive: false });
m.add({ ...squad, id: 'enc_brute', name: 'Brute', position: [0, 0, 31], roster: { ...roster, scolitex: 1 }, activeCap: 1, perPlayer: 0, startActive: false });

const say = (text: string, seconds = 4) => ({ type: 'message' as const, target: null, value: seconds, text, state: '' });
const act = (type: 'encounter_start' | 'objective', target: string, state = '') => ({ type, target, value: 0, text: '', state });
m.logic({
  variables: [],
  timers: [],
  objectives: [
    { id: 'obj_pack', text: 'Put down the imp pack', startActive: true, marker: 'enc_pack' },
    { id: 'obj_spitters', text: 'Destroy the spitting specimens in the bay', startActive: false, marker: 'enc_spitters' },
    { id: 'obj_brute', text: 'Kill the scolitex in containment', startActive: false, marker: 'enc_brute' },
  ],
  rules: [
    { id: 'rule_intro', name: 'Briefing', enabled: true, once: true, when: { event: 'match_start', target: null }, if: [], do: [say('Containment breach! The specimens are loose.', 5)] },
    { id: 'rule_pack', name: 'Pack down: spitters', enabled: true, once: true, when: { event: 'encounter_cleared', target: 'enc_pack' }, if: [], do: [act('objective', 'obj_pack', 'complete'), act('objective', 'obj_spitters', 'active'), act('encounter_start', 'enc_spitters'), say('Spitters breaking out of the specimen bay, east. Keep moving!')] },
    { id: 'rule_spitters', name: 'Spitters down: brute', enabled: true, once: true, when: { event: 'encounter_cleared', target: 'enc_spitters' }, if: [], do: [act('objective', 'obj_spitters', 'complete'), act('objective', 'obj_brute', 'active'), act('encounter_start', 'enc_brute'), say('Something big broke out of its tank in containment, north...')] },
    { id: 'rule_brute', name: 'Brute down: win', enabled: true, once: true, when: { event: 'encounter_cleared', target: 'enc_brute' }, if: [], do: [act('objective', 'obj_brute', 'complete'), say('Lab secured.', 4), { type: 'end_round', target: null, value: 0, text: '', state: 'players win' }] },
  ],
});
m.meta({
  description: 'Co-op: a research station built from the sci-fi kit. Hold the deck against imps and puglins, push into the specimen bay for the spitting cyclops and oculus aliens, then face the scolitex brute in containment.',
  modes: ['core.coop'],
  players: [1, 4],
});
await m.save();
