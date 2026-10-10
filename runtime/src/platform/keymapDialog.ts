/**
 * Config → 키 배치…: 기기 그림 둘레의 버튼 칸마다 키를 다시 지정한다 (칸 배치는 keymapLayout.ts, 그림은 keymapDevice.ts).
 *   칸의 키를 누르면 "?" 가 되고, 다음 키가 그 버튼에 붙는다 (다른 버튼에서는 빠진다). Esc 는 받기 취소.
 *   아래 콘솔 줄: 홈 키는 바꿀 수 있고 Tab · F11 은 콘솔 예약이라 고정. "기본값으로" 는 전체를 되돌린다.
 *   바뀐 값은 바로 저장·적용된다.
 */
import type { DsButton } from '@nghslab/nori-sdk';
import { RESERVED_KEYS } from '../config';
import {
  assignHomeKey,
  assignKey,
  codesFor,
  currentConsoleKeys,
  keyLabel,
  resetKeymap,
} from '../console/keymap';
import { t } from '../i18n';
import { showDialog } from './dialogs';
import { createKeymapDevice } from './keymapDevice';
import { PAD_SLOTS } from './keymapLayout';

type Target = { kind: 'button'; button: DsButton; label: string } | { kind: 'home' };

interface Slot {
  root: HTMLElement;
  key: HTMLButtonElement;
}

function createSlot(label: string): Slot {
  const root = document.createElement('div');
  root.className = 'keymap-slot';
  const name = document.createElement('span');
  name.className = 'keymap-slot-label';
  name.textContent = label;
  const key = document.createElement('button');
  key.type = 'button';
  key.className = 'keymap-key';
  root.append(name, key);
  return { root, key };
}

function codesOf(target: Target): string[] {
  return target.kind === 'home' ? [currentConsoleKeys().home] : codesFor(target.button);
}

function targetName(target: Target): string {
  return target.kind === 'home' ? t('keymap.home') : target.label;
}

export function showKeymapDialog(): void {
  const content = document.createElement('div');
  content.className = 'console-dialog-body keymap-dialog';
  const pad = document.createElement('div');
  pad.className = 'keymap-pad';
  const device = createKeymapDevice();
  pad.append(device.element);
  const hotkeys = document.createElement('div');
  hotkeys.className = 'keymap-hotkeys';
  const note = document.createElement('p');
  note.className = 'keymap-note';

  const bindings: { target: Target; key: HTMLButtonElement }[] = [];
  let listening: Target | undefined;
  let cancel: (() => void) | undefined;

  const highlightOf = (target: Target | undefined) =>
    target?.kind === 'button' ? target.button : undefined;

  const bind = (target: Target, slot: Slot) => {
    bindings.push({ target, key: slot.key });
    slot.key.addEventListener('click', () => startListening(target, slot.key));
    slot.root.addEventListener('mouseenter', () => device.highlight(highlightOf(target)));
    slot.root.addEventListener('mouseleave', () => device.highlight(highlightOf(listening)));
  };

  for (const { button, label, area } of PAD_SLOTS) {
    const slot = createSlot(label);
    slot.root.style.gridArea = area;
    pad.append(slot.root);
    bind({ kind: 'button', button, label }, slot);
  }

  const consoleLabel = document.createElement('span');
  consoleLabel.className = 'keymap-hotkeys-title';
  consoleLabel.textContent = t('keymap.console');
  hotkeys.append(consoleLabel);
  const home = createSlot(t('keymap.home'));
  hotkeys.append(home.root);
  bind({ kind: 'home' }, home);
  for (const [label, code] of [
    [t('keymap.speed'), RESERVED_KEYS.speed],
    [t('keymap.fullscreen'), RESERVED_KEYS.fullscreen],
  ] as const) {
    const fixed = createSlot(label);
    fixed.key.textContent = keyLabel(code);
    fixed.key.disabled = true;
    fixed.key.title = t('keymap.reserved');
    hotkeys.append(fixed.root);
  }

  const showNote = (text: string, warn = false) => {
    note.textContent = text;
    note.classList.toggle('warn', warn);
  };

  const refresh = () => {
    for (const { target, key } of bindings) {
      const codes = codesOf(target).filter(Boolean);
      key.textContent = codes.map(keyLabel).join(' ') || '-';
      key.title = codes.map(keyLabel).join(' · ');
    }
  };

  const startListening = (target: Target, key: HTMLButtonElement) => {
    cancel?.();
    listening = target;
    key.classList.add('listening');
    key.textContent = '?';
    device.highlight(highlightOf(target));
    showNote(t('keymap.pressFor', { button: targetName(target) }));
    dialog.dataset.listening = '1';
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (event.code === 'Escape') {
        stop();
        showNote(t('keymap.note'));
        return;
      }
      const ok =
        target.kind === 'home' ? assignHomeKey(event.code) : assignKey(target.button, event.code);
      stop();
      if (ok) showNote(t('keymap.note'));
      else showNote(t('keymap.reservedKey', { key: keyLabel(event.code) }), true);
    };
    const stop = () => {
      window.removeEventListener('keydown', handler, true);
      delete dialog.dataset.listening;
      key.classList.remove('listening');
      listening = undefined;
      cancel = undefined;
      device.highlight(undefined);
      refresh();
    };
    cancel = stop;
    window.addEventListener('keydown', handler, true);
  };

  const actions = document.createElement('div');
  actions.className = 'console-dialog-actions';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'console-button';
  reset.textContent = t('keymap.reset');
  reset.addEventListener('click', () => {
    cancel?.();
    resetKeymap();
    refresh();
    showNote(t('keymap.note'));
  });
  actions.append(reset);
  content.append(pad, hotkeys, note, actions);

  const dialog = showDialog(t('keymap.title'), content);
  dialog.addEventListener('close', () => cancel?.(), { once: true });
  showNote(t('keymap.note'));
  refresh();
}
