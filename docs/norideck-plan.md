# NoriDeck 콘솔 · `.nori` 카트리지 작업 계획

> 2026-09-05 검토 완료, 실행 전 상태. 각 단계는 끝날 때마다 결과를 확인받은 뒤 다음 단계로 간다.
> 결정이 바뀌면 이 문서를 먼저 고친다.

---

## 0. 합의된 결정

| 항목                  | 결정                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 콘솔(에뮬레이터) 이름 | **NoriDeck**. 표시 이름은 언제든 바꿀 수 있게 상수 한 곳에서 관리                                                                              |
| 내부 ID               | `norideck` (세이브 폴더, appId, 프로토콜). **나중에 바꾸지 않는다**                                                                            |
| 카트리지 = 게임팩     | TypeScript 로 개발, 빌드해서 **`.nori`** 전용 포맷으로 생성. 생성은 CLI 로 자동화                                                              |
| 콘솔 ↔ 카트리지 경계  | `sdk/` 의 `ConsoleAPI` 계약. 카트리지는 자기 엔진(Phaser 등)을 들고 오고 콘솔은 엔진을 모른다                                                  |
| 업데이트·패치         | 서버에 새 버전이 뜨면 콘솔이 **팝업으로 먼저 물어보고** 승인 시 진행                                                                           |
| 배포                  | 콘솔은 OS별 설치 파일 + 자체 서버 업데이트. 카트리지는 서버 카탈로그에서 `.nori` 다운로드                                                      |
| 서버·웹페이지         | 사용자(형제)가 별도 개발 중. 콘솔은 아래 3단계의 API 계약만 맞춘다                                                                             |
| 화면 (2026-09-05)     | **한 화면(`single`)이 기본.** `ds-dual` 은 SDK 옵션으로 남긴다. 해상도는 카트리지가 매니페스트로 정한다                                        |
| 카트리지 설치         | 라이브러리 "가져오기" 메뉴로 `.nori` 선택 → `games/<id>/` 폴더에 보관. 같은 id 는 폴더를 새로 만들지 않고 버전만 교체                          |
| 세이브 관리           | 콘솔은 `games/<id>/saves/` 에 저장하고 "폴더 열기·게임 삭제(세이브 유지/삭제)" 만 제공. 클라우드·자동 백업 없음                                |
| 사이트                | `www.norideck.com` 설치 사이트, `www.norihub.com` `.nori` 공유 커뮤니티 (사용자 운영). 설치 없이 `.nori` 을 올려 웹에서 플레이하는 기능도 예정 |
| 우선순위              | **콘솔(에뮬레이터)이 1순위.** `.nori` 은 개발자가 만들고 테스트하기 쉬워야 한다. 사이트·서버는 그 다음                                         |

### 플랫폼 우선순위 (2026-09-05)

| 순위 | 플랫폼                                     | 범위                                                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Windows** (`.exe`, NSIS 설치 + portable) | 지금 개발·검증·배포의 기준. 스모크 테스트와 패키징을 여기서 완성한다                                                                                                                                                                                                              |
| 2    | **Linux** (GNOME · KDE)                    | 계획만 세워 둔다. 목표는 AppImage 하나로 두 데스크톱에서 잘 뜨는 것. 확인할 것: Wayland/X11 창 장식(프레임 없는 창 + 커스텀 타이틀바가 Wayland 에서 드래그·크기 조절이 되는지), `%APPDATA%` 대응 경로(`~/.config/norideck`), 폰트·GPU 가속, 데스크톱 항목(.desktop 파일)과 아이콘 |
| 3    | macOS                                      | 당장 목표 아님. electron-builder 설정은 남겨 두되 검증하지 않는다                                                                                                                                                                                                                 |

- 게임이 완성된 뒤 배포 방식(자체 서버 다운로드, 스토어 등)을 정한다. 그때까지는 자체 서버 배포를 전제로 설계만 유지한다.
- 코드 공통 원칙: 플랫폼별 분기는 `desktop/`(Electron 메인)에만 두고 `runtime/`·카트리지는 플랫폼을 모른다. Linux 대응이 시작되면 건드릴 곳이 한 곳이어야 한다.

---

## 1. 이름을 바꾸기 쉽게 하는 규칙

| 층            | 쓰이는 곳                                                                          | 관리                                                |
| ------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| 표시 이름     | 창 제목, 타이틀바, 부트 화면, 웹페이지                                             | `runtime/src/config.ts` 의 `CONSOLE_NAME` 하나      |
| 내부 ID       | `%APPDATA%/norideck`, electron-builder `appId`, 프로토콜 `nori://`, 확장자 `.nori` | `CONSOLE_ID` 상수 + electron-builder 설정. 고정     |
| 패키지 스코프 | `@nghslab/nori-sdk`, `@norideck/runtime`, `@norideck/cart-pokemon`                 | package.json 문자열. 공개 전까지는 찾아 바꾸기로 끝 |

