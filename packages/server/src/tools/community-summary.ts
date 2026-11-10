import { resolve } from 'node:path';
import { parseThresholds } from '@tiletrigger/shared';
import { CommunityStore, summaryText } from '../community.ts';

/**
 * The owner's weekly community-maps summary, read from the hub's folder (docs/COMMUNITY_MAPS.md):
 *   pnpm --filter @tiletrigger/server community-summary [<COMMUNITY_DIR>] [--days=7] [--json]
 * On the Lightsail box the folder is /var/lib/tiletrigger/community (the hub keeps it beside the profiles). The same
 * summary is GET /api/v1/community/summary (signed in as the owner), and the owner's Profile shows it.
 */
const args = process.argv.slice(2);
const dir = resolve(process.env.INIT_CWD ?? process.cwd(), args.find((a) => !a.startsWith('--')) ?? process.env.COMMUNITY_DIR ?? '/var/lib/tiletrigger/community');
const days = Number(args.find((a) => a.startsWith('--days='))?.slice(7) ?? 7) || 7;
let thresholds: unknown = null;
try {
  thresholds = process.env.COMMUNITY_THRESHOLDS ? JSON.parse(process.env.COMMUNITY_THRESHOLDS) : null;
} catch {
  /* the defaults */
}
const s = new CommunityStore(dir, parseThresholds(thresholds)).summary(days);
console.log(args.includes('--json') ? JSON.stringify(s, null, 2) : summaryText(s));
