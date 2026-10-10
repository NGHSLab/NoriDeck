# NoriDeck 카트리지 개발 가이드

> TypeScript 로 게임을 만들어 `.nori` 카트리지로 묶고 NoriDeck 콘솔에서 돌리는 방법. 콘솔 저장소는 필요 없습니다.

콘솔을 쓰는 방법은 [README](../README.md), 콘솔 자체를 고치는 방법은 [CONTRIBUTING](../CONTRIBUTING.md), 포맷 명세는 [nori-format.md](nori-format.md) 입니다. 완성된 예제는 [NoriPack](https://github.com/NGHSLab/NoriPack) 저장소의 `snakegame/` 에 있습니다.

## 1. 5분 시작

필요한 것은 Node.js 22.12 이상뿐입니다.

```bash
npm create nori@latest my-cart      # 뼈대 생성 (= npx @nghslab/nori-cli init my-cart)
cd my-cart
npm install                         # @nghslab/nori-sdk · @nghslab/nori-cli · typescript
npm run pack                        # → dist/my-cart-0.1.0.nori
```

`dist/my-cart-0.1.0.nori` 를 NoriDeck 홈 화면에 끌어다 놓으면(또는 File → Add cartridge) 라이브러리에 들어가고, 카드의 Play 로 실행됩니다. 뼈대에는 움직이는 상자 예제가 들어 있어 바로 화면이 나옵니다.

`nori --help` 에 명령과 nori.json 규칙 요약이 있습니다.

```
nori init [폴더] [--id <id>] [--title <제목>] [--force]   새 프로젝트 뼈대
nori build [폴더] [--out <폴더>] [--sourcemap]           nori.json → dist/<id>-<version>.nori
nori check <파일.nori>                                  매니페스트 · 체크섬 · SDK 버전 검사
nori unpack <파일.nori> [폴더] [--force]                 .nori 를 폴더로 푼다
```

### AI 와 함께 만들기

개발을 몰라도 됩니다. `npm create nori@latest my-cart` 로 만든 폴더에는 AI 코딩 도구용 안내 `AGENTS.md` 가 들어 있습니다. 그 폴더를 Claude Code · Cursor · Copilot 같은 도구에 열고 "이런 게임을 만들어 줘" 라고 하면, AI 가 규칙(콘솔 API 만 사용 · 에셋 경로 · 저작권 · 검증 명령)을 지켜 `.nori` 까지 만들어 줍니다. 이미 있는 프로젝트라면 [ai-cartridge-guide.md](ai-cartridge-guide.md) 를 루트에 `AGENTS.md`(도구에 따라 `CLAUDE.md`)로 복사하세요.

## 2. 프로젝트 구조

```
my-cart/
├── nori.json            카트리지 정보. 게임 코드와 nori build 가 같은 파일을 읽는다
├── package.json         "@nghslab/nori-sdk" · devDependencies 에 "@nghslab/nori-cli", typescript
├── tsconfig.json        strict. lib 는 DOM (Node 타입 없음)
├── src/cart.ts          진입점. export const cartridge = defineCartridge({ manifest, mount })
├── assets/              이미지 · 소리. 코드에서는 api.assets.url('파일') 로
└── cover.png            (선택) 라이브러리 커버 480×270
```

### nori.json

```json
{
  "id": "my-cart",
  "title": "My Cart",
  "version": "0.1.0",
  "author": "이름",
  "description": "한 줄 소개",
  "cover": "cover.png",
  "screen": { "width": 480, "height": 270, "layout": "single" },
  "saveSlots": ["main"],
  "build": { "entry": "src/cart.ts", "assets": "assets" }
}
```

| 필드                              | 필수 | 규칙                                                                                               |
| --------------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| `id`                              | ✓    | `[a-z0-9][a-z0-9-]{0,62}`. 세이브 폴더 · 파일 이름 · 허브 주소에 쓰인다. **공개 후 바꾸지 않는다** |
| `title`                           | ✓    | 표시 제목                                                                                          |
| `version`                         | ✓    | semver. 파일 이름 `<id>-<version>.nori` 이 된다                                                    |
| `screen`                          | ✓    | `{ width, height, layout: "single" \| "ds-dual", gap? }`. 콘솔이 비율을 지켜 확대한다              |
| `saveSlots`                       |      | 슬롯 이름 배열. 기본 `["main"]`. `[a-zA-Z0-9_-]{1,32}`                                             |
| `author` `description` `homepage` |      | 라이브러리 정보 표시용. 넣을 때는 빈 문자열이 아니어야 한다                                        |
| `cover`                           |      | 커버 이미지 경로. 패키지 안에는 `cover.<확장자>` 로 들어간다. 480×270(16:9) 권장                   |
| `build.entry`                     |      | 진입 소스. 기본 `src/cart.ts`. `cartridge` 를 export 해야 한다                                     |
| `build.assets`                    |      | 에셋 폴더. 기본 `public/assets`. 패키지의 `assets/` 가 된다                                        |

화면은 16:9 한 화면 480×270 이 기본입니다. 콘솔 창 배율 ×1 이 그 2배(960×540)라 픽셀이 정수로 확대됩니다. `ds-dual`(위·아래 두 화면)은 선택입니다.

## 3. 게임 코드: `defineCartridge`

```ts
import {
  defineCartridge,
  parseCartInfo,
  type ConsoleAPI,
  type GameInstance,
} from '@nghslab/nori-sdk';
import noriJson from '../nori.json';

const info = parseCartInfo(noriJson); // nori.json 을 검증해 매니페스트로

export const cartridge = defineCartridge({
  manifest: info,
  async mount(api: ConsoleAPI): Promise<GameInstance> {
    // 1) 그릴 것을 api.screen.container 에 붙인다
    // 2) 입력 · 세이브 · 에셋 · 배속은 api 로
    // 3) pause / resume / unmount 를 돌려준다
  },
});
```

콘솔은 `.nori` 안의 `cart.js` 를 import 해 `cartridge.mount(api)` 를 부릅니다. 게임은 `api` 만 씁니다. 파일 경로 · Electron · 창 · `window.norideck` 브리지는 쓸 수 없습니다(sandbox).

### 생명주기 (`GameInstance`)

| 메서드       | 콘솔이 부르는 때                                                    | 게임이 할 일                          |
| ------------ | ------------------------------------------------------------------- | ------------------------------------- |
| `mount(api)` | 카드에서 Play                                                       | 캔버스 만들기, 세이브 읽기, 루프 시작 |
| `pause()`    | 플레이어가 홈으로 나갈 때(홈 키 P, File → Home). 게임은 뒤에 남는다 | 루프 멈춤, 소리 멈춤                  |
| `resume()`   | 홈에서 그 카드를 다시 눌렀을 때                                     | 루프 재시작 (시간 기준점 다시 잡기)   |
| `unmount()`  | 게임 종료 · 삭제 · 다른 카트리지 실행                               | 리스너 해제, 캔버스 제거, 마지막 저장 |

`pause` 에서 루프를 멈추지 않으면 홈 뒤에서도 게임이 계속 돌아갑니다. 콘솔은 pause 중 입력을 게임에 전달하지 않습니다. 홈 카드에는 pause 시점의 마지막 프레임이 보입니다(2D 캔버스. WebGL 은 커버로 대체).

## 4. ConsoleAPI

### `api.screen`

- `container` — 그릴 요소. 콘솔이 크기 · 위치 · 레터박스를 관리하므로 자식만 채웁니다. 캔버스는 `width/height` 를 논리 해상도로 두고 CSS `width: 100%; height: 100%` 로 맞추면 됩니다.
- `layout` — `{ width, height, layout, scale, top?, bottom? }`. `scale` 은 논리 px → 실제 CSS px 배율. `ds-dual` 이면 `top` `bottom` 사각형이 옵니다.
- `onResize(cb)` — 창 크기가 바뀌면 호출. 해지 함수를 돌려줍니다.

### `api.input`

DS 버튼 이름만 씁니다: `UP DOWN LEFT RIGHT A B X Y L R SELECT START`. 어떤 물리 키가 어느 버튼인지는 콘솔 설정(기본 WASD · HJKL · YU · IO)이라 게임은 모릅니다. 안내 문구에도 "A 버튼" 처럼 버튼 이름을 쓰세요.

```ts
api.input.isDown('LEFT');                         // 눌려 있는가
const off = api.input.on('A', 'down', () => …);   // 눌림/떼짐 콜백. off() 로 해지
api.input.onAny((button, phase) => …);            // 모든 버튼
api.input.onPointer(({ type, x, y, screen }) => …); // 마우스·터치 (논리 좌표)
```

프레임 기준 "방금 눌림" 이 필요하면 SDK 의 `ButtonPoller` 를 쓰세요.

```ts
import { ButtonPoller } from '@nghslab/nori-sdk';
const poller = new ButtonPoller(api.input);
const confirm = poller.buttons('A', 'START');
// 게임 루프 안에서
if (poller.justDown(confirm)) {
  /* 한 번만 */
}
// unmount 에서 poller.destroy()
```

`onKey` / `isKeyDown` 은 물리 키(`KeyboardEvent.code`)를 직접 읽습니다. 숫자 키 같은 편의 단축키에만 쓰고, Tab · F11 · 홈 키 등 콘솔 예약 키는 전달되지 않습니다.

### `api.save`

카트리지별로 격리된 문자열 슬롯입니다. 형식은 게임이 정합니다(JSON 권장).

```ts
const raw = await api.save.read('main'); // 없으면 null
await api.save.write(JSON.stringify(state), 'main');
await api.save.remove('main');
const slots = await api.save.list();
```

- 슬롯 이름은 nori.json 의 `saveSlots` 에 적어 둡니다. 생략하면 `main`.
- 같은 `id` 는 버전이 달라도 세이브를 공유합니다. 저장 형식을 바꾸면 이전 형식을 읽어 주세요.
- 자주 쓰지 말고(파일 쓰기) 의미 있는 시점에 쓰세요. 홈으로 나가거나 `unmount` 될 때 마지막 저장을 하면 안전합니다.
- 플레이어는 콘솔에서 세이브를 백업 · 복원 · 삭제할 수 있습니다.

### `api.assets`

```ts
const img = new Image();
img.src = api.assets.url('sprites/hero.png'); // assets/sprites/hero.png
```

**파일마다** `url(path)` 를 부릅니다. `url('')` 을 기준 경로로 잡고 뒤에 이어 붙이면 콘솔 안에서 깨집니다(메모리에서 연 `.nori` 는 파일마다 다른 blob URL 입니다). 절대 경로도 쓰지 않습니다. 허용 형식: png jpg webp gif svg json ogg mp3 wav txt csv.

### `api.time`

- `speed` — 콘솔 배속(1 또는 사용자가 Config 에서 정한 값, 기본 3. Tab 으로 토글). 게임 시간 증가량에 곱하고, 소리를 직접 다룬다면 재생 속도(playbackRate)에도 곱하세요. `onSpeedChange(cb)` 로 바뀔 때를 받을 수 있습니다.

### `api.system`

- `isDesktop` — 데스크톱 앱인지(브라우저 실행이면 false).
- `consoleName` — 표시용 콘솔 이름.
- `fullscreen(on?)`, `log(...args)` — 로그는 `[id]` 접두어로 콘솔 개발자 도구에 찍힙니다.

## 5. Phaser 3 로 만들기

```bash
npm install phaser
```

```ts
import { defineCartridge, parseCartInfo } from '@nghslab/nori-sdk';
import { createPhaserGame, phaserInstance } from '@nghslab/nori-sdk/phaser';

export const cartridge = defineCartridge({
  manifest: parseCartInfo(noriJson),
  mount(api) {
    const game = createPhaserGame(api, { scene: [BootScene, PlayScene] });
    return phaserInstance(game);
  },
});
```

- `createPhaserGame` 은 매니페스트의 화면 크기로 FIT 스케일을 잡고, 키보드 플러그인을 끄고(입력은 콘솔 소유), 콘솔 배속을 모든 씬의 time · tweens · anims 와 소리 재생 속도(`sound.rate`)에 반영합니다 (배속이면 음악도 빨라집니다).
- 씬에서 입력은 `api.input` 또는 `ButtonPoller` 로 받습니다. `game.registry` 에 `api` 를 넣어 두면 편합니다.
- WebGL 로 그리므로 홈의 일시정지 카드에는 마지막 화면 대신 커버가 보입니다.
- Phaser 는 SDK 의 선택 peer 의존성이라 Phaser 를 안 쓰는 카트리지는 설치되지 않습니다.

## 6. 빌드 · 검사 · 실행

```bash
npm run pack       # nori build .  — Vite 로 src/cart.ts 를 ESM 하나로 묶고 zip 으로 싼다
npm run check      # nori check dist/<id>-<version>.nori
```

`nori build` 는 카트리지의 `vite.config` 를 읽지 않습니다. 결과 `.nori` 안은 다음과 같습니다.

```
<id>-<version>.nori (zip)
├── manifest.json     nori.json + format · entry · sdkVersion · builtAt
├── cart.js           게임 번들 (엔진 포함)
├── assets/…
├── cover.png         (있을 때)
└── checksums.json    모든 파일의 SHA-256
```

콘솔은 실행 전에 zip 구조 · 매니페스트 · 체크섬 · SDK major 를 검사하고 하나라도 어긋나면 홈에 이유를 보이고 실행하지 않습니다.

실행해 보는 방법 두 가지:

1. **콘솔에 넣기** — `.nori` 를 NoriDeck 홈에 끌어다 놓기. 같은 id 를 다시 넣으면 새 파일로 바뀌고 세이브는 유지됩니다.
2. **콘솔 개발 서버** (NoriDeck 저장소가 있을 때) — `nori unpack my.nori runtime/public/dev/my --force` 후 `npm run dev`, 브라우저에서 `http://localhost:5173/?cart=/dev/my/`. 코드를 고칠 때마다 다시 unpack 해야 합니다.

## 7. 배포

- 지금은 `.nori` 파일을 직접 전달합니다. GitHub Release 에 첨부하는 방법이 간단합니다(NoriDeck Release 의 snake 카트리지 참고).
- 허브(hub.norideck.com)가 열리면 `nori publish` 로 올리고, 허브가 검증한 뒤 콘솔에서 내려받게 됩니다. 허브 심사에서는 다른 사람의 저작물(스프라이트 · 음악 · 이름) 복제를 반려합니다. 오마주는 됩니다.
- 버전은 semver 로 올립니다. 세이브 호환이 깨지는 변경은 major.

### SDK 업데이트

SDK(와 Phaser 어댑터)는 `.nori` 안에 번들되므로, 새 SDK 의 동작(예: 배속 시 소리도 빨라짐)을 받으려면 프로젝트의 SDK 를 올리고 다시 묶어야 합니다.

```bash
npm outdated                          # 새 버전이 있는지 확인
npm update @nghslab/nori-sdk          # package.json 범위(^0.2.0) 안의 최신으로
npm install @nghslab/nori-sdk@latest  # 범위를 넘는 버전(major 변경)으로 올릴 때
npm run typecheck && npm run pack && npm run check
```

- 콘솔은 카트리지 SDK 의 **major** 만 비교합니다(지금은 콘솔·SDK 모두 0.x 라 서로 호환). 콘솔보다 높은 major 로 빌드하면 "SDK 버전이 맞지 않습니다" 로 거부되니, 사용자에게 배포된 콘솔 버전을 먼저 확인하세요.
- `nori check` 결과와 콘솔의 카드 정보(톱니 → 정보)에 카트리지가 쓰는 SDK 버전이 표시됩니다.
- CLI 도 같은 방법입니다: `npm update @nghslab/nori-cli`.

## 8. 규칙 요약

1. 콘솔이 준 `ConsoleAPI` 와 브라우저 API 만 쓴다. Node · Electron · `window.norideck` 은 없다.
2. `id` 는 공개 후 바꾸지 않는다. 세이브 · 파일 이름 · 허브 주소가 여기에 묶인다.
3. 에셋은 파일마다 `api.assets.url(path)`.
4. `pause` 에서 루프를 멈추고 `resume` 에서 다시 시작한다. `unmount` 에서 리스너를 모두 해지한다.
5. 입력 안내는 물리 키가 아니라 버튼 이름(A · B · START …)으로 쓴다. 키 배치는 플레이어가 바꾼다.
6. 배속(`api.time.speed`)을 게임 시간에 반영한다.
7. 세이브 형식은 버전이 올라가도 읽을 수 있게 유지한다.
8. 카트리지의 라이선스는 제작자가 정한다. 콘솔의 MIT 는 카트리지에 적용되지 않는다.

## 9. 문제 해결

| 증상                                      | 원인 · 조치                                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `SDK 버전이 맞지 않습니다`                | 카트리지의 `@nghslab/nori-sdk` major 와 콘솔 SDK major 가 다름. SDK 를 콘솔이 지원하는 버전으로 맞춰 다시 빌드 |
| `체크섬 불일치` / `내용이 변경되었습니다` | 빌드 후 파일을 손댔거나 전송 중 손상. 다시 `npm run pack`                                                      |
| 에셋이 안 보인다                          | `assets.url('')` 이어 붙이기 또는 절대 경로 사용. 파일마다 `url(path)` 로                                      |
| 홈에서 돌아왔는데 시간이 훌쩍 지남        | `pause` 에서 루프를 멈추지 않았거나 `resume` 에서 시간 기준점을 다시 잡지 않음                                 |
| 키가 안 먹는다                            | 콘솔 예약 키(Tab · F11 · 홈 키)이거나 플레이어의 키 배치가 다름. 버튼 이름으로 확인                            |
| `nori.json 이 올바르지 않습니다`          | 메시지의 필드를 위 표에 맞게 수정. `author` 등 선택 항목은 빈 문자열 대신 빼기                                 |
