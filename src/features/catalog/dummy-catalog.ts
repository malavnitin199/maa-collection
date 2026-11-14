/**
 * Dummy cashier-safe catalog until the real database arrives (Phase P2/P3).
 * Deliberately contains NO cost/profit/supplier fields: cashier-facing data
 * must never include them (domain invariant), even in dummy form.
 */
export type CatalogItem = {
  sku: string;
  /** Internal Code 128 label value or manufacturer EAN-13. */
  barcode: string;
  brand: string;
  category: string;
  design: string;
  size: string;
  color: string;
  mrpPaise: number;
};

export const DUMMY_CATALOG: CatalogItem[] = [
  { sku: 'MAA-TS-001', barcode: '8901111000011', brand: 'Maa Basics', category: 'T-Shirt', design: 'Classic Crew Tee', size: 'M', color: 'Black', mrpPaise: 49900 },
  { sku: 'MAA-TS-002', barcode: '8901111000028', brand: 'Maa Basics', category: 'T-Shirt', design: 'Classic Crew Tee', size: 'L', color: 'White', mrpPaise: 49900 },
  { sku: 'MAA-KU-001', barcode: '8902222000013', brand: 'Riya Ethnic', category: 'Kurta', design: 'Anarkali Kurta', size: 'M', color: 'Blue', mrpPaise: 129900 },
  { sku: 'MAA-KU-002', barcode: '8902222000020', brand: 'Riya Ethnic', category: 'Kurta', design: 'Anarkali Kurta', size: 'L', color: 'Red', mrpPaise: 129900 },
  { sku: 'MAA-JE-001', barcode: '8903333000015', brand: 'DenimCo', category: 'Jeans', design: 'Slim Fit Jeans', size: '32', color: 'Indigo', mrpPaise: 179900 },
  { sku: 'MAA-SH-001', barcode: '8905555000019', brand: 'DenimCo', category: 'Shirt', design: 'Oxford Shirt', size: '40', color: 'Sky Blue', mrpPaise: 99900 },
  { sku: 'MAA-SA-001', barcode: '8904444000017', brand: 'Vastra', category: 'Saree', design: 'Banarasi Saree', size: 'Free', color: 'Green', mrpPaise: 249900 },
  { sku: 'MAA-DR-001', barcode: '8906666000011', brand: 'Maa Basics', category: 'Dress', design: 'A-Line Dress', size: 'S', color: 'Maroon', mrpPaise: 159900 },
];

export function findByBarcodeOrSku(code: string): CatalogItem | undefined {
  const needle = code.trim().toUpperCase();
  if (!needle) return undefined;
  return DUMMY_CATALOG.find(
    (item) => item.barcode === needle || item.sku.toUpperCase() === needle,
  );
}
