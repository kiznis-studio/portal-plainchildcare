import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const base = 'https://plainchildcare.com';
  const pages = [
    '/', '/state', '/rankings', '/rankings/affordability-deserts', '/calculator', '/search',
    '/guides', '/guides/childcare-subsidy-programs', '/guides/employer-childcare-benefits',
    '/guides/cheapest-states-childcare-2026', '/guides/daycare-vs-home-daycare',
    '/guides/childcare-tax-credits-guide',
    '/about', '/privacy', '/terms',
  ];

  const urls = pages.map(p => `  <url><loc>${base}${p}</loc><changefreq>weekly</changefreq><priority>${p === '/' ? '1.0' : '0.7'}</priority></url>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
