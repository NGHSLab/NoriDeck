/**
 * 콘솔 ↔ 카트리지 계약 (SDK).
 *
 * 콘솔(runtime + desktop)은 "본체"다: 창, 화면 비율, 키 배치, 세이브, 배속을 소유한다.
 * 카트리지(carts)는 "ROM"이다: 자기 엔진(Phaser 등)과 게임 코드·데이터를 들고 와서
 * mount(api) 로 콘솔이 준 화면에 그린다.
 *
 * 이 파일의 표면이 곧 포맷이다. 여기에 없는 것은 카트리지가 쓸 수 없고, 여기 있는 것은
 * 콘솔이 계속 지켜야 한다. 바꿀 때는 SDK_VERSION 을 올린다 (major 가 다르면 콘솔이 거부).
 */

import type { CartInfo, CartManifest } from './manifest';

export const SDK_VERSION = '0.2.1';

/** DS 본체 버튼. 카트리지는 물리 키가 아니라 이 이름만 안다. 키 배치는 콘솔 설정이다. */
export type DsButton =
  'A' | 'B' | 'X' | 'Y' | 'L' | 'R' | 'START' | 'SELECT' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export const DS_BUTTONS: readonly DsButton[] = [
  'A',
  'B',
  'X',
  'Y',
  'L',
  'R',
  'START',
  'SELECT',
  'UP',
  'DOWN',
  'LEFT',
  'RIGHT',
];

export type Unsubscribe = () => void;

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 카트리지가 요청하는 논리 화면. 콘솔은 이 비율을 유지한 채 확대하고 남는 곳을 검게 채운다. */
export interface ScreenSpec {
  width: number;
  height: number;
  /** ds-dual 이면 위·아래 두 화면으로 나눠 top/bottom 사각형을 제공한다 */
  layout: 'single' | 'ds-dual';
  /** ds-dual 일 때 두 화면 사이 힌지 여백(px) */
  gap?: number;
}

export interface ScreenLayout extends ScreenSpec {
  top?: ScreenRect;
  bottom?: ScreenRect;
  /** 현재 화면 배율 (논리 px → 실제 CSS px) */
  scale: number;
}

// CartInfo / CartManifest / PackedManifest 와 검증기는 manifest.ts 에 있다 (아래에서 재export)

export type InputPhase = 'down' | 'up';

export interface PointerInfo {
  type: 'down' | 'up' | 'move';
  /** 논리 좌표 (카트리지 화면 기준) */
  x: number;
  y: number;
  /** ds-dual 이면 어느 화면 위인지 */
  screen?: 'top' | 'bottom';
}

export interface RawKeyInfo {
  /** KeyboardEvent.code (예: 'Digit1', 'F1') */
  code: string;
  phase: InputPhase;
}

export interface ConsoleInput {
  isDown(button: DsButton): boolean;
  on(button: DsButton, phase: InputPhase, callback: () => void): Unsubscribe;
  /** 어떤 버튼이든 눌림/떼짐을 받는다 (폴러 구현용) */
  onAny(callback: (button: DsButton, phase: InputPhase) => void): Unsubscribe;
  onPointer(callback: (pointer: PointerInfo) => void): Unsubscribe;
  /**
   * 물리 키 직접 접근. DS 버튼으로 표현할 수 없는 편의 단축키(숫자키 등)에만 쓴다.
   * 콘솔이 예약한 키(Tab 배속, F11 전체화면 등)는 전달되지 않는다.
   */
  onKey(callback: (key: RawKeyInfo) => void): Unsubscribe;
  isKeyDown(code: string): boolean;
}

/** 카트리지별로 격리된 저장소. 내용 형식은 카트리지가 정한다 (문자열). */
export interface ConsoleSave {
  read(slot?: string): Promise<string | null>;
  write(data: string, slot?: string): Promise<void>;
  remove(slot?: string): Promise<void>;
  list(): Promise<string[]>;
}

export interface ConsoleAPI {
  readonly manifest: CartManifest;
  readonly screen: {
    /** 카트리지가 그릴 요소. 콘솔이 크기·위치·레터박스를 관리한다. 자식을 채우면 된다 */
    readonly container: HTMLElement;
    readonly layout: ScreenLayout;
    onResize(callback: (layout: ScreenLayout) => void): Unsubscribe;
  };
  readonly input: ConsoleInput;
  readonly save: ConsoleSave;
  readonly assets: {
    /** 카트리지 에셋 경로 → 로드 가능한 URL */
    url(path: string): string;
  };
  readonly time: {
    /** 배속 (1 = 보통). 카트리지는 자기 시간 배율에 반영한다 */
    readonly speed: number;
    onSpeedChange(callback: (speed: number) => void): Unsubscribe;
  };
  readonly system: {
    readonly isDesktop: boolean;
    readonly consoleName: string;
    fullscreen(on?: boolean): void;
    log(...args: unknown[]): void;
  };
}

export interface GameInstance {
  pause?(): void;
  resume?(): void;
  unmount(): void;
}

export interface Cartridge {
  manifest: CartManifest;
  mount(api: ConsoleAPI): Promise<GameInstance> | GameInstance;
}

export interface CartridgeDefinition {
  /** nori.json 을 parseCartInfo 로 읽은 값. sdkVersion 은 생략하면 이 SDK 의 버전이 들어간다 */
  manifest: CartInfo & { sdkVersion?: string };
  mount(api: ConsoleAPI): Promise<GameInstance> | GameInstance;
}

/** 카트리지 진입점. `export const cartridge = defineCartridge({ manifest, mount })` */
export function defineCartridge(definition: CartridgeDefinition): Cartridge {
  return {
    manifest: { ...definition.manifest, sdkVersion: definition.manifest.sdkVersion ?? SDK_VERSION },
    mount: (api) => definition.mount(api),
  };
}

/** major 만 비교한다 */
export function isSdkCompatible(required: string, provided: string = SDK_VERSION): boolean {
  return required.split('.')[0] === provided.split('.')[0];
}

export { ButtonPoller, type ButtonGroup } from './input';
export {
  CART_ID_PATTERN,
  ManifestError,
  NORI_ENTRY,
  NORI_FORMAT,
  SEMVER_PATTERN,
  isSafeEntryPath,
  parseCartInfo,
  parseNoriProject,
  parsePackedManifest,
  type CartInfo,
  type CartManifest,
  type NoriBuildConfig,
  type NoriProject,
  type PackedManifest,
} from './manifest';
