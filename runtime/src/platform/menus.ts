/**
 * 메뉴바 내용 (데스크톱 전용). 콘솔 설정과 창 제어를 모아 둔다. 카트리지는 여기에 항목을 추가할 수 없다.
 * 카트리지 로드 전에도 메뉴는 떠 있으므로 콘솔 핸들·매니페스트는 클릭 시점에 context 로 읽는다.
 * 문자열은 i18n 의 t() 로 — 메뉴는 열 때마다 items() 를 다시 부르므로 언어가 바뀌면 바로 반영된다.
 */
import type { CartManifest } from '@nghslab/nori-sdk';
import {
  DEFAULT_SCREEN,
  FAST_SPEEDS,
  RESERVED_KEYS,
  TITLEBAR_HEIGHT,
  WINDOW_BASE_SCALE,
  WINDOW_ZOOMS,
} from '../config';
import type { ConsoleHandle } from '../console/createConsole';
import { currentConsoleKeys, keyLabel } from '../console/keymap';
import { currentSettings, updateSettings } from '../console/settings';
import { t } from '../i18n';
import type { DesktopBridge, DesktopWindowState } from './bridge';
import { showAboutDialog, showLanguageDialog, showVolumeDialog } from './dialogs';
import { showKeymapDialog } from './keymapDialog';
import type { MenuDefinition } from './menubar';

export interface TitleBarContext {
  getConsole(): ConsoleHandle | undefined;
  getManifest(): CartManifest | undefined;
  /** 게임 화면이 보이는 중인가 (홈 뒤에 일시정지된 상태는 false) */
  isRunning(): boolean;
  /** .nori 파일 선택창 (카트리지 추가) */
  openFile(): void;
  /** 게임을 일시정지 상태로 뒤에 두고 홈 화면으로 */
  goHome(): void;
}

export function buildMenus(bridge: DesktopBridge, context: TitleBarContext): MenuDefinition[] {
  let state: DesktopWindowState = { maximized: false, fullscreen: false };
  bridge.window.onStateChange((next) => (state = next));
  void bridge.window.getState().then((next) => (state = next));

  const screenSpec = () => context.getManifest()?.screen ?? DEFAULT_SCREEN;
  /** 창 배율 → 게임 영역 픽셀 크기 (×1 = WINDOW_BASE_SCALE 배) */
  const zoomedArea = (zoom: number) => {
    const spec = screenSpec();
    const scale = zoom * WINDOW_BASE_SCALE;
    return { width: Math.round(spec.width * scale), height: Math.round(spec.height * scale) };
  };
  const isZoom = (zoom: number) => {
    const area = zoomedArea(zoom);
    return (
      !state.fullscreen &&
      !state.maximized &&
      // 프레임 없는 창의 보이지 않는 테두리(수 px) 는 허용
      Math.abs(window.innerWidth - area.width) <= 8 &&
      Math.abs(window.innerHeight - TITLEBAR_HEIGHT - area.height) <= 8
    );
  };

  return [
    {
      title: t('menu.file'),
      items: () => [
        {
          label: t('file.home'),
          shortcut: keyLabel(currentConsoleKeys().home),
          disabled: !context.isRunning(),
          onSelect: () => context.goHome(),
        },
        { label: t('file.add'), shortcut: '.nori', onSelect: () => context.openFile() },
        { separator: true },
        { label: t('file.quit'), shortcut: 'Alt+F4', onSelect: () => void bridge.window.close() },
      ],
    },
    {
      title: t('menu.view'),
      items: () => [
        {
          label: t('view.zoom'),
          disabled: state.fullscreen,
          submenu: () =>
            WINDOW_ZOOMS.map((zoom) => ({
              label: `×${zoom}`,
              checked: () => isZoom(zoom),
              onSelect: () => {
                const area = zoomedArea(zoom);
                void bridge.window.setContentSize(area.width, area.height + TITLEBAR_HEIGHT);
              },
            })),
        },
        { separator: true },
        {
          label: t('view.fullscreen'),
          shortcut: RESERVED_KEYS.fullscreen,
          checked: () => state.fullscreen,
          onSelect: () => void bridge.window.setFullscreen(!state.fullscreen),
        },
      ],
    },
    {
      title: t('menu.tools'),
      items: () => {
        const handle = context.getConsole();
        return [
          {
            label: t('tools.speed', { speed: currentSettings().fastSpeed }),
            shortcut: RESERVED_KEYS.speed,
            disabled: !handle || !context.isRunning(),
            checked: () => (handle?.api.time.speed ?? 1) > 1,
            onSelect: () => void handle?.toggleSpeed(),
          },
          { separator: true },
          {
            label: t('tools.devtools'),
            shortcut: 'F12',
            onSelect: () => void bridge.system.toggleDevTools(),
          },
        ];
      },
    },
    {
      title: t('menu.settings'),
      items: () => [
        { label: t('tools.language'), onSelect: showLanguageDialog },
        { label: t('help.keymap'), onSelect: showKeymapDialog },
        { separator: true },
        { label: t('config.volume'), onSelect: showVolumeDialog },
        {
          label: t('config.fastSpeed'),
          submenu: () =>
            FAST_SPEEDS.map((fastSpeed) => ({
              label: `×${fastSpeed}`,
              checked: () => currentSettings().fastSpeed === fastSpeed,
              onSelect: () => updateSettings({ fastSpeed }),
            })),
        },
        { separator: true },
        { label: t('tools.gamesFolder'), onSelect: () => void bridge.system.openFolder('games') },
        {
          label: t('tools.dataFolder'),
          onSelect: () => void bridge.system.openFolder('userData'),
        },
      ],
    },
    {
      title: t('menu.help'),
      items: () => [
        {
          label: t('help.about'),
          onSelect: () => void showAboutDialog(bridge, context.getManifest()),
        },
      ],
    },
  ];
}
