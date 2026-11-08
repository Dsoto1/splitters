import type { EditorNote, MapDocument } from '../map/schema.ts';
import { newId, type EditCommand } from './commands.ts';

/**
 * Note pins (map format v31; docs/MAPMAKER_OVERHAUL_PLAN.md, Phase 3 item 7): notes for the map's makers, pinned at a
 * point on the map ("the sniper line from B is too long", "door here?"). MapMaker shows them (the Note tool, J, and
 * the list under Map properties); play never does. Each edit is one undo step.
 */

/** The longest a note can be. */
export const NOTE_MAX = 500;

const setNotes = (doc: MapDocument, after: EditorNote[]): EditCommand => ({ kind: 'setNotes', before: doc.editorNotes ?? null, after: after.length ? after : null });

/** The note's text as stored: trimmed, at most NOTE_MAX characters (null: nothing written). */
export function noteText(text: string): string | null {
  const t = text.trim().slice(0, NOTE_MAX).trim();
  return t ? t : null;
}

/** The map's note pins, in the order they were added. */
export const listNotes = (doc: Pick<MapDocument, 'editorNotes'>): readonly EditorNote[] => doc.editorNotes ?? [];

/** A note's first line, cut short for lists and pins. */
export function noteTitle(note: Pick<EditorNote, 'text'>, max = 48): string {
  const line = note.text.split('\n')[0]!.trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000 + 0;
const at = (p: readonly number[]): [number, number, number] => [r3(p[0]!), r3(p[1]!), r3(p[2]!)];

/** Pin a new note here. */
export function addNoteCommand(doc: MapDocument, position: readonly [number, number, number], text: string): { command: EditCommand; note: EditorNote } | { error: string } {
  const t = noteText(text);
  if (!t) return { error: 'write something in the note first' };
  if (listNotes(doc).length >= 256) return { error: 'a map holds 256 notes at most: delete some first' };
  const note: EditorNote = { id: newId('note'), position: at(position), text: t };
  return { command: setNotes(doc, [...listNotes(doc), note]), note };
}

function change(doc: MapDocument, id: string, f: (n: EditorNote) => EditorNote): EditCommand | { error: string } {
  if (!listNotes(doc).some((n) => n.id === id)) return { error: 'no such note' };
  return setNotes(doc, listNotes(doc).map((n) => (n.id === id ? f(n) : n)));
}

/** Change a note's text (blank: refused; delete the note instead). */
export function editNoteCommand(doc: MapDocument, id: string, text: string): EditCommand | { error: string } {
  const t = noteText(text);
  if (!t) return { error: 'a note needs some text (Delete removes it)' };
  return change(doc, id, (n) => ({ ...n, text: t }));
}

/** Move a note's pin. */
export function moveNoteCommand(doc: MapDocument, id: string, position: readonly [number, number, number]): EditCommand | { error: string } {
  return change(doc, id, (n) => ({ ...n, position: at(position) }));
}

/** Delete notes. */
export function deleteNotesCommand(doc: MapDocument, ids: readonly string[]): EditCommand | { error: string } {
  const gone = new Set(ids);
  const after = listNotes(doc).filter((n) => !gone.has(n.id));
  if (after.length === listNotes(doc).length) return { error: 'no such note' };
  return setNotes(doc, after);
}
