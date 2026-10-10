/**
 * 카트리지 매니페스트 — `.nori` 포맷의 핵심.
 *
 *   nori.json (카트리지 프로젝트 루트)  ──nori build──▶  manifest.json (.nori 안)
 *
 * - CartInfo       : 카트리지가 스스로 밝히는 정보. nori.json 의 내용이며 게임 코드도 이것을 import 해서 쓴다
 * - NoriProject    : nori.json 전체 = CartInfo + build 설정(진입 파일·에셋 폴더)
 * - CartManifest   : 콘솔이 실행 중 보는 매니페스트 = CartInfo + sdkVersion (defineCartridge 가 채운다)
 * - PackedManifest : .nori 안의 manifest.json = CartManifest + format·entry·builtAt
 *
 * 검증기는 콘솔(로더)·CLI(build/check)·카트리지(defineCartridge) 가 같은 것을 쓴다.
 */
import type { ScreenSpec } from './index';

/** `.nori` 포맷 버전. 구조가 호환되지 않게 바뀌면 올린다 */
export const NORI_FORMAT = 1;
/** .nori 안의 진입 번들 파일명 */
export const NORI_ENTRY = 'cart.js';
/** 카트리지 ID: 세이브 폴더·URL·파일명에 쓰인다 */
export const CART_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const SLOT_PATTERN = /^[a-zA-Z0-9_-]{1,32}$/;
const LAYOUTS: readonly ScreenSpec['layout'][] = ['single', 'ds-dual'];

export interface CartInfo {
  /** 저장 폴더·URL 에 쓰이는 ID. [a-z0-9-] */
  id: string;
  title: string;
  /** semver */
  version: string;
  screen: ScreenSpec;
  /** 세이브 슬롯 이름. 생략 시 ['main'] */
  saveSlots?: string[];
  author?: string;
  description?: string;
  homepage?: string;
  /** 커버 이미지. nori.json 에서는 프로젝트 기준 상대 경로, 패키지 안에서는 파일명 */
  cover?: string;
}

export interface NoriBuildConfig {
  /** 진입 소스 파일 (기본 src/cart.ts). `cartridge` 를 export 해야 한다 */
  entry?: string;
  /** 에셋 폴더 (기본 public/assets). 패키지의 assets/ 가 된다 */
  assets?: string;
}

/** nori.json */
export interface NoriProject extends CartInfo {
  build?: NoriBuildConfig;
}

/** 콘솔이 실행 중 보는 매니페스트 */
export interface CartManifest extends CartInfo {
  /** 요구 SDK 버전. major 가 콘솔과 같아야 로드된다 */
  sdkVersion: string;
}

/** .nori 안의 manifest.json */
export interface PackedManifest extends CartManifest {
  format: number;
  entry: string;
  /** ISO 8601 */
  builtAt: string;
}

