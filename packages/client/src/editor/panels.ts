/**
 * Collapsible panels (MapMaker overhaul Phase 2 item 2): the side panel's Outliner, Inspector and Validation each fold
 * shut from their heading, and stay as each person left them (this browser's storage; nothing in the map). The
 * palette's groups fold the same way (palette.ts) and the whole palette and side panel fold away from their edge tabs.
 */

export const PANELS_KEY = 'tiletrigger.editor.panels';

/** The panels folded shut, read back safely (anything else: all open). */
export function parsePanelFolds(raw: string | null): Set<string> {
  try {
    const v = JSON.parse(raw ?? '[]') as unknown;
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** The folds with `id` shut or open, as stored (sorted, so the same state always reads the same). */
export function withPanelFold(folds: ReadonlySet<string>, id: string, shut: boolean): string[] {
  const next = new Set(folds);
  if (shut) next.add(id);
  else next.delete(id);
  return [...next].sort();
}

function read(): Set<string> {
  try {
    return parsePanelFolds(localStorage.getItem(PANELS_KEY));
  } catch {
    return new Set();
  }
}

/**
 * Make every `.ed-panel[data-panel]` under `root` fold from its heading button. `changed` hears a panel open or shut
 * (the outliner draws only while it's open).
 */
export function mountPanels(root: HTMLElement, changed: (id: string, open: boolean) => void = () => {}): { isOpen(id: string): boolean } {
  let folds = read();
  const apply = (panel: HTMLElement) => {
    const id = panel.dataset.panel!;
    const shut = folds.has(id);
    panel.classList.toggle('folded', shut);
    const btn = panel.querySelector<HTMLButtonElement>(':scope > .ed-panel-head > button');
    btn?.setAttribute('aria-expanded', String(!shut));
    const body = panel.querySelector<HTMLElement>(':scope > .ed-panel-body');
    if (body) body.hidden = shut;
  };
  for (const panel of root.querySelectorAll<HTMLElement>('.ed-panel[data-panel]')) {
    apply(panel);
    panel.querySelector<HTMLButtonElement>(':scope > .ed-panel-head > button')?.addEventListener('click', () => {
      const id = panel.dataset.panel!;
      const shut = !folds.has(id);
      folds = new Set(withPanelFold(folds, id, shut));
      try {
        localStorage.setItem(PANELS_KEY, JSON.stringify([...folds]));
      } catch {
        // This page only.
      }
      apply(panel);
      changed(id, !shut);
    });
  }
  return { isOpen: (id) => !folds.has(id) };
}
