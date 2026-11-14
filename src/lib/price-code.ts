/**
 * Shop "code price": the purchase price written on the tag in a secret letter
 * code, so staff know the floor while customers can't read it. The owner picks
 * a 10-letter word with no repeated letters; its letters stand for 1,2,…,9,0.
 * Example word BLACKHORSE: B=1 L=2 A=3 C=4 K=5 H=6 O=7 R=8 S=9 E=0 → ₹450 = "CKE".
 */

export function normalizeCodeWord(word: string): string {
  return word.trim().toUpperCase().replace(/\s+/g, '');
}

/** Returns an error message, or null if the word is usable. */
export function codeWordProblem(word: string): string | null {
  const w = normalizeCodeWord(word);
  if (!/^[A-Z]{10}$/.test(w)) return 'The code word must be exactly 10 letters (A–Z).';
  if (new Set(w).size !== 10) return 'Every letter in the code word must be different.';
  return null;
}

/** Whole rupees of `paise` written in the code word's letters. */
export function encodePriceCode(paise: number, word: string): string {
  const w = normalizeCodeWord(word);
  if (codeWordProblem(w)) throw new Error('Invalid code word.');
  if (!Number.isSafeInteger(paise) || paise < 0) throw new Error('Invalid amount.');
  return String(Math.floor(paise / 100))
    .split('')
    .map((digit) => w[(Number(digit) + 9) % 10])
    .join('');
}

/** Reverse of encodePriceCode (for the owner's decoder). Returns rupees, or null if unreadable. */
export function decodePriceCode(code: string, word: string): number | null {
  const w = normalizeCodeWord(word);
  const letters = code.trim().toUpperCase();
  if (codeWordProblem(w) || !letters) return null;
  let digits = '';
  for (const letter of letters) {
    const index = w.indexOf(letter);
    if (index === -1) return null;
    digits += String((index + 1) % 10);
  }
  return Number(digits);
}
