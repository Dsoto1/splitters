import { BREAK_WALL_HEALTH, breakWallState, setBreakWallsCommand, type EditCommand, type MapDocument } from '@tiletrigger/shared';

/**
 * The inspector's Breakable walls (format v54; shared sim/breakWalls.ts): for the selected tiles and set pieces,
 * "Breakable walls" (every wall of them; ticked when all are, half when some are), how much a wall takes, and
 * whether shots break it too (explosives only otherwise). The tile inspector adds a tick per side (inspector.ts).
 */
export function breakWallPanel(doc: MapDocument, tileIds: readonly string[], pieceIds: readonly string[], run: (label: string, cmd: EditCommand | { error: string }) => unknown): HTMLElement | null {
  const st = breakWallState(doc, tileIds, pieceIds);
  if (!st.of) return null;
  const box = document.createElement('div');
  box.className = 'ed-break-walls';
  box.id = 'ed-break-walls-panel';
  const head = document.createElement('h3');
  head.textContent = 'Breakable walls';
  box.append(head);
  const row = (text: string, title: string, input: HTMLElement) => {
    const label = document.createElement('label');
    label.className = 'row';
    label.title = title;
    const name = document.createElement('span');
    name.textContent = text;
    label.append(name, input);
    box.append(label);
    return label;
  };
  const all = document.createElement('input');
  all.type = 'checkbox';
  all.id = 'ed-break-walls';
  all.checked = st.on === st.of;
  all.indeterminate = st.on > 0 && st.on < st.of;
  const settings = () => ({ ...(health.value && Number(health.value) !== BREAK_WALL_HEALTH.default ? { health: clampHealth(Number(health.value)) } : {}), ...(shots.checked ? { shots: true } : {}) });
  all.addEventListener('change', () => run(all.checked ? 'Make walls breakable' : 'Make walls solid', setBreakWallsCommand(doc, tileIds, pieceIds, all.checked ? settings() : null)));
  row(st.of > 1 ? `Breakable walls (${st.on} of ${st.of})` : 'Breakable walls', 'Every wall of this (a wall it shares with the next piece too) can be blown open: a ragged hole, back next round. Bots still treat it as a wall.', all);
  const health = document.createElement('input');
  health.type = 'number';
  health.id = 'ed-break-health';
  health.min = String(BREAK_WALL_HEALTH.min);
  health.max = String(BREAK_WALL_HEALTH.max);
  health.step = '50';
  health.value = String(st.health ?? BREAK_WALL_HEALTH.default);
  health.addEventListener('change', () => run('Breakable wall health', setBreakWallsCommand(doc, tileIds, pieceIds, settings(), true)));
  const shots = document.createElement('input');
  shots.type = 'checkbox';
  shots.id = 'ed-break-shots';
  shots.checked = st.shots;
  shots.addEventListener('change', () => run(shots.checked ? 'Shots break walls' : 'Only explosives break walls', setBreakWallsCommand(doc, tileIds, pieceIds, settings(), true)));
  const marked = st.on > 0;
  row('Health', `Damage a wall takes before it gives way (a grenade does about 100 close by; ${BREAK_WALL_HEALTH.default} unless set)`, health).hidden = !marked;
  row('Shots break it too', 'Off: only explosives (grenades, rockets, barrels) break it', shots).hidden = !marked;
  return box;
}

const clampHealth = (v: number): number => Math.max(BREAK_WALL_HEALTH.min, Math.min(BREAK_WALL_HEALTH.max, Math.round(Number.isFinite(v) ? v : BREAK_WALL_HEALTH.default)));
