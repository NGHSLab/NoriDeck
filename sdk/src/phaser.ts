/**
 * Phaser 3 어댑터. Phaser 로 만든 카트리지가 콘솔 화면·배속에 맞게 동작하도록 한다.
 * 콘솔 자체는 Phaser 를 모른다. 이 파일은 카트리지 편의용이다.
 */
import Phaser from 'phaser';
import type { ConsoleAPI, GameInstance } from './index';

export type PhaserCartConfig = Omit<
  Phaser.Types.Core.GameConfig,
  'parent' | 'scale' | 'width' | 'height'
>;

/**
 * 콘솔이 준 컨테이너에 Phaser 게임을 만든다.
 * - 논리 해상도는 매니페스트의 screen 을 쓰고, FIT 으로 컨테이너를 채운다 (컨테이너 비율은 콘솔이 맞춰 둔다)
 * - 키보드는 콘솔이 소유하므로 Phaser 키보드 플러그인은 끈다
 * - 콘솔 배속을 모든 활성 씬의 time / tweens / anims 와 소리 재생 속도(sound.rate)에 매 프레임 반영한다
 */
export function createPhaserGame(api: ConsoleAPI, config: PhaserCartConfig): Phaser.Game {
  const { width, height } = api.manifest.screen;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#000000',
    ...config,
    parent: api.screen.container,
    input: { ...(typeof config.input === 'object' ? config.input : {}), keyboard: false },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width,
      height,
    },
  });

  game.events.on(Phaser.Core.Events.PRE_STEP, () => {
    const speed = api.time.speed;
    game.anims.globalTimeScale = speed;
    // 소리도 같이 빨라진다 (옛 게임기 배속처럼 음정이 올라간다)
    if (game.sound.rate !== speed) game.sound.setRate(speed);
    for (const scene of game.scene.getScenes(true)) {
      if (scene.time.timeScale !== speed) scene.time.timeScale = speed;
      if (scene.tweens.timeScale !== speed) scene.tweens.timeScale = speed;
    }
  });

  api.screen.onResize(() => game.scale.refresh());
  return game;
}

/** Phaser 게임을 GameInstance 로 감싼다 */
export function phaserInstance(game: Phaser.Game): GameInstance {
  return {
    pause: () => game.loop.sleep(),
    resume: () => game.loop.wake(),
    unmount: () => game.destroy(true),
  };
}
