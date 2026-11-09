/**
 * The inspector redrawn without losing what you are typing (MapMaker fixes 2, item 7).
 *
 * The inspector is rebuilt whenever the map changes (EditorApp.refresh, a frame after the edit) and whenever the
 * selection does, and its text and number fields commit on `change` (Enter, Tab or a click away). A placement selects
 * the new thing (one build) and then changes the map (a second build, on the next frame): a value typed into the first
 * build's field before that frame was thrown away with the field, so the first edit after a placement was lost. Any
 * other rebuild while typing (an undo, the bot test's results, a validation pass) lost it the same way.
 *
 * `rebuildKeepingEdit` rebuilds the panel and puts the field being typed in back as it was: the same field (by its
 * place among the panel's fields, and its kind) gets the focus, the typed value and the caret again, provided the
 * rebuilt field still shows the value the typing started from (if the map changed that very value, the new one wins).
 * The edit then commits as usual, against the rebuilt panel's (current) thing.
 */

/** What each field showed when the panel was built. */
const shown = new WeakMap<HTMLElement, string>();

type Field = HTMLInputElement | HTMLTextAreaElement;
const TYPED = new Set(['text', 'number', 'search', '']);
const isTyped = (el: Element | null): el is Field => (el instanceof HTMLInputElement && TYPED.has(el.type)) || el instanceof HTMLTextAreaElement;
const fields = (panel: HTMLElement): Field[] => [...panel.querySelectorAll<Field>('input, textarea')];

export function rebuildKeepingEdit(panel: HTMLElement, build: () => void): void {
  const active = document.activeElement;
  let carry: { index: number; kind: string; value: string; from: string | undefined; start: number | null; end: number | null } | null = null;
  if (isTyped(active) && panel.contains(active)) {
    let start: number | null = null;
    let end: number | null = null;
    try {
      start = active.selectionStart;
      end = active.selectionEnd;
    } catch {
      // Number fields have no caret to read.
    }
    carry = { index: fields(panel).indexOf(active), kind: `${active.tagName}:${active.type}`, value: active.value, from: shown.get(active), start, end };
  }
  build();
  const now = fields(panel);
  for (const f of now) shown.set(f, f.value);
  if (!carry || carry.index < 0) return;
  const f = now[carry.index];
  if (!f || `${f.tagName}:${f.type}` !== carry.kind) return;
  // Only an edit not yet committed is carried: typed (it differs from what the field showed) and the rebuilt field still
  // shows the value the typing started from. A committed edit (Enter: the field now shows it) lets the focus go, as
  // before, so the map's keys (Ctrl+Z, Delete) work on the map again.
  if (carry.from === undefined || carry.value === carry.from || f.value !== carry.from) return;
  f.value = carry.value;
  shown.set(f, carry.from);
  f.focus({ preventScroll: true });
  if (carry.start !== null) {
    try {
      f.setSelectionRange(carry.start, carry.end ?? carry.start);
    } catch {
      // Number fields have no caret to set.
    }
  }
}
