import { BIND_ACTIONS, BIND_GROUPS, FIXED_KEYS, UNBINDABLE, bindAction, bindings, clashesFor, defaultBindings, keyLabel, resetBindings, setBindings, setKey, swapKey, type Bindings } from '../game/keyBindings.ts';

/**
 * Options → Controls, the keys (owner, 2026-11-23; docs/CONTROLS.md): every keyboard and mouse action by group, two
 * keys each. Click a key (or Enter / Space on it), then press the new key or mouse button (or roll the wheel); Esc
 * keeps the old one, Delete clears it. A key another action uses in the same place warns, and offers to swap the
 * two or take it from the other; Reset to defaults puts every key back. Works with the keyboard alone and at phone
 * width; saved at once (keyBindings.ts: this browser, and the account when signed in).
 */

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  const { class: cls, ...rest } = props;
  if (cls) e.className = cls;
  Object.assign(e, rest);
  e.append(...children);
  return e;
};

/** A browser mouse button (MouseEvent.button) as a bindings code. */
const mouseCode = (button: number): string => (button === 0 ? 'Mouse0' : button === 1 ? 'Mouse1' : button === 2 ? 'Mouse2' : button === 3 || button === 4 ? 'MouseSide' : '');

export function controlsPage(): HTMLElement {
  const root = el('div', { class: 'binds' });
  const status = el('p', { class: 'binds-status', role: 'status' });
  /** The capture going on now (one at a time), to stop it. */
  let stopCapture: (() => void) | null = null;
  /** The action and slot whose button to focus after a redraw. */
  let focusAfter: string | null = null;

  const draw = () => {
    stopCapture?.();
    const b = bindings();
    const reset = el('button', { type: 'button', class: 'binds-reset', textContent: 'Reset to defaults' });
    reset.addEventListener('click', () => {
      resetBindings();
      status.textContent = 'Every key is back to its default.';
      focusAfter = 'reset';
      draw();
    });
    const changed = BIND_ACTIONS.some((a) => a.keys[0] !== b[a.id]?.[0] || a.keys[1] !== b[a.id]?.[1]);
    reset.disabled = !changed;
    const head = el(
      'div',
      { class: 'binds-head' },
      el('p', { class: 'opt-note', textContent: 'Click a key, then press the new key or mouse button (or roll the wheel). Esc keeps the old key, Delete clears it. Each action takes two keys.' }),
      reset,
    );
    const groups = BIND_GROUPS.map((g) => {
      const rows = BIND_ACTIONS.filter((a) => a.group === g.id).map((a) => row(a.id, b));
      const fixed = g.id === 'menus' ? FIXED_KEYS.map(([label, keys]) => el('div', { class: 'bind-row fixed', role: 'listitem' }, el('span', { class: 'bind-name', textContent: label }), el('span', { class: 'bind-fixed', textContent: keys }))) : [];
      const extra =
        g.id === 'vehicles'
          ? [el('div', { class: 'bind-row fixed', role: 'listitem' }, el('span', { class: 'bind-name', textContent: 'Get in or out · drive and steer' }), el('span', { class: 'bind-fixed', textContent: `${keyLabel(b.use?.[0] ?? '')} · ${['forward', 'left', 'back', 'right'].map((id) => keyLabel(b[id]?.[0] ?? '')).join(' ')}` }))]
          : [];
      const id = `binds-${g.id}`;
      return el('section', { class: 'bind-group' }, el('h4', { class: 'opt-sub', id, textContent: g.label }), el('div', { class: 'bind-list', role: 'list' }, ...rows, ...extra, ...fixed));
    });
    root.replaceChildren(head, status, ...groups);
    for (const s of root.querySelectorAll('.bind-group')) s.querySelector('.bind-list')!.setAttribute('aria-labelledby', s.querySelector('h4')!.id);
    if (focusAfter) {
      const f = focusAfter === 'reset' ? root.querySelector<HTMLElement>('.binds-reset') : root.querySelector<HTMLElement>(`[data-bind="${focusAfter}"]`);
      f?.focus();
      focusAfter = null;
    }
  };

  /** One action's row: its name and two key buttons, and the clash question when there is one. */
  const row = (action: string, b: Bindings): HTMLElement => {
    const a = bindAction(action)!;
    const r = el('div', { class: 'bind-row', role: 'listitem' });
    r.dataset.action = action;
    const name = el('span', { class: 'bind-name' }, a.label);
    if (a.note) name.append(el('small', { textContent: a.note }));
    const keys = el('span', { class: 'bind-keys' });
    const ask = el('div', { class: 'bind-ask', hidden: true, role: 'alert' });
    for (const slot of [0, 1] as const) {
      const code = b[action]?.[slot] ?? '';
      const btn = el('button', { type: 'button', class: `key-bind${slot ? ' alt' : ''}${code ? '' : ' none'}`, textContent: code ? keyLabel(code) : slot ? 'Add' : '—' });
      btn.dataset.bind = `${action}.${slot}`;
      btn.setAttribute('aria-label', `${a.label}, ${slot ? 'second key' : 'key'}: ${code ? keyLabel(code) : 'none'}. Press to change.`);
      btn.addEventListener('click', () => capture(action, slot, btn, ask));
      keys.append(btn);
    }
    r.append(name, keys, ask);
    return r;
  };

  /** Wait for the next key, mouse button or wheel roll, and bind it to `action`'s `slot`. */
  const capture = (action: string, slot: 0 | 1, btn: HTMLButtonElement, ask: HTMLElement) => {
    stopCapture?.();
    const a = bindAction(action)!;
    const old = btn.textContent;
    btn.textContent = 'Press a key…';
    btn.classList.add('listening');
    btn.setAttribute('aria-label', `${a.label}: press the new key or mouse button. Escape cancels, Delete clears.`);
    status.textContent = '';
    ask.hidden = true;
    const ctl = new AbortController();
    const opts = { capture: true, signal: ctl.signal };
    const stop = () => {
      ctl.abort();
      stopCapture = null;
      btn.classList.remove('listening');
    };
    stopCapture = () => {
      stop();
      btn.textContent = old;
    };
    const take = (code: string) => {
      stop();
      if (!code) {
        btn.textContent = old;
        return;
      }
      if (UNBINDABLE.has(code)) {
        btn.textContent = old;
        status.textContent = `${keyLabel(code)} keeps its own job: pick another key.`;
        return;
      }
      const b = bindings();
      const others = clashesFor(b, action, code);
      if (!others.length) {
        setBindings(setKey(b, action, slot, code));
        status.textContent = `${a.label}: ${keyLabel(code)}.`;
        focusAfter = `${action}.${slot}`;
        draw();
        return;
      }
      // A clash: say who has it, and offer to swap or take it.
      btn.textContent = old;
      const names = others.map((o) => bindAction(o)!.label).join(', ');
      const oldCode = b[action]?.[slot] ?? '';
      const swap = el('button', { type: 'button', class: 'primary', textContent: oldCode ? `Swap (${names} gets ${keyLabel(oldCode)})` : 'Swap' });
      const takeIt = el('button', { type: 'button', class: 'bind-take', textContent: `Take it (${names} loses it)` });
      const cancel = el('button', { type: 'button', class: 'bind-cancel', textContent: 'Cancel' });
      ask.replaceChildren(el('span', { textContent: `${keyLabel(code)} is already ${names}.` }), el('span', { class: 'bind-ask-buttons' }, swap, takeIt, cancel));
      ask.hidden = false;
      swap.addEventListener('click', () => {
        setBindings(swapKey(bindings(), action, slot, code));
        status.textContent = `Swapped: ${a.label} ${keyLabel(code)}${oldCode ? `, ${names} ${keyLabel(oldCode)}` : ''}.`;
        focusAfter = `${action}.${slot}`;
        draw();
      });
      takeIt.addEventListener('click', () => {
        let next = setKey(bindings(), action, slot, code);
        for (const o of others) next = setKey(next, o, next[o]!.indexOf(code) as 0 | 1, '');
        setBindings(next);
        status.textContent = `${a.label}: ${keyLabel(code)}. ${names} has no ${keyLabel(code)} now.`;
        focusAfter = `${action}.${slot}`;
        draw();
      });
      cancel.addEventListener('click', () => {
        ask.hidden = true;
        btn.focus();
      });
      swap.focus();
    };
    window.addEventListener(
      'keydown',
      (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.code === 'Escape') {
          stopCapture?.();
          btn.focus();
        } else if (e.code === 'Delete') {
          stop();
          setBindings(setKey(bindings(), action, slot, ''));
          status.textContent = `${a.label}: ${slot ? 'second key' : 'key'} cleared.`;
          focusAfter = `${action}.${slot}`;
          draw();
        } else take(e.code);
      },
      opts,
    );
    window.addEventListener('keyup', (e) => e.stopImmediatePropagation(), opts);
    window.addEventListener(
      'mousedown',
      (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        // The rest of this press isn't the page's: not a click on what's under it, nor the browser's own jobs (the
        // right button's menu, the side buttons' back and forward).
        const swallow = new AbortController();
        const eat = (ev: Event) => {
          ev.preventDefault();
          ev.stopImmediatePropagation();
        };
        for (const t of ['mouseup', 'click', 'auxclick', 'contextmenu']) window.addEventListener(t, eat, { capture: true, signal: swallow.signal });
        setTimeout(() => swallow.abort(), 600);
        take(mouseCode(e.button));
      },
      opts,
    );
    window.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
    window.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (e.deltaY) take(e.deltaY > 0 ? 'WheelDown' : 'WheelUp');
      },
      { ...opts, passive: false },
    );
  };

  draw();
  return root;
}

/** For tests: whether the defaults have any clash (they mustn't). */
export const defaultsClean = (): boolean => BIND_ACTIONS.every((a) => a.keys.every((k) => !k || clashesFor(defaultBindings(), a.id, k).length === 0));
