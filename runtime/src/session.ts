/**
 * 카트리지 세션: 실행(run) · 홈으로(goHome: 일시정지 상태로 뒤에 남김) · 이어서(resume) · 종료(eject).
 *
 * 게임기처럼 "홈" 은 게임을 끄는 것이 아니다. goHome 은 게임을 pause 하고 콘솔 입력을 끊은 채 화면만 숨기며,
 * 마지막 프레임을 찍어(snapshot) 홈이 카드에 보여 줄 수 있게 넘긴다. 뒤에 남는 게임은 하나뿐이고,
 * 다른 카트리지를 실행하면 이전 게임은 완전히 내려간다(unmount).
 */
import {
  isSdkCompatible,
  SDK_VERSION,
  type CartManifest,
  type Cartridge,
  type GameInstance,
} from '@nghslab/nori-sdk';
import { CONSOLE_NAME } from './config';
import { createConsole, type ConsoleHandle } from './console/createConsole';
import { t } from './i18n';
import { openNoriFile } from './nori/openNori';

export interface CartEntry {
  /** 표시·로그용. 실제 ID 는 카트리지 매니페스트가 정한다 */
  id: string;
  load: () => Promise<Cartridge>;
  /** 에셋 기준 URL (끝에 '/'). 내장 카트리지는 생략 (개발 서버 규칙 사용) */
  assetsBase?: string;
  /** 에셋 경로 → URL 을 직접 정하는 경우 (메모리에서 연 .nori 의 blob URL 등). assetsBase 보다 우선 */
  assetUrl?: (path: string) => string;
  /** 꺼낼 때 자원 해제 (blob URL 등) */
  release?: () => void;
}

export interface RunningCart {
  entry: CartEntry;
  cartridge: Cartridge;
  console: ConsoleHandle;
  game: GameInstance;
}

/** 홈에 뒤로 남은(일시정지) 게임 정보 */
export interface SuspendedCart {
  id: string;
  manifest: CartManifest;
  /** 마지막 프레임 (data: URL). 캔버스를 읽을 수 없으면 없음 */
  snapshot?: string;
}

export interface SessionDom {
  console: HTMLElement;
  screen: HTMLElement;
  hud: HTMLElement;
  boot: HTMLElement;
}

export interface SessionHooks {
  /** 홈 화면을 보여 줄 때. suspended 가 있으면 그 게임이 뒤에 일시정지 상태로 남아 있다 */
  onHome(suspended: SuspendedCart | undefined): void;
  /** 게임 화면을 보이기 직전 (홈 숨기기) */
  onBeforeShowGame(): void;
  showBoot(message: string): void;
  onStatus(message: string): void;
  onError(message: string): void;
}

export interface ConsoleSession {
  readonly current: RunningCart | undefined;
  /** current 가 있고 홈 뒤에 일시정지 상태인가 */
  readonly suspended: boolean;
  /** 카트리지를 꽂아 실행한다. 이미 실행 중이면(일시정지 포함) 먼저 내린다 */
  run(entry: CartEntry): Promise<RunningCart>;
  /** .nori 파일을 메모리에서 열어 실행한다 (브라우저 경로) */
  openFile(file: File): Promise<RunningCart>;
  /** 게임을 일시정지 상태로 뒤에 두고 홈으로 */
  goHome(): void;
  /** 뒤에 둔 게임으로 돌아간다. 없으면 false */
  resume(): boolean;
  /** 실행 중(일시정지 포함) 카트리지를 완전히 내리고 홈으로 */
  eject(): void;
  isSuspended(id: string): boolean;
}

/** 단색(거의 검정 등)이면 true — WebGL 캔버스는 preserveDrawingBuffer 없이 읽으면 검게 나온다 */
function isFlat(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height);
  const first = [data[0], data[1], data[2], data[3]];
  const step = Math.max(4, Math.floor(data.length / 4 / 256) * 4);
  for (let i = 0; i < data.length; i += step) {
    if (
      Math.abs((data[i] ?? 0) - (first[0] ?? 0)) > 8 ||
      Math.abs((data[i + 1] ?? 0) - (first[1] ?? 0)) > 8 ||
      Math.abs((data[i + 2] ?? 0) - (first[2] ?? 0)) > 8 ||
      Math.abs((data[i + 3] ?? 0) - (first[3] ?? 0)) > 8
    )
      return false;
  }
  return true;
}

/**
 * 게임 캔버스의 마지막 프레임을 작은 PNG data URL 로.
 * 읽을 수 없거나 단색(WebGL 이 검게 나온 경우)이면 undefined → 홈은 커버를 대신 보인다.
 */
