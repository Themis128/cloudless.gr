import { defineEventHandler } from 'h3';

export default defineEventHandler(async (event) => {
  // Use OAuth Bearer token for authentication
  const CREDLY_ACCESS_TOKEN = process.env.CREDLY_ACCESS_TOKEN;
  const ORG_ID = process.env.CREDLY_ORG_ID || 'cisco';

  if (!CREDLY_ACCESS_TOKEN || !ORG_ID) {
    return { error: 'Missing Credly API credentials.' };
  }

  // Fetch badge templates instead of issued badges
  const res = await fetch(`https://api.credly.com/v1/organizations/${ORG_ID}/badge_templates`, {
    headers: {
      Authorization: `Bearer ${CREDLY_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
  const data = await res.json();
  return data;
});
