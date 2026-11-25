// Builds the static site into dist/. No dependencies: Node 18+ only.
//
//   node scripts/build.mjs
//
// Reads config/site.mjs and config/projects.mjs, renders every page,
// and writes robots.txt, sitemap.xml and the stylesheet alongside them.

import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const out = path.join(root, 'dist');

const STATUS_LABELS = {
  live: 'Live',
  'in-development': 'In development',
  paused: 'Paused',
  archived: 'Archived',
};

// ---------------------------------------------------------------- helpers

const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const html = (strings, ...values) =>
  strings.reduce((acc, s, i) => acc + s + (i < values.length ? [values[i]].flat().join('') : ''), '');

const pad = (n) => String(n).padStart(2, '0');
const hostOf = (url) => new URL(url).hostname.replace(/^www\./, '');

async function load(relPath) {
  // Query string defeats the module cache so `npm run dev` picks up edits.
  const url = pathToFileURL(path.join(root, relPath)).href + `?t=${Date.now()}`;
  return (await import(url)).default;
}

const exists = (p) => access(p).then(() => true, () => false);

// ------------------------------------------------------------- validation

const HEX = /^#[0-9a-f]{6}$/i;

async function validate(site, projects) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };

  need(/^https:\/\/[^/]+$/.test(site.url), 'site.url must be an https origin without a trailing slash');
  need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(site.email), 'site.email must be an email address');
  need(Array.isArray(projects) && projects.length > 0, 'config/projects.mjs must export a non-empty array');

  const ids = new Set();
  for (const [i, p] of (projects || []).entries()) {
    const where = `projects[${i}]${p?.id ? ` (${p.id})` : ''}`;
    for (const key of ['id', 'name', 'url', 'category', 'tagline', 'description', 'status', 'logo']) {
      need(typeof p[key] === 'string' && p[key].trim(), `${where}: "${key}" is required`);
    }
    need(/^[a-z0-9-]+$/.test(p.id || ''), `${where}: "id" must be lowercase letters, numbers and dashes`);
    need(!ids.has(p.id), `${where}: duplicate id`);
    ids.add(p.id);
    need(/^https:\/\//.test(p.url || ''), `${where}: "url" must start with https://`);
    need(p.status in STATUS_LABELS, `${where}: "status" must be one of ${Object.keys(STATUS_LABELS).join(', ')}`);
    for (const mode of ['light', 'dark']) {
      for (const key of ['bg', 'accent']) {
        need(HEX.test(p.theme?.[mode]?.[key] || ''), `${where}: theme.${mode}.${key} must be a #rrggbb colour`);
      }
    }
    need(p.note === undefined || (typeof p.note === 'string' && p.note.trim()), `${where}: "note" must be text if present`);
    need(p.links === undefined || Array.isArray(p.links), `${where}: "links" must be a list`);
    for (const [j, l] of (Array.isArray(p.links) ? p.links : []).entries()) {
      need(typeof l?.label === 'string' && l.label.trim(), `${where}: links[${j}].label is required`);
      need(l?.url === 'contact' || /^https:\/\//.test(l?.url || ''), `${where}: links[${j}].url must start with https:// or be 'contact'`);
    }
    if (p.logo) {
      need(await exists(path.join(src, 'assets/projects', p.logo)), `${where}: logo file src/assets/projects/${p.logo} not found`);
    }
  }

  if (errors.length) {
    throw new Error(`Configuration problems:\n  - ${errors.join('\n  - ')}`);
  }
}

// ------------------------------------------------------------------ CSS

function projectThemeCss(projects) {
  const rule = (mode) =>
    projects
      .map((p) => `.experiment[data-id="${p.id}"]{--tile-bg:${p.theme[mode].bg};--accent:${p.theme[mode].accent}}`)
      .join('\n');
  return `\n/* Generated from config/projects.mjs */\n${rule('light')}\n@media (prefers-color-scheme: dark){\n${rule('dark')}\n}\n`;
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

// ---------------------------------------------------------------- markup

const ICON_ARROW = '<svg viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false"><path d="M3 9 9 3M4 3h5v5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const MARK = (cls = 'brand-mark') =>
  `<svg class="${cls}" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false"><path class="b" d="M11.5 8.5 5 16l6.5 7.5M20.5 8.5 27 16l-6.5 7.5" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle class="d" cx="16" cy="16" r="2.9"/></svg>`;

function head({ site, title, description, pathname, cssHref, noindex = false, jsonLd = null }) {
  const canonical = site.url + pathname;
  const image = `${site.url}/assets/og-image.png`;
  const verification = process.env.GOOGLE_SITE_VERIFICATION || site.googleSiteVerification;
  return html`<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(canonical)}">`}
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="${site.themeColor.light}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${site.themeColor.dark}" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="${cssHref}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(`${site.name}: ${site.tagline}`)}">
<meta property="og:locale" content="${esc(site.locale)}">
<meta name="twitter:card" content="summary_large_image">
${verification ? `<meta name="google-site-verification" content="${esc(verification)}">` : ''}
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>`.replace(/\n{2,}/g, '\n');
}

function header({ site, onHome }) {
  const base = onHome ? '' : '/';
  return html`<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/"${onHome ? ' aria-current="page"' : ''}>${MARK()}<span>${esc(site.name)}</span></a>
    <nav class="site-nav" aria-label="Primary">
      <ul role="list">
        <li><a href="${base}#experiments">Experiments</a></li>
        <li><a href="${base}#about">About</a></li>
        <li><a href="${base}#contact">Contact</a></li>
      </ul>
    </nav>
  </div>
</header>`;
}

function footer({ site, year }) {
  return html`<footer class="site-footer">
  <div class="wrap">
    <div>
      <p class="name">${esc(site.name)}</p>
      <p class="line">${esc(site.footerLine)}</p>
      <p>&copy; ${year} ${esc(site.name)}</p>
    </div>
    <ul role="list">
      <li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>
      <li><a href="/privacy/">Privacy policy</a></li>
    </ul>
  </div>
</footer>`;
}

function page({ lang = 'en', headHtml, body }) {
  return `<!doctype html>\n<html lang="${lang}">\n${headHtml}\n<body>\n${body}\n</body>\n</html>\n`;
}

function extraLink(l, p, site) {
  if (l.url === 'contact') {
    const href = `mailto:${site.email}?subject=${encodeURIComponent(p.name)}`;
    return `<a class="extra" href="${esc(href)}">${esc(l.label)}</a>`;
  }
  return `<a class="extra" href="${esc(l.url)}">${esc(l.label)} ${ICON_ARROW}</a>`;
}

function experimentItem(p, i, site) {
  return html`
      <li class="experiment" data-id="${p.id}">
        <span class="index" aria-hidden="true">${pad(i + 1)}</span>
        <div class="tile" aria-hidden="true"><img src="/assets/projects/${esc(p.logo)}" alt="" width="64" height="64" decoding="async"></div>
        <div>
          <div class="meta">
            <span class="label">${esc(p.category)}</span>
            <span class="status" data-status="${p.status}"><span class="visually-hidden">Status: </span>${STATUS_LABELS[p.status]}</span>
          </div>
          <h3><a href="${esc(p.url)}">${esc(p.name)}</a></h3>
          <p class="tagline">${esc(p.tagline)}</p>
          <p class="description">${esc(p.description)}</p>
          ${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}
          <div class="links">
            <span class="visit" aria-hidden="true">${esc(hostOf(p.url))} ${ICON_ARROW}</span>
            ${(p.links || []).map((l) => extraLink(l, p, site))}
          </div>
        </div>
      </li>`;
}

function homeBody({ site, projects, year }) {
  return html`${header({ site, onHome: true })}
<main id="main">
  <section class="hero" aria-labelledby="hero-title">
    <div class="wrap">
      <h1 id="hero-title" class="tagline"><span class="visually-hidden">${esc(site.name)}: </span>${esc(site.tagline)}</h1>
      <p class="intro">${esc(site.intro)}</p>
    </div>
  </section>

  <section class="section" id="experiments" aria-labelledby="experiments-title">
    <div class="wrap">
      <div class="section-head">
        <h2 id="experiments-title">My experiments</h2>
        <span class="label" aria-hidden="true">${pad(projects.length)}</span>
      </div>
      <ol class="experiments" role="list">${projects.map((p, i) => experimentItem(p, i, site))}
      </ol>
    </div>
  </section>

  <section class="section" id="about" aria-labelledby="about-title">
    <div class="wrap split">
      <h2 id="about-title">About</h2>
      <div class="prose">
        <p class="lead">VJ CodeLab is a personal space for exploring ideas and turning some of them into reality.</p>
        <p>Behind it are 21 years of experience in software development.</p>
        <p>The projects here begin with a simple question: <em>what if?</em></p>
        <p>Some may grow into something bigger. Others may remain small experiments. The idea is to keep learning, keep building, and hopefully make something useful along the way.</p>
      </div>
    </div>
  </section>

  <section class="section" id="contact" aria-labelledby="contact-title">
    <div class="wrap split">
      <h2 id="contact-title">Contact</h2>
      <div class="prose">
        <p>For questions, ideas, or just to say hello.</p>
        <a class="contact-email" href="mailto:${esc(site.email)}">${esc(site.email)}</a>
      </div>
    </div>
  </section>
</main>
${footer({ site, year })}`;
}

function privacyBody({ site, year }) {
  const updated = new Date(`${site.privacyUpdated}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
  const email = `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>`;
  return html`${header({ site, onHome: false })}
<main id="main" class="page">
  <div class="wrap">
    <h1>Privacy policy</h1>
    <p class="updated label">Last updated <time datetime="${esc(site.privacyUpdated)}">${updated}</time></p>
    <div class="body">
      <p>This policy covers ${esc(hostOf(site.url))}, the website of ${esc(site.name)}. The short version: this site does not collect personal information about you.</p>

      <h2>What this site does not do</h2>
      <ul>
        <li>It does not use cookies or similar storage.</li>
        <li>It does not use analytics, tracking scripts, or advertising.</li>
        <li>It does not load fonts, scripts, or other resources from third parties.</li>
        <li>It has no accounts, forms, or mailing lists.</li>
      </ul>

      <h2>Hosting</h2>
      <p>Like any website, this one is served by a hosting provider. When your browser requests a page, the provider may automatically process technical information such as your IP address, browser type, and the time of the request, for example to deliver the page and protect against abuse. This is handled under the provider's own privacy policy. ${esc(site.name)} does not use this information to identify or profile visitors.</p>

      <h2>Email</h2>
      <p>If you write to ${email}, your message and email address are used only to read and reply to you. They are not shared or added to any list.</p>

      <h2>Links to other sites</h2>
      <p>This site links to the projects it describes and to other websites. Those sites have their own privacy policies, which apply when you visit them.</p>

      <h2>Changes</h2>
      <p>If this policy changes, the updated version will be posted on this page with a new date.</p>

      <h2>Questions</h2>
      <p>Questions about this policy are welcome at ${email}.</p>
    </div>
  </div>
</main>
${footer({ site, year })}`;
}

function notFoundBody({ site, year }) {
  return html`${header({ site, onHome: false })}
<main id="main" class="page">
  <div class="wrap">
    <h1>Nothing here.</h1>
    <div class="body">
      <p>This page doesn't exist, or it may have moved.</p>
      <p><a href="/">Return to the home page</a></p>
    </div>
  </div>
</main>
${footer({ site, year })}`;
}

// ----------------------------------------------------------------- build

export async function build() {
  const started = Date.now();
  const site = await load('config/site.mjs');
  const projects = await load('config/projects.mjs');
  await validate(site, projects);

  const year = new Date().getFullYear();

  await rm(out, { recursive: true, force: true });
  await mkdir(path.join(out, 'privacy'), { recursive: true });
  await cp(path.join(src, 'static'), out, { recursive: true });
  await cp(path.join(src, 'assets'), path.join(out, 'assets'), { recursive: true });

  // Stylesheet, versioned by content hash for cache busting.
  const css = minifyCss((await readFile(path.join(src, 'styles.css'), 'utf8')) + projectThemeCss(projects));
  const hash = createHash('sha256').update(css).digest('hex').slice(0, 10);
  await writeFile(path.join(out, 'assets/site.css'), css);
  const cssHref = `/assets/site.css?v=${hash}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: site.name, url: `${site.url}/`, description: site.description },
      {
        '@type': 'Organization',
        name: site.name,
        url: `${site.url}/`,
        logo: `${site.url}/apple-touch-icon.png`,
        email: site.email,
      },
    ],
  };

  const pages = [
    {
      file: 'index.html',
      headHtml: head({ site, title: `${site.name} · ${site.tagline}`, description: site.description, pathname: '/', cssHref, jsonLd }),
      body: homeBody({ site, projects, year }),
    },
    {
      file: 'privacy/index.html',
      headHtml: head({ site, title: `Privacy policy · ${site.name}`, description: `How ${site.name} handles your information: no cookies, no analytics, no tracking.`, pathname: '/privacy/', cssHref }),
      body: privacyBody({ site, year }),
    },
    {
      file: '404.html',
      headHtml: head({ site, title: `Not found · ${site.name}`, description: site.description, pathname: '/404.html', cssHref, noindex: true }),
      body: notFoundBody({ site, year }),
    },
  ];

  for (const p of pages) {
    await writeFile(path.join(out, p.file), page(p));
  }

  await writeFile(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
  await writeFile(
    path.join(out, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${site.url}/</loc></url>
  <url><loc>${site.url}/privacy/</loc><lastmod>${site.privacyUpdated}</lastmod></url>
</urlset>
`,
  );
  // Custom domain for GitHub Pages; ignored by other hosts.
  await writeFile(path.join(out, 'CNAME'), `${new URL(site.url).hostname}\n`);

  console.log(`Built ${pages.length} pages, ${projects.length} experiments → dist/ in ${Date.now() - started}ms`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
