import type { APIRoute } from 'astro';

const CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=300, s-maxage=3600',
};

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const trimmed = query.trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '15'), 15);

  if (trimmed.length < 2) {
    return new Response(JSON.stringify({ results: [], query: '' }), {
      headers: CACHE_HEADERS,
    });
  }

  const db = (locals as any).runtime.env.DB;
  const prefix = trimmed + '%';
  const { results } = await db.prepare(`
    SELECT fips, name, state, slug, center_infant, center_toddler, center_preschool,
           family_infant, median_income, poverty_rate
    FROM counties
    WHERE name LIKE ? OR state LIKE ? OR fips = ?
    ORDER BY population DESC
    LIMIT ?
  `).bind(prefix, prefix, trimmed, limit).all();

  return new Response(JSON.stringify({ results, query: trimmed }), {
    headers: CACHE_HEADERS,
  });
};
