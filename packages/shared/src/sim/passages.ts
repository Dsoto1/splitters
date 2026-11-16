/**
 * Doorways narrower than the bots' navmesh keeps open (it stays 0.8 m off walls, so it closes any gap under about
 * 1.8 m), walked through on a link instead: a kit family that says `passage` (content/kitprops, the slim Oak Door
 * standing open: a 1.2 m room door, docs/map-briefs/st_johns) gives a straight walking link each way through its
 * frame, from PASSAGE_REACH before the frame to PASSAGE_REACH beyond it, along the prop's own z. A body (0.4 m round)
 * fits the doorway; the link is only where the navmesh can't follow it. A shut door says nothing (it is no way in).
 */
import { getKitFamily, isKitModel } from '../content/kitProps.ts';
import type { Vec3 } from '../math.ts';

/** How far each side of a passage's frame its link starts and ends (m): past the wall's depth and the navmesh's 0.8 m. */
export const PASSAGE_REACH = 1.6;

/** The walking links through every passage prop (both ways). */
export function passageLinks(entities: readonly { kind: string; position: [number, number, number]; model?: string; yaw?: number; scale?: number }[]): { start: Vec3; end: Vec3 }[] {
  const out: { start: Vec3; end: Vec3 }[] = [];
  for (const e of entities) {
    if (e.kind !== 'prop' || !e.model || !isKitModel(e.model)) continue;
    const pass = getKitFamily(e.model)?.passage;
    if (!pass) continue;
    const k = e.scale ?? 1;
    const yaw = e.yaw ?? 0;
    // The prop's own (0, 0, z) in the map: x·cos + z·sin, −x·sin + z·cos (map/geometry.ts yawXZ).
    const at = (z: number): Vec3 => ({ x: e.position[0] + z * k * Math.sin(yaw), y: e.position[1], z: e.position[2] + z * k * Math.cos(yaw) });
    const a = at(pass.frame - PASSAGE_REACH / k);
    const b = at(pass.frame + PASSAGE_REACH / k);
    out.push({ start: a, end: b }, { start: b, end: a });
  }
  return out;
}
