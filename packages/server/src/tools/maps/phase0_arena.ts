/**
 * Phase 0 Arena: the first graybox, kept as a duel map. At about 27 × 27 m
 * with an upper floor it's the right size for 2–4 players (roughly
 * 800–1,500 m² of floor), so it's labelled that way instead of being grown.
 */
import { MapBuilder } from '../mapkit.ts';

const m = MapBuilder.extend('phase0_arena');
m.lightRooms();
m.meta({
  description: 'Duel arena: a graybox loop around a pillar hall with an upper floor. Tight and fast, for 2–4 players.',
  modes: ['core.deathmatch'],
  players: [2, 4],
});
await m.save();
