import {
  CAMPAIGN_PICKED_MAX,
  MODE_LABELS,
  isGameMode,
  SECTOR_CLASS_LABELS,
  SECTOR_STATUS_LABELS,
  convergenceTiles,
  sectorStatus,
  stageStates,
  type CampaignData,
  type CampaignProgress,
  type CampaignSector,
  type Convergence,
  type SectorStatus,
  type StageMatch,
  type StageState,
} from '@tiletrigger/shared';
import { el } from './setupControls.ts';

/**
 * Story's Operations Database (docs/CAMPAIGN.md; GDD §9): the discovered sectors as rows (a card and its convergence
 * tile), a sector's detail with its 3 maps and their state, and Launch for the next one. Bare on purpose: the
 * framework, not the final look. Status is a word and a symbol as well as a colour (GDD §9.2). Builds DOM only; the
 * front end owns the screen, the data and the launch.
 */
export interface StoryScreenOptions {
  head: HTMLElement;
  data: CampaignData;
  progress: CampaignProgress;
  /** The sector or discovered convergence open, or null: the list. */
  open: string | null;
  mapName(key: string): string;
  mapPicture(key: string): HTMLElement | null;
  lookName(id: string): string;
  select(id: string | null): void;
  launch(owner: string, map: string): void;
}

const STATUS_MARK: Record<SectorStatus, string> = { available: '○', 'in-progress': '»', repaired: '✓' };
const STAGE_LABEL: Record<StageState, string> = { done: 'Won', next: 'Next', locked: 'Locked' };
const STAGE_MARK: Record<StageState, string> = { done: '✓', next: '▶', locked: '🔒' };

const provisional = (x: { provisional?: boolean }) => (x.provisional ? [el('i', { class: 'story-prov', title: 'A placeholder: name and maps to come', textContent: 'provisional' })] : []);

function statusBadge(status: SectorStatus): HTMLElement {
  const b = el('span', { class: `story-status ${status}` }, el('b', { textContent: STATUS_MARK[status] }), SECTOR_STATUS_LABELS[status]);
  b.firstElementChild!.setAttribute('aria-hidden', 'true');
  return b;
}

export function storyScreen(o: StoryScreenOptions): HTMLElement {
  const sector = o.open ? o.data.sectors.find((s) => s.id === o.open) : undefined;
  const conv = o.open && !sector ? o.data.convergences.find((c) => c.id === o.open && o.progress.convergences.includes(c.id)) : undefined;
  const body = sector ? sectorDetail(o, sector) : conv ? convergenceDetail(o, conv) : database(o);
  return el('div', { class: 'screen story' }, o.head, body);
}

/** The list: a row per sector, its card and its convergence tile (Unknown until discovered). */
function database(o: StoryScreenOptions): HTMLElement {
  const repaired = o.data.sectors.filter((s) => o.progress.sectors.includes(s.id)).length;
  const rows = o.data.sectors.map((s) => {
    const status = sectorStatus(s, o.progress);
    const states = stageStates(s, o.progress);
    const won = states.filter((x) => x.state === 'done').length;
    const next = states.find((x) => x.state === 'next');
    const card = el(
      'button',
      { type: 'button', class: `story-card panel ${status}`, id: `story-sector-${s.id}`, title: `Open ${s.name}` },
      el('div', { class: 'story-kicker' }, `${SECTOR_CLASS_LABELS[s.classification]} · ${s.period}`, ...provisional(s)),
      el('h3', { textContent: s.name }),
      el('p', { class: 'story-desc', textContent: s.description }),
      el('div', { class: 'story-meta' }, statusBadge(status), el('span', { textContent: `${won} / ${s.maps.length} maps` }), el('span', { class: 'story-next', textContent: next ? `Next: ${o.mapName(next.map)}` : 'All maps won' })),
    );
    card.addEventListener('click', () => o.select(s.id));
    const tiles = convergenceTiles(o.data, o.progress, s.id).map((t) => {
      if ('unknown' in t) {
        const u = el('div', { class: 'story-tile unknown panel', title: 'The database can’t see that logged event yet' }, el('b', { textContent: '?' }), el('span', { textContent: 'Unknown' }), el('small', { textContent: 'Not logged yet' }));
        u.firstElementChild!.setAttribute('aria-hidden', 'true');
        return u;
      }
      const c = t.known;
      const b = el('button', { type: 'button', class: 'story-tile known panel', id: `story-conv-${c.id}`, title: `Open ${c.name}` }, el('b', { textContent: '⚡' }), el('span', { textContent: c.name }), el('small', { textContent: 'Convergence found' }));
      b.firstElementChild!.setAttribute('aria-hidden', 'true');
      b.addEventListener('click', () => o.select(c.id));
      return b;
    });
    return el('div', { class: 'story-row' }, card, el('div', { class: 'story-tiles' }, ...tiles));
  });
  return el(
    'div',
    { class: 'story-db' },
    el('p', { class: 'story-sub', textContent: `Temporal sectors: ${o.data.sectors.length} logged, ${repaired} repaired. Pick any sector; its maps open one at a time.` }),
    el('div', { class: 'story-rows' }, ...rows),
  );
}

