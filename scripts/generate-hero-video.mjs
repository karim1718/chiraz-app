#!/usr/bin/env node
/**
 * Generates optimized hero video (WebM + MP4) and poster WebP from JPG frame sequence.
 * Requires ffmpeg: brew install ffmpeg
 *
 * Usage: node scripts/generate-hero-video.mjs
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const photosDir = join(root, 'public/photos');
const framePattern = join(
  photosDir,
  'Penny_loafer_on_marble_slab_243e7581b3 (1)_%03d.jpg',
);
const posterSrc = join(photosDir, 'Penny_loafer_on_marble_slab_243e7581b3 (1)_000.jpg');
const posterOut = join(photosDir, 'hero-poster.webp');
const webmOut = join(photosDir, 'hero.webm');
const mp4Out = join(photosDir, 'hero.mp4');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root });
}

if (!existsSync(posterSrc)) {
  console.error('Frame sequence not found. Expected:', posterSrc);
  process.exit(1);
}

mkdirSync(photosDir, { recursive: true });

// Poster from first frame (~40–60 KB WebP, fallback to JPEG if libwebp unavailable)
try {
  run(
    `ffmpeg -y -i "${posterSrc}" -vf "scale=1280:-2" -c:v libwebp -quality 80 "${posterOut}"`,
  );
} catch {
  const posterJpg = join(photosDir, 'hero-poster.jpg');
  run(
    `ffmpeg -y -i "${posterSrc}" -vf "scale=1280:-2" -q:v 3 "${posterJpg}"`,
  );
  console.warn('libwebp unavailable — using hero-poster.jpg instead of .webp');
}

// WebM VP9 — ~500 KB target at 24fps, hold last frame (no loop in player)
run(
  `ffmpeg -y -framerate 24 -i "${framePattern}" -c:v libvpx-vp9 -crf 35 -b:v 0 -pix_fmt yuv420p -an -vf "scale=1280:-2" "${webmOut}"`,
);

// MP4 H.264 fallback
run(
  `ffmpeg -y -framerate 24 -i "${framePattern}" -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart -an -vf "scale=1280:-2" "${mp4Out}"`,
);

console.log('\nDone. Generated:');
console.log(' -', posterOut);
console.log(' -', webmOut);
console.log(' -', mp4Out);
