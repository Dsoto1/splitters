// Furniture and everyday props, and the real-world sizes they are held to (docs/CONTENT_PIPELINE.md, "Real-world
// sizes"): which props count, what kind of piece each is, and the size that matters for that kind (a chair's seat, a
// table's top, a counter's top, a bed's mattress, a fridge's or a bookcase's height, a door's opening), with the
// reference it should have beside a 1.8 m body. tools/content/prop-lineup.mjs lines them up; prop-sizes.mjs measures
// them.

/** What counts as furniture or an everyday piece (matched on the prop's id and name). */
export const FURNITURE = /chair|stool|sofa|couch|armchair|bench|pew\b|table|desk|counter|checkout|\bbed\b|_bed|bed_|bunk|shel(f|ves|ving)|bookcase|cabinet|dresser|wardrobe|cupboard|drawers|nightstand|bedside|locker|door|toilet|sink|basin|fridge|freezer|lamp|chandelier|ceiling_light|oven|stove|cooker|microwave|kettle|dishwasher|washing|washer|computer|terminal|printer|bath|shower|seat|\btv\b|_tv|piano|vending|coat_rack|throne/;
/** ...and what only looks like one (street lamps, vehicles, racks of goods, set dressing of other kinds). */
export const NOT_FURNITURE = /lamppost|lamp_post|streetlight|traffic_light|floodlight|yard_lamp|lightpost|flatbed|rail_track|monorail|tent|airliner|ac_section|statue|pharaoh|wall_astra|sf_light|sf_clamp|mt_light|gas_lamp|zipline|drawbridge|workbench|weapon_rack|net_rack|ski_rack|rug_rack|tyre_rack|canister_rack|pipe_rack/;

/** A prop entry (content/props/<pack>.json) is furniture or an everyday piece. */
export const isFurniture = (p) => FURNITURE.test(`${p.id} ${(p.name ?? '').toLowerCase()}`) && !NOT_FURNITURE.test(p.id);

/**
 * The reference sizes (metres): `measure` is what is held to it, `seat` (the largest upward-facing area in the seat's
 * band), `top` (the largest upward-facing area near the top), `height` (the whole model) or `opening` (a doorway's
 * clear height); `band` the share of the model's height the seat or top is looked for in.
 */
export const REFERENCES = {
  chair: { measure: 'seat', at: 0.46, band: [0.2, 0.75], label: 'Dining chair: seat 0.46 m' },
  office_chair: { measure: 'seat', at: 0.48, band: [0.25, 0.75], label: 'Office chair: seat 0.48 m' },
  bar_stool: { measure: 'seat', at: 0.75, band: [0.6, 1], label: 'Bar stool: seat 0.75 m' },
  stool: { measure: 'seat', at: 0.65, band: [0.6, 1], label: 'Counter stool: seat 0.65 m' },
  sofa: { measure: 'seat', at: 0.44, band: [0.25, 0.75], label: 'Sofa or armchair: seat 0.44 m (back 0.85-0.95 m)' },
  bench: { measure: 'seat', at: 0.45, band: [0.3, 1], label: 'Bench: seat 0.45 m' },
  table: { measure: 'top', at: 0.76, band: [0.7, 1], label: 'Table or desk: top 0.75-0.78 m' },
  coffee_table: { measure: 'top', at: 0.44, band: [0.7, 1], label: 'Coffee table: top 0.42-0.46 m' },
  side_table: { measure: 'top', at: 0.6, band: [0.7, 1], label: 'Side table or nightstand: top 0.55-0.65 m' },
  counter: { measure: 'top', at: 0.92, band: [0.7, 1], label: 'Kitchen counter: 0.92 m' },
  bar: { measure: 'top', at: 1.05, band: [0.7, 1], label: 'Bar or shop counter: 1.05 m' },
  bed: { measure: 'top', at: 0.55, band: [0.15, 0.7], label: 'Bed: top 0.5-0.6 m, length 2.0 m' },
  bunk: { measure: 'height', at: 1.7, label: 'Bunk: 1.6-1.8 m' },
  toilet: { measure: 'seat', at: 0.42, band: [0.3, 0.75], label: 'Toilet: seat 0.42 m' },
  sink: { measure: 'top', at: 0.85, band: [0.6, 1], label: 'Sink: 0.85 m' },
  fridge: { measure: 'height', at: 1.8, label: 'Fridge: 1.75-1.85 m' },
  bookcase: { measure: 'height', at: 1.9, label: 'Bookcase: 1.8-2.0 m' },
  door: { measure: 'height', at: 2.07, label: 'Door: 2.05-2.1 m × 0.9 m' },
};

/** The kind of piece a furniture prop is (a key of REFERENCES), or null when no reference applies (lamps, appliances...). */
export function furnitureKind(p) {
  const s = `${p.id} ${(p.name ?? '').toLowerCase()}`;
  if (/bar_stool|bar stool/.test(s)) return 'bar_stool';
  if (/stool/.test(s)) return 'stool';
  if (/office_chair|chair_office|desk chair|office chair/.test(s)) return 'office_chair';
  if (/sofa|couch|armchair|wingback/.test(s)) return 'sofa';
  if (/bench|pew\b/.test(s)) return 'bench';
  if (/chair|seat|throne/.test(s)) return 'chair';
  if (/coffee_table|coffee table/.test(s)) return 'coffee_table';
  if (/side_table|side table|nightstand|bedside/.test(s)) return 'side_table';
  if (/desk(?!_lamp)|table/.test(s)) return 'table';
  if (/bunk/.test(s)) return 'bunk';
  if (/\bbed\b|_bed|bed_/.test(s)) return 'bed';
  if (/toilet/.test(s)) return 'toilet';
  if (/sink|basin/.test(s)) return 'sink';
  if (/checkout|shop_counter|bar_counter/.test(s)) return 'bar';
  if (/counter|cupboard/.test(s)) return 'counter';
  if (/fridge|freezers_upright/.test(s)) return 'fridge';
  if (/bookcase|bookshelf/.test(s)) return 'bookcase';
  if (/door(?!way)/.test(s)) return 'door';
  return null;
}
