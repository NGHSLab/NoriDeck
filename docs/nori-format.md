# `.nori` 카트리지 포맷 v1

> NoriDeck 콘솔이 실행하는 게임 패키지 형식. 2026-09-05 확정 (계획 1단계).
> 검증 규칙의 원본은 `sdk/src/manifest.ts` 다. 이 문서와 코드가 다르면 코드를 고치거나 이 문서를 고친다.

## 1. 한눈에

- `.nori` 파일은 **확장자만 다른 zip** 이다. 어떤 zip 도구로도 열어 볼 수 있다.
- 안에는 TypeScript 로 만든 게임을 Vite 로 번들한 **단일 ESM 파일**(`cart.js`, 엔진 포함)과 에셋, 매니페스트, 체크섬이 들어 있다.
- 콘솔은 `manifest.json` 을 읽고 `cart.js` 를 `import()` 해서 `cartridge.mount(api)` 를 부른다. 콘솔은 게임 엔진을 모른다.
- 만드는 법: 프로젝트 루트에 `nori.json` 을 두고 `nori build`.

```
<id>-<version>.nori  (zip)
├── manifest.json     카트리지 정보 + 포맷·진입·빌드 시각
├── cart.js           ESM 번들. `export const cartridge = defineCartridge({...})`
├── assets/           카트리지 에셋. ConsoleAPI.assets.url('sprites/a.png') → assets/sprites/a.png
├── cover.png         (선택) 라이브러리 표시용 커버
└── checksums.json    모든 파일의 sha256
```

zip 안 경로 규칙: 구분자는 `/`, `..`·절대 경로·역슬래시·드라이브 문자 금지. 위반하면 콘솔과 `nori check` 가 거부한다.

## 2. `nori.json` (카트리지 프로젝트)

카트리지 프로젝트 루트에 둔다. **게임 코드와 빌드 도구가 같은 파일을 읽는다**: 게임은 `parseCartInfo(noriJson)` 으로 매니페스트를 만들고, `nori build` 는 이 파일로 `manifest.json` 을 만든다. 제목·화면 크기·버전을 두 곳에 적지 않는다.

```json
{
  "id": "pokemon-cipher",
  "title": "Pokémon Cipher",
  "version": "0.0.1",
  "author": "Pokémon Cipher Team",
  "description": "한 줄 소개",
  "homepage": "https://example.com",
  "cover": "cover.png",
  "screen": { "width": 256, "height": 384, "layout": "ds-dual", "gap": 0 },
  "saveSlots": ["main"],
  "build": { "entry": "src/cart.ts", "assets": "public/assets" }
}
```

| 필드                                | 필수 | 규칙                                                                                  |
| ----------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| `id`                                | ✓    | `[a-z0-9][a-z0-9-]{0,62}`. 세이브 폴더·URL·파일명에 쓰인다. **공개 후 바꾸지 않는다** |
| `title`                             | ✓    | 표시 제목                                                                             |
| `version`                           | ✓    | semver (`1.2.3`, `1.2.3-beta.1`)                                                      |
| `screen`                            | ✓    | `{ width, height, layout: 'single' \| 'ds-dual', gap? }`. 콘솔이 이 비율을 유지한다   |
| `saveSlots`                         |      | 슬롯 이름 배열. 기본 `['main']`. `[a-zA-Z0-9_-]{1,32}`                                |
| `author`, `description`, `homepage` |      | 라이브러리·웹페이지 표시용 문자열                                                     |
| `cover`                             |      | 커버 이미지 경로(프로젝트 기준). 패키지 안에서는 `cover.<확장자>` 로 들어간다         |
| `build.entry`                       |      | 진입 소스. 기본 `src/cart.ts`. `cartridge` 를 export 해야 한다                        |
| `build.assets`                      |      | 에셋 폴더. 기본 `public/assets`. 패키지의 `assets/` 가 된다                           |

모르는 필드는 검증 시 버려진다(오류는 아니다). `build` 는 `manifest.json` 에 들어가지 않는다.

## 3. `manifest.json` (패키지 안)

`nori.json` 의 정보 + 빌드가 채우는 필드.

