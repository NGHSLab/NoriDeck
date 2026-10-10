/**
 * nori init: 새 카트리지 프로젝트 뼈대를 만든다 (npm create nori 도 이 함수를 부른다).
 *
 *   my-cart/
 *   ├── nori.json          id · 제목 · 버전 · 화면 · 빌드 경로
 *   ├── package.json       @nghslab/nori-sdk · @nghslab/nori-cli · typescript
 *   ├── tsconfig.json
 *   ├── src/cart.ts        최소 canvas 게임 (입력 · 세이브 · 배속 · pause/resume 예시)
 *   ├── assets/README.txt  에셋 자리
 *   ├── .gitignore
 *   ├── AGENTS.md          AI 코딩 도구용 안내 (docs/ai-cartridge-guide.md 와 같은 내용)
 *   └── README.md
 *
 * 템플릿은 이 파일 안의 문자열(과 번들된 마크다운)이라 CLI 번들 하나에 다 들어간다.
 */
import { CART_ID_PATTERN, SDK_VERSION } from '@nghslab/nori-sdk';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import AGENTS_MD from '../../docs/ai-cartridge-guide.md';

export interface InitOptions {
  /** 만들 폴더 (없으면 만든다). 기본 현재 폴더 */
  dir?: string;
  /** 카트리지 id. 기본은 폴더 이름을 [a-z0-9-] 로 정리한 것 */
  id?: string;
  title?: string;
  /** 비어 있지 않은 폴더에도 쓴다 */
  force?: boolean;
  /** package.json 에 적을 @nghslab/nori-cli 버전 */
  cliVersion: string;
  log?: (message: string) => void;
}

export interface InitResult {
  dir: string;
  id: string;
  files: string[];
}

/** 폴더 이름 → 카트리지 id 후보 (소문자 · 숫자 · 하이픈) */
export function suggestId(name: string): string {
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return id || 'my-cart';
}

function template(id: string, title: string, cliVersion: string): Record<string, string> {
  const noriJson = {
    id,
    title,
    version: '0.1.0',
    // author · description · cover 는 선택 항목. 넣을 때는 빈 문자열이 아니어야 한다
    screen: { width: 480, height: 270, layout: 'single' },
    saveSlots: ['main'],
    build: { entry: 'src/cart.ts', assets: 'assets' },
  };
  const packageJson = {
    name: id,
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: {
      typecheck: 'tsc -p tsconfig.json',
      pack: 'nori build .',
      check: `nori check dist/${id}-0.1.0.nori`,
    },
    dependencies: { '@nghslab/nori-sdk': `^${SDK_VERSION}` },
    devDependencies: { '@nghslab/nori-cli': `^${cliVersion}`, typescript: '~5.9.3' },
  };
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      types: [],
      strict: true,
      noUncheckedIndexedAccess: true,
      verbatimModuleSyntax: true,
      resolveJsonModule: true,
      isolatedModules: true,
      skipLibCheck: true,
      noEmit: true,
    },
    include: ['src'],
  };
  return {
    'nori.json': JSON.stringify(noriJson, null, 2) + '\n',
    'package.json': JSON.stringify(packageJson, null, 2) + '\n',
    'tsconfig.json': JSON.stringify(tsconfig, null, 2) + '\n',
    'src/cart.ts': CART_TS,
    'assets/README.txt': ASSETS_README,
    '.gitignore': 'node_modules/\ndist/\n.vite/\n*.log\n.DS_Store\nThumbs.db\n',
    'AGENTS.md': AGENTS_MD,
    'README.md': readme(id, title),
  };
}

