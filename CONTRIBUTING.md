# NoriDeck 개발 참여 가이드

NoriDeck 에 기여하는 방법은 두 갈래입니다. **카트리지(게임)를 만드는 것**과 **콘솔 자체를 개발하는 것**. 둘은 저장소도, 규칙도 다릅니다.

- 카트리지: 자기 저장소에서 만들고 `.nori` 로 묶습니다. 콘솔 코드는 건드리지 않습니다. → [카트리지 개발 가이드](docs/cartridge-guide.md)
- 콘솔: 이 저장소(`NGHSLab/NoriDeck`)에 이슈·PR 로 참여합니다. → [2. 콘솔 개발](#2-콘솔-개발)

콘솔을 쓰는 방법은 [README.md](README.md) 에 있습니다.

## 1. 카트리지 만들기

자세한 내용은 **[카트리지 개발 가이드](docs/cartridge-guide.md)** 에 있습니다. 여기서는 흐름만 요약합니다.

```bash
npm create nori@latest my-cart     # 뼈대 생성 (= npx @nghslab/nori-cli init my-cart)
cd my-cart
npm install                        # @nghslab/nori-sdk · @nghslab/nori-cli · typescript
npm run pack                       # → dist/my-cart-0.1.0.nori
```

- Node.js 22.12 이상만 필요합니다. SDK(`@nghslab/nori-sdk`)와 CLI(`@nghslab/nori-cli`, 명령 `nori`)는 npm 에 있습니다.
- 게임은 `src/cart.ts` 에서 `defineCartridge({ manifest, mount })` 로 시작하고, 콘솔이 주는 `api`(screen · input · save · assets · time · system)만 씁니다.
- 만든 `.nori` 는 NoriDeck 홈 화면에 끌어다 놓으면 들어갑니다. 포맷 명세는 [docs/nori-format.md](docs/nori-format.md), 완성 예제는 [NoriPack 의 snakegame](https://github.com/NGHSLab/NoriPack/tree/main/snakegame).

> 콘솔 저장소를 직접 고치면서 카트리지도 만드는 경우에는 npm 패키지 대신 로컬 경로를 씁니다:
> `npm install ../NoriDeck/sdk && npm install -D ../NoriDeck/cli` (SDK 소스를 고친 뒤에는 NoriDeck 에서 `npm run build:sdk`).

## 2. 콘솔 개발

### 시작

```bash
git clone https://github.com/NGHSLab/NoriDeck.git
cd NoriDeck
npm install
npm run dev            # 브라우저에서 콘솔 (홈 화면)
npm run dev:desktop    # Vite + Electron
npm run check          # typecheck + lint + format:check + test — PR 전에 통과해야 합니다
npm run build:desktop  # Windows 설치 파일
```

Windows 에서 저장소가 바탕화면 · 문서 폴더 아래에 있으면 `build:desktop` 이 `EPERM rename` 으로 실패할 수 있습니다. `--config.directories.output=<다른 경로>` 로 출력 위치를 바꾸세요.

### 저장소 구조

| 폴더            | 역할                                                                               |
| --------------- | ---------------------------------------------------------------------------------- |
| `sdk/`          | 콘솔 ↔ 카트리지 계약. 여기 타입이 곧 `.nori` 포맷입니다                            |
| `cli/`          | `nori` 명령 (build · check · unpack)                                               |
| `runtime/`      | 콘솔 화면(Vite). 홈 · 라이브러리 · 세션 · 입력 · 세이브 · 메뉴 · 대화상자 · 다국어 |
| `desktop/`      | Electron 껍데기. 창 · 파일 IPC · 데이터 폴더 · 스플래시 · 패키징                   |
| `carts/sample/` | SDK 검증용 최소 카트리지 (콘솔에 내장되지는 않음)                                  |
| `docs/`         | 카트리지 개발 가이드, 포맷 명세, 단계별 계획과 진행 상태                           |

자세한 구조와 작업 규칙은 [CLAUDE.md](CLAUDE.md) 에 있습니다. 사람과 AI 모두 이 문서를 따릅니다.

### 지켜야 할 규칙

1. **콘솔은 게임을 모른다.** `runtime/` `desktop/` `sdk/` 는 특정 게임의 코드·데이터·에셋을 import 하지 않습니다. 게임에 필요한 기능은 `ConsoleAPI` 에 일반화해 넣습니다.
2. **SDK 표면은 작게.** `sdk/src/index.ts` 를 바꾸면 `SDK_VERSION` 을 올립니다. 삭제·변경은 major.
3. **렌더러는 Node/Electron 을 모른다.** OS 기능은 `bridge.d.ts` 계약 → `preload.ts` → `main.ts` 순서로 추가하고, 브라우저에서도 동작하게 폴백을 둡니다.
4. **sandbox 를 끄지 않는다.** `contextIsolation` · `sandbox` 는 항상 켜 둡니다.
5. **문자열은 `runtime/src/i18n.ts` 에.** 한국어 · 영어를 함께 넣고 `t()` 로 씁니다.
6. **파일은 300줄 안에서.** 넘기 시작하면 쪼갭니다.
7. **`.nori` 포맷을 바꾸면** `docs/nori-format.md` 와 `sdk/src/manifest.ts` 를 함께 고치고, 호환이 깨지면 `NORI_FORMAT` 을 올립니다.

### 코드 스타일

- TypeScript strict, `noUncheckedIndexedAccess`, `import type`. non-null assertion 은 테스트에서만.
- 주석은 한국어, 식별자는 영어. Prettier · ESLint 설정을 따릅니다 (`npm run lint:fix`, `npm run format`).

### 커밋 · PR

- 커밋 메시지는 `<type>: <한국어 제목>`. type 은 `feat` `fix` `docs` `refactor` `chore` `test` `build` `ci` `style`. 괄호 scope 는 붙이지 않습니다. 제목 72자 이내, 마침표 없이. 본문에는 무엇을 · 왜 바꿨는지 항목으로.
  예: `feat: 홈 화면과 .nori 드롭 실행`, `fix: 프레임 없는 창 크기 보정`
- 기능 하나 = 커밋 하나. PR 은 작게, `npm run check` 통과 상태로 올립니다.
- 이름 · 배포 방식 · 서버 API 같은 결정이 필요한 변경은 먼저 이슈로 제안해 주세요.

### 릴리스

- 버전은 semver. 개발 · 테스트 릴리스는 `0.x.y`, 사용자 공개 안정판은 `1.0.0` 부터.
- 루트 · `desktop/` · `runtime/` 의 `package.json` 버전을 함께 올리고, `chore: 버전 x.y.z` 커밋 뒤 태그 `vx.y.z` 를 붙입니다.
- `npm run build:desktop` 결과(`NoriDeck Setup x.y.z.exe`, `NoriDeck x.y.z.exe`)를 GitHub Release 에 첨부합니다. 테스트용 카트리지 `.nori` 를 함께 올리면 받는 사람이 바로 시험해 볼 수 있습니다.
- npm 패키지(`@nghslab/nori-sdk` · `@nghslab/nori-cli` · `create-nori`)는 SDK → CLI → create-nori 순서로 `npm publish -w <패키지>` 합니다. SDK 를 바꿨으면 `SDK_VERSION` 과 sdk 버전을 함께 올리고 CLI 의 의존 범위를 맞춥니다. 콘솔은 카트리지의 SDK major 가 같을 때만 실행하므로, 콘솔 릴리스 노트에 지원 SDK 버전을 적습니다.

## 3. 라이선스

- 이 저장소의 소스 코드는 [MIT License](LICENSE) 입니다. 기여한 코드도 같은 라이선스로 배포되는 데 동의하는 것으로 봅니다.
- 폰트(갈무리, SIL OFL 1.1) · 아이콘(Feather, MIT) 등 외부 자료와 라이브러리의 출처는 [CREDITS.md](CREDITS.md) 에 있습니다. 새 외부 자료를 넣을 때는 파일 경로 · 원작자 · 출처 · 라이선스를 그 문서에 적어 주세요.
- 카트리지의 라이선스는 각 카트리지 제작자가 정합니다. 콘솔의 MIT 라이선스는 카트리지에 적용되지 않습니다.
