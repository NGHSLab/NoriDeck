# CLAUDE.md — NoriDeck 콘솔 작업 규칙

이 저장소에서 코드를 생성·수정하는 AI 는 이 문서를 먼저 읽고 따른다.

- 카트리지 제작자에게 보이는 문서는 [docs/cartridge-guide.md](docs/cartridge-guide.md)(사람용)와 [docs/ai-cartridge-guide.md](docs/ai-cartridge-guide.md)(AI 코딩 도구용, `nori init` 이 AGENTS.md 로 복사)다. SDK(ConsoleAPI)·CLI·nori.json 을 바꾸면 이 문서도 같이 고친다.
- 단계별 계획과 현재 진행 상태: [docs/norideck-plan.md](docs/norideck-plan.md) — **한 단계씩, 매 단계 끝에 사용자 확인을 받는다.** 여러 단계를 한 번에 진행하지 않는다.
- 첫 카트리지(포켓몬 게임)는 별도 저장소 `../gamepack/pokemon-cipher` 에 있다. 이 저장소에는 게임 코드·데이터를 두지 않는다.

## 한 줄 요약

NoriDeck 은 TypeScript 카트리지(`.nori`)를 실행하는 레트로 게임기 스타일 소프트웨어 콘솔이다. 기본 화면은 한 화면 16:9(콘솔 기준 480×270, 카트리지가 매니페스트로 해상도를 정함)이며 `ds-dual` 은 옵션으로만 남긴다. 콘솔은 화면 비율·키 배치·세이브·배속·업데이트를 소유하고, 게임과 게임 엔진은 모른다. 표시 이름은 `runtime/src/config.ts` 의 `CONSOLE_NAME`, 내부 ID `CONSOLE_ID`(`norideck`) 는 고정.

## 구조

```
sdk/       콘솔 ↔ 카트리지 계약. src/index.ts 가 곧 포맷이다. 바꾸면 SDK_VERSION 을 올린다 (package.json version 과 같게). npm 패키지 @nghslab/nori-sdk — exports 는 dist/ (tsc, npm install 의 prepare 가 빌드). SDK 소스를 고친 뒤에는 `npm run build:sdk`
  src/manifest.ts nori.json / manifest.json 타입·검증기 (콘솔·CLI·카트리지 공용)
  src/input.ts    ButtonPoller (프레임 기준 justDown)      src/phaser.ts   Phaser 카트리지용 어댑터
cli/       `nori` CLI: init(뼈대, 템플릿은 src/init.ts 문자열) / build(Vite 라이브러리 빌드 → zip) / check / unpack. esbuild 로 dist/nori.js 하나로 묶인다 (npm install 시 prepare). npm 패키지 @nghslab/nori-cli
create-nori/  `npm create nori` 껍데기. @nghslab/nori-cli 의 init 을 부른다
runtime/   콘솔 펌웨어 (Vite). 특정 게임·엔진을 import 하지 않는다
  src/console/    createConsole(ConsoleAPI 조립), screen(FIT 레터박스), input(키 배치→DS 버튼), save, keymap
  src/platform/   Electron 브리지 계약(bridge.d.ts), 커스텀 타이틀바(titlebar), 메뉴바(menubar UI + menus 정의), 대화상자(dialogs)
  src/loader.ts   cartFromUrl(): 풀어 놓은 .nori 폴더(manifest.json)를 URL 로 로드. 개발 서버 ?cart=, nori://, 웹 플레이 공용
  src/nori/       openNori: .nori 파일을 브라우저 안에서 풀어(fflate) 검사(체크섬 SHA-256)하고 blob URL 로 실행. 홈 화면 드롭·메뉴 열기가 쓴다
  src/session.ts  카트리지 세션: run · goHome(게임을 pause 하고 콘솔 입력을 끊은 채 뒤에 남김, 마지막 프레임 snapshot) · resume · eject. 뒤에 남는 게임은 하나
  src/home.ts     홈 화면(게임기 홈 메뉴): 라이브러리가 비면 흰 배경에 선 로고만(장식, 클릭 없음), 있으면 가운데 한 장 캐러셀(homeLibrary.ts: 둘 이상이면 ◀ ▶ 버튼(항상 표시, 호버 시 살짝 확대, 순환 없이 끝에서는 그쪽 버튼 숨김)·←→/A D 키·휠로 넘김, Enter/H 실행). 일시정지된 게임 카드는 마지막 화면 + 배지, 클릭하면 이어서. 파일은 드롭 또는 파일 → 카트리지 추가
  src/library.ts  라이브러리 브리지 글루(importNoriFile, loadLibraryCart). src/libraryActions.ts 가 가져오기·실행/이어서·종료·삭제를 세션·홈과 잇는다. 브라우저는 라이브러리 없이 즉시 실행
  src/i18n.ts     콘솔 UI 문자열(ko·en)과 t(). 언어는 Config → 언어 에서 고르고 localStorage 에 남는다. 게임 안 언어는 카트리지 몫
desktop/   Electron 메인·preload. 창, 세이브 파일 IPC, 창 제어 IPC, 데이터 루트(src/dataRoot.ts: norirepo/ 포터블 또는 %APPDATA%/norideck, 예전 구조 이전), 라이브러리 보관(src/library.ts: games/<id>/{cart.nori,meta.json,cover.*,saves/}), 패키징(electron-builder.yml)
  src/splash.ts + splash/splash.html  스플래시 카드(로고·이름·버전). 정적 HTML 에 버전만 치환해 data: URL 로 띄우고, 본 창 ready-to-show 에 닫는다
carts/sample/   엔진 없는 샘플 카트리지. SDK 가 "아무 TS 게임"에 충분한지 검증하는 용도 (CLI 테스트가 빌드한다. 콘솔에 내장되지 않음)
assets/logo/    로고 원본 SVG(타일 배경 포함) → 파비콘(runtime/public/logo.svg)·타이틀바·부트 화면(runtime/src/assets/logo.svg). 앱 아이콘(desktop/build/icon.*)은 배경 없는 NoriDeck_console.svg 를 크게 넣고 크기별로 외곽선을 굵게 한 것 (흰 작업표시줄 대비)
```

