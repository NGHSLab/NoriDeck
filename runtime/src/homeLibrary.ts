/**
 * 홈 화면의 라이브러리 캐러셀: 가져온 카트리지 한 장을 가운데 크게 보이고, 둘 이상이면 좌우로 넘긴다.
 *   넘기기  ◀ ▶ 버튼 클릭 · ← → (또는 A D) 키 · 마우스 휠
 *   실행    커버 클릭 · "시작" 버튼 · Enter 또는 H(A 버튼) 키. 뒤에 일시정지된 게임이면 마지막 화면을 보이고 "이어서"
 *   옵션    "옵션" 버튼 · K(X 버튼) 키 · 오른쪽 클릭 → 정보 · 폴더 열기 · (일시정지 중이면) 게임 종료 · 삭제
 * 데이터는 home.ts 가 넣어 주고(render), 동작은 콜백으로 밖(libraryActions.ts)에 맡긴다.
 */
import { currentKeymap } from './console/keymap';
import { t } from './i18n';
import type { DesktopLibraryEntry } from './platform/bridge';
import type { SuspendedCart } from './session';

export interface LibraryViewOptions {
  onRun(entry: DesktopLibraryEntry): void;
  onInfo(entry: DesktopLibraryEntry): void;
  onOpenFolder(entry: DesktopLibraryEntry): void;
  /** cart.nori 를 원래 이름으로 다른 곳에 저장 */
  onExport(entry: DesktopLibraryEntry): void;
  onBackupSaves(entry: DesktopLibraryEntry): void;
  onRestoreSaves(entry: DesktopLibraryEntry): void;
  onClearSaves(entry: DesktopLibraryEntry): void;
  /** 뒤에 일시정지된 게임을 완전히 종료 */
  onClose(entry: DesktopLibraryEntry): void;
  onRemove(entry: DesktopLibraryEntry): void;
}

export interface LibraryViewHandle {
  element: HTMLElement;
  render(entries: readonly DesktopLibraryEntry[], suspended?: SuspendedCart): void;
}

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

const WHEEL_COOLDOWN_MS = 350;
/** 옵션 버튼 톱니 아이콘 (Feather Icons "settings", MIT) */
const GEAR_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

