/**
 * 홈 라이브러리의 동작 (데스크톱): 가져오기 · 실행/이어서 · 게임 종료 · 삭제 · 폴더 열기 · 목록 갱신,
 * 카트리지 내보내기 · 세이브 백업(zip)/복원/지우기.
 * 브리지 호출(library.ts)과 세션(session.ts), 홈 화면(home.ts)을 잇는 얇은 층이다.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { HomeHandle } from './home';
import { t } from './i18n';
import { importNoriFile, loadLibraryCart } from './library';
import type { DesktopBridge, DesktopLibrary, DesktopLibraryEntry } from './platform/bridge';
import { showConfirmDialog } from './platform/dialogs';
import type { ConsoleSession } from './session';

export interface LibraryActions {
  refresh(): Promise<void>;
  importFile(file: File): Promise<void>;
  /** 타일 클릭: 뒤에 일시정지된 게임이면 이어서, 아니면 새로 실행 */
  runEntry(item: DesktopLibraryEntry): Promise<void>;
  closeGame(item: DesktopLibraryEntry): Promise<void>;
  remove(item: DesktopLibraryEntry): Promise<void>;
  openFolder(item: DesktopLibraryEntry): void;
  exportCart(item: DesktopLibraryEntry): Promise<void>;
  backupSaves(item: DesktopLibraryEntry): Promise<void>;
  restoreSaves(item: DesktopLibraryEntry): Promise<void>;
  clearSaves(item: DesktopLibraryEntry): Promise<void>;
}

/** 파일 선택창 (세이브 백업 zip) */
function pickFile(accept: string): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files?.[0]));
    input.addEventListener('cancel', () => resolve(undefined));
    input.click();
  });
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
}

export function createLibraryActions(
  bridge: DesktopBridge,
  session: ConsoleSession,
  home: HomeHandle,
): LibraryActions {
  const library: DesktopLibrary = bridge.library;
  const fail = (prefix: string, error: unknown) =>
    home.status(`${prefix}: ${String(error instanceof Error ? error.message : error)}`, 'error');

  const refresh = async () => {
    const entries = await library.list().catch((error: unknown) => {
      fail(t('err.library'), error);
      return [] as DesktopLibraryEntry[];
    });
    home.setLibrary(entries);
  };

  const importFile = async (file: File) => {
    home.status(t('status.importing', { name: file.name }));
    try {
      const entry = await importNoriFile(library, file);
      await refresh();
      home.status(t('status.imported', { title: entry.title, version: entry.version }));
    } catch (error) {
      fail(file.name, error);
      throw error;
    }
  };

  const runEntry = async (item: DesktopLibraryEntry) => {
    if (session.isSuspended(item.id) && session.resume()) return;
    home.status(t('status.loading', { title: item.title }));
    try {
      const entry = await loadLibraryCart(library, item.id);
      await session.run(entry);
    } catch (error) {
      // session.run 은 자기 오류를 홈에 이미 표시했다. 로드 실패만 여기서
      if (!session.current) fail(item.title, error);
    }
  };

  const closeGame = async (item: DesktopLibraryEntry) => {
    if (!session.isSuspended(item.id)) return;
    const ok = await showConfirmDialog(
      t('close.title'),
      t('close.message', { title: item.title }),
      t('close.confirm'),
    );
    if (!ok) return;
    session.eject();
    home.status(t('status.closed', { title: item.title }));
  };

  const remove = async (item: DesktopLibraryEntry) => {
    const ok = await showConfirmDialog(
      t('remove.title'),
      t('remove.message', { title: item.title, version: item.version }),
      t('remove.confirm'),
    );
    if (!ok) return;
    if (session.isSuspended(item.id)) session.eject();
    try {
      await library.remove(item.id);
      await refresh();
      home.status(t('status.removed', { title: item.title }));
    } catch (error) {
      fail(item.title, error);
    }
  };

  const openFolder = (item: DesktopLibraryEntry) => {
    void library.openFolder(item.id).catch((error: unknown) => fail(t('err.folder'), error));
  };

  const exportCart = async (item: DesktopLibraryEntry) => {
    try {
      const saved = await library.export(item.id);
      if (saved) home.status(t('status.exported', { path: saved }));
    } catch (error) {
      fail(item.title, error);
    }
  };

  /** 세이브 슬롯들을 <slot>.json 으로 담은 zip 을 "다른 이름으로 저장" */
  const backupSaves = async (item: DesktopLibraryEntry) => {
    try {
      const slots = await bridge.save.list(item.id);
      if (slots.length === 0) {
        home.status(t('status.noSaves', { title: item.title }));
        return;
      }
      const files: Record<string, Uint8Array> = {};
      for (const slot of slots) {
        const raw = await bridge.save.read(item.id, slot);
        if (raw !== null) files[`${slot}.json`] = strToU8(raw);
      }
      const bytes = zipSync(files, { level: 6 });
      const saved = await bridge.system.saveFile({
        defaultName: `${item.id}-saves-${stamp()}.zip`,
        extensions: ['zip'],
        bytes,
      });
      if (saved) home.status(t('status.backedUp', { path: saved }));
    } catch (error) {
      fail(item.title, error);
    }
  };

  /** 백업 zip 의 <slot>.json 들을 세이브로 덮어쓴다 (확인 후) */
  const restoreSaves = async (item: DesktopLibraryEntry) => {
    const file = await pickFile('.zip');
    if (!file) return;
    try {
      const unzipped = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const slots: [string, string][] = [];
      for (const [name, data] of Object.entries(unzipped)) {
        const match = /^([a-zA-Z0-9_-]{1,32})\.json$/.exec(name);
        if (match?.[1]) slots.push([match[1], strFromU8(data)]);
      }
      if (slots.length === 0) {
        home.status(t('err.restore'), 'error');
        return;
      }
      const ok = await showConfirmDialog(
        t('restore.title'),
        t('restore.message', { title: item.title, slots: slots.map(([slot]) => slot).join(', ') }),
        t('restore.confirm'),
      );
      if (!ok) return;
      for (const [slot, raw] of slots) await bridge.save.write(item.id, slot, raw);
      home.status(t('status.restored', { count: slots.length }));
    } catch (error) {
      fail(file.name, error);
    }
  };

  const clearSaves = async (item: DesktopLibraryEntry) => {
    const ok = await showConfirmDialog(
      t('clearSaves.title'),
      t('clearSaves.message', { title: item.title }),
      t('clearSaves.confirm'),
    );
    if (!ok) return;
    try {
      await bridge.save.clear(item.id);
      home.status(t('status.savesCleared', { title: item.title }));
    } catch (error) {
      fail(item.title, error);
    }
  };

  return {
    refresh,
    importFile,
    runEntry,
    closeGame,
    remove,
    openFolder,
    exportCart,
    backupSaves,
    restoreSaves,
    clearSaves,
  };
}
