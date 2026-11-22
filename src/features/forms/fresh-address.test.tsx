import { act, cleanup, render } from '@testing-library/react';
import { Activity } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
const { FreshAddress } = await import('./fresh-address');

/** Address filters and notes on return (ADR-068). */
afterEach(() => {
  cleanup();
  replace.mockReset();
  window.history.replaceState(null, '', '/');
});

const go = (path: string) => window.history.pushState(null, '', path);
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 5)));
const view = (mode: 'visible' | 'hidden') => (
  <Activity mode={mode}>
    <FreshAddress drop={['q', 'stock', 'deleted']} />
  </Activity>
);

describe('FreshAddress', () => {
  it('Back to the same filtered address: the filters go, the open group stays', async () => {
    go('/admin/labels?group=company&q=kurta&stock=in');
    const { rerender } = render(view('visible'));
    await tick();
    go('/admin/labels/print?x=1');
    rerender(view('hidden'));
    await tick();
    go('/admin/labels?group=company&q=kurta&stock=in');
    rerender(view('visible'));
    expect(replace).toHaveBeenCalledWith('/admin/labels?group=company', { scroll: false });
  });

  it('sent back with a new note (Delete → "2 items deleted."): the note stays', async () => {
    go('/admin/products');
    const { rerender } = render(view('visible'));
    await tick();
    go('/admin/products/1');
    rerender(view('hidden'));
    await tick();
    go('/admin/products?deleted=2+items+deleted.');
    rerender(view('visible'));
    expect(replace).not.toHaveBeenCalled();
    // Later, away and Back to that same address: now it goes.
    go('/admin/products/2');
    rerender(view('hidden'));
    await tick();
    go('/admin/products?deleted=2+items+deleted.');
    rerender(view('visible'));
    expect(replace).toHaveBeenCalledWith('/admin/products', { scroll: false });
  });
});
