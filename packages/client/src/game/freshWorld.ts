import type { Matrix } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { perfOn } from './perfSwitches.ts';

/**
 * A node's world matrix brought up to date, as `computeWorldMatrix(true)` does, without working out again what is
 * already up to date (docs/CHARACTERS.md, "Hand fitting: the same fit for less").
 *
 * Babylon's forced compute works out the whole chain above the node again, every time: for a finger joint that is
 * 15 to 20 matrices (the fingers, hand, arm, spine, hips, the glTF root and the body's holders). Fitting the hands
 * reads and turns joints a few hundred times a frame (a palm's side, a knuckle, a joint's turn in the skeleton's
 * space), so your own first-person hands worked out about 3,000 world matrices a frame, most of them unchanged since
 * the read before (measured 2026-11-23).
 *
 * Here only the stale part of the chain is worked out, top down: a node is stale when its own place, turn or scale
 * changed since it was last worked out (Babylon's own dirty flags, `isSynchronized`), or its parent was worked out
 * again since. Every matrix comes out as the forced compute makes it (the same inputs, the same sums), which the
 * `characters` e2e checks (`__freshCheck`). A chain with anything but plain transform nodes in it (a camera, a frozen
 * matrix, a billboard, a mesh in the stale part) takes the forced compute as before. `?perfoff=gripfit` turns it off.
 */
export function freshWorld(n: TransformNode): Matrix {
  if (!gripFitOn()) return n.computeWorldMatrix(true);
  const chain = CHAIN;
  chain.length = 0;
  let p: unknown = n;
  while (p) {
    if (!(p instanceof TransformNode)) return forced(n);
    chain.push(p);
    p = p.parent;
  }
  // Top down: the first stale node, then everything under it, worked out again; a node whose parent was worked out
  // again is stale too (its `_parentUpdateId` would no longer match).
  let redo = false;
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i]!;
    const t = node as unknown as Inside;
    if (!redo) {
      const parent = chain[i + 1] as unknown as Inside | undefined;
      const synced = !t._isDirty && t._isSynchronized() && (!parent || (!parent._isDirty && t._parentUpdateId === parent._childUpdateId));
      if (synced) continue;
      redo = true;
    }
    // (Only plain transform nodes are worked out one at a time: a mesh's own compute does more, a frozen or billboard
    // matrix isn't the plain sum.)
    if (t._isWorldMatrixFrozen || t._transformToBoneReferal || node.billboardMode !== 0 || node.infiniteDistance || node.getClassName() !== 'TransformNode') return forced(n);
    t._isDirty = true;
    node.computeWorldMatrix(false);
  }
  if (check) checkFresh(n);
  return n.getWorldMatrix();
}

let on: boolean | null = null;
/** Whether the hand fitting's savings are on (`?perfoff=gripfit` turns them off): this, and slideSupport's. */
export function gripFitOn(): boolean {
  return (on ??= perfOn('gripfit'));
}
/**
 * Tests and measurements: the savings on or off in this page (null: as `?perfoff=` says). `window.__gripFit(on)` does
 * the same from a page (tools: the same build measured both ways, turn about, in one page).
 */
export function setGripFit(v: boolean | null): void {
  on = v;
}
(globalThis as unknown as { __gripFit: typeof setGripFit }).__gripFit = setGripFit;

/** Babylon's own bookkeeping, read here (the public `isSynchronized` asks the same of every ancestor again, each call). */
type Inside = { _isDirty: boolean; _isSynchronized(): boolean; _parentUpdateId: number; _childUpdateId: number; _isWorldMatrixFrozen: boolean; _transformToBoneReferal: unknown };

const CHAIN: TransformNode[] = [];

function forced(n: TransformNode): Matrix {
  return n.computeWorldMatrix(true);
}

/**
 * The check (`window.__freshCheck = true` before a match or the grip page starts; the `characters` e2e): every matrix
 * freshWorld gives compared with the forced compute's, number for number. Counts in `window.__freshCheck` afterwards.
 */
const check = typeof window !== 'undefined' && !!(window as { __freshCheck?: unknown }).__freshCheck;
const stats = { calls: 0, differing: 0, worst: 0 };
if (check) (window as unknown as { __freshCheck: typeof stats }).__freshCheck = stats;

function checkFresh(n: TransformNode): void {
  const mine = n.getWorldMatrix().asArray().slice();
  const theirs = n.computeWorldMatrix(true).asArray();
  stats.calls++;
  let worst = 0;
  for (let i = 0; i < 16; i++) worst = Math.max(worst, Math.abs(mine[i]! - theirs[i]!));
  if (worst > 0) {
    stats.differing++;
    stats.worst = Math.max(stats.worst, worst);
  }
}
