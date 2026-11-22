/**
 * The weapon you asked for (a category key, the wheel, scrolling, Q), sent with every input (PlayerInput.weapon) until
 * the host has taken it. The host switches on the first input that carries it (Match.applyInputs), so the request is
 * done once a snapshot both acknowledges an input that carried it and shows that weapon in hand.
 *
 * It used to be dropped as soon as any snapshot showed that weapon in hand, even one from before the host had read
 * the request: pressing a key twice quickly (out to the next weapon, then back) had the second press dropped by a
 * snapshot that still showed the weapon you started with, while the first press's inputs went on to switch away; and
 * a request for a weapon you no longer held (lost with a life the page never saw end) stayed, so the next key started
 * counting from a weapon not in its slot and always landed on the first one there (the Pistol, the AK).
 */
export class WeaponRequest {
  /** The weapon code asked for (0: none). */
  want = 0;
  /** The first input sequence that carried it (0: not sent yet). */
  private since = 0;

  ask(code: number): void {
    if (code === this.want) return;
    this.want = code;
    this.since = 0;
  }

  /** An input went out (with `want` in it). */
  sent(seq: number): void {
    if (this.want && !this.since) this.since = seq;
  }

  /** A snapshot: the host applied inputs up to `ack` and has `held` in hand. */
  snapshot(held: number, ack: number): void {
    if (this.want && this.since && ack >= this.since && held === this.want) this.clear();
  }

  /** What you hold now or are switching to, for stepping on from: the request while it is one you still have. */
  current(held: number, has: (code: number) => boolean): number {
    if (this.want && !has(this.want)) this.clear();
    return this.want || held;
  }

  clear(): void {
    this.want = 0;
    this.since = 0;
  }
}
