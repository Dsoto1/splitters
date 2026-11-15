/**
 * Work spread over frames: steps queued now run on the frames that follow, in order, each frame running steps until
 * `budgetMs` of its time is used (and at least one, so the queue always drains). For work that may come in bursts but
 * nobody needs at once: a going character's disposal (View.retireAvatar), where a frame that lost a few bodies at once
 * (a crowded match past its body limit, a new round clearing every body) paid for all of them.
 */
export class FrameSpread {
  private readonly steps: (() => void)[] = [];
  private head = 0;

  constructor(
    /** Milliseconds a frame may spend (after its first step). */
    readonly budgetMs: number,
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

  /** This frame's share: steps until the budget is used, at least one. Returns how many ran. */
  run(): number {
    if (!this.size) return 0;
    const t0 = this.clock();
    let ran = 0;
    do {
      this.next();
      ran++;
    } while (this.size && this.clock() - t0 < this.budgetMs);
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
