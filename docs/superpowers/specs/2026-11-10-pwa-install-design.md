# 홈 화면 설치(PWA) 설계

작성일: 2026-11-10

## 1. 의도와 배경

모바일로 가는 두 경로(PWA 설치, EAS 네이티브 APK) 중 PWA를 먼저 하기로 결정했다 —
계정·네이티브 툴체인 없이 지금 배포 중인 웹 빌드에 기능 하나를 얹는 정도라 훨씬 가볍고,
"내 폰 먼저, 스토어는 나중"이라는 원래 순서와도 맞는다.

이 게임은 **서버 호출이 전혀 없다.** 맵은 시드 기반으로 클라이언트에서 그 자리에서
생성되고(`src/logic/mapGenerator.ts`), 기록·스트릭·설정은 모두 기기 로컬
(`AsyncStorage`/웹의 `localStorage`)에만 저장된다. 네트워크가 필요한 유일한 순간은
처음 페이지를 받아오는 순간뿐이다. 그래서 오프라인 지원은 이 앱에 억지로 끼워 맞추는
기능이 아니라, 구조상 원래 자연스러운 방향이다 — 그리고 "심심할 때 지하철·침대에서
켜는 캐주얼 게임"이라는 이 앱의 전제(설정 영구 저장 작업 때 세운 전제)와
정확히 맞아떨어지는 사용처이기도 하다 — 지하철이 바로 신호가 끊기는 곳이다.

## 2. 목표

1. 안드로이드 Chrome(이 앱의 주 사용 경로)에서 배포된 웹 페이지를 열면 "홈 화면에
   추가"/설치 제안을 받을 수 있고, 설치하면 브라우저 UI 없이 독립된 창으로 뜬다.
2. 한 번 열어본 뒤에는 **네트워크가 없어도 켜진다.** 지하철처럼 신호가 끊긴 상태에서
   실행해도 마지막으로 접속했을 때의 버전이 뜬다.
3. 온라인 상태에서는 항상 최신 배포를 받는다 — 오프라인 지원이 캐시에 갇혀 새 배포를
   못 보게 만들면 안 된다.

### 성공의 모습

- 안드로이드 Chrome에서 배포 URL을 열고 "홈 화면에 추가"로 설치하면, 앱 목록에
  Escaphere 아이콘이 생기고 탭하면 주소창 없이 바로 게임이 뜬다.
- 비행기 모드를 켜고 그 아이콘을 다시 눌러도 게임이 뜨고 플레이가 된다.
- 배포하고 나서 다시 열면(온라인 상태) 새 버전이 뜬다 — 캐시 때문에 옛 버전에
  갇히지 않는다.

## 3. 목표가 아닌 것 (Non-goals)

- **EAS 네이티브 APK.** 별도 작업으로 이후에 진행한다. 이번 작업의 어떤 선택도 그
  경로를 막지 않아야 한다(§5).
- **iOS Safari 전용 대응.** 이 앱의 주 경로는 안드로이드 Chrome이다. iOS Safari에도
  `apple-touch-icon`은 싸게 넣어두지만(§6.2), iOS 특유의 PWA 제약(Safari의 더 좁은
  서비스워커 지원, "공유 → 홈 화면에 추가"로만 설치되는 플로우 등)을 검증하거나
  최적화하지는 않는다.
- **완전한 오프라인 전략(모든 자산의 세밀한 캐시 정책, 백그라운드 동기화 등).** 이
  앱엔 서버 데이터가 없으므로 그런 정교함이 필요 없다 — §6.3의 단순한 두 가지 규칙
  (해시 붙은 정적 자산은 캐시 우선, `index.html`은 네트워크 우선)으로 충분하다.
- **오프라인 상태 표시 UI**(예: "오프라인입니다" 배너). 네트워크가 없어도 그냥
  평소처럼 돌아가는 것이 목표이고, 사용자에게 그 사실을 알릴 필요는 없다.

## 4. 실패의 모습 (Anti-goals)

