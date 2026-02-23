import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

  if (!query.trim()) {
    return new Response(JSON.stringify({ results: [], query: '' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = (locals as any).runtime.env.DB;
  const like = '%' + query.trim() + '%';
  const { results } = await db.prepare(`
    SELECT fips, name, state, slug, center_infant, center_toddler, center_preschool,
           family_infant, median_income, poverty_rate
    FROM counties
    WHERE name LIKE ? OR state LIKE ? OR fips = ?
    ORDER BY population DESC
    LIMIT ?
  `).bind(like, like, query.trim(), limit).all();

  return new Response(JSON.stringify({ results, query: query.trim() }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
