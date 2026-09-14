import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'src/launcher-core/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Story 007 D4 (AC5): `src/contract/launcher-contract.ts` is the one door into the mirrored
    // launcher contract. Everything else in `src/` and `tests/` goes through that module, so a
    // re-sync of the mirror only ever has one import site to satisfy. The mirror itself is
    // exempt as well - it imports its own modules and its own `@shared/*` alias - and is listed
    // here rather than left to the top-level `ignores` so this zone stays correct on its own.
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    ignores: ['src/launcher-core/**', 'src/contract/launcher-contract.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/launcher-core/**', '@shared', '@shared/*'],
              message:
                'Only studio/src/contract/launcher-contract.ts may import the mirrored launcher contract. Import from there instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // React rules belong to the app source only. The tooling trees (config files, Playwright
    // specs) are plain Node modules, and `rules-of-hooks` misreads Playwright's `use` callback
    // there as a React hook.
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  eslintConfigPrettier,
)
