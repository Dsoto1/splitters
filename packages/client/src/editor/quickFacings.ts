import { QUICK_FACINGS } from '@tiletrigger/shared';

/** Compass names of the quick facings (yaw 0 faces +Z, north; 90° faces +X, east). */
const NAMES: Record<number, string> = { 0: 'north', 90: 'east', 180: 'south', 270: 'west' };

/**
 * The inspector's quick facings (MapMaker overhaul Phase 3, item 9): 0°, 90°, 180°, 270° in one click
 * (setFacingCommand: one undo step), the one it faces now lit. `facing`: the current facing (radians).
 */
export function quickFacings(facing: number, pick: (deg: number) => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'row ed-quick-facings';
  const label = document.createElement('span');
  label.textContent = 'Face';
  const group = document.createElement('div');
  group.className = 'seg';
  const now = ((Math.round((facing * 180) / Math.PI) % 360) + 360) % 360;
  for (const deg of QUICK_FACINGS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.facing = String(deg);
    b.textContent = `${deg}°`;
    b.title = `Face ${NAMES[deg]} (${deg}°)`;
    b.classList.toggle('active', now === deg);
    b.addEventListener('click', () => pick(deg));
    group.append(b);
  }
  row.append(label, group);
  return row;
}
