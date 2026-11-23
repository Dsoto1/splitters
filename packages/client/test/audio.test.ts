import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CORE_ITEMS, WEAPONS_BY_SLOT } from '@tiletrigger/shared';
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
    for (const w of WEAPONS_BY_SLOT) expect(ids, w.id).toContain(w.view.sound ?? `fire.${w.id.replace(/^core\./, '')}`);
    // A second trigger with its own report (the Battle Axe's blunderbuss).
    for (const w of WEAPONS_BY_SLOT) if (w.view.altShot) expect(ids, `${w.id} alt`).toContain(w.view.altShot.sound);
    for (const item of CORE_ITEMS) expect(ids, item.id).toContain(`pickup.${item.effect.kind}`);
  });

  it('picker-only sounds are lazy, and nothing in the code plays one by name', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const lazy = Object.entries(SOUNDS).filter(([, d]) => d.lazy).map(([id]) => id);
    expect(lazy.length).toBeGreaterThan(50);
    // The weapons' defaults and the game's own sounds are never lazy (a weapon's pick of an alternate is wanted by SessionAudio).
    for (const w of WEAPONS_BY_SLOT) expect(SOUNDS[w.view.sound ?? `fire.${w.id.replace(/^core\./, '')}`]?.lazy, w.id).not.toBe(true);
    const src = fileURLToPath(new URL('../src/', import.meta.url));
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.ts$/.test(f) && files.push(join(d, f))));
    walk(src);
    const code = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const id of lazy) expect(code.includes(`'${id}'`), `${id} is played by name in the code but lazy`).toBe(false);
  });
});

describe('lazy loading', () => {
  it('want() adds weapons\' picks to what loads; total counts only what this page loads', async () => {
    const { AudioSystem } = await import('../src/audio/audio.ts');
    const { weaponSoundIds } = await import('../src/game/sessionAudio.ts');
    const a = new AudioSystem();
    const eager = Object.values(SOUNDS).filter((d) => !d.lazy).length;
    expect(a.total).toBe(eager);
    a.want(['fire.rifle.famas', 'fire.rifle', 'no.such.sound']);
    expect(a.total).toBe(eager + 1);
    expect(weaponSoundIds().has('fire.rifle')).toBe(true);
    expect(weaponSoundIds().has('reload.start')).toBe(false);
  });
});

