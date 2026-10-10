/**
 * nori check / unpack: .nori 파일을 읽어 구조·매니페스트·체크섬을 검사하고, 필요하면 폴더로 푼다.
 * 콘솔의 로더도 같은 규칙으로 검사한다 (manifest 검증기는 SDK 공용).
 */
import {
  isSdkCompatible,
  ManifestError,
  NORI_FORMAT,
  parsePackedManifest,
  SDK_VERSION,
  type PackedManifest,
} from '@nghslab/nori-sdk';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CHECKSUMS_FILE, decodeJson, MANIFEST_FILE, unzipFiles, verifyChecksums } from './archive';

export interface InspectResult {
  ok: boolean;
  manifest?: PackedManifest;
  files: Map<string, Uint8Array>;
  bytes: number;
  problems: string[];
  warnings: string[];
}

export function inspectNori(archive: Uint8Array): InspectResult {
  const problems: string[] = [];
  const warnings: string[] = [];
  let files = new Map<string, Uint8Array>();
  try {
    files = unzipFiles(archive);
  } catch (error) {
    return {
      ok: false,
      files,
      bytes: archive.byteLength,
      problems: [`zip 을 읽을 수 없습니다: ${String(error)}`],
      warnings,
    };
  }

  let manifest: PackedManifest | undefined;
  const manifestData = files.get(MANIFEST_FILE);
  if (!manifestData) {
    problems.push(`${MANIFEST_FILE} 이 없습니다`);
  } else {
    try {
      manifest = parsePackedManifest(decodeJson(manifestData, MANIFEST_FILE));
      if (manifest.format !== NORI_FORMAT) {
        problems.push(
          `format ${manifest.format} 은(는) 이 도구가 아는 포맷(${NORI_FORMAT})이 아닙니다`,
        );
      }
      if (!files.has(manifest.entry)) problems.push(`진입 파일 ${manifest.entry} 이(가) 없습니다`);
      if (manifest.cover && !files.has(manifest.cover))
        problems.push(`커버 ${manifest.cover} 이(가) 없습니다`);
      if (!isSdkCompatible(manifest.sdkVersion)) {
        warnings.push(
          `SDK ${manifest.sdkVersion} 은(는) 이 도구의 SDK ${SDK_VERSION} 와 major 가 달라 콘솔이 거부할 수 있습니다`,
        );
      }
    } catch (error) {
      problems.push(error instanceof ManifestError ? error.message : String(error));
    }
  }

  const checksumsData = files.get(CHECKSUMS_FILE);
  if (!checksumsData) {
    problems.push(`${CHECKSUMS_FILE} 이 없습니다`);
  } else {
    try {
      problems.push(...verifyChecksums(files, decodeJson(checksumsData, CHECKSUMS_FILE)));
    } catch (error) {
      problems.push(String(error));
    }
  }
  if (![...files.keys()].some((path) => path.startsWith('assets/')))
    warnings.push('assets/ 가 비어 있습니다');

  return {
    ok: problems.length === 0,
    manifest,
    files,
    bytes: archive.byteLength,
    problems,
    warnings,
  };
}

export function checkNoriFile(file: string): InspectResult {
  const path = resolve(file);
  if (!existsSync(path)) throw new Error(`파일이 없습니다: ${path}`);
  return inspectNori(new Uint8Array(readFileSync(path)));
}

export interface UnpackOptions {
  file: string;
  outDir?: string;
  force?: boolean;
}

/** 검사에 통과한 .nori 만 푼다. 대상 폴더가 비어 있지 않으면 force 없이는 거부 */
export function unpackNori(options: UnpackOptions): { outDir: string; result: InspectResult } {
  const result = checkNoriFile(options.file);
  if (!result.ok || !result.manifest) {
    throw new Error(`검사에 실패해 풀지 않습니다:\n  - ${result.problems.join('\n  - ')}`);
  }
  const outDir = resolve(options.outDir ?? `${result.manifest.id}-${result.manifest.version}`);
  if (existsSync(outDir) && readdirSync(outDir).length > 0 && !options.force) {
    throw new Error(`폴더가 비어 있지 않습니다: ${outDir} (덮어쓰려면 --force)`);
  }
  for (const [path, data] of result.files) {
    const target = join(outDir, ...path.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
  }
  return { outDir, result };
}
