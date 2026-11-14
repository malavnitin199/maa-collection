import { describe, expect, it } from 'vitest';
import { APP_NAME } from './app-config';

describe('application configuration', () => {
  it('has the correct store application name', () => {
    expect(APP_NAME).toBe('Maa Collection');
  });
});
