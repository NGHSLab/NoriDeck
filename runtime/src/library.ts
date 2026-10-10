/**
 * 라이브러리(가져온 카트리지) 런타임 쪽 글루.
 *
 * 데스크톱 브리지의 library 를 써서 .nori 를 보관소에 넣고(가져오기), 보관된 파일을 다시 메모리에서 열어 실행한다.
 * 검사(zip 구조·매니페스트·체크섬)는 항상 런타임의 openNori 가 한다 — 데스크톱은 파일만 보관한다.
 * 브라우저(브리지 없음)에서는 라이브러리가 없고 드롭 즉시 실행만 한다.
 */
import type { CartEntry } from './boot';
import { CART_EXTENSION } from './config';
import { inspectNoriBytes, toCartEntry } from './nori/openNori';
import type {
  DesktopLibrary,
  DesktopLibraryEntry,
  DesktopLibraryImport,
  DesktopLibraryManifest,
} from './platform/bridge';

/** 데스크톱이면 라이브러리, 브라우저면 undefined */
export function desktopLibrary(): DesktopLibrary | undefined {
  return window.norideck?.library;
}

/** File(드롭·파일 선택) → 검사 → 라이브러리에 저장 */
export async function importNoriFile(
  library: DesktopLibrary,
  file: File,
): Promise<DesktopLibraryEntry> {
  if (!file.name.toLowerCase().endsWith(CART_EXTENSION))
    throw new Error(`${CART_EXTENSION} 파일이 아닙니다: ${file.name}`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { manifest, files } = await inspectNoriBytes(bytes);

  const picked: DesktopLibraryManifest = {
    id: manifest.id,
    title: manifest.title,
    version: manifest.version,
    sdkVersion: manifest.sdkVersion,
    screen: {
      width: manifest.screen.width,
      height: manifest.screen.height,
      layout: manifest.screen.layout,
    },
  };
  for (const key of ['author', 'description', 'homepage', 'cover'] as const) {
    const value = manifest[key];
    if (value) picked[key] = value;
  }

  const input: DesktopLibraryImport = { manifest: picked, bytes };
  const coverBytes = manifest.cover ? files.get(manifest.cover) : undefined;
  if (manifest.cover && coverBytes) input.cover = { name: manifest.cover, bytes: coverBytes };
  return library.import(input);
}

/** 보관된 카트리지를 메모리에서 열어 실행 가능한 CartEntry 로 */
export async function loadLibraryCart(
  library: DesktopLibrary,
  id: string,
): Promise<CartEntry & { release(): void }> {
  const bytes = await library.read(id);
  return toCartEntry(await inspectNoriBytes(bytes));
}
