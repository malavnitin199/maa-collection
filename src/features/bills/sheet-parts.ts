import type { BillLine, Collection } from '@/server/services/bills';

export type SheetPart = { supplierId: string; name: string; lines: BillLine[]; pieces: number; totalPaise: number };

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
          const same = lines.find((x) => x.name === l.name && x.ratePaise === l.ratePaise);
          if (!same) lines.push({ ...l, sizes: [...l.sizes] });
          else {
            same.pieces += l.pieces;
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
        totalPaise: lines.reduce((n, l) => n + l.amountPaise, 0),
      };
    })
    .filter((p) => p.lines.length > 0);
}
