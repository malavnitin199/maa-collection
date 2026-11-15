import { NextResponse, type NextRequest } from 'next/server';
import { STORE_ID } from '@/lib/app-config';
import { canAny } from '@/lib/permissions';
import { getCurrentStaff } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { findProductByCode } from '@/server/services/products';

/**
 * A tag's QR code (ADR-014). Logged-out → login. Staff with catalog, price or
 * stock rights → the product page; everyone else → the counter with the item
 * loaded. Nothing about the item is shown without a login.
 */
export async function GET(request: NextRequest, context: RouteContext<'/i/[code]'>) {
  const { code } = await context.params;
  const me = await getCurrentStaff();
  if (!me) return NextResponse.redirect(new URL('/login', request.url));
  const value = decodeURIComponent(code).slice(0, 64);
  const product = await findProductByCode(await requestDb(), STORE_ID, value);
  const target =
    product && canAny(me, ['catalog', 'prices', 'stock'])
      ? `/admin/products/${product.id}`
      : `/pos?code=${encodeURIComponent(product?.barcode ?? value)}`;
  return NextResponse.redirect(new URL(target, request.url));
}
