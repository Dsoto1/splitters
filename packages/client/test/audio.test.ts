import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CORE_ITEMS, WEAPONS_BY_SLOT } from '@chronosplit/shared';
import { SOUNDS } from '../src/audio/audio.ts';
import { SYNTH_RATE, SYNTH_RECIPES, synthesize, type SynthRecipe } from '../src/audio/synth.ts';

const publicSounds = fileURLToPath(new URL('../public/sounds/', import.meta.url));

describe('synthesiser', () => {
  it.each(SYNTH_RECIPES)('%s renders a clean, deterministic, audible buffer', (recipe) => {
    const a = synthesize(recipe, 0);
    expect(a.length).toBeGreaterThan(0.05 * SYNTH_RATE);
    expect(a.length).toBeLessThanOrEqual(2.5 * SYNTH_RATE);
    let peak = 0;
    let energy = 0;
    for (const s of a) {
      expect(Number.isFinite(s)).toBe(true);
      peak = Math.max(peak, Math.abs(s));
      energy += s * s;
    }
    expect(peak).toBeLessThanOrEqual(0.9001);
    expect(peak).toBeGreaterThan(0.5);
    expect(Math.sqrt(energy / a.length)).toBeGreaterThan(0.01);
    // Ends at silence (no click when the buffer stops).
    expect(Math.abs(a[a.length - 1]!)).toBeLessThan(1e-3);
    // Same variant, same samples; different variants differ (tonal cues have a single variant).
    expect(synthesize(recipe, 0)).toEqual(a);
    if (recipe !== 'beep' && recipe !== 'alarm') expect(synthesize(recipe, 1)).not.toEqual(a);
  });
});

describe('sound manifest', () => {
  it('only names known synth recipes, and every file variant is built', () => {
    for (const [id, def] of Object.entries(SOUNDS)) {
      if (def.synth) {
        expect(SYNTH_RECIPES, id).toContain(def.synth as SynthRecipe);
        expect(def.variants, id).toBeGreaterThan(0);
      } else {
        const files = def.variants as unknown[];
        expect(files.length, id).toBeGreaterThan(0);
        files.forEach((_, i) => expect(existsSync(`${publicSounds}${id}_${i}.ogg`), `${id}_${i}.ogg`).toBe(true));
      }
    }
  });

  it('has a fire sound for every weapon and a pickup sound for every item kind', () => {
    const ids = Object.keys(SOUNDS);
    for (const w of WEAPONS_BY_SLOT) expect(ids, w.id).toContain(`fire.${w.id.replace(/^core\./, '')}`);
    for (const item of CORE_ITEMS) expect(ids, item.id).toContain(`pickup.${item.effect.kind}`);
  });
});
