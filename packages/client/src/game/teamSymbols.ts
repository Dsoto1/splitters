/**
 * Team symbols (Colour vision, docs/LOOK.md; owner, 2026-11-19): each team has a shape beside its colour, always shown,
 * whatever the Colour vision setting: in the kill feed, on the scoreboard and score bar, by the name of whoever you hit,
 * on the kill cam, the minimap and the objective lines. Team order: ▲ ● ■ ✚ ⬢ ✖ ○ ▼ (no ◆ or ★: the scoreboard's squad
 * and team leaders wear those). One geometry, drawn as inline SVG in the HUD and as a canvas path on the minimap.
 */

export const TEAM_SYMBOLS = ['▲', '●', '■', '✚', '⬢', '✖', '○', '▼'] as const;
export const TEAM_SYMBOL_NAMES = ['triangle', 'circle', 'square', 'cross', 'hexagon', 'x', 'ring', 'down'] as const;

type Shape = { poly: readonly (readonly [number, number])[] } | { circle: number; ring?: boolean };

const hex = Array.from({ length: 6 }, (_, i) => [Math.cos((Math.PI / 3) * i), Math.sin((Math.PI / 3) * i)] as const);
const PLUS: readonly (readonly [number, number])[] = [[-0.3, -0.95], [0.3, -0.95], [0.3, -0.3], [0.95, -0.3], [0.95, 0.3], [0.3, 0.3], [0.3, 0.95], [-0.3, 0.95], [-0.3, 0.3], [-0.95, 0.3], [-0.95, -0.3], [-0.3, -0.3]];
const turn = (p: readonly (readonly [number, number])[], a: number) => p.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)] as const);

/** Each symbol in a box from -1 to 1 (y down). */
const SHAPES: readonly Shape[] = [
  { poly: [[0, -0.95], [0.95, 0.7], [-0.95, 0.7]] },
  { circle: 0.85 },
  { poly: [[-0.78, -0.78], [0.78, -0.78], [0.78, 0.78], [-0.78, 0.78]] },
  { poly: PLUS },
  { poly: hex.map(([x, y]) => [x * 0.95, y * 0.95] as const) },
  { poly: turn(PLUS, Math.PI / 4) },
  { circle: 0.75, ring: true },
  { poly: [[0, 0.95], [0.95, -0.7], [-0.95, -0.7]] },
];

const at = (team: number): number => ((team % SHAPES.length) + SHAPES.length) % SHAPES.length;
const shapeOf = (team: number): Shape => SHAPES[at(team)]!;

/** Team `team`'s symbol as a character (titles, tests, plain text). */
export const teamSymbol = (team: number): string => TEAM_SYMBOLS[at(team)]!;

const f = (n: number) => String(Math.round(n * 100) / 100);

/** Team `team`'s symbol as inline SVG (about the text's cap height, in `color`, else the text's colour); '' for no team (< 0). */
export function teamSymbolSvg(team: number, color = 'currentColor'): string {
  if (team < 0) return '';
  const s = shapeOf(team);
  const body = 'poly' in s
    ? `<polygon points="${s.poly.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" fill="${color}"/>`
    : s.ring
      ? `<circle r="${s.circle}" fill="none" stroke="${color}" stroke-width="0.4"/>`
      : `<circle r="${s.circle}" fill="${color}"/>`;
  return `<svg class="tsym" viewBox="-1 -1 2 2" data-sym="${teamSymbol(team)}" role="img" aria-label="${TEAM_SYMBOL_NAMES[at(team)]}">${body}</svg>`;
}

/** Draw team `team`'s symbol on a canvas at (x, y), `r` from the centre to its corners, filled (a ring stroked) in the current fill. */
export function drawTeamSymbol(g: CanvasRenderingContext2D, team: number, x: number, y: number, r: number): void {
  const s = shapeOf(team);
  g.beginPath();
  if ('poly' in s) {
    s.poly.forEach(([px, py], i) => (i ? g.lineTo(x + px * r, y + py * r) : g.moveTo(x + px * r, y + py * r)));
    g.closePath();
    g.fill();
  } else if (s.ring) {
    g.arc(x, y, s.circle * r, 0, Math.PI * 2);
    const w = g.lineWidth;
    const st = g.strokeStyle;
    g.lineWidth = 0.4 * r;
    g.strokeStyle = g.fillStyle;
    g.stroke();
    g.lineWidth = w;
    g.strokeStyle = st;
  } else {
    g.arc(x, y, s.circle * r, 0, Math.PI * 2);
    g.fill();
  }
}
