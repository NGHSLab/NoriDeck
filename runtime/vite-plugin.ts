/**
 * Vite 플러그인: 카트리지 에셋 서빙.
 *
 * 개발 서버는 /carts/<id>/assets/* 를 지정한 폴더에서 직접 서빙하고,
 * 빌드는 dist/carts/<id>/assets/ 로 복사한다. ConsoleAPI.assets.url(path) 가 이 경로를 만든다.
 * runtime 자신(샘플 카트리지)과 게임팩의 개발 하네스가 같이 쓴다.
 */
import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import type { Plugin } from 'vite';

export interface CartAssetSource {
  id: string;
  /** 절대 경로 */
  assetsDir: string;
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
};

export function cartAssetsPlugin(carts: readonly CartAssetSource[]): Plugin {
  let outDir = 'dist';
  return {
    name: 'norideck-cart-assets',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0] ?? '';
        const match = /^\/carts\/([a-z0-9-]+)\/assets\/(.+)$/.exec(url);
        if (!match) {
          next();
          return;
        }
        const cart = carts.find((entry) => entry.id === match[1]);
        if (!cart) {
          next();
          return;
        }
        const file = normalize(join(cart.assetsDir, decodeURIComponent(match[2] ?? '')));
        if (
          !file.startsWith(normalize(cart.assetsDir)) ||
          !existsSync(file) ||
          !statSync(file).isFile()
        ) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    closeBundle() {
      for (const cart of carts) {
        if (!existsSync(cart.assetsDir)) continue;
        cpSync(cart.assetsDir, join(outDir, 'carts', cart.id, 'assets'), { recursive: true });
      }
    },
  };
}
