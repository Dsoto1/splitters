
/** MapMaker's tiny DOM helpers (split out of editorApp.ts, MapMaker overhaul Phase 2 item 5). */

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------------------------------------------------------- tiny DOM helpers

export function isTyping(): boolean {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') && (el as HTMLInputElement).type !== 'checkbox';
}

export function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

export function h2(t: string): HTMLElement {
  const e = document.createElement('h2');
  e.textContent = t;
  return e;
}

export function text(t: string): HTMLElement {
  const e = document.createElement('span');
  e.textContent = t;
  return e;
}

export function small(t: string): HTMLElement {
  const e = document.createElement('small');
  e.style.color = 'var(--muted)';
  e.textContent = t;
  return e;
}

export function row(label: string, control: HTMLElement): HTMLElement {
  const r = document.createElement('div');
  r.className = 'row';
  r.append(text(label), control);
  return r;
}

export function numberInput(value: number, step: number, onCommit: (v: number) => void): HTMLInputElement {
  const i = document.createElement('input');
  i.type = 'number';
  i.step = String(step);
  i.value = String(value);
  i.addEventListener('change', () => {
    const v = Number(i.value);
    if (Number.isFinite(v)) onCommit(v);
  });
  return i;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
