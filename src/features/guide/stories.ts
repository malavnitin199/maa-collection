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
  | { kind: 'header'; tap: 'lang' | 'sound' | 'logout' }
  | { kind: 'swatches' }
  | { kind: 'daynight' }
  | { kind: 'tag'; part: TagPart }
  | { kind: 'scan'; qr?: boolean; label?: L }
  | { kind: 'card'; button: L }
  | { kind: 'field'; label: L; value: string; note?: L }
  | { kind: 'done'; title: L; amount: string }
  | { kind: 'chips'; label: L; chips: string[]; swatches?: boolean }
  | { kind: 'table' }
  | { kind: 'print' }
  | { kind: 'photo' }
  | { kind: 'edit' }
  | { kind: 'count' }
  | { kind: 'buttons'; items: L[]; tap: number }
  | { kind: 'toggles' }
  | { kind: 'bars' }
  | { kind: 'columns' }
  | { kind: 'list' };

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
        scene: { kind: 'header', tap: 'logout' },
        text: { en: 'Finished? **Log out**', hi: 'काम खत्म? **लॉग आउट**' },
        say: { en: 'On a shared phone, tap the arrow at the top right to log out.', hi: 'साझा फ़ोन पर ऊपर दाईं ओर तीर दबाकर लॉग आउट करें।' },
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
        text: { en: 'Sun button → **pick a colour**', hi: 'सूरज बटन → **रंग चुनें**' },
        say: { en: 'Tap the sun button at the top and pick a colour you like.', hi: 'ऊपर सूरज वाला बटन दबाएँ और अपनी पसंद का रंग चुनें।' },
      },
      {
        scene: { kind: 'daynight' },
        text: { en: '**Night** for the evening', hi: 'शाम को **रात**' },
        say: { en: 'Choose Night for a dark screen in the evening, or Day.', hi: 'शाम को गहरी स्क्रीन के लिए रात चुनें, दिन में दिन।' },
      },
      {
        scene: { kind: 'header', tap: 'sound' },
        text: { en: '**Sound** on or off', hi: '**आवाज़** चालू या बंद' },
        say: { en: 'The speaker button turns the scan sounds on or off.', hi: 'स्पीकर वाला बटन स्कैन की आवाज़ चालू या बंद करता है।' },
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
        text: { en: 'Big **size**, and the colour', hi: 'बड़ा **साइज़**, और रंग' },
        say: { en: 'The size is printed big, with the colour next to it.', hi: 'साइज़ बड़ा छपा है, साथ में रंग।' },
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
        text: { en: 'Check **size and colour**', hi: '**साइज़ और रंग** मिलाएँ' },
        say: { en: 'Check the photo, size and colour match the piece. Then tap Sell this item.', hi: 'फ़ोटो, साइज़ और रंग पीस से मिलाएँ। फिर यह आइटम बेचें दबाएँ।' },
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
    goal: { en: 'Photo, name, price — and its barcode.', hi: 'फ़ोटो, नाम, दाम — और उसका बारकोड।' },
    steps: [
      {
        scene: { kind: 'photo' },
        text: { en: '**Name**, category, photo on the right', hi: '**नाम**, कैटेगरी, दाईं ओर फ़ोटो' },
        say: { en: 'Open Stock, New item. Type the product name, pick the category and who it is for, and tap the square on the right for a photo.', hi: 'स्टॉक में नया आइटम खोलें। प्रोडक्ट का नाम लिखें, कैटेगरी और किसके लिए है चुनें, और फ़ोटो के लिए दाईं ओर का चौकोर दबाएँ।' },
      },
      {
        scene: { kind: 'field', label: { en: 'MRP (₹)', hi: 'MRP (₹)' }, value: '1,499' },
        text: { en: 'Company, **sale price**, purchase price', hi: 'कंपनी, **बिक्री दाम**, खरीद दाम' },
        say: { en: 'Choose the company, then type the sale price, which is the MRP, and the purchase price. Pieces are in the Details tab.', hi: 'कंपनी चुनें, फिर बिक्री दाम यानी MRP और खरीद दाम लिखें। पीस जानकारी टैब में हैं।' },
      },
      {
        scene: { kind: 'chips', label: { en: 'Sizes', hi: 'साइज़' }, chips: ['M', 'L', 'XL', 'XXL'] },
        text: { en: 'Many sizes? The **Colours** tab', hi: 'कई साइज़? **रंग** टैब' },
        say: { en: 'Comes in many sizes or colours? Open the Colours tab and tap them. Every pair gets its own barcode.', hi: 'कई साइज़ या रंग में आया है? रंग टैब खोलकर उन्हें चुनें। हर जोड़ी को अपना बारकोड मिलता है।' },
      },
      {
        scene: { kind: 'print' },
        text: { en: '**Save** → print tags', hi: '**सेव** → टैग प्रिंट' },
        say: { en: 'Save and print the tags. Then tap Add next item: the company and category stay.', hi: 'सेव करें और टैग प्रिंट करें। फिर अगला आइटम जोड़ें दबाएँ: कंपनी और कैटेगरी वही रहती हैं।' },
      },
    ],
    tip: { en: 'Bigger sizes cost more? Colours → Price by size.', hi: 'बड़े साइज़ महँगे? रंग → साइज़ के हिसाब से दाम।' },
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

  // ——— Owner ———
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
        scene: { kind: 'table' },
        text: { en: 'Each **size** its own price', hi: 'हर **साइज़** का अपना दाम' },
        say: { en: 'Open a product, then Rates for the whole design. Change the default or one size, then Apply. Every colour of that size follows.', hi: 'प्रोडक्ट खोलें, फिर पूरे डिज़ाइन के रेट। डिफ़ॉल्ट या एक साइज़ बदलें, फिर लागू करें। उस साइज़ के हर रंग पर लगेगा।' },
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
        scene: { kind: 'buttons', items: [{ en: 'Deactivate', hi: 'बंद करें' }], tap: 0 },
        text: { en: 'Someone left? **Deactivate**', hi: 'कोई चला गया? **बंद करें**' },
        say: { en: 'Someone left? Deactivate them. Their past sales stay.', hi: 'कोई चला गया? उसे बंद करें। उसकी पुरानी बिक्री बनी रहती है।' },
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