export function createLibraryCarousel(options: LibraryViewOptions): LibraryViewHandle {
  const root = el('div', 'home-carousel');
  root.setAttribute('role', 'listbox');
  root.tabIndex = -1;

  const prev = el('button', 'home-nav prev', '◀');
  prev.type = 'button';
  const next = el('button', 'home-nav next', '▶');
  next.type = 'button';
  const stage = el('div', 'home-stage');
  const row = el('div', 'home-row');
  row.append(prev, stage, next);
  const dots = el('div', 'home-dots');
  root.append(row, dots);

  let entries: readonly DesktopLibraryEntry[] = [];
  let suspended: SuspendedCart | undefined;
  let index = 0;
  let lastWheel = 0;
  /** 현재 카드의 옵션 버튼 (K 키가 연다) */
  let optionsButton: HTMLButtonElement | undefined;

  // ---- 카트리지 메뉴 (정보 · 폴더 열기 · 게임 종료 · 삭제) ----
  let menu: HTMLElement | null = null;
  const closeMenu = () => {
    menu?.remove();
    menu = null;
  };
  const openMenu = (entry: DesktopLibraryEntry, x: number, y: number) => {
    closeMenu();
    menu = el('div', 'menu-dropdown home-tile-menu');
    menu.setAttribute('role', 'menu');
    // [라벨, 동작, 클래스, 앞에 구분선]
    const items: (readonly [string, () => void, string?, boolean?])[] = [
      [t('car.info'), () => options.onInfo(entry)],
      [t('car.folder'), () => options.onOpenFolder(entry)],
      [t('car.export'), () => options.onExport(entry)],
      [t('car.backup'), () => options.onBackupSaves(entry), undefined, true],
      [t('car.restore'), () => options.onRestoreSaves(entry)],
      [t('car.clearSaves'), () => options.onClearSaves(entry)],
    ];
    if (suspended?.id === entry.id)
      items.push([t('car.close'), () => options.onClose(entry), undefined, true]);
    items.push([t('car.remove'), () => options.onRemove(entry), 'danger', true]);
    items.forEach(([label, action, extra, separator]) => {
      if (separator) menu?.append(el('div', 'menu-separator'));
      const item = el('button', extra ? `menu-item ${extra}` : 'menu-item');
      item.type = 'button';
      item.setAttribute('role', 'menuitem');
      item.append(el('span', 'menu-check'), el('span', 'menu-label', label));
      item.addEventListener('click', () => {
        closeMenu();
        action();
      });
      menu?.append(item);
    });
    menu.style.left = `${Math.round(x)}px`;
    menu.style.top = `${Math.round(y)}px`;
    document.body.append(menu);
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${Math.round(x - rect.width)}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${Math.round(y - rect.height)}px`;
  };
  document.addEventListener('pointerdown', (event) => {
    if (menu && !menu.contains(event.target as Node)) closeMenu();
  });
  window.addEventListener('blur', closeMenu);

  // ---- 현재 카트리지 그리기 ----
  const current = (): DesktopLibraryEntry | undefined => entries[index];

  const card = (entry: DesktopLibraryEntry): HTMLElement => {
    const paused = suspended?.id === entry.id;
    const tile = el('div', paused ? 'home-tile paused' : 'home-tile');
    const cover = el('button', 'home-tile-cover');
    cover.type = 'button';
    cover.title = t(paused ? 'car.resume' : 'car.run', { title: entry.title });
    const imageUrl = (paused ? suspended?.snapshot : undefined) ?? entry.coverUrl;
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = '';
      image.draggable = false;
      cover.append(image);
    } else {
      cover.append(el('div', 'home-tile-placeholder', entry.title.slice(0, 1).toUpperCase()));
    }
    if (paused) cover.append(el('div', 'home-tile-badge', t('car.paused')));
    cover.addEventListener('click', () => options.onRun(entry));

    const meta = el('div', 'home-tile-meta');
    const title = el('span', 'home-tile-title', entry.title);
    title.title = `${entry.title} v${entry.version}`;
    meta.append(title, el('span', 'home-tile-version', `v${entry.version}`));

    // 게임기 홈처럼 커버 아래에 시작(이어서) · 옵션 버튼
    const actions = el('div', 'home-tile-actions');
    const start = el('button', 'home-tile-start', t(paused ? 'car.resumeBtn' : 'car.start'));
    start.type = 'button';
    start.addEventListener('click', () => options.onRun(entry));
    const more = el('button', 'home-tile-options');
    more.type = 'button';
    more.innerHTML = GEAR_ICON;
    more.title = t('car.options');
    more.setAttribute('aria-label', t('car.options'));
    more.addEventListener('click', (event) => {
      event.stopPropagation();
      const rect = more.getBoundingClientRect();
      openMenu(entry, rect.left, rect.bottom + 4);
    });
    actions.append(start, more);
    optionsButton = more;

    tile.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openMenu(entry, event.clientX, event.clientY);
    });
    tile.append(cover, meta, actions);
    return tile;
  };

  const draw = (direction: -1 | 0 | 1) => {
    closeMenu();
    prev.title = t('car.prev');
    next.title = t('car.next');
    const entry = current();
    stage.replaceChildren();
    if (!entry) return;
    const tile = card(entry);
    if (direction !== 0) {
      tile.classList.add(direction > 0 ? 'slide-from-right' : 'slide-from-left');
      requestAnimationFrame(() => tile.classList.remove('slide-from-right', 'slide-from-left'));
    }
    stage.append(tile);

    const many = entries.length > 1;
    prev.hidden = !many;
    next.hidden = !many;
    // 끝에서는 그쪽 버튼을 감춘다 (자리는 유지). 맨 앞은 ▶ 만, 맨 뒤는 ◀ 만
    prev.classList.toggle('edge', index === 0);
    next.classList.toggle('edge', index === entries.length - 1);
    dots.replaceChildren(
      ...entries.map((_, i) => {
        const dot = el('button', i === index ? 'home-dot active' : 'home-dot');
        dot.type = 'button';
        dot.setAttribute('aria-label', `${i + 1} / ${entries.length}`);
        dot.addEventListener('click', () => go(i - index));
        return dot;
      }),
    );
    dots.hidden = !many;
  };

  /** 넘기기. 끝에서는 더 가지 않는다 (순환 없음) */
  const go = (delta: number) => {
    if (entries.length < 2 || delta === 0) return;
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    index = target;
    draw(delta > 0 ? 1 : -1);
  };

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  root.addEventListener('wheel', (event) => {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(delta) < 4) return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheel < WHEEL_COOLDOWN_MS) return;
    lastWheel = now;
    go(delta > 0 ? 1 : -1);
  });
  // 홈이 보일 때만 키보드로 넘기고 실행한다 (게임 중에는 콘솔 입력이 키를 쓴다). 키 배치를 따른다
  window.addEventListener('keydown', (event) => {
    if (!root.isConnected || root.closest('#home[hidden]') || entries.length === 0) return;
    if (document.querySelector('dialog[open], .menu-dropdown')) return;
    const button = currentKeymap()[event.code];
    const key =
      button === 'LEFT' || button === 'RIGHT' || button === 'A' || button === 'X'
        ? button
        : event.code === 'ArrowLeft'
          ? 'LEFT'
          : event.code === 'ArrowRight'
            ? 'RIGHT'
            : event.code === 'Enter'
              ? 'A'
              : event.code;
    switch (key) {
      case 'LEFT':
        go(-1);
        break;
      case 'RIGHT':
        go(1);
        break;
      case 'A': {
        const entry = current();
        if (entry) options.onRun(entry);
        break;
      }
      case 'X': {
        const entry = current();
        if (entry && optionsButton) {
          const rect = optionsButton.getBoundingClientRect();
          openMenu(entry, rect.left, rect.bottom + 4);
        }
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  });

  return {
    element: root,
    render: (nextEntries, nextSuspended) => {
      const keep = current()?.id;
      const suspendedChanged = nextSuspended?.id !== suspended?.id;
      suspended = nextSuspended;
      // 실행 중(일시정지)인 게임이 맨 앞, 나머지는 라이브러리 순서(가져온 순)
      entries = [...nextEntries].sort((a, b) => {
        const pa = a.id === suspended?.id ? 0 : 1;
        const pb = b.id === suspended?.id ? 0 : 1;
        return pa - pb;
      });
      // 뒤에 남은 게임이 새로 생겼으면 그 카드를 앞에 둔다. 아니면 보던 카드를 유지
      const focus = suspendedChanged && nextSuspended ? nextSuspended.id : keep;
      const found = focus ? entries.findIndex((entry) => entry.id === focus) : -1;
      index = found >= 0 ? found : Math.min(index, Math.max(0, entries.length - 1));
      draw(0);
    },
  };
}
