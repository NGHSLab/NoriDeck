/**
 * 콘솔 부트 (라이브러리 진입점).
 *
 * runtime 자체(main.ts)도, 게임팩의 개발 하네스도 이 함수를 부른다:
 *   1) 데스크톱이면 타이틀바(메뉴 포함)를 붙인다
 *   2) 콘솔 DOM(#console/#screen/#hud/#boot/#home) 을 준비하고 기본 폰트를 기다린다
 *   3) autoRun 이면 첫 카트리지를 바로 실행하고, 아니면 홈 화면을 보인다
 *      (데스크톱: 라이브러리 캐러셀, 드롭·추가는 라이브러리 가져오기 / 브라우저: 드롭 즉시 실행)
 *
 * 실행·홈(일시정지)·이어서·종료는 session.ts, 라이브러리 동작은 libraryActions.ts 가 맡는다.
 */
import type { CartManifest } from '@nghslab/nori-sdk';
import logoUrl from './assets/logo.svg';
import './console.css';
import { CONSOLE_NAME, FONT_PRELOAD } from './config';
import { installMasterVolume, setMasterVolume } from './console/audio';
import { currentConsoleKeys } from './console/keymap';
import { currentSettings, onSettingsChange } from './console/settings';
import { createHome, type HomeHandle } from './home';
import { t } from './i18n';
import { createLibraryActions, type LibraryActions } from './libraryActions';
import { showLibraryInfoDialog } from './platform/dialogs';
import type { TitleBarContext } from './platform/menus';
import { installTitleBar } from './platform/titlebar';
import { createSession, type CartEntry, type ConsoleSession } from './session';

export type { CartEntry, ConsoleSession, RunningCart, SuspendedCart } from './session';

export interface BootOptions {
  /** 실행 후보 카트리지. autoRun 이면 첫 항목을 바로 실행한다. 비어 있으면 홈 화면부터 */
  carts: readonly CartEntry[];
  /** 기본 true. false 면 홈 화면부터 시작한다 */
  autoRun?: boolean;
  /** 콘솔 DOM 을 넣을 부모. 기본 document.body */
  root?: HTMLElement;
}

type ConsoleDom = Record<'console' | 'screen' | 'hud' | 'boot', HTMLElement>;

/** #console > #screen, #hud, #boot 구조를 만든다 (이미 있으면 재사용) */
function ensureDom(root: HTMLElement): ConsoleDom {
  let consoleElement = document.getElementById('console');
  if (!consoleElement) {
    consoleElement = document.createElement('div');
    consoleElement.id = 'console';
    consoleElement.innerHTML =
      '<div id="screen"></div><div id="hud" hidden></div><div id="boot"></div>';
    root.append(consoleElement);
  }
  const pick = (id: string): HTMLElement => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`#${id} 가 없습니다`);
    return element;
  };
  return { console: consoleElement, screen: pick('screen'), hud: pick('hud'), boot: pick('boot') };
}

async function waitForFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  try {
    await Promise.all(FONT_PRELOAD.map((font) => document.fonts.load(font)));
  } catch {
    // 폰트가 없어도 콘솔은 뜬다 (시스템 monospace 로 대체)
  }
}

/** 부트 화면: 로고 + 메시지 */
function showBoot(boot: HTMLElement, message: string): void {
  boot.hidden = false;
  boot.replaceChildren();
  const logo = document.createElement('img');
  logo.src = logoUrl;
  logo.alt = CONSOLE_NAME;
  const text = document.createElement('div');
  text.textContent = message;
  const wrap = document.createElement('div');
  wrap.append(logo, text);
  boot.append(wrap);
}

export async function bootConsole(options: BootOptions): Promise<ConsoleSession> {
  const autoRun = options.autoRun ?? true;
  document.title = CONSOLE_NAME;
  // 마스터 볼륨은 카트리지가 소리를 만들기 전에 걸어 둔다
  installMasterVolume(currentSettings().volume);
  onSettingsChange((settings) => setMasterVolume(settings.volume));
  const dom = ensureDom(options.root ?? document.body);
  const bridge = window.norideck;
  const library = bridge?.library;

  // 홈 · 세션 · 라이브러리 동작은 서로를 콜백으로 부르므로, 늦게 채워지는 참조는 함수 안에서 읽는다
  let actions: LibraryActions | undefined;

  const home: HomeHandle = createHome(dom.console, {
    onFile: (file) =>
      void (actions ? actions.importFile(file) : session.openFile(file)).catch(() => undefined),
    library: library
      ? {
          onRun: (entry) => void actions?.runEntry(entry),
          onInfo: (entry) => showLibraryInfoDialog(entry),
          onOpenFolder: (entry) => actions?.openFolder(entry),
          onExport: (entry) => void actions?.exportCart(entry),
          onBackupSaves: (entry) => void actions?.backupSaves(entry),
          onRestoreSaves: (entry) => void actions?.restoreSaves(entry),
          onClearSaves: (entry) => void actions?.clearSaves(entry),
          onClose: (entry) => void actions?.closeGame(entry),
          onRemove: (entry) => void actions?.remove(entry),
        }
      : undefined,
  });
  home.hide();

  const session = createSession(dom, {
    onHome: (suspended) => {
      home.status('');
      home.setSuspended(suspended);
      home.show();
      void actions?.refresh();
    },
    onBeforeShowGame: () => home.hide(),
    showBoot: (message) => showBoot(dom.boot, message),
    onStatus: (message) => home.status(message),
    onError: (message) => home.status(message, 'error'),
  });
  if (bridge) actions = createLibraryActions(bridge, session, home);

  /** 홈 키: 게임 중 → 홈, 홈에서 뒤에 게임이 있으면 → 이어서 */
  const toggleHome = () => {
    if (session.current && !session.suspended) session.goHome();
    else session.resume();
  };
  // 홈 키 (기본 P, 키 배치에서 변경). 대화상자·메뉴가 열려 있으면 그쪽이 먼저 먹는다
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.code !== currentConsoleKeys().home) return;
    if (document.querySelector('dialog[open], .menu-dropdown')) return;
    event.preventDefault();
    toggleHome();
  });

  // 타이틀바 메뉴는 카트리지 로드 전에 생기므로 현재 상태를 함수로 읽는다
  const context: TitleBarContext = {
    getConsole: () => session.current?.console,
    getManifest: (): CartManifest | undefined => session.current?.cartridge.manifest,
    isRunning: () => session.current !== undefined && !session.suspended,
    openFile: () => home.pickFile(),
    goHome: () => session.goHome(),
  };
  installTitleBar(CONSOLE_NAME, context);

  showBoot(dom.boot, t('boot.booting', { name: CONSOLE_NAME }));
  await waitForFonts();

  const first = options.carts[0];
  if (autoRun && first) {
    await session.run(first);
  } else {
    session.goHome();
  }
  return session;
}

export { CONSOLE_ID, CONSOLE_NAME } from './config';
export { cartFromUrl } from './loader';
export { inspectNoriBytes, openNoriFile, toCartEntry } from './nori/openNori';
