import './coach.css';
import { TIP_TEXT, type TipId } from './tips.ts';
import { TUTORIAL_STEPS, type Tutorial } from './tutorial.ts';

/**
 * The new player's HUD (tutorial.ts, tips.ts): the tutorial's step card (top middle, under the score bar: what to
 * do, the keys or buttons for your input, the step's progress, "3 / 10" and dots, Skip) and the one tip at a time
 * (low in the middle, under the crosshair's area, never over it). Both fade in and out (no flash: Reduce flashing
 * has nothing to calm here).
 */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** `[X]` → a key cap. */
export const keyMarkup = (s: string): string => esc(s).replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>');

export class CoachHud {
  private readonly panel: HTMLDivElement | null = null;
  private readonly tip: HTMLDivElement;
  private shownTip: TipId | null = null;
  private drawn = '';
  private justDone = 0;

  constructor(
    root: HTMLElement,
    private readonly touch: boolean,
    tutorial: { onSkip: () => void } | null,
  ) {
    this.tip = document.createElement('div');
    this.tip.id = 'coach-tip';
    this.tip.setAttribute('role', 'status');
    this.tip.setAttribute('aria-live', 'polite');
    root.append(this.tip);
    if (!tutorial) return;
    const p = document.createElement('div');
    p.id = 'tutorial';
    p.className = 'coach-panel';
    p.innerHTML =
      '<div class="tut-head"><span class="tut-kicker">Tutorial</span><span class="tut-count"></span>' +
      `<button type="button" id="tutorial-skip" class="tut-skip" title="Skip the tutorial and go back to the main menu">Skip${touch ? '' : ' <small>Esc pauses</small>'}</button></div>` +
      `<div class="tut-dots">${TUTORIAL_STEPS.map(() => '<i></i>').join('')}</div>` +
      '<b class="tut-title"></b><p class="tut-text"></p><div class="tut-bar"><i></i></div>';
    p.querySelector('#tutorial-skip')!.addEventListener('click', (e) => {
      e.stopPropagation();
      tutorial.onSkip();
    });
    root.append(p);
    this.panel = p;
  }

  /** The tutorial's card, as it stands. `stepDone`: a step just finished (its tick shows for a moment). */
  tutorial(t: Tutorial, stepDone: boolean, now: number): void {
    const p = this.panel;
    if (!p) return;
    if (stepDone) this.justDone = now + 0.7;
    const step = t.step;
    const total = TUTORIAL_STEPS.length;
    const key = step ? `${t.index}` : 'done';
    if (key !== this.drawn) {
      this.drawn = key;
      p.dataset.step = step?.id ?? 'done';
      p.querySelector('.tut-count')!.textContent = `${Math.min(t.index + 1, total)} / ${total}`;
      p.querySelectorAll('.tut-dots i').forEach((d, i) => {
        d.className = i < t.index ? 'done' : i === t.index ? 'on' : '';
      });
      p.querySelector('.tut-title')!.textContent = step ? step.title : 'Tutorial complete';
      p.querySelector('.tut-text')!.innerHTML = step
        ? keyMarkup(this.touch ? step.touch : step.kb)
        : keyMarkup(this.touch ? "You're ready. Practise here as long as you like; [II] then Leave goes back to the menu, where Quick Play starts a match." : "You're ready. Practise here as long as you like; [Esc] then Leave goes back to the menu, where Quick Play starts a match.");
      (p.querySelector('#tutorial-skip') as HTMLButtonElement).hidden = !step;
    }
    p.classList.toggle('just-done', now < this.justDone);
    (p.querySelector('.tut-bar i') as HTMLElement).style.width = `${Math.round(t.progress * 100)}%`;
  }

  /** The tip to show (null: none). */
  setTip(id: TipId | null): void {
    if (id === this.shownTip) return;
    this.shownTip = id;
    if (id) {
      this.tip.innerHTML = `<span class="tip-kicker">Tip</span> ${keyMarkup(this.touch ? TIP_TEXT[id].touch : TIP_TEXT[id].kb)}`;
      this.tip.dataset.tip = id;
    }
    this.tip.classList.toggle('on', !!id);
  }

  dispose(): void {
    this.tip.remove();
    this.panel?.remove();
  }
}
