/**
 * The Guide as short stories (plan v10): each lesson is 2–5 steps; each step is
 * a few words on screen (`text`, **bold** marks the button to press), a fuller
 * friendly line for the voice (`say`), and an animated phone scene (`scene`).
 * Both languages live side by side so they never drift apart.
 */
import type { Locale } from '@/lib/i18n';

export type L = Record<Locale, string>;
export type Audience = 'everyone' | 'sellers' | 'stock' | 'owner';
export const AUDIENCES: Audience[] = ['everyone', 'sellers', 'stock', 'owner'];

export type TagPart = 'qr' | 'size' | 'sizes' | 'name' | 'code' | 'barcode' | 'mrp' | 'hole';

/** What the little phone shows, and where the finger taps. */
export type Scene =
  | { kind: 'names' }
  | { kind: 'keypad' }
  | { kind: 'dock' }
  | { kind: 'header'; tap: 'lang' | 'menu' }
  | { kind: 'swatches' }
  | { kind: 'daynight' }
  | { kind: 'tag'; part: TagPart }
  | { kind: 'scan'; qr?: boolean; label?: L }
  | { kind: 'card'; button: L }
  | { kind: 'field'; label: L; value: string; note?: L }
  | { kind: 'done'; title: L; amount: string }
  | { kind: 'chips'; label: L; chips: string[]; swatches?: boolean }
  | { kind: 'print' }
  | { kind: 'photo' }
  | { kind: 'edit' }
  | { kind: 'count' }
  | { kind: 'buttons'; items: L[]; tap: number }
  | { kind: 'toggles' }
  | { kind: 'bars' }
  | { kind: 'columns' }
  | { kind: 'list' }
  // 2026-11-23 (ADR-067): the screens since ADR-040 — tiles, the four boxes, figures, rows, a bill.
  /** Collection / category tiles; 🔒 on fixed ones (Men, Women). */
  | { kind: 'tiles'; items: { name: L; note?: L; lock?: boolean }[]; tap: number }
  /** New item's four boxes (Company · Product name · Purchase · Sale, ₹ inside); `tap` is typed in. */
  | { kind: 'boxes'; boxes: { label: L; value: string; rupee?: boolean }[]; tap: number; calc?: boolean }
  /** Figure boxes on top of a page (item, company, collection). */
  | { kind: 'figures'; items: { label: L; value: string }[] }
  /** List rows with ✎ / 🗑 (or a 🔒); the finger taps `tap` on row `at`. */
  | { kind: 'rows'; items: { name: string; note: L; lock?: boolean }[]; at: number; tap: 'edit' | 'delete' }
  /** A bill as a table, the item in the first column; the "Total" row comes last (`total` = its cells after the word Total). */
  | { kind: 'bill'; head: L[]; rows: string[][]; total: string[] };

export type StoryStep = { text: L; say: L; scene: Scene };
export type Story = {
  id: string;
  audience: Audience;
  title: L;
  /** What you get, in a few words. */
  goal: L;
  steps: StoryStep[];
  tip?: L;
  open?: { href: string; label: L };
  /** Ends with "Practice a sale" (nothing saved). */
  practice?: boolean;
};

export function pick(text: L, locale: Locale): string {
  return text[locale] ?? text.en;
}

const SELL_THIS: L = { en: 'Sell this item', hi: 'यह आइटम बेचें' };

