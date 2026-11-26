import { isTrainingMap, isUnlistedMap } from '@tiletrigger/shared';

/**
 * A saved setup (the last one, or one saved by name) whose map left the list (retired: RETIRED_MAPS, or a training map):
 * the line saying so and where it plays now, or null when its map is simply not here.
 */
export function unlistedMapNotice(id: unknown, instead: string): string | null {
  if (typeof id !== 'string' || !isUnlistedMap(id)) return null;
  const name = id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return `${name} ${id === 'practice_range' ? 'is only on Quick Play → Practice range' : isTrainingMap(id) ? 'is only on Profile → Test weapons now' : 'is retired'}: your setup plays ${instead} instead.`;
}
