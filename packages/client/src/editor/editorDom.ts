
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

/** A long drop-down's choices, in the list's order: each group's label and its [label, value] pairs. */
export type ChoiceGroups = [string, [string, string][]][];

/** How wide each name is drawn in the inspector's font (worked out once a name: only which are the longest is asked). */
const labelWidths = new Map<string, number>();
let labelFont: CanvasRenderingContext2D | null | undefined;

/** The few longest of these names: a closed list is as wide as its longest choice. */
function widestChoices(options: [string, string][]): [string, string][] {
  if (labelFont === undefined) {
    labelFont = document.createElement('canvas').getContext('2d');
    if (labelFont) labelFont.font = getComputedStyle($('ed-inspector')).font;
  }
  const width = (label: string) => {
    let w = labelWidths.get(label);
    if (w === undefined) labelWidths.set(label, (w = labelFont ? labelFont.measureText(label).width : label.length));
    return w;
  };
  const longest: [string, string][] = [];
  for (const o of options) {
    const at = longest.findIndex((q) => width(q[0]) < width(o[0]));
    if (at >= 0) longest.splice(at, 0, o);
    else if (longest.length < 3) longest.push(o);
    if (longest.length > 3) longest.pop();
  }
  return longest;
}

/**
 * An inspector list of very many choices (every prop: some 1,900), the one of value `selected` chosen. The list is
 * filled when it is first reached for (a press, the focus, a key), not each time the inspector is built: every prop
 * selected and every edit of one built them all again, and the browser then styled and laid out every one (60 to
 * 110 ms of each selection and each edit on a big map). Until then it holds what a closed list shows: the choice it
 * is on (or else the first) and the longest names, which give it its width. (Code that sets its `value` must reach
 * for it first: `focus()`.)
 */
export function fillWhenOpened(select: HTMLSelectElement, groups: ChoiceGroups, selected: string | undefined): void {
  const optgroup = (label: string, options: [string, string][]) => {
    const g = document.createElement('optgroup');
    g.label = label;
    for (const [name, value] of options) g.append(new Option(name, value, false, value === selected));
    return g;
  };
  let filled = false;
  const fill = () => {
    if (filled) return;
    filled = true;
    select.replaceChildren(...groups.map(([label, options]) => optgroup(label, options)));
  };
  const all = groups.flatMap(([, options]) => options);
  const first = (selected !== undefined ? all.filter(([, value]) => value === selected).at(-1) : undefined) ?? all[0];
  if (!first) return fill();
  const on = optgroup('', [first]);
  (on.firstChild as HTMLOptionElement).selected = true;
  select.append(on, optgroup('', widestChoices(all).filter(([, value]) => value !== first[1])));
  for (const reached of ['pointerdown', 'mousedown', 'touchstart', 'focus', 'keydown']) select.addEventListener(reached, fill, { passive: true });
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
