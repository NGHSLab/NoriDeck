/**
 * 키 배치: 물리 키(KeyboardEvent.code) → DS 버튼. 콘솔 설정이라 게임은 모른다.
 *
 *   기본   십자키 W A S D (방향키도 보조) · A B X Y = H J K L · L R = Y U · SELECT START = I O · 홈 = P
 *   변경   Config → 키 배치… 에서 버튼마다 다시 지정. localStorage 에 남고 onKeymapChange 로 즉시 반영된다
 *   예약   Tab(배속) · F11(전체화면) · 홈 키는 게임에 전달되지 않는다
 */
import { DS_BUTTONS, type DsButton } from '@nghslab/nori-sdk';
import { RESERVED_KEYS } from '../config';

export type Keymap = Readonly<Record<string, DsButton>>;

/** 콘솔이 쓰는 키 (버튼이 아닌 것). 바꿀 수 있는 것만 여기 */
export interface ConsoleKeys {
  /** 게임 ↔ 홈 전환 */
  home: string;
}

export const DEFAULT_KEYMAP: Keymap = {
  KeyW: 'UP',
  KeyS: 'DOWN',
  KeyA: 'LEFT',
  KeyD: 'RIGHT',
  KeyH: 'A',
  KeyJ: 'B',
  KeyK: 'X',
  KeyL: 'Y',
  KeyY: 'L',
  KeyU: 'R',
  KeyI: 'SELECT',
  KeyO: 'START',
  // 보조: 방향키도 십자키
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
};

export const DEFAULT_CONSOLE_KEYS: ConsoleKeys = { home: 'KeyP' };

const STORAGE_KEY = 'norideck.keymap';

interface Stored {
  keymap?: Record<string, string>;
  console?: Partial<ConsoleKeys>;
}

function isButton(value: unknown): value is DsButton {
  return typeof value === 'string' && (DS_BUTTONS as readonly string[]).includes(value);
}

function load(): { keymap: Keymap; console: ConsoleKeys } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Stored;
      const keymap: Record<string, DsButton> = {};
      for (const [code, button] of Object.entries(stored.keymap ?? {})) {
        if (isButton(button) && code) keymap[code] = button;
      }
      const home =
        typeof stored.console?.home === 'string' && stored.console.home
          ? stored.console.home
          : DEFAULT_CONSOLE_KEYS.home;
      if (Object.keys(keymap).length > 0) return { keymap, console: { home } };
    }
  } catch {
    // 저장소가 없거나 깨졌으면 기본값
  }
  return { keymap: DEFAULT_KEYMAP, console: { ...DEFAULT_CONSOLE_KEYS } };
}

let state = load();
const listeners = new Set<() => void>();

function persist(): void {
  try {
    const stored: Stored = { keymap: { ...state.keymap }, console: { ...state.console } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // 저장 실패는 무시 (이번 실행에만 적용)
  }
  for (const listener of listeners) listener();
}

export function currentKeymap(): Keymap {
  return state.keymap;
}

export function currentConsoleKeys(): ConsoleKeys {
  return state.console;
}

export function onKeymapChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 콘솔이 먹는 키인가 (게임에 전달되지 않는다) */
export function isReservedKey(code: string): boolean {
  return (
    code === RESERVED_KEYS.speed || code === RESERVED_KEYS.fullscreen || code === state.console.home
  );
}

/** 이 키가 이미 어디에 쓰이는지 (버튼 이름 또는 콘솔 키 이름). 없으면 undefined */
export function usageOf(code: string): DsButton | 'home' | 'speed' | 'fullscreen' | undefined {
  if (code === RESERVED_KEYS.speed) return 'speed';
  if (code === RESERVED_KEYS.fullscreen) return 'fullscreen';
  if (code === state.console.home) return 'home';
  return state.keymap[code];
}

/**
 * 버튼에 키를 붙인다. 그 버튼의 기존 키는 모두 빠지고, 다른 버튼이 쓰던 키였으면 그쪽에서 빠진다.
 * Tab · F11 은 붙일 수 없다 (false)
 */
export function assignKey(button: DsButton, code: string): boolean {
  if (code === RESERVED_KEYS.speed || code === RESERVED_KEYS.fullscreen) return false;
  const next: Record<string, DsButton> = {};
  for (const [existing, mapped] of Object.entries(state.keymap)) {
    if (mapped !== button && existing !== code) next[existing] = mapped;
  }
  next[code] = button;
  const consoleKeys = { ...state.console };
  if (consoleKeys.home === code) consoleKeys.home = '';
  state = { keymap: next, console: consoleKeys };
  persist();
  return true;
}

export function assignHomeKey(code: string): boolean {
  if (code === RESERVED_KEYS.speed || code === RESERVED_KEYS.fullscreen) return false;
  const next: Record<string, DsButton> = {};
  for (const [existing, mapped] of Object.entries(state.keymap)) {
    if (existing !== code) next[existing] = mapped;
  }
  state = { keymap: next, console: { ...state.console, home: code } };
  persist();
  return true;
}

export function resetKeymap(): void {
  state = { keymap: DEFAULT_KEYMAP, console: { ...DEFAULT_CONSOLE_KEYS } };
  persist();
}

/** 버튼에 붙은 키들 (기본 키가 앞) */
export function codesFor(button: DsButton): string[] {
  return Object.entries(state.keymap)
    .filter(([, mapped]) => mapped === button)
    .map(([code]) => code);
}

const CODE_LABEL: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Escape: 'Esc',
  ShiftLeft: 'L Shift',
  ShiftRight: 'R Shift',
  ControlLeft: 'L Ctrl',
  ControlRight: 'R Ctrl',
  AltLeft: 'L Alt',
  AltRight: 'R Alt',
  Semicolon: ';',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Quote: "'",
  Backquote: '`',
  Backslash: '\\',
};

/** 화면 표시용 키 이름: KeyH → H, Digit1 → 1, Numpad1 → Num 1, 그 밖은 표 또는 code 그대로 */
export function keyLabel(code: string): string {
  if (!code) return '-';
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter?.[1]) return letter[1];
  const digit = /^Digit(\d)$/.exec(code);
  if (digit?.[1]) return digit[1];
  const numpad = /^Numpad(.+)$/.exec(code);
  if (numpad?.[1]) return `Num ${numpad[1]}`;
  return CODE_LABEL[code] ?? code;
}

/** 버튼의 대표 키 이름 (안내용). 없으면 '-' */
export function labelFor(button: DsButton): string {
  const [first] = codesFor(button);
  return first ? keyLabel(first) : '-';
}
