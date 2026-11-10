import {
  coreCatalog,
  skipTour,
  startTour,
  TOUR_OFF,
  TOUR_STEPS,
  TOUR_STORE_KEY,
  tourAdvance,
  tourStartsByItself,
  type TourContext,
  type TourEvent,
  type TourState,
} from '@tiletrigger/shared';
import { testMode } from '../testMode.ts';
import type { EditorApp } from './editorApp.ts';
import { $ } from './editorDom.ts';
import { dressable } from './editorParts.ts';

/** The steps the count covers ("Step 1 of 4"): the ones between the welcome and the closing card. */
const COUNTED = TOUR_STEPS.filter((s) => s.on !== 'button');

function remembered(): string | null {
  try {
    return localStorage.getItem(TOUR_STORE_KEY);
  } catch {
    return null;
  }
}

function remember(how: 'done' | 'skipped'): void {
  try {
    localStorage.setItem(TOUR_STORE_KEY, how);
  } catch {
    // Private windows: the tour is remembered for this visit only.
  }
}

/**
 * MapMaker's first-time tour (MapMaker overhaul Phase 6; the rules are shared editor/tour.ts): a small card over the
 * view with one line per step, and the button or palette card to use lit up. It never blocks editing: the card is
 * the only thing it puts in the way, and each step moves on when the person does it (the history's edits, a test
 * starting). Esc or Skip ends it at any step. It starts by itself on a first visit (not in `?test=1`, unless
 * `&tour=1`), and again from the `?` key list.
 */
export class EditorTour {
  state: TourState = TOUR_OFF;
  readonly card: HTMLElement;
  private lit: HTMLElement[] = [];
  private readonly ctx: TourContext = { isRoom: (id) => dressable(coreCatalog.get(id)) };