export class ManifestError extends Error {
  constructor(
    public readonly source: string,
    public readonly problems: readonly string[],
  ) {
    super(`${source} 이(가) 올바르지 않습니다:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ManifestError';
  }
}

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class Checker {
  readonly problems: string[] = [];
  constructor(readonly data: Rec) {}

  string(key: string, options: { optional?: boolean; pattern?: RegExp; hint?: string } = {}) {
    const value = this.data[key];
    if (value === undefined) {
      if (!options.optional) this.problems.push(`${key}: 필수 항목입니다`);
      return;
    }
    if (typeof value !== 'string' || value.length === 0) {
      this.problems.push(`${key}: 비어 있지 않은 문자열이어야 합니다`);
      return;
    }
    if (options.pattern && !options.pattern.test(value)) {
      this.problems.push(
        `${key}: '${value}' 은(는) 허용되지 않는 형식입니다${options.hint ? ` (${options.hint})` : ''}`,
      );
    }
  }

  integer(key: string, min: number) {
    const value = this.data[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
      this.problems.push(`${key}: ${min} 이상의 정수여야 합니다`);
    }
  }
}

function checkScreen(value: unknown, problems: string[]): void {
  if (!isRecord(value)) {
    problems.push('screen: { width, height, layout } 객체가 필요합니다');
    return;
  }
  const screen = new Checker(value);
  screen.integer('width', 1);
  screen.integer('height', 1);
  if (!LAYOUTS.includes(value.layout as ScreenSpec['layout'])) {
    problems.push(
      `screen.layout: ${LAYOUTS.map((layout) => `'${layout}'`).join(' | ')} 중 하나여야 합니다`,
    );
  }
  if (value.gap !== undefined && (typeof value.gap !== 'number' || value.gap < 0)) {
    problems.push('screen.gap: 0 이상의 숫자여야 합니다');
  }
  problems.push(...screen.problems);
}

function checkInfo(data: Rec): string[] {
  const checker = new Checker(data);
  checker.string('id', { pattern: CART_ID_PATTERN, hint: '소문자·숫자·하이픈, 63자 이내' });
  checker.string('title');
  checker.string('version', { pattern: SEMVER_PATTERN, hint: 'semver, 예 1.0.0' });
  checkScreen(data.screen, checker.problems);
  for (const key of ['author', 'description', 'homepage', 'cover'] as const) {
    checker.string(key, { optional: true });
  }
  const slots = data.saveSlots;
  if (slots !== undefined) {
    if (!Array.isArray(slots) || slots.length === 0) {
      checker.problems.push('saveSlots: 비어 있지 않은 문자열 배열이어야 합니다');
    } else {
      for (const slot of slots) {
        if (typeof slot !== 'string' || !SLOT_PATTERN.test(slot)) {
          checker.problems.push(
            `saveSlots: '${String(slot)}' 은(는) 허용되지 않는 슬롯 이름입니다`,
          );
        }
      }
    }
  }
  return checker.problems;
}

/** 검증된 CartInfo 만 남긴다 (모르는 키는 버린다) */
function pickInfo(data: Rec): CartInfo {
  const screenData = data.screen as Rec;
  const screen: ScreenSpec = {
    width: screenData.width as number,
    height: screenData.height as number,
    layout: screenData.layout as ScreenSpec['layout'],
  };
  if (typeof screenData.gap === 'number') screen.gap = screenData.gap;
  const info: CartInfo = {
    id: data.id as string,
    title: data.title as string,
    version: data.version as string,
    screen,
  };
  if (Array.isArray(data.saveSlots)) info.saveSlots = [...(data.saveSlots as string[])];
  for (const key of ['author', 'description', 'homepage', 'cover'] as const) {
    if (typeof data[key] === 'string') info[key] = data[key];
  }
  return info;
}

function requireRecord(input: unknown, source: string): Rec {
  if (!isRecord(input)) throw new ManifestError(source, ['JSON 객체가 아닙니다']);
  return input;
}

/** nori.json 의 카트리지 정보 부분을 검증한다. 게임 코드가 `import noriJson from '../nori.json'` 한 값을 넘긴다 */
export function parseCartInfo(input: unknown, source = 'nori.json'): CartInfo {
  const data = requireRecord(input, source);
  const problems = checkInfo(data);
  if (problems.length > 0) throw new ManifestError(source, problems);
  return pickInfo(data);
}

/** nori.json 전체 (카트리지 정보 + build 설정) */
export function parseNoriProject(input: unknown, source = 'nori.json'): NoriProject {
  const data = requireRecord(input, source);
  const problems = checkInfo(data);
  const project: NoriProject = problems.length > 0 ? ({} as NoriProject) : pickInfo(data);
  if (data.build !== undefined) {
    if (!isRecord(data.build)) {
      problems.push('build: { entry?, assets? } 객체여야 합니다');
    } else {
      const build = new Checker(data.build);
      build.string('entry', { optional: true });
      build.string('assets', { optional: true });
      problems.push(...build.problems);
      if (build.problems.length === 0) {
        project.build = {};
        if (typeof data.build.entry === 'string') project.build.entry = data.build.entry;
        if (typeof data.build.assets === 'string') project.build.assets = data.build.assets;
      }
    }
  }
  if (problems.length > 0) throw new ManifestError(source, problems);
  return project;
}

/** .nori 안의 manifest.json */
export function parsePackedManifest(input: unknown, source = 'manifest.json'): PackedManifest {
  const data = requireRecord(input, source);
  const problems = checkInfo(data);
  const checker = new Checker(data);
  checker.integer('format', 1);
  checker.string('entry');
  checker.string('sdkVersion', { pattern: SEMVER_PATTERN, hint: 'semver' });
  checker.string('builtAt');
  problems.push(...checker.problems);
  if (typeof data.entry === 'string' && (data.entry.includes('/') || data.entry.includes('\\'))) {
    problems.push('entry: 패키지 루트의 파일명이어야 합니다');
  }
  if (problems.length > 0) throw new ManifestError(source, problems);
  return {
    ...pickInfo(data),
    sdkVersion: data.sdkVersion as string,
    format: data.format as number,
    entry: data.entry as string,
    builtAt: data.builtAt as string,
  };
}

/** .nori 안 경로가 안전한지 (상위 이동·절대 경로·역슬래시·드라이브 문자·제어 문자 금지). 콘솔 로더와 CLI 가 같이 쓴다 */
export function isSafeEntryPath(path: string): boolean {
  if (path.length === 0 || path.length > 512) return false;
  if (path.startsWith('/') || path.includes('\\') || /^[A-Za-z]:/.test(path)) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(path)) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}
