import { appIcon } from '@/lib/app-icon';

const SIZES = new Set([192, 512]);

/** PNG app icons for the web app manifest (/app-icon/192, /app-icon/512). */
export async function GET(_request: Request, ctx: RouteContext<'/app-icon/[size]'>) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response('Not found', { status: 404 });
  const response = appIcon(size);
  response.headers.set('Cache-Control', 'public, max-age=86400');
  return response;
}
