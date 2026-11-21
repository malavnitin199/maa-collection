import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { makeT, MESSAGES } from '@/lib/i18n';
import { stockValue } from '@/lib/stock-value';
import { StockValueLine, StockValueStrip } from './stock-value';

const t = makeT(MESSAGES.en);
afterEach(cleanup);

describe('Products strip and row line (ADR-057)', () => {
  it('owner: pieces × purchase price per piece = total, no MRP', () => {
    render(<StockValueStrip value={stockValue([{ stock: 8, costPaise: 90_000 }])} showCost t={t} />);
    expect(screen.getByTestId('value-pieces')).toHaveTextContent('8 pcs');
    expect(screen.getByTestId('value-per-piece')).toHaveTextContent('₹900.00');
    expect(screen.getByTestId('value-total')).toHaveTextContent('₹7,200.00');
    expect(screen.getByTestId('stock-value')).toHaveTextContent('Pieces×₹900.00Per piece=₹7,200.00Total');
    expect(screen.getByTestId('stock-value')).not.toHaveTextContent('MRP');
  });

  it('sizes with different purchase prices: a range per piece, the exact total; missing prices are named', () => {
    render(
      <StockValueStrip
        value={stockValue([
          { stock: 2, costPaise: 45_000 },
          { stock: 1, costPaise: 50_000 },
          { stock: 3, costPaise: null },
        ])}
        showCost
        t={t}
      />,
    );
    expect(screen.getByTestId('value-pieces')).toHaveTextContent('6 pcs');
    expect(screen.getByTestId('value-per-piece')).toHaveTextContent('₹450.00–₹500.00');
    expect(screen.getByTestId('value-total')).toHaveTextContent('₹1,400.00');
    expect(screen.getByTestId('stock-value')).toHaveTextContent('3 pcs have no purchase price');
  });

  it('no purchase price entered: dashes, and says so', () => {
    render(<StockValueStrip value={stockValue([{ stock: 4, costPaise: null }])} showCost t={t} />);
    expect(screen.getByTestId('value-per-piece')).toHaveTextContent('—');
    expect(screen.getByTestId('value-total')).toHaveTextContent('—');
    expect(screen.getByTestId('stock-value')).toHaveTextContent('No purchase price');
  });

  it('without the Costs right: only the pieces — no purchase price, no total, no ₹ at all', () => {
    render(<StockValueStrip value={stockValue([{ stock: 8, costPaise: 90_000 }])} showCost={false} t={t} />);
    expect(screen.getByTestId('stock-value')).toHaveTextContent(/^8 pcs in stock$/);
    expect(screen.queryByTestId('value-total')).toBeNull();
  });

  it('row line: real pieces (even below zero), price, and a total that never goes negative', () => {
    const { rerender } = render(<StockValueLine stock={3} costPaise={30_000} showCost t={t} />);
    expect(screen.getByTestId('row-value')).toHaveTextContent('3 pcs × ₹300.00 = ₹900.00');
    rerender(<StockValueLine stock={-2} costPaise={30_000} showCost t={t} tone="text-red-600" />);
    expect(screen.getByTestId('row-value')).toHaveTextContent('-2 pcs × ₹300.00 = ₹0.00');
    rerender(<StockValueLine stock={3} costPaise={null} showCost t={t} />);
    expect(screen.getByTestId('row-value')).toHaveTextContent('3 pcs · No purchase price');
    rerender(<StockValueLine stock={3} costPaise={30_000} showCost={false} t={t} />);
    expect(screen.getByTestId('row-value')).toHaveTextContent(/^3 pcs$/);
  });
});
