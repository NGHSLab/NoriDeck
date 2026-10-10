/**
 * nori — NoriDeck 카트리지 CLI
 *
 *   nori init [폴더] [--id <id>] [--title <제목>]   새 카트리지 프로젝트 뼈대
 *   nori build [폴더] [--out <폴더>] [--sourcemap]   nori.json 이 있는 카트리지 프로젝트를 .nori 로 묶는다
 *   nori check <파일.nori>                          매니페스트·체크섬·SDK 버전 검사
 *   nori unpack <파일.nori> [폴더] [--force]         폴더로 푼다 (디버깅·콘솔 개발 서버에서 실행용)
 */
import { SDK_VERSION } from '@nghslab/nori-sdk';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { formatBytes } from './archive';
import { buildCart } from './build';
import { checkNoriFile, unpackNori, type InspectResult } from './check';
import { initCart } from './init';

function version(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    return pkg.version;
  } catch {
    return 'dev';
  }
}

const USAGE = `nori ${version()} — NoriDeck 카트리지 CLI (SDK ${SDK_VERSION})

사용법
  nori init [폴더] [--id <id>] [--title <제목>] [--force]
                                                  새 카트리지 프로젝트 뼈대 (nori.json · src/cart.ts · …)
  nori build [폴더] [--out <폴더>] [--sourcemap]   카트리지 프로젝트(nori.json) → dist/<id>-<version>.nori
  nori check <파일.nori>                          매니페스트 · 체크섬 · SDK 버전 검사
  nori unpack <파일.nori> [폴더] [--force]         .nori 을 폴더로 푼다
  nori --version | --help

만드는 순서
  1. nori init my-cart && cd my-cart && npm install
  2. src/cart.ts 에 게임을 쓴다 (콘솔이 주는 api 만 사용)
  3. npm run pack  →  dist/my-cart-0.1.0.nori
  4. 파일을 NoriDeck 홈 화면에 끌어다 놓는다

nori.json 규칙
  id            [a-z0-9-] 1~63자. 세이브 폴더·파일 이름에 쓰이므로 공개 후 바꾸지 않는다
  version       semver (0.1.0). 파일 이름 <id>-<version>.nori 이 된다
  screen        { width, height, layout: "single" | "ds-dual" }. 기본 480×270 (16:9)
  saveSlots     세이브 슬롯 이름 배열 (기본 ["main"])
  cover         커버 이미지 경로 (선택, 480×270 PNG 권장)
  build.entry   진입 소스 (기본 src/cart.ts). \`cartridge\` 를 export 해야 한다
  build.assets  에셋 폴더 (기본 public/assets). 코드에서는 api.assets.url('파일') 로 파일마다

.nori 안에는 manifest.json · cart.js(번들) · assets/ · cover.* · checksums.json(SHA-256) 이 들어간다.
콘솔은 체크섬이 하나라도 다르거나 SDK major 가 다르면 실행하지 않는다.

문서  https://github.com/NGHSLab/NoriDeck/blob/main/docs/cartridge-guide.md
`;

function printReport(file: string, result: InspectResult): void {
  const { manifest } = result;
  console.log(
    `${result.ok ? '✓' : '✗'} ${file} (${result.files.size} 파일, ${formatBytes(result.bytes)})`,
  );
  if (manifest) {
    const screen = `${manifest.screen.width}×${manifest.screen.height} ${manifest.screen.layout}`;
    console.log(
      `  ${manifest.title} — ${manifest.id} v${manifest.version} · SDK ${manifest.sdkVersion} · 화면 ${screen}`,
    );
    console.log(`  포맷 ${manifest.format} · 진입 ${manifest.entry} · 빌드 ${manifest.builtAt}`);
  }
  for (const warning of result.warnings) console.log(`  ! ${warning}`);
  for (const problem of result.problems) console.log(`  ✗ ${problem}`);
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      id: { type: 'string' },
      title: { type: 'string' },
      sourcemap: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
  });
  if (values.version) {
    console.log(`nori ${version()} (SDK ${SDK_VERSION})`);
    return 0;
  }
  const [command, ...rest] = positionals;
  if (values.help || !command) {
    console.log(USAGE);
    return command ? 0 : 1;
  }

  switch (command) {
    case 'init': {
      const result = initCart({
        dir: rest[0],
        id: values.id,
        title: values.title,
        force: values.force,
        cliVersion: version() === 'dev' ? '0.2.0' : version(),
        log: (message) => console.log(message),
      });
      console.log(`✓ ${result.id} 카트리지 프로젝트를 만들었습니다: ${result.dir}`);
      console.log(`
다음
  cd ${rest[0] ?? '.'}
  npm install
  npm run pack        # → dist/${result.id}-0.1.0.nori
  파일을 NoriDeck 홈 화면에 끌어다 놓기`);
      return 0;
    }
    case 'build': {
      const result = await buildCart({
        cartDir: rest[0] ?? '.',
        outDir: values.out,
        sourcemap: values.sourcemap,
        log: (message) => console.log(message),
      });
      printReport(result.file, checkNoriFile(result.file));
      return 0;
    }
    case 'check': {
      if (!rest[0]) throw new Error('검사할 .nori 파일을 지정하세요');
      const result = checkNoriFile(rest[0]);
      printReport(rest[0], result);
      return result.ok ? 0 : 1;
    }
    case 'unpack': {
      if (!rest[0]) throw new Error('풀 .nori 파일을 지정하세요');
      const { outDir, result } = unpackNori({
        file: rest[0],
        outDir: rest[1],
        force: values.force,
      });
      printReport(rest[0], result);
      console.log(`  → ${outDir}`);
      return 0;
    }
    default:
      console.error(`알 수 없는 명령: ${command}\n`);
      console.log(USAGE);
      return 1;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
