import { MESSAGES } from '@/lib/i18n';
import { getLocale } from '@/server/i18n';
import { I18nProvider } from './i18n-provider';

/** Wraps every page: the person's language for client components, and `lang` for screen readers and fonts. */
export async function LocaleRoot({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <I18nProvider locale={locale} messages={MESSAGES[locale]}>
      <div lang={locale} className="contents">
        {children}
      </div>
    </I18nProvider>
  );
}
