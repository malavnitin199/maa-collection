import { Suspense } from 'react';
import { card, muted, sectionTitle } from '@/components/ui/styles';
import { PriceCodeDecoder, PriceCodeForm } from '@/features/catalog/price-code-forms';
import { STORE_ID } from '@/lib/app-config';
import { ClearStockForm } from '@/features/catalog/clear-stock-form';
import { clearStockAction, updatePriceCodeAction } from '@/server/actions/admin';
import { requireAdmin } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { stockTotals } from '@/server/services/products';
import { getStoreSettings } from '@/server/services/settings';

async function Settings() {
  await requireAdmin();
  const t = await getT();
  const db = await requestDb();
  const [settings, totals] = await Promise.all([getStoreSettings(db, STORE_ID), stockTotals(db, STORE_ID)]);
  return (
    <>
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className={sectionTitle}>{t('own.set.codeOnTags')}</h2>
        <p className={`text-sm ${muted}`}>{t('own.set.codeIntro')}</p>
        <PriceCodeForm action={updatePriceCodeAction} initial={{ word: settings.priceCodeWord ?? '', print: settings.printPriceCode }} />
      </section>
      {settings.priceCodeWord && (
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className={sectionTitle}>{t('own.set.decoder')}</h2>
          <PriceCodeDecoder word={settings.priceCodeWord} />
        </section>
      )}
      <section id="clear-stock" className={`${card} flex scroll-mt-28 flex-col gap-3`}>
        <h2 className={sectionTitle}>{t('own.clear.title')}</h2>
        <p className={`text-sm ${muted}`}>{t('own.clear.intro')}</p>
        <ClearStockForm action={clearStockAction} items={totals.items} pieces={totals.pieces} />
      </section>
    </>
  );
}

export default async function SettingsPage() {
  const t = await getT();
  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">{t('nav.settings')}</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <Settings />
      </Suspense>
    </main>
  );
}
