/**
 * .nori 파일을 콘솔 안(브라우저)에서 바로 열어 실행한다 — 설치 없이 메모리에서.
 *
 *   파일(zip) → 풀기(fflate) → 경로 검사 → manifest.json 검증 → checksums.json 대조(SHA-256)
 *   → 파일마다 blob: URL → cart.js 를 import(), 에셋은 경로 → blob URL 표
 *
 * 홈 화면의 드래그 앤 드롭·"카트리지 열기", 나중의 웹 플레이가 이 경로를 쓴다.
 * 데스크톱에 설치(games/<id>/)해 두고 nori:// 로 여는 것은 2단계.
 */
import {
  isSafeEntryPath,
  isSdkCompatible,
  NORI_FORMAT,
  parsePackedManifest,
  SDK_VERSION,
  type PackedManifest,
} from '@nghslab/nori-sdk';
import { unzipSync } from 'fflate';
import type { CartEntry } from '../boot';
import { pickCartridge } from '../loader';

const MANIFEST_FILE = 'manifest.json';
const CHECKSUMS_FILE = 'checksums.json';

const MIME: Record<string, string> = {
  js: 'text/javascript',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  txt: 'text/plain',
  css: 'text/css',
};

export interface InspectedNori {
  manifest: PackedManifest;
  files: Map<string, Uint8Array>;
}

function decodeJson(data: Uint8Array, name: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(data));
  } catch (error) {
    throw new Error(`${name} 을(를) 읽을 수 없습니다: ${String(error)}`);
  }
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** 구조·매니페스트·체크섬을 검사한다. 통과하지 못하면 이유를 담은 Error */
export async function inspectNoriBytes(bytes: Uint8Array): Promise<InspectedNori> {
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(bytes);
  } catch (error) {
    throw new Error(`.nori(zip) 을 풀 수 없습니다: ${String(error)}`);
  }
  const files = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(raw)) {
    if (path.endsWith('/')) continue;
    if (!isSafeEntryPath(path)) throw new Error(`안전하지 않은 경로가 들어 있습니다: ${path}`);
    files.set(path, data);
  }

  const manifestData = files.get(MANIFEST_FILE);
  if (!manifestData) throw new Error(`${MANIFEST_FILE} 이 없습니다`);
  const manifest = parsePackedManifest(decodeJson(manifestData, MANIFEST_FILE));
  if (manifest.format !== NORI_FORMAT) {
    throw new Error(
      `.nori 포맷 ${manifest.format} 은(는) 이 콘솔(포맷 ${NORI_FORMAT})이 모르는 버전입니다`,
    );
  }
  if (!isSdkCompatible(manifest.sdkVersion)) {
    throw new Error(
      `SDK 버전이 맞지 않습니다: 카트리지 ${manifest.sdkVersion}, 콘솔 ${SDK_VERSION}`,
    );
  }
  if (!files.has(manifest.entry)) throw new Error(`진입 파일 ${manifest.entry} 이(가) 없습니다`);

  const checksumsData = files.get(CHECKSUMS_FILE);
  if (!checksumsData) throw new Error(`${CHECKSUMS_FILE} 이 없습니다`);
  const checksums = decodeJson(checksumsData, CHECKSUMS_FILE) as {
    algorithm?: unknown;
    files?: Record<string, string>;
  };
  if (checksums.algorithm !== 'sha256' || typeof checksums.files !== 'object' || !checksums.files) {
    throw new Error(`${CHECKSUMS_FILE} 형식이 아닙니다`);
  }
  for (const [path, data] of files) {
    if (path === CHECKSUMS_FILE) continue;
    const expected = checksums.files[path];
    if (!expected) throw new Error(`${path}: 체크섬 목록에 없습니다`);
    if (expected !== (await sha256Hex(data)))
      throw new Error(`${path}: 내용이 변경되었습니다 (체크섬 불일치)`);
  }
  return { manifest, files };
}

/** 검사된 패키지를 blob URL 로 올려 실행 가능한 CartEntry 로 만든다. release() 로 URL 을 해제한다 */
export function toCartEntry(inspected: InspectedNori): CartEntry & { release(): void } {
  const urls = new Map<string, string>();
  for (const [path, data] of inspected.files) {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    urls.set(
      path,
      URL.createObjectURL(
        new Blob([data as BlobPart], { type: MIME[ext] ?? 'application/octet-stream' }),
      ),
    );
  }
  const { manifest } = inspected;
  const entryUrl = urls.get(manifest.entry);
  if (!entryUrl) throw new Error(`진입 파일 ${manifest.entry} 이(가) 없습니다`);
  return {
    id: manifest.id,
    assetUrl: (path) => {
      const clean = path.replace(/^\/+/, '');
      if (clean === '') {
        console.warn(
          '[console] assets.url("") 을 기준 경로로 쓸 수 없습니다. 파일마다 assets.url(경로) 를 부르세요',
        );
        return '';
      }
      const url = urls.get(`assets/${clean}`);
      if (!url) console.warn(`[console] 카트리지에 없는 에셋: ${path}`);
      return url ?? '';
    },
    async load() {
      const cartridge = pickCartridge(await import(/* @vite-ignore */ entryUrl));
      if (cartridge.manifest.id !== manifest.id) {
        throw new Error(
          `manifest.json(${manifest.id}) 과 cart.js(${cartridge.manifest.id}) 의 id 가 다릅니다`,
        );
      }
      return cartridge;
    },
    release() {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
}

/** File(드롭·파일 선택) → CartEntry */
export async function openNoriFile(file: File): Promise<CartEntry & { release(): void }> {
  if (!/\.nori$/i.test(file.name)) throw new Error(`.nori 파일이 아닙니다: ${file.name}`);
  const inspected = await inspectNoriBytes(new Uint8Array(await file.arrayBuffer()));
  return toCartEntry(inspected);
}
