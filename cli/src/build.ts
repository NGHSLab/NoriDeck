/**
 * nori build: 카트리지 프로젝트 → .nori
 *
 *   1) nori.json 읽기·검증
 *   2) Vite 라이브러리 빌드 → dist/nori/cart.js (엔진 포함 단일 ESM)
 *   3) 에셋·커버 복사, manifest.json·checksums.json 생성
 *   4) zip → dist/<id>-<version>.nori
 */
import {
  NORI_ENTRY,
  NORI_FORMAT,
  parseNoriProject,
  SDK_VERSION,
  type PackedManifest,
} from '@nghslab/nori-sdk';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';
import { build as viteBuild } from 'vite';
import {
  CHECKSUMS_FILE,
  encodeJson,
  formatBytes,
  makeChecksums,
  MANIFEST_FILE,
  readTree,
  zipFiles,
} from './archive';

export interface BuildOptions {
  /** nori.json 이 있는 폴더 */
  cartDir: string;
  /** .nori 을 놓을 폴더 (기본 <cartDir>/dist) */
  outDir?: string;
  sourcemap?: boolean;
  log?: (message: string) => void;
}

export interface BuildResult {
  file: string;
  stageDir: string;
  manifest: PackedManifest;
  fileCount: number;
  bytes: number;
}

const DEFAULT_ENTRY = 'src/cart.ts';
const DEFAULT_ASSETS = 'public/assets';

/** 카트리지가 실제로 설치한 @nghslab/nori-sdk 의 버전. 없으면 CLI 에 묶인 SDK 버전 */
function resolveSdkVersion(cartDir: string, log: (message: string) => void): string {
  try {
    const require = createRequire(join(cartDir, 'package.json'));
    const pkg = require('@nghslab/nori-sdk/package.json') as { version?: string };
    if (typeof pkg.version === 'string') return pkg.version;
  } catch {
    // 아래 폴백
  }
  log(
    `경고: 카트리지 폴더에서 @nghslab/nori-sdk 를 찾지 못해 CLI 의 SDK 버전(${SDK_VERSION})을 기록합니다`,
  );
  return SDK_VERSION;
}

export async function buildCart(options: BuildOptions): Promise<BuildResult> {
  const log = options.log ?? (() => undefined);
  const cartDir = resolve(options.cartDir);
  const projectFile = join(cartDir, 'nori.json');
  if (!existsSync(projectFile)) {
    throw new Error(
      `nori.json 이 없습니다: ${cartDir}\n카트리지 프로젝트 루트에서 실행하거나 폴더를 지정하세요.`,
    );
  }
  const project = parseNoriProject(JSON.parse(readFileSync(projectFile, 'utf8')), projectFile);
  const entry = resolve(cartDir, project.build?.entry ?? DEFAULT_ENTRY);
  if (!existsSync(entry)) throw new Error(`진입 파일이 없습니다: ${entry}`);
  const assetsDir = resolve(cartDir, project.build?.assets ?? DEFAULT_ASSETS);
  const stageDir = join(cartDir, 'dist', 'nori');
  const outDir = options.outDir ? resolve(options.outDir) : join(cartDir, 'dist');

  // 1) 번들
  log(`빌드 중… ${project.id} v${project.version} (${basename(entry)})`);
  rmSync(stageDir, { recursive: true, force: true });
  await viteBuild({
    root: cartDir,
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    // 카트리지와 SDK 가 서로 다른 node_modules 의 phaser 를 보지 않게 하나로 묶는다
    resolve: { dedupe: ['phaser', '@nghslab/nori-sdk'] },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      outDir: stageDir,
      emptyOutDir: true,
      target: 'es2022',
      minify: 'esbuild',
      sourcemap: options.sourcemap ?? false,
      cssCodeSplit: false,
      chunkSizeWarningLimit: 4000,
      lib: { entry, formats: ['es'], fileName: () => NORI_ENTRY },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  if (!existsSync(join(stageDir, NORI_ENTRY)))
    throw new Error(`번들 결과 ${NORI_ENTRY} 가 만들어지지 않았습니다`);

  // 2) 에셋·커버
  if (existsSync(assetsDir) && statSync(assetsDir).isDirectory()) {
    cpSync(assetsDir, join(stageDir, 'assets'), { recursive: true });
  } else {
    log(`경고: 에셋 폴더가 없어 assets/ 없이 묶습니다 (${assetsDir})`);
  }
  let cover: string | undefined;
  if (project.cover) {
    const coverSource = isAbsolute(project.cover) ? project.cover : resolve(cartDir, project.cover);
    if (!existsSync(coverSource)) throw new Error(`커버 이미지가 없습니다: ${coverSource}`);
    cover = `cover${extname(coverSource).toLowerCase()}`;
    cpSync(coverSource, join(stageDir, cover));
  }

  // 3) manifest.json / checksums.json
  const { build: _build, ...info } = project;
  void _build;
  const manifest: PackedManifest = {
    ...info,
    ...(cover ? { cover } : {}),
    sdkVersion: resolveSdkVersion(cartDir, log),
    format: NORI_FORMAT,
    entry: NORI_ENTRY,
    builtAt: new Date().toISOString(),
  };
  if (!cover) delete manifest.cover;
  writeFileSync(join(stageDir, MANIFEST_FILE), encodeJson(manifest));
  const files = readTree(stageDir);
  const checksums = encodeJson(makeChecksums(files));
  writeFileSync(join(stageDir, CHECKSUMS_FILE), checksums);
  files.set(CHECKSUMS_FILE, checksums);

  // 4) zip
  const archive = zipFiles(files);
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${manifest.id}-${manifest.version}.nori`);
  writeFileSync(file, archive);
  log(`완료: ${file} (${files.size} 파일, ${formatBytes(archive.byteLength)})`);
  return { file, stageDir, manifest, fileCount: files.size, bytes: archive.byteLength };
}
