/**
 * A small menu that drops from a button (MapMaker UI spec Phase 1: the top bar's View menu and the tool bar's
 * overflow). WAI-ARIA menu button: the button says it has a menu and whether it is open; the menu's items take the
 * arrow keys, Home and End; Esc closes it and gives the button the focus back; a click or tap elsewhere closes it.
 * A checkbox item (`menuitemcheckbox`) leaves the menu open, so several can be ticked in a row. The menu is placed
 * under its button once, when it opens (no work while it is shut).
 */
export interface PopupMenu {
  readonly button: HTMLButtonElement;
  readonly menu: HTMLElement;
  readonly isOpen: boolean;
  open(focusFirst?: boolean): void;
  close(focusButton?: boolean): void;
}

export function popupMenu(button: HTMLButtonElement, menu: HTMLElement, opts: { label: string; onOpen?: () => void; align?: 'left' | 'right' }): PopupMenu {
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', opts.label);
  menu.classList.add('ed-menu');
  menu.hidden = true;
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', menu.id);
  const items = () => [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')].filter((el) => !el.hidden && !(el as HTMLButtonElement).disabled);
  const outside = (e: PointerEvent) => {
    const t = e.target as Node;
    if (!menu.contains(t) && !button.contains(t)) api.close();
  };
  const api: PopupMenu = {
    button,
    menu,
    get isOpen() {
      return !menu.hidden;
    },
    open(focusFirst = false) {
      if (!menu.hidden) return;
      opts.onOpen?.();
      menu.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      button.classList.add('on');
      const r = button.getBoundingClientRect();
      const w = menu.offsetWidth;
      const left = opts.align === 'right' ? r.right - w : r.left;
      menu.style.left = `${Math.max(4, Math.min(innerWidth - w - 4, left))}px`;
      menu.style.top = `${r.bottom + 4}px`;
      menu.style.maxHeight = `${Math.max(120, innerHeight - r.bottom - 48)}px`;
      document.addEventListener('pointerdown', outside, true);
      if (focusFirst) items()[0]?.focus();
    },
    close(focusButton = false) {
      if (menu.hidden) return;
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      button.classList.remove('on');
      document.removeEventListener('pointerdown', outside, true);
      if (focusButton) button.focus();
    },
  };
  button.addEventListener('click', () => (api.isOpen ? api.close() : api.open(button.matches(':focus-visible'))));
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && api.isOpen) {
      e.preventDefault();
      e.stopPropagation();
      api.close();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      api.open();
      const all = items();
      (e.key === 'ArrowDown' ? all[0] : all[all.length - 1])?.focus();
    }
  });
  menu.addEventListener('keydown', (e) => {
    const all = items();
    const i = all.indexOf(document.activeElement as HTMLElement);
    let to: HTMLElement | undefined;
    if (e.key === 'ArrowDown') to = all[(i + 1) % all.length];
    else if (e.key === 'ArrowUp') to = all[(i - 1 + all.length) % all.length];
    else if (e.key === 'Home') to = all[0];
    else if (e.key === 'End') to = all[all.length - 1];
    else if (e.key === 'Escape') api.close(true);
    else if (e.key === 'Tab') return api.close();
    else return;
    // The menu's own keys: MapMaker's key table (nudges, Esc to Select) does not hear them.
    e.preventDefault();
    e.stopPropagation();
    to?.focus();
  });
  menu.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[role^="menuitem"]');
    if (!item || (item as HTMLButtonElement).disabled) return;
    if (item.getAttribute('role') !== 'menuitemcheckbox') api.close(true);
  });
  return api;
}

/** A menu item: a button with its label and, where it has one, its key. */
export function menuItem(id: string, label: string, opts: { key?: string; title?: string; checkbox?: boolean; onClick: () => void }): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.id = id;
  b.className = 'ed-menu-item';
  b.setAttribute('role', opts.checkbox ? 'menuitemcheckbox' : 'menuitem');
  b.tabIndex = -1;
  if (opts.title) b.title = opts.title;
  const name = document.createElement('span');
  name.textContent = label;
  b.append(name);
  if (opts.key) {
    const k = document.createElement('kbd');
    k.textContent = opts.key;
    b.append(k);
  }
  b.addEventListener('click', () => opts.onClick());
  return b;
}

/** A menu's group heading (not an item: the arrow keys pass over it). */
export function menuHeading(text: string): HTMLElement {
  const h = document.createElement('div');
  h.className = 'ed-menu-head';
  h.setAttribute('role', 'presentation');
  h.textContent = text;
  return h;
}

/** Tick or untick a checkbox item (`aria-checked`, and `on` for the look). */
export function setChecked(item: HTMLElement, on: boolean): void {
  item.setAttribute('aria-checked', String(on));
  item.classList.toggle('on', on);
}
