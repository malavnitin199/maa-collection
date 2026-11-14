import { describe, expect, it } from 'vitest';
import { can, canAny, cleanPermissions } from './permissions';

describe('permissions', () => {
  it('admins can do everything; salesmen only what they were granted', () => {
    expect(can({ role: 'admin', permissions: [] }, 'costs')).toBe(true);
    const qc = { role: 'salesman' as const, permissions: ['catalog', 'prices'] };
    expect(can(qc, 'catalog')).toBe(true);
    expect(can(qc, 'costs')).toBe(false);
    expect(canAny(qc, ['stock', 'prices'])).toBe(true);
    expect(can(null, 'catalog')).toBe(false);
  });

  it('cleans unknown and duplicate permission names', () => {
    expect(cleanPermissions(['stock', 'hack', 'stock', 'catalog'])).toEqual(['catalog', 'stock']);
  });
});
