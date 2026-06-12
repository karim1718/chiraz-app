#!/usr/bin/env node
/**
 * Generates public/sitemap.xml with static public routes.
 * Set SITE_URL env for absolute URLs (recommended for production builds).
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const siteUrl = (process.env.VITE_SITE_URL || process.env.SITE_URL || '').replace(/\/$/, '');

const routes = [
  '/',
  '/shop',
  '/about',
  '/contact',
  '/faq',
  '/returns',
  '/legal',
  '/privacy',
];

const today = new Date().toISOString().slice(0, 10);

const urls = routes
  .map((path) => {
    const loc = siteUrl ? `${siteUrl}${path === '/' ? '' : path}` : path;
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${path === '/' ? 'daily' : 'weekly'}</changefreq>
    <priority>${path === '/' ? '1.0' : '0.8'}</priority>
  </url>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

writeFileSync(join(root, 'public/sitemap.xml'), xml, 'utf8');
console.log('Wrote public/sitemap.xml');
