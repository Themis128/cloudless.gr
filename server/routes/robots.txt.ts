// This file handles the generation of a robots.txt for search engine crawlers
// For Nuxt 3, place this in the server/routes directory

import { defineEventHandler, setResponseHeader } from 'h3'

export default defineEventHandler((event) => {
  // Set the appropriate content type
  setResponseHeader(event, 'Content-Type', 'text/plain');
  
  // Get the base URL from environment or use a default
  const baseUrl = 'https://cloudless.gr';
  
  // Generate the robots.txt content
  const robotsTxt = `# robots.txt for ${baseUrl}
User-agent: *
Allow: /
Disallow: /auth/
Disallow: /admin/
Disallow: /dashboard/
Disallow: /profile/
Disallow: /settings/

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml
`;
  
  // Return the robots.txt content
  return robotsTxt;
});
