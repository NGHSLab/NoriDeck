import { describe, expect, it } from 'vitest';
import { DEFAULT_FAST_SPEED } from '../config';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('없거나 깨진 값은 기본값', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('x')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ volume: 'loud', fastSpeed: 'fast' })).toEqual(DEFAULT_SETTINGS);
  });

  it('볼륨은 0~1 로 자르고, 배속은 허용 목록에 있는 값만', () => {
    expect(normalizeSettings({ volume: 2 }).volume).toBe(1);
    expect(normalizeSettings({ volume: -1 }).volume).toBe(0);
    expect(normalizeSettings({ volume: 0.25 }).volume).toBe(0.25);
    expect(normalizeSettings({ fastSpeed: 2 }).fastSpeed).toBe(2);
    expect(normalizeSettings({ fastSpeed: 7 }).fastSpeed).toBe(DEFAULT_FAST_SPEED);
    expect(normalizeSettings({ fastSpeed: Number.NaN }).fastSpeed).toBe(DEFAULT_FAST_SPEED);
  });
});