const CART_TS = `/**
 * 카트리지 진입점. 콘솔은 이 파일의 \`cartridge\` 를 import 해서 mount(api) 를 부른다.
 * 게임은 api 만 쓴다 — 파일 경로 · Electron · 창은 모른다.
 *
 *   api.screen   그릴 컨테이너와 논리 해상도 (nori.json 의 screen)
 *   api.input    DS 버튼: UP DOWN LEFT RIGHT A B X Y L R SELECT START (물리 키는 콘솔 설정)
 *   api.save     카트리지별 세이브 슬롯 (문자열)
 *   api.assets   url('파일') → 에셋 URL. 파일마다 부른다
 *   api.time     콘솔 배속 speed (게임 시간에 곱한다)
 *   api.system   데스크톱 여부 · 전체화면 · 로그
 */
import { defineCartridge, parseCartInfo, type ConsoleAPI, type GameInstance } from '@nghslab/nori-sdk';
import noriJson from '../nori.json';

const info = parseCartInfo(noriJson);
const WIDTH = info.screen.width;
const HEIGHT = info.screen.height;
const COLORS = ['#3df0d2', '#ff8c42', '#2f7bff', '#f8d030'] as const;

export const cartridge = defineCartridge({
  manifest: info,

  async mount(api: ConsoleAPI): Promise<GameInstance> {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    api.screen.container.append(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D 컨텍스트를 만들 수 없습니다');

    // 세이브: 몇 번 눌렀는지 기억한다
    let presses = 0;
    try {
      const saved = await api.save.read('main');
      if (saved) presses = Number(JSON.parse(saved).presses) || 0;
    } catch {
      // 세이브가 없거나 깨졌으면 0 부터
    }

    const offA = api.input.on('A', 'down', () => {
      presses += 1;
      void api.save.write(JSON.stringify({ presses }), 'main');
    });

    let running = true;
    let elapsed = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (!running) return;
      elapsed += ((now - last) / 1000) * api.time.speed; // 콘솔 배속 반영
      last = now;

      ctx.fillStyle = '#15262f';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      const color = COLORS[presses % COLORS.length] ?? COLORS[0];
      const x = WIDTH / 2 + Math.sin(elapsed * 2) * 120;
      ctx.fillStyle = color;
      ctx.fillRect(x - 12, HEIGHT / 2 - 12, 24, 24);
      ctx.fillStyle = '#f1ede9';
      ctx.font = '11px Galmuri11, monospace';
      ctx.fillText(api.manifest.title, 10, 20);
      ctx.fillStyle = '#8a827b';
      ctx.font = '9px Galmuri9, monospace';
      ctx.fillText(\`A 를 누르면 색이 바뀝니다 · 누른 횟수 \${presses} (세이브됨)\`, 10, HEIGHT - 12);

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    return {
      // 홈으로 나갈 때 콘솔이 부른다. 루프를 멈춰 두면 "이어서" 가 자연스럽다
      pause: () => {
        running = false;
      },
      resume: () => {
        if (running) return;
        running = true;
        last = performance.now();
        requestAnimationFrame(tick);
      },
      unmount: () => {
        running = false;
        offA();
        canvas.remove();
      },
    };
  },
});
`;

const ASSETS_README = `이미지 · 소리 파일을 이 폴더에 둔다. 빌드하면 .nori 안의 assets/ 가 된다.
코드에서는 파일마다 api.assets.url('파일명') 으로 URL 을 받는다 (기준 경로 이어 붙이기는 동작하지 않는다).
허용 형식: png jpg webp gif svg json ogg mp3 wav txt csv
`;

function readme(id: string, title: string): string {
  return `# ${title}

NoriDeck 콘솔용 카트리지(\`.nori\`).

\`\`\`bash
npm install
npm run pack     # → dist/${id}-0.1.0.nori
npm run check    # 매니페스트 · 체크섬 · SDK 버전 검사
\`\`\`

\`dist/${id}-0.1.0.nori\` 를 NoriDeck 홈 화면에 끌어다 놓으면 라이브러리에 들어갑니다.

- AI 와 함께 만들기: 이 폴더를 AI 코딩 도구(Claude Code · Cursor 등)에 열면 \`AGENTS.md\` 를 읽고 규칙대로 작업합니다
- 게임 코드: \`src/cart.ts\`
- 카트리지 정보: \`nori.json\` (id 는 공개 후 바꾸지 않습니다)
- 커버: 480×270 PNG 를 만들고 nori.json 에 \`"cover": "cover.png"\` 를 추가
- 에셋: \`assets/\` 에 두고 \`api.assets.url('파일명')\`

개발 가이드: https://github.com/NGHSLab/NoriDeck/blob/main/docs/cartridge-guide.md
`;
}

export function initCart(options: InitOptions): InitResult {
  const dir = resolve(options.dir ?? '.');
  const id = options.id ?? suggestId(basename(dir) === '' ? 'my-cart' : basename(dir));
  if (!CART_ID_PATTERN.test(id)) {
    throw new Error(`카트리지 id 는 [a-z0-9-] 1~63자여야 합니다: ${id}`);
  }
  const title = options.title ?? id;
  const log = options.log ?? (() => undefined);

  if (existsSync(dir) && readdirSync(dir).length > 0 && !options.force) {
    throw new Error(`비어 있지 않은 폴더입니다: ${dir}\n덮어쓰려면 --force`);
  }
  mkdirSync(dir, { recursive: true });

  const files = template(id, title, options.cliVersion);
  for (const [name, content] of Object.entries(files)) {
    const target = join(dir, name);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, content, 'utf8');
    log(`  + ${name}`);
  }
  return { dir, id, files: Object.keys(files) };
}
