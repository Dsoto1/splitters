/**
 * Outpost Siege, grown from a single line of rooms into a mission with
 * choices: approach the courtyard down the middle or round the north and
 * south flanks (each with a Syndicate patrol), then hold the uplink against
 * waves that now pour in from deeper rooms north and south. The mission
 * logic is unchanged, and the new side rooms are walled off from the gated
 * area, so the gate and the extraction door are still the only ways on.
 *
 * Grid (x east, y north; one cell = 8 m). Existing cells in capitals:
 *
 *   y 2                      n
 *   y 1   a  -  f   NORTH
 *   y 0   LANDING CORR COURT  UPLINK  EXTRACT
 *   y-1   b  -  g   SOUTH
 *   y-2                      s
 *        x 0  1  2    3        4
 *
 *   a/b flank rooms, - flank corridors, f/g courtyard side rooms (walled on the
 *   east), n/s staging rooms the siege waves come through
 */
import { MapBuilder } from '../mapkit.ts';

const m = MapBuilder.extend('m4_outpost');

for (const side of [1, -1] as const) {
  m.tile('room', 0, side);
  m.tile('corridor', 1, side, 0, 1);
  m.tile('room', 2, side);
  m.breakable('crate', [14.5, 0, side * 6.5]).breakable('crate', [17.5, 0, side * 9.5]);
  // The side rooms must not open into the gated uplink wings.
  m.edge(2, side, 0, 'E', 'wall');
  m.tile(side === 1 ? 'room_pillar' : 'room_columns', 3, side * 2);
}

// A patrol on each flank: optional fights, the courtyard guards are still the objective.
for (const [y, name] of [[1, 'north'], [-1, 'south']] as const) {
  m.add({
    kind: 'encounter',
    id: `g_enc_patrol_${name}`,
    position: [8, 0, y * 8],
    yaw: Math.PI,
    faction: 'syndicate',
    roster: { trooper: 2, gunner: 0, heavy: 0 },
    activeCap: 2,
    reinforcements: 0,
    perPlayer: 0,
    respawnSeconds: 5,
    radius: 3,
    order: 'hold',
    orderTarget: null,
    startActive: true,
    difficulty: 'normal',
  });
}

// Supplies along the flanks and in the staging rooms.
m.pickup('ammo', [0, 0, 9]);
m.pickup('health_small', [0, 0, -9]);
m.pickup('weapon_smg', [16, 0, 9]);
m.pickup('armor_small', [16, 0, -9]);
m.pickup('health_small', [26, 0, 16]);
m.pickup('ammo', [22, 0, -16]);
m.breakable('crate', [-2, 0, 10.5]).breakable('barrel', [2, 0, -10.5]);

m.meta({
  description: 'Fight through the courtyard (or round its flanks), open the gate, hold the uplink while the Syndicate storms in from north and south, then reach evac.',
  modes: ['core.coop'],
  players: [1, 4],
});

await m.save();