## 절대 규칙

1. **콘솔은 게임을 모른다.** `runtime/`·`desktop/`·`sdk/` 가 특정 게임의 코드·데이터·에셋을 import 하면 설계 위반. 게임에 필요한 기능은 `ConsoleAPI` 에 일반화해서 추가한다.
2. **SDK 표면은 작게, 안정적으로.** `sdk/src/index.ts` 의 타입이 카트리지 포맷이다. 추가는 신중히, 삭제·변경은 `SDK_VERSION` major 를 올린다.
3. **렌더러는 Node/Electron 을 모른다.** OS 기능은 `runtime/src/platform/bridge.d.ts` 계약 → `desktop/src/preload.ts` → `desktop/src/main.ts` 순서로 추가한다. 브라우저에서도 항상 동작(브리지 없으면 폴백).
4. **플랫폼 분기는 `desktop/` 에만.** Windows 가 1순위, Linux(GNOME·KDE)는 계획만, macOS 는 목표 아님. `runtime/`·카트리지는 플랫폼을 모른다.
5. **카트리지 코드는 sandbox 안에서.** `contextIsolation` + `sandbox` 를 끄지 않는다. 카트리지는 `ConsoleAPI` 와 브라우저 API 만 쓴다.
6. **파일은 작게.** 300줄이 넘기 시작하면 쪼갠다.
7. **이름은 상수로.** 표시 이름 `CONSOLE_NAME` 만 바꾼다. `CONSOLE_ID`, 프로토콜 `nori://`, 확장자 `.nori` 은 고정.
8. **`.nori` 포맷은 문서와 검증기가 원본.** 포맷을 바꾸면 `docs/nori-format.md` 와 `sdk/src/manifest.ts` 를 같이 고치고, 호환이 깨지면 `NORI_FORMAT` 을 올린다. 매니페스트 원본은 카트리지의 `nori.json` 하나다.

## 명령

```bash
npm install
npm run dev           # 콘솔 개발 서버 (홈 화면. 카트리지는 ?cart= 또는 드롭)
npm run dev:desktop   # Vite + Electron
npm run check         # typecheck + lint + format:check + test
npm run build:desktop # 설치 파일 → desktop/release/<버전>/ (Windows 기준으로 검증. Linux 는 확장자 없는 실행 파일 한 폴더. 지난 버전 폴더는 수동 정리)
npm run install:linux # Linux: 빌드 결과를 ~/.local/opt/norideck 에 설치 (실행 링크 · 아이콘 · 메뉴 항목)
npm run build:sdk     # sdk/dist 다시 만들기 (sdk 소스를 고쳤을 때 — runtime·cli·카트리지가 dist 를 본다)
npm run build:cli     # cli/dist/nori.js 다시 묶기 (cli 소스를 고쳤을 때)
node cli/dist/nori.js init <폴더>                                          # 새 카트리지 뼈대
node cli/dist/nori.js build carts/sample                                   # 샘플 .nori
node cli/dist/nori.js unpack <파일.nori> runtime/public/dev/<id> --force   # → npm run dev 후 /?cart=/dev/<id>/
```

## 문제 해결