- **배포해도 새 버전이 안 보인다.** 서비스워커가 `index.html`을 캐시 우선으로
  캐싱하면, 이미 설치한 사용자는 영원히 설치 시점의 번들을 참조하는 옛
  `index.html`만 보게 된다. 네트워크가 있을 때는 항상 최신을 받아야 한다(§6.3).
- **배포마다 깨진다.** 지금 JS 번들 파일명엔 빌드마다 바뀌는 콘텐츠 해시가 붙는다
  (`index-6bd6d3b153...js`, 직접 빌드해서 확인함). `public/index.html`로 HTML
  전체를 정적 파일로 덮어쓰면 이 해시를 내가 미리 알 수 없어 번들 경로가 깨진다 —
  그래서 Expo가 만든 `dist/index.html`을 그대로 두고 태그만 끼워넣는
  **후처리 스크립트**로 간다(§6.2).
- **캐시가 무한히 쌓인다.** 배포마다 새 해시의 번들이 캐시에 추가되는데, 옛 캐시를
  전혀 안 지우면 방문자의 저장공간을 계속 잡아먹는다. `activate`에서 옛 캐시 이름을
  지우는 최소한의 정리는 필요하다(§6.3).
- **기존 웹 배포가 깨진다.** 지금 `npm run build:web`과 `npm run check:layout`은
  CI 게이트다. 이번 작업이 그 둘을 깨면 배포 전체가 막힌다.

## 5. 제약

- Expo SDK 55 / `expo export --platform web`(Metro 기반) 유지. 이 빌드가
  **content-hash가 붙은 파일명**을 만든다는 것이 이번 설계의 핵심 제약이다.
- `public/` 디렉터리에 둔 파일은 그대로 `dist/`에 복사된다 — 직접 테스트로 확인함.
  `public/index.html`은 Expo의 기본 템플릿을 **완전히 대체**하며 병합하지 않는다 —
  이것도 직접 테스트로 확인함. 그래서 `public/index.html`은 쓰지 않는다(§4).
- GitHub Pages는 프로젝트 사이트 경로(`/escaphere/`)에서 서빙된다. HTML
  `<link>`/`<meta>`의 href와 manifest의 `start_url`/아이콘 경로는 전부 **앞에 슬래시
  없는 상대 경로**로 쓴다 — 브라우저가 문서/매니페스트 자신의 URL 기준으로 풀어주므로
  로컬 개발(`/`)과 GitHub Pages(`/escaphere/`) 양쪽에서 동일하게 동작하고, JS 번들
  경로가 쓰는 `PAGES_BASE_URL` 같은 환경변수 전달이 필요 없다.
- CI 게이트(`npx tsc --noEmit`, `npm run test:logic`, `npm run check:mapgen`,
  `npm run build:web` + `npm run check:layout`)를 깨지 않는다.
- 새 런타임 의존성 없음, **새 devDependency도 없음.** 아이콘 리사이즈/합성은 일회성
  Python/Pillow 스크립트로 하되, 그 스크립트 자체는 리포에 커밋하지 않는다 — 한 번
  실행해서 나온 결과 PNG 파일만 커밋한다(§6.2). `convert`가 PATH에 있지만 이것은
  ImageMagick이 아니라 **Windows 자체 디스크 변환 유틸리티**다(직접 실행해서 확인함
  — `C:\Windows\system32\convert`, FAT→NTFS 변환 도구). 진짜 ImageMagick(`magick`
  명령)은 이 컴퓨터에 없다. Python 3.13 + Pillow 12.3.0은 `py` 명령으로 확인함.
- `src/constants/version.ts`는 배포 워크플로우가 생성한다. 손대지 않는다.

## 6. 결정된 사항

### 6.1 범위

새 파일(리포에 커밋): `public/manifest.webmanifest`, `public/icons/*.png`(3~4개),
`public/sw.js`, 빌드 후처리 스크립트(`scripts/inject-pwa-tags.js` 또는 유사한 이름).
일회성 산출물(리포에 커밋하지 않음): 아이콘을 생성한 Python/Pillow 스크립트
자체(§6.2) — 결과 PNG만 남긴다.
수정 파일: `package.json`의 `build:web`만.

