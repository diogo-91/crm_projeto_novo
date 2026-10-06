import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
export function nodeConfig(root) {
  return [
    {
      ignores: [
        '**/dist/**',
        '**/node_modules/**',
        '**/.next/**',
        '**/.turbo/**',
        '**/src/generated/**',
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked.map((config) => ({
      ...config,
      files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    })),
    { languageOptions: { globals: globals.node } },
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
      languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': 'error',
        'no-restricted-imports': [
          'error',
          { patterns: ['@crm/web', '@crm/worker', '@crm/api/src/*', '../../../../../*'] },
        ],
      },
    },
  ];
}
