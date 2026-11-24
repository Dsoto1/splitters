import { accessToken } from './account.ts';
import { hubApi } from './publishedMaps.ts';

/** One group of the hub's summary (server reports.ts ReportGroup), as far as the list shows it. */
interface Group {
  sig: string;
  count: number;
  last: string;
  versions: string[];
  maps: string[];
  browsers: string[];
  sample: { kind: string; message: string; stack: string };
}

/**
 * The owner's crash and error reports (docs/CRASH_REPORTS.md) under Profile → Community maps: the last 7 days grouped
 * by signature, most frequent first, each with its newest stack. Loaded only once the hub has answered as the owner's.
 * Fills `box` once the hub answers; adds nothing if it refuses.
 */
export async function ownerCrashReports(box: HTMLElement): Promise<void> {
  const url = hubApi('reports?days=7');
  const token = accessToken();
  if (!url || !token) return;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!res?.ok) return;
  const s = (await res.json()) as { days: number; total: number; groups: Group[] };
  const sec = document.createElement('div');
  sec.className = 'prof-community-owner';
  sec.id = 'crash-reports-owner';
  const h = document.createElement('h6');
  h.textContent = `Crash reports: ${s.total} in the last ${s.days} days`;
  sec.append(h);
  for (const g of s.groups.slice(0, 20)) {
    const d = document.createElement('details');
    d.className = 'prof-community-row';
    const sum = document.createElement('summary');
    sum.textContent = `${g.count} × ${g.sample.kind}: ${g.sample.message}`;
    const info = document.createElement('small');
    info.textContent = `last ${g.last} · ${g.versions.join(', ')} · ${g.maps.join(', ') || 'no map'} · ${g.browsers.join(', ')}`;
    const pre = document.createElement('pre');
    pre.style.cssText = 'white-space:pre-wrap;font-size:11px;max-height:160px;overflow:auto';
    pre.textContent = g.sample.stack;
    d.append(sum, info, pre);
    sec.append(d);
  }
  box.append(sec);
}
