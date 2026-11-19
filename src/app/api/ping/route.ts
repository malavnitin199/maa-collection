import { connection } from 'next/server';

/**
 * Plan v18: "is the shop's server reachable?" — the phone asks this while it
 * thinks it is offline. Answered at request time (never built ahead), never cached.
 */
async function pong() {
  await connection();
  return new Response('ok', { status: 200, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' } });
}

export const GET = pong;
export const HEAD = pong;
