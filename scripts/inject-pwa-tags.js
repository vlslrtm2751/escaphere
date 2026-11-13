#!/usr/bin/env node
// Injects PWA tags into dist/index.html after `expo export` has run.
//
// Expo's own dist/index.html is edited in place rather than replaced,
// because the bundle <script> tag's filename carries a content hash that
// changes every build -- a hand-written static index.html couldn't know
// it in advance (see docs/superpowers/specs/2026-11-10-pwa-install-design.md §6.3/§4).
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const INDEX = path.join(DIST, 'index.html');
const MANIFEST = path.join(DIST, 'manifest.webmanifest');

const TAGS = [
  '<link rel="manifest" href="manifest.webmanifest" />',
  '<meta name="theme-color" content="#0f0f1a" />',
  '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />',
  '<script>if (\'serviceWorker\' in navigator) navigator.serviceWorker.register(\'sw.js\');</script>',
].join('\n');

function fail(message) {
  console.error('inject-pwa-tags: ' + message);
  process.exit(1);
}

if (!fs.existsSync(INDEX)) {
  fail(INDEX + ' not found -- run `expo export` first.');
}

const html = fs.readFileSync(INDEX, 'utf8');

const bundleMatch = html.match(/<script src="[^"]+" defer><\/script>/);
if (!bundleMatch) {
  fail('could not find the bundle <script> tag in ' + INDEX + '.');
}
if (!html.includes('</head>')) {
  fail('no </head> found in ' + INDEX + '.');
}

// An installed PWA reads as a web page, not an app, the moment a two-finger
// pinch is allowed to zoom it -- disable zooming the same way a native app's
// webview would. Expo's own viewport tag is replaced, not left in place
// alongside a second one: multiple viewport metas is undefined behaviour
// across browsers, where overwriting the one that exists is well-defined.
const VIEWPORT_MATCH = /<meta name="viewport" content="[^"]*" \/>/;
const VIEWPORT_TAG = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />';
if (!VIEWPORT_MATCH.test(html)) {
  fail('could not find the viewport <meta> tag in ' + INDEX + '.');
}

const withViewport = html.replace(VIEWPORT_MATCH, VIEWPORT_TAG);
fs.writeFileSync(INDEX, withViewport.replace('</head>', TAGS + '\n</head>'));

// Self-verify: read back what was actually written, rather than trust the
// replace above. Catches a future Expo template change that moves or
// renames something this script depends on.
const written = fs.readFileSync(INDEX, 'utf8');
const expectations = [
  ['manifest link', 'rel="manifest"'],
  ['theme-color meta', 'name="theme-color"'],
  ['apple-touch-icon link', 'rel="apple-touch-icon"'],
  ['service worker register', 'serviceWorker.register'],
];
const missing = expectations.filter(([, needle]) => !written.includes(needle));
if (missing.length > 0) {
  fail('missing after injection: ' + missing.map(([name]) => name).join(', ') + '.');
}
if (!written.includes(bundleMatch[0])) {
  fail('the bundle <script> tag changed during injection.');
}
if (!written.includes(VIEWPORT_TAG)) {
  fail('the viewport <meta> tag was not replaced as expected.');
}

// Every file the tags above and the manifest point at must actually exist in
// dist/. A rename that leaves one behind is otherwise completely silent at
// runtime: the service worker's install handler would just skip it, and a
// 404 manifest icon or a missing sw.js costs the install prompt with nothing
// anywhere saying why.
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
} catch (e) {
  // fail() rather than an uncaught throw, so a missing or malformed manifest
  // reports in this script's own voice like every other check here.
  fail('could not read ' + MANIFEST + ' -- ' + e.message);
}
const referenced = [
  'sw.js',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  ...manifest.icons.map((icon) => icon.src),
];
const absent = referenced.filter((p) => !fs.existsSync(path.join(DIST, p)));
if (absent.length > 0) {
  fail('referenced by the injected tags/manifest but missing from dist: ' + absent.join(', ') + '.');
}

console.log('inject-pwa-tags: OK (' + INDEX + ')');