/** A map's match in a few words: its mode, and its size where the data sets one ("10 + 4 allies v 14 · 2 waves"). */
export function stageMatchLine(m: StageMatch, crew: number): string {
  const mode = m.mode && isGameMode(m.mode) ? MODE_LABELS[m.mode] : MODE_LABELS['core.tdm'];
  const sized = m.picked !== undefined || m.allies !== undefined || m.enemies !== undefined;
  if (!sized) return mode;
  const friends = `${m.picked ?? crew}${m.allies ? ` + ${m.allies} allies` : ''}`;
  const waves = m.waves ? ` · ${m.waves} wave${m.waves === 1 ? '' : 's'}` : '';
  return `${mode} · ${friends} v ${m.enemies ?? (m.picked ?? crew) + (m.allies ?? 0)}${waves}`;
}

/** A sector's maps (or a convergence's), each won, next or locked, with Launch / Replay. */
function stageList(o: StoryScreenOptions, owner: string, maps: { map: string; state: StageState }[], extra: (i: number) => string | null): HTMLElement {
  return el(
    'ol',
    { class: 'story-maps' },
    ...maps.map((m, i) => {
      const pic = o.mapPicture(m.map);
      const go = el('button', { type: 'button', class: m.state === 'next' ? 'primary' : '', id: `story-launch-${m.map}`, textContent: m.state === 'next' ? 'Launch' : m.state === 'done' ? 'Replay' : 'Locked', disabled: m.state === 'locked' });
      go.addEventListener('click', () => o.launch(owner, m.map));
      const note = extra(i);
      const state = el('span', { class: `story-stage ${m.state}` }, el('b', { textContent: STAGE_MARK[m.state] }), STAGE_LABEL[m.state]);
      state.firstElementChild!.setAttribute('aria-hidden', 'true');
      return el(
        'li',
        { class: `story-map panel ${m.state}` },
        ...(pic ? [el('div', { class: 'story-pic' }, pic)] : []),
        el('div', { class: 'story-map-text' }, el('small', { textContent: `Map ${i + 1}` }), el('b', { textContent: o.mapName(m.map) }), ...(note ? [el('small', { class: 'story-unlock', textContent: note })] : []), state),
        go,
      );
    }),
  );
}

function detailHead(o: StoryScreenOptions, kicker: string, x: { name: string; description: string; provisional?: boolean }, status?: SectorStatus): HTMLElement {
  const back = el('button', { type: 'button', class: 'link story-back', id: 'story-back', textContent: '◀ All sectors' });
  back.addEventListener('click', () => o.select(null));
  return el('div', { class: 'story-detail-head' }, back, el('div', { class: 'story-kicker' }, kicker, ...provisional(x)), el('h3', { textContent: x.name }), el('p', { class: 'story-desc', textContent: x.description }), ...(status ? [statusBadge(status)] : []));
}

function sectorDetail(o: StoryScreenOptions, s: CampaignSector): HTMLElement {
  const maps = stageStates(s, o.progress);
  const boss = s.boss;
  const ex = s.expedition;
  const names = (ids: readonly string[]) => ids.map((id) => o.lookName(id)).join(', ');
  return el(
    'div',
    { class: 'story-detail', id: `story-detail-${s.id}` },
    detailHead(o, `${SECTOR_CLASS_LABELS[s.classification]} · ${s.period}`, s, sectorStatus(s, o.progress)),
    stageList(o, s.id, maps, (i) => `${stageMatchLine(s.maps[i]!, ex.crew)} · unlocks ${o.lookName(s.maps[i]!.unlock)}${i === s.maps.length - 1 ? ' · boss map' : ''}`),
    el(
      'dl',
      { class: 'story-facts panel' },
      el('dt', { textContent: 'Boss encounter' }),
      el('dd', { textContent: names([boss.character, ...boss.companions]) }),
      el('dt', { textContent: 'Expedition' }),
      el('dd', { textContent: `${ex.crew} Chrono Crew of your choice (you pick up to ${CAMPAIGN_PICKED_MAX}); local allies: ${names(ex.allies)}. Each map sets its own mode and size.` }),
      el('dt', { textContent: 'Sector repaired' }),
      el('dd', { textContent: s.rewards.length ? `Unlocks ${names(s.rewards)}` : 'No extra unlock' }),
    ),
  );
}

function convergenceDetail(o: StoryScreenOptions, c: Convergence): HTMLElement {
  const sectors = c.sectors.map((id) => o.data.sectors.find((s) => s.id === id)?.name ?? id).join(' × ');
  return el(
    'div',
    { class: 'story-detail', id: `story-detail-${c.id}` },
    detailHead(o, `Convergence · ${sectors}`, c),
    stageList(o, c.id, stageStates(c, o.progress), (i) => (i === c.maps.length - 1 && c.rewards.length ? `Unlocks ${c.rewards.map((r) => o.lookName(r)).join(', ')}` : null)),
  );
}
