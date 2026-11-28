import { PLAYER } from '@tiletrigger/shared';

/** The zone names a Practice Target's report uses (the `thit` event's `z`). */
const ZONES = ['Body', 'Head', 'Legs'] as const;

/**
 * Your hit on a Practice Target (map v55, the `thit` event) as the HUD shows it: the zone, how far, the pellets when a
 * shot sent more than one, what it would do to a player there, and how many such hits down a fresh one (full health,
 * no armour). A blast (no distance) says so. "Head · 42 m · 96 · 2 hits to down". The damage comes from the host with the
 * match's combat rules in it (headshots, damage scale); `healthScale` (combat rules: effective health) scales the "fresh one".
 */
export function targetReadout(ev: { z: number; n: number; d: number; p?: number }, healthScale = 1): string {
  const dmg = Math.max(0, Math.round(ev.n));
  const hits = dmg > 0 ? Math.ceil((PLAYER.maxHealth * healthScale) / dmg) : 0;
  const parts = [ev.d > 0 ? `${ZONES[ev.z] ?? 'Body'} · ${ev.d} m` : 'Blast'];
  if (ev.p && ev.p > 1) parts.push(`${ev.p} pellets`);
  parts.push(String(dmg));
  if (hits > 0) parts.push(hits === 1 ? '1 hit to down' : `${hits} hits to down`);
  return parts.join(' · ');
}
