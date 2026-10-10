/**
 * 콘솔 설정 (소리 크기 · 배속). localStorage `norideck.settings` 에 남고, 바꾸면 구독자에게 알린다.
 * 키 배치는 keymap.ts, 언어는 i18n.ts 가 따로 관리한다.
 */
import { DEFAULT_FAST_SPEED, FAST_SPEEDS } from '../config';

export interface ConsoleSettings {
  /** 마스터 볼륨 0~1 */
  volume: number;
  /** Tab(배속 토글)이 켤 배속. FAST_SPEEDS 중 하나 */
  fastSpeed: number;
}

const STORAGE_KEY = 'norideck.settings';

export const DEFAULT_SETTINGS: Readonly<ConsoleSettings> = {
  volume: 1,
  fastSpeed: DEFAULT_FAST_SPEED,
};

/** 저장된 값(또는 아무 값)을 유효한 설정으로 정리한다. 이상한 값은 기본값으로 */
export function normalizeSettings(raw: unknown): ConsoleSettings {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const volume =
    typeof obj.volume === 'number' && Number.isFinite(obj.volume)
      ? Math.min(1, Math.max(0, obj.volume))
      : DEFAULT_SETTINGS.volume;
  const fastSpeed =
    typeof obj.fastSpeed === 'number' && (FAST_SPEEDS as readonly number[]).includes(obj.fastSpeed)
      ? obj.fastSpeed
      : DEFAULT_SETTINGS.fastSpeed;
  return { volume, fastSpeed };
}

function load(): ConsoleSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeSettings(JSON.parse(raw));
  } catch {
    // 저장소가 없거나 깨졌으면 기본값
  }
  return { ...DEFAULT_SETTINGS };
}

let state = load();
const listeners = new Set<(settings: ConsoleSettings) => void>();

export function currentSettings(): ConsoleSettings {
  return { ...state };
}

export function updateSettings(patch: Partial<ConsoleSettings>): void {
  state = normalizeSettings({ ...state, ...patch });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 실패는 무시 (이번 실행에만 적용)
  }
  for (const listener of listeners) listener(currentSettings());
}

export function onSettingsChange(listener: (settings: ConsoleSettings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
