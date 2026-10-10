import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'sdk/src/**/*.test.ts',
      'cli/src/**/*.test.ts',
      'runtime/src/**/*.test.ts',
      'desktop/src/**/*.test.ts',
    ],
    testTimeout: 60_000,
    environment: 'node',
    // 테스트가 아직 없어도 CI 가 실패하지 않게
    passWithNoTests: true,
  },
});