- `electron.exe` 없음: `node node_modules/electron/install.js`.
- Electron 이 `bad option: --...` 로 종료: 셸에 `ELECTRON_RUN_AS_NODE=1` 이 상속됨 (VS Code 확장 호스트 등). `desktop/scripts/dev.mjs` 는 이를 제거하지만 직접 실행 시 변수를 해제한다.
- `build:desktop` 이 `EPERM rename win-unpacked.tmp` 로 실패: 저장소가 Desktop/Documents 같은 인덱싱 폴더 아래일 때 발생. 출력 경로를 `--config.directories.output=<다른 경로>` 로 바꾸거나 저장소를 옮긴다.
- 데이터 루트("SD 카드", `desktop/src/dataRoot.ts`): 실행 파일 옆에 `norirepo/` 폴더가 있으면 포터블 모드로 그 폴더, 아니면 `%APPDATA%/norideck`. 카트리지 하나 = `games/<id>/` 폴더 하나(cart.nori · meta.json · cover.* · saves/<slot>.json). 메뉴 도구 → 게임 폴더 열기 / 데이터 폴더 열기. 카트리지를 지워도 saves/ 는 남는다. 예전 library/·saves/ 는 첫 실행 때 자동 이전.
- 게임에서 홈으로: 메뉴 파일 → 홈. 게임은 꺼지지 않고 일시정지 상태로 뒤에 남으며(하나만), 홈 카드에 마지막 화면이 보인다. 카드 클릭 = 이어서, 카드 메뉴 "게임 종료" 또는 다른 카트리지 실행 = 완전히 내림. 데스크톱에서 드롭·"카트리지 추가"는 라이브러리 가져오기. 게임 중 창 제목은 게임 이름만.
- 새 UI 문자열은 반드시 `runtime/src/i18n.ts` 에 ko·en 둘 다 넣고 t() 로 쓴다. 하드코딩 금지.
- 키 배치는 `runtime/src/console/keymap.ts` 한 곳: 기본 십자키 WASD(방향키 보조), A B X Y = H J K L, L R = Y U, SELECT START = I O, 홈 = P. 사용자가 Config → 키 배치(기기 그림 둘레 칸, keymapDialog·keymapDevice·keymapLayout) 에서 바꾸면 localStorage(`norideck.keymap`)에 남고 onKeymapChange 로 즉시 반영. 기본값을 바꾸면 README 조작표도 같이. Tab·F11 은 고정 예약.
- 홈 키(기본 P)는 게임 중이면 홈으로, 홈에서 뒤에 게임이 있으면 이어서. 타이틀바에는 홈 버튼을 두지 않는다(메뉴 파일 → 홈 만). 메뉴 순서는 파일 · 보기 · 도구 · Config · 도움말. Config 메뉴(글자, 두 언어 공통): 언어 · 키 배치 · 소리 크기 · 배속 · 게임 폴더 · 데이터 폴더. 소리 크기·배속은 `runtime/src/console/settings.ts`(localStorage `norideck.settings`). 마스터 볼륨은 `console/audio.ts` 가 부팅 때 AudioNode.connect 를 감싸 모든 Web Audio 출력을 GainNode 로 보내는 방식이라 카트리지·SDK 는 모른다. 도구 메뉴는 배속·개발자 도구, 도움말은 정보. 카드의 톱니(옵션) 메뉴: 정보 · 폴더 열기 · 카트리지 내보내기(cart.nori → <id>-<version>.nori) · 세이브 백업(zip)/복원/지우기 · 게임 종료 · 삭제.
- 타이틀바·홈·부트 화면 색은 `runtime/src/console.css` 의 `--nd-*` 팔레트(로고 색: 크림 본체, 베이지 선, 민트 불꽃). 타이틀바는 크림(`--nd-cream`), 홈·부트 배경은 그보다 밝은 레트로 화이트(`--nd-white`, desktop 의 창 배경색과 같게). 호버·강조는 밝은 민트(`--nd-mint`, 로고 전용) 대신 한 톤 내린 `--nd-mint-deep` 을 쓴다 (흰 배경과 대비 완화). 창 배율은 `WINDOW_BASE_SCALE`(2배)을 ×1 로 삼아 0.5/1/1.5 단계, 기본 ×1(960×540).
- 카트리지는 에셋을 **파일마다** `assets.url(path)` 로 얻어야 한다. `assets.url('')` 기준 경로 이어 붙이기는 메모리에서 연 .nori 에서 깨진다.

## 코드 스타일 · 작업 방식

- TypeScript strict + `noUncheckedIndexedAccess`, `import type`, non-null assertion 은 테스트만.
- 주석은 한국어, 식별자는 영어. 데이터 ID `snake_case`/`kebab-case`, 타입 `PascalCase`, 함수 `camelCase`.
- **npm 배포.** @nghslab/nori-sdk · @nghslab/nori-cli · create-nori 는 npm 공개 패키지(조직 nghslab: @nghslab/nori-sdk · @nghslab/nori-cli · create-nori). 배포는 `npm publish -w sdk`, `-w cli`, `-w create-nori` 순서(cli 는 sdk 를, create-nori 는 cli 를 의존). SDK 를 바꾸면 sdk 버전과 SDK_VERSION 을 같이 올리고 cli 의 의존 범위도 맞춘다. 카트리지 개발자는 NoriDeck 저장소 없이 `npm create nori` 로 시작한다.
- 기능 하나 = 커밋 하나. 변경 후 `npm run check`. 사용자가 결정할 것(이름, 배포 방식, 서버 API)은 선택지를 제시하고 기다린다.
- **커밋 메시지는 Conventional Commits, scope 없이.** `<type>: <한국어 제목>` — type 은 `feat` `fix` `docs` `refactor` `chore` `test` `build` `ci` `style`. 괄호 scope 는 붙이지 않는다. 제목은 72자 이내, 마침표 없이. 본문은 한국어 항목으로 무엇을·왜 바꿨는지. 예: `feat: 홈 화면과 .nori 드롭 실행`, `fix: 프레임 없는 창 크기 보정`.
