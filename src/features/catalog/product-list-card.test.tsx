import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { groupDesigns } from '@/lib/design-groups';
import { makeT, MESSAGES } from '@/lib/i18n';
import { ProductListCard } from './product-list-card';

const t = makeT(MESSAGES.en);
afterEach(cleanup);

let n = 0;
/** One item of a design (same name, company and MRP = one card). */
function item(over: { size?: string; stock?: number; costPaise?: number | null; active?: boolean; supplierName?: string | null; mrpPaise?: number } = {}) {
  n += 1;
  const supplierName = over.supplierName === undefined ? null : over.supplierName;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    name: 'A-Line Dress',
    supplierId: supplierName ? '11111111-1111-4111-8111-111111111111' : null,
    supplierName,
    mrpPaise: over.mrpPaise ?? 159_900,
    pricePaise: 159_900,
    size: over.size ?? 'S',
    color: '',
    stock: over.stock ?? 8,
    costPaise: over.costPaise === undefined ? 95_900 : over.costPaise,
    active: over.active ?? true,
  };
}
const card = (rows: ReturnType<typeof item>[], showCost = true, label?: React.ReactNode) =>
  render(<ProductListCard design={groupDesigns(rows)[0]} href="/admin/products/x" showCost={showCost} label={label} t={t} />);

describe('Stocks card (ADR-070)', () => {
  it('owner: photo, name, then pieces, purchase price per piece and MRP — nothing said twice', () => {
    card([item({ size: '', stock: 9, costPaise: 68_000, mrpPaise: 99_900 })]);
    expect(screen.getByRole('link', { name: 'A-Line Dress' })).toHaveAttribute('href', '/admin/products/x');
    expect(screen.getByTestId('card-photo-na')).toHaveTextContent('N/A');
    expect(screen.getByTestId('card-pieces')).toHaveTextContent('9 pcs');
    expect(screen.getByTestId('card-cost')).toHaveTextContent('₹680/pc');
    expect(screen.getByTestId('card-mrp')).toHaveTextContent('MRP ₹999');
    expect(screen.getByTestId('card-figures')).toHaveTextContent(/^9 pcs₹680\/pcMRP ₹999$/);
    // The pieces appear once: no "9 × ₹680 = total" line, no sizes row, no company or item chips.
    const article = screen.getByTestId('product-card');
    expect(article).toHaveTextContent(/^N\/AA-Line Dress9 pcs₹680\/pcMRP ₹999$/); // everything the card says
    for (const gone of ['stock-value', 'design-sizes', 'card-company', 'card-items']) expect(screen.queryByTestId(gone)).toBeNull();
    expect(article).not.toHaveTextContent(/×|=|Sizes|Items/);
    expect(within(article).queryByRole('img')).toBeNull();
    // How many items the card stands for, for the tests (not shown).
    expect(article).toHaveAttribute('data-items', '1');
  });

  it('paise stay when there are some; sizes with different purchase prices show the lowest–highest', () => {
    card([item({ costPaise: 49_950, mrpPaise: 79_950 })]);
    expect(screen.getByTestId('card-cost')).toHaveTextContent('₹499.50/pc');
    expect(screen.getByTestId('card-mrp')).toHaveTextContent('MRP ₹799.50');
    cleanup();
    card([
      item({ supplierName: 'Royal Garments', size: 'L', stock: 1, costPaise: 50_000 }),
      item({ supplierName: 'Royal Garments', size: 'M', stock: 2, costPaise: 45_000 }),
    ]);
    expect(screen.getByTestId('card-pieces')).toHaveTextContent('3 pcs');
    expect(screen.getByTestId('card-cost')).toHaveTextContent('₹450–₹500/pc');
    expect(screen.getByTestId('product-card')).toHaveAttribute('data-items', '2');
    expect(screen.getByTestId('product-card')).not.toHaveTextContent('Royal Garments');
  });

  it('no purchase price entered: Cost N/A', () => {
    card([item({ costPaise: null })]);
    expect(screen.getByTestId('card-cost')).toHaveTextContent('Cost N/A');
  });

  it('without the Costs right: pieces and MRP only — no purchase price (invariant 4)', () => {
    card([item({ costPaise: 68_000 })], false);
    expect(screen.getByTestId('card-pieces')).toHaveTextContent('8 pcs');
    expect(screen.queryByTestId('card-cost')).toBeNull();
    expect(screen.getByTestId('product-card')).not.toHaveTextContent('680');
    expect(screen.getByTestId('card-mrp')).toHaveTextContent('MRP ₹1,599');
  });

  it('the whole card opens the product: the name link covers it and a round › says so (ADR-068)', () => {
    card([item()]);
    const link = screen.getByRole('link', { name: 'A-Line Dress' });
    expect(link.className).toMatch(/after:absolute/);
    expect(link.className).toMatch(/after:inset-0/);
    expect(screen.getByTestId('product-card').className).toMatch(/\brelative\b/);
    expect(screen.getByTestId('card-open')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('card-open').className).toMatch(/\bpointer-events-none\b/); // a click on it reaches the link
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('the label button goes between the figures and the ›; without it, nothing is there', () => {
    card([item()], true, <button type="button">QR</button>);
    const article = screen.getByTestId('product-card');
    const qr = within(article).getByRole('button', { name: 'QR' });
    expect(qr.nextElementSibling).toBe(screen.getByTestId('card-open'));
    cleanup();
    card([item()]);
    expect(within(screen.getByTestId('product-card')).queryByRole('button')).toBeNull();
  });

  it('hidden items stay listed, marked: the whole design, or how many of its items', () => {
    card([item({ active: false })]);
    expect(screen.getByTestId('card-hidden')).toHaveTextContent('Hidden');
    cleanup();
    card([item({ size: 'M' }), item({ size: 'L', active: false })]);
    expect(screen.getByTestId('card-hidden')).toHaveTextContent('1 hidden');
    cleanup();
    card([item()]);
    expect(screen.queryByTestId('card-hidden')).toBeNull();
  });
});
