/**
 * Electron 메인 프로세스 = 콘솔 본체.
 *
 * 역할은 "껍데기"에 한정한다: 창 생성, 렌더러(runtime) 로드, 카트리지별 세이브 파일 IPC, 창 제어 IPC, 라이브러리 보관(library.ts).
 * 게임·카트리지 로직은 전혀 없다. 플랫폼별 분기는 이 패키지 안에서만 한다.
 *
 * 창은 프레임 없이(frame: false) 만들고, 타이틀바(메뉴 · _ ▢ ✕)는 runtime 이 그린다.
 * 첫 창은 렌더러가 준비될 때까지 스플래시(splash.ts)를 먼저 보이고, 준비되면 바꿔 끼운다.
 *
 * 개발: VITE_DEV_SERVER_URL 이 있으면 Vite 개발 서버를 로드한다 (scripts/dev.mjs 가 설정).
 * 배포: 패키징된 앱은 renderer/index.html, 미패키징(npm start)은 ../runtime/dist/index.html 을 로드한다.
 */
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  screen,
  shell,
  type IpcMainInvokeEvent,
} from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DesktopWindowState } from '../../runtime/src/platform/bridge';
import { configureDataRoot, gamesRoot, migrateLegacyLayout } from './dataRoot';
import { registerLibraryIpc } from './library';
import { openSplash, type Splash } from './splash';

/** 내부 ID. runtime/src/config.ts 의 CONSOLE_ID 와 같다. 세이브 폴더 이름이라 바꾸지 않는다 */
const CONSOLE_ID = 'norideck';
/** runtime 커스텀 타이틀바 높이 (runtime/src/config.ts 의 TITLEBAR_HEIGHT 와 맞춘다) */
const TITLEBAR_HEIGHT = 28;
/**
 * 콘솔 기준 화면 (runtime/src/config.ts 의 DEFAULT_SCREEN 과 같다). 16:9 라 전체화면에서 좌우 여백이 없다.
 * 실제 해상도는 카트리지가 정하고 runtime 이 비율을 맞추므로, 여기서는 첫 창 크기만 정한다.
 */
const BASE_SCREEN = { width: 480, height: 270 };
/** 창 배율 ×1 의 실제 확대 (runtime/src/config.ts 의 WINDOW_BASE_SCALE 과 같다). 기본 창은 ×1 = 960×540 */
const BASE_ZOOM_SCALE = 2;
/** 가장 작은 창 = 배율 ×0.5 (콘솔 기준 해상도 그대로) */
const MIN_GAME_AREA = BASE_SCREEN;
/** 창 배경 (첫 페인트 전). 홈 화면과 같은 레트로 화이트 (runtime/src/console.css 의 --nd-white) */
const BACKGROUND = '#fdfcfa';

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const isDev = !app.isPackaged;

// 데이터 루트("SD 카드"): 실행 파일 옆 norirepo/ 가 있으면 포터블, 아니면 %APPDATA%/norideck (dataRoot.ts)
const dataRoot = configureDataRoot(CONSOLE_ID);

// 한 번에 하나만 실행한다. 이미 떠 있으면 새 인스턴스는 바로 종료하고, 기존 창을 앞으로 가져온다
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
}

// ---- 세이브 파일 IPC (카트리지 · 슬롯 단위) ----------------------------------

const SAFE_ID = /^[a-z0-9][a-z0-9-_]{0,63}$/i;

