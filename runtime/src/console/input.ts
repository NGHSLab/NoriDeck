import type {
  ConsoleInput,
  DsButton,
  InputPhase,
  PointerInfo,
  RawKeyInfo,
  ScreenLayout,
  Unsubscribe,
} from '@nghslab/nori-sdk';
import { currentKeymap, isReservedKey, onKeymapChange } from './keymap';

type ButtonListener = (button: DsButton, phase: InputPhase) => void;
type KeyListener = (key: RawKeyInfo) => void;
type PointerListener = (pointer: PointerInfo) => void;

/**
 * 콘솔 입력. 창 전체의 키 이벤트를 받아 DS 버튼으로 바꾸고, 화면 위 포인터를 논리 좌표로 바꾼다.
 */
export class ConsoleInputImpl implements ConsoleInput {
  private readonly heldButtons = new Set<DsButton>();
  private readonly heldKeys = new Set<string>();
  private readonly buttonListeners = new Set<ButtonListener>();
  private readonly keyListeners = new Set<KeyListener>();
  private readonly pointerListeners = new Set<PointerListener>();
  private keymap: Readonly<Record<string, DsButton>> = currentKeymap();
  private readonly offKeymap: () => void;
  /** false 면 키·포인터를 무시한다 (홈 뒤에 일시정지된 동안) */
  private enabled = true;

  constructor(
    private readonly container: HTMLElement,
    private readonly layout: () => ScreenLayout,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
    // 설정에서 키 배치를 바꾸면 바로 반영 (눌려 있던 버튼은 놓는다)
    this.offKeymap = onKeymapChange(() => {
      this.keymap = currentKeymap();
      this.releaseAll();
    });
    container.addEventListener('pointerdown', (event) => this.emitPointer('down', event));
    container.addEventListener('pointerup', (event) => this.emitPointer('up', event));
    container.addEventListener('pointermove', (event) => this.emitPointer('move', event));
  }

  setKeymap(keymap: Readonly<Record<string, DsButton>>): void {
    this.keymap = keymap;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.releaseAll();
  }

  /** 카트리지를 내릴 때. 창 리스너를 떼어 다음 카트리지에 키가 새지 않게 한다 */
  destroy(): void {
    this.releaseAll();
    this.offKeymap();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.releaseAll);
  }

  isDown(button: DsButton): boolean {
    return this.heldButtons.has(button);
  }

  on(button: DsButton, phase: InputPhase, callback: () => void): Unsubscribe {
    return this.onAny((pressed, pressedPhase) => {
      if (pressed === button && pressedPhase === phase) callback();
    });
  }

  onAny(callback: ButtonListener): Unsubscribe {
    this.buttonListeners.add(callback);
    return () => this.buttonListeners.delete(callback);
  }

  onPointer(callback: PointerListener): Unsubscribe {
    this.pointerListeners.add(callback);
    return () => this.pointerListeners.delete(callback);
  }

  onKey(callback: KeyListener): Unsubscribe {
    this.keyListeners.add(callback);
    return () => this.keyListeners.delete(callback);
  }

  isKeyDown(code: string): boolean {
    return this.heldKeys.has(code);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;
    if (isReservedKey(event.code)) return; // 콘솔 예약 키(배속·전체화면·홈)는 콘솔이 따로 처리
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    const button = this.keymap[event.code];
    if (button) {
      event.preventDefault(); // 방향키 스크롤 등 브라우저 기본 동작 방지
      this.heldButtons.add(button);
      for (const listener of this.buttonListeners) listener(button, 'down');
    }
    if (!this.heldKeys.has(event.code)) {
      this.heldKeys.add(event.code);
      for (const listener of this.keyListeners) listener({ code: event.code, phase: 'down' });
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (!this.enabled) return;
    if (isReservedKey(event.code)) return;
    const button = this.keymap[event.code];
    if (button) {
      // 같은 버튼에 매핑된 다른 키가 아직 눌려 있으면 유지
      const stillHeld = Object.entries(this.keymap).some(
        ([code, mapped]) => mapped === button && code !== event.code && this.heldKeys.has(code),
      );
      if (!stillHeld) {
        this.heldButtons.delete(button);
        for (const listener of this.buttonListeners) listener(button, 'up');
      }
    }
    if (this.heldKeys.delete(event.code)) {
      for (const listener of this.keyListeners) listener({ code: event.code, phase: 'up' });
    }
  };

  private readonly releaseAll = (): void => {
    for (const button of [...this.heldButtons]) {
      this.heldButtons.delete(button);
      for (const listener of this.buttonListeners) listener(button, 'up');
    }
    for (const code of [...this.heldKeys]) {
      this.heldKeys.delete(code);
      for (const listener of this.keyListeners) listener({ code, phase: 'up' });
    }
  };

  private emitPointer(type: PointerInfo['type'], event: PointerEvent): void {
    if (!this.enabled || this.pointerListeners.size === 0) return;
    const rect = this.container.getBoundingClientRect();
    const layout = this.layout();
    const scale = layout.scale || 1;
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;
    const info: PointerInfo = { type, x, y };
    if (layout.layout === 'ds-dual' && layout.top && layout.bottom) {
      info.screen = y < layout.bottom.y ? 'top' : 'bottom';
    }
    for (const listener of this.pointerListeners) listener(info);
  }
}
