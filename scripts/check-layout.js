/**
 * Game screen layout verification.
 *
 *   npm run build:web
 *   npm run check:layout
 *
 * Serves the built export and drives it in Chromium across a range of viewport
 * sizes, asserting that the board never overlaps the header above it or the
 * toolbar and pad below. Checking the export rather than the dev server means
 * this measures exactly what ships.
 *
 * Regions are found by testID (react-native-web renders these as data-testid),
 * so the check does not break when wording changes.
 *
 * Exits non-zero if any region overlaps another or leaves the screen.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIST = path.join(__dirname, '..', 'dist');
const BASE = (process.env.PAGES_BASE_URL || '').replace(/\/+$/, '');
const PORT = Number(process.env.LAYOUT_CHECK_PORT || 8123);

// Short screens are where the board ran out of room; keep one of each shape.
const VIEWPORTS = [
  { name: '360x640  short phone', width: 360, height: 640 },
  { name: '375x667  iPhone SE', width: 375, height: 667 },
  { name: '390x844  tall phone', width: 390, height: 844 },
  { name: '768x1024 tablet', width: 768, height: 1024 },
  { name: '1280x900 desktop', width: 1280, height: 900 },
];

// The largest grid is the tightest fit; the smallest exercises the size cap.
const DIFFICULTIES = ['하드코어', '쉬움'];

const MIN_PLAYABLE_BOARD = 120;

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.css': 'text/css', '.map': 'application/json', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

let failures = 0;
const fail = (msg) => { failures++; console.error('  FAIL: ' + msg); };

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
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.on('error', reject);
    server.listen(PORT, () => resolve(server));
  });
}

/** Vertical overlap between two rects, in pixels. */
const overlap = (a, b) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/index.html not found — run `npm run build:web` first');
    process.exit(1);
  }

  const server = await serve();
  const url = `http://localhost:${PORT}${BASE}/`;
  console.log('serving ' + DIST + ' at ' + url);

  const browser = await chromium.launch();

  for (const difficulty of DIFFICULTIES) {
    console.log('--- ' + difficulty + ' ---');

    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.width < 700,
        hasTouch: vp.width < 700,
      });
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e.message));

      await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
      await page.getByText(difficulty, { exact: true }).first().click({ timeout: 60000 });
      await page.getByText('시작하기', { exact: true }).first().click({ timeout: 60000 });
      await page.waitForSelector('[data-testid="game-board"]', { timeout: 60000 });
      await page.waitForTimeout(500);

      const m = await page.evaluate(() => {
        const box = (id) => {
          const el = document.querySelector('[data-testid="' + id + '"]');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height };
        };
        return {
          viewportW: window.innerWidth,
          viewportH: window.innerHeight,
          header: box('game-header'),
          board: box('game-board'),
          toolbar: box('game-toolbar'),
          pad: box('pad-area'),
        };
      });

      const where = vp.name.trim() + ' (' + difficulty + ')';
      const missing = ['header', 'board', 'toolbar', 'pad'].filter(k => !m[k]);
      if (missing.length) {
        fail(where + ': could not find ' + missing.join(', '));
        await page.close();
        continue;
      }

      const vsHeader = overlap(m.board, m.header);
      const vsToolbar = overlap(m.board, m.toolbar);
      const vsPad = overlap(m.board, m.pad);

      console.log('  ' + vp.name.padEnd(22) + 'board ' + Math.round(m.board.w) +
        'px   overlap header ' + Math.round(vsHeader) +
        ', toolbar ' + Math.round(vsToolbar) +
        ', pad ' + Math.round(vsPad));

      if (vsHeader > 0) fail(where + ': board overlaps the header by ' + Math.round(vsHeader) + 'px');
      if (vsToolbar > 0) fail(where + ': board overlaps the toolbar by ' + Math.round(vsToolbar) + 'px');
      if (vsPad > 0) fail(where + ': board overlaps the direction pad by ' + Math.round(vsPad) + 'px');
      if (m.pad.bottom > m.viewportH + 1) fail(where + ': the direction pad runs ' + Math.round(m.pad.bottom - m.viewportH) + 'px past the bottom of the screen');
      if (m.board.left < -1 || m.board.right > m.viewportW + 1) fail(where + ': board runs off the screen horizontally');
      if (m.board.w < MIN_PLAYABLE_BOARD) fail(where + ': board shrank to ' + Math.round(m.board.w) + 'px, too small to play');
      if (pageErrors.length) fail(where + ': page errors — ' + pageErrors.slice(0, 3).join(' | '));

      await page.close();
    }
  }

  await browser.close();
  server.close();

  console.log('');
  if (failures > 0) {
    console.error(failures + ' layout problem(s) FAILED');
    process.exit(1);
  }
  console.log('game screen layout holds at every viewport checked');
})().catch(e => { console.error('LAYOUT CHECK FAILED: ' + e.message); process.exit(1); });
