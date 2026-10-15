// Stock is stored in BASE units (sachets, tins...). These helpers turn it into
// something people read easily, like "34 bags + 12 sachets".

export type PackInfo = {
  name: string;
  units_per_pack: number;
  is_active?: boolean;
};

/** "sachet" -> "sachets", "box" -> "boxes"; 1 stays singular. */
export function plural(word: string, count: number) {
  const w = word.trim().toLowerCase();
  if (count === 1) return w;
  if (/(s|x|z|ch|sh)$/.test(w)) return `${w}es`;
  return `${w}s`;
}

/** The biggest active pack, used to show stock as packs + loose units. */
export function mainPack(packs: PackInfo[] | null | undefined) {
  return (packs ?? [])
    .filter((p) => p.is_active !== false && p.units_per_pack > 1)
    .sort((a, b) => b.units_per_pack - a.units_per_pack)[0];
}

/** e.g. formatStock(1032, "sachet", [{name:"Bag", units_per_pack:30}]) -> "34 bags + 12 sachets" */
export function formatStock(units: number, baseUnit: string, packs?: PackInfo[] | null) {
  const pack = mainPack(packs);
  if (!pack || units < pack.units_per_pack) {
    return `${units} ${plural(baseUnit, units)}`;
  }
  const full = Math.floor(units / pack.units_per_pack);
  const loose = units % pack.units_per_pack;
  const packText = `${full} ${plural(pack.name, full)}`;
  return loose ? `${packText} + ${loose} ${plural(baseUnit, loose)}` : packText;
}

/**
 * Low stock when units are at or below the product's reorder level.
 * A reorder level of 0 means "use the shop default".
 */
export function isLowStock(units: number, reorderLevel: number, shopDefault: number) {
  const level = reorderLevel > 0 ? reorderLevel : shopDefault;
  return units <= level;
}
