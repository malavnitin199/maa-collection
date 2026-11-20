/**
 * Typing in Hindi or English (owner's feedback 2026-11-20): turns what is typed
 * in English letters ("chikan kurta") into Devanagari ("चिकन कुर्ता") and back.
 * Pure and offline: a word list of shop words first (so "saree" is साड़ी, not
 * सरी), then letter-by-letter rules for everything else. Good enough for names
 * on tags and bills; the phone's Hindi keyboard or voice gives exact spellings.
 */

/** Shop words with their usual Hindi spelling (lower-case English → Hindi). */
const WORD_LIST: [string, string][] = [
  // Clothes
  ['kurta', 'कुर्ता'], ['kurti', 'कुर्ती'], ['saree', 'साड़ी'], ['sari', 'साड़ी'], ['lehenga', 'लहंगा'], ['lehnga', 'लहंगा'],
  ['dupatta', 'दुपट्टा'], ['chunni', 'चुन्नी'], ['salwar', 'सलवार'], ['suit', 'सूट'], ['jeans', 'जींस'], ['shirt', 'शर्ट'],
  ['tshirt', 'टी-शर्ट'], ['t-shirt', 'टी-शर्ट'], ['dress', 'ड्रेस'], ['anarkali', 'अनारकली'], ['palazzo', 'पलाज़ो'], ['plazo', 'पलाज़ो'],
  ['blouse', 'ब्लाउज़'], ['patiala', 'पटियाला'], ['sharara', 'शरारा'], ['gharara', 'घरारा'], ['gown', 'गाउन'], ['top', 'टॉप'],
  ['frock', 'फ्रॉक'], ['nighty', 'नाइटी'], ['lungi', 'लुंगी'], ['dhoti', 'धोती'], ['pajama', 'पजामा'], ['pyjama', 'पजामा'],
  ['shawl', 'शॉल'], ['stole', 'स्टोल'], ['pant', 'पैंट'], ['pants', 'पैंट'], ['trouser', 'ट्राउज़र'], ['shorts', 'शॉर्ट्स'],
  ['jacket', 'जैकेट'], ['coat', 'कोट'], ['sweater', 'स्वेटर'], ['hoodie', 'हुडी'], ['skirt', 'स्कर्ट'], ['legging', 'लेगिंग'],
  ['leggings', 'लेगिंग्स'], ['capri', 'कैप्री'], ['kurta-set', 'कुर्ता-सेट'], ['set', 'सेट'], ['material', 'मटेरियल'], ['cloth', 'कपड़ा'],
  ['kapda', 'कपड़ा'], ['sherwani', 'शेरवानी'], ['nehru', 'नेहरू'], ['waistcoat', 'वेस्टकोट'], ['uniform', 'यूनिफ़ॉर्म'], ['innerwear', 'इनरवियर'],
  ['towel', 'टॉवल'], ['bedsheet', 'बेडशीट'], ['blanket', 'कंबल'], ['kambal', 'कंबल'], ['odhni', 'ओढ़नी'], ['ghagra', 'घाघरा'], ['choli', 'चोली'],
  // Styles and fabrics
  ['chikan', 'चिकन'], ['chikankari', 'चिकनकारी'], ['phulkari', 'फुलकारी'], ['bandhani', 'बांधनी'], ['bandhej', 'बांधेज'], ['banarasi', 'बनारसी'],
  ['kanjivaram', 'कांजीवरम'], ['kanjeevaram', 'कांजीवरम'], ['cotton', 'कॉटन'], ['silk', 'सिल्क'], ['chiffon', 'शिफ़ॉन'], ['georgette', 'जॉर्जेट'],
  ['rayon', 'रेयॉन'], ['linen', 'लिनन'], ['denim', 'डेनिम'], ['velvet', 'वेलवेट'], ['net', 'नेट'], ['lycra', 'लाइक्रा'], ['woolen', 'ऊनी'],
  ['printed', 'प्रिंटेड'], ['print', 'प्रिंट'], ['plain', 'प्लेन'], ['embroidery', 'कढ़ाई'], ['embroidered', 'कढ़ाईदार'], ['zari', 'ज़री'],
  ['designer', 'डिज़ाइनर'], ['design', 'डिज़ाइन'], ['fancy', 'फ़ैंसी'], ['party', 'पार्टी'], ['wear', 'वियर'], ['casual', 'कैज़ुअल'],
  ['formal', 'फ़ॉर्मल'], ['ethnic', 'एथनिक'], ['western', 'वेस्टर्न'], ['slim', 'स्लिम'], ['regular', 'रेगुलर'], ['fit', 'फ़िट'],
  ['stretch', 'स्ट्रेच'], ['full', 'फुल'], ['half', 'हाफ़'], ['sleeve', 'स्लीव'], ['collar', 'कॉलर'], ['check', 'चेक'], ['checks', 'चेक्स'],
  ['stripe', 'स्ट्राइप'], ['lining', 'लाइनिंग'], ['border', 'बॉर्डर'], ['pallu', 'पल्लू'], ['heavy', 'हैवी'], ['light', 'लाइट'],
  // People and sizes
  ['men', 'मेन'], ['mens', 'मेन्स'], ['women', 'वीमेन'], ['womens', 'वीमेन्स'], ['boys', 'बॉयज़'], ['girls', 'गर्ल्स'], ['kids', 'किड्स'],
  ['ladies', 'लेडीज़'], ['gents', 'जेंट्स'], ['baby', 'बेबी'], ['free', 'फ्री'], ['size', 'साइज़'], ['small', 'स्मॉल'], ['medium', 'मीडियम'],
  ['large', 'लार्ज'], ['xl', 'XL'], ['xxl', 'XXL'],
  // Colours
  ['blue', 'ब्लू'], ['red', 'रेड'], ['black', 'ब्लैक'], ['white', 'व्हाइट'], ['pink', 'पिंक'], ['green', 'ग्रीन'], ['yellow', 'येलो'],
  ['maroon', 'मरून'], ['navy', 'नेवी'], ['grey', 'ग्रे'], ['gray', 'ग्रे'], ['golden', 'गोल्डन'], ['gold', 'गोल्ड'], ['silver', 'सिल्वर'],
  ['orange', 'ऑरेंज'], ['purple', 'पर्पल'], ['brown', 'ब्राउन'], ['cream', 'क्रीम'], ['beige', 'बेज'], ['peach', 'पीच'], ['mustard', 'मस्टर्ड'],
  ['lal', 'लाल'], ['neela', 'नीला'], ['peela', 'पीला'], ['hara', 'हरा'], ['kala', 'काला'], ['safed', 'सफ़ेद'], ['gulabi', 'गुलाबी'],
  // Companies, places, bills
  ['textile', 'टेक्सटाइल'], ['textiles', 'टेक्सटाइल्स'], ['fashion', 'फ़ैशन'], ['fashions', 'फ़ैशन्स'], ['collection', 'कलेक्शन'], ['collections', 'कलेक्शन्स'],
  ['garment', 'गारमेंट'], ['garments', 'गारमेंट्स'], ['creation', 'क्रिएशन'], ['creations', 'क्रिएशन्स'], ['traders', 'ट्रेडर्स'], ['trading', 'ट्रेडिंग'],
  ['mills', 'मिल्स'], ['brothers', 'ब्रदर्स'], ['sons', 'संस'], ['and', 'एंड'], ['enterprises', 'एंटरप्राइज़ेज़'], ['store', 'स्टोर'], ['stores', 'स्टोर्स'],
  ['emporium', 'एम्पोरियम'], ['bazaar', 'बाज़ार'], ['bazar', 'बाज़ार'], ['market', 'मार्केट'], ['company', 'कंपनी'], ['agency', 'एजेंसी'], ['agencies', 'एजेंसीज़'],
  ['surat', 'सूरत'], ['delhi', 'दिल्ली'], ['mumbai', 'मुंबई'], ['jaipur', 'जयपुर'], ['kolkata', 'कोलकाता'], ['ludhiana', 'लुधियाना'],
  ['ahmedabad', 'अहमदाबाद'], ['bhilwara', 'भीलवाड़ा'], ['indore', 'इंदौर'], ['lucknow', 'लखनऊ'], ['kanpur', 'कानपुर'], ['varanasi', 'वाराणसी'],
  ['tirupur', 'तिरुपुर'], ['erode', 'इरोड'], ['panipat', 'पानीपत'], ['chandni', 'चांदनी'], ['chowk', 'चौक'], ['gandhi', 'गांधी'], ['nagar', 'नगर'],
  ['bill', 'बिल'], ['cash', 'कैश'], ['advance', 'एडवांस'], ['credit', 'उधार'], ['udhar', 'उधार'], ['payment', 'पेमेंट'], ['cheque', 'चेक'],
  ['online', 'ऑनलाइन'], ['balance', 'बैलेंस'], ['discount', 'डिस्काउंट'], ['freight', 'भाड़ा'], ['bhada', 'भाड़ा'], ['transport', 'ट्रांसपोर्ट'],
  ['monday', 'सोमवार'], ['tuesday', 'मंगलवार'], ['wednesday', 'बुधवार'], ['thursday', 'गुरुवार'], ['friday', 'शुक्रवार'], ['saturday', 'शनिवार'], ['sunday', 'रविवार'],
  ['new', 'न्यू'], ['old', 'ओल्ड'], ['shree', 'श्री'], ['shri', 'श्री'], ['maa', 'माँ'], ['ma', 'माँ'], ['om', 'ॐ'], ['jai', 'जय'],
];
const TO_HINDI = new Map(WORD_LIST);
const TO_ENGLISH = new Map<string, string>();
for (const [english, hindi] of WORD_LIST) if (!TO_ENGLISH.has(hindi)) TO_ENGLISH.set(hindi, english);

