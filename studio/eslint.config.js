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
    // launcher *contract* (types, pipeline functions, rule constants). Story 008 adds a second,
    // narrower door for the mirrored *rendering* set: `src/mirror-runtime/**` is the boundary
    // that renders the mirrored slide components with their own styles, so it is exempt here too
    // rather than left to the top-level `ignores` - a re-sync of either slice still only ever
    // touches one import zone. Everything else in `src/` and `tests/` goes through one of those
    // two doors. The mirror itself is exempt as well - it imports its own modules and its own
    // `@shared/*` alias.
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    ignores: ['src/launcher-core/**', 'src/contract/launcher-contract.ts', 'src/mirror-runtime/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/launcher-core/**', '@shared', '@shared/*'],
              message:
                'Only studio/src/contract/launcher-contract.ts (the data contract) or studio/src/mirror-runtime/** (the rendering boundary) may import the mirrored launcher code. Import from one of those instead.',
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
