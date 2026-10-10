/**
 * 콘솔 대화상자 (정보, 라이브러리 카트리지 정보, 언어, 확인). 키 배치는 keymapDialog.ts.
 * <dialog> 를 쓰고, 열려 있는 동안 키 입력은 게임으로 가지 않는다. 문자열은 i18n 의 t().
 */
import { NORI_FORMAT, SDK_VERSION, type CartManifest } from '@nghslab/nori-sdk';
import { CONSOLE_NAME } from '../config';
import { currentSettings, updateSettings } from '../console/settings';
import { currentLang, LANGS, setLang, t } from '../i18n';
import type { DesktopBridge, DesktopLibraryEntry } from './bridge';

function blockKeysWhileOpen(dialog: HTMLDialogElement): void {
  const handler = (event: KeyboardEvent) => {
    if (dialog.dataset.listening) return; // 키 배치 대화상자가 키를 받는 중
    event.stopImmediatePropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    }
  };
  // keyup 은 막지 않는다: 막으면 콘솔 입력이 '뗌' 을 못 봐서 대화상자를 닫은 뒤에도 버튼이 눌린 채로 남는다
  window.addEventListener('keydown', handler, true);
  dialog.addEventListener('close', () => window.removeEventListener('keydown', handler, true), {
    once: true,
  });
}

export function showDialog(title: string, content: HTMLElement): HTMLDialogElement {
  document.querySelector('dialog.console-dialog')?.remove();
  const dialog = document.createElement('dialog');
  dialog.className = 'console-dialog';

  const header = document.createElement('div');
  header.className = 'console-dialog-title';
  header.textContent = title;
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'console-dialog-close';
  closeButton.setAttribute('aria-label', t('dialog.close'));
  closeButton.textContent = '✕';
  closeButton.addEventListener('click', () => dialog.close());
  header.append(closeButton);

  dialog.append(header, content);
  dialog.addEventListener('close', () => dialog.remove());
  // 바깥(배경) 클릭으로 닫기
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.body.append(dialog);
  blockKeysWhileOpen(dialog);
  dialog.showModal();
  return dialog;
}

function table(rows: readonly (readonly [string, string])[]): HTMLTableElement {
  const element = document.createElement('table');
  element.className = 'console-table';
  for (const [key, value] of rows) {
    const row = element.insertRow();
    row.insertCell().textContent = key;
    row.insertCell().textContent = value;
  }
  return element;
}

function body(...children: HTMLElement[]): HTMLElement {
  const content = document.createElement('div');
  content.className = 'console-dialog-body';
  content.append(...children);
  return content;
}

function note(text: string): HTMLParagraphElement {
  const element = document.createElement('p');
  element.textContent = text;
  return element;
}

export async function showAboutDialog(
  bridge: DesktopBridge,
  manifest: CartManifest | undefined,
): Promise<void> {
  const version = await bridge.version().catch(() => '?');
  const dataRoot = await bridge.dataRoot().catch(() => undefined);
  const rows: (readonly [string, string])[] = [
    [CONSOLE_NAME, `v${version}`],
    ['SDK', SDK_VERSION],
    [t('about.format'), String(NORI_FORMAT)],
    [t('about.platform'), bridge.platform],
  ];
  if (dataRoot) {
    rows.push([
      t('about.dataRoot'),
      dataRoot.portable ? `${dataRoot.path} (${t('about.portable')})` : dataRoot.path,
    ]);
  }
  if (manifest) {
    rows.push(
      [t('about.cartridge'), `${manifest.title} v${manifest.version}`],
      ['ID', manifest.id],
      [
        t('about.screen'),
        `${manifest.screen.width}×${manifest.screen.height} ${manifest.screen.layout}`,
      ],
      [t('about.cartSdk'), manifest.sdkVersion],
    );
  }
  showDialog(t('about.title', { name: CONSOLE_NAME }), body(table(rows)));
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '-';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 라이브러리 카드의 "정보…" */
export function showLibraryInfoDialog(entry: DesktopLibraryEntry): void {
  const rows: (readonly [string, string])[] = [
    [t('info.title'), entry.title],
    ['ID', entry.id],
    [t('info.version'), `v${entry.version}`],
    [t('info.author'), entry.author ?? '-'],
    ['SDK', entry.sdkVersion],
    [t('about.screen'), `${entry.screen.width}×${entry.screen.height} ${entry.screen.layout}`],
    [t('info.size'), formatSize(entry.fileSize)],
    [t('info.imported'), formatDate(entry.importedAt)],
    [t('info.lastPlayed'), formatDate(entry.lastPlayedAt)],
  ];
  const children: HTMLElement[] = [table(rows)];
  if (entry.description) children.push(note(entry.description));
  showDialog(entry.title, body(...children));
}

/** 도구 → 언어…: 콘솔 UI 언어 선택 (게임 안 언어는 카트리지 몫) */
export function showLanguageDialog(): void {
  const options = document.createElement('div');
  options.className = 'lang-options';
  for (const lang of LANGS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = lang === currentLang() ? 'console-button active' : 'console-button';
    button.textContent = t(lang === 'ko' ? 'lang.ko' : 'lang.en');
    button.addEventListener('click', () => {
      setLang(lang);
      dialog.close();
    });
    options.append(button);
  }
  const dialog = showDialog(t('lang.title'), body(options, note(t('lang.note'))));
}

/** Config → 소리 크기: 슬라이더. 움직이는 즉시 마스터 볼륨에 반영되고 저장된다 */
export function showVolumeDialog(): void {
  const row = document.createElement('div');
  row.className = 'volume-row';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '5';
  slider.value = String(Math.round(currentSettings().volume * 100));
  slider.setAttribute('aria-label', t('volume.title'));
  const value = document.createElement('span');
  value.className = 'volume-value';
  const render = () => {
    const percent = Number(slider.value);
    value.textContent = percent === 0 ? t('config.mute') : `${percent}%`;
  };
  slider.addEventListener('input', () => {
    updateSettings({ volume: Number(slider.value) / 100 });
    render();
  });
  render();
  row.append(slider, value);
  showDialog(t('volume.title'), body(row, note(t('volume.note'))));
  // 키 차단은 게임으로 가는 키만 막는다(기본 동작은 남김). 슬라이더에 포커스를 주면 방향키로도 조절된다
  slider.focus();
}

/** 확인/취소 대화상자. 확인이면 true */
export function showConfirmDialog(
  title: string,
  message: string,
  confirmLabel: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    let result = false;
    const text = document.createElement('p');
    text.className = 'console-dialog-message';
    text.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'console-dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'console-button';
    cancel.textContent = t('dialog.cancel');
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'console-button danger';
    confirm.textContent = confirmLabel;
    actions.append(cancel, confirm);
    const dialog = showDialog(title, body(text, actions));
    cancel.addEventListener('click', () => dialog.close());
    confirm.addEventListener('click', () => {
      result = true;
      dialog.close();
    });
    dialog.addEventListener('close', () => resolve(result), { once: true });
    confirm.focus();
  });
}
