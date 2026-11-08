import { PROP_RANDOM_DEFAULTS, PROP_RANDOM_SIZES, PROP_RANDOM_TURNS, rollProp, type PropRandomOptions, type PropRoll } from '@tiletrigger/shared';

/**
 * The prop tool's placing options (MapMaker overhaul Phase 1, item 4): props land on whatever is under the pointer
 * (surfaceSnap.ts), and Randomise (off by default) gives each placement a random turn, size and variant. The rolls are
 * seeded (`?test=1` starts from seed 1), and the ghost shows the next one, so what you see is what you place.
 */
export class PropPlaceOptions {
  readonly opts: PropRandomOptions = { ...PROP_RANDOM_DEFAULTS };
  readonly el: HTMLElement;
  /** Placements rolled so far: the ghost shows roll `n`, a click places it and moves on. */
  private n = 0;

  constructor(
    private readonly seed: number,
    private readonly onChange: () => void,
  ) {
    const el = document.createElement('div');
    el.id = 'ed-prop-place';
    el.className = 'ed-prop-place';
    el.innerHTML = `
      <div class="ed-note">Props land on what is under the pointer: a tabletop, a roof, a ledge, the ground (Ctrl: off the grid).</div>
      <label class="check" title="Each prop you place gets a random turn, size and variant within these ranges; the see-through preview shows the next one"><input id="ed-prop-random" type="checkbox" /> Randomise each placement</label>
      <div class="ed-prop-random-opts">
        <label class="stack">Turn<select id="ed-prop-random-turn"></select></label>
        <label class="stack">Size<select id="ed-prop-random-size"></select></label>
        <label class="check" title="Props with variants (the environment's species: summer, autumn, snow…) get a random one"><input id="ed-prop-random-variant" type="checkbox" /> Variant</label>
      </div>`;
    this.el = el;
    const on = el.querySelector<HTMLInputElement>('#ed-prop-random')!;
    const turn = el.querySelector<HTMLSelectElement>('#ed-prop-random-turn')!;
    const size = el.querySelector<HTMLSelectElement>('#ed-prop-random-size')!;
    const variant = el.querySelector<HTMLInputElement>('#ed-prop-random-variant')!;
    for (const t of PROP_RANDOM_TURNS) turn.append(new Option(t === 'any' ? 'Any way' : t === 0 ? 'No turn' : `±${t}°`, String(t), false, t === this.opts.turn));
    for (const s of PROP_RANDOM_SIZES) size.append(new Option(s === 0 ? 'Same size' : `±${Math.round(s * 100)} %`, String(s), false, s === this.opts.size));
    on.checked = this.opts.on;
    variant.checked = this.opts.variant;
    const sync = () => {
      this.opts.on = on.checked;
      this.opts.turn = turn.value === 'any' ? 'any' : Number(turn.value);
      this.opts.size = Number(size.value);
      this.opts.variant = variant.checked;
      el.classList.toggle('on', this.opts.on);
      this.onChange();
    };
    for (const c of [on, turn, size, variant]) c.addEventListener('change', sync);
    el.classList.toggle('on', this.opts.on);
  }

  /** The next placement of `model` facing `yaw` (the ghost's, and the next click's). */
  next(model: string, yaw: number): PropRoll {
    return rollProp(model, yaw, this.opts, this.seed, this.n);
  }

  /** A prop was placed with the next roll: roll again. */
  placed(): void {
    if (this.opts.on) this.n++;
  }

  /** Put the options at the top of `pane` (the Props or Nature tab, whichever holds the prop in hand). */
  mount(pane: Element | null): void {
    if (pane && this.el.parentElement !== pane) pane.prepend(this.el);
  }
}