// Letter rules: longest spelling first.
const CONSONANTS: [string, string][] = [
  ['chh', 'छ'], ['ksh', 'क्ष'], ['shh', 'ष'],
  ['kh', 'ख'], ['gh', 'घ'], ['ch', 'च'], ['jh', 'झ'], ['th', 'थ'], ['dh', 'ध'], ['ph', 'फ'], ['bh', 'भ'], ['sh', 'श'], ['gn', 'ज्ञ'],
  ['k', 'क'], ['g', 'ग'], ['j', 'ज'], ['t', 'त'], ['d', 'द'], ['n', 'न'], ['p', 'प'], ['f', 'फ़'], ['b', 'ब'], ['m', 'म'],
  ['y', 'य'], ['r', 'र'], ['l', 'ल'], ['v', 'व'], ['w', 'व'], ['s', 'स'], ['h', 'ह'], ['z', 'ज़'], ['x', 'क्स'], ['q', 'क़'], ['c', 'क'],
];
const VOWELS: [string, [string, string]][] = [
  // spelling → [independent letter, sign after a consonant]
  ['aa', ['आ', 'ा']], ['ai', ['ऐ', 'ै']], ['au', ['औ', 'ौ']], ['ou', ['औ', 'ौ']], ['ee', ['ई', 'ी']], ['ii', ['ई', 'ी']], ['oo', ['ऊ', 'ू']], ['uu', ['ऊ', 'ू']],
  ['a', ['अ', '']], ['i', ['इ', 'ि']], ['u', ['उ', 'ु']], ['e', ['ए', 'े']], ['o', ['ओ', 'ो']],
];
// At the end of a word a single vowel letter is long in the usual Hinglish spelling (kurta, kurti, sadhu).
const FINAL_VOWEL: Record<string, string> = { a: 'ा', i: 'ी', u: 'ू' };
const VIRAMA = '्';
const ANUSVARA = 'ं';
/** "n" before one of these sounds like a nasal mark (pant → पैंट, chandni → चांदनी). */
const NASAL_BEFORE = new Set(['k', 'g', 'ch', 'j', 't', 'd', 'th', 'dh', 'p', 'b']);

