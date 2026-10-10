/**
 * 키 배치 대화상자 가운데의 기기 그림 (CSS 로 그린 가로형 NoriDeck: 어깨 L·R, 십자키, 16:9 화면, ABXY, SELECT·START).
 * 칸에 마우스를 올리거나 키를 받는 중이면 해당 부분을 민트로 강조한다.
 */
import type { DsButton } from '@nghslab/nori-sdk';
import { CONSOLE_NAME } from '../config';

export interface KeymapDevice {
  element: HTMLElement;
  /** 강조할 버튼. undefined 면 강조 없음 */
  highlight(button: DsButton | undefined): void;
}

function part(className: string, button: DsButton): HTMLElement {
  const el = document.createElement('span');
  el.className = className;
  el.dataset.part = button;
  return el;
}

function group(className: string, children: HTMLElement[]): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  el.append(...children);
  return el;
}

export function createKeymapDevice(): KeymapDevice {
  const device = document.createElement('div');
  device.className = 'keymap-device';
  device.setAttribute('aria-hidden', 'true');

  const screen = document.createElement('div');
  screen.className = 'kd-screen';
  screen.textContent = CONSOLE_NAME;

  device.append(
    part('kd-shoulder kd-l', 'L'),
    part('kd-shoulder kd-r', 'R'),
    group('kd-dpad', [
      part('kd-dir kd-up', 'UP'),
      part('kd-dir kd-left', 'LEFT'),
      part('kd-dir kd-right', 'RIGHT'),
      part('kd-dir kd-down', 'DOWN'),
    ]),
    screen,
    group('kd-face', [
      part('kd-btn kd-x', 'X'),
      part('kd-btn kd-y', 'Y'),
      part('kd-btn kd-a', 'A'),
      part('kd-btn kd-b', 'B'),
    ]),
    group('kd-sys', [part('kd-pill', 'SELECT'), part('kd-pill', 'START')]),
  );

  return {
    element: device,
    highlight(button) {
      for (const el of device.querySelectorAll<HTMLElement>('[data-part]')) {
        el.classList.toggle('active', el.dataset.part === button);
      }
    },
  };
}
