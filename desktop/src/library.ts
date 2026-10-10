/**
 * 라이브러리: 가져온 .nori 카트리지 보관소 (<데이터 루트>/games/<id>/, dataRoot.ts).
 *
 *   <id>/cart.nori    가져온 파일 그대로
 *   <id>/meta.json    목록 표시용 정보 (매니페스트 발췌 + 출처 + 가져온·실행한 시각)
 *   <id>/cover.<ext>  커버 이미지 (있을 때)
 *   <id>/saves/       세이브 (main.ts 의 세이브 IPC 가 쓴다)
 *
 * 검사(zip 구조·매니페스트·체크섬)는 런타임이 이미 마쳤다. 여기서는 형식만 다시 확인하고 파일을 보관한다.
 * 카트리지를 지워도 saves/ 는 남기므로 다시 가져오면 세이브가 이어진다.
 */
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gamesRoot } from './dataRoot';
import type {
  DesktopLibraryEntry,
  DesktopLibraryImport,
  DesktopLibraryManifest,
} from '../../runtime/src/platform/bridge';

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const CART_FILE = 'cart.nori';
const META_FILE = 'meta.json';
const SAVES_DIR = 'saves';
const COVER_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

interface LibraryMeta extends DesktopLibraryManifest {
  importedAt: string;
  lastPlayedAt?: string;
  fileSize: number;
  coverFile?: string;
  /** 어디서 왔나. 허브 다운로드는 나중에 'hub' + hub 정보가 붙는다 */
  source?: 'local' | 'hub';
  hub?: { version: string; url?: string };
}

function entryDir(id: unknown): string {
  if (typeof id !== 'string' || !SAFE_ID.test(id))
    throw new TypeError(`잘못된 카트리지 ID: ${String(id)}`);
  return path.join(gamesRoot(), id);
}

async function writeAtomic(target: string, data: Uint8Array | string): Promise<void> {
  const temp = `${target}.tmp`;
  await fs.writeFile(temp, data);
  await fs.rename(temp, target);
}

