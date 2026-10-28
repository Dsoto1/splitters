import { serializeMap, validateMap, type MapDocument } from '@tiletrigger/shared';
import { accessToken } from '../account.ts';
import { forgetPublished, hubApi, publishedMaps, type PublishedEntry } from '../publishedMaps.ts';

/**
 * The owner's MapMaker tools (docs/HOSTING.md, "Publishing maps"): publish the
 * map being edited as an official map, see its earlier versions, put one back,
 * or take the published version down. Only an account the hub lists as an
 * owner sees them; the hub checks that again on every request (publish.ts).
 */
export interface PublishedVersion {
  at: number;
  name: string;
  hash: string;
  current: boolean;
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const url = hubApi(path);
  const token = accessToken();
  if (!url) throw new Error('no hub to publish to');
  if (!token) throw new Error('sign in first (main menu → Sign in)');
  const res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `the hub answered ${res.status}`);
  return res;
}

/** Whether the signed-in account may publish (false when signed out, with no hub, or not an owner). */
export async function isOwner(): Promise<boolean> {
  if (!accessToken() || !hubApi('owner')) return false;
  try {
    return ((await (await call('owner')).json()) as { owner: boolean }).owner;
  } catch {
    return false;
  }
}

/** The map's text, gzipped when the browser can (a big map is ~2 MB of JSON, ~200 kB gzipped). */
async function body(map: MapDocument): Promise<{ data: BodyInit; gzip: boolean }> {
  const text = serializeMap(map);
  if (typeof CompressionStream === 'undefined') return { data: text, gzip: false };
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return { data: await new Response(stream).blob(), gzip: true };
}

export async function publishMap(map: MapDocument): Promise<PublishedEntry> {
  const { data, gzip } = await body(map);
  const res = await call(`maps/${map.metadata.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) }, body: data });
  forgetPublished();
  return (await res.json()) as PublishedEntry;
}

export async function mapVersions(id: string): Promise<PublishedVersion[]> {
  return ((await (await call(`maps/${id}/versions`)).json()) as { versions: PublishedVersion[] }).versions;
}

export async function restoreVersion(id: string, at: number): Promise<PublishedEntry> {
  const res = await call(`maps/${id}/rollback?at=${at}`, { method: 'POST' });
  forgetPublished();
  return (await res.json()) as PublishedEntry;
}

export async function takeDown(id: string): Promise<void> {
  await call(`maps/${id}`, { method: 'DELETE' });
  forgetPublished();
}

export interface PublishDialogHost {
  /** The map being edited. */
  doc(): MapDocument;
  /** Whether this ID is one of the maps built into the site. */
  builtIn(id: string): boolean;
  toast(text: string, error?: boolean): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
};

/** The Publish dialog: what publishing this map does, its errors (none allowed), and its published versions. */
export async function openPublishDialog(dialog: HTMLDialogElement, host: PublishDialogHost): Promise<void> {
  const doc = host.doc();
  const id = doc.metadata.id;
  const errors = validateMap(doc).filter((i) => i.severity === 'error');
  const published = (await publishedMaps()).get(id);
  const replaces = host.builtIn(id) || !!published;
  const status = el('p', { className: 'ed-publish-status' });
  const go = el('button', { className: 'primary', textContent: replaces ? 'Publish the new version' : 'Publish as a new map', disabled: errors.length > 0 });
  const versions = el('div', { className: 'ed-publish-versions' });
  const close = el('button', { textContent: 'Close' });
  close.addEventListener('click', () => dialog.close());
  dialog.replaceChildren(
    el('h2', { textContent: `Publish ${doc.metadata.name}` }),
    el('p', {
      textContent: replaces
        ? `This replaces the official ${published?.name ?? doc.metadata.name} (${id}) for everyone: the map list, new matches, MapMaker and Host Services. Matches already running finish on the version they started with. Every earlier version is kept below.`
        : `This adds ${doc.metadata.name} (${id}) as a new official map for everyone. You can take it down again.`,
    }),
    ...(errors.length ? [el('p', { className: 'ed-publish-errors', textContent: `Fix ${errors.length} error${errors.length > 1 ? 's' : ''} first: ${errors.slice(0, 3).map((e) => e.message).join('; ')}` })] : []),
    status,
    el('div', { className: 'ed-dialog-actions' }, go, close),
    versions,
  );
  go.addEventListener('click', () => {
    go.disabled = true;
    status.textContent = 'Publishing…';
    publishMap(host.doc()).then(
      (e) => {
        status.textContent = `Published ${e.name}.`;
        host.toast(`Published ${e.name} for everyone`);
        void fillVersions();
      },
      (err: Error) => {
        status.textContent = `Not published: ${err.message}`;
        go.disabled = false;
      },
    );
  });
  const fillVersions = async (): Promise<void> => {
    if (!replaces && !(await publishedMaps()).has(id)) return void versions.replaceChildren();
    let list: PublishedVersion[] = [];
    try {
      list = await mapVersions(id);
    } catch (e) {
      return void versions.replaceChildren(el('p', { textContent: `Versions: ${(e as Error).message}` }));
    }
    const rows = [...list].reverse().map((v) => {
      const li = el('li', {}, el('span', { textContent: `${new Date(v.at).toLocaleString()} · ${v.name}${v.current ? ' (published now)' : ''}` }));
      if (!v.current) {
        const restore = el('button', { textContent: 'Restore' });
        restore.addEventListener('click', () => {
          if (!confirm(`Publish the ${new Date(v.at).toLocaleString()} version of ${v.name} again, for everyone?`)) return;
          restoreVersion(id, v.at).then(
            () => (host.toast(`Restored the ${new Date(v.at).toLocaleString()} version`), void fillVersions()),
            (e: Error) => host.toast(`Couldn't restore: ${e.message}`, true),
          );
        });
        li.append(restore);
      }
      return li;
    });
    const down = el('button', { textContent: host.builtIn(id) ? 'Go back to the built-in version' : 'Take this map down' });
    down.addEventListener('click', () => {
      const what = host.builtIn(id) ? `Stop using the published ${id}? Everyone gets the version built into the site again (the published versions are kept).` : `Take ${id} down? It leaves the map list (its versions are kept).`;
      if (!confirm(what)) return;
      takeDown(id).then(
        () => (host.toast(host.builtIn(id) ? 'Back to the built-in version' : 'Taken down'), void fillVersions()),
        (e: Error) => host.toast(`Couldn't: ${e.message}`, true),
      );
    });
    const now = (await publishedMaps()).has(id);
    versions.replaceChildren(el('h3', { textContent: 'Published versions' }), rows.length ? el('ul', {}, ...rows) : el('p', { textContent: 'None yet.' }), ...(now ? [down] : []));
  };
  dialog.showModal();
  void fillVersions();
}
