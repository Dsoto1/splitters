import { addNoteCommand, deleteNotesCommand, editNoteCommand, listNotes, moveNoteCommand, noteTitle, NOTE_MAX, type EditCommand, type EditorNote, type MapDocument, type Vec3 } from '@tiletrigger/shared';

/**
 * Note pins (MapMaker overhaul Phase 3, item 7; the commands: shared editor/notes.ts): notes for the map's makers,
 * pinned on the map. The pins are drawn over the view (a few projections a frame) whatever tool is in hand, and a
 * click on one opens it; with the Note tool (J) a click elsewhere pins a new note there and a pin can be dragged to a
 * new spot. Map properties lists them all (notesSection). They are stored in the map (format v31) and never shown in
 * play: the game doesn't read them.
 */
export interface NoteHost {
  doc(): MapDocument;
  run(label: string, cmd: EditCommand | { error: string }): boolean;
  toast(message: string, error?: boolean): void;
  /** Screen spot (client pixels) of a world point, or null behind the camera. */
  project(p: Vec3): { x: number; y: number } | null;
  /** The world point under a screen spot (the ground or a floor), or null. */
  pointAt(x: number, y: number): Vec3 | null;
  /** Point the camera at a spot. */
  focus(p: Vec3): void;
  /** Whether the Note tool is in hand. */
  tool(): boolean;
  /** Whether a pin at this height is on a level being shown. */
  shown(y: number): boolean;
  /** Where the pins and the editor go (over the view). */
  overlay: HTMLElement;
}

const PIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a6 6 0 0 0-6 6c0 4.5 6 13 6 13s6-8.5 6-13a6 6 0 0 0-6-6z" fill="currentColor"/><circle cx="12" cy="8" r="2.3" fill="#10151f"/></svg>';

export class NoteTool {
  private layer: HTMLElement;
  private pins = new Map<string, HTMLButtonElement>();
  private drawn: readonly EditorNote[] | null = null;
  private editor: HTMLElement | null = null;
  /** A pin being dragged (the Note tool): which, where it was grabbed, and whether it has moved. */
  private drag: { id: string; x: number; y: number; moved: boolean; at: Vec3 | null } | null = null;

  constructor(private readonly host: NoteHost) {
    this.layer = document.createElement('div');
    this.layer.id = 'ed-notes';
    this.layer.className = 'ed-notes';
    host.overlay.append(this.layer);
    window.addEventListener('pointermove', (e) => this.pointerMove(e));
    window.addEventListener('pointerup', (e) => this.pointerUp(e));
  }

