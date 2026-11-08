import {
  allocCompactHeightfield,
  allocContourSet,
  allocHeightfield,
  allocPolyMesh,
  allocPolyMeshDetail,
  buildCompactHeightfield,
  buildContours,
  buildDistanceField,
  buildPolyMesh,
  buildPolyMeshDetail,
  buildRegions,
  calcGridSize,
  createHeightfield,
  createNavMeshData,
  createRcConfig,
  erodeWalkableArea,
  filterLedgeSpans,
  filterLowHangingWalkableObstacles,
  filterWalkableLowHeightSpans,
  freeCompactHeightfield,
  freeContourSet,
  freeHeightfield,
  freePolyMesh,
  freePolyMeshDetail,
  markWalkableTriangles,
  NavMesh,
  NavMeshCreateParams,
  rasterizeTriangles,
  Raw,
  Recast,
  recastConfigDefaults,
  RecastBuildContext,
  TriangleAreasArray,
  TrianglesArray,
  VerticesArray,
  type RecastCompactHeightfield,
  type RecastConfig,
  type RecastContourSet,
  type RecastHeightfield,
  type RecastPolyMesh,
  type RecastPolyMeshDetail,
} from 'recast-navigation';

/**
 * Low headroom (BOT_AI_PLAN.md, "Phase C follow-up, part 2"): the navmesh is built for a standard 1.8 m body, and a
 * large one (1.18: 2.12 m) can't stand up under a roof lower than itself (a dugout's roof edge, a low doorway). The
 * walkable ground with less room than that over it, and a body's radius round it, gets this navmesh area: Recast
 * splits polygons at it, and tall bodies' route searches price it so they go round (NavWorld.findPath `tall`).
 */
export const LOW_AREA = 3;

/** Low headroom's marking (soloNavMesh `low`): the clearance in metres under which ground is low, and how far round it (m). */
export interface LowHeadroom {
  height: number;
  reach: number;
}

export interface SoloIntermediates {
  type: 'solo';
  buildContext: RecastBuildContext;
  heightfield?: RecastHeightfield;
  compactHeightfield?: RecastCompactHeightfield;
  contourSet?: RecastContourSet;
  polyMesh?: RecastPolyMesh;
  polyMeshDetail?: RecastPolyMeshDetail;
}

type OffMesh = { startPosition: { x: number; y: number; z: number }; endPosition: { x: number; y: number; z: number }; radius: number; bidirectional: boolean; area?: number; flags?: number; userId?: number };

function boundingBox(positions: ArrayLike<number>, indices: ArrayLike<number>): { bbMin: [number, number, number]; bbMax: [number, number, number] } {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i]! * 3;
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k]!, positions[v + k]!);
      hi[k] = Math.max(hi[k]!, positions[v + k]!);
    }
  }
  return { bbMin: lo as [number, number, number], bbMax: hi as [number, number, number] };
}

/**
 * Walkable spans with less than `low.height` of room over them, and the walkable spans within `low.reach` of one
 * along the ground (a body standing beside a roof's edge has its shoulders under it), to LOW_AREA. Reads the compact
 * heightfield's cells and spans straight from the WASM heap (millions of spans on a big map: one call each would take
 * seconds), and writes only the spans it marks. Returns how many.
 */
