import type { MessageKey, Vars } from '@/lib/i18n';

/**
 * A rule was broken (bad input, out of stock, …). The message is safe to show
 * staff. An optional `key` (+ `vars`) lets screens show it in the person's
 * language; the English `message` is the fallback.
 */
export class DomainError extends Error {
  readonly key?: MessageKey;
  readonly vars?: Vars;
  constructor(message: string, translation?: { key: MessageKey; vars?: Vars }) {
    super(message);
    this.name = 'DomainError';
    this.key = translation?.key;
    this.vars = translation?.vars;
  }
}

/** Postgres unique-violation (e.g. a retried operation_id, or a duplicate barcode). */
export function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    if ((current as { code?: unknown }).code === '23505') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