  constructor(private readonly app: EditorApp) {
    this.card = document.createElement('section');
    this.card.id = 'ed-tour';
    this.card.className = 'ed-tour';
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-modal', 'false');
    this.card.setAttribute('aria-labelledby', 'ed-tour-title');
    this.card.setAttribute('aria-describedby', 'ed-tour-hint');
    this.card.hidden = true;
    this.card.innerHTML =
      '<div class="ed-tour-count" id="ed-tour-count"></div><h3 id="ed-tour-title"></h3><p id="ed-tour-hint" aria-live="polite"></p>' +
      '<div class="ed-tour-actions"><button type="button" id="ed-tour-skip">Skip tour</button><button type="button" id="ed-tour-next" class="primary"></button></div>';
    $('editor').append(this.card);
    this.card.querySelector('#ed-tour-skip')!.addEventListener('click', () => this.skip());
    this.card.querySelector('#ed-tour-next')!.addEventListener('click', () => this.note({ kind: 'button' }));

    // Edits, from the history (after whoever else listens: the budget bar).
    const prev = app.history.onChange;
    app.history.onChange = (c) => {
      prev?.(c);
      if (this.state.step !== null && !c.reset) this.note({ kind: 'edit', command: c.command, undo: c.undo });
    };
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || this.state.step === null || !this.app.active) return;
      // A dialog takes Esc for itself; the closing card waits for its button (the Esc that leaves a test isn't for it).
      if (document.querySelector('dialog[open]') || TOUR_STEPS[this.state.step]?.id === 'done') return;
      this.skip();
    });
    // The highlight follows the mode, the palette tab, folded groups and the search.
    const relight = () => this.state.step !== null && this.light();
    const watch = new MutationObserver(relight);
    for (const id of ['ed-modes', 'ed-pal-tabs', 'ed-palette']) watch.observe($(id), { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    $('ed-search').addEventListener('input', relight);
  }

  get running(): boolean {
    return this.state.step !== null;
  }

  /** Entering MapMaker: start on a first visit. */
  maybeStart(): void {
    if (this.running) return;
    const q = new URLSearchParams(location.search);
    if (tourStartsByItself({ remembered: remembered(), testMode: !!testMode(), asked: q.get('tour') === '1' })) this.start();
  }

  start(): void {
    this.set(startTour());
    (this.card.querySelector('#ed-tour-next') as HTMLButtonElement).focus({ preventScroll: true });
  }

  skip(): void {
    this.set(skipTour(this.state));
  }

  /** Something happened in the editor: the step moves on when it was what the step asked for. */
  note(ev: TourEvent): void {
    if (this.state.step === null) return;
    this.set(tourAdvance(this.state, ev, this.ctx));
  }

  private set(next: TourState): void {
    const moved = next.step !== this.state.step;
    this.state = next;
    if (next.ended) remember(next.ended);
    if (moved) this.render();
  }

  private render(): void {
    const step = this.state.step === null ? null : TOUR_STEPS[this.state.step];
    this.card.hidden = !step;
    this.card.dataset.step = step?.id ?? '';
    if (!step) return this.unlight();
    const n = COUNTED.indexOf(step);
    $('ed-tour-count').textContent = n >= 0 ? `Step ${n + 1} of ${COUNTED.length}` : step.id === 'welcome' ? 'Quick tour' : 'All done';
    $('ed-tour-title').textContent = step.title;
    $('ed-tour-hint').textContent = step.hint;
    const next = this.card.querySelector<HTMLButtonElement>('#ed-tour-next')!;
    next.hidden = step.on !== 'button';
    next.textContent = step.id === 'welcome' ? "Let's go" : 'Done';
    (this.card.querySelector('#ed-tour-skip') as HTMLElement).hidden = step.id === 'done';
    this.light(true);
  }

  /** What to light for the step now: its mode tab until the person is in that mode, then its cards or buttons. */
  private targets(): HTMLElement[] {
    const step = this.state.step === null ? null : TOUR_STEPS[this.state.step];
    if (!step?.targets) return [];
    if (step.mode && this.app.paletteWs !== step.mode) {
      const tab = document.querySelector<HTMLElement>(`#ed-modes [data-ws="${step.mode}"]`);
      return tab ? [tab] : [];
    }
    const shown = (el: Element | null): boolean => !!el && (el as HTMLElement).offsetParent !== null;
    const out: HTMLElement[] = [];
    for (const t of step.targets) {
      if (t.startsWith('#')) {
        const el = document.getElementById(t.slice(1));
        if (el && shown(el)) out.push(el);
        continue;
      }
      const card = document.querySelector<HTMLElement>(`#ed-palette .ed-pane [data-tool="${CSS.escape(t)}"]`);
      const found = document.querySelector<HTMLElement>(`#ed-pal-results [data-pick="${CSS.escape(t)}"]`);
      if (found && shown(found)) out.push(found);
      else if (card && shown(card)) out.push(card);
      else if (card) {
        // Not in sight: the palette tab it is on, or the folded group it is in.
        const pane = card.closest<HTMLElement>('.ed-pane');
        const tab = pane?.hidden ? document.querySelector<HTMLElement>(`#ed-pal-tabs [data-pane="${pane.dataset.pane}"]`) : null;
        const head = card.closest('.ed-group')?.querySelector<HTMLElement>(':scope > .ed-group-head') ?? null;
        if (tab && shown(tab)) out.push(tab);
        else if (head && shown(head)) out.push(head);
      }
    }
    // The palette folded away: its toggle brings it back.
    if (!out.length && step.targets.some((t) => !t.startsWith('#')) && $('editor').classList.contains('pal-collapsed')) out.push($('ed-pal-toggle'));
    return out;
  }

  private light(fresh = false): void {
    const now = this.targets();
    if (!fresh && now.length === this.lit.length && now.every((el, i) => el === this.lit[i])) return;
    this.unlight();
    this.lit = now;
    for (const el of now) {
      el.classList.add('ed-tour-spot');
      // A palette card scrolled out of the palette's view comes into it.
      if (el.closest('#ed-palette')) el.scrollIntoView({ block: 'nearest' });
    }
  }

  private unlight(): void {
    for (const el of this.lit) el.classList.remove('ed-tour-spot');
    this.lit = [];
  }
}
