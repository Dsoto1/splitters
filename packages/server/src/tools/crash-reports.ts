import { resolve } from 'node:path';
import { ReportStore, reportsText } from '../reports.ts';

/**
 * The owner's crash and error reports, read from the hub's folder (docs/CRASH_REPORTS.md):
 *   pnpm --filter @tiletrigger/server crash-reports [<REPORTS_DIR>] [--days=7] [--json]
 * On the Lightsail box the folder is /var/lib/tiletrigger/reports (the hub keeps it beside the profiles). The same
 * summary is GET /api/v1/reports?days=7 (signed in as the owner), and the owner's Profile → Community maps shows it.
 */
const args = process.argv.slice(2);
const dir = resolve(process.env.INIT_CWD ?? process.cwd(), args.find((a) => !a.startsWith('--')) ?? process.env.REPORTS_DIR ?? '/var/lib/tiletrigger/reports');
const days = Number(args.find((a) => a.startsWith('--days='))?.slice(7) ?? 7) || 7;
const s = new ReportStore(dir).summary(days);
console.log(args.includes('--json') ? JSON.stringify(s, null, 2) : reportsText(s));
