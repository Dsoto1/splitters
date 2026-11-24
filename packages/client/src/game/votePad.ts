/**
 * A controller over the map vote (mapVoteHud.ts): d-pad left / right and the left stick (a push past the middle is one
 * step) move the highlight across the cards, A votes for it. `poll` is called once a frame with the standard-mapping pad.
 */
export class VotePad {
  cursor = 0;
  private prev: boolean[] = [];
  private stick = 0;

  poll(pad: { buttons: readonly { pressed: boolean; value: number }[]; axes: readonly number[] } | undefined, cards: number): { moved: boolean; cast: number | null } {
    const down = pad ? pad.buttons.map((b) => b.pressed || b.value > 0.4) : [];
    const was = this.prev;
    this.prev = down;
    if (!pad || cards < 1) return { moved: false, cast: null };
    const x = pad.axes[0] ?? 0;
    const dir = x < -0.6 ? -1 : x > 0.6 ? 1 : 0;
    let step = dir !== this.stick ? dir : 0;
    this.stick = dir;
    if (down[15] && !was[15]) step += 1;
    if (down[14] && !was[14]) step -= 1;
    const before = this.cursor;
    this.cursor = Math.max(0, Math.min(cards - 1, this.cursor + Math.sign(step)));
    const cast = down[0] && !was[0] ? this.cursor : null;
    return { moved: this.cursor !== before, cast };
  }
}
