/**
 * runtime 단독 실행.
 *   기본: 홈 화면 (.nori 끌어다 놓기 · 아이콘 클릭으로 파일 열기)
 *   ?cart=<URL>: 풀어 놓은 .nori 폴더(manifest.json 이 있는 곳)를 그 자리에서 실행.
 *                예) nori unpack game.nori runtime/public/dev/game → http://localhost:5173/?cart=/dev/game/
 */
import { bootConsole } from './boot';
import { cartFromUrl } from './loader';

const cartUrl = new URLSearchParams(location.search).get('cart');
void bootConsole({
  carts: cartUrl ? [cartFromUrl(cartUrl)] : [],
  autoRun: Boolean(cartUrl),
}).catch(() => undefined);
