/**
 * Switches for measuring a performance change against the code without it, on the same build (docs/PERF_96.md,
 * "Performance round 2"): `?perfoff=shadowcache,levelmerge,meshsel,animlod2` turns those savings off for the page
 * (round 3 adds `propbatch` and `fogprepass`; round 4 `animlod4`, the animation bands by size on screen and the smoothing
 * between evaluations, back to round 2's by distance, and `animlinger`, loops kept a moment at weight 0 instead of stopped;
 * St. John's step 2 adds `indoorshadow`, props under a roof kept out of the sun's shadow pass: shared map/indoors.ts;
 * `bodyspread`: a going character put away over the next frames, View.retireAvatar; `glcache`: redundant uniform and
 * draw-buffer calls sent anyway, src/glStateCache.ts; the destructible environment's next step adds `breakbatch`,
 * breakable props in the prop batches while intact, propBatches.ts; MapMaker's Test start adds `navhandoff`, the
 * navigation check's navmesh handed to the Test's match, editor/mapChecks.ts `prebuilt`, and `startslices`, the
 * match's loading work spread over frames, game/sliced.ts; Scaling 1 adds `navcache`, a browser host's navmeshes
 * kept between matches in its storage, game/navCache.ts; MapMaker's navigation check adds `padnav`, the jump pads flown
 * on the check's own navmesh instead of building another, editor/mapTestWorkerCore.ts, `navstop`, the check stopped
 * when Test starts, editor/mapChecks.ts `pause`, and `editlight`, an edit's outliner rows, level picker and hover card
 * rebuilt only when what they show changed, editor/editorApp.ts `refresh`; the character leak fix adds `bodyclones`, a
 * body's cloned materials and texture copies freed with it, content/ownedAssets.ts; Flavius Rule's memory round,
 * docs/PERF_FLAVIUS_MEMORY_2026-11-16.md, adds `proxydata`, the shadow proxies' triangles not kept in the page,
 * game/shadowProxy.ts, `bodypoints`, the bodies' per-vertex picking points dropped, content/pointCache.ts,
 * `animcrowd`, all but the nearest characters of a crowd in view animated a rung or two slower, animLod.ts crowdStep,
 * `leveldata`, the merged level's vertex data kept as 32-bit floats, levelMerge.ts, `netgarbage`, snapshots filed
 * without a pair array per player, interpolation.ts, and `aurashare`, the status aura's shapes made once a scene,
 * arsenalVisuals.ts createAura); cheaper small shadow casters, docs/PERF_SHADOW_CASTERS_2026-11-17.md, adds
 * `smallcasters`: trees and rocks cast through static shadow-only batches by cascade, props with levels of detail through
 * the shadow proxies at full detail, small clutter's near shadows with a band (game/shadowCasters.ts); the body pool to
 * about 32 adds `bodypool`, a big match keeping up to 32 spare character bodies instead of 16, bodyPool.ts; `pickupbatch`, the pickups as GPU instances instead of thin instances (pickupBatch.ts); `glowinplace`, a glow change set through the material's property every time (view.ts setGlow); `reconcileframe`, the local player reconciled at every snapshot instead of once a frame (session.ts); `snapbin`, the local match's snapshots from its worker as binary messages read into reused objects instead of structured-cloned objects (localTransport.ts, shared net/snapshotBinary.ts).
 * Fewer draws in big matches (docs/PERF_DRAWS_2026-11-23.md) adds `doorinst`, doors' merged parts drawn as GPU instances of
 * one source per shape and material (scenarioVisuals.ts instanceRigidParts); `lightready`, the clustered lights' readiness
 * checked once a render instead of for every lit draw (clusteredLights.ts); `casterlist`, the shadow list's still casters
 * sorted once and tested again only when the camera moves (atmosphere.ts); `casterbounds`, the cascades' casters' box
 * kept for the still casters (shadowBounds.ts).
 * Players never set it; everything is on by default.
 */
export type PerfSwitch = 'shadowcache' | 'levelmerge' | 'meshsel' | 'animlod2' | 'propbatch' | 'fogprepass' | 'animlod4' | 'animlinger' | 'indoorshadow' | 'bodyspread' | 'glcache' | 'breakbatch' | 'navhandoff' | 'startslices' | 'navcache' | 'padnav' | 'navstop' | 'editlight' | 'bodyclones' | 'proxydata' | 'bodypoints' | 'animcrowd' | 'leveldata' | 'netgarbage' | 'aurashare' | 'smallcasters' | 'bodypool' | 'pickupbatch' | 'glowinplace' | 'reconcileframe' | 'snapbin' | 'doorinst' | 'lightready' | 'casterlist' | 'casterbounds';

let off: Set<string> | null = null;

/** Whether a saving is on (it is unless the page's `?perfoff=` names it). */
export function perfOn(name: PerfSwitch): boolean {
  if (!off) {
    off = new Set();
    try {
      // (Through globalThis: the server's build, which shares some of the game's modules, has no DOM types.)
      const where = (globalThis as { location?: { search: string } }).location;
      const v = where ? new URLSearchParams(where.search).get('perfoff') : null;
      for (const s of (v ?? '').split(',')) if (s) off.add(s.trim());
    } catch {
      // No page (tests): everything on.
    }
  }
  return !off.has(name);
}
