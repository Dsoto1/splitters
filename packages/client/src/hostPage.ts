import { MODE_LABELS, type GameMode } from '@tiletrigger/shared';

/**
 * trigger.toshiroplay.com/host: how to host. Hosting from a match in the
 * browser needs nothing installed; a dedicated host (the optional Tile
 * Trigger Host Service, packages/host) keeps a server up without a tab. This
 * page is the only place that offers the download, and the only one that
 * looks for a Host Service on this computer, when the visitor opens it.
 * It talks to the service's control API on 127.0.0.1 (never over the
 * internet) with the pairing key the service put in the link it shows
 * (#pair=…; a fragment never reaches any server), kept in this browser.
 * Closing the page changes nothing on the host.
 */

export interface HostPageMap {
  id: string;
  name: string;
  modes: GameMode[];
}

const PAIR_KEY = 'tiletrigger.hostPair';
const PORT_KEY = 'tiletrigger.hostPort';
const DEFAULT_PORT = 7797;
const RELEASES = 'https://github.com/Dsoto1/splitters/releases/download/main-latest';
export const HOST_DOWNLOADS = [
  { os: 'windows', label: 'Windows (64-bit)', file: 'tiletrigger-host-windows-x64.zip', how: 'Unzip, then double-click "Start Tile Trigger Host.cmd". Windows may warn that the app is unrecognised: More info → Run anyway.' },
  { os: 'macos', label: 'macOS (Apple silicon)', file: 'tiletrigger-host-macos-arm64.zip', how: 'Unzip, then right-click "Start Tile Trigger Host.command" → Open (the first time macOS asks, since the app is not notarised).' },
  { os: 'macos', label: 'macOS (Intel)', file: 'tiletrigger-host-macos-x64.zip', how: 'As above.' },
  { os: 'linux', label: 'Linux (x64)', file: 'tiletrigger-host-linux-x64.tar.gz', how: 'Unpack, then run ./start-host.sh in a terminal.' },
] as const;

type Status = {
  state: 'stopped' | 'starting' | 'running' | 'stopping' | 'restarting' | 'crashloop';
  version: string;
  config: { map: string; mode?: GameMode; botFill: number; maxPlayers: number; name: string; visibility: 'listed' | 'code'; adminTokenSet: boolean; hub: string } | null;
  host: { code: string; online: boolean; listed: boolean; listingError: string | null; relay: boolean; map: string; mode: string; players: number; bots: number; maxPlayers: number; uptimeS: number; tickMs: number; upKBps: number; community: boolean; people: { slot: number; name: string; account: boolean; ping: number | null; kills: number; deaths: number }[] } | null;
  lastError: { at: number; summary: string } | null;
  bans: { id: string; name: string; account: boolean; until: number; reason: string }[];
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...children);
  return e;
};

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      // This page only.
    }
  },
};

/** The visitor's OS, for the download offered first. */
export function guessOs(ua = navigator.userAgent): 'windows' | 'macos' | 'linux' | null {
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua) && !/iPhone|iPad/i.test(ua)) return 'macos';
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return 'linux';
  return null;
}