const LETTER = /^[a-z]+$/i;
const DEVANAGARI = /[ऀ-ॿ]/;

export function hasDevanagari(text: string): boolean {
  return DEVANAGARI.test(text);
}

function roman(word: string): string {
  const lower = word.toLowerCase();
  const fromList = TO_HINDI.get(lower);
  if (fromList) return fromList;
  let out = '';
  let afterConsonant = false;
  let i = 0;
  const match = <T>(table: [string, T][]) => table.find(([spelling]) => lower.startsWith(spelling, i));
  while (i < lower.length) {
    const vowel = match(VOWELS);
    if (vowel) {
      const [spelling, [independent, sign]] = vowel;
      const last = i + spelling.length === lower.length;
      if (afterConsonant) out += last && spelling.length === 1 && FINAL_VOWEL[spelling] !== undefined ? FINAL_VOWEL[spelling] : sign;
      else out += independent;
      afterConsonant = false;
      i += spelling.length;
      continue;
    }
    const consonant = match(CONSONANTS);
    if (consonant) {
      const [spelling] = consonant;
      let letter = consonant[1];
      const rest = lower.slice(i + spelling.length);
      const nextConsonant = CONSONANTS.find(([s]) => rest.startsWith(s));
      // A retroflex T / D in English-style clusters: dress → ड्रेस, tractor → ट्रैक्टर.
      if ((spelling === 't' || spelling === 'd') && rest.startsWith('r')) letter = spelling === 't' ? 'ट' : 'ड';
      // Capital T / D ask for the retroflex letter on purpose.
      if (word[i] === 'T' && spelling === 't') letter = 'ट';
      if (word[i] === 'D' && spelling === 'd') letter = 'ड';
      // A nasal mark instead of न् before a stop (pant → पैंट), but not before the same letter (chunni).
      if ((spelling === 'n' || spelling === 'm') && nextConsonant && NASAL_BEFORE.has(nextConsonant[0]) && nextConsonant[0] !== spelling) {
        out += ANUSVARA;
        afterConsonant = false;
        i += spelling.length;
        continue;
      }
      if (afterConsonant) out += VIRAMA;
      out += letter;
      afterConsonant = true;
      i += spelling.length;
      continue;
    }
    out += word[i];
    afterConsonant = false;
    i += 1;
  }
  return out;
}

