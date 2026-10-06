import nextPlugin from '@next/eslint-plugin-next';
import hooksPlugin from 'eslint-plugin-react-hooks';
import { nodeConfig } from './node.mjs';
export function nextConfig(root) {
  return [
    ...nodeConfig(root),
    {
      files: ['**/*.ts', '**/*.tsx'],
      plugins: { '@next/next': nextPlugin, 'react-hooks': hooksPlugin },
      rules: {
        ...nextPlugin.configs.recommended.rules,
        ...nextPlugin.configs['core-web-vitals'].rules,
        ...hooksPlugin.configs.recommended.rules,
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              '@crm/api',
              '@crm/api/*',
              '@crm/worker',
              '@crm/database',
              '@crm/database/*',
              '@crm/config/server',
            ],
          },
        ],
      },
    },
  ];
}