내부 ID 를 바꾸면 사용자 세이브 폴더가 달라져 마이그레이션이 필요하므로 지금 확정한다.

---

## 2. 저장소 구조

```
NoriDeck/
├── sdk/        콘솔 ↔ 카트리지 계약(ConsoleAPI, 매니페스트 타입·검증기), ButtonPoller, Phaser 어댑터
├── cli/        `nori` CLI (build / check / unpack). esbuild 로 dist/nori.js 하나로 묶인다
├── runtime/    콘솔 펌웨어(Vite 앱): 화면 비율·레터박스, 키 배치, 세이브, 배속, URL 로더(?cart=), (예정) 라이브러리·업데이트 팝업
├── desktop/    콘솔 본체(Electron): 창·타이틀바, 세이브 파일, (예정) .nori 가져오기·nori:// 프로토콜·electron-updater
├── carts/      내장 샘플 카트리지 (검증용)
└── docs/       이 계획, nori-format.md
```

게임(포켓몬)은 별도 저장소 `../gamepack/pokemon-cipher` 다. 콘솔 저장소에는 게임 코드·데이터를 두지 않는다.

---

## 3. `.nori` 포맷 (v1 확정, 2026-09-05)

정식 스펙은 [nori-format.md](nori-format.md). 요점:

- `.nori` = zip. `manifest.json` + `cart.js`(Vite 단일 ESM, 엔진 포함) + `assets/` + `cover.*`(선택) + `checksums.json`(sha256).
- **`nori.json` 하나가 원본.** 카트리지 프로젝트 루트에 두고 게임 코드(`parseCartInfo(noriJson)`)와 `nori build` 가 같이 읽는다. `build: { entry, assets }` 는 빌드 전용.
- `manifest.json` = nori.json 정보 + `format: 1`, `entry: 'cart.js'`, `sdkVersion`(카트리지에 설치된 SDK 버전), `builtAt`.
- 콘솔은 `format` 과 `sdkVersion` major 가 맞아야 실행하고, `manifest.json` 의 id 와 `cart.js` 매니페스트의 id 를 대조한다.
- 서명은 보류(외부 배포 시 `signature`).

### CLI (`cli/`, 명령 `nori`)

```bash
nori build [폴더] [--out <폴더>] [--sourcemap]   # nori.json → dist/<id>-<version>.nori
nori check <파일.nori>                          # 매니페스트·체크섬·SDK 버전 검사 (실패 시 종료 코드 1)
nori unpack <파일.nori> [폴더] [--force]         # 폴더로 풀기 → 콘솔 개발 서버 ?cart=/dev/<폴더>/ 로 실행
```

포켓몬 카트리지는 `npm run pack` (= `nori build game`) 으로 연결되어 있다.

---

## 4. 단계별 계획

### 0단계 · 초록불 복구 (기능 변화 없음)

- 반쯤 진행된 콘솔/카트리지 분리를 마무리: `desktop` 세이브 IPC 를 카트리지·슬롯 단위로, 루트 스크립트·ESLint·CI 를 `runtime` 기준으로, `CONSOLE_NAME`/`CONSOLE_ID` 상수 적용, 패키지 스코프 `@norideck/*`.
- 검증: `npm run check`, 브라우저·Electron 스모크 테스트가 이전과 동일하게 통과.
- 확인 지점: 콘솔이 게임을 모르는지(runtime 이 client 의 씬·데이터를 import 하지 않는지) 코드 트리 확인.

### 1단계 · `.nori` 포맷 확정과 빌드 자동화 — **완료 (2026-09-05)**

- `sdk/src/manifest.ts`(타입·검증기, SDK 0.2.0), `cli/`(`nori build/check/unpack`), 런타임 URL 로더(`cartFromUrl`, `?cart=`), 샘플·포켓몬 카트리지 `nori.json` 전환, 포켓몬 `npm run pack`.
- 검증: 샘플·포켓몬 `.nori` 빌드 → `nori check` 통과 → `runtime/public/dev/` 에 풀어 `?cart=` 로 실행, 게임 전체 흐름 스모크 통과. 테스트 36개(SDK 검증기, zip 왕복, 빌드→검사→해제).
- 확인 지점: 매니페스트 필드 목록(`nori-format.md` §2·§3)을 서버 DB `cart_versions` 와 맞출 것.

