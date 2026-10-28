// The browser's own match (offline play, MapMaker TEST, Host game) in a dedicated
// worker: the simulation (bots, navigation, physics, rules) runs on its own core
// while the page renders. Physics (Rapier) and navigation (Recast) load their
// WebAssembly here. LocalTransport is the page's side.
//
// This entry only loads simWorkerCore.ts (see there why nothing else may live in it) and hands it the
// page's messages in order.
import type { FromSimHost, MatchHost, ToSimHost } from './matchHost.ts';

/** The worker's global scope (typed by hand: the client is typed for the page). */
const scope = self as unknown as { postMessage(m: FromSimHost, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent<ToSimHost>) => void) | null; close(): void };
const post = (m: FromSimHost, transfer?: Transferable[]) => scope.postMessage(m, transfer ?? []);
const core = import('./simWorkerCore.ts');
let host: MatchHost | null = null;
/** Messages are handled one after another, in arrival order, once the core is loaded. */
let queue: Promise<unknown> = core;

function handle(c: Awaited<typeof core>, m: ToSimHost): void {
  if (m.k === 'warm') {
    // Started ahead of time: load what a match needs now (MatchHost.start finds it ready).
    void Promise.all([c.loadMatch().then((mod) => mod.initNavigation()), c.initPhysics()]).catch((err: unknown) => console.warn('match worker warm-up failed', err));
    return;
  }
  if (m.k === 'start') {
    host = new c.MatchHost(m.map, m.opts, c.sinkTo(post));
    host.setHidden(m.hidden);
    host.start().catch((err: Error) => post({ k: 'failed', error: err.message }));
    return;
  }
  if (!host) return;
  c.dispatchToHost(host, m, post);
  if (m.k === 'stop') {
    host = null;
    scope.close();
  }
}

scope.onmessage = (e: MessageEvent<ToSimHost>) => {
  const m = e.data;
  queue = queue.then(() => core).then((c) => handle(c, m), (err: Error) => {
    if (m.k === 'start') post({ k: 'failed', error: `the match code didn't load: ${err.message}` });
  });
};
