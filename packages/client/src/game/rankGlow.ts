/**
 * A rank-up's moment (Options → Ranks & badges; owner, 2026-11-18: "its badge quietly swells, glows in the team
 * colour, then settles back over about a second"). The badge over the head (view.ts) and in the kill feed (style.css
 * `rank-up`, the same curve) grows and a soft halo in its colour rises and fades. With Reduce flashing on it is
 * smaller and dimmer and eases in and out: a soft glow, never a flash (docs/LOOK.md, "Reduce flashing").
 */

/** How long it lasts (s). */
export const RANK_GLOW_SECONDS = 1;
/** How far the badge swells and how bright the halo gets at most: normally, and with Reduce flashing on. */
export const RANK_GLOW = { normal: { swell: 0.45, glow: 0.55 }, calm: { swell: 0.2, glow: 0.3 } } as const;

/** The moment `t` seconds in: the badge's scale and the halo's opacity; null once it's over. */
export function rankGlow(t: number, calm: boolean): { scale: number; glow: number } | null {
  if (!(t >= 0) || t >= RANK_GLOW_SECONDS) return null;
  const u = t / RANK_GLOW_SECONDS;
  const k = calm ? RANK_GLOW.calm : RANK_GLOW.normal;
  // Up quickly (a quarter of the time), then settles back; calm: a slow, even rise and fall.
  const shape = calm ? Math.sin(Math.PI * u) ** 2 : u < 0.25 ? Math.sin((u / 0.25) * (Math.PI / 2)) : Math.cos(((u - 0.25) / 0.75) * (Math.PI / 2)) ** 2;
  return { scale: 1 + k.swell * shape, glow: k.glow * shape };
}
