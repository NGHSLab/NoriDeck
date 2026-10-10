import { DS_BUTTONS } from '@nghslab/nori-sdk';
import { describe, expect, it } from 'vitest';
import { PAD_SLOTS } from './keymapLayout';

describe('PAD_SLOTS', () => {
  it('모든 DS 버튼이 정확히 한 칸씩 있다', () => {
    const buttons = PAD_SLOTS.map((slot) => slot.button);
    expect([...buttons].sort()).toEqual([...DS_BUTTONS].sort());
  });

  it('grid 영역 이름이 겹치지 않는다', () => {
    const areas = PAD_SLOTS.map((slot) => slot.area);
    expect(new Set(areas).size).toBe(areas.length);
  });
});
