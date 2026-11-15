/**
 * The QR code on a tag holds a link to the item in this app:
 * `https://<app>/i/<barcode>`. A staff member's phone camera opens it; the
 * in-app scanners read the code at the end of the link, so a tag works the
 * same whether its barcode or its QR is scanned (ADR-014).
 */

export function itemLink(origin: string, barcode: string): string {
  return `${origin.replace(/\/+$/, '')}/i/${encodeURIComponent(barcode)}`;
}

/** A scanned code, or the item code inside a scanned item link (any domain, so old tags keep working). */
export function codeFromScan(text: string): string {
  const value = text.trim();
  const match = /^https?:\/\/[^\s/]+(?:\/[^\s?#]*)?\/i\/([^/?#\s]+)\/?(?:[?#]\S*)?$/i.exec(value);
  if (!match) return value;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

