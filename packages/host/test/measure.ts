// Joins N Node guests to a running Host Service and measures what each receives.
//   node --import tsx test/measure.ts <hub> <code> [guests=4] [seconds=20]
// The host's own tick time is in its [status] / HOST_STATS=1 lines.
import { joinAsGuest } from './guest.ts';

const [hub = 'http://127.0.0.1:9123', code = '', n = '4', secs = '20'] = process.argv.slice(2);
const guests = await Promise.all(Array.from({ length: Number(n) }, (_, i) => joinAsGuest(hub, code, `Probe${i + 1}`)));
for (const g of guests) g.send({ t: 'ready' });
// Walk forward a little so they are players, not idle spawns.
let seq = 0;
const walk = setInterval(() => {
  seq++;
  for (const g of guests) g.send({ t: 'input', inputs: [{ seq, forward: 1, right: 0, yaw: (seq / 60) % 6.28, pitch: 0, buttons: 0 }] });
}, 1000 / 30);
await new Promise((r) => setTimeout(r, 5000));
const b0 = guests.map((g) => g.bytes);
const s0 = guests.map((g) => g.snapshots);
await new Promise((r) => setTimeout(r, Number(secs) * 1000));
clearInterval(walk);
const rates = guests.map((g, i) => (g.bytes - b0[i]!) / Number(secs) / 1024);
const snaps = guests.map((g, i) => (g.snapshots - s0[i]!) / Number(secs));
console.log(JSON.stringify({ guests: guests.length, welcome: guests.every((g) => g.welcome), rejected: guests.map((g) => g.rejected).filter(Boolean), kbPerSec: rates.map((r) => +r.toFixed(1)), snapshotsPerSec: snaps.map((s) => +s.toFixed(1)) }));
for (const g of guests) g.close();
process.exit(0);