**`.github/workflows/deploy.yml`은 수정하지 않는다.** 그 워크플로우의 "Export web
bundle" 스텝은 지금도 `npm run build:web`만 호출한다(확인함) — 후처리를
`package.json`의 `build:web` 스크립트 **안에서** 체이닝하면 CI는 코드를 한 줄도
바꾸지 않아도 자동으로 새 동작을 따라간다. 이 저장소의 `check:mapgen`이 이미 같은
모양(`"tsc -p ... && node scripts/check-mapgen.js"`)이다.

기존 `src/` 애플리케이션 코드는 건드리지 않는다 — 이번 작업은 전부 웹 빌드
산출물·빌드 스크립트 레이어에서 끝난다.

### 6.2 아이콘과 매니페스트

**`assets/` 안의 여러 파일이 실제로 깨져 있다 — 직접 열어보고 확인함.**
`icon.png`, `android-icon-background.png`, `android-icon-monochrome.png`,
`splash-icon.png` 네 개 전부, 실제 아이콘 내용 대신(또는 그 위에 겹쳐서) 디자인 툴의
안전영역 가이드(동심원·점선·격자)가 그대로 PNG에 박혀 있다 — 어도비/안드로이드
스튜디오 류의 아이콘 생성 도구에서 가이드 레이어까지 같이 내보낸 것으로 보인다.
깨끗한 건 **지금 실제로 쓰이고 있는 `favicon.png`**와 `android-icon-foreground.png`
(512x512, RGBA, 알파값 0~252로 진짜 투명 배경 — 파이썬으로 직접 확인함) 둘뿐이다.
이 작업은 네 개의 깨진 파일을 고치지 않는다 — 아래처럼 깨끗한 두 파일만으로
우회할 수 있고, 네 파일을 고치는 건 아이콘 재작업이라 범위 밖이다. **단, 이후
EAS 네이티브 빌드 작업(비목표 §3) 때는 `app.json`이 `icon.png`를
그대로 앱 아이콘으로 쓰도록 되어 있어 이 문제를 그대로 물려받는다 — 그때 다시
짚어야 한다.**

**그래서 아이콘은 전부 `android-icon-foreground.png`(깨끗한 전경 레이어) +
`app.json`의 `android.adaptiveIcon.backgroundColor`(`#E6F4FE`, 이미 정해져 있던
배경색 — 배경 이미지 레이어만 깨졌을 뿐 색 자체는 의도대로 살아있음)를 합성해서
만든다:**

| 산출물 | 만드는 법 |
|---|---|
| `icons/icon-512.png` (purpose: any) | `#E6F4FE` 512x512 평면 위에 `android-icon-foreground.png`를 알파 합성 |
| `icons/icon-192.png` (purpose: any) | 위 512 결과를 192x192로 리사이즈(또는 192 평면에 바로 합성) |
| `icons/icon-512-maskable.png` (purpose: maskable) | `icon-512.png`와 같은 내용 — 전경이 이미 adaptive icon 안전 여백 안에 그려져 있으므로 별도 처리가 필요 없다. 파일을 따로 둘지 재사용할지는 구현자 재량(§7) |
| `icons/apple-touch-icon.png` | 같은 합성을 180x180으로 |

Pillow로는 `Image.new('RGBA', (512,512), '#E6F4FE')`에
`Image.alpha_composite`로 전경을 얹는 정도로 충분하다. **이 스크립트는 일회성이라
리포에 커밋하지 않는다** — 실행해서 나온 `icons/*.png` 결과물만 `public/icons/`에
커밋한다.

**`public/manifest.webmanifest`:**

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

`background_color`/`theme_color`는 `src/constants/theme.ts`의 `DARK_THEME.bg`와
맞춤(내 결정 — 앱 기본 테마가 dark이고, 스플래시 느낌과 일관되게). `orientation`은
`app.json`의 네이티브 설정(`"orientation": "portrait"`)과 맞춤.

