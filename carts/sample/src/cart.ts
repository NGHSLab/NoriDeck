/**
 * 샘플 카트리지: 한 화면(480×270, 16:9)에서 공이 튀고, 오른쪽 패널에 입력 상태를 보여 준다.
 * 외부 엔진 없이 canvas 만 사용한다. 콘솔 계약(ConsoleAPI)만으로 게임이 성립하는지 보여 주는 최소 예제.
 *
 *   방향키(D-Pad): 패들 이동    A(X 키): 공 리셋    Tab: 콘솔 배속 (콘솔이 처리, 카트리지는 time.speed 를 읽는다)
 */
import {
  defineCartridge,
  parseCartInfo,
  type ConsoleAPI,
  type GameInstance,
} from '@nghslab/nori-sdk';
import noriJson from '../nori.json';

// 매니페스트는 nori.json 하나로 관리한다 (nori build 도 같은 파일을 읽는다)
const info = parseCartInfo(noriJson);
const WIDTH = info.screen.width;
const HEIGHT = info.screen.height;
/** 왼쪽: 놀이판, 오른쪽: 정보 패널 */
const FIELD = { x: 0, y: 0, width: 320, height: HEIGHT };
const PANEL = { x: FIELD.width, y: 0, width: WIDTH - FIELD.width, height: HEIGHT };
const PADDLE_WIDTH = 48;

export const cartridge = defineCartridge({
  manifest: info,

  async mount(api: ConsoleAPI): Promise<GameInstance> {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    api.screen.container.append(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D 컨텍스트를 만들 수 없습니다');

    // 상태: 마지막 최고 반사 횟수는 세이브에 남긴다
    const state = { x: 160, y: 120, vx: 80, vy: 60, paddleX: 136, bounces: 0, best: 0 };
    try {
      const saved = await api.save.read('main');
      if (saved) state.best = Number(JSON.parse(saved).best) || 0;
    } catch {
      // 세이브가 깨져 있으면 0 부터
    }

    const reset = () => {
      state.x = FIELD.width / 2;
      state.y = FIELD.height / 2;
      state.vx = 80 * (Math.random() > 0.5 ? 1 : -1);
      state.vy = 60;
      state.bounces = 0;
    };
    const offReset = api.input.on('A', 'down', reset);

    let running = true;
    let last = performance.now();
    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000) * api.time.speed;
      last = now;

      // 패들 (D-Pad 좌우)
      if (api.input.isDown('LEFT')) state.paddleX -= 160 * dt;
      if (api.input.isDown('RIGHT')) state.paddleX += 160 * dt;
      state.paddleX = Math.max(0, Math.min(FIELD.width - PADDLE_WIDTH, state.paddleX));

      // 공
      state.x += state.vx * dt;
      state.y += state.vy * dt;
      if (state.x < 4 || state.x > FIELD.width - 4) state.vx *= -1;
      if (state.y < 4) state.vy *= -1;
      if (
        state.y > FIELD.height - 12 &&
        state.x > state.paddleX &&
        state.x < state.paddleX + PADDLE_WIDTH &&
        state.vy > 0
      ) {
        state.vy *= -1.03;
        state.bounces += 1;
        if (state.bounces > state.best) {
          state.best = state.bounces;
          void api.save.write(JSON.stringify({ best: state.best }), 'main');
        }
      }
      if (state.y > FIELD.height + 8) reset();

      // 그리기 — 놀이판
      ctx.fillStyle = '#15262f';
      ctx.fillRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);
      ctx.fillStyle = '#3df0d2';
      ctx.fillRect(state.paddleX, FIELD.height - 8, PADDLE_WIDTH, 4);
      ctx.beginPath();
      ctx.arc(state.x, state.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // 정보 패널
      ctx.fillStyle = '#f1ede9';
      ctx.fillRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height);
      ctx.fillStyle = '#d5cec7';
      ctx.fillRect(PANEL.x, PANEL.y, 1, PANEL.height);
      ctx.fillStyle = '#2a2320';
      ctx.font = '11px Galmuri11, monospace';
      const left = PANEL.x + 10;
      ctx.fillText(api.manifest.title, left, 22);
      ctx.fillText(`v${api.manifest.version}`, left, 38);
      ctx.fillText(`반사 ${state.bounces}`, left, 66);
      ctx.fillText(`최고 ${state.best}`, left, 82);
      ctx.fillText(`배속 ×${api.time.speed}`, left, 110);
      ctx.fillText(api.system.isDesktop ? '데스크톱' : '브라우저', left, 126);
      const held = (
        ['UP', 'DOWN', 'LEFT', 'RIGHT', 'A', 'B', 'X', 'Y', 'L', 'R', 'START', 'SELECT'] as const
      )
        .filter((button) => api.input.isDown(button))
        .join(' ');
      ctx.fillText('누른 버튼', left, 154);
      ctx.fillStyle = '#2f7bff';
      ctx.fillText(held || '-', left, 170);
      ctx.fillStyle = '#8a827b';
      ctx.font = '9px Galmuri9, monospace';
      ctx.fillText('← → 패들', left, PANEL.height - 48);
      ctx.fillText('X(A) 리셋', left, PANEL.height - 36);
      ctx.fillText('Tab 배속', left, PANEL.height - 24);
      ctx.fillText('F11 전체화면', left, PANEL.height - 12);

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    return {
      pause: () => {
        running = false;
      },
      resume: () => {
        if (running) return;
        running = true;
        last = performance.now();
        requestAnimationFrame(tick);
      },
      unmount: () => {
        running = false;
        offReset();
        canvas.remove();
      },
    };
  },
});
