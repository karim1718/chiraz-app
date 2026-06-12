#!/usr/bin/env node
/**
 * Post-build prerender: copies index.html for key routes so crawlers get shell faster.
 * Full JS hydration still required; pair with react-helmet-async for meta tags.
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, '..', 'dist');
const index = join(dist, 'index.html');

if (!existsSync(index)) {
  console.warn('dist/index.html not found — run vite build first');
  process.exit(0);
}

const routes = ['shop', 'about', 'contact', 'faq', 'returns', 'legal', 'privacy'];

for (const route of routes) {
  const dir = join(dist, route);
  mkdirSync(dir, { recursive: true });
  copyFileSync(index, join(dir, 'index.html'));
  console.log(`Prerendered /${route}/index.html`);
}

console.log('Prerender complete');
