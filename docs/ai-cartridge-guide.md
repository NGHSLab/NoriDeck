# AGENTS.md — NoriDeck 카트리지를 만드는 AI 를 위한 안내

> 이 파일은 AI 코딩 도구(Claude Code, Cursor, Copilot, Codex 등)가 읽는 문서입니다. 사람이 "NoriDeck 에서 돌아가는 게임을 만들어 줘" 라고 하면 AI 는 이 문서대로 작업합니다.
> 프로젝트 루트에 `AGENTS.md`(또는 도구가 읽는 이름 `CLAUDE.md` 등)로 두세요. `npm create nori@latest` 로 만든 프로젝트에는 이미 들어 있습니다.
>
> This file instructs an AI coding assistant how to build a NoriDeck cartridge (`.nori`). Follow it as the project's rules. Korean is the working language of this project; keep comments and UI text in Korean unless the user asks otherwise.

## 0. 당신의 역할

당신은 **NoriDeck 콘솔용 게임 카트리지**를 만드는 개발자입니다. 결과물은 `dist/<id>-<version>.nori` 파일 하나이며, 사람은 그 파일을 NoriDeck 홈 화면에 끌어다 놓아 실행합니다. 사람은 개발을 모를 수 있습니다. 명령을 대신 실행하고, 결과를 쉬운 말로 설명하고, 결정이 필요한 것(게임 제목 · 규칙 · 그림 스타일)만 물어보세요.

## 1. 환경과 명령

- Node.js 22.12 이상. 그 밖의 설치는 필요 없습니다. SDK 와 CLI 는 npm 패키지입니다.
- 이 프로젝트가 아직 없다면: `npm create nori@latest <폴더>` (= `npx @nghslab/nori-cli init <폴더>`), 그 다음 `cd <폴더> && npm install`.

| 명령                                             | 하는 일                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `npm install`                                    | `@nghslab/nori-sdk` · `@nghslab/nori-cli` · `typescript` 설치                                    |
| `npm run typecheck`                              | TypeScript 검사. **코드를 고친 뒤 항상 실행**                                                    |
| `npm run pack`                                   | `nori build .` — `.nori` 파일 생성 → `dist/<id>-<version>.nori`                                  |
| `npm run check`                                  | `nori check dist/<id>-<version>.nori` — 매니페스트 · 체크섬 · SDK 검사                           |
| `npx nori --help`                                | 명령과 `nori.json` 규칙 요약                                                                     |
| `npm update @nghslab/nori-sdk @nghslab/nori-cli` | SDK·CLI 를 최신 호환 버전으로 올린다. SDK 는 `.nori` 에 번들되므로 올린 뒤 반드시 `npm run pack` |

작업을 마칠 때는 `npm run typecheck && npm run pack && npm run check` 가 모두 통과해야 하고, 사람에게 `dist/` 의 `.nori` 파일 경로를 알려 줍니다.

## 2. 프로젝트 구조 (바꾸지 않는 것)

```
nori.json        카트리지 정보. 게임 코드와 빌드 도구가 같은 파일을 읽는다
package.json     의존성·스크립트. 게임 엔진을 추가할 때만 손댄다
tsconfig.json    strict TypeScript, lib 는 DOM. 바꾸지 않는다
src/cart.ts      진입점. `export const cartridge = defineCartridge({ manifest, mount })` 가 반드시 있어야 한다
src/**           게임 코드는 자유롭게 나눈다 (300줄 넘으면 파일을 쪼갠다)
assets/          이미지·소리. 코드에서는 api.assets.url('파일') 로만 접근
cover.png        (선택) 라이브러리 커버 480×270. 넣으면 nori.json 에 "cover": "cover.png"
```

### nori.json 규칙

```json
{
  "id": "my-cart",
  "title": "내 게임",
  "version": "0.1.0",
  "author": "이름",
  "description": "한 줄 소개",
  "cover": "cover.png",
  "screen": { "width": 480, "height": 270, "layout": "single" },
  "saveSlots": ["main"],
  "build": { "entry": "src/cart.ts", "assets": "assets" }
}
```

- `id` 는 `[a-z0-9-]` 1~63자. **한 번 정해 배포했으면 바꾸지 않는다** (세이브·파일 이름이 묶임).
- `version` 은 semver. 기능을 더하면 minor(0.2.0), 고치기만 하면 patch(0.1.1).
- `screen` 은 기본 480×270 (16:9). 특별한 이유 없이 바꾸지 않는다. `ds-dual` 두 화면은 선택.
- `author` `description` `cover` 는 선택. 넣을 때 빈 문자열은 안 된다(검증 실패).
- `saveSlots` 는 세이브 슬롯 이름 목록. 기본 `["main"]`.