async function readMeta(dir: string): Promise<LibraryMeta | undefined> {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(dir, META_FILE), 'utf8')) as LibraryMeta;
    return typeof parsed.id === 'string' && SAFE_ID.test(parsed.id) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function coverDataUrl(dir: string, meta: LibraryMeta): Promise<string | undefined> {
  if (!meta.coverFile) return undefined;
  const mime = COVER_MIME[path.extname(meta.coverFile).toLowerCase()];
  if (!mime) return undefined;
  try {
    const data = await fs.readFile(path.join(dir, meta.coverFile));
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch {
    return undefined;
  }
}

async function toEntry(dir: string, meta: LibraryMeta): Promise<DesktopLibraryEntry> {
  const entry: DesktopLibraryEntry = {
    id: meta.id,
    title: meta.title,
    version: meta.version,
    sdkVersion: meta.sdkVersion,
    screen: meta.screen,
    importedAt: meta.importedAt,
    fileSize: meta.fileSize,
  };
  if (meta.author) entry.author = meta.author;
  if (meta.description) entry.description = meta.description;
  if (meta.homepage) entry.homepage = meta.homepage;
  if (meta.cover) entry.cover = meta.cover;
  if (meta.lastPlayedAt) entry.lastPlayedAt = meta.lastPlayedAt;
  const coverUrl = await coverDataUrl(dir, meta);
  if (coverUrl) entry.coverUrl = coverUrl;
  return entry;
}

/** 런타임이 보낸 매니페스트 발췌를 다시 확인한다 (형식만) */
function sanitizeManifest(input: unknown): DesktopLibraryManifest {
  if (typeof input !== 'object' || input === null) throw new TypeError('매니페스트가 없습니다');
  const raw = input as Record<string, unknown>;
  const text = (key: string, required = false): string | undefined => {
    const value = raw[key];
    if (typeof value === 'string' && value.length > 0 && value.length <= 2000) return value;
    if (required) throw new TypeError(`매니페스트 ${key} 이(가) 없습니다`);
    return undefined;
  };
  const id = text('id', true) ?? '';
  if (!SAFE_ID.test(id)) throw new TypeError(`잘못된 카트리지 ID: ${id}`);
  const screen = raw.screen as Record<string, unknown> | undefined;
  if (
    !screen ||
    typeof screen.width !== 'number' ||
    typeof screen.height !== 'number' ||
    typeof screen.layout !== 'string'
  ) {
    throw new TypeError('매니페스트 screen 이 올바르지 않습니다');
  }
  const manifest: DesktopLibraryManifest = {
    id,
    title: text('title', true) ?? '',
    version: text('version', true) ?? '',
    sdkVersion: text('sdkVersion', true) ?? '',
    screen: { width: screen.width, height: screen.height, layout: screen.layout },
  };
  for (const key of ['author', 'description', 'homepage', 'cover'] as const) {
    const value = text(key);
    if (value) manifest[key] = value;
  }
  return manifest;
}

export async function listLibrary(): Promise<DesktopLibraryEntry[]> {
  const root = gamesRoot();
  await fs.mkdir(root, { recursive: true });
  const entries: DesktopLibraryEntry[] = [];
  for (const dirent of await fs.readdir(root, { withFileTypes: true })) {
    if (!dirent.isDirectory() || !SAFE_ID.test(dirent.name)) continue;
    const dir = path.join(root, dirent.name);
    // meta.json 이 없는 폴더(세이브만 남은 카트리지)는 목록에 없다
    const meta = await readMeta(dir);
    if (meta && meta.id === dirent.name) entries.push(await toEntry(dir, meta));
  }
  // 가져온 순서 (책장처럼 새 카트리지는 뒤에 붙는다). 실행 중인 게임을 앞에 두는 것은 홈이 한다
  return entries.sort((a, b) => a.importedAt.localeCompare(b.importedAt));
}

export async function importCart(input: DesktopLibraryImport): Promise<DesktopLibraryEntry> {
  const manifest = sanitizeManifest(input.manifest);
  if (!(input.bytes instanceof Uint8Array) || input.bytes.byteLength === 0)
    throw new TypeError('.nori 내용이 없습니다');
  const dir = entryDir(manifest.id);
  await fs.mkdir(dir, { recursive: true });
  const previous = await readMeta(dir);

  await writeAtomic(path.join(dir, CART_FILE), input.bytes);
  for (const name of await fs.readdir(dir)) {
    if (name.startsWith('cover.')) await fs.unlink(path.join(dir, name));
  }
  let coverFile: string | undefined;
  if (input.cover && input.cover.bytes instanceof Uint8Array) {
    const ext = path.extname(String(input.cover.name)).toLowerCase();
    if (COVER_MIME[ext]) {
      coverFile = `cover${ext}`;
      await fs.writeFile(path.join(dir, coverFile), input.cover.bytes);
    }
  }

  const meta: LibraryMeta = {
    ...manifest,
    source: 'local',
    importedAt: new Date().toISOString(),
    fileSize: input.bytes.byteLength,
  };
  if (previous?.lastPlayedAt) meta.lastPlayedAt = previous.lastPlayedAt;
  if (coverFile) meta.coverFile = coverFile;
  await writeAtomic(path.join(dir, META_FILE), JSON.stringify(meta, null, 2));
  return toEntry(dir, meta);
}

export async function readCart(id: unknown): Promise<Uint8Array> {
  const dir = entryDir(id);
  const data = await fs.readFile(path.join(dir, CART_FILE));
  const meta = await readMeta(dir);
  if (meta) {
    meta.lastPlayedAt = new Date().toISOString();
    await writeAtomic(path.join(dir, META_FILE), JSON.stringify(meta, null, 2)).catch(
      () => undefined,
    );
  }
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/** 카트리지 파일만 지운다. saves/ 가 있으면 폴더째 남겨 세이브를 보존한다 */
export async function removeCart(id: unknown): Promise<void> {
  const dir = entryDir(id);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name === SAVES_DIR) continue;
    await fs.rm(path.join(dir, name), { recursive: true, force: true });
  }
  const left = await fs.readdir(dir);
  if (left.length === 0) await fs.rm(dir, { recursive: true, force: true });
}

export async function openCartFolder(id: unknown): Promise<string> {
  const dir = entryDir(id);
  await fs.access(dir);
  const error = await shell.openPath(dir);
  if (error) throw new Error(error);
  return dir;
}

/** cart.nori 를 <id>-<version>.nori 이름으로 다른 곳에 복사 (대화상자). 취소하면 null */
export async function exportCart(event: IpcMainInvokeEvent, id: unknown): Promise<string | null> {
  const dir = entryDir(id);
  const meta = await readMeta(dir);
  const name = meta ? `${meta.id}-${meta.version}.nori` : `${String(id)}.nori`;
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win ?? new BrowserWindow({ show: false }), {
    defaultPath: path.join(app.getPath('documents'), name),
    filters: [{ name: 'NoriDeck cartridge', extensions: ['nori'] }],
  });
  if (result.canceled || !result.filePath) return null;
  await fs.copyFile(path.join(dir, CART_FILE), result.filePath);
  return result.filePath;
}

export function registerLibraryIpc(): void {
  ipcMain.handle('library:list', () => listLibrary());
  ipcMain.handle('library:import', (_event, input: DesktopLibraryImport) => importCart(input));
  ipcMain.handle('library:read', (_event, id) => readCart(id));
  ipcMain.handle('library:remove', (_event, id) => removeCart(id));
  ipcMain.handle('library:open-folder', (_event, id) => openCartFolder(id));
  ipcMain.handle('library:export', (event, id) => exportCart(event, id));
}
