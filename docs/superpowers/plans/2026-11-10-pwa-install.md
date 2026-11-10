# PWA 홈 화면 설치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배포 중인 웹 빌드를 안드로이드 Chrome에서 홈 화면에 설치 가능하게 만들고, 설치 후에는 네트워크 없이도 켜지며, 온라인 상태에서는 항상 최신 배포를 받게 한다.

**Architecture:** Expo의 `expo export --platform web` 산출물(`dist/`)은 그대로 두고, 빌드 직후 `dist/index.html`에 manifest·테마색·서비스워커 등록 태그를 끼워넣는 후처리 스크립트를 `build:web`에 체이닝한다. 서비스워커는 내비게이션(HTML)은 네트워크 우선, 그 외 콘텐츠-해시 붙은 정적 자산은 캐시 우선으로 다룬다. 아이콘은 기존 자산 중 깨끗한 파일(`android-icon-foreground.png`)을 앱 테마색과 합성해 일회성 로컬 스크립트로 생성한다.

**Tech Stack:** Expo SDK 55 웹 export(Metro), Service Worker API, Web App Manifest, Playwright(이미 devDependency), Python 3.13 + Pillow(아이콘 생성 1회용, 리포에 커밋 안 함)

**Spec:** [docs/superpowers/specs/2026-11-10-pwa-install-design.md](../specs/2026-11-10-pwa-install-design.md)

## Global Constraints

- GitHub Pages는 `/escaphere/` 서브패스에서 서빙된다. PWA 관련 모든 href(manifest link, theme-color 메타와 무관하지만 manifest의 `start_url`/아이콘 경로, apple-touch-icon href, sw.js 등록 경로)는 **앞에 슬래시 없는 상대 경로**로 쓴다.
- 새 런타임 의존성 없음, 새 devDependency도 없음. 아이콘 생성은 Python/Pillow로 하되 그 스크립트 자체는 리포에 커밋하지 않는다 — 결과 PNG만 커밋한다.
- 이 컴퓨터의 `convert` 명령은 ImageMagick이 아니라 Windows 자체 디스크 변환 유틸리티다 — 쓰지 않는다.
- CI 게이트(`npx tsc --noEmit`, `npm run test:logic`, `npm run check:mapgen`, `npm run build:web` + `npm run check:layout`)를 깨지 않는다.
- `.github/workflows/deploy.yml`은 수정하지 않는다 — 모든 배선은 `package.json`의 `build:web` 스크립트 안에서 끝낸다.
- `src/constants/version.ts`는 배포 워크플로우가 생성한다. 손대지 않는다.
- `src/` 애플리케이션 코드는 이 계획의 어떤 태스크에서도 건드리지 않는다.
- 서비스워커 캐시 전략: 내비게이션(HTML) 요청은 네트워크 우선·실패 시 캐시 대체, 그 외 정적 자산(콘텐츠-해시 붙은 JS 포함)은 캐시 우선.
- 배경/테마색은 `#0f0f1a`(`src/constants/theme.ts`의 `DARK_THEME.bg`). 아이콘 배경색은 `#E6F4FE`(`app.json`의 `android.adaptiveIcon.backgroundColor`).

## Review Focus

- **재배포 후 온라인 상태에서 다시 열어도 옛 버전이 뜬다** — anti-goal의 핵심. 네트워크 우선 전략이 실제로 새 배포를 받아오는지 확인해야 한다. 실제 재빌드 두 번(해시가 매번 달라 결정적이지 않음)보다, 서버가 두 번째 요청부터 "재배포된" `index.html`을 내려주도록 흉내 내는 쪽이 빠르고 결정적이다. → Task 5.
- **처음 설치하고 바로(두 번째 재방문 전에) 오프라인으로 꺼면 안 켜진다** — "한 번 열어본 뒤에는 켜진다"는 목표가 실제로는 "두세 번 열어야 켜진다"가 될 수 있다. → Task 5.
- **로컬에서는 되는데 실제 GitHub Pages 서브패스(`/escaphere/`)에서는 상대 경로가 깨진다** — 지금까지 아무 테스트도 서브패스를 실제로 재현해 본 적이 없다(기존 `check-layout.js`는 서브패스 서빙 로직은 있지만 PWA 태그를 검사하지 않는다). → Task 5.
- **아이콘 합성이 전경 이미지를 못 찾거나 실패해서 배경색만 칠해진 빈 사각형이 나온다** — 조용히 "그럴듯해 보이는" 단색 PNG가 나올 수 있다. → Task 1.
- **Expo가 나중에 `dist/index.html`의 기본 템플릿을 바꾸면 끼워넣기 스크립트가 조용히 빗나간다** — 지금 당장은 아니지만, 자체 검증이 실제로 이 실패를 잡아내는지 고의로 깨뜨려서 확인해야 한다. → Task 4.

