import { GROUND_FIT_BLEND_RANGE } from '@tiletrigger/shared';
import type { EditorApp } from './editorApp.ts';
import { button, row, small } from './editorDom.ts';

/**
 * The inspector's Ground section for a selection on a map with terrain (groundFit.ts): Fit ground to this (the
 * ground raised or lowered to meet the build and eased into the ground about), Settle onto the ground (the build
 * moved instead), and how far the ground is eased. One undo step each.
 */
export function groundFitSection(app: EditorApp): HTMLElement {
  const box = document.createElement('div');
  box.className = 'ed-ground-fit';
  const fit = button('Fit ground to this', () => app.edits.fitGround());
  fit.id = 'ed-fit-ground';
  fit.title = 'Raise or lower the ground under and round this to meet its base, eased into the ground about (the ground changes; this stays). One undo step';
  const settle = button('Settle onto the ground', () => app.edits.settleOnGround());
  settle.id = 'ed-settle-ground';
  settle.title = 'Move this down or up onto the ground under it (this moves; the ground stays): blocks and props until nothing hangs, tiles and set pieces by whole levels. One undo step';
  const buttons = document.createElement('div');
  buttons.className = 'buttons';
  buttons.append(fit, settle);
  const blend = document.createElement('input');
  blend.type = 'number';
  blend.id = 'ed-fit-blend';
  blend.min = String(GROUND_FIT_BLEND_RANGE.min);
  blend.max = String(GROUND_FIT_BLEND_RANGE.max);
  blend.step = '1';
  blend.value = String(app.groundBlend);
  blend.addEventListener('change', () => {
    const v = Number(blend.value);
    if (Number.isFinite(v)) app.groundBlend = Math.max(GROUND_FIT_BLEND_RANGE.min, Math.min(GROUND_FIT_BLEND_RANGE.max, v));
    blend.value = String(app.groundBlend);
  });
  const blendRow = row('Blend (m)', blend);
  blendRow.title = 'How far from it the ground is eased back into the ground about (0: only under it). Where the ground is far above or below, the bank runs further so it can be walked';
  box.append(small('Ground'), buttons, blendRow);
  return box;
}
