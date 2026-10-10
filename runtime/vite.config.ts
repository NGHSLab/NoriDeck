import { defineConfig } from 'vite';

// 콘솔 자체는 카트리지를 내장하지 않는다. 개발 중 실행은 ?cart=/dev/<id>/ (nori unpack → public/dev) 로 한다
export default defineConfig({
  // 정적 호스팅·file:// 어디서든 동작하도록 상대 경로
  base: './',
  server: { port: 5173, open: false },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
  },
});