---

## File Structure

| 파일 | 역할 |
|---|---|
| `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png` | 생성된 아이콘(커밋됨) |
| `public/manifest.webmanifest` | PWA 매니페스트 |
| `public/sw.js` | 서비스워커 |
| `scripts/inject-pwa-tags.js` | `dist/index.html`에 태그 끼워넣기 + 자체 검증 |
| `scripts/check-pwa.js` | 끝단 자동 검증(Playwright) |
| `package.json` | `build:web`에 끼워넣기 스크립트 체이닝, `check:pwa` 스크립트 추가 |

---

## Task 1: 아이콘 생성

**Files:**
- Create (커밋): `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-512-maskable.png`, `public/icons/apple-touch-icon.png`
- Create (일회성, 커밋 안 함): 스크래치패드의 Pillow 스크립트 — 실행 후 지운다.

**Interfaces:**
- Consumes: `assets/android-icon-foreground.png`(512x512, RGBA, 투명 배경 확인됨), `app.json`의 `android.adaptiveIcon.backgroundColor`(`#E6F4FE`)
- Produces: 위 4개 PNG 파일 — Task 2(manifest)가 그 경로를, Task 3(sw.js)이 그 경로를 정적 캐시 목록에서 참조한다.

- [ ] **Step 1: 스크래치패드에 아이콘 생성 스크립트를 작성한다**

```python
from PIL import Image

BG_COLOR = (0xE6, 0xF4, 0xFE, 255)
fg = Image.open('assets/android-icon-foreground.png').convert('RGBA')

def composited(size):
    bg = Image.new('RGBA', (512, 512), BG_COLOR)
    merged = Image.alpha_composite(bg, fg)
    if size != 512:
        merged = merged.resize((size, size), Image.LANCZOS)
    return merged

import os
os.makedirs('public/icons', exist_ok=True)

outputs = {
    'public/icons/icon-512.png': 512,
    'public/icons/icon-512-maskable.png': 512,
    'public/icons/icon-192.png': 192,
    'public/icons/apple-touch-icon.png': 180,
}
for path, size in outputs.items():
    img = composited(size)
    assert len(set(img.getdata())) > 1, f'{path}: output looks blank (only one distinct pixel value)'
    img.save(path)
    print(path, img.size, img.mode)
```

실행은 이 저장소 루트(`C:\Users\GE63\Repository\escaphere`)에서 한다 — 상대 경로(`assets/...`, `public/icons/...`)가 그 기준이다.

- [ ] **Step 2: 실행하고 출력 확인**

Run: `py <스크래치패드 경로>/gen-icons.py` (저장소 루트에서)
Expected: 4줄 출력, 각각 `(512, 512)`/`(512, 512)`/`(192, 192)`/`(180, 180)`와 `RGBA`. assert가 걸리면(출력이 단색) 중단하고 원인을 본다 — 가장 흔한 원인은 작업 디렉터리가 저장소 루트가 아니어서 `assets/android-icon-foreground.png`를 못 찾는 경우다.

- [ ] **Step 3: 결과물을 눈으로도 한 번 확인한다**

`public/icons/icon-512.png`를 열어, 안전 여백 가이드 원이 아니라 실제 "A" 모양 로고가 옅은 하늘색(`#E6F4FE`) 배경 위에 그려져 있는지 확인한다 — `assets/icon.png`나 `assets/android-icon-background.png`에서 봤던 디자인 툴 가이드 원·격자가 섞여 들어가지 않았는지가 핵심이다.

- [ ] **Step 4: 스크래치패드의 생성 스크립트를 지운다**

결과 PNG만 리포에 남긴다 — 생성 스크립트 자체는 일회성이다(Global Constraints).

- [ ] **Step 5: Commit**

```bash
git add public/icons/
git commit -m "feat: generate PWA icons from the clean foreground layer"
```

---

## Task 2: 매니페스트

**Files:**
- Create: `public/manifest.webmanifest`

