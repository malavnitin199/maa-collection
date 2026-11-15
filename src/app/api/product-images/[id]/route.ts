import { STORE_ID } from '@/lib/app-config';
import { getCurrentStaff } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { getImageData } from '@/server/services/images';

/** Serves a product photo to logged-in staff. Photo ids never change content, so cache for a year. */
export async function GET(request: Request, ctx: RouteContext<'/api/product-images/[id]'>) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  if (!(await getCurrentStaff())) return new Response('Log in first', { status: 401 });
  const image = await getImageData(await requestDb(), STORE_ID, id);
  if (!image) return new Response('Not found', { status: 404 });
  // Shared photo (relative address) or external store.
  if (image.url) return Response.redirect(new URL(image.url, request.url), 302);
  if (!image.data) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