function savePath(cartId: unknown, slot: unknown): string {
  if (typeof cartId !== 'string' || !SAFE_ID.test(cartId))
    throw new TypeError(`잘못된 카트리지 ID: ${String(cartId)}`);
  if (typeof slot !== 'string' || !SAFE_ID.test(slot))
    throw new TypeError(`잘못된 슬롯 이름: ${String(slot)}`);
  return path.join(gamesRoot(), cartId, 'saves', `${slot}.json`);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function registerSaveIpc(): void {
  ipcMain.handle('save:read', async (_event, cartId, slot): Promise<string | null> => {
    try {
      return await fs.readFile(savePath(cartId, slot), 'utf8');
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return null;
      throw error;
    }
  });

  ipcMain.handle('save:write', async (_event, cartId, slot, raw: unknown): Promise<void> => {
    if (typeof raw !== 'string') throw new TypeError('save:write 는 문자열만 받습니다');
    const target = savePath(cartId, slot);
    const temp = `${target}.tmp`;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(temp, raw, 'utf8');
    await fs.rename(temp, target); // 쓰다 죽어도 기존 세이브가 깨지지 않도록 원자적 교체
  });

  ipcMain.handle('save:remove', async (_event, cartId, slot): Promise<void> => {
    try {
      await fs.unlink(savePath(cartId, slot));
    } catch (error) {
      if (!(isNodeError(error) && error.code === 'ENOENT')) throw error;
    }
  });

  ipcMain.handle('save:list', async (_event, cartId): Promise<string[]> => {
    const dir = path.dirname(savePath(cartId, 'probe'));
    try {
      const entries = await fs.readdir(dir);
      return entries.filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5));
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return [];
      throw error;
    }
  });

  ipcMain.handle('save:clear', async (_event, cartId): Promise<void> => {
    const dir = path.dirname(savePath(cartId, 'probe'));
    await fs.rm(dir, { recursive: true, force: true });
  });

  ipcMain.handle('app:version', (): string => app.getVersion());
  ipcMain.handle('app:data-root', () => ({ path: dataRoot.root, portable: dataRoot.portable }));
}

// ---- 창 제어 IPC (커스텀 타이틀바) -------------------------------------------

function windowState(win: BrowserWindow): DesktopWindowState {
  return { maximized: win.isMaximized(), fullscreen: win.isFullScreen() };
}

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

