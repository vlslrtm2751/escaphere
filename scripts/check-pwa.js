/**
 * PWA offline/update verification.
 *
 *   npm run build:web
 *   npm run check:pwa
 *
 * Serves the built export (optionally under the GitHub Pages subpath, via
 * PAGES_BASE_URL -- same pattern as check-layout.js) and drives it in
 * Chromium to prove three things no static read of the code can:
 *   1. a page that installed the service worker once still loads when it
 *      goes offline before any second online visit
 *   2. a page reloaded online after a "redeploy" gets the new content, not
 *      a cached stale one
 *   3. both of the above hold under the real GitHub Pages subpath, not just
 *      at the server root
 *
 * Exits non-zero on any failure.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIST = path.join(__dirname, '..', 'dist');
const BASE = (process.env.PAGES_BASE_URL || '/escaphere').replace(/\/+$/, '');
const PORT = Number(process.env.PWA_CHECK_PORT || 8124);

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.css': 'text/css', '.map': 'application/json', '.svg': 'image/svg+xml',
};

let failures = 0;
const fail = (msg) => { failures++; console.error('  FAIL: ' + msg); };

// `redeployed` flips mid-run to simulate a new deploy landing on the
// server, without paying for a second real `expo export`. Only index.html
// is affected -- the rest of dist/ (including the hashed bundle) is served
// unchanged, matching what a real redeploy of unrelated content would do.
let redeployed = false;

function serve() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let url = decodeURIComponent(req.url.split('?')[0]);
      if (BASE && url.startsWith(BASE)) url = url.slice(BASE.length);
      if (!url || url === '/') url = '/index.html';
      const file = path.join(DIST, url);
      if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('not found: ' + url); }
        let body = buf;
        if (url === '/index.html' && redeployed) {
          body = Buffer.from(buf.toString('utf8') + '\n<!-- deploy-marker: v2 -->\n');
        }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(body);
      });
    });
    server.on('error', reject);
    server.listen(PORT, () => resolve(server));
  });
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/index.html not found -- run `npm run build:web` first');
    process.exit(1);
  }

  const server = await serve();
  const url = `http://localhost:${PORT}${BASE}/`;
  console.log('serving ' + DIST + ' at ' + url + ' (simulating PAGES_BASE_URL=' + BASE + ')');

  const browser = await chromium.launch();

  // ---- Scenario 1: one visit online, then offline, then relaunch ----
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => 'serviceWorker' in navigator, { timeout: 10000 });
    await page.evaluate(() => navigator.serviceWorker.ready);

    const cachedUrls = await page.evaluate(async () => {
      const cache = await caches.open('escaphere-shell-v1');
      const keys = await cache.keys();
      return keys.map((r) => r.url);
    });
    const hasBundle = cachedUrls.some((u) => u.includes('_expo/static/js/web/'));
    if (!hasBundle) {
      fail('scenario 1: the JS bundle was never precached by the install handler. Cached: ' + JSON.stringify(cachedUrls));
    }

    await context.setOffline(true);
    pageErrors.length = 0;
    await page.reload({ waitUntil: 'networkidle', timeout: 15000 }).catch((e) => {
      fail('scenario 1: reload while offline threw: ' + e.message);
    });
    const boardVisible = await page.locator('text=Escaphere').first().isVisible().catch(() => false);
    if (!boardVisible) fail('scenario 1: app did not render after going offline on the first-ever reload');
    if (pageErrors.length) fail('scenario 1: page errors while offline -- ' + pageErrors.slice(0, 3).join(' | '));

    await context.close();
  }

  // ---- Scenario 2: online reload after a "redeploy" gets fresh content ----
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => navigator.serviceWorker.ready);

    redeployed = true;
    const resp = await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
    // Read the navigation response's own body, not page.content() (doctype +
    // documentElement.outerHTML). The marker is appended after </html>, which
    // HTML parsing attaches as a Document-level sibling of <html> -- outside
    // what documentElement.outerHTML can ever include. Confirmed directly:
    // document.childNodes is ['html'(doctype), 'HTML', '#comment'] once parsed,
    // so page.content() is structurally blind to it regardless of which
    // content actually loaded. The raw response body has no such blind spot.
    const body = resp ? await resp.text() : '';
    if (!body.includes('deploy-marker: v2')) {
      fail('scenario 2: online reload after a redeploy served the cached index.html instead of fetching the new one');
    }
    redeployed = false;

    await context.close();
  }

  await browser.close();
  server.close();

  console.log('');
  if (failures > 0) {
    console.error(failures + ' PWA check(s) FAILED');
    process.exit(1);
  }
  console.log('PWA offline/update behaviour holds under ' + BASE + '/');
})().catch((e) => { console.error('PWA CHECK FAILED: ' + e.message); process.exit(1); });