### 2단계 · 카트리지 가져오기와 라이브러리 화면 (다음)

- 저장 구조 (`%APPDATA%/norideck/`):
  ```
  games/<id>/
    cart.nori        가져온 원본
    saves/<slot>.json
    cache/           압축 해제본 (지워도 재생성)
    meta.json        버전·설치일
  ```
  기존 `saves/<cartId>/` 는 배포 전이므로 마이그레이션 없이 위 구조로 바꾼다.
- (선반영 2026-09-05) 홈 화면 + **메모리 실행**: `.nori` 를 드롭·열기하면 렌더러가 fflate 로 풀어 체크섬을 검사하고 blob URL 로 바로 실행한다(브라우저·데스크톱 공통, 설치 없음). 파일 메뉴에 열기·꺼내기.
- Electron 메인: `.nori` **설치**(검사 → `games/<id>/` 복사), 캐시에 풀고 `nori://<id>/…` 프로토콜로 서빙 → 다음 실행 때 홈 화면 목록에서 바로 실행. 렌더러는 `cartFromUrl('nori://<id>/')` 를 쓴다. sandbox·contextIsolation 유지.
- 같은 id 재가져오기: 새 버전이면 `cart.nori` 만 교체(세이브 유지), 같은 버전이면 "이미 설치됨", 옛 버전이면 확인 후 교체.
- 라이브러리 화면: 설치된 카트리지 목록(커버·제목·버전) → 선택 실행 → 게임 중 "카트리지 꺼내기"로 복귀. "가져오기", "폴더 열기", "삭제(세이브 유지/삭제)" 메뉴.
- ~~한 화면 기본값 적용~~ → 2026-09-05 선반영: 콘솔 기준 480×270(16:9), 샘플 카트리지 single, 첫 창은 작업 영역에 맞는 정수 배율. 타이틀바를 로고 색(크림)으로, 닫기 호버 민트, 메뉴바(파일·도구·보기·도움말) 추가. (포켓몬 게임의 아래 화면 UI 통합은 게임팩 저장소 작업)
- 브라우저 모드는 개발용(`?cart=`)으로 유지. 웹 플레이(사이트에서 `.nori` 업로드)는 같은 로더를 쓰되 사이트 개발 시점에 맞춘다.
- 검증: 포켓몬 `.nori` 가져오기 → 목록 → 실행 → 세이브가 `games/pokemon-cipher/saves/` 에 생기는지, 재가져오기 규칙.
- 확인 지점: 라이브러리 화면 모양, "하나면 바로 실행" 여부, 한 화면 기본 해상도.

### 3단계 · 업데이트와 패치 (팝업 승인)

- 콘솔 시작 시와 주기적으로 서버에 콘솔 최신 버전, 설치된 카트리지들의 최신 버전을 조회.
- 새 버전이 있으면 팝업: 제목·버전·변경 내용·용량, `[지금 업데이트] [나중에] [이 버전 건너뛰기]`. 승인 시에만 다운로드.
  - 콘솔 본체: `electron-updater`(generic provider, 자체 서버) 로 다운로드 → 진행률 → 재시작 시 적용(즉시 재시작 여부도 질문).
  - 카트리지: `.nori` 다운로드 → 체크섬 검증 → 기존 파일 교체. 실행 중이면 다음 실행부터 적용.
- 검증: 로컬 가짜 서버(JSON 정적 파일)로 팝업 → 다운로드 → 교체 흐름 확인.
- 확인 지점(시작 전): 서버 API 최종본.

### 4단계 · 문서와 CI

- CLAUDE.md·핸드오프 문서를 콘솔/카트리지 구조로 갱신, `docs/nori-format.md` 정식 스펙.
- CI 에 `nori build` 와 산출물 업로드 추가.

---

## 5. 서버 API 계약 (초안, 서버 설계에 맞춰 조정)

```
GET /api/console/latest?platform=win32|darwin|linux
  → { version, url, sha512, size, notes, publishedAt }
  + electron-updater 용 정적 파일: /updates/<platform>/latest.yml (electron-builder 가 생성)

GET /api/carts
  → [{ id, title, author, description, cover, latestVersion }]

GET /api/carts/:id/latest
  → { version, sdkVersion, url, sha256, size, changelog, publishedAt }
```

DB 초안: `releases(platform, version, url, sha512, size, notes, published_at)`,
`carts(id, title, author, description, cover_url)`,
`cart_versions(cart_id, version, sdk_version, sha256, size, url, changelog, published_at)`.
계정·클라우드 세이브는 후순위: `users`, `saves(user_id, cart_id, slot, data, updated_at)`.

### 서버 쪽에서 정해 줄 것

