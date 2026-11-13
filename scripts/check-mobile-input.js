/**
 * Mobile-input verification: pinch-zoom, margin swipe, and the Android/PWA
 * back button.
 *
 *   npm run build:web
 *   npm run check:mobile-input
 *
 * Serves the built export and drives it in Chromium. Checking the export
 * rather than the dev server means this measures exactly what ships.
 *
 * Exits non-zero if any of the three checks fails.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = Number(process.env.MOBILE_INPUT_CHECK_PORT || 8125);

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

/** Reads the move counter off the game header ("이동: N회"). */
async function moveCount(page) {
  const text = await page.locator('text=/이동: \\d+회/').first().innerText();
  const match = text.match(/이동: (\d+)회/);
  return match ? Number(match[1]) : null;
}

async function enterGame(page, url, difficulty = '쉬움') {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByText(difficulty, { exact: true }).first().click({ timeout: 60000 });
  await page.getByText('시작하기', { exact: true }).first().click({ timeout: 60000 });
  await page.waitForSelector('[data-testid="game-board"]', { timeout: 60000 });
  await page.waitForTimeout(300);
}

/** Drags from the centre of `testId`'s box by (dx, dy) via mouse emulation. */
async function dragBox(page, testId, dx, dy) {
  const box = await page.locator('[data-testid="' + testId + '"]').boundingBox();
  if (!box) throw new Error('could not find element: ' + testId);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
  }
  await page.mouse.up();
}

async function checkPinchZoomDisabled(browser, url) {
  console.log('--- 핀치 줌 방지 ---');
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  const content = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    return meta ? meta.getAttribute('content') : null;
  });
  console.log('  viewport meta: ' + content);
  if (!content) {
    fail('pinch-zoom: no viewport <meta> tag found in the rendered page');
  } else {
    if (!content.includes('maximum-scale=1')) fail('pinch-zoom: viewport meta missing maximum-scale=1');
    if (!content.includes('user-scalable=no')) fail('pinch-zoom: viewport meta missing user-scalable=no');
  }
  await page.close();
}

async function checkMarginSwipe(browser, url) {
  console.log('--- 여백 스와이프 (갤럭시 폴드 가정, 900x700) ---');
  const page = await browser.newPage({
    viewport: { width: 900, height: 700 },
    isMobile: true,
    hasTouch: true,
  });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await enterGame(page, url);

  const leftBox = await page.locator('[data-testid="side-margin-left"]').boundingBox();
  const rightBox = await page.locator('[data-testid="side-margin-right"]').boundingBox();
  console.log('  side-margin-left width ' + Math.round(leftBox?.width || 0) +
    'px, side-margin-right width ' + Math.round(rightBox?.width || 0) + 'px');
  if (!leftBox || leftBox.width < 40) fail('margin swipe: side-margin-left is too narrow to drag in (' + leftBox?.width + 'px) -- is the row layout centring correctly at this width?');
  if (!rightBox || rightBox.width < 40) fail('margin swipe: side-margin-right is too narrow to drag in (' + rightBox?.width + 'px)');

  // A fresh board guarantees at least one legal first move (minStartOptions),
  // but not which direction -- try all four and accept the first that
  // actually advances the move counter, same as a human would just try again.
  const DIRS = [[0, 60], [0, -60], [-60, 0], [60, 0]];

  for (const [zone, label] of [['side-margin-left', '좌측 여백'], ['side-margin-right', '우측 여백']]) {
    const before = await moveCount(page);
    let moved = false;
    for (const [dx, dy] of DIRS) {
      await dragBox(page, zone, dx, dy);
      await page.waitForTimeout(250);
      const after = await moveCount(page);
      if (after !== before) { moved = true; break; }
    }
    console.log('  ' + label + ': ' + (moved ? 'OK (이동수 변화 확인)' : 'FAIL (이동수 변화 없음)'));
    if (!moved) fail('margin swipe: dragging ' + zone + ' in any of the 4 directions never changed the move count');
  }

  if (pageErrors.length) fail('margin swipe: page errors — ' + pageErrors.slice(0, 3).join(' | '));
  await page.close();
}

