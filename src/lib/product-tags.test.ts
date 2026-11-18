import { describe, expect, it } from 'vitest';
import { AGE_GROUPS, asAgeGroup, asForGender, FOR_GENDERS, parseTag } from './product-tags';

describe('product tags (plan v17)', () => {
  it('empty means not set; only known values pass', () => {
    expect(parseTag(FOR_GENDERS, '')).toBeNull();
    expect(parseTag(FOR_GENDERS, undefined)).toBeNull();
    expect(parseTag(FOR_GENDERS, 'girls')).toBe('girls');
    expect(parseTag(AGE_GROUPS, 'child')).toBe('child');
    expect(parseTag(FOR_GENDERS, 'Girls')).toBe('invalid');
    expect(parseTag(AGE_GROUPS, 3)).toBe('invalid');
  });

  it('reads stored values back, unknown = not set', () => {
    expect(asForGender('boys')).toBe('boys');
    expect(asForGender(null)).toBeNull();
    expect(asAgeGroup('adult')).toBe('adult');
    expect(asAgeGroup('teen')).toBeNull();
  });
});
