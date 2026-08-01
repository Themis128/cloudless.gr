export default function robots() {
  const robotsText = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /store/success

Sitemap: https://cloudless.gr/sitemap.xml
Content-Signal: ai-train=no, search=yes, ai-input=no
`;

  return new Response(robotsText, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
