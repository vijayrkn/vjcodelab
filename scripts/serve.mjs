// Local preview server for dist/. Mirrors static-host behaviour:
// folders serve index.html and unknown paths get 404.html.
//
//   node scripts/serve.mjs           # serve dist/
//   node scripts/serve.mjs --watch   # rebuild on changes, then serve

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT) || 4321;
const shouldWatch = process.argv.includes('--watch');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

async function resolveFile(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(dist, clean);
  if (!file.startsWith(dist)) return null;
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = path.join(file, 'index.html');
    await stat(file);
    return file;
  } catch {
    return null;
  }
}

// Each build runs in a fresh Node process so edits to the build script
// itself are picked up, not just edits to config and source files.
const build = () =>
  new Promise((resolve) => {
    execFile(process.execPath, [path.join(root, 'scripts/build.mjs')], (err, stdout, stderr) => {
      process.stdout.write(stdout);
      if (err) process.stderr.write(stderr || err.message);
      resolve(!err);
    });
  });

await build();

if (shouldWatch) {
  let timer;
  for (const dir of ['src', 'config', 'scripts']) {
    watch(path.join(root, dir), { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(build, 80);
    });
  }
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const file = await resolveFile(pathname);
  if (file) {
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } else {
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    res.end(await readFile(path.join(dist, '404.html')).catch(() => 'Not found'));
  }
}).listen(port, () => {
  console.log(`Serving dist/ at http://localhost:${port}${shouldWatch ? ' (watching for changes)' : ''}`);
});