### 6.3 빌드 산출물에 태그 끼워넣기 — 후처리 스크립트

Expo가 만든 `dist/index.html`은 그대로 둔다(번들 해시 참조가 정확함). `npm run build:web`
직후, `dist/index.html`을 읽어 `</head>` 바로 앞에 세 줄을 끼워넣고 다시 쓰는 작은
Node 스크립트를 추가한다 — `scripts/check-layout.js`/`scripts/run-logic-tests.js`와
같은, 이 리포의 기존 "작은 단일 목적 스크립트" 관례를 따른다.

끼워넣을 태그(전부 상대 경로):
```html
<link rel="manifest" href="manifest.webmanifest" />
<meta name="theme-color" content="#0f0f1a" />
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />
<script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');</script>
```

`package.json`의 `build:web`은 `expo export --platform web --output-dir dist` 다음에
이 스크립트를 체이닝한다.

**스크립트는 자기 결과를 바로 검증하고, 실패하면 종료코드를 비정상으로 반환한다** —
네 태그가 실제로 들어갔는지, 그리고 Expo가 만든 `<script src="...">` 번들 참조 줄이
그대로인지(이 스크립트가 건드려서 깨뜨리지 않았는지)를 다시 읽어서 확인한다. 지금은
당연해 보이지만, 나중에 Expo가 `dist/index.html`의 기본 템플릿 모양을 바꾸면
`</head>` 탐지가 조용히 빗나갈 수 있다 — 그때 CI가 조용히 깨진 산출물을 배포하지
않고 바로 실패하게 만드는 것이 이 자체 검증의 목적이다. `check:mapgen`이 "불변식이
깨지면 큰 소리로 실패한다"는 같은 철학을 따른다.

### 6.4 서비스워커 — 사용자가 승인한 방향(오프라인 실캐싱)

`public/sw.js`. 두 가지 규칙만 둔다:

- **내비게이션 요청(`index.html`)**: 네트워크 우선, 실패하면 캐시. 온라인이면 항상
  최신 — 배포 후 다시 열면 새 버전이 뜬다. 오프라인이면 마지막으로 캐싱된 셸로
  대체 — 비행기 모드에서도 켜진다.
- **그 외 정적 자산(`_expo/static/...`의 해시 붙은 JS, 아이콘, manifest)**: 캐시
  우선. 번들 파일명이 배포마다 바뀌므로, 캐시 우선이어도 "옛 URL의 캐시된 내용"과
  "그 URL이 가리키는 실제 내용"이 어긋날 일이 없다 — 새 배포는 그냥 새 URL이라
  캐시 미스로 자연스럽게 새로 받아진다.

`CACHE_NAME`에 손으로 바꾸는 버전 문자열을 둔다(예: `'escaphere-shell-v1'`).
`activate` 이벤트에서 이 이름과 다른 캐시를 전부 지운다 — 이름을 올렸을 때 옛
캐시가 남지 않게 하는 최소한의 정리다. 배포할 때마다 올릴 필요는 없다: 이름이
그대로여도 위의 내비게이션 규칙이 온라인 방문마다 셸을 새로 덮어쓰므로, 낡은
셸이 고착되지는 않는다.

**단, "해시 URL이라 알아서 무효화되니 아무것도 쌓이지 않는다"는 것은 Cache API에는
해당하지 않는다.** URL이 바뀌면 낡은 항목이 저절로 밀려나는 것은 브라우저 HTTP
캐시의 성질이고, 여기서 쓰는 `Cache`의 항목은 명시적으로 지울 때까지 그대로 남는다.
그래서 실제로는 배포마다 새 해시 URL의 번들이 한 벌(~1.3MB)씩 더 쌓이며,
`activate`의 정리는 *이름이 다른* 캐시만 지우므로 — 그리고 그 이름은 바뀌지 않으므로
— 이 캐시는 배포를 거듭할수록 느리지만 한계 없이 커진다. 이번 작업에서는 이것을
고치지 않고 받아들인다: 늘어나는 속도가 느려 흔한 저장 용량 한계에 닿기까지 아주
오래 걸리고, 자산별 세밀한 캐시 정책은 애초에 이 설계의 목표가 아니다(§3). 쌓인
용량이 신경 쓰이면 `CACHE_NAME`을 손으로 올려 한 번에 비우면 된다.

