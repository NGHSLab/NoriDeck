#!/usr/bin/env node
/**
 * npm create nori <폴더>  →  nori init <폴더> …
 * 뼈대 생성 로직은 @nghslab/nori-cli 에 있고, 이 패키지는 `npm create` 이름을 붙여 주는 얇은 껍데기다.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nori = require.resolve('@nghslab/nori-cli/dist/nori.js');
const result = spawnSync(process.execPath, [nori, 'init', ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
