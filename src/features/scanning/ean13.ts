/** True when `code` is 13 digits with a correct EAN-13 check digit. */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const sum = digits
    .slice(0, 12)
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

/** Check digit for the first 12 digits of an EAN-13. */
export function ean13CheckDigit(first12: string): number {
  if (!/^\d{12}$/.test(first12)) throw new Error(`Need 12 digits, got: ${first12}`);
  const sum = first12
    .split('')
    .map(Number)
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

/**
 * Shop-generated barcode number: GS1 in-store prefix "200" (20–29 is reserved
 * for a shop's own use, so it never clashes with manufacturer barcodes),
 * a 9-digit running number, and the check digit.
 */
export function inStoreEan13(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999_999_999) {
    throw new Error(`Barcode sequence out of range: ${sequence}`);
  }
  const first12 = `200${String(sequence).padStart(9, '0')}`;
  return first12 + ean13CheckDigit(first12);
}

// EAN-13 digit patterns (1 = dark module). G is L inverted and reversed; R is L inverted.
const L_CODES = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const invert = (bits: string) => bits.replace(/[01]/g, (b) => (b === '1' ? '0' : '1'));
const G_CODES = L_CODES.map((bits) => invert(bits).split('').reverse().join(''));
const R_CODES = L_CODES.map(invert);
// The first digit is not drawn as bars; it picks the L/G mix of the left half.
const FIRST_DIGIT_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** The 95 modules of an EAN-13 symbol as a '0'/'1' string. Throws on an invalid code. */
export function ean13Modules(code: string): string {
  if (!isValidEan13(code)) throw new Error(`Invalid EAN-13 barcode: ${code}`);
  const digits = code.split('').map(Number);
  const parity = FIRST_DIGIT_PARITY[digits[0]];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? L_CODES : G_CODES)[digits[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R_CODES[digits[i]];
  return bits + '101';
}

/**
 * Standalone SVG for an EAN-13 code: bars, guard bars, quiet zones, and the
 * human-readable digits underneath. `moduleWidth` is pixels per narrowest bar.
 */
/** `barHeight` is in modules (bars are this tall; guard bars 5 more). Short bars suit small stickers. */
export function ean13Svg(code: string, moduleWidth = 3, barHeight = 60): string {
  const bits = ean13Modules(code);
  const quietLeft = 11;
  const quietRight = 7;
  const width = quietLeft + bits.length + quietRight;
  const top = 4;
  const guardHeight = barHeight + 5;
  const height = top + guardHeight + 8;
  const isGuard = (i: number) => i < 3 || (i >= 45 && i < 50) || i >= 92;

  const bars: string[] = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue;
    let run = 1;
    while (bits[i + run] === '1' && isGuard(i + run) === isGuard(i)) run++;
    const h = isGuard(i) ? guardHeight : barHeight;
    bars.push(`<rect x="${quietLeft + i}" y="${top}" width="${run}" height="${h}"/>`);
    i += run - 1;
  }

  const textY = top + barHeight + 8;
  const text = (x: number, value: string, span?: number) =>
    `<text x="${x}" y="${textY}" text-anchor="middle"${
      span ? ` textLength="${span}" lengthAdjust="spacing"` : ''
    }>${value}</text>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * moduleWidth}" height="${height * moduleWidth}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">`,
    `<rect width="${width}" height="${height}" fill="#fff"/>`,
    `<g fill="#000">${bars.join('')}</g>`,
    `<g fill="#000" font-family="ui-monospace, Menlo, monospace" font-size="9">`,
    text(quietLeft - 5, code[0]),
    text(quietLeft + 24, code.slice(1, 7), 36),
    text(quietLeft + 71, code.slice(7), 36),
    `</g></svg>`,
  ].join('');
}
