// The experiments shown on the home page, in display order.
//
// To add an experiment:
//   1. Put its logo (SVG preferred, roughly square) in src/assets/projects/.
//   2. Add an entry below.
//   3. Run `npm run build`. The build checks every entry and stops with a
//      clear message if something is missing.
//
// Fields
//   id           unique, lowercase-with-dashes; used for CSS hooks and anchors
//   name         display name
//   url          external website (https://)
//   category     short label, e.g. 'Reading & Creativity'
//   tagline      one short line
//   description  one or two sentences, plain text
//   note         optional; one short line shown under the description
//   links        optional; extra links shown beside the main website link,
//                e.g. [{ label: 'Chrome extension', url: 'https://…' }].
//                Use url: 'contact' to link to the contact email, with the
//                project name as the subject.
//   status       'live' | 'in-development' | 'paused' | 'archived'
//   logo         file name inside src/assets/projects/
//   theme        colours for the project's tile, taken from its own brand.
//                bg = tile background, accent = link and highlight colour.
//                Provide both light and dark variants.

export default [
  {
    id: 'the-still-network',
    name: 'The Still Network',
    url: 'https://www.thestillnetwork.com',
    category: 'Stillness & Well-being',
    tagline: 'A little time for nothing.',
    description:
      'A social stillness app that helps people make time for quiet in their everyday lives. No feeds, no streaks, no noise. Just time for yourself.',
    status: 'in-development',
    logo: 'the-still-network.svg',
    theme: {
      light: { bg: '#EEEADF', accent: '#5E6F55' },
      dark: { bg: '#262825', accent: '#9DB290' },
    },
  },
  {
    id: 'my-writers-circle',
    name: 'My Writers Circle',
    url: 'https://findmywriterscircle.com',
    category: 'Reading & Creativity',
    tagline: 'More meaningful reading.',
    description:
      'A quieter way to keep up with the writers you care about. Discover meaningful writing, create your own daily newspaper, and explore books published by your writing community.',
    status: 'live',
    links: [
      {
        label: 'Chrome extension',
        url: 'https://chromewebstore.google.com/detail/mywriterscircle/bphnffgidonlihneofmpnpcpmonfhnhh',
      },
    ],
    logo: 'my-writers-circle.svg',
    theme: {
      light: { bg: '#E7F0EC', accent: '#236359' },
      dark: { bg: '#1F2B28', accent: '#5FB3A5' },
    },
  },
  {
    id: 'universal-tech-care',
    name: 'Universal Tech Care',
    url: 'https://universaltechcare.org',
    category: 'Technology & Community',
    tagline: 'Making technology more approachable.',
    description:
      'An initiative to help people navigate technology with greater confidence, recognize potential scams, and find trustworthy human guidance when they need it.',
    note: 'Part of my giving-back work. I’m looking for partners to build it with.',
    links: [{ label: 'Partner on this', url: 'contact' }],
    status: 'live',
    logo: 'universal-tech-care.svg',
    theme: {
      light: { bg: '#E6EEF6', accent: '#0A4580' },
      dark: { bg: '#18222D', accent: '#7DB4EA' },
    },
  },
  {
    id: 'pickwise',
    name: 'Pickwise',
    url: 'https://github.com/vijayrkn/pickwise',
    category: 'AI Agents & Markets',
    tagline: 'One well-reasoned stock idea a day.',
    description:
      'An autonomous AI research agent that screens US large caps, researches a shortlist with Claude, and publishes one stock idea every trading day. It keeps score of itself against the S&P 500, misses included.',
    note: 'An experiment in agent design, not financial advice.',
    status: 'live',
    logo: 'pickwise.svg',
    theme: {
      light: { bg: '#F2EAE2', accent: '#8E4426' },
      dark: { bg: '#2A221D', accent: '#E39B7B' },
    },
  },
];