**Interfaces:**
- Consumes: Task 1의 아이콘 파일 경로(`icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-512-maskable.png`)
- Produces: `manifest.webmanifest` — Task 4의 끼워넣기 스크립트가 `<link rel="manifest" href="manifest.webmanifest" />`로 참조하고, Task 3의 서비스워커가 정적 캐시 목록에 넣는다.

- [ ] **Step 1: `public/manifest.webmanifest` 작성**

```json
{
  "name": "Escaphere",
  "short_name": "Escaphere",
  "start_url": ".",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0f0f1a",
  "theme_color": "#0f0f1a",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: 유효한 JSON인지, 아이콘 경로가 Task 1의 실제 파일과 맞는지 확인**

Run: `node -e "const fs = require('fs'); const m = JSON.parse(fs.readFileSync('./public/manifest.webmanifest', 'utf8')); console.log(m.name, m.icons.length); m.icons.forEach(i => fs.accessSync('public/' + i.src)); console.log('OK');"`
Expected: `Escaphere 3`에 이어 `OK` 출력, 에러 없음(`accessSync`가 세 아이콘 파일이 실제로 존재하는지 확인한다 — 하나라도 없으면 `ENOENT`로 던진다).

(주의: `require('./public/manifest.webmanifest')`는 Node가 `.webmanifest` 확장자를 모듈로 인식 못 해 JS로 잘못 해석하려다 `SyntaxError`를 던진다 — 직접 돌려서 확인한 Node 동작이다. 반드시 `JSON.parse(fs.readFileSync(...))`로 읽는다.)

- [ ] **Step 3: Commit**

```bash
git add public/manifest.webmanifest
git commit -m "feat: add the PWA manifest"
```

---

## Task 3: 서비스워커

**Files:**
- Create: `public/sw.js`

**Interfaces:**
- Consumes: Task 1의 아이콘 경로, Task 2의 매니페스트 경로(둘 다 정적 문자열로 캐시 목록에 들어간다 — 빌드 해시가 붙지 않는 파일들이라 고정 경로로 참조 가능)
- Produces: `sw.js` — Task 4가 `<script>...serviceWorker.register('sw.js')</script>`로 등록 태그를 끼워넣는다. Task 5가 실제 브라우저에서 동작을 검증한다.

- [ ] **Step 1: `public/sw.js` 작성**

```js
// Service worker for the installed PWA shell.
//
// Two rules only (see docs/superpowers/specs/2026-11-10-pwa-install-design.md §6.4):
//   - navigation requests (index.html): network-first, cache fallback —
//     online always gets the latest deploy; offline gets the last-cached shell.
//   - everything else: cache-first — safe because the JS bundle's filename
//     carries a content hash, so a new deploy is simply a cache MISS at a
//     new URL, never a stale HIT at an old one.
const CACHE_NAME = 'escaphere-shell-v1';

// Paths with no build-time hash, known ahead of time.
const SHELL_URLS = [
  './',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(SHELL_URLS);
      // The JS bundle's filename is content-hashed per build, so sw.js (a
      // static file with no build step of its own) can't know it ahead of
      // time. Discover it at install time by reading the page we were
      // registered from. A parse failure here must not fail install -- the
      // bundle still gets cached on first real fetch via the fetch handler
      // below, just not pre-warmed for an immediate offline-after-install.
      try {
        const html = await (await fetch('./')).text();
        const match = html.match(/<script src="([^"]+)" defer><\/script>/);
        if (match) await cache.add(match[1]);
      } catch {}
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('./')));
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
    )
  );
});
```

이 정규식(`/<script src="([^"]+)" defer><\/script>/`)은 Task 4가 끼워넣기 전, Expo가 만든 그대로의 `dist/index.html` 안 번들 태그와 정확히 일치해야 한다 — Task 4의 자체 검증이 쓰는 패턴과 같은 모양이다.

- [ ] **Step 2: 문법 오류만 확인(서비스워커 API는 plain Node에 없으므로 구문 검사만)**

Run: `node --check public/sw.js`
Expected: 아무 출력 없이 종료코드 0.

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "feat: add the offline service worker"
```

참고: 이 태스크는 `sw.js`가 실제 브라우저에서 올바르게 설치·활성화·오프라인 동작하는지까지는 검증하지 않는다 — Task 1, 2, 4가 먼저 끝나 실제 페이지에 전부 연결되어야 의미 있게 테스트할 수 있다. 그 끝단 검증은 Task 5의 몫이다.

---

## Task 4: 빌드 산출물에 태그 끼워넣기

**Files:**
- Create: `scripts/inject-pwa-tags.js`
- Modify: `package.json`의 `build:web` 스크립트

**Interfaces:**
- Consumes: Expo가 만든 `dist/index.html`(`npm run build:web`이 이미 실행된 뒤의 산출물), Task 2/3이 만든 파일명(`manifest.webmanifest`, `sw.js`, `icons/apple-touch-icon.png`)
- Produces: 태그가 끼워진 `dist/index.html` — Task 5가 실제 브라우저로 이걸 로드해 검증한다.

- [ ] **Step 1: `scripts/inject-pwa-tags.js` 작성**

```js
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