function captureFrame(root: HTMLElement): string | undefined {
  const canvases = [...root.querySelectorAll('canvas')].filter((c) => c.width > 0 && c.height > 0);
  for (const canvas of canvases) {
    try {
      const out = document.createElement('canvas');
      const scale = Math.min(1, 480 / canvas.width);
      out.width = Math.max(1, Math.round(canvas.width * scale));
      out.height = Math.max(1, Math.round(canvas.height * scale));
      const ctx = out.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(canvas, 0, 0, out.width, out.height);
      if (isFlat(ctx, out.width, out.height)) continue;
      return out.toDataURL('image/png');
    } catch {
      // 다음 캔버스 시도
    }
  }
  return undefined;
}

export function createSession(dom: SessionDom, hooks: SessionHooks): ConsoleSession {
  let current: RunningCart | undefined;
  let suspended = false;
  let snapshot: string | undefined;

  const showHome = () => {
    dom.screen.hidden = true;
    dom.boot.hidden = true;
    dom.hud.hidden = true;
    document.title = CONSOLE_NAME;
    const info: SuspendedCart | undefined =
      current && suspended
        ? { id: current.cartridge.manifest.id, manifest: current.cartridge.manifest, snapshot }
        : undefined;
    hooks.onHome(info);
  };

  /** 완전히 내린다 (화면 전환 없음) */
  const unmountCurrent = () => {
    if (!current) return;
    const running = current;
    current = undefined;
    suspended = false;
    snapshot = undefined;
    try {
      running.game.unmount();
    } catch (error) {
      console.warn('[console] 카트리지 unmount 중 오류', error);
    }
    running.console.destroy();
    running.entry.release?.();
    dom.screen.replaceChildren();
    console.info(`[console] ${running.cartridge.manifest.title} 내림`);
  };

  const eject = () => {
    unmountCurrent();
    showHome();
  };

  const goHome = () => {
    if (current && !suspended) {
      snapshot = captureFrame(dom.screen);
      try {
        current.game.pause?.();
      } catch (error) {
        console.warn('[console] 카트리지 pause 중 오류', error);
      }
      current.console.suspend();
      suspended = true;
    }
    showHome();
  };

  const resume = (): boolean => {
    if (!current || !suspended) return false;
    suspended = false;
    snapshot = undefined;
    hooks.onBeforeShowGame();
    dom.screen.hidden = false;
    document.title = current.cartridge.manifest.title;
    current.console.resume();
    try {
      current.game.resume?.();
    } catch (error) {
      console.warn('[console] 카트리지 resume 중 오류', error);
    }
    return true;
  };

  const run = async (entry: CartEntry): Promise<RunningCart> => {
    unmountCurrent();
    hooks.onBeforeShowGame();
    dom.screen.hidden = false;
    hooks.showBoot(t('boot.loading', { id: entry.id }));
    try {
      const cartridge = await entry.load();
      const { manifest } = cartridge;
      if (!isSdkCompatible(manifest.sdkVersion)) {
        throw new Error(t('boot.sdkMismatch', { cart: manifest.sdkVersion, console: SDK_VERSION }));
      }
      document.title = manifest.title;
      const handle = createConsole(
        manifest,
        { area: dom.console, screen: dom.screen, hud: dom.hud },
        { assetsBase: entry.assetsBase, assetUrl: entry.assetUrl },
      );
      const game = await cartridge.mount(handle.api);
      current = { entry, cartridge, console: handle, game };
      dom.boot.hidden = true;
      console.info(`[console] ${manifest.title} v${manifest.version} 실행 (SDK ${SDK_VERSION})`);
      return current;
    } catch (error) {
      console.error(error);
      entry.release?.();
      showHome();
      hooks.onError(t('boot.cannotRun', { error: String(error) }));
      throw error;
    }
  };

  const openFile = async (file: File): Promise<RunningCart> => {
    hooks.onStatus(t('status.opening', { name: file.name }));
    const entry = await openNoriFile(file).catch((error: unknown) => {
      hooks.onError(`${file.name}: ${String(error instanceof Error ? error.message : error)}`);
      throw error;
    });
    return run(entry);
  };

  return {
    get current() {
      return current;
    },
    get suspended() {
      return current !== undefined && suspended;
    },
    run,
    openFile,
    goHome,
    resume,
    eject,
    isSuspended: (id) => current !== undefined && suspended && current.cartridge.manifest.id === id,
  };
}
