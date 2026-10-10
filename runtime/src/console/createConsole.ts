import type { CartManifest, ConsoleAPI, Unsubscribe } from '@nghslab/nori-sdk';
import { CONSOLE_NAME, RESERVED_KEYS } from '../config';
import { ConsoleInputImpl } from './input';
import { createSave } from './save';
import { ScreenManager } from './screen';
import { currentSettings, onSettingsChange } from './settings';

export interface ConsoleHandle {
  api: ConsoleAPI;
  /** 배속을 다음 단계로 (Tab 과 같다). 새 배속을 돌려준다 */
  toggleSpeed(): number;
  /** 홈 뒤에 일시정지: 콘솔 입력·예약 키를 끊고 HUD 를 숨긴다 (게임 pause 는 세션이 따로 부른다) */
  suspend(): void;
  resume(): void;
  destroy(): void;
}

/**
 * 카트리지 하나를 위한 ConsoleAPI 를 조립한다.
 * 화면·입력·세이브·배속·시스템 기능을 여기서 묶고, 카트리지에는 api 만 넘긴다.
 */
export interface ConsoleOptions {
  /** 카트리지 에셋의 기준 URL (끝에 '/'). 생략 시 개발 서버 규칙 ./carts/<id>/assets/ */
  assetsBase?: string;
  /** 에셋 경로 → URL 을 직접 정한다 (blob URL 등). 있으면 assetsBase 대신 쓴다 */
  assetUrl?: (path: string) => string;
}

export function createConsole(
  manifest: CartManifest,
  elements: { area: HTMLElement; screen: HTMLElement; hud: HTMLElement },
  options: ConsoleOptions = {},
): ConsoleHandle {
  const screen = new ScreenManager(elements.screen, elements.area, manifest.screen);
  const assetsBase = options.assetsBase ?? `./carts/${manifest.id}/assets/`;
  const input = new ConsoleInputImpl(elements.screen, () => screen.layout);
  const save = createSave(manifest.id);
  const bridge = window.norideck;

  // ---- 배속 (Tab): ×1 ↔ 설정한 배속 ----
  let fast = false;
  const speedListeners = new Set<(speed: number) => void>();
  const speed = (): number => (fast ? currentSettings().fastSpeed : 1);
  const renderHud = () => {
    const value = speed();
    elements.hud.textContent = `▶▶ ×${value}`;
    elements.hud.hidden = value === 1;
  };
  const notifySpeed = () => {
    renderHud();
    for (const listener of speedListeners) listener(speed());
  };

  const toggleSpeed = (): number => {
    fast = !fast;
    notifySpeed();
    return speed();
  };
  // 배속 중에 설정을 바꾸면 바로 반영
  const offSettings = onSettingsChange(() => {
    if (fast) notifySpeed();
  });

  let suspended = false;
  const onReservedKey = (event: KeyboardEvent) => {
    if (suspended) return;
    if (event.code === RESERVED_KEYS.speed) {
      event.preventDefault();
      if (event.repeat) return;
      toggleSpeed();
    } else if (event.code === RESERVED_KEYS.fullscreen && !bridge?.isDesktop) {
      // 데스크톱에서는 Electron 메인이 F11 을 처리한다
      event.preventDefault();
      toggleBrowserFullscreen();
    }
  };
  window.addEventListener('keydown', onReservedKey);

  const api: ConsoleAPI = {
    manifest,
    screen: {
      container: elements.screen,
      get layout() {
        return screen.layout;
      },
      onResize: (callback) => screen.onResize(callback),
    },
    input,
    save,
    assets: {
      url: (path) =>
        options.assetUrl ? options.assetUrl(path) : assetsBase + path.replace(/^\/+/, ''),
    },
    time: {
      get speed() {
        return speed();
      },
      onSpeedChange(callback): Unsubscribe {
        speedListeners.add(callback);
        return () => speedListeners.delete(callback);
      },
    },
    system: {
      isDesktop: Boolean(bridge?.isDesktop),
      consoleName: CONSOLE_NAME,
      fullscreen: (on) => {
        if (bridge?.isDesktop) void bridge.window.setFullscreen(on ?? true);
        else toggleBrowserFullscreen(on);
      },
      log: (...args) => console.info(`[${manifest.id}]`, ...args),
    },
  };

  return {
    api,
    toggleSpeed,
    suspend() {
      suspended = true;
      input.setEnabled(false);
      elements.hud.hidden = true;
    },
    resume() {
      suspended = false;
      input.setEnabled(true);
      renderHud();
    },
    destroy() {
      offSettings();
      window.removeEventListener('keydown', onReservedKey);
      input.destroy();
      screen.destroy();
    },
  };
}

function toggleBrowserFullscreen(on?: boolean): void {
  const wants = on ?? !document.fullscreenElement;
  if (wants) void document.documentElement.requestFullscreen().catch(() => undefined);
  else if (document.fullscreenElement) void document.exitFullscreen();
}
