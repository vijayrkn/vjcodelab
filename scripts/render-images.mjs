// Re-renders the raster images (social card + Apple touch icon) from the
// HTML sources in scripts/images/. Only needed when the brand changes; the
// PNGs are committed, so normal builds never run this.
//
// Requires a local Chrome/Chromium. Override the path with CHROME=/path/to/chrome.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const candidates = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const chrome = candidates.find((p) => existsSync(p));
if (!chrome) {
  console.error('Chrome not found. Set CHROME=/path/to/chrome and try again.');
  process.exit(1);
}

const jobs = [
  { src: 'og.html', out: 'src/assets/og-image.png', size: '1200,630' },
  { src: 'icon.html', out: 'src/static/apple-touch-icon.png', size: '180,180' },
];

for (const { src, out, size } of jobs) {
  const url = pathToFileURL(path.join(root, 'scripts/images', src)).href;
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${size}`,
    `--screenshot=${path.join(root, out)}`,
    url,
  ], { stdio: 'ignore' });
  console.log(`rendered ${out}`);
}
