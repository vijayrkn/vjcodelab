// Builds the site, then checks every link and asset reference in dist/.
//
//   npm run check             # internal + external links
//   npm run check -- --offline  # internal only

import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const offline = process.argv.includes('--offline');

await build();

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? htmlFiles(p) : p.endsWith('.html') ? [p] : [];
  }));
  return files.flat();
}

const exists = (p) => access(p).then(() => true, () => false);
const problems = [];
const external = new Map(); // url -> pages referencing it
const pages = new Map(); // urlPath -> html

for (const file of await htmlFiles(dist)) {
  const rel = '/' + path.relative(dist, file).replace(/index\.html$/, '');
  pages.set(rel, await readFile(file, 'utf8'));
}

for (const [pagePath, htmlText] of pages) {
  const refs = [...htmlText.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  for (const ref of refs) {
    if (ref.startsWith('mailto:')) {
      if (!/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ref)) problems.push(`${pagePath}: bad mailto ${ref}`);
      continue;
    }
    if (/^https?:\/\//.test(ref)) {
      if (!external.has(ref)) external.set(ref, new Set());
      external.get(ref).add(pagePath);
      continue;
    }
    const url = new URL(ref, `http://site${pagePath}`);
    const target = url.pathname;
    if (url.hash) {
      const doc = pages.get(target);
      const id = url.hash.slice(1);
      if (!doc || !doc.includes(`id="${id}"`)) problems.push(`${pagePath}: anchor ${ref} has no target`);
    }
    let file = path.join(dist, decodeURIComponent(target));
    if (target.endsWith('/')) file = path.join(file, 'index.html');
    if (!(await exists(file))) problems.push(`${pagePath}: ${ref} → missing file`);
  }
}

// Every page should have a title, description and exactly one h1.
for (const [pagePath, htmlText] of pages) {
  if (!/<title>[^<]+<\/title>/.test(htmlText)) problems.push(`${pagePath}: missing <title>`);
  if (!/<meta name="description" content="[^"]+">/.test(htmlText)) problems.push(`${pagePath}: missing description`);
  const h1s = (htmlText.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) problems.push(`${pagePath}: expected one <h1>, found ${h1s}`);
}

if (!offline) {
  // Canonical/OG URLs point at the production domain, which may not be
  // deployed yet; only check links that leave the site.
  const own = new URL((await import('../config/site.mjs')).default.url).hostname;
  const targets = [...external.keys()].filter((u) => new URL(u).hostname !== own);
  await Promise.all(targets.map(async (url) => {
    try {
      let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000) });
      if (res.status === 405 || res.status === 403) {
        res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
      }
      const note = res.url !== url ? ` (→ ${res.url})` : '';
      console.log(`${res.ok ? 'ok  ' : 'FAIL'} ${res.status} ${url}${note}`);
      if (!res.ok) problems.push(`${url} returned ${res.status}`);
    } catch (err) {
      console.log(`FAIL ---  ${url} (${err.cause?.code || err.name})`);
      problems.push(`${url} unreachable`);
    }
  }));
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`\nAll links OK across ${pages.size} pages${offline ? ' (external links skipped)' : ''}.`);
