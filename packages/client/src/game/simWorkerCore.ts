// Everything the match worker runs, loaded by simWorker.ts with a dynamic import. Keeping it out of the
// worker's entry file matters for Safari: there, a chunk that imports from a module worker's entry file gets
// a second copy of it (the entry isn't shared through the module map), and with it a second, never-started
// Rapier ("undefined is not an object (evaluating 'o.rawintegrationparameters_new')"). With this split,
// physics, navigation and the match live in ordinary chunks that every importer shares.
export { initPhysics } from '@tiletrigger/shared';
export { MatchHost, dispatchToHost, sinkTo } from './matchHost.ts';
export const loadMatch = () => import('@tiletrigger/shared/match');