function markLow(chf: RecastCompactHeightfield, low: LowHeadroom): number {
  const raw = chf.raw;
  const w = raw.get_width();
  const h = raw.get_height();
  const n = raw.get_spanCount();
  if (!n) return 0;
  const limit = Math.ceil(low.height / raw.get_ch());
  const cellsPtr = Raw.Module.getPointer(raw.get_cells(0)) >>> 2;
  const spansPtr = Raw.Module.getPointer(raw.get_spans(0)) >>> 2;
  const heap = Raw.Module.HEAPU32;
  // A span's clearance (rcCompactSpan: y and reg, 16 bits each; con 24 and h 8 bits), and its cell.
  const marked = new Uint8Array(n);
  const cellOf = new Int32Array(n);
  const seeds: number[] = [];
  for (let c = 0; c < w * h; c++) {
    const cell = heap[cellsPtr + c]!;
    const first = cell & 0xffffff;
    const count = cell >>> 24;
    for (let i = first; i < first + count; i++) {
      cellOf[i] = c;
      const room = heap[spansPtr + i * 2 + 1]! >>> 24;
      if (room >= limit) continue;
      if (raw.get_areas(i) === Recast.RC_NULL_AREA) continue;
      marked[i] = 1;
      seeds.push(i);
    }
  }
  if (!seeds.length) return 0;
  // Out from them over the walkable spans' connections, `reach` cells (breadth first).
  const steps = Math.round(low.reach / raw.get_cs());
  const dx = [-1, 0, 1, 0];
  const dz = [0, 1, 0, -1];
  let front = seeds;
  for (let s = 0; s < steps && front.length; s++) {
    const next: number[] = [];
    for (const i of front) {
      const con = heap[spansPtr + i * 2 + 1]! & 0xffffff;
      const c = cellOf[i]!;
      const x = c % w;
      const z = (c - x) / w;
      for (let d = 0; d < 4; d++) {
        const k = (con >>> (d * 6)) & 0x3f;
        if (k === 0x3f) continue;
        const nc = x + dx[d]! + (z + dz[d]!) * w;
        const j = (heap[cellsPtr + nc]! & 0xffffff) + k;
        if (marked[j] || raw.get_areas(j) === Recast.RC_NULL_AREA) continue;
        marked[j] = 1;
        next.push(j);
      }
    }
    front = next;
  }
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (!marked[i]) continue;
    raw.set_areas(i, LOW_AREA);
    total++;
  }
  return total;
}

/**
 * generateSoloNavMesh (recast-navigation/generators) as it is, step for step, with one step of our own: after the
 * walkable area's erosion, low headroom to LOW_AREA (`low`; none: the navmesh is the generator's own). Polygons of
 * LOW_AREA get flags 1, as walkable ones do.
 */