async function checkBackButtonPauseToggle(browser, url) {
  console.log('--- 뒤로가기 일시정지 토글 ---');
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await enterGame(page, url);

  const pauseVisible = () => page.getByText('일시정지', { exact: true }).isVisible().catch(() => false);
  const homeVisible = () => page.getByText('시작하기', { exact: true }).isVisible().catch(() => false);

  if (await pauseVisible()) fail('back button: pause menu already showing right after entering the game');

  await page.goBack();
  await page.waitForTimeout(300);
  const openedOnFirstBack = await pauseVisible();
  console.log('  첫 뒤로가기(플레이 중): 일시정지 메뉴 ' + (openedOnFirstBack ? '열림 (기대값)' : '안 열림 (FAIL)'));
  if (!openedOnFirstBack) fail('back button: first back-press during gameplay did not open the pause menu');

  await page.goBack();
  await page.waitForTimeout(300);
  const closedOnSecondBack = !(await pauseVisible());
  console.log('  두번째 뒤로가기(일시정지 중): 일시정지 메뉴 ' + (closedOnSecondBack ? '닫힘 (기대값)' : '안 닫힘 (FAIL)'));
  if (!closedOnSecondBack) fail('back button: second back-press while paused did not resume (close the menu)');

  // Re-open (toggle once more) so the "홈으로" button is actually reachable,
  // then leave via the button -- not back -- to check that leaving drops the
  // entry rather than leaving it dangling for the next check below.
  await page.goBack();
  await page.waitForTimeout(300);
  if (!(await pauseVisible())) fail('back button: third back-press did not reopen the pause menu (toggle should keep alternating)');
  await page.getByText('홈으로', { exact: true }).first().click({ timeout: 10000 });
  await page.waitForTimeout(300);
  const homeAfterButton = await homeVisible();
  console.log('  "홈으로" 버튼: 홈 화면 ' + (homeAfterButton ? '표시됨 (기대값)' : '표시 안 됨 (FAIL)'));
  if (!homeAfterButton) fail('back button: tapping "홈으로" from the pause menu did not return to the home screen');

  // One more back-press from the bare home screen must not resurrect the
  // pause menu -- the entry pushed for the game screen must have been
  // dropped by "홈으로" above, not left dangling. In this harness (unlike a
  // real installed PWA) there's a prior about:blank entry before our very
  // first load, so this back-press leaves the app entirely rather than
  // idling on the home screen -- that's the correct outcome here: it proves
  // nothing app-level was left to intercept it. A dangling entry would
  // instead have kept the pause menu (or the game screen) showing.
  await page.goBack();
  await page.waitForTimeout(300);
  const notShowingGameOrPause = !(await pauseVisible()) && !(await page.locator('[data-testid="game-board"]').isVisible().catch(() => false));
  console.log('  홈 화면에서 뒤로가기: ' + (notShowingGameOrPause ? '게임/일시정지 재등장 없음 (기대값)' : 'FAIL'));
  if (!notShowingGameOrPause) fail('back button: a dangling game-screen history entry resurfaced after returning home');

  if (pageErrors.length) fail('back button: page errors — ' + pageErrors.slice(0, 3).join(' | '));
  await page.close();
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/index.html not found — run `npm run build:web` first');
    process.exit(1);
  }

  const server = await serve();
  const url = `http://localhost:${PORT}/`;
  console.log('serving ' + DIST + ' at ' + url);

  const browser = await chromium.launch();

  await checkPinchZoomDisabled(browser, url);
  await checkMarginSwipe(browser, url);
  await checkBackButtonPauseToggle(browser, url);

  await browser.close();
  server.close();

  console.log('');
  if (failures > 0) {
    console.error(failures + ' mobile-input problem(s) FAILED');
    process.exit(1);
  }
  console.log('pinch-zoom, margin swipe and back-button behaviour all hold');
})().catch(e => { console.error('MOBILE INPUT CHECK FAILED: ' + e.message); process.exit(1); });