fs.writeFileSync(INDEX, html.replace('</head>', TAGS + '\n</head>'));

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

console.log('inject-pwa-tags: OK (' + INDEX + ')');
```

- [ ] **Step 2: `package.json`의 `build:web`에 체이닝**

```json
"build:web": "expo export --platform web --output-dir dist && node scripts/inject-pwa-tags.js"
```

- [ ] **Step 3: 실제 빌드를 돌려 태그가 들어갔는지 확인**

Run: `npm run build:web`
Expected: 마지막 줄에 `inject-pwa-tags: OK (...)`. 그 다음 `cat dist/index.html`로 네 태그가 `</head>` 바로 앞에 있는지, `<script src="...">` 번들 줄이 Expo가 만든 그대로(해시가 붙은 실제 파일명)인지 눈으로 확인.

- [ ] **Step 4: 쓰기 이전 가드가 실제로 실패를 잡아내는지 고의로 깨뜨려서 확인**

`scripts/inject-pwa-tags.js`의 `bundleMatch` 정규식을 일시적으로 존재하지 않는 패턴(예: `/<script src="[^"]+" nonexistent><\/script>/`)으로 바꾼다.

Run: `npm run build:web`
Expected: `inject-pwa-tags: could not find the bundle <script> tag in ...`로 종료코드 비정상 반환, 빌드 스크립트 전체가 실패.

정규식을 원래대로 되돌린다. `git diff -- scripts/inject-pwa-tags.js`로 되돌아간 것을 확인.

Run: `npm run build:web`
Expected: 다시 `inject-pwa-tags: OK`로 성공.

**주의: 위 테스트는 "쓰기 전" 가드(`bundleMatch`가 애초에 안 잡히는 경우)만 거친다.** `bundleMatch`가 `null`이면 `fs.writeFileSync` 자체가 실행되지 않으므로, 스크립트 자신이 "Self-verify"라고 이름 붙인 쓰기 이후 재검증 블록(네 태그가 실제로 들어갔는지, 번들 줄이 그대로인지)은 이 테스트로 전혀 거치지 않는다. 이 둘은 별개의 코드 경로이고, 설계 문서가 "나중에 Expo가 템플릿을 바꿔도 CI가 조용히 깨진 산출물을 배포하지 않는다"고 보장하는 건 바로 이 쓰기 이후 블록이다. Step 5에서 그 블록도 직접 거치게 한다.

- [ ] **Step 5: 쓰기 이후 자체 검증도 실제로 실패를 잡아내는지, 별도로 확인**

`scripts/inject-pwa-tags.js`의 `TAGS` 배열에서 아무 항목 하나(예: `apple-touch-icon` 줄)의 따옴표나 속성 하나를 살짝 바꿔서, 그 줄이 더 이상 `expectations`의 해당 `needle` 문자열을 포함하지 않게 만든다(`bundleMatch`나 `</head>` 탐지와는 무관한 변경이어야 한다 — 그래야 쓰기 전 가드는 그대로 통과하고 실제로 파일이 써진 뒤에 재검증 블록에서만 걸린다).

Run: `npm run build:web`
Expected: `inject-pwa-tags: missing after injection: apple-touch-icon link.`(또는 바꾼 항목에 맞는 메시지)로 종료코드 비정상 반환 — **이번엔 쓰기가 실제로 일어난 뒤**에 재검증이 잡아낸 것이다.

`TAGS`를 원래대로 되돌린다. `git diff -- scripts/inject-pwa-tags.js`로 되돌아간 것을 확인.

Run: `npm run build:web`
Expected: 다시 `inject-pwa-tags: OK`로 성공.

- [ ] **Step 6: Commit**

```bash
git add scripts/inject-pwa-tags.js package.json
git commit -m "feat: inject PWA tags into the web export, self-verifying"
```

---

## Task 5: 끝단 자동 검증 (Playwright)

