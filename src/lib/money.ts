const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
});

/** Money is always integer paise; rupees exist only at the display edge. */
export function formatPaise(amountPaise: number): string {
  if (!Number.isSafeInteger(amountPaise)) {
    throw new Error(`Money must be integer paise, got: ${amountPaise}`);
  }
  return inrFormatter.format(amountPaise / 100);
}

/** Paise as a rupee box shows them: 299, 299.5; none = empty (bill lines, ADR-061). */
export function rupeesText(paise: number | null): string {
  return paise === null ? '' : String(paise / 100);
}

const paperFormatter = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Rupees the way a paper bill prints them, without ₹ (the column says it): 6,120.00. */
export function paperRupees(paise: number): string {
  return paperFormatter.format(paise / 100);
}
