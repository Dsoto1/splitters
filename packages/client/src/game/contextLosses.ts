import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

/**
 * The WebGL context's losses this session, for the performance report (Pause → Settings → Copy performance report):
 * when it went, when it came back, and when every character was drawn again. A lost context (the GPU reset, or ran
 * out of memory) takes every texture, buffer and shader with it; Babylon rebuilds them on its return, and the
 * characters' KTX2 maps are transcoded again from their files first (GameView.contextRestored).
 */
interface Loss {
  /** Wall-clock time it went (ms since 1970). */
  at: number;
  /** How long until the context came back (ms), and then until every character was drawn again (ms). */
  back?: number;
  bodies?: number;
  /** Characters still waiting for their maps when the wait stopped (0: all back). */
  missing?: number;
}

const losses: Loss[] = [];
let lostAt = 0;
let restoredAt = 0;

const now = () => performance.now();

export function noteContextLost(): void {
  losses.push({ at: Date.now() });
  lostAt = now();
}

export function noteContextRestored(): void {
  const l = losses[losses.length - 1];
  restoredAt = now();
  if (l) l.back = Math.round(restoredAt - lostAt);
}

/** Every character drawn again since the last restore (`missing` still waiting when the wait gave up). */
export function noteBodiesBack(missing = 0): void {
  const l = losses[losses.length - 1];
  if (l && l.bodies === undefined) {
    l.bodies = Math.round(now() - restoredAt);
    l.missing = missing;
  }
}

export function contextLossCount(): number {
  return losses.length;
}

const clock = (t: number) => new Date(t).toISOString().slice(11, 19);
const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** The report's line: "not lost", or each loss with its time and how long things took to come back. */
export function contextLossLine(): string {
  if (!losses.length) return 'WebGL context not lost';
  const each = losses.map((l) => {
    const parts = [`at ${clock(l.at)} UTC`];
    parts.push(l.back === undefined ? 'not back yet' : `back after ${sec(l.back)}`);
    if (l.back !== undefined) parts.push(l.bodies === undefined ? 'characters still coming back' : l.missing ? `${l.missing} characters still undrawn after ${sec(l.bodies)}` : `characters drawn again after ${sec(l.bodies)}`);
    return parts.join(', ');
  });
  return `WebGL context lost ${losses.length} time${losses.length === 1 ? '' : 's'}: ${each.join('; ')}`;
}

/** Tests: forget the session's losses. */
export function resetContextLosses(): void {
  losses.length = 0;
  lostAt = restoredAt = 0;
}

/**
 * Whether a character's body can be drawn: every map on its shown meshes is in. After a lost context came back its
 * KTX2 maps are transcoded again, and until then Babylon skips the mesh (GameView.contextRestored).
 */
export function bodyDrawable(anim: { ch?: { root: TransformNode } } | object): boolean {
  const root = (anim as { ch?: { root?: TransformNode } }).ch?.root;
  if (!root) return true;
  for (const m of root.getChildMeshes(false)) {
    if (!m.isEnabled() || !m.isVisible || !m.material || m.getTotalVertices() === 0) continue;
    for (const t of m.material.getActiveTextures()) if (!t.isReady()) return false;
  }
  return true;
}
