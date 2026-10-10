#!/usr/bin/env node
/**
 * 데스크톱 개발 실행기.
 *   1) 메인/preload 를 tsc 로 컴파일
 *   2) 클라이언트 Vite 개발 서버를 띄우고 응답할 때까지 대기
 *   3) VITE_DEV_SERVER_URL 을 넘겨 Electron 실행
 *   4) Electron 이 닫히면 Vite 도 종료
 *
 * 저장소 루트에서: npm run dev:desktop
 */
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';

const DESKTOP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(DESKTOP_DIR, '..');
const PORT = 5173;
const DEV_URL = `http://localhost:${PORT}`;
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';

function log(message) {
  console.log(`[desktop-dev] ${message}`);
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // 아직 안 떴음
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`${url} 이 ${timeoutMs}ms 안에 응답하지 않았습니다`);
}

log('메인 프로세스 컴파일');
const compile = spawnSync(npm, ['run', 'compile'], {
  cwd: DESKTOP_DIR,
  stdio: 'inherit',
  shell: isWindows,
});
if (compile.status !== 0) process.exit(compile.status ?? 1);

log(`Vite 개발 서버 시작 (${DEV_URL})`);
const vite = spawn(
  npm,
  ['run', 'dev', '-w', 'client', '--', '--port', String(PORT), '--strictPort'],
  {
    cwd: ROOT,
    stdio: 'inherit',
    shell: isWindows,
  },
);

let electron = null;
const shutdown = (code = 0) => {
  killTree(electron);
  killTree(vite);
  process.exit(code);
};
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
vite.on('exit', (code) => {
  if (electron && electron.exitCode === null) {
    log(`Vite 가 먼저 종료됨 (code ${code})`);
    shutdown(code ?? 1);
  }
});

try {
  await waitForServer(DEV_URL);
} catch (error) {
  console.error(error.message);
  shutdown(1);
}

log('Electron 실행');
// VS Code 확장 호스트 등에서 상속되는 ELECTRON_RUN_AS_NODE 가 있으면 Electron 이 GUI 대신 Node 로 실행된다
const electronEnv = { ...process.env, VITE_DEV_SERVER_URL: DEV_URL };
delete electronEnv.ELECTRON_RUN_AS_NODE;
electron = spawn(electronPath, ['.'], {
  cwd: DESKTOP_DIR,
  stdio: 'inherit',
  env: electronEnv,
});
electron.on('exit', (code) => {
  log(`Electron 종료 (code ${code})`);
  shutdown(code ?? 0);
});
