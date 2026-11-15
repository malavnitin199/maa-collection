/**
 * Prices by size. Each size × colour of a design is its own product, but prices
 * follow the size only: every colour of a size gets the same MRP, selling and
 * purchase price. A size uses the design's default unless it has its own value.
 * Used by the forms (preview) and by the server services (which also validate).
 * Money is integer paise; null = not entered.
 */

export type Rates = { mrpPaise: number | null; pricePaise: number | null; costPaise: number | null };

/** A size's own values; a missing/null field means "use the default". */
export type SizeRates = { size: string } & Partial<Rates>;

const sizeKey = (size: string) => size.trim().toLowerCase();

/** Same size? (case and spaces ignored, as for duplicate checks). */
export function sameSize(a: string, b: string): boolean {
  return sizeKey(a) === sizeKey(b);
}

export function findSizeRates<T extends { size: string }>(list: readonly T[], size: string): T | undefined {
  return list.find((row) => sameSize(row.size, size));
}

export function hasOwnRates(own: Partial<Rates> | undefined): boolean {
  return own?.mrpPaise != null || own?.pricePaise != null || own?.costPaise != null;
}

/** One size's rates: its own value, else the default. No selling price = sell at that size's MRP. */
export function ratesForSize(defaults: Rates, own?: Partial<Rates>): Rates {
  const mrpPaise = own?.mrpPaise ?? defaults.mrpPaise;
  return {
    mrpPaise,
    pricePaise: own?.pricePaise ?? defaults.pricePaise ?? mrpPaise,
    costPaise: own?.costPaise ?? defaults.costPaise,
  };
}

/** Form field names for one size's boxes (rates form on the product page). */
export function sizeFieldName(field: 'mrp' | 'price' | 'cost', size: string): string {
  return `${field}@${size}`;
}

const LETTER_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];

/** Shop order: XS…3XL, then numbers (26, 28…) ascending, then anything else as given. */
export function sortSizes(sizes: readonly string[]): string[] {
  const rank = (size: string): [number, number] => {
    const letter = LETTER_SIZES.indexOf(size.trim().toUpperCase());
    if (letter >= 0) return [0, letter];
    if (/^\d+(\.\d+)?$/.test(size.trim())) return [1, Number(size)];
    return [2, 0];
  };
  return [...sizes].sort((a, b) => {
    const [ga, va] = rank(a);
    const [gb, vb] = rank(b);
    return ga - gb || va - vb;
  });
}

export type VariantRates = { size: string; mrpPaise: number; pricePaise: number; costPaise: number | null };

/** The value most sizes have (ties: the first size's). */
function mostCommon<T>(values: readonly T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return values.reduce((best, v) => ((counts.get(v) ?? 0) > (counts.get(best) ?? 0) ? v : best), values[0]);
}

/**
 * Today's rates of a design (all its sizes × colours) as a default plus each
 * size's own values, for the rates form. `ratesForSize(defaults, own)` gives back
 * exactly each size's current rates. Sizes whose colours differ today are listed
 * in `mixedSizes`; the first colour's rates are used for them.
 */
export function splitDesignRates(variants: readonly VariantRates[]): {
  sizes: string[];
  defaults: Rates;
  own: SizeRates[];
  mixedSizes: string[];
} {
  if (variants.length === 0) return { sizes: [], defaults: { mrpPaise: null, pricePaise: null, costPaise: null }, own: [], mixedSizes: [] };
  const bySize: VariantRates[] = [];
  const mixed = new Set<string>();
  for (const v of variants) {
    const first = findSizeRates(bySize, v.size);
    if (!first) bySize.push(v);
    else if (first.mrpPaise !== v.mrpPaise || first.pricePaise !== v.pricePaise || first.costPaise !== v.costPaise) mixed.add(first.size);
  }
  const sizes = sortSizes(bySize.map((v) => v.size));
  const rows = sizes.map((size) => findSizeRates(bySize, size)!);

  const mrpPaise = mostCommon(rows.map((r) => r.mrpPaise));
  // Every size sells at its MRP: leave the default selling price empty (= MRP).
  const atMrp = rows.every((r) => r.pricePaise === r.mrpPaise);
  const pricePaise = atMrp ? null : mostCommon(rows.map((r) => r.pricePaise));
  // A size without a purchase price can't be expressed as an override, so then the default is empty.
  const costPaise = rows.some((r) => r.costPaise === null) ? null : mostCommon(rows.map((r) => r.costPaise));

  const own = rows
    .map((r) => ({
      size: r.size,
      ...(r.mrpPaise !== mrpPaise ? { mrpPaise: r.mrpPaise } : {}),
      ...(pricePaise !== null && r.pricePaise !== pricePaise ? { pricePaise: r.pricePaise } : {}),
      ...(r.costPaise !== costPaise ? { costPaise: r.costPaise } : {}),
    }))
    .filter(hasOwnRates);
  return { sizes, defaults: { mrpPaise, pricePaise, costPaise }, own, mixedSizes: sizes.filter((s) => mixed.has(s)) };
}

type DesignMember = { id: string; name: string; brand: string; categoryId: string | null; category: string; size: string };

/** Same design = same name, brand and category (as `listDesignVariants` on the server). */
function designKey(p: Omit<DesignMember, 'id' | 'size'>): string {
  return [p.name.trim().toLowerCase(), p.brand.trim().toLowerCase(), p.categoryId ?? p.category.trim().toLowerCase()].join('|');
}

/** For each product: the sizes its design is made in, in shop order (for the size row on tags). */
export function designSizesById(members: readonly DesignMember[]): Map<string, string[]> {
  const sizesByDesign = new Map<string, string[]>();
  for (const p of members) {
    const sizes = sizesByDesign.get(designKey(p)) ?? [];
    if (!sizes.some((s) => sameSize(s, p.size))) sizes.push(p.size);
    sizesByDesign.set(designKey(p), sizes);
  }
  return new Map(members.map((p) => [p.id, sortSizes(sizesByDesign.get(designKey(p))!)]));
}
