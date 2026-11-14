/** What the owner can grant a salesman (admins have all of these implicitly). */
export const PERMISSIONS = ['catalog', 'prices', 'stock', 'costs'] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_INFO: Record<Permission, { label: string; description: string }> = {
  catalog: {
    label: 'Catalog',
    description: 'Add and edit products, photos, names, categories and companies; generate barcodes; print labels; tag old stock.',
  },
  prices: { label: 'Prices', description: 'Change MRP and selling price of existing products.' },
  stock: { label: 'Stock', description: 'Receive stock: new deliveries, restocks and old-stock counts.' },
  costs: { label: 'Purchase price', description: 'See and enter the purchase (code) price. Give only to trusted staff.' },
};

export type Actor = { role: 'admin' | 'salesman'; permissions: readonly string[] };

export function can(actor: Actor | null | undefined, permission: Permission): boolean {
  if (!actor) return false;
  return actor.role === 'admin' || actor.permissions.includes(permission);
}

export function canAny(actor: Actor | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(actor, p));
}

/** Keeps only known permission names, without duplicates. */
export function cleanPermissions(values: readonly string[]): Permission[] {
  return PERMISSIONS.filter((p) => values.includes(p));
}
