/**
 * 콘솔 이름 (표시용). 바꿔도 되는 값 — 창 제목, 타이틀바, 부트 화면, 웹페이지에 쓰인다.
 * 내부 ID(CONSOLE_ID)는 세이브 폴더·프로토콜·확장자에 쓰이므로 바꾸지 않는다.
 */
export const CONSOLE_NAME = 'NoriDeck';
export const CONSOLE_ID = 'norideck';
/** 카트리지 파일 확장자와 커스텀 프로토콜 */
export const CART_EXTENSION = '.nori';
export const CART_PROTOCOL = 'nori';

/** 데스크톱 커스텀 타이틀바 높이. desktop/src/main.ts 와 index.html CSS 와 맞춘다 */
export const TITLEBAR_HEIGHT = 28;

/** 콘솔이 예약한 키. 카트리지에는 전달되지 않는다 */
export const RESERVED_KEYS = {
  speed: 'Tab',
  fullscreen: 'F11',
} as const;

/** Config → 배속 에서 고를 수 있는 배속. Tab 은 ×1 과 이 값 사이를 오간다 */
export const FAST_SPEEDS = [1.5, 2, 3, 4] as const;
export const DEFAULT_FAST_SPEED = 3;

/**
 * 콘솔 기준 화면 (16:9). 카트리지가 매니페스트로 자기 해상도를 정하고 콘솔은 비율을 지켜 확대한다.
 * 첫 창 크기(desktop/src/main.ts BASE_SCREEN)와 "창 배율" 메뉴의 기준. 16:9 모니터 전체화면에서 좌우 여백이 없다.
 */
export const DEFAULT_SCREEN = { width: 480, height: 270 } as const;
/**
 * 창 배율 ×1 의 실제 픽셀 확대. 콘솔 기준 480×270 은 그대로 보기엔 작아 2배(960×540)를 ×1 로 삼는다.
 * 첫 창 크기(desktop/src/main.ts BASE_ZOOM_SCALE)와 같게 유지한다.
 */
export const WINDOW_BASE_SCALE = 2;
/** "보기 → 창 배율" 메뉴 단계 (×1 = WINDOW_BASE_SCALE 배). 기본은 ×1 */
export const WINDOW_ZOOMS = [0.5, 1, 1.5] as const;

/** 콘솔 시작 전에 로드를 기다릴 폰트 */
export const FONT_PRELOAD = ['11px Galmuri11', '9px Galmuri9'] as const;