  /** Each frame: pins made for new notes, every pin on its spot. */
  frame(): void {
    const notes = listNotes(this.host.doc());
    if (notes !== this.drawn) this.rebuild(notes);
    for (const n of notes) {
      const el = this.pins.get(n.id);
      if (!el) continue;
      const at = this.drag?.id === n.id && this.drag.at ? this.drag.at : { x: n.position[0], y: n.position[1], z: n.position[2] };
      const s = this.host.shown(at.y) ? this.host.project(at) : null;
      el.hidden = !s;
      if (s) el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`;
    }
    this.layer.classList.toggle('tool', this.host.tool());
  }

  private rebuild(notes: readonly EditorNote[]): void {
    this.drawn = notes;
    const keep = new Set(notes.map((n) => n.id));
    for (const [id, el] of this.pins) if (!keep.has(id)) (el.remove(), this.pins.delete(id));
    for (const n of notes) {
      let el = this.pins.get(n.id);
      if (!el) {
        el = document.createElement('button');
        el.type = 'button';
        el.className = 'ed-note-pin';
        el.dataset.note = n.id;
        el.innerHTML = `${PIN_SVG}<span></span>`;
        el.addEventListener('pointerdown', (e) => this.pinDown(e, n.id));
        this.pins.set(n.id, el);
        this.layer.append(el);
      }
      el.querySelector('span')!.textContent = noteTitle(n, 28);
      el.title = `${n.text}\n\nClick to edit${this.host.tool() ? ', drag to move' : ' (Note tool, J: drag to move)'}`;
    }
    // The editor open on a note that went (undo): closed.
    if (this.editor?.dataset.note && !keep.has(this.editor.dataset.note)) this.close();
  }

  private pinDown(e: PointerEvent, id: string): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    this.drag = { id, x: e.clientX, y: e.clientY, moved: false, at: null };
  }

  private pointerMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4 && this.host.tool()) d.moved = true;
    if (d.moved) d.at = this.host.pointAt(e.clientX, e.clientY) ?? d.at;
  }

  private pointerUp(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.button !== 0) return;
    this.drag = null;
    const note = listNotes(this.host.doc()).find((n) => n.id === d.id);
    if (!note) return;
    if (!d.moved) return this.open(note);
    if (d.at && this.host.run('Move note', moveNoteCommand(this.host.doc(), d.id, [d.at.x, d.at.y, d.at.z]))) this.host.toast('Note moved · Ctrl+Z to undo');
  }

  /** A click with the Note tool on the view: a new note here (its editor opens to write it). */
  place(at: Vec3 | null): void {
    if (!at) return this.host.toast('Point at the ground or a floor to pin a note there', true);
    this.openEditor(null, [at.x, at.y, at.z]);
  }

  /** Open a note to read and edit it. */
  open(note: EditorNote): void {
    this.openEditor(note, note.position);
  }

  /** The note editor beside its pin: the text, then Save, Delete (an existing note) and Close. */
  private openEditor(note: EditorNote | null, at: readonly [number, number, number]): void {
    this.close();
    const box = document.createElement('div');
    box.className = 'ed-note-editor';
    box.id = 'ed-note-editor';
    if (note) box.dataset.note = note.id;
    const title = document.createElement('h3');
    title.textContent = note ? 'Note' : 'New note';
    const area = document.createElement('textarea');
    area.id = 'ed-note-text';
    area.maxLength = NOTE_MAX;
    area.rows = 4;
    area.placeholder = 'A note for the map\'s makers (never shown in play)';
    area.value = note?.text ?? '';
    const acts = document.createElement('div');
    acts.className = 'ed-dialog-actions';
    const save = document.createElement('button');
    save.className = 'primary';
    save.id = 'ed-note-save';
    save.textContent = note ? 'Save' : 'Pin note';
    save.addEventListener('click', () => {
      const doc = this.host.doc();
      if (note) {
        if (area.value.trim() === note.text) return this.close();
        if (this.host.run('Edit note', editNoteCommand(doc, note.id, area.value))) this.close();
        return;
      }
      const r = addNoteCommand(doc, at, area.value);
      if ('error' in r) return this.host.toast(r.error, true);
      if (this.host.run('Pin note', r.command)) {
        this.close();
        this.host.toast('Note pinned · it shows in MapMaker only (Map properties lists every note)');
      }
    });
    acts.append(save);
    if (note) {
      const del = document.createElement('button');
      del.id = 'ed-note-delete';
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        if (this.host.run('Delete note', deleteNotesCommand(this.host.doc(), [note.id]))) this.close();
      });
      acts.append(del);
    }
    const close = document.createElement('button');
    close.textContent = note ? 'Close' : 'Cancel';
    close.addEventListener('click', () => this.close());
    acts.append(close);
    area.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') this.close();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save.click();
    });
    box.append(title, area, acts);
    this.host.overlay.append(box);
    const s = this.host.project({ x: at[0], y: at[1], z: at[2] });
    const r = box.getBoundingClientRect();
    const left = Math.max(8, Math.min((s?.x ?? innerWidth / 2) + 18, innerWidth - r.width - 8));
    const top = Math.max(8, Math.min((s?.y ?? innerHeight / 2) - 20, innerHeight - r.height - 8));
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    this.editor = box;
    area.focus();
  }

  close(): void {
    this.editor?.remove();
    this.editor = null;
  }

  /** Map properties → Notes: every note (its first line), Go to and Delete. */
  section(): HTMLElement {
    const notes = listNotes(this.host.doc());
    const wrap = document.createElement('section');
    wrap.className = 'ed-notes-list';
    wrap.id = 'ed-notes-list';
    const head = document.createElement('h3');
    head.textContent = `Notes (${notes.length})`;
    wrap.append(head);
    if (!notes.length) {
      const p = document.createElement('p');
      p.className = 'ed-note';
      p.textContent = 'No notes yet. Note pins (J): click the map to pin a note for its makers; they never show in play.';
      wrap.append(p);
      return wrap;
    }
    const ul = document.createElement('ul');
    for (const n of notes) {
      const li = document.createElement('li');
      li.dataset.note = n.id;
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'ed-notes-go';
      go.textContent = noteTitle(n);
      go.title = `${n.text}\n\nShow it and open it`;
      go.addEventListener('click', () => {
        this.host.focus({ x: n.position[0], y: n.position[1], z: n.position[2] });
        // Opened once the camera is on it, so the editor sits by the pin.
        requestAnimationFrame(() => this.open(n));
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'ed-notes-del';
      del.textContent = '×';
      del.title = 'Delete this note';
      del.addEventListener('click', () => this.host.run('Delete note', deleteNotesCommand(this.host.doc(), [n.id])));
      li.append(go, del);
      ul.append(li);
    }
    wrap.append(ul);
    return wrap;
  }
}
