/**
 * 스플래시 창: 본 창(렌더러)이 첫 화면을 그릴 준비가 될 때까지 로고 · 이름 · 버전을 보이는 작은 카드.
 *
 * splash/splash.html 은 렌더러 빌드와 무관한 정적 파일이라 Electron 이 뜨는 즉시 보인다.
 * 버전은 {{version}} 자리를 치환해 data: URL 로 넣으므로 스크립트가 필요 없다 (CSP script-src 없음).
 * 너무 빨리 사라져 깜빡임처럼 보이지 않도록 최소 표시 시간을 둔다.
 */
import { BrowserWindow } from 'electron';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SIZE = { width: 460, height: 230 };
/** 최소 표시 시간 (ms). 렌더러가 이보다 빨리 준비돼도 이만큼은 보인다 */
const MIN_VISIBLE_MS = 900;

export interface Splash {
  /** 최소 표시 시간을 채운 뒤 닫는다. 여러 번 불러도 안전하다 */
  close(): Promise<void>;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function splashHtml(version: string): string {
  const file = path.join(__dirname, '..', 'splash', 'splash.html');
  return readFileSync(file, 'utf8').replaceAll('{{version}}', escapeHtml(version));
}

export function openSplash(version: string): Splash {
  const win = new BrowserWindow({
    ...SIZE,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    center: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: false,
    },
  });

  let shownAt: number | undefined;
  win.once('ready-to-show', () => {
    shownAt = Date.now();
    win.show();
  });
  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml(version))}`);

  let closing: Promise<void> | undefined;
  return {
    close: () => {
      closing ??= (async () => {
        const remaining = shownAt === undefined ? 0 : MIN_VISIBLE_MS - (Date.now() - shownAt);
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
        if (!win.isDestroyed()) win.destroy();
      })();
      return closing;
    },
  };
}