| 필드         | 설명                                                                            |
| ------------ | ------------------------------------------------------------------------------- |
| `format`     | 포맷 버전. 지금은 `1`. 콘솔은 모르는 값이면 거부한다                            |
| `entry`      | 진입 번들 파일명. 항상 `cart.js` (루트 파일명만 허용)                           |
| `sdkVersion` | 카트리지가 빌드된 `@nghslab/nori-sdk` 버전. **major 가 콘솔과 같아야** 실행된다 |
| `builtAt`    | ISO 8601 빌드 시각                                                              |
| `cover`      | 패키지 안 커버 파일명 (있을 때만)                                               |

`sdkVersion` 은 카트리지 프로젝트에 설치된 `@nghslab/nori-sdk` 의 `package.json` 에서 읽는다. 서버 DB 의 `cart_versions` 는 이 파일의 필드와 1:1 로 맞추는 것을 권장한다.

## 4. `cart.js` 계약

- ES 모듈 하나. 동적 import 도 모두 인라인된다(파일 하나).
- `export const cartridge` (또는 `export default`) 가 `Cartridge` 여야 한다: `{ manifest, mount(api) }`.
- `manifest.id` 는 `manifest.json` 의 `id` 와 같아야 한다 (로더가 대조한다).
- 브라우저 API 와 `ConsoleAPI` 만 쓴다. `window.norideck` 브리지·Node·Electron 은 쓸 수 없다.
- 에셋은 반드시 **파일마다** `api.assets.url('sprites/a.png')` 로 얻는다. `assets.url('')` 을 기준 경로로 잡고 뒤에 이어 붙이면 안 된다: 메모리에서 연 `.nori`(홈 화면 드롭·웹 플레이)는 파일마다 다른 blob URL 이라 이어 붙인 경로는 깨진다. 절대 경로·`/carts/...` 도 쓰지 않는다.
- CSS 가 필요하면 JS 에서 `<style>` 을 주입한다. 별도 css 파일은 로더가 읽지 않는다.

## 5. `checksums.json`

```json
{
  "algorithm": "sha256",
  "files": { "assets/maps/route_01.json": "<hex>", "cart.js": "<hex>", "manifest.json": "<hex>" }
}
```

자기 자신을 제외한 모든 파일이 들어가야 하고(누락·초과 모두 오류), 경로순 정렬이다. 서명은 아직 없다(외부 배포 시 `signature` 필드로 추가 예정. 보류 항목 참고).

## 6. CLI

패키지 `@nghslab/nori-cli`, 명령 `nori`. 카트리지 저장소는 `devDependencies` 에 넣고 `"pack": "nori build <폴더>"` 스크립트로 연결한다.

```bash
nori build [폴더] [--out <폴더>] [--sourcemap]   # nori.json → dist/<id>-<version>.nori (+ dist/nori/ 에 풀린 상태)
nori check <파일.nori>                          # 구조·매니페스트·체크섬·SDK 버전 검사. 실패 시 종료 코드 1
nori unpack <파일.nori> [폴더] [--force]         # 검사 후 폴더로 푼다 (비어 있지 않으면 --force 필요)
```

`build` 는 Vite 라이브러리 모드로 `build.entry` 를 번들한다: ES2022, 단일 파일, `phaser`·`@nghslab/nori-sdk` 는 dedupe, `process.env.NODE_ENV` 는 `"production"`. 카트리지 프로젝트의 `vite.config` 는 읽지 않는다.

## 7. 만든 .nori 를 실행해 보기 (개발자)

콘솔 개발 서버는 풀어 놓은 패키지 폴더를 `?cart=<URL>` 로 바로 실행한다.

```bash
# NoriDeck 저장소에서
nori unpack path/to/my-game-1.0.0.nori runtime/public/dev/my-game --force
npm run dev            # http://localhost:5173/?cart=/dev/my-game/
```

`runtime/public/dev/` 는 git 에 올라가지 않는다. 다른 서버에 올린 폴더도 `?cart=https://.../my-game/` 로 실행할 수 있다(CORS 허용 필요). 데스크톱 콘솔에서는 `.nori` 를 홈 화면에 끌어다 놓거나 File → Add cartridge 로 라이브러리(`games/<id>/`)에 넣어 실행한다. 제작자용 전체 안내는 [cartridge-guide.md](cartridge-guide.md).

## 8. 호환성 규칙

- `format` 이 바뀌면 옛 콘솔은 새 패키지를 거부한다. 필드 추가만 하는 변경은 `format` 을 올리지 않는다.
- SDK 는 semver: 카트리지에 보이는 타입·동작이 깨지면 major, 추가는 minor.
- 콘솔은 `format` 과 `sdkVersion` major 둘 다 맞아야 실행한다.
