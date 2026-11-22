import Link from 'next/link';
import { card, link, muted, sectionTitle } from '@/components/ui/styles';
import { getLocale, getT } from '@/server/i18n';

export const metadata = { title: 'Help · Maa Collection' };

function Section({ id, title, intro, children, open = false }: { id: string; title: string; intro: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details id={id} open={open} className={`${card} scroll-mt-20`}>
      <summary className="cursor-pointer list-none">
        <span className="text-lg font-semibold">{title}</span>
        <span className={`block text-sm ${muted}`}>{intro}</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed">{children}</div>
    </details>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{i + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

const Tip = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">💡 {children}</p>
);

/**
 * हिन्दी versions of the steps and lists that have bold text (same order as the English
 * below). Plain lines — headings, tips, the table, problems & fixes — are in i18n/modules/help.ts.
 */
const HI = {
  start: [
    <>फ़ोन पर ऐप खोलें और <strong>अपने नाम</strong> पर टैप करें, फिर अपना <strong>PIN</strong> डालें (मालिक देंगे)।</>,
    <>इसे होम स्क्रीन पर लगाएँ: Chrome में ⋮ → <em>Add to Home screen</em> दबाएँ; iPhone में Share → <em>Add to Home Screen</em> दबाएँ। फिर यह ऐप की तरह खुलेगा।</>,
    <>नीचे के टैब: <strong>बेचें</strong> (स्कैन करके बेचें), <strong>एक्सचेंज</strong>, <strong>मेरी बिक्री</strong>। मालिक ने कैटलॉग का काम दिया हो तो <strong>कैटलॉग</strong> भी दिखेगा।</>,
    <>स्कैन के लिए <strong>कैमरा से स्कैन करें</strong> दबाएँ और एक बार कैमरा की अनुमति दें। बारकोड को हरे बॉक्स के अंदर सीधा रखें, 15–20 सेमी दूर।</>,
    <>दिन का काम खत्म? ऊपर दाईं ओर <strong>⋯</strong> दबाएँ, फिर <strong>लॉग आउट</strong>, खासकर साझा फ़ोन पर।</>,
  ],
  sell: [
    <><strong>बेचें</strong> टैब → टैग स्कैन करें (कैमरा या USB/ब्लूटूथ स्कैनर) या बारकोड के नीचे का कोड डालें।</>,
    <>देखें कि फ़ोटो और साइज़ हाथ वाले आइटम से मिलते हैं।</>,
    <><strong>यह आइटम बेचें</strong> दबाएँ, मात्रा और ग्राहक से तय हुआ दाम डालें (MRP तक)।</>,
    <>किसी साथी के लिए बेच रहे हैं? <strong>बिक्री किसके नाम</strong> में उन्हें चुनें। यह भी दर्ज होता है कि बिक्री आपने डाली।</>,
    <><strong>बिक्री दर्ज करें</strong> दबाएँ। स्टॉक हर फ़ोन पर तुरंत घट जाता है।</>,
  ],
  // 2026-11-23 (ADR-067): the counter's bill (ADR-040).
  bill: [
    <>पहला टैग स्कैन करें → <strong>और आइटम जोड़ें</strong>। आइटम बिल पर जाता है; कैमरा से स्कैन किया हो तो कैमरा फिर खुलता है।</>,
    <>हर अगला टैग स्कैन करें (वही टैग दोबारा = एक पीस और), फिर <strong>पूरा हुआ</strong>।</>,
    <>हर आइटम का तय दाम लिखें (या <strong>स्कैन के साथ दाम</strong> चुनें)। सारे दाम भरते ही कुल दिखता है।</>,
    <><strong>बिक्री किसके नाम</strong> एक बार चुनें → <strong>बिल सेव करें · ₹कुल</strong>। हर आइटम अपनी अलग बिक्री बनता है; <strong>बिल हटाएँ</strong> बिना सेव वाला सब हटा देता है।</>,
  ],
  exchange: [
    <><strong>एक्सचेंज</strong> टैब → ग्राहक जो आइटम वापस लाया उसे स्कैन करें → वह बिक्री चुनें जिससे यह आया था।</>,
    <>नया आइटम स्कैन करें → दाम जाँचें → ऐप दिखाएगा <em>ग्राहक देगा ₹…</em> या <em>ग्राहक को लौटाएँ ₹…</em>।</>,
    <><strong>एक्सचेंज पक्का करें</strong> दबाएँ। लौटाया पीस अपने आप स्टॉक में वापस चला जाता है।</>,
  ],
  catalogIntro: (
    <>
      मालिक यह आपके लिए <em>स्टाफ़ और अधिकार</em> में चालू करते हैं (अधिकार: <strong>कैटलॉग</strong>)। फिर <strong>कैटलॉग → पुराने स्टॉक पर टैग लगाएँ</strong> खोलें।
    </>
  ),
  tagOne: [
    <>आइटम पर पहले से <strong>कंपनी का बारकोड</strong> है? पहले <strong>टैग का बारकोड स्कैन करें</strong> दबाएँ — ऐप वही इस्तेमाल करेगा (नया स्टिकर नहीं) या बता देगा कि आइटम पहले से ऐप में है।</>,
    <>आइटम की <strong>📷 फ़ोटो खींचें</strong> (1–4 फ़ोटो)। अच्छी रोशनी, सादा बैकग्राउंड, पूरा आइटम दिखे।</>,
    <><strong>कैटेगरी</strong> चुनें, <strong>नाम</strong> लिखें (जैसे &ldquo;Phulkari Dupatta&rdquo;), चाहें तो <strong>किसके लिए</strong> (लड़कियाँ / लड़के / दोनों) और <strong>उम्र</strong> (बड़े / बच्चे) चुनें, <strong>साइज़</strong> पर टैप करें।</>,
    <><strong>MRP</strong>, <strong>बिक्री दाम</strong> (खाली छोड़ें = MRP) और <strong>गिने हुए पीस</strong> डालें।</>,
    <><strong>सेव करें और बारकोड पाएँ</strong> दबाएँ। लेबल दिख जाएगा।</>,
    <><strong>अगला आइटम →</strong> दबाएँ। अगले आइटम के लिए कैटेगरी, कंपनी और साइज़ भरे रहते हैं।</>,
    <>आखिर में: <strong>आज के लेबल प्रिंट करें</strong> → हर पीस का एक लेबल → हर पीस पर एक चिपकाएँ। स्टिकर प्रिंटर है? प्रिंट से पहले <strong>स्टिकर प्रिंटर 50×25 mm</strong> चुनें।</>,
  ],
  more: [
    <><strong>कंपनी से आया नया माल</strong> → होम → <strong>नया स्टॉक जोड़ें</strong> (या स्टॉक जोड़ें → <strong>नया आइटम</strong>): <strong>कलेक्शन</strong> चुनें, फिर <strong>क्या है</strong>; <strong>कंपनी</strong>, <strong>प्रोडक्ट का नाम</strong>, <strong>खरीद दाम</strong> और <strong>बिक्री दाम</strong> भरें (<strong>%</strong> से निकालें); <strong>साइज़ और बाकी</strong> खोलकर साइज़ दबाएँ और उनके पीस लिखें; फिर <strong>सेव करें और टैग प्रिंट करें</strong> (या उसी बिल के लिए <strong>सेव करें और अगला जोड़ें</strong>)।</>,
    <><strong>जो आइटम पहले से हैं, उनके और पीस</strong> → स्टॉक जोड़ें → पहले से मौजूद आइटम के और पीस (<em>स्टॉक</em> अधिकार चाहिए)। वही टैग फिर स्कैन करने पर एक पीस और जुड़ता है। या आइटम खोलें → साइज़ के पास <strong>+ जोड़ें</strong>।</>,
    <><strong>प्रोडक्ट बदलें</strong> → प्रोडक्ट → उस पर टैप करें: साइज़ के पास <strong>+ जोड़ें</strong> से पीस, गिनती के बाद पीस ठीक करने को साइज़ पर टैप करें, और नाम, कंपनी, कैटेगरी, दाम के लिए <strong>✎ जानकारी बदलें</strong>। ऊपर <strong>फ़ोटो</strong> वाले बॉक्स पर टैप करें: प्रोडक्ट की एक फ़ोटो जोड़ें, बदलें या हटाएँ — हर साइज़ पर वही दिखती है।</>,
    <><strong>क्या ठीक करना बाकी है?</strong> → कैटलॉग → <strong>ध्यान दें</strong>: बिना फ़ोटो, कंपनी या स्टॉक वाले आइटम।</>,
  ],
  owner: [
    <><strong>कंपनियाँ</strong>: होम → <strong>कंपनियाँ</strong> वाली लाइन → खोजें और कंपनी खोलें: किसी भी समय के उसके बिल, खरीद, <strong>अभी बकाया</strong> और पीस। पैसे दिए? <strong>भुगतान → भुगतान दर्ज करें</strong>। <strong>यह कंपनी हटाएँ</strong> करने पर भी उसके आइटम और बिल बने रहते हैं।</>,
    <><strong>बिल</strong>: होम → <strong>बिल</strong> → <strong>+ नया बिल</strong> (या प्रोडक्ट पर <strong>🧾 बिल बनाएँ</strong>): कंपनी ज़रूरी नहीं; हर प्रोडक्ट के साइज़ दबाएँ या उसके टैग <strong>स्कैन</strong> करें; <strong>मात्रा</strong> और <strong>खरीद ₹</strong> कागज़ के बिल से मिलाएँ → <strong>आगे: बिल जाँचें</strong> → बिल नंबर और तारीख → <strong>बिल सेव करें</strong>। पैसे देने पर <strong>चुकता करें</strong>।</>,
    <><strong>कलेक्शन और कैटेगरी</strong>: होम → <strong>कलेक्शन</strong> से कैटेगरी खुलती है: हर कलेक्शन उसके प्रोडक्ट के साथ, उसके आँकड़े (कैटेगरी, प्रोडक्ट, पीस, स्टॉक की कीमत), और हर कैटेगरी पर <strong>✎</strong> (नाम, कोड, साइज़) और <strong>🗑</strong> (सिर्फ़ जब उसमें कोई आइटम न हो)। पुरुष, महिला, जीन्स, जैकेट और शर्ट हमेशा रहते हैं (🔒)। <strong>+ कैटेगरी जोड़ें</strong>, <strong>+ कलेक्शन जोड़ें</strong>।</>,
    <><strong>स्टाफ़ और अधिकार</strong>: हर व्यक्ति को PIN के साथ जोड़ें। हर सेल्समैन के लिए और अधिकार टिक करें: <em>कैटलॉग</em> (प्रोडक्ट, फ़ोटो, लेबल), <em>दाम</em> (MRP/बिक्री दाम बदलना), <em>स्टॉक</em> (स्टॉक प्राप्त करना), <em>खरीद दाम</em> (कोड दाम देखना — सिर्फ़ भरोसेमंद स्टाफ़)। जो चला गया उसे <strong>हटाएँ</strong>; उसकी पुरानी बिक्री बनी रहती है।</>,
    <><strong>कोड दाम</strong>: सेटिंग → 10 अक्षरों का एक शब्द चुनें; फिर लेबल पर खरीद दाम ऐसे अक्षरों में दिखेगा जो सिर्फ़ आपका स्टाफ़ पढ़ सके।</>,
    <><strong>दाम</strong>: प्रोडक्ट खोलें → <strong>✎ जानकारी बदलें</strong> → MRP, बिक्री, खरीद: हर साइज़ के लिए एक दाम (<em>साइज़ के हिसाब से</em> लिखा बॉक्स खाली छोड़ें तो हर साइज़ का अपना दाम रहता है)। नए आइटम में बिक्री दाम के पास <strong>%</strong> दाम निकालता है। पुरानी बिक्री के दाम नहीं बदलते।</>,
    <><strong>नज़र रखें</strong>: होम पर आज की बिक्री और आपकी मंज़ूरी के लिए बाकी एंट्री दिखती हैं; रिपोर्ट में महीना, मुनाफ़ा और हर सेल्समैन; गतिविधि में हर बिक्री और एक्सचेंज की सूची है।</>,
    <><strong>रिपोर्ट</strong>: सबसे ज़्यादा बिकने वाले, जो नहीं बिक रहा, किसी भी समय की कैटेगरी / कंपनी / सेल्समैन के हिसाब से बिक्री, और अकाउंटेंट के लिए <strong>CSV डाउनलोड</strong> (बिक्री, स्टॉक)।</>,
  ],
  plan: [
    <><strong>एक-एक शेल्फ़</strong> करके चलें (एक बार में एक कैटेगरी) — ऐप अगले आइटम के लिए कैटेगरी याद रखता है।</>,
    <>एक डिज़ाइन और साइज़ के पीस एक साथ गिनें, और उन्हें उसी गिनती के साथ एक आइटम के रूप में टैग करें।</>,
    <>हर बार काम के आखिर में <strong>आज के लेबल</strong> प्रिंट करें और उसी दिन चिपकाएँ, ताकि कुछ गड़बड़ न हो।</>,
    <>हर आइटम पर लेबल एक ही जगह लगाएँ (जैसे दाम वाले टैग पर या कॉलर के अंदर)।</>,
    <>कैटलॉग वाले दो लोग एक साथ अलग-अलग शेल्फ़ पर काम कर सकते हैं।</>,
  ],
  habits: [
    <>बिक्री दर्ज करने से पहले काउंटर पर हमेशा फ़ोटो मिलाएँ।</>,
    <>एक डिज़ाइन का एक ही नाम रखें (&ldquo;Cotton Straight Kurta&rdquo;), ताकि उसके साइज़ एक साथ रहें।</>,
    <><em>खरीद दाम</em> का अधिकार सिर्फ़ उन्हें दें जिन पर मालिक को पूरा भरोसा हो।</>,
    <>फ़ोन से प्रिंट: लेबल पेज खोलें → प्रिंट करें → अपना प्रिंटर या &ldquo;Save as PDF&rdquo; चुनें।</>,
  ],
};

export default async function HelpPage() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const hi = locale === 'hi';
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('help.title')}</h1>
        <p className={`text-sm ${muted}`}>
          {t('help.intro')}{' '}
          <Link href="/guide" className={link}>
            {t('help.intro.guide')}
          </Link>{' '}
          {t('help.intro.end')}
        </p>
      </div>

      <nav aria-label={t('help.sections')} className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ['#start', 'help.nav.start'],
            ['#sell', 'help.nav.sell'],
            ['#catalog', 'help.nav.catalog'],
            ['#owner', 'help.nav.owner'],
            ['#required', 'help.nav.required'],
            ['#tips', 'help.nav.tips'],
            ['#faq', 'help.nav.faq'],
          ] as const
        ).map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-zinc-300 px-3 py-1 dark:border-zinc-700">
            {t(label)}
          </a>
        ))}
      </nav>

      <Section id="start" title={t('help.start.title')} intro={t('help.start.intro')} open>
        <Steps
          items={
            hi
              ? HI.start
              : [
                  <>Open the app on your phone and tap <strong>your name</strong>, then type your <strong>PIN</strong> (the owner gives it to you).</>,
                  <>Add it to your home screen: in Chrome tap ⋮ → <em>Add to Home screen</em>; on iPhone tap Share → <em>Add to Home Screen</em>. It then opens like an app.</>,
                  <>Use the tabs at the bottom: <strong>Sell</strong> (scan and sell), <strong>Exchange</strong>, <strong>My sales</strong>. If the owner gave you catalog work you also see <strong>Catalog</strong>.</>,
                  <>To scan, tap <strong>Scan with camera</strong> and allow the camera once. Hold the barcode flat inside the green box, 15–20 cm away.</>,
                  <>Done for the day? Tap <strong>⋯</strong> at the top right, then <strong>Log out</strong>, especially on a shared phone.</>,
                ]
          }
        />
        <Tip>{t('help.start.tip')}</Tip>
      </Section>

      <Section id="sell" title={t('help.sell.title')} intro={t('help.sell.intro')}>
        <h3 className="font-semibold">{t('help.sell.sellItem')}</h3>
        <Steps
          items={
            hi
              ? HI.sell
              : [
                  <>Tab <strong>Sell</strong> → scan the tag (camera or USB/Bluetooth scanner) or type the code under the barcode.</>,
                  <>Check the photo and size match the item in your hand.</>,
                  <>Tap <strong>Sell this item</strong>, set quantity and the price agreed with the customer (up to MRP).</>,
                  <>Selling for a colleague? Choose them in <strong>Credit sale to</strong>. It is recorded that you entered it.</>,
                  <>Tap <strong>Record sale</strong>. Stock goes down straight away on every phone.</>,
                ]
          }
        />
        <h3 className="font-semibold">{t('help.sell.bill')}</h3>
        <Steps
          items={
            hi
              ? HI.bill
              : [
                  <>Scan the first tag → <strong>Add more items</strong>. It goes on the bill; if you used the camera, the camera opens again.</>,
                  <>Scan each next tag (the same tag again = one more piece), then <strong>Done</strong>.</>,
                  <>Type each item&apos;s agreed price (or choose <strong>Price as I scan</strong>). The total shows once every price is in.</>,
                  <>Pick <strong>Credit sale to</strong> once → <strong>Save bill · ₹total</strong>. Each item is saved as its own sale; <strong>Clear bill</strong> drops everything not saved.</>,
                ]
          }
        />
        <h3 className="font-semibold">{t('help.sell.exchange')}</h3>
        <Steps
          items={
            hi
              ? HI.exchange
              : [
                  <>Tab <strong>Exchange</strong> → scan the item the customer brought back → choose the sale it came from.</>,
                  <>Scan the new item → check the price → the app shows <em>Customer pays ₹…</em> or <em>Give back ₹…</em>.</>,
                  <>Tap <strong>Confirm exchange</strong>. The returned piece goes back into stock automatically.</>,
                ]
          }
        />
        <Tip>{t('help.sell.tip')}</Tip>
      </Section>

      <Section id="catalog" title={t('help.catalog.title')} intro={t('help.catalog.intro')}>
        <p>
          {hi ? (
            HI.catalogIntro
          ) : (
            <>
              The owner turns this on for you in <em>Staff & permissions</em> (right: <strong>Catalog</strong>). Then open <strong>Catalog → Tag old stock</strong>.
            </>
          )}
        </p>
        <h3 className="font-semibold">{t('help.catalog.tagOne')}</h3>
        <Steps
          items={
            hi
              ? HI.tagOne
              : [
                  <>Item already has a <strong>barcode from the company</strong>? Tap <strong>Scan the tag&apos;s barcode</strong> first — the app uses it (no new sticker) or tells you if the item is already in the app.</>,
                  <><strong>📷 Take photo</strong> of the item (1–4 photos). Good light, plain background, whole item visible.</>,
                  <>Choose the <strong>category</strong>, type the <strong>name</strong> (e.g. &ldquo;Phulkari Dupatta&rdquo;), tap who it is for if you like (<strong>For</strong>: Girls / Boys / Both, <strong>Age</strong>: Adult / Child), tap a <strong>size</strong>.</>,
                  <>Enter <strong>MRP</strong>, the <strong>selling price</strong> (leave empty = MRP) and <strong>pieces counted</strong>.</>,
                  <>Tap <strong>Save and get barcode</strong>. The label appears.</>,
                  <>Tap <strong>Next item →</strong>. Category, company and size stay filled in for the next one.</>,
                  <>At the end: <strong>Print today&apos;s labels</strong> → one label per piece → stick one on each piece. Using a sticker printer? Choose <strong>Sticker printer 50×25 mm</strong> before printing.</>,
                ]
          }
        />
        <Tip>
          {t('help.catalog.tip')}{' '}
          <Link href="/admin/stock/new" className={link}>
            {t('help.catalog.tipLink')}
          </Link>
          {t('help.catalog.tipEnd')}
        </Tip>
        <h3 className="font-semibold">{t('help.catalog.more')}</h3>
        <ul className="list-disc pl-5">
          {hi ? (
            HI.more.map((item, i) => <li key={i}>{item}</li>)
          ) : (
            <>
              <li><strong>New stock from a company</strong> → Home → <strong>Add new stock</strong> (or Add stock → <strong>New item</strong>): pick the <strong>collection</strong>, then <strong>what it is</strong>; fill <strong>Company</strong>, <strong>Product name</strong>, <strong>Purchase price</strong> and <strong>Sale price</strong> (<strong>%</strong> works it out); open <strong>Sizes &amp; more</strong> to tap the sizes and set their pieces; then <strong>Save &amp; print tags</strong> (or <strong>Save &amp; add next</strong> for the same bill).</li>
              <li><strong>More pieces of items you already have</strong> → Add stock → More pieces of an existing item (needs the <em>Stock</em> right). Scanning the same tag again adds one more piece. Or open the item → <strong>+ Add</strong> next to its size.</li>
              <li><strong>Change a product</strong> → Products → tap it: <strong>+ Add</strong> pieces to a size, tap a size to correct its pieces after a count, and <strong>✎ Edit details</strong> for the name, company, category and prices. Tap the <strong>photo</strong> box at the top to add, change or remove the product&apos;s one photo — every size shows it.</li>
              <li><strong>What&apos;s left to fix?</strong> → Catalog → <strong>Needs attention</strong>: items without photo, company or stock.</li>
            </>
          )}
        </ul>
      </Section>

      <Section id="owner" title={t('help.owner.title')} intro={t('help.owner.intro')}>
        <Steps
          items={
            hi
              ? HI.owner
              : [
                  <><strong>Companies</strong>: Home → the <strong>Companies</strong> line → search and open a company: its bills, purchases, <strong>dues now</strong> and pieces for any period. Paid them? <strong>Payments → Record a payment</strong>. <strong>Delete this company</strong> keeps its items and bills.</>,
                  <><strong>Bills</strong>: Home → <strong>Bills</strong> → <strong>+ New bill</strong> (or <strong>🧾 Make bill</strong> on a product): the company is optional; tap each product&apos;s sizes or <strong>Scan</strong> its tags; match <strong>Qty</strong> and <strong>Purchase ₹</strong> to the paper bill → <strong>Next: check bill</strong> → bill no. and date → <strong>Save bill</strong>. <strong>Mark paid</strong> when you pay it.</>,
                  <><strong>Collections & categories</strong>: Home → <strong>Collections</strong> opens Categories: each collection with its products, its figures (categories, products, pieces, stock value), and every category with <strong>✎</strong> (name, code, sizes) and <strong>🗑</strong> (only when it has no items). Men, Women, Jeans, Jacket and Shirt always stay (🔒). <strong>+ Add category</strong>, <strong>+ Add collection</strong>.</>,
                  <><strong>Staff & permissions</strong>: add each person with a PIN. Tick extra rights per salesman: <em>Catalog</em> (products, photos, labels), <em>Prices</em> (change MRP/selling price), <em>Stock</em> (receive stock), <em>Purchase price</em> (see the code price — trusted staff only). <strong>Remove</strong> someone who left; their past sales stay.</>,
                  <><strong>Code price</strong>: Settings → choose a 10-letter word; labels then show the purchase price in letters only your staff can read.</>,
                  <><strong>Prices</strong>: open a product → <strong>✎ Edit details</strong> → MRP, Selling, Purchase: one price for every size (a box marked <em>By size</em> left empty keeps each size&apos;s own price). In New item, <strong>%</strong> beside the sale price works it out. Past sales keep their prices.</>,
                  <><strong>Track</strong>: Home shows today&apos;s sales and what is waiting for you; Reports has the month, profit and each salesperson; Activity lists every sale and exchange.</>,
                  <><strong>Reports</strong>: best sellers, what is not selling, sales by category / company / salesperson for any period, and <strong>CSV downloads</strong> (sales, stock) for your accountant.</>,
                ]
          }
        />
      </Section>

      <Section id="required" title={t('help.req.title')} intro={t('help.req.intro')}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={muted}>
              <tr>
                <th className="py-1 pr-3 font-medium">{t('help.req.when')}</th>
                <th className="py-1 pr-3 font-medium">{t('help.req.required')}</th>
                <th className="py-1 font-medium">{t('help.req.optional')}</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-3">{t('help.req.oldStock')}</td>
                <td className="py-2 pr-3">{t('help.req.oldStock.required')}</td>
                <td className="py-2">{t('help.req.oldStock.optional')}</td>
              </tr>
              <tr className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-3">{t('help.req.newItem')}</td>
                <td className="py-2 pr-3">{t('help.req.newItem.required')}</td>
                <td className="py-2">{t('help.req.newItem.optional')}</td>
              </tr>
              <tr className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-3">{t('help.req.sale')}</td>
                <td className="py-2 pr-3">{t('help.req.sale.required')}</td>
                <td className="py-2">{t('help.req.sale.optional')}</td>
              </tr>
              <tr className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-3">{t('help.req.company')}</td>
                <td className="py-2 pr-3">{t('help.req.company.required')}</td>
                <td className="py-2">{t('help.req.company.optional')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="tips" title={t('help.tips.title')} intro={t('help.tips.intro')}>
        <h3 className="font-semibold">{t('help.tips.plan')}</h3>
        <Steps
          items={
            hi
              ? HI.plan
              : [
                  <>Go <strong>shelf by shelf</strong> (one category at a time) — the app keeps the category for the next item.</>,
                  <>Count the pieces of one design and size together, tag them as one item with that count.</>,
                  <>Print <strong>today&apos;s labels</strong> at the end of each session and stick them the same day, so nothing is mixed up.</>,
                  <>Put labels in the same place on every item (e.g. on the price tag or inside the collar).</>,
                  <>Two catalog people can work at the same time on different shelves.</>,
                ]
          }
        />
        <h3 className="font-semibold">{t('help.tips.habits')}</h3>
        <ul className="list-disc pl-5">
          {hi ? (
            HI.habits.map((item, i) => <li key={i}>{item}</li>)
          ) : (
            <>
              <li>Always check the photo at the counter before recording a sale.</li>
              <li>Use one name for one design (&ldquo;Cotton Straight Kurta&rdquo;), so its sizes group together.</li>
              <li>Give the <em>Purchase price</em> right only to people the owner fully trusts.</li>
              <li>Printing from a phone: open the labels page → Print → choose your printer or &ldquo;Save as PDF&rdquo;.</li>
            </>
          )}
        </ul>
      </Section>

      <Section id="faq" title={t('help.faq.title')} intro={t('help.faq.intro')}>
        <dl className="flex flex-col gap-3">
          {(
            [
              ['help.faq.camera', 'help.faq.camera.fix'],
              ['help.faq.read', 'help.faq.read.fix'],
              ['help.faq.notFound', 'help.faq.notFound.fix'],
              ['help.faq.onlyLeft', 'help.faq.onlyLeft.fix'],
              ['help.faq.noRight', 'help.faq.noRight.fix'],
              ['help.faq.pin', 'help.faq.pin.fix'],
              ['help.faq.photo', 'help.faq.photo.fix'],
            ] as const
          ).map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold">{t(q)}</dt>
              <dd className={muted}>{t(a)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <p className={`text-center text-xs ${muted}`}>
        {t('help.stillStuck')} <Link href="/pos" className={link}>{t('help.backToSelling')}</Link>
      </p>
      <h2 className={`${sectionTitle} sr-only`}>{t('help.end')}</h2>
    </main>
  );
}
