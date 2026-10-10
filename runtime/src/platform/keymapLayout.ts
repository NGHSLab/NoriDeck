/**
 * 키 배치 대화상자의 버튼 자리. 기기 그림을 가운데 두고 왼쪽에 L·십자키, 오른쪽에 R·ABXY, 아래에 SELECT·START.
 * area 는 console.css 의 .keymap-pad grid-template-areas 이름과 같다.
 */
import type { DsButton } from '@nghslab/nori-sdk';

export interface PadSlot {
  button: DsButton;
  /** 칸 위에 보이는 이름 (언어 공통) */
  label: string;
  area: string;
}

export const PAD_SLOTS: readonly PadSlot[] = [
  { button: 'L', label: 'L', area: 'l' },
  { button: 'R', label: 'R', area: 'r' },
  { button: 'UP', label: '↑', area: 'up' },
  { button: 'LEFT', label: '←', area: 'left' },
  { button: 'RIGHT', label: '→', area: 'right' },
  { button: 'DOWN', label: '↓', area: 'down' },
  { button: 'X', label: 'X', area: 'x' },
  { button: 'Y', label: 'Y', area: 'y' },
  { button: 'A', label: 'A', area: 'a' },
  { button: 'B', label: 'B', area: 'b' },
  { button: 'SELECT', label: 'SELECT', area: 'select' },
  { button: 'START', label: 'START', area: 'start' },
];
