import { describe, expect, it } from 'vitest';
import { INSIGNIA_IDS, INSIGNIA_SHAPES } from '@tiletrigger/shared';
import { insigniaSvg } from '../src/game/insigniaSvg.ts';
import { INSIGNIA_HALF, insigniaGeometry } from '../src/game/insigniaMesh.ts';

describe('rank badges in the HUD and over heads', () => {
  it('draws each badge as SVG in the text colour, with its name', () => {
    for (const id of INSIGNIA_IDS) {
      const s = insigniaSvg(id);
      expect(s).toMatch(/^<svg class="ins ins-/);
      expect(s).toContain('fill="currentColor"');
      expect(s.match(/<polygon /g)!.length).toBe(INSIGNIA_SHAPES[id].length * 2);
    }
    expect(insigniaSvg('sgt')).toContain('<title>Sergeant</title>');
  });

  it('builds the marker mesh: a dark rim behind, the shape in front, within the marker size', () => {
    for (const id of INSIGNIA_IDS) {
      const g = insigniaGeometry(id);
      expect(g.positions.length % 3).toBe(0);
      expect(g.colors.length).toBe((g.positions.length / 3) * 4);
      expect(Math.max(...g.indices)).toBeLessThan(g.positions.length / 3);
      for (let i = 0; i < g.positions.length; i += 3) {
        expect(Math.abs(g.positions[i]!)).toBeLessThanOrEqual(INSIGNIA_HALF * 1.11);
        expect(Math.abs(g.positions[i + 1]!)).toBeLessThanOrEqual(INSIGNIA_HALF * 1.11);
      }
      // The front (white, multiplied by the marker colour) is the last ninth of the triangles.
      const verts = g.positions.length / 3;
      expect(g.colors[(verts - 1) * 4]).toBe(1);
      expect(g.colors[0]).toBeLessThan(0.1);
    }
  });
});
