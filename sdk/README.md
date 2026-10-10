# @nghslab/nori-sdk

NoriDeck 콘솔과 카트리지(게임) 사이의 계약입니다. 카트리지는 이 패키지의 타입과 `defineCartridge` 만 알고, 콘솔 내부(Electron · 파일 · 창)는 모릅니다.

```bash
npm install @nghslab/nori-sdk
npm install -D @nghslab/nori-cli     # .nori 로 묶는 도구
```

```ts
import {
  defineCartridge,
  parseCartInfo,
  type ConsoleAPI,
  type GameInstance,
} from '@nghslab/nori-sdk';
import noriJson from '../nori.json';

export const cartridge = defineCartridge({
  manifest: parseCartInfo(noriJson),
  async mount(api: ConsoleAPI): Promise<GameInstance> {
    // api.screen · api.input · api.save · api.assets · api.time · api.system
    return { pause() {}, resume() {}, unmount() {} };
  },
});
```

- Phaser 3 로 만들면 `@nghslab/nori-sdk/phaser` 의 `createPhaserGame(api, config)` 을 쓰세요 (Phaser 는 선택 의존성).
- 새 프로젝트는 `npm create nori@latest my-cart` 또는 `npx @nghslab/nori-cli init my-cart` 로 만듭니다.
- 개발 가이드: https://github.com/NGHSLab/NoriDeck/blob/main/docs/cartridge-guide.md

콘솔은 카트리지의 `sdkVersion` major 가 자기 SDK major 와 같을 때만 실행합니다.
