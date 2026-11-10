// communityCheck.ts checkInWorker's thread: TypeScript through tsx (a worker doesn't take the hub's loader), then the check.
import { register } from 'tsx/esm/api';

register();
await import('./communityCheckWorker.ts');
