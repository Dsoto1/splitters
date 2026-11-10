import type { LobbyListing } from '@tiletrigger/shared';
import { accessToken } from '../account.ts';
import { communitySummary, myCommunityMaps, ownerCommunityAction, reportCommunityMap, withdrawCommunityMap, type CommunityRow } from '../communityMaps.ts';

/**
 * Community maps in the menus (docs/COMMUNITY_MAPS.md): a listing's creator and the Report button in the game browser,
 * and the Profile's "Your community maps" (with Withdraw) and, for the game's owner, the weekly summary with Official,
 * Take down and Restore.
 */
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  const { class: cls, ...rest } = props;
  if (cls) e.className = cls;
  Object.assign(e, rest);
  e.append(...children);
  return e;
};

/** A community listing's map cell: its name, and its creator (their username, ✓) under it. */
export function communityMapRow(g: LobbyListing, map: HTMLElement): HTMLElement {
  const by = el('small', { class: 'gb-creator', textContent: g.creator ? `by ${g.creator} ✓` : 'creator not signed in' });
  by.dataset.tip = g.creator ? "The map's creator: the signed-in player who first shared it." : 'Nobody signed in has shared this map yet, so its creator is unknown.';
  return el('span', { class: 'gb-map gb-community' }, map, by);
}

/** Report a community map (signed in, once per account): past a threshold the hub hides it until the owner looks. */
export function reportButton(contentHash: string, name: string): HTMLButtonElement {
  const b = el('button', { type: 'button', class: 'link gb-report', textContent: 'Report' });
  b.title = 'Report this map (offensive, broken or not what it says)';
  b.addEventListener('click', () => {
    if (!accessToken()) return void (b.textContent = 'Sign in to report');
    if (!confirm(`Report "${name}"? Maps with many reports are hidden until the game's owner looks at them.`)) return;
    b.disabled = true;
    reportCommunityMap(contentHash).then(
      () => (b.textContent = 'Reported'),
      (e: Error) => ((b.textContent = 'Not reported'), (b.title = e.message), (b.disabled = false)),
    );
  });
  return b;
}

const STATUS: Record<string, string> = { open: 'Counting plays', wanted: 'Cleared the thresholds', pick: 'Community Pick', failed: 'Failed the hub check', hidden: 'Hidden after reports', removed: 'Taken down', official: 'Made Official', withdrawn: 'Withdrawn' };

const numbers = (r: CommunityRow) => `${r.players} players · ${r.hosts} hosts · ${r.days} days · ${r.minutes} min · ${r.reports} reports`;

/**
 * Profile → "Community maps": your maps on the hub (as their creator) with their numbers and Withdraw; and for the
 * owner, the weekly summary (new picks, hidden maps, the most played) with Official, Take down and Restore. Fills
 * itself once the hub answers; stays empty with no hub.
 */
export function communityPanel(kicker: (text: string) => HTMLElement): HTMLElement {
  const sec = el('section', { class: 'prof-sec prof-community', id: 'profile-community' }, kicker('Community maps'));
  const mine = el('div', { class: 'prof-community-list', textContent: 'Looking…' });
  sec.append(mine, el('p', { class: 'hint', textContent: 'Host a map of yours (Play → Your maps → Host online) and it is listed as a Community map, with you as its creator. Plays by other signed-in players count toward Community Picks.' }));
  const draw = () =>
    myCommunityMaps().then(
      (maps) =>
        mine.replaceChildren(
          ...(maps.length
            ? maps.map((m) => {
                const v = [...m.versions].sort((a, b) => b.lastAt - a.lastAt)[0];
                const row = el('div', { class: 'prof-community-row' }, el('b', { textContent: v?.name ?? m.mapId }), el('small', { textContent: m.withdrawn ? 'Withdrawn' : v ? `${STATUS[v.status] ?? v.status} · ${numbers(v)}${v.missing.length ? ` · needs ${v.missing.join(', ')}` : ''}` : '' }));
                if (!m.withdrawn) {
                  const w = el('button', { type: 'button', class: 'link', textContent: 'Withdraw' });
                  w.addEventListener('click', () => confirm(`Withdraw "${v?.name ?? m.mapId}"? It is no longer listed or a Community Pick (every version).`) && void withdrawCommunityMap(m.mapId).then(draw, (e: Error) => (w.textContent = e.message)));
                  row.append(w);
                }
                return row;
              })
            : [el('small', { class: 'hint', textContent: "None yet: maps you host signed in show up here." })]),
        ),
      () => mine.replaceChildren(el('small', { class: 'hint', textContent: 'No community hub to ask.' })),
    );
  void draw();
  // The owner's summary (only an owner gets one: anyone else's ask is refused, and nothing shows).
  void communitySummary(7).then(
    (s) => {
      const box = el('div', { class: 'prof-community-owner', id: 'community-owner' }, el('h5', { textContent: `Owner: the last ${s.days} days` }), el('small', { textContent: `${s.totals.versions} map versions, ${s.totals.picks} Community Picks, ${s.totals.official} Official, ${s.totals.hidden} hidden, ${s.totals.active} active` }));
      const act = (r: CommunityRow, action: 'official' | 'takedown' | 'restore', label: string) => {
        const b = el('button', { type: 'button', class: 'link', textContent: label });
        b.addEventListener('click', () => confirm(`${label}: "${r.name}"?`) && void ownerCommunityAction(r.contentHash, action).then(() => (b.textContent = 'Done'), (e: Error) => (b.textContent = e.message)));
        return b;
      };
      const list = (title: string, rows: CommunityRow[], actions: (r: CommunityRow) => HTMLElement[]) => {
        if (!rows.length) return;
        box.append(el('h6', { textContent: title }), ...rows.map((r) => el('div', { class: 'prof-community-row' }, el('b', { textContent: `${r.name} (by ${r.creator || 'unknown'})` }), el('small', { textContent: `${STATUS[r.status] ?? r.status} · ${numbers(r)}${r.reason ? ` · ${r.reason}` : ''}` }), ...actions(r))));
      };
      list('New Community Picks', s.newPicks, (r) => [act(r, 'official', 'Make Official'), act(r, 'takedown', 'Take down')]);
      list('Hidden after reports', s.hidden, (r) => [act(r, 'restore', 'Restore'), act(r, 'takedown', 'Take down')]);
      list('Failed the hub check', s.failed, () => []);
      list('Most played', s.mostPlayed, (r) => [...(r.status === 'pick' ? [act(r, 'official', 'Make Official')] : []), act(r, 'takedown', 'Take down')]);
      sec.append(box);
    },
    () => undefined,
  );
  return sec;
}
