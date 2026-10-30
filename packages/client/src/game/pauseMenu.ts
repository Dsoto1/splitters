/**
 * The pause menu's navigation: one level of tabs (Match, Host, Settings),
 * a dialog or picker over them at most. Esc / gamepad B / the Back button
 * (top left) go back one level per press (dialog → tab → Match), then resume.
 * Q / E and LB / RB switch tabs; ↑ / ↓ and the d-pad move the focus, Enter /
 * A presses. The footer's key hints are buttons too (Back, Tabs, Fullscreen),
 * with the controller's glyphs when a controller was used last.
 */
import { fullscreenSupported, isFullscreen, toggleFullscreen } from '../fullscreen.ts';
import { PAD, glyphs } from '../inputMode.ts';

export type PauseTab = 'match' | 'host' | 'settings';

const $ = (id: string) => document.getElementById(id)!;

export class PauseMenu {
  tab: PauseTab = 'match';
  private prevPad: boolean[] = [];
  private readonly backLabels: HTMLElement[] = [];
  private fullscreenLabel: HTMLElement | null = null;

  constructor(
    private readonly hooks: {
      /** Leave the pause menu for the game (pointer lock). */
      resume: () => void;
      /** The topmost dialog or picker over the tabs (closed by going back), if any. */
      overlay: () => HTMLElement | null;
      /** Called when a tab opens (to refresh what it shows). */
      opened?: (tab: PauseTab) => void;
      /** Back from the top (Match, nothing open) goes here instead of resuming (MapMaker TEST: back to MapMaker). */
      top?: { label: string; act: () => void };
    },
    signal: AbortSignal,
  ) {
    for (const b of this.tabButtons()) b.addEventListener('click', () => this.show(b.dataset.tab as PauseTab), { signal });
    const back = document.getElementById('pause-back');
    if (back) {
      back.addEventListener('click', () => this.back(), { signal });
      const label = back.querySelector<HTMLElement>('.back-label');
      if (label) this.backLabels.push(label);
    }
    this.buildHints(signal);
    // Dialogs and pickers open over the tabs by joining #pause: the Back labels follow.
    const pause = document.getElementById('pause');
    if (pause) {
      const watch = new MutationObserver(() => this.refresh());
      watch.observe(pause, { childList: true });
      signal.addEventListener('abort', () => watch.disconnect());
    }
    document.addEventListener('fullscreenchange', () => this.refresh(), { signal });
    this.show('match');
  }

  /** The footer's key hints, each a button doing what its key does. */
  private buildHints(signal: AbortSignal): void {
    const bar = document.getElementById('pause-hints');
    if (!bar) return;
    const hint = (id: string, keys: HTMLElement[], label: string, title: string, act: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = id;
      b.className = 'hint-btn';
      b.title = title;
      const text = document.createElement('span');
      text.textContent = label;
      b.append(...keys, text);
      b.addEventListener('click', act, { signal });
      bar.append(b);
      return text;
    };
    bar.replaceChildren();
    this.backLabels.push(hint('pause-hint-back', glyphs('Esc', 'B', 'b'), 'Back', 'Back one level (Esc, controller B)', () => this.back()));
    hint('pause-hint-tabs', [...glyphs('Q', 'LB'), ...glyphs('E', 'RB')], 'Tabs', 'Next tab (Q / E, controller LB / RB)', () => this.cycle(1));
    if (fullscreenSupported()) this.fullscreenLabel = hint('pause-hint-fullscreen', glyphs('F11'), 'Fullscreen', 'Fullscreen on or off (F11)', () => void toggleFullscreen());
  }

  /** What Back does from here, on the Back button and the footer's hint. */
  private refresh(): void {
    const label = this.hooks.overlay() ? 'Back' : this.tab !== 'match' ? 'Back' : (this.hooks.top?.label ?? 'Resume');
    for (const l of this.backLabels) l.textContent = label;
    const back = document.getElementById('pause-back');
    if (back) back.title = this.hooks.overlay() ? 'Close the window (Esc)' : this.tab !== 'match' ? 'Back to Match (Esc)' : `${label} (Esc)`;
    if (this.fullscreenLabel) this.fullscreenLabel.textContent = isFullscreen() ? 'Exit fullscreen' : 'Fullscreen';
  }

