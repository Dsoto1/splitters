import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS, MODEL_FALLBACKS, THROWABLE_DEFS, THROWABLES, heldModel, throwableModel } from '../src/index.ts';

/**
 * Every weapon and throwable has a model (the weapons intake of 2026-11-06 put models on the grenades and gave the
 * guns sharper copies for your own hands): the files are there, held copies are the same mesh as everyone's copy,
 * and the throwables still drawn in code are the ones listed here (no model fits them yet: docs/ARSENAL.md).
 */
const PUBLIC = join(__dirname, '../../client/public/models');
const exists = (path: string) => path.startsWith('procedural/') || existsSync(join(PUBLIC, path));
const lock = JSON.parse(readFileSync(join(__dirname, '../../../content/guns.lock.json'), 'utf8')) as { files: { file: string; triangles: number; tier?: string; heldOf?: string; bytes: number }[] };
const locked = new Map(lock.files.map((f) => [f.file, f]));
/** Throwables drawn in code (arsenalVisuals.ts): no model for them in the intake. */
const DRAWN_IN_CODE = new Set(['sheep', 'airstrike']);

describe('weapon models', () => {
  it('every weapon has its model, its fallback and its held copies on disk', () => {
    const missing: string[] = [];
    for (const w of Object.values(CORE_WEAPONS)) {
      for (const m of [w.view.model, w.view.fallback, w.view.held?.medium, w.view.held?.high]) if (m && !exists(m)) missing.push(`${w.id}: ${m}`);
    }
    expect(missing).toEqual([]);
  });

  it("a held copy is the same mesh as everyone's copy, with bigger maps, and falls back to it", () => {
    const held = Object.values(CORE_WEAPONS).filter((w) => w.view.held);
    expect(held.length).toBeGreaterThanOrEqual(12);
    for (const w of held) {
      const world = locked.get(`models/${w.view.model}`)!;
      const medium = locked.get(`models/${w.view.held!.medium}`)!;
      const high = locked.get(`models/${w.view.held!.high}`)!;
      expect(world, w.id).toBeDefined();
      expect([medium.tier, high.tier], w.id).toEqual(['medium', 'high']);
      expect([medium.heldOf, high.heldOf], w.id).toEqual([`models/${w.view.model}`, `models/${w.view.model}`]);
      expect([medium.triangles, high.triangles], w.id).toEqual([world.triangles, world.triangles]);
      expect(high.bytes, w.id).toBeGreaterThan(medium.bytes);
      expect(MODEL_FALLBACKS[w.view.held!.high], w.id).toBe(w.view.model);
      expect(heldModel(w, 'low'), w.id).toBeNull();
      expect(heldModel(w, 'high'), w.id).toBe(w.view.held!.high);
    }
  });

  it('every throwable has a model, or is one of the few still drawn in code', () => {
    const bare = THROWABLES.filter((k) => !THROWABLE_DEFS[k].view && !DRAWN_IN_CODE.has(k));
    expect(bare).toEqual([]);
    const missing: string[] = [];
    for (const k of THROWABLES) {
      const v = THROWABLE_DEFS[k].view;
      for (const m of [v?.model, v?.fallback, ...Object.values(v?.looks ?? {})]) if (m && !exists(m)) missing.push(`${k}: ${m}`);
    }
    expect(missing).toEqual([]);
    // The same model in the hand, in flight and on a pickup; the weapon sets' looks where a set has one.
    expect(throwableModel('frag')).toBe('guns/globe_grenade.glb');
    expect(throwableModel('frag', 'military')).toBe('guns/frag_m67.glb');
    expect(throwableModel('smoke', 'scifi')).toBe('guns/smoke_scifi.glb');
    expect(throwableModel('smoke', 'medieval')).toBe('guns/smoke_m18.glb');
    expect(throwableModel('holy')).toBe('guns/holy_bomb.glb');
    expect(throwableModel('dynamite')).toBe('guns/dynamite.glb');
  });
});
