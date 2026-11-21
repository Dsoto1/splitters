/**
 * Work spread over frames: steps queued now run on the frames that follow, in order, each frame running steps until
 * `budgetMs` of its time is used, and at least a `1 / drainFrames` share of what waits (at least one): a slow page,
 * a frame a second, still drains a steady stream instead of letting it pile up, and a burst goes over about
 * `drainFrames` frames however long its steps take. For work that may come in bursts but
 * nobody needs at once: a going character's disposal (View.retireAvatar), where a frame that lost a few bodies at once
 * (a crowded match past its body limit, a new round clearing every body) paid for all of them.
 */
export class FrameSpread {
  private readonly steps: (() => void)[] = [];
  private head = 0;

  constructor(
    /** Milliseconds a frame may spend (after its first step). */
    readonly budgetMs: number,
    /** A frame takes at least this share of the queue (1 / drainFrames). */
    readonly drainFrames = 20,
    private readonly clock: () => number = () => performance.now(),
  ) {}

  /** Steps waiting. */
  get size(): number {
    return this.steps.length - this.head;
  }

  /** Queue steps, to run in this order after everything queued before them. */
  push(...steps: (() => void)[]): void {
    this.steps.push(...steps);
  }

  /** This frame's share: steps until the budget is used, at least its share of the queue. Returns how many ran. */
  run(): number {
    if (!this.size) return 0;
    const t0 = this.clock();
    const least = Math.ceil(this.size / this.drainFrames);
    let ran = 0;
    do {
      this.next();
      ran++;
    } while (this.size && (ran < least || this.clock() - t0 < this.budgetMs));
    this.compact();
    return ran;
  }

  /** Everything at once (the view is going: nothing may be left waiting). */
  flush(): void {
    while (this.size) this.next();
    this.compact();
  }

  private next(): void {
    const step = this.steps[this.head]!;
    this.head++;
    step();
  }

  private compact(): void {
    if (!this.size) {
      this.steps.length = 0;
      this.head = 0;
    } else if (this.head > 64) {
      this.steps.splice(0, this.head);
      this.head = 0;
    }
  }
}
