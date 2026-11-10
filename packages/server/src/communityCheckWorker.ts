import { parentPort, workerData } from 'node:worker_threads';
import { checkCommunityMap } from './communityCheck.ts';

/** communityCheck.ts checkInWorker: the pick check of one map file, off the hub's thread. */
const { text, hash, blocked } = workerData as { text: string; hash: string; blocked: string[] };
checkCommunityMap(text, hash, blocked).then(
  (r) => parentPort?.postMessage(r),
  (e: unknown) => parentPort?.postMessage({ ok: false, reason: `the check failed: ${(e as Error).message}` }),
);
