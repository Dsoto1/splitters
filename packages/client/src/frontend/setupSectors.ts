import { SECTOR_CLASS_LABELS, SECTOR_STATUS_LABELS, sectorStatus, storySetupRows, type Convergence, type SetupMapState } from '@tiletrigger/shared';
import { CAMPAIGN, mapLocksActive, myStoryProgress } from '../campaign/storyProgress.ts';
import { el } from './setupControls.ts';

/**
 * Match Setup's Story tab (docs/CAMPAIGN.md, "Match Setup by sector"; owner, 2026-11-25): a row per sector, built
 * from the campaign data (shared campaign/setupRows.ts), so it re-sorts itself as sectors change. A row: the sector's
 * name, kind and status, its maps in play order (the first open; the others dimmed and locked for hosting until won
 * in Story, still joinable), then its 4th tile: Unknown until its convergence is found, then the convergence.
 * Loaded on its own when the tab is first opened (the menu's first download stays under its budget).
 */

const NOTES: Record<SetupMapState, string | undefined> = { open: undefined, won: 'Won ✓', next: 'Next in Story', locked: 'Locked: Story' };

export interface StoryRowsOptions {
  /** A map's card as the grid makes it (picks the map on click), or null when the map isn't listed here. */
  card(map: string, note: string | undefined, state: SetupMapState): HTMLElement | null;
  /** A discovered convergence's tile was picked: its first map. */
  pickConvergence(c: Convergence): void;
  /** A map's name. */
  name(map: string): string;
}

/** Fill `box` (Match Setup's #map-cards) with the Story rows. */
export function drawStoryRows(box: HTMLElement, o: StoryRowsOptions): void {
  const progress = myStoryProgress();
  const rows = storySetupRows(CAMPAIGN, progress, mapLocksActive());
  box.replaceChildren(
    el('p', { class: 'sector-hint', textContent: 'A row per Story sector. Win a map in Story to host the next one; you can always join a match on any map.' }),
    ...rows.map(({ sector, maps, tiles }) => {
      const status = sectorStatus(sector, progress);
      const cards = maps.map(({ map, state }) => o.card(map, NOTES[state], state)).filter((c): c is HTMLElement => !!c);
      const extra = tiles.map((t) => {
        if ('unknown' in t) return el('div', { class: 'sector-tile unknown panel', title: 'The database can’t see that logged event yet' }, el('b', { textContent: '?' }), el('span', { textContent: 'Unknown' }), el('small', { textContent: 'Not logged yet' }));
        const c = t.known;
        const b = el('button', { type: 'button', class: 'sector-tile known panel', id: `setup-conv-${c.id}`, title: `${c.name}: ${c.maps.map(o.name).join(', ')}` }, el('b', { textContent: '⚡' }), el('span', { textContent: c.name }), el('small', { textContent: `Convergence · ${o.name(c.maps[0]!)}` }));
        b.addEventListener('click', () => o.pickConvergence(c));
        return b;
      });
      const row = el(
        'section',
        { class: 'sector-row', id: `setup-sector-${sector.id}` },
        el(
          'header',
          { class: 'sector-head' },
          el('b', { textContent: sector.name }),
          el('span', { class: 'sector-kind', textContent: `${SECTOR_CLASS_LABELS[sector.classification]} · ${sector.period}` }),
          el('span', { class: `sector-status ${status}`, textContent: SECTOR_STATUS_LABELS[status] }),
        ),
        el('div', { class: 'sector-maps' }, ...cards, ...extra),
      );
      row.style.setProperty('--tiles', String(cards.length + extra.length));
      return row;
    }),
  );
  if (!rows.length) box.append(el('p', { class: 'map-empty', textContent: 'No Story sectors yet.' }));
}
