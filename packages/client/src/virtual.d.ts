/** Built by mapIndexPlugin.ts: the built-in maps' summaries (see mapIndex.ts). */
declare module 'virtual:map-index' {
  const index: unknown[];
  export default index;
}

/** Built by mapIndexPlugin.ts: the built-in maps' release records by key (publishedMaps.ts, loaded on demand). */
declare module 'virtual:map-releases' {
  const records: Record<string, unknown>;
  export default records;
}
