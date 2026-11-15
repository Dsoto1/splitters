import { coreCatalog } from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';
import { $ } from './editorDom.ts';
import { dressable, TOOL_ICONS } from './editorParts.ts';
import { menuHeading, menuItem, popupMenu, type PopupMenu } from './popupMenu.ts';
import { BAR_TOOLS, lightsFor, overflowGroups, type BarTool } from './toolBarTools.ts';

/** The bar's icons beyond the fixed bar's (TOOL_ICONS): 24×24, drawn in the button's text colour. */
const BAR_ICONS: Record<string, string> = {
  ...TOOL_ICONS,
  envbrush: '<path d="M12 21v-6M12 15c-4 0-6-3-6-6 3 0 6 2 6 6zM12 13c0-4 2-7 6-7 0 3-2 7-6 7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M5 21h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  path: '<path d="M7 21c0-6 10-6 10-12 0-3-2-6-5-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="7" cy="21" r="1.6" fill="currentColor"/><circle cx="12" cy="3" r="1.6" fill="currentColor"/>',
  bothint: '<path d="M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.2" fill="currentColor"/>',
  note: '<path d="M5 3h14v12l-6 6H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13 21v-6h6M8 8h8M8 12h5" stroke="currentColor" stroke-width="1.8"/>',
  mirror: '<path d="M12 3v18" stroke="currentColor" stroke-width="1.8" stroke-dasharray="2 2"/><path d="M9 6L3 18h6zM15 6l6 12h-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  duplicate: '<rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10" fill="none" stroke="currentColor" stroke-width="2"/>',
  group: '<rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2"/><rect x="7" y="7" width="5" height="5" fill="currentColor"/><rect x="13" y="12" width="5" height="5" fill="currentColor"/>',
  plan: '<path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16M15 5v16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  maptest: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="19" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  keys: '<rect x="2.5" y="6" width="19" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 10h1M9.5 10h1M13 10h1M16.5 10h1M7 14h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  help: '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.2 9.3a2.9 2.9 0 1 1 4.1 2.6c-.8.4-1.3 1-1.3 1.9v.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.2" fill="currentColor"/>',
  more: '<circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/>',
};

/**
 * The contextual tool bar over the view (MapMaker UI spec Phase 1): each workspace tab shows its own tools
 * (toolBarTools.ts), and its ⋯ menu lists every tool and action, so a tool another tab keeps on its bar is one click
 * away here too. Every key still works in every tab, as before. The tool in hand stays on the bar, lit, even in a tab
 * whose bar leaves it off. Built once: changing tab shows and hides buttons, nothing is made again.
 */
export class ToolBar {
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private more!: PopupMenu;
  private shownWs = '';
  private lit = '';

  constructor(readonly app: EditorApp) {}

  build(): void {
    const bar = $('ed-toolbar');
    let group = '';
    for (const t of BAR_TOOLS) {
      if (!t.tabs.length) continue;
      if (group && t.group !== group && t.group !== 'Help') {
        const sep = document.createElement('span');
        sep.className = 'tb-sep';
        sep.dataset.before = t.group;
        bar.append(sep);
      }
      group = t.group;
      bar.append(this.button(t));
    }
    // ⋯ More: every tool and action, in every tab.
    const more = document.createElement('button');
    more.id = 'ed-tb-more';
    more.className = 'tb-btn';
    more.type = 'button';
    more.title = 'Every tool and action, whichever tab is open';
    more.setAttribute('aria-label', 'More tools');
    more.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${BAR_ICONS.more}</svg><span class="tb-label">More</span>`;
    bar.append(more);
    const menu = document.createElement('div');
    menu.id = 'ed-tb-menu';
    for (const { group: g, tools } of overflowGroups()) {
      menu.append(menuHeading(g));
      for (const t of tools) {
        const item = menuItem(`${t.id}-item`, t.label, { key: t.key, title: t.title, onClick: () => t.run(this.app) });
        item.dataset.toolItem = t.id;
        menu.append(item);
      }
    }
    $('editor').append(menu);
    this.more = popupMenu(more, menu, { label: 'Every tool', onOpen: () => this.syncMenu() });
    this.syncTab();
  }

  private button(t: BarTool): HTMLButtonElement {
    const b = document.createElement('button');
    b.id = t.id;
    b.type = 'button';
    b.className = 'tb-btn';
    b.dataset.tabs = t.tabs.join(' ');
    b.title = t.key ? `${t.title} (${t.key})` : t.title;
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${BAR_ICONS[t.icon] ?? ''}</svg><span class="tb-label">${t.label}</span>${t.id === 'ed-tb-place' ? '<small id="ed-tb-place-what"></small>' : ''}${t.key ? `<kbd>${t.key}</kbd>` : ''}`;
    if (t.id === 'ed-maptest' || t.id === 'ed-tb-plan') b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      t.run(this.app);
      b.blur();
    });
    this.buttons.set(t.id, b);
    return b;
  }

  /** Show the open tab's tools (and the tool in hand). Runs when the tab changes; nothing is rebuilt. */
  syncTab(): void {
    const ws = this.app.paletteWs;
    const lit = this.litId();
    if (ws === this.shownWs && lit === this.lit) return;
    this.shownWs = ws;
    this.lit = lit;
    const bar = $('ed-toolbar');
    bar.dataset.ws = ws;
    let prevShown = false;
    let pendingSep: HTMLElement | null = null;
    for (const el of bar.children) {
      const e = el as HTMLElement;
      if (e.classList.contains('tb-sep')) {
        e.hidden = true;
        if (prevShown) pendingSep = e;
        continue;
      }
      if (!e.dataset.tabs) continue;
      const shown = e.dataset.tabs.split(' ').includes(ws) || e.id === lit;
      e.hidden = !shown;
      e.classList.toggle('tb-extra', shown && !e.dataset.tabs.split(' ').includes(ws));
      if (shown && pendingSep) {
        pendingSep.hidden = false;
        pendingSep = null;
      }
      if (shown) prevShown = true;
    }
  }

  /** The bar button lit by the tool in hand, if any. */
  private litId(): string {
    return BAR_TOOLS.find((t) => t.tabs.length && lightsFor(t, this.app.tool, this.app))?.id ?? '';
  }

  /** The tool in hand lit (setTool), on the bar and in the menu. */
  syncTool(): void {
    for (const t of BAR_TOOLS) {
      const on = lightsFor(t, this.app.tool, this.app);
      this.buttons.get(t.id)?.classList.toggle('active', on);
    }
    this.syncTab();
  }

  /** Selection actions are only live with something selected. */
  syncSelection(): void {
    const any = this.app.selCount() > 0;
    for (const t of BAR_TOOLS) if (t.needsSelection) {
      const b = this.buttons.get(t.id);
      if (b) b.disabled = !any;
    }
  }

  /** On opening the ⋯ menu: what is live now, and the tool in hand. */
  private syncMenu(): void {
    const any = this.app.selCount() > 0;
    const doc = this.app.doc;
    for (const t of BAR_TOOLS) {
      const item = document.getElementById(`${t.id}-item`) as HTMLButtonElement | null;
      if (!item) continue;
      let off = !!t.needsSelection && !any;
      if (t.id === 'ed-tb-dress-all') off = !doc.classicStructure.tiles.some((x) => dressable(coreCatalog.get(x.tile)));
      if (t.id === 'ed-tb-settle-all') off = !doc.terrain || !doc.entities.some((e) => e.kind === 'prop');
      item.disabled = off;
      item.classList.toggle('active', lightsFor(t, this.app.tool, this.app));
    }
  }

  close(): void {
    this.more?.close();
  }
}
