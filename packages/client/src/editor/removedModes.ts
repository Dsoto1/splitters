import { withoutRemovedModes } from '@tiletrigger/shared';

/**
 * Map properties, for a map that still lists a mode the game no longer has (Race, removed 2026-11-09): a note and a
 * button that drops it from the map's modes. The track and its NPC cars stay.
 */
export function removedModesRow(modes: readonly string[], drop: (next: string[]) => void): HTMLElement {
  const box = document.createElement('div');
  box.id = 'ed-prop-removed-modes';
  box.className = 'ed-note';
  box.textContent = 'This map still lists Race, which is no longer a mode: Match Setup leaves it out. Its track keeps its NPC traffic. ';
  const b = document.createElement('button');
  b.id = 'ed-prop-drop-race';
  b.textContent = 'Drop Race';
  b.title = 'Take Race off this map’s modes (undo brings it back)';
  b.addEventListener('click', () => drop(withoutRemovedModes(modes)));
  box.append(b);
  return box;
}
