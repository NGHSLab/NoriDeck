/**
 * 홈 화면: 게임 화면이 보이지 않을 때의 첫 화면 (게임기의 홈 메뉴).
 *
 *   라이브러리가 비어 있으면  흰 배경에 선으로 딴 콘솔 아이콘만 (장식. 파일은 드롭 또는 파일 → 카트리지 추가)
 *   가져온 카트리지가 있으면  가운데 한 장 캐러셀 (homeLibrary.ts). 둘 이상이면 좌우로 넘긴다
 *   뒤에 일시정지된 게임이 있으면 그 카드에 마지막 화면을 보이고 클릭하면 이어서 한다
 *   파일을 끌어오면            드롭 칸이 화면 전체에 나타난다
 *
 * 데스크톱에서는 드롭·추가가 "라이브러리에 가져오기", 브라우저에서는 즉시 실행이다 (boot.ts 가 정한다).
 */
// SVG 를 인라인으로 넣어 CSS color 로 선 색을 정한다 (img 로 넣으면 currentColor 가 안 먹는다)
import outlineSvg from './assets/logo-outline.svg?raw';
import { CART_EXTENSION } from './config';
import { createLibraryCarousel, type LibraryViewOptions } from './homeLibrary';
import { onLangChange, t } from './i18n';
import type { DesktopLibraryEntry } from './platform/bridge';
import type { SuspendedCart } from './session';

export interface HomeOptions {
  /** .nori 파일이 들어왔을 때 (드롭 · 파일 선택) */
  onFile(file: File): void;
  /** 라이브러리 카트리지 동작. 없으면(브라우저) 캐러셀을 만들지 않는다 */
  library?: LibraryViewOptions;
}

export interface HomeHandle {
  element: HTMLElement;
  show(): void;
  hide(): void;
  /** 상태 줄. 안내(info)는 몇 초 뒤 저절로 사라지고, 오류는 다음 동작까지 남는다. 빈 문자열이면 바로 숨긴다 */
  status(message: string, kind?: 'info' | 'error'): void;
  /** .nori 파일 선택창을 연다 (메뉴 파일 → 카트리지 추가…) */
  pickFile(): void;
  /** 라이브러리 목록을 다시 그린다. 비어 있으면 아이콘 화면 */
  setLibrary(entries: readonly DesktopLibraryEntry[]): void;
  /** 뒤에 일시정지된 게임 (없으면 undefined) */
  setSuspended(suspended: SuspendedCart | undefined): void;
}

/** 안내 문구가 보이는 시간 */
const STATUS_INFO_MS = 4000;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function createHome(parent: HTMLElement, options: HomeOptions): HomeHandle {
  const root = el('div');
  root.id = 'home';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = CART_EXTENSION;
  input.hidden = true;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (file) options.onFile(file);
  });

  const logo = el('div', 'home-logo');
  logo.setAttribute('aria-hidden', 'true');
  logo.innerHTML = outlineSvg;

  const carousel = options.library ? createLibraryCarousel(options.library) : undefined;

  const status = el('div', 'home-status');
  status.hidden = true;
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  // 드롭 칸은 파일을 끌고 들어왔을 때만 보인다
  const drop = el('div', 'home-drop');
  const dropText = el('div', 'home-drop-text');
  drop.append(el('div', 'home-drop-icon', '⤓'), dropText);

  root.append(logo);
  if (carousel) root.append(carousel.element);
  root.append(status, drop, input);
  parent.append(root);

  let entries: readonly DesktopLibraryEntry[] = [];
  let suspended: SuspendedCart | undefined;
  const render = () => {
    root.classList.toggle('has-library', Boolean(carousel) && entries.length > 0);
    carousel?.render(entries, suspended);
  };
  const applyLanguage = () => {
    dropText.textContent = t('home.drop', { ext: CART_EXTENSION });
    render();
  };
  applyLanguage();
  onLangChange(applyLanguage);

  // 드래그 앤 드롭: 화면 어디에 놓아도 받는다
  const isFileDrag = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
  root.addEventListener('dragover', (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    root.classList.add('dragging');
  });
  root.addEventListener('dragleave', (event) => {
    // 자식 요소 사이를 지날 때도 dragleave 가 오므로 홈 밖으로 나갔을 때만 닫는다
    const next = event.relatedTarget as Node | null;
    if (!next || !root.contains(next)) root.classList.remove('dragging');
  });
  root.addEventListener('drop', (event) => {
    event.preventDefault();
    root.classList.remove('dragging');
    const file = event.dataTransfer?.files[0];
    if (file) options.onFile(file);
  });
  // 실행 중 게임 위로 파일을 떨어뜨렸을 때 브라우저가 페이지를 바꾸지 않게
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());

  return {
    element: root,
    show: () => {
      root.hidden = false;
    },
    hide: () => {
      root.hidden = true;
    },
    status: (message, kind = 'info') => {
      clearTimeout(statusTimer);
      status.textContent = message;
      status.hidden = message === '';
      status.classList.toggle('error', kind === 'error');
      // 안내 문구가 홈에 계속 남지 않도록 (예: "Snake 을(를) 지웠습니다")
      if (message !== '' && kind === 'info') {
        statusTimer = setTimeout(() => {
          status.hidden = true;
        }, STATUS_INFO_MS);
      }
    },
    pickFile: () => input.click(),
    setLibrary: (next) => {
      entries = next;
      render();
    },
    setSuspended: (next) => {
      suspended = next;
      render();
    },
  };
}
