/**
 * Which of a match's downloads go first: the characters' files (a body still on its way is drawn as a capsule)
 * before the map's props, the guns and the other models. A first visit's connection is shared by everything asked
 * for at once, and the browser serves requests in the order they were asked: the training range's sixty guns, asked
 * for a moment before the bots' looks were known, held every character's files (and the code that decodes their
 * textures) back for 45 s on an 8 Mbit line, and the bots stayed capsules for half a minute of play.
 *
 * While held (`hold`: from the start of the match's load, until the character files asked for meanwhile are in, a
 * short grace for the roster's looks to arrive, or the hold's cap), other downloads start at most `share` at a time,
 * in the order asked; they all start as soon as it ends. Character files never wait.
 */
export class LoadOrder {
  /** Character files on their way. */
  private firsts = 0;
  /** When the hold ends at the latest, and before when it lasts even with no character file on its way (ms). */
  private until = 0;
  private graceUntil = 0;
  private running = 0;
  /** Past the match's start (settle): character files asked for from now on hold nothing back. */
  private settled = false;
  /** Waiting downloads, the map's before the rest, each in the order asked. */
  private readonly waiting: { rank: number; go: () => void }[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    /** Other downloads running at once while held (a few keep the map coming in beside the characters). */
    private readonly share = 2,
    private readonly now: () => number = () => performance.now(),
  ) {}

  /** Hold other downloads behind the characters' from now, for `ms` at most; at least `grace` ms (the roster's looks may come in a moment later). */
  hold(ms: number, grace = 3000): void {
    const t = this.now();
    this.settled = false;
    this.until = Math.max(this.until, t + ms);
    this.graceUntil = Math.max(this.graceUntil, t + Math.min(grace, ms));
    this.pump();
  }

  /**
   * The match has started: the character files on their way still hold the rest back (a slow line's bots), but none
   * asked for from now on does (a bot's new look mid-match, a joining player): their guns came in two at a time
   * behind every new look, and bots stood unarmed.
   */
  settle(): void {
    this.settled = true;
    this.graceUntil = 0;
    this.pump();
  }

  /** End the hold now (everything waiting starts). */
  release(): void {
    this.until = this.graceUntil = 0;
    this.pump();
  }

  /** Whether other downloads are held back now. */
  get held(): boolean {
    const t = this.now();
    return t < this.until && (this.firsts > 0 || t < this.graceUntil);
  }

  /** How many other downloads wait for their turn (tests, the performance report). */
  get queued(): number {
    return this.waiting.length;
  }

  /**
   * A character file's download: it starts at once, and while its bytes come in others are held (during a hold).
   * `start` is handed `bytesIn`, to call once the file's bytes are all in (its parse and texture transcoding don't use
   * the line: a slow machine's transcodes held the guns back half a minute); else the hold lasts till it settles.
   */
  first<T>(start: (bytesIn: () => void) => Promise<T>): Promise<T> {
    if (this.settled) return start(() => {});
    this.firsts++;
    let counted = true;
    const done = () => {
      if (!counted) return;
      counted = false;
      this.firsts--;
      this.pump();
    };
    let p: Promise<T>;
    try {
      p = start(done);
    } catch (e) {
      p = Promise.reject(e);
    }
    p.then(done, done);
    return p;
  }

  /**
   * Any other download: started now, or when its turn comes while the characters' are held first. Rank 0 (the map's
   * own props, kit and plants: small, and the level looks bare without them) goes before rank 1 (guns, vehicles, the
   * rest: the bulk of the bytes).
   */
  other<T>(start: () => Promise<T>, rank = 1): Promise<T> {
    if (!this.held && !this.waiting.length) return start();
    return new Promise<T>((resolve, reject) => {
      const go = () => {
        this.running++;
        const done = () => {
          this.running--;
          this.pump();
        };
        let p: Promise<T>;
        try {
          p = start();
        } catch (e) {
          p = Promise.reject(e);
        }
        p.then(done, done);
        p.then(resolve, reject);
      };
      // After every waiting download of its rank or a nearer one.
      let at = this.waiting.length;
      while (at > 0 && this.waiting[at - 1]!.rank > rank) at--;
      this.waiting.splice(at, 0, { rank, go });
      this.pump();
    });
  }

  private pump(): void {
    const held = this.held;
    while (this.waiting.length && (!held || this.running < this.share)) this.waiting.shift()!.go();
    // Wake when the hold's grace or cap passes, to start what waits.
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.waiting.length && held) {
      const next = this.firsts > 0 ? this.until : Math.min(this.until, this.graceUntil);
      this.timer = setTimeout(() => ((this.timer = null), this.pump()), Math.max(0, next - this.now()) + 5);
    }
  }
}

/** Each game scene's order (GameView sets it; MapMaker and the menu have none, and load as asked). */
const orders = new WeakMap<object, LoadOrder>();

export function useLoadOrder(scene: object, order: LoadOrder): void {
  orders.set(scene, order);
}

export function loadOrderOf(scene: object): LoadOrder | null {
  return orders.get(scene) ?? null;
}

/** A character's file (a body, its parts, gear, clips, a creature): never waits. */
export const firstLoad = <T>(scene: object, start: () => Promise<T>): Promise<T> => orders.get(scene)?.first(start) ?? start();

/** Any other model's file (props, guns, vehicles, the environment's plants): behind the characters while held (rank: LoadOrder.other). */
export const otherLoad = <T>(scene: object, start: () => Promise<T>, rank = 1): Promise<T> => orders.get(scene)?.other(start, rank) ?? start();
