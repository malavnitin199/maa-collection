import { act, cleanup, render } from '@testing-library/react';
import { Activity } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
const { FreshAddress } = await import('./fresh-address');

/**
 * Address filters and notes on return (ADR-068). The browser's Navigation API is faked:
 * `go` makes a new place in history (a tap or Delete), `back` returns to an earlier one.
 */
let entry = 0;
let current = 'entry-0';
const keys = new Map<string, string>();
beforeEach(() => {
  Object.defineProperty(window, 'navigation', { configurable: true, value: { get currentEntry() { return { key: current }; } } });
});
afterEach(() => {
  cleanup();
  replace.mockReset();
  window.history.replaceState(null, '', '/');
  Reflect.deleteProperty(window, 'navigation');
});

/** A tap on a link: a new place in history. Returns its key. */
const go = (path: string) => {
  window.history.pushState(null, '', path);
  current = `entry-${++entry}`;
  keys.set(current, path);
  return current;
};
/** Back / Forward to an earlier place. */
const back = (key: string) => {
  window.history.pushState(null, '', keys.get(key)!);
  current = key;
};
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 5)));
const view = (mode: 'visible' | 'hidden') => (
  <Activity mode={mode}>
    <FreshAddress drop={['q', 'stock', 'supplier', 'deleted']} />
  </Activity>
);

describe('FreshAddress', () => {
  it('Back to the same filtered place: the filters go, the open group stays', async () => {
    const tags = go('/admin/labels?group=company&q=kurta&stock=in');
    const { rerender } = render(view('visible'));
    await tick();
    go('/admin/labels/print?x=1');
    rerender(view('hidden'));
    await tick();
    back(tags);
    rerender(view('visible'));
    expect(replace).toHaveBeenCalledWith('/admin/labels?group=company', { scroll: false });
  });

  it('a link that carries a filter on purpose keeps it, even the second time', async () => {
    const company = go('/admin/companies/1');
    go('/admin/labels?supplier=1&group=delivery');
    const { rerender } = render(view('visible'));
    await tick();
    back(company);
    rerender(view('hidden'));
    await tick();
    go('/admin/labels?supplier=1&group=delivery'); // "See this company's tags" again
    rerender(view('visible'));
    expect(replace).not.toHaveBeenCalled();
  });

  it('Delete sends a note: it shows every time, even the same words twice; Back later drops it', async () => {
    go('/admin/products?deleted=1+item+deleted.');
    const { rerender } = render(view('visible'));
    await tick();
    go('/admin/products/2');
    rerender(view('hidden'));
    await tick();
    const second = go('/admin/products?deleted=1+item+deleted.');
    rerender(view('visible'));
    expect(replace).not.toHaveBeenCalled();
    // Later: away, then Back to that same place — now it goes.
    go('/admin/products/3');
    rerender(view('hidden'));
    await tick();
    back(second);
    rerender(view('visible'));
    expect(replace).toHaveBeenCalledWith('/admin/products', { scroll: false });
  });

  it('a browser without the Navigation API keeps the address as it is', async () => {
    Reflect.deleteProperty(window, 'navigation');
    window.history.pushState(null, '', '/admin/labels?q=kurta');
    const { rerender } = render(view('visible'));
    await tick();
    window.history.pushState(null, '', '/admin/products');
    rerender(view('hidden'));
    await tick();
    window.history.pushState(null, '', '/admin/labels?q=kurta');
    rerender(view('visible'));
    expect(replace).not.toHaveBeenCalled();
  });
});