## 3. 절대 규칙

1. **콘솔이 주는 `api`(ConsoleAPI)와 브라우저 API 만 쓴다.** Node · Electron · `window.norideck` · `fetch` 로 외부 서버 접근은 하지 않는다. 카트리지는 sandbox 안에서 돈다.
2. **에셋은 파일마다 `api.assets.url('경로')`.** `assets.url('')` 을 기준 경로로 잡고 문자열을 이어 붙이거나, `/assets/...` 절대 경로를 쓰면 콘솔 안에서 깨진다.
3. **입력은 DS 버튼 이름으로만.** `UP DOWN LEFT RIGHT A B X Y L R SELECT START`. 어떤 키보드 키인지는 콘솔 설정이므로 게임 안 안내 문구도 "A 버튼" 처럼 버튼 이름으로 쓴다. `KeyboardEvent` 를 직접 듣지 않는다.
4. **`pause()` 에서 게임 루프를 멈추고 `resume()` 에서 다시 시작한다.** 플레이어가 홈으로 나가면 콘솔이 `pause` 를 부른다. `unmount()` 에서는 리스너를 모두 해지하고 캔버스를 제거한다.
5. **배속을 반영한다.** 시간 증가량에 `api.time.speed` 를 곱한다. 소리를 직접 다루면 재생 속도에도 곱한다 (Phaser 어댑터는 자동).
6. **세이브는 `api.save`** 로만. localStorage · IndexedDB · 쿠키를 쓰지 않는다. 형식은 JSON 문자열. 다음 버전에서도 읽을 수 있게 유지한다.
7. **다른 사람의 저작물(캐릭터 · 스프라이트 · 음악 · 상표)을 넣지 않는다.** 오마주는 되지만 원본 복제는 안 된다. 그림·소리가 필요하면 코드로 그리거나(캔버스), 사용자가 제공한 파일을 쓰거나, 라이선스가 확인된 자료만 쓴다.
8. **`src/cart.ts` 의 `export const cartridge`** 를 없애거나 이름을 바꾸지 않는다. `manifest` 는 `parseCartInfo(noriJson)` 결과를 그대로 넣는다.
9. `tsconfig.json` 의 strict 설정을 끄지 않는다. 타입 오류는 우회하지 말고 고친다.

## 4. ConsoleAPI 요약 (정확한 시그니처)

```ts
import {
  defineCartridge,
  parseCartInfo,
  ButtonPoller,
  type ConsoleAPI,
  type GameInstance,
} from '@nghslab/nori-sdk';
import noriJson from '../nori.json';

const info = parseCartInfo(noriJson); // info.screen.width / height 를 논리 해상도로 쓴다

export const cartridge = defineCartridge({
  manifest: info,
  async mount(api: ConsoleAPI): Promise<GameInstance> {
    // ---- 화면: api.screen.container 에 캔버스를 붙인다. 콘솔이 비율·확대를 맡는다
    const canvas = document.createElement('canvas');
    canvas.width = info.screen.width; // 480
    canvas.height = info.screen.height; // 270
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    api.screen.container.append(canvas);
    const ctx = canvas.getContext('2d')!;

    // ---- 입력
    api.input.isDown('LEFT'); // boolean
    const off = api.input.on('A', 'down', () => {}); // 'down' | 'up'. off() 로 해지
    api.input.onAny((button, phase) => {});
    api.input.onPointer(({ type, x, y }) => {}); // 마우스·터치, 논리 좌표
    const poller = new ButtonPoller(api.input); // 프레임 기준 "방금 눌림"
    const confirm = poller.buttons('A', 'START');
    poller.justDown(confirm);
    poller.isDown(confirm); // 루프 안에서. unmount 에서 poller.destroy()

    // ---- 세이브 (문자열, 슬롯 기본 'main')
    const raw = await api.save.read('main'); // string | null
    await api.save.write(JSON.stringify({ level: 1 }), 'main');
    await api.save.remove('main');
    await api.save.list(); // string[]

    // ---- 에셋
    const img = new Image();
    img.src = api.assets.url('sprites/hero.png'); // assets/sprites/hero.png
    const audio = new Audio(api.assets.url('bgm.ogg'));

    // ---- 시간·시스템
    api.time.speed; // 1 또는 3. dt 에 곱한다
    api.time.onSpeedChange((speed) => {});
    api.system.isDesktop;
    api.system.log('메시지'); // 로그는 콘솔 개발자 도구에
    api.screen.layout; // { width, height, layout, scale, top?, bottom? }
    api.screen.onResize((layout) => {});

    // ---- 루프
    let running = true;
    let last = performance.now();
    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000) * api.time.speed;
      last = now;
      // update(dt); draw(ctx);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    return {
      pause: () => {
        running = false;
      },
      resume: () => {
        if (!running) {
          running = true;
          last = performance.now();
          requestAnimationFrame(tick);
        }
      },
      unmount: () => {
        running = false;
        off();
        poller.destroy();
        canvas.remove();
      },
    };
  },
});
```

