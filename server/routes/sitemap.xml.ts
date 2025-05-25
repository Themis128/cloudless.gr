// This file handles the generation of a sitemap.xml for better SEO
// For Nuxt 3, place this in the server/routes directory

export default defineEventHandler(async (event) => {
  // Set the appropriate XML content type
  setResponseHeader(event, 'Content-Type', 'text/xml');
  
  // Get the base URL from environment or use a default
  const baseUrl = 'https://cloudless.gr';
  
  // Current date in ISO format for lastmod
  const now = new Date().toISOString();
  
  // Define your routes - in a real app, this might come from a database or API
  const routes = [
    { path: '/', priority: 1.0, changefreq: 'weekly' },
    { path: '/projects', priority: 0.9, changefreq: 'weekly' },
    { path: '/about', priority: 0.8, changefreq: 'monthly' },
    { path: '/contact', priority: 0.8, changefreq: 'monthly' },
    { path: '/codegen', priority: 0.8, changefreq: 'monthly' },
    { path: '/faq', priority: 0.7, changefreq: 'monthly' },
    { path: '/terms', priority: 0.6, changefreq: 'yearly' },
    { path: '/sitemap', priority: 0.5, changefreq: 'monthly' },
    { path: '/responsive-demo', priority: 0.5, changefreq: 'monthly' },
    // Don't include auth pages or admin pages in sitemap
  ];
  
  // Generate the XML
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(route => `  <url>
    <loc>${baseUrl}${route.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  
  // Return the sitemap XML
  return sitemap;
});
