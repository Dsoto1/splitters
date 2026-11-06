/** The maps' navigation pictures (docs/BOTS.md, "Navigation audit"): drawn by the audit (not yet). */
export async function drawNavPictures(dir: string, mapsDir: string, rows: readonly { map: string; fails?: readonly (readonly number[])[] }[]): Promise<void> {
  void mapsDir;
  console.log(`nav pictures: not drawn yet (${rows.length} matches, ${dir})`);
}
