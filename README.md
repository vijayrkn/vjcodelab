# VJ CodeLab

A space for ideas and experiments. Source for [vjcodelab.com](https://vjcodelab.com).

A small static site: plain HTML and CSS produced by a zero-dependency Node build script. There is no framework, no JavaScript shipped to visitors, no cookies, no analytics, and no third-party requests.

## Requirements

Node.js 18.17 or newer. There is nothing to install: no `npm install` step, no `node_modules`.

## Local development

```bash
npm run dev
```

This builds the site into `dist/`, serves it at http://localhost:4321, and rebuilds when anything in `src/` or `config/` changes. Refresh the browser to see changes.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` | Build the site into `dist/` |
| `npm run preview` | Build once and serve `dist/` |
| `npm run check` | Build, then check every internal link, anchor and asset, and request each external link |
| `npm run check -- --offline` | Same, without contacting external sites |
| `npm run images` | Re-render the social card and Apple touch icon (needs Chrome; see below) |

## Project layout

```
config/
  site.mjs          Site name, URL, tagline, contact email, Search Console token
  projects.mjs      The experiments shown on the home page
src/
  styles.css        The only stylesheet
  assets/           Logo, social card, project logos (copied to /assets/)
  static/           Files copied to the site root: favicon, touch icon, _headers
scripts/
  build.mjs         Renders every page, robots.txt, sitemap.xml and CNAME
  serve.mjs         Local preview server
  check.mjs         Link and asset checker
  render-images.mjs Rebuilds PNGs from scripts/images/*.html
.github/workflows/
  deploy.yml        GitHub Pages deployment
```

## Common changes

### Add an experiment

1. Add its logo to `src/assets/projects/`. A square SVG is best.
2. Add an entry to `config/projects.mjs`. The comment at the top of that file explains each field. `theme` holds the tile background and accent colour for light and dark mode, taken from the project's own brand.
3. Run `npm run check`.

The build validates every entry and stops with a specific message if a field is missing, a colour is malformed, or the logo file can't be found. Numbering, the count, and the per-project colours are all generated, so no HTML or CSS edits are needed.

Optional fields: `note` adds a short line under the description, and `links` adds extra links such as an app store listing, or `contact` for an email link.

Status can be `live`, `in-development`, `paused` or `archived`.

### Change the contact email

Edit `email` in `config/site.mjs`, for example to `hello@vjcodelab.com`, and rebuild. The header, contact section, footer, privacy policy and structured data all use this value.

### Google Search Console

Search Console offers several ways to verify the site. Either:

- **DNS record (recommended).** Add the TXT record Search Console gives you at your DNS provider. No code change is needed, and it covers every subdomain.
- **HTML tag.** Copy only the `content` value from the tag Search Console gives you, then either:
  - put it in `googleSiteVerification` in `config/site.mjs`, or
  - set it as the `GOOGLE_SITE_VERIFICATION` environment variable at build time. On GitHub, add it as a repository **variable** (Settings → Secrets and variables → Actions → Variables). On Cloudflare Pages, add it under Settings → Environment variables.

The verification meta tag is only output when a value is present.

Once the site is verified, submit `https://vjcodelab.com/sitemap.xml` in Search Console.

### Update the privacy policy

The policy text is in `privacyBody()` in `scripts/build.mjs`. If you change it, also update `privacyUpdated` in `config/site.mjs`. The policy currently states that the site sets no cookies, runs no analytics, and makes no third-party requests. If you ever add any of these, update the policy to match.

### Social card and icons

`src/assets/og-image.png` (1200×630) and `src/static/apple-touch-icon.png` (180×180) are rendered from `scripts/images/og.html` and `scripts/images/icon.html`. After editing those, run `npm run images`. It looks for Chrome in the usual places; set `CHROME=/path/to/chrome` to use another location. The PNGs are committed, so deployments never need Chrome.

`src/static/favicon.svg` adapts to light and dark browser themes on its own.

## Deployment

The build output in `dist/` is plain static files and works on any static host.

### GitHub Pages

1. Push the repository to GitHub with `main` as the default branch.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Under **Custom domain** on the same page, enter `vjcodelab.com`, then enable **Enforce HTTPS** once the certificate is issued.
4. At your DNS provider, point the apex domain at GitHub Pages using the A/AAAA records in GitHub's documentation. Add a `www` CNAME to `<username>.github.io` if you want `www` to redirect.

Each push to `main` builds the site, checks internal links, and deploys. The workflow also runs on 1 January so the footer year stays current.

Note: GitHub Pages ignores `_headers`, so the security headers below only apply on Cloudflare Pages.

### Cloudflare Pages

1. Create a Pages project connected to the repository.
2. Leave the framework preset as **None**. Set the build command to `npm run build` and the build output directory to `dist`.
3. Set the environment variable `NODE_VERSION=22`.
4. Add `vjcodelab.com` under **Custom domains**.

Cloudflare applies `src/static/_headers`, which sets a strict Content-Security-Policy and other security headers. Cloudflare only rebuilds when you push, so redeploy once in January (or add a scheduled deploy hook) to roll the footer year over.

## Project assets

The project logos in `src/assets/projects/` are the public favicons/marks published by each project's own website:

- The Still Network: thestillnetwork.com/favicon.svg
- My Writers Circle: findmywriterscircle.com/favicon.svg
- Universal Tech Care: universaltechcare.com/icon.svg

The tile colours in `config/projects.mjs` come from each site's published stylesheet. Universal Tech Care publishes no light or dark page tones, so its tile tints are derived from the blues in its logo.
