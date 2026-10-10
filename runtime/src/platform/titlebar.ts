/**
 * 데스크톱 전용 커스텀 타이틀바: 로고 · 메뉴바(파일 도구 보기 도움말) · 제목 · 최소화/최대화/닫기.
 * Electron 창을 프레임 없이 만들기 때문에 콘솔이 타이틀바를 그린다. 브라우저에서는 아무것도 하지 않는다.
 * 드래그 이동·더블클릭 최대화는 -webkit-app-region: drag 로 OS 가 처리한다.
 * 언어가 바뀌면 메뉴바를 다시 만들고 버튼 안내를 갈아 끼운다.
 */
import logoUrl from '../assets/logo.svg';
import { onLangChange, t } from '../i18n';
import type { DesktopWindowState } from './bridge';
import { installMenuBar } from './menubar';
import { buildMenus, type TitleBarContext } from './menus';

const ICON = {
  minimize: '<svg viewBox="0 0 10 10"><path d="M0 5.5h10"/></svg>',
  maximize: '<svg viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9"/></svg>',
  restore:
    '<svg viewBox="0 0 10 10"><path d="M2.5 2.5V0.5h7v7H7.5"/><rect x="0.5" y="2.5" width="7" height="7"/></svg>',
  close: '<svg viewBox="0 0 10 10"><path d="M0.5 0.5l9 9M9.5 0.5l-9 9"/></svg>',
} as const;

type Action = 'minimize' | 'maximize' | 'close';

function button(action: Action, icon: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.dataset.action = action;
  element.className = action;
  element.innerHTML = icon;
  return element;
}

function label(element: HTMLButtonElement, text: string): void {
  element.setAttribute('aria-label', text);
  element.title = text;
}

/** 데스크톱이면 타이틀바를 붙이고 true, 아니면 false */
export function installTitleBar(title: string, context: TitleBarContext): boolean {
  const bridge = window.norideck;
  if (!bridge) return false;

  const bar = document.createElement('div');
  bar.id = 'titlebar';

  const logo = document.createElement('img');
  logo.className = 'titlebar-logo';
  logo.src = logoUrl;
  logo.alt = '';
  logo.width = 18;
  logo.height = 18;

  let menubar = installMenuBar(buildMenus(bridge, context));

  const titleElement = document.createElement('div');
  titleElement.className = 'titlebar-title';
  titleElement.textContent = title;

  const controls = document.createElement('div');
  controls.className = 'titlebar-controls';
  const minimize = button('minimize', ICON.minimize);
  const maximize = button('maximize', ICON.maximize);
  const close = button('close', ICON.close);
  controls.append(minimize, maximize, close);

  const left = document.createElement('div');
  left.className = 'titlebar-left';
  left.append(logo, menubar);
  bar.append(left, titleElement, controls);
  document.body.prepend(bar);
  document.body.classList.add('has-titlebar');

  minimize.addEventListener('click', () => void bridge.window.minimize());
  maximize.addEventListener('click', () => void bridge.window.toggleMaximize());
  close.addEventListener('click', () => void bridge.window.close());

  let state: DesktopWindowState = { maximized: false, fullscreen: false };
  const applyLabels = () => {
    label(minimize, t('tb.minimize'));
    label(maximize, t(state.maximized ? 'tb.restore' : 'tb.maximize'));
    label(close, t('tb.close'));
  };
  const apply = (next: DesktopWindowState) => {
    state = next;
    maximize.innerHTML = state.maximized ? ICON.restore : ICON.maximize;
    applyLabels();
    // 전체화면에서는 타이틀바를 숨기고 화면을 전부 쓴다
    bar.hidden = state.fullscreen;
    document.body.classList.toggle('has-titlebar', !state.fullscreen);
    window.dispatchEvent(new Event('resize'));
  };
  applyLabels();
  bridge.window.onStateChange(apply);
  void bridge.window.getState().then(apply);

  // 언어가 바뀌면 메뉴 제목이 바뀌므로 메뉴바를 새로 만든다
  onLangChange(() => {
    const fresh = installMenuBar(buildMenus(bridge, context));
    menubar.replaceWith(fresh);
    menubar = fresh;
    applyLabels();
  });

  // 문서 제목이 바뀌면 타이틀바도 따라간다
  new MutationObserver(() => {
    titleElement.textContent = document.title;
  }).observe(document.querySelector('title') ?? document.head, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  return true;
}
