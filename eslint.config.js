import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.wrangler/**',
      'apps/client/public/assets/factory/basis_transcoder.js',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs', '*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        WebSocket: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
  {
    files: ['packages/shared/src/**/*.ts'],
    ignores: ['**/__tests__/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'fetch',
        'WebSocket',
        'setTimeout',
        'setInterval',
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'Pass simulation time into the shared engine.',
        },
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded random generator.',
        },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: ['node:*', 'fs', 'http', 'https', 'net'] },
      ],
    },
  },
];