`ds-dual` 레이아웃이면 `api.screen.layout.top` / `bottom` 사각형(논리 좌표) 안에 각각 그립니다.

### Phaser 3 를 쓸 때

`npm install phaser` 후:

```ts
import { createPhaserGame, phaserInstance } from '@nghslab/nori-sdk/phaser';
mount(api) {
  const game = createPhaserGame(api, { scene: [BootScene, PlayScene] });
  game.registry.set('api', api); // 씬에서 this.registry.get('api')
  return phaserInstance(game);
}
```

Phaser 의 키보드 플러그인은 꺼져 있습니다(입력은 콘솔 소유). 씬에서 `api.input` 또는 `ButtonPoller` 를 씁니다. 배속은 어댑터가 time · tweens · anims · 소리 재생 속도에 반영합니다. 엔진 없이 캔버스만으로 충분한 게임이라면 Phaser 를 넣지 않는 편이 가볍습니다(번들 크기).

## 5. 작업 순서

1. **요구 파악** — 사람에게 게임 종류 · 조작 · 승패 조건 · 분위기를 짧게 확인한다. 답이 없으면 합리적으로 정하고 무엇을 정했는지 말한다.
2. **nori.json** — `id`(영문 소문자) · `title` · `description` · `author` 를 채운다.
3. **코드** — `src/cart.ts` 를 시작점으로 게임을 만든다. 파일이 커지면 `src/` 아래로 나눈다. 텍스트는 캔버스에 `Galmuri11` / `Galmuri9` 폰트(콘솔 내장 픽셀 폰트)로 그리면 어울린다: `ctx.font = '11px Galmuri11, monospace'`.
4. **그림** — 그림 파일이 없으면 캔버스로 직접 그린다(사각형 · 원 · 선). 커버가 필요하면 480×270 PNG 를 만들어 `cover.png` 로 두고 nori.json 에 적는다.
5. **검증** — `npm run typecheck` → `npm run pack` → `npm run check`. 오류는 메시지를 읽고 고친다.
6. **전달** — `dist/<id>-<version>.nori` 경로를 알려 주고 "NoriDeck 홈 화면에 끌어다 놓으면 됩니다" 라고 안내한다. 조작법을 버튼 이름으로 정리해 준다.
7. **수정 요청** — 바꾼 뒤 `version` 을 올리고 다시 5 → 6.

## 6. 자주 하는 실수

| 실수                                       | 대신                                                      |
| ------------------------------------------ | --------------------------------------------------------- |
| `window.addEventListener('keydown', …)`    | `api.input.on(...)` / `ButtonPoller`                      |
| `fetch('/assets/x.png')`, 경로 이어 붙이기 | `api.assets.url('x.png')` 를 파일마다                     |
| `localStorage.setItem(...)`                | `api.save.write(...)`                                     |
| `pause` 에서 아무것도 안 함                | 루프 플래그를 내리고 `resume` 에서 시간 기준점 다시 잡기  |
| 캔버스 크기를 창 크기로 잡음               | 논리 해상도(480×270)로 고정, CSS 100%. 확대는 콘솔이 한다 |
| `nori.json` 에 `"author": ""`              | 빈 값이면 필드를 빼기                                     |
| 유명 게임 스프라이트 · 음악 사용           | 직접 그리기 / 사용자 제공 / 라이선스 확인된 자료          |
| `id` 를 나중에 바꿈                        | 처음에 정하고 유지. 바꾸면 세이브가 이어지지 않는다       |

## 7. 참고 문서

- 제작자용 전체 가이드: https://github.com/NGHSLab/NoriDeck/blob/main/docs/cartridge-guide.md
- `.nori` 포맷 명세: https://github.com/NGHSLab/NoriDeck/blob/main/docs/nori-format.md
- 완성 예제(뱀 게임): https://github.com/NGHSLab/NoriPack/tree/main/snakegame
- SDK 타입 원본: `node_modules/@nghslab/nori-sdk/dist/index.d.ts`
