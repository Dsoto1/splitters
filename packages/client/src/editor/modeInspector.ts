import { entityLevelOf, levelName } from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';
import { button, h2, small } from './editorDom.ts';
import { pathLabel } from './pathTool.ts';

/**
 * Each mode's own part of the side panel (MapMaker overhaul Phase 2 item 1; the modes: editorModes.ts). With nothing
 * selected the inspector opens on the mode's own section (what the mode works on in this map, and its actions), then
 * Map properties as before; the Test mode's palette pane is here too. Picking something shows its inspector, as in
 * every mode.
 */

/** The Test mode's palette pane: play, play from here, the bot test and the plan view, with what each does. */
export function fillTestPane(app: EditorApp, el: HTMLElement): void {
  el.replaceChildren();
  const head = document.createElement('h3');
  head.textContent = 'Play';
  const play = button('▶ Play test (F5)', () => app.test());
  play.id = 'ed-tp-play';
  play.className = 'primary';
  const here = button('▶ Play from here (Shift+F5)', () => app.playFromHere());
  here.id = 'ed-tp-here';
  const check = document.createElement('h3');
  check.textContent = 'Check';
  const bots = button('Bot test', () => document.getElementById('ed-maptest')?.click());
  bots.id = 'ed-tp-bots';
  bots.title = 'A bot match in the background: heatmaps of where bots went, got stuck and died, and how exposed each spawn is';
  const plan = button('Plan view (K)', () => app.plan.toggle());
  plan.id = 'ed-tp-plan';
  const problems = button('Problems list', () => document.getElementById('ed-issues')?.scrollIntoView({ behavior: 'smooth' }));
  problems.id = 'ed-tp-problems';
  const col = (...els: HTMLElement[]) => {
    const d = document.createElement('div');
    d.className = 'ed-tp-col';
    d.append(...els);
    return d;
  };
  el.append(
    head,
    col(play, here),
    small('Bots and their skill: the top bar, by PLAY TEST. Esc in the match comes back here, with your view and undo as they were.'),
    check,
    col(bots, plan, problems),
  );
}

/** The mode's own section for the inspector with nothing selected, or null (Build, Props, Logic, Environment: Map properties alone). */
export function modeSection(app: EditorApp): HTMLElement | null {
  const ws = app.paletteWs;
  const doc = app.doc;
  const box = document.createElement('div');
  box.className = 'ed-mode-section';
  box.id = 'ed-mode-section';
  box.dataset.ws = ws;
  if (ws === 'paths') {
    box.append(h2('Paths in this map'));
    const paths = doc.paths ?? [];
    if (!paths.length) box.append(small('None yet. Pick Paths, Route or Track in the palette, then click points on the map.'));
    const list = document.createElement('ul');
    list.className = 'ed-mode-list';
    paths.forEach((p, i) => {
      const li = document.createElement('li');
      li.textContent = pathLabel(p, i);
      list.append(li);
    });
    box.append(list, small('Click a path on the map with the Paths tool to edit it: its points, uses, width and look are in the palette pane.'));
    return box;
  }
  if (ws === 'test') {
    box.append(h2('Test'));
    const issues = app.allIssues();
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    const line = document.createElement('p');
    line.className = `ed-mode-status ${errors.length ? 'err' : warnings.length ? 'warn' : 'ok'}`;
    line.textContent = errors.length ? `${errors.length} error${errors.length === 1 ? '' : 's'} to fix before it plays` : warnings.length ? `Plays, with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : 'Ready to play';
    box.append(line);
    const first = errors[0] ?? warnings[0];
    if (first) box.append(small(first.message));
    const spawns = doc.entities.filter((e) => e.kind === 'spawn');
    const levels = new Set(spawns.map((e) => entityLevelOf(e, doc.classicStructure.levelHeight)));
    box.append(small(`${spawns.length} spawn point${spawns.length === 1 ? '' : 's'}${levels.size > 1 ? ` on ${[...levels].sort((a, b) => a - b).map(levelName).join(', ')}` : ''} · ${doc.entities.filter((e) => e.kind === 'pickup').length} pickups`));
    return box;
  }
  if (ws === 'entities') {
    box.append(h2('Gameplay in this map'));
    const count = (kinds: readonly string[]) => doc.entities.filter((e) => kinds.includes(e.kind)).length;
    const parts = [
      [count(['spawn']), 'spawn points'],
      [count(['flag', 'hill', 'bombsite', 'hostage', 'rescue', 'sector', 'objective']), 'objectives'],
      [count(['pickup']), 'pickups'],
      [count(['encounter']), 'NPC squads'],
      [count(['mount']), 'vehicles'],
    ] as const;
    box.append(small(parts.map(([n, what]) => `${n} ${what}`).join(' · ')));
    return box;
  }
  return null;
}
