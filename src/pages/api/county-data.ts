export const prerender = false;

import type { APIContext } from 'astro';
import { getCountyDataForCalculator, searchCountiesForCalculator } from '../../lib/db';

export async function GET({ request, locals }: APIContext) {
  const url = new URL(request.url);
  const db = (locals as any).runtime.env.DB;

  // Search mode: ?q=query
  const q = url.searchParams.get('q')?.trim();
  if (q) {
    if (q.length < 2) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const results = await searchCountiesForCalculator(db, q, 10);
    return new Response(JSON.stringify(results), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  // Lookup mode: ?fips=XXXXX
  const fips = url.searchParams.get('fips')?.trim();
  if (fips) {
    const county = await getCountyDataForCalculator(db, fips);
    if (!county) {
      return new Response(JSON.stringify({ error: 'County not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(county), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  return new Response(JSON.stringify({ error: 'Provide ?q= or ?fips= parameter' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
