/**
 * Bulk addition (owner, 2026-11-24, ADR-072): many products of one category typed into one
 * table and saved together. Keys start with "bulk." (its table's column words are the
 * bill table's: `bills.sheet.*`).
 */
export const bulkEn = {
  'bulk.title': 'Bulk addition',
  'bulk.hub.hint': 'Many products of one category in one go',
  'bulk.progress': 'Step {n} of 3',
  'bulk.short.rows': 'Products',
  'bulk.step.rows': 'Products',
  'bulk.col.sale': 'Sale ₹',
  'bulk.row.name': 'Product name, row {n}',
  'bulk.row.cost': 'Purchase price, row {n}',
  'bulk.row.sale': 'Sale price, row {n}',
  'bulk.row.qty': 'Quantity, row {n}',
  'bulk.row.clear': 'Clear row {n}',
  'bulk.products.one': '{n} product',
  'bulk.products.other': '{n} products',
  'bulk.sale.auto': 'Sale price: purchase + {n}%',
  'bulk.need.cost': 'Row {row}: type the purchase price.',
  'bulk.need.sale': 'Row {row}: type the sale price.',
  'bulk.need.qty': 'Row {row}: the quantity must be 1 or more.',
  'bulk.saved.one': 'Product saved',
  'bulk.saved.other': '{n} products saved',
  'bulk.err.empty': 'Add at least one product.',
  // The tags page after a bulk save: back to the same category's table.
  'bulk.addMore': '+ Add more {type}',
} as const;

export const bulkHi: Record<keyof typeof bulkEn, string> = {
  'bulk.title': 'एक साथ कई जोड़ें',
  'bulk.hub.hint': 'एक कैटेगरी के कई प्रोडक्ट एक बार में',
  'bulk.progress': 'चरण {n} / 3',
  'bulk.short.rows': 'प्रोडक्ट',
  'bulk.step.rows': 'प्रोडक्ट',
  'bulk.col.sale': 'बिक्री ₹',
  'bulk.row.name': 'प्रोडक्ट का नाम, लाइन {n}',
  'bulk.row.cost': 'खरीद दाम, लाइन {n}',
  'bulk.row.sale': 'बिक्री दाम, लाइन {n}',
  'bulk.row.qty': 'मात्रा, लाइन {n}',
  'bulk.row.clear': 'लाइन {n} खाली करें',
  'bulk.products.one': '{n} प्रोडक्ट',
  'bulk.products.other': '{n} प्रोडक्ट',
  'bulk.sale.auto': 'बिक्री दाम: खरीद + {n}%',
  'bulk.need.cost': 'लाइन {row}: खरीद दाम डालें।',
  'bulk.need.sale': 'लाइन {row}: बिक्री दाम डालें।',
  'bulk.need.qty': 'लाइन {row}: मात्रा 1 या उससे ज़्यादा होनी चाहिए।',
  'bulk.saved.one': 'प्रोडक्ट सेव हुआ',
  'bulk.saved.other': '{n} प्रोडक्ट सेव हुए',
  'bulk.err.empty': 'कम से कम एक प्रोडक्ट जोड़ें।',
  'bulk.addMore': '+ और {type} जोड़ें',
};