처음 설치 시 셸(`index.html`, 루트 JS 번들, 아이콘)을 `install` 이벤트에서 미리
캐싱한다 — 그래야 첫 방문 직후 바로 오프라인으로 꺼도 켜진다.

**루트 JS 번들 URL은 `sw.js` 자신이 빌드 시점에 알 방법이 없다**(§6.3과 같은 이유 —
파일명에 빌드마다 바뀌는 콘텐츠 해시가 붙는다). `sw.js`는 `public/`에서 그대로
복사되는 순수 정적 파일로 두고(후처리 스크립트가 다시 쓰는 대상을 `index.html`
하나로 유지하기 위해), 대신 `install` 핸들러가 **실행 시점에 `index.html`을 한 번
읽어 그 안의 `<script src="...">`를 파싱해서** 그 URL을 캐싱 목록에 추가한다.
파싱을 try/catch로 감싸 실패해도 `install` 자체는 계속 진행한다 — 최악의 경우
그 번들만 미리 캐싱되지 않고 첫 실제 요청 때(§6.4의 "그 외 정적 자산" 규칙으로)
캐싱되므로, 실패 모드가 "오프라인 1회차 보장이 약해짐"이지 "설치가 깨짐"은
아니다. 로컬 개발(`npm run web`)과 실제 배포가 같은 메커니즘으로 동작하는 것도
이 방식의 이점이다 — 빌드 스크립트가 `sw.js`를 다시 쓰는 방식이었다면 둘이
달라졌을 것이다.

### 6.5 iOS에 대한 최소한의 배려

`apple-touch-icon` 태그 하나는 거의 공짜라 넣어둔다(§6.2, §6.3). 그 이상의 iOS
특화 작업(Safari의 더 제한적인 서비스워커 지원 등)은 하지 않는다 — §3.

## 7. 구현자에게 맡기는 것

- 후처리 스크립트의 정확한 파일명·위치, `</head>` 탐지 방식(정규식 대 간단한
  문자열 치환).
- 아이콘 생성 Pillow 스크립트의 정확한 코드와 리사이즈 필터. 결과 PNG가
  `icons/icon-512.png`와 `icons/icon-512-maskable.png`로 같은 내용의 두 파일이 될지,
  하나를 다른 하나의 사본/심볼릭 참조로 둘지도 포함.
- 서비스워커의 `install`/`activate`/`fetch` 핸들러 정확한 코드, 캐시 키 구성.
- `manifest.webmanifest`를 `dist/`에 복사하는 경로가 `public/`을 거치는 것으로
  충분한지, 혹은 후처리 스크립트가 직접 써야 하는지(아마 `public/`만으로 충분 —
  §5에서 이미 확인한 동작).

## 8. 검증

- `npx tsc --noEmit`, `npm run test:logic`, `npm run check:mapgen` — 기존 그대로
  통과해야 한다(이번 작업은 `src/`를 건드리지 않으므로 사실상 무관).
- `npm run build:web` 후 `dist/index.html`에 manifest/theme-color/apple-touch-icon
  태그가 실제로 들어있는지, 번들 `<script>` 태그의 해시가 Expo가 생성한 그대로인지
  (후처리가 그 줄을 건드리지 않았는지) 확인.
- `npm run check:layout` — 끼워넣은 태그가 레이아웃에 영향이 없는지(영향 없을
  것으로 예상되지만 기존 게이트로 그냥 확인됨).
- 실제 기기 확인(가능하면): 배포된 URL을 안드로이드 Chrome에서 열어 설치 제안이
  뜨는지, 설치 후 아이콘·독립 창 여부, 비행기 모드에서 재실행, 그리고 **온라인
  상태에서 재배포 후 다시 열어 최신 버전이 뜨는지**(가장 중요 — §4의 핵심 anti-goal).
