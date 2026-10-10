/**
 * .nori 아카이브 도우미: zip 읽기/쓰기, 경로 검사, 체크섬.
 * .nori 은 확장자만 다른 zip 이다. 경로 구분자는 항상 '/'.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { isSafeEntryPath } from '@nghslab/nori-sdk';
import { unzipSync, zipSync, type Zippable } from 'fflate';

export const CHECKSUMS_FILE = 'checksums.json';
export const MANIFEST_FILE = 'manifest.json';

export interface Checksums {
  algorithm: 'sha256';
  files: Record<string, string>;
}

/** 이미 압축된 형식은 저장만 한다 */
const STORED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.ogg',
  '.mp3',
  '.woff2',
  '.zip',
]);

export { isSafeEntryPath };

export function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** 폴더 안 모든 파일을 '/' 구분 상대 경로로, 정렬해서 읽는다 */
export function readTree(dir: string): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  const walk = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.set(relative(dir, full).split('\\').join('/'), new Uint8Array(readFileSync(full)));
    }
  };
  walk(dir);
  return new Map([...files.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function makeChecksums(files: Map<string, Uint8Array>): Checksums {
  // 입력 순서와 무관하게 항상 같은 결과가 나오도록 경로순 정렬
  const entries: Record<string, string> = {};
  for (const path of [...files.keys()].sort()) {
    if (path === CHECKSUMS_FILE) continue;
    const data = files.get(path);
    if (data) entries[path] = sha256(data);
  }
  return { algorithm: 'sha256', files: entries };
}

/** 체크섬 파일과 실제 내용을 대조한다. 문제 목록을 돌려준다 (비어 있으면 통과) */
export function verifyChecksums(files: Map<string, Uint8Array>, checksums: unknown): string[] {
  const problems: string[] = [];
  if (
    typeof checksums !== 'object' ||
    checksums === null ||
    (checksums as Checksums).algorithm !== 'sha256' ||
    typeof (checksums as Checksums).files !== 'object'
  ) {
    return [`${CHECKSUMS_FILE}: { algorithm: 'sha256', files: {...} } 형식이 아닙니다`];
  }
  const listed = (checksums as Checksums).files;
  for (const [path, data] of files) {
    if (path === CHECKSUMS_FILE) continue;
    const expected = listed[path];
    if (expected === undefined) problems.push(`${path}: 체크섬 목록에 없습니다`);
    else if (expected !== sha256(data)) problems.push(`${path}: 체크섬이 다릅니다 (내용이 변경됨)`);
  }
  for (const path of Object.keys(listed)) {
    if (!files.has(path)) problems.push(`${path}: 체크섬 목록에는 있지만 파일이 없습니다`);
  }
  return problems;
}

export function zipFiles(files: Map<string, Uint8Array>): Uint8Array {
  const zippable: Zippable = {};
  // manifest.json 을 맨 앞에 두어 헤더만 읽어도 찾기 쉽게 한다
  const ordered = [...files.keys()].sort((a, b) =>
    a === MANIFEST_FILE ? -1 : b === MANIFEST_FILE ? 1 : a < b ? -1 : 1,
  );
  for (const path of ordered) {
    const data = files.get(path);
    if (!data) continue;
    zippable[path] = [data, { level: STORED_EXTENSIONS.has(extname(path).toLowerCase()) ? 0 : 6 }];
  }
  return zipSync(zippable);
}

/** zip 을 풀어 파일 맵으로. 디렉터리 항목은 버리고, 위험한 경로는 오류 */
export function unzipFiles(archive: Uint8Array): Map<string, Uint8Array> {
  const raw = unzipSync(archive);
  const files = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(raw)) {
    if (path.endsWith('/')) continue;
    if (!isSafeEntryPath(path)) throw new Error(`안전하지 않은 경로가 들어 있습니다: ${path}`);
    files.set(path, data);
  }
  return files;
}

export function decodeJson(data: Uint8Array, name: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(data));
  } catch (error) {
    throw new Error(`${name} 을(를) JSON 으로 읽을 수 없습니다: ${String(error)}`);
  }
}

export function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
