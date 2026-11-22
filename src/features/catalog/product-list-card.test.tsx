import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { groupDesigns } from '@/lib/design-groups';
import { makeT, MESSAGES } from '@/lib/i18n';
import { ProductListCard } from './product-list-card';

const t = makeT(MESSAGES.en);
afterEach(cleanup);

let n = 0;
/** One item of a design (same name, company and MRP = one card). */
function item(over: { size?: string; stock?: number; costPaise?: number | null; active?: boolean; supplierName?: string | null } = {}) {
  n += 1;
  const supplierName = over.supplierName === undefined ? null : over.supplierName;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    name: 'A-Line Dress',
    supplierId: supplierName ? '11111111-1111-4111-8111-111111111111' : null,
    supplierName,
    mrpPaise: 159_900,
    pricePaise: 159_900,
    size: over.size ?? 'S',
    color: '',
    stock: over.stock ?? 8,
    costPaise: over.costPaise === undefined ? 95_900 : over.costPaise,
    active: over.active ?? true,
  };
}
const card = (rows: ReturnType<typeof item>[], showCost = true) =>
  render(<ProductListCard design={groupDesigns(rows)[0]} href="/admin/products/x" showCost={showCost} t={t} />);

describe('Products card (ADR-058)', () => {
  it('owner: company, items and pieces chips, then pieces × purchase price = total; N/A for what is empty', () => {
    card([item({ size: '' })]);
    expect(screen.getByRole('link', { name: 'A-Line Dress' })).toHaveAttribute('href', '/admin/products/x');
    expect(screen.getByTestId('card-photo-na')).toHaveTextContent('N/A');
    expect(screen.getByTestId('card-company')).toHaveTextContent('N/A');
    expect(screen.getByTestId('card-items')).toHaveTextContent('Items: 1');
    expect(screen.getByTestId('card-pieces')).toHaveTextContent('8 pcs');
    expect(screen.getByTestId('stock-value')).toHaveTextContent('8 pcs × ₹959.00 = ₹7,672.00');
    expect(screen.getByTestId('design-sizes')).toHaveTextContent('N/A · 8');
    // Gone from the card: MRP, QR code, the folding list and the print link.
    const article = screen.getByTestId('product-card');
    expect(article).not.toHaveTextContent('MRP');
    expect(within(article).queryByRole('img')).toBeNull();
    expect(article).not.toHaveTextContent(/Show \d|Print tags/);
  });

  it('the whole card opens the product: the name link covers it and a round › says so (ADR-068)', () => {
    card([item()]);
    const link = screen.getByRole('link', { name: 'A-Line Dress' });
    expect(link.className).toMatch(/after:absolute/);
    expect(link.className).toMatch(/after:inset-0/);
    expect(screen.getByTestId('product-card').className).toMatch(/\brelative\b/);
    // The › is a picture for the eyes only; the link keeps the product's name.
    expect(screen.getByTestId('card-open')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('card-open').className).toMatch(/\bpointer-events-none\b/); // a click on it reaches the link
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('a company and several sizes: the company by name, sizes in shop order, a range per piece, the exact total', () => {
    card([
      item({ supplierName: 'Royal Garments', size: 'L', stock: 1, costPaise: 50_000 }),
      item({ supplierName: 'Royal Garments', size: 'M', stock: 2, costPaise: 45_000 }),
    ]);
    expect(screen.getByTestId('card-company')).toHaveTextContent('Royal Garments');
    expect(screen.getByTestId('card-items')).toHaveTextContent('Items: 2');
    expect(screen.getByTestId('card-pieces')).toHaveTextContent('3 pcs');
    expect(screen.getByTestId('design-sizes')).toHaveTextContent('M · 2L · 1');
    expect(screen.getByTestId('stock-value')).toHaveTextContent('3 pcs × ₹450.00–₹500.00 = ₹1,400.00');
  });

  it('no purchase price entered: N/A × N/A; some missing: named under the line', () => {
    card([item({ costPaise: null })]);
    expect(screen.getByTestId('stock-value')).toHaveTextContent('8 pcs × N/A = N/A');
    cleanup();
    card([item({ size: 'M', stock: 2 }), item({ size: 'L', stock: 3, costPaise: null })]);
    expect(screen.getByTestId('stock-value')).toHaveTextContent('5 pcs × ₹959.00 = ₹1,918.003 pcs have no purchase price');
  });

  it('without the Costs right: the chips only — no purchase price, no total, no ₹ anywhere', () => {
    card([item()], false);
    expect(screen.getByTestId('card-pieces')).toHaveTextContent('8 pcs');
    expect(screen.queryByTestId('stock-value')).toBeNull();
    expect(screen.getByTestId('product-card')).not.toHaveTextContent('₹');
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
