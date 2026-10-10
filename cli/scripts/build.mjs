/**
 * CLI 번들: src/nori.ts → dist/nori.js (Node ESM 단일 파일).
 * SDK(TS 소스)를 함께 묶는다. vite·fflate 는 의존성으로 두고 외부화한다.
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(root, 'dist'), { recursive: true });

await build({
  entryPoints: [resolve(root, 'src/nori.ts')],
  outfile: resolve(root, 'dist/nori.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['vite', 'fflate'],
  // docs/ai-cartridge-guide.md 를 문자열로 묶어 nori init 이 AGENTS.md 로 쓴다 (단일 원본)
  loader: { '.md': 'text' },
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'warning',
});