/** English letters → Devanagari, word by word; Devanagari, numbers and marks stay as they are. */
export function toHindi(text: string): string {
  return text.replace(/[A-Za-z]+(?:-[A-Za-z]+)*/g, (word) => {
    const fromList = TO_HINDI.get(word.toLowerCase());
    if (fromList) return fromList;
    // Short codes in capitals stay (sizes M, XL, XXL; MRP, GST, SKU).
    if (/^[A-Z]{1,4}$/.test(word)) return word;
    return word.split('-').map(roman).join('-');
  });
}

const CONSONANT_SOUNDS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'ng', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'ny', ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n',
  त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n', प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', व: 'v', श: 'sh', ष: 'sh',
  स: 's', ह: 'h', ळ: 'l',
  // With a nukta (the dot below) — one code point each.
  क़: 'q', ख़: 'kh', ग़: 'g', ज़: 'z', ड़: 'd', ढ़: 'dh', फ़: 'f', य़: 'y',
};
const NUKTA: Record<string, string> = { क: 'q', ख: 'kh', ग: 'g', ज: 'z', ड: 'd', ढ: 'dh', फ: 'f', य: 'y' };
const VOWEL_SOUNDS: Record<string, string> = {
  अ: 'a', आ: 'aa', इ: 'i', ई: 'ee', उ: 'u', ऊ: 'oo', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऋ: 'ri', ऑ: 'o', ऍ: 'e',
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ृ': 'ri', 'ॉ': 'o', 'ॅ': 'e',
};
const MATRAS = new Set(['ा', 'ि', 'ी', 'ु', 'ू', 'े', 'ै', 'ो', 'ौ', 'ृ', 'ॉ', 'ॅ']);
const DIGITS: Record<string, string> = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };

function devanagariWord(word: string): string {
  const fromList = TO_ENGLISH.get(word);
  if (fromList) return capital(fromList);
  const chars = [...word];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '़' || ch === VIRAMA) continue;
    if (ch === '॰' || ch === '।') {
      out += '.';
      continue;
    }
    if (DIGITS[ch]) {
      out += DIGITS[ch];
      continue;
    }
    if (ch === ANUSVARA || ch === 'ँ') {
      const next = chars[i + 1];
      out += next === 'प' || next === 'ब' || next === 'भ' || next === 'म' ? 'm' : 'n';
      continue;
    }
    if (ch === 'ः') {
      out += 'h';
      continue;
    }
    if (VOWEL_SOUNDS[ch]) {
      out += VOWEL_SOUNDS[ch];
      continue;
    }
    if (ch === 'ॐ') {
      out += 'om';
      continue;
    }
    let sound = CONSONANT_SOUNDS[ch];
    if (sound === undefined) {
      out += ch;
      continue;
    }
    let next = chars[i + 1];
    if (next === '़') {
      sound = NUKTA[ch] ?? sound;
      i += 1;
      next = chars[i + 1];
    }
    out += sound;
    // The built-in "a": not before a vowel sign or a joiner, and not at the end of the word.
    const joined = next === VIRAMA;
    const last = next === undefined;
    if (!joined && !last && !MATRAS.has(next)) out += 'a';
  }
  return capital(out);
}

const capital = (word: string) => (word ? word[0].toUpperCase() + word.slice(1) : word);

/** Devanagari → English letters, word by word (Chikan Kurta); everything else stays. */
export function toEnglish(text: string): string {
  return text.replace(/[ऀ-ॿ]+/g, devanagariWord);
}

/** In Hindi typing: the last word, if it is still in English letters, becomes Devanagari once a space or mark follows it. */
export function convertLastWord(text: string): string {
  const match = /([A-Za-z]+(?:-[A-Za-z]+)*)([\s,.;:!?()]+)$/.exec(text);
  if (!match) return text;
  const [whole, word, tail] = match;
  if (!LETTER.test(word.replace(/-/g, ''))) return text;
  return text.slice(0, text.length - whole.length) + toHindi(word) + tail;
}

/** Finish Hindi typing when the field loses focus: a trailing English word becomes Devanagari. */
export function convertTrailingWord(text: string): string {
  return text.replace(/[A-Za-z]+(?:-[A-Za-z]+)*$/, (word) => toHindi(word));
}
