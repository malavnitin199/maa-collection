import { describe, expect, it } from 'vitest';
import { findOnPhone } from './catalogue';
import { memoryStore } from './store';
import { offlineSaleBody, sendWaiting } from './sync';
import type { PhoneCatalogue, QueuedSale, SendOutcome } from './types';

const VISHAL = '11111111-1111-4111-8111-111111111111';
const NITIN = '22222222-2222-4222-8222-222222222222';

function sale(id: string, madeAt: string, change: Partial<QueuedSale> = {}): QueuedSale {
  return {
    operationId: id,
    recordedBy: VISHAL,
    recordedByName: 'Vishal',
    madeAt,
    productId: '33333333-3333-4333-8333-333333333333',
    mrpPaise: 49900,
    quantity: 1,
    unitPricePaise: 45000,
    soldBy: VISHAL,
    soldByName: 'Vishal',
    name: 'Classic Crew Tee',
    size: 'M',
    color: 'Black',
    state: 'waiting',
    tries: 0,
    ...change,
  };
}

/** A pretend shop: answers each sale with the next outcome and remembers the order. */
function shop(outcomes: SendOutcome[]) {
  const sent: string[] = [];
  return {
    sent,
    send: async (s: QueuedSale): Promise<SendOutcome> => {
      sent.push(s.operationId);
      return outcomes.shift() ?? { kind: 'sent' };
    },
  };
}

describe('sending sales saved on the phone (plan v18)', () => {
  it('sends this person’s sales oldest first and removes each one the shop recorded', async () => {
    const store = memoryStore([sale('b', '2026-11-19T10:05:00.000Z'), sale('a', '2026-11-19T10:00:00.000Z'), sale('n', '2026-11-19T09:00:00.000Z', { recordedBy: NITIN })]);
    const { sent, send } = shop([]);
    const report = await sendWaiting(store, VISHAL, send);
    expect(sent).toEqual(['a', 'b']);
    expect(report).toEqual({ sent: 2, refused: 0, stopped: null });
    // Nitin's sale waits for Nitin.
    expect((await store.all()).map((s) => s.operationId)).toEqual(['n']);
  });

  it('stops at no internet and keeps the rest for the next try', async () => {
    const store = memoryStore([sale('a', '2026-11-19T10:00:00.000Z'), sale('b', '2026-11-19T10:05:00.000Z'), sale('c', '2026-11-19T10:10:00.000Z')]);
    const { sent, send } = shop([{ kind: 'sent' }, { kind: 'offline' }]);
    const report = await sendWaiting(store, VISHAL, send);
    expect(sent).toEqual(['a', 'b']);
    expect(report.stopped).toBe('offline');
    const left = await store.all();
    expect(left.map((s) => [s.operationId, s.state, s.tries])).toEqual([
      ['b', 'waiting', 1],
      ['c', 'waiting', 0],
    ]);
  });

  it('a logged-out phone stops without changing anything else', async () => {
    const store = memoryStore([sale('a', '2026-11-19T10:00:00.000Z')]);
    const report = await sendWaiting(store, VISHAL, shop([{ kind: 'login' }]).send);
    expect(report).toEqual({ sent: 0, refused: 0, stopped: 'login' });
    expect((await store.all())[0].state).toBe('waiting');
  });

  it('a refused sale is kept with the reason, skipped next time, and sent again only on Try again', async () => {
    const store = memoryStore([sale('a', '2026-11-19T10:00:00.000Z'), sale('b', '2026-11-19T10:05:00.000Z')]);
    await sendWaiting(store, VISHAL, shop([{ kind: 'refused', reason: 'Enter a valid sale price.' }]).send);
    expect(await store.all()).toEqual([expect.objectContaining({ operationId: 'a', state: 'problem', problem: 'Enter a valid sale price.', tries: 1 })]);

    const later = shop([]);
    await sendWaiting(store, VISHAL, later.send);
    expect(later.sent).toEqual([]);

    const retry = shop([]);
    expect(await sendWaiting(store, VISHAL, retry.send, { retryProblems: true, only: 'a' })).toEqual({ sent: 1, refused: 0, stopped: null });
    expect(await store.all()).toEqual([]);
  });

  it('sends what the shop needs and nothing more', () => {
    const body = offlineSaleBody(sale('a', '2026-11-19T10:00:00.000Z'));
    expect(Object.keys(body).sort()).toEqual(['madeAt', 'manual', 'mrpPaise', 'operationId', 'productId', 'quantity', 'recordedBy', 'soldBy', 'totalPaise', 'unitPricePaise']);
  });
});

describe('the phone’s copy of the counter (plan v18)', () => {
  const catalogue: PhoneCatalogue = {
    v: 1,
    savedAt: '2026-11-19T09:00:00.000Z',
    me: { id: VISHAL, name: 'Vishal' },
    staff: [{ id: VISHAL, name: 'Vishal' }],
    items: [
      { id: 'p1', sku: 'MAA-TS-001', barcode: '8902222000023', name: 'Classic Crew Tee', brand: 'X', category: 'T-Shirt', size: 'M', color: 'Black', mrpPaise: 49900, pricePaise: 49900, stock: 3 },
    ],
  };

  it('finds a scanned barcode, a typed SKU in any case, or a tag’s QR link — like the server', () => {
    expect(findOnPhone(catalogue, '8902222000023')?.id).toBe('p1');
    expect(findOnPhone(catalogue, ' maa-ts-001 ')?.id).toBe('p1');
    expect(findOnPhone(catalogue, 'https://maa-collection-pi.vercel.app/i/8902222000023')?.id).toBe('p1');
    expect(findOnPhone(catalogue, '0000')).toBeNull();
    expect(findOnPhone(null, '8902222000023')).toBeNull();
  });
});
