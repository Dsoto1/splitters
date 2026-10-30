/**
 * Everything a match needs on the page (the session, its transports and the
 * physics for client prediction), as one dynamic import: main.ts loads it the
 * first time a match starts and prefetches it once the menu is idle, so the
 * first visit draws the menu without it. See docs/LOADING.md.
 */
export { GameSession } from './session.ts';
export { LocalTransport, prewarmSimWorker } from './localTransport.ts';
export { NetTransport } from './netTransport.ts';
export { initPhysics } from '@tiletrigger/shared';
export { HostLeftScreen } from './hostLeft.ts';