export function openHostPage(maps: HostPageMap[]): void {
  document.getElementById('menu')?.setAttribute('hidden', '');
  document.title = 'Host a game · Tile Trigger';
  // The pairing key from the Host Service's link: keep it, and take it out of the address bar.
  const takeFragment = () => {
    const frag = new URLSearchParams(location.hash.slice(1));
    if (frag.get('pair') && /^[a-f0-9]{48}$/.test(frag.get('pair')!)) store.set(PAIR_KEY, frag.get('pair'));
    if (frag.get('port') && /^\d{2,5}$/.test(frag.get('port')!)) store.set(PORT_KEY, frag.get('port'));
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  };
  takeFragment();
  const port = Number(new URLSearchParams(location.search).get('hostPort') ?? store.get(PORT_KEY) ?? DEFAULT_PORT);
  const api = `http://127.0.0.1:${port}/api`;

  const root = el('div', { className: 'host-page', id: 'host-page' });
  document.body.append(root);
  const service = el('div', { className: 'panel hp-service', id: 'hp-service' });
  root.append(
    el('div', { className: 'hp-head' }, el('a', { href: '/', className: 'link', textContent: '← Tile Trigger' }), el('h2', { innerHTML: 'Host <em>a game</em>' })),
    el(
      'div',
      { className: 'panel hp-browser' },
      el('h3', { textContent: 'In your browser: nothing to install' }),
      el('p', { textContent: 'Start any match, press Esc, then Host game (or Go online). Friends join with the code or from the game browser. The match runs in your tab: it ends when you close it, and takes up to 10 friends.' }),
      el('a', { href: '/', className: 'button primary', textContent: 'Play a match' }),
    ),
    el(
      'div',
      { className: 'panel hp-dedicated' },
      el('h3', { textContent: 'Dedicated host: optional download' }),
      el('p', { textContent: "For a server that stays up without a browser tab (up to 96 players with bots, 48 v 48), on a spare computer. It needs no port forwarding: players connect the way they join a friend's game. It shows in the game browser as a Dedicated host, run by you, not an official server. Nobody needs it to play or join." }),
      service,
    ),
  );

  let timer: number | undefined;
  const token = () => store.get(PAIR_KEY);
  const call = async (path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> => {
    const res = await fetch(`${api}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  };

  const showDownloads = (why: string) => {
    const mine = guessOs();
    const list = el('ul', { className: 'hp-downloads' });
    for (const d of [...HOST_DOWNLOADS].sort((a, b) => Number(b.os === mine) - Number(a.os === mine))) list.append(el('li', {}, el('a', { href: `${RELEASES}/${d.file}`, textContent: d.label, className: d.os === mine ? 'button primary hp-download' : 'link hp-download', rel: 'noopener' }), el('small', { textContent: ` ${d.how}` })));
    const again = el('button', { textContent: 'Look again', id: 'hp-recheck' });
    again.addEventListener('click', () => void detect());
    service.replaceChildren(
      el('p', { className: 'hint', id: 'hp-state', textContent: why }),
      el('ol', { className: 'hp-steps' }, el('li', { textContent: 'Download the Host Service for your computer (below).' }), el('li', { textContent: 'Unzip it and double-click the start file: a server window opens and your server starts (Frost Basin, 24 players and bots, listed in the game browser).' }), el('li', { textContent: 'Manage it in that window (type help), or come back to this page: it finds the server and lets you change it, start and stop it.' })),
      list,
      el('p', { className: 'hint', textContent: 'It runs as your own user (no administrator rights), opens nothing to the internet, and sends nothing but the game. Closing its window stops the server.' }),
      again,
    );
  };

  const showPairing = () => {
    const key = el('input', { id: 'hp-pair', placeholder: 'pairing key from the server window', autocomplete: 'off', size: 50 });
    const use = el('button', { className: 'primary', textContent: 'Pair', id: 'hp-pair-go' });
    use.addEventListener('click', () => {
      const v = key.value.trim().replace(/^.*#pair=/, '').replace(/&.*$/, '');
      if (!/^[a-f0-9]{48}$/.test(v)) return void (key.style.outline = '2px solid #e74c3c');
      store.set(PAIR_KEY, v);
      void detect();
    });
    service.replaceChildren(el('p', { id: 'hp-state', textContent: 'A Host Service is running on this computer, but this browser is not paired with it yet.' }), el('p', { className: 'hint', textContent: 'Open the "web control" link its window shows (it carries the pairing key), or paste that link here:' }), el('div', { className: 'hc-row' }, key, use));
  };

  const fmtUptime = (s: number) => (s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);

  let formBuilt = false;
  const form = el('form', { className: 'hp-form', id: 'hp-form' });
  const statusBox = el('div', { className: 'hp-status', id: 'hp-status' });
  const peopleBox = el('div', { className: 'hp-people', id: 'hp-people' });
  const message = el('p', { className: 'hint', id: 'hp-message' });
  const buildForm = (s: Status) => {
    formBuilt = true;
    const c = s.config;
    const map = el('select', { id: 'hp-map' });
    for (const m of maps) map.append(new Option(m.name, m.id, false, m.id === (c?.map ?? 'frost_basin')));
    const mode = el('select', { id: 'hp-mode' });
    const fillModes = () => {
      const m = maps.find((x) => x.id === map.value);
      const keep = mode.value || c?.mode || '';
      mode.replaceChildren(new Option("The map's own", ''), ...(m?.modes ?? []).map((x) => new Option(MODE_LABELS[x] ?? x, x, false, x === keep)));
    };
    map.addEventListener('change', fillModes);
    fillModes();
    const fill = el('input', { id: 'hp-fill', type: 'number', min: '1', max: '96', value: String(c?.botFill ?? 24) });
    const max = el('input', { id: 'hp-max', type: 'number', min: '1', max: '96', value: String(c?.maxPlayers ?? 16) });
    const name = el('input', { id: 'hp-name', maxLength: 40, value: c?.name ?? 'Dedicated host' });
    const vis = el('select', { id: 'hp-visibility' });
    vis.append(new Option('In the game browser (and by code)', 'listed', false, c?.visibility !== 'code'), new Option('Join code only', 'code', false, c?.visibility === 'code'));
    const admin = el('input', { id: 'hp-admin', type: 'password', autocomplete: 'new-password', placeholder: c?.adminTokenSet ? 'set (leave empty to keep)' : 'optional, 8+ characters' });
    const start = el('button', { className: 'primary', id: 'hp-start', type: 'submit', textContent: 'Start' });
    const stop = el('button', { id: 'hp-stop', type: 'button', textContent: 'Stop' });
    const restart = el('button', { id: 'hp-restart', type: 'button', textContent: 'Restart' });
    form.replaceChildren(
      el('label', {}, 'Name in the game browser', name),
      el('label', {}, 'Map', map),
      el('label', {}, 'Mode', mode),
      el('label', {}, 'Players and bots (96 = 48 v 48)', fill),
      el('label', {}, 'People at most (your upload carries each: ~20 KB/s a player)', max),
      el('label', {}, 'Visibility', vis),
      el('label', {}, 'Admin token (in-game: Esc → Server admin)', admin),
      el('div', { className: 'hc-actions' }, start, restart, stop),
      message,
    );
    const act = async (path: string, body?: unknown) => {
      message.textContent = '…';
      try {
        const r = await call(path, body ?? {});
        message.textContent = r.ok ? '' : String(r.data.error ?? r.data.text ?? `the Host Service answered ${r.status}`);
      } catch {
        message.textContent = "Couldn't reach the Host Service.";
      }
      void refresh();
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void act('/start', {
        map: map.value,
        ...(mode.value ? { mode: mode.value } : { mode: '' }),
        botFill: Number(fill.value),
        maxPlayers: Number(max.value),
        name: name.value.trim(),
        visibility: vis.value,
        ...(admin.value ? { adminToken: admin.value } : {}),
      });
    });
    stop.addEventListener('click', () => void act('/stop'));
    restart.addEventListener('click', () => void act('/restart'));
  };

  const render = (s: Status) => {
    if (!formBuilt) {
      buildForm(s);
      service.replaceChildren(el('p', { id: 'hp-state', className: 'hp-connected', textContent: `Host Service ${s.version} on this computer` }), statusBox, peopleBox, form);
    }
    const h = s.host;
    const state = s.state === 'running' && h ? `Running · join code ${h.code}` : s.state === 'crashloop' ? 'Stopped after repeated crashes' : s.state[0]!.toUpperCase() + s.state.slice(1);
    const lines = h && s.state === 'running'
      ? [
          `${h.map} · ${MODE_LABELS[h.mode as GameMode] ?? h.mode}${h.community ? ' · Community map' : ''}`,
          `${h.players}/${h.maxPlayers} players, ${h.bots} bots · up ${fmtUptime(h.uptimeS)}`,
          h.online ? (s.config?.visibility === 'code' ? 'Join code only' : h.listed ? 'Listed in the game browser' : `Not listed yet${h.listingError ? `: ${h.listingError}` : ''}`) : 'Hub unreachable: players already in carry on; it reconnects by itself',
          `Tick ${h.tickMs.toFixed(1)} ms · upload ${h.upKBps} KB/s${h.relay ? ' · relay available' : ''}`,
        ]
      : [];
    statusBox.replaceChildren(el('b', { id: 'hp-run-state', textContent: state }), ...lines.map((l) => el('div', { textContent: l })), ...(s.lastError ? [el('div', { className: 'hp-error', id: 'hp-last-error', textContent: `Last error: ${s.lastError.summary}` })] : []));
    const people = h?.people ?? [];
    peopleBox.replaceChildren(
      ...(people.length ? [el('h4', { textContent: 'Players' })] : []),
      ...people.map((p) => {
        const kick = el('button', { textContent: 'Kick', id: `hp-kick-${p.slot}` });
        kick.addEventListener('click', () => void call('/kick', { slot: p.slot }).then(() => refresh()));
        const ban = el('button', { textContent: 'Ban', id: `hp-ban-${p.slot}` });
        ban.addEventListener('click', () => window.confirm(`Ban ${p.name}?`) && void call('/ban', { slot: p.slot }).then(() => refresh()));
        return el('div', { className: 'hc-row' }, el('span', { textContent: `${p.name} ${p.account ? '(account)' : '(guest)'} · ${p.kills}/${p.deaths}${p.ping !== null ? ` · ${p.ping} ms` : ''}` }), kick, ban);
      }),
      ...(s.bans.length ? [el('h4', { textContent: 'Bans' })] : []),
      ...s.bans.map((b) => {
        const lift = el('button', { textContent: 'Unban' });
        lift.addEventListener('click', () => void call('/unban', { id: b.id }).then(() => refresh()));
        return el('div', { className: 'hc-row' }, el('span', { textContent: `${b.name} ${b.account ? '(account)' : '(guest)'}${b.until ? ` until ${new Date(b.until).toLocaleString()}` : ''}${b.reason ? `: ${b.reason}` : ''}` }), lift);
      }),
    );
  };

  const refresh = async () => {
    try {
      const r = await call('/status');
      if (r.status === 401) {
        store.set(PAIR_KEY, null);
        formBuilt = false;
        return showPairing();
      }
      if (r.ok) render(r.data as unknown as Status);
    } catch {
      formBuilt = false;
      window.clearInterval(timer);
      showDownloads('The Host Service stopped or was closed on this computer.');
    }
  };

  /** Look for the Host Service on this computer (only now: the visitor opened this page). */
  const detect = async () => {
    window.clearInterval(timer);
    service.replaceChildren(el('p', { id: 'hp-state', className: 'hint', textContent: 'Looking for a Host Service on this computer…' }));
    try {
      const r = await call('/ping');
      if (r.data.service !== 'tiletrigger-host') throw new Error('not ours');
      if (!r.data.paired) return showPairing();
      await refresh();
      timer = window.setInterval(() => void refresh(), 2000);
    } catch {
      showDownloads('No Host Service is running on this computer.');
    }
  };
  // The pairing link opened in this tab again (only the #fragment changed): pair now.
  window.addEventListener('hashchange', () => {
    if (!/pair=/.test(location.hash)) return;
    takeFragment();
    formBuilt = false;
    void detect();
  });
  void detect();
}
