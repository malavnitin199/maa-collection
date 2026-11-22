import type { BillItemLine, BillLine, Collection } from '@/server/services/bills';

/** `units`: the Qty column added up (pieces, and boxes for box packs), as the paper's "Totals … Units". */
export type SheetPart = { supplierId: string; name: string; lines: BillLine[]; pieces: number; units: number; totalPaise: number };

/**
 * The ticked collections as the company's paper bill shows them (owner's
 * feedback 2026-11-21): per company, one line per item name and rate —
 * the same name at the same rate from two collections is one line — oldest
 * collection first, like the goods were written on the bill.
 */
export function sheetParts(companies: { id: string; name: string }[], collections: Collection[]): SheetPart[] {
  const oldestFirst = [...collections].reverse();
  return companies
    .map((company) => {
      const lines: BillLine[] = [];
      for (const c of oldestFirst.filter((x) => x.supplierId === company.id)) {
        for (const l of c.lines) {
          const same = lines.find((x) => x.name === l.name && x.ratePaise === l.ratePaise && x.pack === l.pack);
          if (!same) lines.push({ ...l, sizes: [...l.sizes] });
          else {
            same.pieces += l.pieces;
            same.qty += l.qty;
            same.amountPaise += l.amountPaise;
            for (const s of l.sizes) if (!same.sizes.includes(s)) same.sizes.push(s);
          }
        }
      }
      return {
        supplierId: company.id,
        name: company.name,
        lines,
        pieces: lines.reduce((n, l) => n + l.pieces, 0),
        units: lines.reduce((n, l) => n + l.qty, 0),
        totalPaise: lines.reduce((n, l) => n + l.amountPaise, 0),
      };
    })
    .filter((p) => p.lines.length > 0);
}

/**
 * A bill made from items (ADR-060) as the paper shows it: one part with no company, one line
 * per item as added (size and colour under the name); no purchase price → rate N/A, amount 0.
 */
export function itemsPart(lines: Pick<BillItemLine, 'name' | 'size' | 'color' | 'qty' | 'ratePaise' | 'amountPaise'>[]): SheetPart[] {
  if (lines.length === 0) return [];
  const sheet: BillLine[] = lines.map((l) => ({
    name: l.name,
    sizes: [[l.size, l.color].filter(Boolean).join(' ')].filter(Boolean),
    pieces: l.qty,
    qty: l.qty,
    pack: null,
    ratePaise: l.ratePaise ?? 0,
    amountPaise: l.amountPaise,
    noRate: l.ratePaise === null,
  }));
  const pieces = sheet.reduce((n, l) => n + l.qty, 0);
  return [{ supplierId: 'items', name: '', lines: sheet, pieces, units: pieces, totalPaise: sheet.reduce((n, l) => n + l.amountPaise, 0) }];
}
