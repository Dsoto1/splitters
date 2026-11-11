import { BUDGET_ROWS, countBudgets } from '../editor/budgetCounters.ts';
import { raycastBoxes } from '../editor/raycast.ts';
import { viewDirection } from '../math.ts';
import { buildMapGeometry } from './geometry.ts';
import type { MapDocument } from './schema.ts';

/**
 * Tiers and quality gates for maps (owner, 2026-11-11). A map is `core` (the roster the game is judged by: Quick Play,
 * playlists, official rotations) or `experimental` (offered under its own heading, left out of those). To be core a
 * map passes every gate; for an experimental one the gates only report. The tier is the map's own, set in MapMaker's
 * Map properties (`metadata.tier`; absent = core, as every map offered before the tiers).
 *
 * The gates here need only the map (MapMaker shows them and refuses a promotion that fails one). `pnpm quality-gates`
 * adds the ones that need the simulation: the navigation audit and a bots-only match.
 */
export type MapTier = 'core' | 'experimental';
export const MAP_TIERS: readonly MapTier[] = ['core', 'experimental'];
export const MAP_TIER_LABELS: Record<MapTier, string> = { core: 'Core', experimental: 'Experimental' };

export const mapTier = (meta: { tier?: MapTier | undefined }): MapTier => meta.tier ?? 'core';

export interface GateResult {
  id: string;
  /** What it checks, in a few words. */
  label: string;
  pass: boolean;
  /** What was found. */
  note: string;
}

/** A card shot looking at something solid nearer than this (m) is a picture of a wall. */
export const CARD_CLEAR_AHEAD = 6;

/** The gates that need only the map: spawn points for its players, its budgets, its card shot. */
export function mapGates(doc: MapDocument): GateResult[] {
  const out: GateResult[] = [];
  const spawns = doc.entities.filter((e) => e.kind === 'spawn').length;
  const most = doc.metadata.recommendedPlayers.max;
  out.push({ id: 'spawns', label: 'Spawn points for its players', pass: spawns >= most, note: `${spawns} spawn point${spawns === 1 ? '' : 's'} for up to ${most} players` });
  const counts = countBudgets(doc);
  const over = BUDGET_ROWS.filter((r) => counts[r.id] > r.max);
  out.push({ id: 'budgets', label: 'Within its budgets', pass: !over.length, note: over.length ? over.map((r) => `${r.label}: ${counts[r.id]} of ${r.max}`).join('; ') : 'nothing over' });
  const cam = doc.metadata.cardCamera;
  if (!cam) out.push({ id: 'card', label: 'Card shot not facing a wall', pass: true, note: 'the automatic view' });
  else {
    const d = viewDirection(cam.yaw, cam.pitch);
    const hit = raycastBoxes({ x: cam.position[0], y: cam.position[1], z: cam.position[2] }, d, buildMapGeometry(doc));
    const clear = !hit || hit.distance >= CARD_CLEAR_AHEAD;
    out.push({ id: 'card', label: 'Card shot not facing a wall', pass: clear, note: clear ? (hit ? `${hit.distance.toFixed(0)} m of view` : 'open view') : `something solid ${hit!.distance.toFixed(1)} m in front of the camera` });
  }
  return out;
}
