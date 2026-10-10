import { describe, expect, it } from 'vitest';
import { ManifestError, parseCartInfo, parseNoriProject, parsePackedManifest } from './manifest';

const valid = {
  id: 'my-game',
  title: 'My Game',
  version: '1.2.3',
  screen: { width: 256, height: 192, layout: 'single' },
};

describe('parseCartInfo', () => {
  it('유효한 정보를 통과시키고 모르는 키는 버린다', () => {
    const info = parseCartInfo({ ...valid, saveSlots: ['main', 'slot2'], author: 'me', extra: 1 });
    expect(info).toEqual({ ...valid, saveSlots: ['main', 'slot2'], author: 'me' });
    expect('extra' in info).toBe(false);
  });

  it('gap 은 숫자일 때만 남긴다', () => {
    expect(
      parseCartInfo({ ...valid, screen: { ...valid.screen, layout: 'ds-dual', gap: 8 } }).screen
        .gap,
    ).toBe(8);
  });

  it.each([
    ['id 대문자', { ...valid, id: 'MyGame' }, 'id'],
    ['id 공백', { ...valid, id: 'my game' }, 'id'],
    ['version 형식', { ...valid, version: '1.0' }, 'version'],
    ['title 누락', { ...valid, title: undefined }, 'title'],
    ['layout 오타', { ...valid, screen: { ...valid.screen, layout: 'dual' } }, 'screen.layout'],
    ['width 0', { ...valid, screen: { ...valid.screen, width: 0 } }, 'width'],
    ['saveSlots 빈 배열', { ...valid, saveSlots: [] }, 'saveSlots'],
    ['saveSlots 이상한 이름', { ...valid, saveSlots: ['a/b'] }, 'saveSlots'],
  ])('%s 를 거부한다', (_name, input, key) => {
    expect(() => parseCartInfo(input)).toThrow(ManifestError);
    try {
      parseCartInfo(input);
    } catch (error) {
      expect((error as ManifestError).problems.join('\n')).toContain(key);
    }
  });

  it('객체가 아니면 거부한다', () => {
    expect(() => parseCartInfo(null)).toThrow(ManifestError);
    expect(() => parseCartInfo([])).toThrow(ManifestError);
  });

  it('여러 문제를 한 번에 알려 준다', () => {
    try {
      parseCartInfo({ id: 'X', version: 'v1' });
      expect.unreachable();
    } catch (error) {
      expect((error as ManifestError).problems.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('parseNoriProject', () => {
  it('build 설정을 함께 읽는다', () => {
    const project = parseNoriProject({ ...valid, build: { entry: 'src/main.ts' } });
    expect(project.build).toEqual({ entry: 'src/main.ts' });
  });

  it('build 가 객체가 아니면 거부한다', () => {
    expect(() => parseNoriProject({ ...valid, build: 'src' })).toThrow(ManifestError);
  });
});

describe('parsePackedManifest', () => {
  const packed = {
    ...valid,
    sdkVersion: '0.2.0',
    format: 1,
    entry: 'cart.js',
    builtAt: '2026-09-05T00:00:00Z',
  };

  it('패키지 매니페스트를 통과시킨다', () => {
    expect(parsePackedManifest(packed)).toEqual(packed);
  });

  it('format·entry·sdkVersion·builtAt 이 없으면 거부한다', () => {
    for (const key of ['format', 'entry', 'sdkVersion', 'builtAt'] as const) {
      const broken: Record<string, unknown> = Object.fromEntries(
        Object.entries(packed).filter(([name]) => name !== key),
      );
      expect(() => parsePackedManifest(broken)).toThrow(ManifestError);
    }
  });

  it('entry 는 루트 파일명만 허용한다', () => {
    expect(() => parsePackedManifest({ ...packed, entry: '../cart.js' })).toThrow(ManifestError);
  });
});