  private tabButtons(): HTMLButtonElement[] {
    return [...document.querySelectorAll<HTMLButtonElement>('#pause .pause-tabs [data-tab]')];
  }

  /** Show or hide a tab (the Host tab is for whoever runs the match). */
  setTabVisible(tab: PauseTab, visible: boolean): void {
    const b = this.tabButtons().find((x) => x.dataset.tab === tab);
    if (b) b.hidden = !visible;
    if (!visible && this.tab === tab) this.show('match');
  }

  show(tab: PauseTab): void {
    this.tab = tab;
    for (const b of this.tabButtons()) {
      const on = b.dataset.tab === tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    }
    for (const s of document.querySelectorAll<HTMLElement>('#pause .pause-sec')) s.hidden = s.dataset.sec !== tab;
    this.refresh();
    this.hooks.opened?.(tab);
  }

  /** Next or previous visible tab. */
  cycle(dir: 1 | -1): void {
    const tabs = this.tabButtons().filter((b) => !b.hidden);
    const at = tabs.findIndex((b) => b.dataset.tab === this.tab);
    const next = tabs[(at + dir + tabs.length) % tabs.length];
    if (next) this.show(next.dataset.tab as PauseTab);
  }

  /** On the Match tab with no dialog open: one more Esc would leave the menu. */
  get atTop(): boolean {
    return !this.hooks.overlay() && this.tab === 'match';
  }

  /** Esc / B / Back: close the dialog, else back to Match, else resume (or the `top` hook). One level per call. */
  back(): void {
    const overlay = this.hooks.overlay();
    if (overlay) {
      const cancel = overlay.querySelector<HTMLButtonElement>('[data-cancel], #hm-close');
      if (cancel) cancel.click();
      else overlay.remove();
      this.refresh();
      return;
    }
    if (this.tab !== 'match') return this.show('match');
    if (this.hooks.top) return this.hooks.top.act();
    this.hooks.resume();
  }

  /** Move the focus through what can be pressed in the dialog, or the open tab and the footer. */
  moveFocus(dir: 1 | -1): void {
    const scope = this.hooks.overlay() ?? $('pause');
    const items = [...scope.querySelectorAll<HTMLElement>('button, input, select, summary, [tabindex="0"]')].filter((e) => !(e as HTMLButtonElement).disabled && e.offsetParent !== null && !e.closest('.pause-tabs'));
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = items[at < 0 ? (dir > 0 ? 0 : items.length - 1) : (at + dir + items.length) % items.length]!;
    next.focus();
    next.scrollIntoView({ block: 'nearest' });
  }

  /** Keys while paused; true when the menu used the key. */
  key(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'checkbox' && (t as HTMLInputElement).type !== 'range' ? true : t.tagName === 'SELECT');
    if (typing) return false;
    if (e.code === 'KeyQ' || e.code === 'KeyE') {
      this.cycle(e.code === 'KeyE' ? 1 : -1);
      return true;
    }
    if ((e.code === 'ArrowDown' || e.code === 'ArrowUp') && (t as HTMLInputElement | null)?.type !== 'range') {
      this.moveFocus(e.code === 'ArrowDown' ? 1 : -1);
      return true;
    }
    return false;
  }

  /** Once a frame while paused: a controller drives the menu. */
  pollPad(): void {
    const pad = [...(navigator.getGamepads?.() ?? [])].find((g) => g?.connected && g.mapping === 'standard');
    if (!pad) return;
    const down = pad.buttons.map((b) => b.pressed);
    const pressed = (i: number) => !!down[i] && !this.prevPad[i];
    if (pressed(PAD.up)) this.moveFocus(-1);
    if (pressed(PAD.down)) this.moveFocus(1);
    if (pressed(PAD.lb)) this.cycle(-1);
    if (pressed(PAD.rb)) this.cycle(1);
    if (pressed(PAD.a)) (document.activeElement as HTMLElement | null)?.click();
    if (pressed(PAD.b)) this.back();
    if (pressed(PAD.start)) this.hooks.resume();
    this.prevPad = down;
  }
}
