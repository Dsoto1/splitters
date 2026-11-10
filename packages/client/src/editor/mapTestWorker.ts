// MapMaker's test worker (overhaul Phase 4: the bot test run, spawn exposure): a headless match or the exposure
// check on its own core, so the editor keeps drawing and taking edits while it runs. One job per worker: the page
// starts a worker for each and ends it (Cancel) with terminate(). This entry only loads mapTestWorkerCore.ts.
import type { FromMapTest, ToMapTest } from './mapTestWorkerCore.ts';

const scope = self as unknown as { postMessage(m: FromMapTest): void; onmessage: ((e: MessageEvent<ToMapTest>) => void) | null };
const post = (m: FromMapTest) => scope.postMessage(m);

scope.onmessage = (e: MessageEvent<ToMapTest>) => {
  import('./mapTestWorkerCore.ts')
    .then((c) => c.runMapTest(e.data, post))
    .catch((err: Error) => post({ k: 'failed', error: err.message }));
};
