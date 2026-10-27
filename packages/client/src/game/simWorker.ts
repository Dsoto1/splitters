// The browser's own match (offline play, MapMaker TEST, Host game) in a dedicated
// worker: the simulation (bots, navigation, physics, rules) runs on its own core
// while the page renders. Physics (Rapier) and navigation (Recast) load their
// WebAssembly here. LocalTransport is the page's side.
import { initPhysics } from '@tiletrigger/shared';
import { MatchHost, dispatchToHost, sinkTo, type FromSimHost, type ToSimHost } from './matchHost.ts';

/** The worker's global scope (typed by hand: the client is typed for the page). */
const scope = self as unknown as { postMessage(m: FromSimHost): void; onmessage: ((e: MessageEvent<ToSimHost>) => void) | null; close(): void };
const post = (m: FromSimHost) => scope.postMessage(m);
let host: MatchHost | null = null;

scope.onmessage = (e: MessageEvent<ToSimHost>) => {
  const m = e.data;
  if (m.k === 'warm') {
    // Started ahead of time: load what a match needs now (MatchHost.start finds it ready).
    void Promise.all([import('@tiletrigger/shared/match').then((mod) => mod.initNavigation()), initPhysics()]).catch(() => undefined);
    return;
  }
  if (m.k === 'start') {
    host = new MatchHost(m.map, m.opts, sinkTo(post));
    host.setHidden(m.hidden);
    host.start().catch((err: Error) => post({ k: 'failed', error: err.message }));
    return;
  }
  if (!host) return;
  dispatchToHost(host, m, post);
  if (m.k === 'stop') {
    host = null;
    scope.close();
  }
};