이 태스크가 설계 문서의 §8에서 "가장 중요"라고 표시한 것(재배포 후 온라인이면 최신이 뜨는지)과, "한 번 열어본 뒤" 오프라인이 실제로 되는지를 실제 브라우저로 증명한다. `scripts/check-layout.js`가 `PAGES_BASE_URL`을 받아 GitHub Pages 서브패스(`/escaphere/`)를 로컬에서 재현하는 것과 같은 패턴을 재사용한다.

**Files:**
- Create: `scripts/check-pwa.js`
- Modify: `package.json`에 `check:pwa` 스크립트 추가

**Interfaces:**
- Consumes: Task 1-4가 전부 끝난 `dist/`(`npm run build:web`의 산출물)
- Produces: 없음(검증 스크립트, 종료코드로만 결과를 알린다)

- [ ] **Step 1: `scripts/check-pwa.js` 작성**

```js
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
    await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
    const html = await page.content();
    if (!html.includes('deploy-marker: v2')) {
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
```

- [ ] **Step 2: `package.json`에 스크립트 추가**

```json
"check:pwa": "node scripts/check-pwa.js"
```

- [ ] **Step 3: 빌드 후 돌려서 통과하는지 확인**

Run: `npm run build:web && PAGES_BASE_URL=/escaphere npm run check:pwa` (Windows Git Bash에서 env var 인라인 지정이 안 먹으면 `export PAGES_BASE_URL=/escaphere`를 먼저 실행)
Expected: `PWA offline/update behaviour holds under /escaphere/`로 종료, 종료코드 0.

- [ ] **Step 4: 시나리오 1(오프라인)이 실제로 효과가 있는지, 일부러 깨뜨려서 확인**

`public/sw.js`의 `install` 핸들러에서 `await cache.addAll(SHELL_URLS);` 다음에 오는 번들 프리캐싱 블록 전체(try/catch 포함)를 주석 처리하거나 지운다 — 번들이 설치 시점에 캐싱되지 않게 만든다.

Run: `npm run build:web && PAGES_BASE_URL=/escaphere npm run check:pwa`
Expected: `FAIL: scenario 1: the JS bundle was never precached...`로 실패.

`public/sw.js`를 원래대로 되돌린다(`git diff -- public/sw.js`로 확인).

Run: `npm run build:web && PAGES_BASE_URL=/escaphere npm run check:pwa`
Expected: 다시 통과.

- [ ] **Step 5: 시나리오 2(재배포)가 실제로 효과가 있는지, 일부러 깨뜨려서 확인**

`public/sw.js`의 `fetch` 핸들러에서 내비게이션 분기(`if (req.mode === 'navigate') { ... }`)를 지우거나, `fetch(req).catch(...)`를 `caches.match(req).then(c => c || fetch(req))`처럼 캐시 우선으로 바꿔본다.

Run: `npm run build:web && PAGES_BASE_URL=/escaphere npm run check:pwa`
Expected: `FAIL: scenario 2: online reload after a redeploy served the cached index.html...`로 실패.

원래대로 되돌린다.

Run: `npm run build:web && PAGES_BASE_URL=/escaphere npm run check:pwa`
Expected: 다시 통과.

- [ ] **Step 6: 기존 CI 게이트 전체도 다시 확인**

Run: `npx tsc --noEmit && npm run test:logic && npm run check:mapgen && npm run check:layout`
Expected: 전부 통과(이 계획은 `src/`를 건드리지 않았으므로 `tsc`/`test:logic`/`check:mapgen`은 사실상 무관하지만, `check:layout`은 끼워넣은 태그가 레이아웃에 영향이 없는지 실제로 확인한다).

- [ ] **Step 7: Commit**

```bash
git add scripts/check-pwa.js package.json
git commit -m "test: prove the PWA survives offline-after-one-visit and redeploy-while-online"
```

---

## 완료 조건

- `npx tsc --noEmit`, `npm run test:logic`, `npm run check:mapgen` — 통과 (이 작업은 `src/`를 건드리지 않는다).
- `npm run build:web` — `inject-pwa-tags: OK`로 끝난다.
- `npm run check:layout` — 기존처럼 모든 뷰포트에서 겹침 없음.
- `PAGES_BASE_URL=/escaphere npm run check:pwa` — 통과.
- 실제 기기 확인(가능하면, 설계 문서 §8): 배포된 URL을 안드로이드 Chrome에서 열어 설치 제안이 뜨는지, 설치 후 독립 창으로 뜨는지, 비행기 모드에서 재실행이 되는지.