1. API 기본 URL 과 위 엔드포인트의 경로·응답 필드 이름.
2. 설치 파일과 `.nori` 을 서버가 직접 서빙할지, 오브젝트 스토리지 URL 을 돌려줄지.
3. 카트리지 `id` 규칙(`[a-z0-9-]`)과 semver 사용 여부.

---

## 6. 보류·후순위

- 카트리지 서명(키 발급·검증) — 외부 배포 시.
- 코드 서명 인증서(Windows SmartScreen) — 배포 규모가 커지면.
- 계정·클라우드 세이브, 카트리지 판매·라이선스.
- 폴더 이름 변경(`client` → `carts/pokemon-cipher`).
- 외부 카트리지 격리 강화(`<iframe sandbox>` 모드).

---

## 7. 현재 상태 스냅샷 (2026-09-05, 1단계 완료)

- **0·1단계 완료.** `npm run check` 통과(타입체크·린트·포맷·테스트 36개), `npm run build` 통과.
- `.nori` v1 포맷과 `nori` CLI 동작. 포켓몬 카트리지는 `npm run pack` → `game/dist/pokemon-cipher-0.0.1.nori`(약 800KB, Phaser 포함) → `nori unpack … runtime/public/dev/pokemon-cipher` → `http://localhost:5173/?cart=/dev/pokemon-cipher/` 로 실행·스모크 통과.
- 런타임은 라이브러리로도 쓰인다: `@norideck/runtime` 의 `bootConsole({ carts })`, `cartFromUrl(url)`, `@norideck/runtime/vite` 의 `cartAssetsPlugin`. 게임팩 `dev/` 하네스는 여전히 소스를 직접 올려 HMR 로 개발한다.
- 세이브는 아직 `%APPDATA%/norideck/saves/<cartId>/<slot>.json`. 2단계에서 `games/<id>/saves/` 로 바뀐다.
- 홈 화면(2026-09-05 저녁): 카트리지가 없을 때 크림 배경·베이지 선 로고·`.nori` 드롭 칸. 드롭/열기 → 메모리에서 검사·실행(`runtime/src/nori/openNori.ts`), 파일 메뉴 꺼내기 → 홈으로. 앱 아이콘·타이틀바·파비콘·부트 로고는 모두 콘솔만 담은 같은 그림.
- 한 화면 기본값·타이틀바 메뉴바(2026-09-05 저녁): `DEFAULT_SCREEN` 480×270, 샘플 카트리지 single, 메뉴(파일: 가져오기(준비 중)·종료 / 도구: 배속·세이브 폴더·설정 폴더·개발자 도구 / 보기: 창 배율 ×1~3·전체화면 / 도움말: 키 배치·정보). 브리지에 `window.setContentSize`, `system.openFolder`, `system.toggleDevTools` 추가.
- 콘솔 껍데기 다듬기(2026-09-05 밤): 스플래시 카드(`desktop/splash/`), 중복 실행 방지(single instance), 창 배율 기준 변경(×1 = 960×540, 단계 ×0.5/×1/×1.5, "보기 → 창 배율" 서브메뉴), 홈 화면을 순백 배경·선 아이콘만으로 단순화(파일을 끌어오면 드롭 칸, 아이콘 클릭은 파일 열기), 밝은 민트는 로고 전용으로 두고 호버는 `--nd-mint-deep`. 내장 샘플 카트리지를 콘솔에서 제거(`carts/sample` 은 CLI 테스트용으로만 남음). 테스트용 경량 카트리지 `../NoriHub/dumy`(id `dumy`, cover 포함) 생성 → `nori build/check` 통과, `?cart=/dev/dumy/` 로 실행 확인.
- 라이브러리(2026-09-05 밤, 2단계 일부 선반영): 데스크톱 브리지 `library`(list/import/read/remove/openFolder, `desktop/src/library.ts`, `%APPDATA%/norideck/library/<id>/{cart.nori,meta.json,cover.*}`). 드롭·"카트리지 추가…"는 런타임이 검사(`openNori`)한 뒤 보관소에 넣고, 홈은 커버 타일 그리드(`homeLibrary.ts`: 실행·정보·폴더 열기·삭제, "+" 가져오기). 메뉴 파일: 홈 · 카트리지 추가…. 게임 중 창 제목은 게임 이름만. 기본 키 배치 WASD / HJKL / YO / UI. Dumy 가져오기 → 타일 → 실행 확인.
- 홈 = 게임기 홈(2026-09-06 새벽): `session.ts` 분리(run · goHome=일시정지+마지막 프레임 snapshot · resume · eject, 뒤에 남는 게임 하나), 홈 캐러셀(가운데 한 장, ◀ ▶ 커버 바깥, ⋯ 는 커버 오른쪽 위, 실행 중 게임이 맨 앞·나머지는 가져온 순), 일시정지 카드는 마지막 화면+배지(WebGL 이 검게 나오면 커버로 대체). 콘솔 UI 한국어·영어(`i18n.ts`, 도구 → 언어…). 홈 아이콘 클릭 열기 제거(드롭·파일 → 카트리지 추가…만). 테스트 카트리지를 Dumy → `../NoriHub/snake`(클리어 목표 있는 뱀 게임)로 교체.
- 데이터 루트·games 폴더(2026-09-06): `desktop/src/dataRoot.ts` — 실행 파일 옆 `norirepo/` 가 있으면 포터블(브라우저 캐시는 `.cache/`), 아니면 `%APPDATA%/norideck`. 카트리지 하나 = `games/<id>/{cart.nori,meta.json,cover.*,saves/}`, meta 에 source(local/hub) 자리. 예전 library/·saves/ 는 첫 실행 때 자동 이전(확인 완료). 메뉴 도구: 게임 폴더 열기 · 데이터 폴더 열기. 카드는 시작(이어서)·옵션 버튼, 언어 대화상자는 세로 목록(영어 먼저). 2단계의 `games/<id>/saves/` 이전 항목은 이것으로 완료.
- 키 배치 변경·홈 버튼·세이브 관리(2026-09-06): `keymap.ts` 가 사용자 배치를 localStorage 에 저장하고 즉시 반영(`keymapDialog.ts`: 행마다 변경, 기본값 복원, Tab·F11 고정, 홈 키 기본 Esc). 타이틀바 홈 버튼 + 홈 키 = 게임↔홈 전환. 카드 옵션에 카트리지 내보내기(`library.export`), 세이브 백업(zip, `system.saveFile`)/복원(zip 선택)/지우기(`save.clear`). 입력 리스너 누수 수정(input.destroy).
- npm 배포 준비(2026-09-06): @nghslab/nori-sdk 는 dist(tsc, prepare)로 export, phaser 는 선택 peer. @nghslab/nori-cli 0.2.0 에 `nori init`(템플릿은 src/init.ts 문자열) + 규칙 요약 --help. `create-nori`(npm create nori) 워크스페이스 추가. CONTRIBUTING 을 npm 우선 흐름으로. 실제 `npm publish` 는 npm 계정·@norideck 조직 준비 뒤.
- npm 배포(2026-09-06): `@nghslab/nori-sdk@0.2.0` · `@nghslab/nori-cli@0.2.0` · `create-nori@0.1.0` 을 npm 에 공개(계정 2FA 켠 뒤 터미널에서 publish). `npm create nori@latest` 로 새 카트리지를 만들어 install → typecheck → pack → check 까지 레지스트리 패키지만으로 통과 확인. Snake-nori 는 `file:` 의존을 `^0.2.0` 으로 바꿈. npm 조직은 `nghslab` 만 사용(`norideck` 은 스코프 보호용으로 유지, `norilab` 은 삭제 예정).
- 0.1.1(2026-09-06): 대화상자를 닫은 뒤 keyup 이 막혀 키가 눌린 채 남던 버그 수정. Config 에 소리 크기(슬라이더, 마스터 볼륨은 `console/audio.ts` 가 AudioNode.connect 를 감싸 GainNode 로)·배속(×1.5/2/3/4) 설정(`console/settings.ts`, localStorage `norideck.settings`). sdk 0.2.1: Phaser 어댑터가 배속을 `sound.setRate` 에도 반영. 카트리지 가이드에 SDK 업데이트 절.
- 0.1.2(2026-09-06): Electron `autoplayPolicy: no-user-gesture-required` — 카트리지 타이틀 음악이 첫 입력 없이 바로 나온다(콘솔에 브라우저 자동재생 제한을 둘 이유가 없다). 콘솔 본체만 바뀌어 sdk·cli 는 0.2.1 그대로.
- 0.1.3(2026-10-10): 키 배치 대화상자를 표에서 기기 그림 배치로(가운데 CSS 로 그린 NoriDeck, 둘레에 L·십자키 / R·ABXY / SELECT·START 칸, 아래 콘솔 줄 홈·Tab·F11). 칸 호버·입력 대기 시 그림 부분 강조, Esc 는 입력 취소. 기본 키 L R = Y U, SELECT START = I O.
- git: 원격 `NGHSLab/NoriDeck`.
- 다음: **2단계** 가져오기·라이브러리·`nori://` 로더 (시작 전 사용자 확인).
