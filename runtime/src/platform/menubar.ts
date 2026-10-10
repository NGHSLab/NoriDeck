/**
 * 타이틀바 왼쪽의 메뉴바 (파일 · 도구 · 보기 · 도움말) — 순수 DOM 드롭다운.
 * 메뉴 내용은 menus.ts 가 정의하고, 여기는 열기/닫기·키보드 차단만 담당한다.
 * 메뉴가 열려 있는 동안 키 입력은 게임(콘솔 입력)으로 가지 않는다.
 * 항목에 submenu 가 있으면 그 위에 올렸을 때 오른쪽으로 2단계 목록이 열린다 (창 배율 등).
 */
export interface MenuItem {
  label: string;
  /** 오른쪽에 회색으로 표시되는 단축키 안내 */
  shortcut?: string;
  disabled?: boolean;
  /** 체크 표시 여부 (메뉴를 열 때마다 평가) */
  checked?: () => boolean;
  onSelect?: () => void;
  /** 오른쪽으로 열리는 하위 목록. 있으면 onSelect 대신 이걸 쓴다 */
  submenu?: () => MenuEntry[];
}

export type MenuEntry = MenuItem | { separator: true };

export interface MenuDefinition {
  title: string;
  /** 있으면 제목 글자 대신 이 SVG 아이콘 버튼으로 (title 은 툴팁). 설정 톱니 등 */
  icon?: string;
  /** 열 때마다 호출되므로 현재 상태를 반영할 수 있다 */
  items: () => MenuEntry[];
}

function isSeparator(entry: MenuEntry): entry is { separator: true } {
  return 'separator' in entry;
}

export function installMenuBar(menus: readonly MenuDefinition[]): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'menubar';
  bar.setAttribute('role', 'menubar');

  let openIndex = -1;
  let dropdown: HTMLElement | null = null;
  let submenu: HTMLElement | null = null;
  const titles: HTMLButtonElement[] = [];

  const closeSubmenu = () => {
    submenu?.remove();
    submenu = null;
    dropdown?.querySelector('.menu-item.open')?.classList.remove('open');
  };
  const close = () => {
    closeSubmenu();
    dropdown?.remove();
    dropdown = null;
    if (openIndex >= 0) titles[openIndex]?.classList.remove('open');
    openIndex = -1;
  };

  const renderItems = (entries: MenuEntry[], host: HTMLElement) => {
    host.replaceChildren();
    for (const entry of entries) {
      if (isSeparator(entry)) {
        const separator = document.createElement('div');
        separator.className = 'menu-separator';
        host.append(separator);
        continue;
      }
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu-item';
      item.setAttribute('role', 'menuitem');
      item.disabled = Boolean(entry.disabled);
      const check = document.createElement('span');
      check.className = 'menu-check';
      check.textContent = entry.checked?.() ? '✓' : '';
      const label = document.createElement('span');
      label.className = 'menu-label';
      label.textContent = entry.label;
      const shortcut = document.createElement('span');
      shortcut.className = 'menu-shortcut';
      shortcut.textContent = entry.submenu ? '▸' : (entry.shortcut ?? '');
      item.append(check, label, shortcut);
      const { submenu: children } = entry;
      if (children) {
        // 하위 목록은 올리거나 클릭하면 오른쪽으로 열리고, 같은 단계의 다른 항목에 올리면 닫힌다
        const openChildren = () => {
          if (item.classList.contains('open')) return;
          closeSubmenu();
          item.classList.add('open');
          submenu = document.createElement('div');
          submenu.className = 'menu-dropdown menu-submenu';
          submenu.setAttribute('role', 'menu');
          renderItems(children(), submenu);
          const rect = item.getBoundingClientRect();
          submenu.style.left = `${Math.round(rect.right)}px`;
          submenu.style.top = `${Math.round(rect.top) - 4}px`;
          document.body.append(submenu);
        };
        item.addEventListener('pointerenter', openChildren);
        item.addEventListener('click', openChildren);
      } else {
        if (host === dropdown) item.addEventListener('pointerenter', closeSubmenu);
        item.addEventListener('click', () => {
          close();
          entry.onSelect?.();
        });
      }
      host.append(item);
    }
  };

  const open = (index: number) => {
    const menu = menus[index];
    const title = titles[index];
    if (!menu || !title) return;
    close();
    openIndex = index;
    title.classList.add('open');
    dropdown = document.createElement('div');
    dropdown.className = 'menu-dropdown';
    dropdown.setAttribute('role', 'menu');
    renderItems(menu.items(), dropdown);
    const rect = title.getBoundingClientRect();
    dropdown.style.left = `${Math.round(rect.left)}px`;
    dropdown.style.top = `${Math.round(rect.bottom)}px`;
    document.body.append(dropdown);
  };

  menus.forEach((menu, index) => {
    const title = document.createElement('button');
    title.type = 'button';
    title.className = 'menubar-title';
    if (menu.icon) {
      title.classList.add('icon');
      title.innerHTML = menu.icon;
      title.title = menu.title;
      title.setAttribute('aria-label', menu.title);
    } else {
      title.textContent = menu.title;
    }
    title.addEventListener('click', () => (openIndex === index ? close() : open(index)));
    // 하나가 열려 있으면 다른 제목 위로 지나가기만 해도 바뀐다
    title.addEventListener('pointerenter', () => {
      if (openIndex >= 0 && openIndex !== index) open(index);
    });
    titles.push(title);
    bar.append(title);
  });

  document.addEventListener('pointerdown', (event) => {
    if (openIndex < 0) return;
    const target = event.target as Node | null;
    if (target && (bar.contains(target) || dropdown?.contains(target) || submenu?.contains(target)))
      return;
    close();
  });
  // 열려 있는 동안 키 입력은 메뉴가 먹는다 (Esc 로 닫기). 콘솔 입력은 window 버블 단계라 여기서 끊긴다
  window.addEventListener(
    'keydown',
    (event) => {
      if (openIndex < 0) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      if (event.key === 'Escape') close();
    },
    true,
  );
  window.addEventListener('blur', close);
  window.addEventListener('resize', close);

  return bar;
}
