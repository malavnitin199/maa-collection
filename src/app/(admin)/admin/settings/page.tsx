import { Suspense } from 'react';
import { card, muted, sectionTitle } from '@/components/ui/styles';
import { PriceCodeDecoder, PriceCodeForm } from '@/features/catalog/price-code-forms';
import { STORE_ID } from '@/lib/app-config';
import { updatePriceCodeAction } from '@/server/actions/admin';
import { requireAdmin } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { getStoreSettings } from '@/server/services/settings';

async function Settings() {
  await requireAdmin();
  const settings = await getStoreSettings(await requestDb(), STORE_ID);
  return (
    <>
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className={sectionTitle}>Code price on tags</h2>
        <p className={`text-sm ${muted}`}>
          The purchase price is printed on the label as letters, so your staff know the lowest price while customers
          can&apos;t read it. Each letter of your code word stands for a digit: 1, 2, 3 … 9, 0.
        </p>
        <PriceCodeForm action={updatePriceCodeAction} initial={{ word: settings.priceCodeWord ?? '', print: settings.printPriceCode }} />
      </section>
      {settings.priceCodeWord && (
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className={sectionTitle}>Decoder</h2>
          <PriceCodeDecoder word={settings.priceCodeWord} />
        </section>
      )}
    </>
  );
}

export default function SettingsPage() {
  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Settings />
      </Suspense>
    </main>
  );
}