export const STORIES: Story[] = [
  // ——— Everyone ———
  {
    id: 'start',
    audience: 'everyone',
    title: { en: 'Log in', hi: 'लॉग इन' },
    goal: { en: 'Your name, your PIN — you’re in.', hi: 'आपका नाम, आपका PIN — आप अंदर।' },
    steps: [
      {
        scene: { kind: 'names' },
        text: { en: 'Tap **your name**', hi: '**अपने नाम** पर टैप करें' },
        say: { en: 'Tap the circle with your name.', hi: 'अपने नाम वाले गोले पर टैप करें।' },
      },
      {
        scene: { kind: 'keypad' },
        text: { en: 'Enter your **PIN**', hi: 'अपना **PIN** डालें' },
        say: { en: 'Type your PIN on the number keys, then tap Log in.', hi: 'अंक बटनों से अपना PIN डालें, फिर लॉग इन करें दबाएँ।' },
      },
      {
        scene: { kind: 'dock' },
        text: { en: 'Round button = **Sell**', hi: 'गोल बटन = **बेचें**' },
        say: { en: 'The big round button at the bottom opens the counter from anywhere.', hi: 'नीचे का बड़ा गोल बटन कहीं से भी काउंटर खोलता है।' },
      },
      {
        scene: { kind: 'header', tap: 'menu' },
        text: { en: 'Finished? **⋯** → Log out', hi: 'काम खत्म? **⋯** → लॉग आउट' },
        say: { en: 'On a shared phone, tap the three dots at the top right, then Log out.', hi: 'साझा फ़ोन पर ऊपर दाईं ओर तीन बिंदु दबाएँ, फिर लॉग आउट।' },
      },
    ],
    tip: { en: 'Chrome ⋮ → Add to Home screen: it opens like an app.', hi: 'Chrome ⋮ → Add to Home screen: यह ऐप की तरह खुलेगा।' },
    open: { href: '/pos', label: { en: 'Open Sell', hi: 'बेचें खोलें' } },
  },
  {
    id: 'look',
    audience: 'everyone',
    title: { en: 'Language and colours', hi: 'भाषा और रंग' },
    goal: { en: 'Make the app yours.', hi: 'ऐप को अपना बनाएँ।' },
    steps: [
      {
        scene: { kind: 'header', tap: 'lang' },
        text: { en: 'Tap **अ / A** at the top', hi: 'ऊपर **अ / A** दबाएँ' },
        say: {
          en: 'Tap the letter at the top to switch between Hindi and English. Your choice is remembered.',
          hi: 'ऊपर अ या A वाला बटन दबाकर हिन्दी और अंग्रेज़ी बदलें। आपकी पसंद याद रहती है।',
        },
      },
      {
        scene: { kind: 'swatches' },
        text: { en: '**⋯** → pick a colour', hi: '**⋯** → रंग चुनें' },
        say: { en: 'Tap the three dots at the top and pick a colour you like.', hi: 'ऊपर तीन बिंदु वाला बटन दबाएँ और अपनी पसंद का रंग चुनें।' },
      },
      {
        scene: { kind: 'daynight' },
        text: { en: '**Night** for the evening', hi: 'शाम को **रात**' },
        say: { en: 'Choose Night for a dark screen in the evening, or Day.', hi: 'शाम को गहरी स्क्रीन के लिए रात चुनें, दिन में दिन।' },
      },
      {
        scene: { kind: 'header', tap: 'menu' },
        text: { en: '**⋯** → Sound on or off', hi: '**⋯** → आवाज़ चालू या बंद' },
        say: { en: 'In the three-dot menu, Sound turns the scan sounds on or off.', hi: 'तीन बिंदु वाले मेनू में आवाज़ से स्कैन की आवाज़ चालू या बंद होती है।' },
      },
    ],
  },
  {
    id: 'tag',
    audience: 'everyone',
    title: { en: 'Read a tag', hi: 'टैग पढ़ें' },
    goal: { en: 'Every part has a job.', hi: 'हर हिस्से का एक काम है।' },
    steps: [
      {
        scene: { kind: 'tag', part: 'qr' },
        text: { en: '**QR** opens the item', hi: '**QR** आइटम खोलता है' },
        say: { en: 'Any phone camera on the QR code opens this item in the app.', hi: 'किसी भी फ़ोन का कैमरा QR कोड पर रखें, यह आइटम ऐप में खुल जाएगा।' },
      },
      {
        scene: { kind: 'tag', part: 'size' },
        text: { en: 'The **size**, printed big', hi: '**साइज़**, बड़ा छपा' },
        say: { en: 'The size is printed big at the top.', hi: 'साइज़ ऊपर बड़ा छपा है।' },
      },
      {
        scene: { kind: 'tag', part: 'sizes' },
        text: { en: 'All sizes — **tick by pen**', hi: 'सारे साइज़ — **पेन से टिक**' },
        say: { en: 'All sizes of the category. This piece’s size is filled in; you can tick another by pen.', hi: 'कैटेगरी के सारे साइज़। इस पीस वाला भरा है; दूसरा पेन से टिक कर सकते हैं।' },
      },
      {
        scene: { kind: 'tag', part: 'barcode' },
        text: { en: '**Barcode** — scan to sell', hi: '**बारकोड** — स्कैन करके बेचें' },
        say: { en: 'Scan the barcode to sell. You can also type the number under it.', hi: 'बेचने के लिए बारकोड स्कैन करें। नीचे का नंबर टाइप भी कर सकते हैं।' },
      },
      {
        scene: { kind: 'tag', part: 'mrp' },
        text: { en: '**MRP** — the highest price', hi: '**MRP** — सबसे ऊँचा दाम' },
        say: { en: 'MRP is the highest price. Sell for less if you agree, never for more.', hi: 'MRP सबसे ऊँचा दाम है। तय हो तो कम में बेचें, ज़्यादा में कभी नहीं।' },
      },
    ],
  },

  // ——— Selling ———
  {
    id: 'sell',
    audience: 'sellers',
    title: { en: 'Sell an item', hi: 'आइटम बेचें' },
    goal: { en: 'Scan, price, record.', hi: 'स्कैन, दाम, दर्ज।' },
    practice: true,
    steps: [
      {
        scene: { kind: 'scan' },
        text: { en: '**Scan** the tag', hi: 'टैग **स्कैन** करें' },
        say: { en: 'Tap Sell, then Scan with camera, and hold the tag in the box. You hear a ting.', hi: 'बेचें दबाएँ, फिर कैमरा से स्कैन करें, और टैग को डिब्बे में रखें। टिंग की आवाज़ आएगी।' },
      },
      {
        scene: { kind: 'card', button: SELL_THIS },
        text: { en: 'Check **photo and size**', hi: '**फ़ोटो और साइज़** मिलाएँ' },
        say: { en: 'Check the photo and size match the piece. Then tap Sell this item.', hi: 'फ़ोटो और साइज़ पीस से मिलाएँ। फिर यह आइटम बेचें दबाएँ।' },
      },
      {
        scene: { kind: 'field', label: { en: 'Sale price (₹)', hi: 'बिक्री दाम (₹)' }, value: '1299', note: { en: 'MRP ₹1,499', hi: 'MRP ₹1,499' } },
        text: { en: 'Type the **agreed price**', hi: '**तय दाम** लिखें' },
        say: { en: 'Type the price you agreed with the customer. It can never be above MRP.', hi: 'ग्राहक से तय हुआ दाम लिखें। यह MRP से ज़्यादा कभी नहीं हो सकता।' },
      },
      {
        scene: { kind: 'done', title: { en: 'Sale done', hi: 'बिक्री हो गई' }, amount: '₹1,299' },
        text: { en: '**Record sale** ✓', hi: '**बिक्री दर्ज करें** ✓' },
        say: { en: 'Tap Record sale. Done! Stock goes down on every phone.', hi: 'बिक्री दर्ज करें दबाएँ। हो गया! स्टॉक हर फ़ोन पर घट जाता है।' },
      },
      {
        scene: { kind: 'buttons', items: [{ en: 'Enter by hand', hi: 'हाथ से दर्ज करें' }], tap: 0 },
        text: { en: "Tag won't scan? **Enter by hand**", hi: 'टैग नहीं पढ़ा? **हाथ से दर्ज करें**' },
        say: { en: 'If the tag will not scan, tap Enter by hand: type the item and the price. The owner checks it later.', hi: 'टैग स्कैन न हो तो हाथ से दर्ज करें दबाएँ: आइटम और दाम लिखें। मालिक बाद में जाँचेंगे।' },
      },
    ],
    tip: { en: 'Selling for a colleague? Choose them in “Credit sale to”.', hi: 'साथी के लिए बेच रहे हैं? “बिक्री किसके नाम” में उन्हें चुनें।' },
    open: { href: '/pos', label: { en: 'Open Sell', hi: 'बेचें खोलें' } },
  },
  {
    // ADR-040: several items for one customer go on one bill at the counter.
    id: 'bill',
    audience: 'sellers',
    title: { en: 'Many items, one bill', hi: 'कई आइटम, एक बिल' },
    goal: { en: 'Scan them all, save once.', hi: 'सब स्कैन करें, एक बार सेव करें।' },
    steps: [
      {
        scene: { kind: 'card', button: { en: 'Add more items', hi: 'और आइटम जोड़ें' } },
        text: { en: 'Scan, then **Add more items**', hi: 'स्कैन करें, फिर **और आइटम जोड़ें**' },
        say: {
          en: 'Scan the first tag and tap Add more items. It goes on the bill, and the camera opens again.',
          hi: 'पहला टैग स्कैन करें और और आइटम जोड़ें दबाएँ। आइटम बिल पर जाता है और कैमरा फिर खुलता है।',
        },
      },
      {
        scene: { kind: 'scan' },
        text: { en: 'Scan **each** next tag', hi: '**हर** अगला टैग स्कैन करें' },
        say: {
          en: 'Scan each next tag. The same tag again adds one more piece. Tap Done when all are in.',
          hi: 'हर अगला टैग स्कैन करें। वही टैग दोबारा एक पीस और जोड़ता है। सब हो जाएँ तो पूरा हुआ दबाएँ।',
        },
      },
      {
        scene: {
          kind: 'bill',
          head: [
            { en: 'Item', hi: 'आइटम' },
            { en: 'MRP', hi: 'MRP' },
            { en: 'Price ₹', hi: 'दाम ₹' },
          ],
          rows: [
            ['Kurta M', '1,499', '1,299'],
            ['Jeans 32', '1,999', '1,700'],
          ],
          total: ['', '₹2,999'],
        },
        text: { en: 'Type each **price**', hi: 'हर **दाम** लिखें' },
        say: {
          en: 'Type the agreed price of each item, or choose Price as I scan. The total shows once every price is in.',
          hi: 'हर आइटम का तय दाम लिखें, या स्कैन के साथ दाम चुनें। सारे दाम भरते ही कुल दिखता है।',
        },
      },
      {
        scene: { kind: 'buttons', items: [{ en: 'Save bill · ₹2,999', hi: 'बिल सेव करें · ₹2,999' }], tap: 0 },
        text: { en: '**Save bill** ✓', hi: '**बिल सेव करें** ✓' },
        say: {
          en: 'Choose Credit sale to once for the whole bill, then tap Save bill. Each item is saved as its own sale.',
          hi: 'पूरे बिल के लिए बिक्री किसके नाम एक बार चुनें, फिर बिल सेव करें दबाएँ। हर आइटम अपनी अलग बिक्री बनता है।',
        },
      },
    ],
    open: { href: '/pos', label: { en: 'Open Sell', hi: 'बेचें खोलें' } },
  },
  {
    // Plan v18: selling without internet.
    id: 'offline',
    audience: 'sellers',
    title: { en: 'No internet', hi: 'इंटरनेट नहीं' },
    goal: { en: 'Keep selling; it is sent later.', hi: 'बेचते रहें; बाद में अपने आप जाएगी।' },
    steps: [
      {
        scene: { kind: 'scan' },
        text: { en: 'No internet? **Still scan**', hi: 'इंटरनेट नहीं? **फिर भी स्कैन करें**' },
        say: {
          en: "No internet? The counter still works. Scan the tag as usual: the item comes from this phone's copy.",
          hi: 'इंटरनेट नहीं है? काउंटर फिर भी चलता है। टैग हमेशा की तरह स्कैन करें: आइटम इस फ़ोन की कॉपी से आएगा।',
        },
      },
      {
        scene: { kind: 'done', title: { en: 'Saved on this phone', hi: 'इस फ़ोन में सेव' }, amount: '₹1,299' },
        text: { en: '**Saved** on this phone', hi: 'इस फ़ोन में **सेव**' },
        say: {
          en: 'Record the sale as usual. It is saved on this phone. Stay logged in on this phone.',
          hi: 'बिक्री हमेशा की तरह दर्ज करें। यह इस फ़ोन में सेव हो जाती है। इसी फ़ोन पर लॉग इन रहें।',
        },
      },
      {
        scene: { kind: 'buttons', items: [{ en: 'Send now', hi: 'अभी भेजें' }], tap: 0 },
        text: { en: 'Internet back: **sent by itself**', hi: 'इंटरनेट आया: **अपने आप गई**' },
        say: {
          en: 'When internet is back, the sales go to the shop by themselves. Or tap the yellow strip, then Send now.',
          hi: 'इंटरनेट आते ही बिक्री अपने आप दुकान को चली जाती है। या पीली पट्टी दबाकर अभी भेजें दबाएँ।',
        },
      },
    ],
    tip: { en: 'Exchange needs internet. Saved sales are sent by the same person.', hi: 'एक्सचेंज को इंटरनेट चाहिए। सेव बिक्री उसी व्यक्ति से जाती है।' },
    open: { href: '/pos', label: { en: 'Open Sell', hi: 'बेचें खोलें' } },
  },
  {
    id: 'qr',
    audience: 'sellers',
    title: { en: 'Open from the QR', hi: 'QR से खोलें' },
    goal: { en: 'Any phone camera works.', hi: 'कोई भी फ़ोन कैमरा चलेगा।' },
    steps: [
      {
        scene: { kind: 'scan', qr: true },
        text: { en: 'Camera on the **QR**', hi: 'कैमरा **QR** पर' },
        say: { en: 'Open the phone camera and point it at the QR code on the tag.', hi: 'फ़ोन का कैमरा खोलें और टैग के QR कोड पर रखें।' },
      },
      {
        scene: { kind: 'card', button: SELL_THIS },
        text: { en: 'Tap the link — **it opens**', hi: 'लिंक दबाएँ — **खुल जाएगा**' },
        say: { en: 'Tap the link. The item opens in the app, ready to sell.', hi: 'लिंक दबाएँ। आइटम ऐप में खुलेगा, बेचने के लिए तैयार।' },
      },
    ],
    tip: { en: 'Customers who scan it only see the login page.', hi: 'ग्राहक स्कैन करें तो उन्हें सिर्फ़ लॉग इन पेज दिखता है।' },
  },
  {
    id: 'exchange',
    audience: 'sellers',
    title: { en: 'Exchange', hi: 'एक्सचेंज' },
    goal: { en: 'Old piece in, new piece out.', hi: 'पुराना पीस अंदर, नया बाहर।' },
    steps: [
      {
        scene: { kind: 'scan', label: { en: 'Returned', hi: 'लौटाया' } },
        text: { en: 'Scan the **returned** piece', hi: '**लौटाया** पीस स्कैन करें' },
        say: { en: 'Tap Exchange and scan the piece the customer brought back. Pick the sale it came from.', hi: 'एक्सचेंज दबाएँ और ग्राहक का लौटाया पीस स्कैन करें। जिस बिक्री से आया, वह चुनें।' },
      },
      {
        scene: { kind: 'scan', label: { en: 'New', hi: 'नया' } },
        text: { en: 'Scan the **new** piece', hi: '**नया** पीस स्कैन करें' },
        say: { en: 'Now scan the new piece the customer is taking.', hi: 'अब ग्राहक जो नया पीस ले रहा है, उसे स्कैन करें।' },
      },
      {
        scene: { kind: 'done', title: { en: 'Exchange done', hi: 'एक्सचेंज हो गया' }, amount: '+₹200' },
        text: { en: '**Confirm exchange** ✓', hi: '**एक्सचेंज पक्का करें** ✓' },
        say: { en: 'The app shows who pays the difference. Tap Confirm exchange. Stock is fixed by itself.', hi: 'ऐप बताता है कि फ़र्क कौन देगा। एक्सचेंज पक्का करें दबाएँ। स्टॉक अपने आप ठीक हो जाता है।' },
      },
    ],
    open: { href: '/pos/exchange', label: { en: 'Open Exchange', hi: 'एक्सचेंज खोलें' } },
  },

  // ——— Stock & tags ———
  {
    id: 'new-design',
    audience: 'stock',
    title: { en: 'New item', hi: 'नया आइटम' },
    goal: { en: 'Collection, prices, sizes — and its barcodes.', hi: 'कलेक्शन, दाम, साइज़ — और उसके बारकोड।' },
    // 2026-11-23 (ADR-067): New item as it is since ADR-064 / 065 — collection, category, four boxes, Sizes & more, save.
    steps: [
      {
        scene: {
          kind: 'tiles',
          items: [
            { name: { en: 'Men', hi: 'पुरुष' }, lock: true },
            { name: { en: 'Women', hi: 'महिला' }, lock: true },
            { name: { en: 'Kids', hi: 'बच्चे' } },
            { name: { en: '+ Add', hi: '+ जोड़ें' } },
          ],
          tap: 0,
        },
        text: { en: '**Add new stock** → pick the collection', hi: '**नया स्टॉक जोड़ें** → कलेक्शन चुनें' },
        say: {
          en: 'On Home, tap Add new stock. Pick the collection, like Men or Women. Men and Women always stay.',
          hi: 'होम पर नया स्टॉक जोड़ें दबाएँ। कलेक्शन चुनें, जैसे पुरुष या महिला। पुरुष और महिला हमेशा रहते हैं।',
        },
      },
      {
        scene: {
          kind: 'tiles',
          items: [
            { name: { en: 'Jeans', hi: 'जीन्स' }, note: { en: '28–36', hi: '28–36' } },
            { name: { en: 'Shirt', hi: 'शर्ट' }, note: { en: 'M–XXL', hi: 'M–XXL' } },
            { name: { en: 'Kurta', hi: 'कुर्ता' }, note: { en: 'M–XXL', hi: 'M–XXL' } },
            { name: { en: '+ Add', hi: '+ जोड़ें' } },
          ],
          tap: 2,
        },
        text: { en: '**What is it?** Tap the category', hi: '**क्या है?** कैटेगरी दबाएँ' },
        say: {
          en: 'Then tap what it is, like Jeans or Kurta. Plus Add makes a new category with its sizes.',
          hi: 'फिर बताएँ कि क्या है, जैसे जीन्स या कुर्ता। जोड़ें से नई कैटेगरी उसके साइज़ के साथ बनती है।',
        },
      },
      {
        scene: {
          kind: 'boxes',
          boxes: [
            { label: { en: 'Company', hi: 'कंपनी' }, value: 'Laxmi' },
            { label: { en: 'Product name', hi: 'प्रोडक्ट का नाम' }, value: 'Kurta' },
            { label: { en: 'Purchase price', hi: 'खरीद दाम' }, value: '700', rupee: true },
            { label: { en: 'Sale price', hi: 'बिक्री दाम' }, value: '1050', rupee: true },
          ],
          tap: 2,
          calc: true,
        },
        text: { en: 'Company, name, **purchase**, sale price', hi: 'कंपनी, नाम, **खरीद**, बिक्री दाम' },
        say: {
          en: 'Fill the four boxes. Type the purchase price; an empty sale price becomes purchase plus 50 percent, or tap the percent button.',
          hi: 'चारों बॉक्स भरें। खरीद दाम लिखें; बिक्री दाम खाली रहे तो खरीद से 50 प्रतिशत ज़्यादा बनता है, या प्रतिशत बटन दबाएँ।',
        },
      },
      {
        scene: { kind: 'chips', label: { en: 'Sizes & more', hi: 'साइज़ और बाकी' }, chips: ['M', 'L', 'XL', 'XXL'] },
        text: { en: '**Sizes & more** → tap each size', hi: '**साइज़ और बाकी** → हर साइज़ दबाएँ' },
        say: {
          en: 'Open Sizes and more, tap each size that came and set its pieces. Every size gets its own barcode.',
          hi: 'साइज़ और बाकी खोलें, जो साइज़ आए उन्हें दबाएँ और उनके पीस लिखें। हर साइज़ को अपना बारकोड मिलता है।',
        },
      },
      {
        scene: { kind: 'print' },
        text: { en: '**Save & print tags**', hi: '**सेव करें और टैग प्रिंट करें**' },
        say: {
          en: 'Check it, then tap Save and print tags. Save and add next goes on with the same bill.',
          hi: 'जाँचें, फिर सेव करें और टैग प्रिंट करें दबाएँ। सेव करें और अगला जोड़ें उसी बिल पर आगे बढ़ता है।',
        },
      },
    ],
    tip: { en: 'The phone’s back button goes one step back.', hi: 'फ़ोन का बैक बटन एक कदम पीछे जाता है।' },
    open: { href: '/admin/stock/new', label: { en: 'New item', hi: 'नया आइटम' } },
  },
  {
    id: 'old-stock',
    audience: 'stock',
    title: { en: 'Tag old stock', hi: 'पुराने स्टॉक पर टैग' },
    goal: { en: 'About 30 seconds an item.', hi: 'हर आइटम लगभग 30 सेकंड।' },
    steps: [
      {
        scene: { kind: 'photo' },
        text: { en: 'Take a **photo**', hi: '**फ़ोटो** खींचें' },
        say: { en: 'Open Tag old stock and take a photo in good light. Has a company barcode? Scan it first.', hi: 'पुराने स्टॉक पर टैग खोलें और अच्छी रोशनी में फ़ोटो खींचें। कंपनी का बारकोड है? पहले उसे स्कैन करें।' },
      },
      {
        scene: { kind: 'field', label: { en: 'MRP (₹)', hi: 'MRP (₹)' }, value: '999' },
        text: { en: 'Name, size, **MRP**, pieces', hi: 'नाम, साइज़, **MRP**, पीस' },
        say: { en: 'Fill in the name, size, colour, MRP and the pieces you counted.', hi: 'नाम, साइज़, रंग, MRP और गिने हुए पीस भरें।' },
      },
      {
        scene: { kind: 'buttons', items: [{ en: 'Save and get barcode', hi: 'सेव करें और बारकोड पाएँ' }], tap: 0 },
        text: { en: '**Save** → barcode', hi: '**सेव** → बारकोड' },
        say: { en: 'Tap Save and get barcode, then Next item. The category stays filled in.', hi: 'सेव करें और बारकोड पाएँ दबाएँ, फिर अगला आइटम। कैटेगरी भरी रहती है।' },
      },
      {
        scene: { kind: 'edit' },
        text: { en: 'Mistake? **Edit this item**', hi: 'गलती? **यह आइटम बदलें**' },
        say: { en: 'Typed something wrong? Tap Edit this item, fix it and save. The barcode stays the same.', hi: 'कुछ गलत लिखा? यह आइटम बदलें दबाएँ, ठीक करें और सेव करें। बारकोड वही रहता है।' },
      },
    ],
    tip: { en: 'Go shelf by shelf, one category at a time.', hi: 'एक-एक शेल्फ़, एक बार में एक कैटेगरी।' },
    open: { href: '/admin/stock/old', label: { en: 'Tag old stock', hi: 'पुराने स्टॉक पर टैग' } },
  },
  {
    id: 'print',
    audience: 'stock',
    title: { en: 'Print tags', hi: 'टैग प्रिंट करें' },
    goal: { en: 'One tag per piece, the same day.', hi: 'हर पीस पर एक टैग, उसी दिन।' },
    steps: [
      {
        scene: {
          kind: 'buttons',
          items: [
            { en: 'Date', hi: 'तारीख' },
            { en: 'Company', hi: 'कंपनी' },
            { en: 'Delivery', hi: 'डिलीवरी' },
          ],
          tap: 1,
        },
        text: { en: '**All tags**: by date or company', hi: '**सारे टैग**: तारीख या कंपनी से' },
        say: {
          en: 'Open All tags. Group them by date, company or delivery, filter them, and print just one group.',
          hi: 'सारे टैग खोलें। तारीख, कंपनी या डिलीवरी से ग्रुप करें, फ़िल्टर लगाएँ, और सिर्फ़ एक ग्रुप प्रिंट करें।',
        },
      },
      {
        scene: {
          kind: 'buttons',
          items: [
            { en: 'Tags on A4', hi: 'A4 पर टैग' },
            { en: 'Tag printer 40×60', hi: 'टैग प्रिंटर 40×60' },
            { en: 'Sticker 50×25', hi: 'स्टिकर 50×25' },
          ],
          tap: 1,
        },
        text: { en: 'Pick **A4** or **tag printer**', hi: '**A4** या **टैग प्रिंटर** चुनें' },
        say: { en: 'Open today’s labels and pick tags on A4, the tag printer, or small stickers.', hi: 'आज के लेबल खोलें और A4 पर टैग, टैग प्रिंटर, या छोटे स्टिकर चुनें।' },
      },
      {
        scene: { kind: 'print' },
        text: { en: 'Tap **Print**', hi: '**प्रिंट** दबाएँ' },
        say: { en: 'Tap Print and choose the printer. You get one tag for each piece.', hi: 'प्रिंट दबाएँ और प्रिंटर चुनें। हर पीस का एक टैग निकलता है।' },
      },
      {
        scene: { kind: 'tag', part: 'hole' },
        text: { en: 'Tie it on the **piece**', hi: 'धागे से **पीस** पर बाँधें' },
        say: { en: 'Tie each tag on its own piece, in the same place every time.', hi: 'हर टैग उसके अपने पीस पर, हर बार एक ही जगह बाँधें।' },
      },
    ],
    open: { href: '/admin/labels/print?mine=today', label: { en: 'Today’s labels', hi: 'आज के लेबल' } },
  },
  {
    id: 'restock',
    audience: 'stock',
    title: { en: 'More pieces arrived', hi: 'और पीस आए' },
    goal: { en: 'Every scan adds one.', hi: 'हर स्कैन एक पीस जोड़ता है।' },
    steps: [
      {
        scene: { kind: 'scan' },
        text: { en: '**Scan** each piece', hi: 'हर पीस **स्कैन** करें' },
        say: { en: 'Open Stock, More pieces of an existing item, and scan each new piece. The same tag again adds one more.', hi: 'मौजूदा आइटम के और पीस खोलें और हर नया पीस स्कैन करें। वही टैग दोबारा स्कैन करें तो एक और जुड़ता है।' },
      },
      {
        scene: { kind: 'count' },
        text: { en: 'The count goes **up**', hi: 'गिनती **बढ़ती** है' },
        say: { en: 'Watch the count go up. You can also search by name and tap plus.', hi: 'गिनती बढ़ती देखें। नाम से खोजकर प्लस भी दबा सकते हैं।' },
      },
      {
        scene: { kind: 'print' },
        text: { en: '**Receive** → print labels', hi: '**प्राप्त करें** → लेबल प्रिंट' },
        say: { en: 'Add the bill number, then tap Receive and print labels.', hi: 'बिल नंबर डालें, फिर प्राप्त करें और लेबल प्रिंट करें दबाएँ।' },
      },
    ],
    open: { href: '/admin/stock/receive', label: { en: 'Receive stock', hi: 'स्टॉक प्राप्त करें' } },
  },
  {
    // ADR-061: the item page — figures, sizes with + Add, ✎ Edit details.
    id: 'item',
    audience: 'stock',
    title: { en: 'The item page', hi: 'आइटम का पेज' },
    goal: { en: 'One product: photo, stock, sizes, details.', hi: 'एक प्रोडक्ट: फ़ोटो, स्टॉक, साइज़, जानकारी।' },
    steps: [
      {
        scene: {
          kind: 'figures',
          items: [
            { label: { en: 'In stock', hi: 'स्टॉक में' }, value: '12' },
            { label: { en: 'Sold', hi: 'बिके' }, value: '5' },
            { label: { en: 'Stock value', hi: 'स्टॉक की कीमत' }, value: '₹8,400' },
          ],
        },
        text: { en: '**Products** → tap a product', hi: '**प्रोडक्ट** → प्रोडक्ट पर टैप करें' },
        say: {
          en: 'Open Products and tap a product. On top: pieces in stock, pieces sold and what the stock is worth.',
          hi: 'प्रोडक्ट खोलें और किसी प्रोडक्ट पर टैप करें। ऊपर: स्टॉक के पीस, बिके पीस और स्टॉक की कीमत।',
        },
      },
      {
        // ADR-068: one photo for every size; tap the box to add or change it.
        scene: { kind: 'photo' },
        text: { en: 'Tap the **photo** box', hi: '**फ़ोटो** वाले बॉक्स पर टैप करें' },
        say: {
          en: 'Tap the photo box at the top to add a photo. One photo shows on every size. Tap it again to change it.',
          hi: 'फ़ोटो जोड़ने के लिए ऊपर फ़ोटो वाले बॉक्स पर टैप करें। एक फ़ोटो हर साइज़ पर दिखती है। बदलने के लिए फिर टैप करें।',
        },
      },
      {
        scene: {
          kind: 'buttons',
          items: [
            { en: '+ Add', hi: '+ जोड़ें' },
            { en: '+ Add size', hi: '+ साइज़ जोड़ें' },
          ],
          tap: 0,
        },
        text: { en: 'New pieces came? **+ Add**', hi: 'नए पीस आए? **+ जोड़ें**' },
        say: {
          en: 'New pieces came in? Tap Add next to the size, set how many, and tap Add pieces.',
          hi: 'नए पीस आए? साइज़ के पास जोड़ें दबाएँ, कितने आए लिखें, और पीस जोड़ें दबाएँ।',
        },
      },
      {
        scene: { kind: 'edit' },
        text: { en: 'Fix it: **✎ Edit details**', hi: 'ठीक करें: **✎ जानकारी बदलें**' },
        say: {
          en: 'Tap Edit details to change the name, company, category or prices. Tap a size to correct its pieces after a count.',
          hi: 'नाम, कंपनी, कैटेगरी या दाम बदलने के लिए जानकारी बदलें दबाएँ। गिनती के बाद पीस ठीक करने को साइज़ पर टैप करें।',
        },
      },
    ],
    open: { href: '/admin/products', label: { en: 'Products', hi: 'प्रोडक्ट' } },
  },

  // ——— Owner ———
  {
    // ADR-039/051/066: Home's Companies line → the Companies page and a company's page.
    id: 'companies',
    audience: 'owner',
    title: { en: 'Companies', hi: 'कंपनियाँ' },
    goal: { en: 'Who you buy from, and what you owe.', hi: 'किससे खरीदते हैं, और कितना देना है।' },
    steps: [
      {
        scene: { kind: 'list' },
        text: { en: 'Home → **Companies**', hi: 'होम → **कंपनियाँ**' },
        say: {
          en: 'On Home, tap the Companies line. Search by name or place, then tap a company.',
          hi: 'होम पर कंपनियाँ वाली लाइन दबाएँ। नाम या जगह से खोजें, फिर किसी कंपनी पर टैप करें।',
        },
      },
      {
        scene: {
          kind: 'figures',
          items: [
            { label: { en: 'Bills', hi: 'बिल' }, value: '6' },
            { label: { en: 'Billed', hi: 'बिल की रकम' }, value: '₹84,200' },
            { label: { en: 'Dues now', hi: 'अभी बकाया' }, value: '₹12,500' },
            { label: { en: 'Pieces', hi: 'पीस' }, value: '320' },
          ],
        },
        text: { en: 'Its **dues** and bills on top', hi: 'ऊपर उसका **बकाया** और बिल' },
        say: {
          en: 'On top: its bills, what you bought, what you still owe and the pieces, for any period you pick.',
          hi: 'ऊपर: उसके बिल, कितना खरीदा, कितना बाकी है और पीस, जो भी समय आप चुनें।',
        },
      },
      {
        scene: { kind: 'field', label: { en: 'Amount paid ₹', hi: 'चुकाई रकम ₹' }, value: '12500' },
        text: { en: 'Paid them? **Record a payment**', hi: 'पैसे दिए? **भुगतान दर्ज करें**' },
        say: {
          en: 'Paid them? Open Payments, tap Record a payment, type the amount and pick the bill it was for.',
          hi: 'पैसे दिए? भुगतान खोलें, भुगतान दर्ज करें दबाएँ, रकम लिखें और वह बिल चुनें जिसके लिए दिए।',
        },
      },
    ],
    tip: { en: 'Deleting a company keeps its items and bills.', hi: 'कंपनी हटाने पर उसके आइटम और बिल बने रहते हैं।' },
    open: { href: '/admin/companies', label: { en: 'Companies', hi: 'कंपनियाँ' } },
  },
  {
    // ADR-061/062: a company's paper bill, made from products.
    id: 'bills',
    audience: 'owner',
    title: { en: 'Company bills', hi: 'कंपनी के बिल' },
    goal: { en: 'The paper bill, in the app.', hi: 'कागज़ का बिल, ऐप में।' },
    steps: [
      {
        scene: { kind: 'buttons', items: [{ en: '+ New bill', hi: '+ नया बिल' }], tap: 0 },
        text: { en: 'Home → Bills → **+ New bill**', hi: 'होम → बिल → **+ नया बिल**' },
        say: {
          en: 'On Home, tap the Bills line, then New bill. Choose the company, or leave it empty.',
          hi: 'होम पर बिल वाली लाइन दबाएँ, फिर नया बिल। कंपनी चुनें, या खाली छोड़ें।',
        },
      },
      {
        scene: { kind: 'chips', label: { en: 'Cotton Kurta', hi: 'कॉटन कुर्ता' }, chips: ['M', 'L', 'XL', 'XXL'] },
        text: { en: 'Tap each product’s **sizes**', hi: 'हर प्रोडक्ट के **साइज़** दबाएँ' },
        say: {
          en: 'Tap the sizes of each product on the bill, or Scan its tags. Each starts with its pieces and purchase price.',
          hi: 'बिल के हर प्रोडक्ट के साइज़ दबाएँ, या उसके टैग स्कैन करें। हर लाइन उसके पीस और खरीद दाम से शुरू होती है।',
        },
      },
      {
        scene: {
          kind: 'bill',
          // The paper table without S.N, so it fits the small phone.
          head: [
            { en: 'Product', hi: 'प्रोडक्ट' },
            { en: 'Qty', hi: 'मात्रा' },
            { en: 'Purchase ₹', hi: 'खरीद ₹' },
            { en: 'Total ₹', hi: 'कुल ₹' },
          ],
          rows: [
            ['Kurta M', '2', '450', '900'],
            ['Kurta L', '3', '450', '1,350'],
          ],
          total: ['5', '', '₹2,250'],
        },
        text: { en: 'Match **Qty** and **price** to paper', hi: 'कागज़ से **मात्रा** और **दाम** मिलाएँ' },
        say: {
          en: 'Change the quantity and purchase price to match the paper bill. The total adds up by itself.',
          hi: 'कागज़ के बिल जैसा करने के लिए मात्रा और खरीद दाम बदलें। कुल अपने आप जुड़ता है।',
        },
      },
      {
        scene: { kind: 'done', title: { en: 'Bill saved', hi: 'बिल सेव हुआ' }, amount: '₹2,250' },
        text: { en: 'Check it, then **Save bill**', hi: 'जाँचें, फिर **बिल सेव करें**' },
        say: {
          en: 'Tap Next: check bill, add the bill number and date, then Save bill. Tap Mark paid once you pay it.',
          hi: 'आगे: बिल जाँचें दबाएँ, बिल नंबर और तारीख डालें, फिर बिल सेव करें। पैसे देने पर चुकता करें दबाएँ।',
        },
      },
    ],
    tip: { en: 'On a product, Make bill starts a bill with it.', hi: 'प्रोडक्ट पर बिल बनाएँ उसी से बिल शुरू करता है।' },
    open: { href: '/admin/bills', label: { en: 'Bills', hi: 'बिल' } },
  },
  {
    // ADR-066: Home's Collections line → Categories with figures; ✎ / 🗑 on categories.
    id: 'collections',
    audience: 'owner',
    title: { en: 'Collections and categories', hi: 'कलेक्शन और कैटेगरी' },
    goal: { en: 'What you sell, and how much.', hi: 'आप क्या बेचते हैं, और कितना।' },
    steps: [
      {
        scene: {
          kind: 'tiles',
          items: [
            { name: { en: 'Men', hi: 'पुरुष' }, note: { en: '24 products', hi: '24 प्रोडक्ट' }, lock: true },
            { name: { en: 'Women', hi: 'महिला' }, note: { en: '18 products', hi: '18 प्रोडक्ट' }, lock: true },
            { name: { en: 'Kids', hi: 'बच्चे' }, note: { en: '6 products', hi: '6 प्रोडक्ट' } },
          ],
          tap: 0,
        },
        text: { en: 'Home → **Collections**', hi: 'होम → **कलेक्शन**' },
        say: {
          en: 'On Home, tap the Collections line. Each collection shows its products; Men and Women always stay. Tap one to open it.',
          hi: 'होम पर कलेक्शन वाली लाइन दबाएँ। हर कलेक्शन पर उसके प्रोडक्ट दिखते हैं; पुरुष और महिला हमेशा रहते हैं। खोलने को टैप करें।',
        },
      },
      {
        scene: {
          kind: 'figures',
          items: [
            { label: { en: 'Categories', hi: 'कैटेगरी' }, value: '6' },
            { label: { en: 'Products', hi: 'प्रोडक्ट' }, value: '24' },
            { label: { en: 'Pieces in stock', hi: 'स्टॉक में पीस' }, value: '180' },
            { label: { en: 'Stock value', hi: 'स्टॉक की कीमत' }, value: '₹96,400' },
          ],
        },
        text: { en: 'Its **figures** at a glance', hi: 'उसके **आँकड़े** एक नज़र में' },
        say: {
          en: 'Under the tiles: its categories, products, pieces in stock and what that stock is worth.',
          hi: 'टाइलों के नीचे: उसकी कैटेगरी, प्रोडक्ट, स्टॉक के पीस और उस स्टॉक की कीमत।',
        },
      },
      {
        scene: {
          kind: 'rows',
          items: [
            { name: 'Jeans', note: { en: '8 products · 64 pcs', hi: '8 प्रोडक्ट · 64 पीस' }, lock: true },
            { name: 'Kurta', note: { en: '10 products · 90 pcs', hi: '10 प्रोडक्ट · 90 पीस' } },
            { name: 'Pajama', note: { en: '0 products · 0 pcs', hi: '0 प्रोडक्ट · 0 पीस' } },
          ],
          at: 1,
          tap: 'edit',
        },
        text: { en: '**✎** changes a category', hi: '**✎** से कैटेगरी बदलें' },
        say: {
          en: 'Tap the pencil to change a category’s name, code or sizes. Jeans, Jacket and Shirt are locked and always stay.',
          hi: 'कैटेगरी का नाम, कोड या साइज़ बदलने को पेंसिल दबाएँ। जीन्स, जैकेट और शर्ट पर ताला है, ये हमेशा रहते हैं।',
        },
      },
      {
        scene: {
          kind: 'rows',
          items: [
            { name: 'Jeans', note: { en: '8 products · 64 pcs', hi: '8 प्रोडक्ट · 64 पीस' }, lock: true },
            { name: 'Kurta', note: { en: '10 products · 90 pcs', hi: '10 प्रोडक्ट · 90 पीस' } },
            { name: 'Pajama', note: { en: '0 products · 0 pcs', hi: '0 प्रोडक्ट · 0 पीस' } },
          ],
          at: 2,
          tap: 'delete',
        },
        text: { en: '**🗑** deletes an empty one', hi: '**🗑** खाली कैटेगरी हटाता है' },
        say: {
          en: 'The bin deletes a category with no items, after asking. One that still has items stays, and the app says how many.',
          hi: 'कूड़ेदान पूछकर बिना आइटम वाली कैटेगरी हटाता है। जिसमें आइटम हैं वह रहती है, और ऐप बताता है कितने।',
        },
      },
    ],
    open: { href: '/admin/categories', label: { en: 'Categories', hi: 'कैटेगरी' } },
  },
  {
    id: 'inventory',
    audience: 'owner',
    title: { en: 'Keep stock right', hi: 'स्टॉक सही रखें' },
    goal: { en: 'Three simple rules.', hi: 'तीन आसान नियम।' },
    steps: [
      {
        scene: { kind: 'tag', part: 'barcode' },
        text: { en: 'No tag, **no sale**', hi: 'टैग नहीं, तो **बिक्री नहीं**' },
        say: { en: 'Every piece needs a tag. Found one without? Tag it with Tag old stock.', hi: 'हर पीस पर टैग ज़रूरी है। बिना टैग वाला मिला? पुराने स्टॉक पर टैग से लगाएँ।' },
      },
      {
        scene: { kind: 'scan' },
        text: { en: 'Always **scan** to sell', hi: 'बेचते समय हमेशा **स्कैन**' },
        say: { en: 'Never sell without scanning, so the stock is right on every phone.', hi: 'बिना स्कैन किए कभी न बेचें, ताकि हर फ़ोन पर स्टॉक सही रहे।' },
      },
      {
        scene: { kind: 'list' },
        text: { en: 'Weekly: **Needs attention**', hi: 'हर हफ़्ते: **ध्यान दें**' },
        say: { en: 'Once a week, open Needs attention and fix items missing a photo, company or price. Items out of stock show there too.', hi: 'हफ़्ते में एक बार ध्यान दें खोलें और बिना फ़ोटो, कंपनी या दाम वाले आइटम ठीक करें। खत्म हुए आइटम भी वहीं दिखते हैं।' },
      },
    ],
    open: { href: '/admin/catalog/check', label: { en: 'Needs attention', hi: 'ध्यान दें' } },
  },
  {
    id: 'prices',
    audience: 'owner',
    title: { en: 'Prices', hi: 'दाम' },
    goal: { en: 'MRP is the ceiling.', hi: 'MRP सबसे ऊपर की सीमा है।' },
    steps: [
      {
        // 2026-11-23 (ADR-067): rates by size are gone (ADR-061); prices change in ✎ Edit details.
        scene: { kind: 'field', label: { en: 'MRP ₹', hi: 'MRP ₹' }, value: '1499', note: { en: 'For every size', hi: 'हर साइज़ के लिए' } },
        text: { en: 'Product → **✎ Edit details**', hi: 'प्रोडक्ट → **✎ जानकारी बदलें**' },
        say: {
          en: 'Open a product and tap Edit details. Change the MRP, selling or purchase price; it is set for every size.',
          hi: 'प्रोडक्ट खोलें और जानकारी बदलें दबाएँ। MRP, बिक्री या खरीद दाम बदलें; यह हर साइज़ पर लगता है।',
        },
      },
      {
        scene: {
          kind: 'boxes',
          boxes: [
            { label: { en: 'Company', hi: 'कंपनी' }, value: 'Laxmi' },
            { label: { en: 'Product name', hi: 'प्रोडक्ट का नाम' }, value: 'Kurta' },
            { label: { en: 'Purchase price', hi: 'खरीद दाम' }, value: '700', rupee: true },
            { label: { en: 'Sale price', hi: 'बिक्री दाम' }, value: '1050', rupee: true },
          ],
          tap: 3,
          calc: true,
        },
        text: { en: 'New item: **%** works out MRP', hi: 'नया आइटम: **%** से MRP निकालें' },
        say: {
          en: 'In New item, the percent button beside the sale price adds 20, 30, 50 or 100 percent to the purchase price.',
          hi: 'नए आइटम में बिक्री दाम के पास का प्रतिशत बटन खरीद दाम में 20, 30, 50 या 100 प्रतिशत जोड़ता है।',
        },
      },
      {
        scene: { kind: 'tag', part: 'code' },
        text: { en: '**Code price** on tags', hi: 'टैग पर **कोड दाम**' },
        say: { en: 'In Settings, set a ten-letter word. Tags then show the purchase price in letters only your staff can read.', hi: 'सेटिंग में दस अक्षर का एक शब्द रखें। फिर टैग पर खरीद का दाम ऐसे अक्षरों में छपता है जो सिर्फ़ आपका स्टाफ़ पढ़ सके।' },
      },
    ],
    tip: { en: 'Past sales keep the price they were sold at.', hi: 'पुरानी बिक्री का दाम नहीं बदलता।' },
    open: { href: '/admin/products', label: { en: 'Products', hi: 'प्रोडक्ट' } },
  },
  {
    id: 'team',
    audience: 'owner',
    title: { en: 'Staff and rights', hi: 'स्टाफ़ और अधिकार' },
    goal: { en: 'Each person gets only what they need.', hi: 'हर व्यक्ति को उतना ही जितना चाहिए।' },
    steps: [
      {
        scene: { kind: 'keypad' },
        text: { en: 'Add a person + **PIN**', hi: 'व्यक्ति जोड़ें + **PIN**' },
        say: { en: 'In Staff and permissions, add a person with a PIN.', hi: 'स्टाफ़ और अधिकार में, PIN के साथ व्यक्ति जोड़ें।' },
      },
      {
        scene: { kind: 'toggles' },
        text: { en: 'Tick their **rights**', hi: 'उनके **अधिकार** टिक करें' },
        say: { en: 'Tick Catalog, Prices or Stock. Give Purchase price only to trusted staff.', hi: 'कैटलॉग, दाम या स्टॉक टिक करें। खरीद दाम सिर्फ़ भरोसेमंद स्टाफ़ को दें।' },
      },
      {
        // ADR-029: the button is Remove (a removed person can be brought back).
        scene: { kind: 'buttons', items: [{ en: 'Remove', hi: 'हटाएँ' }], tap: 0 },
        text: { en: 'Someone left? **Remove**', hi: 'कोई चला गया? **हटाएँ**' },
        say: {
          en: 'Someone left? Tap Remove. They can no longer log in; their past sales stay. Bring back undoes it.',
          hi: 'कोई चला गया? हटाएँ दबाएँ। वह लॉग इन नहीं कर पाएगा; उसकी पुरानी बिक्री बनी रहती है। वापस लाएँ से फिर जुड़ता है।',
        },
      },
    ],
    open: { href: '/admin/staff', label: { en: 'Staff & permissions', hi: 'स्टाफ़ और अधिकार' } },
  },
  {
    id: 'sales-team',
    audience: 'owner',
    title: { en: 'Sales team', hi: 'बिक्री टीम' },
    goal: { en: 'Who sold how much.', hi: 'किसने कितना बेचा।' },
    steps: [
      {
        scene: { kind: 'bars' },
        text: { en: 'Each seller’s **share**', hi: 'हर सेल्समैन का **हिस्सा**' },
        say: { en: 'Open Sales team. One bar per seller, biggest first, with the amount and percent.', hi: 'बिक्री टीम खोलें। हर सेल्समैन की एक पट्टी, सबसे बड़ी पहले, रकम और प्रतिशत के साथ।' },
      },
      {
        scene: { kind: 'columns' },
        text: { en: 'Sales **day by day**', hi: '**रोज़** की बिक्री' },
        say: { en: 'Below, each person’s sales day by day. Tap a day to see its amount.', hi: 'नीचे हर व्यक्ति की रोज़ की बिक्री। रकम देखने के लिए दिन पर टैप करें।' },
      },
    ],
    open: { href: '/admin/team', label: { en: 'Sales team', hi: 'बिक्री टीम' } },
  },
  {
    id: 'approve',
    audience: 'owner',
    title: { en: 'Approve sales', hi: 'बिक्री मंज़ूर करें' },
    goal: { en: 'Only what you approve counts.', hi: 'जो आप मंज़ूर करें वही गिना जाए।' },
    steps: [
      {
        scene: { kind: 'list' },
        text: { en: 'Open **Approvals**', hi: '**मंज़ूरी** खोलें' },
        say: { en: 'Home shows how many entries are waiting. Open Approvals to see them day by day.', hi: 'होम पर दिखता है कितनी एंट्री बाकी हैं। मंज़ूरी खोलें, दिन के हिसाब से देखें।' },
      },
      {
        scene: { kind: 'card', button: { en: 'Approve', hi: 'मंज़ूर' } },
        text: { en: 'Check price, **Approve**', hi: 'दाम देखें, **मंज़ूर** करें' },
        say: { en: 'Check the price against the MRP and the usual price. Tap Approve, or approve the whole day at once.', hi: 'दाम को MRP और आम दाम से मिलाएँ। मंज़ूर दबाएँ, या पूरे दिन को एक साथ मंज़ूर करें।' },
      },
      {
        scene: { kind: 'buttons', items: [{ en: 'Reject', hi: 'नामंज़ूर' }], tap: 0 },
        text: { en: 'Wrong? **Reject** with a reason', hi: 'गलत? कारण के साथ **नामंज़ूर**' },
        say: { en: 'Something wrong? Reject it with a reason. The pieces go back into stock and the sale leaves the totals.', hi: 'कुछ गलत है? कारण के साथ नामंज़ूर करें। पीस वापस स्टॉक में जाते हैं और बिक्री कुल से हट जाती है।' },
      },
    ],
    tip: { en: 'Entries marked “By hand” need a closer look.', hi: '“हाथ से” वाली एंट्री ध्यान से देखें।' },
    open: { href: '/admin/approvals', label: { en: 'Open Approvals', hi: 'मंज़ूरी खोलें' } },
  },
  {
    id: 'reports',
    audience: 'owner',
    title: { en: 'Reports', hi: 'रिपोर्ट' },
    goal: { en: 'What sells, and a file for the accountant.', hi: 'क्या बिकता है, और हिसाब वाले के लिए फ़ाइल।' },
    steps: [
      {
        scene: { kind: 'bars' },
        text: { en: '**Best sellers** → reorder', hi: '**सबसे ज़्यादा बिके** → फिर मँगाएँ' },
        say: { en: 'Open Reports and pick a period. Reorder the best sellers; put slow ones at the front.', hi: 'रिपोर्ट खोलें और समय चुनें। सबसे ज़्यादा बिकने वाले फिर मँगाएँ; धीमे वाले आगे रखें।' },
      },
      {
        scene: {
          kind: 'buttons',
          items: [
            { en: 'Sales & exchanges (CSV)', hi: 'बिक्री और एक्सचेंज (CSV)' },
            { en: 'Stock list (CSV)', hi: 'स्टॉक लिस्ट (CSV)' },
          ],
          tap: 0,
        },
        text: { en: '**Download CSV**', hi: '**CSV डाउनलोड करें**' },
        say: { en: 'Download the CSV file and send it to your accountant. It opens in Excel.', hi: 'CSV फ़ाइल डाउनलोड करें और अपने हिसाब वाले को भेजें। यह Excel में खुलती है।' },
      },
    ],
    open: { href: '/admin/reports', label: { en: 'Reports', hi: 'रिपोर्ट' } },
  },
];
