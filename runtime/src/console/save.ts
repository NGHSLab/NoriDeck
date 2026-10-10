import type { ConsoleSave } from '@nghslab/nori-sdk';
import { CONSOLE_NAME } from '../config';

const DEFAULT_SLOT = 'main';

/**
 * 카트리지별 세이브. 데스크톱은 브리지를 통해 파일(saves/<cartId>/<slot>.json),
 * 브라우저는 localStorage, 둘 다 안 되면 메모리.
 */
export function createSave(cartId: string): ConsoleSave {
  const bridge = window.norideck;
  if (bridge?.isDesktop) {
    return {
      read: (slot = DEFAULT_SLOT) => bridge.save.read(cartId, slot),
      write: (data, slot = DEFAULT_SLOT) => bridge.save.write(cartId, slot, data),
      remove: (slot = DEFAULT_SLOT) => bridge.save.remove(cartId, slot),
      list: () => bridge.save.list(cartId),
    };
  }

  const prefix = `${CONSOLE_NAME}:save:${cartId}:`;
  const storage = localStorageOrNull();
  if (storage) {
    return {
      read: async (slot = DEFAULT_SLOT) => storage.getItem(prefix + slot),
      write: async (data, slot = DEFAULT_SLOT) => storage.setItem(prefix + slot, data),
      remove: async (slot = DEFAULT_SLOT) => storage.removeItem(prefix + slot),
      list: async () =>
        Object.keys(storage)
          .filter((key) => key.startsWith(prefix))
          .map((key) => key.slice(prefix.length)),
    };
  }

  const memory = new Map<string, string>();
  return {
    read: async (slot = DEFAULT_SLOT) => memory.get(slot) ?? null,
    write: async (data, slot = DEFAULT_SLOT) => {
      memory.set(slot, data);
    },
    remove: async (slot = DEFAULT_SLOT) => {
      memory.delete(slot);
    },
    list: async () => [...memory.keys()],
  };
}

function localStorageOrNull(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = `${CONSOLE_NAME}:probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}