export function generateSolo(
  positions: Float32Array,
  indices: Uint32Array,
  config: Partial<RecastConfig> & { offMeshConnections?: OffMesh[] },
  keepIntermediates: boolean,
  low: LowHeadroom | null,
): { success: true; navMesh: NavMesh; intermediates: SoloIntermediates; low: number } | { success: false; error: string; intermediates: SoloIntermediates } {
  const buildContext = new RecastBuildContext();
  const inter: SoloIntermediates = { type: 'solo', buildContext };
  const cleanup = () => {
    if (keepIntermediates) return;
    if (inter.heightfield) freeHeightfield(inter.heightfield);
    if (inter.compactHeightfield) freeCompactHeightfield(inter.compactHeightfield);
    if (inter.contourSet) freeContourSet(inter.contourSet);
    if (inter.polyMesh) freePolyMesh(inter.polyMesh);
    if (inter.polyMeshDetail) freePolyMeshDetail(inter.polyMeshDetail);
    inter.heightfield = inter.compactHeightfield = inter.contourSet = inter.polyMesh = inter.polyMeshDetail = undefined;
  };
  const fail = (error: string) => {
    cleanup();
    return { success: false as const, error, intermediates: inter };
  };
  const verticesArray = new VerticesArray();
  verticesArray.copy(positions as unknown as number[]);
  // (The generator's own count: the indices' length.)
  const numVertices = indices.length;
  const numTriangles = indices.length / 3;
  const trianglesArray = new TrianglesArray();
  trianglesArray.copy(indices as unknown as number[]);
  const { bbMin, bbMax } = boundingBox(positions, indices);
  const rcConfig = createRcConfig({ ...recastConfigDefaults, ...config });
  rcConfig.minRegionArea = rcConfig.minRegionArea * rcConfig.minRegionArea;
  rcConfig.mergeRegionArea = rcConfig.mergeRegionArea * rcConfig.mergeRegionArea;
  rcConfig.detailSampleDist = rcConfig.detailSampleDist < 0.9 ? 0 : rcConfig.cs * rcConfig.detailSampleDist;
  rcConfig.detailSampleMaxError = rcConfig.ch * rcConfig.detailSampleMaxError;
  const gridSize = calcGridSize(bbMin, bbMax, rcConfig.cs);
  rcConfig.width = gridSize.width;
  rcConfig.height = gridSize.height;
  const heightfield = allocHeightfield();
  inter.heightfield = heightfield;
  if (!createHeightfield(buildContext, heightfield, rcConfig.width, rcConfig.height, bbMin, bbMax, rcConfig.cs, rcConfig.ch)) return fail('Could not create heightfield');
  const triangleAreasArray = new TriangleAreasArray();
  triangleAreasArray.resize(numTriangles);
  markWalkableTriangles(buildContext, rcConfig.walkableSlopeAngle, verticesArray, numVertices, trianglesArray, numTriangles, triangleAreasArray);
  if (!rasterizeTriangles(buildContext, verticesArray, numVertices, trianglesArray, triangleAreasArray, numTriangles, heightfield, rcConfig.walkableClimb)) return fail('Could not rasterize triangles');
  triangleAreasArray.destroy();
  verticesArray.destroy();
  trianglesArray.destroy();
  filterLowHangingWalkableObstacles(buildContext, rcConfig.walkableClimb, heightfield);
  filterLedgeSpans(buildContext, rcConfig.walkableHeight, rcConfig.walkableClimb, heightfield);
  filterWalkableLowHeightSpans(buildContext, rcConfig.walkableHeight, heightfield);
  const chf = allocCompactHeightfield();
  inter.compactHeightfield = chf;
  if (!buildCompactHeightfield(buildContext, rcConfig.walkableHeight, rcConfig.walkableClimb, heightfield, chf)) return fail('Failed to build compact data');
  if (!keepIntermediates) {
    freeHeightfield(heightfield);
    inter.heightfield = undefined;
  }
  if (!erodeWalkableArea(buildContext, rcConfig.walkableRadius, chf)) return fail('Failed to erode walkable area');
  const lowSpans = low ? markLow(chf, low) : 0;
  if (!buildDistanceField(buildContext, chf)) return fail('Failed to build distance field');
  if (!buildRegions(buildContext, chf, rcConfig.borderSize, rcConfig.minRegionArea, rcConfig.mergeRegionArea)) return fail('Failed to build regions');
  const contourSet = allocContourSet();
  inter.contourSet = contourSet;
  if (!buildContours(buildContext, chf, rcConfig.maxSimplificationError, rcConfig.maxEdgeLen, contourSet, Recast.RC_CONTOUR_TESS_WALL_EDGES)) return fail('Failed to create contours');
  const polyMesh = allocPolyMesh();
  inter.polyMesh = polyMesh;
  if (!buildPolyMesh(buildContext, contourSet, rcConfig.maxVertsPerPoly, polyMesh)) return fail('Failed to triangulate contours');
  const polyMeshDetail = allocPolyMeshDetail();
  inter.polyMeshDetail = polyMeshDetail;
  if (!buildPolyMeshDetail(buildContext, polyMesh, chf, rcConfig.detailSampleDist, rcConfig.detailSampleMaxError, polyMeshDetail)) return fail('Failed to build detail mesh');
  if (!keepIntermediates) {
    freeCompactHeightfield(chf);
    inter.compactHeightfield = undefined;
    freeContourSet(contourSet);
    inter.contourSet = undefined;
  }
  for (let i = 0; i < polyMesh.npolys(); i++) {
    if (polyMesh.areas(i) === Recast.RC_WALKABLE_AREA) polyMesh.setAreas(i, 0);
    const a = polyMesh.areas(i);
    if (a === 0 || a === LOW_AREA) polyMesh.setFlags(i, 1);
  }
  const params = new NavMeshCreateParams();
  params.setPolyMeshCreateParams(polyMesh);
  params.setPolyMeshDetailCreateParams(polyMeshDetail);
  params.setWalkableHeight(rcConfig.walkableHeight * rcConfig.ch);
  params.setWalkableRadius(rcConfig.walkableRadius * rcConfig.cs);
  params.setWalkableClimb(rcConfig.walkableClimb * rcConfig.ch);
  params.setCellSize(rcConfig.cs);
  params.setCellHeight(rcConfig.ch);
  params.setBuildBvTree(true);
  if (config.offMeshConnections) params.setOffMeshConnections(config.offMeshConnections);
  const created = createNavMeshData(params);
  if (!created.success) return fail('Failed to create Detour navmesh data');
  cleanup();
  const navMesh = new NavMesh();
  if (!navMesh.initSolo(created.navMeshData)) {
    created.navMeshData.destroy();
    return { success: false, error: 'Failed to initialize solo NavMesh', intermediates: inter };
  }
  return { success: true, navMesh, intermediates: inter, low: lowSpans };
}
