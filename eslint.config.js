import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'runtime/public/**',
      'desktop/release/**',
      '**/*.d.ts',
      'package-lock.json',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    files: ['**/*.ts'],
    rules: {
      // 타입 정의는 interface/type 을 상황에 맞게 자유롭게 사용
      '@typescript-eslint/consistent-type-definitions': 'off',
      // 데이터 파일을 다루므로 non-null assertion 은 금지 (테스트 제외)
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['runtime/src/**/*.ts', 'carts/*/src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: [
      'runtime/vite-plugin.ts',
      'cli/src/**/*.ts',
      'cli/scripts/**/*.mjs',
      'create-nori/*.mjs',
      'desktop/src/**/*.ts',
      'desktop/scripts/**/*.mjs',
      'tools/**/*.mjs',
      '*.config.{js,ts,mjs}',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
]);
