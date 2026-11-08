import { groupName, renameGroupCommand, selectedGroups, selectionGroup, type EditCommand, type MapDocument, type Selection } from '@tiletrigger/shared';

/**
 * The inspector's group row (MapMaker overhaul Phase 3, item 3; the commands: shared editor/groups.ts): a selection
 * that is one group shows its name (to rename) and Ungroup; any other selection of two things or more offers Group.
 */
export interface GroupHost {
  doc(): MapDocument;
  selection(): Selection;
  run(label: string, cmd: EditCommand | { error: string }): boolean;
  group(): void;
  ungroup(): void;
}

export function groupSection(host: GroupHost): HTMLElement {
  const doc = host.doc();
  const sel = host.selection();
  const wrap = document.createElement('div');
  wrap.className = 'ed-group-row';
  wrap.id = 'ed-group-row';
  const one = selectionGroup(doc, sel);
  const btn = (id: string, label: string, title: string, run: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = id;
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', run);
    return b;
  };
  if (one) {
    const name = document.createElement('input');
    name.type = 'text';
    name.id = 'ed-group-name';
    name.maxLength = 40;
    name.value = one.name ?? '';
    name.placeholder = groupName({});
    name.title = "The group's name (MapMaker only)";
    name.addEventListener('change', () => {
      if (name.value.trim() !== (one.name ?? '')) host.run('Rename group', renameGroupCommand(host.doc(), one.id, name.value));
    });
    const label = document.createElement('span');
    label.textContent = 'Group';
    wrap.append(label, name, btn('ed-ungroup', 'Ungroup', 'Ungroup (Ctrl+Shift+G): the things stay, no longer kept together', () => host.ungroup()));
    const note = document.createElement('small');
    note.textContent = `${one.members.length} things kept together: a click on any picks them all (Alt-click: just that one). Move, turn, mirror (M), duplicate and copy it as one.`;
    wrap.append(note);
    return wrap;
  }
  const whole = selectedGroups(doc, sel);
  wrap.append(btn('ed-group', 'Group', 'Group (Ctrl+G): keep these together, picked, moved, turned and mirrored as one', () => host.group()));
  if (whole.length) wrap.append(btn('ed-ungroup', `Ungroup ${whole.length === 1 ? `“${groupName(whole[0]!)}”` : `${whole.length} groups`}`, 'Ungroup (Ctrl+Shift+G)', () => host.ungroup()));
  return wrap;
}
