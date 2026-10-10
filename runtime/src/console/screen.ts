import type { ScreenLayout, ScreenSpec, Unsubscribe } from '@nghslab/nori-sdk';

/**
 * 카트리지 화면 크기 관리. 논리 해상도의 비율을 유지한 채 사용 가능한 영역에 맞추고(FIT),
 * 남는 부분은 부모(#console) 의 검은 배경이 채운다. DS 에뮬레이터의 레터박스와 같다.
 */
export class ScreenManager {
  private current: ScreenLayout;
  private readonly listeners = new Set<(layout: ScreenLayout) => void>();
  private readonly observer: ResizeObserver;

  constructor(
    readonly container: HTMLElement,
    private readonly area: HTMLElement,
    private readonly spec: ScreenSpec,
  ) {
    this.current = this.compute();
    this.apply();
    this.observer = new ResizeObserver(() => this.refresh());
    this.observer.observe(area);
    window.addEventListener('resize', () => this.refresh());
  }

  get layout(): ScreenLayout {
    return this.current;
  }

  onResize(callback: (layout: ScreenLayout) => void): Unsubscribe {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  refresh(): void {
    this.current = this.compute();
    this.apply();
    for (const listener of this.listeners) listener(this.current);
  }

  destroy(): void {
    this.observer.disconnect();
    this.listeners.clear();
  }

  private compute(): ScreenLayout {
    const { width, height, layout, gap = 0 } = this.spec;
    const available = this.area.getBoundingClientRect();
    const scale = Math.max(0.1, Math.min(available.width / width, available.height / height) || 1);
    const result: ScreenLayout = { width, height, layout, gap, scale };
    if (layout === 'ds-dual') {
      const screenHeight = (height - gap) / 2;
      result.top = { x: 0, y: 0, width, height: screenHeight };
      result.bottom = { x: 0, y: screenHeight + gap, width, height: screenHeight };
    }
    return result;
  }

  private apply(): void {
    const { width, height, scale } = this.current;
    this.container.style.width = `${Math.floor(width * scale)}px`;
    this.container.style.height = `${Math.floor(height * scale)}px`;
  }
}
