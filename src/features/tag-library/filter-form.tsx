'use client';

import Form from 'next/form';
import type { FormEvent, ReactNode } from 'react';

/**
 * The All tags filters (plan v13): a GET form, so the filters live in the page
 * address. Picking a company / category / person or ticking "in stock" applies
 * at once; the search box applies with Show (or Enter). Stays at the same
 * scroll position.
 */
export function TagFilterForm({ label, children }: { label: string; children: ReactNode }) {
  const onChange = (event: FormEvent<HTMLFormElement>) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && target.type === 'checkbox')) {
      event.currentTarget.requestSubmit();
    }
  };
  return (
    <Form action="/admin/labels" scroll={false} role="search" aria-label={label} onChange={onChange} className="flex flex-col gap-2">
      {children}
    </Form>
  );
}
