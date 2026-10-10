/**
 * URL 로더: 풀어 놓은 .nori (manifest.json + cart.js + assets/) 를 URL 에서 불러온다.
 * 개발 서버(?cart=), 데스크톱의 nori:// 프로토콜, 웹 플레이가 모두 이 경로를 쓴다.
 */
import { NORI_FORMAT, parsePackedManifest, type Cartridge } from '@nghslab/nori-sdk';
import type { CartEntry } from './boot';

function isCartridge(value: unknown): value is Cartridge {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Cartridge).mount === 'function' &&
    typeof (value as Cartridge).manifest === 'object'
  );
}

/** cart.js 는 `cartridge` (또는 default) 를 export 해야 한다 */
export function pickCartridge(module: unknown): Cartridge {
  const candidates = module as { cartridge?: unknown; default?: unknown };
  if (isCartridge(candidates.cartridge)) return candidates.cartridge;
  if (isCartridge(candidates.default)) return candidates.default;
  throw new Error('cart.js 가 cartridge 를 export 하지 않습니다');
}

export function cartFromUrl(baseUrl: string): CartEntry {
  const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`, location.href);
  const id = base.pathname.split('/').filter(Boolean).pop() ?? 'cart';
  return {
    id,
    assetsBase: new URL('assets/', base).href,
    async load() {
      const response = await fetch(new URL('manifest.json', base));
      if (!response.ok)
        throw new Error(`manifest.json 을 받을 수 없습니다 (${response.status}) — ${base.href}`);
      const packed = parsePackedManifest(await response.json());
      if (packed.format !== NORI_FORMAT) {
        throw new Error(
          `.nori 포맷 ${packed.format} 은(는) 이 콘솔(포맷 ${NORI_FORMAT})이 모르는 버전입니다`,
        );
      }
      const entryUrl = new URL(packed.entry, base).href;
      const cartridge = pickCartridge(await import(/* @vite-ignore */ entryUrl));
      if (cartridge.manifest.id !== packed.id) {
        throw new Error(
          `manifest.json(${packed.id}) 과 cart.js(${cartridge.manifest.id}) 의 id 가 다릅니다`,
        );
      }
      return cartridge;
    },
  };
}