function registerWindowIpc(): void {
  ipcMain.handle('window:minimize', (event) => senderWindow(event)?.minimize());
  ipcMain.handle('window:toggle-maximize', (event) => {
    const win = senderWindow(event);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle('window:close', (event) => senderWindow(event)?.close());
  ipcMain.handle('window:set-fullscreen', (event, on: unknown) => {
    senderWindow(event)?.setFullScreen(Boolean(on));
  });
  ipcMain.handle('window:get-state', (event): DesktopWindowState => {
    const win = senderWindow(event);
    return win ? windowState(win) : { maximized: false, fullscreen: false };
  });
  ipcMain.handle('window:set-content-size', (event, width: unknown, height: unknown) => {
    const win = senderWindow(event);
    if (!win) return;
    if (typeof width !== 'number' || typeof height !== 'number' || width < 1 || height < 1) {
      throw new TypeError('window:set-content-size 는 양수 두 개를 받습니다');
    }
    if (win.isFullScreen()) win.setFullScreen(false);
    if (win.isMaximized()) win.unmaximize();
    const wanted = [Math.round(width), Math.round(height)] as const;
    win.setContentSize(wanted[0], wanted[1], false);
    // 프레임 없는 창은 보이지 않는 테두리만큼 어긋날 수 있어 한 번 보정한다
    const [gotWidth = wanted[0], gotHeight = wanted[1]] = win.getContentSize();
    if (gotWidth !== wanted[0] || gotHeight !== wanted[1]) {
      win.setContentSize(wanted[0] * 2 - gotWidth, wanted[1] * 2 - gotHeight, false);
    }
    win.center();
  });
}

// ---- 시스템 IPC (폴더 열기 · 개발자 도구) -------------------------------------

const FOLDERS = {
  games: gamesRoot,
  userData: () => app.getPath('userData'),
} as const;

function registerSystemIpc(): void {
  ipcMain.handle('system:open-folder', async (_event, folder: unknown): Promise<string> => {
    if (typeof folder !== 'string' || !(folder in FOLDERS)) {
      throw new TypeError(`열 수 없는 폴더: ${String(folder)}`);
    }
    const target = FOLDERS[folder as keyof typeof FOLDERS]();
    await fs.mkdir(target, { recursive: true });
    const error = await shell.openPath(target);
    if (error) throw new Error(error);
    return target;
  });
  ipcMain.handle('system:toggle-devtools', (event) => {
    senderWindow(event)?.webContents.toggleDevTools();
  });
  ipcMain.handle(
    'system:save-file',
    async (
      event,
      options: { defaultName?: unknown; extensions?: unknown; bytes?: unknown },
    ): Promise<string | null> => {
      const name =
        typeof options.defaultName === 'string' ? path.basename(options.defaultName) : 'file';
      const extensions = Array.isArray(options.extensions)
        ? options.extensions.filter((e): e is string => typeof e === 'string')
        : [];
      if (!(options.bytes instanceof Uint8Array))
        throw new TypeError('system:save-file 는 bytes 가 필요합니다');
      const win = senderWindow(event);
      const result = await dialog.showSaveDialog(win ?? new BrowserWindow({ show: false }), {
        defaultPath: path.join(app.getPath('documents'), name),
        filters: extensions.length ? [{ name: extensions.join(', '), extensions }] : [],
      });
      if (result.canceled || !result.filePath) return null;
      await fs.writeFile(result.filePath, options.bytes);
      return result.filePath;
    },
  );
}

// ---- 창 -------------------------------------------------------------------

/**
 * 창 아이콘 경로. 패키징본은 asar 바깥 resources/icon.png (electron-builder 의 extraResources),
 * 개발 중에는 desktop/build/icon.png 를 그대로 쓴다.
 */
function appIcon(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', 'build', 'icon.png');
}

function rendererEntry(): string {
  return app.isPackaged
    ? path.join(__dirname, '..', 'renderer', 'index.html')
    : path.join(__dirname, '..', '..', 'runtime', 'dist', 'index.html');
}

/** 첫 창은 배율 ×1(960×540). 작업 영역에 들어가지 않으면 ×0.5 로 줄인다 */
function initialGameArea(): { width: number; height: number } {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const fits =
    BASE_SCREEN.width * BASE_ZOOM_SCALE <= width - 40 &&
    BASE_SCREEN.height * BASE_ZOOM_SCALE + TITLEBAR_HEIGHT <= height - 40;
  const scale = fits ? BASE_ZOOM_SCALE : 1;
  return { width: BASE_SCREEN.width * scale, height: BASE_SCREEN.height * scale };
}

/** 본 창을 만든다. splash 가 있으면 렌더러가 준비된 뒤 스플래시를 닫고 창을 보인다 */
function createWindow(splash?: Splash): BrowserWindow {
  const gameArea = initialGameArea();
  const win = new BrowserWindow({
    width: gameArea.width,
    height: gameArea.height + TITLEBAR_HEIGHT,
    minWidth: MIN_GAME_AREA.width,
    minHeight: MIN_GAME_AREA.height + TITLEBAR_HEIGHT,
    useContentSize: true,
    frame: false,
    backgroundColor: BACKGROUND,
    autoHideMenuBar: true,
    show: false,
    // 작업 표시줄·창 아이콘. Windows 는 electron-builder 가 exe 에 icon.ico 를 넣지만 Linux 는 창이 직접 들고 있어야 한다
    icon: appIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // 카트리지 타이틀 음악이 첫 입력 없이 바로 나오게 (콘솔은 브라우저의 자동재생 제한을 둘 이유가 없다)
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  const reveal = () => {
    if (splash) void splash.close().then(() => !win.isDestroyed() && win.show());
    else win.show();
  };
  win.once('ready-to-show', reveal);
  // 렌더러 로드에 실패하면 ready-to-show 가 오지 않으므로 스플래시가 남지 않게 창을 그대로 보인다
  win.webContents.once('did-fail-load', reveal);

  // 타이틀바가 최대화/전체화면 상태를 반영할 수 있도록 알린다
  const broadcastState = () => {
    if (!win.isDestroyed()) win.webContents.send('window:state', windowState(win));
  };
  win.on('maximize', broadcastState);
  win.on('unmaximize', broadcastState);
  win.on('enter-full-screen', broadcastState);
  win.on('leave-full-screen', broadcastState);

  // F11 전체화면, 개발 중에는 F12 개발자 도구
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'F12' && isDev) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(rendererEntry());
  }
  return win;
}

void app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await migrateLegacyLayout();
  registerSaveIpc();
  registerWindowIpc();
  registerSystemIpc();
  registerLibraryIpc();
  createWindow(openSplash(app.getVersion()));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
