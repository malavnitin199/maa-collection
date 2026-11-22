import { act, cleanup, render, screen } from '@testing-library/react';
import { Activity, StrictMode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useClearOnLeave, useScreenVisits } from './fresh-on-return';

/**
 * Coming back to a screen (ADR-068). Next keeps a visited screen hidden in an <Activity>;
 * these tests hide and show one the same way, with the address changing in between.
 */
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

const go = (path: string) => window.history.pushState(null, '', path);
/** The check runs a moment after the screen hides. */
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 5)));

function Visits({ left, returned }: { left: () => void; returned: () => void }) {
  useScreenVisits({ left, returned });
  return null;
}

function Ticks() {
  const [n, setN] = useState(0);
  useClearOnLeave(() => setN(0));
  return (
    <button type="button" onClick={() => setN(n + 1)}>
      ticked {n}
    </button>
  );
}

describe('useScreenVisits', () => {
  it('another screen opened: left while hidden, returned when shown again — once each', async () => {
    const left = vi.fn();
    const returned = vi.fn();
    go('/admin/products');
    const view = (mode: 'visible' | 'hidden') => (
      <Activity mode={mode}>
        <Visits left={left} returned={returned} />
      </Activity>
    );
    const { rerender } = render(view('visible'));
    expect(left).not.toHaveBeenCalled();
    go('/admin/products/1');
    rerender(view('hidden'));
    await tick();
    expect(left).toHaveBeenCalledTimes(1);
    expect(returned).not.toHaveBeenCalled();
    go('/admin/products');
    rerender(view('visible'));
    expect(returned).toHaveBeenCalledTimes(1);
    rerender(view('visible'));
    expect(returned).toHaveBeenCalledTimes(1);
  });

  it('the same screen with another filter or message in the address is not "another screen"', async () => {
    const left = vi.fn();
    const returned = vi.fn();
    go('/admin/labels');
    const view = (mode: 'visible' | 'hidden') => (
      <Activity mode={mode}>
        <Visits left={left} returned={returned} />
      </Activity>
    );
    const { rerender } = render(view('visible'));
    go('/admin/labels?q=kurta');
    rerender(view('hidden'));
    await tick();
    rerender(view('visible'));
    expect(left).not.toHaveBeenCalled();
    expect(returned).not.toHaveBeenCalled();
  });

  it("React's quick stop-and-start in development is not a visit", async () => {
    const left = vi.fn();
    const returned = vi.fn();
    go('/admin/companies');
    render(
      <StrictMode>
        <Visits left={left} returned={returned} />
      </StrictMode>,
    );
    await tick();
    expect(left).not.toHaveBeenCalled();
    expect(returned).not.toHaveBeenCalled();
  });
});

describe('useClearOnLeave', () => {
  it('a ticked list is plain again when the person comes back', async () => {
    go('/admin/products');
    const view = (mode: 'visible' | 'hidden') => (
      <Activity mode={mode}>
        <Ticks />
      </Activity>
    );
    const { rerender } = render(view('visible'));
    act(() => screen.getByRole('button').click());
    act(() => screen.getByRole('button').click());
    expect(screen.getByRole('button')).toHaveTextContent('ticked 2');
    go('/admin/dashboard');
    rerender(view('hidden'));
    await tick();
    go('/admin/products');
    rerender(view('visible'));
    expect(screen.getByRole('button')).toHaveTextContent('ticked 0');
  });
});
