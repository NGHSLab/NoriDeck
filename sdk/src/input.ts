import type { ConsoleInput, DsButton, Unsubscribe } from './index';

/**
 * 버튼·키 묶음. DS 버튼은 'btn:A', 물리 키는 'key:Digit1' 형태의 ID 로 다룬다.
 * 씬 코드는 justDown(group) / isDown(group) 만 쓰면 된다.
 */
export interface ButtonGroup {
  readonly poller: ButtonPoller;
  readonly ids: readonly string[];
}

/**
 * 프레임 기준 "방금 눌림" 판정기.
 * 콘솔 입력 이벤트를 받아 플래그로 쌓아 두고, 게임 루프가 읽을 때 소비한다.
 * 씬(화면)마다 하나씩 만들고, 다른 화면이 입력을 소비한 뒤에는 reset() 으로 남은 플래그를 지운다.
 */
export class ButtonPoller {
  private readonly pressed = new Set<string>();
  private readonly held = new Set<string>();
  private readonly unsubscribe: Unsubscribe[] = [];

  constructor(input: ConsoleInput) {
    this.unsubscribe.push(
      input.onAny((button, phase) => this.track(`btn:${button}`, phase === 'down')),
      input.onKey((key) => this.track(`key:${key.code}`, key.phase === 'down')),
    );
  }

  buttons(...buttons: DsButton[]): ButtonGroup {
    return { poller: this, ids: buttons.map((button) => `btn:${button}`) };
  }

  keys(...codes: string[]): ButtonGroup {
    return { poller: this, ids: codes.map((code) => `key:${code}`) };
  }

  /** 마지막 확인 이후 눌렸는가. 읽으면 소비된다 */
  justDown(group: ButtonGroup): boolean {
    let hit = false;
    for (const id of group.ids) {
      if (this.pressed.delete(id)) hit = true;
    }
    return hit;
  }

  isDown(group: ButtonGroup): boolean {
    return group.ids.some((id) => this.held.has(id));
  }

  /** 다른 화면이 소비한 입력이 이쪽에 남지 않도록 비운다 */
  reset(): void {
    this.pressed.clear();
  }

  destroy(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
    this.pressed.clear();
    this.held.clear();
  }

  private track(id: string, down: boolean): void {
    if (down) {
      if (!this.held.has(id)) this.pressed.add(id);
      this.held.add(id);
    } else {
      this.held.delete(id);
    }
  }
}
