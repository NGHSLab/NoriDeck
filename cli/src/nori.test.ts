/**
 * .nori 빌드 → 검사 → 해제 왕복 테스트. 샘플 카트리지(carts/sample)를 실제로 Vite 로 빌드한다.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isSafeEntryPath, makeChecksums, unzipFiles, verifyChecksums, zipFiles } from './archive';
import { SDK_VERSION } from '@nghslab/nori-sdk';
import { buildCart, type BuildResult } from './build';
import { checkNoriFile, inspectNori, unpackNori } from './check';

const SAMPLE_DIR = resolve(import.meta.dirname, '../../carts/sample');

describe('archive', () => {
  it.each(['manifest.json', 'assets/a/b.png', 'cart.js'])('안전한 경로: %s', (path) => {
    expect(isSafeEntryPath(path)).toBe(true);
  });

  it.each(['../x', 'a/../b', '/abs', 'a\\b', 'C:/x', '', 'a//b', './a'])(
    '위험한 경로: %s',
    (path) => {
      expect(isSafeEntryPath(path)).toBe(false);
    },
  );

  it('zip 왕복과 체크섬 검증', () => {
    const files = new Map<string, Uint8Array>([
      ['manifest.json', new TextEncoder().encode('{}')],
      ['assets/x.png', new Uint8Array([1, 2, 3])],
    ]);
    const checksums = makeChecksums(files);
    expect(Object.keys(checksums.files)).toEqual(['assets/x.png', 'manifest.json']);
    const restored = unzipFiles(zipFiles(files));
    expect([...restored.keys()].sort()).toEqual(['assets/x.png', 'manifest.json']);
    expect(verifyChecksums(restored, checksums)).toEqual([]);
    restored.set('assets/x.png', new Uint8Array([9]));
    expect(verifyChecksums(restored, checksums)).toEqual([
      'assets/x.png: 체크섬이 다릅니다 (내용이 변경됨)',
    ]);
  });

  it('manifest 가 없는 zip 은 검사에 실패한다', () => {
    const result = inspectNori(zipFiles(new Map([['cart.js', new Uint8Array([1])]])));
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('manifest.json');
  });
});

describe('nori build / check / unpack (샘플 카트리지)', () => {
  let outDir: string;
  let built: BuildResult;

  beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'nori-test-'));
    built = await buildCart({ cartDir: SAMPLE_DIR, outDir });
  });

  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('id-version.nori 를 만들고 매니페스트를 채운다', () => {
    expect(built.file).toBe(join(outDir, 'sample-0.1.0.nori'));
    expect(existsSync(built.file)).toBe(true);
    expect(built.manifest).toMatchObject({
      id: 'sample',
      format: 1,
      entry: 'cart.js',
      screen: { layout: 'single' },
    });
    expect(built.manifest.sdkVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect('build' in built.manifest).toBe(false);
  });

  it('검사에 통과한다', () => {
    const result = checkNoriFile(built.file);
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
    expect([...result.files.keys()]).toEqual(
      expect.arrayContaining(['manifest.json', 'cart.js', 'checksums.json', 'assets/README.txt']),
    );
  });

  it('번들은 ESM 이며 cartridge 를 export 한다', () => {
    const source = new TextDecoder().decode(checkNoriFile(built.file).files.get('cart.js'));
    expect(source).toMatch(/export\s*\{[^}]*\bcartridge\b/);
  });

  it('내용이 바뀐 파일은 체크섬 검사에서 잡힌다', () => {
    const files = unzipFiles(new Uint8Array(readFileSync(built.file)));
    files.set('cart.js', new TextEncoder().encode('export const cartridge = 1;'));
    const tampered = join(outDir, 'tampered.nori');
    writeFileSync(tampered, zipFiles(files));
    const result = checkNoriFile(tampered);
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual(['cart.js: 체크섬이 다릅니다 (내용이 변경됨)']);
    expect(() => unpackNori({ file: tampered, outDir: join(outDir, 'nope') })).toThrow(
      /검사에 실패/,
    );
  });

  it('풀면 같은 파일이 나오고, 비어 있지 않은 폴더는 force 없이 거부한다', () => {
    const target = join(outDir, 'unpacked');
    const { result } = unpackNori({ file: built.file, outDir: target });
    for (const path of result.files.keys())
      expect(existsSync(join(target, ...path.split('/')))).toBe(true);
    expect(() => unpackNori({ file: built.file, outDir: target })).toThrow(/--force/);
    expect(() => unpackNori({ file: built.file, outDir: target, force: true })).not.toThrow();
  });
});

describe('SDK 버전', () => {
  it('SDK_VERSION 상수와 sdk/package.json 의 version 이 같다', () => {
    const pkg = JSON.parse(readFileSync(resolve(SAMPLE_DIR, '../../sdk/package.json'), 'utf8')) as {
      version: string;
    };
    expect(SDK_VERSION).toBe(pkg.version);
  });
});
