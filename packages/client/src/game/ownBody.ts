/** The view the vehicle camera gives a rider (VehicleCamera's CameraPose.mode), or null on foot. */
export type RideView = 'cockpit' | 'chase' | 'seat' | null;

/**
 * Whether your own character is drawn as everyone else sees it (a body in the world, not the first-person arms or
 * full-body rig) this frame.
 * - On foot: in third person, unless the camera is squeezed against a wall (`tpClose`: the body would fill the view).
 * - In a seat (driver, gunner or passenger): only in the chase view, sitting on the seat as other riders are drawn
 *   (owner, 2026-11-08: the driver's seat looked empty). The cockpit and the seat views are from your own eyes, where
 *   the body would block the camera, so it stays hidden as in first person; the on-foot third-person toggle doesn't
 *   apply in a seat (H there switches the driver's cockpit and chase views).
 * - Dead: never (the body goes as it does on foot; the kill cam and spectating watch others).
 */
export function ownBodyDrawn(o: { alive: boolean; seated: boolean; rideView: RideView; thirdPerson: boolean; tpClose: boolean }): boolean {
  if (!o.alive) return false;
  if (o.seated) return o.rideView === 'chase';
  return o.thirdPerson && !o.tpClose;
}
